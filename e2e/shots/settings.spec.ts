// Screenshots of the settings screen for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot, openGame } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
// A key event on the window, so the phone project, which has a keyboard too, takes the same path.
const press = (page: Page, code: string, keyCode: number) => page.evaluate(({ c, k }) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true })), { c: code, k: keyCode });
const chosen = (page: Page, row: string) => page.waitForFunction((r) => window.__PONCHO__!.settingsDrawn().chosen === r, row);

test('GDD-UI-02 the settings screen from the pause menu, after changes, and Back chosen', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  await press(page, 'Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  await chosen(page, 'master');
  expect(await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).toMatchObject({ shown: true, from: 'pause', chosen: 'master' });
  await shot(page, info, 'settings-pause-master');
  for (let v = 9; v >= 6; v--) {
    await press(page, 'ArrowLeft', 37);
    await page.waitForFunction((w) => window.__PONCHO__!.settings().master === w, v);
  }
  await press(page, 'ArrowDown', 40);
  await chosen(page, 'effects');
  await shot(page, info, 'settings-pause-changed');
  await press(page, 'ArrowDown', 40);
  await chosen(page, 'back');
  expect(await page.evaluate(() => window.__PONCHO__!.settings())).toEqual({ master: 6, effects: 10 });
  await shot(page, info, 'settings-pause-back');
});

test('GDD-UI-02 the settings screen from the title menu', async ({ page }, info) => {
  await openGame(page);
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  await chosen(page, 'master');
  expect(await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).toMatchObject({ shown: true, from: 'title' });
  await shot(page, info, 'settings-title');
});

test('GDD-UI-02 the settings screen on an upright phone', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await press(page, 'Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  await chosen(page, 'master');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().prompt === 'Turn your device sideways');
  expect((await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).rows).toEqual([]);
  await shot(page, info, 'settings-portrait');
});
