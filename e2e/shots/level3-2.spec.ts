// Screenshots of level 3-2 "La Mina" for visual review (GDD-WLD-17, GDD-WLD-15, GDD-ENM-04, GDD-UI-01, GDD-ART-06). Run with
// `npm run shots`; images land in shots/ (not committed). Where things are comes from `src/levels/level3-2.ts` (L-062). The level is
// started the device's way and cart A is ridden first from the spawn, which takes its five hilos in play (L-045), but for the start; then
// Poncho is put on solid ground a few tiles before each place and the real inputs run step by step in the paused game (L-042) until the
// moment it shows, which is asserted before the shot (L-016).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CART, TILE } from '../../src/config/tuning';
import { LEVEL_3_2, LEVEL_3_2_BEAMS, LEVEL_3_2_CUTTING_F, LEVEL_3_2_ISLAND, LEVEL_3_2_LEDGES, LEVEL_3_2_PEN, LEVEL_3_2_PILLAR, LEVEL_3_2_PIT_D, LEVEL_3_2_RAIL, LEVEL_3_2_RIB, LEVEL_3_2_SEAT, LEVEL_3_2_SUNKEN } from '../../src/levels/level3-2';
import { railLength, warningPost } from '../../src/sim/cart';
import { kindOf } from '../../src/sim/enemy';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the paused frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

const L = LEVEL_3_2;
const mid = (col: number) => col * TILE + TILE / 2;
const Y = (row: number) => row * TILE;
/** The rails by letter, in the level's order: a cart's place in `carts()` is its rail's. */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'K1', 'K2', 'K3'] as const;
type Letter = (typeof LETTERS)[number];
const cartOf = (letter: Letter) => LETTERS.indexOf(letter);
const endOf = (letter: Letter) => LEVEL_3_2_RAIL[letter].x + railLength(LEVEL_3_2_RAIL[letter]);
/** The place in the level's list (L-015) of the enemy of `kind` that starts in column `col`. */
const enemyAt = (kind: 'alacran' | 'armadillo', col: number): number => L.enemies.findIndex((e) => kindOf(e) === kind && Math.floor(e.x / TILE) === col);
const PEN_BALL = enemyAt('armadillo', 126);
const GALLERY = [enemyAt('alacran', 149), enemyAt('armadillo', 153), enemyAt('alacran', 157)];

/** Starts 3-2 the device's way (L-045) and pauses it, Poncho standing at the spawn. */
async function open(page: Page, isMobile: boolean): Promise<void> {
  await start(page, isMobile, '/?level=3-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
  });
}

/** From the spawn, right held until cart A has stood at its buffer 10 steps: the first ride, which takes the five hilos on its way. */
async function rideA(page: Page): Promise<void> {
  const taken = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 300 && d.carts()[0]!.phase !== 'stopped'; i++) d.step(1, { move: 1, jumpHeld: false });
    d.step(10);
    return d.hilos().taken;
  });
  expect(taken).toBe(5);
}

