// GDD-MOV-09: sand slopes. How a body (Poncho, a walking enemy, the walking taco, a fireball) stands on a slope tile and moves along it.
// Only the middle of a body's feet meets a slope; its box meets level tiles only. Pure logic, no Phaser (GDD-TEC-02).
import { SLOPE, TILE } from '../config/tuning';
import type { World } from './movement';
import { SLOPE_HEIGHTS, type SlopeChar } from './tilemap';

/** Keeps a point that only touches a tile edge from counting as inside it. */
const EDGE = 1e-6;

/** The y of a slope's surface at x, for slope `slope` in tile (tx, ty): its height runs straight from the tile's left edge to its right. */
export function surfaceY(tx: number, ty: number, slope: SlopeChar, x: number): number {
  const { left, right } = SLOPE_HEIGHTS[slope];
  return (ty + 1) * TILE - (left + ((right - left) * (x - tx * TILE)) / TILE);
}

/** The slope tile the middle of a body's feet at (x, y) is in (the tile holding the point just above the feet), or null. */
export function slopeTile(world: World, x: number, y: number): { tx: number; ty: number; slope: SlopeChar } | null {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor((y - EDGE) / TILE);
  const slope = world.slopeAt?.(tx, ty) ?? null;
  return slope === null ? null : { tx, ty, slope };
}

/** Is tile (tx, ty) ground: a level tile or a slope? */
export function isGround(world: World, tx: number, ty: number): boolean {
  return world.solidTile(tx, ty) || (world.slopeAt?.(tx, ty) ?? null) !== null;
}

/**
 * Does a box `width` x `height`, the middle of its feet at (x, y), overlap a level tile? Slope tiles never stop it. While the middle of
 * its feet is in a slope tile, level tiles meet it only above the slope's surface under its feet, lowered by as much as the slope rises
 * under half its width (6 px for Poncho on a 45-degree slope, 3 px on a gentle one): its uphill corner passes into the tile at the
 * slope's top.
 */
export function boxBlocked(world: World, x: number, y: number, width: number, height: number): boolean {
  const half = width / 2;
  let bottom = y;
  const at = slopeTile(world, x, y);
  if (at !== null) {
    const { left, right } = SLOPE_HEIGHTS[at.slope];
    bottom = Math.min(y, surfaceY(at.tx, at.ty, at.slope, x) - (half * Math.abs(right - left)) / TILE);
  }
  for (let ty = Math.floor((y - height) / TILE); ty <= Math.floor((bottom - EDGE) / TILE); ty++) {
    for (let tx = Math.floor((x - half) / TILE); tx <= Math.floor((x + half - EDGE) / TILE); tx++) if (world.solidTile(tx, ty)) return true;
  }
  return false;
}

/**
 * The y of the top of the ground the middle of a body's feet at (x, y) is in: a level tile's top, or the surface of the slope on it when
 * one sits on it; a slope's surface when the feet are below it; null when they are not in the ground.
 */
export function groundTop(world: World, x: number, y: number): number | null {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor((y - EDGE) / TILE);
  if (world.solidTile(tx, ty)) {
    // The level tile under a slope carries the slope: its ground's top is the slope's surface.
    const on = world.slopeAt?.(tx, ty - 1) ?? null;
    return on === null ? ty * TILE : surfaceY(tx, ty - 1, on, x);
  }
  const slope = world.slopeAt?.(tx, ty) ?? null;
  if (slope === null) return null;
  const surface = surfaceY(tx, ty, slope, x);
  return surface < y - EDGE ? surface : null;
}

/** Feet that have just moved sideways to (x, y): the ground's top they step up to, when at most SLOPE.stepPx above them; 'wall' when it is higher (a slope's high side); null when they are not in the ground. */
export function stepUp(world: World, x: number, y: number): number | 'wall' | null {
  const top = groundTop(world, x, y);
  if (top === null) return null;
  return y - top > SLOPE.stepPx ? 'wall' : top;
}

/** The ground's surface (a level tile's top or a slope's surface) under the middle of a body's feet, at most SLOPE.stepPx below them, or null. */
export function stepDown(world: World, x: number, y: number): number | null {
  const tx = Math.floor(x / TILE);
  for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + SLOPE.stepPx) / TILE); ty++) {
    const slope = world.slopeAt?.(tx, ty) ?? null;
    const surface = world.solidTile(tx, ty) ? ty * TILE : slope !== null ? surfaceY(tx, ty, slope, x) : null;
    if (surface !== null && surface >= y - EDGE && surface <= y + SLOPE.stepPx + EDGE) return surface;
  }
  return null;
}
