// Screenshots of the Chile Fantasma for visual review (GDD-PWR-04). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { SANDBOX_PINATAS } from '../../src/levels/sandbox';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // L-042: real time is fine here, only to let the paused frame render before the screenshot
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
/** Starts the sandbox the device's way (L-045), pauses it and stands Poncho at (x, y), with the Chile Fantasma having `left` steps to run. */
const stand = async (page: Page, isMobile: boolean, x: number, y: number, left: number) => {
  await start(page, isMobile, '/?level=sandbox');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(
    ({ px, py, n }) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.teleport(px, py);
      d.step(2);
      d.setFantasma(n);
    },
    { px: x, py: y, n: left },
  );
};

test('GDD-PWR-04 chile fantasma: the pepper standing on the opened special piñata, bobbing, with its sparkles', async ({ page, isMobile }, info) => {
  await stand(page, isMobile, 424, 96, 0); // on the top right ledge under the special piñata (the last of the sandbox's)
  const special = SANDBOX_PINATAS.findIndex((p) => p.special === true);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 20 && d.itemsDrawn().length === 0; i++) d.step(1, { move: 0, jumpHeld: true });
    d.step(14, { move: 0, jumpHeld: false }); // he comes down; the pepper bobs on
  });
  const d = await page.evaluate(() => ({ open: window.__PONCHO__!.pinatasDrawn(), items: window.__PONCHO__!.itemsDrawn(), grounded: window.__PONCHO__!.state().grounded }));
  expect(d.open[special]).toBe(true);
  expect(d.items).toHaveLength(1);
  expect(d.items[0]).toMatchObject({ kind: 'fantasma', x: 424, y: 32 });
  expect(d.grounded).toBe(true);
  await shot(page, info, 'fantasma-pepper');
});

test('GDD-PWR-04 chile fantasma: Poncho glowing, standing on the wall top, sparkles and a flame round him', async ({ page, isMobile }, info) => {
  await stand(page, isMobile, 372, 176, 400);
  const d = await page.evaluate(() => ({ glow: window.__PONCHO__!.glowDrawn(), grounded: window.__PONCHO__!.state().grounded, vx: window.__PONCHO__!.state().vx }));
  expect(d.glow.look).toBe('bright');
  expect([d.grounded, d.vx]).toEqual([true, 0]);
  expect(d.glow.fx.some((f) => f.look === 'flame')).toBe(true);
  await shot(page, info, 'fantasma-standing');
});

test('GDD-PWR-04 chile fantasma: running at 180 px/s with gold speed streaks behind him', async ({ page, isMobile }, info) => {
  // In the pocket right of the 3-tile wall (floor at columns 24 to 26), clear of the taco, the spikes and the crumbling tiles' reach.
  await stand(page, isMobile, 384, 224, 400);
  await page.evaluate(() => window.__PONCHO__!.step(8, { move: 1, jumpHeld: false }));
  const d = await page.evaluate(() => ({ glow: window.__PONCHO__!.glowDrawn(), grounded: window.__PONCHO__!.state().grounded, vx: window.__PONCHO__!.state().vx }));
  expect(d.glow.look).toBe('bright');
  expect(d.grounded).toBe(true);
  expect(d.vx).toBeGreaterThan(100);
  expect(d.glow.fx.filter((f) => f.look === 'streak')).toHaveLength(2);
  await shot(page, info, 'fantasma-running');
});

test('GDD-PWR-04 chile fantasma: in a jump, the gold outline and sparkles scattered round him', async ({ page, isMobile }, info) => {
  // On the floor just past the pit (column 17), straight up: the taco one tile on and the spikes beyond are not touched.
  await stand(page, isMobile, 277, 224, 400);
  await page.evaluate(() => window.__PONCHO__!.step(14, { move: 0, jumpHeld: true }));
  const d = await page.evaluate(() => ({ glow: window.__PONCHO__!.glowDrawn(), grounded: window.__PONCHO__!.state().grounded }));
  expect(d.glow.look).toBe('bright');
  expect(d.grounded).toBe(false);
  expect(d.glow.fx.map((f) => f.look).every((l) => l === 'sparkleStar' || l === 'sparklePlus')).toBe(true);
  await shot(page, info, 'fantasma-jump');
});

test('GDD-PWR-04 chile fantasma: the last 2 s, the glow dimmed to pale gold, no sparkles or flames', async ({ page, isMobile }, info) => {
  await stand(page, isMobile, 372, 176, 100);
  const d = await page.evaluate(() => ({ glow: window.__PONCHO__!.glowDrawn(), left: window.__PONCHO__!.fantasma() }));
  expect(d.left).toBe(100);
  expect(d.glow).toMatchObject({ look: 'dim', colour: '#D3C193', fx: [] });
  await shot(page, info, 'fantasma-dim');
});
