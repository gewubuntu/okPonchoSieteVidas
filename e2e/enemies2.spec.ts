import { expect, test, type Page } from '@playwright/test';
import { CHAPULIN, PALOMA, TROMPO } from '../src/config/tuning';
import { LAB_2E_ENEMIES } from '../src/levels/lab2e';
import { boot, clearOfButtons, nearHex, pixelsAt } from './helpers';

// GDD-ENM-03: World 2's enemies as sprites, in lab-2e (`?level=lab-2e`), a 60-tile test level with three pens: a Paloma, a Chapulín and a
// Trompo, each on the floor (L-062: their places come from `src/levels/lab2e.ts`). The drawn state is read back from the images
// (`enemiesDrawn`, `defeatsDrawn`), never from the sim; the game is paused and stepped, so time is in simulation steps (L-042).
const [PALOMA_AT, CHAPULIN_AT, TROMPO_AT] = LAB_2E_ENEMIES;
const FLOOR = PALOMA_AT!.y; // the floor's top: where their feet start
const start = async (page: Page) => {
  const errors = await boot(page, '/?level=lab-2e');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  return errors;
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
const enemy = async (page: Page, i: number) => (await page.evaluate(() => window.__PONCHO__!.enemies()))[i]!;
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
/** Enemy `i` as the scene drew it after the last step (a frame is drawn first), by its index among the drawn live ones. */
const drawnOf = async (page: Page, kind: string) => {
  await frames(page);
  return (await page.evaluate(() => window.__PONCHO__!.enemiesDrawn())).find((e) => e.kind === kind)!;
};
/** The defeats as drawn after the last step, as `kind look`. */
const defeats = async (page: Page) => {
  await frames(page);
  return page.evaluate(() => window.__PONCHO__!.defeatsDrawn());
};

test('GDD-ENM-03 lab-2e draws a Paloma, a Chapulín and a Trompo as sprites where they are', async ({ page }) => {
  const errors = await start(page);
  await step(page, 30);
  await frames(page);
  const drawn = await page.evaluate(() => window.__PONCHO__!.enemiesDrawn());
  expect(drawn.map((d) => d.kind)).toEqual(['paloma', 'chapulin', 'trompo']);
  // The boot has run a few steps before the pause, so the Chapulín may already be in its first hop.
  const looks = [/^walk[0-3]$/, /^(crouch[01]|tele|teleRed|rise|fall)$/, /^spin[0-3]$/];
  for (let i = 0; i < 3; i++) {
    const e = await enemy(page, i);
    expect(drawn[i]!.x, `enemy ${i} x`).toBeCloseTo(e.x, 6);
    expect(drawn[i]!.y, `enemy ${i} feet`).toBeCloseTo(e.y, 6); // the Chapulín may be in its first hop
    expect(drawn[i]!.look, `enemy ${i}`).toMatch(looks[i]!);
  }
  // A walker is drawn mirrored exactly while it heads left: step on until each has been seen heading left (they turn at their pen's walls).
  // One page round trip for the whole loop (each round steps 5 and waits for a drawn frame), so it stays well inside the test's time.
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const left = [false, false, false];
    const wrong: string[] = [];
    for (let round = 0; round < 400 && left.some((l) => !l); round++) {
      d.step(5);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const sim = d.enemies();
      d.enemiesDrawn().forEach((e, i) => {
        if (e.flip !== sim[i]!.dir < 0) wrong.push(`${e.kind} round ${round} flip ${e.flip} dir ${sim[i]!.dir}`);
        if (sim[i]!.dir < 0) left[i] = true;
      });
    }
    return { left, wrong };
  });
  expect(seen.wrong).toEqual([]);
  expect(seen.left).toEqual([true, true, true]);
  expect(errors).toEqual([]);
});

