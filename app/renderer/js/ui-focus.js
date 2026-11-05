/* ==========================================================================
   Plateforme de suivi - Lamia — mode focus (Pomodoro)
   Le seul minuteur de la plateforme. Sessions de concentration (25 min par
   défaut) entrecoupées de pauses (5 min, et 15 min toutes les 4 sessions).
   Il n'ajoute aucune heure : les heures se notent à la main dans les
   compteurs (carte « Heures de la semaine », ui-hours.js).
   Pendant la concentration, Memeow fait la sieste ; à la pause, elle se
   réveille et miaule pour te rappeler de souffler (notification + petit son).
   L'état du minuteur reste sur l'appareil (localStorage) : il survit à un
   rechargement. Les sessions terminées sont enregistrées (badges, récap).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var KEY = 'lamia:focus';
  var PHASES = {
    work: { label: 'Concentration', short: 'Focus', emoji: 'tomato' },
    short: { label: 'Petite pause', short: 'Pause', emoji: 'coffee' },
    long: { label: 'Grande pause', short: 'Pause', emoji: 'leaf' }
  };
  var PRESETS = [[25, 5, 15, 'Classique'], [50, 10, 20, 'Longues sessions'], [15, 3, 10, 'Petits pas']];

  // { phase, endsAt (ms), left (ms, si en pause), waiting (prête pour la suite), cycle, taskId }
  var st = read();
  var ov = null, cast = null, ticker = null, lastPhaseKey = '';

  function read() { try { var x = JSON.parse(localStorage.getItem(KEY) || 'null'); return x && PHASES[x.phase] ? x : null; } catch (e) { return null; } }
  function write() { try { if (st) localStorage.setItem(KEY, JSON.stringify(st)); else localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ } }
  function cfg() { return S.focus(); }
  function phaseMin(p) { var c = cfg(); return p === 'work' ? c.work : p === 'short' ? c.short : c.long; }
  function left() { if (!st) return 0; if (st.waiting) return phaseMin(st.phase) * 60000; return st.left != null ? st.left : Math.max(0, st.endsAt - Date.now()); }
  function clock(ms) { var s = Math.ceil(ms / 1000); return D.pad(Math.floor(s / 60)) + ':' + D.pad(s % 60); }
  function task() { return st && st.taskId ? S.task(st.taskId) : null; }

  function changed() { S.signal('focus-state', { active: !!st, taskId: st && st.taskId }); }

  /* --- Son et notification --------------------------------------------------------- */
  function chime(up) {
    if (!cfg().sound) return;
    try {
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      var ctx = new A(), t = ctx.currentTime;
      (up ? [659, 880] : [880, 659]).forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.22);
        g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.22 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.55);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) { /* rien */ } }, 1500);
    } catch (e) { /* son indisponible */ }
  }
  function notify(title, body) {
    var api = window.lamia;
    if (document.hidden && api && api.app && api.app.notify) api.app.notify({ title: title, body: body });
  }

  /* --- Déroulé ---------------------------------------------------------------------------- */
  function start(taskId) {
    st = { phase: 'work', endsAt: Date.now() + phaseMin('work') * 60000, left: null, waiting: false, cycle: 0, taskId: taskId || null };
    write();
    var t = taskId && S.task(taskId);
    if (t && t.status === 'todo') S.moveTask(taskId, 'doing', 0);
    open();
    changed();
    U.announce('Mode focus lancé : ' + phaseMin('work') + ' minutes de concentration');
    sync();
  }

  function next(skipped) {
    if (!st) return;
    if (st.phase === 'work') {
      var done = skipped ? Math.round((phaseMin('work') * 60000 - left()) / 60000) : phaseMin('work');
      if (done >= 1) S.addFocusSession(done, st.taskId);
      st.cycle += 1;
      st.phase = st.cycle % cfg().every === 0 ? 'long' : 'short';
      st.endsAt = Date.now() + phaseMin(st.phase) * 60000;
      st.left = null; st.waiting = false;
      if (!skipped) {
        chime(false);
        notify('Pause ! Memeow te réclame', 'Session terminée. Étire-toi, bois un verre d’eau : ' + phaseMin(st.phase) + ' minutes rien que pour toi.');
        U.toast({ kind: 'success', icon: 'coffee', title: 'Session terminée, place à la pause', text: 'Memeow s’étire : fais comme elle pendant ' + phaseMin(st.phase) + NB + 'min.', duration: 6000 });
      }
    } else {
      // Fin de pause : on attend que tu sois prête pour relancer
      st.phase = 'work'; st.waiting = true; st.left = null; st.endsAt = 0;
      if (!skipped) {
        chime(true);
        notify('On reprend ?', 'La pause est finie. Une nouvelle session de ' + phaseMin('work') + ' minutes quand tu veux.');
        U.toast({ icon: 'play', title: 'La pause est finie', text: 'Une nouvelle session quand tu es prête.', duration: 6000, actions: [{ label: 'C’est reparti', fn: resume }] });
      }
    }
    write();
    sync();
  }

  function pause() { if (!st || st.waiting || st.left != null) return; st.left = left(); write(); sync(); }
  function resume() {
    if (!st) return;
    if (st.waiting) { st.waiting = false; st.endsAt = Date.now() + phaseMin('work') * 60000; }
    else if (st.left != null) { st.endsAt = Date.now() + st.left; st.left = null; }
    write();
    sync();
  }
  function stop() {
    if (!st) return;
    var n = st.cycle;
    if (st.phase === 'work' && !st.waiting) {
      var done = Math.round((phaseMin('work') * 60000 - left()) / 60000);
      if (done >= 5) { S.addFocusSession(done, st.taskId); n += 1; }
    }
    st = null; write();
    close();
    sync();
    changed();
    if (n) U.toast({ kind: 'success', icon: 'sparkle', title: 'Focus terminé', text: U.plural(n, 'session') + ' de concentration. Bien joué !', duration: 4500 });
  }

  // Tic : le temps défile partout ; fin de phase -> la suivante
  function tick() {
    if (!st) return;
    if (!st.waiting && st.left == null && st.endsAt <= Date.now()) { next(false); return; }
    var txt = clock(left());
    U.$$('[data-focus-time]').forEach(function (n) { if (n.textContent !== txt) n.textContent = txt; });
    var ring = ov && ov.querySelector('.focus-ring');
    if (ring) ring.style.setProperty('--p', String(1 - left() / (phaseMin(st.phase) * 60000)));
  }

  /* --- Pastille (en-tête) ----------------------------------------------------------------- */
  function chipHTML() {
    var p = PHASES[st.phase];
    return '<span aria-hidden="true">' + U.px(p.emoji) + '</span><span class="focus-chip__label">' + (st.waiting ? 'Prête ?' : p.short) + '</span>' +
      '<span class="num" data-focus-time>' + clock(left()) + '</span>';
  }
  function sync() {
    U.$$('[data-focus-chip]').forEach(function (b) {
      b.hidden = !st;
      if (st) { b.innerHTML = chipHTML(); b.setAttribute('aria-label', 'Mode focus : ' + (st.waiting ? 'prête pour la suite' : PHASES[st.phase].label + ', ' + clock(left()) + ' restantes') + '. Ouvrir'); }
    });
    document.documentElement.classList.toggle('has-focus', !!st);
    renderWidget();
    if (ov && !ov.hidden) drawOverlay();
    clearInterval(ticker);
    if (st) ticker = setInterval(tick, 500);
  }

  /* --- Grand écran ------------------------------------------------------------------------- */
  function memeowLine() {
    if (!st) return { say: '', text: '' };
    if (st.waiting) return { say: 'Meew ?', icon: 'star', anim: 'meow', text: 'Memeow t’attend pour la session suivante.' };
    if (st.phase === 'work') return { say: 'Mrrr… zzz', icon: 'zzz', anim: 'sleep', text: 'Memeow fait la sieste pendant que tu te concentres. Chut…' };
    return { say: 'Meew ! Meew !', icon: 'heart', anim: 'meow', text: st.phase === 'long' ? 'Grande pause : lève-toi, marche un peu, regarde au loin.' : 'Petite pause : étire-toi et bois un verre d’eau.' };
  }
  function drawOverlay() {
    var t = task(), p = PHASES[st.phase], m = memeowLine(), every = cfg().every;
    var dots = '';
    for (var i = 0; i < every; i++) dots += '<span class="focus-dot' + (i < st.cycle % every || (st.cycle && st.cycle % every === 0 && st.phase === 'long') ? ' is-on' : '') + '"></span>';
    var paused = st.left != null;
    var key = st.phase + (st.waiting ? 'w' : '');
    var box = ov.querySelector('.focus');
    box.className = 'focus focus--' + st.phase + (st.waiting ? ' focus--waiting' : '');
    box.querySelector('.focus__phase').innerHTML = U.px(p.emoji, 2) + '<span>' + esc(st.waiting ? 'Prête pour la suite ?' : p.label + (paused ? ' (en pause)' : '')) + '</span>';
    box.querySelector('.focus__task').innerHTML = t ? esc(t.title) : 'Sans tâche';
    box.querySelector('.focus__dots').innerHTML = dots;
    box.querySelector('.focus__dots').setAttribute('aria-label', (st.cycle % every) + ' session' + (st.cycle % every > 1 ? 's' : '') + ' sur ' + every + ' avant la grande pause');
    box.querySelector('[data-focus-time]').textContent = clock(left());
    box.querySelector('.focus__memeow-text').textContent = m.text;
    box.querySelector('.focus__actions').innerHTML =
      (st.waiting
        ? '<button type="button" class="btn btn--primary" data-focus-act="resume">' + icon('play') + 'C’est reparti</button>'
        : paused ? '<button type="button" class="btn btn--primary" data-focus-act="resume">' + icon('play') + 'Reprendre</button>'
          : '<button type="button" class="btn btn--primary" data-focus-act="pause">' + icon('pause') + 'Pause</button>') +
      (st.waiting ? '' : '<button type="button" class="btn btn--secondary" data-focus-act="skip">' + icon('chevron-right') + (st.phase === 'work' ? 'Passer à la pause' : 'Écourter la pause') + '</button>') +
      '<button type="button" class="btn btn--ghost" data-focus-act="stop">' + icon('stop') + 'Terminer</button>';
    if (key !== lastPhaseKey) {
      lastPhaseKey = key;
      var say = box.querySelector('.focus__say');
      say.innerHTML = esc(m.say) + U.pixelImg(m.icon, 2, 'pixel-bubble__icon', '');
      say.classList.remove('pixel-bubble--pop'); void say.offsetWidth; say.classList.add('pixel-bubble--pop');
      if (window.PixelCast) {
        if (cast) { try { cast.destroy(); } catch (e) { /* rien */ } }
        cast = window.PixelCast.mount(box.querySelector('.focus__cat'), 'memeow', { scale: 4, animation: m.anim === 'sleep' ? 'sleep' : 'idle', extras: L.badgesUI ? L.badgesUI.extras('memeow') : [] });
        if (m.anim !== 'sleep' && !U.reducedMotion()) setTimeout(function () { if (cast) cast.play(m.anim); }, 300);
      }
    }
    tick();
  }
  function ensureOverlay() {
    if (ov) return;
    ov = document.getElementById('overlay-focus');
    ov.innerHTML = '<div class="glass glass--strong focus" role="dialog" aria-modal="true" aria-labelledby="focus-title">' +
      '<div class="focus__top"><h2 class="sr-only" id="focus-title">Mode focus</h2><p class="focus__phase" aria-live="polite"></p>' +
        '<button type="button" class="btn btn--ghost btn--icon" data-focus-act="min" aria-label="Réduire (le minuteur continue)">' + icon('chevron-down') + '</button></div>' +
      '<p class="focus__task"></p>' +
      '<div class="focus-ring"><span class="focus__time num" role="timer" data-focus-time>00:00</span></div>' +
      '<div class="focus__dots" role="img"></div>' +
      '<div class="focus__actions"></div>' +
      '<div class="focus__memeow"><p class="pixel-bubble pixel-bubble--tail-bottom pixel-bubble--pop focus__say" aria-hidden="true"></p><canvas class="focus__cat" aria-hidden="true"></canvas><p class="focus__memeow-text"></p></div>' +
      '</div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { close(); return; }
      var b = e.target.closest('[data-focus-act]');
      if (!b) return;
      var a = b.getAttribute('data-focus-act');
      if (a === 'min') close();
      else if (a === 'pause') pause();
      else if (a === 'resume') resume();
      else if (a === 'skip') next(true);
      else if (a === 'stop') stop();
    });
  }
  function open(returnTo) {
    if (!st) return;
    ensureOverlay();
    lastPhaseKey = '';
    drawOverlay();
    U.openLayer(ov, { returnTo: returnTo, initialFocus: '[data-focus-act="pause"], [data-focus-act="resume"]', onClose: function () { if (cast) { try { cast.destroy(); } catch (e) { /* rien */ } cast = null; } } });
  }
  function close() { if (ov && !ov.hidden) U.closeLayer(ov, 'cancel'); }

  /* --- Démarrer : choix de la tâche et du rythme --------------------------------------- */
  function openStart(taskId, returnTo) {
    if (st) { open(returnTo); return; }
    var c = cfg();
    var tasks = S.get().tasks.filter(function (t) { return t.status === 'doing' || t.status === 'todo' || t.status === 'review'; })
      .sort(function (a, b) { var r = { doing: 0, review: 1, todo: 2 }; return r[a.status] - r[b.status] || (a.endDate || '9999').localeCompare(b.endDate || '9999'); });
    var sel = taskId || (tasks[0] && tasks[0].id) || '';
    var preset = PRESETS.map(function (p) { return p[0] === c.work && p[1] === c.short && p[2] === c.long; }).indexOf(true);
    U.dialog({
      title: 'Mode focus',
      desc: 'Concentration, puis pause. Memeow veille sur toi.',
      size: 'md', returnTo: returnTo,
      confirmLabel: 'Lancer le focus',
      body: '<div class="form-grid">' +
        '<div class="field field--full"><label class="label" for="fo-task">Sur quelle tâche ?</label><select class="select" id="fo-task" name="task">' +
          '<option value="">Sans tâche (juste me concentrer)</option>' +
          tasks.map(function (t) { return '<option value="' + t.id + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.title) + ' · ' + esc(S.category(t.categoryId).name) + '</option>'; }).join('') +
        '</select></div>' +
        '<fieldset class="field field--full"><legend class="label">Rythme</legend><div class="focus-presets">' +
          PRESETS.map(function (p, i) { return '<label class="focus-preset"><input type="radio" name="preset" value="' + i + '"' + (i === preset ? ' checked' : '') + '><span><strong>' + p[3] + '</strong><span class="text-subtle">' + p[0] + ' min · pause ' + p[1] + ' min</span></span></label>'; }).join('') +
          '<label class="focus-preset"><input type="radio" name="preset" value="-1"' + (preset < 0 ? ' checked' : '') + '><span><strong>Sur mesure</strong><span class="text-subtle">' + c.work + ' min · pause ' + c.short + ' min</span></span></label>' +
        '</div></fieldset>' +
        '<div class="field focus-custom"><label class="label" for="fo-work">Concentration (min)</label><input class="input" type="number" id="fo-work" name="work" min="5" max="120" value="' + c.work + '"></div>' +
        '<div class="field focus-custom"><label class="label" for="fo-short">Petite pause (min)</label><input class="input" type="number" id="fo-short" name="short" min="1" max="30" value="' + c.short + '"></div>' +
        '<div class="field focus-custom"><label class="label" for="fo-long">Grande pause (min)</label><input class="input" type="number" id="fo-long" name="long" min="5" max="60" value="' + c.long + '"></div>' +
        '<div class="field focus-custom"><label class="label" for="fo-every">Grande pause toutes les</label><input class="input" type="number" id="fo-every" name="every" min="2" max="8" value="' + c.every + '"><p class="hint">sessions</p></div>' +
        '<label class="check field--full"><input type="checkbox" name="sound"' + (c.sound ? ' checked' : '') + '><span>Petit son à chaque fin de session et de pause</span></label>' +
        '</div>',
      onMount: function (form) {
        function upd() {
          var v = +(form.querySelector('[name=preset]:checked') || {}).value;
          if (v >= 0) { form.work.value = PRESETS[v][0]; form.short.value = PRESETS[v][1]; form.long.value = PRESETS[v][2]; }
          form.querySelectorAll('.focus-custom').forEach(function (f) { f.hidden = v >= 0; });
        }
        form.addEventListener('change', function (e) { if (e.target.name === 'preset') upd(); });
        upd();
      },
      onConfirm: function (form) {
        function n(v, d, a, b) { v = Math.round(+v); return v >= a && v <= b ? v : d; }
        S.setFocusSettings({ work: n(form.work.value, 25, 5, 120), short: n(form.short.value, 5, 1, 30), long: n(form.long.value, 15, 5, 60), every: n(form.every.value, 4, 2, 8), sound: form.sound.checked });
        var id = form.task.value || null;
        setTimeout(function () { start(id); }, 30);
      }
    });
  }

  /* --- Statistiques (Accueil, Récap) --------------------------------------------------------- */
  function stats(a, b) {
    var list = cfg().sessions.filter(function (x) { return x.date >= a && x.date <= b; });
    return { count: list.length, minutes: list.reduce(function (s, x) { return s + x.minutes; }, 0) };
  }

  /* --- Encart de la barre latérale ---------------------------------------------------- */
  function widgetHTML() {
    if (!st) {
      return '<div class="chrono__head"><span class="chrono__icon">' + icon('target') + '</span><span class="chrono__eyebrow">Concentration</span></div>' +
        '<p class="chrono__idle">Une session de ' + phaseMin('work') + NB + 'min, puis une pause. Memeow veille sur toi.</p>' +
        '<button type="button" class="btn btn--soft btn--sm btn--block" data-focus-start data-focus-key="w-focus">' + icon('play') + 'Lancer un focus</button>';
    }
    var t = task(), p = PHASES[st.phase], paused = st.left != null;
    return '<div class="chrono__head"><span class="chrono__live' + (paused || st.waiting || st.phase !== 'work' ? ' is-paused' : '') + '" aria-hidden="true"></span>' +
        '<span class="chrono__eyebrow">' + (st.waiting ? 'Prête pour la suite ?' : p.label + (paused ? ' · en pause' : '')) + '</span></div>' +
      (t ? '<button type="button" class="chrono__task" data-open-task="' + t.id + '" title="Ouvrir le détail de la tâche">' + esc(t.title) + '</button>' : '<p class="chrono__task">Sans tâche</p>') +
      '<div class="chrono__time num" role="timer" aria-label="Temps restant" data-focus-time>' + clock(left()) + '</div>' +
      '<div class="chrono__actions">' +
        (st.waiting || paused
          ? '<button type="button" class="btn btn--soft btn--sm" data-focus-ctl="resume" data-focus-key="w-toggle">' + icon('play') + (st.waiting ? 'Reprendre' : 'Continuer') + '</button>'
          : '<button type="button" class="btn btn--soft btn--sm" data-focus-ctl="pause" data-focus-key="w-toggle">' + icon('pause') + 'Pause</button>') +
        '<button type="button" class="btn btn--secondary btn--sm" data-focus-chip data-focus-key="w-open">' + icon('eye') + 'Ouvrir</button>' +
      '</div>';
  }
  function renderWidget() {
    U.$$('[data-chrono-widget]').forEach(function (n) { U.keepFocus(n, function () { n.innerHTML = widgetHTML(); }); });
    var pill = U.$('[data-chrono-pill]');
    if (pill) { pill.hidden = true; pill.innerHTML = ''; }
    document.documentElement.classList.remove('has-chrono');
  }
  // Une session sur cette tâche ?
  function on(taskId) { return !!(st && taskId && st.taskId === taskId); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-focus-start], [data-focus-chip], [data-focus-ctl]');
    if (!b) return;
    e.preventDefault();
    if (b.hasAttribute('data-focus-ctl')) { var a = b.getAttribute('data-focus-ctl'); if (a === 'pause') pause(); else if (a === 'resume') resume(); else if (a === 'stop') stop(); }
    else if (b.hasAttribute('data-focus-chip') || (st && on(b.getAttribute('data-focus-start')))) open(b);
    else openStart(b.getAttribute('data-focus-start') || null, b);
  });
  // Retour sur l'onglet : une phase a pu se terminer pendant l'absence
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });

  L.focus = { start: start, openStart: openStart, open: open, stop: stop, active: function () { return !!st; }, on: on, clock: function () { return clock(left()); }, stats: stats, sync: sync, renderWidget: renderWidget, state: function () { return st; } };
})(window.Lamia = window.Lamia || {});
