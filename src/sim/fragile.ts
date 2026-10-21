// GDD-WLD-05: fragile walls (papel picado). A fragile tile is solid like a wall until a claw swipe breaks it, for good,
// until Poncho loses a life. Pure logic, no Phaser (GDD-TEC-02).
import type { TileGrid } from './tilemap';

/** The tile a fragile wall stands in. */
export interface Fragile {
  readonly col: number;
  readonly row: number;
}

/** The level's tiles plus the fragile tiles that are not broken yet. */
export function withFragiles(world: TileGrid, fragiles: readonly Fragile[], broken: readonly boolean[]): TileGrid {
  if (fragiles.length === 0) return world;
  return { ...world, solidTile: (tx, ty) => world.solidTile(tx, ty) || fragiles.some((f, i) => f.col === tx && f.row === ty && !broken[i]) };
}
