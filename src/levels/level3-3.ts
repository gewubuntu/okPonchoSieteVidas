// Level 3-3, "Las Cumbres", the third level of World 3 (GDD-WLD-18, GDD-WLD-01): eight screens wide and a little over two tall, 240 x 37
// tiles (3840 x 592 px). From the mine's lift cage up timber trestles and peaks to the gable of the engine shed: the level ends 19 tiles above
// its start. It brings the Cacomixtle (GDD-ENM-04) and is World 3's test, in four beats (kishōtenketsu):
// - Ki, columns 0 to 66: the trestle, then the Cacomixtle alone. Cart C1 up rail R1's trestle to the first peak P1, the lift MP0 up from the
//   valley shelf, K1 met uphill with the perch to step onto, the terrace T1 with the first piñata and ofrenda.
// - Shō, columns 65 to 130: the glide from cart C2 over the chasm to L1, the spring and MP1 back up to P3, the Armadillo under a row of
//   bats, and a glide on foot to P4.
// - Ten, columns 127 to 180: the trestle falls. Cart C3 over plank bridge A, bridge B on foot past K2 with one stone pier.
// - Ketsu, columns 176 to 239: K3 under the vulture on P5, the lift MP2 up to the shelf A, the plank stairs to P6, cart C4 down rail R7 and
//   the exit glide to the bank under the shed's gable.
// A ground stretch is solid from its top row down to the level's last row. The pits are open to their raised bottoms (GDD-WLD-03), the
// first one to the level's last row. A rail lies on the ground line y = 16 r of its row r and is scenery to Poncho; each rail's cart stands
// at its start, its back edge on the rail's start. Not registered in `index.ts` yet (phase B), as lab-3k was before its art.
import { CART, TILE } from '../config/tuning';
import type { Bottom } from '../sim/bottoms';
import type { Rail } from '../sim/cart';
import type { Crumble } from '../sim/crumble';
import type { Enemy } from '../sim/enemy';
import type { Hilo } from '../sim/hilo';
import type { Pinata } from '../sim/pinata';
import type { MovingPlatform } from '../sim/platform';
import type { Level, Ofrenda } from '../sim/run';
import type { Spring } from '../sim/spring';
import { parseTiles } from '../sim/tilemap';
import type { Veladora } from '../sim/veladora';

const WIDTH = 240;
const HEIGHT = 37;

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** A stretch of columns `col0` to `col1` (both included) and a row: a ground's top row, a plank's row. */
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

/**
 * GDD-WLD-18: the ground by name, each solid from its top row down to the level's last row. The landing G0, in three parts: C1's dip one row
 * lower at columns 5 and 6, so its cart's floor is 8 px under G0's top and he walks off G0 onto it; the valley shelf; the first peak P1; the
 * terrace T1, its step one row higher under R2's row-27 stretch (54 to 58); the peak P2; the ledge L1; the third peak P3; P4; the stone Q;
 * bridge B's pier; P5; the shelf A; the last peak P6; the shelf under R7; the exit bank; the shed's stone gable. Each column is in one
 * stretch. GDD-WLD-18 gives no row to columns 32 and 33 under MP0, nor to 199 to 201 under MP2: each is ground at its lift's foot, flush
 * with the lift's lowest top (the shelf's row 35 and P5's row 25), since the GDD counts four open pits and has him land "on P5 or the lift's
 * foot" off A.
 */
export const LEVEL_3_3_AT = {
  G0: stretch(0, 4, 34),
  dip: stretch(5, 6, 35),
  G0b: stretch(8, 9, 34),
  shelf: stretch(14, 31, 35),
  mp0Foot: stretch(32, 33, 35),
  P1: stretch(34, 52, 26),
  T1step: stretch(54, 58, 27),
  T1: stretch(59, 71, 28),
  P2: stretch(75, 88, 25),
  L1: stretch(99, 107, 29),
  P3: stretch(108, 119, 22),
  P4: stretch(127, 140, 25),
  Q: stretch(153, 159, 25),
  pier: stretch(167, 167, 25),
  P5: stretch(176, 198, 25),
  mp2Foot: stretch(199, 201, 25),
  A: stretch(202, 210, 17),
  P6: stretch(211, 215, 9),
  shelf7: stretch(219, 225, 12),
  bank: stretch(232, 234, 15),
  gable: stretch(235, 239, 4),
} as const satisfies Record<string, Stretch>;

