'use strict';
/* ==========================================================================
   Plateforme de suivi - Lamia — process principal (Electron)
   Cycle de vie, fenêtre sécurisée, instance unique, dossier de données,
   verrou, sauvegardes, IPC en liste blanche, exports, rappels, smoke test.
   ========================================================================== */
const electron = require('electron');
const { app, BrowserWindow, ipcMain, protocol, session, dialog, shell, nativeTheme, Menu, powerMonitor } = electron;
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const D = require('../shared/dates.js');
const model = require('../shared/model.js');
const demo = require('../shared/demo.js');
const { resolveDataDir, probeWritable, ensureDir } = require('./datadir.js');
const { DataStore, writeAtomic } = require('./storage.js');
const { DataLock } = require('./lock.js');
const { SystemIntegration, AUMID } = require('./system.js');
const proto = require('./protocol.js');

const ARGS = process.argv.slice(1);
const SMOKE = ARGS.includes('--smoke-test');
const AT_LOGIN = ARGS.includes('--au-demarrage');
const E2E = process.env.LAMIA_E2E === '1';
const ROOT = path.join(__dirname, '..');
const RENDERER = path.join(ROOT, 'renderer');
const SHARED = path.join(ROOT, 'shared');
const ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const T0 = Date.now() - Math.round(process.uptime() * 1000);   // démarrage du process

// Horloge simulée : seulement pour les tests (e2e) ou en développement
if (process.env.LAMIA_FAKE_NOW && (E2E || !app.isPackaged)) D.setNow(process.env.LAMIA_FAKE_NOW);
// Dossier utilisateur isolé (tests, smoke test) : à régler avant tout le reste
if (process.env.LAMIA_USER_DATA) app.setPath('userData', process.env.LAMIA_USER_DATA);

if (process.platform === 'win32') app.setAppUserModelId(AUMID);
protocol.registerSchemesAsPrivileged([proto.privilegedScheme()]);
Menu.setApplicationMenu(null);

const S = {
  win: null,
  store: null,
  lock: null,
  system: null,
  dirInfo: null,
  readOnly: false,
  readOnlyReason: null,     // 'lock' | 'too-new' | 'conflict'
  lockHolder: null,
  loadStatus: null,
  migratedFrom: null,
  quitting: false,
  pendingImports: new Map(),
  writtenFiles: new Set(),
  readyAt: null,
  dayTimer: null
};

function host() { return os.hostname() || 'PC'; }
// Journal du cycle de vie (diagnostic) : LAMIA_DEBUG=1
function trace(msg) { if (process.env.LAMIA_DEBUG) { try { process.stderr.write('[lamia] ' + msg + '\n'); } catch (e) { /* rien */ } } }
function exePath() { return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath; }

/* --- Instance unique ---------------------------------------------------- */
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  start();
}

function start() {
  app.on('web-contents-created', (_e, wc) => {
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', (ev, url) => { if (!url.startsWith(proto.ORIGIN + '/')) ev.preventDefault(); });
    wc.on('will-attach-webview', (ev) => ev.preventDefault());
  });

  app.whenReady().then(onReady).catch((e) => fatal(e));

  // Arrêt : on fait enregistrer l'interface (délai borné), puis on détruit la fenêtre sans passer par
  // beforeunload. Fermer une fenêtre CACHÉE (zone de notification) pouvait sinon bloquer l'arrêt.
  app.on('before-quit', (e) => {
    trace('before-quit');
    S.quitting = true;
    if (S.flushedForQuit || !S.win || S.win.isDestroyed()) return;
    e.preventDefault();
    flushRenderer(1500).then((r) => {
      trace('flush avant arrêt : ' + r);
      S.flushedForQuit = true;
      if (S.win && !S.win.isDestroyed()) { saveBounds(); S.win.destroy(); }
      app.quit();
    });
  });
  app.on('window-all-closed', () => { trace('window-all-closed'); app.quit(); });
  app.on('will-quit', () => {
    trace('will-quit');
    if (S.system) S.system.stop();
    trace('system stopped');
    if (S.lock) S.lock.release();
    if (S.dayTimer) clearInterval(S.dayTimer);
  });
  app.on('quit', () => trace('quit'));
}

