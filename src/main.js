// Punto de entrada: renderizado, camara, entrada, HUD y bucle principal.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SCENARIOS } from './maps.js';
import { Game, MAX_WAVE, TILE, TOWER_STATS } from './game.js';
import { Effects } from './effects.js';
import { createTower, createEnemy, renderIcons, TOWER_INFO, ENEMY_INFO } from './models.js';
import { initAudio, sfx, setSound, soundOn } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ---------- Renderer / escena / camara ----------
// Presets de calidad: las sombras y el bloom son lo mas caro; por defecto van apagados.
const QUAL = {
  high: { shadows: true, bloom: true, maxPR: 2, shadowSize: 1024 },
  medium: { shadows: false, bloom: false, maxPR: 1.25 },
  low: { shadows: false, bloom: false, maxPR: 1 },
};
let quality = localStorage.getItem('td_quality') || 'medium';
if (!QUAL[quality]) quality = 'medium';
let prTarget = Math.min(window.devicePixelRatio, QUAL[quality].maxPR);
let pr = prTarget;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(pr);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 400);
const CAM_PLAY = new THREE.Vector3(-10, 40, 50);
const CAM_MENU = new THREE.Vector3(34, 30, 40);
camera.position.copy(CAM_MENU);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 16;
controls.maxDistance = 110;
controls.maxPolarAngle = 1.32;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.listenToKeyEvents(window);
controls.target.set(0, 0, 0);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pr);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.5, 0.85);
bloom.enabled = QUAL[quality].bloom;
composer.addPass(bloom);
composer.addPass(new OutputPass());

const effects = new Effects(scene, camera, $('fx'));
const game = new Game({
  scene, camera, renderer, effects,
  hooks: {
    onMessage: (t) => toast(t),
    onWin: (s) => endGame(true, s),
    onLose: (s) => endGame(false, s),
  },
});

// ---------- Iconos 3D para la interfaz ----------
const iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const towerIcons = renderIcons(iconRenderer, Object.fromEntries(Object.keys(TOWER_INFO).map((k) => [k, createTower(k, 1)])), 256);
const enemyIcons = renderIcons(iconRenderer, Object.fromEntries(Object.keys(ENEMY_INFO).map((k) => [k, createEnemy(k)])), 256);
iconRenderer.dispose();

