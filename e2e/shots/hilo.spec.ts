// Screenshots of the hilo pickups and the hilo counter for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-04 hilo level: every hilo in its colour, and the counter at 0/20', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).drawn).toBe(20);
  expect((await page.evaluate(() => window.__PONCHO__!.hudHilos())).text).toBe('0/20');
  await shot(page, info, 'hilo-level');
});

test('GDD-WLD-04 hilo collected: the two floor hilos are gone and the counter reads 2/20', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(56, 224);
    for (let i = 0; i < 80 && window.__PONCHO__!.hilos().taken < 2; i++) window.__PONCHO__!.step(1, { move: 1, jumpHeld: false });
  });
  expect(await page.evaluate(() => window.__PONCHO__!.hilos())).toEqual({ taken: 2, total: 20, drawn: 18 });
  expect((await page.evaluate(() => window.__PONCHO__!.hudHilos())).text).toBe('2/20');
  await shot(page, info, 'hilo-collected');
});
