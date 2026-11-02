import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt, red, start } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const ticks = (page: Page) => api(page, () => window.__PONCHO__!.ticks());
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
const settingsDrawn = (page: Page) => api(page, () => window.__PONCHO__!.settingsDrawn());
const settings = (page: Page) => api(page, () => window.__PONCHO__!.settings());
const sfxPlayed = (page: Page) => api(page, () => window.__PONCHO__!.sfxPlayed());
const PALE = '#fff3dc';
const GREY = '#9ba3c4';
const SAVE_KEY = 'poncho-siete-vidas';

/** A bare browser key event, like the pause specs, so the phone project takes the same path as the desktop one. */
const KEYS = {
  Escape: 27,
  Enter: 13,
  Space: 32,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
} as const;
async function press(page: Page, code: keyof typeof KEYS): Promise<void> {
  await page.evaluate(([c, k]) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true })), [code, KEYS[code]] as const);
}
const started = async (page: Page) => {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  return errors;
};
/** Pauses with Escape, chooses Settings and opens it. */
async function openFromPause(page: Page): Promise<void> {
  await press(page, 'Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await press(page, 'ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
}
/** Moves to a row of the open settings screen with Down and waits for it. */
async function chooseRow(page: Page, row: 'effects' | 'buttonOpacity' | 'layout' | 'back'): Promise<void> {
  const path = {
    effects: ['effects'],
    buttonOpacity: ['effects', 'language', 'buttonOpacity'],
    layout: ['effects', 'language', 'buttonOpacity', 'layout'],
    back: ['effects', 'language', 'buttonOpacity', 'layout', 'back'],
  } as const;
  for (const want of path[row]) {
    await press(page, 'ArrowDown');
    await page.waitForFunction((r) => window.__PONCHO__!.settingsDrawn().chosen === r, want);
  }
}
/** Presses Left or Right and waits for the volume to be `value`. */
async function change(page: Page, key: 'ArrowLeft' | 'ArrowRight', row: 'master' | 'effects', value: number): Promise<void> {
  await press(page, key);
  await page.waitForFunction(([r, v]) => window.__PONCHO__!.settings()[r] === v, [row, value] as const);
}

// ---- Touch helpers ----
async function tapButton(page: Page, id: string): Promise<void> {
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
  await tapVirtual(page, b.x + b.w / 2, b.y + b.h / 2);
}
async function tapVirtual(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await page.touchscreen.tap(box.x + x * k, box.y + y * k);
}
/** Real touch events through the browser, so a finger can stay down across frames (L-032). Virtual px in. */
async function touchAt(page: Page, cdp: CDPSession, type: 'touchStart' | 'touchEnd', points: { x: number; y: number; id: number }[]): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' ? points.map((p) => ({ id: p.id, x: box.x + p.x * k, y: box.y + p.y * k })) : [] });
}
async function stickMode(page: Page, cdp: CDPSession): Promise<void> {
  const sw = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((b) => b.id === 'mode')!;
  await touchAt(page, cdp, 'touchStart', [{ x: sw.x + sw.w / 2, y: sw.y + sw.h / 2, id: 9 }]);
  await touchAt(page, cdp, 'touchEnd', []);
  await page.waitForFunction(() => window.__PONCHO__!.touch().mode === 'stick');
}
const settingsRow = async (page: Page, item: 'master' | 'effects' | 'language' | 'buttonOpacity' | 'layout' | 'back') => (await api(page, () => window.__PONCHO__!.settingsMenu())).find((r) => r.item === item)!;
/** Taps the left or right half of a settings row, in its vertical middle. */
async function tapHalf(page: Page, item: 'master' | 'effects' | 'language' | 'buttonOpacity' | 'layout' | 'back', side: 'left' | 'right'): Promise<void> {
  const r = await settingsRow(page, item);
  await tapVirtual(page, r.x + r.w * (side === 'left' ? 0.25 : 0.75), r.y + r.h / 2);
}
/** Taps the Settings row of the pause menu. */
async function tapPauseSettings(page: Page): Promise<void> {
  const r = (await api(page, () => window.__PONCHO__!.pauseMenu())).find((x) => x.item === 'settings')!;
  await tapVirtual(page, r.x + r.w / 2, r.y + r.h / 2);
}