export const LEVEL_3_3_GROUND: readonly Stretch[] = Object.values(LEVEL_3_3_AT);

/**
 * GDD-WLD-18: the slopes under the rails, slope tiles one row per column (GDD-MOV-09), each given by its columns, the row of its first
 * slope tile and its tile (`\` falls to the right, `/` rises): R1's out of C1's dip (row 35) up to G0 (row 34), so its climb lies on ground; R2's from P1 (row 26) to T1's step (row 27), R3's from T1 up to P2 (row 25), R7's
 * from P6 (row 9) to the shelf under it (row 12).
 */
export const LEVEL_3_3_SLOPES = {
  R1: { col0: 7, col1: 7, row: 34, tile: '/' },
  R2: { col0: 53, col1: 53, row: 26, tile: '\\' },
  R3: { col0: 72, col1: 74, row: 27, tile: '/' },
  R7: { col0: 216, col1: 218, row: 9, tile: '\\' },
} as const satisfies Record<string, Stretch & { readonly tile: '\\' | '/' }>;

/**
 * GDD-WLD-03, GDD-WLD-18: the open pits: the first (10 to 13, to the shelf 1 down), the chasm (89 to 98, to L1 4 down), the pit after P3
 * (120 to 126, 3 down) and the exit pit (226 to 231, 3 down); and the pits under bridge A (141 to 152) and bridge B's two spans (160 to 166,
 * 168 to 175), their planks the banks.
 */
export const LEVEL_3_3_PITS = {
  first: { col0: 10, col1: 13 },
  chasm: { col0: 89, col1: 98 },
  afterP3: { col0: 120, col1: 126 },
  bridgeA: { col0: 141, col1: 152 },
  bridgeB1: { col0: 160, col1: 166 },
  bridgeB2: { col0: 168, col1: 175 },
  exit: { col0: 226, col1: 231 },
} as const satisfies Record<string, Span>;

/**
 * GDD-WLD-03: the raised bottoms, each 4 rows under the lower of its pit's two lips: the chasm (lips at rows 25 and 29), the pit after P3 (22
 * and 25), bridge A's (both lips at 25) and the exit pit (12 and 15); bridge B's (both lips at 25, the pier inside its span solid all the way
 * down) 6 rows under them, so the camera's bottom limit there (31 + 1) * 16 - 2 - 270 = 240 lets it follow him to 238 over the planks and
 * K2's cart is clear of the phone's buttons (GDD-ENM-04 (h), GDD-UI-04). The first pit's lower lip is row 35, so 4 rows under it (row 39)
 * is past the level's last row (36): it is open to the level's last row.
 */
export const LEVEL_3_3_BOTTOMS: readonly Bottom[] = [
  { fromCol: 89, toCol: 98, row: 33 },
  { fromCol: 120, toCol: 126, row: 29 },
  { fromCol: 141, toCol: 152, row: 29 },
  { fromCol: 160, toCol: 175, row: 31 },
  { fromCol: 226, toCol: 231, row: 19 },
];

/**
 * GDD-WLD-18: the secret's pier V, a hollow under the rail he rode in on: a wall at column 22 from row 26 down, a floor at 23 and 24 (row 31)
 * and a cap in row 26 over 22 to 25 that carries the rail and hangs 1 tile past the floor. The hollow, rows 27 to 30, opens to the right.
 */
export const LEVEL_3_3_HOLLOW = {
  wall: { col0: 22, col1: 22, row0: 26, row1: HEIGHT - 1 },
  floor: { col0: 23, col1: 24, row0: 31, row1: HEIGHT - 1 },
  cap: { col0: 22, col1: 25, row0: 26, row1: 26 },
} as const satisfies Record<string, Piece>;

/**
 * GDD-WLD-18, L-047: the piñatas' walls, 2 tiles high, one empty column before each piñata: at 62 on T1 and at 132 on P4. GDD-WLD-18 gives
 * the first one's height; the second's is read as the same (its hilo at row 22 sits on its top, as the first's at row 25).
 */
export const LEVEL_3_3_WALLS = {
  T1: { col0: 62, col1: 62, row0: 26, row1: 27 },
  P4: { col0: 132, col1: 132, row0: 23, row1: 24 },
} as const satisfies Record<string, Piece>;

