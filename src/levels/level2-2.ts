// Level 2-2, "Mercado Municipal", World 2's second level (GDD-WLD-13, GDD-WLD-01): the covered market hall, six screens, 180 x 17 tiles
// (2880 x 272 px). It teaches the rollo (GDD-WLD-11) and brings in the Chapulín (GDD-ENM-03), in four beats: *ki*, a rollo over a sunken
// aisle Poncho cannot die in; *shō*, rollos over pits, a Paloma on a pillar between two of them, a Chapulín on an awning and a Paloma on
// a cordel; *ten*, the first chile of World 2, whose fireball unrolls a bundle the claw cannot reach; *ketsu*, an aisle where a rollo's
// bridge and a held rebound off an awning (GDD-WLD-10) lift Poncho onto the cordeles above, then a bundle high over the last pit that only
// a jump from the awning before it brings within the claw's reach, its column of hilos leading a tier 3 rebound to the veladora. `#` is
// solid and `.` empty. The floor's top is row 14 (y = 224). No glide and no wall cling (GDD-PRG-01). Its enemies are placed with the
// level validator's 3-tile rule (GDD-ENM-01) and its tests (`level2-2.test.ts`) measure every claim made here.
import { TILE } from '../config/tuning';
import type { Awning } from '../sim/awning';
import type { Enemy } from '../sim/enemy';
import type { Spike } from '../sim/hazards';
import type { Hilo } from '../sim/hilo';
import type { Cordel, Rollo } from '../sim/papel';
import type { Pinata } from '../sim/pinata';
import type { Level, Ofrenda } from '../sim/run';
import type { Taco } from '../sim/taco';
import { parseTiles } from '../sim/tilemap';
import type { Veladora } from '../sim/veladora';

const WIDTH = 180;
const HEIGHT = 17;
/** The floor's top. */
const FLOOR_2_2 = 14 * TILE;

/** The middle of tile column `col`, in px. */
const mid = (col: number): number => col * TILE + TILE / 2;

/** Solid blocks above the floor, as [first column, last column, top row]; each reaches down to row 13. */
const BLOCKS: readonly (readonly [number, number, number])[] = [
  [9, 9, 12], // a crate, the step up to the mezzanine
  [10, 19, 10], // the mezzanine, top y = 160
  [20, 20, 12], // the step out of the sunken aisle
  [26, 28, 10], // the far mezzanine
  [29, 29, 12], // a crate, the step down
  [33, 33, 12], // the Chapulín's pen: 2-tile walls at 33 and 41
  [41, 41, 12],
  [74, 74, 12], // the 2-tile wall that pens the second Chapulín
  [87, 89, 8], // the flower stall's wall, 6 tiles, top y = 128: a tier 2 rebound off the awning before it climbs it
  [106, 110, 11], // the walkway over the chile stall, top y = 176
  [123, 123, 13], // the block that pens the Tlacuache
  [155, 156, 12], // the 2-tile wall before the last awning, from which a jump reaches it
  [170, 179, 7], // the rooftop, top y = 112, with the exit
];

/** Pit columns: the floor's three rows are open there. */
const PITS: readonly (readonly [number, number])[] = [
  [49, 54],
  [58, 63],
  [66, 71],
  [90, 95],
  [115, 120],
  [129, 142],
  [162, 169],
];

const solidAt = (col: number, row: number): boolean => {
  if (row >= 14) return !PITS.some(([a, b]) => col >= a && col <= b);
  return BLOCKS.some(([a, b, top]) => col >= a && col <= b && row >= top && row <= 13);
};

export const LEVEL_2_2_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) =>
  Array.from({ length: WIDTH }, (_col, col) => (solidAt(col, row) ? '#' : '.')).join(''),
);

/** Where Poncho starts: the middle of tile column 3, standing on the floor. */
const SPAWN = { x: mid(3), y: FLOOR_2_2 } as const;

/** GDD-WLD-03: ofrendas on the floor at columns 45, 99 and 153, about 25%, 55% and 85% of the width. */
const OFRENDAS: readonly Ofrenda[] = [45, 99, 153].map((col, i) => ({ id: `2-2-${i + 1}`, x: mid(col), y: FLOOR_2_2 }));

/**
 * GDD-WLD-11: seven rollos, each tied at its left post and each after the ofrenda Poncho would respawn at (a rollo lies before its pit).
 * 0: over the sunken aisle, its line 8 px over the mezzanine's top. 1 to 3: over the floor's pits, 8 px over the floor, the last two either
 * side of a 2-tile pillar. 4: past the chile stall, 24 px over the floor, out of the claw's reach from the walkway. 5: the aisle's bridge,
 * 16 px over the floor. 6: high over the last pit (y = 112), level with the rooftop, within the claw's reach only from a jump off the
 * awning before it (a jump from the floor falls 11 px short).
 */
