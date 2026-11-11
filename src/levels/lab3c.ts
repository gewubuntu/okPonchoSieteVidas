// GDD-WLD-15: lab-3c, a World 3 test level for the vagonetas (mine carts), opened with `?level=lab-3c` (GDD-UI-02). Like the other labs it
// has three ofrendas and no exit (GDD-TEC-04). 60 x 17 tiles; the floor's top is row 14 (y = 224). Four rails, left to right: R1, level for
// 20 tiles on the floor; R2, level, up and level onto a rock plateau 4 tiles high (64 px, more than a jump climbs, so only the cart gets
// him up), its slope over air (the trestle is art, not drawn yet); R3, from the plateau's top down to the floor; R4, rolling left. Each ends
// in a buffer. No enemy, no pit, no spike.
import { TILE } from '../config/tuning';
import type { Rail } from '../sim/cart';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

/** GDD-UI-02: its id, which its address names. */
export const LAB_3C_ID = 'lab-3c';

/** The floor's top: row 14. */
export const LAB_3C_FLOOR_Y = 14 * TILE;

/** The rock plateau R2 climbs onto and R3 rolls down from: columns 35 to 42, rows 10 to 13 (its top at y = 160, 64 px over the floor). */
export const LAB_3C_PLATEAU = { col0: 35, col1: 42, row: 10 } as const;

export const LAB_3C_ROWS: readonly string[] = Array.from({ length: 17 }, (_, row) => {
  if (row >= 14) return '#'.repeat(60);
  if (row >= LAB_3C_PLATEAU.row) return Array.from({ length: 60 }, (_tile, col) => (col >= LAB_3C_PLATEAU.col0 && col <= LAB_3C_PLATEAU.col1 ? '#' : '.')).join('');
  return '.'.repeat(60);
});

const PLATEAU_Y = LAB_3C_PLATEAU.row * TILE;

/** GDD-WLD-15: the four rails, R1 to R4, each with its cart standing at its start. */
export const LAB_3C_RAILS: readonly Rail[] = [
  // R1: columns 5 to 24 on the floor.
  { x: 5 * TILE, y: LAB_3C_FLOOR_Y, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' },
  // R2: from column 27, 4 tiles on the floor, 4 up over air to the plateau's top at its left edge (column 35), 4 on the plateau.
  { x: 27 * TILE, y: LAB_3C_FLOOR_Y, dir: 1, segments: [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 4 }], end: 'buffer' },
  // R3: from column 41 on the plateau, 2 tiles to its right edge, 4 down over air to the floor, 3 on the floor.
  { x: 41 * TILE, y: PLATEAU_Y, dir: 1, segments: [{ kind: 'level', tiles: 2 }, { kind: 'descent', tiles: 4 }, { kind: 'level', tiles: 3 }], end: 'buffer' },
  // R4: rolls left from the level's right edge, 8 tiles on the floor (columns 58 down to 51).
  { x: 59 * TILE, y: LAB_3C_FLOOR_Y, dir: -1, segments: [{ kind: 'level', tiles: 8 }], end: 'buffer' },
];

const onFloor = (col: number, y = LAB_3C_FLOOR_Y): { x: number; y: number } => ({ x: col * TILE + TILE / 2, y });

/** Poncho starts on the floor at column 3, before R1's cart. */
export const LAB_3C_SPAWN = onFloor(3);

/** An ofrenda before R2 (column 26), on the plateau before R3 (column 40), and between R3's buffer and R4 (column 50). */
export const LAB_3C_OFRENDAS: readonly Ofrenda[] = [
  { id: 'lab-3c-1', ...onFloor(26) },
  { id: 'lab-3c-2', ...onFloor(40, PLATEAU_Y) },
  { id: 'lab-3c-3', ...onFloor(50) },
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
