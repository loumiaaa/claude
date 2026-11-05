/* ==========================================================================
   Plateforme de suivi - Lamia — bilan du dimanche
   Un écran guidé, en 4 étapes, pour regarder sa semaine avec bienveillance :
   1. la semaine en chiffres (tâches bouclées, heures, humeur, sport,
      habitudes, focus, budget) ; 2. fiertés et apprentissages ; 3. ce qui
   arrive la semaine suivante ; 4. trois priorités, qu'on retrouve sur
   l'Accueil toute la semaine et qu'on coche au fil de l'eau.
   Le bilan d'une semaine se fait à partir du samedi ; en semaine, l'écran
   propose celui de la semaine passée.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q, ST = L.shared.stats, HB = window.LamiaShared.habits, B = window.LamiaShared.budget;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var el = null, week = null, draft = null;

  // Semaine à faire : la semaine en cours dès le samedi, sinon la semaine passée
  function defaultWeek(today) {
    today = today || D.today();
    var w0 = D.startOfWeek(today);
    return D.dowMon(today) >= 5 ? w0 : D.addDays(w0, -7);
  }
  // Priorités de la semaine en cours : celles choisies au bilan de la semaine d'avant
  function currentPriorities() {
    var w = D.addDays(D.startOfWeek(D.today()), -7);
    var r = S.review(w);
    return r && r.priorities.length ? r : null;
  }
  function weekLabel(w0) { return 'Semaine ' + D.isoWeek(w0) + ' · du ' + D.dayMonth(w0) + ' au ' + D.dayMonth(D.addDays(w0, 6)); }
  function eur(v) { return (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + NB + '€'; }

  /* --- 1. Les chiffres --------------------------------------------------------- */
  function numbers(w0) {
    var st = S.get(), w1 = D.addDays(w0, 6), today = D.today();
    var sum = ST.summary(st, { start: w0, end: w1 });
    var poles = ST.minutesByPole(st, w0, w1, true);
    var fl = st.categories.filter(function (c) { return c.group === 'flowline'; })[0];
    var goal = fl ? ST.goalFor(st, fl) : null;
    var moods = st.moods.filter(function (m) { return m.date >= w0 && m.date <= w1; });
    var avg = moods.length ? moods.reduce(function (a, m) { return a + m.level; }, 0) / moods.length : null;
    var hab = HB.period(S.habits().list, S.habits().log, w0, w1, today);
    var focus = L.focus ? L.focus.stats(w0, w1) : { count: 0, minutes: 0 };
    var sport = S.space('health') ? S.health().sports.filter(function (x) { return x.date >= w0 && x.date <= w1; }) : null;
    var money = S.space('budget') ? B.summary(S.budget(), w0, w1 < today ? w1 : today) : null;
    return { sum: sum, poles: poles, goal: goal, moods: moods, avg: avg, hab: hab, focus: focus, sport: sport, money: money };
  }

  function tile(emoji, label, value, sub) {
    return '<article class="rv-tile"><span class="rv-tile__icon" aria-hidden="true">' + emoji + '</span><span class="rv-tile__label">' + esc(label) + '</span>' +
      '<strong class="rv-tile__value">' + value + '</strong>' + (sub ? '<span class="rv-tile__sub">' + sub + '</span>' : '') + '</article>';
  }

  function step1(w0) {
    var n = numbers(w0), done = n.sum.done;
    var moodStrip = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = D.addDays(w0, i), m = n.moods.filter(function (x) { return x.date === d; })[0];
      return '<span class="rv-mood" title="' + esc(D.cap(D.dayMonthLong(d))) + (m ? ' : ' + esc(U.moodLabel(m.level)) : '') + '">' +
        (m ? U.pixelImg('mood-' + m.level, 2, '', U.moodLabel(m.level)) : '<span class="rv-mood__empty" aria-hidden="true"></span>') +
        '<span class="rv-mood__d" aria-hidden="true">' + D.DAYS_LETTER[D.dow(d)] + '</span></span>';
    }).join('');
    var tiles = [
      tile('✅', 'Tâches bouclées', String(done.length), done.length ? 'Bravo pour chacune' : 'Une semaine plus calme'),
      tile('⏱️', S.groupName('flowline'), D.duration(n.poles.flowline), n.goal ? 'objectif ' + D.duration(n.goal.weekly) : ''),
      tile('🎨', S.groupName('auto-entreprise'), D.duration(n.poles['auto-entreprise']), 'tes projets à côté'),
      tile('🍅', 'Focus', String(n.focus.count), n.focus.count ? D.duration(n.focus.minutes) + ' de concentration' : 'sessions de concentration'),
      tile('🌱', 'Habitudes', n.hab.pct == null ? '—' : n.hab.pct + NB + '%', n.hab.planned ? n.hab.done + ' cases sur ' + n.hab.planned : 'pas encore d’habitude')
    ];
    if (n.sport) tiles.push(tile('🏃', 'Sport', D.duration(n.sport.reduce(function (a, x) { return a + x.minutes; }, 0)), U.plural(n.sport.length, 'séance')));
    if (n.money) tiles.push(tile('💶', 'Dépensé', eur(n.money.expenses), n.money.byCategory[0] ? 'surtout ' + esc(n.money.byCategory[0].category) : ''));
    var prev = S.review(D.addDays(w0, -7));
    return '<section class="glass card rv-step" aria-labelledby="rv-1"><div class="card__header"><div><p class="rv-step__n">Étape 1 sur 4</p><h2 class="card__title" id="rv-1">Ta semaine en chiffres</h2>' +
        '<p class="card__subtitle">On regarde, sans juger : chaque semaine a sa couleur.</p></div></div>' +
      '<div class="rv-tiles">' + tiles.join('') + '</div>' +
      '<div class="rv-row"><div class="rv-moods"><h3 class="rv-h">Ton humeur</h3><div class="rv-moods__strip">' + moodStrip + '</div>' +
        '<p class="hint">' + (n.avg == null ? 'Pas d’humeur notée cette semaine.' : 'En moyenne : ' + esc(U.moodLabel(Math.round(n.avg)).toLowerCase()) + '.') + '</p></div>' +
      (done.length ? '<div class="rv-done"><h3 class="rv-h">Ce que tu as bouclé</h3><ul class="rv-list" role="list">' + done.slice(0, 8).map(function (t) {
        return '<li>' + U.catDot(S.category(t.categoryId)) + '<span>' + esc(t.title) + '</span></li>';
      }).join('') + (done.length > 8 ? '<li class="text-subtle">et ' + (done.length - 8) + ' autre' + (done.length - 8 > 1 ? 's' : '') + '…</li>' : '') + '</ul></div>' : '') +
      (prev && prev.priorities.length ? '<div class="rv-prev"><h3 class="rv-h">Tes priorités de cette semaine</h3><ul class="prio-list" role="list">' + prev.priorities.map(function (p) { return prioRow(prev.week, p); }).join('') + '</ul></div>' : '') +
      '</div></section>';
  }

  /* --- 2. Fiertés ----------------------------------------------------------------- */
  function step2() {
    return '<section class="glass card rv-step" aria-labelledby="rv-2"><div class="card__header"><div><p class="rv-step__n">Étape 2 sur 4</p><h2 class="card__title" id="rv-2">Ce que tu retiens</h2>' +
        '<p class="card__subtitle">Quelques mots suffisent. Tu les relis quand tu veux.</p></div></div>' +
      '<div class="form-grid">' +
        '<div class="field field--full"><label class="label" for="rv-proud">Ce dont tu es fière cette semaine</label>' +
        '<textarea class="textarea" id="rv-proud" name="proud" rows="3" maxlength="1000" data-rv="proud" placeholder="Un rendu validé du premier coup, une séance de sport, une soirée rien que pour toi…">' + esc(draft.proud) + '</textarea></div>' +
        '<div class="field field--full"><label class="label" for="rv-lesson">Ce que tu ferais autrement <span class="text-subtle">facultatif</span></label>' +
        '<textarea class="textarea" id="rv-lesson" name="lesson" rows="2" maxlength="1000" data-rv="lesson" placeholder="Bloquer un créneau pour les retours clients, me coucher plus tôt…">' + esc(draft.lesson) + '</textarea></div>' +
      '</div></section>';
  }

  /* --- 3. La semaine suivante --------------------------------------------------------- */
  function step3(w0) {
    var n0 = D.addDays(w0, 7), n1 = D.addDays(w0, 13), st = S.get();
    var due = ST.dueBetween(st, n0, n1), late = ST.overdue(st);
    var events = L.calendar ? L.calendar.between(n0, n1) : [];
    return '<section class="glass card rv-step" aria-labelledby="rv-3"><div class="card__header"><div><p class="rv-step__n">Étape 3 sur 4</p><h2 class="card__title" id="rv-3">La semaine prochaine</h2>' +
        '<p class="card__subtitle">' + esc(weekLabel(n0)) + '</p></div></div>' +
      '<div class="rv-row">' +
        '<div><h3 class="rv-h">Échéances</h3>' + (due.length ? '<ul class="rv-list" role="list">' + due.slice(0, 8).map(function (t) {
          return '<li>' + U.catDot(S.category(t.categoryId)) + '<span>' + esc(t.title) + '</span><span class="text-subtle">' + esc(D.cap(D.DAYS_SHORT[D.dow(t.endDate)])) + ' ' + +t.endDate.slice(8) + '</span></li>';
        }).join('') + '</ul>' : '<p class="hint">Aucune échéance : une semaine pour avancer à ton rythme.</p>') +
        (late.length ? '<p class="rv-note">' + icon('refresh') + U.plural(late.length, 'tâche') + ' à replanifier : pense à leur donner une nouvelle date.</p>' : '') + '</div>' +
        (events.length ? '<div><h3 class="rv-h">Rendez-vous</h3><ul class="rv-list" role="list">' + events.filter(function (e) { return !e.multi || e.first; }).slice(0, 8).map(function (e) {
          return '<li><span class="rv-ev-day">' + esc(D.cap(D.DAYS_SHORT[D.dow(e.date)])) + ' ' + +e.date.slice(8) + '</span><span>' + esc(e.title) + '</span><span class="text-subtle">' + (e.time ? esc(e.time.replace(':', 'h')) : 'journée') + '</span></li>';
        }).join('') + '</ul></div>' : '') +
      '</div></section>';
  }

  /* --- 4. Les 3 priorités ----------------------------------------------------------------- */
  function suggestions(w0) {
    var n0 = D.addDays(w0, 7), n1 = D.addDays(w0, 13), st = S.get(), seen = {};
    var used = draft.priorities.map(function (p) { return (p.text || '').toLowerCase(); });
    var list = ST.dueBetween(st, n0, n1).concat(st.tasks.filter(function (t) { return t.status === 'doing' && (t.priority === 'high' || t.priority === 'urgent'); }), ST.overdue(st), st.tasks.filter(function (t) { return t.status === 'doing'; }));
    return list.filter(function (t) { if (seen[t.id] || used.indexOf(t.title.toLowerCase()) >= 0) return false; seen[t.id] = 1; return true; }).slice(0, 6);
  }
  function step4(w0) {
    var sug = suggestions(w0);
    var titles = S.get().tasks.filter(function (t) { return t.status !== 'done'; }).map(function (t) { return '<option value="' + esc(t.title) + '">'; }).join('');
    return '<section class="glass card rv-step" aria-labelledby="rv-4"><div class="card__header"><div><p class="rv-step__n">Étape 4 sur 4</p><h2 class="card__title" id="rv-4">Tes 3 priorités</h2>' +
        '<p class="card__subtitle">Pas plus de trois : ce sont elles qui comptent. Tu les retrouveras sur l’Accueil.</p></div></div>' +
      '<ol class="rv-prios">' + [0, 1, 2].map(function (i) {
        var p = draft.priorities[i] || {};
        return '<li><label class="sr-only" for="rv-p' + i + '">Priorité ' + (i + 1) + '</label><input class="input" id="rv-p' + i + '" data-rv-prio="' + i + '" list="rv-tasks" maxlength="120" value="' + esc(p.text || '') + '" placeholder="' + ['ex. Livrer la maquette Kinéo', 'ex. 2 séances de sport', 'ex. Avancer le carnet le samedi'][i] + '">' +
          (p.taskId && S.task(p.taskId) ? '<span class="rv-linked" title="Reliée à la tâche">' + icon('tasks') + '</span>' : '') + '</li>';
      }).join('') + '</ol><datalist id="rv-tasks">' + titles + '</datalist>' +
      (sug.length ? '<div class="hab-ideas"><p class="hab-ideas__label">Idées à partir de tes tâches</p><div class="hab-ideas__list">' + sug.map(function (t) {
        return '<button type="button" class="chip-btn" data-rv-sug="' + t.id + '">' + U.catDot(S.category(t.categoryId)) + esc(t.title) + '</button>';
      }).join('') + '</div></div>' : '') +
      '<div class="rv-save"><button type="button" class="btn btn--primary" data-rv-save>' + icon('check') + (S.review(w0) ? 'Mettre à jour mon bilan' : 'Enregistrer mon bilan') + '</button>' +
        (S.review(w0) && S.review(w0).savedAt ? '<span class="hint">Enregistré le ' + esc(D.dayMonthLong(S.review(w0).savedAt.slice(0, 10))) + '</span>' : '') + '</div>' +
      '</section>';
  }

  function prioRow(wk, p) {
    var t = p.taskId && S.task(p.taskId);
    return '<li class="prio-item' + (p.done ? ' is-done' : '') + '"><button type="button" class="hab-check hab-check--sm' + (p.done ? ' is-done' : '') + '" data-prio-done="' + p.id + '" data-week="' + wk + '" data-focus-key="prio-' + p.id + '" aria-pressed="' + p.done + '" aria-label="' + esc(p.text) + (p.done ? ', faite' : ', à faire') + '">' + icon('check') + '</button>' +
      '<span class="prio-item__text">' + esc(p.text) + '</span>' + (t ? '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-open-task="' + t.id + '" aria-label="Ouvrir la tâche « ' + esc(t.title) + ' »">' + icon('eye') + '</button>' : '') + '</li>';
  }

  /* --- Historique ------------------------------------------------------------------------------ */
  function history() {
    var list = S.reviews().slice().reverse().filter(function (r) { return r.week !== week; });
    if (!list.length) return '';
    return '<section class="glass card" aria-labelledby="rv-h"><div class="card__header"><div><h2 class="card__title" id="rv-h">Tes bilans précédents</h2><p class="card__subtitle">' + U.plural(S.reviews().length, 'bilan') + '</p></div></div>' +
      '<ul class="rv-hist" role="list">' + list.slice(0, 12).map(function (r) {
        var d = r.priorities.filter(function (p) { return p.done; }).length;
        return '<li><button type="button" class="rv-hist__item" data-rv-week="' + r.week + '"><strong>' + esc(weekLabel(r.week)) + '</strong>' +
          '<span class="text-subtle">' + (r.priorities.length ? d + '/' + r.priorities.length + ' priorités tenues' : 'Sans priorités') + (r.proud ? ' · « ' + esc(r.proud.length > 70 ? r.proud.slice(0, 70) + '…' : r.proud) + ' »' : '') + '</span>' + icon('chevron-right') + '</button></li>';
      }).join('') + '</ul></section>';
  }

  /* --- Vue ------------------------------------------------------------------------------------- */
  function loadDraft() {
    var r = S.review(week);
    draft = r ? { proud: r.proud, lesson: r.lesson, priorities: r.priorities.map(function (p) { return { id: p.id, text: p.text, taskId: p.taskId, done: p.done }; }) }
      : { proud: '', lesson: '', priorities: [] };
    draft.week = week;
  }
  function render() {
    if (!el) return;
    var today = D.today(), max = defaultWeek(today);
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Accueil</p><h1 class="h1" id="h-review" tabindex="-1">Bilan du dimanche</h1>' +
        '<p class="page-head__lead">Dix minutes pour regarder ta semaine avec douceur et choisir tes trois priorités.</p></div>' +
        '<div class="page-head__actions rv-weeknav"><button type="button" class="btn btn--ghost btn--icon" data-rv-shift="-7" aria-label="Semaine précédente">' + icon('chevron-left') + '</button>' +
          '<span class="rv-weeknav__label">' + esc(weekLabel(week)) + (S.review(week) ? ' <span class="chip chip--done">Fait</span>' : '') + '</span>' +
          '<button type="button" class="btn btn--ghost btn--icon" data-rv-shift="7" aria-label="Semaine suivante"' + (week >= max ? ' disabled' : '') + '>' + icon('chevron-right') + '</button></div></header>' +
      '<div class="rv-steps">' + step1(week) + step2() + step3(week) + step4(week) + '</div>' + history();
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  function save() {
    var prev = S.review(week);
    var r = S.saveReview({ week: week, savedAt: new Date().toISOString(), proud: draft.proud.trim(), lesson: draft.lesson.trim(), priorities: draft.priorities });
    loadDraft();
    if (!prev) L.fun.celebrate({ title: 'Bilan enregistré !', text: r.priorities.length ? 'Tes ' + U.plural(r.priorities.length, 'priorité') + ' t’attendent sur l’Accueil.' : 'Belle semaine à toi.' });
    else U.toast({ kind: 'success', icon: 'check', title: 'Bilan mis à jour', duration: 3000 });
  }

  function mount(node) {
    el = node;
    el.addEventListener('input', function (e) {
      var f = e.target;
      if (f.hasAttribute('data-rv')) draft[f.getAttribute('data-rv')] = f.value;
      if (f.hasAttribute('data-rv-prio')) {
        var i = +f.getAttribute('data-rv-prio'), t = S.get().tasks.filter(function (x) { return x.title === f.value.trim(); })[0];
        while (draft.priorities.length <= i) draft.priorities.push({ text: '' });
        draft.priorities[i] = Object.assign({}, draft.priorities[i], { text: f.value, taskId: t ? t.id : null });
      }
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-rv-shift]'))) { week = D.addDays(week, +b.getAttribute('data-rv-shift')); loadDraft(); render(); return; }
      if ((b = e.target.closest('[data-rv-week]'))) { week = b.getAttribute('data-rv-week'); loadDraft(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if ((b = e.target.closest('[data-rv-sug]'))) {
        var t = S.task(b.getAttribute('data-rv-sug'));
        var i = [0, 1, 2].filter(function (k) { return !(draft.priorities[k] && draft.priorities[k].text && draft.priorities[k].text.trim()); })[0];
        if (!t) return;
        if (i == null) { U.toast({ icon: 'info', title: 'Trois priorités, pas plus', text: 'Vide une case pour en choisir une autre.', duration: 3500 }); return; }
        while (draft.priorities.length <= i) draft.priorities.push({ text: '' });
        draft.priorities[i] = { text: t.title, taskId: t.id };
        render();
        return;
      }
      if (e.target.closest('[data-rv-save]')) save();
    });
    S.subscribe(function (type) {
      if (['review', 'reset', 'task:update', 'task:move', 'calendar-events'].indexOf(type) < 0) return;
      if (L.app.view() !== 'review') { el.dataset.stale = '1'; return; }
      if (type === 'review' || type === 'reset') render();
    });
  }

  // Priorités cochées (Accueil et bilan)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-prio-done]');
    if (!b) return;
    var r = S.review(b.getAttribute('data-week')), id = b.getAttribute('data-prio-done');
    var p = r && r.priorities.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    S.setPriorityDone(r.week, id, !p.done);
    if (!p.done) return;
    var all = r.priorities.every(function (x) { return x.done; });
    if (all) L.fun.celebrate({ title: 'Les 3 priorités sont faites !', text: 'Ta semaine est déjà réussie.' });
    if (el && L.app.view() === 'review') render();
  });

  /* --- Carte de l'Accueil ----------------------------------------------------------------------- */
  function cardHTML() {
    var today = D.today(), r = currentPriorities(), todo = defaultWeek(today), dow = D.dowMon(today);
    var askNow = !S.review(todo) && (dow >= 5 || dow === 0);
    if (!r && !askNow) {
      return '<section class="glass card life-card" aria-labelledby="dh-prio"><div class="card__header"><div><h2 class="card__title" id="dh-prio">🎯 Priorités de la semaine</h2><p class="card__subtitle">Elles se choisissent au bilan du dimanche</p></div></div>' +
        '<p class="life-card__muted">Dimanche, prends dix minutes pour faire le point et choisir tes trois priorités.</p>' +
        '<a class="btn btn--ghost btn--sm life-card__more" href="#bilan">Découvrir le bilan' + icon('chevron-right') + '</a></section>';
    }
    return '<section class="glass card life-card' + (askNow ? ' life-card--ask' : '') + '" aria-labelledby="dh-prio"><div class="card__header"><div><h2 class="card__title" id="dh-prio">🎯 Priorités de la semaine</h2>' +
        '<p class="card__subtitle">' + (r ? r.priorities.filter(function (p) { return p.done; }).length + ' sur ' + r.priorities.length + ' faites' : 'À choisir') + '</p></div>' +
        (r ? '<a class="btn btn--ghost btn--sm" href="#bilan">Bilan' + icon('chevron-right') + '</a>' : '') + '</div>' +
      (r ? '<ul class="prio-list" role="list">' + r.priorities.map(function (p) { return prioRow(r.week, p); }).join('') + '</ul>' : '') +
      (askNow ? '<div class="rv-ask"><p>' + (dow === 6 ? 'C’est dimanche' : dow === 5 ? 'C’est le week-end' : 'Nouvelle semaine') + ' : dix minutes pour ton bilan ?</p><a class="btn btn--primary btn--sm" href="#bilan">' + icon('note') + 'Faire mon bilan</a></div>' : '') +
      '</section>';
  }

  L.reviewUI = { cardHTML: cardHTML, defaultWeek: defaultWeek };
  L.views = L.views || {};
  L.views.review = {
    title: 'Bilan du dimanche', mount: mount, render: render,
    show: function () { if (!week) week = defaultWeek(); if (!draft || draft.week !== week) loadDraft(); delete el.dataset.stale; render(); }
  };
})(window.Lamia = window.Lamia || {});
