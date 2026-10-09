'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../shared/reminders.js');
const { task, state } = require('./helpers.js');

function sample() {
  return state([
    task('j1', 'flowline', { title: 'Plaquette', endDate: '2026-10-09', reminder: { daysBefore: 1 } }),
    task('j7', 'auto', { title: 'URSSAF', endDate: '2026-10-15', reminder: { daysBefore: 7 } }),
    task('j2', 'flowline', { title: 'Trop tôt', endDate: '2026-10-12', reminder: { daysBefore: 2 } }),
    task('done', 'flowline', { endDate: '2026-10-09', reminder: { daysBefore: 1 }, status: 'done' }),
    task('none', 'flowline', { endDate: '2026-10-08' }),
    task('past', 'flowline', { endDate: '2026-10-07', reminder: { daysBefore: 1 } })
  ]);
}

test('rappels dus : de J-n jusqu’à l’échéance incluse, jamais pour une tâche terminée', () => {
  assert.deepEqual(R.due(sample(), '2026-10-08').map((t) => t.id), ['j1', 'j7']);
  assert.deepEqual(R.due(sample(), '2026-10-10').map((t) => t.id), ['j2', 'j7']);
  assert.deepEqual(R.due(sample(), '2026-10-16').map((t) => t.id), []);
});

test('une seule notification par tâche et par jour (reminderLog + session)', () => {
  const s = sample();
  s.reminderLog = R.mark(s.reminderLog, ['j1'], '2026-10-08');
  assert.deepEqual(R.pending(s, '2026-10-08').map((t) => t.id), ['j7']);
  assert.deepEqual(R.pending(s, '2026-10-08', new Set(['j7'])).map((t) => t.id), []);
  assert.deepEqual(R.pending(s, '2026-10-09').map((t) => t.id), ['j1', 'j7']);   // le lendemain, à nouveau
});

test('journal des rappels : ménage des entrées de plus de 60 jours', () => {
  const log = R.mark({ vieux: '2026-01-01', recent: '2026-10-01' }, ['x'], '2026-10-08');
  assert.deepEqual(log, { recent: '2026-10-01', x: '2026-10-08' });
});

test('texte des notifications Windows', () => {
  const s = sample();
  const one = R.notification([s.tasks[0]], '2026-10-08');
  assert.match(one.title, /Plaquette/);
  assert.match(one.body, /demain/);
  const many = R.notification(R.due(s, '2026-10-08'), '2026-10-08');
  assert.equal(many.title, '2 rappels d’échéance');
  assert.match(many.body, /URSSAF/);
  assert.equal(R.notification([], '2026-10-08'), null);
});
