import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, CART, TILE } from '../config/tuning';
import type { Bottom } from '../sim/bottoms';
import { cartFloor, type CartState, type Rail } from '../sim/cart';
import type { Enemy } from '../sim/enemy';
import type { Spike } from '../sim/hazards';
import { spawn as newPlayer } from '../sim/movement';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { cameraLimits } from '../ui/camera';
import { LAB_3C_LEVEL } from './lab3c';
import { LAB_3K_FLOOR_ROW, LAB_3K_LEVEL } from './lab3k';
import { approachCamera, camerasAlong, describeLoss, flySight, onScreen, rideRun, rideSaves, sightSweep, tileBox, viewsAlong, type Loss, type SightReport, type Takeoff } from './sightSweep';

// GDD-WLD-03's sight rule as a sweep (`src/levels/sightSweep.ts`), on small fixture levels. The screen is 480 x 270; flying right from a
// settled camera he stands 256 px from its left edge, so it shows 224 px ahead of him (GDD-UI-04).

const mid = (col: number) => col * TILE + TILE / 2;
const Y = (row: number) => row * TILE;
/**
 * A fixture level `o.width` tiles wide (40) and `rows` tall, with the glide: `solid` says which tiles are ground; he starts in column
 * `o.spawn.col` (3), on row `o.spawn.row` (14).
 */
function fixture(
  solid: (col: number, row: number) => boolean,
  enemies: readonly Enemy[] = [],
  rows = 17,
  bottoms?: readonly Bottom[],
  o: { width?: number; spawn?: { col: number; row: number }; rails?: readonly Rail[]; spikes?: readonly Spike[] } = {},
): Level {
  const spawnAt = o.spawn ?? { col: 3, row: 14 };
  return {
    world: parseTiles(Array.from({ length: rows }, (_, row) => Array.from({ length: o.width ?? 40 }, (_t, col) => (solid(col, row) ? '#' : '.')).join(''))),
    spawn: { x: mid(spawnAt.col), y: Y(spawnAt.row) },
    ofrendas: [],
    spikes: o.spikes ?? [],
    crumbles: [],
    springs: [],
    platforms: [],
    tacos: [],
    pinatas: [],
    doors: [],
    keys: [],
    fragiles: [],
    enemies,
    abilities: { glide: true },
    ...(bottoms ? { bottoms } : {}),
    ...(o.rails ? { rails: o.rails } : {}),
  };
}
/** A Murciélago that hangs still (no loop) with its middle at (the middle of column `col`, `y`). */
const bat = (col: number, y: number): Enemy => ({ x: mid(col), y, kind: 'murcielago' });
/** A take-off at a run to the right from the last eighth of column `col`, its ground at `row`. */
const takeoff = (col: number, row: number, input: Takeoff['input'], speed: Takeoff['speed'] = 'run'): Takeoff => ({ place: { col, y: Y(row) }, x: col * TILE + 14, dir: 1, speed, input, start: 0 });

/** A bank 8 rows over a flat: columns 0 to 17 at row 6, the rest at row 14. */
const bank = (col: number, row: number) => row >= (col <= 17 ? 6 : 14);
/** A 16 x 10 box (a bat's size) with its top-left corner at (x0, y0). */
const box = (x0: number, y0: number) => ({ x0, x1: x0 + 16, y0, y1: y0 + 10 });
/** A flat to column 12, an 8-tile pit, a ledge at columns 21 to 24 past it, and a ledge 5 tiles over the flat (columns 6 to 8, row 9). */
const ledges = (col: number, row: number) => (row >= 14 && (col <= 12 || (col >= 21 && col <= 24))) || (row === 9 && col >= 6 && col <= 8);
/** The places a sweep reached, as "column,row". */
const reached = (sweep: SightReport) => new Set(sweep.places.map((p) => `${p.col},${p.y / TILE}`));

