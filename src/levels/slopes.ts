// GDD-MOV-09: the slopes level, a one-screen World 1 test level (30 x 17 tiles, 480 x 272 px) for sand slopes, opened with `?level=slopes`
// (GDD-UI-02). Like the sandbox it has three ofrendas and no exit (GDD-TEC-04). The floor's top is row 14 (y = 224). Left to right: a
// 45-degree hill two tiles high, a gentle dune one tile high, a 45-degree bump, a gap three tiles wide, a second bump.
import { TILE } from '../config/tuning';
import type { Enemy } from '../sim/enemy';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

export const SLOPES_ROWS: readonly string[] = [
  ...Array.from({ length: 12 }, () => '.'.repeat(30)),
  '...../##\\.....................',
  '..../####\\..rR###Ff./\\.../\\...',
  '######################...#####',
  '######################...#####',
  '######################...#####',
];

/** GDD-MOV-09: Poncho starts on the floor at column 3, left of the hill. */
export const SLOPES_SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE };

/** GDD-MOV-09: an ofrenda on the floor after the hill (column 11), on the dune's top (column 15, y = 208) and after the dune (column 19). */
export const SLOPES_OFRENDAS: readonly Ofrenda[] = [
  { id: 'slopes-1', x: 11 * TILE + TILE / 2, y: 14 * TILE },
  { id: 'slopes-2', x: 15 * TILE + TILE / 2, y: 13 * TILE },
  { id: 'slopes-3', x: 19 * TILE + TILE / 2, y: 14 * TILE },
];

export const SLOPES_ENEMIES: readonly Enemy[] = [
  // GDD-ENM-02, GDD-MOV-09: an Alacrán on top of the hill (column 7, y = 192), heading right. It walks down the hill, over the dune and the first bump
  // and turns at the gap's edge, and back up to the level's left edge: x = 7 to 345 (measured by `src/levels/slopes.test.ts`).
  { x: 7 * TILE + TILE / 2, y: 12 * TILE },
  // GDD-ENM-02, GDD-MOV-09: a Tlacuache against the right edge (column 29), on the flat ground after the second bump. It walks left up the bump's
  // falling side and down its rising side and turns at the gap's far edge: x = 408 to 472 (measured by `src/levels/slopes.test.ts`).
  { x: 29 * TILE + TILE / 2, y: 14 * TILE, kind: 'tlacuache' },
];

/** The slopes level as a level: the same data the scene plays and the validator checks (GDD-TEC-04). No hilos, no exit, no abilities. */
export const SLOPES_LEVEL: Level = {
  world: parseTiles(SLOPES_ROWS),
  spawn: SLOPES_SPAWN,
  ofrendas: SLOPES_OFRENDAS,
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: SLOPES_ENEMIES,
};
