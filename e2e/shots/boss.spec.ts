// Screenshots of Don Zopilote's arena, level 1-4, for visual review (GDD-BOS-02). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start, stepToBossMode } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: only lets the frame render before the picture; the game is paused, nothing is timed
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

test('GDD-BOS-02 1-4: the arena, his telegraph, dive, stuck, a hit, the phase 2 sweep and rock, phase 3 fruit, the defeat and the clear screen', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=1-4'); // the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toMatchObject({ shown: true, pips: 3 });
  expect(await api(page, () => window.__PONCHO__!.boss()!.mode)).toBe('lap');
  await shot(page, info, 'boss-start');

  expect(await stepToBossMode(page, 'telegraph')).toBeLessThan(1000);
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === 'red' && window.__PONCHO__!.bossDrawn()?.wings === 'raised');
  await shot(page, info, 'boss-telegraph');

  expect(await stepToBossMode(page, 'dive')).toBeLessThan(100);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
  await api(page, () => window.__PONCHO__!.step(30));
  expect(await api(page, () => window.__PONCHO__!.boss()!.mode)).toBe('dive');
  await shot(page, info, 'boss-dive');

  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.dots === 3);
  await shot(page, info, 'boss-stuck');

  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === 'white' && window.__PONCHO__!.bossBar().pips === 2);
  await shot(page, info, 'boss-hit');

  // Phase 2 from the right end: he sweeps the floor towards the left pillar, where Poncho waits by its rock.
  await api(page, () => {
    window.__PONCHO__!.setBoss(1);
    window.__PONCHO__!.teleport(40, 176);
  });
  expect(await stepToBossMode(page, 'sweep')).toBeLessThan(600);
  await api(page, () => window.__PONCHO__!.step(60));
  expect(await api(page, () => window.__PONCHO__!.boss()!.mode)).toBe('sweep');
  await shot(page, info, 'boss-sweep');

  expect(await stepToBossMode(page, 'climb')).toBeLessThan(200);
  await api(page, () => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, claw: true }));
  await api(page, () => window.__PONCHO__!.step(9));
  expect((await api(page, () => window.__PONCHO__!.rocks()))[0]!.mode).toBe('flying');
  await page.waitForFunction(() => window.__PONCHO__!.rocksDrawn().some((r) => r.x > 56 && r.x < 80));
  await shot(page, info, 'boss-rock');

  // Phase 3: one fruit lying on the floor and one falling; Poncho down on the floor at the start, where the next dive will aim.
  await api(page, () => {
    window.__PONCHO__!.setBoss(2);
    window.__PONCHO__!.teleport(232, 224);
    window.__PONCHO__!.step(130);
  });
  const fruit = await api(page, () => window.__PONCHO__!.fruit());
  expect(fruit.some((f) => f.landed)).toBe(true);
  expect(fruit.some((f) => !f.landed)).toBe(true);
  await page.waitForFunction((n) => window.__PONCHO__!.fruitDrawn().length === n, fruit.length);
  await shot(page, info, 'boss-fruit');

  expect(await stepToBossMode(page, 'dive')).toBeLessThan(300);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  await api(page, () => window.__PONCHO__!.step(20));
  expect(await api(page, () => window.__PONCHO__!.boss()!.mode)).toBe('defeated');
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().pips === 0);
  await shot(page, info, 'boss-defeat');

  await api(page, () => window.__PONCHO__!.step(40 + 61));
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().shown && window.__PONCHO__!.clearDrawn().menu.shown);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'retry' });
  await shot(page, info, 'boss-clear');
});
