// GDD-BOS-04: La Catorce, World 3's boss, a small narrow-gauge mine engine that shuttles along the shed floor between two stops in a fixed
// pattern, nothing left to chance. She is hurt by one thing only: an empty vagoneta (GDD-WLD-15) that rolls off the broken end of a high rail
// and falls on her. Claw, stomp and fireball do nothing to her. Pure logic, no Phaser (GDD-TEC-02).
import { CATORCE, CRUMBLE, STEP, TILE } from '../config/tuning';
import { ponchoBox } from './boss';
import { freshCrumbles, stepCrumbles, type Crumble, type CrumbleState } from './crumble';
import { overlaps, type Box } from './enemy';
import type { PlayerState } from './movement';

/** Her arena: the floor's top, and the two tiles of home, the inspection gantry, her slam shakes down from phase 2 (left tile first). */
export interface Catorce {
  readonly floor: number;
  readonly home: readonly Crumble[];
}

/** 'rest' at a stop, 'telegraph' before the charge (GDD-ENM-01), 'charge' to the other stop, 'hurt' after a hit, 'defeated' after the last one. */
export type CatorceMode = 'rest' | 'telegraph' | 'charge' | 'hurt' | 'defeated';

export interface CatorceState {
  /** The middle of her box across; her box's bottom is always the arena's floor. */
  readonly x: number;
  /** Hits taken, 0 to CATORCE.hits. She is in phase `hits + 1`. */
  readonly hits: number;
  readonly mode: CatorceMode;
  /** Steps in this mode: 0 on the step it starts, one more on each step after. */
  readonly age: number;
  /** The way she runs next, or runs: the way she faces. */
  readonly dir: 1 | -1;
  /** From the start of each phase, and after a lost life, until the step of her first slam in it: nothing hurts her (Open Question 40). */
  readonly armoured: boolean;
  /** The state of each of the arena's home tiles, in `Catorce.home`'s order. */
  readonly home: readonly CrumbleState[];
}

/** A falling cart as she reads it: its box, and whether Poncho rode it off its rail (GDD-BOS-04's ridden-off rule). */
export interface FallingCart {
  readonly box: Box;
  readonly ridden: boolean;
}

/** What one step of the fight did, for the run to apply. */
export interface CatorceStep {
  readonly catorce: CatorceState;
  /** She slammed to a halt at a stop this step (for the shake and the sounds). */
  readonly slam: boolean;
  /** She was hit this step: a falling cart that counted. */
  readonly hit: boolean;
  /** One flag per rail given: the falling cart on it broke on her this step, whether it hurt her or not. */
  readonly broken: readonly boolean[];
  /** One flag per fireball given: used up on her this step. */
  readonly spent: readonly boolean[];
  /** The x of her middle when she touched Poncho this step, to push him away from (GDD-CMB-03); undefined for no touch. */
  readonly touch: number | undefined;
}

const EDGE = 1e-6;

/** The index of her phase in the per-phase tuning arrays: 0, 1 or 2 (defeated, she stays at 2). */
export const catorcePhaseIndex = (hits: number): 0 | 1 | 2 => (hits >= 2 ? 2 : hits === 1 ? 1 : 0);

/**
 * At the start of the fight (`hits` 0) or of the phase she is in after a lost life (GDD-BOS-01): at the phase's right stop, armoured,
 * telegraphing her run to the left, every home tile whole.
 */
export function catorceStart(def: Catorce, hits: number): CatorceState {
  return { x: CATORCE.stops[catorcePhaseIndex(hits)][1], hits, mode: 'telegraph', age: 0, dir: -1, armoured: true, home: freshCrumbles(def.home) };
}

/** Her box, CATORCE.width x CATORCE.height, its bottom on the arena's floor. */
export const catorceBox = (def: Catorce, c: CatorceState): Box => ({ x0: c.x - CATORCE.width / 2, x1: c.x + CATORCE.width / 2, y0: def.floor - CATORCE.height, y1: def.floor });

/** Whether she is in play: then touching her is a hit (GDD-CMB-03). Hurt or defeated she is not. */
export const catorceActive = (c: CatorceState): boolean => c.mode !== 'hurt' && c.mode !== 'defeated';

/** A hit: hurt, or defeated by the last one (CATORCE.hits). */
export const hitCatorce = (c: CatorceState): CatorceState => ({ ...c, hits: c.hits + 1, mode: c.hits + 1 >= CATORCE.hits ? 'defeated' : 'hurt', age: 0 });

/** GDD-BOS-01: the level is clear CATORCE.defeatSteps after the hit that defeats her. */
export const catorceCleared = (c: CatorceState): boolean => c.mode === 'defeated' && c.age >= CATORCE.defeatSteps;

