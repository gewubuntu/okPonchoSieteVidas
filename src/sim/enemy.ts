// GDD-ENM-02, GDD-CMB-01: the Alacrán (scorpion) patrols a platform and turns at walls and at ledge edges; stomp, claw or
// fireball defeat it. The Zopilote (vulture) cruises, telegraphs and dives; the cactus buddy just stands there. Neither can be stomped. Touching either otherwise
// is a hit (GDD-CMB-03). The Tlacuache (opossum) walks, telegraphs and charges, and plays dead after its first stomp.
// GDD-ENM-03: World 2's Paloma (pigeon), Chapulín (grasshopper) and Trompo (spinning top, the first heavy enemy, GDD-CMB-02); their
// steps are in `paloma.ts`, `chapulin.ts` and `trompo.ts`. Every rule that depends on the kind is a table or a switch over every kind,
// so a kind left out fails the typecheck.
// Pure logic, no Phaser (GDD-TEC-02).
import { CACTUS, CHAPULIN, ENEMY, PALOMA, STEP, STOMP, TLACUACHE, TROMPO, ZOPILOTE } from '../config/tuning';
import { CROUCHING, stepChapulin, type Hop } from './chapulin';
import { hurtbox } from './hazards';
import type { PlayerState } from './movement';
import { GROUNDED, stepPaloma, type Wing } from './paloma';
import type { PlatformPos } from './platform';
import type { TileGrid } from './tilemap';
import { SPINNING, stepTrompo, stun, type Spin } from './trompo';
import { turn, walk as walkOn } from './walker';

export type EnemyKind = 'alacran' | 'zopilote' | 'cactus' | 'tlacuache' | 'paloma' | 'chapulin' | 'trompo';

/**
 * Where an enemy starts, heading right. An Alacrán (the default kind) gives the middle of it and the y of its feet, like
 * Poncho's own position, and so do a cactus buddy, a Tlacuache, a Paloma, a Chapulín and a Trompo; a Zopilote gives the middle of it
 * and the y of its cruise line.
 */
export interface Enemy {
  readonly x: number;
  readonly y: number;
  readonly kind?: EnemyKind;
}

export const kindOf = (def: Enemy): EnemyKind => def.kind ?? 'alacran';

/** A Zopilote's flight (GDD-ENM-02): cruising, frozen for its telegraph, diving to the aim point, then climbing back. */
export interface Flight {
  readonly y: number;
  readonly phase: 'cruise' | 'telegraph' | 'dive' | 'return';
  /** Steps in the current phase; while cruising, the steps cruised so far, which set where it is in its bob. */
  readonly age: number;
  /** Where Poncho was when the telegraph ended; only read while diving. */
  readonly aimX: number;
  readonly aimY: number;
}

/**
 * A Tlacuache's gait (GDD-ENM-02): walking, frozen for its telegraph, charging, or playing dead after its first stomp.
 * `playedDead` stays true once it has, so the next stomp defeats it.
 */
export interface Gait {
  readonly phase: 'walk' | 'telegraph' | 'charge' | 'dead';
  /** Steps in the current phase. */
  readonly age: number;
  readonly playedDead: boolean;
}

export interface EnemyState {
  readonly x: number;
  readonly dir: 1 | -1;
  /** False once it has been defeated, until a life is lost (GDD-LIFE-02). */
  readonly alive: boolean;
  /** Only a Zopilote has one. */
  readonly flight?: Flight;
  /** Only a Tlacuache has one. */
  readonly gait?: Gait;
  /** Only a Paloma has one (GDD-ENM-03). */
  readonly wing?: Wing;
  /** Only a Chapulín has one (GDD-ENM-03). */
  readonly hop?: Hop;
  /** Only a Trompo has one (GDD-ENM-03). */
  readonly spin?: Spin;
  /**
   * GDD-MOV-09: the y of a walker's feet once it has walked (it follows slopes), and a Chapulín's feet in the air too (GDD-ENM-03); a
   * flying Paloma keeps the y of the ground it rose from. Left out, it stands at its start's y.
   */
  readonly y?: number;
}

export interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

const EDGE = 1e-6;

