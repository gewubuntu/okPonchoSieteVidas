import { expect, test } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

// The sandbox level has one moving block, 16 px square, in column 28 (x 448 to 464): its top goes from y = 112 to y = 208 at 40 px/s.
test('GDD-WLD-05 the moving block travels down at 40 px/s and is painted where it is', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  const b0 = (await page.evaluate(() => window.__PONCHO__!.blocks()))[0]!;
  expect(b0).toMatchObject({ x: 448, w: 16, h: 16 }); // a few steps may have run before the pause
  await page.evaluate(() => window.__PONCHO__!.step(60));
  const b1 = (await page.evaluate(() => window.__PONCHO__!.blocks()))[0]!;
  expect(b1.y - b0.y).toBeCloseTo(40, 3);
  await page.waitForTimeout(150); // let the paused frame render
  // L-017, L-018: sample the middle of the stone, and only where no touch button sits over it.
  const spot = { x: b1.x + b1.w / 2, y: b1.y + b1.h / 2 };
  const touch = await page.evaluate(() => window.__PONCHO__!.touch());
  const covered = touch.visible && touch.buttons.some((t) => spot.x >= t.x && spot.x <= t.x + t.w && spot.y >= t.y && spot.y <= t.y + t.h);
  test.skip(covered, 'a touch button is drawn over the block');
  const [c] = await pixelsAt(page, [spot]);
  expect(c!.r).toBeGreaterThan(110);
  expect(c!.r).toBeLessThan(165);
  expect(Math.abs(c!.r - c!.g)).toBeLessThan(12);
  expect(Math.abs(c!.r - c!.b)).toBeLessThan(12);
});

test('GDD-LIFE-02 standing under the moving block crushes Poncho', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  const lives = await page.evaluate(() => window.__PONCHO__!.lives());
  await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.teleport(456, 224);
    g.step(150);
  });
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(lives - 1);
});
