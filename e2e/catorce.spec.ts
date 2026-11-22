import { expect, test, type Page } from '@playwright/test';
import { LEVEL_3_4, LEVEL_3_4_HOME } from '../src/levels/level3-4';
import { catorceBox, catorceStart } from '../src/sim/catorce';
import { mineGroundFrame } from '../src/ui/groundTiles';
import { boot, clearOfButtons, nearHex, openGame, pixelsAt, stepUntil, tapAt, waitForResults } from './helpers';

// GDD-BOS-04: La Catorce in her arena, level 3-4, World 3's last level after 3-3 (GDD-UI-02, user, 2026-11-21: "Link 3-3 to 3-4 now"; 3-3's
// Next level into it is played in `e2e/level3-3.spec.ts`), opened here by its address, drawn from her sheet
// (`assets/sprites/boss/la-catorce.png`, her look picked by `catorcePose`) and her armour's plume. Timed in simulation steps, never by polling around an event (L-042): the stepped tests pause
// the game and step it in the page; two run through the game's own frames (L-021). What is drawn is read back through `catorceDrawn()`,
// `homeDrawn()` and `rails()`, always in the same callback as the state it must agree with (L-033). Where things are comes from the GDD's numbers
// and `src/levels/level3-4.ts` (L-062): her box 64 x 32 on the floor (y 192 to 224), her stops at x 80 and 400 in phases 1 and 2, home at columns 14
// and 15 (x 224 and 240), her first slam at the left stop on step 270, her second at 1170, and a cart set rolling at m 16 hits her 55 steps later.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const DEF = LEVEL_3_4.catorce!;
const SAVE_KEY = 'poncho-siete-vidas';
/** The step of her second slam at the left stop in phase 1 (her first, on step 270, is the one that ends her armour). */
const SECOND_LEFT_SLAM = 1170;
/** GDD-ART-06: the solid tiles of 3-4's floor, each with the frame the mine's rule gives it (the shed's floor is the mine's). */
const FLOOR = (() => {
  const { world } = LEVEL_3_4;
  const tiles: { tx: number; ty: number; frame: number }[] = [];
  for (let ty = 0; ty < world.height; ty++) for (let tx = 0; tx < world.width; tx++) if (world.solidTile(tx, ty)) tiles.push({ tx, ty, frame: mineGroundFrame(world, tx, ty) });
  return tiles;
})();

/** Boots 3-4 from its title screen and pauses it a few steps in, Poncho at the start (x 240, on home). */
async function arena(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=3-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

test('GDD-BOS-04 3-4 opens by its address and plays La Catorce: bar, pips, her frame at her box', async ({ page, isMobile }) => {
  const errors = await openGame(page, '/?level=3-4');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-4');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5 && window.__PONCHO__!.catorceDrawn() !== null);
  // Her phase 1 is started afresh and stepped once in the same call that reads (L-042: a slow frame after the wait could take her past her
  // 30-step telegraph at x 400), and the run's state, her drawn box and the bar are read together (L-033).
  const seen = await api(page, () => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.setCatorce(0);
    d.step(1);
    return { run: d.catorce()!, drawn: d.catorceDrawn()!, bar: d.bossBar(), scenery: d.scenery() };
  });
  expect(seen.bar).toMatchObject({ shown: true, name: 'La Catorce', nameY: 10, pips: 3, outlines: 0 });
  // GDD-ART-06: drawn in the engine shed: its back wall in the mid band, and its floor tiles in the mine's frames from the mine's sheet
  // (`sierra:ground-mina`, `imageKey`): tile (0, 15) is deep rock, frame 31, which the canyon's 28-frame sheet does not have.
  expect(seen.scenery).toEqual({ set: 'sierra', midKey: 'sierra:mid-casa', place: 'casa' });
  const frames = await page.evaluate((tiles) => tiles.map(({ tx, ty }) => window.__PONCHO__!.groundFrame(tx, ty)), FLOOR);
  expect(frames).toEqual(FLOOR.map((t) => t.frame));
  expect(FLOOR.find((t) => t.tx === 0 && t.ty === 15)?.frame).toBe(31);
  // She starts phase 1 at the right stop (x 400), armoured, facing left: her drawn body is her box, 64 x 32 on the floor (y 192 to 224), to 0.5 px.
  expect(seen.run).toMatchObject({ x: 400, hits: 0, armoured: true, dir: -1 });
  expect(seen.drawn.body.x0).toBeCloseTo(368, 0);
  expect(seen.drawn.body.x1).toBeCloseTo(432, 0);
  expect(seen.drawn.body.y0).toBeCloseTo(192, 0);
  expect(seen.drawn.body.y1).toBeCloseTo(224, 0);
  const box = catorceBox(DEF, { ...catorceStart(DEF, 0), x: seen.run.x });
  for (const key of ['x0', 'x1', 'y0', 'y1'] as const) expect(Math.abs(seen.drawn.body[key] - box[key]), key).toBeLessThanOrEqual(0.5);
  // Her telegraph's first look one step in (age 1: floor(1 / 4) is even, so red; floor(1 / 2) % 4 = 0, her wheels' first quarter), facing left,
  // three lamps lit; her plume over her middle stud while armoured, 0.75 px left of her middle (399.25), 6 x 10 px, its foot 5 px under her
  // top (y 197), its first frame.
  expect(seen.drawn).toMatchObject({ look: 'spinRed3_0', left: true, lamps: 3, flash: 'red', plume: { x0: 396.25, x1: 402.25, y0: 187, y1: 197, frame: 0 } });
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 0 });
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(false);
  // Home's two tiles drawn whole at columns 14 and 15, row 10 (x 224 and 240).
  const home = await api(page, () => window.__PONCHO__!.homeDrawn());
  expect(home.map((h) => [h.col, h.row, h.x, h.frame, h.visible, h.phase])).toEqual(LEVEL_3_4_HOME.map((h) => [h.col, h.row, h.col * 16, 0, true, 'idle']));
  expect(errors).toEqual([]);
});

