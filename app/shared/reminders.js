/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · rappels d'échéance
   Une tâche non terminée, avec une date de fin et un rappel « J-n », est due
   du jour (fin - n) jusqu'au jour de la fin inclus. reminderLog[taskId] garde
   le dernier jour notifié : une seule notification par tâche et par jour.
   Module UMD (renderer + main + tests).
   ========================================================================== */
(function (root, factory) {
  var D = typeof require === 'function' && typeof module === 'object' ? require('./dates.js') : root.LamiaShared.dates;
  var mod = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.reminders = mod; }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var NB = D.NBSP;

  function isDue(t, today) {
    if (!t || t.status === 'done' || !t.endDate || !t.reminder || !(t.reminder.daysBefore >= 0)) return false;
    if (!D.valid(t.endDate)) return false;
    return D.addDays(t.endDate, -t.reminder.daysBefore) <= today && t.endDate >= today;
  }

  // Toutes les tâches dont le rappel est actif aujourd'hui (triées par échéance)
  function due(state, today) {
    today = today || D.today();
    return (state.tasks || []).filter(function (t) { return isDue(t, today); })
      .sort(function (a, b) { return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0; });
  }

  // Celles qui n'ont pas encore été notifiées aujourd'hui (skip : ids déjà notifiés dans la session)
  function pending(state, today, skip) {
    today = today || D.today();
    var log = state.reminderLog || {};
    return due(state, today).filter(function (t) {
      if (log[t.id] === today) return false;
      if (skip && (skip.has ? skip.has(t.id) : skip[t.id])) return false;
      return true;
    });
  }

  // Inscrit les tâches comme notifiées aujourd'hui (retourne un nouvel objet)
  function mark(log, ids, today) {
    var out = {};
    var keepFrom = D.addDays(today, -60);
    Object.keys(log || {}).forEach(function (k) { if (log[k] >= keepFrom) out[k] = log[k]; });   // ménage
    ids.forEach(function (id) { out[id] = today; });
    return out;
  }

  function when(t, today) {
    var n = D.diff(today, t.endDate);
    return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : 'le ' + D.dayMonthLong(t.endDate);
  }

  // Texte d'une notification Windows (une seule pour plusieurs tâches)
  function notification(tasks, today) {
    if (!tasks.length) return null;
    if (tasks.length === 1) {
      return { title: 'Rappel' + NB + ': « ' + tasks[0].title + ' »', body: 'Échéance ' + when(tasks[0], today) + '. Tu as le temps de t’organiser.' };
    }
    var list = tasks.slice(0, 3).map(function (t) { return '« ' + t.title + ' », ' + when(t, today); }).join(' ; ');
    return { title: tasks.length + ' rappels d’échéance', body: list + (tasks.length > 3 ? '…' : '.') };
  }

  return { isDue: isDue, due: due, pending: pending, mark: mark, when: when, notification: notification };
});
