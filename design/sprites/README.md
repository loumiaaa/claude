# Sprites pixel art : Lamia & Memeow

La petite scène du tableau de bord : Lamia et sa chatte Memeow, leurs animations, les icônes pixel et les bulles de dialogue. Tout fonctionne hors ligne, y compris en `file://`.

| Fichier | Rôle |
|---|---|
| `pixel-cast.js` | Les dessins (grilles de caractères + palettes) et le moteur. Expose `window.PixelCast`. |
| `pixel-bubble.css` | `.pixel-bubble` et ses variantes `--tail-left`, `--tail-right`, `--tail-bottom` (+ `--pop`, `__icon`). |
| `export-png.mjs` | Exporte les sprite sheets PNG (1x et 4x) + JSON façon Aseprite dans `png/`. |
| `png/` | Fichiers générés, à retoucher dans Aseprite ou Photoshop. |
| `preview.html` | Planche de présentation (double-clic pour l'ouvrir). |

## Utilisation

```html
<link rel="stylesheet" href="design/sprites/pixel-bubble.css">
<script src="design/sprites/pixel-cast.js"></script>
<canvas id="lamia"></canvas>
<p class="pixel-bubble pixel-bubble--tail-bottom">Bonjour Lamia !</p>
<script>
  const lamia = PixelCast.mount(document.getElementById('lamia'), 'lamia', { scale: 4, animation: 'idle' });
  lamia.play('wave');   // revient tout seul à 'idle'
  lamia.stop();         // fige l'image courante ; lamia.play() reprend
  lamia.destroy();      // arrête les minuteurs et vide le canvas
</script>
```

- `mount` dimensionne le canvas (`PixelCast.size(id)` × `scale`), rend net avec `imageSmoothingEnabled = false` et `image-rendering: pixelated`, et tient compte du `devicePixelRatio` : un pixel « art » couvre toujours un nombre entier de pixels physiques (à 125 % ou 150 % de zoom Windows, la taille CSS est arrondie au plus proche pour rester nette). Option facultative : `flip: true` (miroir horizontal).
- On peut monter autant d'instances qu'on veut. Remonter sur le même canvas détruit l'instance précédente.
- `prefers-reduced-motion: reduce` : chaque animation devient une image fixe (sa pose `still`). L'animation de repos garde un clignement rare, toutes les 6 à 10 s. Le réglage est suivi en direct.
- **Mode sombre** : `pixel-bubble.css` définit `--pixel-cast-rim`, un liseré clair d'un pixel « art » autour des silhouettes, pour que les cheveux noirs et le pelage noir restent lisibles. On peut le surcharger sur un conteneur (`transparent` le désactive).
- `PixelCast.icon(name, scale)` renvoie un canvas de 16 × `scale` px et `PixelCast.iconDataURL(name, scale)` une image PNG en data URL (pour une `<img class="pixel-bubble__icon">`). Les humeurs `mood-1` à `mood-5` prennent la teinte des tokens `--mood-*` du thème courant (recréez l'icône après un changement de thème).

### Tailles et animations

| Personnage | Taille « art » | Animation | Images | Comportement |
|---|---|---|---|---|
| Lamia | 32 × 48 | `idle` | 8 | boucle : respiration, une boucle de cheveux bouge, clignement |
| | | `wave` | 9 | coucou de la main, puis `idle` |
| | | `cheer` | 7 | bras levés, petits sauts, étincelles, puis `idle` |
| | | `typing` | 9 | dessine un cœur sur sa tablette graphique au stylet, puis `idle` |
| Memeow | 32 × 24 | `idle` | 10 | boucle : queue qui ondule, clignement, oreille qui frémit |
| | | `sleep` | 4 | boucle : en boule sur un clavier, respiration, « z » |
| | | `lick` | 10 | se lèche la patte, puis `idle` |
| | | `hungry` | 5 (× 2) | réclame ses croquettes à côté de sa gamelle vide, puis `idle` |
| | | `meow` | 6 | tête levée, bouche ouverte, puis `idle` |

Icônes 16 × 16 : `mood-1` (épuisée) → `mood-5` (au top), `heart`, `fish`, `zzz`, `kibble`, `star`, `note`.

## Retoucher un sprite dans `pixel-cast.js`

Chaque personnage est décrit par trois blocs, en haut du fichier (le moteur est en bas, il n'y a rien à y toucher).

**1. La palette** : un caractère = une couleur, en `'#RRGGBB'` ou `'#RRGGBBAA'` (avec transparence, comme l'ombre au sol `%`). Changer une valeur recolore tout le personnage, par exemple `g: '#C97A6E'` pour la monture rose gold des lunettes, ou `e: '#7DD35A'` pour les yeux verts de Memeow. Les caractères `.` et `_` sont réservés.

**2. Les calques (`parts`)** : des grilles de texte, une chaîne par ligne, toujours sur **toute la largeur** du personnage (32 caractères). `y` est la ligne où la grille commence, ce qui évite de recopier les lignes vides.

- `.` = rien : on voit le calque du dessous ;
- `_` = gomme : rend le pixel transparent (utile dans un petit calque correctif) ;
- tout autre caractère = la couleur de la palette.

Exemple (les yeux fermés de Lamia, posés sur la tête à partir de la ligne 11) :

```js
blink: { y: 11, rows: [
  '..........ssss....ssss..........',
  '..........seeS....seeS..........',
  '..........ssss....ssss..........'
]},
```

Calques de Lamia : `shadow`, `hairBack` (boucles derrière les épaules), `legs` (jean et Converse), `torso`, `head` (visage, lunettes, boucles de devant), `arms`, `armsWaveA/B`, `armsUp`, `armsTablet`, `pen`, `tablet0`…`tablet4` (le cœur qui se dessine), `curl`, `blink`, `eyesHappy`, `eyesDown`, `mouthOpen`, `mouthFocus`, `sparkA/B`.
Calques de Memeow : `shadow`, `body`, `bodyPaw`, `head`, `tailA/B/C`, `blink`, `eyesUp`, `eyesSquint`, `earTwitch`, `mouthMeow`, `tongue`, `pawUp`, `bowl`, `keyboard`, `sleepBody`, `sleepBodyIn`, `sleepHead`, `sleepTail`, `zA/B/C`.

**3. Les animations** : une image = `[durée en ms, 'calques empilés']`. Le premier calque est au fond. `nom@dx,dy` décale un calque (`head@0,1` : la tête descend d'un pixel pour la respiration ; `body@-3,0` : Memeow se pousse pour laisser la place à la gamelle).

```js
wave: { loop: false, still: 1, frames: [
  [170, 'shadow hairBack legs torso head armsWaveA mouthOpen'],
  [170, 'shadow hairBack legs torso head armsWaveB mouthOpen'],
  ...
]},
```

Options : `loop` (boucle), `next` (animation suivante, `idle` par défaut), `repeat` (nombre de passages avant `next`), `still` (image fixe en mouvement réduit), `blink` (image du clignement rare en mouvement réduit).

Le fichier se vérifie tout seul : un caractère absent de la palette ou un calque inconnu déclenche une erreur claire en console, avec le nom du calque, la ligne et la colonne. Pour voir le résultat, rouvrez `preview.html` et relancez l'export.

## Relancer l'export PNG

Depuis la racine du dépôt (Node 18 ou plus, aucune dépendance) :

```sh
node design/sprites/export-png.mjs                 # -> design/sprites/png/
node design/sprites/export-png.mjs --scale 6       # planches agrandies × 6 au lieu de × 4
node design/sprites/export-png.mjs --out mon-dossier
```

Pour chaque animation, on obtient une planche horizontale `lamia-wave.png` (1x) et `lamia-wave@4x.png`, chacune avec son JSON (`lamia-wave.json`) au format « Array » d'Aseprite : `frames[].frame {x, y, w, h}`, `frames[].duration`, et un `frameTags` qui porte le nom de l'animation (plus `loop`, `next`, `repeat`, `still`). Les icônes sortent une par une (`icon-heart.png`, `icon-heart@4x.png`) et en planche (`icons.png` + `icons.json`). Le dossier `png/` est vidé de ses anciens `.png` et `.json` à chaque export.

## Phase 2 : remplacer par les sprite sheets de Lamia (Aseprite)

1. **Partir des exports** : ouvrir `png/lamia-idle.png` dans Aseprite (*File › Import Sprite Sheet*, type *Horizontal Strip*, cases de 32 × 48 pour Lamia et 32 × 24 pour Memeow), retoucher, régler les durées par image dans la timeline.
2. **Garder les conventions** : mêmes tailles de case, une planche par animation, nommée `<personnage>-<animation>.png`, avec un tag Aseprite au nom de l'animation. On peut agrandir la toile (par exemple 40 × 56) : il suffit de mettre à jour `width` et `height` dans `pixel-cast.js`.
3. **Exporter** : *File › Export Sprite Sheet*, *Layout : Horizontal Strip*, *Output : JSON Data* en *Array*, avec *Tags* coché. On retrouve exactement le format produit par `export-png.mjs`.
4. **Brancher dans le moteur** sans changer l'API : tout le rendu passe par une seule fonction, `frameCanvas(ch, anim, index)`, qui fournit l'image d'une frame. En phase 2, elle découpera la planche PNG selon `frames[index].frame`, et la durée viendra de `frames[index].duration` au lieu des grilles. Comme `fetch` est interdit en `file://`, le JSON sera embarqué dans un petit script (`window.PixelCastSheets = { 'lamia-idle': {...} }`), et le PNG chargé par `<img src>` (ou intégré en base64 au build, comme le fait déjà `maquette/build-standalone.mjs`). `loop`, `next` et `repeat` restent dans `pixel-cast.js` (ou dans les *User Data* du tag Aseprite).
5. Les grilles actuelles peuvent rester comme repli, si une planche manque.
