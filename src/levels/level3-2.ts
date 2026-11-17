// Level 3-2, "La Mina", the second level of World 3 (GDD-WLD-17, GDD-WLD-01): the galleries of an old silver mine, eight screens wide and
// one tall, 240 x 17 tiles (3840 x 272 px). It teaches the vagoneta (GDD-WLD-15) and the Armadillo (GDD-ENM-04), and the glide under a low
// roof, in four beats (kishōtenketsu):
// - Ki, columns 0 to 44: the cart with no way to fail. A step drops him into cart A; rail B rides a ramp down into the main gallery.
// - Shō, columns 45 to 111: the jump out, three times. Rail C's broken end over a sunken floor, rail D's the same over a pit, rail E's
//   hanging beam to hop and the rib that ends the ride.
// - Ten, columns 112 to 182: the Armadillo's pen under a low roof, two short hops, then rail F runs down the gallery's enemies and dives
//   down a ramp into a cutting whose broken end hangs over spikes; the way on is the ledge above it.
// - Ketsu, columns 183 to 239: three carts in a chain (K1, K2 with a hanging beam, K3 down a ramp to the cutting under the exit).
// `#` is solid, `.` empty, `\` a slope down to the right (the ramps, GDD-MOV-09). A floor stretch is solid from its top row down to the
// level's last row, a roof from row 0 down to its last row; a pit is open to the level's bottom. A rail lies in the row above its ground
// (its `y` is the ground's top) and is scenery to Poncho; each rail's cart stands at its start, its back edge on the rail's start.
import { TILE } from '../config/tuning';
import type { Rail } from '../sim/cart';
import type { Enemy } from '../sim/enemy';
import type { Spike } from '../sim/hazards';
import type { Hilo } from '../sim/hilo';
import type { Pinata } from '../sim/pinata';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { Veladora } from '../sim/veladora';

const WIDTH = 240;
const HEIGHT = 17;

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** A stretch of columns `col0` to `col1` (both included) and a row: a floor's top row, a roof's last row, a ramp's first slope row. */
export interface Stretch {
  readonly col0: number;
  readonly col1: number;
  readonly row: number;
}

/** A run of pit columns `col0` to `col1` (both included). */
export interface Span {
  readonly col0: number;
  readonly col1: number;
}

/** A solid block over columns `col0` to `col1` and rows `row0` to `row1` (all included). */
export interface Piece {
  readonly col0: number;
  readonly col1: number;
  readonly row0: number;
  readonly row1: number;
}

const stretch = (col0: number, col1: number, row: number): Stretch => ({ col0, col1, row });

/** GDD-WLD-17: the floor under rail C's end, sunken 2 tiles (row 15), with a 2-tile wall on each side. */
export const LEVEL_3_2_SUNKEN: Stretch = { col0: 58, col1: 62, row: 15 };

/**
 * GDD-WLD-17: the pits, open to the level's bottom: D, under rail D's end (5 tiles, its far bank 3 tiles past the rail's end); the second
 * short hop under the low roof, right of the pillar; F, under rail F's trestle; K1's trestle pit and K1's broken end; K2's broken end.
 */
export const LEVEL_3_2_PIT_D: Span = { col0: 80, col1: 84 };
export const LEVEL_3_2_PITS = {
  D: LEVEL_3_2_PIT_D,
  hop2: { col0: 137, col1: 138 },
  F: { col0: 144, col1: 146 },
  K1Trestle: { col0: 188, col1: 190 },
  K1: { col0: 196, col1: 200 },
  K2: { col0: 216, col1: 221 },
} as const satisfies Record<string, Span>;

/** GDD-WLD-17: the seat, a 2-tile block (top row 11, 32 px over the pen's floor) left of the Armadillo's pen. */
export const LEVEL_3_2_SEAT: Stretch = { col0: 116, col1: 117, row: 11 };
/** GDD-WLD-17: the Armadillo's pen, its floor row 13 under a roof 6 tiles up (the table's 5, one row higher: the designer's change). */
export const LEVEL_3_2_PEN: Stretch = { col0: 118, col1: 128, row: 13 };
/** GDD-WLD-17: the pen's far wall, 2 tiles high (top row 11). */
export const LEVEL_3_2_FAR_WALL: Stretch = { col0: 129, col1: 130, row: 11 };
/**
 * GDD-WLD-17: the first short hop, between the pen's far wall and the pillar: a floor sunken 2 tiles (row 13), not a pit, so a missed
 * first hop costs nothing and he climbs out over a 2-tile wall either side (the designer's change after the hops were measured).
 */
