# Charte graphique — Plateforme de suivi - Lamia

> Livrable du DA, phase 1 (conception). Fichiers de référence :
> `design/tokens.css` (valeurs), `design/components.css` (composants), `design/icons.js` (icônes),
> `design/components-preview.html` (planche de style, à ouvrir par double-clic, bouton clair / sombre en haut à droite).
> En cas de doute, le cahier des charges (`docs/00-cahier-des-charges.md`) prime, puis ce document.

---

## 1. Concept et intention

**« Doux, clair, et vitré. »** L'outil sert tous les jours à une graphiste. Il doit être beau, reposant et motivant, sans jamais devenir décoratif au détriment de la lecture.

- **Un atelier baigné de lumière.** Fond blanc légèrement teinté, traversé de halos bleu pastel (en haut à gauche) et violet pastel (en haut à droite). Tout le reste se pose dessus.
- **Du verre laiteux, pas de la vitre.** Les surfaces sont du *liquid glass* opaque : elles floutent et saturent les couleurs du fond, mais restent assez blanches pour que le texte soit toujours net. On ressent la matière (reflet en haut à gauche, liseré lumineux, ombre violette diffuse) sans jamais deviner ce qu'il y a derrière.
- **Un seul point d'ancrage fort.** L'accent bleu-violet profond (`#3B2F9E`) est réservé à l'action principale, à l'état actif et au focus. Tout le reste est pastel.
- **La couleur code, le libellé informe.** Catégories, statuts, priorités et humeur ont chacun leur couleur, toujours doublée d'un texte (et parfois d'une forme).
- **Une touche de jeu, cadrée.** Le pixel art (Lamia et Memeow) et la police pixel vivent dans leur propre scène vitrée. L'interface, elle, reste nette et contemporaine.

---

## 2. Palette

Toutes les valeurs vivent dans `design/tokens.css`. Les noms sont figés ; seules les valeurs changent entre clair et sombre.

### 2.1 Gammes de base

| Token | Clair | Rôle |
|---|---|---|
| `--white` | `#FFFFFF` | Base des verres, curseurs, pastilles |
| `--blue-50` → `--blue-600` | `#F2F6FF` `#E3ECFF` `#CADBFF` `#A9C3FF` `#85A7F7` `#5F86E8` `#4569D4` | Bleu pastel : fonds, halos, graphiques |
| `--violet-50` → `--violet-600` | `#F6F2FF` `#ECE4FF` `#DCCEFF` `#C3AEFB` `#A68BF0` `#8668E0` `#6A4BD0` | Violet pastel : fonds, halos, graphiques |

`--blue-600` et `--violet-600` ont été ajoutés pour les graphiques et les dégradés.

### 2.2 Accent, surfaces et texte

Les contrastes sont donnés **dans le pire cas** : sur la zone la plus saturée du dégradé de fond, puis sur le verre posé sur cette zone (le calcul tient compte du `saturate(170%)` du verre). Seuil WCAG AA : 4,5:1.

| Token | Clair | Sombre | Rôle | Contraste clair (fond / verre) | Contraste sombre (fond / verre) |
|---|---|---|---|---|---|
| `--accent` | `#3B2F9E` | `#A99CFF` | Action principale, actif, liens, focus | 6,5 / 9,1 | 5,1 / 6,4 |
| `--accent-hover` | `#2F2483` | `#BDB3FF` | Survol de l'accent | — | — |
| `--accent-soft` | `#EAE7FD` | violet 16 % | Fond des boutons doux, badges, icônes de tuiles | accent dessus : 8,3 | accent dessus : 4,8 |
| `--accent-contrast` | `#FFFFFF` | `#14112E` | Texte sur l'accent (bouton primaire) | 10,1 | 7,7 |
| `--color-bg` | `#F5F6FD` | `#0F0D24` | Fond uni (sous le dégradé) | — | — |
| `--color-text` | `#1F1B3D` | `#ECEBFF` | Texte principal | 10,5 / 14,7 | 10,2 / 12,9 |
| `--color-text-muted` | `#57537A` | `#B4B1D6` | Texte secondaire, libellés | 4,6 / 6,5 | 5,8 / 7,4 |
| `--color-text-subtle` | `#66638B` | `#9592BE` | Placeholders, métadonnées | 3,6 / 5,1 | 4,1 / 5,2 |
| `--color-border` / `-strong` | accent 12 % / 22 % | blanc 10 % / 20 % | Filets, contours | — | — |
| `--control-border` *(ajout)* | `#8783AB` | `#7D79A8` | Bord des cases et interrupteurs (non-texte ≥ 3:1) | 3,3 | 3,8 |