const PIECES: readonly Piece[] = [...Object.values(LEVEL_3_3_HOLLOW), ...Object.values(LEVEL_3_3_WALLS)];

/** GDD-WLD-05, GDD-WLD-18: the spring at column 106, set into L1's top (an empty tile in the rows, as in the sandbox), under MP1. */
export const LEVEL_3_3_SPRING: Spring = { col: 106, row: LEVEL_3_3_AT.L1.row };

const within = (s: { col0: number; col1: number }, col: number) => col >= s.col0 && col <= s.col1;

function tileAt(col: number, row: number): string {
  if (col === LEVEL_3_3_SPRING.col && row === LEVEL_3_3_SPRING.row) return '.';
  if (PIECES.some((p) => within(p, col) && row >= p.row0 && row <= p.row1)) return '#';
  const slope = Object.values(LEVEL_3_3_SLOPES).find((s) => within(s, col));
  if (slope) {
    const top = slope.tile === '\\' ? slope.row + col - slope.col0 : slope.row - (col - slope.col0);
    return row === top ? slope.tile : row > top ? '#' : '.';
  }
  const ground = LEVEL_3_3_GROUND.find((g) => within(g, col));
  return ground !== undefined && row >= ground.row ? '#' : '.';
}

export const LEVEL_3_3_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) => Array.from({ length: WIDTH }, (_tile, col) => tileAt(col, row)).join(''));

/**
 * GDD-WLD-15, GDD-WLD-18: the seven rails, each with its cart standing at its start. A rail rolling right starts at its cart's back edge,
 * as the level format has it, so the carts stand where GDD-WLD-18 puts them: C2 at 68, C3 at 137 and C4 at 212 (its rail lists start R3,
 * R4 and R7 one column earlier, at 67, 136 and 211, as 3-2's table did). A rail rolling left starts at its cart's right edge; the buffer
 * GDD-WLD-18 puts behind each Cacomixtle's cart (59, 179, 198) is that start, which the format does not draw. A buffer "at column N" is the
 * rail ending at the edge of that column it meets first.
 */
export const LEVEL_3_3_RAIL = {
  // R1, C1's: level in row 35 in G0's dip (5, 6), up 7 (its line through G0's tile there), level in row 34 (8 to 10), up 11 to 14, level in
  // row 30 (15, 16), up 17 to 20, level in row 26 (21 to 38); its buffer at 39.
  R1: {
    x: 5 * TILE,
    y: 35 * TILE,
    dir: 1,
    segments: [
      { kind: 'level', tiles: 2 },
      { kind: 'climb', tiles: 1 },
      { kind: 'level', tiles: 3 },
      { kind: 'climb', tiles: 4 },
      { kind: 'level', tiles: 2 },
      { kind: 'climb', tiles: 4 },
      { kind: 'level', tiles: 18 },
    ],
    end: 'buffer',
  },
  // R2, K1's, rolling left: level in row 27 (58 down to 54) on T1's step, up the slope (53), level in row 26 (52 down to 42); its buffer at 41.
  R2: { x: 59 * TILE, y: 27 * TILE, dir: -1, segments: [{ kind: 'level', tiles: 5 }, { kind: 'climb', tiles: 1 }, { kind: 'level', tiles: 11 }], end: 'buffer' },
  // R3, C2's: level in row 28 (68 to 71), up 72 to 74, level in row 25 (75 to 89, 1 tile past P2's lip); its broken end at x = 1440.
  R3: { x: 68 * TILE, y: 28 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 3 }, { kind: 'level', tiles: 15 }], end: 'broken' },
  // R4, C3's: level in row 25 (137 to 155) over bridge A's planks; its buffer at 156 on the stone Q.
  R4: { x: 137 * TILE, y: 25 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 19 }], end: 'buffer' },
  // R5, K2's, rolling left: level in row 25 (178 down to 158) over bridge B; its buffer at 157.
  R5: { x: 179 * TILE, y: 25 * TILE, dir: -1, segments: [{ kind: 'level', tiles: 21 }], end: 'buffer' },
  // R6, K3's, rolling left: level in row 25 (197 down to 182) on P5; its buffer at 181.
  R6: { x: 198 * TILE, y: 25 * TILE, dir: -1, segments: [{ kind: 'level', tiles: 16 }], end: 'buffer' },
  // R7, C4's: level in row 9 (212 to 215), down 216 to 218, level in row 12 (219 to 226, 1 tile past the shelf's lip); its broken end at
  // x = 3632.
  R7: { x: 212 * TILE, y: 9 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 4 }, { kind: 'descent', tiles: 3 }, { kind: 'level', tiles: 8 }], end: 'broken' },
} as const satisfies Record<string, Rail>;

