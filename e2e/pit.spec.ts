import { expect, test, type Page } from '@playwright/test';
import { boot, passGameOver } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

test('GDD-LIFE-02 falling into the pit costs one life, then Poncho respawns at the start with invulnerability', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // above the pit, which spans x = 224 to 272
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(6);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224, grounded: true });
  const invulnerable = await api(page, () => window.__PONCHO__!.invulnerable());
  expect(invulnerable).toBeGreaterThan(0);
  expect(invulnerable).toBeLessThanOrEqual(120);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
});

test('GDD-LIFE-02 walking off the edge into the pit loses exactly one life', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test; touch controls arrive with GDD-CTL-03');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(216, 224)); // on the floor just before the pit (the spring is the tile to its left)
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
});

test('GDD-LIFE-05 losing the last life restarts the world with seven lives', async ({ page }) => {
  await boot(page);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await passGameOver(page); // the Siete vidas gastadas screen first
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 7 && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
});

test('GDD-LIFE-02 Poncho is hidden while waiting to respawn and blinks while invulnerable', async ({ page }) => {
  await boot(page);
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(true);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
  await page.waitForTimeout(100); // let a frame draw
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(false);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  // Sample the opacity while he is invulnerable: it must be both dim and bright at times.
  const seen = new Set<number>();
  for (let i = 0; i < 24; i++) {
    seen.add(await api(page, () => window.__PONCHO__!.bodyAlpha()));
    await page.waitForTimeout(25);
  }
  expect(seen.has(1)).toBe(true);
  expect(seen.has(0.3)).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(true);
  // Once the invulnerability is over he is fully opaque and stays that way.
  await page.waitForFunction(() => window.__PONCHO__!.invulnerable() === 0, undefined, { timeout: 5000 });
  await page.waitForTimeout(100);
  expect(await api(page, () => window.__PONCHO__!.bodyAlpha())).toBe(1);
});

for (const [key, name] of [['KeyX', 'claw'], ['KeyC', 'Fuego']] as const) {
  test(`GDD-LIFE-02 holding the ${name} key skips the respawn wait after 0.3 s`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test');
    await boot(page);
    await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
    await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
    await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
    const start = await api(page, () => window.__PONCHO__!.ticks());
    await page.keyboard.down(key);
    await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
    const waited = (await api(page, () => window.__PONCHO__!.ticks())) - start;
    await page.keyboard.up(key);
    expect(waited).toBeLessThan(40); // skipped at step 18 (0.3 s), well before the 48 steps (0.8 s) of a full wait
    expect(waited).toBeGreaterThanOrEqual(17);
  });
}

test('GDD-LIFE-02 holding the touch Claw button skips the respawn wait after 0.3 s', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'claw')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const at = { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k, id: 1 };
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
  const start = await api(page, () => window.__PONCHO__!.ticks());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  const waited = (await api(page, () => window.__PONCHO__!.ticks())) - start;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(waited).toBeLessThan(40);
  expect(waited).toBeGreaterThanOrEqual(17);
});
