'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../../shared/habits.js');
const BD = require('../../shared/badges.js');
const ICS = require('../../shared/ics.js');
const M = require('../../shared/model.js');
const { task, state, entry } = require('./helpers.js');

/* --- Habitudes ---------------------------------------------------------------- */
const hab = (extra) => H.normalize({ list: [Object.assign({ id: 'h1', name: 'Eau', target: 1, since: '2026-10-01' }, extra || {})], log: {} });

test('habitudes : normalisation (cible, jours, journal propre)', () => {
  const h = H.normalize({ list: [{ name: '  Lire ', target: 0, days: [0, 0, 9, 2] }, { name: '' }, null], log: { '2026-10-01': { a: 2, b: -1 }, bad: { a: 1 } } });
  assert.equal(h.list.length, 1);
  assert.equal(h.list[0].name, 'Lire');
  assert.equal(h.list[0].target, 1);
  assert.deepEqual(h.list[0].days, [0, 2]);
  assert.deepEqual(h.log, { '2026-10-01': { a: 2 } });
});

test('habitudes : série en cours (aujourd’hui pas encore fait = série d’hier), jours non prévus ignorés', () => {
  const h = hab({ days: [0, 1, 2, 3, 4] });            // lundi → vendredi
  const x = h.list[0];
  // jeu 22, ven 23 (sam/dim non prévus), lun 26, mar 27 octobre 2026
  ['2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27'].forEach((d) => { h.log[d] = { h1: 1 }; });
  assert.equal(H.streak(h.log, x, '2026-10-27'), 4);
  assert.equal(H.streak(h.log, x, '2026-10-28'), 4);     // mercredi pas encore coché
  assert.equal(H.streak(h.log, x, '2026-10-29'), 0);     // mercredi manqué
  assert.equal(H.bestStreak(h.log, x, '2026-10-29'), 4);
});

test('habitudes : objectif chiffré (8 verres) et taux de réussite', () => {
  const h = hab({ target: 8 });
  const x = h.list[0];
  h.log['2026-10-05'] = { h1: 8 };
  h.log['2026-10-06'] = { h1: 5 };
  assert.equal(H.isDone(h.log, x, '2026-10-05'), true);
  assert.equal(H.isDone(h.log, x, '2026-10-06'), false);
  assert.deepEqual(H.rate(h.log, x, '2026-10-05', '2026-10-11', '2026-10-06'), { planned: 2, done: 1, pct: 50 });
  assert.deepEqual(H.day(h.list, h.log, '2026-10-05'), { total: 1, done: 1, all: true });
});

/* --- Modèle ---------------------------------------------------------------------- */
test('modèle : nouveaux blocs normalisés (habitudes, focus, bilans, badges, calendrier, garde-robe)', () => {
  const d = M.normalize(state([], { focus: { work: 999, sessions: [{ date: '2026-10-01', minutes: 25 }, { date: 'x', minutes: 3 }] }, reviews: [{ week: '2026-10-05', priorities: [{ text: 'A' }, { text: '' }, { text: 'B' }, { text: 'C' }, { text: 'D' }] }, { week: '2026-10-05' }] }));
  assert.deepEqual(d.habits, { list: [], log: {} });
  assert.equal(d.focus.work, 25);
  assert.equal(d.focus.sessions.length, 1);
  assert.equal(d.reviews.length, 1);
  assert.equal(d.reviews[0].priorities.length, 3);
  assert.deepEqual(d.badges, { at: {} });
  assert.deepEqual(d.settings.calendar, { url: '', show: true, feedToken: '' });
  assert.deepEqual(d.profile.wardrobe, { me: null, memeow: null });
});

/* --- Badges ---------------------------------------------------------------------- */
test('badges : calculés depuis les données, espaces masqués exclus, cadeaux', () => {
  const tasks = [];
  for (let i = 0; i < 12; i++) tasks.push(task('t' + i, 'flowline', { status: 'done', timeEntries: [entry('2026-10-0' + (1 + (i % 5)), 60)] }));
  const d = M.normalize(state(tasks));
  d.moods = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].map((date) => ({ date, level: 4 }));
  const list = BD.compute(d, { today: '2026-10-08' });
  const got = (id) => list.find((b) => b.id === id);
  assert.equal(got('task-10').got, true);
  assert.equal(got('task-50').got, false);
  assert.equal(got('task-50').value, 12);
  assert.equal(got('mood-7').got, true);
  assert.equal(got('week-goal').got, false);                 // 12 h < 35 h
  const noHealth = BD.compute(d, { today: '2026-10-08', spaces: { health: false, budget: true } });
  assert.equal(noHealth.some((b) => b.id === 'sport-10'), false);
  assert.equal(BD.rewards(4).filter((r) => r.unlocked).length, 2);
  assert.deepEqual(BD.nextReward(4).item, 'beret');
  assert.equal(BD.nextReward(99), null);
});

