/* ==========================================================================
   Plateforme de suivi - Lamia — espace « Budget »
   Quatre vues : tableau de bord, entrées & dépenses, factures & paiements en
   plusieurs fois, économies (cagnottes). Vue par semaine ou par mois.
   Calculs dans shared/budget.js (testé).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, BG = window.LamiaShared.budget;
  var esc = U.esc, icon = U.icon, NB = U.NB;

  var EXPENSE_CATS = ['Logement', 'Courses', 'Transport', 'Santé', 'Abonnements', 'Restaurants', 'Loisirs', 'Shopping', 'Beauté', 'Matériel pro', 'Cadeaux', 'Autre'];
  // Entrées : le salaire du travail principal, puis les projets du pôle perso (catégories du compte)
  function incomeCats() {
    var st = S.get(), out = ['Salaire ' + S.groupName('flowline')];
    st.categories.forEach(function (c) { if (c.group === 'auto-entreprise' && out.indexOf(c.name) < 0) out.push(c.name); });
    return out.concat(['Remboursement', 'Autre']);
  }
  var BILL_CATS = ['Logement', 'Énergie', 'Téléphone & internet', 'Assurances', 'Abonnements', 'Transport', 'Crédit', 'Autre'];
  var MONTHS = D.MONTHS;
  var EUR = (function () { try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }); } catch (e) { return null; } })();

  /* --- Outils ---------------------------------------------------------------- */
  function B() { return S.budget(); }
  function eur(v) { return EUR ? EUR.format(v) : (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + NB + '€'; }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[\s€]/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; }
  function money(v) { return v == null || v === '' ? '' : String(v).replace('.', ','); }
  function warn(title, text) { U.toast({ kind: 'warning', icon: 'alert', title: title, text: text || '', duration: 4500 }); }
  function empty(text) { return '<p class="hint health-empty">' + text + '</p>'; }
  function head(eyebrow, title, id, lead, actions) {
    return '<header class="page-head"><div class="page-head__text"><p class="eyebrow">' + eyebrow + '</p><h1 class="h1" id="' + id + '" tabindex="-1">' + title + '</h1>' +
      (lead ? '<p class="page-head__lead">' + lead + '</p>' : '') + '</div>' + (actions ? '<div class="page-head__actions">' + actions + '</div>' : '') + '</header>';
  }
  function card(id, title, subtitle, body, cls) {
    return '<section class="glass card ' + (cls || '') + '" aria-labelledby="' + id + '"><div class="card__header"><div><h2 class="card__title" id="' + id + '">' + title + '</h2>' +
      (subtitle ? '<p class="card__subtitle">' + subtitle + '</p>' : '') + '</div></div>' + body + '</section>';
  }
  function tile(ic, label, value, extra, cls) {
    return '<article class="glass stat ' + (cls || '') + '"><div class="stat__head"><span class="stat__icon">' + icon(ic) + '</span><span class="stat__label">' + esc(label) + '</span></div>' +
      '<div class="stat__value">' + value + '</div>' + (extra ? '<span class="stat__delta">' + extra + '</span>' : '') + '</article>';
  }
  function btns(kind, id, label) {
    return '<span class="health-list__actions">' +
      '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-b-edit="' + kind + '" data-id="' + id + '" aria-label="Modifier ' + esc(label) + '">' + icon('edit') + '</button>' +
      '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-b-del="' + kind + '" data-id="' + id + '" aria-label="Supprimer ' + esc(label) + '">' + icon('trash') + '</button></span>';
  }

  /* --- Période : semaine ou mois (partagée par les vues) ------------------------- */
  var zoom = 'month', anchor = null;
  function periodAt(a) { return zoom === 'month' ? BG.budgetMonth(a, B().startDay) : D.period('week', a); }
  function period() { return periodAt(anchor || D.today()); }
  function shiftAnchor(a, delta) {
    if (zoom === 'week') return D.shift('week', a, delta);
    return D.addMonths(BG.budgetMonth(a, B().startDay).start, delta);
  }
  function periodBar() {
    var p = period(), isNow = D.between(D.today(), p.start, p.end), w = zoom === 'week';
    return '<div class="period-bar"><div class="segmented" role="group" aria-label="Vue">' +
        '<button type="button" class="segmented__item" data-b-zoom="week" data-focus-key="bz-week" aria-pressed="' + w + '">Semaine</button>' +
        '<button type="button" class="segmented__item" data-b-zoom="month" data-focus-key="bz-month" aria-pressed="' + !w + '">Mois</button></div>' +
      '<div class="period-nav">' +
        '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-b-nav="-1" data-focus-key="bn-prev" aria-label="' + (w ? 'Semaine précédente' : 'Mois précédent') + '">' + icon('chevron-left') + '</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-b-today data-focus-key="bn-today"' + (isNow ? ' aria-disabled="true"' : '') + '>' + (w ? 'Cette semaine' : 'Ce mois-ci') + '</button>' +
        '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-b-nav="1" data-focus-key="bn-next" aria-label="' + (w ? 'Semaine suivante' : 'Mois suivant') + '">' + icon('chevron-right') + '</button>' +
      '</div><h2 class="period-bar__label" aria-live="polite">' + esc(p.label) + '</h2></div>';
  }
  function bindPeriod(el, redraw) {
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-b-zoom]'))) { zoom = b.getAttribute('data-b-zoom'); redrawAll(); return; }
      if ((b = e.target.closest('[data-b-nav]'))) { anchor = shiftAnchor(anchor || D.today(), +b.getAttribute('data-b-nav')); redrawAll(); return; }
      if (e.target.closest('[data-b-today]')) { anchor = null; redrawAll(); }
    });
  }
  function redrawAll() {
    ['budget', 'money', 'bills', 'savings'].forEach(function (k) {
      var v = L.views[k];
      if (L.app.view() === k) v.render(); else document.getElementById('view-' + k).dataset.stale = '1';
    });
  }

  /* --- Formulaires génériques (ajout et modification) ------------------------------ */
  // def : { k, t: 'text'|'money'|'date'|'type'|'cat'|'day'|'select'|'count', label, ph, opts, req }
  function control(def, val, pre) {
    var id = pre + '-' + def.k, v = val == null ? '' : val;
    if (def.t === 'type') {
      return '<fieldset class="slot-checks"><legend class="label">Type</legend>' + [['expense', 'Dépense'], ['income', 'Entrée']].map(function (o) {
        return '<label class="slot-check"><input type="radio" name="type" value="' + o[0] + '"' + ((v || 'expense') === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
      }).join('') + '</fieldset>';
    }
    var input;
    if (def.t === 'date') input = '<input class="input" type="date" id="' + id + '" name="' + def.k + '" value="' + (v || D.today()) + '" data-focus-key="' + id + '">';
    else if (def.t === 'money') input = '<input class="input" id="' + id + '" name="' + def.k + '" inputmode="decimal" placeholder="' + (def.ph || '0,00') + '" value="' + esc(money(v)) + '" data-focus-key="' + id + '">';
    else if (def.t === 'select' || def.t === 'count') {
      input = '<select class="select" id="' + id + '" name="' + def.k + '" data-focus-key="' + id + '">' + def.opts.map(function (o) {
        var ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o;
        return '<option value="' + esc(ov) + '"' + (String(ov) === String(v === '' ? def.def : v) ? ' selected' : '') + '>' + esc(ol) + '</option>';
      }).join('') + '</select>';
    } else if (def.t === 'cat') {
      input = '<input class="input" id="' + id + '" name="' + def.k + '" list="' + id + '-l" maxlength="40" placeholder="' + (def.ph || 'Catégorie') + '" value="' + esc(v) + '" data-focus-key="' + id + '"><datalist id="' + id + '-l">' +
        (typeof def.opts === 'function' ? def.opts() : def.opts).map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>';
    } else input = '<input class="input" id="' + id + '" name="' + def.k + '" maxlength="' + (def.max || 60) + '" placeholder="' + esc(def.ph || '') + '" value="' + esc(v) + '" data-focus-key="' + id + '">';
    return '<div class="field"><label class="label" for="' + id + '">' + def.label + '</label>' + input + (def.hint ? '<p class="hint">' + def.hint + '</p>' : '') + '</div>';
  }
  function fields(defs, item, pre) { return defs.map(function (d) { return control(d, item ? item[d.k] : null, pre); }).join(''); }
  // Lit et vérifie : renvoie { val } ou { err }
  function read(defs, form) {
    var fd = new FormData(form), out = {};
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i], raw = String(fd.get(d.k) == null ? '' : fd.get(d.k)).trim();
      if (d.t === 'money') {
        if (!raw && !d.req) continue;
        var n = num(raw);
        if (!(n > 0) || n > 1e7) return { err: d.label.replace(/ \(.*\)$/, '') + ' : indique un montant, par exemple 49,90.' };
        out[d.k] = Math.round(n * 100) / 100;
      } else if (d.t === 'day') {
        var j = parseInt(raw, 10);
        if (!(j >= 1 && j <= 31)) return { err: 'Jour de prélèvement : entre 1 et 31.' };
        out[d.k] = j;
      } else if (d.t === 'count' || (d.t === 'select' && d.num)) out[d.k] = +raw;
      else if (d.t === 'date') out[d.k] = raw || D.today();
      else {
        if (!raw && d.req) return { err: d.label + ' : à remplir.' };
        if (raw || d.t === 'type') out[d.k] = raw || (d.t === 'type' ? 'expense' : '');
      }
    }
    return { val: out };
  }

  var DEFS = {
    entries: [
      { k: 'type', t: 'type' },
      { k: 'date', t: 'date', label: 'Date' },
      { k: 'label', t: 'text', label: 'Libellé', ph: 'ex. Courses, salaire…', req: true },
      { k: 'amount', t: 'money', label: 'Montant (€)', req: true },
      { k: 'category', t: 'cat', label: 'Catégorie', opts: function () { return EXPENSE_CATS.concat(incomeCats().filter(function (c) { return c !== 'Autre'; })); } }
    ],
    bills: [
      { k: 'label', t: 'text', label: 'Facture', ph: 'ex. Loyer, électricité…', req: true },
      { k: 'amount', t: 'money', label: 'Montant (€)', req: true },
      { k: 'day', t: 'day', label: 'Jour', ph: '5' },
      { k: 'every', t: 'select', label: 'Fréquence', opts: [['month', 'Tous les mois'], ['year', 'Une fois par an']], def: 'month' },
      { k: 'month', t: 'select', label: 'Mois (si annuelle)', num: true, opts: MONTHS.map(function (m, i) { return [i + 1, m]; }), def: 1 },
      { k: 'since', t: 'date', label: 'Depuis le' },
      { k: 'category', t: 'cat', label: 'Catégorie', opts: BILL_CATS }
    ],
    installments: [
      { k: 'label', t: 'text', label: 'Achat', ph: 'ex. iPhone, canapé…', req: true },
      { k: 'total', t: 'money', label: 'Montant total (€)', req: true },
      { k: 'count', t: 'count', label: 'Nombre d’échéances', opts: [2, 3, 4, 5, 6, 10, 12, 24].map(function (n) { return [n, n + ' fois']; }), def: 4 },
      { k: 'first', t: 'date', label: '1re échéance' },
      { k: 'category', t: 'cat', label: 'Catégorie', opts: EXPENSE_CATS }
    ],
    goals: [
      { k: 'name', t: 'text', label: 'Nom de la cagnotte', ph: 'ex. BTS, iPhone…', req: true, max: 40 },
      { k: 'target', t: 'money', label: 'Objectif (€)', ph: 'facultatif' }
    ],
    deposits: [
      { k: 'date', t: 'date', label: 'Date' },
      { k: 'amount', t: 'money', label: 'Montant (€)', req: true }
    ]
  };
  var NAMES = { entries: 'Mouvement', bills: 'Facture', installments: 'Paiement', goals: 'Cagnotte', deposits: 'Versement' };

  function find(kind, id) { return B()[kind].filter(function (x) { return x.id === id; })[0]; }
  function editItem(kind, id, btn) {
    var it = find(kind, id);
    if (!it) return;
    var defs = DEFS[kind], shown = kind === 'deposits' ? Object.assign({}, it, { amount: Math.abs(it.amount) }) : it;
    U.dialog({
      title: 'Modifier : ' + (it.label || it.name || NAMES[kind].toLowerCase()), confirmLabel: 'Enregistrer', returnTo: btn,
      fallbackFocus: function () { return document.querySelector('.view:not([hidden]) h1'); },
      body: '<div class="health-form">' + fields(defs, shown, 'e') + '</div>',
      onConfirm: function (form) {
        var r = read(defs, form);
        if (r.err) { warn('À vérifier', r.err); return false; }
        var patch = r.val;
        if (kind === 'deposits' && it.amount < 0) patch.amount = -patch.amount;
        defs.forEach(function (d) { if (!(d.k in patch)) patch[d.k] = null; });
        S.updateBudget(kind, id, patch);
        U.toast({ icon: 'check', title: 'Modification enregistrée', duration: 2500 });
      }
    });
  }
  function removeItem(kind, id, btn) {
    var it = find(kind, id);
    if (!it) return;
    if (kind === 'goals') {
      U.dialog({
        title: 'Supprimer la cagnotte « ' + it.name + ' » ?', danger: true, confirmLabel: 'Supprimer', returnTo: btn,
        text: 'Ses versements (' + eur(BG.goalSaved(B(), id)) + ') seront aussi supprimés de ton historique d’épargne.',
        onConfirm: function () { S.removeBudget('goals', id); U.toast({ icon: 'trash', title: 'Cagnotte supprimée', duration: 3000 }); }
      });
      return;
    }
    S.removeBudget(kind, id);
    U.toast({ icon: 'trash', title: NAMES[kind] + ' supprimé' + (kind === 'entries' || kind === 'installments' || kind === 'deposits' ? '' : 'e'), duration: 6000,
      actions: [{ label: 'Annuler', fn: function () { var c = Object.assign({}, it); delete c.id; var n = S.addBudget(kind, c); n.id = it.id; } }] });
  }
  function bindEditDelete(el) {
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-b-edit]'))) editItem(b.getAttribute('data-b-edit'), b.getAttribute('data-id'), b);
      else if ((b = e.target.closest('[data-b-del]'))) removeItem(b.getAttribute('data-b-del'), b.getAttribute('data-id'), b);
    });
  }

  /* --- Fabrique de vue -------------------------------------------------------------- */
  function makeView(name, title, render, bind) {
    var el = null;
    function draw() { if (el) U.keepFocus(el, function () { render(el); }); }
    return {
      title: title,
      mount: function (node) {
        el = node;
        bindPeriod(el, draw);
        bindEditDelete(el);
        if (bind) bind(el);
        S.subscribe(function (type) {
          if (type !== 'budget' && type !== 'reset' && type !== 'settings') return;
          if (L.app.view() !== name) { el.dataset.stale = '1'; return; }
          draw();
        });
      },
      render: draw,
      show: function () { if (!el.firstChild || el.dataset.stale) { delete el.dataset.stale; draw(); } }
    };
  }
  function addForm(kind, pre, submitLabel) {
    return '<form class="health-form budget-form" data-b-form="' + kind + '" novalidate>' + fields(DEFS[kind], null, pre) +
      '<button type="submit" class="btn btn--primary" data-focus-key="' + pre + '-submit">' + icon('plus') + (submitLabel || 'Ajouter') + '</button></form>';
  }
  function bindAdd(el, after) {
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-b-form]');
      if (!f) return;
      e.preventDefault();
      var kind = f.getAttribute('data-b-form'), defs = DEFS[kind === 'withdraw' ? 'deposits' : kind];
      var r = read(defs, f);
      if (r.err) { warn('À vérifier', r.err); return; }
      var v = r.val;
      if (kind === 'bills' && !v.since) v.since = D.today();
      if (kind === 'deposits' || kind === 'withdraw') {
        v.goalId = f.getAttribute('data-goal');
        if (kind === 'withdraw' || f.querySelector('[data-withdraw]:focus')) v.amount = -v.amount;
        kind = 'deposits';
      }
      S.addBudget(kind, v);
      if (after) after(kind, v);
    });
  }

  function budgetVoice(s) {
    var gs = B().goals, opts = [];
    if (s.rest < 0) opts.push({ lamia: 'Le mois est un peu serré. On regarde ensemble les dépenses par catégorie ?', lamiaAnim: 'typing' });
    if (s.savings > 0) opts.push({ lamia: eur(s.savings) + ' mis de côté sur la période. Ton futur toi te remercie !', lamiaAnim: 'cheer' });
    if (s.rest > 0) opts.push({ lamia: 'Il reste ' + eur(s.rest) + ' sur la période. On garde le cap, tranquillement.', lamiaAnim: 'wave' });
    gs.forEach(function (g) { if (g.target) { var pct = Math.round((BG.goalSaved(B(), g.id) / g.target) * 100); if (pct > 0 && pct < 100) opts.push({ lamia: 'Cagnotte « ' + g.name + ' » : ' + pct + ' % déjà ! On y arrive.', lamiaAnim: 'cheer' }); } });
    opts.push({ lamia: 'Un budget clair, c’est l’esprit léger. Note une dépense, je fais les calculs.', lamiaAnim: 'wave' });
    return opts[Math.floor(Math.random() * Math.min(opts.length, 2))];
  }

  /* === 1. Tableau de bord ============================================================ */
  function trend() {
    var rows = [], a = anchor || D.today();
    for (var i = 5; i >= 0; i--) {
      var p = periodAt(shiftAnchor(a, -i)), s = BG.summary(B(), p.start, p.end);
      rows.push('<tr' + (i === 0 ? ' class="is-current"' : '') + '><th scope="row">' + esc(zoom === 'week' ? 'Sem. ' + D.isoWeek(p.start) : (B().startDay === 1 ? D.cap(MONTHS[D.parse(p.start).getMonth()]).slice(0, 4) + '. ' + p.start.slice(2, 4) : D.dayMonth(p.start) + ' → ' + D.dayMonth(p.end))) + '</th>' +
        '<td>' + eur(s.income) + '</td><td>' + eur(s.expenses) + '</td><td>' + eur(s.savings) + '</td><td class="' + (s.rest < 0 ? 'is-neg' : 'is-pos') + '">' + eur(s.rest) + '</td></tr>');
    }
    return '<div class="table-wrap"><table class="health-table budget-table"><thead><tr><th scope="col">' + (zoom === 'week' ? 'Semaine' : 'Mois') + '</th><th scope="col">Entrées</th><th scope="col">Dépenses</th><th scope="col">Économies</th><th scope="col">Reste</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function goalsSummary() {
    var gs = B().goals;
    if (!gs.length) return empty('Crée une cagnotte (BTS, iPhone…) dans Économies.');
    return '<ul class="goal-list" role="list">' + gs.map(function (g) {
      var saved = BG.goalSaved(B(), g.id), pct = g.target ? Math.max(0, Math.min(100, Math.round((saved / g.target) * 100))) : null;
      return '<li><div class="goal-list__head"><strong>' + esc(g.name) + '</strong><span>' + eur(saved) + (g.target ? ' / ' + eur(g.target) : '') + '</span></div>' +
        (pct != null ? '<div class="progress" style="--value:' + pct + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(g.name) + '"></div>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function renderDash(el) {
    var p = period(), s = BG.summary(B(), p.start, p.end), today = D.today();
    var due = s.items.filter(function (x) { return x.source !== 'entry'; });
    var dueList = due.length ? '<ul class="health-list health-list--due" role="list">' + due.map(function (x) {
      return '<li class="' + (x.date < today ? 'is-past' : '') + '"><span class="health-list__date">' + esc(D.cap(D.dayMonthLong(x.date))) + '</span><strong>' + esc(x.label) + '</strong><span class="text-subtle">' + (x.date < today ? 'payé' : 'à venir') + '</span><span class="budget-amount">' + eur(x.amount) + '</span></li>';
    }).join('') + '</ul>' : empty('Aucune facture ni échéance sur cette période.');
    el.innerHTML =
      head('Gérer sereinement', 'Budget', 'h-budget', 'Tes entrées, tes dépenses et ce que tu mets de côté, ' + (zoom === 'week' ? 'semaine par semaine.' : 'mois par mois.'),
        '<a class="btn btn--secondary btn--sm" href="#depenses">' + icon('plus') + 'Dépense ou entrée</a><a class="btn btn--primary btn--sm" href="#epargne">' + icon('piggy') + 'Épargner</a>') +
      '<div class="mini-slot" data-mini-slot></div>' +
      periodBar() +
      '<div class="kpi-row kpi-row--4">' +
        tile('arrow-down', 'Entrées', eur(s.income), '') +
        tile('arrow-up', 'Dépenses', eur(s.expenses), U.plural(s.items.length, 'mouvement')) +
        tile('piggy', 'Économies', eur(s.savings), '') +
        tile('wallet', 'Reste', eur(s.rest), s.rest < 0 ? 'Plus de dépenses que d’entrées' : 'Disponible', s.rest < 0 ? 'stat--neg' : 'stat--pos') +
      '</div>' +
      '<div class="health-grid">' +
        card('bd-cat', 'Dépenses par catégorie', esc(p.label), s.byCategory.length ? '<div class="chart-host" data-chart="cats"></div>' : empty('Aucune dépense sur cette période.')) +
        card('bd-due', 'Factures et échéances', 'Prélèvements et paiements en plusieurs fois de la période', dueList) +
        card('bd-trend', 'Évolution', zoom === 'week' ? '6 dernières semaines' : '6 derniers mois', trend()) +
        card('bd-start', 'Mois budgétaire', 'Ton mois commence le jour de ta paie', '<form class="health-form start-form" data-b-start novalidate><div class="field"><label class="label" for="b-start">Le mois commence le</label>' +
          '<select class="select" id="b-start" name="day" data-focus-key="b-start">' + Array.apply(null, Array(28)).map(function (_, i) { var d = i + 1; return '<option value="' + d + '"' + (d === B().startDay ? ' selected' : '') + '>' + (d === 1 ? '1er' : d) + '</option>'; }).join('') + '</select>' +
          '<p class="hint">Mois en cours : ' + esc(BG.budgetMonth(D.today(), B().startDay).label) + '.</p></div></form>') +
        card('bd-goals', 'Cagnottes', 'Où en est ton épargne', goalsSummary() + '<a class="btn btn--ghost btn--sm" href="#epargne">Mes économies' + icon('chevron-right') + '</a>') +
      '</div>';
    L.fun.miniScene(el.querySelector('[data-mini-slot]'), 'budget', budgetVoice(s));
    var host = el.querySelector('[data-chart="cats"]');
    if (host) L.charts.hbars(host, { rows: s.byCategory.map(function (c) { return { label: c.category, value: c.amount, display: eur(c.amount), hue: 'hue--violet' }; }), ariaLabel: 'Dépenses par catégorie', unit: 'dépensés' });
  }

  /* === 2. Entrées & dépenses =========================================================== */
  function renderMoney(el) {
    var p = period(), s = BG.summary(B(), p.start, p.end);
    var list = B().entries.filter(function (x) { return D.between(x.date, p.start, p.end); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var rows = list.length ? '<ul class="health-list health-list--money" role="list">' + list.map(function (x) {
      return '<li><span class="health-list__date">' + esc(D.cap(D.dayMonthLong(x.date))) + '</span><strong>' + esc(x.label) + '</strong><span class="text-subtle">' + esc(x.category || '') + '</span>' +
        '<span class="budget-amount ' + (x.type === 'income' ? 'is-pos' : '') + '">' + (x.type === 'income' ? '+' : '−') + NB + eur(x.amount) + '</span>' + btns('entries', x.id, x.label) + '</li>';
    }).join('') + '</ul>' : empty('Aucune entrée ni dépense notée sur cette période.');
    el.innerHTML =
      head('Budget', 'Entrées & dépenses', 'h-money', 'Note une dépense ou une rentrée d’argent. Les factures et paiements en plusieurs fois se comptent tout seuls.') +
      card('m-add', 'Ajouter', '', addForm('entries', 'n')) +
      periodBar() +
      '<div class="kpi-row kpi-row--3">' + tile('arrow-down', 'Entrées', eur(s.income)) + tile('arrow-up', 'Dépenses ponctuelles', eur(list.filter(function (x) { return x.type === 'expense'; }).reduce(function (a, x) { return a + x.amount; }, 0))) + tile('receipt', 'Factures et échéances', eur(s.items.filter(function (x) { return x.source !== 'entry'; }).reduce(function (a, x) { return a + x.amount; }, 0))) + '</div>' +
      card('m-list', 'Mouvements', esc(p.label), rows);
  }

  /* === 3. Factures & paiements en plusieurs fois ======================================= */
  function renderBills(el) {
    var b = B(), today = D.today();
    var monthly = b.bills.reduce(function (a, x) { return a + (x.every === 'year' ? x.amount / 12 : x.amount); }, 0);
    var bills = b.bills.length ? '<ul class="health-list health-list--money" role="list">' + b.bills.slice().sort(function (a, c) { return a.day - c.day; }).map(function (x) {
      var when = x.every === 'year' ? 'le ' + x.day + ' ' + MONTHS[(x.month || 1) - 1] + ', chaque année' : 'le ' + x.day + ' de chaque mois';
      return '<li><span class="health-list__date">' + esc(when) + '</span><strong>' + esc(x.label) + '</strong><span class="text-subtle">' + esc(x.category || '') + '</span><span class="budget-amount">' + eur(x.amount) + '</span>' + btns('bills', x.id, x.label) + '</li>';
    }).join('') + '</ul>' : empty('Ajoute tes factures (loyer, forfait, assurances…) : elles seront comptées chaque mois automatiquement.');
    var inst = b.installments.length ? '<ul class="inst-list" role="list">' + b.installments.map(function (x) {
      var st = BG.installmentStatus(x, today), pct = Math.round((st.paidCount / st.schedule.length) * 100);
      return '<li class="glass glass--nested inst-card"><div class="inst-card__head"><strong>' + esc(x.label) + '</strong><span class="budget-amount">' + eur(x.total) + '</span>' + btns('installments', x.id, x.label) + '</div>' +
        '<div class="progress" style="--value:' + pct + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Échéances payées"></div>' +
        '<p class="inst-card__meta">' + st.paidCount + '/' + st.schedule.length + ' payées · ' + (st.done ? 'Terminé, bravo !' : 'reste ' + eur(st.remaining) + ' · prochaine le ' + esc(D.dayMonth(st.next.date)) + ' (' + eur(st.next.amount) + ')') + '</p>' +
        '<ol class="inst-steps">' + st.schedule.map(function (s) { return '<li class="' + (s.date <= today ? 'is-paid' : '') + '"><span>' + esc(D.dayMonth(s.date)) + '</span><span>' + eur(s.amount) + '</span></li>'; }).join('') + '</ol></li>';
    }).join('') + '</ul>' : empty('Ajoute un paiement en 4 fois (ou plus) : chaque échéance apparaîtra dans le mois où elle tombe.');
    el.innerHTML =
      head('Budget', 'Factures & paiements en plusieurs fois', 'h-bills', 'Ce qui revient chaque mois, et ce que tu paies en plusieurs fois.') +
      '<div class="kpi-row kpi-row--2">' + tile('receipt', 'Factures par mois', eur(monthly), U.plural(b.bills.length, 'facture')) +
        tile('calendar', 'Paiements en cours', String(b.installments.filter(function (x) { return !BG.installmentStatus(x, today).done; }).length), 'reste ' + eur(b.installments.reduce(function (a, x) { return a + BG.installmentStatus(x, today).remaining; }, 0))) + '</div>' +
      card('bl-add', 'Ajouter une facture', 'Montant prélevé, jour du prélèvement et fréquence', addForm('bills', 'f')) +
      card('bl-list', 'Mes factures', '', bills) +
      card('in-add', 'Ajouter un paiement en plusieurs fois', 'Le montant est réparti en échéances mensuelles', addForm('installments', 'i')) +
      card('in-list', 'Paiements en plusieurs fois', '', inst);
  }

  /* === 4. Économies ======================================================================= */
  function renderSavings(el) {
    var b = B(), p = period(), s = BG.summary(b, p.start, p.end);
    var total = b.deposits.reduce(function (a, x) { return a + x.amount; }, 0);
    var goals = b.goals.length ? '<div class="goal-grid">' + b.goals.map(function (g) {
      var saved = BG.goalSaved(b, g.id), pct = g.target ? Math.max(0, Math.min(100, Math.round((saved / g.target) * 100))) : null;
      var deps = b.deposits.filter(function (x) { return x.goalId === g.id; }).sort(function (a, c) { return a.date < c.date ? 1 : -1; });
      return '<section class="glass card goal-card" aria-labelledby="g-' + g.id + '"><div class="card__header"><div><h2 class="card__title" id="g-' + g.id + '">' + icon('piggy') + esc(g.name) + '</h2>' +
          '<p class="card__subtitle">' + eur(saved) + (g.target ? ' sur ' + eur(g.target) + ' · ' + pct + NB + '%' : ' épargnés') + '</p></div>' + btns('goals', g.id, g.name) + '</div>' +
        (pct != null ? '<div class="progress" style="--value:' + pct + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Progression ' + esc(g.name) + '"></div>' : '') +
        (g.target && saved < g.target ? '<p class="hint">Encore ' + eur(g.target - saved) + ' pour l’objectif.</p>' : g.target ? '<p class="hint">Objectif atteint, bravo !</p>' : '') +
        '<form class="deposit-form" data-b-form="deposits" data-goal="' + g.id + '" novalidate>' + fields(DEFS.deposits, null, 'd' + g.id) +
          '<button type="submit" class="btn btn--primary btn--sm" data-focus-key="ds-' + g.id + '">' + icon('plus') + 'Verser</button>' +
          '<button type="submit" class="btn btn--ghost btn--sm" data-withdraw formnovalidate data-focus-key="dw-' + g.id + '">' + icon('minus') + 'Retirer</button></form>' +
        (deps.length ? '<ul class="health-list health-list--money" role="list">' + deps.slice(0, 12).map(function (x) {
          return '<li><span class="health-list__date">' + esc(D.cap(D.dayMonthLong(x.date))) + '</span><strong>' + (x.amount < 0 ? 'Retrait' : 'Versement') + '</strong><span class="text-subtle"></span><span class="budget-amount ' + (x.amount < 0 ? '' : 'is-pos') + '">' + (x.amount < 0 ? '−' : '+') + NB + eur(Math.abs(x.amount)) + '</span>' + btns('deposits', x.id, 'ce versement') + '</li>';
        }).join('') + '</ul>' : '') + '</section>';
    }).join('') + '</div>' : '';
    el.innerHTML =
      head('Budget', 'Économies', 'h-savings', 'Une cagnotte par projet : BTS, iPhone, vacances… Chaque versement compte dans les économies de la semaine et du mois.') +
      periodBar() +
      '<div class="kpi-row kpi-row--2">' + tile('piggy', 'Épargné sur la période', eur(s.savings)) + tile('wallet', 'Total de toutes les cagnottes', eur(total), U.plural(b.goals.length, 'cagnotte')) + '</div>' +
      card('sv-add', 'Nouvelle cagnotte', '', addForm('goals', 'g', 'Créer')) +
      (goals || empty('Pas encore de cagnotte. Crée la première ci-dessus.'));
  }
  function bindStart(el) {
    el.addEventListener('change', function (e) {
      if (!e.target.closest('[data-b-start]')) return;
      B().startDay = +e.target.value;
      anchor = null;
      S.emit('budget', { startDay: true }, { now: true });
      U.toast({ icon: 'calendar', title: 'Le mois budgétaire commence le ' + (e.target.value === '1' ? '1er' : e.target.value), duration: 3000 });
      redrawAll();
    });
  }

  function bindSavings(el) {
    // « Retirer » : on mémorise le bouton utilisé pour l'envoi
    el.addEventListener('click', function (e) {
      var w = e.target.closest('[data-withdraw]');
      el.querySelectorAll('.deposit-form').forEach(function (f) { delete f.dataset.withdraw; });
      if (w) w.form.dataset.withdraw = '1';
    }, true);
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('.deposit-form');
      if (f && f.dataset.withdraw) f.setAttribute('data-b-form', 'withdraw');
      else if (f) f.setAttribute('data-b-form', 'deposits');
    }, true);
  }

  L.views = L.views || {};
  L.views.budget = makeView('budget', 'Budget', renderDash, bindStart);
  L.views.money = makeView('money', 'Entrées & dépenses', renderMoney, function (el) {
    bindAdd(el, function (k, v) { U.toast({ icon: 'check', title: (v.type === 'income' ? 'Entrée' : 'Dépense') + ' ajoutée', text: v.label + ' : ' + eur(v.amount), duration: 3000 }); });
  });
  L.views.bills = makeView('bills', 'Factures & 4x', renderBills, function (el) {
    bindAdd(el, function (k, v) { U.toast({ icon: 'check', title: (k === 'bills' ? 'Facture' : 'Paiement') + ' ajouté' + (k === 'bills' ? 'e' : ''), text: v.label, duration: 3000 }); });
  });
  L.views.savings = makeView('savings', 'Économies', renderSavings, function (el) {
    bindSavings(el);
    bindAdd(el, function (k, v) {
      if (k === 'deposits' && v.amount > 0) {
        var g = find('goals', v.goalId), saved = BG.goalSaved(B(), v.goalId);
        if (g && g.target && saved >= g.target && saved - v.amount < g.target) L.fun.celebrate({ title: 'Objectif « ' + g.name + ' » atteint !', text: eur(saved) + ' de côté. Incroyable !', duration: 4500 });
        else L.fun.celebrate({ title: eur(v.amount) + ' mis de côté', text: g ? 'Cagnotte « ' + g.name + ' »' : '' });
        return;
      }
      U.toast({ icon: 'piggy', title: k === 'goals' ? 'Cagnotte « ' + v.name + ' » créée' : 'Retrait de ' + eur(-v.amount), duration: 3000 });
    });
  });
})(window.Lamia = window.Lamia || {});
