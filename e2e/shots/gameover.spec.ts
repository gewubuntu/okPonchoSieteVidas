// Screenshots of the Siete vidas gastadas screen for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const step = (page: Page, n: number, jumpHeld = false) => page.evaluate(({ k, j }) => window.__PONCHO__!.step(k, { move: 0, jumpHeld: j }), { k: n, j: jumpHeld });
const phase = (page: Page) => page.evaluate(() => window.__PONCHO__!.phase());

test('GDD-LIFE-05 gameover: the screen, its prompt, and the restart flip', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // into the pit with the last life
  for (let i = 0; i < 200 && (await phase(page)) !== 'gameover'; i++) await step(page, 1);
  await step(page, 10);
  expect(await page.evaluate(() => window.__PONCHO__!.gameOverDrawn())).toMatchObject({ shown: true, prompt: false });
  await shot(page, info, 'gameover-screen');
  await step(page, 60);
  expect(await page.evaluate(() => window.__PONCHO__!.gameOverDrawn())).toMatchObject({ shown: true, prompt: true });
  await shot(page, info, 'gameover-prompt');
  await step(page, 1, true);
  await step(page, 10, true); // in the middle of the flip, jump still held
  expect(await phase(page)).toBe('respawning');
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'gameover-restart');
});
