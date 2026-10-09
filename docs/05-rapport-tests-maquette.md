# Rapport de recette — maquette cliquable (Phase 1)

> Testeur (QA) · 9 octobre 2026 · version complète.
> Cibles : `maquette/index.html` et `maquette/dist/plateforme-de-suivi-lamia.html`, ouvertes en `file://` dans Chromium 141 (Playwright 1.56), date de démo figée au jeudi 8 octobre 2026, locale `fr-FR`.
> Références : `docs/01-brief-produit.md` §3 (grille de recette), `docs/00-cahier-des-charges.md` §6 et §9, `docs/03-ux-parcours.md`, `docs/02-charte-graphique.md`.
> Les scripts et les captures sont hors dépôt (dossier de travail du testeur). Aucun fichier du projet n'a été modifié (ce rapport excepté).

## 1. Synthèse

- **Verdict : maquette solide et fidèle au brief, recette réussie sous réserve de 3 défauts majeurs à corriger dans l'application** (aucun bloquant).
- **Stories** : 27 évaluées, **23 OK, 4 Partiel, 0 KO** ; 4 stories (TR-1 à TR-4) hors périmètre de la maquette.
- **Défauts : 0 bloquant, 3 majeurs, 11 mineurs, 4 cosmétiques.** Majeurs : QA-01 (graphiques du Récap qui débordent entre 1280 et 1440 px), QA-02 (import `.json` incomplet qui corrompt les données et empêche le redémarrage), QA-03 (focus perdu au clavier après les actions courantes).
- **Stabilité** : 0 erreur ou avertissement console, 0 exception de page, **0 requête réseau** (seules des ressources `file:` et `data:`) sur tous les parcours, dans les deux fichiers (seule exception : l'import d'un fichier incomplet, QA-02). Les calculs (heures, KPI, filtres, tris, CSV, Planning) recoupent des calculs indépendants faits sur les données brutes ; `index.html` et `dist/` ont le même comportement et un rendu identique au pixel près.
- **Accessibilité** : axe-core, 0 violation critique ou sérieuse sur 15 états × 2 thèmes ; 2 modérées et 1 mineure (voir §5).

## 2. Tableau des user stories

Légende : OK, Partiel, KO, Hors périmètre. Les références QA-xx renvoient au §3. « Calcul indépendant » : valeur recalculée par le testeur à partir de `Lamia.store.get()` puis comparée au rendu.

