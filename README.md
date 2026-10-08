# Plateforme de suivi - Lamia

Application de bureau (fichier `.exe` Windows portable, hors ligne) pour suivre les tâches, les heures de travail, les échéances et l'humeur de Lamia, graphiste / web designer, chez **Flow Line Intégration** et en **auto-entreprise** (dont le projet **Carnet by-pass**).

Sur le tableau de bord, **Lamia** et sa chatte **Memeow**, en pixel art animé, l'accueillent à chaque connexion.

## Où en est le projet ?

| Phase | Contenu | État |
|---|---|---|
| 1. Conception | Brief produit, charte graphique, pixel art, maquette cliquable, architecture, recette de la maquette | En cours |
| Validation | Retours de Lamia sur la maquette | À venir |
| 2. Développement | Application `.exe` portable | À venir |
| 3. Tests | Tests automatiques et rapport | À venir |
| V2 | Synchronisation multi-appareils, version mobile | Plus tard |

## L'équipe (agents)

| Rôle | Livrables |
|---|---|
| CEO | `docs/01-brief-produit.md`, `design/phrases.js` |
| Directeur artistique | `docs/02-charte-graphique.md`, `design/tokens.css`, `design/components.css`, `design/icons.js` |
| DA pixel art | `design/sprites/` (Lamia, Memeow, bulles pixel, icônes d'humeur) |
| UI/UX designer | `docs/03-ux-parcours.md`, `maquette/` |
| Développeur | `docs/04-architecture-technique.md` |
| Testeur | `docs/05-rapport-tests-maquette.md` |

## Arborescence

```
docs/                 Cahier des charges et livrables de chaque rôle
design/
  tokens.css          Design tokens (couleurs, typo, verre, espacements), clair et sombre
  components.css      Composants de base (boutons, cartes vitrées, chips…)
  icons.js            Icônes SVG
  phrases.js          Phrases de Lamia et « meew » de Memeow
  fonts/              Polices embarquées (Poppins, Pixelify Sans)
  sprites/            Pixel art : Lamia, Memeow, bulles, icônes, exports PNG
maquette/
  index.html          Maquette cliquable (s'ouvre par double-clic)
  build-standalone.mjs  Assemble la maquette en un seul fichier HTML
  dist/               Maquette autonome en un seul fichier
```

## Voir la maquette

- Double-cliquer sur `maquette/index.html`, ou
- ouvrir `maquette/dist/plateforme-de-suivi-lamia.html` (fichier unique, à partager).

Pour régénérer le fichier unique : `node maquette/build-standalone.mjs`.
