import { expect, test, type Page } from '@playwright/test';
import { MERCADO, TILE } from '../src/config/tuning';
import { LEVEL_2_1 } from '../src/levels/level2-1';
import { LEVEL_2_2 } from '../src/levels/level2-2';
import type { Level } from '../src/sim/run';
import { plantSpots } from '../src/ui/plants';
import { boot, openGame, phase3Hit, pixelsAt, resultsRowCentre, stepUntil, tapAt, waitForResults } from './helpers';

// World 2, the Mercado (user, 2026-11-04): its levels opened by their address (GDD-UI-02), drawn in the Mercado's look (GDD-ART-06),
// "Start" following the latest world reached, the restart at 2-1 with seven after the last life (GDD-LIFE-05), and 2-4, the last level
// built, naming no next level. Pits, exits, spawns and decor are read from the level modules (GDD-WLD-12, GDD-WLD-13), so a redesign
// of a level moves the tests with it; 2-4 is La Estrella's arena (GDD-BOS-03). Timed in simulation steps (L-042); pixel samples are at
// least 2 px from edges and clear of the touch buttons (L-017, L-018).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const SAVE_KEY = 'poncho-siete-vidas';
type Colour = { r: number; g: number; b: number };
const rgb = (hex: string): Colour => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
/** Whether a pixel is within 12 per channel of one of the colours. */
const nearAny = (c: Colour, hexes: string[]) => hexes.some((h) => Math.abs(c.r - rgb(h).r) <= 12 && Math.abs(c.g - rgb(h).g) <= 12 && Math.abs(c.b - rgb(h).b) <= 12);
/** The touch buttons' boxes in game px, grown by 6, while they are shown (none on a desktop). */
async function buttonBoxes(page: Page): Promise<{ x0: number; y0: number; x1: number; y1: number }[]> {
  const touch = await api(page, () => window.__PONCHO__!.touch());
  if (!touch.visible) return [];
  return touch.buttons.map((b) => ({ x0: b.x - 6, y0: b.y - 6, x1: b.x + b.w + 6, y1: b.y + b.h + 6 }));
}
const covered = (boxes: { x0: number; y0: number; x1: number; y1: number }[], x: number, y: number) => boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;
/** The floor's top row in World 2's levels (y 224). */
const FLOOR_ROW = 14;
/** A level's pits, left to right, as [first column, last column]: the runs of columns whose floor rows (14 to the bottom) are all open. */
function pits(level: Level): [number, number][] {
  const { world } = level;
  const open = (c: number) => Array.from({ length: world.height - FLOOR_ROW }, (_, i) => FLOOR_ROW + i).every((r) => !world.solidTile(c, r));
  const runs: [number, number][] = [];
  for (let c = 0; c < world.width; c++) {
    if (!open(c)) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === c - 1) last[1] = c;
    else runs.push([c, c]);
  }
  return runs;
}

/** A save written before the page loads, the tutorial played and 1-1 to 1-4 cleared, as a save from before World 2 has it. */
const seedWorld1Cleared = (page: Page) => {
  const cleared = { hilos: '0'.repeat(50), medal: 'bronze', bestSteps: 9000, cleared: true };
  const levels = { '1-1': cleared, '1-2': cleared, '1-3': cleared, '1-4': { ...cleared, hilos: '' } };
  const text = JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: true, worldLives: { '1': 3 }, worldAt: { '1': '1-1' } }, levels, run: null });
  return page.addInitScript(([key, value]) => localStorage.setItem(key!, value!), [SAVE_KEY, text]);
};
/** The progress the game saved, parsed (L-054). */
const storedProgress = async (page: Page): Promise<{ worldLives: Record<string, number>; worldAt: Record<string, string> }> =>
  JSON.parse((await api(page, () => localStorage.getItem('poncho-siete-vidas')))!).progress;
/** Starts the level from the title the device's way: Enter on a desktop, a tap off the menu rows on a phone. */
async function startFromTitle(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
}
/** From a paused game: Poncho put at (x, y) and one step taken, then waits until the camera has followed. */
async function standAt(page: Page, x: number, y: number): Promise<number> {
  await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [x, y]);
  await api(page, () => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().scrollX > 0 && window.__PONCHO__!.camera().viewX === window.__PONCHO__!.camera().scrollX);
  return (await api(page, () => window.__PONCHO__!.camera())).scrollX;
}

