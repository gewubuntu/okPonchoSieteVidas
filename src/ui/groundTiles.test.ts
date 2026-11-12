import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { LEVEL_0_1 } from '../levels/level0-1';
import { LAB_3M_FLOOR_ROW, LAB_3M_LEVEL, LAB_3M_LOW_ROOF } from '../levels/lab3m';
import { parseTiles, type SlopeChar, type TileGrid } from '../sim/tilemap';
import { groundFrame, groundFrameFor, mineGroundFrame, mineTileKind, type MineTile } from './groundTiles';
import { placeFor } from './scenery/looks';

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

// GDD-ART-06 (the mine's rock): a mine tile's kind. A tile is a top with open air (in the level, not solid, no slope) directly above it;
// an underside with open air directly under it; both, a one-tile ledge; deep when its eight neighbours are all solid or off the level;
// else plain rock, which carries the ore streak in at most one tile of every four that touch open air. Slopes and the tiles under them
// keep their frames. The mine's sheet keeps the 28 frames of the shared layout and adds after them the underside (28, 29), deep rock
// (30, 31), the one-tile ledge (32, 33), a version each, and the plain rock tile's second version with no ore (34); the ore streak is frame 3.

/** Open air at (tx, ty): inside the level, not solid, no slope. */
const openAir = (grid: TileGrid, tx: number, ty: number) =>
  tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height && !grid.solidTile(tx, ty) && grid.slopeAt(tx, ty) === null;
const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const touchesAir = (grid: TileGrid, tx: number, ty: number) => NEIGHBOURS.some(([dx, dy]) => openAir(grid, tx + dx, ty + dy));
/** Every tile of `grid` with a ground image, its kind and frame. */
const mineTiles = (grid: TileGrid) => {
  const tiles: { tx: number; ty: number; kind: MineTile; frame: number }[] = [];
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      const kind = mineTileKind(grid, tx, ty);
      if (kind !== null) tiles.push({ tx, ty, kind, frame: mineGroundFrame(grid, tx, ty) });
    }
  }
  return tiles;
};
const LAB = LAB_3M_LEVEL.world;
/**
 * Measured over lab-3m (60 x 17, L-072): the count of each kind (the roof's last row gives 52 undersides, the low roof 8; under the floor's
 * top row the floor is deep rock), and the ore streak's tiles against the plain rock tiles that touch open air and could carry it.
 */
const COUNTS_3M = { top: 53, underside: 60, ledge: 0, deep: 377, rock: 15, ore: 1, slope: 4, foot: 4 };
const ORE_3M = [1, 14];

