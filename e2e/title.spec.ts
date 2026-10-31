import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt, waitForResults } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const ticks = (page: Page) => api(page, () => window.__PONCHO__!.ticks());
const titleHidden = (page: Page) => page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
const titleShown = async (page: Page) => (await api(page, () => window.__PONCHO__!.titleDrawn())).shown;
const started = (page: Page) => page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
/** On the title, opens Settings (Down, Down, Enter), lowers Master twice to 8, and comes back with Start chosen. */
async function lowerMasterToEight(page: Page): Promise<void> {
  for (const key of ['ArrowDown', 'ArrowDown', 'Enter', 'ArrowLeft', 'ArrowLeft', 'Escape', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(key);
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 8 && window.__PONCHO__!.titleDrawn().menu.chosen === 'start');
}
/** Taps a touch button by its id, in the middle. */
async function tapButton(page: Page, id: string): Promise<void> {
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await page.touchscreen.tap(box.x + (b.x + b.w / 2) * k, box.y + (b.y + b.h / 2) * k);
}
/** The middle of the canvas, in CSS px. */
async function centre(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function tapCentre(page: Page, isMobile: boolean): Promise<void> {
  const c = await centre(page);
  if (isMobile) await page.touchscreen.tap(c.x, c.y);
  else await page.mouse.click(c.x, c.y);
}
const brightness = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
// A floor tile right of the spawn, clear of the touch buttons; the second life triangle on the HUD; and a solid blue pixel of the title Poncho's
// poncho (#3F66B1 in the user's drawing, GDD-ART-02): 13.25 px right of his x and 30.25 above his feet, which are at y = 152.
const floorTile = { x: 120, y: 248 };
const hudTriangle = { x: 26, y: 14 };
const titlePoncho = { x: 240 + 13.25, y: 152 - 30.25 };

test('GDD-UI-02 the game opens on the title screen with the level standing still', async ({ page, isMobile }) => {
  await openGame(page);
  const rows = await api(page, () => window.__PONCHO__!.titleMenu());
  const middle = (i: number) => rows[i]!.y + rows[i]!.h / 2;
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toEqual({
    shown: true,
    title: 'PONCHO',
    subtitle: 'Siete Vidas',
    prompt: '',
    promptSize: 12,
    ponchoShown: true,
    ponchoBottom: 152,
    menu: { shown: true, items: ['Start', 'Tutorial', 'Settings'], colors: ['#fff3dc', '#9ba3c4', '#9ba3c4'], chosen: 'start', markerY: middle(0) },
  });
  expect(rows.map((r) => r.item)).toEqual(['start', 'tutorial', 'settings']);
  expect(rows[0]).toMatchObject({ x: 160, y: 160, w: 160 });
  expect(await ticks(page)).toBe(0);
  await page.waitForTimeout(300);
  expect(await ticks(page)).toBe(0);
  expect((await api(page, () => window.__PONCHO__!.touch())).visible).toBe(false);
  await page.keyboard.press('Enter');
  // The buttons come back on the frame the title goes: read both in the same callback, so a frame of lag shows.
  const atClose = await (await page.waitForFunction(() => {
    const p = window.__PONCHO__!;
    return p.titleDrawn().shown ? false : { buttons: p.touch().visible };
  })).jsonValue();
  expect(atClose).toEqual({ buttons: isMobile });
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
});

test('GDD-UI-02 the veil dims the level and the HUD, and Poncho stands on it in his own colours', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(300);
  const [floorDim, hudDim, ponchoDim] = await pixelsAt(page, [floorTile, hudTriangle, titlePoncho]);
  await page.keyboard.press('Enter');
  await started(page);
  const [floorLit, hudLit] = await pixelsAt(page, [floorTile, hudTriangle]);
  expect(brightness(floorDim!)).toBeLessThan(brightness(floorLit!) * 0.5);
  expect(brightness(hudDim!)).toBeLessThan(brightness(hudLit!) * 0.5);
  expect(Math.abs(ponchoDim!.r - 0x3f) <= 24 && Math.abs(ponchoDim!.g - 0x66) <= 24 && Math.abs(ponchoDim!.b - 0xb1) <= 24, JSON.stringify(ponchoDim)).toBe(true);
});

// Space and Z pick Start; the others are game buttons (claw, Fuego, Left, Right) whose new press starts it. One test a key, each opening
// the game once, so a test stays well inside its time where the frames are slow.
for (const key of ['Space', 'KeyZ', 'Enter', 'ArrowLeft', 'ArrowRight', 'KeyX', 'KeyC', 'KeyA', 'KeyD', 'KeyJ', 'KeyK']) {
  test(`GDD-UI-02 the game key ${key} starts the level`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test');
    await openGame(page);
    await page.keyboard.press(key);
    await titleHidden(page);
  });
}

