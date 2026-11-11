import { expect, test, type Page } from '@playwright/test';
import { CACTUS, CART, ENEMY, TILE, TROMPO } from '../src/config/tuning';
import { LAB_3C_BEAM, LAB_3C_ENEMIES, LAB_3C_OFRENDAS, LAB_3C_PIT, LAB_3C_RAILS } from '../src/levels/lab3c';
import { railLength, warningPost } from '../src/sim/cart';
import type { EnemyKind } from '../src/sim/enemy';
import { cartPose, WHEEL_OFFSET } from '../src/ui/cartPose';
import { boot, clearOfButtons, nearHex, pixelsAt, readSheet, spotsIn } from './helpers';

// GDD-WLD-15: the vagonetas in lab-3c (`?level=lab-3c`). Where R1 is comes from `src/levels/lab3c.ts` (L-062): its cart stands at the rail's
// start, 2 tiles right of the spawn, and its buffer is at the rail's end, 20 tiles on.
const R1 = LAB_3C_RAILS[0]!;
/** Where R1's cart stops: its floor's left end, with its front at the rail's end. */
const R1_STOP_X = R1.x + railLength(R1) - CART.width;
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

/**
 * Boots lab-3c, pauses it and hops Poncho into R1's cart by steps: he jumps at once from the spawn, holding right while he is short of the
 * cart's middle, and lets go of everything once it rolls. Returns the console errors.
 */
async function hopIn(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=lab-3c');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  const steps = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    let n = 0;
    for (; n < 200 && d.carts()[0]!.phase === 'waiting'; n++) {
      const gap = d.carts()[0]!.x! + 16 - d.state().x;
      d.step(1, { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: n < 20 });
    }
    return n;
  });
  expect(steps).toBeLessThan(200);
  return errors;
}

test('GDD-WLD-15 Poncho hops into the cart and rides it to the buffer', async ({ page }) => {
  const errors = await hopIn(page);
  expect(await page.evaluate(() => window.__PONCHO__!.carts()[0]!.phase)).toBe('rolling');
  // The game's own frames roll it on (L-021): each frame, his feet and the cart's floor, read together (L-033), until it stops.
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  const seen = await page.evaluate(
    () =>
      new Promise<{ phase: string; feet: number; floor: number; grounded: boolean }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const out: { phase: string; feet: number; floor: number; grounded: boolean }[] = [];
        const tick = () => {
          const c = d.carts()[0]!;
          const s = d.state();
          out.push({ phase: c.phase, feet: s.y, floor: c.y!, grounded: s.grounded });
          if (c.phase === 'stopped' || out.length > 3000) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(seen[seen.length - 1]!.phase).toBe('stopped');
  const riding = seen.filter((s) => s.phase === 'rolling');
  expect(riding.length).toBeGreaterThan(3);
  for (const s of riding) expect([s.grounded, s.feet]).toEqual([true, s.floor]);
  const end = await page.evaluate(() => ({ cart: window.__PONCHO__!.carts()[0]!, feet: window.__PONCHO__!.state().y }));
  expect(end.cart).toMatchObject({ x: R1_STOP_X, y: R1.y - CART.floorPx, w: CART.width, phase: 'stopped' });
  expect(end.feet).toBe(end.cart.y);
  expect(errors).toEqual([]);
});

test('GDD-WLD-15 a jump straight up from the rolling cart lands back in it', async ({ page }) => {
  await hopIn(page);
  await page.evaluate(() => window.__PONCHO__!.step(3)); // nothing held, a step after the landing
  expect(await page.evaluate(() => window.__PONCHO__!.state().jumpWasHeld)).toBe(false);
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  // The waits start before the press (L-042): the jump is about 34 steps in the air.
  const up = page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
  await page.keyboard.down('Space');
  await up;
  const back = await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    const s = d.state();
    return s.grounded ? { feet: s.y, x: s.x, cart: d.carts()[0]! } : null;
  });
  await page.keyboard.up('Space');
  const landed = (await back.jsonValue())!;
  expect(landed.cart.phase).toBe('rolling');
  expect(landed.feet).toBe(landed.cart.y);
  expect(landed.x).toBeGreaterThan(landed.cart.x! - 6);
  expect(landed.x).toBeLessThan(landed.cart.x! + landed.cart.w! + 6);
});

