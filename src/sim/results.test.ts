import { describe, expect, it } from 'vitest';
import { MEDAL, RESULTS } from '../config/tuning';
import { loseLife, startWorld } from './lives';
import type { PlayerInput } from './movement';
import { clearTime, medal, medalLabel, medalLine, revealedLines } from './results';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };

// A flat level, 30 x 17 tiles, the floor's top at row 14 (y = 224), as in exit.test.ts.
const flat = parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('##############################')]);
const bare: Level = { world: flat, spawn: { x: 24, y: 224 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };
const base: Level = { ...bare, exit: { x: 200, y: 224 } };
/** A level with `n` hilos, placed away from the floor's start. */
const withHilos = (n: number): Level => ({ ...base, hilos: Array.from({ length: n }, (_, i) => ({ col: 2 + (i % 20), row: 8 + Math.floor(i / 20) })) });
/** A run with `taken` of the level's hilos collected and `lives` lives left. */
const runWith = (level: Level, taken: number, lives: number): RunState => {
  let lost = startWorld();
  for (let i = startWorld().lives; i > lives; i--) lost = loseLife(lost);
  const r = startRun(level);
  return { ...r, hilosTaken: r.hilosTaken.map((_, i) => i < taken), lives: lost };
};

describe('GDD-UI-02 clear time', () => {
  it('GDD-UI-02 clear time is minutes and whole seconds, rounded down', () => {
    expect(clearTime(0)).toBe('Time 0:00');
    expect(clearTime(59)).toBe('Time 0:00');
    expect(clearTime(60)).toBe('Time 0:01');
    expect(clearTime(7 * 60)).toBe('Time 0:07');
    expect(clearTime(134 * 60 + 59)).toBe('Time 2:14');
    expect(clearTime(725 * 60)).toBe('Time 12:05');
  });

  it('GDD-UI-02 clear time stops at 99:59', () => {
    expect(clearTime(5999 * 60)).toBe('Time 99:59');
    expect(clearTime(6000 * 60)).toBe('Time 99:59');
    expect(clearTime(10_000 * 60)).toBe('Time 99:59');
  });
});

/** Walks right from x 150 with 3 lives left (4 lost), to the exit, and returns the run there. */
const walk = (l: Level): RunState => {
  let r = startRun(l);
  for (let i = 0; i < 4; i++) r = { ...r, lives: loseLife(r.lives) };
  r = { ...r, player: { ...r.player, x: 150 } };
  for (let i = 0; i < 80 && r.phase === 'playing'; i++) r = stepRun(r, right, l);
  return r;
};

describe('GDD-PRG-03 medals', () => {
  it('GDD-PRG-03 bronze for a clear without every hilo', () => {
    const level = withHilos(50);
    expect(medal(runWith(level, 49, 7), level)).toBe('bronze');
    expect(medal(runWith(level, 0, 7), level)).toBe('bronze');
  });

  it('GDD-PRG-03 silver for every hilo with 3 lives', () => {
    const level = withHilos(50);
    expect(medal(runWith(level, 50, 3), level)).toBe('silver');
    expect(medal(runWith(level, 50, 1), level)).toBe('silver');
  });

  it('GDD-PRG-03 gold for every hilo and 4 lives', () => {
    const level = withHilos(50);
    expect(medal(runWith(level, 50, 4), level)).toBe('gold');
    expect(medal(runWith(level, 50, 7), level)).toBe('gold');
  });

  it('GDD-PRG-03 a level without hilos has them all', () => {
    expect(medal(runWith(base, 0, 7), base)).toBe('gold');
    expect(medal(runWith(base, 0, 3), base)).toBe('silver');
  });

  it('GDD-PRG-03 hilos kept through the restart after the last life count', () => {
    // A floor with a 3-tile pit, and a hilo at the spawn.
    const pitWorld = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
    const level: Level = { ...bare, world: pitWorld, spawn: { x: 24, y: 64 }, hilos: [{ col: 1, row: 3 }] };
    let r = stepRun(startRun(level), idle, level);
    expect(r.hilosTaken).toEqual([true]);
    // One life left; the pit takes it, the screen after the last life comes up and a press restarts the world.
    for (let i = 0; i < 6; i++) r = { ...r, lives: loseLife(r.lives) };
    for (let i = 0; i < 600 && r.phase !== 'gameover'; i++) r = stepRun(r, right, level);
    expect(r.phase).toBe('gameover');
    for (let i = 0; i < 60; i++) r = stepRun(r, idle, level);
    r = stepRun(r, jump, level);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(7);
    expect(r.hilosTaken).toEqual([true]);
    expect(medal(r, level)).toBe('gold');
  });

  it('GDD-PRG-03 a life restored by an ofrenda counts at the exit', () => {
    const level: Level = { ...base, hilos: [{ col: 10, row: 13 }], ofrendas: [{ id: 'a', x: 170, y: 224 }] };
    // 3 lives are left until the ofrenda gives one back: 4, which is gold.
    const withOfrenda = walk(level);
    expect(withOfrenda.phase).toBe('clear');
    expect(withOfrenda.hilosTaken).toEqual([true]);
    expect(withOfrenda.lives.lives).toBe(4);
    expect(medal(withOfrenda, level)).toBe('gold');
    // The same walk without the ofrenda ends with 3 lives: silver.
    const without = walk({ ...level, ofrendas: [] });
    expect(without.lives.lives).toBe(3);
    expect(medal(without, level)).toBe('silver');
  });

  it('GDD-PRG-03 medal labels', () => {
    expect(medalLabel('bronze')).toBe('Bronze medal');
    expect(medalLabel('silver')).toBe('Silver medal');
    expect(medalLabel('gold')).toBe('Gold medal');
  });
});

/** A run on the clear screen, `wait` steps into it. */
const onScreen = (wait: number, revealAll = false): RunState => ({ ...startRun(base), phase: 'clear', wait, revealAll });

describe('GDD-UI-02 reveal', () => {
  it('GDD-UI-02 the lines appear at 15, 30 and 45 steps', () => {
    const expected: [number, number][] = [[0, 0], [14, 0], [15, 1], [29, 1], [30, 2], [44, 2], [45, 3], [100, 3]];
    for (const [wait, lines] of expected) expect(revealedLines(onScreen(wait)), `wait ${wait}`).toBe(lines);
    expect(revealedLines(onScreen(1, true))).toBe(3);
  });

  it('GDD-UI-02 the medal line is centred with its disc', () => {
    // The disc is 10 across and 6 from the text: with a text 60 wide the pair is 76 wide, from 202 to 278.
    expect(medalLine(60)).toEqual({ discX: 207, textX: 218 });
    expect(medalLine(0)).toEqual({ discX: 237, textX: 248 });
  });
});

describe('GDD-UI-02 tuning derived from the GDD', () => {
  it('GDD-UI-02 the reveal steps are 0.25, 0.5 and 0.75 s', () => {
    expect([...RESULTS.revealSteps]).toEqual([15, 30, 45]);
  });

  it('GDD-PRG-03 gold needs 4 lives', () => {
    expect(MEDAL.goldLives).toBe(4);
  });
});
