// Screenshots of the Fuego state for visual review. Run with `npm run shots`; images land in shots/ (not committed).
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

test('GDD-PWR-03 fuego: the chile from the piñata, Poncho in Fuego, and two fireballs in flight', async ({ page }, info) => {
  await start(page, 372, 176);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.evaluate(() => window.__PONCHO__!.step(25, { move: 0, jumpHeld: true }));
  await shot(page, info, 'fuego-chile');
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(300, 224);
    window.__PONCHO__!.setPower('fuego');
    window.__PONCHO__!.step(2);
  });
  await shot(page, info, 'fuego-held');
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, fuego: true }));
  await page.evaluate(() => window.__PONCHO__!.step(6));
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, fuego: true }));
  await page.evaluate(() => window.__PONCHO__!.step(3));
  await shot(page, info, 'fuego-fireballs');
});
