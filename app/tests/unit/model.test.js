'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../../shared/model.js');

test('premier lancement : app vide, 3 catégories par défaut et objectifs', () => {
  const s = M.defaultState({ nowIso: '2026-10-09T07:00:00.000Z', appVersion: '0.1.0', host: 'PC-LAMIA' });
  assert.equal(s.schemaVersion, M.SCHEMA_VERSION);
  assert.deepEqual(s.categories.map((c) => [c.name, c.group]), [['Flow Line', 'flowline'], ['Carnet by-pass', 'auto-entreprise'], ['Auto-entreprise', 'auto-entreprise']]);
  assert.equal(s.tasks.length, 0);
  assert.equal(s.moods.length, 0);
  assert.deepEqual(s.settings.schedules.flowline, { days: [1, 2, 3, 4, 5], weeklyHours: 35 });
  assert.deepEqual(s.settings.schedules['auto-entreprise'], { days: [6], weeklyHours: null, minDailyHours: 4 });
  assert.deepEqual(s.settings.reminders, { hour: 9, inApp: true });
  assert.equal(s.activeTimer, null);
  assert.deepEqual(s.reminderLog, {});
  assert.equal(M.validate(s).ok, true);
});

// Export .json de la maquette (format v1), produit par le vrai code de la maquette
function maquetteExport() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '../../../maquette/js');
  for (const f of ['dates.js', 'data.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
  return JSON.parse(JSON.stringify(ctx.window.Lamia.seed()));
}

test('migration v1 (export de la maquette) → v2 : chrono, méta, objectif du samedi', () => {
  const v1 = maquetteExport();
  assert.equal(M.versionOf(v1), 1);
  const r = M.migrate(v1, { nowIso: '2026-10-09T07:00:00.000Z', appVersion: '0.1.0' });
  assert.equal(r.from, 1);
  assert.equal(r.to, 2);
  assert.equal(r.migrated, true);
  const d = r.doc;
  assert.equal(d.schemaVersion, 2);
  assert.equal('version' in d, false);
  assert.equal('timer' in d, false);
  assert.equal(d.activeTimer.taskId, 't03');
  assert.equal(d.activeTimer.startedAt, new Date(v1.timer.startedAt).toISOString());
  assert.equal(d.activeTimer.pausedAt, null);
  assert.equal(d.settings.schedules['auto-entreprise'].minDailyHours, 4);
  assert.equal(d.settings.reminders.inApp, true);
  assert.equal(d.tasks.length, v1.tasks.length);
  assert.equal(M.validate(d).ok, true);
});

test('migration : idempotente sur un document déjà au format courant', () => {
  const s = M.defaultState();
  const r = M.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(r.migrated, false);
  assert.deepEqual(r.doc.categories, s.categories);
});

test('migration : format plus récent refusé (TOO_NEW), format inconnu refusé', () => {
  assert.throws(() => M.migrate({ schemaVersion: 99, tasks: [] }), (e) => e.code === 'TOO_NEW' && e.version === 99);
  assert.throws(() => M.migrate({ foo: 1 }), (e) => e.code === 'UNKNOWN');
  assert.throws(() => M.migrate([]), (e) => e.code === 'UNKNOWN');
});

test('validation : repère les données abîmées', () => {
  const s = M.defaultState();
  s.tasks.push({ id: 'x', title: 'X', categoryId: 'flowline', status: 'pas-un-statut', timeEntries: [{ date: '08/10/2026', minutes: -3 }] });
  const v = M.validate(s);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /status/.test(e)));
  assert.ok(v.errors.some((e) => /date invalide/.test(e)));
  assert.ok(v.errors.some((e) => /minutes invalide/.test(e)));
  assert.equal(M.validate(null).ok, false);
});

test('normalisation : complète les champs facultatifs manquants', () => {
  const s = M.defaultState();
  delete s.flags; delete s.reminderLog; delete s.settings.ui;
  s.tasks.push({ id: 't', title: 'T', categoryId: 'flowline', status: 'todo', timeEntries: [] });
  const d = M.normalize(s);
  assert.deepEqual(d.flags, { lastOpenedOn: null, moodPromptedOn: null, remindersShownOn: null });
  assert.deepEqual(d.reminderLog, {});
  assert.equal(d.settings.ui.tasksView, 'kanban');
  assert.deepEqual(d.tasks[0].tags, []);
  assert.equal(d.tasks[0].reminder, null);
  assert.deepEqual(M.summarize(d), { tasks: 1, entries: 0, moods: 0, categories: 3 });
});

// QA-02 : imports .json incomplets (édition manuelle, ancienne version) : complétés, jamais plantés
test('QA-02 : fichiers incomplets complétés par des valeurs par défaut', () => {
  const variants = [
    { version: 1, tasks: [], categories: [{ id: 'a', name: 'A', color: 'blue', group: 'flowline' }], moods: [] },   // sans settings
    { version: 1, tasks: [], categories: [{ id: 'a', name: 'A', color: 'blue', group: 'flowline' }] },               // sans moods
    { version: 1, tasks: [], categories: [], moods: [] },                                                           // catégories vides
    { version: 1, categories: [{ id: 'a', name: 'A', color: 'blue', group: 'flowline' }], moods: [],
      tasks: [{ id: 't1', title: 'Sans listes', categoryId: 'inconnue', status: 'todo' }] }                         // tâche sans tags, checklist, heures
  ];
  for (const v of variants) {
    const r = M.migrate(JSON.parse(JSON.stringify(v)), { nowIso: '2026-10-09T07:00:00.000Z' });
    assert.equal(M.validate(r.doc).ok, true, JSON.stringify(M.validate(r.doc).errors));
    const d = r.doc;
    assert.ok(d.settings.ui.filters && d.settings.schedules.flowline && d.settings.schedules['auto-entreprise']);
    assert.ok(d.categories.length >= 1);
    assert.ok(Array.isArray(d.moods));
    d.tasks.forEach((t) => {
      assert.ok(Array.isArray(t.tags) && Array.isArray(t.checklist) && Array.isArray(t.timeEntries));
      assert.ok(d.categories.some((c) => c.id === t.categoryId), 'catégorie connue');
    });
  }
});

test('QA-02 : statut invalide → refusé (rien n’est remplacé)', () => {
  const r = M.migrate({ version: 1, categories: [], moods: [], tasks: [{ id: 'x', title: 'X', status: 'n’importe quoi' }] });
  assert.equal(M.validate(r.doc).ok, false);
});
