import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

/** How far a pixel's colour is from a colour (r, g, b). */
const near = (c: { r: number; g: number; b: number }, to: [number, number, number]) => Math.hypot(c.r - to[0], c.g - to[1], c.b - to[2]);

// The sandbox has 20 hilos. The first is on the floor in tile column 4 (middle x 72, y 216), 16 px right of the spawn; the second
// is in column 6 (x 104), on the other side of the key at column 5.

/** Paused after boot with Poncho on the floor at x = 56, a few steps in, short of the first hilo. */
const atFirst = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(56, 224);
    window.__PONCHO__!.step(2);
  });
};
/** Runs right one step at a time until Poncho is past x = 72, which takes the first hilo and not yet the second. */
const pastFirst = (page: Page) =>
  page.evaluate(() => {
    for (let i = 0; i < 60 && window.__PONCHO__!.state().x <= 72; i++) window.__PONCHO__!.step(1, { move: 1, jumpHeld: false });
  });

test('GDD-WLD-04 walking into a hilo collects it: it leaves the level and the counter goes up', async ({ page }) => {
  await atFirst(page);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 0, total: 20, drawn: 20 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('0/20');
  await pastFirst(page);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 20, drawn: 19 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('1/20');
});

test('GDD-LIFE-02 a lost life keeps collected hilos', async ({ page }) => {
  await atFirst(page);
  await pastFirst(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(262, 170)); // into the pit, clear of the hilo over its middle (x 244 to 252) and of the ledge and platform above
  await page.evaluate(() => window.__PONCHO__!.step(140));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 20, drawn: 19 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('1/20');
});

test('GDD-WLD-04 a hilo is drawn in its colour and gone once collected', async ({ page }) => {
  await atFirst(page);
  // The first hilo is red (185 72 66) and sits on the dark background (27 32 54) once gone. Its middle is plain colour, 2 px clear of
  // the wraps; the touch buttons are not over it (L-018).
  const spot = { x: 72, y: 216 };
  const buttons = (await api(page, () => window.__PONCHO__!.touch())).buttons;
  expect(buttons.some((b) => spot.x >= b.x && spot.x <= b.x + b.w && spot.y >= b.y && spot.y <= b.y + b.h)).toBe(false);
  await frames(page);
  const [before] = await pixelsAt(page, [spot]);
  expect(near(before!, [185, 72, 66])).toBeLessThan(near(before!, [27, 32, 54]));
  expect(near(before!, [185, 72, 66])).toBeLessThan(40);
  await pastFirst(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(300, 100)); // out of the way, so he is not drawn over the spot
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await frames(page);
  const [after] = await pixelsAt(page, [spot]);
  expect(near(after!, [27, 32, 54])).toBeLessThan(near(after!, [185, 72, 66]));
});

test('GDD-UI-01 the counter is top-right, left of the pause button on touch', async ({ page, isMobile }) => {
  await atFirst(page);
  const hud = await api(page, () => window.__PONCHO__!.hudHilos());
  expect(hud.top).toBe(8);
  const touch = await api(page, () => window.__PONCHO__!.touch());
  if (isMobile) {
    const pause = touch.buttons.find((b) => b.id === 'pause')!;
    expect(touch.visible).toBe(true);
    expect(hud.right).toBe(pause.x - 6);
  } else {
    expect(hud.right).toBe(472);
  }
  expect(hud.iconX).toBeLessThan(hud.right);
});

test('GDD-UI-01 the counter updates in real play', async ({ page }) => {
  // Unpaused (L-021): nothing but the scene's own frames redraws the counter.
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.teleport(56, 224));
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('0/20');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.hudHilos().text === '1/20');
  await page.keyboard.up('ArrowRight');
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBeGreaterThanOrEqual(1);
});
