// GDD-WLD-18: the shared drivers of 3-3's tests (`level3-3.test.ts`, `level3-3.enemies.test.ts` and the bots after them): the level's pieces by
// name, the jumps flown from a take-off, and where a flight ended. Pure, no Phaser; test support only, as `level3-2.drive.ts` is for 3-2.
import { CART, HITBOX, TILE } from '../config/tuning';
import { floorUnder, railLength, type CartState, type Rail } from '../sim/cart';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { platformAt, standsOnPlatform } from '../sim/platform';
import { startRun, stepRun, touchesOfrenda, type Level, type RunState } from '../sim/run';
import type { LevelEntry } from './index';
import { LEVEL_3_3, LEVEL_3_3_AT, LEVEL_3_3_PLATFORM, LEVEL_3_3_RAIL } from './level3-3';

export const L = LEVEL_3_3;
export const world = L.world;
export const entry = (level: Level = L): LevelEntry => ({ id: '3-3', world: 3, test: false, level });
export const mid = (col: number) => col * TILE + TILE / 2;
/** The y of a row's top. */
export const Y = (row: number) => row * TILE;
export const idle: PlayerInput = { move: 0, jumpHeld: false };
export const right: PlayerInput = { move: 1, jumpHeld: false };
export const standing = (x: number, y: number, vx = 0): PlayerState => ({ ...spawn(x, y), grounded: true, vx, facing: vx < 0 ? -1 : 1 });
/** A fresh run of `level` with Poncho standing at (x, y), running at `vx`, its platforms `tick` steps on. */
export const at = (x: number, y: number, vx = 0, tick = 0, level: Level = L): RunState => ({ ...startRun(level), player: standing(x, y, vx), platformTick: tick });
/** The rails by name and each cart's place in a run's `carts`. */
export const NAMES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'] as const;
export type Name = (typeof NAMES)[number];
export const cartOf = (name: Name) => NAMES.indexOf(name);
export const railOf = (name: Name): Rail => LEVEL_3_3_RAIL[name];
/** A rail's end, in px across. */
export const endOf = (name: Name) => railOf(name).x + railOf(name).dir * railLength(railOf(name));
export const middleOf = (r: RunState, name: Name) => railOf(name).x + railOf(name).dir * r.carts[cartOf(name)]!.m;
/** Standing in the cart: it is on its rail and he is on its floor under his feet. */
export function inCart(r: RunState, name: Name): boolean {
  const c = r.carts[cartOf(name)]!;
  if (c.phase === 'falling' || c.phase === 'gone') return false;
  return standsOnPlatform(r.player, floorUnder(railOf(name), c, r.player.x));
}
export const hiloIndex = (col: number, row: number) => L.hilos!.findIndex((h) => h.col === col && h.row === row);
export const took = (r: RunState, col: number, row: number) => r.hilosTaken[hiloIndex(col, row)] === true;
export const lost = (r: RunState, from: RunState) => r.lives.lives < from.lives.lives || r.phase === 'respawning' || r.phase === 'gameover';
/** Which of `hilos` run `r` has taken, as "col,row". */
export const tookOf = (r: RunState, hilos: readonly (readonly [number, number])[]) => hilos.filter(([c, w]) => took(r, c, w)).map(([c, w]) => `${c},${w}`);

/** Steps `run` with `input` until `done` or `max` steps (L-064), returning every state. */
export function play(run: RunState, max: number, input: (r: RunState, i: number) => PlayerInput, done: (r: RunState, i: number) => boolean = () => false, level: Level = L): RunState[] {
  const out: RunState[] = [];
  let r = run;
  for (let i = 0; i < max && !done(r, i); i++) {
    r = stepRun(r, input(r, i), level);
    out.push(r);
  }
  return out;
}
export const last = <T,>(a: readonly T[]): T => a[a.length - 1]!;

/**
 * The jumps of the sweeps, each pressed on its first step with the direction `move` held throughout: the plain jump (`top`, held while he
 * rises and let go at the top, GDD-WLD-18's "a jump not held"), and `held` to the landing, the glide once he falls (GDD-MOV-07).
 */
export type Jump = 'top' | 'held';
export function jumper(kind: Jump, move: -1 | 0 | 1): (r: RunState, i: number) => PlayerInput {
  let top = -1;
  return (r, i) => {
    if (i === 0 || kind === 'held') return { move, jumpHeld: true };
    if (top < 0 && r.player.vy >= 0) top = i;
    return { move, jumpHeld: top < 0 };
  };
}