/** The kind of R1's enemy `i` in lab-3c. */
const kindAt = (i: number): EnemyKind => LAB_3C_ENEMIES[i]!.kind ?? 'alacran';

test('GDD-WLD-15 the rolling cart runs an enemy down', async ({ page }) => {
  const errors = await hopIn(page);
  const lives = await page.evaluate(() => window.__PONCHO__!.lives());
  // By steps in the page (L-073): each step's cart, enemies and lives, until the cart stops at its buffer; on the step an enemy is defeated,
  // the game's own frames draw it (paused, so nothing moves) and the defeat effects drawn are read back.
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const out: { cart: ReturnType<typeof d.carts>[number]; enemies: ReturnType<typeof d.enemies>; lives: number; drawn: ReturnType<typeof d.defeatsDrawn> | null }[] = [];
    for (let n = 0; n < 300 && d.carts()[0]!.phase !== 'stopped'; n++) {
      const alive = d.enemies().filter((e) => e.alive).length;
      d.step(1);
      let drawn = null;
      if (d.enemies().filter((e) => e.alive).length < alive) {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
        drawn = d.defeatsDrawn();
      }
      out.push({ cart: d.carts()[0]!, enemies: d.enemies(), lives: d.lives(), drawn });
    }
    return out;
  });
  expect(seen[seen.length - 1]!.cart.phase).toBe('stopped');
  expect(seen.every((s) => s.lives === lives)).toBe(true);
  // R1's enemies, from `src/levels/lab3c.ts` (L-062): a cactus buddy, an Alacrán and a Trompo; their boxes from their sizes, standing on their
  // feet. The cart's box is 32 px wide around its middle, from 16 px over the rail's ground (8 px under its floor) down to it.
  const size: Partial<Record<EnemyKind, { width: number; height: number }>> = { cactus: CACTUS, alacran: ENEMY, trompo: TROMPO };
  const looks: Partial<Record<EnemyKind, string>> = { cactus: 'poof0', alacran: 'hit', trompo: 'squash' };
  const overlap = (s: (typeof seen)[number], i: number) => {
    const { width, height } = size[kindAt(i)]!;
    const e = s.enemies[i]!;
    const c = s.cart;
    return c.x! < e.x + width / 2 && c.x! + CART.width > e.x - width / 2 && c.y! + CART.floorPx - CART.height < e.y && c.y! + CART.floorPx > e.y - height;
  };
  expect(LAB_3C_ENEMIES.map((_, i) => kindAt(i))).toEqual(['cactus', 'alacran', 'trompo']);
  for (let i = 0; i < LAB_3C_ENEMIES.length; i++) {
    const kind = kindAt(i);
    const k = seen.findIndex((s) => !s.enemies[i]!.alive);
    expect(k, kind).toBeGreaterThan(0);
    expect([seen[k - 1]!.enemies[i]!.alive, overlap(seen[k - 1]!, i)], kind).toEqual([true, false]);
    expect([seen[k]!.cart.phase, overlap(seen[k]!, i)], kind).toEqual(['rolling', true]);
    // It goes as a defeat effect, drawn where it was: the cactus buddy straight to the poof, the Alacrán knocked over, the Trompo squashed.
    const drawn = seen[k]!.drawn!.find((f) => f.kind === kind);
    expect(drawn?.look, kind).toBe(looks[kind]);
    expect(Math.abs(drawn!.x - seen[k]!.enemies[i]!.x), kind).toBeLessThan(1);
  }
  expect(errors).toEqual([]);
});

// GDD-ART-04: spots of his standing frame in his light fur and paw colours (not the outline, which the cart shares, nor the dark fur, near
// its rust), 1 game px across: his paws are on his frame's last two rows.
const SHEET = readSheet('poncho.png');
const FUR = ['#F1A361', '#FBDAB7', '#CD9A86', '#ECE3D9', '#C58D62'];

