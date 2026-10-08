# Parcours et maquette UX — Plateforme de suivi - Lamia

> Livrable UI/UX, phase 1 (conception) · 8 octobre 2026.
> Maquette : `maquette/index.html` (double-clic) ou `maquette/dist/plateforme-de-suivi-lamia.html` (fichier unique, `node maquette/build-standalone.mjs`).
> Références : cahier des charges (`00`), brief et user stories (`01`), charte (`02`), architecture (`04`).

## 1. Architecture de l'information

```
Coquille
├── Barre latérale (ordinateur) : logo · « + Nouvelle tâche » · 4 onglets + Réglages · widget Chrono · thème
├── Mobile (≤ 860 px) : barre du haut (titre, thème, +) · pastille Chrono · barre d'onglets en bas
├── 1. Dashboard        #dashboard   héros (Bonjour Lamia + scène pixel) · heures de la semaine · humeur
│                                    · récap express · tâches en cours (▶) · échéances + « à replanifier »
├── 2. Suivi des tâches #taches      filtres · Kanban 4 colonnes ⇄ Liste triable · tiroir de détail
├── 3. Planning         #planning    Gantt semaine / mois (liste chronologique sur mobile) · non planifiées
├── 4. Récap            #recap       période + navigation · KPI · heures par catégorie · humeur · listes
│                                    · répartitions · Export CSV / PDF
└── Réglages            #reglages    catégories · objectifs d'heures · thème · rappels · dossier de données · démo
Couches (enfants directs de <body>) : modale Humeur · modale Nouvelle tâche · tiroir Tâche · dialogue · menus · toasts
```

Le tiroir de détail est la seule fiche d'édition : on l'ouvre depuis une carte, une ligne, une barre du Gantt, une échéance, le chrono ou un toast. Tout s'enregistre au fil de l'eau (pas de bouton « Enregistrer »).

## 2. Les 5 parcours clés

| Parcours | Chemin le plus court | Clics |
|---|---|---|
| **Créer une tâche** | « + Nouvelle tâche » (ou touche `N`, ou « + » en tête de colonne) → titre → `Entrée`. La catégorie est proposée selon le jour (Flow Line en semaine, Auto-entreprise le week-end). « Créer et détailler » ouvre directement le tiroir. Toast « Tâche créée » + « Ouvrir le détail ». | 2 + saisie |
| **Lancer et arrêter le chrono** | Dashboard → ▶ sur une tâche en cours. Le widget (barre latérale / pastille mobile) affiche la tâche, le temps qui défile, Pause et Stop. Stop → toast « Temps enregistré : 1 h 12 » + « Voir la tâche ». Lancer un autre chrono arrête et enregistre le premier (toast explicite). Au-delà de 10 h, un dialogue propose de corriger la durée. | 1 (démarrer) · 1 (arrêter) |
| **Noter son humeur** | À la première ouverture du jour, la modale propose 5 icônes pixel : **1 clic enregistre**, la note est facultative, « Plus tard » ne bloque rien. Ensuite : carte « Humeur du jour » (Modifier). La bulle de Lamia se met à jour aussitôt (≤ 2 → réconfort). | 1 |
| **Replanifier une tâche en retard** | Dashboard → bloc « À replanifier » → **Demain** / **Lundi prochain** / **Choisir** (date). Toast avec « Annuler ». Dans le Planning, la tâche se signale par un fil pointillé jusqu'à aujourd'hui et la mention « à replanifier » (ambre doux, jamais rouge). | 1 |
| **Consulter le récap du mois** | Récap → « Mois » → ‹ › pour naviguer. KPI, heures par semaine pour chaque catégorie (objectif Flow Line au prorata), courbe d'humeur, listes. **Export CSV** télécharge les heures de la période ; **Export PDF** ouvre l'impression A4. | 2 |

## 3. Inventaire des composants par écran

Classes du DA (`design/components.css`) utilisées telles quelles ; classes propres à l'app dans `maquette/css/app.css`.

