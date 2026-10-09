'use strict';
// Fonctions système : smoke test, rappels d'échéance à l'ouverture, alerte
// du chrono oublié (> 10 h), fermeture dans la zone de notification.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const H = require('./helpers.js');
const M = require('../../shared/model.js');

const DAY = '2026-10-08';

function fixture(base, mutate) {
  const dir = H.dataDir(base);
  fs.mkdirSync(dir, { recursive: true });
  const doc = M.defaultState({ nowIso: new Date(DAY + 'T08:00:00').toISOString(), appVersion: '0.1.0' });
  doc.flags.lastOpenedOn = DAY;
  doc.moods.push({ date: DAY, level: 3, note: '' });              // pas de question d'humeur
  mutate(doc);
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(doc, null, 2));
}

function task(id, extra) {
  return Object.assign({ id, title: 'Tâche ' + id, description: '', categoryId: 'flowline', client: '', status: 'doing', progress: 10, priority: 'normal',
    tags: [], startDate: '2026-10-01', endDate: null, checklist: [], timeEntries: [], reminder: null,
    createdAt: '2026-10-01', updatedAt: '2026-10-01', completedAt: null, order: 0 }, extra);
}

test('smoke test : démarre sans fenêtre, écrit et relit Donnees-Lamia, quitte avec le code 0', () => {
  const base = H.tmpDir('lamia-smoke-');
  const r = spawnSync(H.EXE, ['--smoke-test', '--no-sandbox'], {
    env: Object.assign({}, process.env, { PORTABLE_EXECUTABLE_DIR: base, LAMIA_USER_DATA: H.tmpDir('lamia-smoke-ud-') }),
    encoding: 'utf8', timeout: 60000
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const res = JSON.parse(fs.readFileSync(path.join(H.dataDir(base), 'smoke-test-result.json'), 'utf8'));
  assert.equal(res.ok, true);
  assert.ok(res.checks.length >= 7);
  assert.ok(res.timings.processToUiReadyMs > 0);
  assert.equal(fs.existsSync(path.join(H.dataDir(base), 'verrou.json')), false);
  assert.equal(fs.existsSync(path.join(H.dataDir(base), 'data.json')), true);
});

test('smoke test : code 1 si les données ne peuvent pas être à côté de l’exe', () => {
  const tmp = H.tmpDir('lamia-smoke-ko-');
  const notADir = path.join(tmp, 'fichier');
  fs.writeFileSync(notADir, 'x');                                    // le « dossier de l'exe » est un fichier
  const ud = H.tmpDir('lamia-smoke-ud-');
  const r = spawnSync(H.EXE, ['--smoke-test', '--no-sandbox'], {
    env: Object.assign({}, process.env, { PORTABLE_EXECUTABLE_DIR: notADir, LAMIA_USER_DATA: ud, APPDATA: ud, XDG_CONFIG_HOME: ud }),
    encoding: 'utf8', timeout: 60000
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /"dossier de données à côté de l’exe",\s*"ok": false/);
});

test('rappels d’échéance : affichés à l’ouverture, une seule fois par jour', async () => {
  const base = H.tmpDir('lamia-rem-');
  const userData = H.tmpDir('lamia-rem-ud-');
  fixture(base, (d) => {
    d.tasks.push(task('r1', { title: 'BAT imprimeur', endDate: '2026-10-09', reminder: { daysBefore: 1 } }));
  });
  let { app, page } = await H.launch({ base, userData, fakeNow: DAY + 'T10:00:00' });
  await page.locator('.toast', { hasText: 'Rappel : « BAT imprimeur »' }).waitFor();
  assert.match(await page.locator('.toast', { hasText: 'BAT imprimeur' }).textContent(), /demain/);
  const d = await H.waitForData(base, (x) => x.reminderLog && x.reminderLog.r1 === DAY);
  assert.equal(d.reminderLog.r1, DAY);
  await app.close();
  ({ app, page } = await H.launch({ base, userData, fakeNow: DAY + 'T10:20:00' }));
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(await page.locator('.toast', { hasText: 'BAT imprimeur' }).count(), 0, 'pas deux fois le même jour');
  await app.close();
});

test('chrono oublié : alerte douce après 10 h et correction de la durée', async () => {
  const base = H.tmpDir('lamia-long-');
  fixture(base, (d) => {
    d.tasks.push(task('c1', { title: 'Maquettes UI appli' }));
    d.activeTimer = { taskId: 'c1', startedAt: new Date('2026-10-07T17:30:00').toISOString(), accumulatedMs: 0, pausedAt: null, host: 'PC' };
  });
  const { app, page } = await H.launch({ base, userData: H.tmpDir('lamia-long-ud-'), fakeNow: DAY + 'T09:00:00' });
  const toast = page.locator('.toast', { hasText: 'Tu as oublié d’arrêter le chrono ?' });
  await toast.waitFor();
  assert.match(await toast.textContent(), /15\sh\s30/);
  await toast.locator('[data-toast-action="0"]').click();          // « Corriger la durée »
  await page.locator('#dlg-duration').fill('2h15');
  assert.equal(await page.locator('#dlg-day').inputValue(), '2026-10-07');
  await page.locator('#overlay-dialog [type="submit"]').click();
  const d = await H.waitForData(base, (x) => !x.activeTimer);
  assert.deepEqual(d.tasks[0].timeEntries.map((e) => [e.date, e.minutes, e.source]), [['2026-10-07', 135, 'timer']]);
  await app.close();
});

test('zone de notification : la croix cache la fenêtre, l’app reste ouverte', async () => {
  const base = H.tmpDir('lamia-tray-');
  fixture(base, () => {});
  const { app, page } = await H.launch({ base, userData: H.tmpDir('lamia-tray-ud-'), fakeNow: DAY + 'T10:00:00' });
  await page.evaluate(() => { location.hash = 'reglages'; });
  await page.locator('[data-opt-tray]').check();
  await page.locator('[data-opt-tray]:checked').waitFor();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await new Promise((r) => setTimeout(r, 500));
  const state = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.isVisible()));
  assert.deepEqual(state, [false]);
  assert.equal(fs.existsSync(path.join(H.dataDir(base), 'verrou.json')), true, 'toujours ouverte');
  await app.close();
  assert.equal(fs.existsSync(path.join(H.dataDir(base), 'verrou.json')), false);
});

test('aucune erreur dans la console', () => {
  assert.deepEqual(H.watch.pageErrors, []);
  assert.deepEqual(H.watch.consoleErrors, []);
  assert.deepEqual(H.watch.requests.filter((u) => !/^(app|data|blob):/.test(u)), []);
});
