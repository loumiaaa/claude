'use strict';
process.env.TZ = 'Europe/Paris';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../../shared/dates.js');

test('semaines ISO : jeudi 8 octobre 2026 = S41, du lundi 5 au dimanche 11', () => {
  assert.equal(D.isoWeek('2026-10-08'), 41);
  assert.equal(D.startOfWeek('2026-10-08'), '2026-10-05');
  assert.equal(D.endOfWeek('2026-10-08'), '2026-10-11');
  assert.equal(D.weekKey('2026-10-08'), '2026-S41');
});

test('semaines ISO : 2026 compte 53 semaines, 2027 commence le 4 janvier', () => {
  assert.deepEqual(D.isoWeekInfo('2026-12-31'), { year: 2026, week: 53 });
  assert.deepEqual(D.isoWeekInfo('2027-01-03'), { year: 2026, week: 53 });
  assert.deepEqual(D.isoWeekInfo('2027-01-04'), { year: 2027, week: 1 });
  assert.deepEqual(D.isoWeekInfo('2024-12-30'), { year: 2025, week: 1 });   // le jeudi décide de l'année
});

test('dates locales : parse, iso, dates invalides', () => {
  assert.equal(D.iso(D.parse('2026-02-28')), '2026-02-28');
  assert.equal(D.parse('2026-02-31'), null);
  assert.equal(D.parse('08/10/2026'), null);
  assert.equal(D.valid('2026-10-08'), true);
});

test('écarts de jours insensibles aux changements d’heure', () => {
  assert.equal(D.diff('2026-10-24', '2026-10-26'), 2);      // passage à l'heure d'hiver le 25
  assert.equal(D.diff('2027-03-27', '2027-03-29'), 2);      // passage à l'heure d'été le 28
  assert.equal(D.addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(D.addMonths('2026-01-31', 1), '2026-02-28');
});

test('découpage par jour local : 25 h le 25/10/2026, 23 h le 28/03/2027', () => {
  const a = new Date(2026, 9, 25, 0, 0).getTime();
  const b = new Date(2026, 9, 26, 0, 0).getTime();
  assert.deepEqual(D.splitByDay(a, b), [{ date: '2026-10-25', ms: 25 * 3600000 }]);
  const c = new Date(2027, 2, 28, 0, 0).getTime();
  const d = new Date(2027, 2, 29, 0, 0).getTime();
  assert.deepEqual(D.splitByDay(c, d), [{ date: '2027-03-28', ms: 23 * 3600000 }]);
  const e = new Date(2026, 9, 8, 23, 0).getTime();
  const f = new Date(2026, 9, 9, 1, 30).getTime();
  assert.deepEqual(D.splitByDay(e, f), [{ date: '2026-10-08', ms: 3600000 }, { date: '2026-10-09', ms: 1.5 * 3600000 }]);
});

test('horloge centrale : setNow simule la date, le temps continue de s’écouler', () => {
  D.setNow('2026-10-08T09:30:00');
  assert.equal(D.today(), '2026-10-08');
  assert.equal(D.now().getHours(), 9);
  assert.equal(D.isClockShifted(), true);
  D.setNow('2027-01-04');
  assert.equal(D.today(), '2027-01-04');
  D.setNow(null);
  assert.equal(D.isClockShifted(), false);
  assert.equal(D.today(), D.iso(new Date()));
  assert.equal(D.setNow('pas une date'), false);
});

test('périodes jour / semaine / mois relatives à aujourd’hui', () => {
  D.setNow('2026-10-08T10:00');
  const w = D.period('week');
  assert.equal(w.start, '2026-10-05');
  assert.equal(w.end, '2026-10-11');
  assert.equal(w.shortLabel, 'Cette semaine');
  const m = D.period('month', '2026-02-10');
  assert.equal(m.start, '2026-02-01');
  assert.equal(m.end, '2026-02-28');
  assert.equal(D.period('day').shortLabel, 'Aujourd’hui');
  assert.equal(D.shift('week', '2026-10-08', 1), '2026-10-12');
  assert.equal(D.relative('2026-10-09'), 'Demain');
  D.setNow(null);
});

test('saisie des durées : 1h30, 1 h 30, 90, 1,5, 1.5, 0h45, 2h, 90 min', () => {
  const cases = { '1h30': 90, '1 h 30': 90, '90': 90, '1,5': 90, '1.5': 90, '0h45': 45, '2h': 120, '90 min': 90, '7': 420, '1:15': 75 };
  for (const [input, minutes] of Object.entries(cases)) assert.equal(D.parseDuration(input), minutes, input);
});

test('saisie des durées : refus des saisies invalides, dont « 1h75 » (QA-02)', () => {
  for (const bad of ['', 'abc', '1h75', '1h99', '0', '-2', '25h', 'h30']) assert.equal(D.parseDuration(bad), null, bad);
});

test('formats : durée, heures décimales à virgule, h:mm, chrono', () => {
  const NB = D.NBSP;
  assert.equal(D.duration(445), '7' + NB + 'h' + NB + '25');
  assert.equal(D.duration(60), '1' + NB + 'h');
  assert.equal(D.duration(45), '45' + NB + 'min');
  assert.equal(D.duration(0), '0' + NB + 'h');
  assert.equal(D.decimalHours(90), '1,50');
  assert.equal(D.decimalHours(445), '7,42');
  assert.equal(D.hhmm(445), '7:25');
  assert.equal(D.hhmm(5), '0:05');
  assert.equal(D.clock(4354000), '01:12:34');
  assert.equal(D.numeric('2026-10-08'), '08/10/2026');
  assert.equal(D.long('2026-10-01'), 'jeudi 1er' + NB + 'octobre 2026');
});
