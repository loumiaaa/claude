'use strict';
/* ==========================================================================
   Stockage de Donnees-Lamia/ (sans Electron : testé avec de vrais dossiers).

   Donnees-Lamia/
   ├── data.json                 toutes les données (schemaVersion, meta.revision)
   ├── verrou.json               présent tant que l'app est ouverte (cf. lock.js)
   ├── LISEZ-MOI.txt
   ├── sauvegardes/
   │   ├── data-AAAA-MM-JJ.json  1 par jour, 30 conservées
   │   └── avant-<motif>-<horodatage>.json   (migration, import, restauration, démo : 10 de chaque)
   └── exports/                  dossier proposé pour le CSV, le PDF et le JSON

   - Écriture atomique : data.json.tmp → fsync → renommage (avec nouvelles
     tentatives : antivirus, OneDrive, indexation peuvent bloquer un instant).
   - Fichier illisible : AUCUNE écriture ; l'app propose de restaurer.
   - Contrôle de révision avant chaque écriture : si data.json a été modifié
     ailleurs (autre PC via OneDrive), notre version part dans une copie
     « data-conflit-… » et rien n'est écrasé.
   ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const model = require('../shared/model.js');
const D = require('../shared/dates.js');

const DATA_FILE = 'data.json';
const BACKUP_DIR = 'sauvegardes';
const EXPORT_DIR = 'exports';
const DAILY_KEEP = 30;
const BEFORE_KEEP = 10;
const DAILY_RE = /^data-(\d{4}-\d{2}-\d{2})\.json$/;
const BEFORE_RE = /^avant-([a-z0-9-]+?)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d+)?)\.json$/;

const README = [
  'Plateforme de suivi - Lamia : dossier de données',
  '',
  'Ce dossier contient toutes tes données (data.json) et tes sauvegardes.',
  '- Ne modifie pas data.json à la main.',
  '- Pour changer de PC ou mettre à jour l’application : garde ce dossier à côté de l’exe.',
  '- sauvegardes/ : une copie par jour (30 jours), restaurables depuis les Réglages.',
  '- verrou.json : présent tant que l’application est ouverte (ne pas le supprimer).',
  ''
].join('\r\n');

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* rien */ }
}

function stamp(ms) {
  const d = new Date(ms);
  const p = D.pad;
  return D.iso(d) + 'T' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
}

// Écriture atomique : fichier temporaire, fsync, puis renommage (6 tentatives).
function writeAtomic(file, content, fsImpl) {
  const f = fsImpl || fs;
  const tmp = file + '.tmp';
  const fd = f.openSync(tmp, 'w');
  try { f.writeSync(fd, content); f.fsyncSync(fd); } finally { f.closeSync(fd); }
  let delay = 50;
  for (let i = 0; ; i++) {
    try { f.renameSync(tmp, file); return; } catch (e) {
      const retry = ['EPERM', 'EBUSY', 'EACCES'].indexOf(e.code) >= 0;
      if (!retry || i >= 5) { try { f.unlinkSync(tmp); } catch (x) { /* rien */ } throw e; }
      sleepSync(delay); delay *= 2;
    }
  }
}

class DataStore {
  constructor({ dir, host, appVersion, nowMs, fsImpl }) {
    this.dir = dir;
    this.host = host || 'PC';
    this.appVersion = appVersion || null;
    this.nowMs = nowMs || D.nowMs;
    this.fs = fsImpl || fs;
    this.file = path.join(dir, DATA_FILE);
    this.backupDir = path.join(dir, BACKUP_DIR);
    this.exportDir = path.join(dir, EXPORT_DIR);
    this.last = null;        // { mtimeMs, size, revision } du fichier tel qu'on l'a lu ou écrit
    this.doc = null;
  }

