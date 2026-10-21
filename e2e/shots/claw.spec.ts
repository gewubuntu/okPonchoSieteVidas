// Screenshots of the claw swipe for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const start = async (page: Page, x: number, y: number) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(
    ({ px, py }) => {
      window.__PONCHO__!.pause(true);
      window.__PONCHO__!.teleport(px, py);
      window.__PONCHO__!.step(2);
    },
    { px: x, py: y },
  );
};
const press = (page: Page, n: number) => page.evaluate((steps) => window.__PONCHO__!.step(steps, { move: 0, jumpHeld: false, claw: true }), n);
const idle = (page: Page, n: number) => page.evaluate((steps) => window.__PONCHO__!.step(steps), n);

test('GDD-CMB-02 claw: the wind-up, the swing, and the fragile wall broken', async ({ page }, info) => {
  await start(page, 408, 224);
  await shot(page, info, 'claw-wall');
  await press(page, 1);
  await idle(page, 1);
  await shot(page, info, 'claw-windup');
  await idle(page, 1);
  await shot(page, info, 'claw-swing');
  await idle(page, 6);
  await shot(page, info, 'claw-broken');
});

test('GDD-PWR-05 claw: a swipe from the wall top opens the piñata', async ({ page }, info) => {
  await start(page, 168, 192);
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: -1, jumpHeld: false }));
  await press(page, 1);
  await idle(page, 2);
  await shot(page, info, 'claw-pinata-swing');
  await idle(page, 4);
  await shot(page, info, 'claw-pinata-open');
});
