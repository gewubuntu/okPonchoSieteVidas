// Level 2-3 "Azoteas", the rooftops and toy stalls above the market, World 2's last level before La Estrella (GDD-WLD-14, GDD-BOS-03):
// eight screens, 240 x 17 tiles (3840 x 272 px), World 2's rules (gaps of at most 4 tiles with the covered-pit rule, GDD-WLD-03). It
// brings in the torn awning (GDD-WLD-10), the Trompo (GDD-ENM-03) and the rollo on the far post (GDD-WLD-11), each first in a safe spot,
// then with a threat, then in a test, and ends by combining all of World 2. `#` is a rooftop, `.` is empty: a column whose bottom row is
// empty is the street far below, a pit. The base roof's top is row 14 (y = 224). No glide and no wall cling.
import { TILE } from '../config/tuning';
import type { Awning } from '../sim/awning';
import type { Enemy } from '../sim/enemy';
import type { Hilo } from '../sim/hilo';
import type { Cordel, Rollo } from '../sim/papel';
import type { Pinata } from '../sim/pinata';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { Veladora } from '../sim/veladora';

const WIDTH = 240;
const HEIGHT = 17;
/** The base roof's top. */
export const ROOF = 14 * TILE;

/**
 * Each column's top row (solid from there down to the bottom row), or null for a pit: the base roof at row 14 unless listed here. Left to
 * right: the first gap; the Trompo pen's walls; the second gap; the walls that pen the two Trompos; the torn chain's three pits and its
 * chimneys (columns 68 and 73, 4 tiles above the roof); the wall before the second piñata; the mixed chain's three pits, its tall chimney
 * (column 101, 6 tiles above the roof) and its chimney (106, 4 tiles); the step R (columns 121 to 126, 2 tiles above the roof) that pens
 * the Trompo on L; the Fuego pit; the alley; the high roof F1 (columns 164 to 169, top y = 128); the pit after it; the Chapulín's pit; the
 * Paloma's pit; the exam's pit; and the exit roof (columns 220 to 239, top y = 128). The roofs between are named L (111 to 120), M (174 to
 * 184), K1 (189 to 197) and K2 (202 to 213).
 */
const TOPS: readonly (readonly [from: number, to: number, top: number | null])[] = [
  [20, 22, null],
  [29, 29, 12],
  [36, 36, 12],
  [44, 46, null],
  [52, 52, 12],
  [58, 58, 12],
  [64, 67, null],
  [68, 68, 10],
  [69, 72, null],
  [73, 73, 10],
  [74, 77, null],
  [83, 83, 12],
  [92, 100, null],
  [101, 101, 8],
  [102, 105, null],
  [106, 106, 10],
  [107, 110, null],
  [121, 126, 12],
  [140, 143, null],
  [156, 163, null],
  [164, 169, 8],
  [170, 173, null],
  [185, 188, null],
  [198, 201, null],
  [214, 219, null],
  [220, 239, 8],
];

const topOf = (col: number): number | null => {
  const t = TOPS.find(([a, b]) => col >= a && col <= b);
  return t ? t[2] : 14;
};

export const LEVEL_2_3_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) =>
  Array.from({ length: WIDTH }, (_col, col) => {
    const top = topOf(col);
    return top !== null && row >= top ? '#' : '.';
  }).join(''),
);

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** Where Poncho starts: the middle of tile column 3, standing on the roof. */
const SPAWN = { x: mid(3), y: ROOF } as const;

/** GDD-WLD-03: tile columns 60, 132 and 204, about 25%, 55% and 85% of the width, standing on the roof. */
const OFRENDAS: readonly Ofrenda[] = [60, 132, 204].map((col, i) => ({ id: `2-3-${i + 1}`, x: mid(col), y: ROOF }));

/**
 * GDD-WLD-10: the awnings, left to right.
 * - W1, whole, columns 6 to 8, 32 px over the roof: the ladder of 2-1, recalled.
 * - T1, torn, columns 11 to 13, as high, over safe roof: it bounces him once and rips (the Ki).
 * - T2 to T4, torn, three tiles each at y = 208 in the three pits of the chimneys, each against the chimney or roof beyond it: the chain
 *   over a pit (the Shō).
 * - The mixed chain (the Shō), whole and torn in turn, all at y = 208: Wa, whole, columns 93 to 96, to stop on and to start the ladder
 *   from; Tb, torn, 98 to 100, against the tall chimney, whose tier 2 rebound alone clears it; Wc, whole, 103 to 105, to stop on and wait
 *   for the Trompo on L; Td, torn, 108 to 110, against L.
 * - A2, whole, columns 160 to 162 at y = 256, deep in the alley under the far post's bundle (the Ten).
 * - A3, whole, columns 170 and 171 at y = 208, against the high roof's wall: the way down from F1.
 * - A4, whole, columns 185 to 188 at y = 208, filling the pit between M and K1: the Chapulín's.
 * - T5, torn, columns 217 and 218 at y = 240, 16 px from the exit roof's wall, in the exam's pit under the far post's bundle (the Ketsu).
 */
