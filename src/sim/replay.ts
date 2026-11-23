// GDD-TEC-09: a run's record (a header and what every step read) and its replay with the real step. Pure, no Phaser (GDD-TEC-02).
import { bitsOf, fromBits } from './detmath';
import type { Abilities, PlayerInput } from './movement';
import { resumeHeld } from './pause';
import { buttonsDown, restartRun, resumeRun, startRun, stepRun, type Level, type RunState } from './run';
import type { SavedRun } from './save';
import { stateHash } from './stateHash';

export const RECORD_FORMAT = 1;

/** GDD-TEC-09: what a run starts from that a step cannot work out for itself. */
export interface RecordHeader {
  readonly format: typeof RECORD_FORMAT;
  /** The simulation version the run was played on. */
  readonly sim: string;
  /** The level's id. */
  readonly level: string;
  /** The attempt's seed. Nothing in the simulation is random yet, so nothing reads it. */
  readonly seed: number;
  /** GDD-TEC-10: the start token's ID, null until the game server gives one. */
  readonly token: string | null;
  /** How the run begins: `startRun`, `restartRun` (GDD-LIFE-05) or `resumeRun` (GDD-PRG-02). */
  readonly start: 'start' | 'restart' | 'resume';
  /** The lives a 'start' begins with (GDD-LIFE-05). */
  readonly lives: number;
  /** The hilos saved for the level in earlier runs, a '1' or '0' per hilo of the level (GDD-WLD-04). */
  readonly hilos: string;
  /** GDD-PRG-01: the abilities unlocked by progress, on top of the level's own. */
  readonly abilities: Abilities;
  /** GDD-PRG-02: the saved run a 'resume' begins from, else null. */
  readonly resume: Omit<SavedRun, 'level'> | null;
}

/** One entry of a record: a step's input, or (`held`) the buttons that count as already held before the next step (GDD-UI-02, `resumeHeld`). */
export interface RecordEntry {
  readonly input: PlayerInput;
  readonly held?: true;
}

export interface RunRecord {
  readonly header: RecordHeader;
  readonly entries: readonly RecordEntry[];
}

/** An optional button in two bits: 0 left out, 1 false, 2 true (left out and false differ: `buttonsDown` reads `left ?? move < 0`). */
const tri = (b: boolean | undefined): number => (b === undefined ? 0 : b ? 2 : 1);
const untri = (n: number): boolean | undefined => (n === 0 ? undefined : n === 2);
/** The move values of bits 9-10's first three states; the fourth carries its bits after the code. */
const MOVES = [0, 1, -1] as const;

/**
 * An input as text: an 11-bit mask in hex (bit 0 jump; bits 1-2 claw, 3-4 Fuego, 5-6 left, 7-8 right, each as `tri`; bits 9-10 the move:
 * 0 for +0, 1 for 1, 2 for -1, 3 for anything else, whose 16 hex digits of bits follow a colon, so -0 and a stick's value are exact).
 */
export function inputCode(input: PlayerInput): string {
  const m = input.move;
  const move = Object.is(m, 0) ? 0 : m === 1 ? 1 : m === -1 ? 2 : 3;
  const mask = (input.jumpHeld ? 1 : 0) | (tri(input.claw) << 1) | (tri(input.fuego) << 3) | (tri(input.left) << 5) | (tri(input.right) << 7) | (move << 9);
  return move === 3 ? `${mask.toString(16)}:${bitsOf(m)}` : mask.toString(16);
}

/**
 * The input `inputCode` wrote as `code`, or null for any text it never writes. Only the code of the input read back counts, so that one
 * comparison refuses every other bit, a field's unused fourth state, a leading 0, capitals, bits missing or not asked for, and bits of
 * the wrong length.
 */
export function codeInput(code: string): PlayerInput | null {
  const [hex = '', bits = ''] = code.split(':');
  const mask = parseInt(hex, 16);
  const kind = (mask >> 9) & 3;
  const input: PlayerInput = { move: kind === 3 ? fromBits(bits) : MOVES[kind]!, jumpHeld: (mask & 1) === 1 };
  const claw = untri((mask >> 1) & 3);
  const fuego = untri((mask >> 3) & 3);
  const left = untri((mask >> 5) & 3);
  const right = untri((mask >> 7) & 3);
  if (claw !== undefined) input.claw = claw;
  if (fuego !== undefined) input.fuego = fuego;
  if (left !== undefined) input.left = left;
  if (right !== undefined) input.right = right;
  // `move` is from -1 to 1 (`PlayerInput`): a stick's bits outside it, a NaN among them, are no input a step was ever given.
  if (!(input.move >= -1 && input.move <= 1)) return null;
  return inputCode(input) === code ? input : null;
}

