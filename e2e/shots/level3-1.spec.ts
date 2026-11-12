// Screenshots of level 3-1 "La Barranca" for visual review (GDD-WLD-16, GDD-UI-04, GDD-UI-05, GDD-ENM-04, GDD-WLD-05, GDD-ART-06). Run
// with `npm run shots`; images land in shots/ (not committed). Where things are comes from `src/levels/level3-1.ts` (L-062). The level is
// started the device's way and the four hilos of the flat's arc are taken in play first (L-045), but for the start; then Poncho is put on
// solid ground a few tiles before each place and the real inputs run step by step in the paused game (L-042) until the moment it shows.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { TILE } from '../../src/config/tuning';
import { LEVEL_3_1, LEVEL_3_1_GROUND, LEVEL_3_1_LEDGES, LEVEL_3_1_PIECES, LEVEL_3_1_PITS } from '../../src/levels/level3-1';
import { kindOf } from '../../src/sim/enemy';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the paused frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;
/** The top row of the ground stretch that holds column `col`. */
const groundRow = (col: number): number => LEVEL_3_1_GROUND.find((s) => col >= s.col0 && col <= s.col1)!.row;
const L = LEVEL_3_1;
const [L1, L2, , L3, L4] = LEVEL_3_1_LEDGES;
/** The place in the level's list (L-015) of the enemy of kind `kind` that starts in column `col`. */
const enemyAt = (kind: 'alacran' | 'murcielago', col: number): number => L.enemies.findIndex((e) => kindOf(e) === kind && Math.floor(e.x / TILE) === col);
/** The enemies by kind and starting column (GDD-WLD-16): the first bat (the level's first), the second chasm's, the lower pen's Alacrán, the last glide's two. */
const BAT_1 = L.enemies.findIndex((e) => kindOf(e) === 'murcielago');
const CHASM_BAT = enemyAt('murcielago', 108);
const LOWER_ALACRAN = enemyAt('alacran', 157);
const LAST_BATS = [enemyAt('murcielago', 220), enemyAt('murcielago', 225)];

/** Starts 3-1 the device's way (L-045) and pauses it, Poncho standing at the spawn. */
async function open(page: Page, isMobile: boolean): Promise<void> {
  await start(page, isMobile, '/?level=3-1');
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
  });
}

/** From the spawn, the glided jump over the flat that takes its four hilos (a take-off at x 92, held to the landing), as a player takes them. */
async function takeArc(page: Page): Promise<void> {
  const taken = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let jumped = false;
    let air = false;
    for (let i = 0; i < 300 && !(air && d.state().grounded); i++) {
      if (!jumped && d.state().x >= 92) jumped = true;
      d.step(1, { move: 1, jumpHeld: jumped });
      air ||= !d.state().grounded;
    }
    d.step(10);
    return d.hilos().taken;
  });
  expect(taken).toBe(4);
}

/** Puts Poncho 1 px over the ground of column `col` (a teleport onto solid ground) and steps until he stands there. */
async function standOn(page: Page, col: number): Promise<void> {
  const grounded = await page.evaluate(
    ([x, y]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      return d.state().grounded;
    },
    [mid(col), groundRow(col) * TILE],
  );
  expect(grounded).toBe(true);
}

/** Walks the way `dir` says until his middle is past level x `x`, then lets go and stands still. */
const walkTo = (page: Page, x: number, dir: 1 | -1 = 1) =>
  page.evaluate(
    ([to, way]) => {
      const d = window.__PONCHO__!;
      for (let i = 0; i < 300 && way! * (d.state().x - to!) < 0; i++) d.step(1, { move: way!, jumpHeld: false });
      for (let i = 0; i < 30 && d.state().vx !== 0; i++) d.step(1);
      return d.state();
    },
    [x, dir],
  );

/** A run right with the jump taken at level x `from` and held, until `stop` says so (checked after each step) or 300 steps. */
const leap = (page: Page, from: number, holdUntil: number, stop: 'x' | 'landed', at = 0) =>
  page.evaluate(
    ([take, until, mode, x]) => {
      const d = window.__PONCHO__!;
      let jumped = false;
      let air = false;
      for (let i = 0; i < 300; i++) {
        if (!jumped && d.state().grounded && d.state().x >= take) jumped = true;
        d.step(1, { move: 1, jumpHeld: jumped && d.state().x < until });
        air ||= !d.state().grounded;
        if (mode === 'x' ? d.state().x >= x : air && d.state().grounded) break;
      }
      return { s: d.state(), phase: d.phase(), lives: d.lives() };
    },
    [from, holdUntil, stop, at] as const,
  );

/** What the screen shows: the camera, Poncho, the enemies and the crumbling tiles. */
const view = (page: Page) => page.evaluate(() => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state(), enemies: window.__PONCHO__!.enemies(), crumbles: window.__PONCHO__!.crumbles(), lives: window.__PONCHO__!.lives(), phase: window.__PONCHO__!.phase() }));
type View = Awaited<ReturnType<typeof view>>;
/** Whether level point (x, y) is on the screen. */
const onScreen = (v: View, x: number, y: number) => x >= v.cam.scrollX && x < v.cam.scrollX + 480 && y >= v.cam.scrollY && y < v.cam.scrollY + 270;

