'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../shared/budget.js');
const M = require('../../shared/model.js');

const budget = () => M.normalizeBudget({
  entries: [
    { id: 'e1', date: '2026-10-01', type: 'income', label: 'Salaire', amount: 1800 },
    { id: 'e2', date: '2026-10-05', type: 'expense', label: 'Courses', amount: 82.4, category: 'Courses' },
    { id: 'e3', date: '2026-09-30', type: 'expense', label: 'Hors période', amount: 999 }
  ],
  bills: [
    { id: 'b1', label: 'Loyer', amount: 650, day: 5, since: '2026-01-01', category: 'Logement' },
    { id: 'b2', label: 'Forfait', amount: 15.99, day: 31, since: '2026-01-01' },
    { id: 'b3', label: 'Assurance', amount: 120, day: 15, every: 'year', month: 3, since: '2026-01-01' }
  ],
  installments: [{ id: 'i1', label: 'iPhone', total: 100, count: 3, first: '2026-09-20' }],
  goals: [{ id: 'g1', name: 'BTS', target: 500 }],
  deposits: [{ id: 'd1', goalId: 'g1', date: '2026-10-10', amount: 100 }, { id: 'd2', goalId: 'g1', date: '2026-08-10', amount: 50 }]
});

test('factures : mensuelles (jour 31 ramené au dernier jour), annuelles seulement leur mois', () => {
  const b = budget();
  assert.deepEqual(B.billDates(b.bills[1], '2026-02-01', '2026-02-28'), ['2026-02-28']);
  assert.deepEqual(B.billDates(b.bills[2], '2026-01-01', '2026-12-31'), ['2026-03-15']);
  assert.deepEqual(B.billDates(b.bills[0], '2025-12-01', '2026-01-31'), ['2026-01-05']);   // rien avant « depuis »
});

test('paiement en plusieurs fois : échéances mensuelles, arrondi sur la dernière', () => {
  const s = B.schedule({ total: 100, count: 3, first: '2026-09-20' });
  assert.deepEqual(s.map((x) => [x.date, x.amount]), [['2026-09-20', 33.33], ['2026-10-20', 33.33], ['2026-11-20', 33.34]]);
  const st = B.installmentStatus({ total: 100, count: 3, first: '2026-09-20' }, '2026-10-25');
  assert.equal(st.paidCount, 2); assert.equal(st.remaining, 33.34); assert.equal(st.next.date, '2026-11-20');
});

test('résumé du mois : entrées, dépenses (ponctuelles + factures + échéances), économies, reste', () => {
  const r = B.summary(budget(), '2026-10-01', '2026-10-31');
  assert.equal(r.income, 1800);
  assert.equal(r.expenses, 82.4 + 650 + 15.99 + 33.33);
  assert.equal(r.savings, 100);
  assert.equal(r.rest, B.cents(1800 - (82.4 + 650 + 15.99 + 33.33) - 100));
  assert.equal(r.byCategory[0].category, 'Logement');
});

test('résumé de la semaine et total d’une cagnotte', () => {
  const r = B.summary(budget(), '2026-10-05', '2026-10-11');
  assert.equal(r.expenses, 82.4 + 650);
  assert.equal(r.savings, 100);
  assert.equal(B.goalSaved(budget(), 'g1'), 150);
});

test('mois budgétaire du 27 au 26 : rattachement des dates, fin de mois et année', () => {
  assert.deepEqual(B.budgetMonth('2026-10-28', 27), { start: '2026-10-27', end: '2026-11-26', label: 'Du 27 oct. au 26 nov. 2026' }.start ? B.budgetMonth('2026-10-28', 27) : null);
  assert.equal(B.budgetMonth('2026-10-28', 27).start, '2026-10-27');
  assert.equal(B.budgetMonth('2026-10-28', 27).end, '2026-11-26');
  assert.equal(B.budgetMonth('2026-11-26', 27).start, '2026-10-27');
  assert.equal(B.budgetMonth('2026-10-12', 27).start, '2026-09-27');
  assert.equal(B.budgetMonth('2027-01-03', 27).start, '2026-12-27');
  assert.equal(B.budgetMonth('2027-01-03', 27).end, '2027-01-26');
  assert.equal(B.budgetMonth('2026-10-12', 1).start, '2026-10-01');
  assert.equal(B.budgetMonth('2026-10-12', 1).end, '2026-10-31');
  // La paie du 28 tombe bien dans le mois qui commence le 27
  const b = M.normalizeBudget({ entries: [{ id: 'p', date: '2026-10-28', type: 'income', label: 'Paie', amount: 1800 }] });
  const p = B.budgetMonth('2026-11-10', b.startDay);
  assert.equal(b.startDay, 27);
  assert.equal(B.summary(b, p.start, p.end).income, 1800);
});

