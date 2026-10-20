// Screenshots of the life-loss crack on the HUD for visual review. Run with `npm run shots`; images land in shots/.
// The game is paused and stepped by an exact number of steps, so the pictures do not depend on timing.
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-LIFE-02 the lost triangle cracks and fades: step 0, 5, 11, 19 and 30', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  // Frozen on the step the life is lost, then advanced by an exact number of steps, so every picture is the same each run.
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.loseLife();
  });
  await shot(page, info, 'crack-0-start');
  let done = 0;
  for (const [name, at] of [['crack-1-early', 5], ['crack-2-middle', 11], ['crack-3-late', 19], ['crack-4-done', 30]] as const) {
    await page.evaluate((n) => window.__PONCHO__!.step(n), at - done);
    done = at;
    await shot(page, info, name);
  }
});
