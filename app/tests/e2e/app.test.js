'use strict';
// Parcours end-to-end sur l'app packagée (Linux), dans l'ordre :
// premier lancement vide → tâche → humeur → chrono qui persiste après relance
// → Donnees-Lamia → verrou d'un autre PC → exports CSV et PDF → démo et
// restauration → aucune requête réseau, aucune erreur console.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers.js');

const base = H.tmpDir('lamia-e2e-base-');
const userData = H.tmpDir('lamia-e2e-ud-');
const out = H.tmpDir('lamia-e2e-out-');
const DAY = '2026-10-08';                        // un jeudi
let session = null;

async function open(fakeNow) {
  session = await H.launch({ base, userData, fakeNow });
  return session;
}
async function close() {
  if (session) await session.app.close();
  session = null;
}

test.after(async () => { await close(); });

test('premier lancement : app vide, Donnees-Lamia à côté de l’exe, humeur proposée', async () => {
  const { page } = await open(DAY + 'T09:00:00');
  await page.locator('#overlay-mood').waitFor();
  assert.match(await page.locator('#mood-title').textContent(), /Comment te sens-tu aujourd’hui/);
  await H.dismissMood(page);
  await page.locator('.empty-state--welcome').waitFor();
  assert.match(await page.locator('.empty-state--welcome').textContent(), /Ton carnet est tout neuf/);
  assert.match(await page.locator('.eyebrow').first().textContent(), /Jeudi 8\s+octobre 2026/);
  assert.match(await page.locator('.hours-row--pole').textContent(), /Samedi perso.*0\sh.*4\sh minimum/s);

  const dir = H.dataDir(base);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['LISEZ-MOI.txt', 'data.json', 'exports', 'sauvegardes', 'verrou.json']);
  assert.ok(fs.existsSync(path.join(dir, 'sauvegardes', `data-${DAY}.json`)));
  const lock = JSON.parse(fs.readFileSync(path.join(dir, 'verrou.json'), 'utf8'));
  assert.equal(typeof lock.host, 'string');
  const d = await H.waitForData(base, (x) => x.flags.lastOpenedOn === DAY);
  assert.deepEqual(d.categories.map((c) => c.name), ['Flow Line', 'Carnet by-pass', 'Auto-entreprise']);
  assert.equal(d.tasks.length, 0);
  assert.equal(d.settings.schedules['auto-entreprise'].minDailyHours, 4);

  await page.evaluate(() => { location.hash = 'reglages'; });
  await page.locator('[data-data-dir]').waitFor();
  assert.equal((await page.locator('[data-data-dir]').textContent()).replace(/\/$/, ''), dir);
});

test('création d’une tâche (Entrée valide), enregistrée dans data.json', async () => {
  const { page } = session;
  await page.evaluate(() => { location.hash = 'dashboard'; });
  await page.locator('.empty-state--welcome [data-action="new-task"]').click();
  await page.locator('#new-t').fill('Affiche du marché de Noël');
  await page.locator('#new-t').press('Enter');
  await page.locator('.toast', { hasText: 'Tâche créée' }).waitFor();
  const d = await H.waitForData(base, (x) => x.tasks.length === 1);
  assert.equal(d.tasks[0].title, 'Affiche du marché de Noël');
  assert.equal(d.tasks[0].categoryId, 'flowline');      // un jeudi : Flow Line proposée
  assert.equal(d.tasks[0].status, 'todo');
});

test('humeur du jour en un clic', async () => {
  const { page } = session;
  await page.locator('[data-mood="4"][data-mood-scope="dash"]').click();
  const d = await H.waitForData(base, (x) => x.moods.length === 1);
  assert.deepEqual(d.moods[0], { date: DAY, level: 4, note: '' });
  await page.locator('[data-mood-edit]').waitFor();
});

test('chrono : démarre, survit à la fermeture, s’arrête et enregistre le temps', async () => {
  let { page } = session;
  await page.evaluate(() => { location.hash = 'taches'; });
  await page.locator('.task-card').first().click();
  await page.locator('.task-drawer [data-chrono="start"]').click();
  await page.locator('.sidebar .chrono__eyebrow', { hasText: 'Chrono en cours' }).waitFor();
  const d1 = await H.waitForData(base, (x) => !!x.activeTimer);
  assert.equal(d1.activeTimer.taskId, d1.tasks[0].id);
  assert.equal(d1.tasks[0].status, 'doing');              // le chrono passe la tâche « En cours »

  await close();
  assert.equal(fs.existsSync(path.join(H.dataDir(base), 'verrou.json')), false, 'verrou libéré à la fermeture');

  ({ page } = await open(DAY + 'T10:30:00'));             // 1 h 30 plus tard
  await page.locator('.sidebar .chrono__eyebrow', { hasText: 'Chrono en cours' }).waitFor();
  assert.match(await page.locator('.sidebar .chrono__task').textContent(), /Affiche du marché de Noël/);
  assert.match(await page.locator('.sidebar [data-timer-elapsed]').textContent(), /^01:(29|30):\d\d$/);
  await page.locator('.sidebar [data-chrono="stop"]').click();
  await page.locator('.toast', { hasText: 'Temps enregistré' }).waitFor();
  const d2 = await H.waitForData(base, (x) => !x.activeTimer && x.tasks[0].timeEntries.length === 1);
  const e = d2.tasks[0].timeEntries[0];
  assert.equal(e.source, 'timer');
  assert.equal(e.date, DAY);
  assert.ok(e.minutes >= 89 && e.minutes <= 91, 'durée ≈ 1 h 30 : ' + e.minutes);
});

