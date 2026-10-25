import { expect, test, type Page } from '@playwright/test';
import { boot, openGame } from './helpers';

// GDD-CTL-02: a fake standard gamepad the tests press and push. The game reads it once per frame, so a press is held for several
// frames (a tap of ~100 ms), as a real press is.
interface FakePad {
  mapping: string;
  buttons: { pressed: boolean; touched: boolean; value: number }[];
  axes: number[];
}
declare global {
  interface Window {
    __pad?: FakePad;
  }
}

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
const state = (page: Page) => api(page, () => window.__PONCHO__!.state());
const paused = async (page: Page) => (await api(page, () => window.__PONCHO__!.playerPause())).paused;
const SOUTH = 0;
const EAST = 1;
const WEST = 2;
const START = 9;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

async function withPad(page: Page, mapping = 'standard'): Promise<void> {
  await page.addInitScript((m) => {
    const pad: FakePad & { id: string; index: number; connected: boolean; timestamp: number } = {
      id: 'fake',
      index: 0,
      connected: true,
      mapping: m,
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    window.__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  }, mapping);
}
const press = (page: Page, i: number, down: boolean) =>
  page.evaluate(
    ([b, d]) => {
      const button = window.__pad!.buttons[b]!;
      button.pressed = d;
      button.value = d ? 1 : 0;
    },
    [i, down] as const,
  );
const stick = (page: Page, x: number, y = 0) =>
  page.evaluate(
    ([sx, sy]) => {
      const axes = window.__pad!.axes;
      axes[0] = sx;
      axes[1] = sy;
    },
    [x, y] as const,
  );
/** A press of a few frames and its release. */
async function tap(page: Page, i: number): Promise<void> {
  await press(page, i, true);
  await page.waitForTimeout(100);
  await press(page, i, false);
  await page.waitForTimeout(100);
}
const grounded = (page: Page) => page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
/** Starts the level with Enter and waits until Poncho stands on the floor. */
async function started(page: Page): Promise<void> {
  await withPad(page);
  await boot(page);
  await grounded(page);
}

test('GDD-CTL-02 start on the title starts the level, south jumps, the D-pad runs at full speed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await withPad(page);
  await openGame(page);
  await tap(page, START);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  await grounded(page);
  await press(page, RIGHT, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx >= 115, undefined, { timeout: 3000 });
  await press(page, RIGHT, false);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0 && window.__PONCHO__!.state().grounded);
  await press(page, SOUTH, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vy < 0, undefined, { timeout: 1000 });
  await press(page, SOUTH, false);
});

test('GDD-CTL-02 the left stick runs with analog speed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  await stick(page, 0.6);
  // Speed builds up over a few steps and then holds at 0.5 x 120 = 60, so wait for it, then check it stays there.
  await page.waitForFunction(() => window.__PONCHO__!.state().vx >= 55, undefined, { timeout: 3000 });
  await page.waitForTimeout(200);
  const half = (await state(page)).vx;
  expect(half).toBeGreaterThanOrEqual(55);
  expect(half).toBeLessThanOrEqual(65);
  await stick(page, 1);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx >= 115, undefined, { timeout: 3000 });
  await stick(page, 0.1);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0);
});

test('GDD-CTL-02 west swings the claw and east spits a fireball in Fuego', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  const swings = await api(page, () => window.__PONCHO__!.swings());
  await tap(page, WEST);
  await page.waitForFunction((n) => window.__PONCHO__!.swings() === n + 1, swings);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  const spits = await api(page, () => window.__PONCHO__!.spits());
  await tap(page, EAST);
  await page.waitForFunction((n) => window.__PONCHO__!.spits() === n + 1, spits);
});

test('GDD-CTL-02 GDD-UI-02 start pauses and resumes, the D-pad chooses and south picks on the pause menu', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  await tap(page, START);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await tap(page, DOWN);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().choice === 'settings');
  await tap(page, UP);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().choice === 'resume');
  await tap(page, START);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  await tap(page, START);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await tap(page, DOWN);
  await tap(page, DOWN);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().choice === 'quit');
  await tap(page, SOUTH);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-CTL-02 GDD-UI-02 the settings screen by gamepad', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await withPad(page);
  await openGame(page);
  await tap(page, DOWN);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await tap(page, SOUTH);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  expect((await api(page, () => window.__PONCHO__!.settingsDrawn())).from).toBe('title');
  await tap(page, LEFT);
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 9);
  await stick(page, 0.8);
  await page.waitForTimeout(100);
  await stick(page, 0);
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 10);
  await stick(page, 0, 0.8);
  await page.waitForTimeout(100);
  await stick(page, 0);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().chosen === 'effects');
  await tap(page, START);
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  await page.waitForTimeout(200);
  const title = await api(page, () => window.__PONCHO__!.titleDrawn());
  expect(title.shown).toBe(true); // it did not start the level
  expect(title.menu.chosen).toBe('settings');
});

