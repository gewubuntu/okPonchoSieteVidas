// A one-screen test level, 30 x 17 tiles (480 x 272 px). A stand-in until levels are authored in Tiled (GDD-TEC-04).
// `#` is solid, `.` is empty. It has a floor with a pit 3 tiles wide (the World 1 limit, GDD-WLD-03), a floating platform
// to bump a head on, a wall 2 tiles high and a wall 3 tiles high, the tallest a full jump can climb (GDD-MOV-02,
// GDD-MOV-06), and a ledge 5 tiles long in the top right corner. It has three ofrenda checkpoints at about 25%, 65% and
// 85% of its width (GDD-WLD-03 asks for 25%, 55% and 85%; 55% falls in the pit, so the second one stands just past it).
import { TILE } from '../config/tuning';
import type { Crumble } from '../sim/crumble';
import type { MovingBlock } from '../sim/block';
import type { MovingPlatform } from '../sim/platform';
import type { Spring } from '../sim/spring';
import type { Spike } from '../sim/hazards';
import type { Enemy } from '../sim/enemy';
import type { Fragile } from '../sim/fragile';
import type { Door, Key } from '../sim/door';
import type { Pinata } from '../sim/pinata';
import type { Hilo } from '../sim/hilo';
import type { Taco } from '../sim/taco';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

export const SANDBOX_ROWS: readonly string[] = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '.........................#####',
  '.............##...............',
  '..............................',
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

// GDD-WLD-05: the ledge at tile columns 13 and 14, row 7 (top y = 112, underside y = 128), is 112 px above the floor: a plain spring
// launch (about 77 px) falls short of it and a timed one (about 120 px) clears it. It moved up a tile from row 8 when the body grew
// to 20 px (GDD-MOV-06): from the 2-tile wall his head clipped the old ledge's side on the way down to the spring. The body is 32 px now.

/**
 * GDD-WLD-05: a moving platform 3 tiles wide (top y = 128), 16 px below the spring ledge's top. It starts against the
 * ledge's right edge (x = 240) and travels 96 px right and back, so it carries Poncho from the ledge's side towards the crumbling
 * tiles at x = 384, whose top is 32 px lower.
 */
export const SANDBOX_PLATFORMS: readonly MovingPlatform[] = [{ x0: 240, y0: 128, x1: 336, y1: 128, w: 48 }];

/**
 * GDD-WLD-05, GDD-LIFE-02: a moving block one tile square in tile column 28 (x 448 to 464), in the pocket past the fragile wall.
 * It starts just under the Tlacuache's ledge (row 6, underside y = 112) and travels 96 px down to rest on the floor (top y = 224)
 * and back, so Poncho is crushed if he is under it when it lands or rides it up into the ledge. Column 29 beside it is safe.
 */
export const SANDBOX_BLOCKS: readonly MovingBlock[] = [{ x0: 448, y0: 112, x1: 448, y1: 208, w: 16, h: 16 }];

/** GDD-PWR-02: a taco on the floor at tile column 18, just past the pit and one tile before the second ofrenda, so Poncho can pick it up and then meet the spikes. */
export const SANDBOX_TACOS: readonly Taco[] = [{ col: 18, row: 13 }];

/**
 * GDD-PWR-05: a piñata at tile column 9, row 10 (underside y = 176): 48 px above the floor, so a standing Poncho's head is
 * 16 px short of it and any jump bumps it (it was at row 11, 32 px up, until the body grew to 32 px, GDD-MOV-06: his head was
 * flush with it and a jump could not bump it). Row 9 above it is open, so the taco it releases has room. It stands beside the
 * end of the platform at columns 4 to 8 (same top, y = 160), and is clear of the touch buttons.
 */
export const SANDBOX_PINATAS: readonly Pinata[] = [
  { col: 9, row: 10 },
  // GDD-PWR-03: the second piñata hangs at tile column 23, row 7 (underside y = 128), 48 px above the top of the 3-tile wall at
  // columns 22 and 23 (y = 176), so Poncho standing on the wall (head 16 px short of it) bumps it with a jump. In Taco it releases a
  // chile. It moved up a tile from row 8 when the body grew to 32 px (GDD-MOV-06): his head was flush with the old one. It hangs
  // in the path of the moving platform's far end (the platform's right edge reaches x = 384): a platform never carries him into a
  // solid tile (GDD-WLD-05), so he is stopped against the piñata, not crushed.
  { col: 23, row: 7 },
];

/**
 * GDD-WLD-05: a door three tiles tall (rows 11 to 13, 48 px) at tile column 8, between the first ofrenda and the piñata.
 * The platform above it (row 10, columns 4 to 8) closes the top, so the only way past is a key.
 */
export const SANDBOX_DOORS: readonly Door[] = [{ col: 8, row: 11, height: 3 }];

/** GDD-WLD-05: a key on the floor at tile column 5, on the way from the start to the door. */
export const SANDBOX_KEYS: readonly Key[] = [{ col: 5, row: 13 }];

