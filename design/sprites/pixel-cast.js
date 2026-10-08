/*! pixel-cast.js · Plateforme de suivi - Lamia · Lamia & Memeow en pixel art
 *
 * Script classique (pas de module ES, aucune requête réseau) : fonctionne en file://.
 * Expose window.PixelCast, cf. docs/00-cahier-des-charges.md §8 :
 *
 *   const ctrl = PixelCast.mount(canvas, 'lamia' | 'memeow', { scale: 4, animation: 'idle' });
 *   ctrl.play('wave'); ctrl.stop(); ctrl.destroy();
 *   PixelCast.animations            // { lamia: [...], memeow: [...] }
 *   PixelCast.size('lamia')         // { width, height } en pixels « art »
 *   PixelCast.icon('heart', 4)      // -> HTMLCanvasElement
 *   PixelCast.iconDataURL('heart', 4) // -> 'data:image/png;base64,...'
 *
 * FORMAT DES SPRITES (détails dans design/sprites/README.md)
 * - Chaque personnage a une palette : un caractère = une couleur ('#RRGGBB' ou '#RRGGBBAA').
 * - Les « calques » (parts) sont des grilles de texte, une chaîne par ligne, sur toute la
 *   largeur du personnage. `y` indique la ligne où commence la grille.
 *     '.' = rien (on voit ce qu'il y a dessous)    '_' = gomme (rend le pixel transparent)
 * - Une image d'animation = [durée en ms, 'calque calque@dx,dy ...'] : les calques sont
 *   empilés de gauche à droite (le premier est au fond). '@dx,dy' décale un calque.
 */
