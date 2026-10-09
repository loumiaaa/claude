'use strict';
process.env.TZ = 'Europe/Paris';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../../shared/dates.js');
const ST = require('../../shared/stats.js');
const { entry, task, state } = require('./helpers.js');

// Semaine du lundi 5 au dimanche 11 octobre 2026 ; samedi 10 = jour perso
function week() {
  return state([
    task('f1', 'flowline', { timeEntries: [entry('2026-10-05', 420), entry('2026-10-06', 400), entry('2026-10-10', 60)] }),
    task('c1', 'carnet', { timeEntries: [entry('2026-10-10', 150), entry('2026-10-07', 30)] }),
    task('a1', 'auto', { timeEntries: [entry('2026-10-10', 60), entry('2026-10-12', 240)] })
  ]);
}

test.beforeEach(() => D.setNow('2026-10-08T10:00:00'));
test.after(() => D.setNow(null));

test('heures par catégorie : séparées, aucun total général', () => {
  const m = ST.minutesByCategory(week(), '2026-10-05', '2026-10-11');
  assert.deepEqual(m, { flowline: 880, carnet: 180, auto: 60 });
  assert.equal('total' in m, false);
});

test('heures par pôle : Flow Line et auto-entreprise, deux compteurs jamais additionnés', () => {
  const p = ST.minutesByPole(week(), '2026-10-05', '2026-10-11');
  assert.deepEqual(p, { flowline: 880, 'auto-entreprise': 240 });
  assert.deepEqual(Object.keys(p).sort(), ['auto-entreprise', 'flowline']);
});

test('objectif Flow Line : 35 h par semaine, 7 h par jour du lundi au vendredi', () => {
  const s = week();
  const g = ST.goalFor(s, s.categories[0]);
  assert.deepEqual(g, { weekly: 2100, daily: 420, days: [1, 2, 3, 4, 5] });
  assert.equal(ST.goalFor(s, s.categories[1]), null);   // pas d'objectif hebdomadaire par catégorie perso
});

test('objectif du samedi : 4 h minimum pour Carnet by-pass + Auto-entreprise, sans Flow Line', () => {
  const g = ST.weekPersoGoal(week(), '2026-10-08');
  assert.equal(g.label, 'Samedi perso');
  assert.equal(g.goalPerDay, 240);
  assert.equal(g.days.length, 1);
  assert.equal(g.days[0].date, '2026-10-10');
  assert.equal(g.days[0].minutes, 210);           // 150 Carnet + 60 Auto ; les 60 min Flow Line du samedi n'y sont pas
  assert.equal(g.days[0].reached, false);
  assert.equal(g.days[0].future, true);
  assert.equal(g.minutes, 210);
});

test('objectif du samedi : atteint à 4 h, désactivable, autres jours perso', () => {
  const s = week();
  s.tasks[2].timeEntries.push(entry('2026-10-10', 30));
  assert.equal(ST.weekPersoGoal(s, '2026-10-11').days[0].reached, true);
  s.settings.schedules['auto-entreprise'].minDailyHours = 0;
  assert.equal(ST.weekPersoGoal(s, '2026-10-11').enabled, false);
  s.settings.schedules['auto-entreprise'].minDailyHours = 4;
  s.settings.schedules['auto-entreprise'].days = [6, 0];
  const g = ST.weekPersoGoal(s, '2026-10-11');
  assert.equal(g.label, 'Jours perso');
  assert.deepEqual(g.days.map((d) => d.date), ['2026-10-10', '2026-10-11']);
});

