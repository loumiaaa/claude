/*
 * Plateforme de suivi - Lamia — design/phrases.js
 * La voix de Lamia et de Memeow sur le Dashboard.
 * Contrat : cahier des charges §8, « API window.LamiaVoice ».
 *
 *   LamiaVoice.pick(context) -> {
 *     lamia: string,
 *     memeow: { text: string, icon: 'heart'|'fish'|'zzz'|'kibble'|'star'|'note' },
 *     memeowAnimation: 'idle'|'sleep'|'lick'|'hungry'|'meow',
 *     lamiaAnimation: 'idle'|'wave'|'cheer'|'typing'
 *   }
 *   context = { date: Date, dueThisWeek, overdue, doneToday, doneThisWeek,
 *               hoursFlowlineWeek, moodYesterday?: 1..5, moodToday?: 1..5,
 *               firstLoginToday: boolean,
 *               daysAway?: number }   // facultatif, hors contrat : jours depuis la dernière ouverture
 *   LamiaVoice.phrases   -> données brutes (réutilisées telles quelles en phase 2)
 *
 * Script classique : pas de module ES, aucune requête réseau, fonctionne en file://.
 * Fichier en UTF-8 : la page qui le charge doit déclarer <meta charset="utf-8">.
 * Mémoire locale (facultative, try/catch partout) : « lamiaVoice.last » (dernières répliques,
 * pour ne pas se répéter) et « lamiaVoice.lastVisit » (dernier jour d'ouverture, pour « retour »).
 *
 * Marqueurs utilisables dans les phrases de Lamia :
 *   {n}            le nombre du contexte (échéances, retards, tâches terminées, jours d'absence)
 *   {s}            « s » si n > 1, rien sinon
 *   {sing|plur}    forme du singulier si n <= 1, du pluriel sinon (ex. « {a|ont} »)
 * Une phrase qui contient {n} n'est jamais tirée si n vaut 0.
 * À la sortie : ' devient ’, et les espaces avant ! ? : ; % h » (et après «) deviennent
 * insécables (U+00A0, présent dans Poppins et Pixelify Sans, contrairement à U+202F).
 *
 * Memeow est une chatte : elle ne dit QUE des variations de « meew ».
 */
