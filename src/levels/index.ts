// GDD-TEC-04: every level in the game, for the validator. A test level (the sandbox, the slopes level) skips the exit and length checks;
// a boss level (1-4) is held to the boss-level rule instead (GDD-BOS-01).
// GDD-UI-02: which one is played, and which one comes after it. GDD-LIFE-05: the lives a level starts with, the lives each world keeps
// in the save, the level each world's run has reached, and where the restart after the last life plays.
import { LIVES_MAX } from '../config/tuning';
import type { Level } from '../sim/run';
import type { Tip } from '../ui/tips';
import { LEVEL_0_1, TIPS_0_1 } from './level0-1';
import { LEVEL_1_1 } from './level1-1';
import { LEVEL_1_2 } from './level1-2';
import { LEVEL_1_3 } from './level1-3';
import { LEVEL_1_4 } from './level1-4';
import { SANDBOX_LEVEL } from './sandbox';
import { SLOPES_LEVEL } from './slopes';

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
  { id: '1-1', world: 1, test: false, level: LEVEL_1_1, next: '1-2' },
  { id: '1-2', world: 1, test: false, level: LEVEL_1_2, next: '1-3' },
  { id: '1-3', world: 1, test: false, level: LEVEL_1_3, next: '1-4' },
  // GDD-BOS-02: World 1's boss arena. It names no next level until World 2 exists.
  { id: '1-4', world: 1, test: false, level: LEVEL_1_4 },
  SANDBOX,
  { id: 'slopes', world: 1, test: true, level: SLOPES_LEVEL },
];

/** GDD-PRG-02: the levels whose progress is saved (the real ones, not the test level), by id, with their hilo counts: what `readSave` needs to read their entries. */
export const SAVED_LEVELS: Readonly<Record<string, number>> = Object.fromEntries(LEVELS.filter((e) => !e.test).map((e) => [e.id, e.level.hilos?.length ?? 0]));

/** GDD-PRG-02: the same levels with their ofrenda counts: what `readSave` needs to read the saved run's checkpoint. */
export const SAVED_OFRENDAS: Readonly<Record<string, number>> = Object.fromEntries(LEVELS.filter((e) => !e.test).map((e) => [e.id, e.level.ofrendas.length]));

/** The level with this id, if there is one. */
export const levelById = (id: string): LevelEntry | undefined => LEVELS.find((e) => e.id === id);

/** GDD-WLD-01: the levels of a world, in their order in `LEVELS`, the test levels left out (the sandbox and the slopes level are World 1 test levels). */
export const worldLevels = (world: number): readonly LevelEntry[] => LEVELS.filter((e) => e.world === world && !e.test);

/**
 * GDD-LIFE-05, GDD-PRG-02: the worlds whose lives the save keeps: those of the seven worlds that have a level (World 1; the test levels are
 * World 1's too, so they add no world).
 */
export const SAVED_WORLDS: readonly number[] = [...new Set(LEVELS.filter((e) => e.world >= 1).map((e) => e.world))];

/** GDD-UI-02, GDD-PRG-02: the ids of the saved (non-test) levels of each saved world, by the world's number as text: what `readSave` reads each world's `worldAt` against. */
export const SAVED_WORLD_LEVELS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(SAVED_WORLDS.map((w) => [String(w), worldLevels(w).map((e) => e.id)]));

/** GDD-UI-02, GDD-LIFE-05: the level "Start" plays and the lives its run starts with. */
export interface StartPick {
  readonly entry: LevelEntry;
  readonly lives: number;
}

/**
 * GDD-UI-02, GDD-PRG-02: what "Start" reads of the save: whether the tutorial has started, which levels are cleared, the lives saved per
 * world and the level each world's run has reached (`worldAt`, by the world's number as text).
 */
export interface StartSave {
  readonly tutorialPlayed: boolean;
  readonly levels: Readonly<Record<string, { readonly cleared: boolean }>>;
  readonly worldLives: Readonly<Record<string, number>>;
  readonly worldAt: Readonly<Record<string, string>>;
}

