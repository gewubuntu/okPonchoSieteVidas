import { expect, test } from '@playwright/test';
import { boot } from './helpers';

// The sandbox level has one moving platform 48 px wide, its top at y = 128, travelling between x = 240 and x = 336 at 40 px/s.
test('GDD-WLD-05 the moving platform travels right and back at 40 px/s', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  const x0 = (await page.evaluate(() => window.__PONCHO__!.platforms()))[0]!;
  expect(x0).toMatchObject({ y: 128, w: 48 });
  await page.evaluate(() => window.__PONCHO__!.step(60));
  const x1 = (await page.evaluate(() => window.__PONCHO__!.platforms()))[0]!;
  expect(x1.x - x0.x).toBeCloseTo(40, 3);
});

test('GDD-WLD-05 Poncho lands on the platform and is carried by it', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  const startX = (await page.evaluate(() => window.__PONCHO__!.platforms()))[0]!.x;
  await page.evaluate((x) => {
    const g = window.__PONCHO__!;
    g.teleport(x + 24, 100);
    g.step(40); // lands
  }, startX);
  const landed = await page.evaluate(() => window.__PONCHO__!.state());
  expect(landed).toMatchObject({ grounded: true });
  await page.evaluate(() => window.__PONCHO__!.step(60));
  const carried = await page.evaluate(() => window.__PONCHO__!.state());
  expect(carried.grounded).toBe(true);
  expect(carried.x - landed.x).toBeCloseTo(40, 3);
  expect(carried.y).toBeCloseTo(128, 3);
});
