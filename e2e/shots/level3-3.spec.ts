// Screenshots of level 3-3 "Las Cumbres" for visual review (GDD-WLD-18, GDD-ART-06, GDD-UI-02). Run with `npm run shots`; images land in shots/
// (not committed). Where things are comes from `src/levels/level3-3.ts` (L-062). The level is registered after 3-2 and drawn as the canyon, as
// it is today: these show the registered level, not new art. It is started the device's way (L-045); then Poncho is put on solid ground a few
// tiles before each place and stepped in the paused game (L-042), and the moment each shot is named for is asserted before it (L-016).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { TILE } from '../../src/config/tuning';
import { LEVEL_3_3, LEVEL_3_3_AT, LEVEL_3_3_PITS, LEVEL_3_3_PLANKS } from '../../src/levels/level3-3';
import { start, waitForResults } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the paused frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

const L = LEVEL_3_3;
const mid = (col: number) => col * TILE + TILE / 2;

/** Starts 3-3 the device's way (L-045) and pauses it, Poncho standing at the spawn. */
async function open(page: Page, isMobile: boolean): Promise<void> {
  await start(page, isMobile, '/?level=3-3');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
  });
}

/** Puts Poncho 1 px over the ground at (x, feet y) (a teleport onto solid ground), steps until he stands there and a few more so the camera settles. */
async function standAt(page: Page, x: number, y: number): Promise<void> {
  const grounded = await page.evaluate(
    ([px, py]) => {
      const d = window.__PONCHO__!;
      d.teleport(px!, py! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      d.step(30);
      return d.state().grounded;
    },
    [x, y],
  );
  expect(grounded).toBe(true);
}

/** What the screen shows: the camera, Poncho and the phase. */
const view = (page: Page) => page.evaluate(() => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state(), phase: window.__PONCHO__!.phase() }));
type View = Awaited<ReturnType<typeof view>>;
/** Whether level point (x, y) is on the screen. */
const onScreen = (v: View, x: number, y: number) => x >= v.cam.scrollX && x < v.cam.scrollX + 480 && y >= v.cam.scrollY && y < v.cam.scrollY + 270;

test('GDD-WLD-18 3-3: the start, on G0 in the canyon, the camera at the level\'s bottom', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  const v = await view(page);
  expect(v.s).toMatchObject({ x: L.spawn.x, y: L.spawn.y, grounded: true });
  expect(v.phase).toBe('playing');
  expect(v.cam.scrollY).toBe(320);
  expect(await page.evaluate(() => window.__PONCHO__!.scenery())).toMatchObject({ place: 'barranca' });
  await shot(page, info, 'level3-3-start');
});

test('GDD-WLD-18 3-3: on P2, 3 tiles before the chasm, L1 below', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  const chasm = LEVEL_3_3_PITS.chasm;
  await standAt(page, mid(chasm.col0 - 3), LEVEL_3_3_AT.P2.row * TILE);
  const v = await view(page);
  expect(v.s).toMatchObject({ grounded: true, y: LEVEL_3_3_AT.P2.row * TILE });
  expect(Math.floor(v.s.x / TILE)).toBe(86);
  // The chasm's whole width, from P2's lip to L1's first tile, and L1's top there are on the screen.
  expect(onScreen(v, chasm.col0 * TILE, LEVEL_3_3_AT.P2.row * TILE)).toBe(true);
  expect(onScreen(v, (chasm.col1 + 1) * TILE, LEVEL_3_3_AT.L1.row * TILE)).toBe(true);
  await shot(page, info, 'level3-3-chasm');
});

test('GDD-WLD-18 3-3: on stone Q, bridge B\'s planks ahead', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await standAt(page, mid(158), LEVEL_3_3_AT.Q.row * TILE);
  const v = await view(page);
  expect(v.s).toMatchObject({ grounded: true, y: LEVEL_3_3_AT.Q.row * TILE });
  expect(Math.floor(v.s.x / TILE)).toBe(158);
  // The first span's planks, in full, are on the screen.
  const b = LEVEL_3_3_PLANKS.bridgeB1;
  expect(onScreen(v, b.col0 * TILE, b.row * TILE)).toBe(true);
  expect(onScreen(v, (b.col1 + 1) * TILE - 1, b.row * TILE)).toBe(true);
  await shot(page, info, 'level3-3-bridge-b');
});

test('GDD-WLD-18 3-3: on the exit bank, the exit 2 tiles ahead', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await standAt(page, mid(LEVEL_3_3_AT.bank.col0), LEVEL_3_3_AT.bank.row * TILE);
  const v = await view(page);
  expect(v.s).toMatchObject({ grounded: true, y: LEVEL_3_3_AT.bank.row * TILE });
  expect(Math.floor(v.s.x / TILE)).toBe(232);
  expect(v.phase).toBe('playing');
  const exit = L.exit!;
  expect(onScreen(v, exit.x, exit.y - 8)).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  await shot(page, info, 'level3-3-exit');
});

test('GDD-UI-02 3-3: the results menu after the exit, Next level greyed', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  // A few steps right from the spawn take its first hilo in play, so the screen shows a count a player could see (L-045); then the bank.
  const taken = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 40 && d.hilos().taken === 0; i++) d.step(1, { move: 1, jumpHeld: false });
    return d.hilos().taken;
  });
  expect(taken).toBeGreaterThan(0);
  await standAt(page, mid(LEVEL_3_3_AT.bank.col0), LEVEL_3_3_AT.bank.row * TILE);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 120 && d.phase() !== 'clear'; i++) d.step(1, { move: 1, jumpHeld: false });
    d.step(61);
  });
  await waitForResults(page);
  // The count is the one taken in play (the first, and what the run to the exit passes), not 0.
  const clear = await page.evaluate(() => ({ ...window.__PONCHO__!.clearDrawn(), taken: window.__PONCHO__!.hilos().taken }));
  expect(clear.taken).toBeGreaterThanOrEqual(taken);
  expect(clear.hilos).toBe(`Hilos ${clear.taken}/50`);
  // 3-3 names no next: Next level is greyed and the menu opens on Retry.
  expect(clear.menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  await shot(page, info, 'level3-3-results');
});