export const AWNINGS_2_3: readonly Awning[] = [
  { x: 6 * TILE, y: 192, w: 3 * TILE },
  { x: 11 * TILE, y: 192, w: 3 * TILE, torn: true },
  { x: 65 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 70 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 75 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 93 * TILE, y: 208, w: 4 * TILE },
  { x: 98 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 103 * TILE, y: 208, w: 3 * TILE },
  { x: 108 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 160 * TILE, y: 256, w: 3 * TILE },
  { x: 170 * TILE, y: 208, w: 2 * TILE },
  { x: 185 * TILE, y: 208, w: 4 * TILE },
  { x: 217 * TILE, y: 240, w: 2 * TILE, torn: true },
];

/** GDD-WLD-11: one cordel, across the Paloma's pit (columns 198 to 201), 16 px over the roof. */
export const CORDELES_2_3: readonly Cordel[] = [{ x: 198 * TILE, y: 208, w: 4 * TILE }];

/**
 * GDD-WLD-11: three rollos, each tied at its far (right) post, so each unrolls towards Poncho.
 * - R2 across the Fuego pit (columns 140 to 143), level with the roof: only a fireball reaches its bundle; it opens a hilo route.
 * - R1 across the alley (columns 156 to 163), 48 px over the roof, its bundle on the high roof's wall: clawed from an A2 rebound.
 * - R4 across the exam's pit (columns 214 to 219), the same, its bundle on the exit roof's wall: clawed from T5's one bounce.
 */
export const ROLLOS_2_3: readonly Rollo[] = [
  { x: 140 * TILE, y: ROOF, w: 4 * TILE, post: 'right' },
  { x: 156 * TILE, y: 176, w: 8 * TILE, post: 'right' },
  { x: 214 * TILE, y: 176, w: 6 * TILE, post: 'right' },
];

/** GDD-PWR-05: two piñatas, 48 px over the roof, each one empty column past a wall 2 tiles high (the pen's right wall, and column 83). */
const PINATAS: readonly Pinata[] = [
  { col: 38, row: 10 },
  { col: 85, row: 10 },
];

/** GDD-ENM-02, GDD-ENM-03: where the enemies start, left to right. */
export const ENEMIES_2_3: readonly Enemy[] = [
  { x: mid(26), y: ROOF }, // an Alacrán between the first gap and the pen: World 1's review
  { x: mid(32), y: ROOF, kind: 'trompo' }, // the Trompo alone in its pen
  { x: mid(49), y: ROOF, kind: 'trompo' }, // then two, each penned, one either side of the wall at column 52
  { x: mid(55), y: ROOF, kind: 'trompo' },
  { x: mid(116), y: ROOF, kind: 'trompo' }, // on the roof L, waiting past the mixed chain
  { x: mid(167), y: 8 * TILE, kind: 'tlacuache' }, // on the high roof F1, between the awnings A2 and A3
  { x: mid(179), y: ROOF, kind: 'trompo' }, // on the roof M
  { x: mid(193), y: ROOF, kind: 'chapulin' }, // on the roof K1, whose hops take it onto A4 and M
  { x: mid(199), y: 208, kind: 'paloma' }, // on the cordel
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [5, 13], [8, 10], [8, 6], [8, 4], [12, 6], [12, 4], [12, 3], [17, 13], [21, 10], [25, 13],
  [29, 10], [32, 13], [37, 11], [42, 13], [45, 10], [50, 13], [52, 10], [56, 11], [58, 10], [67, 9],
  [68, 7], [71, 9], [73, 5], [76, 10], [79, 4], [84, 11], [89, 13], [95, 11], [95, 6], [95, 5],
  [101, 6], [104, 11], [106, 7], [114, 13], [123, 11], [141, 13], [142, 13], [153, 13], [162, 13], [162, 11],
  [162, 9], [166, 7], [172, 4], [176, 13], [185, 10], [191, 13], [199, 9], [207, 13], [218, 10], [222, 7],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the veladora high over A2's left end, in plain view: only a tier 3 rebound off A2 reaches it. */
const VELADORA: Veladora = { col: 160, row: 6 };

/** GDD-WLD-03, GDD-WLD-14: 2-3 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 227 on the exit roof. */
export const LEVEL_2_3: Level = {
  world: parseTiles(LEVEL_2_3_ROWS),
  spawn: SPAWN,
  ofrendas: OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: PINATAS,
  doors: [],
  keys: [],
  fragiles: [],
  enemies: ENEMIES_2_3,
  hilos: HILOS,
  veladora: VELADORA,
  awnings: AWNINGS_2_3,
  cordeles: CORDELES_2_3,
  rollos: ROLLOS_2_3,
  exit: { x: mid(227), y: 8 * TILE },
};
