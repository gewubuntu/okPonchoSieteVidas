import { describe, expect, it } from 'vitest';
import { TITLE_PONCHO } from '../config/tuning';
import { TAP_OFF, type PauseEvent, type Tap } from './pause';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { TITLE, titleAfterQuit, titleFrame, titleOpen, titlePonchoX, titlePrompt, type TitleState } from './title';

// Bits of `buttonsDown` (src/sim/run.ts): jump 1, left 2, right 4, claw 8, Fuego 16.
/** One frame, the state only. */
const frame = (s: TitleState, events: readonly PauseEvent[], down = 0, settings: Settings = DEFAULT_SETTINGS) => titleFrame(s, events, down, settings).state;
const tap = (t: Partial<Tap>): Tap => ({ ...TAP_OFF, ...t });
const UPRIGHT = frame(TITLE, ['portrait']);
/** The title with Tutorial chosen, with Settings chosen, and with the settings screen open on Master volume. */
const TUTORIAL = frame(TITLE, ['menuDown']);
const CHOSEN = frame(TITLE, ['menuDown', 'menuDown']);
const OPEN = frame(TITLE, ['menuDown', 'menuDown', 'pick']);
/** Whether and what a frame starts. */
const startOf = (s: TitleState, events: readonly PauseEvent[], down = 0) => titleFrame(s, events, down).start;

describe('GDD-UI-02 title screen', () => {
  it('opens shown, sideways, with no button held, on Start with the settings screen closed', () => {
    expect(TITLE).toEqual({ shown: true, portrait: false, buttonsHeld: 0, choice: 'start', settings: null, hasContinue: false });
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
    expect(UPRIGHT).toEqual({ shown: true, portrait: true, buttonsHeld: 0, choice: 'start', settings: null, hasContinue: false });
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
    expect(titleFrame(started, ['portrait'], 0)).toEqual({ state: started, settings: DEFAULT_SETTINGS, start: null });
  });
});