test('GDD-UI-02 level=2-1 opens World 2 on the title, and Start plays it in the Mercado look', async ({ page, isMobile }) => {
  const errors = await openGame(page, '/?level=2-1');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('2-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.scenery())).toEqual({ set: 'mercado', midKey: 'mercado:mid' });
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toMatchObject({ shown: false, pips: 0 });
  // GDD-ART-06: no sun; the far band from y 84, its foot from y 200 (84 + 464 / 4), the rooftops from y 148.
  expect(await api(page, () => window.__PONCHO__!.backdropLayout())).toEqual({ sunX: null, sunY: null, mountainsY: 84, footY: 200, desertY: 148 });
  // The floor: top tiles on row 14, wall tiles under them, and 2-1's first pit (columns 22 to 24) empty.
  expect([0, 1]).toContain(await api(page, () => window.__PONCHO__!.groundFrame(5, 14)));
  expect([2, 3]).toContain(await api(page, () => window.__PONCHO__!.groundFrame(5, 15)));
  const [pitFrom, pitTo] = pits(LEVEL_2_1)[0]!;
  for (let c = pitFrom; c <= pitTo; c++) expect(await page.evaluate((tx) => window.__PONCHO__!.groundFrame(tx, 14), c), `pit column ${c}`).toBeNull();
  const boxes = await buttonBoxes(page);
  // A floor column in the first screen with nothing on it to draw over the sample: a top tile (no crate on row 13), clear of Poncho at
  // the spawn and at least 4 columns from any enemy's start (the Alacrán walks its pen, columns 11 to 17).
  const { world, spawn, enemies } = LEVEL_2_1;
  const floorCols = Array.from({ length: 30 }, (_, c) => c).filter(
    (c) => world.solidTile(c, FLOOR_ROW) && !world.solidTile(c, FLOOR_ROW - 1) && Math.abs(c - Math.floor(spawn.x / TILE)) > 2 && enemies.every((e) => Math.abs(c - Math.floor(e.x / TILE)) > 4),
  );
  const col = floorCols.find((c) => !covered(boxes, mid(c), 226) && !covered(boxes, mid(c), 248))!;
  expect(col).toBeDefined();
  expect(covered(boxes, 300, 6)).toBe(false);
  // The top band of the sky, the tejas of the walk line's rows 1 and 2 (y 225 to 227), the talavera band (y 232 to 237) and the plaster below.
  const [sky, teja, talavera, plaster] = await pixelsAt(page, [{ x: 300, y: 6 }, { x: col * 16 + 8, y: 226 }, { x: col * 16 + 8, y: 234.5 }, { x: col * 16 + 8, y: 248 }]);
  expect(nearAny(sky!, ['#86BEE0']), `sky ${JSON.stringify(sky)}`).toBe(true);
  expect(nearAny(teja!, ['#E07A52', '#C45E3E', '#8A3B30']), `teja ${JSON.stringify(teja)}`).toBe(true);
  expect(nearAny(talavera!, ['#1C3F9E', '#F4EFE2', '#E9B53F']), `talavera ${JSON.stringify(talavera)}`).toBe(true);
  expect(nearAny(plaster!, ['#E07F8E', '#B85E6E', '#F2B0A6', '#C45E3E']), `plaster ${JSON.stringify(plaster)}`).toBe(true);
  expect(errors).toEqual([]);
});

test('GDD-ART-06 World 2 parallax follows the camera at 0.1, 0.3 and 0.5', async ({ page }) => {
  await boot(page, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.backdrop())).toEqual({ clouds: 0, mountains: 0, desert: 0 });
  await api(page, () => window.__PONCHO__!.pause(true));
  const scrollX = await standAt(page, 900, 224);
  expect(scrollX).toBeGreaterThan(300);
  const offsets = await api(page, () => window.__PONCHO__!.backdrop());
  expect(offsets).toEqual({ clouds: Math.round(scrollX * 0.1 * 4) / 4, mountains: Math.round(scrollX * 0.3 * 4) / 4, desert: Math.round(scrollX * 0.5 * 4) / 4 });
});

