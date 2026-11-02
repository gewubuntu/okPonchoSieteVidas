// Screenshots of the sand slopes level for visual review (GDD-MOV-09, GDD-ART-06). Run with `npm run shots`; images land in shots/ (not committed).
// Each test drives the paused game with the debug hooks only, so it runs the same on the phone.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: lets the paused frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** Starts the slopes level the device's way (L-045) and waits for the game to be running. */
async function open(page: Page, isMobile: boolean): Promise<void> {
  await start(page, isMobile, '/?level=slopes');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
}

/** Waits until Poncho's body is drawn where the simulation has him (L-016). */
const drawnAtState = (page: Page) =>
  page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    const s = d.state();
    return Math.abs(d.bodyPose().x - s.x) < 0.01 && Math.abs(d.bodyPose().y - s.y) < 0.01;
  });

test('GDD-MOV-09 slopes: the slopes level', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('slopes');
  expect([4, 5]).toContain(await page.evaluate(() => window.__PONCHO__!.groundFrame(4, 13)));
  await shot(page, info, 'slopes-level');
});

test('GDD-MOV-09 slopes: Poncho on the 45 degree hill', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  const s = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 200 && d.state().x < 72; i++) d.step(1, { move: 1, jumpHeld: false });
    return d.state();
  });
  expect(s.grounded).toBe(true);
  expect(s.x).toBeGreaterThanOrEqual(72);
  expect(s.y).toBeCloseTo(288 - s.x, 6); // the `/` at column 4
  expect(await page.evaluate(() => window.__PONCHO__!.invulnerable())).toBe(0); // not hit: the Alacrán walks away from him
  await drawnAtState(page);
  await shot(page, info, 'slopes-hill');
});

test('GDD-MOV-09 slopes: Poncho on the gentle dune', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  // Not run there: running right from the spawn he would catch the Alacrán on the hill's far side and lose a life.
  const s = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.teleport(200, 220); // on the `r` at column 12: 224 - (200 - 192) / 2
    d.step(1, { move: 0, jumpHeld: false });
    return d.state();
  });
  expect(s.grounded).toBe(true);
  expect(s.x).toBe(200);
  expect(s.y).toBeCloseTo(220, 6);
  expect(await page.evaluate(() => window.__PONCHO__!.invulnerable())).toBe(0);
  await drawnAtState(page);
  await shot(page, info, 'slopes-dune');
});

test('GDD-MOV-09 slopes: the Alacrán walking down the hill', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 120; i++) {
      const e = d.enemies()[0]!;
      if (e.y > 192 && e.y < 224 && e.x >= 128 && e.x <= 160) break;
      d.step(1, { move: 0, jumpHeld: false });
    }
  });
  const sim = (await page.evaluate(() => window.__PONCHO__!.enemies()))[0]!;
  expect(sim.y).toBeGreaterThan(192);
  expect(sim.y).toBeLessThan(224);
  expect(sim.x).toBeGreaterThanOrEqual(128);
  expect(sim.x).toBeLessThanOrEqual(160);
  const drawn = (await page.evaluate(() => window.__PONCHO__!.enemiesDrawn())).filter((p) => p.kind === 'alacran');
  expect(drawn).toHaveLength(1);
  expect(drawn[0]!.x).toBeCloseTo(sim.x, 6);
  expect(drawn[0]!.y).toBeCloseTo(sim.y, 6);
  await shot(page, info, 'slopes-alacran');
});
