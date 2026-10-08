/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · état et requêtes
   - L.store : état en mémoire + persistance FACULTATIVE dans localStorage
     (toute lecture / écriture est protégée par try/catch).
   - L.q     : requêtes en lecture seule (heures, échéances, récap…).
   En phase 2, l'état vit dans Donnees-Lamia/data.json (cf. docs/04) ;
   les actions et requêtes ci-dessous se transposent en stores Svelte.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates;
  var KEY = 'lamia.maquette.v1';
  var state = null;
  var listeners = [];
  var saveTimer = null;

  /* --- Persistance ------------------------------------------------------- */
  function readSaved() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.version === 1 && Array.isArray(s.tasks) ? s : null;
    } catch (e) { return null; }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { if (window.localStorage) window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* stockage indisponible : la démo reste en mémoire */ }
    }, 150);
  }

  function clearSaved() {
    try { if (window.localStorage) window.localStorage.removeItem(KEY); } catch (e) { /* rien */ }
  }

  function emit(type, detail) {
    save();
    listeners.slice().forEach(function (fn) {
      try { fn(type, detail || {}); } catch (e) { if (window.console) console.error(e); }
    });
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

  function timerElapsed(tm) {
    tm = tm || state.timer;
    if (!tm) return 0;
    return tm.accumulatedMs + (tm.pausedAt ? 0 : Date.now() - tm.startedAt);
  }

  /* --- Actions ----------------------------------------------------------- */
  var store = {
    KEY: KEY,
    init: function () {
      state = readSaved() || L.seed();
      // Champs ajoutés au fil des versions de la maquette
      state.flags = state.flags || {};
      state.settings.ui = Object.assign(L.seed().settings.ui, state.settings.ui || {});
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

    reset: function () {
      clearSaved();
      state = L.seed();
      state.flags.lastOpenedOn = D.today();
      emit('reset');
    },

    setFlag: function (k, v) { state.flags[k] = v; save(); },
    setUI: function (patch) { Object.assign(state.settings.ui, patch); emit('ui', patch); },
    setSettings: function (patch) { Object.assign(state.settings, patch); emit('settings', patch); },
    setSchedule: function (group, patch) { Object.assign(state.settings.schedules[group], patch); emit('settings'); },

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
      emit('task:create', { id: t.id });
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
      var wasTimer = state.timer && state.timer.taskId === id ? state.timer : null;
      if (wasTimer) state.timer = null;
      renumber(removed.status);
      emit('task:delete', { id: id });
      return { task: removed, index: i, timer: wasTimer };
    },

    restoreTask: function (snap) {
      state.tasks.splice(Math.min(snap.index, state.tasks.length), 0, snap.task);
      column(snap.task.status).forEach(function (x) { if (x !== snap.task && x.order >= snap.task.order) x.order += 1; });
      renumber(snap.task.status);
      if (snap.timer && !state.timer) state.timer = snap.timer;
      emit('task:create', { id: snap.task.id });
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
      emit('task:update', { id: id, part: 'hours' });
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

    /* Chrono : un seul actif ; il survit à la fermeture (persisté) */
    startTimer: function (id) {
      var stopped = null;
      if (state.timer && state.timer.taskId === id) {
        if (state.timer.pausedAt) store.resumeTimer();
        return { stopped: null };
      }
      if (state.timer) stopped = store.stopTimer({ silent: true });
      state.timer = { taskId: id, startedAt: Date.now(), accumulatedMs: 0, pausedAt: null };
      state.lastTimerTaskId = id;
      var t = task(id);
      if (t && t.status === 'todo') store.moveTask(id, 'doing', 0);
      emit('timer', { action: 'start', id: id, stopped: stopped });
      return { stopped: stopped };
    },
    pauseTimer: function () {
      var tm = state.timer; if (!tm || tm.pausedAt) return;
      tm.accumulatedMs += Date.now() - tm.startedAt;
      tm.pausedAt = Date.now();
      emit('timer', { action: 'pause' });
    },
    resumeTimer: function () {
      var tm = state.timer; if (!tm || !tm.pausedAt) return;
      tm.startedAt = Date.now();
      tm.pausedAt = null;
      emit('timer', { action: 'resume' });
    },
    // Arrête et enregistre une entrée « chrono ». minutesOverride : correction (> 10 h)
    stopTimer: function (opts) {
      var tm = state.timer; if (!tm) return null;
      var minutes = opts && opts.minutes != null ? opts.minutes : Math.max(1, Math.round(timerElapsed(tm) / 60000));
      state.timer = null;
      var entry = null;
      var t = task(tm.taskId);
      if (t && minutes > 0) {
        entry = { id: uid('e'), date: D.today(), minutes: minutes, note: '', source: 'timer' };
        t.timeEntries.push(entry); touch(t);
      }
      var res = { taskId: tm.taskId, minutes: minutes, entry: entry };
      if (!(opts && opts.silent)) emit('timer', { action: 'stop', result: res });
      return res;
    },

    /* Humeur */
    setMood: function (date, level, note) {
      var m = state.moods.filter(function (x) { return x.date === date; })[0];
      if (!m) { m = { date: date, level: level, note: note || '' }; state.moods.push(m); }
      else { m.level = level; if (note != null) m.note = note; }
      state.moods.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      emit('mood', { date: date, level: level });
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

  /* --- Requêtes ---------------------------------------------------------- */
  var PRIO_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
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

  function isDone(t) { return t.status === 'done'; }
  function isOverdue(t, ref) { return !isDone(t) && !!t.endDate && t.endDate < (ref || D.today()); }

  // Minutes d'une tâche sur une plage (chrono en cours inclus si demandé)
  function taskMinutes(t, a, b, withTimer) {
    var m = 0;
    t.timeEntries.forEach(function (e) { if ((!a || e.date >= a) && (!b || e.date <= b)) m += e.minutes; });
    if (withTimer && state.timer && state.timer.taskId === t.id && (!a || D.today() >= a) && (!b || D.today() <= b)) {
      m += Math.floor(timerElapsed() / 60000);
    }
    return m;
  }

  // Heures par catégorie, SÉPARÉES (jamais de total général)
  function minutesByCategory(a, b, withTimer) {
    var out = {};
    state.categories.forEach(function (c) { out[c.id] = 0; });
    state.tasks.forEach(function (t) { if (out[t.categoryId] != null) out[t.categoryId] += taskMinutes(t, a, b, withTimer); });
    return out;
  }

  // Minutes par jour pour une catégorie : { 'YYYY-MM-DD': minutes }
  function dailyMinutes(catId, a, b, withTimer) {
    var out = {};
    D.eachDay(a, b).forEach(function (d) { out[d] = 0; });
    state.tasks.forEach(function (t) {
      if (t.categoryId !== catId) return;
      t.timeEntries.forEach(function (e) { if (out[e.date] != null) out[e.date] += e.minutes; });
      if (withTimer && state.timer && state.timer.taskId === t.id && out[D.today()] != null) out[D.today()] += Math.floor(timerElapsed() / 60000);
    });
    return out;
  }

  function goalFor(category) {
    var sch = state.settings.schedules[category.group];
    if (!sch || !sch.weeklyHours) return null;
    var days = sch.days.length || 5;
    return { weekly: sch.weeklyHours * 60, daily: Math.round(sch.weeklyHours * 60 / days), days: sch.days };
  }

  function mood(date) { return state.moods.filter(function (m) { return m.date === date; })[0] || null; }

  function overdue() {
    return state.tasks.filter(function (t) { return isOverdue(t); }).sort(function (a, b) { return a.endDate < b.endDate ? -1 : 1; });
  }

  function dueBetween(a, b) {
    return state.tasks.filter(function (t) { return !isDone(t) && t.endDate && t.endDate >= a && t.endDate <= b; })
      .sort(function (x, y) { return x.endDate < y.endDate ? -1 : x.endDate > y.endDate ? 1 : PRIO_RANK[x.priority] - PRIO_RANK[y.priority]; });
  }

  // Récap d'une période (jour / semaine / mois)
  function summary(p) {
    var today = D.today();
    var tasks = state.tasks;
    var created = tasks.filter(function (t) { return D.between(t.createdAt, p.start, p.end); });
    var done = tasks.filter(function (t) { return t.completedAt && D.between(t.completedAt, p.start, p.end); });
    // En cours : tâches « En cours » ou « En validation » déjà commencées à la fin de la période
    var ongoing = tasks.filter(function (t) {
      return (t.status === 'doing' || t.status === 'review') && (!t.startDate || t.startDate <= p.end);
    });
    var upcomingFrom = p.start > today ? p.start : today;
    var upcoming = p.end >= today ? dueBetween(upcomingFrom, p.end) : [];
    var replan = tasks.filter(function (t) { return isOverdue(t) && t.endDate <= p.end && t.endDate >= p.start; });
    var dueInPeriod = tasks.filter(function (t) { return t.endDate && D.between(t.endDate, p.start, p.end); });
    var dueDone = dueInPeriod.filter(isDone);
    return {
      created: created, done: done, ongoing: ongoing, upcoming: upcoming, replan: replan,
      allReplan: overdue(),
      due: dueInPeriod, dueDone: dueDone,
      rate: dueInPeriod.length ? Math.round(dueDone.length / dueInPeriod.length * 100) : null
    };
  }

  // Contexte pour LamiaVoice.pick (cahier des charges §8)
  function voiceContext() {
    var today = D.today();
    var w0 = D.startOfWeek(today), w1 = D.endOfWeek(today);
    var flow = state.categories.filter(function (c) { return c.group === 'flowline'; });
    var mins = minutesByCategory(w0, w1, true);
    var flowMin = 0;
    flow.forEach(function (c) { flowMin += mins[c.id] || 0; });   // groupe Flow Line uniquement
    var my = mood(D.addDays(today, -1)), mt = mood(today);
    return {
      date: D.now(),
      dueThisWeek: dueBetween(today, w1).length,
      overdue: overdue().length,
      doneToday: state.tasks.filter(function (t) { return t.completedAt === today; }).length,
      doneThisWeek: state.tasks.filter(function (t) { return t.completedAt && D.between(t.completedAt, w0, w1); }).length,
      hoursFlowlineWeek: Math.round(flowMin / 6) / 10,
      moodYesterday: my ? my.level : undefined,
      moodToday: mt ? mt.level : undefined,
      firstLoginToday: !!L.firstLoginToday,
      daysAway: 0
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
      if (f.due === 'late' && !isOverdue(t)) return false;
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
    STATUS: STATUS, PRIORITIES: PRIORITIES, PRIO_RANK: PRIO_RANK,
    statusLabel: function (id) { return label(STATUS, id); },
    prioLabel: function (id) { return label(PRIORITIES, id); },
    isDone: isDone, isOverdue: isOverdue, taskMinutes: taskMinutes, minutesByCategory: minutesByCategory,
    dailyMinutes: dailyMinutes, goalFor: goalFor, mood: mood, overdue: overdue, dueBetween: dueBetween,
    summary: summary, voiceContext: voiceContext, allTags: allTags, allClients: allClients,
    filtered: filtered, activeFilterCount: activeFilterCount
  };
})(window.Lamia = window.Lamia || {});