test('paiements cochés : facture et échéances marquées « passées » à la main', () => {
  const b = { entries: [], deposits: [], goals: [], bills: [{ id: 'b1', label: 'Loyer', amount: 600, day: 5, every: 'month', since: '2026-01-01' }],
    installments: [{ id: 'i1', label: 'MacBook', total: 1200, count: 4, first: '2026-09-15' }], paid: ['bill:b1:2026-10-05', 'inst:i1:2026-09-15'] };
  const items = B.expenseItems(b, '2026-09-27', '2026-10-26');
  const loyer = items.find((x) => x.source === 'bill'), mac = items.find((x) => x.source === 'installment');
  assert.equal(loyer.key, 'bill:b1:2026-10-05');
  assert.equal(loyer.paid, true);
  assert.equal(mac.key, 'inst:i1:2026-10-15');
  assert.equal(mac.paid, false);
  const st = B.installmentStatus(b.installments[0], '2026-10-28', b.paid);
  assert.equal(st.paidCount, 1);
  assert.equal(st.next.date, '2026-10-15');            // l'échéance passée mais pas cochée reste à vérifier
  assert.equal(st.remaining, 900);
  assert.equal(B.installmentStatus(b.installments[0], '2026-10-28').paidCount, 2);   // sans liste : comportement d'avant
});

test('paie automatique, montant corrigé d’un mois, versements automatiques et reste à vivre', () => {
  const b = M.normalizeBudget({
    entries: [{ id: 'e1', date: '2026-11-02', type: 'expense', label: 'Courses', amount: 100, category: 'courses' }],
    bills: [{ id: 'b1', label: 'Loyer', amount: 600, day: 5, since: '2026-01-01', category: 'Logement' }],
    incomes: [{ id: 'i1', label: 'Paie', amount: 1800, day: 28, since: '2026-01-01' }],
    adjust: { 'inc:i1:2026-10-28': 1900 },
    goals: [{ id: 'g1', name: 'BTS', target: 1000 }],
    plans: [{ id: 'p1', goalId: 'g1', amount: 100, day: 28, since: '2026-09-01' }]
  });
  const m = B.budgetMonth('2026-11-03', 27);
  assert.deepEqual([m.start, m.end], ['2026-10-27', '2026-11-26']);
  const f = B.forecast(b, m.start, m.end, '2026-11-03');
  assert.equal(f.income, 1900);                 // le mois corrigé
  assert.equal(f.savings, 100);                 // versement automatique du 28
  assert.equal(f.spent, 100);                   // les courses du 2 novembre
  assert.equal(f.upcoming, 600);                // le loyer du 5 novembre
  assert.equal(f.rest, 1100);
  assert.equal(f.daysLeft, 24);
  assert.equal(f.perDay, 45.83);
  assert.equal(B.goalSaved(b, 'g1', '2026-11-03'), 200);   // 28 septembre et 28 octobre
  const pr = B.goalProjection(b, b.goals[0], '2026-11-03');
  assert.equal(pr.auto, true);
  assert.equal(pr.months, 8);                   // 800 € restants à 100 €/mois
  assert.equal(pr.date, '2027-07-03');
});

test('catégories par défaut, catégories déjà utilisées gardées, enveloppes', () => {
  const b = M.normalizeBudget({ entries: [{ id: 'e', date: '2026-11-01', type: 'expense', label: 'Croquettes', amount: 40, category: 'Animaux' }] });
  assert.ok(b.categories.find((c) => c.name === 'Courses' && c.icon === '🛒'));
  assert.ok(b.categories.find((c) => c.name === 'Animaux' && c.kind === 'expense'));
  b.categories.find((c) => c.name === 'Animaux').limit = 50;
  const env = B.envelopes(b, '2026-10-27', '2026-11-26', '2026-11-03');
  assert.equal(env.length, 1);
  assert.equal(env[0].left, 10);
  assert.equal(env[0].pct, 80);
});
