// Efectos visuales optimizados: particulas en un solo draw call, pools de haces/anillos/destellos
// (sin crear geometrias ni materiales por disparo) y colores cacheados.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _dir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const colorCache = new Map();
function col(c) {
  let k = colorCache.get(c);
  if (!k) { k = new THREE.Color(c); colorCache.set(c, k); }
  return k;
}

// Sistema de particulas: arrays tipados, un solo THREE.Points
class ParticleSystem {
  constructor(scene, cap, { size, additive, fadeTo = 0x000000, opacity = 1 }) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.base = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, depthWrite: false, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true,
    });
    this.fade = col(fadeTo);
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
    this.additive = additive;
    this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, life, color, grav = 0, drag = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    const c = col(color);
    this.base[o] = c.r; this.base[o + 1] = c.g; this.base[o + 2] = c.b;
    this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag;
    this.lastEmptyFrame = false;
  }
  update(dt) {
    if (this.lastEmptyFrame) return;
    let any = false;
    const fr = this.fade.r, fg = this.fade.g, fb = this.fade.b;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      const o = i * 3;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[o] *= d; this.vel[o + 2] *= d;
      this.vel[o + 1] += this.grav[i] * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      if (this.pos[o + 1] < 0.02 && this.grav[i] < 0) { this.pos[o + 1] = 0.02; this.vel[o + 1] *= -0.3; }
      if (this.additive) {
        this.col[o] = this.base[o] * k; this.col[o + 1] = this.base[o + 1] * k; this.col[o + 2] = this.base[o + 2] * k;
      } else {
        this.col[o] = fr + (this.base[o] - fr) * k;
        this.col[o + 1] = fg + (this.base[o + 1] - fg) * k;
        this.col[o + 2] = fb + (this.base[o + 2] - fb) * k;
      }
      if (this.life[i] <= 0) { this.col[o] = this.col[o + 1] = this.col[o + 2] = 0; this.pos[o + 1] = -999; }
    }
    this.lastEmptyFrame = !any;
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }
}

// Pool de objetos visuales reutilizables (se ocultan cuando estan libres)
class Pool {
  constructor(scene, make, max = 200) {
    this.scene = scene; this.make = make; this.max = max;
    this.items = []; this.free = [];
  }
  get() {
    let it = this.free.pop();
    if (!it) {
      if (this.items.length >= this.max) return null;
      it = this.make();
      this.items.push(it);
      this.scene.add(it.obj);
    }
    it.obj.visible = true;
    return it;
  }
  release(it) { it.obj.visible = false; this.free.push(it); }
}

export class Effects {
  constructor(scene, camera, layer) {
    this.scene = scene;
    this.camera = camera;
    this.layer = layer;
    this.sparks = new ParticleSystem(scene, 1600, { size: 0.28, additive: true });
    this.smoke = new ParticleSystem(scene, 1000, { size: 0.9, additive: false, fadeTo: 0x2a2a30, opacity: 0.55 });
    // Geometrias compartidas
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    cylGeo.translate(0, 0.5, 0); // origen en la base, altura 1
    this.cylGeo = cylGeo;
    this.sphereGeo = new THREE.SphereGeometry(1, 10, 8);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 32);
    this.beamPool = new Pool(scene, () => {
      const m = new THREE.Mesh(this.cylGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.visible = false;
      return { obj: m, life: 0, max: 1, w: 1, kind: 'beam' };
    }, 160);
    this.ringPool = new Pool(scene, () => {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      return { obj: m, life: 0, max: 1, radius: 1 };
    }, 40);
    this.flashPool = new Pool(scene, () => {
      const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.visible = false;
      return { obj: m, life: 0, max: 1, size: 1 };
    }, 60);
    this.active = { beams: [], rings: [], flashes: [], arcs: [] };
    this.texts = [];
    this.flashEl = document.getElementById('screenFlash');
  }

