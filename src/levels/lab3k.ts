// GDD-ENM-04: lab-3k, a World 3 test level in the mine (its place, `mina`, GDD-ART-06) to meet the Cacomixtle. Like the other labs it has three
// ofrendas and no exit (GDD-TEC-04). 60 x 17 tiles, the roof's rock over rows 0 to 4, the floor's top at row 13 (y = 208), and the glide on.
// Not registered in `src/levels/index.ts`: it becomes playable with the Cacomixtle's drawing (a later PR). Two pieces, left to right:
// - Ka: a level rail rolling left on the floor from column 34 (the cart's back edge on its start, 17 tiles to a buffer at column 17), its
//   Cacomixtle waiting in the cart at the right end, so it sees him from x = 328 (200 px ahead of its middle, x = 528). The sight stretch is all
//   flat floor at the rail's ground. The perch is GDD-WLD-18's K1's, here on the flat: a still one-way platform of columns 20 and 21 whose top is
//   40 px over the floor (y = 168), on the wake line (x = 328, the middle of column 20) as K1's is, with the buffer 3 tiles behind it so the parked
//   cart stops on flat floor. A hop onto it puts him 18 px over the ringtail's head as the cart passes under, and it parks behind him.
// - Kb: K1's shape (GDD-WLD-18): a rail rolling left from column 59, level on the lower terrace (columns 55 to 59, the floor's row 13), a climb of
//   two tiles over two slope tiles (columns 53 and 54), then level on the shelf (columns 36 to 52, row 11, y = 176) to a buffer at column 42. Its
//   start floor (y = 200) is 24 px under the shelf's ground, so the sight stretch's ground rule fails there: the named exception (GDD-ENM-04).
// A step 2 tiles high leads from the floor up to the shelf.
import { TILE } from '../config/tuning';
import type { Rail } from '../sim/cart';
import type { Enemy } from '../sim/enemy';
import type { MovingPlatform } from '../sim/platform';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

/** GDD-UI-02: its id, which its address names. */
export const LAB_3K_ID = 'lab-3k';

const WIDTH = 60;
const HEIGHT = 17;
/** The roof's rock: rows 0 to 4 over every column. */
const ROOF_ROWS = 5;

/** The floor's top row (y = 208) under Ka and on Kb's terrace. */
export const LAB_3K_FLOOR_ROW = 13;

/** Kb's shelf: columns 36 to 52, its top at row 11 (y = 176); the slope (columns 53 and 54, descending right) leads down to the terrace. */
export const LAB_3K_SHELF = { col0: 36, col1: 52, row: 11, slope0: 53, slope1: 54 } as const;

/** The row the ground of column `col` starts at (it is solid from there to the level's bottom). */
function groundRow(col: number): number {
  const { col0, col1, row, slope0 } = LAB_3K_SHELF;
  if (col >= col0 && col <= col1) return row;
  if (col === slope0) return row + 1;
  return LAB_3K_FLOOR_ROW;
}

export const LAB_3K_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) =>
  Array.from({ length: WIDTH }, (_tile, col) => {
    if (row < ROOF_ROWS || row >= groundRow(col)) return '#';
    // GDD-MOV-09: a slope tile over the ground's first tile in each of the two slope columns, its surface descending to the right.
    if ((col === LAB_3K_SHELF.slope0 || col === LAB_3K_SHELF.slope1) && row === groundRow(col) - 1) return '\\';
    return '.';
  }).join(''),
);

const at = (col: number, row = LAB_3K_FLOOR_ROW): { x: number; y: number } => ({ x: col * TILE + TILE / 2, y: row * TILE });

/**
 * GDD-WLD-15: Ka, rail 0, level for 17 tiles from x = 544 (column 34) to a buffer at x = 272 (column 17); Kb, rail 1, K1's: from x = 944 (column
 * 59) level for 4 tiles on the terrace, a climb of 2 tiles, level for 11 tiles on the shelf to a buffer at x = 672 (column 42). Both roll left.
 */
export const LAB_3K_RAILS: readonly Rail[] = [
  { x: 34 * TILE, y: LAB_3K_FLOOR_ROW * TILE, dir: -1, segments: [{ kind: 'level', tiles: 17 }], end: 'buffer' },
  { x: 59 * TILE, y: LAB_3K_FLOOR_ROW * TILE, dir: -1, segments: [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 2 }, { kind: 'level', tiles: 11 }], end: 'buffer' },
];

/**
 * GDD-ENM-04, GDD-WLD-18: the perch, a platform that does not move (both ends the same): columns 20 and 21, its top 40 px over the floor
 * (y = 168), the wake line of Ka (x = 328) in the middle of its first tile.
 */
export const LAB_3K_PERCH: MovingPlatform = { x0: 20 * TILE, y0: LAB_3K_FLOOR_ROW * TILE - 40, x1: 20 * TILE, y1: LAB_3K_FLOOR_ROW * TILE - 40, w: 2 * TILE };

/** Poncho starts on the floor at column 1, left of everything. */
export const LAB_3K_SPAWN = at(1);

/** One by the spawn (column 2), one on the floor before Ka's cart (column 12), one on the shelf before Kb (column 40). */
export const LAB_3K_OFRENDAS: readonly Ofrenda[] = [
  { id: 'lab-3k-1', ...at(2) },
  { id: 'lab-3k-2', ...at(12) },
  { id: 'lab-3k-3', ...at(40, LAB_3K_SHELF.row) },
];

/**
 * GDD-ENM-04: the two Cacomixtles, each at its cart's start: the middle of the cart (16 px across from its rail's start) and its floor, 8 px over
 * the rail's ground there (y = 200). Both name the exception to the sight stretch's ground rule (`sightException`, GDD-TEC-04): Ka's, its perch
 * (a platform 32 px over its floor, in its sight); Kb's, the shelf.
 */
export const LAB_3K_ENEMIES: readonly Enemy[] = [
  { x: 34 * TILE - TILE, y: LAB_3K_FLOOR_ROW * TILE - 8, kind: 'cacomixtle', rail: 0, sightException: 'GDD-WLD-18: the perch, K1 s lesson, stands in its sight' },
  { x: 59 * TILE - TILE, y: LAB_3K_FLOOR_ROW * TILE - 8, kind: 'cacomixtle', rail: 1, sightException: 'GDD-WLD-18: K1 meets him uphill, 40 px inside its sight' },
];

export const LAB_3K_LEVEL: Level = {
  world: parseTiles(LAB_3K_ROWS),
  spawn: LAB_3K_SPAWN,
  ofrendas: LAB_3K_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [LAB_3K_PERCH],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: LAB_3K_ENEMIES,
  rails: LAB_3K_RAILS,
  // GDD-MOV-07: the glide is on.
  abilities: { glide: true },
};
