import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
type Input = { move: number; jumpHeld: boolean };
const step = (page: Page, n: number, input: Input) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
type Colour = { r: number; g: number; b: number };
const cream = (c: Colour) => c.r > 220 && c.g > 210 && c.b > 180; // the claw marks, fff3dc
const idle: Input = { move: 0, jumpHeld: false };
const toward: Input = { move: -1, jumpHeld: false };

// The level's left edge is a wall the full height of the screen. Poncho's box is 12 px wide, so flush against it his feet
// are at x = 6. From y = 100 he falls 124 px to the floor at y = 224.
const WALL = { x: 6, y: 100 };

test('GDD-MOV-08 pressing toward the wall while falling slides at 60 px/s with claw marks on the wall side; jump kicks away', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate((p) => window.__PONCHO__!.teleport(p.x, p.y), WALL);
  await step(page, 10, idle); // falling faster than the slide
  expect((await api(page, () => window.__PONCHO__!.state())).vy).toBeGreaterThan(60);
  await step(page, 1, toward);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ clinging: true, vy: 60, x: 6 });
  expect(await api(page, () => window.__PONCHO__!.clingDrawn())).toBe(-1);
  // The marks slant down the left half of the body, from 4 px left of its centre line toward it: the top one from 6 to 3 px
  // above the centre, the middle one from 2 above to 1 below. Sampled halfway along each, clear of the pale feet strip at
  // the bottom; the same points mirrored onto the right half must stay the red body.
  const { x, y } = await api(page, () => window.__PONCHO__!.bodyPose());
  const mid = y - 7;
  const near = await pixelsAt(page, [{ x: x - 2.5, y: mid - 4.5 }, { x: x - 2.5, y: mid - 0.5 }]);
  const far = await pixelsAt(page, [{ x: x + 2.5, y: mid - 4.5 }, { x: x + 2.5, y: mid - 0.5 }]);
  expect(near.filter(cream).length, JSON.stringify(near)).toBeGreaterThanOrEqual(1);
  expect(far.filter(cream).length, JSON.stringify(far)).toBe(0);
  // Jump kicks away from the wall, up and to the right, and the marks are gone.
  await step(page, 1, { move: -1, jumpHeld: true });
  await frames(page);
  const kicked = await api(page, () => window.__PONCHO__!.state());
  expect(kicked.vx).toBe(130);
  expect(kicked.vy).toBeLessThan(-300);
  expect(await api(page, () => window.__PONCHO__!.clingDrawn())).toBe(0);
});

test('GDD-MOV-08 sliding down the pit wall loses the life, and the respawn flip shows no claw marks', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // The pit is x 224 to 272; its left side is solid from y = 224 down, so flush against it his feet are at x = 230.
  await page.evaluate(() => window.__PONCHO__!.teleport(230, 232));
  for (let i = 0; i < 300 && (await api(page, () => window.__PONCHO__!.phase())) === 'playing'; i++) await step(page, 1, toward);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('respawning');
  expect(await api(page, () => window.__PONCHO__!.state().clinging)).toBe(true); // he was clinging when the life was lost
  // Nothing held, so the wait is not skipped (GDD-LIFE-02) and the flip plays.
  for (let i = 0; i < 60 && !(await api(page, () => window.__PONCHO__!.bodyVisible())); i++) await step(page, 1, idle);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('respawning');
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.clingDrawn())).toBe(0);
});

test('GDD-MOV-08 real keys: hold left against the wall, then Space kicks off it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  await page.evaluate((p) => window.__PONCHO__!.teleport(p.x, p.y), WALL);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().clinging === true && window.__PONCHO__!.state().vy === 60);
  await page.keyboard.press('Space', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0 && window.__PONCHO__!.state().vy < 0);
  await page.keyboard.up('ArrowLeft');
});

/** Real touch events through the browser, so a button can be held while another is tapped. */
const fingers = async (cdp: CDPSession, type: 'touchStart' | 'touchEnd', points: { x: number; y: number; id: number }[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' ? points : [] });

test('GDD-MOV-08 touch: hold the left button against the wall, then a Jump tap kicks off it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  // Everything slow is set up before he is put by the wall, so the finger is down within his fall however slow the frames are.
  const buttons = (await api(page, () => window.__PONCHO__!.touch())).buttons;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const at = (id: string) => {
    const b = buttons.find((x) => x.id === id)!;
    return { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k };
  };
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate((p) => window.__PONCHO__!.teleport(p.x, p.y), WALL);
  await fingers(cdp, 'touchStart', [{ ...at('left'), id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.state().clinging === true);
  await fingers(cdp, 'touchStart', [{ ...at('left'), id: 1 }, { ...at('jump'), id: 2 }]);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0 && window.__PONCHO__!.state().vy < 0);
  await fingers(cdp, 'touchEnd', []);
});
