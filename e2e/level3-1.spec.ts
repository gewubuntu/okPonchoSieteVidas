import { expect, test, type Page } from '@playwright/test';
import { CAMERA, TILE } from '../src/config/tuning';
import { LEVEL_3_1, LEVEL_3_1_BOTTOMS, LEVEL_3_1_GROUND, LEVEL_3_1_LEDGES, LEVEL_3_1_PITS, TIPS_3_1 } from '../src/levels/level3-1';
import { clearOfButtons, nearHex, openGame, pixelsAt, readSheet, resultsRowCentre, spotsIn, stepUntil, tapAt, waitForResults } from './helpers';

// Level 3-1 "La Barranca" (GDD-WLD-16) in the real game, opened by its address (GDD-UI-02). Where things are is read from
// `src/levels/level3-1.ts` (L-062); time is counted in steps, the game paused and stepped in the page, each loop in one round trip (L-042,
// L-073), but for the tests about real frames (L-021). Enemies are picked out by their index in `LEVEL_3_1.enemies` (L-015). Pixel samples
// are 2 px or more from a tile's edge and clear of the touch buttons (L-017, L-018).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;
/** The ground's top row in column `col` (a pit has none). */
const groundRow = (col: number): number => LEVEL_3_1_GROUND.find((s) => col >= s.col0 && col <= s.col1)!.row;

/** Opens 3-1 by its address and starts it the device's way (a tap off the menu rows on a phone, Enter on a desktop); returns the errors seen. */
async function open(page: Page, isMobile: boolean): Promise<string[]> {
  const errors = await openGame(page, '/?level=3-1');
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
  return errors;
}

/** From the paused game: Poncho put 1 px over the ground of column `col` (a teleport: the camera cuts) and stepped until he stands, at most 30 steps. */
async function standOn(page: Page, col: number, x = mid(col)): Promise<void> {
  const grounded = await page.evaluate(
    ([px, py]) => {
      const d = window.__PONCHO__!;
      d.teleport(px!, py! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      return d.state().grounded;
    },
    [x, groundRow(col) * TILE],
  );
  expect(grounded).toBe(true);
}

// GDD-TEC-03: the ground's own colours, those of the Sierra's ground sheet that its backdrop's far and mid strips do not use, read from the art.
const GROUND = readSheet('sierra/ground.png');
const coloursOf = (sheet: ReturnType<typeof readSheet>): Set<string> => {
  const out = new Set<string>();
  for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) out.add(sheet.at(x, y) ?? '');
  return out;
};
const BACKDROP = new Set([...coloursOf(readSheet('sierra/far-barranca.png')), ...coloursOf(readSheet('sierra/mid-barranca.png'))]);
const GROUND_ONLY = [...coloursOf(GROUND)].filter((c) => c !== '' && !BACKDROP.has(c));
/** Where each frame of the ground sheet has a 2 x 2 px square of the ground's own colours 2 px or more from its edges (game px from its middle). */
const spotsByFrame = new Map<number, { dx: number; dy: number }[]>();
const groundSpots = (frame: number) => {
  if (!spotsByFrame.has(frame)) spotsByFrame.set(frame, spotsIn(GROUND, 16, 16, frame, GROUND_ONLY).filter((p) => Math.abs(p.dx) <= 5 && Math.abs(p.dy) <= 5));
  return spotsByFrame.get(frame)!;
};

/**
 * Six points on screen, each on a ground tile with ground over it too (so no decor, ofrenda or walker is drawn over it), in the middle of a
 * 2 x 2 px square of the ground's own colours in the frame drawn there, 2 px or more from the tile's edges, clear of the HUD and the tip
 * (screen y 64 or more), of Poncho and of every enemy, and of the touch buttons; spread over the screen. Each with the colours it may show.
 */
async function groundPoints(page: Page): Promise<{ x: number; y: number; tile: string }[]> {
  const seen = await api(page, () => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state(), enemies: window.__PONCHO__!.enemies() }));
  const { world } = LEVEL_3_1;
  const [sx, sy] = [seen.cam.scrollX, seen.cam.viewY];
  const tiles: { tx: number; ty: number }[] = [];
  for (let ty = Math.floor(sy / TILE); ty * TILE < sy + 270; ty++) {
    for (let tx = Math.floor(sx / TILE); tx * TILE < sx + 480; tx++) {
      const [x0, y0] = [tx * TILE - sx, ty * TILE - sy];
      if (x0 < 0 || x0 + TILE > 480 || y0 < 64 || y0 + TILE > 270) continue;
      if (!world.solidTile(tx, ty) || !world.solidTile(tx, ty - 1)) continue;
      const near = (x: number, y: number, r: number) => Math.abs(tx * TILE + 8 - x) < r && Math.abs(ty * TILE + 8 - y) < r;
      if (near(seen.s.x, seen.s.y - 16, 32) || seen.enemies.some((e) => near(e.x, e.y, 40))) continue;
      tiles.push({ tx, ty });
    }
  }
  const frames = await page.evaluate((ts) => ts.map(({ tx, ty }) => window.__PONCHO__!.groundFrame(tx, ty)), tiles);
  const points: { x: number; y: number; tile: string }[] = [];
  tiles.forEach(({ tx, ty }, i) => {
    const spot = groundSpots(frames[i]!)[0];
    if (spot) points.push({ x: tx * TILE + 8 + spot.dx - sx, y: ty * TILE + 8 + spot.dy - sy, tile: `${tx},${ty}` });
  });
  const clear = await clearOfButtons(page, points);
  const free = points.filter((p) => clear.includes(p));
  // Spread: the ones at evenly spaced places in the list, which runs left to right along each row, top row first.
  return Array.from({ length: Math.min(6, free.length) }, (_, k) => free[Math.floor((k * free.length) / 6)]!);
}