test('GDD-UI-02 Settings from the pause menu: Down, Enter opens it on Master volume; Escape comes back with Settings chosen', async ({ page }) => {
  await started(page);
  await openFromPause(page);
  const rows = await api(page, () => window.__PONCHO__!.settingsMenu());
  expect(await settingsDrawn(page)).toEqual({
    shown: true,
    title: 'Settings',
    prompt: '',
    from: 'pause',
    rows: [
      { item: 'master', label: 'Master volume', value: 10, color: PALE },
      { item: 'effects', label: 'Effects volume', value: 10, color: GREY },
      { item: 'language', label: 'Language', value: 'English', color: GREY, valueX: 316 },
      { item: 'buttonOpacity', label: 'Button opacity', value: 'Medium', color: GREY, valueX: 316 },
      { item: 'layout', label: 'Layout', value: 'Standard', color: GREY, valueX: 316 },
      { item: 'back', label: 'Back', value: null, color: GREY },
    ],
    chosen: 'master',
  });
  expect(rows.map((r) => [r.item, r.x, r.y, r.w])).toEqual([['master', 110, 62, 260], ['effects', 110, expect.any(Number), 260], ['language', 110, expect.any(Number), 260], ['buttonOpacity', 110, expect.any(Number), 260], ['layout', 110, expect.any(Number), 260], ['back', 110, expect.any(Number), 260]]);
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).shown).toBe(false); // it replaces the pause screen
  await press(page, 'Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.pauseDrawn())).toMatchObject({ shown: true, menu: { chosen: 'settings' } });
  expect((await api(page, () => window.__PONCHO__!.playerPause())).paused).toBe(true);
  await press(page, 'Escape'); // a second Escape resumes
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
});

test('GDD-UI-02 Left and Right change the volume and the sound effects play at Master times Effects', async ({ page, isMobile }) => {
  await started(page);
  await openFromPause(page);
  expect(await sfxPlayed(page)).toEqual([]);
  await change(page, 'ArrowLeft', 'master', 9);
  await change(page, 'ArrowLeft', 'master', 8);
  await chooseRow(page, 'effects');
  for (const v of [9, 8, 7, 6, 5]) await change(page, 'ArrowLeft', 'effects', v);
  expect(await settingsDrawn(page)).toMatchObject({ rows: [{ value: 8, color: GREY }, { value: 5, color: PALE }, { value: 'English' }, { value: 'Medium' }, { value: 'Standard' }, { value: null }], chosen: 'effects' });
  // One jump sound after each of the seven changes, at the volume it changed to.
  const played = await sfxPlayed(page);
  expect(played).toHaveLength(7);
  const want = [0.9, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4];
  played.forEach((p, i) => {
    expect(p.key).toBe('sfx-jump');
    expect(p.volume).toBeCloseTo(want[i]!, 10);
  });
  expect(await api(page, () => window.__PONCHO__!.sfx())).toEqual(Array(7).fill('jump'));
  // Back to the level, and a real jump plays at the same volume.
  await press(page, 'Escape');
  await press(page, 'Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await frames(page);
  if (isMobile) await tapButton(page, 'jump');
  else await page.keyboard.press('Space', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.sfxPlayed().length === 8);
  expect((await sfxPlayed(page))[7]).toMatchObject({ key: 'sfx-jump', rate: 1 });
  expect((await sfxPlayed(page))[7]!.volume).toBeCloseTo(0.4, 10);
});

test('GDD-UI-02 a volume at its end plays and saves nothing', async ({ page }) => {
  await started(page);
  await openFromPause(page);
  await press(page, 'ArrowRight'); // master is at 10 already
  await frames(page);
  await frames(page);
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'standard' });
  expect(await sfxPlayed(page)).toEqual([]);
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();
  // The Left after it moves the volume, so the quiet above was the clamp and not a missed key.
  await change(page, 'ArrowLeft', 'master', 9);
  expect(await sfxPlayed(page)).toHaveLength(1);
  // At 0, Left changes nothing either.
  for (let v = 8; v >= 0; v--) await change(page, 'ArrowLeft', 'master', v);
  const n = (await sfxPlayed(page)).length;
  await press(page, 'ArrowLeft');
  await frames(page);
  await frames(page);
  expect(await sfxPlayed(page)).toHaveLength(n);
  expect(await settings(page)).toEqual({ master: 0, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'standard' });
});

