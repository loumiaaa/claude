# Architecture technique — Plateforme de suivi - Lamia

> Auteur : Développeur lead · Phase 1 (conception, 8 octobre 2026) puis **phase 2 (développement, 9 octobre 2026)**.
> Références : `docs/00-cahier-des-charges.md` (source de vérité, §10 « Décisions de validation »), `docs/01-brief-produit.md` (stories DB-x, ST-x, RC-x, TR-x), `docs/05-rapport-tests-maquette.md` (recette de la maquette).
> Code : `app/` (mode d'emploi développeur : `app/README.md`). Guide pour Lamia : `docs/06-guide-utilisatrice.md`.

## 0. En bref

- **Stack** : **Electron 44.7.0 + electron-builder 26.15.3**. L'interface est **le code vanilla de la maquette validée** (scripts classiques, sans bundler), branché sur de vraies données. La recommandation Svelte de la phase 1 est abandonnée (décision de l'orchestrateur, §1.3).
- **Livrables** (cibles Windows x64, construits **depuis Linux** et en CI Windows) : `Plateforme-de-suivi-Lamia-0.1.0-portable.exe` (**145,5 Mo**) et `Plateforme-de-suivi-Lamia-0.1.0-win-x64.zip` (**141,5 Mo**, 321 Mo extrait). Build complet : **≈ 2 min 20 s** depuis Linux (4 vCPU, caches chauds).
- **Données** : `Donnees-Lamia/data.json` à côté de l'exe (repli `%APPDATA%` si non inscriptible), `schemaVersion` 2 + migrations, écriture atomique (`.tmp` → `fsync` → renommage), 30 sauvegardes quotidiennes, verrou entre PC avec battement de cœur, contrôle de révision anti-écrasement (OneDrive), export / import `.json`.
- **Système** : instance unique, chrono qui survit à la fermeture, rappels d'échéance (dans l'app + notification Windows + zone de notification + lancement au démarrage), exports CSV et PDF enregistrés par boîte de dialogue, smoke test `--smoke-test`.
- **Qualité** : **69 tests unitaires** (`node --test`) et **22 tests end-to-end** (Playwright `_electron` sur le build Linux), 0 erreur console, 0 requête réseau. Les 18 défauts de la recette de la maquette sont traités (§8.3).
- **Non vérifiable ici** (pas de Windows) : démarrage réel de l'exe portable, SmartScreen, toasts Windows, raccourci du menu Démarrer, lancement au démarrage. La CI exécute un smoke test sur `windows-latest` à chaque push ; le reste est à recetter sur les PC de Lamia (§9).

---

## 1. Choix de la stack

### 1.1 Electron plutôt que Tauri (phase 1, confirmé)

| Critère | **Electron 44 + electron-builder 26** | **Tauri 2** |
|---|---|---|
| Taille | 145 Mo (exe portable zlib) ou 92 Mo (LZMA), 321 Mo décompressé | ~3 à 10 Mo |
| Moteur web | **Chromium embarqué** : rendu identique partout (flou `backdrop-filter`, polices, PDF) | WebView2 du système, version variable, parfois bloqué par la DSI |
| Build Windows depuis Linux | ✅ prouvé (spike puis phase 2), icône et métadonnées comprises, sans Wine | expérimental |
| Tests e2e | ✅ Playwright `_electron` | WebDriver, plus lourd |
| Export PDF | ✅ `webContents.printToPDF` | à coder |
| Données portables | `PORTABLE_EXECUTABLE_DIR` posé par le lanceur NSIS | `current_exe()` |

