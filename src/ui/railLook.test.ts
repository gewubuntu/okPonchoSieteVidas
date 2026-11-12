import { describe, expect, it } from 'vitest';
import { CART, TILE } from '../config/tuning';
import { LAB_3C_LEVEL, LAB_3C_RAILS } from '../levels/lab3c';
import { railLength, type CartState, type Rail } from '../sim/cart';
import { parseTiles } from '../sim/tilemap';
import { cartLook, railLook, type RailImage } from './railLook';

// GDD-WLD-15, GDD-ART-06: what the scene draws for lab-3c's six rails (`src/levels/lab3c.ts`), and a fixture over a pit. The floor's top is
// y = 224; a rail tile's frame (16 x 24) goes 20 px over the lower of its two grounds, a level bent's 2 px under its ground (the stringer's
// underside), a sloped one's 13 px over its lower ground.
const LOOK = railLook(LAB_3C_LEVEL.world, LAB_3C_RAILS, 17);
const of = (rail: number, part: RailImage['part']) => LOOK.filter((im) => im.rail === rail && im.part === part);
const cols = (ims: readonly RailImage[]) => ims.map((im) => im.x / TILE);
const FLOOR = 224;

describe('GDD-ART-06 the railway as drawn (railLook)', () => {
  it('GDD-ART-06 every rail tile has its frame: level, slope up and slope down, at its place, also at each join', () => {
    expect(LOOK.filter((im) => im.part === 'rail')).toHaveLength(20 + 12 + 9 + 8 + 20 + 12);
    // R1: 20 level tiles on the floor, columns 5 to 24.
    expect(of(0, 'rail').map((im) => [im.frame, im.x / TILE, im.y, im.flip])).toEqual(Array.from({ length: 20 }, (_, i) => ['level', 5 + i, FLOOR - 20, false]));
    // R2: 4 level from column 27, 4 up (each tile's lower ground 224, 208, 192, 176), 4 level on the plateau (ground 160).
    expect(of(1, 'rail').map((im) => [im.frame, im.x / TILE, im.y])).toEqual([
      ...[27, 28, 29, 30].map((c) => ['level', c, FLOOR - 20]),
      ['slopeUp', 31, 224 - 20], ['slopeUp', 32, 208 - 20], ['slopeUp', 33, 192 - 20], ['slopeUp', 34, 176 - 20],
      ...[35, 36, 37, 38].map((c) => ['level', c, 160 - 20]),
    ]);
    // R3: 2 level on the plateau from column 41, 4 down (lower grounds 176 to 224), 3 level on the floor.
    expect(of(2, 'rail').map((im) => [im.frame, im.x / TILE, im.y])).toEqual([
      ['level', 41, 140], ['level', 42, 140],
      ['slopeDown', 43, 176 - 20], ['slopeDown', 44, 192 - 20], ['slopeDown', 45, 208 - 20], ['slopeDown', 46, 224 - 20],
      ['level', 47, 204], ['level', 48, 204], ['level', 49, 204],
    ]);
    // R4 rolls left from column 58's right edge: 8 level tiles, columns 58 down to 51.
    expect(cols(of(3, 'rail'))).toEqual([58, 57, 56, 55, 54, 53, 52, 51]);
    expect(of(3, 'rail').every((im) => im.frame === 'level')).toBe(true);
  });

  it('GDD-ART-06 a rolling-left climb is drawn with the slope down frame, a rolling-left descent with the slope up frame', () => {
    const world = parseTiles(Array.from({ length: 10 }, (_, r) => (r >= 8 ? '#'.repeat(20) : '.'.repeat(20))));
    const left: Rail = { x: 10 * TILE, y: 128, dir: -1, segments: [{ kind: 'climb', tiles: 1 }, { kind: 'descent', tiles: 1 }], end: 'buffer' };
    expect(railLook(world, [left], 10).filter((im) => im.part === 'rail').map((im) => [im.frame, im.x / TILE, im.y])).toEqual([['slopeDown', 9, 128 - 20], ['slopeUp', 8, 128 - 20]]);
  });

  it('GDD-ART-06 a broken rail\'s last tile is its broken end, one per broken end, facing the way it rolls', () => {
    const broken = LOOK.filter((im) => im.frame === 'broken');
    expect(broken.map((im) => [im.rail, im.x / TILE, im.y, im.flip])).toEqual([[4, 81, 204, false], [5, 102, 204, false]]);
    for (const r of [4, 5]) expect(of(r, 'rail').at(-1)!.frame).toBe('broken');
    const world = parseTiles(Array.from({ length: 10 }, (_, r) => (r >= 8 ? '#'.repeat(40) : '.'.repeat(40))));
    const left: Rail = { x: 30 * TILE, y: 128, dir: -1, segments: [{ kind: 'level', tiles: 12 }], end: 'broken' };
    expect(railLook(world, [left], 10).filter((im) => im.frame === 'broken').map((im) => [im.x / TILE, im.flip])).toEqual([[18, true]]);
  });

  it('GDD-ART-06 a warning post stands 6 tiles before each broken end, and a buffer at each buffer end', () => {
    // The post's frame is 8 x 24, its pole's foot on the rail's ground at its middle.
    const posts = LOOK.filter((im) => im.part === 'post');
    const ends = [4, 5].map((r) => LAB_3C_RAILS[r]!.x + railLength(LAB_3C_RAILS[r]!));
    expect(posts.map((im) => [im.rail, im.x + 4, im.y + 24])).toEqual(ends.map((end, i) => [4 + i, end - CART.postTiles * TILE, FLOOR]));
    // A buffer, 16 x 16, on the ground past the rail's end, its plate toward the cart (mirrored for R4, which rolls left).
    const buffers = LOOK.filter((im) => im.part === 'buffer');
    expect(buffers.map((im) => [im.rail, im.x, im.y + 16, im.flip])).toEqual([[0, 25 * TILE, FLOOR, false], [1, 39 * TILE, 160, false], [2, 50 * TILE, FLOOR, false], [3, 50 * TILE, FLOOR, true]]);
  });

  it('GDD-ART-06 a trestle under every rail tile with no ground under it: a stringer, and a bent every 32 px down to the ground', () => {
    // R1 crosses its three notches (one tile each, the floor 1 tile down): a stringer and a bent in each, 14 px tall from the stringer's
    // underside (226) to the notch's floor (240).
    expect(cols(of(0, 'stringer'))).toEqual([14, 18, 22]);
    expect(of(0, 'bent').map((im) => [im.frame, im.x / TILE, im.y, im.height])).toEqual([14, 18, 22].map((c) => ['bentLevel', c, 226, 14]));
    // R2's climb and R3's descent lie over air: a stringer under each of their 4 tiles, a bent under the first and third, each down to the
    // floor (224): R2's 13 and 45 px tall from 211 and 179, R3's 61 and 29 from 163 and 195, the rest of a tall bent its legs.
    expect(of(1, 'stringer').map((im) => [im.frame, im.x / TILE])).toEqual([31, 32, 33, 34].map((c) => ['stringerUp', c]));
    expect(of(2, 'stringer').map((im) => [im.frame, im.x / TILE])).toEqual([43, 44, 45, 46].map((c) => ['stringerDown', c]));
    expect(of(1, 'bent').map((im) => [im.frame, im.x / TILE, im.y, im.height])).toEqual([['bentUp', 31, 211, 13], ['bentUp', 33, 179, 24]]);
    expect(of(1, 'leg').map((im) => [im.x / TILE, im.y, im.height])).toEqual([[33, 203, 21]]);
    expect(of(2, 'bent').map((im) => [im.frame, im.x / TILE, im.y, im.height])).toEqual([['bentDown', 43, 163, 24], ['bentDown', 45, 195, 24]]);
    expect(of(2, 'leg').map((im) => [im.x / TILE, im.y, im.height])).toEqual([[43, 187, 24], [43, 211, 13], [45, 219, 5]]);
    // Bents 32 px apart along a trestle, none over ground: R4, R5 and R6 lie on the floor all along.
    for (const r of [1, 2]) expect(of(r, 'bent').map((im) => im.x).reduce((d, x, i, xs) => (i ? Math.max(d, x - xs[i - 1]!) : d), 0)).toBe(32);
    for (const r of [3, 4, 5]) expect([of(r, 'stringer'), of(r, 'bent'), of(r, 'leg')].flat()).toEqual([]);
    expect(LOOK.filter((im) => im.part === 'bent')).toHaveLength(7);
  });

  it('GDD-ART-06 over a pit open to the level\'s bottom the bents reach the bottom', () => {
    // A level 12 rows tall (bottom y = 192), floor at row 8, a pit at columns 10 to 14; a level rail on the floor from column 6 to 17 crosses it.
    const world = parseTiles(Array.from({ length: 12 }, (_, r) => Array.from({ length: 24 }, (_t, c) => (r >= 8 && (c < 10 || c > 14) ? '#' : '.')).join('')));
    const rail: Rail = { x: 6 * TILE, y: 128, dir: 1, segments: [{ kind: 'level', tiles: 12 }], end: 'buffer' };
    const look = railLook(world, [rail], 12);
    expect(cols(look.filter((im) => im.part === 'stringer'))).toEqual([10, 11, 12, 13, 14]);
    expect(look.filter((im) => im.part === 'bent').map((im) => [im.x / TILE, im.y, im.height])).toEqual([[10, 130, 24], [12, 130, 24], [14, 130, 24]]);
    // Each from 130 down to 192: its top (24) and legs of 24 and 14 px.
    for (const c of [10, 12, 14]) expect(look.filter((im) => im.part === 'leg' && im.x / TILE === c).map((im) => [im.y, im.height])).toEqual([[154, 24], [178, 14]]);
    expect(look.filter((im) => im.part === 'buffer').map((im) => im.x / TILE)).toEqual([18]);
  });
});

const at = (phase: CartState['phase']): CartState => ({ phase, m: 40 });

describe('GDD-ART-06 the cart\'s look (cartLook)', () => {
  it('GDD-ART-06 a waiting cart stands with its chock; a rolling one shows rolling 0 and 1 by turns, 4 steps each', () => {
    expect(cartLook(at('waiting'), 7, 'rolling1')).toBe('standing');
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((clock) => cartLook(at('rolling'), clock, 'standing'))).toEqual([
      'rolling0', 'rolling0', 'rolling0', 'rolling0', 'rolling1', 'rolling1', 'rolling1', 'rolling1', 'rolling0',
    ]);
  });

  it('GDD-ART-06 a cart falling off a broken end, or stopped at its buffer, keeps the last frame it rolled with', () => {
    for (const last of ['rolling0', 'rolling1'] as const) {
      expect(cartLook(at('falling'), 100, last)).toBe(last);
      expect(cartLook(at('stopped'), 100, last)).toBe(last);
    }
    expect(cartLook(at('gone'), 100, 'rolling0')).toBeNull();
  });
});
