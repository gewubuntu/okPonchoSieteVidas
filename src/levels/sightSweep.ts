// GDD-WLD-03's sight rule as a probe (L-014): fly the flights a level invites and find each one that loses a life to something that was
// off screen at its take-off. Test support for the level tests, pure, no Phaser: the camera is the pure camera of `src/ui/camera.ts`,
// stepped along each flight as the scene steps it.
import { ARMADILLO, BASE_HEIGHT, BASE_WIDTH, CART, HITBOX, HURTBOX, PALOMA, RUN, TILE, TLACUACHE, ZOPILOTE } from '../config/tuning';
import { bottomRowAt } from '../sim/bottoms';
import { cartFloor, floorUnder, rollCarts, type CartState } from '../sim/cart';
import { standsOnPlatform } from '../sim/platform';
import { enemyBox, harmlessFromBelow, kindOf, touchesEnemy, type Box, type EnemyKind, type EnemyState } from '../sim/enemy';
import { touchesSpike } from '../sim/hazards';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { isInPit, startRun, stepRun, type Level, type Point, type RunState } from '../sim/run';
import { cameraLimitsAt, followCamera, placeCameraY, stepCameraY, type CameraY } from '../ui/camera';

/** What the screen shows: the level point at its top-left corner. The view is BASE_WIDTH x BASE_HEIGHT (480 x 270). */
export interface View {
  readonly x: number;
  readonly y: number;
}

/** The camera of a flight as the scene keeps it: the scroll left and right (`followCamera`) and the camera up and down (`stepCameraY`). */
export interface SightCamera {
  readonly scrollX: number;
  readonly y: CameraY;
}

/**
 * GDD-UI-04: the camera at a take-off at level x `x` with his feet at `feetY`, settled as after an approach of 3 tiles in the flight's
 * direction `dir` on level ground. Left and right: `followCamera` from the scroll that has him at the screen's middle 3 tiles back (where a
 * cut puts him) to the take-off; 3 tiles are longer than the dead zone (32 px), so he stands on its leading edge, 256 px from the screen's
 * left edge going right and 224 px going left, or the scroll stops at the level's edge. Up and down: `placeCameraY` with the limits of his
 * column (his feet 136 px down, the middle of the ground band, where a walk on level ground leaves the camera).
 */
export function approachCamera(level: Level, x: number, feetY: number, dir: 1 | -1): SightCamera {
  const back = x - dir * 3 * TILE;
  return { scrollX: followCamera(back - BASE_WIDTH / 2, x, level.world.width * TILE), y: placeCameraY(feetY, cameraLimitsAt(level, x)) };
}

/** GDD-UI-04: the camera after the run's step from `before` to `after`, as the scene follows the body (`followCamera`, `stepCameraY`). */
export function stepSightCamera(camera: SightCamera, before: RunState, after: RunState, level: Level): SightCamera {
  return { scrollX: followCamera(camera.scrollX, after.player.x, level.world.width * TILE), y: stepCameraY(camera.y, before, after, level).camera };
}

export const viewOf = (camera: SightCamera): View => ({ x: camera.scrollX, y: camera.y.y });

/** Whether any of `box` is inside the view: a box that only shares an edge with it is not. */
export const onScreen = (box: Box, view: View): boolean => box.x0 < view.x + BASE_WIDTH && box.x1 > view.x && box.y0 < view.y + BASE_HEIGHT && box.y1 > view.y;

/**
 * The view after each of `states`, a flight in direction `dir` from `from`: `views[k]` is the screen after the step that gave `states[k]`,
 * the camera starting settled at `from` (`approachCamera`).
 */
export function viewsAlong(level: Level, from: RunState, states: readonly RunState[], dir: 1 | -1): View[] {
  return camerasAlong(level, approachCamera(level, from.player.x, from.player.y, dir), from, states).map(viewOf);
}

/** The camera after each of `states`, stepped from `camera` at `from`: one continuous run. */
export function camerasAlong(level: Level, camera: SightCamera, from: RunState, states: readonly RunState[]): SightCamera[] {
  let before = from;
  return states.map((r) => {
    camera = stepSightCamera(camera, before, r, level);
    before = r;
    return camera;
  });
}

/** The tile (`col`, `row`) as a box. */
export const tileBox = (col: number, row: number): Box => ({ x0: col * TILE, x1: (col + 1) * TILE, y0: row * TILE, y1: (row + 1) * TILE });

// ---------------------------------------------------------------------------------------------------------------------------------
// The flights.

/**
 * The inputs a take-off is flown with, the way the take-off's direction is held all along: `walk` walks off or on with no jump (90 steps,
 * or on to the landing once he is in the air); `held` presses jump and holds it to the landing; `tap` releases it after 4 steps; `again`
 * holds it, lets go at the top of the jump and presses it again 10 steps later, held to the landing; `walk-glide` walks with no jump until
 * he is in the air off an edge, then holds jump to the landing (the walk-off glide). GDD-WLD-15: `ride` stays in a cart (`RideFlight`).
 */
export type SightInput = 'walk' | 'held' | 'tap' | 'again' | 'walk-glide' | 'ride';
/** The inputs flown from a place. */
export const SIGHT_INPUTS: readonly SightInput[] = ['walk', 'held', 'tap', 'again', 'walk-glide'];
/** GDD-WLD-15: the jumps flown out of a ride. */
export const RIDE_JUMPS: readonly SightInput[] = ['held', 'tap', 'again'];

/** GDD-ENM-04: the start times, 6 phases of the enemies' 240-step clock (the Murciélago's loop). */
export const SIGHT_STARTS: readonly number[] = [0, 40, 80, 120, 160, 200];

/**
 * The flights' limits: `walk` and `walk-glide` walk at most `walkSteps`; a flight ends `idleSteps` after he stands, or after `maxSteps`.
 * GDD-WLD-15, GDD-MOV-03: jumps out of a ride are flown up to `coyoteSteps` past its rail's end (a jump pressed on the step the cart leaves
 * a broken end or on one of the 5 after it still jumps).
 */
export const SIGHT_FLIGHT = { walkSteps: 90, idleSteps: 30, maxSteps: 600, tapSteps: 4, againSteps: 10, coyoteSteps: 6 } as const;