Le coût (taille, décompression de l'exe portable) est connu et compensé par la **variante ZIP « dossier »** demandée par Lamia (§10 du cahier des charges : « les deux »).

### 1.2 Pourquoi l'interface reste en vanilla (décision de phase 2)

La note de phase 1 proposait Svelte 5 + TypeScript + Vite. **L'orchestrateur a tranché pour reprendre le code de la maquette validée** :
1. Lamia a validé la maquette « telle quelle » : la reprendre garantit un **rendu identique au pixel près** (vérifié par captures, §8.4).
2. Moins de risque et de délai : ~5 000 lignes déjà recettées (le testeur les a vérifiées en détail) ne sont pas réécrites.
3. Pas de bundler : le renderer charge des `<script src>` classiques depuis le protocole `app://`. La CSP reste stricte (aucun script inline ni `eval`).

Ce qui change par rapport à la maquette : la persistance (`window.lamia` au lieu de `localStorage`), l'horloge (vraie date du jour), la logique métier **extraite dans `app/shared/`** (modules UMD testés, partagés avec le main), les exports (main), les Réglages (vrai dossier, sauvegardes, options Windows) et l'objectif perso du samedi.

---

## 2. Résultats du spike de phase 1 (8 octobre 2026)

| Mesure | Résultat |
|---|---|
| Versions | Electron **44.7.0**, electron-builder **26.15.3**, Node 22.22, Playwright 1.56 |
| `npm install` | 11 s (284 paquets). Electron 44 n'a **plus de postinstall** : le binaire est téléchargé au premier `require('electron')` (≈ 4 s, 283 Mo) |
| Build Windows depuis Linux, sans Wine | ✅ exit 0. Icône et VERSIONINFO écrits par `resedit` (pur JavaScript) : `signAndEditExecutable: false` est inutile |
| `PORTABLE_EXECUTABLE_DIR` | ✅ posé par le lanceur NSIS (`$EXEDIR`), ainsi que `PORTABLE_EXECUTABLE_FILE` (`$EXEPATH`). L'app est extraite dans `%TEMP%\<id>` puis supprimée à la sortie ; le code de sortie de l'app est renvoyé (`SetErrorLevel`) |
| Playwright `_electron` | ✅ en dev et sur le build packagé |
| Piège | `fs.mkdirSync(..., { recursive: true })` peut boucler sur certains pseudo-systèmes de fichiers : `Donnees-Lamia` est créé **sans** `recursive` |

---

## 3. Arborescence réelle

```
/ (dépôt loumiaaa/claude)
├── design/                         source unique : tokens, composants, icônes, phrases, polices, sprites
├── maquette/                       référence visuelle validée (non embarquée, intacte)
├── docs/                           00 → 06
├── .github/workflows/build-windows.yml
└── app/
    ├── package.json · package-lock.json · electron-builder.config.cjs · README.md
    ├── main/                       process principal
    │   ├── index.js                cycle de vie, sécurité, instance unique, IPC, exports, smoke test
    │   ├── preload.js              contextBridge → window.lamia (liste blanche)
    │   ├── protocol.js             app://lamia/ (renderer/ + shared/), CSP, anti-traversée
    │   ├── storage.js              DataStore : chargement, migration, écriture atomique, sauvegardes, conflits
    │   ├── lock.js                 verrou.json (battement de cœur 1 min, périmé à 5 min)
    │   ├── datadir.js              choix du dossier de données (pur, testé)
    │   ├── system.js               zone de notification, démarrage, notifications, rappels / 15 min
    │   └── assets/icon.ico|png
    ├── shared/                     logique pure UMD (renderer + main + tests)
    │   ├── dates.js  model.js  stats.js  csv.js  reminders.js  demo.js
    ├── renderer/                   interface (maquette adaptée)
    │   ├── index.html  css/app.css  js/*.js
    │   ├── design/                 copie générée de ../design (ignorée par git)
    │   └── fonts/general-sans/     police téléchargée (ignorée par git)
    ├── scripts/                    sync-design.mjs, fetch-general-sans.mjs, make-icon.mjs, run-e2e.mjs
    ├── tests/unit/                 11 fichiers, 69 tests
    ├── tests/e2e/                  3 fichiers, 22 tests
    └── build/icon.ico              icône de l'exe (16 → 256 px)
```

**`design/` reste la source unique** : `scripts/sync-design.mjs` (lancé avant `start`, `test` et chaque build) le recopie dans `renderer/design/` en écartant les planches HTML et les PNG d'export. Le `fonts.css` de la copie reçoit les `url()` de General Sans **après** les `local()` si la police a été téléchargée ; `design/fonts/fonts.css` n'est jamais modifié.

**Modules partagés (UMD)** : chaque fichier de `shared/` se termine par `module.exports` sous Node et par `window.LamiaShared.<nom>` dans le renderer. `renderer/js/bridge.js` expose `L.dates`, et `L.q` (store) délègue ses requêtes à `stats.js`. Une seule implémentation est donc testée et exécutée partout.

---

## 4. Données

### 4.1 Emplacement (`main/datadir.js`)

Dossier de base, par priorité : `LAMIA_BASE_DIR` (tests) → `PORTABLE_EXECUTABLE_DIR` (exe portable : dossier de l'exe **d'origine**, jamais `%TEMP%`) → dossier de l'exe (ZIP) → `app/.dev-data` (développement). Données : `<base>/Donnees-Lamia`.

Le dossier est testé par une **vraie écriture** (fichier d'essai écrit, `fsync`, supprimé). En cas d'échec : **repli dans `%APPDATA%\Plateforme de suivi - Lamia\Donnees-Lamia`**, bandeau explicatif dans l'app, chemin réel et raison dans les Réglages (dont le cas « exe lancé depuis un ZIP non extrait »). Les Réglages ont un bouton **Ouvrir le dossier**.

```
Donnees-Lamia\
├── data.json          toutes les données
├── verrou.json        présent tant que l'app est ouverte
├── LISEZ-MOI.txt
├── sauvegardes\       data-AAAA-MM-JJ.json (30) + avant-<motif>-<horodatage>.json (10 par motif)
└── exports\           CSV, PDF, .json (dossier proposé par défaut)
```

Hors de `Donnees-Lamia` (propre à chaque PC, dans le dossier utilisateur Electron) : `reglages-pc.json` (zone de notification, démarrage, notifications), `fenetre.json` (taille et position), caches Chromium, mémoire anti-répétition des phrases.

### 4.2 Format (`shared/model.js`)

```js
{
  schemaVersion: 2,
  meta: { appVersion, createdAt, savedAt, savedBy /* nom du PC */, revision /* +1 par écriture */, demo? },
  categories: [{ id, name, color, group: 'flowline' | 'auto-entreprise' }],
  tasks: [{ id, title, description, categoryId, client, status, progress, priority, tags, startDate, endDate,
            checklist: [{ id, label, done }], timeEntries: [{ id, date, minutes, note, source: 'timer' | 'manual' }],
            reminder: { daysBefore } | null, createdAt, updatedAt, completedAt, order }],
  moods: [{ date, level: 1..5, note }],
  settings: {
    theme: 'light' | 'dark' | 'system',
    schedules: { flowline: { days: [1..5], weeklyHours: 35 },
                 'auto-entreprise': { days: [6], weeklyHours: null, minDailyHours: 4 } },   // 4 h minimum le samedi
    reminders: { hour: 9, inApp: true },
    ui: { dashPeriod, recapPeriod, recapAnchor, tasksView, planningZoom, planningAnchor, filters, sort }
  },
  activeTimer: { taskId, startedAt /* ISO */, accumulatedMs, pausedAt /* ISO | null */, host, longAlertAck? } | null,
  lastTimerTaskId, flags: { lastOpenedOn, moodPromptedOn, remindersShownOn },
  reminderLog: { [taskId]: 'AAAA-MM-JJ' }    // dernier jour notifié
}
```

- **Premier lancement** : état vide, 3 catégories par défaut (Flow Line, Carnet by-pass, Auto-entreprise) et les objectifs ci-dessus.
- **Migrations** : `MIGRATIONS[v]` appliquées en chaîne. v1 = export `.json` de la maquette (`version: 1`, chrono `timer` en millisecondes) → v2. Une copie `avant-migration-v1-…` est faite avant d'écrire.
- **Normalisation** (QA-02) : tout document chargé ou importé est complété (catégories vides, catégorie inconnue réaffectée, `tags` / `checklist` / `timeEntries` manquants, `settings` absents…) puis **validé** ; un statut ou une date invalide fait refuser le fichier sans rien modifier.
- **Format plus récent que l'exe** : ouverture en lecture seule (« mets à jour l'application sur ce PC »).
- **Fichier illisible** : aucune écriture ; boîte de dialogue « Restaurer la dernière sauvegarde / Repartir de zéro / Quitter », le fichier abîmé est conservé (`data-illisible-…`). Dans l'interface, si le rendu échoue malgré tout, un écran de récupération propose la même restauration.

### 4.3 Flux des données

```
renderer (L.store)                      preload (window.lamia)                main (DataStore)
──────────────────                      ──────────────────────                ────────────────
boot()  ─────────────────────────────►  app:boot  ──────────────────────────► doc chargé + infos
modification → emit() → 250 ms ──────►  data:save(doc) ──────────────────────► validate → contrôle de révision
chrono, création, humeur → immédiat                                            → écriture atomique (.tmp, fsync, rename)
beforeunload / arrêt → saveSync ─────►  data:save-sync (synchrone)             → { ok, revision, savedAt }
```

- Le renderer garde l'état en mémoire et envoie **le document entier** (moins de 2 Mo attendus par an). Le main le **valide**, vérifie la révision, écrit, et répond.
- **Arrêt** : `before-quit` demande au renderer d'enregistrer (`flushSync`, délai borné à 1,5 s), puis **détruit** la fenêtre sans passer par `beforeunload`. Fermer une fenêtre **cachée** (zone de notification) pouvait sinon bloquer l'arrêt une fois sur quatre (trouvé par les tests e2e).
- **Contrôle de révision** : avant chaque écriture, si `data.json` a changé sur disque (autre PC via OneDrive) et que sa `meta.revision` diffère, notre version part dans `data-conflit-<PC>-<horodatage>.json`, rien n'est écrasé, l'app passe en lecture seule avec « Recharger les données ».

### 4.4 Sauvegardes, export, import, démo

- **Quotidienne** : à l'ouverture (puis toutes les 30 min si l'app reste ouverte plusieurs jours), copie de `data.json` en `sauvegardes/data-AAAA-MM-JJ.json` ; **30 conservées**.
- **Avant toute opération qui remplace les données** : `avant-import-…`, `avant-restauration-…`, `avant-demo-…`, `avant-migration-…` (10 de chaque).
- **Restaurer** (Réglages) : liste datée avec résumé (tâches, entrées, humeurs), copie de l'état actuel, remplacement.
- **Export / import `.json`** : boîtes de dialogue natives ouvertes par le main. L'import montre un aperçu (« 24 tâches, 55 entrées, 26 humeurs ») avant de remplacer.
- **Données de démo** (Réglages → « Charger les données de démo ») : les données fictives de la maquette, **décalées à la date du jour** (identiques à la maquette le 8 octobre 2026), avec confirmation et sauvegarde préalable.

