/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · tiroir de détail / édition
   Tous les champs d'une tâche, enregistrés au fil de l'eau (pas de bouton
   « Enregistrer »). Heures : chrono start/stop + saisie manuelle
   (date + durée + note), entrées modifiables et supprimables.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q;
  var esc = U.esc, icon = U.icon;
  var ov = null, current = null, root = null, showAllEntries = false, editingEntry = null, opener = null, removing = null;

  function t() { return current && S.task(current); }

  /* --- Gabarits ----------------------------------------------------------- */
  function timerBlock(task) {
    var tm = S.get().activeTimer;
    var mine = tm && tm.taskId === task.id;
    var total = Q.taskMinutes(task, null, null, false);
    var week = Q.taskMinutes(task, D.startOfWeek(D.today()), D.endOfWeek(D.today()), false);
    var head = '<div class="hours-hero__figures"><div><span class="hours-hero__value num">' + D.duration(total) + '</span><span class="hours-hero__label">au total</span></div>' +
      '<div><span class="hours-hero__value hours-hero__value--sm num">' + D.duration(week) + '</span><span class="hours-hero__label">cette semaine</span></div></div>';
    var ctl;
    if (mine) {
      var paused = !!tm.pausedAt;
      ctl = '<div class="hours-hero__live"><span class="chrono__live' + (paused ? ' is-paused' : '') + '" aria-hidden="true"></span>' +
        '<span class="hours-hero__clock num" role="timer" aria-label="Temps écoulé" data-timer-elapsed>' + D.clock(L.chrono.elapsed()) + '</span></div>' +
        '<div class="hours-hero__actions">' + (paused
          ? '<button type="button" class="btn btn--soft btn--sm" data-chrono="resume" data-focus-key="dr-toggle">' + icon('play') + 'Reprendre</button>'
          : '<button type="button" class="btn btn--soft btn--sm" data-chrono="pause" data-focus-key="dr-toggle">' + icon('pause') + 'Pause</button>') +
        '<button type="button" class="btn btn--primary btn--sm" data-chrono="stop" data-focus-key="dr-start">' + icon('stop') + 'Stop et enregistrer</button></div>';
    } else {
      ctl = '<div class="hours-hero__actions"><button type="button" class="btn btn--primary" data-chrono="start" data-task="' + task.id + '" data-focus-key="dr-start"' + (task.status === 'done' ? ' disabled' : '') + '>' + icon('play') + 'Démarrer le chrono</button></div>' +
        (tm ? '<p class="hint">Le chrono en cours sur une autre tâche sera arrêté et enregistré.</p>' : '');
    }
    return '<div class="glass glass--nested hours-hero">' + head + ctl + '</div>';
  }

  function checklistHTML(task) {
    var done = task.checklist.filter(function (c) { return c.done; }).length;
    var n = task.checklist.length;
    var items = task.checklist.map(function (c, i) {
      return '<li class="checklist__item" data-cid="' + c.id + '">' +
        '<label class="checkbox checkbox--strike"><input class="checkbox__input" type="checkbox" data-check-toggle data-focus-key="ck-' + c.id + '"' + (c.done ? ' checked' : '') + '>' +
          '<span class="checkbox__box" aria-hidden="true"></span><span class="checkbox__label">' + esc(c.label) + '</span></label>' +
        '<span class="checklist__tools">' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-check-move="-1" data-focus-key="up-' + c.id + '" aria-label="Monter « ' + esc(c.label) + ' »"' + (i === 0 ? ' disabled' : '') + '>' + icon('chevron-up') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-check-move="1" data-focus-key="down-' + c.id + '" aria-label="Descendre « ' + esc(c.label) + ' »"' + (i === n - 1 ? ' disabled' : '') + '>' + icon('chevron-down') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-check-remove aria-label="Supprimer « ' + esc(c.label) + ' »">' + icon('trash') + '</button>' +
        '</span></li>';
    }).join('');
    return '<div class="section-head"><h3 class="section-title">' + icon('checklist') + 'Checklist</h3>' +
        (n ? '<span class="section-meta num">' + done + ' sur ' + n + '</span>' : '') + '</div>' +
      (n ? '<span class="progress progress--sm progress--success" style="--value:' + Math.round(done / n * 100) + '" aria-hidden="true"></span>' : '') +
      (n ? '<ul class="checklist" role="list">' + items + '</ul>' : '<p class="empty-line">Pas encore de sous-tâches. Découper, c’est déjà avancer.</p>') +
      '<form class="inline-add" data-check-add><label class="sr-only" for="dr-check-new">Nouvelle sous-tâche</label>' +
        '<input class="input" id="dr-check-new" data-focus-key="check-new" placeholder="Ajouter une sous-tâche…" autocomplete="off">' +
        '<button type="submit" class="btn btn--soft btn--icon" aria-label="Ajouter la sous-tâche">' + icon('plus') + '</button></form>';
  }

  function entryRow(task, e) {
    if (editingEntry === e.id) {
      return '<li class="entry entry--edit" data-eid="' + e.id + '"><form class="entry-form" data-entry-save>' +
        '<div class="field"><label class="label" for="ee-date">Date</label><input class="input" type="date" id="ee-date" name="date" value="' + e.date + '"></div>' +
        '<div class="field"><label class="label" for="ee-dur">Durée</label><input class="input" id="ee-dur" name="dur" value="' + esc(D.duration(e.minutes).replace(/ /g, '')) + '" autocomplete="off"></div>' +
        '<div class="field entry-form__note"><label class="label" for="ee-note">Note</label><input class="input" id="ee-note" name="note" value="' + esc(e.note) + '"></div>' +
        '<div class="entry-form__actions"><button type="button" class="btn btn--ghost btn--sm" data-entry-cancel>Annuler</button><button type="submit" class="btn btn--primary btn--sm">Enregistrer</button></div>' +
        '</form></li>';
    }
    return '<li class="entry" data-eid="' + e.id + '">' +
      '<span class="entry__src" title="' + (e.source === 'timer' ? 'Chrono' : 'Saisie manuelle') + '">' + icon(e.source === 'timer' ? 'timer' : 'edit') + '<span class="sr-only">' + (e.source === 'timer' ? 'Chrono' : 'Saisie manuelle') + '</span></span>' +
      '<span class="entry__date">' + esc(D.cap(D.short(e.date))) + '</span>' +
      '<span class="entry__note">' + esc(e.note || (e.source === 'timer' ? 'Chrono' : '—')) + '</span>' +
      '<span class="entry__dur num">' + D.duration(e.minutes) + '</span>' +
      '<span class="entry__tools">' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-entry-edit data-focus-key="ee-' + e.id + '" aria-label="Modifier l’entrée du ' + esc(D.short(e.date)) + '">' + icon('edit') + '</button>' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-entry-remove aria-label="Supprimer l’entrée du ' + esc(D.short(e.date)) + '">' + icon('trash') + '</button>' +
      '</span></li>';
  }

  function hoursHTML(task) {
    var entries = task.timeEntries.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var shown = showAllEntries ? entries : entries.slice(0, 5);
    return '<div class="section-head"><h3 class="section-title" id="dr-hours">' + icon('clock') + 'Heures</h3>' +
        '<span class="section-meta">' + U.plural(entries.length, 'entrée') + '</span></div>' +
      timerBlock(task) +
      '<form class="manual-entry" data-entry-add>' +
        '<p class="manual-entry__title">Ajouter du temps à la main</p>' +
        '<div class="manual-entry__grid">' +
          '<div class="field"><label class="label" for="me-date">Date</label><input class="input" type="date" id="me-date" name="date" value="' + D.today() + '"></div>' +
          '<div class="field" data-me-dur><label class="label" for="me-dur">Durée</label><input class="input" id="me-dur" name="dur" placeholder="1h30" autocomplete="off" aria-describedby="me-dur-hint"></div>' +
          '<div class="field manual-entry__note"><label class="label" for="me-note">Note <span class="label__optional">facultatif</span></label><input class="input" id="me-note" name="note" placeholder="Ex. Retours client" autocomplete="off"></div>' +
          '<button type="submit" class="btn btn--secondary manual-entry__btn">' + icon('plus') + 'Ajouter</button>' +
        '</div>' +
        '<p class="hint" id="me-dur-hint" data-me-hint>« 1h30 », « 90 » ou « 1,5 » : comme tu préfères.</p>' +
      '</form>' +
      (entries.length ? '<ul class="entries" role="list">' + shown.map(function (e) { return entryRow(task, e); }).join('') + '</ul>' : '<p class="empty-line">Aucune heure pour l’instant : un clic sur le chrono et c’est parti.</p>') +
      (entries.length > 5 ? '<button type="button" class="btn btn--ghost btn--sm" data-entries-toggle>' + icon(showAllEntries ? 'chevron-up' : 'chevron-down') + (showAllEntries ? 'Afficher moins' : 'Voir les ' + (entries.length - 5) + ' autres entrées') + '</button>' : '');
  }

  function tagsHTML(task) {
    return '<div class="tag-editor">' + task.tags.map(function (g) {
      return '<span class="tag">' + esc(g) + '<button type="button" class="tag__remove" data-tag-remove="' + esc(g) + '" aria-label="Retirer l’étiquette ' + esc(g) + '">' + icon('close') + '</button></span>';
    }).join('') +
      '<form class="tag-editor__add" data-tag-add><label class="sr-only" for="dr-tag">Ajouter une étiquette</label>' +
      '<input class="input input--sm" id="dr-tag" data-focus-key="tag-new" list="dl-tags" placeholder="+ étiquette" autocomplete="off"></form>' +
      '<datalist id="dl-tags">' + Q.allTags().filter(function (g) { return task.tags.indexOf(g) < 0; }).map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist></div>';
  }

  function reminderHTML(task) {
    var r = task.reminder;
    var on = !!r;
    var days = r ? r.daysBefore : 1;
    var date = task.endDate ? D.addDays(task.endDate, -days) : null;
    return '<div class="reminder">' +
      '<label class="switch"><input class="switch__input" type="checkbox" role="switch" data-reminder-on' + (on ? ' checked' : '') + (task.endDate ? '' : ' disabled') + '>' +
        '<span class="switch__track" aria-hidden="true"></span><span class="switch__label">Me rappeler l’échéance</span></label>' +
      '<select class="select select--sm" data-reminder-days aria-label="Délai du rappel"' + (on ? '' : ' disabled') + '>' +
        [1, 2, 3, 7].map(function (n) { return '<option value="' + n + '"' + (n === days ? ' selected' : '') + '>' + (n === 7 ? '1 semaine avant' : n + ' jour' + (n > 1 ? 's' : '') + ' avant') + '</option>'; }).join('') +
      '</select></div>' +
      '<p class="hint" data-reminder-hint>' + (task.endDate
        ? (on ? 'Rappel le ' + esc(D.dayMonthLong(date)) + ', à l’ouverture de l’app (et en notification Windows si elle est ouverte).' : 'Aucun rappel programmé.')
        : 'Ajoute une date de fin pour programmer un rappel.') + '</p>';
  }

  function render(task) {
    var st = S.get();
    var c = S.category(task.categoryId);
    return '<div class="drawer task-drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title" tabindex="-1">' +
      '<div class="drawer__header">' +
        '<div class="drawer__heading"><div class="drawer__chips" data-dr-chips>' + U.catChip(c) + U.statusChip(task.status) + '</div>' +
        '<h2 class="sr-only" id="dr-title">' + esc(task.title) + '</h2>' +
        '<label class="sr-only" for="dr-t">Titre de la tâche</label>' +
        '<textarea class="title-input" id="dr-t" data-f="title" rows="1" spellcheck="true" autocomplete="off">' + esc(task.title) + '</textarea></div>' +
        '<button type="button" class="btn btn--ghost btn--icon" data-dr-close aria-label="Fermer le détail">' + icon('close') + '</button>' +
      '</div>' +
      '<div class="drawer__body">' +
        '<div class="field"><label class="label" for="dr-desc">Description <span class="label__optional">facultatif</span></label>' +
          '<textarea class="textarea" id="dr-desc" data-f="description" rows="3" placeholder="Le brief, les contraintes, un lien vers les fichiers…">' + esc(task.description) + '</textarea></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label class="label" for="dr-cat">Catégorie</label><select class="select" id="dr-cat" data-f="categoryId">' +
            st.categories.map(function (x) { return '<option value="' + x.id + '"' + (x.id === task.categoryId ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="label" for="dr-client">Client / projet <span class="label__optional">facultatif</span></label>' +
            '<input class="input" id="dr-client" data-f="client" list="dl-clients-dr" value="' + esc(task.client) + '" autocomplete="off">' +
            '<datalist id="dl-clients-dr">' + Q.allClients().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></div>' +
          '<div class="field"><label class="label" for="dr-status">Statut</label><select class="select" id="dr-status" data-f="status">' +
            Q.STATUS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === task.status ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="label" for="dr-prio">Priorité</label><select class="select" id="dr-prio" data-f="priority">' +
            Q.PRIORITIES.map(function (p) { return '<option value="' + p.id + '"' + (p.id === task.priority ? ' selected' : '') + '>' + esc(p.label) + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div class="field"><span class="label">Étiquettes</span><div data-dr-tags>' + tagsHTML(task) + '</div></div>' +
        '<div class="form-grid" data-dr-dates>' +
          '<div class="field"><label class="label" for="dr-start">Début</label><input class="input" type="date" id="dr-start" data-f="startDate" value="' + (task.startDate || '') + '"></div>' +
          '<div class="field" data-end-field><label class="label" for="dr-end">Fin</label><input class="input" type="date" id="dr-end" data-f="endDate" value="' + (task.endDate || '') + '" aria-describedby="dr-end-hint"></div>' +
          '<p class="hint form-grid__full" id="dr-end-hint" data-end-hint hidden></p>' +
        '</div>' +
        '<div data-dr-reminder>' + reminderHTML(task) + '</div>' +
        '<div class="range-field"><div class="range-field__head"><label class="label" for="dr-progress">Avancement <span class="label__optional">réglé à la main</span></label>' +
          '<output class="range-field__value" for="dr-progress" data-progress-out>' + task.progress + D.NBSP + '%</output></div>' +
          '<input type="range" class="range" id="dr-progress" min="0" max="100" step="5" value="' + task.progress + '" style="--value:' + task.progress + '" data-f="progress">' +
          '<div class="range-field__scale" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>' +
        '<section class="drawer-section" data-dr-checklist aria-label="Checklist">' + checklistHTML(task) + '</section>' +
        '<section class="drawer-section" data-dr-hours aria-labelledby="dr-hours">' + hoursHTML(task) + '</section>' +
      '</div>' +
      '<div class="drawer__footer">' +
        '<button type="button" class="btn btn--ghost btn--danger-text" data-dr-delete>' + icon('trash') + 'Supprimer</button>' +
        '<span class="saved-note">' + icon('check') + 'Enregistré automatiquement</span>' +
        '<button type="button" class="btn btn--secondary" data-dr-close>Fermer</button>' +
      '</div>' +
    '</div>';
  }

  // Le titre éditable grandit avec son texte (pas de barre de défilement)
  function fitTitle() {
    var ta = root && root.querySelector('#dr-t');
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function refresh(part) {
    var task = t();
    if (!task || !root) return;
    if (part === 'checklist' || !part) {
      var cl = root.querySelector('[data-dr-checklist]');
      U.keepFocus(cl, function () { cl.innerHTML = checklistHTML(task); });
    }
    if (part === 'hours' || part === 'timer' || !part) {
      var h = root.querySelector('[data-dr-hours]');
      U.keepFocus(h, function () {
        var keep = h.querySelector('[data-entry-add]');
        var vals = keep ? { date: keep.date.value, dur: keep.dur.value, note: keep.note.value } : null;
        h.innerHTML = hoursHTML(task);
        if (vals && part === 'timer') { var f = h.querySelector('[data-entry-add]'); f.date.value = vals.date; f.dur.value = vals.dur; f.note.value = vals.note; }
      });
    }
    if (part === 'tags' || !part) {
      var tg = root.querySelector('[data-dr-tags]');
      U.keepFocus(tg, function () { tg.innerHTML = tagsHTML(task); });
    }
    if (part === 'reminder' || part === 'dates' || !part) {
      var rm = root.querySelector('[data-dr-reminder]');
      U.keepFocus(rm, function () { rm.innerHTML = reminderHTML(task); });
    }
    if (part === 'meta' || !part) {
      root.querySelector('[data-dr-chips]').innerHTML = U.catChip(S.category(task.categoryId)) + U.statusChip(task.status);
      var sel = root.querySelector('#dr-status'); if (sel && sel.value !== task.status) sel.value = task.status;
      var pr = root.querySelector('#dr-progress');
      if (pr && +pr.value !== task.progress) { pr.value = task.progress; pr.style.setProperty('--value', task.progress); root.querySelector('[data-progress-out]').textContent = task.progress + D.NBSP + '%'; }
    }
    U.typo(root);
  }

  /* --- Comportements ----------------------------------------------------- */
  function afterStatus(task, prev) {
    if (task.status === 'done' && prev !== 'done') {
      var acts = [];
      if (task.progress < 100) acts.push({ label: 'Mettre à 100 %', fn: function () { S.updateTask(task.id, { progress: 100 }); } });
      if (S.get().activeTimer && S.get().activeTimer.taskId === task.id) L.chrono.stop();
      U.toast({ kind: 'success', icon: 'sparkle', title: 'Bravo, c’est terminé !', text: '« ' + task.title + ' »' + (task.progress < 100 ? ' est à ' + task.progress + ' %. Tu veux la passer à 100 % ?' : ' rejoint la colonne Terminé.'), actions: acts, duration: 7000 });
    }
  }

  function bind() {
    root.addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-f');
      var task = t();
      if (!f || !task) return;
      if (f === 'title') {
        var v = e.target.value;
        fitTitle();
        root.querySelector('#dr-title').textContent = v.trim() || 'Sans titre';
        if (v.trim()) S.updateTask(task.id, { title: v.trim() });
      } else if (f === 'description' || f === 'client') {
        S.updateTask(task.id, (function () { var p = {}; p[f] = e.target.value; return p; })());
      } else if (f === 'progress') {
        var n = +e.target.value;
        e.target.style.setProperty('--value', n);
        root.querySelector('[data-progress-out]').textContent = n + D.NBSP + '%';
        S.updateTask(task.id, { progress: n });
      }
    });

    root.addEventListener('change', function (e) {
      var task = t();
      if (!task) return;
      var f = e.target.getAttribute('data-f');
      if (f === 'categoryId' || f === 'priority') {
        var p = {}; p[f] = e.target.value; S.updateTask(task.id, p); refresh('meta');
      } else if (f === 'status') {
        var prev = task.status;
        S.updateTask(task.id, { status: e.target.value });
        refresh('meta');
        afterStatus(task, prev);
      } else if (f === 'startDate' || f === 'endDate') {
        var s = root.querySelector('#dr-start').value || null;
        var en = root.querySelector('#dr-end').value || null;
        var bad = s && en && en < s;
        var field = root.querySelector('[data-end-field]');
        var hint = root.querySelector('[data-end-hint]');
        field.classList.toggle('field--error', !!bad);
        root.querySelector('[data-dr-dates]').classList.toggle('field--error', !!bad);
        hint.hidden = !bad;
        hint.textContent = bad ? 'La fin doit tomber le même jour que le début, ou après. Ajuste l’une des deux dates.' : '';
        if (bad) { root.querySelector('#dr-end').setAttribute('aria-invalid', 'true'); return; }
        root.querySelector('#dr-end').removeAttribute('aria-invalid');
        S.updateTask(task.id, { startDate: s, endDate: en, reminder: en ? task.reminder : null });
        refresh('dates');
      } else if (e.target.hasAttribute('data-check-toggle')) {
        S.toggleCheck(task.id, e.target.closest('[data-cid]').getAttribute('data-cid'), e.target.checked);
      } else if (e.target.hasAttribute('data-reminder-on')) {
        var days = +root.querySelector('[data-reminder-days]').value || 1;
        S.updateTask(task.id, { reminder: e.target.checked ? { daysBefore: days } : null });
        refresh('reminder');
        if (e.target.checked) U.announce('Rappel programmé');
      } else if (e.target.hasAttribute('data-reminder-days')) {
        S.updateTask(task.id, { reminder: { daysBefore: +e.target.value } });
        refresh('reminder');
      }
    });

    root.addEventListener('submit', function (e) {
      e.preventDefault();
      var task = t();
      var form = e.target;
      if (!task) return;
      if (form.hasAttribute('data-check-add')) {
        var inp = form.querySelector('input');
        if (inp.value.trim()) { S.addCheck(task.id, inp.value); setTimeout(function () { var x = root.querySelector('#dr-check-new'); if (x) x.focus(); }, 0); }
      } else if (form.hasAttribute('data-tag-add')) {
        var tg = form.querySelector('input').value.trim().replace(/^#/, '');
        if (tg && task.tags.indexOf(tg) < 0) { S.updateTask(task.id, { tags: task.tags.concat([tg]) }); refresh('tags'); U.announce('Étiquette ' + tg + ' ajoutée'); }
        setTimeout(function () { var x = root.querySelector('#dr-tag'); if (x) { x.value = ''; x.focus(); } }, 0);
      } else if (form.hasAttribute('data-entry-add')) {
        var m = D.parseDuration(form.dur.value);
        var fd = form.querySelector('[data-me-dur]');
        if (!m) {
          fd.classList.add('field--error');
          form.querySelector('[data-me-hint]').textContent = 'Indique une durée, par exemple 1h30, 90 ou 1,5.';
          form.dur.focus();
          return;
        }
        S.addEntry(task.id, { date: form.date.value || D.today(), minutes: m, note: form.note.value.trim(), source: 'manual' });
        U.toast({ kind: 'success', icon: 'clock', title: 'Temps ajouté : ' + D.duration(m), text: '« ' + task.title + ' », ' + D.short(form.date.value || D.today()) + '.', duration: 3500 });
        setTimeout(function () { var x = root.querySelector('#me-dur'); if (x) x.focus(); }, 0);
      } else if (form.hasAttribute('data-entry-save')) {
        var eid = form.closest('[data-eid]').getAttribute('data-eid');
        var mm = D.parseDuration(form.dur.value);
        if (!mm) { form.dur.closest('.field').classList.add('field--error'); form.dur.focus(); return; }
        editingEntry = null;
        S.updateEntry(task.id, eid, { date: form.date.value || D.today(), minutes: mm, note: form.note.value.trim() });
        setTimeout(function () { var x = root.querySelector('[data-focus-key="ee-' + eid + '"]'); if (x) x.focus(); }, 0);
        U.announce('Entrée modifiée');
      }
    });

    root.addEventListener('input', function (e) {
      if (e.target.id === 'me-dur') {
        var m = D.parseDuration(e.target.value);
        e.target.closest('.field').classList.remove('field--error');
        root.querySelector('[data-me-hint]').textContent = e.target.value.trim() ? (m ? '= ' + D.duration(m) : 'Hum, je ne lis pas cette durée. Essaie 1h30, 90 ou 1,5.') : '« 1h30 », « 90 » ou « 1,5 » : comme tu préfères.';
        U.typo(root.querySelector('[data-me-hint]'));
      }
    });

    root.addEventListener('focusout', function (e) {
      var task = t();
      if (task && e.target.id === 'dr-t' && !e.target.value.trim()) {
        e.target.value = task.title;
        fitTitle();
        root.querySelector('#dr-title').textContent = task.title;
        U.toast({ icon: 'info', title: 'Le titre ne peut pas être vide', text: 'On garde « ' + task.title + ' ».', duration: 3500 });
      }
    });

    root.addEventListener('keydown', function (e) {
      // Alt + ↑ / ↓ sur une case : réordonner la checklist
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.hasAttribute('data-check-toggle')) {
        e.preventDefault();
        S.moveCheck(current, e.target.closest('[data-cid]').getAttribute('data-cid'), e.key === 'ArrowUp' ? -1 : 1);
      }
      if (e.key === 'Escape' && editingEntry) { e.stopPropagation(); editingEntry = null; refresh('hours'); }
      if (e.key === 'Enter' && e.target.id === 'dr-t') { e.preventDefault(); var d = root.querySelector('#dr-desc'); if (d) d.focus(); }
    }, true);

    root.addEventListener('click', function (e) {
      var task = t();
      if (!task) return;
      var b;
      if (e.target.closest('[data-dr-close]')) { close(); return; }
      if (e.target.closest('[data-dr-delete]')) { remove(task.id); return; }
      if ((b = e.target.closest('[data-tag-remove]'))) {
        var g = b.getAttribute('data-tag-remove');
        S.updateTask(task.id, { tags: task.tags.filter(function (x) { return x !== g; }) });
        refresh('tags');
        setTimeout(function () { var x = root.querySelector('#dr-tag'); if (x) x.focus(); }, 0);
        U.announce('Étiquette ' + g + ' retirée');
        return;
      }
      if ((b = e.target.closest('[data-check-move]'))) {
        S.moveCheck(task.id, b.closest('[data-cid]').getAttribute('data-cid'), +b.getAttribute('data-check-move'));
        return;
      }
      if ((b = e.target.closest('[data-check-remove]'))) {
        var li = b.closest('[data-cid]');
        var next = li.nextElementSibling || li.previousElementSibling;
        var label = li.querySelector('.checkbox__label').textContent;
        S.removeCheck(task.id, li.getAttribute('data-cid'));
        var target = next && root.querySelector('[data-cid="' + next.getAttribute('data-cid') + '"] input');
        (target || root.querySelector('#dr-check-new')).focus();
        U.announce('Sous-tâche « ' + label + ' » supprimée');
        return;
      }
      if (e.target.closest('[data-entries-toggle]')) { showAllEntries = !showAllEntries; refresh('hours'); return; }
      if ((b = e.target.closest('[data-entry-edit]'))) {
        editingEntry = b.closest('[data-eid]').getAttribute('data-eid');
        refresh('hours');
        setTimeout(function () { var x = root.querySelector('#ee-dur'); if (x) { x.focus(); x.select(); } }, 0);
        return;
      }
      if (e.target.closest('[data-entry-cancel]')) {
        var id = editingEntry; editingEntry = null; refresh('hours');
        setTimeout(function () { var x = root.querySelector('[data-focus-key="ee-' + id + '"]'); if (x) x.focus(); }, 0);
        return;
      }
      if ((b = e.target.closest('[data-entry-remove]'))) {
        var eid = b.closest('[data-eid]').getAttribute('data-eid');
        var snap = S.removeEntry(task.id, eid);
        var tid = task.id;
        U.toast({ icon: 'trash', title: 'Entrée supprimée', text: snap ? D.duration(snap.entry.minutes) + ' du ' + D.short(snap.entry.date) + '.' : '', duration: 10000,
          actions: [{ label: 'Annuler', fn: function () { S.restoreEntry(tid, snap); } }] });
        var add = root.querySelector('#me-dur'); if (add) add.focus();
      }
    });
  }

  // Élément focalisable voisin de la tâche supprimée, dans l'onglet affiché (QA-03)
  function neighbour(id) {
    var list = U.$$('.view:not([hidden]) [data-open-task][data-focus-key], .view:not([hidden]) .task-card[data-focus-key]');
    var tid = function (el) { return el.getAttribute('data-open-task') || el.getAttribute('data-id'); };
    var i = opener ? list.indexOf(opener) : -1;
    if (i < 0) list.forEach(function (el, k) { if (i < 0 && tid(el) === id) i = k; });
    if (i < 0) return null;
    for (var a = i + 1; a < list.length; a++) if (tid(list[a]) !== id) return list[a];
    for (var b = i - 1; b >= 0; b--) if (tid(list[b]) !== id) return list[b];
    return null;
  }

  function remove(id) {
    var task = S.task(id);
    if (!task) return;
    var target = neighbour(id);
    removing = id;                        // la fermeture est faite ici, avec le bon focus
    var snap = S.deleteTask(id);
    removing = null;
    close(true, target);
    U.toast({
      icon: 'trash', title: 'Tâche supprimée', text: '« ' + task.title + ' ». Tu as 10 secondes pour changer d’avis.', duration: 10000,
      actions: [{ label: 'Annuler', fn: function () { S.restoreTask(snap); U.toast({ kind: 'success', icon: 'refresh', title: 'Tâche restaurée', text: '« ' + task.title + ' » est de retour.', duration: 3000 }); } }]
    });
  }

  function open(id, opts) {
    opts = opts || {};
    var task = S.task(id);
    if (!task) return;
    ov = ov || document.getElementById('overlay-task');
    var reopening = current && !ov.hidden;
    current = id; showAllEntries = false; editingEntry = null;
    ov.innerHTML = render(task);
    root = ov.querySelector('.task-drawer');
    bind();
    U.typo(root);
    if (!reopening) {
      opener = opts.returnTo || document.activeElement;
      U.openLayer(ov, { initialFocus: root, returnTo: opts.returnTo, onClose: function () { current = null; root = null; } });
    }
    requestAnimationFrame(fitTitle);
    if (opts.section === 'hours') {
      setTimeout(function () {
        var h = root && root.querySelector('[data-dr-hours]');
        if (h) { h.scrollIntoView({ block: 'start', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); var b = h.querySelector('[data-chrono], #me-dur'); if (b) b.focus(); }
      }, 60);
    }
  }

  function close(deleted, focusTarget) {
    if (!ov || ov.hidden) return;
    U.closeLayer(ov, deleted ? 'deleted' : 'close', focusTarget);
  }

  S.subscribe(function (type, d) {
    if (!current || !root) return;
    if (type === 'task:delete' && d.id === current && removing !== d.id) { close(true); return; }
    if (type === 'timer') { refresh('timer'); return; }
    if (type === 'task:move' && d.id === current) { refresh('meta'); return; }
    if (type === 'task:update' && d.id === current) {
      if (d.part) refresh(d.part);
      else if (d.patch && ('progress' in d.patch) && document.activeElement && document.activeElement.id !== 'dr-progress') refresh('meta');
    }
    if (type === 'reset') close();
  });

  L.drawer = { open: open, close: close, remove: remove, afterStatus: afterStatus, current: function () { return current; } };
})(window.Lamia = window.Lamia || {});
