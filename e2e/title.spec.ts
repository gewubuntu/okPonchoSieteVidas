import { expect, test, type Page } from '@playwright/test';
import { openGame, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const ticks = (page: Page) => api(page, () => window.__PONCHO__!.ticks());
const titleHidden = (page: Page) => page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
const titleShown = async (page: Page) => (await api(page, () => window.__PONCHO__!.titleDrawn())).shown;
const started = (page: Page) => page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
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
// poncho (#3F66B1 in the user's drawing, GDD-ART-02): 13.25 px right of his x and 30.25 above his feet, which are at y = 168.
const floorTile = { x: 120, y: 248 };
const hudTriangle = { x: 26, y: 14 };
const titlePoncho = { x: 240 + 13.25, y: 168 - 30.25 };

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
    ponchoBottom: 168,
    menu: { shown: true, items: ['Start', 'Settings'], colors: ['#fff3dc', '#9ba3c4'], chosen: 'start', markerY: middle(0) },
  });
  expect(rows.map((r) => r.item)).toEqual(['start', 'settings']);
  expect(rows[0]).toMatchObject({ x: 160, y: 176, w: 160 });
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

test('GDD-UI-02 each game key starts the level', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  // Space and Z pick Start; the others are game buttons (claw, Fuego, Left, Right) whose new press starts it.
  for (const key of ['Space', 'KeyZ', 'Enter', 'ArrowLeft', 'ArrowRight', 'KeyX', 'KeyC', 'KeyA', 'KeyD', 'KeyJ', 'KeyK']) {
    await openGame(page);
    await page.keyboard.press(key);
    await titleHidden(page);
  }
});

test('GDD-UI-02 Up and W choose, they do not start the level', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(300);
  expect(await titleShown(page)).toBe(true);
  expect(await ticks(page)).toBe(0);
  // Down chooses Settings (no start), Up chooses Start again.
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  expect(await titleShown(page)).toBe(true);
  await page.keyboard.press('KeyS'); // no wrap-around
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