/** Puts Poncho 1 px over the floor at (x, feet y) (a teleport onto solid ground) and steps until he stands there. */
async function standAt(page: Page, x: number, y: number): Promise<void> {
  const grounded = await page.evaluate(
    ([px, py]) => {
      const d = window.__PONCHO__!;
      d.teleport(px!, py! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      return d.state().grounded;
    },
    [x, y],
  );
  expect(grounded).toBe(true);
}

/**
 * The hop into cart `i` (as lab-3c's bot and `hopInto` of `level3-2.drive.ts`): he walks towards its middle and, 20 to 60 px from it, jumps
 * (held while rising); done when it rolls with him on its floor (at most 200 steps).
 */
const hopIn = (page: Page, i: number) =>
  page.evaluate((k) => {
    const d = window.__PONCHO__!;
    let jumpWas = false;
    for (let n = 0; n < 200; n++) {
      const c = d.carts()[k]!;
      const s = d.state();
      if (c.phase !== 'waiting' && s.grounded && Math.abs(s.y - c.y!) < 1e-6) return true;
      const gap = c.x! + 16 - s.x;
      const jump: boolean = s.grounded ? !jumpWas && !s.jumpWasHeld && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && s.vy < 0;
      jumpWas = jump;
      d.step(1, { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: jump });
    }
    return false;
  }, i);

/** Riding, nothing held, until his middle is at or past level x `x` (at most 400 steps). */
const rideTo = (page: Page, x: number) =>
  page.evaluate((to) => {
    const d = window.__PONCHO__!;
    for (let n = 0; n < 400 && d.state().x < to; n++) d.step(1);
  }, x);

/** Riding, nothing held until his middle is at or past `x`; then a plain full jump (held while he rises), until `stop` holds or 200 steps. */
const jumpOut = (page: Page, x: number, stop: 'landed' | number) =>
  page.evaluate(
    ([from, until]) => {
      const d = window.__PONCHO__!;
      for (let n = 0; n < 400 && d.state().x < from; n++) d.step(1);
      let air = false;
      for (let n = 0; n < 200; n++) {
        const s = d.state();
        d.step(1, { move: 0, jumpHeld: n === 0 || (!s.grounded && s.vy < 0) });
        air ||= !d.state().grounded;
        if (until === 'landed' ? air && d.state().grounded : air && d.state().x >= until) break;
      }
    },
    [x, stop] as const,
  );

/** What the screen shows: the camera, Poncho, the carts, the enemies, lives and phase. */
const view = (page: Page) => page.evaluate(() => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state(), carts: window.__PONCHO__!.carts(), enemies: window.__PONCHO__!.enemies(), lives: window.__PONCHO__!.lives(), phase: window.__PONCHO__!.phase() }));
type View = Awaited<ReturnType<typeof view>>;
/** Whether level point (x, y) is on the screen. */
const onScreen = (v: View, x: number, y: number) => x >= v.cam.scrollX && x < v.cam.scrollX + 480 && y >= v.cam.scrollY && y < v.cam.scrollY + 270;
/** Standing in cart `letter` (its floor under his feet, his box over it), as the shots read it. */
const inCart = (v: View, letter: Letter) => {
  const c = v.carts[cartOf(letter)]!;
  return c.phase !== 'falling' && c.phase !== 'gone' && v.s.grounded && Math.abs(v.s.y - c.y!) < 1e-6 && Math.abs(v.s.x - (c.x! + CART.width / 2)) < CART.width / 2 + 6;
};

test('GDD-WLD-17 3-2: the start, on the step over the upper gallery, cart A below', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await page.evaluate(() => window.__PONCHO__!.step(13));
  const v = await view(page);
  expect(v.s).toMatchObject({ x: L.spawn.x, y: L.spawn.y, grounded: true });
  expect(v.carts[cartOf('A')]!.phase).toBe('waiting');
  expect(onScreen(v, v.carts[cartOf('A')]!.x!, v.carts[cartOf('A')]!.y!)).toBe(true);
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(0);
  await shot(page, info, 'level3-2-start');
});

test('GDD-WLD-15 3-2: riding cart A to its buffer', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  // Right held from the spawn: he walks off the step into A, and rides it to the middle of its run.
  await page.evaluate((x) => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 300 && !(d.carts()[0]!.phase === 'rolling' && d.state().x >= x); i++) d.step(1, { move: 1, jumpHeld: false });
  }, mid(15));
  const v = await view(page);
  expect(v.carts[cartOf('A')]!.phase).toBe('rolling');
  expect(inCart(v, 'A')).toBe(true);
  await shot(page, info, 'level3-2-cart-a');
});

test('GDD-WLD-15 3-2: riding cart B down the ramp', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // From A's buffer, the walk on and the hop into B; riding until it is tilted on the ramp.
  expect(await hopIn(page, cartOf('B'))).toBe(true);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 300 && !(d.carts()[1]!.angle! > 20); i++) d.step(1);
  });
  const v = await view(page);
  expect(v.carts[cartOf('B')]).toMatchObject({ phase: 'rolling' });
  expect(v.carts[cartOf('B')]!.angle!).toBeGreaterThan(20);
  expect(v.s.grounded).toBe(true);
  await shot(page, info, 'level3-2-ramp-b');
});

test('GDD-WLD-15 3-2: riding cart C, its lit post and torn end ahead over the sunken floor', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // On the main gallery's floor before C (column 44), the hop in, riding to 2 tiles before the post (column 54).
  await standAt(page, mid(44), Y(13));
  expect(await hopIn(page, cartOf('C'))).toBe(true);
  const post = warningPost(LEVEL_3_2_RAIL.C)!;
  await rideTo(page, post.x - 2 * TILE);
  const v = await view(page);
  expect(inCart(v, 'C')).toBe(true);
  expect(onScreen(v, post.x, post.y - 8)).toBe(true);
  expect(onScreen(v, endOf('C'), LEVEL_3_2_RAIL.C.y - 4)).toBe(true);
  expect(onScreen(v, (LEVEL_3_2_SUNKEN.col1 + 1) * TILE - 2, Y(LEVEL_3_2_SUNKEN.row) + 2)).toBe(true);
  await shot(page, info, 'level3-2-rail-c');
});

