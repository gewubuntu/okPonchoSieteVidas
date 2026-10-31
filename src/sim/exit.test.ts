import { describe, expect, it } from 'vitest';
import { SANDBOX_LEVEL } from '../levels/sandbox';
import type { Enemy } from './enemy';
import type { Item } from './item';
import type { PlayerInput } from './movement';
import { spawn } from './movement';
import { loseLife } from './lives';
import { revealedLines } from './results';
import { startRun, stepRun, touchesExit, type Level, type Point, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };

// A flat level, 30 x 17 tiles, the floor's top at row 14 (y = 224), no pits. The exit stands at x = 200, so its box is x 192 to 208
// and y 176 to 224 (16 x 48 px). Poncho's body box is 12 x 32, so they overlap while his middle is within 14 px of 200.
const flat = parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('##############################')]);
const exit: Point = { x: 200, y: 224 };
const bare: Level = { world: flat, spawn: { x: 24, y: 224 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };
const base: Level = { ...bare, exit };

const run = (r: RunState, input: PlayerInput, steps: number, level: Level = base): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};
/** A run with Poncho standing at x on the floor. */
const at = (level: Level, x: number, y = 224): RunState => ({ ...startRun(level), player: { ...spawn(x, y), grounded: y === 224 } });
/** The step he reaches the exit on: standing on its edge, 10 px short of its middle, with `input` down. */
const cleared = (input: PlayerInput, level: Level = base): RunState => {
  const r = stepRun(at(level, 190), input, level);
  expect(r.phase).toBe('clear');
  return r;
};

/** The lines the GDD shows after `wait` steps on the clear screen. */
const expectedLines = (wait: number) => (wait >= 45 ? 3 : wait >= 30 ? 2 : wait >= 15 ? 1 : 0);

const touches = (x: number, y: number) => touchesExit(spawn(x, y), exit);

describe('GDD-WLD-03 the level exit', () => {
  it('GDD-WLD-03 exit touch: the body box overlapping the 16 by 48 box', () => {
    expect(touches(200, 224)).toBe(true);
    // Half of 12 and 16 is 14: 13.9 away overlaps, 14 away only shares an edge.
    expect(touches(200 - 13.9, 224)).toBe(true);
    expect(touches(200 - 14, 224)).toBe(false);
    expect(touches(200 + 13.9, 224)).toBe(true);
    expect(touches(200 + 14, 224)).toBe(false);
    // The box's top is y = 176: feet just below it overlap, feet on it do not.
    expect(touches(200, 176.1)).toBe(true);
    expect(touches(200, 176)).toBe(false);
    // The box's bottom is y = 224: the head (32 above the feet) just above it overlaps, on it does not.
    expect(touches(200, 255.9)).toBe(true);
    expect(touches(200, 256)).toBe(false);
    // In the air.
    expect(touches(200, 200)).toBe(true);
  });

  it('GDD-WLD-03 walking into the exit clears the level', () => {
    let r = at(base, 150);
    let steps = 0;
    while (r.phase === 'playing' && steps < 60) {
      r = stepRun(r, right, base);
      steps++;
    }
    expect(r.phase).toBe('clear');
    expect(r.wait).toBe(0);
  });

  it('GDD-WLD-03 a hit in Base on the step he reaches the exit costs a life and does not clear', () => {
    const level: Level = { ...base, spikes: [{ col: 12, row: 13 }] };
    const r = stepRun(at(level, 200), idle, level);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(6);
  });

  it('GDD-WLD-03 a hit the taco absorbs on that step still clears', () => {
    const level: Level = { ...base, spikes: [{ col: 12, row: 13 }] };
    const r = stepRun({ ...at(level, 200), power: 'taco' }, idle, level);
    expect(r.phase).toBe('clear');
    expect(r.power).toBe('base');
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-WLD-03 a fall into a pit on that step does not clear', () => {
    // A pit one tile wide at column 12, and an exit low enough that the box still overlaps a body whose whole height is below the level (y > 304).
    const level: Level = { ...base, world: parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('############.#################')]), exit: { x: 200, y: 17 * 16 + 40 } };
    const r = stepRun({ ...startRun(level), player: { ...spawn(200, 304.5), grounded: false } }, idle, level);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(6);
  });

  it('GDD-WLD-03 a level with no exit never clears', () => {
    let r = startRun(SANDBOX_LEVEL);
    for (let i = 0; i < 600; i++) {
      r = stepRun(r, right, SANDBOX_LEVEL);
      expect(r.phase).not.toBe('clear');
    }
  });

  it('GDD-WLD-04 a hilo touched on the step he reaches the exit is collected', () => {
    const level: Level = { ...base, hilos: [{ col: 12, row: 13 }] };
    const r = stepRun(at(level, 195), idle, level);
    expect(r.phase).toBe('clear');
    expect(r.hilosTaken).toEqual([true]);
  });
});

