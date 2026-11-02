// Efectos visuales: particulas, explosiones, haces laser, arcos electricos, anillos, textos flotantes.
import * as THREE from 'three';

const _v = new THREE.Vector3();

// Sistema de particulas con un solo draw call
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
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.fade = new THREE.Color(fadeTo);
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
    this.additive = additive;
  }
  emit(x, y, z, vx, vy, vz, life, color, grav = 0, drag = 0.0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = new THREE.Color(color);
    this.base[i * 3] = c.r; this.base[i * 3 + 1] = c.g; this.base[i * 3 + 2] = c.b;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] < 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; }
      // Aditivo: el color se desvanece a negro. Normal: se mezcla hacia el color de fondo.
      for (let j = 0; j < 3; j++) {
        const b = this.base[i * 3 + j];
        const target = this.additive ? 0 : [this.fade.r, this.fade.g, this.fade.b][j];
        this.col[i * 3 + j] = target + (b - target) * k;
      }
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; this.pos[i * 3 + 1] = -999; }
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }
  dispose(scene) { scene.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

export class Effects {
  constructor(scene, camera, layer) {
    this.scene = scene;
    this.camera = camera;
    this.layer = layer; // contenedor DOM para textos flotantes
    this.sparks = new ParticleSystem(scene, 2400, { size: 0.28, additive: true });
    this.smoke = new ParticleSystem(scene, 1600, { size: 0.9, additive: false, fadeTo: 0x2a2a30, opacity: 0.55 });
    this.beams = [];
    this.rings = [];
    this.flashes = [];
    this.texts = [];
    this.sphereGeo = new THREE.SphereGeometry(1, 10, 8);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this.flashCount = 0;
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
    this.emitSparks(p, Math.round(18 * size) + 6, 0xffc060, 5 * size, 0.5);
    this.emitSparks(p, Math.round(10 * size) + 4, color, 3 * size, 0.7);
    this.emitSmoke(p, Math.round(8 * size) + 3, 1.2 * size, 1.8 * size);
    this.flash(p, 1.4 * size, 0xffb050, 0.18);
    this.ring(p, 2.2 * size, 0xff9040, 0.45);
  }

  flash(p, size, color, life = 0.15) {
    const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.copy(p);
    m.scale.setScalar(size * 0.2);
    this.scene.add(m);
    this.flashes.push({ m, life, max: life, size });
  }

  ring(p, radius, color, life = 0.5, ground = true) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, p.y + 0.05, p.z);
    m.scale.setScalar(0.2);
    this.scene.add(m);
    this.rings.push({ m, life, max: life, radius, ground });
  }

  // Haz/linea gruesa entre dos puntos (laser, trazador)
  beam(a, b, color, life = 0.12, width = 0.06) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.001) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 6, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.scene.add(m);
    this.beams.push({ m, life, max: life, w: width });
  }

  // Arco electrico con zig-zag entre dos puntos
  arc(a, b, color = 0x7fe9ff, life = 0.18) {
    const pts = [];
    const steps = 8;
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const n = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const j = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 0.7 * Math.sin(Math.PI * t) * Math.max(0.5, len / 4);
      pts.push(new THREE.Vector3().copy(a).addScaledVector(dir, t).addScaledVector(n, j).add(new THREE.Vector3(0, 0.6 + Math.random() * 0.5, 0)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.scene.add(line);
    this.beams.push({ m: line, life, max: life, w: 0, line: true });
    this.emitSparks(b, 6, color, 3, 0.3);
  }

  floatText(p, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    this.layer.appendChild(el);
    this.texts.push({ el, p: p.clone(), life: 1.1, max: 1.1 });
  }

  screenFlash(color = 'rgba(255,60,40,.35)', ms = 260) {
    const el = document.getElementById('screenFlash');
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
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      const k = Math.max(0, b.life / b.max);
      b.m.material.opacity = k;
      if (b.life <= 0) { this.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); this.beams.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - Math.max(0, r.life / r.max);
      r.m.scale.setScalar(Math.max(0.1, r.radius * k));
      r.m.material.opacity = 0.9 * (1 - k);
      if (r.life <= 0) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.m.scale.setScalar(f.size * (0.2 + (1 - k) * 0.8));
      f.m.material.opacity = k * 0.9;
      if (f.life <= 0) { this.scene.remove(f.m); f.m.material.dispose(); this.flashes.splice(i, 1); }
    }
    const w = this.layer.clientWidth || window.innerWidth, h = this.layer.clientHeight || window.innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.p.y += dt * 1.2;
      _v.copy(t.p).project(this.camera);
      t.el.style.left = ((_v.x * 0.5 + 0.5) * w) + 'px';
      t.el.style.top = ((-_v.y * 0.5 + 0.5) * h) + 'px';
      t.el.style.opacity = String(Math.min(1, t.life / 0.4));
      if (t.life <= 0) { t.el.remove(); this.texts.splice(i, 1); }
    }
  }

  clear() {
    for (const b of this.beams) { this.scene.remove(b.m); }
    for (const r of this.rings) { this.scene.remove(r.m); }
    for (const f of this.flashes) { this.scene.remove(f.m); }
    this.beams = []; this.rings = []; this.flashes = [];
    for (const t of this.texts) t.el.remove();
    this.texts = [];
    this.sparks.life.fill(0); this.smoke.life.fill(0);
  }
}
