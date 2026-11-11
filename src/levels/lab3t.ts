// GDD-UI-04: lab-3t, a World 3 test level taller than one screen, for the camera that follows up and down, opened with `?level=lab-3t`
// (GDD-UI-02). Like the other labs it has three ofrendas and no exit (GDD-TEC-04), and no enemy. 80 x 40 tiles (1280 x 640 px), so the
// camera's y goes from 0 to 368. Its exhibits, left to right and top to bottom, each reached from the one before: the start on a high
// plateau; a staircase of 1-tile and 2-tile steps; a walk-off drop of 10 tiles onto ground in view below; a chasm 12 tiles wide to glide
// across, its far side 6 tiles lower; on that lower ground a spring under open sky and a second one beside a floating ledge it launches
// him onto; a lift that climbs 14 tiles from that ledge to the highest ledge; a rail whose cart climbs 6 tiles onto a plateau and one whose
// cart descends 6 tiles from it; past its end a pit high in the level with a raised bottom (GDD-WLD-03); and the lowest ground, at the
// chasm's bottom on the level's last rows, with a pit at the level's bottom. Every column is solid down to the level's bottom from its
// ground, but the pits', empty all the way.
import { TILE } from '../config/tuning';
import type { Bottom } from '../sim/bottoms';
import type { Rail } from '../sim/cart';
import type { MovingPlatform } from '../sim/platform';
import type { Level, Ofrenda } from '../sim/run';
import type { Spring } from '../sim/spring';
import { parseTiles } from '../sim/tilemap';

/** GDD-UI-02: its id, which its address names. */
export const LAB_3T_ID = 'lab-3t';

const WIDTH = 80;
const HEIGHT = 40;

/** The start: a plateau over columns 0 to 5, its top at row 8 (y = 128). */
export const LAB_3T_PLATEAU = { col0: 0, col1: 5, row: 8 } as const;

/**
 * The staircase after it, two columns a step: up 1 tile, down 2, up 2 and up 1, to row 6 (y = 96). His feet stay between screen y 96 and
 * 144 on it, with the camera at the level's top.
 */
export const LAB_3T_STAIRS: readonly { readonly col0: number; readonly col1: number; readonly row: number }[] = [
  { col0: 6, col1: 7, row: 7 },
  { col0: 8, col1: 9, row: 9 },
  { col0: 10, col1: 11, row: 7 },
  { col0: 12, col1: 13, row: 6 },
];

/**
 * The walk-off drop: from the staircase's last step (its lip at column 13's right edge, row 6) 10 tiles down to the ground over columns 14
 * to 19, its top at row 16 (y = 256), which the camera at the level's top already shows (screen y 256).
 */
export const LAB_3T_DROP = { lipCol: 13, lipRow: 6, col0: 14, col1: 19, row: 16 } as const;

/** The chasm: columns 20 to 31, 12 tiles wide, open down to the lowest ground; its far side from column 32, 6 tiles lower (row 22, y = 352). */
export const LAB_3T_CHASM = { col0: 20, col1: 31, farRow: 22 } as const;

/** The lowest ground: the chasm's bottom, columns 20 to 31, its top at row 37 (y = 592), with the camera at its bottom limit (his feet at screen y 224). */
export const LAB_3T_LOWEST = { col0: 20, col1: 31, row: 37 } as const;

/** GDD-WLD-03: the low pit: columns 20 to 22 of the lowest ground, 3 tiles wide against the landing ground's wall, open to the level's bottom. */
export const LAB_3T_LOW_PIT = { col0: 20, col1: 22 } as const;

/** GDD-WLD-05: the springs, set flush into the far side's ground: one under open sky (column 34), one beside the floating ledge (column 37). */
export const LAB_3T_SPRINGS: readonly Spring[] = [
  { col: 34, row: LAB_3T_CHASM.farRow },
  { col: 37, row: LAB_3T_CHASM.farRow },
];

/** The floating ledge the second spring launches him onto: columns 39 to 41, one tile thick at row 18 (its top 64 px over the ground, more than a jump climbs). */
export const LAB_3T_LEDGE = { col0: 39, col1: 41, row: 18 } as const;

/** The highest ledge, where the lift stops: columns 44 to 47, rows 4 and 5 (its top at y = 64), so the camera is at the level's top there. */
export const LAB_3T_TOP = { col0: 44, col1: 47, row: 4 } as const;

/** GDD-WLD-05: the lift, 2 tiles wide in columns 42 and 43, from the ledge's height (y = 288) 14 tiles up to the highest ledge's (y = 64), at 40 px/s. */
export const LAB_3T_LIFT: MovingPlatform = { x0: 42 * TILE, y0: LAB_3T_LEDGE.row * TILE, x1: 42 * TILE, y1: LAB_3T_TOP.row * TILE, w: 2 * TILE };

/** The plateau the first cart climbs onto and the second rolls down from: columns 49 to 52, rows 16 to 21 (its top 6 tiles over the far side). */
export const LAB_3T_CART_PLATEAU = { col0: 49, col1: 52, row: 16 } as const;

