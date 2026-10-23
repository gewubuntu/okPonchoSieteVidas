// GDD-TEC-04: every level in the game, for the validator. A test level (the sandbox) skips the exit and length checks.
import type { Level } from '../sim/run';
import { SANDBOX_LEVEL } from './sandbox';

export interface LevelEntry {
  readonly id: string;
  /** GDD-WLD-02: the world it belongs to, which sets its gap limit (GDD-WLD-03). */
  readonly world: number;
  readonly test: boolean;
  readonly level: Level;
}

export const LEVELS: readonly LevelEntry[] = [{ id: 'sandbox', world: 1, test: true, level: SANDBOX_LEVEL }];
