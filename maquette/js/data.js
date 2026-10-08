/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · données fictives
   Lamia.seed() renvoie un état neuf, toujours identique (générateur pseudo-
   aléatoire à graine fixe). Format proche du modèle du cahier des charges §7.

   Repères de la démo (aujourd'hui = jeudi 8 octobre 2026) :
   - 24 tâches : 13 Flow Line, 5 Carnet by-pass, 6 Auto-entreprise ;
   - 3 tâches « à replanifier » (fin dépassée), 3 échéances d'ici dimanche,
     1 tâche terminée aujourd'hui, 1 tâche sans dates (« Non planifiée ») ;
   - ~5 semaines d'heures : Flow Line du lundi au vendredi (~7 h / jour),
     le perso surtout le samedi ; un chrono tourne sur « Maquettes UI appli » ;
   - 26 humeurs sur 30 jours (4 trous, volontairement).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates;

  function rng(seed) {                       // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var CATEGORIES = [
    { id: 'flowline', name: 'Flow Line', color: 'flowline', group: 'flowline' },
    { id: 'carnet', name: 'Carnet by-pass', color: 'carnet', group: 'auto-entreprise' },
    { id: 'auto', name: 'Auto-entreprise', color: 'auto', group: 'auto-entreprise' }
  ];

  // [id, catégorie, titre, client, statut, priorité, étiquettes, début, fin, %, checklist, extra]
  // checklist : « + » = coché, « - » = à faire
  var TASKS = [
    ['t01', 'flowline', 'Refonte site vitrine — maquettes desktop', 'Maison Ardoise', 'doing', 'high', ['web', 'UI'], '2026-09-21', '2026-10-09', 70,
      ['+Page d’accueil', '+Page projets', '+Page agence', '-Page contact', '-Kit UI (composants)'],
      { reminder: 1, created: '2026-09-17', desc: 'Refonte du site de l’agence d’architecture : 5 gabarits desktop sur une grille de 12 colonnes, ambiance minérale et beaucoup de blanc.' }],
    ['t02', 'flowline', 'Refonte site vitrine — déclinaison mobile', 'Maison Ardoise', 'todo', 'normal', ['web', 'UI'], '2026-10-12', '2026-10-23', 0,
      ['-Accueil', '-Projets', '-Contact'], { created: '2026-10-05', desc: 'Adapter les gabarits desktop en 390 px, menu plein écran.' }],
    ['t03', 'flowline', 'Maquettes UI appli — onboarding', 'Kinéo', 'doing', 'urgent', ['UI', 'appli'], '2026-10-01', '2026-10-14', 45,
      ['+Écran d’accueil', '+Création de compte', '-Choix des objectifs', '-Rappels de séance'],
      { reminder: 2, created: '2026-09-29', desc: 'Parcours d’inscription de l’appli de rééducation : 4 écrans, illustrations douces, accessibilité AA.' }],
    ['t04', 'flowline', 'Maquettes UI appli — tableau de bord patient', 'Kinéo', 'todo', 'high', ['UI', 'appli'], '2026-10-12', '2026-10-23', 0,
      ['-Vue semaine', '-Détail d’un exercice', '-Progression'], { created: '2026-10-06' }],
    ['t05', 'flowline', 'Kit réseaux sociaux — templates Instagram', 'Brasserie du Quai', 'review', 'normal', ['réseaux sociaux'], '2026-09-28', '2026-10-12', 90,
      ['+6 posts carrousel', '+4 stories', '+Gabarits modifiables', '-Guide d’utilisation'],
      { created: '2026-09-25', desc: 'Templates modifiables pour la saison d’automne, envoyés au client mardi.' }],
    ['t06', 'flowline', 'Plaquette print 8 pages', 'Domaine des Tilleuls', 'review', 'normal', ['print', 'mise en page'], '2026-09-14', '2026-10-09', 95,
      ['+Chemin de fer', '+Mise en page', '+Corrections client', '-BAT imprimeur'],
      { reminder: 2, created: '2026-09-10', desc: 'Plaquette A5 piquée, 8 pages, papier Munken 150 g. En attente du BAT.' }],
    ['t07', 'flowline', 'Bannières display — campagne automne', 'Optique Lumen', 'doing', 'high', ['web', 'display'], '2026-09-29', '2026-10-06', 60,
      ['+300 × 250', '+728 × 90', '-160 × 600', '-Version animée HTML5', '-Export final'],
      { created: '2026-09-24', desc: 'Déclinaisons de la campagne « Voir la vie en douceur ».' }],
    ['t08', 'flowline', 'Newsletter d’octobre', 'Flow Line (interne)', 'done', 'low', ['e-mail'], '2026-09-28', '2026-10-06', 100,
      ['+Gabarit', '+Visuels', '+Intégration'], { created: '2026-09-24', completed: '2026-10-06' }],
    ['t09', 'flowline', 'Cartes de visite & signature mail', 'Optique Lumen', 'done', 'normal', ['print'], '2026-10-02', '2026-10-08', 100,
      ['+Cartes recto verso', '+Signature HTML'], { created: '2026-10-01', completed: '2026-10-08' }],
    ['t10', 'flowline', 'Pictogrammes de l’intranet', 'Flow Line (interne)', 'todo', 'low', ['pictos', 'UI'], null, null, 0,
      [], { created: '2026-10-07', desc: 'Une vingtaine de pictos au trait, à caler quand il y aura un creux.' }],
    ['t11', 'flowline', 'Retouches photos du catalogue', 'Domaine des Tilleuls', 'done', 'normal', ['photo', 'print'], '2026-09-07', '2026-10-02', 100,
      ['+Détourages', '+Chromie'], { created: '2026-09-04', completed: '2026-10-01' }],
    ['t12', 'flowline', 'Landing page salon Rééduca', 'Kinéo', 'done', 'high', ['web'], '2026-09-07', '2026-09-18', 100,
      ['+Maquette', '+Intégration', '+Mise en ligne'], { created: '2026-09-03', completed: '2026-09-18' }],
    ['t13', 'flowline', 'Charte éditoriale réseaux', 'Brasserie du Quai', 'done', 'normal', ['réseaux sociaux'], '2026-09-08', '2026-09-25', 100,
      ['+Ton & voix', '+Grille de posts'], { created: '2026-09-04', completed: '2026-09-25' }],

    ['t14', 'carnet', 'Identité visuelle — logo & palette', '', 'done', 'high', ['logo', 'identité'], '2026-09-05', '2026-09-26', 100,
      ['+Recherches', '+Logo', '+Palette', '+Typographies'], { created: '2026-09-01', completed: '2026-09-26' }],
    ['t15', 'carnet', 'Couverture — 3 pistes graphiques', '', 'doing', 'high', ['print', 'illustration'], '2026-09-26', '2026-10-03', 40,
      ['+Moodboard', '+Piste typographique', '-Piste illustrée', '-Piste photo'],
      { created: '2026-09-21', desc: 'Trois directions pour la couverture du carnet : typo seule, illustration au trait, photo de matière.' }],
    ['t16', 'carnet', 'Mise en page du carnet — gabarits', '', 'doing', 'normal', ['mise en page', 'print'], '2026-10-03', '2026-10-24', 25,
      ['+Grille & marges', '+Styles de paragraphe', '-Page de garde', '-Pages notes', '-Pages agenda', '-Folios'],
      { created: '2026-09-28' }],
    ['t17', 'carnet', 'Site one-page — maquette', '', 'todo', 'normal', ['web', 'UI'], '2026-10-17', '2026-11-07', 0,
      ['-Structure', '-Maquette', '-Version mobile'], { created: '2026-10-03' }],
    ['t18', 'carnet', 'Papier & devis imprimeur', '', 'todo', 'low', ['print'], '2026-10-10', '2026-10-17', 0,
      ['-Demander 3 devis', '-Commander des échantillons'], { created: '2026-10-03' }],

    ['t19', 'auto', 'Logo — Le Fournil d’Ana', 'Le Fournil d’Ana', 'doing', 'high', ['logo', 'identité'], '2026-09-19', '2026-10-10', 65,
      ['+Brief & questionnaire', '+Recherches crayonnées', '+3 pistes vectorisées', '-Déclinaisons couleur', '-Fichiers finaux'],
      { reminder: 1, created: '2026-09-15', desc: 'Boulangerie de quartier : un logo chaleureux, lisible sur la devanture et les sachets kraft.' }],
    ['t20', 'auto', 'Devis — faire-part Atelier Mauve', 'Atelier Mauve', 'todo', 'normal', ['devis'], '2026-10-03', '2026-10-05', 0,
      [], { created: '2026-10-02' }],
    ['t21', 'auto', 'Facture d’acompte — Le Fournil d’Ana', 'Le Fournil d’Ana', 'done', 'normal', ['facture'], '2026-09-26', '2026-09-26', 100,
      [], { created: '2026-09-26', completed: '2026-09-26' }],
    ['t22', 'auto', 'Portfolio — mise à jour 2026', '', 'todo', 'normal', ['web', 'portfolio'], '2026-10-10', '2026-10-31', 0,
      ['-Sélection des projets', '-Textes', '-Mockups', '-Mise en ligne'], { created: '2026-10-01' }],
    ['t23', 'auto', 'Déclaration URSSAF — 3e trimestre', '', 'todo', 'urgent', ['admin'], '2026-10-24', '2026-10-31', 0,
      ['-Total du chiffre d’affaires', '-Déclarer sur autoentrepreneur.urssaf.fr'], { reminder: 7, created: '2026-10-01' }],
    ['t24', 'auto', 'Flyers marché de Noël — Le Fournil d’Ana', 'Le Fournil d’Ana', 'todo', 'normal', ['print'], '2026-10-24', '2026-11-14', 0,
      [], { created: '2026-10-07' }]
  ];

  var NOTES = ['Retours client intégrés', 'Point avec la cheffe de projet', 'Exports & déclinaisons', 'Recherches', 'Corrections', '', '', '', ''];

  // Humeurs du 8 septembre au 7 octobre (null = pas notée ce jour-là)
  var MOODS = [
    ['2026-09-08', 3], ['2026-09-09', 4], ['2026-09-10', 3], ['2026-09-11', 2, 'Migraine, journée off.'], ['2026-09-12', 4],
    ['2026-09-13', null], ['2026-09-14', 3], ['2026-09-15', 3], ['2026-09-16', 4], ['2026-09-17', 4],
    ['2026-09-18', 5, 'Landing Rééduca en ligne !'], ['2026-09-19', 4], ['2026-09-20', null], ['2026-09-21', 3],
    ['2026-09-22', 2, 'Beaucoup de retours d’un coup.'], ['2026-09-23', 3], ['2026-09-24', 3], ['2026-09-25', 4],
    ['2026-09-26', 5, 'Logo du Carnet terminé, je l’adore.'], ['2026-09-27', null], ['2026-09-28', 3], ['2026-09-29', 3],
    ['2026-09-30', 2], ['2026-10-01', 3], ['2026-10-02', 4], ['2026-10-03', 4, 'Samedi tranquille sur le Carnet.'],
    ['2026-10-04', null], ['2026-10-05', 3], ['2026-10-06', 4], ['2026-10-07', 4, 'Présentation Maison Ardoise validée.']
  ];

  // Heures Flow Line de la semaine en cours, pour un récit précis
  var CURRENT_WEEK = { '2026-10-05': 430, '2026-10-06': 410, '2026-10-07': 445, '2026-10-08': 200 };

  function buildTasks() {
    var order = { todo: 0, doing: 0, review: 0, done: 0 };
    return TASKS.map(function (t) {
      var x = t[11] || {};
      var task = {
        id: t[0], categoryId: t[1], title: t[2], client: t[3], status: t[4], priority: t[5], tags: t[6].slice(),
        startDate: t[7], endDate: t[8], progress: t[9],
        checklist: t[10].map(function (c, i) { return { id: t[0] + '-c' + (i + 1), label: c.slice(1), done: c.charAt(0) === '+' }; }),
        timeEntries: [],
        reminder: x.reminder ? { daysBefore: x.reminder } : null,
        description: x.desc || '',
        createdAt: x.created || t[7] || D.today(),
        updatedAt: x.completed || x.created || D.today(),
        completedAt: x.completed || null,
        order: order[t[4]]++
      };
      return task;
    });
  }

  // Fenêtre où Lamia a réellement travaillé sur la tâche
  function workWindow(t) {
    if (t.status === 'todo' || !t.startDate) return null;
    var end = t.completedAt || D.today();
    return [t.startDate, end];
  }

  function split(total, tasks, rand, date) {
    // Répartit des minutes entre 1 à 3 tâches actives, par blocs de 15 min
    var pool = tasks.slice().sort(function () { return rand() - 0.5; }).slice(0, Math.min(tasks.length, 1 + Math.floor(rand() * 3)));
    var weights = pool.map(function (t) { return { urgent: 4, high: 3, normal: 2, low: 1 }[t.priority] + rand(); });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var left = total;
    pool.forEach(function (t, i) {
      var m = i === pool.length - 1 ? left : Math.max(15, Math.round(total * weights[i] / sum / 15) * 15);
      m = Math.min(m, left);
      left -= m;
      if (m > 0) {
        t.timeEntries.push({
          id: t.id + '-e' + (t.timeEntries.length + 1), date: date, minutes: m,
          note: NOTES[Math.floor(rand() * NOTES.length)], source: rand() < 0.55 ? 'timer' : 'manual'
        });
      }
    });
  }

  function buildHours(tasks) {
    var rand = rng(20261008);
    var byCat = function (cat) { return tasks.filter(function (t) { return t.categoryId === cat; }); };
    var flow = byCat('flowline');
    var perso = tasks.filter(function (t) { return t.categoryId !== 'flowline'; });

    D.eachDay('2026-09-07', D.today()).forEach(function (day) {
      var w = D.dow(day);
      var active = function (list) {
        return list.filter(function (t) { var ww = workWindow(t); return ww && day >= ww[0] && day <= ww[1]; });
      };
      if (w >= 1 && w <= 5) {
        if (day === '2026-09-11') return;                 // journée off (cf. humeur)
        var total = CURRENT_WEEK[day] || (w === 5 ? 390 : 420) + [-30, -15, 0, 15, 30][Math.floor(rand() * 5)];
        var a = active(flow);
        if (a.length) split(total, a, rand, day);
      }
      if (w === 6) {
        ['carnet', 'auto'].forEach(function (cat) {
          var a = active(byCat(cat));
          if (a.length) split(150 + Math.floor(rand() * 5) * 15, a, rand, day);
        });
      }
    });

    // Quelques soirées perso
    function add(id, date, minutes, note) {
      var t = tasks.filter(function (x) { return x.id === id; })[0];
      t.timeEntries.push({ id: id + '-e' + (t.timeEntries.length + 1), date: date, minutes: minutes, note: note || '', source: 'manual' });
    }
    add('t14', '2026-09-22', 60, 'Vectorisation du logo');
    add('t16', '2026-10-06', 75, 'Grille et styles de paragraphe');
    add('t19', '2026-10-07', 45, 'Retours d’Ana sur les 3 pistes');
    void perso;
  }

  function buildMoods() {
    return MOODS.filter(function (m) { return m[1]; }).map(function (m) {
      return { date: m[0], level: m[1], note: m[2] || '' };
    });
  }

  L.seed = function () {
    var tasks = buildTasks();
    buildHours(tasks);
    return {
      version: 1,
      categories: CATEGORIES.map(function (c) { return Object.assign({}, c); }),
      tasks: tasks,
      moods: buildMoods(),
      settings: {
        theme: 'system',
        schedules: {
          flowline: { days: [1, 2, 3, 4, 5], weeklyHours: 35 },
          'auto-entreprise': { days: [6], weeklyHours: null }
        },
        reminders: { hour: 9 },
        ui: {
          dashPeriod: 'week',
          recapPeriod: 'week',
          recapAnchor: D.today(),
          tasksView: 'kanban',
          planningZoom: 'month',
          planningAnchor: D.today(),
          filters: { q: '', categories: [], priority: '', tag: '', client: '', status: '', due: '' },
          sort: { key: 'endDate', dir: 'asc' }
        }
      },
      // Chrono en cours (pause comprise) : ajout proposé au modèle de données
      timer: { taskId: 't03', startedAt: Date.now() - (72 * 60 + 18) * 1000, accumulatedMs: 0, pausedAt: null },
      lastTimerTaskId: 't03',
      flags: { lastOpenedOn: null, moodPromptedOn: null, remindersShownOn: null }
    };
  };

  L.data = { CATEGORIES: CATEGORIES };
})(window.Lamia = window.Lamia || {});
