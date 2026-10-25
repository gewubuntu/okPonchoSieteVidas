import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

// The sandbox level has an Alacrán on the platform in row 10, columns 4 to 7 (x 64 to 128, top y = 160). It starts at x = 104
// heading right and turns at x = 137 and x = 71 (the game runs a few steps before a test pauses it). The piñata at column 8,
// row 10 (x 128 to 144, same top) at the platform's right end extends the ground it walks to x = 144 (GDD-MOV-06).
// Poncho reaches the platform from the top of the 2-tile wall.
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};
const step = (page: Page, n: number, input: { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean } = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
type Colour = { r: number; g: number; b: number };
const body = (c: Colour) => c.r > 130 && c.r < 180 && c.g < 90 && c.b < 70; // the scorpion's dark red, 154 58 42
const pale = (c: Colour) => c.r > 200 && c.g > 190 && c.b > 140; // the claws' 233 211 163
const enemy = async (page: Page) => (await api(page, () => window.__PONCHO__!.enemies()))[0]!;
// The sandbox also has a Zopilote, high up (e2e/zopilote.spec.ts); the Alacrán is the one standing on y = 160.
const scorpionsDrawn = (page: Page) => api(page, () => window.__PONCHO__!.enemiesDrawn().filter((e) => e.kind === 'alacran'));

test('GDD-ENM-02 the Alacrán patrols its platform, turns at both ends and is painted where it is', async ({ page }) => {
  await start(page);
  const x0 = (await enemy(page)).x;
  expect(x0).toBeGreaterThanOrEqual(104);
  expect(x0).toBeLessThan(137 - 10);
  await step(page, 20);
  expect((await enemy(page)).x).toBe(x0 + 10); // 0.5 px a step, heading right
  // Every step for two full round trips (328 steps each), so the turns at 71 and 137 are caught whatever the phase it started in.
  const { min, max } = await page.evaluate(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 700; i++) {
      window.__PONCHO__!.step(1, { move: 0, jumpHeld: false });
      const { x } = window.__PONCHO__!.enemies()[0]!;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    return { min: lo, max: hi };
  });
  expect(min).toBeGreaterThanOrEqual(71);
  expect(min).toBe(71);
  expect(max).toBe(137);
  await frames(page);
  const [painted] = await scorpionsDrawn(page);
  expect(painted!.x).toBe((await enemy(page)).x);
});

test('GDD-CMB-01 landing on it defeats it and bounces Poncho, and it is gone from the picture', async ({ page }) => {
  await start(page);
  const { x } = await enemy(page);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex, 140), x); // above its top (y = 150), falling
  await step(page, 8);
  expect((await enemy(page)).alive).toBe(false);
  expect((await api(page, () => window.__PONCHO__!.state())).vy).toBeLessThan(0); // thrown up
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await frames(page);
  expect(await scorpionsDrawn(page)).toEqual([]);
});

test('GDD-CMB-03 walking into it costs a life in Base', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(80, 160));
  await step(page, 2);
  await step(page, 60, { move: 1, jumpHeld: false });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect((await enemy(page)).alive).toBe(true);
});

test('GDD-CMB-03 walking into it in Taco costs only the taco', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(80, 160));
  await step(page, 2);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await step(page, 60, { move: 1, jumpHeld: false }); // the 2.0 s of invulnerability after the hit are still running
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect((await enemy(page)).alive).toBe(true);
});

test('GDD-CMB-02 a claw swipe defeats it', async ({ page }) => {
  await start(page);
  const { x } = await enemy(page);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex - 20, 160), x);
  await step(page, 2);
  await step(page, 1, { move: 0, jumpHeld: false, claw: true });
  await step(page, 4);
  expect((await enemy(page)).alive).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-PWR-03 a fireball defeats it and is used up', async ({ page }) => {
  await start(page);
  const { x } = await enemy(page);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex - 24, 160), x); // close, so the fireball is still low when it reaches it
  await step(page, 2);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await step(page, 1, { move: 0, jumpHeld: false, fuego: true });
  await step(page, 12);
  expect((await enemy(page)).alive).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.fireballs())).toBe(0);
});

test('GDD-LIFE-02 losing a life brings it back to life', async ({ page }) => {
  await start(page);
  const { x } = await enemy(page);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex, 140), x);
  await step(page, 8);
  expect((await enemy(page)).alive).toBe(false);
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(248, 150); // into the pit
    window.__PONCHO__!.step(140);
  });
  const back = await enemy(page); // it has been patrolling again since the respawn, so only its being alive is read here
  expect(back.alive).toBe(true);
});

test('GDD-ENM-02 the pale claws are on the side it is walking towards, and swap when it turns', async ({ page }) => {
  await start(page);
  const clawsAt = async (side: number) => {
    const { x } = await enemy(page);
    const cx = Math.round(x + side * 6.5);
    return (await pixelsAt(page, [-1, 0, 1].flatMap((dx) => [154, 155, 158].map((y) => ({ x: cx + dx, y }))))).some(pale);
  };
  await frames(page);
  const first = (await enemy(page)).dir;
  expect(await clawsAt(first)).toBe(true);
  expect(await clawsAt(-first)).toBe(false);
  while ((await enemy(page)).dir === first) await step(page, 10); // walks on until it turns round
  await frames(page);
  const turned = (await enemy(page)).dir;
  expect(turned).toBe(-first);
  expect(await clawsAt(turned)).toBe(true);
  expect(await clawsAt(-turned)).toBe(false);
  const [painted] = await scorpionsDrawn(page);
  expect(painted!.y).toBe(160);
});

test('GDD-ENM-02 the scorpion is painted as a dark red body, and a defeated one leaves the picture', async ({ page }) => {
  await start(page);
  await frames(page);
  const { x } = await enemy(page);
  const around = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: x + dx, y: 160 - 4 + dy })));
  expect((await pixelsAt(page, around)).some(body)).toBe(true);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex, 140), x);
  await step(page, 8);
  await page.evaluate(() => window.__PONCHO__!.teleport(300, 100)); // out of the way
  await frames(page);
  expect((await pixelsAt(page, around)).some(body)).toBe(false);
});