/* --- Calendrier ------------------------------------------------------------------ */
const CAL = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:a', 'SUMMARY:Rendez-vous\\, dentiste', 'LOCATION:Lyon', 'DTSTART;TZID=Europe/Paris:20261105T100000', 'DTEND;TZID=Europe/Paris:20261105T113000',
  'BEGIN:VALARM', 'TRIGGER:-PT15M', 'END:VALARM', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'SUMMARY:Yoga', 'DTSTART;TZID=Europe/Paris:20261102T183000', 'DURATION:PT1H', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=4', 'EXDATE;TZID=Europe/Paris:20261105T183000', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'RECURRENCE-ID;TZID=Europe/Paris:20261109T183000', 'SUMMARY:Yoga (décalé)', 'DTSTART;TZID=Europe/Paris:20261110T190000', 'DTEND;TZID=Europe/Paris:20261110T200000', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c', 'SUMMARY:Vacances', 'DTSTART;VALUE=DATE:20261107', 'DTEND;VALUE=DATE:20261110', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:d', 'SUMMARY:Anniv', 'DTSTART;VALUE=DATE:20200229', 'RRULE:FREQ=YEARLY', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:e', 'SUMMARY:Loyer', 'DTSTART;VALUE=DATE:20260130', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:f', 'SUMMARY:Annulé', 'STATUS:CANCELLED', 'DTSTART:20261105T090000Z', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:g', 'SUMMARY:Une très longue', ' description repliée', 'DTSTART;VALUE=DATE:20261106', 'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

test('ics : lecture (lignes repliées, échappements, alarmes ignorées, annulés exclus)', () => {
  const ev = ICS.parse(CAL);
  assert.equal(ev.length, 7);
  const a = ev.find((e) => e.uid === 'a');
  assert.equal(a.title, 'Rendez-vous, dentiste');
  assert.equal(a.time, '10:00');
  assert.equal(a.minutes, 90);
  assert.equal(ev.find((e) => e.uid === 'g').title, 'Une très longuedescription repliée');
});

test('ics : occurrences avec répétitions, exceptions, occurrence déplacée, plusieurs jours', () => {
  const occ = ICS.occurrences(ICS.parse(CAL), '2026-11-01', '2026-11-30');
  const titles = (date) => occ.filter((o) => o.date === date).map((o) => o.title + (o.time ? ' ' + o.time + '-' + o.end : ''));
  assert.deepEqual(titles('2026-11-02'), ['Yoga 18:30-19:30']);
  assert.deepEqual(titles('2026-11-05'), ['Rendez-vous, dentiste 10:00-11:30']);   // yoga exclu (EXDATE)
  assert.deepEqual(titles('2026-11-09'), ['Vacances']);                              // yoga déplacé au 10
  assert.deepEqual(titles('2026-11-10'), ['Yoga (décalé) 19:00-20:00']);
  assert.deepEqual(titles('2026-11-12'), ['Yoga 18:30-19:30']);                      // 4e occurrence (COUNT)
  assert.deepEqual(titles('2026-11-16'), []);
  assert.deepEqual(titles('2026-11-30'), ['Loyer']);                                 // dernier jour du mois
  assert.equal(occ.filter((o) => o.title === 'Vacances').length, 3);                 // 7, 8, 9
  const feb = ICS.occurrences(ICS.parse(CAL), '2028-02-01', '2028-02-29');
  assert.ok(feb.some((o) => o.title === 'Anniv' && o.date === '2028-02-29'));
});