describe('GDD-UI-02 the level clear screen', () => {
  it('GDD-UI-02 the clear screen stands still', () => {
    const alacran: Enemy = { x: 300, y: 224 };
    const taco: Item = { x: 100, y: 224, vx: 40, vy: 0, kind: 'taco' };
    const level: Level = { ...base, enemies: [alacran], platforms: [{ x0: 300, y0: 100, x1: 400, y1: 100, w: 48 }] };
    // Walking right into the exit, so he has speed on the step he clears.
    let before = at(level, 150);
    while (before.phase === 'playing') before = stepRun(before, right, level);
    before = { ...before, items: [taco] };
    const start = before;
    const after = run(before, idle, 100, level);
    expect(after.phase).toBe('clear');
    expect(after.wait).toBe(100);
    expect({ ...after, wait: 0, buttonsHeld: start.buttonsHeld }).toEqual(start);
    // The enemy was walking, so the comparison above could fail.
    expect(run(startRun(level), idle, 100, level).enemies[0]!.x).not.toBe(startRun(level).enemies[0]!.x);
  });

  it('GDD-UI-02 the clear screen ignores presses in its first 1.0 s', () => {
    // The screen's first step is the one after it comes up; a press on step 2 or step 60 is ignored, one on step 61 is taken.
    expect(stepRun(run(cleared(idle), idle, 1), jump, base).phase).toBe('clear');
    expect(stepRun(run(cleared(idle), idle, 59), jump, base).phase).toBe('clear');
    expect(stepRun(run(cleared(idle), idle, 60), jump, base).phase).toBe('done');
  });

  it('GDD-UI-02 a button held since before the clear screen does not end it', () => {
    const r = run(cleared(jump), jump, 200);
    expect(r.phase).toBe('clear');
    const again = stepRun(run(r, idle, 1), jump, base);
    expect(again.phase).toBe('done');
  });

  it('GDD-UI-02 a second button pressed while holding one ends it', () => {
    const r = run(cleared(right), right, 60);
    expect(r.phase).toBe('clear');
    expect(stepRun(r, { move: 1, jumpHeld: false, claw: true }, base).phase).toBe('done');
  });

  it('GDD-UI-02 each of claw, Fuego, left and right ends it', () => {
    const presses: PlayerInput[] = [jump, { move: 0, jumpHeld: false, claw: true }, { move: 0, jumpHeld: false, fuego: true }, { move: -1, jumpHeld: false }, right];
    for (const press of presses) expect(stepRun(run(cleared(idle), idle, 60), press, base).phase, JSON.stringify(press)).toBe('done');
    // Left pressed while right is held, given raw: the two cancel out in `move` (L-019).
    const rightOnly: PlayerInput = { move: 1, jumpHeld: false, left: false, right: true };
    const both: PlayerInput = { move: 0, jumpHeld: false, left: true, right: true };
    const held = run(cleared(rightOnly), rightOnly, 60);
    expect(held.phase).toBe('clear');
    expect(stepRun(held, both, base).phase).toBe('done');
  });

  it('GDD-UI-02 the clock counts every step in play, the exit step included', () => {
    // Cleared on the 1st step.
    expect(stepRun(at(base, 190), right, base).clock).toBe(1);
    // A walk from x 150 into the exit: the clock is the number of steps taken, the one that reaches the exit among them.
    let r = at(base, 150);
    let steps = 0;
    while (r.phase === 'playing' && steps < 60) {
      r = stepRun(r, right, base);
      steps++;
      expect(r.clock).toBe(steps);
    }
    expect(r.phase).toBe('clear');
    expect(steps).toBeGreaterThan(10);
  });

  it('GDD-UI-02 the clock stands still on the clear screen', () => {
    const r = cleared(idle);
    expect(r.clock).toBe(1);
    const later = run(r, idle, 100);
    expect(later.phase).toBe('clear');
    expect(later.clock).toBe(1);
    // The press that leaves counts nothing either, nor do the steps after it.
    const done = stepRun(run(r, idle, 60), jump, base);
    expect(done.phase).toBe('done');
    expect(done.clock).toBe(1);
    expect(run(done, idle, 50).clock).toBe(1);
  });

  it('GDD-UI-02 the respawn wait counts', () => {
    // One step of a wait that began at clock 10.
    const waiting: RunState = { ...at(base, 24), phase: 'respawning', wait: 48, clock: 10 };
    expect(stepRun(waiting, idle, base).clock).toBe(11);
    // The whole wait is 48 steps, the one that brings Poncho back included.
    let r = waiting;
    let steps = 0;
    while (r.phase === 'respawning' && steps < 100) {
      r = stepRun(r, idle, base);
      steps++;
    }
    expect(r.phase).toBe('playing');
    expect(steps).toBe(48);
    expect(r.clock).toBe(58);
    // From a pit: every step to the fall and every step of the wait.
    const pit: Level = { ...bare, world: parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('####...#######################')]) };
    let p = at(pit, 40);
    let taken = 0;
    while (p.phase === 'playing' && taken < 400) {
      p = stepRun(p, right, pit);
      taken++;
    }
    expect(p.phase).toBe('respawning');
    expect(p.clock).toBe(taken);
    p = run(p, idle, 48, pit);
    expect(p.phase).toBe('playing');
    expect(p.clock).toBe(taken + 48);
  });

  it('GDD-UI-02 the restart after the last life starts the clock again', () => {
    let lost = startRun(base);
    for (let i = 0; i < 7; i++) lost = { ...lost, lives: loseLife(lost.lives) };
    const screen: RunState = { ...lost, phase: 'gameover', wait: 0, clock: 500 };
    // The screen counts nothing.
    expect(run(screen, idle, 59).clock).toBe(500);
    const restarted = stepRun(run(screen, idle, 60), jump, base);
    expect(restarted).toMatchObject({ phase: 'respawning', restarting: true, clock: 0 });
    // Then the flip counts from 0.
    expect(stepRun(restarted, idle, base).clock).toBe(1);
  });

  it('GDD-UI-02 a new press before the medal line shows every line', () => {
    const r = stepRun(run(cleared(idle), idle, 2), jump, base);
    expect(r).toMatchObject({ phase: 'clear', revealAll: true, wait: 3 });
    expect(revealedLines(r)).toBe(3);
    // It stays shown on the steps after, and it did not leave the screen.
    const next = stepRun(r, idle, base);
    expect(next).toMatchObject({ phase: 'clear', revealAll: true });
    expect(revealedLines(next)).toBe(3);
    // The prompt still waits for 1.0 s: a fresh press (released first, L-048) on the 59th step does nothing, one on the 61st leaves.
    const at58 = run(next, idle, 58 - next.wait);
    expect(at58.wait).toBe(58);
    const pressed = stepRun(at58, jump, base);
    expect(pressed.phase).toBe('clear');
    const released = stepRun(pressed, idle, base);
    expect(released.wait).toBe(60);
    expect(released.phase).toBe('clear');
    expect(stepRun(released, jump, base).phase).toBe('done');
  });

  it('GDD-UI-02 each of jump, claw, Fuego, left and right skips the reveal', () => {
    const presses: PlayerInput[] = [jump, { move: 0, jumpHeld: false, claw: true }, { move: 0, jumpHeld: false, fuego: true }, { move: -1, jumpHeld: false }, right];
    for (const press of presses) {
      const r = stepRun(run(cleared(idle), idle, 2), press, base);
      expect(r.revealAll, JSON.stringify(press)).toBe(true);
      expect(r.phase).toBe('clear');
    }
    // Left pressed while right is held, given raw: the two cancel out in `move` (L-019).
    const rightOnly: PlayerInput = { move: 1, jumpHeld: false, left: false, right: true };
    const both: PlayerInput = { move: 0, jumpHeld: false, left: true, right: true };
    const held = run(cleared(rightOnly), rightOnly, 2);
    expect(held.revealAll).toBe(false);
    expect(stepRun(held, both, base).revealAll).toBe(true);
  });

  it('GDD-UI-02 a button held as Poncho reaches the exit does not skip the reveal', () => {
    // Walking into the exit with right held, and keeping it held.
    let walked = at(base, 150);
    while (walked.phase === 'playing') walked = stepRun(walked, right, base);
    // And clearing with jump held.
    for (const [start, input] of [[walked, right], [cleared(jump), jump]] as const) {
      let r = start;
      for (let i = 0; i < 50; i++) {
        r = stepRun(r, input, base);
        expect(r.revealAll).toBe(false);
        expect(revealedLines(r), `wait ${r.wait}`).toBe(expectedLines(r.wait));
      }
    }
  });

  it('GDD-UI-02 a skip press held past 1.0 s does not end the screen', () => {
    let r = run(cleared(idle), idle, 2);
    r = run(r, jump, 100 - 2);
    expect(r).toMatchObject({ phase: 'clear', revealAll: true, wait: 100 });
    // One step released, then a fresh press: it leaves.
    expect(stepRun(stepRun(r, idle, base), jump, base).phase).toBe('done');
  });

  it('GDD-UI-02 done stays done', () => {
    const done = stepRun(run(cleared(idle), idle, 60), jump, base);
    expect(done.phase).toBe('done');
    for (const input of [idle, jump, right]) expect(stepRun(done, input, base)).toBe(done);
  });
});
