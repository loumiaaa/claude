# Calendrier Apple : mode d'emploi

La plateforme et ton Calendrier Apple communiquent dans les deux sens :

1. **Tes rendez-vous dans la plateforme.** Ils s'affichent sur l'Accueil (« Aujourd'hui »), dans le Planning et dans le bilan du dimanche.
2. **Tes échéances dans Calendrier.** Elles apparaissent sur ton iPhone et ton Mac, et se mettent à jour toutes seules.

Les deux sens sont en lecture seule : la plateforme ne modifie jamais ton calendrier Apple, et tes tâches se modifient dans la plateforme.

## Étape 1 : installer le relais (une seule fois, environ 5 minutes)

Pour des raisons de sécurité, Apple n'autorise pas un site web à lire un calendrier directement. Un petit relais, la fonction `calendar`, s'en charge depuis ton compte Supabase. La version Windows / Mac de l'application n'en a pas besoin pour lire tes rendez-vous.

### Option A (conseillée) : installation automatique par GitHub

1. Sur [supabase.com](https://supabase.com), clique sur ton avatar (en haut à droite), puis **Account preferences → Access Tokens → Generate new token**. Nomme le jeton « GitHub » et copie-le.
2. Sur GitHub, dans le dépôt de la plateforme : **Settings → Secrets and variables → Actions → New repository secret**.
   - Nom : `SUPABASE_ACCESS_TOKEN`
   - Valeur : le jeton copié à l'étape 1
3. Dans l'onglet **Actions**, ouvre « Publier le relais calendrier (Supabase) », puis **Run workflow**. Quand la coche est verte, le relais est en ligne.

Ce jeton reste dans les secrets de GitHub. Ne le colle jamais ailleurs, ni dans une conversation. Il en va de même pour la clé `service_role` de Supabase : le relais l'obtient tout seul, tu n'as jamais à la saisir.

### Option B : à la main dans Supabase

1. Dans ton projet Supabase, ouvre **Edge Functions → Deploy a new function → Via Editor**.
2. Nomme la fonction `calendar` (exactement).
3. Crée deux fichiers dans l'éditeur, puis colle le contenu de chacun depuis le dépôt :
   - `index.ts`, depuis `supabase/functions/calendar/index.ts` ;
   - `ics.js`, depuis `supabase/functions/calendar/ics.js`.
4. Dans les réglages de la fonction, **désactive « Enforce JWT verification »**. Calendrier doit pouvoir lire ton lien d'abonnement sans se connecter ; la fonction vérifie elle-même ta connexion et ton jeton privé.
5. Clique sur **Deploy**.

## Étape 2 : voir tes rendez-vous dans la plateforme

1. Sur iPhone, ouvre l'app **Calendrier**, puis **Calendriers** (en bas).
2. Touche le **(i)** à côté du calendrier à partager. Un calendrier dédié, par exemple « Pro », est plus discret que ton calendrier perso complet.
3. Active **Calendrier public**, puis touche **Partager le lien → Copier**.
4. Dans la plateforme, va dans **Réglages → Calendrier Apple**, colle le lien, puis clique sur **Connecter**.

Sur Mac : dans Calendrier, fais un clic droit sur le calendrier, puis **Partager le calendrier… → Public**, et copie le lien.

Tes rendez-vous sont relus toutes les 30 minutes, ou quand tu cliques sur « Actualiser ». Ils restent sur l'appareil : seul le lien est synchronisé.

> Ce lien est privé, mais toute personne qui l'aurait pourrait voir ce calendrier. Pour l'invalider, désactive puis réactive « Calendrier public » dans l'app Calendrier.

## Étape 3 : voir tes échéances dans Calendrier

1. Dans **Réglages → Calendrier Apple**, clique sur **Créer mon lien d'abonnement**, puis **Copier**. Cette étape demande la version web synchronisée.
2. Sur iPhone : **Réglages → Calendrier → Comptes → Ajouter un compte → Autre → Ajouter un calendrier avec abonnement**, colle le lien, puis **Suivant → Enregistrer**.
3. Sur Mac : dans Calendrier, **Fichier → Nouvel abonnement au calendrier…**, colle le lien. Règle « Actualiser automatiquement » sur « Toutes les heures ».

Les échéances des tâches non terminées apparaissent en événements « journée entière », précédés de 📌.

Le lien est privé. **Créer un nouveau lien** désactive l'ancien, par exemple si tu l'as partagé par erreur.

### Sans relais : l'export ponctuel

Le bouton **Exporter un fichier .ics** télécharge tes échéances du moment. Ouvre le fichier : Calendrier propose de les ajouter. C'est une copie qui ne se met pas à jour.
