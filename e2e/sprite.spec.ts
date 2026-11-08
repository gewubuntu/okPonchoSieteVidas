import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
/** Waits for Poncho to stand on the floor after the title screen. */
const settled = (page: Page) => page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
// A pixel of the user's drawing (GDD-ART-02) where the poncho is a solid blue, #3F66B1: the drawing's cell (50, 10) and its eight
// neighbours are all blue. The frame is 192 art px square (GDD-ART-04: 48 game px) and its middle column is on his x, its bottom row on
// his feet; the drawing starts 48 art px from the frame's left (with the tail's room) and 50 from its top (scripts/art/poncho/rig.mjs
// ORIGIN, 24 and 25 drawing px), each cell 2 x 2 art px. That cell's middle is at art pixel (149, 71), which is 13.25 game px right of his
// x and 30.25 above his feet, as in the 40 px frame before it: the drawing keeps its place on his body box.
const BLUE = { r: 0x3f, g: 0x66, b: 0xb1 };
const BLUE_AT = { right: 13.25, above: 30.25 };
const near = (c: { r: number; g: number; b: number }, want: { r: number; g: number; b: number }) =>
  Math.abs(c.r - want.r) <= 24 && Math.abs(c.g - want.g) <= 24 && Math.abs(c.b - want.b) <= 24;

test('GDD-ART-01 the canvas is 1920 x 1080', async ({ page }) => {
  await openGame(page);
  expect(await api(page, () => ({ w: document.querySelector('canvas')!.width, h: document.querySelector('canvas')!.height }))).toEqual({ w: 1920, h: 1080 });
});

test('GDD-ART-04 standing, Poncho shows the standing frame, 48 game px wide, feet on the floor', async ({ page }) => {
  await boot(page);
  await settled(page);
  await page.waitForTimeout(100);
  const sprite = await api(page, () => window.__PONCHO__!.ponchoSprite());
  const s = await api(page, () => window.__PONCHO__!.state());
  expect(sprite).toMatchObject({ width: 48, height: 48 });
  expect([0, 5]).toContain(sprite.frame); // idle, or blink (GDD-ART-04: the last 6 of every 180 steps standing)
  expect(['idle', 'blink']).toContain(sprite.look);
  expect(sprite.bottom).toBe(s.y);
  expect(sprite.centerX).toBe(s.x);
});

test('GDD-ART-04 running right plays the run frames in order, facing right', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await settled(page);
  // Step by step with the game paused, so no frame is skipped: on slow frames one drawn frame can hold up to 5 steps (10 px),
  // more than the 8 px of a run frame (L-042).
  const { frames, flipX } = await page.evaluate(() => {
    const p = window.__PONCHO__!;
    p.pause(true);
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      p.step(1, { move: 1, jumpHeld: false });
      seen.push(p.ponchoSprite().frame);
    }
    return { frames: seen, flipX: p.ponchoSprite().flipX };
  });
  // The first step can still show the standing frame; from the first run frame on, each change goes to the next.
  const running = frames.filter((f) => f !== 0);
  const changes = running.filter((f, i) => i === 0 || f !== running[i - 1]);
  expect(changes.slice(0, 5), JSON.stringify(frames)).toEqual([1, 2, 3, 4, 1]);
  expect(flipX).toBe(false);
});

test('GDD-ART-04 facing left mirrors him', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await settled(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().x < 40);
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0);
  await page.waitForTimeout(100);
  const sprite = await api(page, () => window.__PONCHO__!.ponchoSprite());
  expect(sprite.flipX).toBe(true);
  expect(['idle', 'blink']).toContain(sprite.look);
});

test('GDD-ART-04 in the air he shows the air frames by his speed, not the run frames', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await settled(page);
  // Step by step with the game paused (L-042): run until a run frame shows, jump, and read the frame on every step in the air.
  const seen = await page.evaluate(() => {
    const p = window.__PONCHO__!;
    p.pause(true);
    for (let i = 0; i < 60 && !p.ponchoSprite().look.startsWith('run'); i++) p.step(1, { move: 1, jumpHeld: false });
    const running = p.ponchoSprite().look;
    const air: { look: string; vy: number }[] = [];
    p.step(1, { move: 1, jumpHeld: true });
    for (let i = 0; i < 120 && !p.state().grounded; i++) {
      air.push({ look: p.ponchoSprite().look, vy: p.state().vy });
      p.step(1, { move: 1, jumpHeld: true });
    }
    return { running, air };
  });
  expect(seen.running).toMatch(/^run/);
  expect(seen.air.length).toBeGreaterThan(10);
  // GDD-ART-04: jump0 for the first 4 steps of the take-off, then by his speed (px/s, down positive): jump1 under -120, the apex under 60,
  // the fall under 250, the fast fall from 250.
  expect(seen.air.slice(0, 4).map((s) => s.look)).toEqual(['jump0', 'jump0', 'jump0', 'jump0']);
  for (const s of seen.air.slice(4)) expect(s.look, `vy ${s.vy}`).toBe(s.vy < -120 ? 'jump1' : s.vy < 60 ? 'apex' : s.vy < 250 ? 'fall0' : 'fall1');
});

test('GDD-ART-02 his sprite is drawn on screen', async ({ page }) => {
  await boot(page);
  await settled(page);
  await page.waitForTimeout(100);
  const s = await api(page, () => window.__PONCHO__!.state());
  const [poncho] = await pixelsAt(page, [{ x: s.x + BLUE_AT.right, y: s.y - BLUE_AT.above }]);
  expect(near(poncho!, BLUE), JSON.stringify(poncho)).toBe(true);
});

test('GDD-UI-02 the title screen shows the standing frame beside the title', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(300);
  const title = await api(page, () => window.__PONCHO__!.titleDrawn());
  expect(title.ponchoShown).toBe(true);
  expect(title.ponchoBottom).toBe(104);
  expect(title.ponchoRight).toBeLessThan(240 - 57); // left of both lines: "PONCHO" is the wider, 115 px
  const [poncho] = await pixelsAt(page, [{ x: title.ponchoRight - 24 + BLUE_AT.right, y: title.ponchoBottom - BLUE_AT.above }]); // his frame is 48 px wide
  expect(near(poncho!, BLUE), JSON.stringify(poncho)).toBe(true);
});
