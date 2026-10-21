// GDD-CMB-02: the claw swipe. A button press starts a short wind-up, then a swing that hits a box in front of Poncho for a
// few steps. Pure logic, no Phaser (GDD-TEC-02).
import { CLAW, HITBOX, TILE } from '../config/tuning';
import type { PlayerState } from './movement';

export interface ClawState {
  readonly phase: 'idle' | 'windup' | 'swing';
  /** Steps taken in the current phase, counting this one. 0 while idle. */
  readonly steps: number;
  /** Steps until the next swing may start. Counts down from the press that started the last one. */
  readonly cooldown: number;
  /** Which way the swing faces, fixed by the press. */
  readonly dir: 1 | -1;
  /** Was the button down on the last step? A swing starts on the press, not while it is held. */
  readonly held: boolean;
}

export const IDLE_CLAW: ClawState = { phase: 'idle', steps: 0, cooldown: 0, dir: 1, held: false };

/**
 * Advances the claw one step. A press (the button down now and not on the last step) starts a swing facing `facing`, if
 * none is going on and the cooldown is over; a press at any other time is ignored, and holding the button never swings
 * again.
 */
export function stepClaw(claw: ClawState, held: boolean, facing: 1 | -1): ClawState {
  const cooldown = Math.max(0, claw.cooldown - 1);
  const base = { cooldown, dir: claw.dir, held };
  if (claw.phase === 'idle') {
    if (held && !claw.held && cooldown === 0) return { phase: 'windup', steps: 1, cooldown: CLAW.cooldownSteps, dir: facing, held };
    return { ...base, phase: 'idle', steps: 0 };
  }
  if (claw.phase === 'windup') {
    return claw.steps < CLAW.windupSteps ? { ...base, phase: 'windup', steps: claw.steps + 1 } : { ...base, phase: 'swing', steps: 1 };
  }
  return claw.steps < CLAW.activeSteps ? { ...base, phase: 'swing', steps: claw.steps + 1 } : { ...base, phase: 'idle', steps: 0 };
}

/** The area the claw hits this step: only while swinging, the body's height, starting at its front edge. Edges are x0 < x1, y0 < y1. */
export function clawBox(player: PlayerState, claw: ClawState): { x0: number; x1: number; y0: number; y1: number } | null {
  if (claw.phase !== 'swing') return null;
  const front = player.x + (claw.dir * HITBOX.width) / 2;
  const x0 = claw.dir > 0 ? front : front - CLAW.reach;
  return { x0, x1: x0 + CLAW.reach, y0: player.y - CLAW.height, y1: player.y };
}

/** Whether the box overlaps tile (col, row). Boxes that only share an edge do not touch. */
export function boxTouchesTile(box: { x0: number; x1: number; y0: number; y1: number }, col: number, row: number): boolean {
  return box.x0 < (col + 1) * TILE && box.x1 > col * TILE && box.y0 < (row + 1) * TILE && box.y1 > row * TILE;
}