describe('GDD-WLD-03 the sight sweep', () => {
  it('GDD-WLD-03 sight sweep: a bat 20 tiles ahead of a held glide is a blind loss, and the same bat 10 tiles ahead a loss in sight', () => {
    // A bank 8 rows over a flat (columns 0 to 17, row 6), the glide held off its edge: measured, his feet pass column 27's middle at y 105
    // and column 37's at y 202, so a bat that hangs still there, its middle 16 px over his feet, is in his way.
    const glide = takeoff(17, 6, 'held');
    const far = flySight(fixture(bank, [bat(37, 186)]), glide).loss;
    const near = flySight(fixture(bank, [bat(27, 89)]), glide).loss;
    expect([far?.cause, far?.blind, near?.cause, near?.blind]).toEqual(['murcielago at 37', true, 'murcielago at 27', false]);
    // The far bat comes on screen during the flight, before the loss.
    expect(far!.seenBefore).toBeGreaterThan(0);
    // On screen is any of the box inside the view; a box that only shares an edge with it is not.
    const view = { x: 100, y: 50 };
    expect([onScreen(box(580, 100), view), onScreen(box(579, 100), view)]).toEqual([false, true]);
    expect([onScreen(box(84, 100), view), onScreen(box(85, 100), view)]).toEqual([false, true]);
    expect([onScreen(box(200, 50 + BASE_HEIGHT), view), onScreen(box(200, 49 + BASE_HEIGHT), view)]).toEqual([false, true]);
    expect([onScreen(box(200, 40), view), onScreen(box(200, 41), view)]).toEqual([false, true]);
  });

  it('GDD-WLD-03 sight sweep: a pit whose lip is 16 tiles ahead, that a held stomp bounce falls into, is a blind loss', () => {
    // A flat at row 14 with a 3-tile pit at columns 32 to 34, a still bat on the line of a held jump from column 16 (measured: it stomps
    // it, and the held bounce comes down in the pit).
    const level = fixture((col, row) => row >= 14 && (col < 32 || col > 34), [bat(24, 215)]);
    const f = flySight(level, takeoff(16, 14, 'held'));
    expect(f.states.some((r) => r.stomped)).toBe(true);
    expect([f.loss?.cause, f.loss?.where, f.loss?.blind]).toEqual(['pit 32-34', tileBox(32, 14), true]);
    // The screen shows 224 px ahead of him at the take-off; the lip is 240 px ahead.
    const view = viewsAlong(level, f.from, f.states, 1)[f.loss!.takeoffStep]!;
    expect([view.x + 480 - f.states[0]!.player.x, 32 * TILE - f.from.player.x]).toEqual([224, 242]);
  });

  it('GDD-WLD-03 sight sweep: the closure reaches a ledge only a glide lands on and not one 5 tiles up', { timeout: 60000 }, () => {
    // From the start (column 3) a flat to column 12, an 8-tile pit, a ledge at columns 21 to 24 on the far side, and a ledge 5 tiles over
    // the flat (columns 6 to 8, row 9). A held glide from the lip lands on the far ledge; a plain jump does not reach it, nor any jump the
    // high one (a full jump climbs 3 tiles, GDD-WLD-03).
    const level = fixture(ledges);
    const sweep = sightSweep(level);
    const glide = reached(sweep);
    const plain = reached(sightSweep({ ...level, abilities: {} }));
    const far = ['21,14', '22,14', '23,14', '24,14'];
    const high = ['6,9', '7,9', '8,9'];
    expect([far.map((p) => glide.has(p)), high.map((p) => glide.has(p))]).toEqual([[true, true, true, true], [false, false, false]]);
    expect(far.map((p) => plain.has(p))).toEqual([false, false, false, false]);
    expect(sweep.unreached).toContainEqual({ row: 9, from: 6, to: 8 });
  });

  it('GDD-WLD-03 sight sweep: the camera is the pure camera, its bottom edge over a raised bottom where cameraLimits puts it', () => {
    // A level 34 rows tall (544 px), ground at row 28 but for a 3-tile pit (columns 20 to 22) with a raised bottom at row 32; he walks off
    // its lip. On the bank the camera's bottom edge is 2 px above the level's bottom; over the pit it rises to 2 px above the raised
    // bottom's floor line (row 32's bottom edge, y 528).
    const level = fixture((col, row) => row >= 28 && (col < 20 || col > 22), [], 34, [{ fromCol: 20, toCol: 22, row: 32 }]);
    const f = flySight(level, takeoff(18, 28, 'walk', 'stand'));
    const views = viewsAlong(level, f.from, f.states, 1);
    expect(f.loss?.cause).toBe('pit 20-22');
    // A walk-off's take-off is the step he leaves the ground, not the first step of the walk.
    expect([f.loss!.takeoffStep > 0, f.loss!.takeoffStep]).toEqual([true, f.states.findIndex((r) => !r.player.grounded)]);
    expect([views[0]!.y + BASE_HEIGHT, views[f.loss!.lossStep]!.y + BASE_HEIGHT]).toEqual([542, 526]);
    expect([cameraLimits(34 * TILE).bottom, cameraLimits(34 * TILE, 33 * TILE).bottom].map((b) => b + BASE_HEIGHT)).toEqual([542, 526]);
  });
});