test('objectif du samedi sur un mois : un résultat par samedi', () => {
  const g = ST.persoGoal(week(), '2026-10-01', '2026-10-31');
  assert.deepEqual(g.days.map((d) => d.date), ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']);
});

test('chrono en cours : compté aujourd’hui dans sa catégorie seulement', () => {
  const s = week();
  s.activeTimer = { taskId: 'c1', startedAt: new Date(D.nowMs() - 90 * 60000).toISOString(), accumulatedMs: 0, pausedAt: null };
  assert.equal(ST.minutesByCategory(s, '2026-10-08', '2026-10-08', true).carnet, 90);
  assert.equal(ST.minutesByCategory(s, '2026-10-08', '2026-10-08', false).carnet, 0);
  assert.equal(ST.minutesByCategory(s, '2026-10-08', '2026-10-08', true).flowline, 0);
});

test('chrono : temps écoulé avec pause, alerte au-delà de 10 h', () => {
  const now = D.nowMs();
  const running = { startedAt: new Date(now - 3600000).toISOString(), accumulatedMs: 1800000, pausedAt: null };
  assert.equal(ST.timerElapsed(running, now), 5400000);
  const paused = { startedAt: new Date(now - 3600000).toISOString(), accumulatedMs: 1800000, pausedAt: new Date(now).toISOString() };
  assert.equal(ST.timerElapsed(paused, now), 1800000);
  assert.equal(ST.isLongTimer({ startedAt: new Date(now - 11 * 3600000).toISOString(), accumulatedMs: 0 }, now), true);
  assert.equal(ST.isLongTimer({ startedAt: new Date(now - 9 * 3600000).toISOString(), accumulatedMs: 0 }, now), false);
});

test('chrono : à l’arrêt, découpage par jour quand il passe minuit', () => {
  const start = new Date(2026, 9, 8, 23, 0).getTime();
  const stop = new Date(2026, 9, 9, 0, 45).getTime();
  assert.deepEqual(ST.timerEntries({ startedAt: new Date(start).toISOString(), accumulatedMs: 0, pausedAt: null }, stop),
    [{ date: '2026-10-08', minutes: 60 }, { date: '2026-10-09', minutes: 45 }]);
  // Avec une pause, tout va sur le jour d'arrêt
  assert.deepEqual(ST.timerEntries({ startedAt: new Date(stop - 600000).toISOString(), accumulatedMs: 1200000, pausedAt: null }, stop),
    [{ date: '2026-10-09', minutes: 30 }]);
  // Au moins une minute
  assert.deepEqual(ST.timerEntries({ startedAt: new Date(stop - 5000).toISOString(), accumulatedMs: 0, pausedAt: null }, stop), [{ date: '2026-10-09', minutes: 1 }]);
});

test('retards (« à replanifier ») et échéances', () => {
  const s = state([
    task('late', 'flowline', { endDate: '2026-10-06' }),
    task('done', 'flowline', { endDate: '2026-10-01', status: 'done', completedAt: '2026-10-01' }),
    task('today', 'auto', { endDate: '2026-10-08', priority: 'high' }),
    task('soon', 'carnet', { endDate: '2026-10-10', priority: 'urgent' }),
    task('soon2', 'carnet', { endDate: '2026-10-10', priority: 'low' }),
    task('later', 'carnet', { endDate: '2026-10-30' })
  ]);
  assert.deepEqual(ST.overdue(s).map((t) => t.id), ['late']);
  assert.equal(ST.isOverdue(s.tasks[1]), false);
  assert.deepEqual(ST.dueBetween(s, '2026-10-08', '2026-10-15').map((t) => t.id), ['today', 'soon', 'soon2']);
});

test('récap de période : taux de complétion limité aux échéances passées', () => {
  const s = state([
    task('a', 'flowline', { endDate: '2026-10-06', status: 'done', completedAt: '2026-10-06', createdAt: '2026-10-05' }),
    task('b', 'flowline', { endDate: '2026-10-07' }),
    task('c', 'flowline', { endDate: '2026-10-09' })
  ]);
  const r = ST.summary(s, D.period('week', '2026-10-08'));
  assert.equal(r.rate, 50);
  assert.equal(r.created.length, 1);
  assert.equal(r.done.length, 1);
  assert.deepEqual(r.upcoming.map((t) => t.id), ['c']);
  assert.deepEqual(r.replan.map((t) => t.id), ['b']);
});