function fatal(e) {
  const msg = (e && e.stack) || String(e);
  if (SMOKE) { smokeResult({ ok: false, error: msg }); return; }
  try { dialog.showErrorBox('Plateforme de suivi - Lamia', 'Un problème empêche le démarrage :\n\n' + msg); } catch (x) { /* rien */ }
  app.exit(1);
}

/* --- Démarrage ------------------------------------------------------------ */
async function onReady() {
  secureSession(session.defaultSession);
  proto.register(protocol, { renderer: RENDERER, shared: SHARED });

  // 1. Dossier de données
  S.dirInfo = resolveDataDir({
    env: process.env, platform: process.platform, isPackaged: app.isPackaged, execPath: process.execPath,
    appPath: app.getAppPath(), appDataPath: app.getPath('appData'), probe: probeWritable
  });
  if (S.dirInfo.fallback) ensureDir(S.dirInfo.dataDir);

  // 2. Verrou, puis données
  S.lock = new DataLock({ dir: S.dirInfo.dataDir, host: host(), user: safeUser(), appVersion: app.getVersion(), now: D.nowMs });
  S.store = new DataStore({ dir: S.dirInfo.dataDir, host: host(), appVersion: app.getVersion(), nowMs: D.nowMs });
  S.store.ensureDirs();
  const lockRes = S.lock.acquire();
  if (!lockRes.ok) setReadOnly('lock', lockRes.holder || { host: '?', error: lockRes.error });
  S.lock.startHeartbeat(() => { setReadOnly('lock', S.lock.read()); });

  const loaded = await loadData();
  if (!loaded) return;
  if (!S.readOnly) { try { S.store.dailyBackup(); } catch (e) { /* non bloquant */ } }
  // Sauvegarde quotidienne aussi quand l'app reste ouverte plusieurs jours
  S.dayTimer = setInterval(() => { if (!S.readOnly) { try { S.store.dailyBackup(); } catch (e) { /* rien */ } } }, 30 * 60 * 1000);

  // 3. Thème natif (barre de titre, barres de défilement) aligné sur les réglages
  nativeTheme.themeSource = themeOf(S.store.doc);

  // 4. Intégrations Windows (par PC)
  S.system = new SystemIntegration({
    electron, iconPath: ICON, platform: process.platform, exePath: exePath(),
    userDataDir: app.getPath('userData'),
    getWindow: () => S.win, getDoc: () => S.store && S.store.doc,
    showWindow, send, quit: () => { S.quitting = true; app.quit(); }
  });

  registerIpc();
  createWindow();
  if (!SMOKE) S.system.start();

  powerMonitor.on('suspend', () => send('app:flush'));
  powerMonitor.on('resume', () => { if (S.system) S.system.checkReminders(); });

  if (SMOKE) runSmoke().catch((e) => smokeResult({ ok: false, error: String(e && e.stack || e) }));
}

function safeUser() { try { return os.userInfo().username; } catch (e) { return ''; } }

function themeOf(doc) {
  const th = doc && doc.settings && doc.settings.theme;
  return th === 'light' || th === 'dark' ? th : 'system';
}

function setReadOnly(reason, holder) {
  S.readOnly = true;
  S.readOnlyReason = reason;
  if (holder) S.lockHolder = { host: holder.host, user: holder.user, openedAt: holder.openedAt, heartbeatAt: holder.heartbeatAt };
  send('app:state', info());
}

