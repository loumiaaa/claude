'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CSV = require('../../shared/csv.js');
const { entry, task, state } = require('./helpers.js');

function sample() {
  return state([
    task('f1', 'flowline', { title: 'Plaquette 8 pages', client: 'Domaine des Tilleuls', timeEntries: [entry('2026-10-05', 90, { source: 'timer', note: 'Retours; client' }), entry('2026-10-06', 445)] }),
    task('c1', 'carnet', { title: 'Couverture "pistes"', timeEntries: [entry('2026-10-10', 150, { note: 'ligne 1\nligne 2' })] }),
    task('a1', 'auto', { title: '=SOMME(A1)', client: '-Ana', timeEntries: [entry('2026-10-10', 45, { note: '+urgent' }), entry('2026-11-02', 60)] })
  ]);
}

test('CSV : UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF', () => {
  const out = CSV.build(sample(), '2026-10-01', '2026-10-31');
  assert.equal(out.charCodeAt(0), 0xFEFF);
  assert.ok(out.endsWith('\r\n'));
  assert.equal(out.split('\r\n')[0], '﻿Date;Catégorie;Pôle;Client / projet;Tâche;Durée (h);Durée (hh:mm);Source;Note');
});

test('CSV : une ligne par entrée, virgule décimale, h:mm, source, date JJ/MM/AAAA', () => {
  const lines = CSV.build(sample(), '2026-10-01', '2026-10-31').split('\r\n');
  assert.equal(lines[1], '05/10/2026;Flow Line;Flow Line;Domaine des Tilleuls;Plaquette 8 pages;1,50;1:30;Chrono;"Retours; client"');
  assert.equal(lines[2], '06/10/2026;Flow Line;Flow Line;Domaine des Tilleuls;Plaquette 8 pages;7,42;7:25;Saisie manuelle;');
});

test('CSV : sous-totaux par catégorie, aucun total général', () => {
  const out = CSV.build(sample(), '2026-10-01', '2026-10-31');
  const lines = out.split('\r\n');
  assert.ok(lines.includes(';Flow Line;Flow Line;;Sous-total Flow Line;8,92;8:55;;'));
  assert.ok(lines.includes(';Carnet by-pass;Auto-entreprise;;Sous-total Carnet by-pass;2,50;2:30;;'));
  assert.ok(lines.includes(';Auto-entreprise;Auto-entreprise;;Sous-total Auto-entreprise;0,75;0:45;;'));
  assert.equal(/total général|Total;/i.test(out), false);
});

test('CSV : échappements (guillemets, retours à la ligne) et formules neutralisées', () => {
  const out = CSV.build(sample(), '2026-10-01', '2026-10-31');
  assert.ok(out.includes('"Couverture ""pistes"""'));
  assert.ok(out.includes('"ligne 1\nligne 2"'));
  assert.ok(out.includes('; -Ana; =SOMME(A1);'));     // un espace : Excel ne l'interprète pas comme une formule
  assert.ok(out.includes(';Saisie manuelle; +urgent'));
});

test('CSV : seules les entrées de la période, pôle de chaque catégorie', () => {
  const rows = CSV.rows(sample(), '2026-10-10', '2026-10-10');
  assert.deepEqual(rows.filter((r) => r[0]).map((r) => [r[1], r[2], r[5]]), [['Carnet by-pass', 'Auto-entreprise', '2,50'], ['Auto-entreprise', 'Auto-entreprise', '0,75']]);
  assert.equal(CSV.build(sample(), '2027-01-01', '2027-01-31').split('\r\n').length, 2);   // en-tête seul
  assert.equal(CSV.filename({ start: '2026-10-05', end: '2026-10-11' }), 'heures-lamia_2026-10-05_2026-10-11.csv');
});
