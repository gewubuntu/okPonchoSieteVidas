// Level 2-4, World 2's boss arena (GDD-BOS-01): a stub until La Estrella and her arena are built. It copies 1-4's arena (GDD-BOS-02):
// one screen, 30 x 17 tiles, with Don Zopilote standing in as the boss. No ofrendas, exit, hilos or veladora.
import type { Level } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { LEVEL_1_4, LEVEL_1_4_ROWS } from './level1-4';

/** GDD-BOS-01: 2-4 as a level: 1-4's floor, pillars, rocks, spawn and boss, in a tile grid of its own. */
export const LEVEL_2_4: Level = { ...LEVEL_1_4, world: parseTiles(LEVEL_1_4_ROWS) };