/**
 * GDD-WLD-10, GDD-WLD-11: the tops of the level's awnings and of its cordeles where they are this step, which World 2's enemies use
 * (GDD-ENM-03): a Paloma walks along a cordel and a Chapulín is thrown up by an awning. Every other enemy ignores them.
 */
export interface EnemyTops {
  readonly awnings: readonly PlatformPos[];
  readonly cordeles: readonly PlatformPos[];
}

/** No awnings and no cordeles. */
export const NO_TOPS: EnemyTops = { awnings: [], cordeles: [] };

/** How each kind starts: alive at its start, heading right, with the state of its own kind. */
const FRESH: Readonly<Record<EnemyKind, (e: Enemy) => EnemyState>> = {
  alacran: (e) => ({ x: e.x, dir: 1, alive: true }),
  zopilote: (e) => ({ x: e.x, dir: 1, alive: true, flight: { y: e.y, phase: 'cruise', age: 0, aimX: 0, aimY: 0 } }),
  cactus: (e) => ({ x: e.x, dir: 1, alive: true }),
  tlacuache: (e) => ({ x: e.x, dir: 1, alive: true, gait: { phase: 'walk', age: 0, playedDead: false } }),
  paloma: (e) => ({ x: e.x, dir: 1, alive: true, wing: GROUNDED }),
  chapulin: (e) => ({ x: e.x, dir: 1, alive: true, hop: CROUCHING }),
  trompo: (e) => ({ x: e.x, dir: 1, alive: true, spin: SPINNING }),
};

/** Every enemy alive at its start, as at the start of the level and after a life is lost. */
export const freshEnemies = (enemies: readonly Enemy[]): readonly EnemyState[] => enemies.map((e) => FRESH[kindOf(e)](e));

/** The size of each kind's box: one that stands on its feet, but for the Zopilote's, which flies (see `enemyBox`). */
const SIZE: Readonly<Record<EnemyKind, { readonly width: number; readonly height: number }>> = {
  alacran: ENEMY,
  zopilote: ZOPILOTE,
  cactus: CACTUS,
  tlacuache: TLACUACHE,
  paloma: PALOMA,
  chapulin: CHAPULIN,
  trompo: TROMPO,
};

export const sizeOf = (def: Enemy): { readonly width: number; readonly height: number } => SIZE[kindOf(def)];

/** GDD-MOV-09: where a walking enemy's (or the cactus buddy's) feet are now: where it walked to, or its start. */
export const feetOf = (def: Enemy, state: EnemyState): number => state.y ?? def.y;

/** The middle of Poncho's hurtbox (GDD-MOV-06). */
export const centre = (player: PlayerState): { x: number; y: number } => {
  const h = hurtbox(player);
  return { x: h.x + h.w / 2, y: h.y + h.h / 2 };
};

/** Moves from (x, y) towards (tx, ty) by at most `dist`, stopping on it. */
export function approach(x: number, y: number, tx: number, ty: number, dist: number): { x: number; y: number; arrived: boolean } {
  const d = Math.hypot(tx - x, ty - y);
  return d <= dist ? { x: tx, y: ty, arrived: true } : { x: x + ((tx - x) / d) * dist, y: y + ((ty - y) / d) * dist, arrived: false };
}

/**
 * A Zopilote's step (GDD-ENM-02). Cruising it flies at ZOPILOTE.speed between `range` either side of its start, turning at
 * the ends, bobbing on a sine. It ignores tiles. When Poncho is within `triggerX` to either side and 0 to `triggerY` below
 * it, it freezes for the telegraph, then dives straight at the spot he was at when it ended, and climbs back to its
 * cruise line.
 */
