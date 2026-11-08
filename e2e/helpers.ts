import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
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

/**
 * Opens the game (the sandbox, or the address given) and starts the level from the title screen with Enter, which is no game button, so
 * nothing counts as held. Enter picks the chosen row: with a saved run (GDD-PRG-02) that is "Continue", so a test that seeds one presses
 * Down first to start the level itself.
 */
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

/** GDD-UI-02: waits for the level clear screen's results menu to be drawn, which is from the screen's first 1.0 s (60 steps) on. */
export const waitForResults = (page: Page) => page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear' && window.__PONCHO__!.clearDrawn().menu.shown);

/** The middle of a results menu row on the page, in CSS px, for a tap, a click or a held finger. */
export async function resultsRowCentre(page: Page, item: 'next' | 'retry' | 'quit'): Promise<{ x: number; y: number }> {
  const row = (await page.evaluate(() => window.__PONCHO__!.resultsMenu())).find((r) => r.item === item)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  return { x: box.x + (row.x + row.w / 2) * k, y: box.y + (row.y + row.h / 2) * k };
}

/**
 * GDD-BOS-02: steps the paused game one step at a time, in the page, until the boss is in `mode` (checked before each step) or `max` steps
 * have run, and returns how many it took (one round trip, L-042). The caller checks the mode was reached.
 */
export function stepToBossMode(page: Page, mode: string, max = 1000): Promise<number> {
  return page.evaluate(
    ({ m, n }) => {
      const d = window.__PONCHO__!;
      let i = 0;
      while (i < n && d.boss()?.mode !== m) {
        d.step(1);
        i++;
      }
      return i;
    },
    { m: mode, n: max },
  );
}

/**
 * GDD-BOS-03: steps the paused game one step at a time, in the page, until La Estrella is in `mode` (checked before each step) or `max`
 * steps have run, and returns how many it took (one round trip, L-042). The caller checks the mode was reached.
 */
export function stepToEstrellaMode(page: Page, mode: string, max = 1000): Promise<number> {
  return page.evaluate(
    ({ m, n }) => {
      const d = window.__PONCHO__!;
      let i = 0;
      while (i < n && d.estrella()?.mode !== m) {
        d.step(1);
        i++;
      }
      return i;
    },
    { m: mode, n: max },
  );
}

/**
 * GDD-BOS-03: in the paused game, with La Estrella hanging over the left awning and Poncho on the floor under her, a jump held through its
 * landing on the awning: the tier 1 rebound bumps her (GDD-WLD-10). One step with jump up first, so the hold is a new press (L-048).
 * Steps until her hits go up (the step of the hit is the last) or 80 steps have run, and returns her hits.
 */
export function bumpEstrella(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = window.__PONCHO__!;
    const before = d.estrella()!.hits;
    d.step(1);
    for (let i = 0; i < 80 && d.estrella()!.hits === before; i++) d.step(1, { move: 0, jumpHeld: true });
    return d.estrella()!.hits;
  });
}

/**
 * GDD-BOS-03: in the paused game, in her phase 3, a hit the way the arena's bot makes it: Poncho waits on the middle awning at x 248 so
 * she aims there; as her drop starts (it tears through the awning) he is put on the end of the right cordel (x 275), clear of her line;
 * once she hangs and her sway brings her within 12 px across, a cordel jump bumps her (`bumpEstrella`). Returns her hits.
 */
export async function phase3Hit(page: Page): Promise<number> {
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 176));
  await stepToEstrellaMode(page, 'drop', 1000);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.teleport(275, 136);
    for (let i = 0; i < 300 && !(d.estrella()!.mode === 'hang' && Math.abs(d.estrella()!.x - 275) < 12); i++) d.step(1);
  });
  return bumpEstrella(page);
}

/**
 * GDD-ART-04: a sprite sheet's pixels, read from its PNG under `assets/sprites/` as the game loads it (scripts/art/png.mjs writes 8-bit RGBA
 * rows, each with filter byte 0), so a pixel test can find where a frame has a colour without copying the drawing. '#RRGGBB', or null where
 * it is clear.
 */
export function readSheet(file: string): { width: number; height: number; at: (x: number, y: number) => string | null } {
  const png = readFileSync(new URL(`../assets/sprites/${file}`, import.meta.url));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const data: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') data.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = 1 + width * 4;
  return {
    width,
    height,
    at: (x, y) => {
      const i = y * stride + 1 + x * 4;
      if (raw[i + 3] === 0) return null;
      return `#${[raw[i]!, raw[i + 1]!, raw[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    },
  };
}

/**
 * The places in frame `frame` of a sheet of `w` x `h` game px frames (in rows as wide as the sheet) where a square `size` game px across is all of `colour` (one
 * colour, or any of several) and, with `not`, frame `not` is clear there: the middle of each, in game px from the frame's middle, for a
 * frame shown facing right.
 */
export function spotsIn(sheet: ReturnType<typeof readSheet>, w: number, h: number, frame: number, colour: string | readonly string[], { size = 2, not }: { size?: number; not?: number } = {}): { dx: number; dy: number }[] {
  const colours: readonly (string | null)[] = typeof colour === 'string' ? [colour] : colour;
  const k = 4; // ART_SCALE: art px a game px
  const [fw, fh, n] = [w * k, h * k, size * k];
  const cols = Math.floor(sheet.width / fw);
  const at = (f: number, x: number, y: number) => sheet.at((f % cols) * fw + x, Math.floor(f / cols) * fh + y);
  const out: { dx: number; dy: number }[] = [];
  for (let y = 0; y + n <= fh; y += 2) {
    for (let x = 0; x + n <= fw; x += 2) {
      let ok = true;
      for (let j = 0; j < n && ok; j++) for (let i = 0; i < n && ok; i++) {
        if (!colours.includes(at(frame, x + i, y + j))) ok = false;
        else if (not !== undefined && at(not, x + i, y + j) !== null) ok = false;
      }
      if (ok) out.push({ dx: (x + n / 2 - fw / 2) / k, dy: (y + n / 2 - fh / 2) / k });
    }
  }
  return out;
}

/** Whether a point (game px) lies clear of the phone's touch buttons, with a margin (L-018). */
export async function clearOfButtons(page: Page, points: { x: number; y: number }[], margin = 3): Promise<{ x: number; y: number }[]> {
  const { buttons } = await page.evaluate(() => window.__PONCHO__!.touch());
  return points.filter((p) => !buttons.some((b) => p.x > b.x - margin && p.x < b.x + b.w + margin && p.y > b.y - margin && p.y < b.y + b.h + margin));
}

/** Whether a pixel is near a '#RRGGBB' colour, give or take a little for the screen's scaling. */
export const nearHex = (c: { r: number; g: number; b: number }, hex: string, by = 24) => [1, 3, 5].every((i, k) => Math.abs([c.r, c.g, c.b][k]! - parseInt(hex.slice(i, i + 2), 16)) <= by);
