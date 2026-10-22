// Screenshots of the Zopilote for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const step = (page: Page, n: number) => page.evaluate((k) => window.__PONCHO__!.step(k, { move: 0, jumpHeld: false }), n);
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};

test('GDD-ENM-02 zopilote: cruising, the telegraph, and the dive', async ({ page }, info) => {
  await start(page);
  await shot(page, info, 'zopilote-cruise');
  await page.evaluate(() => window.__PONCHO__!.teleport(224, 128)); // on the spring ledge, in its reach
  await step(page, 6);
  await shot(page, info, 'zopilote-telegraph');
  await step(page, 24 + 10);
  await shot(page, info, 'zopilote-dive');
});
