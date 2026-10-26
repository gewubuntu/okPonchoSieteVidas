import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt, stepUntil } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
type Input = { move: number; jumpHeld: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
const drawn = (page: Page) => api(page, () => window.__PONCHO__!.gameOverDrawn());
type Colour = { r: number; g: number; b: number };
const brightness = (c: Colour) => c.r + c.g + c.b;
const pale = (c: Colour) => Math.abs(c.r - 155) < 30 && Math.abs(c.g - 163) < 30 && Math.abs(c.b - 196) < 30; // the triangles, 9ba3c4

// The screen: the level dimmed, "Siete vidas gastadas", seven outline triangles 14 x 12 px with 2 px lines, 6 px apart, centred
// (x 173 to 307), from y = 138 to 150, and a prompt line once a press would be taken.
const triangleBottoms = Array.from({ length: 7 }, (_, i) => ({ x: 173 + i * 20 + 7, y: 150 }));
const floorTile = { x: 296, y: 248 }; // a floor tile past the pit, clear of the touch buttons (which stay on top)

/** Paused, with one life left, Poncho dropped into the pit: returns once the last life is lost. */
async function lastLife(page: Page): Promise<void> {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await stepUntil(page, { phase: 'respawning' }, 200);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(0);
}

test('GDD-LIFE-05 the screen comes up when the wait after the last life ends, over the dimmed level', async ({ page }) => {
  await lastLife(page);
  await frames(page);
  const before = (await pixelsAt(page, [floorTile]))[0]!;
  await step(page, 47);
  await frames(page);
  expect((await drawn(page)).shown).toBe(false);
  await step(page, 1);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
  expect(await drawn(page)).toEqual({ shown: true, title: 'Siete vidas gastadas', subtitle: 'Game over', prompt: false, promptText: 'Press any button to Retry' });
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(false);
  const after = (await pixelsAt(page, [floorTile]))[0]!;
  expect(brightness(after)).toBeLessThan(brightness(before) / 2);
});

test('GDD-LIFE-05 it shows seven empty triangles', async ({ page }) => {
  await lastLife(page);
  await step(page, 48);
  await frames(page);
  const bottoms = await pixelsAt(page, triangleBottoms);
  expect(bottoms.filter(pale).length).toBe(7);
  const insides = await pixelsAt(page, triangleBottoms.map((p) => ({ x: p.x, y: p.y - 4 })));
  expect(insides.filter(pale).length).toBe(0); // outlines, not filled
});

test('GDD-LIFE-05 it waits for a press; the prompt and the press both start after 1.0 s', async ({ page }) => {
  await lastLife(page);
  await step(page, 48);
  await step(page, 59);
  await step(page, 1, { move: 0, jumpHeld: true }); // the 60th step: too early
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
  expect((await drawn(page)).prompt).toBe(true); // a press from now on is taken
  await step(page, 300); // released, and nothing pressed: it stays
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
  await step(page, 1, { move: 0, jumpHeld: true });
  await frames(page);
  expect(await drawn(page)).toMatchObject({ shown: false, prompt: false });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await step(page, 21); // the respawn flip
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
});

test('GDD-LIFE-05 a real key press ends the screen: Space, or any other game button such as X', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'gameover');
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.lives() === 7);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
});

test('GDD-LIFE-05 a tap on the touch Jump button ends the screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'jump')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await page.touchscreen.tap(box.x + (b.x + b.w / 2) * k, box.y + (b.y + b.h / 2) * k);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.lives() === 7);
});

test('GDD-LIFE-05 with right held down, a press of left ends the screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
  await page.waitForTimeout(200);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover'); // right, held throughout, is no press
  await page.keyboard.down('ArrowLeft');
  // It ends while left is still down: the press counts, not its release (left and right reach the sim before they cancel out).
  await page.waitForFunction(() => window.__PONCHO__!.phase() !== 'gameover', undefined, { timeout: 1000 });
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowRight');
});
