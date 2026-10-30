import { describe, expect, it } from 'vitest';
import { GAME_OVER, LIVES_MAX, TILE } from '../config/tuning';
import { loseLife } from './lives';
import type { PlayerInput } from './movement';
import { isPortrait, pauseEvent, pauseFrame, PLAYING, resumeHeld, TAP_OFF, type PauseEvent, type PauseState, type Tap } from './pause';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const PAUSED: PauseState = { paused: true, portrait: false, choice: 'resume', settings: null };
const PAUSED_SETTINGS: PauseState = { ...PAUSED, choice: 'settings' };
const PAUSED_QUIT: PauseState = { ...PAUSED, choice: 'quit' };
const UPRIGHT: PauseState = { paused: true, portrait: true, choice: 'resume', settings: null };
/** The settings screen open on a row, in the paused menu with Settings chosen. */
const SCREEN = (row: 'master' | 'effects' | 'back'): PauseState => ({ ...PAUSED_SETTINGS, settings: row });
const tap = (t: Partial<Tap>): Tap => ({ ...TAP_OFF, ...t });
const QUIT_TAP = tap({ pause: 'quit' });
/** The state after the events, none of which quits. */
const after = (s: PauseState, ...events: PauseEvent[]) => {
  const frame = pauseFrame(s, events);
  if (frame.quit) throw new Error(`${events.map(label).join()} quit`);
  return frame.state;
};
const label = (e: PauseEvent) => JSON.stringify(e);
/** The state of one event, which does not quit. */
const one = (s: PauseState, e: PauseEvent, settings: Settings = DEFAULT_SETTINGS) => {
  const r = pauseEvent(s, e, settings);
  if (r === 'quit') throw new Error(`${label(e)} quit`);
  return r.state;
};

describe('GDD-UI-02 pausing and resuming', () => {
  it('Escape or P, or the touch pause button, pauses the level', () => {
    expect(one(PLAYING, 'key')).toEqual(PAUSED);
    expect(one(PLAYING, 'button')).toEqual(PAUSED);
  });

  it('the same key or button resumes it, and so does a tap anywhere', () => {
    expect(one(PAUSED, 'key')).toEqual(PLAYING);
    expect(one(PAUSED, 'button')).toEqual(PLAYING);
    expect(one(PAUSED, TAP_OFF)).toEqual(PLAYING);
  });

  it('a tap while playing does not pause: it is game input', () => {
    expect(one(PLAYING, TAP_OFF)).toEqual(PLAYING);
  });

  it('losing focus or being hidden pauses, and nothing resumes by itself', () => {
    expect(one(PLAYING, 'blur')).toEqual(PAUSED);
    expect(one(PAUSED, 'blur')).toEqual(PAUSED); // a second blur does not resume
  });

  it('a phone turned upright pauses, and no key, button or tap resumes until it is sideways again', () => {
    expect(one(PLAYING, 'portrait')).toEqual(UPRIGHT);
    expect(one(PAUSED, 'portrait')).toEqual(UPRIGHT);
    for (const e of ['key', 'button', TAP_OFF, 'blur'] as const) expect(one(UPRIGHT, e), label(e)).toEqual(UPRIGHT);
  });

  it('turned sideways again it stays paused until the player resumes', () => {
    expect(one(UPRIGHT, 'landscape')).toEqual(PAUSED);
    expect(after(UPRIGHT, 'landscape', TAP_OFF)).toEqual(PLAYING);
    expect(after(UPRIGHT, 'landscape', 'key')).toEqual(PLAYING);
    expect(one(PLAYING, 'landscape')).toEqual(PLAYING);
  });

  it('upright means a touch device whose screen is upright', () => {
    expect(isPortrait('portrait-primary', 390, 844, true)).toBe(true);
    expect(isPortrait('portrait-secondary', 390, 844, true)).toBe(true);
    expect(isPortrait('landscape-primary', 844, 390, true)).toBe(false);
    expect(isPortrait('portrait-primary', 390, 844, false)).toBe(false); // no touch: a desktop
  });

  it('a touchscreen laptop in a tall window is not upright: its screen stays landscape', () => {
    expect(isPortrait('landscape-primary', 700, 900, true)).toBe(false);
  });

  it('without a screen orientation, the window shape decides', () => {
    expect(isPortrait(undefined, 390, 844, true)).toBe(true);
    expect(isPortrait(undefined, 844, 390, true)).toBe(false);
    expect(isPortrait(undefined, 500, 500, true)).toBe(false);
    expect(isPortrait(undefined, 390, 844, false)).toBe(false);
  });
});