### 4.5 Verrou entre PC et instance unique

- **Même PC** : `app.requestSingleInstanceLock()` ; une 2e ouverture remet la fenêtre existante au premier plan.
- **Plusieurs PC** : `verrou.json` = `{ host, user, pid, appVersion, openedAt, heartbeatAt }`, rafraîchi **chaque minute**, **périmé après 5 min**, supprimé à la fermeture (seulement s'il est toujours à nous). Verrou frais d'un autre PC → **lecture seule** avec un bandeau explicite (« ouverte sur PC-X depuis 9 h 02 ») et les actions **Réessayer** / **Forcer l'ouverture** (avec confirmation). Verrou périmé ou du même PC (plantage) → repris.

---

## 5. Fonctions système

### 5.1 Dates réelles et horloge centrale

`DEMO_TODAY` a disparu. `shared/dates.js` fournit `today()`, `now()`, `nowMs()` à partir de la vraie date, et `setNow()` pour les tests. En e2e (`LAMIA_E2E=1`) ou en développement, `LAMIA_FAKE_NOW` décale l'horloge du main, qui transmet l'instant au renderer au démarrage : le temps continue de s'écouler (le chrono tourne). Les vues se rafraîchissent au passage de minuit ; les ancres de période (Récap, Planning) repartent d'aujourd'hui à chaque ouverture.

### 5.2 Chrono

- `activeTimer` (instants ISO) est enregistré **immédiatement** : le chrono survit à la fermeture, au plantage, à la mise en veille. Le temps affiché vaut toujours `maintenant − startedAt (+ accumulé)`.
- À l'arrêt, la durée est **découpée par jour local** si le chrono a tourné d'une traite par-dessus minuit ; moins de 10 s : rien n'est enregistré (QA-07).
- **Plus de 10 h** : alerte douce « Tu as oublié d'arrêter le chrono ? » (toast avec « Corriger la durée » ou « Il tourne encore »), et lien « Oublié ? Corriger la durée » dans le widget. Le dialogue de correction demande la durée **et le jour travaillé** (par défaut, le jour du démarrage).

### 5.3 Objectif perso du samedi

`stats.persoGoal()` additionne **uniquement** les catégories du pôle auto-entreprise (Auto-entreprise + Carnet by-pass) les jours perso (samedi par défaut) et compare à `minDailyHours` (4 h). Les heures Flow Line n'y entrent jamais, même un samedi ; chaque catégorie garde son propre compteur. Affichage : jauge « Samedi perso : x / 4 h minimum » dans la carte « Heures de la semaine » du Dashboard, et carte pleine largeur « Samedi perso » au Récap (un résultat par samedi de la période). Réglable dans Réglages → Objectifs d'heures.

### 5.4 Rappels d'échéance

- **Calcul** (`shared/reminders.js`) : tâche non terminée avec `endDate` et `reminder.daysBefore` → due de `fin − n` jusqu'au jour de la fin. `reminderLog` garantit **une seule notification par tâche et par jour** (même d'une session à l'autre), complété par un ensemble en mémoire dans le main.
- **App ouverte** : à l'ouverture, toast groupé des rappels du jour (option « Rappel dans l'app », activée par défaut). Puis le main vérifie **toutes les 15 minutes** (et au réveil du PC), à partir de l'heure réglée (9 h par défaut) : toast dans l'app **et** notification Windows si l'option est active ; clic sur la notification → fenêtre et tâche ouvertes ; la barre des tâches clignote si la fenêtre n'a pas le focus.
- **App « fermée »** : option **Fermer dans la zone de notification** (la croix cache la fenêtre ; icône Memeow ; menu **Ouvrir la plateforme / Chrono en cours : … / Quitter**, mis à jour chaque minute) et option **Lancer au démarrage de Windows** (`app.setLoginItemSettings({ openAtLogin, path: PORTABLE_EXECUTABLE_FILE || execPath, args: ['--au-demarrage'] })` : l'exe **d'origine**, jamais la copie de `%TEMP%`). Lancée au démarrage avec la zone de notification active, l'app reste discrète.
- **Notifications Windows** : `app.setAppUserModelId('fr.lamia.plateforme-suivi')` dès le démarrage. Une app portable n'a pas de raccourci : l'option **Activer les notifications Windows** crée `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Plateforme de suivi - Lamia.lnk` (`shell.writeShortcutLink`, avec `appUserModelId`), mis à jour si l'exe a bougé, supprimé si l'option est désactivée. Repli si les notifications ne sont pas disponibles : `tray.displayBalloon`, puis clignotement de la barre des tâches.
- Ces trois options sont **désactivées par défaut** et **propres à chaque PC** (`reglages-pc.json`).

