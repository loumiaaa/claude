/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · dates, durées, horloge
   Module UMD : chargé par le renderer en <script> classique (expose
   window.LamiaShared.dates) et par le main / les tests via require().

   Horloge centrale : today(), now() et nowMs() lisent la vraie date du jour.
   setNow(valeur) la décale (tests unitaires, e2e avec LAMIA_FAKE_NOW) tout en
   laissant le temps s'écouler (le chrono continue de tourner).

   Convention (cf. docs/04-architecture-technique.md) : les dates calendaires
   sont des chaînes 'YYYY-MM-DD' LOCALES. Jamais new Date('2026-10-08').
   ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.dates = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NBSP = ' ';
  var DAY_MS = 86400000;

  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var DAYS_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  /* --- Horloge ------------------------------------------------------------- */
  var offsetMs = 0;

  function nowMs() { return Date.now() + offsetMs; }
  function now() { return new Date(nowMs()); }

  // valeur : instant (ms), Date, 'YYYY-MM-DD' (10 h locale) ou 'YYYY-MM-DDTHH:mm[:ss]' (heure locale).
  // null ou '' : retour à la vraie horloge. Renvoie true si la valeur est comprise.
  function setNow(value) {
    if (value == null || value === '') { offsetMs = 0; return true; }
    var t;
    if (typeof value === 'number') t = value;
    else if (value instanceof Date) t = value.getTime();
    else if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) { var d = parse(value); d.setHours(10, 0, 0, 0); t = d.getTime(); }
    else t = new Date(String(value)).getTime();
    if (isNaN(t)) return false;
    offsetMs = t - Date.now();
    return true;
  }

  function isClockShifted() { return offsetMs !== 0; }

  /* --- Dates calendaires ---------------------------------------------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;   // 2026-02-31
    return d;
  }

  function valid(s) { return !!parse(s); }

  function today() { return iso(now()); }

  // Date locale 'YYYY-MM-DD' d'un instant (ms)
  function dateOf(ms) { return iso(new Date(ms)); }

  function addDays(s, n) {
    var d = parse(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  function addMonths(s, n) {
    var d = parse(s);
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return iso(d);
  }

  // Nombre de jours de a vers b (b - a), insensible aux changements d'heure
  function diff(a, b) {
    var da = parse(a), db = parse(b);
    return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
      Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / DAY_MS);
  }

  function dow(s) { return parse(s).getDay(); }                 // 0 = dimanche
  function dowMon(s) { return (dow(s) + 6) % 7; }               // 0 = lundi
  function startOfWeek(s) { return addDays(s, -dowMon(s)); }
  function endOfWeek(s) { return addDays(startOfWeek(s), 6); }
  function startOfMonth(s) { var d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); }
  function endOfMonth(s) { var d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  function isWeekend(s) { var w = dow(s); return w === 0 || w === 6; }
  function between(s, a, b) { return s >= a && s <= b; }
  function min(a, b) { return a < b ? a : b; }
  function max(a, b) { return a > b ? a : b; }

  // Semaine ISO 8601 : { year, week } (le jeudi décide de l'année)
  function isoWeekInfo(s) {
    var d = parse(s);
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / DAY_MS + 1) / 7) };
  }
  function isoWeek(s) { return isoWeekInfo(s).week; }
  // « 2026-S41 » (nom de fichier d'export, sauvegardes)
  function weekKey(s) { var w = isoWeekInfo(s); return w.year + '-S' + pad(w.week); }

  function eachDay(a, b) {
    var out = [];
    for (var s = a; s <= b; s = addDays(s, 1)) out.push(s);
    return out;
  }

  // Découpe un intervalle [startMs, endMs[ par jour local : [{ date, ms }]
  // (juste aux changements d'heure : on coupe aux vrais minuits locaux).
  function splitByDay(startMs, endMs) {
    var out = [];
    if (!(endMs > startMs)) return out;
    var cur = startMs;
    while (cur < endMs) {
      var d = new Date(cur);
      var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      var stop = Math.min(next, endMs);
      out.push({ date: iso(d), ms: stop - cur });
      cur = stop;
    }
    return out;
  }

  /* --- Formats ------------------------------------------------------------ */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // « jeudi 8 octobre 2026 »
  function long(s) {
    var d = parse(s);
    return DAYS[d.getDay()] + ' ' + (d.getDate() === 1 ? '1er' : d.getDate()) + NBSP + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  // « jeudi 8 octobre »
  function dayMonthLong(s) {
    var d = parse(s);
    return DAYS[d.getDay()] + ' ' + (d.getDate() === 1 ? '1er' : d.getDate()) + NBSP + MONTHS[d.getMonth()];
  }
  // « jeu. 8 oct. »
  function short(s) {
    var d = parse(s);
    return DAYS_SHORT[d.getDay()] + ' ' + d.getDate() + NBSP + MONTHS_SHORT[d.getMonth()];
  }
  // « 8 oct. »
  function dayMonth(s) {
    var d = parse(s);
    return d.getDate() + NBSP + MONTHS_SHORT[d.getMonth()];
  }
  // « 08/10/2026 » (export CSV, lu comme une date par Excel FR)
  function numeric(s) {
    var d = parse(s);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function monthYear(s) { var d = parse(s); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  // Échéance relative, toujours douce : « Aujourd'hui », « Demain », « Lundi », « 14 oct. »
  function relative(s, ref) {
    ref = ref || today();
    var n = diff(ref, s);
    if (n === 0) return 'Aujourd’hui';
    if (n === 1) return 'Demain';
    if (n === -1) return 'Hier';
    if (n > 1 && n < 7) return cap(DAYS[dow(s)]);
    return short(s);
  }

  // Écart de jours, formulé sans culpabiliser : « depuis 2 jours »
  function since(s, ref) {
    var n = diff(s, ref || today());
    if (n <= 0) return '';
    if (n === 1) return 'depuis hier';
    return 'depuis ' + n + NBSP + 'jours';
  }

  /* --- Périodes jour / semaine / mois ------------------------------------- */
  function period(kind, anchor) {
    var ref = today();
    anchor = anchor || ref;
    var start, end, label, shortLabel;
    if (kind === 'day') {
      start = end = anchor;
      label = cap(long(anchor));
      shortLabel = anchor === ref ? 'Aujourd’hui' : cap(short(anchor));
    } else if (kind === 'month') {
      start = startOfMonth(anchor);
      end = endOfMonth(anchor);
      label = cap(monthYear(anchor));
      shortLabel = start === startOfMonth(ref) ? 'Ce mois-ci' : label;
    } else {
      kind = 'week';
      start = startOfWeek(anchor);
      end = addDays(start, 6);
      var ds = parse(start), de = parse(end);
      label = 'Semaine du ' + ds.getDate() + (ds.getMonth() !== de.getMonth() ? NBSP + MONTHS[ds.getMonth()] : '') +
        ' au ' + de.getDate() + NBSP + MONTHS[de.getMonth()] + ' ' + de.getFullYear();
      shortLabel = start === startOfWeek(ref) ? 'Cette semaine' : 'Semaine ' + isoWeek(start);
    }
    return { kind: kind, start: start, end: end, label: label, shortLabel: shortLabel, days: eachDay(start, end), anchor: anchor };
  }

  function shift(kind, anchor, delta) {
    if (kind === 'day') return addDays(anchor, delta);
    if (kind === 'month') return addMonths(startOfMonth(anchor), delta);
    return addDays(startOfWeek(anchor), 7 * delta);
  }

  /* --- Durées --------------------------------------------------------------- */
  // 445 -> « 7 h 25 » · 60 -> « 1 h » · 45 -> « 45 min » · 0 -> « 0 h »
  function duration(min, opts) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    if (opts && opts.compact) {
      if (!h) return m + NBSP + 'min';
      return h + NBSP + 'h' + (m ? NBSP + pad(m) : '');
    }
    if (!h && !m) return '0' + NBSP + 'h';
    if (!h) return m + NBSP + 'min';
    return h + NBSP + 'h' + (m ? NBSP + pad(m) : '');
  }

  // Heures décimales à virgule (CSV) : 445 -> « 7,42 »
  function decimalHours(min) {
    return (Math.round(min / 60 * 100) / 100).toFixed(2).replace('.', ',');
  }

  // « 7:25 » (CSV, format h:mm reconnu par Excel)
  function hhmm(min) {
    min = Math.max(0, Math.round(min || 0));
    return Math.floor(min / 60) + ':' + pad(min % 60);
  }

  // Chrono : 4354000 ms -> « 01:12:34 »
  function clock(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
  }

  // Saisie libre : « 1h30 », « 1 h 30 », « 90 », « 90 min », « 1,5 », « 2h » -> minutes (ou null)
  // Règle : un nombre à virgule = des heures ; un entier < 15 = des heures ; sinon des minutes.
  function parseDuration(input) {
    var s = String(input || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    var m, v = null;
    if ((m = /^(\d{1,2})(?:h|:)(\d{1,2})?(?:min|m)?$/.exec(s))) { if (m[2] && +m[2] > 59) return null; v = +m[1] * 60 + (m[2] ? +m[2] : 0); }   // « 1h75 » refusé (QA-02)
    else if ((m = /^(\d+)(?:min|mn|m)$/.exec(s))) v = +m[1];
    else if ((m = /^(\d+)[,.](\d+)(?:h)?$/.exec(s))) v = Math.round(parseFloat(m[1] + '.' + m[2]) * 60);
    else if ((m = /^(\d+)$/.exec(s))) v = +m[1] < 15 ? +m[1] * 60 : +m[1];
    return v && v > 0 && v <= 24 * 60 ? v : null;
  }

  return {
    NBSP: NBSP, DAY_MS: DAY_MS,
    DAYS: DAYS, DAYS_SHORT: DAYS_SHORT, DAYS_LETTER: DAYS_LETTER, MONTHS: MONTHS, MONTHS_SHORT: MONTHS_SHORT,
    nowMs: nowMs, now: now, setNow: setNow, isClockShifted: isClockShifted,
    pad: pad, iso: iso, parse: parse, valid: valid, addDays: addDays, addMonths: addMonths, diff: diff,
    today: today, dateOf: dateOf, dow: dow, dowMon: dowMon, startOfWeek: startOfWeek, endOfWeek: endOfWeek,
    startOfMonth: startOfMonth, endOfMonth: endOfMonth, isWeekend: isWeekend, between: between,
    min: min, max: max, isoWeek: isoWeek, isoWeekInfo: isoWeekInfo, weekKey: weekKey, eachDay: eachDay, splitByDay: splitByDay, cap: cap,
    long: long, dayMonthLong: dayMonthLong, short: short, dayMonth: dayMonth, numeric: numeric, monthYear: monthYear,
    relative: relative, since: since, period: period, shift: shift,
    duration: duration, decimalHours: decimalHours, hhmm: hhmm, clock: clock, parseDuration: parseDuration
  };
});
