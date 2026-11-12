// GDD-ENM-02, GDD-ENM-03, GDD-ENM-04, GDD-ART-05: a defeated enemy's last frames: squashed by a stomp or knocked by the claw or a fireball, then a poof.
// Cosmetic only: nothing in the run reads it. Pure, no Phaser: the scene draws what this says.
import { ENEMY_ART } from '../config/tuning';
import { enemyBox, kindOf, type EnemyKind } from '../sim/enemy';
import type { Level, RunState } from '../sim/run';
import { lookFrame, POOF_LOOKS, type EnemyLook, type Sheet } from './enemyLooks';

/**
 * The kinds that go in a poof: every one that can be defeated, the cactus buddy too, by the Chile Fantasma (GDD-PWR-04) or a rolling cart
 * (GDD-WLD-15) alone. Not the Armadillo yet (GDD-ENM-04): placeholder until armadillo.png (run B2), it has no squash or hit frame, and one
 * that falls out of the level is gone with no poof.
 */
export type DefeatKind = 'alacran' | 'zopilote' | 'cactus' | 'tlacuache' | 'paloma' | 'chapulin' | 'trompo' | 'murcielago';
const poofs = (kind: EnemyKind): kind is DefeatKind => kind === 'alacran' || kind === 'zopilote' || kind === 'cactus' || kind === 'tlacuache' || kind === 'paloma' || kind === 'chapulin' || kind === 'trompo' || kind === 'murcielago';

export interface DefeatFx {
  readonly kind: DefeatKind;
  /** The middle of its box where it was defeated, and its feet (the box's bottom). */
  readonly x: number;
  readonly y: number;
  readonly feet: number;
  /** It faced left. */
  readonly flip: boolean;
  /** A stomp defeated it (it is squashed), not the claw or a fireball (it is knocked). */
  readonly stomped: boolean;
  /** Steps since it was defeated (a cactus buddy's starts at ENEMY_ART.defeatSteps: it has no squash or hit frame). */
  readonly age: number;
}

/** How long an effect lasts: its squash or hit frame, then the poof's four frames (0.4 s). */
export const DEFEAT_FX_STEPS = ENEMY_ART.defeatSteps + 4 * ENEMY_ART.poofSteps;

/**
 * The effects after one step from `before` to `after`. Each one ages a step and is dropped after DEFEAT_FX_STEPS; each enemy that was alive
 * and is not now, of a kind that goes in a poof, adds one. A stomp squashes it, but a Zopilote is never stomped (GDD-CMB-01): one that falls
 * in the step of a stomp was knocked. A life lost (the run respawning, or the enemies back to life) clears them all.
 */
export function stepDefeats(fx: readonly DefeatFx[], before: Pick<RunState, 'enemies'>, after: Pick<RunState, 'enemies' | 'stomped' | 'phase'>, level: Pick<Level, 'enemies'>): readonly DefeatFx[] {
  const revived = after.enemies !== before.enemies && after.enemies.some((e, i) => e.alive && !before.enemies[i]!.alive);
  if (after.phase === 'respawning' || revived) return [];
  const aged = fx.map((e) => ({ ...e, age: e.age + 1 })).filter((e) => e.age < DEFEAT_FX_STEPS);
  const fresh = after.enemies.flatMap((e, i): DefeatFx[] => {
    const def = level.enemies[i]!;
    const kind = kindOf(def);
    if (!before.enemies[i]!.alive || e.alive || !poofs(kind)) return [];
    const box = enemyBox(def, e);
    // GDD-PWR-04: the cactus buddy has no squash or hit frame, so its effect starts past that stage, at the poof (its frames are 16 steps).
    return [{ kind, x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, feet: box.y1, flip: e.dir < 0, stomped: after.stomped && kind !== 'zopilote', age: kind === 'cactus' ? ENEMY_ART.defeatSteps : 0 }];
  });
  return [...aged, ...fresh];
}

export interface DefeatLook {
  /** The sheet the frame is in: the kind's, or the poof's. */
  readonly sheet: Sheet;
  readonly look: EnemyLook;
  readonly frame: number;
  /** The middle across; down, a walker's feet for its squash or hit frame, else the middle of the frame. */
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
}

/**
 * The frame an effect shows: for ENEMY_ART.defeatSteps the kind's squash frame (stomped) or hit frame (knocked) where it stood, a walker's at
 * its feet and a Zopilote's or a Murciélago's at its box's middle (where it flew, GDD-ENM-04), the hit frame rising ENEMY_ART.hitRise px over them; then the poof, a frame every
 * poofSteps, on its box's middle.
 */
export function defeatLook(e: DefeatFx): DefeatLook {
  if (e.age >= ENEMY_ART.defeatSteps) {
    const look = POOF_LOOKS[Math.floor((e.age - ENEMY_ART.defeatSteps) / ENEMY_ART.poofSteps)]!;
    return { sheet: 'poof', look, frame: lookFrame('poof', look), x: e.x, y: e.y, flip: false };
  }
  // A Trompo has no hit frame (GDD-ENM-03: the claw and a fireball only stun it), so it shows its squash whatever `stomped` says: after a
  // stomp, and when a rolling cart runs it down (GDD-WLD-15).
  const squashed = e.stomped || e.kind === 'trompo';
  const look: EnemyLook = squashed ? 'squash' : 'hit';
  const rise = squashed ? 0 : (ENEMY_ART.hitRise * e.age) / ENEMY_ART.defeatSteps;
  return { sheet: e.kind, look, frame: lookFrame(e.kind, look), x: e.x, y: (e.kind === 'zopilote' || e.kind === 'murcielago' ? e.y : e.feet) - rise, flip: e.flip };
}