// Charge data.json ; gère le fichier illisible (jamais d'écrasement silencieux)
async function loadData() {
  let res = S.store.load();
  S.loadStatus = res.status;
  if (res.status === 'ok' || res.status === 'created') { S.migratedFrom = res.migrated ? res.from : null; return true; }
  if (res.status === 'too-new') {
    if (!res.doc) { fatal(new Error(res.error)); return false; }
    S.store.doc = res.doc;
    setReadOnly('too-new');
    return true;
  }
  // Fichier illisible
  if (SMOKE) { smokeResult({ ok: false, error: 'data.json illisible : ' + res.error }); return false; }
  const backups = S.store.listBackups().filter((b) => b.readable);
  const buttons = backups.length
    ? ['Restaurer la dernière sauvegarde', 'Repartir de zéro', 'Quitter']
    : ['Repartir de zéro', 'Quitter'];
  const r = await dialog.showMessageBox({
    type: 'warning', title: 'Plateforme de suivi - Lamia', buttons, defaultId: 0, cancelId: buttons.length - 1, noLink: true,
    message: 'Le fichier de données est illisible.',
    detail: res.error + '\n\nRien n’a été effacé : le fichier abîmé est mis de côté dans Donnees-Lamia (data-illisible-….json).' +
      (backups.length ? '\nDernière sauvegarde : ' + backups[0].id + ' (' + backups[0].summary.tasks + ' tâches).' : '')
  });
  const choice = buttons[r.response];
  if (choice === 'Quitter') { app.exit(0); return false; }
  if (S.readOnly) { dialog.showErrorBox('Plateforme de suivi - Lamia', 'L’application est ouverte sur un autre PC : réessaie quand elle y sera fermée.'); app.exit(0); return false; }
  S.store.setAsideCorrupt();
  if (choice === 'Restaurer la dernière sauvegarde') {
    const rr = S.store.restore(backups[0].id);
    if (rr.ok) { S.loadStatus = 'restored'; return true; }
  }
  res = S.store.load();
  S.loadStatus = res.status;
  return res.status === 'ok' || res.status === 'created';
}

/* --- Sécurité : aucune requête réseau, aucune permission --------------------- */
function secureSession(ses) {
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = /^(app|data|blob|devtools|about|chrome-extension):/i.test(details.url);
    cb({ cancel: !ok });
  });
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
}

/* --- Fenêtre ---------------------------------------------------------------- */
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'fenetre.json');

function readBounds() {
  try { return JSON.parse(fs.readFileSync(BOUNDS_FILE(), 'utf8')); } catch (e) { return null; }
}
function saveBounds() {
  if (!S.win || S.win.isDestroyed() || S.win.isMinimized()) return;
  try { fs.writeFileSync(BOUNDS_FILE(), JSON.stringify(Object.assign(S.win.getNormalBounds(), { maximized: S.win.isMaximized() }))); } catch (e) { /* rien */ }
}

function createWindow() {
  const b = (!SMOKE && !E2E && readBounds()) || {};
  const dark = nativeTheme.shouldUseDarkColors;
  // Taille de référence de la maquette (1440 × 900), bornée à l'écran disponible
  const wa = electron.screen.getPrimaryDisplay().workAreaSize;
  S.win = new BrowserWindow({
    width: b.width || Math.min(1440, wa.width), height: b.height || Math.min(900, wa.height), x: b.x, y: b.y,
    useContentSize: !b.width,
    minWidth: 380, minHeight: 560,
    show: false,
    title: 'Plateforme de suivi - Lamia',
    icon: ICON,
    backgroundColor: dark ? '#14112E' : '#F4F6FF',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
      devTools: !app.isPackaged || E2E
    }
  });
  if (b.maximized) S.win.maximize();

  const theme = themeOf(S.store.doc);
  S.win.loadURL(proto.ORIGIN + '/index.html' + (theme !== 'system' ? '?theme=' + theme : ''));

  S.win.once('ready-to-show', () => {
    if (SMOKE) return;
    if (AT_LOGIN && S.system && S.system.options.closeToTray) { S.system.ensureTray(); return; }   // démarrage discret
    S.win.show();
  });

  S.win.on('close', (e) => {
    trace('window close (quitting=' + S.quitting + ')');
    saveBounds();
    if (!S.quitting && !SMOKE && S.system && S.system.options.closeToTray) {
      e.preventDefault();
      send('app:flush');
      S.win.hide();
      S.system.hiddenToTray();
    }
  });
  S.win.on('closed', () => { trace('window closed'); S.win = null; });
  S.win.on('focus', () => { try { S.win.flashFrame(false); } catch (e) { /* rien */ } });
}

