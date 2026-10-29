/* ==========================================================================
   Plateforme de suivi - Lamia — espace « Budget »
   Quatre vues : vue d'ensemble (reste à vivre, frise du mois, enveloppes,
   bilan), mouvements (ajout express, recherche), charges fixes (paie,
   factures, paiements en plusieurs fois), épargne (cagnottes, versements
   automatiques, projection). Vue par semaine ou par mois.
   Calculs dans shared/budget.js (testé).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, BG = window.LamiaShared.budget;
  var esc = U.esc, icon = U.icon, NB = U.NB;

  // Catégories du budget (icône, plafond) : réglables dans « Mes enveloppes »
  function cats(kind) { return (S.budget().categories || []).filter(function (c) { return !kind || c.kind === kind; }); }
  function catIcon(name) { var c = BG.categoryOf(S.budget(), name); return c ? c.icon : (name ? '🏷️' : '✨'); }
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
      // Liste des catégories (icône + nom) ; une ancienne catégorie inconnue reste proposée
      var groups = def.kind ? [[def.kind, '']] : [['expense', 'Dépenses'], ['income', 'Entrées']], seen = false;
      input = '<select class="select" id="' + id + '" name="' + def.k + '" data-focus-key="' + id + '">' + groups.map(function (g) {
        var opts = cats(g[0]).map(function (c) { var on = v && c.name.toLowerCase() === String(v).toLowerCase(); if (on) seen = true; return '<option value="' + esc(c.name) + '"' + (on ? ' selected' : '') + '>' + esc(c.icon + ' ' + c.name) + '</option>'; }).join('');
        return g[1] ? '<optgroup label="' + g[1] + '">' + opts + '</optgroup>' : opts;
      }).join('') + (v && !seen ? '<option value="' + esc(v) + '" selected>🏷️ ' + esc(v) + '</option>' : '') + '</select>';
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
      { k: 'category', t: 'cat', label: 'Catégorie' }
    ],
    bills: [
      { k: 'label', t: 'text', label: 'Facture', ph: 'ex. Loyer, électricité…', req: true },
      { k: 'amount', t: 'money', label: 'Montant (€)', req: true },
      { k: 'day', t: 'day', label: 'Jour', ph: '5' },
      { k: 'every', t: 'select', label: 'Fréquence', opts: [['month', 'Tous les mois'], ['year', 'Une fois par an']], def: 'month' },
      { k: 'month', t: 'select', label: 'Mois (si annuelle)', num: true, opts: MONTHS.map(function (m, i) { return [i + 1, m]; }), def: 1 },
      { k: 'since', t: 'date', label: 'Depuis le' },
      { k: 'category', t: 'cat', label: 'Catégorie', kind: 'expense' }
    ],
    installments: [
      { k: 'label', t: 'text', label: 'Achat', ph: 'ex. iPhone, canapé…', req: true },
      { k: 'total', t: 'money', label: 'Montant total (€)', req: true },
      { k: 'count', t: 'count', label: 'Nombre d’échéances', opts: [2, 3, 4, 5, 6, 10, 12, 24].map(function (n) { return [n, n + ' fois']; }), def: 4 },
      { k: 'first', t: 'date', label: '1re échéance' },
      { k: 'category', t: 'cat', label: 'Catégorie', kind: 'expense' }
    ],
    incomes: [
      { k: 'label', t: 'text', label: 'Revenu', ph: 'ex. Paie, loyer perçu…', req: true },
      { k: 'amount', t: 'money', label: 'Montant habituel (€)', req: true },
      { k: 'day', t: 'day', label: 'Jour de versement', ph: '28' },
      { k: 'since', t: 'date', label: 'Depuis le' },
      { k: 'category', t: 'cat', label: 'Catégorie', kind: 'income' }
    ],
    plans: [
      { k: 'amount', t: 'money', label: 'Montant (€)', req: true },
      { k: 'day', t: 'day', label: 'Chaque mois, le', ph: '28' }
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
  var NAMES = { entries: 'Mouvement', bills: 'Facture', installments: 'Paiement', goals: 'Cagnotte', deposits: 'Versement', incomes: 'Revenu', plans: 'Versement automatique' };

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
    U.toast({ icon: 'trash', title: NAMES[kind] + ' supprimé' + (kind === 'bills' || kind === 'goals' ? 'e' : ''), duration: 6000,
      actions: [{ label: 'Annuler', fn: function () { var c = Object.assign({}, it); delete c.id; var n = S.addBudget(kind, c); n.id = it.id; } }] });
  }
  function bindEditDelete(el) {
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-b-edit]'))) editItem(b.getAttribute('data-b-edit'), b.getAttribute('data-id'), b);
      else if ((b = e.target.closest('[data-b-del]'))) removeItem(b.getAttribute('data-b-del'), b.getAttribute('data-id'), b);
    });
  }

  /* --- Paiements cochés « passés » ------------------------------------------------------ */
  function payState(x, today) {
    if (x.paid) return { cls: 'is-paid', label: 'payé' };
    if (x.date <= today) return { cls: 'is-check', label: 'à vérifier' };
    return { cls: 'is-future', label: 'à venir' };
  }
  function paidBox(key, label, checked) {
    return '<label class="checkbox pay-check" title="' + (checked ? 'Décocher' : 'Cocher quand le paiement est passé') + '">' +
      '<input class="checkbox__input" type="checkbox" data-b-paid="' + esc(key) + '" data-focus-key="pay-' + esc(key) + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="checkbox__box" aria-hidden="true"></span><span class="sr-only">Payé : ' + esc(label) + '</span></label>';
  }
  function dueItem(x, today) {
    var st = payState(x, today);
    return '<li class="due-item ' + st.cls + '">' + paidBox(x.key, x.label + ', ' + D.dayMonthLong(x.date), x.paid) +
      '<span class="health-list__date">' + esc(D.cap(D.dayMonthLong(x.date))) + '</span><strong>' + esc(x.label) + '</strong>' +
      '<span class="pay-state">' + (x.paid ? icon('check') : '') + st.label + '</span><span class="budget-amount">' + eur(x.amount) + '</span></li>';
  }
  function bindPaid(el) {
    function toggle(key, on, label) {
      S.setBudgetPaid(key, on);
      if (!on) return;
      // Dernière échéance d'un paiement en plusieurs fois : on fête ça
      var m = /^inst:(.+):\d{4}-\d{2}-\d{2}$/.exec(key), p = m && B().installments.filter(function (x) { return x.id === m[1]; })[0];
      if (p && BG.installmentStatus(p, D.today(), B().paid).done) L.fun.celebrate({ title: 'Paiement terminé !', text: p.label + ' est entièrement payé.' });
      else U.toast({ icon: 'check', title: 'Paiement coché', text: label || '', duration: 2200 });
    }
    el.addEventListener('change', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-b-paid');
      if (k && e.target.type === 'checkbox') toggle(k, e.target.checked, (e.target.closest('li') && e.target.closest('li').querySelector('strong') || {}).textContent);
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-b-paid]');
      if (b) toggle(b.getAttribute('data-b-paid'), b.getAttribute('aria-pressed') !== 'true', b.getAttribute('data-label'));
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
        bindPaid(el);
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
      if ((kind === 'bills' || kind === 'incomes') && !v.since) v.since = D.today();
      if (kind === 'plans') { v.goalId = f.getAttribute('data-goal'); v.since = D.today(); }
      if (kind === 'deposits' || kind === 'withdraw') {
        v.goalId = f.getAttribute('data-goal');
        if (kind === 'withdraw' || f.querySelector('[data-withdraw]:focus')) v.amount = -v.amount;
        kind = 'deposits';
      }
      S.addBudget(kind, v);
      if (after) after(kind, v);
    });
  }

  /* --- Ajout express d'une dépense (ou d'une entrée) ----------------------------------- */
  // Le montant en grand, un clic sur une catégorie, la date du jour : c'est noté.
  function quickAdd(type, returnTo) {
    type = type === 'income' ? 'income' : 'expense';
    function chips(kind) {
      return '<div class="quick-cats" role="radiogroup" aria-label="Catégorie" data-q-cats="' + kind + '"' + (kind === type ? '' : ' hidden') + '>' + cats(kind).map(function (c, i) {
        return '<label class="quick-cat"><input type="radio" name="qcat-' + kind + '" value="' + esc(c.name) + '"' + (i === 0 ? ' checked' : '') + '><span><span class="quick-cat__icon" aria-hidden="true">' + c.icon + '</span>' + esc(c.name) + '</span></label>';
      }).join('') + '</div>';
    }
    U.dialog({
      title: 'Ajout express', confirmLabel: 'Ajouter', returnTo: returnTo, size: 'md', initialFocus: '#q-amount',
      fallbackFocus: function () { return document.querySelector('.view:not([hidden]) h1'); },
      body: '<div class="quick">' +
        '<div class="segmented quick__type" role="radiogroup" aria-label="Type">' +
          '<label class="segmented__item"><input class="sr-only" type="radio" name="qtype" value="expense"' + (type === 'expense' ? ' checked' : '') + '>Dépense</label>' +
          '<label class="segmented__item"><input class="sr-only" type="radio" name="qtype" value="income"' + (type === 'income' ? ' checked' : '') + '>Entrée</label></div>' +
        '<label class="quick__amount"><span class="sr-only">Montant en euros</span><input class="input" id="q-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00"><span aria-hidden="true">€</span></label>' +
        chips('expense') + chips('income') +
        '<div class="quick__more"><div class="field"><label class="label" for="q-label">Libellé (facultatif)</label><input class="input" id="q-label" name="label" maxlength="60" placeholder="ex. Carrefour, ciné…"></div>' +
        '<div class="field"><label class="label" for="q-date">Date</label><input class="input" type="date" id="q-date" name="date" value="' + D.today() + '"></div></div>' +
      '</div>',
      onConfirm: function (form) {
        var t = (form.querySelector('[name="qtype"]:checked') || {}).value || 'expense';
        var n = num(form.querySelector('#q-amount').value);
        if (!(n > 0) || n > 1e7) { warn('Montant', 'Indique un montant, par exemple 12,50.'); form.querySelector('#q-amount').focus(); return false; }
        var cat = (form.querySelector('[name="qcat-' + t + '"]:checked') || {}).value || '';
        var label = form.querySelector('#q-label').value.trim() || cat || (t === 'income' ? 'Entrée' : 'Dépense');
        var v = { type: t, date: form.querySelector('#q-date').value || D.today(), label: label, amount: Math.round(n * 100) / 100, category: cat };
        S.addBudget('entries', v);
        var env = t === 'expense' ? BG.envelopes(B(), BG.budgetMonth(v.date, B().startDay).start, BG.budgetMonth(v.date, B().startDay).end).filter(function (e) { return e.category.name === cat; })[0] : null;
        U.toast({ icon: 'check', title: (t === 'income' ? 'Entrée' : 'Dépense') + ' ajoutée : ' + eur(v.amount), duration: 3500,
          text: env ? catIcon(cat) + ' ' + cat + ' : ' + (env.left >= 0 ? 'il reste ' + eur(env.left) + ' dans l’enveloppe' : 'enveloppe dépassée de ' + eur(-env.left)) : label });
      }
    });
    // Bascule Dépense / Entrée : on montre les bonnes catégories
    var ov = document.getElementById('overlay-dialog');
    ov.querySelectorAll('[name="qtype"]').forEach(function (r) {
      r.addEventListener('change', function () { ov.querySelectorAll('[data-q-cats]').forEach(function (g) { g.hidden = g.getAttribute('data-q-cats') !== r.value; }); });
    });
  }
  L.budgetQuick = { open: quickAdd };

  /* --- Enveloppes : plafonds par catégorie et catégories personnalisées -------------- */
  function editEnvelopes(btn) {
    var list = cats().map(function (c) { return Object.assign({}, c); });
    U.dialog({
      title: 'Mes enveloppes et catégories', confirmLabel: 'Enregistrer', returnTo: btn, size: 'md',
      desc: 'Un plafond par mois pour les catégories que tu veux surveiller. Laisse vide : pas d’enveloppe.',
      body: '<ul class="env-edit" role="list">' + list.filter(function (c) { return c.kind === 'expense'; }).map(function (c) {
        return '<li><span class="env-edit__icon" aria-hidden="true">' + c.icon + '</span><label class="env-edit__name" for="env-' + c.id + '">' + esc(c.name) + '</label>' +
          '<span class="input-suffix"><input class="input" id="env-' + c.id + '" data-env="' + c.id + '" inputmode="decimal" placeholder="—" value="' + esc(money(c.limit)) + '"><span>€</span></span></li>';
      }).join('') + '</ul>' +
        '<fieldset class="env-new"><legend class="label">Nouvelle catégorie</legend><input class="input env-new__icon" name="newIcon" maxlength="4" placeholder="🏷️" aria-label="Icône (émoji)">' +
        '<input class="input" name="newName" maxlength="30" placeholder="ex. Animaux, Voyages…" aria-label="Nom de la catégorie">' +
        '<select class="select" name="newKind" aria-label="Type"><option value="expense">Dépense</option><option value="income">Entrée</option></select></fieldset>',
      onConfirm: function (form) {
        for (var i = 0; i < list.length; i++) {
          var inp = form.querySelector('[data-env="' + list[i].id + '"]');
          if (!inp) continue;
          var raw = inp.value.trim(), n = num(raw);
          if (raw && !(n > 0)) { warn('Plafond', list[i].name + ' : indique un montant, par exemple 250.'); inp.focus(); return false; }
          list[i].limit = raw ? Math.round(n * 100) / 100 : null;
        }
        var nn = form.querySelector('[name="newName"]').value.trim();
        if (nn) {
          if (list.some(function (c) { return c.name.toLowerCase() === nn.toLowerCase(); })) { warn('Catégorie', '« ' + nn + ' » existe déjà.'); return false; }
          list.push({ id: S.uid('bc'), name: nn, icon: form.querySelector('[name="newIcon"]').value.trim() || '🏷️', kind: form.querySelector('[name="newKind"]').value, limit: null });
        }
        S.setBudgetCategories(list);
        U.toast({ icon: 'check', title: 'Enveloppes enregistrées', duration: 2500 });
      }
    });
  }

  /* --- Bilan d'un mois budgétaire ------------------------------------------------------- */
  function monthBilan(p, prev) {
    var s = BG.summary(B(), p.start, p.end), q = BG.summary(B(), prev.start, prev.end), envs = BG.envelopes(B(), p.start, p.end, p.end);
    function delta(a, b, good) {
      if (!b) return '';
      var d = BG.cents(a - b), up = d > 0;
      if (Math.abs(d) < 0.01) return '<span class="bilan__delta">= mois d’avant</span>';
      return '<span class="bilan__delta ' + ((up === (good === 'up')) ? 'is-good' : 'is-bad') + '">' + (up ? '+' : '−') + NB + eur(Math.abs(d)) + ' vs mois d’avant</span>';
    }
    var kept = envs.filter(function (e) { return e.used <= e.limit; }).length;
    var top = s.byCategory.slice(0, 3);
    var mood = s.rest >= 0
      ? (s.savings > 0 ? 'Mois réussi : ' + eur(s.savings) + ' mis de côté et ' + eur(s.rest) + ' d’avance. Bravo !' : 'Mois à l’équilibre, avec ' + eur(s.rest) + ' d’avance. Bien joué.')
      : 'Mois un peu serré (' + eur(s.rest) + '). On regarde les enveloppes ensemble pour le prochain ?';
    return '<div class="bilan">' +
      '<p class="bilan__lead">' + U.pixelImg(s.rest >= 0 ? 'star' : 'heart', 2, 'bilan__px', '') + esc(mood) + '</p>' +
      '<div class="bilan__figs">' +
        '<div><span>Revenus</span><strong>' + eur(s.income) + '</strong>' + delta(s.income, q.income, 'up') + '</div>' +
        '<div><span>Dépenses</span><strong>' + eur(s.expenses) + '</strong>' + delta(s.expenses, q.expenses, 'down') + '</div>' +
        '<div><span>Épargne</span><strong>' + eur(s.savings) + '</strong>' + delta(s.savings, q.savings, 'up') + '</div>' +
        '<div><span>Reste</span><strong class="' + (s.rest < 0 ? 'is-neg' : 'is-pos') + '">' + eur(s.rest) + '</strong>' + delta(s.rest, q.rest, 'up') + '</div>' +
      '</div>' +
      (top.length ? '<h3 class="bilan__h">Où est parti l’argent</h3><ol class="bilan__top">' + top.map(function (c) { return '<li><span aria-hidden="true">' + catIcon(c.category) + '</span>' + esc(c.category) + '<strong>' + eur(c.amount) + '</strong></li>'; }).join('') + '</ol>' : '') +
      (envs.length ? '<p class="hint">Enveloppes respectées : ' + kept + ' sur ' + envs.length + '.</p>' : '') +
    '</div>';
  }
  function openBilan(btn, offset) {
    var cur = BG.budgetMonth(D.today(), B().startDay), p = BG.budgetMonth(D.addMonths(cur.start, offset == null ? -1 : offset), B().startDay), prev = BG.budgetMonth(D.addMonths(p.start, -1), B().startDay);
    U.dialog({ title: 'Bilan · ' + p.label, confirmLabel: 'Fermer', cancel: false, returnTo: btn, size: 'md', body: monthBilan(p, prev) });
  }

  function budgetVoice(f) {
    var gs = B().goals, opts = [];
    if (f.income > 0 && f.rest < 0) opts.push({ lamia: 'Le mois est un peu serré. On regarde ensemble les enveloppes ?', lamiaAnim: 'typing' });
    if (f.income > 0 && f.rest >= 0 && f.daysLeft > 0) opts.push({ lamia: 'Il te reste ' + eur(f.perDay) + ' par jour jusqu’à la fin du mois. On garde le cap !', lamiaAnim: 'wave' });
    if (f.savings > 0) opts.push({ lamia: eur(f.savings) + ' mis de côté ce mois-ci. Ton futur toi te remercie !', lamiaAnim: 'cheer' });
    gs.forEach(function (g) { if (g.target) { var pr = BG.goalProjection(B(), g); if (pr.date && !pr.reached) opts.push({ lamia: 'À ce rythme, « ' + g.name + ' » est financé en ' + D.monthYear(pr.date) + '. On y arrive !', lamiaAnim: 'cheer' }); } });
    if (f.income === 0) opts.push({ lamia: 'Ajoute ta paie dans Charges fixes : je calcule ton reste à vivre chaque jour.', lamiaAnim: 'wave' });
    opts.push({ lamia: 'Une dépense ? Le bouton « + Dépense », un montant, une catégorie : c’est noté.', lamiaAnim: 'wave' });
    return opts[Math.floor(Math.random() * Math.min(opts.length, 2))];
  }

  /* === 1. Vue d'ensemble ================================================================ */
  function restCard(f, m) {
    if (!f.income) {
      return '<section class="glass card rest-card rest-card--empty" aria-labelledby="bd-rest"><h2 class="card__title" id="bd-rest">Reste à vivre</h2>' +
        '<p>Ajoute ta paie (et tes autres revenus réguliers) dans <a href="#factures">Charges fixes</a> : je calcule ce qu’il te reste vraiment, chaque jour.</p>' +
        '<a class="btn btn--secondary btn--sm" href="#factures">' + icon('plus') + 'Ajouter ma paie</a></section>';
    }
    var neg = f.rest < 0;
    return '<section class="glass card rest-card" aria-labelledby="bd-rest">' +
      '<div class="rest-card__main"><p class="rest-card__eyebrow" id="bd-rest">Reste à vivre · ' + esc(m.label) + '</p>' +
        '<p class="rest-card__value' + (neg ? ' is-neg' : '') + '">' + eur(f.rest) + '</p>' +
        '<p class="rest-card__per">' + (f.daysLeft > 0 ? (neg ? 'Le mois est dans le rouge : on regarde les enveloppes ?' : 'soit <strong>' + eur(f.perDay) + ' par jour</strong> jusqu’au ' + esc(D.dayMonthLong(m.end))) : 'Mois terminé.') + '</p></div>' +
      '<div class="rest-card__bars">' +
        '<div class="rest-bar"><span>Mois écoulé</span><span class="rest-bar__track"><span style="width:' + f.timePct + '%"></span></span><strong>' + f.timePct + NB + '%</strong></div>' +
        '<div class="rest-bar rest-bar--money' + (f.moneyPct > f.timePct + 10 ? ' is-ahead' : '') + '"><span>Budget utilisé</span><span class="rest-bar__track"><span style="width:' + f.moneyPct + '%"></span></span><strong>' + f.moneyPct + NB + '%</strong></div>' +
        '<p class="rest-card__hint">' + (f.moneyPct > f.timePct + 10 ? 'Tu dépenses un peu plus vite que le mois n’avance.' : 'Tes dépenses suivent le rythme du mois. Parfait.') + '</p>' +
      '</div>' +
      '<dl class="rest-card__figs">' +
        '<div><dt>Revenus</dt><dd>' + eur(f.income) + '</dd></div>' +
        '<div><dt>Déjà dépensé</dt><dd>' + eur(f.spent) + '</dd></div>' +
        '<div><dt>À venir (fixes)</dt><dd>' + eur(f.upcoming) + '</dd></div>' +
        '<div><dt>Épargne prévue</dt><dd>' + eur(f.savings) + '</dd></div>' +
      '</dl></section>';
  }
  var KIND_ICON = { income: '💼', bill: '🧾', installment: '💳', saving: '🐷' };
  var SHORT_MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  function evIcon(e) { return e.kind === 'bill' ? catIcon((B().bills.filter(function (x) { return e.key && e.key.indexOf(':' + x.id + ':') > 0; })[0] || {}).category) : KIND_ICON[e.kind]; }
  function timelineCard(m, today) {
    var ev = BG.monthEvents(B(), m.start, m.end), total = D.diff(m.start, m.end) || 1;
    var pos = function (d) { return Math.max(0, Math.min(100, (D.diff(m.start, d) / total) * 100)); };
    var next = ev.filter(function (e) { return e.date >= today && e.kind !== 'income'; })[0], pay = ev.filter(function (e) { return e.kind === 'income' && e.date >= today; })[0];
    var inMonth = D.between(today, m.start, m.end);
    // Un repère par jour : plusieurs événements le même jour sont regroupés
    var byDay = {}, days = [];
    ev.forEach(function (e) { if (!byDay[e.date]) { byDay[e.date] = []; days.push(e.date); } byDay[e.date].push(e); });
    var marks = days.map(function (d) {
      var g = byDay[d], first = g.filter(function (e) { return e.kind === 'income'; })[0] || g[0];
      var allPaid = g.every(function (e) { return e.kind === 'income' || e.kind === 'saving' || e.paid; });
      return '<li class="tl-mark tl-mark--' + first.kind + (d < today ? ' is-past' : '') + (allPaid && g.some(function (e) { return e.paid; }) ? ' is-paid' : '') + '" style="left:' + pos(d).toFixed(2) + '%" title="' + esc(D.dayMonth(d) + ' · ' + g.map(function (e) { return e.label + ' ' + eur(e.amount); }).join(' · ')) + '">' +
        '<span class="tl-mark__dot" aria-hidden="true">' + evIcon(first) + (g.length > 1 ? '<span class="tl-mark__n">' + g.length + '</span>' : '') + '</span>' +
        '<span class="sr-only">' + esc(D.dayMonthLong(d) + ' : ' + g.map(function (e) { return e.label + ', ' + eur(e.amount); }).join(' ; ')) + '</span></li>';
    }).join('');
    var upcoming = ev.filter(function (e) { return e.date >= today; }).slice(0, 4);
    return card('bd-tl', 'Ton mois en un coup d’œil', esc(m.label),
      '<div class="tl" aria-hidden="false"><ol class="tl__track" role="list">' + marks + '</ol>' +
        (inMonth ? '<span class="tl__today" style="left:' + pos(today).toFixed(2) + '%"><span>Aujourd’hui</span></span>' : '') +
        '<div class="tl__ends"><span>' + esc(D.dayMonth(m.start)) + '</span><span>' + esc(D.dayMonth(m.end)) + '</span></div></div>' +
      (next ? '<p class="tl__next">' + icon('bell') + 'Prochain prélèvement ' + (next.date === today ? '<strong>aujourd’hui</strong>' : 'dans <strong>' + U.plural(D.diff(today, next.date), 'jour') + '</strong>') + ' : ' + esc(next.label) + ' · ' + eur(next.amount) + '</p>' : '') +
      (pay ? '<p class="tl__next tl__next--pay">💼 Prochaine paie ' + (pay.date === today ? '<strong>aujourd’hui</strong>' : 'dans <strong>' + U.plural(D.diff(today, pay.date), 'jour') + '</strong>') + ' · ' + eur(pay.amount) + '</p>' : '') +
      (upcoming.length ? '<ul class="tl__list" role="list">' + upcoming.map(function (e) { return '<li><span>' + esc(D.cap(D.dayMonth(e.date))) + '</span><span>' + (e.kind === 'income' ? '💼 ' : '') + esc(e.label) + '</span><strong class="' + (e.kind === 'income' ? 'is-pos' : '') + '">' + (e.kind === 'income' ? '+' : '−') + NB + eur(e.amount) + '</strong></li>'; }).join('') + '</ul>' : '') +
      (ev.length ? '' : empty('Ajoute ta paie et tes factures dans Charges fixes : elles s’afficheront ici.')), 'tl-card');
  }
  function envelopesCard(m, today) {
    var envs = BG.envelopes(B(), m.start, m.end, today);
    var body = envs.length ? '<ul class="env-list" role="list">' + envs.map(function (e) {
      var st = e.pct > 100 ? 'is-over' : e.pct >= 80 ? 'is-warn' : '';
      return '<li class="env ' + st + '"><div class="env__head"><span class="env__icon" aria-hidden="true">' + e.category.icon + '</span><strong>' + esc(e.category.name) + '</strong>' +
        '<span class="env__amount">' + eur(e.used) + ' / ' + eur(e.limit) + '</span></div>' +
        '<div class="env__track" role="progressbar" aria-valuenow="' + Math.min(100, e.pct) + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(e.category.name) + '"><span style="width:' + Math.min(100, e.pct) + '%"></span>' + (e.planned > 0 ? '<span class="env__planned" style="left:' + Math.min(100, (e.spent / e.limit) * 100) + '%;width:' + Math.min(100 - Math.min(100, (e.spent / e.limit) * 100), (e.planned / e.limit) * 100) + '%"></span>' : '') + '</div>' +
        '<p class="env__note">' + (e.left >= 0 ? 'Il reste ' + eur(e.left) + (e.pct >= 80 ? ' : on lève un peu le pied ?' : '') : 'Dépassée de ' + eur(-e.left) + ', pas grave : on ajuste le mois prochain.') + (e.planned > 0 ? ' · dont ' + eur(e.planned) + ' déjà prévus' : '') + '</p></li>';
    }).join('') + '</ul>' : '<p class="hint">Fixe un plafond par mois pour les catégories que tu veux surveiller (Courses, Restaurants, Shopping…). Je te préviens gentiment à 80 %.</p>';
    return '<section class="glass card" aria-labelledby="bd-env"><div class="card__header"><div><h2 class="card__title" id="bd-env">Mes enveloppes</h2><p class="card__subtitle">Plafonds du mois, par catégorie</p></div>' +
      '<button type="button" class="btn btn--secondary btn--sm" data-b-envelopes>' + icon('edit') + (envs.length ? 'Modifier' : 'Créer mes enveloppes') + '</button></div>' + body + '</section>';
  }
  function trendChart() {
    var rows = [], a = anchor || D.today(), max = 1;
    for (var i = 5; i >= 0; i--) {
      var p = periodAt(shiftAnchor(a, -i)), s = BG.summary(B(), p.start, p.end);
      max = Math.max(max, s.income, s.expenses);
      rows.push({ p: p, s: s, cur: i === 0 });
    }
    return '<div class="bars" role="img" aria-label="Revenus et dépenses des 6 dernières périodes">' + rows.map(function (r) {
      var lab = zoom === 'week' ? 'S' + D.isoWeek(r.p.start) : SHORT_MONTHS[D.parse(B().startDay > 15 ? r.p.end : r.p.start).getMonth()];
      return '<div class="bars__col' + (r.cur ? ' is-current' : '') + '"><div class="bars__pair">' +
        '<span class="bars__bar bars__bar--in" style="height:' + Math.round((r.s.income / max) * 100) + '%" title="Revenus ' + eur(r.s.income) + '"></span>' +
        '<span class="bars__bar bars__bar--out" style="height:' + Math.round((r.s.expenses / max) * 100) + '%" title="Dépenses ' + eur(r.s.expenses) + '"></span></div>' +
        '<span class="bars__label">' + esc(lab) + '</span><span class="bars__rest ' + (r.s.rest < 0 ? 'is-neg' : 'is-pos') + '">' + (r.s.rest < 0 ? '−' : '+') + NB + eur(Math.abs(r.s.rest)).replace(/,00\s?€/, NB + '€') + '</span></div>';
    }).join('') + '</div><p class="chart-legend"><span class="bars__key bars__key--in"></span>Revenus <span class="bars__key bars__key--out"></span>Dépenses · sous chaque mois : ce qu’il est resté</p>';
  }
  function goalsSummary() {
    var gs = B().goals;
    if (!gs.length) return empty('Crée une cagnotte (BTS, iPhone…) dans Épargne.');
    return '<ul class="goal-list" role="list">' + gs.map(function (g) {
      var pr = BG.goalProjection(B(), g), pct = g.target ? Math.max(0, Math.min(100, Math.round((pr.saved / g.target) * 100))) : null;
      return '<li><div class="goal-list__head"><strong>' + esc(g.name) + '</strong><span>' + eur(pr.saved) + (g.target ? ' / ' + eur(g.target) : '') + '</span></div>' +
        (pct != null ? '<div class="progress" style="--value:' + pct + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(g.name) + '"></div>' : '') +
        (pr.date ? '<p class="hint">Objectif atteint vers ' + esc(D.monthYear(pr.date)) + (pr.auto ? ' · ' + eur(pr.monthly) + '/mois automatiques' : '') + '</p>' : pr.reached ? '<p class="hint">Objectif atteint, bravo !</p>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function bilanBanner(today) {
    var cur = BG.budgetMonth(today, B().startDay);
    if (D.diff(cur.start, today) > 7) return '';
    var prev = BG.budgetMonth(D.addMonths(cur.start, -1), B().startDay), s = BG.summary(B(), prev.start, prev.end);
    if (!s.income && !s.expenses) return '';
    return '<section class="glass card bilan-banner" aria-labelledby="bd-bilan"><span class="bilan-banner__icon" aria-hidden="true">' + U.pixelImg('star', 3, '', '') + '</span>' +
      '<div><h2 class="card__title" id="bd-bilan">Ton bilan est prêt</h2><p class="card__subtitle">' + esc(prev.label) + ' : ' + (s.rest >= 0 ? eur(s.rest) + ' d’avance' : eur(s.rest)) + (s.savings > 0 ? ', ' + eur(s.savings) + ' épargnés' : '') + '</p></div>' +
      '<button type="button" class="btn btn--primary btn--sm" data-b-bilan="-1">Voir le bilan</button></section>';
  }
  function renderDash(el) {
    var today = D.today(), m = BG.budgetMonth(today, B().startDay), f = BG.forecast(B(), m.start, m.end, today);
    var p = period(), s = BG.summary(B(), p.start, p.end);
    var due = s.items.filter(function (x) { return x.source !== 'entry'; });
    var dueList = due.length ? '<ul class="health-list health-list--due" role="list">' + due.map(function (x) { return dueItem(x, today); }).join('') + '</ul>' +
      '<p class="hint">Coche chaque paiement quand il est passé sur ton compte.</p>' : empty('Aucune facture ni échéance sur cette période.');
    var paidN = due.filter(function (x) { return x.paid; }).length, checkN = due.filter(function (x) { return !x.paid && x.date <= today; }).length;
    var byCat = s.byCategory.length ? '<ul class="cat-bars" role="list">' + s.byCategory.slice(0, 8).map(function (c) {
      var pct = s.expenses ? Math.round((c.amount / s.expenses) * 100) : 0;
      return '<li><span class="cat-bars__icon" aria-hidden="true">' + catIcon(c.category) + '</span><span class="cat-bars__name">' + esc(c.category) + '</span><span class="cat-bars__track"><span style="width:' + pct + '%"></span></span><strong>' + eur(c.amount) + '</strong></li>';
    }).join('') + '</ul>' : empty('Aucune dépense sur cette période.');
    el.innerHTML =
      head('Budget', 'Vue d’ensemble', 'h-budget', 'Ce qu’il te reste vraiment, ce qui arrive, et où va ton argent.',
        '<button type="button" class="btn btn--primary btn--sm" data-b-quick="expense">' + icon('plus') + 'Dépense</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-b-quick="income">' + icon('plus') + 'Entrée</button>' +
        '<a class="btn btn--secondary btn--sm" href="#epargne">' + icon('piggy') + 'Épargner</a>') +
      bilanBanner(today) +
      restCard(f, m) +
      '<div class="health-grid budget-top">' + timelineCard(m, today) + envelopesCard(m, today) + '</div>' +
      '<div class="mini-slot" data-mini-slot></div>' +
      periodBar() +
      '<div class="health-grid">' +
        card('bd-cat', 'Dépenses par catégorie', esc(p.label) + ' · ' + eur(s.expenses), byCat) +
        card('bd-due', 'Factures et échéances', due.length ? paidN + ' payé' + (paidN > 1 ? 's' : '') + ' sur ' + due.length + (checkN ? ' · ' + checkN + ' à vérifier' : '') : 'Prélèvements et paiements en plusieurs fois de la période', dueList) +
        card('bd-trend', 'Évolution', '6 dernières ' + (zoom === 'week' ? 'semaines' : 'périodes'), trendChart() + '<button type="button" class="btn btn--ghost btn--sm" data-b-bilan="-1">' + icon('recap') + 'Bilan du mois dernier</button>') +
        card('bd-goals', 'Cagnottes', '', goalsSummary()) +
      '</div>';
    L.fun.miniScene(el.querySelector('[data-mini-slot]'), 'budget', budgetVoice(f));
  }

  /* === 2. Mouvements ======================================================================= */
  var moneyFilter = { q: '', cat: '', type: '' };
  function renderMoney(el) {
    var p = period(), s = BG.summary(B(), p.start, p.end), q = moneyFilter.q.toLowerCase();
    var all = B().entries.filter(function (x) { return D.between(x.date, p.start, p.end); });
    var list = all.filter(function (x) {
      return (!moneyFilter.type || x.type === moneyFilter.type) && (!moneyFilter.cat || (x.category || '') === moneyFilter.cat) &&
        (!q || (x.label + ' ' + (x.category || '')).toLowerCase().indexOf(q) >= 0 || String(x.amount).replace('.', ',').indexOf(q) >= 0);
    }).sort(function (a, c) { return a.date < c.date ? 1 : a.date > c.date ? -1 : 0; });
    var used = {}; all.forEach(function (x) { if (x.category) used[x.category] = true; });
    var days = {}, order = [];
    list.forEach(function (x) { if (!days[x.date]) { days[x.date] = []; order.push(x.date); } days[x.date].push(x); });
    var rows = order.length ? order.map(function (d) {
      var tot = days[d].reduce(function (a, x) { return a + (x.type === 'income' ? x.amount : -x.amount); }, 0);
      return '<section class="day-group"><h3 class="day-group__head"><span>' + esc(D.cap(D.dayMonthLong(d))) + '</span><span class="' + (tot >= 0 ? 'is-pos' : '') + '">' + (tot >= 0 ? '+' : '−') + NB + eur(Math.abs(tot)) + '</span></h3>' +
        '<ul class="health-list health-list--money mv-list" role="list">' + days[d].map(function (x) {
          return '<li><span class="mv-icon" aria-hidden="true">' + catIcon(x.category) + '</span><strong>' + esc(x.label) + '</strong><span class="text-subtle">' + esc(x.category || '') + '</span>' +
            '<span class="budget-amount ' + (x.type === 'income' ? 'is-pos' : '') + '">' + (x.type === 'income' ? '+' : '−') + NB + eur(x.amount) + '</span>' + btns('entries', x.id, x.label) + '</li>';
        }).join('') + '</ul></section>';
    }).join('') : empty(all.length ? 'Aucun mouvement ne correspond à ta recherche.' : 'Aucune entrée ni dépense notée sur cette période.');
    var catOpts = '<option value="">Toutes les catégories</option>' + Object.keys(used).sort().map(function (c) { return '<option value="' + esc(c) + '"' + (c === moneyFilter.cat ? ' selected' : '') + '>' + esc(catIcon(c) + ' ' + c) + '</option>'; }).join('');
    el.innerHTML =
      head('Budget', 'Mouvements', 'h-money', 'Tes dépenses et rentrées ponctuelles. La paie, les factures et les paiements en plusieurs fois se comptent tout seuls.',
        '<button type="button" class="btn btn--primary btn--sm" data-b-quick="expense">' + icon('plus') + 'Dépense</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-b-quick="income">' + icon('plus') + 'Entrée</button>') +
      periodBar() +
      '<div class="kpi-row kpi-row--3">' + tile('arrow-down', 'Entrées', eur(s.income)) + tile('arrow-up', 'Dépenses ponctuelles', eur(all.filter(function (x) { return x.type === 'expense'; }).reduce(function (a, x) { return a + x.amount; }, 0))) + tile('receipt', 'Charges fixes', eur(s.items.filter(function (x) { return x.source !== 'entry'; }).reduce(function (a, x) { return a + x.amount; }, 0))) + '</div>' +
      '<section class="glass card" aria-labelledby="m-list"><div class="card__header"><div><h2 class="card__title" id="m-list">Mouvements</h2><p class="card__subtitle">' + esc(p.label) + ' · ' + U.plural(list.length, 'mouvement') + '</p></div></div>' +
        '<div class="mv-filters"><label class="sr-only" for="mv-q">Rechercher</label><span class="mv-search">' + icon('search') + '<input class="input" id="mv-q" data-mv-q data-focus-key="mv-q" placeholder="Rechercher (libellé, montant…)" value="' + esc(moneyFilter.q) + '"></span>' +
          '<label class="sr-only" for="mv-cat">Catégorie</label><select class="select" id="mv-cat" data-mv-cat data-focus-key="mv-cat">' + catOpts + '</select>' +
          '<div class="segmented" role="group" aria-label="Type">' + [['', 'Tout'], ['expense', 'Dépenses'], ['income', 'Entrées']].map(function (t) { return '<button type="button" class="segmented__item" data-mv-type="' + t[0] + '" data-focus-key="mv-t' + t[0] + '" aria-pressed="' + (moneyFilter.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
        rows + '</section>' +
      '<details class="glass card data-twin mv-form"><summary>Ajouter avec tous les détails</summary>' + addForm('entries', 'n') + '</details>';
  }
  function bindMoney(el) {
    var t = null;
    el.addEventListener('input', function (e) {
      if (!e.target.hasAttribute('data-mv-q')) return;
      moneyFilter.q = e.target.value; clearTimeout(t);
      t = setTimeout(function () { U.keepFocus(el, function () { renderMoney(el); }); }, 160);
    });
    el.addEventListener('change', function (e) { if (e.target.hasAttribute('data-mv-cat')) { moneyFilter.cat = e.target.value; U.keepFocus(el, function () { renderMoney(el); }); } });
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-mv-type]'); if (b) { moneyFilter.type = b.getAttribute('data-mv-type'); U.keepFocus(el, function () { renderMoney(el); }); } });
  }

  /* === 3. Charges fixes : revenus réguliers, factures, paiements en plusieurs fois ========= */
  function renderBills(el) {
    var b = B(), today = D.today(), bm = BG.budgetMonth(today, b.startDay);
    var monthly = b.bills.reduce(function (a, x) { return a + (x.every === 'year' ? x.amount / 12 : x.amount); }, 0);
    var incMonth = BG.incomeItems(b, bm.start, bm.end).filter(function (x) { return x.source === 'income'; });
    var incomes = b.incomes.length ? '<ul class="health-list health-list--money" role="list">' + b.incomes.map(function (x) {
      var occ = incMonth.filter(function (o) { return o.id === x.id; }).map(function (o) {
        return '<span class="bill-pay"><span>' + esc(D.dayMonth(o.date)) + ' · ' + eur(o.amount) + (o.adjusted ? ' (corrigé)' : '') + '</span>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-b-adjust="' + esc(o.key) + '" data-amount="' + o.amount + '" data-label="' + esc(x.label) + '">Montant différent ce mois-ci ?</button></span>';
      }).join('');
      return '<li><span class="health-list__date">le ' + x.day + ' de chaque mois</span><strong>' + catIcon(x.category) + ' ' + esc(x.label) + '</strong><span class="text-subtle">' + esc(x.category || '') + '</span><span class="budget-amount is-pos">+' + NB + eur(x.amount) + '</span>' + btns('incomes', x.id, x.label) +
        (occ ? '<span class="bill-pays">' + occ + '</span>' : '') + '</li>';
    }).join('') + '</ul>' : empty('Ajoute ta paie : elle arrive toute seule chaque mois, et ton reste à vivre se calcule automatiquement.');
    var bills = b.bills.length ? '<ul class="health-list health-list--money" role="list">' + b.bills.slice().sort(function (a, c) { return a.day - c.day; }).map(function (x) {
      var when = x.every === 'year' ? 'le ' + x.day + ' ' + MONTHS[(x.month || 1) - 1] + ', chaque année' : 'le ' + x.day + ' de chaque mois';
      var occ = BG.billDates(x, bm.start, bm.end).map(function (d) {
        var o = { date: d, key: BG.paidKey('bill', x.id, d), paid: BG.isPaid(b.paid, 'bill', x.id, d), label: x.label }, st = payState(o, today);
        return '<span class="bill-pay ' + st.cls + '">' + paidBox(o.key, x.label + ', ' + D.dayMonthLong(d), o.paid) + '<span>' + esc(D.dayMonth(d)) + ' · ' + st.label + '</span></span>';
      }).join('');
      return '<li><span class="health-list__date">' + esc(when) + '</span><strong>' + catIcon(x.category) + ' ' + esc(x.label) + '</strong><span class="text-subtle">' + esc(x.category || '') + '</span><span class="budget-amount">' + eur(x.amount) + '</span>' + btns('bills', x.id, x.label) +
        (occ ? '<span class="bill-pays">' + occ + '</span>' : '') + '</li>';
    }).join('') + '</ul>' : empty('Ajoute tes factures (loyer, forfait, assurances…) : elles seront comptées chaque mois automatiquement.');
    var inst = b.installments.length ? '<ul class="inst-list" role="list">' + b.installments.map(function (x) {
      var st = BG.installmentStatus(x, today, b.paid), pct = Math.round((st.paidCount / st.schedule.length) * 100);
      return '<li class="glass glass--nested inst-card"><div class="inst-card__head"><strong>' + esc(x.label) + '</strong><span class="budget-amount">' + eur(x.total) + '</span>' + btns('installments', x.id, x.label) + '</div>' +
        '<div class="progress" style="--value:' + pct + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Échéances payées"></div>' +
        '<p class="inst-card__meta">' + st.paidCount + '/' + st.schedule.length + ' payées · ' + (st.done ? 'Terminé, bravo !' : 'reste ' + eur(st.remaining) + ' · prochaine le ' + esc(D.dayMonth(st.next.date)) + ' (' + eur(st.next.amount) + ')') + '</p>' +
        '<ol class="inst-steps">' + st.schedule.map(function (s) {
          var cls = s.paid ? 'is-paid' : s.date <= today ? 'is-check' : '';
          return '<li class="' + cls + '"><button type="button" class="inst-step" data-b-paid="' + esc(s.key) + '" data-label="' + esc(x.label + ' ' + s.n + '/' + s.of) + '" data-focus-key="pay-' + esc(s.key) + '" aria-pressed="' + s.paid + '" aria-label="Échéance ' + s.n + ' sur ' + s.of + ', ' + esc(D.dayMonthLong(s.date)) + ', ' + eur(s.amount) + (s.paid ? ', payée' : ', à cocher') + '">' +
            '<span class="inst-step__box" aria-hidden="true">' + (s.paid ? icon('check') : '') + '</span><span>' + esc(D.dayMonth(s.date)) + '</span><span>' + eur(s.amount) + '</span></button></li>';
        }).join('') + '</ol><p class="hint">Touche une échéance pour la cocher quand elle est passée.</p></li>';
    }).join('') + '</ul>' : empty('Ajoute un paiement en 4 fois (ou plus) : chaque échéance apparaîtra dans le mois où elle tombe.');
    var incTotal = b.incomes.reduce(function (a, x) { return a + x.amount; }, 0);
    el.innerHTML =
      head('Budget', 'Charges fixes', 'h-bills', 'Tout ce qui revient chaque mois : ta paie, tes factures, tes paiements en plusieurs fois.') +
      '<div class="kpi-row kpi-row--3">' + tile('arrow-down', 'Revenus réguliers', eur(incTotal), U.plural(b.incomes.length, 'revenu')) + tile('receipt', 'Factures par mois', eur(monthly), U.plural(b.bills.length, 'facture')) +
        tile('calendar', 'Paiements en cours', String(b.installments.filter(function (x) { return !BG.installmentStatus(x, today, b.paid).done; }).length), 'reste ' + eur(b.installments.reduce(function (a, x) { return a + BG.installmentStatus(x, today, b.paid).remaining; }, 0))) + '</div>' +
      '<div class="health-grid">' +
        card('in-list2', 'Ma paie et mes revenus réguliers', 'Versés automatiquement chaque mois', incomes + '<details class="data-twin"><summary>' + icon('plus') + 'Ajouter un revenu régulier</summary>' + addForm('incomes', 'r') + '</details>') +
        card('bd-start', 'Mois budgétaire', 'Ton mois commence le jour de ta paie', '<form class="health-form start-form" data-b-start novalidate><div class="field"><label class="label" for="b-start">Le mois commence le</label>' +
          '<select class="select" id="b-start" data-focus-key="b-start">' + Array.apply(null, Array(28)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + (b.startDay === i + 1 ? ' selected' : '') + '>' + (i + 1) + (i ? '' : 'er') + '</option>'; }).join('') + '</select></div></form>' +
          '<p class="hint">Mois en cours : ' + esc(bm.label) + '.</p>') +
      '</div>' +
      card('bl-list', 'Mes factures', '', bills + '<details class="data-twin"><summary>' + icon('plus') + 'Ajouter une facture</summary>' + addForm('bills', 'f') + '</details>') +
      card('in-list', 'Paiements en plusieurs fois', '', inst + '<details class="data-twin"><summary>' + icon('plus') + 'Ajouter un paiement en plusieurs fois</summary>' + addForm('installments', 'i') + '</details>');
  }
  function bindAdjust(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-b-adjust]');
      if (!b) return;
      var key = b.getAttribute('data-b-adjust'), cur = +b.getAttribute('data-amount'), inc = B().incomes.filter(function (x) { return key.indexOf('inc:' + x.id + ':') === 0; })[0];
      U.dialog({
        title: b.getAttribute('data-label') + ' : ce mois-ci', confirmLabel: 'Enregistrer', returnTo: b,
        desc: 'Prime, absence, heures en plus… Le montant habituel reste ' + (inc ? eur(inc.amount) : '') + ' pour les autres mois.',
        body: '<div class="field"><label class="label" for="adj">Montant reçu (€)</label><input class="input" id="adj" inputmode="decimal" value="' + money(cur) + '"></div>' +
          (inc && cur !== inc.amount ? '<label class="checkbox"><input class="checkbox__input" type="checkbox" name="reset"><span class="checkbox__box" aria-hidden="true"></span><span class="checkbox__label">Revenir au montant habituel</span></label>' : ''),
        onConfirm: function (form) {
          if (form.querySelector('[name="reset"]:checked')) { S.setIncomeAdjust(key, null); return; }
          var n = num(form.querySelector('#adj').value);
          if (!(n >= 0)) { warn('Montant', 'Indique un montant, par exemple 1 850.'); return false; }
          S.setIncomeAdjust(key, inc && Math.abs(n - inc.amount) < 0.005 ? null : Math.round(n * 100) / 100);
          U.toast({ icon: 'check', title: 'Montant du mois enregistré', duration: 2500 });
        }
      });
    });
  }

  /* === 4. Épargne ========================================================================== */
  function renderSavings(el) {
    var b = B(), p = period(), s = BG.summary(b, p.start, p.end), today = D.today();
    var total = b.goals.reduce(function (a, g) { return a + BG.goalSaved(b, g.id, today); }, 0);
    var goals = b.goals.length ? '<div class="goal-grid">' + b.goals.map(function (g) {
      var pr = BG.goalProjection(b, g, today), saved = pr.saved, pct = g.target ? Math.max(0, Math.min(100, Math.round((saved / g.target) * 100))) : null;
      var deps = b.deposits.filter(function (x) { return x.goalId === g.id; }).sort(function (a, c) { return a.date < c.date ? 1 : -1; });
      var plans = (b.plans || []).filter(function (x) { return x.goalId === g.id; });
      var proj = g.target ? (pr.reached ? 'Objectif atteint, bravo !' : pr.date ? 'À ce rythme (' + eur(pr.monthly) + '/mois), objectif atteint vers <strong>' + esc(D.monthYear(pr.date)) + '</strong>. Encore ' + eur(g.target - saved) + '.' : 'Encore ' + eur(g.target - saved) + '. Programme un versement automatique pour voir quand tu y seras.') : '';
      return '<section class="glass card goal-card" aria-labelledby="g-' + g.id + '"><div class="card__header"><div><h2 class="card__title" id="g-' + g.id + '">' + icon('piggy') + esc(g.name) + '</h2>' +
          '<p class="card__subtitle">' + eur(saved) + (g.target ? ' sur ' + eur(g.target) + ' · ' + pct + NB + '%' : ' épargnés') + '</p></div>' + btns('goals', g.id, g.name) + '</div>' +
        (pct != null ? '<div class="progress" style="--value:' + pct + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Progression ' + esc(g.name) + '"></div>' : '') +
        (proj ? '<p class="goal-proj">' + proj + '</p>' : '') +
        (plans.length ? '<ul class="plan-list" role="list">' + plans.map(function (pl) {
          return '<li><span>🔁 ' + eur(pl.amount) + ' automatiquement le ' + pl.day + ' de chaque mois</span>' + btns('plans', pl.id, 'ce versement automatique') + '</li>';
        }).join('') + '</ul>' :
          '<details class="data-twin"><summary>🔁 Programmer un versement automatique</summary><form class="health-form deposit-form" data-b-form="plans" data-goal="' + g.id + '" novalidate>' + fields(DEFS.plans, null, 'p' + g.id) +
          '<button type="submit" class="btn btn--primary btn--sm" data-focus-key="pl-' + g.id + '">' + icon('check') + 'Activer</button></form></details>') +
        '<form class="deposit-form" data-b-form="deposits" data-goal="' + g.id + '" novalidate>' + fields(DEFS.deposits, null, 'd' + g.id) +
          '<button type="submit" class="btn btn--primary btn--sm" data-focus-key="ds-' + g.id + '">' + icon('plus') + 'Verser</button>' +
          '<button type="submit" class="btn btn--ghost btn--sm" data-withdraw formnovalidate data-focus-key="dw-' + g.id + '">' + icon('minus') + 'Retirer</button></form>' +
        (deps.length ? '<ul class="health-list health-list--money" role="list">' + deps.slice(0, 12).map(function (x) {
          return '<li><span class="health-list__date">' + esc(D.cap(D.dayMonthLong(x.date))) + '</span><strong>' + (x.amount < 0 ? 'Retrait' : 'Versement') + '</strong><span class="text-subtle"></span><span class="budget-amount ' + (x.amount < 0 ? '' : 'is-pos') + '">' + (x.amount < 0 ? '−' : '+') + NB + eur(Math.abs(x.amount)) + '</span>' + btns('deposits', x.id, 'ce versement') + '</li>';
        }).join('') + '</ul>' : '') + '</section>';
    }).join('') + '</div>' : '';
    el.innerHTML =
      head('Budget', 'Épargne', 'h-savings', 'Une cagnotte par projet : BTS, iPhone, vacances… Programme un versement automatique et vois quand tu atteindras ton objectif.') +
      periodBar() +
      '<div class="kpi-row kpi-row--2">' + tile('piggy', 'Épargné sur la période', eur(s.savings)) + tile('wallet', 'Total de toutes les cagnottes', eur(total), U.plural(b.goals.length, 'cagnotte')) + '</div>' +
      (goals || empty('Pas encore de cagnotte. Crée la première ci-dessous.')) +
      card('sv-add', 'Nouvelle cagnotte', '', addForm('goals', 'g', 'Créer'));
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
      if (!f || f.getAttribute('data-b-form') === 'plans') return;
      if (f.dataset.withdraw) f.setAttribute('data-b-form', 'withdraw');
      else f.setAttribute('data-b-form', 'deposits');
    }, true);
  }
  // Actions communes : ajout express, enveloppes, bilan
  function bindCommon(el) {
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-b-quick]'))) { quickAdd(b.getAttribute('data-b-quick'), b); return; }
      if ((b = e.target.closest('[data-b-envelopes]'))) { editEnvelopes(b); return; }
      if ((b = e.target.closest('[data-b-bilan]'))) openBilan(b, +b.getAttribute('data-b-bilan'));
    });
  }

  L.views = L.views || {};
  L.views.budget = makeView('budget', 'Budget', renderDash, function (el) { bindCommon(el); });
  L.views.money = makeView('money', 'Mouvements', renderMoney, function (el) {
    bindCommon(el); bindMoney(el);
    bindAdd(el, function (k, v) { U.toast({ icon: 'check', title: (v.type === 'income' ? 'Entrée' : 'Dépense') + ' ajoutée', text: v.label + ' : ' + eur(v.amount), duration: 3000 }); });
  });
  L.views.bills = makeView('bills', 'Charges fixes', renderBills, function (el) {
    bindCommon(el); bindStart(el); bindAdjust(el);
    bindAdd(el, function (k, v) { U.toast({ icon: 'check', title: { bills: 'Facture ajoutée', installments: 'Paiement ajouté', incomes: 'Revenu régulier ajouté' }[k] || 'Ajouté', text: v.label, duration: 3000 }); });
  });
  L.views.savings = makeView('savings', 'Épargne', renderSavings, function (el) {
    bindCommon(el); bindSavings(el);
    bindAdd(el, function (k, v) {
      if (k === 'plans') { U.toast({ icon: 'check', title: 'Versement automatique activé', text: eur(v.amount) + ' le ' + v.day + ' de chaque mois', duration: 3500 }); return; }
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