/** A record as text: its header and, under `inputs`, the entries run-length coded (`120*aa h32b 30*32a`), a held mark `h` and its code. */
export function writeRecord(record: RunRecord): string {
  const tokens: string[] = [];
  let last = '';
  let count = 0;
  const flush = () => {
    if (count > 0) tokens.push(count === 1 ? last : `${count}*${last}`);
    count = 0;
  };
  for (const e of record.entries) {
    const code = inputCode(e.input);
    if (e.held) {
      flush();
      tokens.push(`h${code}`);
      // After a mark `count` is 0, so a step of the same code as `last` counts from 1 again, as a new code would.
    } else if (code === last) count++;
    else {
      flush();
      last = code;
      count = 1;
    }
  }
  flush();
  return JSON.stringify({ ...record.header, inputs: tokens.join(' ') });
}

const isFlags = (v: unknown): v is boolean[] => Array.isArray(v) && v.every((b) => typeof b === 'boolean');
const isTexts = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/** The abilities as read, or null when it is no plain object or a field is there and is not `true`: a record's abilities only add. */
function abilitiesOf(value: unknown): Abilities | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { glide, wallCling } = value as { glide?: unknown; wallCling?: unknown };
  const out: { glide?: boolean; wallCling?: boolean } = {};
  // An ability a record names is one it adds (an unlock): `true` or left out. A `false` could only take away what the level has itself.
  if (glide === true) out.glide = true;
  else if (glide !== undefined) return null;
  if (wallCling === true) out.wallCling = true;
  else if (wallCling !== undefined) return null;
  return out;
}

/** The saved run as read (null for none), or undefined when it is neither null nor of `SavedRun`'s types. */
function resumeOf(value: unknown): Omit<SavedRun, 'level'> | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  const { checkpoint, lives, livesIn, used, hilos, clock } = value as { checkpoint?: unknown; lives?: unknown; livesIn?: unknown; used?: unknown; hilos?: unknown; clock?: unknown };
  if (typeof checkpoint !== 'number' || typeof lives !== 'number' || typeof livesIn !== 'number' || typeof clock !== 'number' || !isTexts(used) || !isFlags(hilos)) return undefined;
  return { checkpoint, lives, livesIn, used, hilos, clock };
}

/**
 * The header as read, or null when a field is not of the type `RecordHeader` names, the seed is no whole number from 0 that a number holds
 * exactly, an ability is turned off (the other values are not checked: `replayRecord` holds them to the level), or the saved run does not match the start: a 'resume' has one, a 'start' and a 'restart' have none.
 */
function headerOf(data: object): RecordHeader | null {
  const { format, sim, level, seed, token, start, lives, hilos, abilities, resume } = data as { format?: unknown; sim?: unknown; level?: unknown; seed?: unknown; token?: unknown; start?: unknown; lives?: unknown; hilos?: unknown; abilities?: unknown; resume?: unknown };
  if (format !== RECORD_FORMAT || typeof sim !== 'string' || typeof level !== 'string' || typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0 || (token !== null && typeof token !== 'string')) return null;
  if ((start !== 'start' && start !== 'restart' && start !== 'resume') || typeof lives !== 'number' || typeof hilos !== 'string' || !/^[01]*$/.test(hilos)) return null;
  const powers = abilitiesOf(abilities);
  const saved = resumeOf(resume);
  if (powers === null || saved === undefined || (start === 'resume') !== (saved !== null)) return null;
  return { format, sim, level, seed, token, start, lives, hilos, abilities: powers, resume: saved };
}

/**
 * The record `writeRecord` wrote as `text`, or null for anything malformed: not JSON, a header field not of its type (another format
 * among them), no inputs, a bad token, inputs not written as `writeRecord` writes them (a count under 2 or past the safe integers, two runs of one
 * code side by side), or more than `maxSteps` steps in all (the caller's
 * limit, a whole number of 0 or more; a held mark is no step). The counts are added up before any entry is built.
 */