function showWindow() {
  if (!S.win) { createWindow(); return; }
  if (S.win.isMinimized()) S.win.restore();
  S.win.show();
  S.win.focus();
}

// Demande à l'interface d'écrire tout de suite ses modifications en attente
function flushRenderer(timeoutMs) {
  if (!S.win || S.win.isDestroyed()) return Promise.resolve('sans fenêtre');
  const js = 'window.Lamia && window.Lamia.store && window.Lamia.store.flushSync ? (window.Lamia.store.flushSync(), "ok") : "absent"';
  return Promise.race([
    S.win.webContents.executeJavaScript(js, true).catch((e) => 'erreur ' + e.message),
    new Promise((r) => setTimeout(() => r('délai dépassé'), timeoutMs))
  ]);
}

function send(channel, payload) {
  if (S.win && !S.win.isDestroyed()) S.win.webContents.send(channel, payload);
}

/* --- Infos transmises à l'interface ----------------------------------------- */
function info() {
  const di = S.dirInfo || {};
  return {
    version: app.getVersion(),
    host: host(),
    platform: process.platform,
    packaged: app.isPackaged,
    mode: di.mode,
    dataDir: di.dataDir,
    dataDirFallback: !!di.fallback,
    dataDirWanted: di.wanted || null,
    dataDirReason: di.reason || null,
    readOnly: S.readOnly,
    readOnlyReason: S.readOnlyReason,
    lockHolder: S.lockHolder,
    loadStatus: S.loadStatus,
    migratedFrom: S.migratedFrom,
    fakeNow: D.isClockShifted() ? new Date(D.nowMs()).toISOString() : null,
    machine: S.system ? S.system.info() : null,
    atLogin: AT_LOGIN,
    smoke: SMOKE
  };
}

/* --- IPC ------------------------------------------------------------------- */
function trusted(e) {
  const url = (e.senderFrame && e.senderFrame.url) || '';
  return url.startsWith(proto.ORIGIN + '/');
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (e, payload) => {
    if (!trusted(e)) throw new Error('Expéditeur refusé');
    return fn(payload, e);
  });
}

function saveDoc(doc) {
  if (S.readOnly) return { ok: false, readOnly: true, reason: S.readOnlyReason };
  if (!doc || typeof doc !== 'object') return { ok: false, error: 'Document manquant.' };
  const res = S.store.save(doc);
  if (res.conflict) setReadOnly('conflict');
  if (res.ok && S.system) S.system.refreshTray();
  return res;
}

function defaultExportPath(filename) {
  const dir = S.store.exportDir;
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir); } catch (e) { /* rien */ }
  return path.join(dir, filename);
}

function cleanName(name, ext) {
  let n = String(name || 'export').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 120);
  if (!n.toLowerCase().endsWith(ext)) n += ext;
  return n;
}

async function askSavePath(filename, filters) {
  const r = await dialog.showSaveDialog(S.win, { defaultPath: defaultExportPath(filename), filters });
  if (r.canceled || !r.filePath) return null;
  return r.filePath;
}

