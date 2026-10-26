import { describe, expect, it } from 'vitest';
import { LEVEL_0_1 } from '../levels/level0-1';
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
