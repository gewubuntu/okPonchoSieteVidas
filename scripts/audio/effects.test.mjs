import { describe, expect, it } from 'vitest';
import { renderBossDefeat, renderClaw, renderGrunt, renderHilo, renderHiss, renderJump, renderLand, renderLifeLost, renderMeow, renderStomp, renderTick } from './effects.mjs';
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
  ['tick', renderTick, 0.06],
  ['hiss', renderHiss, 0.4],
  ['grunt', renderGrunt, 0.25],
  ['boss defeat', renderBossDefeat, 0.9],
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

describe('GDD-AUD-02 tick sound', () => {
  const p = probe(renderTick());
  it('is a short tone and not only a click', () => {
    // L-011: the energy sits in a decaying tone after the first 2 ms, which fades by the end.
    expect(p.rms(0.002, 0.02)).toBeGreaterThan(0.1);
    expect(p.rms(0.002, 0.02)).toBeGreaterThan(3 * p.rms(0.05, 0.01));
    // The peak is not only in the first 2 ms: the tone itself reaches half the full level (0.8) in the 2 to 8 ms stretch.
    const tonePeak = Math.max(...Array.from(p.samples.slice(Math.floor(0.002 * SAMPLE_RATE), Math.floor(0.008 * SAMPLE_RATE)), Math.abs));
    expect(tonePeak).toBeGreaterThan(0.4);
  });
  it('is high and wooden', () => {
    const wood = Math.max(...[1600, 1800, 2000].map((hz) => p.level(hz, 0.002, 0.03)));
    expect(wood).toBeGreaterThan(0.05);
    expect(wood).toBeGreaterThan(p.level(400, 0.002, 0.03));
  });
});

/** Zero crossings a second of `samples` between `from` and `to` seconds: a noise's brightness, a tone's pitch times two. */
const crossingRate = (samples, from, to) => {
  let crossings = 0;
  for (let i = Math.floor(from * SAMPLE_RATE) + 1; i < Math.floor(to * SAMPLE_RATE); i++) if (Math.sign(samples[i]) !== Math.sign(samples[i - 1])) crossings++;
  return crossings / (to - from);
};

describe('GDD-AUD-02 hiss sound', () => {
  const p = probe(renderHiss());
  it('is noisy and high, well above the stomp', () => {
    // A band around 3 kHz crosses zero thousands of times a second; the stomp, a tone sliding from 520 to 140 Hz, about a thousand.
    const hiss = crossingRate(p.samples, 0, 0.1);
    expect(hiss).toBeGreaterThan(4000);
    expect(hiss).toBeGreaterThan(3 * crossingRate(renderStomp(), 0, 0.1));
  });
  it('has a quick attack and dies away', () => {
    expect(p.rms(0.02, 0.1)).toBeGreaterThan(5 * p.rms(0.3, 0.05));
    expect(p.rms(0, 0.002)).toBeLessThan(0.3 * p.rms(0.02, 0.1));
  });
  it('rasps at about 35 Hz: a swell about every 29 ms', () => {
    // The level in 5 ms windows peaks every 1 / 35 s = 5.7 windows; a window that is the loudest within 3 either side is a swell.
    const windows = Array.from({ length: 80 }, (_, i) => p.rms(i * 0.005, 0.005));
    const swells = windows.map((w, i) => (i >= 3 && i < 77 && windows.slice(i - 3, i + 4).every((o) => o <= w) ? i : -1)).filter((i) => i >= 0);
    expect(swells.length).toBeGreaterThanOrEqual(9);
    expect(swells.length).toBeLessThanOrEqual(14);
    const gaps = swells.slice(1).map((w, i) => w - swells[i]);
    expect(gaps.reduce((a, b) => a + b, 0) / gaps.length).toBeGreaterThan(5);
    expect(gaps.reduce((a, b) => a + b, 0) / gaps.length).toBeLessThan(7);
  });
});

describe('GDD-AUD-02 grunt sound', () => {
  const p = probe(renderGrunt());
  /** The fundamental in a stretch, from the lag at which the signal best matches itself, between 50 and 130 Hz. */
  const pitch = (from, to) => {
    const a = Math.floor(from * SAMPLE_RATE);
    const b = Math.floor(to * SAMPLE_RATE);
    let best = 0;
    let bestLag = 0;
    for (let lag = Math.floor(SAMPLE_RATE / 130); lag <= Math.floor(SAMPLE_RATE / 50); lag++) {
      let c = 0;
      for (let i = a; i + lag < b; i++) c += p.samples[i] * p.samples[i + lag];
      if (c > best) {
        best = c;
        bestLag = lag;
      }
    }
    return SAMPLE_RATE / bestLag;
  };
  it('is low: a few hundred crossings a second, not thousands', () => {
    expect(crossingRate(p.samples, 0, 0.25)).toBeLessThan(1000);
    expect(p.level(90, 0.01, 0.06)).toBeGreaterThan(3 * p.level(3000, 0.01, 0.06));
  });
  it('glides from 95 down to 70 Hz', () => {
    expect(pitch(0.01, 0.07)).toBeGreaterThan(88);
    expect(pitch(0.01, 0.07)).toBeLessThan(100);
    expect(pitch(0.17, 0.23)).toBeGreaterThan(66);
    expect(pitch(0.17, 0.23)).toBeLessThan(80);
  });
});

describe('GDD-AUD-02 boss defeat sound', () => {
  const p = probe(renderBossDefeat());
  it('gets darker: its first quarter crosses zero far more often than its last', () => {
    // The cutoff falls from 4 kHz to 300 Hz: bright noise at first (thousands of crossings a second), a low rumble at the end.
    const first = crossingRate(p.samples, 0, 0.225);
    const last = crossingRate(p.samples, 0.675, 0.9);
    expect(first).toBeGreaterThan(3000);
    expect(last).toBeLessThan(1500);
    expect(first).toBeGreaterThan(3 * last);
  });
  it('fades while it falls', () => {
    expect(p.rms(0, 0.2)).toBeGreaterThan(2 * p.rms(0.4, 0.2));
    expect(p.rms(0.4, 0.2)).toBeGreaterThan(2 * p.rms(0.7, 0.1));
  });
});
