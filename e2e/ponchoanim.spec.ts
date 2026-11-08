import { expect, test, type Page } from '@playwright/test';
import { itemFrame } from '../src/ui/ponchoLooks';
import { pickupLook } from '../src/ui/ponchoPose';
import { boot, nearHex, pixelsAt, readSheet, spotsIn, stepUntil } from './helpers';

// GDD-ART-04: Poncho's animation frames as the game draws them, read back from the images (`ponchoSprite().look`, `swipeDrawn()`,
// `heldDrawn()`, `fxDrawn()`), step by step in the paused game (L-042). The sandbox: the floor's top is y 224, the door at column 8 (x 128),
// the pit at columns 14 to 16 (x 224 to 272), the taco on the floor at column 18 (x 288 to 304) and the spikes at columns 20 and 21 (x 320
// to 352).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
/** The lettuce's two greens (GDD-ART-03: the items' added colours). */
const green = (c: { r: number; g: number; b: number }) => nearHex(c, '#9CCB4A', 30) || nearHex(c, '#4B8A34', 30);
declare global {
  interface Window {
    /** The looks noted frame by frame by the unpaused test. */
    ponchoLooks?: string[];
  }
}
type Seen = { look: string; vy: number; grounded: boolean; swipe: string | null; held: string | null; fx: string | null };

/** Boots the sandbox, pauses, and stands Poncho at (x, y). */
async function standAt(page: Page, x: number, y = 224): Promise<string[]> {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(([px, py]) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.teleport(px!, py!);
    d.step(2);
  }, [x, y]);
  return errors;
}

/** Steps `n` times with `input` (in the page, one round trip), recording what is drawn after each step. */
const record = (page: Page, n: number, input: { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean } = { move: 0, jumpHeld: false }) =>
  page.evaluate(
    ([k, i]) => {
      const d = window.__PONCHO__!;
      const out: Seen[] = [];
      for (let s = 0; s < k; s++) {
        d.step(1, i);
        const p = d.state();
        out.push({ look: d.ponchoSprite().look, vy: p.vy, grounded: p.grounded, swipe: d.swipeDrawn()?.look ?? null, held: d.heldDrawn()?.look ?? null, fx: d.fxDrawn()[0]?.look ?? null });
      }
      return out;
    },
    [n, input] as const,
  );
/** The looks in order with repeats taken out. */
const changes = (looks: string[]) => looks.filter((l, i) => i === 0 || l !== looks[i - 1]);

test('GDD-ART-04 a jump shows jump0, then jump1, the apex and the fall by his speed, and land on landing', async ({ page }) => {
  const errors = await standAt(page, 56);
  const air = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const out: { look: string; vy: number; grounded: boolean }[] = [];
    // Jump held while he rises and let go at the top: held on the way down it would glide (GDD-MOV-07, on in the sandbox).
    for (let i = 0; i < 120 && (i === 0 || !d.state().grounded); i++) {
      d.step(1, { move: 0, jumpHeld: i === 0 || d.state().vy < 0 });
      out.push({ look: d.ponchoSprite().look, vy: d.state().vy, grounded: d.state().grounded });
    }
    return out;
  });
  const after = await record(page, 7);
  expect(errors).toEqual([]);
  const flying = air.filter((s) => !s.grounded);
  // The first 4 steps of the take-off show jump0; after them the frame follows his speed (px/s, down positive): under -120 jump1, under 60
  // the apex, under 250 the fall, the fast fall from 250.
  expect(flying.slice(0, 4).map((s) => s.look)).toEqual(['jump0', 'jump0', 'jump0', 'jump0']);
  for (const s of flying.slice(4)) expect(s.look, `vy ${s.vy}`).toBe(s.vy < -120 ? 'jump1' : s.vy < 60 ? 'apex' : s.vy < 250 ? 'fall0' : 'fall1');
  // In that order (the sandbox's full jump lands under 250 px/s, so the fast fall may not come).
  const order = changes(flying.map((s) => s.look));
  expect(order.slice(0, 4)).toEqual(['jump0', 'jump1', 'apex', 'fall0']);
  expect(order.slice(4)).toEqual(order.length > 4 ? ['fall1'] : []);
  // Landed from a fall of 150 px/s or more: land for 6 steps (the landing step the first), then standing.
  expect([air.at(-1)!.look, ...after.map((s) => s.look)]).toEqual(['land', 'land', 'land', 'land', 'land', 'land', 'idle', 'idle']);
});

