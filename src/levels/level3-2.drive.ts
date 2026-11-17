// GDD-WLD-17: the shared drivers of 3-2's tests (`level3-2.test.ts`, `level3-2.sweeps.test.ts`): the level's pieces by name, the
// jumps and sweeps flown from its carts, the bots that play it, and the enemies' recorded walks. Pure, no Phaser; test support only.
import { ARMADILLO, TILE } from '../config/tuning';
import { floorUnder, railLength, type Rail } from '../sim/cart';
import { enemyBox, overlaps, type EnemyState } from '../sim/enemy';
import { hurtbox } from '../sim/hazards';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { standsOnPlatform } from '../sim/platform';
import { groundTop } from '../sim/slope';
import { startRun, stepRun, type RunState } from '../sim/run';
import { levelById } from './index';
import {
  LEVEL_3_2,
  LEVEL_3_2_BEAMS,
  LEVEL_3_2_FAR_WALL,
  LEVEL_3_2_HOP1_FLOOR,
  LEVEL_3_2_ISLAND,
  LEVEL_3_2_LEDGES,
  LEVEL_3_2_PEN,
  LEVEL_3_2_PILLAR,
  LEVEL_3_2_PIT_D,
  LEVEL_3_2_PITS,
  LEVEL_3_2_RAIL,
  LEVEL_3_2_RIB,
  LEVEL_3_2_SEAT,
  LEVEL_3_2_SUNKEN,
} from './level3-2';

// GDD-WLD-17: level 3-2, "La Mina". Every number in these tests is the design's (GDD-WLD-17, laid out by the World 3 design swarm before
// any code); where the real simulation gives another, the test pins the measured value with a comment "GDD says N" (L-003). Part 1 is the
// layout; Part 2 measures Ki and Shō (columns 0 to 111) on the real level with everything in it (L-014).

export const L = LEVEL_3_2;
export const world = L.world;
export const entry = () => levelById('3-2')!;
export const mid = (col: number) => col * TILE + TILE / 2;
/** The y of a row's top. */
export const Y = (row: number) => row * TILE;
export const idle: PlayerInput = { move: 0, jumpHeld: false };
export const right: PlayerInput = { move: 1, jumpHeld: false };
export const standing = (x: number, y: number, vx = 0): PlayerState => ({ ...spawn(x, y), grounded: true, vx, facing: vx < 0 ? -1 : 1 });
/** A fresh run of 3-2 with Poncho standing at (x, y), running at `vx`. */
export const at = (x: number, y: number, vx = 0): RunState => ({ ...startRun(L), player: standing(x, y, vx), clock: 0 });

/** The rails by letter and each cart's place in a run's `carts`. */
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'K1', 'K2', 'K3'] as const;
export type Letter = (typeof LETTERS)[number];
export const cartOf = (letter: Letter) => LETTERS.indexOf(letter);
export const railOf = (letter: Letter): Rail => LEVEL_3_2_RAIL[letter];
/** A rail's end, in px across. */
export const endOf = (letter: Letter) => railOf(letter).x + railLength(railOf(letter));
/** The cart's middle in run `r`. */
export const middleOf = (r: RunState, letter: Letter) => railOf(letter).x + r.carts[cartOf(letter)]!.m;
/** Standing in the cart: it is on its rail and he is on its floor under his feet (GDD-WLD-15: the floor follows the rail). */
export function inCart(r: RunState, letter: Letter): boolean {
  const c = r.carts[cartOf(letter)]!;
  if (c.phase === 'falling' || c.phase === 'gone') return false;
  return standsOnPlatform(r.player, floorUnder(railOf(letter), c, r.player.x));
}
/** The cart he stands in, or undefined. */
export const cartIn = (r: RunState): Letter | undefined => LETTERS.find((l) => inCart(r, l));
export const hiloIndex = (col: number, row: number) => L.hilos!.findIndex((h) => h.col === col && h.row === row);
export const took = (r: RunState, col: number, row: number) => r.hilosTaken[hiloIndex(col, row)] === true;
export const lostIn = (states: readonly RunState[], from: RunState) => states.some((s) => s.lives.lives < from.lives.lives || s.phase !== 'playing');

/** Steps `run` with `input` until `done` or `max` steps (L-064), returning every state. */
export function play(run: RunState, max: number, input: (r: RunState, i: number) => PlayerInput, done: (r: RunState, i: number) => boolean = () => false): RunState[] {
  const out: RunState[] = [];
  let r = run;
  for (let i = 0; i < max && !done(r, i); i++) {
    r = stepRun(r, input(r, i), L);
    out.push(r);
  }
  return out;
}

/**
 * A hop into the cart on rail `letter`, as lab-3c's bot: on the ground it walks towards the cart's middle and, 20 to 60 px from it, jumps
 * (held while rising) and steers over the middle. Every state up to the landing step, on which the cart starts rolling (at most 200).
 */
export function hopIn(run: RunState, letter: Letter): RunState[] {
  let jumpWas = false;
  return play(
    run,
    200,
    (r) => {
      const gap = middleOf(r, letter) - r.player.x;
      const p = r.player;
      const jump = p.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0;
      jumpWas = jump;
      return { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: jump };
    },
    (r) => r.carts[cartOf(letter)]!.phase !== 'waiting',
  );
}

/**
 * The jumps of the sweeps, each pressed on its first step with right held throughout (in the air, right and nothing hold the carried speed
 * alike, GDD-WLD-15): a tap (jump down one step); the plain full jump, held while he rises and let go at the top; held to the landing,
 * which in 3-2, a level with the glide on, is the glide once he falls (GDD-MOV-07); and held while he rises, let go at the top and pressed
 * again 10 steps later, held to the landing (a second glide).
 */
export const JUMPS = ['tap', 'top', 'held', 'again'] as const;
export type Jump = (typeof JUMPS)[number];
export function jumper(kind: Jump, move: 0 | 1 = 1): (r: RunState, i: number) => PlayerInput {
  let top = -1;
  return (r, i) => {
    if (i === 0) return { move, jumpHeld: true };
    if (kind === 'tap') return { move, jumpHeld: false };
    if (kind === 'held') return { move, jumpHeld: true };
    if (top < 0 && r.player.vy >= 0) top = i;
    if (top < 0) return { move, jumpHeld: true };
    return { move, jumpHeld: kind === 'again' && i >= top + 10 };
  };
}

