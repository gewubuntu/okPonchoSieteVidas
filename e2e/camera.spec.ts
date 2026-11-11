import { expect, test, type Page } from '@playwright/test';
import { CAMERA, TILE } from '../src/config/tuning';
import { LEVEL_1_1 } from '../src/levels/level1-1';
import { LEVEL_2_4 } from '../src/levels/level2-4';
import { LAB_3T_DROP, LAB_3T_HIGH_BOTTOM, LAB_3T_HIGH_PIT, LAB_3T_LOWEST, LAB_3T_OFRENDAS, LAB_3T_TOP } from '../src/levels/lab3t';
import { gaps } from '../src/levels/validate';
import { LOOKS } from '../src/ui/scenery/looks';
import { boot, pixelsAt, red } from './helpers';

// GDD-UI-04: the camera follows up and down in lab-3t (`?level=lab-3t`, 40 rows: its y goes from 0 to 368), and never in a one-screen level.
// Where things are comes from `src/levels/lab3t.ts` (L-062). Time is counted in steps (L-042): paused and stepped in the page, or read per
// frame with the step counter beside it.
const LIP_Y = LAB_3T_DROP.lipRow * TILE;
const LANDING_Y = LAB_3T_DROP.row * TILE;
/** The drawn camera rounds to whole art pixels (a quarter px), so a screen y read against it is within an eighth of a px of the rule's. */
const ROUND = 1 / 8;
/** A y at whole art pixels (a quarter px), as the camera is drawn. */
const art = (y: number) => Math.round(y * 4) / 4;

/** Boots lab-3t, pauses it, puts Poncho down at (x, y) (a teleport: a cut) and lets him land. Returns the console errors. */
async function openAt(page: Page, x: number, y: number): Promise<string[]> {
  const errors = await boot(page, '/?level=lab-3t');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(
    ([px, py]) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.teleport(px!, py! - 1);
      d.step(20);
    },
    [x, y],
  );
  expect(await page.evaluate(() => window.__PONCHO__!.state().grounded)).toBe(true);
  return errors;
}

/** The staircase's last step, short of the lip, where the camera is at the level's top. */
const lastStep = { x: LAB_3T_DROP.lipCol * TILE + 4, y: LIP_Y };

test('GDD-UI-04 in lab-3t the camera follows a drop and shows the landing', async ({ page }) => {
  const errors = await openAt(page, lastStep.x, lastStep.y);
  expect(await page.evaluate(() => window.__PONCHO__!.camera().scrollY)).toBe(0);
  // Through the game's own frames (L-021): Right held off the lip; each frame the step count, the camera and his feet, read together (L-033).
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  const seen = await page.evaluate(
    () =>
      new Promise<{ ticks: number; scrollY: number; viewY: number; feet: number; grounded: boolean }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const out: { ticks: number; scrollY: number; viewY: number; feet: number; grounded: boolean }[] = [];
        let airborne = false;
        const tick = () => {
          const s = d.state();
          out.push({ ticks: d.ticks(), scrollY: d.camera().scrollY, viewY: d.camera().viewY, feet: s.y, grounded: s.grounded });
          if (!s.grounded) airborne = true;
          // Paused on the frame he lands, before the held key walks him on off the landing ground.
          if (airborne && s.grounded) d.pause(true);
          if ((airborne && s.grounded) || out.length > 2000) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.keyboard.up('ArrowRight');
  const left = seen.findIndex((s) => !s.grounded);
  const landed = seen.length - 1;
  expect(left).toBeGreaterThan(0);
  expect(landed).toBeGreaterThan(left);
  expect(seen[landed]!.grounded).toBe(true);
  expect(seen[landed]!.feet).toBe(LANDING_Y);
  // It looks down: it only grows, at most 8 px a step (drawn between steps, so up to one step more between two frames), and the landing
  // ground is on the screen (its top above 270) on every frame of the fall.
  expect(seen[landed]!.scrollY).toBeGreaterThan(0);
  for (let i = 1; i < seen.length; i++) {
    const [a, b] = [seen[i - 1]!, seen[i]!];
    expect(b.scrollY, `frame ${i}`).toBeGreaterThanOrEqual(a.scrollY);
    expect(b.scrollY - a.scrollY, `frame ${i}`).toBeLessThanOrEqual((CAMERA.maxSpeed / 60) * (b.ticks - a.ticks + 1) + 2 * ROUND);
    expect(b.viewY, `frame ${i}`).toBe(b.scrollY);
  }
  for (const s of seen.slice(left, landed + 1)) expect(LANDING_Y - s.scrollY).toBeLessThan(270);
  // Landed, his feet are in the band.
  const end = seen[landed]!;
  expect(end.feet - end.scrollY).toBeGreaterThanOrEqual(CAMERA.bandTop - ROUND);
  expect(end.feet - end.scrollY).toBeLessThanOrEqual(CAMERA.bandBottom + ROUND);
  expect(errors).toEqual([]);
});

test('GDD-UI-04 a jump does not move the camera', async ({ page }) => {
  // On the drop's landing ground the cut puts his feet at 136, clear of both limits.
  await openAt(page, (LAB_3T_DROP.col0 + 2) * TILE + TILE / 2, LANDING_Y);
  const before = await page.evaluate(() => window.__PONCHO__!.camera().scrollY);
  // The teleport put him 1 px over the ground: the cut put his feet there at 136, and landing 1 px lower left them in the band.
  expect(before).toBe(LANDING_Y - 1 - CAMERA.spawnFeet);
  // A full jump, held to its landing (at most 120 steps), the camera read after each step.
  const ys = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const out: { y: number; grounded: boolean }[] = [];
    for (let i = 0; i < 120 && (i < 2 || !d.state().grounded); i++) {
      d.step(1, { move: 0, jumpHeld: true });
      out.push({ y: d.camera().scrollY, grounded: d.state().grounded });
    }
    return out;
  });
  expect(ys.some((s) => !s.grounded)).toBe(true);
  expect(ys.at(-1)!.grounded).toBe(true);
  expect(new Set(ys.map((s) => s.y))).toEqual(new Set([before]));
});

