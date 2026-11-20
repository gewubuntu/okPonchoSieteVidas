// GDD-WLD-18: the shared drivers of 3-3's tests (`level3-3.test.ts`, `level3-3.enemies.test.ts` and the bots after them): the level's pieces by
// name, the jumps flown from a take-off, and where a flight ended. Pure, no Phaser; test support only, as `level3-2.drive.ts` is for 3-2.
import { ARMADILLO, BASE_HEIGHT, BASE_WIDTH, CART, HITBOX, RUN, TILE } from '../config/tuning';
import { floorUnder, railLength, warningPost, type CartState, type Rail } from '../sim/cart';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { platformAt, standsOnPlatform } from '../sim/platform';
import { startRun, stepRun, touchesOfrenda, type Level, type RunState } from '../sim/run';
import { cutCameraY, followCamera } from '../ui/camera';
import type { Box } from '../sim/enemy';
import { jumpAt, runBot, runUntil, waitFor, type Bot, type Ctl } from './bots';
import type { LevelEntry } from './index';
import { LEVEL_3_3, LEVEL_3_3_AT, LEVEL_3_3_PLANKS, LEVEL_3_3_PLATFORM, LEVEL_3_3_RAIL, LEVEL_3_3_WALLS } from './level3-3';
import { stepSightCamera, type SightCamera, type View } from './sightSweep';

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
/** GDD-LIFE-03: the veladora is used up (taken, whether or not it restored a life). */
export const velaTaken = (r: RunState) => r.lives.used.has(`veladora:${L.veladora!.col},${L.veladora!.row}`);
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

// ---------------------------------------------------------------------------------------------------------------------------------------
// Phase V2: K3 and the Zopilote on P5, shared by `level3-3.enemies.test.ts`, `level3-3.vulture.test.ts`, `level3-3.vulture-answers.test.ts` and `level3-3.vulture-jump.test.ts`.

/** A ringtail in run `r`. */
export const ringtail = (r: RunState, i: number) => r.enemies[i]!;

/**
 * What an answer came to, as a word: a life lost and what took it; or no life lost and, in order, whether the ringtail was stomped and where he stands
 * (`whereIs`) when the drive ends.
 */
export function tag(d: { lost: boolean; cause: string; states: readonly RunState[] }, i: number, cps?: Set<number>, parks?: Set<number>): string {
  if (cps) {
    // GDD-WLD-05: the checkpoint he ends with is the last ofrenda any state of the drive touched.
    if (last(d.states).checkpointIndex !== reached(d.states)) throw new Error(`checkpoint ${last(d.states).checkpointIndex}, the last ofrenda touched is ${reached(d.states)}`);
    cps.add(last(d.states).checkpointIndex);
  }
  if (d.lost) return `lost ${d.cause}`;
  const end = last(d.states);
  // A ringtail that is alive when the drive ends is parked at its buffer, where its cart stopped.
  if (parks && ringtail(end, i).alive) parks.add(ringtail(end, i).x);
  const where = whereIs(end);
  // On P1 with the cart parked at x = 688 under the perch (672 to 704): short of it, beside it under the perch, or on its far side.
  const side = end.player.x < 672 ? 'left of the perch' : end.player.x <= 704 ? 'under the perch' : 'right of the perch';
  return `${ringtail(end, i).alive ? '' : 'stomp '}${where === 'P1' ? `P1 ${side}` : where}`;
}

/** The run `t` steps into the level with K2 already parked on Q (his answer is not this drive's), Poncho standing at (x, y). */
export const onP5 = (x: number, y: number, t: number): RunState => withParked(atT(x, y, t), 'K2');

export const k3Done = () => {
  let parked = -1;
  return (r: RunState, i: number) => {
    if (parked < 0 && ringtail(r, E.K3).ride!.phase === 'parked') parked = i;
    return parked >= 0 && i >= parked + 20;
  };
};
/** The level and runs without the Zopilote (it is the last enemy): a copy only to find where K3's own window is, for the sweep on the real level to go over. */
export const noZopilote: Level = { ...L, enemies: L.enemies.slice(0, E.ZOPILOTE) };
export const withoutZopilote = (r: RunState): RunState => ({ ...r, enemies: r.enemies.slice(0, E.ZOPILOTE) });

/** The places he waits at on P5: where K3 wakes (x = 2962), and a stopping distance short of x = 2992, under the vulture's line (x 2976 to 3072). */
export type Place = 'wake' | 'edge';

/** From P5's column 176, right held until `place`, then nothing until he stands still: the rest state and, if a life was lost on the way, what took it. */
export function waitAt(t: number, place: Place, level: Level = L): { rest: RunState; lost: boolean; cause: string } {
  let stop = false;
  const from = level === L ? onP5(mid(176), Y(25), t) : withoutZopilote(onP5(mid(176), Y(25), t));
  const d = drive(from, 300, (r) => {
    if (place === 'wake' ? ringtail(r, E.K3).ride!.phase !== 'waiting' : r.player.x >= 2992 - RUN.maxSpeed ** 2 / (2 * RUN.groundDecel)) stop = true;
    return stop ? idle : right;
  }, (r) => r.phase !== 'playing' || (stop && r.player.vx === 0 && r.player.grounded), level);
  return { rest: d.states.length > 0 && !d.lost ? last(d.states) : from, lost: d.lost, cause: d.cause };
}

export type KDrive = (w: RunState, level: Level) => Drive;
/** K3's answers, each with the word its drive ends in when it is the answer meant: the jump over its cart, the stomp, the landing in the cart behind it, the claw. */
const clawOnce: KDrive = (w, level) => drive(w, 500, (_r, i) => ({ move: 0, jumpHeld: false, claw: i === 0 }), k3Done(), level);
export const K3_ANSWERS: readonly (readonly [string, KDrive, string])[] = [
  ['held jump over', (w, level) => jumpFrom(w, 'held', 0, 500, k3Done(), level), 'P5'],
  ['plain jump over', (w, level) => jumpFrom(w, 'top', 0, 500, k3Done(), level), 'P5'],
  ['held jump, stomp', (w, level) => jumpFrom(w, 'held', 0, 500, k3Done(), level), 'stomp P5'],
  ['plain jump, stomp', (w, level) => jumpFrom(w, 'top', 0, 500, k3Done(), level), 'stomp P5'],
  ['held jump, in its cart', (w, level) => jumpFrom(w, 'held', 0, 500, k3Done(), level), 'cart R6'],
  ['plain jump, in its cart', (w, level) => jumpFrom(w, 'top', 0, 500, k3Done(), level), 'cart R6'],
  ['claw', clawOnce, 'stomp P5'],
];