/** GDD-TEC-03: the ground images shown, at most the 34 by 21 tiles of a view, and every sampled tile on screen drawn in the ground's own colours. */
async function groundDrawn(page: Page, where: string): Promise<number> {
  const { shown } = await api(page, () => window.__PONCHO__!.groundShown());
  expect(shown, where).toBeLessThanOrEqual(34 * 21);
  expect(shown, where).toBeGreaterThan(0);
  const points = await groundPoints(page);
  expect(points, where).toHaveLength(6);
  const colours = await pixelsAt(page, points);
  colours.forEach((c, i) => expect(GROUND_ONLY.some((hex) => nearHex(c, hex)), `${where}: tile ${points[i]!.tile} at ${points[i]!.x}, ${points[i]!.y} is ${JSON.stringify(c)}`).toBe(true));
  return shown;
}

test('GDD-TEC-03 in 3-1 no more than 34 by 21 ground images are shown at once, and every tile on screen is shown', async ({ page, isMobile }) => {
  test.setTimeout(60_000); // five places, each read from a screenshot
  const errors = await open(page, isMobile);
  await api(page, () => window.__PONCHO__!.pause(true));
  const counts: Record<string, number> = {};
  // Every solid tile has its image (3-1 has no slopes), and a tile far off screen still answers with its frame.
  const { world } = LEVEL_3_1;
  let solid = 0;
  for (let ty = 0; ty < world.height; ty++) for (let tx = 0; tx < world.width; tx++) if (world.solidTile(tx, ty)) solid++;
  expect(await api(page, () => window.__PONCHO__!.groundShown().total)).toBe(solid);
  expect(await page.evaluate(([tx, ty]) => window.__PONCHO__!.groundFrame(tx!, ty!), [world.width - 1, world.height - 1])).not.toBeNull();
  // At the spawn, on the rim.
  counts.spawn = await groundDrawn(page, 'spawn');
  // Gliding over the second chasm: a run from the ground 4 columns before its lip, the jump at the lip held into the glide, to its middle.
  const chasm = LEVEL_3_1_PITS[1]!;
  await standOn(page, chasm.col0 - 4);
  const glide = await page.evaluate(
    ([lip, middle]) => {
      const d = window.__PONCHO__!;
      let jumped = false;
      for (let i = 0; i < 300 && d.state().x < middle!; i++) {
        if (d.state().grounded && d.state().x + 6 >= lip! - 2) jumped = true;
        d.step(1, { move: 1, jumpHeld: jumped });
      }
      return { gliding: d.state().gliding, phase: d.phase(), x: d.state().x };
    },
    [chasm.col0 * TILE, mid(Math.floor((chasm.col0 + chasm.col1) / 2))],
  );
  expect(glide).toMatchObject({ gliding: true, phase: 'playing' });
  counts.glide = await groundDrawn(page, 'second chasm');
  // In the lower gallery, on its floor between the shaft and the pen.
  await standOn(page, 145);
  counts.gallery = await groundDrawn(page, 'lower gallery');
  // On the canyon floor before the exit.
  await standOn(page, Math.floor(LEVEL_3_1.exit!.x / TILE) - 4);
  counts.exit = await groundDrawn(page, 'exit');
  // Back at the spawn: the tiles hidden while he was away are shown again.
  await standOn(page, Math.floor(LEVEL_3_1.spawn.x / TILE));
  await groundDrawn(page, 'spawn again');
  test.info().annotations.push({ type: 'groundShown', description: JSON.stringify(counts) });
  expect(errors).toEqual([]);
});

// ---- The level in play ----

const SAVE_KEY = 'poncho-siete-vidas';
/** The progress the game saved, parsed (L-054). */
const storedProgress = async (page: Page): Promise<{ worldLives: Record<string, number>; worldAt: Record<string, string> }> =>
  JSON.parse((await api(page, () => localStorage.getItem('poncho-siete-vidas')))!).progress;
/** Opens 3-1, starts it the device's way and pauses it with Poncho standing at the spawn; returns the errors seen. */
async function play(page: Page, isMobile: boolean): Promise<string[]> {
  const errors = await open(page, isMobile);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
  });
  return errors;
}
/** Waits for two frames, so what a step changed is drawn (L-033). */
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('GDD-WLD-16 3-1 opens in the Sierra look with the glide on, on a fresh save', async ({ page, isMobile }) => {
  const errors = await openGame(page, '/?level=3-1');
  expect(await api(page, () => localStorage.getItem('poncho-siete-vidas'))).toBeNull();
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.scenery())).toEqual({ set: 'sierra', midKey: 'sierra:mid', place: 'barranca' });
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  // A jump from the spawn held for up to 60 steps opens the glide at its top (GDD-MOV-07), though nothing in the save unlocks it (GDD-PRG-01).
  const glided = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
    for (let i = 1; i <= 60; i++) {
      d.step(1, { move: 0, jumpHeld: true });
      if (d.state().gliding) return i;
    }
    return 0;
  });
  expect(glided).toBeGreaterThan(0);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.glideDrawn())).toBe(true);
  expect(errors).toEqual([]);
});

