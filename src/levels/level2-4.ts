// Level 2-4, "La Plaza", World 2's boss arena (GDD-BOS-01, GDD-BOS-03): one screen, 30 x 17 tiles (480 x 272 px), where La Estrella is
// fought. `#` is solid, `.` is empty. The floor's top is row 14 (y = 224) across the whole width, with no pit. Three whole awnings 4 tiles
// wide, their tops at y = 176 (the middle one is torn away in the fight by La Estrella's first phase 3 drop, which is the fight's state, not
// the level's), and two cordeles between them, their tops at y = 136. No ofrendas, exit, hilos or veladora.
import type { Awning } from '../sim/awning';
import type { Cordel } from '../sim/papel';
import type { Level } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

export const LEVEL_2_4_ROWS: readonly string[] = [...Array<string>(14).fill('.'.repeat(30)), ...Array<string>(3).fill('#'.repeat(30))];

/** GDD-BOS-03: the three awnings, columns 3 to 6, 13 to 16 and 23 to 26, 48 px over the floor. */
export const LEVEL_2_4_AWNINGS: readonly Awning[] = [
  { x: 48, y: 176, w: 64 },
  { x: 208, y: 176, w: 64 },
  { x: 368, y: 176, w: 64 },
];

/** GDD-BOS-03: the two cordeles, columns 7 to 12 and 17 to 22, 40 px over the awnings, end to end with them. */
export const LEVEL_2_4_CORDELES: readonly Cordel[] = [
  { x: 112, y: 136, w: 96 },
  { x: 272, y: 136, w: 96 },
];

/**
 * GDD-BOS-03: 2-4 as a level. Poncho starts (and respawns, GDD-BOS-01) on the floor at column 15, under the middle awning. La Estrella
 * starts phase 1 high over x = 400 and drops at 80, then 400; phase 2 over 320, dropping at 160, then 320; phase 3 over 400, her first drop
 * at 240 tearing the middle awning away (the tear: its top at y = 176, awning 1), then aiming at him. The level keeps all three awnings: the
 * tear is the fight's state.
 */
export const LEVEL_2_4: Level = {
  world: parseTiles(LEVEL_2_4_ROWS),
  spawn: { x: 240, y: 224 },
  ofrendas: [],
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
  awnings: LEVEL_2_4_AWNINGS,
  cordeles: LEVEL_2_4_CORDELES,
  estrella: { floor: 224, spots: [[400, 80], [320, 160], [400]], tear: { x: 240, y: 176, awning: 1 } },
};