test('GDD-PRG-02 the settings are kept after a reload', async ({ page }) => {
  await started(page);
  await openFromPause(page);
  for (const v of [9, 8, 7]) await change(page, 'ArrowLeft', 'master', v);
  // The fields this rule is about, not the whole saved text, which grows with each part the save gets (L-054).
  const saved: unknown = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY))!);
  expect(saved).toMatchObject({ version: 1, settings: { master: 7, effects: 10, language: 'en' } });
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  expect(await settings(page)).toEqual({ master: 7, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'standard' });
  // The bars show it too: open the screen from the title.
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  expect(await settingsDrawn(page)).toMatchObject({ from: 'title', rows: [{ value: 7 }, { value: 10 }, { value: 'English' }, { value: 'Medium' }, { value: 'Standard' }, { value: null }] });
});

// ---- GDD-UI-02, GDD-CTL-03: the Button opacity row ----
const opacityRow = async (page: Page) => (await settingsDrawn(page)).rows.find((r) => r.item === 'buttonOpacity')!;
/** Waits for the Button opacity row to read `name`, with the touch controls drawn at `step` in the same frame (L-033). */
const opacityIs = (page: Page, name: string, step: string) =>
  page.waitForFunction(([n, o]) => window.__PONCHO__!.settingsDrawn().rows.find((r) => r.item === 'buttonOpacity')?.value === n && window.__PONCHO__!.touch().opacity === o, [name, step] as const);
const savedSettings = async (page: Page): Promise<unknown> => {
  const saved: { settings: unknown } = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY))!);
  return saved.settings;
};

test('GDD-UI-02 Button opacity: Right and Left step it, it is saved, and the touch buttons change', async ({ page, isMobile }) => {
  await started(page);
  await openFromPause(page);
  for (const want of ['effects', 'language', 'buttonOpacity'] as const) {
    await press(page, 'ArrowDown');
    await page.waitForFunction((r) => window.__PONCHO__!.settingsDrawn().chosen === r, want);
  }
  expect(await opacityRow(page)).toMatchObject({ label: 'Button opacity', value: 'Medium', color: PALE });
  // Every alpha the buttons were drawn with at Medium: the other steps scale each one, capped at 1 (GDD-CTL-03).
  const medium = (await api(page, () => window.__PONCHO__!.touch())).styleAlphas;
  const scaled = async (factor: number) => {
    const drawn = (await api(page, () => window.__PONCHO__!.touch())).styleAlphas;
    expect(drawn).toHaveLength(medium.length);
    drawn.forEach((a, i) => expect(a).toBeCloseTo(Math.min(1, medium[i]! * factor), 10));
  };
  if (isMobile) expect(medium.length).toBeGreaterThan(0);
  const sfxBefore = (await api(page, () => window.__PONCHO__!.sfx())).length;
  await press(page, 'ArrowRight');
  await opacityIs(page, 'High', 'high');
  expect(await savedSettings(page)).toMatchObject({ buttonOpacity: 'high' });
  if (isMobile) expect((await api(page, () => window.__PONCHO__!.touch())).alphas.idleOutline).toBeCloseTo(0.525, 10);
  if (isMobile) await scaled(1.5);
  await press(page, 'ArrowLeft');
  await opacityIs(page, 'Medium', 'medium');
  await press(page, 'ArrowLeft');
  await opacityIs(page, 'Low', 'low');
  expect(await savedSettings(page)).toMatchObject({ buttonOpacity: 'low' });
  if (isMobile) expect((await api(page, () => window.__PONCHO__!.touch())).alphas.idleOutline).toBeCloseTo(0.175, 10);
  if (isMobile) await scaled(0.5);
  // At Low, one more Left changes nothing; the Right after it does, so the quiet was the end and not a missed key.
  await press(page, 'ArrowLeft');
  await frames(page);
  await frames(page);
  await opacityIs(page, 'Low', 'low');
  await press(page, 'ArrowRight');
  await opacityIs(page, 'Medium', 'medium');
  expect(await api(page, () => window.__PONCHO__!.sfx())).toHaveLength(sfxBefore); // no change plays a sound
});

