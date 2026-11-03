import { expect, test, type Page } from '@playwright/test';
import { LEVEL_1_2 } from '../src/levels/level1-2';
import { LEVEL_1_3 } from '../src/levels/level1-3';
import { boot, openGame, resultsRowCentre, waitForResults } from './helpers';

// GDD-WLD-09: level 1-3, opened by its address, what it draws, its camera at the right edge (GDD-UI-04), its clear screen (GDD-UI-02) and
// the way in from 1-2's clear screen. Things are timed in simulation steps (`phaseSince()`, `ticks()`), never by polling (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

// The 12 slope tiles of 1-3's rows as [column, row, character], written out here and not read from the level; k is the character's place
// in `/ \ r R F f` and v = (7 x column + 3 x row) mod 2 the tile's version, so a slope tile is ground frame 4 + 2k + v and the tile under
// it 16 + 2k + v (GDD-ART-06).
const ORDER = ['/', '\\', 'r', 'R', 'F', 'f'];
const SLOPE_TILES: [number, number, string][] = [
  [6, 13, '/'], [7, 12, '/'], [10, 12, '\\'], [11, 13, '\\'], [69, 13, 'r'], [70, 13, 'R'],
  [75, 13, 'F'], [76, 13, 'f'], [156, 13, '/'], [157, 12, '/'], [163, 12, '\\'], [164, 13, '\\'],
];

test('GDD-UI-02 level=1-3 opens 1-3 on the title screen and Start plays it', async ({ page }) => {
  const errors = await openGame(page, '/?level=1-3');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 50 });
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  // A real level: no placeholder lines and no tips.
  expect(await api(page, () => window.__PONCHO__!.placeholderLines())).toBe(false);
  // Everything 1-3 adds is drawn: three keys, three shut doors, three fragile walls of four tiles, the piñata, the platforms, the blocks.
  expect(await api(page, () => window.__PONCHO__!.keysDrawn())).toBe(3);
  expect(await api(page, () => window.__PONCHO__!.doorsDrawn())).toEqual([false, false, false]);
  expect(await api(page, () => window.__PONCHO__!.fragilesDrawn())).toBe(12);
  expect(await api(page, () => window.__PONCHO__!.pinatasDrawn())).toEqual([false]);
  expect(await api(page, () => window.__PONCHO__!.platforms())).toHaveLength(3);
  expect(await api(page, () => window.__PONCHO__!.blocks())).toHaveLength(4);
  expect(await api(page, () => window.__PONCHO__!.crumbles())).toHaveLength(5);
  const kinds = (await api(page, () => window.__PONCHO__!.enemiesDrawn())).map((e) => e.kind);
  expect(kinds).toHaveLength(6);
  for (const [kind, count] of [['alacran', 1], ['cactus', 1], ['tlacuache', 3], ['zopilote', 1]] as const) expect(kinds.filter((k) => k === kind), kind).toHaveLength(count);
  // The sand slopes are drawn as slope tiles, with the tile under each cut to match (GDD-ART-06, GDD-MOV-09).
  for (const [c, r, char] of SLOPE_TILES) {
    const k = ORDER.indexOf(char);
    const v = (7 * c + 3 * r) % 2;
    expect(await page.evaluate(([x, y]) => window.__PONCHO__!.groundFrame(x!, y!), [c, r]), `slope ${char} at ${c},${r}`).toBe(4 + 2 * k + v);
    expect(await page.evaluate(([x, y]) => window.__PONCHO__!.groundFrame(x!, y!), [c, r + 1]), `under ${char} at ${c},${r}`).toBe(16 + 2 * k + v);
  }
  expect(errors).toEqual([]);
});

test('GDD-UI-04 1-3 the camera stops at the right edge, 2400 px in, and the exit is clear of the phone buttons', async ({ page, isMobile }) => {
  await boot(page, '/?level=1-3');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // On the last cliff, behind its Tlacuache: it starts at x = 2840 heading right, so it neither touches nor spots him there.
  await page.evaluate(() => window.__PONCHO__!.teleport(2730, 128));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 2400 && window.__PONCHO__!.camera().scrollX === 2400);
  if (isMobile) {
    // GDD-WLD-09: with the camera at the right edge the exit is left of the Jump button and above every touch button but the pause button.
    const buttons = (await api(page, () => window.__PONCHO__!.touch())).buttons;
    const exit = LEVEL_1_3.exit!;
    expect(buttons.find((b) => b.id === 'jump')!.x).toBeGreaterThanOrEqual(exit.x + 8 - 2400);
    for (const b of buttons.filter((x) => x.id !== 'pause')) expect(b.y, b.id).toBeGreaterThan(exit.y);
  }
});

test('GDD-LIFE-05 1-3 results menu greys Next level, and Retry starts 1-3 again with the lives at its clear', async ({ page, isMobile }) => {
  await boot(page, '/?level=1-3');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => {
    window.__PONCHO__!.loseLife();
    window.__PONCHO__!.loseLife();
  });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  // On the last cliff touching the exit; the cliff's Tlacuache is behind it, facing away, so the first step clears the level.
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 128));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await waitForResults(page);
  // The level names no next level: "Next level" is darker, and the menu opens on Retry.
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ shown: true, items: ['Next level', 'Retry', 'Quit to title'], chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  // Up from Retry stays there.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('KeyW');
  const t0 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 10, t0);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  // A tap or click on the greyed row does nothing.
  const row = await resultsRowCentre(page, 'next');
  if (isMobile) await page.touchscreen.tap(row.x, row.y);
  else await page.mouse.click(row.x, row.y);
  const t1 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 20, t1);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
  // Enter picks Retry (user, 2026-11-02: "Lives at the clear"): a fresh run of 1-3 with the five it was cleared with, not seven.
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.state().x === 56);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(5);
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 50 });
});

test('GDD-WLD-09 1-2 leads on to 1-3 with its lives, and 1-3 plays and pauses like any level, with no error', async ({ page }) => {
  const errors = await boot(page, '/?level=1-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => {
    window.__PONCHO__!.loseLife();
    window.__PONCHO__!.loseLife();
  });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  const exit = LEVEL_1_2.exit!;
  await page.evaluate(([x, y]) => window.__PONCHO__!.teleport(x!, y!), [exit.x, exit.y]);
  await waitForResults(page);
  await page.keyboard.press('ArrowRight', { delay: 30 }); // no pick: the clear screen waits
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await page.keyboard.press('Enter'); // picks Next level
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-3' && window.__PONCHO__!.ticks() > 10);
  // 1-2's lives carried into 1-3, no crack (GDD-LIFE-05).
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.hudCracking())).toEqual([]);
  // Holding right runs into the level and collects the first hilos.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.hilos().taken >= 1 && window.__PONCHO__!.hudHilos().text === `${window.__PONCHO__!.hilos().taken}/50`);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  expect(errors).toEqual([]);
});
