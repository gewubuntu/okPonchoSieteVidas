import { expect, test } from '@playwright/test';
import { boot, openGame } from './helpers';

// GDD-MOV-09: the slopes level (`?level=slopes`). The 12 slope tiles of its rows as [column, row, character]; k is the character's place in
// `/ \ r R F f` and v = (7 x column + 3 x row) mod 2 the tile's version, so a slope tile is ground frame 4 + 2k + v and the tile under it
// 16 + 2k + v (GDD-ART-06).
const ORDER = ['/', '\\', 'r', 'R', 'F', 'f'];
const SLOPE_TILES: [number, number, string][] = [
  [4, 13, '/'], [5, 12, '/'], [8, 12, '\\'], [9, 13, '\\'], [12, 13, 'r'], [13, 13, 'R'],
  [17, 13, 'F'], [18, 13, 'f'], [20, 13, '/'], [21, 13, '\\'], [25, 13, '/'], [26, 13, '\\'],
];

test('GDD-MOV-09 the slopes address opens the slopes level and draws every slope and the tile under it', async ({ page }) => {
  const errors = await openGame(page, '/?level=slopes');
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('slopes');
  for (const [c, r, char] of SLOPE_TILES) {
    const k = ORDER.indexOf(char);
    const v = (7 * c + 3 * r) % 2;
    expect(await page.evaluate(([x, y]) => window.__PONCHO__!.groundFrame(x!, y!), [c, r]), `slope ${char} at ${c},${r}`).toBe(4 + 2 * k + v);
    expect(await page.evaluate(([x, y]) => window.__PONCHO__!.groundFrame(x!, y!), [c, r + 1]), `under ${char} at ${c},${r}`).toBe(16 + 2 * k + v);
  }
  expect([0, 1]).toContain(await page.evaluate(() => window.__PONCHO__!.groundFrame(0, 14)));
  expect(await page.evaluate(() => window.__PONCHO__!.groundFrame(23, 14))).toBeNull(); // the gap
  expect(errors).toEqual([]);
});

test('GDD-MOV-09 the Alacrán is drawn where the simulation has it as it walks a slope', async ({ page }) => {
  await boot(page, '/?level=slopes');
  // It walks down the hill from its start (y 192) to the floor (y 224); read the simulated and the drawn one in the same callback (L-033).
  const seen = (await (
    await page.waitForFunction(() => {
      const d = window.__PONCHO__!;
      const sim = d.enemies()[0]!;
      if (!(sim.y > 192 && sim.y < 224)) return null;
      return { sim, drawn: d.enemiesDrawn().filter((p) => p.kind === 'alacran') };
    })
  ).jsonValue())!;
  expect(seen.drawn).toHaveLength(1);
  expect(seen.drawn[0]!.x).toBeCloseTo(seen.sim.x, 6);
  expect(seen.drawn[0]!.y).toBeCloseTo(seen.sim.y, 6);
});

test('GDD-MOV-09 the Tlacuache is drawn where the simulation has it on the bump', async ({ page }) => {
  await boot(page, '/?level=slopes');
  // It walks left from its start against the right edge (y 224) up the second bump's falling side, so its y goes below 224.
  const seen = (await (
    await page.waitForFunction(() => {
      const d = window.__PONCHO__!;
      const sim = d.enemies()[1]!;
      if (!(sim.y < 224)) return null;
      return { sim, drawn: d.enemiesDrawn().filter((p) => p.kind === 'tlacuache') };
    })
  ).jsonValue())!;
  expect(seen.drawn).toHaveLength(1);
  expect(seen.drawn[0]!.x).toBeCloseTo(seen.sim.x, 6);
  expect(seen.drawn[0]!.y).toBeCloseTo(seen.sim.y, 6);
});