test("GDD-ART-06 3-4 the shed's wall is drawn behind the arena, the sky through its arches", async ({ page }) => {
  const errors = await arena(page);
  // Her phase fresh and one step, as the first test, so the picture holds still while it is read.
  const seen = await api(page, () => {
    const d = window.__PONCHO__!;
    d.setCatorce(0);
    d.step(1);
    return { cam: d.camera(), scenery: d.scenery() };
  });
  // One screen: the camera does not move, so a game point is the same point on the screen (GDD-UI-04).
  expect([seen.cam.viewX, seen.cam.viewY]).toEqual([0, 0]);
  expect(seen.scenery).toMatchObject({ place: 'casa' });
  // Points from the drawing (`scripts/art/sierra-casa.mjs`), measured on both viewports (L-072): the pier between the first and the middle
  // arch at (170, 60), peak base; the roof's boards at (300, 3), timber dark; the middle arch's head at (240, 80), between the gantry's
  // rods (x 227 and 252), the sky's middle band. Each is clear of the HUD (the lives at the left, the boss bar's name and pips round
  // x 215 to 265 down to y 23, the hilo counter and the phone's pause button right of x 440), of the touch buttons (all below y 180 but
  // pause), of the perches (x 0 to 64 and 416 to 480, y 96 to 112), the rails (y 112 on) and of her and Poncho (home, y 160 down).
  const points = [{ x: 170, y: 60 }, { x: 300, y: 3 }, { x: 240, y: 80 }];
  const [stone, roof, arch] = await pixelsAt(page, points);
  const STONE = ['#7F9488', '#A9B8AC', '#5B7067'];
  const TIMBER = ['#43362F', '#221D2E', '#A89480', '#75614F'];
  expect(STONE.some((c) => nearHex(stone!, c)), `stone ${JSON.stringify(stone)}`).toBe(true);
  expect(['#43362F', '#221D2E'].some((c) => nearHex(roof!, c)), `roof ${JSON.stringify(roof)}`).toBe(true);
  // Through the arch: not the wall (sky, cloud or far strip; measured: the sky's middle band, #8AA5B8).
  expect([...STONE, ...TIMBER].some((c) => nearHex(arch!, c)), `arch ${JSON.stringify(arch)}`).toBe(false);
  expect(nearHex(arch!, '#8AA5B8'), `arch ${JSON.stringify(arch)}`).toBe(true);
  expect(await clearOfButtons(page, points)).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('GDD-BOS-04 3-4 she telegraphs red, then charges left in real time', async ({ page }) => {
  const errors = await arena(page);
  // Her first 30 steps are her telegraph, then she charges: every frame of the game's own loop is read in one evaluate (L-073), her state and what
  // was drawn together (L-033), until she has charged for 20 steps (her wheels turn as she runs: 80 px/s is 1.33 px a step, a quarter turn every
  // 2 pi px, so every 4.7 steps). Her phase 1 is started afresh and the game resumed in the same evaluate, so
  // the read starts at her telegraph's first step however long the boot took (CI's slow runner had played most of it before the read).
  const frames = await page.evaluate(
    () =>
      new Promise<{ mode: string; age: number; x: number; flash: string | null; look: string; plume: number | null }[]>((resolve) => {
        const d = window.__PONCHO__!;
        d.setCatorce(0);
        d.pause(false);
        const out: { mode: string; age: number; x: number; flash: string | null; look: string; plume: number | null }[] = [];
        const tick = () => {
          const c = d.catorce()!;
          const drawn = d.catorceDrawn()!;
          out.push({ mode: c.mode, age: c.age, x: c.x, flash: drawn.flash, look: drawn.look, plume: drawn.plume?.frame ?? null });
          if ((c.mode === 'charge' && c.age >= 20) || out.length > 600) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  const telegraph = frames.filter((f) => f.mode === 'telegraph');
  expect(telegraph.length).toBeGreaterThan(3);
  // Red 4 steps on and 4 off (GDD-BOS-04): the drawn flash is red where floor(age / 4) is even, else none, on every frame read; her wheels spin a
  // quarter turn every 2 steps (floor(age / 2) % 4).
  for (const f of telegraph) {
    const red = Math.floor(f.age / 4) % 2 === 0;
    expect([f.flash, f.look], `age ${f.age}`).toEqual([red ? 'red' : null, `${red ? 'spinRed3_' : 'spin3_'}${Math.floor(f.age / 2) % 4}`]);
  }
  expect(new Set(telegraph.map((f) => f.flash))).toEqual(new Set(['red', null]));
  // Then she charges left from the right stop (x 400): her middle falls, she is not flashing, and her wheels turn.
  const charge = frames.filter((f) => f.mode === 'charge');
  expect(charge.length).toBeGreaterThan(0);
  expect(frames.at(-1)!.x).toBeLessThan(400);
  expect(charge.every((f) => f.flash === null && f.look.startsWith('run3_'))).toBe(true);
  expect(new Set(charge.map((f) => f.look)).size).toBeGreaterThanOrEqual(2);
  // Armoured through all of it: her plume shows, its frame changing every 8 steps of her telegraph and of her charge (each counts from 0).
  for (const f of frames) expect(f.plume, `${f.mode} age ${f.age} plume`).toBe(Math.floor(f.age / 8) % 2);
  expect(new Set(frames.map((f) => f.plume))).toEqual(new Set([0, 1]));
  expect(errors).toEqual([]);
});

test('GDD-BOS-04 3-4 a cart that lands on her takes a pip and flashes her white', async ({ page }) => {
  test.setTimeout(90_000);
  await arena(page);
  // Her phase 1 started afresh (as after a lost life: the page ran a few steps before it was paused), and her second slam at the left stop is
  // step 1170 on (she is unarmoured, resting there): the left cart is set rolling at m 16 (boarded, as the arena's unit test does), and it breaks
  // on her roof 55 steps later.
  await page.evaluate((n) => {
    window.__PONCHO__!.setCatorce(0);
    window.__PONCHO__!.step(n);
  }, SECOND_LEFT_SLAM);
  expect(await api(page, () => window.__PONCHO__!.catorce())).toMatchObject({ x: 80, hits: 0, mode: 'rest', age: 0, armoured: false });
  await api(page, () => window.__PONCHO__!.setCart(0, 'rolling', 16));
  const staged = await api(page, () => window.__PONCHO__!.hitStop().held);
  // Then the game's own loop runs the hit, read once a frame (L-073), her state, drawing, bar and the hold's count together (L-033).
  const frames = await page.evaluate(
    () =>
      new Promise<{ hits: number; mode: string; age: number; flash: string | null; look: string; lamps: number; plume: unknown; pips: number; outlines: number; held: number }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const out: { hits: number; mode: string; age: number; flash: string | null; look: string; lamps: number; plume: unknown; pips: number; outlines: number; held: number }[] = [];
        const tick = () => {
          const c = d.catorce()!;
          const drawn = d.catorceDrawn()!;
          out.push({ hits: c.hits, mode: c.mode, age: c.age, flash: drawn.flash, look: drawn.look, lamps: drawn.lamps, plume: drawn.plume, pips: d.bossBar().pips, outlines: d.bossBar().outlines, held: d.hitStop().held });
          // Read to the end of her hurt time, whatever the frames' pace (L-042): the first frame past it ends the read.
          if ((c.hits > 0 && c.mode !== 'hurt') || out.length > 600) {
            d.pause(true);
            resolve(out);
          } else requestAnimationFrame(tick);
        };
        d.pause(false);
        requestAnimationFrame(tick);
      }),
  );
  const first = frames.find((f) => f.hits === 1)!;
  expect(first).toBeDefined();
  // On the hit's frame: hurt, her white flash, two lamps lit, no plume, two pips filled and one outline.
  expect(first).toMatchObject({ hits: 1, mode: 'hurt', age: 0, flash: 'white', look: 'hurtWhite2', lamps: 2, plume: null, pips: 2, outlines: 1 });
  expect(frames.every((f) => f.hits <= 1)).toBe(true);
  // Through her hurt time, on every frame read: white at ages 0 to 3, plain at 4 to 7 (and so on, 4 on and 4 off), two lamps lit, no plume.
  // Only frames in her hurt time: the read ends on the first frame past its 60 steps, phase 2's telegraph (L-042). Both a white and a plain frame are seen.
  const hurt = frames.filter((g) => g.hits === 1 && g.mode === 'hurt');
  expect(new Set(hurt.map((f) => f.flash))).toEqual(new Set(['white', null]));
  for (const f of hurt) {
    expect([f.look, f.flash, f.lamps, f.plume], `age ${f.age}`).toEqual(Math.floor(f.age / 4) % 2 === 0 ? ['hurtWhite2', 'white', 2, null] : ['hurt2', null, 2, null]);
  }
  // The hit-stop holds 4 loop ticks, no more (HIT_STOP.hurtSteps, GDD-BOS-01).
  expect(frames.at(-1)!.held - staged).toBe(4);
});

test('GDD-BOS-04 3-4 her defeat clears the level 1.0 s later, 3-4 saved, Next level greyed', async ({ page }) => {
  await arena(page);
  // Phase 3 from its start: she slams at the left stop on step 197 (30 of telegraph, 167 of charge), her armour ending then. A cart set rolling
  // on step 143 breaks on her roof 55 steps later, one step after the slam.
  await api(page, () => {
    window.__PONCHO__!.setCatorce(2);
    window.__PONCHO__!.step(143);
    window.__PONCHO__!.setCart(0, 'rolling', 16);
  });
  // Her armour still holds, 54 steps before her slam: the cart lands one step after it.
  expect(await api(page, () => window.__PONCHO__!.catorce())).toMatchObject({ hits: 2, armoured: true, mode: 'charge' });
  const steps = await api(page, () => {
    const d = window.__PONCHO__!;
    let n = 0;
    while (n < 100 && d.catorce()!.hits < 3) {
      d.step(1);
      n++;
    }
    return n;
  });
  expect(steps).toBe(55);
  expect(await api(page, () => window.__PONCHO__!.catorce())).toMatchObject({ hits: 3, mode: 'defeated', age: 0 });
  // Drawn defeated on the hit's step (age 0): her white flash, no lamp lit, no plume, three outlines on the bar, read together (L-033).
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    const c = d.catorceDrawn();
    return c?.look === 'defeatedWhite' && c.lamps === 0 && c.flash === 'white' && c.plume === null && d.bossBar().pips === 0 && d.bossBar().outlines === 3;
  });
  // White for 4 steps, plain for 4, then the wreck: 8 steps on.
  const wreck = await api(page, () => {
    window.__PONCHO__!.step(8);
    return window.__PONCHO__!.catorceDrawn();
  });
  expect(wreck).toMatchObject({ look: 'wreck', lamps: 0, flash: null, plume: null });
  // 1.0 s (60 steps) after the hit: the clear screen.
  await api(page, () => window.__PONCHO__!.step(51));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  await api(page, () => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await api(page, () => window.__PONCHO__!.pause(false));
  await waitForResults(page);
  // 3-4, World 3's last level, names no next level: Next level is greyed and the menu opens on Retry.
  const clear = await api(page, () => window.__PONCHO__!.clearDrawn());
  expect(clear).toMatchObject({ shown: true, hilos: 'Hilos 0/0', medal: 'Gold medal' });
  expect(clear.menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  const saved: { levels: Record<string, unknown>; progress: { worldAt: Record<string, string> } } = JSON.parse((await page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY))!);
  expect(saved.levels['3-4']).toMatchObject({ hilos: '', medal: 'gold', cleared: true });
  // The run of World 3 starts anew at 3-1, whatever level it was in.
  expect(saved.progress.worldAt).toMatchObject({ '3': '3-1' });
});

test('GDD-BOS-04 3-4 a lost life keeps her hits and starts her phase at its right stop', async ({ page }) => {
  await arena(page);
  // Phase 2 from its start (one hit taken): she telegraphs at the right stop, x 400, then charges left. Poncho on the floor at x 300 is in her lane.
  await api(page, () => {
    window.__PONCHO__!.setCatorce(1);
    window.__PONCHO__!.teleport(300, 224);
  });
  expect(await stepUntil(page, { phase: 'respawning' }, 400)).toBeLessThan(400);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.catorce()!.hits)).toBe(1);
  expect(await stepUntil(page, { phase: 'playing' }, 100)).toBeLessThan(100);
  // Her phase 2 again at its right stop: x 400, armoured, telegraphing, every home tile whole; Poncho back on home.
  expect(await api(page, () => window.__PONCHO__!.catorce())).toMatchObject({ x: 400, hits: 1, mode: 'telegraph', age: 0, dir: -1, armoured: true, home: ['idle', 'idle'] });
  expect(await api(page, () => window.__PONCHO__!.catorce()!.x)).toBe(catorceStart(DEF, 1).x);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 240, y: 160 });
  // Drawn there (L-033): her body at x 368 to 432, her telegraph's spinning wheels, two lamps lit, two pips, her plume.
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    const c = d.catorceDrawn()!;
    return d.catorce()!.age === 0 && c.body.x0 === 368 && c.body.x1 === 432 && c.look.startsWith('spin') && c.lamps === 2 && c.plume !== null && d.bossBar().pips === 2 && d.bossBar().outlines === 1;
  });
});

