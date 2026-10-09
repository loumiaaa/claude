'use strict';
// Outils des tests end-to-end : lancement de l'app packagée (Linux) avec un
// dossier « exe portable » simulé, horloge simulée, et surveillance des
// erreurs console et des requêtes réseau.
const { _electron } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EXE = process.env.LAMIA_E2E_EXE || path.join(__dirname, '../../dist/linux-unpacked/plateforme-suivi-lamia');

// Collecte partagée par tous les lancements d'un fichier de test
const watch = { consoleErrors: [], pageErrors: [], requests: [] };

function tmpDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

async function launch({ base, userData, fakeNow, env }) {
  const app = await _electron.launch({
    executablePath: EXE,
    args: ['--no-sandbox'],
    env: Object.assign({}, process.env, {
      LAMIA_E2E: '1',
      PORTABLE_EXECUTABLE_DIR: base,          // comme l'exe portable : données à côté de « l'exe »
      PORTABLE_EXECUTABLE_FILE: path.join(base, 'Plateforme-de-suivi-Lamia-portable.exe'),
      LAMIA_USER_DATA: userData,
      LAMIA_FAKE_NOW: fakeNow || ''
    }, env || {})
  });
  const page = await app.firstWindow();
  page.on('console', (m) => { if (m.type() === 'error') watch.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => watch.pageErrors.push(e.message));
  page.on('request', (r) => watch.requests.push(r.url()));
  await page.waitForSelector('#h-dashboard', { timeout: 20000 });
  return { app, page };
}

function dataDir(base) { return path.join(base, 'Donnees-Lamia'); }
function readData(base) { return JSON.parse(fs.readFileSync(path.join(dataDir(base), 'data.json'), 'utf8')); }

// Attend que data.json vérifie une condition (les enregistrements sont différés de 250 ms)
async function waitForData(base, predicate, timeout = 6000) {
  const end = Date.now() + timeout;
  let last = null;
  while (Date.now() < end) {
    try { last = readData(base); if (predicate(last)) return last; } catch (e) { /* écriture en cours */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('data.json n’a pas atteint l’état attendu. Dernier état : ' + JSON.stringify(last && { tasks: last.tasks.length, moods: last.moods, activeTimer: last.activeTimer }).slice(0, 400));
}

async function waitForFile(file, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Fichier absent : ' + file);
}

// Remplace la boîte « Enregistrer sous » du main par un chemin fixe
async function stubSaveDialog(app, file) {
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, file);
}

async function dismissMood(page) {
  const later = page.locator('#overlay-mood [data-mood-close]:not(.btn--icon)');
  await later.waitFor({ timeout: 5000 });
  await later.click();
  await page.locator('#overlay-mood').waitFor({ state: 'hidden' });
}

module.exports = { EXE, watch, tmpDir, launch, dataDir, readData, waitForData, waitForFile, stubSaveDialog, dismissMood };