`--color-text-subtle` atteint 4,5:1 sur tous les verres et dans les champs, mais pas directement sur le fond nu : ne l'utilisez jamais hors d'une carte.

**Contrôle par script.** 89 couples sont vérifiés dans chaque thème (texte, texte secondaire, accent, succès, alerte et danger sur le fond, sur chaque variante de verre, dans les champs et sur tous les `*-soft`, plus les encres de catégories et de statuts). Les 89 sont conformes en clair comme en sombre. La planche recalcule aussi ces contrastes en direct (section « 01 Palette »).

### 2.3 Sémantique

| Token | Clair | Sombre | Sur son `*-soft` (clair / sombre) |
|---|---|---|---|
| `--success` / `--success-soft` | `#17603F` / `#E2F5EC` | `#6FD3A8` / vert 14 % | 6,7 / 6,3 |
| `--warning` / `--warning-soft` | `#824A08` / `#FDF0DD` | `#F2B766` / ambre 14 % | 6,4 / 6,4 |
| `--danger` / `--danger-soft` | `#9E2645` / `#FCE6EB` | `#F28AA0` / rose 14 % | 6,3 / 5,1 |
| `--danger-contrast` *(ajout)* | `#FFFFFF` | `#2A0D16` | texte sur `--danger` : 7,5 / 7,6 |
| `--info` / `--info-soft` | = accent / accent-soft | idem | 8,3 / 4,8 |

Les trois couleurs sémantiques ont été foncées par rapport aux valeurs de départ, qui échouaient en clair (3,5 à 4,4:1).

---

## 3. Codes couleur métier

Règle d'or : **la couleur ne porte jamais l'information seule.** Il y a toujours un libellé, et pour les priorités une forme.

### 3.1 Catégories

Chaque catégorie a trois tokens : la **couleur** (point, barre, anneau), le **fond doux** (`-soft`) et l'**encre** (`-ink`, texte posé sur le fond doux).

| Catégorie | Couleur | Soft | Ink | Ink / soft (clair · sombre) |
|---|---|---|---|---|
| Flow Line | `#7FA3FA` bleu | `#E3ECFF` | `#2A4BA8` | 6,6 · 7,5 |
| Carnet by-pass | `#B097F7` violet | `#EEE6FF` | `#5B3BB8` | 6,3 · 7,4 |
| Auto-entreprise | `#7CCADF` aqua | `#DFF3F8` | `#1D6679` | 5,7 · 8,6 |

L'aqua de l'auto-entreprise reste dans les tons froids tout en se distinguant nettement des deux autres. Les catégories ajoutées par Lamia (phase 2) suivront le même trio : couleur au choix, `soft` = couleur à environ 15 % sur blanc, `ink` = couleur assombrie jusqu'à 4,5:1 minimum.

### 3.2 Statuts (colonnes du kanban)