### 5.5 Exports

- **CSV** (`shared/csv.js`, généré par le renderer, enregistré par le main via `dialog.showSaveDialog`) : **UTF-8 avec BOM**, séparateur `;`, CRLF, colonnes `Date;Catégorie;Pôle;Client / projet;Tâche;Durée (h);Durée (hh:mm);Source;Note`, dates JJ/MM/AAAA, heures décimales **à virgule** (`1,50`) et `h:mm` (`1:30`), sous-total par catégorie, **aucun total général**. Les textes commençant par `= + - @` reçoivent une espace (pas de formule involontaire dans Excel).
- **PDF** : le renderer passe en thème clair, puis le main appelle `webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true })` sur la page du Récap (feuille `@media print` de la maquette) et enregistre via la boîte de dialogue. Les deux exports proposent ensuite « Afficher le fichier ».

### 5.6 Polices

Poppins et Pixelify Sans sont dans `design/fonts/`. **General Sans** : `scripts/fetch-general-sans.mjs` télécharge `https://api.fontshare.com/v2/fonts/download/general-sans`, lit l'archive avec un **lecteur ZIP maison** (sans dépendance), vérifie la signature `wOF2` des 4 graisses (400, 500, 600, 700) et **exige la licence** (ITF FFL) avant de tout poser dans `renderer/fonts/general-sans/`. Sans réseau (cas de ce conteneur), il prévient et sort **sans erreur** : l'app garde Poppins (`--strict` pour échouer). En CI, la police est embarquée.

