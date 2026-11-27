/* ==========================================================================
   Plateforme de suivi - Lamia — badges et étapes
   Les badges se gagnent tout seuls, à partir des données (shared/badges.js).
   Un nouveau badge : une petite fête discrète.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, BD = window.LamiaShared.badges;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var el = null, checkTimer = null;

  function list() { return BD.compute(S.get(), { today: D.today(), spaces: S.get().settings.spaces }); }
  function count(l) { return (l || list()).filter(function (b) { return b.got; }).length; }
  /* --- Nouveaux badges ------------------------------------------------------------ */
  function check() {
    var at = S.badgesAt(), l = list();
    var fresh = l.filter(function (b) { return b.got && !at[b.id]; });
    if (!fresh.length) return;
    var first = !Object.keys(at).length;
    S.markBadges(fresh.map(function (b) { return b.id; }));
    if (first && fresh.length > 1) return;            // premier lancement : rien à fêter d'un coup
    var b = fresh[0];
    L.fun.celebrate({ title: 'Nouveau badge : ' + b.title, text: fresh.length > 1 ? 'et ' + U.plural(fresh.length - 1, 'autre') + ' !' : b.desc + '.', duration: 4200 });
  }
  function scheduleCheck() { clearTimeout(checkTimer); checkTimer = setTimeout(check, 900); }

  /* --- Vue --------------------------------------------------------------------------- */
  function render() {
    if (!el) return;
    var l = list(), n = count(l), at = S.badgesAt();
    var got = l.filter(function (b) { return b.got; }).sort(function (a, b) { return (at[b.id] || '') < (at[a.id] || '') ? -1 : 1; });
    var todo = l.filter(function (b) { return !b.got; }).sort(function (a, b) { return b.pct - a.pct; });
    function badge(b) {
      return '<li class="badge-card' + (b.got ? ' is-got' : '') + '"><span class="badge-card__icon" aria-hidden="true">' + U.px(b.icon, 3) + '</span>' +
        '<span class="badge-card__title">' + esc(b.title) + '</span><span class="badge-card__desc">' + esc(b.desc) + '</span>' +
        (b.got ? '<span class="badge-card__when">' + icon('check') + (at[b.id] ? 'Gagné le ' + esc(D.dayMonth(at[b.id])) : 'Gagné') + '</span>'
          : '<span class="badge-card__prog">' + U.progress(b.pct, 'progress--sm') + '<span class="num">' + b.value + '/' + b.target + '</span></span>') + '</li>';
    }
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Accueil</p><h1 class="h1" id="h-badges" tabindex="-1">Badges et étapes</h1>' +
        '<p class="page-head__lead">Ils se gagnent tout seuls, au fil de tes journées : tâches bouclées, habitudes tenues, bilans, épargne…</p></div></header>' +
      '<section class="glass card badge-sum" aria-label="Progression"><div class="badge-sum__n"><strong class="num">' + n + '</strong><span>sur ' + l.length + ' badges</span></div>' +
        '<div class="badge-sum__bar">' + U.progress(Math.round(n / l.length * 100), '') +
        (n === l.length ? '<p class="hint">Tous les badges sont gagnés. Quelle collection !</p>' : '') + '</div></section>' +
      (got.length ? '<section aria-labelledby="bd-got"><h2 class="dash-section" id="bd-got">' + icon('sparkle') + 'Gagnés</h2><ul class="badge-grid" role="list">' + got.map(badge).join('') + '</ul></section>' : '') +
      (todo.length ? '<section aria-labelledby="bd-todo"><h2 class="dash-section" id="bd-todo">' + icon('target') + 'À venir</h2><ul class="badge-grid" role="list">' + todo.map(badge).join('') + '</ul></section>' : '');
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  function mount(node) {
    el = node;
    S.subscribe(function (type) {
      if (type === 'ui' || type === 'timer' || type === 'badges') { if (type === 'badges' && L.app.view() === 'badges') render(); return; }
      scheduleCheck();
      if (type === 'reset' || type === 'profile') {
        if (L.app.view() === 'badges') render(); else el.dataset.stale = '1';
      }
    });
    setTimeout(check, 1500);
  }

  // Carte compacte de l'Accueil
  function cardHTML() {
    var l = list(), n = count(l);
    var close = l.filter(function (b) { return !b.got; }).sort(function (a, b) { return b.pct - a.pct; })[0];
    return '<section class="glass card life-card" aria-labelledby="dh-badges"><div class="card__header"><div><h2 class="card__title" id="dh-badges">' + U.px('medal', 2) + 'Badges</h2>' +
      '<p class="card__subtitle">' + n + ' sur ' + l.length + ' gagnés</p></div><a class="btn btn--ghost btn--sm" href="#badges">Voir' + icon('chevron-right') + '</a></div>' +
      U.progress(Math.round(n / l.length * 100), 'progress--sm') +
      (close ? '<p class="life-chip">' + U.px(close.icon) + ' Bientôt : ' + esc(close.title) + ' · ' + close.value + '/' + close.target + '</p>' : '') + '</section>';
  }

  L.badgesUI = { list: list, count: count, check: check, cardHTML: cardHTML };
  L.views = L.views || {};
  L.views.badges = { title: 'Badges', mount: mount, render: render, show: function () { delete el.dataset.stale; render(); } };
})(window.Lamia = window.Lamia || {});
