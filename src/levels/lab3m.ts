// GDD-ART-06: lab-3m, a World 3 test level in the mine (its place, `mina`), opened with `?level=lab-3m` (GDD-UI-02), to show the mine's
// look: its backdrop, its floor and its decor. Like the other labs it has three ofrendas and no exit (GDD-TEC-04). 60 x 17 tiles, a roofed
// gallery: the roof's rock over rows 0 to 4 everywhere, the floor's top at row 13 (y = 208). Left to right: the main gallery with the first
// Alacrán; a pit 3 tiles wide, a black shaft open to the level's bottom; a stretch under a low roof 4 tiles over the floor; a ramp
// of four slope tiles down to a lower floor at row 15 (y = 240), and on it one rail with its cart and a buffer, the second Alacrán past it.
// The glide is on. The rails and the cart keep their placeholder drawing.
import { TILE } from '../config/tuning';
import type { Rail } from '../sim/cart';
import type { Enemy } from '../sim/enemy';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

/** GDD-UI-02: its id, which its address names. */
export const LAB_3M_ID = 'lab-3m';

const WIDTH = 60;
const HEIGHT = 17;
/** The roof's rock: rows 0 to 4 over every column. */
const ROOF_ROWS = 5;

/** The floor's top row in the main gallery (y = 208). */
export const LAB_3M_FLOOR_ROW = 13;

/** The pit: columns 18 to 20, 3 tiles, open down to the level's bottom (World 3 allows 6 at the same height, GDD-WLD-03). */
export const LAB_3M_PIT = { col0: 18, col1: 20 } as const;

/** The low roof: columns 24 to 31, the rock down to row 8, so its underside is 4 tiles (64 px) over the floor. */
export const LAB_3M_LOW_ROOF = { col0: 24, col1: 31, row: 8 } as const;

/** The ramp: columns 34 to 37, F f at row 13 and F f at row 14 (GDD-MOV-09), 32 px down to the lower floor. */
export const LAB_3M_RAMP = { col0: 34, col1: 37 } as const;
const RAMP = ['F', 'f', 'F', 'f'] as const;

/** The lower floor past the ramp, its top at row 15 (y = 240), to the level's end. */
export const LAB_3M_LOWER = { col0: LAB_3M_RAMP.col1 + 1, row: 15 } as const;

/** The row the ground of column `col` starts at (it is solid from there to the level's bottom); none in the pit. */
function groundRow(col: number): number {
  if (col >= LAB_3M_PIT.col0 && col <= LAB_3M_PIT.col1) return Infinity;
  if (col < LAB_3M_RAMP.col0) return LAB_3M_FLOOR_ROW;
  // Each ramp tile stands on the tile under it: the first two on row 14, the last two on row 15.
  if (col <= LAB_3M_RAMP.col1) return col - LAB_3M_RAMP.col0 < 2 ? LAB_3M_FLOOR_ROW + 1 : LAB_3M_FLOOR_ROW + 2;
  return LAB_3M_LOWER.row;
}

export const LAB_3M_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) =>
  Array.from({ length: WIDTH }, (_tile, col) => {
    if (row < ROOF_ROWS) return '#';
    if (row <= LAB_3M_LOW_ROOF.row && col >= LAB_3M_LOW_ROOF.col0 && col <= LAB_3M_LOW_ROOF.col1) return '#';
    if (row >= groundRow(col)) return '#';
    const ramp = col - LAB_3M_RAMP.col0;
    if (ramp >= 0 && ramp < RAMP.length && row === groundRow(col) - 1) return RAMP[ramp]!;
    return '.';
  }).join(''),
);

const onFloor = (col: number, row = LAB_3M_FLOOR_ROW): { x: number; y: number } => ({ x: col * TILE + TILE / 2, y: row * TILE });

/** GDD-WLD-15: one rail on the lower floor, columns 42 to 51, its cart standing at its start, ending in a buffer. */
export const LAB_3M_RAILS: readonly Rail[] = [{ x: 42 * TILE, y: LAB_3M_LOWER.row * TILE, dir: 1, segments: [{ kind: 'level', tiles: 10 }], end: 'buffer' }];

/** Poncho starts on the floor at column 3. */
export const LAB_3M_SPAWN = onFloor(3);

/** One in the main gallery (column 8), one past the pit before the low roof (column 22), one on the lower floor before the cart (column 39). */
export const LAB_3M_OFRENDAS: readonly Ofrenda[] = [
  { id: 'lab-3m-1', ...onFloor(8) },
  { id: 'lab-3m-2', ...onFloor(22) },
  { id: 'lab-3m-3', ...onFloor(39, LAB_3M_LOWER.row) },
];

/** GDD-ENM-02: two Alacranes, one in the main gallery (column 13), one on the lower floor past the rail's buffer (column 56). */
export const LAB_3M_ENEMIES: readonly Enemy[] = [{ ...onFloor(13) }, { ...onFloor(56, LAB_3M_LOWER.row) }];

export const LAB_3M_LEVEL: Level = {
  world: parseTiles(LAB_3M_ROWS),
  spawn: LAB_3M_SPAWN,
  ofrendas: LAB_3M_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: LAB_3M_ENEMIES,
  rails: LAB_3M_RAILS,
  // GDD-MOV-07: the glide is on.
  abilities: { glide: true },
};
