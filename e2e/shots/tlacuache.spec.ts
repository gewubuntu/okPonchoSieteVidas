// Screenshots of the Tlacuache for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const step = (page: Page, n: number) => page.evaluate((k) => window.__PONCHO__!.step(k, { move: 0, jumpHeld: false }), n);
/** Each shot must show the state it is named for (L-016): a scenario that misses it fails instead of taking the wrong picture. */
const phase = async (page: Page) => (await page.evaluate(() => window.__PONCHO__!.enemies()))[3]!.phase;
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};

test('GDD-ENM-02 tlacuache: walking, the telegraph, the charge, and playing dead', async ({ page }, info) => {
  await start(page);
  expect(await phase(page)).toBe('walk');
  await shot(page, info, 'tlacuache-walk');
  const x = (await page.evaluate(() => window.__PONCHO__!.enemies()))[3]!.x;
  await page.evaluate((ox) => window.__PONCHO__!.teleport(ox + 24, 96), x); // on its ledge, 24 px in front of it
  await step(page, 1); // the body flashes red for the first 4 steps of every 8
  expect(await phase(page)).toBe('telegraph');
  expect(await page.evaluate(() => window.__PONCHO__!.state().x)).toBeLessThan(480); // Poncho in the picture
  await shot(page, info, 'tlacuache-telegraph');
  await page.evaluate(() => window.__PONCHO__!.teleport(380, 128)); // out of its way, so the charge runs to the ledge's end
  await step(page, 29 + 4);
  expect(await phase(page)).toBe('charge');
  await shot(page, info, 'tlacuache-charge');
  await step(page, 30); // the charge ends at the ledge's right end
  const now = (await page.evaluate(() => window.__PONCHO__!.enemies()))[3]!.x;
  await page.evaluate((ox) => window.__PONCHO__!.teleport(ox, 80), now); // falls onto it: the first stomp
  await step(page, 8); // it lands on it on the sixth step
  await page.evaluate(() => window.__PONCHO__!.teleport(380, 128)); // and out of the way again
  await step(page, 30);
  expect(await phase(page)).toBe('dead');
  await shot(page, info, 'tlacuache-dead');
});