/** The take-offs in a tile: its eighths 1, 3, 5 and 7. */
const EIGHTHS = [1, 3, 5, 7] as const;

/** A place he can stand: a tile column and its ground's top y (px). */
export interface Place {
  readonly col: number;
  readonly y: number;
}

/**
 * One flight: from a place, at x, the way `dir` says, from a standstill or at run speed, with an input, at a start time. A flight from a
 * ride (`ride`) starts at the boarding: its place is the cart's start (the column of its middle, the rail's ground there), x the cart's
 * middle, `dir` the way the cart rolls, its speed 'stand' (he is anchored in the cart), its start time the enemies' clock at the boarding.
 */
export interface Takeoff {
  readonly place: Place;
  readonly x: number;
  readonly dir: 1 | -1;
  readonly speed: 'stand' | 'run';
  readonly input: SightInput;
  readonly start: number;
  readonly ride?: RideFlight;
}

/**
 * GDD-WLD-15: a flight from a ride: the rail (its place in the level's list) and what he holds across all along (`move`: nothing, or the
 * way the cart rolls). Staying in (input `ride`) he holds only that; a jump out (`held`, `tap` or `again`) stays in as staying in does up to
 * the ride's step `step` and presses jump on it. `via`: the jumps (left out: none) that each landed back in the cart where staying in had
 * left it (a hanging beam takes a rider who stays in out of it): the flight stays in up to the first, jumps it, stays in from its landing
 * with that jump's `move` up to the next, and so on, and from the last landing as this flight says.
 */
export interface RideFlight {
  readonly rail: number;
  readonly move: -1 | 0 | 1;
  readonly step?: number;
  readonly via?: readonly RideJump[];
}

/** GDD-WLD-15: a jump out of a ride that landed back in its cart: pressed on the ride's step `step`, back in it on step `landed`. */
export interface RideJump {
  readonly step: number;
  readonly input: SightInput;
  readonly move: -1 | 0 | 1;
  readonly landed: number;
}

/** A flight that lost a life: to what, where it was then, and whether it was on screen at the take-off. */
export interface Loss {
  readonly takeoff: Takeoff;
  /**
   * What took the life: an enemy by its kind and the column it starts in (`murcielago at 225`), a spike by its tile (`spike 12,9`), a pit by
   * its columns (`pit 222-226`).
   */
  readonly cause: string;
  /** Where it was at the loss: an enemy's box, the spike's tile, the pit's near lip (its first column at the bank's ground row). */
  readonly where: Box;
  /**
   * The state of the take-off (the step jump is pressed, out of a ride too; the step he leaves the ground for `walk` and `walk-glide`; the
   * first step of the ride for staying in) and of the loss.
   */
  readonly takeoffStep: number;
  readonly lossStep: number;
  /** How many steps before the loss it first came on screen, from the take-off on (0: only at the loss; null: never). */
  readonly seenBefore: number | null;
  /** Whether it was off screen at the take-off. */
  readonly blind: boolean;
}

export interface SightFlight {
  readonly from: RunState;
  /** The camera at `from`. */
  readonly camera: SightCamera;
  readonly states: readonly RunState[];
  /** The places he stood on before any life was lost. */
  readonly stood: readonly Place[];
  readonly loss: Loss | null;
  /** GDD-WLD-15: the rail of the rolling cart he came down into, which ended the flight. Left out, he came down into none. */
  readonly boarded?: number;
}

/** Whether tile (`col`, `row`) is something he stands on: a solid tile, a crumbling ledge (whole) or a piñata. */
const standOn = (level: Level, col: number, row: number): boolean =>
  level.world.solidTile(col, row) || level.crumbles.some((c) => c.col === col && c.row === row) || level.pinatas.some((p) => p.col === col && p.row === row);

/** The place he stands on with his feet's middle at (x, y): the column of his middle, or the one beside it his feet are on. */
export function placeAt(level: Level, x: number, y: number): Place | undefined {
  const row = y / TILE;
  if (!Number.isInteger(row)) return undefined;
  const cols = [Math.floor(x / TILE), Math.floor((x - HITBOX.width / 2) / TILE), Math.floor((x + HITBOX.width / 2 - 0.001) / TILE)];
  const col = cols.find((c) => standOn(level, c, row));
  return col === undefined ? undefined : { col, y };
}

/** Whether he can stand with his feet's middle at (x, y): his body box in no tile he stands on, his feet on one. */
function canStand(level: Level, x: number, y: number): boolean {
  const [c0, c1] = [Math.floor((x - HITBOX.width / 2) / TILE), Math.floor((x + HITBOX.width / 2 - 0.001) / TILE)];
  const [r0, r1] = [Math.floor((y - HITBOX.height) / TILE), Math.floor((y - 0.001) / TILE)];
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (standOn(level, c, r)) return false;
  return placeAt(level, x, y) !== undefined;
}

/** The level's idle runs from its start (Poncho waiting at the spawn), kept between flights: the enemies at each start time. */
const warmRuns = new WeakMap<Level, RunState[]>();
function warmRun(level: Level, steps: number): RunState {
  let runs = warmRuns.get(level);
  if (!runs) warmRuns.set(level, (runs = [startRun(level)]));
  while (runs.length <= steps) runs.push(stepRun(runs[runs.length - 1]!, { move: 0, jumpHeld: false }, level));
  return runs[steps]!;
}

/** The run a take-off starts from: the level's enemies `start` steps into their walks and loops, Poncho standing at the take-off (as the level tests' `at`). */
export function takeoffRun(level: Level, t: Takeoff): RunState {
  const vx = t.speed === 'run' ? t.dir * RUN.maxSpeed : 0;
  const player: PlayerState = { ...spawn(t.x, t.place.y), grounded: true, vx, facing: t.dir };
  return { ...warmRun(level, t.start), player, clock: 0 };
}

/** GDD-WLD-15: where a ride on rail `rail` is boarded: the cart's middle at its start, and the place there (the rail's ground at its start). */
export function boardingAt(level: Level, rail: number): { place: Place; x: number } {
  const r = level.rails![rail]!;
  const x = r.x + r.dir * (CART.width / 2);
  return { place: { col: Math.floor(x / TILE), y: r.y }, x };
}

