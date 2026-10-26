// GDD-ART-06, GDD-UI-04: the far layers of the backdrop scroll at a share of the camera's scroll. Pure logic, no Phaser.
import { ART_SCALE } from '../config/tuning';

/** How far a layer that scrolls at `factor` of the camera is shifted for the camera's `scrollX`, in game px, rounded to a whole art pixel. */
export function parallaxOffset(scrollX: number, factor: number): number {
  return Math.round(scrollX * factor * ART_SCALE) / ART_SCALE;
}
