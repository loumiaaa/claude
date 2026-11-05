/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · badges et étapes
   Les badges se calculent à partir des données (rien à cocher à la main) :
   tâches bouclées, heures, focus, habitudes, humeur, sport, bilans, épargne.
   Chaque badge gagné rapproche d'un cadeau pixel : un accessoire pour son
   personnage ou pour Memeow (fleur, nœud, béret, collier, couronnes).
   Module UMD.
   ========================================================================== */
(function (root, factory) {
  var node = typeof require === 'function' && typeof module === 'object';
  var D = node ? require('./dates.js') : root.LamiaShared.dates;
  var H = node ? require('./habits.js') : root.LamiaShared.habits;
  var B = node ? require('./budget.js') : root.LamiaShared.budget;
  var mod = factory(D, H, B);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.badges = mod; }
})(typeof self !== 'undefined' ? self : this, function (D, H, B) {
  'use strict';

  /* --- Mesures ------------------------------------------------------------- */
  function doneTasks(doc) { return (doc.tasks || []).filter(function (t) { return t.status === 'done'; }).length; }
  function totalHours(doc) {
    var m = 0;
    (doc.tasks || []).forEach(function (t) { (t.timeEntries || []).forEach(function (e) { m += e.minutes || 0; }); });
    (doc.hours || []).forEach(function (e) { m += e.minutes || 0; });
    return Math.floor(m / 60);
  }
  // Semaines (lundi) où l'objectif hebdomadaire du travail principal est atteint ; meilleure suite
  function goalWeeks(doc) {
    var sch = doc.settings && doc.settings.schedules && doc.settings.schedules.flowline;
    var goal = sch && sch.weeklyHours ? sch.weeklyHours * 60 : 0;
    if (!goal) return { count: 0, run: 0 };
    var cats = {};
    (doc.categories || []).forEach(function (c) { if (c.group === 'flowline') cats[c.id] = 1; });
    var weeks = {};
    (doc.tasks || []).forEach(function (t) {
      if (!cats[t.categoryId]) return;
      (t.timeEntries || []).forEach(function (e) { var w = D.startOfWeek(e.date); weeks[w] = (weeks[w] || 0) + (e.minutes || 0); });
    });
    (doc.hours || []).forEach(function (e) { if (!cats[e.categoryId]) return; var w = D.startOfWeek(e.date); weeks[w] = (weeks[w] || 0) + (e.minutes || 0); });
    var ok = Object.keys(weeks).filter(function (w) { return weeks[w] >= goal; }).sort();
    return { count: ok.length, run: bestRun(ok, 7) };
  }
  // Plus longue suite de dates séparées de « step » jours
  function bestRun(sorted, step) {
    var best = 0, cur = 0, prev = null;
    sorted.forEach(function (d) { cur = prev && D.diff(prev, d) === step ? cur + 1 : 1; if (cur > best) best = cur; prev = d; });
    return best;
  }
  function uniqueSorted(list) { return list.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(); }
  function moodRun(doc) { return bestRun(uniqueSorted((doc.moods || []).map(function (m) { return m.date; })), 1); }
  function sportWeeksRun(doc) {
    var h = doc.health || {};
    return bestRun(uniqueSorted((h.sports || []).map(function (s) { return D.startOfWeek(s.date); })), 7);
  }
  function habitBest(doc, today) {
    var h = doc.habits || { list: [], log: {} };
    return H.maxStreak(h.list || [], h.log || {}, today, true);
  }
  function savedGoal(doc, today) {
    var b = doc.budget;
    if (!b || !b.goals) return 0;
    return b.goals.filter(function (g) { return g.target > 0 && B.goalSaved(b, g.id, today) >= g.target; }).length;
  }

  /* --- Catalogue ------------------------------------------------------------ */
  // space : badge affiché seulement si l'espace est activé (santé, budget)
  var CATALOG = [
    { id: 'task-1', icon: '🎯', title: 'Première victoire', desc: 'Boucler une première tâche', target: 1, value: doneTasks },
    { id: 'task-10', icon: '🔟', title: 'Sur la lancée', desc: 'Boucler 10 tâches', target: 10, value: doneTasks },
    { id: 'task-50', icon: '🚀', title: 'Machine à pixels', desc: 'Boucler 50 tâches', target: 50, value: doneTasks },
    { id: 'task-100', icon: '💯', title: 'Cent pour cent', desc: 'Boucler 100 tâches', target: 100, value: doneTasks },
    { id: 'hours-100', icon: '⏱️', title: 'Cent heures', desc: 'Chronométrer 100 heures de travail', target: 100, value: totalHours },
    { id: 'hours-500', icon: '⌛', title: 'Cinq cents heures', desc: 'Chronométrer 500 heures de travail', target: 500, value: totalHours },
    { id: 'week-goal', icon: '🏁', title: 'Semaine bouclée', desc: 'Atteindre l’objectif d’heures d’une semaine', target: 1, value: function (d) { return goalWeeks(d).count; } },
    { id: 'week-goal-4', icon: '🏆', title: 'Un mois carré', desc: 'Atteindre l’objectif d’heures 4 semaines d’affilée', target: 4, value: function (d) { return goalWeeks(d).run; } },
    { id: 'focus-1', icon: '🍅', title: 'Premier focus', desc: 'Terminer une session du mode focus', target: 1, value: function (d) { return ((d.focus && d.focus.sessions) || []).length; } },
    { id: 'focus-25', icon: '🧠', title: 'Concentration maximale', desc: 'Terminer 25 sessions du mode focus', target: 25, value: function (d) { return ((d.focus && d.focus.sessions) || []).length; } },
    { id: 'habit-7', icon: '🌱', title: 'Petite graine', desc: 'Tenir une habitude 7 jours d’affilée', target: 7, value: habitBest },
    { id: 'habit-30', icon: '🌳', title: 'Bien enracinée', desc: 'Tenir une habitude 30 jours d’affilée', target: 30, value: habitBest },
    { id: 'mood-7', icon: '🌈', title: 'À l’écoute de soi', desc: 'Noter son humeur 7 jours d’affilée', target: 7, value: moodRun },
    { id: 'mood-30', icon: '📔', title: 'Journal d’humeur', desc: 'Noter son humeur 30 fois', target: 30, value: function (d) { return (d.moods || []).length; } },
    { id: 'sport-10', icon: '🏃', title: 'En mouvement', desc: 'Faire 10 séances de sport', target: 10, space: 'health', value: function (d) { return ((d.health && d.health.sports) || []).length; } },
    { id: 'sport-weeks', icon: '💪', title: 'Régulière', desc: 'Faire du sport 4 semaines d’affilée', target: 4, space: 'health', value: sportWeeksRun },
    { id: 'review-1', icon: '🗓️', title: 'Premier bilan', desc: 'Faire un premier bilan du dimanche', target: 1, value: function (d) { return (d.reviews || []).length; } },
    { id: 'review-4', icon: '📈', title: 'Rituel installé', desc: 'Faire 4 bilans du dimanche', target: 4, value: function (d) { return (d.reviews || []).length; } },
    { id: 'save-goal', icon: '🐷', title: 'Cagnotte remplie', desc: 'Atteindre le montant d’une cagnotte d’épargne', target: 1, space: 'budget', value: savedGoal },
    { id: 'word', icon: '✨', title: 'Un mot pour l’année', desc: 'Choisir son mot de l’année dans le profil', target: 1, value: function (d) { return d.profile && d.profile.word ? 1 : 0; } }
  ];

  // Cadeaux pixel, débloqués au fil des badges gagnés
  var REWARDS = [
    { need: 2, who: 'me', item: 'fleur', label: 'Une fleur dans les cheveux' },
    { need: 4, who: 'memeow', item: 'noeud', label: 'Un nœud rose pour Memeow' },
    { need: 6, who: 'me', item: 'beret', label: 'Un béret d’artiste' },
    { need: 9, who: 'memeow', item: 'collier', label: 'Un collier à grelot pour Memeow' },
    { need: 12, who: 'me', item: 'couronne', label: 'Une couronne dorée' },
    { need: 15, who: 'memeow', item: 'couronne', label: 'La couronne de Memeow' }
  ];

  // opts : { today, spaces: { health, budget } }
  function compute(doc, opts) {
    opts = opts || {};
    var today = opts.today || D.today();
    var sp = opts.spaces || (doc.settings && doc.settings.spaces) || {};
    return CATALOG.filter(function (b) { return !b.space || sp[b.space] !== false; }).map(function (b) {
      var v = 0;
      try { v = b.value(doc, today) || 0; } catch (e) { v = 0; }
      return { id: b.id, icon: b.icon, title: b.title, desc: b.desc, target: b.target, value: Math.min(v, b.target), got: v >= b.target, pct: Math.min(100, Math.round(v / b.target * 100)) };
    });
  }

  function rewards(count) {
    return REWARDS.map(function (r) { return { need: r.need, who: r.who, item: r.item, label: r.label, unlocked: count >= r.need }; });
  }

  function nextReward(count) {
    for (var i = 0; i < REWARDS.length; i++) if (count < REWARDS[i].need) return { need: REWARDS[i].need, left: REWARDS[i].need - count, label: REWARDS[i].label, item: REWARDS[i].item, who: REWARDS[i].who };
    return null;
  }

  return { CATALOG: CATALOG, REWARDS: REWARDS, compute: compute, rewards: rewards, nextReward: nextReward };
});
