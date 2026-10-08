/* ==========================================================================
   Plateforme de suivi - Lamia — Icônes
   Script classique (pas de module ES, aucun accès réseau) : fonctionne en file://

   Style : grille 24 × 24, contour arrondi, trait 1,75 px, stroke="currentColor"
   (l'icône prend la couleur du texte). Dessinées pour le projet, sans bibliothèque.

   API
     LamiaIcons.svg(name, { size, className, title, strokeWidth })  -> chaîne <svg>
         size        taille en px (défaut 20). Dans un composant, le CSS l'impose.
         className   classes ajoutées à "icon icon--<name>"
         title       texte accessible : role="img" + <title>. Sans title, l'icône
                     est décorative (aria-hidden="true").
     LamiaIcons.list                 -> tableau des noms disponibles
     LamiaIcons.has(name)            -> booléen
     LamiaIcons.hydrate(root?)       -> remplace chaque [data-icon="nom"] par son SVG
                                        (data-icon-size, data-icon-title facultatifs)
   ========================================================================== */
(function (global) {
  'use strict';

  // Petits points pleins (listes, poignées, « plus »)
  function dot(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r || 1.1) + '" fill="currentColor"/>';
  }

  var P = {};

  /* --- Navigation principale ---------------------------------------------- */
  P.dashboard =
    '<rect x="3.5" y="3.5" width="7" height="9" rx="2"/>' +
    '<rect x="13.5" y="3.5" width="7" height="5" rx="2"/>' +
    '<rect x="13.5" y="11.5" width="7" height="9" rx="2"/>' +
    '<rect x="3.5" y="15.5" width="7" height="5" rx="2"/>';

  P.tasks =
    '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>' +
    '<path d="M8 7.5v8M12 7.5v4.5M16 7.5v6"/>';
  P.kanban = P.tasks;

  P.list =
    '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/>' +
    dot(5, 6.5) + dot(5, 12) + dot(5, 17.5);

  P.planning =
    '<rect x="6.5" y="4" width="9" height="4" rx="2"/>' +
    '<rect x="10.5" y="10" width="10" height="4" rx="2"/>' +
    '<rect x="3.5" y="16" width="9" height="4" rx="2"/>';

  P.calendar =
    '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/>' +
    '<path d="M3.5 9.5h17M8 3v4M16 3v4"/>' +
    '<path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" stroke-width="2.4"/>';

  P.recap =
    '<path d="M19 13A8 8 0 1 1 11 5v8z"/>' +
    '<path d="M14 3a7 7 0 0 1 7 7h-7z"/>';

  P.chart =
    '<path d="M3.5 20.5h17"/>' +
    '<rect x="5" y="11" width="3.5" height="6" rx="1.25"/>' +
    '<rect x="10.25" y="5" width="3.5" height="12" rx="1.25"/>' +
    '<rect x="15.5" y="8.5" width="3.5" height="8.5" rx="1.25"/>';

  P.trend =
    '<path d="M3.5 17.5 9 12l3.5 3.5 8-8"/>' +
    '<path d="M15 7.5h5.5V13"/>';

  P.settings =
    '<path d="M10.51 5.06L10.84 2.82A9.25 9.25 0 0 1 13.16 2.82L13.49 5.06A7.1 7.1 0 0 1 15.85 6.04L17.67 4.69A9.25 9.25 0 0 1 19.31 6.33L17.96 8.15A7.1 7.1 0 0 1 18.94 10.51L21.18 10.84A9.25 9.25 0 0 1 21.18 13.16L18.94 13.49A7.1 7.1 0 0 1 17.96 15.85L19.31 17.67A9.25 9.25 0 0 1 17.67 19.31L15.85 17.96A7.1 7.1 0 0 1 13.49 18.94L13.16 21.18A9.25 9.25 0 0 1 10.84 21.18L10.51 18.94A7.1 7.1 0 0 1 8.15 17.96L6.33 19.31A9.25 9.25 0 0 1 4.69 17.67L6.04 15.85A7.1 7.1 0 0 1 5.06 13.49L2.82 13.16A9.25 9.25 0 0 1 2.82 10.84L5.06 10.51A7.1 7.1 0 0 1 6.04 8.15L4.69 6.33A9.25 9.25 0 0 1 6.33 4.69L8.15 6.04A7.1 7.1 0 0 1 10.51 5.06Z"/>' +
    '<circle cx="12" cy="12" r="3"/>';

  /* --- Actions --------------------------------------------------------------- */
  P.plus = '<path d="M12 5v14M5 12h14"/>';
  P.minus = '<path d="M5 12h14"/>';
  P.check = '<path d="M5 12.5 9.5 17 19 7.5"/>';
  P.close = '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>';

  P.edit =
    '<path d="M17 3.5a2.12 2.12 0 0 1 3 3L8 18.5l-4 1 1-4z"/>' +
    '<path d="M14.5 6l3 3"/>';

  P.trash =
    '<path d="M4 6.5h16"/>' +
    '<path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5"/>' +
    '<path d="M6 6.5l.85 12.2a2 2 0 0 0 2 1.8h6.3a2 2 0 0 0 2-1.8L18 6.5"/>' +
    '<path d="M10 10.5v6M14 10.5v6"/>';

  P.copy =
    '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/>' +
    '<path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>';

  P.more = dot(5.5, 12, 1.15) + dot(12, 12, 1.15) + dot(18.5, 12, 1.15);
  P['more-vertical'] = dot(12, 5.5, 1.15) + dot(12, 12, 1.15) + dot(12, 18.5, 1.15);

  P.grip =
    dot(9, 6, 1.15) + dot(15, 6, 1.15) +
    dot(9, 12, 1.15) + dot(15, 12, 1.15) +
    dot(9, 18, 1.15) + dot(15, 18, 1.15);

  P.menu = '<path d="M4 7h16M4 12h16M4 17h16"/>';

  P.search =
    '<circle cx="11" cy="11" r="6.5"/>' +
    '<path d="m20 20-4.4-4.4"/>';

  P.filter = '<path d="M4 4.5h16l-6.2 7.4v6.4l-3.6 1.8v-8.2z"/>';

  P.sort =
    '<path d="M7.5 19.5v-15M4 8l3.5-3.5L11 8"/>' +
    '<path d="M16.5 4.5v15M13 16l3.5 3.5L20 16"/>';

  P.export =
    '<path d="M13.5 4H20v6.5M20 4l-8.5 8.5"/>' +
    '<path d="M18 14v3.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H10"/>';

  P.download =
    '<path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5"/>' +
    '<path d="M4.5 15v2.5a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V15"/>';

  P.upload =
    '<path d="M12 14.5V4M7.5 8.5 12 4l4.5 4.5"/>' +
    '<path d="M4.5 15v2.5a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V15"/>';

  P.refresh =
    '<path d="M19.5 11A7.5 7.5 0 0 0 6 7.2L4.5 9"/>' +
    '<path d="M4.5 4.5V9H9"/>' +
    '<path d="M4.5 13A7.5 7.5 0 0 0 18 16.8l1.5-1.8"/>' +
    '<path d="M19.5 19.5V15H15"/>';

  P.eye =
    '<path d="M2.75 12S6.25 5.5 12 5.5 21.25 12 21.25 12 17.75 18.5 12 18.5 2.75 12 2.75 12z"/>' +
    '<circle cx="12" cy="12" r="3"/>';

  /* --- Chrono ---------------------------------------------------------------- */
  P.play = '<path d="M7.5 5.8v12.4a1.3 1.3 0 0 0 2 1.1l9.7-6.2a1.3 1.3 0 0 0 0-2.2L9.5 4.7a1.3 1.3 0 0 0-2 1.1z"/>';
  P.pause =
    '<rect x="6.5" y="5" width="3.5" height="14" rx="1.25"/>' +
    '<rect x="14" y="5" width="3.5" height="14" rx="1.25"/>';
  P.stop = '<rect x="6" y="6" width="12" height="12" rx="2.75"/>';

  P.clock =
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 7.5V12l3 2"/>';

  P.timer =
    '<circle cx="12" cy="13.5" r="7.5"/>' +
    '<path d="M12 13.5V10M9.5 2.75h5M12 2.75V6M18.25 7.25 19.5 6"/>';

  /* --- Organisation ---------------------------------------------------------- */
  P.flag =
    '<path d="M5.5 21V4"/>' +
    '<path d="M5.5 5c4.5-2.5 8.5 2.5 13 0v9c-4.5 2.5-8.5-2.5-13 0"/>';

  P.tag =
    '<path d="M3.5 5A1.5 1.5 0 0 1 5 3.5h6.6a2 2 0 0 1 1.42.59l7.4 7.4a2 2 0 0 1 0 2.83l-6.6 6.6a2 2 0 0 1-2.83 0l-7.4-7.4A2 2 0 0 1 3.5 12.1z"/>' +
    '<circle cx="8" cy="8" r="1.5"/>';

  P.folder = '<path d="M3.5 7A2 2 0 0 1 5.5 5h3.7a2 2 0 0 1 1.5.7L12 7.5h6.5a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>';

  P.briefcase =
    '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/>' +
    '<path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/>' +
    '<path d="M3.5 12.5h17M10.5 12.5v1.5h3v-1.5"/>';

  P.checklist =
    '<path d="m4 6.5 1.5 1.5L8.5 5M4 13l1.5 1.5 3-3"/>' +
    '<path d="M11.5 6.5h8.5M11.5 13h8.5M11.5 19h8.5"/>' +
    '<circle cx="6.25" cy="19" r="1.75"/>';

  P.note =
    '<path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9z"/>' +
    '<path d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h4.5"/>';

  P.target =
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<circle cx="12" cy="12" r="5"/>' +
    dot(12, 12, 1.25);

  P.user =
    '<circle cx="12" cy="8" r="4"/>' +
    '<path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>';

  /* --- Notifications & états ------------------------------------------------ */
  P.bell =
    '<path d="M6 10a6 6 0 0 1 12 0v4.2l1.6 2.5a.9.9 0 0 1-.76 1.3H5.16a.9.9 0 0 1-.76-1.3L6 14.2z"/>' +
    '<path d="M10 20.5a2.3 2.3 0 0 0 4 0"/>';

  P.alert =
    '<path d="M10.3 4.3 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/>' +
    '<path d="M12 9.5v4"/>' + dot(12, 16.9, 0.45);

  P.info =
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 11v5"/>' + dot(12, 7.9, 0.45);

  /* --- Ambiance -------------------------------------------------------------- */
  P.sun =
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2.75v2M12 19.25v2M4.75 12h-2M21.25 12h-2M6.9 6.9 5.5 5.5M18.5 18.5l-1.4-1.4M6.9 17.1l-1.4 1.4M18.5 5.5l-1.4 1.4"/>';

  P.moon = '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a7.5 7.5 0 0 0 10 10z"/>';

  P.mood =
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M8.5 14a4 4 0 0 0 7 0"/>' +
    '<path d="M9 9.5v.6M15 9.5v.6"/>';

  P.sparkle =
    '<path d="M11 4c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z"/>' +
    '<path d="M18.75 16.5v4M16.75 18.5h4"/>';

  P.coffee =
    '<path d="M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/>' +
    '<path d="M16.5 10.5h1.25a2.75 2.75 0 0 1 0 5.5H16.3"/>' +
    '<path d="M8.5 3.5c-.8.9-.8 1.6 0 2.5M12.5 3.5c-.8.9-.8 1.6 0 2.5"/>';

  P.heart = '<path d="M12 19.5s-7.5-4.4-7.5-10A4.25 4.25 0 0 1 12 7a4.25 4.25 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>';

  P.cat =
    '<path d="M4.5 10.5V4.5L9 7.6a8 8 0 0 1 6 0l4.5-3.1v6a7 7 0 0 1 .5 2.6c0 4.1-3.6 7-8 7s-8-2.9-8-7a7 7 0 0 1 .5-2.6z"/>' +
    '<path d="M9 12.5v.75M15 12.5v.75"/>' +
    '<path d="M10.5 15.75c.5.6 1 .6 1.5 0 .5.6 1 .6 1.5 0"/>';

  P.palette =
    '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8h2.1a3.8 3.8 0 0 0 3.8-3.8C20.5 6.9 16.7 3.5 12 3.5z"/>' +
    dot(7.5, 11.5, 1) + dot(9.5, 7.5, 1) + dot(14.5, 7.5, 1);

  /* --- Flèches & chevrons ---------------------------------------------------- */
  P['chevron-left'] = '<path d="m14.5 6-6 6 6 6"/>';
  P['chevron-right'] = '<path d="m9.5 6 6 6-6 6"/>';
  P['chevron-down'] = '<path d="m6 9.5 6 6 6-6"/>';
  P['chevron-up'] = '<path d="m6 14.5 6-6 6 6"/>';

  P['arrow-up'] = '<path d="M12 19.5v-15M5.5 11 12 4.5l6.5 6.5"/>';
  P['arrow-down'] = '<path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5"/>';
  P['arrow-left'] = '<path d="M19.5 12h-15M11 5.5 4.5 12l6.5 6.5"/>';
  P['arrow-right'] = '<path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5"/>';

  /* --- Moteur --------------------------------------------------------------- */
  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function svg(name, opts) {
    opts = opts || {};
    var body = P[name];
    if (!body) {
      if (global.console && global.console.warn) global.console.warn('LamiaIcons : icône inconnue « ' + name + ' »');
      return '';
    }
    var size = Number(opts.size) || 20;
    var stroke = Number(opts.strokeWidth) || 1.75;
    var cls = 'icon icon--' + name + (opts.className ? ' ' + opts.className : '');
    var a11y, title = '';
    if (opts.title) {
      a11y = ' role="img" aria-label="' + escapeXml(opts.title) + '"';
      title = '<title>' + escapeXml(opts.title) + '</title>';
    } else {
      a11y = ' aria-hidden="true" focusable="false"';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-linejoin="round" class="' + escapeXml(cls) + '"' + a11y + '>' +
      title + body + '</svg>';
  }

  function hydrate(root) {
    root = root || global.document;
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var markup = svg(el.getAttribute('data-icon'), {
        size: el.getAttribute('data-icon-size'),
        title: el.getAttribute('data-icon-title'),
        className: el.className && typeof el.className === 'string' ? el.className : ''
      });
      if (markup) el.outerHTML = markup;
    }
  }

  global.LamiaIcons = {
    svg: svg,
    list: Object.keys(P),
    has: function (name) { return Object.prototype.hasOwnProperty.call(P, name); },
    hydrate: hydrate
  };
})(window);
