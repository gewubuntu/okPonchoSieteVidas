import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

// The sandbox has a cactus buddy on the floor at tile column 13 (x = 216, feet at y = 224), between the spring and the pit.
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

test('GDD-ENM-02 the cactus buddy stands still on the floor and is painted there', async ({ page }) => {
  await start(page);
  const first = await cactus(page);
  expect(first).toMatchObject({ x: 216, y: 224, alive: true });
  await step(page, 120);
  expect(await cactus(page)).toEqual(first);
  await frames(page);
  const painted = (await api(page, () => window.__PONCHO__!.enemiesDrawn())).find((e) => e.y === 224)!;
  expect([painted.x, painted.y]).toEqual([216, 224]);
  expect((await pixelsAt(page, [{ x: 216, y: 218 }, { x: 217, y: 220 }, { x: 215, y: 215 }])).some(green)).toBe(true);
});

test('GDD-CMB-01 three pale thorns on top mark it as not stompable', async ({ page }) => {
  await start(page);
  await frames(page);
  const thorns = [-2, 0, 2].map((dx) => ({ x: 216 + dx, y: 224 - 17 }));
  expect((await pixelsAt(page, thorns)).filter(pale).length).toBeGreaterThanOrEqual(2);
});

test('GDD-CMB-03 walking into it costs a life in Base', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(200, 224));
  await step(page, 2);
  await step(page, 40, { move: 1, jumpHeld: false });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect((await cactus(page)).alive).toBe(true);
});

test('GDD-CMB-01 landing on it is a hit', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(216, 190));
  await step(page, 20);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect((await cactus(page)).alive).toBe(true);
});

test('GDD-CMB-02 a claw swipe passes through it: it stays and nothing hurts', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(194, 224));
  await step(page, 1, { move: 0, jumpHeld: false, claw: true });
  await step(page, 4);
  expect((await cactus(page)).alive).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-PWR-03 a fireball is used up by it and it stays', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(176, 224));
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await step(page, 1, { move: 0, jumpHeld: false, fuego: true });
  await step(page, 14);
  expect((await cactus(page)).alive).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.fireballs())).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});
