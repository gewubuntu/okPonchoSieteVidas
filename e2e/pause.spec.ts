import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const ticks = (page: Page) => api(page, () => window.__PONCHO__!.ticks());
const paused = async (page: Page) => (await api(page, () => window.__PONCHO__!.playerPause())).paused;
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
/** The level stands still: no simulation step for a while. */
async function standsStill(page: Page): Promise<void> {
  const before = await ticks(page);
  await page.waitForTimeout(250);
  expect(await ticks(page)).toBe(before);
}
/** Taps a touch button by its id, in the middle. */
async function tapButton(page: Page, id: string): Promise<void> {
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await page.touchscreen.tap(box.x + (b.x + b.w / 2) * k, box.y + (b.y + b.h / 2) * k);
}
const started = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
};
// A floor tile right of the spawn, clear of the touch buttons and of the pause screen's text.
const floorTile = { x: 120, y: 248 };
// Inside the second life triangle on the HUD (x 21 to 31, y 8 to 17), in its red fill.
const hudTriangle = { x: 26, y: 14 };
const brightness = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;

test('GDD-UI-02 Escape pauses the level under a dimmed screen, and Escape again resumes it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await frames(page);
  const lit = (await pixelsAt(page, [floorTile]))[0]!;
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  const drawn = await api(page, () => window.__PONCHO__!.pauseDrawn());
  expect(drawn).toMatchObject({ shown: true, title: 'Paused', prompt: '', promptSize: 12 });
  expect(drawn.menu.shown).toBe(true);
  await standsStill(page);
  const dim = (await pixelsAt(page, [floorTile]))[0]!;
  expect(dim.r + dim.g + dim.b).toBeLessThan((lit.r + lit.g + lit.b) / 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.pauseDrawn().shown);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 10, t);
});

test('GDD-UI-02 the HUD, and on touch the pause button, stay on top of the dim layer', async ({ page, isMobile }) => {
  await started(page);
  const spots = [floorTile, hudTriangle];
  if (isMobile) {
    // In the left bar of the pause sign: the bars are about 0.12 of the button wide, either side of its centre; and, in the button's
    // box clear of the bars, the button's own shade over the backdrop (the box is see-through, so the backdrop's own dimming changes it).
    const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'pause')!;
    spots.push({ x: b.x + b.w / 2 - b.w * 0.12, y: b.y + b.h / 2 }, { x: b.x + b.w * 0.2, y: b.y + b.h / 2 });
  }
  await frames(page);
  const lit = await pixelsAt(page, spots);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await frames(page);
  const dim = await pixelsAt(page, spots);
  expect(brightness(dim[0]!)).toBeLessThan(brightness(lit[0]!) / 2); // the level is dimmed
  expect(brightness(dim[1]!), JSON.stringify(spots[1])).toBeGreaterThan(brightness(lit[1]!) * 0.9);
  if (isMobile) {
    // The bar stands out from the box beside it as much as before (more, as the dimmed backdrop is darker); under the dim layer it would stand out about a fifth as much.
    expect(brightness(dim[2]!) - brightness(dim[3]!), JSON.stringify(spots[2])).toBeGreaterThan((brightness(lit[2]!) - brightness(lit[3]!)) * 0.9);
  }
});

test('GDD-UI-02 P pauses and resumes too, and a click anywhere resumes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.mouse.click(640, 200);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
});

test('GDD-UI-02 a click while playing does not pause', async ({ page }) => {
  await started(page);
  await page.mouse.click(640, 100);
  await page.waitForTimeout(150);
  expect(await paused(page)).toBe(false);
});

test('GDD-UI-02 a pause key tapped inside one frame still pauses (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', keyCode: 27, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', keyCode: 27, bubbles: true }));
  });
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
});

