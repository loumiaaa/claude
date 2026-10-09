'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveDataDir, probeWritable, looksInsideZip } = require('../../main/datadir.js');

const ok = () => true;
const win = (o) => Object.assign({ platform: 'win32', isPackaged: true, execPath: 'C:\\Temp\\7zS1234\\Plateforme de suivi - Lamia.exe', appPath: 'C:\\app', appDataPath: 'C:\\Users\\Lamia\\AppData\\Roaming', env: {}, probe: ok }, o);

test('exe portable : Donnees-Lamia à côté de l’exe d’origine, jamais dans %TEMP%', () => {
  const r = resolveDataDir(win({ env: { PORTABLE_EXECUTABLE_DIR: 'E:\\Plateforme' } }));
  assert.equal(r.dataDir, 'E:\\Plateforme\\Donnees-Lamia');
  assert.equal(r.mode, 'portable');
  assert.equal(r.fallback, false);
});

test('version ZIP : dossier de l’exe', () => {
  const r = resolveDataDir(win({ execPath: 'D:\\Outils\\Plateforme\\Plateforme de suivi - Lamia.exe' }));
  assert.equal(r.dataDir, 'D:\\Outils\\Plateforme\\Donnees-Lamia');
  assert.equal(r.mode, 'zip');
});

test('tests et développement', () => {
  assert.equal(resolveDataDir(win({ env: { LAMIA_BASE_DIR: 'C:\\tmp\\base', PORTABLE_EXECUTABLE_DIR: 'E:\\x' } })).dataDir, 'C:\\tmp\\base\\Donnees-Lamia');
  const dev = resolveDataDir({ platform: 'linux', isPackaged: false, execPath: '/usr/bin/electron', appPath: '/home/l/app', appDataPath: '/home/l/.config', env: {}, probe: ok });
  assert.equal(dev.dataDir, '/home/l/app/.dev-data/Donnees-Lamia');
  assert.equal(dev.mode, 'dev');
});

test('repli dans %APPDATA% si le dossier n’est pas inscriptible, avec la raison', () => {
  const r = resolveDataDir(win({ env: { PORTABLE_EXECUTABLE_DIR: 'F:\\' }, probe: () => 'EROFS' }));
  assert.equal(r.fallback, true);
  assert.equal(r.dataDir, 'C:\\Users\\Lamia\\AppData\\Roaming\\Plateforme de suivi - Lamia\\Donnees-Lamia');
  assert.equal(r.wanted, 'F:\\Donnees-Lamia');
  assert.match(r.reason, /EROFS/);
});

test('exe lancé depuis un ZIP non extrait : message dédié', () => {
  const dir = 'C:\\Users\\Lamia\\AppData\\Local\\Temp\\Temp1_Plateforme-win-x64.zip\\Plateforme';
  assert.equal(looksInsideZip(dir), true);
  assert.equal(looksInsideZip('E:\\Plateforme'), false);
  const r = resolveDataDir(win({ execPath: dir + '\\app.exe', probe: () => 'EACCES' }));
  assert.equal(r.insideZip, true);
  assert.match(r.reason, /ZIP/);
});

test('sonde d’écriture : vraie écriture, sans laisser de fichier', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lamia-probe-'));
  const dir = path.join(base, 'Donnees-Lamia');
  assert.equal(probeWritable(dir, base), true);
  assert.deepEqual(fs.readdirSync(dir), []);
  // Parent qui n'est pas un dossier : échec propre (pas d'exception)
  const file = path.join(base, 'fichier');
  fs.writeFileSync(file, 'x');
  assert.notEqual(probeWritable(path.join(file, 'Donnees-Lamia'), file), true);
  fs.rmSync(base, { recursive: true, force: true });
});
