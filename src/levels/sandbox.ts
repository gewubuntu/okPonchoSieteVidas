// A one-screen test level, 30 x 17 tiles (480 x 272 px). A stand-in until levels are authored in Tiled (GDD-TEC-04).
// `#` is solid, `.` is empty. It has a floor with a pit 3 tiles wide (the World 1 limit, GDD-WLD-03), a floating platform
// to bump a head on, a wall 2 tiles high and a wall 3 tiles high, the tallest a full jump can climb (GDD-MOV-02,
// GDD-MOV-06). It has three ofrenda checkpoints at about 25%, 65% and 85% of its width (GDD-WLD-03 asks for 25%, 55% and
// 85%; 55% falls in the pit, so the second one stands just past it).
import { TILE } from '../config/tuning';
import type { Crumble } from '../sim/crumble';
import type { MovingPlatform } from '../sim/platform';
import type { Spring } from '../sim/spring';
import type { Spike } from '../sim/hazards';
import type { Taco } from '../sim/taco';
import type { Ofrenda } from '../sim/run';

export const SANDBOX_ROWS: readonly string[] = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '.............##...............',
  '..............................',
  '....#####.....................',
  '......................##......',
  '..........##..........##......',
  '..........##..........##......',
  '############.#...#############',
  '##############...#############',
  '##############...#############',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor (the first solid row is 14). */
export const SANDBOX_SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;

/** GDD-WLD-05: tile columns 7, 19 and 25, standing on the floor. */
export const SANDBOX_OFRENDAS: readonly Ofrenda[] = [7, 19, 25].map((col, i) => ({
  id: `sandbox-${i + 1}`,
  x: col * TILE + TILE / 2,
  y: SANDBOX_SPAWN.y,
}));

/** GDD-WLD-05: two spikes on the floor at tile columns 20 and 21, between the second ofrenda and the 3-tile wall. */
export const SANDBOX_SPIKES: readonly Spike[] = [20, 21].map((col) => ({ col, row: 13 }));

/** GDD-WLD-05: three crumbling tiles at columns 24 to 26, one tile above the 3-tile wall's top, a jump up from it. */
export const SANDBOX_CRUMBLES: readonly Crumble[] = [24, 25, 26].map((col) => ({ col, row: 10 }));

/** GDD-WLD-05: a spring set into the floor at tile column 12, flush with the floor, between the 2-tile wall and the pit, clear of the touch buttons. */
export const SANDBOX_SPRINGS: readonly Spring[] = [{ col: 12, row: 14 }];

// GDD-WLD-05: the ledge at tile columns 13 and 14, row 8 (top y = 128), is 96 px above the floor: a plain spring launch
// (about 77 px) falls short of it and a timed one (about 120 px) clears it.

/**
 * GDD-WLD-05: a moving platform 3 tiles wide at the height of the spring ledge (top y = 128). It starts against the
 * ledge's right edge (x = 240) and travels 96 px right and back, so it carries Poncho from the ledge towards the crumbling
 * tiles at x = 384, whose top is 32 px lower.
 */
export const SANDBOX_PLATFORMS: readonly MovingPlatform[] = [{ x0: 240, y0: 128, x1: 336, y1: 128, w: 48 }];

/** GDD-PWR-02: a taco on the floor at tile column 18, just past the pit and one tile before the second ofrenda, so Poncho can pick it up and then meet the spikes. */
export const SANDBOX_TACOS: readonly Taco[] = [{ col: 18, row: 13 }];
