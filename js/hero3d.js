/* LeadLocker hero: liquid lime blob wrapped in chrome ribbons + orbit ring.
   Loaded lazily by the inline gate; the CSS lime-sphere poster underneath is
   the permanent fallback. Transparent canvas over the paper panel. */

import * as THREE from '../vendor/three.module.min.js';

const host = document.getElementById('orb');
if (host) init(host);

/* Bright studio env with hard dark bands — chrome on a LIGHT page needs dark
   features to reflect, or it disappears. */
function makeStudioEnv(renderer) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#dfdfd8');
  grad.addColorStop(1, '#9a9a92');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.filter = 'blur(4px)';
  g.fillStyle = '#15181e';                 // dark ceiling band
  g.fillRect(0, 10, 512, 26);
  g.fillRect(60, 120, 170, 34);            // dark side panel
  g.fillRect(330, 96, 130, 60);
  g.fillStyle = '#ffffff'; g.globalAlpha = .95;
  g.fillRect(120, 52, 200, 16);            // softbox highlight
  g.fillStyle = '#d7f452'; g.globalAlpha = .6;
  g.fillRect(280, 180, 180, 22);           // lime bounce
  g.filter = 'none'; g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

function init(host) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0.15, 8.4);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  host.appendChild(renderer.domElement);

  scene.environment = makeStudioEnv(renderer);

  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd7f452, 1.1);
  rim.position.set(-6, -4, -5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const group = new THREE.Group();
  scene.add(group);

  // --- the goo: displaced icosphere, lacquered lime -------------------------
  const goo = new THREE.MeshPhysicalMaterial({
    color: 0xa5d629, metalness: 0.05, roughness: 0.16,
    clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.25,
    sheen: 0.4, sheenColor: 0xeaffb0,
  });
  // SphereGeometry is indexed → computeVertexNormals stays smooth (an
  // icosahedron here goes faceted after displacement)
  const blobGeo = new THREE.SphereGeometry(1.62, 110, 80);
  const blob = new THREE.Mesh(blobGeo, goo);
  group.add(blob);

  const pos = blobGeo.attributes.position;
  const base = pos.array.slice();          // rest shape
  function wobble(t) {
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = base[ix], y = base[ix + 1], z = base[ix + 2];
      const n =
        0.10 * Math.sin(x * 2.1 + t * 0.9) *
               Math.cos(y * 2.4 - t * 0.7) +
        0.06 * Math.sin((y + z) * 3.1 + t * 1.3) +
        0.035 * Math.sin(z * 4.2 - t * 1.7 + x * 1.5);
      const s = 1 + n;
      pos.array[ix] = x * s; pos.array[ix + 1] = y * s; pos.array[ix + 2] = z * s;
    }
    pos.needsUpdate = true;
    blobGeo.computeVertexNormals();
  }

  // --- chrome ribbons: closed seam-curves hugging the blob ------------------
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xe9edf2, metalness: 1, roughness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6,
  });

  function ribbon(r, amp, phase, tiltX, tiltZ, tube) {
    const pts = [];
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(t) * r,
        Math.sin(2 * t + phase) * amp,
        Math.sin(t) * r
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, tube, 14, true), chrome);
    mesh.rotation.set(tiltX, 0, tiltZ);
    group.add(mesh);
    return { mesh, curve };
  }
  const r1 = ribbon(2.05, 0.95, 0, 0.28, -0.18, 0.075);
  const r2 = ribbon(2.3, 0.55, Math.PI / 2, -0.45, 0.3, 0.05);

  // outer thin orbit ring, like the reference's stray ellipse
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.024, 10, 140), chrome);
  ring.rotation.set(Math.PI / 2 - 0.32, 0.1, 0.25);
  group.add(ring);

  // chrome beads riding ribbon 1
  const beads = [];
  for (const u of [0.12, 0.47, 0.8]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), chrome);
    beads.push({ mesh: b, u });
    r1.mesh.add(b);
  }

  // --- interaction: drag, pointer parallax, Android gyro --------------------
  let rotX = 0, rotY = 0, targetX = 0, targetY = 0;
  let dragging = false, lastPX = 0, lastPY = 0;

  host.addEventListener('pointerdown', (e) => {
    dragging = true; lastPX = e.clientX; lastPY = e.clientY;
    host.setPointerCapture(e.pointerId);
  });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (dragging) {
      targetY += (e.clientX - lastPX) * 0.006;
      targetX += (e.clientY - lastPY) * 0.006;
      targetX = THREE.MathUtils.clamp(targetX, -0.7, 0.7);
      lastPX = e.clientX; lastPY = e.clientY;
    } else if (matchMedia('(pointer: fine)').matches) {
      targetY = (e.clientX / innerWidth - 0.5) * 0.45;
      targetX = (e.clientY / innerHeight - 0.5) * 0.25;
    }
  }, { passive: true });

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', (e) => {
      if (e.beta === null) return;
      targetY = THREE.MathUtils.clamp((e.gamma || 0) / 100, -0.5, 0.5);
      targetX = THREE.MathUtils.clamp(((e.beta || 0) - 40) / 140, -0.35, 0.35);
    }, { passive: true });
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  // --- loop: pause offscreen/hidden ------------------------------------------
  let running = false;
  const clock = new THREE.Clock();

  function frame() {
    const t = clock.getElapsedTime();
    rotX += (targetX - rotX) * 0.05;
    rotY += (targetY - rotY) * 0.05;
    group.rotation.set(rotX * 0.7, rotY + t * 0.12, 0);
    group.position.y = Math.sin(t * 0.6) * 0.1;
    wobble(t);
    r1.mesh.rotation.y = t * 0.1;
    r2.mesh.rotation.y = -t * 0.16;
    ring.rotation.z = 0.25 + t * 0.05;
    for (const b of beads) {
      const p = r1.curve.getPointAt((b.u + t * 0.02) % 1);
      b.mesh.position.copy(p);
    }
    renderer.render(scene, camera);
  }
  function setRunning(on) {
    if (on === running) return;
    running = on;
    renderer.setAnimationLoop(on ? frame : null);
  }

  new IntersectionObserver(
    (entries) => setRunning(entries[0].isIntersecting && !document.hidden),
    { threshold: 0.02 }
  ).observe(host);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setRunning(false);
    else if (host.getBoundingClientRect().bottom > 0) setRunning(true);
  });

  renderer.render(scene, camera);
  host.classList.add('live');
  setRunning(true);
}
