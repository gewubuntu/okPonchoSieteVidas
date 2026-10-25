import { describe, expect, it } from 'vitest';
import { TAP_OFF, type PauseEvent, type Tap } from './pause';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { TITLE, titleAfterQuit, titleFrame, titlePrompt, type TitleState } from './title';

// Bits of `buttonsDown` (src/sim/run.ts): jump 1, left 2, right 4, claw 8, Fuego 16.
/** One frame, the state only. */
const frame = (s: TitleState, events: readonly PauseEvent[], down = 0, settings: Settings = DEFAULT_SETTINGS) => titleFrame(s, events, down, settings).state;
const tap = (t: Partial<Tap>): Tap => ({ ...TAP_OFF, ...t });
const UPRIGHT = frame(TITLE, ['portrait']);
/** The title with Settings chosen, and with the settings screen open on Master volume. */
const CHOSEN = frame(TITLE, ['menuDown']);
const OPEN = frame(TITLE, ['menuDown', 'pick']);

describe('GDD-UI-02 title screen', () => {
  it('opens shown, sideways, with no button held, on Start with the settings screen closed', () => {
    expect(TITLE).toEqual({ shown: true, portrait: false, buttonsHeld: 0, choice: 'start', settings: null });
  });

  it('Enter, Space or Z on Start starts the level', () => {
    expect(frame(TITLE, ['pick']).shown).toBe(false);
  });

  it('a tap or click anywhere off the rows starts the level', () => {
    expect(frame(TITLE, [TAP_OFF]).shown).toBe(false);
  });

  it('a tap on the pause button starts the level too', () => {
    expect(frame(TITLE, ['button']).shown).toBe(false);
  });

  it('Escape, P, Left, Right and losing focus do nothing on the menu', () => {
    expect(frame(TITLE, ['key']).shown).toBe(true);
    expect(frame(TITLE, ['blur']).shown).toBe(true);
    expect(frame(TITLE, ['menuLeft', 'menuRight']).shown).toBe(true);
    expect(frame(TITLE, ['key', 'blur', 'menuLeft'])).toEqual(TITLE);
  });

  it('a button held since the last frame does not start it', () => {
    const next = frame({ ...TITLE, buttonsHeld: 2 }, [], 2);
    expect(next.shown).toBe(true);
    expect(next.buttonsHeld).toBe(2);
  });

  it('pressing a second button while holding one starts it', () => {
    expect(frame({ ...TITLE, buttonsHeld: 2 }, [], 2 | 8).shown).toBe(false);
  });

  it('upright, nothing starts', () => {
    expect(UPRIGHT).toEqual({ shown: true, portrait: true, buttonsHeld: 0, choice: 'start', settings: null });
    expect(frame(UPRIGHT, [TAP_OFF]).shown).toBe(true);
    expect(frame(UPRIGHT, ['pick']).shown).toBe(true);
    expect(frame(UPRIGHT, ['button']).shown).toBe(true);
    expect(frame(UPRIGHT, [], 2).shown).toBe(true);
  });

  it('turned sideways again it waits for a press, then a tap starts', () => {
    const sideways = frame(UPRIGHT, ['landscape']);
    expect(sideways).toMatchObject({ shown: true, portrait: false });
    expect(frame(sideways, [TAP_OFF]).shown).toBe(false);
  });

  it('a tap after turning sideways in the same frame starts', () => {
    expect(frame(UPRIGHT, ['landscape', TAP_OFF]).shown).toBe(false);
  });

  it('a tap and a turn upright in the same frame do not start', () => {
    expect(frame(TITLE, [TAP_OFF, 'portrait'])).toMatchObject({ shown: true, portrait: true });
    expect(frame(TITLE, ['pick', 'portrait'], 2)).toMatchObject({ shown: true, portrait: true });
  });

  it('a tap upright, then a turn sideways in the same frame, starts: the tap is recorded', () => {
    expect(frame(UPRIGHT, [TAP_OFF, 'landscape']).shown).toBe(false);
    expect(frame(UPRIGHT, ['button', 'landscape']).shown).toBe(false);
  });

  it('a button pressed while upright and still held when turned sideways does not start', () => {
    const held = frame(UPRIGHT, [], 2);
    expect(held.shown).toBe(true);
    expect(held.buttonsHeld).toBe(2);
    expect(frame(held, ['landscape'], 2).shown).toBe(true);
  });

  it('once started it stays gone', () => {
    const started = frame(TITLE, [TAP_OFF]);
    expect(frame(started, []).shown).toBe(false);
    expect(titleFrame(started, ['portrait'], 0)).toEqual({ state: started, settings: DEFAULT_SETTINGS });
  });
});

