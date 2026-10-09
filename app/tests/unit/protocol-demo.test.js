'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const proto = require('../../main/protocol.js');
const demo = require('../../shared/demo.js');
const M = require('../../shared/model.js');
const D = require('../../shared/dates.js');

const roots = { renderer: path.resolve('/app/renderer'), shared: path.resolve('/app/shared') };

test('protocole app:// : sert renderer/ et shared/, refuse tout le reste', () => {
  assert.equal(proto.resolveFile('app://lamia/', roots), path.join(roots.renderer, 'index.html'));
  assert.equal(proto.resolveFile('app://lamia/js/app.js', roots), path.join(roots.renderer, 'js', 'app.js'));
  assert.equal(proto.resolveFile('app://lamia/shared/dates.js', roots), path.join(roots.shared, 'dates.js'));
  assert.equal(proto.resolveFile('app://lamia/../main/index.js', roots), path.join(roots.renderer, 'main', 'index.js'));  // normalisé par l'URL
  assert.equal(proto.resolveFile('app://lamia/%2e%2e/%2e%2e/etc/passwd', roots), path.join(roots.renderer, 'etc', 'passwd'));  // reste dans renderer/
  assert.equal(proto.resolveFile('app://lamia/..%5C..%5Cmain%5Cindex.js', roots), null);
  assert.equal(proto.resolveFile('app://lamia/js/%2E%2E%2F%2E%2E%2Fmain/index.js', roots), null);
  assert.equal(proto.resolveFile('app://autre/index.html', roots), null);
  assert.equal(proto.resolveFile('https://example.com/', roots), null);
});

test('CSP stricte : ni script inline, ni eval, ni réseau', () => {
  assert.match(proto.CSP, /default-src 'none'/);
  assert.match(proto.CSP, /script-src 'self'(;|$)/);
  assert.match(proto.CSP, /connect-src 'none'/);
  assert.doesNotMatch(proto.CSP, /unsafe-eval/);
});

test('données de démo : identiques à la maquette au 8 octobre 2026, valides', () => {
  const s = demo.seed({ today: '2026-10-08', nowMs: Date.parse('2026-10-08T08:00:00Z') });
  assert.equal(M.validate(s).ok, true);
  assert.equal(s.tasks.length, 24);
  assert.equal(s.moods.length, 26);
  assert.equal(s.tasks.find((t) => t.id === 't09').completedAt, '2026-10-08');
  assert.equal(s.activeTimer.taskId, 't03');
});

test('données de démo : relatives à la date du jour (retards, terminée aujourd’hui, rien dans le futur)', () => {
  const today = '2027-03-17';
  const s = demo.seed({ today, nowMs: Date.parse('2027-03-17T09:00:00Z') });
  assert.equal(M.validate(s).ok, true);
  assert.equal(s.tasks.find((t) => t.id === 't09').completedAt, today);
  const shift = D.diff('2026-10-08', today);
  assert.equal(s.tasks.find((t) => t.id === 't01').endDate, D.addDays('2026-10-09', shift));
  const entries = s.tasks.flatMap((t) => t.timeEntries);
  assert.ok(entries.length > 30);
  assert.ok(entries.every((e) => e.date <= today));
  assert.ok(s.moods.every((m) => m.date < today));
});
