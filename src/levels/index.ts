// GDD-TEC-04: every level in the game, for the validator. A test level (the sandbox) skips the exit and length checks.
// GDD-UI-02: which one is played, and which one comes after it.
import type { Level } from '../sim/run';
import type { Tip } from '../ui/tips';
import { LEVEL_0_1, TIPS_0_1 } from './level0-1';
import { LEVEL_1_1 } from './level1-1';
import { SANDBOX_LEVEL } from './sandbox';

export interface LevelEntry {
  readonly id: string;
  /** GDD-WLD-01, GDD-WLD-02: the world it belongs to, which sets its gap limit (GDD-WLD-03). 0 is the tutorial, outside the seven worlds. */
  readonly world: number;
  readonly test: boolean;
  readonly level: Level;
  /** GDD-UI-05: the tutorial tips, if it has any. */
  readonly tips?: readonly Tip[];
  /** GDD-UI-02: the id of the level the press that ends its level clear screen starts. Left out, that press brings back the title screen. */
  readonly next?: string;
}

const SANDBOX: LevelEntry = { id: 'sandbox', world: 1, test: true, level: SANDBOX_LEVEL };

export const LEVELS: readonly LevelEntry[] = [
  { id: '0-1', world: 0, test: false, level: LEVEL_0_1, tips: TIPS_0_1, next: '1-1' },
  { id: '1-1', world: 1, test: false, level: LEVEL_1_1 },
  SANDBOX,
];

/** The level with this id, if there is one. */
export const levelById = (id: string): LevelEntry | undefined => LEVELS.find((e) => e.id === id);

/** GDD-UI-02: the level to play, from a URL query string (`location.search`): `level=sandbox` or `level=1-1` gives that level, anything else 0-1. */
export function levelFor(search: string): LevelEntry {
  const id = new URLSearchParams(search).get('level');
  return (id === 'sandbox' || id === '1-1' ? levelById(id) : undefined) ?? LEVELS[0]!;
}