// Phaser's Key 'down' event, which pause used before, fired a second time for some quick presses (measured: about one run in two of
// 40 presses), toggling the pause straight back. Each press here must land. The 40 real presses are two tests of 20, each press taking
// frames to land, so a test stays well inside its time where the frames are slow.
for (const [first, last] of [[1, 20], [21, 40]] as const) {
  test(`GDD-UI-02 every real press of P or Escape toggles the pause exactly once, presses ${first} to ${last} (L-006)`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test');
    await started(page);
    for (let i = first; i <= last; i++) {
      await page.keyboard.press(i % 3 === 0 ? 'Escape' : 'KeyP');
      await page.waitForFunction((want) => window.__PONCHO__!.playerPause().paused === want, i % 2 === 1, { timeout: 2000 });
    }
    expect(await paused(page)).toBe(false);
  });
}

test('GDD-UI-02 the key labelled P pauses on any layout, and auto-repeat is no press (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  // The key labelled P pauses on any layout: on Dvorak it sits where QWERTY has R (code KeyR, keyCode 80), and the key in
  // QWERTY's P position types L there (code KeyP, keyCode 76), which does not pause.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'l', keyCode: 76, bubbles: true })));
  await frames(page);
  expect(await paused(page)).toBe(false);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'p', keyCode: 80, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', key: 'p', keyCode: 80, bubbles: true }));
  });
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  // A held key's auto-repeat is no new press.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', keyCode: 80, bubbles: true }));
    for (let n = 0; n < 5; n++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', keyCode: 80, repeat: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyP', keyCode: 80, bubbles: true }));
  });
  await frames(page);
  expect(await paused(page)).toBe(true);
});

test('GDD-UI-02 losing focus pauses, and it does not resume by itself', async ({ page }) => {
  await started(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await standsStill(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await standsStill(page);
  expect(await paused(page)).toBe(true);
});

test('GDD-UI-02 a hidden tab pauses', async ({ page }) => {
  await started(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await standsStill(page);
});

test('GDD-UI-02 a jump pressed while paused, held through the resume, does not jump', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.down('ArrowUp'); // a jump key that picks nothing (Space and Z pick the chosen menu item)
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ grounded: true, vy: 0 });
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => !window.__PONCHO__!.state().jumpWasHeld); // a step has seen the release
  await page.keyboard.press('Space', { delay: 60 });
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
});

test('GDD-UI-02 the touch pause button pauses; it, or a tap anywhere, resumes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'pause')!;
  expect(b.x + b.w).toBe(480 - 6);
  expect(b.y).toBe(6);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  const drawn = await api(page, () => window.__PONCHO__!.pauseDrawn());
  expect(drawn).toMatchObject({ prompt: '' });
  expect(drawn.menu.shown).toBe(true);
  await standsStill(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.touchscreen.tap(420, 150);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
});

test('GDD-UI-02 the tap that resumes on the Jump button does not jump', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await tapButton(page, 'jump');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ grounded: true, vy: 0 });
  await tapButton(page, 'jump'); // a new tap jumps
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
});

test('GDD-UI-02 a phone turned upright pauses and asks to turn it sideways; only then does a tap resume', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().prompt === 'Turn your device sideways');
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: true, portrait: true, choice: 'resume', settings: null });
  const upright = await api(page, () => window.__PONCHO__!.pauseDrawn());
  expect(upright.promptSize).toBe(12); // larger, the level is drawn small
  expect(upright.menu.shown).toBe(false);
  await page.touchscreen.tap(195, 420);
  await standsStill(page);
  expect(await paused(page)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).prompt).toBe('');
  await standsStill(page);
  await page.touchscreen.tap(420, 150);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
});

test('GDD-UI-02 a touchscreen laptop in a tall window does not pause: its screen stays landscape', async ({ browser, isMobile }) => {
  test.skip(isMobile, 'desktop test');
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 720 }, baseURL: test.info().project.use.baseURL! });
  const page = await context.newPage();
  await started(page);
  expect((await api(page, () => window.__PONCHO__!.touch())).visible).toBe(true); // a touch device, with the buttons
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(200);
  expect(await paused(page)).toBe(false);
  await context.close();
});

test('GDD-UI-02 a narrow desktop window is not a phone: it does not pause', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop test');
  await started(page);
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(200);
  expect(await paused(page)).toBe(false);
});

// ---- GDD-UI-02 the pause menu: Resume and Quit to title ----