/** Whether two take-offs are the same flight but for the start time. */
const sameTakeoff = (a: Takeoff, b: Takeoff) => a.place.col === b.place.col && a.place.y === b.place.y && a.x === b.x && a.dir === b.dir && a.speed === b.speed && a.input === b.input;

describe('GDD-WLD-03 GDD-ENM-04 the sight sweep with enemies that react to him', () => {
  /**
   * A bank 4 rows over a flat, 56 columns wide: columns 0 to 21 at row 10, the rest at row 14; he starts on the bank at column 3. An Armadillo
   * in a one-tile pen: on a block one tile high in column `col` (its feet 16 px over the flat, within its 24 px), a wall 3 tiles high in the
   * column after it. It turns at the block's edge and at the wall, so its idle walk is the block; startled, it rolls off the block.
   */
  const penned = (col: number) =>
    fixture((c, r) => r >= (c <= 21 ? 10 : 14) || (c === col && r === 13) || (c === col + 1 && r >= 11), [{ x: mid(col), y: Y(13), kind: 'armadillo' }], 17, undefined, { width: 56, spawn: { col: 3, row: 10 } });
  /** The held glide at a run off the bank from its last column's first eighth (x 338). */
  const glide: Takeoff = { place: { col: 21, y: Y(10) }, x: 21 * TILE + 2, dir: 1, speed: 'run', input: 'held', start: 0 };

  it('GDD-WLD-03 sight sweep: an Armadillo 72 px past a glide\'s landing is startled by it and rolls into him, and the sweep finds the loss', { timeout: 120000 }, () => {
    const level = penned(41);
    // Measured, flown without enemies: he lands at x 584 and stands at 591; the block's near edge (x 656) is 72 px past the landing, and his
    // body (12 px wide) is never within 40 px of it: so its idle walk, the block, is never within 40 px of the flight.
    const calm = flySight({ ...level, enemies: [] }, glide);
    const landing = calm.states.find((r, i) => i > 0 && r.player.grounded)!;
    expect(41 * TILE - landing.player.x).toBe(72);
    expect(41 * TILE - Math.max(...calm.states.map((r) => r.player.x + 6))).toBeGreaterThan(40);
    // Standing at 591 he is 73 px from its middle (x 664), within its 80 px: it tucks, rolls off the block and hits him.
    const sweep = sightSweep(level, [0, 120]);
    expect(sweep.reflown.some((t) => sameTakeoff(t, glide))).toBe(true);
    // At the take-off the screen shows 224 px ahead of him, to x 562: the Armadillo is off screen, a blind loss.
    expect(sweep.blind.filter((l) => sameTakeoff(l.takeoff, glide)).map((l) => [l.cause, l.takeoff.start])).toEqual([
      ['armadillo at 41', 0],
      ['armadillo at 41', 120],
    ]);
  });

  it('GDD-WLD-03 sight sweep: the same Armadillo 3 tiles further, out of his sight, takes no life and leaves the glide flown once without enemies', { timeout: 120000 }, () => {
    const level = penned(44);
    // Standing at 591 he is 121 px from its middle (x 712): it is never startled. His body never enters its reach (its block widened by its
    // 80 px and his hurtbox ends 30 px short of him) nor comes within 40 px of its block, so the glide is flown once, without enemies.
    expect(flySight(level, glide).loss).toBe(null);
    const sweep = sightSweep(level, [0, 120]);
    expect(sweep.blind.filter((l) => sameTakeoff(l.takeoff, glide))).toEqual([]);
    expect(sweep.reflown.some((t) => sameTakeoff(t, glide))).toBe(false);
  });

  it('GDD-WLD-03 sight sweep: a rolling ball that leaves its idle path reaches him long after he has landed and stood, and the flight goes on until it does', () => {
    // A shelf 4 rows over a flat (columns 0 to 12 at row 10, the rest at row 14), an Armadillo on it at column 8 (x 136); he starts on the flat
    // at column 35. A tapped jump at a run from the shelf's last column (x 206, 70 px from it): it is startled at the take-off, faces him,
    // tucks, rolls off the shelf and along the flat after him. Measured: he lands at x 270 on step 31; the ball reaches him at step 89.
    const level = fixture((c, r) => r >= (c <= 12 ? 10 : 14), [{ x: mid(8), y: Y(10), kind: 'armadillo' }], 17, undefined, { spawn: { col: 35, row: 14 } });
    const f = flySight(level, takeoff(12, 10, 'tap'));
    const landed = f.states.findIndex((r, i) => i > 0 && r.player.grounded);
    expect([landed, f.states[landed]!.player.x]).toEqual([31, 270]);
    expect([f.loss?.cause, f.loss?.lossStep]).toEqual(['armadillo at 8', 89]);
    // 58 steps after he landed, more than the 30 a flight stands; the ball has left the shelf, its idle walk.
    expect(f.loss!.where.x0).toBeGreaterThan(13 * TILE);
  });
});