/** One jump of a sweep: the take-off state's place in the ride, where he stood, and where it ended. */
export interface Flight {
  readonly k: number;
  readonly x: number;
  readonly lost: boolean;
  readonly landed?: RunState;
  readonly states: readonly RunState[];
  /** He reached the exit in the air (the level is cleared: `landed` is that state). */
  readonly cleared?: boolean;
}

/**
 * A jump `kind` pressed on the step after `from`, right held (`move` 1) or nothing: every state up to his landing (the first grounded state
 * after he was in the air), a lost life or 300 steps.
 */
export function fly(from: RunState, kind: Jump, k: number, move: 0 | 1 = 1): Flight {
  const input = jumper(kind, move);
  const states: RunState[] = [];
  let r = from;
  let air = !from.player.grounded;
  for (let i = 0; i < 300; i++) {
    r = stepRun(r, input(r, i), L);
    states.push(r);
    if (r.phase === 'clear') return { k, x: from.player.x, lost: false, landed: r, states, cleared: true };
    if (r.phase !== 'playing' || r.lives.lives < from.lives.lives) return { k, x: from.player.x, lost: true, states };
    if (!r.player.grounded) air = true;
    else if (air) return { k, x: from.player.x, lost: false, landed: r, states };
  }
  return { k, x: from.player.x, lost: false, states };
}

/** Every flight of each jump from each of `rides`, the take-off at its index. */
export function sweep(rides: readonly RunState[], move: 0 | 1 = 1): Record<Jump, Flight[]> {
  const each = (kind: Jump) => rides.map((s, k) => fly(s, kind, k, move));
  return { tap: each('tap'), top: each('top'), held: each('held'), again: each('again') };
}

/**
 * Where a flight ended, as a word: a life lost; in a cart (`cart A` ...); on a floor (`floor <row>`); on a ramp; or `air` (no landing in 300
 * steps).
 */
export function landedAs(f: Flight): string {
  if (f.lost) return 'lost';
  if (!f.landed) return 'air';
  const cart = cartIn(f.landed);
  if (cart) return `cart ${cart}`;
  const y = f.landed.player.y;
  return y % TILE === 0 && world.slopeAt(Math.floor(f.landed.player.x / TILE), y / TILE - 1) === null ? `floor ${y / TILE}` : 'ramp';
}

/** Runs of take-offs in a row that end alike: "k0-k1 what" (or "k what" for one), in ride order. */
export function runsOf(flights: readonly Flight[], as: (f: Flight) => string = landedAs): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 1; i <= flights.length; i++) {
    if (i < flights.length && as(flights[i]!) === as(flights[from]!)) continue;
    const [a, b] = [flights[from]!.k, flights[i - 1]!.k];
    out.push(`${a === b ? a : `${a}-${b}`} ${as(flights[from]!)}`);
    from = i;
  }
  return out;
}