### 5.7 Icône

`scripts/make-icon.mjs` (décodeur et encodeur PNG + conteneur ICO maison) compose la 1re image de `design/sprites/png/memeow-idle.png` sur un **carré arrondi vitré bleu-violet** (dégradé `#B9CCFF → #9C8BF2 → #5B47D0`, reflet laiteux, liseré). Agrandissement **au plus proche voisin** à une échelle entière : Memeow entière de 32 à 256 px (×1, ×2, ×4, ×8), sa tête à 24 et 48 px, réduction au plus proche voisin à 16 px. Sorties : `build/icon.ico` (exe), `main/assets/icon.ico` et `icon.png` (fenêtre, zone de notification, notifications).

---

## 6. Sécurité (100 % hors ligne)

- `BrowserWindow` : `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, DevTools seulement en développement et en e2e, pas de menu.
- **Protocole `app://lamia/`** (`protocol.handle`) : ne sert que `renderer/` et `shared/`, refuse `..`, les antislashs et tout autre hôte ; CSP renvoyée en en-tête et en `<meta>` :
  `default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; … ; base-uri 'none'; form-action 'none'`.
  Seuls les **attributs** `style` (variables CSS `--value`, `--l`, `--w` des gabarits de la maquette) sont autorisés ; jamais de script inline ni d'`eval`.
