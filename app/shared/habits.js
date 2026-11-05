/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · habitudes
   Petites cases à cocher chaque jour (eau, sommeil, lecture…), avec séries.

   Données (doc.habits) :
   - list : [{ id, name, icon, target (fois par jour, 1 = case à cocher),
              unit, days (jours actifs, 0 = lundi … 6 = dimanche),
              since (YYYY-MM-DD), archived }]
   - log  : { 'YYYY-MM-DD': { <id habitude>: nombre fait ce jour-là } }
   Un jour où l'habitude n'est pas prévue ne casse jamais une série.
   Module UMD.
   ========================================================================== */
(function (root, factory) {
  var D = typeof require === 'function' && typeof module === 'object' ? require('./dates.js') : root.LamiaShared.dates;
  var mod = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.habits = mod; }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

  // Idées proposées quand la liste est vide
  var SUGGESTIONS = [
    { name: 'Boire de l’eau', icon: '💧', target: 8, unit: 'verres' },
    { name: 'Dormir 7 h', icon: '😴', target: 1, unit: '' },
    { name: 'Lire 15 minutes', icon: '📖', target: 1, unit: '' },
    { name: 'Pas d’écran après 22 h', icon: '📵', target: 1, unit: '' },
    { name: 'Étirements', icon: '🧘', target: 1, unit: '' },
    { name: 'Marcher 10 000 pas', icon: '🚶', target: 1, unit: '' },
    { name: 'Dessiner pour moi', icon: '✏️', target: 1, unit: '' },
    { name: 'Prendre l’air', icon: '🌤️', target: 1, unit: '' }
  ];

  function normalize(h) {
    h = h && typeof h === 'object' && !Array.isArray(h) ? h : {};
    var list = (Array.isArray(h.list) ? h.list : []).filter(function (x) { return x && typeof x === 'object' && typeof x.name === 'string' && x.name.trim(); }).map(function (x, i) {
      var days = Array.isArray(x.days) ? x.days.filter(function (d, j, a) { return d >= 0 && d <= 6 && d === Math.round(d) && a.indexOf(d) === j; }).sort() : ALL_DAYS.slice();
      return {
        id: typeof x.id === 'string' && x.id ? x.id : 'hab-' + (i + 1),
        name: x.name.trim(),
        icon: typeof x.icon === 'string' && x.icon ? x.icon : '✨',
        target: x.target >= 1 && x.target <= 50 ? Math.round(x.target) : 1,
        unit: typeof x.unit === 'string' ? x.unit : '',
        days: days.length ? days : ALL_DAYS.slice(),
        since: DATE_RE.test(x.since) ? x.since : '2000-01-01',
        archived: !!x.archived
      };
    });
    var log = {};
    var src = h.log && typeof h.log === 'object' && !Array.isArray(h.log) ? h.log : {};
    Object.keys(src).forEach(function (d) {
      if (!DATE_RE.test(d) || !src[d] || typeof src[d] !== 'object') return;
      var day = {};
      Object.keys(src[d]).forEach(function (id) { var n = src[d][id]; if (typeof n === 'number' && n > 0 && isFinite(n)) day[id] = Math.min(99, Math.round(n)); });
      if (Object.keys(day).length) log[d] = day;
    });
    return { list: list, log: log };
  }

  function isActive(h, date) { return !h.archived && date >= h.since && h.days.indexOf(D.dowMon(date)) >= 0; }
  function count(log, h, date) { return (log[date] && log[date][h.id]) || 0; }
  function isDone(log, h, date) { return count(log, h, date) >= h.target; }

  // Série en cours : jours prévus réussis d'affilée. Aujourd'hui compte s'il est fait,
  // sinon la série part d'hier (la journée n'est pas finie).
  function streak(log, h, today) {
    var n = 0, d = today;
    if (!isDone(log, h, d)) d = D.addDays(d, -1);
    for (var guard = 0; guard < 3660 && d >= h.since; guard++, d = D.addDays(d, -1)) {
      if (h.days.indexOf(D.dowMon(d)) < 0) continue;
      if (!isDone(log, h, d)) break;
      n += 1;
    }
    return n;
  }

  // Meilleure série depuis le début
  function bestStreak(log, h, today) {
    var days = Object.keys(log).filter(function (d) { return d <= today && d >= h.since && isDone(log, h, d); }).sort();
    if (!days.length) return 0;
    var best = 0, cur = 0, prev = null;
    days.forEach(function (d) {
      if (prev) {
        // jours prévus entre les deux : s'il y en a un, la série est cassée
        var broken = false;
        for (var x = D.addDays(prev, 1); x < d; x = D.addDays(x, 1)) if (h.days.indexOf(D.dowMon(x)) >= 0) { broken = true; break; }
        cur = broken ? 1 : cur + 1;
      } else cur = 1;
      if (cur > best) best = cur;
      prev = d;
    });
    return best;
  }

  // Réussite sur une période (jours prévus jusqu'à aujourd'hui inclus)
  function rate(log, h, start, end, today) {
    var last = end < today ? end : today, planned = 0, done = 0;
    for (var d = start < h.since ? h.since : start; d <= last; d = D.addDays(d, 1)) {
      if (h.days.indexOf(D.dowMon(d)) < 0) continue;
      planned += 1;
      if (isDone(log, h, d)) done += 1;
    }
    return { planned: planned, done: done, pct: planned ? Math.round(done / planned * 100) : null };
  }

  // Bilan d'une journée pour toutes les habitudes actives
  function day(list, log, date) {
    var active = list.filter(function (h) { return isActive(h, date); });
    var done = active.filter(function (h) { return isDone(log, h, date); }).length;
    return { total: active.length, done: done, all: active.length > 0 && done === active.length };
  }

  // Réussite globale d'une période (toutes habitudes confondues)
  function period(list, log, start, end, today) {
    var planned = 0, done = 0;
    list.filter(function (h) { return !h.archived; }).forEach(function (h) { var r = rate(log, h, start, end, today); planned += r.planned; done += r.done; });
    return { planned: planned, done: done, pct: planned ? Math.round(done / planned * 100) : null };
  }

  // Meilleure série en cours / jamais atteinte, toutes habitudes confondues
  function maxStreak(list, log, today, best) {
    return list.reduce(function (m, h) { return Math.max(m, best ? bestStreak(log, h, today) : streak(log, h, today)); }, 0);
  }

  return {
    SUGGESTIONS: SUGGESTIONS, ALL_DAYS: ALL_DAYS,
    normalize: normalize, isActive: isActive, count: count, isDone: isDone,
    streak: streak, bestStreak: bestStreak, rate: rate, day: day, period: period, maxStreak: maxStreak
  };
});