/**
 * A flat at row 14, 30 columns, with the glide; a rail on it rolling left from x = 416 (column 26), 8 tiles to a buffer at x = 288, its
 * Cacomixtle at its cart's start (x 400, its floor at y = 216). He starts at column 3.
 */
const ringtail = (): Level =>
  fixture((_c, r) => r >= 14, [{ x: 400, y: 216, kind: 'cacomixtle', rail: 0 }], 17, undefined, {
    width: 30,
    rails: [{ x: 26 * TILE, y: Y(14), dir: -1, segments: [{ kind: 'level', tiles: 8 }], end: 'buffer' }],
  });
/** A standing take-off to the left from x on the flat, tapped. */
const left = (x: number): Takeoff => ({ place: { col: Math.floor(x / TILE), y: Y(14) }, x, dir: -1, speed: 'stand', input: 'tap', start: 0 });

describe('GDD-WLD-03 GDD-ENM-04 the sight sweep with a Cacomixtle', () => {
  it('GDD-WLD-03 sight sweep counts a cacomixtle as reacting: a flight that wakes it goes on until it is parked, and its reach is its sight', { timeout: 120000 }, () => {
    // He taps a jump to the right from x = 164 (36 px short of its sight's 200 px, measured) and is on the flat again in state 21, slides on into
    // its sight and wakes it in state 24 (its telegraph is states 24 to 53, its ride to the buffer long after that). A flight waits 30 steps
    // after he stands, which would end it in state 52, in the middle of the telegraph: it goes on, through the ride, until the ringtail is
    // parked, and that ends with no loss.
    const f = flySight(ringtail(), { place: { col: 10, y: Y(14) }, x: 164, dir: 1, speed: 'stand', input: 'tap', start: 0 });
    expect(f.from.enemies[0]!.ride).toEqual({ phase: 'waiting', t: 0 });
    const landed = f.states.findIndex((r, i) => i > 0 && r.player.grounded);
    const woke = f.states.findIndex((r) => r.enemies[0]!.ride!.phase !== 'waiting');
    expect([landed, woke]).toEqual([21, 24]);
    expect(f.states[landed + 31]!.enemies[0]!.ride!.phase).toBe('telegraph');
    expect(f.states.length).toBeGreaterThan(landed + 60);
    expect(f.states[f.states.length - 1]!.enemies[0]!.ride).toEqual({ phase: 'parked', t: 0 });
    // Parked it is idle again: the flight ends there, not 600 steps on.
    const parked = f.states.findIndex((r) => r.enemies[0]!.ride!.phase === 'parked');
    expect(f.states.length - parked).toBeLessThanOrEqual(2);
    expect(f.loss).toBe(null);
    // Its reach: his body (12 px wide) is within 198 px of its box (x 393 to 407) across, its sight 200 less his hurtbox's 5 px and its 7: from
    // x = 195 on. A take-off at x = 190 (body to 196) flies it again with the enemies, one at x = 186 (body to 192, 3 px short) does not.
    const sweep = sightSweep(ringtail(), [0]);
    expect(sweep.reflown.some((t) => sameTakeoff(t, left(190)))).toBe(true);
    expect(sweep.reflown.some((t) => sameTakeoff(t, left(186)))).toBe(false);
  });
});