test('GDD-ART-06 a pit in World 2 shows the dark street', async ({ page, isMobile }) => {
  await boot(page, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  // 2-1's first pit (columns 22 to 24), Poncho on the floor two columns before it, past the Alacrán's pen.
  const [pitFrom, pitTo] = pits(LEVEL_2_1)[0]!;
  const scrollX = await standAt(page, mid(pitFrom - 2), FLOOR_ROW * TILE);
  const boxes = await buttonBoxes(page);
  // The pit's columns, the middle one first, at y 250, well below the floor's top.
  const middle = Math.floor((pitFrom + pitTo) / 2);
  const cols = [middle, ...Array.from({ length: pitTo - pitFrom + 1 }, (_, i) => pitFrom + i).filter((c) => c !== middle)];
  const x = cols.map((c) => mid(c) - scrollX).find((px) => px > 2 && px < 478 && !covered(boxes, px, 250))!;
  expect(x, isMobile ? 'phone' : 'desktop').toBeDefined();
  const [pit] = await pixelsAt(page, [{ x, y: 250 }]);
  expect(nearAny(pit!, ['#4E4A78']), `pit ${JSON.stringify(pit)}`).toBe(true);
});

test('GDD-ART-06 World 2 decor stands on the ground behind everything, by the plant rule', async ({ page }) => {
  await boot(page, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const decor = await api(page, () => window.__PONCHO__!.plants());
  // What the plant rule places in 2-1 with World 2's decor sizes (src/ui/plants.test.ts holds the rule's own tests), as [kind, x, y]: x the
  // middle of the column, y 1 px into the top of the tile it stands on.
  const spots = plantSpots(LEVEL_2_1, MERCADO.decor);
  expect(spots.length).toBeGreaterThan(0);
  expect(decor.map((p) => [p.kind, p.x, p.y])).toEqual(spots.map((s) => [s.kind, mid(s.col), s.row * TILE + 1]));
  for (const p of decor) {
    expect(p.depth, `decor at ${p.x}`).toBeGreaterThan(-0.5);
    expect(p.depth, `decor at ${p.x}`).toBeLessThan(1);
  }
});

test('GDD-LIFE-05 lives carry from 2-1 into 2-2 by Next level', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 2; i++) await api(page, () => window.__PONCHO__!.loseLife());
  // 2-1's exit, on the last rooftop (column 174, y 80).
  await page.evaluate(([x, y]) => window.__PONCHO__!.teleport(x!, y!), [LEVEL_2_1.exit!.x, LEVEL_2_1.exit!.y]);
  await stepUntil(page, { phase: 'clear' }, 30);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('next');
  expect(await storedProgress(page)).toMatchObject({ worldLives: { '2': 5 }, worldAt: { '2': '2-2' } });
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '2-2' && window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
});

test('GDD-LIFE-05 out of lives in 2-2, the press starts 2-1 at once with seven lives', async ({ page }) => {
  await boot(page, '/?level=2-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  // Dropped over the middle of 2-2's first pit (columns 49 to 54; its rollo is rolled up at its left post, so nothing bridges it, and no
  // enemy is near): the last life is lost in the pit.
  const [pitFrom, pitTo] = pits(LEVEL_2_2)[0]!;
  await page.evaluate((x) => window.__PONCHO__!.teleport(x, 150), mid(Math.floor((pitFrom + pitTo) / 2)));
  expect(await stepUntil(page, { phase: 'respawning' }, 200)).toBeLessThan(200);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(0);
  await stepUntil(page, { phase: 'gameover' }, 60);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
  // Saved as the screen comes up: World 2's lives spent and its run back at 2-1; World 1 untouched.
  const progress = await storedProgress(page);
  expect(progress).toMatchObject({ worldLives: { '2': 0 }, worldAt: { '2': '2-1' } });
  expect(progress.worldLives['1']).toBeUndefined();
  // The press after the screen's 1.0 s starts 2-1 at once, in one task so the next frame cannot replace the scene in between.
  await api(page, () => window.__PONCHO__!.step(61));
  expect(
    await page.evaluate(() => {
      window.__PONCHO__!.step(1, { move: 0, jumpHeld: true });
      return { phase: window.__PONCHO__!.phase(), level: window.__PONCHO__!.level() };
    }),
  ).toEqual({ phase: 'gameover', level: '2-2' });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '2-1' && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: LEVEL_2_1.spawn.x, y: LEVEL_2_1.spawn.y });
});

test('GDD-UI-02 a save from before World 2 that cleared 1-4 opens on the title over 2-1, and Start plays it with seven', async ({ page, isMobile }) => {
  await seedWorld1Cleared(page);
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('2-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('2-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-UI-02 2-4, the last level built, names no next level: its clear greys Next level and opens on Retry', async ({ page, isMobile }) => {
  await boot(page, '/?level=2-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  // GDD-ART-06: World 2's arena is drawn with the plaza in place of the rooftops; GDD-UI-01: its boss bar names its boss.
  expect(await api(page, () => window.__PONCHO__!.scenery())).toEqual({ set: 'mercado', midKey: 'mercado:plaza' });
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toMatchObject({ shown: true, name: 'La Estrella', pips: 3 });
  // La Estrella set to two hits (phase 3): her first drop tears the middle awning away beside Poncho on the left cordel, and from there a
  // jump bumps her as she hangs, the third hit (GDD-BOS-03).
  await api(page, () => window.__PONCHO__!.setEstrella(2));
  expect(await phase3Hit(page)).toBe(3);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ hits: 3, mode: 'defeated' });
  await stepUntil(page, { phase: 'clear' }, 70);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  // World 2's run ends there: a new one at 2-1.
  expect(await storedProgress(page)).toMatchObject({ worldAt: { '2': '2-1' } });
  await api(page, () => window.__PONCHO__!.pause(false));
  // Up from Retry stays there, and a tap or click on the greyed row does nothing.
  await page.keyboard.press('ArrowUp');
  const t0 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 10, t0);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
  const row = await resultsRowCentre(page, 'next');
  if (isMobile) await page.touchscreen.tap(row.x, row.y);
  else await page.mouse.click(row.x, row.y);
  const t1 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 20, t1);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('2-4');
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
});
