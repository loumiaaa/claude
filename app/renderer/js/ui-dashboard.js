/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · Dashboard
   Accueil, scène pixel (Lamia & Memeow + bulles LamiaVoice), heures de la
   semaine par catégorie (jamais additionnées), humeur, tâches en cours avec
   ▶ (chrono en 2 clics), échéances et « à replanifier », récap express.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q;
  var esc = U.esc, icon = U.icon, NB = D.NBSP;
  var el = null, cast = { lamia: null, memeow: null }, voice = null, narrowMQ = null;

  /* --- Voix --------------------------------------------------------------- */
  function pickVoice() {
    try { voice = window.LamiaVoice.pick(Q.voiceContext()); }
    catch (e) { voice = { lamia: 'Belle journée à toi, Lamia.', memeow: { text: 'Meew !', icon: 'heart' }, lamiaAnimation: 'wave', memeowAnimation: 'idle' }; }
    return voice;
  }

  function memeowSays(text, ic) {
    return esc(text) + U.pixelImg(ic, 2, 'pixel-bubble__icon', iconAlt(ic));
  }

  function iconAlt(ic) {
    return { heart: 'un cœur', fish: 'un poisson', zzz: 'zZz', kibble: 'des croquettes', star: 'une étoile', note: 'une note de musique' }[ic] || '';
  }

  function sceneHTML() {
    var narrow = narrowMQ && narrowMQ.matches;
    return '<div class="pixel-stage scene">' +
      '<div class="scene__say scene__say--lamia"><p class="pixel-bubble ' + (narrow ? 'pixel-bubble--tail-bottom' : 'pixel-bubble--tail-left') + ' pixel-bubble--pop" data-bubble="lamia" aria-live="polite">' +
        '<span class="sr-only">Lamia dit : </span><span data-say>' + esc(voice.lamia) + '</span></p></div>' +
      '<canvas class="scene__sprite scene__sprite--lamia" data-sprite="lamia" aria-label="Lamia, en pixel art"></canvas>' +
      '<div class="scene__memeow">' +
        '<div class="scene__say scene__say--memeow"><p class="pixel-bubble pixel-bubble--tail-bottom pixel-bubble--pop" data-bubble="memeow" aria-live="polite">' +
          '<span class="sr-only">Memeow répond : </span><span data-say>' + memeowSays(voice.memeow.text, voice.memeow.icon) + '</span></p></div>' +
        '<button type="button" class="scene__cat" data-memeow aria-label="Memeow, la chatte de Lamia. Clique pour qu’elle réagisse">' +
          '<canvas class="scene__sprite scene__sprite--memeow" data-sprite="memeow" aria-hidden="true"></canvas></button>' +
      '</div>' +
    '</div>';
  }

  function mountCast() {
    var narrow = narrowMQ && narrowMQ.matches;
    var cl = el.querySelector('[data-sprite="lamia"]');
    var cm = el.querySelector('[data-sprite="memeow"]');
    try {
      if (cast.lamia) cast.lamia.destroy();
      if (cast.memeow) cast.memeow.destroy();
      cast.lamia = window.PixelCast.mount(cl, 'lamia', { scale: narrow ? 3 : 4, animation: 'idle' });
      cast.memeow = window.PixelCast.mount(cm, 'memeow', { scale: narrow ? 3 : 4, animation: 'idle' });
      cm.setAttribute('aria-hidden', 'true');
      setTimeout(function () {
        if (cast.lamia) cast.lamia.play(voice.lamiaAnimation || 'idle');
        if (cast.memeow) cast.memeow.play(voice.memeowAnimation || 'idle');
      }, 500);
    } catch (e) { if (window.console) console.error(e); }
  }

  function bubblePop(which, html) {
    var b = el.querySelector('[data-bubble="' + which + '"]');
    if (!b) return;
    b.querySelector('[data-say]').innerHTML = html;
    U.typo(b);
    b.classList.remove('pixel-bubble--pop');
    void b.offsetWidth;
    b.classList.add('pixel-bubble--pop');
  }

  function anotherPhrase() {
    pickVoice();
    bubblePop('lamia', esc(voice.lamia));
    bubblePop('memeow', memeowSays(voice.memeow.text, voice.memeow.icon));
    if (cast.lamia) cast.lamia.play(voice.lamiaAnimation || 'idle');
    if (cast.memeow) cast.memeow.play(voice.memeowAnimation || 'idle');
  }

  var lastMeew = null;
  function petMemeow() {
    var anims = ['lick', 'hungry', 'meow'];
    var anim = anims[Math.floor(Math.random() * anims.length)];
    var pool = [];
    try {
      var all = window.LamiaVoice.phrases.memeow;
      Object.keys(all).forEach(function (k) { all[k].forEach(function (r) { if (r.animation === anim && r.text !== lastMeew) pool.push(r); }); });
    } catch (e) { pool = []; }
    var r = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { text: 'Meew !', icon: anim === 'hungry' ? 'kibble' : 'heart' };
    lastMeew = r.text;
    bubblePop('memeow', memeowSays(U.typoString(r.text), r.icon));
    if (cast.memeow) cast.memeow.play(anim);
  }

  /* --- Cartes ------------------------------------------------------------- */
  function leadText(ctx) {
    var now = D.now();
    var late = now.getHours() >= 18 || now.getHours() < 5 || D.dow(D.today()) === 0;   // soir, nuit (QA-10) et dimanche
    if (!S.get().tasks.length) return 'Bienvenue dans ta plateforme ! Commence par une première tâche, le reste suivra à ton rythme.';
    if (late) return 'La journée est faite. Le reste attendra demain : profite de ta soirée.';
    var bits = [];
    if (ctx.dueThisWeek) bits.push(U.plural(ctx.dueThisWeek, 'échéance') + ' d’ici dimanche');
    if (ctx.doneToday) bits.push(U.plural(ctx.doneToday, 'tâche') + ' déjà bouclée' + (ctx.doneToday > 1 ? 's' : '') + ' aujourd’hui');
    var s = bits.length ? 'Cette semaine : ' + bits.join(' et ') + '.' : 'Rien d’urgent à l’horizon : belle journée pour avancer à ton rythme.';
    if (ctx.overdue) s += ' ' + (ctx.overdue > 1 ? ctx.overdue + ' tâches attendent' : '1 tâche attend') + ' juste une nouvelle date.';
    return s;
  }

  function hoursCard() {
    var st = S.get();
    var w0 = D.startOfWeek(D.today()), w1 = D.endOfWeek(D.today());
    var mins = Q.minutesByCategory(w0, w1, true);
    var tm = st.activeTimer;
    var hasFree = false;
    var rows = st.categories.map(function (c) {
      var m = mins[c.id] || 0;
      var goal = Q.goalFor(c);
      var running = tm && !tm.pausedAt && S.task(tm.taskId) && S.task(tm.taskId).categoryId === c.id;
      var note, value, bar = '';
      if (goal) {
        var left = goal.weekly - m;
        value = '<strong class="num">' + D.duration(m) + '</strong><span class="hours-row__goal"> / ' + D.duration(goal.weekly) + '</span>';
        bar = '<span class="progress progress--lg ' + progressCls(c) + '" style="--value:' + Math.min(100, Math.round(m / goal.weekly * 100)) + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + goal.weekly + '" aria-valuenow="' + m + '" aria-label="' + esc(c.name) + ' : ' + D.duration(m) + ' sur ' + D.duration(goal.weekly) + '"></span>';
        note = left > 0 ? 'Encore ' + D.duration(left) + ' d’ici vendredi (objectif : ' + D.duration(goal.daily) + ' par jour).' : (left === 0 ? 'Objectif atteint, pile poil.' : 'Objectif atteint : +' + NB + D.duration(-left) + ', tout en douceur.');
      } else {
        value = '<strong class="num">' + D.duration(m) + '</strong>';
        var daily = Q.dailyMinutes(c.id, w0, w1, true);
        var days = Object.keys(daily).filter(function (d) { return daily[d] > 0; });
        note = days.length
          ? days.map(function (d) { return D.cap(D.DAYS[D.dow(d)]) + ' : ' + D.duration(daily[d]); }).join(' · ')
          : 'Pas encore d’heures cette semaine. Samedi, c’est ton jour.';
        hasFree = true;
      }
      if (running) note += ' Chrono en cours inclus.';
      return '<div class="hours-row">' +
        '<div class="hours-row__head">' + U.catChip(c) + '<span class="hours-row__value">' + value + '</span></div>' + bar +
        '<p class="hours-row__note">' + esc(note) + '</p></div>';
    }).join('');
    var perso = persoRow(Q.weekPersoGoal(D.today(), true));
    return '<section class="glass card hours-card" aria-labelledby="dh-hours">' +
      '<div class="card__header"><div><h2 class="card__title" id="dh-hours">Heures de la semaine</h2>' +
      '<p class="card__subtitle">Chaque catégorie a son compteur, jamais mélangé.</p></div>' +
      '<div class="card__actions"><a class="btn btn--ghost btn--sm" href="#recap">Détail' + icon('chevron-right') + '</a></div></div>' +
      '<div class="hours-rows">' + rows + perso + '</div>' +
      (hasFree && !perso ? '<p class="hours-card__foot">' + icon('heart') + 'Pas d’objectif pour le perso : le samedi reste un plaisir.</p>' : '') + '</section>';
  }

  // Jauge du pôle auto-entreprise : « Samedi perso : x / 4 h minimum » (jamais additionné à Flow Line)
  function persoRow(g) {
    if (!g.enabled || !g.days.length) return '';
    var goal = g.goalPerDay * g.days.length;
    var m = g.minutes;
    var today = D.today();
    var day = g.days[0];
    var past = g.days.every(function (x) { return x.date < today; });
    var isToday = g.days.some(function (x) { return x.today; });
    var dayName = g.days.length === 1 ? D.dayMonthLong(day.date) : g.days.map(function (x) { return D.DAYS[D.dow(x.date)]; }).join(' et ');
    var note;
    if (m >= goal) note = (past ? D.cap(dayName) + ' : minimum atteint' : 'Minimum atteint') + (m > goal ? ', +' + NB + D.duration(m - goal) + ' en bonus.' : ', bravo !');
    else if (isToday) note = 'Encore ' + D.duration(goal - m) + ' aujourd’hui pour ton minimum perso, à ton rythme.';
    else if (past) note = D.cap(dayName) + ' : ' + D.duration(m) + ' sur ' + D.duration(goal) + '. La semaine prochaine sera la bonne.';
    else note = 'Rendez-vous ' + dayName + ' : ' + D.duration(goal) + ' minimum pour Carnet by-pass et Auto-entreprise réunis.';
    var label = g.label;
    return '<div class="hours-row hours-row--pole">' +
      '<div class="hours-row__head"><span class="chip chip--pole">' + esc(label) + '</span>' +
        '<span class="hours-row__value"><strong class="num">' + D.duration(m) + '</strong><span class="hours-row__goal"> / ' + D.duration(goal) + ' minimum</span></span></div>' +
      '<span class="progress progress--lg progress--pole" style="--value:' + Math.min(100, Math.round(m / goal * 100)) + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + goal + '" aria-valuenow="' + m + '" aria-label="' + esc(label) + ' : ' + D.duration(m) + ' sur ' + D.duration(goal) + ' minimum (pôle auto-entreprise)"></span>' +
      '<p class="hours-row__note">' + esc(note) + '</p></div>';
  }

  function progressCls(c) {
    return { flowline: 'progress--flowline', carnet: 'progress--carnet', auto: 'progress--auto' }[c.color] || 'progress--hue ' + U.hue(c);
  }

  function moodCard() {
    var today = D.today();
    var m = Q.mood(today);
    var week = D.eachDay(D.addDays(today, -6), today).map(function (d) {
      var mm = Q.mood(d);
      return '<li class="mood-week__day' + (d === today ? ' is-today' : '') + '"><span class="mood-week__art">' +
        (mm ? U.pixelImg('mood-' + mm.level, 2, '', U.moodLabel(mm.level)) : '<span class="mood-week__empty" aria-hidden="true"></span>') +
        '</span><span class="mood-week__label" aria-hidden="true">' + D.DAYS_LETTER[D.dow(d)] + '</span>' +
        '<span class="sr-only">' + esc(D.dayMonthLong(d)) + ' : ' + (mm ? esc(U.moodLabel(mm.level)) : 'pas notée') + '</span></li>';
    }).join('');
    var body;
    if (m) {
      body = '<div class="mood-now">' + U.pixelImg('mood-' + m.level, 3, 'mood-now__art', '') +
        '<div class="mood-now__text"><p class="mood-now__level">' + esc(U.moodLabel(m.level)) + '</p>' +
        (m.note ? '<p class="mood-now__note">« ' + esc(m.note) + ' »</p>' : '<p class="mood-now__note text-muted">Aucune note, et c’est très bien aussi.</p>') + '</div>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-mood-edit data-focus-key="mood-edit">' + icon('edit') + 'Modifier</button></div>';
    } else {
      body = '<p class="mood-ask">Comment te sens-tu aujourd’hui ? Un clic suffit.</p>' +
        '<div class="mood-picker mood-picker--inline" role="group" aria-label="Humeur du jour">' + L.mood.optionsHTML(null, 'dash') + '</div>';
    }
    return '<section class="glass glass--tint-violet card mood-card" aria-labelledby="dh-mood">' +
      '<div class="card__header"><div><h2 class="card__title" id="dh-mood">Humeur du jour</h2><p class="card__subtitle">Pour toi, et pour la courbe du récap.</p></div></div>' +
      body + '<div class="mood-week-wrap"><p class="mood-week__caption" id="dh-week">Tes 7 derniers jours</p>' +
      '<ol class="mood-week" aria-labelledby="dh-week">' + week + '</ol></div></section>';
  }

  function taskRow(t) {
    var c = S.category(t.categoryId);
    var tm = S.get().activeTimer;
    var mine = tm && tm.taskId === t.id;
    var play = mine
      ? (tm.pausedAt
        ? '<button type="button" class="btn btn--soft btn--icon task-row__play is-paused" data-chrono="resume" data-focus-key="play-' + t.id + '" aria-label="Reprendre le chrono sur « ' + esc(t.title) + ' »">' + icon('play') + '</button>'
        : '<button type="button" class="btn btn--primary btn--icon task-row__play is-running" data-chrono="pause" data-focus-key="play-' + t.id + '" aria-label="Mettre en pause le chrono de « ' + esc(t.title) + ' »">' + icon('pause') + '</button>')
      : '<button type="button" class="btn btn--soft btn--icon task-row__play" data-chrono="start" data-task="' + t.id + '" data-focus-key="play-' + t.id + '" aria-label="Démarrer le chrono sur « ' + esc(t.title) + ' »">' + icon('play') + '</button>';
    return '<li class="task-row' + (mine ? ' is-timing' : '') + '">' + play +
      '<button type="button" class="task-row__main" data-open-task="' + t.id + '" data-focus-key="doing-' + t.id + '">' +
        '<span class="task-row__title">' + esc(t.title) + '</span>' +
        '<span class="task-row__meta">' + U.catDot(c) + '<span class="task-row__meta-text">' + esc(c.name) + (t.client ? ' · ' + esc(t.client) : '') + '</span></span></button>' +
      (mine ? '<span class="task-row__clock num" data-timer-elapsed role="timer" aria-label="Temps écoulé">' + D.clock(L.chrono.elapsed()) + '</span>'
            : '<span class="task-row__progress"><span class="task-row__pct num">' + t.progress + NB + '%</span>' + U.progress(t.progress, 'progress--sm') + '</span>') +
      '<span class="task-row__due">' + U.dueBadge(t) + '</span></li>';
  }

  function doingCard() {
    var doing = S.column('doing');
    var review = S.column('review');
    return '<section class="glass card doing-card" aria-labelledby="dh-doing">' +
      '<div class="card__header"><div><h2 class="card__title" id="dh-doing">Tes tâches en cours</h2>' +
      '<p class="card__subtitle">▶ lance le chrono : deux clics, pas de formulaire.</p></div>' +
      '<div class="card__actions"><a class="btn btn--ghost btn--sm" href="#taches">Kanban' + icon('chevron-right') + '</a></div></div>' +
      (doing.length ? '<ul class="task-rows" role="list">' + doing.map(taskRow).join('') + '</ul>' +
        (review.length ? '<h3 class="subsection-title">' + icon('eye') + 'En validation, chez le client <span class="badge badge--neutral">' + review.length + '</span></h3>' +
          '<ul class="task-rows" role="list">' + review.map(taskRow).join('') + '</ul>' : '')
        : !S.get().tasks.length ? welcomeHTML()
        : '<div class="empty-state"><div class="empty-state__art">' + icon('coffee') + '</div><p class="empty-state__title">Rien en cours</p>' +
          '<p class="empty-state__text">Choisis une tâche dans « Pas commencé » ou crée-en une nouvelle.</p>' +
          '<div class="empty-state__actions"><button type="button" class="btn btn--primary btn--sm" data-action="new-task">' + icon('plus') + 'Nouvelle tâche</button></div></div>') +
      '</section>';
  }

  // Premier lancement : app vide, on accompagne sans brusquer
  function welcomeHTML() {
    return '<div class="empty-state empty-state--welcome"><div class="empty-state__art">' + U.pixelImg('heart', 3, '', '') + '</div>' +
      '<p class="empty-state__title">Ton carnet est tout neuf</p>' +
      '<p class="empty-state__text">Crée ta première tâche : seul le titre est obligatoire. Ensuite, ▶ lance le chrono en un clic.</p>' +
      '<div class="empty-state__actions"><button type="button" class="btn btn--primary btn--sm" data-action="new-task">' + icon('plus') + 'Créer ma première tâche</button>' +
      '<a class="btn btn--secondary btn--sm" href="#reglages" data-goto-demo>' + icon('sparkle') + 'Explorer avec la démo</a></div></div>';
  }

  function dueCard() {
    var today = D.today();
    var late = Q.overdue();
    var soon = Q.dueBetween(today, D.addDays(today, 7));
    var lateHTML = late.length ? '<div class="replan" role="group" aria-labelledby="dh-replan">' +
      '<h3 class="replan__title" id="dh-replan">' + icon('refresh') + 'À replanifier <span class="badge badge--neutral">' + late.length + '</span></h3>' +
      '<p class="replan__hint">Pas de panique : choisis simplement une nouvelle date.</p>' +
      '<ul class="replan__list" role="list">' + late.map(function (t) {
        var c = S.category(t.categoryId);
        return '<li class="replan-row"><button type="button" class="replan-row__main" data-open-task="' + t.id + '" data-focus-key="late-' + t.id + '">' +
          '<span class="replan-row__title">' + esc(t.title) + '</span>' +
          '<span class="replan-row__meta">' + U.catDot(c) + esc(c.name) + ' · prévue le ' + esc(D.dayMonth(t.endDate)) + '</span></button>' +
          '<div class="replan-row__actions" role="group" aria-label="Replanifier « ' + esc(t.title) + ' »">' +
            '<button type="button" class="btn btn--secondary btn--sm" data-replan="tomorrow" data-task="' + t.id + '" data-focus-key="replan-tomorrow-' + t.id + '">Demain</button>' +
            '<button type="button" class="btn btn--secondary btn--sm" data-replan="monday" data-task="' + t.id + '" data-focus-key="replan-monday-' + t.id + '">Lundi prochain</button>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-replan="pick" data-task="' + t.id + '" data-focus-key="replan-pick-' + t.id + '">' + icon('calendar') + 'Choisir</button>' +
          '</div></li>';
      }).join('') + '</ul></div>' : '';
    var soonHTML = soon.length ? '<ul class="due-list" role="list">' + soon.map(function (t) {
      var c = S.category(t.categoryId);
      var d = D.parse(t.endDate);
      var n = D.diff(today, t.endDate);
      return '<li><button type="button" class="due-row" data-open-task="' + t.id + '" data-focus-key="due-' + t.id + '">' +
        '<span class="date-tile' + (n <= 1 ? ' date-tile--soon' : '') + '"><span class="date-tile__dow">' + D.DAYS_SHORT[d.getDay()].replace('.', '') + '</span><span class="date-tile__day num">' + d.getDate() + '</span></span>' +
        '<span class="due-row__text"><span class="due-row__title">' + esc(t.title) + '</span>' +
        '<span class="due-row__meta">' + U.catDot(c) + esc(c.name) + ' · ' + esc(D.relative(t.endDate)) + '</span></span>' +
        (t.priority === 'high' || t.priority === 'urgent' ? U.prio(t.priority) : '<span></span>') +
        '</button></li>';
    }).join('') + '</ul>' : '<p class="empty-line">Aucune échéance dans les 7 prochains jours. Le calme avant… le calme.</p>';
    return '<section class="glass card due-card" aria-labelledby="dh-due">' +
      '<div class="card__header"><div><h2 class="card__title" id="dh-due" tabindex="-1">Échéances</h2><p class="card__subtitle">Les 7 prochains jours</p></div>' +
      '<div class="card__actions"><a class="btn btn--ghost btn--sm" href="#planning">Planning' + icon('chevron-right') + '</a></div></div>' +
      lateHTML + soonHTML + '</section>';
  }

  function shortLabel(p) {
    if (p.kind === 'day') return D.cap(D.dayMonthLong(p.start));
    if (p.kind === 'month') return D.cap(D.monthYear(p.start));
    var a = D.parse(p.start), b = D.parse(p.end);
    return 'Du ' + a.getDate() + (a.getMonth() !== b.getMonth() ? NB + D.MONTHS[a.getMonth()] : '') + ' au ' + b.getDate() + NB + D.MONTHS[b.getMonth()];
  }

  function recapCard() {
    var kind = S.get().settings.ui.dashPeriod || 'week';
    var p = D.period(kind, D.today());
    var s = Q.summary(p);
    var periodWord = { day: 'aujourd’hui', week: 'cette semaine', month: 'ce mois-ci' }[kind];
    function tile(ic, label, value, sub, cls) {
      return '<li class="mini-stat ' + (cls || '') + '"><span class="stat__icon">' + icon(ic) + '</span>' +
        '<span class="mini-stat__text"><span class="mini-stat__label">' + esc(label) + '</span><span class="mini-stat__sub">' + esc(sub) + '</span></span>' +
        '<span class="mini-stat__value num">' + value + '</span></li>';
    }
    var review = s.ongoing.filter(function (t) { return t.status === 'review'; }).length;
    return '<section class="glass card recap-card" aria-labelledby="dh-recap">' +
      '<div class="card__header"><div><h2 class="card__title" id="dh-recap">Récap express</h2><p class="card__subtitle">' + esc(shortLabel(p)) + '</p></div>' +
      '<div class="card__actions"><a class="btn btn--ghost btn--sm" href="#recap">Récap' + icon('chevron-right') + '</a></div></div>' +
        '<div class="segmented segmented--block" role="group" aria-label="Période du récap express">' +
          [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']].map(function (o) {
            return '<button type="button" class="segmented__item" data-dash-period="' + o[0] + '" data-focus-key="dp-' + o[0] + '" aria-pressed="' + (kind === o[0]) + '">' + o[1] + '</button>';
          }).join('') + '</div>' +
      '<ul class="mini-stats" role="list">' +
        tile('tasks', 'En cours', '<span>' + s.ongoing.length + '</span>', review ? 'dont ' + review + ' en validation' : 'Une à la fois, c’est parfait') +
        tile('check', 'Terminées', '<span>' + s.done.length + '</span>', s.done.length ? 'Bravo, ' + periodWord : 'Ça viendra, ' + periodWord, 'stat--done') +
        tile('calendar', 'À venir', '<span>' + s.upcoming.length + '</span>', kind === 'day' ? 'Échéance aujourd’hui' : 'Échéance ' + periodWord) +
        tile('refresh', 'À replanifier', '<span>' + s.allReplan.length + '</span>', s.allReplan.length ? 'Une nouvelle date, et on repart' : 'Tout est à jour', 'stat--replan') +
      '</ul></section>';
  }

  /* --- Rendu -------------------------------------------------------------- */
  function render() {
    if (!el) return;
    var ctx = Q.voiceContext();
    var today = D.today();
    if (!voice) pickVoice();
    var hadScene = !!el.querySelector('.scene');
    var html =
      '<div class="dash-grid">' +
        '<section class="glass card hero">' +
          '<div class="hero__text"><p class="eyebrow">' + esc(D.cap(D.long(today))) + ' · semaine ' + D.isoWeek(today) + '</p>' +
            '<h1 class="display" id="h-dashboard" tabindex="-1">Bonjour Lamia</h1>' +
            '<p class="hero__lead" data-lead>' + esc(leadText(ctx)) + '</p>' +
            '<div class="hero__actions"><button type="button" class="btn btn--secondary btn--sm" data-another>' + icon('refresh') + 'Une autre phrase</button>' +
            '<span class="hero__hint">Clique sur Memeow, elle adore ça.</span></div></div>' +
          '<div class="hero__stage" data-scene-slot></div>' +
        '</section>' +
        '<div data-dash-hours class="dash-hours">' + hoursCard() + '</div>' +
        '<div data-dash-mood class="dash-mood">' + moodCard() + '</div>' +
        '<div data-dash-recap class="dash-recap">' + recapCard() + '</div>' +
        '<div data-dash-doing class="dash-doing">' + doingCard() + '</div>' +
        '<div data-dash-due class="dash-due">' + dueCard() + '</div>' +
      '</div>';
    var scene = hadScene ? el.querySelector('.scene') : null;
    U.keepFocus(el, function () {
      el.innerHTML = html;
      var slot = el.querySelector('[data-scene-slot]');
      if (scene) slot.appendChild(scene);
      else { slot.innerHTML = sceneHTML(); mountCast(); }
    });
    U.typo(el);
  }

  // Re-rendu ciblé (la scène pixel n'est jamais reconstruite inutilement)
  function update(part) {
    if (!el || !el.querySelector('.dash-grid')) return render();
    if (part === 'side') part = null;
    var map = { hours: ['[data-dash-hours]', hoursCard], mood: ['[data-dash-mood]', moodCard], doing: ['[data-dash-doing]', doingCard], due: ['[data-dash-due]', dueCard], recap: ['[data-dash-recap]', recapCard] };
    (part ? [part] : Object.keys(map)).forEach(function (k) {
      var box = el.querySelector(map[k][0]);
      U.keepFocus(box, function () { box.innerHTML = map[k][1](); });
      U.typo(box);
    });
    var lead = el.querySelector('[data-lead]');
    if (lead) { lead.textContent = leadText(Q.voiceContext()); U.typo(lead); }
  }

  function replan(id, how, anchor) {
    var t = S.task(id);
    if (!t) return;
    var today = D.today();
    // Après la replanification, la ligne disparaît : le focus passe à la suivante (QA-03)
    var row = anchor && anchor.closest('.replan-row');
    var sib = row && (row.nextElementSibling || row.previousElementSibling);
    var nextKey = sib ? 'replan-' + how + '-' + sib.querySelector('[data-replan]').getAttribute('data-task') : null;
    function refocus() {
      setTimeout(function () {
        var target = (nextKey && el.querySelector('[data-focus-key="' + nextKey + '"]')) || el.querySelector('#dh-due');
        if (target) target.focus({ preventScroll: false });
      }, 30);
    }
    function apply(date) {
      var prev = { endDate: t.endDate, startDate: t.startDate };
      var patch = { endDate: date };
      if (t.startDate && t.startDate > date) patch.startDate = date;
      S.updateTask(id, patch);
      U.toast({ kind: 'success', icon: 'calendar', title: 'Replanifiée au ' + D.dayMonthLong(date), text: '« ' + t.title + ' ». Nouvelle date, nouvel élan.', duration: 7000,
        actions: [{ label: 'Annuler', fn: function () { S.updateTask(id, prev); } }] });
      U.announce('Tâche replanifiée au ' + D.dayMonthLong(date));
      refocus();
    }
    if (how === 'tomorrow') return apply(D.addDays(today, 1));
    if (how === 'monday') return apply(D.addDays(D.startOfWeek(today), 7));
    U.dialog({
      title: 'Choisir une nouvelle date', desc: '« ' + t.title + ' »', returnTo: anchor,
      fallbackFocus: function () { return (nextKey && el.querySelector('[data-focus-key="' + nextKey.replace('-pick-', '-tomorrow-') + '"]')) || el.querySelector('#dh-due'); },
      body: '<div class="field"><label class="label" for="dlg-date">Nouvelle échéance</label><input class="input" type="date" id="dlg-date" name="date" value="' + D.addDays(today, 2) + '" min="' + today + '">' +
        '<p class="hint">Prends la marge qu’il te faut.</p></div>',
      confirmLabel: 'Replanifier',
      onConfirm: function (form) {
        var v = form.date.value;
        if (!D.valid(v)) { form.querySelector('.field').classList.add('field--error'); return false; }
        apply(v);
      }
    });
  }

  function mount(node) {
    el = node;
    narrowMQ = window.matchMedia('(max-width: 640px)');
    var wasNarrow = narrowMQ.matches;
    var onNarrow = function () {
      if (narrowMQ.matches === wasNarrow) return;
      wasNarrow = narrowMQ.matches;
      var s = el.querySelector('.scene');
      if (s) { s.outerHTML = sceneHTML(); mountCast(); }
    };
    if (narrowMQ.addEventListener) narrowMQ.addEventListener('change', onNarrow);

    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-another]')) { anotherPhrase(); return; }
      if (e.target.closest('[data-memeow]')) { petMemeow(); return; }
      if ((b = e.target.closest('[data-dash-period]'))) { S.setUI({ dashPeriod: b.getAttribute('data-dash-period') }); return; }
      if ((b = e.target.closest('[data-replan]'))) { replan(b.getAttribute('data-task'), b.getAttribute('data-replan'), b); return; }
      if (e.target.closest('[data-mood-edit]')) { L.mood.open({ returnTo: e.target.closest('button') }); return; }
      if ((b = e.target.closest('[data-mood][data-mood-scope="dash"]'))) {
        S.setMood(D.today(), +b.getAttribute('data-mood'), '');
        U.toast({ kind: 'success', icon: 'heart', title: 'Humeur notée : ' + U.moodLabel(+b.getAttribute('data-mood')), text: 'Merci de prendre ce petit temps pour toi.', duration: 3500 });
        setTimeout(function () { var x = el.querySelector('[data-mood-edit]'); if (x) x.focus(); }, 0);
      }
    });

    S.subscribe(function (type, d) {
      if (L.app.view() !== 'dashboard') { el.dataset.stale = '1'; if (type === 'mood') voice = null; return; }
      if (type === 'reset') { voice = null; el.innerHTML = ''; render(); return; }
      if (type === 'mood') { update('mood'); if (d.level) { anotherPhrase(); } return; }
      if (type === 'ui') { if (d.dashPeriod) update('recap'); return; }
      if (type === 'timer') { update('hours'); update('doing'); return; }
      if (type === 'settings' || type === 'category') { update(); return; }
      if (type.indexOf('task') === 0) {
        if (d.part === 'checklist') return;
        update();
      }
    });
    // Les heures (chrono en cours inclus) se rafraîchissent chaque minute
    setInterval(function () { if (L.app.view() === 'dashboard' && S.get().activeTimer && !document.querySelector('.has-layer')) update('hours'); }, 60000);
  }

  function show() {
    if (!el.querySelector('.dash-grid') || el.dataset.stale) {
      delete el.dataset.stale;
      if (!voice) { pickVoice(); if (el.querySelector('.scene')) { bubblePop('lamia', esc(voice.lamia)); bubblePop('memeow', memeowSays(voice.memeow.text, voice.memeow.icon)); } }
      if (el.querySelector('.dash-grid')) update(); else render();
    }
  }

  L.views = L.views || {};
  L.views.dashboard = { mount: mount, render: render, show: show, anotherPhrase: anotherPhrase, petMemeow: petMemeow, title: 'Dashboard' };
})(window.Lamia = window.Lamia || {});
