/* ==========================================================================
   Plateforme de suivi - Lamia — version web (PWA)
   Remplace le main Electron : expose la même API window.lamia au renderer.
   - Données : copie locale (localStorage) toujours à jour, hors ligne compris.
   - Synchro : Supabase (REST, sans dépendance). Un document par utilisatrice
     (table lamia_data), révision optimiste ; sauvegarde quotidienne distante
     (table lamia_backups, 30 jours). Conflit : la version distante l'emporte,
     la version de l'appareil est gardée dans « Restaurer… ».
   - Sans configuration Supabase, ou si Lamia choisit « sans synchro » :
     tout reste sur l'appareil.
   ========================================================================== */
(function () {
  'use strict';

  var SH = window.LamiaShared, M = SH.model, D = SH.dates, R = SH.reminders;
  var CFG = window.LAMIA_WEB_CONFIG || {};
  var VERSION = CFG.version || '0.1.0';
  var CLOUD = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  var BASE_URL = CLOUD ? String(CFG.supabaseUrl).replace(/\/+$/, '') : '';
  var PULL_MS = 60 * 1000, REMINDER_MS = 15 * 60 * 1000, LOCAL_BACKUPS = 5;

  var K = {
    doc: 'lamia:doc', base: 'lamia:base', session: 'lamia:session', mode: 'lamia:mode',
    backups: 'lamia:backups', notif: 'lamia:notif', device: 'lamia:device', lastBackup: 'lamia:lastRemoteBackup'
  };
  var LS = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* rien */ } }
  };
  function readJSON(k) { var t = LS.get(k); if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowIso() { return new Date(D.nowMs()).toISOString(); }

  /* --- État ---------------------------------------------------------------- */
  var current = null;          // document courant (copie)
  var base = null;             // révision distante connue (null : aucune ligne distante)
  var mode = 'local';          // 'local' | 'cloud'
  var session = readJSON(K.session);
  var sync = { status: 'idle', at: null, error: null };
  var loadStatus = 'ok';
  var pushing = false, pushTimer = null, pulling = false;
  var listeners = {};
  var importTokens = {};
  var notified = { day: null, ids: {} };

  function device() {
    var d = LS.get(K.device);
    if (d) return d;
    var ua = navigator.userAgent || '';
    d = /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'PC Windows' : 'Navigateur';
    LS.set(K.device, d);
    return d;
  }

  function emit(channel, payload) {
    (listeners[channel] || []).slice().forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } });
  }

  function notifOn() { return LS.get(K.notif) === '1' && 'Notification' in window && Notification.permission === 'granted'; }

  function info() {
    return {
      version: VERSION, host: device(), platform: 'web', web: true, packaged: true,
      mode: mode, readOnly: false, readOnlyReason: null, loadStatus: loadStatus,
      dataDir: null, dataDirFallback: false,
      sync: { cloud: CLOUD, mode: mode, email: session && session.user ? session.user.email : null, status: sync.status, at: sync.at, error: sync.error },
      machine: { platform: 'web', windowsNotifications: notifOn(), notificationsSupported: 'Notification' in window, closeToTray: false, openAtLogin: false, loginItemSupported: false }
    };
  }
  function setSync(status, error) {
    sync.status = status;
    sync.error = error || null;
    if (status === 'ok') sync.at = Date.now();
    emit('app:state', info());
  }

  /* --- Documents ----------------------------------------------------------- */
  function prepare(doc) {
    var out = M.migrate(clone(doc), { nowIso: nowIso() }).doc;
    var v = M.validate(out);
    if (!v.ok) throw new Error('Données invalides : ' + v.errors.slice(0, 2).join(' '));
    return out;
  }
  function fresh() {
    loadStatus = 'created';
    return M.normalize(M.defaultState({ nowIso: nowIso(), appVersion: VERSION, host: device() }));
  }
  function readLocal() {
    var d = readJSON(K.doc);
    if (!d) return null;
    try { return prepare(d); } catch (e) { keepLocalBackup(d, 'illisible'); return null; }
  }
  function writeLocal(doc) {
    if (LS.set(K.doc, JSON.stringify(doc))) return true;
    // Quota atteint : on libère les copies locales et on réessaie
    LS.del(K.backups);
    return LS.set(K.doc, JSON.stringify(doc));
  }
  function keepLocalBackup(doc, kind) {
    if (!doc) return null;
    var list = readJSON(K.backups) || [];
    var d = new Date(D.nowMs());
    var entry = { id: 'l' + d.getTime(), date: D.today(), time: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), kind: kind, doc: doc };
    list.unshift(entry);
    list = list.slice(0, LOCAL_BACKUPS);
    while (list.length && !LS.set(K.backups, JSON.stringify(list))) list.pop();
    return 'copie « ' + kind + ' » de cet appareil';
  }
  function storeBase(rev) { base = rev; if (rev == null) LS.del(K.base); else LS.set(K.base, String(rev)); }
  function storedBase() { var b = LS.get(K.base); return b == null ? null : +b; }

  /* --- Supabase : authentification ------------------------------------------ */
  function httpError(status, body) {
    var msg = (body && (body.error_description || body.msg || body.message || body.error)) || ('Erreur ' + status);
    var e = new Error(msg); e.status = status; return e;
  }
  function authCall(path, body) {
    return fetch(BASE_URL + '/auth/v1/' + path, {
      method: 'POST',
      headers: { apikey: CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw httpError(r.status, j); return j; });
    });
  }
  function keepSession(j) {
    session = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      user: { id: j.user && j.user.id, email: j.user && j.user.email }
    };
    LS.set(K.session, JSON.stringify(session));
    return session;
  }
  function dropSession() { session = null; LS.del(K.session); }
  function accessToken() {
    if (!session) return Promise.reject(httpError(401, { message: 'Non connectée.' }));
    if (session.expires_at - 60 > Date.now() / 1000) return Promise.resolve(session.access_token);
    return authCall('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then(function (j) { return keepSession(j).access_token; }, function (e) { if (e.status === 400 || e.status === 401) dropSession(); throw e; });
  }
  function rest(method, path, body, prefer) {
    return accessToken().then(function (t) {
      var h = { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' };
      if (prefer) h.Prefer = prefer;
      return fetch(BASE_URL + '/rest/v1/' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined });
    }).then(function (r) {
      return r.text().then(function (tx) {
        var j = null; try { j = tx ? JSON.parse(tx) : null; } catch (e) { j = null; }
        if (!r.ok) throw httpError(r.status, j);
        return j;
      });
    });
  }
  function uid() { return session && session.user ? session.user.id : ''; }

  /* --- Supabase : données ---------------------------------------------------- */
  function fetchRemote() {
    return rest('GET', 'lamia_data?select=doc,revision,updated_at&user_id=eq.' + uid()).then(function (rows) { return rows && rows[0] || null; });
  }
  function pushRemote(doc, b) {
    var rev = doc.meta.revision;
    if (b == null) {
      return rest('POST', 'lamia_data', { user_id: uid(), doc: doc, revision: rev }, 'return=minimal')
        .then(function () { return { ok: true }; }, function (e) { if (e.status === 409) return { ok: false, conflict: true }; throw e; });
    }
    return rest('PATCH', 'lamia_data?user_id=eq.' + uid() + '&revision=eq.' + b, { doc: doc, revision: rev, updated_at: new Date().toISOString() }, 'return=representation')
      .then(function (rows) { return rows && rows.length === 1 ? { ok: true } : { ok: false, conflict: true }; });
  }
  function dailyRemoteBackup(doc) {
    var day = D.today();
    if (LS.get(K.lastBackup) === day) return;
    rest('POST', 'lamia_backups?on_conflict=user_id,day', { user_id: uid(), day: day, doc: doc }, 'resolution=merge-duplicates,return=minimal')
      .then(function () {
        LS.set(K.lastBackup, day);
        var old = D.addDays(day, -30);
        return rest('DELETE', 'lamia_backups?user_id=eq.' + uid() + '&day=lt.' + old);
      })
      .catch(function () { /* nouvelle tentative au prochain enregistrement */ });
  }

  /* --- Synchronisation ------------------------------------------------------ */
  function pending() { return !!current && (base == null || current.meta.revision > base); }

  function schedulePush(ms) {
    if (mode !== 'cloud') return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, ms == null ? 1500 : ms);
  }
  function push() {
    if (mode !== 'cloud' || pushing || !current || !pending()) return Promise.resolve();
    if (navigator.onLine === false) { setSync('offline'); return Promise.resolve(); }
    pushing = true;
    setSync('syncing');
    var doc = clone(current);
    return pushRemote(doc, base).then(function (res) {
      pushing = false;
      if (res.ok) {
        storeBase(doc.meta.revision);
        setSync('ok');
        dailyRemoteBackup(doc);
        if (pending()) schedulePush(300);
        return;
      }
      return pull({ conflict: true });
    }, function (e) {
      pushing = false;
      onSyncError(e);
      schedulePush(20000);
    });
  }

  // Récupère la version distante ; si elle a avancé ailleurs, elle remplace celle de l'appareil.
  function pull(o) {
    o = o || {};
    if (mode !== 'cloud' || pulling) return Promise.resolve(false);
    if (navigator.onLine === false) { setSync('offline'); return Promise.resolve(false); }
    pulling = true;
    return fetchRemote().then(function (row) {
      pulling = false;
      if (!row) { storeBase(null); schedulePush(0); return false; }
      if (base != null && row.revision === base) {
        if (pending()) schedulePush(0); else setSync('ok');
        return false;
      }
      var remoteDoc;
      try { remoteDoc = prepare(row.doc); } catch (e) { setSync('error', e.message); return false; }
      var hadLocal = pending();
      var kept = hadLocal ? keepLocalBackup(current, 'conflit') : null;
      adopt(remoteDoc, row.revision);
      setSync('ok');
      toast(hadLocal || o.conflict
        ? { icon: 'refresh', title: 'Données mises à jour depuis un autre appareil', text: 'La version de cet appareil est gardée dans Réglages → Restaurer… (' + kept + ').', duration: 8000 }
        : { icon: 'refresh', title: 'Données synchronisées', text: 'Les changements faits sur un autre appareil sont arrivés.', duration: 4000 });
      return true;
    }, function (e) {
      pulling = false;
      onSyncError(e);
      return false;
    });
  }

  function adopt(doc, rev) {
    current = doc;
    storeBase(rev);
    writeLocal(current);
    var L = window.Lamia;
    if (L && L.store && L.store.get()) {
      L.store.replace(clone(doc));
      if (L.app && L.app.applyTheme) L.app.applyTheme();
    }
  }

  function onSyncError(e) {
    if (e && e.status === 401) { dropSession(); setSync('signed-out', 'Session expirée : reconnecte-toi dans Réglages.'); return; }
    if (navigator.onLine === false || (e && e.name === 'TypeError')) { setSync('offline'); return; }
    setSync('error', e && e.message);
  }

  function toast(o) {
    var U = window.Lamia && window.Lamia.ui;
    if (U && U.toast) U.toast(o);
  }

  /* --- Écran de connexion ---------------------------------------------------- */
  function icon(n) { return window.LamiaIcons ? window.LamiaIcons.svg(n, { size: 18 }) : ''; }
  function loginScreen(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'overlay';
      ov.setAttribute('data-web-auth', '');
      ov.innerHTML =
        '<div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="wa-title" aria-describedby="wa-desc">' +
          '<form class="dialog-form" novalidate>' +
            '<div class="modal__header"><div><h2 class="modal__title" id="wa-title">Bonjour Lamia</h2>' +
              '<p class="modal__desc" id="wa-desc">Connecte-toi pour retrouver tes tâches sur ton Mac, ton PC et ton téléphone.</p></div></div>' +
            '<div class="modal__body">' +
              '<div class="field"><label class="label" for="wa-email">E-mail</label><input class="input" id="wa-email" type="email" autocomplete="username" required></div>' +
              '<div class="field"><label class="label" for="wa-pass">Mot de passe</label><input class="input" id="wa-pass" type="password" autocomplete="current-password" minlength="6" required>' +
                '<p class="hint">6 caractères minimum.</p></div>' +
              '<p class="hint" data-wa-msg role="alert" hidden></p>' +
            '</div>' +
            '<div class="modal__footer" style="flex-wrap:wrap">' +
              (opts.allowLocal === false ? '' : '<button type="button" class="btn btn--ghost" data-wa="local">Sans synchro</button>') +
              '<button type="button" class="btn btn--secondary" data-wa="signup">Créer mon compte</button>' +
              '<button type="submit" class="btn btn--primary">' + icon('check') + 'Se connecter</button>' +
            '</div>' +
          '</form></div>';
      document.body.appendChild(ov);
      var form = ov.querySelector('form'), email = ov.querySelector('#wa-email'), pass = ov.querySelector('#wa-pass'), msg = ov.querySelector('[data-wa-msg]');
      if (session && session.user && session.user.email) email.value = session.user.email;
      setTimeout(function () { (email.value ? pass : email).focus(); }, 30);
      function say(t, ok) { msg.hidden = !t; msg.textContent = t || ''; msg.style.color = ok ? 'var(--success)' : 'var(--danger)'; }
      function busy(b) { Array.prototype.forEach.call(ov.querySelectorAll('button,input'), function (x) { x.disabled = b; }); }
      function done(result) { ov.remove(); resolve(result); }
      function go(kind) {
        var e = email.value.trim(), p = pass.value;
        if (!/^\S+@\S+\.\S+$/.test(e)) { say('Indique une adresse e-mail valide.'); email.focus(); return; }
        if (p.length < 6) { say('Le mot de passe doit faire au moins 6 caractères.'); pass.focus(); return; }
        busy(true); say('');
        var call = kind === 'signup' ? authCall('signup', { email: e, password: p }) : authCall('token?grant_type=password', { email: e, password: p });
        call.then(function (j) {
          busy(false);
          if (!j.access_token) { say('Compte créé. Confirme ton adresse depuis l’e-mail reçu, puis connecte-toi.', true); return; }
          keepSession(j);
          LS.set(K.mode, 'cloud');
          done('cloud');
        }, function (err) {
          busy(false);
          var t = String(err.message || '');
          if (/invalid login/i.test(t)) t = 'E-mail ou mot de passe incorrect.';
          else if (/not confirmed/i.test(t)) t = 'Adresse pas encore confirmée : ouvre le lien reçu par e-mail.';
          else if (/already registered/i.test(t)) t = 'Ce compte existe déjà : clique sur « Se connecter ».';
          else if (/signups? not allowed|disabled/i.test(t)) t = 'La création de compte est fermée. Connecte-toi avec ton compte existant.';
          else if (err.name === 'TypeError') t = 'Pas de connexion Internet. Réessaie, ou continue sans synchro.';
          say(t);
        });
      }
      form.addEventListener('submit', function (ev) { ev.preventDefault(); go('signin'); });
      ov.querySelector('[data-wa="signup"]').addEventListener('click', function () { go('signup'); });
      var loc = ov.querySelector('[data-wa="local"]');
      if (loc) loc.addEventListener('click', function () { LS.set(K.mode, 'local'); done('local'); });
    });
  }

  /* --- Démarrage ------------------------------------------------------------- */
  function startLocal(local) {
    mode = 'local';
    current = local || fresh();
    writeLocal(current);
    return current;
  }
  function startCloud(local) {
    mode = 'cloud';
    var known = storedBase();
    setSync('syncing');
    return fetchRemote().then(function (row) {
      if (!row) {                                   // premier appareil : on envoie ce qu'il y a
        current = local || fresh();
        storeBase(null);
        writeLocal(current);
        schedulePush(0);
        return current;
      }
      var remoteDoc = prepare(row.doc);
      if (local && known != null && row.revision === known && local.meta.revision > known) {
        current = local; storeBase(known); schedulePush(0);          // modifs hors ligne de cet appareil
      } else {
        if (local && (known == null ? (local.tasks.length || local.moods.length) : local.meta.revision > known)) keepLocalBackup(local, known == null ? 'avant-synchro' : 'conflit');
        current = remoteDoc; storeBase(row.revision); loadStatus = 'ok';
        writeLocal(current);
        setSync('ok');
      }
      return current;
    }, function (e) {
      if (e && e.status === 401) { dropSession(); return loginScreen().then(function (r) { return r === 'cloud' ? startCloud(local) : startLocal(local); }); }
      current = local || fresh();                   // hors ligne : on travaille sur la copie locale
      base = known;
      writeLocal(current);
      onSyncError(e);
      return current;
    });
  }
  function boot() {
    var local = readLocal();
    var p;
    if (!CLOUD) p = Promise.resolve(startLocal(local));
    else if (session) p = startCloud(local);
    else if (LS.get(K.mode) === 'local' && local) p = Promise.resolve(startLocal(local));
    else p = loginScreen().then(function (r) { return r === 'cloud' ? startCloud(local) : startLocal(local); });
    return p.then(function (doc) {
      wire();
      return { doc: clone(doc), info: info() };
    });
  }

  var wiredCloud = false, wiredReminders = false;
  function wire() {
    if (mode === 'cloud' && !wiredCloud) {
      wiredCloud = true;
      document.addEventListener('visibilitychange', function () { if (mode !== 'cloud') return; if (document.visibilityState === 'visible') pull(); else push(); });
      window.addEventListener('focus', function () { pull(); });
      window.addEventListener('online', function () { pull().then(function () { schedulePush(0); }); });
      window.addEventListener('offline', function () { if (mode === 'cloud') setSync('offline'); });
      setInterval(function () { if (mode !== 'cloud') return; if (!pending()) pull(); else schedulePush(0); }, PULL_MS);
    }
    if (!wiredReminders) {
      wiredReminders = true;
      setTimeout(checkReminders, 5000);
      setInterval(checkReminders, REMINDER_MS);
    }
  }

  /* --- Enregistrement --------------------------------------------------------- */
  function saveDoc(doc) {
    if (!doc || typeof doc !== 'object') return { ok: false, error: 'Document manquant.' };
    var copy = clone(doc);
    copy.meta = copy.meta || {};
    copy.meta.revision = Math.max(copy.meta.revision || 0, current ? current.meta.revision : 0) + 1;
    copy.meta.savedAt = nowIso();
    copy.meta.savedBy = device();
    copy.meta.appVersion = VERSION;
    var v = M.validate(copy);
    if (!v.ok) return { ok: false, error: 'Document refusé : ' + v.errors.slice(0, 3).join(' ') };
    current = copy;
    if (!writeLocal(copy)) return { ok: false, error: 'Stockage de l’appareil plein.' };
    schedulePush();
    return { ok: true, revision: copy.meta.revision, savedAt: copy.meta.savedAt };
  }
  function replaceDoc(doc, kind) {
    var label = keepLocalBackup(current, kind);
    var res = saveDoc(doc);
    if (!res.ok) return res;
    if (mode === 'cloud') schedulePush(0);
    return { ok: true, doc: clone(current), backup: label };
  }

  /* --- Rappels ------------------------------------------------------------------ */
  function checkReminders(force) {
    if (!current) return;
    var today = D.today();
    if (notified.day !== today) notified = { day: today, ids: {} };
    var s = (current.settings && current.settings.reminders) || {};
    if (!force && D.now().getHours() < (s.hour || 9)) return;
    var set = { has: function (id) { return !!notified.ids[id]; } };
    var list = R.pending(current, today, set);
    if (!list.length) return;
    list.forEach(function (t) { notified.ids[t.id] = true; });
    var ids = list.map(function (t) { return t.id; });
    emit('reminders:due', { ids: ids, show: s.inApp !== false });
    if (notifOn()) {
      var n = R.notification(list, today);
      try {
        var note = new Notification(n.title, { body: n.body, icon: 'icons/icon-192.png', tag: 'lamia-' + today });
        note.onclick = function () { window.focus(); if (ids.length === 1) emit('open-task', ids[0]); };
      } catch (e) { /* notifications indisponibles */ }
    }
  }

  /* --- Fichiers --------------------------------------------------------------- */
  function download(name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return { ok: true, path: null, fileName: name };
  }
  function pickFile() {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) { resolve({ canceled: true }); return; }
        f.text().then(function (t) { resolve({ name: f.name, text: t }); }, function () { resolve({ ok: false, error: 'Fichier illisible.' }); });
      });
      input.addEventListener('cancel', function () { resolve({ canceled: true }); });
      input.click();
    });
  }

  /* --- API window.lamia (même contrat que le preload Electron) -------------------- */
  window.lamia = {
    app: {
      boot: boot,
      ready: function () { /* rien côté web */ },
      setTheme: function () { return Promise.resolve(true); },
      openDataFolder: function () { return Promise.resolve({ ok: false, error: 'La version web n’a pas de dossier : tes données sont dans ce navigateur et dans ton compte.' }); },
      showFile: function () { return Promise.resolve(false); },
      setMachineOptions: function (patch) {
        var p = Promise.resolve();
        if (patch && 'windowsNotifications' in patch) {
          if (!patch.windowsNotifications) LS.set(K.notif, '0');
          else if ('Notification' in window) {
            p = Promise.resolve(Notification.requestPermission()).then(function (perm) { LS.set(K.notif, perm === 'granted' ? '1' : '0'); });
          }
        }
        return p.then(function () {
          var i = info();
          var messages = patch && patch.windowsNotifications && !i.machine.windowsNotifications ? ['Le navigateur a refusé les notifications : les rappels resteront dans l’application.'] : [];
          return { options: i.machine, messages: messages };
        });
      },
      testNotification: function () {
        if (!notifOn()) return Promise.resolve({ shown: false });
        try { new Notification('Les rappels sont prêts', { body: 'Tu recevras ici les rappels d’échéance. À très vite, Lamia !', icon: 'icons/icon-192.png' }); return Promise.resolve({ shown: true }); }
        catch (e) { return Promise.resolve({ shown: false }); }
      }
    },
    data: {
      save: function (doc) { return Promise.resolve(saveDoc(doc)); },
      saveSync: function (doc) { var r = saveDoc(doc); if (mode === 'cloud') push(); return r; },
      loadDemo: function () {
        var doc = SH.demo.seed({ today: D.today(), nowMs: D.nowMs(), appVersion: VERSION });
        doc.meta.revision = current ? current.meta.revision : 0;
        return Promise.resolve(replaceDoc(doc, 'avant-demo'));
      },
      retryLock: function () { return Promise.resolve({ ok: true, info: info() }); },
      forceLock: function () { return Promise.resolve({ ok: true, info: info() }); },
      reload: function () { return pull().then(function () { return { ok: true, doc: clone(current), info: info() }; }); }
    },
    backup: {
      list: function () {
        var local = (readJSON(K.backups) || []).map(function (b) { return { id: b.id, date: b.date, time: b.time, kind: b.kind }; });
        if (mode !== 'cloud') return Promise.resolve(local);
        return rest('GET', 'lamia_backups?select=day,created_at&user_id=eq.' + uid() + '&order=day.desc&limit=30').then(function (rows) {
          return local.concat((rows || []).map(function (r) { return { id: 'r' + r.day, date: r.day, time: null, kind: 'quotidienne' }; }));
        }, function () { return local; });
      },
      restore: function (id) {
        var get;
        if (String(id).charAt(0) === 'r') {
          get = rest('GET', 'lamia_backups?select=doc&user_id=eq.' + uid() + '&day=eq.' + String(id).slice(1)).then(function (rows) { return rows && rows[0] && rows[0].doc; });
        } else {
          var b = (readJSON(K.backups) || []).filter(function (x) { return x.id === id; })[0];
          get = Promise.resolve(b && b.doc);
        }
        return get.then(function (doc) {
          if (!doc) return { ok: false, error: 'Sauvegarde introuvable.' };
          var d = prepare(doc);
          d.meta.revision = current.meta.revision;
          return replaceDoc(d, 'avant-restauration');
        }, function (e) { return { ok: false, error: e.message }; });
      },
      exportJson: function () {
        return Promise.resolve(download('lamia-sauvegarde_' + D.today() + '.json', JSON.stringify(current, null, 2), 'application/json'));
      },
      importPick: function () {
        return pickFile().then(function (f) {
          if (!f || f.canceled || f.ok === false) return f;
          try {
            var d = prepare(JSON.parse(f.text));
            var token = 't' + Date.now();
            importTokens[token] = d;
            return { ok: true, token: token, fileName: f.name, summary: M.summarize(d) };
          } catch (e) { return { ok: false, error: e.message || 'Ce fichier n’est pas une sauvegarde de l’application.' }; }
        });
      },
      importApply: function (token) {
        var d = importTokens[token];
        delete importTokens[token];
        if (!d) return Promise.resolve({ ok: false, error: 'Import expiré : recommence.' });
        d.meta.revision = current.meta.revision;
        return Promise.resolve(replaceDoc(d, 'avant-import'));
      }
    },
    io: {
      exportCsv: function (o) { return Promise.resolve(download(o.filename, o.content, 'text/csv;charset=utf-8')); },
      exportPdf: function () { window.print(); return Promise.resolve({ ok: true, path: null }); }
    },
    on: function (channel, fn) {
      (listeners[channel] = listeners[channel] || []).push(fn);
      return function () { listeners[channel] = listeners[channel].filter(function (f) { return f !== fn; }); };
    },
    // Propre à la version web (Réglages → Synchronisation)
    web: {
      info: info,
      syncNow: function () { return push().then(function () { return pull(); }).then(function () { return info(); }); },
      login: function () {
        return loginScreen({ allowLocal: false }).then(function (r) {
          if (r !== 'cloud') return info();
          var local = current;
          return startCloud(local).then(function (doc) {
            if (window.Lamia && window.Lamia.store) { window.Lamia.store.replace(clone(doc)); if (window.Lamia.app) window.Lamia.app.applyTheme(); }
            wire();
            return info();
          });
        });
      },
      logout: function () {
        return push().then(function () {
          dropSession();
          LS.set(K.mode, 'local');
          mode = 'local';
          setSync('signed-out');
          return info();
        });
      }
    }
  };
  // Application installable et hors ligne
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne indisponible */ }); });
  }
})();
