import { describe, expect, it } from 'vitest';
import { LIVES_MAX } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';
import { readRecord, writeRecord, type RecordHeader, type RunRecord } from '../sim/replay';
import { startRun, stepRun } from '../sim/run';
import type { SavedRun } from '../sim/save';
import { stateHash } from '../sim/stateHash';
import { LEVEL_1_1 } from './level1-1';
import { replayRecord } from './records';
import { SANDBOX_LEVEL } from './sandbox';

const right: PlayerInput = { move: 1, jumpHeld: false };
const HILOS = LEVEL_1_1.hilos?.length ?? 0;
const OFRENDAS = LEVEL_1_1.ofrendas.length;
const header = (over: Partial<RecordHeader> = {}): RecordHeader => ({
  format: 1,
  sim: 'v1',
  level: '1-1',
  seed: 0,
  token: null,
  start: 'start',
  lives: 7,
  hilos: '0'.repeat(HILOS),
  abilities: {},
  resume: null,
  ...over,
});
const tenSteps = (over: Partial<RecordHeader> = {}): RunRecord => ({ header: header(over), entries: Array.from({ length: 10 }, () => ({ input: right })) });
const saved: Omit<SavedRun, 'level'> = { checkpoint: 0, lives: 5, livesIn: 6, used: ['ofrenda:1-1-1'], hilos: Array<boolean>(HILOS).fill(false), clock: 300 };
const resuming = (over: Partial<Omit<SavedRun, 'level'>>): Partial<RecordHeader> => ({ start: 'resume', resume: { ...saved, ...over } });
/** What `replayRecord` gives for a record of ten steps with this header, as written and read back (so `readRecord` accepted it). */
function replayed(over: Partial<RecordHeader>): ReturnType<typeof replayRecord> {
  const back = readRecord(writeRecord(tenSteps(over)), 10);
  expect(back, JSON.stringify(over)).not.toBeNull();
  return replayRecord(back!, 'v1');
}
/** 'replayed', or the refusal's reason. */
function outcome(over: Partial<RecordHeader>): string {
  const r = replayed(over);
  return 'error' in r ? r.error : 'replayed';
}

describe('GDD-TEC-09 replaying a record of a real level', () => {
  it('GDD-TEC-09 refuses another simulation version', () => {
    expect(replayRecord(tenSteps(), 'v2')).toStrictEqual({ error: 'version' });
  });

  it('GDD-TEC-09 refuses a level that is not registered', () => {
    expect(replayRecord(tenSteps({ level: '9-9' }), 'v1')).toStrictEqual({ error: 'level' });
  });

  it('GDD-TEC-09 replays its own version', () => {
    const own = replayRecord(tenSteps(), 'v1');
    let run = startRun(LEVEL_1_1);
    const hashes: string[] = [];
    for (let i = 0; i < 10; i++) {
      run = stepRun(run, right, LEVEL_1_1);
      hashes.push(stateHash(run));
    }
    expect('error' in own).toBe(false);
    expect(!('error' in own) && own.hashes).toStrictEqual(hashes);
  });

  it('GDD-TEC-09 refuses lives the level cannot start with', () => {
    for (const lives of [1, LIVES_MAX]) expect(outcome({ lives }), String(lives)).toBe('replayed');
    for (const lives of [0, LIVES_MAX + 1, 1.5]) expect(outcome({ lives }), String(lives)).toBe('header');
    // A restart and a resume are held to it too.
    expect(outcome({ start: 'restart', lives: 0 })).toBe('header');
    expect(outcome({ ...resuming({}), lives: 0 })).toBe('header');
  });

  it('GDD-TEC-09 refuses hilos that are not one a hilo of the level', () => {
    expect(HILOS).toBeGreaterThan(0);
    expect(outcome({ hilos: '1'.repeat(HILOS) })).toBe('replayed');
    expect(outcome({ hilos: '0'.repeat(HILOS - 1) })).toBe('header');
    expect(outcome({ hilos: '0'.repeat(HILOS + 1) })).toBe('header');
  });

  it('GDD-TEC-09 refuses a saved run that readSave would not read', () => {
    expect(outcome(resuming({}))).toBe('replayed');
    // The checkpoint: the first and the last ofrenda's index read, one before and one past do not.
    expect(outcome(resuming({ checkpoint: OFRENDAS - 1 }))).toBe('replayed');
    for (const checkpoint of [-1, OFRENDAS, 0.5]) expect(outcome(resuming({ checkpoint })), String(checkpoint)).toBe('header');
    // The lives and the lives the run started with, each 1 to LIVES_MAX.
    for (const field of ['lives', 'livesIn'] as const) {
      for (const n of [1, LIVES_MAX]) expect(outcome(resuming({ [field]: n })), `${field} ${n}`).toBe('replayed');
      for (const n of [0, LIVES_MAX + 1, 2.5]) expect(outcome(resuming({ [field]: n })), `${field} ${n}`).toBe('header');
    }
    // The clock, 0 or more, whole.
    expect(outcome(resuming({ clock: 0 }))).toBe('replayed');
    for (const clock of [-1, 0.5]) expect(outcome(resuming({ clock })), String(clock)).toBe('header');
    // Its hilos, one a hilo of the level.
    expect(outcome(resuming({ hilos: Array<boolean>(HILOS - 1).fill(false) }))).toBe('header');
    expect(outcome(resuming({ hilos: Array<boolean>(HILOS + 1).fill(false) }))).toBe('header');
    // A test level is never saved, so no run of it resumes; it starts as any level does.
    const sandbox = { level: 'sandbox', hilos: '0'.repeat(SANDBOX_LEVEL.hilos?.length ?? 0) };
    expect(outcome({ ...sandbox, ...resuming({ checkpoint: 0, hilos: Array<boolean>(sandbox.hilos.length).fill(false) }) })).toBe('header');
    expect(outcome(sandbox)).toBe('replayed');
  });

  it('GDD-TEC-09 checks the version, then the level, then the header', () => {
    expect(replayRecord(tenSteps({ level: '9-9' }), 'v2')).toStrictEqual({ error: 'version' });
    expect(replayRecord(tenSteps({ lives: 0 }), 'v2')).toStrictEqual({ error: 'version' });
    expect(replayRecord(tenSteps({ level: '9-9', lives: 0 }), 'v1')).toStrictEqual({ error: 'level' });
    expect(replayRecord(tenSteps({ lives: 0 }), 'v1')).toStrictEqual({ error: 'header' });
  });
});