| Statut | Couleur | Soft | Ink *(ajout)* | Ink / soft (clair · sombre) |
|---|---|---|---|---|
| Pas commencé (`todo`) | `#A7A4C4` lavande grise | `#EFEEF7` | `#4C4970` | 7,3 · 7,9 |
| En cours (`doing`) | `#6F96F6` bleu | `#E3ECFF` | `#2A4BA8` | 6,6 · 7,6 |
| En validation (`review`) | `#A88BF0` violet | `#EEE6FF` | `#5B3BB8` | 6,3 · 7,6 |
| Terminé (`done`) | `#5FC197` menthe | `#E2F5EC` | `#1B6B4B` | 5,7 · 8,4 |

### 3.3 Priorités

| Priorité | Token | Point | Libellé |
|---|---|---|---|
| Basse | `--prio-low` `#A3A0C0` | **anneau creux** | `--color-text-muted` |
| Normale | `--prio-normal` `#6F92EE` | point plein + halo | `--color-text-muted` |
| Haute | `--prio-high` `#E0922E` | point plein + halo | `--warning` |
| Urgente | `--prio-urgent` `#D9536F` | point + **double halo** | `--danger`, demi-gras |

### 3.4 Humeur (1 → 5)

`--mood-1` `#9F9BBF` (au plus bas, gris lavande) · `--mood-2` `#7FA8F2` (bleu) · `--mood-3` `#8E95F4` (pervenche) · `--mood-4` `#AE8CF5` (lilas) · `--mood-5` `#7C55EC` (violet vif, au top).
C'est une rampe froide → vive, sans rouge, pour ne jamais culpabiliser. Ces couleurs servent à la courbe du Récap et aux pastilles. Les visages eux-mêmes sont les icônes pixel `mood-1` à `mood-5` de `PixelCast`.

---

## 4. Typographie

| Famille | Token | Usage |
|---|---|---|
| **General Sans** (repli Poppins) | `--font-display` | Titres, chiffres (KPI, chrono, heures), titres de cartes et de modales |
| **Poppins** | `--font-body` | Tout le texte courant, les boutons, les champs, les libellés |
| **Pixelify Sans** | `--font-pixel` | **Uniquement** les bulles et l'univers pixel (jamais dans les boutons, menus ou données) |

> **General Sans en phase 2.** Elle n'est pas téléchargeable depuis notre environnement. `fonts/fonts.css` la déclare via `local()` : elle s'affiche si elle est installée sur le poste, sinon Poppins prend le relais sans casser la mise en page. En phase 2, on l'embarquera dans l'exe : fichiers `.woff2` (400, 500, 600, 700) **fournis par Lamia ou récupérés sur Fontshare**, licence **ITF Free Font License (FFL)**, qui autorise l'usage dans une application. On ajoutera alors des `url()` aux `@font-face` existants.

### Échelle

| Rôle | Classe | Taille | Graisse | Interligne | Approche |
|---|---|---|---|---|---|
| Display (« Bonjour Lamia ») | `.display` | 44 (`--fs-display`) | 600 | 1,08 | -0,03em |
| Titre de page | `.h1` | 36 (`--fs-3xl`) | 600 | 1,2 | -0,02em |
| Titre de section | `.h2` | 28 (`--fs-2xl`) | 600 | 1,2 | -0,02em |
| Sous-section, modale | `.h3` | 22 (`--fs-xl`) | 600 | 1,35 | -0,02em |
| Titre de carte | `.h4`, `.card__title` | 18 (`--fs-lg`) | 600 | 1,35 | -0,02em |
| Corps | — | 15 (`--fs-md`) | 400 | 1,55 | 0 |
| Petit, boutons | `.text-sm` | 13 (`--fs-sm`) | 400–600 | 1,35 | 0 |
| Légende, chips, badges | `.text-xs` | 12 (`--fs-xs`) | 500–600 | 1,2 | 0 |
| Surtitre | `.eyebrow` | 12 | 600, capitales | — | +0,08em (`--ls-caps`, ajout) |
| Chiffres | `.num` | selon contexte | 600 | — | chiffres tabulaires |

En dessous de 640 px, `.display` passe à 36 et `.h1` à 28. Aucun texte en dessous de 12 px.

---

