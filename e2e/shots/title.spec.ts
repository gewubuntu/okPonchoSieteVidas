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

/** A saved game with a run in 0-1: 4 lives, two hilos, the clock at 30 s, at the second ofrenda (GDD-PRG-02). */
const withSavedRun = (page: Page, tutorialPlayed = false) =>
  page.addInitScript(
    ([text]) => localStorage.setItem('poncho-siete-vidas', text!),
    [
      JSON.stringify({
        version: 1,
        settings: { master: 10, effects: 10, language: 'en' },
        progress: { tutorialPlayed },
        levels: {},
        run: { level: '0-1', checkpoint: 1, lives: 4, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'], hilos: `11${'0'.repeat(48)}`, clock: 1800 },
      }),
    ],
  );

test('GDD-UI-02 the title screen with a saved run, Continue chosen, over 0-1', async ({ page }, info) => {
  await withSavedRun(page);
  await openGame(page, '/');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('0-1');
  expect((await page.evaluate(() => window.__PONCHO__!.titleDrawn())).menu).toMatchObject({ shown: true, items: ['Continue', 'Start', 'Tutorial', 'Settings'], chosen: 'continue' });
  await shot(page, info, 'title-continue');
});

test('GDD-UI-02 the title screen with a saved run and Settings chosen, over 1-1 after the tutorial', async ({ page }, info) => {
  await withSavedRun(page, true);
  await openGame(page, '/');
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('1-1');
  for (let i = 0; i < 3; i++) await down(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  expect((await page.evaluate(() => window.__PONCHO__!.titleDrawn())).menu.items).toEqual(['Continue', 'Start', 'Tutorial', 'Settings']);
  await shot(page, info, 'title-continue-settings-chosen');
});

test('GDD-UI-02 the title screen with a saved run on an upright phone', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch device only');
  await withSavedRun(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === 'Turn your device sideways');
  await shot(page, info, 'title-continue-portrait');
});