  ensureDirs() {
    [this.dir, this.backupDir, this.exportDir].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d); });
    const readme = path.join(this.dir, 'LISEZ-MOI.txt');
    if (!fs.existsSync(readme)) { try { fs.writeFileSync(readme, '﻿' + README); } catch (e) { /* facultatif */ } }
  }

  nowIso() { return new Date(this.nowMs()).toISOString(); }
  today() { return D.dateOf(this.nowMs()); }

  remember() {
    try {
      const st = fs.statSync(this.file);
      this.last = { mtimeMs: st.mtimeMs, size: st.size, revision: this.doc && this.doc.meta ? this.doc.meta.revision : 0 };
    } catch (e) { this.last = null; }
  }

  /* --- Chargement ------------------------------------------------------- */
  // { status: 'ok' | 'created' | 'corrupt' | 'too-new', doc, migrated, from, error }
  load() {
    this.ensureDirs();
    const tmp = this.file + '.tmp';
    if (!fs.existsSync(this.file)) {
      // Un .tmp orphelin sans data.json : on l'examine (écriture interrompue au tout dernier moment)
      if (fs.existsSync(tmp)) {
        const rescued = this.parseFile(tmp);
        if (rescued.ok) { fs.renameSync(tmp, this.file); return this.load(); }
        try { fs.renameSync(tmp, path.join(this.dir, `data-illisible-${stamp(this.nowMs())}.json`)); } catch (e) { /* rien */ }
      }
      this.doc = model.defaultState({ nowIso: this.nowIso(), appVersion: this.appVersion, host: this.host });
      this.writeDoc(this.doc);
      return { status: 'created', doc: this.doc, migrated: false };
    }
    const res = this.parseFile(this.file);
    if (!res.ok) return { status: res.code === 'TOO_NEW' ? 'too-new' : 'corrupt', error: res.error, doc: res.doc || null, version: res.version };
    if (fs.existsSync(tmp)) { try { fs.unlinkSync(tmp); } catch (e) { /* rien */ } }
    this.doc = res.doc;
    if (res.migrated) {
      this.copyToBackup(this.file, `avant-migration-v${res.from}`);
      this.writeDoc(this.doc);
    } else this.remember();
    return { status: 'ok', doc: this.doc, migrated: res.migrated, from: res.from };
  }

  // Lit, migre et valide un fichier. { ok, doc, from, migrated } ou { ok:false, code, error }
  parseFile(file) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) {
      return { ok: false, code: 'PARSE', error: 'Fichier illisible (JSON invalide).' };
    }
    return this.parseDoc(raw);
  }

  parseDoc(raw) {
    let m;
    try { m = model.migrate(raw, { nowIso: this.nowIso(), appVersion: this.appVersion }); } catch (e) {
      if (e.code === 'TOO_NEW') {
        // Données plus récentes que l'exe : affichage en lecture seule si la structure est lisible
        let doc = null;
        try { doc = model.normalize(JSON.parse(JSON.stringify(raw))); doc.schemaVersion = model.SCHEMA_VERSION; if (!model.validate(doc).ok) doc = null; } catch (x) { doc = null; }
        return { ok: false, code: 'TOO_NEW', error: e.message, doc, version: e.version };
      }
      return { ok: false, code: e.code || 'UNKNOWN', error: e.message };
    }
    const v = model.validate(m.doc);
    if (!v.ok) return { ok: false, code: 'INVALID', error: 'Données incomplètes : ' + v.errors.slice(0, 3).join(' ') };
    return { ok: true, doc: m.doc, from: m.from, migrated: m.migrated };
  }

  // Met le fichier abîmé de côté (jamais supprimé) avant de repartir d'une sauvegarde
  setAsideCorrupt() {
    const target = path.join(this.dir, `data-illisible-${stamp(this.nowMs())}.json`);
    try { fs.renameSync(this.file, target); } catch (e) { try { fs.copyFileSync(this.file, target); } catch (x) { /* rien */ } }
    return target;
  }

  /* --- Écriture --------------------------------------------------------- */
  writeDoc(doc) {
    doc.meta = doc.meta || {};
    doc.meta.savedAt = this.nowIso();
    doc.meta.savedBy = this.host;
    doc.meta.appVersion = this.appVersion;
    writeAtomic(this.file, JSON.stringify(doc, null, 2), this.fs);
    this.doc = doc;
    this.remember();
  }

  // Le fichier a-t-il été modifié ailleurs depuis notre dernière lecture / écriture ?
  externalChange() {
    if (!this.last) return null;
    let st;
    try { st = fs.statSync(this.file); } catch (e) { return null; }   // supprimé : on le recrée
    if (st.mtimeMs === this.last.mtimeMs && st.size === this.last.size) return null;
    let rev = null;
    try { rev = JSON.parse(fs.readFileSync(this.file, 'utf8')).meta.revision; } catch (e) { rev = 'illisible'; }
    if (rev === this.last.revision) { this.last.mtimeMs = st.mtimeMs; this.last.size = st.size; return null; }
    return { revision: rev };
  }

  // Sauvegarde du document envoyé par l'interface. { ok, revision, savedAt } ou { ok:false, conflict|error }
  save(doc, opts) {
    opts = opts || {};
    const v = model.validate(doc);
    if (!v.ok) return { ok: false, error: 'Document refusé : ' + v.errors.slice(0, 3).join(' ') };
    if (!opts.force) {
      const ext = this.externalChange();
      if (ext) {
        const file = path.join(this.dir, `data-conflit-${String(this.host).replace(/[^\w-]+/g, '_')}-${stamp(this.nowMs())}.json`);
        try { writeAtomic(file, JSON.stringify(doc, null, 2), this.fs); } catch (e) { /* rien */ }
        return { ok: false, conflict: true, file, theirRevision: ext.revision };
      }
    }
    const base = this.last ? this.last.revision || 0 : (doc.meta && doc.meta.revision) || 0;
    doc.meta = Object.assign({}, doc.meta, { revision: base + 1 });
    try { this.writeDoc(doc); } catch (e) { return { ok: false, error: e.code || e.message }; }
    return { ok: true, revision: doc.meta.revision, savedAt: doc.meta.savedAt };
  }

  // Remplace toutes les données (import, restauration, démo) après une copie de sécurité
  replace(doc, kind) {
    const before = fs.existsSync(this.file) ? this.copyToBackup(this.file, 'avant-' + kind) : null;
    const res = this.parseDoc(doc);
    if (!res.ok) return { ok: false, error: res.error };
    res.doc.meta.revision = (this.last && this.last.revision) || 0;
    const s = this.save(res.doc, { force: true });
    if (!s.ok) return s;
    return { ok: true, doc: res.doc, backup: before && path.basename(before) };
  }

  /* --- Sauvegardes ------------------------------------------------------- */
  copyToBackup(src, prefix) {
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir);
    let name = `${prefix}-${stamp(this.nowMs())}.json`;
    for (let i = 2; fs.existsSync(path.join(this.backupDir, name)); i++) name = `${prefix}-${stamp(this.nowMs())}-${i}.json`;
    const dest = path.join(this.backupDir, name);
    fs.copyFileSync(src, dest);
    this.prune();
    return dest;
  }

  // Une sauvegarde par jour (à la première ouverture du jour, puis au changement de date)
  dailyBackup() {
    if (!fs.existsSync(this.file)) return null;
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir);
    const dest = path.join(this.backupDir, `data-${this.today()}.json`);
    if (fs.existsSync(dest)) return null;
    fs.copyFileSync(this.file, dest);
    this.prune();
    return dest;
  }

  prune() {
    let files;
    try { files = fs.readdirSync(this.backupDir); } catch (e) { return; }
    const daily = files.filter((f) => DAILY_RE.test(f)).sort().reverse();
    daily.slice(DAILY_KEEP).forEach((f) => { try { fs.unlinkSync(path.join(this.backupDir, f)); } catch (e) { /* rien */ } });
    const groups = {};
    files.forEach((f) => { const m = BEFORE_RE.exec(f); if (m) (groups[m[1]] = groups[m[1]] || []).push(f); });
    Object.keys(groups).forEach((k) => {
      groups[k].sort().reverse().slice(BEFORE_KEEP).forEach((f) => { try { fs.unlinkSync(path.join(this.backupDir, f)); } catch (e) { /* rien */ } });
    });
  }

  listBackups() {
    let files = [];
    try { files = fs.readdirSync(this.backupDir); } catch (e) { return []; }
    return files.map((f) => {
      const daily = DAILY_RE.exec(f), before = BEFORE_RE.exec(f);
      if (!daily && !before) return null;
      const full = path.join(this.backupDir, f);
      let summary = null, st = null;
      try { st = fs.statSync(full); summary = model.summarize(JSON.parse(fs.readFileSync(full, 'utf8'))); } catch (e) { summary = null; }
      return {
        id: f,
        kind: daily ? 'quotidienne' : before[1],
        date: daily ? daily[1] : before[2].slice(0, 10),
        time: before ? before[2].slice(11, 16).replace('-', ':') : null,
        mtime: st ? st.mtime.toISOString() : null,
        size: st ? st.size : 0,
        summary,
        readable: !!summary
      };
    }).filter(Boolean).sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0));
  }

  backupPath(id) {
    if (typeof id !== 'string' || !(DAILY_RE.test(id) || BEFORE_RE.test(id))) return null;
    const full = path.join(this.backupDir, id);
    return path.dirname(full) === this.backupDir && fs.existsSync(full) ? full : null;
  }

  restore(id) {
    const full = this.backupPath(id);
    if (!full) return { ok: false, error: 'Sauvegarde introuvable.' };
    const res = this.parseFile(full);
    if (!res.ok) return { ok: false, error: res.error };
    return this.replace(res.doc, 'restauration');
  }
}

module.exports = { DataStore, writeAtomic, stamp, DATA_FILE, BACKUP_DIR, EXPORT_DIR, DAILY_KEEP, BEFORE_KEEP };