test('GDD-WLD-15 the cart\'s front wall is drawn over Poncho\'s feet', async ({ page }) => {
  await hopIn(page);
  // Rolled to its buffer and settled, then left to the game's own frames to draw (paused, so nothing moves).
  const stopped = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 300 && d.carts()[0]!.phase !== 'stopped'; i++) d.step(1);
    d.step(30);
    return { cart: d.carts()[0]!, s: d.state() };
  });
  expect(stopped.cart.phase).toBe('stopped');
  expect([stopped.s.grounded, stopped.s.y, stopped.s.vx]).toEqual([true, stopped.cart.y, 0]);
  await frames(page);
  const sprite = await page.evaluate(() => window.__PONCHO__!.ponchoSprite());
  const viewX = await page.evaluate(() => window.__PONCHO__!.camera().viewX);
  const scrollY = await page.evaluate(() => window.__PONCHO__!.cameraScrollY());
  // The spots of his frame within 3 px over his feet, inside the front wall's rust (which runs from 3 px over the floor to 2 px under it).
  const feet = spotsIn(SHEET, 48, 48, sprite.frame, FUR, { size: 1 })
    .map((p) => ({ x: sprite.centerX + (sprite.flipX ? -p.dx : p.dx), y: sprite.bottom - 24 + p.dy }))
    .filter((p) => p.y > stopped.s.y - 3 && p.y < stopped.s.y && p.x > stopped.cart.x! + 2 && p.x < stopped.cart.x! + stopped.cart.w! - 2);
  expect(feet.length).toBeGreaterThan(0);
  const onScreen = await clearOfButtons(page, feet.map((p) => ({ x: p.x - viewX, y: p.y - scrollY })));
  expect(onScreen.length).toBeGreaterThan(0);
  const colours = await pixelsAt(page, onScreen);
  for (const c of colours) expect(nearHex(c, '#B0562E', 12), JSON.stringify(c)).toBe(true); // the tub's rust, not his fur
});

// GDD-WLD-15: R5, its broken end over a pit, the hanging beam over it; positions from `src/levels/lab3c.ts` (L-062).
const R5 = LAB_3C_RAILS[4]!;
const R5_END = R5.x + railLength(R5);

/** The R5 bot `Poncho jumps out before the broken end` drives in the page (see there), kept on `window` so it can stop and go on. */
interface CartBot {
  seen: { phase: string; x?: number; y?: number; w?: number; h?: number }[];
  /** Steps on until the cart is back at its start or, with `dropped`, until R5's falling cart's box top is past that y. Whether it stopped for `dropped`. */
  run(dropped: number | null): boolean;
}
declare global {
  interface Window {
    /** The R5 bot of `Poncho jumps out before the broken end`, set by that test in its page. */
    cartBot?: CartBot;
  }
}

