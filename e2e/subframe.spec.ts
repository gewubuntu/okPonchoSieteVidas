import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

// L-006: a tap whose press and release land in one frame must still reach a simulation step. The events are dispatched in
// one task, so the browser cannot show a frame in between.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

const tapKey = (page: Page, code: string, keyCode: number, times: number) =>
  page.evaluate(
    async ({ c, k, n }) => {
      for (let i = 0; i < n; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: c, keyCode: k, bubbles: true }));
        await new Promise((r) => setTimeout(r, 400)); // clear of the 0.25 s claw cooldown
      }
    },
    { c: code, k: keyCode, n: times },
  );

test('GDD-CTL-01 a real keyboard press of X and of J swings the claw', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.keyboard.press('KeyX', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.swings() === 1);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyJ', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.swings() === 2);
});

test('L-006 a claw tap shorter than one frame still swings, every time', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await tapKey(page, 'KeyX', 88, 6);
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(6);
  await tapKey(page, 'KeyJ', 74, 4);
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(10);
});

test('L-006 a jump tap shorter than one frame still makes Poncho jump', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(280, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', keyCode: 32, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', keyCode: 32, bubbles: true }));
  });
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
  expect(await api(page, () => window.__PONCHO__!.peakRise())).toBeGreaterThanOrEqual(0);
});

/** Where the centre of a touch button is on the page, in CSS px. */
async function buttonCentre(page: Page, id: 'claw' | 'jump') {
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  return { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k };
}

/** A touch that starts and ends in one task, so no frame runs while the finger is down. */
const tapTouch = (page: Page, at: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const target = document.querySelector('canvas')!;
    const touch = new Touch({ identifier: 7, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
    const init = { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] };
    target.dispatchEvent(new TouchEvent('touchstart', init));
    target.dispatchEvent(new TouchEvent('touchend', { ...init, touches: [], targetTouches: [] }));
  }, at);

test('L-006 a touch tap on the Claw button shorter than one frame still swings', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  const claw = await buttonCentre(page, 'claw');
  for (let i = 0; i < 4; i++) {
    await tapTouch(page, claw);
    await page.waitForTimeout(400);
  }
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(4);
});

test('L-006 a touch tap on the Jump button shorter than one frame still makes Poncho jump', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(280, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await tapTouch(page, await buttonCentre(page, 'jump'));
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
});
