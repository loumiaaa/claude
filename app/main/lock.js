'use strict';
/* ==========================================================================
   Verrou anti double ouverture entre plusieurs PC (dossier OneDrive, clé USB).
   Donnees-Lamia/verrou.json = { host, user, pid, appVersion, openedAt, heartbeatAt }
   - rafraîchi toutes les minutes (battement de cœur) ;
   - périmé après 5 minutes sans battement ;
   - tenu par un AUTRE PC et frais : l'app s'ouvre en lecture seule ;
   - même PC (plantage, relance) ou verrou périmé : on le reprend.
   La même machine est protégée par app.requestSingleInstanceLock().
   ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');

const LOCK_FILE = 'verrou.json';
const STALE_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

// Décision pure : existing = contenu du verrou (ou null), me = { host }, now = ms
function decide(existing, me, now) {
  if (!existing || typeof existing !== 'object') return { action: 'take', reason: 'absent' };
  const beat = Date.parse(existing.heartbeatAt || existing.openedAt || '');
  if (isNaN(beat)) return { action: 'take', reason: 'illisible' };
  if (String(existing.host || '').toLowerCase() === String(me.host || '').toLowerCase()) return { action: 'take', reason: 'meme-pc' };
  if (now - beat >= STALE_MS) return { action: 'take', reason: 'perime' };
  return { action: 'readonly', reason: 'autre-pc', holder: existing };
}

class DataLock {
  constructor({ dir, host, user, appVersion, now }) {
    this.file = path.join(dir, LOCK_FILE);
    this.me = { host, user: user || '', pid: process.pid, appVersion: appVersion || '' };
    this.now = now || Date.now;
    this.held = false;
    this.timer = null;
    this.openedAt = null;
  }

  read() {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { return null; }
  }

  write() {
    const at = new Date(this.now()).toISOString();
    const body = JSON.stringify(Object.assign({}, this.me, { openedAt: this.openedAt || at, heartbeatAt: at }), null, 2);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, this.file);
  }

  // Renvoie { ok: true } ou { ok: false, holder } (lecture seule)
  acquire({ force } = {}) {
    const existing = this.read();
    const d = force ? { action: 'take', reason: 'force' } : decide(existing, this.me, this.now());
    if (d.action !== 'take') { this.held = false; return { ok: false, holder: d.holder, reason: d.reason }; }
    this.openedAt = new Date(this.now()).toISOString();
    try { this.write(); } catch (e) { this.held = false; return { ok: false, error: e.code || e.message, reason: 'ecriture' }; }
    this.held = true;
    this.startHeartbeat();
    return { ok: true, reason: d.reason, previous: existing };
  }

  // Le verrou est-il toujours à nous ? (un autre PC a pu forcer l'ouverture)
  stillMine() {
    const cur = this.read();
    return !!cur && String(cur.host).toLowerCase() === String(this.me.host).toLowerCase() && cur.pid === this.me.pid;
  }

  heartbeat() {
    if (!this.held) return false;
    if (!this.stillMine()) { this.held = false; this.stopHeartbeat(); return false; }
    try { this.write(); } catch (e) { /* dossier momentanément indisponible : on réessaie au prochain battement */ }
    return true;
  }

  startHeartbeat(onLost) {
    this.stopHeartbeat();
    if (onLost) this.onLost = onLost;
    this.timer = setInterval(() => {
      if (!this.heartbeat() && this.onLost) this.onLost();
    }, HEARTBEAT_MS);
    if (this.timer.unref) this.timer.unref();
  }

  stopHeartbeat() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  release() {
    this.stopHeartbeat();
    if (!this.held) return;
    this.held = false;
    try { if (this.stillMine()) fs.unlinkSync(this.file); } catch (e) { /* déjà supprimé */ }
  }
}

module.exports = { LOCK_FILE, STALE_MS, HEARTBEAT_MS, decide, DataLock };