// GDD-UI-05: the tip of 3-1, over columns 0 to 23 (TIPS_3_1), its highlight the four hilos of the flat's arc, 2 px outside their tiles.
const TIP = TIPS_3_1[0]!;
const HIGHLIGHT = { x: TIP.highlight!.col * TILE - 2, y: TIP.highlight!.row * TILE - 2, w: TIP.highlight!.w * TILE + 4, h: TIP.highlight!.h * TILE + 4 };
/** The tip's box with two lines of 8 px text: 4 px of room above and below and two lines of 10 px (a one-line box is 18 px tall). */
const TWO_LINES = 28;

test('GDD-UI-05 3-1 shows the glide tip over its first 24 columns, in the words of the device used last, and not past them', async ({ page, isMobile }) => {
  await play(page, isMobile);
  await page.evaluate(() => window.__PONCHO__!.step(13));
  await frames(page);
  const shown = await api(page, () => window.__PONCHO__!.tip());
  expect(shown).toMatchObject({ index: 0, alpha: 1, highlight: HIGHLIGHT, button: 'jump' });
  expect(shown.box.h).toBeLessThanOrEqual(TWO_LINES);
  if (isMobile) {
    expect(shown).toMatchObject({ text: TIP.text.en.touch, device: 'touch' });
    expect((await api(page, () => window.__PONCHO__!.touch())).highlighted).toBe('jump');
  } else {
    expect(shown).toMatchObject({ text: TIP.text.en.keyboard, device: 'keyboard' });
    expect((await api(page, () => window.__PONCHO__!.touch())).highlighted).toBeNull();
  }
  // Past column 23 it fades out; back on the trench's floor it is there again.
  await standOn(page, TIP.to + 1);
  await page.evaluate(() => window.__PONCHO__!.step(13));
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.tip())).toMatchObject({ index: null, alpha: 0 });
  await standOn(page, TIP.to - 2);
  await page.evaluate(() => window.__PONCHO__!.step(13));
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.tip())).toMatchObject({ index: 0, alpha: 1 });
  // Every text of the tip fits the box's two lines (GDD-UI-05).
  for (const lang of ['en', 'es', 'de'] as const) {
    for (const device of ['keyboard', 'touch', 'pad'] as const) {
      const text = TIP.text[lang][device];
      const lines = await page.evaluate((t) => window.__PONCHO__!.wrapTip(t), text);
      expect(lines.join(' ').replace(/\s+/g, ' ').trim(), `${lang} ${device}`).toBe(text);
      expect(lines.length, `${lang} ${device}: ${text}`).toBeLessThanOrEqual(2);
    }
  }
});

test('GDD-UI-05 3-1 the glide tip in Spanish and German', async ({ page, isMobile }) => {
  const device = isMobile ? 'touch' : 'keyboard';
  for (const lang of ['es', 'de'] as const) {
    await page.addInitScript(([key, text]) => localStorage.setItem(key!, text!), [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: lang }, progress: { tutorialPlayed: true } })]);
    await play(page, isMobile);
    await page.evaluate(() => window.__PONCHO__!.step(13));
    await frames(page);
    const shown = await api(page, () => window.__PONCHO__!.tip());
    expect(shown, lang).toMatchObject({ index: 0, alpha: 1, text: TIP.text[lang][device], device });
    expect(shown.box.h, lang).toBeLessThanOrEqual(TWO_LINES);
  }
});

test('GDD-UI-05 3-1 a gamepad button switches the glide tip to the pad', async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    const pad = { id: 'fake', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    window.__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  });
  await play(page, isMobile);
  await page.evaluate(() => window.__PONCHO__!.step(13));
  await page.waitForFunction((t) => window.__PONCHO__!.tip().text === t, TIP.text.en[isMobile ? 'touch' : 'keyboard']);
  await page.evaluate(() => {
    window.__pad!.buttons[4]!.pressed = true; // a shoulder button: any button counts
  });
  await page.waitForFunction((t) => window.__PONCHO__!.tip().device === 'pad' && window.__PONCHO__!.tip().text === t, TIP.text.en.pad);
  expect((await api(page, () => window.__PONCHO__!.tip())).box.h).toBeLessThanOrEqual(TWO_LINES);
  // The touch outline is drawn only while touch is the device used last.
  await page.waitForFunction(() => window.__PONCHO__!.touch().highlighted === null);
});

// GDD-UI-04: the camera. The first chasm (LEVEL_3_1_PITS[0]) has a raised bottom (LEVEL_3_1_BOTTOMS[0]), its floor line 4 rows under its
// lower lip: the camera's lowest y over it is that line less 2 px less the screen's 270.
const CHASM = LEVEL_3_1_PITS[0]!;
const CHASM_LIMIT = (LEVEL_3_1_BOTTOMS[0]!.row + 1) * TILE - CAMERA.bottomCutPx - 270;
/** The level's lowest camera y: its bottom (816 px) less 2 px less 270. */
const BOTTOM_LIMIT = LEVEL_3_1.world.height * TILE - CAMERA.bottomCutPx - 270;