(function (root) {
  'use strict';

  var MAX_LENGTH = 110;
  var KEY_LAST = 'lamiaVoice.last';
  var KEY_VISIT = 'lamiaVoice.lastVisit';
  var AWAY_THRESHOLD = 4; // vendredi -> lundi = 3 jours : un simple week-end n'est pas un « retour »

  /* ------------------------------------------------------------------ */
  /* Phrases de Lamia (tutoiement, ≤ 110 caractères, jamais culpabilisant) */
  /* ------------------------------------------------------------------ */
  var lamia = {
    general: [
      "Un calque à la fois : aucune maquette ne s'est jamais faite en un seul clic.",
      "Ctrl+S souvent, Ctrl+Z sans honte : voilà toute la sagesse du graphiste.",
      "Tu as le droit de faire une pause. Même Figma prend le temps de charger.",
      "Aujourd'hui, on vise le progrès, pas la perfection au pixel près.",
      "Ton talent ne se mesure pas au nombre de « final_v8_OK_vraiment.psd ».",
      "Si on te demande d'agrandir le logo : respire, souris, puis agrandis-le… un peu.",
      "Le kerning de ta journée est parfait : ni trop serré, ni trop lâche.",
      "J'ai feuilleté tout le nuancier Pantone : aucune teinte n'est aussi lumineuse que toi.",
      "Un verre d'eau, les épaules détendues, et c'est reparti pour du beau travail.",
      "Ton cerveau mérite le même soin que tes maquettes : un peu d'espace blanc.",
      "Les meilleures idées arrivent entre deux gorgées de thé. Je dis ça, je dis rien.",
      "Chaque tâche cochée, c'est un petit pixel de fierté en plus.",
      "Exporter en PNG, c'est bien. T'exporter loin de l'écran cinq minutes, c'est mieux.",
      "Rien n'est figé, tout est vectoriel : on peut toujours redimensionner sans rien perdre.",
      "Tes idées sont en haute définition aujourd'hui, je le sens.",
      "On aligne les tâches comme sur une grille : proprement, avec de belles gouttières.",
      "Grouper ses calques, grouper ses tâches : même combat, même sérénité.",
      "Même le Lorem ipsum finit par trouver ses vrais mots. Les tiens arrivent.",
      "Aujourd'hui, tu as le droit de dire « ça, on le garde pour la V2 ».",
      "Ton énergie est précieuse : ne la compresse pas en JPEG qualité 10.",
      "Le flou gaussien, c'est pour les arrière-plans. Tes objectifs, eux, sont nets.",
      "Même une grille à 12 colonnes a besoin de marges. Toi aussi.",
      "Fais confiance à ton œil de graphiste : il voit juste bien plus souvent que tu ne le crois.",
      "Les pixels ne s'alignent pas tout seuls… mais tu es là, donc tout va bien.",
      "Si tout semble flou, zoome à 100 % : une seule tâche, et tout redevient net.",
      "Ta to-do n'est pas un concours, c'est une palette : choisis tes couleurs du jour.",
      "Eau, posture, playlist : le trio gagnant des pros du pixel.",
      "Tu as survécu à des demandes de Comic Sans. Rien ne peut t'arrêter.",
      "Pense à sauvegarder ton fichier… et à te sauvegarder un peu, toi aussi.",
      "Un brief flou ? Une question claire, et le brouillard se dissipe.",
      "Tu fais du beau travail. Pas besoin d'un retour client pour le savoir.",
      "Le perfectionnisme, c'est comme l'ombre portée : à utiliser avec modération.",
      "Commence par la plus petite tâche : c'est l'élan qui compte, pas la taille.",
      "Ton planning est un moodboard : de l'inspiration, pas de la pression.",
      "Le monde a besoin de belles choses. Coup de chance : c'est ton métier.",
      "Un tracé à la plume se reprend point par point. Une journée aussi.",
      "Pas besoin de tout finir : avancer d'un point d'ancrage, c'est déjà avancer.",
      "Pixel perfect, c'est super. Pixel « assez bien », c'est parfois parfait.",
      "Ton cerveau a 99 onglets ouverts ? Ferme-en un. Juste un. Voilà, c'est mieux.",
      "Chaque projet commence par une page blanche, et tu sais en faire des merveilles.",
      "Je crois en toi encore plus qu'à la promesse « c'est la toute dernière modif ».",
      "Sauvegarde automatique activée sur ta bonne humeur. Je veille au grain.",
      "Quand ça coince, change d'outil : une feuille, un crayon, et l'idée revient.",
      "Les clients passent, les bons choix typographiques restent.",
      "Hiérarchie visuelle, version to-do : l'important en gros, le reste en petit.",
      "Pense à cligner des yeux et à regarder au loin. Ton écran ne va pas s'envoler.",
      "Si le client demande « on peut tester en rouge ? », pense très fort à Memeow.",
      "Ta priorité urgente du jour : être douce avec toi-même."
    ],

    // Selon l'heure (matin 5 h–11 h 29, midi 11 h 30–13 h 59, après-midi 14 h–17 h 59,
    // soir 18 h–21 h 59, nuit 22 h–4 h 59)
    matin: [
      "Café, lunettes, Figma : la sainte trinité du matin est en place.",
      "Le matin, les idées sont en 300 dpi. Parfait pour la tâche qui demande le plus de réflexion.",
      "Ta journée est un plan de travail vierge : à toi de composer.",
      "On démarre en douceur : une petite tâche pour chauffer les pinceaux.",
      "Les pixels du matin brillent toujours un peu plus. C'est scientifique (presque)."
    ],
    midi: [
      "C'est l'heure de manger ! Même les meilleurs exports font une pause.",
      "Pause déjeuner : on ferme les maquettes, on ouvre la boîte à lunch.",
      "Ton estomac vient d'envoyer un retour client : « urgent, à traiter tout de suite ».",
      "Lâche la souris : Memeow a déjà réclamé sa gamelle, à ton tour de manger.",
      "Un vrai déjeuner loin de l'écran : tes calques t'attendront, promis."
    ],
    apresMidi: [
      "Petit coup de mou de 15 h ? Un verre d'eau et une tâche facile, combo gagnant.",
      "L'après-midi, place aux tâches tranquilles : exports, rangement des calques, renommages.",
      "Encore un peu de belles choses à créer, et on soufflera bientôt."
    ],
    soir: [
      "La journée est presque bouclée. Tu peux être fière de tout ce que tu as fait.",
      "Un peu tard pour le kerning. On ferme les fichiers, on garde les idées pour demain.",
      "Ce soir, ton seul livrable, c'est du repos. Avec Memeow sur les genoux, de préférence.",
      "Ce qui n'est pas fini a toute sa place demain. Pas besoin de tout porter ce soir.",
      "Dernier Ctrl+S de la journée, et place à la soirée !"
    ],
    nuit: [
      "Il est tard… les pixels dorment, Memeow aussi. Et si tu faisais pareil ?",
      "Les idées de minuit sont géniales, et elles le seront encore plus après une bonne nuit.",
      "Note ton idée, éteins l'écran : demain, elle sera toujours là, en haute résolution."
    ],

    // Selon le jour
    lundi: [
      "Lundi, page blanche… mais toi, tu as déjà le style.",
      "Bon lundi ! On pose la grille de la semaine, les tâches viendront s'y aligner.",
      "Un lundi, c'est comme un gros PSD qui s'ouvre : ça rame un peu, puis tout s'affiche.",
      "Nouvelle semaine Flow Line : 35 heures de belles choses en perspective, sans pression.",
      "Lundi en douceur : les mails, un café, et ensuite on attaque.",
      "Ce lundi est une nouvelle version : pas d'historique à porter, que des possibilités."
    ],
    vendredi: [
      "Vendredi ! Week-end en cours de chargement : 90 %… 95 %…",
      "C'est vendredi : on termine en beauté et on archive la semaine avec fierté.",
      "Ferme tes fichiers proprement : la Lamia de lundi te dira merci.",
      "Vendredi, le seul jour où « on verra ça lundi » est une vraie stratégie.",
      "Vendredi en vue : exporte tes fichiers, pas ton stress.",
      "Bilan de la semaine : {n} tâche{s} terminée{s}. Ça mérite un vendredi tout doux."
    ],
    samedi: [
      "Samedi, c'est ta journée : Carnet by-pass a hâte de te retrouver.",
      "Aujourd'hui, ta seule cliente, c'est toi. Et elle est plutôt cool.",
      "Journée auto-entreprise ! Même rigueur, mais playlist à fond.",
      "Samedi créatif : pas de réunion, pas de brief imposé, juste tes idées.",
      "Carnet by-pass avance à ton rythme. C'est ton projet, c'est toi qui fixes les règles.",
      "Patronne du jour : c'est toi qui choisis les priorités. Et les pauses.",
      "Le samedi, tu construis ton projet à toi, une page à la fois."
    ],
    dimanche: [
      "Dimanche : aujourd'hui, le seul calque actif, c'est le canapé.",
      "Les tâches font la sieste aujourd'hui. Tu as le droit d'en faire autant.",
      "Le dimanche, on ne compte pas les heures, on compte les câlins de Memeow.",
      "Aucun brief aujourd'hui : juste toi, une boisson chaude et zéro notification.",
      "Ne rien faire, c'est permis. C'est même écrit dans le cahier des charges.",
      "Recharge tes batteries : lundi, tu seras en pleine résolution."
    ],

    // Selon la charge (n = dueThisWeek / overdue)
    echeances: [
      "{n} échéance{s} cette semaine. On les pose sur la grille, et tout ira bien.",
      "Cette semaine, {n} rendu{s} t'{attend|attendent}. Un pas après l'autre, tu gères.",
      "{n} date{s} de fin d'ici dimanche : rien que tu ne saches cadrer.",
      "Au programme : {n} échéance{s}. Un coup d'œil au Planning et tout s'éclaire.",
      "{n} livraison{s} cette semaine. Tu as déjà fait bien plus difficile, et avec le sourire.",
      "{n} échéance{s} en vue : on commence par la plus proche, le reste suivra."
    ],
    retards: [
      "{n} tâche{s} {a|ont} glissé dans le temps. Pas grave : on ajuste les dates et on repart.",
      "{n} tâche{s} en retard ? Juste un calque décalé, rien d'irréparable.",
      "{n} tâche{s} {attend|attendent} un petit coup de pouce. Décaler une date, c'est permis aussi.",
      "{n} tâche{s} à replanifier. Respire, choisis la plus importante, le reste suivra.",
      "Les échéances sont écrites dans un fichier, pas dans le marbre. {n} à ajuster, tranquille.",
      "Un retard n'est pas un échec, juste un nouveau calendrier. {n} à revoir, sans stress."
    ],

    // Selon l'humeur
    humeurBasse: [
      "Aujourd'hui, on y va tout doux. Rien ne presse.",
      "Pas besoin d'être à 100 %. Même à 50 % d'opacité, tu restes magnifique.",
      "Une seule petite tâche aujourd'hui, ce sera déjà très bien. Le reste peut attendre.",
      "Je suis là, Memeow aussi. On prend soin de toi d'abord, des tâches ensuite.",
      "Les jours gris font aussi partie de la palette. On rajoutera de la couleur.",
      "Tu as le droit d'avoir une journée en niveaux de gris. Ça passera, promis.",
      "Si c'est trop, fais une vraie pause. Tes projets ne vont pas s'envoler."
    ],
    humeurBasseHier: [
      "Hier était un peu lourd. Aujourd'hui est un nouveau fichier, tout léger.",
      "Hier, c'était dur. Aujourd'hui, on repart d'une page blanche, en douceur.",
      "On laisse hier dans la corbeille. Pas besoin de le restaurer."
    ],
    humeurHaute: [
      "Tu rayonnes ! Profite de cette énergie pour la tâche qui te fait le plus envie.",
      "Belle humeur détectée : saturation +20, luminosité +15. La journée s'annonce top.",
      "Avec cette humeur-là, même les retours clients vont te sembler sympas.",
      "Cette énergie, on aimerait l'exporter en PNG et l'afficher partout.",
      "Humeur au top : c'est le moment d'avancer sur le projet qui te tient à cœur."
    ],

    // Selon les réussites (n = doneToday)
    termine: [
      "{n} tâche{s} terminée{s} aujourd'hui ! Ça mérite une petite danse de la victoire.",
      "{Et d'une|Et de {n}} ! La colonne « Terminé » a de plus en plus fière allure.",
      "Tâche{s} cochée{s} aujourd'hui : {n}. Ce petit clic de satisfaction ne vieillit jamais.",
      "{n} chose{s} de faite{s} aujourd'hui : quoi qu'il arrive, la journée compte déjà.",
      "Bravo ! {n} tâche{s} bouclée{s}. Exporte cette fierté en haute définition.",
      "{n} tâche{s} dans « Terminé » : ça, c'est du vrai pixel perfect."
    ],
    objectif: [
      "35 heures Flow Line, c'est bouclé ! Tout le reste de la semaine est du bonus.",
      "Objectif d'heures atteint ! Tu peux fermer tes fichiers la tête haute.",
      "La barre des 35 h est pleine. Le chrono peut se reposer, et toi aussi.",
      "Contrat rempli pour la semaine Flow Line. Le temps qui reste est pour toi.",
      "35 h au compteur : bravo ! Garde-toi du temps rien que pour toi."
    ],

    // Selon la connexion (n = jours d'absence pour « retour »)
    premiereConnexion: [
      "Coucou toi ! Prête à créer de jolies choses aujourd'hui ?",
      "Te voilà ! Je t'ai gardé une place au chaud, juste à côté de Memeow.",
      "Nouvelle journée, nouveau fichier. Et toujours la même graphiste de talent.",
      "Hello ! Ta journée commence, et je suis trop contente de te voir.",
      "Bonjour, toi ! On lance la journée en douceur ?"
    ],
    retour: [
      "Te revoilà ! Memeow a surveillé tes fichiers. Enfin… elle a surtout dormi dessus.",
      "Bon retour ! On refait le point tranquillement, une tâche après l'autre.",
      "Quelques jours loin de l'écran, ça fait du bien. On reprend en douceur.",
      "Bon retour parmi nous ! Tes calques n'ont pas bougé, promis.",
      "{n} jours sans te voir : Memeow les a comptés. On reprend tout doucement ?"
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Répliques de Memeow : uniquement des « meew » + icône + animation     */
  /* ------------------------------------------------------------------ */
  function m(text, icon, animation) {
    return { text: text, icon: icon, animation: animation };
  }

  var memeow = {
    general: [
      m("Meew !", "heart", "idle"),
      m("Mrrreeew ?", "note", "idle"),
      m("Meeew meeew…", "heart", "lick"),
      m("mew.", "fish", "lick"),
      m("Meew meew meeew !", "star", "meow"),
      m("Mew ?", "fish", "idle")
    ],
    matin: [
      m("Meew ! Meew !", "kibble", "hungry"),
      m("Mrrreeew…", "heart", "lick"),
      m("Meeew ?", "note", "idle")
    ],
    midi: [
      m("Meew meew meeew !", "kibble", "hungry"),
      m("MEEEW !", "kibble", "hungry"),
      m("Mrrreeew ? Meew !", "fish", "hungry")
    ],
    apresMidi: [
      m("mew…", "zzz", "sleep"),
      m("Mrrreeew ?", "fish", "lick"),
      m("Meew.", "note", "idle")
    ],
    soir: [
      m("Meeew…", "heart", "lick"),
      m("mew… mew…", "zzz", "sleep"),
      m("Mrrrew ?", "fish", "idle")
    ],
    nuit: [
      m("mew…", "zzz", "sleep"),
      m("Mrrreew…", "zzz", "sleep"),
      m("Mmmeew…", "zzz", "sleep")
    ],
    lundi: [
      m("Mrrreeew ?", "note", "idle"),
      m("Meew…", "kibble", "hungry"),
      m("Meew meew !", "heart", "meow")
    ],
    vendredi: [
      m("Meew meew meeew !", "star", "meow"),
      m("Meeeew !", "heart", "meow"),
      m("Mrrreeew !", "fish", "meow")
    ],
    samedi: [
      m("Meew ?", "note", "idle"),
      m("Mrrreeew meew !", "heart", "meow"),
      m("Meeew…", "fish", "lick")
    ],
    dimanche: [
      m("mew… mew…", "zzz", "sleep"),
      m("Mmmeeew…", "zzz", "sleep"),
      m("Mrrreeew…", "heart", "sleep")
    ],
    echeances: [
      m("Meew !", "note", "idle"),
      m("Mrrreeew ?", "note", "meow"),
      m("Meew meew !", "star", "idle")
    ],
    retards: [
      m("Meeew…", "heart", "lick"),
      m("Mrrreeew ?", "heart", "idle"),
      m("mew.", "fish", "idle")
    ],
    humeurBasse: [
      m("Meeew… mew…", "heart", "lick"),
      m("Mrrreeew…", "heart", "sleep"),
      m("mew ?", "heart", "idle"),
      m("Meeew meeew…", "heart", "lick")
    ],
    humeurHaute: [
      m("Meew meew meeew !", "star", "meow"),
      m("Meeeew !", "heart", "meow"),
      m("Mrrreeew !", "fish", "meow")
    ],
    termine: [
      m("Meew !", "star", "meow"),
      m("Meew meew meeew !", "star", "meow"),
      m("Mrrreeew !", "fish", "meow")
    ],
    objectif: [
      m("MEEEW ! Meew meew !", "star", "meow"),
      m("Meew meew meeew !", "star", "meow"),
      m("Meeeeew !", "star", "meow")
    ],
    premiereConnexion: [
      m("Meew !", "heart", "meow"),
      m("Mrrreeew ?", "heart", "idle"),
      m("Meew meew !", "kibble", "hungry")
    ],
    retour: [
      m("MEEEEW !", "heart", "meow"),
      m("Mrrreeew ? Meew !", "heart", "meow"),
      m("Meeew meeew meeew !", "fish", "meow")
    ]
  };

  /* Animations de Lamia par catégorie (tirage au sort dans la liste) */
  var lamiaAnimations = {
    general: ["idle", "typing", "wave", "idle"],
    matin: ["wave", "typing"],
    midi: ["idle", "wave"],
    apresMidi: ["typing", "idle"],
    soir: ["idle", "wave"],
    nuit: ["idle"],
    lundi: ["typing", "wave"],
    vendredi: ["cheer", "wave"],
    samedi: ["typing", "cheer"],
    dimanche: ["idle"],
    echeances: ["typing"],
    retards: ["idle", "typing"],
    humeurBasse: ["idle"],
    humeurHaute: ["cheer", "wave"],
    termine: ["cheer"],
    objectif: ["cheer"],
    premiereConnexion: ["wave"],
    retour: ["wave"]
  };

  /* ------------------------------------------------------------------ */
  /* Stockage : toute lecture/écriture est protégée (stockage indisponible) */
  /* ------------------------------------------------------------------ */
  var memory = {};

  function readStore(key) {
    var value = null;
    try {
      var store = root.localStorage;
      if (store) value = store.getItem(key);
    } catch (e) {
      value = null;
    }
    if (value == null && Object.prototype.hasOwnProperty.call(memory, key)) value = memory[key];
    return value;
  }

  function writeStore(key, value) {
    memory[key] = value;
    try {
      var store = root.localStorage;
      if (store) store.setItem(key, value);
    } catch (e) {
      /* stockage plein, désactivé ou interdit : la mémoire de session suffit */
    }
  }

  function readJSON(key) {
    try {
      var raw = readStore(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Outils                                                               */
  /* ------------------------------------------------------------------ */
  function rand() {
    return Math.random();
  }

  function sample(list) {
    return list[Math.floor(rand() * list.length)];
  }

  function count(v) {
    v = Number(v);
    return isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }

  function hours(v) {
    v = Number(v);
    return isFinite(v) && v > 0 ? v : 0;
  }

  function moodLevel(v) {
    if (v === null || v === undefined || v === '') return null;
    v = Number(v);
    return isFinite(v) && v >= 1 && v <= 5 ? Math.round(v) : null;
  }

  function toDate(d) {
    if (d && typeof d.getTime === 'function') d = new Date(d.getTime());
    else if (typeof d === 'string' || typeof d === 'number') d = new Date(d);
    else d = new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function pad(x) {
    return (x < 10 ? '0' : '') + x;
  }

  function isoDay(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayNumber(iso) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!match) return null;
    return Math.round(Date.UTC(+match[1], +match[2] - 1, +match[3]) / 86400000);
  }

  function slotOf(d) {
    var minutes = d.getHours() * 60 + d.getMinutes();
    if (minutes < 5 * 60 || minutes >= 22 * 60) return 'nuit';
    if (minutes < 11 * 60 + 30) return 'matin';
    if (minutes < 14 * 60) return 'midi';
    if (minutes < 18 * 60) return 'apresMidi';
    return 'soir';
  }

  // Remplace {n}, {s} et {singulier|pluriel}
  function fill(template, n) {
    var plural = n > 1;
    return template
      .replace(/\{n\}/g, String(n))
      .replace(/\{s\}/g, plural ? 's' : '')
      .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, function (all, singular, pluralForm) {
        return plural ? pluralForm : singular;
      });
  }

  // Typographie française : apostrophe courbe et espaces insécables
  function typo(text) {
    return text
      .replace(/'/g, '’')
      .replace(/\.\.\./g, '…')
      .replace(/ ([!?:;»%])/g, ' $1')
      .replace(/« /g, '« ')
      .replace(/(\d) (h|heures|jours)(?![a-zà-ÿ])/g, '$1 $2');
  }

  /* ------------------------------------------------------------------ */
  /* Contexte et règles                                                   */
  /* ------------------------------------------------------------------ */
  function normalize(context) {
    var ctx = context || {};
    var date = toDate(ctx.date);
    var today = dayNumber(isoDay(date));
    var away = 0;

    if (ctx.daysAway !== undefined && ctx.daysAway !== null && isFinite(Number(ctx.daysAway))) {
      away = count(ctx.daysAway);
    } else {
      var last = dayNumber(readStore(KEY_VISIT));
      if (last !== null && today > last) away = today - last;
    }

    return {
      date: date,
      iso: isoDay(date),
      today: today,
      day: date.getDay(), // 0 = dimanche … 6 = samedi
      slot: slotOf(date),
      dueThisWeek: count(ctx.dueThisWeek),
      overdue: count(ctx.overdue),
      doneToday: count(ctx.doneToday),
      doneThisWeek: count(ctx.doneThisWeek),
      hoursFlowlineWeek: hours(ctx.hoursFlowlineWeek),
      moodYesterday: moodLevel(ctx.moodYesterday),
      moodToday: moodLevel(ctx.moodToday),
      firstLoginToday: ctx.firstLoginToday === true,
      daysAway: away
    };
  }

  // Règles éligibles, avec un poids. Une règle « exclusive » passe avant tout le reste.
  function rules(c) {
    var list = [];
    var sunday = c.day === 0;
    var saturday = c.day === 6;
    var late = c.slot === 'soir' || c.slot === 'nuit';

    function add(category, weight, n, sources) {
      list.push({ category: category, weight: weight, n: n || 0, sources: sources || [category] });
    }

    // 1. Exclusif : humeur basse (aujourd'hui si notée, sinon hier) -> douceur avant tout
    var lowToday = c.moodToday !== null && c.moodToday <= 2;
    var lowYesterday = c.moodToday === null && c.moodYesterday !== null && c.moodYesterday <= 2;
    if (lowToday || lowYesterday) {
      add('humeurBasse', 1, 0, lowYesterday ? ['humeurBasse', 'humeurBasseHier'] : ['humeurBasse']);
      return list;
    }

    // 2. Exclusif : retour après plusieurs jours d'absence
    if (c.daysAway >= AWAY_THRESHOLD) {
      add('retour', 1, c.daysAway);
      return list;
    }

    // 3. Règles pondérées (les contextuelles pèsent plus que le fond général)
    if (c.hoursFlowlineWeek >= 35) add('objectif', 6);
    if (c.doneToday > 0) add('termine', 5, c.doneToday);

    var highToday = c.moodToday !== null && c.moodToday >= 4;
    var highYesterday = c.moodToday === null && c.moodYesterday !== null && c.moodYesterday >= 4;
    if (highToday) add('humeurHaute', 4);
    else if (highYesterday) add('humeurHaute', 2);

    if (sunday) add('dimanche', 8);
    if (saturday) add('samedi', 5);
    if (c.day === 1 && !late) add('lundi', 4);
    if (c.day === 5) add('vendredi', 4, c.doneThisWeek);

    // Le soir, la nuit et le dimanche, on ne parle pas de charge de travail.
    if (c.overdue > 0 && !sunday && !late) add('retards', saturday ? 2 : 4, c.overdue);
    if (c.dueThisWeek > 0 && !sunday && !late) add('echeances', saturday ? 1 : 3, c.dueThisWeek);

    if (c.firstLoginToday && c.slot !== 'nuit') add('premiereConnexion', 3);

    if (c.slot === 'nuit') add('nuit', 5);
    else if (c.slot === 'soir') add('soir', 3);
    else if (c.slot === 'midi') add('midi', 4);
    else if (!sunday && c.slot === 'matin') add('matin', 2);
    else if (!sunday && c.slot === 'apresMidi') add('apresMidi', 1);

    add('general', sunday ? 1 : 2);
    return list;
  }

  function weightedPick(list) {
    var total = 0;
    var i;
    for (i = 0; i < list.length; i++) total += list[i].weight;
    var r = rand() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }

  // Tire un élément en évitant la dernière valeur affichée quand c'est possible
  function pickAvoiding(pool, lastKey, keyOf) {
    var fresh = pool.filter(function (item) {
      return keyOf(item) !== lastKey;
    });
    return sample(fresh.length ? fresh : pool);
  }

  function lamiaPool(rule) {
    var pool = [];
    rule.sources.forEach(function (name) {
      (lamia[name] || []).forEach(function (template) {
        if (rule.n > 0 || template.indexOf('{n}') === -1) pool.push(template);
      });
    });
    return pool;
  }

  function memeowCategory(rule, c) {
    if (c.slot === 'nuit') return 'nuit';
    if (rule.category === 'humeurBasse' || rule.category === 'retour' || rule.category === 'objectif') {
      return rule.category;
    }
    if (c.day === 0 && rand() < 0.7) return 'dimanche';
    if (c.slot === 'midi' && rand() < 0.6) return 'midi';
    if (c.slot === 'soir' && rand() < 0.4) return 'soir';
    return memeow[rule.category] ? rule.category : 'general';
  }

  /* ------------------------------------------------------------------ */
  /* API publique                                                         */
  /* ------------------------------------------------------------------ */
  function pick(context) {
    var c = normalize(context);
    var last = readJSON(KEY_LAST) || {};

    var rule = weightedPick(rules(c));
    var pool = lamiaPool(rule);
    if (!pool.length) {
      rule = { category: 'general', weight: 1, n: 0, sources: ['general'] };
      pool = lamia.general.slice();
    }
    var template = pickAvoiding(pool, last.lamia, function (t) { return t; });

    var cat = memeowCategory(rule, c);
    var cat2 = memeow[cat] ? cat : 'general';
    var reply = pickAvoiding(memeow[cat2], last.memeow, function (r) { return r.text; });

    var anims = c.slot === 'nuit' ? ['idle'] : (lamiaAnimations[rule.category] || lamiaAnimations.general);

    writeStore(KEY_LAST, JSON.stringify({ lamia: template, memeow: reply.text }));
    var lastVisit = dayNumber(readStore(KEY_VISIT));
    if (lastVisit === null || c.today > lastVisit) writeStore(KEY_VISIT, c.iso);

    return {
      lamia: typo(fill(template, rule.n)),
      memeow: { text: typo(reply.text), icon: reply.icon },
      memeowAnimation: reply.animation,
      lamiaAnimation: sample(anims)
    };
  }

  root.LamiaVoice = {
    version: '1.0.0',
    pick: pick,
    phrases: {
      lamia: lamia,
      memeow: memeow,
      lamiaAnimations: lamiaAnimations,
      maxLength: MAX_LENGTH,
      icons: ['heart', 'fish', 'zzz', 'kibble', 'star', 'note'],
      memeowAnimations: ['idle', 'sleep', 'lick', 'hungry', 'meow']
    },
    // Hors contrat, pour la recette : règles retenues pour un contexte (sans effet de bord)
    eligible: function (context) {
      return rules(normalize(context)).map(function (r) {
        return { category: r.category, weight: r.weight, n: r.n };
      });
    }
  };
})(typeof window !== 'undefined' ? window : this);