test('GDD-ENM-03 a startled Paloma is drawn in its telegraph, then flying at its height', async ({ page }) => {
  await start(page);
  const { x } = await enemy(page, 0);
  await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [x - 30, FLOOR]);
  await step(page, 1); // the step it spots him: age 0 of its telegraph
  expect((await enemy(page, 0)).phase).toBe('telegraph');
  expect((await drawnOf(page, 'paloma')).look).toBe('teleRed');
  await step(page, 4); // age 4: the plain half of the flash
  expect((await drawnOf(page, 'paloma')).look).toBe('tele');
  // 30 telegraph steps and 20 rising steps after the first, plus one: its first step hovering, 40 px up.
  await step(page, 30 + PALOMA.riseHeight / (PALOMA.riseSpeed / 60) + 1 - 4);
  expect((await enemy(page, 0)).phase).toBe('hover');
  let paloma = await drawnOf(page, 'paloma');
  expect(paloma.y).toBeCloseTo(FLOOR - PALOMA.riseHeight, 2);
  expect(paloma.look).toMatch(/^flap[0-3]$/);
  await step(page, 15); // hover age 15 and on: drawn lower by its bob
  expect((await enemy(page, 0)).phase).toBe('hover');
  paloma = await drawnOf(page, 'paloma');
  expect(paloma.y).toBeCloseTo(FLOOR - PALOMA.riseHeight + PALOMA.bobPx, 2);
});

test('GDD-ENM-03 the Chapulín is drawn crouched, then rising, then falling in the air', async ({ page }) => {
  await start(page);
  expect((await drawnOf(page, 'chapulin')).look).toMatch(/^(crouch[01]|tele|teleRed)$/); // it starts crouched, and the boot has run a few steps
  // Poncho stays at the spawn, far from its pen. Step until its hop begins, then follow it through the air, a drawn frame each step.
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 200 && d.enemies()[1]!.phase !== 'air'; k++) d.step(1);
    const out: { phase: string; look: string; y: number }[] = [];
    for (let k = 0; k < 40 && (k === 0 || d.enemies()[1]!.phase === 'air'); k++) {
      if (k > 0) d.step(1);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const c = d.enemiesDrawn().find((e) => e.kind === 'chapulin')!;
      out.push({ phase: d.enemies()[1]!.phase, look: c.look, y: c.y });
    }
    return out;
  });
  const air = seen.filter((s) => s.phase === 'air');
  expect(air.length).toBeGreaterThan(15);
  // Its hop (300 px/s up, falling as Poncho falls) rises for about 12 steps of 25: rise first, then fall, once.
  const firstFall = air.findIndex((s) => s.look === 'fall');
  expect(air[0]!.look).toBe('rise');
  expect(firstFall).toBeGreaterThan(8);
  expect(firstFall).toBeLessThan(18);
  expect(air.slice(0, firstFall).every((s) => s.look === 'rise')).toBe(true);
  expect(air.slice(firstFall).every((s) => s.look === 'fall')).toBe(true);
  // It rises while drawn rising and sinks while drawn falling.
  for (let i = 1; i < firstFall; i++) expect(air[i]!.y, `step ${i}`).toBeLessThan(air[i - 1]!.y);
  for (let i = firstFall + 1; i < air.length; i++) expect(air[i]!.y, `step ${i}`).toBeGreaterThan(air[i - 1]!.y);
  expect(CHAPULIN.hopUp).toBe(300);
});

test('GDD-ENM-03 and GDD-CMB-02 the claw stuns the Trompo, and a stomp leaves its squash and a poof', async ({ page }) => {
  await start(page);
  // Wait until it heads back left, then stand 28 px to its left, facing it, and swipe.
  for (let i = 0; i < 600 && (await enemy(page, 2)).dir > 0; i++) await step(page, 5);
  const { x } = await enemy(page, 2);
  await page.evaluate(([tx, fy]) => window.__PONCHO__!.teleport(tx! - 28, fy!), [x, FLOOR]);
  await step(page, 1, { move: 1, jumpHeld: false });
  await step(page, 3, { move: 0, jumpHeld: false, claw: true });
  expect((await enemy(page, 2)).phase).toBe('stunned');
  expect((await drawnOf(page, 'trompo')).look).toBe('stun');
  for (let i = 0; i < 60 && (await enemy(page, 2)).alive; i++) await step(page, 1, { move: 1, jumpHeld: i < 4 });
  expect((await enemy(page, 2)).alive).toBe(false);
  expect((await defeats(page)).map((d) => `${d.kind} ${d.look}`)).toEqual(['trompo squash']);
  await step(page, 8, { move: 0, jumpHeld: false }); // age 8: the poof's first frame
  expect((await defeats(page)).map((d) => `${d.kind} ${d.look}`)).toEqual(['trompo poof0']);
});

