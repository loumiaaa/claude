/* ==========================================================================
   Plateforme de suivi - Lamia — Calendrier Apple
   Dans les deux sens :
   1. Tes rendez-vous dans la plateforme : le lien public d'un calendrier
      iCloud (webcal://…) est relu toutes les 30 minutes. Version web : via le
      relais Supabase (Apple n'autorise pas un site à le lire directement) ;
      version Windows / Mac : directement. Lecture seule. Les événements
      restent sur l'appareil (cache), seul le lien est synchronisé.
   2. Tes échéances dans Calendrier : un lien d'abonnement privé (relais
      Supabase, se met à jour tout seul), ou un fichier .ics ponctuel.
   Affichage : carte « Aujourd'hui » de l'Accueil, Planning, bilan du dimanche.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, ICS = window.LamiaShared.ics;
  var esc = U.esc, icon = U.icon;
  var KEY = 'lamia:calendar', MAX_AGE = 30 * 60 * 1000;
  var api = window.lamia || {};
  var cache = readCache();            // { url, at, events }
  var status = { state: cache ? 'ok' : 'idle', error: null };
  var loading = null, relay = null;    // relais : null (inconnu) | true | false

  function readCache() { try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && Array.isArray(c.events) ? c : null; } catch (e) { return null; } }
  function writeCache() { try { if (cache) localStorage.setItem(KEY, JSON.stringify(cache)); else localStorage.removeItem(KEY); } catch (e) { /* stockage plein */ } }
  function cfg() { return S.calendar(); }
  function on() { return !!(cfg().url && cfg().show); }
  function canRead() { return !!(api.calendar && api.calendar.fetch); }
  function isWeb() { return !!(api.web); }
  function signal() { S.signal('calendar-events', {}); }

  /* --- Lecture ------------------------------------------------------------------ */
  function refresh(force) {
    var url = cfg().url;
    if (!url || !canRead()) { if (cache && !url) { cache = null; writeCache(); signal(); } return Promise.resolve(null); }
    if (!force && cache && cache.url === url && Date.now() - cache.at < MAX_AGE) return Promise.resolve(cache);
    if (loading) return loading;
    status = { state: 'loading', error: null };
    loading = api.calendar.fetch(url).then(function (r) {
      loading = null;
      if (!r || !r.ok) {
        status = { state: 'error', error: (r && r.error) || 'Lecture impossible.', relay: r && r.relay };
        if (r && r.relay === 'missing') relay = false;
        signal();
        return null;
      }
      relay = isWeb() ? true : relay;
      var events = ICS.parse(r.text);
      cache = { url: url, at: Date.now(), events: events };
      writeCache();
      status = { state: 'ok', error: null };
      signal();
      return cache;
    }, function (e) {
      loading = null;
      status = { state: 'error', error: String(e && e.message || e) };
      signal();
      return null;
    });
    return loading;
  }

  // Rendez-vous entre deux dates (inclus) : [] si rien ou calendrier masqué
  function between(a, b) {
    if (!on() || !cache || cache.url !== cfg().url) return [];
    try { return ICS.occurrences(cache.events, a, b); } catch (e) { return []; }
  }

  function when(e) { return e.allDay ? 'Journée' : e.time.replace(':', 'h') + (e.end ? ' – ' + e.end.replace(':', 'h') : ''); }
  function evRow(e) {
    return '<li class="ev' + (e.allDay ? ' ev--day' : '') + '"><span class="ev__time num">' + esc(when(e)) + '</span>' +
      '<span class="ev__body"><span class="ev__title">' + esc(e.title) + '</span>' + (e.location ? '<span class="ev__place">' + esc(e.location) + '</span>' : '') + '</span></li>';
  }

  /* --- Accueil : aujourd'hui (et demain) ------------------------------------------------ */
  function cardHTML() {
    if (!on()) return '';
    var today = D.today(), tomorrow = D.addDays(today, 1);
    var now = new Date(), hm = D.pad(now.getHours()) + ':' + D.pad(now.getMinutes());
    var todays = between(today, today), next = between(tomorrow, tomorrow);
    var upcoming = todays.filter(function (e) { return e.allDay || (e.end || e.time) >= hm; });
    var body = todays.length
      ? '<ul class="ev-list" role="list">' + todays.map(function (e) { return evRow(e).replace('class="ev', 'class="ev' + (!e.allDay && (e.end || e.time) < hm ? ' is-past' : '')); }).join('') + '</ul>'
      : '<p class="life-card__muted">' + (status.state === 'error' ? esc(status.error) : status.state === 'loading' && !cache ? 'Lecture du calendrier…' : 'Aucun rendez-vous aujourd’hui : la journée est à toi.') + '</p>';
    return '<section class="glass card life-card" aria-labelledby="dh-cal"><div class="card__header"><div><h2 class="card__title" id="dh-cal">📅 Aujourd’hui</h2>' +
      '<p class="card__subtitle">' + (todays.length ? U.plural(todays.length, 'rendez-vous').replace('rendez-vouss', 'rendez-vous') + (upcoming.length && upcoming.length < todays.length ? ' · encore ' + upcoming.length : '') : 'Ton calendrier') + '</p></div>' +
      '<a class="btn btn--ghost btn--sm" href="#planning">Planning' + icon('chevron-right') + '</a></div>' + body +
      (next.length ? '<p class="life-chip">Demain : ' + esc(next[0].title) + (next[0].time ? ' à ' + esc(next[0].time.replace(':', 'h')) : '') + (next.length > 1 ? ' et ' + (next.length - 1) + ' autre' + (next.length > 2 ? 's' : '') : '') + '</p>' : '') +
      '</section>';
  }

  /* --- Planning : les rendez-vous de la période ------------------------------------------- */
  function planningHTML(p) {
    if (!cfg().url) {
      return '<section class="glass card cal-hint"><p>' + icon('calendar') + 'Tu veux voir tes rendez-vous Apple ici ? <a href="#reglages" data-cal-goto>Connecte ton calendrier dans les Réglages</a>.</p></section>';
    }
    if (!cfg().show) return '';
    var list = between(p.start, p.end), days = {}, order = [];
    list.forEach(function (e) { if (!days[e.date]) { days[e.date] = []; order.push(e.date); } days[e.date].push(e); });
    var today = D.today();
    return '<section class="glass card cal-card" aria-labelledby="h-cal"><div class="card__header"><div><h2 class="card__title" id="h-cal">Rendez-vous</h2>' +
      '<p class="card__subtitle">Calendrier Apple · ' + (status.state === 'error' ? esc(status.error) : U.plural(list.length, 'événement')) + '</p></div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-cal-refresh>' + icon('refresh') + 'Actualiser</button></div>' +
      (order.length ? '<div class="cal-days">' + order.map(function (d) {
        return '<div class="cal-day' + (d === today ? ' is-today' : '') + (d < today ? ' is-past' : '') + '"><h3 class="cal-day__title">' + esc(D.cap(D.dayMonthLong(d))) + (d === today ? ' <span class="chip chip--doing">Aujourd’hui</span>' : '') + '</h3>' +
          '<ul class="ev-list" role="list">' + days[d].map(evRow).join('') + '</ul></div>';
      }).join('') + '</div>' : '<p class="empty-line">Aucun rendez-vous sur cette période.</p>') + '</section>';
  }

  /* --- Réglages ------------------------------------------------------------------------------ */
  function feedUrl() { return cfg().feedToken && api.calendar && api.calendar.feedUrl ? api.calendar.feedUrl(cfg().feedToken) : ''; }
  function settingsHTML() {
    var c = cfg(), web = isWeb(), synced = web && api.calendar && api.calendar.cloud && api.calendar.cloud();
    var st = !c.url ? '' : status.state === 'loading' ? '<p class="cal-status">' + icon('refresh') + 'Lecture en cours…</p>'
      : status.state === 'error' ? '<p class="cal-status is-error">' + icon('alert') + esc(status.error) + '</p>'
        : cache && cache.url === c.url ? '<p class="cal-status is-ok">' + icon('check') + U.plural(cache.events.length, 'événement') + ' lu' + (cache.events.length > 1 ? 's' : '') + ', ' + esc(timeAgo(cache.at)) + '</p>' : '';
    var feed = feedUrl();
    return '<section class="glass card" aria-labelledby="st-cal"><div class="card__header"><div><h2 class="card__title" id="st-cal">Calendrier Apple</h2>' +
        '<p class="card__subtitle">Tes rendez-vous ici, tes échéances sur ton iPhone</p></div></div>' +
      '<h3 class="cal-h">1. Mes rendez-vous dans la plateforme</h3>' +
      (canRead() ? '' : '<p class="hint">Disponible dans la version web et dans l’application Windows / Mac.</p>') +
      '<p class="hint">Dans l’app Calendrier : touche (i) à côté du calendrier, active <strong>Calendrier public</strong>, puis <strong>Partager le lien</strong>. Colle-le ici. Lecture seule : rien n’est modifié chez Apple. Un calendrier dédié (ex. « Pro ») est plus discret que ton calendrier perso complet.</p>' +
      '<form class="cal-form" data-cal-form novalidate><label class="sr-only" for="cal-url">Lien du calendrier public</label>' +
        '<input class="input" id="cal-url" name="url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="webcal://p…-caldav.icloud.com/published/2/…" value="' + esc(c.url) + '" data-focus-key="cal-url">' +
        '<button type="submit" class="btn btn--primary btn--sm" data-focus-key="cal-save"' + (canRead() ? '' : ' disabled') + '>' + (c.url ? 'Mettre à jour' : 'Connecter') + '</button></form>' + st +
      (c.url ? '<div class="cal-actions"><label class="switch"><input class="switch__input" type="checkbox" role="switch" data-cal-show data-focus-key="cal-show"' + (c.show ? ' checked' : '') + '><span class="switch__track" aria-hidden="true"></span><span class="switch__label">Afficher sur l’Accueil et le Planning</span></label>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-cal-refresh>' + icon('refresh') + 'Actualiser</button>' +
        '<button type="button" class="btn btn--ghost btn--sm btn--danger-text" data-cal-remove>' + icon('close') + 'Déconnecter</button></div>' : '') +
      (web && relay === false ? relayHelp() : '') +
      '<h3 class="cal-h">2. Mes échéances dans Calendrier</h3>' +
      (synced
        ? (feed
          ? '<p class="hint">Ajoute ce lien une seule fois : il se met à jour tout seul. iPhone : Réglages → Calendrier → Comptes → Ajouter un compte → Autre → <strong>Ajouter un calendrier avec abonnement</strong>. Mac : Calendrier → Fichier → <strong>Nouvel abonnement au calendrier</strong>.</p>' +
            '<div class="cal-feed"><input class="input" readonly value="' + esc(feed) + '" aria-label="Lien d’abonnement à tes échéances" data-cal-feed-input>' +
            '<button type="button" class="btn btn--secondary btn--sm" data-cal-copy>' + icon('copy') + 'Copier</button></div>' +
            '<p class="hint">Ce lien est privé : garde-le pour toi. <button type="button" class="link-btn" data-cal-feed="new">Créer un nouveau lien</button> (l’ancien cessera de marcher) · <button type="button" class="link-btn" data-cal-feed="off">Désactiver</button></p>'
          : '<p class="hint">Un lien privé que Calendrier relit toutes les heures : tes échéances apparaissent sur ton iPhone et ton Mac.</p>' +
            '<button type="button" class="btn btn--secondary btn--sm" data-cal-feed="new">' + icon('calendar') + 'Créer mon lien d’abonnement</button>')
        : '<p class="hint">' + (web ? 'Le lien d’abonnement demande la synchronisation (connexion à ton compte).' : 'Le lien d’abonnement se crée depuis la version web synchronisée.') + ' En attendant, tu peux exporter tes échéances une fois :</p>') +
      '<button type="button" class="btn btn--ghost btn--sm" data-cal-export>' + icon('download') + 'Exporter un fichier .ics</button>' +
      '</section>';
  }
  function relayHelp() {
    return '<div class="cal-relay"><p><strong>Le relais n’est pas encore installé.</strong> Apple n’autorise pas un site à lire un calendrier directement : un petit relais sur ton compte Supabase s’en charge. Il s’installe une seule fois, en 5 minutes : suis le guide <em>docs/calendrier-apple.md</em> du projet.</p></div>';
  }
  function timeAgo(ms) {
    var m = Math.round((Date.now() - ms) / 60000);
    return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : 'il y a ' + Math.round(m / 60) + ' h';
  }
  function token() {
    var a = new Uint8Array(24), chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '';
    (window.crypto || {}).getRandomValues(a);
    for (var i = 0; i < a.length; i++) s += chars[a[i] % chars.length];
    return s + Date.now().toString(36).replace(/[^A-Za-z0-9]/g, '');
  }

  function exportIcs() {
    var name = 'echeances-' + D.today() + '.ics';
    var content = ICS.build(S.get(), { name: 'Échéances' + (S.me().name ? ' · ' + S.me().name : '') });
    var fn = api.io && api.io.exportIcs;
    (fn ? fn({ filename: name, content: content }) : Promise.resolve({ ok: false, error: 'Export indisponible.' })).then(function (r) {
      if (r && r.ok) U.toast({ kind: 'success', icon: 'check', title: 'Échéances exportées', text: 'Ouvre le fichier ' + name + ' : Calendrier te propose de les ajouter.', duration: 6000 });
      else if (!(r && r.canceled)) U.toast({ kind: 'warning', icon: 'alert', title: 'Export impossible', text: (r && r.error) || '' });
    });
  }

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-cal-form]');
    if (!f) return;
    e.preventDefault();
    var raw = f.url.value.trim();
    if (!raw) { S.setCalendar({ url: '' }); return; }
    if (!ICS.allowedUrl(raw)) {
      U.toast({ kind: 'warning', icon: 'alert', title: 'Lien non reconnu', text: 'Colle le lien « Calendrier public » d’iCloud (il commence par webcal://). Google et Outlook marchent aussi.', duration: 7000 });
      f.url.focus();
      return;
    }
    S.setCalendar({ url: raw, show: true });
    refresh(true).then(function (c) {
      if (c) U.toast({ kind: 'success', icon: 'calendar', title: 'Calendrier connecté', text: U.plural(c.events.length, 'événement') + ' : tu les retrouves sur l’Accueil et dans le Planning.', duration: 5000 });
    });
  });
  document.addEventListener('change', function (e) {
    if (e.target.closest('[data-cal-show]')) S.setCalendar({ show: e.target.checked });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cal-refresh], [data-cal-remove], [data-cal-feed], [data-cal-copy], [data-cal-export]');
    if (!b) return;
    if (b.hasAttribute('data-cal-refresh')) { refresh(true); signal(); return; }
    if (b.hasAttribute('data-cal-export')) { exportIcs(); return; }
    if (b.hasAttribute('data-cal-remove')) {
      U.dialog({ title: 'Déconnecter le calendrier ?', text: 'Tes rendez-vous ne s’afficheront plus ici. Rien n’est supprimé chez Apple.', confirmLabel: 'Déconnecter', danger: true, returnTo: b,
        onConfirm: function () { cache = null; writeCache(); status = { state: 'idle', error: null }; S.setCalendar({ url: '' }); } });
      return;
    }
    if (b.hasAttribute('data-cal-copy')) {
      var input = document.querySelector('[data-cal-feed-input]');
      var done = function () { U.toast({ kind: 'success', icon: 'copy', title: 'Lien copié', text: 'Colle-le dans Calendrier, comme indiqué juste au-dessus.', duration: 4000 }); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done, function () { input.select(); });
      else { input.select(); try { document.execCommand('copy'); done(); } catch (er) { /* rien */ } }
      return;
    }
    var a = b.getAttribute('data-cal-feed');
    if (a === 'off') { S.setCalendar({ feedToken: '' }); U.toast({ icon: 'close', title: 'Lien d’abonnement désactivé', duration: 3000 }); }
    else if (cfg().feedToken) {
      U.dialog({ title: 'Créer un nouveau lien ?', text: 'L’ancien lien cessera de marcher : il faudra ajouter le nouveau dans Calendrier.', confirmLabel: 'Créer un nouveau lien', returnTo: b, onConfirm: function () { S.setCalendar({ feedToken: token() }); } });
    } else S.setCalendar({ feedToken: token() });
  });

  // Démarrage, puis toutes les 30 minutes (et au retour sur l'onglet)
  function start() {
    if (api.calendar && api.calendar.ping && isWeb() && api.calendar.cloud && api.calendar.cloud()) api.calendar.ping().then(function (ok) { relay = ok; if (!ok) signal(); });
    setTimeout(function () { refresh(false); }, 1200);
    setInterval(function () { if (!document.hidden) refresh(false); }, MAX_AGE);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(false); });
    S.subscribe(function (type, d) {
      if (type === 'calendar' && d && 'url' in d && !d.url) { cache = null; writeCache(); }
      if (type === 'reset') refresh(false);
    });
  }

  L.calendar = { refresh: refresh, between: between, status: function () { return status; } };
  L.calendarUI = { cardHTML: cardHTML, planningHTML: planningHTML, settingsHTML: settingsHTML, start: start };
})(window.Lamia = window.Lamia || {});