function registerIpc() {
  handle('app:boot', () => ({ doc: S.store.doc, info: info() }));
  ipcMain.on('app:ready', (e, m) => {
    if (!trusted(e)) return;
    S.readyAt = Date.now();
    S.readyInfo = m || {};
    if (S.onReady) S.onReady();
  });
  handle('app:set-theme', (theme) => {
    nativeTheme.themeSource = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
    return true;
  });
  handle('app:open-data-folder', async () => {
    const err = await shell.openPath(S.store.dir);
    return { ok: !err, error: err || null, path: S.store.dir };
  });
  handle('app:show-file', (file) => {
    if (typeof file !== 'string' || !S.writtenFiles.has(file)) return false;
    shell.showItemInFolder(file);
    return true;
  });
  handle('app:set-machine-options', (patch) => {
    const clean = {};
    ['closeToTray', 'openAtLogin', 'windowsNotifications'].forEach((k) => { if (patch && k in patch) clean[k] = !!patch[k]; });
    return S.system.set(clean);
  });
  handle('app:test-notification', () => {
    if (S.system.options.windowsNotifications) S.system.ensureShortcut();   // recrée le raccourci s'il a disparu
    return { shown: S.system.notify('Les rappels sont prêts', 'Tu recevras ici les rappels d’échéance. À très vite, Lamia !') };
  });

  handle('data:save', (doc) => saveDoc(doc));
  ipcMain.on('data:save-sync', (e, doc) => {
    trace('save-sync');
    if (!trusted(e)) { e.returnValue = { ok: false }; return; }
    try { e.returnValue = saveDoc(doc); } catch (x) { e.returnValue = { ok: false, error: String(x.message || x) }; }
  });
  handle('data:load-demo', () => {
    if (S.readOnly) return { ok: false, readOnly: true };
    const doc = demo.seed({ today: D.today(), nowMs: D.nowMs(), appVersion: app.getVersion() });
    const r = S.store.replace(doc, 'demo');
    if (r.ok) nativeTheme.themeSource = themeOf(r.doc);
    return r;
  });
  handle('data:retry-lock', () => relock(false));
  handle('data:force-lock', () => relock(true));
  handle('data:reload', () => {
    if (S.readOnlyReason === 'conflict') {
      const res = S.store.load();
      if (res.status !== 'ok') return { ok: false, error: res.error };
      S.readOnly = false; S.readOnlyReason = null;
    }
    return { ok: true, doc: S.store.doc, info: info() };
  });

  handle('backup:list', () => S.store.listBackups());
  handle('backup:restore', (id) => {
    if (S.readOnly) return { ok: false, readOnly: true };
    return S.store.restore(id);
  });
  handle('backup:export-json', async () => {
    const file = await askSavePath(`sauvegarde-lamia-${D.today()}.json`, [{ name: 'Sauvegarde', extensions: ['json'] }]);
    if (!file) return { ok: false, canceled: true };
    writeAtomic(file, JSON.stringify(S.store.doc, null, 2));
    S.writtenFiles.add(file);
    return { ok: true, path: file };
  });
  handle('backup:import-pick', async () => {
    const r = await dialog.showOpenDialog(S.win, { properties: ['openFile'], filters: [{ name: 'Sauvegarde', extensions: ['json'] }], defaultPath: S.store.exportDir });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    const file = r.filePaths[0];
    let raw;
    try {
      if (fs.statSync(file).size > 50 * 1024 * 1024) return { ok: false, error: 'Fichier trop volumineux.' };
      raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    } catch (e) { return { ok: false, error: 'Ce fichier n’est pas une sauvegarde lisible.' }; }
    const parsed = S.store.parseDoc(raw);
    if (!parsed.ok) return { ok: false, error: parsed.code === 'TOO_NEW' ? parsed.error : 'Ce n’est pas une sauvegarde de la plateforme. Rien n’a été modifié.' };
    const token = crypto.randomUUID();
    S.pendingImports.set(token, parsed.doc);
    return { ok: true, token, fileName: path.basename(file), summary: model.summarize(parsed.doc), from: parsed.from };
  });
  handle('backup:import-apply', (token) => {
    if (S.readOnly) return { ok: false, readOnly: true };
    const doc = S.pendingImports.get(token);
    if (!doc) return { ok: false, error: 'Import expiré, recommence.' };
    S.pendingImports.delete(token);
    const r = S.store.replace(doc, 'import');
    if (r.ok) nativeTheme.themeSource = themeOf(r.doc);
    return r;
  });

  handle('io:export-csv', async (o) => {
    if (!o || typeof o.content !== 'string' || o.content.length > 20 * 1024 * 1024) return { ok: false, error: 'Contenu invalide.' };
    const file = await askSavePath(cleanName(o.filename, '.csv'), [{ name: 'CSV (Excel)', extensions: ['csv'] }]);
    if (!file) return { ok: false, canceled: true };
    writeAtomic(file, o.content);
    S.writtenFiles.add(file);
    return { ok: true, path: file };
  });
  handle('io:export-pdf', async (o) => {
    const name = cleanName(o && o.filename, '.pdf');
    const pdf = await S.win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true });
    const file = await askSavePath(name, [{ name: 'PDF', extensions: ['pdf'] }]);
    if (!file) return { ok: false, canceled: true };
    writeAtomic(file, pdf);
    S.writtenFiles.add(file);
    return { ok: true, path: file, size: pdf.length };
  });
}

