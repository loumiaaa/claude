/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · calendrier (iCalendar)
   - parse(texte .ics) : événements d'un calendrier Apple / Google / Outlook ;
   - occurrences(événements, du, au) : les rendez-vous d'une période, avec les
     répétitions (RRULE : jour, semaine, mois, année ; INTERVAL, COUNT, UNTIL,
     BYDAY, BYMONTHDAY), les exceptions (EXDATE) et les occurrences déplacées
     (RECURRENCE-ID) ;
   - build(document, options) : les échéances des tâches au format .ics
     (export et abonnement dans Calendrier).
   Les heures avec fuseau (TZID) sont gardées telles quelles (heure locale) ;
   les heures UTC (« Z ») sont converties dans le fuseau de l'appareil.
   Aucune dépendance : ce fichier est aussi copié dans le relais Supabase
   (supabase/functions/calendar/ics.js). Module UMD.
   ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.ics = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_EVENTS = 5000, MAX_OCC = 2000;
  var DAYS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseDay(s); d.setDate(d.getDate() + n); return isoOf(d); }
  function dow(s) { return parseDay(s).getDay(); }
  function daysBetween(a, b) { var x = parseDay(a), y = parseDay(b); return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5); }
  function toMin(t) { return t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : 0; }
  function fromMin(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

  /* --- Lecture ------------------------------------------------------------- */
  function unescapeText(v) { return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim(); }

  // « 20261105T090000Z » / « 20261105T090000 » / « 20261105 » -> { date, time, allDay }
  function parseStamp(value, params) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value).trim());
    if (!m) return null;
    if (!m[4] || /VALUE=DATE(?!-)/i.test(params || '')) return { date: m[1] + '-' + m[2] + '-' + m[3], time: null, allDay: true };
    if (m[7]) {
      var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
      return { date: isoOf(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()), allDay: false };
    }
    return { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] + ':' + m[5], allDay: false };
  }

  // Durée ISO 8601 (« PT1H30M », « P1D ») en minutes
  function parseDuration(v) {
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v).trim());
    if (!m) return null;
    return ((+m[2] || 0) * 7 * 1440 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0)) * (m[1] === '-' ? -1 : 1);
  }

  function parseRule(v) {
    var r = {};
    String(v).split(';').forEach(function (kv) { var p = kv.split('='); if (p[0] && p[1] != null) r[p[0].toUpperCase()] = p[1].toUpperCase(); });
    if (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].indexOf(r.FREQ) < 0) return null;
    var until = r.UNTIL ? parseStamp(r.UNTIL) : null;
    return {
      freq: r.FREQ,
      interval: Math.max(1, +r.INTERVAL || 1),
      count: r.COUNT ? Math.max(1, +r.COUNT) : null,
      until: until ? until.date : null,
      byday: r.BYDAY ? r.BYDAY.split(',').map(function (x) { var m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(x.trim()); return m ? { n: m[1] ? +m[1] : 0, d: DAYS[m[2]] } : null; }).filter(Boolean) : null,
      bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(function (n) { return n && Math.abs(n) <= 31; }) : null
    };
  }

  function parse(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    // Lignes repliées : une ligne qui commence par une espace continue la précédente
    var un = [];
    lines.forEach(function (l) { if (/^[ \t]/.test(l) && un.length) un[un.length - 1] += l.slice(1); else un.push(l); });
    var events = [], cur = null, depth = 0;
    un.forEach(function (line) {
      if (/^BEGIN:VEVENT$/i.test(line)) { cur = { exdates: [] }; depth = 0; return; }
      if (!cur) return;
      if (/^BEGIN:/i.test(line)) { depth += 1; return; }          // VALARM… ignorés
      if (/^END:VEVENT$/i.test(line)) {
        if (cur.start && events.length < MAX_EVENTS && cur.status !== 'CANCELLED') events.push(finish(cur));
        cur = null; return;
      }
      if (/^END:/i.test(line)) { depth = Math.max(0, depth - 1); return; }
      if (depth) return;
      var i = line.indexOf(':');
      if (i < 0) return;
      var head = line.slice(0, i), value = line.slice(i + 1);
      var name = head.split(';')[0].toUpperCase(), params = head.slice(name.length);
      if (name === 'UID') cur.uid = value.trim();
      else if (name === 'SUMMARY') cur.title = unescapeText(value);
      else if (name === 'LOCATION') cur.location = unescapeText(value);
      else if (name === 'STATUS') cur.status = value.trim().toUpperCase();
      else if (name === 'DTSTART') cur.start = parseStamp(value, params);
      else if (name === 'DTEND') cur.end = parseStamp(value, params);
      else if (name === 'DURATION') cur.duration = parseDuration(value);
      else if (name === 'RRULE') cur.rule = parseRule(value);
      else if (name === 'RECURRENCE-ID') cur.recurrenceId = parseStamp(value, params);
      else if (name === 'EXDATE') value.split(',').forEach(function (v) { var s = parseStamp(v, params); if (s) cur.exdates.push(s.date); });
    });
    return events;
  }

  // Durée en minutes et nombre de jours couverts
  function finish(e) {
    var s = e.start, minutes, days;
    if (s.allDay) {
      days = e.end && e.end.allDay ? Math.max(1, daysBetween(s.date, e.end.date)) : e.duration != null ? Math.max(1, Math.round(e.duration / 1440)) : 1;
      minutes = null;
    } else {
      minutes = e.end && !e.end.allDay ? daysBetween(s.date, e.end.date) * 1440 + toMin(e.end.time) - toMin(s.time) : e.duration != null ? e.duration : 60;
      minutes = Math.max(0, minutes);
      days = 1;
    }
    return {
      uid: e.uid || (s.date + (s.time || '') + (e.title || '')),
      title: e.title || 'Sans titre',
      location: e.location || '',
      date: s.date, time: s.time, allDay: s.allDay,
      minutes: minutes, days: days,
      rule: e.rule || null, exdates: e.exdates,
      recurrenceId: e.recurrenceId ? e.recurrenceId.date : null
    };
  }

  /* --- Répétitions ------------------------------------------------------------ */
  function nthWeekdayOfMonth(y, m, n, d) {
    var out = [];
    for (var x = new Date(y, m, 1); x.getMonth() === m; x.setDate(x.getDate() + 1)) if (x.getDay() === d) out.push(isoOf(x));
    if (!n) return out;
    var k = n > 0 ? out[n - 1] : out[out.length + n];
    return k ? [k] : [];
  }

  // Dates de début d'une série, dans l'ordre, jusqu'à « to » (inclus)
  function ruleDates(e, to) {
    var r = e.rule, out = [], start = e.date, n = 0;
    var last = r.until && r.until < to ? r.until : to;
    function push(d) {
      if (d < start) return true;
      if (r.count && n >= r.count) return false;
      if (d > last) return false;
      n += 1; out.push(d);
      return out.length < MAX_OCC;
    }
    var guard = 0;
    if (r.freq === 'DAILY') {
      for (var d = start; guard++ < 20000; d = addDays(d, r.interval)) if (!push(d)) break;
    } else if (r.freq === 'WEEKLY') {
      var days = r.byday && r.byday.length ? r.byday.map(function (x) { return x.d; }) : [dow(start)];
      var wk = addDays(start, -((dow(start) + 6) % 7));                 // lundi de la 1re semaine
      outer: for (; guard++ < 5000; wk = addDays(wk, 7 * r.interval)) {
        if (wk > last) break;
        var list = days.map(function (dd) { return addDays(wk, (dd + 6) % 7); }).sort();
        for (var i = 0; i < list.length; i++) if (!push(list[i])) break outer;
      }
    } else if (r.freq === 'MONTHLY') {
      var s = parseDay(start);
      for (var k = 0; guard++ < 1200; k += r.interval) {
        var y = s.getFullYear() + Math.floor((s.getMonth() + k) / 12), m = (s.getMonth() + k) % 12;
        if (isoOf(new Date(y, m, 1)) > last) break;
        var cand = [];
        if (r.byday && r.byday.length) r.byday.forEach(function (x) { cand = cand.concat(nthWeekdayOfMonth(y, m, x.n, x.d)); });
        else (r.bymonthday || [s.getDate()]).forEach(function (md) {
          var dim = new Date(y, m + 1, 0).getDate(), dd = md > 0 ? md : dim + md + 1;
          if (dd >= 1 && dd <= dim) cand.push(isoOf(new Date(y, m, dd)));
        });
        cand.sort();
        var stop = false;
        for (var j = 0; j < cand.length; j++) if (!push(cand[j])) { stop = true; break; }
        if (stop) break;
      }
    } else if (r.freq === 'YEARLY') {
      var sy = parseDay(start);
      for (var yy = sy.getFullYear(); guard++ < 200; yy += r.interval) {
        var dt = new Date(yy, sy.getMonth(), sy.getDate());
        if (dt.getMonth() !== sy.getMonth()) continue;            // 29 février
        if (!push(isoOf(dt))) break;
      }
    }
    return out;
  }

  // Rendez-vous entre « from » et « to » (inclus), triés par jour puis heure.
  // Un événement de plusieurs jours apparaît sur chacun de ses jours.
  function occurrences(events, from, to) {
    var moved = {};
    events.forEach(function (e) { if (e.recurrenceId) moved[e.uid + '|' + e.recurrenceId] = true; });
    var out = [];
    events.forEach(function (e) {
      var starts;
      if (e.rule && !e.recurrenceId) {
        starts = ruleDates(e, to).filter(function (d) { return e.exdates.indexOf(d) < 0 && !moved[e.uid + '|' + d]; });
      } else starts = [e.date];
      starts.forEach(function (d) {
        var span = e.allDay ? e.days : 1;
        if (!e.allDay && e.minutes != null) span = Math.max(1, Math.ceil((toMin(e.time) + e.minutes) / 1440));
        for (var i = 0; i < span; i++) {
          var day = addDays(d, i);
          if (day < from || day > to) continue;
          var endMin = e.allDay ? null : toMin(e.time) + (e.minutes || 0);
          out.push({
            uid: e.uid, title: e.title, location: e.location, date: day, allDay: e.allDay || i > 0,
            time: e.allDay || i > 0 ? null : e.time,
            end: e.allDay || i > 0 || endMin == null ? null : (endMin >= 1440 ? '24:00' : fromMin(endMin)),
            multi: span > 1, first: i === 0
          });
        }
      });
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : a.title.localeCompare(b.title);
    });
    return out;
  }

  /* --- Écriture : échéances des tâches -------------------------------------------- */
  function escapeText(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  // Lignes de 75 octets au plus (on coupe à 60 caractères : sûr même avec des accents)
  function fold(line) {
    var out = [];
    while (line.length > 60) { out.push(line.slice(0, 60)); line = ' ' + line.slice(60); }
    out.push(line);
    return out.join('\r\n');
  }
  function stampDate(s) { return s.replace(/-/g, ''); }

  // doc : document de la plateforme. options : { name, now (Date), done (bool) }
  function build(doc, options) {
    var o = options || {};
    var now = o.now || new Date();
    var stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
    var cats = {};
    ((doc && doc.categories) || []).forEach(function (c) { cats[c.id] = c.name; });
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plateforme de suivi//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + escapeText(o.name || 'Mes échéances'), 'X-APPLE-CALENDAR-COLOR:#5B4BD6', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
    ((doc && doc.tasks) || []).forEach(function (t) {
      if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t.endDate || '') || (t.status === 'done' && !o.done)) return;
      var desc = [cats[t.categoryId], t.client, t.status === 'done' ? 'Terminée' : (t.progress ? t.progress + ' % fait' : '')].filter(Boolean).join(' · ');
      lines.push('BEGIN:VEVENT', 'UID:' + escapeText(t.id) + '@plateforme-de-suivi', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + stampDate(t.endDate), 'DTEND;VALUE=DATE:' + stampDate(addDays(t.endDate, 1)),
        fold('SUMMARY:' + escapeText((t.status === 'done' ? '✓ ' : '📌 ') + t.title)));
      if (desc) lines.push(fold('DESCRIPTION:' + escapeText(desc)));
      lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  /* --- Liens de calendrier acceptés ------------------------------------------------ */
  // webcal:// devient https:// ; seuls les calendriers publics d'Apple (iCloud), Google et
  // Outlook sont lus (le relais n'est pas un proxy ouvert). Renvoie l'URL https ou null.
  var HOSTS = [/(^|\.)icloud\.com$/, /^calendar\.google\.com$/, /^outlook\.(live|office365)\.com$/, /^outlook\.office\.com$/];
  function allowedUrl(raw) {
    var s = String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://');
    var m = /^https:\/\/([^\/?#:@]+)(?::443)?([\/?#].*)?$/i.exec(s);
    if (!m || s.length > 2000) return null;
    var host = m[1].toLowerCase();
    return HOSTS.some(function (re) { return re.test(host); }) ? 'https://' + host + (m[2] || '/') : null;
  }

  return { parse: parse, allowedUrl: allowedUrl, occurrences: occurrences, build: build, parseStamp: parseStamp, parseDuration: parseDuration };
});