test('GDD-UI-02 Up and W choose, they do not start the level', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(300);
  expect(await titleShown(page)).toBe(true);
  expect(await ticks(page)).toBe(0);
  // Down chooses Tutorial and then Settings (no start), Up chooses them back.
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'tutorial');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  expect(await titleShown(page)).toBe(true);
  await page.keyboard.press('KeyS'); // no wrap-around
  await page.keyboard.press('KeyW');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'tutorial');
  await page.keyboard.press('KeyW');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'start');
  await page.keyboard.press('ArrowUp');
  expect(await titleShown(page)).toBe(true);
});

test('GDD-UI-02 a click or a tap anywhere starts the level', async ({ page, isMobile }) => {
  await openGame(page);
  await tapCentre(page, isMobile);
  await titleHidden(page);
});

test('GDD-UI-02 Escape, P and losing focus do nothing on the title screen, and the level starts unpaused', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyP');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(300);
  expect(await titleShown(page)).toBe(true);
  expect(await ticks(page)).toBe(0);
  await page.keyboard.press('Enter');
  await titleHidden(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: false, portrait: false, choice: 'resume', settings: null });
});

test('GDD-UI-02 the jump that starts the level, held, does not jump until pressed again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await page.keyboard.down('Space');
  await titleHidden(page);
  await page.waitForTimeout(400);
  for (let i = 0; i < 3; i++) {
    expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ grounded: true, vy: 0 });
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.__PONCHO__!.state().jumpWasHeld); // a step has seen the release (L-022)
  await page.keyboard.press('Space', { delay: 60 });
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
});

test("GDD-UI-02 the tap that starts the level on the Jump button's place does not jump", async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await openGame(page);
  await tapButton(page, 'jump');
  await titleHidden(page);
  await page.waitForTimeout(400);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ grounded: true, vy: 0 });
  await tapButton(page, 'jump'); // a new tap jumps
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
});

test('GDD-UI-02 a phone upright when the game opens is asked to turn sideways, and nothing starts until it is', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await page.setViewportSize({ width: 390, height: 844 }); // before the game opens: it starts in this state (L-023)
  await openGame(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === 'Turn your device sideways');
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ promptSize: 12, menu: { shown: false, chosen: null, markerY: null } });
  await tapCentre(page, true);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await titleShown(page)).toBe(true);
  expect(await ticks(page)).toBe(0);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === '' && window.__PONCHO__!.titleDrawn().menu.shown);
  await page.waitForTimeout(300);
  expect(await titleShown(page)).toBe(true); // turning sideways starts nothing
  await tapCentre(page, true);
  await titleHidden(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: false, portrait: false, choice: 'resume', settings: null });
});

test('GDD-UI-02 a phone turned upright on the title screen asks to turn sideways', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await openGame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === 'Turn your device sideways');
  await tapCentre(page, true);
  await page.waitForTimeout(300);
  expect(await titleShown(page)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === '' && window.__PONCHO__!.titleDrawn().menu.shown);
  await tapCentre(page, true);
  await titleHidden(page);
  expect((await api(page, () => window.__PONCHO__!.playerPause())).paused).toBe(false);
});

test('GDD-UI-02 a held touch on the hidden mode switch starts the level and leaves the touch mode alone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await openGame(page);
  const before = await api(page, () => window.__PONCHO__!.touch());
  const sw = before.buttons.find((b) => b.id === 'mode')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const at = { x: box.x + (sw.x + sw.w / 2) * k, y: box.y + (sw.y + sw.h / 2) * k, id: 1 };
  // A real finger held for several frames (a Playwright tap is shorter than a frame), lifted after the title has gone.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await titleHidden(page);
  await page.waitForTimeout(150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe(before.mode);
});