export function readRecord(text: string, maxSteps: number): RunRecord | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  // The limit is the caller's whole number of steps; anything else (a NaN would let every record through) reads nothing.
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 0) return null;
  if (typeof data !== 'object' || data === null) return null;
  const { inputs } = data as { inputs?: unknown };
  const header = headerOf(data);
  if (typeof inputs !== 'string' || header === null) return null;
  const runs: { input: PlayerInput; held: boolean; count: number }[] = [];
  let steps = 0;
  // The code of the run of steps just before, '' after a held mark or at the start: `writeRecord` never writes two runs of one code
  // side by side, nor a count of 1, so neither is read.
  let before = '';
  for (const token of inputs === '' ? [] : inputs.split(' ')) {
    const held = token.startsWith('h');
    const star = token.indexOf('*');
    const prefix = held || star < 0 ? '1' : token.slice(0, star);
    const input = codeInput(token.slice(held ? 1 : star + 1));
    // A count is a whole number from 1, in digits, and a safe integer.
    const count = Number(prefix);
    if (input === null || !/^[1-9][0-9]*$/.test(prefix) || !Number.isSafeInteger(count)) return null;
    const code = token.slice(held ? 1 : star + 1);
    if (!held && (code === before || (star >= 0 && count === 1))) return null;
    before = held ? '' : code;
    if (!held) steps += count;
    if (steps > maxSteps) return null;
    runs.push({ input, held, count });
  }
  const entries: RecordEntry[] = [];
  for (const r of runs) for (let i = 0; i < r.count; i++) entries.push(r.held ? { input: r.input, held: true } : { input: r.input });
  return { header, entries };
}

/** Records what a run's steps read, in order. */
export class RunRecorder {
  private readonly entries: RecordEntry[] = [];
  private spoiled = false;
  constructor(private readonly header: RecordHeader) {}
  step(input: PlayerInput): void {
    this.entries.push({ input: { ...input } });
  }
  /** Where `resumeHeld` reaches the run. With nothing down it changes nothing, so a pause with no button down leaves no mark. */
  held(input: PlayerInput): void {
    if (buttonsDown(input) !== 0) this.entries.push({ input: { ...input }, held: true });
  }
  /** The run can no longer be reproduced from its record. */
  spoil(): void {
    this.spoiled = true;
  }
  record(): RunRecord | null {
    return this.spoiled ? null : { header: this.header, entries: [...this.entries] };
  }
}

/**
 * The state a record's header begins a run of `level` with (the level as registered), and the level with the header's abilities added,
 * as `withUnlocks` adds them (written here, so that `src/sim/` imports nothing of `src/levels/`). With none, it plays as the level does.
 */
export function startOf(header: RecordHeader, level: Level): { run: RunState; level: Level } {
  // Added, never taken away: an ability the level has itself stays on whatever the header says (`withUnlocks` only adds too).
  const added = { ...(header.abilities.glide === true ? { glide: true } : {}), ...(header.abilities.wallCling === true ? { wallCling: true } : {}) };
  const played: Level = { ...level, abilities: { ...level.abilities, ...added } };
  const hilos = Array.from(header.hilos, (c) => c === '1');
  const run =
    header.start === 'resume'
      ? resumeRun(played, { ...header.resume!, level: header.level }, hilos)
      : header.start === 'restart'
        ? restartRun(played, hilos)
        : startRun(played, hilos, header.lives);
  return { run, level: played };
}

export interface Replayed {
  readonly end: RunState;
  /** The state's hash after each step. */
  readonly hashes: readonly string[];
  /** The step (counted from 1, held marks not counted) that reached the clear, or null. */
  readonly clearStep: number | null;
}

/** GDD-TEC-09: the run a record makes, with the real step. */
export function replay(record: RunRecord, level: Level): Replayed {
  const start = startOf(record.header, level);
  let run = start.run;
  const hashes: string[] = [];
  let clearStep: number | null = null;
  for (const e of record.entries) {
    if (e.held) {
      run = resumeHeld(run, e.input);
      continue;
    }
    run = stepRun(run, e.input, start.level);
    hashes.push(stateHash(run));
    if (clearStep === null && run.phase === 'clear') clearStep = hashes.length;
  }
  return { end: run, hashes, clearStep };
}