/**
 * GDD-UI-02, GDD-LIFE-05: what "Start" plays, and with how many lives. An address (`location.search`) wins, whatever was played or
 * cleared, with seven lives: `level=sandbox`, `level=slopes`, `level=1-1`, `level=1-2`, `level=1-3`, `level=1-4` (the boss arena) or `level=0-1` gives that level. Anything else gives
 * the tutorial, with seven, until it has started (GDD-PRG-02); then World 1 where its run is: the level `worldAt['1']` names, if it is a
 * real World 1 level, with the saved lives (seven when none are saved), but 1-1, the world's start, always with seven. Without a run
 * saved (a save from before it, or a value naming nothing) the older rule stands: at 0 lives (the Siete vidas gastadas screen came up in
 * it) 1-1 with seven; else the first World 1 level not cleared, with the saved lives, 1-1 with seven, and 1-1 once every World 1 level
 * is cleared. The cleared levels still count for medals, best times and hilos; they decide "Start" only without a run.
 */
export function startLevel(search: string, save: StartSave): StartPick {
  const id = new URLSearchParams(search).get('level');
  const addressed = id === 'sandbox' || id === 'slopes' || id === '1-1' || id === '1-2' || id === '1-3' || id === '1-4' || id === TUTORIAL_ID ? levelById(id) : undefined;
  if (addressed) return { entry: addressed, lives: LIVES_MAX };
  if (!save.tutorialPlayed) return { entry: levelById(TUTORIAL_ID)!, lives: LIVES_MAX };
  const world1 = worldLevels(1);
  const lives = save.worldLives['1'] ?? LIVES_MAX;
  const at = world1.find((e) => e.id === save.worldAt['1']);
  // A run kept with no lives (only a damaged save holds one: a game over moves the run back to 1-1) is a game over: 1-1 with seven.
  if (at) return lives === 0 || at === world1[0] ? { entry: world1[0]!, lives: LIVES_MAX } : { entry: at, lives };
  const next = lives === 0 ? undefined : world1.find((e) => save.levels[e.id]?.cleared !== true);
  return next === undefined || next === world1[0] ? { entry: world1[0]!, lives: LIVES_MAX } : { entry: next, lives };
}

/**
 * GDD-LIFE-05: the lives a level picked on the results menu starts with ("Next level", or "Retry" for the same level): the lives Poncho
 * has at the clear when both are levels of the same one of the seven worlds (1-1's go on into 1-2, 1-2's into 1-3, and 1-3's into 1-4), else seven. The tutorial, World 0, is
 * outside the seven worlds (GDD-WLD-01): its lives carry neither into 1-1 nor into its own Retry. A test level has no exit, so it never
 * comes here (GDD-TEC-04).
 */
export const livesInto = (from: LevelEntry, to: LevelEntry, lives: number): number => (from.world >= 1 && to.world === from.world ? lives : LIVES_MAX);

/**
 * GDD-LIFE-05: where the restart after the last life plays: the first level of the world (1-1 for every World 1 level, 0-1 for the
 * tutorial), or a test level's own start, since a test level is in no world's order.
 */
export const worldStart = (entry: LevelEntry): LevelEntry => (entry.test ? entry : worldLevels(entry.world)[0]!);

/**
 * GDD-LIFE-05, GDD-PRG-02: the lives the save keeps per world after a clear in a level of `entry`'s world (`lives`, those at the exit) or
 * after the Siete vidas gastadas screen in one (0: the world restarts at its first level with seven). The tutorial, outside the seven
 * worlds, keeps none. A test level never comes here: it has no exit, and the scene keeps its screen out of the save (GDD-PRG-02).
 */
export const worldLivesAfter = (saved: Readonly<Record<string, number>>, entry: LevelEntry, lives: number): Readonly<Record<string, number>> =>
  entry.world >= 1 ? { ...saved, [entry.world]: lives } : saved;

/**
 * GDD-UI-02, GDD-PRG-02, GDD-LIFE-05 (Proposed): the level each world's run has reached, kept in the save per world, after a clear in a
 * level of `entry`'s world or at the Siete vidas gastadas screen in one. "Start" plays that level. A clear moves the run to the next level
 * of the same world in the game's order (`next` of the entry); the world's last level, which ends the run, starts a new one at the world's
 * first level. The Siete vidas gastadas screen puts the run back at the world's first level, however it is reached. The tutorial, outside
 * the seven worlds, writes none. A test level never comes here (the scene keeps its screen out of the save, GDD-PRG-02). Retry writes
 * nothing more than the clear did.
 */
export function worldAtAfter(saved: Readonly<Record<string, string>>, entry: LevelEntry, event: 'clear' | 'gameover'): Readonly<Record<string, string>> {
  if (entry.world < 1) return saved;
  const inWorld = worldLevels(entry.world);
  const next = event === 'clear' && entry.next !== undefined ? inWorld.find((e) => e.id === entry.next) : undefined;
  return { ...saved, [entry.world]: (next ?? inWorld[0]!).id };
}
