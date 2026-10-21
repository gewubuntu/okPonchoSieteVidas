// Screenshots of the piñata for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-PWR-05 piñata: closed above Poncho, the bump, and the taco walking away', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(152, 224);
    window.__PONCHO__!.step(2);
  });
  await shot(page, info, 'pinata-closed');
  await page.evaluate(() => window.__PONCHO__!.step(25, { move: 0, jumpHeld: true }));
  await shot(page, info, 'pinata-open');
  await page.evaluate(() => window.__PONCHO__!.step(34));
  await shot(page, info, 'pinata-walking');
});
