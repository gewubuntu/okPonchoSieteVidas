import { describe, expect, it } from 'vitest';
import { LIVES_MAX, RESPAWN, TILE } from '../config/tuning';
import { hurtbox, touchesSpike, type Spike } from './hazards';
import { loseLife } from './lives';
import { spawn, type PlayerInput } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// Floor top at y = 64. One spike in tile column 5, row 3: its hurting lower half covers x 80 to 96 and y 56 to 64.
const world = parseTiles(['..........', '..........', '..........', '..........', '##########']);
const spike: Spike = { col: 5, row: 3 };
const level: Level = { world, spawn: { x: 24, y: 4 * TILE }, ofrendas: [], spikes: [spike, { col: 6, row: 3 }], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };
const at = (x: number, y: number) => spawn(x, y);

describe('GDD-WLD-05 and GDD-MOV-06 spike hit box', () => {
  it('Poncho is hurt through a 10 x 12 box centred in his 12 x 14 body', () => {
    expect(hurtbox(at(40, 64))).toEqual({ x: 35, y: 51, w: 10, h: 12 }); // 1 px in from each side, 1 px above the feet
  });

  it('a spike hurts across its whole tile width, 8 px up from the floor', () => {
    expect(touchesSpike(at(88, 64), spike)).toBe(true); // standing on it
    expect(touchesSpike(at(75.01, 64), spike)).toBe(true); // hurtbox right edge 0.01 px inside the tile
    expect(touchesSpike(at(75, 64), spike)).toBe(false); // only touching the edge
    expect(touchesSpike(at(100.99, 64), spike)).toBe(true);
    expect(touchesSpike(at(101, 64), spike)).toBe(false);
  });

  it('a near miss is safe: the body box overlaps the spike but the hurtbox does not', () => {
    const near = at(74.5, 64); // body right edge at 80.5, hurtbox right edge at 79.5
    expect(near.x + 6).toBeGreaterThan(spike.col * TILE);
    expect(touchesSpike(near, spike)).toBe(false);
  });

  it('feet 7 px up clear a spike by the hurtbox: the lower half of the tile is the only part that hurts', () => {
    expect(touchesSpike(at(88, 57), spike)).toBe(false); // hurtbox bottom (y - 1) = 56 is the spike top
    expect(touchesSpike(at(88, 57.01), spike)).toBe(true);
  });

  it('does not hurt from below the spike tile', () => {
    expect(touchesSpike(at(88, 76.99), spike)).toBe(true);
    expect(touchesSpike(at(88, 77), spike)).toBe(false); // hurtbox top (y - 13) = 64 is the spike bottom
  });
});

const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};

describe('GDD-LIFE-02 touching a spike', () => {
  it('costs one life and starts the wait, like a pit', () => {
    let r = startRun(level);
    for (let i = 0; i < 200 && r.phase === 'playing'; i++) r = stepRun(r, right, level);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.wait).toBe(RESPAWN.delaySteps);
  });

  it('respawns at the level start with 2.0 s of invulnerability (GDD-CMB-03)', () => {
    let r = startRun(level);
    for (let i = 0; i < 200 && r.phase === 'playing'; i++) r = stepRun(r, right, level);
    r = run(r, idle, RESPAWN.delaySteps);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: RESPAWN.invulnerableSteps });
    expect(r.player.x).toBe(24);
  });

  it('does not hurt while invulnerable, and hurts the step after it ends if Poncho is still on it', () => {
    const base = startRun(level);
    const on: RunState = { ...base, player: at(88, 64), invulnerable: 2 };
    const r = run(on, idle, 2);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: 0 });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(stepRun(r, idle, level)).toMatchObject({ phase: 'respawning' });
  });

  it('on the last life it restarts the world with all seven lives', () => {
    let lives = startRun(level).lives;
    for (let i = 0; i < LIVES_MAX - 1; i++) lives = loseLife(lives);
    let r: RunState = { ...startRun(level), lives, player: at(88, 64) };
    r = stepRun(r, idle, level);
    expect(r.lives.lives).toBe(0);
    r = run(r, idle, RESPAWN.delaySteps);
    expect(r).toMatchObject({ phase: 'playing' });
    expect(r.lives.lives).toBe(LIVES_MAX);
  });
});

/** Runs right for `runSteps`, then holds jump while still running right: did Poncho get past both spikes without losing a life? */
const clears = (runSteps: number): boolean => {
  let r = startRun(level);
  for (let i = 0; i < runSteps + 90; i++) {
    r = stepRun(r, { move: 1, jumpHeld: i >= runSteps }, level);
    if (r.phase === 'respawning') return false;
  }
  return r.player.x > 7 * TILE + 6; // past both spikes, which end at x = 112
};

describe('GDD-WLD-05 jumping over spikes', () => {
  it('a running jump clears both spikes without losing a life', () => {
    expect(Array.from({ length: 40 }, (_, i) => i).some(clears)).toBe(true);
  });
});
