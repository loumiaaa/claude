/*! chibi3d.js · Plateforme de suivi - Lamia · Lamia & Memeow en 3D « chibi »
 *
 * Même contrat que PixelCast (design/sprites/pixel-cast.js) :
 *   const ctrl = Chibi3D.mount(canvas, 'lamia' | 'memeow', { scale: 4, animation: 'idle', extras: ['fleur'] });
 *   ctrl.play('wave'); ctrl.stop(); ctrl.destroy();
 *   Chibi3D.supports('lamia')   // true : ce personnage existe en 3D
 *
 * - Le canevas garde la même taille que la version pixel (32 × 48 « pixels art »
 *   pour Lamia, 32 × 24 pour Memeow, multipliés par scale) : la mise en page ne bouge pas.
 * - three.js (design/vendor/three.min.js, licence MIT) n'est chargé qu'au premier
 *   personnage 3D affiché.
 * - Un seul rendu WebGL est partagé : chaque personnage y est dessiné puis recopié
 *   dans son propre canevas 2D (les navigateurs limitent le nombre de contextes WebGL).
 * - Mouvement réduit (prefers-reduced-motion) : une pose fixe, sans animation.
 * - Modèles faits de formes simples (sphères, capsules, tores), ombrage « toon »
 *   et contour sombre, comme un jouet en vinyle.
 */