test('GDD-UI-04 the HUD and the touch buttons do not move when the camera does', async ({ page, isMobile }) => {
  await openAt(page, lastStep.x, lastStep.y);
  // The first life triangle spans x 8 to 18, y 8 to 17 (GDD-UI-01): its middle is its red fill.
  const fill = { x: 13, y: 13 };
  const before = await page.evaluate(() => ({ scrollY: window.__PONCHO__!.camera().scrollY, touch: window.__PONCHO__!.touch(), hilos: window.__PONCHO__!.hudHilos() }));
  const [fillBefore] = await pixelsAt(page, [fill]);
  expect(red(fillBefore!)).toBeGreaterThan(80);
  // Off the lip and down to the landing ground, by steps.
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let airborne = false;
    for (let i = 0; i < 200 && !(airborne && d.state().grounded); i++) {
      d.step(1, { move: 1, jumpHeld: false });
      airborne ||= !d.state().grounded;
    }
  });
  // The camera and the readers of the screen, read on the same drawn state (L-033).
  const after = await page.evaluate(() => ({ scrollY: window.__PONCHO__!.camera().scrollY, touch: window.__PONCHO__!.touch(), hilos: window.__PONCHO__!.hudHilos() }));
  expect(after.scrollY - before.scrollY).toBeGreaterThan(50);
  expect(after.hilos).toEqual(before.hilos);
  expect(after.touch.shiftY).toBe(0);
  expect(after.touch.buttons).toEqual(before.touch.buttons);
  if (isMobile) expect(after.touch.visible).toBe(true);
  // The triangle is drawn where it was: its fill is the same red.
  const [fillAfter] = await pixelsAt(page, [fill]);
  expect(fillAfter).toEqual(fillBefore);
});

test('GDD-UI-04 a pause holds the camera', async ({ page }) => {
  // In the drop's fall, as it starts to look down (his feet 4 px past y 156, with the camera at the level's top until then, so the camera
  // is still gaining on him): paused, the frames go on and the camera does not move. A camera stepped by the frames as well as by the steps
  // would go on gaining on him.
  await openAt(page, lastStep.x, lastStep.y);
  const moving = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 100 && d.state().y < 160; i++) d.step(1, { move: 1, jumpHeld: false });
    const y0 = d.camera().scrollY;
    d.step(1, { move: 1, jumpHeld: false });
    return { y0, y1: d.camera().scrollY, grounded: d.state().grounded };
  });
  expect(moving.grounded).toBe(false);
  expect(moving.y1).toBeGreaterThan(moving.y0);
  const held = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        const tick = () => {
          out.push(window.__PONCHO__!.camera().scrollY);
          if (out.length >= 20) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(new Set(held)).toEqual(new Set([moving.y1]));
});

