// GDD-WLD-17, GDD-WLD-18: the whole-level bot runner the levels' drives share (`level3-2.drive.ts`, `level3-3.drive.ts`): a bot is a list of
// tasks (`Ctl`), each giving the input for a step until it is done. Pure, no Phaser; test support only. Nothing here reads a level but the one
// it is given.
import type { PlayerInput } from '../sim/movement';
import { stepRun, type Level, type RunState } from '../sim/run';

const idle: PlayerInput = { move: 0, jumpHeld: false };

export type Ctl = (r: RunState) => { input: PlayerInput; done: boolean };
/** Holds nothing until `until`. */
export const waitFor = (until: (r: RunState) => boolean): Ctl => (r) => ({ input: idle, done: until(r) });
/** Runs the way `dir` says until `until`. */
export const runUntil = (dir: 1 | -1, until: (r: RunState) => boolean): Ctl => (r) => ({ input: { move: dir, jumpHeld: false }, done: until(r) });
/**
 * Runs the way `dir` says and, standing with his middle past `x` (that way) and jump up for a step (L-048), presses jump and holds it
 * while he rises (`top`) or until his middle is past `until` (that way); done on the landing.
 */
export function jumpAt(x: number, hold: 'top' | number, dir: 1 | -1 = 1): Ctl {
  let pressed = false;
  let air = false;
  return (r) => {
    const p = r.player;
    if (!pressed) {
      pressed = p.grounded && dir * (p.x - x) >= 0 && !p.jumpWasHeld;
      return { input: { move: dir, jumpHeld: pressed }, done: false };
    }
    if (!p.grounded) air = true;
    if (air && p.grounded) return { input: { move: dir, jumpHeld: false }, done: true };
    return { input: { move: dir, jumpHeld: hold === 'top' ? p.vy < 0 : dir * (p.x - hold) < 0 }, done: false };
  };
}

export interface Bot {
  readonly states: readonly RunState[];
  /** What each step of `states` read (GDD-TEC-09): `idle` while he waited to respawn, else the task's input. */
  readonly inputs: readonly PlayerInput[];
  /** The steps on which a life was lost. */
  readonly lost: readonly number[];
  /** The step each task was done on. */
  readonly marks: readonly number[];
  readonly end: RunState;
}
/**
 * Plays `tasks` in turn from `from` on `level` (at most `max` steps); while he waits to respawn it holds nothing, and it stops at the level's
 * clear, and with `stopAtLoss` at the first life lost.
 */
export function runBot(tasks: readonly Ctl[], from: RunState, level: Level, max = 4000, stopAtLoss = false): Bot {
  const states: RunState[] = [];
  const inputs: PlayerInput[] = [];
  const lost: number[] = [];
  const marks: number[] = [];
  let r = from;
  let k = 0;
  while (k < tasks.length && states.length < max && r.phase !== 'clear' && r.phase !== 'gameover') {
    if (r.phase !== 'playing') {
      r = stepRun(r, idle, level);
      inputs.push(idle);
      states.push(r);
      continue;
    }
    const { input, done } = tasks[k]!(r);
    if (done) {
      marks.push(states.length);
      k++;
      continue;
    }
    const before = r.lives.lives;
    r = stepRun(r, input, level);
    inputs.push(input);
    if (r.lives.lives < before) lost.push(states.length);
    states.push(r);
    if (stopAtLoss && lost.length > 0) break;
  }
  return { states, inputs, lost, marks, end: r };
}

export const tally = (into: Record<string, number>, key: string) => (into[key] = (into[key] ?? 0) + 1);
/** A list's least and greatest, or `none`. */
export const span = (a: readonly number[]) => (a.length === 0 ? 'none' : `${Math.min(...a)} to ${Math.max(...a)}`);