/** One flight: where he took off, whether a life was lost, the state he landed in (or cleared the level in) and every state. */
export interface Flight {
  readonly x: number;
  readonly lost: boolean;
  readonly landed?: RunState;
  readonly states: readonly RunState[];
}

/** A jump `kind` pressed on the step after `from`: every state up to his landing (grounded after he was in the air), the exit, a lost life or 400 steps. */
export function fly(from: RunState, kind: Jump, move: -1 | 0 | 1 = 1, level: Level = L): Flight {
  const input = jumper(kind, move);
  const states: RunState[] = [];
  let r = from;
  let air = !from.player.grounded;
  for (let i = 0; i < 400; i++) {
    r = stepRun(r, input(r, i), level);
    states.push(r);
    if (r.phase === 'clear') return { x: from.player.x, lost: false, landed: r, states };
    if (lost(r, from)) return { x: from.player.x, lost: true, states };
    if (!r.player.grounded) air = true;
    else if (air) return { x: from.player.x, lost: false, landed: r, states };
  }
  return { x: from.player.x, lost: false, states };
}

/** Where he stands in run `r`, by name: a cart, a platform, a plank, a named ground, the hollow's cap or floor, a slope; or `air`. */
export function whereIs(r: RunState): string {
  if (r.phase === 'clear') return 'exit';
  const p = r.player;
  if (!p.grounded) return 'air';
  const cart = NAMES.find((n) => inCart(r, n));
  if (cart) return `cart ${cart}`;
  for (const [name, plat] of Object.entries(LEVEL_3_3_PLATFORM)) if (standsOnPlatform(p, platformAt(plat, r.platformTick))) return name;
  const col = Math.floor(p.x / TILE);
  const plank = L.crumbles.find((c) => p.y === Y(c.row) && Math.abs(p.x - mid(c.col)) < (HITBOX.width + TILE) / 2);
  if (plank && !world.solidTile(col, p.y / TILE)) return 'plank';
  const over = (col0: number, col1: number) => p.x + HITBOX.width / 2 > Y(col0) && p.x - HITBOX.width / 2 < Y(col1 + 1);
  if (p.y === Y(26) && over(22, 25)) return 'cap';
  if (p.y === Y(31) && over(23, 24)) return 'hollow';
  const near = Object.entries(LEVEL_3_3_AT).find(([, s]) => p.y === Y(s.row) && p.x + HITBOX.width / 2 > s.col0 * TILE && p.x - HITBOX.width / 2 < (s.col1 + 1) * TILE);
  return near ? near[0] : `ground ${p.y}`;
}
/** Where a flight ended: `lost`, `exit`, or where he landed (`whereIs`). */
export const landedAs = (f: Flight) => (f.lost ? 'lost' : f.landed ? whereIs(f.landed) : 'air');
/** His column, to 0.1, where a flight landed. */
export const colOf = (f: Flight) => (f.landed ? Math.round((f.landed.player.x / TILE) * 10) / 10 : null);
/** A take-off at x on row `row`'s ground: its box over a solid tile of that row with no solid tile over it (the level's tiles). */
export const standsOnTile = (x: number, row: number) =>
  [Math.floor((x - HITBOX.width / 2) / TILE), Math.floor((x + HITBOX.width / 2 - 1e-6) / TILE)].some((col) => world.solidTile(col, row) && !world.solidTile(col, row - 1));
/** Take-offs 0.2 tile (3.2 px) apart from a to b, both included. */
export const apart = (a: number, b: number): number[] => Array.from({ length: Math.floor((b - a) / (0.2 * TILE) + 1e-6) + 1 }, (_, i) => a + i * 0.2 * TILE);

/** The first state of a flight in which his body is against P3's face (x = 1728) in the air, as px over L1's top (y = 464), or null. */
export const faceOf = (f: Flight, face: number, floor: number) => {
  const s = f.states.find((r) => !r.player.grounded && Math.abs(r.player.x + HITBOX.width / 2 - face) < 1e-6);
  return s ? Math.round((floor - s.player.y) * 10) / 10 : null;
};

/** A flight thrown up by the spring on the way (GDD-WLD-05: 480 px/s up, on a step he was falling before). */
export const bounced = (f: Flight) => f.states.some((q, i) => i > 0 && q.player.vy < -400 && f.states[i - 1]!.player.vy > 0);

/**
 * The gap between his box's top and the bottom of bat `bat` (an index into `enemies`, the last by default; the bats' boxes are 16 x 10) at its least
 * while his box is across from it and his feet are not above its top: negative is a hit. Infinity if he is never under it.
 */