// ---- GDD-UI-02, GDD-PRG-02: the tutorial is played once, or picked from the title menu ----
const SAVE_KEY = 'poncho-siete-vidas';
const SEEDED = '{"version":1,"settings":{"master":10,"effects":10},"progress":{"tutorialPlayed":true}}';
/** Saves a game whose tutorial was started, before the page loads. */
const seedPlayed = (page: Page) => page.addInitScript(([key, text]) => localStorage.setItem(key!, text!), [SAVE_KEY, SEEDED]);
const level = (page: Page) => api(page, () => window.__PONCHO__!.level());
/** The tutorial flag in the saved game, or undefined where nothing is saved. */
const saved = async (page: Page): Promise<boolean | undefined> => {
  const text = await api(page, () => localStorage.getItem('poncho-siete-vidas'));
  if (text === null) return undefined;
  const data: { progress?: { tutorialPlayed?: boolean } } = JSON.parse(text);
  return data.progress?.tutorialPlayed;
};
/** Poncho's highest point (lowest y) over the next `n` frames. */
const topOver = (page: Page, n: number) =>
  page.evaluate((k) => new Promise<number>((r) => { let i = 0; let top = Infinity; const tick = () => { top = Math.min(top, window.__PONCHO__!.state().y); if (++i >= k) r(top); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), n);
/** Starts 0-1 with Enter, pauses and quits to the title through the pause menu (Down, Down, Enter). */
async function playTutorialAndQuit(page: Page): Promise<string[]> {
  const errors = await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-1');
  return errors;
}

test('GDD-UI-02 the title menu shows Start, Tutorial and Settings', async ({ page }) => {
  await openGame(page);
  const menu = (await api(page, () => window.__PONCHO__!.titleDrawn())).menu;
  expect(menu).toMatchObject({ shown: true, items: ['Start', 'Tutorial', 'Settings'], chosen: 'start' });
  expect(menu.colors).toEqual(['#fff3dc', '#9ba3c4', '#9ba3c4']);
});

test('GDD-UI-02 a first visit: Start plays 0-1 and marks the tutorial played', async ({ page }) => {
  await openGame(page, '/');
  expect(await level(page)).toBe('0-1');
  expect(await api(page, () => window.__PONCHO__!.tutorialPlayed())).toBe(false);
  await page.keyboard.press('Enter');
  await titleHidden(page);
  expect(await level(page)).toBe('0-1');
  expect(await api(page, () => window.__PONCHO__!.tutorialPlayed())).toBe(true);
  expect(await saved(page)).toBe(true);
});

test('GDD-UI-02 after the tutorial started, quitting brings the title back over 1-1, and Start plays 1-1', async ({ page }) => {
  const errors = await playTutorialAndQuit(page);
  await page.keyboard.press('Enter');
  await titleHidden(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await level(page)).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(errors).toEqual([]);
});

test('GDD-UI-02 a new visit after the tutorial opens on 1-1', async ({ page }) => {
  await openGame(page, '/');
  await page.keyboard.press('Enter');
  await titleHidden(page);
  expect(await saved(page)).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  expect(await level(page)).toBe('1-1');
  expect(await titleShown(page)).toBe(true);
});

test('GDD-UI-02 Tutorial on the title over 1-1 plays 0-1 at once, the press held', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seedPlayed(page);
  await openGame(page, '/');
  expect(await level(page)).toBe('1-1');
  await page.keyboard.down('ArrowDown');
  await page.keyboard.up('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'tutorial');
  await page.keyboard.down('Space'); // picks Tutorial and stays held
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown);
  await page.keyboard.down('Space'); // an auto-repeat keydown, the first this level sees
  expect(await topOver(page, 60)).toBe(224);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.__PONCHO__!.state().jumpWasHeld); // a step has seen the release (L-022)
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__PONCHO__!.state().y < 200);
  await page.keyboard.up('Space');
});

test('GDD-UI-02 on a phone a tap on the Tutorial row plays 0-1', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seedPlayed(page);
  await openGame(page, '/');
  expect(await level(page)).toBe('1-1');
  const row = (await api(page, () => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'tutorial')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const cdp: CDPSession = await page.context().newCDPSession(page);
  // A finger held on the row (L-032): a Playwright tap is shorter than a frame.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: box.x + (row.x + row.w / 2) * k, y: box.y + (row.y + row.h / 2) * k }] });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown);
  expect(await topOver(page, 60)).toBe(224);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});

test('GDD-UI-02 the sandbox by its address: Start plays it and does not mark the tutorial; Tutorial plays 0-1 and does', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Enter');
  await titleHidden(page);
  expect(await level(page)).toBe('sandbox');
  expect(await api(page, () => window.__PONCHO__!.tutorialPlayed())).toBe(false);
  expect(await saved(page)).not.toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  expect(await level(page)).toBe('sandbox');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'tutorial');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.tutorialPlayed())).toBe(true);
  expect(await saved(page)).toBe(true);
});