test('ics : export des échéances (tâches non terminées, lignes courtes)', () => {
  const d = M.normalize(state([task('t1', 'flowline', { title: 'Maquette, version finale; avec un titre assez long pour être replié sur deux lignes', endDate: '2026-11-12' }), task('t2', 'flowline', { status: 'done', endDate: '2026-11-01' }), task('t3', 'flowline')]));
  const out = ICS.build(d, { now: new Date(Date.UTC(2026, 10, 5, 8, 0, 0)) });
  assert.match(out, /DTSTART;VALUE=DATE:20261112/);
  assert.match(out, /DTEND;VALUE=DATE:20261113/);
  assert.equal((out.match(/BEGIN:VEVENT/g) || []).length, 1);
  out.split('\r\n').forEach((l) => assert.ok(l.length <= 75, l));
  const back = ICS.parse(out);
  assert.equal(back[0].title, '📌 Maquette, version finale; avec un titre assez long pour être replié sur deux lignes');
});

test('relais Supabase : ics.js est une copie exacte de shared/ics.js', () => {
  const fs = require('node:fs'), path = require('node:path');
  const a = fs.readFileSync(path.join(__dirname, '../../shared/ics.js'), 'utf8');
  const b = fs.readFileSync(path.join(__dirname, '../../../supabase/functions/calendar/ics.js'), 'utf8');
  assert.equal(b, a, 'copier app/shared/ics.js vers supabase/functions/calendar/ics.js');
});

test('habitudes : mesures (sommeil au moins 7 h, écran au plus 2 h, sans objectif), ancien format', () => {
  const h = H.normalize({ list: [
    { id: 's', name: 'Sommeil', kind: 'amount', unit: 'h', goal: 420, dir: 'min', since: '2026-10-01' },
    { id: 'e', name: 'Écran', kind: 'amount', unit: 'h', goal: 120, dir: 'max', since: '2026-10-01' },
    { id: 'p', name: 'Pas', kind: 'amount', unit: 'pas', since: '2026-10-01' },
    { id: 'old', name: 'Eau', target: 8, unit: 'verres' }
  ], log: { '2026-10-05': { s: 450, e: 0, p: 6420.456 }, '2026-10-06': { s: 380, e: 150 } } });
  const [s, e, p, old] = h.list;
  assert.equal(old.kind, 'count');
  assert.equal(H.isDone(h.log, s, '2026-10-05'), true);
  assert.equal(H.isDone(h.log, s, '2026-10-06'), false);
  assert.equal(H.isDone(h.log, e, '2026-10-05'), true);         // 0 min d'écran : réussi
  assert.equal(H.isDone(h.log, e, '2026-10-06'), false);
  assert.equal(H.isDone(h.log, e, '2026-10-07'), false);        // rien noté
  assert.equal(H.isDone(h.log, p, '2026-10-05'), true);         // sans objectif : noté = compté
  assert.equal(H.value(h.log, p, '2026-10-05'), 6420.46);
  const v = H.values(h.log, s, '2026-10-05', '2026-10-11');
  assert.deepEqual([v.count, v.avg, v.min, v.max], [2, 415, 380, 450]);
});

test('compteurs d’heures (sans tâche) : comptés par catégorie, par pôle, par jour, en CSV', () => {
  const ST = require('../../shared/stats.js');
  const CSV = require('../../shared/csv.js');
  const d = M.normalize(state([task('t1', 'flowline', { timeEntries: [entry('2026-10-05', 60)] })], {
    hours: [{ id: 'h1', date: '2026-10-05', categoryId: 'flowline', minutes: 420 }, { id: 'h2', date: '2026-10-10', categoryId: 'carnet', minutes: 240, note: 'Samedi' }, { date: 'x', minutes: 10 }, { date: '2026-10-06', categoryId: 'inconnue', minutes: 30 }]
  }));
  assert.equal(d.hours.length, 3);
  assert.equal(d.hours[2].categoryId, 'flowline');                // catégorie inconnue : réaffectée
  const byCat = ST.minutesByCategory(d, '2026-10-05', '2026-10-11');
  assert.equal(byCat.flowline, 60 + 420 + 30);
  assert.equal(byCat.carnet, 240);
  assert.deepEqual(ST.minutesByPole(d, '2026-10-05', '2026-10-11'), { flowline: 510, 'auto-entreprise': 240 });
  assert.equal(ST.dailyMinutes(d, 'flowline', '2026-10-05', '2026-10-11')['2026-10-05'], 480);
  assert.equal(ST.persoGoal(d, '2026-10-10', '2026-10-10').minutes, 240);
  const rows = CSV.rows(d, '2026-10-01', '2026-10-31');
  assert.ok(rows.some((r) => r.join(';').includes('Compteur d’heures') && r.join(';').includes('Samedi')));
});
