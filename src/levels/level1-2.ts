// Level 1-2, the second level of World 1 (GDD-WLD-08, GDD-WLD-01): six screens, 180 x 17 tiles (2880 x 272 px). It brings in sand
// slopes (GDD-MOV-09), the Tlacuache, crumbling tiles and springs, on top of what 0-1 and 1-1 taught. `#` is a level tile, `.` is
// empty, and `/ \ r R F f` are sand slopes (GDD-MOV-09). The floor's top is row 14 (y = 224). No glide and no wall cling.
import { TILE } from '../config/tuning';
import type { Crumble } from '../sim/crumble';
import type { Enemy } from '../sim/enemy';
import type { Spike } from '../sim/hazards';
import type { Hilo } from '../sim/hilo';
import type { Pinata } from '../sim/pinata';
import type { Level, Ofrenda } from '../sim/run';
import type { Spring } from '../sim/spring';
import type { Veladora } from '../sim/veladora';
import { parseTiles } from '../sim/tilemap';

export const LEVEL_1_2_ROWS: readonly string[] = [
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '....................................................................................................................................................................................',
  '...........................................................................##.......................................................................................................',
  '................................................................................................................................................##\\.................................',
  '................................................................................................................................................###\\................................',
  '..............................................................................##...........##...................................................####\\...............................',
  '.................................................../....##\\...................##...........##.........../......##\\..............................#####\\..............................',
  '................../##\\............................/#....###\\..##........##....##...........##........../#......###\\............/##\\.............######\\.............................',
  '........rR##Ff.../####\\.rR.......#.rRFf..rRFf..../##....####\\.##........##....##...........##........./##......####\\......#.../####\\..#.........#######\\....#..rR##Ff.#/#...........',
  '##########################..#################################################.##########.#############################...################.###############################...########',
  '##########################..##########################################################################################...################################################...########',
  '##########################..##########################################################################################...################################################...########',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor. */
const SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** GDD-WLD-03, GDD-WLD-08: tile columns 47, 99 and 153, about 26%, 55% and 85% of the width, standing on the floor. */
const OFRENDAS: readonly Ofrenda[] = [47, 99, 153].map((col, i) => ({ id: `1-2-${i + 1}`, x: mid(col), y: SPAWN.y }));

/**
 * GDD-WLD-05: two spikes in the dip between the dunes (39, 40), two between the second spring and its wall (89, 90), six under the
 * crumbling bridge (105 to 110) and six under the third spring's crumbling tiles (138 to 143).
 */
const SPIKES: readonly Spike[] = [39, 40, 89, 90, 105, 106, 107, 108, 109, 110, 138, 139, 140, 141, 142, 143].map((col) => ({ col, row: 13 }));

/**
 * GDD-WLD-05: the walkway (columns 52 to 55, row 11, top y = 176) over the floor, the bridge (105 to 110, row 11) over spikes, and the
 * three tiles (140 to 142, row 10, top y = 160) that the third spring throws Poncho onto.
 */
const CRUMBLES: readonly Crumble[] = [
  ...[52, 53, 54, 55].map((col) => ({ col, row: 11 })),
  ...[105, 106, 107, 108, 109, 110].map((col) => ({ col, row: 11 })),
  ...[140, 141, 142].map((col) => ({ col, row: 10 })),
];

/**
 * GDD-WLD-05: three springs set into the floor (row 14, an empty tile in the rows, as in the sandbox), each in front of what it throws
 * Poncho onto: the 4-tile wall at columns 78 and 79, the one at 91 and 92 past two spikes, and the crumbling tiles at 140 to 142.
 */
const SPRINGS: readonly Spring[] = [77, 88, 137].map((col) => ({ col, row: 14 }));

/**
 * GDD-PWR-05: two piñatas 48 px above the floor: at column 30, whose taco turns at the block at column 33 and comes back, and at column
 * 65, over the Tlacuache's pen, two columns right of the pen's left wall.
 */
const PINATAS: readonly Pinata[] = [
  { col: 30, row: 10 },
  { col: 65, row: 10 },
];

/**
 * GDD-ENM-02: where the enemies start, left to right: a Tlacuache in the pen between the walls at columns 62 and 63 and 72 and 73, the
 * cactus buddy at the foot of the first 4-tile wall, a Tlacuache on the hill in the pen between the blocks at 122 and 134, and one on
 * the dune in the pen between the blocks at 156 and 166.
 */
const ENEMIES: readonly Enemy[] = [
  { x: mid(68), y: 14 * TILE, kind: 'tlacuache' },
  { x: mid(81), y: 14 * TILE, kind: 'cactus' },
  { x: mid(128), y: 12 * TILE, kind: 'tlacuache' },
  { x: mid(161), y: 13 * TILE, kind: 'tlacuache' },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in trails along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [4, 13], [5, 13], [6, 13], [10, 12], [11, 12], [19, 11], [20, 11], [26, 9], [27, 9], [31, 12],
  [36, 12], [39, 9], [40, 10], [46, 13], [52, 10], [53, 10], [54, 10], [55, 10], [62, 10], [64, 9],
  [67, 13], [69, 13], [72, 10], [77, 11], [77, 9], [76, 6], [79, 8], [88, 10], [90, 8], [92, 8],
  [100, 13], [104, 10], [106, 10], [108, 10], [110, 10], [119, 9], [123, 9], [128, 10], [137, 11], [140, 8],
  [141, 8], [144, 6], [148, 9], [151, 12], [154, 13], [157, 9], [161, 11], [168, 11], [170, 8], [173, 13],
].map(([col, row]) => ({ col: col!, row: row! }));

/**
 * GDD-LIFE-03, GDD-WLD-03: the veladora on the ledge at columns 75 and 76, row 7 (top y = 112), which the first spring's timed launch
 * reaches from the floor, and a full jump from the top of the 4-tile wall right of that spring.
 */
const VELADORA: Veladora = { col: 75, row: 6 };

/** GDD-WLD-03: 1-2 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 174. */
export const LEVEL_1_2: Level = {
  world: parseTiles(LEVEL_1_2_ROWS),
  spawn: SPAWN,
  ofrendas: OFRENDAS,
  spikes: SPIKES,
  crumbles: CRUMBLES,
  springs: SPRINGS,
  platforms: [],
  tacos: [],
  pinatas: PINATAS,
  doors: [],
  keys: [],
  fragiles: [],
  enemies: ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: mid(174), y: 14 * TILE },
};
