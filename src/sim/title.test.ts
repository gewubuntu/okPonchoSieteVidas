import { describe, expect, it } from 'vitest';
import { TITLE, titleAfterQuit, titleFrame, titlePrompt } from './title';

// Bits of `buttonsDown` (src/sim/run.ts): jump 1, left 2, right 4, claw 8, Fuego 16.
const UPRIGHT = titleFrame(TITLE, ['portrait'], 0);

describe('GDD-UI-02 title screen', () => {
  it('opens shown, sideways, with no button held', () => {
    expect(TITLE).toEqual({ shown: true, portrait: false, buttonsHeld: 0 });
  });

  it('Enter starts the level', () => {
    expect(titleFrame(TITLE, ['confirm'], 0).shown).toBe(false);
  });

  it('a tap or click anywhere starts the level', () => {
    expect(titleFrame(TITLE, ['tap'], 0).shown).toBe(false);
  });

  it('a tap on the pause button starts the level too', () => {
    expect(titleFrame(TITLE, ['button'], 0).shown).toBe(false);
  });

  it('Escape, P and losing focus do nothing', () => {
    expect(titleFrame(TITLE, ['key'], 0).shown).toBe(true);
    expect(titleFrame(TITLE, ['blur'], 0).shown).toBe(true);
    expect(titleFrame(TITLE, ['key', 'blur'], 0).shown).toBe(true);
  });

  it('a new press of each game button starts the level', () => {
    for (const bit of [1, 2, 4, 8, 16]) expect(titleFrame(TITLE, [], bit).shown, `bit ${bit}`).toBe(false);
  });

  it('a button held since the last frame does not start it', () => {
    const next = titleFrame({ ...TITLE, buttonsHeld: 1 }, [], 1);
    expect(next.shown).toBe(true);
    expect(next.buttonsHeld).toBe(1);
  });

  it('pressing a second button while holding one starts it', () => {
    expect(titleFrame({ ...TITLE, buttonsHeld: 1 }, [], 1 | 8).shown).toBe(false);
  });

  it('upright, nothing starts', () => {
    expect(UPRIGHT).toEqual({ shown: true, portrait: true, buttonsHeld: 0 });
    expect(titleFrame(UPRIGHT, ['tap'], 0).shown).toBe(true);
    expect(titleFrame(UPRIGHT, ['confirm'], 0).shown).toBe(true);
    expect(titleFrame(UPRIGHT, ['button'], 0).shown).toBe(true);
    expect(titleFrame(UPRIGHT, [], 1).shown).toBe(true);
  });

  it('turned sideways again it waits for a press, then a tap starts', () => {
    const sideways = titleFrame(UPRIGHT, ['landscape'], 0);
    expect(sideways).toMatchObject({ shown: true, portrait: false });
    expect(titleFrame(sideways, ['tap'], 0).shown).toBe(false);
  });

  it('a tap after turning sideways in the same frame starts', () => {
    expect(titleFrame(UPRIGHT, ['landscape', 'tap'], 0).shown).toBe(false);
  });

  it('a tap and a turn upright in the same frame do not start', () => {
    expect(titleFrame(TITLE, ['tap', 'portrait'], 0)).toMatchObject({ shown: true, portrait: true });
    expect(titleFrame(TITLE, ['confirm', 'portrait'], 1)).toMatchObject({ shown: true, portrait: true });
  });

  it('a button pressed while upright and still held when turned sideways does not start', () => {
    const held = titleFrame(UPRIGHT, [], 1);
    expect(held.shown).toBe(true);
    expect(held.buttonsHeld).toBe(1);
    expect(titleFrame(held, ['landscape'], 1).shown).toBe(true);
  });

  it('once started it stays gone', () => {
    const started = titleFrame(TITLE, ['tap'], 0);
    expect(titleFrame(started, [], 0).shown).toBe(false);
    expect(titleFrame(started, ['portrait'], 0)).toBe(started);
  });

  it('prompt: Press any button to start on a keyboard, Tap to start on touch, 8 px', () => {
    expect(titlePrompt(false, false)).toEqual({ text: 'Press any button to start', size: 8 });
    expect(titlePrompt(false, true)).toEqual({ text: 'Tap to start', size: 8 });
  });

  it('prompt upright: Turn your device sideways, 12 px', () => {
    expect(titlePrompt(true, true)).toEqual({ text: 'Turn your device sideways', size: 12 });
  });
});

describe('GDD-UI-02 title screen after quitting from the pause menu', () => {
  it('a tap on a menu row place starts the level like any tap', () => {
    expect(titleFrame(TITLE, ['tapQuit'], 0).shown).toBe(false);
  });

  it('up, down and pick do nothing on the title screen', () => {
    expect(titleFrame(TITLE, ['menuUp', 'menuDown', 'pick'], 0).shown).toBe(true);
  });

  it('after a quit the title waits for a new press: the button that picked counts as held', () => {
    const quit = titleAfterQuit(false, 1);
    expect(quit).toEqual({ shown: true, portrait: false, buttonsHeld: 1 });
    expect(titleFrame(quit, [], 1).shown).toBe(true);
    expect(titleFrame(titleFrame(quit, [], 0), [], 1).shown).toBe(false);
  });

  it('after a quit upright, nothing starts until sideways', () => {
    const quit = titleAfterQuit(true, 0);
    expect(quit).toEqual({ shown: true, portrait: true, buttonsHeld: 0 });
    expect(titleFrame(quit, ['tap'], 0).shown).toBe(true);
  });
});
