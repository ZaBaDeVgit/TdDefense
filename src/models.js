// Modelos 3D procedurales (sin assets externos). Todo se construye con primitivas de Three.js.
import * as THREE from 'three';

// ---------- Paleta y materiales (cacheados) ----------
const PAL = {
  steel: 0x3b414b, dark: 0x1b1f27, darker: 0x0f1116, orange: 0xff7a1a, blue: 0x2fb8ff,
  red: 0xff3b30, khaki: 0x7a7550, olive: 0x4a5a33, camo: 0x59603c, tan: 0x9c8a5e, sand: 0xc9a878,
  white: 0xdfe6ee, glass: 0x7fd0ff, green: 0x3f8a3a, rock: 0x6d6a64, black: 0x0c0d10,
  yellow: 0xffd23a, skin: 0xc69a7a, gray: 0x8a919c, brown: 0x5a3d2a, leaf: 0x2f6b28,
  leaf2: 0x5c9a3a, trunk: 0x5a3b25, snow: 0xf2f6fa, cactus: 0x4f8a3c, glowGreen: 0x7dff7a,
  cyan: 0x3ff0ff, purple: 0x9b5cff,
};
const matCache = new Map();
export function mat(name, extra = {}) {
  const key = name + JSON.stringify(extra);
  if (matCache.has(key)) return matCache.get(key);
  const color = PAL[name] ?? name;
  const m = new THREE.MeshStandardMaterial({
    color, roughness: extra.r ?? 0.62, metalness: extra.m ?? 0.25,
    flatShading: extra.flat ?? false, transparent: extra.t ?? false, opacity: extra.o ?? 1,
  });
  matCache.set(key, m);
  return m;
}
// Materiales de brillo (no reaccionan a la luz)
export function glow(name, opacity = 1) {
  const key = 'glow' + name + opacity;
  if (matCache.has(key)) return matCache.get(key);
  const color = PAL[name] ?? name;
  const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });
  matCache.set(key, m);
  return m;
}