describe('GDD-UI-02 pause menu', () => {
  it('the menu opens with Resume chosen', () => {
    expect(one(PLAYING, 'key')).toMatchObject({ paused: true, choice: 'resume' });
    for (const e of ['key', 'blur', 'button', 'portrait'] as const) expect(one(PLAYING, e), e).toMatchObject({ paused: true, choice: 'resume' });
  });

  it('Down chooses Quit to title from Settings and Up chooses Resume, with no wrap-around', () => {
    expect(after(PAUSED, 'menuDown', 'menuDown')).toEqual(PAUSED_QUIT);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'menuDown')).toEqual(PAUSED_QUIT);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'menuUp', 'menuUp')).toEqual(PAUSED);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'menuUp', 'menuUp', 'menuUp')).toEqual(PAUSED);
  });

  it('pick on Resume resumes', () => {
    expect(one(PAUSED, 'pick')).toEqual(PLAYING);
  });

  it('pick on Quit to title quits', () => {
    expect(pauseEvent(PAUSED_QUIT, 'pick')).toBe('quit');
    expect(pauseFrame(PAUSED, ['menuDown', 'menuDown', 'pick']).quit).toBe(true);
  });

  it('a tap on the Quit row quits whichever item is chosen', () => {
    expect(pauseEvent(PAUSED, QUIT_TAP)).toBe('quit');
    expect(pauseEvent(PAUSED_QUIT, QUIT_TAP)).toBe('quit');
  });

  it('a tap off the Quit row, the Resume row too, resumes whichever item is chosen', () => {
    expect(one(PAUSED, TAP_OFF)).toEqual(PLAYING);
    expect(one(PAUSED_QUIT, TAP_OFF)).toEqual(PLAYING);
    expect(one(PAUSED, tap({ pause: 'resume' }))).toEqual(PLAYING);
    expect(one(PAUSED_QUIT, tap({ pause: 'resume' }))).toEqual(PLAYING);
  });

  it('a tap off the rows still resumes, and Escape, P and the pause button resume with Quit chosen', () => {
    expect(after(PAUSED, 'menuDown', 'menuDown', TAP_OFF)).toEqual(PLAYING);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'key')).toEqual(PLAYING);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'button')).toEqual(PLAYING);
  });

  it('resuming resets the choice, so the next pause opens on Resume', () => {
    expect(after(PAUSED, 'menuDown', 'menuDown', 'key')).toEqual(PLAYING);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'key', 'key')).toEqual(PAUSED);
    expect(after(PAUSED, 'menuDown', 'menuDown', TAP_OFF, 'blur')).toEqual(PAUSED);
  });

  it('while playing, up, down, left, right, pick and taps on the rows do nothing', () => {
    for (const e of ['menuUp', 'menuDown', 'menuLeft', 'menuRight', 'pick', QUIT_TAP, tap({ pause: 'settings' })] as const) expect(one(PLAYING, e), label(e)).toEqual(PLAYING);
  });

  it('upright, nothing on the menu can be chosen or picked', () => {
    for (const e of ['menuDown', 'menuUp', 'pick', QUIT_TAP] as const) expect(one(UPRIGHT, e), label(e)).toEqual(UPRIGHT);
    const uprightQuit = after(PAUSED_QUIT, 'portrait');
    expect(uprightQuit).toEqual({ paused: true, portrait: true, choice: 'quit', settings: null }); // the choice is kept across the turn
    for (const e of ['menuUp', 'pick', QUIT_TAP] as const) expect(one(uprightQuit, e), label(e)).toEqual(uprightQuit);
    expect(pauseEvent(after(uprightQuit, 'landscape'), 'pick')).toBe('quit');
  });

  it('Left and Right do nothing on the menu', () => {
    expect(one(PAUSED, 'menuLeft')).toEqual(PAUSED);
    expect(one(PAUSED_QUIT, 'menuRight')).toEqual(PAUSED_QUIT);
  });

  it('the presses of one frame count in order', () => {
    const toQuit = ['menuDown', 'menuDown'] as const;
    expect(pauseFrame(PAUSED, [...toQuit, 'pick']).quit).toBe(true);
    expect(pauseFrame(PAUSED, ['pick', ...toQuit])).toMatchObject({ quit: false, state: PLAYING });
    expect(pauseFrame(PLAYING, ['key', ...toQuit, 'pick']).quit).toBe(true);
    expect(pauseFrame(PAUSED, ['key', ...toQuit, 'pick'])).toMatchObject({ quit: false, state: PLAYING }); // Escape resumed first
  });

  it('after a quit the rest of the frame only tracks the orientation', () => {
    expect(pauseFrame(PAUSED, [QUIT_TAP, 'portrait'])).toEqual({ state: PLAYING, quit: true, portrait: true, settings: DEFAULT_SETTINGS });
    expect(pauseFrame(PAUSED, [QUIT_TAP, 'key', TAP_OFF])).toEqual({ state: PLAYING, quit: true, portrait: false, settings: DEFAULT_SETTINGS });
    expect(pauseFrame(PAUSED, [QUIT_TAP, 'portrait', 'landscape'])).toEqual({ state: PLAYING, quit: true, portrait: false, settings: DEFAULT_SETTINGS });
  });

  it('a pick and a turn upright in the same frame: the order decides', () => {
    const chosen = after(PAUSED, 'menuDown', 'menuDown');
    expect(pauseFrame(chosen, ['portrait', 'pick'])).toMatchObject({ quit: false, state: { paused: true, portrait: true } });
    expect(pauseFrame(chosen, ['pick', 'portrait']).quit).toBe(true);
  });
});