test('GDD-UI-04 a respawn is a cut', async ({ page }) => {
  // The third ofrenda is on the highest ledge: touched, it is the checkpoint, where the camera is at the level's top.
  const o = LAB_3T_OFRENDAS[2]!;
  await openAt(page, o.x - 20, o.y);
  await page.evaluate(() => window.__PONCHO__!.step(20, { move: 1, jumpHeld: false }));
  expect(await page.evaluate(() => window.__PONCHO__!.checkpoint())).toEqual({ x: o.x, y: o.y });
  // Then low in the level, on the lowest ground with the camera at its bottom limit, and out through the floor: a life lost.
  const low = { x: (LAB_3T_LOWEST.col0 + 4) * TILE, y: LAB_3T_LOWEST.row * TILE };
  await page.evaluate(([x, y]) => {
    const d = window.__PONCHO__!;
    d.teleport(x!, y! - 1);
    d.step(20);
  }, [low.x, low.y]);
  expect(await page.evaluate(() => window.__PONCHO__!.camera().scrollY)).toBe(368);
  await page.evaluate((x) => {
    const d = window.__PONCHO__!;
    d.teleport(x, 700);
    d.step(2);
  }, low.x);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('respawning');
  // Through the game's own frames: until a while after he is back in play, the camera and whether he is drawn, read together each frame.
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  const seen = await page.evaluate(
    () =>
      new Promise<{ y: number; visible: boolean; phase: string }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const out: { y: number; visible: boolean; phase: string }[] = [];
        let playing = 0;
        const tick = () => {
          out.push({ y: d.camera().scrollY, visible: d.bodyVisible(), phase: d.phase() });
          if (d.phase() === 'playing') playing++;
          if (playing > 10 || out.length > 2000) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  const shown = seen.findIndex((s) => s.visible);
  expect(shown).toBeGreaterThan(0);
  expect(seen.at(-1)!.phase).toBe('playing');
  // Hidden, it held at its bottom limit; on the first frame he is drawn it is at the cut's y (his feet at 136, held at the level's top: 0).
  expect(Math.max(0, o.y - CAMERA.spawnFeet)).toBe(0);
  for (const s of seen.slice(0, shown)) expect(s.y).toBe(368);
  for (const s of seen.slice(shown)) expect(s.y).toBe(0);
});

test('GDD-UI-04 quitting to the title low in lab-3t cuts the camera back to the level start', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  // On the lowest ground the camera is at its bottom limit; the level start, on the plateau at row 8, is at the level's top (the cut: 0).
  await openAt(page, (LAB_3T_LOWEST.col0 + 4) * TILE, LAB_3T_LOWEST.row * TILE);
  expect(await page.evaluate(() => window.__PONCHO__!.camera().scrollY)).toBe(368);
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  // The pause menu, Down twice to Quit to title, Enter (GDD-UI-02).
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  for (const want of ['settings', 'quit'] as const) {
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction((w) => window.__PONCHO__!.pauseDrawn().menu.chosen === w, want);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  /** The camera on each of the next `n` frames. */
  const frames = (n: number) =>
    page.evaluate(
      (count) =>
        new Promise<number[]>((resolve) => {
          const out: number[] = [];
          const tick = () => {
            out.push(window.__PONCHO__!.camera().scrollY);
            if (out.length >= count) resolve(out);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      n,
    );
  // On the title screen it shows the level start: 0 on every frame.
  expect(new Set(await frames(10))).toEqual(new Set([0]));
  // Start: the first frames of play are at 0 too, with no pan from the lowest ground.
  const t0 = await page.evaluate(() => window.__PONCHO__!.ticks());
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  const played = await frames(10);
  expect(await page.evaluate(() => window.__PONCHO__!.ticks())).toBeGreaterThan(t0);
  expect(new Set(played)).toEqual(new Set([0]));
});

test('GDD-UI-04 the camera is drawn between its last two steps', async ({ page }) => {
  // In the drop's fall, once it looks down: the camera's y after the step before and after the last one differ, and a frame drawn at
  // 0, a half and all of the way between them shows the camera there, at whole art pixels.
  await openAt(page, lastStep.x, lastStep.y);
  const drawn = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 100 && d.state().y < 200; i++) d.step(1, { move: 1, jumpHeld: false });
    const { fromY, stepY } = d.camera();
    const at = [0, 0.5, 1].map((alpha) => {
      d.drawAt(alpha);
      return d.camera().scrollY;
    });
    return { fromY, stepY, at, grounded: d.state().grounded };
  });
  expect(drawn.grounded).toBe(false);
  expect(drawn.stepY - drawn.fromY).toBeGreaterThan(4);
  expect(drawn.at).toEqual([art(drawn.fromY), art((drawn.fromY + drawn.stepY) / 2), art(drawn.stepY)]);
});

// GDD-WLD-03: the high pit past the descending cart's end, its lips at row 22, with a raised bottom 4 rows under them over columns 60 to 75:
// its floor line at y 432, so the camera's bottom limit there is 432 - 2 - 270 = 160 (the level's own is 368).
const HIGH_LIP_Y = LAB_3T_HIGH_PIT.row * TILE;
const SPAN_LIMIT = (LAB_3T_HIGH_BOTTOM.row + 1) * TILE - CAMERA.bottomCutPx - 270;
/** On the far side 4 columns short of the raised bottom, where the camera has the level's limits. */
const beforeHigh = { x: (LAB_3T_HIGH_BOTTOM.fromCol - 4) * TILE + TILE / 2, y: HIGH_LIP_Y };

test('GDD-WLD-03 a pit high in lab-3t costs the life at its raised bottom and the camera stops there', async ({ page }) => {
  expect(SPAN_LIMIT).toBe(160);
  const errors = await openAt(page, beforeHigh.x, beforeHigh.y);
  // Right held, by steps, into the high pit until the life is lost: the lives before and after, and the camera after each step.
  const run = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const lives = d.lives();
    const ys: number[] = [d.camera().scrollY];
    for (let i = 0; i < 400 && d.phase() === 'playing'; i++) {
      d.step(1, { move: 1, jumpHeld: false });
      ys.push(d.camera().scrollY);
    }
    return { lives, after: d.lives(), phase: d.phase(), ys, x: d.state().x };
  });
  expect(run.phase).toBe('respawning');
  expect(run.after).toBe(run.lives - 1);
  expect(Math.floor(run.x / TILE)).toBeGreaterThanOrEqual(LAB_3T_HIGH_PIT.col0);
  expect(Math.floor(run.x / TILE)).toBeLessThanOrEqual(LAB_3T_HIGH_PIT.col1);
  // At the moment of loss the camera is at the raised bottom's limit, not the level's 368; it got there at the pan, 3 px a step at most.
  expect(run.ys.at(-1)).toBe(SPAN_LIMIT);
  expect(run.ys[0]).toBeGreaterThan(SPAN_LIMIT);
  for (let i = 1; i < run.ys.length; i++) expect(Math.abs(run.ys[i]! - run.ys[i - 1]!), `step ${i}`).toBeLessThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('GDD-UI-04 the picture never jumps when the bottom limit changes', async ({ page }) => {
  const errors = await openAt(page, beforeHigh.x, beforeHigh.y);
  // Right across the raised bottom's two ends, with a running jump over the pit, to the level's right edge: the camera after each step.
  const seen = await page.evaluate(
    ([lip, far, end]) => {
      const d = window.__PONCHO__!;
      const out: { y: number; grounded: boolean; col: number }[] = [{ y: d.camera().scrollY, grounded: true, col: Math.floor(d.state().x / 16) }];
      let jumped = false;
      for (let i = 0; i < 600 && d.state().x < end! && d.phase() === 'playing'; i++) {
        const s = d.state();
        if (!jumped && s.grounded && s.x + 6 >= lip! - 2) jumped = true;
        d.step(1, { move: 1, jumpHeld: jumped && s.x < far! });
        out.push({ y: d.camera().scrollY, grounded: d.state().grounded, col: Math.floor(d.state().x / 16) });
      }
      return { out, phase: d.phase() };
    },
    [LAB_3T_HIGH_PIT.col0 * TILE, (LAB_3T_HIGH_PIT.col1 + 1) * TILE, (LAB_3T_HIGH_BOTTOM.toCol + 4) * TILE],
  );
  expect(seen.phase).toBe('playing');
  const { out } = seen;
  // He crossed both ends.
  expect(out[0]!.col).toBeLessThan(LAB_3T_HIGH_BOTTOM.fromCol);
  expect(out.at(-1)!.col).toBeGreaterThan(LAB_3T_HIGH_BOTTOM.toCol);
  // Never more than 8 px between steps, 3 px while he stands: up to the span's limit as he walks onto it, down again past its end.
  for (let i = 1; i < out.length; i++) {
    const move = Math.abs(out[i]!.y - out[i - 1]!.y);
    expect(move, `step ${i}`).toBeLessThanOrEqual(8);
    if (out[i]!.grounded) expect(move, `step ${i}`).toBeLessThanOrEqual(3);
  }
  expect(Math.min(...out.map((o) => o.y))).toBe(SPAN_LIMIT);
  expect(out.at(-1)!.y).toBeGreaterThan(SPAN_LIMIT);
  expect(errors).toEqual([]);
});

for (const [id, level] of [
  ['1-1', LEVEL_1_1],
  ['2-4', LEVEL_2_4],
] as const) {
  test(`GDD-UI-04, GDD-BOS-01 one-screen levels do not scroll up or down: ${id}`, async ({ page }) => {
    const errors = await boot(page, `/?level=${id}`);
    await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
    // A full jump from the spawn, then a fall from the level's top to its floor, the camera read after each step.
    const { ys, jumped, fell } = await page.evaluate(
      ([x, top]) => {
        const d = window.__PONCHO__!;
        d.pause(true);
        const out: number[] = [];
        let rose = false;
        for (let i = 0; i < 80; i++) {
          d.step(1, { move: 0, jumpHeld: true });
          rose ||= d.state().vy < 0;
          out.push(d.camera().scrollY, d.camera().viewY);
        }
        d.teleport(x!, top!);
        let landed = false;
        for (let i = 0; i < 80; i++) {
          d.step(1);
          landed ||= d.state().grounded;
          out.push(d.camera().scrollY, d.camera().viewY);
        }
        return { ys: out, jumped: rose, fell: landed };
      },
      [level.spawn.x, 2 * TILE],
    );
    expect([jumped, fell]).toEqual([true, true]);
    // And into a pit, where the level has one, until he is lost.
    const pit = gaps(level.world)[0];
    if (pit) {
      const lost = await page.evaluate(
        ([x]) => {
          const d = window.__PONCHO__!;
          d.teleport(x!, 2 * 16);
          const out: number[] = [];
          for (let i = 0; i < 200 && d.phase() === 'playing'; i++) {
            d.step(1);
            out.push(d.camera().scrollY, d.camera().viewY);
          }
          return { out, phase: d.phase() };
        },
        [(pit.col + pit.width / 2) * TILE],
      );
      expect(lost.phase).toBe('respawning');
      ys.push(...lost.out);
    }
    expect(id !== '1-1' || pit !== undefined).toBe(true);
    expect(new Set(ys)).toEqual(new Set([0]));
    expect(errors).toEqual([]);
  });
}

test("GDD-ART-06 the backdrop's mid layer shifts down as the camera rises", async ({ page }) => {
  // At the lowest ground the camera is at its lowest: every layer at its place in a one-screen level.
  const { midTop, farTop, sun } = LOOKS.desierto;
  await openAt(page, (LAB_3T_LOWEST.col0 + 4) * TILE, LAB_3T_LOWEST.row * TILE);
  const low = await page.evaluate(() => ({ scrollY: window.__PONCHO__!.camera().scrollY, layout: window.__PONCHO__!.backdropLayout() }));
  expect(low.scrollY).toBe(368);
  expect(low.layout).toMatchObject({ desertY: midTop, mountainsY: farTop, sunY: sun!.y });
  // On the highest ledge, 368 px higher: the mid strip 73.6 px lower (0.2 of it, at whole art pixels), the far strip 36.8 (0.1), the sun still.
  await page.evaluate(([x, y]) => {
    const d = window.__PONCHO__!;
    d.teleport(x!, y! - 1);
    d.step(20);
  }, [(LAB_3T_TOP.col0 + 1) * TILE, LAB_3T_TOP.row * TILE]);
  const high = await page.evaluate(() => ({ scrollY: window.__PONCHO__!.camera().scrollY, layout: window.__PONCHO__!.backdropLayout(), shifts: window.__PONCHO__!.backdropShifts() }));
  expect(high.scrollY).toBe(0);
  expect(high.layout).toMatchObject({ desertY: midTop + 73.5, mountainsY: farTop + 36.75, sunY: sun!.y });
  // Every object of the backdrop moved down or not at all; the far strip, its foot and the mid strip are the last three.
  expect(high.shifts.slice(-3)).toEqual([36.75, 36.75, 73.5]);
  expect(new Set(high.shifts.slice(0, -3))).toEqual(new Set([0]));
});
