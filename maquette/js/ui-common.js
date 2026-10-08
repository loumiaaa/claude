/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · briques d'interface communes
   - gabarits (chips, priorités, étiquettes, échéances, durées) ;
   - couches : modales et tiroir (focus piégé puis restitué, Échap, inert) ;
   - menus contextuels (« Déplacer vers… »), toasts, annonces lecteur d'écran ;
   - icônes pixel PixelCast avec repli si un nom manque encore.
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates;
  var NB = D.NBSP;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function icon(name, opts) {
    return window.LamiaIcons ? window.LamiaIcons.svg(name, opts || {}) : '';
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function plural(n, one, many) { return n + NB + (n > 1 ? (many || one + 's') : one); }

  /* --- Couleurs de catégories (tokens uniquement, cf. app.css .hue--*) --- */
  var PALETTE = [
    { id: 'flowline', label: 'Bleu Flow Line' },
    { id: 'carnet', label: 'Violet Carnet' },
    { id: 'auto', label: 'Aqua' },
    { id: 'blue', label: 'Bleu soutenu' },
    { id: 'violet', label: 'Violet soutenu' },
    { id: 'periwinkle', label: 'Pervenche' },
    { id: 'lilac', label: 'Lilas' },
    { id: 'mint', label: 'Menthe' },
    { id: 'lavender', label: 'Lavande grise' }
  ];
  var DA_CHIPS = { flowline: 'chip--flowline', carnet: 'chip--carnet', auto: 'chip--auto' };

  function hue(c) { return 'hue--' + (c ? c.color : 'flowline'); }

  function catChip(c, extra) {
    if (!c) return '';
    return '<span class="chip chip--cat ' + (DA_CHIPS[c.color] || '') + ' ' + hue(c) + (extra ? ' ' + extra : '') + '">' + esc(c.name) + '</span>';
  }

  function catDot(c) { return '<span class="cat-dot ' + hue(c) + '" aria-hidden="true"></span>'; }

  function statusChip(s) { return '<span class="chip chip--' + s + '">' + esc(L.q.statusLabel(s)) + '</span>'; }

  function prio(p, opts) {
    return '<span class="prio prio--' + p + '"' + (opts && opts.title ? ' title="Priorité ' + esc(L.q.prioLabel(p).toLowerCase()) + '"' : '') + '>' +
      (opts && opts.long ? 'Priorité ' + esc(L.q.prioLabel(p).toLowerCase()) : esc(L.q.prioLabel(p))) + '</span>';
  }

  function tags(list, max) {
    if (!list || !list.length) return '';
    var shown = max ? list.slice(0, max) : list;
    return shown.map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('') +
      (max && list.length > max ? '<span class="tag tag--more">+' + (list.length - max) + '</span>' : '');
  }

  function progress(v, cls) {
    return '<span class="progress ' + (cls || '') + '" style="--value:' + Math.round(v) + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(v) + '" aria-label="Avancement ' + Math.round(v) + NB + '%"></span>';
  }

  // Échéance : ton doux, jamais alarmant (« à replanifier »)
  function due(t) {
    if (!t.endDate) return null;
    var today = D.today();
    if (t.status === 'done') return { tone: 'done', text: D.dayMonth(t.endDate), long: 'Échéance ' + D.short(t.endDate) };
    var n = D.diff(today, t.endDate);
    if (n < 0) return { tone: 'late', text: 'À replanifier', long: 'Échéance passée (' + D.short(t.endDate) + '), à replanifier' };
    if (n === 0) return { tone: 'today', text: 'Aujourd’hui', long: 'Échéance aujourd’hui' };
    if (n <= 2) return { tone: 'soon', text: D.relative(t.endDate), long: 'Échéance ' + D.dayMonthLong(t.endDate) };
    if (n < 7) return { tone: 'week', text: D.relative(t.endDate), long: 'Échéance ' + D.dayMonthLong(t.endDate) };
    return { tone: 'normal', text: D.dayMonth(t.endDate), long: 'Échéance ' + D.dayMonthLong(t.endDate) };
  }

  function dueBadge(t) {
    var d = due(t);
    if (!d) return '';
    return '<span class="due due--' + d.tone + '" title="' + esc(d.long) + '">' + icon(d.tone === 'late' ? 'refresh' : 'calendar') +
      '<span>' + esc(d.text) + '</span><span class="sr-only">, ' + esc(d.long) + '</span></span>';
  }

  /* --- Icônes pixel (PixelCast) ------------------------------------------ */
  var pixelCache = {};
  var FALLBACK = { 'mood-1': 'mood', 'mood-2': 'mood', 'mood-3': 'mood', 'mood-4': 'mood', 'mood-5': 'mood', heart: 'heart', fish: 'sparkle', zzz: 'moon', kibble: 'coffee', star: 'sparkle', note: 'note' };

  function pixelURL(name, scale) {
    var k = name + '@' + scale;
    if (pixelCache[k] !== undefined) return pixelCache[k];
    try { pixelCache[k] = window.PixelCast.iconDataURL(name, scale); }
    catch (e) { pixelCache[k] = null; }
    return pixelCache[k];
  }

  // <img> pixel net (les icônes font 16 × 16 « pixels art »)
  function pixelImg(name, scale, cls, alt) {
    var url = pixelURL(name, scale);
    var size = 16 * scale;
    if (!url) return '<span class="pixel-fallback ' + (cls || '') + '" style="--size:' + size + 'px" aria-hidden="' + (alt ? 'false' : 'true') + '">' + icon(FALLBACK[name] || 'sparkle', { title: alt || '' }) + '</span>';
    return '<img class="pixelated ' + (cls || '') + '" src="' + url + '" width="' + size + '" height="' + size + '" alt="' + esc(alt || '') + '">';
  }

  /* --- Humeur ------------------------------------------------------------ */
  var MOODS = [
    { level: 1, label: 'Au plus bas' },
    { level: 2, label: 'Bof' },
    { level: 3, label: 'Ça va' },
    { level: 4, label: 'Bien' },
    { level: 5, label: 'Au top' }
  ];
  function moodLabel(level) { return (MOODS[level - 1] || {}).label || ''; }

  /* --- Annonces (lecteur d'écran) ----------------------------------------- */
  function announce(text) {
    var el = document.getElementById('sr-live');
    if (!el) return;
    el.textContent = '';
    setTimeout(function () { el.textContent = text; }, 30);
  }

  /* --- Toasts ------------------------------------------------------------- */
  function toast(o) {
    var region = document.getElementById('toasts');
    if (!region) return null;
    var el = document.createElement('div');
    el.className = 'toast' + (o.kind ? ' toast--' + o.kind : '');
    el.setAttribute('role', o.kind === 'warning' ? 'alert' : 'status');
    var actions = (o.actions || []).map(function (a, i) {
      return '<button type="button" class="btn btn--soft btn--sm" data-toast-action="' + i + '">' + esc(a.label) + '</button>';
    }).join('');
    el.innerHTML = '<span class="toast__icon">' + icon(o.icon || (o.kind === 'success' ? 'check' : 'info')) + '</span>' +
      '<div class="toast__body"><div class="toast__title">' + esc(o.title) + '</div>' +
      (o.text ? '<div class="toast__text">' + esc(o.text) + '</div>' : '') +
      (actions ? '<div class="toast__actions">' + actions + '</div>' : '') + '</div>' +
      '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-toast-close aria-label="Fermer la notification">' + icon('close') + '</button>';
    typo(el);
    var timer = null;
    function close() {
      clearTimeout(timer);
      if (!el.parentNode) return;
      el.classList.add('is-leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 180);
    }
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-toast-action]');
      if (a) { var act = o.actions[+a.getAttribute('data-toast-action')]; close(); if (act && act.fn) act.fn(); return; }
      if (e.target.closest('[data-toast-close]')) close();
    });
    function arm() { timer = setTimeout(close, o.duration || 5000); }
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', arm);
    el.addEventListener('focusin', function () { clearTimeout(timer); });
    region.appendChild(el);
    while (region.children.length > 4) region.removeChild(region.firstChild);
    arm();
    return { close: close, el: el };
  }

  /* --- Couches : modales et tiroir --------------------------------------- */
  var stack = [];
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function focusables(root) { return $$(FOCUSABLE, root).filter(visible); }

  function setInert() {
    var top = stack[stack.length - 1];
    $$('[data-inert-root]').forEach(function (el) { el.inert = stack.length > 0; });
    stack.forEach(function (layer) { layer.el.inert = layer !== top; });
  }

  function openLayer(overlay, opts) {
    opts = opts || {};
    if (stack.some(function (l) { return l.el === overlay; })) return;
    var layer = { el: overlay, returnTo: opts.returnTo || document.activeElement, onClose: opts.onClose };
    stack.push(layer);
    overlay.hidden = false;
    document.documentElement.classList.add('has-layer');
    setInert();
    var target = opts.initialFocus ? (typeof opts.initialFocus === 'string' ? $(opts.initialFocus, overlay) : opts.initialFocus) : null;
    target = target || focusables(overlay)[0];
    if (target) setTimeout(function () { target.focus(); }, 20);
  }

  function closeLayer(overlay, reason) {
    var i = -1;
    stack.forEach(function (l, k) { if (l.el === overlay) i = k; });
    if (i < 0) return;
    var layer = stack.splice(i, 1)[0];
    overlay.hidden = true;
    if (!stack.length) document.documentElement.classList.remove('has-layer');
    setInert();
    if (layer.onClose) layer.onClose(reason);
    var back = layer.returnTo;
    if (back && document.contains(back) && visible(back)) back.focus();
    else if (back && back.getAttribute && back.getAttribute('data-focus-key')) {
      var again = document.querySelector('[data-focus-key="' + back.getAttribute('data-focus-key') + '"]');
      if (again) again.focus();
    }
  }

  function topLayer() { return stack[stack.length - 1] || null; }

  document.addEventListener('keydown', function (e) {
    var top = topLayer();
    if (!top) return;
    if (e.key === 'Escape') {
      if (document.querySelector('.menu:not([hidden])')) return;   // le menu se ferme d'abord
      e.preventDefault();
      closeLayer(top.el, 'escape');
      return;
    }
    if (e.key === 'Tab') {
      var f = focusables(top.el);
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !top.el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !top.el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });

  document.addEventListener('mousedown', function (e) {
    var top = topLayer();
    if (top && e.target === top.el) top.pendingBackdrop = true;
  });
  document.addEventListener('click', function (e) {
    var top = topLayer();
    if (top && e.target === top.el && top.pendingBackdrop) closeLayer(top.el, 'backdrop');
    if (top) top.pendingBackdrop = false;
  });

  /* --- Fenêtre de confirmation / saisie générique -------------------------- */
  function dialog(o) {
    var ov = document.getElementById('overlay-dialog');
    var body = o.body || (o.text ? '<p class="text-muted">' + esc(o.text) + '</p>' : '');
    ov.innerHTML =
      '<div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="dlg-title"' + (o.text ? ' aria-describedby="dlg-desc"' : '') + '>' +
        '<form class="dialog-form" novalidate>' +
          '<div class="modal__header"><div><h2 class="modal__title" id="dlg-title">' + esc(o.title) + '</h2>' +
            (o.desc ? '<p class="modal__desc">' + esc(o.desc) + '</p>' : '') + '</div>' +
            '<button type="button" class="btn btn--ghost btn--icon" data-dlg-cancel aria-label="Fermer">' + icon('close') + '</button></div>' +
          '<div class="modal__body" id="dlg-desc">' + body + '</div>' +
          '<div class="modal__footer">' +
            '<button type="button" class="btn btn--ghost" data-dlg-cancel>' + esc(o.cancelLabel || 'Annuler') + '</button>' +
            '<button type="submit" class="btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + '">' + esc(o.confirmLabel || 'Valider') + '</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    var form = ov.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (o.onConfirm && o.onConfirm(form) === false) return;
      closeLayer(ov, 'confirm');
    });
    $$('[data-dlg-cancel]', ov).forEach(function (b) { b.addEventListener('click', function () { closeLayer(ov, 'cancel'); }); });
    if (o.onMount) o.onMount(form);
    typo(ov);
    openLayer(ov, { initialFocus: o.initialFocus || 'input, select, [type="submit"]', returnTo: o.returnTo });
  }

  /* --- Menu contextuel (direct enfant de <body>) -------------------------- */
  var menuEl = null, menuAnchor = null, menuItems = null;

  function closeMenu(restore) {
    if (!menuEl || menuEl.hidden) return;
    menuEl.hidden = true;
    if (menuAnchor) menuAnchor.setAttribute('aria-expanded', 'false');
    if (restore !== false && menuAnchor && document.contains(menuAnchor)) menuAnchor.focus();
    menuAnchor = null;
  }

  function openMenu(anchor, items, opts) {
    opts = opts || {};
    if (!menuEl) {
      menuEl = document.createElement('div');
      menuEl.className = 'glass glass--strong menu';
      menuEl.setAttribute('role', 'menu');
      menuEl.hidden = true;
      document.body.appendChild(menuEl);
      menuEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-menu-i]');
        if (!b || b.getAttribute('aria-disabled') === 'true') return;
        var item = menuItems[+b.getAttribute('data-menu-i')];
        closeMenu(!item.keepFocusOff);
        if (item.onSelect) item.onSelect();
      });
      menuEl.addEventListener('keydown', function (e) {
        var list = $$('[data-menu-i]', menuEl);
        var i = list.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); }
        else if (e.key === 'Tab') { closeMenu(); }
      });
      document.addEventListener('pointerdown', function (e) {
        if (menuEl.hidden) return;
        if (!menuEl.contains(e.target) && !(menuAnchor && menuAnchor.contains(e.target))) closeMenu(false);
      });
      window.addEventListener('resize', function () { closeMenu(false); });
      document.addEventListener('scroll', function () { closeMenu(false); }, true);
    }
    if (menuAnchor === anchor && !menuEl.hidden) { closeMenu(); return; }
    menuItems = items;
    menuAnchor = anchor;
    menuEl.setAttribute('aria-label', opts.label || 'Actions');
    menuEl.innerHTML = items.map(function (it, i) {
      if (it.separator) return '<div class="menu__sep" role="separator"></div>';
      if (it.heading) return '<div class="menu__heading" role="presentation">' + esc(it.heading) + '</div>';
      var role = it.checked != null ? 'menuitemradio' : 'menuitem';
      return '<button type="button" class="menu__item' + (it.danger ? ' menu__item--danger' : '') + '" role="' + role + '" tabindex="-1" data-menu-i="' + i + '"' +
        (it.checked != null ? ' aria-checked="' + !!it.checked + '"' : '') + (it.disabled ? ' aria-disabled="true"' : '') + '>' +
        (it.icon ? icon(it.icon) : '<span class="menu__spacer"></span>') + '<span>' + esc(it.label) + '</span>' +
        (it.checked ? '<span class="menu__check">' + icon('check') + '</span>' : '') + (it.hint ? '<span class="menu__hint">' + esc(it.hint) + '</span>' : '') +
        '</button>';
    }).join('');
    // Rattacher au calque ouvert pour rester utilisable (le reste est inert)
    var top = topLayer();
    var host = top ? top.el : document.body;
    if (menuEl.parentNode !== host) host.appendChild(menuEl);
    menuEl.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    var r = anchor.getBoundingClientRect();
    var mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
    var x = Math.min(window.innerWidth - mw - 12, Math.max(12, (opts.align === 'left' ? r.left : r.right - mw)));
    var y = r.bottom + 6;
    if (y + mh > window.innerHeight - 12) y = Math.max(12, r.top - mh - 6);
    menuEl.style.left = Math.round(x) + 'px';
    menuEl.style.top = Math.round(y) + 'px';
    var first = $$('[data-menu-i]:not([aria-disabled="true"])', menuEl)[0];
    if (first) first.focus();
  }

  /* --- Divers -------------------------------------------------------------- */
  function debounce(fn, ms) {
    var t = null;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }

  // Conserve le focus lors d'un re-rendu (clé data-focus-key)
  function keepFocus(container, render) {
    var a = document.activeElement;
    var key = a && container.contains(a) ? a.getAttribute('data-focus-key') : null;
    var sel = a && key && (a.selectionStart != null) ? [a.selectionStart, a.selectionEnd] : null;
    render();
    if (key) {
      var el = container.querySelector('[data-focus-key="' + key + '"]');
      if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* rien */ } }
    }
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  // Typographie française sur les nœuds texte rendus : espaces insécables
  // avant « : ; ! ? » et à l'intérieur des guillemets.
  function typoString(s) {
    return s.replace(/ ([:;!?»])/g, NB + '$1').replace(/« /g, '«' + NB).replace(/'/g, '’');
  }
  function typo(root) {
    if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.nodeName === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        return /[ ][:;!?»]|« |'/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var list = [];
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach(function (n) { n.nodeValue = typoString(n.nodeValue); });
  }

  L.ui = {
    esc: esc, icon: icon, $: $, $$: $$, plural: plural, NB: NB, typo: typo, typoString: typoString,
    PALETTE: PALETTE, hue: hue, catChip: catChip, catDot: catDot, statusChip: statusChip, prio: prio, tags: tags,
    progress: progress, due: due, dueBadge: dueBadge,
    pixelURL: pixelURL, pixelImg: pixelImg, MOODS: MOODS, moodLabel: moodLabel,
    announce: announce, toast: toast, openLayer: openLayer, closeLayer: closeLayer, topLayer: topLayer, focusables: focusables,
    dialog: dialog, openMenu: openMenu, closeMenu: closeMenu, debounce: debounce, keepFocus: keepFocus,
    reducedMotion: reducedMotion, download: download
  };
})(window.Lamia = window.Lamia || {});
