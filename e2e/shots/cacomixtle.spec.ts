// Screenshots of the Cacomixtle for visual review (GDD-ENM-04, GDD-ART-06), in lab-3k: Ka dozing in its cart with Poncho near, the telegraph on a
// red frame and on a plain one, riding on each of its two frames, Kb on the climb turned with its cart, parked at the buffer, and the squash
// frame just after a stomp. Run with `npm run shots`; images land in shots/ (not committed). Where things are comes from `src/levels/lab3k.ts`
// (L-062); the game is paused and stepped in the page (L-042), and each shot asserts its state first (L-016). On a phone the level is started
// by a tap (`start`, L-045).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { TILE } from '../../src/config/tuning';
import { LAB_3K_ENEMIES, LAB_3K_FLOOR_ROW, LAB_3K_PERCH, LAB_3K_SHELF } from '../../src/levels/lab3k';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the paused frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

const KA = LAB_3K_ENEMIES[0]!;
const FLOOR_Y = LAB_3K_FLOOR_ROW * TILE;
/** On the perch, in Ka's sight, the cart passing under him; on the floor behind Ka's cart, out of its sight; on the shelf in Kb's sight, then behind its buffer. */
const PERCH_SPOT = { x: LAB_3K_PERCH.x0 + 24, y: LAB_3K_PERCH.y0 };
const BEHIND_KA = { x: KA.x + 56, y: FLOOR_Y };
const SHELF_SPOT = { x: 750, y: LAB_3K_SHELF.row * TILE };
const OFF_THE_RAIL = { x: 690, y: LAB_3K_SHELF.row * TILE };

/** Starts lab-3k the device's way (L-045), pauses it and puts Poncho down at `at`, stepped until he stands (one step: it is a teleport). */
async function open(page: Page, isMobile: boolean, at: { x: number; y: number }): Promise<void> {
  await start(page, isMobile, '/?level=lab-3k');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await page.evaluate((p) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.teleport(p.x, p.y - 1);
    d.step(2);
  }, at);
}

type Goal = { look: string; max: number; rail: number; leave?: { x: number; y: number }; cartX?: number };

/**
 * In the page: steps the paused game (each step redraws the picture) until the ringtail of rail `rail` is drawn with `look` (and, with
 * `cartX`, its cart's floor is left of that x), at most `max` steps; with `leave`, Poncho is put there the step it starts to ride. The ringtail
 * as drawn and its cart, and where it is on the 480 x 270 screen.
 */
const stepTo = (page: Page, goal: Goal) =>
  page.evaluate(
    ({ look, max, rail, leave, cartX }) => {
      const d = window.__PONCHO__!;
      const drawn = () => d.enemiesDrawn().find((e) => e.kind === 'cacomixtle' && e.rail === rail)!;
      let k = 0;
      let reached = drawn().look === look && (cartX === undefined || (d.carts()[rail]!.x ?? 0) + 16 < cartX);
      while (k < max && !reached) {
        d.step(1);
        // Ka and Kb are the level's first two enemies: the place in its list is the rail's.
        if (leave && d.enemies()[rail]!.ride!.phase === 'riding') d.teleport(leave.x, leave.y - 1);
        k++;
        reached = drawn().look === look && (cartX === undefined || (d.carts()[rail]!.x ?? 0) + 16 < cartX);
      }
      const e = drawn();
      const cam = d.camera();
      return { reached, k, e, cart: d.carts()[rail]!, p: d.state(), lives: d.lives(), screen: { x: e.x - cam.viewX, y: e.y - cam.viewY } };
    },
    goal,
  );

/** In view: the ringtail's feet on the 480 x 270 screen, with some room. */
const inView = (s: { x: number; y: number }) => s.x > 20 && s.x < 460 && s.y > 40 && s.y < 260;

test('GDD-ENM-04 cacomixtle: dozing in its cart, Poncho near behind it', async ({ page, isMobile }, info) => {
  await open(page, isMobile, BEHIND_KA);
  const r = await stepTo(page, { look: 'doze', max: 5, rail: 0 });
  expect(r.reached).toBe(true);
  expect(r.e).toMatchObject({ look: 'doze', flip: true, red: false });
  expect(r.cart.phase).toBe('waiting');
  expect(r.p.x).toBeGreaterThan(KA.x); // behind it: it never wakes
  expect(inView(r.screen)).toBe(true);
  expect(Math.abs(r.p.x - KA.x)).toBeLessThan(120);
  await shot(page, info, 'cacomixtle-doze');
});

