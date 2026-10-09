/* ==========================================================================
   Plateforme de suivi - Lamia — application
   Démarrage (données chargées par le main via window.lamia), routage par
   ancre (#dashboard, #taches, #planning, #recap, #reglages), thème clair /
   sombre / système, accueil du matin (humeur puis rappels), chrono qui
   défile, bandeaux (lecture seule, dossier de repli, enregistrement),
   rappels envoyés par le main (toutes les 15 min), alerte chrono > 10 h.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q, ST = L.shared.stats, R = L.shared.reminders;
  var ROUTES = { dashboard: 'dashboard', taches: 'tasks', planning: 'planning', recap: 'recap', reglages: 'settings' };
  var current = null;
  var api = window.lamia;

  function viewFromHash() {
    var h = (location.hash || '').replace('#', '');
    return ROUTES[h] || 'dashboard';
  }

  function go(view, opts) {
    opts = opts || {};
    var changed = view !== current;
    current = view;
    U.$$('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    U.$$('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var V = L.views[view];
    if (V) V.show();
    var title = U.$('[data-topbar-title]');
    if (title) title.textContent = V ? V.title : '';
    document.documentElement.setAttribute('data-view', view);
    if (changed && !opts.initial) {
      window.scrollTo(0, 0);
      var h = U.$('#view-' + view + ' h1');
      if (h) h.focus({ preventScroll: true });
      L.charts.hideTip();
    }
  }

  /* --- Thème --------------------------------------------------------------- */
  function applyTheme() {
    var th = S.get().settings.theme;
    if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
    else delete document.documentElement.dataset.theme;
    U.$$('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === th)); });
    var dark = effectiveDark();
    var cyc = U.$('[data-action="cycle-theme"]');
    if (cyc) { cyc.innerHTML = U.icon(dark ? 'sun' : 'moon'); cyc.setAttribute('aria-label', dark ? 'Passer en thème clair' : 'Passer en thème sombre'); }
    if (api) api.app.setTheme(th);
  }

  function effectiveDark() {
    var th = S.get().settings.theme;
    if (th === 'dark') return true;
    if (th === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function setTheme(th) {
    S.setSettings({ theme: th });
    applyTheme();
    var label = { light: 'clair', dark: 'sombre', system: 'du système' }[th];
    U.announce('Thème ' + label);
  }

  /* --- Compteurs de la navigation ------------------------------------------ */
  function counts() {
    var n = S.column('doing').length;
    U.$$('[data-count="doing"]').forEach(function (b) {
      b.textContent = n || '';
      b.hidden = !n;
      b.setAttribute('aria-label', n + ' en cours');
    });
  }

  /* --- Rappels d'échéance --------------------------------------------------- */
  function when(t) { return R.when(t, D.today()); }

  function showReminders(due) {
    if (!due.length) return;
    if (due.length === 1) {
      var t = due[0];
      U.toast({ icon: 'bell', title: 'Rappel : « ' + t.title + ' »', text: 'Échéance ' + when(t) + '. Tu as le temps de t’organiser.', duration: 8000,
        actions: [{ label: 'Ouvrir', fn: function () { L.drawer.open(t.id); } }] });
      return;
    }
    U.toast({ icon: 'bell', title: U.plural(due.length, 'rappel') + ' d’échéance',
      text: due.slice(0, 3).map(function (x) { return '« ' + x.title + ' », ' + when(x); }).join(' ; ') + (due.length > 3 ? '…' : '.') + ' Tu as le temps de t’organiser.',
      duration: 9000, actions: [{ label: 'Voir les échéances', fn: function () { location.hash = 'dashboard'; setTimeout(function () { var c = document.getElementById('dh-due'); if (c) c.scrollIntoView({ block: 'center' }); }, 120); } }] });
  }

  // À l'ouverture : les rappels dus aujourd'hui et pas encore vus (une fois par tâche et par jour)
  function reminders(force) {
    var st = S.get();
    if (st.settings.reminders && st.settings.reminders.inApp === false && !force) return;
    var due = force ? R.due(st, D.today()) : R.pending(st, D.today());
    if (!due.length) return;
    S.markReminded(due.map(function (t) { return t.id; }));
    setTimeout(function () { showReminders(due); }, 300);
  }

  // Rappels envoyés par le main (vérification toutes les 15 min)
  function onRemindersDue(msg) {
    var ids = (msg && msg.ids) || [];
    var due = ids.map(S.task).filter(function (t) { return t && R.isDue(t, D.today()); });
    if (!due.length) return;
    S.markReminded(due.map(function (t) { return t.id; }));
    if (msg.show !== false) showReminders(due);
  }

  function morning(force) {
    if (force) S.setFlag('moodPromptedOn', null);
    var after = function () { reminders(force); longTimerCheck(); };
    var shown = L.mood.maybePrompt(after);
    if (!shown) after();
  }

  /* --- Chrono oublié (plus de 10 h) ---------------------------------------- */
  var longAlerted = null;
  function longTimerCheck() {
    var tm = S.get().activeTimer;
    if (!tm || tm.longAlertAck || !ST.isLongTimer(tm) || longAlerted === tm.startedAt) return;
    var t = S.task(tm.taskId);
    if (!t) return;
    longAlerted = tm.startedAt;
    U.toast({
      icon: 'timer', title: 'Tu as oublié d’arrêter le chrono ?',
      text: 'Il tourne depuis ' + D.duration(Math.round(S.timerElapsed() / 60000)) + ' sur « ' + t.title + ' ». Ça arrive à tout le monde.',
      duration: 600000,
      actions: [
        { label: 'Corriger la durée', fn: function () { L.chrono.confirmLong(); } },
        { label: 'Il tourne encore', fn: function () { S.ackLongTimer(); } }
      ]
    });
  }

  /* --- Bandeaux ------------------------------------------------------------- */
  var dismissed = {};
  function bannerHTML(key, tone, ic, title, text, actions, dismissable) {
    return '<div class="glass app-banner app-banner--' + tone + '" data-banner="' + key + '" role="' + (tone === 'warn' ? 'alert' : 'status') + '">' +
      '<span class="app-banner__icon">' + U.icon(ic) + '</span>' +
      '<div class="app-banner__body"><p class="app-banner__title">' + U.esc(title) + '</p>' + (text ? '<p class="app-banner__text">' + U.esc(text) + '</p>' : '') + '</div>' +
      '<div class="app-banner__actions">' + (actions || []).map(function (a) {
        return '<button type="button" class="btn ' + (a.primary ? 'btn--primary' : 'btn--secondary') + ' btn--sm" data-banner-action="' + a.id + '">' + U.esc(a.label) + '</button>';
      }).join('') +
      (dismissable ? '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-banner-close="' + key + '" aria-label="Masquer ce message">' + U.icon('close') + '</button>' : '') +
      '</div></div>';
  }

  function time(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.getHours() + D.NBSP + 'h' + D.NBSP + D.pad(d.getMinutes());
  }

  function renderBanners() {
    var box = document.getElementById('app-banners');
    if (!box) return;
    var info = L.info || {};
    var html = '';
    if (info.readOnly && info.readOnlyReason === 'lock') {
      var h = info.lockHolder || {};
      html += bannerHTML('lock', 'warn', 'eye', 'Lecture seule : l’application est déjà ouverte sur ' + (h.host || 'un autre PC') + (h.openedAt ? ' (depuis ' + time(h.openedAt) + ')' : '') + '.',
        'Pour ne rien écraser, tes modifications ne seront pas enregistrées ici. Ferme l’application sur l’autre PC, puis réessaie.',
        [{ id: 'retry-lock', label: 'Réessayer', primary: true }, { id: 'force-lock', label: 'Forcer l’ouverture' }]);
    } else if (info.readOnly && info.readOnlyReason === 'too-new') {
      html += bannerHTML('too-new', 'warn', 'eye', 'Lecture seule : ces données viennent d’une version plus récente de l’application.',
        'Mets à jour l’application sur ce PC (remplace l’exe, garde le dossier Donnees-Lamia) pour pouvoir modifier.', []);
    } else if (info.readOnly && info.readOnlyReason === 'conflict') {
      html += bannerHTML('conflict', 'warn', 'refresh', 'Les données ont été modifiées sur un autre PC pendant que l’application était ouverte.',
        'Rien n’a été écrasé : ta dernière version est mise de côté dans Donnees-Lamia (data-conflit-…). Recharge pour reprendre la version la plus récente.',
        [{ id: 'reload', label: 'Recharger les données', primary: true }]);
    }
    if (info.dataDirFallback && !dismissed.fallback) {
      html += bannerHTML('fallback', 'info', 'folder', 'Tes données sont enregistrées sur ce PC, dans ' + info.dataDir,
        (info.dataDirReason || '') + ' Le chemin exact est rappelé dans les Réglages.', [{ id: 'open-settings', label: 'Voir les Réglages' }], true);
    }
    var ls = S.lastSave();
    if (!info.readOnly && ls && !ls.ok && ls.error) {
      html += bannerHTML('save', 'warn', 'alert', 'Enregistrement en attente', 'Le dossier de données n’est pas accessible pour l’instant (' + ls.error + '). Nouvel essai automatique dans quelques secondes.', []);
    }
    box.innerHTML = html;
    U.typo(box);
  }

  function bannerAction(id, btn) {
    if (id === 'retry-lock' || id === 'force-lock') {
      var go2 = function () {
        btn.disabled = true;
        (id === 'force-lock' ? api.data.forceLock() : api.data.retryLock()).then(function (r) {
          btn.disabled = false;
          L.info = r.info || L.info;
          if (r.ok) {
            S.setReadOnly(false);
            S.replace(r.doc);
            U.toast({ kind: 'success', icon: 'check', title: 'C’est bon, tu peux modifier', text: 'Les données ont été relues depuis le dossier.' });
          } else U.toast({ icon: 'eye', title: 'Toujours ouverte sur l’autre PC', text: 'Réessaie dans un moment, ou force l’ouverture si tu es sûre qu’elle y est fermée.' });
          renderBanners();
        });
      };
      if (id === 'force-lock') {
        U.dialog({ title: 'Forcer l’ouverture ?', danger: true, confirmLabel: 'Forcer l’ouverture', returnTo: btn,
          text: 'Si l’application est vraiment ouverte sur l’autre PC, les deux pourraient s’écraser. À faire seulement si elle y est fermée (ou si ce PC est éteint).',
          onConfirm: function () { go2(); } });
      } else go2();
    } else if (id === 'reload') {
      api.data.reload().then(function (r) {
        if (!r.ok) { U.toast({ kind: 'warning', icon: 'alert', title: 'Rechargement impossible', text: r.error || '' }); return; }
        L.info = r.info; S.setReadOnly(!!r.info.readOnly); S.replace(r.doc); renderBanners();
        U.toast({ kind: 'success', icon: 'refresh', title: 'Données rechargées' });
      });
    } else if (id === 'open-settings') location.hash = 'reglages';
  }

  function onState(info) {
    L.info = info;
    S.setReadOnly(!!info.readOnly);
    renderBanners();
    if (L.views.settings && current === 'settings') L.views.settings.render();
  }

  /* --- Démarrage ----------------------------------------------------------- */
  function bootError(e) {
    document.body.innerHTML = '<main class="boot-error"><h1>Plateforme de suivi - Lamia</h1><p>Le démarrage n’a pas abouti : ' + U.esc(String(e && e.message || e)) + '</p></main>';
  }

  function init() {
    if (!api) { bootError(new Error('cette page doit être ouverte dans l’application.')); return; }
    api.app.boot().then(function (res) { start(res.doc, res.info); }, bootError);
  }

  function start(doc, info) {
    L.info = info || {};
    if (info && info.fakeNow) D.setNow(info.fakeNow);
    S.init(doc, { readOnly: !!info.readOnly });
    var st = S.get();
    var today = D.today();
    L.firstLoginToday = st.flags.lastOpenedOn !== today;
    L.daysAway = st.flags.lastOpenedOn && st.flags.lastOpenedOn < today ? D.diff(st.flags.lastOpenedOn, today) : 0;
    if (L.firstLoginToday) S.setFlag('lastOpenedOn', today);
    if (window.LamiaIcons) window.LamiaIcons.hydrate(document);
    applyTheme();

    Object.keys(L.views).forEach(function (k) { L.views[k].mount(document.getElementById('view-' + k)); });

    window.addEventListener('hashchange', function () { go(viewFromHash()); });
    go(viewFromHash(), { initial: true });
    L.chrono.render();
    counts();
    renderBanners();

    S.subscribe(function (type) {
      if (type === 'timer' || type.indexOf('task') === 0 || type === 'reset') { L.chrono.render(); counts(); }
      if (type === 'reset') { applyTheme(); U.$$('.view').forEach(function (v) { v.dataset.stale = '1'; }); go(current); }
      if (type === 'save-error') renderBanners();
      if (type === 'read-only') U.toast({ icon: 'eye', title: 'Lecture seule', text: 'Cette modification n’est pas enregistrée : l’application est ouverte sur un autre PC.', duration: 6000 });
    });
    var lastOk = true;
    setInterval(function () { var ok = S.lastSave().ok; if (ok !== lastOk) { lastOk = ok; renderBanners(); } }, 3000);

    document.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-action="new-task"]'))) { L.taskForm.open({ returnTo: b }); return; }
      if ((b = e.target.closest('[data-theme-set]'))) { setTheme(b.getAttribute('data-theme-set')); return; }
      if (e.target.closest('[data-action="cycle-theme"]')) { setTheme(effectiveDark() ? 'light' : 'dark'); return; }
      if ((b = e.target.closest('[data-banner-action]'))) { bannerAction(b.getAttribute('data-banner-action'), b); return; }
      if ((b = e.target.closest('[data-banner-close]'))) { dismissed[b.getAttribute('data-banner-close')] = true; renderBanners(); }
    });

    // Raccourci : « N » pour une nouvelle tâche (hors champ de saisie)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.ctrlKey || e.metaKey || e.altKey || U.topLayer()) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      L.taskForm.open();
    });

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    }

    // Impression (Export PDF) : toujours en thème clair, sur fond blanc
    window.addEventListener('beforeprint', function () { document.documentElement.dataset.theme = 'light'; });
    window.addEventListener('afterprint', applyTheme);

    // Événements du main
    api.on('app:state', onState);
    api.on('reminders:due', onRemindersDue);
    api.on('open-task', function (id) { if (S.task(id)) { if (U.topLayer() && L.drawer.current() !== id) L.drawer.close(); L.drawer.open(id); } });
    api.on('app:flush', function () { S.flush(); });

    // Changement de jour pendant que l'app reste ouverte : on rafraîchit les vues
    var day = today;
    setInterval(function () {
      L.chrono.tick();
    }, 1000);
    setInterval(function () {
      longTimerCheck();
      if (D.today() !== day) {
        day = D.today();
        L.firstLoginToday = true;
        S.setFlag('lastOpenedOn', day);
        U.$$('.view').forEach(function (v) { v.dataset.stale = '1'; });
        go(current);
      }
    }, 60000);

    morning(false);
    api.app.ready({ view: current, tasks: st.tasks.length, firstLaunch: info.loadStatus === 'created' });
  }

  L.app = { view: function () { return current; }, go: go, applyTheme: applyTheme, setTheme: setTheme, morning: morning, reminders: reminders, renderBanners: renderBanners };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.Lamia = window.Lamia || {});
