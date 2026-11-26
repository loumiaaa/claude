'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../../shared/model.js');
const ST = require('../../shared/stats.js');
const R = require('../../shared/reminders.js');

test('statut « en pause » : accepté, jamais en retard ni relancé', () => {
  const doc = M.normalize(M.defaultState({ nowIso: '2026-11-26T09:00:00.000Z' }));
  const base = { categoryId: doc.categories[0].id, priority: 'normal', timeEntries: [], checklist: [], tags: [], progress: 0, order: 0 };
  doc.tasks = [
    Object.assign({ id: 'a', title: 'En pause', status: 'paused', endDate: '2026-11-20', reminder: { daysBefore: 1 } }, base),
    Object.assign({ id: 'b', title: 'En cours', status: 'doing', endDate: '2026-11-20', reminder: { daysBefore: 1 } }, base),
    Object.assign({ id: 'c', title: 'Pause à venir', status: 'paused', endDate: '2026-11-28' }, base)
  ];
  assert.ok(M.validate(doc).ok);
  assert.deepStrictEqual(ST.overdue(doc, '2026-11-26').map((t) => t.id), ['b']);
  assert.deepStrictEqual(ST.dueBetween(doc, '2026-11-26', '2026-11-30').map((t) => t.id), []);
  assert.strictEqual(R.isDue(doc.tasks[0], '2026-11-19'), false);
});
