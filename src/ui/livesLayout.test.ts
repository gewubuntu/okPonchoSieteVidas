import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, BOSS_BAR, LIVES_MAX } from '../config/tuning';
import { drawnLife, layoutLives, LIVES_HUD, outlinePoints } from './livesLayout';

/** The edges of a triangle given as six numbers, each as [from x, from y, to x, to y], and its third point. */
const edges = (p: readonly number[]) =>
  [0, 1, 2].map((i) => ({ a: [p[2 * i]!, p[2 * i + 1]!], b: [p[(2 * i + 2) % 6]!, p[(2 * i + 3) % 6]!], c: [p[(2 * i + 4) % 6]!, p[(2 * i + 5) % 6]!] }));
/** The signed distance of a point from the line through a and b, positive on the side away from c. */
const outside = (pt: number[], a: number[], b: number[], c: number[]) => {
  const [dx, dy] = [b[0]! - a[0]!, b[1]! - a[1]!];
  const side = (q: number[]) => (dx * (q[1]! - a[1]!) - dy * (q[0]! - a[0]!)) / Math.hypot(dx, dy);
  return side(pt) * -Math.sign(side(c));
};
/** Every edge of `outline` parallel to the matching edge of `triangle` and `px` outside it. */
function expectGrown(triangle: readonly number[], outline: readonly number[], px: number) {
  const inner = edges(triangle);
  edges(outline).forEach((e, i) => {
    const t = inner[i]!;
    const cross = (e.b[0]! - e.a[0]!) * (t.b[1]! - t.a[1]!) - (e.b[1]! - e.a[1]!) * (t.b[0]! - t.a[0]!);
    expect(cross, `edge ${i} parallel`).toBeCloseTo(0, 9);
    for (const q of [e.a, e.b]) expect(outside(q, t.a, t.b, t.c), `edge ${i} ${px} px outside`).toBeCloseTo(px, 9);
  });
}

describe('GDD-UI-01 a dark outline on each life', () => {
  it('GDD-UI-01 a life\'s outline is its triangle grown 1 px outward on every side', () => {
    // The boss bar's stroke colour, 1 px.
    expect(LIVES_HUD.outline).toEqual({ colour: 0x2a1f2e, px: 1 });
    expect(`#${LIVES_HUD.outline.colour.toString(16)}`).toBe(BOSS_BAR.nameStroke);
    // The first triangle: apex (13, 8), bottom left (8, 17), bottom right (18, 17).
    const first = layoutLives(7)[0]!.points;
    expect(first).toEqual([13, 8, 8, 17, 18, 17]);
    const grown = outlinePoints(first, 1);
    expectGrown(first, grown, 1);
    // Worked out by hand: the sides run 5 across for 9 down (length sqrt 106), so the apex moves up by sqrt(106) / 5 = 2.059 px, more than
    // 1 px, the base 1 px down, and its corners out to x = (67 - sqrt 106) / 9 = 6.300 and (167 + sqrt 106) / 9 = 19.700.
    const r = Math.sqrt(106);
    const expected = [13, 8 - r / 5, (67 - r) / 9, 18, (167 + r) / 9, 18];
    grown.forEach((v, i) => expect(v, `value ${i}`).toBeCloseTo(expected[i]!, 9));
    expect(8 - grown[1]).toBeCloseTo(2.059, 3);
    // Every triangle drawn at rest has it.
    for (const t of layoutLives(3)) expect(drawnLife(t, null)).toEqual({ points: [...t.points], outline: outlinePoints(t.points, 1) });
  });

  it('GDD-UI-01 a life\'s outline: the pulsing triangle\'s outline grows with it', () => {
    const [first] = layoutLives(1);
    const rest = drawnLife(first!, null);
    for (const scale of [1.2, 1.4]) {
      const pulsing = drawnLife(first!, scale);
      // The drawn triangle grew, and its outline is 1 px outside it, not outside the triangle at rest.
      expectGrown(pulsing.points, pulsing.outline, 1);
      expect(pulsing.outline[1], `apex at ${scale}`).toBeLessThan(rest.outline[1]);
      expect(pulsing.outline[3], `base at ${scale}`).toBeGreaterThan(rest.outline[3]);
    }
  });
});

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
