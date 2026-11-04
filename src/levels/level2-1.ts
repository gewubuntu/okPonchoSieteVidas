// Level 2-1, "El Tianguis", the first level of World 2 (GDD-WLD-12, GDD-WLD-01): eight screens, 240 x 17 tiles (3840 x 272 px), a
// street market under pink and white tarps. It teaches the awning (GDD-WLD-10) and the Paloma (GDD-ENM-03) and ends with the first
// cordeles (GDD-WLD-11), in four beats (kishōtenketsu): a review of World 1 and one awning over flat ground; a Paloma on the floor, a row
// of stalls, a rooftop only the second tier reaches, a Paloma on a rooftop, then a Paloma met from a rooftop above and one in the landing
// zone of a rebound, which a held stomp turns into a rung of the ladder; a 3-tile awning in an 8-tile pit with a Paloma at its edge; a
// cordel staircase and a third-tier climb to the exit. `#` is solid, `.` is empty. The floor's top is row 14 (y = 224). No glide and no
// wall cling.
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
  '................................................................................................................................................................................................................................................',
  '................................................................................................................................................................................................................................................',
  '................................................................................................................................................................................................................................................',
  '................................................................................................................................................................................................................................................',
  '................................................................................................................................................................................................................................................',
  '......................................................................................#.........................................................................................................##########...........................###########',
  '......................................................................................#.........................................................................................................##########...........................###########',
  '..................................................................................##########......#############...............................############......................................##########...........................###########',
  '..................................................................................##########......#############...............................############......................................##########...........................###########',
  '..................................................................................##########......#############...............................############......................................##########...........................###########',
  '..................................................................................##########......#############...............................############......................................##########...........................###########',
  '..................................................................................##########......#############...............................############......................................##########...........................###########',
  '................................................#........#........................##########......#############........#.............#........############.......#..............................##########...........................###########',
  '..........#.......#.............................#........#........................##########......#############........#.............#.....#..############.......#..............................##########...........................###########',
  '######################...#############################################################################################################################################........##################################################################',
  '######################...#############################################################################################################################################........##################################################################',
  '######################...#############################################################################################################################################........##################################################################',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor. */
const SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** An awning `tiles` wide from column `col`, its top at `y` (GDD-WLD-10). */
const awning = (col: number, tiles: number, y: number): Awning => ({ x: col * TILE, y, w: tiles * TILE });

/**
 * GDD-WLD-10: the awnings, left to right. The first, alone over the floor (columns 31 to 34, top y = 192, 32 px up), which a jump from
 * the floor lands on. The stall row (64 to 66, 69 to 71, 74 to 76), as high. The ladder awning (79 to 81) against the wall of the first
 * rooftop (from 82, top y = 112, 80 px above it: tier 2 and not tier 1). The alley awning (93 to 97, y = 176) against the wall of the
 * second rooftop (from 98). The rung awnings either side of the fifth Paloma's pen: the take-off awning (129 to 131) and the landing
 * awning (139 to 141), over the pen's 1-tile crate and against the wall of the third rooftop (from 142, top y = 112: tier 2 again). The
 * pit awning (169 to 171, y = 208) in the pit at 166 to 173, 3 open tiles before it and 2 after. The last stall row (216 to 218, 221 to
 * 223, 226 to 228), the last against the wall of the exit's rooftop (from 229, top y = 80, 112 px above it: tier 3 and not tier 2).
 */
export const LEVEL_2_1_AWNINGS: readonly Awning[] = [
  awning(31, 4, 192),
  awning(64, 3, 192),
  awning(69, 3, 192),
  awning(74, 3, 192),
  awning(79, 3, 192),
  awning(93, 5, 176),
  awning(129, 3, 192),
  awning(139, 3, 192),
  awning(169, 3, 208),
  awning(216, 3, 192),
  awning(221, 3, 192),
  awning(226, 3, 192),
];

/** GDD-WLD-11: the cordel staircase over the floor before the tall rooftop (columns 192 to 201, top y = 80): y = 176, then 128, 48 px apart. */
export const LEVEL_2_1_CORDELES: readonly Cordel[] = [
  { x: 184 * TILE, y: 176, w: 4 * TILE },
  { x: 187 * TILE, y: 128, w: 4 * TILE },
];

/**
 * GDD-WLD-03: tile columns 60, 126 and 205, about 25%, 53% and 86% of the width, all on the floor: the first past the first Paloma's
 * pen, before the stall row; the second between the two Palomas of the rung beat; the third at the foot of the tall rooftop.
 */
const OFRENDAS: readonly Ofrenda[] = [
  { id: '2-1-1', x: mid(60), y: 14 * TILE },
  { id: '2-1-2', x: mid(126), y: 14 * TILE },
  { id: '2-1-3', x: mid(205), y: 14 * TILE },
];

/** GDD-PWR-05: the piñata over the first awning's right end (column 34, row 5): a first-tier rebound bumps it, a jump does not. */
const PINATAS: readonly Pinata[] = [{ col: 34, row: 5 }];

/**
 * GDD-ENM-02, GDD-ENM-03: where the enemies start, left to right. The Alacrán of the review, penned by crates 1 tile high at columns 10
 * and 18. Five Palomas, each penned so that it never walks near a respawn or under an awning: the first on the floor between crates 2
 * tiles high at 48 and 57; one on the first rooftop, past a chimney at 82; one on the floor under the second rooftop's right end, penned
 * by its wall and a crate 2 tiles high at 119, met from the rooftop above; one in the rung pen between a crate 2 tiles high at 133 and a
 * crate 1 tile high at 139, in the landing zone of the take-off awning's rebound; and the twist, on the floor between a crate at 161 and
 * the pit's edge. Behind a wall 2 tiles high (or from a rooftop or an awning 32 px or more above it) Poncho is out of its sight (24 px).
 */
const ENEMIES: readonly Enemy[] = [
  { x: mid(14), y: 14 * TILE },
  { x: mid(52), y: 14 * TILE, kind: 'paloma' },
  { x: mid(89), y: 7 * TILE, kind: 'paloma' },
  { x: mid(115), y: 14 * TILE, kind: 'paloma' },
  { x: mid(136), y: 14 * TILE, kind: 'paloma' },
  { x: mid(164), y: 14 * TILE, kind: 'paloma' },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in trails along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [5, 13], [7, 13], [10, 9], [14, 12], [17, 9], [22, 9], [23, 8], [24, 9], [32, 6], [32, 5],
  [32, 4], [32, 3], [48, 9], [53, 13], [57, 9], [65, 8], [67, 6], [72, 4], [78, 4], [81, 6],
  [81, 5], [81, 4], [86, 3], [90, 6], [96, 4], [102, 6], [107, 6], [113, 10], [119, 9], [123, 13],
  [133, 9], [141, 6], [148, 6], [155, 9], [161, 9], [164, 13], [167, 9], [170, 7], [170, 6], [170, 5],
  [170, 4], [172, 8], [176, 13], [186, 9], [189, 6], [196, 3], [217, 8], [220, 6], [225, 4], [231, 3],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the veladora high over the pit awning (column 170, row 3), at the top of a third-tier rebound. */
const VELADORA: Veladora = { col: 170, row: 3 };

/** GDD-WLD-03: 2-1 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 234 on the last rooftop. */
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
  exit: { x: mid(234), y: 5 * TILE },
  awnings: LEVEL_2_1_AWNINGS,
  cordeles: LEVEL_2_1_CORDELES,
};
