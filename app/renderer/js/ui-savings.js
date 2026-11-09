/* ==========================================================================
   Plateforme de suivi - Lamia — Budget · Épargne mois par mois
   Un seul tableau, simple à lire :
   - les mois passés et le mois en cours : ce que tu as vraiment mis de côté
     et retiré (modifiable sur place) ;
   - les mois à venir : ta prévision (le montant prévu par défaut, ou ce que tu
     tapes pour un mois précis) ;
   - le solde, qui s'additionne de mois en mois.
   Au-dessus : le solde du jour, la prévision dans 6 / 12 / 24 mois, un objectif
   facultatif (« atteint en mai 2027 ») et le graphique du solde.
   Calculs : shared/budget.js (savingsMonths).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, BG = window.LamiaShared.budget;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var el = null, horizon = 12;
  var SAVINGS_GOAL = 'Épargne';

  function B() { return S.budget(); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[\s  €]/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; }
  function money(v) { var r = Math.round(v * 100) / 100; return r.toLocaleString('fr-FR', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function edit(v) { if (v == null || v === 0) return ''; var r = Math.round(v * 100) / 100; return (r % 1 ? r.toFixed(2) : String(r)).replace('.', ','); }
  function monthName(r) { return D.cap(D.monthYear(B().startDay === 1 ? r.start : r.end)); }
  function shortMonth(r) { var d = D.parse(B().startDay === 1 ? r.start : r.end); return D.MONTHS_SHORT[d.getMonth()] + (d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : ''); }
  function warn(text) { U.toast({ kind: 'warning', icon: 'alert', title: 'À vérifier', text: text, duration: 4000 }); }

  /* --- Mois passés : ajuster le réel ----------------------------------------------------- */
  // Un versement (ou un retrait) « du mois » est ajusté pour que le total du mois
  // corresponde au montant saisi ; les autres versements du mois ne bougent pas.
  function setActual(r, field, total) {
    var b = B(), out = field === 'out', flag = out ? 'monthlyOut' : 'monthly';
    var goal = b.goals.filter(function (g) { return g.name === SAVINGS_GOAL; })[0] || b.goals[0];
    if (!goal) goal = S.addBudget('goals', { name: SAVINGS_GOAL });
    var mine = b.deposits.filter(function (x) { return x[flag] && x.date === r.start; })[0];
    var others = (out ? r.removed : r.added) - (mine ? Math.abs(mine.amount) : 0);
    var want = Math.round((total - others) * 100) / 100;
    if (want < 0) { warn('Ce mois-là, ' + money(others) + ' € sont déjà ' + (out ? 'retirés' : 'mis de côté') + ' par ailleurs (versements automatiques, cagnottes).'); render(); return; }
    var amount = out ? -want : want, patch = {};
    if (mine) { if (want) { patch.amount = amount; S.updateBudget('deposits', mine.id, patch); } else S.removeBudget('deposits', mine.id); }
    else if (want) { var dep = { goalId: goal.id, date: r.start, amount: amount }; dep[flag] = true; S.addBudget('deposits', dep); }
  }

  /* --- Rendu -------------------------------------------------------------------------------- */
  function render() {
    if (!el) return;
    var b = B(), fc = b.forecast || {}, sm = BG.savingsMonths(b, { months: horizon });
    var rows = sm.rows, cur = rows.filter(function (r) { return r.current; })[0] || { added: 0, removed: 0 };
    var top = Math.max.apply(null, rows.map(function (r) { return r.balance; }).concat([sm.target || 0, 1]));
    var firstFuture = rows.filter(function (r) { return r.future; })[0];

    var hero =
      '<section class="sv-hero" aria-label="Résumé de ton épargne">' +
        '<div class="sv-stat sv-stat--now">' + U.px('piggy', 2) + '<span class="sv-stat__label">Épargné aujourd’hui</span><strong class="sv-stat__value num">' + money(sm.balance) + NB + '€</strong>' +
          '<span class="sv-stat__sub">Ce mois-ci : ' + (cur.added ? '+' + NB + money(cur.added) + NB + '€' : 'rien encore') + (cur.removed ? ' · −' + NB + money(cur.removed) + NB + '€' : '') + '</span></div>' +
        '<div class="sv-stat">' + U.px('chart', 2) + '<span class="sv-stat__label">Dans ' + horizon + ' mois</span><strong class="sv-stat__value num">' + money(sm.end) + NB + '€</strong>' +
          '<span class="sv-stat__sub">' + (sm.end >= sm.balance ? '+' + NB + money(sm.end - sm.balance) : '−' + NB + money(sm.balance - sm.end)) + NB + '€ d’ici ' + esc(monthName(rows[rows.length - 1]).toLowerCase()) + '</span></div>' +
        '<div class="sv-stat sv-stat--goal">' + U.px('target', 2) + '<span class="sv-stat__label">Mon objectif</span>' +
          '<label class="sv-goal"><input class="sv-in sv-in--goal num" data-sv-target inputmode="decimal" value="' + esc(sm.target ? money(sm.target) : '') + '" placeholder="ex. 3 000" aria-label="Objectif d’épargne en euros" data-focus-key="sv-target"><span>€</span></label>' +
          '<span class="sv-stat__sub">' + (!sm.target ? 'Facultatif : une somme à atteindre' : sm.balance >= sm.target ? 'Atteint, bravo !' : sm.reach ? 'Atteint en <strong>' + esc(monthName(rows.filter(function (r) { return r.start === sm.reach; })[0]).toLowerCase()) + '</strong>' : 'Pas encore atteint en ' + horizon + ' mois') + '</span></div>' +
      '</section>';

    var chart = '<div class="sv-chart" role="img" aria-label="Solde de l’épargne mois par mois' + (sm.target ? ', objectif ' + money(sm.target) + ' euros' : '') + '">' +
      rows.map(function (r) {
        return '<span class="sv-col' + (r.future ? ' is-future' : '') + (r.current ? ' is-current' : '') + (sm.target && r.balance >= sm.target ? ' is-goal' : '') + '" title="' + esc(monthName(r)) + ' : ' + money(r.balance) + ' €">' +
          '<span class="sv-col__bar" style="height:' + Math.max(2, Math.round(Math.max(0, r.balance) / top * 100)) + '%"></span><span class="sv-col__label">' + esc(shortMonth(r)) + '</span></span>';
      }).join('') +
      (sm.target ? '<span class="sv-chart__goal" style="bottom:calc(22px + (100% - 22px) * ' + (sm.target / top).toFixed(4) + ')"><span>Objectif ' + money(sm.target) + NB + '€</span></span>' : '') + '</div>';

    var body = rows.map(function (r) {
      var sep = r === firstFuture ? '<tr class="sv-sep"><th colspan="4" scope="rowgroup">' + icon('calendar') + 'Prévision</th></tr>' : '';
      var cls = (r.future ? 'is-future' : '') + (r.current ? ' is-current' : '') + (sm.target && r.balance >= sm.target && r.start === sm.reach ? ' is-reach' : '');
      var addCell = r.future
        ? '<input class="sv-in num' + (r.auto ? ' is-auto' : '') + '" data-sv-month="' + r.start + '" data-f="in" inputmode="decimal" value="' + esc(r.auto ? '' : edit(r.added)) + '" placeholder="' + esc(money(r.added)) + '" aria-label="Prévu pour ' + esc(monthName(r)) + ', mis de côté" data-focus-key="sv-in-' + r.start + '">'
        : '<input class="sv-in num" data-sv-real="' + r.start + '" data-f="in" inputmode="decimal" value="' + esc(edit(r.added)) + '" placeholder="0" aria-label="' + esc(monthName(r)) + ', mis de côté" data-focus-key="sv-in-' + r.start + '">';
      var outCell = r.future
        ? '<input class="sv-in num" data-sv-month="' + r.start + '" data-f="out" inputmode="decimal" value="' + esc(edit(r.removed)) + '" placeholder="0" aria-label="Prévu pour ' + esc(monthName(r)) + ', retiré" data-focus-key="sv-out-' + r.start + '">'
        : '<input class="sv-in num" data-sv-real="' + r.start + '" data-f="out" inputmode="decimal" value="' + esc(edit(r.removed)) + '" placeholder="0" aria-label="' + esc(monthName(r)) + ', retiré" data-focus-key="sv-out-' + r.start + '">';
      var d0 = D.parse(B().startDay === 1 ? r.start : r.end), short = D.MONTHS_SHORT[d0.getMonth()] + ' ' + String(d0.getFullYear()).slice(2);
      return sep + '<tr class="' + cls + '"><th scope="row"><span class="sv-m-long">' + esc(monthName(r)) + '</span><span class="sv-m-short" aria-hidden="true">' + esc(short) + '</span>' + (r.current ? ' <span class="sv-chip">ce mois-ci</span>' : '') + (cls.indexOf('is-reach') >= 0 ? ' <span class="sv-chip sv-chip--goal">objectif atteint</span>' : '') + '</th>' +
        '<td class="sv-add">' + addCell + '</td><td class="sv-out">' + outCell + '</td>' +
        '<td class="sv-bal num">' + money(r.balance) + NB + '€</td></tr>';
    }).join('');

    var cagnottes = b.goals.filter(function (g) { return BG.goalSaved(b, g.id) || g.target; });
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Budget</p><h1 class="h1" id="h-savings" tabindex="-1">Épargne</h1>' +
        '<p class="page-head__lead">Mois par mois : ce que tu as mis de côté, ce que tu as retiré, et ta prévision pour la suite. Touche un montant pour le modifier.</p></div>' +
        '<div class="page-head__actions"><div class="segmented" role="group" aria-label="Prévision sur">' + [6, 12, 24].map(function (n) {
          return '<button type="button" class="segmented__item" data-sv-horizon="' + n + '" aria-pressed="' + (horizon === n) + '" data-focus-key="sv-h' + n + '">' + n + ' mois</button>';
        }).join('') + '</div></div></header>' +
      hero +
      '<div class="sv-layout">' +
        '<section class="glass card sv-card" aria-labelledby="sv-t"><div class="card__header"><div><h2 class="card__title" id="sv-t">' + U.px('calendar', 2) + 'Mois par mois</h2>' +
          '<p class="card__subtitle">Les mois passés : ce qui s’est vraiment passé. Les mois à venir : ta prévision.</p></div></div>' +
          '<div class="sv-default"><label for="sv-monthly">Chaque mois, je prévois de mettre de côté</label><span class="sv-default__field"><input class="sv-in num" id="sv-monthly" data-sv-monthly inputmode="decimal" value="' + esc(edit(fc.monthly)) + '" placeholder="0" data-focus-key="sv-monthly"><span>€</span></span></div>' +
          '<div class="table-scroll"><table class="sv-table"><thead><tr><th scope="col">Mois</th><th scope="col" class="num">Mis de côté</th><th scope="col" class="num">Retiré</th><th scope="col" class="num">Solde</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
          '<p class="hint sv-hint">Un mois à venir laissé vide suit ta prévision par défaut' + ((b.plans || []).length ? ' (ou tes versements automatiques)' : '') + '. Tape un montant pour ce mois-là seulement.</p>' +
        '</section>' +
        '<section class="glass card sv-card" aria-labelledby="sv-g"><div class="card__header"><div><h2 class="card__title" id="sv-g">' + U.px('chart', 2) + 'Mon solde au fil des mois</h2>' +
          '<p class="card__subtitle">Plein : déjà fait · clair : prévision</p></div></div>' + chart +
          (cagnottes.length > 1 || (cagnottes[0] && cagnottes[0].name !== SAVINGS_GOAL) ? '<h3 class="sv-h3">Répartition par cagnotte</h3><ul class="sv-goals" role="list">' + cagnottes.map(function (g) {
            var saved = BG.goalSaved(b, g.id), pct = g.target ? Math.min(100, Math.round(saved / g.target * 100)) : null;
            return '<li><span>' + esc(g.name) + '</span><strong class="num">' + money(saved) + NB + '€' + (g.target ? '<span class="text-subtle"> / ' + money(g.target) + NB + '€</span>' : '') + '</strong>' + (pct != null ? U.progress(pct, 'progress--sm') : '') + '</li>';
          }).join('') + '</ul>' : '') +
        '</section>' +
      '</div>';
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  /* --- Saisie ---------------------------------------------------------------------------------- */
  function commit(inp) {
    var raw = inp.value.trim(), n = raw === '' ? null : num(raw);
    if (n != null && (!(n >= 0) || n > 1e8)) { warn('Un montant, par exemple 250 ou 1 500.'); render(); return; }
    if (n != null) n = Math.round(n * 100) / 100;
    if (inp.hasAttribute('data-sv-monthly')) { S.setForecast({ monthly: n }); return; }
    if (inp.hasAttribute('data-sv-target')) { S.setForecast({ target: n || null }); return; }
    if (inp.hasAttribute('data-sv-month')) { S.setForecastMonth(inp.getAttribute('data-sv-month'), inp.getAttribute('data-f'), n); return; }
    if (inp.hasAttribute('data-sv-real')) {
      var start = inp.getAttribute('data-sv-real'), r = BG.savingsMonths(B(), { months: 0 }).rows.filter(function (x) { return x.start === start; })[0];
      if (r) setActual(r, inp.getAttribute('data-f'), n || 0);
    }
  }

  function mount(node) {
    el = node;
    el.addEventListener('change', function (e) { if (e.target.classList.contains('sv-in')) commit(e.target); });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.classList.contains('sv-in')) return;
      e.preventDefault();
      // Entrée : on valide et on descend d'un mois, comme dans un tableur
      var inp = e.target, f = inp.getAttribute('data-f'), all = [].slice.call(el.querySelectorAll('.sv-table .sv-in[data-f="' + f + '"]'));
      var next = all[all.indexOf(inp) + 1], key = next && next.getAttribute('data-focus-key');
      inp.blur();
      if (key) setTimeout(function () { var x = el.querySelector('[data-focus-key="' + key + '"]'); if (x) { x.focus(); x.select(); } }, 30);
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sv-horizon]');
      if (b) { horizon = +b.getAttribute('data-sv-horizon'); render(); }
    });
    S.subscribe(function (type) {
      if (type !== 'budget' && type !== 'reset' && type !== 'settings') return;
      if (L.app.view() !== 'savings') { el.dataset.stale = '1'; return; }
      render();
    });
  }

  L.views = L.views || {};
  L.views.savings = { title: 'Épargne', mount: mount, render: render, show: function () { delete el.dataset.stale; render(); } };
})(window.Lamia = window.Lamia || {});