// ---------- Construccion de la UI ----------
const SKILLS = [
  { id: 'misil', label: 'Misiles', cls: 'misil', svg: '<path d="M12 2l3 6v8l-3 3-3-3V8z"/><path d="M9 14l-4 4v2l4-2M15 14l4 4v2l-4-2"/><circle cx="12" cy="9" r="1.2"/>' },
  { id: 'radar', label: 'Radar', cls: 'radar', svg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12L19 7"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>' },
  { id: 'nuke', label: 'Nuclear', cls: 'nuke', svg: '<circle cx="12" cy="12" r="2"/><path d="M12 10a2 2 0 0 1 2 -2 M12 14a2 2 0 0 1-2 2 M12 3a9 9 0 0 1 7.8 13.5 L12 12 M12 21a9 9 0 0 1-7.8-13.5L12 12" /><circle cx="12" cy="12" r="9"/>' },
  { id: 'shield', label: 'Escudo', cls: 'shield', svg: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>' },
  { id: 'heal', label: 'Botiquín', cls: 'heal', svg: '<rect x="3" y="3" width="18" height="18" rx="4" fill="none"/><path d="M12 7v10M7 12h10" stroke-width="2.6"/>' },
];
const TOWER_KEYS = Object.keys(TOWER_INFO);
const ENEMY_KEYS = ['soldier', 'shield', 'spider', 'jeep', 'tank', 'truck', 'drone', 'heli'];

function buildUI() {
  // Escaparate del menu
  $('towerShowcase').innerHTML = '<div class="showTitle">ARSENAL</div><div class="showRow">' + TOWER_KEYS.map((k) =>
    `<div class="tCard"><img src="${towerIcons[k]}" alt=""><span class="tName">${TOWER_INFO[k].name}</span></div>`).join('') + '</div>';

  // Barra de torres
  $('towerBar').innerHTML = TOWER_KEYS.map((k, i) =>
    `<button class="towerBtn" data-tower="${k}" title="${TOWER_INFO[k].name}"><span class="key">${i + 1}</span><img src="${towerIcons[k]}" alt=""><span class="cost">$${TOWER_INFO[k].cost}</span></button>`).join('');

  // Enemigos
  $('enemyGrid').innerHTML = ENEMY_KEYS.map((k) =>
    `<div class="enemyCell ${ENEMY_INFO[k].air ? 'air' : ''}" data-enemy="${k}"><img src="${enemyIcons[k]}" alt=""><span>${ENEMY_INFO[k].name}</span></div>`).join('');

  // Habilidades
  $('skills').innerHTML = SKILLS.map((s) =>
    `<button class="skillBtn ${s.cls}" data-skill="${s.id}" title="${s.label}"><svg viewBox="0 0 24 24">${s.svg}</svg><span class="cd"></span></button>`).join('');

  // Escenarios (menu)
  $('scenarioGrid').innerHTML = SCENARIOS.map((sc, i) =>
    `<div class="scenCard" data-scen="${i}" style="background:${scenGradient(sc)}">
       <div class="scenShade"></div><span class="scenBadge">${i + 1}/${SCENARIOS.length}</span>
       <div class="scenInfo"><h3>${sc.name}</h3><p>${sc.desc}</p></div></div>`).join('');

  // Escenarios (mini en HUD)
  $('miniScen').innerHTML = SCENARIOS.map((sc, i) =>
    `<div class="miniCard" data-scen="${i}" style="background:${scenGradient(sc)}"><span>${sc.name}</span></div>`).join('');
}
function scenGradient(sc) {
  const t = sc.theme;
  const g = t.ground[0].toString(16).padStart(6, '0');
  return `linear-gradient(180deg, ${t.skyTop} 0%, ${t.skyBottom} 70%, #${g} 100%)`;
}

// ---------- Estados de pantalla ----------
let mode = 'menu';
let currentScenario = SCENARIOS[0];

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
}
function showMenu() {
  mode = 'menu';
  game.paused = false;
  game.buildType = null; game.skillMode = null; game.sellMode = false;
  $('hud').classList.remove('paused');
  $('endOverlay').classList.remove('show');
  game.loadScenario(SCENARIOS[0], { demo: true });
  buildMinimapBase();
  controls.target.set(0, 0, 0);
  camera.position.copy(CAM_MENU);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  showScreen('menu');
}
function startScenario(sc) {
  initAudio();
  currentScenario = sc;
  mode = 'play';
  controls.autoRotate = false;
  game.loadScenario(sc);
  buildMinimapBase();
  game.showRanges = $('setRanges').checked;
  camera.position.copy(CAM_PLAY).add(new THREE.Vector3(-4, 0, 0));
  controls.target.set(-4, 0, 0);
  controls.update();
  $('hud').classList.remove('paused');
  $('endOverlay').classList.remove('show');
  $('btnRanges').classList.toggle('active', game.showRanges);
  showScreen('hud');
  refreshMiniScen();
  toast(`${sc.name}: pulsa ▶ Oleada para empezar`);
}
function endGame(won, s) {
  const title = $('endTitle');
  title.textContent = won ? 'VICTORIA' : 'DERROTA';
  title.className = 'endTitle ' + (won ? 'win' : 'lose');
  $('endStats').innerHTML = `
    <div><b>${s.wave}/${MAX_WAVE}</b><span>Oleadas</span></div>
    <div><b>${s.kills}</b><span>Enemigos</span></div>
    <div><b>$${s.gold}</b><span>Oro final</span></div>
    <div><b>${Math.max(0, s.lives)}</b><span>Vida base</span></div>`;
  $('endOverlay').classList.add('show');
}
function togglePause(force) {
  if (mode !== 'play' || game.over) return;
  game.paused = typeof force === 'boolean' ? force : !game.paused;
  $('hud').classList.toggle('paused', game.paused);
  $('btnResume').innerHTML = '<span>▶</span> Reanudar';
  toast(game.paused ? 'Juego en pausa' : 'Reanudado');
}

// ---------- Mensajes ----------
let toastTimer = null;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Minimapa ----------
const mm = $('minimap').getContext('2d');
const mmBase = document.createElement('canvas');
mmBase.width = 240; mmBase.height = 160;
const MM_COL = { '.': '#3d6b34', P: '#6b6e78', S: '#ff3b30', B: '#2fb8ff', '#': '#4a4f58', '~': '#1f6fa8' };
function buildMinimapBase() {
  if (!game.L) return;
  const L = game.L, ctx = mmBase.getContext('2d');
  const cw = mmBase.width / L.W, ch = mmBase.height / L.H;
  ctx.fillStyle = '#0a1322';
  ctx.fillRect(0, 0, mmBase.width, mmBase.height);
  for (let r = 0; r < L.H; r++) for (let c = 0; c < L.W; c++) {
    ctx.fillStyle = MM_COL[L.tiles[r][c]] || '#3d6b34';
    ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
  }
}
function drawMinimap() {
  if (!game.L) return;
  const L = game.L, cvs = $('minimap');
  const cw = cvs.width / L.W, ch = cvs.height / L.H;
  mm.drawImage(mmBase, 0, 0);
  for (const t of game.towers) {
    mm.fillStyle = '#ffb347';
    mm.fillRect(t.c * cw + cw * 0.2, t.r * ch + ch * 0.2, cw * 0.6, ch * 0.6);
  }
  for (const e of game.enemies) {
    if (e.dead) continue;
    const x = ((e.pos.x - game.ox) / TILE) * cw, y = ((e.pos.z - game.oz) / TILE) * ch;
    mm.fillStyle = e.air ? '#ffffff' : '#ff4a3a';
    mm.beginPath();
    mm.arc(x, y, e.boss ? 4 : 2.2, 0, Math.PI * 2);
    mm.fill();
  }
}

// ---------- HUD ----------
function refreshMiniScen() {
  for (const el of document.querySelectorAll('.miniCard')) el.classList.toggle('current', +el.dataset.scen === SCENARIOS.indexOf(currentScenario));
}
function setText(id, v) { const el = $(id); if (el.textContent !== String(v)) el.textContent = v; }
const btnTowers = [...document.querySelectorAll('.towerBtn')];
const btnSkills = [...document.querySelectorAll('.skillBtn')];
const cellEnemies = [...document.querySelectorAll('.enemyCell')];
function updateHUD() {
  setText('lives', Math.max(0, Math.round(game.lives)));
  setText('gold', game.gold);
  setText('waveText', `Oleada: ${game.wave}/${MAX_WAVE}`);
  const start = $('btnStart');
  start.disabled = game.waveActive || game.wave >= MAX_WAVE || game.over;
  start.textContent = game.waveActive ? 'En curso…' : (game.wave >= MAX_WAVE ? 'Completado' : '▶ Oleada');
  start.classList.toggle('active', game.waveActive);
  $('btnSpeed').textContent = game.speed + 'x';
  $('btnRanges').classList.toggle('active', game.showRanges);
  $('btnSell').classList.toggle('active', game.sellMode);
  $('btnResume').innerHTML = game.paused ? '<span>▶</span> Reanudar' : '<span>❚❚</span> Pausar';

  for (const b of btnTowers) {
    const k = b.dataset.tower;
    b.classList.toggle('active', game.buildType === k);
    b.classList.toggle('unaffordable', game.gold < TOWER_INFO[k].cost);
  }
  const alive = new Set(game.enemies.filter((e) => !e.dead).map((e) => e.type));
  for (const c of cellEnemies) c.classList.toggle('active', alive.has(c.dataset.enemy));

  for (const b of btnSkills) {
    const id = b.dataset.skill;
    const cd = game.skillCd[id];
    b.classList.toggle('cooling', cd > 0);
    b.classList.toggle('active', game.skillMode === id);
    const txt = cd > 0 ? Math.ceil(cd) + 's' : '';
    if (b._cd !== txt) { b._cd = txt; b.querySelector('.cd').textContent = txt; }
  }

  const sel = game.selected;
  const up = $('btnUpgrade'), sell = $('btnSellSel');
  if (sel) {
    const st = game.towerStats(sel);
    const base = TOWER_STATS[sel.type];
    const info = TOWER_INFO[sel.type];
    $('upImg').src = towerIcons[sel.type];
    $('upName').textContent = `${info.name} · Nivel ${sel.level}/3`;
    $('barPower').style.width = Math.min(100, (st.dmg / (base.dmg * 2.3)) * 100) + '%';
    $('barRate').style.width = Math.min(100, ((base.rate / st.rate) / 2.5) * 100) + '%';
    $('barRange').style.width = Math.min(100, (st.range / (base.range + 1.6)) * 100) + '%';
    const cost = sel.level < 3 ? [200, 350][sel.level - 1] : 0;
    up.disabled = sel.level >= 3 || game.over;
    up.textContent = sel.level >= 3 ? 'NIVEL MÁXIMO' : `MEJORAR $${cost}`;
    sell.disabled = false;
    sell.textContent = `Vender +$${Math.floor(sel.spent * 0.6)}`;
  } else {
    $('upName').textContent = 'Selecciona una torre';
    $('upImg').removeAttribute('src');
    $('barPower').style.width = $('barRate').style.width = $('barRange').style.width = '0%';
    up.disabled = true; up.textContent = 'MEJORAR';
    sell.disabled = true; sell.textContent = 'Vender';
  }
}

// ---------- Entrada ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
function pickTile(ev) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null;
  return game.worldToTile(hitPoint.x, hitPoint.z);
}
let downAt = null;
canvas.addEventListener('pointermove', (ev) => {
  if (mode !== 'play') return;
  const t = pickTile(ev);
  if (t) game.hoverTile(t.c, t.r); else game.hoverTile(-1, -1);
});
canvas.addEventListener('pointerleave', () => { if (mode === 'play') game.hoverTile(-1, -1); });
canvas.addEventListener('pointerdown', (ev) => { downAt = { x: ev.clientX, y: ev.clientY, b: ev.button }; initAudio(); });
canvas.addEventListener('pointerup', (ev) => {
  if (!downAt || mode !== 'play') return;
  const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
  const b = downAt.b;
  downAt = null;
  if (moved > 6) return;
  if (b === 2) { // clic derecho: cancelar modos
    game.buildType = null; game.skillMode = null; game.sellMode = false;
    game.hoverTile(-1, -1);
    return;
  }
  if (b !== 0 || game.paused || game.over) return;
  const t = pickTile(ev);
  if (t && game.inBounds(t.c, t.r)) game.clickTile(t.c, t.r);
  if (!t) game.selected = null;
  game.updateRangeRings();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function selectTower(type) {
  if (mode !== 'play' || game.over) return;
  game.skillMode = null; game.sellMode = false;
  game.buildType = game.buildType === type ? null : type;
  if (game.buildType) toast(`Construir ${TOWER_INFO[type].name}: haz clic en una casilla verde`);
}
function toggleSell() {
  if (mode !== 'play') return;
  game.sellMode = !game.sellMode;
  game.buildType = null; game.skillMode = null;
  toast(game.sellMode ? 'Modo vender: haz clic en una torre' : 'Modo vender desactivado');
}
function useSkill(id) {
  if (mode !== 'play' || game.over) return;
  game.sellMode = false; game.buildType = null;
  game.useSkill(id);
}

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('button, .scenCard, .miniCard, .enemyCell');
  if (!t) return;
  if (t.classList.contains('towerBtn')) return selectTower(t.dataset.tower);
  if (t.classList.contains('skillBtn')) return useSkill(t.dataset.skill);
  if (t.classList.contains('scenCard')) return startScenario(SCENARIOS[+t.dataset.scen]);
  if (t.classList.contains('miniCard')) {
    const sc = SCENARIOS[+t.dataset.scen];
    if (sc !== currentScenario) startScenario(sc);
    return;
  }
  if (t.dataset.action) return menuAction(t.dataset.action);
});

