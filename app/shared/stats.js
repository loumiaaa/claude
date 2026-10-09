/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · heures, objectifs, échéances
   Requêtes pures sur l'état (aucun DOM, aucun Node) : reprises de L.q de la
   maquette, testées unitairement et utilisées par le renderer.

   Règle d'or : les heures Flow Line ne sont JAMAIS additionnées aux heures
   perso. Chaque catégorie a son compteur ; le pôle auto-entreprise
   (Auto-entreprise + Carnet by-pass) a son propre objectif : 4 h minimum le
   samedi. Il n'existe aucun « total général ».
   Module UMD.
   ========================================================================== */
(function (root, factory) {
  var D = typeof require === 'function' && typeof module === 'object' ? require('./dates.js') : root.LamiaShared.dates;
  var mod = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.stats = mod; }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var POLES = ['flowline', 'auto-entreprise'];
  var POLE_LABEL = { flowline: 'Flow Line', 'auto-entreprise': 'Auto-entreprise' };
  var PRIO_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
  var TEN_HOURS_MS = 10 * 3600 * 1000;

  /* --- Chrono --------------------------------------------------------------- */
  // Temps écoulé (ms) d'un chrono { startedAt: ISO, accumulatedMs, pausedAt: ISO|null }
  function timerElapsed(tm, nowMs) {
    if (!tm) return 0;
    if (nowMs == null) nowMs = D.nowMs();
    var start = Date.parse(tm.startedAt);
    var running = tm.pausedAt || isNaN(start) ? 0 : nowMs - start;
    return Math.max(0, (tm.accumulatedMs || 0) + running);
  }

  function isLongTimer(tm, nowMs) { return timerElapsed(tm, nowMs) > TEN_HOURS_MS; }

  // Entrées de temps à créer à l'arrêt : découpées par jour local si le chrono
  // a tourné d'une traite (sans pause) par-dessus minuit ; sinon tout sur le jour d'arrêt.
  function timerEntries(tm, nowMs) {
    if (!tm) return [];
    if (nowMs == null) nowMs = D.nowMs();
    var total = timerElapsed(tm, nowMs);
    var start = Date.parse(tm.startedAt);
    var parts;
    if (!tm.accumulatedMs && !tm.pausedAt && !isNaN(start)) {
      parts = D.splitByDay(start, nowMs).map(function (p) { return { date: p.date, minutes: Math.round(p.ms / 60000) }; });
    } else parts = [{ date: D.dateOf(nowMs), minutes: Math.round(total / 60000) }];
    parts = parts.filter(function (p) { return p.minutes > 0; });
    if (!parts.length) parts = [{ date: D.dateOf(nowMs), minutes: 1 }];   // au moins une minute
    return parts;
  }

  /* --- Tâches ---------------------------------------------------------------- */
  function isDone(t) { return t.status === 'done'; }
  function isOverdue(t, ref) { return !isDone(t) && !!t.endDate && t.endDate < (ref || D.today()); }

  function category(state, id) {
    for (var i = 0; i < state.categories.length; i++) if (state.categories[i].id === id) return state.categories[i];
    return null;
  }

  function poleOf(state, t) {
    var c = category(state, t.categoryId);
    return c ? c.group : null;
  }

  // Minutes d'une tâche sur une plage (chrono en cours inclus si demandé : il compte pour aujourd'hui)
  function taskMinutes(state, t, a, b, withTimer) {
    var m = 0;
    t.timeEntries.forEach(function (e) { if ((!a || e.date >= a) && (!b || e.date <= b)) m += e.minutes; });
    var tm = state.activeTimer;
    if (withTimer && tm && tm.taskId === t.id) {
      var today = D.today();
      if ((!a || today >= a) && (!b || today <= b)) m += Math.floor(timerElapsed(tm) / 60000);
    }
    return m;
  }

  // Heures par catégorie, SÉPARÉES (jamais de total général)
  function minutesByCategory(state, a, b, withTimer) {
    var out = {};
    state.categories.forEach(function (c) { out[c.id] = 0; });
    state.tasks.forEach(function (t) { if (out[t.categoryId] != null) out[t.categoryId] += taskMinutes(state, t, a, b, withTimer); });
    return out;
  }

  // Heures par pôle : { flowline, 'auto-entreprise' }. Deux compteurs distincts,
  // JAMAIS additionnés entre eux (ni dans l'interface, ni dans les exports).
  function minutesByPole(state, a, b, withTimer) {
    var out = { flowline: 0, 'auto-entreprise': 0 };
    state.tasks.forEach(function (t) {
      var g = poleOf(state, t);
      if (g && out[g] != null) out[g] += taskMinutes(state, t, a, b, withTimer);
    });
    return out;
  }

  // Minutes par jour pour une catégorie : { 'YYYY-MM-DD': minutes }
  function dailyMinutes(state, catId, a, b, withTimer) {
    return dailyFor(state, function (t) { return t.categoryId === catId; }, a, b, withTimer);
  }

  // Minutes par jour pour un pôle (toutes ses catégories)
  function poleDailyMinutes(state, group, a, b, withTimer) {
    return dailyFor(state, function (t) { return poleOf(state, t) === group; }, a, b, withTimer);
  }

  function dailyFor(state, keep, a, b, withTimer) {
    var out = {};
    D.eachDay(a, b).forEach(function (d) { out[d] = 0; });
    var today = D.today();
    var tm = state.activeTimer;
    state.tasks.forEach(function (t) {
      if (!keep(t)) return;
      t.timeEntries.forEach(function (e) { if (out[e.date] != null) out[e.date] += e.minutes; });
      if (withTimer && tm && tm.taskId === t.id && out[today] != null) out[today] += Math.floor(timerElapsed(tm) / 60000);
    });
    return out;
  }

  /* --- Objectifs ------------------------------------------------------------------ */
  // Objectif hebdomadaire d'une catégorie (Flow Line : 35 h, 7 h par jour du lundi au vendredi)
  function goalFor(state, cat) {
    var sch = state.settings.schedules[cat.group];
    if (!sch || !sch.weeklyHours) return null;
    var days = sch.days.length || 5;
    return { weekly: sch.weeklyHours * 60, daily: Math.round(sch.weeklyHours * 60 / days), days: sch.days };
  }

  function persoSchedule(state) {
    var sch = (state.settings.schedules || {})['auto-entreprise'] || {};
    var days = Array.isArray(sch.days) && sch.days.length ? sch.days.slice() : [6];
    var min = sch.minDailyHours == null ? 4 : +sch.minDailyHours;
    return { days: days, minDailyHours: min > 0 ? min : 0 };
  }

  // « Samedi perso » pour une seule journée perso (samedi), sinon « Jours perso »
  function persoLabel(days) {
    if (days.length === 1) return D.cap(D.DAYS[days[0]]) + ' perso';
    return 'Jours perso';
  }

  // Objectif du pôle auto-entreprise sur [a, b] : un minimum par jour perso (4 h le samedi).
  // Les heures Flow Line n'y entrent jamais, même un samedi.
  function persoGoal(state, a, b, withTimer) {
    var sch = persoSchedule(state);
    var goal = Math.round(sch.minDailyHours * 60);
    var today = D.today();
    var daily = poleDailyMinutes(state, 'auto-entreprise', a, b, withTimer);
    var days = D.eachDay(a, b).filter(function (d) { return sch.days.indexOf(D.dow(d)) >= 0; }).map(function (d) {
      return { date: d, minutes: daily[d] || 0, goal: goal, reached: goal > 0 && (daily[d] || 0) >= goal, future: d > today, today: d === today };
    });
    var reached = days.filter(function (x) { return x.reached; }).length;
    return {
      group: 'auto-entreprise',
      label: persoLabel(sch.days),
      enabled: goal > 0,
      goalPerDay: goal,
      days: days,
      reachedCount: reached,
      minutes: days.reduce(function (s, x) { return s + x.minutes; }, 0)   // pôle perso seulement
    };
  }

  // La jauge du Dashboard : la (ou les) journée(s) perso de la semaine en cours
  function weekPersoGoal(state, anchor, withTimer) {
    anchor = anchor || D.today();
    return persoGoal(state, D.startOfWeek(anchor), D.endOfWeek(anchor), withTimer);
  }

  /* --- Échéances -------------------------------------------------------------------- */
  function overdue(state, ref) {
    return state.tasks.filter(function (t) { return isOverdue(t, ref); }).sort(function (a, b) { return a.endDate < b.endDate ? -1 : 1; });
  }

  function dueBetween(state, a, b) {
    return state.tasks.filter(function (t) { return !isDone(t) && t.endDate && t.endDate >= a && t.endDate <= b; })
      .sort(function (x, y) { return x.endDate < y.endDate ? -1 : x.endDate > y.endDate ? 1 : PRIO_RANK[x.priority] - PRIO_RANK[y.priority]; });
  }

  // Récap d'une période (jour / semaine / mois)
  function summary(state, p) {
    var today = D.today();
    var tasks = state.tasks;
    var created = tasks.filter(function (t) { return t.createdAt && D.between(t.createdAt, p.start, p.end); });
    var done = tasks.filter(function (t) { return t.completedAt && D.between(t.completedAt, p.start, p.end); });
    // En cours : tâches « En cours » ou « En validation » déjà commencées à la fin de la période
    var ongoing = tasks.filter(function (t) {
      return (t.status === 'doing' || t.status === 'review') && (!t.startDate || t.startDate <= p.end);
    });
    var upcomingFrom = p.start > today ? p.start : today;
    var upcoming = p.end >= today ? dueBetween(state, upcomingFrom, p.end) : [];
    var replan = tasks.filter(function (t) { return isOverdue(t) && t.endDate <= p.end && t.endDate >= p.start; });
    // Taux de complétion : seulement les échéances déjà arrivées (on ne compte pas demain contre toi)
    var dueInPeriod = tasks.filter(function (t) { return t.endDate && D.between(t.endDate, p.start, p.end) && t.endDate <= today; });
    var dueDone = dueInPeriod.filter(isDone);
    return {
      created: created, done: done, ongoing: ongoing, upcoming: upcoming, replan: replan,
      allReplan: overdue(state),
      due: dueInPeriod, dueDone: dueDone,
      rate: dueInPeriod.length ? Math.round(dueDone.length / dueInPeriod.length * 100) : null
    };
  }

  return {
    POLES: POLES, POLE_LABEL: POLE_LABEL, PRIO_RANK: PRIO_RANK, TEN_HOURS_MS: TEN_HOURS_MS,
    timerElapsed: timerElapsed, isLongTimer: isLongTimer, timerEntries: timerEntries,
    isDone: isDone, isOverdue: isOverdue, category: category, poleOf: poleOf,
    taskMinutes: taskMinutes, minutesByCategory: minutesByCategory, minutesByPole: minutesByPole,
    dailyMinutes: dailyMinutes, poleDailyMinutes: poleDailyMinutes,
    goalFor: goalFor, persoSchedule: persoSchedule, persoGoal: persoGoal, weekPersoGoal: weekPersoGoal,
    overdue: overdue, dueBetween: dueBetween, summary: summary
  };
});