/**
 * GDD-WLD-15: the run a ride starts from, as on the step he lands in the cart: the level's enemies `start` steps into their walks and loops,
 * the cart rolling from its start (where it is depends only on the steps since he landed in it), Poncho anchored at its middle on its floor
 * with no speed of his own, facing the way it rolls, jump let go.
 */
export function rideRun(level: Level, rail: number, start: number): RunState {
  const r = level.rails![rail]!;
  const warm = warmRun(level, start);
  const carts: CartState[] = warm.carts.map((c, i) => (i === rail ? { phase: 'rolling', m: CART.width / 2 } : c));
  const floor = cartFloor(r, carts[rail]!);
  const player: PlayerState = { ...spawn(floor.x + floor.w / 2, floor.y), grounded: true, facing: r.dir };
  return { ...warm, player, carts, clock: 0 };
}

/** GDD-WLD-15: the cart he stands in on its floor under his feet, of those that are on their rail (`rolling` only: of those that roll), or -1. */
function cartUnder(level: Level, r: RunState, rolling: boolean): number {
  return (level.rails ?? []).findIndex((rail, i) => {
    const c = r.carts[i]!;
    const on = rolling ? c.phase === 'rolling' : c.phase !== 'falling' && c.phase !== 'gone';
    return on && standsOnPlatform(r.player, floorUnder(rail, c, r.player.x));
  });
}

/** GDD-WLD-15: the ride's steps to its rail's end: the step of the ride after which its cart has stopped at its buffer or left its broken end. */
export function rideEnd(level: Level, rail: number): number {
  let carts: CartState[] = [{ phase: 'rolling', m: CART.width / 2 }];
  for (let i = 0; i < 100000; i++) {
    carts = rollCarts([level.rails![rail]!], carts);
    if (carts[0]!.phase !== 'rolling') return i;
  }
  throw new Error(`rail ${rail} never ends`);
}

/**
 * What took the life on the step from `before` to `after`, as `stepRun` decides it: a pit, a spike, then the first enemy that touches him;
 * anything else is a crush (by a moving block), whose place is his own body.
 */
function causeOf(level: Level, before: RunState, after: RunState): { cause: string; enemy?: number; spike?: { col: number; row: number } } {
  if (isInPit(after.player, level.world, level.bottoms)) return { cause: 'pit' };
  const spike = level.spikes.find((s) => touchesSpike(after.player, s));
  if (spike) return { cause: `spike ${spike.col},${spike.row}`, spike };
  const enemy = level.enemies.findIndex((d, i) => touchesEnemy(after.player, d, after.enemies[i]!) && !harmlessFromBelow(before.player, after.player, d, after.enemies[i]!));
  if (enemy >= 0) return { cause: `${kindOf(level.enemies[enemy]!)} at ${Math.floor(level.enemies[enemy]!.x / TILE)}`, enemy };
  return { cause: 'crush' };
}

/** A pit column: no ground in its bottom row (GDD-WLD-03). */
const pitColumn = (level: Level, col: number): boolean => col >= 0 && col < level.world.width && !level.world.solidTile(col, bottomRowAt(level, col));

/**
 * The pit he was lost in at level x `x`, by its columns, and its near lip: scanning from the take-off's column towards `x`, the first pit
 * column with no crumbling ledge (a ledge is a bank in World 3, GDD-WLD-05), as a tile at the ground row of the bank before it (the first
 * tile he stands on in that column from 3 rows over the take-off's ground down). `from` is the take-off's place; for a ride's flight it is
 * the column he was in at its take-off (staying in: the step he left the cart) and the tile top under his feet there.
 */
function pitLip(level: Level, from: Place, dir: 1 | -1, x: number): { cause: string; where: Box } {
  const col = Math.floor(x / TILE);
  let [a, b] = [col, col];
  while (pitColumn(level, a - 1)) a--;
  while (pitColumn(level, b + 1)) b++;
  const open = (c: number) => pitColumn(level, c) && !level.crumbles.some((k) => k.col === c);
  const way = Math.sign(col - from.col) || dir;
  let lip = col;
  for (let c = from.col; way * (col - c) >= 0; c += way) {
    if (open(c)) {
      lip = c;
      break;
    }
  }
  const bank = lip - way;
  const top = from.y / TILE;
  let row = top;
  for (let r = Math.max(0, top - 3); r < level.world.height; r++) {
    if (standOn(level, bank, r)) {
      row = r;
      break;
    }
  }
  return { cause: `pit ${a}-${b}`, where: tileBox(lip, row) };
}

/** A player's reaction during a flight: from step `at` on he holds `input` in place of the take-off's own, until he stands. */
export interface Reaction {
  readonly at: number;
  readonly input: PlayerInput;
}

/** How a flight is flown besides its take-off: where its camera starts, the states it has already flown, and whether it rides on in a cart. */
export interface FlyOptions {
  /** The camera at `from`: by default settled at the take-off (`approachCamera`); a ride's is the one its boarding flight left. */
  readonly camera?: SightCamera;
  /** The flight's first states, already flown from `from`: it goes on from the last (a jump out of a ride branches from staying in). */
  readonly prefix?: readonly RunState[];
  /**
   * GDD-WLD-15: coming down into a rolling cart does not end the flight: he rides on in it with nothing held, so a jump that lands back in its
   * cart is not taken for a landing that saves him. Always so with a `reaction`.
   */
  readonly rideOn?: boolean;
}

/**
 * Flies one take-off on `level` from `from` (`takeoffRun` by default): the states, the places he stood on and the loss, if any. With a
 * `reaction` the flight is the same up to its step and his from there. A flight ends `SIGHT_FLIGHT.idleSteps` after he stands (on anything
 * but a rolling cart), or when he comes down into a rolling cart (it boards it, `boarded`: the ride is flown on its own), or after
 * `SIGHT_FLIGHT.maxSteps`. GDD-WLD-15: staying in a ride (input `ride`) he stands from the start, and the flight goes on while the cart
 * rolls him; standing in it once it has stopped at its buffer, with the way it rolled held he walks off it.
 */