test('GDD-CTL-02 GDD-UI-02 a D-pad direction pressed while paused does nothing until pressed again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  await tap(page, START);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await press(page, RIGHT, true);
  await page.waitForTimeout(100);
  await tap(page, START);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const x0 = (await state(page)).x;
  await page.waitForTimeout(300);
  expect(await state(page)).toMatchObject({ x: x0, vx: 0 });
  await press(page, RIGHT, false);
  await frames(page);
  await press(page, RIGHT, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0, undefined, { timeout: 1000 });
  await press(page, RIGHT, false);
});

test('GDD-CTL-02 GDD-UI-02 a D-pad direction held since before the pause keeps running after it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  await press(page, RIGHT, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0);
  await tap(page, START);
  expect(await paused(page)).toBe(true);
  // While paused, put him back at the left of the floor, standing still: the real-time waits around the pause let him run
  // most of the way to the closed door at tile column 8 (L-042), and from here his speed can only come from the held D-pad.
  await page.evaluate(() => window.__PONCHO__!.teleport(40, 224));
  await tap(page, START);
  expect(await paused(page)).toBe(false);
  // Counted in simulation steps, not real time (L-042): 12 steps after the resume he is running right, still short of the door.
  const { t0, x0 } = await api(page, () => ({ t0: window.__PONCHO__!.ticks(), x0: window.__PONCHO__!.state().x }));
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 12, t0);
  const now = await state(page);
  expect(now.vx).toBeGreaterThan(0);
  expect(now.x).toBeGreaterThan(x0);
  await press(page, RIGHT, false);
});

test('GDD-CTL-02 GDD-UI-02 the stick pushed while paused does not steer until back in its dead zone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  await tap(page, START);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await stick(page, 1);
  await page.waitForTimeout(100);
  await tap(page, START);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const x0 = (await state(page)).x;
  await page.waitForTimeout(300);
  expect(await state(page)).toMatchObject({ x: x0, vx: 0 });
  await stick(page, -1); // still outside the dead zone
  await page.waitForTimeout(300);
  expect(await state(page)).toMatchObject({ x: x0, vx: 0 });
  await stick(page, 0);
  await frames(page);
  await stick(page, 1);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0, undefined, { timeout: 1000 });
  await stick(page, 0);
});

test('GDD-CTL-02 GDD-UI-02 a gamepad south pressed while paused does not jump after the resume', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  await tap(page, START);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  // South picks Resume on the pause menu, so the press that resumes is the one held through the resume.
  await press(page, SOUTH, true);
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  for (let i = 0; i < 6; i++) {
    expect(await state(page)).toMatchObject({ vy: 0, grounded: true });
    await page.waitForTimeout(50);
  }
  await press(page, SOUTH, false);
  await page.waitForFunction(() => !window.__PONCHO__!.state().jumpWasHeld);
  await press(page, SOUTH, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vy < 0, undefined, { timeout: 1000 });
  await press(page, SOUTH, false);
});

test('GDD-CTL-02 GDD-UI-02 the D-pad direction that starts the level does not run until pressed again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await withPad(page);
  await openGame(page);
  await press(page, RIGHT, true);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  await grounded(page);
  const x0 = (await state(page)).x;
  await page.waitForTimeout(300);
  expect(await state(page)).toMatchObject({ x: x0, vx: 0 });
  await press(page, RIGHT, false);
  await frames(page);
  await press(page, RIGHT, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0, undefined, { timeout: 1000 });
  await press(page, RIGHT, false);
});

test('GDD-CTL-02 GDD-LIFE-05 a gamepad press ends the Siete vidas gastadas screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'gameover');
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
  await tap(page, WEST);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.lives() === 7);
});

test('GDD-CTL-02 a pad without the standard mapping is ignored', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await withPad(page, '');
  await openGame(page);
  await tap(page, START);
  await tap(page, SOUTH);
  await page.waitForTimeout(300);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
});

test('GDD-CTL-02 GDD-UI-02 a D-pad direction held through a quit to the title does not run when the level starts again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await started(page);
  await press(page, RIGHT, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0);
  await tap(page, START);
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await tap(page, DOWN);
  await tap(page, DOWN);
  await tap(page, SOUTH);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await tap(page, START); // right is still down: it was down at the pause, but on the title nothing was held before
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  await grounded(page);
  const x0 = (await state(page)).x;
  await page.waitForTimeout(300);
  expect(await state(page)).toMatchObject({ x: x0, vx: 0 });
  await press(page, RIGHT, false);
  await frames(page);
  await press(page, RIGHT, true);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0, undefined, { timeout: 1000 });
  await press(page, RIGHT, false);
});
