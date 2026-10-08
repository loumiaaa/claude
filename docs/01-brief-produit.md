# Brief produit — Plateforme de suivi - Lamia

> Auteur : CEO / Product Owner · Phase 1 (conception) · 8 octobre 2026
> Référence : `docs/00-cahier-des-charges.md` (il prime en cas de doute). Les identifiants de stories (DB-1, ST-3…) servent à la recette.

## 1. Vision

**Promesse** : *Lamia ouvre son carnet de bord le matin, sait en un coup d'œil où elle en est (pro et perso, jamais mélangés), note ses heures en deux clics, et repart avec le sourire grâce à Lamia et Memeow.*

**Persona — Lamia**, graphiste / web designer. Salariée chez **Flow Line Intégration** du lundi au vendredi (35 h/sem.), en **auto-entreprise le samedi** (dont le projet **Carnet by-pass**). Très visuelle, exigeante sur la typo et les détails, jongle entre plusieurs clients et retours. Elle a besoin de **suivre ses heures** (contrat Flow Line, compta de l'auto-entreprise), de **ne rien oublier** et de **garder le moral** : un outil froid ou culpabilisant serait abandonné en deux semaines.

**Principes produit**
1. **Deux clics pour les heures** : démarrer un chrono ou saisir une durée depuis le Dashboard, sans formulaire.
2. **Pro et perso séparés** : les heures sont affichées **par catégorie et jamais additionnées** (aucun « total général », ni à l'écran ni dans les exports).
3. **Doux et motivant, jamais culpabilisant** : une tâche en retard est une tâche « à replanifier », avec une action rapide ; pas de rouge alarmant ; le soir et le dimanche, on ne parle pas de charge de travail ; si l'humeur est basse, la voix passe en mode réconfort.
4. **Ses données, son dossier** : tout tient dans un dossier à côté de l'exe, hors ligne, sauvegardé automatiquement, récupérable même en cas de pépin.
5. **Beau au pixel près** : la charte (liquid glass opaque, pastels, pixel art) et la typographie française (espaces insécables, apostrophes courbes) font partie du produit, pas de la finition.

## 2. Périmètre V1 (MoSCoW)

| | Contenu |
|---|---|
| **Must** | `.exe` Windows 10/11 **portable** (sans installation ni droits administrateur), données dans `donnees/` à côté de l'exe, **100 % hors ligne** · écriture atomique + **sauvegardes automatiques** + restauration · **verrou d'ouverture** (un seul PC à la fois) · 4 onglets : **Dashboard, Suivi des tâches, Planning, Récap** · tâches complètes (catégories personnalisables, client/projet, % manuel, checklist, dates, **priorité**, **étiquettes**) · Kanban 4 colonnes + vue liste · **chrono** + saisie manuelle des heures · heures par catégorie vs objectif 35 h · **humeur** 5 niveaux + courbe · scène Lamia & Memeow + phrases (`LamiaVoice`) · **export CSV** · **mode sombre** (clair / sombre / système) · accessibilité AA, clavier, `prefers-reduced-motion` |
| **Should** | **Export PDF** du récap · **rappels d'échéance** (à l'ouverture + notification Windows si l'app est ouverte) · graphiques (tendances, répartition, taux de complétion) · export / import manuel d'une sauvegarde (`.json`) |
| **Could** | Icône dans la zone de notification et lancement au démarrage de Windows · glisser les barres du Planning pour changer les dates · tâches récurrentes / modèles · masquer une phrase ou écrire les siennes · recherche globale (Ctrl+K) |
| **Won't (V1)** | **Synchronisation multi-appareils et version mobile (V2)** · multi-utilisateur, partage · devis / facturation · intégrations (Outlook, Google Agenda, Figma) · chiffrement applicatif (voir risques) · calcul automatique de l'avancement · macOS / Linux · autre langue que le français |

## 3. User stories et critères d'acceptation

### Dashboard (DB)
- **DB-1 Accueil** — *Je vois « Bonjour Lamia », la date du jour en toutes lettres et la scène Lamia & Memeow qui me parlent.*
  - Date au format « jeudi 8 octobre 2026 ». Une bulle pour chaque personnage, phrase de Lamia ≤ 110 caractères.
  - Memeow ne dit **que** des variations de « meew » + une icône (cœur, poisson, zZz, croquette, étoile, note).
  - Deux ouvertures consécutives n'affichent jamais la même phrase. Avec `prefers-reduced-motion`, les sprites restent fixes.
- **DB-2 Voix contextuelle** — *Les phrases s'adaptent à ma journée.*
  - Lundi matin, samedi (Carnet by-pass / auto-entreprise), dimanche (repos), vendredi, échéances, retards, tâches terminées, 35 h atteintes, première ouverture, retour après ≥ 4 jours : chaque contexte produit des phrases dédiées (vérifiable avec `LamiaVoice.eligible(context)`).
  - Humeur ≤ 2 (aujourd'hui, sinon hier) : **uniquement** des phrases de réconfort, Memeow affiche un cœur.
  - Le dimanche, le soir (≥ 18 h) et la nuit : aucune phrase sur les retards ou les échéances. Nuit : Memeow dort (zZz). Vers midi : Memeow réclame souvent ses croquettes.
  - Nombres accordés : « 1 tâche a glissé », « 3 tâches ont glissé » ; jamais « 0 tâche ».
- **DB-3 Humeur du jour** — *À ma première ouverture de la journée, on me propose de noter mon humeur.*
  - 5 icônes pixel + note facultative ; **1 clic** suffit à enregistrer ; « Plus tard » ferme sans bloquer.
  - La proposition ne réapparaît pas le même jour ; l'humeur reste modifiable depuis le Dashboard.
- **DB-4 Récap express** — *Je vois mes tâches en cours, terminées et à venir sur jour / semaine / mois.* Le choix de période est mémorisé.
- **DB-5 Heures de la semaine** — *Je vois mes heures par catégorie.* Une jauge par catégorie (« Flow Line 28 h / 35 h ») ; **aucun total général** ; une catégorie sans objectif affiche seulement sa durée ; au-delà de 35 h, affichage neutre (« + 2 h »), sans alerte.
- **DB-6 Échéances et « à replanifier »** — Les échéances des 7 prochains jours et les tâches en retard sont listées ; chaque tâche en retard propose **Demain / Lundi prochain / Choisir une date** en 1 clic ; style neutre (pas de rouge vif).
- **DB-7 Chrono** — *Je démarre un chrono en 2 clics.* Bouton ▶ sur les tâches « En cours » du Dashboard ; un chrono actif affiche tâche, temps écoulé et Stop.

### Suivi des tâches (ST)
- **ST-1 Créer vite** — Seul le titre est obligatoire ; Entrée valide. Catégorie proposée selon le jour (Flow Line du lundi au vendredi, Auto-entreprise le samedi), modifiable.
- **ST-2 Kanban** — 4 colonnes **Pas commencé / En cours / En validation / Terminé** ; glisser-déposer **et** alternative clavier (« Déplacer vers… ») ; l'ordre est conservé après redémarrage. Passer en « Terminé » enregistre la date de fin réelle et, si l'avancement est < 100 %, propose (sans l'imposer) de le mettre à 100 %.
- **ST-3 Vue liste** — Filtres : catégorie, statut, priorité, étiquette, client, période ; tri sur chaque colonne ; filtres conservés entre deux ouvertures.
- **ST-4 Détail** — Description, client / projet (facultatif), curseur 0–100 % (pas de 5), checklist (ajouter, cocher, réordonner, supprimer), dates de début et de fin (fin ≥ début, sinon message clair), priorité (basse, normale, haute, urgente), étiquettes libres avec autocomplétion.
- **ST-5 Heures** — Un seul chrono actif à la fois (en lancer un autre arrête le premier, avec un message) ; le chrono **survit à la fermeture** de l'app ; au-delà de 10 h, on propose de corriger la durée. Saisie manuelle : date + durée (« 1h30 », « 90 », « 1,5 ») + note. Toutes les entrées sont modifiables et supprimables.
- **ST-6 Catégories** — Renommer, ajouter, choisir la couleur et le groupe (Flow Line / Auto-entreprise). Supprimer une catégorie utilisée impose de réaffecter ses tâches.
- **ST-7 Rappels** — Rappel J-n réglable par tâche ; rappels dus affichés à l'ouverture ; notification Windows si l'app est ouverte au moment du rappel.
- **ST-8 Suppression sans stress** — Supprimer une tâche affiche « Annuler » pendant 10 s (pas de fenêtre de confirmation bloquante).

### Planning (PL)
- **PL-1** Timeline type Gantt des tâches datées, **regroupées par catégorie** (couleur de la catégorie) ; les tâches sans dates sont listées à part (« Non planifiées »).
- **PL-2** Repère « aujourd'hui » visible + bouton « Aujourd'hui » ; zoom **semaine / mois** ; navigation précédent / suivant.
- **PL-3** Clic (ou Entrée) sur une barre : ouvre le détail de la tâche. Une tâche en retard se distingue sans couleur alarmante.

### Récap (RC)
- **RC-1** Période jour / semaine / mois avec navigation : tâches créées, en cours, terminées, en retard.
- **RC-2** Heures par jour / semaine / mois, **par catégorie, jamais additionnées** ; comparaison avec l'objectif Flow Line (35 h/sem., 7 h/jour du lundi au vendredi) ; le samedi, durée sans objectif.
- **RC-3** Listes « à terminer » et « arrivent bientôt ».
- **RC-4** Graphiques : tendances, répartition par catégorie, taux de complétion, **courbe d'humeur** (un jour sans humeur = un trou, pas un zéro).
- **RC-5 Export CSV** — Une ligne par entrée de temps : date ; catégorie ; tâche ; client ; durée (heures décimales à virgule) ; note. Séparateur `;`, UTF-8 avec BOM : s'ouvre correctement dans Excel en français. Sous-totaux par catégorie, sans total général.
- **RC-6 Export PDF** — Récap de la période au format A4, une section par catégorie, généré hors ligne.

### Transverse (TR)
- **TR-1** Double-clic sur l'exe : l'app s'ouvre en < 3 s, sans installation, sans droits admin, **réseau coupé**.
- **TR-2** Copier le dossier (exe + `donnees/`) sur un autre PC : toutes les données sont là.
- **TR-3** Écriture atomique (fichier temporaire puis renommage) ; sauvegarde automatique à l'ouverture de chaque journée et avant toute migration de format ; 30 sauvegardes conservées ; restauration depuis les Paramètres. Fichier illisible : message clair + proposition de restaurer la dernière sauvegarde valide, **jamais d'écrasement silencieux**.
- **TR-4** Verrou : si l'app est déjà ouverte sur un autre PC (fichier de verrou rafraîchi chaque minute, périmé après 5 min), ouverture en **lecture seule** avec le nom du PC concerné.
- **TR-5** Thème clair / sombre / système, mémorisé. **TR-6** Contraste AA, tout utilisable au clavier, focus visible.

## 4. Indicateurs de succès (après 4 semaines d'usage)
- L'app est ouverte **au moins 4 jours travaillés sur 5**.
- Des heures sont saisies **≥ 90 % des jours Flow Line** ; démarrer un chrono depuis l'ouverture prend **≤ 2 clics / 5 s**.
- Humeur notée **≥ 70 %** des jours d'ouverture.
- Export CSV mensuel utilisable **sans retouche** pour la compta de l'auto-entreprise.
- **Zéro perte de données**, zéro plantage bloquant en recette.
- Ressenti de Lamia : « motivant » ≥ 4/5 ; **aucune phrase ressentie comme culpabilisante**.

## 5. Risques et parades

| Risque | Impact | Parade |
|---|---|---|
| **Exe non signé** : alerte Windows SmartScreen ; la **DSI de Flow Line** peut bloquer les exe inconnus (AppLocker, antivirus), surtout s'ils s'extraient dans `%TEMP%` | Élevé : l'app ne démarre pas sur le PC pro | Test d'un exe « coquille » **sur le PC pro dès la 1re semaine de Phase 2** ; mode d'emploi SmartScreen (« Informations complémentaires → Exécuter quand même ») ; demande d'autorisation à la DSI ; option certificat de signature de code (coût annuel, à arbitrer) ; privilégier une technologie sans extraction temporaire (choix du Dev) ; plan B : même app en page HTML ouverte dans Edge, données dans un dossier choisi (API d'accès aux fichiers d'Edge) |
| **Perte ou corruption** des données (coupure, clé retirée pendant l'écriture) | Élevé | Écriture atomique, sauvegardes datées (30), version de format + migration, contrôle du fichier au chargement, restauration en 1 clic, export manuel `.json` |
| **Deux ordinateurs** qui écrivent dans le même dossier **OneDrive** | Moyen : copies en conflit, données écrasées | Verrou d'ouverture (TR-4) ; compteur de révision vérifié avant chaque écriture (si le fichier a changé ailleurs : copie de conflit + message, jamais d'écrasement) ; détection des fichiers « -NomDuPC » créés par OneDrive |
| **Confidentialité** des données Flow Line (clients, projets) sur une **clé USB** ou un cloud perso | Moyen à élevé (charte informatique de l'employeur) | Recommander le OneDrive professionnel ; BitLocker To Go si clé USB ; ne stocker que le nécessaire (pas de pièces jointes en V1) ; faire valider l'usage par Flow Line. Pas de chiffrement applicatif en V1 (mot de passe oublié = données perdues) |
| **Licence General Sans** (ITF Free Font License) | Faible | Relire la licence Fontshare avant de l'embarquer et joindre le texte dans `design/fonts/` ; Poppins (OFL) déjà embarquée en repli : l'app reste belle sans General Sans |
| **Rappels** sans application lancée | Moyen : rappel manqué | Rappels affichés à l'ouverture ; option Could : zone de notification + lancement au démarrage |
| **Lassitude** des phrases | Faible | 142 phrases + règles contextuelles + anti-répétition ; Lamia peut relire et enrichir la liste |

## 6. Feuille de route
1. **Phase 1 — Conception (en cours)** : brief (CEO), charte + pixel art (DA), parcours + maquette cliquable (UI/UX), note d'architecture (Dev), recette de la maquette (Testeur).
2. **Validation par Lamia** : démonstration de la maquette, réponses aux points d'arbitrage (§8), gel du périmètre V1.
3. **Phase 2 — Développement** par incréments démontrables : ① socle exe + données + sauvegardes + verrou, **testé sur le PC Flow Line** ; ② tâches, Kanban, liste, heures ; ③ Dashboard, humeur, voix, Planning ; ④ Récap, exports, rappels, mode sombre.
4. **Phase 3 — Tests et rapport** : recette sur les stories ci-dessus, tests de robustesse (coupure pendant l'écriture, clé retirée, deux PC sur OneDrive, réseau coupé), test sur le PC pro réel, puis 2 semaines d'usage par Lamia.
5. **V2** : synchronisation multi-appareils, version mobile, suggestions issues de l'usage V1.

## 7. Journal des décisions

| # | Décision | Source |
|---|---|---|
| 1 | Exe Windows portable, données à côté de l'exe, 100 % hors ligne | Lamia |
| 2 | Mobile et synchro en V2 ; interface responsive dès la V1 | Lamia |
| 3 | 4 onglets (Dashboard en premier), Kanban 4 colonnes, vue liste | Lamia |
| 4 | Catégories par défaut Flow Line, Carnet by-pass, Auto-entreprise ; personnalisables | Lamia |
| 5 | Avancement en % **manuel** ; checklist de sous-tâches ; priorités et étiquettes ; rappels | Lamia |
| 6 | Heures : chrono + saisie manuelle, modifiables ; **jamais additionnées** entre catégories ; objectif 35 h Flow Line | Lamia |
| 7 | Humeur 5 niveaux + note, proposée à la 1re connexion du jour | Lamia |
| 8 | Lamia et Memeow (chatte qui ne dit que « meew »), ton douceur + humour | Lamia |
| 9 | Charte : blanc, bleu et violet pastel, liquid glass opaque, General Sans + Poppins, bulles pixel, mode sombre | Lamia |
| 10 | Exports PDF et CSV ; démarche en 3 phases avec validation | Lamia |
| 11 | Retards présentés « à replanifier » + actions rapides ; pas de charge évoquée le soir et le dimanche ; humeur basse = mode réconfort | CEO (à valider) |
| 12 | Verrou d'ouverture + écriture atomique + 30 sauvegardes ; pas de chiffrement applicatif en V1 | CEO (à valider) |
| 13 | Un seul chrono actif, qui survit à la fermeture ; catégorie proposée selon le jour | CEO (à valider) |
| 14 | `LamiaVoice` : champ facultatif `daysAway` ajouté au contexte (sinon déduit du stockage local) ; « retour » à partir de 4 jours, pour qu'un week-end ne compte pas | CEO |

## 8. Points à arbitrer par Lamia
1. **PC pro** : peux-tu lancer un exe non signé sur ton poste Flow Line ? Faut-il solliciter la DSI, voire financer un certificat de signature ? L'app tournera-t-elle sur le PC pro, le PC perso, ou les deux ?
2. **Emplacement des données** : OneDrive pro, OneDrive perso ou clé USB ? La charte de Flow Line autorise-t-elle ses données hors du PC pro ?
3. **Rappels** : te suffit-il qu'ils s'affichent quand l'app est ouverte, ou veux-tu l'icône dans la zone de notification + le lancement au démarrage ?
4. **Samedi** : aucun objectif d'heures (choix actuel) ou un objectif indicatif ?
5. **Export CSV** : colonnes et format de durée attendus par ta comptable (heures décimales ou hh:mm) ?
6. **Phrases** : relire les 142 phrases (`design/phrases.js`) ; souhaites-tu pouvoir masquer une phrase ou ajouter les tiennes ?
