import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadStatue, makeBall10, loadRecorder } from './objects.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DISC_SPIN = 1.6; // rad/s, ~15rpm

/* The studio the objects reflect. A polished sphere shows you the room, not the
   lights, so the reference's two soft highlights and dark centre have to exist as
   geometry: two front softboxes left and right, a dark surround behind the camera
   for the ball to go dark against, and a floor bounce so undersides don't go black.
   Emissive values above 1 are what make them read as lights once PMREM'd. */
function studioEnv() {
  const env = new THREE.Scene();

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.38, 0.38, 0.4), side: THREE.BackSide })
  );
  env.add(room);

  const panel = (x, y, z, w, h, power) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(power, power, power) })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };

  // tall narrow boxes placed wide, so their highlights land at 10 and 2 o'clock
  // on a sphere the way they do on the reference ball
  panel(-8.5, 2.5, 6.5, 4.5, 15, 5.0);
  panel(8.5, 2.5, 6.5, 4.5, 15, 5.0);
  panel(0, -8, 4, 20, 9, 1.4); // floor bounce — the bright rim along the underside
  panel(0, 10, 1, 14, 6, 1.0); // ceiling
  // a black card right behind the camera: the room is mid-grey so dielectrics keep
  // their form, and this is what gives the metals their dark centre
  panel(0, 0, 15, 16, 16, 0.02);

  return env;
}

// composition: loose depth triangle, 10-ball in the middle
// `size` is the object's largest dimension in world units, so the three are sized
// against each other in one place rather than by per-model fudge factors.
const LAYOUT = [
  { key: 'statue', size: 3.6, pos: V(-1.9, 0.3, -0.8), view: V(-0.5, 0.16, 1) },
  { key: 'ball', size: 2.0, pos: V(0.15, -0.5, 1.3), view: V(0.1, 0.1, 1) },
  { key: 'recorder', size: 2.9, pos: V(1.85, 0.5, -0.5), view: V(0.45, 0.3, 1) },
];

