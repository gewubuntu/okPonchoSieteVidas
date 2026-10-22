import { describe, expect, it } from 'vitest';
import { LIVES_MAX, TILE } from '../config/tuning';
import { freshEnemies, type Enemy } from './enemy';
import { loseLife } from './lives';
import type { PlayerInput } from './movement';
import { startRun, stepRun, type Level, type Ofrenda, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };

// Floor on the left (x < 80), a 3-tile pit (x 80 to 128), floor again on the right. Floor top is y = 64. An ofrenda at x = 56
// and an Alacrán on the right-hand floor.
const world = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
const ofrenda: Ofrenda = { id: 'o', x: 56, y: 4 * TILE };
const alacran: Enemy = { x: 180, y: 4 * TILE };
const level: Level = { world, spawn: { x: 24, y: 4 * TILE }, ofrendas: [ofrenda], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [alacran] };

const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};

/** One life left, the ofrenda used (it is the checkpoint), then a walk into the pit: the last life is lost. */
function lastLifeLost(): RunState {
  let r = run(startRun(level), right, 20); // past the ofrenda at x = 56
  expect(r.checkpoint).toEqual({ x: 56, y: 64 });
  for (let i = 0; i < LIVES_MAX - 1; i++) r = { ...r, lives: loseLife(r.lives) };
  for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, level);
  expect(r).toMatchObject({ phase: 'respawning' });
  expect(r.lives.lives).toBe(0);
  return r;
}

/** The step the screen appears on: after the usual 0.8 s wait (48 steps) for a lost life. */
const onScreen = (): RunState => run(lastLifeLost(), idle, 48);
/** The first press the screen takes, on its 61st step. */
const pressed = (): RunState => stepRun(run(onScreen(), idle, 60), jump, level);

describe('GDD-LIFE-05 the Siete vidas gastadas screen', () => {
  it('appears when the wait after the last life ends, instead of a respawn', () => {
    const r = lastLifeLost();
    expect(run(r, idle, 47).phase).toBe('respawning');
    const screen = run(r, idle, 48);
    expect(screen.phase).toBe('gameover');
    expect(screen.lives.lives).toBe(0);
  });

  it('a skip of the wait (any input after 0.3 s) brings it up sooner, as it would a respawn', () => {
    const r = run(lastLifeLost(), idle, 17);
    expect(stepRun(r, right, level).phase).toBe('gameover');
  });

  it('stays up for as long as nothing is pressed', () => {
    expect(run(onScreen(), idle, 600).phase).toBe('gameover');
  });

  it('any button ends it: jump, claw, Fuego, left or right', () => {
    for (const input of [jump, right, { move: -1, jumpHeld: false }, { move: 0, jumpHeld: false, claw: true }, { move: 0, jumpHeld: false, fuego: true }] as PlayerInput[]) {
      expect(stepRun(run(onScreen(), idle, 60), input, level).phase, JSON.stringify(input)).toBe('respawning');
    }
  });

  it('a button held since before it appeared does not count: it takes a new press', () => {
    for (const held of [jump, right, { move: 0, jumpHeld: false, claw: true }] as PlayerInput[]) {
      let r = run(lastLifeLost(), idle, 47);
      r = run(r, held, 300); // pressed on the last wait step and held throughout
      expect(r.phase, JSON.stringify(held)).toBe('gameover');
      r = run(r, idle, 1);
      expect(stepRun(r, held, level).phase, JSON.stringify(held)).toBe('respawning'); // released and pressed again
    }
  });

  it('holding right and pressing left counts as a press, though the two cancel out in move; releasing left again does not', () => {
    const both: PlayerInput = { move: 0, jumpHeld: false, left: true, right: true };
    const rightOnly: PlayerInput = { move: 1, jumpHeld: false, left: false, right: true };
    let r = run(lastLifeLost(), rightOnly, 47 + 70); // held into the pit, through the wait and past the lockout
    expect(r.phase).toBe('gameover');
    expect(stepRun(r, both, level).phase).toBe('respawning');
    // A player who pressed and held left during the first second, then let go of it after: the release is no press.
    r = run(run(lastLifeLost(), rightOnly, 47), both, 70);
    expect(r.phase).toBe('gameover');
    expect(stepRun(r, rightOnly, level).phase).toBe('gameover');
  });

  it('holding one button and pressing another counts as a press', () => {
    let r = run(lastLifeLost(), idle, 47);
    r = run(r, right, 300);
    expect(stepRun(r, { move: 1, jumpHeld: true }, level).phase).toBe('respawning');
  });

  it('ignores a press in its first 1.0 s (60 steps) and takes one after', () => {
    // The screen's first step is the one after it appears; a press on step 60 is ignored, one on step 61 is taken.
    expect(stepRun(run(onScreen(), idle, 59), jump, level).phase).toBe('gameover');
    expect(stepRun(run(onScreen(), idle, 60), jump, level).phase).toBe('respawning');
  });

  it('a press that was ignored must be released before the next one counts', () => {
    let r = run(onScreen(), jump, 60); // pressed in the first second and held on
    r = run(r, jump, 30);
    expect(r.phase).toBe('gameover');
  });
});

describe('GDD-LIFE-05 the restart after the screen', () => {
  it('refills all seven lives and forgets the used ofrendas, at the press', () => {
    const r = pressed();
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.lives.used.size).toBe(0);
    expect(r.checkpoint).toEqual(level.spawn);
    expect(r.checkpointIndex).toBe(-1);
  });

  it('then plays the respawn flip (0.35 s, 21 steps) and Poncho lands at the level start', () => {
    const r = pressed();
    expect(r.wait).toBe(21);
    expect(run(r, idle, 20).phase).toBe('respawning');
    const back = run(r, idle, 21);
    expect(back.phase).toBe('playing');
    expect(back.player).toMatchObject({ x: 24, y: 64 });
  });

  it('the flip cannot be skipped: the jump that ended the screen is still held, and moving does not cut it short', () => {
    expect(run(pressed(), jump, 20).phase).toBe('respawning');
    expect(run(pressed(), right, 20).phase).toBe('respawning');
  });

  it('the jump still held when control returns does not make Poncho jump', () => {
    const back = run(pressed(), jump, 22);
    expect(back.phase).toBe('playing');
    expect(back.player.vy).toBe(0);
  });

  it('everything else is back as at the level start: enemies alive at their start, Base, invulnerable for 2.0 s', () => {
    let r = run(onScreen(), idle, 60);
    r = { ...r, enemies: [{ ...r.enemies[0]!, alive: false }] };
    const back = run(stepRun(r, jump, level), idle, 21);
    expect(back.enemies).toEqual(freshEnemies([alacran]));
    expect(back.power).toBe('base');
    expect(back.invulnerable).toBe(120);
  });

  it('a normal lost life still respawns with no screen', () => {
    let r = startRun(level);
    for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, level);
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(run(r, idle, 48).phase).toBe('playing');
  });
});
