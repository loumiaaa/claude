/* ==========================================================================
   Plateforme de suivi - Lamia — Budget · Épargne, cagnotte par cagnotte
   Un onglet par cagnotte (BTS, vacances…) et un onglet « Toutes » :
   - dans une cagnotte : son tableau mois par mois (mis de côté, retiré, solde),
     le réel pour les mois passés et le mois en cours (modifiable sur place), sa
     prévision pour les mois à venir (montant par défaut, ou ce que tu tapes pour
     un mois précis), son objectif et son graphique ;
   - « Toutes » : les cagnottes additionnées, et une carte par cagnotte.
   On crée, renomme et supprime les cagnottes ici. Calculs : shared/budget.js
   (savingsMonths, savingsAll).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, BG = window.LamiaShared.budget;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var el = null, horizon = 12, sel = null;     // sel : id de la cagnotte affichée, 'all' pour toutes

  function B() { return S.budget(); }
  function goals() { return B().goals; }
  function goal(id) { return goals().filter(function (g) { return g.id === id; })[0] || null; }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[\s  €]/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; }
  function money(v) { var r = Math.round(v * 100) / 100; return r.toLocaleString('fr-FR', { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function edit(v) { if (v == null || v === 0) return ''; var r = Math.round(v * 100) / 100; return (r % 1 ? r.toFixed(2) : String(r)).replace('.', ','); }
  function monthDate(r) { return D.parse(B().startDay === 1 ? r.start : r.end); }
  function monthName(r) { return D.cap(D.monthYear(B().startDay === 1 ? r.start : r.end)); }
  function shortMonth(r, year) { var d = monthDate(r); return D.MONTHS_SHORT[d.getMonth()] + (year || d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : ''); }
  function warn(text) { U.toast({ kind: 'warning', icon: 'alert', title: 'À vérifier', text: text, duration: 4000 }); }
  function current() { if (sel !== 'all' && !goal(sel)) sel = goals().length === 1 ? goals()[0].id : 'all'; return sel; }

  /* --- Mois passés : ajuster le réel d'une cagnotte ---------------------------------------- */
  // Un versement (ou un retrait) « du mois » est ajusté pour que le total du mois
  // corresponde au montant saisi ; les autres versements du mois ne bougent pas.
  function setActual(g, r, field, total) {
    var b = B(), out = field === 'out', flag = out ? 'monthlyOut' : 'monthly';
    var mine = b.deposits.filter(function (x) { return x[flag] && x.date === r.start && x.goalId === g.id; })[0];
    var others = (out ? r.removed : r.added) - (mine ? Math.abs(mine.amount) : 0);
    var want = Math.round((total - others) * 100) / 100;
    if (want < 0) { warn('Ce mois-là, ' + money(others) + ' € sont déjà ' + (out ? 'retirés' : 'mis de côté') + ' dans « ' + g.name + ' » par ailleurs (versements automatiques, plusieurs versements).'); render(); return; }
    if (mine) { if (want) S.updateBudget('deposits', mine.id, { amount: out ? -want : want }); else S.removeBudget('deposits', mine.id); }
    else if (want) { var dep = { goalId: g.id, date: r.start, amount: out ? -want : want }; dep[flag] = true; S.addBudget('deposits', dep); }
  }

  /* --- Morceaux ---------------------------------------------------------------------------------- */
  function tabs(cur) {
    var b = B();
    return '<div class="sv-tabs" role="tablist" aria-label="Cagnottes">' +
      (goals().length > 1 ? '<button type="button" role="tab" class="sv-tab' + (cur === 'all' ? ' is-on' : '') + '" aria-selected="' + (cur === 'all') + '" data-sv-goal="all" data-focus-key="sv-tab-all">' + U.px('coin') + '<span>Toutes</span><strong class="num">' + money(BG.savingsAll(b, { months: 0 }).balance) + NB + '€</strong></button>' : '') +
      goals().map(function (g) {
        return '<button type="button" role="tab" class="sv-tab' + (cur === g.id ? ' is-on' : '') + '" aria-selected="' + (cur === g.id) + '" data-sv-goal="' + g.id + '" data-focus-key="sv-tab-' + g.id + '">' + U.px('piggy') + '<span>' + esc(g.name) + '</span><strong class="num">' + money(BG.savingsMonths(b, { goalId: g.id, months: 0 }).balance) + NB + '€</strong></button>';
      }).join('') +
      '<button type="button" class="sv-tab sv-tab--add" data-sv-new data-focus-key="sv-new">' + icon('plus') + '<span>Nouvelle cagnotte</span></button></div>';
  }

  function chartHTML(sm) {
    var rows = sm.rows, top = Math.max.apply(null, rows.map(function (r) { return r.balance; }).concat([sm.target || 0, 1]));
    return '<div class="sv-chart" role="img" aria-label="Solde mois par mois' + (sm.target ? ', objectif ' + money(sm.target) + ' euros' : '') + '">' +
      rows.map(function (r) {
        return '<span class="sv-col' + (r.future ? ' is-future' : '') + (r.current ? ' is-current' : '') + (sm.target && r.balance >= sm.target ? ' is-goal' : '') + '" title="' + esc(monthName(r)) + ' : ' + money(r.balance) + ' €">' +
          '<span class="sv-col__bar" style="height:' + Math.max(2, Math.round(Math.max(0, r.balance) / top * 100)) + '%"></span><span class="sv-col__label">' + esc(shortMonth(r)) + '</span></span>';
      }).join('') +
      (sm.target ? '<span class="sv-chart__goal" style="bottom:calc(22px + (100% - 22px) * ' + (sm.target / top).toFixed(4) + ')"><span>Objectif ' + money(sm.target) + NB + '€</span></span>' : '') + '</div>';
  }

  function tableHTML(sm, g) {
    var firstFuture = sm.rows.filter(function (r) { return r.future; })[0];
    var body = sm.rows.map(function (r) {
      var sep = r === firstFuture ? '<tr class="sv-sep"><th colspan="4" scope="rowgroup">' + icon('calendar') + 'Prévision</th></tr>' : '';
      var reach = sm.target && r.start === sm.reach;
      var cls = (r.future ? 'is-future' : '') + (r.current ? ' is-current' : '') + (reach ? ' is-reach' : '');
      function cell(field) {
        var v = field === 'in' ? r.added : r.removed, label = monthName(r) + (field === 'in' ? ', mis de côté' : ', retiré');
        if (!g) return '<span class="sv-ro num">' + (v ? money(v) : '0') + '</span>';      // « Toutes » : lecture seule
        if (r.future) return '<input class="sv-in num' + (field === 'in' && r.auto ? ' is-auto' : '') + '" data-sv-month="' + r.start + '" data-f="' + field + '" inputmode="decimal" value="' + esc(field === 'in' && r.auto ? '' : edit(v)) + '" placeholder="' + esc(field === 'in' ? money(v) : '0') + '" aria-label="Prévu pour ' + esc(label) + '" data-focus-key="sv-' + field + '-' + r.start + '">';
        return '<input class="sv-in num" data-sv-real="' + r.start + '" data-f="' + field + '" inputmode="decimal" value="' + esc(edit(v)) + '" placeholder="0" aria-label="' + esc(label) + '" data-focus-key="sv-' + field + '-' + r.start + '">';
      }
      return sep + '<tr class="' + cls + '"><th scope="row"><span class="sv-m-long">' + esc(monthName(r)) + '</span><span class="sv-m-short" aria-hidden="true">' + esc(shortMonth(r, true)) + '</span>' +
        (r.current ? ' <span class="sv-chip">ce mois-ci</span>' : '') + (reach ? ' <span class="sv-chip sv-chip--goal">objectif atteint</span>' : '') + '</th>' +
        '<td class="sv-add">' + cell('in') + '</td><td class="sv-out">' + cell('out') + '</td><td class="sv-bal num">' + money(r.balance) + NB + '€</td></tr>';
    }).join('');
    return '<div class="table-scroll"><table class="sv-table"><thead><tr><th scope="col">Mois</th><th scope="col" class="num">Mis de côté</th><th scope="col" class="num">Retiré</th><th scope="col" class="num">Solde</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  /* --- Une cagnotte ---------------------------------------------------------------------------- */
  function goalView(g) {
    var b = B(), sm = BG.savingsMonths(b, { goalId: g.id, months: horizon });
    var cur = sm.rows.filter(function (r) { return r.current; })[0] || { added: 0, removed: 0 };
    var reachRow = sm.reach ? sm.rows.filter(function (r) { return r.start === sm.reach; })[0] : null;
    var plans = (b.plans || []).filter(function (p) { return p.goalId === g.id && (!p.until || p.until >= D.today()); });
    var hero =
      '<section class="sv-hero" aria-label="Résumé de « ' + esc(g.name) + ' »">' +
        '<div class="sv-stat sv-stat--now">' + U.px('piggy', 2) + '<span class="sv-stat__label">Dans « ' + esc(g.name) + ' » aujourd’hui</span><strong class="sv-stat__value num">' + money(sm.balance) + NB + '€</strong>' +
          '<span class="sv-stat__sub">Ce mois-ci : ' + (cur.added ? '+' + NB + money(cur.added) + NB + '€' : 'rien encore') + (cur.removed ? ' · −' + NB + money(cur.removed) + NB + '€' : '') + '</span></div>' +
        '<div class="sv-stat">' + U.px('chart', 2) + '<span class="sv-stat__label">Dans ' + horizon + ' mois</span><strong class="sv-stat__value num">' + money(sm.end) + NB + '€</strong>' +
          '<span class="sv-stat__sub">' + (sm.end >= sm.balance ? '+' + NB + money(sm.end - sm.balance) : '−' + NB + money(sm.balance - sm.end)) + NB + '€ d’ici ' + esc(monthName(sm.rows[sm.rows.length - 1]).toLowerCase()) + '</span></div>' +
        '<div class="sv-stat sv-stat--goal">' + U.px('target', 2) + '<span class="sv-stat__label">Objectif de la cagnotte</span>' +
          '<label class="sv-goal"><input class="sv-in sv-in--goal num" data-sv-target inputmode="decimal" value="' + esc(sm.target ? money(sm.target) : '') + '" placeholder="ex. 3 000" aria-label="Objectif de « ' + esc(g.name) + ' » en euros" data-focus-key="sv-target"><span>€</span></label>' +
          '<span class="sv-stat__sub">' + (!sm.target ? 'Facultatif : une somme à atteindre' : sm.balance >= sm.target ? 'Atteint, bravo !' : reachRow ? 'Atteint en <strong>' + esc(monthName(reachRow).toLowerCase()) + '</strong>' : 'Pas encore atteint en ' + horizon + ' mois') + '</span></div>' +
      '</section>';
    return hero +
      '<div class="sv-layout">' +
        '<section class="glass card sv-card" aria-labelledby="sv-t"><div class="card__header"><div><h2 class="card__title" id="sv-t">' + U.px('calendar', 2) + esc(g.name) + ' · mois par mois</h2>' +
          '<p class="card__subtitle">Les mois passés : ce qui s’est vraiment passé. Les mois à venir : ta prévision.</p></div>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-sv-menu="' + g.id + '" aria-haspopup="menu" aria-label="Renommer ou supprimer « ' + esc(g.name) + ' »" data-focus-key="sv-menu">' + icon('more') + '</button></div>' +
          '<div class="sv-default"><label for="sv-monthly">Chaque mois, je prévois de mettre de côté</label><span class="sv-default__field"><input class="sv-in num" id="sv-monthly" data-sv-monthly inputmode="decimal" value="' + esc(edit(sm.monthly)) + '" placeholder="0" data-focus-key="sv-monthly"><span>€</span></span></div>' +
          (plans.length ? '<ul class="sv-plans" role="list">' + plans.map(function (p) {
            return '<li>' + icon('refresh') + '<span>Versement automatique : ' + money(p.amount) + NB + '€ le ' + p.day + ' de chaque mois</span><button type="button" class="btn btn--ghost btn--sm" data-sv-plan-stop="' + p.id + '">Arrêter</button></li>';
          }).join('') + '</ul>' : '') +
          tableHTML(sm, g) +
          '<p class="hint sv-hint">Un mois à venir laissé vide suit ta prévision par défaut' + (plans.length ? ' (ou ton versement automatique)' : '') + '. Tape un montant pour ce mois-là seulement.</p>' +
        '</section>' +
        '<section class="glass card sv-card" aria-labelledby="sv-g"><div class="card__header"><div><h2 class="card__title" id="sv-g">' + U.px('chart', 2) + 'Solde au fil des mois</h2>' +
          '<p class="card__subtitle">Plein : déjà fait · hachuré : prévision</p></div></div>' + chartHTML(sm) + '</section>' +
      '</div>';
  }

  /* --- Toutes les cagnottes -------------------------------------------------------------------- */
  // Versements automatiques en cours d'une cagnotte (par mois)
  function auto(goalId) { return (B().plans || []).filter(function (p) { return p.goalId === goalId && (!p.until || p.until >= D.today()); }).reduce(function (a, p) { return a + p.amount; }, 0); }
  // Toutes les cagnottes, mois par mois : une colonne par cagnotte, le total du mois, le solde
  function matrixHTML(sa) {
    var firstFuture = sa.rows.filter(function (r) { return r.future; })[0];
    var head = '<thead><tr><th scope="col">Mois</th>' + sa.goals.map(function (p) { return '<th scope="col" class="num">' + esc(p.goal.name) + '</th>'; }).join('') +
      '<th scope="col" class="num sv-mx__tot">Total du mois</th><th scope="col" class="num">Solde</th></tr></thead>';
    var body = sa.rows.map(function (r, i) {
      var sep = r === firstFuture ? '<tr class="sv-sep"><th colspan="' + (sa.goals.length + 3) + '" scope="rowgroup">' + icon('calendar') + 'Prévision</th></tr>' : '';
      var cells = sa.goals.map(function (p) {
        var x = p.data.rows[i] || { added: 0, removed: 0, auto: true }, g = p.goal, label = g.name + ', ' + monthName(r);
        var inp = r.future
          ? '<input class="sv-in num' + (x.auto ? ' is-auto' : '') + '" data-goal="' + g.id + '" data-sv-month="' + r.start + '" data-f="in" inputmode="decimal" value="' + esc(x.auto ? '' : edit(x.added)) + '" placeholder="' + esc(money(x.added)) + '" aria-label="Prévu pour ' + esc(label) + '" data-focus-key="mx-' + g.id + '-' + r.start + '">'
          : '<input class="sv-in num" data-goal="' + g.id + '" data-sv-real="' + r.start + '" data-f="in" inputmode="decimal" value="' + esc(edit(x.added)) + '" placeholder="0" aria-label="' + esc(label) + ', mis de côté" data-focus-key="mx-' + g.id + '-' + r.start + '">';
        return '<td class="sv-add">' + inp + (x.removed ? '<span class="sv-mx__out" title="Retiré">−' + NB + money(x.removed) + '</span>' : '') + '</td>';
      }).join('');
      var net = Math.round((r.added - r.removed) * 100) / 100;
      return sep + '<tr class="' + (r.future ? 'is-future' : '') + (r.current ? ' is-current' : '') + '"><th scope="row"><span class="sv-m-long">' + esc(monthName(r)) + '</span><span class="sv-m-short" aria-hidden="true">' + esc(shortMonth(r, true)) + '</span>' + (r.current ? ' <span class="sv-chip">ce mois-ci</span>' : '') + '</th>' +
        cells + '<td class="num sv-mx__tot">' + (net > 0 ? '+' + NB : net < 0 ? '−' + NB : '') + money(Math.abs(net)) + NB + '€</td><td class="sv-bal num">' + money(r.balance) + NB + '€</td></tr>';
    }).join('');
    return '<div class="table-scroll"><table class="sv-table sv-mx">' + head + '<tbody>' + body + '</tbody></table></div>';
  }

  function allView() {
    var b = B(), sa = BG.savingsAll(b, { months: horizon });
    var cards = sa.goals.map(function (p) {
      var g = p.goal, d = p.data, pct = d.target ? Math.min(100, Math.round(Math.max(0, d.balance) / d.target * 100)) : null;
      var reachRow = d.reach ? d.rows.filter(function (r) { return r.start === d.reach; })[0] : null;
      return '<li><button type="button" class="sv-goal-card" data-sv-goal="' + g.id + '">' +
        '<span class="sv-goal-card__head">' + U.px('piggy', 2) + '<strong>' + esc(g.name) + '</strong><span class="num">' + money(d.balance) + NB + '€</span></span>' +
        (pct != null ? U.progress(pct, 'progress--sm') : '') +
        '<span class="sv-goal-card__sub">' + (d.target ? (d.balance >= d.target ? 'Objectif de ' + money(d.target) + ' € atteint' : 'Objectif ' + money(d.target) + ' € · ' + (reachRow ? 'atteint en ' + esc(monthName(reachRow).toLowerCase()) : 'pas encore en ' + horizon + ' mois')) : 'Sans objectif') +
          ' · ' + (d.monthly ? money(d.monthly) + NB + '€ prévus par mois' : auto(g.id) ? 'versement automatique de ' + money(auto(g.id)) + NB + '€' : 'pas de prévision') + '</span></button></li>';
    }).join('');
    return '<section class="sv-hero" aria-label="Résumé de toutes les cagnottes">' +
        '<div class="sv-stat sv-stat--now">' + U.px('coin', 2) + '<span class="sv-stat__label">Toutes mes épargnes aujourd’hui</span><strong class="sv-stat__value num">' + money(sa.balance) + NB + '€</strong><span class="sv-stat__sub">' + U.plural(goals().length, 'cagnotte') + '</span></div>' +
        '<div class="sv-stat">' + U.px('chart', 2) + '<span class="sv-stat__label">Dans ' + horizon + ' mois</span><strong class="sv-stat__value num">' + money(sa.end) + NB + '€</strong><span class="sv-stat__sub">+' + NB + money(sa.end - sa.balance) + NB + '€ prévus</span></div>' +
        '<div class="sv-stat">' + U.px('target', 2) + '<span class="sv-stat__label">Ce mois-ci</span><strong class="sv-stat__value num">+' + NB + money((sa.rows.filter(function (r) { return r.current; })[0] || {}).added || 0) + NB + '€</strong><span class="sv-stat__sub">mis de côté, toutes cagnottes</span></div>' +
      '</section>' +
      '<section class="glass card sv-card sv-card--wide" aria-labelledby="sv-t"><div class="card__header"><div><h2 class="card__title" id="sv-t">' + U.px('calendar', 2) + 'Mes épargnes mois par mois</h2>' +
        '<p class="card__subtitle">Ce que tu as mis dans chaque cagnotte, mois après mois, et où tu en es. Touche un montant pour le modifier.</p></div></div>' + matrixHTML(sa) +
        '<p class="hint sv-hint">Les mois à venir en italique suivent la prévision de chaque cagnotte. Pour un retrait, ouvre la cagnotte concernée.</p></section>' +
      '<div class="sv-layout sv-layout--all">' +
        '<section class="glass card sv-card" aria-labelledby="sv-g"><div class="card__header"><div><h2 class="card__title" id="sv-g">' + U.px('chart', 2) + 'Solde total au fil des mois</h2>' +
          '<p class="card__subtitle">Plein : déjà fait · hachuré : prévision</p></div></div>' + chartHTML(sa) + '</section>' +
        '<ul class="sv-goal-cards" role="list">' + cards + '</ul>' +
      '</div>';
  }

  /* --- Rendu -------------------------------------------------------------------------------- */
  function render() {
    if (!el) return;
    var cur = current();
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Budget</p><h1 class="h1" id="h-savings" tabindex="-1">Épargne</h1>' +
        '<p class="page-head__lead">Une cagnotte par projet. Pour chacune : ce que tu as mis de côté, retiré, et ta prévision mois par mois. Touche un montant pour le modifier.</p></div>' +
        '<div class="page-head__actions"><div class="segmented" role="group" aria-label="Prévision sur">' + [6, 12, 24].map(function (n) {
          return '<button type="button" class="segmented__item" data-sv-horizon="' + n + '" aria-pressed="' + (horizon === n) + '" data-focus-key="sv-h' + n + '">' + n + ' mois</button>';
        }).join('') + '</div></div></header>' +
      tabs(cur) +
      (!goals().length
        ? '<section class="glass card sv-empty">' + U.px('piggy', 3) + '<h2 class="card__title">Ta première cagnotte</h2><p class="hint">BTS, vacances, voiture, coussin de sécurité… Crée une cagnotte pour suivre ce que tu mets de côté et voir où tu en seras dans quelques mois.</p>' +
          '<button type="button" class="btn btn--primary" data-sv-new>' + icon('plus') + 'Créer une cagnotte</button></section>'
        : cur === 'all' ? allView() : goalView(goal(cur)));
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  /* --- Cagnottes : créer, renommer, supprimer ------------------------------------------------ */
  function newGoal(returnTo) {
    U.dialog({
      title: 'Nouvelle cagnotte', size: 'sm', returnTo: returnTo, confirmLabel: 'Créer',
      body: '<div class="form-grid"><div class="field field--full"><label class="label" for="sv-n">Nom</label><input class="input" id="sv-n" name="name" maxlength="40" placeholder="ex. Vacances, BTS, Voiture" required></div>' +
        '<div class="field"><label class="label" for="sv-o">Objectif <span class="text-subtle">facultatif</span></label><input class="input" id="sv-o" name="target" inputmode="decimal" placeholder="ex. 1 500"></div>' +
        '<div class="field"><label class="label" for="sv-p">Je prévois par mois</label><input class="input" id="sv-p" name="monthly" inputmode="decimal" placeholder="ex. 100"></div></div>',
      onConfirm: function (form) {
        var name = form.name.value.trim(), t = num(form.target.value), m = num(form.monthly.value);
        if (!name) { form.name.closest('.field').classList.add('field--error'); form.name.focus(); return false; }
        var g = { name: name };
        if (t > 0) g.target = Math.round(t * 100) / 100;
        if (m > 0) g.forecast = { monthly: Math.round(m * 100) / 100, months: {} };
        g = S.addBudget('goals', g);
        sel = g.id;
        render();
        U.toast({ kind: 'success', icon: 'check', title: 'Cagnotte « ' + name + ' » créée', duration: 3000 });
      }
    });
  }
  function goalMenu(btn) {
    var g = goal(btn.getAttribute('data-sv-menu'));
    if (!g) return;
    U.openMenu(btn, [
      { label: 'Renommer', icon: 'edit', onSelect: function () {
        U.dialog({ title: 'Renommer la cagnotte', size: 'sm', returnTo: btn, confirmLabel: 'Enregistrer',
          body: '<div class="field"><label class="label" for="sv-rn">Nom</label><input class="input" id="sv-rn" name="name" maxlength="40" value="' + esc(g.name) + '" required></div>',
          onConfirm: function (form) { var n = form.name.value.trim(); if (!n) return false; S.updateBudget('goals', g.id, { name: n }); } });
      } },
      { label: 'Supprimer', icon: 'trash', danger: true, onSelect: function () {
        U.dialog({ title: 'Supprimer « ' + g.name + ' » ?', text: 'Ses versements, retraits et sa prévision seront effacés. Les autres cagnottes ne bougent pas.', danger: true, confirmLabel: 'Supprimer', returnTo: btn,
          onConfirm: function () { S.removeBudget('goals', g.id); sel = null; } });
      } }
    ], { label: 'Actions pour « ' + g.name + ' »' });
  }

  /* --- Saisie ---------------------------------------------------------------------------------- */
  function commit(inp) {
    var g = goal(inp.getAttribute('data-goal') || current());
    if (!g) return;
    var raw = inp.value.trim(), n = raw === '' ? null : num(raw);
    if (n != null && (!(n >= 0) || n > 1e8)) { warn('Un montant, par exemple 250 ou 1 500.'); render(); return; }
    if (n != null) n = Math.round(n * 100) / 100;
    if (inp.hasAttribute('data-sv-monthly')) { S.setGoalForecast(g.id, { monthly: n }); return; }
    if (inp.hasAttribute('data-sv-target')) { S.updateBudget('goals', g.id, { target: n || null }); return; }
    if (inp.hasAttribute('data-sv-month')) { S.setGoalForecastMonth(g.id, inp.getAttribute('data-sv-month'), inp.getAttribute('data-f'), n); return; }
    if (inp.hasAttribute('data-sv-real')) {
      var start = inp.getAttribute('data-sv-real'), r = BG.savingsMonths(B(), { goalId: g.id, months: 0, from: start }).rows.filter(function (x) { return x.start === start; })[0];
      if (r) setActual(g, r, inp.getAttribute('data-f'), n || 0);
    }
  }

  function mount(node) {
    el = node;
    el.addEventListener('change', function (e) { if (e.target.classList.contains('sv-in')) commit(e.target); });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.classList.contains('sv-in')) return;
      e.preventDefault();
      // Entrée : on valide et on descend d'un mois, comme dans un tableur
      var inp = e.target, f = inp.getAttribute('data-f'), gid = inp.getAttribute('data-goal');
      var all = [].slice.call(el.querySelectorAll('.sv-table .sv-in[data-f="' + f + '"]' + (gid ? '[data-goal="' + gid + '"]' : '')));
      var next = all[all.indexOf(inp) + 1], key = next && next.getAttribute('data-focus-key');
      inp.blur();
      if (key) setTimeout(function () { var x = el.querySelector('[data-focus-key="' + key + '"]'); if (x) { x.focus(); x.select(); } }, 30);
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-sv-horizon]'))) { horizon = +b.getAttribute('data-sv-horizon'); render(); return; }
      if ((b = e.target.closest('[data-sv-goal]'))) { sel = b.getAttribute('data-sv-goal'); render(); return; }
      if ((b = e.target.closest('[data-sv-new]'))) { newGoal(b); return; }
      if ((b = e.target.closest('[data-sv-menu]'))) { goalMenu(b); return; }
      if ((b = e.target.closest('[data-sv-plan-stop]'))) {
        var id = b.getAttribute('data-sv-plan-stop');
        U.dialog({ title: 'Arrêter ce versement automatique ?', text: 'Les versements déjà faits restent dans la cagnotte. Pour les mois à venir, ta prévision par défaut prend le relais.', confirmLabel: 'Arrêter', returnTo: b,
          onConfirm: function () { S.updateBudget('plans', id, { until: D.today() }); } });
      }
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
