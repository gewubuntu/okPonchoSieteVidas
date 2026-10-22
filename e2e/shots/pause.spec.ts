// Screenshots of the pause screen for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-UI-02 playing, with the touch pause button, then paused', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  await shot(page, info, 'pause-playing');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  expect((await page.evaluate(() => window.__PONCHO__!.pauseDrawn())).title).toBe('Paused');
  await shot(page, info, 'pause-paused');
});

test('GDD-UI-02 a phone turned upright', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().prompt === 'Turn your device sideways');
  await shot(page, info, 'pause-portrait');
});