test('GDD-UI-04 3-1 the camera starts 8 px below the level\'s top with his feet at screen y 136, and follows him down the long glide', async ({ page, isMobile }) => {
  await play(page, isMobile);
  const startAt = await api(page, () => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state() }));
  expect(startAt.s).toMatchObject({ x: LEVEL_3_1.spawn.x, y: LEVEL_3_1.spawn.y, grounded: true });
  expect(startAt.cam.scrollY).toBe(8);
  expect(startAt.s.y - startAt.cam.scrollY).toBe(CAMERA.spawnFeet);
  // The long glide: from the stone (the ground of column 38), a run to its right edge and the jump there held to the landing.
  const stone = 38;
  await standOn(page, stone);
  const glide = await page.evaluate(
    (lip) => {
      const d = window.__PONCHO__!;
      const out: { y: number; feet: number; grounded: boolean }[] = [];
      let jumped = false;
      let air = false;
      for (let i = 0; i < 400 && !(air && d.state().grounded); i++) {
        if (!jumped && d.state().grounded && d.state().x + 6 >= lip - 2) jumped = true;
        d.step(1, { move: 1, jumpHeld: jumped });
        air ||= !d.state().grounded;
        out.push({ y: d.camera().scrollY, feet: d.state().y, grounded: d.state().grounded });
      }
      return { out, x: d.state().x, lives: d.lives() };
    },
    (stone + 2) * TILE,
  );
  const { out } = glide;
  expect(out.at(-1)!.grounded).toBe(true);
  expect(out.at(-1)!.feet).toBe(groundRow(Math.floor(glide.x / TILE)) * TILE);
  expect(Math.floor(glide.x / TILE)).toBeGreaterThan(stone + 10);
  // Down with him: it never goes up, it ends lower than it started, and he lands with his feet in the band.
  for (let i = 1; i < out.length; i++) expect(out[i]!.y, `step ${i}`).toBeGreaterThanOrEqual(out[i - 1]!.y);
  expect(out.at(-1)!.y).toBeGreaterThan(out[0]!.y);
  expect(out.at(-1)!.feet - out.at(-1)!.y).toBeGreaterThanOrEqual(CAMERA.bandTop - 0.125);
  expect(out.at(-1)!.feet - out.at(-1)!.y).toBeLessThanOrEqual(CAMERA.bandBottom + 0.125);
  expect(glide.lives).toBe(7);
});

test('GDD-UI-04 3-1 over a pit with a raised bottom the camera\'s bottom edge stops 2 px above its floor line', async ({ page, isMobile }) => {
  expect(CHASM_LIMIT).toBe(48);
  await play(page, isMobile);
  // Walking off the first chasm's lip with jump up, from the ground 4 columns before it: the camera after each step, until the life is lost.
  await standOn(page, CHASM.col0 - 4);
  const run = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const ys: number[] = [d.camera().scrollY];
    for (let i = 0; i < 400 && d.phase() === 'playing'; i++) {
      d.step(1, { move: 1, jumpHeld: false });
      ys.push(d.camera().scrollY);
    }
    return { ys, phase: d.phase(), x: d.state().x };
  });
  expect(run.phase).toBe('respawning');
  expect(Math.floor(run.x / TILE)).toBeGreaterThanOrEqual(CHASM.col0);
  // On the bank it stood lower than the pit's limit; over the pit it rose to it at the pan (3 px a step at most) and stayed there.
  expect(run.ys[0]).toBeGreaterThan(CHASM_LIMIT);
  expect(run.ys.at(-1)).toBe(CHASM_LIMIT);
  expect(Math.max(...run.ys.slice(run.ys.indexOf(CHASM_LIMIT)))).toBe(CHASM_LIMIT);
  for (let i = 1; i < run.ys.length; i++) expect(Math.abs(run.ys[i]! - run.ys[i - 1]!), `step ${i}`).toBeLessThanOrEqual(3);
});

/**
 * From the paused game: Poncho on the last lip (the last column of the Ketsu ledge, where the third ofrenda stands), walks off it with jump up onto the pillar under it, which
 * holds the veladora, and stands there. Returns where he landed.
 */
async function dropToPillar(page: Page): Promise<{ x: number; y: number }> {
  const ofrenda = Math.floor(LEVEL_3_1.ofrendas[2]!.x / TILE);
  const lip = LEVEL_3_1_GROUND.find((g) => g.col0 <= ofrenda && g.col1 >= ofrenda)!.col1;
  await standOn(page, lip);
  return page.evaluate(() => {
    const d = window.__PONCHO__!;
    let air = false;
    for (let i = 0; i < 200 && !(air && d.state().grounded); i++) {
      d.step(1, { move: i < 20 ? 1 : 0, jumpHeld: false });
      air ||= !d.state().grounded;
    }
    return { x: d.state().x, y: d.state().y };
  });
}