/** The rails in the level's order, R1 to R7: a cart's index in a run's `carts` is its rail's here. */
export const LEVEL_3_3_RAILS: readonly Rail[] = Object.values(LEVEL_3_3_RAIL);

/**
 * GDD-WLD-05, GDD-WLD-18: the lifts and the perch, each at 40 px/s from its first end, `y` its top: MP0 (columns 32 and 33) from the shelf's
 * top (y = 560) up to P1's (416); the perch (42 and 43), still, its top 40 px over P1, over K1's cart parked at its buffer and short of its
 * wake line (x = 728); MP1 (105 to 107) from 416 up to P3's top (352); MP2 (199 to 201) from P5's top (400) up to 272.
 */
export const LEVEL_3_3_PLATFORM = {
  MP0: { x0: 32 * TILE, y0: 560, x1: 32 * TILE, y1: 416, w: 2 * TILE },
  perch: { x0: 42 * TILE, y0: LEVEL_3_3_AT.P1.row * TILE - 40, x1: 42 * TILE, y1: LEVEL_3_3_AT.P1.row * TILE - 40, w: 2 * TILE },
  MP1: { x0: 105 * TILE, y0: 416, x1: 105 * TILE, y1: 352, w: 3 * TILE },
  MP2: { x0: 199 * TILE, y0: 400, x1: 199 * TILE, y1: 272, w: 3 * TILE },
} as const satisfies Record<string, MovingPlatform>;

/**
 * GDD-WLD-05, GDD-WLD-18: the crumbling planks, a plank "in row r" a crumbling tile whose top is the ground line of row r: bridge A (141 to
 * 152), bridge B's two spans (160 to 166, 168 to 175), all in row 25; the stairs over A, in pairs 2 tiles above the last (204 and 205 in
 * row 15, 206 and 207 in 13, 208 and 209 in 11). They come back (`crumblesReturn`).
 */
export const LEVEL_3_3_PLANKS = {
  bridgeA: stretch(141, 152, 25),
  bridgeB1: stretch(160, 166, 25),
  bridgeB2: stretch(168, 175, 25),
  stair1: stretch(204, 205, 15),
  stair2: stretch(206, 207, 13),
  stair3: stretch(208, 209, 11),
} as const satisfies Record<string, Stretch>;

const CRUMBLES: readonly Crumble[] = Object.values(LEVEL_3_3_PLANKS).flatMap((p) => Array.from({ length: p.col1 - p.col0 + 1 }, (_, i) => ({ col: p.col0 + i, row: p.row })));

/** GDD-WLD-18: the spawn, on G0 at column 2. */
export const LEVEL_3_3_SPAWN = { x: mid(2), y: LEVEL_3_3_AT.G0.row * TILE } as const;

/** GDD-WLD-03, GDD-WLD-18: the ofrendas' columns, each standing on the ground there: on T1 (65), on P4 (130), on A (203). */
export const LEVEL_3_3_OFRENDA_COLS: readonly number[] = [65, 130, 203];
const OFRENDA_ROWS: readonly number[] = [LEVEL_3_3_AT.T1.row, LEVEL_3_3_AT.P4.row, LEVEL_3_3_AT.A.row];
const OFRENDAS: readonly Ofrenda[] = LEVEL_3_3_OFRENDA_COLS.map((col, i) => ({ id: `3-3-${i + 1}`, x: mid(col), y: OFRENDA_ROWS[i]! * TILE }));

/** GDD-PWR-05, L-047: two piñatas, each 48 px over the ground one empty column past its wall: on T1 (the taco) and on P4 (the chile). */
const PINATAS: readonly Pinata[] = [
  { col: 64, row: 24 },
  { col: 134, row: 21 },
];

/** A Cacomixtle at its cart's start on rail `rail`: the cart's middle and its floor, 8 px over the rail's ground there. */
const cacomixtle = (rail: number): Enemy => {
  const r = LEVEL_3_3_RAILS[rail]!;
  return { x: r.x + (r.dir * CART.width) / 2, y: r.y - CART.floorPx, kind: 'cacomixtle', rail };
};