export const underBat = (f: Flight, bat = 6) =>
  Math.min(
    ...f.states
      .filter((r) => Math.abs(r.player.x - r.enemies[bat]!.x) < (HITBOX.width + 16) / 2 && r.player.y > r.enemies[bat]!.loop!.y - 5)
      .map((r) => r.player.y - HITBOX.height - (r.enemies[bat]!.loop!.y + 5)),
  );

/**
 * A ride on the cart of rail `name` from a hop straight up out of standing at its middle (he lands back in it: it starts), nothing held:
 * every state from the landing until `after` steps past the cart leaving its broken end (or stopping), at most 600.
 */
export function rideOn(name: Name, after: number, level: Level = L, tick = 0): RunState[] {
  const rail = railOf(name);
  const from = at(rail.x + (rail.dir * CART.width) / 2, rail.y, 0, tick, level);
  const hop = play(from, 120, (r, i) => ({ move: 0, jumpHeld: i === 0 || r.player.vy < 0 }), (r) => r.carts[cartOf(name)]!.phase !== 'waiting', level);
  const landed = last(hop);
  let end = -1;
  return [
    landed,
    ...play(landed, 600, () => idle, (r, i) => {
      if (end < 0 && ['falling', 'stopped'].includes(r.carts[cartOf(name)]!.phase)) end = i;
      return end >= 0 && i >= end + after;
    }, level),
  ];
}

/** The level's idle run from its start, memoised: Poncho waiting at the spawn, out of every enemy's sight, so the enemies, carts and lifts are at their clock. */
const idleRuns: RunState[] = [];
export function idleRun(t: number): RunState {
  if (idleRuns.length === 0) idleRuns.push(startRun(L));
  while (idleRuns.length <= t) idleRuns.push(stepRun(last(idleRuns), idle, L));
  return idleRuns[t]!;
}
/** A run `t` steps into the level with every enemy, cart and lift at that clock (`sightSweep`'s `takeoffRun`), Poncho standing at (x, y), running at `vx`. */
export const atT = (x: number, y: number, t: number, vx = 0): RunState => ({ ...idleRun(t), player: standing(x, y, vx), clock: 0 });

// ---------------------------------------------------------------------------------------------------------------------------------------
// Phase B1: the enemies driven over their clocks, the answers and what each came to.

/** The enemies' places in `LEVEL_3_3_ENEMIES`, by name: the three Cacomixtles, the Armadillo, the three Murciélagos and the Zopilote. */
export const E = { K1: 0, K2: 1, K3: 2, ARMADILLO: 3, BAT1: 4, BAT2: 5, BAT3: 6, ZOPILOTE: 7 } as const;
const ENEMY_NAMES = ['K1', 'K2', 'K3', 'Armadillo', 'bat 1', 'bat 2', 'bat 3', 'Zopilote'] as const;

/**
 * What took the life lost on the step from `prev` with `input`: the enemy whose removal from the level (and from `prev`) leaves that step with no
 * life lost; when two reach him on that step, the pair whose removal does (`K3 + Zopilote`); or `no enemy` (a pit, a plank, a fall). A diagnosis of
 * one step on copies; the drive's own run is on the real level (L-014).
 */
export function causeOf(prev: RunState, input: PlayerInput, level: Level = L): string {
  const without = (gone: readonly number[]) => {
    const keep = (_e: unknown, j: number) => !gone.includes(j);
    return !lost(stepRun({ ...prev, enemies: prev.enemies.filter(keep) }, input, { ...level, enemies: level.enemies.filter(keep) }), prev);
  };
  const live = level.enemies.map((_, i) => i).filter((i) => prev.enemies[i]!.alive);
  const one = live.filter((i) => without([i]));
  if (one.length > 0) return one.map((i) => ENEMY_NAMES[i]).join(' + ');
  const both = new Set(live.flatMap((i) => live.filter((j) => j > i && without([i, j])).flatMap((j) => [i, j])));
  return both.size === 0 ? 'no enemy' : live.filter((i) => both.has(i)).map((i) => ENEMY_NAMES[i]).join(' + ');
}

/** One drive: every state, whether a life was lost (a respawn or one less) and what took it (`causeOf`). A step with `input` is made while `done` is false, at most `max` (L-064). */
export interface Drive {
  readonly states: readonly RunState[];
  readonly lost: boolean;
  readonly cause: string;
}
export function drive(from: RunState, max: number, input: (r: RunState, i: number) => PlayerInput, done: (r: RunState, i: number) => boolean = () => false, level: Level = L): Drive {
  const states: RunState[] = [];
  let r = from;
  for (let i = 0; i < max && !done(r, i); i++) {
    const press = input(r, i);
    const next = stepRun(r, press, level);
    states.push(next);
    if (lost(next, from)) return { states, lost: true, cause: causeOf(r, press, level) };
    r = next;
  }
  return { states, lost: false, cause: '' };
}

