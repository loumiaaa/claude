/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · humeur du jour
   Proposée à la première ouverture de la journée. Un clic suffit à
   enregistrer ; la note est facultative ; « Plus tard » ne bloque rien.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates, S = L.store, U = L.ui;
  var esc = U.esc, icon = U.icon;
  var ov = null;

  function optionsHTML(current, name) {
    return U.MOODS.map(function (m) {
      return '<button type="button" class="mood-option" data-mood="' + m.level + '" aria-pressed="' + (current === m.level) + '"' + (name ? ' data-mood-scope="' + name + '"' : '') + '>' +
        '<span class="mood-option__art">' + U.pixelImg('mood-' + m.level, 3, '', '') + '</span>' +
        '<span class="mood-option__label">' + esc(m.label) + '</span></button>';
    }).join('');
  }

  function open(opts) {
    opts = opts || {};
    ov = ov || document.getElementById('overlay-mood');
    var today = D.today();
    var m = L.q.mood(today);
    ov.innerHTML =
      '<div class="modal mood-modal" role="dialog" aria-modal="true" aria-labelledby="mood-title" aria-describedby="mood-desc">' +
        '<div class="modal__header"><div>' +
          '<p class="eyebrow">' + esc(D.cap(D.long(today))) + '</p>' +
          '<h2 class="modal__title" id="mood-title">Comment te sens-tu aujourd’hui ?</h2>' +
          '<p class="modal__desc" id="mood-desc">Un clic suffit. Tu pourras changer d’avis dans la journée.</p></div>' +
          '<button type="button" class="btn btn--ghost btn--icon" data-mood-close aria-label="Fermer">' + icon('close') + '</button></div>' +
        '<div class="modal__body">' +
          '<div class="mood-picker" role="group" aria-label="Humeur du jour">' + optionsHTML(m ? m.level : null) + '</div>' +
          '<p class="mood-status" data-mood-status aria-live="polite">' + (m ? 'C’est noté : ' + esc(U.moodLabel(m.level)) + '.' : '') + '</p>' +
          '<div class="field"><label class="label" for="mood-note">Un mot sur ta journée <span class="label__optional">facultatif</span></label>' +
            '<input class="input" id="mood-note" maxlength="140" placeholder="Une victoire, une envie, un nuage…" value="' + esc(m ? m.note : '') + '"></div>' +
        '</div>' +
        '<div class="modal__footer">' +
          '<button type="button" class="btn btn--ghost" data-mood-close>' + (m ? 'Fermer' : 'Plus tard') + '</button>' +
          '<button type="button" class="btn btn--primary" data-mood-done' + (m ? '' : ' disabled') + '>' + icon('check') + 'C’est noté</button>' +
        '</div>' +
      '</div>';

    var picker = ov.querySelector('.mood-picker');
    var status = ov.querySelector('[data-mood-status]');
    var note = ov.querySelector('#mood-note');
    var done = ov.querySelector('[data-mood-done]');

    picker.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mood]');
      if (!b) return;
      var lv = +b.getAttribute('data-mood');
      U.$$('[data-mood]', picker).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      S.setMood(today, lv, note.value.trim());
      status.textContent = 'C’est noté : ' + U.moodLabel(lv) + '. Merci de prendre ce petit temps pour toi.';
      done.disabled = false;
      ov.querySelector('[data-mood-close]:not(.btn--icon)').textContent = 'Fermer';
    });
    // Flèches gauche / droite dans le sélecteur
    picker.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var list = U.$$('[data-mood]', picker);
      var i = list.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length].focus();
    });
    note.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !done.disabled) { e.preventDefault(); done.click(); } });
    done.addEventListener('click', function () {
      if (L.q.mood(today)) S.setMoodNote(today, note.value.trim());
      U.closeLayer(ov, 'done');
    });
    U.$$('[data-mood-close]', ov).forEach(function (b) { b.addEventListener('click', function () { U.closeLayer(ov, 'later'); }); });

    L.ui.typo(ov);
    S.setFlag('moodPromptedOn', today);
    U.openLayer(ov, {
      initialFocus: m ? '[aria-pressed="true"]' : '[data-mood]',
      returnTo: opts.returnTo,
      onClose: function (reason) {
        var mm = L.q.mood(today);
        if (mm && note.value.trim() !== (mm.note || '')) S.setMoodNote(today, note.value.trim());
        if (opts.onClose) opts.onClose(reason);
      }
    });
  }

  // À la première connexion du jour
  function maybePrompt(onClose) {
    var st = S.get();
    if (st.flags.moodPromptedOn === D.today() || L.q.mood(D.today())) { if (onClose) onClose(); return false; }
    setTimeout(function () { open({ onClose: onClose }); }, 450);
    return true;
  }

  L.mood = { open: open, maybePrompt: maybePrompt, optionsHTML: optionsHTML };
})(window.Lamia = window.Lamia || {});
