// GDD-ART-06: which ground tile picture a solid tile gets. Pure logic, no Phaser.

/** The frames of the ground sheet: two versions of the top tile, then two of the earth tile. */
export const TOP_FRAME = 0;
export const EARTH_FRAME = 2;

/**
 * The frame for the solid tile at (`tx`, `ty`): a top tile when no solid tile lies directly above it (or it is in the level's top
 * row), else an earth tile; the version is (7 x column + 3 x row) mod 2, which alternates like a checkerboard, so neighbours differ.
 */
export function groundFrame(solid: (tx: number, ty: number) => boolean, tx: number, ty: number): number {
  const top = ty === 0 || !solid(tx, ty - 1);
  const version = (7 * tx + 3 * ty) % 2;
  return (top ? TOP_FRAME : EARTH_FRAME) + version;
}
