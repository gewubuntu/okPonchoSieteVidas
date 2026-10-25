// World 1, level 1 (GDD-WLD-06): three screens, 90 x 17 tiles (1440 x 272 px), teaching running and jumping, gaps, walls, the
// Alacrán (stomp and claw), a piñata with a taco and spikes. `#` is solid, `.` is empty. The floor's top is row 14 (y = 224).
// Gaps of 1, 2, 3 and 3 tiles (columns 16, 19 and 20, 53 to 55, 71 to 73), walls of 2, 3, 3 and 2 tiles, a raised platform
// (row 10, columns 62 to 68) and a ledge for the veladora (row 7, columns 70 and 71). No glide and no wall cling yet.
import { TILE } from '../config/tuning';
import type { Spike } from '../sim/hazards';
import type { Enemy } from '../sim/enemy';
import type { Pinata } from '../sim/pinata';
import type { Hilo } from '../sim/hilo';
import type { Veladora } from '../sim/veladora';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

export const LEVEL_1_1_ROWS: readonly string[] = [
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '......................................................................##..................',
  '..........................................................................................',
  '..........................................................................................',
  '..............................................................#######.....................',
  '..........................................................##..............................',
  '...........##.............................................##.......................##.....',
  '.......##..##..............#.........#....................##..................#....##.....',
  '################.##..################################...###############...################',
  '################.##..################################...###############...################',
  '################.##..################################...###############...################',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor. */
const SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;

/** GDD-WLD-03, GDD-WLD-06: tile columns 23, 49 and 76, about 26%, 55% and 85% of the width, standing on the floor. */
const OFRENDAS: readonly Ofrenda[] = [23, 49, 76].map((col, i) => ({ id: `1-1-${i + 1}`, x: col * TILE + TILE / 2, y: SPAWN.y }));

/** GDD-WLD-05: two spikes before the second ofrenda (columns 43 and 44) and three under the raised platform (64 to 66). */
const SPIKES: readonly Spike[] = [43, 44, 64, 65, 66].map((col) => ({ col, row: 13 }));

/** GDD-PWR-05: a piñata at column 40, row 10, 48 px above the floor; its taco is for the spikes after it. */
const PINATAS: readonly Pinata[] = [{ col: 40, row: 10 }];

/** GDD-ENM-02: Alacranes on the floor from column 32, on the raised platform from column 65, and on the floor from column 81. */
const ENEMIES: readonly Enemy[] = [
  { x: 32 * TILE + 8, y: 14 * TILE },
  { x: 65 * TILE + 8, y: 10 * TILE },
  { x: 81 * TILE + 8, y: 14 * TILE },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in trails along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [2, 13], [4, 13], [5, 13], [6, 13], [7, 11], [8, 11], [10, 13], [11, 10], [12, 10], [14, 13],
  [16, 11], [19, 11], [20, 11], [22, 13], [24, 13], [25, 13], [29, 12], [31, 12], [33, 12], [35, 12],
  [38, 11], [41, 9], [43, 11], [44, 11], [46, 13], [47, 13], [51, 13], [53, 12], [54, 11], [55, 12],
  [58, 9], [59, 9], [61, 12], [62, 8], [64, 8], [66, 8], [68, 8], [71, 6], [72, 11], [73, 12],
  [75, 13], [77, 13], [79, 12], [80, 12], [81, 12], [82, 12], [83, 10], [84, 10], [85, 13], [86, 13],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the veladora on the ledge at columns 70 and 71, high over the second 3-tile gap. */
const VELADORA: Veladora = { col: 70, row: 6 };

/** GDD-WLD-03: 1-1 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 87. */
export const LEVEL_1_1: Level = {
  world: parseTiles(LEVEL_1_1_ROWS),
  spawn: SPAWN,
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
  enemies: ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: 87 * TILE + 8, y: 14 * TILE },
};
