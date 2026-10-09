'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DataStore, writeAtomic, DAILY_KEEP } = require('../../main/storage.js');
const M = require('../../shared/model.js');

let clock = new Date(2026, 9, 8, 9, 0, 0).getTime();
const nowMs = () => clock;

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'lamia-store-')); }
function store(dir) { return new DataStore({ dir: path.join(dir, 'Donnees-Lamia'), host: 'PC-LAMIA', appVersion: '0.1.0', nowMs }); }
function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

test('premier lancement : crée Donnees-Lamia, data.json vide, LISEZ-MOI, sauvegardes/ et exports/', () => {
  const base = tmp();
  const s = store(base);
  const r = s.load();
  assert.equal(r.status, 'created');
  const dir = path.join(base, 'Donnees-Lamia');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['LISEZ-MOI.txt', 'data.json', 'exports', 'sauvegardes']);
  const d = readJson(path.join(dir, 'data.json'));
  assert.equal(d.schemaVersion, M.SCHEMA_VERSION);
  assert.equal(d.tasks.length, 0);
  assert.equal(d.meta.savedBy, 'PC-LAMIA');
});

test('enregistrement : révision incrémentée, relu à l’identique', () => {
  const s = store(tmp());
  s.load();
  const doc = JSON.parse(JSON.stringify(s.doc));
  doc.moods.push({ date: '2026-10-08', level: 4, note: 'Bien' });
  const r1 = s.save(doc);
  assert.equal(r1.ok, true);
  assert.equal(r1.revision, 1);
  const again = store(path.dirname(s.dir));
  assert.equal(again.load().status, 'ok');
  assert.deepEqual(again.doc.moods, [{ date: '2026-10-08', level: 4, note: 'Bien' }]);
  assert.equal(again.doc.meta.revision, 1);
});

test('écriture atomique : un renommage qui échoue laisse data.json intact', () => {
  const dir = tmp();
  const file = path.join(dir, 'data.json');
  writeAtomic(file, '{"ok":1}');
  const failing = Object.assign({}, fs, { renameSync: () => { const e = new Error('disque plein'); e.code = 'ENOSPC'; throw e; } });
  assert.throws(() => writeAtomic(file, '{"ok":2}', failing), /disque plein/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"ok":1}');
  assert.equal(fs.existsSync(file + '.tmp'), false);
});

test('écriture atomique : nouvelles tentatives si Windows bloque un instant (EBUSY)', () => {
  const dir = tmp();
  const file = path.join(dir, 'data.json');
  let fails = 2;
  const flaky = Object.assign({}, fs, { renameSync: (a, b) => { if (fails-- > 0) { const e = new Error('occupé'); e.code = 'EBUSY'; throw e; } return fs.renameSync(a, b); } });
  writeAtomic(file, '{"ok":3}', flaky);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"ok":3}');
});

test('fichier illisible : aucune écriture, et le fichier reste tel quel', () => {
  const base = tmp();
  const dir = path.join(base, 'Donnees-Lamia');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'data.json'), '{ pas du json');
  const s = store(base);
  const r = s.load();
  assert.equal(r.status, 'corrupt');
  assert.equal(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'), '{ pas du json');
  const aside = s.setAsideCorrupt();
  assert.match(path.basename(aside), /^data-illisible-2026-10-08T09-00-00\.json$/);
  assert.equal(s.load().status, 'created');
});

test('format plus récent que l’exe : lecture seule (aucune écriture)', () => {
  const base = tmp();
  const dir = path.join(base, 'Donnees-Lamia');
  fs.mkdirSync(dir);
  const future = M.defaultState();
  future.schemaVersion = 7;
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(future));
  const before = fs.readFileSync(path.join(dir, 'data.json'), 'utf8');
  const r = store(base).load();
  assert.equal(r.status, 'too-new');
  assert.ok(r.doc);
  assert.equal(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'), before);
});

test('migration au chargement : copie « avant-migration » puis écriture au nouveau format', () => {
  const base = tmp();
  const dir = path.join(base, 'Donnees-Lamia');
  fs.mkdirSync(dir);
  const v1 = { version: 1, categories: M.DEFAULT_CATEGORIES, tasks: [], moods: [], settings: { theme: 'dark', schedules: {} }, timer: null, flags: {} };
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(v1));
  const s = store(base);
  const r = s.load();
  assert.equal(r.status, 'ok');
  assert.equal(r.migrated, true);
  assert.equal(readJson(path.join(dir, 'data.json')).schemaVersion, 2);
  const backups = fs.readdirSync(path.join(dir, 'sauvegardes'));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^avant-migration-v1-/);
  assert.equal(readJson(path.join(dir, 'sauvegardes', backups[0])).version, 1);
});

test('sauvegardes quotidiennes : une par jour, 30 conservées', () => {
  const base = tmp();
  const s = store(base);
  s.load();
  const start = clock;
  for (let i = 0; i < 35; i++) {
    clock = start + i * 86400000;
    s.dailyBackup();
    assert.equal(s.dailyBackup(), null);   // pas deux fois le même jour
  }
  clock = start;
  const files = fs.readdirSync(s.backupDir).filter((f) => f.startsWith('data-')).sort();
  assert.equal(files.length, DAILY_KEEP);
  assert.equal(files[0], 'data-2026-10-13.json');
  assert.equal(files[files.length - 1], 'data-2026-11-11.json');
});

test('restauration : copie de sécurité de l’état actuel, puis remplacement', () => {
  const base = tmp();
  const s = store(base);
  s.load();
  s.dailyBackup();                                  // sauvegarde vide
  const doc = JSON.parse(JSON.stringify(s.doc));
  doc.moods.push({ date: '2026-10-08', level: 5, note: '' });
  s.save(doc);
  const list = s.listBackups();
  assert.equal(list[0].kind, 'quotidienne');
  assert.equal(list[0].summary.moods, 0);
  clock += 1000;
  const r = s.restore(list[0].id);
  assert.equal(r.ok, true);
  assert.equal(s.doc.moods.length, 0);
  assert.match(r.backup, /^avant-restauration-/);
  const kept = readJson(path.join(s.backupDir, r.backup));
  assert.equal(kept.moods.length, 1);
  assert.equal(s.restore('../data.json').ok, false);   // pas de traversée de chemin
});

test('conflit : data.json modifié ailleurs (autre PC via OneDrive) → copie de conflit, rien d’écrasé', () => {
  const base = tmp();
  const s = store(base);
  s.load();
  const other = readJson(s.file);
  other.meta.revision = 9;
  other.moods.push({ date: '2026-10-08', level: 2, note: 'autre PC' });
  fs.writeFileSync(s.file, JSON.stringify(other, null, 2) + '\n');
  const mine = JSON.parse(JSON.stringify(s.doc));
  mine.moods.push({ date: '2026-10-08', level: 5, note: 'ici' });
  const r = s.save(mine);
  assert.equal(r.ok, false);
  assert.equal(r.conflict, true);
  assert.match(path.basename(r.file), /^data-conflit-PC-LAMIA-/);
  assert.equal(readJson(s.file).moods[0].note, 'autre PC');
  assert.equal(readJson(r.file).moods[0].note, 'ici');
});

test('document invalide refusé à l’enregistrement', () => {
  const s = store(tmp());
  s.load();
  const bad = JSON.parse(JSON.stringify(s.doc));
  bad.tasks.push({ id: 'x' });
  assert.equal(s.save(bad).ok, false);
});
