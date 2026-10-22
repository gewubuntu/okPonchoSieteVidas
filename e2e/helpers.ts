import type { Page } from '@playwright/test';
import type { PonchoDebug } from '../src/scenes/PlayScene';

declare global {
  interface Window {
    __PONCHO__?: PonchoDebug;
  }
}

/** Opens the game, waits for the dev debug hook and returns the list of console and page errors seen so far. */
export async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
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
