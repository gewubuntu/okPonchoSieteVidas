// GDD-TEC-09: a level test's bot run kept as it is stepped, and replayed from its record. Pure, no Phaser; test support only, as `bots.ts` is.
// A level test steps through `tape.step` (`const stepRun = tape.step`): idle it is the real step, and inside `tape.record` each step is also
// held to be one chain and pure, and kept with its input and the hash of its result.
import { LIVES_MAX } from '../config/tuning';
import { readRecord, replay, startOf, writeRecord, type RecordHeader } from '../sim/replay';
import type { Abilities, PlayerInput } from '../sim/movement';
import { stepRun, type Level, type RunState } from '../sim/run';
import { stateHash } from '../sim/stateHash';

export interface Taped {
  /** The `run` of the first call. */
  readonly start: RunState;
  /** The `level` of every call. */
  readonly level: Level;
  readonly inputs: readonly PlayerInput[];
  /** `stateHash` of each result. */
  readonly hashes: readonly string[];
  /** The step (counted from 1) whose result was the first in the clear phase, or null. */
  readonly clearAt: number | null;
  readonly end: RunState;
}

export interface Tape {
  /** Has `stepRun`'s signature. Idle it calls the real step; while `record` runs it also checks and keeps each step. */
  readonly step: typeof stepRun;
  /** Runs `play` with the tape on and gives back what it stepped; the tape is off again afterwards, also when `play` throws. */
  record(play: () => void): Taped;
}

/**
 * Freezes `value` and what it holds, so that a write to it throws (ES modules are strict). An object already frozen is left as it is: one
 * this froze holds only frozen parts. A Set cannot be frozen, so a `used.add` goes unseen.
 */
function deepFreeze(value: unknown): void {
  // A number, a string, null and undefined count as frozen (`Object.isFrozen`), so they end the walk here as an object already frozen does.
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const part of Object.values<unknown>(Object(value))) deepFreeze(part);
}

export function tapeOf(real: typeof stepRun = stepRun): Tape {
  let on = false;
  let start: RunState | null = null;
  let level: Level | null = null;
  let last: RunState | null = null;
  let inputs: PlayerInput[] = [];
  let hashes: string[] = [];
  let clearAt: number | null = null;

  const step: typeof stepRun = (run, input, at) => {
    if (!on) return real(run, input, at);
    if (last === null) {
      start = run;
      level = at;
    } else if (run !== last || at !== level) throw new Error('the tape saw a step off its chain');
    deepFreeze(run);
    deepFreeze(input);
    const next = real(run, input, at);
    inputs.push(input);
    hashes.push(stateHash(next));
    if (clearAt === null && next.phase === 'clear') clearAt = hashes.length;
    last = next;
    return next;
  };

  const record = (play: () => void): Taped => {
    start = level = last = null;
    inputs = [];
    hashes = [];
    clearAt = null;
    on = true;
    try {
      play();
    } finally {
      on = false;
    }
    // The first call sets `start` and `level` as it sets `last`, so `last` says whether any call came.
    if (last === null) throw new Error('nothing stepped');
    return { start: start!, level: level!, inputs, hashes, clearAt, end: last };
  };

  return { step, record };
}

/** The header of a run of `level` from `startRun(level)` with seven lives, under the abilities its bot was given on top of the level's own. */
export const headerFor = (id: string, level: Level, abilities: Abilities = {}): RecordHeader => ({
  format: 1,
  sim: 'tape',
  level: id,
  seed: 0,
  token: null,
  start: 'start',
  lives: LIVES_MAX,
  hilos: '0'.repeat(level.hilos?.length ?? 0),
  abilities,
  resume: null,
});

export interface ReplayCheck {
  /** The steps the replay stepped. */
  readonly steps: number;
  /** The first step (from 0) whose hash the replay does not share with the tape, -1 when none; a length mismatch counts at the shorter length. */
  readonly firstDiff: number;
  /** The step (from 1) the taped run reached the clear on, or null. */
  readonly clearTaped: number | null;
  /** The step (from 1) the replay reached the clear on, or null. */
  readonly clearReplay: number | null;
}

/**
 * Writes the taped inputs as a record under `header`, reads that text back and replays it on `base` (the level as registered), and compares
 * the replay's hashes with the taped ones.
 */
export function expectReplay(
  taped: { readonly start: RunState; readonly inputs: readonly PlayerInput[]; readonly hashes: readonly string[]; readonly clearAt?: number | null },
  header: RecordHeader,
  base: Level,
): ReplayCheck {
  if (stateHash(taped.start) !== stateHash(startOf(header, base).run)) throw new Error('the run does not start as its header says');
  const text = writeRecord({ header, entries: taped.inputs.map((input) => ({ input })) });
  const record = readRecord(text, taped.inputs.length);
  if (record === null) throw new Error('the record does not read back');
  const replayed = replay(record, base);
  // Past the end of the shorter list a hash is undefined, which no hash is: a length mismatch counts as a difference at the shorter length.
  const longest = Math.max(replayed.hashes.length, taped.hashes.length);
  const firstDiff = Array.from({ length: longest }, (_, i) => i).findIndex((i) => replayed.hashes[i] !== taped.hashes[i]);
  return { steps: replayed.hashes.length, firstDiff, clearTaped: taped.clearAt ?? null, clearReplay: replayed.clearStep };
}
