/* 3D hero: procedural dumbbell + kettlebell + torus-knot in brand colors.
   Loaded lazily by the inline gate ONLY on capable devices; the SVG poster
   underneath is the permanent fallback. No OrbitControls — tiny hand-rolled
   drag/tilt instead. */

import * as THREE from '../vendor/three.module.min.js';

const host = document.getElementById('hero-visual');
if (host) init(host);

function init(host) {
  const primary = new THREE.Color(host.dataset.primary || '#e63946');
  const accent = new THREE.Color(host.dataset.accent || '#ffb703');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 50);
  camera.position.set(0, 0.4, 8.5);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  host.appendChild(renderer.domElement);

  // --- lights -------------------------------------------------------------
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 1.4);
  rim.position.set(-6, -2, -4);
  scene.add(rim);

  // --- objects ------------------------------------------------------------
  const group = new THREE.Group();
  scene.add(group);

  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c2cf, metalness: 0.85, roughness: 0.3 });
  const plateMat = new THREE.MeshStandardMaterial({ color: primary, metalness: 0.4, roughness: 0.35 });
  const bellMat = new THREE.MeshStandardMaterial({ color: primary, metalness: 0.5, roughness: 0.4 });
  const knotMat = new THREE.MeshStandardMaterial({
    color: accent, metalness: 0.3, roughness: 0.25,
    emissive: accent, emissiveIntensity: 0.25,
  });

  // Dumbbell: bar + 3 plates per side
  const dumbbell = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.2, 24), steel);
  bar.rotation.z = Math.PI / 2;
  dumbbell.add(bar);
  const plateSpecs = [ [1.05, 0.34], [0.85, 0.26], [0.62, 0.22] ];
  for (const side of [-1, 1]) {
    let x = side * 1.7;
    for (const [r, w] of plateSpecs) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 36), plateMat);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = x;
      dumbbell.add(plate);
      x += side * (w + 0.06);
    }
  }
  dumbbell.rotation.z = -0.35;
  group.add(dumbbell);

  // Kettlebell: sphere + torus handle
  const kettle = new THREE.Group();
  kettle.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 24), bellMat));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 16, 32, Math.PI), steel);
  handle.position.y = 0.62;
  kettle.add(handle);
  kettle.position.set(-2.6, -1.5, -0.6);
  kettle.scale.setScalar(0.9);
  group.add(kettle);

  // Torus-knot energy accent
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.14, 90, 12), knotMat);
  knot.position.set(2.7, 1.7, -1.2);
  group.add(knot);

  // --- interaction: drag to rotate, pointer parallax, Android tilt --------
  let dragX = 0, dragY = 0, targetX = 0, targetY = 0;
  let dragging = false, lastPX = 0, lastPY = 0;

  host.addEventListener('pointerdown', (e) => { dragging = true; lastPX = e.clientX; lastPY = e.clientY; });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (dragging) {
      targetY += (e.clientX - lastPX) * 0.006;
      targetX += (e.clientY - lastPY) * 0.006;
      lastPX = e.clientX; lastPY = e.clientY;
    } else if (matchMedia('(pointer: fine)').matches) {
      // subtle parallax follows the mouse on desktop
      targetY = (e.clientX / innerWidth - 0.5) * 0.5;
      targetX = (e.clientY / innerHeight - 0.5) * 0.3;
    }
  }, { passive: true });

  // gyro tilt on Android only (iOS needs a permission gesture — drag covers it)
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', (e) => {
      if (e.beta === null) return;
      targetY = THREE.MathUtils.clamp((e.gamma || 0) / 90, -0.5, 0.5);
      targetX = THREE.MathUtils.clamp(((e.beta || 0) - 40) / 120, -0.4, 0.4);
    }, { passive: true });
  }

  // --- sizing -------------------------------------------------------------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  // --- render loop: pause when offscreen or tab hidden ---------------------
  let running = false;
  const clock = new THREE.Clock();

  function frame() {
    const t = clock.getElapsedTime();
    dragX += (targetX - dragX) * 0.06;
    dragY += (targetY - dragY) * 0.06;
    group.rotation.set(dragX, dragY + t * 0.12, 0);
    dumbbell.position.y = Math.sin(t * 0.9) * 0.18;
    kettle.position.y = -1.5 + Math.sin(t * 1.3 + 1) * 0.14;
    kettle.rotation.y = t * 0.4;
    knot.position.y = 1.7 + Math.sin(t * 1.1 + 2) * 0.2;
    knot.rotation.x = t * 0.5;
    renderer.render(scene, camera);
  }
  function setRunning(on) {
    if (on === running) return;
    running = on;
    renderer.setAnimationLoop(on ? frame : null);
  }

  new IntersectionObserver(
    (entries) => setRunning(entries[0].isIntersecting && !document.hidden),
    { threshold: 0.05 }
  ).observe(host);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setRunning(false);
    else if (host.getBoundingClientRect().bottom > 0) setRunning(true);
  });

  // first painted frame → cross-fade over the poster
  renderer.render(scene, camera);
  host.classList.add('live');
  setRunning(true);
}
