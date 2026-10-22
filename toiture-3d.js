/* J2B Couverture : animation 3D d'une toiture en construction (fond de la section d'accueil)
   Charpente -> liteaux -> tuiles -> faîtage. Se charge après le reste de la page.
   Réglages rapides : voir les constantes juste en dessous. */
(function () {
  'use strict';

  var OPACITY = 0.85;      // visibilité de l'animation (0 à 1)
  var LOOP = false;        // true = recommence en boucle après une pause
  var HOLD = 6;            // secondes de pause avant de recommencer (si LOOP)

  var hero = document.querySelector('.hero');
  if (!hero) return;

  var conn = navigator.connection || {};
  if (conn.saveData) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.innerWidth < 700;

  var st = document.createElement('style');
  st.textContent =
    '.hero{position:relative;overflow:hidden}' +
    '.hero>.container,.hero>.trustStrip{position:relative;z-index:1}' +
    '.hero>.trustStrip{background:rgba(10,20,31,.2)}' +
    '.hero>.roof3d{position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:' + OPACITY + '}';
  document.head.appendChild(st);

  function load() {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = init;
    document.head.appendChild(s);
  }
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2500 });
  else setTimeout(load, 800);

  function init() {
    var THREE = window.THREE;
    if (!THREE) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: true, powerPreference: 'low-power' });
    } catch (e) { return; }

    var cv = renderer.domElement;
    cv.className = 'roof3d';
    cv.setAttribute('aria-hidden', 'true');
    hero.insertBefore(cv, hero.firstChild);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1 : 1.5));

    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var sun = new THREE.DirectionalLight(0xfff1d6, 0.9);
    sun.position.set(4, 8, 6);
    scene.add(sun);

    /* ---------- géométrie de la toiture ---------- */
    var A = 35 * Math.PI / 180, cosA = Math.cos(A), sinA = Math.sin(A);
    var W = 3, H = W * Math.tan(A), S = W / cosA, L = 8;
    var NT = small ? 5 : 7;             // nombre de fermes
    var NB = small ? 7 : 9;             // liteaux par versant
    var R = small ? 8 : 12;             // rangées de tuiles
    var C = small ? 9 : 14;             // tuiles par rangée

    function slopePoint(side, s, z) {   // side : -1 gauche, 1 droite
      return new THREE.Vector3(side < 0 ? -W + s * cosA : W - s * cosA, s * sinA, z);
    }
    function normal(side) {
      return new THREE.Vector3(side < 0 ? -sinA : sinA, cosA, 0);
    }

    var pieces = [];
    function box(sx, sy, sz, color) {
      var m = new THREE.Mesh(
        new THREE.BoxGeometry(sx, sy, sz),
        new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0 })
      );
      m.visible = false;
      return m;
    }
    function put(m, base, off, t, d) {
      m.position.copy(base).add(off);
      scene.add(m);
      pieces.push({ m: m, b: base, o: off, t: t, d: d, done: false });
    }

    var WOOD = 0xc8a56a, WOOD2 = 0xb08d55;
    var v = function (x, y, z) { return new THREE.Vector3(x, y, z); };

    // sablières
    put(box(0.28, 0.2, L + 0.4, WOOD2), v(-W, 0, 0), v(-4, 0, 0), 0, 0.9);
    put(box(0.28, 0.2, L + 0.4, WOOD2), v(W, 0, 0), v(4, 0, 0), 0.1, 0.9);

    // fermes : chevrons + entrait
    var tTruss0 = 0.9, trussStep = 0.35;
    var yE = 0.9, lenE = 2 * (W - yE / Math.tan(A));
    var rafLen = S + 0.35, rafMid = (S - 0.35) / 2;
    for (var i = 0; i < NT; i++) {
      var z = -L / 2 + i * (L / (NT - 1));
      var t = tTruss0 + i * trussStep;
      var rl = box(rafLen, 0.14, 0.1, WOOD); rl.rotation.z = A;
      put(rl, slopePoint(-1, rafMid, z), v(-1.5, 4.5, 0), t, 0.7);
      var rr = box(rafLen, 0.14, 0.1, WOOD); rr.rotation.z = -A;
      put(rr, slopePoint(1, rafMid, z), v(1.5, 4.5, 0), t + 0.12, 0.7);
      put(box(lenE, 0.1, 0.1, WOOD2), v(0, yE, z), v(0, 3, 0), t + 0.3, 0.6);
    }
    var tTrussEnd = tTruss0 + (NT - 1) * trussStep + 0.9;

    // poutre faîtière
    put(box(0.22, 0.22, L + 0.4, WOOD2), v(0, H + 0.04, 0), v(0, 5, 0), tTrussEnd - 0.4, 0.8);

    // liteaux
    var tB0 = tTrussEnd + 0.2;
    for (var k = 0; k < NB; k++) {
      var s = 0.15 + k * ((S - 0.35) / (NB - 1));
      [-1, 1].forEach(function (side) {
        var b = box(0.1, 0.06, L + 0.3, 0xa98652);
        b.rotation.z = side < 0 ? A : -A;
        var n = normal(side);
        put(b, slopePoint(side, s, 0).addScaledVector(n, 0.1), n.clone().multiplyScalar(1.8), tB0 + k * 0.12, 0.5);
      });
    }

    // tuiles (instanciées pour rester légères)
    var tT0 = tB0 + NB * 0.12 + 0.5, TD = 0.55;
    var SS = S + 0.32, rowH = SS / R, tLen = rowH * 1.3;
    var span = L + 0.2, tW = span / C * 0.93;
    var N = 2 * R * C;
    var tileMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      N
    );
    var dummy = new THREE.Object3D(), col = new THREE.Color(), tiles = [], idx = 0;
    for (var sd = 0; sd < 2; sd++) {
      var side = sd ? 1 : -1, nrm = normal(side);
      for (var r = 0; r < R; r++) {
        for (var c = 0; c < C; c++) {
          var sPos = -0.3 + (r + 0.5) * rowH;
          var zPos = -span / 2 + (c + 0.5) * (span / C);
          tiles.push({
            b: slopePoint(side, sPos, zPos).addScaledVector(nrm, 0.16 + r * 0.006),
            n: nrm, rz: side < 0 ? A : -A,
            t: tT0 + r * 0.38 + c * 0.03 + sd * 0.05, done: false
          });
          col.setHSL(0.04 + Math.random() * 0.015, 0.55 + Math.random() * 0.12, 0.33 + Math.random() * 0.08);
          tileMesh.setColorAt(idx, col);
          dummy.position.copy(tiles[idx].b);
          dummy.rotation.set(0, 0, tiles[idx].rz);
          dummy.scale.set(0.0001, 0.0001, 0.0001);
          dummy.updateMatrix();
          tileMesh.setMatrixAt(idx, dummy.matrix);
          idx++;
        }
      }
    }
    tileMesh.instanceColor.needsUpdate = true;
    scene.add(tileMesh);

    // faîtage (tuiles faîtières)
    var tEnd = tT0 + (R - 1) * 0.38 + (C - 1) * 0.03 + TD + 0.05;
    var cap = box(0.3, 0.3, L + 0.5, 0x8e3f22); cap.rotation.z = Math.PI / 4;
    put(cap, v(0, H + 0.06, 0), v(0, 3, 0), tEnd - 0.2, 0.7);
    var total = tEnd + 0.6;

    function ease(p) { return 1 - Math.pow(1 - p, 3); }

    function update(t) {
      var i, p, e, o, tl;
      for (i = 0; i < pieces.length; i++) {
        o = pieces[i];
        if (o.done) continue;
        p = (t - o.t) / o.d;
        if (p <= 0) { o.m.visible = false; continue; }
        if (p >= 1) { p = 1; o.done = true; }
        e = ease(p);
        o.m.visible = true;
        o.m.position.copy(o.b).addScaledVector(o.o, 1 - e);
        o.m.material.opacity = Math.min(1, e * 1.5);
      }
      var changed = false;
      for (i = 0; i < tiles.length; i++) {
        tl = tiles[i];
        if (tl.done) continue;
        p = (t - tl.t) / TD;
        if (p <= 0) continue;
        if (p >= 1) { p = 1; tl.done = true; }
        e = Math.max(ease(p), 0.0001);
        dummy.position.copy(tl.b).addScaledVector(tl.n, (1 - e) * 1.6);
        dummy.rotation.set(0, 0, tl.rz);
        dummy.scale.set(tLen * e, 0.05 * e, tW * e);
        dummy.updateMatrix();
        tileMesh.setMatrixAt(i, dummy.matrix);
        changed = true;
      }
      if (changed) tileMesh.instanceMatrix.needsUpdate = true;
    }

    function reset() {
      var i;
      for (i = 0; i < pieces.length; i++) { pieces[i].done = false; pieces[i].m.visible = false; pieces[i].m.material.opacity = 0; }
      for (i = 0; i < tiles.length; i++) {
        tiles[i].done = false;
        dummy.position.copy(tiles[i].b);
        dummy.rotation.set(0, 0, tiles[i].rz);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.updateMatrix();
        tileMesh.setMatrixAt(i, dummy.matrix);
      }
      tileMesh.instanceMatrix.needsUpdate = true;
    }

    /* ---------- caméra ---------- */
    var dist = 10;
    function orbit(t) {
      var th = 0.45 * Math.sin(t * 0.15);
      cam.position.set(Math.sin(th) * dist, dist * 0.55, Math.cos(th) * dist);
      cam.lookAt(0, 0.9, 0);
    }

    function resize() {
      var w = hero.clientWidth, h = hero.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      var vf = cam.fov * Math.PI / 180;
      var hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
      dist = Math.max(4.6 / Math.tan(hf / 2), 3.6 / Math.tan(vf / 2));
      if (cam.aspect > 1.2) cam.setViewOffset(w, h, w * 0.2, 0, w, h); else cam.clearViewOffset();
      cam.updateProjectionMatrix();
      if (reduce) { orbit(0); renderer.render(scene, cam); }
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(hero);
    else window.addEventListener('resize', resize);

    /* ---------- mouvement réduit : toiture terminée, image fixe ---------- */
    if (reduce) {
      update(1e6);
      orbit(0);
      renderer.render(scene, cam);
      return;
    }

    /* ---------- boucle (en pause hors écran / onglet masqué) ---------- */
    var visible = true, raf = 0, last = 0, clock = 0;

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) { last = 0; return; }
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      clock += dt;
      if (LOOP && clock > total + HOLD) { clock = 0; reset(); }
      update(clock);
      orbit(clock);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      if (visible && !document.hidden && !raf) raf = requestAnimationFrame(frame);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }).observe(hero);
    }
    document.addEventListener('visibilitychange', sync);
    sync();
  }
})();