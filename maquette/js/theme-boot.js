/* Plateforme de suivi - Lamia — Maquette · thème appliqué avant le premier rendu
   (évite un flash clair en mode sombre). 'system' = pas d'attribut data-theme. */
(function () {
  'use strict';
  try {
    var raw = window.localStorage && window.localStorage.getItem('lamia.maquette.v1');
    var theme = raw ? (JSON.parse(raw).settings || {}).theme : null;
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
  } catch (e) { /* stockage indisponible : on suit le système */ }
})();