test('GDD-WLD-15 3-2: riding cart D, pit D ahead', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // On the bank past the first ofrenda (column 66), the hop in, riding to 2 tiles before the post (column 76).
  await standAt(page, mid(66), Y(13));
  expect(await hopIn(page, cartOf('D'))).toBe(true);
  const post = warningPost(LEVEL_3_2_RAIL.D)!;
  await rideTo(page, post.x - 2 * TILE);
  const v = await view(page);
  expect(inCart(v, 'D')).toBe(true);
  expect(onScreen(v, post.x, post.y - 8)).toBe(true);
  expect(onScreen(v, (LEVEL_3_2_PIT_D.col1 + 1) * TILE - 2, Y(13) + 2)).toBe(true);
  await shot(page, info, 'level3-2-rail-d');
});

test('GDD-WLD-15 3-2: riding cart E, the hanging beam ahead', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // On the bank past pit D (column 86), the hop in, riding to 4 tiles before the beam's face.
  await standAt(page, mid(86), Y(13));
  expect(await hopIn(page, cartOf('E'))).toBe(true);
  const face = LEVEL_3_2_BEAMS.E.col * TILE;
  await rideTo(page, face - 4 * TILE);
  const v = await view(page);
  expect(inCart(v, 'E')).toBe(true);
  expect(onScreen(v, face + 8, Y(LEVEL_3_2_BEAMS.E.row) + 8)).toBe(true);
  await shot(page, info, 'level3-2-beam');
});

test('GDD-WLD-15 3-2: stopped at the rib, walking under it', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // The ride on E with the hop over the beam (a plain jump 40 px before its face, back in the cart); he rides on until the rib stops him,
  // then walks right under it.
  await standAt(page, mid(86), Y(13));
  expect(await hopIn(page, cartOf('E'))).toBe(true);
  await jumpOut(page, LEVEL_3_2_BEAMS.E.col * TILE - 40, 'landed');
  expect(inCart(await view(page), 'E')).toBe(true);
  await page.evaluate((x) => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 300 && d.state().y !== 208; i++) d.step(1);
    for (let i = 0; i < 300 && d.state().x < x; i++) d.step(1, { move: 1, jumpHeld: false });
  }, mid(LEVEL_3_2_RIB.col0 + 1));
  const v = await view(page);
  expect(v.s).toMatchObject({ grounded: true, y: Y(13) });
  expect(Math.floor(v.s.x / TILE)).toBeGreaterThanOrEqual(LEVEL_3_2_RIB.col0);
  expect(Math.floor(v.s.x / TILE)).toBeLessThanOrEqual(LEVEL_3_2_RIB.col1);
  expect(v.lives).toBe(7);
  await shot(page, info, 'level3-2-rib');
});

/** From the floor before the seat (column 112), a walk to its wall and a full jump onto it; he stands still there. */
async function ontoSeat(page: Page): Promise<void> {
  await standAt(page, mid(112), Y(13));
  const on = await page.evaluate((face) => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 120 && d.state().x < face - 6 - 1e-6; i++) d.step(1, { move: 1, jumpHeld: false });
    let air = false;
    for (let i = 0; i < 120 && !(air && d.state().grounded); i++) {
      d.step(1, { move: 1, jumpHeld: i === 0 || d.state().vy < 0 });
      air ||= !d.state().grounded;
    }
    for (let i = 0; i < 30 && d.state().vx !== 0; i++) d.step(1);
    return d.state();
  }, LEVEL_3_2_SEAT.col0 * TILE);
  expect(on).toMatchObject({ grounded: true, y: Y(LEVEL_3_2_SEAT.row) });
}

test('GDD-ENM-04 3-2: on the seat, the Armadillo walking in the pen', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  await ontoSeat(page);
  // Until it walks toward him, 3 tiles or more off.
  await page.evaluate(
    ([i, edge]) => {
      const d = window.__PONCHO__!;
      for (let n = 0; n < 1200 && !(d.enemies()[i!]!.dir < 0 && d.enemies()[i!]!.x - edge! >= 48 && d.enemies()[i!]!.x - edge! < 64); n++) d.step(1);
    },
    [PEN_BALL, (LEVEL_3_2_SEAT.col1 + 1) * TILE],
  );
  const v = await view(page);
  expect(v.s.y).toBe(Y(LEVEL_3_2_SEAT.row));
  expect(v.enemies[PEN_BALL]).toMatchObject({ alive: true, phase: 'walk', dir: -1 });
  expect(onScreen(v, v.enemies[PEN_BALL]!.x, v.enemies[PEN_BALL]!.y - 6)).toBe(true);
  await shot(page, info, 'level3-2-pen');
});

