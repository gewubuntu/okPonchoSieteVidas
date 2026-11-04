// GDD-BOS-03: La Estrella de Siete Picos, World 2's boss: a giant seven-pointed posada piñata on a trolley on a cable over the plaza, and
// the tejocotes that roll out of her. She follows a fixed pattern, with nothing left to chance: the only thing that varies is where Poncho
// is (her phase 3 aim). She is hit the way any piñata is, by a head bump from below or the claw (GDD-PWR-05). Pure logic, no Phaser
// (GDD-TEC-02). Not wired into the run yet.
import { ESTRELLA, HITBOX, STEP, TEJOCOTE } from '../config/tuning';
import { ponchoBox } from './boss';
import { overlaps, type Box } from './enemy';
import { hurtbox } from './hazards';
import { squareBlocked } from './item';
import type { PlayerState } from './movement';
import type { PlatformPos } from './platform';
import type { TileGrid } from './tilemap';

/** Her arena: the floor's top, and per phase the x of her drop spots (her middle). */
export interface Estrella {
  readonly floor: number;
  /**
   * One list per phase. She starts the phase high over its first spot and drops at the next one, then at each in turn (so with two spots
   * she alternates). Phase 3's list holds only where she starts it: there she aims at Poncho.
   */
  readonly spots: readonly [readonly number[], readonly number[], readonly number[]];
}

/**
 * 'glide' along the cable to her next drop spot, 'telegraph' before the drop (GDD-ENM-01), 'drop' (the jalón) onto an awning or the floor,
 * 'bounce' up from an awning, 'rest' on the floor, 'rise' from it, 'hang' low, 'yank' back up to the cable, 'hurt' after a hit, 'defeated'
 * after the last one.
 */
export type EstrellaMode = 'glide' | 'telegraph' | 'drop' | 'bounce' | 'rest' | 'rise' | 'hang' | 'yank' | 'hurt' | 'defeated';

export interface EstrellaState {
  /** The middle of her box across, and its bottom. */
  readonly x: number;
  readonly y: number;
  /** Hits taken, 0 to ESTRELLA.hits. She is in phase `hits + 1`. */
  readonly hits: number;
  readonly mode: EstrellaMode;
  /** Steps in this mode: 0 on the step it starts, one more on each step after. */
  readonly age: number;
  /** In phases 1 and 2: which of her phase's spots she glides to next. */
  readonly spot: number;
  /** Where a drop, a bounce, a rise or a yank takes her middle across and her bottom. In a hang, `tx` is the x she sways about. */
  readonly tx: number;
  readonly ty: number;
}

/** A tejocote: its middle and the y of its bottom, like Poncho's own position, the way it rolls, and the steps before it comes out. */
export interface Tejocote {
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  /** Steps before it rolls out of her (the second pair waits TEJOCOTE.secondPairSteps); until then it is not in play. */
  readonly wait: number;
}

/** What one step of the fight did, for the run to apply. */
export interface EstrellaStep {
  readonly estrella: EstrellaState;
  readonly tejocotes: readonly Tejocote[];
  /** Poncho after the step: as he moved, or, after a bump, with his head flush under her and his rise stopped. */
  readonly player: PlayerState;
  /** She was hit this step (a bump or the claw). */
  readonly hit: boolean;
  /** One flag per fireball given: used up this step, on her or on a tejocote it burst. */
  readonly spent: readonly boolean[];
  /** The x of what touched Poncho this step, to push him away from (GDD-CMB-03): her middle, else a tejocote's; undefined for none. */
  readonly touch: number | undefined;
  /** Her drop ended this step on an awning or on the floor (for the tarp's dip and the sounds). */
  readonly landed: 'awning' | 'floor' | null;
}

const EDGE = 1e-6;

/** She is in phase 1 until her first hit, then 2, then 3. */
export const estrellaPhase = (e: EstrellaState): number => e.hits + 1;

/** The index of her phase in the per-phase tuning arrays: 0, 1 or 2 (defeated, she stays at 2). */
const phaseIndex = (hits: number): 0 | 1 | 2 => (hits >= 2 ? 2 : hits === 1 ? 1 : 0);