// ---------- Geometrias (cacheadas) ----------
const geoCache = new Map();
function G(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const bx = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cy = (rt, rb, h, s = 10) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sp = (r, s = 12) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s - 4)));
const tor = (r, t, rs = 8, ts = 16) => G(`t${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
const cone = (r, h, s = 10) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const ico = (r, d = 0) => G(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const dod = (r) => G(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0));

export function mk(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
const grp = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

// =====================================================================
//                              TORRES
// =====================================================================
// Cada torre apunta con turret.rotation.y. El cañon/punto de salida es userData.muzzle (hijo de turret).
export const TOWER_INFO = {
  mg:       { name: 'Ametralladora', cost: 100, color: '#ffb35c' },
  missile:  { name: 'Misiles',       cost: 150, color: '#ff6b4a' },
  laser:    { name: 'Láser',         cost: 200, color: '#44c8ff' },
  aa:       { name: 'Antiaérea',     cost: 250, color: '#ffd166' },
  tesla:    { name: 'Eléctrica',     cost: 300, color: '#7fe9ff' },
};

export function createTower(type, level = 1) {
  const root = grp();
  // Base comun: plataforma hexagonal con borde naranja
  root.add(mk(cy(1.3, 1.45, 0.45, 8), mat('dark'), 0, 0.22, 0));
  root.add(mk(tor(1.25, 0.06, 8, 8), glow('orange'), 0, 0.46, 0, Math.PI / 2, 0, 0, false));
  root.add(mk(cy(0.9, 1.0, 0.3, 8), mat('steel'), 0, 0.6, 0));
  const turret = grp(0, 0.75, 0);
  root.add(turret);
  const spin = [];
  const muzzle = new THREE.Object3D();
  let lightCol = PAL.orange;

  if (type === 'mg') {
    turret.add(mk(bx(1.1, 0.5, 1.0), mat('olive'), 0, 0.25, 0));
    turret.add(mk(bx(0.55, 0.45, 0.5), mat('khaki'), -0.6, 0.2, -0.1)); // caja de municion
    turret.add(mk(bx(0.25, 0.2, 0.7), mat('dark'), 0.55, 0.3, -0.1));
    const gat = grp(0, 0.5, 0.2);
    gat.add(mk(cy(0.22, 0.22, 0.6, 10), mat('steel'), 0, 0, 0.1, Math.PI / 2));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      gat.add(mk(cy(0.04, 0.04, 1.6, 6), mat('steel', { m: 0.7 }), Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.9, Math.PI / 2));
    }
    turret.add(gat);
    spin.push(gat);
    muzzle.position.set(0, 0.5, 1.9);
    turret.add(muzzle);
    lightCol = PAL.orange;
  } else if (type === 'missile') {
    turret.add(mk(bx(1.5, 0.6, 1.3), mat('olive'), 0, 0.3, 0));
    turret.add(mk(bx(0.3, 0.3, 1.0), mat('dark'), 0, 0.02, 0));
    const pitch = 0.35;
    for (const x of [-0.42, 0.42]) for (const y of [0.85, 0.5]) {
      const tubeRot = Math.PI / 2 - pitch;
      turret.add(mk(cy(0.18, 0.18, 1.5, 10), mat('steel'), x, y + 0.3, 0.2, tubeRot));
      const dz = Math.cos(pitch), dy = Math.sin(pitch);
      turret.add(mk(cone(0.18, 0.35, 10), glow('red'), x, y + 0.3 + dy * 0.95, 0.2 + dz * 0.95, tubeRot));
    }
    muzzle.position.set(0, 1.25, 1.2);
    turret.add(muzzle);
    lightCol = PAL.red;
  } else if (type === 'laser') {
    // pilar central
    root.add(mk(cy(0.32, 0.45, 1.5, 10), mat('steel'), 0, 1.4, 0));
    root.add(mk(tor(0.55, 0.05, 8, 20), glow('blue'), 0, 1.0, 0, Math.PI / 2, 0, 0, false));
    turret.add(mk(bx(1.0, 0.55, 1.3), mat('steel'), 0, 0.3, 0));
    turret.add(mk(bx(1.2, 0.2, 0.3), mat('dark'), 0, 0.6, 0.2));
    turret.add(mk(sp(0.32, 14), glow('blue'), 0, 0.3, 0.7));
    turret.add(mk(cy(0.1, 0.1, 0.8, 8), mat('dark'), 0, 0.3, 1.0, Math.PI / 2));
    const ring = mk(tor(0.42, 0.04, 6, 18), glow('cyan'), 0, 0.3, 0.7, 0, 0, 0, false);
    turret.add(ring); spin.push(ring);
    muzzle.position.set(0, 0.3, 1.45);
    turret.add(muzzle);
    lightCol = PAL.blue;
  } else if (type === 'aa') {
    turret.add(mk(bx(1.4, 0.45, 1.2), mat('camo'), 0, 0.2, 0));
    turret.add(mk(bx(0.2, 0.7, 0.2), mat('steel'), -0.45, 0.6, -0.2));
    turret.add(mk(bx(0.2, 0.7, 0.2), mat('steel'), 0.45, 0.6, -0.2));
    const pitch = 0.5;
    for (const x of [-0.25, 0.25]) {
      const rot = Math.PI / 2 - pitch;
      turret.add(mk(cy(0.09, 0.09, 1.7, 8), mat('dark', { m: 0.6 }), x, 0.6, 0.5, rot));
    }
    turret.add(mk(bx(0.6, 0.25, 0.4), glow('orange'), 0, 0.2, -0.65));
    muzzle.position.set(0, 0.6 + Math.sin(pitch) * 1.4, 0.5 + Math.cos(pitch) * 1.4);
    turret.add(muzzle);
    // radar en el mastil
    root.add(mk(cy(0.04, 0.04, 0.8, 6), mat('steel'), 0.0, 1.45, -0.4));
    const dish = mk(cy(0.6, 0.6, 0.08, 16), mat('gray'), 0, 1.9, -0.4, 0.5, 0, 0);
    root.add(dish); spin.push(dish);
    lightCol = PAL.yellow;
  } else if (type === 'tesla') {
    root.add(mk(cy(0.4, 0.55, 1.9, 10), mat('steel', { m: 0.6 }), 0, 1.5, 0));
    const coils = [];
    for (let i = 0; i < 3; i++) {
      const c = mk(tor(0.62 - i * 0.12, 0.05, 8, 18), glow('cyan'), 0, 1.0 + i * 0.6, 0, Math.PI / 2, 0, 0, false);
      root.add(c); coils.push(c);
    }
    root.add(mk(cy(0.9, 0.9, 0.15, 12), mat('dark'), 0, 0.9, 0));
    const orb = mk(sp(0.5, 16), glow('cyan'), 0, 2.85, 0, 0, 0, 0, false);
    root.add(orb);
    root.add(mk(sp(0.85, 12), glow('blue', 0.22), 0, 2.85, 0, 0, 0, 0, false));
    spin.push(...coils);
    turret.position.y = 0;
    muzzle.position.set(0, 2.85, 0);
    root.add(muzzle);
    turret.visible = true;
    lightCol = PAL.cyan;
    root.userData.orb = orb;
  }

  // Decoracion por nivel
  if (level >= 2) {
    for (const [x, z] of [[1.1, 1.1], [-1.1, 1.1], [1.1, -1.1], [-1.1, -1.1]]) {
      root.add(mk(bx(0.18, 0.5, 0.18), glow(level >= 3 ? 'yellow' : 'orange'), x, 0.55, z, 0, 0, 0, false));
    }
  }
  if (level >= 3) {
    root.add(mk(tor(1.55, 0.05, 6, 24), glow('yellow'), 0, 0.12, 0, Math.PI / 2, 0, 0, false));
    const crown = mk(cy(0.12, 0.12, 0.6, 6), glow('yellow'), 0, 2.2, -0.9, 0, 0, 0, false);
    root.add(crown);
  }

  root.userData = { type, level, turret, muzzle, spin, lightCol, orbSpin: root.userData.orb };
  return root;
}

// =====================================================================
//                              ENEMIGOS
// =====================================================================
export const ENEMY_INFO = {
  soldier: { name: 'Soldado', hp: 40, speed: 1.7, dmg: 1, reward: 8, armor: 0 },
  shield: { name: 'Soldado Escudo', hp: 110, speed: 1.25, dmg: 2, reward: 15, armor: 0.35 },
  spider: { name: 'Araña Robot', hp: 70, speed: 2.5, dmg: 2, reward: 12, armor: 0 },
  jeep: { name: 'Jeep Armado', hp: 130, speed: 3.1, dmg: 3, reward: 18, armor: 0.05 },
  tank: { name: 'Tanque', hp: 420, speed: 1.0, dmg: 6, reward: 40, armor: 0.25 },
  truck: { name: 'Camión Blindado', hp: 300, speed: 1.6, dmg: 5, reward: 30, armor: 0.15 },
  drone: { name: 'Dron', hp: 90, speed: 3.0, dmg: 1, reward: 14, armor: 0, air: true },
  heli: { name: 'Helicóptero', hp: 320, speed: 1.9, dmg: 6, reward: 45, armor: 0.1, air: true },
};

function legMesh(len, mt) {
  const g = grp();
  g.add(mk(cy(0.06, 0.06, len, 6), mt, 0, -len / 2, 0));
  return g;
}

export function createEnemy(type) {
  const root = grp();
  const body = grp();
  root.add(body);
  const anim = { legs: [], wheels: [], rotors: [], lights: [], parts: [] };
  const camo = mat('camo'), steel = mat('steel');

  if (type === 'soldier' || type === 'shield') {
    const legL = grp(-0.15, 0.7, 0), legR = grp(0.15, 0.7, 0);
    legL.add(mk(bx(0.22, 0.7, 0.25), mat('olive'), 0, -0.35, 0));
    legR.add(mk(bx(0.22, 0.7, 0.25), mat('olive'), 0, -0.35, 0));
    body.add(legL, legR);
    anim.legs.push(legL, legR);
    body.add(mk(bx(0.5, 0.6, 0.3), camo, 0, 1.05, 0));
    body.add(mk(bx(0.16, 0.55, 0.16), camo, -0.33, 1.05, 0));
    body.add(mk(bx(0.16, 0.55, 0.16), camo, 0.33, 1.05, 0));
    body.add(mk(sp(0.17, 12), mat('skin'), 0, 1.5, 0));
    body.add(mk(sp(0.2, 12), mat('olive'), 0, 1.6, 0, 0, 0, 0));
    body.add(mk(bx(0.12, 0.12, 0.9), mat('black'), 0.25, 1.05, 0.4));
    body.add(mk(bx(0.35, 0.4, 0.2), mat('dark'), 0, 1.1, -0.22));
    body.add(mk(cy(0.03, 0.03, 0.3, 5), mat('steel'), 0.25, 1.08, 0.82, Math.PI / 2));
    if (type === 'shield') {
      body.add(mk(bx(0.08, 1.1, 0.7), steel, -0.42, 1.0, 0.3));
      body.add(mk(bx(0.1, 0.12, 0.72), glow('orange'), -0.42, 1.45, 0.3, 0, 0, 0, false));
      body.add(mk(bx(0.14, 0.14, 0.14), glow('blue'), 0, 1.75, 0.0, 0, 0, 0, false));
    }
  } else if (type === 'spider') {
    const abdomen = mk(sp(0.5, 14), steel, 0, 0.9, 0);
    abdomen.scale.set(1, 0.6, 1.2);
    body.add(abdomen);
    const head = mk(sp(0.22, 10), glow('red'), 0, 0.92, 0.65, 0, 0, 0, false);
    body.add(head);
    body.add(mk(cy(0.05, 0.05, 0.35, 6), mat('dark'), 0, 0.9, -0.7, Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1;  // patas a izquierda (+) y derecha (-)
      const yaw = ((i % 4) - 1.5) * 0.55;
      const pivot = grp(0, 0.9, 0);
      pivot.rotation.y = yaw + (side > 0 ? 0 : Math.PI);
      const seg = grp(0.5, 0, 0);
      seg.add(mk(cy(0.06, 0.05, 1.1, 6), mat('dark'), 0.5, 0.2, 0, 0, 0, Math.PI / 2 - 0.35));
      seg.add(mk(cy(0.05, 0.04, 1.0, 6), mat('dark'), 1.05, -0.4, 0, 0, 0, Math.PI / 2 + 0.6));
      pivot.add(seg);
      body.add(pivot);
      anim.legs.push(pivot);
    }
  } else if (type === 'jeep') {
    body.add(mk(bx(1.6, 0.45, 2.2), mat('olive'), 0, 0.55, 0));
    body.add(mk(bx(1.35, 0.55, 1.2), camo, 0, 1.0, -0.2));
    body.add(mk(bx(1.25, 0.42, 0.05), glow('glass', 0.7), 0, 1.02, 0.42, 0, 0, 0, false));
    body.add(mk(cy(0.09, 0.09, 1.0, 6), steel, 0, 1.7, 0.2));
    body.add(mk(bx(0.5, 0.1, 0.1), steel, 0, 1.75, 0.6));
    body.add(mk(bx(0.25, 0.15, 0.2), glow('blue'), -0.4, 1.35, -0.2, 0, 0, 0, false));
    body.add(mk(bx(0.25, 0.15, 0.2), glow('blue'), 0.4, 1.35, -0.2, 0, 0, 0, false));
    for (const [x, z] of [[-0.85, 0.75], [0.85, 0.75], [-0.85, -0.75], [0.85, -0.75]]) {
      const w = grp(x, 0.38, z);
      w.add(mk(cy(0.38, 0.38, 0.3, 10), mat('black'), 0, 0, 0, 0, 0, Math.PI / 2));
      w.add(mk(cy(0.2, 0.2, 0.32, 8), mat('gray'), 0, 0, 0, 0, 0, Math.PI / 2, false));
      body.add(w); anim.wheels.push(w);
    }
  } else if (type === 'tank') {
    body.add(mk(bx(1.8, 0.6, 2.6), camo, 0, 0.7, 0));
    body.add(mk(bx(0.4, 0.5, 2.7), mat('black'), -1.05, 0.4, 0));
    body.add(mk(bx(0.4, 0.5, 2.7), mat('black'), 1.05, 0.4, 0));
    body.add(mk(cy(0.7, 0.8, 0.5, 12), camo, 0, 1.25, -0.2));
    body.add(mk(cy(0.13, 0.13, 1.8, 8), mat('dark'), 0, 1.3, 1.1, Math.PI / 2));
    body.add(mk(bx(0.5, 0.25, 0.6), mat('dark'), 0, 1.0, 1.25));
    body.add(mk(bx(0.9, 0.1, 0.1), glow('orange'), 0, 1.55, -0.5, 0, 0, 0, false));
    body.add(mk(cy(0.09, 0.09, 0.6, 6), steel, 0.5, 1.6, -0.6));
    for (const x of [-0.7, 0.7]) for (let k = 0; k < 4; k++) {
      body.add(mk(cy(0.22, 0.22, 0.4, 8), mat('black'), x * 1.0, 0.4, -1.0 + k * 0.7, 0, 0, Math.PI / 2, false));
    }
  } else if (type === 'truck') {
    body.add(mk(bx(1.8, 1.2, 2.8), mat('tan'), 0, 1.05, 0));
    body.add(mk(bx(1.6, 0.5, 0.05), glow('glass', 0.7), 0, 1.4, 1.42, 0, 0, 0, false));
    body.add(mk(bx(1.7, 0.2, 0.2), mat('dark'), 0, 0.55, 1.45));
    body.add(mk(bx(1.2, 0.18, 0.25), glow('blue'), 0, 1.75, 0.8, 0, 0, 0, false));
    body.add(mk(bx(0.2, 0.2, 0.2), glow('blue'), -0.7, 1.75, 0.8, 0, 0, 0, false));
    body.add(mk(bx(0.2, 0.2, 0.2), glow('blue'), 0.7, 1.75, 0.8, 0, 0, 0, false));
    anim.lights.push(...body.children.filter((c) => c.material && c.material.color && c.material.toneMapped === false));
    for (const [x, z] of [[-0.95, 0.9], [0.95, 0.9], [-0.95, -0.9], [0.95, -0.9]]) {
      const w = grp(x, 0.45, z);
      w.add(mk(cy(0.45, 0.45, 0.35, 10), mat('black'), 0, 0, 0, 0, 0, Math.PI / 2));
      body.add(w); anim.wheels.push(w);
    }
  } else if (type === 'drone') {
    body.add(mk(sp(0.35, 12), steel, 0, 0, 0));
    body.add(mk(sp(0.12, 8), glow('red'), 0, -0.3, 0.1, 0, 0, 0, false));
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const x = Math.cos(a) * 0.9, z = Math.sin(a) * 0.9;
      body.add(mk(bx(Math.abs(Math.cos(a)) * 1.9 + 0.1, 0.06, 0.1), steel, x / 2, 0.05, z / 2, 0, -a, 0));
      const rot = grp(x, 0.18, z);
      rot.add(mk(cy(0.42, 0.42, 0.03, 12), glow('cyan', 0.45), 0, 0, 0, 0, 0, 0, false));
      body.add(rot); anim.rotors.push(rot);
    }
    body.position.y = 0;
  } else if (type === 'heli') {
    const fuselage = mk(sp(0.7, 14), camo, 0, 0.3, 0);
    fuselage.scale.set(1, 0.85, 1.9);
    body.add(fuselage);
    body.add(mk(sp(0.45, 12), glow('glass', 0.8), 0, 0.45, 0.8, 0, 0, 0, false));
    body.add(mk(bx(0.25, 0.25, 1.9), camo, 0, 0.35, -1.6));
    body.add(mk(bx(0.1, 0.6, 0.35), camo, 0, 0.7, -2.5));
    body.add(mk(bx(0.9, 0.08, 0.08), steel, 0, 0.1, 0.2));
    for (const x of [-0.6, 0.6]) {
      body.add(mk(bx(0.08, 0.08, 2.4), steel, x, -0.55, 0.0));
      body.add(mk(bx(0.08, 0.35, 0.08), steel, x, -0.3, 0.6));
      body.add(mk(bx(0.08, 0.35, 0.08), steel, x, -0.3, -0.6));
    }
    const mr = grp(0, 1.0, -0.1);
    mr.add(mk(bx(5.2, 0.04, 0.22), mat('black'), 0, 0, 0));
    mr.add(mk(bx(0.22, 0.04, 4.6), mat('black'), 0, 0, 0));
    body.add(mr); anim.rotors.push(mr);
    const tr = grp(0.12, 0.6, -2.5);
    tr.add(mk(bx(0.04, 0.7, 0.1), mat('black'), 0, 0, 0));
    body.add(tr); anim.rotors.push(tr);
    body.add(mk(bx(0.2, 0.2, 0.2), glow('red'), 0, -0.12, 0.9, 0, 0, 0, false));
  }

  root.userData = { anim, type, body };
  return root;
}

// Modelo de escudo visual alrededor de la base
export function createShieldBubble() {
  const m = new THREE.Mesh(sp(1, 24), new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.16, depthWrite: false }));
  m.material.side = THREE.DoubleSide;
  return m;
}

// =====================================================================
//                              PROPS
// =====================================================================
export function createProp(kind, rnd = Math.random) {
  const g = grp();
  const s = 0.8 + rnd() * 0.5;
  const rot = rnd() * Math.PI * 2;
  g.rotation.y = rot;
  switch (kind) {
    case 'pine': {
      g.add(mk(cy(0.08, 0.12, 0.6, 6), mat('trunk'), 0, 0.3, 0));
      for (let i = 0; i < 3; i++) g.add(mk(cone(0.55 - i * 0.14, 0.9, 8), mat('leaf', { flat: true }), 0, 0.8 + i * 0.45, 0));
      g.scale.setScalar(s * 0.9);
      break;
    }
    case 'broadleaf': {
      g.add(mk(cy(0.1, 0.14, 0.9, 6), mat('trunk'), 0, 0.45, 0));
      g.add(mk(ico(0.6, 0), mat('leaf2', { flat: true }), 0, 1.2, 0));
      g.add(mk(ico(0.45, 0), mat('leaf', { flat: true }), 0.35, 0.95, 0.2));
      g.add(mk(ico(0.4, 0), mat('leaf2', { flat: true }), -0.3, 1.0, -0.2));
      g.scale.setScalar(s * 0.85);
      break;
    }
    case 'palm': {
      const trunk = grp(0, 0, 0);
      trunk.add(mk(cy(0.09, 0.14, 2.0, 6), mat('trunk'), 0.12, 1.0, 0, 0.1, 0, 0.15));
      g.add(trunk);
      for (let i = 0; i < 6; i++) {
        const f = grp(0.25, 2.0, 0);
        f.rotation.y = (i / 6) * Math.PI * 2;
        f.add(mk(bx(1.3, 0.05, 0.3), mat('leaf2'), 0.6, -0.1, 0, 0, 0, -0.4));
        g.add(f);
      }
      g.scale.setScalar(s * 0.8);
      break;
    }
    case 'cactus': {
      g.add(mk(cy(0.18, 0.2, 1.4, 8), mat('cactus'), 0, 0.7, 0));
      g.add(mk(cy(0.1, 0.1, 0.6, 6), mat('cactus'), 0.3, 0.9, 0, 0, 0, Math.PI / 2));
      g.add(mk(cy(0.1, 0.1, 0.5, 6), mat('cactus'), 0.5, 1.15, 0));
      g.add(mk(cy(0.1, 0.1, 0.5, 6), mat('cactus'), -0.25, 0.7, 0.05, 0, 0, -Math.PI / 2));
      g.scale.setScalar(s * 0.9);
      break;
    }
    case 'dune': {
      const d = mk(sp(1.2, 12), mat('sand'), 0, -0.2, 0);
      d.scale.set(1.6, 0.35, 1.0);
      g.add(d);
      g.scale.setScalar(s);
      break;
    }
    case 'rock': {
      const r = mk(dod(0.55 + rnd() * 0.5), mat('rock', { flat: true }), 0, 0.3, 0);
      r.scale.set(1, 0.7 + rnd() * 0.5, 1.1);
      g.add(r);
      g.scale.setScalar(s);
      break;
    }
    case 'snowrock': {
      const r = mk(dod(0.8 + rnd() * 0.4), mat('rock', { flat: true }), 0, 0.6, 0);
      r.scale.set(1.2, 1.2, 1.1);
      g.add(r);
      g.add(mk(ico(0.55, 0), mat('snow'), 0, 1.5, 0));
      g.scale.setScalar(s * 1.1);
      break;
    }
    case 'watch': {
      // Torre de vigilancia con cabina y antena (como en la referencia)
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) g.add(mk(bx(0.18, 2.6, 0.18), mat('steel'), x, 1.3, z));
      g.add(mk(bx(2.0, 0.2, 2.0), mat('dark'), 0, 2.7, 0));
      g.add(mk(bx(1.5, 1.0, 1.5), mat('olive'), 0, 3.3, 0));
      g.add(mk(bx(1.56, 0.25, 1.56), glow('glass', 0.7), 0, 3.4, 0, 0, 0, 0, false));
      g.add(mk(bx(1.7, 0.12, 1.7), mat('dark'), 0, 3.9, 0));
      g.add(mk(cy(0.03, 0.03, 1.2, 5), mat('steel'), 0.5, 4.5, 0.5));
      g.add(mk(sp(0.09, 6), glow('red'), 0.5, 5.1, 0.5, 0, 0, 0, false));
      g.scale.setScalar(s * 0.8);
      break;
    }
    case 'barracks': {
      g.add(mk(bx(3.0, 1.4, 2.0), mat('olive'), 0, 0.7, 0));
      g.add(mk(bx(3.2, 0.25, 2.2), mat('dark'), 0, 1.5, 0));
      g.add(mk(bx(2.4, 0.08, 0.1), glow('orange'), 0, 1.0, 1.02, 0, 0, 0, false));
      g.add(mk(bx(0.4, 0.8, 0.1), mat('dark'), 0, 0.4, 1.05));
      g.add(mk(bx(0.5, 0.5, 0.5), mat('khaki'), 1.2, 0.25, 1.3));
      g.scale.setScalar(s * 0.65);
      break;
    }
    case 'skyscraper': {
      const h = 2.2 + rnd() * 3.2;
      const col = rnd() < 0.5 ? mat('steel') : mat('gray');
      g.add(mk(bx(1.7, h, 1.7), col, 0, h / 2, 0));
      for (let y = 0.6; y < h; y += 0.7) {
        g.add(mk(bx(1.74, 0.06, 1.74), glow(rnd() < 0.5 ? 'cyan' : 'yellow', 0.8), 0, y, 0, 0, 0, 0, false));
      }
      g.add(mk(cy(0.03, 0.03, 0.8, 5), mat('steel'), 0, h + 0.4, 0));
      g.scale.setScalar(s * 0.9);
      break;
    }
    case 'lamp': {
      g.add(mk(cy(0.05, 0.06, 1.8, 6), mat('dark'), 0, 0.9, 0));
      g.add(mk(sp(0.18, 8), glow('yellow'), 0, 1.85, 0, 0, 0, 0, false));
      g.scale.setScalar(s * 0.9);
      break;
    }
    case 'car': {
      g.add(mk(bx(0.9, 0.4, 1.6), mat(rnd() < 0.5 ? 'red' : 'gray'), 0, 0.3, 0));
      g.add(mk(bx(0.8, 0.35, 0.8), mat('dark'), 0, 0.7, -0.1));
      g.add(mk(bx(0.2, 0.1, 0.1), glow('yellow'), -0.25, 0.4, 0.82, 0, 0, 0, false));
      g.add(mk(bx(0.2, 0.1, 0.1), glow('yellow'), 0.25, 0.4, 0.82, 0, 0, 0, false));
      g.scale.setScalar(s * 0.8);
      break;
    }
    default:
      break;
  }
  return g;
}

// Cuartel general de la base (edificio grande con helipuerto, como en la referencia)
export function createHQ() {
  const g = grp();
  g.add(mk(bx(5.0, 1.8, 3.2), mat('gray'), 0, 0.9, 0));
  g.add(mk(bx(5.2, 0.2, 3.4), mat('dark'), 0, 1.9, 0));
  g.add(mk(bx(5.05, 0.18, 0.12), glow('blue'), 0, 1.4, 1.62, 0, 0, 0, false));
  g.add(mk(bx(4.0, 1.0, 2.4), mat('steel'), 0.3, 2.4, 0));
  g.add(mk(bx(4.05, 0.12, 2.45), glow('orange', 0.85), 0.3, 2.6, 0, 0, 0, 0, false));
  g.add(mk(cy(1.7, 1.7, 0.1, 6), mat('dark'), -1.6, 2.4, 0));
  // helipuerto
  const pad = mk(cy(1.1, 1.1, 0.08, 20), mat('dark'), -1.4, 3.0, 0.2);
  g.add(pad);
  g.add(mk(tor(1.1, 0.05, 6, 24), glow('yellow'), -1.4, 3.05, 0.2, Math.PI / 2, 0, 0, false));
  const hMark = new THREE.Group();
  hMark.position.set(-1.4, 3.06, 0.2);
  hMark.add(mk(bx(0.12, 0.02, 1.0), glow('white'), -0.3, 0, 0, 0, 0, 0, false));
  hMark.add(mk(bx(0.12, 0.02, 1.0), glow('white'), 0.3, 0, 0, 0, 0, 0, false));
  hMark.add(mk(bx(0.6, 0.02, 0.12), glow('white'), 0, 0, 0, 0, 0, 0, false));
  g.add(hMark);
  // antena parabolica y mastil
  g.add(mk(cy(0.04, 0.05, 2.6, 6), mat('steel'), 1.9, 3.3, -0.9));
  const dish = mk(cy(0.9, 0.3, 0.2, 14), mat('gray'), 1.9, 4.6, -0.9, 0.6, 0, 0);
  g.add(dish);
  g.add(mk(sp(0.12, 8), glow('red'), 1.9, 5.9, -0.9, 0, 0, 0, false));
  // torres laterales con luz azul
  for (const x of [-2.5, 2.5]) {
    g.add(mk(bx(0.9, 2.6, 0.9), mat('steel'), x, 1.3, 1.4));
    g.add(mk(bx(1.0, 0.25, 1.0), glow('blue'), x, 2.6, 1.4, 0, 0, 0, false));
  }
  const core = mk(sp(0.5, 14), glow('blue'), 0, 4.0, 0, 0, 0, 0, false);
  g.add(core);
  g.userData.core = core;
  return g;
}

// Proyectil de misil
export function createMissile() {
  const g = grp();
  g.add(mk(cy(0.09, 0.09, 0.7, 6), mat('white'), 0, 0, 0, Math.PI / 2));
  g.add(mk(cone(0.09, 0.22, 6), mat('red'), 0, 0, 0.45, Math.PI / 2));
  g.add(mk(sp(0.14, 8), glow('orange'), 0, 0, -0.42, 0, 0, 0, false));
  return g;
}

// Icono de 3D para la UI: renderiza un modelo en un canvas pequeno y devuelve dataURL
export function renderIcons(renderer, objects, size = 128) {
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const scene = new THREE.Scene();
  scene.background = null;
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x3a2a1a, 1.4));
  const d = new THREE.DirectionalLight(0xffffff, 2.2);
  d.position.set(4, 8, 6);
  scene.add(d);
  const rim = new THREE.DirectionalLight(0x44c8ff, 1.2);
  rim.position.set(-6, 3, -4);
  scene.add(rim);
  const prevSize = renderer.getSize(new THREE.Vector2());
  renderer.setSize(size, size, false);
  const out = {};
  for (const key of Object.keys(objects)) {
    const obj = objects[key];
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const r = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.2;
    cam.position.set(c.x + r * 1.1, c.y + r * 0.85, c.z + r * 1.4);
    cam.lookAt(c);
    renderer.render(scene, cam);
    out[key] = renderer.domElement.toDataURL('image/png');
    scene.remove(obj);
  }
  renderer.setSize(prevSize.x, prevSize.y, false);
  return out;
}
