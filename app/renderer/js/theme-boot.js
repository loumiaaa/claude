/* Plateforme de suivi - Lamia — thème appliqué avant le premier rendu
   (évite un flash clair en mode sombre). Le main passe le thème enregistré
   dans data.json en paramètre (?theme=dark). 'system' = pas d'attribut. */
(function () {
  'use strict';
  try {
    var m = /[?&]theme=(light|dark)\b/.exec(window.location.search);
    if (m) document.documentElement.setAttribute('data-theme', m[1]);
  } catch (e) { /* on suit le système */ }
})();
