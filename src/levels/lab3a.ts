// GDD-ENM-04: lab-3a, a World 3 test level in the mine (its place, `mina`, GDD-ART-06) to meet the Armadillo, opened with `?level=lab-3a`
// (GDD-UI-02). Like the other labs it has three ofrendas and no exit (GDD-TEC-04). 60 x 17 tiles, the roof's rock over rows 0 to 4, the
// floor's top at row 13 (y = 208), and the glide on. Four pieces, left to right, each walled off from the next so that no Armadillo reaches
// another's piece, each with one Armadillo:
// - the pen (3-2's, GDD-WLD-17): a 2-tile block to stand on, 32 px over the pen's floor and so out of its sight, the pen 11 tiles long, a
//   2-tile far wall, and a roof 5 tiles over the pen's floor;
// - the slope: 6 tiles of lower floor, a ramp of 4 slope tiles up to the right, and the upper floor to a wall; the Armadillo starts on the
//   upper floor, rolls down the ramp at a Poncho on its left, lies dazed at the far wall, and rolls up it at a Poncho on its right;
// - the ledge: a ledge 3 tiles over a floor, the Armadillo on it; it rolls off its end, falls and rolls on to a wall;
// - the rail: a level rail of 12 tiles with its cart and a buffer, the Armadillo on the rail's floor 8 tiles ahead of the cart. A dip 2 tiles
//   wide and 1 deep under the rail just past the cart's start turns its walk back and catches a roll towards the cart, so neither reaches the
//   cart's start (GDD-WLD-15, the validator); a wall on the rail's ground would stop the rider instead.
import { TILE } from '../config/tuning';
import type { Rail } from '../sim/cart';
import type { Enemy } from '../sim/enemy';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

/** GDD-UI-02: its id, which its address names. */
export const LAB_3A_ID = 'lab-3a';

const WIDTH = 60;
const HEIGHT = 17;
/** The roof's rock: rows 0 to 4 over every column. */
const ROOF_ROWS = 5;

/** The floor's top row (y = 208) in the pen, on the slope's lower floor, under the ledge and on the rail's floor. */
export const LAB_3A_FLOOR_ROW = 13;

/** The pen: the block (columns 3 and 4) and the far wall (16 and 17), 2 tiles tall; the pen's floor between them; the roof's underside at row 8 (y = 128). */
export const LAB_3A_PEN = { block0: 3, block1: 4, col0: 5, col1: 15, wall0: 16, wall1: 17, topRow: 11, roofRow: 8 } as const;

/**
 * The slope: the lower floor (columns 18 to 23, row 13), the ramp (24 to 27: r R at row 12, r R at row 11, GDD-MOV-09) and the upper floor
 * (28 to 31, its top at row 11, y = 176), then the wall (32 and 33) up to row 9 (y = 144).
 */
export const LAB_3A_SLOPE = { low0: 18, low1: 23, ramp0: 24, ramp1: 27, high0: 28, high1: 31, highRow: 11, wall0: 32, wall1: 33, wallRow: 9 } as const;
const RAMP = ['r', 'R', 'r', 'R'] as const;

/** The ledge: columns 34 to 39, its top at row 10 (y = 160), 3 tiles over the floor (columns 40 to 43); the wall at column 44 up to row 10. */
export const LAB_3A_LEDGE = { col0: 34, col1: 39, row: 10, floor0: 40, floor1: 43, wall: 44, wallRow: 10 } as const;

/** The rail's dip: columns 47 and 48, the floor's top tile missing (one tile deep). */
export const LAB_3A_DIP = { col0: 47, col1: 48 } as const;

/** The row the ground of column `col` starts at (it is solid from there to the level's bottom). */
function groundRow(col: number): number {
  const { block0, wall1, topRow } = LAB_3A_PEN;
  if ((col >= block0 && col <= LAB_3A_PEN.block1) || (col >= LAB_3A_PEN.wall0 && col <= wall1)) return topRow;
  if (col >= LAB_3A_SLOPE.ramp0 && col <= LAB_3A_SLOPE.ramp1) return col - LAB_3A_SLOPE.ramp0 < 2 ? LAB_3A_FLOOR_ROW : LAB_3A_SLOPE.highRow + 1;
  if (col >= LAB_3A_SLOPE.high0 && col <= LAB_3A_SLOPE.high1) return LAB_3A_SLOPE.highRow;
  if (col >= LAB_3A_SLOPE.wall0 && col <= LAB_3A_SLOPE.wall1) return LAB_3A_SLOPE.wallRow;
  if (col >= LAB_3A_LEDGE.col0 && col <= LAB_3A_LEDGE.col1) return LAB_3A_LEDGE.row;
  if (col === LAB_3A_LEDGE.wall) return LAB_3A_LEDGE.wallRow;
  if (col >= LAB_3A_DIP.col0 && col <= LAB_3A_DIP.col1) return LAB_3A_FLOOR_ROW + 1;
  return LAB_3A_FLOOR_ROW;
}

export const LAB_3A_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) =>
  Array.from({ length: WIDTH }, (_tile, col) => {
    if (row < ROOF_ROWS) return '#';
    if (row < LAB_3A_PEN.roofRow && col >= LAB_3A_PEN.block0 && col <= LAB_3A_PEN.wall1) return '#';
    if (row >= groundRow(col)) return '#';
    const ramp = col - LAB_3A_SLOPE.ramp0;
    if (ramp >= 0 && ramp < RAMP.length && row === groundRow(col) - 1) return RAMP[ramp]!;
    return '.';
  }).join(''),
);

const at = (col: number, row = LAB_3A_FLOOR_ROW): { x: number; y: number } => ({ x: col * TILE + TILE / 2, y: row * TILE });

/** GDD-WLD-15: one level rail of 12 tiles on the rail's floor from column 45, its cart standing at its start, ending in a buffer. */
export const LAB_3A_RAILS: readonly Rail[] = [{ x: 45 * TILE, y: LAB_3A_FLOOR_ROW * TILE, dir: 1, segments: [{ kind: 'level', tiles: 12 }], end: 'buffer' }];

/** Poncho starts on the floor at column 1, left of the pen's block. */
export const LAB_3A_SPAWN = at(1);

/** One by the spawn (column 2), one on the slope's lower floor (column 19), one on the floor under the ledge (column 41). */
export const LAB_3A_OFRENDAS: readonly Ofrenda[] = [
  { id: 'lab-3a-1', ...at(2) },
  { id: 'lab-3a-2', ...at(19) },
  { id: 'lab-3a-3', ...at(41) },
];

/**
 * GDD-ENM-04: the four Armadillos: in the pen (column 10), on the slope's upper floor (column 30), on the ledge (column 36) and on the rail's
 * floor with its middle 8 tiles (128 px) past the front of the standing cart (x = 47 x 16 + 128 = 880).
 */
export const LAB_3A_ENEMIES: readonly Enemy[] = [
  { ...at(10), kind: 'armadillo' },
  { ...at(30, LAB_3A_SLOPE.highRow), kind: 'armadillo' },
  { ...at(36, LAB_3A_LEDGE.row), kind: 'armadillo' },
  { x: LAB_3A_RAILS[0]!.x + 2 * TILE + 8 * TILE, y: LAB_3A_FLOOR_ROW * TILE, kind: 'armadillo' },
];

export const LAB_3A_LEVEL: Level = {
  world: parseTiles(LAB_3A_ROWS),
  spawn: LAB_3A_SPAWN,
  ofrendas: LAB_3A_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: LAB_3A_ENEMIES,
  rails: LAB_3A_RAILS,
  // GDD-MOV-07: the glide is on.
  abilities: { glide: true },
};