test('GDD-ENM-04 cacomixtle: the telegraph on a red frame', async ({ page, isMobile }, info) => {
  await open(page, isMobile, PERCH_SPOT);
  const r = await stepTo(page, { look: 'standRed', max: 40, rail: 0 });
  expect(r.reached).toBe(true);
  expect(r.e).toMatchObject({ look: 'standRed', red: true, flip: true });
  expect(r.cart.phase).toBe('waiting'); // the cart is still for the telegraph
  expect(r.lives).toBe(7);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'cacomixtle-telegraph-red');
});

test('GDD-ENM-04 cacomixtle: the telegraph on a plain frame, standing tall with its tail up', async ({ page, isMobile }, info) => {
  await open(page, isMobile, PERCH_SPOT);
  const r = await stepTo(page, { look: 'stand', max: 40, rail: 0 });
  expect(r.reached).toBe(true);
  expect(r.e).toMatchObject({ look: 'stand', red: false });
  expect(r.cart.phase).toBe('waiting');
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'cacomixtle-telegraph');
});

test('GDD-ENM-04 cacomixtle: riding, on both of its frames', async ({ page, isMobile }, info) => {
  await open(page, isMobile, PERCH_SPOT);
  const a = await stepTo(page, { look: 'ride0', max: 120, rail: 0, cartX: KA.x - 60 });
  expect(a.reached).toBe(true);
  expect(a.cart.phase).toBe('rolling');
  expect(a.lives).toBe(7);
  expect(inView(a.screen)).toBe(true);
  await shot(page, info, 'cacomixtle-ride0');
  const b = await stepTo(page, { look: 'ride1', max: 12, rail: 0 });
  expect(b.reached).toBe(true);
  expect(b.cart.phase).toBe('rolling');
  expect(b.lives).toBe(7);
  expect(inView(b.screen)).toBe(true);
  await shot(page, info, 'cacomixtle-ride1');
});

test('GDD-ENM-04 cacomixtle: Kb on the climb, turned with its cart', async ({ page, isMobile }, info) => {
  await open(page, isMobile, SHELF_SPOT);
  const r = await stepTo(page, { look: 'ride0', max: 200, rail: 1, leave: OFF_THE_RAIL, cartX: 868 });
  expect(r.reached).toBe(true);
  expect(r.cart.phase).toBe('rolling');
  // On the two-tile climb: turned 45 degrees with its cart (clockwise, the rail rolls left).
  expect(r.e.rotation).toBeCloseTo(Math.PI / 4, 6);
  expect(r.cart.angle).toBeCloseTo(45, 6);
  expect(r.lives).toBe(7);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'cacomixtle-climb');
});

test('GDD-ENM-04 cacomixtle: parked at the buffer, peeking over the rim', async ({ page, isMobile }, info) => {
  await open(page, isMobile, PERCH_SPOT);
  const r = await stepTo(page, { look: 'parked', max: 400, rail: 0 });
  expect(r.reached).toBe(true);
  expect(r.cart.phase).toBe('stopped');
  expect(r.lives).toBe(7);
  expect(r.p.y).toBe(LAB_3K_PERCH.y0); // he is on the perch, the cart passed under him
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'cacomixtle-parked');
});

test('GDD-ENM-04 cacomixtle: the squash frame just after a stomp', async ({ page, isMobile }, info) => {
  await open(page, isMobile, { x: KA.x - 4, y: KA.y - 14 - 12 });
  const r = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let k = 0;
    while (k < 40 && d.enemies()[0]!.alive) {
      d.step(1);
      k++;
    }
    d.step(1); // a step on: he is bouncing, the squash is drawn where it stood
    return { k, alive: d.enemies()[0]!.alive, vy: d.state().vy, lives: d.lives(), cart: d.carts()[0]!.phase };
  });
  expect(r.alive).toBe(false);
  expect(r.vy).toBeLessThan(0);
  expect(r.lives).toBe(7);
  expect(r.cart).toBe('waiting');
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  const fx = await page.evaluate(() => window.__PONCHO__!.defeatsDrawn());
  expect(fx).toHaveLength(1);
  expect(fx[0]).toMatchObject({ kind: 'cacomixtle', look: 'squash', x: KA.x });
  await shot(page, info, 'cacomixtle-squash');
});