test('GDD-ART-04 turning while running shows the skid', async ({ page }) => {
  await standAt(page, 112);
  const left = await record(page, 10, { move: -1, jumpHeld: false });
  const turn = await record(page, 8, { move: 1, jumpHeld: false });
  expect(left.at(-1)!.look).toMatch(/^run/);
  // Turned right while still sliding left at 40 px/s or more: the skid, then the run frames again (counted on by distance).
  const order = changes(turn.map((s) => s.look));
  expect(order[0]).toBe('skid');
  expect(order[1]).toMatch(/^run/);
});

test('GDD-ART-04 a claw shows clawWind, clawSwipe with swipe0 and swipe1, then clawFollow with swipe2 and swipe3', async ({ page }) => {
  await standAt(page, 120);
  const seen = [...(await record(page, 1, { move: 0, jumpHeld: false, claw: true })), ...(await record(page, 15))];
  expect(seen.map((s) => s.look)).toEqual(['clawWind', 'clawWind', 'clawSwipe', 'clawSwipe', 'clawSwipe', ...Array(10).fill('clawFollow'), 'idle']);
  expect(seen.map((s) => s.swipe)).toEqual([null, null, 'swipe0', 'swipe1', 'swipe1', 'swipe2', 'swipe2', 'swipe2', 'swipe3', 'swipe3', 'swipe3', null, null, null, null, null]);
  expect(await api(page, () => window.__PONCHO__!.clawDrawn())).toBe('none');
});

test('GDD-ART-04 eating a taco shows eat0 with the taco, then eat1 with the bitten taco and the crumbs', async ({ page }) => {
  await standAt(page, 280);
  const steps = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let n = 0;
    while (n < 40 && d.power() === 'base') {
      d.step(1, { move: 1, jumpHeld: false });
      n++;
    }
    return n;
  });
  expect(steps).toBeLessThan(40);
  const ate = await api(page, () => ({ look: window.__PONCHO__!.ponchoSprite().look, held: window.__PONCHO__!.heldDrawn()?.look }));
  const seen = await record(page, 24);
  // The step he takes it is eat0's first: 10 of eat0, then 14 of eat1 with 6 steps of crumbs0 and 6 of crumbs1.
  expect(ate).toEqual({ look: 'eat0', held: 'tacoFood' });
  expect(seen.map((s) => s.look)).toEqual([...Array(9).fill('eat0'), ...Array(14).fill('eat1'), 'idle']);
  expect(seen.map((s) => s.held)).toEqual([...Array(9).fill('tacoFood'), ...Array(14).fill('tacoBittenHeld'), 'tacoHeld']);
  expect(seen.map((s) => s.fx)).toEqual([...Array(9).fill(null), ...Array(6).fill('crumbs0'), ...Array(6).fill('crumbs1'), null, null, null]);
});

test('GDD-ART-04 a fireball shows spit0, then spit1 with the flame', async ({ page }) => {
  await standAt(page, 100);
  await page.evaluate(() => {
    window.__PONCHO__!.setPower('fuego');
    window.__PONCHO__!.step(1);
  });
  const seen = [...(await record(page, 1, { move: 0, jumpHeld: false, fuego: true })), ...(await record(page, 10))];
  expect(await api(page, () => window.__PONCHO__!.spits())).toBe(1);
  expect(seen.map((s) => s.look)).toEqual(['spit0', 'spit0', ...Array(8).fill('spit1'), 'idle']);
  expect(seen.map((s) => s.fx)).toEqual([null, null, ...Array(4).fill('flame0'), ...Array(4).fill('flame1'), null]);
  expect(seen[0]!.held).toBe('chileHeld');
});

