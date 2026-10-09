/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · modèle de données
   schemaVersion, état vide du premier lancement, validation et migrations.

   Historique des formats :
   - v1 : export .json de la maquette (champ `version: 1`, chrono `timer`
          avec des instants en millisecondes) ;
   - v2 : application (phase 2) : `schemaVersion`, `meta`, chrono `activeTimer`
          (instants ISO UTC), `reminderLog`, objectif perso du samedi.
   Module UMD (renderer + main + tests).
   ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.model = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 2;
  var GROUPS = ['flowline', 'auto-entreprise'];
  var STATUSES = ['todo', 'doing', 'review', 'done'];
  var PRIORITIES = ['low', 'normal', 'high', 'urgent'];
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var DEFAULT_CATEGORIES = [
    { id: 'flowline', name: 'Flow Line', color: 'flowline', group: 'flowline' },
    { id: 'carnet', name: 'Carnet by-pass', color: 'carnet', group: 'auto-entreprise' },
    { id: 'auto', name: 'Auto-entreprise', color: 'auto', group: 'auto-entreprise' }
  ];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function defaultUI() {
    return {
      dashPeriod: 'week',
      recapPeriod: 'week',
      recapAnchor: null,
      tasksView: 'kanban',
      planningZoom: 'month',
      planningAnchor: null,
      filters: { q: '', categories: [], priority: '', tag: '', client: '', status: '', due: '' },
      sort: { key: 'endDate', dir: 'asc' }
    };
  }

  function defaultSettings() {
    return {
      theme: 'system',
      schedules: {
        // Flow Line : 35 h du lundi au vendredi (7 h par jour)
        flowline: { days: [1, 2, 3, 4, 5], weeklyHours: 35 },
        // Pôle auto-entreprise (Auto-entreprise + Carnet by-pass) : 4 h minimum le samedi
        'auto-entreprise': { days: [6], weeklyHours: null, minDailyHours: 4 }
      },
      // Rappel dans l'app activé ; les intégrations Windows sont des options par PC (désactivées)
      reminders: { hour: 9, inApp: true },
      ui: defaultUI()
    };
  }

  // État du premier lancement : vide, avec les 3 catégories et les objectifs
  function defaultState(opts) {
    opts = opts || {};
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        appVersion: opts.appVersion || null,
        createdAt: opts.nowIso || new Date().toISOString(),
        savedAt: null,
        savedBy: opts.host || null,
        revision: 0
      },
      categories: clone(DEFAULT_CATEGORIES),
      tasks: [],
      moods: [],
      settings: defaultSettings(),
      activeTimer: null,
      lastTimerTaskId: null,
      flags: { lastOpenedOn: null, moodPromptedOn: null, remindersShownOn: null },
      reminderLog: {}
    };
  }

  /* --- Version ------------------------------------------------------------- */
  // 1 = export de la maquette ; n = schemaVersion ; null = inconnu
  function versionOf(doc) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
    if (typeof doc.schemaVersion === 'number') return doc.schemaVersion;
    if (doc.version === 1 && Array.isArray(doc.tasks)) return 1;
    return null;
  }

  /* --- Migrations ---------------------------------------------------------- */
  function msToIso(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return new Date(v).toISOString();
    var t = Date.parse(v);
    return isNaN(t) ? null : new Date(t).toISOString();
  }

  var MIGRATIONS = {
    // v1 (maquette) -> v2 (application)
    1: function (doc, ctx) {
      var out = clone(doc);
      delete out.version;
      out.schemaVersion = 2;
      out.meta = { appVersion: ctx.appVersion || null, createdAt: ctx.nowIso, savedAt: null, savedBy: null, revision: 0 };
      var tm = out.timer;
      out.activeTimer = tm && tm.taskId ? {
        taskId: tm.taskId,
        startedAt: msToIso(tm.startedAt) || ctx.nowIso,
        accumulatedMs: Math.max(0, +tm.accumulatedMs || 0),
        pausedAt: msToIso(tm.pausedAt),
        host: null
      } : null;
      delete out.timer;
      out.reminderLog = out.reminderLog || {};
      out.settings = out.settings || {};
      var sch = out.settings.schedules = out.settings.schedules || {};
      sch['auto-entreprise'] = sch['auto-entreprise'] || { days: [6], weeklyHours: null };
      if (sch['auto-entreprise'].minDailyHours == null) sch['auto-entreprise'].minDailyHours = 4;
      var r = out.settings.reminders || {};
      out.settings.reminders = { hour: r.hour || 9, inApp: r.inApp !== false };
      return out;
    }
  };

  // Applique les migrations en chaîne. ctx : { nowIso, appVersion }
  // Renvoie { doc, from, to, migrated }. Erreurs : code TOO_NEW ou UNKNOWN.
  function migrate(doc, ctx) {
    ctx = ctx || {};
    ctx.nowIso = ctx.nowIso || new Date().toISOString();
    var from = versionOf(doc);
    if (from == null) { var e = new Error('Format de données inconnu.'); e.code = 'UNKNOWN'; throw e; }
    if (from > SCHEMA_VERSION) {
      var e2 = new Error('Ces données viennent d’une version plus récente de l’application (format ' + from + ').');
      e2.code = 'TOO_NEW'; e2.version = from; throw e2;
    }
    var cur = doc, v = from;
    while (v < SCHEMA_VERSION) {
      var step = MIGRATIONS[v];
      if (!step) { var e3 = new Error('Migration manquante depuis le format ' + v + '.'); e3.code = 'UNKNOWN'; throw e3; }
      cur = step(cur, ctx);
      v = versionOf(cur);
    }
    return { doc: normalize(cur), from: from, to: SCHEMA_VERSION, migrated: from !== SCHEMA_VERSION };
  }

  /* --- Normalisation : complète les champs facultatifs manquants ------------ */
  function normalize(doc) {
    var d = doc;
    var def = defaultState();
    d.meta = Object.assign({}, def.meta, d.meta || {});
    d.categories = Array.isArray(d.categories) && d.categories.length ? d.categories : clone(DEFAULT_CATEGORIES);
    d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
    d.moods = Array.isArray(d.moods) ? d.moods : [];
    d.settings = d.settings || {};
    var s = d.settings, ds = def.settings;
    if (['light', 'dark', 'system'].indexOf(s.theme) < 0) s.theme = 'system';
    s.schedules = s.schedules || {};
    GROUPS.forEach(function (g) { s.schedules[g] = Object.assign({}, ds.schedules[g], s.schedules[g] || {}); });
    s.reminders = Object.assign({}, ds.reminders, s.reminders || {});
    var ui = Object.assign(defaultUI(), s.ui || {});
    ui.filters = Object.assign(defaultUI().filters, ui.filters || {});
    ui.sort = Object.assign(defaultUI().sort, ui.sort || {});
    s.ui = ui;
    // Catégories : identifiant, nom, couleur et groupe toujours présents (QA-02)
    d.categories = d.categories.filter(function (c) { return c && typeof c === 'object'; }).map(function (c, i) {
      return Object.assign({}, c, {
        id: typeof c.id === 'string' && c.id ? c.id : 'cat-' + (i + 1),
        name: typeof c.name === 'string' && c.name.trim() ? c.name : 'Catégorie ' + (i + 1),
        color: typeof c.color === 'string' && c.color ? c.color : 'blue',
        group: GROUPS.indexOf(c.group) >= 0 ? c.group : 'auto-entreprise'
      });
    });
    if (!d.categories.length) d.categories = clone(DEFAULT_CATEGORIES);
    var catIds = d.categories.map(function (c) { return c.id; });
    var n = 0;
    function id(prefix) { n += 1; return prefix + '-n' + n; }
    d.tasks = d.tasks.filter(function (t) { return t && typeof t === 'object'; });
    d.tasks.forEach(function (t) {
      if (typeof t.id !== 'string' || !t.id) t.id = id('t');
      if (typeof t.title !== 'string') t.title = t.title == null ? 'Sans titre' : String(t.title);
      if (catIds.indexOf(t.categoryId) < 0) t.categoryId = catIds[0];          // catégorie inconnue : réaffectée
      t.tags = Array.isArray(t.tags) ? t.tags.filter(function (g) { return typeof g === 'string'; }) : [];
      t.checklist = (Array.isArray(t.checklist) ? t.checklist : []).filter(function (c) { return c && typeof c === 'object'; }).map(function (c) {
        return { id: typeof c.id === 'string' && c.id ? c.id : id('c'), label: String(c.label == null ? '' : c.label), done: !!c.done };
      });
      t.timeEntries = (Array.isArray(t.timeEntries) ? t.timeEntries : []).filter(function (e) { return e && typeof e === 'object'; }).map(function (e) {
        return Object.assign({}, e, { id: typeof e.id === 'string' && e.id ? e.id : id('e'), note: e.note == null ? '' : String(e.note), source: e.source === 'timer' ? 'timer' : 'manual' });
      });
      if (t.description == null) t.description = '';
      if (t.client == null) t.client = '';
      if (typeof t.progress !== 'number' || isNaN(t.progress)) t.progress = 0;
      t.progress = Math.max(0, Math.min(100, t.progress));
      if (PRIORITIES.indexOf(t.priority) < 0) t.priority = 'normal';
      if (t.reminder === undefined) t.reminder = null;
      if (typeof t.order !== 'number') t.order = 0;
      if (t.startDate === undefined || t.startDate === '') t.startDate = null;
      if (t.endDate === undefined || t.endDate === '') t.endDate = null;
    });
    d.moods = d.moods.filter(function (m) { return m && typeof m === 'object'; });
    if (d.activeTimer === undefined) d.activeTimer = null;
    if (d.lastTimerTaskId === undefined) d.lastTimerTaskId = null;
    d.flags = Object.assign({}, def.flags, d.flags || {});
    d.reminderLog = d.reminderLog && typeof d.reminderLog === 'object' && !Array.isArray(d.reminderLog) ? d.reminderLog : {};
    return d;
  }

  /* --- Validation (structure indispensable) -------------------------------- */
  function validate(doc) {
    var errors = [];
    function err(msg) { if (errors.length < 20) errors.push(msg); }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: ['Le document n’est pas un objet.'] };
    if (doc.schemaVersion !== SCHEMA_VERSION) err('schemaVersion attendu : ' + SCHEMA_VERSION + '.');
    if (!Array.isArray(doc.categories) || !doc.categories.length) err('categories : liste non vide attendue.');
    else doc.categories.forEach(function (c, i) {
      if (!c || typeof c.id !== 'string' || !c.id) err('categories[' + i + '].id manquant.');
      if (!c || typeof c.name !== 'string') err('categories[' + i + '].name manquant.');
      if (!c || GROUPS.indexOf(c.group) < 0) err('categories[' + i + '].group invalide.');
    });
    if (!Array.isArray(doc.tasks)) err('tasks : liste attendue.');
    else doc.tasks.forEach(function (t, i) {
      var p = 'tasks[' + i + ']';
      if (!t || typeof t !== 'object') { err(p + ' n’est pas un objet.'); return; }
      if (typeof t.id !== 'string' || !t.id) err(p + '.id manquant.');
      if (typeof t.title !== 'string') err(p + '.title manquant.');
      if (typeof t.categoryId !== 'string') err(p + '.categoryId manquant.');
      if (STATUSES.indexOf(t.status) < 0) err(p + '.status invalide.');
      if (t.priority != null && PRIORITIES.indexOf(t.priority) < 0) err(p + '.priority invalide.');
      ['startDate', 'endDate'].forEach(function (k) { if (t[k] != null && !DATE_RE.test(t[k])) err(p + '.' + k + ' invalide.'); });
      if (!Array.isArray(t.timeEntries)) err(p + '.timeEntries : liste attendue.');
      else t.timeEntries.forEach(function (e, j) {
        if (!e || !DATE_RE.test(e.date)) err(p + '.timeEntries[' + j + '].date invalide.');
        if (!e || typeof e.minutes !== 'number' || !(e.minutes >= 0)) err(p + '.timeEntries[' + j + '].minutes invalide.');
      });
      if (t.checklist != null && !Array.isArray(t.checklist)) err(p + '.checklist : liste attendue.');
    });
    if (!Array.isArray(doc.moods)) err('moods : liste attendue.');
    else doc.moods.forEach(function (m, i) {
      if (!m || !DATE_RE.test(m.date) || !(m.level >= 1 && m.level <= 5)) err('moods[' + i + '] invalide.');
    });
    if (!doc.settings || typeof doc.settings !== 'object') err('settings manquant.');
    var tm = doc.activeTimer;
    if (tm != null && (typeof tm !== 'object' || typeof tm.taskId !== 'string' || isNaN(Date.parse(tm.startedAt)))) err('activeTimer invalide.');
    return { ok: !errors.length, errors: errors };
  }

  // Résumé affiché avant une restauration ou un import
  function summarize(doc) {
    var tasks = (doc && doc.tasks) || [];
    var entries = 0;
    tasks.forEach(function (t) { entries += (t.timeEntries || []).length; });
    return { tasks: tasks.length, entries: entries, moods: ((doc && doc.moods) || []).length, categories: ((doc && doc.categories) || []).length };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION, GROUPS: GROUPS, STATUSES: STATUSES, PRIORITIES: PRIORITIES,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    defaultState: defaultState, defaultSettings: defaultSettings, defaultUI: defaultUI,
    versionOf: versionOf, migrate: migrate, normalize: normalize, validate: validate, summarize: summarize
  };
});
