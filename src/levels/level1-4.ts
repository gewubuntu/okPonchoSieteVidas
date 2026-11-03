// Level 1-4, World 1's boss arena (GDD-BOS-01, GDD-BOS-02): one screen, 30 x 17 tiles (480 x 272 px), where Don Zopilote is fought.
// `#` is solid, `.` is empty. The floor's top is row 14 (y = 224), with no pit; a pillar 4 tiles wide and 3 tall stands at each side
// (columns 0 to 3 and 26 to 29, top y = 176), a rock resting on the inner edge of each. No ofrendas, exit, hilos or veladora.
import type { Level } from '../sim/run';
import { parseTiles } from '../sim/tilemap';

export const LEVEL_1_4_ROWS: readonly string[] = [
  ...Array<string>(11).fill('..............................'),
  ...Array<string>(3).fill('####......................####'),
  ...Array<string>(3).fill('##############################'),
];

/** GDD-BOS-02: 1-4 as a level. Poncho starts (and respawns, GDD-BOS-01) on the floor at column 14. */
export const LEVEL_1_4: Level = {
  world: parseTiles(LEVEL_1_4_ROWS),
  spawn: { x: 232, y: 224 },
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
  boss: { x: 240, y: 72, floor: 224 },
  rocks: [
    { x: 56, y: 176 },
    { x: 424, y: 176 },
  ],
};