/**
 * One step of her pattern (GDD-BOS-04). `player` is Poncho after his move this step: a home tile that is due back waits while his body box
 * is in it (`stepCrumbles`). `slam` says she halted at a stop this step. In a phase whose slam shakes the shed (`shakesHome`) the home tile
 * on her side then starts its warning, if it is idle; Poncho's weight never starts one.
 */
export function moveCatorce(def: Catorce, c: CatorceState, player: PlayerState): { catorce: CatorceState; slam: boolean } {
  const p = catorcePhaseIndex(c.hits);
  const age = c.age + 1;
  const home = stepCrumbles(def.home, c.home, player, true, false);
  const moved = (catorce: Omit<CatorceState, 'home'>, slam = false) => ({ catorce: { ...catorce, home }, slam });
  switch (c.mode) {
    case 'telegraph': {
      // The switch to the charge is a step on which she does not yet move.
      if (age < CATORCE.telegraphSteps) return moved({ ...c, age });
      return moved({ ...c, mode: 'charge', age: 0 });
    }
    case 'charge': {
      const stop = CATORCE.stops[p][c.dir < 0 ? 0 : 1];
      const dist = CATORCE.speed[p] * STEP;
      if (Math.abs(stop - c.x) > dist + EDGE) return moved({ ...c, x: c.x + c.dir * dist, age });
      // She arrives on the step she reaches or passes the stop: her armour ends, and she runs the other way next.
      const dir: 1 | -1 = c.dir < 0 ? 1 : -1;
      const next = { ...c, x: stop, armoured: false, dir, ...(CATORCE.restSteps[p] === 0 ? { mode: 'telegraph' as const } : { mode: 'rest' as const }), age: 0 };
      // The tile on her side: the left one under the join of the two, else the right one.
      const side = stop < (def.home[0]!.col + 1) * TILE ? 0 : 1;
      const shaken = CATORCE.shakesHome[p] && home[side]?.phase === 'idle' ? home.map((s, i) => (i === side ? { phase: 'warning' as const, steps: CRUMBLE.warningSteps } : s)) : home;
      return { catorce: { ...next, home: shaken }, slam: true };
    }
    case 'rest':
      return moved(age < CATORCE.restSteps[p] ? { ...c, age } : { ...c, mode: 'telegraph', age: 0 });
    case 'hurt': {
      if (age < CATORCE.hurtSteps) return moved({ ...c, age });
      // The next phase starts where she stands: armoured, telegraphing, towards the stop of the new phase that is farther from her.
      const [left, right] = CATORCE.stops[p];
      return moved({ ...c, mode: 'telegraph', age: 0, armoured: true, dir: Math.abs(c.x - left) > Math.abs(c.x - right) ? -1 : 1 });
    }
  }
  // Defeated: she only ages.
  return moved({ ...c, age });
}

/** What reads her this step: Poncho after his move, the falling carts by their rail's place (null for one that is not falling), the fireballs' boxes. */
export interface CatorceInput {
  readonly player: PlayerState;
  readonly carts: readonly (FallingCart | null)[];
  readonly fireballs: readonly Box[];
}

/**
 * One step of the fight (GDD-BOS-04): she moves, then the falling carts that meet her break on her (a hit, if the cart is not ridden off
 * and she is not armoured, hurt or defeated), a fireball is used up on her, and then what touches Poncho. A hit on her is settled before
 * her touch, so the step that hits her does not hurt him through her. The run keeps nothing of a step that costs Poncho a life and restarts
 * her phase with `catorceStart`.
 */
export function stepCatorce(def: Catorce, c: CatorceState, input: CatorceInput): CatorceStep {
  const { catorce: moved, slam } = moveCatorce(def, c, input.player);
  const box = catorceBox(def, moved);
  // Shared edges do not overlap. A cart that breaks on her while she cannot be hit is no hit; two scoring carts on one step are one hit.
  let catorce = moved;
  let hit = false;
  const broken = input.carts.map((cart) => {
    if (!cart || !overlaps(cart.box, box)) return false;
    if (!cart.ridden && !catorce.armoured && catorceActive(catorce)) {
      catorce = hitCatorce(catorce);
      hit = true;
    }
    return true;
  });
  // A fireball is used up on her and does nothing, unless she is defeated.
  const spent = input.fireballs.map((f) => moved.mode !== 'defeated' && overlaps(f, box));
  // The claw is no input: it passes through her. A stomp is a touch like any other.
  const touch = catorceActive(catorce) && overlaps(ponchoBox(input.player), box) ? catorce.x : undefined;
  return { catorce, slam, hit, broken, spent, touch };
}