function stepZopilote(def: Enemy, state: EnemyState, player: PlayerState): EnemyState {
  const f = state.flight!;
  if (f.phase === 'telegraph') {
    if (f.age + 1 < ZOPILOTE.telegraphSteps) return { ...state, flight: { ...f, age: f.age + 1 } };
    const aim = centre(player);
    return { ...state, flight: { ...f, phase: 'dive', age: 0, aimX: aim.x, aimY: aim.y } };
  }
  if (f.phase === 'dive') {
    const at = approach(state.x, f.y, f.aimX, f.aimY, ZOPILOTE.diveSpeed * STEP);
    return { ...state, x: at.x, flight: { ...f, y: at.y, phase: at.arrived ? 'return' : 'dive', age: f.age + 1 } };
  }
  if (f.phase === 'return') {
    const at = approach(state.x, f.y, state.x, def.y, ZOPILOTE.returnSpeed * STEP);
    return { ...state, flight: { ...f, y: at.y, phase: at.arrived ? 'cruise' : 'return', age: at.arrived ? 0 : f.age + 1 } };
  }
  const moved = state.x + state.dir * ZOPILOTE.speed * STEP;
  const past = Math.abs(moved - def.x) >= ZOPILOTE.range - EDGE; // EDGE: 40 / 60 px a step adds up to just under 48
  const x = past ? def.x + state.dir * ZOPILOTE.range : moved;
  const dir = past ? turn(state.dir) : state.dir;
  const age = f.age + 1;
  const y = def.y + ZOPILOTE.amplitude * Math.sin((2 * Math.PI * age) / ZOPILOTE.periodSteps);
  const p = centre(player);
  const spotted = Math.abs(p.x - x) <= ZOPILOTE.triggerX && p.y > y && p.y - y <= ZOPILOTE.triggerY;
  return { ...state, x, dir, flight: { ...f, y, age: spotted ? 0 : age, phase: spotted ? 'telegraph' : 'cruise' } };
}

/**
 * A walker's step on the ground at `speed` px/s (`walker.ts`): it follows slopes and turns at walls and ledge ends (GDD-ENM-02,
 * GDD-MOV-09), and at the ends of the cordeles in `tops` (GDD-ENM-03). `turned` says it turned round.
 */
export function walk(def: Enemy, state: EnemyState, world: TileGrid, speed: number, tops: readonly PlatformPos[] = []): { state: EnemyState; turned: boolean } {
  const w = walkOn(world, state.x, feetOf(def, state), state.dir, sizeOf(def), speed, tops);
  return { state: w.turned ? { ...state, x: w.x, dir: w.dir } : { ...state, x: w.x, y: w.y }, turned: w.turned };
}

/**
 * A Tlacuache's step (GDD-ENM-02). It walks like an Alacrán, slower. When Poncho's feet are within TLACUACHE.sightY of its own
 * and his hurtbox centre is ahead of it by up to TLACUACHE.sightX, it freezes for the telegraph (GDD-ENM-01), then charges the
 * way it faces until a wall or a ledge stops it, turns round and walks again. Playing dead it lies still, then wakes.
 */
function stepTlacuache(def: Enemy, state: EnemyState, world: TileGrid, player: PlayerState): EnemyState {
  const g = state.gait!;
  const age = g.age + 1;
  if (g.phase === 'dead') return { ...state, gait: age < TLACUACHE.playDeadSteps ? { ...g, age } : { ...g, phase: 'walk', age: 0 } };
  if (g.phase === 'telegraph') return { ...state, gait: age < TLACUACHE.telegraphSteps ? { ...g, age } : { ...g, phase: 'charge', age: 0 } };
  if (g.phase === 'charge') {
    const moved = walk(def, state, world, TLACUACHE.chargeSpeed);
    return { ...moved.state, gait: moved.turned ? { ...g, phase: 'walk', age: 0 } : { ...g, age } };
  }
  const moved = walk(def, state, world, TLACUACHE.speed).state;
  const ahead = (centre(player).x - moved.x) * moved.dir;
  const spotted = ahead > 0 && ahead <= TLACUACHE.sightX && Math.abs(player.y - feetOf(def, moved)) <= TLACUACHE.sightY;
  return { ...moved, gait: spotted ? { ...g, phase: 'telegraph', age: 0 } : { ...g, age } };
}

/**
 * Advances one step. An Alacrán walks at ENEMY.speed (see `walk`). A defeated enemy stays put. `tops` are the awnings' and the cordeles'
 * tops this step (GDD-WLD-10, GDD-WLD-11); left out, there are none.
 */
