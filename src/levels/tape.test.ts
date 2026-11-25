import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';
import { startRun, type Level, type RunState, type stepRun } from '../sim/run';
import { stateHash } from '../sim/stateHash';
import { jumpAt, runBot, runUntil } from './bots';
import { withUnlocks } from './index';
import { LEVEL_0_1 } from './level0-1';
import { expectReplay, headerFor, tapeOf } from './tape';

const L = LEVEL_0_1;
const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

/** `bot` of `level0-1.test.ts` (copied: that file keeps it inside its own scope), stepping through `step`. */
function bot(level: Level, maxSteps: number, step: typeof stepRun): RunState {
  const world = L.world;
  let run = startRun(level);
  let hold = 0;
  let steps = 0;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const { x, y, grounded } = run.player;
    if (run.phase === 'playing' && grounded && hold === 0) {
      const front = x + 6;
      const feetRow = Math.floor((y - 1) / TILE);
      let jump = false;
      for (let d = 0; d <= 14; d++) if (world.solidTile(Math.floor((front + d) / TILE), feetRow)) jump = true;
      for (let d = 0; d <= 10; d++) {
        const col = Math.floor((front + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < world.height && !world.solidTile(col, feetRow + 1 + empty)) empty++;
        if (empty >= 3) jump = true;
      }
      for (const s of level.spikes) if (s.row === feetRow && s.col * TILE - x >= 0 && s.col * TILE - x <= 26) jump = true;
      level.enemies.forEach((e, i) => {
        if (run.enemies[i]!.alive && Math.abs(e.y - y) < 4 && run.enemies[i]!.x - x >= 0 && run.enemies[i]!.x - x <= 40) jump = true;
      });
      if (jump) hold = 20;
    }
    const input: PlayerInput = { move: 1, jumpHeld: hold > 0 };
    if (hold > 0) hold--;
    run = step(run, input, level);
    steps++;
  }
  return run;
}

