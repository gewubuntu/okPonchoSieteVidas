// Screenshots of the title screen for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { openGame } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

const down = (page: Page) => page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', keyCode: 40, bubbles: true })));

test('GDD-UI-02 the title screen on a first visit, over 0-1', async ({ page }, info) => {
  await openGame(page, '/');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('0-1');
  expect((await page.evaluate(() => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  expect((await page.evaluate(() => window.__PONCHO__!.titleDrawn())).menu).toMatchObject({ shown: true, items: ['Start', 'Tutorial', 'Settings'], chosen: 'start' });
  await shot(page, info, 'title');
});

test('GDD-UI-02 the title screen with Tutorial chosen, over 1-1 after the tutorial was played', async ({ page }, info) => {
  // A saved game whose tutorial was started: the title is over 1-1 (GDD-PRG-02).
  await page.addInitScript(() => localStorage.setItem('poncho-siete-vidas', '{"version":1,"settings":{"master":10,"effects":10},"progress":{"tutorialPlayed":true}}'));
  await openGame(page, '/');
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('1-1');
  await down(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'tutorial');
  await shot(page, info, 'title-tutorial-chosen');
});

test('GDD-UI-02 the title screen with Settings chosen', async ({ page }, info) => {
  await openGame(page, '/');
  await down(page);
  await down(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await shot(page, info, 'title-settings-chosen');
});

test('GDD-UI-02 the title screen on an upright phone', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch device only');
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === 'Turn your device sideways');
  await shot(page, info, 'title-portrait');
});