test('GDD-CTL-03 Button opacity scales the slide stick and the Fuego button too', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  // The stick and the Fuego button are drawn only in stick mode and in Fuego: start in stick mode, then give Poncho Fuego.
  await page.addInitScript(() => localStorage.setItem('poncho.touchMode', 'stick'));
  await started(page);
  await api(page, () => window.__PONCHO__!.setPower('fuego'));
  await page.waitForFunction(() => {
    const ids = window.__PONCHO__!.touch().buttons.map((b) => b.id);
    return ids.includes('stick') && ids.includes('fuego');
  });
  await openFromPause(page);
  const medium = (await api(page, () => window.__PONCHO__!.touch())).styleAlphas;
  expect(medium.length).toBeGreaterThan(0);
  const scaled = async (factor: number) => {
    const drawn = (await api(page, () => window.__PONCHO__!.touch())).styleAlphas;
    expect(drawn).toHaveLength(medium.length);
    drawn.forEach((a, i) => expect(a).toBeCloseTo(Math.min(1, medium[i]! * factor), 10));
  };
  for (const want of ['effects', 'language', 'buttonOpacity'] as const) {
    await press(page, 'ArrowDown');
    await page.waitForFunction((r) => window.__PONCHO__!.settingsDrawn().chosen === r, want);
  }
  await press(page, 'ArrowRight');
  await opacityIs(page, 'High', 'high');
  await scaled(1.5);
  await press(page, 'ArrowLeft');
  await opacityIs(page, 'Medium', 'medium');
  await press(page, 'ArrowLeft');
  await opacityIs(page, 'Low', 'low');
  await scaled(0.5);
});

test("GDD-UI-02 on touch, tapping Button opacity's halves steps it down and up", async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await tapPauseSettings(page);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await tapHalf(page, 'buttonOpacity', 'left');
  await opacityIs(page, 'Low', 'low');
  expect(await settingsDrawn(page)).toMatchObject({ chosen: 'buttonOpacity' }); // a tap on the row chooses it
  await tapHalf(page, 'buttonOpacity', 'right');
  await opacityIs(page, 'Medium', 'medium');
  await tapHalf(page, 'buttonOpacity', 'right');
  await opacityIs(page, 'High', 'high');
  expect(await savedSettings(page)).toMatchObject({ buttonOpacity: 'high' });
});

test('GDD-PRG-02 Button opacity is kept after a reload', async ({ page }) => {
  await started(page);
  await openFromPause(page);
  await chooseRow(page, 'buttonOpacity');
  await press(page, 'ArrowRight');
  await opacityIs(page, 'High', 'high');
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  expect(await settings(page)).toMatchObject({ buttonOpacity: 'high' });
  await page.waitForFunction(() => window.__PONCHO__!.touch().opacity === 'high');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  expect(await opacityRow(page)).toMatchObject({ value: 'High' });
});

// ---- GDD-UI-02, GDD-CTL-03: the Layout row ----
const layoutRow = async (page: Page) => (await settingsDrawn(page)).rows.find((r) => r.item === 'layout')!;
/** Waits for the Layout row to read `name`, with the touch controls laid out as `layout` in the same frame (L-033). */
const layoutIs = (page: Page, name: string, layout: string) =>
  page.waitForFunction(([n, l]) => window.__PONCHO__!.settingsDrawn().rows.find((r) => r.item === 'layout')?.value === n && window.__PONCHO__!.touch().layout === l, [name, layout] as const);
const touchState = (page: Page) => api(page, () => window.__PONCHO__!.touch());
const buttonOf = async (page: Page, id: string) => (await touchState(page)).buttons.find((b) => b.id === id)!;
/** A save with the Layout mirrored (and the rest as the defaults), put in the storage before the page loads. */
const seedMirrored = (page: Page) =>
  page.addInitScript(
    ([key]) => localStorage.setItem(key!, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'mirrored' }, progress: { tutorialPlayed: false } })),
    [SAVE_KEY],
  );
const MARGIN = 6; // TOUCH.margin: a button's distance from the screen's edge (GDD-CTL-03)

