import { describe, expect, it } from 'vitest';
import { BARS, DURATION, SAMPLE_RATE, renderOfrenda, toWav } from './ofrenda.mjs';

const samples = renderOfrenda();
/** Energy of one frequency in a stretch of samples (Goertzel), as an amplitude. */
const level = (hz, from, seconds) => {
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
};
const rms = (from, seconds) => {
  const a = Math.floor(from * SAMPLE_RATE);
  const n = Math.floor(seconds * SAMPLE_RATE);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[a + i] ** 2;
  return Math.sqrt(sum / n);
};

describe('GDD-AUD-02 ofrenda sound', () => {
  it('is under one second long', () => {
    expect(samples.length / SAMPLE_RATE).toBe(DURATION);
    expect(DURATION).toBeLessThan(1);
  });

  it('rings, not just clicks: there is sound well after the strike and it fades away', () => {
    expect(rms(0.2, 0.05)).toBeGreaterThan(0.03);
    expect(rms(0.6, 0.05)).toBeLessThan(rms(0.2, 0.05));
    expect(rms(0.6, 0.05)).toBeGreaterThan(0.005);
  });

  it('plays E5, then B5 about 0.11 s later', () => {
    // The pitches and the timing are written out here, from GDD-AUD-02, not read back from the module under test.
    const E5 = 659.25;
    const B5 = 987.77;
    expect(BARS.map((b) => b.hz)).toEqual([E5, B5]);
    expect(level(E5, 0.03, 0.07)).toBeGreaterThan(0.1); // first bar, before the second is struck
    expect(level(B5, 0.03, 0.07)).toBeLessThan(0.02); // no second bar yet
    expect(level(B5, 0.14, 0.07)).toBeGreaterThan(0.1); // second bar is already ringing
    expect(level(E5, 0.14, 0.07)).toBeGreaterThan(0.02); // and the first is still sounding underneath
  });

  it('ends in silence, so playback does not click at the end', () => {
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(1e-3);
    expect(rms(DURATION - 0.01, 0.01)).toBeLessThan(0.01);
  });

  it('stays within range and is deterministic', () => {
    expect(samples.every((s) => Math.abs(s) <= 0.8 + 1e-9)).toBe(true);
    expect(toWav(renderOfrenda()).equals(toWav(samples))).toBe(true);
  });

  it('writes a valid mono 16-bit WAV', () => {
    const bytes = toWav(samples);
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(bytes.readUInt16LE(22)).toBe(1);
    expect(bytes.length).toBe(44 + samples.length * 2);
  });
});
