import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, LIVES_MAX } from '../config/tuning';
import { layoutLives, LIVES_HUD } from './livesLayout';

const filled = (lives: number) => layoutLives(lives).filter((t) => t.filled).length;

describe('GDD-UI-01 lives HUD layout', () => {
  it('always shows seven triangles', () => {
    for (const lives of [0, 1, 4, 7]) expect(layoutLives(lives)).toHaveLength(LIVES_MAX);
  });

  it('fills as many triangles as there are lives', () => {
    for (let lives = 0; lives <= LIVES_MAX; lives++) expect(filled(lives)).toBe(lives);
  });

  it('empties from the right: a lost life empties the rightmost filled triangle', () => {
    const flags = layoutLives(5).map((t) => t.filled);
    expect(flags).toEqual([true, true, true, true, true, false, false]);
  });

  it('clamps out-of-range and fractional lives', () => {
    expect(filled(-3)).toBe(0);
    expect(filled(12)).toBe(7);
    expect(filled(3.9)).toBe(3);
  });

  it('sits in the top-left corner and fits well inside the 480 px screen', () => {
    const [first] = layoutLives(7);
    const last = layoutLives(7)[LIVES_MAX - 1];
    expect(first!.points[3]).toBe(LIVES_HUD.top + LIVES_HUD.height); // bottom-left y
    expect(first!.points[2]).toBe(LIVES_HUD.left); // bottom-left x
    expect(last!.points[4]).toBeLessThan(BASE_WIDTH / 3); // right edge of the last triangle
  });

  it('keeps triangles apart so outlines do not touch', () => {
    const [a, b] = layoutLives(7);
    expect(b!.points[2]).toBeGreaterThan(a!.points[4]); // next left edge is right of previous right edge
  });

  it('draws each triangle pointing up', () => {
    for (const t of layoutLives(7)) {
      const [x1, y1, x2, y2, x3, y3] = t.points;
      expect(y1).toBeLessThan(y2);
      expect(y2).toBe(y3);
      expect(x2).toBeLessThan(x1);
      expect(x1).toBeLessThan(x3);
    }
  });
});
