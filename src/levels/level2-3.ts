// Level 2-3 "Azoteas", the rooftops and toy stalls above the market, World 2's last level before La Estrella (GDD-WLD-14, GDD-BOS-03):
// six screens, 180 x 17 tiles (2880 x 272 px), World 2's rules (gaps of at most 4 tiles with the covered-pit rule, GDD-WLD-03). It
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

const WIDTH = 180;
const HEIGHT = 17;
/** The base roof's top. */
export const ROOF = 14 * TILE;

/**
 * Each column's top row (solid from there down to the bottom row), or null for a pit: the base roof at row 14 unless listed here. Left to
 * right: the first gap; the Trompo pen's walls; the second gap; the wall between the two Trompos; the three chimneys' pits and the
 * chimneys (columns 68 and 73, 4 tiles above the roof); the wall before the second piñata; the Fuego pit; the alley; the high roof F1
 * (columns 113 to 118, top y = 128); the pit after it; the Chapulín's pit; the Paloma's pit; the exam's pit; and the exit roof (columns 169
 * to 179, top y = 128). The roofs between are named M (123 to 133), K1 (138 to 146) and K2 (151 to 162).
 */
const TOPS: readonly (readonly [from: number, to: number, top: number | null])[] = [
  [20, 22, null],
  [29, 29, 12],
  [36, 36, 12],
  [49, 51, null],
  [57, 57, 12],
  [64, 67, null],
  [68, 68, 10],
  [69, 72, null],
  [73, 73, 10],
  [74, 77, null],
  [83, 83, 12],
  [90, 93, null],
  [105, 112, null],
  [113, 118, 8],
  [119, 122, null],
  [134, 137, null],
  [147, 150, null],
  [163, 168, null],
  [169, 179, 8],
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

/** GDD-WLD-03: tile columns 45, 99 and 153, about 25%, 55% and 85% of the width, standing on the roof. */
const OFRENDAS: readonly Ofrenda[] = [45, 99, 153].map((col, i) => ({ id: `2-3-${i + 1}`, x: mid(col), y: ROOF }));

/**
 * GDD-WLD-10: the awnings, left to right.
 * - W1, whole, columns 6 to 8, 32 px over the roof: the ladder of 2-1, recalled.
 * - T1, torn, columns 11 to 13, as high, over safe roof: it bounces him once and rips (the Ki).
 * - T2 to T4, torn, three tiles each at y = 208 in the three pits of the chimneys, each against the chimney or roof beyond it: the chain
 *   over a pit (the Shō).
 * - A2, whole, columns 109 to 111 at y = 256, deep in the alley under the far post's bundle (the Ten).
 * - A3, whole, columns 119 and 120 at y = 208, against the high roof's wall: the way down from F1.
 * - A4, whole, columns 134 to 137 at y = 208, filling the pit between M and K1: the Chapulín's.
 * - T5, torn, columns 166 and 167 at y = 240, 16 px from the exit roof's wall, in the exam's pit under the far post's bundle (the Ketsu).
 */
export const AWNINGS_2_3: readonly Awning[] = [
  { x: 6 * TILE, y: 192, w: 3 * TILE },
  { x: 11 * TILE, y: 192, w: 3 * TILE, torn: true },
  { x: 65 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 70 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 75 * TILE, y: 208, w: 3 * TILE, torn: true },
  { x: 109 * TILE, y: 256, w: 3 * TILE },
  { x: 119 * TILE, y: 208, w: 2 * TILE },
  { x: 134 * TILE, y: 208, w: 4 * TILE },
  { x: 166 * TILE, y: 240, w: 2 * TILE, torn: true },
];

/** GDD-WLD-11: one cordel, across the Paloma's pit (columns 147 to 150), 16 px over the roof. */
export const CORDELES_2_3: readonly Cordel[] = [{ x: 147 * TILE, y: 208, w: 4 * TILE }];

/**
 * GDD-WLD-11: three rollos, each tied at its far (right) post, so each unrolls towards Poncho.
 * - R2 across the Fuego pit (columns 90 to 93), level with the roof: only a fireball reaches its bundle; it opens a hilo route.
 * - R1 across the alley (columns 105 to 112), 48 px over the roof, its bundle on the high roof's wall: clawed from an A2 rebound.
 * - R4 across the exam's pit (columns 163 to 168), the same, its bundle on the exit roof's wall: clawed from T5's one bounce.
 */
export const ROLLOS_2_3: readonly Rollo[] = [
  { x: 90 * TILE, y: ROOF, w: 4 * TILE, post: 'right' },
  { x: 105 * TILE, y: 176, w: 8 * TILE, post: 'right' },
  { x: 163 * TILE, y: 176, w: 6 * TILE, post: 'right' },
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
  { x: mid(55), y: ROOF, kind: 'trompo' }, // then two, one either side of the wall at column 57, before the chimneys
  { x: mid(61), y: ROOF, kind: 'trompo' },
  { x: mid(116), y: 8 * TILE, kind: 'tlacuache' }, // on the high roof F1, between the awnings A2 and A3
  { x: mid(128), y: ROOF, kind: 'trompo' }, // on the roof M
  { x: mid(142), y: ROOF, kind: 'chapulin' }, // on the roof K1, whose hops take it onto A4 and M
  { x: mid(148), y: 208, kind: 'paloma' }, // on the cordel
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [5, 13], [8, 10], [8, 6], [8, 4], [12, 6], [12, 4], [12, 3], [17, 13], [21, 10], [25, 13],
  [29, 10], [32, 13], [37, 11], [42, 13], [50, 10], [53, 13], [57, 11], [60, 13], [67, 9], [68, 7],
  [71, 9], [73, 5], [76, 10], [79, 4], [82, 13], [84, 11], [87, 13], [91, 13], [92, 13], [96, 13],
  [102, 13], [111, 13], [111, 11], [111, 9], [115, 7], [117, 7], [121, 6], [125, 13], [130, 13], [135, 9],
  [136, 9], [140, 13], [143, 13], [148, 9], [149, 11], [156, 13], [159, 13], [167, 10], [171, 7], [173, 7],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the veladora high over A2's left end, in plain view: only a tier 3 rebound off A2 reaches it. */
const VELADORA: Veladora = { col: 109, row: 6 };

/** GDD-WLD-03, GDD-WLD-14: 2-3 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 176 on the exit roof. */
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
  exit: { x: mid(176), y: 8 * TILE },
};