test('GDD-WLD-15 Poncho jumps out before the broken end and the cart falls', async ({ page }) => {
  const errors = await boot(page, '/?level=lab-3c');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  // From the third ofrenda, a bot in the page, by steps (L-073): it hops into R5's cart, hops the hanging beam (a full jump with its x 35 px
  // before the beam's near face) and lands back in it, then jumps with the cart's middle 20 px before the rail's end. It records each step's
  // cart, until the cart is back at its start; it stops once on the way, when the falling cart has dropped 4 px, to read the picture.
  await page.evaluate(
    ({ o, beam, end }) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.teleport(o.x, o.y - 1);
      d.step(30);
      let jumpWas = false;
      let boarded = false;
      let hopped = false;
      const bot = {
        seen: [] as { phase: string; x?: number; y?: number; w?: number; h?: number }[],
        run(dropped: number | null): boolean {
          for (let n = 0; n < 700; n++) {
            const c = d.carts()[4]!;
            const s = d.state();
            if (c.phase !== 'waiting') boarded = true;
            if (boarded && c.phase === 'waiting') return false;
            if (dropped !== null && c.phase === 'falling' && c.y! > dropped) return true;
            const middle = c.x! + 16;
            const inCart = c.phase === 'rolling' && s.grounded && s.y === c.y && Math.abs(s.x - middle) < 22;
            let input = { move: 0, jumpHeld: false };
            if (!boarded) {
              const gap = middle - s.x;
              input = { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: s.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && s.vy < 0 };
            } else if (!s.grounded) input = { move: 0, jumpHeld: jumpWas && s.vy < 0 };
            else if (inCart && !jumpWas) {
              const atBeam = !hopped && beam - s.x <= 35;
              if (atBeam) hopped = true;
              input = { move: 0, jumpHeld: atBeam || end - middle <= 20 };
            }
            jumpWas = input.jumpHeld;
            d.step(1, input);
            bot.seen.push(d.carts()[4]!);
          }
          return false;
        },
      };
      window.cartBot = bot;
    },
    { o: LAB_3C_OFRENDAS[2]!, beam: LAB_3C_BEAM.col * TILE, end: R5_END },
  );
  // The falling cart is drawn at the hook's box: the rust of its front wall in its middle, 8 px down from its top (GDD-ART-06).
  expect(await page.evaluate((y) => window.cartBot!.run(y), R5.y - CART.height + 4)).toBe(true);
  await frames(page);
  const box = await page.evaluate(() => window.__PONCHO__!.carts()[4]!);
  expect(box.phase).toBe('falling');
  const viewX = await page.evaluate(() => window.__PONCHO__!.camera().viewX);
  const scrollY = await page.evaluate(() => window.__PONCHO__!.cameraScrollY());
  const spot = await clearOfButtons(page, [{ x: box.x! + CART.width / 2 - viewX, y: box.y! + 8 - scrollY }]);
  expect(spot).toHaveLength(1);
  const [rust] = await pixelsAt(page, spot);
  expect(nearHex(rust!, '#B0562E', 12), JSON.stringify(rust)).toBe(true);
  expect(await page.evaluate(() => window.cartBot!.run(null))).toBe(false);
  const run = await page.evaluate(() => ({ seen: window.cartBot!.seen, s: window.__PONCHO__!.state() }));
  const phases = run.seen.map((c) => c.phase);
  const left = phases.indexOf('falling');
  const gone = phases.indexOf('gone');
  expect(left).toBeGreaterThan(0);
  expect(gone).toBeGreaterThan(left);
  expect(phases[phases.length - 1]).toBe('waiting');
  expect(phases.length - 1 - left).toBe(CART.returnSteps); // back at its start 2.0 s after it left the rail
  expect(phases.slice(left, gone).every((p) => p === 'falling')).toBe(true);
  // Off the rail the hook gives its box: from 16 px over the rail's ground on the step it leaves, on across every step; level while each
  // step began with its back edge short of the rail's end (its middle less than 16 px past it), then down.
  const falls = run.seen.slice(left, gone);
  expect(falls[0]).toMatchObject({ y: R5.y - CART.height, h: CART.height, w: CART.width });
  for (let i = 1; i < falls.length; i++) {
    expect(falls[i]!.x!).toBeGreaterThan(falls[i - 1]!.x!);
    const level = falls[i - 1]!.x! + CART.width / 2 - R5_END < CART.width / 2;
    if (level) expect(falls[i]!.y).toBe(R5.y - CART.height);
    else expect(falls[i]!.y!).toBeGreaterThan(falls[i - 1]!.y!);
  }
  expect(falls[falls.length - 1]!.y!).toBeGreaterThan(R5.y - CART.height);
  expect(run.seen[gone]).toEqual({ phase: 'gone' });
  // He is on the far bank.
  expect(run.s).toMatchObject({ grounded: true, y: R5.y });
  expect(run.s.x).toBeGreaterThan((LAB_3C_PIT.col1 + 1) * TILE - 6);
  expect(errors).toEqual([]);
});