## 5. Recette du liquid glass opaque

### Les 5 couches (`.glass`)

1. **Flou + saturation** de ce qui est derrière : `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate))`, soit `blur(24px) saturate(170%)`.
2. **Voile laiteux** : `--glass-bg` = blanc à **76 %** en clair, marine `rgba(30, 27, 66, .78)` en sombre. C'est ce voile qui rend le verre **opaque et lisible**.
3. **Reflet spéculaire** (`::before`) : `--glass-highlight`, une ellipse blanche ancrée en haut à gauche (95 % → 0 sur 62 % de la surface), plus un voile vertical sur le premier tiers.
4. **Bord lumineux** (`::after`) : `--glass-edge`, un dégradé de 1 px masqué, blanc pur en haut à gauche qui s'estompe vers un lilas en bas à droite (comme une lumière qui traverse la tranche), posé sur `--glass-border` (blanc 85 %).
5. **Ombres** `--glass-shadow` : liseré intérieur blanc en haut, filet violet très léger en bas, puis trois ombres portées **violettes** (pas grises) de plus en plus diffuses.

### Variantes

| Classe | Voile (clair) | Usage |
|---|---|---|
| `.glass` | blanc 76 % | Cartes, colonnes du kanban, panneaux, barre latérale |
| `.glass--strong` | blanc 90 % | Premier plan : barre du haut, menus. Modales, panneaux latéraux et toasts l'utilisent d'office |
| `.glass--tint-blue` | `rgba(234, 241, 255, .84)` | Mise en avant douce : chrono en cours, Flow Line |
| `.glass--tint-violet` | `rgba(242, 236, 255, .84)` | Mise en avant douce : humeur, Carnet |
| `.glass--interactive` | blanc 84 % au survol | Carte cliquable : monte de 2 px, ombre `--glass-shadow-hover` |
| `.glass--nested` | blanc 90 %, **sans flou** | Verre posé dans un verre (cartes de tâche dans une colonne). Plus léger à afficher |

### À faire

- Toujours poser le verre sur le **fond en dégradé** (`body`) : c'est lui qui donne la matière.
- Un seul niveau de flou : dans un verre, utiliser `.glass--nested`.
- Les rayons larges vont avec le verre : `--radius-lg` (24) pour les cartes, `--radius-xl` (32) pour les modales et panneaux.
- Mettre le défilement dans un enfant (`.modal__body`, `.drawer__body`), pas sur l'élément vitré.

### À éviter

- Descendre sous 70 % d'opacité du voile, ou ajouter du texte sur un verre posé sur une photo ou un motif chargé.
- Empiler deux `backdrop-filter` (coûteux, et le texte perd en netteté).
- Utiliser `::before` / `::after` sur un élément `.glass` (ils portent le reflet et le bord), ou `overflow: hidden` (il rogne le bord lumineux).
- Les ombres grises ou noires en clair : elles salissent le pastel.
- Placer une modale, un panneau ou un toast **dans** un élément vitré : `backdrop-filter` en ferait leur bloc conteneur. Ils doivent être des enfants directs de `<body>`.

---

## 6. Espacements, rayons, ombres

