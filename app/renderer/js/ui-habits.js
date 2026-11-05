/* ==========================================================================
   Plateforme de suivi - Lamia — habitudes
   Trois façons de suivre une habitude (logique : shared/habits.js) :
   - une case à cocher (étirements, prendre l'air…) ;
   - un compteur (8 verres d'eau) ;
   - une valeur à noter (heures de sommeil, litres d'eau, pas, temps
     d'écran…), avec un objectif facultatif « au moins » ou « au plus ».
   Séries, semaine en grille, tendances sur 14 jours pour les valeurs notées.
   - Vue « Habitudes » (#habitudes) : la journée, la semaine, les tendances.
   - L.habitsUI.todayHTML() : la carte compacte de l'Accueil.
   Les contrôles [data-hab-*] marchent partout (délégation sur le document).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, HB = window.LamiaShared.habits;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  // Icônes pixel proposées (design/sprites/pixel-cast.js) ; enregistrées « px:nom »
  var ICONS = ['drop', 'moon', 'book', 'phone', 'lotus', 'shoe', 'pencil', 'sun', 'apple', 'leaf', 'coffee', 'pill', 'tooth', 'headphones', 'note', 'broom', 'dumbbell', 'palette', 'sprout', 'heart', 'plate', 'star', 'bulb', 'tomato'];
  // Anciennes habitudes enregistrées avec un emoji : leur équivalent pixel
  var EMOJI = { '💧': 'drop', '😴': 'moon', '📖': 'book', '📱': 'phone', '📵': 'phone', '🧘': 'lotus', '🚶': 'shoe', '✏️': 'pencil', '🌤️': 'sun', '🍎': 'apple', '🥦': 'leaf', '☕': 'coffee', '💊': 'pill', '🦷': 'tooth', '🎧': 'headphones', '🙏': 'heart', '📝': 'note', '🧹': 'broom', '💪': 'dumbbell', '🎨': 'palette', '🌱': 'sprout', '✨': 'star' };
  function iconName(v) { return /^px:/.test(v || '') ? v.slice(3) : EMOJI[v] || null; }
  function habIcon(h, scale) { var n = iconName(h.icon); return n ? U.px(n, scale || 1) : '<span class="hab-emoji">' + esc(h.icon) + '</span>'; }
  var DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  // Unités proposées pour une valeur à noter ; « h » = une durée (saisie 7h30, enregistrée en minutes)
  var UNITS = [['h', 'Heures (durée)'], ['L', 'Litres'], ['ml', 'Millilitres'], ['verres', 'Verres'], ['pas', 'Pas'], ['pages', 'Pages'], ['km', 'Kilomètres'], ['', 'Autre…']];
  // Petit bouton « + » pour les unités qu'on remplit par petites quantités
  var STEPS = { L: 0.25, ml: 250, verres: 1, pages: 5 };

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
  function flame(n) { return n >= 2 ? '<span class="hab-streak" title="Série en cours">' + U.px('flame') + U.plural(n, 'jour') + '</span>' : ''; }

  /* --- Valeurs notées : affichage et saisie ------------------------------------- */
  function isAmount(h) { return h.kind === 'amount'; }
  function num(v) { return (Math.round(v * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }); }
  // « 7 h 30 », « 1,5 L », « 6 420 pas »
  function fmtVal(h, v) {
    if (v == null) return '—';
    if (h.unit === 'h') return D.duration(v);
    return num(v) + (h.unit ? NB + h.unit : '');
  }
  // Version courte pour la grille de la semaine : « 7h30 », « 1,5 », « 6,4k »
  function shortVal(h, v) {
    if (h.unit === 'h') { var hh = Math.floor(v / 60), mm = Math.round(v % 60); return hh + 'h' + (mm ? D.pad(mm) : ''); }
    if (v >= 10000) return num(Math.round(v / 100) / 10) + 'k';
    if (v >= 1000) return num(Math.round(v / 100) / 10) + 'k';
    return num(v);
  }
  // Texte à mettre dans le champ pour le modifier
  function editVal(h, v) {
    if (v == null) return '';
    if (h.unit === 'h') { var hh = Math.floor(v / 60), mm = Math.round(v % 60); return hh + 'h' + (mm ? D.pad(mm) : ''); }
    return String(Math.round(v * 100) / 100).replace('.', ',');
  }
  // Saisie -> nombre (minutes pour une durée) ; '' -> null ; illisible -> NaN
  function parseVal(h, text) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return null;
    if (h.unit === 'h') {
      if (/^0+([,.]0*)?$/.test(s)) return 0;
      var m = D.parseDuration(s);
      return m == null ? NaN : m;
    }
    var n = parseFloat(s.replace(/[\s  ]/g, '').replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : NaN;
  }
  function placeholder(h) { return { h: '7h30', L: '1,5', ml: '500', verres: '6', pas: '8000', pages: '20', km: '5' }[h.unit] || '0'; }
  function goalText(h) {
    if (!isAmount(h)) return h.kind === 'count' ? h.target + (h.unit ? NB + esc(h.unit) : ' fois') + ' par jour' : '';
    return h.goal == null ? 'Sans objectif' : (h.dir === 'max' ? 'Au plus ' : 'Au moins ') + esc(fmtVal(h, h.goal));
  }

  /* --- Une ligne de la journée ------------------------------------------------------- */
  function rowHTML(h, date, compact) {
    var log = hs().log, today = D.today(), done = HB.isDone(log, h, date);
    var streak = HB.streak(log, h, today), bar = '', ctl;
    var label = esc(h.name) + (date !== today ? ', ' + esc(D.dayMonthLong(date)) : '');
    if (isAmount(h)) {
      var v = HB.value(log, h, date), step = STEPS[h.unit];
      ctl = '<form class="hab-val' + (v != null ? (done ? ' is-done' : ' is-noted') : '') + '" data-hab-val="' + h.id + '" data-date="' + date + '" novalidate>' +
        '<input class="input input--sm hab-val__input" name="v" value="' + esc(editVal(h, v)) + '" placeholder="' + placeholder(h) + '" inputmode="' + (h.unit === 'h' ? 'text' : 'decimal') + '" autocomplete="off" data-focus-key="hv-' + h.id + date + '" aria-label="' + label + (h.unit && h.unit !== 'h' ? ', en ' + esc(h.unit) : h.unit === 'h' ? ', durée' : '') + '">' +
        (h.unit && h.unit !== 'h' ? '<span class="hab-val__unit" aria-hidden="true">' + esc(h.unit) + '</span>' : '') +
        (step ? '<button type="button" class="btn btn--soft btn--icon btn--sm" data-hab-add="' + h.id + '" data-date="' + date + '" data-focus-key="ha-' + h.id + date + '" aria-label="Ajouter ' + esc(num(step) + ' ' + h.unit) + '">' + icon('plus') + '</button>' : '') +
        '<button type="submit" class="sr-only">Enregistrer</button></form>';
      if (h.goal && v != null) bar = '<span class="hab-row__bar">' + U.progress(Math.min(100, Math.round((h.dir === 'max' ? (v <= h.goal ? 100 : h.goal / v * 100) : v / h.goal * 100))), 'progress--sm' + (done ? ' progress--success' : '')) + '</span>';
    } else if (h.kind === 'count') {
      var n = HB.count(log, h, date);
      ctl = '<div class="hab-step" role="group" aria-label="' + label + '">' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-step="-1" data-id="' + h.id + '" data-date="' + date + '" data-focus-key="habm-' + h.id + '" aria-label="Un de moins"' + (n ? '' : ' disabled') + '>' + icon('minus') + '</button>' +
        '<span class="hab-step__n num' + (done ? ' is-done' : '') + '" aria-live="polite">' + n + '<span class="text-subtle">/' + h.target + '</span></span>' +
        '<button type="button" class="btn btn--soft btn--icon btn--sm" data-hab-step="1" data-id="' + h.id + '" data-date="' + date + '" data-focus-key="habp-' + h.id + '" aria-label="Un de plus' + (h.unit ? ' (' + esc(h.unit) + ')' : '') + '">' + icon('plus') + '</button></div>';
      bar = '<span class="hab-row__bar">' + U.progress(Math.min(100, Math.round(n / h.target * 100)), 'progress--sm' + (done ? ' progress--success' : '')) + '</span>';
    } else {
      ctl = '<button type="button" class="hab-check' + (done ? ' is-done' : '') + '" data-hab-toggle="' + h.id + '" data-date="' + date + '" data-focus-key="hab-' + h.id + '" aria-pressed="' + done + '" aria-label="' + label + (done ? ', fait' : ', à faire') + '">' + icon('check') + '</button>';
    }
    var sub = [isAmount(h) || h.kind === 'count' ? '<span>' + goalText(h) + '</span>' : '', flame(streak), streak < 2 && !compact && h.kind === 'check' ? '<span class="text-subtle">' + esc(daysLabel(h.days)) + '</span>' : ''].filter(Boolean).join('');
    return '<li class="hab-row' + (done ? ' is-done' : '') + (compact ? ' hab-row--compact' : '') + (isAmount(h) ? ' hab-row--amount' : '') + '">' +
      '<span class="hab-row__icon" aria-hidden="true">' + habIcon(h, 2) + '</span>' +
      '<span class="hab-row__text"><span class="hab-row__name">' + esc(h.name) + '</span>' + (sub ? '<span class="hab-row__sub">' + sub + '</span>' : '') + '</span>' +
      bar + ctl + '</li>';
  }

  /* --- Carte de l'Accueil ------------------------------------------------------------ */
  function todayHTML() {
    var today = D.today(), list = active(today), sum = HB.day(hs().list, hs().log, today);
    var body = list.length
      ? '<ul class="hab-list" role="list">' + list.map(function (h) { return rowHTML(h, today, true); }).join('') + '</ul>'
      : hs().list.length ? '<p class="life-card__muted">Rien de prévu aujourd’hui : profite.</p>'
        : '<p class="life-card__muted">Sommeil, eau, pas, temps d’écran… Note ce qui compte pour toi.</p>';
    return '<section class="glass card life-card" aria-labelledby="dh-hab"><div class="card__header"><div><h2 class="card__title" id="dh-hab">' + U.px('sprout', 2) + 'Habitudes</h2>' +
      '<p class="card__subtitle">' + (sum.total ? sum.done + ' sur ' + sum.total + ' aujourd’hui' : 'Un petit suivi par jour') + '</p></div>' +
      '<a class="btn btn--ghost btn--sm" href="#habitudes">' + (hs().list.length ? 'Voir' : 'Commencer') + icon('chevron-right') + '</a></div>' +
      (sum.total ? U.progress(Math.round(sum.done / sum.total * 100), 'progress--sm' + (sum.all ? ' progress--success' : '')) : '') + body + '</section>';
  }

  /* --- Semaine ------------------------------------------------------------------------- */
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
        var avg = isAmount(h) ? HB.values(log, h, w0, D.addDays(w0, 6)).avg : null;
        return '<tr><th scope="row"><span class="hab-week__name"><span aria-hidden="true">' + habIcon(h, 1) + '</span>' + esc(h.name) + '</span></th>' + days.map(function (d) {
          if (!HB.isActive(h, d)) return '<td><span class="hab-cell hab-cell--off" title="Pas prévu">·</span></td>';
          var done = HB.isDone(log, h, d), future = d > today, attrs = ' data-date="' + d + '" data-focus-key="hc-' + h.id + d + '"' + (future ? ' disabled' : '');
          var when = esc(D.dayMonthLong(d));
          if (isAmount(h)) {
            var v = HB.value(log, h, d);
            return '<td><button type="button" class="hab-cell hab-cell--val' + (done ? ' is-done' : v != null ? ' is-part' : '') + (d === today ? ' is-today' : '') + '" data-hab-cellval="' + h.id + '"' + attrs +
              ' aria-label="' + esc(h.name) + ', ' + when + (v != null ? ' : ' + esc(fmtVal(h, v)) : ', rien noté') + '. Modifier">' + (v != null ? '<span class="num">' + esc(shortVal(h, v)) + '</span>' : '') + '</button></td>';
          }
          var n = HB.count(log, h, d);
          return '<td><button type="button" class="hab-cell' + (done ? ' is-done' : n ? ' is-part' : '') + (d === today ? ' is-today' : '') + '" data-hab-cell="' + h.id + '"' + attrs + ' aria-pressed="' + done + '" aria-label="' + esc(h.name) + ', ' + when + (done ? ', fait' : n ? ', ' + n + ' sur ' + h.target : ', pas fait') + '">' + (done ? icon('check') : n ? '<span class="num">' + n + '</span>' : '') + '</button></td>';
        }).join('') + '<td class="hab-week__rate num">' + (isAmount(h) && avg != null && (h.goal == null || !r.planned) ? '<span title="Moyenne">ø ' + esc(shortVal(h, avg)) + '</span>' : r.pct == null ? '—' : r.pct + NB + '%') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* --- Tendances : 14 jours pour chaque valeur notée ----------------------------------- */
  function trendsHTML() {
    var list = hs().list.filter(function (h) { return isAmount(h) && !h.archived; });
    if (!list.length) return '';
    var today = D.today(), log = hs().log, from = D.addDays(today, -13);
    return '<section class="glass card" aria-labelledby="hab-trends"><div class="card__header"><div><h2 class="card__title" id="hab-trends">Tendances</h2><p class="card__subtitle">Les 14 derniers jours</p></div></div>' +
      '<div class="hab-trends">' + list.map(function (h) {
        var st = HB.values(log, h, from, today), wk = HB.values(log, h, D.addDays(today, -6), today);
        var top = Math.max(st.max || 0, h.goal ? h.goal * 1.15 : 0) || 1;
        var ok = 0, noted = 0;
        var cols = D.eachDay(from, today).map(function (d) {
          var v = HB.value(log, h, d), done = HB.isDone(log, h, d);
          if (v != null && d >= D.addDays(today, -6)) { noted++; if (done) ok++; }
          return '<span class="hab-bar' + (done ? ' is-done' : '') + (d === today ? ' is-today' : '') + '" title="' + esc(D.cap(D.dayMonthLong(d))) + ' : ' + (v != null ? esc(fmtVal(h, v)) : 'rien noté') + '">' +
            '<span class="hab-bar__fill" style="height:' + (v != null ? Math.max(3, Math.round(v / top * 100)) : 0) + '%"></span></span>';
        }).join('');
        var summary = wk.avg == null ? 'Rien noté ces 7 derniers jours' : 'Moyenne sur 7 jours : ' + fmtVal(h, wk.avg) + (h.goal != null ? ' · objectif tenu ' + ok + ' jour' + (ok > 1 ? 's' : '') + ' sur ' + noted : '');
        return '<article class="hab-trend"><div class="hab-trend__head"><span aria-hidden="true">' + habIcon(h, 2) + '</span><strong>' + esc(h.name) + '</strong>' +
          '<span class="hab-trend__avg num">' + (wk.avg == null ? '—' : esc(fmtVal(h, wk.avg))) + '</span></div>' +
          '<div class="hab-bars" role="img" aria-label="' + esc(h.name + ', ' + summary) + '">' + cols +
            (h.goal ? '<span class="hab-bars__goal" style="bottom:' + Math.round(h.goal / top * 100) + '%" title="Objectif : ' + esc(fmtVal(h, h.goal)) + '"></span>' : '') + '</div>' +
          '<p class="hab-trend__sum">' + esc(summary) + (st.max != null ? ' · record ' + esc(fmtVal(h, h.dir === 'max' && h.goal != null ? st.min : st.max)) : '') + '</p></article>';
      }).join('') + '</div></section>';
  }

  function manageHTML() {
    var list = hs().list;
    if (!list.length) return '';
    return '<ul class="hab-manage" role="list">' + list.map(function (h, i) {
      var best = HB.bestStreak(hs().log, h, D.today());
      var kind = { check: 'Case à cocher', count: 'Compteur', amount: 'Valeur notée' }[h.kind];
      return '<li class="' + (h.archived ? 'is-archived' : '') + '"><span class="hab-row__icon" aria-hidden="true">' + habIcon(h, 2) + '</span>' +
        '<span class="hab-row__text"><span class="hab-row__name">' + esc(h.name) + (h.archived ? ' <span class="chip">En pause</span>' : '') + '</span>' +
        '<span class="hab-row__sub">' + [kind, goalText(h), esc(daysLabel(h.days)), best ? 'record ' + U.plural(best, 'jour') : ''].filter(Boolean).join(' · ') + '</span></span>' +
        '<span class="hab-manage__actions">' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-move="-1" data-id="' + h.id + '" data-focus-key="hu-' + h.id + '" aria-label="Monter « ' + esc(h.name) + ' »"' + (i ? '' : ' disabled') + '>' + icon('arrow-up') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-move="1" data-id="' + h.id + '" data-focus-key="hd-' + h.id + '" aria-label="Descendre « ' + esc(h.name) + ' »"' + (i < list.length - 1 ? '' : ' disabled') + '>' + icon('arrow-down') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-edit="' + h.id + '" data-focus-key="he-' + h.id + '" aria-label="Modifier « ' + esc(h.name) + ' »">' + icon('edit') + '</button>' +
        '</span></li>';
    }).join('') + '</ul>';
  }

  function ideas() {
    var have = hs().list.map(function (h) { return h.name.toLowerCase(); });
    return HB.SUGGESTIONS.filter(function (x) { return have.indexOf(x.name.toLowerCase()) < 0; });
  }
  function ideasHTML() {
    var list = ideas();
    if (!list.length) return '';
    return '<div class="hab-ideas"><p class="hab-ideas__label">Idées en un clic</p><div class="hab-ideas__list">' + list.map(function (x, i) {
      var hint = x.kind === 'amount' && x.goal != null ? ' (' + (x.dir === 'max' ? '≤ ' : '≥ ') + fmtVal(x, x.goal) + ')' : '';
      return '<button type="button" class="chip-btn" data-hab-idea="' + i + '" data-focus-key="hi-' + i + '">' + habIcon(x, 1) + esc(x.name) + esc(hint) + '</button>';
    }).join('') + '</div></div>';
  }

  /* --- Vue ------------------------------------------------------------------------------ */
  function render() {
    if (!el) return;
    var today = D.today();
    day = day && day <= today ? day : today;
    var log = hs().log, list = active(day), sum = HB.day(hs().list, log, day), now = HB.day(hs().list, log, today);
    var w0 = D.startOfWeek(today), week = HB.period(hs().list, log, w0, D.addDays(w0, 6), today);
    var best = HB.maxStreak(hs().list, log, today, false);
    var tile = function (ic, label, value, extra) {
      return '<article class="glass stat"><div class="stat__head"><span class="stat__icon">' + icon(ic) + '</span><span class="stat__label">' + esc(label) + '</span></div><div class="stat__value">' + value + '</div>' + (extra ? '<span class="stat__delta">' + extra + '</span>' : '') + '</article>';
    };
    var dayTitle = day === today ? 'Aujourd’hui' : day === D.addDays(today, -1) ? 'Hier' : D.cap(D.dayMonthLong(day));
    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Accueil</p><h1 class="h1" id="h-habits" tabindex="-1">Habitudes</h1>' +
        '<p class="page-head__lead">Coche, compte ou note : heures de sommeil, litres d’eau, pas, temps d’écran… Un jour manqué n’efface rien.</p></div>' +
        '<div class="page-head__actions"><button type="button" class="btn btn--primary" data-hab-new>' + icon('plus') + 'Nouvelle habitude</button></div></header>' +
      (hs().list.length ? '<div class="kpi-row kpi-row--3">' +
        tile('check', 'Aujourd’hui', now.done + '<span class="stat__unit">/' + now.total + '</span>', now.all ? 'Tout est fait, bravo !' : 'Encore un petit effort') +
        tile('calendar', 'Cette semaine', week.pct == null ? '—' : week.pct + '<span class="stat__unit">' + NB + '%</span>', U.plural(week.done, 'jour') + ' réussi' + (week.done > 1 ? 's' : '')) +
        tile('sparkle', 'Meilleure série', best + '<span class="stat__unit">' + NB + (best > 1 ? 'jours' : 'jour') + '</span>', best >= 7 ? 'Belle régularité' : 'Ça commence ici') +
      '</div>' : '') +
      '<div class="hab-layout">' +
        '<section class="glass card" aria-labelledby="hab-day"><div class="card__header hab-day-head"><div><h2 class="card__title" id="hab-day">' + esc(dayTitle) + '</h2>' +
          '<p class="card__subtitle">' + (sum.total ? sum.done + ' sur ' + sum.total + ' réussi' + (sum.done > 1 ? 's' : '') : 'Rien de prévu') + '</p></div>' +
          '<div class="hab-day-nav"><button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-day="-1" data-focus-key="hd-prev" aria-label="Jour précédent">' + icon('chevron-left') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-hab-day="1" data-focus-key="hd-next" aria-label="Jour suivant"' + (day >= today ? ' disabled' : '') + '>' + icon('chevron-right') + '</button></div></div>' +
          (sum.total ? U.progress(Math.round(sum.done / sum.total * 100), sum.all ? 'progress--success' : '') : '') +
          (list.length ? '<ul class="hab-list" role="list">' + list.map(function (h) { return rowHTML(h, day, false); }).join('') + '</ul>'
            : '<p class="hint">' + (hs().list.length ? 'Aucune habitude prévue ce jour-là.' : 'Commence par une ou deux habitudes : ton sommeil et l’eau, par exemple. C’est la régularité qui compte.') + '</p>') +
          (list.some(isAmount) ? '<p class="hint hab-hint">Écris la valeur puis appuie sur Entrée. Pour une durée : 7h30, 7,5 ou 45 (minutes).</p>' : '') +
          (hs().list.length < 3 ? ideasHTML() : '') +
        '</section>' +
        (hs().list.length ? '<section class="glass card" aria-labelledby="hab-week"><div class="card__header"><div><h2 class="card__title" id="hab-week">Cette semaine</h2><p class="card__subtitle">Touche une case pour la cocher ou modifier la valeur</p></div></div>' + weekGrid(today) + '</section>' : '') +
      '</div>' +
      trendsHTML() +
      (hs().list.length ? '<section class="glass card" aria-labelledby="hab-all"><div class="card__header"><div><h2 class="card__title" id="hab-all">Mes habitudes</h2><p class="card__subtitle">Type, objectif, jours prévus, pause</p></div></div>' + manageHTML() + (hs().list.length >= 3 ? ideasHTML() : '') + '</section>' : '');
    U.keepFocus(el, function () { el.innerHTML = html; });
  }

  /* --- Ajouter / modifier ------------------------------------------------------------ */
  function openEditor(h, returnTo) {
    var isNew = !h;
    h = h || { name: '', icon: 'px:moon', kind: 'amount', target: 2, unit: 'h', goal: null, dir: 'min', days: [0, 1, 2, 3, 4, 5, 6] };
    var knownUnit = UNITS.some(function (u) { return u[0] && u[0] === h.unit; });
    var KIND_CHOICES = [['check', 'Case à cocher', 'Fait ou pas fait'], ['count', 'Compteur', 'ex. 8 verres d’eau'], ['amount', 'Valeur à noter', 'ex. heures de sommeil, litres, pas']];
    U.dialog({
      title: isNew ? 'Nouvelle habitude' : 'Modifier l’habitude',
      size: 'md',
      returnTo: returnTo,
      confirmLabel: isNew ? 'Ajouter' : 'Enregistrer',
      body: '<div class="form-grid">' +
        '<div class="field field--full"><label class="label" for="hb-name">Nom</label><input class="input" id="hb-name" name="name" maxlength="60" value="' + esc(h.name) + '" placeholder="ex. Sommeil, Eau, Temps d’écran" required></div>' +
        '<fieldset class="field field--full"><legend class="label">Comment la suivre ?</legend><div class="hab-kinds">' +
          KIND_CHOICES.map(function (k) { return '<label class="focus-preset"><input type="radio" name="kind" value="' + k[0] + '"' + (h.kind === k[0] ? ' checked' : '') + '><span><strong>' + k[1] + '</strong><span class="text-subtle">' + k[2] + '</span></span></label>'; }).join('') +
        '</div></fieldset>' +
        '<div class="field" data-kf="count"><label class="label" for="hb-target">Combien de fois par jour ?</label><input class="input" id="hb-target" name="target" type="number" min="2" max="50" value="' + Math.max(2, h.target) + '"></div>' +
        '<div class="field" data-kf="count"><label class="label" for="hb-cunit">Unité <span class="text-subtle">facultatif</span></label><input class="input" id="hb-cunit" name="cunit" maxlength="20" value="' + esc(h.kind === 'count' ? h.unit : '') + '" placeholder="verres, pages…"></div>' +
        '<div class="field" data-kf="amount"><label class="label" for="hb-unit">Unité</label><select class="select" id="hb-unit" name="unit">' +
          UNITS.map(function (u) { var sel = u[0] ? u[0] === h.unit : !knownUnit; return '<option value="' + u[0] + '"' + (sel ? ' selected' : '') + '>' + u[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field" data-kf="amount" data-kf-custom><label class="label" for="hb-ounit">Ton unité</label><input class="input" id="hb-ounit" name="ounit" maxlength="20" value="' + esc(!knownUnit && h.kind === 'amount' ? h.unit : '') + '" placeholder="kg, tasses, €…"></div>' +
        '<div class="field" data-kf="amount"><label class="label" for="hb-dir">Objectif <span class="text-subtle">facultatif</span></label><select class="select" id="hb-dir" name="dir">' +
          '<option value="min"' + (h.dir !== 'max' ? ' selected' : '') + '>Au moins</option><option value="max"' + (h.dir === 'max' ? ' selected' : '') + '>Au plus</option></select></div>' +
        '<div class="field" data-kf="amount"><label class="label" for="hb-goal">Valeur visée</label><input class="input" id="hb-goal" name="goal" autocomplete="off" value="' + esc(h.kind === 'amount' && h.goal != null ? editVal(h, h.goal) : '') + '" placeholder="ex. 7h30"><p class="hint" data-goal-hint>Vide : la journée compte dès que tu notes une valeur.</p></div>' +
        '<fieldset class="field field--full hab-icons"><legend class="label">Icône</legend><div class="hab-icons__list">' +
          ICONS.map(function (ic) { return '<label class="hab-icon"><input type="radio" name="icon" value="px:' + ic + '"' + (ic === iconName(h.icon) ? ' checked' : '') + '><span aria-hidden="true">' + U.px(ic, 2) + '</span><span class="sr-only">' + ic + '</span></label>'; }).join('') +
          (ICONS.indexOf(iconName(h.icon)) < 0 ? '<label class="hab-icon"><input type="radio" name="icon" value="' + esc(h.icon) + '" checked><span aria-hidden="true">' + habIcon(h, 2) + '</span></label>' : '') +
        '</div></fieldset>' +
        '<fieldset class="field field--full"><legend class="label">Jours prévus</legend><div class="hab-days">' +
          DAY_NAMES.map(function (n, i) { return '<label class="hab-day"><input type="checkbox" name="days" value="' + i + '"' + (h.days.indexOf(i) >= 0 ? ' checked' : '') + '><span aria-hidden="true">' + DAY_LETTERS[i] + '</span><span class="sr-only">' + n + '</span></label>'; }).join('') +
        '</div><p class="hint">Un jour non prévu ne casse jamais une série.</p></fieldset>' +
        (isNew ? '' : '<div class="field field--full hab-danger">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-hb-pause>' + icon(h.archived ? 'play' : 'pause') + (h.archived ? 'Reprendre cette habitude' : 'Mettre en pause') + '</button>' +
          '<button type="button" class="btn btn--ghost btn--sm btn--danger-text" data-hb-del>' + icon('trash') + 'Supprimer</button></div>') +
        '</div>',
      onMount: function (form) {
        function sync() {
          var k = (form.querySelector('[name=kind]:checked') || {}).value;
          form.querySelectorAll('[data-kf]').forEach(function (f) { f.hidden = f.getAttribute('data-kf') !== k; });
          var custom = form.querySelector('[data-kf-custom]');
          if (k === 'amount') custom.hidden = form.unit.value !== '';
          form.goal.placeholder = 'ex. ' + placeholder({ unit: form.unit.value });
        }
        form.addEventListener('change', function (e) { if (e.target.name === 'kind' || e.target.name === 'unit') sync(); });
        sync();
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
        var kind = (form.querySelector('[name=kind]:checked') || {}).value || 'check';
        var data = { name: name, icon: iconChecked ? iconChecked.value : 'px:star', kind: kind, days: days, target: 1, unit: '', goal: null, dir: 'min' };
        if (kind === 'count') { data.target = Math.max(2, Math.min(50, Math.round(+form.target.value || 2))); data.unit = form.cunit.value.trim(); }
        if (kind === 'amount') {
          data.unit = form.unit.value || form.ounit.value.trim();
          data.dir = form.dir.value === 'max' ? 'max' : 'min';
          var g = parseVal({ unit: data.unit }, form.goal.value);
          if (g !== null && isNaN(g)) {
            form.goal.closest('.field').classList.add('field--error');
            form.querySelector('[data-goal-hint]').textContent = data.unit === 'h' ? 'Une durée, par exemple 7h30, 7,5 ou 45 (minutes).' : 'Un nombre, par exemple 1,5.';
            form.goal.focus();
            return false;
          }
          data.goal = g;
        }
        if (isNew) { S.addHabit(data); U.toast({ kind: 'success', icon: 'check', title: 'Habitude ajoutée', text: '« ' + name + ' » : à toi de jouer !', duration: 3000 }); }
        else S.updateHabit(h.id, data);
      }
    });
  }

  // Modifier la valeur d'un jour (grille de la semaine)
  function editDay(h, date, returnTo) {
    var v = HB.value(hs().log, h, date);
    U.dialog({
      title: h.name, desc: D.cap(D.dayMonthLong(date)) + (h.goal != null ? ' · ' + (h.dir === 'max' ? 'au plus ' : 'au moins ') + fmtVal(h, h.goal) : ''),
      returnTo: returnTo, confirmLabel: 'Enregistrer',
      body: '<div class="field"><label class="label" for="hd-v">' + (h.unit === 'h' ? 'Durée' : 'Valeur' + (h.unit ? ' (' + esc(h.unit) + ')' : '')) + '</label>' +
        '<input class="input" id="hd-v" name="v" autocomplete="off" inputmode="' + (h.unit === 'h' ? 'text' : 'decimal') + '" value="' + esc(editVal(h, v)) + '" placeholder="' + placeholder(h) + '">' +
        '<p class="hint" data-hd-hint>' + (h.unit === 'h' ? 'Par exemple 7h30, 7,5 ou 45 (minutes).' : '') + ' Vide : efface la valeur.</p></div>',
      onConfirm: function (form) {
        var n = parseVal(h, form.v.value);
        if (n !== null && isNaN(n)) { form.v.closest('.field').classList.add('field--error'); form.v.focus(); return false; }
        saveValue(h, date, n);
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
  function saveValue(h, date, n) {
    var before = HB.value(hs().log, h, date), was = HB.isDone(hs().log, h, date);
    if (before === n || (before != null && n != null && Math.abs(before - n) < 0.005)) return;
    S.setHabitValue(h.id, date, n);
    if (!was && HB.isDone(hs().log, h, date)) afterChange(date);
    else if (n != null) U.announce(h.name + ' : ' + fmtVal(h, n) + ' noté');
  }
  function commitInput(form) {
    var h = habit(form.getAttribute('data-hab-val')), date = form.getAttribute('data-date'), input = form.querySelector('input');
    if (!h) return;
    var n = parseVal(h, input.value);
    if (n !== null && isNaN(n)) {
      input.classList.add('is-invalid');
      U.toast({ kind: 'warning', icon: 'alert', title: 'Valeur à vérifier', text: h.unit === 'h' ? 'Une durée, par exemple 7h30, 7,5 ou 45 (minutes).' : 'Un nombre, par exemple 1,5.', duration: 4000 });
      return;
    }
    saveValue(h, date, n);
  }

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-hab-val]');
    if (!f) return;
    e.preventDefault();
    commitInput(f);
  });
  document.addEventListener('change', function (e) {
    var f = e.target.closest && e.target.closest('[data-hab-val]');
    if (f) commitInput(f);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hab-toggle], [data-hab-step], [data-hab-cell], [data-hab-cellval], [data-hab-add]');
    if (!b || b.disabled) return;
    var date = b.getAttribute('data-date');
    if (b.hasAttribute('data-hab-toggle')) {
      var h = habit(b.getAttribute('data-hab-toggle'));
      if (h) setCount(h.id, date, HB.isDone(hs().log, h, date) ? 0 : h.target);
    } else if (b.hasAttribute('data-hab-step')) {
      var h2 = habit(b.getAttribute('data-id'));
      if (h2) setCount(h2.id, date, HB.count(hs().log, h2, date) + +b.getAttribute('data-hab-step'));
    } else if (b.hasAttribute('data-hab-cellval')) {
      var h4 = habit(b.getAttribute('data-hab-cellval'));
      if (h4) editDay(h4, date, b);
    } else if (b.hasAttribute('data-hab-add')) {
      var h5 = habit(b.getAttribute('data-hab-add'));
      if (h5) saveValue(h5, date, Math.round(((HB.value(hs().log, h5, date) || 0) + STEPS[h5.unit]) * 100) / 100);
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
        var x = ideas()[+b.getAttribute('data-hab-idea')];
        if (x) { S.addHabit({ name: x.name, icon: x.icon, kind: x.kind, target: x.target, unit: x.unit, goal: x.goal, dir: x.dir }); U.toast({ kind: 'success', icon: 'check', title: 'Habitude ajoutée', text: '« ' + x.name + ' » : tu peux changer l’objectif avec le crayon.', duration: 3500 }); }
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