/** The take-offs among `flights` that `pick` holds: the first and last k, the count, and the px before `end` of the first and last (to 0.1 px). */
export function windowOf(flights: readonly Flight[], pick: (f: Flight) => boolean, end: number) {
  const ks = flights.filter(pick);
  if (ks.length === 0) return { count: 0 };
  const px = (f: Flight) => Math.round((end - f.x) * 10) / 10;
  return { first: ks[0]!.k, last: ks[ks.length - 1]!.k, count: ks.length, firstPx: px(ks[0]!), lastPx: px(ks[ks.length - 1]!) };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 1: the layout, from GDD-WLD-17's tables and bullets.

/** GDD-WLD-17's floor, column by column: [from, to, top row]; the pits and the ramps are left out. */
export const GROUND: readonly (readonly [number, number, number])[] = [
  [0, 7, 8], [8, 29, 9], [34, 57, 13], [58, 62, 15], [63, 79, 13], [85, 115, 13], [116, 117, 11], [118, 128, 13], [129, 130, 11],
  [131, 132, 13], [133, 136, 11], [139, 143, 11], [147, 164, 11], [169, 175, 15], [176, 178, 16], [179, 187, 11], [191, 195, 11], [201, 215, 11],
  [222, 227, 11], [232, 238, 15], [239, 239, 11],
];
export const PITS: readonly (readonly [number, number])[] = [[80, 84], [137, 138], [144, 146], [188, 190], [196, 200], [216, 221]];
/** The ramps: [from, to, row of the first slope tile], one row down per column. */
export const RAMPS: readonly (readonly [number, number, number])[] = [[30, 33, 9], [165, 168, 11], [228, 231, 11]];
/** The roof, solid from row 0: [from, to, last row]. */
export const ROOF: readonly (readonly [number, number, number])[] = [[0, 7, 0], [8, 33, 1], [34, 117, 4], [118, 128, 6], [129, 138, 6], [139, 239, 2]];
/** The beams, the rib and the two cutting ledges: [from, to, first row, last row]. */
export const PIECES: readonly (readonly [number, number, number, number])[] = [[97, 97, 10, 10], [209, 209, 8, 8], [104, 106, 5, 10], [169, 178, 11, 11], [232, 238, 11, 11]];

/** Empty tiles between the floor's top and the first solid tile over it, in column `col` (at most 17). */
export function headroom(col: number): number {
  const floor = GROUND.find(([a, b]) => col >= a && col <= b)![2];
  let n = 0;
  while (n < 17 && !world.solidTile(col, floor - 1 - n)) n++;
  return n;
}


export const OFRENDA_HALF = TILE / 2;

/** The y a walker stands at on the floor under row `row` at x (a level tile's top or a ramp's surface), or null over a pit. */
export function floorBelow(x: number, row: number): number | null {
  const col = Math.floor(x / TILE);
  for (let r = row + 1; r < 17; r++) {
    if (world.solidTile(col, r) || world.slopeAt(col, r) !== null) return groundTop(world, x, Y(r + 1));
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 2: Ki and Shō (columns 0 to 111), measured on the real level.

/** Holding right from the spawn until he lands in cart A, then `after`: every state until cart A has stood at its buffer `tail` steps. */
export function rideA(after: PlayerInput, tail = 60): RunState[] {
  let boarded = false;
  let stopped = -1;
  return play(
    startRun(L),
    500,
    (r) => {
      if (r.carts[cartOf('A')]!.phase !== 'waiting') boarded = true;
      return boarded ? after : right;
    },
    (r, i) => {
      if (stopped < 0 && r.carts[cartOf('A')]!.phase === 'stopped') stopped = i;
      return stopped >= 0 && i >= stopped + tail;
    },
  );
}
export const A_HILOS: readonly (readonly [number, number])[] = [[4, 7], [5, 7], [12, 6], [15, 6], [18, 6]];


/** The ride on rail `letter` from a hop in from standing at (x, y), he holding nothing: every state from the landing to the cart's end and `after` more. */
export function rideFrom(x: number, y: number, letter: Letter, after: number): RunState[] {
  const hop = hopIn(at(x, y), letter);
  const landed = hop[hop.length - 1]!;
  let end = -1;
  return [
    landed,
    ...play(landed, 600, () => idle, (r, i) => {
      if (end < 0 && ['falling', 'stopped'].includes(r.carts[cartOf(letter)]!.phase)) end = i;
      return end >= 0 && i >= end + after;
    }),
  ];
}

/**
 * The sweep over a broken end (GDD-WLD-15): a jump at every step of the ride from the landing to the step the cart leaves the rail, and on
 * each of the 6 steps after it (the coyote time: a press on the leaving step or the 5 after it still jumps). Each flight ends as `bank`
 * (the far bank's floor, row 13, past the rail's end), `near` (row 13 before it), `floor 15` (the sunken floor), `cart <letter>` or `lost`.
 */
export function brokenSweep(letter: Letter, x: number, y: number) {
  const ride = rideFrom(x, y, letter, 0);
  const leave = ride.findIndex((s) => s.carts[cartOf(letter)]!.phase === 'falling');
  const rides = rideFrom(x, y, letter, 6).slice(0, leave + 6);
  const as = (f: Flight) => {
    const w = landedAs(f);
    return w === 'floor 13' ? (f.landed!.player.x > endOf(letter) ? 'bank' : 'near') : w;
  };
  return { rides, leave, flights: sweep(rides), as };
}


/** The beam's near face over rail E (its left edge: E rolls right) and its far face; the rib's near face. */
export const BEAM_FACE = LEVEL_3_2_BEAMS.E.col * TILE;
export const BEAM_BACK = BEAM_FACE + TILE;
export const RIB_FACE = LEVEL_3_2_RIB.col0 * TILE;

/** Rail E's ride from a hop in from the bank past pit D (column 86), he holding nothing, until the cart is back at its start (at most 400 steps). */
export const rideE = (): RunState[] => {
  const ride = rideFrom(mid(86), Y(13), 'E', 0);
  return [...ride, ...play(ride[ride.length - 1]!, 400, () => idle, (r) => r.carts[cartOf('E')]!.phase === 'waiting')];
};
/** Back in cart E past the beam's far face. */
export const pastBeam = (r: RunState) => inCart(r, 'E') && r.player.x - 6 > BEAM_BACK;
/** A flight that lands back in cart E past the beam. */
export const clears = (f: Flight) => f.landed !== undefined && pastBeam(f.landed);
/** The hilos at (93, 10) and (97, 8) that a flight over rail E has taken by the time cart E stops at its buffer, he holding nothing after the landing. */
export function beamHilos(f: Flight): string {
  const from = f.landed ?? f.states[f.states.length - 1]!;
  const tail = play(from, 300, () => idle, (r) => r.carts[cartOf('E')]!.phase === 'stopped');
  const r = tail.length > 0 ? tail[tail.length - 1]! : from;
  return [took(r, 93, 10) ? '93' : '', took(r, 97, 8) ? '97' : ''].filter(Boolean).join(' ') || 'none';
}


/**
 * A step of the on-foot bot: runs right, presses jump once it stands with its middle at or past `x` and holds it while he rises (`top`), or
 * (a number) until his middle is past that x, gliding once he falls; done on the landing.
 */
export const leap = (x: number, hold: 'top' | number = 'top') => {
  let pressed = false;
  let air = false;
  return (r: RunState): { input: PlayerInput; done: boolean } => {
    const p = r.player;
    if (!pressed) {
      pressed = p.grounded && p.x >= x;
      return { input: { move: 1, jumpHeld: pressed }, done: false };
    }
    if (!p.grounded) air = true;
    if (air && p.grounded) return { input: right, done: true };
    return { input: { move: 1, jumpHeld: hold === 'top' ? p.vy < 0 : p.x < hold }, done: false };
  };
};
/** Runs right until `until` holds. */
export const runTo = (until: (r: RunState) => boolean) => (r: RunState) => ({ input: right, done: until(r) });

/** Plays the bot's steps in turn from `from`, every state (at most 3000). */
export function drive(tasks: readonly ((r: RunState) => { input: PlayerInput; done: boolean })[], from: RunState): RunState[] {
  const states: RunState[] = [];
  let r = from;
  let k = 0;
  while (k < tasks.length && states.length < 3000 && r.phase === 'playing') {
    const { input, done } = tasks[k]!(r);
    if (done) {
      k++;
      continue;
    }
    r = stepRun(r, input, L);
    states.push(r);
  }
  return states;
}


/** The steps of a flight that end with him in the air (GDD-WLD-15 counts a jump's steps so). */
export const airSteps = (f: Flight) => f.states.filter((s) => !s.player.grounded).length;
/**
 * A tap, a plain full jump and the glide taken 2 steps into a ride: the cart he lands in and its phase then, the px across and the steps in
 * the air.
 */
export const backInCart = (rides: readonly RunState[]) =>
  Object.fromEntries((['tap', 'top', 'held'] as const).map((kind) => {
    const f = fly(rides[2]!, kind, 2);
    const cart = f.landed ? cartIn(f.landed) : undefined;
    const phase = cart ? f.landed!.carts[cartOf(cart)]!.phase : undefined;
    return [kind, { cart, phase, px: Math.round((f.landed!.player.x - f.x) * 10) / 10, steps: airSteps(f) }];
  }));


// ---------------------------------------------------------------------------------------------------------------------------------------
// Run C2: Ten (columns 112 to 182), Ketsu (183 to 239) and the whole level, measured on the real level with everything in it.

/** The enemies by their place in `LEVEL_3_2_ENEMIES`. */
export const PEN_BALL = 0;
export const GALLERY_BALL = 2;
export const K1_ALACRAN = 4;

/** The enemies at each step of a run from the level's start in which Poncho stands at the spawn, out of every enemy's sight (memoised). */
export const timeline: (readonly EnemyState[])[] = [];
export function enemiesAt(t: number): readonly EnemyState[] {
  if (timeline.length <= t) {
    let r = startRun(L);
    timeline.length = 0;
    timeline.push(r.enemies);
    for (let i = 0; i < Math.max(t, 4400); i++) {
      r = stepRun(r, idle, L);
      timeline.push(r.enemies);
    }
  }
  return timeline[t]!;
}
/** A fresh run of 3-2 with its enemies `t` steps into their walks, Poncho standing at (x, y), running at `vx`. */
export const atT = (x: number, y: number, t: number, vx = 0, extra: Partial<RunState> = {}): RunState => ({ ...at(x, y, vx), enemies: enemiesAt(t), ...extra });
/** Enemy `k`'s walk period with nobody near: the first step on which it is back where it started, heading the same way. */
export function periodOf(k: number): number {
  const s0 = enemiesAt(0)[k]!;
  for (let t = 1; t < 2800; t++) {
    const s = enemiesAt(t)[k]!;
    if (Math.abs(s.x - s0.x) < 1e-6 && s.dir === s0.dir) return t;
  }
  return -1;
}
/** 0, n, 2n, ... below `period`. */
export const every = (n: number, period: number): number[] => Array.from({ length: Math.ceil(period / n) }, (_, i) => i * n);
/** Take-off places from `a` to `b`, 0.2 tile apart. */
export const apart = (a: number, b: number): number[] => Array.from({ length: Math.floor((b - a) / (0.2 * TILE) + 1e-6) + 1 }, (_, i) => a + i * 0.2 * TILE);

export const SEAT_TOP = Y(LEVEL_3_2_SEAT.row);
/** The piñata's column. */
export const PINATA_COL = L.pinatas[0]!.col;
/** The seat's right edge: his middle over it, his box still on it. */
export const SEAT_EDGE = (LEVEL_3_2_SEAT.col1 + 1) * TILE;
export const PEN_LO = LEVEL_3_2_PEN.col0 * TILE;
export const PEN_HI = (LEVEL_3_2_PEN.col1 + 1) * TILE;
export const ball = (r: RunState) => r.enemies[PEN_BALL]!;
export const tucking = (r: RunState, age: number) => ball(r).alive && ball(r).shell!.phase === 'tuck' && ball(r).shell!.age === age;


/** How he drops into the pen from the seat's right edge: walking off, or one of the four jumps, right held. */
export const DROPS = ['walk', ...JUMPS] as const;
export type DropWay = (typeof DROPS)[number];
/** What he does once down in the pen. */
export const FOLLOWS = ['stand', 'topAtEnd', 'heldAtEnd', 'heldAtFirst', 'hop', 'seat'] as const;
export type Follow = (typeof FOLLOWS)[number];

/** The drop from the seat's right edge with the pen Armadillo `t` steps into its walk: every state to his landing on the pen's floor (at most 120 steps). */
export function penDrop(t: number, way: DropWay): RunState[] {
  const input = way === 'walk' ? () => right : jumper(way, 1);
  return play(atT(SEAT_EDGE, SEAT_TOP, t), 120, input, (r, i) => i > 0 && ((r.player.grounded && r.player.y === Y(LEVEL_3_2_PEN.row)) || r.phase !== 'playing'));
}

/**
 * One way of meeting the pen's Armadillo from `from` (he has just landed in the pen): every state until a life is lost, the ball is gone, it
 * has got up again after a daze (a step after its 60 dazed steps), or 300 steps. `stand` holds nothing; `topAtEnd` and `heldAtEnd` press
 * jump on the step its tuck's flash ends (it rolls that step), nothing else held, and hold it while rising or to the landing;
 * `heldAtFirst` presses on the first step he stands in the pen with it tucked (its first flash, or later if it was startled while he
 * dropped: then at his landing) and holds it to the landing; `hop` runs at it and taps jump when the rolling ball's box
 * is 24 px or less from his hurtbox; `seat` runs back left and takes a plain full jump at the seat's wall, left held, onto it.
 */
export function penFollow(from: RunState, way: Follow): RunState[] {
  let holding = false;
  let air = false;
  let gotUp = -1;
  let pressed = false;
  return play(
    from,
    300,
    (r, i) => {
      const b = ball(r);
      const p = r.player;
      const tuck = b.alive && b.shell!.phase === 'tuck';
      const press = (way === 'topAtEnd' || way === 'heldAtEnd') && tucking(r, ARMADILLO.tuckSteps - 1) ? true : way === 'heldAtFirst' && tuck && !pressed;
      // L-048: a press is a new one only after a step with jump up (a drop held to its landing still holds it).
      if (press && !holding && p.grounded && !p.jumpWasHeld) {
        pressed = true;
        holding = true;
        air = false;
      }
      if (holding && !p.grounded) air = true;
      if (holding && air && p.grounded) holding = false;
      if (way === 'stand') return idle;
      if (way === 'topAtEnd') return { move: 0, jumpHeld: holding && !(air && p.vy > 0) };
      if (way === 'heldAtEnd' || way === 'heldAtFirst') return { move: 0, jumpHeld: holding };
      if (way === 'hop') {
        const toward: 1 | -1 = b.x > p.x ? 1 : -1;
        const gap = Math.abs(b.x - p.x) - ARMADILLO.width / 2 - 5;
        return { move: toward, jumpHeld: b.alive && b.shell!.phase === 'roll' && p.grounded && gap <= 24 && !p.jumpWasHeld };
      }
      // seat
      const atWall = p.grounded && p.y === Y(LEVEL_3_2_PEN.row) && p.x <= SEAT_EDGE + 6 + 2;
      if (atWall && !p.jumpWasHeld && i > 0) {
        holding = true;
        air = false;
      }
      return { move: -1, jumpHeld: holding && !(air && p.vy > 0) };
    },
    (r, i) => {
      if (r.phase !== 'playing' || r.lives.lives < from.lives.lives || !ball(r).alive) return true;
      // Decided early: the ball lies dazed and he stands still for good (every way but the hop and the seat, its jump done) clear of its
      // box, so its getting up cannot hit him, nothing moves him, and he takes no more hilos.
      const p = r.player;
      if (ball(r).shell!.phase === 'dazed' && way !== 'hop' && way !== 'seat' && !holding && p.grounded && p.vx === 0) {
        const h = hurtbox(p);
        if (!overlaps({ x0: h.x, x1: h.x + h.w, y0: h.y, y1: h.y + h.h }, enemyBox(L.enemies[PEN_BALL]!, ball(r)))) return true;
      }
      if (gotUp < 0 && ball(r).shell!.phase === 'dazed' && ball(r).shell!.age === ARMADILLO.dazedSteps - 1) gotUp = i + 2;
      return gotUp >= 0 && i >= gotUp;
    },
  );
}

/** The pen hilos (121, 10), (123, 10), (125, 10) a run has taken, as their columns. */
export const penHilos = (r: RunState) => [121, 123, 125].filter((c) => took(r, c, 10)).join(' ') || 'none';


/** The pen's Armadillo lying dazed against the far wall, just stopped there. */
export const dazedAtWall = (r: RunState): RunState => ({
  ...r,
  enemies: r.enemies.map((e, k) => (k === PEN_BALL ? { ...e, x: LEVEL_3_2_FAR_WALL.col0 * TILE - ARMADILLO.width / 2, y: Y(LEVEL_3_2_PEN.row), shell: { phase: 'dazed', age: 0, vy: 0, vx: 0 } } : e)),
});
/** Where a flight ended in Ten, as a word: `lost`; a place by the floor he stands on; `air`. */
export function tenLanding(f: Flight): string {
  if (f.lost) return 'lost';
  if (!f.landed) return 'air';
  const { x, y } = f.landed.player;
  const on = (s: { col0: number; col1: number; row: number }) => y === Y(s.row) && x + 6 > s.col0 * TILE && x - 6 < (s.col1 + 1) * TILE;
  if (on(LEVEL_3_2_FAR_WALL)) return 'far wall';
  if (on(LEVEL_3_2_PILLAR)) return 'pillar';
  if (on(LEVEL_3_2_HOP1_FLOOR)) return 'hop floor';
  if (on(LEVEL_3_2_ISLAND)) return 'island';
  if (on(LEVEL_3_2_PEN)) return 'pen';
  const cart = cartIn(f.landed);
  return cart ? `cart ${cart}` : `x ${x.toFixed(1)} y ${y}`;
}
/** Flights of `kinds` from each of `xs` on the floor at `y`, standing and running, right held and nothing held: their endings, run-length by x. */
export function takeOffs(from: (x: number, vx: number) => RunState, xs: readonly number[], kinds: readonly Jump[], as: (f: Flight) => string = tenLanding): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const vx of [0, 120]) {
    for (const move of [1, 0] as const) {
      for (const kind of kinds) {
        const flights = xs.map((x, k) => fly(from(x, vx), kind, k, move));
        out[`${vx === 0 ? 'standing' : 'running'} ${move ? 'right' : 'none'} ${kind}`] = runsOf(flights, as).map((line) => line.replace(/^(\d+)(-(\d+))? /, (_m, a: string, _b, c: string | undefined) => `${xs[Number(a)]!.toFixed(1)}${c ? `-${xs[Number(c)]!.toFixed(1)}` : ''} `));
      }
    }
  }
  return out;
}


export const LEDGE_F = LEVEL_3_2_LEDGES.F.col0 * TILE;
/** A flight about rail F's ledge, as a word (`upperLanding`). */
export const ledgeF = (f: Flight): string => upperLanding(f, LEDGE_F);
/** Where a flight about rail F or the Ketsu carts ended, as a word. */
export function upperLanding(f: Flight, lipX: number): string {
  if (f.cleared === true) return 'exit';
  if (f.lost) return 'lost';
  if (!f.landed) return 'air';
  const cart = cartIn(f.landed);
  if (cart) return `cart ${cart}`;
  const { x, y } = f.landed.player;
  if (y === Y(11)) return x + 6 > lipX ? 'ledge' : 'floor 11';
  if (y === Y(15) || y === Y(16)) return `floor ${y / TILE}`;
  return world.slopeAt(Math.floor(x / TILE), Math.ceil(y / TILE) - 1) !== null || y % TILE !== 0 ? 'ramp' : `floor ${y / TILE}`;
}
/** The ride on rail F from a hop in from the island's first column, the enemies `t` steps into their walks; `input` once he rides (at most 500 steps). */
export function rideF(t: number, input: (r: RunState, i: number) => PlayerInput, until: (r: RunState) => boolean): RunState[] {
  const hop = hopIn(atT(mid(LEVEL_3_2_ISLAND.col0), Y(11), t), 'F');
  const landed = hop[hop.length - 1]!;
  return [...hop, ...play(landed, 500, input, (r) => until(r) || r.phase !== 'playing')];
}
export const toRamp = (r: RunState) => middleOf(r, 'F') >= LEVEL_3_2_RAMPS_F_TOP;
export const LEVEL_3_2_RAMPS_F_TOP = 165 * TILE;



export type Ctl = (r: RunState) => { input: PlayerInput; done: boolean };
/** Holds nothing until `until`. */
export const waitFor = (until: (r: RunState) => boolean): Ctl => (r) => ({ input: idle, done: until(r) });
/** Runs the way `dir` says until `until`. */
export const runUntil = (dir: 1 | -1, until: (r: RunState) => boolean): Ctl => (r) => ({ input: { move: dir, jumpHeld: false }, done: until(r) });
/**
 * Runs the way `dir` says and, standing with his middle past `x` (that way) and jump up for a step (L-048), presses jump and holds it
 * while he rises (`top`) or until his middle is past `until` (that way); done on the landing.
 */
export function jumpAt(x: number, hold: 'top' | number, dir: 1 | -1 = 1): Ctl {
  let pressed = false;
  let air = false;
  return (r) => {
    const p = r.player;
    if (!pressed) {
      pressed = p.grounded && dir * (p.x - x) >= 0 && !p.jumpWasHeld;
      return { input: { move: dir, jumpHeld: pressed }, done: false };
    }
    if (!p.grounded) air = true;
    if (air && p.grounded) return { input: { move: dir, jumpHeld: false }, done: true };
    return { input: { move: dir, jumpHeld: hold === 'top' ? p.vy < 0 : dir * (p.x - hold) < 0 }, done: false };
  };
}
/** The hop into the cart on rail `letter`, as `hopIn`; done once it rolls with him in it. */
export function hopInto(letter: Letter): Ctl {
  let jumpWas = false;
  return (r) => {
    if (r.carts[cartOf(letter)]!.phase !== 'waiting' && inCart(r, letter)) return { input: idle, done: true };
    const gap = middleOf(r, letter) - r.player.x;
    const p = r.player;
    const jump = p.grounded ? !jumpWas && !p.jumpWasHeld && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0;
    jumpWas = jump;
    // Standing under the cart (nearer its middle than 20 px), he first walks back out from under it.
    const out = p.grounded && Math.abs(gap) < 20;
    return { input: { move: out ? (gap >= 0 ? -1 : 1) : Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: jump }, done: false };
  };
}
/** Riding, nothing held until `when`; then the jump `kind`, nothing else held; done on the landing. */
export function jumpFromCart(when: (r: RunState) => boolean, kind: Jump, move: 0 | 1 = 0): Ctl {
  let i = -1;
  let input: ((r: RunState, i: number) => PlayerInput) | undefined;
  let air = false;
  return (r) => {
    if (input === undefined) {
      if (!when(r)) return { input: idle, done: false };
      input = jumper(kind, move);
    }
    i++;
    if (!r.player.grounded) air = true;
    if (air && r.player.grounded) return { input: idle, done: true };
    return { input: input(r, i), done: false };
  };
}
/**
 * The pen as the bots meet it, dropped in by walking off the seat: they stand; when the ball's flash ends they glide (jump held to the
 * landing, nothing else held; with `kind` 'top', the plain jump, held while he rises); once it lies dazed they run to it and swing the claw (a dazed ball is defeated by it); done when it is gone,
 * or after 300 steps.
 */
export function penBot(kind: 'held' | 'top' = 'held'): Ctl {
  let holding = false;
  let air = false;
  let n = 0;
  return (r) => {
    const b = ball(r);
    const p = r.player;
    n++;
    if (!b.alive || n > 300) return { input: idle, done: true };
    if (holding) {
      if (!p.grounded) air = true;
      if (air && p.grounded) holding = false;
      return { input: { move: 0, jumpHeld: holding && (kind === 'held' || p.vy < 0) }, done: false };
    }
    if (b.shell!.phase === 'tuck' && b.shell!.age === ARMADILLO.tuckSteps - 1 && p.grounded && !p.jumpWasHeld) {
      holding = true;
      air = false;
      return { input: { move: 0, jumpHeld: true }, done: false };
    }
    if (b.shell!.phase === 'dazed' && p.grounded) {
      const dx = b.x - p.x;
      return { input: { move: Math.abs(dx) > 18 ? Math.sign(dx) : 0, jumpHeld: false, claw: Math.abs(dx) <= 22 && n % 2 === 0 }, done: false };
    }
    return { input: idle, done: false };
  };
}
export const standsOnFloor = (row: number, col0: number, col1: number) => (r: RunState) => r.player.grounded && r.player.y === Y(row) && r.player.x + 6 > col0 * TILE && r.player.x - 6 < (col1 + 1) * TILE;
/** Ten on foot, from the ofrenda at 110 to standing on the island: the seat, the pen, the far wall, the two hops. */
export const TEN_TO_ISLAND = (): Ctl[] => [
  runUntil(1, (r) => r.player.x >= LEVEL_3_2_SEAT.col0 * TILE - 6 - 1e-6),
  jumpAt(LEVEL_3_2_SEAT.col0 * TILE - 7, 'top'),
  runUntil(1, standsOnFloor(LEVEL_3_2_PEN.row, LEVEL_3_2_PEN.col0, LEVEL_3_2_PEN.col1)),
  penBot(),
  jumpAt(2030, 'top'),
  waitFor(standsOnFloor(11, LEVEL_3_2_FAR_WALL.col0, LEVEL_3_2_FAR_WALL.col1)),
  jumpAt(2080, 2140),
  waitFor(standsOnFloor(11, LEVEL_3_2_PILLAR.col0, LEVEL_3_2_PILLAR.col1)),
  jumpAt(2184, 'top'),
];

export interface Bot {
  readonly states: readonly RunState[];
  /** The steps on which a life was lost. */
  readonly lost: readonly number[];
  /** The step each task was done on. */
  readonly marks: readonly number[];
  readonly end: RunState;
}
/**
 * Plays `tasks` in turn from `from` (at most `max` steps); while he waits to respawn it holds nothing, and it stops at the level's clear,
 * and with `stopAtLoss` at the first life lost.
 */
export function bot(tasks: readonly Ctl[], from: RunState, max = 4000, stopAtLoss = false): Bot {
  const states: RunState[] = [];
  const lost: number[] = [];
  const marks: number[] = [];
  let r = from;
  let k = 0;
  while (k < tasks.length && states.length < max && r.phase !== 'clear' && r.phase !== 'gameover') {
    if (r.phase !== 'playing') {
      r = stepRun(r, idle, L);
      states.push(r);
      continue;
    }
    const { input, done } = tasks[k]!(r);
    if (done) {
      marks.push(states.length);
      k++;
      continue;
    }
    const before = r.lives.lives;
    r = stepRun(r, input, L);
    if (r.lives.lives < before) lost.push(states.length);
    states.push(r);
    if (stopAtLoss && lost.length > 0) break;
  }
  return { states, lost, marks, end: r };
}
export const OFRENDA_2 = L.ofrendas[1]!;



export const TEN = (): Ctl[] => [...TEN_TO_ISLAND(), hopInto('F')];
/** The spike hollow's first column's left edge. */
export const LAST_TILE_F = 176 * TILE;


/** The gallery on foot: runs right; stops when the Armadillo tucks near him, and glides (held, nothing else) at its flash's end; jumps (held while rising) at an Alacrán 36 px ahead. Done past `x`. */
export function galleryBot(x: number): Ctl {
  let holding: 'top' | 'held' | undefined;
  let air = false;
  return (r) => {
    const p = r.player;
    if (holding) {
      if (!p.grounded) air = true;
      if (air && p.grounded) holding = undefined;
      else return { input: { move: holding === 'top' ? 1 : 0, jumpHeld: holding === 'held' || p.vy < 0 }, done: false };
    }
    if (p.x >= x && p.grounded) return { input: right, done: true };
    const b = r.enemies[GALLERY_BALL]!;
    const near = b.alive && Math.abs(b.x - p.x) < 120;
    if (near && b.shell!.phase === 'tuck') {
      if (b.shell!.age === ARMADILLO.tuckSteps - 1 && p.grounded && !p.jumpWasHeld) {
        holding = 'held';
        air = false;
        return { input: { move: 0, jumpHeld: true }, done: false };
      }
      return { input: idle, done: false };
    }
    if (near && b.shell!.phase === 'roll') return { input: idle, done: false };
    const ahead = [1, 3].some((k) => r.enemies[k]!.alive && r.enemies[k]!.x - p.x > 0 && r.enemies[k]!.x - p.x < 36 && Math.abs((r.enemies[k]!.y ?? 0) - p.y) < 8);
    if (ahead && p.grounded && !p.jumpWasHeld) {
      holding = 'top';
      air = false;
      return { input: { move: 1, jumpHeld: true }, done: false };
    }
    return { input: right, done: false };
  };
}
/** Ten on foot from the island to the ofrenda at 181: through standing cart F, a glide over pit F, the gallery, a glide over the ramp to the ledge. */
export const TEN_ON_FOOT = (): Ctl[] => [
  jumpAt(LEVEL_3_2_PITS.F.col0 * TILE - 14, (LEVEL_3_2_PITS.F.col1 + 2) * TILE),
  galleryBot(2620),
  jumpAt(2620, LEDGE_F + TILE),
  runUntil(1, (r) => r.checkpointIndex >= 2),
];

/** What cost the life lost on `states[i]`: the enemy nearest him on the step before (by its place in the list), or `spikes` or `pit`. */
export function causeOf(states: readonly RunState[], i: number): string {
  const r = states[Math.max(0, i - 1)]!;
  const p = r.player;
  const near = r.enemies.map((e, k) => ({ k, d: e.alive ? Math.abs(e.x - p.x) : Infinity })).reduce<{ k: number; d: number } | undefined>((m, e) => (e.d < 24 && (m === undefined || e.d < m.d) ? e : m), undefined);
  if (near) return `${near.k === GALLERY_BALL || near.k === PEN_BALL ? 'armadillo' : 'alacran'} ${near.k}`;
  return L.spikes.some((sp) => Math.abs(sp.col * TILE + 8 - p.x) < 16) ? 'spikes' : 'pit';
}
/** He has walked into the Armadillo's sight already (its tuck under way or done): stop walking. */
export const states0 = (r: RunState) => r.enemies[GALLERY_BALL]!.shell!.phase !== 'walk';

export const K_LIP = LEVEL_3_2_LEDGES.K3.col0 * TILE;
/** A Ketsu flight's ending: in a cart, on the ledge past K3's lip, on a floor or a ramp, or `lost`. */
export const ketsu = (f: Flight) => upperLanding(f, K_LIP);
/** The K1 ride from a hop in from the ofrenda at 181, K1's Alacrán `t` steps into its walk: every state from the landing to the cart's leaving and 6 more. */
export function rideK1(t: number): RunState[] {
  const o = L.ofrendas[2]!;
  const hop = hopIn(atT(o.x, o.y, t), 'K1');
  const landed = hop[hop.length - 1]!;
  return [landed, ...play(landed, 300, () => idle, (r, i) => r.carts[cartOf('K1')]!.phase === 'falling' && i > 0 && r.carts[cartOf('K1')]!.m >= railLength(railOf('K1')) + 6 * 2.5)];
}
/** The rides' states to sweep: from the landing to the step before the cart leaves, and the leaving step and the 5 after it (coyote time). */
export function brokenRides(ride: readonly RunState[], letter: Letter): RunState[] {
  const leave = ride.findIndex((st) => st.carts[cartOf(letter)]!.phase === 'falling');
  return ride.slice(0, leave + 6);
}


/** The landings in K2 of the K1 sweep, four jumps, right held and nothing held, one per place of the K2 cart and him at the landing. */
export function arrivalsInK2(): RunState[] {
  const k1 = brokenRides(rideK1(0), 'K1');
  const seen = new Map<string, RunState>();
  for (const move of [1, 0] as const) {
    const flights = sweep(k1, move);
    for (const kind of JUMPS) for (const f of flights[kind]) if (ketsu(f) === 'cart K2') seen.set(`${f.landed!.carts[cartOf('K2')]!.m}`, f.landed!);
  }
  return [...seen.values()];
}
export const K2_BEAM_FACE = LEVEL_3_2_BEAMS.K2.col * TILE;


/**
 * Runs right past Alacrán `k`: when it is alive 36 px or less ahead at his height, a plain full jump straight up (nothing else held), on
 * which it walks under him and is stomped, or turns; done past `x`.
 */
export function alacranBot(k: number, x: number): Ctl {
  let rising = false;
  return (r) => {
    const p = r.player;
    if (rising) {
      rising = !p.grounded || p.vy < 0;
      if (rising) return { input: { move: 0, jumpHeld: p.vy < 0 }, done: false };
    }
    if (p.x >= x && p.grounded) return { input: right, done: true };
    const e = r.enemies[k]!;
    if (e.alive && e.x - p.x > 0 && e.x - p.x < 36 && Math.abs((e.y ?? 0) - p.y) < 8 && p.grounded && !p.jumpWasHeld) {
      rising = true;
      return { input: { move: 0, jumpHeld: true }, done: false };
    }
    return { input: right, done: false };
  };
}
export const passed = (i: number) => (r: RunState) => r.checkpointIndex >= i;
/** The rider's route in four pieces, each to the next ofrenda (the last to the exit), with the windows measured above. */
export const RIDE_KI = (): Ctl[] => [
  runUntil(1, (r) => r.carts[cartOf('A')]!.phase !== 'waiting'),
  jumpFromCart((r) => r.player.x >= 320, 'top'),
  jumpFromCart((r) => endOf('B') - r.player.x <= 30, 'top'),
  jumpFromCart((r) => endOf('C') - r.player.x <= 30, 'top'),
  runUntil(1, passed(0)),
];
export const RIDE_SHO = (): Ctl[] => [
  hopInto('D'),
  jumpFromCart((r) => endOf('D') - r.player.x <= 30, 'top'),
  hopInto('E'),
  jumpFromCart((r) => BEAM_FACE - r.player.x <= 40, 'top'),
  waitFor((r) => !inCart(r, 'E')),
  runUntil(1, passed(1)),
];
export const RIDE_TEN = (): Ctl[] => [...TEN(), jumpFromCart((r) => r.player.x >= 2625, 'top'), runUntil(1, passed(2))];
export const RIDE_KETSU = (): Ctl[] => [
  hopInto('K1'),
  jumpFromCart((r) => endOf('K1') - r.player.x <= 30, 'top'),
  jumpFromCart((r) => K2_BEAM_FACE - r.player.x <= 40, 'top'),
  jumpFromCart((r) => endOf('K2') - r.player.x <= 20, 'top'),
  jumpFromCart((r) => r.player.x >= 3625, 'top'),
  runUntil(1, (r) => r.phase === 'clear'),
];
/** The walker's route, never boarding a cart, in the same four pieces. */
export const WALK_KI = (): Ctl[] => [
  jumpAt(7 * TILE + 4, 'top'),
  runUntil(1, (r) => r.player.grounded && r.player.y === Y(15) && r.player.x >= (LEVEL_3_2_SUNKEN.col1 + 1) * TILE - 7),
  jumpAt(0, 'top'),
  runUntil(1, passed(0)),
];
export const WALK_SHO = (): Ctl[] => [jumpAt(LEVEL_3_2_PIT_D.col0 * TILE - 12, (LEVEL_3_2_PIT_D.col1 + 2) * TILE), runUntil(1, passed(1))];
export const WALK_TEN = (): Ctl[] => [...TEN_TO_ISLAND(), ...TEN_ON_FOOT()];
export const WALK_KETSU = (): Ctl[] => [
  runUntil(1, (r) => r.player.x >= 2990),
  jumpAt(2995, 3070),
  alacranBot(K1_ALACRAN, 3100),
  jumpAt(3132, 3262),
  runUntil(1, (r) => r.player.x >= 3395),
  jumpAt(3413, 3700),
  runUntil(1, (r) => r.player.x >= 3636),
  jumpAt(3640, K_LIP + TILE),
  runUntil(1, (r) => r.phase === 'clear'),
];

/**
 * A whole-level bot with the enemies `t` steps into their walks: Ki and Shō (no enemy there) are played once from the start, and the rest
 * from the ofrenda at 110 with every enemy as it would be then (`enemiesAt(t + steps)`: none of them has seen him before that).
 */
export const tally = (into: Record<string, number>, key: string) => (into[key] = (into[key] ?? 0) + 1);
/** A list's least and greatest, or `none`. */
export const span = (a: readonly number[]) => (a.length === 0 ? 'none' : `${Math.min(...a)} to ${Math.max(...a)}`);


/**
 * The careful read from the seat, found by sweeping every step of the pen ball's walk (`level3-2.sweeps.test.ts`): drop in when the ball
 * walks toward the seat (heading left) with its middle at least `tiles` tiles from the seat's right edge.
 */
export const CAREFUL_READ = { heading: -1, tiles: 4 } as const;
/** Does the careful read let him drop now? */
export const carefulDrop = (r: RunState): boolean =>
  ball(r).alive && ball(r).shell!.phase === 'walk' && ball(r).dir === CAREFUL_READ.heading && ball(r).x - SEAT_EDGE >= CAREFUL_READ.tiles * TILE;
/** Onto the seat, standing still there: where the careful rider reads the pen from. */
export const ONTO_SEAT = (): Ctl[] => [...TEN_TO_ISLAND().slice(0, 2), waitFor((r) => r.player.grounded && r.player.vx === 0)];
/**
 * The careful rider's Ten: onto the seat, where he stands until the careful read lets him drop, then off the seat into the pen (walking off)
 * and the pen as `penBot` meets it (the glide at the flash's end), and on over the far wall and the two hops into cart F.
 */
export const CAREFUL_TEN = (): Ctl[] => [...ONTO_SEAT(), waitFor(carefulDrop), ...TEN_TO_ISLAND().slice(2), hopInto('F')];
/** What the simulation reads of a run to go on: everything but its clock and the hilos taken (which move nothing). */
export const drivingState = (r: RunState) => JSON.stringify({ ...r, clock: 0, hilosTaken: [], buttonsHeld: 0 });
