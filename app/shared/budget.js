/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · budget
   Calculs d'une période (semaine ou mois) : entrées, dépenses (ponctuelles,
   factures récurrentes, échéances des paiements en plusieurs fois),
   économies (versements dans les cagnottes) et reste. Module UMD.
   ========================================================================== */
(function (root, factory) {
  var node = typeof require === 'function' && typeof module === 'object';
  var D = node ? require('./dates.js') : root.LamiaShared.dates;
  var mod = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.budget = mod; }
})(typeof window !== 'undefined' ? window : this, function (D) {
  'use strict';

  function cents(v) { return Math.round(v * 100) / 100; }
  function within(d, start, end) { return d >= start && d <= end; }
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }   // m : 1-12

  // Échéances d'une facture récurrente entre start et end (incluses)
  function billDates(b, start, end) {
    var out = [];
    var s = D.parse(start), e = D.parse(end);
    var y = s.getFullYear(), m = s.getMonth() + 1;
    var ey = e.getFullYear(), em = e.getMonth() + 1;
    while (y < ey || (y === ey && m <= em)) {
      if (b.every !== 'year' || +b.month === m) {
        var d = y + '-' + D.pad(m) + '-' + D.pad(Math.min(b.day, lastDay(y, m)));
        if (within(d, start, end) && d >= b.since && (!b.until || d <= b.until)) out.push(d);
      }
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  // Échéancier d'un paiement en plusieurs fois (le dernier versement absorbe l'arrondi)
  function schedule(p) {
    var n = Math.max(2, Math.round(p.count)), part = Math.floor((p.total / n) * 100) / 100, out = [];
    for (var k = 0; k < n; k++) out.push({ n: k + 1, of: n, date: D.addMonths(p.first, k), amount: k === n - 1 ? cents(p.total - part * (n - 1)) : part });
    return out;
  }
  function installmentStatus(p, today) {
    var sch = schedule(p), paid = sch.filter(function (x) { return x.date <= today; });
    var next = sch.filter(function (x) { return x.date > today; })[0] || null;
    return { schedule: sch, paidCount: paid.length, paidAmount: cents(paid.reduce(function (a, x) { return a + x.amount; }, 0)), remaining: cents(p.total - paid.reduce(function (a, x) { return a + x.amount; }, 0)), next: next, done: !next };
  }

  // Tous les mouvements de dépense d'une période, avec leur origine
  function expenseItems(b, start, end) {
    var out = [];
    b.entries.forEach(function (x) { if (x.type === 'expense' && within(x.date, start, end)) out.push({ date: x.date, label: x.label, amount: x.amount, category: x.category || 'Autre', source: 'entry', id: x.id }); });
    b.bills.forEach(function (x) { billDates(x, start, end).forEach(function (d) { out.push({ date: d, label: x.label, amount: x.amount, category: x.category || 'Factures', source: 'bill', id: x.id }); }); });
    b.installments.forEach(function (p) {
      schedule(p).forEach(function (s) { if (within(s.date, start, end)) out.push({ date: s.date, label: p.label + ' (' + s.n + '/' + s.of + ')', amount: s.amount, category: p.category || 'Paiements en plusieurs fois', source: 'installment', id: p.id }); });
    });
    return out.sort(function (a, c) { return a.date < c.date ? -1 : a.date > c.date ? 1 : 0; });
  }

  function summary(b, start, end) {
    var income = 0, savings = 0, byCat = {};
    b.entries.forEach(function (x) { if (x.type === 'income' && within(x.date, start, end)) income += x.amount; });
    b.deposits.forEach(function (x) { if (within(x.date, start, end)) savings += x.amount; });
    var items = expenseItems(b, start, end), expenses = 0;
    items.forEach(function (x) { expenses += x.amount; byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
    var cats = Object.keys(byCat).map(function (k) { return { category: k, amount: cents(byCat[k]) }; }).sort(function (a, c) { return c.amount - a.amount; });
    return { income: cents(income), expenses: cents(expenses), savings: cents(savings), rest: cents(income - expenses - savings), byCategory: cats, items: items };
  }

  // Mois budgétaire commençant le jour `startDay` (ex. 27 : du 27 au 26 du mois suivant)
  function budgetMonth(anchor, startDay) {
    var sd = Math.max(1, Math.min(28, Math.round(startDay || 1)));
    var a = D.parse(anchor), y = a.getFullYear(), m = a.getMonth() + 1;
    if (a.getDate() < sd) { m--; if (m < 1) { m = 12; y--; } }
    var start = y + '-' + D.pad(m) + '-' + D.pad(sd);
    var end = D.addDays(D.addMonths(start, 1), -1);
    var label = sd === 1 ? D.cap(D.monthYear(start)) : 'Du ' + D.dayMonth(start) + ' au ' + D.dayMonth(end) + ' ' + end.slice(0, 4);
    return { start: start, end: end, label: label };
  }

  function goalSaved(b, goalId) {
    return cents(b.deposits.reduce(function (a, x) { return x.goalId === goalId ? a + x.amount : a; }, 0));
  }

  return { budgetMonth: budgetMonth, cents: cents, billDates: billDates, schedule: schedule, installmentStatus: installmentStatus, expenseItems: expenseItems, summary: summary, goalSaved: goalSaved };
});