/** From the pillar, a run to its right end and a jump there held to the landing on the canyon floor. */
const glideToFloor = (page: Page) =>
  page.evaluate((end) => {
    const d = window.__PONCHO__!;
    let jumped = false;
    let air = false;
    for (let i = 0; i < 400 && !(air && d.state().grounded); i++) {
      if (!jumped && d.state().grounded && d.state().x + 6 >= end - 2) jumped = true;
      d.step(1, { move: 1, jumpHeld: jumped });
      air ||= !d.state().grounded;
    }
    return { x: d.state().x, y: d.state().y, lives: d.lives(), phase: d.phase() };
  }, (LEVEL_3_1_GROUND.find((g) => g.col0 === LEVEL_3_1.veladora!.col - 2)!.col1 + 1) * TILE);

test('GDD-UI-04 3-1 at the canyon floor the camera is at the level\'s bottom and the exit is on screen', async ({ page, isMobile }) => {
  expect(BOTTOM_LIMIT).toBe(544);
  await play(page, isMobile);
  await dropToPillar(page);
  const landed = await glideToFloor(page);
  expect(landed).toMatchObject({ y: LEVEL_3_1.exit!.y, phase: 'playing' });
  await frames(page);
  const seen = await api(page, () => ({ cam: window.__PONCHO__!.camera(), exit: window.__PONCHO__!.exitDrawn() }));
  expect(seen.cam.scrollY).toBe(BOTTOM_LIMIT);
  expect(seen.exit).toBe(true);
  // The exit's box (16 x 48 px over its foot) wholly on the screen.
  const [ex, ey] = [LEVEL_3_1.exit!.x - seen.cam.scrollX, LEVEL_3_1.exit!.y - seen.cam.scrollY];
  expect(ex - TILE / 2).toBeGreaterThanOrEqual(0);
  expect(ex + TILE / 2).toBeLessThanOrEqual(480);
  expect(ey - 3 * TILE).toBeGreaterThanOrEqual(0);
  expect(ey).toBeLessThanOrEqual(270);
});

test('GDD-LIFE-02 3-1 falling into the first chasm costs the life as he passes its raised bottom, and he respawns at the first ofrenda', async ({ page, isMobile }) => {
  await play(page, isMobile);
  // From the ground 4 columns before the first ofrenda, a walk over it (the checkpoint) and off the chasm's lip with jump up.
  const ofrenda = LEVEL_3_1.ofrendas[0]!;
  await standOn(page, Math.floor(ofrenda.x / TILE) - 4);
  const fall = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let left = -1;
    let i = 0;
    for (; i < 400 && d.phase() === 'playing'; i++) {
      d.step(1, { move: 1, jumpHeld: false });
      if (left < 0 && !d.state().grounded) left = i;
    }
    return { steps: i - left, phase: d.phase(), lives: d.lives(), feet: d.state().y, checkpoint: d.checkpoint() };
  });
  expect(fall.checkpoint).toEqual({ x: ofrenda.x, y: ofrenda.y });
  expect(fall).toMatchObject({ phase: 'respawning', lives: 6 });
  // Lost the step his body box is wholly below the raised bottom's floor line (4 rows under the lip at row 15), 31 steps after he left
  // the lip (measured); the level's last row is 30 rows further down, where the fall would take far longer.
  expect(fall.steps).toBe(31);
  expect(fall.feet - 32).toBeGreaterThan((LEVEL_3_1_BOTTOMS[0]!.row + 1) * TILE);
  expect(fall.feet).toBeLessThan(LEVEL_3_1.world.height * TILE);
  expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: ofrenda.x, y: ofrenda.y });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
});

// GDD-ENM-04: the first Murciélago, alone over flat ground: the first bat in the level's enemies (L-015).
const FIRST_BAT = LEVEL_3_1.enemies.findIndex((e) => e.kind === 'murcielago');

