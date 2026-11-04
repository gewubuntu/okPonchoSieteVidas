// Level 2-1, "El Tianguis", the first level of World 2 (GDD-WLD-12, GDD-WLD-01): six screens, 180 x 17 tiles (2880 x 272 px), a street
// market under pink and white tarps. It teaches the awning (GDD-WLD-10) and the Paloma (GDD-ENM-03) and ends with the first cordeles
// (GDD-WLD-11), in four beats (kishōtenketsu): a review of World 1 and one awning over flat ground; a row of stalls, a rooftop only the
// second tier reaches and a Paloma on the floor and one on a rooftop; a 2-tile awning in the middle of an 8-tile pit with a Paloma at its
// edge; a cordel staircase and a third-tier climb to the exit. `#` is solid, `.` is empty. The floor's top is row 14 (y = 224). No glide
// and no wall cling.
import { TILE } from '../config/tuning';
import type { Awning } from '../sim/awning';
import type { Enemy } from '../sim/enemy';
import type { Hilo } from '../sim/hilo';
import type { Cordel } from '../sim/papel';
import type { Pinata } from '../sim/pinata';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { Veladora } from '../sim/veladora';

export const LEVEL_2_1_ROWS: readonly string[] = [
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '.................................................................................#..................................................##########...........................###########',
  '.................................................................................#..................................................##########...........................###########',
  '.............................................................................##########......######.................................##########...........................###########',
  '.............................................................................##########......######.................................##########...........................###########',
  '.............................................................................##########......######.................................##########...........................###########',
  '.............................................................................##########......######.................................##########...........................###########',
  '.............................................................................##########......######.................................##########...........................###########',
  '................................................#........#...................##########......######.......#.........................##########...........................###########',
  '..........#.......#.............................#........#...................##########......######.......#.........................##########...........................###########',
  '######################...######################################################################################........#############################################################',
  '######################...######################################################################################........#############################################################',
  '######################...######################################################################################........#############################################################',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor. */
const SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** An awning `tiles` wide from column `col`, its top at `y` (GDD-WLD-10). */
const awning = (col: number, tiles: number, y: number): Awning => ({ x: col * TILE, y, w: tiles * TILE });

/**
 * GDD-WLD-10: the awnings, left to right. The first, alone over the floor (columns 31 to 34, top y = 192, 32 px up), which a jump from
 * the floor lands on. The stall row (59 to 61, 64 to 66, 69 to 71), as high. The ladder awning (74 to 76) against the wall of the first
 * rooftop (from 77, top y = 112, 80 px above it: tier 2 and not tier 1). The alley awning (88 to 92, y = 176) against the wall of the
 * second rooftop (from 93). The pit awning (114 and 115, y = 208) in the middle of the pit at 111 to 118, 3 open tiles a side. The last
 * stall row (156 to 158, 161 to 163, 166 to 168), the last against the wall of the exit's rooftop (from 169, top y = 80, 112 px above
 * it: tier 3 and not tier 2).
 */
export const LEVEL_2_1_AWNINGS: readonly Awning[] = [
  awning(31, 4, 192),
  awning(59, 3, 192),
  awning(64, 3, 192),
  awning(69, 3, 192),
  awning(74, 3, 192),
  awning(88, 5, 176),
  awning(114, 2, 208),
  awning(156, 3, 192),
  awning(161, 3, 192),
  awning(166, 3, 192),
];

/** GDD-WLD-11: the cordel staircase over the floor before the tall rooftop (columns 132 to 141, top y = 80): y = 176, then 128, 48 px apart. */
export const LEVEL_2_1_CORDELES: readonly Cordel[] = [
  { x: 124 * TILE, y: 176, w: 4 * TILE },
  { x: 127 * TILE, y: 128, w: 4 * TILE },
];

/**
 * GDD-WLD-03: tile columns 45, 95 and 153, about 25%, 53% and 85% of the width. The second stands on the second rooftop (y = 112), which
 * every route crosses: on the floor below it a running jump off the roof would sail over it.
 */
const OFRENDAS: readonly Ofrenda[] = [
  { id: '2-1-1', x: mid(45), y: 14 * TILE },
  { id: '2-1-2', x: mid(95), y: 7 * TILE },
  { id: '2-1-3', x: mid(153), y: 14 * TILE },
];

/** GDD-PWR-05: the piñata over the first awning's right end (column 34, row 5): a first-tier rebound bumps it, a jump does not. */
const PINATAS: readonly Pinata[] = [{ col: 34, row: 5 }];

/**
 * GDD-ENM-02, GDD-ENM-03: where the enemies start, left to right. The Alacrán of the review, penned by crates 1 tile high at columns 10
 * and 18. Three Palomas, each penned so that it never walks near a respawn or under an awning, behind a wall 2 tiles high, so that Poncho
 * on its top is 32 px above the Paloma, out of its sight (24 px): the first on the floor between crates at 48 and 57; one on the first
 * rooftop, past a chimney at 81; and the twist, on the floor between a crate at 106 and the pit's edge.
 */
const ENEMIES: readonly Enemy[] = [
  { x: mid(14), y: 14 * TILE },
  { x: mid(52), y: 14 * TILE, kind: 'paloma' },
  { x: mid(84), y: 7 * TILE, kind: 'paloma' },
  { x: mid(109), y: 14 * TILE, kind: 'paloma' },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in trails along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [5, 13], [7, 13], [10, 9], [14, 12], [17, 9], [22, 9], [23, 8], [24, 9], [28, 13], [32, 6],
  [32, 5], [32, 4], [32, 3], [38, 13], [42, 13], [48, 9], [53, 13], [57, 9], [60, 8], [62, 6],
  [67, 4], [72, 3], [76, 6], [76, 5], [76, 4], [79, 6], [81, 3], [85, 6], [91, 4], [97, 6],
  [100, 9], [102, 13], [106, 9], [109, 13], [112, 9], [114, 7], [114, 6], [114, 5], [114, 4], [117, 8],
  [121, 13], [126, 9], [129, 6], [134, 3], [139, 3], [148, 13], [157, 8], [160, 6], [165, 4], [171, 3],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the veladora high over the pit awning (column 114, row 3), at the top of a third-tier rebound. */
const VELADORA: Veladora = { col: 114, row: 3 };

/** GDD-WLD-03: 2-1 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 174 on the last rooftop. */
export const LEVEL_2_1: Level = {
  world: parseTiles(LEVEL_2_1_ROWS),
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
  enemies: ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: mid(174), y: 5 * TILE },
  awnings: LEVEL_2_1_AWNINGS,
  cordeles: LEVEL_2_1_CORDELES,
};
