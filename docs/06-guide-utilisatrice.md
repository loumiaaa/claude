# Guide d'utilisation — Plateforme de suivi - Lamia

> Pour toi, Lamia. Tout ce qu'il faut savoir pour installer (enfin… poser !), mettre à jour et garder tes données au chaud. Version 0.1.0, octobre 2026.

## 1. Ce que tu reçois

L'application existe en **deux versions**. Ce sont exactement la même app et les mêmes données :

| Fichier | C'est quoi ? | Pour qui ? |
|---|---|---|
| `Plateforme-de-suivi-Lamia-0.1.0-portable.exe` | **Un seul fichier** (environ 145 Mo). Tu double-cliques, c'est parti. | Le plus simple à copier sur une clé USB ou dans OneDrive. |
| `Plateforme-de-suivi-Lamia-0.1.0-win-x64.zip` | **Un dossier** à extraire une fois (environ 140 Mo). | Démarrage plus rapide au quotidien. |

Rien à installer, aucun droit administrateur, **aucune connexion Internet** : tout fonctionne hors ligne. Il faut Windows 10 ou 11, en 64 bits.

> **Lequel choisir ?** L'exe unique se décompresse dans un dossier temporaire à chaque ouverture : il met donc quelques secondes de plus à démarrer. Pour un usage de tous les jours sur le même PC, **le ZIP est le plus agréable**. Pour emporter l'app partout dans un seul fichier, l'exe portable est parfait. Tu peux même garder les deux : ils partagent le même dossier de données s'ils sont posés au même endroit.

## 2. Télécharger l'application depuis GitHub

**Version publiée (recommandé)**
1. Ouvre la page du projet sur GitHub, puis **Releases** (colonne de droite).
2. Choisis la dernière version (par exemple `v0.1.0`, marquée « Pre-release »).
3. Dans **Assets**, télécharge l'exe portable, le ZIP, ou les deux.

**Dernière version de travail (artefacts)**
1. Onglet **Actions** → workflow **Build Windows** → clique sur l'exécution la plus récente (coche verte).
2. En bas de la page, section **Artifacts** : télécharge `plateforme-suivi-lamia-windows`. C'est un ZIP qui contient les deux fichiers (il faut être connectée à GitHub ; ils restent disponibles 30 jours).

## 3. Premier lancement

1. **Choisis où vivra l'application** : par exemple `Documents\Plateforme de suivi\`, ton dossier OneDrive, ou une clé USB. Crée un dossier rien que pour elle.
2. **Exe portable** : copie l'exe dans ce dossier. **ZIP** : clic droit sur le ZIP → **Extraire tout…** → choisis ce dossier. Ne lance pas l'app directement depuis le ZIP sans l'extraire.
3. Double-clique sur l'exe (pour le ZIP : `Plateforme de suivi - Lamia.exe`).

### L'alerte « Windows a protégé votre ordinateur » (SmartScreen)

L'application n'est pas signée par un certificat payant : Windows ne la connaît pas encore et affiche un écran bleu au premier lancement (et parfois après chaque mise à jour). C'est normal.

1. Clique sur **Informations complémentaires**.
2. Clique sur **Exécuter quand même**.

Astuce : avant le premier lancement, tu peux aussi faire clic droit sur l'exe → **Propriétés** → cocher **Débloquer** (en bas) → **OK**.

> Sur le **PC de Flow Line**, le service informatique peut bloquer les applications inconnues. Si le bouton « Exécuter quand même » n'apparaît pas, c'est une règle de l'entreprise : il faudra leur demander l'autorisation (le nom du fichier suffit souvent).

### À l'ouverture

L'application démarre **vide**, avec tes trois catégories (Flow Line, Carnet by-pass, Auto-entreprise) et tes objectifs : **35 h** par semaine pour Flow Line (7 h par jour du lundi au vendredi) et **4 h minimum le samedi** pour le pôle perso (Carnet by-pass et Auto-entreprise réunis). Les heures Flow Line ne sont jamais additionnées aux heures perso.

