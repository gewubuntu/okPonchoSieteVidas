// Screenshots of the tile level for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // let the frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

const standOn = async (page: Page, x: number, y: number) => {
  await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [x, y]);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
};

test('GDD-MOV-06 tile level: start, on the 2-tile wall, on the 3-tile wall, under the platform', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await shot(page, info, 'level-start');
  await standOn(page, 168, 150);
  await shot(page, info, 'level-on-2-tile-wall');
  await standOn(page, 368, 120);
  await shot(page, info, 'level-on-3-tile-wall');
  await standOn(page, 100, 224);
  await shot(page, info, 'level-under-platform');
});
