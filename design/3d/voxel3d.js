/*! voxel3d.js · Plateforme de suivi - Lamia · personnages en « pixel 3D » (voxels)
 *
 * Les personnages pixel (design/sprites/pixel-cast.js) en petits cubes : chaque pixel
 * devient un cube, plus épais au centre des formes qu'au bord (volume arrondi).
 * Mêmes images, mêmes animations, mêmes accessoires que la version pixel.
 *
 *   const ctrl = Voxel3D.mount(canvas, 'lamia' | 'garcon' | 'memeow', { scale: 4, animation: 'idle', extras: ['fleur'] });
 *   ctrl.play('wave'); ctrl.stop(); ctrl.destroy();
 *   Voxel3D.supports('lamia')   // true si le navigateur affiche la 3D
 *
 * - Le canevas garde la taille de la version pixel : la mise en page ne bouge pas.
 * - three.js (design/vendor/three.min.js, licence MIT) n'est chargé qu'au premier
 *   personnage en voxels.
 * - Un seul rendu WebGL est partagé, recopié dans le canevas 2D de chaque personnage
 *   (les navigateurs limitent le nombre de contextes WebGL).
 * - Mouvement réduit (prefers-reduced-motion) : l'image fixe de chaque animation.
 */
(function (root) {
  'use strict';

  var THREE = null, loading = null, renderer = null, rW = 0, rH = 0;
  var instances = [], raf = null, last = 0;

  var me = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';
  var THREE_URL = me ? me.replace(/3d\/voxel3d\.js(\?.*)?$/, 'vendor/three.min.js') : 'design/vendor/three.min.js';

  function load() {
    if (THREE) return Promise.resolve(THREE);
    if (root.THREE) { THREE = root.THREE; return Promise.resolve(THREE); }
    if (!loading) loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = THREE_URL;
      s.onload = function () { THREE = root.THREE; THREE ? resolve(THREE) : reject(new Error('three.js introuvable')); };
      s.onerror = function () { loading = null; reject(new Error('three.js n’a pas pu être chargé')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }
  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function dev() { return root.PixelCast && root.PixelCast._dev; }

  /* =======================================================================
     1. D'UNE IMAGE PIXEL À DES CUBES
     ======================================================================= */
  var MAX_HALF = { lamia: 3, garcon: 3, memeow: 3 };   // demi-épaisseur maximale (en cubes)

  // Épaisseur de chaque pixel : distance au bord de la silhouette (bornée)
  function depthMap(data, w, h, cap) {
    var INF = 99, d = new Int16Array(w * h);
    for (var i = 0; i < w * h; i++) d[i] = data[i * 4 + 3] > 127 ? INF : 0;   // ombre du sprite exclue
    // deux passes (distance « échiquier »)
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var k = y * w + x; if (!d[k]) continue;
      var m = d[k];
      if (x === 0 || y === 0) m = 1; else m = Math.min(m, d[k - 1] + 1, d[k - w] + 1, d[k - w - 1] + 1, x < w - 1 ? d[k - w + 1] + 1 : 1);
      d[k] = m;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      k = y * w + x; if (!d[k]) continue;
      m = d[k];
      if (x === w - 1 || y === h - 1) m = 1; else m = Math.min(m, d[k + 1] + 1, d[k + w] + 1, d[k + w + 1] + 1, x > 0 ? d[k + w - 1] + 1 : 1);
      d[k] = Math.min(m, cap);
    }
    return d;
  }

  var BOX = null;
  function frameMesh(frame, w, h, cap) {
    var data = frame.data, d = depthMap(data, w, h, cap), n = 0, i;
    for (i = 0; i < w * h; i++) if (d[i]) n++;
    if (!BOX) BOX = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var mesh = new THREE.InstancedMesh(BOX, mat, Math.max(1, n));
    var o = new THREE.Object3D(), c = new THREE.Color(), j = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      i = y * w + x; if (!d[i]) continue;
      var half = d[i];                                   // 1 → 1 cube, 2 → 3 cubes, 3 → 5 cubes
      o.position.set(x - w / 2 + 0.5, h - y - 0.5, 0);
      o.scale.set(1, 1, half * 2 - 1);
      o.updateMatrix();
      mesh.setMatrixAt(j, o.matrix);
      c.setRGB(data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255);
      mesh.setColorAt(j, c);
      j++;
    }
    mesh.count = j;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  // Toutes les images d'un personnage (avec ses accessoires), converties une fois
  var built = {};
  function build(id, extras) {
    var key = id + '|' + extras.join(',');
    if (built[key]) return built[key];
    var D = dev(), size = root.PixelCast.size(id), anims = {};
    root.PixelCast.animations[id].forEach(function (name) {
      var a = D.animation(id, name, extras);
      anims[name] = { loop: a.loop, next: a.next || 'idle', repeat: a.repeat || 1, still: a.still || 0,
        frames: a.frames.map(function (f) { return { ms: f.duration, mesh: frameMesh(f, size.width, size.height, MAX_HALF[id] || 3) }; }) };
    });
    built[key] = { w: size.width, h: size.height, anims: anims };
    return built[key];
  }

  /* =======================================================================
     2. RENDU PARTAGÉ
     ======================================================================= */
  function ensureRenderer(w, h) {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
    }
    if (w > rW || h > rH) { rW = Math.max(rW, w); rH = Math.max(rH, h); renderer.setSize(rW, rH, false); }
  }

  function makeScene(model) {
    var scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    var key = new THREE.DirectionalLight(0xffffff, 0.5); key.position.set(-0.6, 1, 1.2); scene.add(key);
    var side = new THREE.DirectionalLight(0xdfe8ff, 0.25); side.position.set(1, 0.2, 0.4); scene.add(side);
    var tilt = new THREE.Group(); tilt.rotation.x = 0.22; tilt.position.y = 1.5; scene.add(tilt);   // vue un peu plongeante
    var pivot = new THREE.Group(); tilt.add(pivot);
    // Ombre douce au sol
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(40,30,70,0.32)'); g.addColorStop(1, 'rgba(40,30,70,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(model.w * 0.8, model.w * 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05; tilt.add(shadow);
    var cam = new THREE.OrthographicCamera(-model.w / 2, model.w / 2, model.h, 0, -100, 100);
    cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0);
    return { scene: scene, cam: cam, pivot: pivot, shown: null };
  }

  function renderOne(inst, now) {
    var m = inst.model, s = inst.s, a = m.anims[inst.anim] || m.anims.idle;
    // Image en cours (durées de chaque image, enchaînement comme en pixel art)
    var f;
    if (reduced()) f = a.frames[a.still] || a.frames[0];
    else {
      while (now - inst.t0 >= a.frames[inst.idx].ms) {
        inst.t0 += a.frames[inst.idx].ms;
        inst.idx++;
        if (inst.idx >= a.frames.length) {
          inst.idx = 0;
          if (!a.loop && ++inst.cycle >= a.repeat) { inst.anim = m.anims[a.next] ? a.next : 'idle'; inst.cycle = 0; a = m.anims[inst.anim]; }
        }
        if (now - inst.t0 > 5000) inst.t0 = now;       // onglet resté en veille : on ne rattrape pas tout
      }
      f = a.frames[inst.idx];
    }
    // Chaque personnage affiché a sa propre maille (un objet 3D n'a qu'un parent),
    // qui réutilise les cubes calculés une fois pour toutes
    var mesh = inst.meshes.get(f.mesh);
    if (!mesh) {
      mesh = new THREE.InstancedMesh(f.mesh.geometry, f.mesh.material, f.mesh.count);
      mesh.instanceMatrix = f.mesh.instanceMatrix; mesh.instanceColor = f.mesh.instanceColor; mesh.count = f.mesh.count;
      inst.meshes.set(f.mesh, mesh);
    }
    if (s.shown !== mesh) { if (s.shown) s.pivot.remove(s.shown); s.pivot.add(mesh); s.shown = mesh; }
    // Lent balancement pour montrer le volume
    var T = (now - inst.born) / 1000;
    s.pivot.rotation.y = (reduced() ? 0.42 : 0.42 + Math.sin(T * 0.6) * 0.28) * (inst.flip ? -1 : 1);
    s.pivot.scale.x = inst.flip ? -1 : 1;
    var w = inst.canvas.width, h = inst.canvas.height;
    ensureRenderer(w, h);
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(s.scene, s.cam);
    inst.ctx.clearRect(0, 0, w, h);
    inst.ctx.drawImage(renderer.domElement, 0, rH - h, w, h, 0, 0, w, h);
  }

  function visible(c) { return c.isConnected && c.offsetParent !== null && !document.hidden; }
  function loop(now) {
    raf = null;
    if (!instances.length) return;
    if (now - last >= 32) {
      last = now;
      instances.forEach(function (inst) {
        if (!inst.s || !inst.playing || !inst.canvas.isConnected) return;
        if (inst.drawn && !visible(inst.canvas)) return;
        // Petits avatars : 12 images par seconde suffisent
        if (inst.drawn && inst.canvas.width < 220 && now - (inst.lastDraw || 0) < 80) return;
        inst.lastDraw = now;
        try { renderOne(inst, now); inst.drawn = true; } catch (e) { if (root.console) console.error(e); inst.playing = false; }
      });
    }
    if (!reduced()) raf = requestAnimationFrame(loop);
  }
  function kick() { if (raf == null) raf = requestAnimationFrame(loop); }

  /* =======================================================================
     3. CONTRÔLEUR (même interface que PixelCast)
     ======================================================================= */
  var mounted = typeof WeakMap === 'function' ? new WeakMap() : null;
  function mount(canvas, id, options) {
    var opts = options || {};
    var size = root.PixelCast.size(id);
    var prev = mounted && mounted.get(canvas);
    if (prev) prev.destroy();
    var scale = Math.max(1, Math.min(64, Math.round(+opts.scale) || 4));
    var dpr = root.devicePixelRatio || 1, k = Math.max(1, Math.round(scale * dpr));
    canvas.width = size.width * k; canvas.height = size.height * k;
    canvas.style.width = (size.width * k / dpr) + 'px'; canvas.style.height = (size.height * k / dpr) + 'px';
    canvas.style.imageRendering = 'auto';
    if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'img');
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', id === 'memeow' ? 'Memeow, la chatte de Lamia, en pixel 3D' : 'Ton personnage, en pixel 3D');
    var now = performance.now(), names = root.PixelCast.animations[id] || [];
    var inst = { id: id, canvas: canvas, ctx: canvas.getContext('2d'), model: null, s: null,
      anim: names.indexOf(opts.animation) >= 0 ? opts.animation : 'idle', idx: 0, cycle: 0, t0: now,
      born: now - Math.random() * 4000, playing: true, flip: !!opts.flip, drawn: false, meshes: new Map() };
    instances.push(inst);
    var ctrl = {
      play: function (name) {
        if (name != null && names.indexOf(name) < 0) return ctrl;
        inst.playing = true;
        var looping = inst.model && inst.model.anims[name] && inst.model.anims[name].loop;
        if (name != null && !(name === inst.anim && looping)) { inst.anim = name; inst.idx = 0; inst.cycle = 0; inst.t0 = performance.now(); }
        if (reduced() && inst.s) renderOne(inst, performance.now());
        kick();
        return ctrl;
      },
      stop: function () { inst.playing = false; return ctrl; },
      destroy: function () {
        inst.playing = false;
        var i = instances.indexOf(inst); if (i >= 0) instances.splice(i, 1);
        if (inst.s && inst.s.shown) inst.s.pivot.remove(inst.s.shown);   // les mailles restent en cache
        if (mounted && mounted.get(canvas) === ctrl) mounted['delete'](canvas);
        try { inst.ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (e) { /* rien */ }
      }
    };
    if (mounted) mounted.set(canvas, ctrl);
    load().then(function () {
      if (instances.indexOf(inst) < 0) return;
      inst.model = build(id, (opts.extras || []).slice().sort());
      inst.s = makeScene(inst.model);
      inst.t0 = performance.now();      // l'animation démarre quand le personnage apparaît
      renderOne(inst, performance.now()); inst.drawn = true;
      kick();
    }, function (e) {
      if (root.console) console.warn(e.message);
      if (opts.fallback) { ctrl.destroy(); opts.fallback(); }
    });
    return ctrl;
  }

  root.Voxel3D = Object.freeze({
    version: '1.0.0',
    mount: mount,
    supports: function (id) { return !!(root.PixelCast && dev() && root.PixelCast.animations[id]) && typeof document !== 'undefined' && webglOK(); },
    preload: load
  });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
})(typeof window !== 'undefined' ? window : this);