/**
 * At the start of the fight (`hits` 0) or of the phase she is in after a lost life (GDD-BOS-01): high over the phase's first spot, a glide
 * to the next about to start.
 */
export function estrellaStart(def: Estrella, hits: number): EstrellaState {
  const spots = def.spots[phaseIndex(hits)];
  const x = spots[0]!;
  return { x, y: ESTRELLA.highBottom, hits, mode: 'glide', age: 0, spot: spots.length > 1 ? 1 : 0, tx: x, ty: ESTRELLA.highBottom };
}

/** Where she aims in phase 3: the middle of Poncho's hurtbox, across only, kept between ESTRELLA.aimMinX and aimMaxX. */
export function aimAt(player: PlayerState): number {
  const h = hurtbox(player);
  return Math.max(ESTRELLA.aimMinX, Math.min(ESTRELLA.aimMaxX, h.x + h.w / 2));
}

/** The top of the surface under x: the highest awning whose top spans it (from its left end, up to its right end), else the floor. She passes through cordeles. */
export function surfaceUnder(def: Estrella, awnings: readonly PlatformPos[], x: number): number {
  return awnings.reduce((top, a) => (a.x <= x && x < a.x + a.w ? Math.min(top, a.y) : top), def.floor);
}

/** Moves her towards (tx, ty) at `speed` px/s; she arrives on the step she reaches it. */
function move(e: EstrellaState, speed: number): { at: EstrellaState; arrived: boolean } {
  const dist = speed * STEP;
  const d = Math.hypot(e.tx - e.x, e.ty - e.y);
  if (d <= dist + EDGE) return { at: { ...e, x: e.tx, y: e.ty, age: e.age + 1 }, arrived: true };
  return { at: { ...e, x: e.x + ((e.tx - e.x) / d) * dist, y: e.y + ((e.ty - e.y) / d) * dist, age: e.age + 1 }, arrived: false };
}

/** The index of her phase's spot nearest x (the first of equals). */
function nearestSpot(spots: readonly number[], x: number): number {
  return spots.reduce((best, s, i) => (Math.abs(s - x) < Math.abs(spots[best]! - x) ? i : best), 0);
}

/**
 * One step of her pattern (GDD-BOS-03). `player` is Poncho at the start of the step, which she aims at in phase 3; `awnings` the tops of
 * the whole awnings. `landed` says where a drop ended this step.
 */
