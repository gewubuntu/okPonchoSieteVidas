// Screenshots of Poncho's victory on the level clear screen for visual review (GDD-ART-04, GDD-UI-02). Run with `npm run shots`; images
// land in shots/ (not committed). 0-1's clear screen at three moments, then the boss arena's once.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start, stepToBossMode, stepUntil } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: only lets the frame render before the picture; the game is paused, nothing is timed
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

/** Right before a shot (L-016): the clear screen is up, on this step of it (the first is 1), and Poncho is drawn as `look`, above the veil. */
async function expectVictory(page: Page, screenStep: number, look: string): Promise<void> {
  await page.waitForFunction(([n, l]) => {
    const d = window.__PONCHO__!;
    return d.phase() === 'clear' && d.ticks() - d.phaseSince() + 1 === n && d.ponchoSprite().look === l && d.clearLayers().veil < d.clearLayers().poncho;
  }, [screenStep, look] as const);
}

test('GDD-ART-04 0-1: the victory on the clear screen, ready, raising the taco, the taco up', async ({ page, isMobile }, info) => {
  await start(page, isMobile); // the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await api(page, () => window.__PONCHO__!.pause(true));
  // GDD-WLD-06: some hilos collected on the way, so the clear screen shows a count (the three on the floor at the start).
  for (const col of [4, 5, 6]) {
    const before = await api(page, () => window.__PONCHO__!.hilos().taken);
    await page.evaluate((x) => window.__PONCHO__!.teleport(x, 224), col * 16 + 8);
    await api(page, () => window.__PONCHO__!.step(1));
    expect(await api(page, () => window.__PONCHO__!.hilos().taken)).toBe(before + 1);
  }
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(1400, 224);
    window.__PONCHO__!.step(6); // the exit's step is the screen's first: step 6 of the screen is 5 steps on
  });
  await expectVictory(page, 6, 'victory0');
  await shot(page, info, 'victory-clear-ready');
  await api(page, () => window.__PONCHO__!.step(14));
  await expectVictory(page, 20, 'victory2');
  await shot(page, info, 'victory-clear-raise');
  await api(page, () => window.__PONCHO__!.step(20));
  await expectVictory(page, 40, 'victory3');
  await shot(page, info, 'victory-clear-up');
});

test('GDD-ART-04 1-4: the victory on the boss arena\'s clear screen, where Poncho stood', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=1-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await api(page, () => window.__PONCHO__!.setBoss(2));
  expect(await stepToBossMode(page, 'dive')).toBeLessThan(1000);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  expect(await stepUntil(page, { phase: 'clear' }, 120)).toBeLessThan(120);
  await api(page, () => window.__PONCHO__!.step(14));
  await expectVictory(page, 15, 'victory1');
  await shot(page, info, 'victory-clear-boss');
});
