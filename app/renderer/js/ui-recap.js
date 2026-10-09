/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · Récap
   Période jour / semaine / mois + navigation ; KPI ; heures par catégorie
   en petits multiples (jamais additionnées, objectif Flow Line) ; listes
   « à terminer » et « arrivent bientôt » ; répartition ; courbe d'humeur ;
   export CSV (fonctionnel) et PDF (impression A4).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui, Q = L.q, C = L.charts;
  var esc = U.esc, icon = U.icon, NB = D.NBSP;
  var el = null, charts = [];

  function period() {
    var ui = S.get().settings.ui;
    return D.period(ui.recapPeriod || 'week', ui.recapAnchor || D.today());
  }

  function prevPeriod(p) { return D.period(p.kind, D.shift(p.kind, p.start, -1)); }

  // Pour une période en cours, on compare « à date » : la période précédente tronquée
  // au même nombre de jours écoulés (comparer un mois entamé à un mois complet découragerait).
  function prevComparable(p) {
    var prev = prevPeriod(p);
    if (!isCurrent(p)) return prev;
    var elapsed = D.diff(p.start, D.today());
    var end = D.min(prev.end, D.addDays(prev.start, elapsed));
    return { kind: prev.kind, start: prev.start, end: end, days: D.eachDay(prev.start, end), label: prev.label, partial: true };
  }

  /* --- Heures ------------------------------------------------------------- */
  function goalDays(c) {
    var g = Q.goalFor(c);
    return g ? g.days : [];
  }

  function hoursSeries(c, p) {
    var g = Q.goalFor(c);
    var daily = Q.dailyMinutes(c.id, p.start, p.end, true);
    var today = D.today();
    if (p.kind === 'week') {
      return p.days.map(function (d) {
        var gd = g && goalDays(c).indexOf(D.dow(d)) >= 0 ? g.daily : null;
        return { key: d, label: D.cap(D.DAYS_SHORT[D.dow(d)]), short: D.DAYS_LETTER[D.dow(d)], sub: String(D.parse(d).getDate()), value: daily[d], goal: gd, future: d > today, current: d === today,
          title: D.cap(D.dayMonthLong(d)) + ' : ' + D.duration(daily[d]) + (gd ? ', objectif ' + D.duration(gd) : ''), tipTitle: D.cap(D.dayMonthLong(d)) };
      });
    }
    // Mois : une barre par semaine (portion du mois)
    var weeks = [];
    var w = D.startOfWeek(p.start);
    while (w <= p.end) {
      var a = D.max(w, p.start), b = D.min(D.addDays(w, 6), p.end);
      var v = 0, goal = 0;
      D.eachDay(a, b).forEach(function (d) {
        v += daily[d] || 0;
        if (g && goalDays(c).indexOf(D.dow(d)) >= 0) goal += g.daily;
      });
      weeks.push({ key: w, label: 'S' + D.isoWeek(w), sub: D.parse(a).getDate() + '–' + D.parse(b).getDate(), value: v, goal: g ? goal : null,
        future: a > today, current: D.between(today, a, b),
        title: 'Semaine ' + D.isoWeek(w) + ', du ' + D.dayMonth(a) + ' au ' + D.dayMonth(b) + ' : ' + D.duration(v) + (g ? ', objectif ' + D.duration(goal) : ''),
        tipTitle: 'Semaine ' + D.isoWeek(w) + ' · ' + D.dayMonth(a) + ' → ' + D.dayMonth(b) });
      w = D.addDays(w, 7);
    }
    return weeks;
  }

  function hoursCard(c, p) {
    var g = Q.goalFor(c);
    var mins = Q.minutesByCategory(p.start, p.end, true)[c.id] || 0;
    var goalTotal = 0;
    if (g) D.eachDay(p.start, p.end).forEach(function (d) { if (g.days.indexOf(D.dow(d)) >= 0) goalTotal += g.daily; });
    var prev = prevComparable(p);
    var prevMins = Q.minutesByCategory(prev.start, prev.end, false)[c.id] || 0;
    var prevName = { day: 'la veille', week: 'S' + D.isoWeek(prev.start), month: D.MONTHS_SHORT[D.parse(prev.start).getMonth()] }[p.kind];
    var deltaTxt = prevMins || mins ? (mins - prevMins >= 0 ? '+' : '−') + NB + D.duration(Math.abs(mins - prevMins)) + ' vs ' + prevName : '';
    // QA-06 : un jour sans objectif (samedi, dimanche pour Flow Line) n'affiche ni « sur 0 h » ni « objectif atteint »
    var hasGoal = !!g && goalTotal > 0;
    var compare = hasGoal ? '<span class="hcard__goal">sur ' + D.duration(goalTotal) + '</span>' : '';
    var goalNote = '';
    if (g && !hasGoal) {
      goalNote = 'Pas d’objectif ' + (p.kind === 'day' ? 'ce jour-là' : 'sur cette période') + (D.isWeekend(p.start) && p.kind === 'day' ? ' : c’est le week-end.' : '.');
    } else if (g) {
      var left = goalTotal - mins;
      if (isCurrent(p) && p.kind !== 'day') {
        var toDate = 0;
        D.eachDay(p.start, D.today()).forEach(function (d) { if (g.days.indexOf(D.dow(d)) >= 0) toDate += g.daily; });
        goalNote = 'Objectif à ce jour : ' + D.duration(toDate) + (mins >= toDate ? ', c’est dans la poche.' : '. La période n’est pas finie, rien ne presse.');
      } else {
        goalNote = left > 0 ? 'Encore ' + D.duration(left) + ' pour l’objectif de la période.' : (left === 0 ? 'Objectif atteint, pile poil.' : 'Objectif atteint : +' + NB + D.duration(-left) + ', tout en douceur.');
      }
    } else {
      var pg = Q.persoGoal(p.start, p.start, false);
      goalNote = c.group === 'auto-entreprise'
        ? (pg.enabled ? 'Compte dans le minimum perso du pôle (voir « ' + pg.label + ' »).' : 'Sans objectif : le perso se fait surtout le samedi.')
        : 'Sans objectif d’heures.';
    }
    var body;
    var id = 'hc-' + c.id;
    if (p.kind === 'day') {
      var entries = [];
      S.get().tasks.forEach(function (t) { if (t.categoryId === c.id) t.timeEntries.forEach(function (e) { if (e.date === p.start) entries.push({ t: t, e: e }); }); });
      body = (hasGoal ? '<span class="progress progress--lg ' + progressCls(c) + '" style="--value:' + Math.min(100, Math.round(mins / goalTotal * 100)) + '" aria-hidden="true"></span>' : '') +
        (entries.length ? '<ul class="day-entries" role="list">' + entries.map(function (x) {
          return '<li><span class="day-entries__title">' + esc(x.t.title) + '</span><span class="day-entries__dur num">' + D.duration(x.e.minutes) + '</span></li>';
        }).join('') + runningRow(c, p) + '</ul>' : '<p class="empty-line">Pas d’heures ce jour-là' + (D.isWeekend(p.start) && c.group === 'flowline' ? ' : c’était le week-end.' : '.') + '</p>');
    } else {
      body = '<div class="chart-host" data-chart="bars" data-chart-id="' + id + '"></div>' +
        (g ? '<p class="chart-legend"><span class="chart-legend__goal" aria-hidden="true"></span>Objectif ' + (p.kind === 'week' ? D.duration(g.daily) + ' par jour travaillé' : D.duration(g.weekly) + ' par semaine (au prorata en début et fin de mois)') + '</p>' : '');
      charts.push({ id: id, kind: 'bars', hue: U.hue(c), name: c.name, data: hoursSeries(c, p) });
    }
    return '<section class="glass card hcard ' + U.hue(c) + (g ? ' hcard--goal' : '') + '" aria-labelledby="' + id + '-t">' +
      '<div class="hcard__head"><h3 class="hcard__title" id="' + id + '-t">' + U.catChip(c) + '</h3>' +
        (deltaTxt ? '<span class="stat__delta" title="Comparaison avec la période précédente' + (isCurrent(p) ? ', au même stade (période en cours)' : '') + '">' + esc(deltaTxt) + '</span>' : '') + '</div>' +
      '<p class="hcard__value"><span class="hcard__num">' + D.duration(mins) + '</span>' + compare + '</p>' +
      (goalNote ? '<p class="hcard__note">' + esc(goalNote) + '</p>' : '') + body +
      (p.kind !== 'day' ? tableTwin(c, p) : '') +
    '</section>';
  }

  // Objectif du pôle auto-entreprise (Carnet by-pass + Auto-entreprise) : 4 h minimum le samedi.
  // Jamais additionné à Flow Line. Jour : la journée perso de la semaine si le jour choisi n'en est pas une.
  function persoCard(p) {
    var range = p.kind === 'day' ? [D.startOfWeek(p.start), D.endOfWeek(p.start)] : [p.start, p.end];
    var g = Q.persoGoal(range[0], range[1], true);
    if (p.kind === 'day') {
      var same = g.days.filter(function (x) { return x.date === p.start; });
      if (same.length) g.days = same;
    }
    if (!g.enabled || !g.days.length) return '';
    var today = D.today();
    var goal = g.goalPerDay;
    var counted = g.days.filter(function (x) { return x.date <= today; });
    var reached = counted.filter(function (x) { return x.reached; }).length;
    var mins = g.days.reduce(function (sum, x) { return sum + x.minutes; }, 0);
    var one = g.days.length === 1;
    var value = one
      ? '<span class="hcard__num">' + D.duration(mins) + '</span><span class="hcard__goal">sur ' + D.duration(goal) + ' minimum</span>'
      : '<span class="hcard__num">' + reached + NB + '/' + NB + g.days.length + '</span><span class="hcard__goal">' + (g.label === 'Samedi perso' ? 'samedis' : 'jours perso') + ' à ' + D.duration(goal) + ' ou plus</span>';
    var note = one
      ? (g.days[0].reached ? 'Minimum atteint' + (mins > goal ? ' : +' + NB + D.duration(mins - goal) + ' en bonus.' : ', bravo !')
        : g.days[0].future ? 'Rendez-vous ' + D.dayMonthLong(g.days[0].date) + ', à ton rythme.'
        : g.days[0].today ? 'Encore ' + D.duration(goal - mins) + ' aujourd’hui pour ton minimum perso.'
        : 'Un samedi plus léger : ça arrive, et c’est très bien aussi.')
      : (counted.length ? reached + ' sur ' + counted.length + ' déjà passé' + (counted.length > 1 ? 's' : '') + '. Chaque samedi compte pour lui-même.' : 'Le mois commence : les samedis arrivent.');
    var days = g.days.map(function (x) {
      return '<div class="perso-day' + (x.future ? ' is-future' : '') + '"><span class="perso-day__label">' + esc(D.cap(D.dayMonthLong(x.date))) + '</span>' +
        '<span class="perso-day__value num">' + D.duration(x.minutes) + ' / ' + D.duration(goal) + '</span>' +
        '<span class="progress progress--pole" style="--value:' + Math.min(100, Math.round(x.minutes / goal * 100)) + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + goal + '" aria-valuenow="' + x.minutes + '" aria-label="' + esc(D.cap(D.dayMonthLong(x.date))) + ' : ' + D.duration(x.minutes) + ' sur ' + D.duration(goal) + ' minimum"></span></div>';
    }).join('');
    return '<section class="glass card hcard hcard--pole" aria-labelledby="hc-pole-t">' +
      '<div class="hcard__head"><h3 class="hcard__title" id="hc-pole-t"><span class="chip chip--pole">' + esc(g.label) + '</span></h3></div>' +
      '<p class="hcard__value">' + value + '</p>' +
      '<p class="hcard__note">' + esc(note) + '</p>' +
      '<div class="hcard__days">' + days + '</div>' +
      '<p class="chart-legend">Pôle auto-entreprise : Carnet by-pass et Auto-entreprise réunis, jamais additionnés à Flow Line.</p>' +
    '</section>';
  }

  // Le chrono en cours compte dans le total du jour : on l'affiche aussi dans la liste
  function runningRow(c, p) {
    var tm = S.get().activeTimer;
    var t = tm && S.task(tm.taskId);
    if (!t || t.categoryId !== c.id || p.start !== D.today()) return '';
    return '<li class="is-running"><span class="day-entries__title"><span class="chrono__live' + (tm.pausedAt ? ' is-paused' : '') + '" aria-hidden="true"></span>' + esc(t.title) + ' <span class="text-muted">(chrono en cours)</span></span>' +
      '<span class="day-entries__dur num">' + D.duration(Math.floor(L.chrono.elapsed() / 60000)) + '</span></li>';
  }

  function isCurrent(p) { return D.between(D.today(), p.start, p.end); }

  function progressCls(c) {
    return { flowline: 'progress--flowline', carnet: 'progress--carnet', auto: 'progress--auto' }[c.color] || 'progress--hue ' + U.hue(c);
  }

  function tableTwin(c, p) {
    var rows = hoursSeries(c, p);
    return '<details class="data-twin"><summary>Voir les données</summary><table class="mini-table"><thead><tr><th scope="col">' + (p.kind === 'week' ? 'Jour' : 'Semaine') + '</th><th scope="col">Heures</th>' +
      (Q.goalFor(c) ? '<th scope="col">Objectif</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><th scope="row">' + esc(r.tipTitle) + '</th><td class="num">' + D.duration(r.value) + '</td>' + (Q.goalFor(c) ? '<td class="num">' + (r.goal ? D.duration(r.goal) : '—') + '</td>' : '') + '</tr>'; }).join('') +
      '</tbody></table></details>';
  }

  /* --- KPI ------------------------------------------------------------------ */
  function kpis(p) {
    var s = Q.summary(p);
    var pp = prevComparable(p);
    var ps = Q.summary(pp);
    var vs = 'vs ' + { day: 'la veille', week: 'S' + D.isoWeek(pp.start), month: D.MONTHS_SHORT[D.parse(pp.start).getMonth()] }[p.kind];
    function delta(a, b) {
      var d = a - b;
      return '<span class="stat__delta" title="Comparaison avec la période précédente' + (pp.partial ? ', au même stade' : '') + '">' + (d > 0 ? icon('arrow-up') : d < 0 ? icon('arrow-down') : '') + (d > 0 ? '+' : '') + (d === 0 ? '=' : d) + ' ' + vs + '</span>';
    }
    function tile(ic, label, value, extra, cls) {
      return '<article class="glass stat ' + (cls || '') + '"><div class="stat__head"><span class="stat__icon">' + icon(ic) + '</span><span class="stat__label">' + esc(label) + '</span></div>' +
        '<div class="stat__value">' + value + '</div>' + (extra || '') + '</article>';
    }
    var replanNow = s.replan.length;
    var rate = s.rate;
    return '<div class="kpi-row">' +
      tile('plus', 'Tâches créées', s.created.length, delta(s.created.length, ps.created.length)) +
      tile('check', 'Terminées', s.done.length, delta(s.done.length, ps.done.length), 'stat--done') +
      tile('tasks', 'En cours', s.ongoing.length, '<span class="stat__sub">dont ' + s.ongoing.filter(function (t) { return t.status === 'review'; }).length + ' en validation</span>') +
      tile('refresh', 'À replanifier', replanNow, '<span class="stat__sub">' + (replanNow ? 'Échéance passée sur la période' : 'Rien à replanifier') + '</span>', 'stat--replan') +
      '<article class="glass stat stat--ring"><div class="stat__head"><span class="stat__icon">' + icon('target') + '</span><span class="stat__label">Taux de complétion</span></div>' +
        '<div class="stat-ring">' +
          (rate == null ? '<p class="stat__sub">Aucune échéance passée sur la période.</p>'
            : '<div class="ring" style="--value:' + rate + ';--ring-size:72px;--ring-thickness:8px" role="img" aria-label="' + rate + ' % des échéances tenues"><span class="ring__value">' + rate + '<small>%</small></span></div>' +
              '<p class="stat__sub">' + s.dueDone.length + ' échéance' + (s.dueDone.length > 1 ? 's' : '') + ' tenue' + (s.dueDone.length > 1 ? 's' : '') + ' sur ' + s.due.length + (isCurrent(p) ? ', jusqu’à aujourd’hui' : '') + '</p>') +
        '</div></article>' +
    '</div>';
  }

  /* --- Listes --------------------------------------------------------------- */
  var expanded = {};
  function taskList(list, empty, key) {
    if (!list.length) return '<p class="empty-line">' + esc(empty) + '</p>';
    var MAX = 6;
    var more = list.length - MAX;
    var shown = more > 0 && !expanded[key] ? list.slice(0, MAX) : list;
    return '<ul class="recap-list" role="list">' + shown.map(function (t) {
      var c = S.category(t.categoryId);
      return '<li><button type="button" class="recap-item" data-open-task="' + t.id + '" data-focus-key="rc-' + key + '-' + t.id + '">' + U.catDot(c) +
        '<span class="recap-item__text"><span class="recap-item__title">' + esc(t.title) + '</span><span class="recap-item__meta">' + esc(c.name) + (t.client ? ' · ' + esc(t.client) : '') + ' · ' + t.progress + NB + '%</span></span>' +
        U.dueBadge(t) + '</button></li>';
    }).join('') + '</ul>' +
      (more > 0 ? '<button type="button" class="btn btn--ghost btn--sm recap-more" data-more="' + key + '" data-focus-key="more-' + key + '" aria-expanded="' + !!expanded[key] + '">' +
        icon(expanded[key] ? 'chevron-up' : 'chevron-down') + (expanded[key] ? 'Afficher moins' : 'Afficher les ' + more + ' autres') + '</button>' : '');
  }

  /* --- Humeur ------------------------------------------------------------- */
  function moodDays(p) {
    var end = p.end > D.today() ? D.today() : p.end;
    var start = D.addDays(end, -29);
    return D.eachDay(start, end).map(function (d) { var m = Q.mood(d); return { date: d, level: m ? m.level : null, note: m ? m.note : '' }; });
  }

  function moodInsight(days) {
    var flow = S.get().categories.filter(function (c) { return c.group === 'flowline'; });
    var heavy = [], light = [];
    days.forEach(function (d) {
      if (!d.level || D.isWeekend(d.date)) return;
      var m = 0;
      flow.forEach(function (c) { m += Q.dailyMinutes(c.id, d.date, d.date, false)[d.date]; });
      (m >= 450 ? heavy : light).push(d.level);
    });
    function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
    var noted = days.filter(function (d) { return d.level; });
    var mean = avg(noted.map(function (d) { return d.level; }));
    var ah = avg(heavy), al = avg(light);
    var msg;
    if (ah == null || al == null) msg = 'Pas encore assez de jours pour comparer. Ça viendra avec le temps.';
    else if (Math.abs(ah - al) < 0.3) msg = 'Ton humeur reste stable, quelle que soit la charge. Bel équilibre.';
    else if (al > ah) msg = 'Les journées plus légères te réussissent un peu mieux. À garder en tête quand tu planifies.';
    else msg = 'Les grosses journées ne te font pas peur, au contraire. Pense quand même aux pauses.';
    function fmt(v) { return v == null ? '—' : v.toFixed(1).replace('.', ','); }
    return '<div class="insight">' +
      '<div class="insight__fig"><span class="insight__num num">' + fmt(mean) + '</span><span class="insight__label">humeur moyenne sur ' + U.plural(noted.length, 'jour noté', 'jours notés') + '</span></div>' +
      '<div class="insight__split">' +
        '<div><span class="insight__num insight__num--sm num">' + fmt(ah) + '</span><span class="insight__label">jours à 7' + NB + 'h 30 ou plus de Flow Line</span></div>' +
        '<div><span class="insight__num insight__num--sm num">' + fmt(al) + '</span><span class="insight__label">journées plus légères</span></div>' +
      '</div><p class="insight__msg">' + esc(msg) + '</p></div>';
  }

  /* --- Répartition ------------------------------------------------------ */
  function activeTasks(p) {
    return S.get().tasks.filter(function (t) {
      if (t.timeEntries.some(function (e) { return D.between(e.date, p.start, p.end); })) return true;
      if (t.endDate && D.between(t.endDate, p.start, p.end)) return true;
      return D.between(t.createdAt, p.start, p.end);
    });
  }

  /* --- Exports : CSV (shared/csv.js) et PDF (printToPDF), enregistrés par le main --- */
  function csv(p) { return L.shared.csv.build(S.get(), p.start, p.end); }

  function savedToast(title, res, text) {
    if (res && res.ok) {
      U.toast({ kind: 'success', icon: 'download', title: title, text: text, duration: 7000,
        actions: [{ label: 'Afficher le fichier', fn: function () { window.lamia.app.showFile(res.path); } }] });
    } else if (res && !res.canceled) {
      U.toast({ kind: 'warning', icon: 'alert', title: 'Export impossible', text: (res && res.error) || 'Le fichier n’a pas pu être enregistré.' });
    }
  }

  function exportCSV() {
    var p = period();
    var name = L.shared.csv.filename(p);
    return window.lamia.io.exportCsv({ filename: name, content: csv(p) }).then(function (res) {
      savedToast('Export CSV enregistré', res, res && res.path ? res.path.split(/[\\/]/).pop() + ' : une ligne par entrée, sous-totaux par catégorie, sans total général.' : '');
      return res;
    });
  }

  function exportPDF() {
    var p = period();
    var name = 'recap-lamia_' + p.start + (p.end !== p.start ? '_' + p.end : '') + '.pdf';
    var root = document.documentElement;
    var prevTheme = root.dataset.theme;
    root.dataset.theme = 'light';                    // le PDF est toujours en thème clair, sur fond blanc
    root.classList.add('is-exporting');
    L.charts.hideTip();
    return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(resolve, 120); }); }); })
      .then(function () { return window.lamia.io.exportPdf({ filename: name }); })
      .then(function (res) {
        root.classList.remove('is-exporting');
        if (prevTheme) root.dataset.theme = prevTheme; else delete root.dataset.theme;
        L.app.applyTheme();
        savedToast('Export PDF enregistré', res, 'Récap A4, une section par catégorie.');
        return res;
      }, function (e) {
        root.classList.remove('is-exporting');
        L.app.applyTheme();
        savedToast('Export PDF', { ok: false, error: String(e && e.message || e) });
      });
  }

  /* --- Rendu ---------------------------------------------------------------- */
  function render() {
    if (!el) return;
    charts = [];
    var p = period();
    var st = S.get();
    var s = Q.summary(p);
    var isNow = D.between(D.today(), p.start, p.end);
    var after = p.end >= D.today() ? p.end : D.today();
    var soon = Q.dueBetween(D.addDays(after, 1), D.addDays(after, 14));
    var toFinish = st.tasks.filter(function (t) { return !Q.isDone(t) && t.endDate && t.endDate <= p.end && (t.endDate >= p.start || Q.isOverdue(t)); })
      .sort(function (a, b) { return a.endDate < b.endDate ? -1 : 1; });
    var days = moodDays(p);
    var active = activeTasks(p);
    var catRows = st.categories.map(function (c) {
      var n = active.filter(function (t) { return t.categoryId === c.id; }).length;
      return { label: c.name, value: n, display: U.plural(n, 'tâche'), hue: U.hue(c) };
    });
    var tagCount = {};
    active.forEach(function (t) { t.tags.forEach(function (g) { tagCount[g] = (tagCount[g] || 0) + 1; }); });
    var tagRows = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a] || a.localeCompare(b, 'fr'); }).slice(0, 7)
      .map(function (g) { return { label: '#' + g, value: tagCount[g], display: U.plural(tagCount[g], 'tâche'), hue: 'hue--accent' }; });
    charts.push({ id: 'rc-cats', kind: 'hbars', rows: catRows, aria: 'Tâches actives par catégorie' });
    if (tagRows.length) charts.push({ id: 'rc-tags', kind: 'hbars', rows: tagRows, aria: 'Tâches actives par étiquette' });
    charts.push({ id: 'rc-mood', kind: 'mood', days: days, band: [p.start, p.end], aria: 'Courbe d’humeur des 30 derniers jours' });

    var html =
      '<header class="page-head"><div class="page-head__text"><p class="eyebrow">Statistiques et exports</p>' +
        '<h1 class="h1" id="h-recap" tabindex="-1">Récap</h1></div>' +
        '<div class="page-head__actions">' +
          '<button type="button" class="btn btn--secondary" data-export="csv">' + icon('download') + 'Export CSV</button>' +
          '<button type="button" class="btn btn--secondary" data-export="pdf">' + icon('export') + 'Export PDF</button>' +
        '</div></header>' +
      '<div class="print-head"><p class="print-head__brand">Plateforme de suivi - Lamia · Récap</p><p class="print-head__period">' + esc(p.label) + '</p>' +
        '<p class="print-head__meta">Exporté le ' + esc(D.long(D.today())) + '. Heures présentées par catégorie, sans total général.</p></div>' +
      '<div class="period-bar">' +
        '<div class="segmented" role="group" aria-label="Période du récap">' +
          [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']].map(function (o) {
            return '<button type="button" class="segmented__item" data-rp="' + o[0] + '" data-focus-key="rp-' + o[0] + '" aria-pressed="' + (p.kind === o[0]) + '">' + o[1] + '</button>';
          }).join('') + '</div>' +
        '<div class="period-nav">' +
          '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-rnav="-1" data-focus-key="rn-prev" aria-label="Période précédente">' + icon('chevron-left') + '</button>' +
          '<button type="button" class="btn btn--secondary btn--sm" data-rtoday data-focus-key="rn-today"' + (isNow ? ' aria-disabled="true"' : '') + '>Aujourd’hui</button>' +
          '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-rnav="1" data-focus-key="rn-next" aria-label="Période suivante">' + icon('chevron-right') + '</button></div>' +
        '<h2 class="period-bar__label" aria-live="polite">' + esc(p.label) + '</h2>' +
      '</div>' +
      kpis(p) +
      '<section class="recap-section" aria-labelledby="rc-hours"><div class="section-intro"><h2 class="h3" id="rc-hours">Heures par catégorie</h2>' +
        '<p class="text-muted text-sm">Un graphique par catégorie : pro et perso ne sont jamais additionnés.</p></div>' +
        '<div class="hours-grid">' + st.categories.map(function (c) { return hoursCard(c, p); }).join('') + persoCard(p) + '</div></section>' +
      '<div class="recap-grid">' +
        '<section class="glass card mood-chart-card" aria-labelledby="rc-mood-t"><div class="card__header"><div><h2 class="card__title" id="rc-mood-t">Courbe d’humeur</h2>' +
          '<p class="card__subtitle">30 derniers jours · la période choisie est surlignée · un jour sans humeur reste un trou</p></div></div>' +
          '<div class="chart-host" data-chart-id="rc-mood"></div>' +
          '<details class="data-twin"><summary>Voir les données</summary><table class="mini-table"><thead><tr><th scope="col">Jour</th><th scope="col">Humeur</th><th scope="col">Note</th></tr></thead><tbody>' +
            days.slice().reverse().map(function (d) { return '<tr><th scope="row">' + esc(D.cap(D.short(d.date))) + '</th><td>' + (d.level ? esc(U.moodLabel(d.level)) + ' (' + d.level + '/5)' : '—') + '</td><td>' + esc(d.note || '') + '</td></tr>'; }).join('') +
          '</tbody></table></details></section>' +
        '<section class="glass glass--tint-violet card insight-card" aria-labelledby="rc-ins"><div class="card__header"><div><h2 class="card__title" id="rc-ins">Humeur et heures</h2>' +
          '<p class="card__subtitle">Sur les 30 derniers jours ouvrés</p></div></div>' + moodInsight(days) + '</section>' +
        '<section class="glass card" aria-labelledby="rc-todo"><div class="card__header"><div><h2 class="card__title" id="rc-todo">À terminer</h2><p class="card__subtitle">Échéances de la période, et celles à replanifier</p></div>' +
          '<span class="badge badge--neutral">' + toFinish.length + '</span></div>' + taskList(toFinish, 'Rien à boucler sur cette période. Savoure.', 'finish') + '</section>' +
        '<section class="glass card" aria-labelledby="rc-soon"><div class="card__header"><div><h2 class="card__title" id="rc-soon">Arrivent bientôt</h2><p class="card__subtitle">Les 14 jours qui suivent</p></div>' +
          '<span class="badge badge--neutral">' + soon.length + '</span></div>' + taskList(soon, 'Rien à l’horizon pour l’instant.', 'soon') + '</section>' +
        '<section class="glass card" aria-labelledby="rc-cat"><div class="card__header"><div><h2 class="card__title" id="rc-cat">Tâches actives par catégorie</h2><p class="card__subtitle">Travaillées, créées ou à échéance sur la période</p></div></div>' +
          '<div class="chart-host" data-chart-id="rc-cats"></div></section>' +
        '<section class="glass card" aria-labelledby="rc-tag"><div class="card__header"><div><h2 class="card__title" id="rc-tag">Par étiquette</h2><p class="card__subtitle">Les 7 étiquettes les plus présentes</p></div></div>' +
          (tagRows.length ? '<div class="chart-host" data-chart-id="rc-tags"></div>' : '<p class="empty-line">Aucune étiquette sur la période.</p>') + '</section>' +
      '</div>';
    U.keepFocus(el, function () { el.innerHTML = html; });
    drawCharts();
    U.typo(el);
    void s;
  }

  function drawCharts() {
    charts.forEach(function (c) {
      var host = el.querySelector('[data-chart-id="' + c.id + '"]');
      if (!host) return;
      if (c.kind === 'bars') C.bars(host, { data: c.data, hue: c.hue, ariaLabel: 'Heures ' + c.name + ' : ' + c.data.map(function (d) { return d.title; }).join(' ; ') });
      else if (c.kind === 'hbars') C.hbars(host, { rows: c.rows, ariaLabel: c.aria, unit: 'actives' });
      else if (c.kind === 'mood') C.moodLine(host, { days: c.days, band: c.band, ariaLabel: c.aria + '. Flèches gauche et droite pour parcourir les jours.' });
    });
  }

  function mount(node) {
    el = node;
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-rp]'))) { S.setUI({ recapPeriod: b.getAttribute('data-rp') }); return; }
      if ((b = e.target.closest('[data-rnav]'))) {
        var p = period();
        S.setUI({ recapAnchor: D.shift(p.kind, p.anchor, +b.getAttribute('data-rnav')) });
        return;
      }
      if (e.target.closest('[data-rtoday]')) { S.setUI({ recapAnchor: D.today() }); return; }
      if ((b = e.target.closest('[data-more]'))) { var k = b.getAttribute('data-more'); expanded[k] = !expanded[k]; render(); return; }
      if ((b = e.target.closest('[data-export]'))) { if (b.getAttribute('data-export') === 'csv') exportCSV(); else exportPDF(); }
    });
    S.subscribe(function (type, d) {
      if (L.app.view() !== 'recap') { el.dataset.stale = '1'; return; }
      if (type === 'ui' && !('recapPeriod' in d || 'recapAnchor' in d)) return;
      if (type === 'timer' && d.action !== 'stop') return;
      render();
    });
    var w = window.innerWidth;
    window.addEventListener('resize', U.debounce(function () {
      if (L.app.view() === 'recap' && window.innerWidth !== w) { w = window.innerWidth; drawCharts(); }
    }, 150));
  }

  function show() { if (!el.firstChild || el.dataset.stale) { delete el.dataset.stale; render(); } else drawCharts(); }

  L.views = L.views || {};
  L.views.recap = { mount: mount, render: render, show: show, csv: csv, exportCSV: exportCSV, exportPDF: exportPDF, title: 'Récap' };
})(window.Lamia = window.Lamia || {});
