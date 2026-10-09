/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · chrono
   Widget toujours visible (barre latérale ; pastille au-dessus des onglets
   sur mobile). Un seul chrono actif : en lancer un autre arrête le premier,
   avec un message. Le chrono survit à la fermeture (activeTimer dans
   data.json). Au-delà de 10 h, alerte douce et correction de la durée.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon;
  var TEN_HOURS = 10 * 3600 * 1000;

  function elapsed() { return S.timerElapsed(); }

  function widgetHTML() {
    var st = S.get();
    var tm = st.activeTimer;
    if (!tm || !S.task(tm.taskId)) {
      var last = st.lastTimerTaskId && S.task(st.lastTimerTaskId);
      return '<div class="chrono__head"><span class="chrono__icon">' + icon('timer') + '</span><span class="chrono__eyebrow">Chrono</span></div>' +
        '<p class="chrono__idle">Aucun chrono en cours. Une pause bien méritée ?</p>' +
        (last && last.status !== 'done'
          ? '<button type="button" class="btn btn--soft btn--sm btn--block chrono__resume" data-chrono="start" data-task="' + last.id + '" data-focus-key="w-stop">' + icon('play') + '<span class="chrono__resume-label">Reprendre « ' + esc(last.title) + ' »</span></button>'
          : '<a class="btn btn--soft btn--sm btn--block" href="#dashboard" data-focus-key="w-stop">' + icon('play') + 'Choisir une tâche</a>');
    }
    var t = S.task(tm.taskId);
    var c = S.category(t.categoryId);
    var paused = !!tm.pausedAt;
    return '<div class="chrono__head"><span class="chrono__live' + (paused ? ' is-paused' : '') + '" aria-hidden="true"></span>' +
        '<span class="chrono__eyebrow">' + (paused ? 'Chrono en pause' : 'Chrono en cours') + '</span></div>' +
      '<button type="button" class="chrono__task" data-open-task="' + t.id + '" title="Ouvrir le détail de la tâche">' + esc(t.title) + '</button>' +
      '<div class="chrono__meta">' + U.catDot(c) + '<span>' + esc(c.name) + (t.client ? ' · ' + esc(t.client) : '') + '</span></div>' +
      '<div class="chrono__time num" role="timer" aria-label="Temps écoulé" data-timer-elapsed>' + D.clock(elapsed()) + '</div>' +
      (elapsed() > TEN_HOURS ? '<button type="button" class="btn btn--ghost btn--sm btn--block chrono__fix" data-chrono="fix" data-focus-key="w-fix">' + icon('edit') + 'Oublié ? Corriger la durée</button>' : '') +
      '<div class="chrono__actions">' +
        (paused
          ? '<button type="button" class="btn btn--soft btn--sm" data-chrono="resume" data-focus-key="w-toggle">' + icon('play') + 'Reprendre</button>'
          : '<button type="button" class="btn btn--soft btn--sm" data-chrono="pause" data-focus-key="w-toggle">' + icon('pause') + 'Pause</button>') +
        '<button type="button" class="btn btn--secondary btn--sm" data-chrono="stop" data-focus-key="w-stop">' + icon('stop') + 'Stop</button>' +
      '</div>';
  }

  function pillHTML() {
    var tm = S.get().activeTimer;
    var t = tm && S.task(tm.taskId);
    if (!t) return '';
    var paused = !!tm.pausedAt;
    return '<span class="chrono__live' + (paused ? ' is-paused' : '') + '" aria-hidden="true"></span>' +
      '<button type="button" class="chrono-pill__task" data-open-task="' + t.id + '"><span class="sr-only">' + (paused ? 'Chrono en pause sur ' : 'Chrono en cours sur ') + '</span>' + esc(t.title) + '</button>' +
      '<span class="chrono-pill__time num" role="timer" aria-label="Temps écoulé" data-timer-elapsed>' + D.clock(elapsed()) + '</span>' +
      (paused
        ? '<button type="button" class="btn btn--soft btn--icon btn--sm" data-chrono="resume" data-focus-key="p-toggle" aria-label="Reprendre le chrono">' + icon('play') + '</button>'
        : '<button type="button" class="btn btn--soft btn--icon btn--sm" data-chrono="pause" data-focus-key="p-toggle" aria-label="Mettre le chrono en pause">' + icon('pause') + '</button>') +
      '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-chrono="stop" data-focus-key="p-stop" aria-label="Arrêter le chrono et enregistrer">' + icon('stop') + '</button>';
  }

  function render() {
    U.$$('[data-chrono-widget]').forEach(function (el) {
      U.keepFocus(el, function () { el.innerHTML = widgetHTML(); });
    });
    var pill = U.$('[data-chrono-pill]');
    if (pill) {
      var html = pillHTML();
      pill.hidden = !html;
      document.documentElement.classList.toggle('has-chrono', !!html);
      U.keepFocus(pill, function () { pill.innerHTML = html; });
    }
  }

  // Met à jour le temps qui défile partout, sans re-rendu
  function tick() {
    var tm = S.get().activeTimer;
    if (!tm) return;
    var txt = D.clock(elapsed());
    U.$$('[data-timer-elapsed]').forEach(function (el) { if (el.textContent !== txt) el.textContent = txt; });
  }

  function start(id) {
    var t = S.task(id);
    if (!t) return;
    var tm = S.get().activeTimer;
    if (tm && tm.taskId === id) {
      if (tm.pausedAt) resume();
      return;
    }
    if (tm && elapsed() > TEN_HOURS) {
      // le chrono précédent a tourné trop longtemps : correction d'abord
      return confirmLong(function () { start(id); });
    }
    var res = S.startTimer(id);
    if (res.stopped) {
      var prev = S.task(res.stopped.taskId);
      U.toast({
        kind: 'success', icon: 'timer', title: 'Chrono basculé sur « ' + t.title + ' »',
        text: res.stopped.minutes
          ? (prev ? 'Temps enregistré sur « ' + prev.title + ' » : ' : 'Temps enregistré : ') + D.duration(res.stopped.minutes) + '. Un seul chrono à la fois.'
          : 'Le précédent avait tourné moins de 10 secondes : rien d’enregistré. Un seul chrono à la fois.'
      });
    } else {
      U.toast({ icon: 'play', title: 'Chrono lancé', text: '« ' + t.title + ' ». Bon courage !', duration: 3500 });
    }
    U.announce('Chrono lancé sur ' + t.title);
  }

  function pause() { S.pauseTimer(); U.announce('Chrono en pause'); }
  function resume() { S.resumeTimer(); U.announce('Chrono relancé'); }

  function confirmLong(after) {
    var tm = S.get().activeTimer;
    if (!tm) return;
    var t = tm && S.task(tm.taskId);
    var min = Math.round(elapsed() / 60000);
    var startDay = D.dateOf(Date.parse(tm.startedAt));
    if (!D.valid(startDay) || startDay > D.today()) startDay = D.today();
    U.dialog({
      title: 'Ce chrono tourne depuis ' + D.duration(min),
      desc: t ? '« ' + t.title + ' »' : '',
      body: '<p class="text-muted text-sm">Un oubli, ça arrive à tout le monde. Quelle durée veux-tu garder ?</p>' +
        '<div class="form-grid">' +
        '<div class="field"><label class="label" for="dlg-duration">Durée à enregistrer</label>' +
        '<input class="input" id="dlg-duration" name="duration" value="7h" autocomplete="off" inputmode="text">' +
        '<p class="hint" data-duration-hint>= 7' + D.NBSP + 'h</p></div>' +
        '<div class="field"><label class="label" for="dlg-day">Jour travaillé</label>' +
        '<input class="input" type="date" id="dlg-day" name="day" value="' + startDay + '" max="' + D.today() + '"></div></div>',
      confirmLabel: 'Enregistrer cette durée',
      onMount: function (form) {
        var input = form.querySelector('input');
        input.addEventListener('input', function () {
          var m = D.parseDuration(input.value);
          form.querySelector('[data-duration-hint]').textContent = m ? '= ' + D.duration(m) : 'Exemples : 1h30, 90, 1,5';
        });
      },
      onConfirm: function (form) {
        var m = D.parseDuration(form.querySelector('input').value);
        if (!m) { form.querySelector('.field').classList.add('field--error'); form.querySelector('[data-duration-hint]').textContent = 'Indique une durée, par exemple 1h30, 90 ou 1,5.'; return false; }
        var day = form.querySelector('[name="day"]').value;
        doStop(m, D.valid(day) ? day : null);
        if (after) setTimeout(after, 50);
      }
    });
  }

  function doStop(minutes, date) {
    var res = S.stopTimer(minutes != null ? { minutes: minutes, date: date } : null);
    if (!res) return;
    var t = S.task(res.taskId);
    if (!res.entries.length) {
      U.toast({ icon: 'timer', title: 'Chrono arrêté', text: 'Moins de 10 secondes : rien n’a été enregistré.', duration: 3500 });
      U.announce('Chrono arrêté, rien enregistré');
      return;
    }
    U.toast({
      kind: 'success', icon: 'check',
      title: 'Temps enregistré : ' + D.duration(res.minutes),
      text: t ? 'Sur « ' + t.title + ' ». Tu peux corriger l’entrée dans le détail.' : '',
      actions: t ? [{ label: 'Voir la tâche', fn: function () { L.drawer.open(t.id, { section: 'hours' }); } }] : []
    });
    U.announce('Chrono arrêté. Temps enregistré : ' + D.duration(res.minutes));
  }

  function stop() {
    if (!S.get().activeTimer) return;
    if (elapsed() > TEN_HOURS) return confirmLong();
    doStop();
  }

  // Délégation : boutons [data-chrono] partout dans l'interface
  var lastAction = 0;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-chrono]');
    if (b && b.tagName === 'BUTTON') {
      // QA-07 : un double-clic vaut un clic (le 2e tomberait sur le bouton qui remplace le 1er)
      // (au clavier, e.detail vaut 0 : les actions enchaînées ne sont jamais freinées)
      if (e.detail > 1 || (e.detail === 1 && Date.now() - lastAction < 350)) { e.preventDefault(); return; }
      if (e.detail) lastAction = Date.now();
      var a = b.getAttribute('data-chrono');
      if (a === 'start') start(b.getAttribute('data-task'));
      else if (a === 'pause') pause();
      else if (a === 'resume') resume();
      else if (a === 'stop') stop();
      else if (a === 'fix') confirmLong();
      return;
    }
    var o = e.target.closest('[data-open-task]');
    if (o && !o.closest('.kanban')) { e.preventDefault(); L.drawer.open(o.getAttribute('data-open-task')); }
  });

  L.chrono = { render: render, tick: tick, start: start, pause: pause, resume: resume, stop: stop, elapsed: elapsed, confirmLong: confirmLong };
})(window.Lamia = window.Lamia || {});
