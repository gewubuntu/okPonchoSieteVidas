// Screenshots of the crumbling tiles for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-05 crumbling tiles: whole, warning, gone', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(392, 160);
    window.__PONCHO__!.step(3); // lands on the left tile of the three (column 24 only) and its warning starts
  });
  await shot(page, info, 'crumble-warning-start');
  await page.evaluate(() => window.__PONCHO__!.step(10)); // shaking, in the pale half of the flash
  await shot(page, info, 'crumble-warning-late');
  await page.evaluate(() => window.__PONCHO__!.step(24)); // the tile is gone and he is falling
  await shot(page, info, 'crumble-gone');
});
