// GDD-LIFE-02 and GDD-MOV-05: Poncho flips and lands feet-first when he respawns. Pure data, no Phaser, counted in
// simulation steps, so it can be unit tested. The scene draws the pose it returns.
import { FLIP } from '../config/tuning';

export interface FlipPose {
  /** Whether Poncho is shown at all. He stays hidden until the flip starts. */
  readonly visible: boolean;
  /** How far above the respawn point he is, in px. 0 once he has landed. */
  readonly dy: number;
  /** How far he has turned, in radians. A whole number of turns means upright, feet down. */
  readonly angle: number;
}

/**
 * The pose while waiting to respawn, with `wait` steps left (RunState.wait). In the last FLIP.steps steps he drops in
 * and turns once, speeding up like a falling body, and on the last step he is on the ground and upright, so the step
 * that follows (the real respawn) does not move him.
 */
export function flipPose(wait: number): FlipPose {
  if (wait > FLIP.steps) return { visible: false, dy: 0, angle: 0 };
  if (wait <= 0) return { visible: true, dy: 0, angle: 0 };
  const t = (FLIP.steps - wait + 1) / FLIP.steps; // 1/21 on the first step up to 1 on the last
  return { visible: true, dy: FLIP.height * (1 - t * t), angle: FLIP.turns * 2 * Math.PI * t };
}
