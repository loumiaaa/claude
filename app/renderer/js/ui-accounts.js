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
  function money(v) { return (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function edit(v) { return v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ','); }
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
  function table(title, cols, rows, total, cls) {
    return '<table class="acc-table ' + (cls || '') + '"><caption class="acc-cap">' + esc(title) + '</caption>' +
      (cols ? '<thead><tr>' + cols.map(function (c) { return '<th scope="col"' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + esc(c[0]) + '</th>'; }).join('') + '</tr></thead>' : '') +
      '<tbody>' + rows.join('') + '</tbody>' + (total || '') + '</table>';
  }
  function totalRow(label, value, span, cls) {
    return '<tfoot><tr class="acc-total ' + (cls || '') + '"><th scope="row" colspan="' + span + '">' + esc(label) + '</th><td class="num">' + money(value) + '</td><td></td></tr></tfoot>';
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
  function render() {
    if (!el) return;
    var m = month(), d = data(m), today = D.today(), isNow = today >= m.start && today <= m.end;
    var totalExp = Math.round((d.expenses + d.savings) * 100) / 100, rest = Math.round((d.income - totalExp) * 100) / 100;
    var ledger = savingsLedger(m), saved = ledger.reduce(function (a, x) { return a + x.amount; }, 0);

    var params = '<table class="acc-table acc-table--params"><caption class="acc-cap">Paramètres</caption><tbody>' +
      '<tr><th scope="row">Début du mois</th><td><input class="acc-in" type="date" data-acc-start value="' + m.start + '" aria-label="Début du mois (jour de paie)" data-focus-key="acc-start"></td></tr>' +
      '<tr><th scope="row">Fin du mois</th><td class="acc-ro">' + esc(D.cap(D.dayMonthLong(m.end))) + '</td></tr></tbody></table>';

    var inRows = d.incomes.map(function (x) {
      var id = x.src === 'income' ? x.key : x.id;
      return '<tr><td>' + cellText(x.src === 'income' ? 'incomes' : 'entries', x.id, 'label', x.label, '', 'Source') + (x.src === 'income' ? rec() : '') + '</td>' +
        '<td class="acc-date">' + (x.src === 'entry' ? '<input class="acc-in" type="date" data-acc="entries" data-id="' + x.id + '" data-f="date" value="' + x.date + '" min="' + m.start + '" max="' + m.end + '" aria-label="Date" data-focus-key="acc-ed-' + x.id + '">' : '<span class="acc-txt">' + esc(D.dayMonth(x.date)) + '</span>') + '</td>' +
        '<td>' + (x.src === 'income' ? cellMoney('adjust', x.key, 'amount', x.amount, 'Montant de ' + x.label + ' ce mois-ci') : cellMoney('entries', x.id, 'amount', x.amount, 'Montant')) + '</td>' +
        '<td>' + delBtn(x.src === 'income' ? 'incomes' : 'entries', id, x.label) + '</td></tr>';
    });
    inRows.push(newRow('income', [['label', 'Nouvelle entrée…'], ['date', ''], ['amount', '0,00']], true));
    var entrees = table('Entrées d’argent', [['Source'], ['Date'], ['Montant', 'num'], ['', 'acc-x']], inRows, totalRow('Total', d.income, 2));

    var savRows = ledger.slice().map(function (x) {
      var cur = x.m.start === m.start;
      return '<tr' + (cur ? ' class="is-current"' : '') + '><th scope="row" class="acc-month">' + esc(monthName(x.m)) + '</th>' +
        '<td>' + (cur ? cellMoney('savings', m.start, 'amount', x.amount, 'Économies de ' + monthName(m)) : '<span class="num">' + money(x.amount) + '</span>') + '</td><td></td></tr>';
    });
    var eco = table('Économies', [['Mois'], ['Montant', 'num'], ['', 'acc-x']], savRows, totalRow('Total', saved, 1));

    function expRows(list, kind, ph) {
      return list.map(function (x) {
        var label = kind === 'installments' ? x.label.replace(/ \((\d+)\/(\d+)\)$/, '') : x.label;
        var nOf = kind === 'installments' ? (/\((\d+\/\d+)\)$/.exec(x.label) || [])[1] : '';
        return '<tr><td>' + cellText(kind, x.id, 'label', label, '', 'Libellé') + (nOf ? '<span class="acc-of">' + nOf + '</span>' : '') + (kind === 'bills' ? rec() : '') + '</td>' +
          '<td>' + (kind === 'installments' ? '<span class="num">' + money(x.amount) + '</span>' : cellMoney(kind, x.id, 'amount', x.amount, 'Montant de ' + label)) + '</td>' +
          '<td>' + delBtn(kind, x.id, label) + '</td></tr>';
      }).concat([newRow(kind === 'entries' ? 'expense' : kind === 'bills' ? 'bill' : 'installment', kind === 'installments' ? [['label', ph], ['amount', 'par mois'], ['of', '']] : [['label', ph], ['amount', '0,00']])]);
    }
    var misc = expRows(d.misc, 'entries', 'Nouvelle dépense…');
    if (d.savings) misc.unshift('<tr class="acc-eco"><td>Économies</td><td><span class="num">' + money(d.savings) + '</span></td><td></td></tr>');
    var depenses =
      '<div class="acc-block"><h2 class="acc-h">Dépenses</h2>' +
        table('Factures', null, expRows(d.bills, 'bills', 'Nouvelle facture…'), '', 'acc-table--sub') +
        table('Paiements en plusieurs fois', null, expRows(d.inst, 'installments', 'Nouvel achat…'), '', 'acc-table--sub') +
        table('Dépenses diverses', null, misc, '', 'acc-table--sub') +
        '<table class="acc-table acc-table--sum"><tbody>' +
          '<tr class="acc-total"><th scope="row">Total dépenses</th><td class="num">' + money(totalExp) + '</td><td></td></tr>' +
          '<tr class="acc-total acc-rest' + (rest < 0 ? ' is-neg' : '') + '"><th scope="row">Restant</th><td class="num">' + money(rest) + '</td><td></td></tr>' +
        '</tbody></table></div>';

    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Budget</p><h1 class="h1" id="h-accounts" tabindex="-1">Mes comptes</h1>' +
        '<p class="page-head__lead">Ton mois en tableaux. Touche une case pour la modifier, la dernière ligne de chaque tableau sert à ajouter. ↻ revient tous les mois.</p></div>' +
        '<div class="page-head__actions acc-nav"><button type="button" class="btn btn--ghost btn--icon" data-acc-month="-1" aria-label="Mois précédent" data-focus-key="acc-prev">' + icon('chevron-left') + '</button>' +
          '<button type="button" class="btn btn--secondary btn--sm" data-acc-month="0"' + (isNow ? ' aria-disabled="true"' : '') + ' data-focus-key="acc-now">Ce mois-ci</button>' +
          '<button type="button" class="btn btn--ghost btn--icon" data-acc-month="1" aria-label="Mois suivant" data-focus-key="acc-next">' + icon('chevron-right') + '</button></div></header>' +
      '<div class="acc-sheet">' +
        '<div class="acc-col"><h2 class="acc-h acc-h--month">' + esc(monthName(m)) + '</h2>' + params + entrees + eco + '</div>' +
        '<div class="acc-col">' + depenses + '</div>' +
      '</div>';
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  // Ligne d'ajout (dernière ligne d'un tableau)
  function newRow(kind, fields, withDate) {
    var m = month(), today = D.today(), def = today >= m.start && today <= m.end ? today : m.start;
    var cells = fields.map(function (f) {
      var key = 'acc-new-' + kind + '-' + f[0];
      if (f[0] === 'date') return '<td class="acc-date"><input class="acc-in" type="date" data-new="' + kind + '" data-f="date" value="' + def + '" min="' + m.start + '" max="' + m.end + '" aria-label="Date" data-focus-key="' + key + '"></td>';
      if (f[0] === 'of') return '<td class="acc-of-cell"><select class="acc-in acc-in--sel" data-new="' + kind + '" data-f="of" aria-label="Échéance de ce mois sur combien" data-focus-key="' + key + '">' +
        [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [1, 10], [1, 12]].map(function (o) { return '<option value="' + o[0] + '/' + o[1] + '">' + o[0] + '/' + o[1] + '</option>'; }).join('') + '</select></td>';
      var isNum = f[0] === 'amount';
      return '<td><input class="acc-in acc-in--new' + (isNum ? ' acc-in--num' : '') + '" data-new="' + kind + '" data-f="' + f[0] + '" placeholder="' + esc(f[1]) + '"' + (isNum ? ' inputmode="decimal"' : '') + ' aria-label="' + (isNum ? 'Montant' : 'Libellé') + '" data-focus-key="' + key + '" autocomplete="off"></td>';
    });
    if (kind === 'income') cells[0] = cells[0].replace('</td>', '<button type="button" class="acc-rec-toggle" data-new-rec aria-pressed="false" title="Tous les mois">↻</button></td>');
    return '<tr class="acc-new">' + cells.join('') + (kind === 'installment' ? '' : '<td></td>') + '</tr>';
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
