'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../../shared/model.js');

test('notes : normalisation (champs, doublons, catégorie inconnue)', () => {
  const doc = M.normalize(M.defaultState({ nowIso: '2026-11-17T09:00:00.000Z' }));
  const cat = doc.categories[0].id;
  doc.notes = [
    { id: 'n1', title: 'Réunion', body: 'Points', categoryId: cat, pinned: 1, createdAt: '2026-11-17T09:00:00.000Z' },
    { id: 'n1', title: 'doublon' },
    { id: 'n2', title: 42, body: null, categoryId: 'inconnue', createdAt: 'pas une date' },
    null, { title: 'sans id' }
  ];
  const out = M.normalize(doc).notes;
  assert.strictEqual(out.length, 2);
  assert.deepStrictEqual(out[0], { id: 'n1', title: 'Réunion', body: 'Points', categoryId: cat, pinned: true, createdAt: '2026-11-17T09:00:00.000Z', updatedAt: '2026-11-17T09:00:00.000Z' });
  assert.strictEqual(out[1].title, '');
  assert.strictEqual(out[1].body, '');
  assert.strictEqual(out[1].categoryId, null);
  assert.ok(!isNaN(Date.parse(out[1].createdAt)));
  assert.ok(M.validate(M.normalize(doc)).ok);
});

test('notes : un ancien document sans notes reçoit une liste vide', () => {
  const doc = M.normalize(M.defaultState({ nowIso: '2026-11-17T09:00:00.000Z' }));
  delete doc.notes;
  assert.deepStrictEqual(M.normalize(doc).notes, []);
});
