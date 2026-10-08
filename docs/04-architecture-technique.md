# Architecture technique — Plateforme de suivi - Lamia

> Auteur : Développeur lead · Phase 1 (conception) · 8 octobre 2026
> Références : `docs/00-cahier-des-charges.md` (source de vérité), `docs/01-brief-produit.md` (stories DB-x, ST-x, RC-x, TR-x).
> Ce document fixe la stack, prouve qu'on sait produire l'exe et décrit comment la phase 2 sera construite et testée.

## 0. En bref

- **Stack retenue** : **Electron 44 + electron-builder 26** (cible `portable`), interface en **Svelte 5 + TypeScript + Vite** (via electron-vite), qui importe **tels quels** `design/tokens.css`, `design/components.css`, les polices et les scripts `PixelCast`, `LamiaIcons` et `LamiaVoice`.
- **Spike réussi** : un **exe Windows portable de 91,4 Mo** a été produit **depuis Linux, sans Wine**, en 3 min 25 s, **avec l'icône et les métadonnées** (vérifiées dans le binaire). Playwright pilote l'app Electron, en dev comme en build packagé.
- **Données** dans `Donnees-Lamia/` à côté de l'exe, un seul `data.json` versionné, écritures atomiques, 30 sauvegardes quotidiennes, verrou multi-PC et contrôle de révision contre les conflits OneDrive.
- **Risque n° 1** : l'exe portable **se décompresse à chaque lancement** (environ 320 Mo dans `%TEMP%`), ce qui menace l'objectif TR-1 (ouverture en moins de 3 s). Parade : un écran d'attente Memeow, plus une **variante ZIP « dossier »** au démarrage quasi immédiat. Le choix revient à Lamia.
- **Risque n° 2** : exe **non signé**, donc alerte SmartScreen, et la DSI de Flow Line peut bloquer l'app. On teste un exe « coquille » sur le PC pro dès la 1re semaine de la phase 2.

---

## 1. Choix de la stack

### 1.1 Comparatif Electron et Tauri

| Critère | **Electron 44 + electron-builder 26** | **Tauri 2** |
|---|---|---|
| Taille de l'exe | **91,4 Mo** (mesuré, LZMA), 321 Mo une fois décompressé | ~3 à 10 Mo (binaire Rust + interface embarquée) |
| Démarrage | Cible `portable` : **décompression à chaque lancement** (à mesurer sous Windows, estimé à plusieurs secondes), puis environ 0,4 s jusqu'à l'interface prête (mesuré sous Linux). Variante ZIP « dossier » : pas de décompression | < 1 s, aucune extraction |
| Moteur web | **Chromium embarqué** : rendu identique sur tous les PC (flou `backdrop-filter`, polices, PDF) | **WebView2 du système** (Edge) : présent sur Windows 11 et la plupart des Windows 10, mais sa version varie et il peut être retiré ou bloqué par la DSI. Le runtime « fixe » ajoute environ 180 Mo |
| Build Windows depuis Linux | ✅ **Prouvé** (spike), icône et métadonnées comprises, sans Wine | Documenté comme *expérimental* (`cargo-xwin` + SDK MSVC + NSIS) ; pas de cible « portable » officielle (on livrerait l'exe brut). Non testé : Electron n'a pas bloqué |
| Build en CI `windows-latest` | ✅ standard | ✅ standard (`tauri-action`) |
| Tests e2e | ✅ **Playwright `_electron`** (prouvé, dev et packagé) | WebDriver via `tauri-driver` + `msedgedriver`, plus lourd ; Playwright n'est pas pris en charge nativement |
| Export PDF | ✅ `webContents.printToPDF` (prouvé, A4) | Pas d'API intégrée : code Rust spécifique à WebView2, ou boîte d'impression manuelle |
| Notifications | `Notification` (AppUserModelID à régler, cf. §4.2) | Plugin `notification` |
| Données portables | `PORTABLE_EXECUTABLE_DIR` fourni par le lanceur NSIS (vérifié dans le script généré) | `current_exe()` donne directement le bon dossier |
| Langage côté système | **TypeScript**, le même que l'interface | Rust (nouvelle compétence pour l'équipe) |
| Maturité | Très mature (VS Code, Slack, Figma desktop) ; sécurité à configurer soi-même (cf. §5) | Tauri 2 stable depuis fin 2024, sécurité stricte par défaut |

### 1.2 Recommandation : Electron

1. **Tout est prouvé dans notre environnement** : exe portable, icône, données à côté de l'exe, Playwright, PDF.
2. **Un rendu identique partout** : le « liquid glass » (flou, transparences) et l'export PDF ne dépendent pas du WebView2 présent (ou non) sur le PC de Flow Line.
3. **Un seul langage** (TypeScript) pour l'interface, la logique et le système, donc une équipe plus efficace et des tests unitaires partagés.
4. Le coût est connu : **~90 Mo** (sans gêne sur une clé ou dans OneDrive) et un **démarrage plus lent en exe unique** (cf. §9.4).

**Plan B** : si Lamia exige un exe unique **et** une ouverture en moins de 3 s, et si la mesure sous Windows est mauvaise, on bascule vers Tauri 2, avec un build en CI Windows uniquement et des tests e2e WebDriver. L'interface Svelte se réutilise telle quelle, seul le « main » est à réécrire en Rust.

### 1.3 Framework d'interface : Svelte 5 + TypeScript + Vite

| Option | Pour | Contre |
|---|---|---|
| Vanilla TS | Zéro dépendance, au plus près de la maquette | Kanban, tableau triable, Gantt, formulaires, modales : on réécrirait à la main la synchronisation état ↔ DOM, source de bugs |
| **Svelte 5** ✅ | Gabarits **en HTML** : le balisage de la maquette se recopie presque tel quel ; compilé en JS natif (léger, sans DOM virtuel) ; réactivité simple (`$state`, `$derived`) ; pas d'`eval` (compatible CSP stricte) | Une syntaxe à apprendre (faible) |
| React | Écosystème énorme | JSX (`className`…) qui oblige à réécrire toute la maquette ; plus lourd ; écosystème inutile ici |

