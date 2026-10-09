'use strict';
/* ==========================================================================
   Intégrations Windows, réglées PAR PC (fichier reglages-pc.json dans le
   dossier utilisateur %APPDATA%, jamais dans Donnees-Lamia) :
   - « Fermer dans la zone de notification » (icône + menu Ouvrir / Chrono en
     cours / Quitter) ;
   - « Lancer au démarrage de Windows » (chemin de l'exe portable d'ORIGINE) ;
   - « Activer les notifications Windows » (raccourci du menu Démarrer portant
     l'AppUserModelID, indispensable aux toasts d'une app portable ; repli :
     bulle de la zone de notification).
   Plus le planificateur des rappels : vérification toutes les 15 minutes.
   Toutes les options sont désactivées par défaut (sauf le rappel dans l'app,
   réglé dans les données).
   ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const D = require('../shared/dates.js');
const R = require('../shared/reminders.js');

const AUMID = 'fr.lamia.plateforme-suivi';
const PRODUCT = 'Plateforme de suivi - Lamia';
const CHECK_MS = 15 * 60 * 1000;
const DEFAULTS = { closeToTray: false, openAtLogin: false, windowsNotifications: false };

class SystemIntegration {
  constructor(o) {
    this.e = o.electron;                 // { app, Tray, Menu, Notification, shell, nativeImage }
    this.iconPath = o.iconPath;
    this.getWindow = o.getWindow;
    this.getDoc = o.getDoc;
    this.showWindow = o.showWindow;
    this.send = o.send;
    this.quit = o.quit;
    this.platform = o.platform || process.platform;
    this.exePath = o.exePath;            // exe d'origine (PORTABLE_EXECUTABLE_FILE en mode portable)
    this.file = path.join(o.userDataDir, 'reglages-pc.json');
    this.options = Object.assign({}, DEFAULTS, this.read());
    this.tray = null;
    this.notified = new Set();
    this.notifiedDay = null;
    this.timers = [];
    this.trayHintShown = false;
  }

  read() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { return {}; } }
  write() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.options, null, 2));
    } catch (e) { /* non bloquant */ }
  }

  get startMenuLink() {
    return path.join(this.e.app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', PRODUCT + '.lnk');
  }

  info() {
    const N = this.e.Notification;
    return Object.assign({}, this.options, {
      platform: this.platform,
      notificationsSupported: !!(N && N.isSupported && N.isSupported()),
      loginItemSupported: this.platform === 'win32' || this.platform === 'darwin',
      shortcut: this.platform === 'win32' ? fs.existsSync(this.startMenuLink) : false,
      exePath: this.exePath
    });
  }

  /* --- Au démarrage : réappliquer (l'exe a pu être déplacé) --------------- */
  start() {
    if (this.options.closeToTray) this.ensureTray();
    if (this.options.openAtLogin) this.applyLoginItem(true);
    if (this.options.windowsNotifications) this.ensureShortcut();
    this.timers.push(setTimeout(() => this.checkReminders(), 60 * 1000));
    this.timers.push(setInterval(() => this.checkReminders(), CHECK_MS));
    this.timers.push(setInterval(() => this.refreshTray(), 60 * 1000));
  }

  stop() {
    this.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    this.timers = [];
    if (this.tray) { this.tray.destroy(); this.tray = null; }
  }

  /* --- Options ------------------------------------------------------------ */
  set(patch) {
    const messages = [];
    if ('closeToTray' in patch) {
      this.options.closeToTray = !!patch.closeToTray;
      if (this.options.closeToTray) this.ensureTray(); else if (this.tray) { this.tray.destroy(); this.tray = null; }
    }
    if ('openAtLogin' in patch) {
      this.options.openAtLogin = !!patch.openAtLogin;
      const ok = this.applyLoginItem(this.options.openAtLogin);
      if (!ok && this.options.openAtLogin) messages.push('Le lancement au démarrage n’est disponible que sous Windows.');
    }
    if ('windowsNotifications' in patch) {
      this.options.windowsNotifications = !!patch.windowsNotifications;
      if (this.options.windowsNotifications) {
        const ok = this.ensureShortcut();
        if (!ok && this.platform === 'win32') messages.push('Le raccourci du menu Démarrer n’a pas pu être créé : les rappels passeront par la zone de notification.');
      } else this.removeShortcut();
    }
    this.write();
    return { options: this.info(), messages };
  }

  applyLoginItem(on) {
    if (this.platform !== 'win32' && this.platform !== 'darwin') return false;
    try {
      this.e.app.setLoginItemSettings({ openAtLogin: !!on, path: this.exePath, args: ['--au-demarrage'] });
      return true;
    } catch (e) { return false; }
  }

  ensureShortcut() {
    if (this.platform !== 'win32') return false;
    try {
      const link = this.startMenuLink;
      fs.mkdirSync(path.dirname(link), { recursive: true });
      let current = null;
      try { current = this.e.shell.readShortcutLink(link); } catch (e) { current = null; }
      if (current && current.target === this.exePath && current.appUserModelId === AUMID) return true;
      return this.e.shell.writeShortcutLink(link, current ? 'replace' : 'create', {
        target: this.exePath,
        cwd: path.dirname(this.exePath),
        description: PRODUCT,
        icon: this.exePath,
        iconIndex: 0,
        appUserModelId: AUMID
      });
    } catch (e) { return false; }
  }

  removeShortcut() {
    if (this.platform !== 'win32') return;
    try { fs.unlinkSync(this.startMenuLink); } catch (e) { /* absent */ }
  }

  /* --- Zone de notification ---------------------------------------------- */
  ensureTray() {
    if (this.tray) return this.tray;
    try {
      this.tray = new this.e.Tray(this.e.nativeImage.createFromPath(this.iconPath));
    } catch (e) { this.tray = null; return null; }
    this.tray.setToolTip(PRODUCT);
    this.tray.on('click', () => this.showWindow());
    this.tray.on('double-click', () => this.showWindow());
    this.refreshTray();
    return this.tray;
  }

  timerLabel() {
    const doc = this.getDoc();
    const tm = doc && doc.activeTimer;
    const t = tm && (doc.tasks || []).find((x) => x.id === tm.taskId);
    if (!t) return null;
    const ms = (tm.accumulatedMs || 0) + (tm.pausedAt ? 0 : Math.max(0, D.nowMs() - Date.parse(tm.startedAt)));
    const title = t.title.length > 40 ? t.title.slice(0, 39) + '…' : t.title;
    return { id: t.id, label: (tm.pausedAt ? 'Chrono en pause : ' : 'Chrono en cours : ') + title + ' (' + D.duration(Math.floor(ms / 60000)) + ')' };
  }

  refreshTray() {
    if (!this.tray) return;
    const tl = this.timerLabel();
    const menu = this.e.Menu.buildFromTemplate([
      { label: 'Ouvrir la plateforme', click: () => this.showWindow() },
      tl ? { label: tl.label, click: () => { this.showWindow(); this.send('open-task', tl.id); } }
         : { label: 'Aucun chrono en cours', enabled: false },
      { type: 'separator' },
      { label: 'Quitter', click: () => this.quit() }
    ]);
    this.tray.setContextMenu(menu);
    this.tray.setToolTip(PRODUCT + (tl ? ' · ' + tl.label : ''));
  }

  // Première fermeture vers la zone de notification : petite bulle explicative
  hiddenToTray() {
    if (this.trayHintShown || !this.tray) return;
    this.trayHintShown = true;
    this.balloon('Toujours là', 'La plateforme continue dans la zone de notification pour tes rappels. Clic droit sur l’icône pour quitter.');
  }

  balloon(title, content) {
    if (this.tray && this.platform === 'win32' && this.tray.displayBalloon) {
      try { this.tray.displayBalloon({ title, content, iconType: 'info' }); return true; } catch (e) { return false; }
    }
    return false;
  }

  /* --- Notifications --------------------------------------------------------- */
  notify(title, body, taskId) {
    const N = this.e.Notification;
    let shown = false;
    if (N && N.isSupported && N.isSupported()) {
      try {
        const n = new N({ title, body, icon: this.iconPath, silent: false });
        n.on('click', () => { this.showWindow(); if (taskId) this.send('open-task', taskId); });
        n.show();
        shown = true;
      } catch (e) { shown = false; }
    }
    if (!shown) shown = this.balloon(title, body);
    const win = this.getWindow();
    if (win && !win.isFocused()) { try { win.flashFrame(true); } catch (e) { /* rien */ } }
    return shown;
  }

  // Vérification des rappels (toutes les 15 min) : notification Windows (option)
  // et rappel dans l'app (le renderer affiche le toast et inscrit reminderLog).
  checkReminders(force) {
    const doc = this.getDoc();
    if (!doc) return [];
    const today = D.today();
    if (this.notifiedDay !== today) { this.notified = new Set(); this.notifiedDay = today; }
    const s = (doc.settings && doc.settings.reminders) || {};
    if (!force && D.now().getHours() < (s.hour || 9)) return [];
    const list = R.pending(doc, today, this.notified);
    if (!list.length) return [];
    list.forEach((t) => this.notified.add(t.id));
    const ids = list.map((t) => t.id);
    this.send('reminders:due', { ids, show: s.inApp !== false });
    if (this.options.windowsNotifications) {
      const n = R.notification(list, today);
      this.notify(n.title, n.body, list.length === 1 ? ids[0] : null);
    }
    return ids;
  }
}

module.exports = { SystemIntegration, AUMID, PRODUCT, CHECK_MS, DEFAULTS };