export function moveEstrella(def: Estrella, e: EstrellaState, player: PlayerState, awnings: readonly PlatformPos[]): { estrella: EstrellaState; landed: 'awning' | 'floor' | null } {
  const p = phaseIndex(e.hits);
  const age = e.age + 1;
  const still = (estrella: EstrellaState) => ({ estrella, landed: null });
  switch (e.mode) {
    case 'glide': {
      // Phase 3: always towards the spot above Poncho.
      const tx = p === 2 ? aimAt(player) : def.spots[p][e.spot]!;
      const { at, arrived } = move({ ...e, tx, ty: ESTRELLA.highBottom }, ESTRELLA.glideSpeed[p]);
      return still(arrived ? { ...at, mode: 'telegraph', age: 0 } : at);
    }
    case 'telegraph': {
      if (age < ESTRELLA.telegraphSteps) return still({ ...e, age });
      // The jalón: straight down to the surface under her, or in phase 3 in a straight line to the surface under Poncho as the telegraph ends.
      const tx = p === 2 ? aimAt(player) : e.x;
      return still({ ...e, mode: 'drop', age: 0, tx, ty: surfaceUnder(def, awnings, tx) });
    }
    case 'drop': {
      const { at, arrived } = move(e, ESTRELLA.dropSpeed[p]);
      if (!arrived) return still(at);
      // An awning throws her straight back up to her low height; on the floor she rests, and tejocotes roll out.
      if (at.y < def.floor) return { estrella: { ...at, mode: 'bounce', age: 0, ty: ESTRELLA.lowBottom[p] }, landed: 'awning' };
      return { estrella: { ...at, mode: 'rest', age: 0 }, landed: 'floor' };
    }
    case 'bounce': {
      const { at, arrived } = move(e, ESTRELLA.awningThrow);
      return still(arrived ? { ...at, mode: 'hang', age: 0 } : at);
    }
    case 'rest':
      return still(age < ESTRELLA.restSteps ? { ...e, age } : { ...e, mode: 'rise', age: 0, ty: ESTRELLA.lowBottom[p] });
    case 'rise': {
      const { at, arrived } = move(e, ESTRELLA.riseSpeed);
      return still(arrived ? { ...at, mode: 'hang', age: 0 } : at);
    }
    case 'hang': {
      // She sways about where she hangs on a sine, which is back at its middle when the hang ends; then the next spot.
      if (age < ESTRELLA.hangSteps[p]) return still({ ...e, x: e.tx + ESTRELLA.swayPx[p] * Math.sin((2 * Math.PI * age) / ESTRELLA.swayPeriodSteps), age });
      const spots = def.spots[p];
      return still({ ...e, x: e.tx, mode: 'yank', age: 0, ty: ESTRELLA.highBottom, spot: (e.spot + 1) % spots.length });
    }
    case 'yank': {
      const { at, arrived } = move(e, ESTRELLA.yankSpeed);
      return still(arrived ? { ...at, mode: 'glide', age: 0 } : at);
    }
    case 'hurt':
      // Then she is yanked straight up and starts her next phase from its spot nearest her.
      if (age < ESTRELLA.hurtSteps) return still({ ...e, age });
      return still({ ...e, mode: 'yank', age: 0, tx: e.x, ty: ESTRELLA.highBottom, spot: nearestSpot(def.spots[p], e.x) });
  }
  // Defeated: the rope snaps and the empty pot falls to the floor and lies there.
  return still({ ...e, y: Math.min(def.floor, e.y + ESTRELLA.fallSpeed * STEP), age });
}

/** Her box, ESTRELLA.width x ESTRELLA.height, its bottom at her y. */
export const estrellaBox = (e: EstrellaState): Box => ({ x0: e.x - ESTRELLA.width / 2, x1: e.x + ESTRELLA.width / 2, y0: e.y - ESTRELLA.height, y1: e.y });

/** Whether she is in play: then touching her is a hit (GDD-CMB-03) and she can be hit. Hurt or defeated she is neither. */
export const estrellaActive = (e: EstrellaState): boolean => e.mode !== 'hurt' && e.mode !== 'defeated';

/** A hit: hurt, or defeated by the last one (ESTRELLA.hits). */
export const hitEstrella = (e: EstrellaState): EstrellaState => ({ ...e, hits: e.hits + 1, mode: e.hits + 1 >= ESTRELLA.hits ? 'defeated' : 'hurt', age: 0 });

/** GDD-BOS-01: the level is clear ESTRELLA.defeatSteps after the hit that defeats her. */
export const estrellaCleared = (e: EstrellaState): boolean => e.mode === 'defeated' && e.age >= ESTRELLA.defeatSteps;

/**
 * A head bump from below, as on a piñata block (GDD-PWR-05): Poncho moved up this step from his hurtbox's top at or below her box's
 * bottom to above it, his body box overlapping her box's width.
 */
export function bumps(before: PlayerState, after: PlayerState, e: EstrellaState): boolean {
  return hurtbox(before).y >= e.y && hurtbox(after).y < e.y && Math.abs(after.x - e.x) < (HITBOX.width + ESTRELLA.width) / 2;
}

/** A tejocote's square box. */
export const tejocoteBox = (t: Tejocote): Box => ({ x0: t.x - TEJOCOTE.size / 2, x1: t.x + TEJOCOTE.size / 2, y0: t.y - TEJOCOTE.size, y1: t.y });

/** Out of her and rolling: it can touch and be burst. */
export const tejocoteOut = (t: Tejocote): boolean => t.wait === 0;