test('GDD-ENM-04 3-1 the first bat bobs on its loop while he stands still, flapping', async ({ page, isMobile }) => {
  await open(page, isMobile);
  expect(FIRST_BAT).toBe(1);
  // Unpaused, through the game's own frames (L-021): where it is drawn and the frame it shows, on 40 frames, every enemy alive so the drawn
  // list is in the level's order.
  const seen = await page.evaluate(
    (i) =>
      new Promise<{ y: number; look: string; kind: string; alive: number }[]>((resolve) => {
        const out: { y: number; look: string; kind: string; alive: number }[] = [];
        const tick = () => {
          const d = window.__PONCHO__!;
          const drawn = d.enemiesDrawn()[i]!;
          out.push({ y: drawn.y, look: drawn.look, kind: drawn.kind, alive: d.enemies().filter((e) => e.alive).length });
          if (out.length >= 40) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    FIRST_BAT,
  );
  const bat = LEVEL_3_1.enemies[FIRST_BAT]!;
  expect(new Set(seen.map((s) => s.kind))).toEqual(new Set(['murcielago']));
  expect(new Set(seen.map((s) => s.alive))).toEqual(new Set([LEVEL_3_1.enemies.length]));
  expect(new Set(seen.map((s) => s.y)).size).toBeGreaterThan(1);
  expect(new Set(seen.map((s) => s.look)).size).toBeGreaterThan(1);
  for (const s of seen) expect(Math.abs(s.y - bat.y)).toBeLessThanOrEqual(bat.ry!);
  expect(await api(page, () => window.__PONCHO__!.state().x)).toBe(LEVEL_3_1.spawn.x);
});

test('GDD-ENM-04 3-1 a stomp on the first bat bounces him, squashes it and it stays gone', async ({ page, isMobile }) => {
  await play(page, isMobile);
  // Dropped from 40 px over its middle: the steps until the stomp, his speed after it.
  const stomp = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    const b = d.enemies()[i]!;
    d.teleport(b.x, b.y - 40);
    for (let k = 0; k < 60 && d.enemies()[i]!.alive; k++) d.step(1);
    return { alive: d.enemies()[i]!.alive, vy: d.state().vy, lives: d.lives() };
  }, FIRST_BAT);
  expect(stomp).toMatchObject({ alive: false, lives: 7 });
  expect(stomp.vy).toBeLessThan(0);
  await page.waitForFunction(() => window.__PONCHO__!.defeatsDrawn().some((f) => f.kind === 'murcielago' && f.look === 'squash'));
  // A whole loop and more later (240 steps), it is still gone and not drawn: five bats left.
  await page.evaluate(() => window.__PONCHO__!.step(300));
  expect(await page.evaluate((i) => window.__PONCHO__!.enemies()[i]!.alive, FIRST_BAT)).toBe(false);
  await frames(page);
  expect((await api(page, () => window.__PONCHO__!.enemiesDrawn())).filter((e) => e.kind === 'murcielago')).toHaveLength(LEVEL_3_1.enemies.filter((e) => e.kind === 'murcielago').length - 1);
  // Until a life is lost (a fall into the first chasm): that brings every bat back (GDD-ENM-04).
  await page.evaluate((x) => window.__PONCHO__!.teleport(x, 150), mid(Math.floor((CHASM.col0 + CHASM.col1) / 2)));
  expect(await stepUntil(page, { phase: 'respawning' }, 200)).toBeLessThan(200);
  expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await page.evaluate((i) => window.__PONCHO__!.enemies()[i]!.alive, FIRST_BAT)).toBe(true);
});

test('GDD-ENM-04 3-1 walking into the first bat costs a life and it is back after the respawn', async ({ page, isMobile }) => {
  await play(page, isMobile);
  const bat = LEVEL_3_1.enemies[FIRST_BAT]!;
  // On the flat ground 3 columns before it, waiting until it comes down the low half of its loop, then walking right into it.
  await standOn(page, Math.floor(bat.x / TILE) - 3);
  const hit = await page.evaluate(
    ([i, low]) => {
      const d = window.__PONCHO__!;
      let y = d.enemies()[i!]!.y;
      for (let k = 0; k < 300; k++) {
        d.step(1);
        const now = d.enemies()[i!]!.y;
        if (now > y && now >= low!) break;
        y = now;
      }
      for (let k = 0; k < 60 && d.phase() === 'playing'; k++) d.step(1, { move: 1, jumpHeld: false });
      return { phase: d.phase(), lives: d.lives(), alive: d.enemies()[i!]!.alive };
    },
    [FIRST_BAT, bat.y + 12],
  );
  expect(hit).toMatchObject({ phase: 'respawning', lives: 6, alive: true });
  expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  // Back at the spawn (no ofrenda touched), the bat alive and drawn on its loop.
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: LEVEL_3_1.spawn.x, y: LEVEL_3_1.spawn.y });
  await frames(page);
  const after = await page.evaluate((i) => ({ bat: window.__PONCHO__!.enemies()[i]!, drawn: window.__PONCHO__!.enemiesDrawn()[i]! }), FIRST_BAT);
  expect(after.bat.alive).toBe(true);
  expect(after.drawn.kind).toBe('murcielago');
  expect(Math.abs(after.drawn.y - bat.y)).toBeLessThanOrEqual(bat.ry!);
});

// GDD-WLD-05: L1, the first ledge down the cliff face (LEVEL_3_1_LEDGES[0]), and its middle tile, the one he lands on.
const L1 = LEVEL_3_1_LEDGES[0]!;
const L1_MIDDLE = LEVEL_3_1.crumbles.findIndex((c) => c.col === L1.col0 + 1 && c.row === L1.row);