/**
 * GDD-ENM-02, GDD-ENM-04, GDD-WLD-18: where the enemies start, in this order: the three Cacomixtles K1 (x = 928), K2 (2848) and K3 (3152),
 * each in its cart on R2, R5 and R6; the Armadillo on P3 from column 114; the row of three Murciélagos climbing to the right over P3
 * (columns 111, 116 and 121, their loops' middles 48, 80 and 112 px over P3's top), each a row bat (`rx` 0, `ry` 8, GDD-ENM-04) in step
 * with the others (phase 0: GDD-WLD-18 gives none); the Zopilote over P5, flying its line from column 190 (187.5 to 193.5), the lowest
 * point of its cruise line 48 px over P5's top (its line at y = 340, the bob 12 px either way). No Cacomixtle names an exception to the sight
 * stretch's ground rule: K1's cart waits on T1's step, its floor 8 px under P1's top.
 */
export const LEVEL_3_3_ENEMIES: readonly Enemy[] = [
  cacomixtle(1),
  cacomixtle(4),
  cacomixtle(5),
  { x: mid(114), y: LEVEL_3_3_AT.P3.row * TILE, kind: 'armadillo' },
  { x: mid(111), y: LEVEL_3_3_AT.P3.row * TILE - 48, kind: 'murcielago', ry: 8 },
  { x: mid(116), y: LEVEL_3_3_AT.P3.row * TILE - 80, kind: 'murcielago', ry: 8 },
  { x: mid(121), y: LEVEL_3_3_AT.P3.row * TILE - 112, kind: 'murcielago', ry: 8 },
  { x: mid(190), y: LEVEL_3_3_AT.P5.row * TILE - 48 - 12, kind: 'zopilote' },
];

/** GDD-WLD-04, GDD-WLD-18: 50 hilos as (column, row) tiles, in the GDD's order. */
const HILOS: readonly Hilo[] = [
  // Into C1, and along R1 at the rider's chest.
  [3, 33], [4, 32],
  [8, 32], [13, 30], [15, 28], [19, 26], [23, 24], [27, 24], [31, 24], [35, 24],
  // The secret.
  [30, 27], [27, 28],
  // The perch; the slope and the piñata's wall.
  [42, 22], [43, 22],
  [53, 25], [62, 25],
  // R3, then the line of a held jump from the rail's end.
  [70, 26], [73, 24], [77, 23], [81, 23], [85, 23], [88, 23],
  [93, 20], [96, 21], [99, 23], [102, 24],
  // The spring; the bats; the glide on foot.
  [106, 26], [106, 24],
  [113, 14], [118, 12], [123, 10], [124, 10],
  [122, 17], [126, 19],
  // P4 and bridge A; the pier; under the vulture; MP2; the stairs.
  [132, 22], [144, 23], [148, 23],
  [167, 23],
  [190, 23],
  [200, 21], [200, 18],
  [205, 13], [207, 11], [209, 9],
  // R7, then the exit glide.
  [217, 8], [221, 10], [224, 10],
  [229, 7], [232, 8], [233, 13],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-18: the secret, the veladora in pier V's hollow at column 23, row 30, in plain view. */
const VELADORA: Veladora = { col: 23, row: 30 };

/** GDD-WLD-18: 3-3 as a level, the data the scene will play and the validator checks (GDD-TEC-04). The exit stands at column 234 on the bank. */
export const LEVEL_3_3: Level = {
  world: parseTiles(LEVEL_3_3_ROWS),
  spawn: LEVEL_3_3_SPAWN,
  ofrendas: OFRENDAS,
  spikes: [],
  crumbles: CRUMBLES,
  crumblesReturn: true,
  springs: [LEVEL_3_3_SPRING],
  platforms: Object.values(LEVEL_3_3_PLATFORM),
  tacos: [],
  pinatas: PINATAS,
  doors: [],
  keys: [],
  fragiles: [],
  enemies: LEVEL_3_3_ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: mid(234), y: LEVEL_3_3_AT.bank.row * TILE },
  // GDD-PRG-01: World 3's levels are never played without the glide.
  abilities: { glide: true },
  rails: LEVEL_3_3_RAILS,
  bottoms: LEVEL_3_3_BOTTOMS,
};
