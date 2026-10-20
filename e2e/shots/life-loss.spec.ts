// Screenshots of the life-loss crack on the HUD for visual review. Run with `npm run shots`; images land in shots/.
// The simulation is paused on each frame so the picture does not depend on timing.
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-LIFE-02 the lost triangle cracks and fades: start, early, middle, late, done', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  const start = await page.evaluate(() => {
    window.__PONCHO__!.pause(true); // frozen on the step the life is lost
    window.__PONCHO__!.loseLife();
    return window.__PONCHO__!.ticks();
  });
  await shot(page, info, 'crack-0-start');
  // Step the animation forward by letting the simulation run until the wanted step, then freezing it again.
  for (const [name, steps] of [['crack-1-early', 5], ['crack-2-middle', 11], ['crack-3-late', 19]] as const) {
    await page.evaluate(() => window.__PONCHO__!.pause(false));
    await page.waitForFunction(([s, n]) => window.__PONCHO__!.ticks() >= s + n, [start, steps] as const);
    await page.evaluate(() => window.__PONCHO__!.pause(true));
    await shot(page, info, name);
  }
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  await page.waitForFunction((s) => window.__PONCHO__!.ticks() >= s + 30, start);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await shot(page, info, 'crack-4-done');
});
