'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide, DataLock, STALE_MS, LOCK_FILE } = require('../../main/lock.js');

const NOW = Date.parse('2026-10-08T09:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

test('verrou : absent → on le prend', () => {
  assert.equal(decide(null, { host: 'PC-LAMIA' }, NOW).action, 'take');
});

test('verrou d’un autre PC, frais (< 5 min) → lecture seule', () => {
  const d = decide({ host: 'PC-FLOWLINE-12', heartbeatAt: iso(NOW - 60000) }, { host: 'PC-LAMIA' }, NOW);
  assert.equal(d.action, 'readonly');
  assert.equal(d.holder.host, 'PC-FLOWLINE-12');
});

test('verrou périmé (≥ 5 min sans battement) ou du même PC → on le reprend', () => {
  assert.equal(decide({ host: 'PC-FLOWLINE-12', heartbeatAt: iso(NOW - STALE_MS) }, { host: 'PC-LAMIA' }, NOW).reason, 'perime');
  assert.equal(decide({ host: 'pc-lamia', heartbeatAt: iso(NOW) }, { host: 'PC-LAMIA' }, NOW).reason, 'meme-pc');
  assert.equal(decide({ host: 'X', heartbeatAt: 'n’importe quoi' }, { host: 'PC-LAMIA' }, NOW).action, 'take');
});

test('cycle de vie : acquisition, battement de cœur, libération', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lamia-lock-'));
  let now = NOW;
  const lock = new DataLock({ dir, host: 'PC-LAMIA', user: 'lamia', appVersion: '0.1.0', now: () => now });
  const r = lock.acquire();
  assert.equal(r.ok, true);
  lock.stopHeartbeat();
  const file = path.join(dir, LOCK_FILE);
  const c1 = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(c1.host, 'PC-LAMIA');
  assert.equal(c1.pid, process.pid);
  now += 60000;
  assert.equal(lock.heartbeat(), true);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).heartbeatAt, iso(now));
  lock.release();
  assert.equal(fs.existsSync(file), false);
});

test('autre PC actif : lecture seule, puis « Forcer l’ouverture »', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lamia-lock-'));
  fs.writeFileSync(path.join(dir, LOCK_FILE), JSON.stringify({ host: 'AUTRE-PC', pid: 1, openedAt: iso(NOW - 120000), heartbeatAt: iso(NOW - 30000) }));
  const lock = new DataLock({ dir, host: 'PC-LAMIA', now: () => NOW });
  const r = lock.acquire();
  assert.equal(r.ok, false);
  assert.equal(r.holder.host, 'AUTRE-PC');
  assert.equal(lock.held, false);
  const f = lock.acquire({ force: true });
  assert.equal(f.ok, true);
  lock.stopHeartbeat();
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, LOCK_FILE), 'utf8')).host, 'PC-LAMIA');
  lock.release();
});

test('verrou repris par un autre PC pendant l’ouverture : on ne le supprime pas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lamia-lock-'));
  const lock = new DataLock({ dir, host: 'PC-LAMIA', now: () => NOW });
  lock.acquire();
  lock.stopHeartbeat();
  fs.writeFileSync(path.join(dir, LOCK_FILE), JSON.stringify({ host: 'AUTRE-PC', pid: 2, heartbeatAt: iso(NOW) }));
  assert.equal(lock.heartbeat(), false);
  lock.release();
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, LOCK_FILE), 'utf8')).host, 'AUTRE-PC');
});
