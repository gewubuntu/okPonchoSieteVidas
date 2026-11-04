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
const near = (c: Colour, [r, g, b]: [number, number, number]) => Math.abs(c.r - r) < 14 && Math.abs(c.g - g) < 14 && Math.abs(c.b - b) < 14;
const body = (c: Colour) => near(c, [0xa0, 0x47, 0x2f]); // the scorpion's red-brown, earth #A0472F (GDD-ART-06)
const honey = (c: Colour) => near(c, [0xf0, 0x8a, 0x3c]); // the pincers, orange #F08A3C
/** Points every half px over a box `dx0` to `dx1` px across from `x` and `dy0` to `dy1` px down from its feet (y = 160). */
const area = (x: number, [dx0, dx1]: [number, number], [dy0, dy1]: [number, number]) => {
  const out: { x: number; y: number }[] = [];
  for (let dx = dx0; dx <= dx1; dx += 0.5) for (let dy = dy0; dy <= dy1; dy += 0.5) out.push({ x: x + dx, y: 160 + dy });
  return out;
};
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
  // The pincers are 3.5 to 6 px in front of its middle, 3 to 7 px above its feet, in every walk frame.
  const clawsAt = async (side: number) => {
    const { x } = await enemy(page);
    return (await pixelsAt(page, area(x, side > 0 ? [3.5, 6] : [-6, -3.5], [-7, -3]))).some(honey);
  };
  await frames(page);
  const first = (await enemy(page)).dir;
  expect(await clawsAt(first)).toBe(true);
  expect(await clawsAt(-first)).toBe(false);
  expect((await scorpionsDrawn(page))[0]!.flip).toBe(first < 0); // its sprite mirrored when it faces left
  while ((await enemy(page)).dir === first) await step(page, 10); // walks on until it turns round
  await frames(page);
  const turned = (await enemy(page)).dir;
  expect(turned).toBe(-first);
  expect(await clawsAt(turned)).toBe(true);
  expect(await clawsAt(-turned)).toBe(false);
  const [painted] = await scorpionsDrawn(page);
  expect(painted!.y).toBe(160);
  expect(painted!.flip).toBe(turned < 0);
});

test('GDD-ENM-02 the scorpion is painted as a dark red body, and a defeated one leaves the picture', async ({ page }) => {
  await start(page);
  await frames(page);
  const { x } = await enemy(page);
  const around = area(x, [-2, 2], [-7, -3]); // its body, in every walk frame
  expect((await pixelsAt(page, around)).some(body)).toBe(true);
  expect((await scorpionsDrawn(page))[0]!.look).toMatch(/^walk[0-3]$/);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex, 140), x);
  // Stepped until the stomp defeats it: that step is age 0 of its squash, then the poof, gone after 24 steps (0.4 s, DEFEAT_FX_STEPS).
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 20 && d.enemies()[0]!.alive; k++) d.step(1);
    d.teleport(300, 100); // out of the way
    const looks: string[] = [];
    for (let age = 0; age <= 24; age++) {
      if (age > 0) d.step(1);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      looks.push(d.defeatsDrawn().map((e) => `${e.kind} ${e.look}`).join());
    }
    return { looks, alive: d.enemies()[0]!.alive };
  });
  expect(seen.alive).toBe(false);
  expect(seen.looks[0]).toBe('alacran squash');
  expect(seen.looks[8]).toBe('alacran poof0');
  expect(seen.looks[23]).toBe('alacran poof3');
  expect(seen.looks[24]).toBe(''); // nothing left of it
  expect(await scorpionsDrawn(page)).toEqual([]);
  expect((await pixelsAt(page, around)).some(body)).toBe(false);
});
