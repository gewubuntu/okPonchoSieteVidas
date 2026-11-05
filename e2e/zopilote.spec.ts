import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

// The sandbox has a Zopilote cruising at y = 64 from x = 216, between x = 168 and 264. Poncho on the floor is far below its 80 px
// reach. It spots him from the spring ledge (columns 13 and 14, top y = 112), the moving platform, and the Alacrán's platform at the low end of its bob.
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
type Colour = { r: number; g: number; b: number };
const vulture = async (page: Page) => (await api(page, () => window.__PONCHO__!.enemies()))[1]!;
const near = (c: Colour, [r, g, b]: [number, number, number]) => Math.abs(c.r - r) < 14 && Math.abs(c.g - g) < 14 && Math.abs(c.b - b) < 14;
const navy = (c: Colour) => near(c, [0x3a, 0x45, 0x80]); // the black plumage, navy #3A4580 (GDD-ART-06)
const red = (c: Colour) => near(c, [0xd8, 0x47, 0x3a]); // the telegraph flash, red #D8473A (GDD-ENM-01)
const pale = (c: Colour) => near(c, [0xff, 0xf4, 0xdc]) || near(c, [0xff, 0xf6, 0xd0]); // the cholla's spines, cloudTop #FFF4DC or sunDisc #FFF6D0
/** Points every half px over a box `dx0` to `dx1` px across from its middle (mirrored when it faces left) and `dy0` to `dy1` px down from it. */
const area = (x: number, y: number, dir: number, [dx0, dx1]: [number, number], [dy0, dy1]: [number, number]) => {
  const out: { x: number; y: number }[] = [];
  for (let dx = dx0; dx <= dx1; dx += 0.5) for (let dy = dy0; dy <= dy1; dy += 0.5) out.push({ x: x + dx * dir, y: y + dy });
  return out;
};
/** Its body, which is navy in every flap frame: 1 to 5 px behind its middle, 0 to 2 px below it. */
const body = (v: { x: number; y: number; dir: number }) => area(v.x, v.y, v.dir, [-5, -1], [0, 2]);
/** The look the scene drew it with (L-010: read back from its sprite). */
const drawnLook = async (page: Page) => (await api(page, () => window.__PONCHO__!.enemiesDrawn())).find((e) => e.kind === 'zopilote')!.look;
const ledge = (page: Page) => page.evaluate(() => window.__PONCHO__!.teleport(224, 112)); // on the spring ledge, 32 px below its line

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
  const painted = (await api(page, () => window.__PONCHO__!.enemiesDrawn())).find((e) => e.kind === 'zopilote')!;
  expect([painted.x, painted.y]).toEqual([now.x, now.y]);
  expect(painted.look).toMatch(/^flap[0-3]$/);
  expect(painted.flip).toBe(now.dir < 0);
  expect((await pixelsAt(page, body(now))).some(navy)).toBe(true);
});

test('GDD-CMB-01 three pale thorns along its back mark it as not stompable', async ({ page }) => {
  await start(page);
  await frames(page);
  const v = await vulture(page);
  // Its box is 16 x 10 px: its top is 5 px above its middle. The cholla's spines stand on its back there.
  expect((await pixelsAt(page, area(v.x, v.y, v.dir, [-8, 8], [-7, -3]))).filter(pale).length).toBeGreaterThanOrEqual(2);
});

test('GDD-ENM-01 it spots Poncho on the ledge, freezes and flashes for 0.5 s, then dives', async ({ page }) => {
  await start(page);
  await ledge(page);
  // Stepped until it spots him: that step is age 0 of its telegraph.
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 10 && d.enemies()[1]!.phase !== 'telegraph'; k++) d.step(1);
  });
  expect((await vulture(page)).phase).toBe('telegraph');
  const frozen = await vulture(page);
  // It is red (teleRed) for the first 4 steps of every 8 counted from age 0, and plain (tele) for the other 4.
  let age = 0;
  for (const [at, look] of [[0, 'teleRed'], [3, 'teleRed'], [4, 'tele'], [7, 'tele'], [8, 'teleRed'], [12, 'tele']] as const) {
    await step(page, at - age);
    age = at;
    await frames(page);
    const now = await vulture(page);
    expect([now.x, now.y]).toEqual([frozen.x, frozen.y]);
    expect(await drawnLook(page), `age ${at}`).toBe(look);
    const colours = await pixelsAt(page, area(now.x, now.y, now.dir, [-6, 1], [-3, 2]));
    expect(colours.some(red), `age ${at} red`).toBe(look === 'teleRed');
    if (look === 'tele') expect(colours.some(navy), `age ${at} navy`).toBe(true);
  }
  await step(page, 30 - age);
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
  expect((await api(page, () => window.__PONCHO__!.enemiesDrawn())).filter((e) => e.kind === 'zopilote')).toEqual([]);
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