// GDD-WLD-03, GDD-ENM-04: a cart with a live ringtail in it is not his to board (`riderRails`, as the game's `boardCarts` and `anchorInCarts`
// read it), so the sweep neither takes standing on its rolling floor for a boarding nor rides its rail. The cart emptied by the ringtail's
// defeat is his again, as in the game.
describe('GDD-WLD-03 GDD-ENM-04 the sight sweep with a ringtail\'s cart', () => {
  const lab = LAB_3K_LEVEL;
  const floorY = LAB_3K_FLOOR_ROW * TILE;
  /**
   * Lab-3k's Ka rolling (rail 0, its middle 16 px along it, x = 528) with Poncho standing on its floor 14 px behind its middle (x = 542, his
   * hurtbox clear of its 14 px box); the ringtail riding (`riding`) or defeated.
   */
  const inKa = (riding: boolean): RunState => {
    const base = startRun(lab);
    const cart: CartState = { phase: 'rolling', m: CART.width / 2 };
    const floor = cartFloor(lab.rails![0]!, cart);
    return {
      ...base,
      player: { ...newPlayer(floor.x + floor.w / 2 + 14, floor.y), grounded: true },
      carts: base.carts.map((c, k) => (k === 0 ? cart : c)),
      enemies: base.enemies.map((e, k) => (k === 0 ? (riding ? { ...e, ride: { phase: 'riding' as const, t: 0 } } : { ...e, alive: false }) : e)),
    };
  };
  /** Walking right, off the cart's back, from a standstill. */
  const walkOff = (from: RunState): Takeoff => ({ place: { col: 34, y: floorY }, x: from.player.x, dir: 1, speed: 'stand', input: 'walk', start: 0 });

  it('GDD-WLD-03 the sweep does not board a cart with a live ringtail: standing on its rolling floor is no boarding', () => {
    const from = inKa(true);
    // The state is what the test is about: on Ka's floor (8 px over the rail's ground), its cart rolling, its ringtail alive, no life lost.
    expect(from.player).toMatchObject({ y: floorY - 8, grounded: true });
    expect([from.carts[0]!.phase, from.enemies[0]!.alive, from.enemies[0]!.ride!.phase, from.lives.lives]).toEqual(['rolling', true, 'riding', 7]);
    const f = flySight(lab, walkOff(from), from);
    expect(f.boarded).toBeUndefined();
    expect(f.loss).toBeNull();
    // He did stand on the rolling cart's floor on the flight's first step: it is the live ringtail that makes it no boarding.
    expect(f.states[0]!.player).toMatchObject({ y: floorY - 8, grounded: true });
    expect(f.states[0]!.carts[0]!.phase).toBe('rolling');
  });

  it('GDD-WLD-03 the sweep boards the cart a defeated ringtail leaves empty: it is his again', () => {
    const from = inKa(false);
    expect([from.carts[0]!.phase, from.enemies[0]!.alive]).toEqual(['rolling', false]);
    const f = flySight(lab, walkOff(from), from);
    expect(f.boarded).toBe(0);
  });

  it('GDD-WLD-03 the sweep does not ride the rails of lab-3k, a ringtail in each cart: no ride, no boarding, no ride loss', { timeout: 120000 }, () => {
    // Flown over the whole of lab-3k (25 s): without the rule a flight that is carried on Ka's and Kb's rolling carts boards both rails.
    const sweep = sightSweep(lab);
    expect([...sweep.rides.keys()]).toEqual([]);
    expect(sweep.rideLosses).toEqual([]);
  });

  it('GDD-WLD-03 the sweep rides the plain rail of a level with a ringtail on another, and not the ringtail\'s', { timeout: 120000 }, () => {
    // A flat at row 14, 40 columns: rail 0 from column 36 rolling left to a buffer with its ringtail; rail 1 from column 2 rolling right, a plain
    // cart he boards from the spawn at column 3. Both rails are in the sweep's reach: a ride's flights read the calm level's carts (no enemies).
    const level = fixture((_c, r) => r >= 14, [{ x: 36 * TILE - 16, y: Y(14) - 8, kind: 'cacomixtle', rail: 0 }], 17, undefined, {
      spawn: { col: 0, row: 14 },
      rails: [{ x: 36 * TILE, y: Y(14), dir: -1, segments: [{ kind: 'level', tiles: 8 }], end: 'buffer' }, rail(2, 14, 12, 'buffer')],
    });
    const sweep = sightSweep(level, [0]);
    expect([...sweep.rides.keys()]).toEqual([1]);
  });
});