export const LEVEL_3_2_HOP1_FLOOR: Stretch = { col0: 131, col1: 132, row: 13 };
/** GDD-WLD-17: the pillar between the two short hops. */
export const LEVEL_3_2_PILLAR: Stretch = { col0: 133, col1: 136, row: 11 };
/** GDD-WLD-17: the island where cart F stands. */
export const LEVEL_3_2_ISLAND: Stretch = { col0: 139, col1: 143, row: 11 };
/** GDD-WLD-17: the gallery floor rail F runs down its enemies on. */
export const LEVEL_3_2_GALLERY: Stretch = { col0: 147, col1: 164, row: 11 };
/** GDD-WLD-17: rail F's cutting, its floor 4 tiles under the gallery's. */
export const LEVEL_3_2_CUTTING_F: Stretch = { col0: 169, col1: 175, row: 15 };
/** GDD-WLD-17: the spike hollow under rail F's end, its floor in the level's last row, its three spikes in row 15; column 179 is its wall. */
export const LEVEL_3_2_HOLLOW: Stretch = { col0: 176, col1: 178, row: 16 };
/** GDD-WLD-17: rail K3's cutting under the exit's ledge, where the veladora is. */
export const LEVEL_3_2_CUTTING_K3: Stretch = { col0: 232, col1: 238, row: 15 };

/**
 * GDD-WLD-17: the ramps, slope tiles one row down per column (GDD-MOV-09), each given by its columns and the row of its first slope tile:
 * B's from the upper gallery (row 9) to the main gallery (row 13), F's and K3's from the upper level (row 11) into their cuttings (row 15).
 */
export const LEVEL_3_2_RAMPS = {
  B: stretch(30, 33, 9),
  F: stretch(165, 168, 11),
  K3: stretch(228, 231, 11),
} as const satisfies Record<string, Stretch>;

/** GDD-WLD-17: the floor's top row, left to right; the columns no stretch holds are the pits and the ramps. */
export const LEVEL_3_2_FLOOR: readonly Stretch[] = [
  stretch(0, 7, 8), // the start, a step one tile over the upper gallery
  stretch(8, 29, 9), // the upper gallery
  stretch(34, LEVEL_3_2_SUNKEN.col0 - 1, 13), // the main gallery
  LEVEL_3_2_SUNKEN,
  stretch(LEVEL_3_2_SUNKEN.col1 + 1, LEVEL_3_2_PIT_D.col0 - 1, 13),
  stretch(LEVEL_3_2_PIT_D.col1 + 1, LEVEL_3_2_SEAT.col0 - 1, 13),
  LEVEL_3_2_SEAT,
  LEVEL_3_2_PEN,
  LEVEL_3_2_FAR_WALL,
  LEVEL_3_2_HOP1_FLOOR,
  LEVEL_3_2_PILLAR,
  LEVEL_3_2_ISLAND,
  LEVEL_3_2_GALLERY,
  LEVEL_3_2_CUTTING_F,
  LEVEL_3_2_HOLLOW,
  stretch(179, 187, 11), // the hollow's wall and the third ofrenda's floor, K1's start
  stretch(191, 195, 11), // K1's bank, between its two pits
  stretch(201, 215, 11), // K2's start
  stretch(222, 227, 11), // K3's start, before its ramp
  LEVEL_3_2_CUTTING_K3,
  stretch(239, 239, 11), // the cutting's far wall
];

/**
 * GDD-WLD-17: the roof, solid from row 0 down to `row`: the start, the upper gallery, the main gallery, the pen, the hops, the upper level.
 * The start's is row 0 only, so the spawn has 7 tiles of open air over it (GDD-WLD-03's rule for a respawn; the table's 6 was a slip).
 */
export const LEVEL_3_2_ROOF: readonly Stretch[] = [
  stretch(0, 7, 0),
  stretch(8, 33, 1),
  stretch(34, 117, 4),
  stretch(118, 128, 6), // the pen's: one row higher than the table's (6 tiles of room), as the hops' after it
  stretch(129, 138, 6),
  stretch(139, 239, 2),
];

/** GDD-WLD-15, GDD-WLD-17: the two hanging beams, one tile each, their undersides 2 tiles (32 px) over their rails' ground. */
export const LEVEL_3_2_BEAMS = {
  E: { col: 97, row: 10 },
  K2: { col: 209, row: 8 },
} as const;

/** GDD-WLD-15, GDD-WLD-17: the rib over rail E, the roof coming down to the beam's height; it ends every ride on E. */
export const LEVEL_3_2_RIB: Piece = { col0: 104, col1: 106, row0: 5, row1: 10 };

/**
 * GDD-WLD-17: the two cutting ledges, one tile thick (row 11), 3 tiles over their rails' ground; each one's lip is its first column (F's at
 * 169, x = 2704; K3's at 232). F's runs on over the spike hollow to its wall at 179. GDD-WLD-17 leaves this open: the table puts the ledge
 * over 169 to 175; that it covers the hollow too is read from the hollow's "4 tiles of headroom" and the ofrenda past it at 181.
 */