- **Réseau** : `session.webRequest.onBeforeRequest` annule toute requête hors `app:`, `data:`, `blob:`, `devtools:` (vérifié en e2e : `fetch` et images externes bloqués). Permissions refusées ; `will-navigate` hors `app://`, nouvelles fenêtres et `<webview>` interdits.
- **Preload** : `window.lamia` expose une liste fermée de fonctions (`app`, `data`, `backup`, `io`) et 5 canaux d'événements. Pas d'`ipcRenderer` brut, pas de chemin fourni par l'interface : boîtes de dialogue et accès disque sont faits par le main, qui vérifie que l'expéditeur est `app://lamia/`. « Afficher le fichier » n'accepte que les fichiers que l'app vient d'écrire.
- **Fusibles Electron** (vérifiés dans l'exe) : `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments` (sauf build e2e), `GrantFileProtocolExtraPrivileges` **désactivés** ; `OnlyLoadAppFromAsar` **activé**. L'intégrité ASAR intégrée n'est pas activée tant qu'elle n'a pas été testée sous Windows.

---

## 7. Build et CI

### 7.1 electron-builder (`app/electron-builder.config.cjs`)

- `appId: fr.lamia.plateforme-suivi`, `productName: Plateforme de suivi - Lamia`, version `0.1.0`, `asar: true`, `electronLanguages: ['fr']`, `npmRebuild: false`.
- `files` en **liste blanche** (`main/`, `shared/`, `renderer/`, `package.json`) : ni tests, ni scripts, ni sources de design inutiles (planches HTML, PNG d'export).
- Cibles Windows x64 : `portable` (`Plateforme-de-suivi-Lamia-${version}-portable.exe`, `requestExecutionLevel: user`) et `zip` (`Plateforme-de-suivi-Lamia-${version}-win-x64.zip`). Cible Linux `dir` pour les e2e (avec le binaire Electron installé par npm : `electronDist`).

**Compression : choix et justification.** L'exe portable se décompresse **à chaque lancement** ; c'est le temps qui compte le plus (objectif TR-1 : ouverture en moins de 3 s). Mesures (même machine, 1 cœur, 321 Mo écrits) :

| Exe portable | Taille | Décompression | Build |
|---|---|---|---|
| 7z LZMA (défaut d'electron-builder) | 91,7 Mo | **4,4 s** (archive 7z puis décodage LZMA) | 2 min 37 s |
| **NSIS zlib** (`portable.useZip: true`) ✅ | 145,5 Mo | **2,4 s** | 2 min 17 s |

On retient **zlib** : environ **2 s de gagnées à chaque ouverture** pour 54 Mo de plus sur le disque (OneDrive ou clé, une fois par version). Sur une clé USB 2.0 très lente, la lecture des Mo supplémentaires annule une partie du gain : c'est le cas où la **version ZIP** (aucune décompression au lancement) est la meilleure. Le ZIP garde la compression `normal` (deflate) : il ne se décompresse qu'une fois.

### 7.2 CI GitHub Actions (`.github/workflows/build-windows.yml`)

Déclencheurs : `push` sur `claude/**` et `main`, et `workflow_dispatch` (entrée facultative `version`). Job `build` sur `windows-latest`, Node 22 :
1. `actions/checkout@v4`, `actions/setup-node@v4` (cache npm), cache des binaires Electron et electron-builder ;
2. (release) `npm pkg set version=<version>` après validation du format ;
3. `npm ci` ;
4. **General Sans** (`node scripts/fetch-general-sans.mjs`), avec un avertissement dans le résumé si elle manque ;
5. **tests unitaires** (`npm test`) ;
6. **build** (`npm run build:win`) ;
7. **smoke test Windows** : l'exe portable est copié dans un dossier « clé USB » et le ZIP extrait ; chacun est lancé **deux fois** avec `--smoke-test` (création des données, puis relance) ; on vérifie le code de sortie, `Donnees-Lamia/data.json` à côté de l'exe, le résultat `smoke-test-result.json` et la libération du verrou ; temps de lancement et tailles dans le résumé du job ;
8. **artefacts** `plateforme-suivi-lamia-windows` (`actions/upload-artifact@v4`, 30 jours).

Job `release` (seulement sur `workflow_dispatch` avec une version, `permissions: contents: write`) : télécharge l'artefact et crée la **pré-release `v<version>`** avec les deux fichiers (`softprops/action-gh-release@v2.2.2`, version figée).

`--smoke-test` (main) : pas de fenêtre visible, pas d'instance unique ; vérifie que les données sont à côté de l'exe (pas de repli), charge ou crée `data.json`, prend le verrou, écrit et relit un fichier d'essai, enregistre `data.json` de façon atomique, le relit et le valide, contrôle la sauvegarde du jour, attend que l'interface soit prête (fenêtre cachée), mesure les temps, écrit `Donnees-Lamia/smoke-test-result.json`, libère le verrou et quitte avec **0** ou **1**.

---

## 8. Tests

### 8.1 Unitaires (`npm test`, `node --test`, 69 tests, ~1 s)

| Fichier | Couvre |
|---|---|
| `dates` | semaines ISO (2026-S41, 2026 à 53 semaines, 2027-S01), dates locales, écarts insensibles aux changements d'heure, journées de 25 h / 23 h, horloge simulée, périodes, saisie des durées (« 1h75 » refusé), formats |
| `stats` | heures par catégorie sans total, par pôle sans mélange, objectif Flow Line, **objectif du samedi** (sans Flow Line, atteint, désactivé, plusieurs jours perso, sur un mois), chrono (pause, > 10 h, découpage à minuit), retards, échéances, récap |
| `csv` | BOM, `;`, CRLF, en-tête exact, virgule décimale, h:mm, sous-totaux sans total général, échappements, formules neutralisées |
| `model` | état du premier lancement, migration v1 (vrai export de la maquette) → v2, idempotence, format trop récent ou inconnu, validation, normalisation, **4 variantes d'import incomplet (QA-02)** |
| `reminders` | fenêtre J-n, tâches terminées, une fois par jour, ménage du journal, texte des notifications |
| `datadir` | portable, ZIP, tests, développement, repli `%APPDATA%`, ZIP non extrait, sonde d'écriture |
| `storage` | premier lancement, révision, **écriture atomique** (renommage en échec : `data.json` intact ; EBUSY : nouvelles tentatives), fichier illisible, format trop récent, migration avec copie, **30 sauvegardes**, restauration, **conflit OneDrive** |
| `lock` | décision (autre PC frais / périmé / même PC), battement de cœur, libération, forçage, verrou repris par un autre PC |
| `protocol-demo` | protocole (traversées refusées), CSP, démo identique à la maquette et relative à la date du jour |
| `icon`, `fonts` | ICO (7 tailles PNG), aller-retour PNG ; lecteur ZIP, injection des `url()` sans toucher `design/` |

### 8.2 End-to-end (`npm run test:e2e`, 22 tests, ~30 s)

Playwright `_electron` (installation globale, `NODE_PATH=$(npm root -g)`) sur `dist/linux-unpacked` construit avec le binaire Electron de npm, sous Xvfb, `PORTABLE_EXECUTABLE_DIR` pointant vers un dossier temporaire (comme l'exe portable) et l'horloge au jeudi 8 octobre 2026.
- `app.test.js` : premier lancement vide (fichiers créés, humeur proposée, chemin réel affiché) ; création d'une tâche ; humeur ; **chrono démarré, app fermée, relancée 1 h 30 plus tard, toujours actif, arrêté → entrée de 90 min** ; export **CSV** relu ; export **PDF** (`%PDF-`) ; **aucune requête réseau** ; **verrou d'un « AUTRE-PC » → lecture seule**, rien d'écrit ; démo puis restauration ; **0 erreur console**.
- `features.test.js` : smoke test (code 0, et code 1 si les données ne peuvent pas être à côté de l'exe) ; rappels à l'ouverture une seule fois par jour ; chrono oublié (> 10 h) corrigé ; zone de notification (la croix cache la fenêtre, l'app reste ouverte puis quitte proprement).
- `recette.test.js` : non-régression des défauts de la maquette (§8.3).

### 8.3 Défauts de la recette de la maquette, traités dans l'app

| Défaut | Correction |
|---|---|
| QA-01 (majeur) graphiques du Récap qui débordent entre 1280 et 1440 px | plancher des SVG ramené de 240 à 160 px (libellés en lettres quand c'est étroit) ; test e2e : 0 px de débordement à 1440, 1366, 1300, 1280, 1024 et 390 px |
| QA-02 (majeur) import incomplet qui corrompt les données | validation + normalisation au chargement **et** à l'import (main), aperçu, copie `avant-import`, refus sans rien modifier si invalide, écran de récupération (restaurer la dernière sauvegarde) |
| QA-03 (majeur) focus perdu au clavier | `data-focus-key` stables (▶/Pause, widget et pastille du chrono, tiroir, replanifier, « Modifier » l'humeur, lignes du Dashboard et du Récap) ; replis explicites (tâche voisine après une suppression ou une replanification, sinon titre de l'onglet) |
| QA-04 Gantt du mois coupé | 24 px par jour au lieu de 27 |
| QA-05 « 1h75 » accepté | minutes > 59 et durées > 24 h refusées |
| QA-06 samedi « 0 h sur 0 h — objectif atteint » | « Pas d'objectif ce jour-là » ; carte « Samedi perso : 4 h minimum » |
| QA-07 double-clic sur ▶ / Stop | 2e clic ignoré ; chrono de moins de 10 s non enregistré |
| QA-08 cibles tactiles | 44 px minimum sous 860 px |
| QA-09 mot très long | `overflow-wrap: anywhere` et ellipses |
| QA-10 texte d'accueil la nuit | « La journée est faite » de 18 h à 5 h |
| QA-11 nuit + humeur basse | le cœur (réconfort) l'emporte, Memeow reste endormie (`design/phrases.js`) |
| QA-12 / QA-13 rôles ARIA, repères | cartes et tiroir en `div`, héros sans nom en double, groupe nommé, menu dans `<main>` |
| QA-14 contrastes | compteur de la barre latérale et jours de week-end du Gantt |
| QA-15 états vides sans tâche | « Pas encore de tâche » (Liste, Planning) |
| QA-16 champ vidé | l'ancien titre ou nom revient, avec un message |
| QA-17 infobulle au focus | n'est plus masquée par le défilement que le focus provoque |
| QA-18 Gantt sous la colonne d'étiquettes | fond opaque |

### 8.4 Fidélité visuelle

Captures de l'app packagée (1440 × 900, démo au 8 octobre 2026) comparées à la maquette : Dashboard clair et sombre, Réglages, Récap, Planning, Tâches identiques, aux ajouts près (jauge « Samedi perso », Réglages réels, bandeaux) et à la barre de défilement classique d'Electron.

---

## 9. Points d'attention

**Pour la CI**
- Le smoke test est le **seul passage sous Windows** : surveiller son résumé (temps de lancement de l'exe portable, extraction comprise, et du ZIP).
- Fontshare peut changer d'URL ou de structure d'archive : un avertissement apparaît alors dans le résumé et l'app part avec Poppins.
- Les actions sont épinglées par version (`@v4`, `@v2.2.2`), pas par SHA.
- Les tests e2e ne tournent pas en CI (Playwright n'est pas une dépendance du projet) : les lancer avec `npm run test:e2e` avant une release.

**Pour Lamia** (détails dans `docs/06-guide-utilisatrice.md`)
1. **SmartScreen** au premier lancement de chaque version (exe non signé) : « Informations complémentaires → Exécuter quand même ». La DSI de Flow Line peut bloquer l'exe (ou l'extraction dans `%TEMP%`) : à tester sur le PC pro.
2. **Exe portable ou ZIP** : l'exe se décompresse à chaque ouverture (quelques secondes) ; le ZIP démarre plus vite.
3. **Mise à jour** : remplacer l'exe (ou le dossier) en gardant `Donnees-Lamia` à côté ; mettre à jour sur tous les PC.
4. **Deux PC via OneDrive** : une seule ouverture à la fois (verrou), attendre la synchronisation.
5. **Notifications Windows** : à activer dans les Réglages (raccourci du menu Démarrer) ; le mode « Ne pas déranger » les masque.

**Non vérifié dans ce conteneur** (pas de Windows ni de Wine) : démarrage réel et temps d'ouverture de l'exe portable et du ZIP, comportement de Defender et SmartScreen, toasts Windows et AppUserModelID, raccourci du menu Démarrer, `setLoginItemSettings`, icône dans la zone de notification de Windows, polices General Sans réelles, format des `<input type="date">` sous Windows. Les notifications ne sont pas disponibles dans le conteneur Linux (`Notification.isSupported()` = false) : la voie de repli est utilisée.

## 10. Suites proposées

- Recette sur les PC de Lamia (PC Flow Line lundi 12 octobre) : SmartScreen, temps d'ouverture, notifications, zone de notification, démarrage de Windows.
- Ajouter un job Linux (Xvfb) qui lance les tests e2e en CI.
- Activer l'intégrité ASAR après un essai sous Windows ; envisager la signature de code si la DSI l'exige.
- V2 : synchronisation multi-appareils et version mobile (le renderer est déjà responsive de 390 à 1440 px).