test('GDD-ART-04 a hit in Taco shows hurt0, then hurt1', async ({ page }) => {
  await standAt(page, 310); // past the taco
  await page.evaluate(() => {
    window.__PONCHO__!.setPower('taco');
    window.__PONCHO__!.step(1);
  });
  const run = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let n = 0;
    while (n < 60 && d.invulnerable() === 0) {
      d.step(1, { move: 1, jumpHeld: false });
      n++;
    }
    return { n, look: d.ponchoSprite().look, held: d.heldDrawn() };
  });
  expect(run.n).toBeLessThan(60); // the spikes at x 320
  const seen = await record(page, 24);
  expect([run.look, ...seen.map((s) => s.look)]).toEqual([...Array(6).fill('hurt0'), ...Array(18).fill('hurt1'), 'idle']);
  expect(run.held).toBeNull();
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
});

test('GDD-ART-04 the respawn flip shows the flip frames, turning once, and he stands at the end', async ({ page }) => {
  await standAt(page, 56);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // over the pit
  await stepUntil(page, { phase: 'respawning' }, 200);
  const seen = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const out: string[] = [];
    for (let i = 0; i < 60 && d.phase() === 'respawning'; i++) {
      d.step(1);
      if (d.bodyVisible()) out.push(d.ponchoSprite().look);
    }
    return { looks: out, rotation: d.bodyPose().rotation };
  });
  // The 21 steps of the flip turn him once, the frame the nearest 45-degree step: flip0 to flip7 in order and flip0 again on the ground.
  const flips = seen.looks.filter((l) => l.startsWith('flip'));
  expect(flips).toHaveLength(21);
  expect(changes(flips)).toEqual(['flip0', 'flip1', 'flip2', 'flip3', 'flip4', 'flip5', 'flip6', 'flip7', 'flip0']);
  expect(seen.looks.at(-1)).toBe('idle');
  expect(seen.rotation).toBe(0);
});

test('GDD-ART-04 standing, he blinks for 6 steps every 180', async ({ page }) => {
  await standAt(page, 56);
  const looks = (await record(page, 400)).map((s) => s.look);
  const first = looks.indexOf('blink');
  expect(first).toBeGreaterThanOrEqual(0);
  expect(first).toBeLessThan(180);
  expect(looks.slice(first, first + 6)).toEqual(Array(6).fill('blink'));
  expect(looks.slice(first + 6, first + 180)).toEqual(Array(174).fill('idle'));
  expect(looks.slice(first + 180, first + 186)).toEqual(Array(6).fill('blink'));
});

test('GDD-ART-04 the held taco is drawn at the frame\'s hand, on the side he faces', async ({ page }) => {
  await standAt(page, 120);
  await page.evaluate(() => {
    window.__PONCHO__!.setPower('taco');
    window.__PONCHO__!.step(1);
  });
  const s = await api(page, () => window.__PONCHO__!.state());
  expect(await api(page, () => window.__PONCHO__!.ponchoSprite().look)).toBe('idle');
  // The standing frame's hand is drawing px (72, 73) of its 96 x 96 frame, the held frame's paw its middle: 12 game px in front of his
  // middle and 11.5 above his feet.
  const right = await api(page, () => window.__PONCHO__!.heldDrawn());
  expect(right).toMatchObject({ look: 'tacoHeld', x: s.x + 12, y: s.y - 11.5 });
  // There, the paw's cream (#FBDAB7).
  const [paw] = await pixelsAt(page, [{ x: right!.x, y: right!.y }]);
  expect(nearHex(paw!, '#FBDAB7', 30), JSON.stringify(paw)).toBe(true);
  // Turned left and stopped: the mirror image, 12 px behind his middle as the art faces.
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.step(1, { move: -1, jumpHeld: false });
    for (let i = 0; i < 30 && d.state().vx !== 0; i++) d.step(1);
  });
  const t = await api(page, () => window.__PONCHO__!.state());
  expect([t.facing, t.vx]).toEqual([-1, 0]);
  expect(await api(page, () => window.__PONCHO__!.heldDrawn())).toMatchObject({ look: 'tacoHeld', x: t.x - 12, y: t.y - 11.5 });
});

