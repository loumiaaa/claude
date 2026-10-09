/* ==========================================================================
   Plateforme de suivi - Lamia — logique partagée · export CSV des heures
   Format générique lisible dans Excel en français :
   - UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF ;
   - heures décimales à virgule (« 1,50 ») et en h:mm (« 1:30 ») ;
   - dates JJ/MM/AAAA ; une ligne par entrée de temps ;
   - un sous-total par catégorie, AUCUN total général (pro et perso ne sont
     jamais additionnés).
   Module UMD.
   ========================================================================== */
(function (root, factory) {
  var D = typeof require === 'function' && typeof module === 'object' ? require('./dates.js') : root.LamiaShared.dates;
  var mod = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.LamiaShared = root.LamiaShared || {}; root.LamiaShared.csv = mod; }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var BOM = '﻿';
  var SEP = ';';
  var EOL = '\r\n';
  var HEADER = ['Date', 'Catégorie', 'Pôle', 'Client / projet', 'Tâche', 'Durée (h)', 'Durée (hh:mm)', 'Source', 'Note'];
  var POLE = { flowline: 'Flow Line', 'auto-entreprise': 'Auto-entreprise' };
  var SOURCE = { timer: 'Chrono', manual: 'Saisie manuelle' };

  // Texte libre : un « = + - @ » en tête serait lu comme une formule par Excel
  function text(v) {
    v = String(v == null ? '' : v).replace(/\r\n?/g, '\n');
    return /^[=+\-@\t]/.test(v) ? ' ' + v : v;
  }

  function cell(v) {
    v = String(v == null ? '' : v);
    return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function line(cells) { return cells.map(cell).join(SEP); }

  // Lignes (tableaux de cellules) de la période [start, end], sans l'en-tête
  function rows(state, start, end) {
    var out = [];
    state.categories.forEach(function (c) {
      var list = [];
      state.tasks.forEach(function (t) {
        if (t.categoryId !== c.id) return;
        (t.timeEntries || []).forEach(function (e) { if (e.date >= start && e.date <= end) list.push({ t: t, e: e }); });
      });
      if (!list.length) return;
      list.sort(function (a, b) {
        if (a.e.date !== b.e.date) return a.e.date < b.e.date ? -1 : 1;
        return a.t.title.localeCompare(b.t.title, 'fr');
      });
      var sum = 0;
      var pole = POLE[c.group] || c.group;
      list.forEach(function (r) {
        sum += r.e.minutes;
        out.push([D.numeric(r.e.date), text(c.name), pole, text(r.t.client), text(r.t.title),
          D.decimalHours(r.e.minutes), D.hhmm(r.e.minutes), SOURCE[r.e.source] || 'Saisie manuelle', text(r.e.note)]);
      });
      out.push(['', text(c.name), pole, '', 'Sous-total ' + c.name, D.decimalHours(sum), D.hhmm(sum), '', '']);
      out.push(['', '', '', '', '', '', '', '', '']);
    });
    if (out.length) out.pop();   // pas de ligne vide finale
    return out;
  }

  function build(state, start, end) {
    return BOM + [HEADER].concat(rows(state, start, end)).map(line).join(EOL) + EOL;
  }

  function filename(p) {
    return 'heures-lamia_' + p.start + (p.end !== p.start ? '_' + p.end : '') + '.csv';
  }

  return { BOM: BOM, SEP: SEP, EOL: EOL, HEADER: HEADER, cell: cell, text: text, rows: rows, build: build, filename: filename };
});