describe('GDD-UI-02 title menu', () => {
  it('the title opens with Start chosen; Down chooses Settings and Up Start, with no wrap-around', () => {
    expect(TITLE.choice).toBe('start');
    expect(frame(TITLE, ['menuUp']).choice).toBe('start');
    expect(frame(TITLE, ['menuDown']).choice).toBe('settings');
    expect(frame(TITLE, ['menuDown', 'menuDown']).choice).toBe('settings');
    expect(frame(TITLE, ['menuDown', 'menuUp']).choice).toBe('start');
    expect(frame(CHOSEN, ['menuUp']).choice).toBe('start');
    expect(frame(CHOSEN, ['menuDown']).choice).toBe('settings');
    expect(frame(CHOSEN, ['menuUp']).shown).toBe(true); // choosing starts nothing
    expect(frame(CHOSEN, ['menuDown']).shown).toBe(true);
  });

  it('Enter, Space or Z on Start starts the level', () => {
    expect(frame(TITLE, ['pick']).shown).toBe(false);
    expect(frame(CHOSEN, ['menuUp', 'pick']).shown).toBe(false);
  });

  it('picking Settings opens the settings screen on Master volume and does not start the level', () => {
    expect(OPEN).toMatchObject({ shown: true, choice: 'settings', settings: 'master' });
    expect(frame(TITLE, ['menuDown', 'pick', 'menuDown', 'menuUp'])).toMatchObject({ shown: true, settings: 'master' });
    // A start press earlier in the frame does not start it either: the frame ends with the settings screen open.
    expect(frame(TITLE, ['button', 'menuDown', 'pick'])).toMatchObject({ shown: true, settings: 'master' });
  });

  it('a tap on the Settings row opens settings; a tap on the Start row or off the rows starts', () => {
    expect(frame(TITLE, [tap({ title: 'settings' })])).toMatchObject({ shown: true, settings: 'master' });
    expect(frame(CHOSEN, [tap({ title: 'start' })]).shown).toBe(false);
    expect(frame(TITLE, [tap({ title: 'start' })]).shown).toBe(false);
    expect(frame(TITLE, [TAP_OFF]).shown).toBe(false);
    // A tap on the Quit row's or the Settings row's place of the pause menu is a plain spot here.
    expect(frame(TITLE, [tap({ pause: 'quit' })]).shown).toBe(false);
  });

  it('the jump button alone does not start the level', () => {
    expect(frame(TITLE, [], 1)).toMatchObject({ shown: true, buttonsHeld: 1 });
  });

  it('a new press of claw, Fuego, Left or Right starts the level', () => {
    for (const bit of [2, 4, 8, 16]) expect(frame(TITLE, [], bit).shown, `bit ${bit}`).toBe(false);
  });

  it('on the settings screen no game button starts the level, and one held through it is no new press after it', () => {
    expect(frame(OPEN, [], 2).shown).toBe(true);
    expect(frame(OPEN, [], 16).shown).toBe(true);
    // Left is pressed on the settings screen and held to its end: the title is back, still shown.
    const held = frame(OPEN, [], 2);
    expect(held.buttonsHeld).toBe(2);
    const back = frame(held, ['key'], 2);
    expect(back).toMatchObject({ shown: true, choice: 'settings', settings: null });
    expect(frame(back, [], 2).shown).toBe(true);
    // Released, then pressed again, it starts.
    const released = frame(back, [], 0);
    expect(released.shown).toBe(true);
    expect(frame(released, [], 2).shown).toBe(false);
  });

  it('a game button pressed on the settings screen in the frame that leaves it is no start', () => {
    // Left goes down and Escape leaves the screen within one frame: the title is back, still shown.
    expect(frame(OPEN, ['key'], 2)).toMatchObject({ shown: true, choice: 'settings', settings: null });
    // Settings opened and left within one frame, with Fuego going down: no start either.
    expect(frame({ ...TITLE, choice: 'settings' }, ['pick', 'key'], 16)).toMatchObject({ shown: true, settings: null });
    expect(frame(TITLE, [tap({ title: 'settings' }), 'key'], 2)).toMatchObject({ shown: true, settings: null });
    // With the screen closed all frame, the same press starts.
    expect(frame({ ...TITLE, choice: 'settings' }, [], 16).shown).toBe(false);
  });

  it('leaving the settings screen comes back to the title with Settings chosen', () => {
    for (const leave of ['key', tap({ settings: { row: 'back', side: 'left' } })] as const) {
      expect(frame(OPEN, [leave]), JSON.stringify(leave)).toEqual({ ...TITLE, choice: 'settings' });
    }
    expect(frame(OPEN, ['menuDown', 'menuDown', 'pick'])).toEqual({ ...TITLE, choice: 'settings' });
    // Opened by a tap on its row while Start was chosen, it still comes back with Settings chosen.
    expect(frame(TITLE, [tap({ title: 'settings' }), 'key'])).toEqual({ ...TITLE, choice: 'settings' });
    // The start item was chosen before? Opening it needed Settings chosen.
    expect(frame(OPEN, ['key', 'pick'])).toMatchObject({ settings: 'master' }); // pick on Settings opens it again
  });

  it("Escape, P and the pause button's place on the title's settings screen", () => {
    expect(frame(OPEN, ['key'])).toMatchObject({ shown: true, settings: null, choice: 'settings' });
    expect(frame(OPEN, ['button'])).toMatchObject({ shown: true, settings: 'master' }); // a plain spot: nothing happens
    expect(titleFrame(OPEN, ['button'], 0, { master: 3, effects: 4 }).settings).toEqual({ master: 3, effects: 4 });
  });

  it("the volumes change on the title's settings screen", () => {
    const r = titleFrame(TITLE, ['menuDown', 'pick', 'menuRight', 'menuLeft', 'menuLeft'], 0, { master: 10, effects: 10 });
    expect(r.settings).toEqual({ master: 8, effects: 10 }); // Right at 10 stays 10, then two Lefts
    const s = titleFrame(TITLE, ['menuDown', 'pick', 'menuDown', 'menuLeft'], 0, { master: 9, effects: 10 });
    expect(s.settings).toEqual({ master: 9, effects: 9 });
    expect(s.state.settings).toBe('effects');
    const t = titleFrame(OPEN, [tap({ settings: { row: 'effects', side: 'left' } })], 0, { master: 3, effects: 4 });
    expect(t).toMatchObject({ settings: { master: 3, effects: 3 }, state: { settings: 'effects' } });
    const u = titleFrame(TITLE, ['menuDown', 'pick', 'menuRight'], 0, { master: 9, effects: 10 });
    expect(u.settings).toEqual({ master: 10, effects: 10 });
  });

  it('upright, nothing is chosen or picked; sideways again the choice is kept', () => {
    expect(frame(UPRIGHT, ['menuDown']).choice).toBe('start');
    expect(frame(UPRIGHT, ['menuDown', 'pick'])).toMatchObject({ choice: 'start', settings: null, shown: true });
    expect(frame(CHOSEN, ['portrait'])).toMatchObject({ choice: 'settings', portrait: true });
    expect(frame(frame(CHOSEN, ['portrait']), ['menuUp']).choice).toBe('settings');
    expect(frame(CHOSEN, ['portrait', 'landscape']).choice).toBe('settings');
    const upright = frame(CHOSEN, ['portrait']);
    expect(frame(upright, ['landscape', 'pick'])).toMatchObject({ settings: 'master' });
    // Upright, the settings screen takes nothing either.
    const screenUp = frame(OPEN, ['portrait']);
    expect(screenUp).toMatchObject({ settings: 'master', portrait: true });
    expect(titleFrame(screenUp, ['menuDown', 'menuLeft', 'key'], 0, { master: 5, effects: 5 })).toEqual({ state: screenUp, settings: { master: 5, effects: 5 } });
    expect(frame(screenUp, ['landscape', 'menuDown'])).toMatchObject({ settings: 'effects', portrait: false });
  });

  it('a pick of Settings just before a turn upright opens it, hidden until sideways', () => {
    expect(frame(TITLE, ['menuDown', 'pick', 'portrait'])).toMatchObject({ settings: 'master', portrait: true, shown: true });
  });

  it('quitting to the title opens on Start with the settings screen closed', () => {
    expect(titleAfterQuit(false, 2)).toEqual({ shown: true, portrait: false, buttonsHeld: 2, choice: 'start', settings: null });
    expect(titleAfterQuit(true, 0)).toEqual({ shown: true, portrait: true, buttonsHeld: 0, choice: 'start', settings: null });
  });

  it('the title prompt is empty sideways and asks to turn upright', () => {
    expect(titlePrompt(false)).toEqual({ text: '', size: 12 });
    expect(titlePrompt(true)).toEqual({ text: 'Turn your device sideways', size: 12 });
  });
});