test('GDD-WLD-15 the warning post is drawn before the broken end', async ({ page }) => {
  await boot(page, '/?level=lab-3c');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  const post = warningPost(R5)!;
  // Poncho put down 3 tiles before the post, clear of it; left to the game's own frames to draw (paused, so nothing moves).
  await page.evaluate(
    (p) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.teleport(p.x, p.y - 1);
      d.step(60);
    },
    { x: post.x - 3 * TILE, y: post.y },
  );
  await frames(page);
  const viewX = await page.evaluate(() => window.__PONCHO__!.camera().viewX);
  const scrollY = await page.evaluate(() => window.__PONCHO__!.cameraScrollY());
  // The lantern's lit middle, 2 x 3 px from 15 px over the ground, under the post's board: lamp amber (#F0A23A, GDD-ART-06).
  const spot = await clearOfButtons(page, [{ x: post.x - viewX, y: post.y - 13.5 - scrollY }]);
  expect(spot).toHaveLength(1);
  const [c] = await pixelsAt(page, spot);
  expect(nearHex(c!, '#F0A23A', 12), JSON.stringify(c)).toBe(true);
});

test('GDD-WLD-15 the cart is drawn tilted on the climb', async ({ page }) => {
  const errors = await boot(page, '/?level=lab-3c');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  // R2 climbs from 4 tiles across (64 px) to 8 (128 px); its wheels stand 9 px either side of its middle (`WHEEL_OFFSET`), so both are on
  // the climb while its middle is 73 to 119 px across.
  const r2 = LAB_3C_RAILS[1]!;
  const seen = await page.evaluate(
    ({ o, from, to }) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.teleport(o.x, o.y - 1);
      d.step(30);
      const level = d.carts()[0]!.angle;
      for (let n = 0; n < 300 && d.carts()[1]!.phase === 'waiting'; n++) {
        const gap = d.carts()[1]!.x! + 16 - d.state().x;
        d.step(1, { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: d.state().grounded ? !d.state().jumpWasHeld && Math.abs(gap) <= 60 : d.state().vy < 0 });
      }
      for (let n = 0; n < 300 && d.carts()[1]!.x! + 16 < from; n++) d.step(1);
      const climbing = d.carts()[1]!;
      return { level, climbing, onClimb: climbing.x! + 16 <= to };
    },
    { o: LAB_3C_OFRENDAS[0]!, from: r2.x + 64 + WHEEL_OFFSET, to: r2.x + 128 - WHEEL_OFFSET },
  );
  expect(seen.level).toBe(0); // R1's cart, standing on level rail
  expect(seen.climbing.phase).toBe('rolling');
  expect(seen.onClimb).toBe(true);
  expect(seen.climbing.angle!).toBeCloseTo(-45, 6); // its front (right) side up
  // Drawn turned: the rust of its front wall 14 px ahead of its middle in the tub's own frame, 8 px over its bottom (the middle of the rust's
  // rows), is where the tilted tub puts it, and not where a level tub at the same place would (`cartPose`).
  const pose = cartPose(r2, { phase: 'rolling', m: seen.climbing.x! + 16 - r2.x });
  const [lx, ly] = [14, pose.bottom - 8];
  const tilted = { x: pose.x + lx * Math.cos(pose.angle) - ly * Math.sin(pose.angle), y: pose.y + lx * Math.sin(pose.angle) + ly * Math.cos(pose.angle) };
  const level = { x: pose.x + lx, y: pose.y + CART.floorPx - 8 };
  await frames(page);
  const viewX = await page.evaluate(() => window.__PONCHO__!.camera().viewX);
  const scrollY = await page.evaluate(() => window.__PONCHO__!.cameraScrollY());
  const spots = await clearOfButtons(page, [tilted, level].map((p) => ({ x: p.x - viewX, y: p.y - scrollY })));
  expect(spots).toHaveLength(2);
  const [atTilted, atLevel] = await pixelsAt(page, spots);
  expect(nearHex(atTilted!, '#B0562E', 12), JSON.stringify(atTilted)).toBe(true);
  expect(nearHex(atLevel!, '#B0562E', 24), JSON.stringify(atLevel)).toBe(false);
  expect(errors).toEqual([]);
});
