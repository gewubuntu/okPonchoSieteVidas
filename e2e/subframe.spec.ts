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
async function buttonCentre(page: Page, id: 'claw' | 'jump' | 'left' | 'right') {
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

test('GDD-CTL-01 a real keyboard press of C and of K spits a fireball, and a tap inside one frame does too', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await page.keyboard.press('KeyC', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 1);
  await page.waitForTimeout(1500); // let it fly into a wall and vanish
  await page.keyboard.press('KeyK', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 2);
  await page.waitForTimeout(1500);
  await tapKey(page, 'KeyC', 67, 1);
  expect(await api(page, () => window.__PONCHO__!.spits())).toBe(3);
  await page.waitForTimeout(1500);
  await tapKey(page, 'KeyK', 75, 1);
  expect(await api(page, () => window.__PONCHO__!.spits())).toBe(4);
});

test('GDD-PWR-03 the Fuego button shows only in Fuego, and a touch tap inside one frame spits', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect((await api(page, () => window.__PONCHO__!.touch())).buttons.some((b) => b.id === 'fuego')).toBe(false);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.waitForTimeout(150);
  expect((await api(page, () => window.__PONCHO__!.touch())).buttons.some((b) => b.id === 'fuego')).toBe(false);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await page.waitForFunction(() => window.__PONCHO__!.touch().buttons.some((b) => b.id === 'fuego'));
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'fuego')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  expect(b.w * k).toBeGreaterThanOrEqual(48);
  const centre = { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k };
  await tapTouch(page, centre);
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 1);
  await page.waitForTimeout(500);
  await tapTouch(page, centre); // a second tap: the first one's latch must have been spent
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 2);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.waitForFunction(() => !window.__PONCHO__!.touch().buttons.some((x) => x.id === 'fuego'));
});

/** GDD-LIFE-05: loses the last life and waits until the Siete vidas gastadas screen takes presses. */
async function onGameOver(page: Page): Promise<void> {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
}

for (const [code, keyCode] of [['ArrowLeft', 37], ['ArrowRight', 39], ['KeyX', 88], ['KeyC', 67]] as const) {
  test(`GDD-LIFE-05 a ${code} tap inside one frame ends the Siete vidas gastadas screen`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test');
    await onGameOver(page);
    await tapKey(page, code, keyCode, 1);
    await page.waitForFunction(() => window.__PONCHO__!.phase() !== 'gameover');
    expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  });
}

for (const id of ['left', 'right', 'claw'] as const) {
  test(`GDD-LIFE-05 a touch tap on ${id} inside one frame ends the Siete vidas gastadas screen`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch device only');
    await onGameOver(page);
    await tapTouch(page, await buttonCentre(page, id));
    await page.waitForFunction(() => window.__PONCHO__!.phase() !== 'gameover');
    expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  });
}

test('GDD-LIFE-02 a claw tap inside one frame skips the respawn wait, and does not swing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
  const start = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((s) => window.__PONCHO__!.ticks() >= s + 25, start); // past 0.3 s, well before 0.8 s
  await page.evaluate(() => {
    // down and up in one task, so no frame runs between them (tapKey would add a 400 ms pause after)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', keyCode: 88, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', keyCode: 88, bubbles: true }));
  });
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect((await api(page, () => window.__PONCHO__!.ticks())) - start).toBeLessThan(40);
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(0);
});
