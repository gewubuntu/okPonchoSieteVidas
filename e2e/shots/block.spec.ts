// Screenshots of the moving block for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-05 moving block: at the top, on the floor, and carrying Poncho up', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.pause(true);
    g.teleport(472, 224); // column 29, the safe spot beside the block's path
    g.step(1);
  });
  await shot(page, info, 'block-top');
  await page.evaluate(() => window.__PONCHO__!.step(143)); // the block rests on the floor
  await shot(page, info, 'block-floor');
  await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.teleport(456, 208 - 1); // lands on the block, which then rises
    g.step(40);
  });
  await shot(page, info, 'block-riding');
});
