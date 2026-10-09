'use strict';
// Petites fabriques de données pour les tests unitaires.
const model = require('../../shared/model.js');

let n = 0;
function entry(date, minutes, extra) {
  return Object.assign({ id: 'e' + (++n), date, minutes, note: '', source: 'manual' }, extra || {});
}

function task(id, categoryId, extra) {
  return Object.assign({
    id, title: 'Tâche ' + id, description: '', categoryId, client: '', status: 'doing', progress: 0, priority: 'normal',
    tags: [], startDate: null, endDate: null, checklist: [], timeEntries: [], reminder: null,
    createdAt: '2026-10-01', updatedAt: '2026-10-01', completedAt: null, order: 0
  }, extra || {});
}

function state(tasks, patch) {
  const s = model.defaultState({ nowIso: '2026-10-08T08:00:00.000Z' });
  s.tasks = tasks || [];
  return Object.assign(s, patch || {});
}

module.exports = { entry, task, state };
