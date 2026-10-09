'use strict';
// Non-régression des défauts relevés par la recette de la maquette (docs/05-rapport-tests-maquette.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers.js');

const DAY = '2026-10-08';
const base = H.tmpDir('lamia-qa-');
const userData = H.tmpDir('lamia-qa-ud-');
let s = null;

async function loadDemo(page) {
  await page.evaluate(() => { location.hash = 'reglages'; });
  await page.locator('[data-demo="load"]').click();
  await page.locator('#overlay-dialog [type="submit"]').click();
  await H.waitForData(base, (x) => x.tasks.length === 24);
  await page.locator('.toast').first().waitFor();
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
}

async function setWidth(app, page, w) {
  await app.evaluate(({ BrowserWindow }, width) => { BrowserWindow.getAllWindows()[0].setContentSize(width, 900); }, w);
  await page.waitForFunction((width) => window.innerWidth === width, w);
  await page.waitForTimeout(250);                  // graphiques redessinés après redimensionnement
}

async function activeKey(page) {
  return page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('data-focus-key') || a.id || a.tagName) : null; });
}

test.before(async () => {
  s = await H.launch({ base, userData, fakeNow: DAY + 'T10:00:00' });
  await H.dismissMood(s.page);
  await loadDemo(s.page);
});
test.after(async () => { if (s) await s.app.close(); });

test('QA-01 / QA-09 : aucun défilement horizontal de la page, de 1440 à 390 px (Récap, Liste, Planning)', async () => {
  const { app, page } = s;
  // Un titre-fichier de 60 caractères sans espace (QA-09)
  await page.evaluate(() => { location.hash = 'taches'; });
  await page.locator('.page-head [data-action="new-task"]').click();
  await page.locator('#new-t').fill('Maquette_finale_v3_HD_impression_et_diffusion_numerique_OK_');
  await page.locator('#new-client').fill('Maquette_finale_v3_HD_impression_et_diffusion_');
  await page.locator('#new-end').fill('2026-10-09');
  await page.locator('#new-t').press('Enter');
  await H.waitForData(base, (x) => x.tasks.length === 25);
  const views = [['recap', null], ['taches', 'list'], ['taches', 'kanban'], ['planning', null]];
  const bad = [];
  for (const w of [1440, 1366, 1300, 1280, 1024, 390]) {
    await setWidth(app, page, w);
    for (const [hash, mode] of views) {
      await page.evaluate((h) => { location.hash = h; }, hash);
      if (mode) await page.locator(`[data-mode="${mode}"]`).click();
      await page.waitForTimeout(150);
      const over = await page.evaluate(() => {
        const doc = document.documentElement.scrollWidth - window.innerWidth;
        const charts = [...document.querySelectorAll('.view:not([hidden]) svg.chart')].filter((svg) => {
          const card = svg.closest('.card'); if (!card) return false;
          return svg.getBoundingClientRect().right > card.getBoundingClientRect().right + 1;
        }).length;
        return { doc, charts };
      });
      if (over.doc > 0 || over.charts > 0) bad.push(`${w}px ${hash}${mode ? '/' + mode : ''} : page +${over.doc} px, ${over.charts} graphique(s) hors carte`);
    }
  }
  await setWidth(app, page, 1440);
  assert.deepEqual(bad, []);
});

test('QA-06 : Récap d’un samedi, Flow Line sans « sur 0 h » ni « objectif atteint »', async () => {
  const { page } = s;
  await page.evaluate(() => { location.hash = 'recap'; });
  await page.locator('[data-rp="day"]').click();
  await page.locator('[data-rnav="1"]').click();
  await page.locator('[data-rnav="1"]').click();            // samedi 10 octobre
  await page.locator('.period-bar__label', { hasText: 'Samedi 10' }).waitFor();
  const fl = await page.locator('.hcard', { hasText: 'Flow Line' }).first().textContent();
  assert.doesNotMatch(fl, /sur\s0\sh|pile poil|Objectif atteint/);
  assert.match(fl, /Pas d’objectif ce jour-là/);
  assert.match(await page.locator('.hcard--pole').textContent(), /Samedi perso/);
  await page.locator('[data-rp="week"]').click();
});

