// Screenshots of the cactus buddy for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
type In = { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean };
const step = (page: Page, n: number, input: In = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};

test('GDD-ENM-02 cactus: on top of the 2-tile wall, and a fireball used up on it', async ({ page }, info) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(164, 192));
  await step(page, 2);
  await shot(page, info, 'cactus-stands');
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await step(page, 1, { move: 0, jumpHeld: false, fuego: true });
  await step(page, 6);
  await shot(page, info, 'cactus-fireball');
  await step(page, 6);
  await shot(page, info, 'cactus-used-up');
});
