// GDD-WLD-03: raised bottoms. A tall level may give spans of columns a bottom row higher than its last row: there Poncho is lost once his
// body box is wholly below its floor line (GDD-LIFE-02), and the camera stops 2 px above it (GDD-UI-04). Pure logic, no Phaser.
import { TILE } from '../config/tuning';
import type { TileGrid } from './tilemap';

/** GDD-WLD-03: the columns `fromCol` to `toCol` (both included) whose bottom row, the last row that counts there, is `row`. */
export interface Bottom {
  readonly fromCol: number;
  readonly toCol: number;
  readonly row: number;
}

/** What a column's bottom is read from: the level's tiles and its raised bottoms (left out means none). */
export interface Floored {
  readonly world: TileGrid;
  readonly bottoms?: readonly Bottom[] | undefined;
}

/** GDD-WLD-03: column `col`'s bottom row: its span's row, or the level's last row outside every span. */
export function bottomRowAt(level: Floored, col: number): number {
  return level.bottoms?.find((b) => col >= b.fromCol && col <= b.toCol)?.row ?? level.world.height - 1;
}

/** GDD-WLD-03: the floor line under level x `x`: the bottom edge of the bottom row of the column `x` is in. */
export const floorYAt = (level: Floored, x: number): number => (bottomRowAt(level, Math.floor(x / TILE)) + 1) * TILE;
