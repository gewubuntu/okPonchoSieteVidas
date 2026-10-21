// Screenshots of the spikes for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-05 spikes: Poncho beside them, then the frame the hit lands', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(296, 224);
    window.__PONCHO__!.step(2);
  });
  await shot(page, info, 'spikes-approach');
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(336, 205);
    window.__PONCHO__!.step(8); // lands on the points and loses the life
    window.__PONCHO__!.step(6); // the HUD triangle is cracking
  });
  await shot(page, info, 'spikes-hit');
});