describe('GDD-UI-02 title menu', () => {
  it('the title opens with Start chosen', () => {
    expect(TITLE.choice).toBe('start');
  });

  it('GDD-UI-02 title: Down from Start chooses Tutorial, Down again Settings, and Down on Settings stays', () => {
    expect(frame(TITLE, ['menuDown']).choice).toBe('tutorial');
    expect(frame(TITLE, ['menuDown', 'menuDown']).choice).toBe('settings');
    expect(frame(TITLE, ['menuDown', 'menuDown', 'menuDown']).choice).toBe('settings');
    expect(frame(CHOSEN, ['menuDown']).choice).toBe('settings');
    expect(frame(CHOSEN, ['menuDown']).shown).toBe(true); // choosing starts nothing
  });

  it('GDD-UI-02 title: Up from Settings chooses Tutorial, then Start, and Up on Start stays', () => {
    expect(frame(CHOSEN, ['menuUp']).choice).toBe('tutorial');
    expect(frame(CHOSEN, ['menuUp', 'menuUp']).choice).toBe('start');
    expect(frame(CHOSEN, ['menuUp', 'menuUp', 'menuUp']).choice).toBe('start');
    expect(frame(TITLE, ['menuUp']).choice).toBe('start');
    expect(frame(TUTORIAL, ['menuUp']).choice).toBe('start');
    expect(frame(TUTORIAL, ['menuUp']).shown).toBe(true);
  });

  it('GDD-UI-02 title: picking Tutorial starts with the tutorial', () => {
    const r = titleFrame(TUTORIAL, ['pick'], 0);
    expect(r.state.shown).toBe(false);
    expect(r.start).toBe('tutorial');
    expect(startOf(TITLE, ['menuDown', 'pick'])).toBe('tutorial');
  });

  it('GDD-UI-02 title: picking Start starts with Start', () => {
    const r = titleFrame(TITLE, ['pick'], 0);
    expect(r.state.shown).toBe(false);
    expect(r.start).toBe('start');
    expect(startOf(TUTORIAL, ['menuUp', 'pick'])).toBe('start');
  });

  it('GDD-UI-02 title: a tap on the Tutorial row starts with the tutorial, a tap off the rows with Start', () => {
    expect(startOf(TITLE, [tap({ title: 'tutorial' })])).toBe('tutorial');
    expect(startOf(CHOSEN, [tap({ title: 'tutorial' })])).toBe('tutorial');
    expect(startOf(TITLE, [tap({ title: 'start' })])).toBe('start');
    expect(startOf(TUTORIAL, [tap({ title: 'start' })])).toBe('start');
    expect(startOf(TUTORIAL, [TAP_OFF])).toBe('start');
    expect(startOf(TUTORIAL, ['button'])).toBe('start');
    expect(startOf(TITLE, [tap({ pause: 'quit' })])).toBe('start');
  });

  it('GDD-UI-02 title: a new press of claw starts with Start, even with Tutorial chosen', () => {
    expect(startOf(TUTORIAL, [], 8)).toBe('start');
    for (const bit of [2, 4, 8, 16]) expect(startOf(TUTORIAL, [], bit), `bit ${bit}`).toBe('start');
  });

  it('GDD-UI-02 title: the last start event of a frame decides', () => {
    expect(startOf(TITLE, [tap({ title: 'tutorial' }), 'start'])).toBe('start');
    expect(startOf(TITLE, ['start', 'menuDown', 'pick'])).toBe('tutorial');
    expect(startOf(TITLE, [tap({ title: 'tutorial' }), TAP_OFF])).toBe('start');
    expect(startOf(TITLE, [TAP_OFF, tap({ title: 'tutorial' })])).toBe('tutorial');
    // A new game-button press counts as Start only when no start event came in the frame.
    expect(startOf(TITLE, [tap({ title: 'tutorial' })], 8)).toBe('tutorial');
    expect(startOf(TUTORIAL, ['pick'], 8)).toBe('tutorial');
    expect(startOf(TITLE, [], 8)).toBe('start');
  });

  it('GDD-UI-02 title: a tap upright starts with Start, even on the Tutorial row, once turned sideways', () => {
    expect(startOf(UPRIGHT, [tap({ title: 'tutorial' }), 'landscape'])).toBe('start');
    expect(startOf(UPRIGHT, [TAP_OFF, 'landscape'])).toBe('start');
  });

  it('GDD-UI-02 title: the title staying up gives no start', () => {
    expect(titleFrame(TITLE, [], 0).start).toBeNull();
    expect(titleFrame(TITLE, ['menuDown', 'menuUp', 'key', 'blur'], 0).start).toBeNull();
    expect(titleFrame(TITLE, [], 1).start).toBeNull();
    expect(titleFrame(CHOSEN, ['pick'], 0).start).toBeNull();
    expect(titleFrame(UPRIGHT, [TAP_OFF], 0).start).toBeNull();
    expect(titleFrame(TITLE, [tap({ title: 'tutorial' }), 'portrait'], 0).start).toBeNull();
    // Once started it stays gone, with no start.
    expect(titleFrame(frame(TITLE, ['pick']), ['pick'], 0).start).toBeNull();
  });

  it('Enter, Space or Z on Start starts the level', () => {
    expect(frame(TITLE, ['pick']).shown).toBe(false);
    expect(frame(CHOSEN, ['menuUp', 'menuUp', 'pick']).shown).toBe(false);
  });

  it('picking Settings opens the settings screen on Master volume and does not start the level', () => {
    expect(OPEN).toMatchObject({ shown: true, choice: 'settings', settings: 'master' });
    expect(frame(TITLE, ['menuDown', 'menuDown', 'pick', 'menuDown', 'menuUp'])).toMatchObject({ shown: true, settings: 'master' });
    // A start press earlier in the frame does not start it either: the frame ends with the settings screen open.
    expect(frame(TITLE, ['button', 'menuDown', 'menuDown', 'pick'])).toMatchObject({ shown: true, settings: 'master' });
    expect(titleFrame(TITLE, ['button', 'menuDown', 'menuDown', 'pick'], 0).start).toBeNull();
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
    expect(frame(OPEN, ['menuDown', 'menuDown', 'menuDown', 'menuDown', 'pick'])).toEqual({ ...TITLE, choice: 'settings' });
    // Opened by a tap on its row while Start was chosen, it still comes back with Settings chosen.
    expect(frame(TITLE, [tap({ title: 'settings' }), 'key'])).toEqual({ ...TITLE, choice: 'settings' });
    // The start item was chosen before? Opening it needed Settings chosen.
    expect(frame(OPEN, ['key', 'pick'])).toMatchObject({ settings: 'master' }); // pick on Settings opens it again
  });

  it("Escape, P and the pause button's place on the title's settings screen", () => {
    expect(frame(OPEN, ['key'])).toMatchObject({ shown: true, settings: null, choice: 'settings' });
    expect(frame(OPEN, ['button'])).toMatchObject({ shown: true, settings: 'master' }); // a plain spot: nothing happens
    expect(titleFrame(OPEN, ['button'], 0, { master: 3, effects: 4, language: 'en', buttonOpacity: 'medium' }).settings).toEqual({ master: 3, effects: 4, language: 'en', buttonOpacity: 'medium' });
  });

  it("the volumes change on the title's settings screen", () => {
    const r = titleFrame(TITLE, ['menuDown', 'menuDown', 'pick', 'menuRight', 'menuLeft', 'menuLeft'], 0, { master: 10, effects: 10, language: 'en', buttonOpacity: 'medium' });
    expect(r.settings).toEqual({ master: 8, effects: 10, language: 'en', buttonOpacity: 'medium' }); // Right at 10 stays 10, then two Lefts
    const s = titleFrame(TITLE, ['menuDown', 'menuDown', 'pick', 'menuDown', 'menuLeft'], 0, { master: 9, effects: 10, language: 'en', buttonOpacity: 'medium' });
    expect(s.settings).toEqual({ master: 9, effects: 9, language: 'en', buttonOpacity: 'medium' });
    expect(s.state.settings).toBe('effects');
    const t = titleFrame(OPEN, [tap({ settings: { row: 'effects', side: 'left' } })], 0, { master: 3, effects: 4, language: 'en', buttonOpacity: 'medium' });
    expect(t).toMatchObject({ settings: { master: 3, effects: 3, language: 'en', buttonOpacity: 'medium' }, state: { settings: 'effects' } });
    const u = titleFrame(TITLE, ['menuDown', 'menuDown', 'pick', 'menuRight'], 0, { master: 9, effects: 10, language: 'en', buttonOpacity: 'medium' });
    expect(u.settings).toEqual({ master: 10, effects: 10, language: 'en', buttonOpacity: 'medium' });
  });

  it('upright, nothing is chosen or picked; sideways again the choice is kept', () => {
    expect(frame(UPRIGHT, ['menuDown']).choice).toBe('start');
    expect(frame(UPRIGHT, ['menuDown', 'menuDown', 'pick'])).toMatchObject({ choice: 'start', settings: null, shown: true });
    expect(frame(CHOSEN, ['portrait'])).toMatchObject({ choice: 'settings', portrait: true });
    expect(frame(frame(CHOSEN, ['portrait']), ['menuUp']).choice).toBe('settings');
    expect(frame(CHOSEN, ['portrait', 'landscape']).choice).toBe('settings');
    const upright = frame(CHOSEN, ['portrait']);
    expect(frame(upright, ['landscape', 'pick'])).toMatchObject({ settings: 'master' });
    // Upright, the settings screen takes nothing either.
    const screenUp = frame(OPEN, ['portrait']);
    expect(screenUp).toMatchObject({ settings: 'master', portrait: true });
    expect(titleFrame(screenUp, ['menuDown', 'menuLeft', 'key'], 0, { master: 5, effects: 5, language: 'en', buttonOpacity: 'medium' })).toEqual({ state: screenUp, settings: { master: 5, effects: 5, language: 'en', buttonOpacity: 'medium' }, start: null });
    expect(frame(screenUp, ['landscape', 'menuDown'])).toMatchObject({ settings: 'effects', portrait: false });
  });

  it('a pick of Settings just before a turn upright opens it, hidden until sideways', () => {
    expect(frame(TITLE, ['menuDown', 'menuDown', 'pick', 'portrait'])).toMatchObject({ settings: 'master', portrait: true, shown: true });
  });

  it('quitting to the title opens on Start with the settings screen closed', () => {
    expect(titleAfterQuit(false, 2, false)).toEqual({ shown: true, portrait: false, buttonsHeld: 2, choice: 'start', settings: null, hasContinue: false });
    expect(titleAfterQuit(true, 0, false)).toEqual({ shown: true, portrait: true, buttonsHeld: 0, choice: 'start', settings: null, hasContinue: false });
  });

  it('the title prompt is empty sideways and asks to turn upright', () => {
    expect(titlePrompt(false, 'Turn your device sideways')).toEqual({ text: '', size: 12 });
    expect(titlePrompt(true, 'Turn your device sideways')).toEqual({ text: 'Turn your device sideways', size: 12 });
    expect(titlePrompt(true, 'Gira tu dispositivo de lado').text).toBe('Gira tu dispositivo de lado');
  });
});