const ROLLOS: readonly Rollo[] = [
  { x: 20 * TILE, y: 152, w: 6 * TILE, post: 'left' },
  { x: 49 * TILE, y: 216, w: 6 * TILE, post: 'left' },
  { x: 58 * TILE, y: 216, w: 6 * TILE, post: 'left' },
  { x: 66 * TILE, y: 216, w: 6 * TILE, post: 'left' },
  { x: 115 * TILE, y: 200, w: 6 * TILE, post: 'left' },
  { x: 129 * TILE, y: 208, w: 4 * TILE, post: 'left' },
  { x: 162 * TILE, y: 112, w: 8 * TILE, post: 'left' },
];

/**
 * GDD-WLD-11: the cordel over the pit past the flower stall, level with its wall's top (y = 128) and a tile from it, so its Paloma turns at
 * its end rather than walk onto the wall Poncho climbs to; and the aisle's two, over its awnings, a tile apart, the Paloma on the
 * second, clear of the rise off the first awning.
 */
const CORDELES: readonly Cordel[] = [
  { x: 91 * TILE, y: 128, w: 5 * TILE },
  { x: 133 * TILE, y: 144, w: 6 * TILE },
  { x: 140 * TILE, y: 144, w: 5 * TILE },
];

/** GDD-WLD-10: the awning before the stall wall, the aisle's two in its pit, and the last one, before the high rollo. */
const AWNINGS: readonly Awning[] = [
  { x: 82 * TILE, y: 208, w: 5 * TILE },
  { x: 137 * TILE, y: 208, w: 2 * TILE },
  { x: 141 * TILE, y: 208, w: 2 * TILE },
  { x: 158 * TILE, y: 160, w: 4 * TILE },
];

/** GDD-WLD-05: the chile stall's spikes, on the floor between the walkway and the pit (columns 111 to 114). */
const SPIKES: readonly Spike[] = [111, 112, 113, 114].map((col) => ({ col, row: 13 }));

/** GDD-PWR-02, GDD-PWR-05: a taco on the floor past the second ofrenda, then the piñata that gives World 2's first chile. */
const TACOS: readonly Taco[] = [{ col: 101, row: 13 }];
const PINATAS: readonly Pinata[] = [{ col: 103, row: 10 }];

/** GDD-ENM-02, GDD-ENM-03: where the enemies start, left to right. */
const ENEMIES: readonly Enemy[] = [
  { x: mid(37), y: FLOOR_2_2, kind: 'chapulin' },
  { x: 65 * TILE, y: FLOOR_2_2, kind: 'paloma' },
  { x: mid(84), y: 208, kind: 'chapulin' },
  { x: mid(94), y: 128, kind: 'paloma' },
  { x: mid(126), y: FLOOR_2_2, kind: 'tlacuache' },
  { x: mid(142), y: 144, kind: 'paloma' },
  { x: mid(159), y: FLOOR_2_2, kind: 'chapulin' },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in trails along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [5, 13], [6, 13], [7, 13], [12, 9], [16, 9], [21, 6], [22, 8], [23, 8], [24, 8], [27, 9],
  [33, 10], [36, 13], [38, 13], [41, 10], [47, 13], [50, 9], [52, 12], [54, 12], [59, 9], [61, 12],
  [63, 12], [67, 9], [69, 12], [71, 12], [78, 13], [83, 10], [84, 7], [88, 7], [89, 7], [94, 7],
  [100, 13], [104, 12], [108, 10], [113, 7], [117, 11], [119, 11], [123, 9], [128, 13], [131, 12], [136, 8],
  [140, 8], [148, 13], [156, 11], [161, 6], [161, 4], [163, 6], [166, 6], [168, 6], [161, 2], [172, 6],
].map(([col, row]) => ({ col: col!, row: row! }));

/**
 * GDD-LIFE-03, GDD-WLD-03: the veladora, in the top row over the last awning's right end, atop a column of hilos at the heights of its
 * rebounds: only a tier 3 rebound's rise touches it.
 */
const VELADORA: Veladora = { col: 161, row: 0 };

/** GDD-WLD-03: 2-2 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 174 on the rooftop. */
export const LEVEL_2_2: Level = {
  world: parseTiles(LEVEL_2_2_ROWS),
  spawn: SPAWN,
  ofrendas: OFRENDAS,
  spikes: SPIKES,
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: TACOS,
  pinatas: PINATAS,
  doors: [],
  keys: [],
  fragiles: [],
  enemies: ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: mid(174), y: 7 * TILE },
  awnings: AWNINGS,
  cordeles: CORDELES,
  rollos: ROLLOS,
};
