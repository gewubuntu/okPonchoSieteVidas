// GDD-ART-01: the canvas is ART_SCALE times larger than the game pixels every rule is written in, so a pointer position (canvas
// pixels) is divided by it before any layout or hit test reads it.
import { ART_SCALE } from '../config/tuning';

/** A point on the canvas, in art pixels, as a point in game pixels. */
export function gamePoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / ART_SCALE, y: p.y / ART_SCALE };
}