describe('GDD-UI-02 title screen after quitting from the pause menu', () => {
  it('a tap on a pause menu row place starts the level like any tap off the title rows', () => {
    expect(frame(TITLE, [tap({ pause: 'quit' })]).shown).toBe(false);
  });

  it('up, down, left, right and pick on Settings do not start the level', () => {
    expect(frame(TITLE, ['menuUp', 'menuDown', 'menuDown', 'menuLeft', 'menuRight', 'pick']).shown).toBe(true);
  });

  it('after a quit the title waits for a new press: the button that picked counts as held', () => {
    const quit = titleAfterQuit(false, 2, false);
    expect(frame(quit, [], 2).shown).toBe(true);
    expect(frame(frame(quit, [], 0), [], 2).shown).toBe(false);
  });

  it('after a quit upright, nothing starts until sideways', () => {
    const quit = titleAfterQuit(true, 0, false);
    expect(frame(quit, [TAP_OFF]).shown).toBe(true);
  });
});

describe('GDD-CTL-02 the gamepad on the title screen', () => {
  it('start starts the level whichever row is chosen', () => {
    expect(titleFrame(TITLE, ['start'], 0).state.shown).toBe(false);
    expect(titleFrame(TITLE, ['menuDown', 'start'], 0).state.shown).toBe(false);
    expect(titleFrame(TITLE, ['menuDown', 'start'], 0).start).toBe('start');
  });

  it("start on the title's settings screen leaves it and does not start", () => {
    const one = titleFrame(TITLE, ['menuDown', 'menuDown', 'pick', 'start'], 0).state;
    expect(one.shown).toBe(true);
    expect(one.settings).toBeNull();
    expect(one.choice).toBe('settings');
    const opened = titleFrame(TITLE, ['menuDown', 'menuDown', 'pick'], 0).state;
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

describe('GDD-UI-02 Continue', () => {
  const WITH = titleOpen(true);
  const DOWN1 = frame(WITH, ['menuDown']);
  const DOWN3 = frame(WITH, ['menuDown', 'menuDown', 'menuDown']);

  it('GDD-UI-02 Continue: with a saved run the title opens on Continue, without one on Start', () => {
    expect(WITH).toEqual({ shown: true, portrait: false, buttonsHeld: 0, choice: 'continue', settings: null, hasContinue: true });
    expect(titleOpen(false)).toEqual(TITLE);
    expect(titleAfterQuit(false, 2, true)).toEqual({ ...WITH, buttonsHeld: 2 });
    expect(titleAfterQuit(true, 0, true)).toEqual({ ...WITH, portrait: true });
  });

  it('GDD-UI-02 Continue: Up from Continue stays, Down goes Start, Tutorial, Settings and stays there', () => {
    expect(frame(WITH, ['menuUp']).choice).toBe('continue');
    expect(frame(WITH, ['menuDown']).choice).toBe('start');
    expect(frame(WITH, ['menuDown', 'menuDown']).choice).toBe('tutorial');
    expect(DOWN3.choice).toBe('settings');
    expect(frame(DOWN3, ['menuDown']).choice).toBe('settings');
    expect(frame(DOWN3, ['menuUp']).choice).toBe('tutorial');
    expect(frame(DOWN3, ['menuUp', 'menuUp', 'menuUp']).choice).toBe('continue');
    expect(frame(DOWN3, ['menuUp', 'menuUp', 'menuUp', 'menuUp']).choice).toBe('continue');
    expect(frame(DOWN1, ['menuUp']).choice).toBe('continue');
    expect(frame(WITH, ['menuDown']).shown).toBe(true); // choosing starts nothing
  });

  it('GDD-UI-02 Continue: without a saved run Up from Start stays and Continue cannot be chosen', () => {
    expect(frame(TITLE, ['menuUp']).choice).toBe('start');
    expect(frame(TITLE, ['menuUp', 'menuUp', 'menuUp']).choice).toBe('start');
    expect(frame(TUTORIAL, ['menuUp', 'menuUp', 'menuUp']).choice).toBe('start');
    expect(frame(CHOSEN, ['menuUp', 'menuUp', 'menuUp', 'menuUp']).choice).toBe('start');
  });

  it('GDD-UI-02 Continue: picking Continue starts with Continue', () => {
    const r = titleFrame(WITH, ['pick'], 0);
    expect(r.state.shown).toBe(false);
    expect(r.start).toBe('continue');
    // Start and Tutorial still start what they start, with a saved run.
    expect(startOf(WITH, ['menuDown', 'pick'])).toBe('start');
    expect(startOf(WITH, ['menuDown', 'menuDown', 'pick'])).toBe('tutorial');
    expect(startOf(WITH, ['menuDown', 'menuUp', 'pick'])).toBe('continue');
  });

  it('GDD-UI-02 Continue: a tap on the Continue row starts with Continue, a tap on the Start row with Start', () => {
    expect(startOf(WITH, [tap({ title: 'continue' })])).toBe('continue');
    expect(startOf(DOWN3, [tap({ title: 'continue' })])).toBe('continue');
    expect(startOf(WITH, [tap({ title: 'start' })])).toBe('start');
    expect(startOf(WITH, [tap({ title: 'tutorial' })])).toBe('tutorial');
    expect(frame(WITH, [tap({ title: 'settings' })])).toMatchObject({ shown: true, settings: 'master' });
  });

  it('GDD-UI-02 Continue: claw, Fuego, Left, Right and an off-row tap start with Start, whichever row is chosen', () => {
    for (const bit of [2, 4, 8, 16]) expect(startOf(WITH, [], bit), `bit ${bit}`).toBe('start');
    expect(startOf(WITH, [TAP_OFF])).toBe('start');
    expect(startOf(WITH, ['button'])).toBe('start');
    expect(startOf(WITH, ['start'])).toBe('start');
    expect(startOf(WITH, [tap({ pause: 'quit' })])).toBe('start');
    // A pick wins over a game button in the same frame, as for the other rows.
    expect(startOf(WITH, ['pick'], 8)).toBe('continue');
  });

  it('GDD-UI-02 Continue: the settings screen comes back to the title with Settings chosen and Continue still there', () => {
    const open = frame(DOWN3, ['pick']);
    expect(open).toMatchObject({ settings: 'master', hasContinue: true });
    expect(frame(open, ['key'])).toEqual({ ...WITH, choice: 'settings' });
    expect(frame(frame(open, ['key']), ['menuUp', 'menuUp', 'menuUp']).choice).toBe('continue');
  });

  it('GDD-UI-02 Continue: upright nothing is chosen or picked, sideways again Continue is still chosen', () => {
    const up = frame(WITH, ['portrait']);
    expect(frame(up, ['menuDown', 'pick'])).toMatchObject({ choice: 'continue', shown: true });
    expect(startOf(up, ['pick', 'landscape'])).toBeNull();
    expect(startOf(up, ['landscape', 'pick'])).toBe('continue');
    expect(startOf(up, [tap({ title: 'continue' }), 'landscape'])).toBe('start'); // upright a tap is only a start press
  });
});

describe('GDD-UI-02 Poncho beside the title', () => {
  it('GDD-UI-02 titlePonchoX puts the right edge of the sprite 8 px left of the wider line', () => {
    // 40 px wide: the middle is 20 + 8 = 28 px left of the line's left edge.
    expect(titlePonchoX(182, 40)).toBe(154);
    expect(titlePonchoX(100, 40)).toBe(72);
    expect(titlePonchoX(182, 20)).toBe(164);
  });

  it('GDD-UI-02 his feet are level with the bottom of "Siete Vidas", 104 px from the top, 8 px from the line', () => {
    expect(TITLE_PONCHO).toEqual({ feetY: 104, gap: 8 });
  });
});
