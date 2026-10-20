import { describe, expect, it } from 'vitest';
import { LIFE_LOSS } from '../config/tuning';
import { crackFrame, crackLine, updateCracks, type Crack } from './lifeCrack';
import { layoutLives } from './livesLayout';

describe('GDD-LIFE-02 life loss crack on the HUD', () => {
  it('takes 0.4 s, which is 24 steps', () => {
    expect(LIFE_LOSS.crackSteps).toBe(24);
  });

  it('starts a crack on the triangle that was just lost', () => {
    expect(updateCracks([], 7, 6, 100)).toEqual([{ index: 6, start: 100 }]);
    expect(updateCracks([], 5, 4, 10)).toEqual([{ index: 4, start: 10 }]);
  });

  it('cracks every triangle lost at once, and none when lives stay or go up', () => {
    expect(updateCracks([], 7, 4, 0).map((c) => c.index)).toEqual([4, 5, 6]);
    expect(updateCracks([], 5, 5, 0)).toEqual([]);
    expect(updateCracks([], 3, 5, 0)).toEqual([]);
  });

  it('does not crack a triangle on a restart that refills all seven', () => {
    expect(updateCracks([], 0, 7, 0)).toEqual([]);
  });

  it('keeps a running crack and drops it once it is done', () => {
    const crack: Crack = { index: 6, start: 100 };
    expect(updateCracks([crack], 6, 6, 100 + LIFE_LOSS.crackSteps - 1)).toEqual([crack]);
    expect(updateCracks([crack], 6, 6, 100 + LIFE_LOSS.crackSteps)).toEqual([]);
  });

  it('drops a crack on a triangle that is filled again, for example by an ofrenda', () => {
    const crack: Crack = { index: 6, start: 100 };
    expect(updateCracks([crack], 6, 7, 105)).toEqual([]);
  });

  it('fades the fill from fully drawn to gone while the crack shows and then fades too', () => {
    const crack: Crack = { index: 0, start: 0 };
    const frames = Array.from({ length: LIFE_LOSS.crackSteps }, (_, step) => crackFrame(crack, step)!);
    expect(frames[0]).toEqual({ fillAlpha: 1, crackAlpha: 0 });
    for (let i = 1; i < frames.length; i++) expect(frames[i]!.fillAlpha).toBeLessThan(frames[i - 1]!.fillAlpha);
    expect(frames.at(-1)!.fillAlpha).toBeGreaterThan(0);
    expect(frames.at(-1)!.fillAlpha).toBeLessThan(0.1);
    // the crack is clearly visible somewhere in the first half and almost gone at the end
    expect(Math.max(...frames.slice(0, 12).map((f) => f.crackAlpha))).toBeGreaterThan(0.95); // steps are whole, so the peak is just under 1
    expect(frames.at(-1)!.crackAlpha).toBeLessThan(0.1);
    for (const f of frames) {
      expect(f.fillAlpha).toBeGreaterThanOrEqual(0);
      expect(f.fillAlpha).toBeLessThanOrEqual(1);
      expect(f.crackAlpha).toBeGreaterThanOrEqual(0);
      expect(f.crackAlpha).toBeLessThanOrEqual(1);
    }
  });

  it('has no frame before the crack starts or after it ends', () => {
    const crack: Crack = { index: 0, start: 50 };
    expect(crackFrame(crack, 49)).toBeNull();
    expect(crackFrame(crack, 50 + LIFE_LOSS.crackSteps)).toBeNull();
  });

  it('draws the crack line inside the triangle, from the apex to the base', () => {
    for (const t of layoutLives(7)) {
      const line = crackLine(t);
      const [ax, ay, bx, by, cx, cy] = t.points;
      expect(line[0]).toBe(ax); // starts at the apex
      expect(line[1]).toBe(ay);
      expect(line.at(-1)).toBe(by); // ends on the base
      for (let i = 0; i < line.length; i += 2) {
        const [x, y] = [line[i]!, line[i + 1]!];
        expect(y).toBeGreaterThanOrEqual(ay);
        expect(y).toBeLessThanOrEqual(cy);
        // between the left edge and the right edge at that height
        const half = ((y - ay) / (by - ay)) * ((cx - bx) / 2);
        expect(x).toBeGreaterThanOrEqual(ax - half - 1e-9);
        expect(x).toBeLessThanOrEqual(ax + half + 1e-9);
      }
    }
  });
});