export function flySight(level: Level, t: Takeoff, from: RunState = takeoffRun(level, t), reaction?: Reaction, o: FlyOptions = {}): SightFlight {
  const F = SIGHT_FLIGHT;
  const camera = o.camera ?? approachCamera(level, from.player.x, from.player.y, t.dir);
  const states: RunState[] = [...(o.prefix ?? [])];
  const stood: Place[] = [];
  const stay = t.input === 'ride';
  // The take-off: the step jump is pressed; staying in, the ride's first step, or the step after the landing back in the cart that `via` ends with.
  const press = t.ride?.step ?? (t.ride?.via?.at(-1)?.landed ?? -1) + 1;
  const move = t.ride ? t.ride.move : t.dir;
  const rideOn = (o.rideOn ?? false) || reaction !== undefined;
  // `rider`: he stands in a rolling cart and that is no boarding (a ride's flight, or back in a cart he rides on in, `back`).
  let [rider, back] = [t.ride !== undefined, false];
  let r = states[states.length - 1] ?? from;
  let [left, landed, top] = [-1, -1, -1];
  for (let i = states.length; i < F.maxSteps && r.phase === 'playing'; i++) {
    // An enemy he set off goes on until it is back in its idle phase, however long after he stood.
    if (landed >= 0 && i > landed + F.idleSteps && !reacting(level, r)) break;
    const walking = t.input === 'walk' || t.input === 'walk-glide';
    if (walking && left < 0 && i >= F.walkSteps) break;
    if (t.input === 'again' && top < 0 && i > press + 1 && r.player.vy >= 0) top = i;
    const jump =
      t.input === 'held' ? true
      : t.input === 'tap' ? i < press + F.tapSteps
      : t.input === 'again' ? top < 0 || i >= top + F.againSteps
      : t.input === 'walk-glide' && left >= 0;
    // Back in a cart after a jump he lets go of it: the jump was held to that landing.
    const own: PlayerInput = { move, jumpHeld: !stay && !back && i >= press && jump };
    // Standing, he lets go of everything; but a rider who stays in with the cart's way held walks off it where it stopped.
    const standing: PlayerInput = stay && cartUnder(level, r, false) >= 0 ? { move, jumpHeld: false } : { move: 0, jumpHeld: false };
    const input: PlayerInput = landed >= 0 ? standing : reaction && i >= reaction.at ? reaction.input : own;
    const before = r;
    r = stepRun(r, input, level);
    states.push(r);
    // GDD-WLD-03: reaching the exit ends the level, and the flight.
    if (r.phase === 'clear') break;
    if (r.phase !== 'playing') {
      const takeoff = walking ? Math.max(0, left) : press;
      return { from, camera, states, stood, loss: lossOf(level, t, from, states, takeoff, before, camera, stay ? Math.max(0, left) : takeoff) };
    }
    const riding = cartUnder(level, r, true);
    if (riding >= 0 && (!rider || left >= 0)) {
      // GDD-WLD-15: he came down into a rolling cart (or boarded a waiting one, which now rolls).
      if (!rideOn) return { from, camera, states, stood, loss: null, boarded: riding };
      [rider, back, left, landed] = [true, true, -1, -1];
      continue;
    }
    if (left < 0 && i >= press && !r.player.grounded) left = i;
    else if ((left >= 0 || stay || back) && landed < 0 && r.player.grounded && riding < 0) landed = i;
    if (r.player.grounded && cartUnder(level, r, false) < 0) {
      const place = placeAt(level, r.player.x, r.player.y);
      if (place) stood.push(place);
    }
  }
  return { from, camera, states, stood, loss: null };
}

/**
 * The loss that ends `states` (its last state), the take-off at `takeoffStep`, with what took it and when it was first on screen, the
 * camera stepped from `camera` at `from`. A pit's lip is scanned for from the take-off's place, or for a ride's flight from where he was on
 * step `origin`.
 */
function lossOf(level: Level, t: Takeoff, from: RunState, states: readonly RunState[], takeoffStep: number, before: RunState, camera: SightCamera, origin: number): Loss {
  const lossStep = states.length - 1;
  const after = states[lossStep]!;
  const found = causeOf(level, before, after);
  const at = states[origin]!.player;
  const scan = t.ride ? { col: Math.floor(at.x / TILE), y: Math.ceil(at.y / TILE) * TILE } : t.place;
  const pit = found.cause === 'pit' ? pitLip(level, scan, t.dir, after.player.x) : undefined;
  const boxAt = (k: number): Box =>
    found.enemy !== undefined ? enemyBox(level.enemies[found.enemy]!, states[k]!.enemies[found.enemy]!) : found.spike ? tileBox(found.spike.col, found.spike.row) : (pit?.where ?? bodyOf(states[k]!.player));
  const views = camerasAlong(level, camera, from, states).map(viewOf);
  const first = views.findIndex((v, k) => k >= takeoffStep && onScreen(boxAt(k), v));
  return {
    takeoff: t,
    cause: pit?.cause ?? found.cause,
    where: boxAt(lossStep),
    takeoffStep,
    lossStep,
    seenBefore: first < 0 ? null : lossStep - first,
    blind: !onScreen(boxAt(takeoffStep), views[takeoffStep]!),
  };
}

/**
 * Flies a take-off again on `level`, with its enemies, as the sweep flew it: from a place (`takeoffRun`), or from its ride (`rideRun`), a jump
 * out branching from staying in with the same thing held. With a `reaction` (and `rideOn`) as `flySight`. The camera is not the sweep's
 * (a ride's starts settled at the boarding), so read only whether and where a life is lost.
 */
export function flyTakeoff(level: Level, t: Takeoff, reaction?: Reaction, o: { rideOn?: boolean } = {}): SightFlight {
  if (!t.ride) return flySight(level, t, undefined, reaction, o);
  const from = rideRun(level, t.ride.rail, t.start);
  const via = t.ride.via ?? [];
  const before = staysUpTo(level, { ...t, input: 'ride', ride: { rail: t.ride.rail, move: t.ride.move } }, via, from, approachCamera(level, from.player.x, from.player.y, t.dir));
  if (before === null) throw new Error(`not a ride that lands back in its cart as ${JSON.stringify(via)} says`);
  if (t.ride.step === undefined) return flySight(level, t, from, reaction, { ...o, prefix: before });
  const stayIn: RideFlight = { rail: t.ride.rail, move: t.ride.move, ...(via.length > 0 ? { via } : {}) };
  const stay = flySight(level, { ...t, input: 'ride', ride: stayIn }, from, undefined, { prefix: before });
  return flySight(level, t, from, reaction, { ...o, prefix: stay.states.slice(0, t.ride.step) });
}