test('GDD-UI-02 Layout: Right and Left step it, it is saved, and the touch buttons move', async ({ page, isMobile }) => {
  await started(page);
  await openFromPause(page);
  await chooseRow(page, 'layout');
  expect(await layoutRow(page)).toMatchObject({ label: 'Layout', value: 'Standard', color: PALE });
  const sfxBefore = (await api(page, () => window.__PONCHO__!.sfx())).length;
  const standard = (await touchState(page)).buttons;
  if (isMobile) {
    const jump = standard.find((b) => b.id === 'jump')!;
    expect(jump.x + jump.w).toBe(480 - MARGIN);
  }
  await press(page, 'ArrowRight');
  await layoutIs(page, 'Mirrored', 'mirrored');
  expect(await savedSettings(page)).toMatchObject({ layout: 'mirrored' });
  if (isMobile) {
    // The buttons drawn over the settings screen have moved as the step was picked; pause has not.
    const mirrored = (await touchState(page)).buttons;
    expect(mirrored.find((b) => b.id === 'jump')!.x).toBe(MARGIN);
    expect(mirrored.find((b) => b.id === 'pause')).toEqual(standard.find((b) => b.id === 'pause'));
  } else {
    // A device without touch has no touch buttons, in either layout (GDD-CTL-03: they show only on devices that report touch).
    expect(standard).toEqual([]);
    expect(await touchState(page)).toMatchObject({ buttons: [], visible: false });
  }
  // At Mirrored, one more Right changes nothing; the Left after it does, so the quiet was the end and not a missed key.
  await press(page, 'ArrowRight');
  await frames(page);
  await frames(page);
  await layoutIs(page, 'Mirrored', 'mirrored');
  await press(page, 'ArrowLeft');
  await layoutIs(page, 'Standard', 'standard');
  expect(await savedSettings(page)).toMatchObject({ layout: 'standard' });
  if (isMobile) {
    const jump = await buttonOf(page, 'jump');
    expect(jump.x + jump.w).toBe(480 - MARGIN);
  }
  await press(page, 'ArrowLeft');
  await frames(page);
  await frames(page);
  await layoutIs(page, 'Standard', 'standard');
  expect(await api(page, () => window.__PONCHO__!.sfx())).toHaveLength(sfxBefore); // no change plays a sound
  // Enter on the row does nothing.
  await press(page, 'Enter');
  await frames(page);
  await frames(page);
  expect(await settingsDrawn(page)).toMatchObject({ shown: true, chosen: 'layout' });
});

test("GDD-UI-02 on touch, tapping Layout's halves steps it down and up", async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await tapPauseSettings(page);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await tapHalf(page, 'layout', 'left');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().chosen === 'layout'); // a tap on the row chooses it
  await frames(page);
  await layoutIs(page, 'Standard', 'standard'); // and at Standard the left half changes nothing
  await tapHalf(page, 'layout', 'right');
  await layoutIs(page, 'Mirrored', 'mirrored');
  expect(await savedSettings(page)).toMatchObject({ layout: 'mirrored' });
  await tapHalf(page, 'layout', 'left');
  await layoutIs(page, 'Standard', 'standard');
  expect(await savedSettings(page)).toMatchObject({ layout: 'standard' });
});

test('GDD-PRG-02 Layout is kept after a reload', async ({ page }) => {
  await started(page);
  await openFromPause(page);
  await chooseRow(page, 'layout');
  await press(page, 'ArrowRight');
  await layoutIs(page, 'Mirrored', 'mirrored');
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  expect(await settings(page)).toMatchObject({ layout: 'mirrored' });
  await page.waitForFunction(() => window.__PONCHO__!.touch().layout === 'mirrored');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  expect(await layoutRow(page)).toMatchObject({ value: 'Mirrored' });
});

test('GDD-PRG-02 something unreadable in the storage opens the game with the defaults', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '{"version":1,"settings":{"master":4,"effects":99}}'), SAVE_KEY);
  await openGame(page);
  expect(await settings(page)).toEqual({ master: 4, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'standard' });
});

test('GDD-PRG-02 with storage refused the game plays with defaults and no error', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('storage refused');
    };
    Storage.prototype.setItem = () => {
      throw new Error('storage refused');
    };
  });
  const errors = await boot(page);
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'standard' });
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await openFromPause(page);
  await change(page, 'ArrowLeft', 'master', 9); // this visit's settings still work
  await page.waitForFunction(() => window.__PONCHO__!.sfxPlayed().length === 1);
  await frames(page);
  expect(errors).toEqual([]);
});

