import { describe, expect, it } from 'vitest';
import { lastLifePulse, pulsedPoints, updatePulseStart } from './lastLife';
import { layoutLives } from './livesLayout';

const centre = (q: readonly number[]) => [(q[0]! + q[2]! + q[4]!) / 3, (q[1]! + q[3]! + q[5]!) / 3];

describe('GDD-LIFE-04 the last triangle pulses', () => {
  it('only when exactly one life is left', () => {
    expect(lastLifePulse(1, 24)).not.toBeNull();
    for (const lives of [0, 2, 3, 7]) expect(lastLifePulse(lives, 24), `lives ${lives}`).toBeNull();
  });

  it('grows from 1.0x to 1.4x and back over 0.8 s (48 steps), counted in simulation steps from when the lives dropped to one', () => {
    expect(lastLifePulse(1, 0)).toBeCloseTo(1, 9);
    expect(lastLifePulse(1, 12)).toBeCloseTo(1.2, 9); // a quarter of the way: halfway up
    expect(lastLifePulse(1, 24)).toBeCloseTo(1.4, 9); // the peak, half way through
    expect(lastLifePulse(1, 36)).toBeCloseTo(1.2, 9);
    expect(lastLifePulse(1, 48)).toBeCloseTo(1, 9); // and again
    expect(lastLifePulse(1, 48 + 24)).toBeCloseTo(1.4, 9);
    for (let t = 0; t < 96; t++) {
      const s = lastLifePulse(1, t)!;
      expect(s).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(s).toBeLessThanOrEqual(1.4 + 1e-9);
    }
  });

  it('scales the first (leftmost) triangle about its centre, so it stays in its place', () => {
    const [first] = layoutLives(1);
    const p = pulsedPoints(first!, 1.4);
    expect(centre(p)[0]).toBeCloseTo(centre(first!.points)[0]!, 9);
    expect(centre(p)[1]).toBeCloseTo(centre(first!.points)[1]!, 9);
    expect(p[4]! - p[2]!).toBeCloseTo(14, 9); // 10 px wide becomes 14
    expect(pulsedPoints(first!, 1)).toEqual([...first!.points]);
  });
});

describe('GDD-LIFE-04 every drop to one life starts a fresh pulse', () => {
  it('starts on the step the lives drop to one and keeps that start while one is left', () => {
    let start = updatePulseStart(null, 2, 100);
    expect(start).toBeNull();
    start = updatePulseStart(start, 1, 101);
    expect(start).toBe(101);
    expect(updatePulseStart(start, 1, 160)).toBe(101);
  });

  it('a life back (1 -> 2 -> 1) restarts it, so the second drop starts at the normal size too', () => {
    let start = updatePulseStart(null, 1, 10);
    start = updatePulseStart(start, 2, 40); // an ofrenda or veladora
    expect(start).toBeNull();
    start = updatePulseStart(start, 1, 70); // hit again
    expect(start).toBe(70);
    expect(lastLifePulse(1, 70 - start!)).toBe(1);
  });

  it('out of lives and restarted (1 -> 0 -> 7 -> ... -> 1) it starts fresh as well', () => {
    let start = updatePulseStart(null, 1, 5);
    start = updatePulseStart(start, 0, 30);
    expect(start).toBeNull();
    start = updatePulseStart(start, 7, 200);
    start = updatePulseStart(start, 1, 400);
    expect(start).toBe(400);
  });
});