test('GDD-ENM-04 3-2: dropped into the pen, the ball rolling at him', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  await ontoSeat(page);
  // The careful read (`CAREFUL_READ`: it walks toward him, its middle 4 tiles or more from the seat's edge), the walk off the seat, and steps
  // until it has rolled 6 steps.
  const rolled = await page.evaluate(
    ([i, edge, floor]) => {
      const d = window.__PONCHO__!;
      for (let n = 0; n < 1200 && !(d.enemies()[i!]!.phase === 'walk' && d.enemies()[i!]!.dir < 0 && d.enemies()[i!]!.x - edge! >= 64); n++) d.step(1);
      for (let n = 0; n < 60 && !(d.state().grounded && d.state().y === floor); n++) d.step(1, { move: 1, jumpHeld: false });
      let rolls = 0;
      for (let n = 0; n < 120 && rolls < 6; n++) {
        d.step(1);
        if (d.enemies()[i!]!.phase === 'roll') rolls++;
      }
      return rolls;
    },
    [PEN_BALL, (LEVEL_3_2_SEAT.col1 + 1) * TILE, Y(LEVEL_3_2_PEN.row)],
  );
  expect(rolled).toBe(6);
  const v = await view(page);
  expect(v.s.y).toBe(Y(LEVEL_3_2_PEN.row));
  expect(v.enemies[PEN_BALL]).toMatchObject({ alive: true, phase: 'roll' });
  expect(v.enemies[PEN_BALL]!.x).toBeGreaterThan(v.s.x);
  expect(v.lives).toBe(7);
  await shot(page, info, 'level3-2-pen-roll');
});

test('GDD-WLD-17 3-2: on the pillar between the hops, under the low roof', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  await standAt(page, mid(LEVEL_3_2_PILLAR.col0 + 1), Y(LEVEL_3_2_PILLAR.row));
  await page.evaluate(() => window.__PONCHO__!.step(10));
  const v = await view(page);
  expect(v.s).toMatchObject({ grounded: true, y: Y(LEVEL_3_2_PILLAR.row) });
  expect(onScreen(v, mid(LEVEL_3_2_ISLAND.col0), Y(LEVEL_3_2_ISLAND.row) + 2)).toBe(true);
  await shot(page, info, 'level3-2-hops');
});

test('GDD-WLD-15 3-2: riding cart F through the gallery, an enemy ahead', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // On the island, the hop into F, riding until one of the gallery's walkers is alive 2 to 6 tiles ahead on screen.
  await standAt(page, mid(LEVEL_3_2_ISLAND.col0), Y(LEVEL_3_2_ISLAND.row));
  expect(await hopIn(page, cartOf('F'))).toBe(true);
  const ahead = await page.evaluate((ks) => {
    const d = window.__PONCHO__!;
    const near = () => ks.find((k) => d.enemies()[k]!.alive && d.enemies()[k]!.x - d.state().x > 32 && d.enemies()[k]!.x - d.state().x < 96);
    for (let n = 0; n < 300 && near() === undefined; n++) d.step(1);
    return near() ?? -1;
  }, GALLERY);
  expect(ahead).toBeGreaterThanOrEqual(0);
  const v = await view(page);
  expect(inCart(v, 'F')).toBe(true);
  expect(onScreen(v, v.enemies[ahead]!.x, v.enemies[ahead]!.y - 4)).toBe(true);
  await shot(page, info, 'level3-2-rail-f');
});

test('GDD-WLD-17 3-2: the jump from cart F to the ledge, the spikes below', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  await standAt(page, mid(LEVEL_3_2_ISLAND.col0), Y(LEVEL_3_2_ISLAND.row));
  expect(await hopIn(page, cartOf('F'))).toBe(true);
  // The plain jump at x 2625 (RIDE_TEN), shot in the air over the ledge's lip.
  await jumpOut(page, 2625, LEVEL_3_2_LEDGES.F.col0 * TILE + 4);
  const v = await view(page);
  expect(v.s.grounded).toBe(false);
  expect(v.phase).toBe('playing');
  expect(onScreen(v, L.spikes[1]!.col * TILE + 8, Y(L.spikes[1]!.row) + 8)).toBe(true);
  expect(onScreen(v, (LEVEL_3_2_CUTTING_F.col0 + 1) * TILE, Y(LEVEL_3_2_CUTTING_F.row) + 2)).toBe(true);
  await shot(page, info, 'level3-2-ledge');
});