/** A level rail on the ground at row `row` from column `col`, `tiles` long, rolling right. */
const rail = (col: number, row: number, tiles: number, end: Rail['end']): Rail => ({ x: col * TILE, y: Y(row), dir: 1, segments: [{ kind: 'level', tiles }], end });
/** The losses as lines (`describeLoss`). */
const lines = (losses: readonly Loss[]) => losses.map(describeLoss);
/**
 * A flat at row 14, 40 columns, with no glide; a rail on it from column 2 rolling right whose broken end is 30 tiles from the boarding
 * place (the cart's middle at its start, column 3), at the lip of a 3-tile pit (columns 33 to 35). He starts at column 0. With `roof`, a
 * low roof 3 tiles over the ground (row 10) from column 14 over the pit: a standing rider passes under it, and a jump hits it. (From column 19
 * until the camera led in a rolling cart, GDD-UI-04: the pit's lip now comes on screen 26 steps earlier, so the roof starts 5 tiles earlier,
 * before the first step a reaction can be taken on, to be over every jump that could save him.)
 */
const brokenOverPit = (roof: boolean): Level => ({
  ...fixture((c, r) => (r >= 14 && (c < 33 || c > 35)) || (roof && r === 10 && c >= 14 && c <= 35), [], 17, undefined, { spawn: { col: 0, row: 14 }, rails: [rail(2, 14, 31, 'broken')] }),
  abilities: {},
});
/**
 * A bank 2 rows over a flat, 56 columns: columns 0 to 25 at row 12, the rest at row 14; a rail on the bank from column 21, 5 tiles to its
 * edge, broken; a spike on the flat at column 37. He starts at column `spawn` on the bank: column 17 boards the cart from behind, column 24
 * from in front, hopping back into it.
 */
const bankRail = (spawn: number) =>
  fixture((c, r) => r >= (c <= 25 ? 12 : 14), [], 17, undefined, { width: 56, spawn: { col: spawn, row: 12 }, rails: [rail(21, 12, 5, 'broken')], spikes: [{ col: 37, row: 13 }] });
/** The blind losses to the spike of jumps out of a ride: input, step and what he held. */
const spikeJumps = (sweep: SightReport) => sweep.blind.filter((l) => l.cause === 'spike 37,13' && l.takeoff.ride).map((l) => [l.takeoff.input, l.takeoff.ride!.step, l.takeoff.ride!.move]);