describe('GDD-TEC-09 the tape', () => {
  it("GDD-TEC-09 the tape keeps every step's input and the hash of its result, and replays to the same hashes", () => {
    const tape = tapeOf();
    const taped = tape.record(() => {
      let run = startRun(L);
      for (let i = 0; i < 30; i++) run = tape.step(run, right, L);
    });
    expect(taped.inputs).toHaveLength(30);
    expect(taped.hashes).toHaveLength(30);
    expect(taped.hashes[29]).toBe(stateHash(taped.end));
    expect(taped.level).toBe(L);
    const replayed = expectReplay(taped, headerFor('0-1', L), L);
    expect(replayed.firstDiff).toBe(-1);
    expect(replayed.steps).toBe(30);
  });

  it('GDD-TEC-09 the tape refuses a step off its chain', () => {
    const tape = tapeOf();
    const fork = () =>
      tape.record(() => {
        tape.step(startRun(L), idle, L);
        tape.step(startRun(L), idle, L);
      });
    expect(fork).toThrow('the tape saw a step off its chain');
    const other = () =>
      tape.record(() => {
        const s1 = tape.step(startRun(L), idle, L);
        tape.step(s1, idle, { ...L });
      });
    expect(other).toThrow('the tape saw a step off its chain');
    // The same chain on the same level is fine.
    expect(() =>
      tape.record(() => {
        const s1 = tape.step(startRun(L), idle, L);
        tape.step(s1, idle, L);
      }),
    ).not.toThrow();
  });

  it("GDD-TEC-09 the tape freezes a step's arguments", () => {
    const writesRun = tapeOf((run: RunState) => {
      (run as { clock: number }).clock = 1;
      return run;
    });
    expect(() => writesRun.record(() => void writesRun.step(startRun(L), idle, L))).toThrow(TypeError);
    const writesInput = tapeOf((run: RunState, input: PlayerInput) => {
      (input as { move: number }).move = 0;
      return run;
    });
    expect(() => writesInput.record(() => void writesInput.step(startRun(L), { move: 1, jumpHeld: false }, L))).toThrow(TypeError);
    // Idle, nothing is frozen.
    expect(() => writesInput.step(startRun(L), { move: 1, jumpHeld: false }, L)).not.toThrow();
  });

  it('GDD-TEC-09 the tape is off after a record, also one that throws', () => {
    const tape = tapeOf();
    expect(() =>
      tape.record(() => {
        tape.step(startRun(L), idle, L);
        throw new Error('x');
      }),
    ).toThrow('x');
    const from = startRun(L);
    expect(() => {
      tape.step(from, idle, L);
      tape.step(from, idle, L);
    }).not.toThrow();
    const taped = tape.record(() => void tape.step(startRun(L), idle, L));
    expect(taped.inputs).toHaveLength(1);
    expect(taped.hashes).toHaveLength(1);
  });

  it('GDD-TEC-09 a record with no step is refused', () => {
    expect(() => tapeOf().record(() => {})).toThrow('nothing stepped');
  });

  it('GDD-TEC-09 a run that does not start as its header says is refused', () => {
    const tape = tapeOf();
    const header = headerFor('0-1', L);
    const handMade = tape.record(() => void tape.step({ ...startRun(L), clock: 5 }, idle, L));
    expect(() => expectReplay(handMade, header, L)).toThrow('the run does not start as its header says');
    const sixLives = tape.record(() => void tape.step(startRun(L, undefined, 6), idle, L));
    expect(() => expectReplay(sixLives, { ...header, lives: 7 }, L)).toThrow('the run does not start as its header says');
    const plain = tape.record(() => void tape.step(startRun(L), idle, L));
    expect(expectReplay(plain, header, L).firstDiff).toBe(-1);
  });

  it('GDD-TEC-09 a replay that differs is found at its first differing step', () => {
    const tape = tapeOf();
    const glided = withUnlocks(L, { glide: true });
    const taped = tape.record(() => void bot(glided, 900, tape.step));
    expect(taped.inputs).toHaveLength(688);
    // Measured 2026-11-24: without the glide the replay's hashes first differ at the 41st step.
    expect(expectReplay(taped, headerFor('0-1', L, {}), L).firstDiff).toBe(40);
    expect(expectReplay(taped, headerFor('0-1', L, { glide: true }), L).firstDiff).toBe(-1);
  });

  it('GDD-TEC-09 the tape keeps the step of the first clear', () => {
    // A stepper that reaches the clear on its third call and steps on in it: the clear is the third step, not the first or the last.
    let calls = 0;
    const clears = tapeOf((run) => ({ ...run, phase: ++calls >= 3 ? 'clear' : 'playing' }));
    const taped = clears.record(() => {
      let run = startRun(L);
      for (let i = 0; i < 5; i++) run = clears.step(run, idle, L);
    });
    expect(taped.clearAt).toBe(3);
    const never = tapeOf((run) => ({ ...run }));
    expect(never.record(() => void never.step(startRun(L), idle, L)).clearAt).toBeNull();
  });

  it('GDD-TEC-09 a replay of another length than its tape differs where the shorter ends', () => {
    const tape = tapeOf();
    const taped = tape.record(() => {
      let run = startRun(L);
      for (let i = 0; i < 60; i++) run = tape.step(run, right, L);
    });
    const header = headerFor('0-1', L);
    expect(expectReplay({ ...taped, hashes: taped.hashes.slice(0, 20) }, header, L).firstDiff).toBe(20);
    expect(expectReplay({ ...taped, hashes: [...taped.hashes, 'extra'] }, header, L).firstDiff).toBe(60);
    // A difference before the end of the shorter one is found where it is.
    const bad = taped.hashes.map((h, i) => (i === 7 ? 'wrong' : h)).slice(0, 30);
    expect(expectReplay({ ...taped, hashes: bad }, header, L).firstDiff).toBe(7);
  });

  it('GDD-TEC-09 runBot keeps one input per state', () => {
    // Over the two walls and the two gaps of 0-1 and into the Alacrán at column 32 (GDD-WLD-06): a life lost on step 247, then the respawn wait.
    const from = startRun(L);
    const tasks = [jumpAt(100, 'top'), jumpAt(160, 'top'), jumpAt(236, 'top'), jumpAt(296, 'top'), jumpAt(410, 'top'), runUntil(1, (r) => r.player.x > 900)];
    const b = runBot(tasks, from, L, 330);
    expect(b.lost.length).toBeGreaterThanOrEqual(1);
    expect(b.inputs).toHaveLength(b.states.length);
    const waiting = b.states.map((_, i) => (i === 0 ? from : b.states[i - 1]!)).map((r) => r.phase !== 'playing');
    expect(waiting.filter(Boolean).length).toBeGreaterThan(0);
    b.inputs.forEach((input, i) => {
      if (waiting[i]) expect(input, `step ${i}`).toEqual(idle);
    });
    expect(b.inputs.some((input) => input.move === 1)).toBe(true);
    const replayed = expectReplay({ start: from, inputs: b.inputs, hashes: b.states.map(stateHash) }, headerFor('0-1', L), L);
    expect(replayed.firstDiff).toBe(-1);
    expect(replayed.steps).toBe(b.states.length);
  });
});
