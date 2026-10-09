'use strict';
/* ==========================================================================
   Choix du dossier de données (logique pure, sans Electron : testée).

   Dossier de base, par ordre de priorité :
   1. LAMIA_BASE_DIR           tests (simule le dossier de l'exe) ;
   2. PORTABLE_EXECUTABLE_DIR  exe portable : dossier de l'exe d'ORIGINE
                               (l'app tourne, elle, dans %TEMP%) ;
   3. app packagée (ZIP)       dossier de l'exe ;
   4. développement            app/.dev-data.
   Données : <base>/Donnees-Lamia. Si ce dossier n'est pas inscriptible
   (vraie écriture d'essai), repli dans %APPDATA%/Plateforme de suivi - Lamia/
   Donnees-Lamia, et le chemin réel est affiché dans les Réglages.
   ========================================================================== */
const fs = require('node:fs');
const nodePath = require('node:path');

const DATA_FOLDER = 'Donnees-Lamia';
const APP_FOLDER = 'Plateforme de suivi - Lamia';

function pathFor(platform) { return platform === 'win32' ? nodePath.win32 : nodePath.posix; }

// Exe lancé depuis un ZIP ouvert dans l'Explorateur (non extrait)
function looksInsideZip(dir) {
  return /[\\/]Temp\d*_[^\\/]*\.zip[\\/]/i.test(dir) || /\.zip[\\/]/i.test(dir + '/');
}

function baseDirOf(o) {
  const p = pathFor(o.platform);
  const env = o.env || {};
  if (env.LAMIA_BASE_DIR) return { baseDir: env.LAMIA_BASE_DIR, mode: 'test' };
  if (env.PORTABLE_EXECUTABLE_DIR) return { baseDir: env.PORTABLE_EXECUTABLE_DIR, mode: 'portable' };
  if (o.isPackaged && o.platform === 'darwin') {
    // Mac : à côté du paquet .app (jamais dedans : il serait en lecture seule ou invalidé)
    const bundle = /^(.*?\.app)\//.exec(o.execPath);
    if (bundle) return { baseDir: p.dirname(bundle[1]), mode: 'mac' };
  }
  if (o.isPackaged) return { baseDir: p.dirname(o.execPath), mode: 'zip' };
  return { baseDir: p.join(o.appPath, '.dev-data'), mode: 'dev' };
}

/**
 * @param {object} o
 * @param {object} o.env           variables d'environnement
 * @param {string} o.platform      process.platform
 * @param {boolean} o.isPackaged
 * @param {string} o.execPath      process.execPath
 * @param {string} o.appPath       app.getAppPath()
 * @param {string} o.appDataPath   app.getPath('appData') (%APPDATA%)
 * @param {(dir:string)=>true|string} o.probe  true si inscriptible, sinon un message d'erreur
 */
function resolveDataDir(o) {
  const p = pathFor(o.platform);
  const { baseDir, mode } = baseDirOf(o);
  const primary = p.join(baseDir, DATA_FOLDER);
  const res = o.probe(primary, baseDir);
  if (res === true) return { dataDir: primary, baseDir, mode, fallback: false, reason: null, insideZip: false };
  const insideZip = looksInsideZip(baseDir);
  const fallbackDir = p.join(o.appDataPath, APP_FOLDER, DATA_FOLDER);
  return {
    dataDir: fallbackDir,
    baseDir,
    mode,
    fallback: true,
    insideZip,
    wanted: primary,
    reason: insideZip
      ? 'L’application semble lancée depuis un fichier ZIP non extrait.'
      : 'Le dossier à côté de l’application n’est pas accessible en écriture (' + (res || 'erreur inconnue') + ').'
  };
}

// Vraie écriture d'essai (fs.access est peu fiable avec les ACL Windows).
// Crée le dossier SANS `recursive` pour le dossier de données (cf. note du spike).
function probeWritable(dir, baseDir) {
  try {
    if (!fs.existsSync(dir)) {
      if (baseDir && !fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
      fs.mkdirSync(dir);
    }
    const f = nodePath.join(dir, `.ecriture-test-${process.pid}.tmp`);
    const fd = fs.openSync(f, 'w');
    try { fs.writeSync(fd, 'ok'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.unlinkSync(f);
    return true;
  } catch (e) {
    return e && e.code ? e.code : String(e && e.message || e);
  }
}

// Le repli (%APPDATA%) peut nécessiter la création des dossiers parents.
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = { DATA_FOLDER, APP_FOLDER, resolveDataDir, probeWritable, ensureDir, looksInsideZip, baseDirOf };