describe('GDD-WLD-03 GDD-WLD-15 the sight sweep of rides', () => {
  it('GDD-WLD-03 GDD-WLD-15 sight sweep: staying in to a broken end over a pit is a ride loss, and a held jump 12 tiles after the pit shows saves it', { timeout: 120000 }, () => {
    const level = brokenOverPit(false);
    const sweep = sightSweep(level, [0]);
    expect([...sweep.rides.keys()]).toEqual([0]);
    // Staying in, with nothing held and with right held, he is lost in the pit 211 steps after the boarding; its lip came on screen 135 steps
    // before (GDD-UI-04: the camera leads 64 px in a rolling cart, so the screen shows 288 px ahead of him, 64 px more than the 109 steps
    // before it led, 2.5 px a step), so he reacts 12 steps after that.
    expect(lines(sweep.rideLosses)).toEqual([
      'pit 33-35 (x 528 to 544, y 224 to 240) from column 3 y 224 x 48, right, stand, ride, rail 0 staying in with nothing held, start 0: lost at step 211, take-off step 0, on screen 135 steps before',
      'pit 33-35 (x 528 to 544, y 224 to 240) from column 3 y 224 x 48, right, stand, ride, rail 0 staying in with its way held, start 0: lost at step 211, take-off step 0, on screen 135 steps before',
    ]);
    // A ride loss is no loss in sight, and no blind one.
    expect([sweep.inSight['pit 33-35'] === undefined, sweep.blind]).toEqual([false, []]);
    expect(sweep.rideLosses.map((l) => rideSaves(level, l))).toEqual([
      ['a held jump, its way held', 'a held jump, nothing held', 'a tapped jump'],
      ['a held jump, its way held', 'a held jump, nothing held', 'a tapped jump'],
    ]);
    // The ride's places: the far bank, reached by a jump out of the cart.
    expect(reached(sweep).has('36,14')).toBe(true);
  });

  it('GDD-WLD-03 GDD-WLD-15 sight sweep: the same ride under a low roof over its last tiles is a ride loss no jump saves', { timeout: 120000 }, () => {
    const level = brokenOverPit(true);
    const sweep = sightSweep(level, [0]);
    const unsaved = sweep.rideLosses.filter((l) => rideSaves(level, l).length === 0);
    expect(lines(unsaved)).toEqual([
      'pit 33-35 (x 528 to 544, y 224 to 240) from column 3 y 224 x 48, right, stand, ride, rail 0 staying in with nothing held, start 0: lost at step 211, take-off step 0, on screen 135 steps before',
      'pit 33-35 (x 528 to 544, y 224 to 240) from column 3 y 224 x 48, right, stand, ride, rail 0 staying in with its way held, start 0: lost at step 211, take-off step 0, on screen 135 steps before',
    ]);
  });

  it('GDD-WLD-03 GDD-WLD-15 sight sweep: a jump out of a ride onto a spike off screen at the press is a blind loss with its rail and step, and on screen a loss in sight', { timeout: 120000 }, () => {
    // Boarded from behind, the camera has him at the dead zone's leading edge: the screen shows 224 px ahead. A held jump (the glide) out of
    // the cart on steps 0 to 4 lands on the spike, 237.5 to 227.5 px ahead of him after the press. GDD-UI-04: the lead grows 2 px a step as
    // the cart rolls, so the screen shows more and more ahead of him: the spike is off screen at the press on steps 0 and 2 and on screen on
    // step 4 (it was blind on all three before the camera led).
    const behind = sightSweep(bankRail(17), [0]);
    expect(spikeJumps(behind)).toEqual([
      ['held', 0, 0],
      ['held', 2, 0],
      ['held', 0, 1],
      ['held', 2, 1],
    ]);
    expect(behind.blind.filter((l) => l.takeoff.ride).every((l) => l.takeoff.ride!.rail === 0 && l.takeoffStep === l.takeoff.ride!.step)).toBe(true);
    // Boarded from in front, moving left, the camera has him at the dead zone's back edge when the cart starts to roll: the screen shows
    // 256 px ahead of him until he has passed the dead zone, and the same spike is on screen at those presses.
    const front = bankRail(24);
    const sweep = sightSweep(front, [0]);
    expect(sweep.rides.get(0)).toMatchObject({ dir: -1 });
    expect(spikeJumps(sweep)).toEqual([]);
    // The camera is stepped on from the boarding flight's own start: the jump on step 0 is a loss in sight.
    const boarding = flySight(front, sweep.rides.get(0)!);
    const camera = camerasAlong(front, boarding.camera, boarding.from, boarding.states).at(-1)!;
    const t: Takeoff = { place: { col: 22, y: Y(12) }, x: 352, dir: 1, speed: 'stand', input: 'held', start: 0, ride: { rail: 0, move: 0, step: 0 } };
    const jump = flySight(front, t, rideRun(front, 0, 0), undefined, { camera });
    expect([jump.loss?.cause, jump.loss?.blind]).toEqual(['spike 37,13', false]);
  });

  it('GDD-WLD-03 GDD-WLD-15 sight sweep: a rider run into a Murciélago at his head\'s height is a ride loss', { timeout: 120000 }, () => {
    // A flat at row 14, a buffer rail 20 tiles long from column 2; a still bat over it at column 15, its box 190 to 200: the rider's hurtbox
    // (his feet on the floor, 8 px over the rail's ground) is 185 to 215, the cart's box 208 to 224.
    const level = fixture((_c, r) => r >= 14, [bat(15, 195)], 17, undefined, { spawn: { col: 0, row: 14 }, rails: [rail(2, 14, 20, 'buffer')] });
    const sweep = sightSweep(level, [0]);
    expect(sweep.rideLosses.map((l) => [l.cause, l.takeoff.input, l.takeoff.ride])).toEqual([
      ['murcielago at 15', 'ride', { rail: 0, move: 0 }],
      ['murcielago at 15', 'ride', { rail: 0, move: 1 }],
    ]);
  });

  // The sweep of lab-3c, over 10 s, is in the sight run (`src/levels/sight.test.ts`).
});