test('GDD-WLD-05 3-1 a ledge he stood on shakes, goes, and is drawn again 2 s later', async ({ page, isMobile }) => {
  await play(page, isMobile);
  const seen = await page.evaluate(
    ([i, x, y]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      const out: { phase: string; x: number; frame: number; visible: boolean; look: string }[] = [];
      for (let k = 0; k < 220; k++) {
        d.step(1);
        const c = d.crumbles()[i!]!;
        out.push({ phase: c.phase, x: c.x, frame: c.frame, visible: c.visible, look: c.look });
      }
      return { out, s: d.state(), lives: d.lives() };
    },
    [L1_MIDDLE, mid(L1.col0 + 1), L1.row * TILE],
  );
  const { out } = seen;
  const rest = (L1.col0 + 1) * TILE;
  const warning = out.filter((c) => c.phase === 'warning');
  const gone = out.findIndex((c) => c.phase === 'gone');
  const back = out.findIndex((c, k) => k > gone && c.phase === 'idle');
  // Drawn as the rock ledge throughout; shaking 1 px either way in its 0.5 s warning; not drawn while gone; whole again 2.0 s (120 steps)
  // after it went, at its place and at rest.
  expect(new Set(out.map((c) => c.look))).toEqual(new Set(['ledge']));
  expect(warning.length).toBe(30);
  expect(new Set(warning.map((c) => c.x - rest))).toEqual(new Set([-1, 1]));
  expect(warning.every((c) => c.visible)).toBe(true);
  expect(out.slice(gone, back).every((c) => c.phase === 'gone' && !c.visible)).toBe(true);
  expect(back - gone).toBe(120);
  expect(out[back]).toMatchObject({ phase: 'idle', visible: true, x: rest, frame: 0 });
  // He fell through onto the floor F1 under the ledges and lost nothing.
  expect(seen.s.grounded).toBe(true);
  expect(seen.s.y).toBeGreaterThan(L1.row * TILE);
  expect(seen.lives).toBe(7);
});

test('GDD-WLD-05 3-1 a ledge he stood on goes and is drawn again, through the game\'s own frames', async ({ page, isMobile }) => {
  await open(page, isMobile);
  // Unpaused (L-021): each frame the steps run so far and the ledge as drawn, from the teleport onto it until it is back.
  const seen = await page.evaluate(
    ([i, x, y]) =>
      new Promise<{ ticks: number; phase: string; visible: boolean }[]>((resolve) => {
        const d = window.__PONCHO__!;
        d.teleport(x!, y! - 1);
        const out: { ticks: number; phase: string; visible: boolean }[] = [];
        let went = false;
        const tick = () => {
          const c = d.crumbles()[i!]!;
          out.push({ ticks: d.ticks(), phase: c.phase, visible: c.visible });
          went ||= c.phase === 'gone';
          if ((went && c.phase === 'idle') || out.length > 3000) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [L1_MIDDLE, mid(L1.col0 + 1), L1.row * TILE],
  );
  const gone = seen.findIndex((c) => c.phase === 'gone');
  expect(gone).toBeGreaterThan(0);
  expect(seen.slice(0, gone).some((c) => c.phase === 'warning' && c.visible)).toBe(true);
  expect(seen.at(-1)).toMatchObject({ phase: 'idle', visible: true });
  expect(seen.slice(gone, -1).every((c) => !c.visible)).toBe(true);
  // A frame runs up to 5 steps: the steps between the first frames drawn gone and back are 120, give or take that.
  expect(Math.abs(seen.at(-1)!.ticks - seen[gone]!.ticks - 120)).toBeLessThanOrEqual(5);
});

test('GDD-WLD-04 3-1 the hilos of the flat\'s arc are collected in a glided jump, and the counter shows them of 50', async ({ page, isMobile }) => {
  await play(page, isMobile);
  // From the spawn, a run right and a jump taken at x 92 held to its landing on the rim: it takes the four (any take-off from x 74 to 110
  // does, measured).
  const taken = await page.evaluate((at) => {
    const d = window.__PONCHO__!;
    let jumped = false;
    let air = false;
    let glided = false;
    for (let i = 0; i < 300 && !(air && d.state().grounded); i++) {
      if (!jumped && d.state().x >= at) jumped = true;
      d.step(1, { move: 1, jumpHeld: jumped });
      air ||= !d.state().grounded;
      glided ||= d.state().gliding === true;
    }
    return { taken: d.hilos().taken, glided };
  }, 92);
  expect(taken).toEqual({ taken: 4, glided: true });
  await frames(page);
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('4/50');
  expect(LEVEL_3_1.hilos!.length).toBe(50);
});

test('GDD-PWR-05 3-1 the first piñata gives a taco', async ({ page, isMobile }) => {
  await play(page, isMobile);
  const pinata = LEVEL_3_1.pinatas[0]!;
  await standOn(page, pinata.col);
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
  // A jump into it from below (held for 12 steps), then he waits where he landed until the taco has come back to him.
  const got = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 12; i++) d.step(1, { move: 0, jumpHeld: true });
    for (let i = 0; i < 600 && d.power() !== 'taco'; i++) d.step(1);
    return { power: d.power(), lives: d.lives() };
  });
  expect(got).toEqual({ power: 'taco', lives: 7 });
  await frames(page);
  expect((await api(page, () => window.__PONCHO__!.pinatasDrawn()))[0]).toBe(true);
});

test('GDD-LIFE-03 3-1 the veladora on the pillar is taken by dropping from the last lip', async ({ page, isMobile }) => {
  await play(page, isMobile);
  await api(page, () => window.__PONCHO__!.loseLife());
  expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  const landed = await dropToPillar(page);
  // On the pillar (its top 4 rows under the lip), over the veladora's column: it gives back the life.
  const pillar = LEVEL_3_1_GROUND.find((g) => g.col0 <= LEVEL_3_1.veladora!.col && g.col1 >= LEVEL_3_1.veladora!.col)!;
  expect(landed.y).toBe(pillar.row * TILE);
  expect(Math.floor(landed.x / TILE)).toBeGreaterThanOrEqual(pillar.col0);
  expect(Math.floor(landed.x / TILE)).toBeLessThanOrEqual(pillar.col1);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(false);
});