/**
 * GDD-WLD-03: the high pit, past the descending cart's end: columns 66 to 69, 4 tiles wide in the far side's ground (its lips at row 22, 17
 * rows over the level's last), empty all the way down.
 */
export const LAB_3T_HIGH_PIT = { col0: 66, col1: 69, row: LAB_3T_CHASM.farRow } as const;

/**
 * GDD-WLD-03: its raised bottom, over the pit and 6 columns of ground on each side (columns 60 to 75), 4 rows under its lips: row 26, the
 * floor line at y = 432, where the camera's bottom limit is 160.
 */
export const LAB_3T_HIGH_BOTTOM: Bottom = { fromCol: LAB_3T_HIGH_PIT.col0 - 6, toCol: LAB_3T_HIGH_PIT.col1 + 6, row: LAB_3T_HIGH_PIT.row + 4 };

const FAR_Y = LAB_3T_CHASM.farRow * TILE;
const CART_TOP_Y = LAB_3T_CART_PLATEAU.row * TILE;

/**
 * GDD-WLD-15: the rails. R1 from column 42 on the far side: 1 tile level, 6 up over air (columns 43 to 48) to the plateau's top, 1 level on
 * it. R2 from column 52 on the plateau, 2 tiles past R1's end: 1 level, 6 down over air (columns 53 to 58) to the far side, 1 level (column
 * 59). Both end in a buffer; past R2's the far side goes on to the high pit.
 */
export const LAB_3T_RAILS: readonly Rail[] = [
  { x: 42 * TILE, y: FAR_Y, dir: 1, segments: [{ kind: 'level', tiles: 1 }, { kind: 'climb', tiles: 6 }, { kind: 'level', tiles: 1 }], end: 'buffer' },
  { x: 52 * TILE, y: CART_TOP_Y, dir: 1, segments: [{ kind: 'level', tiles: 1 }, { kind: 'descent', tiles: 6 }, { kind: 'level', tiles: 1 }], end: 'buffer' },
];

/** The row the ground of column `col` starts at (it is solid from there to the level's bottom); none in a pit. */
function groundRow(col: number): number {
  const pit = (p: { col0: number; col1: number }) => col >= p.col0 && col <= p.col1;
  if (pit(LAB_3T_LOW_PIT) || pit(LAB_3T_HIGH_PIT)) return Infinity;
  if (col <= LAB_3T_PLATEAU.col1) return LAB_3T_PLATEAU.row;
  const stair = LAB_3T_STAIRS.find((s) => col >= s.col0 && col <= s.col1);
  if (stair) return stair.row;
  if (col <= LAB_3T_DROP.col1) return LAB_3T_DROP.row;
  if (col <= LAB_3T_CHASM.col1) return LAB_3T_LOWEST.row;
  if (col >= LAB_3T_CART_PLATEAU.col0 && col <= LAB_3T_CART_PLATEAU.col1) return LAB_3T_CART_PLATEAU.row;
  return LAB_3T_CHASM.farRow;
}

const inBox = (col: number, row: number, box: { col0: number; col1: number }, row0: number, row1: number): boolean => col >= box.col0 && col <= box.col1 && row >= row0 && row <= row1;

export const LAB_3T_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) =>
  Array.from({ length: WIDTH }, (_tile, col) => {
    // A spring stands in its tile in place of the ground (GDD-WLD-05).
    if (LAB_3T_SPRINGS.some((s) => s.col === col && s.row === row)) return '.';
    if (row >= groundRow(col)) return '#';
    if (inBox(col, row, LAB_3T_LEDGE, LAB_3T_LEDGE.row, LAB_3T_LEDGE.row)) return '#';
    return inBox(col, row, LAB_3T_TOP, LAB_3T_TOP.row, LAB_3T_TOP.row + 1) ? '#' : '.';
  }).join(''),
);

const onGround = (col: number, row: number): { x: number; y: number } => ({ x: col * TILE + TILE / 2, y: row * TILE });

/** Poncho starts on the plateau at column 2. */
export const LAB_3T_SPAWN = onGround(2, LAB_3T_PLATEAU.row);

/** One on the drop's landing ground (column 16), one on the floating ledge before the lift (column 40), one on the highest ledge (column 46). */
export const LAB_3T_OFRENDAS: readonly Ofrenda[] = [
  { id: 'lab-3t-1', ...onGround(16, LAB_3T_DROP.row) },
  { id: 'lab-3t-2', ...onGround(40, LAB_3T_LEDGE.row) },
  { id: 'lab-3t-3', ...onGround(46, LAB_3T_TOP.row) },
];

export const LAB_3T_LEVEL: Level = {
  world: parseTiles(LAB_3T_ROWS),
  spawn: LAB_3T_SPAWN,
  ofrendas: LAB_3T_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: LAB_3T_SPRINGS,
  platforms: [LAB_3T_LIFT],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: [],
  rails: LAB_3T_RAILS,
  // GDD-MOV-07: the glide is on, for the chasm.
  abilities: { glide: true },
  bottoms: [LAB_3T_HIGH_BOTTOM],
};