// GDD-UI-04: in a rolling cart the camera leads 64 px, so the sweep's camera must too (it is the scene's camera, stepped along each flight).
/** Where his body is on the screen of the camera: its x less the scroll. */
const onScreenX = (x: number, c: { scrollX: number }) => x - c.scrollX;

describe('GDD-UI-04 the sight sweep with the lead in a rolling cart', () => {
  const lab = LAB_3C_LEVEL;
  /** A run with Poncho standing in lab-3c's cart `i` (`phase`) with its middle `m` px along its rail. */
  const inCart = (i: number, m: number, phase: CartState['phase'] = 'rolling'): RunState => {
    const cart: CartState = { phase, m };
    const floor = cartFloor(lab.rails![i]!, cart);
    const base = startRun(lab);
    return { ...base, player: { ...newPlayer(floor.x + floor.w / 2, floor.y), grounded: true }, carts: base.carts.map((c, k) => (k === i ? cart : c)) };
  };
  it('GDD-UI-04 a take-off from a rolling cart starts with the lead settled', () => {
    // Rolling right (rail 0, 200 px along): the lead is +64 and he is at 192 (40% of the width); rolling left (rail 3, 64 px along): -64 and 288.
    const right = inCart(0, 200);
    const back = inCart(3, 64);
    const [r, l] = [approachCamera(lab, right, 1), approachCamera(lab, back, -1)];
    expect([r.lead, onScreenX(right.player.x, r)]).toEqual([64, 192]);
    expect([l.lead, onScreenX(back.player.x, l)]).toEqual([-64, 288]);
    // A cart that is not rolling is no ride: no lead, and he is on the dead zone's leading edge, 256 and 224.
    const [wr, wl] = [approachCamera(lab, inCart(0, 200, 'waiting'), 1), approachCamera(lab, inCart(3, 64, 'waiting'), -1)];
    expect([wr.lead, onScreenX(right.player.x, wr), wl.lead, onScreenX(back.player.x, wl)]).toEqual([0, 256, 0, 224]);
    // Clamped by the level's edge, as ever: at the boarding, 16 px along rail 0, the scroll stays at 0 and he is where he stands.
    const boarding = inCart(0, 16);
    expect([approachCamera(lab, boarding, 1).scrollX, approachCamera(lab, boarding, 1).lead]).toEqual([0, 64]);
  });

  it('GDD-UI-04 a flight from a rolling cart keeps the lead on', () => {
    // On in the cart (nothing held) from the settled camera, 40 steps: the lead stays 64 and he stays at 192, the camera moving with the cart.
    const from = inCart(0, 200);
    const states: RunState[] = [];
    let r = from;
    for (let i = 0; i < 40; i++) states.push((r = stepRun(r, { move: 0, jumpHeld: false }, lab)));
    const cameras = camerasAlong(lab, approachCamera(lab, from, 1), from, states);
    expect(states.every((s) => s.carts[0]!.phase === 'rolling' && s.player.grounded)).toBe(true);
    cameras.forEach((c, k) => {
      expect(c.lead, `step ${k}`).toBe(64);
      expect(onScreenX(states[k]!.player.x, c), `step ${k}`).toBe(192);
    });
    expect(cameras[39]!.scrollX).toBeGreaterThan(approachCamera(lab, from, 1).scrollX + 90);
  });
});
