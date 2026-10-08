/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · création rapide d'une tâche
   Seul le titre est obligatoire ; Entrée valide. La catégorie est proposée
   selon le jour (Flow Line du lundi au vendredi, Auto-entreprise le week-end).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q;
  var esc = U.esc, icon = U.icon;

  function defaultCategory() {
    var cats = S.get().categories;
    var w = D.dow(D.today());
    var weekend = w === 0 || w === 6;
    var pick = cats.filter(function (c) { return weekend ? c.group === 'auto-entreprise' && c.id === 'auto' : c.group === 'flowline'; })[0] ||
      cats.filter(function (c) { return c.group === (weekend ? 'auto-entreprise' : 'flowline'); })[0];
    return (pick || cats[0]).id;
  }

  function open(opts) {
    opts = opts || {};
    var ov = document.getElementById('overlay-new');
    var st = S.get();
    var catId = opts.categoryId || defaultCategory();
    var status = opts.status || 'todo';
    var prio = 'normal';
    var dayHint = D.dow(D.today()) === 6 || D.dow(D.today()) === 0 ? 'C’est le week-end : Auto-entreprise est proposée.' : 'En semaine, Flow Line est proposée. Tu peux changer.';

    ov.innerHTML =
      '<div class="modal modal--new" role="dialog" aria-modal="true" aria-labelledby="new-title">' +
        '<form class="new-task" novalidate>' +
          '<div class="modal__header"><div><p class="eyebrow">Suivi des tâches</p><h2 class="modal__title" id="new-title">Nouvelle tâche</h2>' +
            '<p class="modal__desc">Seul le titre est obligatoire. <span class="kbd">Entrée</span> pour valider.</p></div>' +
            '<button type="button" class="btn btn--ghost btn--icon" data-new-cancel aria-label="Fermer">' + icon('close') + '</button></div>' +
          '<div class="modal__body">' +
            '<div class="field" data-field="title"><label class="label" for="new-t">Titre</label>' +
              '<input class="input input--lg" id="new-t" name="title" autocomplete="off" placeholder="Ex. Affiche du marché de Noël" aria-describedby="new-t-hint">' +
              '<p class="hint" id="new-t-hint" hidden>Donne un petit nom à ta tâche, même provisoire.</p></div>' +
            '<div class="field"><span class="label" id="new-cat-l">Catégorie</span>' +
              '<div class="chip-picker" role="group" aria-labelledby="new-cat-l" data-pick="cat">' +
                st.categories.map(function (c) {
                  return '<button type="button" class="chip chip--cat ' + U.hue(c) + '" data-value="' + c.id + '" aria-pressed="' + (c.id === catId) + '">' + esc(c.name) + '</button>';
                }).join('') + '</div>' +
              '<p class="hint">' + esc(dayHint) + '</p></div>' +
            '<div class="form-grid">' +
              '<div class="field"><label class="label" for="new-status">Statut</label><select class="select" id="new-status" name="status">' +
                Q.STATUS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === status ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select></div>' +
              '<div class="field"><label class="label" for="new-end">Échéance <span class="label__optional">facultatif</span></label>' +
                '<input class="input" type="date" id="new-end" name="endDate" min="2026-01-01"></div>' +
            '</div>' +
            '<div class="field"><span class="label" id="new-prio-l">Priorité</span>' +
              '<div class="segmented segmented--prio" role="group" aria-labelledby="new-prio-l" data-pick="prio">' +
                Q.PRIORITIES.map(function (p) {
                  return '<button type="button" class="segmented__item" data-value="' + p.id + '" aria-pressed="' + (p.id === prio) + '"><span class="prio prio--' + p.id + '">' + esc(p.label) + '</span></button>';
                }).join('') + '</div></div>' +
            '<div class="field"><label class="label" for="new-client">Client / projet <span class="label__optional">facultatif</span></label>' +
              '<input class="input" id="new-client" name="client" list="dl-clients" autocomplete="off" placeholder="Ex. Le Fournil d’Ana">' +
              '<datalist id="dl-clients">' + Q.allClients().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
          '</div>' +
          '<div class="modal__footer">' +
            '<button type="button" class="btn btn--ghost" data-new-cancel>Annuler</button>' +
            '<button type="button" class="btn btn--secondary" data-new-detail>Créer et détailler</button>' +
            '<button type="submit" class="btn btn--primary">' + icon('plus') + 'Créer la tâche</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    var form = ov.querySelector('form');
    var title = form.querySelector('#new-t');

    U.$$('[data-pick]', form).forEach(function (group) {
      group.addEventListener('click', function (e) {
        var b = e.target.closest('[data-value]');
        if (!b) return;
        U.$$('[data-value]', group).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        if (group.getAttribute('data-pick') === 'cat') catId = b.getAttribute('data-value');
        else prio = b.getAttribute('data-value');
      });
    });

    title.addEventListener('input', function () {
      if (title.value.trim()) { form.querySelector('[data-field="title"]').classList.remove('field--error'); form.querySelector('#new-t-hint').hidden = true; title.removeAttribute('aria-invalid'); }
    });

    function create(openDetail) {
      if (!title.value.trim()) {
        form.querySelector('[data-field="title"]').classList.add('field--error');
        form.querySelector('#new-t-hint').hidden = false;
        title.setAttribute('aria-invalid', 'true');
        title.focus();
        return;
      }
      var t = S.createTask({
        title: title.value, categoryId: catId, status: form.status.value, priority: prio,
        endDate: form.endDate.value || null, client: form.client.value.trim()
      });
      U.closeLayer(ov, 'created');
      if (openDetail) { L.drawer.open(t.id); return; }
      U.toast({
        kind: 'success', icon: 'check', title: 'Tâche créée',
        text: '« ' + t.title + ' » rejoint la colonne ' + Q.statusLabel(t.status) + '.',
        actions: [{ label: 'Ouvrir le détail', fn: function () { L.drawer.open(t.id); } }]
      });
      U.announce('Tâche créée : ' + t.title);
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); create(false); });
    form.querySelector('[data-new-detail]').addEventListener('click', function () { create(true); });
    U.$$('[data-new-cancel]', form).forEach(function (b) { b.addEventListener('click', function () { U.closeLayer(ov, 'cancel'); }); });

    U.typo(ov);
    U.openLayer(ov, { initialFocus: '#new-t', returnTo: opts.returnTo });
  }

  L.taskForm = { open: open, defaultCategory: defaultCategory };
})(window.Lamia = window.Lamia || {});