**Réutilisation de `design/` sans copie** (source unique, le DA continue de l'éditer) :

- Alias Vite `@design` vers `../design`. Un seul fichier global `src/renderer/styles/app.css` :
  `@import '@design/fonts/fonts.css'; @import '@design/tokens.css'; @import '@design/components.css'; @import '@design/sprites/pixel-bubble.css';` (ordre de `components.css`). `pixel-bubble.css` est prévu au contrat §8 mais pas encore livré. Vite résout les `url()` des polices et les embarque.
- Les composants Svelte **produisent les classes de la maquette** (`<button class="btn btn--primary">`, `<section class="glass card">`, `.chip--flowline`, `.modal`, `.toast`…). Les `<style>` scopés de Svelte ne servent qu'à la mise en page propre à une vue (colonnes du Kanban, grille du Gantt).
- `PixelCast`, `LamiaIcons` et `LamiaVoice` restent des **scripts classiques**. Ils sont importés pour leurs effets de bord (`import '@design/sprites/pixel-cast.js'`), ce qui est compatible : ils sont en `'use strict'` et s'attachent explicitement à `window`. Des types sont déclarés dans `src/renderer/types/design-globals.d.ts`. En repli, on peut les copier dans `public/` et les charger par `<script src>`.
  - `<Icon name>` affiche `LamiaIcons.svg(name)` via `{@html}` (contenu local et statique).
  - L'action Svelte `use:pixelCast={{ character, animation }}` appelle `mount`, puis `destroy`.
  - Le Dashboard passe à `LamiaVoice.pick()` un contexte calculé depuis `data.json`, y compris `daysAway`. La petite mémoire `localStorage` de `phrases.js` (dernières répliques) reste propre à chaque PC : c'est acceptable, car non critique.
- Le thème suit le contrat des tokens : `<html data-theme="light|dark">`, sans attribut pour « système ». Le main aligne `nativeTheme.themeSource` pour que la barre de titre et les barres de défilement Windows suivent.
- Graphiques en **SVG faits main** (barres par catégorie, courbe d'humeur avec des trous) : maîtrise totale des tokens, rendu net en PDF, aucune bibliothèque. Dates : petites fonctions maison testées (§8), ou `date-fns` + locale `fr` si besoin.

---

## 2. Résultats du spike (8 octobre 2026, environ 20 min)

Le code jetable est resté dans le scratchpad (hors dépôt) : fenêtre + preload + `Donnees-Lamia/data.json` ; tout a été nettoyé ensuite. Les extraits utiles sont repris aux §3 et §5.

| Mesure | Résultat |
|---|---|
| Versions | Electron **44.7.0**, electron-builder **26.15.3**, Node 22.22, Playwright 1.56 |
| `npm install` | 11 s (284 paquets). Electron 44 n'a **plus de postinstall** : le binaire est téléchargé au premier `require('electron')` (≈ 4 s ici, 283 Mo une fois décompressé) ; electron-builder télécharge à part le zip Windows (caches : 269 Mo pour Electron, 20 Mo pour NSIS et 7-Zip) |
| **Build `--win portable --x64` depuis Linux, sans Wine** | ✅ **exit 0**. 205 s au 1er build (téléchargements compris), 204 s au 2e (caches chauds) |
| Décomposition du temps | `--win dir` (packaging seul) : **15 s** ; compression LZMA du NSIS : **≈ 190 s** (4 vCPU). Avec `compression: store` : 9 s, mais exe de 336 Mo |
| **Exe produit** | `Plateforme-de-suivi-Lamia-0.0.1-portable.exe`, **91 446 925 octets (91,4 Mo)**, PE32 « Nullsoft self-extracting ». L'app interne (PE32+ x64) occupe **321 Mo** décompressée ; seule la locale `fr.pak` est conservée (`electronLanguages: ["fr"]`) |
| **Icône et métadonnées** | ✅ Contrairement à ce qu'on pensait, `signAndEditExecutable: false` est **inutile** : electron-builder 26 édite les ressources avec **`resedit` (pur JavaScript)**. Les deux exe (lanceur portable et exe interne) contiennent l'icône (ICO 16→256, 6 tailles) et le VERSIONINFO (ProductName, CompanyName, FileVersion…), vérifiés en relisant le binaire. Les lignes « signing with signtool.exe » du journal ne font rien sans certificat |
| `PORTABLE_EXECUTABLE_DIR` | ✅ Vérifié dans le script NSIS généré : `SetEnvironmentVariable("PORTABLE_EXECUTABLE_DIR", $EXEDIR)` (+ `PORTABLE_EXECUTABLE_FILE`). L'app est extraite dans `%TEMP%`, lancée (arguments transmis), puis supprimée à la sortie |
| **Playwright `_electron.launch`** | ✅ Dev : interface prête en 1,15 s ; **build Linux packagé : 0,41 s**. Vérifié : titre, `require` et `process` **absents** du rendu, API exposée limitée à 3 fonctions, `fetch('https://…')` **bloqué**, 2 écritures retrouvées dans `data.json` sur disque, aucun fichier temporaire restant, persistance après relance |
| Repli si dossier inutilisable | ✅ Parent qui n'est pas un dossier (`ENOTDIR`) → repli détecté (dossier `userData`) |
| `printToPDF` A4 | ✅ 51,9 Ko, fond imprimé |
| Notifications | `Notification.isSupported()` = false dans le conteneur Linux (pas de D-Bus) : **non testable ici**, à valider sous Windows |
| Build Linux `dir` (pour les e2e) | 7 s |

**Limites du spike**
- **Aucune exécution sous Windows** (ni Windows ni Wine ici). Restent à mesurer en phase 2, sur le runner et sur les PC de Lamia : temps de décompression, SmartScreen et antivirus, toasts Windows, écriture réelle à côté de l'exe. Le workflow du §7 inclut un *smoke test* Windows pour ça.
- Tauri n'a pas été construit (time-box : Electron n'a pas bloqué).
- Anecdote utile : `fs.mkdirSync(..., { recursive: true })` **boucle à l'infini** sur certains pseudo-systèmes de fichiers (`/proc`) et fige le processus. En phase 2, on crée `Donnees-Lamia` **sans `recursive`**, puisque le dossier de l'exe existe forcément.

---

## 3. Données

### 3.1 Emplacement

Ordre de résolution (dans le main uniquement) :

```ts
function resolveBaseDir(): string {
  if (process.env.LAMIA_DATA_DIR) return process.env.LAMIA_DATA_DIR;              // tests e2e
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR; // exe portable
  if (app.isPackaged) return path.dirname(process.execPath);                       // variante ZIP « dossier »
  return path.join(app.getAppPath(), '.dev-data');                                 // développement
}
```

⚠️ En mode portable, `process.execPath` pointe vers le dossier d'extraction temporaire (`%TEMP%\…`) : il ne faut **jamais** s'en servir pour les données.

```
<dossier de l'exe>\                         (clé USB, OneDrive, Bureau…)
├── Plateforme-de-suivi-Lamia-1.0.0-portable.exe
└── Donnees-Lamia\
    ├── data.json                       ← toutes les données
    ├── verrou.json                     ← présent seulement quand l'app est ouverte
    ├── LISEZ-MOI.txt                   ← « ne pas modifier à la main, déplacer avec l'exe »
    ├── sauvegardes\
    │   ├── data-2026-10-08.json        ← 1 par jour, 30 conservées
    │   ├── avant-migration-v1-2026-10-08T09-12-03.json
    │   ├── avant-import-….json / avant-restauration-….json   (10 de chaque, conservées à part)
    └── exports\                        ← emplacement proposé par défaut pour le PDF, le CSV et le JSON
```

Ne se trouve **pas** dans `Donnees-Lamia` (et c'est voulu) : le cache Chromium, la taille et la position de la fenêtre (propres à chaque écran) et la mémoire anti-répétition de `LamiaVoice`. Tout cela va dans `%APPDATA%\Plateforme de suivi - Lamia\`, sans **aucune donnée métier** : on peut le supprimer sans rien perdre. On n'utilise **jamais** `localStorage` ni IndexedDB pour les données métier.

### 3.2 Format : un seul `data.json` versionné

Volume estimé : environ 500 tâches et 3 000 entrées de temps par an, soit moins de 2 Mo. On réécrit donc le fichier entier à chaque fois : c'est simple, robuste et lisible.

```ts
interface LamiaData {
  schemaVersion: 1;                       // entier, incrémenté à chaque changement de format
  meta: { appVersion: string; createdAt: string; savedAt: string;   // horodatages ISO UTC
          savedBy: string /* nom du PC */; revision: number };      // +1 à chaque écriture
  categories: Category[]; tasks: Task[]; moods: MoodEntry[]; settings: Settings;  // cf. CDC §7
  activeTimer: { taskId: string; startedAt: string /* ISO UTC */; host: string } | null;
  reminderLog: Record<string /* taskId */, string /* endDate déjà notifiée */>;
}
// Ajouts proposés au §7 : Settings.lastOpenedOn ('YYYY-MM-DD', pour la 1re ouverture du jour et daysAway),
// Settings.ui (période du Dashboard, filtres de la liste : « mémorisés » d'après le brief), Settings.reminders { hour: 9 }.
```

Conventions :
- Les dates « calendaires » sont en `'YYYY-MM-DD'` **locales** (jamais `new Date('2026-10-08')`, qui est interprété en UTC). Les instants sont en ISO UTC.
- Les identifiants viennent de `crypto.randomUUID()`.

**Au chargement** :
1. `JSON.parse`.
2. **Validation par schéma** (zod) : en cas d'échec, **aucune écriture**. Un écran de récupération propose de restaurer la dernière sauvegarde valide, et le fichier abîmé est conservé (`data-illisible-<date>.json`) (TR-3).
3. **Migrations** : un tableau `migrations[n]` (vN → vN+1) appliqué en chaîne, précédé d'une copie `avant-migration-vN-…`.
4. **Version plus récente que l'exe** (`schemaVersion` > version supportée, par exemple un vieil exe sur un autre PC) : ouverture en **lecture seule** avec le message « Mettez à jour l'application sur ce PC ».

### 3.3 Écritures atomiques et file d'attente

- Le **rendu envoie chaque modification** au main (IPC, peu coûteux). Le main garde le document en mémoire, le **valide**, puis l'écrit **300 ms après la dernière modification**, une écriture à la fois. Il force l'écriture **immédiatement** pour les actions sensibles (chrono démarré ou arrêté, import) et **de façon synchrone** sur `before-quit`, `session-end` (fermeture de session Windows) et `powerMonitor 'suspend'`.
- Procédure : écrire `data.json.tmp` → `fsync` → `rename` vers `data.json` (code validé par le spike) :

```ts
function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  renameWithRetry(tmp, file); // Windows : EPERM/EBUSY/EACCES possibles (antivirus, OneDrive, indexation)
}                             // → 6 tentatives, de 50 ms à 1,6 s ; si l'échec persiste, on garde en mémoire, on affiche « Enregistrement en attente » et on réessaie
```

- Au démarrage, un `data.json.tmp` orphelin est ignoré puis supprimé si `data.json` est valide ; il est examiné si `data.json` est absent.

### 3.4 Sauvegardes, export et import

- **Sauvegarde quotidienne** : à la première ouverture de chaque jour, `data.json` est copié vers `sauvegardes/data-AAAA-MM-JJ.json`. **30 sont conservées** (brief TR-3) ; les sauvegardes « avant-… » sont gérées à part (10 de chaque).
- **Restauration** (Paramètres) : liste datée avec un résumé (nombre de tâches, d'entrées de temps, d'humeurs). La restauration sauvegarde d'abord l'état courant (`avant-restauration-…`), puis remplace.
- **Export JSON** : le fichier `data.json` tel quel, via la boîte d'enregistrement native.
- **Import** : validation → migration → aperçu (« 124 tâches, 61 humeurs ») → sauvegarde `avant-import-…` → remplacement. La fusion de fichiers est reportée en V2 (synchronisation).

### 3.5 Verrou anti double ouverture et OneDrive

- **Même PC** : `app.requestSingleInstanceLock()`. Une 2e fenêtre ne s'ouvre pas : la première est mise au premier plan.
- **Plusieurs PC** (TR-4) : `verrou.json` contient `{ host: os.hostname(), user, pid, appVersion, openedAt, heartbeatAt }`. Il est créé avec l'option `wx`, rafraîchi **toutes les minutes** et supprimé à la fermeture.
  - Verrou d'un **autre PC** daté de moins de **5 min** → **lecture seule** et bannière « Ouverte sur **PC-FLOWLINE-12** depuis 9 h 02 », avec les actions « Réessayer » et « Forcer l'ouverture » (après confirmation).
  - Verrou périmé, ou venant du même PC (plantage) → reprise, avec un message discret.
- **Contrôle de révision avant chaque écriture**, car le verrou n'est qu'un garde-fou : OneDrive synchronise avec du retard, et un PC hors ligne ne voit pas le verrou de l'autre. Le main compare `mtime`, taille et `meta.revision` du fichier avec la dernière version qu'il a lue ou écrite. Si le fichier a été modifié ailleurs, on **n'écrase pas** : notre version est écrite dans `data-conflit-<PC>-<date>.json`, l'app passe en lecture seule et propose « Recharger ».
- **Copies de conflit OneDrive** (`data-<NomDuPC>.json`) : recherchées à l'ouverture et toutes les 5 min, avec une alerte qui propose de comparer ou de restaurer.
- Conseils à Lamia : régler le dossier sur « Toujours conserver sur cet appareil », attendre la coche verte de synchronisation avant d'ouvrir l'app sur l'autre PC, et toujours « Éjecter » une clé USB (FAT32 et exFAT n'ont pas de journal).

### 3.6 Si le dossier n'est pas accessible en écriture

- Le test se fait par une **vraie écriture** (création puis suppression d'un fichier de test), pas avec `fs.access` (peu fiable avec les ACL Windows).
- **Pas de repli silencieux** vers `%APPDATA%`, qui casserait la promesse « déplacer le dossier = déplacer les données ».
  - Si `data.json` est lisible : **lecture seule**, avec une bannière qui explique (clé protégée en écriture, dossier en lecture seule, exe lancé **depuis un ZIP**…) et propose « Choisir un autre dossier… » ou « Copier mes données vers… ».
  - Si aucune donnée n'existe : écran d'accueil qui demande où créer `Donnees-Lamia` (Documents par défaut).
  - Le dossier choisi est mémorisé **pour ce PC** dans `%APPDATA%\…\config.json`.
- **Lancement depuis un ZIP** (chemin `%TEMP%\Temp1_*.zip\…` ou `….zip\…`) : message dédié « Extrayez d'abord le dossier ».

---

## 4. Fonctions système

### 4.1 Chrono qui survit à la fermeture (ST-5, DB-7)

- On ne stocke que `activeTimer = { taskId, startedAt, host }`, enregistré **immédiatement**. Le temps écoulé vaut toujours `now − startedAt` ; on n'incrémente jamais de compteur. Le chrono survit donc à la fermeture, à un plantage, à la mise en veille, et même au passage sur l'autre PC (avec la mention « démarré sur PC-X »).
- Un seul chrono actif : en démarrer un autre arrête le premier, avec un message.
- **À l'arrêt** :
  - la durée est découpée **par jour local** si le chrono passe minuit (une `timeEntry` par date, `source: 'timer'`) ;
  - au-delà de **10 h** (brief), on propose « Corriger l'heure de fin » ;
  - en option : au réveil d'une veille de plus de 30 min (`powerMonitor 'resume'`), on propose de retirer ce temps.
- Durées calculées **à partir des instants UTC** (justes aux changements d'heure), arrondies à la minute.

### 4.2 Rappels d'échéance et notifications Windows (ST-7)

- Calcul dans le **main** (fonction pure `shared/reminders.ts`) : au démarrage, toutes les 5 min et à l'heure de rappel (9 h par défaut). Une tâche non terminée avec `endDate` et `reminder.daysBefore` est due dès `endDate − daysBefore`. `reminderLog` évite les doublons, même d'un PC à l'autre.
- Affichage : panneau « Rappels » à l'ouverture (toujours fiable), plus `new Notification({ title, body, icon })`. Un clic ramène la fenêtre sur la tâche.
- **Windows** : appeler `app.setAppUserModelId('fr.lamia.plateforme-suivi')` dès le démarrage. D'après la documentation Electron, les toasts n'apparaissent de façon fiable que si un **raccourci du menu Démarrer** porte cet AUMID, or une app portable n'en crée pas.
  - Parade proposée : à la 1re ouverture, **avec l'accord de Lamia**, créer le raccourci (`shell.writeShortcutLink(..., { target: PORTABLE_EXECUTABLE_FILE, appUserModelId })`) dans le menu Démarrer de l'utilisateur, sans droits administrateur. Il est mis à jour si l'exe a bougé.
  - Repli : bannière dans l'app + `win.flashFrame(true)` (la barre des tâches clignote).
  - **À valider sur Windows dès l'incrément ①.**
- Limite : **aucun rappel quand l'app est fermée** (pas de service en arrière-plan sans installation). Options « Could » : réduire dans la zone de notification (`Tray`) au lieu de quitter, et lancement au démarrage de Windows (`app.setLoginItemSettings`, clé HKCU « Run » à mettre à jour si l'exe est déplacé). Décision de Lamia (§10).

### 4.3 Export PDF (RC-6)

- Une fenêtre **cachée** charge `print.html`, une 2e entrée Vite qui reprend les mêmes tokens avec une feuille `@media print` : thème clair forcé, verre aplati (pas de `backdrop-filter`), `@page { size: A4; margin: 14mm }`. Elle reçoit les données de la période par IPC et rend une section par catégorie, **sans total général**, avec les graphiques SVG.
- Puis `webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, footerTemplate: 'Page <span class="pageNumber"></span> / <span class="totalPages"></span>' })`. Le fichier est enregistré via `dialog.showSaveDialog`, avec par défaut `Donnees-Lamia/exports/recap-2026-S41.pdf`. Mécanisme prouvé par le spike.

### 4.4 Export CSV (RC-5)

- Une ligne par entrée de temps : `date ; catégorie ; tâche ; client ; durée (h) ; note`.
- Séparateur `;`, **UTF-8 avec BOM**, fins de ligne CRLF, heures décimales **à virgule** (`1,50`).
- Champs entre guillemets si nécessaire (`"` doublés, `;` et retours à la ligne protégés).
- **Sous-totaux par catégorie, aucun total général**.
- Format de date (`JJ/MM/AAAA` reconnu par Excel FR, ou ISO) et heures décimales ou `hh:mm` : à confirmer avec la comptable (question 5 du brief).
- Génération dans `shared/csv.ts` (testée), écriture par le main.

### 4.5 Polices embarquées

- **Poppins** et **Pixelify Sans** (OFL) sont déjà dans `design/fonts/` et embarquées par Vite.
- **General Sans** (Fontshare, *ITF Free Font License*) : `api.fontshare.com` est bloqué ici, mais accessible depuis un runner GitHub. Deux options :
  - **A (recommandée)** : Lamia télécharge le zip sur fontshare.com et nous le transmet. On ajoute au dépôt les 4 WOFF2 (400, 500, 600, 700) **et le texte de licence**. Les builds sont alors reproductibles et ne dépendent pas de Fontshare.
  - **B** : le script `scripts/fetch-general-sans.mjs` télécharge le zip en CI, vérifie son SHA-256 épinglé et extrait les WOFF2. Un échec fait échouer le build de release : pas de repli silencieux vers Poppins dans une version livrée.
- Dans les deux cas, le DA ajoute `url("GeneralSans-*.woff2")` **avant** `local(...)` dans `fonts.css`, pour un rendu identique sur tous les PC. Le texte de la licence ITF FFL est à relire avant l'embarquement (brief, risques) et sera joint dans `licenses/` avec les licences OFL, Electron et Chromium.

---

## 5. Sécurité (100 % hors ligne)

- **Fenêtre** : `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, pas de `<webview>`. `setWindowOpenHandler` → `deny`, `will-navigate` → `preventDefault` (l'app n'a qu'une page, le routage est interne). Toutes les demandes de permission du rendu sont refusées : les notifications sont émises par le main.
- **Chargement** par un protocole privilégié `app://lamia/` (`protocol.handle`), qui ne sert que les fichiers du dossier `renderer`, avec un contrôle anti-traversée de chemin. Cette pratique est recommandée par Electron, plutôt que `file://`. Le spike a validé `loadFile`, qui reste le repli.
- **Aucune requête réseau** : `session.webRequest.onBeforeRequest` n'autorise que `app:`, `data:`, `blob:` et `devtools:` (+ `http://localhost:5173` en dev seulement). Prouvé par le spike : `fetch` externe → `TypeError`. Pas de `crashReporter`, pas d'autoUpdater. Le correcteur orthographique de Windows est natif et hors ligne.
- **CSP stricte** (en `<meta>`, validée dans le spike, et en en-tête renvoyé par le gestionnaire `app://`) :
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`.
  Si Svelte l'exige (attributs `style` statiques clonés depuis ses gabarits, transitions), on assouplit **les styles seulement** : d'abord `style-src-attr 'unsafe-inline'`, sinon `'unsafe-inline'` sur `style-src`. Le risque est faible sans contenu distant. On ne met jamais `unsafe-eval` ni de script inline.
- **Preload, API minimale en liste blanche** (`window.lamia`) :
  - `app.info()` ;
  - `data.load()` et `data.save(doc)` ;
  - `backup.list()` et `backup.restore(id)` ;
  - `io.exportJson()`, `io.importJson()`, `io.exportCsv(kind, range)` et `io.exportPdf(range)` ;
  - `on(channel, cb)`, limité aux canaux `lock-changed`, `external-change` et `reminder`.
  
  Pas d'`ipcRenderer` brut, pas de chemins arbitraires : les boîtes de dialogue sont ouvertes par le main. Chaque gestionnaire vérifie l'expéditeur (`event.senderFrame.url` en `app://`) et **valide le contenu** (zod).
- **Fuses Electron** (option `electronFuses` d'electron-builder 26, vérifiée dans son schéma) : `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`, `enableEmbeddedAsarIntegrityValidation: true`, `onlyLoadAppFromAsar: true`, `grantFileProtocolExtraPrivileges: false`, et `enableNodeCliInspectArguments: false` **en release seulement**, car Playwright a besoin de `--inspect`.
- Confidentialité : JSON non chiffré en V1 (décision du brief). Pour une clé USB, recommander BitLocker To Go.

---

## 6. Projet : arborescence, scripts et configuration

```
/ (dépôt loumiaaa/claude)
├── design/                         # DA : tokens, composants, polices, sprites, phrases (importés tels quels)
├── maquette/                       # UI/UX : référence visuelle (non embarquée)
├── docs/
├── app/
│   ├── package.json                # versions EXACTES (electron 44.x, electron-builder 26.x…) + package-lock
│   ├── electron.vite.config.ts     # alias @design → ../design ; entrées renderer index.html + print.html
│   ├── electron-builder.config.cjs
│   ├── build/                      # icon.ico (Memeow), splash.bmp (écran d'extraction), licences
│   ├── scripts/fetch-general-sans.mjs
│   ├── src/
│   │   ├── shared/                 # TypeScript PUR (ni DOM ni Node), testé unitairement
│   │   │   ├── model.ts  schema.ts  migrations/
│   │   │   ├── dates.ts            # dates locales, semaines ISO, plages jour/semaine/mois
│   │   │   ├── stats.ts            # heures par catégorie, objectifs, complétion, humeur
│   │   │   ├── timer.ts  duration.ts  reminders.ts  csv.ts
│   │   ├── main/
│   │   │   ├── index.ts            # cycle de vie, fenêtre, sécurité, instance unique
│   │   │   ├── paths.ts  store.ts  backups.ts  lock.ts  ipc.ts
│   │   │   ├── protocol.ts  notifications.ts  export-pdf.ts  smoke.ts
│   │   ├── preload/index.ts        # contextBridge → window.lamia (un seul fichier, sandbox)
│   │   └── renderer/
│   │       ├── index.html  print.html
│   │       ├── main.ts  App.svelte
│   │       ├── styles/app.css      # @import des fichiers de design/ + ajustements propres à l'app
│   │       ├── types/design-globals.d.ts
│   │       ├── lib/                # stores Svelte, client IPC typé, horloge injectable
│   │       ├── components/         # Button, GlassCard, Chip, Modal, Drawer, Toast, Icon, PixelBubble, PixelStage…
│   │       └── views/              # Dashboard, Taches (Kanban, Liste, Detail), Planning, Recap, Parametres
│   └── tests/
│       ├── unit/                   # Vitest
│       └── e2e/                    # Playwright _electron + fixtures data.json
└── .github/workflows/build-windows.yml   # créé en phase 2 (cf. §7)
```

**Scripts npm** (`app/package.json`) :

| Script | Commande | Rôle |
|---|---|---|
| `dev` | `electron-vite dev` | App en développement, rechargement à chaud de l'interface |
| `build` | `electron-vite build` | Compile main, preload et renderer dans `out/` |
| `typecheck` | `svelte-check && tsc --noEmit -p tsconfig.node.json` | Vérifie les types |
| `lint` | `eslint .` | |
| `test` | `vitest run` | Tests unitaires |
| `test:e2e` | `npm run build && cross-env LAMIA_E2E=1 electron-builder --dir && playwright test` | E2E sur l'app packagée (Linux ou Windows), fuses de test |
| `dist:win` | `npm run build && electron-builder --win --x64 --publish never` | **Exe portable + ZIP** |
| `dist:win:fast` | `… -c.compression=store` | Build rapide (9 s au lieu de 190 s), pour les essais |
| `fonts:fetch` | `node scripts/fetch-general-sans.mjs` | Option B des polices |

**`electron-builder.config.cjs`** (essentiel) :

```js
const e2e = process.env.LAMIA_E2E === '1';
module.exports = {
  appId: 'fr.lamia.plateforme-suivi',
  productName: 'Plateforme de suivi - Lamia',
  directories: { output: 'dist', buildResources: 'build' },
  files: ['out/**/*', 'package.json'],
  asar: true,
  electronLanguages: ['fr'],
  compression: 'normal',
  win: {
    target: [{ target: 'portable', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }],
    icon: 'build/icon.ico',                       // icône + VERSIONINFO via resedit : OK même depuis Linux
    artifactName: 'Plateforme-de-suivi-Lamia-${version}-win-x64.${ext}',
  },
  portable: {
    artifactName: 'Plateforme-de-suivi-Lamia-${version}-portable.${ext}',
    requestExecutionLevel: 'user',               // jamais d'UAC
    splashImage: 'build/splash.bmp',             // Memeow pendant l'extraction (BMP)
    // pas de unpackDirName : un dossier temporaire unique par lancement (évite les collisions)
  },
  electronFuses: {
    runAsNode: false, enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: e2e,          // Playwright en a besoin
    enableEmbeddedAsarIntegrityValidation: true, onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },
  linux: { target: ['dir'] },                     // e2e rapides en CI Linux
};
```

**Icône** : le DA fournit `build/icon.ico` (Memeow en pixel art) avec les tailles 16, 24, 32, 48, 64, 128 et 256. **Chaque taille est retouchée ou agrandie au plus proche voisin** : un pixel art ne se réduit pas automatiquement. Il fournit aussi `build/splash.bmp`. La même icône est passée à `BrowserWindow({ icon })`.

---

## 7. Pipeline de build (exemple de workflow, à créer en phase 2)

```yaml
# .github/workflows/build-windows.yml
name: Exe Windows portable
on:
  push:
    tags: ['v*']          # v1.0.0 → release GitHub avec l'exe
  workflow_dispatch:      # build manuel → artefact téléchargeable
permissions:
  contents: write
jobs:
  windows:
    runs-on: windows-latest
    defaults: { run: { working-directory: app } }
    env:
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'   # Electron fournit son propre Chromium
      CSC_IDENTITY_AUTO_DISCOVERY: 'false'    # pas de certificat en V1
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 22, cache: npm, cache-dependency-path: app/package-lock.json }
      - uses: actions/cache@v4
        with:
          path: |
            ~/AppData/Local/electron/Cache
            ~/AppData/Local/electron-builder/Cache
          key: electron-${{ hashFiles('app/package-lock.json') }}
      - run: npm ci
      - run: npm run fonts:fetch        # option B seulement (sinon les WOFF2 sont dans le dépôt)
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: E2E Playwright sur l'app packagée (dossier, fuses de test)
        run: npx electron-builder --win dir --x64 && npx playwright test
        env: { LAMIA_E2E: '1' }
      - name: Exe portable + ZIP (release, fuses verrouillés)
        run: npx electron-builder --win --x64 --publish never
      - name: "Smoke test : données à côté de l'exe + temps d'ouverture"
        shell: pwsh
        run: |
          $usb = New-Item -ItemType Directory -Force "$env:RUNNER_TEMP\cle-usb"
          Copy-Item dist\*-portable.exe $usb
          $exe = (Get-ChildItem $usb -Filter *-portable.exe)[0].FullName
          $t = Measure-Command {
            $p = Start-Process $exe -ArgumentList '--smoke-test' -PassThru
            if (-not $p.WaitForExit(120000)) { $p.Kill(); throw 'délai dépassé' }
          }
          if (-not (Test-Path "$usb\Donnees-Lamia\data.json")) { throw 'data.json absent à côté de l''exe' }
          if (Test-Path "$usb\Donnees-Lamia\verrou.json") { throw 'verrou non libéré' }
          "Ouverture + fermeture (extraction comprise) : $([int]$t.TotalMilliseconds) ms" >> $env:GITHUB_STEP_SUMMARY
      - uses: actions/upload-artifact@v4
        with:
          name: plateforme-suivi-lamia-windows
          path: |
            app/dist/*-portable.exe
            app/dist/*-win-x64.zip
          retention-days: 30
      - if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v2
        with:
          files: |
            app/dist/*-portable.exe
            app/dist/*-win-x64.zip
```

- `--smoke-test` : le main initialise tout (dossier, `data.json`, verrou, sauvegarde), attend `ready-to-show`, libère le verrou et quitte avec le code 0. Le temps mesuré sert à **suivre TR-1 à chaque build**.
- Un job `ubuntu-latest` (typecheck, tests unitaires, e2e sous `xvfb-run` avec `--no-sandbox`) peut tourner en parallèle sur chaque push : il est plus rapide pour les retours.
- En phase 2, épingler les actions par leur SHA. Si le dépôt est public, l'exe et le code le sont aussi : **aucune donnée de Lamia ne passe jamais par le dépôt**.
- Depuis Linux, le même `npm run dist:win` fonctionne aussi (prouvé), ce qui dépanne si GitHub Actions est indisponible.

---

## 8. Stratégie de tests

**Unitaires (Vitest, `src/shared` + `src/main`, objectif ≥ 90 % de couverture sur `shared/`)**, avec une horloge et un nom de PC injectables :
- **Semaines ISO** : 08/10/2026 → **2026-S41** (du lundi 5 au dimanche 11) ; 31/12/2026 et 03/01/2027 → **2026-S53** (2026 compte 53 semaines) ; 04/01/2027 → 2027-S01.
- **Heures par catégorie** par jour, semaine ISO et mois, **jamais additionnées**. On vérifie qu'aucun « total général » n'existe, ni dans l'API ni dans le CSV. Objectif Flow Line : 35 h/semaine et 7 h/jour du lundi au vendredi ; samedi sans objectif.
- **Chrono** :
  - découpage à minuit ;
  - journée de 25 h du **25/10/2026** (passage à l'heure d'hiver) et de 23 h du **28/03/2027** ;
  - alerte au-delà de 10 h ;
  - un seul chrono actif.
- **Saisie des durées** : `1h30`, `1 h 30`, `90`, `1,5`, `1.5`, `0h45` → minutes ; les saisies invalides sont refusées.
- Retards (« à replanifier »), échéances à 7 jours, rappels dus (J-n, pas de doublon, rien pour une tâche terminée), taux de complétion, courbe d'humeur **avec des trous**.
- **CSV** : BOM, `;`, virgule décimale, échappements, sous-totaux.
- **Store** (vrais dossiers temporaires) :
  - écriture atomique : on simule un échec de `rename`, `data.json` doit rester intact ;
  - rotation des 30 sauvegardes ;
  - migrations sur des fichiers d'exemple vN ;
  - fichier illisible → aucune écriture ;
  - `schemaVersion` trop récent → lecture seule ;
  - verrou (autre PC < 5 min, périmé, même PC) ;
  - conflit de révision → copie de conflit.

**End-to-end (Playwright `_electron`, sur l'app packagée)** :
- Lancement avec `LAMIA_DATA_DIR` pointant vers un dossier temporaire et des fichiers `data.json` d'exemple. L'horloge est injectée via `LAMIA_FAKE_NOW`, pris en compte seulement si `LAMIA_E2E=1`. Les boîtes de dialogue sont simulées par `app.evaluate` (stub de `dialog.showSaveDialog`).
- Scénarios (un par story) :
  - 1re ouverture : création de `Donnees-Lamia` et proposition d'humeur (DB-3) ;
  - Kanban : glisser-déposer **et** alternative clavier, ordre conservé après relance (ST-2) ;
  - chrono démarré → app fermée → relancée → toujours actif → arrêté → entrée créée (ST-5) ;
  - Récap par catégorie (RC-2) ;
  - CSV relu et comparé (RC-5) ; PDF commençant par `%PDF` (RC-6) ;
  - fichier corrompu → écran de récupération (TR-3) ;
  - `verrou.json` d'un « AUTRE-PC » → lecture seule (TR-4) ;
  - réseau bloqué (TR-1) ;
  - thème sombre (TR-5) ;
  - **axe-core** sans violation et parcours au clavier (TR-6).
- Exécution sous **Linux** (`xvfb-run`, à chaque push) et sous **Windows** (`win-unpacked`, avant chaque release), plus le *smoke test* de l'exe portable. Le spike donne environ 0,4 s par lancement : la suite restera rapide.
- Le **Testeur** réutilise ce harnais pour la phase 3. La recette manuelle sur les vrais PC (SmartScreen, OneDrive à deux PC, clé USB retirée, toasts, temps d'ouverture) reste indispensable.

---

## 9. Points d'attention pour Lamia

1. **Alerte SmartScreen** (exe non signé, téléchargé depuis GitHub ou reçu par mail) : « Windows a protégé votre ordinateur » → **Informations complémentaires → Exécuter quand même**. On peut aussi faire, avant le 1er lancement, clic droit → Propriétés → cocher **Débloquer**. L'alerte peut revenir **à chaque nouvelle version**. Sur Windows 11, si **Smart App Control** est activé, un exe non signé est **bloqué sans contournement**.
2. **Politique informatique de Flow Line** : AppLocker, WDAC ou les règles ASR de Defender peuvent interdire les exe inconnus ou non signés, ou l'exécution depuis `%TEMP%` (justement là où l'exe portable s'extrait), et les clés USB peuvent être bloquées. Il faut aussi vérifier que la charte autorise ces données (clients Flow Line, humeur) sur OneDrive perso ou sur une clé. → **Exe « coquille » testé sur le PC pro dès la 1re semaine de la phase 2**, et demander à la DSI si besoin (le nom de l'exe et son hash suffisent pour une règle d'autorisation).
3. **Signature de code** (non prévue en V1) :
   - Ce qu'elle apporte : « Éditeur : <nom> » au lieu de « Éditeur inconnu », l'acceptation par Smart App Control et les règles « éditeur » des DSI, moins de faux positifs des antivirus.
   - Ce qu'elle n'apporte **pas** : la disparition immédiate de SmartScreen. Depuis 2024, même un certificat EV ne donne plus de réputation instantanée ; elle se construit avec le nombre de téléchargements, donc lentement pour une seule utilisatrice.
   - Coût indicatif, à vérifier au moment de décider : le service cloud de Microsoft (Trusted Signing, rebaptisé Artifact Signing) **environ 10 $/mois**, si une auto-entrepreneuse française y est éligible ; certificat OV classique **quelques centaines d'euros par an**, clé matérielle ou HSM cloud obligatoire depuis 2023. electron-builder sait signer en CI (`win.azureSignOptions` / `signtoolOptions`).
   - **Avis** : ne pas payer en V1, sauf si la DSI ou Smart App Control l'imposent.
4. **Démarrage de l'exe portable** : chaque lancement décompresse environ 320 Mo dans `%TEMP%`, puis les supprime à la fermeture. Il faut s'attendre à **plusieurs secondes** (à mesurer : antivirus, et surtout depuis une clé USB lente), alors que le brief vise moins de 3 s (TR-1).
   - Parades : écran Memeow pendant l'extraction, mesure à chaque build, option `portable.useZip` à évaluer.
   - Alternative : la **version ZIP « dossier »** (même app, une vingtaine de fichiers à extraire une fois, exe principal dans le dossier). Elle démarre **sans extraction**, et les données restent à côté de l'exe.
5. **Pas de mise à jour automatique** (hors ligne, sans installation) : pour mettre à jour, on remplace l'exe ; les données restent et sont migrées. **Mettre à jour l'exe sur tous les PC** : un ancien exe ouvre des données plus récentes en lecture seule.
6. **Rappels** : affichés seulement quand l'app est ouverte (sauf si Lamia choisit la zone de notification ou le lancement au démarrage). Le mode « Ne pas déranger » de Windows peut masquer les toasts.
7. Divers :
   - environ 100 Mo sur la clé ou dans OneDrive (exe + données + 30 sauvegardes de moins de 1 Mo) ;
   - PC Windows ARM : l'exe x64 tourne en émulation, et un exe arm64 peut être produit au besoin ;
   - si l'affichage pose problème sur un vieux PC ou en bureau à distance, un réglage « désactiver l'accélération graphique » (propre à chaque PC) est prévu.

---

## 10. Décisions à faire valider

**Par Lamia**
1. **Electron** et un exe d'environ **90 Mo** (au lieu d'environ 10 Mo avec Tauri), en échange d'un rendu identique partout, de l'export PDF et de tests automatisés fiables.
2. **Format de livraison** : exe unique portable (plus lent à ouvrir), **ZIP « dossier »** (rapide), ou **les deux** (recommandé : la CI produit les deux).
3. **Signature** : aucune en V1 (procédure SmartScreen expliquée), ou budget de signature si la DSI ou Smart App Control l'exigent.
4. **Rappels quand l'app est fermée** : non (V1 simple), ou zone de notification et/ou lancement au démarrage. Accord pour **créer un raccourci dans le menu Démarrer** (fiabilité des notifications Windows).
5. **General Sans** : Lamia télécharge le zip sur fontshare.com et nous l'envoie (recommandé), ou téléchargement automatique en CI.
6. **Dossier non inscriptible** : lecture seule + choix d'un autre dossier (recommandé), plutôt qu'un repli silencieux sur le PC.
7. **CSV** : format de date et de durée attendu par la comptable.

**Dans l'équipe (à harmoniser)**
- **Nom du dossier de données** : le brief dit `donnees/`, la mission technique `Donnees-Lamia/`. Je recommande **`Donnees-Lamia/`**, plus explicite quand l'exe est posé sur le Bureau, dans Téléchargements ou à la racine de OneDrive, et sans accent. C'est une constante unique dans `paths.ts` ; le CEO tranche.
- **Ajouts au modèle §7** (CEO) : `schemaVersion`, `meta` (dont `revision`), `activeTimer`, `reminderLog`, `Settings.lastOpenedOn`, `Settings.ui` et `Settings.reminders`.
- **DA** : `icon.ico` en tailles multiples retouchées, `splash.bmp`, et l'ajout des `url()` de General Sans dans `fonts.css`.