function menuAction(a) {
  sfx('click');
  if (a === 'play') showScreen('scenarioScreen');
  else if (a === 'back') showScreen('menu');
  else if (a === 'settings') openModal('settingsModal');
  else if (a === 'help') openModal('helpModal');
  else if (a === 'quit') { window.close(); toast('Cierra la ventana para salir'); }
}
function openModal(id) { $(id).classList.add('show'); }
function closeModal(id) { $(id).classList.remove('show'); }

$('btnStart').addEventListener('click', () => { initAudio(); if (game.startWave()) updateHUD(); });
$('btnPauseTop').addEventListener('click', () => togglePause());
$('btnResume').addEventListener('click', () => togglePause(false));
$('btnRestart').addEventListener('click', () => startScenario(currentScenario));
$('btnMenu').addEventListener('click', () => showMenu());
$('btnSpeed').addEventListener('click', () => { game.speed = game.speed === 1 ? 2 : 1; });
$('btnSell').addEventListener('click', () => toggleSell());
$('btnRanges').addEventListener('click', () => { game.showRanges = !game.showRanges; game.updateRangeRings(); });
$('btnSettings2').addEventListener('click', () => openModal('settingsModal'));
$('btnUpgrade').addEventListener('click', () => { if (game.selected) game.upgradeTower(game.selected); });
$('btnSellSel').addEventListener('click', () => { if (game.selected) game.sellTower(game.selected); });
$('btnRetry').addEventListener('click', () => startScenario(currentScenario));
$('btnEndMenu').addEventListener('click', () => showMenu());
$('btnSettingsClose').addEventListener('click', () => closeModal('settingsModal'));
$('btnHelpClose').addEventListener('click', () => closeModal('helpModal'));
$('setSound').addEventListener('change', (e) => setSound(e.target.checked));
$('setRanges').addEventListener('change', (e) => { game.showRanges = e.target.checked; game.updateRangeRings(); });
$('setQuality').addEventListener('change', (e) => applyQuality(e.target.value));
$('setFps').addEventListener('change', (e) => { localStorage.setItem('td_fps', e.target.checked ? '1' : '0'); });
$('setFull').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
});

