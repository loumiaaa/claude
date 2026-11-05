/* ==========================================================================
   Plateforme de suivi - Lamia — habitudes
   Petites cases à cocher chaque jour (eau, sommeil, lecture, écrans…),
   avec des séries. Une habitude peut avoir un objectif chiffré (8 verres)
   et des jours prévus (lundi → vendredi…). Logique : shared/habits.js.
   - Vue « Habitudes » (#habitudes) : la journée, la semaine, la liste.
   - L.habitsUI.todayHTML() : la carte compacte de l'Accueil.
   Les boutons [data-hab-*] marchent partout (délégation sur le document).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, HB = window.LamiaShared.habits;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var ICONS = ['💧', '😴', '📖', '📵', '🧘', '🚶', '✏️', '🌤️', '🍎', '🥦', '💊', '🦷', '🧴', '🎧', '🙏', '📝', '🧹', '💪', '🎨', '🌱'];
  var DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

  var el = null, day = null;      // jour affiché dans la vue (aujourd'hui par défaut)

  function hs() { return S.habits(); }
  function active(date) { return hs().list.filter(function (h) { return HB.isActive(h, date); }); }
  function habit(id) { return hs().list.filter(function (h) { return h.id === id; })[0]; }
  function daysLabel(days) {
    if (days.length === 7) return 'Tous les jours';
    if (days.join() === '0,1,2,3,4') return 'En semaine';
    if (days.join() === '5,6') return 'Le week-end';
    return days.map(function (d) { return DAY_NAMES[d].slice(0, 3) + '.'; }).join(' ');
  }
  function flame(n) { return n >= 2 ? '<span class="hab-streak" title="Série en cours">🔥' + NB + U.plural(n, 'jour') + '</span>' : ''; }

  /* --- Une ligne « cocher » ----------------------------------------------------- */
  function rowHTML(h, date, compact) {
    var log = hs().log, n = HB.count(log, h, date), done = n >= h.target, today = D.today();
    var streak = HB.streak(log, h, today);
    var ctl;
    if (h.target === 1) {
      ctl = '<button type="button" class="hab-check' + (done ? ' is-done' : '') + '" data-hab-toggle="' + h.id + '" data-date="' + date + '" data-focus-key="hab-' + h.id + '" aria-pressed="' + done + '" aria-label="' + esc(h.name) + (done ? ', fait' : ', à faire') + '">' + icon('check') + '</button>';
    } else {
      ctl = '<div class="hab-step" role="group" aria-label="' + esc(h.name) + '">' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-step="-1" data-id="' + h.id + '" data-date="' + date + '" data-focus-key="habm-' + h.id + '" aria-label="Un de moins"' + (n ? '' : ' disabled') + '>' + icon('minus') + '</button>' +
        '<span class="hab-step__n num' + (done ? ' is-done' : '') + '" aria-live="polite">' + n + '<span class="text-subtle">/' + h.target + '</span></span>' +
        '<button type="button" class="btn btn--soft btn--icon btn--sm" data-hab-step="1" data-id="' + h.id + '" data-date="' + date + '" data-focus-key="habp-' + h.id + '" aria-label="Un de plus' + (h.unit ? ' (' + esc(h.unit) + ')' : '') + '">' + icon('plus') + '</button></div>';
    }
    return '<li class="hab-row' + (done ? ' is-done' : '') + (compact ? ' hab-row--compact' : '') + '">' +
      '<span class="hab-row__icon" aria-hidden="true">' + esc(h.icon) + '</span>' +
      '<span class="hab-row__text"><span class="hab-row__name">' + esc(h.name) + '</span>' +
        '<span class="hab-row__sub">' + [h.target > 1 ? '<span>' + h.target + (h.unit ? NB + esc(h.unit) : ' fois') + '</span>' : '', flame(streak), streak < 2 && !compact ? '<span class="text-subtle">' + esc(daysLabel(h.days)) + '</span>' : ''].filter(Boolean).join('') + '</span></span>' +
      (h.target > 1 ? '<span class="hab-row__bar">' + U.progress(Math.min(100, Math.round(n / h.target * 100)), 'progress--sm' + (done ? ' progress--success' : '')) + '</span>' : '') +
      ctl + '</li>';
  }

  /* --- Carte de l'Accueil ------------------------------------------------------------ */
  function todayHTML() {
    var today = D.today(), list = active(today), sum = HB.day(hs().list, hs().log, today);
    var body = list.length
      ? '<ul class="hab-list" role="list">' + list.map(function (h) { return rowHTML(h, today, true); }).join('') + '</ul>'
      : hs().list.length ? '<p class="life-card__muted">Rien de prévu aujourd’hui : profite.</p>'
        : '<p class="life-card__muted">Eau, sommeil, lecture… Choisis 2 ou 3 petites habitudes à suivre.</p>';
    return '<section class="glass card life-card" aria-labelledby="dh-hab"><div class="card__header"><div><h2 class="card__title" id="dh-hab">🌱 Habitudes</h2>' +
      '<p class="card__subtitle">' + (sum.total ? sum.done + ' sur ' + sum.total + ' aujourd’hui' : 'Une petite case par jour') + '</p></div>' +
      '<a class="btn btn--ghost btn--sm" href="#habitudes">' + (hs().list.length ? 'Voir' : 'Commencer') + icon('chevron-right') + '</a></div>' +
      (sum.total ? U.progress(Math.round(sum.done / sum.total * 100), 'progress--sm' + (sum.all ? ' progress--success' : '')) : '') + body + '</section>';
  }

  /* --- Vue ------------------------------------------------------------------------------ */
  function weekGrid(anchor) {
    var w0 = D.startOfWeek(anchor), today = D.today(), log = hs().log;
    var list = hs().list.filter(function (h) { return !h.archived; });
    if (!list.length) return '';
    var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return D.addDays(w0, i); });
    return '<div class="table-scroll"><table class="hab-week"><caption class="sr-only">Habitudes de la semaine</caption><thead><tr><th scope="col"><span class="sr-only">Habitude</span></th>' +
      days.map(function (d, i) { return '<th scope="col" class="' + (d === today ? 'is-today' : '') + '"><abbr title="' + esc(D.cap(D.dayMonthLong(d))) + '">' + DAY_LETTERS[i] + '</abbr><span class="hab-week__date">' + +d.slice(8) + '</span></th>'; }).join('') +
      '<th scope="col" class="hab-week__rate">Semaine</th></tr></thead><tbody>' +
      list.map(function (h) {
        var r = HB.rate(log, h, w0, D.addDays(w0, 6), today);
        return '<tr><th scope="row"><span aria-hidden="true">' + esc(h.icon) + '</span> ' + esc(h.name) + '</th>' + days.map(function (d) {
          if (!HB.isActive(h, d)) return '<td><span class="hab-cell hab-cell--off" title="Pas prévu">·</span></td>';
          var n = HB.count(log, h, d), done = n >= h.target, future = d > today;
          var label = esc(h.name) + ', ' + esc(D.dayMonthLong(d)) + (done ? ', fait' : n ? ', ' + n + ' sur ' + h.target : ', pas fait');
          return '<td><button type="button" class="hab-cell' + (done ? ' is-done' : n ? ' is-part' : '') + (d === today ? ' is-today' : '') + '" data-hab-cell="' + h.id + '" data-date="' + d + '" data-focus-key="hc-' + h.id + d + '"' + (future ? ' disabled' : '') + ' aria-pressed="' + done + '" aria-label="' + label + '">' + (done ? icon('check') : n ? '<span class="num">' + n + '</span>' : '') + '</button></td>';
        }).join('') + '<td class="hab-week__rate num">' + (r.pct == null ? '—' : r.pct + NB + '%') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function manageHTML() {
    var list = hs().list;
    if (!list.length) return '';
    return '<ul class="hab-manage" role="list">' + list.map(function (h, i) {
      var best = HB.bestStreak(hs().log, h, D.today());
      return '<li class="' + (h.archived ? 'is-archived' : '') + '"><span class="hab-row__icon" aria-hidden="true">' + esc(h.icon) + '</span>' +
        '<span class="hab-row__text"><span class="hab-row__name">' + esc(h.name) + (h.archived ? ' <span class="chip">En pause</span>' : '') + '</span>' +
        '<span class="hab-row__sub">' + esc(daysLabel(h.days)) + (h.target > 1 ? ' · ' + h.target + (h.unit ? NB + esc(h.unit) : ' fois') + ' par jour' : '') + (best ? ' · record ' + U.plural(best, 'jour') : '') + '</span></span>' +
        '<span class="hab-manage__actions">' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-move="-1" data-id="' + h.id + '" data-focus-key="hu-' + h.id + '" aria-label="Monter « ' + esc(h.name) + ' »"' + (i ? '' : ' disabled') + '>' + icon('arrow-up') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-move="1" data-id="' + h.id + '" data-focus-key="hd-' + h.id + '" aria-label="Descendre « ' + esc(h.name) + ' »"' + (i < list.length - 1 ? '' : ' disabled') + '>' + icon('arrow-down') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-edit="' + h.id + '" data-focus-key="he-' + h.id + '" aria-label="Modifier « ' + esc(h.name) + ' »">' + icon('edit') + '</button>' +
        '</span></li>';
    }).join('') + '</ul>';
  }

  function ideasHTML() {
    var have = hs().list.map(function (h) { return h.name.toLowerCase(); });
    var ideas = HB.SUGGESTIONS.filter(function (x) { return have.indexOf(x.name.toLowerCase()) < 0; });
    if (!ideas.length) return '';
    return '<div class="hab-ideas"><p class="hab-ideas__label">Idées en un clic</p><div class="hab-ideas__list">' + ideas.map(function (x, i) {
      return '<button type="button" class="chip-btn" data-hab-idea="' + i + '" data-focus-key="hi-' + i + '">' + esc(x.icon) + ' ' + esc(x.name) + (x.target > 1 ? ' (' + x.target + NB + esc(x.unit) + ')' : '') + '</button>';
    }).join('') + '</div></div>';
  }

  function render() {
    if (!el) return;
    var today = D.today();
    day = day && day <= today ? day : today;
    var log = hs().log, list = active(day), sum = HB.day(hs().list, log, day);
    var w0 = D.startOfWeek(today), week = HB.period(hs().list, log, w0, D.addDays(w0, 6), today);
    var best = HB.maxStreak(hs().list, log, today, false);
    var tile = function (ic, label, value, extra) {
      return '<article class="glass stat"><div class="stat__head"><span class="stat__icon">' + icon(ic) + '</span><span class="stat__label">' + esc(label) + '</span></div><div class="stat__value">' + value + '</div>' + (extra ? '<span class="stat__delta">' + extra + '</span>' : '') + '</article>';
    };
    var dayTitle = day === today ? 'Aujourd’hui' : day === D.addDays(today, -1) ? 'Hier' : D.cap(D.dayMonthLong(day));
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Accueil</p><h1 class="h1" id="h-habits" tabindex="-1">Habitudes</h1>' +
        '<p class="page-head__lead">Une petite case par jour. Les séries se construisent tout doucement, et un jour manqué n’efface rien.</p></div>' +
        '<div class="page-head__actions"><button type="button" class="btn btn--primary" data-hab-new>' + icon('plus') + 'Nouvelle habitude</button></div></header>' +
      (hs().list.length ? '<div class="kpi-row kpi-row--3">' +
        tile('check', 'Aujourd’hui', HB.day(hs().list, log, today).done + '<span class="stat__unit">/' + HB.day(hs().list, log, today).total + '</span>', HB.day(hs().list, log, today).all ? 'Tout est coché, bravo !' : 'Encore un petit effort') +
        tile('calendar', 'Cette semaine', week.pct == null ? '—' : week.pct + '<span class="stat__unit">' + NB + '%</span>', U.plural(week.done, 'case') + ' cochée' + (week.done > 1 ? 's' : '')) +
        tile('sparkle', 'Meilleure série', best + '<span class="stat__unit">' + NB + (best > 1 ? 'jours' : 'jour') + '</span>', best >= 7 ? 'Belle régularité' : 'Ça commence ici') +
      '</div>' : '') +
      '<div class="hab-layout">' +
        '<section class="glass card" aria-labelledby="hab-day"><div class="card__header hab-day-head"><div><h2 class="card__title" id="hab-day">' + esc(dayTitle) + '</h2>' +
          '<p class="card__subtitle">' + (sum.total ? sum.done + ' sur ' + sum.total + ' fait' + (sum.done > 1 ? 's' : '') : 'Rien de prévu') + '</p></div>' +
          '<div class="hab-day-nav"><button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-day="-1" data-focus-key="hd-prev" aria-label="Jour précédent">' + icon('chevron-left') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-day="1" data-focus-key="hd-next" aria-label="Jour suivant"' + (day >= today ? ' disabled' : '') + '>' + icon('chevron-right') + '</button></div></div>' +
          (sum.total ? U.progress(Math.round(sum.done / sum.total * 100), sum.all ? 'progress--success' : '') : '') +
          (list.length ? '<ul class="hab-list" role="list">' + list.map(function (h) { return rowHTML(h, day, false); }).join('') + '</ul>'
            : '<p class="hint">' + (hs().list.length ? 'Aucune habitude prévue ce jour-là.' : 'Commence par une ou deux habitudes faciles : c’est la régularité qui compte, pas la quantité.') + '</p>') +
          (hs().list.length < 3 ? ideasHTML() : '') +
        '</section>' +
        (hs().list.length ? '<section class="glass card" aria-labelledby="hab-week"><div class="card__header"><div><h2 class="card__title" id="hab-week">Cette semaine</h2><p class="card__subtitle">Touche une case pour la cocher ou la décocher</p></div></div>' + weekGrid(today) + '</section>' : '') +
      '</div>' +
      (hs().list.length ? '<section class="glass card" aria-labelledby="hab-all"><div class="card__header"><div><h2 class="card__title" id="hab-all">Mes habitudes</h2><p class="card__subtitle">Ordre, jours prévus, pause</p></div></div>' + manageHTML() + (hs().list.length >= 3 ? ideasHTML() : '') + '</section>' : '');
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  /* --- Ajouter / modifier ------------------------------------------------------------ */
  function openEditor(h, returnTo) {
    var isNew = !h;
    h = h || { name: '', icon: '💧', target: 1, unit: '', days: [0, 1, 2, 3, 4, 5, 6] };
    U.dialog({
      title: isNew ? 'Nouvelle habitude' : 'Modifier l’habitude',
      size: 'md',
      returnTo: returnTo,
      confirmLabel: isNew ? 'Ajouter' : 'Enregistrer',
      body: '<div class="form-grid">' +
        '<div class="field field--full"><label class="label" for="hb-name">Nom</label><input class="input" id="hb-name" name="name" maxlength="60" value="' + esc(h.name) + '" placeholder="ex. Boire de l’eau" required></div>' +
        '<fieldset class="field field--full hab-icons"><legend class="label">Icône</legend><div class="hab-icons__list">' +
          ICONS.map(function (ic, i) { return '<label class="hab-icon"><input type="radio" name="icon" value="' + ic + '"' + (ic === h.icon ? ' checked' : '') + '><span aria-hidden="true">' + ic + '</span><span class="sr-only">Icône ' + (i + 1) + '</span></label>'; }).join('') +
          (ICONS.indexOf(h.icon) < 0 ? '<label class="hab-icon"><input type="radio" name="icon" value="' + esc(h.icon) + '" checked><span aria-hidden="true">' + esc(h.icon) + '</span></label>' : '') +
        '</div></fieldset>' +
        '<div class="field"><label class="label" for="hb-target">Combien de fois par jour ?</label><input class="input" id="hb-target" name="target" type="number" min="1" max="50" value="' + h.target + '"><p class="hint">1 = une simple case à cocher</p></div>' +
        '<div class="field"><label class="label" for="hb-unit">Unité <span class="text-subtle">facultatif</span></label><input class="input" id="hb-unit" name="unit" maxlength="20" value="' + esc(h.unit) + '" placeholder="verres, pages…"></div>' +
        '<fieldset class="field field--full"><legend class="label">Jours prévus</legend><div class="hab-days">' +
          DAY_NAMES.map(function (n, i) { return '<label class="hab-day"><input type="checkbox" name="days" value="' + i + '"' + (h.days.indexOf(i) >= 0 ? ' checked' : '') + '><span aria-hidden="true">' + DAY_LETTERS[i] + '</span><span class="sr-only">' + n + '</span></label>'; }).join('') +
        '</div><p class="hint">Un jour non prévu ne casse jamais une série.</p></fieldset>' +
        (isNew ? '' : '<div class="field field--full hab-danger">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-hb-pause>' + icon(h.archived ? 'play' : 'pause') + (h.archived ? 'Reprendre cette habitude' : 'Mettre en pause') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--sm btn--danger-text" data-hb-del>' + icon('trash') + 'Supprimer</button></div>') +
        '</div>',
      onMount: function (form) {
        var p = form.querySelector('[data-hb-pause]'), d = form.querySelector('[data-hb-del]');
        if (p) p.addEventListener('click', function () { U.closeLayer(document.getElementById('overlay-dialog'), 'cancel'); S.updateHabit(h.id, { archived: !h.archived }); U.toast({ icon: h.archived ? 'pause' : 'play', title: h.archived ? 'Habitude en pause' : 'Habitude reprise', text: '« ' + h.name + ' »', duration: 3000 }); });
        if (d) d.addEventListener('click', function () {
          U.closeLayer(document.getElementById('overlay-dialog'), 'cancel');
          U.dialog({ title: 'Supprimer « ' + h.name + ' » ?', text: 'Son historique et ses séries seront effacés. Tu peux aussi la mettre en pause pour garder l’historique.', danger: true, confirmLabel: 'Supprimer', onConfirm: function () { S.removeHabit(h.id); } });
        });
      },
      onConfirm: function (form) {
        var name = form.name.value.trim();
        if (!name) { form.name.closest('.field').classList.add('field--error'); form.name.focus(); return false; }
        var days = [].slice.call(form.querySelectorAll('[name=days]:checked')).map(function (x) { return +x.value; });
        if (!days.length) { U.toast({ kind: 'warning', icon: 'alert', title: 'Choisis au moins un jour', duration: 3500 }); return false; }
        var iconChecked = form.querySelector('[name=icon]:checked');
        var data = { name: name, icon: iconChecked ? iconChecked.value : '✨', target: Math.max(1, Math.min(50, Math.round(+form.target.value || 1))), unit: form.unit.value.trim(), days: days };
        if (isNew) { S.addHabit(data); U.toast({ kind: 'success', icon: 'check', title: 'Habitude ajoutée', text: '« ' + name + ' » : à toi de jouer !', duration: 3000 }); }
        else S.updateHabit(h.id, data);
      }
    });
  }

  /* --- Actions (partout dans l'interface) ----------------------------------------------- */
  function afterChange(date) {
    if (date !== D.today()) return;
    var sum = HB.day(hs().list, hs().log, date);
    if (sum.all && sum.total >= 2) L.fun.celebrate({ title: 'Toutes tes habitudes du jour !', text: sum.total + ' sur ' + sum.total + ', bravo.' });
  }
  function setCount(id, date, n) {
    var h = habit(id);
    if (!h) return;
    var was = HB.isDone(hs().log, h, date);
    S.setHabitCount(id, date, n);
    if (!was && HB.isDone(hs().log, h, date)) afterChange(date);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hab-toggle], [data-hab-step], [data-hab-cell]');
    if (!b || b.disabled) return;
    var date = b.getAttribute('data-date');
    if (b.hasAttribute('data-hab-toggle')) {
      var h = habit(b.getAttribute('data-hab-toggle'));
      if (h) setCount(h.id, date, HB.isDone(hs().log, h, date) ? 0 : h.target);
    } else if (b.hasAttribute('data-hab-step')) {
      var h2 = habit(b.getAttribute('data-id'));
      if (h2) setCount(h2.id, date, HB.count(hs().log, h2, date) + +b.getAttribute('data-hab-step'));
    } else {
      var h3 = habit(b.getAttribute('data-hab-cell'));
      if (h3) setCount(h3.id, date, HB.isDone(hs().log, h3, date) ? 0 : h3.target);
    }
  });

  function mount(node) {
    el = node;
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-hab-new]'))) { openEditor(null, b); return; }
      if ((b = e.target.closest('[data-hab-edit]'))) { openEditor(habit(b.getAttribute('data-hab-edit')), b); return; }
      if ((b = e.target.closest('[data-hab-move]'))) { S.moveHabit(b.getAttribute('data-id'), +b.getAttribute('data-hab-move')); return; }
      if ((b = e.target.closest('[data-hab-day]'))) { day = D.addDays(day || D.today(), +b.getAttribute('data-hab-day')); render(); return; }
      if ((b = e.target.closest('[data-hab-idea]'))) {
        var x = HB.SUGGESTIONS.filter(function (s) { return hs().list.map(function (h) { return h.name.toLowerCase(); }).indexOf(s.name.toLowerCase()) < 0; })[+b.getAttribute('data-hab-idea')];
        if (x) { S.addHabit({ name: x.name, icon: x.icon, target: x.target, unit: x.unit }); U.toast({ kind: 'success', icon: 'check', title: 'Habitude ajoutée', text: '« ' + x.name + ' »', duration: 2500 }); }
      }
    });
    S.subscribe(function (type) {
      if (type !== 'habits' && type !== 'reset') return;
      if (L.app.view() !== 'habits') { el.dataset.stale = '1'; return; }
      render();
    });
  }

  L.habitsUI = { todayHTML: todayHTML };
  L.views = L.views || {};
  L.views.habits = { title: 'Habitudes', mount: mount, render: render, show: function () { day = D.today(); delete el.dataset.stale; render(); } };
})(window.Lamia = window.Lamia || {});