const PALE = '#fff3dc';
const GREY = '#9ba3c4';
const menuOf = async (page: Page) => (await api(page, () => window.__PONCHO__!.pauseDrawn())).menu;
const chosenIs = (page: Page, item: 'resume' | 'settings' | 'quit') => page.waitForFunction((want) => window.__PONCHO__!.pauseDrawn().menu.chosen === want, item);
const resumed = (page: Page) => page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
const titleShown = (page: Page) => api(page, () => window.__PONCHO__!.titleDrawn().shown);
/** Chooses Quit to title: Down twice, through Settings (GDD-UI-02). `raw` sends the key as a bare browser event. */
const chooseQuit = async (page: Page, raw = false) => {
  for (const want of ['settings', 'quit'] as const) {
    if (raw) await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', keyCode: 40, bubbles: true })));
    else await page.keyboard.press('ArrowDown');
    await chosenIs(page, want);
  }
};
const pauseWithEscape = async (page: Page) => {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
};
/** The middle of a menu row on the page, in CSS px, read from the laid-out rows and the canvas. */
async function rowCentre(page: Page, item: 'resume' | 'settings' | 'quit'): Promise<{ x: number; y: number }> {
  const row = (await api(page, () => window.__PONCHO__!.pauseMenu())).find((r) => r.item === item)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  return { x: box.x + (row.x + row.w / 2) * k, y: box.y + (row.y + row.h / 2) * k };
}
const clickRow = async (page: Page, item: 'resume' | 'settings' | 'quit') => {
  const at = await rowCentre(page, item);
  await page.mouse.click(at.x, at.y);
};
/** Ends the title screen the way the player does and waits for the level to run. */
const startAgain = async (page: Page) => {
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
};

test('GDD-UI-02 the pause menu shows Resume chosen, then Down chooses Settings and Quit to title and Up comes back', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await pauseWithEscape(page);
  const rows = await api(page, () => window.__PONCHO__!.pauseMenu());
  const middle = (i: number) => rows[i]!.y + rows[i]!.h / 2;
  expect(await menuOf(page)).toEqual({ shown: true, items: ['Resume', 'Settings', 'Quit to title'], colors: [PALE, GREY, GREY], chosen: 'resume', markerY: middle(0) });
  await page.keyboard.press('ArrowDown');
  await chosenIs(page, 'settings');
  expect(await menuOf(page)).toMatchObject({ colors: [GREY, PALE, GREY], chosen: 'settings', markerY: middle(1) });
  await page.keyboard.press('ArrowDown');
  await chosenIs(page, 'quit');
  expect(await menuOf(page)).toMatchObject({ colors: [GREY, GREY, PALE], chosen: 'quit', markerY: middle(2) });
  await page.keyboard.press('KeyS'); // already on Quit to title: no wrap-around
  await frames(page);
  expect(await menuOf(page)).toMatchObject({ colors: [GREY, GREY, PALE], chosen: 'quit' });
  await page.keyboard.press('ArrowUp');
  await chosenIs(page, 'settings');
  await page.keyboard.press('ArrowUp');
  await chosenIs(page, 'resume');
  expect(await menuOf(page)).toMatchObject({ colors: [PALE, GREY, GREY], markerY: middle(0) });
  await page.keyboard.press('ArrowUp'); // already on Resume: no wrap-around
  await frames(page);
  expect(await menuOf(page)).toMatchObject({ chosen: 'resume' });
  await page.keyboard.press('KeyS');
  await chosenIs(page, 'settings');
  await page.keyboard.press('KeyW');
  await chosenIs(page, 'resume');
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: true, portrait: false, choice: 'resume', settings: null });
});

test('GDD-UI-02 the pause menu opens on Resume every time', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await pauseWithEscape(page);
  await chooseQuit(page);
  await page.keyboard.press('Escape'); // resumes with Quit to title chosen
  await resumed(page);
  await pauseWithEscape(page);
  expect((await menuOf(page)).chosen).toBe('resume');
});