export function stepEnemy(def: Enemy, state: EnemyState, world: TileGrid, player: PlayerState, tops: EnemyTops = NO_TOPS): EnemyState {
  return state.alive ? STEPS[kindOf(def)](def, state, world, player, tops) : state;
}

/** Each kind's step (see `stepEnemy`). */
const STEPS: Readonly<Record<EnemyKind, (def: Enemy, state: EnemyState, world: TileGrid, player: PlayerState, tops: EnemyTops) => EnemyState>> = {
  alacran: (def, state, world) => walk(def, state, world, ENEMY.speed).state,
  zopilote: (def, state, _world, player) => stepZopilote(def, state, player),
  cactus: (_def, state) => state, // static (GDD-ENM-02)
  tlacuache: (def, state, world, player) => stepTlacuache(def, state, world, player),
  paloma: (def, state, world, player, tops) => stepPaloma(def, state, world, player, tops.cordeles),
  chapulin: (def, state, world, _player, tops) => stepChapulin(def, state, world, tops.awnings),
  trompo: (def, state, world) => stepTrompo(def, state, world),
};

/** GDD-ENM-02: the Tlacuache's first stomp makes it play dead instead of defeating it. */
export const playDead = (state: EnemyState): EnemyState => ({ ...state, gait: { phase: 'dead', age: 0, playedDead: true } });

/** Which kinds play dead at their first stomp (GDD-ENM-02): the Tlacuache. */
const PLAYS_DEAD: Readonly<Record<EnemyKind, boolean>> = { alacran: false, zopilote: false, cactus: false, tlacuache: true, paloma: false, chapulin: false, trompo: false };

/** Does a stomp only make it play dead, rather than defeat it? True for a Tlacuache that has not played dead yet. */
export const stompPlaysDead = (def: Enemy, state: EnemyState): boolean => PLAYS_DEAD[kindOf(def)] && !state.gait!.playedDead;

/** GDD-ENM-03, GDD-CMB-02: is it a Trompo lying stunned? */
export const isStunned = (state: EnemyState): boolean => state.spin?.phase === 'stunned';

/**
 * Is it in play? A defeated enemy is not, nor a Tlacuache playing dead (only the claw reaches it), nor a stunned Trompo (only a stomp
 * reaches it, GDD-ENM-03): they touch nothing.
 */
const inPlay = (state: EnemyState): boolean => state.alive && state.gait?.phase !== 'dead' && !isStunned(state);

/**
 * The enemy's box: its kind's size (`SIZE`) standing on its feet, where it walked or hopped to (GDD-MOV-09, GDD-ENM-03), a flying Paloma's
 * lifted by the height it has flown; but a Zopilote's, ZOPILOTE.width x ZOPILOTE.height, is centred on its flight y.
 */
export function enemyBox(def: Enemy, state: EnemyState): Box {
  const { width, height } = sizeOf(def);
  if (state.flight) return { x0: state.x - width / 2, x1: state.x + width / 2, y0: state.flight.y - height / 2, y1: state.flight.y + height / 2 };
  const feet = feetOf(def, state) - (state.wing?.lift ?? 0);
  return { x0: state.x - width / 2, x1: state.x + width / 2, y0: feet - height, y1: feet };
}

/** Can the claw, a fireball or a stomp defeat it? The cactus buddy cannot be defeated at all, only avoided (GDD-ENM-02). */
const DEFEATABLE: Readonly<Record<EnemyKind, boolean>> = { alacran: true, zopilote: true, cactus: false, tlacuache: true, paloma: true, chapulin: true, trompo: true };

export const defeatable = (def: Enemy): boolean => DEFEATABLE[kindOf(def)];

/** GDD-CMB-02: the heavy enemies, which the claw (and a fireball, GDD-ENM-03) stuns instead of defeating: the Trompo. */
const HEAVY: Readonly<Record<EnemyKind, boolean>> = { alacran: false, zopilote: false, cactus: false, tlacuache: false, paloma: false, chapulin: false, trompo: true };

/**
 * GDD-CMB-02, GDD-PWR-03: what a claw swipe or a fireball that hits a defeatable enemy does to it: it defeats a light one and stuns a
 * heavy one (GDD-ENM-03: a Trompo, for TROMPO.stunSteps).
 */
