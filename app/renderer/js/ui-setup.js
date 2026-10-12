/* ==========================================================================
   Plateforme de suivi — accueil d'un nouveau compte
   Quatre étapes, au premier lancement d'un compte tout neuf :
   1. prénom et personnage pixel ; 2. travail principal (nom, heures, jours) ;
   3. projets perso ou freelance (facultatif) ; 4. espaces Santé et Budget.
   Rien n'est enregistré avant « C'est parti ! » : fermer l'accueil le fait
   revenir à la prochaine ouverture. Tout reste modifiable ensuite (Profil,
   Réglages).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon, NB = U.NB;
  var ov = null, step = 0, done = null, casts = {};
  var STEPS = ['Bienvenue', 'Ton travail', 'Tes projets à côté', 'Tes espaces'];
  var CHARACTERS = [
    ['garcon', 'Cheveux bruns, raie au milieu, lunettes argent, barbe courte'],
    ['lamia', 'Cheveux noirs bouclés, lunettes rose gold']
  ];
  var o = null;

  function defaults() {
    return {
      name: '', nickname: '', jobs: '', city: '', character: 'garcon',
      workName: '', weeklyHours: 35, workDays: [1, 2, 3, 4, 5],
      side: false, sideName: '', sideDays: [6], sideMin: '',
      health: true, budget: true, startDay: 1
    };
  }

  function dayToggles(key, days) {
    return '<div class="day-toggles" role="group" aria-label="Jours">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      return '<button type="button" class="day-toggle" data-s-day="' + d + '" data-s-days="' + key + '" aria-pressed="' + (days.indexOf(d) >= 0) + '" aria-label="' + D.cap(D.DAYS[d]) + '">' + D.DAYS_LETTER[d] + '</button>';
    }).join('') + '</div>';
  }
  function field(id, label, value, opts) {
    opts = opts || {};
    return '<div class="field' + (opts.full ? ' field--full' : '') + '"><label class="label" for="' + id + '">' + label + '</label>' +
      '<input class="input" id="' + id + '" name="' + id + '"' + (opts.type ? ' type="' + opts.type + '"' : '') + (opts.attrs || '') +
      ' maxlength="' + (opts.max || 60) + '" placeholder="' + esc(opts.ph || '') + '" value="' + esc(value == null ? '' : value) + '">' +
      (opts.hint ? '<p class="hint">' + opts.hint + '</p>' : '') + '</div>';
  }
  function toggle(id, on, label, hint) {
    return '<label class="switch"><input class="switch__input" type="checkbox" role="switch" id="' + id + '" name="' + id + '"' + (on ? ' checked' : '') + '>' +
      '<span class="switch__track" aria-hidden="true"></span><span class="switch__label">' + label + '</span></label>' +
      (hint ? '<p class="hint">' + hint + '</p>' : '');
  }

  function body() {
    if (step === 0) {
      return '<p class="setup__lead">Quelques questions rapides pour que la plateforme soit à toi. Tout reste modifiable ensuite.</p>' +
        '<div class="setup__grid">' +
          field('s-name', 'Ton prénom', o.name, { ph: 'ex. Lucas', max: 40 }) +
          field('s-nick', 'Pseudo (facultatif)', o.nickname, { max: 40 }) +
          field('s-jobs', 'Ton métier (facultatif)', o.jobs, { ph: 'ex. Développeur web', max: 120, full: true }) +
          field('s-city', 'Ta ville (facultatif)', o.city, { max: 60 }) +
        '</div>' +
        '<fieldset class="setup__chars"><legend class="label">Ton personnage pixel</legend>' +
          '<div class="setup__char-list">' + CHARACTERS.map(function (c) {
            return '<button type="button" class="glass glass--nested setup__char" data-s-char="' + c[0] + '" aria-pressed="' + (o.character === c[0]) + '">' +
              '<canvas data-s-cast="' + c[0] + '" aria-hidden="true"></canvas><span>' + esc(c[1]) + '</span></button>';
          }).join('') + '</div>' +
          '<p class="hint">Il te salue sur le dashboard et fête tes réussites. Tu pourras aussi mettre une photo dans ton profil.</p>' +
        '</fieldset>';
    }
    if (step === 1) {
      return '<p class="setup__lead">Ton travail principal a son propre compteur d’heures, avec un objectif par semaine.</p>' +
        '<div class="setup__grid">' +
          field('s-work', 'Nom affiché', o.workName, { ph: 'ex. le nom de ton entreprise', max: 40, full: true }) +
          field('s-hours', 'Heures par semaine', o.weeklyHours, { type: 'number', attrs: ' min="1" max="70" step="0.5" inputmode="decimal"', max: 5 }) +
          '<div class="field"><span class="label">Jours travaillés</span>' + dayToggles('workDays', o.workDays) + '</div>' +
        '</div>';
    }
    if (step === 2) {
      return '<p class="setup__lead">Un projet perso, du freelance, une formation ? Il aura son compteur à part, jamais additionné au travail.</p>' +
        toggle('s-side', o.side, 'J’ai un projet à côté') +
        '<div class="setup__grid" data-s-side-box' + (o.side ? '' : ' hidden') + '>' +
          field('s-side-name', 'Nom affiché', o.sideName, { ph: 'ex. Freelance, Musique, Formation…', max: 40, full: true }) +
          '<div class="field"><span class="label">Jours perso</span>' + dayToggles('sideDays', o.sideDays) + '</div>' +
          field('s-side-min', 'Minimum par jour perso (facultatif)', o.sideMin, { type: 'number', attrs: ' min="0.5" max="16" step="0.5" inputmode="decimal"', max: 4, ph: 'ex. 2', hint: 'En heures. Vide : pas de minimum, juste un compteur.' }) +
        '</div>';
    }
    return '<p class="setup__lead">Choisis les espaces à afficher en plus de la productivité (tâches, planning, récap).</p>' +
      '<ul class="option-list" role="list">' +
        '<li>' + toggle('s-health', o.health, 'Santé', 'Poids, mensurations, alimentation et sport.') + '</li>' +
        '<li>' + toggle('s-budget', o.budget, 'Budget', 'Entrées, dépenses, factures et économies.') + '</li>' +
      '</ul>' +
      '<div class="field setup__payday" data-s-pay' + (o.budget ? '' : ' hidden') + '><label class="label" for="s-start">Ton mois budget commence le</label>' +
        '<select class="select" id="s-start" name="s-start">' + Array.apply(null, Array(28)).map(function (_, i) {
          return '<option value="' + (i + 1) + '"' + (o.startDay === i + 1 ? ' selected' : '') + '>' + (i + 1) + (i ? '' : 'er') + ' du mois</option>';
        }).join('') + '</select><p class="hint">Le jour de ta paie, ou la veille, pour que chaque mois parte avec ton salaire.</p></div>';
  }

  function render() {
    var last = step === STEPS.length - 1;
    ov.innerHTML =
      '<div class="modal modal--lg setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">' +
        '<form class="dialog-form" novalidate>' +
          '<div class="modal__header"><div><p class="eyebrow">Étape ' + (step + 1) + ' sur ' + STEPS.length + '</p>' +
            '<h2 class="modal__title" id="setup-title">' + (step === 0 ? 'Bienvenue sur ta plateforme de suivi' : STEPS[step]) + '</h2></div>' +
            '<ol class="setup__dots" aria-hidden="true">' + STEPS.map(function (_, i) { return '<li class="' + (i < step ? 'is-done' : i === step ? 'is-current' : '') + '"></li>'; }).join('') + '</ol></div>' +
          '<div class="modal__body">' + body() + '</div>' +
          '<div class="modal__footer">' +
            (step ? '<button type="button" class="btn btn--ghost" data-s-back>' + icon('chevron-left') + 'Retour</button>' : '<span></span>') +
            '<button type="submit" class="btn btn--primary">' + (last ? 'C’est parti !' + icon('sparkle') : 'Continuer' + icon('chevron-right')) + '</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    U.typo(ov);
    mountCasts();
    var f = ov.querySelector('input:not([type="checkbox"]), select');
    if (f) setTimeout(function () { f.focus(); }, 30);
  }

  function mountCasts() {
    Object.keys(casts).forEach(function (k) { try { casts[k].destroy(); } catch (e) { /* rien */ } delete casts[k]; });
    if (!window.PixelCast) return;
    ov.querySelectorAll('[data-s-cast]').forEach(function (c) {
      var id = c.getAttribute('data-s-cast');
      casts[id] = window.PixelCast.mount(c, id, { scale: 3, animation: 'idle' });
    });
  }

  // Lit l'étape affichée ; renvoie un message si un champ manque
  function read() {
    function v(id) { var n = ov.querySelector('#' + id); return n ? String(n.value).trim() : ''; }
    function num(id) { var x = parseFloat(v(id).replace(',', '.')); return isFinite(x) ? x : null; }
    if (step === 0) {
      o.name = v('s-name'); o.nickname = v('s-nick'); o.jobs = v('s-jobs'); o.city = v('s-city');
      if (!o.name) return { id: 's-name', msg: 'Écris ton prénom pour continuer.' };
    } else if (step === 1) {
      o.workName = v('s-work'); o.weeklyHours = num('s-hours');
      if (!o.workName) return { id: 's-work', msg: 'Donne un nom à ton travail (même « Travail » suffit).' };
      if (!(o.weeklyHours > 0)) return { id: 's-hours', msg: 'Indique tes heures par semaine.' };
      if (!o.workDays.length) return { msg: 'Choisis au moins un jour travaillé.' };
    } else if (step === 2) {
      o.side = ov.querySelector('#s-side').checked;
      o.sideName = v('s-side-name'); o.sideMin = v('s-side-min');
      if (o.side && !o.sideName) return { id: 's-side-name', msg: 'Donne un nom à ton projet.' };
      if (o.side && !o.sideDays.length) return { msg: 'Choisis au moins un jour perso.' };
    } else {
      o.health = ov.querySelector('#s-health').checked;
      o.budget = ov.querySelector('#s-budget').checked;
      o.startDay = +v('s-start') || 1;
    }
    return null;
  }

  function finish() {
    var min = parseFloat(String(o.sideMin).replace(',', '.'));
    S.finishSetup({
      name: o.name, nickname: o.nickname, jobs: o.jobs, city: o.city, character: o.character,
      workName: o.workName, weeklyHours: o.weeklyHours, workDays: o.workDays.slice().sort(),
      side: o.side, sideName: o.sideName, sideDays: o.sideDays.slice().sort(), sideMin: min > 0 ? min : null,
      health: o.health, budget: o.budget, startDay: o.startDay
    });
    var cb = done; done = null;
    U.closeLayer(ov, 'done');
    L.fun.celebrate({ title: 'Bienvenue, ' + o.name + NB + '!', text: 'Ta plateforme est prête. Commence par ajouter une tâche.', duration: 4200 });
    if (cb) setTimeout(cb, 4400);
  }

  function open(cb) {
    done = cb || null;
    o = defaults();
    step = 0;
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'overlay overlay--setup';
      ov.id = 'overlay-setup';
      ov.hidden = true;
      document.body.appendChild(ov);
      ov.addEventListener('submit', function (e) {
        e.preventDefault();
        var err = read();
        if (err) {
          U.toast({ kind: 'warning', icon: 'alert', title: 'Il manque une info', text: err.msg, duration: 4000 });
          if (err.id) { var n = ov.querySelector('#' + err.id); if (n) n.focus(); }
          return;
        }
        if (step === STEPS.length - 1) { finish(); return; }
        step += 1; render();
      });
      ov.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('[data-s-back]')) { read(); step = Math.max(0, step - 1); render(); return; }
        if ((b = e.target.closest('[data-s-char]'))) {
          o.character = b.getAttribute('data-s-char');
          ov.querySelectorAll('[data-s-char]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          if (casts[o.character]) casts[o.character].play('wave');
          return;
        }
        if ((b = e.target.closest('[data-s-day]'))) {
          var key = b.getAttribute('data-s-days'), d = +b.getAttribute('data-s-day'), list = o[key];
          var i = list.indexOf(d);
          if (i >= 0) list.splice(i, 1); else list.push(d);
          b.setAttribute('aria-pressed', String(i < 0));
        }
      });
      ov.addEventListener('change', function (e) {
        if (e.target.id === 's-side') { var box = ov.querySelector('[data-s-side-box]'); if (box) box.hidden = !e.target.checked; }
        if (e.target.id === 's-budget') { var pay = ov.querySelector('[data-s-pay]'); if (pay) pay.hidden = !e.target.checked; }
      });
    }
    render();
    U.openLayer(ov, {
      initialFocus: '#s-name',
      onClose: function (reason) {
        Object.keys(casts).forEach(function (k) { try { casts[k].destroy(); } catch (e) { /* rien */ } delete casts[k]; });
        // Fermé sans finir : l'accueil reviendra à la prochaine ouverture
        if (reason !== 'done' && done) { var cb = done; done = null; cb(); }
      }
    });
  }

  L.setup = { open: open };
})(window.Lamia = window.Lamia || {});
