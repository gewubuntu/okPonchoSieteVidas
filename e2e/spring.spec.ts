import { expect, test } from '@playwright/test';
import { boot } from './helpers';

// The sandbox level has a spring set into the floor at tile column 12 (x 192 to 208, top y = 224), between the 2-tile wall and the pit.
test('GDD-WLD-05 walking onto the spring throws Poncho about 77 px up, higher than a jump', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(216, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded); // on the floor tile just right of the spring
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().y < 224 - 70); // a jump peaks at 56
  await page.keyboard.up('ArrowLeft');
  const { y } = await page.evaluate(() => window.__PONCHO__!.state());
  expect(y).toBeLessThan(154);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
});

test('GDD-WLD-05 dropping onto the spring launches Poncho', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(200, 190));
  await page.waitForFunction(() => window.__PONCHO__!.state().vy < -400);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
});
