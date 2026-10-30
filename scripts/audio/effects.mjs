// GDD-AUD-02: the other sound effects (jump, land, claw, stomp, hilo pickup, life lost, meow, tick), synthesised from code as
// placeholders until real audio exists (Open Question 9). Each is a mono Float64Array in -0.8 to 0.8, under a second long,
// deterministic (noise is seeded) and fading to silence at the end. `scripts/audio/make-sfx.mjs` encodes them.
import { SAMPLE_RATE } from './ofrenda.mjs';

export const JUMP = { duration: 0.15, from: 330, to: 880 };
export const LAND = { duration: 0.12, hz: 110, tau: 0.04, burst: 0.03 };
export const CLAW = { duration: 0.18, from: 1500, to: 5000, rise: 0.04 };
export const STOMP = { duration: 0.2, from: 520, to: 140, click: 0.01 };
/** G5. */
export const HILO = { duration: 0.3, hz: 783.99, tau: 0.12 };
/** Ten plucks, E5 down by a whole tone each. */
export const LIFE_LOST = { duration: 0.85, plucks: 10, spacing: 0.08, hz: 659.25, tau: 0.06 };
/** A short wooden tick for the level clear screen's lines (GDD-AUD-02, GDD-UI-02): a high sine that dies fast, and a click. */
export const TICK = { duration: 0.06, hz: 1800, tau: 0.01, click: 0.002 };
export const MEOW = { duration: 0.5, start: 450, peak: 700, peakAt: 0.15, end: 380, attack: 0.03 };

const TAU = 2 * Math.PI;

/** Seeded white noise in -1 to 1, like ofrenda.mjs. */
function noiseSource(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

/** Fades the last `seconds` to 0 and scales the peak to 0.8. */
function finish(out, seconds) {
  const fade = Math.floor(seconds * SAMPLE_RATE);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  const peak = out.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  return out.map((s) => (s / peak) * 0.8);
}

const buffer = (seconds) => new Float64Array(Math.floor(seconds * SAMPLE_RATE));

/** A short rising chirp: a sine with a little third harmonic sweeping up exponentially. */
export function renderJump() {
  const out = buffer(JUMP.duration);
  const ratio = JUMP.to / JUMP.from;
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    phase += (TAU * JUMP.from * ratio ** (t / JUMP.duration)) / SAMPLE_RATE;
    const envelope = Math.min(1, t / 0.005) * Math.exp(-t / 0.15);
    out[i] = envelope * (Math.sin(phase) + 0.3 * Math.sin(3 * phase));
  }
  return finish(out, 0.02);
}

/** A soft thump: a low sine that dies fast, and a short burst of low-passed noise. */
export function renderLand() {
  const out = buffer(LAND.duration);
  const noise = noiseSource(2024);
  let low = 0;
  const burst = Math.floor(LAND.burst * SAMPLE_RATE);
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = Math.exp(-t / LAND.tau) * Math.min(1, t / 0.002) * Math.sin(TAU * LAND.hz * t);
    if (i < burst) {
      low += 0.2 * (noise() - low);
      out[i] += 0.8 * low * (1 - i / burst);
    }
  }
  return finish(out, 0.02);
}

/** A swish: noise through a resonant band-pass whose centre sweeps up. */
export function renderClaw() {
  const out = buffer(CLAW.duration);
  const noise = noiseSource(7);
  const q = 1 / 6;
  let low = 0;
  let band = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const centre = CLAW.from + (CLAW.to - CLAW.from) * (t / CLAW.duration);
    const f = 2 * Math.sin((Math.PI * centre) / SAMPLE_RATE);
    const high = noise() - low - q * band;
    band += f * high;
    low += f * band;
    const envelope = t < CLAW.rise ? t / CLAW.rise : Math.exp(-(t - CLAW.rise) / 0.06);
    out[i] = envelope * band;
  }
  return finish(out, 0.03);
}

/** A springy thud: a sine sweeping down fast, with a click at the start. */
export function renderStomp() {
  const out = buffer(STOMP.duration);
  const noise = noiseSource(99);
  const ratio = STOMP.to / STOMP.from;
  const click = Math.floor(STOMP.click * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    phase += (TAU * STOMP.from * ratio ** (t / STOMP.duration)) / SAMPLE_RATE;
    out[i] = Math.exp(-t / 0.12) * Math.min(1, t / 0.003) * Math.sin(phase);
    if (i < click) out[i] += 0.5 * noise() * (1 - i / click);
  }
  return finish(out, 0.03);
}

/** Adds one plucked note (decaying partials 1, 2 and 3) to `out`, starting at `start` seconds. */
function pluck(out, start, hz, tau) {
  const first = Math.floor(start * SAMPLE_RATE);
  for (let i = 0; first + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const tail = Math.exp(-t / tau);
    if (tail < 1e-4) break;
    const attack = Math.min(1, t / 0.002);
    out[first + i] += attack * tail * (Math.sin(TAU * hz * t) + 0.5 * Math.sin(TAU * 2 * hz * t) + 0.25 * Math.sin(TAU * 3 * hz * t));
  }
}

/** A plucked thread at G5. The scene plays it faster for the higher notes of the hilo scale. */
export function renderHilo() {
  const out = buffer(HILO.duration);
  pluck(out, 0, HILO.hz, HILO.tau);
  return finish(out, 0.05);
}

/** An unravelling thread: a fast run of plucks falling in pitch, a whole tone each. */
export function renderLifeLost() {
  const out = buffer(LIFE_LOST.duration);
  for (let k = 0; k < LIFE_LOST.plucks; k++) pluck(out, k * LIFE_LOST.spacing, LIFE_LOST.hz * 2 ** (-k * 2 / 12), LIFE_LOST.tau);
  return finish(out, 0.06);
}

/** The pitch of the meow at `t` seconds: up to the peak, easing in, then down to the end, easing out. */
const meowPitch = (t) => {
  if (t < MEOW.peakAt) return MEOW.start + (MEOW.peak - MEOW.start) * (t / MEOW.peakAt) ** 2;
  const u = (t - MEOW.peakAt) / (MEOW.duration - MEOW.peakAt);
  return MEOW.end + (MEOW.peak - MEOW.end) * (1 - u) ** 2;
};

/** A short meow: a bright harmonic source gliding up and down, with a formant around 1200 Hz. */
export function renderMeow() {
  const out = buffer(MEOW.duration);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const hz = meowPitch(t);
    phase += (TAU * hz) / SAMPLE_RATE;
    let sample = 0;
    for (let n = 1; n <= 8; n++) sample += ((1 + 2 * Math.exp(-(((n * hz - 1200) / 400) ** 2))) / n) * Math.sin(n * phase);
    out[i] = Math.min(1, t / MEOW.attack) * (1 - t / MEOW.duration) * sample;
  }
  return finish(out, 0.01);
}

/** A short wooden tick: a fast-decaying sine around 1.8 kHz with a 2 ms noise click at the start. */
export function renderTick() {
  const out = buffer(TICK.duration);
  const noise = noiseSource(31);
  const click = Math.floor(TICK.click * SAMPLE_RATE);
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = Math.exp(-t / TICK.tau) * Math.min(1, t / 0.0005) * Math.sin(TAU * TICK.hz * t);
    if (i < click) out[i] += 0.6 * noise() * (1 - i / click);
  }
  return finish(out, 0.01);
}
