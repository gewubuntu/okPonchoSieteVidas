// GDD-TEC-04: every level in the game, for the validator. A test level (the sandbox) skips the exit and length checks.
// GDD-UI-02: which one is played.
import type { Level } from '../sim/run';
import { LEVEL_1_1 } from './level1-1';
import { SANDBOX_LEVEL } from './sandbox';

export interface LevelEntry {
  readonly id: string;
  /** GDD-WLD-02: the world it belongs to, which sets its gap limit (GDD-WLD-03). */
  readonly world: number;
  readonly test: boolean;
  readonly level: Level;
}

const SANDBOX: LevelEntry = { id: 'sandbox', world: 1, test: true, level: SANDBOX_LEVEL };

export const LEVELS: readonly LevelEntry[] = [{ id: '1-1', world: 1, test: false, level: LEVEL_1_1 }, SANDBOX];

/** GDD-UI-02: the level to play, from a URL query string (`location.search`): `level=sandbox` gives the sandbox, anything else 1-1. */
export function levelFor(search: string): LevelEntry {
  return new URLSearchParams(search).get('level') === 'sandbox' ? SANDBOX : LEVELS[0]!;
}
