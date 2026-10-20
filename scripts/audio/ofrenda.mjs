// GDD-AUD-02: the ofrenda activation sound, synthesised from code so it can be tuned and regenerated.
// Two rosewood marimba bars struck in quick succession (E5, then B5). A marimba bar rings at about 1, 4 and 10 times its
// pitch. Deterministic: the same code always gives the same samples. Run `node scripts/audio/make-sfx.mjs` to encode it.

export const SAMPLE_RATE = 44100;
/** Under 1 s, as GDD-AUD-02 asks of every effect. */
export const DURATION = 0.95;
export const BARS = [
  { start: 0, hz: 659.25 },
  { start: 0.11, hz: 987.77 },
];
/** [ratio to the pitch, amplitude, decay time constant in seconds] */
const PARTIALS = [[1, 1.0, 0.28], [4.0, 0.35, 0.09], [9.9, 0.12, 0.03]];
const CLICK = { amplitude: 0.35, seconds: 0.012 };

/** Renders the sound as samples in -0.8 to 0.8. */
export function renderOfrenda() {
  const out = new Float64Array(Math.floor(DURATION * SAMPLE_RATE));
  let seed = 12345;
  const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (const { start, hz } of BARS) {
    const first = Math.floor(start * SAMPLE_RATE);
    for (const [ratio, amplitude, decay] of PARTIALS) {
      for (let i = 0; first + i < out.length; i++) {
        const t = i / SAMPLE_RATE;
        const tail = Math.exp(-t / decay);
        if (tail < 1e-4) break; // the partial has died away; the attack ramp below is 0 at t = 0 and must not end the loop
        out[first + i] += amplitude * tail * Math.min(1, t / 0.002) * Math.sin(2 * Math.PI * hz * ratio * t);
      }
    }
    // The mallet: a short burst of low-passed noise.
    let low = 0;
    const length = Math.floor(CLICK.seconds * SAMPLE_RATE);
    for (let i = 0; i < length && first + i < out.length; i++) {
      low += 0.35 * (noise() - low);
      out[first + i] += CLICK.amplitude * low * (1 - i / length);
    }
  }
  const fade = Math.floor(0.05 * SAMPLE_RATE);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  const peak = out.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  return out.map((s) => (s / peak) * 0.8);
}

/** 16-bit mono PCM WAV file bytes. */
export function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(SAMPLE_RATE, 24);
  head.writeUInt32LE(SAMPLE_RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
