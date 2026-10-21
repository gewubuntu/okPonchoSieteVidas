// GDD-WLD-05 and GDD-MOV-06: spikes. A spike sits in a tile and hurts through its lower half; Poncho is hurt through
// his hurtbox, which is smaller than his body box so near-misses feel fair. Pure logic, no Phaser (GDD-TEC-02).
import { HITBOX, HURTBOX, SPIKE, TILE } from '../config/tuning';
import type { PlayerState } from './movement';

/** The tile a spike stands in. */
export interface Spike {
  readonly col: number;
  readonly row: number;
}

/**
 * Poncho's hurtbox (GDD-MOV-06): 10 x 12 px inside the body box, centred on it. `y` is the top, `x` the left edge.
 * Poncho's own position is the middle of his feet.
 */
export function hurtbox(player: PlayerState): { x: number; y: number; w: number; h: number } {
  return {
    x: player.x - HURTBOX.width / 2,
    y: player.y - HITBOX.height + (HITBOX.height - HURTBOX.height) / 2,
    w: HURTBOX.width,
    h: HURTBOX.height,
  };
}

/** Whether Poncho's hurtbox overlaps the spike's hurting part. Boxes that only share an edge do not touch. */
export function touchesSpike(player: PlayerState, spike: Spike): boolean {
  const h = hurtbox(player);
  const left = spike.col * TILE;
  const top = (spike.row + 1) * TILE - SPIKE.height;
  return h.x < left + TILE && h.x + h.w > left && h.y < top + SPIKE.height && h.y + h.h > top;
}
