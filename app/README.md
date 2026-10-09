# Plateforme de suivi - Lamia — application (Electron)

Application de bureau Windows **100 % hors ligne** : un **exe portable** et un **ZIP « dossier »**, données dans `Donnees-Lamia/` à côté de l'exe. L'interface reprend le code vanilla de la maquette validée par Lamia (`../maquette/`), branché sur de vraies données.

Architecture détaillée : [`../docs/04-architecture-technique.md`](../docs/04-architecture-technique.md). Mode d'emploi pour Lamia : [`../docs/06-guide-utilisatrice.md`](../docs/06-guide-utilisatrice.md).

## Arborescence

```
app/
├── package.json · package-lock.json · electron-builder.config.cjs
├── main/            process principal (Node + Electron)
│   ├── index.js     cycle de vie, fenêtre sécurisée, IPC, exports, smoke test
│   ├── preload.js   API en liste blanche : window.lamia
│   ├── protocol.js  protocole app://lamia/ + CSP
│   ├── storage.js   data.json atomique, migrations, sauvegardes, conflits
│   ├── lock.js      verrou entre PC (verrou.json)
│   ├── datadir.js   choix du dossier de données (portable, ZIP, repli %APPDATA%)
│   ├── system.js    zone de notification, démarrage de Windows, notifications, rappels
│   └── assets/      icon.ico, icon.png (fenêtre, zone de notification)
├── shared/          logique PURE, en UMD : require() côté main/tests, <script> côté renderer
│   ├── dates.js     dates locales, semaines ISO, durées, horloge centrale (setNow)
│   ├── model.js     schemaVersion, état vide, validation, normalisation, migrations
│   ├── stats.js     heures par catégorie et par pôle, objectif du samedi, échéances, récap
│   ├── csv.js       export CSV (BOM, « ; », virgule décimale)
│   ├── reminders.js rappels d'échéance (1 par tâche et par jour)
│   └── demo.js      données de démo relatives à la date du jour
├── renderer/        interface (code de la maquette, adapté)
│   ├── index.html · css/app.css · js/*.js
│   ├── design/      COPIE de ../design (générée, ignorée par git)
│   └── fonts/       General Sans téléchargée (générée, ignorée par git)
├── scripts/         sync-design, fetch-general-sans, make-icon, run-e2e
├── tests/unit/      node --test (logique pure + stockage + verrou)
├── tests/e2e/       Playwright _electron sur le build Linux
└── build/icon.ico   icône de l'exe (générée depuis le sprite de Memeow)
```

`../design/` reste la **source unique** des tokens, composants, icônes, phrases et sprites : `npm run sync-design` (lancé automatiquement avant `start`, `test` et les builds) le recopie dans `renderer/design/`. Ne modifiez jamais la copie.

## Développer

Prérequis : Node 22 et npm 10.

```bash
cd app
npm ci                 # installe Electron 44.7.0 et electron-builder 26.15.3
npm start              # lance l'app (données dans app/.dev-data/Donnees-Lamia)
```

Variables utiles :

| Variable | Effet |
|---|---|
| `LAMIA_BASE_DIR=<dossier>` | simule le dossier de l'exe : les données vont dans `<dossier>/Donnees-Lamia` |
| `PORTABLE_EXECUTABLE_DIR=<dossier>` | posée par le lanceur de l'exe portable ; utilisable en test |
| `LAMIA_USER_DATA=<dossier>` | dossier utilisateur Electron isolé (réglages par PC, cache) |
| `LAMIA_FAKE_NOW=2026-10-08T10:00` | date simulée (en développement, ou avec `LAMIA_E2E=1`) |
| `LAMIA_DEBUG=1` | journal du cycle de vie sur la sortie d'erreur |

Le renderer est en **scripts classiques** (pas de bundler) : modifier un fichier puis relancer `npm start` suffit.

## Tester

```bash
npm test               # tests unitaires (node --test), ~1 s
npm run test:e2e       # build Linux puis parcours Playwright _electron (~1 min)
npm run test:e2e -- --no-build    # réutilise dist/linux-unpacked
```

- Les tests e2e utilisent **Playwright installé globalement** (`NODE_PATH=$(npm root -g)`, ajouté automatiquement par `scripts/run-e2e.mjs`) et le **binaire Electron installé par npm** (`electronDist`). Sans écran, ils passent par `xvfb-run`.
- Le build e2e ouvre le fusible d'inspection (`LAMIA_E2E=1`) dont Playwright a besoin ; l'exe livré l'a fermé.

## Builder

```bash
npm run fonts          # General Sans (Fontshare) : échoue proprement sans réseau → repli Poppins
npm run build:win      # dist/Plateforme-de-suivi-Lamia-<version>-portable.exe + -win-x64.zip
npm run icon           # régénère build/icon.ico et main/assets/ depuis le sprite de Memeow
```

Le build Windows fonctionne **depuis Linux** (sans Wine) : icône et métadonnées sont écrites par electron-builder. Compter ~2 min 30 s (compression comprise) et ~300 Mo de cache.

Smoke test de l'exe (fait par la CI sous Windows) :

```
"Plateforme-de-suivi-Lamia-0.1.0-portable.exe" --smoke-test
```

L'app démarre sans fenêtre visible, écrit et relit `Donnees-Lamia/` à côté de l'exe, mesure le démarrage, écrit `Donnees-Lamia/smoke-test-result.json` et quitte avec le code 0 (ou 1).

## CI et release

`.github/workflows/build-windows.yml` (runner `windows-latest`, Node 22) : à chaque push sur `claude/**` et `main`, et à la demande. Étapes : `npm ci`, General Sans, tests unitaires, build, smoke test de l'exe portable et du ZIP, artefacts.

Pour publier une **pré-release** : onglet *Actions* → *Build Windows* → *Run workflow* → saisir la version (ex. `0.1.0`). Le job `release` crée `v0.1.0` avec les deux fichiers.

## Sécurité (rappel)

`contextIsolation`, `sandbox`, pas de `nodeIntegration`, CSP stricte (aucun script inline, ni `eval`, ni réseau), protocole `app://` limité à `renderer/` et `shared/`, toutes les requêtes hors `app:`/`data:`/`blob:` bloquées dans la session, permissions refusées, navigation et nouvelles fenêtres interdites, IPC vérifiant l'expéditeur.
