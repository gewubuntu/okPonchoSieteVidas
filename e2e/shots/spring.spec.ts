// Screenshots of the spring for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-05 spring: beside it, and at the top of the launch', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(216, 224);
    window.__PONCHO__!.step(2);
  });
  await shot(page, info, 'spring-beside');
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(200, 190);
    window.__PONCHO__!.step(26); // landed, launched and rising
  });
  await shot(page, info, 'spring-rising');
  await page.evaluate(() => window.__PONCHO__!.step(12)); // the top of the arc
  await shot(page, info, 'spring-top');
});
