// Screenshots of the pause screen for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot, start } from '../helpers';

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
  const drawn = await page.evaluate(() => window.__PONCHO__!.pauseDrawn());
  expect(drawn.title).toBe('Paused');
  expect(drawn.menu.chosen).toBe('resume');
  await shot(page, info, 'pause-paused');
  // A key event on the window, so the phone project, which has a keyboard too, takes the same path.
  const press = (code: string, keyCode: number) => page.evaluate(({ c, k }) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true })), { c: code, k: keyCode });
  await press('ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await shot(page, info, 'pause-menu-settings');
  await press('ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await shot(page, info, 'pause-menu-quit');
  await press('Enter', 13);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'pause-quit-title');
});

test('GDD-UI-02 a phone turned upright', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch device only');
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().prompt === 'Turn your device sideways');
  expect((await page.evaluate(() => window.__PONCHO__!.pauseDrawn())).menu.shown).toBe(false);
  await shot(page, info, 'pause-portrait');
});