export const LEVEL_3_2_LEDGES = {
  F: stretch(169, 178, 11),
  K3: stretch(232, 238, 11),
} as const satisfies Record<string, Stretch>;

const PIECES: readonly Piece[] = [
  ...Object.values(LEVEL_3_2_BEAMS).map((b) => ({ col0: b.col, col1: b.col, row0: b.row, row1: b.row })),
  LEVEL_3_2_RIB,
  ...Object.values(LEVEL_3_2_LEDGES).map((l) => ({ col0: l.col0, col1: l.col1, row0: l.row, row1: l.row })),
];

const within = (s: { col0: number; col1: number }, col: number) => col >= s.col0 && col <= s.col1;

function tileAt(col: number, row: number): string {
  if (LEVEL_3_2_ROOF.some((r) => within(r, col) && row <= r.row)) return '#';
  if (PIECES.some((p) => within(p, col) && row >= p.row0 && row <= p.row1)) return '#';
  const ramp = Object.values(LEVEL_3_2_RAMPS).find((r) => within(r, col));
  if (ramp) {
    const slope = ramp.row + col - ramp.col0;
    return row === slope ? '\\' : row > slope ? '#' : '.';
  }
  const floor = LEVEL_3_2_FLOOR.find((f) => within(f, col));
  return floor !== undefined && row >= floor.row ? '#' : '.';
}

export const LEVEL_3_2_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) => Array.from({ length: WIDTH }, (_tile, col) => tileAt(col, row)).join(''));

/**
 * GDD-WLD-15, GDD-WLD-17: the nine rails by letter, each with its cart standing at its start. GDD-WLD-17 leaves this open: its table starts
 * the stretches of B, C, D, E, F and K1 one column before their carts (B's "back buffer 24"); a rail here starts at its cart's back edge,
 * as the level format has it, so the carts stand where the table puts them. A buffer "in column N" is the rail ending at that column's
 * left edge, which gives the table's rides (A's 12 tiles, B's 1.78 s, K3's 1.6 s).
 */
export const LEVEL_3_2_RAIL = {
  // A: columns 8 to 21 on the upper gallery's floor, its buffer in column 22.
  A: { x: 8 * TILE, y: 9 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 14 }], end: 'buffer' },
  // B: columns 25 to 29 on the upper gallery's floor, down the ramp (30 to 33), 34 to 42 on the main gallery's, its buffer in column 43.
  B: { x: 25 * TILE, y: 9 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 5 }, { kind: 'descent', tiles: 4 }, { kind: 'level', tiles: 9 }], end: 'buffer' },
  // C: columns 46 to 59, 58 and 59 on a trestle over the sunken floor; its torn end at x = 960.
  C: { x: 46 * TILE, y: 13 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 14 }], end: 'broken' },
  // D: C's twin, columns 68 to 81, 80 and 81 on a trestle over pit D; its torn end at x = 1312.
  D: { x: 68 * TILE, y: 13 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 14 }], end: 'broken' },
  // E: columns 88 to 107, under the hanging beam (97) and the rib (104 to 106), its buffer in column 108.
  E: { x: 88 * TILE, y: 13 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' },
  // F: columns 140 to 164 on the island and the gallery (144 to 146 on a trestle), down the ramp (165 to 168), 169 to 175 in the cutting; its
  // torn end at x = 2816 over the spike hollow.
  F: { x: 140 * TILE, y: 11 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 25 }, { kind: 'descent', tiles: 4 }, { kind: 'level', tiles: 7 }], end: 'broken' },
  // K1: columns 184 to 197, 188 to 190 and 196, 197 on trestles; its torn end at x = 3168.
  K1: { x: 184 * TILE, y: 11 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 14 }], end: 'broken' },
  // K2: columns 201 to 217, under the hanging beam (209), 216 and 217 on a trestle; its torn end at x = 3488.
  K2: { x: 201 * TILE, y: 11 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 17 }], end: 'broken' },
  // K3: columns 222 to 227, down the ramp (228 to 231), 232 to 237 in the cutting, its buffer in column 238.
  K3: { x: 222 * TILE, y: 11 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 6 }, { kind: 'descent', tiles: 4 }, { kind: 'level', tiles: 6 }], end: 'buffer' },
} as const satisfies Record<string, Rail>;

/** The rails in the level's order, A to K3: a cart's index in a run's `carts` is its rail's here. */
export const LEVEL_3_2_RAILS: readonly Rail[] = Object.values(LEVEL_3_2_RAIL);