test('GDD-UI-02 on touch, tapping a volume row\'s halves lowers and raises it, and Back leaves', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await tapPauseSettings(page);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await tapHalf(page, 'master', 'left');
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 9);
  await tapHalf(page, 'master', 'left');
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 8);
  await tapHalf(page, 'master', 'right');
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 9);
  // A tap on another volume row chooses it.
  await tapHalf(page, 'effects', 'left');
  await page.waitForFunction(() => window.__PONCHO__!.settings().effects === 9);
  expect(await settingsDrawn(page)).toMatchObject({ chosen: 'effects', rows: [{ value: 9 }, { value: 9 }, { value: 'English' }, { value: 'Medium' }, { value: 'Standard' }, { value: null }] });
  await tapHalf(page, 'back', 'right');
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.pauseDrawn())).toMatchObject({ shown: true, menu: { chosen: 'settings' } });
  expect((await api(page, () => window.__PONCHO__!.playerPause())).paused).toBe(true);
});

test('GDD-UI-02 a tap off the rows on the settings screen does nothing', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await tapPauseSettings(page);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await tapVirtual(page, 60, 120);
  await tapVirtual(page, 420, 120);
  await frames(page);
  await page.waitForTimeout(200);
  expect(await settingsDrawn(page)).toMatchObject({ shown: true, from: 'pause', chosen: 'master' });
  expect((await api(page, () => window.__PONCHO__!.playerPause()))).toMatchObject({ paused: true, settings: 'master' });
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'standard' });
});