test('GDD-UI-02 Enter, Space and Z pick Resume', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await pauseWithEscape(page);
  await page.keyboard.press('Enter');
  await resumed(page);
  expect(await titleShown(page)).toBe(false);
  // Space is a jump key too: held through the resume it does not jump, and a new press does (L-022).
  await pauseWithEscape(page);
  await page.keyboard.down('Space');
  await resumed(page);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ grounded: true, vy: 0 });
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.__PONCHO__!.state().jumpWasHeld); // a step has seen the release
  await page.keyboard.press('Space', { delay: 60 });
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await pauseWithEscape(page);
  await page.keyboard.press('KeyZ');
  await resumed(page);
});

test('GDD-UI-02 Down then Enter quits to the title screen over a fresh run', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page); // the real game, not paused through the debug hook (L-021)
  const spawn = await api(page, () => window.__PONCHO__!.checkpoint());
  const spawnPose = await api(page, () => window.__PONCHO__!.bodyPose());
  // Change the run: three lives lost, the first hilo and the key on the floor taken, a taco, an ofrenda used (which also moves the respawn point).
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) window.__PONCHO__!.loseLife();
    window.__PONCHO__!.teleport(56, 224);
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.keysHeld() === 1 && window.__PONCHO__!.hilos().taken > 0);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => {
    window.__PONCHO__!.setPower('taco');
    window.__PONCHO__!.teleport(120, 224);
  });
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[0]!.used);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 120 });
  const sfxBefore = (await api(page, () => window.__PONCHO__!.sfx())).length;

  await pauseWithEscape(page);
  await chooseQuit(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ shown: true, prompt: '', menu: { chosen: 'start' } });
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: false, portrait: false, choice: 'resume', settings: null });
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).shown).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, drawn: 20 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('0/20');
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
  expect(await api(page, () => window.__PONCHO__!.keysHeld())).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toEqual(spawn);
  expect((await api(page, () => window.__PONCHO__!.ofrendas())).every((o) => !o.used)).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.invulnerable())).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.bodyPose())).toEqual(spawnPose);
  expect(await api(page, () => window.__PONCHO__!.bodyPose().rotation)).toBe(0);
  // The Enter that picked does not also start the level: the title stands, and the level with it.
  await standsStill(page);
  expect(await titleShown(page)).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.sfx())).toHaveLength(sfxBefore); // no sound for the quit
  await startAgain(page);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 10, t);
});

test('GDD-UI-02 the Space that quits counts as held on the title screen, and a new Space press starts it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await pauseWithEscape(page);
  await chooseQuit(page);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await page.waitForTimeout(250);
  expect(await titleShown(page)).toBe(true);
  await page.keyboard.up('Space');
  await frames(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-UI-02 each menu key counts once per press, and auto-repeat is no press', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await pauseWithEscape(page);
  await chooseQuit(page, true);
  // A held key's auto-repeat is no new press: five repeats of Up leave Quit to title chosen.
  await page.evaluate(() => {
    for (let n = 0; n < 5; n++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', keyCode: 38, repeat: true, bubbles: true }));
  });
  await frames(page);
  expect((await menuOf(page)).chosen).toBe('quit');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', keyCode: 38, bubbles: true })));
  await chosenIs(page, 'settings'); // one press, one step up
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', keyCode: 38, bubbles: true })));
  await chosenIs(page, 'resume');
  // The key labelled S chooses on any layout: on Dvorak it sits where QWERTY has Semicolon (keyCode 83), and the key in
  // QWERTY's S position types O there (code KeyS, keyCode 79), which chooses nothing.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 'o', keyCode: 79, bubbles: true })));
  await frames(page);
  expect((await menuOf(page)).chosen).toBe('resume');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Semicolon', key: 's', keyCode: 83, bubbles: true })));
  await chosenIs(page, 'settings');
});

test('GDD-UI-02 a click on the Quit row quits, a click on the Resume row resumes, with either item chosen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse test');
  await started(page);
  await pauseWithEscape(page);
  await clickRow(page, 'quit');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: false, portrait: false, choice: 'resume', settings: null });
  await startAgain(page);
  await pauseWithEscape(page);
  await chooseQuit(page);
  await clickRow(page, 'resume');
  await resumed(page);
  expect(await titleShown(page)).toBe(false);
  // With Quit to title chosen, a click on the Quit row quits too.
  await pauseWithEscape(page);
  await chooseQuit(page);
  await clickRow(page, 'quit');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-UI-02 a tap on the Quit row quits, a tap on the Resume row resumes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  const resume = await rowCentre(page, 'resume');
  await page.touchscreen.tap(resume.x, resume.y);
  await resumed(page);
  expect(await titleShown(page)).toBe(false);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  const quit = await rowCentre(page, 'quit');
  await page.touchscreen.tap(quit.x, quit.y);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).shown).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await standsStill(page); // the tap that quit did not start the level
  expect(await titleShown(page)).toBe(true);
});