test('GDD-WLD-16 3-1 the exit clears the level; its results menu greys Next level, as the last level built', async ({ page, isMobile }) => {
  await play(page, isMobile);
  await dropToPillar(page);
  expect(await glideToFloor(page)).toMatchObject({ phase: 'playing' });
  // Right to the exit's arch.
  expect(await stepUntil(page, { phase: 'clear' }, 200, { move: 1, jumpHeld: false })).toBeLessThan(200);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  // World 3's run ends there: a new one at 3-1.
  expect(await storedProgress(page)).toMatchObject({ worldAt: { '3': '3-1' } });
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
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-1');
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
});

// GDD-WLD-17: the rock back wall's ochre shade, and the colours of the canyon's backdrop (its sky, peaks, pines and mist) and of the
// mine's gallery, which a pixel behind the galleries must not be.
const BACK_WALL = '#9A6A2C';
const BACKDROP_COLOURS = ['#527391', '#8AA5B8', '#BFCDD2', '#EEF1EA', '#A9B8AC', '#7F9488', '#5B7067', '#24403A', '#3F6350', '#221D2E', '#3D3650', '#5C5269'];

test('GDD-WLD-16 3-1 the galleries have a rock back wall behind them and the cliff face above F1 has none', async ({ page, isMobile }) => {
  await open(page, isMobile);
  await api(page, () => window.__PONCHO__!.pause(true));
  // At the spawn, far from the galleries, none of its images is shown (GDD-TEC-03); it is drawn between the backdrop (the mid band at -0.5)
  // and the level (0 and up).
  const atSpawn = await api(page, () => window.__PONCHO__!.backWall());
  expect(atSpawn.shown).toBe(0);
  expect(atSpawn.total).toBe(279);
  expect(atSpawn.depth!).toBeGreaterThan(-0.5);
  expect(atSpawn.depth!).toBeLessThan(0);
  // Standing in the middle gallery on F2 (row 31) at column 142, under F1: the tile 2 over his head (row 27) is the back wall's, read in
  // its lower right corner, plain ochre shade in both versions (`scripts/art/sierra-mina.test.mjs`).
  /** Puts Poncho down on the ground at (x, y), lets him stand and draws a frame; returns his state and the back wall as drawn, and the camera. */
  const standAt = async (x: number, y: number) => {
    const seen = await page.evaluate(
      ([px, py]) => {
        const d = window.__PONCHO__!;
        d.teleport(px!, py! - 1);
        for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
        d.step(10);
        return { s: d.state(), wall: d.backWall(), wallAt: d.backWallFrame(142, 27), overL1: d.backWallFrame(140, 18) };
      },
      [x, y],
    );
    // Drawn: the camera where the frame put it.
    await frames(page);
    return { ...seen, cam: await api(page, () => window.__PONCHO__!.camera()) };
  };
  /** Screen px of level point (x, y) under the camera `cam`, checked on screen and clear of the touch buttons. */
  const onScreen = async (cam: { viewX: number; scrollY: number }, x: number, y: number) => {
    const p = { x: x - cam.viewX, y: y - cam.scrollY };
    expect(p.y > 2 && p.y < 268 && p.x > 2 && p.x < 478, `${p.x},${p.y} on screen`).toBe(true);
    expect(await clearOfButtons(page, [p])).toHaveLength(1);
    return p;
  };
  const f2 = 31;
  const inGallery = await standAt(mid(142), f2 * TILE);
  expect(inGallery.s).toMatchObject({ grounded: true, y: f2 * TILE });
  expect(inGallery.wallAt).not.toBeNull();
  expect(inGallery.overL1).toBeNull();
  // Only the images in the view are shown, fewer than the view's tiles (the screen widened by 2 tiles on every side).
  const { cam } = inGallery;
  const viewTiles = (Math.ceil((cam.viewX + 480) / TILE) - Math.floor(cam.viewX / TILE) + 4) * (Math.ceil((cam.scrollY + 270) / TILE) - Math.floor(cam.scrollY / TILE) + 4);
  expect(inGallery.wall.shown).toBeGreaterThan(0);
  expect(inGallery.wall.shown).toBeLessThan(viewTiles);
  const [wall] = await pixelsAt(page, [await onScreen(cam, 142 * TILE + 15, 27 * TILE + 15)]);
  expect(nearHex(wall!, BACK_WALL, 12), `back wall ${JSON.stringify(wall)}`).toBe(true);
  expect(BACKDROP_COLOURS.some((c) => nearHex(wall!, c, 12))).toBe(false);
  // Standing on F1 (row 25) at column 154, the air over L1 (column 140, row 18, its middle), on the open cliff face, is the backdrop.
  const onF1 = await standAt(mid(154), 25 * TILE);
  expect(onF1.s).toMatchObject({ grounded: true, y: 25 * TILE });
  const [air] = await pixelsAt(page, [await onScreen(onF1.cam, mid(140), 18 * TILE + TILE / 2)]);
  expect(BACKDROP_COLOURS.some((c) => nearHex(air!, c, 12)), `air over L1 ${JSON.stringify(air)}`).toBe(true);
  expect(nearHex(air!, BACK_WALL, 12)).toBe(false);
});
