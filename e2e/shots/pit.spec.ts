// Screenshots of the pit and respawn for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-LIFE-02 pit: the level, the fall, waiting to respawn, and back at the start', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await shot(page, info, 'pit-level');
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 190)); // just above the pit, falling in
  await page.waitForTimeout(60);
  await shot(page, info, 'pit-falling');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
  await shot(page, info, 'pit-waiting-6-lives');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  // Wait for the blink to end so the picture does not depend on which half of the blink the screenshot lands in.
  await page.waitForFunction(() => window.__PONCHO__!.invulnerable() === 0, undefined, { timeout: 5000 });
  await shot(page, info, 'pit-respawned');
});
