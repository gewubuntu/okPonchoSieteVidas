// GDD-TEC-03: the tiles the camera can show, so that a frame draws no more ground in a tall level than in a one-screen one. Pure logic, no
// Phaser.
import { BASE_HEIGHT, BASE_WIDTH, TILE, VIEW } from '../../config/tuning';

/** A rectangle of tiles, every bound included. */
export interface TileView {
  readonly col0: number;
  readonly col1: number;
  readonly row0: number;
  readonly row1: number;
}

/**
 * GDD-TEC-03: the tiles the screen covers at the camera's scroll (the level x and y at its top left corner, game px), widened by
 * `VIEW.marginTiles` on every side: the screen's pixels run from the scroll to 480 and 270 px on, short of the last.
 */
export function tilesInView(scrollX: number, scrollY: number): TileView {
  const m = VIEW.marginTiles;
  return {
    col0: Math.floor(scrollX / TILE) - m,
    col1: Math.ceil((scrollX + BASE_WIDTH) / TILE) - 1 + m,
    row0: Math.floor(scrollY / TILE) - m,
    row1: Math.ceil((scrollY + BASE_HEIGHT) / TILE) - 1 + m,
  };
}

/** Whether tile (tx, ty) is in `view`. */
export const tileInView = (view: TileView, tx: number, ty: number): boolean => tx >= view.col0 && tx <= view.col1 && ty >= view.row0 && ty <= view.row1;

/**
 * GDD-TEC-03: whether a decor item standing in column `col`, its foot at level y `footY` and `height` px tall, has any of it in `view`:
 * its column in the view's, and its span from `footY - height` to `footY` overlapping the view's rows.
 */
export const decorInView = (view: TileView, col: number, footY: number, height: number): boolean =>
  col >= view.col0 && col <= view.col1 && footY > view.row0 * TILE && footY - height < (view.row1 + 1) * TILE;