test('GDD-BOS-04 3-4 no warning post is drawn', async ({ page }) => {
  const errors = await arena(page);
  // The two rails (6 tiles each) and their two broken ends are drawn; a post, which any other broken end has 6 tiles before it (at each rail's
  // start here), is not: the boss arena is exempt (GDD-WLD-15).
  expect(await api(page, () => window.__PONCHO__!.rails())).toMatchObject({ tiles: 12, brokenEnds: 2, buffers: 0, posts: 0 });
  expect(errors).toEqual([]);
});

test('GDD-BOS-04 3-4 a home tile her slam starts is drawn warning, then gone', async ({ page }) => {
  await arena(page);
  // Phase 2 (her slam shakes home): she slams at the left stop on step 205 (30 of telegraph, 175 of charge) and the tile on her side, column 14
  // (x 224), starts its 0.5 s of warning. Poncho moves onto the other tile (x 248) so that he does not fall with it.
  await api(page, () => {
    window.__PONCHO__!.setCatorce(1);
    window.__PONCHO__!.teleport(248, 160);
  });
  const read = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let before = 0;
    while (before < 400 && d.catorce()!.home[0] !== 'warning') {
      d.step(1);
      before++;
    }
    // From the slam's step on, one reading of the drawn tile after every step (`step()` draws what it stepped).
    const tiles = Array.from({ length: 40 }, () => {
      const t = d.homeDrawn()[0]!;
      const other = d.homeDrawn()[1]!;
      const row = { phase: t.phase, x: t.x, frame: t.frame, visible: t.visible, other: [other.x, other.frame, other.visible] };
      d.step(1);
      return row;
    });
    return { before, tiles, hits: d.catorce()!.hits };
  });
  expect(read.before).toBeLessThan(400);
  const warning = read.tiles.filter((t) => t.phase === 'warning');
  // It warns for 30 steps (GDD-WLD-05): drawn the whole time, shaking 1 px left and right of its column's edge (x 224) and flashing pale; then gone, not drawn.
  expect(warning).toHaveLength(30);
  expect(read.tiles.slice(0, 30).every((t) => t.phase === 'warning' && t.visible)).toBe(true);
  expect(new Set(warning.map((t) => t.x))).toEqual(new Set([223, 225]));
  expect(new Set(warning.map((t) => t.frame))).toEqual(new Set([0, 1]));
  expect(read.tiles.slice(30).every((t) => t.phase === 'gone' && !t.visible)).toBe(true);
  // The other tile stays whole at x 240 through all of it.
  expect(read.tiles.every((t) => t.other[0] === 240 && t.other[1] === 0 && t.other[2] === true)).toBe(true);
});
