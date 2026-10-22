// Screenshots of the glide for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-MOV-07 falling, then gliding under the spread poncho', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(40, 100));
  await page.evaluate(() => window.__PONCHO__!.step(14, { move: 0, jumpHeld: false }));
  expect(await page.evaluate(() => window.__PONCHO__!.state().gliding)).toBe(false);
  await shot(page, info, 'glide-falling');
  await page.evaluate(() => window.__PONCHO__!.step(10, { move: 1, jumpHeld: true }));
  expect(await page.evaluate(() => window.__PONCHO__!.glideDrawn())).toBe(true);
  await shot(page, info, 'glide-gliding');
});
