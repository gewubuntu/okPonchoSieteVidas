// Level 3-4, "La Casa de Máquinas", World 3's boss arena (GDD-BOS-01, GDD-BOS-04): one screen, 30 x 17 tiles (480 x 272 px), the engine shed
// where La Catorce is fought. `#` is solid, `.` is empty. The floor's top is row 14 (y = 224) across the whole width, with no pit, but for
// the two springs' cells (columns 12 and 17) where a spring stands. Home, the inspection gantry, is two tiles at columns 14 and 15, row 10
// (top y = 160); two high rails run out from x = 208 and 272 at y = 128 to broken ends at x = 112 and 368, and a crumbling perch of four tiles
// waits at each wall. Mirrored about x = 240. No ofrendas, exit, hilos or veladora.
import type { Crumble } from '../sim/crumble';
import type { Rail } from '../sim/cart';
import type { Level } from '../sim/run';
import type { Spring } from '../sim/spring';
import { parseTiles } from '../sim/tilemap';

/** GDD-BOS-04: the floor (rows 14 to 16) wall to wall, but for the two springs' cells in row 14. Nothing else is a world tile. */
export const LEVEL_3_4_ROWS: readonly string[] = [
  ...Array<string>(14).fill('.'.repeat(30)),
  '#'.repeat(12) + '.' + '#'.repeat(4) + '.' + '#'.repeat(12),
  ...Array<string>(2).fill('#'.repeat(30)),
];

/** GDD-BOS-04: the two springs in the floor at columns 12 and 17, 5 tiles either side of home's join. */
export const LEVEL_3_4_SPRINGS: readonly Spring[] = [
  { col: 12, row: 14 },
  { col: 17, row: 14 },
];

/** GDD-BOS-04: home, the gantry hung from the roof trusses: columns 14 and 15, row 10 (x = 224 to 256, top y = 160). Her slam shakes one down from phase 2. */
export const LEVEL_3_4_HOME: readonly Crumble[] = [
  { col: 14, row: 10 },
  { col: 15, row: 10 },
];

/**
 * GDD-BOS-04: the two high rails, level, their ground at y = 128, each running outwards from its start (x = 208 and 272) over 6 tiles to a
 * broken end at x = 112 and 368. Each cart stands at its start.
 */
export const LEVEL_3_4_RAILS: readonly Rail[] = [
  { x: 208, y: 128, dir: -1, segments: [{ kind: 'level', tiles: 6 }], end: 'broken' },
  { x: 272, y: 128, dir: 1, segments: [{ kind: 'level', tiles: 6 }], end: 'broken' },
];

/**
 * GDD-BOS-04: the perches, four crumbling tiles at each wall (columns 0 to 3 and 26 to 29), 3 tiles beyond each broken end. Row 6 (top
 * y = 96, moved up from the first design's row 7, GDD-BOS-04): a cart's box on its rail is y 112 to 128, and rolling off the end it would hit a perch at row 7 (the
 * same rows) and break before it reached her.
 */
export const LEVEL_3_4_PERCHES: readonly Crumble[] = [0, 1, 2, 3, 26, 27, 28, 29].map((col) => ({ col, row: 6 }));

/** GDD-BOS-04: 3-4 as a level. Poncho starts (and respawns, GDD-BOS-01) on home, across the join of its two tiles; she starts phase 1 at the right stop. */
export const LEVEL_3_4: Level = {
  world: parseTiles(LEVEL_3_4_ROWS),
  spawn: { x: 240, y: 160 },
  ofrendas: [],
  spikes: [],
  crumbles: LEVEL_3_4_PERCHES,
  crumblesReturn: true,
  springs: LEVEL_3_4_SPRINGS,
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: [],
  // GDD-PRG-01: World 3's levels are never played without the glide.
  abilities: { glide: true },
  rails: LEVEL_3_4_RAILS,
  catorce: { floor: 224, home: LEVEL_3_4_HOME },
};