(function (root) {
  'use strict';

  var THREE = null, loading = null, renderer = null, rW = 0, rH = 0;
  var instances = [], raf = null, last = 0, frames = 0;
  var FPS = 30;

  // Chemin de three.min.js, relatif à ce fichier (…/design/3d/chibi3d.js → …/design/vendor/three.min.js)
  var me = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';
  var THREE_URL = me ? me.replace(/3d\/chibi3d\.js(\?.*)?$/, 'vendor/three.min.js') : 'design/vendor/three.min.js';

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

  /* =======================================================================
     1. OUTILS DE MODELAGE
     ======================================================================= */
  var GRAD = null;
  function gradient() {
    if (GRAD) return GRAD;
    GRAD = new THREE.DataTexture(new Uint8Array([165, 220, 255]), 3, 1, THREE.RedFormat);
    GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
    GRAD.needsUpdate = true;
    return GRAD;
  }
  var mats = {};
  function toon(hex) {
    if (!mats[hex]) mats[hex] = new THREE.MeshToonMaterial({ color: hex, gradientMap: gradient() });
    return mats[hex];
  }
  var lines = {};
  function lineMat(hex) {
    if (!lines[hex]) lines[hex] = new THREE.MeshBasicMaterial({ color: hex, side: THREE.BackSide });
    return lines[hex];
  }
  var OUT = '#2B2150', OUT_HAIR = '#2A1A12';

  // Maille + contour (coque inversée légèrement plus grande)
  function part(geo, hex, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var m = new THREE.Mesh(geo, toon(hex));
    g.add(m);
    if (opts.line !== false) {
      var o = new THREE.Mesh(geo, lineMat(opts.lineColor || OUT));
      o.scale.setScalar(1 + (opts.lineWidth || 0.06));
      g.add(o);
    }
    g.userData.mesh = m;
    return g;
  }
  function sphere(r, hex, opts) { return part(new THREE.SphereGeometry(r, 24, 18), hex, opts); }
  function capsule(r, len, hex, opts) { return part(new THREE.CapsuleGeometry(r, len, 6, 14), hex, opts); }
  function flat(r, hex, opacity) {
    var m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: hex, transparent: opacity < 1, opacity: opacity, depthWrite: false }));
    return m;
  }
  // Point à la surface d'une sphère : ax = angle horizontal (0 = face), ay = angle vertical
  function surf(r, ax, ay) { return new THREE.Vector3(Math.sin(ax) * Math.cos(ay) * r, Math.sin(ay) * r, Math.cos(ax) * Math.cos(ay) * r); }
  function stick(obj, r, ax, ay) {
    var p = surf(r, ax, ay);
    obj.position.copy(p);
    obj.lookAt(p.clone().multiplyScalar(2));
    return obj;
  }
  function lerpHex(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))); }

  // Boucles : beaucoup de petites sphères en une seule maille instanciée (+ son contour)
  function curls(list, outline) {
    var geo = new THREE.SphereGeometry(1, 10, 7);
    var g = new THREE.Group();
    var m = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient() }), list.length);
    var o = new THREE.InstancedMesh(geo, lineMat(outline || OUT_HAIR), list.length);
    var d = new THREE.Object3D();
    list.forEach(function (c, i) {
      d.position.set(c[0], c[1], c[2]); d.scale.setScalar(c[3]); d.updateMatrix();
      m.setMatrixAt(i, d.matrix); m.setColorAt(i, c[4]);
      d.scale.setScalar(c[3] * 1.13); d.updateMatrix(); o.setMatrixAt(i, d.matrix);
    });
    m.instanceColor.needsUpdate = true;
    g.add(m); g.add(o);
    return g;
  }

  /* =======================================================================
     2. LAMIA (32 × 48 → 3,2 × 4,8 unités, pieds en y = 0)
     ======================================================================= */
  var C = {
    skin: '#F9DCCB', skinS: '#EBB49E', cheek: '#F4A3A6', mouth: '#B84E6A', eye: '#191329',
    glasses: '#C97A6E', tee: '#EAD8BC', jean: '#5878BD', shoe: '#FFFFFF', sole: '#2E3466',
    hairDark: '#3D2517', hair: '#583624', hairLight: '#74482E', caramel: '#BC834E', caramelLight: '#DFAA6E',
    tie: '#F27BA8', tablet: '#36305C', screen: '#DCE9FF', pink: '#F27BA8', gold: '#FFCF4D'
  };
  // Couleur d'une boucle selon sa hauteur : brun en haut, caramel aux pointes
  function hairColor(y, seed, low, high) {
    var t = (high - y) / (high - low);
    var base = [C.hair, C.hairLight, C.hairDark][seed % 3];
    if (t < 0.55) return new THREE.Color(base);
    return lerpHex(base, seed % 2 ? C.caramelLight : C.caramel, (t - 0.55) / 0.4);
  }
  function rnd(seed) { var x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }

  function buildLamia(extras) {
    var rig = {};
    var root3 = new THREE.Group();
    var body = new THREE.Group(); root3.add(body); rig.body = body;

    // Ombre au sol
    var sh = flat(0.95, '#2B2150', 0.16); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; sh.scale.set(1, 0.55, 1); root3.add(sh); rig.shadow = sh;

    // Jambes et Converse
    [-1, 1].forEach(function (s) {
      var leg = capsule(0.2, 0.5, C.jean); leg.position.set(0.25 * s, 0.75, 0); body.add(leg);
      var shoe = sphere(0.25, C.shoe); shoe.scale.set(1, 0.62, 1.4); shoe.position.set(0.26 * s, 0.17, 0.08); body.add(shoe);
      var sole = part(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 20), C.sole, { line: false }); sole.scale.set(1, 1, 1.4); sole.position.set(0.26 * s, 0.04, 0.08); body.add(sole);
    });
    var hips = sphere(0.46, C.jean); hips.scale.set(1.08, 0.55, 0.82); hips.position.y = 1.2; body.add(hips);

    // Haut du corps (respire)
    var upper = new THREE.Group(); upper.position.y = 1.25; body.add(upper); rig.upper = upper;
    var torso = capsule(0.46, 0.38, C.tee); torso.scale.set(1.1, 1, 0.82); torso.position.y = 0.55; upper.add(torso);
    var neck = part(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 14), C.skinS, { line: false }); neck.position.y = 1.1; upper.add(neck);

    // Bras (pivot à l'épaule)
    rig.arms = [-1, 1].map(function (s) {
      var arm = new THREE.Group(); arm.position.set(0.56 * s, 0.92, 0); upper.add(arm);
      var sleeve = sphere(0.21, C.tee); sleeve.position.set(0.03 * s, -0.05, 0); arm.add(sleeve);
      var limb = capsule(0.12, 0.42, C.skin); limb.position.set(0.08 * s, -0.42, 0); arm.add(limb);
      var hand = sphere(0.14, C.skin); hand.position.set(0.1 * s, -0.72, 0.02); arm.add(hand);
      arm.rotation.z = 0.12 * s;
      return arm;
    });

    // Tablette graphique (animation « typing »)
    var tab = new THREE.Group();
    var slab = part(new THREE.BoxGeometry(0.9, 0.62, 0.06), C.tablet); tab.add(slab);
    var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.48), new THREE.MeshBasicMaterial({ color: C.screen })); scr.position.z = 0.035; tab.add(scr);
    var heart = sphere(0.07, C.pink, { line: false }); heart.position.set(0.05, 0.02, 0.06); tab.add(heart); rig.heart = heart;
    tab.position.set(0, 0.45, 0.62); tab.rotation.x = -0.5; tab.visible = false; upper.add(tab); rig.tablet = tab;

    // Tête
    var head = new THREE.Group(); head.position.y = 1.95; upper.add(head); rig.head = head;
    var skull = sphere(1.0, C.skin); skull.scale.set(1.02, 0.95, 0.95); head.add(skull);
    // Yeux (avec reflet), paupières pour le clignement
    rig.eyes = [-1, 1].map(function (s) {
      var e = new THREE.Group();
      var ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), toon(C.eye)); ball.scale.set(0.12, 0.17, 0.05); e.add(ball);
      var hi = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#FFFFFF' })); hi.scale.setScalar(0.04); hi.position.set(0.035, 0.06, 0.04); e.add(hi);
      stick(e, 0.95, 0.36 * s, -0.04); head.add(e);
      return e;
    });
    // Lunettes rose gold
    [-1, 1].forEach(function (s) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 8, 28), toon(C.glasses));
      stick(ring, 1.0, 0.36 * s, -0.04); head.add(ring);
    });
    var bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), toon(C.glasses)); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, -0.02, 1.0); head.add(bridge);
    // Joues et bouche
    [-1, 1].forEach(function (s) { var ch = flat(0.13, C.cheek, 0.85); stick(ch, 0.965, 0.55 * s, -0.27); head.add(ch); });
    var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 16, Math.PI), toon(C.mouth)); mouth.rotation.z = Math.PI; stick(mouth, 0.93, 0, -0.38); mouth.rotateZ(Math.PI); head.add(mouth); rig.mouth = mouth;
    var open = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), toon(C.mouth)); open.scale.set(0.09, 0.07, 0.03); stick(open, 0.92, 0, -0.38); open.visible = false; head.add(open); rig.mouthOpen = open;

    // Cheveux bouclés : coque + boucles, ouverte sur le visage
    var shell = part(new THREE.SphereGeometry(1.05, 28, 20, 0, Math.PI * 2, 0, 1.95), C.hair, { lineColor: OUT_HAIR, lineWidth: 0.03 });
    shell.rotation.x = -0.72; head.add(shell);
    var list = [], n = 240, seed = 1;
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963;
      var v = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
      // Dans la coque inclinée vers l'arrière ?
      var tilt = v.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.72);
      if (Math.acos(Math.max(-1, Math.min(1, tilt.y))) > 1.85) continue;
      var r = 0.13 + rnd(seed++) * 0.05;
      var p = v.multiplyScalar(1.06);
      list.push([p.x, p.y, p.z, r, new THREE.Color([C.hair, C.hairLight, C.hairDark][i % 3])]);
    }
    // Frange en boucles sur le front
    for (var b = -3; b <= 3; b++) {
      var fp = surf(1.05, b * 0.2, 0.42 - Math.abs(b) * 0.03);
      list.push([fp.x, fp.y, fp.z, 0.13 + rnd(seed++) * 0.03, new THREE.Color(b % 2 ? C.hairLight : C.hair)]);
    }
    // Mèches bouclées le long des joues (pointes caramel)
    [-1, 1].forEach(function (s) {
      for (var k = 0; k < 5; k++) {
        var yy = 0.15 - k * 0.27;
        list.push([s * (0.97 - k * 0.02), yy, 0.22 - k * 0.04, 0.14, hairColor(yy, k + (s > 0 ? 1 : 0), -1.05, 0.2)]);
      }
    });
    head.add(curls(list));

    // Couettes : élastiques en haut de la tête, boucles qui tombent dans le dos
    rig.tails = [-1, 1].map(function (s) {
      var tieP = new THREE.Vector3(0.64 * s, 0.76, -0.28);
      var tie = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 18), toon(C.tie)); tie.position.copy(tieP); tie.lookAt(tieP.clone().multiplyScalar(2)); head.add(tie);
      var pivot = new THREE.Group(); pivot.position.copy(tieP); head.add(pivot);
      var curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.28 * s, 0.1, -0.12), new THREE.Vector3(0.5 * s, -0.4, -0.35),
        new THREE.Vector3(0.52 * s, -1.35, -0.5), new THREE.Vector3(0.42 * s, -2.3, -0.45)
      ]);
      var tl = [], steps = 22;
      for (var k = 0; k <= steps; k++) {
        var t = k / steps, c = curve.getPoint(t), rad = 0.19 - t * 0.06;
        for (var j = 0; j < 3; j++) {
          var a = k * 1.1 + j * 2.1;
          tl.push([c.x + Math.cos(a) * rad * 0.55, c.y + Math.sin(a) * rad * 0.35, c.z + Math.sin(a) * rad * 0.55, rad * (0.85 + rnd(seed++) * 0.3),
            t < 0.6 ? new THREE.Color([C.hair, C.hairLight, C.hairDark][(k + j) % 3]) : lerpHex([C.hair, C.hairLight][j % 2], j % 2 ? C.caramelLight : C.caramel, (t - 0.6) / 0.35)]);
        }
      }
      pivot.add(curls(tl));
      return pivot;
    });
    // Cheveux lâchés derrière le dos
    var back = [];
    for (var by = 0; by < 7; by++) {
      for (var bx = -3; bx <= 3; bx++) {
        var yy2 = 1.5 - by * 0.22, xx = bx * 0.24 + (by % 2 ? 0.12 : 0);
        back.push([xx * 0.9, yy2, -0.55 - Math.abs(bx) * 0.02, 0.17, hairColor(yy2, bx + by + 9, 0.1, 1.6)]);
      }
    }
    upper.add(curls(back));

    // Accessoires
    extras.forEach(function (x) {
      if (x === 'fleur') {
        var f = new THREE.Group();
        for (var p = 0; p < 5; p++) { var pe = sphere(0.1, '#F27BA8', { lineWidth: 0.1 }); pe.position.set(Math.cos(p * 1.257) * 0.12, Math.sin(p * 1.257) * 0.12, 0); f.add(pe); }
        var core = sphere(0.07, C.gold, { line: false }); core.position.z = 0.05; f.add(core);
        f.position.set(0.62, 0.95, 0.3); f.lookAt(1.2, 1.9, 1.4); head.add(f);
      }
      if (x === 'beret') {
        var be = sphere(0.78, '#5F8FDB'); be.scale.set(1, 0.34, 1); be.position.set(-0.08, 0.98, -0.06); be.rotation.z = 0.18; head.add(be);
        var st = sphere(0.07, '#4170BA'); st.position.set(-0.12, 1.25, -0.06); head.add(st);
      }
      if (x === 'couronne') {
        var cr = new THREE.Group();
        var band = part(new THREE.CylinderGeometry(0.42, 0.45, 0.2, 24, 1, true), C.gold); cr.add(band);
        for (var q = 0; q < 6; q++) { var sp = part(new THREE.ConeGeometry(0.09, 0.22, 8), C.gold); sp.position.set(Math.cos(q * 1.047) * 0.42, 0.2, Math.sin(q * 1.047) * 0.42); cr.add(sp); }
        var gem = sphere(0.06, '#F27BA8', { line: false }); gem.position.set(0, 0.02, 0.45); cr.add(gem);
        cr.position.set(0, 1.0, 0); head.add(cr);
      }
    });

    rig.sparks = new THREE.Group(); root3.add(rig.sparks);
    for (var z = 0; z < 6; z++) {
      var spk = sphere(0.07, z % 2 ? C.gold : C.pink, { line: false });
      spk.userData.a = z * 1.047; spk.visible = false; rig.sparks.add(spk);
    }
    return { root: root3, rig: rig };
  }

  function animateLamia(rig, name, t, idleT) {
    var breathe = Math.sin(idleT * Math.PI * 2 / 1.6);
    rig.body.position.y = 0;
    rig.upper.position.y = 1.25 + breathe * 0.025;
    rig.head.rotation.set(0, 0, Math.sin(idleT * 0.9) * 0.05);
    rig.tails.forEach(function (tl, i) { tl.rotation.z = Math.sin(idleT * 2.2 + i) * 0.05; tl.rotation.x = Math.sin(idleT * 1.7 + i) * 0.04; });
    rig.arms[0].rotation.set(0, 0, -0.12); rig.arms[1].rotation.set(0, 0, 0.12);
    rig.tablet.visible = false; rig.mouth.visible = true; rig.mouthOpen.visible = false;
    rig.sparks.children.forEach(function (s) { s.visible = false; });
    var blink = (idleT % 4.2) < 0.12;
    var squint = false;

    if (name === 'wave') {
      rig.arms[0].rotation.set(0.6, 0, -2.3 + Math.sin(t * 14) * 0.3);
      rig.mouth.visible = false; rig.mouthOpen.visible = true;
      rig.head.rotation.z = 0.08;
    } else if (name === 'cheer') {
      var hop = Math.abs(Math.sin(t * Math.PI * 2 / 0.7));
      rig.body.position.y = hop * 0.3;
      rig.arms[0].rotation.set(0.6, 0, -2.35); rig.arms[1].rotation.set(0.6, 0, 2.35);
      rig.mouth.visible = false; rig.mouthOpen.visible = true; squint = true;
      rig.sparks.children.forEach(function (s, i) {
        s.visible = true;
        var a = s.userData.a + t * 2, rr = 1.6 + Math.sin(t * 6 + i) * 0.15;
        s.position.set(Math.cos(a) * rr, 3.6 + Math.sin(a) * 0.9, 0.4);
        s.scale.setScalar(0.7 + Math.abs(Math.sin(t * 8 + i)) * 0.6);
      });
    } else if (name === 'typing') {
      rig.tablet.visible = true;
      rig.arms[0].rotation.set(-1.15, 0, -0.35); rig.arms[1].rotation.set(-1.15, 0, 0.35);
      rig.head.rotation.x = 0.18;
      rig.heart.scale.setScalar(Math.min(1.6, t * 0.8));
      if (t > 2) { squint = true; rig.mouth.visible = false; rig.mouthOpen.visible = true; }
    }
    rig.eyes.forEach(function (e) { e.scale.y = blink ? 0.12 : squint ? 0.35 : 1; });
    rig.shadow.scale.set(1 - rig.body.position.y * 0.4, 0.55 - rig.body.position.y * 0.2, 1);
  }

  /* =======================================================================
     3. MEMEOW (32 × 24 → 3,2 × 2,4 unités) : chatte écaille de tortue
     ======================================================================= */
  var M = { black: '#2C2637', blackL: '#4A4358', red: '#E8893C', cream: '#F5B66E', brown: '#7A5236', eye: '#7DD35A', pupil: '#1A1430', nose: '#F49AB2', ear: '#E9A0B4', mouth: '#5A2342', tongue: '#F27F9C', bowl: '#5F8FDB', kib: '#B8763A', z: '#6897E0' };

  function buildMemeow(extras) {
    var rig = {};
    var root3 = new THREE.Group();
    var body = new THREE.Group(); root3.add(body); rig.body = body;
    var sh = flat(0.95, '#2B2150', 0.16); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; sh.scale.set(1.1, 0.5, 1); root3.add(sh);

    var trunk = sphere(0.62, M.black); trunk.scale.set(1.05, 0.9, 0.95); trunk.position.y = 0.58; body.add(trunk); rig.trunk = trunk;
    var patch = sphere(0.45, M.red, { line: false }); patch.scale.set(0.8, 0.7, 0.6); patch.position.set(0.32, 0.72, 0.18); body.add(patch);
    var chest = sphere(0.33, M.cream, { line: false }); chest.scale.set(1, 1.1, 0.6); chest.position.set(0, 0.62, 0.42); body.add(chest);
    [-1, 1].forEach(function (s) { var paw = sphere(0.15, s < 0 ? M.cream : M.black); paw.scale.set(1, 0.75, 1.2); paw.position.set(0.24 * s, 0.1, 0.48); body.add(paw); if (s > 0) rig.paw = paw; });

    // Queue : chaîne de sphères qui ondule
    var tail = new THREE.Group(); tail.position.set(-0.5, 0.3, -0.35); body.add(tail); rig.tail = tail;
    rig.tailBits = [];
    for (var k = 0; k < 7; k++) { var tb = sphere(0.13 - k * 0.008, k % 3 === 2 ? M.red : M.black); tail.add(tb); rig.tailBits.push(tb); }

    var head = new THREE.Group(); head.position.set(0, 1.35, 0.1); body.add(head); rig.head = head;
    var skull = sphere(0.58, M.black); skull.scale.set(1.12, 0.95, 0.95); head.add(skull);
    var half = new THREE.Mesh(new THREE.SphereGeometry(0.585, 20, 14, 0, Math.PI * 0.95), toon(M.red)); half.scale.set(1.12, 0.95, 0.95); half.rotation.y = 0.15; head.add(half);
    var muzzle = sphere(0.24, M.cream, { line: false }); muzzle.scale.set(1.25, 0.8, 0.7); muzzle.position.set(0, -0.17, 0.47); head.add(muzzle);
    [-1, 1].forEach(function (s) {
      var ear = part(new THREE.ConeGeometry(0.2, 0.34, 4), s < 0 ? M.black : M.red); ear.position.set(0.36 * s, 0.5, -0.02); ear.rotation.z = -0.35 * s; ear.rotation.y = Math.PI / 4; head.add(ear);
      var inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 4), toon(M.ear)); inner.position.set(0.35 * s, 0.47, 0.07); inner.rotation.z = -0.35 * s; inner.rotation.y = Math.PI / 4; head.add(inner);
    });
    rig.eyes = [-1, 1].map(function (s) {
      var e = new THREE.Group();
      var iris = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toon(M.eye)); iris.scale.set(0.12, 0.14, 0.05); e.add(iris);
      var pup = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), toon(M.pupil)); pup.scale.set(0.04, 0.11, 0.03); pup.position.z = 0.03; e.add(pup);
      var hi = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF' })); hi.scale.setScalar(0.025); hi.position.set(0.04, 0.05, 0.05); e.add(hi);
      e.position.set(0.24 * s, 0.03, 0.53); head.add(e);
      return e;
    });
    var nose = sphere(0.05, M.nose, { line: false }); nose.scale.set(1.2, 0.8, 0.8); nose.position.set(0, -0.1, 0.63); head.add(nose);
    var mo = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), toon(M.mouth)); mo.scale.set(0.08, 0.06, 0.03); mo.position.set(0, -0.24, 0.62); mo.visible = false; head.add(mo); rig.mouthOpen = mo;
    var tongue = sphere(0.05, M.tongue, { line: false }); tongue.position.set(0, -0.27, 0.63); tongue.visible = false; head.add(tongue); rig.tongue = tongue;

    // Gamelle (faim) et « z » (sieste)
    var bowl = part(new THREE.CylinderGeometry(0.32, 0.24, 0.16, 20), M.bowl); bowl.position.set(0.8, 0.12, 0.35); bowl.scale.setScalar(0.75); bowl.visible = false; root3.add(bowl); rig.bowl = bowl;
    rig.zs = [0, 1, 2].map(function (i) { var z = sphere(0.06 + i * 0.015, M.z, { line: false }); z.visible = false; root3.add(z); return z; });

    extras.forEach(function (x) {
      if (x === 'noeud') {
        var bow = new THREE.Group();
        [-1, 1].forEach(function (s) { var w = part(new THREE.ConeGeometry(0.12, 0.2, 10), '#F2709A'); w.rotation.z = -Math.PI / 2 * s; w.position.x = 0.1 * s; bow.add(w); });
        var knot = sphere(0.05, '#C9487A', { line: false }); bow.add(knot);
        bow.position.set(-0.4, 0.45, 0.2); bow.rotation.z = 0.3; head.add(bow);
      }
      if (x === 'collier') {
        var col = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 28), toon('#F2709A')); col.rotation.x = Math.PI / 2 - 0.25; col.position.set(0, 1.0, 0.12); body.add(col);
        var bell = sphere(0.07, C.gold); bell.position.set(0, 0.9, 0.53); body.add(bell);
      }
      if (x === 'couronne') {
        var cr = new THREE.Group();
        cr.add(part(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 20, 1, true), C.gold));
        for (var q = 0; q < 5; q++) { var sp = part(new THREE.ConeGeometry(0.06, 0.14, 8), C.gold); sp.position.set(Math.cos(q * 1.257) * 0.24, 0.12, Math.sin(q * 1.257) * 0.24); cr.add(sp); }
        cr.position.set(0, 0.56, 0); head.add(cr);
      }
    });
    return { root: root3, rig: rig };
  }

  function animateMemeow(rig, name, t, idleT) {
    var breathe = Math.sin(idleT * Math.PI * 2 / 2);
    rig.body.position.y = 0; rig.body.rotation.set(0, 0, 0);
    rig.trunk.scale.set(1.05, 0.9 + breathe * 0.015, 0.95);
    rig.head.position.set(0, 1.35 + breathe * 0.015, 0.1);
    rig.head.rotation.set(0, 0, Math.sin(idleT * 0.8) * 0.06);
    rig.mouthOpen.visible = false; rig.tongue.visible = false; rig.bowl.visible = false;
    rig.zs.forEach(function (z) { z.visible = false; });
    rig.paw.position.set(0.24, 0.1, 0.48);
    var wag = Math.sin(idleT * 2.4);
    rig.tailBits.forEach(function (b, k) {
      var a = 0.35 + k * 0.32;
      b.position.set(-Math.sin(a) * 0.12 * k * 0.4 + wag * k * 0.03, k * 0.15, -k * 0.03);
    });
    var closed = (idleT % 3.6) < 0.12;
    if (name === 'meow') {
      rig.head.rotation.x = -0.25; rig.mouthOpen.visible = true;
    } else if (name === 'lick') {
      rig.paw.position.set(0.15, 0.95, 0.62); rig.head.rotation.x = 0.15; rig.tongue.visible = Math.sin(t * 12) > 0; closed = true;
    } else if (name === 'hungry') {
      rig.bowl.visible = true; rig.head.rotation.x = 0.25 + Math.abs(Math.sin(t * 6)) * 0.15; rig.mouthOpen.visible = Math.sin(t * 6) > 0.3;
    } else if (name === 'sleep') {
      closed = true;
      rig.head.position.set(0.1, 1.05, 0.25); rig.head.rotation.set(0.35, 0, 0.35);
      rig.trunk.scale.set(1.15, 0.75 + breathe * 0.03, 1);
      rig.zs.forEach(function (z, i) {
        var p = ((idleT * 0.35) + i / 3) % 1;
        z.visible = true; z.position.set(0.6 + p * 0.5, 1.4 + p * 0.8, 0.3); z.scale.setScalar(0.6 + p);
      });
    }
    rig.eyes.forEach(function (e) { e.scale.y = closed ? 0.12 : 1; });
  }

  /* =======================================================================
     4. RENDU PARTAGÉ ET CONTRÔLEUR (même interface que PixelCast)
     ======================================================================= */
  var MODELS = {
    lamia: { w: 32, h: 48, build: buildLamia, animate: animateLamia, anims: { idle: 0, wave: 1.6, cheer: 1.6, typing: 2.8 } },
    memeow: { w: 32, h: 24, build: buildMemeow, animate: animateMemeow, anims: { idle: 0, meow: 1.2, lick: 1.8, hungry: 1.8, sleep: 0 } }
  };
  var LOOPS = { idle: 1, sleep: 1 };

  function ensureRenderer(w, h) {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
    }
    if (w > rW || h > rH) { rW = Math.max(rW, w); rH = Math.max(rH, h); renderer.setSize(rW, rH, false); }
  }

  function makeScene(model, extras) {
    var scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb0d0, 0.55));
    var key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(2.5, 4, 5); scene.add(key);
    var built = model.build(extras);
    scene.add(built.root);
    var W = model.w / 10, H = model.h / 10;
    var cam = new THREE.OrthographicCamera(-W / 2, W / 2, H, 0, 0.1, 50);
    cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
    return { scene: scene, cam: cam, root: built.root, rig: built.rig };
  }

  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function renderOne(inst, now) {
    var model = MODELS[inst.id];
    var t = (now - inst.t0) / 1000, idleT = (now - inst.born) / 1000;
    if (reduced()) { t = 0.4; idleT = 0.5; }
    var dur = model.anims[inst.anim];
    if (!LOOPS[inst.anim] && dur && t > dur) { inst.anim = 'idle'; inst.t0 = now; t = 0; }
    model.animate(inst.s.rig, inst.anim, t, idleT);
    // Léger balancement pour montrer le volume
    inst.s.root.rotation.y = (reduced() ? 0.25 : Math.sin(idleT * 0.55) * 0.32) * (inst.flip ? -1 : 1) + (inst.flip ? Math.PI * 0 : 0);
    if (inst.flip) inst.s.root.scale.x = -1;
    var w = inst.canvas.width, h = inst.canvas.height;
    ensureRenderer(w, h);
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(inst.s.scene, inst.s.cam);
    inst.ctx.clearRect(0, 0, w, h);
    inst.ctx.drawImage(renderer.domElement, 0, rH - h, w, h, 0, 0, w, h);
  }

  function visible(c) { return c.isConnected && c.offsetParent !== null && !document.hidden; }

  function loop(now) {
    raf = null;
    if (!instances.length) return;
    if (now - last >= 1000 / FPS - 2) {
      last = now;
      instances.forEach(function (inst) {
        if (!inst.s || !inst.playing) return;
        if (!inst.canvas.isConnected) return;
        if (!visible(inst.canvas) && inst.drawn) return;
        // Petits avatars : 10 images par seconde suffisent
        if (inst.canvas.width < 220 && inst.drawn && now - (inst.lastDraw || 0) < 95) return;
        inst.lastDraw = now;
        try { renderOne(inst, now); inst.drawn = true; frames++; } catch (e) { if (root.console) console.error(e); inst.playing = false; }
      });
    }
    if (!reduced()) raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (raf == null) raf = requestAnimationFrame(loop);
  }

  var mounted = typeof WeakMap === 'function' ? new WeakMap() : null;

  function mount(canvas, id, options) {
    var model = MODELS[id];
    if (!model) throw new Error('Chibi3D : personnage inconnu « ' + id + ' »');
    var opts = options || {};
    var prev = mounted && mounted.get(canvas);
    if (prev) prev.destroy();
    var scale = Math.max(1, Math.min(64, Math.round(+opts.scale) || 4));
    var dpr = root.devicePixelRatio || 1;
    var k = Math.max(1, Math.round(scale * dpr));
    canvas.width = model.w * k; canvas.height = model.h * k;
    canvas.style.width = (model.w * k / dpr) + 'px'; canvas.style.height = (model.h * k / dpr) + 'px';
    canvas.style.imageRendering = 'auto';
    if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'img');
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', id === 'memeow' ? 'Memeow, la chatte de Lamia, en 3D' : 'Lamia, en 3D');
    var now = performance.now();
    var inst = { id: id, canvas: canvas, ctx: canvas.getContext('2d'), s: null, anim: model.anims[opts.animation] != null ? opts.animation : 'idle', t0: now, born: now - Math.random() * 3000, playing: true, flip: !!opts.flip, drawn: false };
    instances.push(inst);
    var ctrl = {
      play: function (name) {
        if (name != null && model.anims[name] == null) return ctrl;
        inst.playing = true;
        if (name != null && !(name === inst.anim && LOOPS[name])) { inst.anim = name; inst.t0 = performance.now(); }
        if (reduced()) { inst.drawn = false; if (inst.s) renderOne(inst, performance.now()); }
        kick();
        return ctrl;
      },
      stop: function () { inst.playing = false; return ctrl; },
      destroy: function () {
        inst.playing = false;
        var i = instances.indexOf(inst); if (i >= 0) instances.splice(i, 1);
        if (mounted && mounted.get(canvas) === ctrl) mounted['delete'](canvas);
        try { inst.ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (e) { /* rien */ }
      }
    };
    if (mounted) mounted.set(canvas, ctrl);
    load().then(function () {
      if (instances.indexOf(inst) < 0) return;
      inst.s = makeScene(model, (opts.extras || []).slice());
      inst.t0 = performance.now();   // l'animation démarre quand le personnage apparaît
      renderOne(inst, performance.now()); inst.drawn = true;
      kick();
    }, function (e) {
      if (root.console) console.warn(e.message);
      if (opts.fallback) { ctrl.destroy(); opts.fallback(); }
    });
    return ctrl;
  }

  root.Chibi3D = Object.freeze({
    version: '1.0.0',
    mount: mount,
    supports: function (id) { return !!MODELS[id] && typeof document !== 'undefined' && webglOK(); },
    animations: { lamia: Object.keys(MODELS.lamia.anims), memeow: Object.keys(MODELS.memeow.anims) },
    preload: load,
    _stats: function () { return { frames: frames, instances: instances.map(function (i) { return [i.id, i.anim, i.playing, !!i.s, i.canvas.isConnected, i.canvas.className + '|' + (i.canvas.parentNode && i.canvas.parentNode.className)]; }) }; }
  });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
})(typeof window !== 'undefined' ? window : this);
