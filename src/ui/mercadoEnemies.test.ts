import { describe, expect, it } from 'vitest';
import { CHAPULIN, PALOMA, TROMPO } from '../config/tuning';
import type { EnemyState } from '../sim/enemy';
import type { Hop } from '../sim/chapulin';
import type { Wing } from '../sim/paloma';
import type { Spin } from '../sim/trompo';
import { chapulinShapes, COLOURS, palomaShapes, trompoShapes, type Shape } from './mercadoEnemies';

const X = 100;
const FEET = 160;
const paloma = (w: Partial<Wing>, dir: 1 | -1 = 1): EnemyState => ({ x: X, dir, alive: true, wing: { phase: 'walk', age: 0, lift: 0, ...w } });
const chapulin = (h: Partial<Hop>, dir: 1 | -1 = 1): EnemyState => ({ x: X, y: FEET, dir, alive: true, hop: { phase: 'crouch', age: 0, vy: 0, ...h } });
const trompo = (s: Spin, dir: 1 | -1 = 1): EnemyState => ({ x: X, dir, alive: true, spin: s });

/** The corners a shape covers. */
const xs = (s: Shape): number[] => ('rect' in s ? [s.rect[0], s.rect[0] + s.rect[2]] : [s.tri[0], s.tri[2], s.tri[4]]);
const ys = (s: Shape): number[] => ('rect' in s ? [s.rect[1], s.rect[1] + s.rect[3]] : [s.tri[1], s.tri[3], s.tri[5]]);
const bounds = (shapes: readonly Shape[]) => ({
  x0: Math.min(...shapes.flatMap(xs)),
  x1: Math.max(...shapes.flatMap(xs)),
  y0: Math.min(...shapes.flatMap(ys)),
  y1: Math.max(...shapes.flatMap(ys)),
});
const coloured = (shapes: readonly Shape[], colour: number): Shape[] => shapes.filter((s) => s.colour === colour);
const red = (shapes: readonly Shape[]): boolean => coloured(shapes, COLOURS.telegraph).length > 0;
/** The x of the Paloma's teal neck, on the side of its head. */
const neck = (shapes: Shape[]): number[] => coloured(shapes, COLOURS.teal).flatMap(xs);
/** The left edge of a stunned Trompo's drawing at `age` steps into its stun. */
const lyingAt = (age: number): number => bounds(trompoShapes(trompo({ phase: 'stunned', age }), FEET)).x0;
/** The left edge of the lit patch on a spinning Trompo's crown at `age`. */
const litAt = (age: number): number => coloured(trompoShapes(trompo({ phase: 'spin', age }), FEET), COLOURS.tejaLit).flatMap(xs)[0]!;

/** Every pose of each enemy, with its box (width, height) and the y of the box's bottom. */
const poses: { name: string; shapes: Shape[]; w: number; h: number; bottom: number }[] = [
  ...(['walk', 'telegraph', 'rise', 'hover', 'descend'] as const).flatMap((phase) =>
    [0, 4, 15, 20].map((age) => ({ name: `paloma ${phase} ${age}`, shapes: palomaShapes(paloma({ phase, age }), FEET), w: PALOMA.width, h: PALOMA.height, bottom: FEET })),
  ),
  ...(['crouch', 'air'] as const).flatMap((phase) => [0, 10, 33].map((age) => ({ name: `chapulin ${phase} ${age}`, shapes: chapulinShapes(chapulin({ phase, age }), FEET), w: CHAPULIN.width, h: CHAPULIN.height, bottom: FEET }))),
  ...(['spin', 'stunned'] as const).flatMap((phase) => [0, 31, 45].map((age) => ({ name: `trompo ${phase} ${age}`, shapes: trompoShapes(trompo({ phase, age }), FEET), w: TROMPO.width, h: TROMPO.height, bottom: FEET }))),
];

describe('GDD-ENM-03 World 2 enemy placeholders', () => {
  it('each pose stays within 2 px of its box on every side (design: the drawing may overhang its box by up to 2 px)', () => {
    for (const p of poses) {
      const b = bounds(p.shapes);
      expect(b.x0, p.name).toBeGreaterThanOrEqual(X - p.w / 2 - 2);
      expect(b.x1, p.name).toBeLessThanOrEqual(X + p.w / 2 + 2);
      expect(b.y0, p.name).toBeGreaterThanOrEqual(p.bottom - p.h - 2);
      expect(b.y1, p.name).toBeLessThanOrEqual(p.bottom + 2);
    }
  });

  it('each is outlined in the shared outline colour', () => {
    for (const p of poses) expect(coloured(p.shapes, COLOURS.outline).length, p.name).toBeGreaterThan(0);
  });

  it('faces the way it moves: drawn facing right and mirrored for left', () => {
    expect(Math.min(...neck(palomaShapes(paloma({}), FEET)))).toBeGreaterThan(X);
    expect(Math.max(...neck(palomaShapes(paloma({}, -1), FEET)))).toBeLessThan(X);
    const right = bounds(chapulinShapes(chapulin({}), FEET));
    const left = bounds(chapulinShapes(chapulin({}, -1), FEET));
    expect(left.x0).toBeCloseTo(2 * X - right.x1, 9);
    expect(left.x1).toBeCloseTo(2 * X - right.x0, 9);
  });

  it('a flying Paloma is drawn where it has flown to, and bobs 2 px while it hovers', () => {
    expect(bounds(palomaShapes(paloma({ phase: 'hover', age: 0, lift: 40 }), FEET - 40)).y1).toBeLessThanOrEqual(FEET - 40 + 2);
    const still = bounds(palomaShapes(paloma({ phase: 'hover', age: 0 }), FEET));
    const bobbed = bounds(palomaShapes(paloma({ phase: 'hover', age: 15 }), FEET));
    expect(bobbed.y0 - still.y0).toBe(PALOMA.bobPx);
  });
});

