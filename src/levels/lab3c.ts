// GDD-WLD-15: lab-3c, a World 3 test level for the vagonetas (mine carts), opened with `?level=lab-3c` (GDD-UI-02). Like the other labs it
// has three ofrendas and no exit (GDD-TEC-04). 120 x 17 tiles; the floor's top is row 14 (y = 224). Six rails, left to right: R1, level for
// 20 tiles on the floor; R2, level, up and level onto a rock plateau 4 tiles high (64 px, more than a jump climbs, so only the cart gets him
// up), its slope over air (the trestle is art, not drawn yet); R3, from the plateau's top down to the floor; R4, rolling left; each of these
// ends in a buffer. R5, level for 20 tiles under a hanging low beam, its broken end over a pit 3 tiles wide whose far bank is at the same
// height; R6, level for 12 tiles, its broken end over a floor sunken 2 tiles, 6 tiles long, with a wall 2 tiles high back up. Each broken
// rail ends at the lip of the ground under it, as a real level's do. No enemy and no spike.
import { TILE } from '../config/tuning';
import type { Rail } from '../sim/cart';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

/** GDD-UI-02: its id, which its address names. */
export const LAB_3C_ID = 'lab-3c';

/** The floor's top: row 14. */
export const LAB_3C_FLOOR_Y = 14 * TILE;

const WIDTH = 120;
const FLOOR_ROW = LAB_3C_FLOOR_Y / TILE;

/** The rock plateau R2 climbs onto and R3 rolls down from: columns 35 to 42, rows 10 to 13 (its top at y = 160, 64 px over the floor). */
export const LAB_3C_PLATEAU = { col0: 35, col1: 42, row: 10 } as const;

/**
 * GDD-WLD-15: the pit past R5's broken end, columns 82 to 84 open to the level's bottom: 3 tiles, so a plain jump from the cart taken up to 2
 * tiles before the end crosses it (GDD: the world's first broken end is at most 3 tiles from its bank; over 4 tiles it would have to be
 * taken within 29 px of the end). World 3 allows 6 (GDD-WLD-03).
 */
export const LAB_3C_PIT = { col0: 82, col1: 84 } as const;

/** GDD-WLD-15: the floor past R6's broken end, sunken 2 tiles to the bottom row (its top at y = 256), columns 103 to 108; column 109 is the wall back up. */
export const LAB_3C_SUNKEN = { col0: 103, col1: 108, row: 16 } as const;

/** GDD-WLD-15: the hanging low beam over R5, one tile with open space over it, its underside 2 tiles (32 px) over the rail's ground. */
export const LAB_3C_BEAM = { col: 68, row: FLOOR_ROW - 3 } as const;

export const LAB_3C_ROWS: readonly string[] = Array.from({ length: 17 }, (_, row) =>
  Array.from({ length: WIDTH }, (_tile, col) => {
    if (col >= LAB_3C_PIT.col0 && col <= LAB_3C_PIT.col1) return '.';
    if (col >= LAB_3C_SUNKEN.col0 && col <= LAB_3C_SUNKEN.col1) return row >= LAB_3C_SUNKEN.row ? '#' : '.';
    if (row >= FLOOR_ROW) return '#';
    if (row >= LAB_3C_PLATEAU.row && col >= LAB_3C_PLATEAU.col0 && col <= LAB_3C_PLATEAU.col1) return '#';
    return col === LAB_3C_BEAM.col && row === LAB_3C_BEAM.row ? '#' : '.';
  }).join(''),
);

const PLATEAU_Y = LAB_3C_PLATEAU.row * TILE;

/** GDD-WLD-15: the six rails, R1 to R6, each with its cart standing at its start. */
export const LAB_3C_RAILS: readonly Rail[] = [
  // R1: columns 5 to 24 on the floor.
  { x: 5 * TILE, y: LAB_3C_FLOOR_Y, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' },
  // R2: from column 27, 4 tiles on the floor, 4 up over air to the plateau's top at its left edge (column 35), 4 on the plateau.
  { x: 27 * TILE, y: LAB_3C_FLOOR_Y, dir: 1, segments: [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 4 }], end: 'buffer' },
  // R3: from column 41 on the plateau, 2 tiles to its right edge, 4 down over air to the floor, 3 on the floor.
  { x: 41 * TILE, y: PLATEAU_Y, dir: 1, segments: [{ kind: 'level', tiles: 2 }, { kind: 'descent', tiles: 4 }, { kind: 'level', tiles: 3 }], end: 'buffer' },
  // R4: rolls left from column 58's right edge, 8 tiles on the floor (columns 58 down to 51).
  { x: 59 * TILE, y: LAB_3C_FLOOR_Y, dir: -1, segments: [{ kind: 'level', tiles: 8 }], end: 'buffer' },
  // R5: columns 62 to 81 on the floor, ending at the pit's lip; broken.
  { x: 62 * TILE, y: LAB_3C_FLOOR_Y, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'broken' },
  // R6: columns 91 to 102 on the floor, ending at the sunken floor's lip; broken.
  { x: 91 * TILE, y: LAB_3C_FLOOR_Y, dir: 1, segments: [{ kind: 'level', tiles: 12 }], end: 'broken' },
];

const onFloor = (col: number, y = LAB_3C_FLOOR_Y): { x: number; y: number } => ({ x: col * TILE + TILE / 2, y });

/** Poncho starts on the floor at column 3, before R1's cart. */
export const LAB_3C_SPAWN = onFloor(3);

/**
 * An ofrenda before R2 (column 26), on the plateau before R3 (column 40), and between R4's start and R5's (column 60), clear of every buffer,
 * rail end and cart, so a respawn after R5's pit finds its cart back at its start.
 */
export const LAB_3C_OFRENDAS: readonly Ofrenda[] = [
  { id: 'lab-3c-1', ...onFloor(26) },
  { id: 'lab-3c-2', ...onFloor(40, PLATEAU_Y) },
  { id: 'lab-3c-3', ...onFloor(60) },
];

export const LAB_3C_LEVEL: Level = {
  world: parseTiles(LAB_3C_ROWS),
  spawn: LAB_3C_SPAWN,
  ofrendas: LAB_3C_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: [],
  rails: LAB_3C_RAILS,
};