test('GDD-UI-02 upright, the menu is hidden and a tap on its rows does nothing', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().prompt === 'Turn your device sideways');
  await frames(page);
  expect(await menuOf(page)).toMatchObject({ shown: false, chosen: null, markerY: null });
  const quit = await rowCentre(page, 'quit');
  await page.touchscreen.tap(quit.x, quit.y);
  await standsStill(page);
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: true, portrait: true, choice: 'resume', settings: null });
  expect(await titleShown(page)).toBe(false);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown && document.querySelector('canvas')!.getBoundingClientRect().width > 600);
  await frames(page);
  const again = await rowCentre(page, 'quit');
  await page.touchscreen.tap(again.x, again.y);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-UI-02 quitting from the Siete vidas gastadas screen gives a fresh run', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
  await pauseWithEscape(page);
  await chooseQuit(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect((await api(page, () => window.__PONCHO__!.gameOverDrawn())).shown).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await startAgain(page);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 10, t);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
});

test('GDD-UI-02 quitting starts the hilo notes over from the first', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  const hiloNotes = () => api(page, () => window.__PONCHO__!.sfx().filter((s) => s.startsWith('hilo')));
  // Paused through the debug hook so the steps are counted out: the first hilo, on the floor 16 px right of the spawn.
  const toFirstHilo = () =>
    page.evaluate(() => {
      window.__PONCHO__!.pause(true);
      window.__PONCHO__!.teleport(56, 224);
      for (let i = 0; i < 80 && window.__PONCHO__!.hilos().taken < 1; i++) window.__PONCHO__!.step(1, { move: 1, jumpHeld: false });
    });
  await toFirstHilo();
  expect(await hiloNotes()).toEqual(['hilo:0']);
  await pauseWithEscape(page);
  await chooseQuit(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await startAgain(page);
  // Fresh run: the same walk, a few steps after the last hilo. Without a fresh combo this note would climb to hilo:2.
  await page.evaluate(() => {
    for (let i = 0; i < 80 && window.__PONCHO__!.hilos().taken < 1; i++) window.__PONCHO__!.step(1, { move: 1, jumpHeld: false });
  });
  expect(await hiloNotes()).toEqual(['hilo:0', 'hilo:0']);
});

test('GDD-UI-02 quitting in mid-air starts a run with no jump behind it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  // Paused through the debug hook so the steps are counted out: Poncho rises, off the floor, with no jump finished.
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.step(8, { move: 0, jumpHeld: true });
  });
  expect((await api(page, () => window.__PONCHO__!.state())).grounded).toBe(false);
  await pauseWithEscape(page);
  await chooseQuit(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await startAgain(page);
  await page.evaluate(() => window.__PONCHO__!.step(3));
  expect(await api(page, () => window.__PONCHO__!.state().grounded)).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.peakRise())).toBe(0); // the jump quit in mid-air is not counted as a completed one
});