export async function createScene(canvas, onProgress) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f3f1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnv(), 0.015).texture;
  // the look is softbox: the environment does most of the shading, and the key is
  // kept low so its cast shadow stays a faint gradient rather than a hard edge
  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(4, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0009;
  const cam = key.shadow.camera;
  cam.left = -6; cam.right = 6; cam.top = 6; cam.bottom = -6; cam.near = 0.5; cam.far = 30;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-5, 1, 3);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const world = new THREE.Group();
  scene.add(world);

  // ambient occlusion: the soft darkening where forms meet, which the statue's
  // carving has none of otherwise. The composer target keeps MSAA, which a plain
  // EffectComposer render target would drop.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType })
  );
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.22, distanceExponent: 1, thickness: 0.5, scale: 1, samples: 16 });
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  onProgress?.(15);
  const [statue, recorder] = await Promise.all([
    // BASE_URL, not a leading slash: GitHub Pages serves this from /<repo>/
    loadStatue(import.meta.env.BASE_URL + 'persepolis.glb'),
    loadRecorder(import.meta.env.BASE_URL + 'tp7.glb'),
  ]);
  onProgress?.(80);
  const models = { statue, ball: await makeBall10(), recorder };

  // each object gets a wrapper so drift/bob never touches the model's own transform
  const items = LAYOUT.map((cfg) => {
    const wrap = new THREE.Group();
    wrap.position.copy(cfg.pos);
    const model = models[cfg.key];
    const raw = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const baseScale = cfg.size / Math.max(raw.x, raw.y, raw.z);
    model.scale.setScalar(baseScale);
    // every material this object owns, so hovering can darken the whole of it
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (mats.includes(o.material)) return;
      o.material.userData.base = o.material.color.clone();
      mats.push(o.material);
    });
    wrap.add(model);
    world.add(wrap);
    // half the largest extent, not the AABB's bounding sphere -- that overshoots by sqrt(3)
    const radius = cfg.size / 2;
    return { ...cfg, wrap, model, mats, baseScale, shade: 0, radius, phase: Math.random() * Math.PI * 2 };
  });

  const HOME = V(0, 0, 15.0);
  const pointer = new THREE.Vector2();
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  camera.position.copy(HOME);

  let hovered = null; // object under the pointer
  let focused = -1; // hover
  let locked = -1; // click-locked
  const active = () => (locked >= 0 ? locked : focused);

  // distance that fits an object's bounding sphere in frame
  const fitDistance = (r) => (r * 1.35) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    camera.aspect = w / h;
    // hold the composition width on narrow screens
    camera.fov = 32 * Math.max(1, 1.35 / camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    ao.setSize(w, h);
  }

  const raycaster = new THREE.Raycaster();
  let downAt = null;

  function hit() {
    raycaster.setFromCamera(pointer, camera);
    const objs = items.map((it) => it.model);
    const h = raycaster.intersectObjects(objs, true)[0];
    if (!h) return null;
    let o = h.object;
    while (o && !objs.includes(o)) o = o.parent;
    return o ? objs.indexOf(o) : null;
  }

  const track = (e) => pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);

  canvas.addEventListener('pointerdown', (e) => {
    track(e);
    downAt = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointermove', (e) => {
    track(e);
    hovered = hit();
    canvas.style.cursor = hovered !== null ? 'pointer' : '';
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    track(e); // a synthetic click may never send a move first
    const drag = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (drag > 6) return; // a drag is never a click
    const i = hit();
    locked = i !== null && i !== locked ? i : -1;
    api.onLock?.(locked);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      locked = -1;
      api.onLock?.(-1);
    }
  });

  // Intro, timed off the reference recording: the objects appear at full size but
  // spread apart and converge hard in ~0.6s, then the camera keeps creeping in for
  // several seconds afterwards.
  let settle = REDUCED ? 1 : 0; // position convergence
  let creep = REDUCED ? 1 : 0; // the slow zoom that follows
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const clock = new THREE.Clock();

  // no visibility gate: the browser already throttles rAF when the tab is hidden,
  // and gating it by hand strands the loop when the resume event doesn't arrive
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    if (!REDUCED) {
      settle = Math.min(1, settle + dt / 0.6);
      creep = Math.min(1, creep + dt / 6);
      const spread = 1 + 1.15 * (1 - easeOut(settle));
      // objects stay put; only a shared bob and the mouse parallax move them
      for (const it of items) {
        it.wrap.position.set(
          it.pos.x * spread,
          it.pos.y * spread + Math.sin(t * 0.3 + it.phase) * 0.06,
          it.pos.z * spread
        );
        for (const disc of it.model.userData.disc || []) disc.rotation.y += DISC_SPIN * dt;
      }
    }

    const i = active();
    const par = i >= 0 ? 0.15 : 1; // parallax calms down when focused
    if (i >= 0) {
      const it = items[i];
      it.wrap.getWorldPosition(desiredTarget);
      desired.copy(it.view).normalize().multiplyScalar(fitDistance(it.radius)).add(desiredTarget);
    } else {
      desiredTarget.set(0, 0, 0);
      desired.copy(HOME);
      desired.z += 1.6 * (1 - easeOut(creep));
    }
    if (!REDUCED) {
      desired.x += pointer.x * 0.6 * par;
      desired.y += pointer.y * 0.4 * par;
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, pointer.x * 0.12 * par, 3, dt);
      world.rotation.x = THREE.MathUtils.damp(world.rotation.x, -pointer.y * 0.09 * par, 3, dt);
    }

    // hover drops a shadow across the object itself
    items.forEach((it, n) => {
      it.shade = THREE.MathUtils.damp(it.shade, n === hovered ? 1 : 0, 7, dt);
      for (const m of it.mats) m.color.copy(m.userData.base).multiplyScalar(1 - 0.12 * it.shade);
    });

    // ~1.2s settle, frame-rate independent
    const k = REDUCED ? 1 : 1 - Math.pow(0.0015, dt);
    camera.position.lerp(desired, k);
    target.lerp(desiredTarget, k);
    camera.lookAt(target);

    composer.render();
  }

  addEventListener('resize', resize);
  resize();
  onProgress?.(100);
  loop();

  const api = {
    count: items.length,
    preview: (i) => {
      focused = i;
    },
    lock: (i) => {
      locked = i;
    },
    get locked() {
      return locked;
    },
    onLock: null,
    resize, // the canvas is resized by CSS when it shrinks into the nav card
    debug: { renderer, scene, camera, items },
  };
  return api;
}
