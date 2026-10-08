# Cahier des charges — Plateforme de suivi - Lamia

> Source de vérité commune à toute l'équipe (CEO, DA, UI/UX, Dev, Testeur).
> Rédigé à partir des réponses de Lamia. En cas de doute, ce document prime.

## 1. Contexte

- **Utilisatrice unique** : Lamia, graphiste / web designer.
  - Salariée chez **Flow Line Intégration** (lundi → vendredi, **35 h / semaine**).
  - En **auto-entreprise** le **samedi** (dont le projet **Carnet by-pass**).
- **Besoin** : suivre ses tâches, ses heures, ses échéances et son humeur, pro et perso, dans un outil beau, doux et motivant.
- **Nom du produit** : **Plateforme de suivi - Lamia**
- **Langue** : français uniquement.

## 2. Livrable final et contraintes

- Un **fichier `.exe` Windows portable** : pas d'installation, déplaçable d'un ordinateur à l'autre (clé USB, dossier OneDrive…).
- **Données portables** : stockées dans un dossier **à côté de l'exe**. Déplacer le dossier = déplacer toutes les données.
- **100 % hors ligne** : aucune ressource chargée depuis Internet (polices, scripts, images embarqués).
- Mobile : hors V1 (un .exe ne tourne pas sur téléphone). L'interface reste **responsive** pour préparer une future version mobile ou synchronisée (V2).

## 3. Démarche (validée par Lamia)

1. **Phase 1 — Conception** : brief produit (CEO), charte graphique et pixel art (DA), parcours et **maquette cliquable** (UI/UX), note d'architecture (Dev), recette de la maquette (Testeur).
2. **Validation par Lamia.**
3. **Phase 2 — Développement** de l'application (.exe).
4. **Phase 3 — Tests** et rapport.
5. **V2** (plus tard) : synchronisation multi-appareils, version mobile.

## 4. Identité visuelle (directives de Lamia)

- Tons **blancs**, **bleu pastel**, **violet pastel**, accent **bleu-violet foncé**.
- **Clair, moderne, aéré**, style **liquid glass OPAQUE** : surfaces vitrées laiteuses, très lisibles, avec reflets doux, flou d'arrière-plan et bords lumineux. Pas de verre trop transparent.
- **Typographies** : **General Sans** + **Poppins**.
  - General Sans (Fontshare, licence ITF FFL gratuite) n'est pas téléchargeable depuis notre environnement. On la déclare via `local("General Sans")` (si elle est installée sur le poste de Lamia), avec Poppins en repli. On l'embarquera dans l'exe en phase 2.
  - Poppins et Pixelify Sans (police pixel, OFL) sont disponibles dans `design/fonts/`.
- **Bulles de dialogue en pixel art** (contour pixelisé, petite queue pixel).
- **Mode sombre** demandé, toujours dans les tons bleu et violet.

## 5. Les personnages (dashboard)

Une petite scène pixel art animée. À chaque connexion, les personnages « parlent » dans des bulles pixel.

### Lamia (l'utilisatrice)
- Femme, **peau claire**, **cheveux longs noirs bouclés**, **raie sur le côté**.
- **Yeux noirs**, **lunettes carrées aux coins arrondis, monture rose gold**.
- **Tee-shirt beige**, **jean bleu**, **Converse blanches**.
- Elle dit les **phrases motivantes**, sur un ton qui mélange douceur et humour.

### Memeow (sa chatte)
- **Femelle**, pelage **tricolore tigré** : roux, noir, gris, brun. **Yeux verts**.
- **Ne parle JAMAIS en langage humain** : uniquement des variations de « meew » (« Meew ! », « Meeew meeew… », « Mrrreeew ? », « Meew meew meeew ! »), accompagnées d'une petite icône pixel (cœur, poisson, zZz, croquette, étoile…) qui suggère l'émotion.
- Animations / manies : **dormir sur le clavier**, **se lécher la patte**, **réclamer des croquettes** (gamelle), plus une animation de repos (queue qui bouge, clignement des yeux).

## 6. Fonctionnalités