test('GDD-UI-05 3-1: the start, the glide tip and the four hilos it points at', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await page.evaluate(() => window.__PONCHO__!.step(13));
  await page.waitForFunction(() => window.__PONCHO__!.tip().alpha === 1);
  const tip = await page.evaluate(() => window.__PONCHO__!.tip());
  expect(tip).toMatchObject({ index: 0, device: isMobile ? 'touch' : 'keyboard' });
  const v = await view(page);
  expect(v.cam.scrollY).toBe(8);
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(0);
  await shot(page, info, 'level3-1-start');
});

test('GDD-WLD-16 3-1: the long glide, mid-air over the drop on the hilo line', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  // From the ground 2 columns before the stone (the long glide's lip), a hop onto it and the jump at its edge held.
  await standOn(page, 36);
  const r = await leap(page, 37 * TILE, 99999, 'x', mid(47));
  expect(r.s.gliding).toBe(true);
  expect(r.phase).toBe('playing');
  await shot(page, info, 'level3-1-long-glide');
});

test('GDD-WLD-16 3-1: gliding over the first chasm', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  const chasm = LEVEL_3_1_PITS[0]!;
  await standOn(page, chasm.col0 - 4);
  const r = await leap(page, chasm.col0 * TILE - 8, 99999, 'x', mid(chasm.col0 + 3));
  expect(r.s.gliding).toBe(true);
  expect(Math.floor(r.s.x / TILE)).toBeLessThanOrEqual(chasm.col1);
  await shot(page, info, 'level3-1-first-chasm');
});

test('GDD-ENM-04 3-1: standing 3 tiles before the first bat', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  const bat = L.enemies[BAT_1]!;
  const col = Math.floor(bat.x / TILE) - 3;
  await standOn(page, col - 2);
  await walkTo(page, mid(col) - 4);
  const v = await view(page);
  expect(v.s.grounded).toBe(true);
  expect(Math.floor(v.s.x / TILE)).toBe(col);
  expect(v.enemies[BAT_1]!.alive).toBe(true);
  expect(onScreen(v, v.enemies[BAT_1]!.x, v.enemies[BAT_1]!.y)).toBe(true);
  await shot(page, info, 'level3-1-first-bat');
});

test('GDD-WLD-16 3-1: at the second chasm lip, the far bank and its bat on screen', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  const chasm = LEVEL_3_1_PITS[1]!;
  await standOn(page, chasm.col0 - 4);
  await walkTo(page, mid(chasm.col0 - 2));
  const v = await view(page);
  expect(v.s.grounded).toBe(true);
  expect(Math.floor(v.s.x / TILE)).toBeLessThan(chasm.col0);
  expect(onScreen(v, v.enemies[CHASM_BAT]!.x, v.enemies[CHASM_BAT]!.y)).toBe(true);
  // The far bank's first column.
  expect(onScreen(v, (chasm.col1 + 1) * TILE + 2, groundRow(chasm.col1 + 1) * TILE + 2)).toBe(true);
  await shot(page, info, 'level3-1-second-chasm');
});

/** From the rest's ground 3 columns before the stone (columns 134 and 135, a step up), a hop onto it; he stands on it. */
async function ontoStone(page: Page): Promise<void> {
  await standOn(page, 131);
  const on = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let air = false;
    for (let i = 0; i < 120 && !(air && d.state().grounded); i++) {
      d.step(1, { move: d.state().x < 134 * 16 + 4 ? 1 : 0, jumpHeld: d.state().x > 132 * 16 + 4 && i < 60 });
      air ||= !d.state().grounded;
    }
    for (let i = 0; i < 30 && d.state().vx !== 0; i++) d.step(1);
    return d.state();
  });
  expect(on).toMatchObject({ y: 18 * TILE, grounded: true });
}

test('GDD-WLD-16 3-1: on the stone over the cliff face, L1, L2 and F1 in view', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  await ontoStone(page);
  const v = await view(page);
  for (const ledge of [L1!, L2!]) expect(onScreen(v, (ledge.col1 + 1) * TILE - 2, ledge.row * TILE + 2), `ledge at ${ledge.col0}`).toBe(true);
  const f1 = LEVEL_3_1_PIECES[0]!;
  expect(onScreen(v, f1.col0 * TILE + 2, f1.row0 * TILE + 2)).toBe(true);
  await shot(page, info, 'level3-1-cliff-face');
});

test('GDD-WLD-05 3-1: on L1 in its warning', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  await ontoStone(page);
  // From the stone, the jump held and let go over column 138.4: he lands on L1 (GDD-WLD-16), which starts to crumble.
  const r = await leap(page, 135.6 * TILE, 138.4 * TILE, 'landed');
  expect(r.s).toMatchObject({ y: L1!.row * TILE, grounded: true });
  const warning = await page.evaluate((row) => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 20 && !d.crumbles().some((c) => c.row === row && c.phase === 'warning' && c.frame === 1); i++) d.step(1);
    return d.crumbles().filter((c) => c.row === row && c.phase === 'warning').length;
  }, L1!.row);
  expect(warning).toBeGreaterThan(0);
  expect((await view(page)).s.y).toBe(L1!.row * TILE);
  await shot(page, info, 'level3-1-ledge-warning');
});