/** `n` steps of nothing held from `from`, each state kept (index 0 is `from`): the places a later answer is pressed from, up to the step before a life is lost. */
export function waited(from: RunState, n: number, level: Level = L): RunState[] {
  const out = [from];
  for (let i = 0; i < n; i++) {
    const next = stepRun(last(out), idle, level);
    if (lost(next, from)) break;
    out.push(next);
  }
  return out;
}

/**
 * A jump `kind` pressed on the first step from `from` with `move` held, then let go once he has landed (L-048), until `done` (it gets the
 * state and the steps counted from the landing, -1 before it) or `max` steps.
 */
export function jumpFrom(from: RunState, kind: Jump, move: -1 | 0 | 1, max: number, done: (r: RunState, afterLanding: number) => boolean, level: Level = L): Drive {
  const jump = jumper(kind, move);
  let air = false;
  let landed = -1;
  return drive(from, max, (r, i) => (landed >= 0 ? idle : jump(r, i)), (r, i) => {
    if (!r.player.grounded) air = true;
    if (air && landed < 0 && r.player.grounded && i > 0) landed = i;
    return done(r, landed < 0 ? -1 : i - landed);
  }, level);
}

/** The take-off steps of a sweep that ended alike, in order: "k0-k1 what" ("k what" for one). */
export function runsOf(tags: readonly string[], k0 = 0): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 1; i <= tags.length; i++) {
    if (i < tags.length && tags[i] === tags[from]) continue;
    out.push(`${from + k0 === i - 1 + k0 ? from + k0 : `${from + k0}-${i - 1 + k0}`} ${tags[from]}`);
    from = i;
  }
  return out;
}

/** The clocks of an idle period of `period` steps, every `step` steps (6 at most, for every clock). */
export const clocks = (period: number, step = 6): number[] => Array.from({ length: Math.ceil(period / step) }, (_, i) => i * step);


/**
 * A Cacomixtle woken and parked: its ringtail and its cart as they are once the cart has stopped at its buffer, for a drive that starts after the
 * ringtail's answer (a stomp leaves the cart rolling on empty to the same buffer, GDD-ENM-04). Woken by Poncho standing at (x, y) for one step, which
 * is then put at (safeX, safeY), where no cart comes; run on until `ride` is parked. `clock` is the step of the level it happens at.
 */
function parkedOf(enemy: number, name: Name, wake: { x: number; y: number }, safe: { x: number; y: number }, clock = 0): { enemy: RunState['enemies'][number]; cart: CartState } {
  const first = stepRun(atT(wake.x, wake.y, clock), idle, L);
  const states = play({ ...first, player: standing(safe.x, safe.y) }, 600, () => idle, (r) => r.enemies[enemy]!.ride!.phase === 'parked');
  const end = last(states);
  return { enemy: end.enemies[enemy]!, cart: end.carts[cartOf(name)]! };
}
const PARKED = {
  K2: () => parkedOf(E.K2, 'R5', { x: 2650, y: Y(25) }, { x: 2456, y: Y(25) }),
  // The Zopilote is at the far end of its cruise on step 72, 143 px from K3's wake line, and never within 96 px of A.
  K3: () => parkedOf(E.K3, 'R6', { x: 2953, y: Y(25) }, { x: 3240, y: Y(17) }, 72),
};
const parkedCache: Partial<Record<keyof typeof PARKED, ReturnType<typeof parkedOf>>> = {};
/** `run` with the Cacomixtles `named` (K2, K3) already parked at their buffers, as after a drive that answered them. */
export function withParked(run: RunState, ...named: (keyof typeof PARKED)[]): RunState {
  let out = run;
  for (const n of named) {
    const p = (parkedCache[n] ??= PARKED[n]());
    const [i, rail] = n === 'K2' ? [E.K2, cartOf('R5')] : [E.K3, cartOf('R6')];
    out = { ...out, enemies: out.enemies.map((e, j) => (j === i ? p.enemy : e)), carts: out.carts.map((c, j) => (j === rail ? p.cart : c)) };
  }
  return out;
}

/** GDD-WLD-05: the place in `ofrendas` of the last ofrenda any of `states` touches (a glide over one reaches it), -1 for none: the checkpoint the drive should end with. */
export const reached = (states: readonly RunState[]): number => states.reduce((most, r) => L.ofrendas.reduce((m, o, i) => (touchesOfrenda(r.player, o) ? Math.max(m, i) : m), most), -1);
