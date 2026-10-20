import { describe, expect, it } from 'vitest';
import { HITBOX, LIVES_MAX, RESPAWN, TILE } from '../config/tuning';
import { loseLife } from './lives';
import { spawn, type PlayerInput } from './movement';
import { isInPit, startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// Floor on the left (x < 80), a 3-tile pit (x 80 to 128), floor again on the right. Floor top is y = 64.
const world = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
const level: Level = { world, spawn: { x: 24, y: 4 * TILE } };

const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};

/** Plays on until Poncho has fallen into the pit and the run is respawning. */
const fallIn = (r: RunState = startRun(level)): RunState => {
  for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, level);
  return r;
};

describe('GDD-LIFE-02 falling into a pit', () => {
  it('starts with seven lives, playing, at the spawn point', () => {
    const r = startRun(level);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: 0 });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.player).toMatchObject({ x: 24, y: 64 });
  });

  it('is in the pit only once the whole body is below the bottom of the level', () => {
    const bottom = world.height * TILE;
    expect(isInPit({ ...spawn(10, bottom + HITBOX.height) }, world)).toBe(false);
    expect(isInPit({ ...spawn(10, bottom + HITBOX.height + 0.01) }, world)).toBe(true);
  });

  it('walking off the ledge into the pit costs exactly one life', () => {
    const r = fallIn();
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.wait).toBe(RESPAWN.delaySteps);
  });

  it('does not cost a life to run and jump on solid ground', () => {
    let r = startRun(level);
    for (let i = 0; i < 40; i++) r = stepRun(r, { move: 1, jumpHeld: i < 20 }, level);
    expect(r.phase).toBe('playing');
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('a running jump across the pit lands on the far side without losing a life', () => {
    let crossed = false;
    for (let runSteps = 0; runSteps < 50 && !crossed; runSteps++) {
      let r = startRun(level);
      for (let i = 0; i < 140; i++) r = stepRun(r, { move: 1, jumpHeld: i >= runSteps && i < runSteps + 40 }, level);
      crossed = r.phase === 'playing' && r.lives.lives === LIVES_MAX && r.player.x > 128;
    }
    expect(crossed).toBe(true);
  });
});

describe('GDD-LIFE-02 respawning', () => {
  it('waits 0.8 s, then respawns at the start with invulnerability and the same lives', () => {
    const fallen = fallIn();
    const r = run(fallen, idle, RESPAWN.delaySteps);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: RESPAWN.invulnerableSteps });
    expect(r.player).toMatchObject({ x: 24, y: 64, grounded: true });
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
  });

  it('is still waiting one step before the delay ends', () => {
    expect(run(fallIn(), idle, RESPAWN.delaySteps - 1).phase).toBe('respawning');
  });

  it('ignores input for the first 0.3 s, then any input skips the wait', () => {
    const fallen = fallIn();
    expect(run(fallen, right, RESPAWN.skipAfterSteps - 1).phase).toBe('respawning');
    const afterSkipWindow = run(fallen, idle, RESPAWN.skipAfterSteps);
    expect(stepRun(afterSkipWindow, right, level).phase).toBe('playing');
    expect(stepRun(afterSkipWindow, { move: 0, jumpHeld: true }, level).phase).toBe('playing');
    expect(stepRun(afterSkipWindow, idle, level).phase).toBe('respawning');
  });

  it('does not jump on respawn when the jump button is still held', () => {
    const r = run(fallIn(), { move: 0, jumpHeld: true }, RESPAWN.delaySteps + 5);
    expect(r.phase).toBe('playing');
    expect(r.player.grounded).toBe(true);
  });

  it('counts the invulnerability down to zero after 2.0 s', () => {
    const r = run(fallIn(), idle, RESPAWN.delaySteps);
    expect(run(r, idle, RESPAWN.invulnerableSteps - 1).invulnerable).toBe(1);
    expect(run(r, idle, RESPAWN.invulnerableSteps).invulnerable).toBe(0);
  });

  it('invulnerability does not protect from a pit (GDD-CMB-03)', () => {
    let r = run(fallIn(), idle, RESPAWN.delaySteps);
    expect(r.invulnerable).toBeGreaterThan(0);
    const livesBefore = r.lives.lives;
    r = fallIn(r);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(livesBefore - 1);
  });
});

describe('GDD-LIFE-05 out of lives', () => {
  it('losing the last life restarts the world with all seven lives', () => {
    let r = startRun(level);
    for (let i = 0; i < LIVES_MAX - 1; i++) r = { ...r, lives: loseLife(r.lives) };
    expect(r.lives.lives).toBe(1);
    const fallen = fallIn(r);
    expect(fallen.lives.lives).toBe(0);
    const back = run(fallen, idle, RESPAWN.delaySteps);
    expect(back.lives.lives).toBe(LIVES_MAX);
    expect(back.phase).toBe('playing');
  });
});