test('GDD-WLD-16 3-1: the middle gallery, right to left over its crumbling floor', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  // On F2's right part, under F1, walking left towards the four crumbling tiles.
  const floor = LEVEL_3_1_PIECES[3]!;
  const r = await page.evaluate(
    ([x, y, to]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      for (let i = 0; i < 200 && d.state().x > to!; i++) d.step(1, { move: -1, jumpHeld: false });
      for (let i = 0; i < 30 && d.state().vx !== 0; i++) d.step(1);
      return d.state();
    },
    [mid(floor.col1 - 1), floor.row0 * TILE, mid(floor.col0 + 2)],
  );
  expect(r).toMatchObject({ y: floor.row0 * TILE, grounded: true, facing: -1 });
  await shot(page, info, 'level3-1-middle-gallery');
});

test('GDD-WLD-16 3-1: the lower pen, its Alacrán between the rocks', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  const alacran = L.enemies[LOWER_ALACRAN]!;
  const col = Math.floor(alacran.x / TILE) - 7;
  await standOn(page, col - 3);
  await walkTo(page, mid(col));
  const v = await view(page);
  expect(v.s).toMatchObject({ y: groundRow(col) * TILE, grounded: true });
  expect(v.enemies[LOWER_ALACRAN]!.alive).toBe(true);
  expect(onScreen(v, v.enemies[LOWER_ALACRAN]!.x, v.enemies[LOWER_ALACRAN]!.y - 4)).toBe(true);
  await shot(page, info, 'level3-1-lower-pen');
});

test("GDD-WLD-16 3-1: at the gallery's edge over the pit, L3 and L4 in view", async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  const pit = LEVEL_3_1_PITS[2]!;
  await standOn(page, pit.col0 - 4);
  await walkTo(page, mid(pit.col0 - 1) - 2);
  const v = await view(page);
  expect(v.s).toMatchObject({ y: groundRow(pit.col0 - 1) * TILE, grounded: true });
  for (const ledge of [L3!, L4!]) expect(onScreen(v, (ledge.col1 + 1) * TILE - 2, ledge.row * TILE + 2), `ledge at ${ledge.col0}`).toBe(true);
  info.annotations.push({ type: 'rest on screen', description: String(onScreen(v, (pit.col1 + 1) * TILE + 2, groundRow(pit.col1 + 1) * TILE + 2)) });
  await shot(page, info, 'level3-1-pit-ledges');
});

test('GDD-WLD-16 3-1: the last lip, both bats, the pillar and its veladora', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  // On the last lip itself: the patrol bat flies across the ledge before it at body height, so a walk from further back meets it.
  const ofrenda = Math.floor(L.ofrendas[2]!.x / TILE);
  const lip = LEVEL_3_1_GROUND.find((g) => g.col0 <= ofrenda && g.col1 >= ofrenda)!.col1;
  await standOn(page, lip);
  // Past the glide tip's fade out (12 steps): it was up over the flat when he left it.
  await page.evaluate(() => window.__PONCHO__!.step(15));
  expect((await page.evaluate(() => window.__PONCHO__!.tip())).alpha).toBe(0);
  const v = await view(page);
  expect(v.lives).toBe(7);
  for (const i of LAST_BATS) expect(onScreen(v, v.enemies[i]!.x, v.enemies[i]!.y), `bat ${i}`).toBe(true);
  expect(onScreen(v, mid(L.veladora!.col), L.veladora!.row * TILE + 8)).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  await shot(page, info, 'level3-1-ketsu');
});

test('GDD-WLD-16 3-1: the canyon floor, the exit ahead', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await takeArc(page);
  // From the last lip, a walk off it onto the pillar (the veladora) and the held glide from its right end to the canyon floor.
  const ofrenda = Math.floor(L.ofrendas[2]!.x / TILE);
  const lip = LEVEL_3_1_GROUND.find((g) => g.col0 <= ofrenda && g.col1 >= ofrenda)!.col1;
  await standOn(page, lip);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let air = false;
    for (let i = 0; i < 200 && !(air && d.state().grounded); i++) {
      d.step(1, { move: i < 20 ? 1 : 0, jumpHeld: false });
      air ||= !d.state().grounded;
    }
  });
  const pillar = LEVEL_3_1_GROUND.find((g) => g.col0 <= L.veladora!.col && g.col1 >= L.veladora!.col)!;
  const r = await leap(page, (pillar.col1 + 1) * TILE - 8, 99999, 'landed');
  expect(r.s).toMatchObject({ y: L.exit!.y, grounded: true });
  await walkTo(page, L.exit!.x - 3 * TILE);
  const v = await view(page);
  expect(v.phase).toBe('playing');
  expect(onScreen(v, L.exit!.x, L.exit!.y - 8)).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  await shot(page, info, 'level3-1-exit');
});