### 6.1 Onglet « Dashboard » (1er onglet)
- Accueil : « Bonjour Lamia » + date du jour + scène Lamia & Memeow avec leurs bulles.
- Récap **jour / semaine / mois** (sélecteur) : tâches en cours, terminées, à venir.
- Heures de la semaine **par catégorie, séparées** (ex. Flow Line 28 h / 35 h).
- Échéances proches et tâches en retard.
- Chrono en cours (s'il y en a un).
- **Humeur** : à la **première connexion du jour**, on propose de noter l'humeur.

### 6.2 Onglet « Suivi des tâches »
- **Kanban** avec 4 colonnes : **Pas commencé**, **En cours**, **En validation**, **Terminé**. Glisser-déposer entre colonnes.
- **Vue liste / tableau** filtrable et triable.
- **Catégories** par défaut : **Flow Line**, **Carnet by-pass** (projet de l'auto-entreprise), **Auto-entreprise**. On peut les renommer, en ajouter et choisir leur couleur.
- Champ **client / projet** facultatif.
- **Avancement en %** : **curseur manuel** de 0 à 100 % (pas de calcul automatique).
- **Checklist de sous-tâches** (« les tâches à faire » de chaque tâche).
- **Date de début** et **date de fin** (alimentent l'onglet Planning).
- **Heures de travail** : **chrono start/stop** sur une tâche et **saisie manuelle** (date + durée + note). Les entrées sont modifiables.
- **Priorité** (basse, normale, haute, urgente) et **étiquettes libres** (print, web, logo, UI…).
- **Rappels d'échéance** (notification avant la date de fin).

### 6.3 Onglet « Planning »
- **Timeline** (type Gantt) de toutes les tâches, du début à la fin, regroupées par catégorie.
- Repère « aujourd'hui », zoom **semaine / mois**, navigation dans le temps.

### 6.4 Onglet « Récap »
- Tâches de la **journée / semaine / mois** : créées, en cours, terminées, en retard.
- Heures de travail par **jour / semaine / mois**, **séparées par catégorie, jamais additionnées**. Comparaison avec l'objectif (Flow Line : 35 h/sem., 7 h/jour du lundi au vendredi ; perso : le samedi).
- Tâches **à terminer** et tâches **qui arrivent bientôt**.
- **Statistiques et graphiques** : tendances, répartition, taux de complétion, courbe d'humeur.
- **Export** PDF et CSV (heures et statistiques, utile pour la compta de l'auto-entreprise).

### 6.5 Humeur
- **5 niveaux** représentés par des icônes pixel (du plus bas au plus haut), plus une **note facultative**.
- Proposée à la première connexion du jour ; modifiable ensuite.
- Visible en courbe dans le Récap.

### 6.6 Phrases de connexion
- Une **bibliothèque d'environ 100 phrases** pour Lamia, plus des **phrases contextuelles** : lundi, vendredi, samedi perso, nombre d'échéances de la semaine, retards, humeur basse la veille, tâche terminée, objectif d'heures atteint…
- Ton : un **mélange** de douceur bienveillante et d'humour.
- Memeow répond uniquement en « meew » + icône.

## 7. Modèle de données (esquisse partagée)

```ts
Category  { id, name, color, group: 'flowline' | 'auto-entreprise' }
Task      { id, title, description, categoryId, client?, status: 'todo'|'doing'|'review'|'done',
            progress: 0..100, priority: 'low'|'normal'|'high'|'urgent', tags: string[],
            startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD',
            checklist: { id, label, done }[],
            timeEntries: { id, date: 'YYYY-MM-DD', minutes, note?, source: 'timer'|'manual' }[],
            reminder?: { daysBefore }, createdAt, updatedAt, completedAt?, order }
MoodEntry { date: 'YYYY-MM-DD', level: 1..5, note? }
Settings  { theme: 'light'|'dark'|'system',
            schedules: { flowline: { days: [1,2,3,4,5], weeklyHours: 35 },
                         'auto-entreprise': { days: [6], weeklyHours: null } } }
```

## 8. Contrats entre livrables (Phase 1)

Pour que l'équipe puisse travailler en parallèle :

| Fichier | Responsable | Contrat |
|---|---|---|
| `design/tokens.css` | DA | Noms de variables CSS **figés** (on peut ajuster les valeurs, ajouter des tokens, mais ne rien renommer ni supprimer). Mode sombre via `:root[data-theme="dark"]` et `@media (prefers-color-scheme: dark)` protégé par `:root:not([data-theme="light"])`. |
| `design/fonts/` | DA | `@font-face` déclarés dans `design/fonts/fonts.css`. |
| `design/sprites/pixel-cast.js` | DA (pixel art) | Script classique (pas de module ES) qui expose `window.PixelCast` (API ci-dessous). |
| `design/sprites/pixel-bubble.css` | DA (pixel art) | Classe `.pixel-bubble` + variantes `.pixel-bubble--tail-left`, `.pixel-bubble--tail-right`, `.pixel-bubble--tail-bottom`. |
| `design/phrases.js` | CEO | Script classique qui expose `window.LamiaVoice` (API ci-dessous). |
| `maquette/` | UI/UX | Maquette cliquable vanilla HTML/CSS/JS, mêmes contrats. |

### API `window.PixelCast`
```js
const ctrl = PixelCast.mount(canvasEl, 'lamia' | 'memeow', { scale: 4, animation: 'idle' });
ctrl.play('wave');   // change d'animation (retour automatique à 'idle' si l'animation n'est pas en boucle)
ctrl.stop(); ctrl.destroy();
PixelCast.animations           // { lamia: ['idle','wave','cheer','typing'], memeow: ['idle','sleep','lick','hungry','meow'] }
PixelCast.size(characterId)    // { width, height } en pixels « art » (avant scale)
PixelCast.icon(name, scale)    // -> HTMLCanvasElement ; noms : 'mood-1'..'mood-5', 'heart', 'fish', 'zzz', 'kibble', 'star', 'note'
PixelCast.iconDataURL(name, scale) // -> string (data:image/png)
```

### API `window.LamiaVoice`
```js
LamiaVoice.pick(context) // -> { lamia: string, memeow: { text: string, icon: 'heart'|'fish'|'zzz'|'kibble'|'star'|'note' }, memeowAnimation: 'idle'|'sleep'|'lick'|'hungry'|'meow', lamiaAnimation: 'idle'|'wave'|'cheer'|'typing' }
// context = { date: Date, dueThisWeek: number, overdue: number, doneToday: number, doneThisWeek: number,
//             hoursFlowlineWeek: number, moodYesterday?: 1..5, moodToday?: 1..5, firstLoginToday: boolean }
LamiaVoice.phrases // données brutes (pour la phase 2)
```

## 9. Contraintes techniques de la maquette

- **Vanilla HTML/CSS/JS**, sans framework, **sans CDN ni requête réseau** (cible hors ligne).
- Doit s'ouvrir **par double-clic** (`file://`) : pas de `fetch` de fichiers locaux ni de modules ES. Utiliser des `<script src>` classiques.
- Responsive de **1440 px à 390 px** (marges de 16 px sur mobile, pas de défilement horizontal de la page).
- Accessibilité : contraste **WCAG AA**, navigation clavier, focus visible, `prefers-reduced-motion` respecté.
- Données fictives réalistes, datées autour du **jeudi 8 octobre 2026** (semaine du lundi 5 au dimanche 11 octobre 2026).
- Aucun commit git : seul l'orchestrateur commit.

## 10. Décisions de validation (fin de phase 1, 8 octobre 2026)

Lamia a validé la maquette telle quelle (« c'est parfait »). Décisions pour la phase 2 :

| Sujet | Décision |
|---|---|
| Maquette | Validée sans retouche : c'est la référence visuelle et fonctionnelle de l'app. |
| Couleurs des catégories | Inchangées. |
| General Sans | Téléchargée automatiquement depuis Fontshare au moment du build (CI), avec la licence ITF FFL ; repli Poppins si absente. |
| Livraison | **Les deux** : un `.exe` portable unique **et** un ZIP « dossier » (démarrage plus rapide). Doit fonctionner sur n'importe quel PC Windows 10/11 64 bits. |
| PC Flow Line | Test sur le PC pro par Lamia lundi 12 octobre. Un exe similaire y a déjà fonctionné. |
| Données | **En local** : dossier `Donnees-Lamia/` à côté de l'exe (repli dans `%APPDATA%` si le dossier n'est pas accessible en écriture). Pas de cloud pour l'instant. |
| Rappels d'échéance | **Les deux** : dans l'app quand elle est ouverte, et quand elle est fermée (icône dans la zone de notification, option de lancement au démarrage de Windows, notifications Windows). |
| Objectif perso | **4 h minimum le samedi** pour le pôle auto-entreprise (Auto-entreprise + Carnet by-pass). Les heures Flow Line ne sont jamais additionnées aux heures perso. |
| Export CSV | Pas de comptable pour l'instant : format générique lisible dans Excel FR (UTF-8 avec BOM, séparateur `;`, virgule décimale). |