test('GDD-UI-02 a pick and a turn upright in one frame quit to a title that asks to turn sideways', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await chooseQuit(page, true);
  // Enter and the turn upright land in one task, so in one frame; the pick came first.
  await page.evaluate(() => {
    Object.defineProperty(window.screen.orientation, 'type', { value: 'portrait-primary', configurable: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', keyCode: 13, bubbles: true }));
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === 'Turn your device sideways');
  expect(await titleShown(page)).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await page.touchscreen.tap(195, 420);
  await page.waitForTimeout(250);
  expect(await titleShown(page)).toBe(true); // upright, nothing starts
  await page.evaluate(() => {
    Object.defineProperty(window.screen.orientation, 'type', { value: 'landscape-primary', configurable: true });
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === '');
  await page.touchscreen.tap(420, 100);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
});

for (const [code, keyCode] of [['KeyX', 88], ['ArrowLeft', 37], ['ArrowRight', 39], ['KeyC', 67]] as const) {
  test(`GDD-UI-02 a ${code} tapped while paused is spent by the quit, so the next ${code} tap starts the level`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test');
    await started(page);
    await pauseWithEscape(page);
    // Down and up in one task: the level stands still, so no step uses the press and its latch stays pending.
    const tap = () =>
      page.evaluate(([c, k]) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: c, keyCode: k, bubbles: true }));
      }, [code, keyCode] as const);
    await tap();
    await chooseQuit(page);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
    await standsStill(page);
    expect(await titleShown(page)).toBe(true);
    await tap(); // a new press
    await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  });
}

/** Real touch events through the browser, so a finger can stay down across frames (L-032). Virtual px in, CSS px out. */
async function touchAt(page: Page, cdp: CDPSession, type: 'touchStart' | 'touchEnd', points: { x: number; y: number; id: number }[]): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' ? points.map((p) => ({ id: p.id, x: box.x + p.x * k, y: box.y + p.y * k })) : [] });
}
/** Switches the left thumb zone to the slide stick with a tap on the mode switch. */
async function stickMode(page: Page, cdp: CDPSession): Promise<void> {
  const sw = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((b) => b.id === 'mode')!;
  await touchAt(page, cdp, 'touchStart', [{ x: sw.x + sw.w / 2, y: sw.y + sw.h / 2, id: 9 }]);
  await touchAt(page, cdp, 'touchEnd', []);
  await page.waitForFunction(() => window.__PONCHO__!.touch().mode === 'stick');
}
// On the "R" of Resume, inside the lower left quarter the slide stick reads (x < 240, y >= 135), far right of the track's centre.
const resumeInStickZone = { x: 224, y: 150 };
const ponchoX = async (page: Page) => (await api(page, () => window.__PONCHO__!.state())).x;

test('GDD-UI-02 in slide-stick mode, the finger that resumes on the Resume row does not steer until lifted', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  const cdp = await page.context().newCDPSession(page);
  await stickMode(page, cdp);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  const x = await ponchoX(page);
  await touchAt(page, cdp, 'touchStart', [{ ...resumeInStickZone, id: 1 }]);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect(await ponchoX(page)).toBe(x); // held for 20 steps, and not one of them moved him
  expect((await api(page, () => window.__PONCHO__!.touch())).stick).toBe(0);
  await touchAt(page, cdp, 'touchEnd', []);
  await frames(page);
  // Lifted and put down again, the same place steers right.
  await touchAt(page, cdp, 'touchStart', [{ ...resumeInStickZone, id: 1 }]);
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, x);
  await touchAt(page, cdp, 'touchEnd', []);
});

test('GDD-UI-02 in slide-stick mode, a finger steering since before the pause steers on after the resume', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  const cdp = await page.context().newCDPSession(page);
  await stickMode(page, cdp);
  const x = await ponchoX(page);
  await touchAt(page, cdp, 'touchStart', [{ x: 100, y: 240, id: 1 }]); // right of the track's centre
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 2, x);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  const atPause = await ponchoX(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, atPause);
  await touchAt(page, cdp, 'touchEnd', []);
});

test('GDD-UI-02 in slide-stick mode, a finger held through quitting and the start of the level does not steer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  const cdp = await page.context().newCDPSession(page);
  await stickMode(page, cdp);
  await touchAt(page, cdp, 'touchStart', [{ x: 100, y: 240, id: 1 }]); // steering before the pause
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  const x = await ponchoX(page);
  await page.keyboard.press('Enter'); // starts the level with the finger still down
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect(await ponchoX(page)).toBe(x);
  await touchAt(page, cdp, 'touchEnd', []);
});

/** Waits until `n` more simulation steps have run, so a step has seen what changed (L-022). */
async function steps(page: Page, n: number): Promise<void> {
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() >= t0, t + n);
}

