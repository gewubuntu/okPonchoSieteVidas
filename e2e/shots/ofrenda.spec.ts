// Screenshots of the ofrenda checkpoints for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-05 ofrendas: unused, first one used, and after a respawn at it', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  await shot(page, info, 'ofrenda-unused');
  await page.evaluate(() => window.__PONCHO__!.teleport(120, 224));
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[0]!.used);
  await page.evaluate(() => window.__PONCHO__!.teleport(180, 224)); // step off to the right so he is not covering it
  await shot(page, info, 'ofrenda-first-used');
  await page.evaluate(() => window.__PONCHO__!.teleport(312, 224));
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[1]!.used);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 190)); // fall into the pit
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  await page.waitForFunction(() => window.__PONCHO__!.invulnerable() === 0, undefined, { timeout: 5000 });
  await shot(page, info, 'ofrenda-respawned');
});
