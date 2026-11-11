// GDD-TEC-04: every level in the game, for the validator. A test level (the sandbox, the slopes level) skips the exit and length checks;
// a boss level (1-4, 2-4) is held to the boss-level rule instead (GDD-BOS-01).
// GDD-UI-02: which one is played, and which one comes after it. GDD-LIFE-05: the lives a level starts with, the lives each world keeps
// in the save, the level each world's run has reached, and where the restart after the last life plays.
import { LIVES_MAX } from '../config/tuning';
import type { Abilities } from '../sim/movement';
import type { Level } from '../sim/run';
import type { Tip } from '../ui/tips';
import { LEVEL_0_1, TIPS_0_1 } from './level0-1';
import { LEVEL_1_1 } from './level1-1';
import { LEVEL_1_2 } from './level1-2';
import { LEVEL_1_3 } from './level1-3';
import { LEVEL_1_4 } from './level1-4';
import { LEVEL_2_1 } from './level2-1';
import { LEVEL_2_2 } from './level2-2';
import { LEVEL_2_3 } from './level2-3';
import { LEVEL_2_4 } from './level2-4';
import { SANDBOX_LEVEL } from './sandbox';
import { SLOPES_LEVEL } from './slopes';
import { LAB_2M_LEVEL } from './lab2m';
import { LAB_2E_ID, LAB_2E_LEVEL } from './lab2e';
import { LAB_3C_ID, LAB_3C_LEVEL } from './lab3c';
import { LAB_3T_ID, LAB_3T_LEVEL } from './lab3t';

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
  // GDD-BOS-02: World 1's boss arena. Its Next level starts World 2 (GDD-UI-02), with seven lives (GDD-LIFE-05).
  { id: '1-4', world: 1, test: false, level: LEVEL_1_4, next: '2-1' },
  // GDD-WLD-01: World 2, the Mercado: 2-1 to 2-3 (GDD-WLD-12, GDD-WLD-13, GDD-WLD-14); 2-4 is its boss arena and, the last level built, names no next.
  { id: '2-1', world: 2, test: false, level: LEVEL_2_1, next: '2-2' },
  { id: '2-2', world: 2, test: false, level: LEVEL_2_2, next: '2-3' },
  { id: '2-3', world: 2, test: false, level: LEVEL_2_3, next: '2-4' },
  { id: '2-4', world: 2, test: false, level: LEVEL_2_4 },
  SANDBOX,
  { id: 'slopes', world: 1, test: true, level: SLOPES_LEVEL },
  // GDD-WLD-10, GDD-WLD-11: the Mercado lab, a World 2 test level.
  { id: 'lab-2m', world: 2, test: true, level: LAB_2M_LEVEL },
  { id: LAB_2E_ID, world: 2, test: true, level: LAB_2E_LEVEL },
  // GDD-WLD-15: the vagonetas lab, a World 3 test level.
  { id: LAB_3C_ID, world: 3, test: true, level: LAB_3C_LEVEL },
  // GDD-UI-04: the tall lab, a World 3 test level 40 rows tall, for the camera up and down.
  { id: LAB_3T_ID, world: 3, test: true, level: LAB_3T_LEVEL },
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
 * GDD-LIFE-05, GDD-PRG-02: the worlds whose lives the save keeps: those of the seven worlds that have a real level (Worlds 1 and 2; a
 * test level, such as the sandbox, the World 2 labs lab-2m and lab-2e or the World 3 lab lab-3c, adds no world).
 */
export const SAVED_WORLDS: readonly number[] = [...new Set(LEVELS.filter((e) => e.world >= 1 && !e.test).map((e) => e.world))];

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
 * cleared, with seven lives: `level=` and the id of any level (`level=sandbox`, `level=0-1`, `level=1-4`, `level=2-1` ...) gives that level. Anything else gives
 * the tutorial, with seven, until it has started (GDD-PRG-02); then the latest world reached (`frontierWorld`) where its run is: the
 * level `worldAt` names for that world, if it is a real level of it, with the saved lives (seven when none are saved), but the world's
 * first level always with seven. Without a run saved (a save from before it, or a value naming nothing) the older rule stands: at 0 lives
 * (the Siete vidas gastadas screen came up in it) the world's first level with seven; else its first level not cleared, with the saved
 * lives, the first level with seven, and the first level once every level of the world is cleared. The cleared levels still count for
 * medals, best times and hilos; they decide "Start" only without a run, and in which world it plays.
 */