test('GDD-ENM-03 a clawed Paloma leaves its hit frame, then a poof', async ({ page }) => {
  await start(page);
  const { x } = await enemy(page, 0);
  // Beside it, facing it: it spots him and telegraphs, and a claw in the telegraph defeats it too.
  await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [x - 20, FLOOR]);
  await step(page, 1, { move: 1, jumpHeld: false });
  for (let i = 0; i < 8 && (await enemy(page, 0)).alive; i++) await step(page, 1, { move: 0, jumpHeld: false, claw: true });
  expect((await enemy(page, 0)).alive).toBe(false);
  expect((await defeats(page)).map((d) => `${d.kind} ${d.look}`)).toEqual(['paloma hit']);
  await step(page, 8);
  expect((await defeats(page)).map((d) => `${d.kind} ${d.look}`)).toEqual(['paloma poof0']);
});

// GDD-ART-06: each kind's own colour in the picture the player sees (a screenshot read at points, as e2e/claw-pixels.spec.ts does). The
// game stays paused with Poncho 60 px beside the enemy; its box on screen is its drawn x and feet less the camera's view.
const COLOURS = { paloma: '#9AA6CD', chapulin: '#3E7A3C', trompo: '#F4EFE2' } as const;
for (const [kind, def, hex, box] of [
  ['paloma', PALOMA_AT!, COLOURS.paloma, PALOMA],
  ['chapulin', CHAPULIN_AT!, COLOURS.chapulin, CHAPULIN],
  // The Trompo's three tacks stand on its crown: from 3.5 px above its box (its art reaches that far) to 2 px into it.
  ['trompo', TROMPO_AT!, COLOURS.trompo, TROMPO],
] as const) {
  test(`GDD-ART-06 the ${kind} is drawn in its own colours`, async ({ page }) => {
    await start(page);
    const index = LAB_2E_ENEMIES.indexOf(def);
    await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [def.x - 60, FLOOR]);
    await page.waitForFunction(([px]) => Math.abs(window.__PONCHO__!.bodyPose().x - px!) < 0.01, [def.x - 60]);
    // The camera has caught up with him when its view stops moving.
    let view = -1;
    for (let i = 0; i < 120; i++) {
      await frames(page);
      const now = await page.evaluate(() => window.__PONCHO__!.camera().viewX);
      if (now === view) break;
      view = now;
    }
    // The Chapulín's red flash has no leaf in it: step on to a plain frame of its telegraph.
    for (let i = 0; i < 12 && (await drawnOf(page, kind)).look === 'teleRed'; i++) await step(page, 1);
    const painted = await drawnOf(page, kind);
    expect(painted.look).toMatch(kind === 'trompo' ? /^spin[0-3]$/ : /^(walk[0-3]|crouch[01]|tele)$/);
    const x0 = painted.x - box.width / 2 - view;
    const [y0, y1] = kind === 'trompo' ? [painted.y - TROMPO.height - 3.5, painted.y - TROMPO.height + 2] : [painted.y - box.height, painted.y];
    const points: { x: number; y: number }[] = [];
    for (let y = y0 + 0.25; y < y1; y += 0.5) for (let x = x0 + 0.25; x < x0 + box.width; x += 0.5) points.push({ x, y });
    const clear = await clearOfButtons(page, points);
    const found = (await pixelsAt(page, clear)).filter((c) => nearHex(c, hex)).length;
    expect(found, `${kind} ${hex} in ${clear.length} points of box ${index}`).toBeGreaterThan(0);
  });
}

test('GDD-ENM-03 the Trompo spins through its frames in real play, unpaused', async ({ page }) => {
  // L-021: the game's own frames, not the debug step, redraw it: within 240 steps of play it shows every spin frame (one every 3 steps).
  await boot(page, '/?level=lab-2e');
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const t0 = d.ticks();
    const looks = new Set<string>();
    for (let f = 0; f < 3000 && looks.size < 4 && d.ticks() < t0 + 240; f++) {
      await new Promise((r) => requestAnimationFrame(r));
      const look = d.enemiesDrawn().find((e) => e.kind === 'trompo')?.look;
      if (look) looks.add(look);
    }
    return [...looks];
  });
  expect(new Set(seen)).toEqual(new Set(['spin0', 'spin1', 'spin2', 'spin3']));
});
