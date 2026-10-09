/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · Suivi des tâches
   Kanban 4 colonnes (glisser-déposer HTML5 à la souris, au pointeur sur la
   poignée pour le tactile, et alternatives clavier : menu « Déplacer vers… »
   ou Alt + flèches), vue liste triable, filtres partagés et mémorisés.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q;
  var esc = U.esc, icon = U.icon, NB = D.NBSP;
  var el = null, drag = null;

  /* --- Filtres ------------------------------------------------------------ */
  function filters() { return S.get().settings.ui.filters; }

  function setFilter(patch) {
    S.setUI({ filters: Object.assign({}, filters(), patch) });
  }

  function toolbarHTML(mode) {
    var f = filters();
    var st = S.get();
    function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }
    var n = Q.activeFilterCount();
    return '<div class="glass filters" role="search" aria-label="Filtrer les tâches">' +
      '<div class="filters__row">' +
        '<div class="input-wrap filters__search">' + icon('search') +
          '<input type="search" class="input" data-filter="q" data-focus-key="f-q" value="' + esc(f.q) + '" placeholder="Rechercher une tâche, un client, une étiquette…" aria-label="Rechercher une tâche"></div>' +
        '<div class="filters__cats" role="group" aria-label="Catégories">' +
          st.categories.map(function (c) {
            return '<button type="button" class="chip chip--cat ' + U.hue(c) + '" data-filter-cat="' + c.id + '" data-focus-key="fc-' + c.id + '" aria-pressed="' + (f.categories.indexOf(c.id) >= 0) + '">' + esc(c.name) + '</button>';
          }).join('') + '</div>' +
      '</div>' +
      '<div class="filters__row filters__row--selects">' +
        '<label class="filters__select"><span class="filters__label">Priorité</span><select class="select select--sm" data-filter="priority" data-focus-key="f-prio">' +
          opt('', 'Toutes', f.priority) + Q.PRIORITIES.slice().reverse().map(function (p) { return opt(p.id, p.label, f.priority); }).join('') + '</select></label>' +
        '<label class="filters__select"><span class="filters__label">Étiquette</span><select class="select select--sm" data-filter="tag" data-focus-key="f-tag">' +
          opt('', 'Toutes', f.tag) + Q.allTags().map(function (g) { return opt(g, '# ' + g, f.tag); }).join('') + '</select></label>' +
        '<label class="filters__select"><span class="filters__label">Client</span><select class="select select--sm" data-filter="client" data-focus-key="f-client">' +
          opt('', 'Tous', f.client) + Q.allClients().map(function (c) { return opt(c, c, f.client); }).join('') + '</select></label>' +
        '<label class="filters__select"><span class="filters__label">Échéance</span><select class="select select--sm" data-filter="due" data-focus-key="f-due">' +
          opt('', 'Toutes', f.due) + opt('week', 'Cette semaine', f.due) + opt('month', 'Ce mois-ci', f.due) + opt('late', 'À replanifier', f.due) + opt('none', 'Sans date', f.due) + '</select></label>' +
        (mode === 'list' ? '<label class="filters__select"><span class="filters__label">Statut</span><select class="select select--sm" data-filter="status" data-focus-key="f-status">' +
          opt('', 'Tous', f.status) + Q.STATUS.map(function (s) { return opt(s.id, s.label, f.status); }).join('') + '</select></label>' : '') +
        (mode === 'list' ? '<label class="filters__select filters__select--sort"><span class="filters__label">Trier par</span><select class="select select--sm" data-sort-select data-focus-key="f-sort">' +
          SORTS.map(function (s) { return opt(s[0], s[1], st.settings.ui.sort.key); }).join('') + '</select></label>' : '') +
        '<button type="button" class="btn btn--ghost btn--sm filters__clear" data-filter-clear' + (n ? '' : ' hidden') + '>' + icon('close') + 'Effacer les filtres</button>' +
      '</div></div>';
  }

  /* --- Carte du kanban ----------------------------------------------------- */
  function cardHTML(t) {
    var c = S.category(t.categoryId);
    var done = t.checklist.filter(function (x) { return x.done; }).length;
    var mins = Q.taskMinutes(t, null, null, true);
    var tm = S.get().activeTimer;
    var timing = tm && tm.taskId === t.id;
    var d = U.due(t);
    var label = t.title + ', ' + c.name + ', priorité ' + Q.prioLabel(t.priority).toLowerCase() + (d ? ', ' + d.long : '') + ', avancement ' + t.progress + ' %';
    return '<div class="glass glass--nested glass--interactive task-card' + (t.status === 'done' ? ' task-card--done' : '') + (timing ? ' is-timing' : '') + '" ' +
      'role="listitem" tabindex="0" draggable="true" data-id="' + t.id + '" data-focus-key="card-' + t.id + '" aria-label="' + esc(label) + '" aria-describedby="kanban-help">' +
      '<span class="task-card__grip" data-grip aria-hidden="true" title="Glisser pour déplacer">' + icon('grip') + '</span>' +
      '<div class="task-card__top">' + U.catChip(c) + (t.priority !== 'normal' ? U.prio(t.priority) : '') +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm task-card__menu" data-card-menu data-focus-key="menu-' + t.id + '" aria-haspopup="menu" aria-expanded="false" aria-label="Actions pour « ' + esc(t.title) + ' » : ouvrir, déplacer vers…">' + icon('more') + '</button>' +
      '</div>' +
      '<h3 class="task-card__title">' + esc(t.title) + '</h3>' +
      (t.client ? '<p class="task-card__client">' + icon('briefcase') + '<span>' + esc(t.client) + '</span></p>' : '') +
      (t.tags.length ? '<div class="task-card__tags">' + U.tags(t.tags, 3) + '</div>' : '') +
      (t.status !== 'done' && (t.status !== 'todo' || t.progress > 0) ? '<div class="task-card__progress"><span class="task-card__pct num">' + t.progress + NB + '%</span>' + U.progress(t.progress, 'progress--sm') + '</div>' : '') +
      '<div class="task-card__foot">' +
        (t.checklist.length ? '<span class="task-card__meta" title="Checklist">' + icon('checklist') + '<span class="num">' + done + '/' + t.checklist.length + '</span><span class="sr-only"> sous-tâches faites</span></span>' : '') +
        (mins || timing ? '<span class="task-card__meta" title="Heures passées">' + icon('clock') + '<span class="num">' + D.duration(mins, { compact: true }) + '</span><span class="sr-only"> passées</span></span>' : '') +
        (timing ? '<span class="task-card__live"><span class="chrono__live' + (tm.pausedAt ? ' is-paused' : '') + '" aria-hidden="true"></span><span class="num" data-timer-elapsed>' + D.clock(L.chrono.elapsed()) + '</span></span>' : '') +
        (t.status === 'done'
          ? '<span class="task-card__due task-card__done">' + icon('check') + (t.completedAt ? 'Terminée le ' + esc(D.dayMonth(t.completedAt)) : 'Terminée') + '</span>'
          : '<span class="task-card__due">' + U.dueBadge(t) + '</span>') +
      '</div></div>';
  }

  function columnEmpty(status, filtered) {
    if (filtered) return '<p class="kanban__empty">Aucune tâche ne correspond aux filtres ici.</p>';
    return '<p class="kanban__empty">' + {
      todo: 'Rien en attente. Une idée ? Le bouton + est là pour ça.',
      doing: 'Glisse ici la tâche du moment.',
      review: 'Rien chez le client pour l’instant.',
      done: 'Les victoires du jour arriveront ici.'
    }[status] + '</p>';
  }

  function kanbanHTML() {
    var visible = Q.filtered();
    var ids = {};
    visible.forEach(function (t) { ids[t.id] = 1; });
    var anyFilter = Q.activeFilterCount() > 0;
    return '<div class="kanban" data-kanban>' + Q.STATUS.map(function (s) {
      var all = S.column(s.id);
      var list = all.filter(function (t) { return ids[t.id]; });
      return '<section class="glass kanban__col kanban__col--' + s.id + '" data-status="' + s.id + '" aria-labelledby="col-' + s.id + '">' +
        '<header class="kanban__head"><h2 class="kanban__title" id="col-' + s.id + '"><span class="chip chip--' + s.id + '">' + esc(s.label) + '</span></h2>' +
          '<span class="kanban__count num" aria-label="' + list.length + ' tâche' + (list.length > 1 ? 's' : '') + '">' + list.length + (anyFilter && list.length !== all.length ? '<span class="text-subtle">/' + all.length + '</span>' : '') + '</span>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm kanban__add" data-add-in="' + s.id + '" aria-label="Nouvelle tâche dans « ' + esc(s.label) + ' »">' + icon('plus') + '</button></header>' +
        '<div class="kanban__list" data-drop="' + s.id + '" role="list" aria-labelledby="col-' + s.id + '">' +
          (list.length ? list.map(cardHTML).join('') : columnEmpty(s.id, anyFilter)) + '</div>' +
      '</section>';
    }).join('') + '</div>' +
    '<p class="kbd-help kbd-help--touch">Astuce : maintiens la poignée en haut d’une carte pour la glisser, ou touche ⋯ puis « Déplacer vers… ».</p>' +
    '<p class="kbd-help kbd-help--desk" id="kanban-help">Astuce : glisse une carte d’une colonne à l’autre, ou au clavier : <span class="kbd">Entrée</span> ouvre le détail, <span class="kbd">Alt</span> + <span class="kbd">←</span> <span class="kbd">→</span> change de colonne, <span class="kbd">Alt</span> + <span class="kbd">↑</span> <span class="kbd">↓</span> change l’ordre. Le menu ⋯ propose aussi « Déplacer vers… ».</p>';
  }

  /* --- Vue liste ----------------------------------------------------------- */
  var SORTS = [['title', 'Titre'], ['category', 'Catégorie'], ['status', 'Statut'], ['priority', 'Priorité'], ['endDate', 'Échéance'], ['progress', 'Avancement'], ['hours', 'Heures']];
  var STATUS_RANK = { todo: 0, doing: 1, review: 2, done: 3 };

  function sortTasks(list) {
    var s = S.get().settings.ui.sort;
    var dir = s.dir === 'desc' ? -1 : 1;
    var val = {
      title: function (t) { return t.title.toLowerCase(); },
      category: function (t) { return S.category(t.categoryId).name.toLowerCase(); },
      status: function (t) { return STATUS_RANK[t.status]; },
      priority: function (t) { return Q.PRIO_RANK[t.priority]; },
      endDate: function (t) { return t.endDate || '9999'; },
      progress: function (t) { return t.progress; },
      hours: function (t) { return Q.taskMinutes(t, null, null, true); }
    }[s.key] || function (t) { return t.title; };
    return list.slice().sort(function (a, b) {
      // Par échéance, les tâches terminées passent après celles qui restent à faire
      if (s.key === 'endDate' && (a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
      var x = val(a), y = val(b);
      if (typeof x === 'string') { var c = x.localeCompare(y, 'fr'); if (c) return c * dir; }
      else if (x !== y) return (x < y ? -1 : 1) * dir;
      return a.title.localeCompare(b.title, 'fr');
    });
  }

  function listHTML() {
    var rows = sortTasks(Q.filtered());
    var s = S.get().settings.ui.sort;
    function th(key, label, cls) {
      var sorted = s.key === key;
      return '<th scope="col" class="' + (cls || '') + '" aria-sort="' + (sorted ? (s.dir === 'desc' ? 'descending' : 'ascending') : 'none') + '">' +
        '<button type="button" class="th-sort' + (sorted ? ' is-sorted' : '') + '" data-sort="' + key + '" data-focus-key="sort-' + key + '">' + esc(label) +
        '<span class="th-sort__icon">' + icon(sorted ? (s.dir === 'desc' ? 'arrow-down' : 'arrow-up') : 'sort') + '</span></button></th>';
    }
    if (!rows.length) return S.get().tasks.length ? emptyFiltered() : emptyNone();
    return '<section class="glass card list-card" aria-label="Liste des tâches"><div class="table-scroll"><table class="task-table">' +
      '<caption class="sr-only">Tâches, triées par ' + esc((SORTS.filter(function (x) { return x[0] === s.key; })[0] || [])[1] || '') + '. Les en-têtes de colonnes permettent de trier.</caption>' +
      '<thead><tr>' + th('title', 'Tâche', 'col-title') + th('category', 'Catégorie') + th('status', 'Statut') + th('priority', 'Priorité') +
        th('endDate', 'Échéance') + th('progress', 'Avancement', 'col-progress') + th('hours', 'Heures', 'col-num') + '</tr></thead><tbody>' +
      rows.map(function (t) {
        var c = S.category(t.categoryId);
        var mins = Q.taskMinutes(t, null, null, true);
        return '<tr data-row="' + t.id + '"' + (t.status === 'done' ? ' class="is-done"' : '') + '>' +
          '<td class="col-title"><button type="button" class="row-title" data-open-task="' + t.id + '" data-focus-key="row-' + t.id + '">' + esc(t.title) + '</button>' +
            '<span class="row-sub">' + (t.client ? esc(t.client) : '') + (t.tags.length ? (t.client ? ' · ' : '') + t.tags.map(function (g) { return '#' + esc(g); }).join(' ') : '') + '</span></td>' +
          '<td data-label="Catégorie">' + U.catChip(c) + '</td>' +
          '<td data-label="Statut">' + U.statusChip(t.status) + '</td>' +
          '<td data-label="Priorité">' + U.prio(t.priority) + '</td>' +
          '<td data-label="Échéance">' + (t.endDate ? U.dueBadge(t) : '<span class="text-subtle text-sm">Sans date</span>') + '</td>' +
          '<td data-label="Avancement" class="col-progress"><span class="cell-progress"><span class="num">' + t.progress + NB + '%</span>' + U.progress(t.progress, 'progress--sm' + (t.status === 'done' ? ' progress--success' : '')) + '</span></td>' +
          '<td data-label="Heures" class="col-num num">' + (mins ? D.duration(mins, { compact: true }) : '<span class="text-subtle">—</span>') + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function emptyNone() {
    return '<section class="glass card"><div class="empty-state"><div class="empty-state__art">' + icon('tasks') + '</div>' +
      '<p class="empty-state__title">Pas encore de tâche</p><p class="empty-state__text">Crée la première : seul le titre est obligatoire.</p>' +
      '<div class="empty-state__actions"><button type="button" class="btn btn--primary btn--sm" data-action="new-task">' + icon('plus') + 'Nouvelle tâche</button></div></div></section>';
  }

  function emptyFiltered() {
    return '<section class="glass card"><div class="empty-state"><div class="empty-state__art">' + icon('search') + '</div>' +
      '<p class="empty-state__title">Aucune tâche ne correspond</p><p class="empty-state__text">Les filtres sont peut-être un peu trop exigeants. On les relâche ?</p>' +
      '<div class="empty-state__actions"><button type="button" class="btn btn--secondary btn--sm" data-filter-clear>' + icon('close') + 'Effacer les filtres</button>' +
      '<button type="button" class="btn btn--primary btn--sm" data-action="new-task">' + icon('plus') + 'Nouvelle tâche</button></div></div></section>';
  }

  /* --- Rendu --------------------------------------------------------------- */
  function render() {
    if (!el) return;
    var st = S.get();
    var mode = st.settings.ui.tasksView || 'kanban';
    var total = st.tasks.length;
    var visible = Q.filtered().length;
    var doing = S.column('doing').length;
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">' + U.plural(total, 'tâche') + ' · ' + doing + ' en cours</p>' +
        '<h1 class="h1" id="h-tasks" tabindex="-1">Suivi des tâches</h1></div>' +
        '<div class="page-head__actions">' +
          '<div class="segmented" role="group" aria-label="Affichage des tâches">' +
            '<button type="button" class="segmented__item" data-mode="kanban" data-focus-key="mode-k" aria-pressed="' + (mode === 'kanban') + '">' + icon('kanban') + 'Kanban</button>' +
            '<button type="button" class="segmented__item" data-mode="list" data-focus-key="mode-l" aria-pressed="' + (mode === 'list') + '">' + icon('list') + 'Liste</button></div>' +
          '<button type="button" class="btn btn--primary" data-action="new-task">' + icon('plus') + 'Nouvelle tâche</button></div></header>' +
      toolbarHTML(mode) +
      '<p class="filters__count" aria-live="polite">' + (visible === total ? 'Toutes les tâches sont affichées.' : U.plural(visible, 'tâche') + ' sur ' + total + ' correspond' + (visible > 1 ? 'ent' : '') + ' aux filtres.') + '</p>' +
      (mode === 'list' ? listHTML() : kanbanHTML());
    var scrollers = U.$$('.kanban__list', el).map(function (x) { return x.scrollTop; });
    var hscroll = el.querySelector('.kanban') ? el.querySelector('.kanban').scrollLeft : 0;
    U.keepFocus(el, function () { el.innerHTML = html; });
    U.$$('.kanban__list', el).forEach(function (x, i) { x.scrollTop = scrollers[i] || 0; });
    if (el.querySelector('.kanban')) el.querySelector('.kanban').scrollLeft = hscroll;
    U.typo(el);
  }

  /* --- Déplacements -------------------------------------------------------- */
  function moveTo(id, status, index, how) {
    var t = S.task(id);
    if (!t) return;
    var prev = t.status;
    S.moveTask(id, status, index);
    var pos = S.column(status).indexOf(t) + 1;
    U.announce('« ' + t.title + ' » déplacée vers ' + Q.statusLabel(status) + ', position ' + pos + ' sur ' + S.column(status).length + '.');
    if (status !== prev) {
      L.drawer.afterStatus(t, prev);
      if (how !== 'drag' && status !== 'done') U.toast({ icon: 'arrow-right', title: 'Déplacée vers ' + Q.statusLabel(status), text: '« ' + t.title + ' »', duration: 3000 });
    }
    setTimeout(function () { var c = el.querySelector('[data-focus-key="card-' + id + '"]'); if (c && how === 'key') c.focus(); }, 0);
  }

  function cardMenu(btn) {
    var id = btn.closest('[data-id]').getAttribute('data-id');
    var t = S.task(id);
    var tm = S.get().activeTimer;
    var col = S.column(t.status);
    var i = col.indexOf(t);
    var items = [
      { label: 'Ouvrir le détail', icon: 'eye', onSelect: function () { L.drawer.open(id, { returnTo: btn }); } },
      { separator: true }, { heading: 'Déplacer vers…' }
    ];
    Q.STATUS.forEach(function (s) {
      items.push({ label: s.label, checked: s.id === t.status, disabled: s.id === t.status, onSelect: function () { moveTo(id, s.id, 0, 'menu'); focusCardSoon(id); } });
    });
    items.push({ separator: true });
    items.push({ label: 'Monter d’un cran', icon: 'arrow-up', disabled: i === 0, onSelect: function () { moveTo(id, t.status, i - 1, 'menu'); focusCardSoon(id); } });
    items.push({ label: 'Descendre d’un cran', icon: 'arrow-down', disabled: i === col.length - 1, onSelect: function () { moveTo(id, t.status, i + 1, 'menu'); focusCardSoon(id); } });
    items.push({ separator: true });
    if (t.status !== 'done') {
      items.push(tm && tm.taskId === id
        ? { label: 'Arrêter le chrono', icon: 'stop', onSelect: function () { L.chrono.stop(); } }
        : { label: 'Démarrer le chrono', icon: 'play', onSelect: function () { L.chrono.start(id); } });
    }
    items.push({ label: 'Supprimer', icon: 'trash', danger: true, onSelect: function () { L.drawer.remove(id); } });
    U.openMenu(btn, items, { label: 'Actions pour « ' + t.title + ' »' });
  }

  function focusCardSoon(id) {
    setTimeout(function () { var c = el.querySelector('[data-focus-key="card-' + id + '"]'); if (c) { c.focus(); c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }, 30);
  }

  function keyMove(card, e) {
    var id = card.getAttribute('data-id');
    var t = S.task(id);
    var order = Q.STATUS.map(function (s) { return s.id; });
    var ci = order.indexOf(t.status);
    var col = S.column(t.status);
    var i = col.indexOf(t);
    if (e.key === 'ArrowRight' && ci < 3) moveTo(id, order[ci + 1], 0, 'key');
    else if (e.key === 'ArrowLeft' && ci > 0) moveTo(id, order[ci - 1], 0, 'key');
    else if (e.key === 'ArrowUp' && i > 0) moveTo(id, t.status, i - 1, 'key');
    else if (e.key === 'ArrowDown' && i < col.length - 1) moveTo(id, t.status, i + 1, 'key');
    else return;
    focusCardSoon(id);
  }

  /* --- Glisser-déposer : souris (HTML5) ------------------------------------ */
  function marker() {
    var m = el.querySelector('.drop-marker');
    if (!m) { m = document.createElement('div'); m.className = 'drop-marker'; m.setAttribute('aria-hidden', 'true'); }
    return m;
  }

  function indexAt(list, y) {
    var cards = U.$$('.task-card', list).filter(function (c) { return !drag || c.getAttribute('data-id') !== drag.id; });
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return { index: i, before: cards[i] };
    }
    return { index: cards.length, before: null };
  }

  function placeMarker(list, y) {
    var at = indexAt(list, y);
    var m = marker();
    var empty = list.querySelector('.kanban__empty');
    if (empty) empty.hidden = true;
    if (at.before) list.insertBefore(m, at.before); else list.appendChild(m);
    U.$$('.kanban__col', el).forEach(function (c) { c.classList.toggle('is-drop-target', c.contains(list)); });
    drag.target = { status: list.getAttribute('data-drop'), index: at.index };
  }

  function clearDrag() {
    var m = el && el.querySelector('.drop-marker');
    if (m) m.remove();
    if (el) {
      U.$$('.kanban__empty', el).forEach(function (x) { x.hidden = false; });
      U.$$('.is-drop-target', el).forEach(function (x) { x.classList.remove('is-drop-target'); });
      U.$$('.is-dragging', el).forEach(function (x) { x.classList.remove('is-dragging'); });
    }
    document.documentElement.classList.remove('is-dragging-card');
  }

  function finishDrop() {
    var d = drag;
    clearDrag();
    drag = null;
    if (d && d.target) moveTo(d.id, d.target.status, d.target.index, 'drag');
  }

  function bindDnD() {
    el.addEventListener('dragstart', function (e) {
      var card = e.target.closest && e.target.closest('.task-card');
      if (!card) return;
      drag = { id: card.getAttribute('data-id'), target: null };
      try { e.dataTransfer.setData('text/plain', drag.id); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* rien */ }
      document.documentElement.classList.add('is-dragging-card');
      setTimeout(function () { card.classList.add('is-dragging'); }, 0);
      L.ui.closeMenu(false);
    });
    el.addEventListener('dragover', function (e) {
      if (!drag) return;
      var list = e.target.closest && (e.target.closest('.kanban__list') || (e.target.closest('.kanban__col') && e.target.closest('.kanban__col').querySelector('.kanban__list')));
      if (!list) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* rien */ }
      placeMarker(list, e.clientY);
    });
    el.addEventListener('drop', function (e) {
      if (!drag) return;
      e.preventDefault();
      finishDrop();
    });
    el.addEventListener('dragend', function () { if (drag) { clearDrag(); drag = null; } });
  }

  /* --- Glisser-déposer : pointeur (tactile, stylet) sur la poignée --------- */
  function bindPointerDrag() {
    el.addEventListener('pointerdown', function (e) {
      var grip = e.target.closest('[data-grip]');
      if (!grip || e.pointerType === 'mouse') return;
      var card = grip.closest('.task-card');
      e.preventDefault();
      var r = card.getBoundingClientRect();
      var ghost = card.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.removeAttribute('data-focus-key');
      ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      drag = { id: card.getAttribute('data-id'), target: null, ghost: ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, pointer: e.pointerId };
      card.classList.add('is-dragging');
      document.documentElement.classList.add('is-dragging-card');
      moveGhost(e);
      grip.setPointerCapture(e.pointerId);
      grip.addEventListener('pointermove', onMove);
      grip.addEventListener('pointerup', onUp);
      grip.addEventListener('pointercancel', onCancel);
      function onMove(ev) { moveGhost(ev); }
      function cleanup() {
        grip.removeEventListener('pointermove', onMove);
        grip.removeEventListener('pointerup', onUp);
        grip.removeEventListener('pointercancel', onCancel);
        if (drag && drag.ghost) drag.ghost.remove();
      }
      function onUp() { cleanup(); finishDrop(); }
      function onCancel() { cleanup(); clearDrag(); drag = null; }
    });
  }

  function moveGhost(e) {
    if (!drag || !drag.ghost) return;
    drag.ghost.style.transform = 'translate(' + (e.clientX - drag.dx) + 'px,' + (e.clientY - drag.dy) + 'px) rotate(-1.5deg)';
    var under = document.elementFromPoint(e.clientX, e.clientY);
    var col = under && under.closest && under.closest('.kanban__col');
    if (col) placeMarker(col.querySelector('.kanban__list'), e.clientY);
    // Défilement automatique du kanban (mobile) près des bords
    var k = el.querySelector('.kanban');
    if (k) {
      var kr = k.getBoundingClientRect();
      if (e.clientX > kr.right - 40) k.scrollLeft += 12;
      else if (e.clientX < kr.left + 40) k.scrollLeft -= 12;
    }
  }

  /* --- Montage ------------------------------------------------------------- */
  function mount(node) {
    el = node;
    bindDnD();
    bindPointerDrag();

    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-card-menu]'))) { e.stopPropagation(); cardMenu(b); return; }
      if ((b = e.target.closest('[data-mode]'))) { S.setUI({ tasksView: b.getAttribute('data-mode') }); return; }
      if ((b = e.target.closest('[data-filter-cat]'))) {
        var id = b.getAttribute('data-filter-cat');
        var cats = filters().categories.slice();
        var k = cats.indexOf(id);
        if (k >= 0) cats.splice(k, 1); else cats.push(id);
        setFilter({ categories: cats });
        return;
      }
      if (e.target.closest('[data-filter-clear]')) {
        S.setUI({ filters: { q: '', categories: [], priority: '', tag: '', client: '', status: '', due: '' } });
        setTimeout(function () { var q = el.querySelector('[data-filter="q"]'); if (q) q.focus(); }, 0);
        return;
      }
      if ((b = e.target.closest('[data-sort]'))) {
        var key = b.getAttribute('data-sort');
        var s = S.get().settings.ui.sort;
        S.setUI({ sort: { key: key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' } });
        return;
      }
      if ((b = e.target.closest('[data-add-in]'))) { L.taskForm.open({ status: b.getAttribute('data-add-in'), returnTo: b }); return; }
      var card = e.target.closest('.task-card');
      if (card && !e.target.closest('button, a')) { L.drawer.open(card.getAttribute('data-id'), { returnTo: card }); return; }
      var row = e.target.closest('[data-row]');
      if (row && !e.target.closest('button, a')) L.drawer.open(row.getAttribute('data-row'), { returnTo: row.querySelector('.row-title') });
    });

    el.addEventListener('keydown', function (e) {
      var card = e.target.classList && e.target.classList.contains('task-card') ? e.target : null;
      if (!card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); L.drawer.open(card.getAttribute('data-id'), { returnTo: card }); return; }
      if (e.altKey && /^Arrow/.test(e.key)) { e.preventDefault(); keyMove(card, e); return; }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); cardMenu(card.querySelector('[data-card-menu]')); }
    });

    var onSearch = U.debounce(function (v) { setFilter({ q: v }); }, 180);
    el.addEventListener('input', function (e) {
      if (e.target.getAttribute('data-filter') === 'q') onSearch(e.target.value);
    });
    el.addEventListener('change', function (e) {
      var f = e.target.getAttribute('data-filter');
      if (f && f !== 'q') { var p = {}; p[f] = e.target.value; setFilter(p); }
      if (e.target.hasAttribute('data-sort-select')) S.setUI({ sort: { key: e.target.value, dir: 'asc' } });
    });

    S.subscribe(function (type, d) {
      if (L.app.view() !== 'tasks') { el.dataset.stale = '1'; return; }
      if (drag) return;
      if (type === 'ui' && !(d.filters || d.tasksView || d.sort)) return;
      if (type === 'mood') return;
      render();
    });
  }

  function show() { if (!el.firstChild || el.dataset.stale) { delete el.dataset.stale; render(); } }

  L.views = L.views || {};
  L.views.tasks = { mount: mount, render: render, show: show, moveTo: moveTo, title: 'Suivi des tâches' };
})(window.Lamia = window.Lamia || {});
