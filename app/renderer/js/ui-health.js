/* ==========================================================================
   Plateforme de suivi - Lamia — espace « Santé »
   Quatre vues : tableau de bord santé, poids & mensurations, alimentation,
   sport. Données dans state.health (facultatif, cf. shared/model.js).
   Ton : bienveillant, jamais culpabilisant (une hausse est « +0,4 kg »,
   pas une alerte).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon, NB = U.NB;

  var MEAS = [
    { k: 'fesses', label: 'Fesses' },
    { k: 'jambes', label: 'Jambes' },
    { k: 'bras', label: 'Bras' },
    { k: 'ventre', label: 'Ventre' }
  ];
  var SLOTS = [
    { k: 'matin', label: 'Matin', icon: 'coffee' },
    { k: 'midi', label: 'Midi', icon: 'sun' },
    { k: 'soir', label: 'Soir', icon: 'moon' },
    { k: 'collation', label: 'Collation', icon: 'sparkle' }
  ];
  var UNITS = ['g', 'kg', 'ml', 'cl', 'L', 'pièce(s)', 'portion(s)', 'tranche(s)', 'c. à soupe', 'c. à café', 'verre(s)', 'bol(s)'];
  var SPORTS = ['Marche', 'Course à pied', 'Vélo', 'Natation', 'Yoga', 'Pilates', 'Musculation', 'Danse', 'Fitness', 'Randonnée', 'Corde à sauter', 'Étirements'];

  /* --- Outils ---------------------------------------------------------------- */
  function H() { return S.health(); }
  function last(a) { return a.length ? a[a.length - 1] : null; }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; }
  function fmt(v, dec) { return Number(v).toFixed(dec == null ? 1 : dec).replace('.', ',').replace(/,0$/, dec === 0 ? '' : ',0'); }
  function kg(v) { return fmt(v) + NB + 'kg'; }
  function cm(v) { return fmt(v) + NB + 'cm'; }
  function signed(v, unit) { return Math.abs(v) < 0.05 ? 'stable' : (v < 0 ? '−' : '+') + NB + fmt(Math.abs(v)) + NB + unit; }
  function minutes(m) { return D.duration(m, { compact: true }); }
  function sportMinutes(text) {
    var s = String(text || '').trim();
    if (/^\d+$/.test(s)) { var n = +s; return n > 0 && n <= 1440 ? n : null; }   // un nombre seul = des minutes
    return D.parseDuration(s);
  }
  function field(id, label, input, hint) {
    return '<div class="field"><label class="label" for="' + id + '">' + label + '</label>' + input + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  }
  function dateInput(id, value) {
    return '<input class="input" type="date" id="' + id + '" data-focus-key="' + id + '" name="date" value="' + (value || D.today()) + '" max="' + D.today() + '" required>';
  }
  function numInput(id, name, placeholder, required) {
    return '<input class="input" type="text" inputmode="decimal" autocomplete="off" id="' + id + '" data-focus-key="' + id + '" name="' + name + '" placeholder="' + placeholder + '"' + (required ? ' required' : '') + '>';
  }
  function head(eyebrow, title, id, lead, actions) {
    return '<header class="page-head"><div class="page-head__text"><p class="eyebrow">' + eyebrow + '</p>' +
      '<h1 class="h1" id="' + id + '" tabindex="-1">' + title + '</h1>' + (lead ? '<p class="page-head__lead">' + lead + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-head__actions">' + actions + '</div>' : '') + '</header>';
  }
  function card(id, title, subtitle, body, cls) {
    return '<section class="glass card ' + (cls || '') + '" aria-labelledby="' + id + '"><div class="card__header"><div><h2 class="card__title" id="' + id + '">' + title + '</h2>' +
      (subtitle ? '<p class="card__subtitle">' + subtitle + '</p>' : '') + '</div></div>' + body + '</section>';
  }
  function tile(ic, label, value, extra) {
    return '<article class="glass stat"><div class="stat__head"><span class="stat__icon">' + icon(ic) + '</span><span class="stat__label">' + esc(label) + '</span></div>' +
      '<div class="stat__value">' + value + '</div>' + (extra ? '<span class="stat__delta">' + extra + '</span>' : '') + '</article>';
  }
  function delBtn(kind, id, label) {
    return '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-h-del="' + kind + '" data-id="' + id + '" aria-label="Supprimer ' + esc(label) + '">' + icon('trash') + '</button>';
  }
  function editBtn(kind, id, label) {
    return '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-h-edit="' + kind + '" data-id="' + id + '" aria-label="Modifier ' + esc(label) + '">' + icon('edit') + '</button>';
  }
  function empty(text) { return '<p class="hint health-empty">' + text + '</p>'; }

  function weekMinutes(start) {
    var end = D.addDays(start, 6), total = 0, count = 0;
    H().sports.forEach(function (x) { if (x.date >= start && x.date <= end) { total += x.minutes; count++; } });
    return { minutes: total, count: count };
  }
  function weeksData(n) {
    var cur = D.startOfWeek(D.today()), out = [];
    for (var i = n - 1; i >= 0; i--) {
      var s = D.addDays(cur, -7 * i), w = weekMinutes(s);
      out.push({ key: s, label: 'S' + D.isoWeek(s), value: w.minutes, current: i === 0, tipTitle: 'Semaine du ' + D.dayMonth(s), title: 'Semaine ' + D.isoWeek(s) + ' : ' + minutes(w.minutes) });
    }
    return out;
  }
  function weightPoints() { return H().weights.map(function (w) { return { date: w.date, value: w.kg, note: w.note }; }); }
  // Mensurations notées en « centimètres perdus » : courbe du total perdu, entrée après entrée
  function lossEntries() { return H().measures.filter(function (m) { return m.loss; }); }
  function measurePoints(k) {
    var total = 0, out = [];
    lossEntries().forEach(function (m) { if (typeof m[k] === 'number') { total += m[k]; out.push({ date: m.date, value: Math.round(total * 10) / 10 }); } });
    return out;
  }
  function totalLost(k) { var pts = measurePoints(k); return pts.length ? last(pts).value : null; }
  function lost(v) { return Math.abs(v) < 0.05 ? '0' + NB + 'cm' : '−' + NB + cm(v); }

  function cheer() {
    var w = H().weights;
    if (w.length < 2) return 'Une première pesée, et la courbe se dessine. On avance à ton rythme.';
    var d = last(w).kg - w[0].kg;
    if (d <= -0.05) return 'Déjà ' + signed(d, 'kg') + ' depuis le début. Chaque petit pas compte, bravo.';
    return 'Le poids bouge, c’est normal. La régularité compte plus que les chiffres d’un jour.';
  }

  /* --- Fabrique de vue ------------------------------------------------------------ */
  function makeView(name, title, render, bind) {
    var el = null;
    function draw() { if (el) U.keepFocus(el, function () { render(el); }); }
    return {
      title: title,
      mount: function (node) {
        el = node;
        bind(el, draw);
        S.subscribe(function (type) {
          if (type !== 'health' && type !== 'reset' && type !== 'settings') return;
          if (L.app.view() !== name) { el.dataset.stale = '1'; return; }
          draw();
        });
      },
      render: draw,
      show: function () { if (!el.firstChild || el.dataset.stale) { delete el.dataset.stale; draw(); } }
    };
  }

  // Suppression avec « Annuler »
  function removeWithUndo(kind, id, label) {
    var item = H()[kind].filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    S.removeHealth(kind, id);
    U.toast({ icon: 'trash', title: label + ' supprimé', duration: 6000, actions: [{ label: 'Annuler', fn: function () { var copy = Object.assign({}, item); delete copy.id; S.addHealth(kind, copy); } }] });
  }
  function warn(title, text) { U.toast({ kind: 'warning', icon: 'alert', title: title, text: text || '', duration: 4500 }); }

  /* === 1. Tableau de bord santé =================================================== */
  function renderDash(el) {
    var h = H(), w = last(h.weights), first = h.weights[0];
    var today = D.today(), wk = weekMinutes(D.startOfWeek(today));
    var mealsToday = SLOTS.filter(function (s) { return h.meals.some(function (m) { return m.date === today && m.slot === s.k; }); }).length;
    var goal = h.goalKg;
    var tiles =
      tile('heart', 'Poids actuel', w ? esc(fmt(w.kg)) + '<span class="stat__unit">kg</span>' : '—', w && first && h.weights.length > 1 ? esc(signed(w.kg - first.kg, 'kg')) + ' depuis le début' : (w ? 'Pesée du ' + esc(D.dayMonth(w.date)) : 'Aucune pesée')) +
      tile('target', 'Objectif', goal ? esc(fmt(goal)) + '<span class="stat__unit">kg</span>' : '—', goal && w ? (w.kg <= goal ? 'Objectif atteint, bravo !' : 'Encore ' + esc(kg(w.kg - goal))) : 'À définir') +
      tile('timer', 'Sport cette semaine', esc(minutes(wk.minutes)), U.plural(wk.count, 'séance')) +
      tile('coffee', 'Repas notés aujourd’hui', mealsToday + '<span class="stat__unit">/ 3</span>', mealsToday >= 3 ? 'Journée bien notée' : 'Matin, midi, soir');

    var measures = lossEntries().length ? '<ul class="measure-list" role="list">' + MEAS.map(function (m) {
      var t = totalLost(m.k);
      return '<li><span>' + m.label + '</span><strong>' + (t == null ? '<span class="text-subtle">—</span>' : esc(lost(t))) + '</strong><span class="text-subtle"></span></li>';
    }).join('') + '</ul>' : empty('Pas encore de centimètres perdus notés.');

    var meals = '<ul class="meal-summary" role="list">' + SLOTS.map(function (s) {
      var items = h.meals.filter(function (m) { return m.date === today && m.slot === s.k; });
      return '<li><span class="meal-summary__slot">' + icon(s.icon) + s.label + '</span><span class="meal-summary__items">' +
        (items.length ? esc(items.map(function (m) { return m.name; }).join(', ')) : '<span class="text-subtle">Rien de noté</span>') + '</span></li>';
    }).join('') + '</ul>';

    el.innerHTML =
      head('Prendre soin de toi, à ton rythme', 'Santé', 'h-health', esc(cheer()),
        '<a class="btn btn--secondary btn--sm" href="#corps">' + icon('plus') + 'Pesée</a>' +
        '<a class="btn btn--secondary btn--sm" href="#alimentation">' + icon('plus') + 'Repas</a>' +
        '<a class="btn btn--primary btn--sm" href="#sport">' + icon('plus') + 'Séance</a>') +
      '<div class="kpi-row kpi-row--4">' + tiles + '</div>' +
      '<div class="health-grid">' +
        card('hd-weight', 'Courbe de poids', h.weights.length ? U.plural(h.weights.length, 'pesée') : 'Ta progression, pesée après pesée', '<div class="chart-host" data-chart="weight"></div>', 'health-grid__wide') +
        card('hd-meas', 'Mensurations', 'Centimètres perdus depuis le début', measures + '<a class="btn btn--ghost btn--sm" href="#corps">Voir les courbes' + icon('chevron-right') + '</a>') +
        card('hd-meals', 'Repas du jour', esc(D.cap(D.dayMonthLong(today))), meals + '<a class="btn btn--ghost btn--sm" href="#alimentation">Mon plan alimentaire' + icon('chevron-right') + '</a>') +
        card('hd-sport', 'Sport', '8 dernières semaines', '<div class="chart-host" data-chart="sport"></div>') +
      '</div>';
    L.charts.valueLine(el.querySelector('[data-chart="weight"]'), { points: weightPoints(), unit: 'kg', goal: h.goalKg, uid: 'hdw', hue: 'hue--violet', ariaLabel: 'Courbe de poids' });
    L.charts.bars(el.querySelector('[data-chart="sport"]'), { data: weeksData(8), hue: 'hue--blue', height: 180, ariaLabel: 'Minutes de sport par semaine' });
  }

  /* === 2. Poids & mensurations ==================================================== */
  function renderBody(el) {
    var h = H();
    var weightForm =
      '<form class="health-form" data-h-form="weight" novalidate>' +
        field('w-date', 'Date', dateInput('w-date')) +
        field('w-kg', 'Poids (kg)', numInput('w-kg', 'kg', 'ex. 64,5', true)) +
        field('w-note', 'Note <span class="text-subtle">facultatif</span>', '<input class="input" type="text" id="w-note" name="note" maxlength="120" placeholder="Après le sport…">') +
        '<button type="submit" class="btn btn--primary" data-focus-key="w-submit">' + icon('plus') + 'Ajouter</button>' +
      '</form>' +
      '<form class="health-form health-form--goal" data-h-form="goal" novalidate>' +
        field('w-goal', 'Objectif (kg)', '<input class="input" type="text" inputmode="decimal" id="w-goal" name="goal" value="' + (h.goalKg ? fmt(h.goalKg) : '') + '" placeholder="ex. 60">') +
        '<button type="submit" class="btn btn--secondary" data-focus-key="g-submit">Enregistrer l’objectif</button>' +
      '</form>';
    var wHist = h.weights.length ? '<ul class="health-list" role="list">' + h.weights.slice().reverse().map(function (w, i, arr) {
      var prev = arr[i + 1];
      return '<li><span class="health-list__date">' + esc(D.cap(D.dayMonthLong(w.date))) + '</span><strong>' + esc(kg(w.kg)) + '</strong>' +
        '<span class="text-subtle">' + (prev ? esc(signed(w.kg - prev.kg, 'kg')) : 'première pesée') + (w.note ? ' · ' + esc(w.note) : '') + '</span>' + '<span class="health-list__actions">' + editBtn('weights', w.id, 'la pesée du ' + D.dayMonth(w.date)) + delBtn('weights', w.id, 'la pesée du ' + D.dayMonth(w.date)) + '</span></li>';
    }).join('') + '</ul>' : empty('Ajoute ton poids de départ (même une ancienne pesée, avec sa date), puis les suivants : la courbe se dessine toute seule.');

    var mForm = '<form class="health-form" data-h-form="measure" novalidate>' + field('m-date', 'Date', dateInput('m-date')) +
      MEAS.map(function (m) { return field('m-' + m.k, m.label + ' (cm perdus)', numInput('m-' + m.k, m.k, 'ex. 1,5')); }).join('') +
      '<button type="submit" class="btn btn--primary" data-focus-key="m-submit">' + icon('plus') + 'Ajouter</button></form>';
    var minis = '<div class="measure-grid">' + MEAS.map(function (m) {
      var t = totalLost(m.k);
      return '<div class="glass glass--nested measure-card"><div class="measure-card__head"><span>' + m.label + '</span><strong>' + (t == null ? '—' : esc(lost(t))) + '</strong>' +
        '<span class="text-subtle">au total</span></div><div class="chart-host" data-chart="m-' + m.k + '"></div></div>';
    }).join('') + '</div>';
    var mHist = h.measures.length ? '<div class="table-wrap"><table class="health-table"><thead><tr><th scope="col">Date</th>' + MEAS.map(function (m) { return '<th scope="col">' + m.label + '</th>'; }).join('') + '<th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      h.measures.slice().reverse().map(function (r) {
        return '<tr><th scope="row">' + esc(D.dayMonth(r.date)) + ' ' + r.date.slice(0, 4) + (r.loss ? '' : '<br><span class="text-subtle">valeur mesurée</span>') + '</th>' +
          MEAS.map(function (m) { return '<td>' + (typeof r[m.k] === 'number' ? esc((r.loss ? '−' + NB : '') + fmt(r[m.k])) : '—') + '</td>'; }).join('') +
          '<td class="health-table__actions">' + editBtn('measures', r.id, 'les mensurations du ' + D.dayMonth(r.date)) + delBtn('measures', r.id, 'les mensurations du ' + D.dayMonth(r.date)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : empty('Note les centimètres perdus (sur une ou plusieurs zones) à chaque fois que tu mesures : le total se calcule tout seul.');

    el.innerHTML =
      head('Santé', 'Poids & mensurations', 'h-body', 'Une ancienne valeur ? Choisis simplement sa date : elle se range au bon endroit sur la courbe. Chaque ligne peut être modifiée avec le crayon.') +
      card('b-weight', 'Poids', h.goalKg ? 'Objectif : ' + esc(kg(h.goalKg)) : 'Pesée après pesée', weightForm + '<div class="chart-host chart-host--tall" data-chart="weight"></div>' + wHist) +
      card('b-meas', 'Mensurations', 'Centimètres perdus : fesses, jambes, bras et ventre', mForm + minis + mHist);
    L.charts.valueLine(el.querySelector('[data-chart="weight"]'), { points: weightPoints(), unit: 'kg', goal: h.goalKg, uid: 'bw', hue: 'hue--violet', height: 230, ariaLabel: 'Courbe de poids' });
    MEAS.forEach(function (m) {
      L.charts.valueLine(el.querySelector('[data-chart="m-' + m.k + '"]'), { points: measurePoints(m.k), unit: 'cm perdus', uid: 'm' + m.k, hue: 'hue--blue', height: 150, ariaLabel: 'Centimètres perdus, ' + m.label });
    });
  }

  function bindBody(el) {
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-h-form]');
      if (!f) return;
      e.preventDefault();
      var kind = f.getAttribute('data-h-form'), fd = new FormData(f);
      if (kind === 'weight') {
        var v = num(fd.get('kg'));
        if (!(v >= 20 && v <= 400)) { warn('Poids à vérifier', 'Indique un poids en kilos, par exemple 64,5.'); f.querySelector('[name=kg]').focus(); return; }
        S.addHealth('weights', { date: fd.get('date') || D.today(), kg: Math.round(v * 10) / 10, note: String(fd.get('note') || '').trim() });
        U.announce('Pesée ajoutée');
      } else if (kind === 'goal') {
        var g = num(fd.get('goal'));
        if (String(fd.get('goal') || '').trim() && !(g >= 20 && g <= 400)) { warn('Objectif à vérifier', 'Indique un poids en kilos.'); return; }
        S.setHealthGoal(isNaN(g) ? null : Math.round(g * 10) / 10);
        U.toast({ icon: 'target', title: isNaN(g) ? 'Objectif retiré' : 'Objectif : ' + kg(g), duration: 3000 });
      } else if (kind === 'measure') {
        var row = readMeasures(fd);
        if (row.bad) { warn('Valeur à vérifier', 'Indique les centimètres perdus, par exemple 1,5.'); return; }
        if (!row.any) { warn('Rien à enregistrer', 'Remplis au moins une zone.'); return; }
        row = row.row;
        S.addHealth('measures', row);
        U.announce('Mensurations ajoutées');
      }
    });
    bindDelete(el);
  }

  function readMeasures(fd) {
    var row = { date: fd.get('date') || D.today(), loss: true }, any = false, bad = false;
    MEAS.forEach(function (m) {
      var raw = String(fd.get(m.k) || '').trim();
      if (!raw) return;
      var x = Math.abs(num(raw));
      if (!(x >= 0 && x < 100)) bad = true; else { row[m.k] = Math.round(x * 10) / 10; any = true; }
    });
    return { row: row, any: any, bad: bad };
  }

  // Modifier une pesée ou des mensurations
  function editEntry(kind, id, btn) {
    var it = H()[kind].filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var body;
    if (kind === 'weights') {
      body = '<div class="health-form">' + field('e-date', 'Date', dateInput('e-date', it.date)) +
        field('e-kg', 'Poids (kg)', '<input class="input" id="e-kg" name="kg" inputmode="decimal" value="' + fmt(it.kg) + '">') +
        field('e-note', 'Note', '<input class="input" id="e-note" name="note" maxlength="120" value="' + esc(it.note || '') + '">') + '</div>';
    } else {
      body = (it.loss ? '' : '<p class="hint">Cette ligne contient des valeurs mesurées. En l’enregistrant, elle passera en « centimètres perdus ».</p>') +
        '<div class="health-form">' + field('e-date', 'Date', dateInput('e-date', it.date)) +
        MEAS.map(function (m) { return field('e-' + m.k, m.label + ' (cm perdus)', '<input class="input" id="e-' + m.k + '" name="' + m.k + '" inputmode="decimal" value="' + (it.loss && typeof it[m.k] === 'number' ? fmt(it[m.k]) : '') + '">'); }).join('') + '</div>';
    }
    U.dialog({
      title: kind === 'weights' ? 'Modifier la pesée' : 'Modifier les mensurations', body: body, confirmLabel: 'Enregistrer', returnTo: btn, fallbackFocus: function () { return document.getElementById('h-body'); },
      onConfirm: function (form) {
        var fd = new FormData(form);
        if (kind === 'weights') {
          var v = num(fd.get('kg'));
          if (!(v >= 20 && v <= 400)) { warn('Poids à vérifier', 'Indique un poids en kilos, par exemple 64,5.'); return false; }
          S.updateHealth('weights', id, { date: fd.get('date') || it.date, kg: Math.round(v * 10) / 10, note: String(fd.get('note') || '').trim() });
        } else {
          var r = readMeasures(fd);
          if (r.bad) { warn('Valeur à vérifier', 'Indique les centimètres perdus, par exemple 1,5.'); return false; }
          if (!r.any) { warn('Rien à enregistrer', 'Remplis au moins une zone, ou supprime la ligne.'); return false; }
          var patch = { date: r.row.date, loss: true };
          MEAS.forEach(function (m) { patch[m.k] = r.row[m.k]; });
          S.updateHealth('measures', id, patch);
        }
        U.toast({ icon: 'check', title: 'Modification enregistrée', duration: 2500 });
      }
    });
  }

  function bindDelete(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-h-edit]');
      if (b) editEntry(b.getAttribute('data-h-edit'), b.getAttribute('data-id'), b);
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-h-del]');
      if (!b) return;
      var kind = b.getAttribute('data-h-del');
      removeWithUndo(kind, b.getAttribute('data-id'), { weights: 'Pesée', measures: 'Mensuration', meals: 'Aliment', sports: 'Séance' }[kind] || 'Élément');
    });
  }

  /* === 3. Alimentation =============================================================== */
  var foodDate = null;
  function renderFood(el) {
    var h = H(), day = foodDate || D.today(), isToday = day === D.today();
    var prev = D.addDays(day, -1);
    var prevCount = h.meals.filter(function (m) { return m.date === prev; }).length;
    var dayCount = h.meals.filter(function (m) { return m.date === day; }).length;
    var unitOpts = UNITS.map(function (u) { return '<option value="' + esc(u) + '">' + esc(u) + '</option>'; }).join('');
    var slots = SLOTS.map(function (s) {
      var items = h.meals.filter(function (m) { return m.date === day && m.slot === s.k; });
      var list = items.length ? '<ul class="health-list health-list--meal" role="list">' + items.map(function (m) {
        return '<li><strong>' + esc(m.name) + '</strong><span class="text-subtle">' + (m.qty ? esc(fmt(m.qty, m.qty % 1 ? 1 : 0)) + NB + esc(m.unit || '') : '') + '</span>' + delBtn('meals', m.id, m.name) + '</li>';
      }).join('') + '</ul>' : empty('Rien de noté pour l’instant.');
      return '<section class="glass card meal-card" aria-labelledby="f-' + s.k + '"><div class="card__header"><div><h2 class="card__title" id="f-' + s.k + '">' + icon(s.icon) + s.label + '</h2></div></div>' + list +
        '<form class="meal-form" data-h-form="meal" data-slot="' + s.k + '" novalidate>' +
          '<label class="sr-only" for="fn-' + s.k + '">Aliment (' + s.label + ')</label><input class="input" id="fn-' + s.k + '" name="name" placeholder="Aliment" maxlength="80" data-focus-key="fn-' + s.k + '">' +
          '<label class="sr-only" for="fq-' + s.k + '">Quantité</label><input class="input meal-form__qty" id="fq-' + s.k + '" name="qty" inputmode="decimal" placeholder="Qté">' +
          '<label class="sr-only" for="fu-' + s.k + '">Unité</label><select class="select meal-form__unit" id="fu-' + s.k + '" name="unit">' + unitOpts + '</select>' +
          '<button type="submit" class="btn btn--secondary btn--icon" data-focus-key="fb-' + s.k + '" aria-label="Ajouter au repas ' + s.label.toLowerCase() + '">' + icon('plus') + '</button>' +
        '</form></section>';
    }).join('');
    el.innerHTML =
      head('Santé', 'Alimentation', 'h-food', 'Ton plan alimentaire, repas par repas, avec les quantités.') +
      '<div class="period-bar"><div class="period-nav">' +
        '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-food-nav="-1" data-focus-key="fd-prev" aria-label="Jour précédent">' + icon('chevron-left') + '</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-food-today data-focus-key="fd-today"' + (isToday ? ' aria-disabled="true"' : '') + '>Aujourd’hui</button>' +
        '<button type="button" class="btn btn--secondary btn--icon btn--sm" data-food-nav="1" data-focus-key="fd-next" aria-label="Jour suivant">' + icon('chevron-right') + '</button>' +
      '</div><h2 class="period-bar__label" aria-live="polite">' + esc(D.cap(D.long(day))) + '</h2>' +
      (!dayCount && prevCount ? '<button type="button" class="btn btn--ghost btn--sm" data-food-copy>' + icon('copy') + 'Reprendre les repas de la veille (' + prevCount + ')</button>' : '') +
      '</div>' +
      '<div class="meal-grid">' + slots + '</div>';
  }
  function bindFood(el) {
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-h-form="meal"]');
      if (!f) return;
      e.preventDefault();
      var fd = new FormData(f), name = String(fd.get('name') || '').trim(), rawQ = String(fd.get('qty') || '').trim(), q = num(rawQ);
      if (!name) { warn('Aliment manquant', 'Écris ce que tu as mangé ou prévu.'); f.querySelector('[name=name]').focus(); return; }
      if (rawQ && !(q > 0)) { warn('Quantité à vérifier', 'Par exemple 150 (g) ou 1,5 (kg).'); return; }
      S.addHealth('meals', { date: foodDate || D.today(), slot: f.getAttribute('data-slot'), name: name, qty: rawQ ? q : null, unit: rawQ ? fd.get('unit') : '' });
      U.announce(name + ' ajouté');
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-food-nav]'))) { foodDate = D.addDays(foodDate || D.today(), +b.getAttribute('data-food-nav')); L.views.food.render(); return; }
      if (e.target.closest('[data-food-today]')) { foodDate = null; L.views.food.render(); return; }
      if (e.target.closest('[data-food-copy]')) {
        var day = foodDate || D.today(), n = S.copyMeals(D.addDays(day, -1), day);
        U.toast({ icon: 'copy', title: U.plural(n, 'aliment') + ' repris de la veille', duration: 3500 });
      }
    });
    bindDelete(el);
  }

  /* === 4. Sport ======================================================================== */
  function renderSport(el) {
    var h = H(), today = D.today();
    var wk = weekMinutes(D.startOfWeek(today));
    var mStart = D.startOfMonth(today), month = { minutes: 0, count: 0 };
    h.sports.forEach(function (x) { if (x.date >= mStart && x.date <= today) { month.minutes += x.minutes; month.count++; } });
    var opts = SPORTS.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('');
    var form = '<form class="health-form" data-h-form="sport" novalidate>' +
      field('s-date', 'Date', dateInput('s-date')) +
      field('s-act', 'Activité', '<input class="input" id="s-act" name="activity" list="s-acts" maxlength="60" placeholder="ex. Marche" required><datalist id="s-acts">' + opts + '</datalist>') +
      field('s-min', 'Durée', '<input class="input" id="s-min" name="minutes" inputmode="numeric" placeholder="45 ou 1h30" required>', 'En minutes, ou 1h30') +
      field('s-note', 'Note <span class="text-subtle">facultatif</span>', '<input class="input" id="s-note" name="note" maxlength="120" placeholder="Tranquille, intense…">') +
      '<button type="submit" class="btn btn--primary" data-focus-key="s-submit">' + icon('plus') + 'Ajouter</button></form>';
    var hist = h.sports.length ? '<ul class="health-list" role="list">' + h.sports.slice().reverse().slice(0, 40).map(function (x) {
      return '<li><span class="health-list__date">' + esc(D.cap(D.dayMonthLong(x.date))) + '</span><strong>' + esc(x.activity) + '</strong><span class="text-subtle">' + esc(minutes(x.minutes)) + (x.note ? ' · ' + esc(x.note) : '') + '</span>' + delBtn('sports', x.id, x.activity + ' du ' + D.dayMonth(x.date)) + '</li>';
    }).join('') + '</ul>' : empty('Note ta première séance : marche, yoga, danse… tout compte.');
    el.innerHTML =
      head('Santé', 'Sport', 'h-sport', 'Chaque mouvement compte, même dix minutes.') +
      '<div class="kpi-row kpi-row--2">' +
        tile('timer', 'Cette semaine', esc(minutes(wk.minutes)), U.plural(wk.count, 'séance')) +
        tile('calendar', 'Ce mois-ci', esc(minutes(month.minutes)), U.plural(month.count, 'séance')) +
      '</div>' +
      card('sp-add', 'Ajouter une séance', '', form) +
      card('sp-weeks', 'Minutes par semaine', '8 dernières semaines', '<div class="chart-host" data-chart="sport"></div>') +
      card('sp-hist', 'Historique', h.sports.length ? U.plural(h.sports.length, 'séance') : '', hist);
    L.charts.bars(el.querySelector('[data-chart="sport"]'), { data: weeksData(8), hue: 'hue--blue', height: 200, ariaLabel: 'Minutes de sport par semaine' });
  }
  function bindSport(el) {
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-h-form="sport"]');
      if (!f) return;
      e.preventDefault();
      var fd = new FormData(f), act = String(fd.get('activity') || '').trim(), m = sportMinutes(fd.get('minutes'));
      if (!act) { warn('Activité manquante', 'Par exemple : Marche, Yoga, Natation…'); f.querySelector('[name=activity]').focus(); return; }
      if (!m) { warn('Durée à vérifier', 'En minutes (45) ou en heures (1h30).'); f.querySelector('[name=minutes]').focus(); return; }
      S.addHealth('sports', { date: fd.get('date') || D.today(), activity: act, minutes: m, note: String(fd.get('note') || '').trim() });
      U.toast({ icon: 'sparkle', title: act + ' : ' + minutes(m), text: 'Bien joué !', duration: 3000 });
    });
    bindDelete(el);
  }

  L.views = L.views || {};
  L.views.health = makeView('health', 'Santé', renderDash, function () {});
  L.views.body = makeView('body', 'Poids & mensurations', renderBody, bindBody);
  L.views.food = makeView('food', 'Alimentation', renderFood, bindFood);
  L.views.sport = makeView('sport', 'Sport', renderSport, bindSport);
})(window.Lamia = window.Lamia || {});
