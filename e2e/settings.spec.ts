import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt, red } from './helpers';

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
async function chooseRow(page: Page, row: 'effects' | 'back'): Promise<void> {
  for (const want of row === 'back' ? (['effects', 'language', 'back'] as const) : (['effects'] as const)) {
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
const settingsRow = async (page: Page, item: 'master' | 'effects' | 'language' | 'back') => (await api(page, () => window.__PONCHO__!.settingsMenu())).find((r) => r.item === item)!;
/** Taps the left or right half of a settings row, in its vertical middle. */
async function tapHalf(page: Page, item: 'master' | 'effects' | 'language' | 'back', side: 'left' | 'right'): Promise<void> {
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
      { item: 'back', label: 'Back', value: null, color: GREY },
    ],
    chosen: 'master',
  });
  expect(rows.map((r) => [r.item, r.x, r.y, r.w])).toEqual([['master', 110, 96, 260], ['effects', 110, expect.any(Number), 260], ['language', 110, expect.any(Number), 260], ['back', 110, expect.any(Number), 260]]);
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
  expect(await settingsDrawn(page)).toMatchObject({ rows: [{ value: 8, color: GREY }, { value: 5, color: PALE }, { value: 'English' }, { value: null }], chosen: 'effects' });
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
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en' });
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
  expect(await settings(page)).toEqual({ master: 0, effects: 10, language: 'en' });
});

test('GDD-PRG-02 the settings are kept after a reload', async ({ page }) => {
  await started(page);
  await openFromPause(page);
  for (const v of [9, 8, 7]) await change(page, 'ArrowLeft', 'master', v);
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe('{"version":1,"settings":{"master":7,"effects":10,"language":"en"},"progress":{"tutorialPlayed":false},"levels":{},"run":null}');
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  expect(await settings(page)).toEqual({ master: 7, effects: 10, language: 'en' });
  // The bars show it too: open the screen from the title.
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  expect(await settingsDrawn(page)).toMatchObject({ from: 'title', rows: [{ value: 7 }, { value: 10 }, { value: 'English' }, { value: null }] });
});

test('GDD-PRG-02 something unreadable in the storage opens the game with the defaults', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '{"version":1,"settings":{"master":4,"effects":99}}'), SAVE_KEY);
  await openGame(page);
  expect(await settings(page)).toEqual({ master: 4, effects: 10, language: 'en' });
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
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en' });
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
  expect(await settingsDrawn(page)).toMatchObject({ chosen: 'effects', rows: [{ value: 9 }, { value: 9 }, { value: 'English' }, { value: null }] });
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
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en' });
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
  // On the Effects row's left half, inside the lower left quarter the slide stick reads (x < 240, y >= 135 on the phone's rows).
  const row = await settingsRow(page, 'effects');
  expect(row.y).toBeGreaterThanOrEqual(130);
  await touchAt(page, cdp, 'touchStart', [{ x: 150, y: row.y + row.h / 2, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.settings().effects === 9); // it was a tap on the row
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
  expect(await settingsDrawn(page)).toMatchObject({ from: 'title', chosen: 'master', rows: [{ value: 10 }, { value: 10 }, { value: 'English' }, { value: null }] });
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
  expect(await settings(page)).toEqual({ master: 10, effects: 10, language: 'en' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().prompt === '' && window.__PONCHO__!.settingsDrawn().chosen !== null);
  expect(await settingsDrawn(page)).toMatchObject({ chosen: 'effects', from: 'pause' });
});