// Lecture seule → réessayer (ou forcer) : on relit les données, peut-être modifiées sur l'autre PC
function relock(force) {
  const r = S.lock.acquire({ force });
  if (!r.ok) { S.lockHolder = r.holder || S.lockHolder; return { ok: false, info: info() }; }
  const res = S.store.load();
  if (res.status !== 'ok' && res.status !== 'created') return { ok: false, error: res.error, info: info() };
  S.readOnly = false; S.readOnlyReason = null; S.lockHolder = null;
  try { S.store.dailyBackup(); } catch (e) { /* rien */ }
  return { ok: true, doc: S.store.doc, info: info() };
}

/* --- Smoke test (CI Windows) : démarre sans fenêtre visible, écrit et relit
       Donnees-Lamia/ à côté de l'exe, mesure le démarrage, quitte (0 ou 1). --- */
async function runSmoke() {
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || null });
  const di = S.dirInfo;
  check('dossier de données à côté de l’exe', !di.fallback, di.dataDir);
  check('data.json chargé', S.loadStatus === 'ok' || S.loadStatus === 'created', S.loadStatus);
  check('verrou pris', S.lock.held, null);
  const probe = path.join(di.dataDir, 'smoke-test.tmp.json');
  const token = crypto.randomUUID();
  try {
    writeAtomic(probe, JSON.stringify({ token }));
    const back = JSON.parse(fs.readFileSync(probe, 'utf8'));
    check('écriture puis relecture', back.token === token, probe);
  } catch (e) { check('écriture puis relecture', false, String(e.message || e)); }
  try { fs.unlinkSync(probe); } catch (e) { /* rien */ }
  const saved = S.store.save(S.store.doc);
  check('enregistrement atomique de data.json', saved.ok, saved.error || ('révision ' + saved.revision));
  const reread = S.store.parseFile(S.store.file);
  check('relecture et validation de data.json', reread.ok, reread.error || null);
  check('sauvegarde quotidienne', fs.existsSync(path.join(S.store.backupDir, `data-${D.today()}.json`)), null);

  const appReadyMs = Date.now() - T0;
  const uiReady = await new Promise((resolve) => {
    if (S.readyAt) return resolve(true);
    const t = setTimeout(() => resolve(false), 60000);
    S.onReady = () => { clearTimeout(t); resolve(true); };
  });
  check('interface prête (fenêtre cachée)', uiReady, S.readyInfo ? JSON.stringify(S.readyInfo) : null);
  smokeResult({
    ok: checks.every((c) => c.ok),
    checks,
    timings: { processToAppReadyMs: appReadyMs, processToUiReadyMs: S.readyAt ? S.readyAt - T0 : null },
    version: app.getVersion(), mode: di.mode, dataDir: di.dataDir, exe: exePath(), platform: process.platform
  });
}

function smokeResult(result) {
  result.finishedAt = new Date().toISOString();
  const text = JSON.stringify(result, null, 2);
  try { console.log(text); } catch (e) { /* pas de console sous Windows */ }
  const dir = S.dirInfo && S.dirInfo.dataDir;
  if (dir) { try { fs.writeFileSync(path.join(dir, 'smoke-test-result.json'), text); } catch (e) { /* rien */ } }
  if (S.lock) S.lock.release();
  app.exit(result.ok ? 0 : 1);
}
