/* ==========================================================================
   Plateforme de suivi - Lamia — Réglages
   Catégories (renommer, ajouter, couleur, groupe, suppression avec
   réaffectation), objectifs d'heures (Flow Line 35 h ; pôle perso 4 h
   minimum le samedi), thème, rappels et intégrations Windows (par PC),
   dossier de données réel (ouvrir, exporter, importer, restaurer),
   données de démo, rejouer l'accueil.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon, NB = D.NBSP;
  var el = null;
  var api = window.lamia;
  var GROUPS = [['flowline', 'Flow Line (salariée)'], ['auto-entreprise', 'Auto-entreprise']];
  var KIND = { quotidienne: 'Sauvegarde du jour', demo: 'Avant le chargement de la démo', import: 'Avant un import', restauration: 'Avant une restauration', 'migration-v1': 'Avant la mise à jour du format' };

  function info() { return L.info || {}; }
  function machine() { return info().machine || {}; }

  function dayToggles(group, days) {
    return '<div class="day-toggles" role="group" aria-label="Jours travaillés">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      return '<button type="button" class="day-toggle" data-day="' + d + '" data-group="' + group + '" data-focus-key="day-' + group + d + '" aria-pressed="' + (days.indexOf(d) >= 0) + '" aria-label="' + D.cap(D.DAYS[d]) + '">' + D.DAYS_LETTER[d] + '</button>';
    }).join('') + '</div>';
  }

  function categoriesCard() {
    var st = S.get();
    var rows = st.categories.map(function (c) {
      var used = st.tasks.filter(function (t) { return t.categoryId === c.id; }).length;
      return '<li class="cat-row ' + U.hue(c) + '" data-cat="' + c.id + '">' +
        '<span class="cat-row__swatch" aria-hidden="true"></span>' +
        '<div class="field cat-row__name"><label class="sr-only" for="cn-' + c.id + '">Nom de la catégorie</label>' +
          '<input class="input" id="cn-' + c.id + '" data-cat-name data-focus-key="cn-' + c.id + '" value="' + esc(c.name) + '" autocomplete="off"></div>' +
        '<div class="field cat-row__group"><label class="sr-only" for="cg-' + c.id + '">Groupe</label><select class="select" id="cg-' + c.id + '" data-cat-group data-focus-key="cg-' + c.id + '">' +
          GROUPS.map(function (g) { return '<option value="' + g[0] + '"' + (g[0] === c.group ? ' selected' : '') + '>' + g[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="palette" role="group" aria-label="Couleur de « ' + esc(c.name) + ' »">' + U.PALETTE.map(function (p) {
          return '<button type="button" class="palette__swatch hue--' + p.id + '" data-color="' + p.id + '" data-focus-key="pc-' + c.id + p.id + '" aria-pressed="' + (c.color === p.id) + '" title="' + esc(p.label) + '"><span class="sr-only">' + esc(p.label) + '</span></button>';
        }).join('') + '</div>' +
        '<span class="cat-row__count text-sm text-muted">' + U.plural(used, 'tâche') + '</span>' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-cat-remove aria-label="Supprimer la catégorie « ' + esc(c.name) + ' »"' + (st.categories.length < 2 ? ' disabled' : '') + '>' + icon('trash') + '</button>' +
      '</li>';
    }).join('');
    return '<section class="glass card" aria-labelledby="st-cat"><div class="card__header"><div><h2 class="card__title" id="st-cat">Catégories</h2>' +
      '<p class="card__subtitle">Renomme-les, choisis leur couleur et leur groupe. Le groupe décide de l’objectif d’heures.</p></div>' +
      '<div class="card__actions"><button type="button" class="btn btn--soft btn--sm" data-cat-add>' + icon('plus') + 'Ajouter</button></div></div>' +
      '<ul class="cat-rows" role="list">' + rows + '</ul></section>';
  }

  function goalsCard() {
    var sch = S.get().settings.schedules;
    var f = sch.flowline, a = sch['auto-entreprise'];
    var perDay = f.weeklyHours && f.days.length ? D.duration(Math.round(f.weeklyHours * 60 / f.days.length)) : '—';
    var minOn = a.minDailyHours > 0;
    var persoDays = a.days.map(function (d) { return D.DAYS[d]; }).join(', ');
    return '<section class="glass card" aria-labelledby="st-goal"><div class="card__header"><div><h2 class="card__title" id="st-goal">Objectifs d’heures</h2>' +
      '<p class="card__subtitle">Comparés aux heures de chaque groupe, jamais additionnés entre eux.</p></div></div>' +
      '<div class="goal-block"><div class="goal-block__head">' + U.catDot({ color: 'flowline' }) + '<h3 class="goal-block__title">Flow Line</h3><span class="text-sm text-muted">salariée</span></div>' +
        '<div class="goal-grid"><div class="field"><label class="label" for="g-fw">Heures par semaine</label>' +
          '<div class="input-suffix"><input class="input" type="number" min="1" max="60" step="0.5" id="g-fw" data-goal="flowline" data-focus-key="g-fw" value="' + f.weeklyHours + '"><span>h</span></div></div>' +
          '<div class="field"><span class="label">Jours travaillés</span>' + dayToggles('flowline', f.days) + '</div></div>' +
        '<p class="hint">Soit ' + perDay + ' par jour travaillé. Au-delà, l’affichage reste neutre : « + 2 h », jamais d’alerte.</p></div>' +
      '<div class="goal-block"><div class="goal-block__head">' + U.catDot({ color: 'auto' }) + '<h3 class="goal-block__title">Auto-entreprise</h3><span class="text-sm text-muted">Carnet by-pass inclus</span></div>' +
        '<div class="goal-grid goal-grid--stack"><div class="field"><span class="label">Jours perso</span>' + dayToggles('auto-entreprise', a.days) + '</div>' +
          '<div class="goal-inline"><label class="switch"><input class="switch__input" type="checkbox" role="switch" data-goal-min-on data-focus-key="g-mon"' + (minOn ? ' checked' : '') + '>' +
            '<span class="switch__track" aria-hidden="true"></span><span class="switch__label">Minimum par jour perso</span></label>' +
            '<div class="input-suffix"><label class="sr-only" for="g-am">Heures minimum par jour perso (pôle auto-entreprise)</label><input class="input" type="number" min="0.5" max="16" step="0.5" id="g-am" data-goal-min data-focus-key="g-am" value="' + (a.minDailyHours || 4) + '"' + (minOn ? '' : ' disabled') + '><span>h min.</span></div></div></div>' +
        '<p class="hint">' + (minOn
          ? 'Objectif du pôle : ' + D.duration(Math.round(a.minDailyHours * 60)) + ' minimum ' + (a.days.length === 1 ? 'le ' : 'chaque ') + esc(persoDays) + ', Carnet by-pass et Auto-entreprise réunis. Jamais additionné à Flow Line.'
          : 'Pas de minimum : le ' + esc(persoDays || 'samedi') + ' reste un plaisir.') + '</p></div>' +
    '</section>';
  }

  function themeCard() {
    var th = S.get().settings.theme;
    return '<section class="glass card" aria-labelledby="st-theme"><div class="card__header"><div><h2 class="card__title" id="st-theme">Apparence</h2>' +
      '<p class="card__subtitle">Clair, sombre, ou comme Windows.</p></div></div>' +
      '<div class="segmented segmented--block" role="group" aria-label="Thème">' +
        [['light', 'sun', 'Clair'], ['dark', 'moon', 'Sombre'], ['system', 'settings', 'Système']].map(function (o) {
          return '<button type="button" class="segmented__item" data-theme-set="' + o[0] + '" data-focus-key="th-' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + icon(o[1]) + o[2] + '</button>';
        }).join('') + '</div>' +
      '<p class="hint">Les animations de Lamia et Memeow s’arrêtent si « Réduire les animations » est activé dans Windows.</p></section>';
  }

  function sw(attr, on, label, hint, disabled) {
    return '<li><label class="switch"><input class="switch__input" type="checkbox" role="switch" ' + attr + ' data-focus-key="' + attr + '"' + (on ? ' checked' : '') + (disabled ? ' disabled' : '') + '>' +
      '<span class="switch__track" aria-hidden="true"></span><span class="switch__label">' + esc(label) + '</span></label>' +
      (hint ? '<p class="hint">' + hint + '</p>' : '') + '</li>';
  }

  function remindersCard() {
    var r = S.get().settings.reminders || {};
    var h = r.hour || 9;
    var m = machine();
    var win = m.platform === 'win32';
    return '<section class="glass card" aria-labelledby="st-rem"><div class="card__header"><div><h2 class="card__title" id="st-rem">Rappels d’échéance</h2>' +
      '<p class="card__subtitle">Dans l’application, et en notification Windows si tu le souhaites, même fenêtre fermée.</p></div></div>' +
      '<div class="field"><label class="label" for="st-rem-h">Heure des rappels</label><select class="select" id="st-rem-h" data-rem-hour data-focus-key="rem-h">' +
        [8, 9, 10, 14].map(function (x) { return '<option value="' + x + '"' + (x === h ? ' selected' : '') + '>' + x + NB + 'h</option>'; }).join('') + '</select>' +
        '<p class="hint">Le délai (J-1, J-2…) se règle tâche par tâche, dans son détail. Vérification toutes les 15 minutes, un seul rappel par tâche et par jour.</p></div>' +
      '<ul class="option-list" role="list">' +
        sw('data-rem-inapp', r.inApp !== false, 'Rappel dans l’application', 'Un message à l’ouverture et pendant la journée.') +
      '</ul>' +
      '<h3 class="goal-block__title st-subtitle">Sur ce PC</h3>' +
      '<ul class="option-list" role="list">' +
        sw('data-opt-notif', m.windowsNotifications, 'Activer les notifications Windows',
          'Crée un raccourci « Plateforme de suivi - Lamia » dans le menu Démarrer : Windows en a besoin pour afficher les notifications d’une application portable.' +
          (m.windowsNotifications ? ' <button type="button" class="btn btn--ghost btn--sm" data-test-notif>' + icon('bell') + 'Tester</button>' : '')) +
        sw('data-opt-tray', m.closeToTray, 'Fermer dans la zone de notification',
          'La croix garde l’application en arrière-plan (rappels, chrono). Pour quitter : clic droit sur l’icône près de l’horloge, puis « Quitter ».') +
        sw('data-opt-login', m.openAtLogin, 'Lancer au démarrage de Windows',
          win || !m.platform ? 'L’application s’ouvre avec Windows' + (m.closeToTray ? ', discrètement dans la zone de notification.' : '.') + ' Si tu déplaces l’exe, ouvre-le une fois depuis son nouveau dossier.' : 'Disponible sous Windows uniquement.', m.platform && !m.loginItemSupported) +
      '</ul></section>';
  }

  function dataCard() {
    var i = info();
    var dir = i.dataDir || 'Donnees-Lamia';
    var sep = dir.indexOf('\\') >= 0 ? '\\' : '/';
    var ls = S.lastSave();
    var meta = i.readOnly ? icon('eye') + 'Lecture seule : rien n’est enregistré sur ce PC pour l’instant'
      : ls && ls.ok === false ? icon('alert') + 'Enregistrement en attente'
      : icon('check') + 'Enregistré automatiquement · sauvegarde du jour : data-' + D.today() + '.json';
    return '<section class="glass card" aria-labelledby="st-data" id="st-data-card"><div class="card__header"><div><h2 class="card__title" id="st-data">Dossier de données</h2>' +
      '<p class="card__subtitle">Tout tient dans un dossier, à côté de l’application. Déplacer le dossier, c’est déplacer tes données.</p></div></div>' +
      '<div class="folder"><span class="folder__icon">' + icon('folder') + '</span><div class="folder__text"><span class="folder__path" data-data-dir>' + esc(dir.replace(/[\\/]$/, '') + sep) + '</span>' +
        '<span class="folder__meta">' + meta + '</span></div></div>' +
      (i.dataDirFallback ? '<p class="hint">' + icon('info') + ' ' + esc(i.dataDirReason || '') + ' Emplacement prévu : ' + esc(i.dataDirWanted || '') + '</p>' : '') +
      '<ul class="folder__files" role="list">' +
        '<li>' + icon('note') + '<span>data.json</span><span class="text-subtle">toutes tes données</span></li>' +
        '<li>' + icon('folder') + '<span>sauvegardes</span><span class="text-subtle">30 jours conservés</span></li>' +
        '<li>' + icon('folder') + '<span>exports</span><span class="text-subtle">PDF, CSV et .json</span></li></ul>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn--secondary btn--sm" data-data="open-folder">' + icon('folder') + 'Ouvrir le dossier</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-data="export-json">' + icon('download') + 'Exporter une sauvegarde</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-data="import">' + icon('upload') + 'Importer une sauvegarde</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-data="restore">' + icon('refresh') + 'Restaurer…</button></div>' +
      '<p class="hint">Exporter puis importer un .json : pratique pour passer d’un PC à l’autre. Une copie de sécurité est faite avant chaque import ou restauration.</p>' +
      '<p class="hint text-subtle">Version ' + esc(i.version || '') + ' · ' + esc(i.host || '') + '</p></section>';
  }

  function demoCard() {
    return '<section class="glass glass--tint-blue card" aria-labelledby="st-demo" id="st-demo-card"><div class="card__header"><div><h2 class="card__title" id="st-demo">Découvrir l’application</h2>' +
      '<p class="card__subtitle">Des données fictives pour explorer, datées autour d’aujourd’hui.</p></div></div>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn--secondary btn--sm" data-demo="load">' + icon('sparkle') + 'Charger les données de démo</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-demo="replay">' + icon('mood') + 'Rejouer la question d’humeur du matin</button></div>' +
      '<p class="hint">La démo remplace tes données actuelles, après une sauvegarde complète (dans sauvegardes/, restaurable avec « Restaurer… »).</p></section>';
  }

  function render() {
    if (!el) return;
    var html = '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Ton espace, tes règles</p><h1 class="h1" id="h-settings" tabindex="-1">Réglages</h1></div></header>' +
      '<div class="settings-grid"><div class="settings-col">' + categoriesCard() + goalsCard() + '</div>' +
      '<div class="settings-col">' + themeCard() + remindersCard() + dataCard() + demoCard() + '</div></div>';
    U.keepFocus(el, function () { el.innerHTML = html; });
    U.typo(el);
  }

  function removeCategory(id, btn) {
    var st = S.get();
    var c = S.category(id);
    var used = st.tasks.filter(function (t) { return t.categoryId === id; }).length;
    var others = st.categories.filter(function (x) { return x.id !== id; });
    U.dialog({
      title: 'Supprimer « ' + c.name + ' » ?', returnTo: btn,
      body: used
        ? '<p class="text-muted text-sm">' + U.plural(used, 'tâche') + ' utilise' + (used > 1 ? 'nt' : '') + ' cette catégorie. Choisis où les ranger : rien ne sera perdu.</p>' +
          '<div class="field"><label class="label" for="dlg-cat">Réaffecter vers</label><select class="select" id="dlg-cat" name="target">' +
          others.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div>'
        : '<p class="text-muted text-sm">Aucune tâche ne l’utilise. Elle disparaîtra simplement de la liste.</p>',
      confirmLabel: used ? 'Réaffecter et supprimer' : 'Supprimer', danger: true,
      onConfirm: function (form) {
        var target = form.target ? form.target.value : others[0].id;
        S.removeCategory(id, target);
        U.toast({ kind: 'success', icon: 'check', title: 'Catégorie supprimée', text: used ? U.plural(used, 'tâche') + ' rangée' + (used > 1 ? 's' : '') + ' dans « ' + S.category(target).name + ' ».' : '' });
      }
    });
  }

  /* --- Données : remplacement complet (démo, import, restauration) ------------ */
  function readOnlyGuard() {
    if (!info().readOnly) return false;
    U.toast({ icon: 'eye', title: 'Lecture seule', text: 'L’application est ouverte sur un autre PC : rien ne peut être remplacé ici pour l’instant.' });
    return true;
  }

  function applyReplaced(res, title, text) {
    if (!res || !res.ok) {
      if (res && res.canceled) return;
      U.toast({ kind: 'warning', icon: 'alert', title: 'Rien n’a été modifié', text: (res && res.error) || 'L’opération n’a pas abouti.' });
      return;
    }
    S.replace(res.doc);
    L.app.applyTheme();
    U.toast({ kind: 'success', icon: 'check', title: title, text: text + (res.backup ? ' Copie de sécurité : ' + res.backup + '.' : '') , duration: 7000 });
  }

  function summaryText(s) {
    return U.plural(s.tasks, 'tâche') + ', ' + U.plural(s.entries, 'entrée') + ' d’heures, ' + U.plural(s.moods, 'humeur');
  }

  function loadDemo(btn) {
    if (readOnlyGuard()) return;
    U.dialog({
      title: 'Charger les données de démo ?', returnTo: btn, danger: true, confirmLabel: 'Charger la démo',
      text: 'Tes données actuelles (' + summaryText(L.shared.model.summarize(S.get())) + ') seront remplacées par des données fictives. Une sauvegarde complète est faite juste avant : tu pourras tout récupérer avec « Restaurer… ».',
      onConfirm: function () {
        api.data.loadDemo().then(function (res) {
          applyReplaced(res, 'Données de démo chargées', 'Bonne visite !');
          if (res && res.ok) { location.hash = 'dashboard'; }
        });
      }
    });
  }

  function importJson(btn) {
    if (readOnlyGuard()) return;
    api.backup.importPick().then(function (pick) {
      if (!pick || !pick.ok) {
        if (pick && !pick.canceled) U.toast({ kind: 'warning', icon: 'alert', title: 'Fichier non reconnu', text: pick.error || 'Rien n’a été modifié.' });
        return;
      }
      U.dialog({
        title: 'Importer cette sauvegarde ?', returnTo: btn, confirmLabel: 'Importer',
        text: '« ' + pick.fileName + ' » : ' + summaryText(pick.summary) + '. Elles vont remplacer les données actuelles ; une copie de sécurité est faite avant.',
        onConfirm: function () {
          api.backup.importApply(pick.token).then(function (res) { applyReplaced(res, 'Sauvegarde importée', pick.fileName + '.'); });
        }
      });
    });
  }

  function backupLabel(b) {
    var when = D.valid(b.date) ? D.cap(D.long(b.date)) : b.date;
    return { title: (KIND[b.kind] || ('Avant : ' + b.kind)) + (b.kind === 'quotidienne' ? '' : ''), when: when + (b.time ? ', ' + b.time.replace(':', NB + 'h' + NB) : '') };
  }

  function restore(btn) {
    if (readOnlyGuard()) return;
    api.backup.list().then(function (list) {
      list = (list || []).filter(function (b) { return b.readable; });
      if (!list.length) { U.toast({ icon: 'info', title: 'Aucune sauvegarde pour l’instant', text: 'La première est créée à l’ouverture de chaque journée.' }); return; }
      U.dialog({
        title: 'Restaurer une sauvegarde', returnTo: btn, confirmLabel: 'Restaurer', danger: true,
        desc: 'Une copie de l’état actuel est faite avant : rien n’est perdu.',
        body: '<fieldset class="field"><legend class="label">Choisis la sauvegarde</legend><ul class="backup-list" role="list">' + list.slice(0, 40).map(function (b, i) {
          var l = backupLabel(b);
          return '<li><label class="backup-item"><input type="radio" name="backup" value="' + esc(b.id) + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span><span class="backup-item__title">' + esc(l.when) + '</span><span class="backup-item__meta">' + esc(l.title) + ' · ' + esc(summaryText(b.summary)) + '</span></span></label></li>';
        }).join('') + '</ul></fieldset>',
        onConfirm: function (form) {
          var choice = form.querySelector('input[name="backup"]:checked');
          if (!choice) return false;
          api.backup.restore(choice.value).then(function (res) { applyReplaced(res, 'Sauvegarde restaurée', choice.value + '.'); });
        }
      });
    });
  }

  function exportJson() {
    S.flush();
    api.backup.exportJson().then(function (res) {
      if (res && res.ok) U.toast({ kind: 'success', icon: 'download', title: 'Sauvegarde exportée', text: 'Un fichier .json complet, à garder où tu veux.', duration: 7000,
        actions: [{ label: 'Afficher le fichier', fn: function () { api.app.showFile(res.path); } }] });
    });
  }

  function setMachine(patch) {
    return api.app.setMachineOptions(patch).then(function (res) {
      if (L.info) L.info.machine = res.options;
      (res.messages || []).forEach(function (m) { U.toast({ icon: 'info', title: 'À savoir', text: m, duration: 7000 }); });
      render();
      return res;
    });
  }

  function mount(node) {
    el = node;
    var rename = U.debounce(function (id, v) { if (v.trim()) S.updateCategory(id, { name: v.trim() }); }, 250);
    el.addEventListener('input', function (e) {
      if (e.target.hasAttribute('data-cat-name')) rename(e.target.closest('[data-cat]').getAttribute('data-cat'), e.target.value);
    });
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-cat-group')) S.updateCategory(t.closest('[data-cat]').getAttribute('data-cat'), { group: t.value });
      else if (t.getAttribute('data-goal') === 'flowline') { var v = parseFloat(t.value); if (v > 0) S.setSchedule('flowline', { weeklyHours: v }); }
      else if (t.hasAttribute('data-goal-min')) { var w = parseFloat(String(t.value).replace(',', '.')); if (w > 0) S.setSchedule('auto-entreprise', { minDailyHours: w }); }
      else if (t.hasAttribute('data-goal-min-on')) S.setSchedule('auto-entreprise', { minDailyHours: t.checked ? (parseFloat(el.querySelector('#g-am').value) || 4) : 0 });
      else if (t.hasAttribute('data-rem-hour')) { S.setReminders({ hour: +t.value }); U.toast({ icon: 'bell', title: 'Rappels à ' + t.value + NB + 'h', duration: 2500 }); }
      else if (t.hasAttribute('data-rem-inapp')) S.setReminders({ inApp: t.checked });
      else if (t.hasAttribute('data-opt-notif')) setMachine({ windowsNotifications: t.checked }).then(function (res) {
        if (t.checked && res.options && !res.options.notificationsSupported) U.toast({ icon: 'info', title: 'Notifications indisponibles ici', text: 'Les rappels passeront par la zone de notification et le clignotement de la barre des tâches.' });
      });
      else if (t.hasAttribute('data-opt-tray')) setMachine({ closeToTray: t.checked });
      else if (t.hasAttribute('data-opt-login')) setMachine({ openAtLogin: t.checked });
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-color]'))) { S.updateCategory(b.closest('[data-cat]').getAttribute('data-cat'), { color: b.getAttribute('data-color') }); return; }
      if (e.target.closest('[data-cat-add]')) {
        var c = S.addCategory({ name: 'Nouvelle catégorie', color: 'periwinkle', group: 'auto-entreprise' });
        setTimeout(function () { var i = el.querySelector('#cn-' + c.id); if (i) { i.focus(); i.select(); } }, 0);
        U.announce('Catégorie ajoutée');
        return;
      }
      if ((b = e.target.closest('[data-cat-remove]'))) { removeCategory(b.closest('[data-cat]').getAttribute('data-cat'), b); return; }
      if ((b = e.target.closest('[data-day]'))) {
        var g = b.getAttribute('data-group'), d = +b.getAttribute('data-day');
        var days = S.get().settings.schedules[g].days.slice();
        var k = days.indexOf(d);
        if (k >= 0) { if (days.length > 1) days.splice(k, 1); } else days.push(d);
        days.sort();
        S.setSchedule(g, { days: days });
        return;
      }
      if (e.target.closest('[data-test-notif]')) {
        api.app.testNotification().then(function (r) {
          U.toast({ icon: 'bell', title: r && r.shown ? 'Notification envoyée' : 'Notification non affichée', text: r && r.shown ? 'Si rien n’apparaît, vérifie le mode « Ne pas déranger » de Windows.' : 'Windows ne l’a pas acceptée : les rappels resteront dans l’application.' });
        });
        return;
      }
      if ((b = e.target.closest('[data-data]'))) {
        var a = b.getAttribute('data-data');
        if (a === 'open-folder') api.app.openDataFolder().then(function (r) { if (!r.ok) U.toast({ kind: 'warning', icon: 'alert', title: 'Dossier introuvable', text: r.error || '' }); });
        else if (a === 'export-json') exportJson();
        else if (a === 'import') importJson(b);
        else if (a === 'restore') restore(b);
        return;
      }
      if ((b = e.target.closest('[data-demo]'))) {
        var x = b.getAttribute('data-demo');
        if (x === 'replay') { S.setFlag('moodPromptedOn', null); L.app.morning(true); }
        else if (x === 'load') loadDemo(b);
      }
    });
    // « Explorer avec la démo » depuis le Dashboard
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-goto-demo]')) return;
      setTimeout(function () {
        var card = document.getElementById('st-demo-card');
        if (card) { card.scrollIntoView({ block: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); var btn = card.querySelector('[data-demo="load"]'); if (btn) btn.focus({ preventScroll: true }); }
      }, 80);
    });
    S.subscribe(function (type) {
      if (L.app.view() !== 'settings') { el.dataset.stale = '1'; return; }
      if (type === 'category' || type === 'settings' || type === 'reset') {
        var a = document.activeElement;
        if (a && a.hasAttribute && a.hasAttribute('data-cat-name')) return;   // pas de re-rendu pendant la saisie
        render();
      }
    });
  }

  function show() { if (!el.firstChild || el.dataset.stale) { delete el.dataset.stale; render(); } }

  L.views = L.views || {};
  L.views.settings = { mount: mount, render: render, show: show, title: 'Réglages' };
})(window.Lamia = window.Lamia || {});
