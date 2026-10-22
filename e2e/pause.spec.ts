import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

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
  expect(await api(page, () => window.__PONCHO__!.pauseDrawn())).toEqual({ shown: true, title: 'Paused', prompt: 'Press Escape or P to resume', promptSize: 8 });
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
    // In the left bar of the pause sign: the bars are about 0.12 of the button wide, either side of its centre.
    const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'pause')!;
    spots.push({ x: b.x + b.w / 2 - b.w * 0.12, y: b.y + b.h / 2 });
  }
  await frames(page);
  const lit = await pixelsAt(page, spots);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await frames(page);
  const dim = await pixelsAt(page, spots);
  expect(brightness(dim[0]!)).toBeLessThan(brightness(lit[0]!) / 2); // the level is dimmed
  for (let i = 1; i < spots.length; i++) expect(brightness(dim[i]!), JSON.stringify(spots[i])).toBeGreaterThan(brightness(lit[i]!) * 0.9);
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
  await page.keyboard.down('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const t = await ticks(page);
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ grounded: true, vy: 0 });
  await page.keyboard.up('Space');
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
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).prompt).toBe('Tap to resume');
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
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: true, portrait: true });
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).promptSize).toBe(12); // larger, the level is drawn small
  await page.touchscreen.tap(195, 420);
  await standsStill(page);
  expect(await paused(page)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().prompt === 'Tap to resume');
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).promptSize).toBe(8);
  await standsStill(page);
  await page.touchscreen.tap(420, 150);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
});

test('GDD-UI-02 a phone already upright when the level starts is paused from the start', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().prompt === 'Turn your device sideways');
  expect(await api(page, () => window.__PONCHO__!.playerPause())).toEqual({ paused: true, portrait: true });
  expect(await ticks(page)).toBe(0);
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
