/* ==========================================================================
   Plateforme de suivi - Lamia — compteurs d'heures
   Pas de chrono : on met ses compteurs à jour à la main, par catégorie
   (Flow Line, Carnet by-pass, Auto-entreprise…), sans passer par une tâche.
   « + » sur la carte « Heures de la semaine » : durée, jour, note ; la
   fenêtre montre aussi les saisies de la semaine, qu'on peut retirer.
   Les heures saisies dans une tâche continuent de compter aussi.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, ST = L.shared.stats;
  var esc = U.esc, icon = U.icon;
  var QUICK = [['30 min', 30], ['1 h', 60], ['2 h', 120], ['3 h 30', 210], ['4 h', 240], ['7 h', 420]];

  function weekList(catId, anchor) {
    var w0 = D.startOfWeek(anchor), w1 = D.endOfWeek(anchor);
    return ST.hourEntries(S.get(), w0, w1).filter(function (e) { return e.categoryId === catId; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function listHTML(catId, anchor) {
    var list = weekList(catId, anchor), c = S.category(catId);
    var total = ST.minutesByCategory(S.get(), D.startOfWeek(anchor), D.endOfWeek(anchor))[catId] || 0;
    return '<div class="hours-log"><p class="hours-log__title">' + U.catDot(c) + esc(c.name) + ' · semaine du ' + esc(D.dayMonth(D.startOfWeek(anchor))) +
      '<strong class="num">' + D.duration(total) + '</strong></p>' +
      (list.length ? '<ul class="hours-log__list" role="list">' + list.map(function (e) {
        return '<li><span class="hours-log__day">' + esc(D.cap(D.DAYS_SHORT[D.dow(e.date)])) + ' ' + +e.date.slice(8) + '</span>' +
          '<span class="hours-log__note">' + esc(e.note || '') + '</span><strong class="num">' + D.duration(e.minutes) + '</strong>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hours-del="' + e.id + '" aria-label="Retirer ' + esc(D.duration(e.minutes)) + ' du ' + esc(D.dayMonthLong(e.date)) + '">' + icon('trash') + '</button></li>';
      }).join('') + '</ul>' : '<p class="hint">Rien de saisi au compteur cette semaine' + (total ? ' (les heures viennent des tâches).' : '.') + '</p>') + '</div>';
  }

  // Ajouter des heures à un compteur. catId : catégorie proposée (facultatif)
  function open(catId, returnTo) {
    var cats = S.get().categories, today = D.today();
    catId = catId && S.category(catId) && S.category(catId).id === catId ? catId : cats[0].id;
    U.dialog({
      title: 'Ajouter des heures',
      desc: 'Ton compteur, mis à jour à la main.',
      size: 'md', returnTo: returnTo, confirmLabel: 'Ajouter',
      initialFocus: '#hr-dur',
      body: '<div class="form-grid">' +
        '<div class="field"><label class="label" for="hr-cat">Pour</label><select class="select" id="hr-cat" name="cat">' +
          cats.map(function (c) { return '<option value="' + c.id + '"' + (c.id === catId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label class="label" for="hr-day">Jour</label><input class="input" type="date" id="hr-day" name="day" value="' + today + '" max="' + today + '"></div>' +
        '<div class="field field--full"><label class="label" for="hr-dur">Durée</label><input class="input" id="hr-dur" name="dur" autocomplete="off" placeholder="7h, 1h30, 90 ou 1,5" aria-describedby="hr-hint">' +
          '<div class="hours-quick" role="group" aria-label="Durées rapides">' + QUICK.map(function (q) { return '<button type="button" class="chip-btn" data-hours-quick="' + q[1] + '">' + q[0] + '</button>'; }).join('') + '</div>' +
          '<p class="hint" id="hr-hint" data-hr-hint>« 7h », « 1h30 », « 90 » (minutes) ou « 1,5 » : comme tu préfères.</p></div>' +
        '<div class="field field--full"><label class="label" for="hr-note">Note <span class="text-subtle">facultatif</span></label><input class="input" id="hr-note" name="note" maxlength="120" placeholder="ex. Maquettes Kinéo, réunion client…"></div>' +
        '<div class="field--full" data-hours-log>' + listHTML(catId, today) + '</div>' +
        '</div>',
      onMount: function (form) {
        var box = form.querySelector('[data-hours-log]');
        function refresh() { box.innerHTML = listHTML(form.cat.value, form.day.value || today); }
        form.addEventListener('change', function (e) { if (e.target.name === 'cat' || e.target.name === 'day') refresh(); });
        form.addEventListener('input', function (e) {
          if (e.target.name !== 'dur') return;
          var m = D.parseDuration(e.target.value);
          form.querySelector('[data-hr-hint]').textContent = e.target.value.trim() ? (m ? '= ' + D.duration(m) : 'Exemples : 7h, 1h30, 90, 1,5') : '« 7h », « 1h30 », « 90 » (minutes) ou « 1,5 » : comme tu préfères.';
        });
        form.addEventListener('click', function (e) {
          var q = e.target.closest('[data-hours-quick]');
          if (q) { form.dur.value = D.duration(+q.getAttribute('data-hours-quick')).replace(/\s/g, ''); form.dur.dispatchEvent(new Event('input', { bubbles: true })); form.dur.focus(); return; }
          var del = e.target.closest('[data-hours-del]');
          if (del) {
            var gone = S.removeHours(del.getAttribute('data-hours-del'));
            refresh();
            if (gone) U.toast({ icon: 'trash', title: 'Retiré du compteur', text: D.duration(gone.minutes) + ', ' + D.dayMonthLong(gone.date) + '.', duration: 5000, actions: [{ label: 'Annuler', fn: function () { S.restoreHours(gone); refresh(); } }] });
          }
        });
      },
      onConfirm: function (form) {
        var m = D.parseDuration(form.dur.value);
        if (!m) {
          form.dur.closest('.field').classList.add('field--error');
          form.querySelector('[data-hr-hint]').textContent = 'Indique une durée, par exemple 7h, 1h30, 90 ou 1,5.';
          form.dur.focus();
          return false;
        }
        var day = D.valid(form.day.value) && form.day.value <= today ? form.day.value : today;
        var c = S.category(form.cat.value);
        var e = S.addHours({ categoryId: c.id, date: day, minutes: m, note: form.note.value.trim() });
        U.toast({ kind: 'success', icon: 'check', title: '+' + D.NBSP + D.duration(m) + ' pour ' + c.name, text: day === today ? 'Aujourd’hui.' : D.cap(D.dayMonthLong(day)) + '.', duration: 5000,
          actions: [{ label: 'Annuler', fn: function () { S.removeHours(e.id); } }] });
      }
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add-hours]');
    if (!b) return;
    e.preventDefault();
    open(b.getAttribute('data-add-hours') || null, b);
  });

  L.hours = { open: open };
})(window.Lamia = window.Lamia || {});
