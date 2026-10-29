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

  // Paiements cochés « passés » : clé « bill:<id>:<date> » ou « inst:<id>:<date> »
  function paidKey(source, id, date) { return (source === 'bill' ? 'bill' : 'inst') + ':' + id + ':' + date; }
  function isPaid(paid, source, id, date) { return (paid || []).indexOf(paidKey(source, id, date)) >= 0; }

  // Échéancier d'un paiement en plusieurs fois (le dernier versement absorbe l'arrondi)
  function schedule(p) {
    var n = Math.max(2, Math.round(p.count)), part = Math.floor((p.total / n) * 100) / 100, out = [];
    for (var k = 0; k < n; k++) out.push({ n: k + 1, of: n, date: D.addMonths(p.first, k), amount: k === n - 1 ? cents(p.total - part * (n - 1)) : part });
    return out;
  }
  // paidList (facultatif) : échéances cochées ; sans liste, une échéance passée compte comme payée
  function installmentStatus(p, today, paidList) {
    var sch = schedule(p);
    var done = function (x) { return paidList ? isPaid(paidList, 'inst', p.id, x.date) : x.date <= today; };
    sch.forEach(function (x) { x.key = paidKey('inst', p.id, x.date); x.paid = done(x); });
    var paid = sch.filter(function (x) { return x.paid; });
    var next = sch.filter(function (x) { return !x.paid; })[0] || null;
    return { schedule: sch, paidCount: paid.length, paidAmount: cents(paid.reduce(function (a, x) { return a + x.amount; }, 0)), remaining: cents(p.total - paid.reduce(function (a, x) { return a + x.amount; }, 0)), next: next, done: !next };
  }

  // Tous les mouvements de dépense d'une période, avec leur origine
  function expenseItems(b, start, end) {
    var out = [];
    b.entries.forEach(function (x) { if (x.type === 'expense' && within(x.date, start, end)) out.push({ date: x.date, label: x.label, amount: x.amount, category: x.category || 'Autre', source: 'entry', id: x.id }); });
    b.bills.forEach(function (x) { billDates(x, start, end).forEach(function (d) { out.push({ date: d, label: x.label, amount: x.amount, category: x.category || 'Factures', source: 'bill', id: x.id, key: paidKey('bill', x.id, d), paid: isPaid(b.paid, 'bill', x.id, d) }); }); });
    b.installments.forEach(function (p) {
      schedule(p).forEach(function (s) { if (within(s.date, start, end)) out.push({ date: s.date, label: p.label + ' (' + s.n + '/' + s.of + ')', amount: s.amount, category: p.category || 'Paiements en plusieurs fois', source: 'installment', id: p.id, key: paidKey('inst', p.id, s.date), paid: isPaid(b.paid, 'inst', p.id, s.date) }); });
    });
    return out.sort(function (a, c) { return a.date < c.date ? -1 : a.date > c.date ? 1 : 0; });
  }

  /* --- Revenus réguliers (paie) et versements automatiques -------------------------- */
  // Montant d'une paie : celui du mois s'il a été corrigé, sinon le montant habituel
  function incomeKey(id, date) { return 'inc:' + id + ':' + date; }
  function incomeItems(b, start, end) {
    var out = [];
    (b.entries || []).forEach(function (x) { if (x.type === 'income' && within(x.date, start, end)) out.push({ date: x.date, label: x.label, amount: x.amount, category: x.category || 'Autre revenu', source: 'entry', id: x.id }); });
    (b.incomes || []).forEach(function (x) {
      billDates({ day: x.day, every: 'month', since: x.since, until: x.until }, start, end).forEach(function (d) {
        var k = incomeKey(x.id, d), adj = b.adjust && typeof b.adjust[k] === 'number' ? b.adjust[k] : null;
        out.push({ date: d, label: x.label, amount: adj != null ? adj : x.amount, category: x.category || 'Salaire', source: 'income', id: x.id, key: k, adjusted: adj != null });
      });
    });
    return out.sort(function (a, c) { return a.date < c.date ? -1 : a.date > c.date ? 1 : 0; });
  }
  function planItems(b, start, end) {
    var out = [];
    (b.plans || []).forEach(function (p) {
      billDates({ day: p.day, every: 'month', since: p.since, until: p.until }, start, end).forEach(function (d) { out.push({ date: d, goalId: p.goalId, amount: p.amount, planId: p.id, planned: true }); });
    });
    return out;
  }
  function savingItems(b, start, end) {
    return (b.deposits || []).filter(function (x) { return within(x.date, start, end); }).concat(planItems(b, start, end));
  }

  function summary(b, start, end) {
    var income = 0, savings = 0, byCat = {};
    incomeItems(b, start, end).forEach(function (x) { income += x.amount; });
    savingItems(b, start, end).forEach(function (x) { savings += x.amount; });
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

  function goalSaved(b, goalId, today) {
    var t = today || D.today(), sum = b.deposits.reduce(function (a, x) { return x.goalId === goalId ? a + x.amount : a; }, 0);
    planItems(b, '1900-01-01', t).forEach(function (x) { if (x.goalId === goalId) sum += x.amount; });
    return cents(sum);
  }

  /* --- Reste à vivre du mois budgétaire --------------------------------------------- */
  // Revenus − toutes les dépenses du mois (passées et à venir) − l'épargne du mois,
  // puis ce montant réparti sur les jours qui restent jusqu'à la fin du mois.
  function forecast(b, start, end, today) {
    var s = summary(b, start, end), t = today || D.today();
    var inMonth = within(t, start, end);
    var spent = 0, upcoming = 0;
    s.items.forEach(function (x) { if (x.date <= t) spent += x.amount; else upcoming += x.amount; });
    var totalDays = D.diff(start, end) + 1;
    var daysLeft = inMonth ? D.diff(t, end) + 1 : (t < start ? totalDays : 0);
    var elapsed = inMonth ? D.diff(start, t) + 1 : (t > end ? totalDays : 0);
    return {
      income: s.income, expenses: s.expenses, savings: s.savings, rest: s.rest,
      spent: cents(spent), upcoming: cents(upcoming),
      daysLeft: daysLeft, totalDays: totalDays,
      perDay: daysLeft > 0 ? cents(Math.max(0, s.rest) / daysLeft) : 0,
      timePct: Math.round((elapsed / totalDays) * 100),
      moneyPct: s.income > 0 ? Math.min(100, Math.round(((spent + s.savings) / s.income) * 100)) : 0,
      summary: s
    };
  }

  /* --- Catégories et enveloppes ------------------------------------------------------- */
  function sameName(a, c) { return String(a || '').trim().toLowerCase() === String(c || '').trim().toLowerCase(); }
  function categoryOf(b, name) { return (b.categories || []).filter(function (c) { return sameName(c.name, name); })[0] || null; }
  function envelopes(b, start, end, today) {
    var items = expenseItems(b, start, end), t = today || D.today();
    return (b.categories || []).filter(function (c) { return c.kind !== 'income' && c.limit > 0; }).map(function (c) {
      var spent = 0, planned = 0;
      items.forEach(function (x) { if (sameName(x.category, c.name)) { if (x.date <= t) spent += x.amount; else planned += x.amount; } });
      var used = spent + planned;
      return { category: c, limit: c.limit, spent: cents(spent), planned: cents(planned), used: cents(used), left: cents(c.limit - used), pct: Math.round((used / c.limit) * 100) };
    }).sort(function (a, c) { return c.pct - a.pct; });
  }

  /* --- Frise du mois : paie, prélèvements, échéances, versements ---------------------- */
  function monthEvents(b, start, end) {
    var ev = [];
    incomeItems(b, start, end).forEach(function (x) { if (x.source === 'income') ev.push({ date: x.date, kind: 'income', label: x.label, amount: x.amount }); });
    expenseItems(b, start, end).forEach(function (x) { if (x.source !== 'entry') ev.push({ date: x.date, kind: x.source, label: x.label, amount: x.amount, paid: x.paid, key: x.key }); });
    planItems(b, start, end).forEach(function (x) {
      var g = (b.goals || []).filter(function (gg) { return gg.id === x.goalId; })[0];
      ev.push({ date: x.date, kind: 'saving', label: 'Épargne ' + (g ? g.name : ''), amount: x.amount });
    });
    return ev.sort(function (a, c) { return a.date < c.date ? -1 : a.date > c.date ? 1 : 0; });
  }

  /* --- Projection d'une cagnotte ------------------------------------------------------- */
  // Rythme mensuel : versements automatiques, sinon moyenne des versements des 90 derniers jours
  function goalProjection(b, g, today) {
    var t = today || D.today(), saved = goalSaved(b, g.id, t);
    var monthly = (b.plans || []).filter(function (p) { return p.goalId === g.id && (!p.until || p.until >= t); }).reduce(function (a, p) { return a + p.amount; }, 0);
    var auto = monthly > 0;
    if (!auto) {
      var from = D.addDays(t, -90), recent = b.deposits.filter(function (x) { return x.goalId === g.id && x.date > from && x.date <= t; }).reduce(function (a, x) { return a + x.amount; }, 0);
      monthly = recent > 0 ? recent / 3 : 0;
    }
    var out = { saved: saved, monthly: cents(monthly), auto: auto, months: null, date: null, reached: !!(g.target && saved >= g.target) };
    if (g.target && !out.reached && monthly > 0) {
      out.months = Math.ceil((g.target - saved) / monthly);
      out.date = D.addMonths(t, out.months);
    }
    return out;
  }

  return { budgetMonth: budgetMonth, cents: cents, billDates: billDates, schedule: schedule, installmentStatus: installmentStatus, paidKey: paidKey, isPaid: isPaid, expenseItems: expenseItems, summary: summary, goalSaved: goalSaved,
    incomeKey: incomeKey, incomeItems: incomeItems, planItems: planItems, forecast: forecast, categoryOf: categoryOf, envelopes: envelopes, monthEvents: monthEvents, goalProjection: goalProjection };
});