test('GDD-UI-02 a finger pressed on the settings screen is held back after the resume', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  const cdp = await page.context().newCDPSession(page);
  await stickMode(page, cdp);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await tapPauseSettings(page);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  const x0 = (await api(page, () => window.__PONCHO__!.state())).x;
  // On the Button opacity row's left half, inside the lower left quarter the slide stick reads (x < 240, y >= 135 on the phone's rows;
  // the Effects row, which this test used before the fifth row, lies above it).
  const row = await settingsRow(page, 'buttonOpacity');
  expect(row.y).toBeGreaterThanOrEqual(135);
  await touchAt(page, cdp, 'touchStart', [{ x: 150, y: row.y + row.h / 2, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.settings().buttonOpacity === 'low'); // it was a tap on the row
  await press(page, 'Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  await press(page, 'Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBe(x0); // 20 steps with the finger down, none moved him
  expect((await api(page, () => window.__PONCHO__!.touch())).stick).toBe(0);
  await touchAt(page, cdp, 'touchEnd', []);
});

test('GDD-UI-02 Settings from the title: Down, Enter opens it, Left does not start the level, Back returns with Settings chosen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await press(page, 'ArrowDown'); // Start, Tutorial, Settings: two Downs
  await press(page, 'ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  expect(await settingsDrawn(page)).toMatchObject({ from: 'title', chosen: 'master', rows: [{ value: 10 }, { value: 10 }, { value: 'English' }, { value: 'Medium' }, { value: 'Standard' }, { value: null }] });
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false); // it replaces the title screen
  await page.keyboard.press('ArrowLeft'); // the game's Left button, which starts nothing here
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 9);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 10);
  await page.keyboard.press('KeyX'); // nor does claw
  await page.waitForTimeout(250);
  expect(await ticks(page)).toBe(0);
  expect((await settingsDrawn(page)).shown).toBe(true);
  // Back with Left held since the settings screen: no start. A new press of Left then does.
  await chooseRow(page, 'back');
  await page.keyboard.down('ArrowLeft');
  await frames(page); // a frame on the settings screen sees it held
  await frames(page);
  await press(page, 'Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ shown: true, menu: { chosen: 'settings' } });
  await page.waitForTimeout(250);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  expect(await ticks(page)).toBe(0);
  await page.keyboard.up('ArrowLeft');
  await frames(page);
  await frames(page);
  await page.keyboard.press('ArrowLeft'); // a new press starts the level
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-UI-02 on touch, a tap on the title\'s Settings row opens settings and does not start the level', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await openGame(page);
  const before = (await api(page, () => window.__PONCHO__!.touch())).mode;
  const row = (await api(page, () => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'settings')!;
  // The row lies in the lower left quarter the slide stick reads (x 160 to 240, y above 135).
  expect(row.y).toBeGreaterThan(135);
  await tapVirtual(page, row.x + row.w / 2, row.y + row.h / 2);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await page.waitForTimeout(250);
  expect(await settingsDrawn(page)).toMatchObject({ from: 'title', chosen: 'master' });
  expect(await ticks(page)).toBe(0);
  // Back with a tap, then a finger held on the row across several frames.
  await tapHalf(page, 'back', 'left');
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ shown: true, menu: { chosen: 'settings' } });
  const cdp = await page.context().newCDPSession(page);
  await touchAt(page, cdp, 'touchStart', [{ x: 170, y: row.y + row.h / 2, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await page.waitForTimeout(300);
  expect(await ticks(page)).toBe(0);
  expect(await settingsDrawn(page)).toMatchObject({ shown: true, from: 'title' });
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe(before);
  await touchAt(page, cdp, 'touchEnd', []);
  await page.waitForTimeout(150);
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe(before);
  expect(await ticks(page)).toBe(0);
});

test('GDD-UI-02 on touch in slide-stick mode, a finger held on the title\'s Settings row steers nothing and the hidden buttons press nothing', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await page.addInitScript(() => localStorage.setItem('poncho.touchMode', 'stick')); // the choice the player saved (GDD-CTL-03)
  await openGame(page);
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe('stick');
  const row = (await api(page, () => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'settings')!;
  const cdp = await page.context().newCDPSession(page);
  // Inside the lower left quarter the stick reads (x < 240, y >= 135), at the far left of the Settings row, off the track's centre.
  await touchAt(page, cdp, 'touchStart', [{ x: row.x + 4, y: row.y + row.h / 2, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await page.waitForTimeout(300);
  expect(await api(page, () => window.__PONCHO__!.touch())).toMatchObject({ mode: 'stick', stick: 0, pressed: [] });
  expect(await ticks(page)).toBe(0);
  await touchAt(page, cdp, 'touchEnd', []);
});

// L-023: an overlay is checked for what it must dim and for what it must leave alone. The second life triangle on the HUD (x 21 to 31,
// y 8 to 17) is red in its fill; a floor tile right of the spawn, clear of the touch buttons and of the rows, is blue.
const hudTriangle = { x: 26, y: 14 };
const floorTile = { x: 120, y: 248 };
const brightness = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;

test('GDD-UI-02 opened from the pause menu the settings screen dims the level and lies under the HUD', async ({ page }) => {
  await started(page);
  await frames(page);
  const lit = (await pixelsAt(page, [floorTile, hudTriangle])) as { r: number; g: number; b: number }[];
  await openFromPause(page);
  await page.waitForTimeout(150);
  const [floor, hud] = await pixelsAt(page, [floorTile, hudTriangle]);
  expect(brightness(floor!)).toBeLessThan(brightness(lit[0]!) * 0.5);
  expect(red(hud!)).toBeGreaterThan(red(lit[1]!) * 0.9); // the HUD shows through unchanged
});

test('GDD-UI-02 opened from the title menu the settings screen covers the HUD too', async ({ page }) => {
  await openGame(page);
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await page.waitForTimeout(150);
  const [floor, hud] = await pixelsAt(page, [floorTile, hudTriangle]);
  expect(red(hud!)).toBeLessThan(50); // a lit HUD triangle is about 119 red
  expect(brightness(floor!)).toBeLessThan(250);
});

test('GDD-UI-02 a phone turned upright on the settings screen asks to turn sideways and keeps the chosen row', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await openFromPause(page);
  await chooseRow(page, 'effects');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().prompt === 'Turn your device sideways');
  expect(await settingsDrawn(page)).toMatchObject({ shown: true, rows: [], chosen: null });
  // Upright, a key and a tap on the old row place do nothing.
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowDown');
  await frames(page);
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en', buttonOpacity: 'medium', layout: 'standard' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().prompt === '' && window.__PONCHO__!.settingsDrawn().chosen !== null);
  expect(await settingsDrawn(page)).toMatchObject({ chosen: 'effects', from: 'pause' });
});

// ---- GDD-CTL-03: the mirrored layout in play ----
test('GDD-CTL-03 mirrored: the jump button on the left jumps and the left/right buttons on the right run', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seedMirrored(page);
  await start(page, true, '/?level=sandbox');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  const cdp = await page.context().newCDPSession(page);
  const right = await buttonOf(page, 'right');
  const jump = await buttonOf(page, 'jump');
  expect((await touchState(page)).layout).toBe('mirrored');
  expect(jump.x).toBe(MARGIN); // bottom-left
  expect(right.x).toBeGreaterThan(240); // bottom-right
  const x0 = (await api(page, () => window.__PONCHO__!.state())).x;
  await touchAt(page, cdp, 'touchStart', [{ x: right.x + right.w / 2, y: right.y + right.h / 2, id: 1 }]);
  await page.waitForFunction((x) => window.__PONCHO__!.state().x > x + 8, x0); // held for several frames, he runs right
  expect((await touchState(page)).pressed).toEqual(['right']);
  await touchAt(page, cdp, 'touchEnd', []);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await tapButton(page, 'jump');
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
});

test('GDD-CTL-03 mirrored slide stick steers from the lower right quarter, and a finger in the lower left does not', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seedMirrored(page);
  await page.addInitScript(() => localStorage.setItem('poncho.touchMode', 'stick'));
  await start(page, true, '/?level=sandbox');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  const cdp = await page.context().newCDPSession(page);
  const touch = await touchState(page);
  expect([touch.layout, touch.mode]).toEqual(['mirrored', 'stick']);
  const track = touch.buttons.find((b) => b.id === 'stick')!;
  expect(track.x + track.w / 2).toBeGreaterThan(240);
  // A finger at the track's right end steers right for several frames.
  const x0 = (await api(page, () => window.__PONCHO__!.state())).x;
  await touchAt(page, cdp, 'touchStart', [{ x: track.x + track.w - 2, y: track.y + track.h / 2, id: 1 }]);
  await page.waitForFunction((x) => window.__PONCHO__!.state().x > x + 8, x0);
  expect((await touchState(page)).stick).toBeGreaterThan(0);
  await touchAt(page, cdp, 'touchEnd', []);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0);
  // A finger in the lower left quarter, on no button, steers nothing.
  const spot = { x: 100, y: 220 };
  for (const b of touch.buttons) expect(spot.x >= b.x && spot.x < b.x + b.w && spot.y >= b.y && spot.y < b.y + b.h, `(100, 220) is on ${b.id}`).toBe(false);
  const x1 = (await api(page, () => window.__PONCHO__!.state())).x;
  await touchAt(page, cdp, 'touchStart', [{ ...spot, id: 1 }]);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBe(x1);
  expect((await touchState(page)).stick).toBe(0);
  await touchAt(page, cdp, 'touchEnd', []);
});

