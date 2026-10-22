import { describe, expect, it } from 'vitest';
import { GAME_OVER, LIVES_MAX, TILE } from '../config/tuning';
import { loseLife } from './lives';
import type { PlayerInput } from './movement';
import { isPortrait, pauseEvent, PLAYING, resumeHeld, type PauseEvent, type PauseState } from './pause';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const PAUSED: PauseState = { paused: true, portrait: false };
const UPRIGHT: PauseState = { paused: true, portrait: true };
const after = (s: PauseState, ...events: PauseEvent[]) => events.reduce(pauseEvent, s);

describe('GDD-UI-02 pausing and resuming', () => {
  it('Escape or P, or the touch pause button, pauses the level', () => {
    expect(pauseEvent(PLAYING, 'key')).toEqual(PAUSED);
    expect(pauseEvent(PLAYING, 'button')).toEqual(PAUSED);
  });

  it('the same key or button resumes it, and so does a tap anywhere', () => {
    expect(pauseEvent(PAUSED, 'key')).toEqual(PLAYING);
    expect(pauseEvent(PAUSED, 'button')).toEqual(PLAYING);
    expect(pauseEvent(PAUSED, 'tap')).toEqual(PLAYING);
  });

  it('a tap while playing does not pause: it is game input', () => {
    expect(pauseEvent(PLAYING, 'tap')).toEqual(PLAYING);
  });

  it('losing focus or being hidden pauses, and nothing resumes by itself', () => {
    expect(pauseEvent(PLAYING, 'blur')).toEqual(PAUSED);
    expect(pauseEvent(PAUSED, 'blur')).toEqual(PAUSED); // a second blur does not resume
  });

  it('a phone turned upright pauses, and no key, button or tap resumes until it is sideways again', () => {
    expect(pauseEvent(PLAYING, 'portrait')).toEqual(UPRIGHT);
    expect(pauseEvent(PAUSED, 'portrait')).toEqual(UPRIGHT);
    for (const e of ['key', 'button', 'tap', 'blur'] as const) expect(pauseEvent(UPRIGHT, e), e).toEqual(UPRIGHT);
  });

  it('turned sideways again it stays paused until the player resumes', () => {
    expect(pauseEvent(UPRIGHT, 'landscape')).toEqual(PAUSED);
    expect(after(UPRIGHT, 'landscape', 'tap')).toEqual(PLAYING);
    expect(after(UPRIGHT, 'landscape', 'key')).toEqual(PLAYING);
    expect(pauseEvent(PLAYING, 'landscape')).toEqual(PLAYING);
  });

  it('upright means a touch device taller than wide; a narrow desktop window is not', () => {
    expect(isPortrait(390, 844, true)).toBe(true);
    expect(isPortrait(844, 390, true)).toBe(false);
    expect(isPortrait(500, 500, true)).toBe(false);
    expect(isPortrait(390, 844, false)).toBe(false);
  });
});

// Floor from x = 0 to 224, top y = 64, and nothing else.
const world = parseTiles(['..............', '..............', '..............', '..............', '##############', '##############']);
const level: Level = { world, spawn: { x: 40, y: 4 * TILE }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };
const idle: PlayerInput = { move: 0, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };
const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};
const settled = () => run(startRun(level), idle, 5);

describe('GDD-UI-02 a press made while paused does nothing on resume', () => {
  it('jump pressed while paused, still held at resume: no jump until it is released and pressed again', () => {
    let r = resumeHeld(settled(), jump);
    r = stepRun(r, jump, level);
    expect(r.player.vy).toBe(0);
    expect(r.player.grounded).toBe(true);
    r = stepRun(stepRun(r, idle, level), jump, level);
    expect(r.player.vy).toBeLessThan(0);
  });

  it('without resumeHeld the same held jump would jump (the test can fail)', () => {
    expect(stepRun(settled(), jump, level).player.vy).toBeLessThan(0);
  });

  it('a jump held since before the pause stays held: the jump is not cut', () => {
    const rising = run(settled(), jump, 3);
    expect(rising.player.vy).toBeLessThan(0);
    const resumed = stepRun(resumeHeld(rising, jump), jump, level);
    expect(resumed.player.vy).toBe(stepRun(rising, jump, level).player.vy);
  });

  it('a jump held before the pause and released during it is cut on resume, as with no pause', () => {
    const rising = run(settled(), jump, 3);
    const resumed = stepRun(resumeHeld(rising, idle), idle, level);
    expect(resumed.player.vy).toBe(stepRun(rising, idle, level).player.vy);
    expect(resumed.player.vy).toBeGreaterThan(stepRun(rising, jump, level).player.vy); // cut: slower upwards
  });

  it('claw pressed while paused: no swing until a new press', () => {
    const claw: PlayerInput = { move: 0, jumpHeld: false, claw: true };
    expect(stepRun(settled(), claw, level).claw.phase).toBe('windup'); // the test can fail
    let r = stepRun(resumeHeld(settled(), claw), claw, level);
    expect(r.claw.phase).toBe('idle');
    r = run(r, idle, 1);
    expect(stepRun(r, claw, level).claw.phase).toBe('windup');
  });

  it('Fuego pressed while paused: no fireball until a new press', () => {
    const fuego: PlayerInput = { move: 0, jumpHeld: false, fuego: true };
    const hot = { ...settled(), power: 'fuego' as const };
    expect(stepRun(hot, fuego, level).fireballs).toHaveLength(1); // the test can fail
    let r = stepRun(resumeHeld(hot, fuego), fuego, level);
    expect(r.fireballs).toHaveLength(0);
    r = run(r, idle, 1);
    expect(stepRun(r, fuego, level).fireballs).toHaveLength(1);
  });

  it('on the Siete vidas gastadas screen, a button pressed while paused does not end it (GDD-LIFE-05)', () => {
    let r = settled();
    for (let i = 0; i < LIVES_MAX; i++) r = { ...r, lives: loseLife(r.lives) };
    r = { ...r, phase: 'gameover', wait: GAME_OVER.lockoutSteps + 10, buttonsHeld: 0 };
    const right: PlayerInput = { move: 1, jumpHeld: false, right: true };
    expect(stepRun(r, right, level).phase).toBe('respawning'); // the test can fail
    expect(stepRun(resumeHeld(r, right), right, level).phase).toBe('gameover');
  });

  it('moving is not blocked: right held at resume walks on', () => {
    const right: PlayerInput = { move: 1, jumpHeld: false, right: true };
    const r = stepRun(resumeHeld(settled(), right), right, level);
    expect(r.player.vx).toBeGreaterThan(0);
  });

  it('with nothing down it changes nothing', () => {
    const r = settled();
    expect(resumeHeld(r, idle)).toEqual(r);
  });
});
