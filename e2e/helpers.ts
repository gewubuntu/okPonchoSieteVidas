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
