import { expect, test, type Page } from '@playwright/test';
import { TILE } from '../src/config/tuning';
import { LAB_3T_LEDGES } from '../src/levels/lab3t';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const phases = (page: Page) => api(page, () => window.__PONCHO__!.crumbles().map((c) => c.phase));

// The sandbox level has three crumbling tiles in tile columns 24 to 26 of row 10 (x 384 to 432, top y = 160).
test('GDD-WLD-05 a crumbling tile warns when stood on, then drops Poncho, and comes back after a lost life', async ({ page }) => {
  await boot(page);
  expect(await phases(page)).toEqual(['idle', 'idle', 'idle']);
  // World 1 keeps the sandy placeholder (GDD-ART-06: the rock ledge is World 3's dress only).
  expect((await api(page, () => window.__PONCHO__!.crumbles())).map((c) => c.look)).toEqual(['placeholder', 'placeholder', 'placeholder']);
  await page.evaluate(() => window.__PONCHO__!.teleport(408, 150)); // lands on the middle tile (from below the Tlacuache's ledge, whose underside is y = 112)
  await page.waitForFunction(() => window.__PONCHO__!.crumbles()[1]!.phase === 'warning');
  expect(await phases(page)).toEqual(['idle', 'warning', 'idle']);
  expect(await api(page, () => window.__PONCHO__!.state().y)).toBe(160);
  await page.waitForFunction(() => window.__PONCHO__!.crumbles()[1]!.phase === 'gone');
  await page.waitForFunction(() => window.__PONCHO__!.state().y > 160); // he falls through where it was
  expect((await phases(page))[0]).toBe('idle');
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // into the pit: a life is lost
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.lives() === 6);
  expect(await phases(page)).toEqual(['idle', 'idle', 'idle']);
});

// GDD-ART-06, GDD-WLD-05: lab-3t's three crumbling tiles (`LAB_3T_LEDGES`, columns 60 to 62 of row 12, high over the far side), World 3's.
const MIDDLE = LAB_3T_LEDGES.col0 + 1;
const LEFT_X = MIDDLE * TILE; // the middle tile's left edge, where its image is drawn at rest
const TOP_Y = LAB_3T_LEDGES.row * TILE;

test('GDD-ART-06 in World 3 a crumbling tile is drawn as the rock ledge', async ({ page }) => {
  const errors = await boot(page, '/?level=lab-3t');
  // At rest: the ledge image at each tile, frame 0, drawn.
  const rest = await api(page, () => window.__PONCHO__!.crumbles());
  expect(rest.map((c) => [c.col, c.row, c.look, c.frame, c.visible])).toEqual([0, 1, 2].map((i) => [LAB_3T_LEDGES.col0 + i, LAB_3T_LEDGES.row, 'ledge', 0, true]));
  expect(rest.map((c) => c.x)).toEqual([0, 1, 2].map((i) => (LAB_3T_LEDGES.col0 + i) * TILE));
  // Put down on the middle one and stepped, paused, to its fall: what is drawn after each step (L-073: in one round trip).
  const seen = await page.evaluate(
    ([x, y]) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.teleport(x!, y! - 1);
      const out: { phase: string; steps: number; x: number; frame: number; visible: boolean }[] = [];
      for (let i = 0; i < 200 && d.crumbles()[1]!.phase !== 'gone'; i++) {
        d.step(1);
        const c = d.crumbles()[1]!;
        out.push({ phase: c.phase, steps: c.steps, x: c.x, frame: c.frame, visible: c.visible });
      }
      return out;
    },
    [MIDDLE * TILE + TILE / 2, TOP_Y],
  );
  const warning = seen.filter((c) => c.phase === 'warning');
  expect(warning).toHaveLength(30);
  // In its warning: 1 px left and right of its place, and its pale flash (frame 1) in turn with frame 0, drawn throughout.
  expect(new Set(warning.map((c) => c.x - LEFT_X))).toEqual(new Set([-1, 1]));
  expect(new Set(warning.map((c) => c.frame))).toEqual(new Set([0, 1]));
  expect(warning.every((c) => c.visible)).toBe(true);
  // The warning's first step (30 left): 1 px right, frame 0; its last (1 left): 1 px left, the pale flash.
  expect([warning[0]!.steps, warning[0]!.x - LEFT_X, warning[0]!.frame]).toEqual([30, 1, 0]);
  expect([warning.at(-1)!.steps, warning.at(-1)!.x - LEFT_X, warning.at(-1)!.frame]).toEqual([1, -1, 1]);
  // Gone: not drawn.
  expect(seen.at(-1)).toMatchObject({ phase: 'gone', visible: false });
  expect(errors).toEqual([]);
});

test('GDD-ART-06 in World 3 the rock ledge shakes in its warning through the game\'s own frames', async ({ page }) => {
  // L-021: unpaused, the frames that draw it.
  await boot(page, '/?level=lab-3t');
  await page.evaluate(([x, y]) => window.__PONCHO__!.teleport(x!, y! - 1), [MIDDLE * TILE + TILE / 2, TOP_Y]);
  await page.waitForFunction((left) => {
    const c = window.__PONCHO__!.crumbles()[1]!;
    return c.phase === 'warning' && c.look === 'ledge' && c.visible && Math.abs(c.x - left) === 1;
  }, LEFT_X);
  await page.waitForFunction(() => {
    const c = window.__PONCHO__!.crumbles()[1]!;
    return c.phase === 'gone' && !c.visible;
  });
});