| ID | Intitulé court | Statut | Preuve ou remarque |
|---|---|---|---|
| DB-1 | Accueil | OK | Date « Jeudi 8 octobre 2026 », « Bonjour Lamia », 2 bulles. Phrase de Lamia ≤ 110 car. (40 tirages à l'écran et les 142 phrases avec n = 0, 1, 2, 3, 5, 12). Memeow : 58 répliques toutes en « meew » + icône autorisée, 40 tirages et 15 clics à l'écran. 14 rechargements : aucune répétition consécutive. Sprites animés (4 images distinctes sur 6 s) ; avec `prefers-reduced-motion` : 1 seule image sur 6 s et animations CSS à 1 ms. |
| DB-2 | Voix contextuelle | **Partiel** | `LamiaVoice.eligible` : lundi, vendredi, samedi, dimanche, échéances, retards, terminées, 35 h, première ouverture, retour ≥ 4 j (exclusif). Humeur ≤ 2 (aujourd'hui ou hier) : réconfort exclusif, cœur (200 tirages). Dimanche et soir : 0 fuite de phrase retards/échéances sur 600 tirages. Midi : 56 % de croquettes. « 1 tâche a glissé » / « 3 tâches ont glissé », jamais « 0 tâche ». Deux écarts : QA-10 (texte d'accueil, de 0 h à 5 h) et QA-11 (nuit et humeur basse : zZz au lieu du cœur, deux règles du brief se contredisent). |
| DB-3 | Humeur du jour | OK (mineur QA-03) | Modale à la 1re ouverture, 5 icônes pixel nettes, rien d'enregistré avant le clic ; 1 clic enregistre (niveau + note), « Plus tard » ne bloque ni n'enregistre, pas de reproposition le même jour (rechargement), « Modifier » depuis le Dashboard. Humeur 5 : bulle normale ; humeur 1 à 10 h 30 : bulle de réconfort + cœur ; point ajouté à la courbe du Récap (25 → 26 points). |
| DB-4 | Récap express | OK | Terminées jour/semaine/mois = 1/2/3 (calcul indépendant) ; choix mémorisé après rechargement. |
| DB-5 | Heures de la semaine | OK | Flow Line 25 h 57 / 35 h = 1 485 min d'entrées + 72 min de chrono ; Carnet 1 h 15 et Auto 45 min sans objectif ; au-delà de 35 h : « Objectif atteint : + 48 h 12, tout en douceur », sans alerte ; **aucun libellé « total » dans les 5 onglets** (jour, semaine, mois). |
| DB-6 | Échéances et « à replanifier » | OK | Demain = 9 oct., Lundi prochain = 12 oct., Choisir (dialogue + date), Annuler ; 6 échéances sur 7 jours = calcul ; couleurs ambre, aucun rouge vif. |
| DB-7 | Chrono | OK (mineur QA-07) | Widget : tâche, temps, Pause, Stop ; ▶ en 1 clic ; bascule avec message et entrée du 1er chrono créée. |
| ST-1 | Créer vite | OK | Titre seul, Entrée, erreur claire si vide, Flow Line proposée le jeudi (Auto-entreprise samedi et dimanche, vérifié en injectant la date), `+` de colonne, « Créer et détailler ». |
| ST-2 | Kanban | OK | 4 colonnes ; glisser-déposer souris (entre colonnes, dans la colonne, vers Terminé) ; Alt + flèches, menu ⋯ « Déplacer vers… », Maj+F10 ; déplacements annoncés (`aria-live`) ; ordre conservé après rechargement ; Terminé = date de fin réelle + 100 % proposé sans être imposé. |
| ST-3 | Vue liste | OK | 7 tris dans les 2 sens, 6 filtres + recherche = calculs indépendants, filtres conservés après rechargement. Le filtre « période » est réalisé par « Échéance » (cette semaine, ce mois-ci, à replanifier, sans date). |
| ST-4 | Détail | OK | Curseur 0–100 % (pas de 5, valeur 47 ramenée à 45), checklist (ajout, coche, ordre par bouton et par Alt + ↑ ↓, suppression), dates (message clair si fin < début), priorité, étiquettes + autocomplétion. |
| ST-5 | Heures | OK (mineurs QA-05, QA-07) | Un seul chrono actif ; pause et marche survivent au rechargement ; Stop crée l'entrée (durée = temps affiché) ; > 10 h : dialogue de correction (durée invalide refusée, Échap sans perte) ; saisie « 1h30 », « 90 », « 1,5 » (+ 8 variantes) ; modification, suppression, annulation ; tâche passée en Terminé : le chrono s'arrête. |
| ST-6 | Catégories | OK | Renommer, ajouter, couleur, groupe ; proposée dans « Nouvelle tâche » ; heures visibles au Dashboard, au Récap et au Planning ; suppression d'une catégorie utilisée : réaffectation imposée. Objectifs d'heures, jours, thème, rappels, export et réinitialisation fonctionnent. |
| ST-7 | Rappels | OK (maquette) | Rappel J-n par tâche, toast groupé à l'ouverture, cohérent avec les données. **Notification Windows : hors périmètre** (phase 2, voir `docs/03-ux-parcours.md` §7). |
| ST-8 | Suppression sans stress | OK | Aucune fenêtre bloquante ; « Annuler » reste ≈ 10 s (présent à 8,5 s, absent à 10,8 s) et restaure tâche et carte. |
| PL-1 | Gantt par catégorie | OK (mineur QA-04) | Tâches du mois et de septembre = calcul indépendant ; 3 groupes ; couleurs distinctes ; « Non planifiées » ; position et longueur des barres exactes. |
| PL-2 | Aujourd'hui, zoom, navigation | OK | Repère exact, bouton Aujourd'hui, semaine/mois, précédent/suivant (passage d'année), état vide. |
| PL-3 | Clic ouvre le détail | OK | Clic et Entrée ouvrent le tiroir ; Échap rend le focus à la barre ; retard en ambre avec fil pointillé et « à replanifier ». |
| RC-1 | Récap : période et KPI | OK | KPI (créées, terminées, en cours, à replanifier, taux) = calcul indépendant pour jour, semaine, mois et 3 périodes passées ou futures. |
| RC-2 | Heures par catégorie | **Partiel** | Jamais additionnées ; Flow Line 25 h 57 = calcul ; barres jour par jour et mois (38 h 42, objectif 154 h = 22 j × 7 h) = calcul. Écart : QA-06 (samedi, la carte Flow Line affiche « 0 h sur 0 h » et « Objectif atteint, pile poil »). |
| RC-3 | À terminer / arrivent bientôt | OK | Effectifs 6 et 6 = calcul. |
| RC-4 | Graphiques | OK (mineur QA-17) | Courbe d'humeur : 25 points et 5 segments = calcul (**un jour sans humeur = un trou**) ; répartition par catégorie = calcul ; taux de complétion ; tableaux jumeaux. |
| RC-5 | Export CSV | OK | UTF-8 **avec BOM** (EF BB BF), séparateur `;`, CRLF, en-tête `Date;Catégorie;Tâche;Client;Durée (h);Note`, dates jj/mm/aaaa, durées décimales à virgule, 13 lignes = 13 entrées, sous-totaux = calcul (26,07 / 1,25 / 0,75), **aucun total général**, titre/client/note avec `;`, guillemets, accents et saut de ligne correctement protégés. |
| RC-6 | Export PDF | OK | `window.print()` appelé ; PDF A4 de 4 pages, en-tête avec période, une carte par catégorie, sans total général ; reste clair même en thème sombre (`beforeprint` bascule le thème, `afterprint` le restaure). |
| TR-1 à TR-4 | Exe, dossier portable, écriture atomique, verrou | Hors périmètre | Phase 2 (`docs/03-ux-parcours.md` §7). |
| TR-5 | Thème clair/sombre/système | OK | Attribut, fond et `aria-pressed` corrects ; mémorisé ; « Système » suit `prefers-color-scheme` et bascule sans rechargement. |
| TR-6 | AA, clavier, focus visible | **Partiel** | Pièges et restitution du focus corrects dans les modales et le tiroir, focus visible sur 28 types de contrôles, ordre de tabulation logique, `prefers-reduced-motion` respecté, axe sans violation sérieuse. Écarts : QA-03 (focus perdu), QA-08 (cibles tactiles), QA-12 à QA-14. |
| Should | Export / import `.json` | **Partiel** | Export OK (24 tâches, nom explicite) ; import OK pour un fichier exporté par l'application ; mais voir QA-02 pour un fichier incomplet. |

## 3. Défauts

Classés par gravité. Chaque défaut a été reproduit au moins deux fois (deux scripts, deux fichiers, ou test plus lecture du code). Les numéros de ligne sont ceux de `maquette/` au 9 octobre 2026 ; `dist/` embarque le même code et présente les mêmes défauts.

### Majeurs

**QA-01 — Récap, semaine et mois : les graphiques des catégories sans objectif débordent de leur carte entre 1280 et 1440 px, et la page défile à l'horizontale à 1280–1300 px**
- Écran : Récap, période Semaine ou Mois, « Heures par catégorie ».
- Reproduction : ouvrir `#recap` avec une fenêtre de 1280 px de large ; regarder les cartes « Carnet by-pass » et « Auto-entreprise ». Répéter à 1366 et 1440 px.
- Obtenu : le SVG fait 240 px alors que la carte offre 216 px (1280), 221 px (1300), 238 px (1366) et 256 px (1440) de large utile. Il dépasse du bord de la carte de 49 px (1280), 44 px (1300), 28 px (1366) et 9 px (1440) : les libellés « Sam. », « Dim. » sont rognés, les lignes de grille sortent de la carte, et à 1280–1300 px `document.scrollWidth` dépasse la fenêtre de 9 et 4 px (**défilement horizontal de la page**, contraire à `docs/00-cahier-des-charges.md` §9 et au « vérifié de 1440 à 390 px » de `docs/03-ux-parcours.md` §4). Aucun débordement de page à 1279 px et en dessous, ni à partir de 1536 px.
- Attendu : le graphique s'adapte à sa carte ; aucun défilement horizontal de la page à aucune largeur.
- Piste : `maquette/js/ui-charts.js` ligne 98, `var W = Math.max(240, Math.floor(host.clientWidth || 320))` (idem lignes 152 et 186 avec 240 et 260). La grille `.hours-grid` (`maquette/css/app.css` lignes 1052–1053 : 4 colonnes, la carte Flow Line sur 2) donne 1 colonne aux deux autres cartes, plus étroites que 240 px entre 1280 et ≈ 1500 px. Corriger en abaissant le plancher à ~180 px avec des étiquettes d'axe réduites, ou en passant la grille à 3 colonnes égales avant 1500 px. Capture : `shots/responsive/recap-1280-overflow.png`.

**QA-02 — Importer une sauvegarde `.json` incomplète corrompt les données et empêche l'application de redémarrer**
- Écran : Réglages > Dossier de données > « Importer une sauvegarde ».
- Reproduction : importer un fichier `{"version":1,"tasks":[],"categories":[{"id":"a","name":"A","color":"blue","group":"flowline"}],"moods":[]}` (sans `settings`), confirmer « Importer », naviguer entre deux onglets, recharger la page. Variantes avec le même résultat : fichier sans `moods`, avec `categories: []`, ou dont les tâches n'ont pas `tags`, `checklist` ou `timeEntries` (chacune est le résultat d'une édition manuelle ou d'une ancienne version du format).
- Obtenu : le dialogue de confirmation s'affiche (« 0 tâche… vont remplacer les données actuelles »), puis une `TypeError` survient (`Cannot read properties of undefined (reading 'ui')`, ou `'filter'`, `'name'`, `'some'` selon la variante). L'état en mémoire est déjà remplacé par le fichier invalide ; l'action suivante l'écrit dans `localStorage` ; **au rechargement, `init()` plante de nouveau et plus aucun onglet ne s'affiche** (4 variantes sur 4). Les données d'origine sont perdues et il n'existe aucun chemin de récupération dans l'interface.
- Attendu : valider la structure complète (`settings`, `settings.schedules`, `moods`, `categories` non vide, `tags`/`checklist`/`timeEntries` par tâche, `categoryId` connu) avant de remplacer quoi que ce soit ; en cas d'écart : message « Fichier non reconnu… Rien n'a été modifié » (déjà utilisé pour un JSON illisible) ou complétion par des valeurs par défaut ; ne jamais écraser sans copie. Même principe pour la lecture au démarrage (`readSaved`) : un état illisible doit ramener à la démo ou proposer la restauration (cf. TR-3 : « jamais d'écrasement silencieux »).
- Piste : `maquette/js/ui-settings.js` lignes 157–165 (validation limitée à `version` et `tasks`), `maquette/js/store.js` lignes 113–120 (`replace` affecte `state = data` avant de lire `state.settings.ui`, ligne 117) et lignes 19–26 et 91–94 (`readSaved` ne vérifie que `version` et `tasks` ; `init` suppose `settings.ui`). Capture : `shots/stories/import-crash-*.png`. À noter : le déclencheur est rare (fichier modifié à la main ou ancien), mais l'effet est une perte complète des données de la maquette ; en phase 2, ce même contrôle sera critique pour TR-3.

**QA-03 — Au clavier, le focus retombe sur `<body>` après les actions les plus courantes (chrono, replanifier, supprimer, modifier l'humeur)**
- Écran : Dashboard, tiroir de tâche, widget Chrono.
- Reproduction (clavier seul, Entrée) : (a) Dashboard, focaliser « ▶ » d'une tâche en cours, Entrée ; (b) puis « Pause » dans le widget du chrono, Entrée ; (c) focaliser « Demain » dans « À replanifier », Entrée ; (d) « Choisir », choisir une date, « Replanifier » ; (e) ouvrir une tâche (Entrée sur sa carte), activer « Supprimer » ; (f) « Modifier » dans la carte Humeur, changer le niveau, « C'est noté ».
- Obtenu : dans les 6 cas, `document.activeElement` est `<body>`. Le prochain Tab repart du début de la page (lien d'évitement, barre latérale) : l'utilisatrice perd sa place après chaque démarrage, pause ou arrêt de chrono, et après chaque replanification. Échec du critère WCAG 2.4.3 (parcours du focus) et de l'engagement TR-6 « tout utilisable au clavier ».
- Attendu : le focus reste sur le contrôle qui a déclenché l'action (par exemple Pause devient Reprendre au même endroit), ou, si le contrôle disparaît, passe à un élément voisin logique (ligne suivante, titre de l'onglet), comme le fait déjà la suppression d'une sous-tâche.
- Piste : le re-rendu par `innerHTML` ne conserve le focus que pour les éléments portant `data-focus-key` (`maquette/js/ui-common.js` lignes 353–362, `keepFocus`). Il manque cet attribut sur : les boutons du chrono (`ui-chrono.js` lignes 24, 37–39, 49–54, rendus par `render()` lignes 57–68), les boutons ▶/pause des lignes de tâches (`ui-dashboard.js` lignes 179–183), les boutons de replanification (lignes 222–224), le bouton « Modifier » (ligne 164). La restitution à la fermeture d'une couche (`ui-common.js` lignes 192–211) ne sait retrouver l'origine que par `data-focus-key` ; or `drawer.remove()` supprime la carte d'origine (`ui-drawer.js` lignes 388–397). Ajouter des `data-focus-key` stables et, pour les éléments qui disparaissent, un repli explicite (carte voisine, sinon titre de l'onglet).

### Mineurs

**QA-04 — Planning, vue Mois à 1440 px : la timeline déborde de 15 px et la dernière journée est coupée**
- Reproduction : `#planning` en 1440 × 900, zoom Mois (octobre 2026).
- Obtenu : `.gantt__scroll` mesure 1094 px pour 1109 px de contenu ; le « 31 » de l'en-tête et les « 0 % » des barres de fin de mois (Portfolio, Déclaration URSSAF, Flyers) sont rognés ; une barre de défilement interne apparaît sans raison visible. Constaté aussi à 1280 px (défilement interne plus important, attendu à cette largeur d'après `docs/03-ux-parcours.md` §4).
- Attendu : à 1440 px, le mois de 31 jours tient entièrement.
- Piste : `maquette/css/app.css` ligne 899, `.gantt--month .gantt__inner { min-width: calc(var(--label-w) + var(--days) * 27px); }` : 272 px (`--label-w`, ligne 893) + 31 × 27 px = 1109 px pour 1094 px disponibles. Passer à 26 px par jour ou réduire `--label-w` à 256 px.

**QA-05 — Saisie de durée : les minutes supérieures à 59 sont acceptées (« 1h75 » devient 2 h 15)**
- Écran : tiroir > Heures > « Ajouter du temps à la main » (idem édition d'une entrée et dialogue du chrono > 10 h).
- Reproduction : saisir `1h75` puis Ajouter ; vérifié aussi par `Lamia.dates.parseDuration('1h75')`.
- Obtenu : entrée de 135 min sans message ; `1h99` donne 159 min ; `99h` donne 5 940 min et `9999` donne 166 h, sans demande de confirmation.
- Attendu : refus avec « Indique une durée, par exemple 1h30, 90 ou 1,5 » pour des minutes > 59 ; confirmation au-delà de ~24 h pour une saisie manuelle.
- Piste : `maquette/js/dates.js` ligne 370, la regex `/^(\d{1,2})(?:h|:)(\d{1,2})?(?:min|m)?$/` accepte deux chiffres de minutes ; ajouter `if (m[2] && +m[2] > 59) return null`.

**QA-06 — Récap, vue Jour du samedi (ou du dimanche) : la carte Flow Line affiche « 0 h sur 0 h » et « Objectif atteint, pile poil. »**
- Écran : Récap > Jour > navigation vers un samedi (ex. « Samedi 10 octobre 2026 »).
- Obtenu : carte Flow Line « 0 h sur 0 h — Objectif atteint, pile poil. — Pas d'heures ce jour-là : c'était le week-end. ». La même carte en vue Semaine ou Mois est correcte.
- Attendu : RC-2 « le samedi, durée sans objectif » : durée seule, sans « sur 0 h » ni message d'objectif.
- Piste : `maquette/js/ui-recap.js` lignes 72 (`goalTotal` vaut 0 hors jours travaillés), 77 (`compare`) et 79–87 (`left = 0 - 0` donne « pile poil »). Traiter `goalTotal === 0` comme « pas d'objectif » et reprendre le texte « Sans objectif… ».

**QA-07 — Double-clic sur Stop relance le chrono ; double-clic sur ▶ le met aussitôt en pause**
- Écran : widget Chrono, Dashboard.
- Reproduction : (a) chrono en cours, double-clic rapide sur « Stop » du widget ; (b) chrono arrêté, double-clic rapide sur « ▶ » d'une tâche.
- Obtenu : (a) 1 seule entrée créée, mais le chrono est **relancé sur la même tâche** (le 2e clic tombe sur « Reprendre « … » », rendu à la même place) ; (b) le chrono démarre puis passe en pause (le 2e clic tombe sur le bouton Pause qui remplace ▶). Aucune erreur, mais des heures faussées si l'oubli n'est pas vu. 20 clics rapides alternés : aucune erreur, aucune entrée invalide.
- Attendu : un double-clic équivaut à un clic.
- Piste : `maquette/js/ui-chrono.js` lignes 154–166 (délégation de clic) : ignorer les clics avec `e.detail > 1`, ou temporiser 300–400 ms après chaque action. Note : un start/stop en 0,15 s crée une entrée de 1 min (`Math.max(1, …)`, `store.js` ligne 281) ; à documenter ou à ignorer sous ~10 s.

**QA-08 — Mobile : de nombreuses cibles tactiles font moins de 44 px**
- Écran : tous, à 390 et 360 px (aucune règle `pointer: coarse` ni gabarit mobile de 44 px dans `app.css`).
- Obtenu (390 px, hors liens textuels) : boutons ⋯ et « + » 32 × 32 (28 sur la page Tâches), pastilles de couleur des catégories 26 × 26, jours travaillés 38 × 38, ▶ et boutons icônes 40 × 40, segments Jour/Semaine/Mois 32 px de haut, « Demain » / « Lundi prochain » / « Choisir » 32 px, listes déroulantes `select--sm` 32 px, navigation de période 32 × 32, `summary` « Voir les données » 27 px, pastille du chrono 20 px de haut.
- Attendu : cibles d'au moins 44 × 44 px sur mobile (consigne de recette).
- Piste : `design/tokens.css` ligne 201 (`--control-sm: 32px`), `design/components.css` lignes 563 (`.btn--sm`) et 586 (`.btn--icon`), `app.css` lignes 1152 et 1177 (`.palette__swatch`, `.day-toggle`) : ajouter, sous 860 px, `min-height`/`min-width: 44px` (ou une zone d'appui élargie par `::after`) sur ces classes.

**QA-09 — Un titre ou un client contenant un mot de plus de ~40 à 60 caractères sans espace fait déborder la liste, le Planning mobile et le Récap**
- Écran : Suivi des tâches > Liste et Kanban ; Planning (liste mobile) ; Récap (« À terminer », « Arrivent bientôt »).
- Reproduction : créer une tâche intitulée `Maquette_finale_v3_HD_impression_et_diffusion_numerique_OK_` (60 car., nom de fichier typique) avec une échéance, aller en Liste puis au Planning à 390 px ; créer une autre tâche dont le client est un mot de 40 car. (`Maquette_finale_v3_HD_impression_et_diffusion_`) et ouvrir le Récap.
- Obtenu : à 390 px, défilement horizontal de la page de +111 px en Liste et +139 px au Planning (titre de 60 car.), +26 px au Récap (client de 40 car. : la ligne `recap-item__meta` n'a pas d'ellipse ; le titre y est bien tronqué). À 1440 px : titre de 100 car. : +142 px en Liste ; client de 120 car. : +45 px au Kanban et +439 px en Liste. Le Dashboard et le tiroir sont corrects ; une phrase de 240 car. avec espaces et une URL de 90 car. (coupée aux tirets) ne posent aucun problème.
- Attendu : coupure ou ellipse, jamais de débordement de page.
- Piste : `maquette/css/app.css` ligne 754 (`.row-title`), ligne 1030 (`.plan-item__title`), lignes 1076–1080 (`.recap-item`, `.recap-item__text` : le `.recap-item__meta` n'a ni `overflow-wrap` ni ellipse) et la ligne du client des cartes du Kanban : ajouter `overflow-wrap: anywhere` et `min-width: 0` sur ces éléments.

**QA-10 — Entre 0 h et 5 h, le texte d'accueil parle d'échéances et de tâches à replanifier**
- Écran : Dashboard, héros.
- Reproduction : ouvrir le Dashboard avec l'horloge à 02:30 (l'application utilise l'heure réelle).
- Obtenu : « Cette semaine : 3 échéances d'ici dimanche et 1 tâche déjà bouclée aujourd'hui. 3 tâches attendent juste une nouvelle date. » ; correct à partir de 18 h (« La journée est faite… »). Or `design/phrases.js` définit la nuit de 22 h à 5 h, et DB-2 interdit toute phrase sur les retards et échéances la nuit.
- Attendu : le texte « La journée est faite » (ou équivalent) de 18 h à 5 h.
- Piste : `maquette/js/ui-dashboard.js` ligne 97, `var late = now.getHours() >= 18 || D.dow(D.today()) === 0;` : ajouter `|| now.getHours() < 5`.

**QA-11 — Nuit et humeur basse : Memeow affiche zZz au lieu du cœur (deux règles de DB-2 se contredisent) — à arbitrer**
- Reproduction : `LamiaVoice.pick` avec `moodToday: 1` à 23 h 30 ou 02 h 00 (120 tirages) ; la même chose à 10 h 00 ou 19 h 30.
- Obtenu : à 23 h 30 et 02 h 00, 100 % zZz et animation `sleep` ; à 10 h et 19 h 30, 100 % cœur. DB-2 demande à la fois « humeur ≤ 2 : Memeow affiche un cœur » et « nuit : Memeow dort (zZz) ».
- Attendu : décision produit. Proposition : l'humeur basse prime (cœur, Memeow endormie en pose `sleep`), puisque le brief dit « uniquement des phrases de réconfort ».
- Piste : `design/phrases.js` ligne 600, `if (c.slot === 'nuit') return 'nuit';` placé avant le test sur `humeurBasse`. Les phrases de Lamia, elles, sont bien en réconfort.

**QA-12 — Rôles ARIA non autorisés : `article role="listitem"` (24 cartes du Kanban) et `aside role="dialog"` (tiroir)**
- Outil : axe-core, règle `aria-allowed-role` (mineur), deux thèmes, `index` et `dist`.
- Piste : `maquette/js/ui-tasks.js` ligne 62 (`<article … role="listitem">` : utiliser un `div`/`li` dans un `ul`, ou retirer le rôle de l'`article`) ; `maquette/js/ui-drawer.js` ligne 130 (`<aside … role="dialog">` : utiliser un `div`). Note : l'`article` focalisable reçoit déjà un `aria-label` complet, qui doit rester.

**QA-13 — Repères de page et nommage : deux régions homonymes sur le Dashboard, `aria-labelledby` sur un `div` sans rôle, menu hors repère**
- Outil : axe-core, `landmark-unique` (modéré, Dashboard), `aria-prohibited-attr` (à vérifier, bloc « À replanifier »), `region` (modéré, menu ⋯ ouvert).
- Piste : `maquette/js/ui-dashboard.js` ligne 286 (`<section class="glass card hero" aria-labelledby="h-dashboard">` duplique le nom de `#view-dashboard`, `index.html` ligne 58 : retirer l'attribut du héros) ; ligne 213 (`<div class="replan" aria-labelledby="dh-replan">` : ajouter `role="group"`) ; `maquette/js/ui-common.js` ligne 290 (menu ajouté à `<body>` hors de tout repère quand aucune couche n'est ouverte : lui donner un conteneur `role="region"` ou accepter la règle `region`, qui est une bonne pratique et non une obligation).

**QA-14 — Contraste inférieur à 4,5:1 sur quelques textes de 12 px (mesure par échantillonnage de pixels)**
- Méthode : texte rendu transparent, échantillonnage du fond réel sous chaque mot, rapport WCAG recalculé (≈ 2 400 textes mesurés : 6 vues × 2 thèmes). Résultat : 0 texte sous le seuil au Dashboard, aux Tâches et aux Réglages en clair ; les cas ci-dessous sont les seuls vrais écarts (les autres alertes de la mesure viennent de la fine barre d'avancement des barres du Gantt et de tableaux repliés, écartées).
- Obtenu : badge « 6 » (nombre de tâches en cours) de la barre latérale en sombre : 4,24:1 (texte `#A99CFF` sur fond ≈ `#403C70`) ; lettres des jours de week-end dans l'en-tête du Gantt : 4,0:1 en clair, 3,2 à 4,5:1 en sombre. À confirmer par la DA avec l'outil de la planche de style.
- Attendu : 4,5:1 pour du texte de 12 px.
- Piste : `design/tokens.css` (`--accent-soft` en sombre, `--color-text-subtle`) et `app.css` lignes 934 (`.gantt__day.is-weekend`) et 895 (`--gantt-weekend`).

### Cosmétiques

**QA-15 — Textes d'état vide inadaptés quand il n'y a aucune tâche**
- Reproduction : supprimer les 24 tâches ; Suivi des tâches > Liste ; Planning.
- Obtenu : la liste affiche « Aucune tâche ne correspond. Les filtres sont peut-être un peu trop exigeants. On les relâche ? » et un bouton « Effacer les filtres », alors qu'aucun filtre n'est actif ; le Planning affiche, sous « Non planifiées », « Tout est daté. Bel ordre ! ». Tout le reste (Kanban, Dashboard, Récap, chrono) est correct, sans erreur.
- Attendu : « Pas encore de tâche. Crée la première ! » avec le seul bouton « Nouvelle tâche » quand le total est 0.
- Piste : `maquette/js/ui-tasks.js` lignes 146 et 167–172 (`emptyFiltered()` appelé même sans filtre) ; `ui-planning.js` ligne 159.

**QA-16 — Champ vidé : l'ancienne valeur est conservée en silence**
- Reproduction : (a) tiroir, effacer le titre ; (b) Réglages, effacer le nom d'une catégorie.
- Obtenu : le champ reste vide à l'écran mais la donnée garde son ancien nom (la carte et la liste affichent toujours l'ancien titre), sans message.
- Attendu : rétablir l'ancien texte à la perte du focus, ou afficher « Le titre ne peut pas être vide ».
- Piste : `maquette/js/ui-drawer.js` ligne 234 (`if (v.trim()) …`) et `maquette/js/ui-settings.js` ligne 143.

**QA-17 — L'infobulle d'un graphique disparaît quand le focus clavier fait défiler la page**
- Reproduction : à 390 px, Récap, Tab jusqu'à la première barre d'un graphique d'heures (la page défile de ≈ 790 px) ; la barre suivante, sans défilement, affiche bien son infobulle. À 1440 px, sans défilement, l'infobulle s'affiche.
- Piste : `maquette/js/ui-charts.js` ligne 276, `window.addEventListener('scroll', hideTip, true)` se déclenche après l'affichage provoqué par le focus. Les valeurs restent lisibles dans le tableau jumeau et les `aria-label`.

**QA-18 — Planning entre 1024 et 1279 px : les barres passent en transparence sous la colonne d'étiquettes**
- Reproduction : `#planning` en 1024 px, mois courant (la timeline défile et se centre sur aujourd'hui).
- Obtenu : le texte des barres qui défilent sous la colonne « Tâches » reste visible en filigrane derrière les titres, ainsi que les lettres de l'en-tête.
- Piste : `maquette/css/app.css` lignes 903–913, la colonne collante a un fond `--glass-bg-strong` (≈ 90 % d'opacité) ; utiliser un fond opaque (`--color-surface`). Capture : `shots/responsive/gantt1024-crop.png`.

### Observations (non comptées, à arbitrer par le produit)

- **Soir et dimanche** : seul le texte du héros devient « La journée est faite ». La carte « Heures de la semaine » dit encore « Encore 9 h 03 d'ici vendredi (objectif : 7 h par jour) » et le bloc « À replanifier » reste affiché à 21 h 30 ; `docs/03-ux-parcours.md` §5 écrit « le Dashboard ne parle plus de charge ». À préciser.
- **Deux catégories du même groupe Flow Line** : chacune reçoit sa propre jauge « / 35 h » (essai avec « Illustration QA » en groupe Flow Line : « 2 h / 35 h »), alors que l'objectif de 35 h est celui du groupe ; la voix, elle, cumule le groupe (`store.js` lignes 419–422). Décider si la jauge est par groupe ou par catégorie.
- **CSV et Excel** : un titre commençant par `=`, `+`, `-` ou `@` serait interprété comme une formule à l'ouverture ; préfixer d'une apostrophe ou d'une espace (`ui-recap.js` lignes 231, `cell()`). Risque faible (titres saisis par Lamia elle-même).
- **Modale d'humeur** : le premier bouton (« Au plus bas ») reçoit le focus initial : il est lu en premier par un lecteur d'écran ; envisager de placer le focus sur le titre de la modale.
- **Arrondis des heures** : les durées affichées au CSV sont arrondies à 0,01 h par ligne ; les sous-totaux sont calculés sur les minutes exactes. Sur cet échantillon, ils concordent (26,07 / 1,25 / 0,75), mais un écart de 0,01 h est possible sur d'autres données.

## 4. Responsive

Mesures automatiques sur 5 onglets (+ tiroir, modale « Nouvelle tâche » et vue Liste sur mobile), `index.html`.

| Largeur | Défilement horizontal de la page | Éléments hors de l'écran | Chevauchements réels | Remarques |
|---|---|---|---|---|
| 1440 | 0 | 0 | 0 | QA-01 (9 px de graphique hors carte), QA-04 (Gantt) |
| 1280 | **9 px au Récap**, 0 ailleurs | 0 | 0 | QA-01 |
| 1024 | 0 | 0 | 0 | QA-18 (barres du Gantt sous la colonne d'étiquettes) |
| 768 | 0 | 0 | 0 | Barre d'onglets en bas, Kanban à défilement interne |
| 390 | 0 | 0 | 0 | Voir QA-08 (cibles tactiles) ; filtres de catégories à défilement interne (voulu) |
| 360 | 0 | 0 | 0 | Idem 390 |

Les « chevauchements » signalés par l'outil (jusqu'à 14 par page) sont des éléments qui défilent sous la barre d'onglets et la pastille du chrono fixes (comportement normal), des zones de survol de graphiques voisines (7 px) et les barres du Gantt (voulu). Les captures de chaque onglet en 1440 et en 390 sont dans `shots/onglets/` (`index-1440-light-*.png`, `index-390-light-*.png`) et `shots/responsive/` (vues du haut de page en 390 et 360, 768 et 1024). Rien de coupé ni de superposé n'a été relevé en dehors de QA-01, QA-04, QA-09 et QA-18. Le Kanban à 82 vw de large, la liste en cartes, la liste chronologique du Planning, le tiroir plein écran et la barre d'onglets sont corrects en 390 et 360 px.

## 5. Accessibilité

### axe-core 4.10.2 (règles WCAG 2.0 A/AA, 2.1 A/AA, 2.2 AA et bonnes pratiques)

États audités, en clair puis en sombre : modale d'humeur, Dashboard, Tâches (Kanban et Liste), Planning (mois et semaine), Récap (jour, semaine/mois avec tableaux ouverts), Réglages, tiroir, modale « Nouvelle tâche » (avec erreur), dialogue de date, menu ⋯, page avec toast. Résultat identique sur `index.html` et sur `dist/`.

| Impact | Règle | Nombre | Où | Réf. |
|---|---|---|---|---|
| Critique, sérieux | aucune | 0 | tous les états | |
| Modéré | `landmark-unique` | 1 | Dashboard (deux régions « Dashboard ») | QA-13 |
| Modéré | `region` | 1 | menu ⋯ ouvert | QA-13 |
| Mineur | `aria-allowed-role` | 24 (cartes) + 1 (tiroir) | Tâches, tiroir | QA-12 |
| À vérifier | `aria-prohibited-attr` | 1 à 4 | `.replan` | QA-13 |
| À vérifier | `color-contrast` | 7 à 288 selon l'état | fonds vitrés et dégradés (axe ne sait pas conclure) | mesure manuelle ci-dessous |
| À vérifier | `skip-link` | 1 | | vérifié à la main : visible au focus, amène sur `<main>` |

### Contrastes mesurés par pixels
≈ 2 400 textes, 6 vues, 2 thèmes : voir QA-14 (3 familles de textes sous 4,5:1, toutes en 12 px).

### Clavier
- Lien d'évitement : 1re tabulation, visible (à 12 px du coin, 140 × 36 px), Entrée place le focus sur `<main>`.
- Ordre de tabulation logique sur le Dashboard (lien d'évitement, logo, Nouvelle tâche, navigation, chrono, thème, puis contenu dans l'ordre visuel). Aucun arrêt sur un élément invisible.
- Focus visible : changement de pixels constaté au focus clavier pour 28/28 types de contrôles testés (navigation, boutons, segments, cartes, menus ⋯, champs, listes, pastilles, jours, interrupteur, cases, barres de Gantt et de graphiques, courbe, `summary`).
- Modale d'humeur, modale de création, dialogues et tiroir : focus initial dans la couche, **piégé** (14 à 60 Tab, Maj+Tab : 0 sortie), reste de la page `inert`, Échap ferme, focus **restitué** à l'élément d'origine (carte, bouton `+`, barre du Gantt, titre de l'onglet). Exceptions : QA-03.
- Menu ⋯ : Maj+F10, flèches, Échap qui ferme le menu avant le tiroir et rend le focus au bouton.
- Courbe d'humeur : flèches ← → annoncent le jour dans la zone `aria-live` et affichent l'infobulle (exception : QA-17).
- `prefers-reduced-motion` émulé : sprites immobiles (1 image sur 6 s), animations CSS à 1 ms, pastille du chrono sans pulsation.

## 6. Thèmes

- **Clair, sombre, système** : bascule instantanée depuis la barre latérale, la barre du haut et les Réglages ; choix mémorisé et appliqué avant le premier rendu (aucun flash) ; « Système » suit `prefers-color-scheme` et réagit à son changement sans rechargement. Export PDF toujours en clair.
- **Captures en sombre** de chaque onglet en 1440 et en 390 : `shots/onglets/index-1440-dark-*.png`, `index-390-dark-*.png` (et `dist-*`).
- **Lisibilité en sombre** : les graphiques du Récap (barres, objectifs, grilles, courbe d'humeur, tooltips) et le Gantt restent nets et contrastés ; le pixel art (Lamia, Memeow, icônes d'humeur) se détache bien du fond violet foncé de la scène, sans halo ni flou. Seuls écarts : QA-14.
- **Parité clair/sombre** : mêmes 3 défauts structurels (QA-01, QA-03, QA-04) dans les deux thèmes, aucun défaut propre à un thème.

## 7. Parité `index.html` / `dist/`

- **Rendu** : 20 captures (5 onglets × 1440 et 390 × clair et sombre, heure figée et animations réduites) comparées pixel à pixel : **18 identiques (0 pixel d'écart)** ; les 2 autres (Dashboard à 1440 px, clair et sombre) ne diffèrent que dans la bulle de Lamia (phrase tirée au hasard à chaque ouverture) ; à 390 px, la hauteur du Dashboard varie de la même façon avec la longueur de la phrase tirée.
- **Comportement** : les parcours création/édition/suppression de tâche, Kanban et liste, heures et chrono, Planning, Récap avec CSV et PDF, humeur, scène, Réglages, import/export ont été rejoués sur `dist/` : mêmes résultats sur les deux fichiers, 0 erreur, 0 requête réseau, même résultat axe. Les défauts QA-01 (débordement du Récap à 1280–1300 px), QA-02 (erreur d'import), QA-03 (focus perdu après ▶ et « Demain »), QA-04, QA-05, QA-06, QA-07 et QA-09 ont été reproduits à l'identique sur `dist/` ; le script de build ne fait qu'inliner les fichiers de `index.html`.

## 8. Ce qui n'a pas pu être testé, et pourquoi

- **TR-1 à TR-4** (exe portable, dossier de données, écriture atomique et sauvegardes, verrou) et **notification Windows** (ST-7) : hors maquette, à tester en phase 2 (sur le PC Flow Line pour TR-1).
- **Jours réels autres que le jeudi 8 octobre** : la date est figée (`DEMO_TODAY`). Lundi, samedi et dimanche ont été testés par injection de dates dans `LamiaVoice.pick/eligible` et dans `taskForm.defaultCategory()`, pas dans l'interface complète. Le passage de minuit et le changement de semaine ne sont pas testés.
- **Heures réelles** : l'heure de la voix suit l'horloge de la machine de test ; les cas matin, midi, soir et nuit ont été reproduits avec une horloge pilotée.
- **Glisser au doigt sur la poignée** (Pointer Events tactiles) et défilement automatique près des bords : non testés, aucun geste tactile réel n'est disponible en mode headless ; le code (`ui-tasks.js` lignes 332–377) a été relu et le menu ⋯ de remplacement a été validé. À essayer sur un vrai écran tactile.
- **Impression réelle** : la boîte de dialogue d'impression de Windows n'est pas pilotable ; le PDF a été produit par le moteur d'impression de Chromium (`page.pdf`, A4, média `print`) et `window.print()` vérifié par un espion.
- **Excel** : le CSV a été validé octet par octet (BOM, séparateur, virgule décimale) et par un analyseur CSV, pas ouvert dans Excel.
- **Lecteurs d'écran** (NVDA, Narrateur) : non disponibles ; l'audit repose sur axe-core, la lecture des `aria-label` / `aria-live` et la vérification du focus.
- **Navigateurs autres que Chromium**, zoom 200 % / texte agrandi, mode contraste élevé Windows (`forced-colors`) : non testés.
- **General Sans** : police locale non installée sur la machine de test, rendu en Poppins (repli prévu par la charte) ; l'aspect avec General Sans reste à valider en phase 2.
- **Format des `<input type="date">`** : suit la langue du navigateur de test (jj/mm/aaaa en `fr-FR`) ; à revérifier sous Windows et Electron.
- **Volumétrie** : seules les 24 tâches de la démo (et jusqu'à 27 en cours de test) ont été manipulées ; aucun test de charge.

## 9. Recommandations pour la phase 2

1. Corriger QA-01, QA-02 et QA-03 avant d'étendre l'interface : ils touchent la structure (grille du Récap, validation et reprise du stockage, gestion du focus par `data-focus-key`), pas des détails.
2. Écrire la validation de schéma de `data.json` (QA-02) en même temps que la migration de format de TR-3 ; la restauration automatique de la dernière sauvegarde valide couvrira alors les cas relevés.
3. Reprendre `data-focus-key` comme règle de composant : tout élément qui peut être re-rendu et qui reçoit une action clavier doit avoir une clé stable.
4. Ajouter dès maintenant au gabarit de composants un plancher tactile de 44 px sous 860 px (QA-08), puisque la version mobile est visée en V2.
5. Reprendre les scripts de recette (parcours créer/éditer/supprimer, chrono, CSV, import, clavier) comme tests de non-régression de l'application Electron ; `Lamia.seed()` est déterministe et sert de fixture.