for (const key of ['ArrowRight', 'KeyD'] as const) {
  test(`GDD-UI-02 ${key} pressed while paused and held through the resume does not run until pressed again`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test');
    await started(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
    await page.keyboard.down(key);
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
    const x = await ponchoX(page);
    await steps(page, 20);
    expect(await ponchoX(page)).toBe(x);
    await page.keyboard.up(key);
    await steps(page, 2);
    await page.keyboard.down(key);
    await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, x);
    await page.keyboard.up(key);
  });
}

test('GDD-UI-02 a Right key held since before the pause runs on after the resume', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.down('ArrowRight');
  const x = await ponchoX(page);
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 2, x);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  const atPause = await ponchoX(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, atPause);
  await page.keyboard.up('ArrowRight');
});

test('GDD-UI-02 a Left held back since the pause does not cancel a new Right press', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await steps(page, 2);
  const x = await ponchoX(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, x);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowLeft');
});

test('GDD-UI-02 a Left tapped inside one task while paused moves nothing after the resume (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37, bubbles: true }));
  });
  await frames(page);
  const x = await ponchoX(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await steps(page, 20);
  expect(await ponchoX(page)).toBe(x);
});

test('GDD-UI-02 the Right key that starts the level from the title screen does not run until pressed again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  const x = await ponchoX(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  await steps(page, 20);
  expect(await ponchoX(page)).toBe(x);
  await page.keyboard.up('ArrowRight');
  await steps(page, 2);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, x);
  await page.keyboard.up('ArrowRight');
});

test('GDD-UI-02 the touch Right button held as the tap that resumes does not run until pressed again', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  const cdp = await page.context().newCDPSession(page);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'right')!;
  const middle = { x: b.x + b.w / 2, y: b.y + b.h / 2, id: 1 };
  const x = await ponchoX(page);
  await touchAt(page, cdp, 'touchStart', [middle]);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await steps(page, 20);
  expect(await ponchoX(page)).toBe(x);
  expect((await api(page, () => window.__PONCHO__!.touch())).pressed).not.toContain('right');
  await touchAt(page, cdp, 'touchEnd', []);
  await steps(page, 2);
  await touchAt(page, cdp, 'touchStart', [middle]);
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, x);
  await touchAt(page, cdp, 'touchEnd', []);
});

test('GDD-UI-02 a Right key held through quitting and the start of the level does not run', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.down('ArrowRight'); // running before the pause
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  const x = await ponchoX(page);
  await page.keyboard.press('Enter'); // starts the level with Right still down
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  await steps(page, 20);
  expect(await ponchoX(page)).toBe(x);
  await page.keyboard.up('ArrowRight');
});

test('GDD-UI-02 a held-back finger lifted and put down again inside one frame steers: it is a new finger (L-006)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await started(page);
  const cdp = await page.context().newCDPSession(page);
  await stickMode(page, cdp);
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  const x = await ponchoX(page);
  await touchAt(page, cdp, 'touchStart', [{ ...resumeInStickZone, id: 1 }]); // resumes, held back
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await steps(page, 5);
  expect(await ponchoX(page)).toBe(x);
  // Lift and land again on the same pointer slot with no frame between, so the slot never reads as up.
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const point = { id: 1, x: box.x + resumeInStickZone.x * k, y: box.y + resumeInStickZone.y * k };
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  await Promise.all([cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }), cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })]);
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, x);
  await touchAt(page, cdp, 'touchEnd', []);
});

test('GDD-UI-02 a Right held at the pause, released and pressed again while paused, does not run after the resume', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.up('ArrowRight');
  await frames(page);
  await page.keyboard.down('ArrowRight'); // a new press while the game stands still
  await frames(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const x = await ponchoX(page);
  await steps(page, 20);
  expect(await ponchoX(page)).toBe(x);
  await page.keyboard.up('ArrowRight');
});

test('GDD-UI-02 a held-back Right released and pressed again inside one task is a new press and runs (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await started(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await steps(page, 5);
  const x = await ponchoX(page);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39, bubbles: true }));
  });
  await page.waitForFunction((x0) => window.__PONCHO__!.state().x > x0 + 4, x); // held after a fresh press: he runs
  await page.keyboard.up('ArrowRight');
});