test('GDD-CTL-03 mirrored: a finger held on the Layout row, in the lower right quarter, steers nothing after Back and the resume', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seedMirrored(page);
  await page.addInitScript(() => localStorage.setItem('poncho.touchMode', 'stick'));
  await start(page, true, '/?level=sandbox');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  const cdp = await page.context().newCDPSession(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await tapPauseSettings(page);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  const x0 = (await api(page, () => window.__PONCHO__!.state())).x;
  // On the Layout row's right half, inside the lower right quarter the mirrored slide stick reads (x >= 240, y >= 135), far left of the
  // track's centre, so a stick that read it would steer left at full speed. Mirrored is the last step: the right half moves nothing.
  const row = await settingsRow(page, 'layout');
  const finger = { x: row.x + row.w * 0.75, y: row.y + row.h / 2 };
  expect(finger.x).toBeGreaterThanOrEqual(240);
  expect(finger.y).toBeGreaterThanOrEqual(135);
  await touchAt(page, cdp, 'touchStart', [{ ...finger, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().chosen === 'layout'); // it was a tap on the row
  expect(await settings(page)).toMatchObject({ layout: 'mirrored' });
  await press(page, 'Escape'); // Back to the pause menu
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  // The resume: a second finger on the pause button, the first still down.
  const pause = await buttonOf(page, 'pause');
  await touchAt(page, cdp, 'touchStart', [{ ...finger, id: 1 }, { x: pause.x + pause.w / 2, y: pause.y + pause.h / 2, id: 2 }]);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBe(x0); // 20 steps with the finger down, none moved him
  expect((await touchState(page)).stick).toBe(0);
  await touchAt(page, cdp, 'touchEnd', []);
});