/**
 * The steps the vulture must cruise (no telegraph, no dive, no climb back) before the standing follow-on ends: one, since once it cruises a
 * Poncho standing on the ground is out of its sight (the ground test in `level3-3.vulture.test.ts`), so a longer margin changes nothing (L-025).
 */
export const COOL_STEPS = 1;

/** One way of following an answer on: take-offs that kept the life (`kept`), the clocks with any (`clocks`), the others by cause, and where a walk ended. */
interface FollowOn {
  takeoffs: number;
  kept: number;
  clocks: number;
  lostTo: Record<string, number>;
  onA: number;
  short: number;
}

const freshFollowOn = (): FollowOn => ({ takeoffs: 0, kept: 0, clocks: 0, lostTo: {}, onA: 0, short: 0 });

/**
 * GDD-WLD-18's answers to K3: wait (`place`), let the cart come, and answer it at step k of the wait. K3's own window of each answer is found on a
 * copy without the vulture (a tool; its tag is the answer meant), then every one of those steps is pressed on the real level at every clock (`step` apart).
 * Per answer, at K3's buffer (the drive ends 20 steps after its cart parks): clocks with a take-off that lives (`some`), with all (`full`), none. Across
 * answers: clocks with any (`anyAnswer`). Every loss is split with `causeOf`, a wait that the vulture ends before a take-off too. Then every take-off
 * that lives is followed on two ways, and kept only if the life holds to the end: (a) standing still until the Zopilote has cruised COOL_STEPS steps
 * running (no telegraph or dive), 600 steps at most; (b) right held on to A, 600 steps at most, where a walk that keeps the life ends on A or still short.
 */
export function waitAndAnswer(place: Place, step: number) {
  const KS = 100;
  const alone = waited(waitAt(0, place, noZopilote).rest, KS, noZopilote);
  const windows = K3_ANSWERS.map(([, run, label]) => alone.flatMap((w, k) => (tag(run(w, noZopilote), E.K3) === label ? [k] : [])));
  const out: Record<string, { steps: number; none: number; some: number; full: number; ok: number }> = {};
  const lostTo: Record<string, Record<string, number>> = {};
  const follow: Record<string, { stand: FollowOn; walk: FollowOn }> = {};
  const waitLost: Record<string, number> = {};
  let anyAnswer = 0;
  for (const [i, [name]] of K3_ANSWERS.entries()) {
    out[name] = { steps: windows[i]!.length, none: 0, some: 0, full: 0, ok: 0 };
    follow[name] = { stand: freshFollowOn(), walk: freshFollowOn() };
  }
  for (const t of clocks(7200, step)) {
    const w = waitAt(t, place);
    if (w.lost) {
      waitLost[w.cause] = (waitLost[w.cause] ?? 0) + 1;
      continue;
    }
    const waits = waited(w.rest, KS);
    // The wait cut short is a life lost to what takes it, at every later step.
    const waitCause = waits.length <= KS ? causeOf(last(waits), idle) : '';
    let any = false;
    for (const [i, [name, run, label]] of K3_ANSWERS.entries()) {
      let good = 0;
      const kept = { stand: false, walk: false };
      for (const k of windows[i]!) {
        const d = k < waits.length ? run(waits[k]!, L) : undefined;
        const ok = d !== undefined && !d.lost && tag(d, E.K3) === label;
        if (ok) {
          good++;
          const end = last(d.states);
          let cool = 0;
          const ways = {
            stand: drive(end, 600, () => idle, (r) => (cool = zopilote(r).flight!.phase === 'cruise' ? cool + 1 : 0) >= COOL_STEPS),
            walk: drive(end, 600, () => right, onA),
          };
          for (const way of ['stand', 'walk'] as const) {
            const f = ways[way];
            const a = follow[name]![way];
            a.takeoffs++;
            if (f.lost) a.lostTo[f.cause] = (a.lostTo[f.cause] ?? 0) + 1;
            else {
              a.kept++;
              kept[way] = true;
              if (way === 'walk') {
                if (onA(last(f.states))) a.onA++;
                else a.short++;
              }
            }
          }
        } else {
          const cause = d ? (d.lost ? d.cause : `no longer ${label}`) : `while waiting: ${waitCause}`;
          const by = (lostTo[name] ??= {});
          by[cause] = (by[cause] ?? 0) + 1;
        }
      }
      const o = out[name]!;
      o.ok += good;
      if (good > 0) o.some++;
      if (good === windows[i]!.length) o.full++;
      if (good > 0) any = true;
      if (kept.stand) follow[name]!.stand.clocks++;
      if (kept.walk) follow[name]!.walk.clocks++;
    }
    if (any) anyAnswer++;
  }
  for (const o of Object.values(out)) o.none = clocks(7200, step).length - Object.values(waitLost).reduce((n, v) => n + v, 0) - o.some;
  return { atK3Buffer: out, anyAnswer, waitLost, lostAtK3Buffer: lostTo, follow };
}


export const zopilote = (r: RunState) => r.enemies[E.ZOPILOTE]!;
/** The run `t` steps in with K2 parked and, if named, K3 too (its cart parked at its buffer, x = 2912 to 2944, the ringtail on it), Poncho standing at (x, y) running at `vx`. */
export const onGroundAt = (x: number, y: number, t: number, vx = 0, ...parked: 'K3'[]): RunState => withParked(atT(x, y, t, vx), 'K2', ...parked);
export const telegraphed = (states: readonly RunState[]) => states.some((r) => zopilote(r).flight!.phase === 'telegraph');
export const lostToVulture = (d: Drive) => d.lost && d.cause.includes('Zopilote');
/** Where a walk ends: A (L-064 bounds the drive), standing on its ground past the lift. */
export const onA = (r: RunState) => r.phase === 'playing' && r.player.grounded && r.player.y === Y(17) && r.player.x >= 3240;

// ---------------------------------------------------------------------------------------------------------------------------------------
// Phase B2a: the whole-level bots (`level3-3.bots.test.ts`), played from `startAt(t)`.

