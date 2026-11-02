// Sonidos sinteticos con WebAudio (no requiere archivos).
let ctx = null, master = null, noise = null;
let enabled = localStorage.getItem('td_sound') !== '0';
const last = {};

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 1.5;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setSound(on) {
  enabled = on;
  localStorage.setItem('td_sound', on ? '1' : '0');
}
export function soundOn() { return enabled; }

function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function burst(dur, vol = 0.4, filter = 1200, type = 'lowpass', sweepTo = null) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filter, ctx.currentTime);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + dur);
  src.connect(f).connect(g).connect(master);
  src.start(ctx.currentTime, Math.random() * 0.5);
  src.stop(ctx.currentTime + dur + 0.02);
}

const THROTTLE = { shoot: 0.05, laser: 0.12, zap: 0.08, boom: 0.06, missile: 0.2, hurt: 0.3 };

export function sfx(name) {
  if (!enabled || !ctx) return;
  const now = performance.now() / 1000;
  if (THROTTLE[name]) {
    if (last[name] && now - last[name] < THROTTLE[name]) return;
    last[name] = now;
  }
  try {
    switch (name) {
      case 'shoot': burst(0.06, 0.25, 3000, 'highpass'); break;
      case 'laser': tone(1400, 0.22, 'sawtooth', 0.12, 300); break;
      case 'missile': burst(0.7, 0.35, 400, 'bandpass', 1400); break;
      case 'boom': burst(0.7, 0.6, 900, 'lowpass', 120); break;
      case 'zap': tone(2000 + Math.random() * 800, 0.12, 'square', 0.07, 400); burst(0.1, 0.15, 6000, 'highpass'); break;
      case 'flak': burst(0.12, 0.3, 2000, 'bandpass'); break;
      case 'build': tone(660, 0.12, 'triangle', 0.25, 990); break;
      case 'upgrade': tone(520, 0.1, 'triangle', 0.25); tone(780, 0.14, 'triangle', 0.25, null, 0.1); break;
      case 'sell': tone(900, 0.2, 'triangle', 0.2, 300); break;
      case 'click': tone(880, 0.05, 'sine', 0.15); break;
      case 'coin': tone(1100, 0.08, 'square', 0.08); tone(1600, 0.1, 'square', 0.08, null, 0.06); break;
      case 'wave': tone(300, 0.4, 'sawtooth', 0.12, 700); tone(450, 0.4, 'sine', 0.15, 900, 0.2); break;
      case 'hurt': tone(160, 0.35, 'sawtooth', 0.25, 60); break;
      case 'error': tone(220, 0.15, 'square', 0.12); tone(180, 0.15, 'square', 0.12, null, 0.12); break;
      case 'skill': tone(300, 0.5, 'sine', 0.25, 1200); burst(0.4, 0.3, 800, 'bandpass', 3000); break;
      case 'nuke': burst(2.0, 0.9, 300, 'lowpass', 40); tone(90, 1.8, 'sine', 0.5, 25); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'triangle', 0.22, null, i * 0.15)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.14, null, i * 0.25)); break;
      default: break;
    }
  } catch (e) { /* audio no disponible */ }
}
