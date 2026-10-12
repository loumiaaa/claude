/* ==========================================================================
   Plateforme de suivi - Lamia — page Profil
   Identité, direction (objectifs reliés aux tâches, mot de l'année, valeurs,
   bucket list, frise de vie) et le côté « moi » (favoris, artistes et
   concerts, animaux, galerie). Tout se remplit et se modifie ici.
   Les photos sont réduites (JPEG) avant d'être enregistrées.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var el = null, avatarCtrl = {};

  var BUCKET_KINDS = [['voyage', 'Voyage', 'planning'], ['concert', 'Concert', 'note'], ['experience', 'Expérience', 'sparkle']];
  var FAVS = [['music', 'Musique', 'note'], ['game', 'Jeu', 'sparkle'], ['series', 'Série', 'eye'], ['book', 'Livre', 'note']];

  function P() { return S.profile(); }
  function warn(t, x) { U.toast({ kind: 'warning', icon: 'alert', title: t, text: x || '', duration: 4000 }); }
  function card(id, title, subtitle, body, cls, action) {
    return '<section class="glass card profile-card ' + (cls || '') + '" aria-labelledby="' + id + '-h"><div class="card__header"><div><h2 class="card__title" id="' + id + '-h">' + title + '</h2>' +
      (subtitle ? '<p class="card__subtitle">' + subtitle + '</p>' : '') + '</div>' + (action || '') + '</div>' + body + '</section>';
  }
  function iconBtn(attr, ic, label) { return '<button type="button" class="btn btn--ghost btn--icon btn--sm" ' + attr + ' aria-label="' + esc(label) + '">' + icon(ic) + '</button>'; }
  function edDel(kind, id, label) { return '<span class="health-list__actions">' + iconBtn('data-p-edit="' + kind + '" data-id="' + id + '"', 'edit', 'Modifier ' + label) + iconBtn('data-p-del="' + kind + '" data-id="' + id + '"', 'trash', 'Supprimer ' + label) + '</span>'; }
  function field(id, label, value, opts) {
    opts = opts || {};
    var input = opts.textarea
      ? '<textarea class="textarea" id="' + id + '" name="' + (opts.name || id) + '" rows="3" maxlength="' + (opts.max || 400) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(value || '') + '</textarea>'
      : '<input class="input" id="' + id + '" name="' + (opts.name || id) + '" ' + (opts.type ? 'type="' + opts.type + '" ' : '') + 'maxlength="' + (opts.max || 120) + '" placeholder="' + esc(opts.ph || '') + '" value="' + esc(value || '') + '">';
    return '<div class="field' + (opts.full ? ' field--full' : '') + '"><label class="label" for="' + id + '">' + label + '</label>' + input + (opts.hint ? '<p class="hint">' + opts.hint + '</p>' : '') + '</div>';
  }
  function select(id, label, name, options, value) {
    return '<div class="field"><label class="label" for="' + id + '">' + label + '</label><select class="select" id="' + id + '" name="' + name + '">' +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function fd(form) { var f = new FormData(form), o = {}; f.forEach(function (v, k) { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; }

  /* --- Photos : réduites avant l'enregistrement --------------------------------- */
  function shrink(file, max, quality) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Ce fichier n’est pas une image.')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality || 0.8));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
      img.src = url;
    });
  }
  function pickImages(multiple) {
    return new Promise(function (resolve) {
      var i = document.createElement('input');
      i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multiple;
      i.addEventListener('change', function () { resolve([].slice.call(i.files || [])); });
      i.click();
    });
  }

  /* --- Avatar : la photo, sinon Lamia en pixel art -------------------------------- */
  function avatarHTML(cls) {
    var ph = P().photo;
    var inner = ph ? '<img class="avatar-img" src="' + ph + '" alt="">' : '<canvas class="avatar-pixel" data-avatar-pixel aria-hidden="true"></canvas>';
    return cls ? '<span class="avatar-frame ' + cls + '">' + inner + '</span>' : inner;
  }
  function mountPixelAvatars(root, key) {
    root.querySelectorAll('[data-avatar-pixel]').forEach(function (c, i) {
      var k = key + i;
      if (avatarCtrl[k]) { try { avatarCtrl[k].destroy(); } catch (e) { /* rien */ } }
      if (window.PixelCast) avatarCtrl[k] = window.PixelCast.mount(c, 'lamia', { scale: c.closest('.avatar--xl') ? 5 : 2, animation: 'idle' });
    });
  }
  // Pastille de la barre latérale et de la barre du haut
  function refreshBrand() {
    document.querySelectorAll('.brand__mark').forEach(function (m, i) {
      m.classList.add('brand__mark--avatar');
      m.innerHTML = avatarHTML('');
    });
    document.querySelectorAll('a.brand').forEach(function (a) { a.setAttribute('href', '#profil'); a.setAttribute('aria-label', 'Mon profil'); });
    mountPixelAvatars(document.querySelector('.sidebar') || document, 'brand-side');
    var top = document.querySelector('.topbar');
    if (top) mountPixelAvatars(top, 'brand-top');
  }

  /* --- Objectifs reliés au suivi des tâches ------------------------------------------ */
  function linkOptions() {
    var tags = {};
    S.get().tasks.forEach(function (t) { (t.tags || []).forEach(function (g) { tags[g] = true; }); });
    return [['', 'Aucun (je règle à la main)']]
      .concat(S.get().categories.map(function (c) { return ['cat:' + c.id, 'Catégorie : ' + c.name]; }))
      .concat(Object.keys(tags).sort().map(function (g) { return ['tag:' + g, 'Étiquette : #' + g]; }));
  }
  function goalProgress(g) {
    if (g.link) {
      var kind = g.link.slice(0, 4), val = g.link.slice(4);
      var tasks = S.get().tasks.filter(function (t) { return kind === 'cat:' ? t.categoryId === val : (t.tags || []).indexOf(val) >= 0; });
      var done = tasks.filter(function (t) { return t.status === 'done'; }).length;
      return { pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0, label: done + '/' + tasks.length + ' tâche' + (tasks.length > 1 ? 's' : '') + ' terminée' + (done > 1 ? 's' : '') };
    }
    var p = Math.max(0, Math.min(100, +g.progress || 0));
    return { pct: p, label: p + NB + '% (réglé à la main)' };
  }
  function linkLabel(link) { var o = linkOptions().filter(function (x) { return x[0] === link; })[0]; return o && link ? o[1] : ''; }

  /* --- Rendu --------------------------------------------------------------------------- */
  function render() {
    if (!el) return;
    var pr = P();
    var idLine = [pr.city && icon('planning') + '<span>' + esc(pr.city) + '</span>', pr.astro && icon('sparkle') + '<span>' + esc(pr.astro) + '</span>'].filter(Boolean).join('<span aria-hidden="true">·</span>');

    var header =
      '<section class="glass profile-hero" aria-labelledby="h-profile">' +
        '<div class="profile-hero__avatar">' + avatarHTML('avatar--xl') +
          '<div class="profile-hero__photo-actions">' +
            '<button type="button" class="btn btn--secondary btn--sm" data-p-photo>' + icon('upload') + (pr.photo ? 'Changer la photo' : 'Ajouter une photo') + '</button>' +
            (pr.photo ? '<button type="button" class="btn btn--ghost btn--sm" data-p-photo-clear>Utiliser mon avatar pixel</button>' : '') +
          '</div></div>' +
        '<div class="profile-hero__text">' +
          '<p class="eyebrow">Mon profil</p>' +
          '<h1 class="h1" id="h-profile" tabindex="-1">' + esc(pr.name || 'Ton prénom') + (pr.nickname ? ' <span class="profile-hero__nick">« ' + esc(pr.nickname) + ' »</span>' : '') + '</h1>' +
          (pr.jobs ? '<p class="profile-hero__jobs">' + icon('briefcase') + '<span>' + esc(pr.jobs) + '</span></p>' : '') +
          (idLine ? '<p class="profile-hero__meta">' + idLine + '</p>' : '') +
          (pr.word ? '<p class="profile-hero__word"><span>Mot de l’année</span>' + esc(pr.word) + '</p>' : '') +
          '<button type="button" class="btn btn--secondary btn--sm" data-p-identity>' + icon('edit') + 'Modifier mon identité</button>' +
        '</div>' +
      '</section>';

    // Direction
    var goals = pr.goals.length ? '<ul class="goal-list" role="list">' + pr.goals.map(function (g) {
      var p = goalProgress(g);
      return '<li><div class="goal-list__head"><strong>' + esc(g.title) + '</strong>' + edDel('goals', g.id, g.title) + '</div>' +
        '<div class="progress" style="--value:' + p.pct + '" role="progressbar" aria-valuenow="' + p.pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(g.title) + '"></div>' +
        '<p class="hint">' + p.pct + NB + '% · ' + esc(p.label) + (g.link ? ' · ' + esc(linkLabel(g.link)) : '') + '</p></li>';
    }).join('') + '</ul>' : '<p class="hint">Jusqu’à 5 objectifs pour l’année. Relie-les à une catégorie ou à une étiquette de tes tâches : la barre avance toute seule.</p>';
    var goalAdd = pr.goals.length < 5 ? '<button type="button" class="btn btn--primary btn--sm" data-p-add="goals">' + icon('plus') + 'Ajouter un objectif</button>' : '<p class="hint">5 objectifs, c’est le maximum : on reste concentrée.</p>';

    var word = '<form class="inline-form" data-p-word novalidate><label class="sr-only" for="p-word">Mot de l’année ou intention</label>' +
      '<input class="input input--word" id="p-word" name="word" maxlength="60" placeholder="ex. Oser, Équilibre, Créer…" value="' + esc(pr.word) + '" data-focus-key="p-word">' +
      '<button type="submit" class="btn btn--secondary btn--sm">Enregistrer</button></form>';

    var values = chips('values', pr.values, 'ex. Créativité, bienveillance, liberté…');

    var bucket = '<ul class="bucket-list" role="list">' + pr.bucket.map(function (b) {
      var k = BUCKET_KINDS.filter(function (x) { return x[0] === b.kind; })[0] || BUCKET_KINDS[2];
      return '<li class="' + (b.done ? 'is-done' : '') + '"><label class="checkbox checkbox--strike"><input class="checkbox__input" type="checkbox" data-p-done="' + b.id + '"' + (b.done ? ' checked' : '') + '><span class="checkbox__box" aria-hidden="true"></span>' +
        '<span class="checkbox__label">' + esc(b.text) + '</span></label><span class="tag">' + icon(k[2]) + k[1] + '</span>' + edDel('bucket', b.id, b.text) + '</li>';
    }).join('') + '</ul>' + (pr.bucket.length ? '' : '<p class="hint">Voyages, concerts, expériences : tout ce que tu veux vivre.</p>') +
      '<form class="inline-form" data-p-form="bucket" novalidate><label class="sr-only" for="p-bk">Nouvelle envie</label><input class="input" id="p-bk" name="text" maxlength="100" placeholder="ex. Voir les aurores boréales" data-focus-key="p-bk">' +
      '<label class="sr-only" for="p-bk-k">Type</label><select class="select" id="p-bk-k" name="kind">' + BUCKET_KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + '</option>'; }).join('') + '</select>' +
      '<button type="submit" class="btn btn--secondary btn--icon" aria-label="Ajouter à la bucket list" data-focus-key="p-bk-add">' + icon('plus') + '</button></form>';

    var tl = pr.timeline.slice().sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
    var timeline = (tl.length ? '<ol class="life-line">' + tl.map(function (t) {
      return '<li><span class="life-line__date">' + esc(t.date) + '</span><div class="life-line__body"><strong>' + esc(t.title) + '</strong>' + (t.note ? '<p>' + esc(t.note) + '</p>' : '') + '</div>' + edDel('timeline', t.id, t.title) + '</li>';
    }).join('') + '</ol>' : '<p class="hint">Diplôme, premier CDI, lancement en freelance… tes grands moments, dans l’ordre.</p>') +
      '<button type="button" class="btn btn--secondary btn--sm" data-p-add="timeline">' + icon('plus') + 'Ajouter un moment</button>';

    // Le côté « moi »
    var favs = '<dl class="fav-grid">' + FAVS.map(function (f) {
      return '<div class="fav"><dt>' + icon(f[2]) + f[1] + '</dt><dd>' + (pr.favorites[f[0]] ? esc(pr.favorites[f[0]]) : '<span class="text-subtle">—</span>') + '</dd></div>';
    }).join('') + '</dl>';
    var artists = chips('artists', pr.artists, 'ex. Angèle, Daft Punk…');
    var concerts = (pr.concerts.length ? '<ul class="health-list" role="list">' + pr.concerts.slice().sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; }).map(function (c) {
      return '<li><span class="health-list__date">' + esc(c.date || '') + '</span><strong>' + esc(c.artist) + '</strong><span class="text-subtle">' + esc(c.place || '') + '</span>' + edDel('concerts', c.id, c.artist) + '</li>';
    }).join('') + '</ul>' : '<p class="hint">Les concerts que tu as vus, pour t’en souvenir.</p>') +
      '<button type="button" class="btn btn--secondary btn--sm" data-p-add="concerts">' + icon('plus') + 'Ajouter un concert</button>';

    var pets = '<div class="pet-grid">' + pr.pets.map(function (p) {
      var age = petAge(p.birth);
      var pic = p.photo ? '<img class="pet-card__photo" src="' + p.photo + '" alt="' + esc(p.name) + '">' : (/memeow/i.test(p.name) ? '<canvas class="pet-card__pixel" data-pet-pixel aria-hidden="true"></canvas>' : '<span class="pet-card__placeholder">' + icon('heart') + '</span>');
      return '<article class="glass glass--nested pet-card"><div class="pet-card__pic">' + pic + '</div><div class="pet-card__body">' +
        '<div class="pet-card__head"><strong>' + esc(p.name) + '</strong>' + edDel('pets', p.id, p.name) + '</div>' +
        '<p class="pet-card__meta">' + esc(p.species || '') + (age ? ' · ' + age : '') + '</p>' + (p.traits ? '<p class="pet-card__traits">' + esc(p.traits) + '</p>' : '') +
        '<button type="button" class="btn btn--ghost btn--sm" data-p-pet-photo="' + p.id + '">' + icon('upload') + (p.photo ? 'Changer la photo' : 'Ajouter une photo') + '</button></div></article>';
    }).join('') + '</div><button type="button" class="btn btn--secondary btn--sm" data-p-add="pets">' + icon('plus') + 'Ajouter un animal</button>';

    var gallery = '<div class="gallery">' + pr.gallery.map(function (g) {
      return '<figure class="gallery__item"><button type="button" class="gallery__open" data-p-view="' + g.id + '" aria-label="Agrandir' + (g.caption ? ' : ' + esc(g.caption) : '') + '"><img src="' + g.src + '" alt="' + esc(g.caption || '') + '"></button>' +
        (g.caption ? '<figcaption>' + esc(g.caption) + '</figcaption>' : '') + '<span class="gallery__actions">' + edDel('gallery', g.id, 'la photo') + '</span></figure>';
    }).join('') + (pr.gallery.length < 12 ? '<button type="button" class="gallery__add" data-p-gallery>' + icon('plus') + '<span>Ajouter des photos</span></button>' : '') + '</div>';

    el.innerHTML = header +
      '<h2 class="profile-section">' + icon('target') + 'Direction</h2>' +
      '<div class="profile-grid">' +
        card('p-goals', 'Objectifs de l’année', pr.goals.length + '/5', goals + goalAdd, 'profile-card--wide') +
        card('p-word', 'Mot de l’année', 'Ou ton intention du moment', word) +
        card('p-values', 'Mes valeurs', 'Ce qui compte, pour t’aider à choisir', values) +
        card('p-bucket', 'Bucket list', pr.bucket.filter(function (b) { return b.done; }).length + ' vécu' + (pr.bucket.filter(function (b) { return b.done; }).length > 1 ? 's' : '') + ' sur ' + pr.bucket.length, bucket, 'profile-card--wide') +
        card('p-timeline', 'Frise de vie', 'Les grands moments', timeline, 'profile-card--wide') +
      '</div>' +
      '<h2 class="profile-section">' + icon('heart') + 'Ce que j’aime</h2>' +
      '<div class="profile-grid">' +
        card('p-favs', 'Favoris du moment', '', favs, '', iconBtn('data-p-favs', 'edit', 'Modifier mes favoris')) +
        card('p-artists', 'Artistes & groupes', '', artists) +
        card('p-concerts', 'Concerts vus', pr.concerts.length ? U.plural(pr.concerts.length, 'concert') : '', concerts, 'profile-card--wide') +
        card('p-pets', 'Mes animaux', '', pets, 'profile-card--wide') +
        card('p-gallery', 'Galerie', 'Quelques photos que j’aime', gallery, 'profile-card--wide') +
      '</div>';
    mountPixelAvatars(el, 'profile');
    el.querySelectorAll('[data-pet-pixel]').forEach(function (c, i) {
      if (avatarCtrl['pet' + i]) avatarCtrl['pet' + i].destroy();
      if (window.PixelCast) avatarCtrl['pet' + i] = window.PixelCast.mount(c, 'memeow', { scale: 3, animation: 'idle' });
    });
  }

  function chips(kind, list, ph) {
    return '<ul class="chip-list" role="list">' + list.map(function (v, i) {
      return '<li class="chip chip--removable">' + esc(v) + '<button type="button" data-p-chip-del="' + kind + '" data-i="' + i + '" aria-label="Retirer ' + esc(v) + '">' + icon('close') + '</button></li>';
    }).join('') + '</ul>' +
      '<form class="inline-form" data-p-chip="' + kind + '" novalidate><label class="sr-only" for="p-c-' + kind + '">Ajouter</label><input class="input" id="p-c-' + kind + '" name="v" maxlength="40" placeholder="' + esc(ph) + '" data-focus-key="p-c-' + kind + '">' +
      '<button type="submit" class="btn btn--secondary btn--icon" aria-label="Ajouter" data-focus-key="p-c-' + kind + '-add">' + icon('plus') + '</button></form>';
  }

  function petAge(birth) {
    if (!birth) return '';
    var b = /^\d{4}$/.test(birth) ? birth + '-07-01' : birth;
    if (!D.valid(b)) return '';
    var months = Math.floor(D.diff(b, D.today()) / 30.44);
    if (months < 0) return '';
    if (months < 12) return months + NB + 'mois';
    var y = Math.floor(months / 12);
    return y + NB + 'an' + (y > 1 ? 's' : '');
  }

  /* --- Formulaires (ajout et modification) ------------------------------------------------ */
  var FORMS = {
    goals: function (g) {
      return field('f-title', 'Objectif', g.title, { name: 'title', ph: 'ex. Valider mon BTS, 10 clients freelance…' }) +
        select('f-link', 'Progression reliée à', 'link', linkOptions(), g.link || '') +
        field('f-progress', 'Progression manuelle (%)', g.progress != null ? String(g.progress) : '', { name: 'progress', ph: '0 à 100', hint: 'Utilisée seulement si l’objectif n’est relié à rien.' });
    },
    timeline: function (t) {
      return field('f-date', 'Date ou année', t.date, { name: 'date', ph: 'ex. 2019 ou 2022-09' }) +
        field('f-title', 'Moment', t.title, { name: 'title', ph: 'ex. Diplôme, premier CDI, lancement freelance…' }) +
        field('f-note', 'Quelques mots', t.note, { name: 'note', textarea: true, full: true });
    },
    concerts: function (c) {
      return field('f-artist', 'Artiste ou groupe', c.artist, { name: 'artist' }) +
        field('f-date', 'Date', c.date, { name: 'date', ph: 'ex. 2025-06-14 ou 2024' }) +
        field('f-place', 'Lieu', c.place, { name: 'place', ph: 'ex. Halle Tony Garnier, Lyon' });
    },
    pets: function (p) {
      return field('f-name', 'Nom', p.name, { name: 'name' }) + field('f-species', 'Espèce', p.species, { name: 'species', ph: 'ex. Chatte, chien…' }) +
        field('f-birth', 'Naissance', p.birth, { name: 'birth', ph: 'ex. 2021 ou 2021-04-12' }) +
        field('f-traits', 'Sa fiche : caractère, habitudes, santé…', p.traits, { name: 'traits', textarea: true, full: true, max: 600 });
    },
    bucket: function (b) {
      return field('f-text', 'Envie', b.text, { name: 'text' }) + select('f-kind', 'Type', 'kind', BUCKET_KINDS.map(function (k) { return [k[0], k[1]]; }), b.kind);
    },
    gallery: function (g) { return field('f-caption', 'Légende', g.caption, { name: 'caption', ph: 'ex. Vacances à Annecy' }); }
  };
  var TITLES = { goals: 'objectif', timeline: 'moment', concerts: 'concert', pets: 'animal', bucket: 'envie', gallery: 'photo' };
  function clean(kind, v) {
    if (kind === 'goals') {
      if (!v.title) return { err: 'Donne un titre à ton objectif.' };
      var pr = v.progress === '' ? null : Math.max(0, Math.min(100, parseInt(v.progress, 10) || 0));
      return { val: { title: v.title, link: v.link || '', progress: pr } };
    }
    if (kind === 'timeline') return v.title ? { val: { date: v.date, title: v.title, note: v.note } } : { err: 'Écris le moment.' };
    if (kind === 'concerts') return v.artist ? { val: { artist: v.artist, date: v.date, place: v.place } } : { err: 'Indique l’artiste ou le groupe.' };
    if (kind === 'pets') return v.name ? { val: { name: v.name, species: v.species, birth: v.birth, traits: v.traits } } : { err: 'Indique son nom.' };
    if (kind === 'bucket') return v.text ? { val: { text: v.text, kind: v.kind } } : { err: 'Écris ton envie.' };
    if (kind === 'gallery') return { val: { caption: v.caption } };
    return { val: v };
  }
  function openForm(kind, id, btn) {
    var it = id ? P()[kind].filter(function (x) { return x.id === id; })[0] : {};
    if (id && !it) return;
    U.dialog({
      title: (id ? 'Modifier : ' : 'Ajouter : ') + TITLES[kind], confirmLabel: id ? 'Enregistrer' : 'Ajouter', returnTo: btn,
      fallbackFocus: function () { return document.getElementById('h-profile'); },
      body: '<div class="health-form profile-form">' + FORMS[kind](it) + '</div>',
      onConfirm: function (form) {
        var r = clean(kind, fd(form));
        if (r.err) { warn('À compléter', r.err); return false; }
        if (id) S.updateProfileItem(kind, id, r.val);
        else S.addProfileItem(kind, Object.assign(r.val, kind === 'pets' ? { photo: null } : {}));
        U.toast({ icon: 'check', title: id ? 'Modification enregistrée' : 'Ajouté !', duration: 2500 });
      }
    });
  }
  function editIdentity(btn) {
    var pr = P();
    U.dialog({
      title: 'Mon identité', confirmLabel: 'Enregistrer', returnTo: btn,
      body: '<div class="health-form profile-form">' +
        field('i-name', 'Nom', pr.name, { name: 'name' }) + field('i-nick', 'Pseudo', pr.nickname, { name: 'nickname', ph: 'facultatif' }) +
        field('i-jobs', 'Métier(s)', pr.jobs, { name: 'jobs', full: true, max: 200 }) +
        field('i-city', 'Ville', pr.city, { name: 'city' }) + field('i-astro', 'Signe astro', pr.astro, { name: 'astro', ph: 'ex. Sagittaire ascendant Lion' }) +
        field('i-word', 'Mot de l’année ou intention', pr.word, { name: 'word', full: true, max: 60 }) + '</div>',
      onConfirm: function (form) {
        var v = fd(form);
        S.setProfile({ name: v.name, nickname: v.nickname, jobs: v.jobs, city: v.city, astro: v.astro, word: v.word });
        U.toast({ icon: 'check', title: 'Profil mis à jour', duration: 2500 });
      }
    });
  }
  function editFavs(btn) {
    var f = P().favorites;
    U.dialog({
      title: 'Mes favoris du moment', confirmLabel: 'Enregistrer', returnTo: btn,
      body: '<div class="health-form profile-form">' + FAVS.map(function (x) { return field('fv-' + x[0], x[1], f[x[0]], { name: x[0], max: 100 }); }).join('') + '</div>',
      onConfirm: function (form) { var v = fd(form); S.setProfile({ favorites: { music: v.music, game: v.game, series: v.series, book: v.book } }); }
    });
  }

  /* --- Événements ------------------------------------------------------------------------------ */
  function mount(node) {
    el = node;
    el.addEventListener('submit', function (e) {
      var f = e.target;
      e.preventDefault();
      if (f.hasAttribute('data-p-word')) { S.setProfile({ word: fd(f).word }); U.toast({ icon: 'sparkle', title: fd(f).word ? 'Mot de l’année : ' + fd(f).word : 'Mot de l’année retiré', duration: 2500 }); return; }
      var ck = f.getAttribute('data-p-chip');
      if (ck) {
        var v = fd(f).v;
        if (!v) return;
        if (P()[ck].indexOf(v) < 0) S.setProfile((function () { var o = {}; o[ck] = P()[ck].concat([v]); return o; })());
        return;
      }
      if (f.getAttribute('data-p-form') === 'bucket') {
        var r = clean('bucket', fd(f));
        if (r.err) { warn('À compléter', r.err); return; }
        S.addProfileItem('bucket', Object.assign(r.val, { done: false }));
      }
    });
    el.addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-p-done');
      if (!id) return;
      S.updateProfileItem('bucket', id, { done: e.target.checked });
      if (e.target.checked) L.fun.celebrate({ title: 'Une envie de vécue !', text: (P().bucket.filter(function (b) { return b.id === id; })[0] || {}).text });
    });
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-p-identity]'))) { editIdentity(b); return; }
      if ((b = e.target.closest('[data-p-favs]'))) { editFavs(b); return; }
      if ((b = e.target.closest('[data-p-add]'))) { openForm(b.getAttribute('data-p-add'), null, b); return; }
      if ((b = e.target.closest('[data-p-edit]'))) { openForm(b.getAttribute('data-p-edit'), b.getAttribute('data-id'), b); return; }
      if ((b = e.target.closest('[data-p-del]'))) {
        var kind = b.getAttribute('data-p-del'), id = b.getAttribute('data-id'), item = P()[kind].filter(function (x) { return x.id === id; })[0];
        S.removeProfileItem(kind, id);
        U.toast({ icon: 'trash', title: 'Supprimé', duration: 6000, actions: [{ label: 'Annuler', fn: function () { var c = Object.assign({}, item); delete c.id; S.addProfileItem(kind, c); } }] });
        return;
      }
      if ((b = e.target.closest('[data-p-chip-del]'))) {
        var k = b.getAttribute('data-p-chip-del'), list = P()[k].slice();
        list.splice(+b.getAttribute('data-i'), 1);
        var o = {}; o[k] = list; S.setProfile(o);
        return;
      }
      if (e.target.closest('[data-p-photo]')) {
        pickImages(false).then(function (files) { if (!files.length) return; return shrink(files[0], 480, 0.85).then(function (src) { S.setProfile({ photo: src }); refreshBrand(); }); })
          .catch(function (x) { warn('Photo non ajoutée', x.message); });
        return;
      }
      if (e.target.closest('[data-p-photo-clear]')) { S.setProfile({ photo: null }); refreshBrand(); return; }
      if ((b = e.target.closest('[data-p-pet-photo]'))) {
        var pid = b.getAttribute('data-p-pet-photo');
        pickImages(false).then(function (files) { if (!files.length) return; return shrink(files[0], 480, 0.82).then(function (src) { S.updateProfileItem('pets', pid, { photo: src }); }); })
          .catch(function (x) { warn('Photo non ajoutée', x.message); });
        return;
      }
      if (e.target.closest('[data-p-gallery]')) {
        var room = 12 - P().gallery.length;
        pickImages(true).then(function (files) {
          return Promise.all(files.slice(0, room).map(function (f) { return shrink(f, 1000, 0.78); })).then(function (srcs) {
            srcs.forEach(function (src) { S.addProfileItem('gallery', { src: src, caption: '' }); });
            if (srcs.length) U.toast({ icon: 'check', title: U.plural(srcs.length, 'photo') + ' ajoutée' + (srcs.length > 1 ? 's' : ''), text: 'Le crayon permet d’ajouter une légende.', duration: 3500 });
          });
        }).catch(function (x) { warn('Photo non ajoutée', x.message); });
        return;
      }
      if ((b = e.target.closest('[data-p-view]'))) {
        var g = P().gallery.filter(function (x) { return x.id === b.getAttribute('data-p-view'); })[0];
        if (g) U.dialog({ title: g.caption || 'Photo', confirmLabel: 'Fermer', returnTo: b, body: '<img class="gallery__big" src="' + g.src + '" alt="' + esc(g.caption || '') + '">' });
      }
    });
    S.subscribe(function (type) {
      if (type !== 'profile' && type !== 'reset' && type.indexOf('task') !== 0) return;
      if (type === 'profile' || type === 'reset') refreshBrand();
      if (L.app.view() !== 'profile') { el.dataset.stale = '1'; return; }
      U.keepFocus(el, render);
    });
    refreshBrand();
  }

  L.views = L.views || {};
  L.views.profile = { mount: mount, render: render, show: function () { if (!el.firstChild || el.dataset.stale) { delete el.dataset.stale; render(); } }, title: 'Mon profil' };
})(window.Lamia = window.Lamia || {});
