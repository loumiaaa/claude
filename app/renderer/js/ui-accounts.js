/* ==========================================================================
   Plateforme de suivi - Lamia — « Mes comptes »
   Le budget du mois en tableaux, comme dans un tableur :
   - à gauche : Paramètres (début / fin du mois), Entrées d'argent, Économies ;
   - à droite : Dépenses → Factures, Paiements en plusieurs fois (« 3/4 »),
     Dépenses diverses (avec la ligne « Économies » du mois) ;
   - en bas : Total dépenses et Restant (entrées − dépenses, économies comprises).
   Chaque case se modifie sur place (Entrée ou sortie du champ pour valider),
   la dernière ligne de chaque tableau sert à ajouter. Les factures et la paie
   reviennent toutes seules chaque mois (↻). Mêmes données que les autres pages
   du budget (shared/budget.js).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, BG = window.LamiaShared.budget;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var el = null, anchor = null;
  var SAVINGS_GOAL = 'Épargne';

  function B() { return S.budget(); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[\s  €]/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; }
  // 21 → « 21 », 209,5 → « 209,50 »
  function money(v) { var r = Math.round(v * 100) / 100, dec = r % 1 !== 0; return r.toLocaleString('fr-FR', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: 2 }); }
  function edit(v) { if (v == null) return ''; var r = Math.round(v * 100) / 100; return (r % 1 ? r.toFixed(2) : String(r)).replace('.', ','); }
  function month() { return BG.budgetMonth(anchor || D.today(), B().startDay); }
  // « Novembre 2026 » : le mois où se termine la période (paie du 27 octobre → novembre)
  function monthName(m) { return D.cap(D.monthYear(B().startDay === 1 ? m.start : m.end)); }
  function warn(text) { U.toast({ kind: 'warning', icon: 'alert', title: 'À vérifier', text: text, duration: 4000 }); }

  /* --- Cellules ------------------------------------------------------------------- */
  function cellText(table, id, field, value, ph, label) {
    return '<input class="acc-in" data-acc="' + table + '" data-id="' + esc(id) + '" data-f="' + field + '" value="' + esc(value || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' aria-label="' + esc(label) + '" data-focus-key="acc-' + table + '-' + id + '-' + field + '" autocomplete="off">';
  }
  function cellMoney(table, id, field, value, label) {
    return '<input class="acc-in acc-in--num" data-acc="' + table + '" data-id="' + esc(id) + '" data-f="' + field + '" value="' + esc(edit(value)) + '" inputmode="decimal" aria-label="' + esc(label) + '" data-focus-key="acc-' + table + '-' + id + '-' + field + '" autocomplete="off">';
  }
  function delBtn(table, id, label) {
    return '<button type="button" class="acc-del" data-acc-del="' + table + '" data-id="' + esc(id) + '" aria-label="Retirer ' + esc(label) + '">' + icon('close') + '</button>';
  }
  function rec() { return '<span class="acc-rec" title="Revient tous les mois">↻</span>'; }
  // Un tableau dans une carte : icône pixel, titre, sous-total
  function card(key, px, title, sum, cols, rows, extra) {
    var id = 'acc-t-' + key;
    return '<section class="acc-card acc-card--' + key + '" aria-labelledby="' + id + '">' +
      '<header class="acc-card__head">' + U.px(px, 2) + '<h2 class="acc-card__title" id="' + id + '">' + esc(title) + '</h2>' +
        (sum != null ? '<span class="acc-card__sum num">' + money(sum) + NB + '€</span>' : '') + '</header>' +
      '<table class="acc-table" aria-labelledby="' + id + '">' +
        (cols ? '<thead><tr>' + cols.map(function (c) { return '<th scope="col"' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + esc(c[0]) + '</th>'; }).join('') + '</tr></thead>' : '') +
        '<tbody>' + rows.join('') + '</tbody></table>' + (extra || '') + '</section>';
  }
  // « 3/4 » en pastilles (au-delà de 6 échéances, en chiffres)
  function dots(nOf) {
    var p = nOf.split('/'), n = +p[0], of = +p[1];
    if (of > 6) return '<span class="acc-of">' + nOf + '</span>';
    var out = '';
    for (var i = 1; i <= of; i++) out += '<i class="' + (i <= n ? 'is-on' : '') + '"></i>';
    return '<span class="acc-dots" title="Échéance ' + n + ' sur ' + of + '" aria-label="échéance ' + n + ' sur ' + of + '">' + out + '</span>';
  }

  /* --- Données du mois ----------------------------------------------------------------- */
  function data(m) {
    var b = B();
    var incomes = BG.summary(b, m.start, m.end);
    var items = BG.expenseItems(b, m.start, m.end);
    var savings = BG.summary(b, m.start, m.end).savings;
    return {
      incomes: (function () { var out = []; b.entries.forEach(function (x) { if (x.type === 'income' && x.date >= m.start && x.date <= m.end) out.push({ src: 'entry', id: x.id, label: x.label, date: x.date, amount: x.amount }); });
        (b.incomes || []).forEach(function (x) { BG.billDates({ day: x.day, every: 'month', since: x.since, until: x.until }, m.start, m.end).forEach(function (d) { var k = 'inc:' + x.id + ':' + d; out.push({ src: 'income', id: x.id, key: k, label: x.label, date: d, amount: typeof (b.adjust || {})[k] === 'number' ? b.adjust[k] : x.amount }); }); });
        return out.sort(function (a, c) { return a.src === c.src ? (a.date < c.date ? -1 : 1) : a.src === 'income' ? -1 : 1; }); })(),
      bills: items.filter(function (x) { return x.source === 'bill'; }),
      inst: items.filter(function (x) { return x.source === 'installment'; }),
      misc: items.filter(function (x) { return x.source === 'entry'; }),
      income: incomes.income, expenses: incomes.expenses, savings: savings
    };
  }

  // Économies mois par mois (depuis le premier versement), jusqu'au mois affiché
  function savingsLedger(m) {
    var b = B(), dates = (b.deposits || []).map(function (x) { return x.date; }).concat((b.plans || []).map(function (p) { return p.since; })).sort();
    if (!dates.length) return [{ m: m, amount: 0 }];
    var out = [], cur = BG.budgetMonth(dates[0], b.startDay), guard = 0;
    while (cur.start <= m.start && guard++ < 240) {
      out.push({ m: cur, amount: BG.summary(b, cur.start, cur.end).savings });
      cur = BG.budgetMonth(D.addDays(cur.end, 1), b.startDay);
    }
    return out.filter(function (x, i) { return x.amount || x.m.start === m.start || i === 0; });
  }

  /* --- Rendu -------------------------------------------------------------------------------- */
  function sum(list) { return Math.round(list.reduce(function (a, x) { return a + x.amount; }, 0) * 100) / 100; }
  function render() {
    if (!el) return;
    var m = month(), d = data(m), today = D.today(), isNow = today >= m.start && today <= m.end;
    var totalExp = Math.round((d.expenses + d.savings) * 100) / 100, rest = Math.round((d.income - totalExp) * 100) / 100;
    var ledger = savingsLedger(m), saved = ledger.reduce(function (a, x) { return a + x.amount; }, 0);
    var sBills = sum(d.bills), sInst = sum(d.inst), sMisc = sum(d.misc);

    // Bandeau : entrées, dépenses, restant, et où part l'argent
    var parts = [['bills', 'Factures', sBills], ['inst', 'Plusieurs fois', sInst], ['misc', 'Diverses', sMisc], ['eco', 'Économies', d.savings], ['rest', 'Restant', Math.max(0, rest)]];
    var base = Math.max(d.income, totalExp) || 1;
    var bar = parts.filter(function (x) { return x[2] > 0; }).map(function (x) {
      return '<span class="acc-bar__seg acc-bar__seg--' + x[0] + '" style="width:' + (x[2] / base * 100).toFixed(2) + '%" title="' + esc(x[1]) + ' : ' + money(x[2]) + ' €"></span>';
    }).join('');
    var legend = parts.map(function (x) {
      return '<li class="acc-legend__item acc-legend__item--' + x[0] + '"><i aria-hidden="true"></i><span>' + esc(x[1]) + '</span><strong class="num">' + money(x[2]) + NB + '€</strong></li>';
    }).join('');
    var pct = d.income ? Math.round(totalExp / d.income * 100) : null;
    var hero =
      '<section class="acc-hero" aria-label="Résumé du mois">' +
        '<div class="acc-hero__month">' +
          '<button type="button" class="acc-hero__arrow" data-acc-month="-1" aria-label="Mois précédent" data-focus-key="acc-prev">' + icon('chevron-left') + '</button>' +
          '<div><h2 class="acc-hero__name">' + esc(monthName(m)) + '</h2><p class="acc-hero__period">du ' + esc(D.dayMonth(m.start)) + ' au ' + esc(D.dayMonth(m.end)) +
            (isNow ? '' : ' · <button type="button" class="acc-hero__now" data-acc-month="0" data-focus-key="acc-now">revenir à ce mois-ci</button>') + '</p></div>' +
          '<button type="button" class="acc-hero__arrow" data-acc-month="1" aria-label="Mois suivant" data-focus-key="acc-next">' + icon('chevron-right') + '</button>' +
        '</div>' +
        '<div class="acc-hero__stats">' +
          '<div class="acc-stat acc-stat--in">' + U.px('coin', 2) + '<span class="acc-stat__label">Entrées</span><strong class="acc-stat__value num">' + money(d.income) + NB + '€</strong></div>' +
          '<div class="acc-stat acc-stat--out">' + U.px('bell', 2) + '<span class="acc-stat__label">Dépenses</span><strong class="acc-stat__value num">' + money(totalExp) + NB + '€</strong>' + (pct != null ? '<span class="acc-stat__sub">' + pct + NB + '% de tes entrées</span>' : '') + '</div>' +
          '<div class="acc-stat acc-stat--rest' + (rest < 0 ? ' is-neg' : '') + '">' + U.px(rest < 0 ? 'flame' : 'piggy', 2) + '<span class="acc-stat__label">Restant</span><strong class="acc-stat__value num">' + money(rest) + NB + '€</strong>' +
            '<span class="acc-stat__sub">' + (rest < 0 ? 'On ajuste en douceur le mois prochain' : rest > 0 ? 'Bien joué ✦' : 'Pile à l’équilibre') + '</span></div>' +
        '</div>' +
        '<div class="acc-bar" role="img" aria-label="Répartition : ' + parts.map(function (x) { return x[1] + ' ' + money(x[2]) + ' €'; }).join(', ') + '">' + bar + '</div>' +
        '<ul class="acc-legend" role="list">' + legend + '</ul>' +
      '</section>';

    var inRows = d.incomes.map(function (x) {
      var id = x.src === 'income' ? x.key : x.id;
      return '<tr><td>' + cellText(x.src === 'income' ? 'incomes' : 'entries', x.id, 'label', x.label, '', 'Source') + (x.src === 'income' ? rec() : '') + '</td>' +
        '<td class="acc-date">' + (x.src === 'entry' ? '<input class="acc-in" type="date" data-acc="entries" data-id="' + x.id + '" data-f="date" value="' + x.date + '" min="' + m.start + '" max="' + m.end + '" aria-label="Date" data-focus-key="acc-ed-' + x.id + '">' : '<span class="acc-txt">' + esc(D.dayMonth(x.date)) + '</span>') + '</td>' +
        '<td class="acc-amt">' + (x.src === 'income' ? cellMoney('adjust', x.key, 'amount', x.amount, 'Montant de ' + x.label + ' ce mois-ci') : cellMoney('entries', x.id, 'amount', x.amount, 'Montant')) + '</td>' +
        '<td class="acc-x">' + delBtn(x.src === 'income' ? 'incomes' : 'entries', id, x.label) + '</td></tr>';
    });
    inRows.push(newRow('income', [['label', '+ Ajouter'], ['date', ''], ['amount', '0,00']], true));
    var entrees = card('in', 'coin', 'Entrées d’argent', d.income, [['Source'], ['Date', 'acc-date'], ['Montant', 'acc-amt'], ['', 'acc-x']], inRows);

    var savRows = ledger.slice().map(function (x) {
      var cur = x.m.start === m.start;
      return '<tr' + (cur ? ' class="is-current"' : '') + '><th scope="row" class="acc-month">' + esc(monthName(x.m)) + '</th>' +
        '<td class="acc-amt">' + (cur ? cellMoney('savings', m.start, 'amount', x.amount, 'Économies de ' + monthName(m)) : '<span class="num">' + money(x.amount) + '</span>') + '</td><td class="acc-x"></td></tr>';
    });
    var eco = card('eco', 'piggy', 'Économies', saved, null, savRows, '<p class="acc-card__foot">Au total depuis ' + esc(monthName(ledger[0].m).toLowerCase()) + '</p>');

    var params = '<section class="acc-card acc-card--params" aria-labelledby="acc-t-params"><header class="acc-card__head">' + U.px('calendar', 2) + '<h2 class="acc-card__title" id="acc-t-params">Mon mois</h2></header>' +
      '<table class="acc-table"><tbody>' +
        '<tr><th scope="row">Début du mois</th><td><input class="acc-in" type="date" data-acc-start value="' + m.start + '" aria-label="Début du mois (jour de paie)" data-focus-key="acc-start"></td></tr>' +
        '<tr><th scope="row">Fin du mois</th><td class="acc-ro"><span class="acc-txt">' + esc(D.cap(D.dayMonthLong(m.end))) + '</span></td></tr></tbody></table>' +
      '<p class="acc-card__foot">Si tu comptes à partir de ta paie (le 27…), choisis ce jour : il vaut pour tous les mois.</p></section>';

    function expRows(list, kind, ph) {
      return list.map(function (x) {
        var label = kind === 'installments' ? x.label.replace(/ \((\d+)\/(\d+)\)$/, '') : x.label;
        var nOf = kind === 'installments' ? (/\((\d+\/\d+)\)$/.exec(x.label) || [])[1] : '';
        return '<tr><td>' + cellText(kind, x.id, 'label', label, '', 'Libellé') + (nOf ? dots(nOf) : '') + (kind === 'bills' ? rec() : '') + '</td>' +
          '<td class="acc-amt">' + (kind === 'installments' ? '<span class="num">' + money(x.amount) + '</span>' : cellMoney(kind, x.id, 'amount', x.amount, 'Montant de ' + label)) + '</td>' +
          '<td class="acc-x">' + delBtn(kind, x.id, label) + '</td></tr>';
      }).concat([newRow(kind === 'entries' ? 'expense' : kind === 'bills' ? 'bill' : 'installment', [['label', ph], ['amount', kind === 'installments' ? 'par mois' : '0,00']])]);
    }
    var misc = expRows(d.misc, 'entries', '+ Nouvelle dépense');
    if (d.savings) misc.unshift('<tr class="acc-eco"><td><span class="acc-txt">' + U.px('piggy') + ' Économies du mois</span></td><td class="acc-amt"><span class="num">' + money(d.savings) + '</span></td><td class="acc-x"></td></tr>');

    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Budget</p><h1 class="h1" id="h-accounts" tabindex="-1">Mes comptes</h1>' +
        '<p class="page-head__lead">Touche une case pour la modifier, la dernière ligne de chaque tableau sert à ajouter. ↻ revient tous les mois.</p></div></header>' +
      hero +
      '<div class="acc-sheet">' +
        '<div class="acc-col">' + entrees + eco + params + '</div>' +
        '<div class="acc-col">' +
          card('bills', 'bell', 'Factures', sBills, null, expRows(d.bills, 'bills', '+ Nouvelle facture')) +
          card('inst', 'calendar', 'Paiements en plusieurs fois', sInst, null, expRows(d.inst, 'installments', '+ Nouvel achat')) +
          card('misc', 'gift', 'Dépenses diverses', Math.round((sMisc + d.savings) * 100) / 100, null, misc) +
        '</div>' +
      '</div>';
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  // Ligne d'ajout (dernière ligne d'un tableau)
  function newRow(kind, fields, withDate) {
    var m = month(), today = D.today(), def = today >= m.start && today <= m.end ? today : m.start;
    var cells = fields.map(function (f) {
      var key = 'acc-new-' + kind + '-' + f[0];
      if (f[0] === 'date') return '<td class="acc-date"><input class="acc-in" type="date" data-new="' + kind + '" data-f="date" value="' + def + '" min="' + m.start + '" max="' + m.end + '" aria-label="Date" data-focus-key="' + key + '"></td>';
      if (f[0] === 'of') return '<td class="acc-x acc-of-cell"><select class="acc-in acc-in--sel" data-new="' + kind + '" data-f="of" aria-label="Échéance de ce mois sur combien" data-focus-key="' + key + '">' +
        [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [1, 10], [1, 12]].map(function (o) { return '<option value="' + o[0] + '/' + o[1] + '">' + o[0] + '/' + o[1] + '</option>'; }).join('') + '</select></td>';
      var isNum = f[0] === 'amount';
      return '<td' + (isNum ? ' class="acc-amt"' : '') + '><input class="acc-in acc-in--new' + (isNum ? ' acc-in--num' : '') + '" data-new="' + kind + '" data-f="' + f[0] + '" placeholder="' + esc(f[1]) + '"' + (isNum ? ' inputmode="decimal"' : '') + ' aria-label="' + (isNum ? 'Montant' : 'Libellé') + '" data-focus-key="' + key + '" autocomplete="off"></td>';
    });
    if (kind === 'income') cells[0] = cells[0].replace('</td>', '<button type="button" class="acc-rec-toggle" data-new-rec aria-pressed="false" title="Tous les mois">↻</button></td>');
    // Paiement en plusieurs fois : où il en est ce mois-ci (1/4, 2/4…), dans la case du libellé
    if (kind === 'installment') cells[0] = cells[0].replace('</td>', '<select class="acc-of-sel" data-new="installment" data-f="of" aria-label="Échéance de ce mois sur combien" data-focus-key="acc-new-installment-of">' +
      [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [1, 10], [1, 12]].map(function (o) { return '<option value="' + o[0] + '/' + o[1] + '"' + (o[0] === 1 && o[1] === 4 ? ' selected' : '') + '>' + o[0] + '/' + o[1] + '</option>'; }).join('') + '</select></td>');
    return '<tr class="acc-new">' + cells.join('') + '<td class="acc-x"></td></tr>';
  }

  /* --- Enregistrement -------------------------------------------------------------------------- */
  function commit(inp) {
    var t = inp.getAttribute('data-acc'), id = inp.getAttribute('data-id'), f = inp.getAttribute('data-f'), v = inp.value;
    if (f === 'amount') {
      var n = num(v);
      if (v.trim() === '' && t === 'adjust') n = NaN;
      if (!(n >= 0) || n > 1e7) { warn('Un montant, par exemple 43 ou 68,62.'); render(); return; }
      n = Math.round(n * 100) / 100;
      if (t === 'adjust') { var inc = (B().incomes || []).filter(function (x) { return id.indexOf('inc:' + x.id + ':') === 0; })[0]; S.setIncomeAdjust(id, inc && inc.amount === n ? null : n); return; }
      if (t === 'savings') { setSavings(n); return; }
      S.updateBudget(t, id, { amount: n });
      return;
    }
    if (f === 'label') { if (!v.trim()) { render(); return; } S.updateBudget(t, id, { label: v.trim() }); return; }
    if (f === 'date' && D.valid(v)) S.updateBudget(t, id, { date: v });
  }

  // Économies du mois affiché : un versement « du mois » dans la cagnotte Épargne,
  // ajusté pour que le total du mois corresponde au montant saisi
  function setSavings(total) {
    var b = B(), m = month();
    var goal = b.goals.filter(function (g) { return g.name === SAVINGS_GOAL; })[0] || b.goals[0];
    if (!goal) goal = S.addBudget('goals', { name: SAVINGS_GOAL });
    var mine = b.deposits.filter(function (x) { return x.monthly && x.date === m.start; })[0];
    var others = BG.summary(b, m.start, m.end).savings - (mine ? mine.amount : 0);
    var want = Math.round((total - others) * 100) / 100;
    if (want < 0) { warn('Ce mois-ci, ' + money(others) + ' € sont déjà mis de côté par ailleurs (versements automatiques, cagnottes).'); render(); return; }
    if (mine) { if (want) S.updateBudget('deposits', mine.id, { amount: want }); else S.removeBudget('deposits', mine.id); }
    else if (want) S.addBudget('deposits', { goalId: goal.id, date: m.start, amount: want, monthly: true });
  }

  function addFrom(row) {
    // Entrée puis « change » arrivent tous les deux : une seule ligne ajoutée
    if (!row || row.dataset.added) return true;
    var kind = row.querySelector('[data-new]').getAttribute('data-new');
    var get = function (f) { var x = row.querySelector('[data-f="' + f + '"]'); return x ? x.value : ''; };
    var label = get('label').trim(), n = num(get('amount'));
    if (!label || !(n > 0)) return false;
    row.dataset.added = '1';
    n = Math.round(n * 100) / 100;
    var m = month(), today = D.today(), def = today >= m.start && today <= m.end ? today : m.start;
    if (kind === 'income') {
      var date = D.valid(get('date')) ? get('date') : def;
      if (row.querySelector('[data-new-rec][aria-pressed="true"]')) S.addBudget('incomes', { label: label, amount: n, day: +date.slice(8), since: date, category: 'Salaire' });
      else S.addBudget('entries', { type: 'income', date: date, label: label, amount: n, category: '' });
    } else if (kind === 'expense') S.addBudget('entries', { type: 'expense', date: def, label: label, amount: n, category: '' });
    else if (kind === 'bill') S.addBudget('bills', { label: label, amount: n, day: +m.start.slice(8), every: 'month', since: m.start, category: 'Factures' });
    else if (kind === 'installment') {
      var of = (get('of') || '1/4').split('/'), k = +of[0], cnt = +of[1];
      S.addBudget('installments', { label: label, total: Math.round(n * cnt * 100) / 100, count: cnt, first: D.addMonths(m.start, -(k - 1)), category: 'Paiements en plusieurs fois' });
    }
    U.toast({ kind: 'success', icon: 'check', title: label + ' : ' + money(n) + NB + '€', text: kind === 'bill' ? 'Ajoutée : elle reviendra tous les mois.' : kind === 'installment' ? 'Les autres échéances se placent toutes seules sur les mois suivants.' : '', duration: 3500 });
    setTimeout(function () { var x = el.querySelector('[data-new="' + kind + '"][data-f="label"]'); if (x) x.focus(); }, 30);
    return true;
  }

  function remove(t, id, btn) {
    var b = B(), m = month();
    if (t === 'entries') {
      var x = b.entries.filter(function (e) { return e.id === id; })[0];
      if (!x) return;
      var copy = JSON.parse(JSON.stringify(x));
      S.removeBudget('entries', id);
      U.toast({ icon: 'trash', title: 'Ligne retirée', text: x.label + ' : ' + money(x.amount) + NB + '€', duration: 5000, actions: [{ label: 'Annuler', fn: function () { delete copy.id; S.addBudget('entries', copy); } }] });
      return;
    }
    if (t === 'installments') {
      var p = b.installments.filter(function (e) { return e.id === id; })[0];
      if (!p) return;
      U.dialog({ title: 'Retirer « ' + p.label + ' » ?', text: 'Toutes ses échéances disparaissent des comptes, ce mois-ci et les autres.', danger: true, confirmLabel: 'Retirer', returnTo: btn, onConfirm: function () { S.removeBudget('installments', id); } });
      return;
    }
    // Facture ou paie qui revient tous les mois : on l'arrête à partir de ce mois
    var kind = t === 'incomes' ? 'incomes' : 'bills';
    var realId = t === 'incomes' ? ((b.incomes || []).filter(function (x) { return id.indexOf('inc:' + x.id + ':') === 0; })[0] || {}).id : id;
    var it = (b[kind] || []).filter(function (x) { return x.id === realId; })[0];
    if (!it) return;
    U.dialog({
      title: 'Arrêter « ' + it.label + ' » ?', text: 'Elle revient tous les mois. Elle disparaît à partir de ' + monthName(m).toLowerCase() + ' ; les mois précédents restent comme ils sont.',
      confirmLabel: 'Arrêter à partir de ce mois', returnTo: btn,
      onConfirm: function () { if (it.since >= m.start) S.removeBudget(kind, it.id); else S.updateBudget(kind, it.id, { until: D.addDays(m.start, -1) }); }
    });
  }

  function mount(node) {
    el = node;
    el.addEventListener('change', function (e) {
      var inp = e.target;
      if (inp.hasAttribute('data-acc-start')) {
        if (!D.valid(inp.value)) return;
        var day = Math.min(28, +inp.value.slice(8));
        if (+inp.value.slice(8) > 28) warn('Le mois peut commencer au plus tard le 28 : on garde le 28.');
        anchor = inp.value;
        setStart(day);
        return;
      }
      if (inp.hasAttribute('data-acc')) { commit(inp); return; }
      if (inp.hasAttribute('data-new') && inp.getAttribute('data-f') === 'amount') addFrom(inp.closest('tr'));
    });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var inp = e.target;
      if (inp.hasAttribute && inp.hasAttribute('data-new')) { e.preventDefault(); if (!addFrom(inp.closest('tr'))) { var next = inp.closest('td').nextElementSibling; var f = next && next.querySelector('input'); if (f) f.focus(); } return; }
      if (inp.hasAttribute && inp.hasAttribute('data-acc')) { e.preventDefault(); inp.blur(); }
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-acc-month]'))) {
        var k = +b.getAttribute('data-acc-month');
        anchor = k === 0 ? D.today() : (k < 0 ? D.addDays(month().start, -1) : D.addDays(month().end, 1));
        render();
        return;
      }
      if ((b = e.target.closest('[data-acc-del]'))) { remove(b.getAttribute('data-acc-del'), b.getAttribute('data-id'), b); return; }
      if ((b = e.target.closest('[data-new-rec]'))) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    });
    S.subscribe(function (type) {
      if (type !== 'budget' && type !== 'reset' && type !== 'settings') return;
      if (L.app.view() !== 'accounts') { el.dataset.stale = '1'; return; }
      render();
    });
  }
  function setStart(day) {
    B().startDay = day;
    S.emit('budget', { startDay: true }, { now: true });
    U.toast({ icon: 'calendar', title: 'Ton mois commence le ' + (day === 1 ? '1er' : day), text: 'Pour tous les mois, comme ton jour de paie.', duration: 3500 });
  }

  L.views = L.views || {};
  L.views.accounts = { title: 'Mes comptes', mount: mount, render: render, show: function () { delete el.dataset.stale; render(); } };
})(window.Lamia = window.Lamia || {});
