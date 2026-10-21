import { describe, expect, it } from 'vitest';
import { LIVES_MAX, RESPAWN, TILE } from '../config/tuning';
import { loseLife as loseLifeOnce } from './lives';
import { spawn, type PlayerInput } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { touchesTaco, type Taco } from './taco';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// Floor top at y = 64. A taco in tile column 3, row 3 (x 48 to 64, y 48 to 64, centred at 56, 56); a spike in column 8, row 3.
const world = parseTiles(['..........', '..........', '..........', '..........', '##########']);
const taco: Taco = { col: 3, row: 3 };
const level: Level = {
  world,
  spawn: { x: 24, y: 4 * TILE },
  ofrendas: [],
  spikes: [{ col: 8, row: 3 }],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [taco],
  pinatas: [], doors: [], keys: [],
};
const at = (x: number, y: number) => spawn(x, y);
const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};
/** Standing on the spike, with the given power. */
const onSpike = (power: RunState['power'], extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), power, player: at(136, 64), ...extra });

describe('GDD-PWR-02 the taco pickup', () => {
  it('is a 12 x 12 box in the middle of its tile, touched by the 12 x 14 body', () => {
    // Taco box x 50 to 62, y 50 to 62. Body box is x - 6 to x + 6, y - 14 to y.
    expect(touchesTaco(at(43.99, 56), taco)).toBe(false); // body right edge 49.99
    expect(touchesTaco(at(44.01, 56), taco)).toBe(true);
    expect(touchesTaco(at(67.99, 56), taco)).toBe(true);
    expect(touchesTaco(at(68.01, 56), taco)).toBe(false);
    expect(touchesTaco(at(56, 50), taco)).toBe(false); // feet at the taco's top edge: only touching
    expect(touchesTaco(at(56, 50.01), taco)).toBe(true);
    expect(touchesTaco(at(56, 75.99), taco)).toBe(true);
    expect(touchesTaco(at(56, 76), taco)).toBe(false); // body top at the taco's bottom edge
  });

  it('Poncho starts in Base with every taco waiting', () => {
    expect(startRun(level)).toMatchObject({ power: 'base', tacosTaken: [false] });
  });

  it('walking onto it in Base picks it up: Taco, and the taco is gone', () => {
    let r = startRun(level);
    for (let i = 0; i < 200 && r.power === 'base'; i++) r = stepRun(r, right, level);
    expect(r).toMatchObject({ power: 'taco', tacosTaken: [true], phase: 'playing' });
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('is not picked up again once taken, and standing in its place does nothing', () => {
    const r = run({ ...startRun(level), player: at(56, 64), power: 'base', tacosTaken: [true] }, idle, 5);
    expect(r).toMatchObject({ power: 'base', tacosTaken: [true] });
  });

  it('in Taco it stays where it is: not picked up, no change', () => {
    const r = run({ ...startRun(level), player: at(56, 64), power: 'taco' }, idle, 5);
    expect(r).toMatchObject({ power: 'taco', tacosTaken: [false] });
  });
});

describe('GDD-PWR-01 and GDD-CMB-03 a hit in Taco', () => {
  it('spends the taco instead of a life, with 2.0 s of invulnerability', () => {
    const r = stepRun(onSpike('taco'), idle, level);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', invulnerable: RESPAWN.invulnerableSteps });
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('pushes Poncho away from the spike at 80 px/s: right when he is right of its middle', () => {
    expect(stepRun(onSpike('taco', { player: at(140, 64) }), idle, level).player.vx).toBe(80);
  });

  it('pushes him left when he is left of its middle', () => {
    expect(stepRun(onSpike('taco', { player: at(132, 64) }), idle, level).player.vx).toBe(-80);
  });

  it('dead centre pushes him backwards, against the way he faces', () => {
    expect(stepRun(onSpike('taco', { player: { ...at(136, 64), facing: 1 } }), idle, level).player.vx).toBe(-80);
    expect(stepRun(onSpike('taco', { player: { ...at(136, 64), facing: -1 } }), idle, level).player.vx).toBe(80);
  });

  it('the push is applied to the next step, so he really moves', () => {
    const r = run(onSpike('taco', { player: at(140, 64) }), idle, 2);
    expect(r.player.x).toBeGreaterThan(140);
  });

  it('a second hit while invulnerable does nothing, then costs a life in Base once it ends', () => {
    const hit = stepRun(onSpike('taco', { player: at(136, 64) }), idle, level);
    const still: RunState = { ...hit, player: at(136, 64), invulnerable: 1 };
    const r = stepRun(still, idle, level);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', invulnerable: 0 });
    expect(stepRun(r, idle, level)).toMatchObject({ phase: 'respawning' });
  });

  it('in Base a hit still costs a life', () => {
    expect(stepRun(onSpike('base'), idle, level)).toMatchObject({ phase: 'respawning', power: 'base' });
  });

  it('an ofrenda touched in the same step as a Taco hit is still activated, since Poncho lives', () => {
    const both: Level = { ...level, ofrendas: [{ id: 'o', x: 136, y: 64 }] };
    const r = stepRun({ ...startRun(both), lives: loseLifeOnce(startRun(both).lives), power: 'taco', player: at(136, 64) }, idle, both);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', checkpointIndex: 0 });
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('a taco picked up in the same step as a hit is spent on it', () => {
    const both: Level = { ...level, spikes: [{ col: 3, row: 3 }] };
    const r = stepRun({ ...startRun(both), player: at(56, 64) }, idle, both);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', tacosTaken: [true], invulnerable: RESPAWN.invulnerableSteps });
  });
});

describe('GDD-PWR-01 losing a life brings Poncho back in Base', () => {
  it('into a pit: Base again and the taco is back', () => {
    const pit: Level = { ...level, world: parseTiles(['...', '...', '...']), spikes: [] };
    let r: RunState = { ...startRun(pit), power: 'taco', tacosTaken: [true], player: at(24, 200) };
    r = stepRun(r, idle, pit);
    expect(r).toMatchObject({ phase: 'respawning', power: 'base' }); // the HUD icon goes with the life
    for (let i = 0; i < RESPAWN.delaySteps; i++) r = stepRun(r, idle, pit);
    expect(r).toMatchObject({ phase: 'playing', power: 'base', tacosTaken: [false] });
  });

  it('after a hit in Base the taco that was taken comes back too', () => {
    let r = onSpike('base', { power: 'base', tacosTaken: [true] });
    r = run(r, idle, 1 + RESPAWN.delaySteps);
    expect(r).toMatchObject({ phase: 'playing', power: 'base', tacosTaken: [false] });
  });
});
