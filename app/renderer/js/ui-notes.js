/* ==========================================================================
   Plateforme de suivi - Lamia — notes rapides
   Un bloc-notes pour les réunions, appels et idées : la liste des notes à
   gauche (recherche, épinglées en haut), l'éditeur à droite. Tout s'enregistre
   pendant la frappe. Une ligne (ou un passage sélectionné) devient une tâche
   d'un clic, ou avec Ctrl / Cmd + Entrée. Sur téléphone : la liste, puis la note.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var el = null, sel = null, query = '', timer = null, pending = null, mobileOpen = false;

  function small() { return window.matchMedia && window.matchMedia('(max-width: 899px)').matches; }
  function now() { return new Date(D.nowMs()); }
  function isoDay(iso) { var d = new Date(iso); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function hm(iso) { var d = new Date(iso); return d.getHours() + NB + 'h' + NB + ('0' + d.getMinutes()).slice(-2); }
  // « 14 h 30 » aujourd'hui, « hier », sinon « 12 nov. »
  function when(iso) {
    var day = isoDay(iso), today = D.today();
    if (day === today) return hm(iso);
    if (day === D.addDays(today, -1)) return 'Hier';
    return D.dayMonth(day);
  }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function firstLine(s) { var l = String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return l[0] || ''; }
  function titleOf(n) { return n.title.trim() || firstLine(n.body).slice(0, 80) || 'Note sans titre'; }
  function preview(n) {
    var lines = String(n.body || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!n.title.trim()) lines = lines.slice(1);
    return lines.map(function (x) { return x.replace(/^(?:[-*•–>]+|\[[ xX]?\])\s*/, ''); }).filter(Boolean).join(' · ').slice(0, 120);
  }

  function catOf(n) { return n.categoryId ? S.get().categories.filter(function (c) { return c.id === n.categoryId; })[0] || null : null; }
  function list() {
    var q = fold(query.trim());
    return S.notes().filter(function (n) { return !q || fold(n.title + '\n' + n.body).indexOf(q) >= 0; })
      .slice().sort(function (a, b) { return a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1; });
  }

  /* --- Rendu ------------------------------------------------------------------- */
  function itemHTML(n) {
    var c = catOf(n);
    return '<li><button type="button" class="note-item' + (n.id === sel ? ' is-active' : '') + '" data-note-open="' + n.id + '"' + (n.id === sel ? ' aria-current="true"' : '') + ' data-focus-key="note-' + n.id + '">' +
      '<span class="note-item__top">' + (n.pinned ? '<span class="note-item__pin" title="Épinglée">' + icon('flag') + '</span>' : '') +
        '<strong class="note-item__title">' + esc(titleOf(n)) + '</strong><span class="note-item__when">' + esc(when(n.updatedAt)) + '</span></span>' +
      '<span class="note-item__preview">' + (c ? U.catDot(c) + '<span class="note-item__cat">' + esc(c.name) + '</span>' : '') + esc(preview(n) || (c ? '' : 'Vide pour l’instant')) + '</span>' +
    '</button></li>';
  }
  function listHTML() {
    var l = list(), pinned = l.filter(function (n) { return n.pinned; }), rest = l.filter(function (n) { return !n.pinned; });
    if (!S.notes().length) return '<p class="notes-side__empty">Aucune note pour l’instant.</p>';
    if (!l.length) return '<p class="notes-side__empty">Aucune note ne contient « ' + esc(query.trim()) + ' ».</p>';
    return (pinned.length ? '<p class="notes-side__label">Épinglées</p><ul class="note-list" role="list">' + pinned.map(itemHTML).join('') + '</ul>' : '') +
      (rest.length ? (pinned.length ? '<p class="notes-side__label">Les autres</p>' : '') + '<ul class="note-list" role="list">' + rest.map(itemHTML).join('') + '</ul>' : '');
  }

  function catOptions(cur) {
    return '<option value="">Sans catégorie</option>' + S.get().categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === cur ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
  }

  function editorHTML(n) {
    if (!n) {
      return '<div class="empty-state notes-empty"><div class="empty-state__art">' + U.px('pencil', 3) + '</div>' +
        '<p class="empty-state__title">Une réunion, un appel, une idée ?</p>' +
        '<p class="empty-state__text">Ouvre une note et écris : tout s’enregistre tout seul. Une ligne peut devenir une tâche d’un clic.</p>' +
        '<div class="empty-state__actions"><button type="button" class="btn btn--primary" data-note-new data-focus-key="note-new-empty">' + icon('plus') + 'Nouvelle note</button></div></div>';
    }
    var created = new Date(n.createdAt);
    return '<div class="notes-editor__bar">' +
        (small() ? '<button type="button" class="btn btn--ghost btn--sm" data-note-back>' + icon('chevron-left') + 'Toutes les notes</button>' : '') +
        '<label class="sr-only" for="note-cat">Catégorie</label><select class="select select--sm notes-editor__cat" id="note-cat" data-note-cat data-focus-key="note-cat">' + catOptions(n.categoryId) + '</select>' +
        '<span class="notes-editor__status" data-note-status aria-live="polite">Enregistré</span>' +
        '<span class="notes-editor__tools">' +
          '<button type="button" class="btn btn--secondary btn--sm" data-note-task data-focus-key="note-task" title="Crée une tâche avec la ligne où se trouve le curseur (ou le texte sélectionné). Raccourci : Ctrl / Cmd + Entrée">' + icon('check') + 'Créer une tâche</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-note-pin aria-pressed="' + n.pinned + '" aria-label="' + (n.pinned ? 'Désépingler' : 'Épingler en haut de la liste') + '" title="' + (n.pinned ? 'Désépingler' : 'Épingler') + '" data-focus-key="note-pin">' + icon('flag') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-note-copy aria-label="Copier la note" title="Copier la note" data-focus-key="note-copy">' + icon('copy') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-note-del aria-label="Supprimer la note" title="Supprimer" data-focus-key="note-del">' + icon('trash') + '</button>' +
        '</span>' +
      '</div>' +
      '<label class="sr-only" for="note-title">Titre</label>' +
      '<input class="notes-editor__title" id="note-title" data-note-field="title" value="' + esc(n.title) + '" placeholder="Réunion du ' + esc(D.dayMonthLong(isoDay(n.createdAt))) + '" maxlength="200" autocomplete="off" data-focus-key="note-title">' +
      '<p class="notes-editor__meta">Créée le ' + esc(D.dayMonthLong(isoDay(n.createdAt))) + ' à ' + esc(hm(n.createdAt)) + (created.getTime() !== new Date(n.updatedAt).getTime() ? ' · modifiée ' + (isoDay(n.updatedAt) === D.today() ? 'à ' + esc(hm(n.updatedAt)) : 'le ' + esc(D.dayMonthLong(isoDay(n.updatedAt)))) : '') + '</p>' +
      '<label class="sr-only" for="note-body">Note</label>' +
      '<textarea class="notes-editor__body" id="note-body" data-note-field="body" placeholder="Participants, points abordés, décisions, à faire…&#10;&#10;Astuce : place le curseur sur une ligne puis « Créer une tâche » (ou Ctrl / Cmd + Entrée)." data-focus-key="note-body" spellcheck="true">' + esc(n.body) + '</textarea>';
  }

  function render() {
    if (!el) return;
    var n = sel ? S.note(sel) : null;
    if (!n) sel = null;
    var phone = small(), showEditor = !phone || mobileOpen;
    var html =
      '<header class="page-head' + (phone && mobileOpen && n ? ' sr-only' : '') + '"><div class="page-head__text"><p class="eyebrow">Productivité</p><h1 class="h1" id="h-notes" tabindex="-1">Notes</h1>' +
        '<p class="page-head__lead">Pour tes réunions, tes appels et tes idées. Tout s’enregistre pendant que tu écris.</p></div></header>' +
      '<div class="notes-layout' + (phone ? (mobileOpen && n ? ' is-editing' : ' is-listing') : '') + '">' +
        '<aside class="glass card notes-side" aria-label="Mes notes">' +
          '<button type="button" class="btn btn--primary notes-side__new" data-note-new data-focus-key="note-new">' + icon('plus') + 'Nouvelle note</button>' +
          '<label class="notes-search"><span class="sr-only">Chercher dans les notes</span>' + icon('search') +
            '<input class="input" type="search" data-note-search value="' + esc(query) + '" placeholder="Chercher…" autocomplete="off" data-focus-key="note-search"></label>' +
          '<div class="notes-side__list" data-note-list>' + listHTML() + '</div>' +
        '</aside>' +
        (showEditor ? '<section class="glass card notes-editor" aria-label="Note">' + editorHTML(n) + '</section>' : '') +
      '</div>';
    U.keepFocus(el, function () { el.innerHTML = html; });
    grow();
  }
  // Seule la liste est redessinée pendant la frappe (l'éditeur garde le curseur)
  function renderList() {
    var box = el && el.querySelector('[data-note-list]');
    if (box) box.innerHTML = listHTML();
  }
  function grow() {
    var t = el && el.querySelector('.notes-editor__body');
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = Math.max(t.scrollHeight + 2, small() ? 280 : 420) + 'px';
  }
  function status(txt) { var s = el && el.querySelector('[data-note-status]'); if (s) s.textContent = txt; }

  /* --- Enregistrement ---------------------------------------------------------- */
  function flush() {
    clearTimeout(timer);
    if (!pending) return;
    var p = pending; pending = null;
    if (S.note(p.id)) S.updateNote(p.id, p.patch, { typing: true });
    status('Enregistré');
  }
  function queue(field, value) {
    if (!sel) return;
    if (pending && pending.id !== sel) flush();
    pending = pending || { id: sel, patch: {} };
    pending.patch[field] = value;
    status('Enregistrement…');
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  }

  function open(id, focusBody) {
    flush();
    sel = id;
    mobileOpen = true;
    render();
    var f = el.querySelector(focusBody ? '.notes-editor__body' : '.notes-editor__title');
    // Sur téléphone, la note s'ouvre en haut de l'écran (bouton retour visible)
    if (small()) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (f) f.focus({ preventScroll: small() });
  }
  function create() {
    flush();
    var n = S.addNote({});
    query = '';
    open(n.id, false);
  }

  /* --- Ligne → tâche ----------------------------------------------------------- */
  function clean(line) {
    return line.replace(/^\s*(?:[-*•–>]+|\d+[.)]|\[[ xX]?\]|☐|☑|✓|todo\s*:|à faire\s*:)\s*/i, '').replace(/^\s*(?:\[[ xX]?\]|☐)\s*/, '').trim();
  }
  function taskFromCursor(btn) {
    var n = S.note(sel), t = el.querySelector('.notes-editor__body');
    if (!n || !t) return;
    var v = t.value, a = t.selectionStart || 0, z = t.selectionEnd || 0, text;
    if (z > a) text = v.slice(a, z);
    else { var s = v.lastIndexOf('\n', a - 1) + 1, e = v.indexOf('\n', a); text = v.slice(s, e < 0 ? v.length : e); }
    var lines = text.split('\n').map(clean).filter(Boolean);
    if (!lines.length) {
      U.toast({ kind: 'warning', icon: 'info', title: 'Rien à transformer', text: 'Place le curseur sur une ligne de la note (ou sélectionne un passage), puis recommence.', duration: 5000 });
      t.focus();
      return;
    }
    flush();
    var title = lines[0].slice(0, 200), more = lines.slice(1).join('\n');
    var task = S.createTask({ title: title, categoryId: catOf(n) ? n.categoryId : undefined, description: (more ? more + '\n\n' : '') + 'Depuis la note « ' + titleOf(n) + ' » du ' + D.dayMonthLong(isoDay(n.createdAt)) + '.' });
    U.toast({ kind: 'success', icon: 'check', title: 'Tâche créée', text: '« ' + title + ' » est dans « À faire ».', duration: 5000,
      actions: [{ label: 'Voir la tâche', fn: function () { if (L.drawer) L.drawer.open(task.id); } }] });
    if (btn !== t) t.focus();
  }

  function remove(btn) {
    flush();
    var n = S.note(sel);
    if (!n) return;
    var saved = S.removeNote(n.id);
    sel = null; mobileOpen = false;
    render();
    U.toast({ icon: 'trash', title: 'Note supprimée', text: titleOf(n), duration: 6000,
      actions: [{ label: 'Annuler', fn: function () { S.restoreNote(saved); sel = n.id; mobileOpen = true; render(); } }] });
    var f = el.querySelector('[data-note-new]'); if (f && btn) f.focus();
  }

  function copy() {
    flush();
    var n = S.note(sel);
    if (!n) return;
    var txt = (n.title.trim() ? n.title.trim() + '\n\n' : '') + n.body;
    var ok = function () { U.toast({ kind: 'success', icon: 'copy', title: 'Note copiée', text: 'Tu peux la coller dans un e-mail ou un message.', duration: 3000 }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback);
    else fallback();
    function fallback() {
      var t = el.querySelector('.notes-editor__body');
      if (!t) return;
      t.focus(); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { U.toast({ icon: 'info', title: 'Texte sélectionné', text: 'Copie-le avec Ctrl / Cmd + C.' }); }
    }
  }

  /* --- Montage ----------------------------------------------------------------- */
  function mount(node) {
    el = node;
    el.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-note-search')) { query = t.value; renderList(); return; }
      var f = t.getAttribute('data-note-field');
      if (f) { queue(f, t.value); if (f === 'body') grow(); }
    });
    el.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-note-cat') && sel) { flush(); S.updateNote(sel, { categoryId: e.target.value || null }, { keepDate: true, typing: true }); }
    });
    el.addEventListener('focusout', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-note-field')) flush(); });
    el.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains('notes-editor__body') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); taskFromCursor(t); return; }
      if (t.classList && t.classList.contains('notes-editor__title') && e.key === 'Enter') { e.preventDefault(); var b = el.querySelector('.notes-editor__body'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-note-new]'))) { create(); return; }
      if ((b = e.target.closest('[data-note-open]'))) { open(b.getAttribute('data-note-open'), true); return; }
      if (e.target.closest('[data-note-back]')) { flush(); mobileOpen = false; render(); return; }
      if ((b = e.target.closest('[data-note-task]'))) { taskFromCursor(b); return; }
      if ((b = e.target.closest('[data-note-pin]'))) { flush(); var n = S.note(sel); if (n) { S.updateNote(n.id, { pinned: !n.pinned }, { keepDate: true }); } return; }
      if (e.target.closest('[data-note-copy]')) { copy(); return; }
      if ((b = e.target.closest('[data-note-del]'))) { remove(b); return; }
    });
    S.subscribe(function (type, d) {
      if (type !== 'notes' && type !== 'reset' && type !== 'category') return;
      if (L.app.view() !== 'notes') { el.dataset.stale = '1'; return; }
      if (type === 'notes' && d.typing) { renderList(); return; }
      if (type === 'notes' && d.removed) return;
      render();
    });
    // Rien ne se perd si on quitte la page ou l'onglet pendant la frappe
    window.addEventListener('hashchange', flush);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { flush(); S.flush(); } });
    window.addEventListener('beforeunload', function () { flush(); });
    var mq = window.matchMedia && window.matchMedia('(max-width: 899px)');
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (L.app.view() === 'notes') render(); });
  }

  function show() {
    delete el.dataset.stale;
    if (!sel && !small()) { var l = list(); if (l.length) sel = l[0].id; }
    if (small() && !sel) mobileOpen = false;
    render();
  }

  L.notes = { create: function () { location.hash = 'notes'; setTimeout(create, 0); } };
  L.views = L.views || {};
  L.views.notes = { title: 'Notes', mount: mount, render: render, show: show };
})(window.Lamia = window.Lamia || {});