test('export CSV des heures : BOM, « ; », virgule décimale, colonnes attendues', async () => {
  const { app, page } = session;
  const file = path.join(out, 'heures.csv');
  await H.stubSaveDialog(app, file);
  await page.evaluate(() => { location.hash = 'recap'; });
  await page.locator('[data-export="csv"]').click();
  await page.locator('.toast', { hasText: 'Export CSV enregistré' }).waitFor();
  await H.waitForFile(file);
  const csv = fs.readFileSync(file, 'utf8');
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '﻿Date;Catégorie;Pôle;Client / projet;Tâche;Durée (h);Durée (hh:mm);Source;Note');
  assert.match(lines[1], /^08\/10\/2026;Flow Line;Flow Line;;Affiche du marché de Noël;1,(48|50|52);1:(29|30|31);Chrono;$/);
  assert.match(lines[2], /^;Flow Line;Flow Line;;Sous-total Flow Line;1,\d\d;1:\d\d;;$/);
});

test('export PDF du récap (A4)', async () => {
  const { app, page } = session;
  const file = path.join(out, 'recap.pdf');
  await H.stubSaveDialog(app, file);
  await page.locator('[data-export="pdf"]').click();
  await page.locator('.toast', { hasText: 'Export PDF enregistré' }).waitFor({ timeout: 20000 });
  await H.waitForFile(file);
  const head = fs.readFileSync(file).subarray(0, 5).toString('latin1');
  assert.equal(head, '%PDF-');
  // le thème a été rétabli après l'export
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-exporting')), false);
});

test('aucune requête réseau : tout est bloqué hors app://', async () => {
  const { page } = session;
  const blocked = await page.evaluate(async () => {
    try { await fetch('https://example.com/'); return false; } catch (e) { return true; }
  });
  assert.equal(blocked, true);
  const img = await page.evaluate(() => new Promise((resolve) => {
    const i = new Image(); i.onload = () => resolve('chargée'); i.onerror = () => resolve('bloquée'); i.src = 'https://example.com/a.png';
  }));
  assert.equal(img, 'bloquée');
  await close();
});

test('verrou tenu par un autre PC : lecture seule explicite, rien n’est écrit', async () => {
  const dir = H.dataDir(base);
  const now = new Date(DAY + 'T11:00:00').toISOString();
  fs.writeFileSync(path.join(dir, 'verrou.json'), JSON.stringify({ host: 'AUTRE-PC', user: 'lamia', pid: 42, openedAt: now, heartbeatAt: now }));
  const before = fs.readFileSync(path.join(dir, 'data.json'), 'utf8');
  const { page } = await open(DAY + 'T11:01:00');
  const banner = page.locator('[data-banner="lock"]');
  await banner.waitFor();
  assert.match(await banner.textContent(), /Lecture seule.*AUTRE-PC/s);
  await page.locator('.sidebar [data-action="new-task"]').click();
  await page.locator('#new-t').fill('Ne doit pas être enregistrée');
  await page.locator('#new-t').press('Enter');
  await page.locator('.toast', { hasText: 'Lecture seule' }).waitFor();
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'), before);
  await close();
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'verrou.json'), 'utf8')).host, 'AUTRE-PC', 'le verrou de l’autre PC est respecté');
  fs.unlinkSync(path.join(dir, 'verrou.json'));
});

test('Réglages : données de démo (avec sauvegarde avant), puis restauration', async () => {
  const { page } = await open(DAY + 'T12:00:00');
  await page.evaluate(() => { location.hash = 'reglages'; });
  await page.locator('[data-demo="load"]').click();
  await page.locator('#overlay-dialog [type="submit"]').click();
  const demo = await H.waitForData(base, (x) => x.tasks.length === 24);
  assert.equal(demo.meta.demo, true);
  const backups = fs.readdirSync(path.join(H.dataDir(base), 'sauvegardes'));
  assert.ok(backups.some((f) => /^avant-demo-/.test(f)), backups.join(', '));
  await page.locator('.toast', { hasText: 'Données de démo chargées' }).waitFor();
  assert.match(await page.locator('.hours-row--pole').textContent(), /Samedi perso/);

  await page.evaluate(() => { location.hash = 'reglages'; });
  await page.locator('[data-data="restore"]').click();
  await page.locator('.backup-item', { hasText: 'Avant le chargement de la démo' }).first().click();
  await page.locator('#overlay-dialog [type="submit"]').click();
  const restored = await H.waitForData(base, (x) => x.tasks.length === 1);
  assert.equal(restored.tasks[0].title, 'Affiche du marché de Noël');
  await close();
});

test('aucune erreur dans la console, aucune requête hors de l’application', () => {
  assert.deepEqual(H.watch.pageErrors, []);
  assert.deepEqual(H.watch.consoleErrors.filter((t) => !/example\.com/.test(t)), []);
  const external = H.watch.requests.filter((u) => !/^(app|data|blob):/.test(u));
  assert.deepEqual(external.filter((u) => !/example\.com/.test(u)), []);
});