/**
 * GDD-WLD-15: the states of a ride up to the landing back in its cart of the last of the jumps `via` (none: no states), each jump branching
 * from staying in with its own `move`; null if one of them does not land back in the cart on its step. `stay` is staying in (its rail, start).
 */
function staysUpTo(level: Level, stay: Takeoff, via: readonly RideJump[], from: RunState, camera: SightCamera): readonly RunState[] | null {
  let prefix: readonly RunState[] = [];
  for (let i = 0; i < via.length; i++) {
    const v = via[i]!;
    const leg: RideFlight = { rail: stay.ride!.rail, move: v.move, ...(i > 0 ? { via: via.slice(0, i) } : {}) };
    const f = flySight(level, { ...stay, ride: leg }, from, undefined, { camera, prefix });
    if (f.loss ? f.loss.lossStep < v.step : f.states.length < v.step) return null;
    const jump = flySight(level, { ...stay, input: v.input, ride: { ...leg, step: v.step } }, from, undefined, { camera, prefix: f.states.slice(0, v.step) });
    if (jump.boarded !== leg.rail || jump.states.length - 1 !== v.landed) return null;
    prefix = jump.states;
  }
  return prefix;
}

/** GDD-WLD-03: how long after what takes the life first shows he reacts: 0.2 s. */
export const REACT_STEPS = 12;

/**
 * GDD-WLD-03, GDD-WLD-15: a rider's reactions to what would take his life if he stayed in: a jump held to the landing with the way the cart
 * rolls held, the same with nothing held, a tapped jump with nothing held.
 */
export const RIDER_REACTIONS: readonly { readonly name: string; readonly input: SightInput; readonly move: (dir: 1 | -1) => -1 | 0 | 1 }[] = [
  { name: 'a held jump, its way held', input: 'held', move: (dir) => dir },
  { name: 'a held jump, nothing held', input: 'held', move: () => 0 },
  { name: 'a tapped jump', input: 'tap', move: () => 0 },
];

/**
 * GDD-WLD-03, GDD-WLD-15: the rider's reactions (by name) that save a life lost staying in a ride (`input` 'ride'): the reaction, taken on
 * any step of the ride from REACT_STEPS after what takes the life first came on screen up to the loss, after which no life is lost; a
 * jump that lands back in the cart rides on in it, so it saves him only if that ride does. None if it never came on screen.
 */
export function rideSaves(level: Level, l: Loss): string[] {
  if (l.seenBefore === null || !l.takeoff.ride) return [];
  const t = l.takeoff;
  const ride = t.ride!;
  const stay = flyTakeoff(level, t);
  const from = l.lossStep - l.seenBefore + REACT_STEPS;
  return RIDER_REACTIONS.filter((rx) => {
    for (let k = from; k < l.lossStep; k++) {
      const jump: Takeoff = { ...t, input: rx.input, ride: { ...ride, move: rx.move(t.dir), step: k } };
      if (flySight(level, jump, stay.from, undefined, { prefix: stay.states.slice(0, k), rideOn: true }).loss === null) return true;
    }
    return false;
  }).map((rx) => rx.name);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The sweep.

/** A run of standable tile tops in one row that no flight reached. */
export interface Unreached {
  readonly row: number;
  readonly from: number;
  readonly to: number;
}

export interface SightReport {
  /** Every place the closure reached, in the order it reached them. */
  readonly places: readonly Place[];
  /** The first flight that reached each place (by "column,y"), none for a respawn point. */
  readonly reachedBy: ReadonlyMap<string, Takeoff>;
  /** The flights flown, one per take-off and start time, those from rides included. */
  readonly flights: number;
  /** GDD-WLD-15: the rails ridden, each with the first flight that boarded its cart, in the order they were found. */
  readonly rides: ReadonlyMap<number, Takeoff>;
  /** The losses whose cause was on screen at the take-off, counted per cause. */
  readonly inSight: Readonly<Record<string, number>>;
  /** The blind losses: each cause off screen at its take-off (a jump out of a ride: the step jump is pressed). */
  readonly blind: readonly Loss[];
  /** GDD-WLD-15: the lives lost staying in a ride (input `ride`, the rail in `takeoff.ride`), judged by the rider's reactions alone (`rideSaves`). */
  readonly rideLosses: readonly Loss[];
  /** The tile tops he could stand on (2 tiles of air over them) that no flight reached, by rows and column ranges. */
  readonly unreached: readonly Unreached[];
  /** The take-offs flown again with the enemies (each once, at the first start time); every other one was flown once without them. */
  readonly reflown: readonly Takeoff[];
}

/** A place as "column,y", the key of `SightReport.reachedBy`. */
export const placeKey = (p: Place) => `${p.col},${p.y}`;
/** The gap between two boxes: the larger of the horizontal and the vertical gap (0 or less when they touch). */
const gapBetween = (a: Box, b: Box): number => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);
const bodyOf = (p: PlayerState): Box => ({ x0: p.x - HITBOX.width / 2, x1: p.x + HITBOX.width / 2, y0: p.y - HITBOX.height, y1: p.y });

/** Poncho far above the level, where no enemy can read him and nothing touches him: the run's enemies go on as if he were not there. */
const away = (r: RunState): RunState => ({ ...r, player: { ...r.player, y: -1e6, vy: 0, grounded: false } });

/**
 * Each enemy's swept box: every box it has from each of `starts` (the idle run from the level's start, Poncho waiting at the spawn) on for
 * `steps` steps with Poncho away, so a kind that reacts to him goes on as it does when nothing sets it off.
 */
