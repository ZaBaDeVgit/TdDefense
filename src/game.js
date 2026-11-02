// Logica del juego y construccion del mundo 3D a partir de los mapas.
import * as THREE from 'three';
import { parseScenario } from './maps.js';
import { createTower, createEnemy, createProp, createHQ, createMissile, createShieldBubble, TOWER_INFO, ENEMY_INFO, glow, mat } from './models.js';
import { sfx } from './audio.js';

export const TILE = 2;
export const MAX_WAVE = 15;
export const START_LIVES = 100;
export const START_GOLD = 850;
export const SKILL_CD = { misil: 22, radar: 28, nuke: 110, shield: 45, heal: 40 };
const AIR_Y = 3.6;
const UPGRADE_COST = [200, 350];

// Estadisticas base de las torres
export const TOWER_STATS = {
  mg: { dmg: 9, rate: 0.13, range: 6.5, ground: true, air: false },
  missile: { dmg: 70, rate: 1.7, range: 8.5, splash: 1.9, ground: true, air: false },
  laser: { dmg: 34, rate: 0.55, range: 9.5, ground: true, air: true },
  aa: { dmg: 48, rate: 0.9, range: 10.5, splash: 1.1, ground: false, air: true },
  tesla: { dmg: 26, rate: 1.0, range: 6.0, ground: true, air: true, chain: 3 },
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Composicion de cada oleada (1..15)
export function buildWave(n) {
  const groups = [];
  groups.push({ type: 'soldier', count: 6 + n * 2, gap: Math.max(0.45, 0.9 - n * 0.02), start: 0 });
  if (n >= 2) groups.push({ type: 'shield', count: 1 + Math.floor(n / 2), gap: 1.6, start: 3 });
  if (n >= 3 && n % 2 === 1) groups.push({ type: 'jeep', count: 1 + Math.floor(n / 3), gap: 2.2, start: 5 });
  if (n >= 4) groups.push({ type: 'spider', count: 2 + Math.floor(n / 2), gap: 1.2, start: 8 });
  if (n >= 5 && n % 3 === 2) groups.push({ type: 'drone', count: 2 + Math.floor(n / 4), gap: 2.4, start: 6 });
  if (n >= 6 && n % 2 === 0) groups.push({ type: 'tank', count: 1 + Math.floor((n - 4) / 4), gap: 7, start: 10 });
  if (n >= 7 && n % 2 === 1) groups.push({ type: 'truck', count: 1 + Math.floor(n / 6), gap: 4, start: 12 });
  if (n >= 9 && n % 2 === 0) groups.push({ type: 'heli', count: 1 + Math.floor(n / 8), gap: 8, start: 9 });
  if (n === 5) groups.push({ type: 'truck', boss: true, count: 1, gap: 0, start: 16 });
  if (n === 10) groups.push({ type: 'heli', boss: true, count: 1, gap: 0, start: 14 });
  if (n === 15) groups.push({ type: 'tank', boss: true, count: 1, gap: 0, start: 18 });
  const ev = [];
  for (const g of groups) for (let i = 0; i < g.count; i++) ev.push({ t: g.start + i * g.gap, type: g.type, boss: !!g.boss });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

function removeObj(o) { if (o && o.parent) o.parent.remove(o); }

export class Game {
  constructor({ scene, camera, renderer, effects, hooks = {} }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.fx = effects;
    this.hooks = hooks;
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.barGroup = new THREE.Group();
    this.scene.add(this.barGroup);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x333344, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.bgCache = new Map();
    this.quality = 'high';
    this.reset();
  }

  reset() {
    this.towers = [];
    this.towerAt = new Map();
    this.enemies = [];
    this.projectiles = [];
    this.strikes = [];
    this.radarZones = [];
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.wave = 0;
    this.waveActive = false;
    this.events = [];
    this.evIdx = 0;
    this.waveTime = 0;
    this.paused = false;
    this.speed = 1;
    this.buildType = null;
    this.skillMode = null;
    this.selected = null;
    this.over = false;
    this.skillCd = { misil: 0, radar: 0, nuke: 0, shield: 0, heal: 0 };
    this.baseShieldT = 0;
    this.kills = 0;
    this.time = 0;
    this.hover = null;
    this.showRanges = false;
    this.sellMode = false;
  }

  // ---------- Escenario ----------
  clearWorld() {
    for (const c of [...this.world.children]) this.world.remove(c);
    for (const c of [...this.barGroup.children]) this.barGroup.remove(c);
    for (const e of this.enemies) removeObj(e.root);
    for (const t of this.towers) { removeObj(t.model); removeObj(t.ring); }
    for (const p of this.projectiles) removeObj(p.mesh);
    if (this.hoverMesh) removeObj(this.hoverMesh);
    if (this.previewRing) removeObj(this.previewRing);
    if (this.spawnBeam) removeObj(this.spawnBeam);
    for (const z of this.radarZones || []) removeObj(z.ring);
    if (this.bubble) removeObj(this.bubble);
    this.fx.clear();
    this.waterMeshes = [];
    this.tileProps = new Map();
  }

  loadScenario(sc, { demo = false } = {}) {
    this.clearWorld();
    this.reset();
    this.sc = sc;
    this.demo = demo;
    this.L = parseScenario(sc);
    this.buildWorld(sc, this.L);
    this.applyTheme(sc);
    this.hoverMesh = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.96, TILE * 0.96),
      new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.35, depthWrite: false }));
    this.hoverMesh.rotation.x = -Math.PI / 2;
    this.hoverMesh.position.y = 0.06;
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);
    this.previewRing = this.makeRing(6, 0x44ff99, 0.8);
    this.previewRing.visible = false;
    this.scene.add(this.previewRing);
  }

  tileCenter(c, r) {
    return new THREE.Vector3(this.ox + (c + 0.5) * TILE, 0, this.oz + (r + 0.5) * TILE);
  }
  worldToTile(x, z) {
    return { c: Math.floor((x - this.ox) / TILE), r: Math.floor((z - this.oz) / TILE) };
  }
  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.L.W && r < this.L.H; }

  buildWorld(sc, L) {
    const th = sc.theme;
    const rnd = rng(sc.id.split('').reduce((a, ch) => a + ch.charCodeAt(0) * 31, 7));
    this.rnd = rnd;
    this.ox = -(L.W * TILE) / 2;
    this.oz = -(L.H * TILE) / 2;
    const { W, H } = L;

    // Terreno en una sola malla con colores por vertice
    const pos = [], col = [], idx = [];
    const gcol = th.ground.map((h) => new THREE.Color(h));
    const roadC = new THREE.Color(th.road);
    const shore = new THREE.Color(0x6a5a3a);
    let vi = 0;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const ch = L.tiles[r][c];
      const x0 = this.ox + c * TILE, z0 = this.oz + r * TILE;
      const onRoad = 'PSB'.includes(ch);
      let base = gcol[Math.floor(rnd() * gcol.length)].clone();
      if (ch === '~') base = shore.clone();
      if (onRoad) base = roadC.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.04);
      if (ch === '#') base = base.multiplyScalar(0.85);
      const y = onRoad ? 0.03 : 0;
      const quad = [[x0, z0], [x0 + TILE, z0], [x0 + TILE, z0 + TILE], [x0, z0 + TILE]];
      for (const [x, z] of quad) {
        pos.push(x, y, z);
        col.push(base.r, base.g, base.b);
      }
      idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
      vi += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    terrain.receiveShadow = true;
    this.world.add(terrain);

    // Suelo exterior
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: gcol[0], roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.2;
    outer.receiveShadow = true;
    this.world.add(outer);

    // Agua
    const waterMat = new THREE.MeshStandardMaterial({ color: th.water, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 });
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (L.tiles[r][c] !== '~') continue;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE), waterMat);
      w.rotation.x = -Math.PI / 2;
      const p = this.tileCenter(c, r);
      w.position.set(p.x, -0.12, p.z);
      this.world.add(w);
      this.waterMeshes.push(w);
    }

    // Marcas de carretera (lineas centrales)
    const dashMat = glow('yellow', 0.55);
    L.path.forEach((p, i) => {
      if (L.tiles[p.r][p.c] !== 'P' || i % 2 === 0) return;
      const pc = this.tileCenter(p.c, p.r);
      const prev = L.path[i - 1];
      const horizontal = prev.r === p.r;
      const dash = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 0.8 : 0.12, 0.02, horizontal ? 0.12 : 0.8), dashMat);
      dash.position.set(pc.x, 0.06, pc.z);
      this.world.add(dash);
    });

    // Decoracion
    const groundDeco = ['pine', 'broadleaf', 'palm', 'cactus', 'dune', 'rock', 'snowrock', 'lamp', 'car'].filter((k) => th.deco.includes(k));
    const blockDeco = th.deco.includes('skyscraper') ? ['skyscraper'] : th.deco.includes('snowrock') ? ['snowrock', 'rock'] : th.deco.includes('dune') ? ['rock', 'dune'] : ['rock', 'barracks'];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const ch = L.tiles[r][c];
      const p = this.tileCenter(c, r);
      let kind = null;
      if (ch === '.' && groundDeco.length && rnd() < 0.2) {
        kind = groundDeco[Math.floor(rnd() * groundDeco.length)];
        if (kind === 'rock' && rnd() < 0.5) kind = 'pine';
        if (th.deco.includes('skyscraper') && (kind === 'pine' || kind === 'broadleaf')) kind = 'lamp';
      } else if (ch === '#') {
        kind = blockDeco[Math.floor(rnd() * blockDeco.length)];
        if (th.deco.includes('skyscraper') && rnd() < 0.2) kind = 'car';
      }
      if (!kind) continue;
      const prop = createProp(kind, rnd);
      prop.position.set(p.x + (rnd() - 0.5) * 0.6, 0, p.z + (rnd() - 0.5) * 0.6);
      this.world.add(prop);
      this.tileProps.set(c + ',' + r, prop);
    }

    // Base (cuartel general)
    const bp = this.tileCenter(L.base.c, L.base.r);
    const hq = createHQ();
    hq.position.set(bp.x + 0.5, 0, bp.z);
    hq.scale.setScalar(0.85);
    hq.rotation.y = -Math.PI / 2;
    this.world.add(hq);
    this.hq = hq;
    this.basePos = new THREE.Vector3(bp.x, 0, bp.z);
    this.bubble = createShieldBubble();
    this.bubble.position.copy(this.basePos).setY(1.5);
    this.bubble.scale.setScalar(4.5);
    this.bubble.visible = false;
    this.scene.add(this.bubble);

    // Portal de entrada enemigo
    const sp = this.tileCenter(L.spawn.c, L.spawn.r);
    this.spawnPos = new THREE.Vector3(sp.x, 0, sp.z);
    this.spawnBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.spawnBeam.position.set(sp.x, 3, sp.z);
    this.scene.add(this.spawnBeam);
    const sring = this.makeRing(1.4, 0xff3b30, 0.9);
    sring.position.set(sp.x, 0.08, sp.z);
    sring.visible = true;
    this.world.add(sring);
    this.spawnRing = sring;

    // Ruta en mundo
    this.pathPts = L.path.map((p) => this.tileCenter(p.c, p.r));
    this.pathPts[this.pathPts.length - 1] = this.basePos.clone();

    // Ocupacion de torres
    this.towerAt = new Map();
  }

  makeRing(radius, color, opacity = 0.7) {
    const m = new THREE.Mesh(new THREE.RingGeometry(radius * 0.97, radius, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.09;
    return m;
  }

  applyTheme(sc) {
    const th = sc.theme;
    this.scene.fog = new THREE.Fog(th.fog, 60, 160);
    this.hemi.color.set(th.hemi);
    this.hemi.intensity = 1.1;
    this.sun.color.set(th.sun);
    this.sun.intensity = th.sunIntensity;
    const L = this.L;
    const span = Math.max(L.W, L.H) * TILE;
    this.sun.position.set(-span * 0.5, span * 0.9, span * 0.35);
    this.sun.target.position.set(0, 0, 0);
    const sc2 = this.sun.shadow.camera;
    sc2.left = -span * 0.8; sc2.right = span * 0.8; sc2.top = span * 0.8; sc2.bottom = -span * 0.8;
    sc2.near = 1; sc2.far = span * 3;
    sc2.updateProjectionMatrix();
    this.scene.background = this.skyTexture(sc.id, th.skyTop, th.skyBottom);
  }

  skyTexture(id, top, bottom) {
    if (this.bgCache.has(id)) return this.bgCache.get(id);
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 512;
    const ctx = cv.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, top);
    grd.addColorStop(0.62, bottom);
    grd.addColorStop(1, bottom);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.bgCache.set(id, tex);
    return tex;
  }

  // ---------- Torres ----------
  canBuild(c, r) {
    if (!this.inBounds(c, r)) return false;
    if (this.L.tiles[r][c] !== '.') return false;
    return !this.towerAt.has(c + ',' + r);
  }

  towerStats(t) {
    const b = TOWER_STATS[t.type];
    const L = t.level - 1;
    return { ...b, dmg: b.dmg * (1 + 0.45 * L), rate: b.rate / (1 + 0.25 * L), range: b.range + 0.6 * L, splash: b.splash ? b.splash * (1 + 0.15 * L) : undefined };
  }

  placeTower(type, c, r) {
    const info = TOWER_INFO[type];
    if (!this.canBuild(c, r)) { this.msg('Casilla no válida'); sfx('error'); return false; }
    if (this.gold < info.cost) { this.msg('Oro insuficiente'); sfx('error'); return false; }
    this.gold -= info.cost;
    const p = this.tileCenter(c, r);
    const model = createTower(type, 1);
    model.position.copy(p);
    this.world.add(model);
    const ring = this.makeRing(TOWER_STATS[type].range, 0x44ff99, 0.5);
    ring.position.set(p.x, 0.1, p.z);
    ring.visible = false;
    this.scene.add(ring);
    const t = { type, level: 1, c, r, pos: p, model, turret: model.userData.turret, cd: 0, spent: info.cost, ring, firing: 0 };
    this.towers.push(t);
    this.towerAt.set(c + ',' + r, t);
    const prop = this.tileProps.get(c + ',' + r);
    if (prop) { removeObj(prop); this.tileProps.delete(c + ',' + r); }
    this.fx.emitSmoke(p.clone().setY(0.5), 8, 1.2, 1.4);
    this.fx.flash(p.clone().setY(1), 2.2, 0xffb050, 0.25);
    this.fx.ring(p, 2.6, 0x44ddff, 0.4);
    sfx('build');
    this.selected = t;
    return true;
  }

  sellTower(t) {
    const refund = Math.floor(t.spent * 0.6);
    this.gold += refund;
    removeObj(t.model);
    removeObj(t.ring);
    this.towers = this.towers.filter((x) => x !== t);
    this.towerAt.delete(t.c + ',' + t.r);
    this.fx.explosion(t.pos.clone().setY(1), 0.8);
    this.fx.floatText(t.pos.clone().setY(3), `+$${refund}`, 'gold');
    if (this.selected === t) this.selected = null;
    sfx('sell');
  }

  upgradeTower(t) {
    if (t.level >= 3) { this.msg('Nivel máximo alcanzado'); return; }
    const cost = UPGRADE_COST[t.level - 1];
    if (this.gold < cost) { this.msg('Oro insuficiente para mejorar'); sfx('error'); return; }
    this.gold -= cost;
    t.spent += cost;
    t.level++;
    const oldRot = t.turret.rotation.y;
    removeObj(t.model);
    const model = createTower(t.type, t.level);
    model.position.copy(t.pos);
    model.userData.turret.rotation.y = oldRot;
    this.world.add(model);
    t.model = model;
    t.turret = model.userData.turret;
    t.ring.geometry.dispose();
    removeObj(t.ring);
    const ring = this.makeRing(this.towerStats(t).range, 0x44ff99, 0.5);
    ring.position.set(t.pos.x, 0.1, t.pos.z);
    ring.visible = this.showRanges || this.selected === t;
    this.scene.add(ring);
    t.ring = ring;
    this.fx.flash(t.pos.clone().setY(1.5), 3, 0xffe080, 0.3);
    this.fx.emitSparks(t.pos.clone().setY(1.5), 24, 0xffe080, 5, 0.6);
    this.fx.floatText(t.pos.clone().setY(3), `NIVEL ${t.level}`, 'gold');
    sfx('upgrade');
  }

  // ---------- Oleadas ----------
  startWave() {
    if (this.over || this.waveActive || this.wave >= MAX_WAVE) return false;
    this.wave++;
    this.waveActive = true;
    this.events = buildWave(this.wave);
    this.evIdx = 0;
    this.waveTime = 0;
    this.msg(`Oleada ${this.wave} iniciada`);
    sfx('wave');
    return true;
  }

  endWave() {
    this.waveActive = false;
    const bonus = 60 + this.wave * 12;
    this.gold += bonus;
    this.fx.floatText(this.basePos.clone().setY(5), `+$${bonus} oleada`, 'gold');
    this.msg(`Oleada ${this.wave} superada (+$${bonus})`);
    if (this.wave >= MAX_WAVE) this.win();
  }

  spawnEnemy(type, boss = false) {
    const info = ENEMY_INFO[type];
    const root = createEnemy(type);
    if (boss) root.scale.setScalar(1.7);
    const mult = 1 + (this.wave - 1) * 0.12;
    const hp = info.hp * mult * (boss ? 4 : 1);
    const air = !!info.air;
    const pos = this.spawnPos.clone();
    pos.y = air ? AIR_Y : 0;
    root.position.copy(pos);
    this.world.add(root);
    const bar = this.makeBar(boss);
    this.barGroup.add(bar);
    const e = {
      type, info, root, bar, air, boss, hp, maxHp: hp, armor: info.armor,
      speed: info.speed * (boss ? 0.8 : 1), dmg: boss ? 15 : info.dmg, reward: boss ? 150 : info.reward,
      idx: 1, dist: 0, pos, dead: false, slowT: 0, offX: (this.rnd() - 0.5) * 1.1, offZ: (this.rnd() - 0.5) * 1.1,
      heading: 0, t: this.rnd() * 6,
    };
    this.enemies.push(e);
    return e;
  }

  makeBar(boss) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: boss ? 0xff3b30 : 0x6dff6a, depthWrite: false }));
    fg.position.z = 0.01;
    g.add(bg, fg);
    g.userData.fg = fg;
    g.userData.bg = bg;
    g.visible = false;
    g.scale.setScalar(boss ? 2 : 1);
    return g;
  }

  // ---------- Dano ----------
  damage(e, amount) {
    if (e.dead) return;
    const d = amount * (1 - e.armor);
    e.hp -= d;
    if (e.hp <= 0) this.kill(e);
  }

  areaDamage(center, radius, amount, { air = true, ground = true } = {}) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.air ? !air : !ground) continue;
      const dx = e.pos.x - center.x, dz = e.pos.z - center.z;
      if (dx * dx + dz * dz <= radius * radius) this.damage(e, amount);
    }
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    this.gold += e.reward;
    this.kills++;
    const p = e.pos.clone().setY(e.air ? AIR_Y : 1);
    this.fx.explosion(p, e.boss ? 3.2 : 0.9, e.air ? 0x7fe9ff : 0xff8a1a);
    this.fx.floatText(p.clone().setY(p.y + 1.5), `+$${e.reward}`, 'gold');
    sfx('boom');
  }

  reachBase(e) {
    e.dead = true;
    const bp = this.basePos.clone().setY(1.5);
    if (this.baseShieldT > 0) {
      this.fx.floatText(bp.clone().setY(4), 'BLOQUEADO', 'shield');
      this.fx.ring(bp.clone().setY(0.2), 5, 0x4fd8ff, 0.5);
      sfx('zap');
      return;
    }
    this.lives -= e.dmg;
    this.fx.explosion(bp, 1.1);
    this.fx.screenFlash();
    this.fx.floatText(bp.clone().setY(5), `-${e.dmg} VIDA`, 'hurt');
    sfx('hurt');
    if (this.lives <= 0) { this.lives = 0; this.lose(); }
  }

  // ---------- Habilidades ----------
  useSkill(name) {
    if (this.over) return;
    if (this.skillCd[name] > 0) { this.msg(`Habilidad en enfriamiento (${Math.ceil(this.skillCd[name])}s)`); sfx('error'); return; }
    if (name === 'misil' || name === 'radar') {
      this.skillMode = this.skillMode === name ? null : name;
      this.buildType = null;
      this.msg(this.skillMode ? 'Haz clic en el objetivo (Esc cancela)' : 'Habilidad cancelada');
      return;
    }
    if (name === 'nuke') {
      this.skillCd.nuke = SKILL_CD.nuke;
      this.fx.ring(this.basePos.clone().setY(0.2), 34, 0xff3b30, 1.2);
      this.fx.ring(this.basePos.clone().setY(0.2), 20, 0xffe060, 0.9);
      this.fx.flash(this.basePos.clone().setY(3), 12, 0xffffff, 0.5);
      for (let i = 0; i < 12; i++) {
        const p = this.basePos.clone().add(new THREE.Vector3((this.rnd() - 0.5) * 30, 0, (this.rnd() - 0.5) * 30));
        this.fx.explosion(p, 2.4);
      }
      this.fx.emitSmoke(this.basePos.clone().setY(4), 40, 3, 3, 0xbbbbbb);
      this.fx.screenFlash('rgba(255,255,255,.85)', 1200);
      for (const e of this.enemies) if (!e.dead) this.damage(e, 260);
      sfx('nuke');
      this.msg('¡Ataque nuclear!');
    } else if (name === 'shield') {
      this.skillCd.shield = SKILL_CD.shield;
      this.baseShieldT = 10;
      this.msg('Escudo de base activo (10s)');
      sfx('skill');
    } else if (name === 'heal') {
      this.skillCd.heal = SKILL_CD.heal;
      this.lives = Math.min(START_LIVES, this.lives + 25);
      this.fx.floatText(this.basePos.clone().setY(5), '+25 VIDA', 'heal');
      this.fx.emitSparks(this.basePos.clone().setY(2), 40, 0x7dff7a, 4, 1.0, 2);
      this.msg('Botiquín: +25 vida');
      sfx('skill');
    }
  }

  castSkillAt(p) {
    const name = this.skillMode;
    if (!name) return;
    this.skillMode = null;
    if (name === 'misil') {
      this.skillCd.misil = SKILL_CD.misil;
      for (let i = 0; i < 6; i++) {
        const a = this.rnd() * Math.PI * 2, d = this.rnd() * 2.4;
        this.strikes.push({ t: i * 0.16, aim: new THREE.Vector3(p.x + Math.cos(a) * d, 0, p.z + Math.sin(a) * d), dmg: 140, splash: 2.6 });
      }
      this.msg('Bombardeo de misiles');
      sfx('skill');
    } else if (name === 'radar') {
      this.skillCd.radar = SKILL_CD.radar;
      const ring = this.makeRing(7.5, 0x4fd8ff, 0.9);
      ring.position.set(p.x, 0.12, p.z);
      this.scene.add(ring);
      this.radarZones.push({ pos: p.clone(), r: 7.5, t: 8, ring });
      this.fx.ring(p, 7.5, 0x4fd8ff, 0.8);
      this.msg('Radar: enemigos ralentizados');
      sfx('skill');
    }
  }

  // ---------- Entrada ----------
  hoverTile(c, r) {
    this.hover = this.inBounds(c, r) ? { c, r } : null;
    if (!this.hover) { this.hoverMesh.visible = false; this.previewRing.visible = false; return; }
    const p = this.tileCenter(c, r);
    this.hoverMesh.visible = true;
    this.hoverMesh.position.set(p.x, 0.06, p.z);
    if (this.buildType) {
      const ok = this.canBuild(c, r) && this.gold >= TOWER_INFO[this.buildType].cost;
      this.hoverMesh.material.color.set(ok ? 0x33ff88 : 0xff4040);
      this.previewRing.visible = true;
      this.previewRing.geometry.dispose();
      this.previewRing.geometry = new THREE.RingGeometry(TOWER_STATS[this.buildType].range * 0.97, TOWER_STATS[this.buildType].range, 64);
      this.previewRing.position.set(p.x, 0.1, p.z);
    } else if (this.skillMode) {
      this.hoverMesh.material.color.set(0x4fd8ff);
      this.previewRing.visible = true;
      this.previewRing.geometry.dispose();
      const rad = this.skillMode === 'misil' ? 2.6 : 7.5;
      this.previewRing.geometry = new THREE.RingGeometry(rad * 0.97, rad, 48);
      this.previewRing.position.set(p.x, 0.1, p.z);
    } else {
      this.hoverMesh.material.color.set(this.sellMode ? 0xff9040 : 0x33ff88);
      this.hoverMesh.material.opacity = this.towerAt.has(c + ',' + r) ? 0.45 : 0.18;
      this.previewRing.visible = false;
    }
  }

  clickTile(c, r) {
    if (!this.inBounds(c, r) || this.over) return;
    const p = this.tileCenter(c, r);
    if (this.skillMode) { this.castSkillAt(p); return; }
    const t = this.towerAt.get(c + ',' + r);
    if (this.sellMode) {
      if (t) this.sellTower(t); else this.msg('Selecciona una torre para vender');
      return;
    }
    if (this.buildType) {
      this.placeTower(this.buildType, c, r);
      return;
    }
    this.selected = t || null;
    if (t) sfx('click');
    this.updateRangeRings();
  }

  updateRangeRings() {
    for (const t of this.towers) t.ring.visible = this.showRanges || this.selected === t;
  }

  msg(text) { if (this.hooks.onMessage) this.hooks.onMessage(text); }
  win() { this.over = true; sfx('win'); if (this.hooks.onWin) this.hooks.onWin(this.stats()); }
  lose() { this.over = true; sfx('lose'); if (this.hooks.onLose) this.hooks.onLose(this.stats()); }
  stats() { return { wave: this.wave, kills: this.kills, gold: this.gold, lives: this.lives }; }

  // ---------- Actualizacion ----------
  update(dt) {
    if (!this.sc) return;
    this.time += dt;
    this.updateVisuals(dt);
    if (this.demo || this.paused || this.over) return;

    for (const k in this.skillCd) if (this.skillCd[k] > 0) this.skillCd[k] = Math.max(0, this.skillCd[k] - dt);
    this.baseShieldT = Math.max(0, this.baseShieldT - dt);

    if (this.waveActive) {
      this.waveTime += dt;
      while (this.evIdx < this.events.length && this.events[this.evIdx].t <= this.waveTime) {
        const ev = this.events[this.evIdx++];
        this.spawnEnemy(ev.type, ev.boss);
      }
      if (this.evIdx >= this.events.length && this.enemies.every((e) => e.dead)) this.endWave();
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateRadar(dt);
    this.enemies = this.enemies.filter((e) => {
      if (!e.dead) return true;
      removeObj(e.root); removeObj(e.bar);
      return false;
    });
    if (this.lives <= 0 && !this.over) this.lose();
  }

  updateEnemies(dt) {
    const ptsLen = this.pathPts.length;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt;
      const slow = e.slowT > 0 ? 0.5 : 1;
      e.slowT = Math.max(0, e.slowT - dt);
      if (e.air) {
        const tx = this.basePos.x, tz = this.basePos.z;
        const dx = tx - e.pos.x, dz = tz - e.pos.z;
        const d = Math.hypot(dx, dz);
        const step = e.speed * slow * dt;
        if (d <= 2.0) { this.reachBase(e); continue; }
        e.pos.x += (dx / d) * Math.min(step, d);
        e.pos.z += (dz / d) * Math.min(step, d);
        e.dist += step;
        e.heading = Math.atan2(dx, dz);
        e.root.position.set(e.pos.x, AIR_Y + Math.sin(e.t * 3) * 0.15, e.pos.z);
      } else {
        let remain = e.speed * slow * dt;
        while (remain > 0 && e.idx < ptsLen && !e.dead) {
          const last = e.idx === ptsLen - 1;
          const base = this.pathPts[e.idx];
          const tx = base.x + (last ? 0 : e.offX), tz = base.z + (last ? 0 : e.offZ);
          const dx = tx - e.pos.x, dz = tz - e.pos.z;
          const d = Math.hypot(dx, dz);
          if (d <= remain) {
            e.pos.set(tx, 0, tz);
            remain -= d;
            e.dist += d;
            e.idx++;
          } else {
            e.pos.x += (dx / d) * remain;
            e.pos.z += (dz / d) * remain;
            e.dist += remain;
            e.heading = Math.atan2(dx, dz);
            remain = 0;
          }
        }
        if (e.idx >= ptsLen && !e.dead) { this.reachBase(e); continue; }
        e.root.position.set(e.pos.x, 0, e.pos.z);
      }
      // Rotacion suave hacia el heading
      let diff = e.heading - e.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      e.root.rotation.y += diff * Math.min(1, dt * 10);
      this.animateEnemy(e, dt);
    }
  }

  animateEnemy(e, dt) {
    const a = e.root.userData.anim;
    const sp = e.speed * 6;
    if (a.legs.length && (e.type === 'soldier' || e.type === 'shield')) {
      a.legs[0].rotation.x = Math.sin(e.t * sp) * 0.6;
      a.legs[1].rotation.x = -Math.sin(e.t * sp) * 0.6;
    } else if (e.type === 'spider') {
      a.legs.forEach((p, i) => { p.position.y = 0.9 + Math.sin(e.t * 14 + i * 0.8) * 0.06; });
      e.root.userData.body.position.y = Math.sin(e.t * 14) * 0.04;
    }
    for (const w of a.wheels) w.rotation.x += dt * e.speed * 3;
    for (const r of a.rotors) r.rotation.y += dt * 25;
    // Vibracion sutil de tanques/camiones
    if (e.type === 'tank' || e.type === 'truck') e.root.userData.body.position.y = Math.sin(e.t * 10) * 0.02;
    // barra de vida
    const show = e.hp < e.maxHp;
    e.bar.visible = show;
    if (show) {
      const frac = Math.max(0, e.hp / e.maxHp);
      e.bar.userData.fg.scale.x = Math.max(0.001, frac);
      e.bar.userData.fg.position.x = -0.6 * (1 - frac);
    }
    e.bar.position.set(e.pos.x, (e.air ? AIR_Y : 0) + (e.boss ? 3.0 : 2.1), e.pos.z);
    e.bar.quaternion.copy(this.camera.quaternion);
  }

  updateTowers(dt) {
    for (const t of this.towers) {
      const st = this.towerStats(t);
      const sp = t.model.userData.spin || [];
      if (t.type === 'mg') { if (sp[0]) sp[0].rotation.z += dt * (t.firing > 0 ? 35 : 3); }
      else for (const s of sp) s.rotation.y += dt * (t.type === 'aa' ? 2.5 : 1.2);
      if (t.firing > 0) t.firing -= dt;
      t.cd -= dt;
      if (t.cd > 0) continue;
      const target = this.findTarget(t, st);
      if (!target) continue;
      t.turret.rotation.y = Math.atan2(target.pos.x - t.pos.x, target.pos.z - t.pos.z);
      t.cd = st.rate;
      this.fire(t, st, target);
    }
  }

  findTarget(t, st) {
    let best = null, bestD = -1;
    const r2 = st.range * st.range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.air ? !st.air : !st.ground) continue;
      const dx = e.pos.x - t.pos.x, dz = e.pos.z - t.pos.z;
      if (dx * dx + dz * dz > r2) continue;
      if (e.dist > bestD) { bestD = e.dist; best = e; }
    }
    return best;
  }

  muzzleWorld(t) {
    const v = new THREE.Vector3();
    t.model.userData.muzzle.getWorldPosition(v);
    return v;
  }

  fire(t, st, target) {
    const from = this.muzzleWorld(t);
    const tp = target.pos.clone().setY(target.air ? AIR_Y : 0.8);
    switch (t.type) {
      case 'mg':
        this.fx.beam(from, tp, 0xffc070, 0.05, 0.035);
        this.fx.emitSparks(tp, 3, 0xffb050, 2.5, 0.25, -6);
        this.damage(target, st.dmg);
        t.firing = 0.3;
        sfx('shoot');
        break;
      case 'laser': {
        this.fx.beam(from, tp, 0x55d8ff, 0.2, 0.09);
        this.fx.beam(from, tp, 0xffffff, 0.12, 0.03);
        this.fx.emitSparks(tp, 8, 0x55d8ff, 4, 0.35, -3);
        this.damage(target, st.dmg);
        // Perfora: tambien impacta al enemigo mas cercano detras del objetivo
        let second = null, sd = 3.5;
        for (const e of this.enemies) {
          if (e.dead || e === target || e.air !== target.air) continue;
          const d = Math.hypot(e.pos.x - target.pos.x, e.pos.z - target.pos.z);
          if (d < sd) { sd = d; second = e; }
        }
        if (second) { this.fx.beam(tp, second.pos.clone().setY(target.air ? AIR_Y : 0.8), 0x55d8ff, 0.15, 0.05); this.damage(second, st.dmg * 0.6); }
        sfx('laser');
        break;
      }
      case 'aa':
        this.fx.beam(from, tp, 0xffd166, 0.08, 0.05);
        this.fx.flash(tp, 1.1, 0xffd166, 0.12);
        this.fx.emitSparks(tp, 10, 0xffd166, 4, 0.4);
        this.areaDamage(tp, st.splash, st.dmg, { air: true, ground: false });
        sfx('flak');
        break;
      case 'missile': {
        const mesh = createMissile();
        mesh.position.copy(from);
        this.scene.add(mesh);
        this.projectiles.push({ mesh, pos: from.clone(), target, aim: tp.clone(), speed: 15, dmg: st.dmg, splash: st.splash });
        sfx('missile');
        break;
      }
      case 'tesla': {
        const hits = [target];
        let cur = target;
        for (let k = 1; k < st.chain; k++) {
          let next = null, nd = 3.6;
          for (const e of this.enemies) {
            if (e.dead || hits.includes(e) || (e.air && !st.air)) continue;
            const d = Math.hypot(e.pos.x - cur.pos.x, e.pos.z - cur.pos.z);
            if (d < nd) { nd = d; next = e; }
          }
          if (!next) break;
          hits.push(next);
          cur = next;
        }
        let prev = from;
        hits.forEach((e, k) => {
          const ep = e.pos.clone().setY(e.air ? AIR_Y : 1);
          this.fx.arc(prev, ep, 0x7fe9ff, 0.2);
          this.damage(e, st.dmg * (1 - 0.12 * k));
          prev = ep;
        });
        const orb = t.model.userData.orb;
        if (orb) orb.scale.setScalar(1.5);
        sfx('zap');
        break;
      }
      default: break;
    }
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.target && !p.target.dead) p.aim.set(p.target.pos.x, p.target.air ? AIR_Y : 0.8, p.target.pos.z);
      const d = p.aim.clone().sub(p.pos);
      const len = d.length();
      const step = p.speed * dt;
      if (len <= step + 0.3) {
        p.pos.copy(p.aim);
        p.done = true;
        this.fx.explosion(p.pos, 1.3);
        this.fx.emitSmoke(p.pos, 6, 2, 1.5);
        this.areaDamage(new THREE.Vector3(p.pos.x, 0, p.pos.z), p.splash, p.dmg, { air: false, ground: true });
        sfx('boom');
      } else {
        p.pos.addScaledVector(d, step / len);
        p.mesh.position.copy(p.pos);
        p.mesh.lookAt(p.aim);
        this.fx.emitSmoke(p.pos, 1, 0.4, 0.9);
      }
      p.mesh.position.copy(p.pos);
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.done) { removeObj(p.mesh); return false; }
      return true;
    });
  }

  updateStrikes(dt) {
    for (const s of this.strikes) s.t -= dt;
    const ready = this.strikes.filter((s) => s.t <= 0);
    this.strikes = this.strikes.filter((s) => s.t > 0);
    for (const s of ready) {
      // Misil que cae desde el cielo al punto objetivo
      const mesh = createMissile();
      const start = new THREE.Vector3(s.aim.x + (this.rnd() - 0.5) * 3, 26, s.aim.z + (this.rnd() - 0.5) * 3);
      mesh.position.copy(start);
      this.scene.add(mesh);
      this.projectiles.push({ mesh, pos: start, target: null, aim: s.aim.clone().setY(0.5), speed: 40, dmg: s.dmg, splash: s.splash });
      sfx('missile');
    }
  }

  updateRadar(dt) {
    for (const z of this.radarZones) {
      z.t -= dt;
      z.ring.material.opacity = 0.5 + 0.4 * Math.sin(this.time * 6);
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.pos.x - z.pos.x, e.pos.z - z.pos.z);
        if (d <= z.r) e.slowT = 0.3;
      }
    }
    const alive = [];
    for (const z of this.radarZones) {
      if (z.t > 0) alive.push(z);
      else removeObj(z.ring);
    }
    this.radarZones = alive;
  }

  updateVisuals(dt) {
    for (const w of this.waterMeshes) w.position.y = -0.12 + Math.sin(this.time * 1.5 + w.position.x) * 0.012;
    if (this.hq && this.hq.userData.core) {
      const core = this.hq.userData.core;
      core.scale.setScalar(1 + Math.sin(this.time * 2.5) * 0.08);
    }
    if (this.spawnRing) {
      const s = 1 + Math.sin(this.time * 4) * 0.12;
      this.spawnRing.scale.set(s, s, s);
    }
    if (this.spawnBeam) this.spawnBeam.material.opacity = 0.16 + Math.sin(this.time * 3) * 0.06;
    if (this.bubble) {
      this.bubble.visible = this.baseShieldT > 0;
      this.bubble.material.opacity = 0.14 + Math.sin(this.time * 5) * 0.05;
      this.bubble.rotation.y += dt * 0.3;
    }
    for (const t of this.towers) {
      const orb = t.model.userData.orb;
      if (orb && orb.scale.x > 1) orb.scale.setScalar(Math.max(1, orb.scale.x - dt * 3));
    }
  }

  setQuality(q) {
    this.quality = q;
  }
}
