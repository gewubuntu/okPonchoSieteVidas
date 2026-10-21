// Screenshots of the spring for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-WLD-05 spring: beside it, plain launch, timed launch, and on the ledge', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(216, 224);
    window.__PONCHO__!.step(2);
  });
  await shot(page, info, 'spring-beside');
  // Dropped from 34 px up he lands on step 11. No press: the plain launch, to the top of its arc.
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(200, 190);
    window.__PONCHO__!.step(38);
  });
  await shot(page, info, 'spring-plain-top');
  // A press on step 8, 3 steps before the landing: the timed launch, to the top of a higher arc.
  await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.teleport(200, 190);
    g.step(8);
    g.step(1, { move: 0, jumpHeld: true });
    g.step(26, { move: 0, jumpHeld: true });
  });
  await shot(page, info, 'spring-timed-top');
  // Then drift right above the ledge and land on it.
  await page.evaluate(() => {
    const g = window.__PONCHO__!;
    for (let i = 0; i < 120 && !(g.state().grounded && g.state().y === 128); i++) g.step(1, { move: g.state().y < 128 ? 1 : 0, jumpHeld: false });
  });
  await shot(page, info, 'spring-ledge');
});
