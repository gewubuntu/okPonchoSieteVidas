// GDD-ENM-03: lab-2e, a World 2 test level for World 2's enemies, opened with `?level=lab-2e` (GDD-UI-02). Like the sandbox it has three
// ofrendas and no exit (GDD-TEC-04). 60 x 17 tiles; the floor's top is row 14 (y = 224). Three pens, each between walls 2 tiles high
// (rows 12 and 13, top y = 192) that a full jump clears and none of the three can cross: a Paloma's, a Chapulín's and a Trompo's, each with
// an ofrenda before it. No awnings or cordeles yet: their tops are not in a level until World 2's awnings and papel picado are
// (GDD-WLD-10, GDD-WLD-11).
import { TILE } from '../config/tuning';
import type { Enemy } from '../sim/enemy';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

/** GDD-UI-02: its id, which its address names. */
export const LAB_2E_ID = 'lab-2e';

/** The columns of the walls that pen the enemies in. */
export const LAB_2E_WALLS: readonly number[] = [6, 19, 23, 36, 40, 55];

export const LAB_2E_ROWS: readonly string[] = Array.from({ length: 17 }, (_, row) => {
  if (row >= 14) return '#'.repeat(60);
  if (row >= 12) return Array.from({ length: 60 }, (_tile, col) => (LAB_2E_WALLS.includes(col) ? '#' : '.')).join('');
  return '.'.repeat(60);
});

const onFloor = (col: number): { x: number; y: number } => ({ x: col * TILE + TILE / 2, y: 14 * TILE });

/** Poncho starts on the floor at column 1. */
export const LAB_2E_SPAWN = onFloor(1);

/** An ofrenda before each pen: columns 4, 21 (between the first and second pens) and 38. */
export const LAB_2E_OFRENDAS: readonly Ofrenda[] = [
  { id: 'lab-2e-1', ...onFloor(4) },
  { id: 'lab-2e-2', ...onFloor(21) },
  { id: 'lab-2e-3', ...onFloor(38) },
];

/** GDD-ENM-03: a Paloma in the first pen (columns 7 to 18), a Chapulín in the second (24 to 35), a Trompo in the third (41 to 54). */
export const LAB_2E_ENEMIES: readonly Enemy[] = [
  { ...onFloor(12), kind: 'paloma' },
  { ...onFloor(29), kind: 'chapulin' },
  { ...onFloor(47), kind: 'trompo' },
];

export const LAB_2E_LEVEL: Level = {
  world: parseTiles(LAB_2E_ROWS),
  spawn: LAB_2E_SPAWN,
  ofrendas: LAB_2E_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: LAB_2E_ENEMIES,
};
