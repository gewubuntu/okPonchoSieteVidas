import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

// The sandbox has a cactus buddy on the right half of the top of the 2-tile wall (columns 10 and 11): x = 184, feet at y = 192, so
// its box is x 178 to 190. The left 18 px of the wall top are free to stand on.
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
type Colour = { r: number; g: number; b: number };
const cactus = async (page: Page) => (await api(page, () => window.__PONCHO__!.enemies()))[2]!;
const green = (c: Colour) => Math.abs(c.r - 79) < 14 && Math.abs(c.g - 154) < 14 && Math.abs(c.b - 74) < 14; // the body, 4f9a4a
const pale = (c: Colour) => c.r > 220 && c.g > 220 && c.b > 205; // the thorns, f2efe6

test('GDD-ENM-02 the cactus buddy stands still on top of the 2-tile wall and is painted there', async ({ page }) => {
  await start(page);
  const first = await cactus(page);
  expect(first).toMatchObject({ x: 184, y: 192, alive: true });
  await step(page, 120);
  expect(await cactus(page)).toEqual(first);
  await frames(page);
  const painted = (await api(page, () => window.__PONCHO__!.enemiesDrawn())).find((e) => e.y === 192)!;
  expect([painted.x, painted.y]).toEqual([184, 192]);
  expect((await pixelsAt(page, [{ x: 182, y: 186 }, { x: 186, y: 184 }, { x: 183, y: 180 }])).some(green)).toBe(true);
});

test('GDD-CMB-01 three pale thorns on top mark it as not stompable', async ({ page }) => {
  await start(page);
  await frames(page);
  const thorns = [-2, 0, 2].map((dx) => ({ x: 184 + dx, y: 192 - 17 }));
  expect((await pixelsAt(page, thorns)).filter(pale).length).toBeGreaterThanOrEqual(2);
});

test('GDD-CMB-03 walking into it costs a life in Base', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(164, 192));
  await step(page, 2);
  await step(page, 40, { move: 1, jumpHeld: false });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect((await cactus(page)).alive).toBe(true);
});

test('GDD-CMB-01 landing on it is a hit', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(184, 160));
  await step(page, 30);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect((await cactus(page)).alive).toBe(true);
});

test('GDD-CMB-02 a claw swipe passes through it: it stays and nothing hurts', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(164, 192));
  await step(page, 1, { move: 0, jumpHeld: false, claw: true });
  await step(page, 4);
  expect((await cactus(page)).alive).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-PWR-03 a fireball is used up by it and it stays', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(162, 192));
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await step(page, 1, { move: 0, jumpHeld: false, fuego: true });
  await step(page, 14);
  expect((await cactus(page)).alive).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.fireballs())).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});