- **Espacements** (base 4) : `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 · `-10` 40 · `-12` 48 · `-16` 64.
  Intérieur de carte : 24 (20 sous 640 px). Écart entre cartes : 24. Entre sections : 48 à 64. Marge latérale mobile : 16 (`--gutter-mobile`).
- **Hauteurs de contrôles** *(ajout)* : `--control-sm` 32 · `--control-md` 40 · `--control-lg` 48. **Icônes** *(ajout)* : `--icon-sm` 16 · `--icon-md` 20 · `--icon-lg` 24.
- **Rayons** : `--radius-xs` 8 (tags, infobulles) · `-sm` 12 (champs, éléments de navigation) · `-md` 16 (verre imbriqué, toasts) · `-lg` 24 (cartes) · `-xl` 32 (modales, panneaux) · `-pill` (boutons, chips, segmentés, barres).
- **Ombres** : toujours teintées de l'accent en clair, noires en sombre.
  `--shadow-sm` (petits éléments surélevés) · `--shadow-md` (curseurs, infobulles, toasts) · `--shadow-lg` (modales, panneaux) · `--glass-shadow` / `-hover` (verre) · `--accent-shadow` *(ajout)* (halo coloré du bouton primaire).

---

## 7. Iconographie

- `design/icons.js` expose `window.LamiaIcons` (script classique, fonctionne en `file://`) :
  `LamiaIcons.svg(name, { size, className, title })` renvoie une chaîne SVG, `LamiaIcons.list` donne les **61 noms**, `LamiaIcons.has(name)` vérifie un nom, et `LamiaIcons.hydrate(root)` remplace chaque `<span data-icon="nom">`.
