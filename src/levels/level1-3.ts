// Level 1-3, the last level of World 1 before the boss (GDD-WLD-09, GDD-WLD-01): six screens, 180 x 17 tiles (2880 x 272 px). It brings
// in moving platforms, doors and keys, fragile walls and moving blocks (GDD-WLD-05), each first in a safe spot, then with a threat, then
// in a test, and uses the sand slopes (GDD-MOV-09), the Tlacuache and the crumbling tiles of 1-2 again. `#` is solid, `.` is empty, and
// `/ \ r R F f` are sand slopes. The floor's top is row 14 (y = 224). No glide and no wall cling.
import { TILE } from '../config/tuning';
import type { MovingBlock } from '../sim/block';
import type { Crumble } from '../sim/crumble';
import type { Door, Key } from '../sim/door';
import type { Enemy } from '../sim/enemy';
import type { Fragile } from '../sim/fragile';
import type { Spike } from '../sim/hazards';
import type { Hilo } from '../sim/hilo';
import type { Pinata } from '../sim/pinata';
import type { MovingPlatform } from '../sim/platform';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { Veladora } from '../sim/veladora';

export const LEVEL_1_3_ROWS: readonly string[] = [
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '...................................................####..................................................................................................................###########',
  '...................................................####....................................................##...................#.###.####...............................###########',
  '...................................................####.........................................................................#.###.####...............................###########',
  '...................................................####.........................................................................#.###.####...............................###########',
  '......./##\\.........................##.............####.............................................####........##.................................#........./.....\\.....###########',
  '....../####\\........................##.............####............#.rR####Ff.......................####........##.....#...........................#......../#.....#\\....###########',
  '#########################..########################################################...##############################################################################################',
  '#########################..########################################################...##############################################################################################',
  '#########################..########################################################...##############################################################################################',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor. */
const SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** GDD-WLD-03, GDD-WLD-09: tile columns 45, 98 and 153, about 25%, 55% and 85% of the width, standing on the floor. */
const OFRENDAS: readonly Ofrenda[] = [45, 98, 153].map((col, i) => ({ id: `1-3-${i + 1}`, x: mid(col), y: SPAWN.y }));

/** GDD-WLD-05: eight spikes under the shuttle (columns 104 to 111) and five under the crumbling bridge (158 to 162). */
const SPIKES: readonly Spike[] = [104, 105, 106, 107, 108, 109, 110, 111, 158, 159, 160, 161, 162].map((col) => ({ col, row: 13 }));

/** GDD-WLD-05: the crumbling bridge, five tiles at row 12 (top y = 192) between the two 45-degree ramps, over the spikes. */
const CRUMBLES: readonly Crumble[] = [158, 159, 160, 161, 162].map((col) => ({ col, row: 12 }));

/**
 * GDD-WLD-05: three moving platforms, 3 tiles wide. Two lifts rise from 2 tiles above the floor (y = 192) to level with the top of the
 * 6-tile cliff beside them (y = 128) and back: at columns 48 to 50, beside the cliff at 51 to 54, and at 166 to 168, beside the last cliff
 * from 169. The shuttle carries Poncho over the eight spikes at y = 192, from the step at columns 100 to 103 to the wall at 112 and 113.
 */
const PLATFORMS: readonly MovingPlatform[] = [
  { x0: 48 * TILE, y0: 192, x1: 48 * TILE, y1: 128, w: 48 },
  { x0: 104 * TILE, y0: 192, x1: 109 * TILE, y1: 192, w: 48 },
  { x0: 166 * TILE, y0: 192, x1: 166 * TILE, y1: 128, w: 48 },
];

/**
 * GDD-WLD-05, GDD-LIFE-02: four crushers, each one tile wide and two tall. The one at column 64 (in the open) and the one at 120 (just
 * past the Alacrán's pen, beside the pen's block at 119) start at their top end (y = 96), come down until they stand on the floor
 * (y = 192) and go straight back up. The two in the corridor, at 129 and 133, travel 4 tiles, between standing on the floor (y = 192)
 * and their top at y = 128, their bottom then 32 px up inside their hole in its ceiling: the one at 129 starts at the top, the one at
 * 133 at the bottom, so they are out of step. No enemy's walk passes through a crusher's column (GDD-WLD-09).
 */
const BLOCKS: readonly MovingBlock[] = [
  { x0: 64 * TILE, y0: 96, x1: 64 * TILE, y1: 192, w: 16, h: 32 },
  { x0: 120 * TILE, y0: 96, x1: 120 * TILE, y1: 192, w: 16, h: 32 },
  { x0: 129 * TILE, y0: 128, x1: 129 * TILE, y1: 192, w: 16, h: 32 },
  { x0: 133 * TILE, y0: 192, x1: 133 * TILE, y1: 128, w: 16, h: 32 },
];

/** GDD-PWR-05: one piñata 48 px above the floor at column 39, one empty column right of the 2-tile wall at 36 and 37. */
const PINATAS: readonly Pinata[] = [{ col: 39, row: 10 }];

/** GDD-WLD-05: three doors, each 4 tiles tall (rows 10 to 13), so no jump clears them; each key lies before its door. */
const DOORS: readonly Door[] = [18, 80, 140].map((col) => ({ col, row: 10, height: 4 }));
const KEYS: readonly Key[] = [
  { col: 14, row: 13 },
  { col: 73, row: 12 },
  { col: 131, row: 13 },
];

/** GDD-WLD-05: three fragile walls, each 4 tiles tall (rows 10 to 13), at columns 31, 115 and 143; the one at 115 and the block at 119 pen the Alacrán. */
const FRAGILES: readonly Fragile[] = [31, 115, 143].flatMap((col) => [10, 11, 12, 13].map((row) => ({ col, row })));

/** GDD-ENM-02: where the enemies start, left to right. */
const ENEMIES: readonly Enemy[] = [
  { x: mid(22), y: 14 * TILE, kind: 'cactus' },
  { x: mid(72), y: 13 * TILE, kind: 'tlacuache' },
  { x: mid(108), y: 112, kind: 'zopilote' },
  { x: mid(117), y: 14 * TILE },
  { x: mid(145), y: 14 * TILE, kind: 'tlacuache' },
  { x: mid(177), y: 8 * TILE, kind: 'tlacuache' },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in trails along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [2, 13], [4, 13], [7, 11], [8, 10], [9, 10], [10, 11], [13, 13], [15, 13], [22, 10], [25, 11],
  [30, 13], [33, 13], [36, 11], [41, 13], [50, 11], [50, 9], [52, 7], [54, 7], [64, 13], [67, 11],
  [70, 12], [72, 11], [74, 11], [82, 13], [84, 10], [90, 13], [94, 13], [101, 11], [103, 11], [106, 11],
  [108, 8], [110, 11], [113, 11], [114, 11], [117, 13], [121, 13], [127, 13], [130, 13], [132, 13], [136, 13],
  [141, 13], [145, 13], [147, 11], [156, 12], [158, 11], [160, 11], [162, 11], [167, 11], [167, 9], [171, 7],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the veladora on the 2-tile ledge at columns 107 and 108, row 9, over the shuttle's path. */
const VELADORA: Veladora = { col: 107, row: 8 };

/** GDD-WLD-03: 1-3 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 174 on the last cliff. */
export const LEVEL_1_3: Level = {
  world: parseTiles(LEVEL_1_3_ROWS),
  spawn: SPAWN,
  ofrendas: OFRENDAS,
  spikes: SPIKES,
  crumbles: CRUMBLES,
  springs: [],
  platforms: PLATFORMS,
  blocks: BLOCKS,
  tacos: [],
  pinatas: PINATAS,
  doors: DOORS,
  keys: KEYS,
  fragiles: FRAGILES,
  enemies: ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: mid(174), y: 8 * TILE },
};
