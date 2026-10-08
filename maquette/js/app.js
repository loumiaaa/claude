/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · application
   Routage par ancre (#dashboard, #taches, #planning, #recap, #reglages),
   thème clair / sombre / système (document.documentElement.dataset.theme),
   accueil du matin (humeur puis rappels), chrono qui défile.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q;
  var ROUTES = { dashboard: 'dashboard', taches: 'tasks', planning: 'planning', recap: 'recap', reglages: 'settings' };
  var current = null;

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

  /* --- Accueil du matin : humeur, puis rappels dus ------------------------- */
  function reminders(force) {
    var st = S.get();
    if (!force && st.flags.remindersShownOn === D.today()) return;
    S.setFlag('remindersShownOn', D.today());
    var today = D.today();
    var due = st.tasks.filter(function (t) {
      if (!t.reminder || !t.endDate || Q.isDone(t)) return false;
      return D.addDays(t.endDate, -t.reminder.daysBefore) <= today && t.endDate >= today;
    }).sort(function (a, b) { return a.endDate < b.endDate ? -1 : 1; });
    if (!due.length) return;
    function when(t) { var n = D.diff(today, t.endDate); return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : 'le ' + D.dayMonthLong(t.endDate); }
    setTimeout(function () {
      if (due.length === 1) {
        var t = due[0];
        U.toast({ icon: 'bell', title: 'Rappel : « ' + t.title + ' »', text: 'Échéance ' + when(t) + '. Tu as le temps de t’organiser.', duration: 8000,
          actions: [{ label: 'Ouvrir', fn: function () { L.drawer.open(t.id); } }] });
        return;
      }
      U.toast({ icon: 'bell', title: U.plural(due.length, 'rappel') + ' d’échéance',
        text: due.slice(0, 3).map(function (t) { return '« ' + t.title + ' », ' + when(t); }).join(' ; ') + (due.length > 3 ? '…' : '.') + ' Tu as le temps de t’organiser.',
        duration: 9000, actions: [{ label: 'Voir les échéances', fn: function () { location.hash = 'dashboard'; setTimeout(function () { var c = document.getElementById('dh-due'); if (c) c.scrollIntoView({ block: 'center' }); }, 120); } }] });
    }, 300);
  }

  function morning(force) {
    if (force) S.setFlag('moodPromptedOn', null);
    var shown = L.mood.maybePrompt(function () { reminders(force); });
    if (!shown) reminders(force);
  }

  /* --- Démarrage ----------------------------------------------------------- */
  function init() {
    S.init();
    var st = S.get();
    L.firstLoginToday = st.flags.lastOpenedOn !== D.today();
    S.setFlag('lastOpenedOn', D.today());
    if (window.LamiaIcons) window.LamiaIcons.hydrate(document);
    applyTheme();

    Object.keys(L.views).forEach(function (k) { L.views[k].mount(document.getElementById('view-' + k)); });

    window.addEventListener('hashchange', function () { go(viewFromHash()); });
    go(viewFromHash(), { initial: true });
    L.chrono.render();
    counts();

    S.subscribe(function (type) {
      if (type === 'timer' || type.indexOf('task') === 0 || type === 'reset') { L.chrono.render(); counts(); }
      if (type === 'reset') { applyTheme(); U.$$('.view').forEach(function (v) { v.dataset.stale = '1'; }); go(current); }
    });

    document.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-action="new-task"]'))) { L.taskForm.open({ returnTo: b }); return; }
      if ((b = e.target.closest('[data-theme-set]'))) { setTheme(b.getAttribute('data-theme-set')); return; }
      if (e.target.closest('[data-action="cycle-theme"]')) { setTheme(effectiveDark() ? 'light' : 'dark'); }
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

    setInterval(L.chrono.tick, 1000);
    morning(false);
  }

  L.app = { view: function () { return current; }, go: go, applyTheme: applyTheme, setTheme: setTheme, morning: morning, reminders: reminders };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.Lamia = window.Lamia || {});
