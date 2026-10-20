import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt, red } from './helpers';

const FLOOR = 224; // the sandbox floor, and the level start is at x = 56
const pose = (page: Page) => page.evaluate(() => ({ ...window.__PONCHO__!.bodyPose(), visible: window.__PONCHO__!.bodyVisible() }));
/** The pale strip along the feet of the placeholder body. */
const cream = (c: { r: number; g: number; b: number }) => c.r > 200 && c.g > 190 && c.b > 170;
const step = (page: Page, n: number, input?: { move: number; jumpHeld: boolean }) =>
  page.evaluate(([k, i]) => window.__PONCHO__!.step(k, i), [n, input] as const);

/** Drops Poncho into the pit with the game paused, and steps to the first step of the 0.8 s wait (48 steps left). */
async function fallIntoPit(page: Page) {
  await boot(page);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(248, 150); // above the pit
  });
  for (let i = 0; i < 200 && (await page.evaluate(() => window.__PONCHO__!.phase())) !== 'respawning'; i++) await step(page, 1);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('respawning');
}

test('GDD-LIFE-02 Poncho is hidden for the first part of the wait, then drops in above the level start', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 26); // 22 steps of the wait left: the flip has not started
  expect((await pose(page)).visible).toBe(false);
  await step(page, 1); // 21 left: the first step of the flip
  const first = await pose(page);
  expect(first.visible).toBe(true);
  expect(first.x).toBe(56);
  expect(FLOOR - first.y).toBeGreaterThan(46); // about 48 px above the ground
  expect(FLOOR - first.y).toBeLessThanOrEqual(48);
  expect(first.rotation).toBeGreaterThan(0);
  expect(first.rotation).toBeLessThan(0.5);
});

test('GDD-MOV-05 he turns once and lands feet-first on the last step of the wait, and does not jump when control returns', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 27); // the first step of the flip
  let last = await pose(page);
  // The engine reports the angle wrapped to -pi..pi, so follow the turn as the sum of the small changes.
  let turned = last.rotation;
  for (let i = 0; i < 19; i++) {
    await step(page, 1);
    const now = await pose(page);
    expect(now.y).toBeGreaterThan(last.y); // falling
    const delta = (now.rotation - last.rotation + 2 * Math.PI) % (2 * Math.PI);
    expect(delta).toBeGreaterThan(0.1); // and turning the same way every step
    expect(delta).toBeLessThan(0.5);
    turned += delta;
    last = now;
  }
  await step(page, 1); // one step of the wait left: on the ground, a whole turn done
  last = await pose(page);
  expect(last.y).toBe(FLOOR);
  expect(Math.cos(last.rotation)).toBeCloseTo(1, 5); // upright, feet down
  expect(turned).toBeGreaterThan(2 * Math.PI - 0.5); // after one whole turn, not a half or two
  expect(turned).toBeLessThan(2 * Math.PI);
  await step(page, 1); // the wait is over: playing, upright, same place
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  const landed = await pose(page);
  expect(landed.y).toBe(FLOOR);
  expect(landed.rotation).toBe(0);
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: FLOOR, grounded: true });
});

test('GDD-MOV-05 the drawn body really turns: the pale feet strip is up when he is upside down, down when upright', async ({ page }) => {
  await fallIntoPit(page);
  // A point of the body in its own frame (x to the right, y down from the middle), where it is on the screen now.
  const onScreen = async (lx: number, ly: number) => {
    const p = await pose(page);
    const cy = p.y - 7; // the middle of the 14 px body
    return { x: p.x + lx * Math.cos(p.rotation) - ly * Math.sin(p.rotation), y: cy + lx * Math.sin(p.rotation) + ly * Math.cos(p.rotation) };
  };

  await step(page, 27 + 10); // wait 11: upside down, about 188 degrees
  const [feet, upper] = await pixelsAt(page, [await onScreen(0, 5.5), await onScreen(0, -3)]);
  expect(cream(feet!)).toBe(true); // the strip along the feet
  expect(red(upper!)).toBeGreaterThan(90); // and the red body above it in his own frame
  const [stripIfUpright] = await pixelsAt(page, [{ x: (await pose(page)).x, y: (await pose(page)).y - 1.5 }]); // where the strip would be if he had not turned
  expect(cream(stripIfUpright!)).toBe(false); // the bottom of the picture is body now, not the strip

  await step(page, 10); // wait 1 left, then 1 more: landed, upright
  await step(page, 1);
  await step(page, 120); // out of the blink, fully opaque
  const p = await pose(page);
  const [bottom, top] = await pixelsAt(page, [{ x: p.x, y: p.y - 1.5 }, { x: p.x, y: p.y - 12 }]);
  expect(cream(bottom!)).toBe(true); // upright: the strip is at the feet
  expect(red(top!)).toBeGreaterThan(90);
});

test('GDD-LIFE-02 the flip lands at the latest ofrenda, not the level start', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(312, 224); // on the second ofrenda...
  });
  await step(page, 2);
  expect(await page.evaluate(() => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 312, y: FLOOR });
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // ...then fall into the pit
  for (let i = 0; i < 200 && (await page.evaluate(() => window.__PONCHO__!.phase())) !== 'respawning'; i++) await step(page, 1);
  await step(page, 27 + 10); // in the middle of the flip
  const middle = await pose(page);
  expect(middle.visible).toBe(true);
  expect(middle.x).toBe(312);
  await step(page, 11); // landed and respawned
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 312, y: FLOOR, grounded: true });
});

test('GDD-LIFE-05 after the last life the flip lands at the level start, not at the ofrenda', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(312, 224); // the second ofrenda is the checkpoint...
  });
  await step(page, 2);
  expect(await page.evaluate(() => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 312 });
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife()); // ...but only one life is left
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  for (let i = 0; i < 200 && (await page.evaluate(() => window.__PONCHO__!.phase())) !== 'respawning'; i++) await step(page, 1);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(0);
  await step(page, 27 + 10); // in the middle of the flip
  const middle = await pose(page);
  expect(middle.visible).toBe(true);
  expect(middle.x).toBe(56); // over the level start
  await step(page, 11);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: FLOOR });
});

test('GDD-LIFE-02 a skip in the middle of the flip puts him upright at the respawn point at once', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 27 + 10); // wait 11: upside down in mid-air
  const before = await pose(page);
  expect(before.y).toBeLessThan(FLOOR - 20);
  expect(Math.abs(Math.cos(before.rotation) - 1)).toBeGreaterThan(0.5); // clearly not upright
  await step(page, 1, { move: 1, jumpHeld: false }); // any input after 0.3 s skips the rest of the wait
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  const after = await pose(page);
  expect(after).toMatchObject({ x: 56, y: FLOOR, rotation: 0, visible: true });
});

test('GDD-LIFE-02 a skip before the flip starts never shows a flip', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 20); // 28 steps of the wait left, still hidden
  expect((await pose(page)).visible).toBe(false);
  await step(page, 1, { move: 1, jumpHeld: false }); // skipped: no flip is drawn
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  expect(await pose(page)).toMatchObject({ x: 56, y: FLOOR, rotation: 0, visible: true });
});