describe('GDD-ART-06 mine ground tiles', () => {
  it('GDD-ART-06 mine kinds over lab-3m: the count of each kind', () => {
    const tiles = mineTiles(LAB);
    const counts = Object.fromEntries(Object.keys(COUNTS_3M).map((k) => [k, tiles.filter((t) => t.kind === k).length]));
    expect(counts).toEqual(COUNTS_3M);
    expect(tiles.length).toBe(Object.values(COUNTS_3M).reduce((a, b) => a + b, 0));
  });

  it('GDD-ART-06 mine underside: every tile of the roof last row over the gallery and of the low roof, and no tile with something under it', () => {
    const roofLast = 4;
    for (let tx = 0; tx < LAB.width; tx++) {
      if (!openAir(LAB, tx, roofLast + 1)) continue;
      expect(mineTileKind(LAB, tx, roofLast), `roof ${tx}`).toBe('underside');
      expect([28, 29], `roof ${tx}`).toContain(mineGroundFrame(LAB, tx, roofLast));
    }
    for (let tx = LAB_3M_LOW_ROOF.col0; tx <= LAB_3M_LOW_ROOF.col1; tx++) {
      expect(mineTileKind(LAB, tx, LAB_3M_LOW_ROOF.row), `low roof ${tx}`).toBe('underside');
      // Over the low roof the roof's last row has rock under it: no lip there.
      expect(mineTileKind(LAB, tx, roofLast), `over the low roof ${tx}`).not.toBe('underside');
    }
    // An underside is exactly a solid tile with open air under it and none over it.
    for (const { tx, ty, kind } of mineTiles(LAB)) expect(kind === 'underside', `${tx},${ty}`).toBe(LAB.solidTile(tx, ty) && openAir(LAB, tx, ty + 1) && !openAir(LAB, tx, ty - 1));
  });

  it('GDD-ART-06 mine underside: a slope or a solid tile under it, or the level bottom, makes no lip', () => {
    // (1, 0) is over a slope, (2, 1) over a solid tile with a slope and open air beside it, (4, 3) in the bottom row; (3, 0) and (5, 0)
    // are over open air.
    const grid = parseTiles(['#######', '#F#.#.#', '#######', '#####.#']);
    expect(mineTileKind(grid, 1, 0)).not.toBe('underside');
    expect(mineTileKind(grid, 2, 1)).not.toBe('underside');
    expect(mineTileKind(grid, 4, 3)).not.toBe('underside');
    expect([mineTileKind(grid, 3, 0), mineTileKind(grid, 5, 0)]).toEqual(['underside', 'underside']);
  });

  it('GDD-ART-06 mine deep: no deep tile touches open air, diagonally either', () => {
    for (const { tx, ty, kind } of mineTiles(LAB)) if (kind === 'deep') expect(touchesAir(LAB, tx, ty), `${tx},${ty}`).toBe(false);
    // A tile whose only open neighbour is diagonal (below right) is plain rock, not deep; one with none, deep.
    const grid = parseTiles(['#####', '#####', '#####', '###..', '###..']);
    expect(['rock', 'ore']).toContain(mineTileKind(grid, 2, 2));
    expect(mineTileKind(grid, 1, 1)).toBe('deep');
    expect([30, 31]).toContain(mineGroundFrame(grid, 1, 1));
    // A slope beside it is not solid: no deep tile there either.
    expect(mineTileKind(parseTiles(['###', '###', '##F', '###']), 1, 1)).not.toBe('deep');
  });

  it('GDD-ART-06 mine deep: off the level counts as solid, so the roof first row is deep, not a top', () => {
    // The level's top row has no open air over it: not a top tile in the mine (the other worlds' rule makes it one).
    for (let tx = 0; tx < LAB.width; tx++) expect(mineTileKind(LAB, tx, 0), `row 0 ${tx}`).toBe('deep');
    expect(mineTileKind(LAB, 0, LAB_3M_FLOOR_ROW + 2)).toBe('deep');
    expect(mineTileKind(LAB, 0, LAB.height - 1)).toBe('deep');
  });

  it('GDD-ART-06 mine one-tile ledge: open air over and under it shows the walk line and the lip, frames 32 and 33', () => {
    const grid = parseTiles(['......', '.##...', '......', '######']);
    expect([mineTileKind(grid, 1, 1), mineTileKind(grid, 2, 1)]).toEqual(['ledge', 'ledge']);
    expect([mineGroundFrame(grid, 1, 1), mineGroundFrame(grid, 2, 1)]).toEqual([32, 33]); // versions (7 + 3) and (14 + 3) mod 2
    expect(mineTileKind(grid, 0, 3)).toBe('top');
    expect([0, 1]).toContain(mineGroundFrame(grid, 0, 3));
    // A slope and the tile under it keep their frames.
    const ramp = parseTiles(['....', '.F..', '####']);
    expect([mineTileKind(ramp, 1, 1), mineTileKind(ramp, 1, 2)]).toEqual(['slope', 'foot']);
    for (const ty of [1, 2]) expect(mineGroundFrame(ramp, 1, ty)).toBe(groundFrame((x, y) => ramp.solidTile(x, y), 1, ty, (x, y) => ramp.slopeAt(x, y)));
  });

  it('GDD-ART-06 mine ore streak only in tiles that touch open air, in at most one tile of every four', () => {
    const tiles = mineTiles(LAB);
    const ore = tiles.filter((t) => t.frame === 3);
    expect(ore.every((t) => t.kind === 'ore' && touchesAir(LAB, t.tx, t.ty))).toBe(true);
    // The tiles that could carry it: plain rock touching open air.
    const eligible = tiles.filter((t) => (t.kind === 'rock' || t.kind === 'ore') && touchesAir(LAB, t.tx, t.ty));
    expect(ore.length * 4).toBeLessThanOrEqual(eligible.length);
    expect([ore.length, eligible.length]).toEqual(ORE_3M);
    // Plain rock without the streak: frame 2 in version 0, 34 in version 1.
    for (const t of tiles) if (t.kind === 'rock') expect([2, 34], `${t.tx},${t.ty}`).toContain(t.frame);
  });

  it('GDD-ART-06 mine rule only in the mine: every other level keeps groundFrame and asks for no frame past the 28', () => {
    let canyon = 0;
    for (const entry of LEVELS) {
      const place = placeFor(entry.world, entry.place);
      if (place === 'mina') continue;
      const { world } = entry.level;
      for (let ty = 0; ty < world.height; ty++) {
        for (let tx = 0; tx < world.width; tx++) {
          if (!world.solidTile(tx, ty) && world.slopeAt(tx, ty) === null) continue;
          const frame = groundFrameFor(place, world, tx, ty);
          expect(frame, `${entry.id} ${tx},${ty}`).toBe(groundFrame((x, y) => world.solidTile(x, y), tx, ty, (x, y) => world.slopeAt(x, y)));
          expect(frame, `${entry.id} ${tx},${ty}`).toBeLessThan(28);
          if (place === 'barranca') canyon++;
        }
      }
    }
    // The canyon levels (3-1 and its labs) were checked, not skipped.
    expect(canyon).toBeGreaterThan(1000);
    expect(groundFrameFor('mina', LAB, 0, 0)).toBe(mineGroundFrame(LAB, 0, 0));
  });
});
