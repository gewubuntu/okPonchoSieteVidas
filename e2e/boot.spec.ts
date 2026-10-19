import { expect, test, type Page } from '@playwright/test';
import type { PonchoDebug } from '../src/scenes/PlayScene';

declare global {
  interface Window {
    __PONCHO__?: PonchoDebug;
  }
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  return errors;
}

test('GDD-TEC-01 boots with a canvas and no console errors', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('#game canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('GDD-ART-01 and GDD-TEC-03 canvas fits the screen without scrolling', async ({ page }) => {
  await boot(page);
  const m = await page.evaluate(() => {
    const c = document.querySelector('#game canvas');
    if (!c) throw new Error('no canvas');
    const r = c.getBoundingClientRect();
    return {
      w: r.width, h: r.height, vw: innerWidth, vh: innerHeight,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      overflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    };
  });
  expect(m.w).toBeLessThanOrEqual(m.vw + 0.5);
  expect(m.h).toBeLessThanOrEqual(m.vh + 0.5);
  expect(Math.abs(m.w / m.h - 16 / 9)).toBeLessThan(0.02);
  expect(m.overflowX || m.overflowY).toBe(false);
});

test('GDD-MOV-02 holding jump reaches about 56 px in the real game', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test; touch controls arrive with GDD-CTL-03');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.keyboard.down('Space');
  await page.waitForTimeout(450);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  const peak = await page.evaluate(() => window.__PONCHO__!.peakRise());
  expect(peak).toBeGreaterThan(54);
  expect(peak).toBeLessThan(58);
});

test('GDD-MOV-01 holding right runs at the max speed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test; touch controls arrive with GDD-CTL-03');
  await boot(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  const vx = await page.evaluate(() => window.__PONCHO__!.state().vx);
  await page.keyboard.up('ArrowRight');
  expect(vx).toBeCloseTo(120, 0);
});