describe('GDD-UI-02 title screen after quitting from the pause menu', () => {
  it('a tap on a pause menu row place starts the level like any tap off the title rows', () => {
    expect(frame(TITLE, [tap({ pause: 'quit' })]).shown).toBe(false);
  });

  it('up, down, left, right and pick on Settings do not start the level', () => {
    expect(frame(TITLE, ['menuUp', 'menuDown', 'menuLeft', 'menuRight', 'pick']).shown).toBe(true);
  });

  it('after a quit the title waits for a new press: the button that picked counts as held', () => {
    const quit = titleAfterQuit(false, 2);
    expect(frame(quit, [], 2).shown).toBe(true);
    expect(frame(frame(quit, [], 0), [], 2).shown).toBe(false);
  });

  it('after a quit upright, nothing starts until sideways', () => {
    const quit = titleAfterQuit(true, 0);
    expect(frame(quit, [TAP_OFF]).shown).toBe(true);
  });
});

describe('GDD-CTL-02 the gamepad on the title screen', () => {
  it('start starts the level whichever row is chosen', () => {
    expect(titleFrame(TITLE, ['start'], 0).state.shown).toBe(false);
    expect(titleFrame(TITLE, ['menuDown', 'start'], 0).state.shown).toBe(false);
  });

  it("start on the title's settings screen leaves it and does not start", () => {
    const one = titleFrame(TITLE, ['menuDown', 'pick', 'start'], 0).state;
    expect(one.shown).toBe(true);
    expect(one.settings).toBeNull();
    expect(one.choice).toBe('settings');
    const opened = titleFrame(TITLE, ['menuDown', 'pick'], 0).state;
    expect(opened.settings).toBe('master');
    const two = titleFrame(opened, ['start'], 0).state;
    expect(two.shown).toBe(true);
    expect(two.settings).toBeNull();
    expect(two.choice).toBe('settings');
  });

  it('start upright does not start, a start and a turn sideways in one frame does', () => {
    expect(titleFrame(UPRIGHT, ['start'], 0).state.shown).toBe(true);
    const upright = titleFrame(TITLE, ['portrait'], 0).state;
    expect(titleFrame(upright, ['start'], 0).state.shown).toBe(true);
    expect(titleFrame(upright, ['start', 'landscape'], 0).state.shown).toBe(false);
    expect(titleFrame(TITLE, ['landscape', 'start', 'portrait'], 0).state.shown).toBe(true);
  });

  it('Escape still does nothing on the title', () => {
    expect(titleFrame(TITLE, ['key'], 0).state.shown).toBe(true);
  });
});