(function (root) {
  'use strict';

  /* =======================================================================
     1. LES PERSONNAGES
     ======================================================================= */

  var CAST = {};

  /* ---------------------------------------------------------------------
     LAMIA · 32 × 48
     --------------------------------------------------------------------- */
  CAST.lamia = {
    width: 32,
    height: 48,
    palette: {
      o: '#2B2150', // contour indigo
      O: '#191329', // contour des cheveux (le plus sombre)
      a: '#282340', // cheveux, base (noir bleuté)
      b: '#3B4580', // cheveux, reflet bleu nuit
      c: '#6A7FC4', // cheveux, brillance
      s: '#F9DCCB', // peau
      S: '#EBB49E', // peau, ombre
      r: '#F4A3A6', // joues
      m: '#B4506A', // bouche
      e: '#191329', // yeux
      w: '#FFFFFF', // reflet des yeux
      g: '#C97A6E', // lunettes rose gold
      G: '#F2C3B2', // lunettes, reflet
      t: '#EAD8BC', // tee-shirt beige
      T: '#CDB590', // tee-shirt, ombre
      u: '#F8F0E2', // tee-shirt, lumière
      j: '#5878BD', // jean
      J: '#3D5795', // jean, ombre
      i: '#86A3DA', // jean, lumière
      W: '#FFFFFF', // Converse blanches
      x: '#C9CDE0', // Converse, ombre / lacets
      z: '#2E3466', // Converse, liseré de semelle
      '%': '#2B215030' // ombre portée au sol
    },
    parts: {
      shadow: { y: 46, rows: [
        '........%%%%%%%%%%%%%%%%........',
        '.........%%%%%%%%%%%%%%.........'
      ]},
      hairBack: { y: 16, rows: [
        '..OaaaaaaaaaaaaaaaaaaaaaaaaaaO..',
        '..OabaaaaaaaaaaaaaaaaaaaaaaaaO..',
        '.OaabaaaaaaaaaaaaaaaaaaaaaabaaO.',
        '.ObaaOaaaaaaaaaaaaaaaaaaaaOaabO.',
        '.OabbaaaaaaaaaaaaaaaaaaaaaabbaO.',
        '.OaaabaaaaaaaaaaaaaaaaaaaaabaaO.',
        '.ObaaaOaaaaaaaaaaaaaaaaaaOaaabO.',
        '.OabbaaaaaaaaaaaaaaaaaaaaaabbaO.',
        '.OaaabaaaaaaaaaaaaaaaaaaaaabaaO.',
        '..ObaaOaaaaaaaaaaaaaaaaaaOaabO..',
        '..OabbaaaaaaaaaaaaaaaaaaaaabbO..',
        '..OaaabaaaaaaaaaaaaaaaaaaabaaO..',
        '...ObaaO..............OaaabO....',
        '...OOaaOO............OOaaOO.....',
        '....OOOO..............OOOO......'
      ]},
      legs: { y: 29, rows: [
        '..........oJJJJJJJJJJo..........',
        '..........ojjjjjJjjjjo..........',
        '..........oijjjjJjjjJo..........',
        '..........oijjjjJjjjJo..........',
        '..........oijjjjJjjjJo..........',
        '..........oijjjjojjjJo..........',
        '..........oijjjo.ojjJo..........',
        '..........oijjjo.ojjJo..........',
        '..........oijjjo.ojjJo..........',
        '..........oijjjo.ojjJo..........',
        '..........oijjjo.ojjJo..........',
        '..........oijjjo.ojjJo..........',
        '..........oiiiio.oiiio..........',
        '.........oojjjjo.ojjjoo.........',
        '........oWWxWWWo.oWWWxWWo.......',
        '........oWxWxWWo.oWWxWxWo.......',
        '........ozzzzzzo.ozzzzzzo.......',
        '.........oooooo...oooooo........'
      ]},
      torso: { y: 19, rows: [
        '.............oSSSSo.............',
        '.............ossssо.............',
        '.......ouuttttTssTtttttto.......',
        '.......outtttttTTttttttTo.......',
        '.........utttttttttttTT.........',
        '.........uttttttttttttT.........',
        '.........utttttttttttTT.........',
        '.........uttttttttttttT.........',
        '.........utttttttttttTT.........',
        '.........uttttttttttttT.........',
        '.........TTTTTTTTTTTTTT.........'
      ]},
      arms: { y: 21, rows: [
        '.......ouu..............tto.....',
        '.......outT............Ttto.....',
        '.......oTTo............oTTo.....',
        '.......osSo............osSo.....',
        '.......osSo............osSo.....',
        '.......osSo............osSo.....',
        '.......osSo............osSo.....',
        '.......osso............osso.....',
        '.......osso............osso.....',
        '........oo..............oo......'
      ]},
      head: { y: 0, rows: [
        '................................',
        '............OOOOOOOO.OOO........',
        '..........OOcccbbbbbSaabOO......',
        '........OOabbbaaaaabSaaabaO.....',
        '.......OabaaaaaabaaaSaaaabaO....',
        '......OaabaaaabaaaaOsOabaaaO....',
        '.....OabaaababaaaOOsssOabaaaO...',
        '....OaabaababaOOOssssssOabaaO...',
        '....OabaabaOOOssssOOOssOaabaO...',
        '....OaabaOOssssssssssssOabaaO...',
        '.....OabasGgggssssGgggsOabaO....',
        '....OabaagseesggggseesgOabaaO...',
        '...OabaabgswesgssgswesgOaabaO...',
        '...OaabaagseesgssgseesgOabaaO...',
        '...OabaabsggggssssggggsOaabaO...',
        '...OaabaasrrssssSsssrrsOabaaO...',
        '...OabaabOsssssmmsssssOabaabO...',
        '...OaabaabOssssssssssOaabaabO...',
        '...OabaabaaOssssssssOaabaabaO...',
        '...OabaabaabaO....OabaabaabaO...',
        '....OOaOOaOOO......OOOaOOaOO....'
      ]},
      blink: { y: 11, rows: [
        '..........ssss....ssss..........',
        '..........seeS....seeS..........',
        '..........ssss....ssss..........'
      ]}
    },
    animations: {
      idle: { loop: true, still: 0, blink: 3, frames: [
        [600, 'shadow hairBack legs torso arms head'],
        [600, 'shadow hairBack@0,1 legs torso@0,1 arms@0,1 head@0,1'],
        [600, 'shadow hairBack legs torso arms head'],
        [140, 'shadow hairBack legs torso arms head blink']
      ]},
      wave: { loop: false, still: 0, frames: [
        [600, 'shadow hairBack legs torso arms head']
      ]},
      cheer: { loop: false, still: 0, frames: [
        [600, 'shadow hairBack legs torso arms head']
      ]},
      typing: { loop: false, still: 0, frames: [
        [600, 'shadow hairBack legs torso arms head']
      ]}
    }
  };

  /* ---------------------------------------------------------------------
     MEMEOW · 32 × 24
     --------------------------------------------------------------------- */
  CAST.memeow = {
    width: 32,
    height: 24,
    palette: {
      o: '#2B2150'
    },
    parts: {
      dot: { y: 10, rows: ['...............o................'] }
    },
    animations: {
      idle: { loop: true, still: 0, frames: [[600, 'dot']] },
      sleep: { loop: true, still: 0, frames: [[600, 'dot']] },
      lick: { loop: false, still: 0, frames: [[600, 'dot']] },
      hungry: { loop: false, still: 0, frames: [[600, 'dot']] },
      meow: { loop: false, still: 0, frames: [[600, 'dot']] }
    }
  };

  /* =======================================================================
     2. LES ICÔNES · 16 × 16
     ======================================================================= */

  var ICONS = {
    size: 16,
    palette: {
      o: '#2B2150'
    },
    sprites: {
      heart: { rows: [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '.......oo.......',
        '.......oo.......',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................'
      ]}
    }
  };

  /* =======================================================================
     3. LE MOTEUR
     Rien à modifier ici pour retoucher les dessins.
     ======================================================================= */

  var TRANSPARENT = '.';
  var ERASE = '_';
  var VERSION = '1.0.0';

  function fail(msg) { throw new Error('PixelCast : ' + msg); }

  function parseColor(hex, where) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(hex).trim());
    if (!m) fail('couleur invalide « ' + hex + ' » (' + where + ')');
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255
    ];
  }

  function compilePalette(pal, where) {
    var out = {};
    for (var ch in pal) {
      if (!Object.prototype.hasOwnProperty.call(pal, ch)) continue;
      if (ch.length !== 1 || ch === TRANSPARENT || ch === ERASE) {
        fail('clé de palette invalide « ' + ch + ' » (' + where + ') : un seul caractère, ni « . » ni « _ »');
      }
      out[ch] = parseColor(pal[ch], where + ', « ' + ch + ' »');
    }
    return out;
  }

  // Peint une grille dans un tampon RGBA (alpha « source-over »).
  function paint(buf, w, h, rows, pal, x0, y0, where) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var y = y0 + r;
      if (y < 0 || y >= h) continue;
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === TRANSPARENT) continue;
        var x = x0 + c;
        if (x < 0 || x >= w) continue;
        var i = (y * w + x) * 4;
        if (ch === ERASE) { buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0; continue; }
        var col = pal[ch];
        if (!col) fail('caractère « ' + ch + ' » absent de la palette (' + where + ', ligne ' + r + ', colonne ' + c + ')');
        var sa = col[3] / 255;
        if (sa >= 1) { buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255; continue; }
        var da = buf[i + 3] / 255;
        var oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        buf[i] = Math.round((col[0] * sa + buf[i] * da * (1 - sa)) / oa);
        buf[i + 1] = Math.round((col[1] * sa + buf[i + 1] * da * (1 - sa)) / oa);
        buf[i + 2] = Math.round((col[2] * sa + buf[i + 2] * da * (1 - sa)) / oa);
        buf[i + 3] = Math.round(oa * 255);
      }
    }
  }

  // 'hairBack@0,1' -> { name: 'hairBack', dx: 0, dy: 1 }
  function parseLayers(spec) {
    return String(spec).trim().split(/\s+/).map(function (tok) {
      var m = /^([A-Za-z0-9_-]+)(?:@(-?\d+),(-?\d+))?$/.exec(tok);
      if (!m) fail('calque mal écrit « ' + tok + ' » (attendu : nom ou nom@dx,dy)');
      return { name: m[1], dx: m[2] ? +m[2] : 0, dy: m[3] ? +m[3] : 0 };
    });
  }

  var compiled = {};

  function compileCharacter(id) {
    if (compiled[id]) return compiled[id];
    var def = CAST[id];
    if (!def) fail('personnage inconnu « ' + id + ' » (attendus : ' + Object.keys(CAST).join(', ') + ')');
    var pal = compilePalette(def.palette, id);
    var anims = {};
    Object.keys(def.animations).forEach(function (name) {
      var a = def.animations[name];
      if (!a.frames || !a.frames.length) fail(id + '.' + name + ' : aucune image');
      var frames = a.frames.map(function (f, n) {
        var where = id + '.' + name + '[' + n + ']';
        var ms = Math.max(16, Math.round(+f[0] || 0));
        var buf = new Uint8ClampedArray(def.width * def.height * 4);
        parseLayers(f[1]).forEach(function (l) {
          var part = def.parts[l.name];
          if (!part) fail('calque inconnu « ' + l.name + ' » (' + where + ')');
          paint(buf, def.width, def.height, part.rows, pal, (part.x || 0) + l.dx, (part.y || 0) + l.dy, id + '.' + l.name);
        });
        return { duration: ms, data: buf };
      });
      var clamp = function (v) { v = v | 0; return v >= 0 && v < frames.length ? v : -1; };
      anims[name] = {
        name: name,
        loop: !!a.loop,
        next: a.next || 'idle',
        repeat: Math.max(1, a.repeat | 0),
        still: Math.max(0, clamp(a.still)),
        blink: a.blink == null ? -1 : clamp(a.blink),
        frames: frames
      };
    });
    compiled[id] = { id: id, width: def.width, height: def.height, animations: anims, canvases: {} };
    return compiled[id];
  }

  var compiledIcons = {};
  function compileIcon(name) {
    if (compiledIcons[name]) return compiledIcons[name];
    var def = ICONS.sprites[name];
    if (!def) fail('icône inconnue « ' + name + ' » (attendues : ' + Object.keys(ICONS.sprites).join(', ') + ')');
    var palDef = {}, k;
    for (k in ICONS.palette) palDef[k] = ICONS.palette[k];
    if (def.palette) for (k in def.palette) palDef[k] = def.palette[k];
    var n = ICONS.size;
    var buf = new Uint8ClampedArray(n * n * 4);
    paint(buf, n, n, def.rows, compilePalette(palDef, 'icône ' + name), 0, 0, 'icône ' + name);
    compiledIcons[name] = { width: n, height: n, data: buf };
    return compiledIcons[name];
  }

  /* ---------- Rendu canvas ---------- */

  function hasDOM() { return typeof document !== 'undefined' && document.createElement; }

  function bufferToCanvas(w, h, data) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    img.data.set(data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function frameCanvas(ch, anim, index) {
    var key = anim + '#' + index;
    if (!ch.canvases[key]) {
      ch.canvases[key] = bufferToCanvas(ch.width, ch.height, ch.animations[anim].frames[index].data);
    }
    return ch.canvases[key];
  }

  function toScale(v, def) {
    var n = Math.round(+v);
    return isFinite(n) && n >= 1 ? Math.min(n, 64) : def;
  }

  function setPixelated(el) {
    el.style.imageRendering = 'pixelated';
    if (el.style.imageRendering !== 'pixelated') el.style.imageRendering = 'crisp-edges';
  }

  function mediaQuery(q) {
    return root.matchMedia ? root.matchMedia(q) : null;
  }
  function listen(mq, fn) {
    if (!mq) return function () {};
    if (mq.addEventListener) { mq.addEventListener('change', fn); return function () { mq.removeEventListener('change', fn); }; }
    if (mq.addListener) { mq.addListener(fn); return function () { mq.removeListener(fn); }; }
    return function () {};
  }

  var LABELS = { lamia: 'Lamia', memeow: 'Memeow, la chatte de Lamia' };
  var mounted = typeof WeakMap === 'function' ? new WeakMap() : null;

  function mount(canvas, id, options) {
    if (!hasDOM()) fail('mount() a besoin d’un navigateur');
    if (!canvas || typeof canvas.getContext !== 'function') fail('mount() attend un élément <canvas>');
    var ch = compileCharacter(id);
    var opts = options || {};
    var scale = toScale(opts.scale, 4);
    var flip = !!opts.flip;

    var previous = mounted && mounted.get(canvas);
    if (previous) previous.destroy();

    var ctx = canvas.getContext('2d');
    var state = {
      anim: ch.animations[opts.animation] ? opts.animation : 'idle',
      index: 0,
      cycle: 0,
      playing: false,
      timer: null,
      destroyed: false,
      k: 1,
      dpr: 1
    };
    var reduceMQ = mediaQuery('(prefers-reduced-motion: reduce)');
    var offReduce = function () {};
    var offDpr = function () {};

    if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'img');
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', LABELS[id] || id);

    function reduced() { return !!(reduceMQ && reduceMQ.matches); }

    function resize() {
      var dpr = root.devicePixelRatio || 1;
      // Un pixel « art » = un nombre entier de pixels physiques : le rendu reste net,
      // même avec un zoom Windows à 125 % ou 150 %.
      var k = Math.max(1, Math.round(scale * dpr));
      state.dpr = dpr; state.k = k;
      canvas.width = ch.width * k;
      canvas.height = ch.height * k;
      canvas.style.width = (ch.width * k / dpr) + 'px';
      canvas.style.height = (ch.height * k / dpr) + 'px';
      setPixelated(canvas);
      offDpr();
      offDpr = listen(mediaQuery('(resolution: ' + dpr + 'dppx)'), function () {
        if (!state.destroyed) { resize(); draw(); }
      });
    }

    function draw() {
      if (state.destroyed) return;
      var a = ch.animations[state.anim];
      var src = frameCanvas(ch, state.anim, Math.min(state.index, a.frames.length - 1));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (flip) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(src, 0, 0, ch.width, ch.height, 0, 0, ch.width * state.k, ch.height * state.k);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function clearTimer() {
      if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
    }

    function after(ms, fn) {
      clearTimer();
      state.timer = setTimeout(function () { state.timer = null; if (!state.destroyed) fn(); }, ms);
    }

    function totalDuration(a) {
      var t = 0;
      for (var i = 0; i < a.frames.length; i++) t += a.frames[i].duration;
      return t * a.repeat;
    }

    function switchTo(name) {
      state.anim = ch.animations[name] ? name : 'idle';
      state.index = 0;
      state.cycle = 0;
      run();
    }

    // Mouvement réduit : une image fixe (la pose « still »), avec au plus un clignement rare.
    function runReduced() {
      var a = ch.animations[state.anim];
      state.index = a.still;
      draw();
      if (!a.loop) {
        after(Math.max(1200, totalDuration(a)), function () { switchTo(a.next); });
      } else if (a.blink >= 0) {
        after(6000 + Math.random() * 4000, function () {
          state.index = a.blink; draw();
          after(a.frames[a.blink].duration, runReduced);
        });
      }
    }

    function step() {
      var a = ch.animations[state.anim];
      draw();
      after(a.frames[state.index].duration, function () {
        state.index++;
        if (state.index >= a.frames.length) {
          state.index = 0;
          if (!a.loop) {
            state.cycle++;
            if (state.cycle >= a.repeat) { switchTo(a.next); return; }
          }
        }
        step();
      });
    }

    function run() {
      clearTimer();
      if (!state.playing) { draw(); return; }
      if (reduced()) runReduced(); else step();
    }

    var ctrl = {
      play: function (name) {
        if (state.destroyed) return ctrl;
        if (name != null && !ch.animations[name]) {
          if (typeof console !== 'undefined') console.warn('PixelCast : animation inconnue « ' + name + ' » pour ' + id + ' (disponibles : ' + Object.keys(ch.animations).join(', ') + ')');
          return ctrl;
        }
        var wasPlaying = state.playing;
        state.playing = true;
        if (name == null) { run(); return ctrl; }
        // Rejouer l’animation en boucle déjà en cours ne la fait pas sauter.
        if (name === state.anim && ch.animations[name].loop && wasPlaying) return ctrl;
        switchTo(name);
        return ctrl;
      },
      stop: function () {
        if (state.destroyed) return ctrl;
        state.playing = false;
        clearTimer();
        return ctrl;
      },
      destroy: function () {
        if (state.destroyed) return;
        state.playing = false;
        clearTimer();
        offReduce(); offDpr();
        state.destroyed = true;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (mounted && mounted.get(canvas) === ctrl) mounted['delete'](canvas);
      }
    };

    offReduce = listen(reduceMQ, function () { if (!state.destroyed && state.playing) run(); });
    if (mounted) mounted.set(canvas, ctrl);
    resize();
    state.playing = true;
    run();
    return ctrl;
  }

  function size(id) {
    var def = CAST[id];
    if (!def) fail('personnage inconnu « ' + id + ' » (attendus : ' + Object.keys(CAST).join(', ') + ')');
    return { width: def.width, height: def.height };
  }

  function icon(name, scale) {
    if (!hasDOM()) fail('icon() a besoin d’un navigateur');
    var ic = compileIcon(name);
    var s = toScale(scale, 1);
    var src = bufferToCanvas(ic.width, ic.height, ic.data);
    if (s === 1) { setPixelated(src); return src; }
    var cv = document.createElement('canvas');
    cv.width = ic.width * s; cv.height = ic.height * s;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    setPixelated(cv);
    return cv;
  }

  function iconDataURL(name, scale) {
    return icon(name, scale).toDataURL('image/png');
  }

  var animations = {};
  Object.keys(CAST).forEach(function (id) {
    animations[id] = Object.freeze(Object.keys(CAST[id].animations));
  });

  var PixelCast = {
    mount: mount,
    animations: Object.freeze(animations),
    size: size,
    icon: icon,
    iconDataURL: iconDataURL
  };

  // Outils internes (export PNG, planche de présentation). Hors contrat : non énumérable.
  Object.defineProperty(PixelCast, '_dev', {
    enumerable: false,
    value: Object.freeze({
      version: VERSION,
      cast: CAST,
      icons: ICONS,
      iconNames: function () { return Object.keys(ICONS.sprites); },
      animation: function (id, name) {
        var a = compileCharacter(id).animations[name];
        if (!a) fail('animation inconnue « ' + name + ' » pour ' + id);
        return { loop: a.loop, next: a.next, repeat: a.repeat, still: a.still, frames: a.frames };
      },
      iconPixels: function (name) { return compileIcon(name); }
    })
  });

  root.PixelCast = Object.freeze(PixelCast);
})(typeof window !== 'undefined' ? window : this);