test('GDD-ART-04 the held taco blinks with him while he is invulnerable', async ({ page }) => {
  await standAt(page, 310); // past the taco
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.setPower('fuego');
    d.step(1);
    for (let i = 0; i < 60 && d.invulnerable() === 0; i++) d.step(1, { move: 1, jumpHeld: false }); // into the spikes at x 320: Fuego to Taco
    d.step(30); // past the hurt frames, which hold nothing
  });
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('taco');
  const alphas = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const out: [number, number | undefined][] = [];
    for (let i = 0; i < 12; i++) {
      d.step(1);
      out.push([d.bodyAlpha(), d.heldDrawn()?.alpha]);
    }
    return out;
  });
  expect(new Set(alphas.map(([body]) => body))).toEqual(new Set([0.3, 1])); // he blinks
  for (const [body, held] of alphas) expect(held).toBe(body);
});

test('GDD-ART-04 the taco pickup floats: its frame follows the run\'s clock', async ({ page }) => {
  await standAt(page, 120);
  // The sandbox's taco is centred in the tile at column 18, row 13. A spot of lettuce in tacoBob1 (floated 1 px up) where tacoBob3 (1 px
  // down, squashed) is clear, read from the taco's sheet: game px from the frame's middle.
  const tacos = readSheet('poncho/taco.png');
  const [spot] = spotsIn(tacos, 16, 16, itemFrame('taco', 'tacoBob1'), ['#9CCB4A', '#4B8A34'], { size: 1, not: itemFrame('taco', 'tacoBob3') });
  const at = { x: 18 * 16 + 8 + spot!.dx, y: 13 * 16 + 8 + spot!.dy };
  // The look the clock gives, stepped to in the page with the clock read each step (the pure rule, src/ui/ponchoPose.ts).
  const stepTo = async (look: string) => {
    for (let i = 0; i < 64; i++) {
      const clock = await api(page, () => window.__PONCHO__!.clock());
      if (pickupLook('taco', clock) === look) return;
      await page.evaluate(() => window.__PONCHO__!.step(1));
    }
    throw new Error(`never ${look}`);
  };
  await stepTo('tacoBob1');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  const [up] = await pixelsAt(page, [at]);
  expect(green(up!), JSON.stringify(up)).toBe(true);
  await stepTo('tacoBob3');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  const [down] = await pixelsAt(page, [at]);
  expect(green(down!), JSON.stringify(down)).toBe(false);
});

test('GDD-ART-04 in real play the frames follow the steps: he blinks standing, unpaused', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  // Each frame the game draws, the look shown is noted in the page, until 400 steps have run (L-021, L-042: counted in steps).
  const from = await api(page, () => window.__PONCHO__!.ticks());
  await page.evaluate((start) => {
    const looks: string[] = [];
    window.ponchoLooks = looks;
    const note = () => {
      looks.push(window.__PONCHO__!.ponchoSprite().look);
      if (window.__PONCHO__!.ticks() < start + 400) requestAnimationFrame(note);
    };
    requestAnimationFrame(note);
  }, from);
  await page.waitForFunction((start) => window.__PONCHO__!.ticks() >= start + 400, from, { timeout: 60_000 });
  const looks = await page.evaluate(() => window.ponchoLooks ?? []);
  expect(looks).toContain('blink');
  expect(looks).toContain('idle');
});
