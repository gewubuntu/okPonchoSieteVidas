// Screenshots of the Alacrán for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
type In = { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean };
const step = (page: Page, n: number, input: In = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
const enemyX = async (page: Page) => (await page.evaluate(() => window.__PONCHO__!.enemies()))[0]!.x;
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};

test('GDD-ENM-02 enemy: the Alacrán on its platform, a stomp, and a claw swipe', async ({ page }, info) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(70, 160));
  await step(page, 2);
  await shot(page, info, 'enemy-patrol');
  const x = await enemyX(page);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex, 132), x);
  await step(page, 3);
  await shot(page, info, 'enemy-stomp');
  await step(page, 6);
  await shot(page, info, 'enemy-stomped');
});

test('GDD-ENM-02 enemy: a fireball defeats it', async ({ page }, info) => {
  await start(page);
  const x = await enemyX(page);
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex - 24, 160), x);
  await step(page, 2);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await step(page, 1, { move: 0, jumpHeld: false, fuego: true });
  await step(page, 1);
  await shot(page, info, 'enemy-fireball');
});
