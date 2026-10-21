// Screenshots of the Taco state for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const run = (page: Page, n: number) => page.evaluate((steps) => window.__PONCHO__!.step(steps, { move: 1, jumpHeld: false }), n);

test('GDD-PWR-02 taco: waiting on the floor, in hand, and the frame a spike spends it', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(278, 224);
    window.__PONCHO__!.step(2);
  });
  await shot(page, info, 'taco-waiting');
  await run(page, 14);
  await shot(page, info, 'taco-held');
  await run(page, 24);
  await shot(page, info, 'taco-spent');
});
