import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

// The sandbox has a Zopilote cruising at y = 64 from x = 216, between x = 168 and 264. Poncho on the floor is far below its 80 px
// reach; it spots him from the spring ledge (columns 13 and 14, top y = 128), the moving platform, and the Alacrán's platform at the low end of its bob.
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
type Colour = { r: number; g: number; b: number };
const vulture = async (page: Page) => (await api(page, () => window.__PONCHO__!.enemies()))[1]!;
const brown = (c: Colour) => Math.abs(c.r - 74) < 12 && Math.abs(c.g - 58) < 12 && Math.abs(c.b - 48) < 12; // the body, 4a3a30
const red = (c: Colour) => c.r > 220 && c.g < 120 && c.b < 90; // the telegraph flash, ff5030
const pale = (c: Colour) => c.r > 220 && c.g > 220 && c.b > 205; // the thorns, f2efe6
const ledge = (page: Page) => page.evaluate(() => window.__PONCHO__!.teleport(224, 128)); // on the spring ledge, 57 px below its line

test('GDD-ENM-02 the Zopilote cruises on its line, bobbing, and is painted where it is', async ({ page }) => {
  await start(page);
  const first = await vulture(page);
  expect(first).toMatchObject({ alive: true, phase: 'cruise' });
  expect(first.x).toBeGreaterThanOrEqual(168);
  expect(first.x).toBeLessThanOrEqual(264);
  let lowest = Infinity;
  let highest = -Infinity;
  for (let i = 0; i < 30; i++) {
    await step(page, 5);
    const { x, y } = await vulture(page);
    expect(x).toBeGreaterThanOrEqual(168);
    expect(x).toBeLessThanOrEqual(264);
    lowest = Math.min(lowest, y);
    highest = Math.max(highest, y);
  }
  expect(highest - lowest).toBeGreaterThan(10); // it bobs about 12 px up and down
  expect(highest).toBeLessThanOrEqual(64 + 12);
  expect(lowest).toBeGreaterThanOrEqual(64 - 12);
  await frames(page);
  const now = await vulture(page);
  const painted = (await api(page, () => window.__PONCHO__!.enemiesDrawn())).find((e) => e.y !== 160)!;
  expect([painted.x, painted.y]).toEqual([now.x, now.y]);
  expect((await pixelsAt(page, [{ x: Math.round(now.x), y: Math.round(now.y) + 1 }])).some(brown)).toBe(true);
});

test('GDD-CMB-01 three pale thorns along its back mark it as not stompable', async ({ page }) => {
  await start(page);
  await frames(page);
  const { x, y } = await vulture(page);
  const thorns = [-4, 0, 4].map((dx) => ({ x: Math.round(x + dx), y: Math.round(y) - 3 }));
  expect((await pixelsAt(page, thorns)).filter(pale).length).toBeGreaterThanOrEqual(2);
});

test('GDD-ENM-01 it spots Poncho on the ledge, freezes and flashes for 0.5 s, then dives', async ({ page }) => {
  await start(page);
  await ledge(page);
  await step(page, 3);
  expect((await vulture(page)).phase).toBe('telegraph');
  const frozen = await vulture(page);
  let flashed = false;
  let plain = false;
  for (let i = 0; i < 6; i++) {
    await step(page, 4);
    await frames(page);
    const now = await vulture(page);
    expect([now.x, now.y]).toEqual([frozen.x, frozen.y]);
    const colours = await pixelsAt(page, [{ x: Math.round(now.x), y: Math.round(now.y) + 1 }]);
    flashed ||= colours.some(red);
    plain ||= colours.some(brown);
  }
  expect(flashed).toBe(true);
  expect(plain).toBe(true);
  await step(page, 8);
  expect((await vulture(page)).phase).toBe('dive');
});

test('GDD-CMB-03 the dive costs a life in Base when Poncho stays put', async ({ page }) => {
  await start(page);
  await ledge(page);
  await step(page, 100);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect((await vulture(page)).alive).toBe(true);
});

test('GDD-CMB-01 landing on it is a hit, not a stomp', async ({ page }) => {
  await start(page);
  const { x, y } = await vulture(page);
  await page.evaluate(([vx, vy]) => window.__PONCHO__!.teleport(vx!, vy! - 8), [x, y]);
  await step(page, 12);
  expect((await vulture(page)).alive).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
});

test('GDD-CMB-02 a claw swipe defeats it, and it is gone from the picture', async ({ page }) => {
  await start(page);
  const { x, y } = await vulture(page);
  await page.evaluate(([vx, vy]) => window.__PONCHO__!.teleport(vx! - 14, vy! + 6), [x, y]);
  await step(page, 1, { move: 0, jumpHeld: false, claw: true });
  await step(page, 4);
  expect((await vulture(page)).alive).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await frames(page);
  expect((await api(page, () => window.__PONCHO__!.enemiesDrawn())).filter((e) => e.y !== 160)).toEqual([]);
});

test('GDD-PWR-03 a fireball defeats it and is used up', async ({ page }) => {
  await start(page);
  const { x, y } = await vulture(page);
  await page.evaluate(([vx, vy]) => window.__PONCHO__!.teleport(vx! - 22, vy! + 12), [x, y]);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await step(page, 1, { move: 0, jumpHeld: false, fuego: true });
  await step(page, 10);
  expect((await vulture(page)).alive).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.fireballs())).toBe(0);
});

test('GDD-LIFE-02 losing a life brings it back', async ({ page }) => {
  await start(page);
  const { x, y } = await vulture(page);
  await page.evaluate(([vx, vy]) => window.__PONCHO__!.teleport(vx! - 14, vy! + 6), [x, y]);
  await step(page, 1, { move: 0, jumpHeld: false, claw: true });
  await step(page, 4);
  expect((await vulture(page)).alive).toBe(false);
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(248, 150); // into the pit
    window.__PONCHO__!.step(140);
  });
  expect((await vulture(page)).alive).toBe(true);
});
