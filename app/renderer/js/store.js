/* ==========================================================================
   Plateforme de suivi - Lamia — état et requêtes
   - L.store : état en mémoire, chargé depuis Donnees-Lamia/data.json par le
     main (window.lamia). Chaque modification est envoyée au main après un
     court délai (250 ms), tout de suite pour les actions sensibles (chrono),
     et de façon synchrone à la fermeture de la fenêtre (beforeunload).
     Plus aucune donnée métier dans localStorage.
   - L.q : requêtes en lecture seule, déléguées à shared/stats.js (testé).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, ST = window.LamiaShared.stats, R = window.LamiaShared.reminders;
  var SAVE_DELAY = 250;
  var state = null;
  var listeners = [];
  var saveTimer = null;
  var dirty = false;
  var saving = false;
  var readOnly = false;
  var api = window.lamia || null;
  var lastSave = { at: null, ok: true, error: null };

  /* --- Persistance (main) ------------------------------------------------- */
  function doSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty || !state) return;
    if (readOnly) { dirty = false; notifyReadOnly(); return; }
    if (!api) { dirty = false; return; }
    if (saving) { schedule(SAVE_DELAY); return; }
    dirty = false;
    saving = true;
    api.data.save(state).then(function (res) {
      saving = false;
      afterSave(res);
    }, function (e) {
      saving = false;
      dirty = true;
      afterSave({ ok: false, error: String(e && e.message || e) });
      schedule(2000);
    });
  }

  function afterSave(res) {
    res = res || {};
    lastSave = { at: Date.now(), ok: !!res.ok, error: res.error || null };
    if (res.ok && state.meta) { state.meta.revision = res.revision; state.meta.savedAt = res.savedAt; }
    if (!res.ok) {
      if (res.readOnly || res.conflict) { readOnly = true; }
      listeners.slice().forEach(function (fn) { try { fn('save-error', res); } catch (e) { console.error(e); } });
    }
  }

  function schedule(ms) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, ms == null ? SAVE_DELAY : ms);
  }

  function save(now) {
    dirty = true;
    if (now) doSave(); else schedule();
  }

  // Écriture synchrone à la fermeture (rien ne doit se perdre dans le délai)
  function flushSync() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty || !state || readOnly || !api) return;
    dirty = false;
    try { afterSave(api.data.saveSync(state)); } catch (e) { /* fenêtre en cours de fermeture */ }
  }
  window.addEventListener('beforeunload', flushSync);
  window.addEventListener('pagehide', flushSync);

  var roWarned = 0;
  function notifyReadOnly() {
    if (Date.now() - roWarned < 8000) return;
    roWarned = Date.now();
    listeners.slice().forEach(function (fn) { try { fn('read-only', {}); } catch (e) { console.error(e); } });
  }

  function emit(type, detail, opts) {
    if (!(opts && opts.noSave)) save(opts && opts.now);
    listeners.slice().forEach(function (fn) {
      try { fn(type, detail || {}); } catch (e) { if (window.console) console.error(e); }
    });
  }

  function uid(prefix) {
    var r = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 12);
    return (prefix || 'id') + '-' + r;
  }

  function task(id) {
    for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) return state.tasks[i];
    return null;
  }

  function cat(id) {
    for (var i = 0; i < state.categories.length; i++) if (state.categories[i].id === id) return state.categories[i];
    return state.categories[0];
  }

  function touch(t) { t.updatedAt = D.today(); }

  function column(status) {
    return state.tasks.filter(function (t) { return t.status === status; }).sort(function (a, b) { return a.order - b.order; });
  }

  function renumber(status) {
    column(status).forEach(function (t, i) { t.order = i; });
  }

  function timerElapsed(tm) { return ST.timerElapsed(tm || state.activeTimer); }

  function isoNow() { return new Date(D.nowMs()).toISOString(); }

  // Champs de travail non persistés d'une session à l'autre (période affichée…)
  function freshUI(st) {
    st.settings.ui.recapAnchor = null;
    st.settings.ui.planningAnchor = null;
  }

  /* --- Actions ----------------------------------------------------------- */
  var store = {
    init: function (doc, opts) {
      state = doc;
      readOnly = !!(opts && opts.readOnly);
      freshUI(state);
      return state;
    },
    get: function () { return state; },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    emit: emit,
    uid: uid,
    task: task,
    category: cat,
    column: column,
    timerElapsed: timerElapsed,
    isReadOnly: function () { return readOnly; },
    setReadOnly: function (v) { readOnly = !!v; if (!readOnly && dirty) schedule(); },
    lastSave: function () { return lastSave; },
    flush: function () { if (dirty) doSave(); },
    flushSync: flushSync,

    // Remplacement complet (démo, import, restauration, rechargement après verrou)
    replace: function (doc) {
      clearTimeout(saveTimer); saveTimer = null; dirty = false;
      state = doc;
      freshUI(state);
      emit('reset', {}, { noSave: true });
      return true;
    },

    setFlag: function (k, v) { state.flags[k] = v; save(); },
    setUI: function (patch) { Object.assign(state.settings.ui, patch); emit('ui', patch); },
    setSettings: function (patch) { Object.assign(state.settings, patch); emit('settings', patch); },
    setSchedule: function (group, patch) { Object.assign(state.settings.schedules[group], patch); emit('settings'); },
    setReminders: function (patch) { state.settings.reminders = Object.assign({}, state.settings.reminders, patch); emit('settings', { reminders: true }); },

    /* Rappels : inscrits une fois par tâche et par jour */
    markReminded: function (ids) {
      if (!ids || !ids.length) return;
      state.reminderLog = R.mark(state.reminderLog || {}, ids, D.today());
      save();
    },

    /* Tâches */
    createTask: function (data) {
      var status = data.status || 'todo';
      column(status).forEach(function (t) { t.order += 1; });
      var t = {
        id: uid('t'), title: data.title.trim(), description: data.description || '',
        categoryId: data.categoryId || state.categories[0].id, client: data.client || '',
        status: status, progress: status === 'done' ? 100 : 0, priority: data.priority || 'normal',
        tags: data.tags || [], startDate: data.startDate || (data.endDate ? D.today() : null), endDate: data.endDate || null,
        checklist: [], timeEntries: [], reminder: null,
        createdAt: D.today(), updatedAt: D.today(), completedAt: status === 'done' ? D.today() : null, order: 0
      };
      if (t.startDate && t.endDate && t.startDate > t.endDate) t.startDate = t.endDate;
      state.tasks.push(t);
      emit('task:create', { id: t.id }, { now: true });
      return t;
    },

    updateTask: function (id, patch, opts) {
      var t = task(id);
      if (!t) return null;
      var prevStatus = t.status;
      Object.assign(t, patch);
      if (patch.status && patch.status !== prevStatus) {
        t.completedAt = patch.status === 'done' ? D.today() : null;
        column(patch.status).forEach(function (x) { if (x !== t) x.order += 1; });
        t.order = -1;
        renumber(patch.status); renumber(prevStatus);
      }
      touch(t);
      if (!(opts && opts.silent)) emit('task:update', { id: id, patch: patch, prevStatus: prevStatus });
      else save();
      return t;
    },

    // Glisser-déposer et « Déplacer vers… » : statut + position dans la colonne
    moveTask: function (id, status, index) {
      var t = task(id);
      if (!t) return null;
      var prevStatus = t.status;
      var list = column(status).filter(function (x) { return x !== t; });
      index = Math.max(0, Math.min(index == null ? list.length : index, list.length));
      list.splice(index, 0, t);
      list.forEach(function (x, i) { x.order = i; });
      t.status = status;
      if (status !== prevStatus) {
        t.completedAt = status === 'done' ? D.today() : null;
        renumber(prevStatus);
      }
      touch(t);
      emit('task:move', { id: id, status: status, prevStatus: prevStatus, index: index });
      return t;
    },

    deleteTask: function (id) {
      var i = state.tasks.indexOf(task(id));
      if (i < 0) return null;
      var removed = state.tasks.splice(i, 1)[0];
      var wasTimer = state.activeTimer && state.activeTimer.taskId === id ? state.activeTimer : null;
      if (wasTimer) state.activeTimer = null;
      renumber(removed.status);
      emit('task:delete', { id: id }, { now: true });
      return { task: removed, index: i, timer: wasTimer };
    },

    restoreTask: function (snap) {
      state.tasks.splice(Math.min(snap.index, state.tasks.length), 0, snap.task);
      column(snap.task.status).forEach(function (x) { if (x !== snap.task && x.order >= snap.task.order) x.order += 1; });
      renumber(snap.task.status);
      if (snap.timer && !state.activeTimer) state.activeTimer = snap.timer;
      emit('task:create', { id: snap.task.id }, { now: true });
    },

    /* Checklist */
    addCheck: function (id, label) {
      var t = task(id); if (!t || !label.trim()) return;
      t.checklist.push({ id: uid('c'), label: label.trim(), done: false }); touch(t);
      emit('task:update', { id: id, part: 'checklist' });
    },
    toggleCheck: function (id, cid, done) {
      var t = task(id); if (!t) return;
      t.checklist.forEach(function (c) { if (c.id === cid) c.done = done; }); touch(t);
      emit('task:update', { id: id, part: 'checklist' });
    },
    removeCheck: function (id, cid) {
      var t = task(id); if (!t) return;
      t.checklist = t.checklist.filter(function (c) { return c.id !== cid; }); touch(t);
      emit('task:update', { id: id, part: 'checklist' });
    },
    moveCheck: function (id, cid, delta) {
      var t = task(id); if (!t) return;
      var i = t.checklist.findIndex(function (c) { return c.id === cid; });
      var j = i + delta;
      if (i < 0 || j < 0 || j >= t.checklist.length) return;
      var item = t.checklist.splice(i, 1)[0];
      t.checklist.splice(j, 0, item); touch(t);
      emit('task:update', { id: id, part: 'checklist' });
    },

    /* Heures */
    addEntry: function (id, entry) {
      var t = task(id); if (!t) return null;
      var e = { id: uid('e'), date: entry.date || D.today(), minutes: Math.round(entry.minutes), note: entry.note || '', source: entry.source || 'manual' };
      t.timeEntries.push(e); touch(t);
      emit('task:update', { id: id, part: 'hours' }, { now: true });
      return e;
    },
    updateEntry: function (id, eid, patch) {
      var t = task(id); if (!t) return;
      t.timeEntries.forEach(function (e) { if (e.id === eid) Object.assign(e, patch); }); touch(t);
      emit('task:update', { id: id, part: 'hours' });
    },
    removeEntry: function (id, eid) {
      var t = task(id); if (!t) return null;
      var i = t.timeEntries.findIndex(function (e) { return e.id === eid; });
      var e = i >= 0 ? t.timeEntries.splice(i, 1)[0] : null; touch(t);
      emit('task:update', { id: id, part: 'hours' });
      return e ? { entry: e, index: i } : null;
    },
    restoreEntry: function (id, snap) {
      var t = task(id); if (!t || !snap) return;
      t.timeEntries.splice(snap.index, 0, snap.entry);
      emit('task:update', { id: id, part: 'hours' });
    },

    /* Chrono : un seul actif ; il survit à la fermeture (activeTimer dans data.json, écrit tout de suite) */
    startTimer: function (id) {
      var stopped = null;
      var cur = state.activeTimer;
      if (cur && cur.taskId === id) {
        if (cur.pausedAt) store.resumeTimer();
        return { stopped: null };
      }
      if (cur) stopped = store.stopTimer({ silent: true });
      state.activeTimer = { taskId: id, startedAt: isoNow(), accumulatedMs: 0, pausedAt: null, host: L.info ? L.info.host : null };
      state.lastTimerTaskId = id;
      var t = task(id);
      if (t && t.status === 'todo') store.moveTask(id, 'doing', 0);
      emit('timer', { action: 'start', id: id, stopped: stopped }, { now: true });
      return { stopped: stopped };
    },
    pauseTimer: function () {
      var tm = state.activeTimer; if (!tm || tm.pausedAt) return;
      tm.accumulatedMs = timerElapsed(tm);
      tm.pausedAt = isoNow();
      emit('timer', { action: 'pause' }, { now: true });
    },
    resumeTimer: function () {
      var tm = state.activeTimer; if (!tm || !tm.pausedAt) return;
      tm.startedAt = isoNow();
      tm.pausedAt = null;
      emit('timer', { action: 'resume' }, { now: true });
    },
    // « Il tourne encore » : l'alerte des 10 h ne revient pas pour ce chrono
    ackLongTimer: function () {
      var tm = state.activeTimer; if (!tm) return;
      tm.longAlertAck = isoNow();
      save(true);
    },
    // Arrête et enregistre. opts.minutes (+ opts.date) : durée corrigée (au-delà de 10 h)
    stopTimer: function (opts) {
      var tm = state.activeTimer; if (!tm) return null;
      var parts = opts && opts.minutes != null
        ? [{ date: opts.date || D.dateOf(Date.parse(tm.startedAt)) || D.today(), minutes: opts.minutes }]
        : timerElapsed(tm) < 10000 ? [] : ST.timerEntries(tm);   // QA-07 : moins de 10 s, rien n'est enregistré
      state.activeTimer = null;
      var t = task(tm.taskId);
      var minutes = 0, entries = [];
      if (t) {
        parts.forEach(function (p) {
          if (!(p.minutes > 0)) return;
          var entry = { id: uid('e'), date: p.date, minutes: p.minutes, note: '', source: 'timer' };
          t.timeEntries.push(entry); entries.push(entry); minutes += p.minutes;
        });
        touch(t);
      }
      var res = { taskId: tm.taskId, minutes: minutes, entry: entries[entries.length - 1] || null, entries: entries };
      if (!(opts && opts.silent)) emit('timer', { action: 'stop', result: res }, { now: true });
      else save(true);
      return res;
    },

    /* Humeur */
    setMood: function (date, level, note) {
      var m = state.moods.filter(function (x) { return x.date === date; })[0];
      if (!m) { m = { date: date, level: level, note: note || '' }; state.moods.push(m); }
      else { m.level = level; if (note != null) m.note = note; }
      state.moods.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      emit('mood', { date: date, level: level }, { now: true });
    },
    setMoodNote: function (date, note) {
      var m = state.moods.filter(function (x) { return x.date === date; })[0];
      if (m) { m.note = note; emit('mood', { date: date, note: true }); }
    },

    /* Catégories */
    addCategory: function (data) {
      var c = { id: uid('cat'), name: data.name || 'Nouvelle catégorie', color: data.color || 'blue', group: data.group || 'auto-entreprise' };
      state.categories.push(c);
      emit('category', { id: c.id });
      return c;
    },
    updateCategory: function (id, patch) {
      Object.assign(cat(id), patch);
      emit('category', { id: id });
    },
    removeCategory: function (id, reassignTo) {
      state.tasks.forEach(function (t) { if (t.categoryId === id) t.categoryId = reassignTo; });
      state.categories = state.categories.filter(function (c) { return c.id !== id; });
      emit('category', { id: id, removed: true });
    }
  };

  /* --- Requêtes (shared/stats.js) ------------------------------------------ */
  var STATUS = [
    { id: 'todo', label: 'Pas commencé' },
    { id: 'doing', label: 'En cours' },
    { id: 'review', label: 'En validation' },
    { id: 'done', label: 'Terminé' }
  ];
  var PRIORITIES = [
    { id: 'low', label: 'Basse' }, { id: 'normal', label: 'Normale' },
    { id: 'high', label: 'Haute' }, { id: 'urgent', label: 'Urgente' }
  ];

  function label(list, id) { var x = list.filter(function (i) { return i.id === id; })[0]; return x ? x.label : id; }

  function mood(date) { return state.moods.filter(function (m) { return m.date === date; })[0] || null; }

  // Contexte pour LamiaVoice.pick (cahier des charges §8)
  function voiceContext() {
    var today = D.today();
    var w0 = D.startOfWeek(today), w1 = D.endOfWeek(today);
    var poles = ST.minutesByPole(state, w0, w1, true);   // groupe Flow Line uniquement pour la voix
    var my = mood(D.addDays(today, -1)), mt = mood(today);
    return {
      date: D.now(),
      dueThisWeek: ST.dueBetween(state, today, w1).length,
      overdue: ST.overdue(state).length,
      doneToday: state.tasks.filter(function (t) { return t.completedAt === today; }).length,
      doneThisWeek: state.tasks.filter(function (t) { return t.completedAt && D.between(t.completedAt, w0, w1); }).length,
      hoursFlowlineWeek: Math.round(poles.flowline / 6) / 10,
      moodYesterday: my ? my.level : undefined,
      moodToday: mt ? mt.level : undefined,
      firstLoginToday: !!L.firstLoginToday,
      daysAway: L.daysAway || 0
    };
  }

  function allTags() {
    var set = {};
    state.tasks.forEach(function (t) { t.tags.forEach(function (g) { set[g] = (set[g] || 0) + 1; }); });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }

  function allClients() {
    var set = {};
    state.tasks.forEach(function (t) { if (t.client) set[t.client] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }

  // Filtres partagés Kanban / liste
  function filtered(f) {
    f = f || state.settings.ui.filters;
    var q = (f.q || '').trim().toLowerCase();
    var today = D.today();
    return state.tasks.filter(function (t) {
      if (f.categories && f.categories.length && f.categories.indexOf(t.categoryId) < 0) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.tag && t.tags.indexOf(f.tag) < 0) return false;
      if (f.client && t.client !== f.client) return false;
      if (f.status && t.status !== f.status) return false;
      if (f.due === 'week' && !(t.endDate && t.endDate >= today && t.endDate <= D.endOfWeek(today))) return false;
      if (f.due === 'month' && !(t.endDate && t.endDate >= today && t.endDate <= D.endOfMonth(today))) return false;
      if (f.due === 'late' && !ST.isOverdue(t)) return false;
      if (f.due === 'none' && t.endDate) return false;
      if (q) {
        var hay = (t.title + ' ' + t.client + ' ' + t.description + ' ' + t.tags.join(' ') + ' ' + cat(t.categoryId).name).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function activeFilterCount(f) {
    f = f || state.settings.ui.filters;
    return (f.q ? 1 : 0) + (f.categories && f.categories.length ? 1 : 0) + ['priority', 'tag', 'client', 'status', 'due'].filter(function (k) { return f[k]; }).length;
  }

  L.store = store;
  L.q = {
    STATUS: STATUS, PRIORITIES: PRIORITIES, PRIO_RANK: ST.PRIO_RANK,
    statusLabel: function (id) { return label(STATUS, id); },
    prioLabel: function (id) { return label(PRIORITIES, id); },
    isDone: ST.isDone,
    isOverdue: function (t, ref) { return ST.isOverdue(t, ref); },
    taskMinutes: function (t, a, b, w) { return ST.taskMinutes(state, t, a, b, w); },
    minutesByCategory: function (a, b, w) { return ST.minutesByCategory(state, a, b, w); },
    minutesByPole: function (a, b, w) { return ST.minutesByPole(state, a, b, w); },
    dailyMinutes: function (catId, a, b, w) { return ST.dailyMinutes(state, catId, a, b, w); },
    goalFor: function (c) { return ST.goalFor(state, c); },
    persoGoal: function (a, b, w) { return ST.persoGoal(state, a, b, w); },
    weekPersoGoal: function (anchor, w) { return ST.weekPersoGoal(state, anchor, w); },
    mood: mood,
    overdue: function () { return ST.overdue(state); },
    dueBetween: function (a, b) { return ST.dueBetween(state, a, b); },
    summary: function (p) { return ST.summary(state, p); },
    voiceContext: voiceContext, allTags: allTags, allClients: allClients,
    filtered: filtered, activeFilterCount: activeFilterCount
  };
})(window.Lamia = window.Lamia || {});