/** The level as he finds it after standing at the spawn for `t` steps: every enemy, lift and cart at that clock, Poncho at the spawn, the step counter at 0. */
export const startAt = (t: number): RunState => ({ ...idleRun(t), clock: 0 });

/** A bot's run, and the input of its last step (the one a life was lost on, with `stopAtLoss`) for `causeOf`. */
export interface Played extends Bot {
  readonly lastInput: PlayerInput;
}
/** `runBot` on 3-3. */
export function bot(tasks: readonly Ctl[], from: RunState, max = 4000, stopAtLoss = false): Played {
  let lastInput = idle;
  const seen = tasks.map((task): Ctl => (r) => {
    const out = task(r);
    if (!out.done) lastInput = out.input;
    return out;
  });
  return { ...runBot(seen, from, L, max, stopAtLoss), lastInput };
}

/**
 * The hop into the cart on rail `name`, as 3-2's: done once it rolls with him in it. He jumps from 20 to `reach` px short of its middle: C3's is 40,
 * so that the jump is taken past the piñata at column 134, 48 to 64 px short of it, which a jump under it would bump.
 */
export function hopInto(name: Name, reach = 60): Ctl {
  let jumpWas = false;
  return (r) => {
    if (r.carts[cartOf(name)]!.phase !== 'waiting' && inCart(r, name)) return { input: idle, done: true };
    const gap = middleOf(r, name) - r.player.x;
    const p = r.player;
    const jump = p.grounded ? !jumpWas && !p.jumpWasHeld && Math.abs(gap) >= 20 && Math.abs(gap) <= reach : jumpWas && p.vy < 0;
    jumpWas = jump;
    // Standing under the cart (nearer its middle than 20 px), he first walks back out from under it.
    const out = p.grounded && Math.abs(gap) < 20;
    return { input: { move: out ? (gap >= 0 ? -1 : 1) : Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: jump }, done: false };
  };
}
/** Riding, nothing held until `when`; then the jump `kind`, with `move` held; done on the landing. */
export function jumpFromCart(when: (r: RunState) => boolean, kind: Jump, move: -1 | 0 | 1 = 0): Ctl {
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

/** P3's lip: the left edge of the pit after it (column 120). */
const P3_LIP = (LEVEL_3_3_AT.P3.col1 + 1) * TILE;
/** `jumpAt`'s `hold` for a held jump: jump held to the landing, the glide once he falls (GDD-MOV-07). */
const HELD = Infinity;
/** On the ground of row `row` (its top), a ground the bots stand on. */
const onRow = (row: number) => (r: RunState) => r.player.grounded && r.player.y === Y(row);
/** The wall's left face: his middle stands 6 px short of it (his box's half width). */
const WALL_FACE = (col: number) => col * TILE - HITBOX.width / 2;
/** Over a piñata's wall (2 tiles, GDD-WLD-18, L-047) with a plain jump, taken a tile short of its face: the bots break no piñata. */
const overWall = (col: number): Ctl => jumpAt(WALL_FACE(col) - TILE, 'top');
/** The cart on rail `name` is at the post of its broken end (or past it). */
const pastPost = (name: Name) => (r: RunState) => middleOf(r, name) * railOf(name).dir >= warningPost(railOf(name))!.x * railOf(name).dir;

/** Ki: C1 on foot from the spawn, R1 to its buffer, out onto P1, K1 woken and its cart jumped with a held jump at a walk from x 800, T1 and over its wall to the first ofrenda. */
export const RIDE_KI = (): Ctl[] => [
  runUntil(1, (r) => inCart(r, 'R1') && r.carts[cartOf('R1')]!.phase !== 'waiting'),
  waitFor((r) => r.carts[cartOf('R1')]!.phase === 'stopped'),
  runUntil(1, onRow(LEVEL_3_3_AT.P1.row)),
  jumpAt(800, HELD),
  overWall(LEVEL_3_3_WALLS.T1.col0),
  runUntil(1, (r) => r.checkpointIndex >= 0),
];

/**
 * The spring's plain launch and the lift (GDD-WLD-05, GDD-WLD-18): right held onto the spring, no button; nothing held from the launch (right let
 * go in the air) until he stands on the lift MP1, then right held, against P3's face as it rises, onto P3.
 */
export function springBot(): Ctl {
  let launched = false;
  let onLift = false;
  return (r) => {
    if (r.player.vy < -400) launched = true;
    if (whereIs(r) === 'MP1') onLift = true;
    if (r.player.grounded && r.player.y === Y(LEVEL_3_3_AT.P3.row) && r.player.x - HITBOX.width / 2 >= LEVEL_3_3_AT.P3.col0 * TILE) return { input: idle, done: true };
    return { input: !launched || onLift ? right : idle, done: false };
  };
}

/** Shō: C2 hopped into at 68, R3 ridden, a held jump from its post onto L1, the spring and the lift to P3. */
export const RIDE_SHO = (): Ctl[] => [
  hopInto('R3'),
  jumpFromCart(pastPost('R3'), 'held', 1),
  springBot(),
  armadilloBot(),
  // The glide on foot from P3's lip (GDD-WLD-18): a held jump a half tile short of it, over the pit to P4, over the second ofrenda (130).
  jumpAt(P3_LIP - 8, HELD),
  overWall(LEVEL_3_3_WALLS.P4.col0),
];

/** A cart's front edge in run `r`, and its gap in px to his box's edge it faces: positive while the cart (rolling its rail's way) is still short of him. */
const frontOf = (r: RunState, name: Name) => railOf(name).x + railOf(name).dir * (r.carts[cartOf(name)]!.m + CART.width / 2);
export const gapTo = (r: RunState, name: Name) => railOf(name).dir * (r.player.x - frontOf(r, name)) - HITBOX.width / 2;

/**
 * P3's Armadillo (the penBot of 3-2, for the narrow peak): right held until it tucks, then nothing held, he stands; once its ball rolls and its
 * front is `ARMADILLO_GAP` px or less from his front a held jump in place (GDD-WLD-18: "jump it"), a window of up to 59 of the 61 steps from the tuck (measured
 * in `level3-3.enemies.test.ts`); done on the landing, or once the ball is gone or dazed.
 */
export function armadilloBot(): Ctl {
  const jump = jumper('held', 0);
  let i = -1;
  let air = false;
  return (r) => {
    const a = r.enemies[E.ARMADILLO]!;
    const p = r.player;
    if (i >= 0) {
      i++;
      if (!p.grounded) air = true;
      if (air && p.grounded) return { input: idle, done: true };
      return { input: jump(r, i), done: false };
    }
    if (!a.alive || a.shell!.phase === 'dazed') return { input: idle, done: true };
    if (a.shell!.phase === 'walk') return { input: right, done: false };
    if (a.shell!.phase === 'roll' && p.grounded && !p.jumpWasHeld && a.x - ARMADILLO.width / 2 - (p.x + HITBOX.width / 2) <= ARMADILLO_GAP) {
      i = 0;
      return { input: jump(r, 0), done: false };
    }
    return { input: idle, done: false };
  };
}

/** The ball's front is jumped when it is this far from his: by a probe, not pinned, the gap changed nothing from 8 to 80 px over 150 clocks. */
const ARMADILLO_GAP = 32;
/** Right held until his middle is at `x`, then nothing, until he stands still: where he comes to rest is a stopping distance past it. */
export function runStopAt(x: number): Ctl {
  let stopped = false;
  return (r) => {
    if (r.player.x >= x) stopped = true;
    if (stopped && r.player.vx === 0 && r.player.grounded) return { input: idle, done: true };
    return { input: stopped ? idle : right, done: false };
  };
}

/**
 * A rolling cart `gap` px or less from his front (K2's on the pier, K3's on P5): until then `move` held (the walk to it, or nothing on the pier), then a
 * jump `kind` with `move` held; done on the landing. It reads where the cart is on the screen, never the clock.
 */
export function jumpCart(name: Name, gap: number, kind: Jump, move: 0 | 1): Ctl {
  const jump = jumper(kind, move);
  let i = -1;
  let air = false;
  return (r) => {
    if (i < 0 && !(r.carts[cartOf(name)]!.phase === 'rolling' && gapTo(r, name) <= gap)) return { input: { move, jumpHeld: false }, done: false };
    i++;
    if (!r.player.grounded) air = true;
    if (air && r.player.grounded) return { input: idle, done: true };
    return { input: jump(r, i), done: false };
  };
}

/** The stone pier's column (GDD-WLD-18: bridge B's one place to stand): he runs to its left edge and lets go of right, to stop on it. */
export const PIER_COL = 167;
/** Ten: C3 hopped into at 137, R4 to its buffer on Q, right held over bridge B's planks and let go to stop on the pier (a stopping distance short of its middle), K2's cart jumped held, then across the second span. */
export const RIDE_TEN = (): Ctl[] => [
  hopInto('R4', 40),
  waitFor((r) => r.carts[cartOf('R4')]!.phase === 'stopped'),
  runStopAt(PIER_COL * TILE),
  jumpCart('R5', K2_GAP, 'held', 0),
  runUntil(1, (r) => onRow(LEVEL_3_3_AT.P5.row)(r) && r.player.x - HITBOX.width / 2 >= LEVEL_3_3_AT.P5.col0 * TILE),
];
/** K2's cart is jumped when its front is this far from his: inside the held jump's window of 37 or 38 steps (GDD-WLD-18), which `level3-3.bots.test.ts` checks at the arrival it measures. */
const K2_GAP = 40;

/** The first-time line past K3 (GDD-WLD-18, `firstTimeLine` of `level3-3.enemies.test.ts`): right held; K3's cart once 32 px or less from his front, a held jump with right held; right held on. */
export const K3_GAP = 32;

/** The stairs (GDD-WLD-18): right held, and a jump on each landing (let go for a step before the next press, L-048), held while he rises; done in C4, which rolls. */
export function stairsBot(): Ctl {
  let was = false;
  return (r) => {
    if (inCart(r, 'R7') && r.carts[cartOf('R7')]!.phase !== 'waiting') return { input: idle, done: true };
    const jump = r.player.grounded ? !was : was && r.player.vy < 0;
    was = jump;
    return { input: { move: 1, jumpHeld: jump }, done: false };
  };
}

/** Ketsu: K3's cart jumped, right held on to the lift MP2 and up it onto A (the third ofrenda), the stairs into C4, and R7 to a held jump from its post into the exit. */
export const RIDE_KETSU = (): Ctl[] => [
  jumpCart('R6', K3_GAP, 'held', 1),
  runUntil(1, (r) => r.player.x >= LEVEL_3_3_AT.mp2Foot.col0 * TILE),
  runUntil(1, (r) => onRow(LEVEL_3_3_AT.A.row)(r) && r.player.x >= LEVEL_3_3_AT.A.col0 * TILE),
  stairsBot(),
  jumpFromCart(pastPost('R7'), 'held', 1),
];

// The careful bot (GDD-WLD-18's "careful run"): the rider with K1 answered from the perch, the Armadillo waited for, K3 met standing and MP2 waited for.

/** K1 woken from P1, then a held jump back with left held for `left` steps (24 or more lands on the perch, GDD-WLD-18); done on the landing. */
export function perchBot(left = 30): Ctl {
  let i = -1;
  let air = false;
  return (r) => {
    if (i < 0 && ringtail(r, E.K1).ride!.phase === 'waiting') return { input: right, done: false };
    i++;
    if (!r.player.grounded) air = true;
    if (air && r.player.grounded) return { input: idle, done: true };
    return { input: { move: i < left ? -1 : 0, jumpHeld: true }, done: false };
  };
}

/**
 * The careful read of P3's Armadillo, from L1 (found by a probe, not pinned: the spring, the lift, the answer to the Armadillo and the glide driven from
 * L1 at x 1682 at every 6th clock of 7,200, binned by where the Armadillo was when he started for the spring): it walks right, between x 1776 and 1856.
 * Every start in those bins kept the life. Heading left the walk onto P3 met the ball at the lift for most starts from x 1728 to 1856; from 1856 right on, and from
 * 1888 left, the first bat took the life at some. Its clock is not read, nor the lift's, nor the bats'.
 */
export const CAREFUL_ARMADILLO = { heading: 1, from: 1776, before: 1856 } as const;
/** Does the careful read let him start for the spring now? */
export const armadilloReads = (r: RunState): boolean => {
  const a = r.enemies[E.ARMADILLO]!;
  return a.alive && a.shell!.phase === 'walk' && a.dir === CAREFUL_ARMADILLO.heading && a.x >= CAREFUL_ARMADILLO.from && a.x < CAREFUL_ARMADILLO.before;
};

/** MP2's foot at its lowest: the lift's top is within this many px of its foot, going down or up, when he steps on. */
const MP2_NEAR = 12;
/** Waits on P5 short of the lift's left edge until its top is `MP2_NEAR` px or less over its foot, then right held onto it and up onto A. */
export const mp2Wait = (): Ctl[] => {
  const mp2 = LEVEL_3_3_PLATFORM.MP2;
  return [
    runStopAt(mp2.x0 - 24),
    waitFor((r) => platformAt(mp2, r.platformTick).y >= mp2.y0 - MP2_NEAR),
    runUntil(1, (r) => onRow(LEVEL_3_3_AT.A.row)(r) && r.player.x >= LEVEL_3_3_AT.A.col0 * TILE),
  ];
};

/** K1 woken from P1 and answered from the perch; he waits there until its cart has stopped at its buffer, then walks off over it to T1. */
const K1_ANSWER = (): Ctl[] => [
  perchBot(),
  waitFor((r) => r.carts[cartOf('R2')]!.phase === 'stopped'),
  overWall(LEVEL_3_3_WALLS.T1.col0),
  runUntil(1, (r) => r.checkpointIndex >= 0),
];
/** Ki, careful: C1 on foot from the spawn, R1 to its buffer, out onto P1, then K1's answer. */
export const CAREFUL_KI = (): Ctl[] => [
  runUntil(1, (r) => inCart(r, 'R1') && r.carts[cartOf('R1')]!.phase !== 'waiting'),
  waitFor((r) => r.carts[cartOf('R1')]!.phase === 'stopped'),
  runUntil(1, onRow(LEVEL_3_3_AT.P1.row)),
  ...K1_ANSWER(),
];
/** Shō, careful, from L1: he waits there for the careful read of the Armadillo before the spring. */
const CAREFUL_FROM_L1 = (): Ctl[] => [
  waitFor(armadilloReads),
  springBot(),
  armadilloBot(),
  jumpAt(P3_LIP - 8, HELD),
  overWall(LEVEL_3_3_WALLS.P4.col0),
];
/** Shō, careful: as the rider's, but he waits on L1 for the careful read of the Armadillo before the spring. */
export const CAREFUL_SHO = (): Ctl[] => [hopInto('R3'), jumpFromCart(pastPost('R3'), 'held', 1), ...CAREFUL_FROM_L1()];
/** Ketsu, careful, to A: he stops where K3 wakes (short of the vulture's stretch), jumps its cart when it comes, then waits for the lift at MP2's foot. */
const CAREFUL_TO_A = (): Ctl[] => [runUntil(1, (r) => ringtail(r, E.K3).ride!.phase !== 'waiting'), jumpCart('R6', K3_GAP, 'held', 0), ...mp2Wait()];
/** Ketsu, careful: to A, then the stairs into C4 and R7 to a held jump from its post into the exit. */
export const CAREFUL_KETSU = (): Ctl[] => [...CAREFUL_TO_A(), stairsBot(), jumpFromCart(pastPost('R7'), 'held', 1)];

/** The rider (GDD-WLD-18's expert's line) and the careful bot, whole: Ki, Shō, Ten, Ketsu. */
export const RIDER = (): Ctl[] => [...RIDE_KI(), ...RIDE_SHO(), ...RIDE_TEN(), ...RIDE_KETSU()];
export const CAREFUL = (): Ctl[] => [...CAREFUL_KI(), ...CAREFUL_SHO(), ...RIDE_TEN(), ...CAREFUL_KETSU()];

// ---------------------------------------------------------------------------------------------------------------------------------------
// Phase B2b: the walker, who boards none of C1, C2, C3 and C4 (`level3-3.walker.test.ts`), and the secret bot.

/** C1's dip: the plain hop onto G0b taken from x = 70 (inside the sweep's window of take-offs that land on G0b without boarding C1, `level3-3.walker.test.ts`). */
export const DIP_HOP = 70;
/** The first pit: the held jump from G0b taken from x = 152 (a held jump from any take-off on G0b reaches the shelf, standing or at a run). */
export const PIT_JUMP = 152;
/** P2's lip: the left edge of the chasm after it (column 89). */
const P2_LIP = (LEVEL_3_3_AT.P2.col1 + 1) * TILE;
/** The shelf under R7's lip: the left edge of the exit pit after it (column 226). */
const SHELF7_LIP = (LEVEL_3_3_AT.shelf7.col1 + 1) * TILE;
/** The secret's take-off: a held jump back at x = 568, 1.5 tiles in from P1's left lip (x = 544); the measured window is 16 px and more in at a run, up to 3 tiles (`level3-3.test.ts`). */
export const SECRET_JUMP = LEVEL_3_3_AT.P1.col0 * TILE + 1.5 * TILE;

/** Up the lift MP0 from the shelf: he stops short of its left edge, waits until its top is `MP2_NEAR` px or less over its foot, then right held up onto P1. */
export const mp0Up = (): Ctl[] => {
  const mp0 = LEVEL_3_3_PLATFORM.MP0;
  return [
    runStopAt(mp0.x0 - 24),
    waitFor((r) => platformAt(mp0, r.platformTick).y >= mp0.y0 - MP2_NEAR),
    runUntil(1, (r) => onRow(LEVEL_3_3_AT.P1.row)(r) && r.player.x >= LEVEL_3_3_AT.P1.col0 * TILE),
  ];
};

/** Shō on foot: right through C2 (T1's ground) and up its slope to P2's row (first reached at the slope's top), a held jump from P2's lip onto L1, then the careful bot's own. */
export const WALKER_SHO = (): Ctl[] => [
  runUntil(1, onRow(LEVEL_3_3_AT.P2.row)),
  jumpAt(P2_LIP, HELD),
  ...CAREFUL_FROM_L1(),
];
/** Ten on foot: right through C3 and over bridge A's planks, no stop, onto Q; then the rider's from the pier on. */
export const WALKER_TEN = (): Ctl[] => [runUntil(1, (r) => onRow(LEVEL_3_3_AT.Q.row)(r) && r.player.x >= LEVEL_3_3_AT.Q.col0 * TILE), ...RIDE_TEN().slice(2)];

/**
 * The stairs with the last jump kept out of C4: right held and a jump on each landing as `stairsBot`'s, but the jump from the third pair is a plain one
 * with right let go (the sweep of `level3-3.walker.test.ts`); done on P6.
 */
export function stairsOnFoot(): Ctl {
  let was = false;
  let release = false;
  return (r) => {
    const p = r.player;
    if (p.grounded && p.y === Y(LEVEL_3_3_AT.P6.row)) return { input: idle, done: true };
    const jump = p.grounded ? !was : was && p.vy < 0;
    if (jump && p.grounded && p.y === Y(LEVEL_3_3_PLANKS.stair3.row)) release = true;
    was = jump;
    return { input: { move: release ? 0 : 1, jumpHeld: jump }, done: false };
  };
}
/** Ketsu on foot: to A as the careful bot's, the stairs onto P6 outside C4, right through C4 and down R7's slope onto the shelf, a held jump from its lip into the exit. */
export const WALKER_KETSU = (): Ctl[] => [
  ...CAREFUL_TO_A(),
  stairsOnFoot(),
  runUntil(1, (r) => onRow(LEVEL_3_3_AT.shelf7.row)(r) && r.player.x >= LEVEL_3_3_AT.shelf7.col0 * TILE),
  jumpAt(SHELF7_LIP, HELD),
];
/**
 * The walker (GDD-WLD-18's "No cart is needed"): the careful run with none of his carts boarded, C1 to C4 waiting on every step. Ki on foot: C1's dip hopped
 * (a plain jump) onto G0b, the first pit jumped (held) onto the shelf, the shelf under pier V (the tunnel) walked to MP0, MP0 up onto P1, then K1's answer.
 */
export const WALKER_KI = (): Ctl[] => [jumpAt(DIP_HOP, 'top'), jumpAt(PIT_JUMP, HELD), ...mp0Up(), ...K1_ANSWER()];
export const WALKER = (): Ctl[] => [...WALKER_KI(), ...WALKER_SHO(), ...WALKER_TEN(), ...WALKER_KETSU()];

/**
 * The secret bot's Ki: C1 as the careful bot's, then a held jump back over P1's lip into the hollow, which takes the veladora in the air (the test pins the
 * step; a walk left on the hollow's floor to take it after landing is never needed from this take-off), off onto the shelf and MP0 up.
 */
export const SECRET_KI = (): Ctl[] => [
  ...CAREFUL_KI().slice(0, 3),
  jumpAt(SECRET_JUMP, -Infinity, -1),
  runUntil(1, onRow(LEVEL_3_3_AT.shelf.row)),
  ...mp0Up(),
  ...K1_ANSWER(),
];
/** The secret bot: the careful run with the secret in Ki. */
export const SECRET = (): Ctl[] => [...SECRET_KI(), ...CAREFUL_SHO(), ...RIDE_TEN(), ...CAREFUL_KETSU()];

/** How a bot ended, as the tests tally it: `exit, 0 lost`; or `no exit, 1 lost (<cause> at <column>)` (`causeOf` on the losing step); or out of steps. */
export function outcomeOf(b: Played): string {
  const column = Math.floor(b.end.player.x / TILE);
  if (b.lost.length > 0) return `no exit, ${b.lost.length} lost (${causeOf(b.states[Math.max(0, b.states.length - 2)]!, b.lastInput)} at ${column})`;
  return b.end.phase === 'clear' ? 'exit, 0 lost' : `no exit, 0 lost (out of steps at ${column})`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Phase B2c: the first-time player's losses, each followed by the respawn and on to the exit (`level3-3.losses.test.ts`).

/** The tasks `tasks` in turn as one task: a task that is done hands the same step to the next; done when the last is. */
export function chain(tasks: readonly Ctl[]): Ctl {
  let k = 0;
  return (r) => {
    while (k < tasks.length) {
      const out = tasks[k]!(r);
      if (!out.done) return out;
      k++;
    }
    return { input: idle, done: true };
  };
}

/**
 * Plays `mistake` and then nothing held, until a life is lost: done on the first call after it (`runBot` holds nothing while he waits to respawn and calls no
 * task then). With `stand` set, done after that many steps of standing since `mistake` was done, a life or not (L-064).
 */
export function untilLost(mistake: Ctl, stand = Infinity): Ctl {
  let lives = -1;
  let over = false;
  let stood = 0;
  return (r) => {
    if (lives < 0) lives = r.lives.lives;
    if (r.lives.lives < lives || stood >= stand) return { input: idle, done: true };
    if (!over) {
      const out = mistake(r);
      if (!out.done) return out;
      over = true;
    }
    stood++;
    return { input: idle, done: false };
  };
}

/** Right held until his middle is at `x`, then nothing: he comes to rest a stopping distance past it. Never done. */
export const stopAfter = (x: number): Ctl => (r) => ({ input: r.player.x >= x ? idle : right, done: false });

const never = () => false;
/** What follows a respawn at the first ofrenda (T1's, column 65): Shō from the hop into C2, then Ten and Ketsu. */
const FROM_OFRENDA_1 = (): Ctl[] => [...CAREFUL_SHO(), ...RIDE_TEN(), ...CAREFUL_KETSU()];
/** What follows a respawn at the second ofrenda (P4's, column 130): over P4's wall, the ride over bridge B and the careful run to the exit. */
const FROM_OFRENDA_2 = (): Ctl[] => [overWall(LEVEL_3_3_WALLS.P4.col0), ...RIDE_TEN(), ...CAREFUL_KETSU()];
/** The careful route to Q: Ki and Shō, then C3 hopped into and ridden to its buffer on Q. */
const TO_Q = (): Ctl[] => [...CAREFUL_KI(), ...CAREFUL_SHO(), ...RIDE_TEN().slice(0, 2)];
/** The careful route to P5 with K2 answered: the whole of Ten. */
const TO_P5 = (): Ctl[] => [...CAREFUL_KI(), ...CAREFUL_SHO(), ...RIDE_TEN()];

/**
 * GDD-WLD-18's "Where a first-time player loses a life": the careful route up to the place, the mistake until a life is lost, then the careful route from the
 * ofrenda he respawns at (GDD-LIFE-03) to the exit. R3's broken end: staying in (nothing held), or a plain jump from the post (it comes back down in the cart).
 * Respawn at the first ofrenda.
 */
export const LOSS_R3_STAY = (): Ctl[] => [...CAREFUL_KI(), hopInto('R3'), untilLost(waitFor(never)), ...FROM_OFRENDA_1()];
export const LOSS_R3_PLAIN = (): Ctl[] => [...CAREFUL_KI(), hopInto('R3'), untilLost(jumpFromCart(pastPost('R3'), 'top', 1)), ...FROM_OFRENDA_1()];
/** Bridge B stopped on its second plank (column 161): right held to the plank's left edge (x = 2576), then nothing: he comes to rest on it, and it falls. */
export const LOSS_PLANK_STOP = (): Ctl[] => [...TO_Q(), untilLost(stopAfter(161 * TILE)), ...FROM_OFRENDA_2()];
/** Bridge B run across with right held and no stop on the pier: K2 meets him on the second span. */
export const LOSS_K2_RUN = (): Ctl[] => [...TO_Q(), untilLost(runUntil(1, never)), ...FROM_OFRENDA_2()];
/** K3's cart met on P5 with right held and no jump. */
export const LOSS_K3_WALK = (): Ctl[] => [...TO_P5(), untilLost(runUntil(1, never)), ...FROM_OFRENDA_2()];

/**
 * `mistake` and then standing until a life is lost (`untilLost`), at most `stand` steps; then `whenLost` (the careful route from the ofrenda he respawned at) if a
 * life was lost and `whenKept` if not. One task, for a mistake that the clock decides.
 */
export function mistakeThen(mistake: Ctl, stand: number, whenLost: () => Ctl[], whenKept: () => Ctl[]): Ctl {
  const until = untilLost(mistake, stand);
  let lives = -1;
  let rest: Ctl | undefined;
  return (r) => {
    if (lives < 0) lives = r.lives.lives;
    if (rest === undefined) {
      const out = until(r);
      if (!out.done) return out;
      rest = chain(r.lives.lives < lives ? whenLost() : whenKept());
    }
    return rest(r);
  };
}

/** The middle of the vulture's line (x = 2976 to 3072, GDD-WLD-18): he walks to under it. */
const VULTURE_X = 3024;
/** How long he stands where he lands after the plain jump under the vulture before the bot walks on: 10 s. */
export const VULTURE_STAND = 600;
/**
 * The cart under the vulture, standing still after a jump: the careful route onto P5 with K3's cart jumped (the careful bot's), a walk to under the vulture's
 * middle, a plain jump with right let go on the press step, and standing where he lands until a life is lost (at most `VULTURE_STAND` steps). A life lost: the
 * careful route from the second ofrenda. None: on to MP2 and the careful run to the exit.
 */
export const LOSS_VULTURE_STAND = (): Ctl[] => [
  ...TO_P5(),
  runUntil(1, (r) => ringtail(r, E.K3).ride!.phase !== 'waiting'),
  jumpCart('R6', K3_GAP, 'held', 0),
  mistakeThen(chain([runUntil(1, (r) => r.player.x >= VULTURE_X), jumpFromCart(() => true, 'top', 0)]), VULTURE_STAND, FROM_OFRENDA_2, () => [...mp2Wait(), stairsBot(), jumpFromCart(pastPost('R7'), 'held', 1)]),
];

// ---------------------------------------------------------------------------------------------------------------------------------------
// The power run: the taco from the first piñata, the chile from the second, K2 burned from the pier and K3's hit taken by the power.

/** Under a piñata's column a tile short of its middle, a plain jump bumps it (GDD-PWR-05: his head flush against its underside while he rises). */
export const bumpUnder = (pinata: number): Ctl => jumpAt(mid(L.pinatas[pinata]!.col) - 4, 'top');
/**
 * Brakes to a stand with his middle at `x`: right or left held as the place he would come to rest at without it (`vx` over twice the ground deceleration) falls short
 * of or past `x`, nothing within 1 px of it; done on the first step he stands still on the ground (that is the place: a position check as well would only repeat
 * the control, L-025).
 */
export function standAt(x: number): Ctl {
  return (r) => {
    const p = r.player;
    if (p.grounded && p.vx === 0) return { input: idle, done: true };
    const off = x - (p.x + (p.vx * Math.abs(p.vx)) / (2 * RUN.groundDecel));
    return { input: { move: Math.abs(off) < 1 ? 0 : off > 0 ? 1 : -1, jumpHeld: false }, done: false };
  };
}
/** Is the power `power`? */
const powerIs = (power: RunState['power']) => (r: RunState) => r.power === power;

/**
 * The taco (GDD-PWR-05, GDD-PWR-02): after T1's wall a plain jump under the first piñata (column 64) bumps it; the taco walks right on its top at 40 px/s and
 * falls off its edge onto T1. He runs right to the first ofrenda's middle (x = 1048, and on a stopping distance, to about 1061), where it falls past his front
 * and he takes it as it comes down; he waits there if it does not.
 */
const TACO_FROM_PINATA = (): Ctl[] => [bumpUnder(0), runUntil(1, (r) => r.player.x >= L.ofrendas[0]!.x), waitFor(powerIs('taco'))];

/** P4's wall (column 132): its left face (x = 2112) and its right face, where his middle stands 6 px off it. */
const WALL_P4 = { left: LEVEL_3_3_WALLS.P4.col0 * TILE, right: (LEVEL_3_3_WALLS.P4.col1 + 1) * TILE };

/**
 * The chile (GDD-PWR-05, GDD-PWR-03), in Taco: a plain jump under the second piñata (column 134, a wall at 132 between it and the glide's landing), which leaves a
 * chile on its top; back over the wall to its left with a plain jump left held, a run-up, and a plain jump right held at a run from 3 tiles short of the wall that
 * lands on its top (x = 2121.8; the take-offs from 2052 to 2076 do, probed); there he brakes to a stand at 2 px over its left face (x = 2114) and takes a plain
 * jump right held, which reaches the piñata's top and the chile (L-047: from a stand the take-offs from 2106 to 2122 do, `level3-3.losses.test.ts`), taking it in the air.
 */
const CHILE_FROM_PINATA = (): Ctl[] => [
  bumpUnder(1),
  runUntil(-1, (r) => r.player.x <= WALL_P4.right + HITBOX.width / 2 + 1),
  jumpAt(WALL_P4.right + HITBOX.width / 2 + 1, 'top', -1),
  runUntil(-1, (r) => r.player.x <= WALL_P4.left - 4.5 * TILE),
  waitFor((r) => r.player.vx === 0 && r.player.grounded),
  jumpAt(WALL_P4.left - 3 * TILE, 'top'),
  standAt(WALL_P4.left + 2),
  jumpAt(WALL_P4.left - 8, 'top'),
];

/** The power run to P4's wall: the careful route with the taco taken on the way, over the wall of P4 from the glide's landing. */
export const POWER_TO_P4_WALL = (): Ctl[] => [
  ...CAREFUL_KI().slice(0, 6),
  ...TACO_FROM_PINATA(),
  runUntil(1, (r) => r.checkpointIndex >= 0),
  ...CAREFUL_SHO().slice(0, -1),
  overWall(LEVEL_3_3_WALLS.P4.col0),
];
/** The power run so far: the taco and the chile taken on the way, to the chile's jump's landing on the piñata's top. */
export const POWER_TO_CHILE = (): Ctl[] => [...POWER_TO_P4_WALL(), ...CHILE_FROM_PINATA()];

/** One press of the Fuego button (it spits one fireball on the press, GDD-PWR-03) on the first step `when` holds, and nothing the step after; done then. */
export function spit(when: (r: RunState) => boolean): Ctl {
  let pressed = false;
  return (r) => {
    if (pressed) return { input: idle, done: true };
    if (!when(r)) return { input: idle, done: false };
    pressed = true;
    return { input: { move: 0, jumpHeld: false, fuego: true }, done: false };
  };
}
/** K2's cart is burned from the pier once it rolls and its front is this far from his: inside the presses that defeat it (`level3-3.losses.test.ts`). */
export const K2_BURN_GAP = 120;

/** Ten with the chile: as the careful bot's, and on the pier a press of Fuego when K2's cart rolls within `K2_BURN_GAP`; its empty cart is then jumped as before. */
export const POWER_TEN = (): Ctl[] => {
  const ten = RIDE_TEN();
  return [...ten.slice(0, 3), spit((r) => r.carts[cartOf('R5')]!.phase === 'rolling' && gapTo(r, 'R5') <= K2_BURN_GAP), ...ten.slice(3)];
};
/**
 * Ketsu with a hit: right held on past K3's wake to MP2 with no jump, so K3's cart is met on the way (the hit the power takes, Fuego to Taco, with the
 * invulnerability after it), and the careful run from MP2 to the exit. No task of its own for the hit: the walk to MP2 is it (L-025).
 */
export const POWER_KETSU = (): Ctl[] => [...mp2Wait(), stairsBot(), jumpFromCart(pastPost('R7'), 'held', 1)];
/** The power run (the careful route with both piñatas opened, K2 burned and K3's hit taken by the power). */
export const POWER = (): Ctl[] => [...POWER_TO_CHILE(), ...POWER_TEN(), ...POWER_KETSU()];

/** What one loss bot's run left, for the tests (`playLoss`). */
export interface LossRun {
  readonly bot: Bot;
  /** Each life lost: the index of the losing state in `bot.states`, what took it (`causeOf` on the step before it, with the input it was taken with) and his column. */
  readonly losses: readonly { readonly step: number; readonly cause: string; readonly column: number }[];
  /** The first state of play after the first loss: its index, his x and the ofrenda he is at (`checkpointIndex`); null if no life was lost. */
  readonly respawn: { readonly step: number; readonly x: number; readonly checkpoint: number } | null;
  /** The first step a life came back (an ofrenda's first activation, GDD-LIFE-03), and the ofrenda he stood at then; null for none. */
  readonly restored: { readonly step: number; readonly checkpoint: number } | null;
}

/**
 * `runBot` on 3-3 with no stop at a loss (at most `max` steps, L-064), and the tasks' last input before each life lost kept for `causeOf`: a task's call on a
 * state with fewer lives than the last non-done call's state is the first call after the respawn, and that last call was the losing step.
 */
export function playLoss(tasks: readonly Ctl[], from: RunState, max = 8000): LossRun {
  const causes: string[] = [];
  let prev: { r: RunState; input: PlayerInput } | undefined;
  const seen = tasks.map((task): Ctl => (r) => {
    if (prev && r.lives.lives < prev.r.lives.lives) {
      causes.push(causeOf(prev.r, prev.input));
      prev = undefined;
    }
    const out = task(r);
    if (!out.done) prev = { r, input: out.input };
    return out;
  });
  const b = runBot(seen, from, L, max, false);
  const losses = b.lost.map((step, i) => ({ step, cause: causes[i] ?? 'none', column: Math.floor(b.states[Math.max(0, step - 1)]!.player.x / TILE) }));
  const flip = losses.length === 0 ? -1 : b.states.findIndex((r, k) => k > losses[0]!.step && r.phase === 'playing');
  const back = b.states.findIndex((r, k) => k > 0 && r.lives.lives > b.states[k - 1]!.lives.lives);
  return {
    bot: b,
    losses,
    respawn: flip < 0 ? null : { step: flip, x: b.states[flip]!.player.x, checkpoint: b.states[flip]!.checkpointIndex },
    restored: back < 0 ? null : { step: back, checkpoint: b.states[back]!.checkpointIndex },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Phase B2d: the camera along the bots' runs (`level3-3.camera.test.ts`).

/**
 * The camera after each of `states`, one run: at `states[0]` the level start's cut (his middle at the screen's middle, `cutCameraY`, no lead), then stepped as the
 * scene steps it (`stepSightCamera`) from each state to the next. `runBot`'s states leave the state it started from out, so a bot's run is `[from, ...bot.states]`
 * (index `k` of the bot's states is `k + 1` there).
 */
export function camerasOf(states: readonly RunState[]): SightCamera[] {
  let camera: SightCamera = { scrollX: followCamera(0, states[0]!.player.x, L.world.width * TILE), lead: 0, y: cutCameraY(states[0]!, L) };
  return states.map((r, k) => {
    if (k > 0) camera = stepSightCamera(camera, states[k - 1]!, r, L);
    return camera;
  });
}

/** Whether `box` is inside the view on all four sides (`onScreen` is the overlap). */
export const whollyOnScreen = (box: Box, view: View): boolean => box.x0 >= view.x && box.x1 <= view.x + BASE_WIDTH && box.y0 >= view.y && box.y1 <= view.y + BASE_HEIGHT;

/** His body box in run `r`: `HITBOX` wide and high, his middle at `x` and his feet at `y`. */
export const bodyBox = (r: RunState): Box => ({ x0: r.player.x - HITBOX.width / 2, x1: r.player.x + HITBOX.width / 2, y0: r.player.y - HITBOX.height, y1: r.player.y });
