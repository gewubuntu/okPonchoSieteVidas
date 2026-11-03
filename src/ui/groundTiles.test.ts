import { describe, expect, it } from 'vitest';
import { LEVEL_0_1 } from '../levels/level0-1';
import type { SlopeChar } from '../sim/tilemap';
import { groundFrame } from './groundTiles';

// GDD-ART-06: a solid tile with nothing solid above it (or in row 0) is a top tile, frames 0 and 1; any other is an earth tile, frames 2 and 3.
// The version is (7 x column + 3 x row) mod 2.
// A tiny grid: row 0 empty, row 1 holds a solid tile at column 2 only, rows 2 and 3 are solid at columns 0 to 3 (row 3 under row 2).
const GRID = ['....', '..#.', '####', '####'];
const solid = (tx: number, ty: number) => GRID[ty]?.[tx] === '#';
/** Solid in row 14 only: a floor. */
const earth = (_tx: number, ty: number) => ty === 14;
/** The level 0-1 grid as a solid test. */
const tile = (tx: number, ty: number) => LEVEL_0_1.world.solidTile(tx, ty);

describe('GDD-ART-06 ground tiles', () => {
  it('GDD-ART-06 a tile with an empty tile above is a top tile, one with a solid tile above an earth tile', () => {
    expect([0, 1]).toContain(groundFrame(solid, 2, 1)); // empty above (row 0)
    expect([0, 1]).toContain(groundFrame(solid, 0, 2)); // empty above
    expect([2, 3]).toContain(groundFrame(solid, 2, 2)); // the tile at column 2 row 1 is solid above
    expect([2, 3]).toContain(groundFrame(solid, 1, 3));
  });

  it('GDD-ART-06 a solid tile in row 0 is a top tile', () => {
    expect([0, 1]).toContain(groundFrame(() => true, 5, 0));
  });

  it('GDD-ART-06 the version is (7 x column + 3 x row) mod 2', () => {
    expect(groundFrame(() => false, 0, 14)).toBe(0); // 42 is even
    expect(groundFrame(() => false, 1, 14)).toBe(1); // 49 is odd
    expect(groundFrame(earth, 0, 15)).toBe(3); // 45 is odd
    expect(groundFrame(earth, 1, 15)).toBe(2); // 52 is even
  });

  it('GDD-ART-06 level 0-1 has grass on its floor and earth below, and grass on the raised platform', () => {
    expect([0, 1]).toContain(groundFrame(tile, 3, 14));
    expect([2, 3]).toContain(groundFrame(tile, 3, 15));
    expect([0, 1]).toContain(groundFrame(tile, 62, 10));
  });
});

// GDD-MOV-09, GDD-ART-06: a slope tile takes the frames 4 + 2k + v, the tile under it the frames 16 + 2k + v in the slope's version v, k the
// place of its character in the order `/ \ r R F f` (0 to 5). Written here from the GDD, not read from the code.
const SLOPE_KINDS: SlopeChar[] = ['/', '\\', 'r', 'R', 'F', 'f'];
/** Solid from row 4 down. */
const below = (_x: number, y: number) => y >= 4;

describe('GDD-ART-06 slope ground tiles', () => {
  it('GDD-ART-06 a slope tile gets its slope frame', () => {
    SLOPE_KINDS.forEach((c, k) => {
      const at2 = (x: number, y: number) => (x === 2 && y === 3 ? c : null);
      expect(groundFrame(() => false, 2, 3, at2), `${c} at (2,3)`).toBe(4 + 2 * k + 1); // 7 x 2 + 3 x 3 = 23, odd
      const at1 = (x: number, y: number) => (x === 1 && y === 3 ? c : null);
      expect(groundFrame(() => false, 1, 3, at1), `${c} at (1,3)`).toBe(4 + 2 * k); // 7 + 9 = 16, even
    });
  });

  it('GDD-ART-06 the tile under a slope gets that slope foot frame in the slope version', () => {
    SLOPE_KINDS.forEach((c, k) => {
      const at2 = (x: number, y: number) => (x === 2 && y === 3 ? c : null);
      expect(groundFrame(below, 2, 4, at2), `${c} under (2,3)`).toBe(16 + 2 * k + 1); // the slope's version 1, not the tile's own 0
      const at1 = (x: number, y: number) => (x === 1 && y === 3 ? c : null);
      expect(groundFrame(below, 1, 4, at1), `${c} under (1,3)`).toBe(16 + 2 * k); // the slope's version 0, not the tile's own 1
      expect(groundFrame(below, 2, 5, at2), `${c} two down`).toBe(3); // an earth tile, version (14 + 15) mod 2 = 1
    });
  });
});
