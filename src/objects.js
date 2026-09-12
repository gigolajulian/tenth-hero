import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader();

/* the TP-7's own "blasted_aluminum" — base 0.8 grey, metalness 1, roughness 0.419.
   Everything in the scene is finished in it so the three objects read as one family. */
export const alu = () => new THREE.MeshPhysicalMaterial({
  color: 0xcccccc, metalness: 1, roughness: 0.42,
  clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 1.15,
});

/* ── 1. Porcelain creature ──────────────────────────────────────────────────
   creature_improved.glb is 60 overlapping UV-spheres out of trimesh: no normals,
   eyes only on the -Y side, and a base slab (#59) coplanar with the paws that
   z-fights. Merge to one draw call and fix those two in the same pass. */
const EYE_MESHES = [9, 10, 29, 30];
const BASE_MESH = 59;
const KNOWN_COUNT = 60;

export async function loadCreature(url) {
  const gltf = await loader.loadAsync(url);
  const meshes = [];
  gltf.scene.traverse((o) => o.isMesh && meshes.push(o));
  const known = meshes.length === KNOWN_COUNT;

  const parts = [];
  meshes.forEach((m, i) => {
    if (known && i === BASE_MESH) return;
    m.updateWorldMatrix(true, false);
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    for (const a of ['normal', 'uv', 'tangent']) g.deleteAttribute(a);
    parts.push(g);
    if (known && EYE_MESHES.includes(i)) {
      // mirror the eye across the body so the far side isn't blank
      g.computeBoundingBox();
      const y = (g.boundingBox.min.y + g.boundingBox.max.y) / 2;
      parts.push(g.clone().translate(0, -2 * y, 0));
    }
  });

  const geom = mergeGeometries(parts, false);
  geom.rotateX(-Math.PI / 2); // trimesh is Z-up
  geom.center();
  geom.computeVertexNormals();

  return new THREE.Mesh(geom, alu());
}


/* ── 1b. Persepolis scan ──────────────────────────────────────────────────────
   A photogrammetry capture: the statue sits on a sheet of captured ground. In the
   file's own space that ground is everything below z = 0.10 — 46.5k verts, 93% of
   them up-facing, spanning the full XY extent, while the statue above it is under
   2% up-facing. Drop those triangles before the node transform is applied, since
   the exporter's own root rotation would otherwise move the axis out from under
   the threshold. */
const GROUND_Z = 0.1;

function cropGround(g, cut) {
  const pos = g.attributes.position;
  const idx = g.index;
  if (!idx) return g;
  const keep = [];
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    if ((pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3 >= cut) keep.push(a, b, c);
  }
  g.setIndex(keep);
  return g;
}

export async function loadStatue(url) {
  const gltf = await loader.loadAsync(url);
  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    const g = cropGround(o.geometry.clone(), GROUND_Z).applyMatrix4(o.matrixWorld);
    for (const a of ['uv', 'uv1', 'tangent']) g.deleteAttribute(a);
    parts.push(g);
  });

  const geom = mergeGeometries(parts, false);
  geom.computeBoundingBox();
  const b = geom.boundingBox;
  // the exporter may or may not have already converted Z-up to Y-up
  if (b.max.z - b.min.z > b.max.y - b.min.y) geom.rotateX(-Math.PI / 2);
  geom.center();
  geom.computeBoundingSphere();

  return new THREE.Mesh(geom, alu());
}

/* ── 2. The 10 ball ───────────────────────────────────────────────────────── */
// grey with a hint of the keycap slate blue; the numeral is painted in the same
// colour so the disc reads as part of the ball
const BALL_BLUE = 0x5d6773;

export async function makeBall10() {
  const R = 1;
  const group = new THREE.Group();

  // Satin: mid roughness with a weak, diffuse clearcoat, so the softboxes land as a
  // broad soft sheen rather than a mirror highlight or nothing at all.
  const satin = {
    metalness: 0.0, roughness: 0.42,
    clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.95,
  };
  const body = Object.assign(alu(), satin);
  body.color.set(BALL_BLUE);
  group.add(new THREE.Mesh(new THREE.SphereGeometry(R, 128, 128), body));

  // number disc as a real spherical cap -- a flat CircleGeometry fan sinks inside
  // the sphere between its centre and rim, leaving only a ring visible
  // disc radius as a fraction of the ball. The numeral is mapped across the disc,
  // so scaling this alone grows circle and text together.
  const RR = 0.490;
  const patch = new THREE.SphereGeometry(R * 1.004, 96, 28, 0, Math.PI * 2, 0, Math.asin(RR / R));
  patch.rotateX(Math.PI / 2); // pole +Y -> +Z
  const pp = patch.attributes.position;
  const uv = patch.attributes.uv;
  const span = R * 1.004 * (RR / R);
  for (let i = 0; i < pp.count; i++) {
    uv.setXY(i, (pp.getX(i) / span) * 0.5 + 0.5, (pp.getY(i) / span) * 0.5 + 0.5);
  }

  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  // white disc like an 8-ball, numeral in the ball's own blue
  x.fillStyle = '#efeeea';
  x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#' + BALL_BLUE.toString(16).padStart(6, '0');
  // scaled up by the same 1.10 the disc came down by, so the numeral's size holds
  x.font = '700 250px "Helvetica Neue", Helvetica, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('10', 256, 270);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // same finish as the body so the cap's edge disappears into the ball
  // the numbered disc stays glossy dielectric, like the resin inlay on a real ball
  const face = Object.assign(alu(), satin);
  face.color.set(0xffffff);
  face.map = tex;
  group.add(new THREE.Mesh(patch, face));

  return group;
}