function applyPR() {
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  resize();
}
function applyQuality(q) {
  if (!QUAL[q]) q = 'medium';
  quality = q;
  localStorage.setItem('td_quality', q);
  $('setQuality').value = q;
  const P = QUAL[q];
  prTarget = Math.min(window.devicePixelRatio, P.maxPR);
  pr = prTarget;
  bloom.enabled = P.bloom;
  renderer.shadowMap.enabled = P.shadows;
  game.sun.castShadow = P.shadows;
  game.sun.shadow.mapSize.set(P.shadowSize || 512, P.shadowSize || 512);
  if (game.sun.shadow.map) { game.sun.shadow.map.dispose(); game.sun.shadow.map = null; }
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  applyPR();
}

// Escalado adaptativo: si el juego va por debajo de ~60 FPS baja la resolucion interna;
// si sobra rendimiento, la sube de nuevo hasta el objetivo de calidad.
let adaptAcc = 0, adaptN = 0;
function adaptResolution(dt) {
  adaptAcc += dt; adaptN++;
  if (adaptN < 90) return;
  const avg = adaptAcc / adaptN;
  adaptAcc = 0; adaptN = 0;
  if (avg > 0.0185 && pr > 0.5) { pr = Math.max(0.5, +(pr - 0.125).toFixed(3)); applyPR(); }
  else if (avg < 0.0145 && pr < prTarget) { pr = Math.min(prTarget, +(pr + 0.125).toFixed(3)); applyPR(); }
}
const fpsEl = $('fps');
let fpsAcc = 0, fpsN = 0;
function updateFps(dt) {
  if (!$('setFps').checked) { fpsEl.style.display = 'none'; return; }
  fpsEl.style.display = 'block';
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) {
    const fps = Math.round(fpsN / fpsAcc);
    fpsEl.textContent = `${fps} FPS · ${Math.round(pr * 100)}% res · ${renderer.info.render.calls} draw`;
    fpsAcc = 0; fpsN = 0;
  }
}

