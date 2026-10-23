// Screenshots of the title screen for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { openGame } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-UI-02 the title screen', async ({ page }, info) => {
  await openGame(page);
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await shot(page, info, 'title');
});

test('GDD-UI-02 the title screen on an upright phone', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch device only');
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === 'Turn your device sideways');
  await shot(page, info, 'title-portrait');
});
