/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · Planning
   Timeline type Gantt : barres du début à la fin, regroupées par catégorie,
   avancement à l'intérieur, repère « aujourd'hui », zoom semaine / mois,
   navigation, week-ends teintés. Sur mobile : liste chronologique.
   Une tâche en retard se signale par un fil pointillé jusqu'à aujourd'hui
   et la mention « à replanifier », sans couleur alarmante.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q;
  var esc = U.esc, icon = U.icon, NB = D.NBSP;
  var el = null;

  function span(t) {
    if (!t.startDate && !t.endDate) return null;
    var a = t.startDate || t.endDate, b = t.endDate || t.startDate;
    return a <= b ? [a, b] : [b, a];
  }

  function groups(p) {
    var st = S.get();
    return st.categories.map(function (c) {
      var list = st.tasks.filter(function (t) {
        var s = span(t);
        if (t.categoryId !== c.id || !s) return false;
        var lateEnd = Q.isOverdue(t) ? D.today() : s[1];
        return s[0] <= p.end && D.max(s[1], lateEnd) >= p.start;
      }).sort(function (x, y) { var a = span(x)[0], b = span(y)[0]; return a < b ? -1 : a > b ? 1 : x.title.localeCompare(y.title, 'fr'); });
      return { cat: c, tasks: list };
    }).filter(function (g) { return g.tasks.length; });
  }

  function pct(n, total) { return (n / total * 100).toFixed(4) + '%'; }

  function ganttHTML(p) {
    var days = p.days, n = days.length;
    var today = D.today();
    var ti = days.indexOf(today);
    var zoom = p.kind;
    // Week-ends teintés : un dégradé calculé pour la période (tokens uniquement)
    var weekendBg = 'linear-gradient(90deg,' + days.map(function (d, i) {
      return (D.isWeekend(d) ? 'var(--gantt-weekend)' : 'transparent') + ' ' + pct(i, n) + ' ' + pct(i + 1, n);
    }).join(',') + ')';

    var head = '<div class="gantt__row gantt__row--head" aria-hidden="true"><div class="gantt__label gantt__label--head">Tâches</div>' +
      '<div class="gantt__track gantt__days">' + days.map(function (d) {
        var dd = D.parse(d);
        return '<span class="gantt__day' + (D.isWeekend(d) ? ' is-weekend' : '') + (d === today ? ' is-today' : '') + '">' +
          '<span class="gantt__dow">' + (zoom === 'week' ? D.cap(D.DAYS_SHORT[dd.getDay()]) : D.DAYS_LETTER[dd.getDay()]) + '</span><span class="gantt__num num">' + dd.getDate() + '</span></span>';
      }).join('') + '</div></div>';

    var gs = groups(p);
    var body = gs.map(function (g) {
      var rows = g.tasks.map(function (t) {
        var s = span(t);
        var a = Math.max(0, D.diff(p.start, s[0]));
        var b = Math.min(n - 1, D.diff(p.start, s[1]));
        var clippedL = s[0] < p.start, clippedR = s[1] > p.end;
        var late = Q.isOverdue(t);
        var visible = s[1] >= p.start && s[0] <= p.end;
        var bar = '';
        var aria = t.title + ', du ' + D.dayMonthLong(s[0]) + ' au ' + D.dayMonthLong(s[1]) + ', ' + t.progress + ' %' + (late ? ', à replanifier' : '') + (t.status === 'done' ? ', terminée' : '');
        if (visible) {
          bar = '<button type="button" class="gantt__bar ' + U.hue(g.cat) + (t.status === 'done' ? ' is-done' : '') + (late ? ' is-late' : '') + (clippedL ? ' is-clip-l' : '') + (clippedR ? ' is-clip-r' : '') + '" ' +
            'style="--l:' + pct(a, n) + ';--w:' + pct(b - a + 1, n) + ';--value:' + t.progress + '" data-open-task="' + t.id + '" data-focus-key="bar-' + t.id + '" aria-label="' + esc(aria) + '">' +
            '<span class="gantt__bar-label">' + (t.status === 'done' ? icon('check') : '') + esc(t.title) + '</span><span class="gantt__bar-pct num">' + t.progress + NB + '%</span>' +
            '<span class="gantt__bar-fill" aria-hidden="true"></span></button>';
        }
        // Glissement : du lendemain de l'échéance jusqu'à aujourd'hui
        if (late) {
          var sa = Math.max(0, D.diff(p.start, D.addDays(s[1], 1)));
          var sb = Math.min(n - 1, D.diff(p.start, today));
          if (sb >= sa && sa <= n - 1 && sb >= 0) bar += '<span class="gantt__slip ' + U.hue(g.cat) + '" style="--l:' + pct(sa, n) + ';--w:' + pct(sb - sa + 1, n) + '" aria-hidden="true"></span>';
          if (!visible) bar += '<button type="button" class="gantt__ghost" style="--l:' + pct(Math.max(0, sb), n) + ';--w:' + pct(1, n) + '" data-open-task="' + t.id + '" aria-label="' + esc(aria) + '">' + icon('refresh') + '</button>';
        }
        return '<li class="gantt__row"><div class="gantt__label">' +
          '<button type="button" class="gantt__title" data-open-task="' + t.id + '" tabindex="-1">' + esc(t.title) + '</button>' +
          '<span class="gantt__meta">' + esc(D.dayMonth(s[0])) + ' → ' + esc(D.dayMonth(s[1])) + (late ? ' · <span class="gantt__late">' + icon('refresh') + 'à replanifier</span>' : '') + '</span></div>' +
          '<div class="gantt__track">' + bar + '</div></li>';
      }).join('');
      return '<section class="gantt__group" aria-label="' + esc(g.cat.name + ', ' + U.plural(g.tasks.length, 'tâche')) + '">' +
        '<div class="gantt__row gantt__row--group"><div class="gantt__label gantt__label--group">' + U.catChip(g.cat) + '<span class="gantt__count">' + U.plural(g.tasks.length, 'tâche') + '</span></div><div class="gantt__track" aria-hidden="true"></div></div>' +
        '<ul class="gantt__rows" role="list">' + rows + '</ul></section>';
    }).join('');

    var todayLine = ti >= 0 ? '<div class="gantt__today" style="--x:' + ((ti + 0.5) / n).toFixed(5) + '" aria-hidden="true"></div>' : '';

    return '<div class="gantt gantt--' + zoom + '" style="--days:' + n + ';--weekend-bg:' + weekendBg + '">' +
      '<div class="gantt__scroll"><div class="gantt__inner" aria-label="Planning, ' + esc(p.label) + '">' + head +
        '<div class="gantt__body">' + todayLine + (body || '<div class="gantt__empty">' + emptyHTML() + '</div>') + '</div>' +
      '</div></div></div>';
  }

  function emptyHTML() {
    return '<div class="empty-state"><div class="empty-state__art">' + icon('planning') + '</div><p class="empty-state__title">Rien de prévu sur cette période</p>' +
      '<p class="empty-state__text">Une page blanche, c’est aussi de la place pour respirer.</p></div>';
  }

  function listHTML(p) {
    var gs = groups(p);
    var items = [];
    gs.forEach(function (g) { g.tasks.forEach(function (t) { items.push({ t: t, c: g.cat, s: span(t) }); }); });
    items.sort(function (x, y) { return x.s[0] < y.s[0] ? -1 : x.s[0] > y.s[0] ? 1 : 0; });
    if (!items.length) return emptyHTML();
    var weeks = {};
    var order = [];
    items.forEach(function (it) {
      var w = it.s[0] < p.start ? 'before' : D.startOfWeek(it.s[0]);
      if (!weeks[w]) { weeks[w] = []; order.push(w); }
      weeks[w].push(it);
    });
    return order.map(function (w) {
      var label = w === 'before' ? 'Déjà en route' : w === D.startOfWeek(D.today()) ? 'Cette semaine' : 'Semaine du ' + D.dayMonth(w);
      return '<section class="plan-week"><h3 class="plan-week__title">' + esc(label) + '</h3><ul class="plan-list" role="list">' +
        weeks[w].map(function (it) {
          var t = it.t, late = Q.isOverdue(t);
          return '<li><button type="button" class="glass plan-item ' + U.hue(it.c) + (t.status === 'done' ? ' is-done' : '') + '" data-open-task="' + t.id + '">' +
            '<span class="plan-item__bar" aria-hidden="true"></span>' +
            '<span class="plan-item__body"><span class="plan-item__dates">' + esc(D.dayMonth(it.s[0])) + ' → ' + esc(D.dayMonth(it.s[1])) + (late ? ' · <span class="gantt__late">' + icon('refresh') + 'à replanifier</span>' : '') + '</span>' +
            '<span class="plan-item__title">' + esc(t.title) + '</span>' +
            '<span class="plan-item__meta">' + U.catChip(it.c) + '<span class="plan-item__pct num">' + t.progress + NB + '%</span></span>' +
            U.progress(t.progress, 'progress--sm progress--hue ' + U.hue(it.c)) + '</span></button></li>';
        }).join('') + '</ul></section>';
    }).join('');
  }

  function render() {
    if (!el) return;
    var ui = S.get().settings.ui;
    var zoom = ui.planningZoom || 'month';
    var p = D.period(zoom, ui.planningAnchor || D.today());
    var isNow = D.between(D.today(), p.start, p.end);
    var unplanned = S.get().tasks.filter(function (t) { return !span(t) && t.status !== 'done'; });
    var legend = S.get().categories.map(function (c) { return '<span class="legend__item">' + U.catDot(c) + esc(c.name) + '</span>'; }).join('');
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Du début à la fin, en un coup d’œil</p>' +
        '<h1 class="h1" id="h-planning" tabindex="-1">Planning</h1></div>' +
        '<div class="page-head__actions"><div class="segmented" role="group" aria-label="Zoom du planning">' +
          '<button type="button" class="segmented__item" data-zoom="week" data-focus-key="z-week" aria-pressed="' + (zoom === 'week') + '">Semaine</button>' +
          '<button type="button" class="segmented__item" data-zoom="month" data-focus-key="z-month" aria-pressed="' + (zoom === 'month') + '">Mois</button></div></div></header>' +
      '<div class="period-bar">' +
        '<div class="period-nav">' +
          '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-plan-nav="-1" data-focus-key="pn-prev" aria-label="' + (zoom === 'week' ? 'Semaine précédente' : 'Mois précédent') + '">' + icon('chevron-left') + '</button>' +
          '<button type="button" class="btn btn--secondary btn--sm" data-plan-today data-focus-key="pn-today"' + (isNow ? ' aria-disabled="true"' : '') + '>Aujourd’hui</button>' +
          '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-plan-nav="1" data-focus-key="pn-next" aria-label="' + (zoom === 'week' ? 'Semaine suivante' : 'Mois suivant') + '">' + icon('chevron-right') + '</button>' +
        '</div>' +
        '<h2 class="period-bar__label" aria-live="polite">' + esc(p.label) + '</h2>' +
        '<div class="legend" aria-label="Légende">' + legend + '<span class="legend__item legend__item--late"><span class="legend__slip" aria-hidden="true"></span>à replanifier</span></div>' +
      '</div>' +
      '<section class="glass card gantt-card" aria-label="Timeline">' + ganttHTML(p) + '</section>' +
      '<section class="plan-mobile" aria-label="Planning en liste">' + listHTML(p) + '</section>' +
      '<section class="glass card unplanned" aria-labelledby="h-unplanned"><div class="card__header"><div><h2 class="card__title" id="h-unplanned">Non planifiées</h2>' +
        '<p class="card__subtitle">Sans date de début ni de fin : elles attendent leur moment.</p></div></div>' +
        (unplanned.length ? '<ul class="unplanned__list" role="list">' + unplanned.map(function (t) {
          var c = S.category(t.categoryId);
          return '<li><button type="button" class="glass glass--nested glass--interactive unplanned__item" data-open-task="' + t.id + '">' + U.catDot(c) + '<span>' + esc(t.title) + '</span>' + icon('calendar') + '<span class="sr-only">Ajouter des dates</span></button></li>';
        }).join('') + '</ul>' : '<p class="empty-line">Tout est daté. Bel ordre !</p>') +
      '</section>';
    U.keepFocus(el, function () { el.innerHTML = html; });
    U.typo(el);
    // Centre « aujourd'hui » quand la timeline défile (mois sur petit écran)
    var sc = el.querySelector('.gantt__scroll');
    var line = el.querySelector('.gantt__today');
    if (sc && line && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = Math.max(0, line.offsetLeft - sc.clientWidth / 2);
  }

  function mount(node) {
    el = node;
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-zoom]'))) { S.setUI({ planningZoom: b.getAttribute('data-zoom') }); return; }
      if ((b = e.target.closest('[data-plan-nav]'))) {
        var ui = S.get().settings.ui;
        S.setUI({ planningAnchor: D.shift(ui.planningZoom, ui.planningAnchor || D.today(), +b.getAttribute('data-plan-nav')) });
        return;
      }
      if (e.target.closest('[data-plan-today]')) { S.setUI({ planningAnchor: D.today() }); }
    });
    S.subscribe(function (type, d) {
      if (L.app.view() !== 'planning') { el.dataset.stale = '1'; return; }
      if (type === 'ui' && !('planningZoom' in d || 'planningAnchor' in d)) return;
      if (type === 'mood' || type === 'timer') return;
      render();
    });
  }

  function show() { if (!el.firstChild || el.dataset.stale) { delete el.dataset.stale; render(); } }

  L.views = L.views || {};
  L.views.planning = { mount: mount, render: render, show: show, title: 'Planning' };
})(window.Lamia = window.Lamia || {});
