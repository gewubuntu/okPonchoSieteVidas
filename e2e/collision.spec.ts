import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const state = (page: Page) => page.evaluate(() => window.__PONCHO__!.state());

test('GDD-MOV-06 Poncho starts standing on the floor', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await state(page)).toMatchObject({ grounded: true, y: 224 });
});

test('GDD-MOV-06 a wall stops Poncho and he stands against its face', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test; touch controls arrive with GDD-CTL-03');
  await boot(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1800);
  await page.keyboard.up('ArrowRight');
  const s = await state(page);
  // The 2-tile wall starts at x = 160, and the body is 12 px wide, so the centre stops at 154.
  expect(s.x).toBeCloseTo(154, 1);
  expect(s.vx).toBe(0);
  expect(s.grounded).toBe(true);
});

test('GDD-MOV-06 Poncho lands on top of a wall', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(168, 150)); // above the 2-tile wall, whose top is y = 192
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  expect(await state(page)).toMatchObject({ y: 192, vy: 0 });
});

test('GDD-MOV-06 Poncho bumps his head on the underside of a platform', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test; touch controls arrive with GDD-CTL-03');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(100, 224)); // under the platform, whose underside is y = 176
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await page.keyboard.down('Space');
  await page.waitForTimeout(450);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  // The head (14 px above the feet) stops at 176, so the feet reach y = 190, which is a rise of 34 px.
  const peak = await page.evaluate(() => window.__PONCHO__!.peakRise());
  expect(peak).toBeGreaterThan(33);
  expect(peak).toBeLessThan(35);
});
