// Screenshots of the moving platform for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-05 moving platform: at the ledge, carrying Poncho, and at the far end', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.pause(true);
    g.teleport(225, 100); // above the spring ledge, whose top (y = 112) is 16 px above the platform
    g.step(30);
  });
  await shot(page, info, 'platform-start');
  await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.teleport(g.platforms()[0]!.x + 24, 100);
    g.step(30 + 40); // lands on the platform and rides it for a while
  });
  await shot(page, info, 'platform-carrying');
  await page.evaluate(() => window.__PONCHO__!.step(70));
  await shot(page, info, 'platform-far');
});