test('QA-03 : le focus clavier reste en place après ▶, Pause, Stop, « Demain », une suppression et « Modifier » l’humeur', async () => {
  const { page } = s;
  await page.evaluate(() => { location.hash = 'dashboard'; });
  await page.locator('.task-row__play').first().waitFor();
  // (a) ▶ au clavier sur une tâche en cours qui n'a pas le chrono
  const play = page.locator('.task-row__play[data-chrono="start"]').first();
  const key = await play.getAttribute('data-focus-key');
  await play.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  assert.equal(await activeKey(page), key);
  // (b) Pause dans le widget, puis Reprendre
  await page.locator('.sidebar [data-chrono="pause"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  assert.equal(await activeKey(page), 'w-toggle');
  assert.equal(await page.locator('.sidebar [data-chrono="resume"]').count(), 1);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(450);
  // Stop : le focus passe à « Reprendre « … » » au même endroit
  await page.locator('.sidebar [data-chrono="stop"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  assert.equal(await activeKey(page), 'w-stop');
  // (c) « Demain » sur une tâche à replanifier : focus sur la suivante
  const tomorrow = page.locator('[data-replan="tomorrow"]').first();
  await tomorrow.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const k = await activeKey(page);
  assert.ok(/^replan-tomorrow-|^dh-due$/.test(k), 'focus après « Demain » : ' + k);
  // (f) « Modifier » l'humeur (la note du jour existe) : retour sur « Modifier »
  await page.locator('[data-mood="3"][data-mood-scope="dash"]').click();
  await page.locator('[data-mood-edit]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#overlay-mood [data-mood="5"]').click();
  await page.locator('#overlay-mood [data-mood-done]').click();
  await page.waitForTimeout(150);
  assert.equal(await activeKey(page), 'mood-edit');
  // (e) Suppression depuis le tiroir ouvert au clavier sur une carte du Kanban : focus sur une carte voisine
  await page.evaluate(() => { location.hash = 'taches'; });
  await page.locator('[data-mode="kanban"]').click();
  const card = page.locator('.task-card').nth(1);
  await card.focus();
  await page.keyboard.press('Enter');
  await page.locator('.task-drawer [data-dr-delete]').click();
  await page.waitForTimeout(200);
  const after = await activeKey(page);
  assert.match(after, /^card-/, 'focus après suppression : ' + after);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
});

test('QA-07 : un double-clic sur Stop arrête le chrono sans le relancer', async () => {
  const { page } = s;
  await page.evaluate(() => { location.hash = 'dashboard'; });
  await page.locator('.task-row__play[data-chrono="start"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('.sidebar [data-chrono="stop"]').dblclick();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.sidebar .chrono__idle').count(), 1);
  await page.waitForTimeout(400);
  const d = H.readData(base);
  assert.equal(d.activeTimer, null);
});

test('QA-02 : un import .json incomplet est complété (copie de sécurité avant), et l’app redémarre', async () => {
  const { app, page } = s;
  const file = path.join(H.tmpDir('lamia-qa-imp-'), 'ancien.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, tasks: [{ id: 'x1', title: 'Importée', categoryId: 'a', status: 'todo' }], categories: [{ id: 'a', name: 'A', color: 'blue', group: 'flowline' }] }));
  await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, file);
  await page.evaluate(() => { location.hash = 'reglages'; });
  await page.locator('[data-data="import"]').click();
  await page.locator('#overlay-dialog [type="submit"]').click();
  const d = await H.waitForData(base, (x) => x.tasks.length === 1 && x.tasks[0].title === 'Importée');
  assert.deepEqual(d.tasks[0].tags, []);
  assert.ok(d.settings.ui && d.settings.schedules.flowline);
  assert.ok(fs.readdirSync(path.join(H.dataDir(base), 'sauvegardes')).some((f) => /^avant-import-/.test(f)));
  await page.evaluate(() => { location.hash = 'taches'; });
  await page.locator('.task-card', { hasText: 'Importée' }).waitFor();
  await s.app.close();
  s = await H.launch({ base, userData, fakeNow: DAY + 'T11:00:00' });
  await s.page.evaluate(() => { location.hash = 'taches'; });
  await s.page.locator('.task-card', { hasText: 'Importée' }).waitFor();
});

test('aucune erreur dans la console pendant la recette', () => {
  assert.deepEqual(H.watch.pageErrors, []);
  assert.deepEqual(H.watch.consoleErrors, []);
});
