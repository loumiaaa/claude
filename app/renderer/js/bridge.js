/* Plateforme de suivi - Lamia — pont vers la logique partagée (app/shared/,
   servie sous app://lamia/shared/). Les vues de la maquette utilisent L.dates. */
(function (L) {
  'use strict';
  L.dates = window.LamiaShared.dates;
  L.shared = window.LamiaShared;
})(window.Lamia = window.Lamia || {});