Envie de voir à quoi elle ressemble bien remplie ? **Réglages → Découvrir l'application → Charger les données de démo**. Tes données actuelles sont sauvegardées juste avant, et tu peux revenir en arrière avec **Restaurer…**.

## 4. Où sont tes données ?

Juste **à côté de l'exe**, dans un dossier `Donnees-Lamia` :

```
Plateforme de suivi\
├── Plateforme-de-suivi-Lamia-0.1.0-portable.exe   (ou le dossier extrait du ZIP)
└── Donnees-Lamia\
    ├── data.json        ← toutes tes tâches, heures, humeurs et réglages
    ├── sauvegardes\     ← une copie par jour (30 jours)
    ├── exports\         ← tes CSV, PDF et sauvegardes .json, proposés ici par défaut
    ├── verrou.json      ← présent seulement quand l'app est ouverte
    └── LISEZ-MOI.txt
```

- **Réglages → Dossier de données** affiche le chemin exact, avec un bouton **Ouvrir le dossier**.
- Tout est enregistré **automatiquement**, à chaque modification. Il n'y a pas de bouton « Enregistrer ».
- Ne modifie pas `data.json` à la main.
- Si le dossier de l'exe n'est pas accessible en écriture (clé protégée, dossier en lecture seule…), l'application range tes données dans ton profil Windows (`%APPDATA%\Plateforme de suivi - Lamia\Donnees-Lamia`) et te le signale par un bandeau. Le chemin réel reste affiché dans les Réglages.

## 5. Mettre à jour sans perdre tes données

1. **Ferme l'application** (si elle est dans la zone de notification : clic droit sur l'icône → **Quitter**).
2. Télécharge la nouvelle version.
3. **Exe portable** : remplace l'ancien exe par le nouveau, **dans le même dossier**. Tu peux supprimer l'ancien.
   **ZIP** : extrais le nouveau ZIP **au même endroit** et accepte de remplacer les fichiers. Le dossier `Donnees-Lamia` n'est pas dans le ZIP : il n'est jamais touché.
4. **Garde toujours `Donnees-Lamia` à côté de l'exe.** C'est tout !

Au premier lancement de la nouvelle version, tes données sont reprises telles quelles (et converties si le format a évolué, avec une copie de sécurité avant). Si tu utilises l'app sur deux PC, mets-la à jour sur les deux : une ancienne version ouvre des données plus récentes en **lecture seule**, pour ne rien abîmer.

## 6. Sauvegardes et restauration

