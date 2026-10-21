// Screenshots of the door and key for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const run = (page: Page, n: number) => page.evaluate((steps) => window.__PONCHO__!.step(steps, { move: 1, jumpHeld: false }), n);

test('GDD-WLD-05 door: the key and the shut door, the key held, the door open', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(60, 224);
    window.__PONCHO__!.step(2);
  });
  await shot(page, info, 'door-shut');
  await run(page, 16);
  await shot(page, info, 'door-key-held');
  await run(page, 80);
  await shot(page, info, 'door-open');
});