/** GDD-WLD-17: the spawn, on the start's step at column 3. */
export const LEVEL_3_2_SPAWN = { x: mid(3), y: 8 * TILE } as const;

/**
 * GDD-WLD-03, GDD-WLD-17: the ofrendas' columns, each on plain floor after a ride's end and 3 to 30 tiles before the next cart's start: on
 * rail C's far bank (65), past rail E's buffer (110), past the spike hollow (181).
 */
export const LEVEL_3_2_OFRENDA_COLS: readonly number[] = [65, 110, 181];
const OFRENDA_ROWS: readonly number[] = [13, 13, 11];
const OFRENDAS: readonly Ofrenda[] = LEVEL_3_2_OFRENDA_COLS.map((col, i) => ({ id: `3-2-${i + 1}`, x: mid(col), y: OFRENDA_ROWS[i]! * TILE }));

/** GDD-WLD-05: rail F's three spikes in the hollow under its end. */
const SPIKES: readonly Spike[] = [176, 177, 178].map((col) => ({ col, row: 15 }));

/**
 * GDD-PWR-05: one piñata, 48 px over the main gallery's floor, two columns clear of the seat (113: at 114 its taco fell onto the seat and
 * walked into the pen).
 */
const PINATAS: readonly Pinata[] = [{ col: 113, row: 9 }];

/**
 * GDD-ENM-02, GDD-ENM-04, GDD-WLD-17: where the enemies start, in this order: the pen's Armadillo; the gallery's Alacrán, Armadillo and
 * Alacrán, which rail F's cart runs down; K1's Alacrán on the bank between its pits.
 */
export const LEVEL_3_2_ENEMIES: readonly Enemy[] = [
  { x: mid(126), y: 13 * TILE, kind: 'armadillo' },
  { x: mid(149), y: 11 * TILE },
  { x: mid(153), y: 11 * TILE, kind: 'armadillo' },
  { x: mid(157), y: 11 * TILE },
  { x: mid(193), y: 11 * TILE },
];

/**
 * GDD-WLD-04, GDD-WLD-17: 50 hilos as (column, row) tiles, in the GDD's groups. A rider's hilo hangs 3 rows over its rail's ground, where a
 * rider's head touches it and a walker's does not.
 */
export const LEVEL_3_2_RIDER_HILOS = {
  A: [[12, 6], [15, 6], [18, 6]],
  B: [[26, 6], [37, 10], [40, 10]],
  C: [[52, 10]],
  D: [[73, 10]],
  E: [[93, 10]],
  F: [[145, 8], [150, 8], [154, 8], [158, 8]],
  K1: [[188, 8], [191, 8]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;

const HILOS: readonly Hilo[] = [
  // The start, leading off the step into cart A.
  [4, 7], [5, 7],
  // Riders', along a ride.
  ...Object.values(LEVEL_3_2_RIDER_HILOS).flat(),
  // Down B's ramp.
  [31, 8], [32, 9], [33, 10],
  // A jump out, an arc from the cart's last tiles to where he lands: C, D, F (and one on the ledge), K1, K2, K3.
  [59, 9], [61, 8], [64, 11],
  [81, 9], [83, 8], [86, 11],
  [164, 8], [166, 6], [168, 7], [171, 9],
  [197, 7], [199, 6], [202, 9],
  [217, 7], [219, 6], [223, 9],
  [227, 8], [229, 6], [231, 7],
  // Over a beam, at the hop's top; under the rib, on the walking row.
  [97, 8], [209, 6],
  [104, 12], [106, 12],
  // On foot: the seat, the pen's jump line, one in each hop.
  [116, 9],
  [121, 10], [123, 10], [125, 10],
  [132, 9], [138, 9],
  // The secret.
  [236, 13],
].map(([col, row]) => ({ col, row }));

/** GDD-LIFE-03, GDD-WLD-03: the secret, the veladora at rail K3's buffer in the cutting under the exit, in plain view. */
const VELADORA: Veladora = { col: 238, row: 13 };

/**
 * GDD-WLD-17: 3-2 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit, the lift cage of the GDD, is the
 * level format's one exit (GDD-WLD-03's arch), at column 234 on the last ledge.
 */
export const LEVEL_3_2: Level = {
  world: parseTiles(LEVEL_3_2_ROWS),
  spawn: LEVEL_3_2_SPAWN,
  ofrendas: OFRENDAS,
  spikes: SPIKES,
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: PINATAS,
  doors: [],
  keys: [],
  fragiles: [],
  enemies: LEVEL_3_2_ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: mid(234), y: 11 * TILE },
  // GDD-PRG-01: World 3's levels are never played without the glide.
  abilities: { glide: true },
  rails: LEVEL_3_2_RAILS,
};
