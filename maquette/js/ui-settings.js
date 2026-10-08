/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · Réglages
   Catégories (renommer, ajouter, couleur, groupe, suppression avec
   réaffectation), objectifs d'heures, thème, rappels, dossier de données
   (affichage fictif), rejouer l'accueil, réinitialiser la démo.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon, NB = D.NBSP;
  var el = null;
  var GROUPS = [['flowline', 'Flow Line (salariée)'], ['auto-entreprise', 'Auto-entreprise']];

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
    return '<section class="glass card" aria-labelledby="st-goal"><div class="card__header"><div><h2 class="card__title" id="st-goal">Objectifs d’heures</h2>' +
      '<p class="card__subtitle">Comparés aux heures de chaque groupe, jamais additionnés entre eux.</p></div></div>' +
      '<div class="goal-block"><div class="goal-block__head">' + U.catDot({ color: 'flowline' }) + '<h3 class="goal-block__title">Flow Line</h3><span class="text-sm text-muted">salariée</span></div>' +
        '<div class="goal-grid"><div class="field"><label class="label" for="g-fw">Heures par semaine</label>' +
          '<div class="input-suffix"><input class="input" type="number" min="1" max="60" step="0.5" id="g-fw" data-goal="flowline" data-focus-key="g-fw" value="' + f.weeklyHours + '"><span>h</span></div></div>' +
          '<div class="field"><span class="label">Jours travaillés</span>' + dayToggles('flowline', f.days) + '</div></div>' +
        '<p class="hint">Soit ' + perDay + ' par jour travaillé. Au-delà, l’affichage reste neutre : « + 2 h », jamais d’alerte.</p></div>' +
      '<div class="goal-block"><div class="goal-block__head">' + U.catDot({ color: 'auto' }) + '<h3 class="goal-block__title">Auto-entreprise</h3><span class="text-sm text-muted">Carnet by-pass inclus</span></div>' +
        '<div class="goal-grid"><div class="field"><span class="label">Jours perso</span>' + dayToggles('auto-entreprise', a.days) + '</div>' +
          '<div class="field"><label class="switch"><input class="switch__input" type="checkbox" role="switch" data-goal-auto-on data-focus-key="g-aon"' + (a.weeklyHours ? ' checked' : '') + '>' +
            '<span class="switch__track" aria-hidden="true"></span><span class="switch__label">Objectif indicatif</span></label>' +
            '<div class="input-suffix"><label class="sr-only" for="g-aw">Heures par semaine (auto-entreprise)</label><input class="input" type="number" min="1" max="40" step="0.5" id="g-aw" data-goal="auto-entreprise" data-focus-key="g-aw" value="' + (a.weeklyHours || 6) + '"' + (a.weeklyHours ? '' : ' disabled') + '><span>h / sem.</span></div></div></div>' +
        '<p class="hint">Par défaut, pas d’objectif : le samedi reste un plaisir. (Point à arbitrer avec Lamia.)</p></div>' +
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

  function dataCard() {
    return '<section class="glass card" aria-labelledby="st-data"><div class="card__header"><div><h2 class="card__title" id="st-data">Dossier de données</h2>' +
      '<p class="card__subtitle">Tout tient dans un dossier, à côté de l’application. Déplacer le dossier, c’est déplacer tes données.</p></div></div>' +
      '<div class="folder"><span class="folder__icon">' + icon('folder') + '</span><div class="folder__text"><span class="folder__path">E:\\Plateforme de suivi\\Donnees-Lamia\\</span>' +
        '<span class="folder__meta">' + icon('check') + 'Enregistré automatiquement · dernière sauvegarde : data-' + D.today() + '.json</span></div></div>' +
      '<ul class="folder__files" role="list">' +
        '<li>' + icon('note') + '<span>data.json</span><span class="text-subtle">toutes tes données</span></li>' +
        '<li>' + icon('folder') + '<span>sauvegardes</span><span class="text-subtle">30 jours conservés</span></li>' +
        '<li>' + icon('folder') + '<span>exports</span><span class="text-subtle">PDF et CSV</span></li></ul>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn--secondary btn--sm" data-demo="open-folder">' + icon('folder') + 'Ouvrir le dossier</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-demo="export-json">' + icon('download') + 'Exporter une sauvegarde</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-demo="restore">' + icon('refresh') + 'Restaurer…</button></div></section>';
  }

  function remindersCard() {
    var h = (S.get().settings.reminders || {}).hour || 9;
    return '<section class="glass card" aria-labelledby="st-rem"><div class="card__header"><div><h2 class="card__title" id="st-rem">Rappels d’échéance</h2>' +
      '<p class="card__subtitle">Affichés à l’ouverture, et en notification Windows si l’app est ouverte.</p></div></div>' +
      '<div class="field"><label class="label" for="st-rem-h">Heure des rappels</label><select class="select" id="st-rem-h" data-rem-hour data-focus-key="rem-h">' +
        [8, 9, 10, 14].map(function (x) { return '<option value="' + x + '"' + (x === h ? ' selected' : '') + '>' + x + NB + 'h</option>'; }).join('') + '</select>' +
        '<p class="hint">Le délai (J-1, J-2…) se règle tâche par tâche, dans son détail.</p></div></section>';
  }

  function demoCard() {
    return '<section class="glass glass--tint-blue card" aria-labelledby="st-demo"><div class="card__header"><div><h2 class="card__title" id="st-demo">Maquette</h2>' +
      '<p class="card__subtitle">Date de démo figée au ' + esc(D.long(D.today())) + '.</p></div></div>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn--secondary btn--sm" data-demo="replay">' + icon('mood') + 'Rejouer la question d’humeur du matin</button>' +
        '<button type="button" class="btn btn--danger btn--sm" data-demo="reset">' + icon('refresh') + 'Réinitialiser la démo</button></div>' +
      '<p class="hint">La réinitialisation remet les données fictives d’origine. Rien d’autre n’est touché.</p></section>';
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
      else if (t.getAttribute('data-goal') === 'auto-entreprise') { var w = parseFloat(t.value); if (w > 0) S.setSchedule('auto-entreprise', { weeklyHours: w }); }
      else if (t.hasAttribute('data-goal-auto-on')) S.setSchedule('auto-entreprise', { weeklyHours: t.checked ? (parseFloat(el.querySelector('#g-aw').value) || 6) : null });
      else if (t.hasAttribute('data-rem-hour')) { S.setSettings({ reminders: { hour: +t.value } }); U.toast({ icon: 'bell', title: 'Rappels à ' + t.value + NB + 'h', duration: 2500 }); }
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
      if ((b = e.target.closest('[data-demo]'))) {
        var a = b.getAttribute('data-demo');
        if (a === 'replay') { S.setFlag('moodPromptedOn', null); S.setFlag('remindersShownOn', null); L.app.morning(true); }
        else if (a === 'reset') {
          U.dialog({ title: 'Réinitialiser la démo ?', text: 'Les tâches, heures et humeurs fictives d’origine reviennent. Tes essais dans la maquette seront effacés.', confirmLabel: 'Réinitialiser', danger: true, returnTo: b,
            onConfirm: function () { S.reset(); L.app.applyTheme(); U.toast({ kind: 'success', icon: 'refresh', title: 'Démo réinitialisée', text: 'Comme au premier jour.' }); setTimeout(function () { L.app.morning(true); }, 400); } });
        } else if (a === 'export-json') {
          U.download('sauvegarde-lamia-' + D.today() + '.json', JSON.stringify(S.get(), null, 2), 'application/json');
          U.toast({ kind: 'success', icon: 'download', title: 'Sauvegarde exportée', text: 'Un fichier .json complet, à garder où tu veux.' });
        } else if (a === 'open-folder') U.toast({ icon: 'folder', title: 'Dans l’application', text: 'Ce bouton ouvrira Donnees-Lamia dans l’Explorateur Windows.' });
        else if (a === 'restore') U.toast({ icon: 'refresh', title: 'Dans l’application', text: 'Tu choisiras parmi les 30 sauvegardes quotidiennes. Une copie de l’état actuel est faite avant.' });
      }
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
