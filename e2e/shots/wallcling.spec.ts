// Screenshots of the wall cling for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-MOV-08 sliding down the left wall with claw marks, then just after the kick', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(6, 100));
  await page.evaluate(() => window.__PONCHO__!.step(12, { move: -1, jumpHeld: false }));
  expect(await page.evaluate(() => window.__PONCHO__!.clingDrawn())).toBe(-1);
  await shot(page, info, 'wallcling-sliding');
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: -1, jumpHeld: true }));
  await page.evaluate(() => window.__PONCHO__!.step(7, { move: -1, jumpHeld: true }));
  expect(await page.evaluate(() => window.__PONCHO__!.state().vx)).toBe(130);
  await shot(page, info, 'wallcling-kicked');
});