test('GDD-WLD-15 3-2: riding K1 on its trestle', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // At the third ofrenda, the hop into K1, riding until his middle is over its trestle pit (columns 188 to 190).
  await standAt(page, L.ofrendas[2]!.x, L.ofrendas[2]!.y);
  expect(await hopIn(page, cartOf('K1'))).toBe(true);
  await rideTo(page, mid(189));
  const v = await view(page);
  expect(inCart(v, 'K1')).toBe(true);
  await shot(page, info, 'level3-2-k1');
});

/** At the third ofrenda, the hop into K1 and its jump 30 px before its end into K2 (RIDE_KETSU); he stands in K2. */
async function intoK2(page: Page): Promise<void> {
  await standAt(page, L.ofrendas[2]!.x, L.ofrendas[2]!.y);
  expect(await hopIn(page, cartOf('K1'))).toBe(true);
  await jumpOut(page, endOf('K1') - 30, 'landed');
  expect(inCart(await view(page), 'K2')).toBe(true);
}

test("GDD-WLD-15 3-2: riding K2, its hanging beam ahead", async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  await intoK2(page);
  const face = LEVEL_3_2_BEAMS.K2.col * TILE;
  await rideTo(page, face - 4 * TILE);
  const v = await view(page);
  expect(inCart(v, 'K2')).toBe(true);
  expect(onScreen(v, face + 8, Y(LEVEL_3_2_BEAMS.K2.row) + 8)).toBe(true);
  await shot(page, info, 'level3-2-k2-beam');
});

/** Into K2, over its beam 40 px before its face, out 20 px before its end into K3 (RIDE_KETSU); he stands in K3. */
async function intoK3(page: Page): Promise<void> {
  await intoK2(page);
  await jumpOut(page, LEVEL_3_2_BEAMS.K2.col * TILE - 40, 'landed');
  expect(inCart(await view(page), 'K2')).toBe(true);
  await jumpOut(page, endOf('K2') - 20, 'landed');
  expect(inCart(await view(page), 'K3')).toBe(true);
}

test('GDD-WLD-17 3-2: the jump from K3 to the ledge, the exit ahead', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  await intoK3(page);
  // The plain jump at x 3625 (RIDE_KETSU), shot in the air over the ramp.
  await jumpOut(page, 3625, 3672);
  const v = await view(page);
  expect(v.s.grounded).toBe(false);
  expect(v.phase).toBe('playing');
  expect(onScreen(v, L.exit!.x, L.exit!.y - 8)).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  await shot(page, info, 'level3-2-k3');
});

test('GDD-WLD-17 3-2: the secret, in the cutting at K3\'s buffer with the veladora', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  await intoK3(page);
  // Staying in K3, nothing held, to its buffer.
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let n = 0; n < 300 && d.carts()[8]!.phase !== 'stopped'; n++) d.step(1);
    d.step(5);
  });
  const v = await view(page);
  expect(v.carts[cartOf('K3')]!.phase).toBe('stopped');
  expect(inCart(v, 'K3')).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  expect(onScreen(v, mid(L.veladora!.col), Y(L.veladora!.row) + 8)).toBe(true);
  await shot(page, info, 'level3-2-secret');
});

test('GDD-UI-01 3-2: two lives lost staying in cart D, the HUD over the roof', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  await rideA(page);
  // From the bank 2 columns before the first ofrenda, a walk over it; then twice the hop into D and nothing held: the life lost at its end
  // over pit D, and the respawn at the ofrenda.
  await standAt(page, mid(63), Y(13));
  const lives = await page.evaluate(
    ([to]) => {
      const d = window.__PONCHO__!;
      for (let n = 0; n < 120 && d.checkpoint().x !== to; n++) d.step(1, { move: 1, jumpHeld: false });
      return d.lives();
    },
    [L.ofrendas[0]!.x],
  );
  expect(lives).toBe(7);
  for (let k = 0; k < 2; k++) {
    expect(await hopIn(page, cartOf('D'))).toBe(true);
    await page.evaluate(() => {
      const d = window.__PONCHO__!;
      for (let n = 0; n < 300 && d.phase() === 'playing'; n++) d.step(1);
      for (let n = 0; n < 300 && d.phase() !== 'playing'; n++) d.step(1);
    });
  }
  // Past the respawn's blink (2.0 s), standing at the ofrenda.
  await page.evaluate(() => window.__PONCHO__!.step(130));
  const v = await view(page);
  expect(v).toMatchObject({ lives: 5, phase: 'playing' });
  expect(v.s).toMatchObject({ x: L.ofrendas[0]!.x, y: L.ofrendas[0]!.y, grounded: true });
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(5);
  await shot(page, info, 'level3-2-lives');
});
