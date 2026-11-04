import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

// The sandbox has a Tlacuache on the ledge in the top right corner (row 6, columns 25 to 29, x 400 to 480, top y = 96). It starts at
// x = 440 heading right and walks the ledge from x = 408 to 472. Its box is 16 x 10 px, so its top is y = 86.
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
type Colour = { r: number; g: number; b: number };
const opossum = async (page: Page) => (await api(page, () => window.__PONCHO__!.enemies()))[3]!;
const near = (c: Colour, [r, g, b]: [number, number, number]) => Math.abs(c.r - r) < 14 && Math.abs(c.g - g) < 14 && Math.abs(c.b - b) < 14;
const grey = (c: Colour) => near(c, [0x8e, 0x6a, 0x96]); // the grizzled fur, purple #8E6A96 (GDD-ART-06)
const red = (c: Colour) => near(c, [0xd8, 0x47, 0x3a]); // the telegraph flash, red #D8473A (GDD-ENM-01)
/**
 * Points every half px over its back, where its fur is in every walk and telegraph frame: 1 to 7 px behind its middle (the way it faces
 * decides which side is behind) and 5 to 6 px above its feet (y = 96).
 */
const back = (x: number, dir: number) => [-7, -6, -5, -4, -3, -2, -1].flatMap((dx) => [0, 0.5].flatMap((h) => [-6, -5.5, -5].map((dy) => ({ x: x + (dx + h) * dir, y: 96 + dy }))));
/** The look the scene drew it with (L-010: read back from its sprite). */
const drawnLook = async (page: Page) => (await api(page, () => window.__PONCHO__!.enemiesDrawn())).find((e) => e.kind === 'tlacuache')!.look;
const out = (page: Page) => page.evaluate(() => window.__PONCHO__!.teleport(24, 224)); // back near the start, far from it
const stompFrom = async (page: Page) => {
  const { x } = await opossum(page);
  await page.evaluate((ox) => window.__PONCHO__!.teleport(ox, 80), x); // 6 px above its top, falling onto it
  for (let i = 0; i < 20; i++) {
    await step(page, 1);
    const now = await opossum(page);
    if (now.phase === 'dead' || !now.alive) return;
  }
};

test('GDD-ENM-02 the Tlacuache walks its ledge and is painted where it is', async ({ page }) => {
  await start(page);
  for (let i = 0; i < 20; i++) {
    await step(page, 10);
    const { x, y, phase } = await opossum(page);
    expect(y).toBe(96);
    expect(phase).toBe('walk');
    expect(x).toBeGreaterThanOrEqual(408 - 0.001);
    expect(x).toBeLessThanOrEqual(472);
  }
  await frames(page);
  const now = await opossum(page);
  const painted = (await api(page, () => window.__PONCHO__!.enemiesDrawn())).find((e) => e.kind === 'tlacuache')!;
  expect([painted.x, painted.y]).toEqual([now.x, now.y]);
  expect(painted.look).toMatch(/^walk[0-3]$/);
  expect(painted.flip).toBe(now.dir < 0);
  expect((await pixelsAt(page, back(now.x, now.dir))).some(grey)).toBe(true);
});

test('GDD-ENM-01 it spots Poncho on its ledge, freezes and flashes for 0.5 s, then charges', async ({ page }) => {
  await start(page);
  const { x, dir } = await opossum(page);
  await page.evaluate(([ox, d]) => window.__PONCHO__!.teleport(ox! + d! * 24, 96), [x, dir]); // 24 px in front of it, clear of the level edge
  await step(page, 1); // the step it spots him: age 0 of its telegraph
  expect((await opossum(page)).phase).toBe('telegraph');
  const frozen = await opossum(page);
  // It is red (teleRed) for the first 4 steps of every 8 counted from age 0, and plain (tele) for the other 4.
  let age = 0;
  for (const [at, look] of [[0, 'teleRed'], [3, 'teleRed'], [4, 'tele'], [7, 'tele'], [8, 'teleRed'], [12, 'tele']] as const) {
    await step(page, at - age);
    age = at;
    await frames(page);
    const now = await opossum(page);
    expect(now.x).toBe(frozen.x);
    expect(await drawnLook(page), `age ${at}`).toBe(look);
    const colours = await pixelsAt(page, back(now.x, now.dir));
    expect(colours.some(red), `age ${at} red`).toBe(look === 'teleRed');
    if (look === 'tele') expect(colours.some(grey), `age ${at} grey`).toBe(true);
  }
  await step(page, 30 - age);
  expect((await opossum(page)).phase).toBe('charge');
});

test('GDD-CMB-01 the first stomp makes it play dead, and after it wakes the second defeats it', async ({ page }) => {
  await start(page);
  await stompFrom(page);
  expect(await opossum(page)).toMatchObject({ alive: true, phase: 'dead' });
  expect(await api(page, () => window.__PONCHO__!.state().vy)).toBeLessThan(0); // bounced
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await out(page);
  await step(page, 60);
  expect((await opossum(page)).phase).toBe('dead');
  await frames(page);
  expect((await api(page, () => window.__PONCHO__!.enemiesDrawn())).some((e) => e.kind === 'tlacuache')).toBe(true); // drawn lying there
  await step(page, 60);
  expect((await opossum(page)).phase).toBe('walk');
  await stompFrom(page);
  expect((await opossum(page)).alive).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await frames(page);
  expect((await api(page, () => window.__PONCHO__!.enemiesDrawn())).some((e) => e.kind === 'tlacuache')).toBe(false);
});

test('GDD-ENM-02 playing dead, its feet twitch only in the last 0.5 s before it wakes', async ({ page }) => {
  await start(page);
  await stompFrom(page); // this step is the first of its 120 playing dead (age 0)
  await out(page);
  // Lying on its back its feet stick up (dead); they curl (deadTwitch) in its last 30 steps (from age 90), on 4 steps of every 8 counted
  // from age 0, so ages 88 to 91 are a shown phase: age 89 must be still, age 90 must twitch.
  let done = 0;
  for (const [age, still] of [[4, true], [60, true], [89, true], [90, false], [94, true], [96, false]] as const) {
    await step(page, age - done);
    done = age;
    await frames(page);
    expect((await opossum(page)).phase, `age ${age}`).toBe('dead');
    expect(await drawnLook(page), `age ${age}`).toBe(still ? 'dead' : 'deadTwitch');
  }
});

test('GDD-CMB-02 a claw swipe defeats it without a stomp', async ({ page }) => {
  await start(page);
  const { x, dir } = await opossum(page);
  // Behind it, so it does not spot him, facing it.
  await page.evaluate(([ox, d]) => window.__PONCHO__!.teleport(ox! - d! * 16, 96), [x, dir]);
  await step(page, 1, { move: dir, jumpHeld: false });
  await step(page, 1, { move: 0, jumpHeld: false, claw: true });
  await step(page, 4);
  expect((await opossum(page)).alive).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-LIFE-02 losing a life brings it back at its start, to be stomped twice again', async ({ page }) => {
  await start(page);
  await stompFrom(page);
  expect((await opossum(page)).phase).toBe('dead');
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(248, 150); // into the pit
    window.__PONCHO__!.step(140);
  });
  expect(await opossum(page)).toMatchObject({ alive: true, phase: 'walk' });
  await stompFrom(page);
  expect(await opossum(page)).toMatchObject({ alive: true, phase: 'dead' });
});
