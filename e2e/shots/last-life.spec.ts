// Screenshots of the last-life pulse for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-LIFE-04 last life: the pulse at its smallest and its largest', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.step(40)); // the cracks are over
  for (const [name, want] of [['small', (s: number) => s < 1.01], ['large', (s: number) => s > 1.39]] as const) {
    for (let i = 0; i < 48 && !want((await page.evaluate(() => window.__PONCHO__!.hudPulse()))!); i++) await page.evaluate(() => window.__PONCHO__!.step(1));
    expect(want((await page.evaluate(() => window.__PONCHO__!.hudPulse()))!)).toBe(true);
    await shot(page, info, `last-life-${name}`);
  }
});