| Écran | Composants DA | Composants maquette |
|---|---|---|
| Coquille | `.glass`, `.nav-item[aria-current]`, `.btn--primary/--soft/--secondary`, `.segmented`, `.badge`, `.toast-region` | `.sidebar`, `.brand`, `.chrono` (verre teinté), `.topbar`, `.dock`, `.chrono-pill`, `.tabbar`, `.menu` |
| Dashboard | `.glass card`, `.pixel-stage`, `.pixel-bubble--tail-left/--bottom/--pop`, `.pixel-bubble__icon`, `.chip--*`, `.progress--lg`, `.prio`, `.segmented`, `.empty-state` | `.hero`, `.scene` (grille Lamia / bulle / Memeow), `.hours-row`, `.mood-picker`, `.mood-week`, `.task-row` (▶), `.replan`, `.date-tile`, `.due` (pastille d'échéance), `.mini-stat` |
| Tâches | `.glass--nested.glass--interactive` (cartes), `.input-wrap`, `.select`, `.tag`, `.chip`, `.kbd` | `.filters`, `.kanban`, `.kanban__col`, `.task-card` (+ poignée `.task-card__grip`), `.drop-marker`, `.drag-ghost`, `.task-table`, `.th-sort` |
| Tiroir | `.drawer`, `.field`, `.range-field`, `.checkbox--strike`, `.switch`, `.tag__remove` | `.title-input`, `.hours-hero`, `.manual-entry`, `.entries`, `.checklist`, `.tag-editor` |
| Planning | `.segmented`, `.chip`, `.empty-state` | `.period-bar`, `.gantt` (barres `--l/--w/--value`, `.gantt__slip`, `.gantt__today`), `.plan-item` (mobile), `.unplanned` |
| Récap | `.stat`, `.stat__delta`, `.ring`, `.progress` | `.kpi-row`, `.hcard` (petits multiples), graphiques SVG `L.charts.bars / hbars / moodLine`, `.chart-tip`, `.data-twin` (tableau jumeau), `.print-head` |
| Réglages | `.switch`, `.segmented`, `.btn--danger` (dialogue) | `.cat-row`, `.palette` (9 teintes tokens), `.day-toggles`, `.folder` |

## 4. Règles responsives

- **≥ 1280 px** : barre latérale vitrée fixe (248 px), contenu ≤ 1360 px, héros texte + scène côte à côte, rangée 4/4/4 (heures, humeur, récap express), puis 7/5.
- **861 – 1279 px** : héros empilé, heures et humeur 6/6, le reste pleine largeur ; KPI sur 3 colonnes ; le Kanban défile dans son conteneur (pas la page).
- **≤ 860 px (mobile, cible V2)** : barre du haut + barre d'onglets en bas + pastille chrono, marges de 16 px, cartes empilées. Kanban : colonnes de 82 vw avec défilement horizontal **interne** et accroche ; la liste devient une pile de cartes ; le Gantt devient une **liste chronologique** (« Déjà en route », « Cette semaine », « Semaine du… ») ; le tiroir occupe tout l'écran.
- **≤ 640 px** : sprites à l'échelle ×3, bulle de Lamia au-dessus d'elle (`--tail-bottom`).
- Vérifié de 1440 à 390 px : **aucun défilement horizontal de la page**.

## 5. États vides et micro-textes

Tutoiement, phrases courtes, jamais culpabilisantes : un retard est une tâche « à replanifier », une catégorie sans objectif « reste un plaisir ».

| Où | Texte |
|---|---|
| Colonnes du Kanban | « Rien en attente. Une idée ? Le bouton + est là pour ça. » · « Glisse ici la tâche du moment. » · « Rien chez le client pour l'instant. » · « Les victoires du jour arriveront ici. » |
| Filtres sans résultat | « Aucune tâche ne correspond. Les filtres sont peut-être un peu trop exigeants. On les relâche ? » |
| Échéances | « Aucune échéance dans les 7 prochains jours. Le calme avant… le calme. » |
| Chrono inactif | « Aucun chrono en cours. Une pause bien méritée ? » + « Reprendre « dernière tâche » » |
| Checklist / heures vides | « Découper, c'est déjà avancer. » · « Un clic sur le chrono et c'est parti. » |
| Planning vide | « Une page blanche, c'est aussi de la place pour respirer. » |
| Soir et dimanche | Le Dashboard ne parle plus de charge : « La journée est faite. Le reste attendra demain. » |

## 6. Accessibilité (AA)

- Navigation : lien d'évitement, `aria-current="page"`, titres `h1` focalisés à chaque changement d'onglet, `aria-pressed` sur tous les sélecteurs et bascules, libellés `aria-label` sur chaque bouton icône (vérifié par script : 0 contrôle sans nom, 0 id dupliqué).
- Couches : `role="dialog"` + `aria-modal`, focus initial, **focus piégé**, Échap, focus **restitué** à l'élément d'origine ; le reste de la page passe en `inert`.
- **Alternatives au glisser-déposer** : menu ⋯ « Déplacer vers… » (flèches, Origine/Fin, Échap), `Alt + ← →` (colonne) et `Alt + ↑ ↓` (ordre) sur une carte focalisée, sélecteur Statut dans le tiroir ; chaque déplacement est annoncé (`aria-live`) et le focus suit la carte. Checklist : `Alt + ↑ ↓` ou boutons Monter / Descendre.
- Glisser au doigt : poignée en haut de chaque carte (Pointer Events, `touch-action: none`), défilement automatique du Kanban près des bords.
- Graphiques : chaque barre est focalisable avec une infobulle identique au survol ; la courbe d'humeur se parcourt aux flèches ; un **tableau jumeau** (« Voir les données ») sous chaque graphique ; la couleur n'est jamais seule (libellés, légendes, petits multiples titrés).
- `prefers-reduced-motion` : animations du DA ramenées à 1 ms, PixelCast sur la pose de repos, pastille du chrono sans pulsation.
- Typographie française appliquée au rendu : espaces insécables avant `: ; ! ?` et dans les guillemets, apostrophes courbes.

## 7. User stories ↔ écrans

| Story | Où dans la maquette | État |
|---|---|---|
| DB-1 Accueil | Héros : date « Jeudi 8 octobre 2026 », scène, 2 bulles, `LamiaVoice` anti-répétition | ✅ |
| DB-2 Voix contextuelle | `L.q.voiceContext()` (échéances, retards, terminées, heures Flow Line, humeurs, 1re connexion, `daysAway`) | ✅ |
| DB-3 Humeur du jour | Modale de 1re connexion (1 clic, Plus tard, non reproposée le jour même) + carte Humeur | ✅ |
| DB-4 Récap express | Carte jour / semaine / mois, choix mémorisé | ✅ |
| DB-5 Heures | Jauge Flow Line (« 25 h 57 / 35 h »), durées seules pour le perso, « + 2 h » neutre, aucun total | ✅ |
| DB-6 Échéances | 7 jours + « À replanifier » (Demain / Lundi prochain / Choisir) | ✅ |
| DB-7 Chrono | ▶ sur les tâches en cours, widget toujours visible | ✅ |
| ST-1 · ST-2 · ST-3 · ST-4 | Création rapide · Kanban + DnD + clavier + 100 % proposé · Liste triable, 6 filtres mémorisés · Tiroir complet | ✅ |
| ST-5 Heures | Chrono unique qui survit au rechargement, correction > 10 h, saisie « 1h30 / 90 / 1,5 », entrées modifiables | ✅ |
| ST-6 Catégories | Réglages : renommer, ajouter, couleur, groupe, suppression avec réaffectation | ✅ |
| ST-7 Rappels | Délai J-n par tâche, rappels dus à l'ouverture (toast groupé) | ✅ (notification Windows : phase 2) |
| ST-8 Suppression | Toast « Annuler » 10 s | ✅ |
| PL-1 · PL-2 · PL-3 | Gantt groupé par catégorie + Non planifiées · Aujourd'hui, zoom, navigation · Clic / Entrée → tiroir, retard sans rouge | ✅ |
| RC-1 → RC-4 | KPI + navigation · petits multiples par catégorie avec objectif · listes · répartitions, taux, courbe d'humeur à trous | ✅ |
| RC-5 Export CSV | `;`, UTF-8 BOM, heures décimales à virgule, sous-totaux par catégorie, sans total | ✅ |
| RC-6 Export PDF | `window.print()` + feuille A4 (`@media print`), une section par catégorie | ✅ (phase 2 : `printToPDF`) |
| TR-5 · TR-6 | Thème clair / sombre / système mémorisé · AA, clavier, focus | ✅ |
| TR-1 → TR-4 | Exe, dossier portable, écriture atomique, verrou : hors maquette (dossier `Donnees-Lamia\` affiché à titre fictif, export / import `.json` fonctionnels) | Phase 2 |
| Could | Raccourci `N` ✅ · recherche globale Ctrl+K, glisser les barres du Gantt, tâches récurrentes, phrases perso | Non faits |

## 8. Pour le développeur (phase 2)

- **Réutilisation** : `design/` est chargé tel quel. Les gabarits HTML de `maquette/js/ui-*.js` se transposent en composants Svelte (mêmes classes) : `ui-dashboard` → `views/Dashboard`, `ui-tasks` → `Taches/Kanban + Liste`, `ui-drawer` → `Detail`, `ui-planning`, `ui-recap`, `ui-settings`, `ui-mood`, `ui-chrono`, `ui-common` (couches, menu, toasts), `ui-charts` (SVG à porter tel quel).
- **Requêtes métier** à reprendre dans `shared/stats.ts` : `L.q` dans `maquette/js/store.js` (heures par catégorie sans total, résumé de période, taux de complétion limité aux échéances déjà passées, contexte `LamiaVoice`, filtres) et `maquette/js/dates.js` (dates locales `YYYY-MM-DD`, semaines ISO, `parseDuration`).
- **Horloge** : `DEMO_TODAY` (dans `dates.js`) devient l'horloge injectable (`LAMIA_FAKE_NOW`). L'heure réelle est conservée pour la voix (matin / midi / soir).
- **Ajouts au modèle de données** proposés : `timer { taskId, startedAt, accumulatedMs, pausedAt }` (la pause) ; `lastTimerTaskId` ; `flags { lastOpenedOn, moodPromptedOn, remindersShownOn }` ; `settings.ui { dashPeriod, recapPeriod, recapAnchor, tasksView, planningZoom, planningAnchor, filters, sort }` ; `settings.reminders.hour` ; `category.color` = identifiant de palette (`flowline`, `carnet`, `auto`, `blue`, `violet`, `periwinkle`, `lilac`, `mint`, `lavender`) traduit en tokens par les classes `.hue--*`.
- **CSP** : la maquette pose `--value`, `--l`, `--w` en attributs `style`. En Svelte, utiliser `style:--value={x}` (CSSOM, compatible `style-src 'self'`) ou assouplir `style-src-attr` comme prévu au §5 de la note d'architecture.
- **Persistance** : `localStorage` ne sert qu'à la démo (clé `lamia.maquette.v1`, try/catch partout). En phase 2, tout passe par `window.lamia.data`.
- **Graphiques** : largeur mesurée au rendu (pas de mise à l'échelle des textes), redessinés au redimensionnement ; pas de `ResizeObserver` (évite l'erreur console « loop completed »).
- **PixelCast** : monter une fois, ne détruire qu'au vrai changement d'échelle (×4 → ×3 sous 640 px) ; `matchMedia` peut émettre des « change » parasites, comparer l'état.
- **Données de démo** : `Lamia.seed()` est déterministe (graine fixe) : idéal comme fixture `data.json` pour les tests e2e.

## 9. Points ouverts et manques constatés dans `design/`

- Les couleurs de catégories Flow Line (`#7FA3FA`) et Carnet (`#B097F7`) ne passent pas le validateur dataviz (ΔE 6,8 en vision normale, 1,4 en protanopie) et l'aqua est sous le contraste 3:1 sur le verre clair : la maquette compense par des libellés partout et des petits multiples, mais le DA pourrait ajouter des teintes « graphique » plus soutenues.
- `pixel-bubble.css` : la police Pixelify Sans forme une ligature « fi » peu lisible ; la maquette pose `font-variant-ligatures: none` dans la scène, à intégrer côté DA.
- Pas de token pour une 4e+ catégorie : la palette réutilise `--blue-500`, `--violet-500`, `--mood-3/4`, `--status-done/todo` avec un fond dérivé par `color-mix` et l'encre `--color-text`.
- Pas de composant « menu contextuel » ni « infobulle de graphique » dans `components.css` (créés dans `app.css`).
- Format des dates des `<input type="date">` : il suit la langue du système (jj/mm/aaaa sous Windows FR) ; non vérifiable ici (navigateur de test en anglais).