- **Chaque jour**, à la première ouverture, une copie de tes données est rangée dans `Donnees-Lamia\sauvegardes\` (`data-AAAA-MM-JJ.json`). Les **30 dernières** sont conservées.
- Avant toute opération qui remplace tes données (import, restauration, démo, mise à jour du format), une copie « avant-… » est faite en plus.
- **Restaurer** : Réglages → Dossier de données → **Restaurer…** → choisis la date → **Restaurer**. L'état actuel est sauvegardé juste avant : tu peux toujours revenir en arrière.
- **Exporter une sauvegarde** : un fichier `.json` complet, à garder où tu veux (clé USB, mail à toi-même…). **Importer une sauvegarde** le recharge, après une copie de sécurité.
- Si un jour `data.json` était abîmé (clé retirée pendant une écriture, par exemple), l'application ne l'écrase pas : elle le met de côté et te propose de **restaurer la dernière sauvegarde**.

## 7. Rappels d'échéance

Dans le détail d'une tâche, active **Me rappeler l'échéance** et choisis le délai (1, 2, 3 jours ou 1 semaine avant).

- **Quand l'application est ouverte** : un message apparaît à l'ouverture et pendant la journée (vérification toutes les 15 minutes, à partir de l'heure choisie dans les Réglages, 9 h par défaut). Un seul rappel par tâche et par jour.
- **Notifications Windows** (désactivées au départ) : Réglages → Rappels d'échéance → **Activer les notifications Windows**. L'application crée alors un raccourci « Plateforme de suivi - Lamia » dans ton menu Démarrer : Windows en a besoin pour afficher les notifications d'une application portable. Le bouton **Tester** t'en envoie une tout de suite. Si rien n'apparaît, vérifie le mode « Ne pas déranger » de Windows.
- **Même fenêtre fermée** : active **Fermer dans la zone de notification**. La croix cache alors la fenêtre sans quitter : une petite icône Memeow reste près de l'horloge (parfois dans la flèche ^ des icônes cachées). Clic droit dessus : **Ouvrir la plateforme**, le **chrono en cours**, **Quitter**.
- **Lancer au démarrage de Windows** : l'application s'ouvre avec ta session (discrètement dans la zone de notification si l'option précédente est active), pour ne manquer aucun rappel. Si tu déplaces l'exe, ouvre-le une fois depuis son nouveau dossier pour que Windows retienne le nouvel emplacement.

Ces trois options sont **propres à chaque PC** : tu peux les activer chez toi et pas sur le PC de Flow Line.

## 8. Le chrono

Le chrono continue de tourner **même si tu fermes l'application** ou éteins le PC : il reprend où il en était à la réouverture. S'il tourne depuis plus de 10 heures, l'application te demande gentiment si tu ne l'as pas oublié, et te propose de corriger la durée (et le jour) avant de l'enregistrer.

## 9. Changer de PC, ou utiliser deux PC

- **Déplacer l'application** : copie le dossier entier (l'exe **et** `Donnees-Lamia`) sur l'autre PC ou sur une clé USB. Toutes tes données suivent. Les réglages propres au PC (zone de notification, démarrage, notifications) sont à réactiver si tu le souhaites.
- **Deux PC avec un dossier OneDrive** : l'application ne doit être ouverte que **sur un seul PC à la fois**. Si elle est déjà ouverte ailleurs, elle s'ouvre en **lecture seule** avec un bandeau qui indique le nom de l'autre PC : ferme-la là-bas, puis clique sur **Réessayer**. (« Forcer l'ouverture » existe si l'autre PC est éteint ou a planté.)
- Conseils OneDrive : sur chaque PC, clic droit sur le dossier → **Toujours conserver sur cet appareil**, et attends la petite coche verte de synchronisation avant d'ouvrir l'app sur l'autre PC.
- **Clé USB** : pense à **éjecter** la clé avant de la retirer.

## 10. Exports

Onglet **Récap**, choisis la période (jour, semaine ou mois), puis :

- **Export CSV** : une ligne par entrée d'heures (date, catégorie, pôle, client, tâche, durée en heures décimales et en h:mm, source, note), avec un sous-total par catégorie et **jamais de total général**. Il s'ouvre directement dans Excel en français.
- **Export PDF** : le récap de la période en A4, toujours en thème clair.

L'application te demande où enregistrer le fichier (le dossier `Donnees-Lamia\exports\` est proposé par défaut), puis propose de l'afficher.

## 11. Petits soucis et solutions

| Ce que tu vois | Ce qu'il faut faire |
|---|---|
| « Windows a protégé votre ordinateur » | **Informations complémentaires → Exécuter quand même** (§3). |
| Bandeau « Lecture seule : l'application est déjà ouverte sur… » | Ferme l'app sur l'autre PC, puis **Réessayer**. |
| Bandeau « Tes données sont enregistrées sur ce PC, dans … AppData … » | Le dossier de l'exe n'est pas modifiable (clé protégée, ZIP non extrait…). Déplace l'app dans un dossier où tu peux écrire. |
| « Ces données viennent d'une version plus récente » | Mets à jour l'exe sur ce PC (§5). |
| L'app ne s'ouvre plus du tout | Ouvre `Donnees-Lamia\sauvegardes\`, puis contacte l'équipe : rien n'est jamais effacé. |
| Pas de notification Windows | Vérifie l'option dans les Réglages, le mode « Ne pas déranger », et que le raccourci du menu Démarrer existe (le bouton **Tester** le recrée). |

Bonne route avec ta plateforme, et bises à Memeow. Meew !
