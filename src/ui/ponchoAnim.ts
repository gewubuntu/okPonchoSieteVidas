// GDD-ART-04: which frame of Poncho's sheet shows. Pure, no Phaser: the scene feeds it one simulation step at a time.
import { ANIM } from '../config/tuning';

export interface PonchoAnim {
  /** The sheet's frame: STAND, or 1 to ANIM.runFrames for the run cycle. */
  frame: number;
  /** Distance run since the cycle began, in px. */
  distance: number;
  /** Where he was at the last step, so the next one can measure how far he went. */
  x: number;
}

/** Sheet frame 0 is the standing frame; the run frames are 1 to ANIM.runFrames. */
export const STAND = 0;

export function startAnim(x: number): PonchoAnim {
  return { frame: STAND, distance: 0, x };
}

/**
 * The run frames play on the ground at `ANIM.runMinSpeed` or more, one for every `ANIM.runFramePx` run, starting at the first
 * each time he starts to run. Standing, in the air (gliding and clinging too) and when not `playing` (the respawn flip, every
 * other phase) he shows the standing frame.
 */
export function stepAnim(prev: PonchoAnim, p: { x: number; vx: number; grounded: boolean }, playing: boolean): PonchoAnim {
  const running = playing && p.grounded && Math.abs(p.vx) >= ANIM.runMinSpeed;
  if (!running) return { frame: STAND, distance: 0, x: p.x };
  const distance = prev.frame === STAND ? 0 : prev.distance + Math.abs(p.x - prev.x);
  return { frame: 1 + (Math.floor(distance / ANIM.runFramePx) % ANIM.runFrames), distance, x: p.x };
}