export function startLevel(search: string, save: StartSave): StartPick {
  const id = new URLSearchParams(search).get('level');
  const addressed = id === null ? undefined : levelById(id);
  if (addressed) return { entry: addressed, lives: LIVES_MAX };
  if (!save.tutorialPlayed) return { entry: levelById(TUTORIAL_ID)!, lives: LIVES_MAX };
  const world = String(frontierWorld(save.levels));
  const inWorld = worldLevels(Number(world));
  const lives = save.worldLives[world] ?? LIVES_MAX;
  const at = inWorld.find((e) => e.id === save.worldAt[world]);
  // A run kept with no lives (only a damaged save holds one: a game over moves the run back to the first level) is a game over: the
  // first level with seven.
  if (at) return lives === 0 || at === inWorld[0] ? { entry: inWorld[0]!, lives: LIVES_MAX } : { entry: at, lives };
  const next = lives === 0 ? undefined : inWorld.find((e) => save.levels[e.id]?.cleared !== true);
  return next === undefined || next === inWorld[0] ? { entry: inWorld[0]!, lives: LIVES_MAX } : { entry: next, lives };
}

/**
 * GDD-UI-02: the latest world reached, the one "Start" plays: World 1, and while a world's last level is cleared and names a next level
 * in a later world (1-4 names 2-1), that world. A save from before World 2 that cleared 1-4 so goes on in World 2.
 */
export function frontierWorld(levels: StartSave['levels']): number {
  let world = 1;
  for (;;) {
    // Never empty: World 1 has levels, and a later world holds the level named.
    const inWorld = worldLevels(world);
    const last = inWorld[inWorld.length - 1]!;
    const next = last.next === undefined ? undefined : levelById(last.next);
    if (levels[last.id]?.cleared !== true || next === undefined || next.world <= world) return world;
    world = next.world;
  }
}

/**
 * GDD-LIFE-05: the lives a level picked on the results menu starts with ("Next level", or "Retry" for the same level): the lives Poncho
 * has at the clear when both are levels of the same one of the seven worlds (1-1's go on into 1-2, 1-2's into 1-3, and 1-3's into 1-4), else
 * seven (1-4's Next level starts 2-1 with seven). The tutorial, World 0, is
 * outside the seven worlds (GDD-WLD-01): its lives carry neither into 1-1 nor into its own Retry. A test level has no exit, so it never
 * comes here (GDD-TEC-04).
 */
export const livesInto = (from: LevelEntry, to: LevelEntry, lives: number): number => (from.world >= 1 && to.world === from.world ? lives : LIVES_MAX);

/**
 * GDD-LIFE-05: where the restart after the last life plays: the first level of the world (1-1 for every World 1 level, 2-1 for every
 * World 2 level, 0-1 for the tutorial), or a test level's own start, since a test level is in no world's order.
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
 * first level (1-4, whose next level is in World 2, too). The Siete vidas gastadas screen puts the run back at the world's first level, however it is reached. The tutorial, outside
 * the seven worlds, writes none. A test level never comes here (the scene keeps its screen out of the save, GDD-PRG-02). Retry writes
 * nothing more than the clear did.
 */
export function worldAtAfter(saved: Readonly<Record<string, string>>, entry: LevelEntry, event: 'clear' | 'gameover'): Readonly<Record<string, string>> {
  if (entry.world < 1) return saved;
  const inWorld = worldLevels(entry.world);
  const next = event === 'clear' && entry.next !== undefined ? inWorld.find((e) => e.id === entry.next) : undefined;
  return { ...saved, [entry.world]: (next ?? inWorld[0]!).id };
}

/** GDD-PRG-01: the level whose clear unlocks the glide, World 2's boss arena. */
export const GLIDE_UNLOCK_ID = '2-4';

/**
 * GDD-PRG-01 (Decided, user, 2026-11-10: "Glide everywhere"): the abilities the saved progress unlocks in every level: the glide once 2-4
 * is cleared, nothing before. The wall cling is not unlocked here.
 */
export const unlockedAbilities = (levels: StartSave['levels']): Abilities => (levels[GLIDE_UNLOCK_ID]?.cleared === true ? { glide: true } : {});

/** GDD-PRG-01: the level with the unlocked abilities added to its own; with none unlocked, the very same level. */
export const withUnlocks = (level: Level, unlocked: Abilities): Level =>
  Object.keys(unlocked).length === 0 ? level : { ...level, abilities: { ...level.abilities, ...unlocked } };