/**
 * GDD-WLD-05: a fragile wall four tiles tall (rows 10 to 13, 64 px) at tile column 27, in the pocket at the right end, past
 * the third ofrenda. A full jump reaches 56 px, so it cannot be jumped over: only a claw swipe gets through.
 */
export const SANDBOX_FRAGILES: readonly Fragile[] = [10, 11, 12, 13].map((row) => ({ col: 27, row }));

/**
 * GDD-ENM-02: an Alacrán on the platform at row 10, columns 4 to 8 (top y = 160, x 64 to 144), starting in the middle and
 * heading right. It patrols that platform and on across the top of the piñata at column 9 (same top, x 144 to 160), and turns at
 * both ends, at x = 71 and x = 153. Poncho gets up there from the top of the 2-tile wall at
 * columns 10 and 11 (32 px below it), clear of the first ofrenda's respawn (the platform is 64 px above it).
 */
export const SANDBOX_ENEMIES: readonly Enemy[] = [
  { x: 104, y: 160 },
  // GDD-ENM-02: a Zopilote cruises above the middle of the level, at y = 64 from x = 216, so it flies 168 to 264. Poncho on the floor is
  // 144 px below it (his hurtbox centre is 16 px above his feet, GDD-MOV-06) and never spots it; on the Alacrán's platform he is 80 px
  // below it, the edge of its reach, so it spots him whenever it is at or below its line (half of every bob, and its first step); the spring ledge (32 px below) and the moving platform (48 px) are well within reach.
  { x: 216, y: 64, kind: 'zopilote' },
  // GDD-ENM-02: a cactus buddy on the right half of the top of the 2-tile wall (columns 10 and 11, top y = 192), at x = 184, so the left
  // 18 px of the top stay free to stand on and jump to the Alacrán's platform from.
  { x: 184, y: 12 * TILE, kind: 'cactus' },
  // GDD-ENM-02: a Tlacuache on the ledge in the top right corner (row 6, columns 25 to 29, x 400 to 480, top y = 96), in its middle. Poncho
  // gets up there from the moving platform at its right end (top y = 128, 32 px lower); the ledge is out of the Zopilote's sideways
  // reach and 128 px above the third ofrenda.
  { x: 440, y: 6 * TILE, kind: 'tlacuache' },
];

/**
 * GDD-MOV-07, GDD-MOV-08: the glide and the wall cling are on in the sandbox, so they can be played, until clearing Worlds 2
 * and 3 unlocks them (GDD-PRG-01). The level's left and right edges are full-height walls to cling to.
 */
export const SANDBOX_ABILITIES = { glide: true, wallCling: true } as const;

/**
 * GDD-WLD-04: 20 hilos in short trails along the path, as (column, row) tiles, in the order the serape colours cycle through them:
 * the floor before the door, either side of the key (4,13) (6,13); over the Alacrán's platform (row 10, top y = 160) (5,9) (7,9);
 * on the 2-tile wall, left of the cactus buddy (10,11); above the spring, which a plain launch passes through (12,10) (12,8);
 * on the spring ledge (row 7, top y = 112) (13,6) (14,6); over the middle of the pit (15,10); along the moving platform's route (top y = 128)
 * (17,7) (19,7) (21,7); over the two spikes (20,11) (21,11); on the 3-tile wall (22,10); over the crumbling tiles (row 10)
 * (24,9) (26,9); and on the Tlacuache's ledge (row 6) (26,5) (28,5).
 */
export const SANDBOX_HILOS: readonly Hilo[] = [
  [4, 13], [6, 13],
  [5, 9], [7, 9],
  [10, 11],
  [12, 10], [12, 8],
  [13, 6], [14, 6],
  [15, 10],
  [17, 7], [19, 7], [21, 7],
  [20, 11], [21, 11],
  [22, 10],
  [24, 9], [26, 9],
  [26, 5], [28, 5],
].map(([col, row]) => ({ col: col!, row: row! }));

/** The sandbox as a level: the same data the scene plays and the validator checks (GDD-TEC-04). It has no exit. */
export const SANDBOX_LEVEL: Level = { world: parseTiles(SANDBOX_ROWS), spawn: SANDBOX_SPAWN, ofrendas: SANDBOX_OFRENDAS, spikes: SANDBOX_SPIKES, crumbles: SANDBOX_CRUMBLES, springs: SANDBOX_SPRINGS, platforms: SANDBOX_PLATFORMS, blocks: SANDBOX_BLOCKS, tacos: SANDBOX_TACOS, pinatas: SANDBOX_PINATAS, doors: SANDBOX_DOORS, keys: SANDBOX_KEYS, fragiles: SANDBOX_FRAGILES, enemies: SANDBOX_ENEMIES, hilos: SANDBOX_HILOS, abilities: SANDBOX_ABILITIES };