export const strike = (def: Enemy, state: EnemyState): EnemyState => (HEAVY[kindOf(def)] ? stun(state) : { ...state, alive: false });

/** Which kinds are harmless when Poncho rises into them from beneath (GDD-ENM-02): the cactus buddy. */
const HARMLESS_FROM_BELOW: Readonly<Record<EnemyKind, boolean>> = { alacran: false, zopilote: false, cactus: true, tlacuache: false, paloma: false, chapulin: false, trompo: false };

/**
 * Is a contact harmless (GDD-ENM-02)? Only with a cactus buddy, and only while Poncho is rising into it from beneath: moving
 * up, with his head below its underside a step before.
 */
export function harmlessFromBelow(before: PlayerState, after: PlayerState, def: Enemy, state: EnemyState): boolean {
  return HARMLESS_FROM_BELOW[kindOf(def)] && after.vy < 0 && hurtbox(before).y >= enemyBox(def, state).y1;
}

export const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Poncho's hurtbox (GDD-MOV-06) as a box. */
const hurtBox = (player: PlayerState): Box => {
  const h = hurtbox(player);
  return { x0: h.x, x1: h.x + h.w, y0: h.y, y1: h.y + h.h };
};

/** Does a box (a fireball, Poncho's hurtbox) overlap a live enemy in play? Boxes that only share an edge do not touch. */
export const boxHitsEnemy = (box: Box, def: Enemy, state: EnemyState): boolean => inPlay(state) && overlaps(box, enemyBox(def, state));

/**
 * Does a claw swipe's box overlap a live enemy? Unlike other boxes it reaches a Tlacuache playing dead too (user decision, 2026-10-22).
 * A claw on a stunned Trompo does nothing more (GDD-ENM-03): it is no hit.
 */
export const clawHitsEnemy = (box: Box, def: Enemy, state: EnemyState): boolean => state.alive && !isStunned(state) && overlaps(box, enemyBox(def, state));

/** Does Poncho's hurtbox (GDD-MOV-06) overlap a live enemy in play? */
export const touchesEnemy = (player: PlayerState, def: Enemy, state: EnemyState): boolean => boxHitsEnemy(hurtBox(player), def, state);

/**
 * GDD-CMB-01: can it be stomped now? Not the Zopilote and the cactus buddy, nor a Tlacuache playing dead (it is out of play, GDD-ENM-02);
 * a Trompo only while it lies stunned (GDD-ENM-03).
 */
const STOMPABLE: Readonly<Record<EnemyKind, (state: EnemyState) => boolean>> = {
  alacran: () => true,
  zopilote: () => false,
  cactus: () => false,
  tlacuache: (s) => s.gait!.phase !== 'dead',
  paloma: () => true,
  chapulin: () => true,
  trompo: isStunned,
};

/**
 * Did Poncho just land on top of it (GDD-CMB-01)? It is alive and can be stomped now, he is falling, his hurtbox overlaps it, and on the
 * step before his feet were no more than STOMP.tolerance px below its top.
 */
export function isStomp(before: PlayerState, after: PlayerState, def: Enemy, state: EnemyState): boolean {
  if (!state.alive || !STOMPABLE[kindOf(def)](state)) return false;
  const box = enemyBox(def, state);
  return after.vy > 0 && before.y <= box.y0 + STOMP.tolerance && overlaps(hurtBox(after), box);
}

/** The speed a stomp throws Poncho up at: the jump velocity if jump is held or was pressed in the buffer window (GDD-MOV-03). */
export const stompBounce = (jumpHeld: boolean, jumpBuffer: number): number => (jumpHeld || jumpBuffer > 0 ? STOMP.boostBounce : STOMP.bounce);

/** The phase an enemy is in, for the debug hook: its flight's, gait's, wing's, hop's or spin's, or 'walk' (an Alacrán, a cactus buddy). */
export const enemyPhase = (state: EnemyState): string => state.flight?.phase ?? state.gait?.phase ?? state.wing?.phase ?? state.hop?.phase ?? state.spin?.phase ?? 'walk';
