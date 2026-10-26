import type { Page } from '@playwright/test';
import type { PonchoDebug } from '../src/scenes/PlayScene';
import type { RunState } from '../src/sim/run';

declare global {
  interface Window {
    __PONCHO__?: PonchoDebug;
  }
}

/**
 * Opens the game on the title screen (GDD-UI-02), waits for the dev debug hook and returns the errors seen so far. `path` is the
 * address: the sandbox by default, which every playtest but those for 0-1 uses; `/` opens level 0-1.
 */
export async function openGame(page: Page, path = '/?level=sandbox'): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  return errors;
}

/** Opens the game (the sandbox, or the address given) and starts the level from the title screen with Enter, which is no game button, so nothing counts as held. */
export async function boot(page: Page, path = '/?level=sandbox'): Promise<string[]> {
  const errors = await openGame(page, path);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  return errors;
}

/**
 * Colours of the pixels at some virtual-pixel positions, read from a real screenshot of the page (the picture the player
 * sees), not from what the scene says it drew.
 */
export async function pixelsAt(page: Page, points: { x: number; y: number }[]): Promise<{ r: number; g: number; b: number }[]> {
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480; // CSS px per virtual px
  const png = await page.screenshot();
  return page.evaluate(
    async ({ b64, spots }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth; // screenshot pixels per CSS pixel
      return spots.map(({ x, y }) => {
        const [r, g, b] = ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        return { r: r!, g: g!, b: b! };
      });
    },
    { b64: png.toString('base64'), spots: points.map((p) => ({ x: box.x + p.x * k, y: box.y + p.y * k })) },
  );
}

/**
 * GDD-LIFE-05: after the last life, waits for the Siete vidas gastadas screen to take presses (its prompt shows after 1.0 s)
 * and presses jump to restart the world.
 */
export async function passGameOver(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
  await page.keyboard.press('Space');
}

/** How red a pixel is: the fill is 185 red against 66 blue, the background 27 against 54. */
export const red = (c: { r: number; g: number; b: number }) => c.r - c.b;

/** Taps (touch) or clicks (mouse) a point given in game px. */
export async function tapAt(page: Page, x: number, y: number, touch: boolean): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  if (touch) await page.touchscreen.tap(box.x + x * k, box.y + y * k);
  else await page.mouse.click(box.x + x * k, box.y + y * k);
}

/** Starts the level the way the device does: Enter on a desktop, a tap off the menu rows on a phone. */
export async function start(page: Page, isMobile: boolean, path = '/'): Promise<void> {
  await openGame(page, path);
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
}

/** What `stepUntil` waits for, checked before each step: the phase reached, the phase left, or Poncho's body drawn. */
export type StepGoal = { phase: RunState['phase'] } | { phaseNot: RunState['phase'] } | { bodyVisible: true };

/**
 * Steps the paused game one step at a time, in the page, until `goal` holds (checked before each step) or `max` steps have run, and
 * returns how many it took. One round trip however slow the frames are (L-042): a loop of one `step(1)` call per step, each with a read
 * of the state between, takes a round trip each and times out where the frames are slow. The caller checks the goal was reached.
 */
export function stepUntil(page: Page, goal: StepGoal, max: number, input: { move: number; jumpHeld: boolean } = { move: 0, jumpHeld: false }): Promise<number> {
  return page.evaluate(
    ({ goal: g, max: limit, input: held }) => {
      const d = window.__PONCHO__!;
      const reached = () => ('phase' in g ? d.phase() === g.phase : 'phaseNot' in g ? d.phase() !== g.phaseNot : d.bodyVisible());
      let n = 0;
      while (n < limit && !reached()) {
        d.step(1, held);
        n++;
      }
      return n;
    },
    { goal, max, input },
  );
}