describe('GDD-ENM-01 the telegraph flashes red', () => {
  it('a Paloma flashes red through its telegraph, 4 steps on and 4 off, and never otherwise', () => {
    expect([0, 3, 4, 7, 8, 29].map((age) => red(palomaShapes(paloma({ phase: 'telegraph', age }), FEET)))).toEqual([true, true, false, false, true, false]);
    for (const phase of ['walk', 'rise', 'hover', 'descend'] as const) expect(red(palomaShapes(paloma({ phase, age: 0 }), FEET)), phase).toBe(false);
  });

  it('a telegraphing Paloma puffs up wider and raises its wings', () => {
    const walking = palomaShapes(paloma({ phase: 'walk' }), FEET);
    const puffed = palomaShapes(paloma({ phase: 'telegraph', age: 4 }), FEET);
    expect(bounds(puffed).x0).toBeLessThan(bounds(walking).x0);
    expect(bounds(coloured(puffed, COLOURS.farShade)).y0).toBeLessThan(bounds(coloured(walking, COLOURS.farShade)).y0);
  });

  it('a Chapulín flashes red in the last 0.5 s (30 steps) of its 0.6 s crouch, 4 steps on and 4 off', () => {
    expect([0, 5, 6, 9, 10, 13, 14, 35].map((age) => red(chapulinShapes(chapulin({ phase: 'crouch', age }), FEET)))).toEqual([false, false, true, true, false, false, true, false]);
    expect(red(chapulinShapes(chapulin({ phase: 'air', age: 6 }), FEET))).toBe(false);
  });

  it('a Chapulín crouches low and stretches up in the air', () => {
    expect(bounds(chapulinShapes(chapulin({ phase: 'crouch' }), FEET)).y0).toBeGreaterThan(bounds(chapulinShapes(chapulin({ phase: 'air' }), FEET)).y0);
  });
});

describe('GDD-CMB-01 the not-stompable mark on World 2 enemies', () => {
  it('a spinning Trompo has exactly three pale points, 2 x 3 px, evenly spaced along its top edge', () => {
    for (const age of [0, 5, 11]) {
      const shapes = trompoShapes(trompo({ phase: 'spin', age }), FEET);
      const points = coloured(shapes, COLOURS.glaze);
      expect(points).toHaveLength(3);
      const top = Math.min(...shapes.filter((s) => s.colour !== COLOURS.glaze).flatMap(ys));
      const apexes = points.map((p) => {
        if (!('tri' in p)) throw new Error('a pale point is a triangle');
        const [ax, ay, bx, by, cx, cy] = p.tri;
        expect(Math.max(ax, bx, cx) - Math.min(ax, bx, cx)).toBe(2);
        expect(Math.max(ay, by, cy) - Math.min(ay, by, cy)).toBe(3);
        expect(Math.max(ay, by, cy)).toBeCloseTo(top + 0.5, 9); // their base on the crown, under its 0.5 px outline
        return cx;
      });
      expect(apexes[1]! - apexes[0]!).toBe(apexes[2]! - apexes[1]!);
    }
  });

  it('a stunned Trompo, which a stomp defeats, has no mark; nor have the stompable Paloma and Chapulín in any pose', () => {
    for (const p of poses.filter((q) => !q.name.startsWith('trompo spin'))) expect(coloured(p.shapes, COLOURS.glaze), p.name).toEqual([]);
  });
});

describe('GDD-ENM-03 and GDD-CMB-02 the stunned Trompo', () => {
  it('lies on its side: wider than tall', () => {
    const b = bounds(trompoShapes(trompo({ phase: 'stunned', age: 0 }), FEET));
    expect(b.x1 - b.x0).toBeGreaterThan(b.y1 - b.y0);
    const up = bounds(trompoShapes(trompo({ phase: 'spin', age: 0 }), FEET));
    expect(up.y1 - up.y0).toBeGreaterThan(b.y1 - b.y0);
  });

  it('lies still until its last 0.5 s, then wobbles 1 px every 4 steps', () => {
    const before = [0, 4, 8, 29].map(lyingAt);
    expect(new Set(before).size).toBe(1);
    expect([30, 32, 34, 36, 40].map(lyingAt).map((x) => x - before[0]!)).toEqual([0, 1, 1, 0, 1]);
  });

  it('spinning, a lit patch runs round its crown', () => {
    expect(new Set([0, 3, 6, 9].map(litAt)).size).toBe(4);
  });
});

// CIE L* of an sRGB colour, as the art guide measures it (GDD-ART-03).
const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lightness = (c: number) => {
  const [r, g, b] = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => lin(v / 255));
  const y = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
};

describe('GDD-ART-06 the World 2 enemies read against the walls', () => {
  it('GDD-ART-06 the Chapulín body is at least 15 L* from the pink wall', () => {
    expect(Math.abs(lightness(COLOURS.leaf) - lightness(0xe07f8e))).toBeGreaterThanOrEqual(15);
  });
});