/** The saved game as parsed, or null where nothing is saved. */
const savedGame = async (page: Page): Promise<{ settings: { master: number; effects: number; language: string }; progress: { tutorialPlayed: boolean } } | null> => {
  const text = await api(page, () => localStorage.getItem('poncho-siete-vidas'));
  return text === null ? null : JSON.parse(text);
};
/** Keys sent as bare browser keydown events, all inside one task, so one frame reads them all. */
const keysInOneTask = (page: Page, keys: readonly (readonly [string, number])[]) =>
  page.evaluate((list) => { for (const [code, keyCode] of list) window.dispatchEvent(new KeyboardEvent('keydown', { code, keyCode, bubbles: true })); }, keys);
const DOWN = ['ArrowDown', 40] as const;
const UP = ['ArrowUp', 38] as const;
const ENTER = ['Enter', 13] as const;
const LEFT = ['ArrowLeft', 37] as const;
const ESCAPE = ['Escape', 27] as const;

test('GDD-PRG-02 a volume changed after the tutorial started keeps the tutorial flag in the save', async ({ page }) => {
  await seedPlayed(page);
  await openGame(page, '/');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 9);
  expect(await savedGame(page)).toEqual({ version: 1, settings: { master: 9, effects: 10, language: 'en' }, progress: { tutorialPlayed: true } });
});

test('GDD-PRG-02 where the browser refuses storage the tutorial still counts as started for this visit', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage refused'); };
    Storage.prototype.setItem = () => { throw new Error('storage refused'); };
  });
  await openGame(page, '/');
  expect(await level(page)).toBe('0-1');
  // GDD-UI-02: Master lowered to 8 on the title's settings screen first, so the new scenes below must keep this visit's volumes.
  await lowerMasterToEight(page);
  await page.keyboard.press('Enter');
  await titleHidden(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-1');
  expect(await api(page, () => window.__PONCHO__!.tutorialPlayed())).toBe(true); // the new scene knows, though nothing could be read
  expect((await api(page, () => window.__PONCHO__!.settings())).master).toBe(8); // and keeps the volumes
  await page.keyboard.press('Enter');
  await titleHidden(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await level(page)).toBe('1-1');
  expect((await api(page, () => window.__PONCHO__!.settings())).master).toBe(8);
});

test('GDD-UI-02 where the browser refuses storage, 0-1 leading on to 1-1 keeps the volumes of this visit', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage refused'); };
    Storage.prototype.setItem = () => { throw new Error('storage refused'); };
  });
  await openGame(page, '/');
  await lowerMasterToEight(page);
  await page.keyboard.press('Enter');
  await titleHidden(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await waitForResults(page);
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 5);
  expect((await api(page, () => window.__PONCHO__!.settings())).master).toBe(8);
});

test('GDD-UI-02 with ?level=0-1, 1-1\'s results menu brings back the title over 0-1, what Start plays', async ({ page }) => {
  const errors = await openGame(page, '/?level=0-1');
  await page.keyboard.press('Enter');
  await titleHidden(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await waitForResults(page);
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await waitForResults(page);
  await page.keyboard.press('ArrowDown'); // 1-1 names no next level, so the menu opens on Retry: Down chooses Quit to title
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && window.__PONCHO__!.titleDrawn().shown);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('start');
  expect(errors).toEqual([]);
});

test('GDD-PRG-02 a volume changed in the same frame as Tutorial is picked is saved', async ({ page }) => {
  await seedPlayed(page);
  await openGame(page, '/');
  // Settings opened, Left lowers Master, Escape comes back with Settings chosen, Up chooses Tutorial, Enter picks it.
  await keysInOneTask(page, [DOWN, DOWN, ENTER, LEFT, ESCAPE, UP, ENTER]);
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown);
  expect((await savedGame(page))?.settings).toEqual({ master: 9, effects: 10, language: 'en' });
});

test('GDD-PRG-02 a volume changed in the same frame as a pick on the results menu is saved', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await waitForResults(page);
  // Paused, Settings opened, Left lowers Master, Escape comes back to the pause menu, Up chooses Resume, Enter resumes, Enter picks Next level.
  await keysInOneTask(page, [ESCAPE, DOWN, ENTER, LEFT, ESCAPE, UP, ENTER, ENTER]);
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 2);
  expect((await savedGame(page))?.settings).toEqual({ master: 9, effects: 10, language: 'en' });
});

test('GDD-PRG-02 a volume changed in the same frame as Quit to title is saved', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  // Paused, Settings opened, Left lowers Master, Escape comes back to the pause menu with Settings chosen, Down chooses Quit, Enter picks it.
  await keysInOneTask(page, [ESCAPE, DOWN, ENTER, LEFT, ESCAPE, DOWN, ENTER]);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-1');
  expect((await savedGame(page))?.settings).toEqual({ master: 9, effects: 10, language: 'en' });
});
