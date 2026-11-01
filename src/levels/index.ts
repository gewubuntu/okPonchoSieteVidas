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

/** GDD-UI-02: the tutorial level's id. */
export const TUTORIAL_ID = '0-1';

const SANDBOX: LevelEntry = { id: 'sandbox', world: 1, test: true, level: SANDBOX_LEVEL };

export const LEVELS: readonly LevelEntry[] = [
  { id: TUTORIAL_ID, world: 0, test: false, level: LEVEL_0_1, tips: TIPS_0_1, next: '1-1' },
  { id: '1-1', world: 1, test: false, level: LEVEL_1_1 },
  SANDBOX,
];

/** GDD-PRG-02: the levels whose progress is saved (the real ones, not the test level), by id, with their hilo counts: what `readSave` needs to read their entries. */
export const SAVED_LEVELS: Readonly<Record<string, number>> = Object.fromEntries(LEVELS.filter((e) => !e.test).map((e) => [e.id, e.level.hilos?.length ?? 0]));

/** GDD-PRG-02: the same levels with their ofrenda counts: what `readSave` needs to read the saved run's checkpoint. */
export const SAVED_OFRENDAS: Readonly<Record<string, number>> = Object.fromEntries(LEVELS.filter((e) => !e.test).map((e) => [e.id, e.level.ofrendas.length]));

/** The level with this id, if there is one. */
export const levelById = (id: string): LevelEntry | undefined => LEVELS.find((e) => e.id === id);

/**
 * GDD-UI-02: what "Start" plays. An address (`location.search`) wins, whatever was played: `level=sandbox`, `level=1-1` or
 * `level=0-1` gives that level. Anything else gives 1-1 once the tutorial has started (GDD-PRG-02), else the tutorial.
 */
export function startLevel(search: string, tutorialPlayed: boolean): LevelEntry {
  const id = new URLSearchParams(search).get('level');
  const addressed = id === 'sandbox' || id === '1-1' || id === TUTORIAL_ID ? levelById(id) : undefined;
  return addressed ?? levelById(tutorialPlayed ? '1-1' : TUTORIAL_ID)!;
}