function sweptBoxes(level: Level, starts: readonly number[], steps: number): Box[] {
  const boxes: Box[] = level.enemies.map(() => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  for (const start of starts) {
    let r = away(warmRun(level, start));
    for (let k = 0; k <= steps; k++) {
      level.enemies.forEach((d, i) => {
        const b = enemyBox(d, r.enemies[i]!);
        boxes[i] = { x0: Math.min(boxes[i]!.x0, b.x0), x1: Math.max(boxes[i]!.x1, b.x1), y0: Math.min(boxes[i]!.y0, b.y0), y1: Math.max(boxes[i]!.y1, b.y1) };
      });
      r = away(stepRun(r, { move: 0, jumpHeld: false }, level));
    }
  }
  return boxes;
}

/**
 * How near (px) an enemy's idle swept box may come to a flight flown without enemies before it is flown again with them; the box widened by
 * its kind's reach (`REACH`) it may not enter at all.
 */
const NEAR_PX = 40;

/**
 * How far from its own box his hurtbox can be and still set an enemy off: across, above it and below it (px). 0: it never reads him. His
 * body box (`bodyOf`), which holds his hurtbox, is what a flight is measured by.
 */
type Reach = 0 | { readonly across: number; readonly up: number; readonly down: number };

/** His hurtbox's top and bottom over his feet (GDD-MOV-06): 31 px and 1 px. */
const HURT_TOP = (HITBOX.height + HURTBOX.height) / 2;
const HURT_BOTTOM = (HITBOX.height - HURTBOX.height) / 2;

/**
 * The reach of a kind that sees his hurtbox's centre (his x) within `sightX` of its middle across, either side, and his feet within `sightY`
 * of its own feet (`enemyBox`: `width` x `height` standing on its feet): that box widened by his hurtbox.
 */
const feetReach = (sightX: number, sightY: number, size: { readonly width: number; readonly height: number }): Reach => ({
  across: sightX + HURTBOX.width / 2 - size.width / 2,
  up: sightY + HURT_TOP - size.height,
  down: sightY - HURT_BOTTOM,
});

/**
 * GDD-WLD-03, GDD-ENM-01 to GDD-ENM-04: how far from its own path each kind can be made to act by him, from the step of each kind
 * (`enemy.ts`, `STEPS`). The ones that never read him: the Alacrán (`walk`), the cactus buddy (it stands), the Chapulín (`stepChapulin`), the
 * Trompo (`stepTrompo`) and the Murciélago (`stepMurcielago`). The Zopilote (`stepZopilote`) sees his hurtbox's centre within `triggerX`
 * across and below its middle by up to `triggerY`; the Tlacuache (`stepTlacuache`) within `sightX` ahead (taken here on both sides) and his
 * feet within `sightY` of its own; the Paloma (`stepPaloma`) and the Armadillo (`stepArmadillo`) within `sightX` either side and `sightY`.
 * Each is a box. (They are moved by him in other ways too: see `sightSweep`.)
 */
const REACH: Readonly<Record<EnemyKind, Reach>> = {
  alacran: 0,
  // His hurtbox's centre below its middle by up to triggerY: his hurtbox from HURTBOX.height / 2 over its middle to triggerY + that under it.
  zopilote: { across: ZOPILOTE.triggerX + HURTBOX.width / 2 - ZOPILOTE.width / 2, up: HURTBOX.height / 2 - ZOPILOTE.height / 2, down: ZOPILOTE.triggerY + HURTBOX.height / 2 - ZOPILOTE.height / 2 },
  cactus: 0,
  tlacuache: feetReach(TLACUACHE.sightX, TLACUACHE.sightY, TLACUACHE),
  paloma: feetReach(PALOMA.sightX, PALOMA.sightY, PALOMA),
  chapulin: 0,
  trompo: 0,
  murcielago: 0,
  armadillo: feetReach(ARMADILLO.sightX, ARMADILLO.sightY, ARMADILLO),
};

/** A box widened by a kind's reach. */
const widen = (b: Box, reach: Reach): Box => (reach === 0 ? b : { x0: b.x0 - reach.across, x1: b.x1 + reach.across, y0: b.y0 - reach.up, y1: b.y1 + reach.down });

/**
 * GDD-ENM-01 to GDD-ENM-04: whether an enemy is in a phase it only enters by him (a reaction, a stomp, a claw), from its state: the Zopilote
 * out of its cruise (telegraph, dive, climbing back), the Tlacuache out of its walk (telegraph, charge, playing dead), the Paloma out of its
 * walk (telegraph, rising, hovering, coming down), the Trompo stunned, the Armadillo out of its walk (tuck, roll, dazed after a roll). The
 * other kinds have no such phase.
 */
const REACTING: Readonly<Record<EnemyKind, (s: EnemyState) => boolean>> = {
  alacran: () => false,
  zopilote: (s) => s.flight!.phase !== 'cruise',
  cactus: () => false,
  tlacuache: (s) => s.gait!.phase !== 'walk',
  paloma: (s) => s.wing!.phase !== 'walk',
  chapulin: () => false,
  trompo: (s) => s.spin!.phase !== 'spin',
  murcielago: () => false,
  armadillo: (s) => s.shell!.phase !== 'walk',
};

/** Whether a live enemy of the run is in a phase it only enters by him (`REACTING`). */
const reacting = (level: Level, r: RunState): boolean => level.enemies.some((d, i) => r.enemies[i]!.alive && REACTING[kindOf(d)](r.enemies[i]!));

/**
 * GDD-WLD-03: the sight sweep of a level. From the spawn and each ofrenda, and then from every place reached, flies every take-off: the
 * tile's eighths 1, 3, 5 and 7, both ways, from a standstill and at run speed, with each of `SIGHT_INPUTS`, at each of `starts`. A place
 * is reached when he stands on it in a flight before any life is lost. Each loss is checked against the camera stepped along its flight.
 *
 * GDD-WLD-15: a flight that comes down into a rolling cart (boarding a waiting one) ends there and starts a ride on that rail, once per
 * rail: the cart is where the steps since the boarding say, and he is anchored at its middle, so the ride is the same whoever boards it;
 * what does differ, the enemies' clock at the boarding, is flown at each of `starts` (`rideRun`), and the camera, which is stepped on from
 * the first boarding flight's own start, through the ride (one continuous run). From a ride it flies, with nothing held and with the way the
 * cart rolls held: staying in, to the rail's end and on until he stands (input `ride`, a loss of its own kind, `rideLosses`); and a jump
 * `held`, `tap` and `again` pressed on every 2nd step of the ride from the boarding to 6 steps past the rail's end (the coyote steps of a
 * broken end), staying in up to it (blind if what took the life was off screen on the press's step). Places he stands on join the closure.
 *
 * For speed each take-off is flown once on the level without its enemies, and again at each start time with them only when his body on that
 * flight comes within 40 px of an enemy's idle swept box (its path from each start time, Poncho away), or inside that box widened by its
 * kind's reach (`REACH`, no margin); one that never does flies the same at every start time. Sound while every enemy acts on him only by
 * touch and changes its path only by seeing him (`REACH`): it reacts only if he enters its reach, and unreacted it touches him only near
 * its idle path; an enemy he sets off (`REACTING`) keeps the flight going until it is back in its idle phase. Not covered, so not
 * sound where it happens: an enemy whose path he changes another way, a walker on a crumbling tile he crumbles (or a door, a fragile wall,
 * a piñata he changes), a Chapulín on an awning he tears, a Paloma on a rollo he unrolls; a take-off always starts from the enemies' idle
 * state at its start time (one he set off or defeated in an earlier flight is not carried on), and so does a ride, whatever the boarding
 * flight did to them. A ride longer than a flight's `maxSteps` is not cut: the sweep throws.
 */
export function sightSweep(level: Level, starts: readonly number[] = SIGHT_STARTS): SightReport {
  const F = SIGHT_FLIGHT;
  const calm: Level = { ...level, enemies: [] };
  const swept = sweptBoxes(level, starts, F.maxSteps + 1);
  const reaches = swept.map((b, i) => widen(b, REACH[kindOf(level.enemies[i]!)]));
  const near = (states: readonly RunState[]): boolean =>
    states.some((r) => {
      const body = bodyOf(r.player);
      return swept.some((b) => gapBetween(body, b) <= NEAR_PX) || reaches.some((b) => gapBetween(body, b) <= 0);
    });
  const reached = new Map<string, Place>();
  const reachedBy = new Map<string, Takeoff>();
  const queue: Place[] = [];
  const reach = (p: Place | undefined, by?: Takeoff) => {
    if (p && !reached.has(placeKey(p))) {
      reached.set(placeKey(p), p);
      if (by) reachedBy.set(placeKey(p), by);
      queue.push(p);
    }
  };
  const respawns: Point[] = [level.spawn, ...level.ofrendas];
  for (const p of respawns) reach(placeAt(level, p.x, p.y));
  let flights = 0;
  const inSight: Record<string, number> = {};
  const blind: Loss[] = [];
  const rideLosses: Loss[] = [];
  const reflown: Takeoff[] = [];
  const count = (loss: Loss | null) => {
    if (!loss) return;
    if (loss.takeoff.input === 'ride') rideLosses.push(loss);
    else if (loss.blind) blind.push(loss);
    else inSight[loss.cause] = (inSight[loss.cause] ?? 0) + 1;
  };
  // GDD-WLD-15: the rides, by rail: the first flight that boarded each, and the camera it left at the boarding.
  const rides = new Map<number, Takeoff>();
  const rideQueue: { rail: number; camera: SightCamera; via?: readonly RideJump[] }[] = [];
  const board = (f: SightFlight, by: Takeoff) => {
    if (f.boarded === undefined || rides.has(f.boarded)) return;
    rides.set(f.boarded, by);
    rideQueue.push({ rail: f.boarded, camera: camerasAlong(level, f.camera, f.from, f.states).at(-1)! });
  };
  /** A take-off flown without enemies (`plain`), and with them at each start time (`withEnemies`, null where it cannot be flown) if near one. */
  const sweepOne = (base: Takeoff, plain: SightFlight, withEnemies: (start: number) => SightFlight | null) => {
    const again = near([plain.from, ...plain.states]);
    if (again) reflown.push(base);
    for (const start of starts) {
      const f = again ? withEnemies(start) : plain;
      if (!f) continue;
      flights++;
      const by = { ...base, start };
      for (const p of f.stood) reach(p, by);
      board(f, by);
      count(f.loss && !again ? { ...f.loss, takeoff: { ...f.loss.takeoff, start } } : f.loss);
    }
  };
  const flyPlace = (place: Place) => {
    for (const e of EIGHTHS) {
      const x = place.col * TILE + (e * TILE) / 8;
      if (!canStand(level, x, place.y)) continue;
      for (const dir of [1, -1] as const) {
        for (const speed of ['stand', 'run'] as const) {
          for (const input of SIGHT_INPUTS) {
            const base: Takeoff = { place, x, dir, speed, input, start: starts[0]! };
            sweepOne(base, flySight(calm, base, { ...takeoffRun(level, base), enemies: [] }), (start) => flySight(level, { ...base, start }));
          }
        }
      }
    }
  };
  // A jump out of a ride that lands back in its cart where staying in had left it (a hanging beam takes a rider who stays in out) goes on
  // as a ride of its own from that landing (`RideFlight.via`), once per rail and landing step.
  const continued = new Set<string>();
  const flyRide = (ride: { rail: number; camera: SightCamera; via?: readonly RideJump[] }) => {
    const rail = level.rails![ride.rail]!;
    const via = ride.via ?? [];
    const end = rideEnd(level, ride.rail);
    if (end + F.coyoteSteps >= F.maxSteps) throw new Error(`rail ${ride.rail}: a ride of ${end} steps is longer than a flight (${F.maxSteps} steps)`);
    const { place, x } = boardingAt(level, ride.rail);
    const o = { camera: ride.camera };
    const calmFrom = { ...rideRun(level, ride.rail, starts[0]!), enemies: [] };
    const base: Takeoff = { place, x, dir: rail.dir, speed: 'stand', input: 'ride', start: starts[0]!, ride: { rail: ride.rail, move: 0 } };
    const calmBefore = staysUpTo(calm, base, via, calmFrom, ride.camera)!;
    const befores = new Map<number, readonly RunState[] | null>();
    const beforeWith = (start: number) => (befores.has(start) ? befores.get(start)! : befores.set(start, staysUpTo(level, { ...base, start }, via, rideRun(level, ride.rail, start), ride.camera)).get(start)!);
    for (const move of [0, rail.dir] as const) {
      const stayIn: Takeoff = { ...base, ride: { rail: ride.rail, move, ...(via.length > 0 ? { via } : {}) } };
      const calmStay = flySight(calm, stayIn, calmFrom, undefined, { ...o, prefix: calmBefore });
      const stays = new Map<number, SightFlight | null>();
      const stayWith = (start: number): SightFlight | null => {
        if (stays.has(start)) return stays.get(start)!;
        const prefix = beforeWith(start);
        return stays.set(start, prefix && flySight(level, { ...stayIn, start }, rideRun(level, ride.rail, start), undefined, { ...o, prefix })).get(start)!;
      };
      sweepOne(stayIn, calmStay, stayWith);
      // A jump pressed on step k branches from staying in up to it; none once he has been lost (or stood) before it.
      const before = (f: SightFlight, k: number) => (f.loss === null ? f.states.length >= k : f.loss.lossStep >= k);
      for (let k = calmBefore.length; k <= end + F.coyoteSteps; k += 2) {
        if (!before(calmStay, k)) continue;
        for (const input of RIDE_JUMPS) {
          const t: Takeoff = { ...stayIn, input, ride: { ...stayIn.ride!, step: k } };
          const plain = flySight(calm, t, calmFrom, undefined, { ...o, prefix: calmStay.states.slice(0, k) });
          sweepOne(t, plain, (start) => {
            const s = stayWith(start);
            return s && before(s, k) ? flySight(level, { ...t, start }, s.from, undefined, { ...o, prefix: s.states.slice(0, k) }) : null;
          });
          // Back in its cart: staying in covers the ride from there if it is still in it on that step; if not, the ride goes on from it.
          const landed = plain.states.length - 1;
          const stayed = calmStay.states[landed];
          const covered = stayed !== undefined && stayed.phase === 'playing' && cartUnder(level, stayed, true) === ride.rail;
          if (plain.boarded === ride.rail && !covered && !continued.has(`${ride.rail}|${landed}`)) {
            continued.add(`${ride.rail}|${landed}`);
            rideQueue.push({ ...ride, via: [...via, { step: k, input, move, landed }] });
          }
        }
      }
    }
  };
  for (let q = 0, w = 0; q < queue.length || w < rideQueue.length; ) {
    if (q < queue.length) flyPlace(queue[q++]!);
    else flyRide(rideQueue[w++]!);
  }
  return { places: [...reached.values()], reachedBy, flights, rides, inSight, blind, rideLosses, unreached: unreachedTops(level, reached), reflown };
}

/** The standable tile tops (a tile he stands on, 2 tiles of air over it) that are not among `reached`, by rows and column ranges. */
function unreachedTops(level: Level, reached: ReadonlyMap<string, Place>): Unreached[] {
  const out: Unreached[] = [];
  for (let row = 0; row < level.world.height; row++) {
    for (let col = 0; col < level.world.width; col++) {
      const standable = standOn(level, col, row) && !standOn(level, col, row - 1) && !standOn(level, col, row - 2);
      if (!standable || reached.has(placeKey({ col, y: row * TILE }))) continue;
      const last = out[out.length - 1];
      if (last && last.row === row && last.to === col - 1) out[out.length - 1] = { ...last, to: col };
      else out.push({ row, from: col, to: col });
    }
  }
  return out;
}

/**
 * A family of blind losses (or of losses staying in a ride): one cause, one input, take-offs from a run of adjacent columns; for a ride's
 * flights also its rail (`rail`), whose take-offs are all from its boarding place.
 */
export interface SightFamily {
  readonly cause: string;
  readonly from: number;
  readonly to: number;
  readonly input: SightInput;
  readonly rail?: number;
}

/** The losses grouped by what took the life, the input and the rail (in the order first met), each by runs of adjacent take-off columns. */
export function sightFamilies(blind: readonly Loss[]): SightFamily[] {
  const groups = new Map<string, { cause: string; input: SightInput; rail: number | undefined; cols: Set<number> }>();
  for (const l of blind) {
    const rail = l.takeoff.ride?.rail;
    const k = `${l.cause}|${l.takeoff.input}|${rail ?? ''}`;
    const group = groups.get(k) ?? { cause: l.cause, input: l.takeoff.input, rail, cols: new Set<number>() };
    group.cols.add(l.takeoff.place.col);
    groups.set(k, group);
  }
  const out: SightFamily[] = [];
  const all = blind.map((l) => l.takeoff.place.col);
  for (const { cause, input, rail, cols } of groups.values()) {
    for (let c = Math.min(...all); c <= Math.max(...all); c++) {
      if (!cols.has(c)) continue;
      const last = out[out.length - 1];
      if (last && last.cause === cause && last.input === input && last.rail === rail && last.to === c - 1) out[out.length - 1] = { ...last, to: c };
      else out.push({ cause, from: c, to: c, input, ...(rail !== undefined ? { rail } : {}) });
    }
  }
  return out;
}

/** Whether a loss is in a family: its cause, input and rail, its take-off's column in the family's. */
export const inFamily = (l: Loss, f: SightFamily): boolean =>
  f.cause === l.cause && f.input === l.takeoff.input && f.rail === l.takeoff.ride?.rail && l.takeoff.place.col >= f.from && l.takeoff.place.col <= f.to;

/** A loss as a line for a failing test's message. */
export const describeLoss = (l: Loss): string => {
  const t = l.takeoff;
  const where = `x ${Math.round(l.where.x0)} to ${Math.round(l.where.x1)}, y ${Math.round(l.where.y0)} to ${Math.round(l.where.y1)}`;
  const back = t.ride?.via ? ` back in it on step ${t.ride.via.at(-1)!.landed} after ${t.ride.via.map((v) => `a ${v.input} jump on step ${v.step}`).join(', ')},` : '';
  const ride = t.ride ? `, rail ${t.ride.rail}${back} ${t.ride.step === undefined ? 'staying in' : `jump on step ${t.ride.step}`} with ${t.ride.move === 0 ? 'nothing' : 'its way'} held` : '';
  return `${l.cause} (${where}) from column ${t.place.col} y ${t.place.y} x ${t.x}, ${t.dir > 0 ? 'right' : 'left'}, ${t.speed}, ${t.input}${ride}, start ${t.start}: lost at step ${l.lossStep}, take-off step ${l.takeoffStep}, on screen ${l.seenBefore ?? 'never'} steps before`;
};