- **Style** : grille 24 × 24, trait **1,75 px**, extrémités et angles arrondis, `stroke="currentColor"` (l'icône prend la couleur du texte), zone utile d'environ 3 → 21. Toutes les icônes sont dessinées pour le projet ; quelques points pleins (listes, poignée, « plus ») apportent du rythme.
- **Tailles** : 16 (petits boutons, chips), 20 (par défaut : navigation, boutons), 24 (titres, états vides), 32 (illustrations). Dans un composant, le CSS impose la taille.
- **Accessibilité** : sans `title`, l'icône est décorative (`aria-hidden`). Un bouton qui n'a qu'une icône porte un `aria-label`.
- **Correspondance avec les onglets** : Dashboard `dashboard` · Suivi des tâches `tasks` (alias `kanban`) · Planning `planning` · Récap `recap` · Réglages `settings`. Chrono : `play`, `pause`, `stop`, `timer`. Glisser-déposer : `grip`. Memeow : `cat`.

---

## 8. Mouvement

- **Courbes** : `--ease-out` (entrées, survols), `--ease-in-out` (boucles), `--ease-spring` *(ajout)* (petit rebond pour la coche et l'interrupteur).
- **Durées** : `--dur-fast` 140 ms (appui), `--dur-base` 220 ms (survol, changement d'état), `--dur-slow` 400 ms (modale, panneau, toast, barres).
- **Gestes** : les boutons montent de 1 px au survol et s'enfoncent (×0,98) à l'appui. Les cartes interactives montent de 2 px. Les modales arrivent par un fondu avec une légère montée et un zoom de 0,97 → 1, les panneaux glissent de 32 px, les toasts montent de 12 px. Les squelettes scintillent en 1,6 s.
- **`prefers-reduced-motion`** : animations et transitions ramenées à 1 ms, aucun déplacement au survol, scintillement des squelettes coupé. Les animations pixel art (PixelCast) devront aussi s'arrêter sur leur pose de repos.

---

## 9. Pixel art dans l'interface

- La scène (Lamia, Memeow, bulles) vit dans une **`.pixel-stage`** posée dans une carte vitrée : fond `--gradient-soft`, léger creux intérieur, « sol » suggéré par un dégradé accent à 8 %, sprites alignés en bas.
- **Échelles entières uniquement** : ×2, ×3, ×4 (par défaut), ×6. On fixe la taille CSS du canvas à `largeur × échelle` px ; jamais de taille en %.
- **Rendu net** : `image-rendering: pixelated` (classe `.pixelated`, automatique dans `.pixel-stage`, `.avatar` et `.empty-state__art`).
- **Pas d'effets sur les sprites** : ni flou, ni ombre portée, ni dégradé, ni lissage. Le verre est autour de la scène, jamais dessus.
- **Police pixel** (Pixelify Sans) : uniquement dans les bulles (`.pixel-bubble`, fournie par le DA pixel art) et la scène.
- Un sprite peut servir d'avatar (`.avatar--xl` avec un `<canvas>`) ou d'illustration d'état vide (`.empty-state__art`).

---

## 10. Mode sombre

- **Même ADN** : une nuit bleu-violet (`#0F0D24`) avec des halos bleu et violet, un verre marine laiteux (78 %), un accent qui s'éclaircit en lavande `#A99CFF` avec un texte foncé `#14112E` sur les boutons primaires.
- Les fonds doux (`*-soft`) deviennent des voiles colorés translucides (14 à 18 %), et les encres (`*-ink`) des pastels clairs.
- Les ombres deviennent noires et plus profondes, le reflet spéculaire descend à 10 % et le bord lumineux à 30 %.
- **Mécanique** (contrat figé) : `@media (prefers-color-scheme: dark)` avec `:root:not([data-theme="light"])`, puis `:root[data-theme="dark"]`. Les deux blocs sont **strictement identiques**. Si on modifie l'un, on recopie l'autre (`data-theme="light"`, `"dark"` ou absent pour suivre le système).

---

## 11. Utilisation (pour l'UI/UX et le développement)

```html
<link rel="stylesheet" href="../design/fonts/fonts.css">
<link rel="stylesheet" href="../design/tokens.css">
<link rel="stylesheet" href="../design/components.css">
<script src="../design/icons.js"></script>
```

- Le **sommaire des classes** (l'API) est en tête de `components.css`. Exemples de balisage : `components-preview.html`.
- Classes en BEM (`bloc__élément--variante`). Les états passent par l'**ARIA** : `aria-current="page"` (navigation), `aria-pressed` (segmentés, filtres, boutons bascule), `aria-selected` (onglets), ou `.is-active`.
- **Valeurs dynamiques** : `.progress`, `.ring` et `.range` lisent `--value` (0 → 100) en style en ligne. Pour `.range`, une ligne de JS met la valeur à jour au déplacement :
  `input.addEventListener('input', () => input.style.setProperty('--value', input.value))`.
- **Case de checklist** : `<label class="checkbox checkbox--strike"><input class="checkbox__input" type="checkbox"><span class="checkbox__box" aria-hidden="true"></span><span class="checkbox__label">…</span></label>`. La structure est la même pour `.switch` (`switch__input` avec `role="switch"`, `switch__track`, `switch__label`).
- Aucune couleur en dur dans les pages : uniquement des `var(--…)`. Si un besoin manque, on ajoute un token (sans renommer les existants).

### Tokens ajoutés en phase 1 (DA)

`--blue-600`, `--violet-600`, `--accent-gradient`, `--accent-gradient-hover`, `--accent-shadow`, `--gradient-progress` (+ `-start`, `-end`), `--gradient-soft`, `--color-hover`, `--color-pressed`, `--color-track`, `--color-raised`, `--color-inverse-bg`, `--color-inverse-text`, `--color-selection`, `--control-border`, `--input-bg`, `--input-bg-hover`, `--input-shadow`, `--glass-edge`, `--glass-bg-hover`, `--glass-blur-overlay`, `--status-*-ink` (×4), `--danger-contrast`, `--ls-caps`, `--control-sm`/`-md`/`-lg`, `--icon-sm`/`-md`/`-lg`, `--focus-color`, `--ease-spring`, `--z-tooltip`.

### Valeurs modifiées

Dégradé de fond (clair et sombre, plus présent), `--color-bg`, `--color-border-strong`, `--color-text-muted`, `--color-text-subtle`, `--accent-soft`, `--glass-bg` (0,78 → 0,76), `--glass-bg-tint-*`, `--glass-border`, `--glass-saturate` (160 → 170 %), `--glass-highlight`, `--glass-shadow`, `--glass-shadow-hover`, `--cat-auto-soft`/`-ink`, `--success`, `--warning`, `--danger`, `--prio-*`, `--mood-*`, `--shadow-md`, `--shadow-lg`. En sombre, ajout de valeurs pour `--status-*`, `--prio-*` et `--mood-*`.