  emitSparks(p, n, color, speed = 4, life = 0.45, grav = -9) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.2) * Math.PI * 0.6;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.sparks.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + speed * 0.4, Math.sin(a) * Math.cos(e) * s, life * (0.6 + Math.random() * 0.6), color, grav);
    }
  }

  emitSmoke(p, n = 1, speed = 0.6, life = 1.6, color = 0x9a9aa0) {
    for (let i = 0; i < n; i++) {
      this.smoke.emit(p.x + (Math.random() - 0.5) * 0.3, p.y, p.z + (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * speed, speed * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * speed,
        life * (0.7 + Math.random() * 0.5), color, 0.2, 0.4);
    }
  }

  explosion(p, size = 1, color = 0xff8a1a) {
    this.emitSparks(p, Math.round(14 * size) + 5, 0xffc060, 5 * size, 0.5);
    this.emitSparks(p, Math.round(8 * size) + 3, color, 3 * size, 0.7);
    this.emitSmoke(p, Math.round(6 * size) + 2, 1.2 * size, 1.8 * size);
    this.flash(p, 1.4 * size, 0xffb050, 0.18);
    this.ring(p, 2.2 * size, 0xff9040, 0.45);
  }

  flash(p, size, color, life = 0.15) {
    const it = this.flashPool.get();
    if (!it) return;
    it.obj.position.copy(p);
    it.obj.material.color.set(color);
    it.obj.scale.setScalar(size * 0.2);
    it.life = it.max = life; it.size = size;
    it.obj.material.opacity = 0.9;
    this.active.flashes.push(it);
  }

  ring(p, radius, color, life = 0.5) {
    const it = this.ringPool.get();
    if (!it) return;
    it.obj.position.set(p.x, p.y + 0.05, p.z);
    it.obj.material.color.set(color);
    it.obj.scale.setScalar(0.2);
    it.life = it.max = life; it.radius = radius;
    this.active.rings.push(it);
  }

  // Haz/linea gruesa entre dos puntos (laser, trazador)
  beam(a, b, color, life = 0.12, width = 0.06) {
    _dir.subVectors(b, a);
    const len = _dir.length();
    if (len < 0.001) return;
    const it = this.beamPool.get();
    if (!it) return;
    const o = it.obj;
    o.position.copy(a);
    o.scale.set(width, len, width);
    o.quaternion.setFromUnitVectors(UP, _dir.normalize());
    o.material.color.set(color);
    o.material.opacity = 0.95;
    it.life = it.max = life;
    this.active.beams.push(it);
  }

  // Arco electrico con zig-zag (linea temporal)
  arc(a, b, color = 0x7fe9ff, life = 0.18) {
    const steps = 8;
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const n = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const j = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 0.7 * Math.sin(Math.PI * t) * Math.max(0.5, len / 4);
      pts.push(new THREE.Vector3().copy(a).addScaledVector(dir, t).addScaledVector(n, j).add(new THREE.Vector3(0, 0.6 + Math.random() * 0.5, 0)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.scene.add(line);
    this.active.arcs.push({ m: line, life, max: life });
    this.emitSparks(b, 5, color, 3, 0.3);
  }

  floatText(p, text, cls = '') {
    if (this.texts.length > 40) return; // evita saturar el DOM
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    this.layer.appendChild(el);
    this.texts.push({ el, p: p.clone(), life: 1.1, max: 1.1 });
  }

  screenFlash(color = 'rgba(255,60,40,.35)', ms = 260) {
    const el = this.flashEl;
    if (!el) return;
    el.style.background = color;
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${ms}ms ease-out`;
      el.style.opacity = '0';
    });
  }

  update(dt) {
    this.sparks.update(dt);
    this.smoke.update(dt);
    const A = this.active;
    for (let i = A.beams.length - 1; i >= 0; i--) {
      const b = A.beams[i];
      b.life -= dt;
      b.obj.material.opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) { this.beamPool.release(b); A.beams.splice(i, 1); }
    }
    for (let i = A.rings.length - 1; i >= 0; i--) {
      const r = A.rings[i];
      r.life -= dt;
      const k = 1 - Math.max(0, r.life / r.max);
      r.obj.scale.setScalar(Math.max(0.1, r.radius * k));
      r.obj.material.opacity = 0.9 * (1 - k);
      if (r.life <= 0) { this.ringPool.release(r); A.rings.splice(i, 1); }
    }
    for (let i = A.flashes.length - 1; i >= 0; i--) {
      const f = A.flashes[i];
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.obj.scale.setScalar(f.size * (0.2 + (1 - k) * 0.8));
      f.obj.material.opacity = k * 0.9;
      if (f.life <= 0) { this.flashPool.release(f); A.flashes.splice(i, 1); }
    }
    for (let i = A.arcs.length - 1; i >= 0; i--) {
      const a = A.arcs[i];
      a.life -= dt;
      a.m.material.opacity = Math.max(0, a.life / a.max);
      if (a.life <= 0) { this.scene.remove(a.m); a.m.geometry.dispose(); a.m.material.dispose(); A.arcs.splice(i, 1); }
    }
    if (this.texts.length) {
      const w = this.layer.clientWidth || window.innerWidth, h = this.layer.clientHeight || window.innerHeight;
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.p.y += dt * 1.2;
        _v.copy(t.p).project(this.camera);
        t.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
        t.el.style.opacity = String(Math.min(1, t.life / 0.4));
        if (t.life <= 0) { t.el.remove(); this.texts.splice(i, 1); }
      }
    }
  }

  clear() {
    for (const b of this.active.beams) this.beamPool.release(b);
    for (const r of this.active.rings) this.ringPool.release(r);
    for (const f of this.active.flashes) this.flashPool.release(f);
    for (const a of this.active.arcs) { this.scene.remove(a.m); a.m.geometry.dispose(); a.m.material.dispose(); }
    this.active = { beams: [], rings: [], flashes: [], arcs: [] };
    for (const t of this.texts) t.el.remove();
    this.texts = [];
    this.sparks.life.fill(0); this.smoke.life.fill(0);
  }
}
