/* 3D hero v2: cinematic studio scene — chrome barbell with bumper plates,
   glowing accent ring, particle depth, procedural studio environment map
   (realistic reflections without any external HDR asset). Loaded lazily by
   the inline gate; the CSS poster underneath is the permanent fallback. */

import * as THREE from '../vendor/three.module.min.js';

const host = document.getElementById('hero-visual');
if (host) init(host);

/* Procedural "photo studio" environment: vertical gradient + bright light
   bands on a canvas, wrapped equirectangular. This is what makes chrome look
   like chrome. */
function makeStudioEnv(renderer, primaryHex) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3a4b66');
  grad.addColorStop(0.45, '#131a26');
  grad.addColorStop(1, '#05070c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  // soft studio light bands (reflected as highlight streaks on metal)
  g.globalAlpha = 0.9; g.fillStyle = '#dfe9ff';
  g.filter = 'blur(6px)';
  g.fillRect(40, 30, 140, 14);
  g.fillRect(300, 52, 170, 10);
  g.globalAlpha = 0.5; g.fillStyle = primaryHex;
  g.fillRect(180, 150, 220, 18);
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
  const primary = new THREE.Color(host.dataset.primary || '#3b82f6');
  const accent = new THREE.Color(host.dataset.accent || '#38bdf8');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070c, 0.055);

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 60);
  camera.position.set(0, 0.5, 9.5);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  scene.environment = makeStudioEnv(renderer, '#' + primary.getHexString());

  // --- lights (env does most of the work; these shape the drama) ----------
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 2.2);
  rim.position.set(-7, -3, -5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x334155, 0.5));

  const group = new THREE.Group();
  scene.add(group);

  // --- materials -----------------------------------------------------------
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xe8edf5, metalness: 1, roughness: 0.12,
    clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.4,
  });
  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x11151d, metalness: 0.1, roughness: 0.55,
    clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.8,
  });
  const rimGlow = new THREE.MeshStandardMaterial({
    color: primary, emissive: primary, emissiveIntensity: 0.9,
    metalness: 0.2, roughness: 0.3,
  });

  // --- barbell: chrome bar, sleeve collars, rubber bumper plates -----------
  const barbell = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7.4, 32), chrome);
  bar.rotation.z = Math.PI / 2;
  barbell.add(bar);

  for (const side of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 24), chrome);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = side * 2.35;
    barbell.add(collar);

    let x = side * 2.85;
    for (const [radius, width] of [[1.15, 0.3], [0.95, 0.24], [0.7, 0.2]]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 48), rubber);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = x;
      barbell.add(plate);
      // thin glowing rim band on each plate — the "brand color" detail
      const band = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.04, 0.025, 10, 60), rimGlow);
      band.rotation.y = Math.PI / 2;
      band.position.x = x + side * (width / 2 - 0.01);
      barbell.add(band);
      x += side * (width + 0.09);
    }
  }
  barbell.rotation.set(0.12, 0, -0.22);
  group.add(barbell);

  // --- glowing accent ring behind the barbell ------------------------------
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(3.1, 0.035, 12, 120),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.65 })
  );
  halo.position.set(0.4, 0.1, -2.6);
  halo.rotation.x = 0.35;
  group.add(halo);

  // --- particle depth field -------------------------------------------------
  const N = 160;
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = -2 - Math.random() * 14;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: accent, size: 0.045, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(particles);

  // --- interaction: drag, pointer parallax, Android gyro -------------------
  let rotX = 0, rotY = 0, targetX = 0, targetY = 0;
  let dragging = false, lastPX = 0, lastPY = 0;

  host.addEventListener('pointerdown', (e) => { dragging = true; lastPX = e.clientX; lastPY = e.clientY; });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (dragging) {
      targetY += (e.clientX - lastPX) * 0.005;
      targetX += (e.clientY - lastPY) * 0.005;
      targetX = THREE.MathUtils.clamp(targetX, -0.5, 0.5);
      lastPX = e.clientX; lastPY = e.clientY;
    } else if (matchMedia('(pointer: fine)').matches) {
      targetY = (e.clientX / innerWidth - 0.5) * 0.35;
      targetX = (e.clientY / innerHeight - 0.5) * 0.2;
    }
  }, { passive: true });

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', (e) => {
      if (e.beta === null) return;
      targetY = THREE.MathUtils.clamp((e.gamma || 0) / 110, -0.4, 0.4);
      targetX = THREE.MathUtils.clamp(((e.beta || 0) - 40) / 150, -0.3, 0.3);
    }, { passive: true });
  }

  // --- sizing ----------------------------------------------------------------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // full-bleed hero: keep the barbell clear of the copy — right side on
    // desktop, upper third on phones
    if (camera.aspect > 1.05) {
      group.position.set(2.3, 0.4, 0);
      group.scale.setScalar(1);
    } else {
      group.position.set(0, 2.1, -1.2);
      group.scale.setScalar(0.72);
    }
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  // --- loop: pause offscreen/hidden -------------------------------------------
  let running = false;
  const clock = new THREE.Clock();

  function frame() {
    const t = clock.getElapsedTime();
    rotX += (targetX - rotX) * 0.05;
    rotY += (targetY - rotY) * 0.05;
    group.rotation.set(rotX * 0.6, rotY + t * 0.08, 0);
    barbell.position.y = Math.sin(t * 0.7) * 0.16;
    halo.rotation.z = t * 0.05;
    particles.rotation.y = t * 0.008;
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
