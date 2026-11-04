// GDD-WLD-10, GDD-WLD-11: the Mercado lab, a World 2 test level two screens wide (60 x 17 tiles) that shows each of World 2's signature
// mechanics on its own, left to right: an awning ladder up to a tower only a tier 3 rebound clears, a torn awning, a staircase of two
// cordeles, a rollo across a 6-tile pit, a 2-tile awning in the middle of a pit, and a rollo tied at the far post of a pit. The floor's
// top is row 14 (y = 224). A test level: no exit, no length rule (GDD-TEC-04). `?level=lab-2m` opens it.
import { TILE } from '../config/tuning';
import type { Awning } from '../sim/awning';
import type { Cordel, Rollo } from '../sim/papel';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

const WIDTH = 60;
/** The floor's top. */
export const LAB_2M_FLOOR = 14 * TILE;
/** The tower at columns 10 to 12, rows 4 to 13: its top is y = 64, 112 px above the ladder awning's top. */
export const LAB_2M_TOWER = { col: 10, cols: 3, topRow: 4 } as const;
/** Pit columns: under the rollo (27 to 32), round the awning over a pit (36 to 41) and under the far rollo (46 to 49). */
const PITS = [...range(27, 32), ...range(36, 41), ...range(46, 49)];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export const LAB_2M_ROWS: readonly string[] = Array.from({ length: 17 }, (_, r) =>
  Array.from({ length: WIDTH }, (_col, c) => {
    const tower = c >= LAB_2M_TOWER.col && c < LAB_2M_TOWER.col + LAB_2M_TOWER.cols && r >= LAB_2M_TOWER.topRow && r < 14;
    return tower || (r >= 14 && !PITS.includes(c)) ? '#' : '.';
  }).join(''),
);

/**
 * GDD-WLD-10: the ladder awning at columns 5 to 8, 48 px over the floor (a jump from the floor, 56 px, lands on it), 1 tile from the
 * tower; a torn awning at columns 15 to 17, as high; and a 2-tile awning at columns 38 and 39 in the middle of the pit at 36 to 41, 16 px
 * over the floor's top, so the pit's open runs either side are 2 tiles.
 */
export const LAB_2M_AWNINGS: readonly Awning[] = [
  { x: 5 * TILE, y: 176, w: 4 * TILE },
  { x: 15 * TILE, y: 176, w: 3 * TILE, torn: true },
  { x: 38 * TILE, y: 208, w: 2 * TILE },
];

/** GDD-WLD-11: a staircase of two cordeles at columns 20 to 23, 48 px apart (y = 176 and 128): a full jump goes up through the lower onto the upper. */
export const LAB_2M_CORDELES: readonly Cordel[] = [
  { x: 20 * TILE, y: 176, w: 4 * TILE },
  { x: 20 * TILE, y: 128, w: 4 * TILE },
];

/**
 * GDD-WLD-11: a rollo across the pit at columns 27 to 32, tied at its left post, its line 8 px over the floor's top, so the claw of a
 * Poncho standing at the edge reaches the bundle; and one tied at the right post of the pit at columns 46 to 49, unrolling towards him.
 */
export const LAB_2M_ROLLOS: readonly Rollo[] = [
  { x: 27 * TILE, y: 216, w: 6 * TILE, post: 'left' },
  { x: 46 * TILE, y: 216, w: 4 * TILE, post: 'right' },
];

/** GDD-WLD-05: ofrendas on the floor at columns 14, 25 and 44. */
export const LAB_2M_OFRENDAS: readonly Ofrenda[] = [14, 25, 44].map((col, i) => ({ id: `lab-2m-${i + 1}`, x: col * TILE + TILE / 2, y: LAB_2M_FLOOR }));

export const LAB_2M_LEVEL: Level = {
  world: parseTiles(LAB_2M_ROWS),
  spawn: { x: 2 * TILE + TILE / 2, y: LAB_2M_FLOOR },
  ofrendas: LAB_2M_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: [],
  awnings: LAB_2M_AWNINGS,
  cordeles: LAB_2M_CORDELES,
  rollos: LAB_2M_ROLLOS,
};
