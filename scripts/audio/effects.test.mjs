import { describe, expect, it } from 'vitest';
import { renderClaw, renderHilo, renderJump, renderLand, renderLifeLost, renderMeow, renderStomp } from './effects.mjs';
import { SAMPLE_RATE, toWav } from './ofrenda.mjs';

/** Measures a rendered sound. `level` is the energy of one frequency in a stretch (Goertzel), as an amplitude. */
const probe = (samples) => ({
  samples,
  level(hz, from, seconds) {
    const a = Math.floor(from * SAMPLE_RATE);
    const n = Math.floor(seconds * SAMPLE_RATE);
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const w = (2 * Math.PI * hz * i) / SAMPLE_RATE;
      re += samples[a + i] * Math.cos(w);
      im += samples[a + i] * Math.sin(w);
    }
    return (2 * Math.hypot(re, im)) / n;
  },
  rms(from, seconds) {
    const a = Math.floor(from * SAMPLE_RATE);
    const n = Math.floor(seconds * SAMPLE_RATE);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += samples[a + i] ** 2;
    return Math.sqrt(sum / n);
  },
});

// The durations are written out from GDD-AUD-02, not read back from the module under test.
const sounds = [
  ['jump', renderJump, 0.15],
  ['land', renderLand, 0.12],
  ['claw', renderClaw, 0.18],
  ['stomp', renderStomp, 0.2],
  ['hilo', renderHilo, 0.3],
  ['life lost', renderLifeLost, 0.85],
  ['meow', renderMeow, 0.5],
];

for (const [name, render, seconds] of sounds) {
  describe(`GDD-AUD-02 ${name} sound`, () => {
    const p = probe(render());

    it('is under one second long', () => {
      expect(p.samples.length / SAMPLE_RATE).toBeCloseTo(seconds, 3);
      expect(p.samples.length).toBe(Math.floor(seconds * SAMPLE_RATE));
      expect(p.samples.length / SAMPLE_RATE).toBeLessThan(1);
    });

    it('is not silent', () => {
      expect(p.rms(0, seconds / 3)).toBeGreaterThan(0.05);
    });

    it('ends in silence, so playback does not click at the end', () => {
      expect(Math.abs(p.samples[p.samples.length - 1])).toBeLessThan(1e-3);
    });

    it('stays within range and is deterministic', () => {
      expect(p.samples.every((s) => Math.abs(s) <= 0.8 + 1e-9)).toBe(true);
      expect(toWav(render()).equals(toWav(p.samples))).toBe(true);
    });
  });
}

describe('GDD-AUD-02 jump sound', () => {
  const p = probe(renderJump());
  it('rises in pitch', () => {
    // A chirp from low to high: 400 Hz is heard early and not late, 800 Hz the other way round.
    expect(p.level(400, 0, 0.04)).toBeGreaterThan(p.level(400, 0.09, 0.04));
    expect(p.level(800, 0.09, 0.04)).toBeGreaterThan(p.level(800, 0, 0.04));
  });
});

describe('GDD-AUD-02 land sound', () => {
  const p = probe(renderLand());
  it('is low', () => {
    expect(p.level(110, 0.01, 0.04)).toBeGreaterThan(0.1);
    expect(p.level(3000, 0.01, 0.04)).toBeLessThan(p.level(110, 0.01, 0.04));
  });
});

describe('GDD-AUD-02 claw sound', () => {
  const p = probe(renderClaw());
  it('is noisy and high', () => {
    let crossings = 0;
    const n = Math.floor(0.1 * SAMPLE_RATE);
    for (let i = 1; i < n; i++) if (Math.sign(p.samples[i]) !== Math.sign(p.samples[i - 1])) crossings++;
    expect(crossings / 0.1).toBeGreaterThan(4000);
  });
});

describe('GDD-AUD-02 stomp sound', () => {
  const p = probe(renderStomp());
  it('falls in pitch', () => {
    expect(p.level(500, 0, 0.04)).toBeGreaterThan(p.level(500, 0.12, 0.05));
    expect(p.level(150, 0.12, 0.05)).toBeGreaterThan(p.level(150, 0, 0.04));
  });
});

describe('GDD-AUD-02 hilo pickup sound', () => {
  const p = probe(renderHilo());
  it('plays G5', () => {
    const g5 = p.level(783.99, 0.01, 0.07);
    expect(g5).toBeGreaterThan(0.2);
    expect(g5).toBeGreaterThan(p.level(659.25, 0.01, 0.07));
    expect(g5).toBeGreaterThan(p.level(880, 0.01, 0.07));
  });
});

describe('GDD-AUD-02 life lost sound', () => {
  const p = probe(renderLifeLost());
  it('falls in pitch, in separate plucks', () => {
    expect(p.level(659.25, 0, 0.07)).toBeGreaterThan(p.level(659.25, 0.6, 0.07));
    // The ninth pluck (0.64 s) is eight whole tones below the first, C4: it is heard late and not early.
    expect(p.level(261.63, 0.64, 0.07)).toBeGreaterThan(p.level(261.63, 0, 0.07));
    // The level in 10 ms windows: a pluck every 0.08 s is a peak with a dip either side of it.
    const windows = Array.from({ length: 85 }, (_, i) => p.rms(i * 0.01, 0.01));
    const peaks = windows.filter((w, i) => i >= 3 && i < 82 && windows.slice(i - 3, i + 4).every((o) => o <= w));
    expect(peaks.length).toBeGreaterThanOrEqual(8);
    expect(p.rms(0.6, 0.05)).toBeGreaterThan(0.01);
  });
});

describe('GDD-AUD-02 meow sound', () => {
  const p = probe(renderMeow());
  /** Which of the three pitches is strongest in a stretch. */
  const strongest = (from, seconds) => {
    const levels = [450, 700, 380].map((hz) => p.level(hz, from, seconds));
    return [450, 700, 380][levels.indexOf(Math.max(...levels))];
  };
  it('glides up then down', () => {
    expect(strongest(0, 0.05)).toBe(450);
    expect(strongest(0.12, 0.06)).toBe(700);
    expect(strongest(0.42, 0.05)).toBe(380);
  });
});