describe('GDD-UI-02 pause menu with Settings', () => {
  const OPEN = SCREEN('master');

  it('Down goes Resume, Settings, Quit to title and Up comes back, with no wrap-around', () => {
    expect(after(PAUSED, 'menuDown')).toEqual(PAUSED_SETTINGS);
    expect(after(PAUSED, 'menuDown', 'menuDown')).toEqual(PAUSED_QUIT);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'menuDown')).toEqual(PAUSED_QUIT);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'menuUp')).toEqual(PAUSED_SETTINGS);
    expect(after(PAUSED, 'menuDown', 'menuDown', 'menuUp', 'menuUp')).toEqual(PAUSED);
    expect(after(PAUSED, 'menuUp')).toEqual(PAUSED);
  });

  it('picking Settings opens the settings screen on Master volume, still paused', () => {
    expect(one(PAUSED_SETTINGS, 'pick')).toEqual(OPEN);
    expect(one(PAUSED, tap({ pause: 'settings' }))).toMatchObject({ paused: true, portrait: false, settings: 'master' });
    expect(one(PAUSED_QUIT, tap({ pause: 'settings' }))).toMatchObject({ paused: true, portrait: false, settings: 'master' });
  });

  it('a tap on the Resume row or off the rows resumes; on the Settings row it opens settings; on the Quit row it quits', () => {
    expect(one(PAUSED_SETTINGS, tap({ pause: 'resume' }))).toEqual(PLAYING);
    expect(one(PAUSED_SETTINGS, TAP_OFF)).toEqual(PLAYING);
    expect(one(PAUSED, tap({ pause: 'settings' })).settings).toBe('master');
    expect(pauseEvent(PAUSED_SETTINGS, QUIT_TAP)).toBe('quit');
  });

  it('leaving the settings screen comes back to the pause menu with Settings chosen', () => {
    const backRow = SCREEN('back');
    expect(one(backRow, 'pick')).toEqual(PAUSED_SETTINGS);
    expect(one(OPEN, 'key')).toEqual(PAUSED_SETTINGS);
    expect(one(OPEN, 'button')).toEqual(PAUSED_SETTINGS);
    expect(one(OPEN, tap({ settings: { row: 'back', side: 'left' } }))).toEqual(PAUSED_SETTINGS);
    expect(one(OPEN, tap({ settings: { row: 'back', side: 'right' } }))).toEqual(PAUSED_SETTINGS);
  });

  it('Escape on the settings screen goes back to the menu, a second Escape resumes', () => {
    expect(pauseFrame(OPEN, ['key']).state).toEqual(PAUSED_SETTINGS);
    expect(pauseFrame(OPEN, ['key', 'key'])).toMatchObject({ state: PLAYING, quit: false });
    expect(pauseFrame(OPEN, ['key', 'button'])).toMatchObject({ state: PLAYING, quit: false });
  });

  it('a tap off the rows on the settings screen does nothing', () => {
    expect(one(OPEN, TAP_OFF)).toEqual(OPEN);
    expect(one(SCREEN('effects'), tap({ pause: 'resume' }))).toEqual(SCREEN('effects'));
    expect(one(OPEN, tap({ pause: 'quit' }))).toEqual(OPEN); // the Quit row's place is no row of this screen
  });

  it('the settings screen opens on Master volume every time', () => {
    const moved = after(OPEN, 'menuDown', 'menuDown', 'menuDown');
    expect(moved.settings).toBe('back');
    const closed = after(moved, 'pick');
    expect(closed).toEqual(PAUSED_SETTINGS);
    expect(after(closed, 'pick')).toEqual(OPEN);
    expect(after(PAUSED, 'menuDown', 'pick')).toEqual(OPEN);
  });

  it('upright, the settings screen keeps its row and takes no presses; sideways again it does', () => {
    const effects = SCREEN('effects');
    const upright = after(effects, 'portrait');
    expect(upright).toEqual({ ...effects, portrait: true });
    for (const e of ['menuDown', 'menuUp', 'menuLeft', 'menuRight', 'pick', 'key', 'button', TAP_OFF, tap({ settings: { row: 'back', side: 'left' } })] as const) {
      expect(pauseEvent(upright, e, { master: 4, effects: 4, language: 'en' }), label(e)).toEqual({ state: upright, settings: { master: 4, effects: 4, language: 'en' } });
    }
    expect(pauseFrame(upright, ['landscape', 'menuLeft'], { master: 4, effects: 4, language: 'en' })).toMatchObject({ state: effects, settings: { master: 4, effects: 3, language: 'en' } });
    expect(after(upright, 'landscape', 'menuDown').settings).toBe('language');
    expect(after(effects, 'blur')).toEqual(effects);
  });

  it('the volumes change through the pause frame in order', () => {
    const frame = pauseFrame(PAUSED_SETTINGS, ['pick', 'menuLeft', 'menuDown', 'menuLeft', 'menuLeft'], { master: 10, effects: 10, language: 'en' });
    expect(frame.settings).toEqual({ master: 9, effects: 8, language: 'en' });
    expect(frame.state).toEqual(SCREEN('effects'));
    expect(frame.quit).toBe(false);
  });

  it('a quit leaves the volumes as they were', () => {
    const frame = pauseFrame(PAUSED, ['menuDown', 'menuDown', 'pick', 'menuLeft'], { master: 7, effects: 3, language: 'en' });
    expect(frame).toEqual({ state: PLAYING, quit: true, portrait: false, settings: { master: 7, effects: 3, language: 'en' } });
    const changed = pauseFrame(PAUSED_SETTINGS, ['pick', 'menuLeft', 'key', 'menuDown', 'menuDown', 'pick', 'menuRight'], { master: 7, effects: 3, language: 'en' });
    expect(changed).toMatchObject({ quit: true, settings: { master: 6, effects: 3, language: 'en' } });
  });

  it('resuming closes the settings screen for the next pause', () => {
    const resumed = after(OPEN, 'key', 'key');
    expect(resumed).toEqual(PLAYING);
    expect(after(resumed, 'key')).toEqual(PAUSED);
    expect(after(PAUSED_SETTINGS, 'pick', 'key', 'pick', 'key', 'key', 'key')).toEqual(PAUSED);
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

describe('GDD-CTL-02 the gamepad start button', () => {
  it('start pauses, resumes and is ignored upright like Escape', () => {
    expect(one(PLAYING, 'start')).toEqual(PAUSED);
    expect(one(PLAYING, 'start')).toEqual(one(PLAYING, 'key'));
    expect(one(PAUSED, 'start')).toEqual(PLAYING);
    expect(one(UPRIGHT, 'start')).toEqual(UPRIGHT);
    const open = after(PAUSED, 'menuDown', 'pick');
    expect(open.settings).toBe('master');
    const back = one(open, 'start');
    expect(back.settings).toBeNull();
    expect(back.choice).toBe('settings');
    expect(back.paused).toBe(true);
  });
});
