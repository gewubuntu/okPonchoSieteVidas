import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
type Input = { move: number; jumpHeld: boolean };
const step = (page: Page, n: number, input: Input) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
type Colour = { r: number; g: number; b: number };
const red = (c: Colour) => c.r > 150 && c.g < 110 && c.b < 110; // the red stripes, b94842
const cream = (c: Colour) => c.r > 220 && c.g > 210 && c.b > 180; // the cream stripes, fff3dc
const hold: Input = { move: 0, jumpHeld: true };
const idle: Input = { move: 0, jumpHeld: false };

// Open sky over the spawn (columns 2 and 3 are clear down to the floor at y = 224): Poncho dropped from y = 100 falls 124 px.
const DROP = { x: 40, y: 100 };

test('GDD-MOV-07 holding jump while falling glides at 70 px/s under the spread poncho; letting go falls again', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate((p) => window.__PONCHO__!.teleport(p.x, p.y), DROP);
  await step(page, 14, idle); // falling, faster than a glide
  expect((await api(page, () => window.__PONCHO__!.state())).vy).toBeGreaterThan(70);
  await step(page, 6, hold); // held for the 0.1 s jump buffer: not yet a glide (GDD-MOV-03)
  expect(await api(page, () => window.__PONCHO__!.state().gliding)).toBe(false);
  await step(page, 1, hold);
  await frames(page);
  const s = await api(page, () => window.__PONCHO__!.state());
  expect(s).toMatchObject({ gliding: true, vy: 70, grounded: false });
  expect(await api(page, () => window.__PONCHO__!.glideDrawn())).toBe(true);
  // The bar spans x - 14 to x + 14, 6 to 2 px above the body's top (feet y - 32): a red stripe at its left end, cream next to it.
  const { x, y } = await api(page, () => window.__PONCHO__!.bodyPose());
  const top = y - 32 - 4;
  const [r, c] = await pixelsAt(page, [{ x: x - 12, y: top }, { x: x - 8, y: top }]);
  expect(red(r!), JSON.stringify(r)).toBe(true);
  expect(cream(c!), JSON.stringify(c)).toBe(true);
  await step(page, 1, idle);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.state().gliding)).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.glideDrawn())).toBe(false);
  const [after] = await pixelsAt(page, [{ x: x - 12, y: top + 1 }]); // he has moved down a little: still above him, now sky
  expect(red(after!)).toBe(false);
});

test('GDD-MOV-07 a real held jump key (Space, Z, W or Up) glides a fall to the floor, and he stands without the poncho', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  for (const key of ['Space', 'KeyZ', 'KeyW', 'ArrowUp']) {
    await page.evaluate((p) => window.__PONCHO__!.teleport(p.x, p.y), DROP);
    await page.keyboard.down(key);
    await page.waitForFunction(() => window.__PONCHO__!.glideDrawn() && window.__PONCHO__!.state().vy === 70);
    await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
    await page.keyboard.up(key);
    await frames(page);
    expect(await api(page, () => window.__PONCHO__!.glideDrawn()), key).toBe(false);
  }
});

test('GDD-MOV-07 gliding into the pit loses the life, and the respawn flip shows no spread poncho', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // over the pit
  // One step at a time until the life is lost, in one call: each call waits for a frame, and slow frames (L-042) made a call per step
  // outlast the test's time.
  await page.evaluate((input) => {
    const p = window.__PONCHO__!;
    for (let i = 0; i < 600 && p.phase() === 'playing'; i++) p.step(1, input);
  }, hold);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('respawning');
  expect(await api(page, () => window.__PONCHO__!.state().gliding)).toBe(true); // he was gliding when the life was lost
  // Nothing held, so the wait is not skipped (GDD-LIFE-02) and the flip plays: hidden at first, then shown dropping in.
  await page.evaluate((input) => {
    const p = window.__PONCHO__!;
    for (let i = 0; i < 60 && !p.bodyVisible(); i++) p.step(1, input);
  }, idle);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('respawning');
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(true); // in the flip
  expect(await api(page, () => window.__PONCHO__!.glideDrawn())).toBe(false);
});

/** Real touch events through the browser, so the jump button can be held. */
const fingers = async (cdp: CDPSession, type: 'touchStart' | 'touchEnd', points: { x: number; y: number; id: number }[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' ? points : [] });

test('GDD-MOV-07 holding the touch Jump button glides too', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  // The slow setup comes before he is dropped, so the finger is down within his fall however slow the frames are (L-042).
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'jump')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate((p) => window.__PONCHO__!.teleport(p.x, p.y), DROP);
  await fingers(cdp, 'touchStart', [{ x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.glideDrawn() && window.__PONCHO__!.state().vy === 70);
  await fingers(cdp, 'touchEnd', []);
  await page.waitForFunction(() => !window.__PONCHO__!.state().gliding);
});
