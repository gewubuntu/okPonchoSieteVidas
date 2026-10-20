// Screenshots of the respawn flip for visual review. Run with `npm run shots`; images land in shots/.
// The game is paused and stepped by an exact number of steps, so the pictures do not depend on timing.
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the paused frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-LIFE-02 and GDD-MOV-05 respawn flip: hidden, drops in, upside down, landed, playing', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(248, 150); // above the pit
  });
  for (let i = 0; i < 200 && (await page.evaluate(() => window.__PONCHO__!.phase())) !== 'respawning'; i++) {
    await page.evaluate(() => window.__PONCHO__!.step(1));
  }
  // 48 steps of the wait left now. Each pair is the picture name and how many steps to advance to reach it.
  let done = 0;
  for (const [name, at] of [
    ['flip-0-hidden', 20], // 28 left: still hidden
    ['flip-1-drops-in', 28], // 20 left: just started, high above the start
    ['flip-2-turning', 33], // 15 left
    ['flip-3-upside-down', 37], // 11 left
    ['flip-4-landing', 46], // 2 left: nearly down, upright again
    ['flip-5-back-in-play', 48], // the wait is over: playing, upright, blinking for 2 s
  ] as const) {
    await page.evaluate((n) => window.__PONCHO__!.step(n), at - done);
    done = at;
    await shot(page, info, name);
  }
});
