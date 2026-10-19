// Screenshots of the lives HUD for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-UI-01 lives HUD at 7, 4 and 0 lives', async ({ page }, info) => {
  await boot(page);
  await shot(page, info, 'hud-7-lives');
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await shot(page, info, 'hud-4-lives');
  for (let i = 0; i < 4; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await shot(page, info, 'hud-0-lives');
});