/** The tejocotes of a thud: TEJOCOTE.pairs for her phase, one each way per pair, at her middle on the floor, a pair every secondPairSteps. */
function spill(e: EstrellaState, floor: number): Tejocote[] {
  return Array.from({ length: TEJOCOTE.pairs[phaseIndex(e.hits)] }, (_, k): Tejocote[] => ([-1, 1] as const).map((dir) => ({ x: e.x, y: floor, dir, wait: k * TEJOCOTE.secondPairSteps }))).flat();
}

/** One step of a tejocote, or null once it is gone: it waits to come out, then rolls along the floor, gone when it meets a wall. */
export function stepTejocote(t: Tejocote, world: TileGrid): Tejocote | null {
  if (t.wait > 0) return { ...t, wait: t.wait - 1 };
  const x = t.x + t.dir * TEJOCOTE.rollSpeed * STEP;
  return squareBlocked(world, x, t.y, TEJOCOTE.size) ? null : { ...t, x };
}

/** Poncho and what can hit her or a tejocote this step. */
export interface EstrellaInput {
  /** Poncho at the start of the step (she aims at him; his hurtbox then decides a bump) and after his move this step. */
  readonly before: PlayerState;
  readonly after: PlayerState;
  /** The claw swipe's box this step, if any (GDD-CMB-02), and the boxes of the fireballs in flight (GDD-PWR-03). */
  readonly claw: Box | null;
  readonly fireballs: readonly Box[];
  /** The tops of the whole awnings. */
  readonly awnings: readonly PlatformPos[];
  readonly world: TileGrid;
}

/**
 * One step of the fight (GDD-BOS-03): she moves, the tejocotes roll (new ones out of a thud), then the hits on her and on the tejocotes,
 * then what touches Poncho. A hit on her is settled before her touch, so the step that hits her does not hurt him through her. The run
 * keeps nothing of a step that costs Poncho a life (so such a step does not hit her) and restarts her phase with `estrellaStart`.
 */
export function stepEstrella(def: Estrella, fight: { readonly estrella: EstrellaState; readonly tejocotes: readonly Tejocote[] }, input: EstrellaInput): EstrellaStep {
  const { estrella: moved, landed } = moveEstrella(def, fight.estrella, input.before, input.awnings);
  let tejocotes = [...fight.tejocotes.flatMap((t) => stepTejocote(t, input.world) ?? []), ...(landed === 'floor' ? spill(moved, def.floor) : [])];
  const box = estrellaBox(moved);
  // A bump or the claw hits her while she is in play. A bump stops his rise, his head flush under her, as on a piñata block.
  const bump = estrellaActive(moved) && bumps(input.before, input.after, moved);
  const hit = bump || (estrellaActive(moved) && input.claw !== null && overlaps(input.claw, box));
  const estrella = hit ? hitEstrella(moved) : moved;
  const player = bump ? { ...input.after, y: moved.y + HITBOX.height, vy: 0 } : input.after;
  // Defeated, her filling is gone at once.
  if (estrella.mode === 'defeated') tejocotes = [];
  // A fireball is used up on her and does nothing (a piñata is not burnt open), unless she is defeated; one that touches a tejocote bursts it.
  const out = tejocotes.filter(tejocoteOut);
  const spent = input.fireballs.map((f) => (moved.mode !== 'defeated' && overlaps(f, box)) || out.some((t) => overlaps(f, tejocoteBox(t))));
  // The claw bursts the tejocotes it overlaps.
  tejocotes = tejocotes.filter((t) => !tejocoteOut(t) || !((input.claw !== null && overlaps(input.claw, tejocoteBox(t))) || input.fireballs.some((f) => overlaps(f, tejocoteBox(t)))));
  const poncho = ponchoBox(player);
  const touch = estrellaActive(estrella) && overlaps(poncho, estrellaBox(estrella)) ? estrella.x : tejocotes.find((t) => tejocoteOut(t) && overlaps(poncho, tejocoteBox(t)))?.x;
  return { estrella, tejocotes, player, hit, spent, touch, landed };
}
