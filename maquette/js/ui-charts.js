/* ==========================================================================
   Plateforme de suivi - Lamia — Maquette · graphiques SVG faits main
   Règles (skill dataviz) : marques fines (barres ≤ 24 px, bout arrondi de
   4 px côté donnée, carré côté base), ligne de 2 px, points ≥ 8 px cerclés
   de 2 px couleur surface, grille en filets pleins discrets, textes en
   couleurs de texte (jamais la couleur de la série), une infobulle au
   survol ET au focus clavier, et un tableau de données jumeau.
   Les heures ne sont JAMAIS additionnées entre catégories : un graphique
   par catégorie (petits multiples).
   ========================================================================== */
(function (L) {
  'use strict';

  var D = L.dates;
  var esc = L.ui.esc;
  var NS = 'http://www.w3.org/2000/svg';
  var tip = null;

  /* --- Infobulle unique (enfant direct de <body>) ------------------------- */
  function tipEl() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.setAttribute('aria-hidden', 'true');
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }

  function showTip(html, x, y) {
    var t = tipEl();
    t.innerHTML = html;
    t.hidden = false;
    var w = t.offsetWidth, h = t.offsetHeight;
    var left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2));
    var top = y - h - 12;
    if (top < 8) top = y + 16;
    t.style.left = Math.round(left) + 'px';
    t.style.top = Math.round(top) + 'px';
  }

  function hideTip() { if (tip) tip.hidden = true; }

  function tipRow(value, label, key) {
    return '<div class="chart-tip__row">' + (key ? '<span class="chart-tip__key ' + key + '"></span>' : '') +
      '<strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  }

  /* --- Outils ------------------------------------------------------------- */
  function niceStep(maxMin) {
    var h = maxMin / 60;
    var steps = [1, 2, 5, 10, 20, 50];
    for (var i = 0; i < steps.length; i++) if (h / steps[i] <= 4) return steps[i] * 60;
    return 100 * 60;
  }

  function text(x, y, str, cls, anchor) {
    return '<text x="' + x + '" y="' + y + '" class="' + (cls || 'chart__text') + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(str) + '</text>';
  }

  // Barre verticale : arrondi de 4 px en haut, carré à la base
  function barPath(x, y, w, h) {
    var r = Math.min(4, h, w / 2);
    if (h <= 0) return '';
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }

  // Barre horizontale : base à gauche, bout arrondi à droite
  function hbarPath(x, y, w, h) {
    var r = Math.min(4, w, h / 2);
    if (w <= 0) return '';
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
  }

  function bindHits(svg, getTip) {
    function at(target, ev) {
      var html = getTip(target);
      if (!html) return;
      if (ev && ev.clientX != null && ev.type !== 'focus') showTip(html, ev.clientX, ev.clientY);
      else { var r = target.getBoundingClientRect(); showTip(html, r.left + r.width / 2, r.top); }
    }
    svg.addEventListener('pointermove', function (e) {
      var g = e.target.closest('[data-hit]');
      svg.querySelectorAll('.is-hover').forEach(function (n) { if (n !== g) n.classList.remove('is-hover'); });
      if (g) { g.classList.add('is-hover'); at(g, e); } else hideTip();
    });
    svg.addEventListener('pointerleave', function () { hideTip(); svg.querySelectorAll('.is-hover').forEach(function (n) { n.classList.remove('is-hover'); }); });
    svg.addEventListener('focusin', function (e) { var g = e.target.closest('[data-hit]'); if (g) { g.classList.add('is-hover'); at(g, { type: 'focus' }); } });
    svg.addEventListener('focusout', function (e) { var g = e.target.closest('[data-hit]'); if (g) g.classList.remove('is-hover'); hideTip(); });
  }

  /* --- Colonnes : heures d'une catégorie --------------------------------- */
  // o = { data: [{ key, label, sub, value, goal, future, current, title }], hue, height, ariaLabel }
  function bars(host, o) {
    var W = Math.max(240, Math.floor(host.clientWidth || 320));
    var H = o.height || 196;
    var pad = { l: 34, r: 8, t: 22, b: o.data.some(function (d) { return d.sub; }) ? 40 : 26 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var maxV = 60;
    o.data.forEach(function (d) { maxV = Math.max(maxV, d.value, d.goal ? d.goal * 1.12 : 0); });
    var step = niceStep(maxV);
    var top = Math.ceil(maxV / step) * step;
    var y = function (v) { return pad.t + ih - (v / top) * ih; };
    var band = iw / o.data.length;
    var bw = Math.min(24, Math.max(8, band * 0.5));

    var s = '<svg xmlns="' + NS + '" class="chart chart--bars ' + (o.hue || '') + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(o.ariaLabel || '') + '">';
    // Grille
    for (var v = 0; v <= top; v += step) {
      s += '<line class="chart__grid' + (v === 0 ? ' chart__grid--base' : '') + '" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      s += text(pad.l - 8, y(v) + 4, (v / 60) + D.NBSP + 'h', 'chart__tick', 'end');
    }
    o.data.forEach(function (d, i) {
      var cx = pad.l + band * i + band / 2;
      var x = cx - bw / 2;
      var h = Math.max(0, y(0) - y(d.value));
      s += '<g class="chart__col' + (d.future ? ' is-future' : '') + (d.current ? ' is-current' : '') + '" data-hit="' + i + '" tabindex="0" role="img" aria-label="' + esc(d.title || d.label) + '">';
      s += '<rect class="chart__hit" x="' + (pad.l + band * i) + '" y="' + pad.t + '" width="' + band + '" height="' + ih + '"/>';
      if (d.value > 0) s += '<path class="chart__bar" d="' + barPath(x, y(d.value), bw, h) + '"/>';
      if (d.goal) {
        s += '<line class="chart__goal" x1="' + (x - 5) + '" x2="' + (x + bw + 5) + '" y1="' + y(d.goal) + '" y2="' + y(d.goal) + '"/>';
      }
      if (d.value > 0 && o.labels !== false) s += text(cx, Math.min(y(d.value), d.goal ? y(d.goal) : 9999) - 7, D.duration(d.value, { compact: true }), 'chart__value', 'middle');
      s += text(cx, H - pad.b + 17, d.label, 'chart__tick chart__tick--x' + (d.current ? ' is-current' : ''), 'middle');
      if (d.sub) s += text(cx, H - pad.b + 32, d.sub, 'chart__tick chart__tick--sub', 'middle');
      s += '</g>';
    });
    s += '</svg>';
    host.innerHTML = s;
    var svg = host.firstChild;
    bindHits(svg, function (g) {
      var d = o.data[+g.getAttribute('data-hit')];
      var rows = tipRow(D.duration(d.value), 'enregistrées', o.hue);
      if (d.goal) {
        var gap = d.value - d.goal;
        rows += tipRow(D.duration(d.goal), 'objectif') ;
        if (!d.future) rows += '<div class="chart-tip__note">' + (gap >= 0 ? (gap ? '+' + D.NBSP + D.duration(gap) + ' au-delà, tout en douceur' : 'Objectif tout pile') : 'Encore ' + D.duration(-gap) + ' pour l’objectif') + '</div>';
      }
      return '<div class="chart-tip__title">' + esc(d.tipTitle || d.label) + '</div>' + rows;
    });
  }

  /* --- Barres horizontales : répartition ---------------------------------- */
  // o = { rows: [{ label, value, display, hue }], ariaLabel, unit }
  function hbars(host, o) {
    var W = Math.max(240, Math.floor(host.clientWidth || 320));
    var rowH = 34, bh = 14;
    var labelW = Math.min(150, Math.round(W * 0.38));
    var H = o.rows.length * rowH + 4;
    var maxV = Math.max.apply(null, o.rows.map(function (r) { return r.value; }).concat([1]));
    var iw = W - labelW - 52;
    var s = '<svg xmlns="' + NS + '" class="chart chart--hbars" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(o.ariaLabel || '') + '">';
    s += '<line class="chart__grid chart__grid--base" x1="' + labelW + '" x2="' + labelW + '" y1="0" y2="' + H + '"/>';
    o.rows.forEach(function (r, i) {
      var cy = i * rowH + rowH / 2 + 2;
      var w = Math.max(r.value > 0 ? 3 : 0, (r.value / maxV) * iw);
      s += '<g class="chart__row ' + (r.hue || 'hue--accent') + '" data-hit="' + i + '" tabindex="0" role="img" aria-label="' + esc(r.label + ' : ' + r.display) + '">';
      s += '<rect class="chart__hit" x="0" y="' + (cy - rowH / 2) + '" width="' + W + '" height="' + rowH + '"/>';
      s += '<text x="' + (labelW - 10) + '" y="' + (cy + 4) + '" class="chart__label" text-anchor="end">' + esc(clip(r.label, labelW)) + '</text>';
      if (w > 0) s += '<path class="chart__bar" d="' + hbarPath(labelW + 2, cy - bh / 2, w, bh) + '"/>';
      s += text(labelW + 2 + w + 8, cy + 4, r.display, 'chart__value');
      s += '</g>';
    });
    s += '</svg>';
    host.innerHTML = s;
    bindHits(host.firstChild, function (g) {
      var r = o.rows[+g.getAttribute('data-hit')];
      return '<div class="chart-tip__title">' + esc(r.label) + '</div>' + tipRow(r.display, o.unit || '', r.hue);
    });
  }

  function clip(str, px) {
    var max = Math.floor(px / 7.2);
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  /* --- Courbe d'humeur ---------------------------------------------------- */
  // o = { days: [{ date, level|null, note }], band: [a, b], ariaLabel }
  function moodLine(host, o) {
    var W = Math.max(260, Math.floor(host.clientWidth || 320));
    var H = o.height || 200;
    var pad = { l: 34, r: 14, t: 14, b: 28 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var n = o.days.length;
    var x = function (i) { return pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); };
    var y = function (lv) { return pad.t + ih - ((lv - 1) / 4) * ih; };

    var s = '<svg xmlns="' + NS + '" class="chart chart--mood" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" tabindex="0" role="img" aria-label="' + esc(o.ariaLabel || '') + '">';
    s += '<defs><linearGradient id="mood-wash" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="chart__wash-stop" stop-opacity=".22"/><stop offset="1" class="chart__wash-stop" stop-opacity="0"/></linearGradient></defs>';
    // Période sélectionnée
    if (o.band) {
      var ia = o.days.findIndex(function (d) { return d.date >= o.band[0]; });
      var ib = -1;
      o.days.forEach(function (d, i) { if (d.date <= o.band[1]) ib = i; });
      if (ia >= 0 && ib >= ia) {
        var half = n > 1 ? iw / (n - 1) / 2 : 10;
        var bx0 = Math.max(pad.l, x(ia) - half), bx1 = Math.min(W - pad.r, x(ib) + half);
        s += '<rect class="chart__band" x="' + bx0 + '" y="' + pad.t + '" width="' + (bx1 - bx0) + '" height="' + ih + '" rx="6"/>';
      }
    }
    for (var lv = 1; lv <= 5; lv++) {
      s += '<line class="chart__grid' + (lv === 1 ? ' chart__grid--base' : '') + '" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y(lv) + '" y2="' + y(lv) + '"/>';
      var url = L.ui.pixelURL('mood-' + lv, 1);
      if (url) s += '<image href="' + url + '" x="' + (pad.l - 26) + '" y="' + (y(lv) - 8) + '" width="16" height="16" class="pixelated"><title>' + esc(L.ui.moodLabel(lv)) + '</title></image>';
      else s += text(pad.l - 10, y(lv) + 4, String(lv), 'chart__tick', 'end');
    }
    // Segments (un jour sans humeur = un trou, pas un zéro)
    var segs = [], cur = [];
    o.days.forEach(function (d, i) {
      if (d.level) cur.push([x(i), y(d.level)]);
      else if (cur.length) { segs.push(cur); cur = []; }
    });
    if (cur.length) segs.push(cur);
    segs.forEach(function (seg) {
      if (seg.length > 1) {
        var line = seg.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('');
        s += '<path class="chart__area" d="' + line + 'L' + seg[seg.length - 1][0].toFixed(1) + ',' + y(1) + 'L' + seg[0][0].toFixed(1) + ',' + y(1) + 'Z"/>';
        s += '<path class="chart__line" d="' + line + '"/>';
      }
    });
    // Ticks X : 1 sur 7 (lundis) + aujourd'hui
    o.days.forEach(function (d, i) {
      if (D.dow(d.date) === 1 || i === n - 1) s += text(x(i), H - 8, D.dayMonth(d.date), 'chart__tick', i === n - 1 ? 'end' : 'middle');
    });
    s += '<line class="chart__cross" x1="0" x2="0" y1="' + pad.t + '" y2="' + (pad.t + ih) + '" hidden/>';
    o.days.forEach(function (d, i) {
      if (d.level) s += '<circle class="chart__dot mood-dot--' + d.level + '" cx="' + x(i) + '" cy="' + y(d.level) + '" r="4.5"/>';
    });
    s += '</svg>';
    host.innerHTML = s;
    var svg = host.firstChild;
    var cross = svg.querySelector('.chart__cross');
    var idx = n - 1;

    function show(i, clientX, clientY) {
      idx = Math.max(0, Math.min(n - 1, i));
      var d = o.days[idx];
      cross.removeAttribute('hidden');
      cross.setAttribute('x1', x(idx)); cross.setAttribute('x2', x(idx));
      svg.querySelectorAll('.chart__dot.is-hover').forEach(function (c) { c.classList.remove('is-hover'); });
      var html = '<div class="chart-tip__title">' + esc(D.cap(D.dayMonthLong(d.date))) + '</div>';
      html += d.level ? tipRow(L.ui.moodLabel(d.level), d.level + '/5', 'mood-key--' + d.level) : '<div class="chart-tip__note">Pas d’humeur notée ce jour-là</div>';
      if (d.note) html += '<div class="chart-tip__note">« ' + esc(d.note) + ' »</div>';
      var r = svg.getBoundingClientRect();
      showTip(html, clientX != null ? clientX : r.left + x(idx), clientY != null ? clientY : r.top + (d.level ? y(d.level) : pad.t + ih / 2));
      var live = document.getElementById('sr-live');
      if (clientX == null && live) live.textContent = D.dayMonthLong(d.date) + ' : ' + (d.level ? L.ui.moodLabel(d.level) : 'pas d’humeur notée');
    }
    svg.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect();
      var px = e.clientX - r.left;
      var i = n === 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1));
      show(i, e.clientX, e.clientY);
    });
    svg.addEventListener('pointerleave', function () { cross.setAttribute('hidden', ''); hideTip(); });
    svg.addEventListener('focus', function () { show(idx); });
    svg.addEventListener('blur', function () { cross.setAttribute('hidden', ''); hideTip(); });
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
      else if (e.key === 'Home') { e.preventDefault(); show(0); }
      else if (e.key === 'End') { e.preventDefault(); show(n - 1); }
    });
  }

  window.addEventListener('scroll', hideTip, true);

  L.charts = { bars: bars, hbars: hbars, moodLine: moodLine, hideTip: hideTip };
})(window.Lamia = window.Lamia || {});