/* ── 3. T-10 recorder ─────────────────────────────────────────────────────── */
/* The decal atlas carries the TP-7 branding twice: large on the face (top-left of the
   atlas) and small on the edge. Repaint both as T-10 in place, keeping the texture's
   own flipY/colorSpace settings rather than building a new one. */
const TP7_MARKS = [
  { clear: [5, 20, 172, 74], x: 12, y: 79, size: 62, rot: 0 },
  { clear: [746, 338, 50, 92], x: 788, y: 416, size: 26, rot: -Math.PI / 2 },
];

function rebrand(material) {
  const tex = material.map;
  const img = tex?.image;
  if (!img?.width || tex.userData.rebranded) return; // the atlas is shared by eight meshes
  tex.userData.rebranded = true;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.fillStyle = '#111';
  x.textBaseline = 'alphabetic';
  for (const m of TP7_MARKS) {
    x.clearRect(...m.clear);
    x.save();
    x.translate(m.x, m.y);
    x.rotate(m.rot);
    x.font = `400 ${m.size}px Switzer, Helvetica, Arial, sans-serif`;
    x.fillText('T-10', 0, 0);
    x.restore();
  }
  tex.image = c;
  tex.needsUpdate = true;
}


/* The platter's printed marks, rebuilt as a disc face laid out in polar coordinates
   and parented to the platter itself. Everything is placed by (angle, radius) inside
   a circle inscribed in the canvas, so no mark can cross the disc edge however far
   it turns — which is what went wrong when the glb's own flat decal quads were spun.
   Parenting means it inherits the platter's rotation; nothing extra to animate. */
function makeDiscFace(radius) {
  const S = 1024;
  const C = S / 2;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  x.fillStyle = 'rgba(38, 38, 40, 0.9)';
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  const HUB = 0.3; // where the raised centre hub ends, as a fraction of the radius

  // radial line from the hub out toward the rim
  const line = (deg, from, to) => {
    const a = (deg * Math.PI) / 180;
    x.save();
    x.strokeStyle = 'rgba(38, 38, 40, 0.85)';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(C + Math.cos(a) * C * from, C + Math.sin(a) * C * from);
    x.lineTo(C + Math.cos(a) * C * to, C + Math.sin(a) * C * to);
    x.stroke();
    x.restore();
  };

  // place text tangentially at a fraction of the disc radius
  const mark = (txt, deg, frac, size) => {
    const a = (deg * Math.PI) / 180;
    x.save();
    x.translate(C + Math.cos(a) * C * frac, C + Math.sin(a) * C * frac);
    x.rotate(a + Math.PI / 2);
    x.font = `400 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    x.fillText(txt, 0, 0);
    x.restore();
  };

  line(-90, HUB, 0.97); // the seam, running the full diameter through the hub
  line(90, HUB, 0.97);
  mark('96 / 24', 180, 0.47, 34);
  mark('3 ◎ M', 0, 0.47, 34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const geom = new THREE.CircleGeometry(radius, 128);
  geom.rotateX(-Math.PI / 2); // +Z normal -> +Y, the platter's visible side

  return new THREE.Mesh(geom, new THREE.MeshPhysicalMaterial({
    map: tex, transparent: true, depthWrite: false,
    metalness: 0.9, roughness: 0.42, envMapIntensity: 1.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
}

export async function loadRecorder(url) {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  root.traverse((o) => {
    if (o.isMesh && o.material?.name === 'decals') rebrand(o.material);
  });
  root.updateWorldMatrix(true, true);

  // centre only -- the scene sizes the three objects against each other
  const box = new THREE.Box3().setFromObject(root);
  const wrap = new THREE.Group();
  root.position.sub(box.getCenter(new THREE.Vector3()));
  wrap.add(root);
  root.rotation.x = Math.PI / 2; // model lies face-up; stand the disc toward the camera

  // the platter: centred on the origin and thin in local Y, so spinning rotation.y
  // turns it in place. Matched by shape, not by node name (the glb's nodes are all
  // "Object_NN").
  wrap.userData.disc = [];
  // collect first: adding the disc face inside traverse() would make it visit the
  // new child, which matches the plate test and recurses until the page hangs
  const meshes = [];
  root.traverse((o) => o.isMesh && meshes.push(o));

  for (const o of meshes) {
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    const w = b.max.x - b.min.x;
    const d = b.max.z - b.min.z;
    const tris = (o.geometry.index?.count ?? 0) / 3;
    const flat = b.max.y - b.min.y < 0.1;
    const centred = Math.abs(b.min.x + b.max.x) < 0.2 && Math.abs(b.min.z + b.max.z) < 0.2;

    // Only the platter turns; its seam groove is modelled into this mesh, and the
    // rebuilt disc face rides along as a child.
    if (flat && centred && tris > 100 && w > 1.5 && Math.abs(w - d) < 0.15) {
      wrap.userData.disc.push(o);
      const face = makeDiscFace(w / 2);
      face.position.y = b.max.y + 0.004; // just proud of the plate's top surface
      o.add(face);
    }
    // the glb's own flat mark quads are replaced by that face, so retire them
    if (o.material.name === 'decals' && Math.max(w, d) < 1.8 && centred) o.visible = false;
  }

  return wrap;
}
