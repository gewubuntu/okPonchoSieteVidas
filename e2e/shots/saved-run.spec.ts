// Screenshots of a resumed run for visual review (GDD-PRG-02). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { openGame } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-PRG-02 a resumed run right after the flip, at the second ofrenda with 4 lives and 2 hilos', async ({ page, isMobile }, info) => {
  await page.addInitScript(
    ([text]) => localStorage.setItem('poncho-siete-vidas', text!),
    [
      JSON.stringify({
        version: 1,
        settings: { master: 10, effects: 10, language: 'en' },
        progress: { tutorialPlayed: false },
        levels: {},
        run: { level: '0-1', checkpoint: 1, lives: 4, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'], hilos: `11${'0'.repeat(48)}`, clock: 1800 },
      }),
    ],
  );
  await openGame(page, '/');
  expect((await page.evaluate(() => window.__PONCHO__!.titleDrawn())).menu).toMatchObject({ items: ['Continue', 'Start', 'Tutorial', 'Settings'], chosen: 'continue' });
  // Continue the way the device does: a tap on its row on a phone, Enter on a desktop (L-045).
  if (isMobile) {
    const row = (await page.evaluate(() => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'continue')!;
    const box = (await page.locator('canvas').boundingBox())!;
    const k = box.width / 480;
    await page.touchscreen.tap(box.x + (row.x + row.w / 2) * k, box.y + (row.y + row.h / 2) * k);
  } else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.phase() === 'playing');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 30); // a few steps in play after the flip
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 792, y: 224, grounded: true });
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(4);
  expect((await page.evaluate(() => window.__PONCHO__!.hudHilos())).text).toBe('2/50');
  await shot(page, info, 'resumed-run');
});