window.addEventListener('keydown', (ev) => {
  if (ev.target && ev.target.tagName === 'SELECT') return;
  if (mode === 'play') {
    const k = ev.key;
    if (k === 'Escape') {
      if (game.buildType || game.skillMode || game.sellMode) { game.buildType = null; game.skillMode = null; game.sellMode = false; toast('Acción cancelada'); }
      else togglePause();
    } else if (/^[1-5]$/.test(k)) selectTower(TOWER_KEYS[+k - 1]);
    else if (k === ' ') { ev.preventDefault(); if (game.startWave()) updateHUD(); }
    else if (k === 'p' || k === 'P') togglePause();
    else if (k === 'v' || k === 'V') toggleSell();
    else if (k === 'Delete' && game.selected) game.sellTower(game.selected);
    else if (k === 'r' || k === 'R') { game.showRanges = !game.showRanges; game.updateRangeRings(); }
    else if (k === '+') { game.speed = 2; }
    else if (k === '-') { game.speed = 1; }
  }
  if (ev.key === 'Escape') {
    for (const id of ['settingsModal', 'helpModal']) if ($(id).classList.contains('show')) closeModal(id);
    if (mode === 'menu' && $('scenarioScreen').classList.contains('active')) showScreen('menu');
  }
});

// ---------- Redimensionado ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------- Bucle principal ----------
let last = performance.now();
let lastDraw = 0;
let hudTimer = 0, mmTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // En el menu basta con 30 FPS (fondo animado); en partida, cada fotograma.
  if (mode === 'menu' && now - lastDraw < 33) return;
  const dt = Math.min(0.05, (now - (lastDraw || now)) / 1000);
  lastDraw = now;
  last = now;

  if (mode === 'play') {
    if (!game.paused && !game.over) game.update(dt * game.speed);
    else game.update(0);
  } else {
    game.update(dt);
  }
  effects.update(dt);
  controls.update();
  if (bloom.enabled) composer.render(); else renderer.render(scene, camera);

  if (mode === 'play') adaptResolution(dt);
  updateFps(dt);
  hudTimer += dt;
  if (hudTimer > 0.15 && mode === 'play') { hudTimer = 0; updateHUD(); }
  mmTimer += dt;
  if (mmTimer > 0.2 && mode === 'play') { mmTimer = 0; drawMinimap(); }
}

// ---------- Arranque ----------
buildUI();
$('setSound').checked = soundOn();
$('setFps').checked = localStorage.getItem('td_fps') === '1';
$('setRanges').checked = false;
applyQuality(quality);
showMenu();
resize();
requestAnimationFrame((t) => { lastDraw = t; frame(t); });
setTimeout(() => $('loading').classList.add('hide'), 250);
window.__td = { game, startScenario, showMenu, SCENARIOS, renderer, getPR: () => pr }; // depuracion
