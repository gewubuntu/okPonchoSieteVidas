// GDD-WLD-11: papel picado. A cordel, a string of papel picado between two posts, is a one-way floor that never moves or bounces, like
// a platform's top that stays put. A rollo is a cordel still rolled up as a bundle by its post: a claw swipe (GDD-CMB-02) or a fireball
// (GDD-PWR-03, used up) that touches the bundle unrolls it at ROLLO.unrollSpeed from the post into a cordel, of which only the strung
// part exists while it grows. It stays strung until a life is lost. Pure logic, no Phaser (GDD-TEC-02).
import { ROLLO, TICK_HZ } from '../config/tuning';
import type { Box } from './enemy';
import type { MovingPlatform, PlatformPos } from './platform';

/** A cordel's line: its left end, its top and its length, in px. */
export interface Cordel {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

/** A rollo: the cordel it makes, and the post its bundle is tied at, the end it unrolls from (towards the other one). */
export interface Rollo extends Cordel {
  readonly post: 'left' | 'right';
}

/** A rollo's state: rolled up (`steps` null), or the steps it has grown since the step it was touched (0 on that step). */
export interface RolloState {
  readonly steps: number | null;
}

const ROLLED: RolloState = { steps: null };

/** Every rollo rolled up, as at the start of the level and after a life is lost (GDD-LIFE-02). */
export const freshRollos = (rollos: readonly Rollo[]): RolloState[] => rollos.map(() => ROLLED);

/** How much of it is strung: none while rolled, then ROLLO.unrollSpeed px/s, up to its full length. */
export const rolloLength = (r: Rollo, s: RolloState): number => (s.steps === null ? 0 : Math.min(r.w, (ROLLO.unrollSpeed * s.steps) / TICK_HZ));

/** The strung part: from the post, as long as `rolloLength`. Null while nothing is strung. */
export function strungPart(r: Rollo, s: RolloState): PlatformPos | null {
  const len = rolloLength(r, s);
  if (len <= 0) return null;
  return { x: r.post === 'left' ? r.x : r.x + r.w - len, y: r.y, w: len };
}

/** The bundle's box: a ROLLO.size square hanging from the line's top at the post's end. Only a rolled-up rollo has one. */
export function bundleBox(r: Rollo): Box {
  const x0 = r.post === 'left' ? r.x : r.x + r.w - ROLLO.size;
  return { x0, x1: x0 + ROLLO.size, y0: r.y, y1: r.y + ROLLO.size };
}

const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Does the box touch a bundle still rolled up? Boxes that only share an edge do not touch. */
export const touchesBundle = (rollos: readonly Rollo[], states: readonly RolloState[], box: Box): boolean =>
  rollos.some((r, i) => states[i]!.steps === null && overlaps(box, bundleBox(r)));

/** One step of growth for every rollo that is unrolling. */
export const growRollos = (states: readonly RolloState[]): RolloState[] => states.map((s) => (s.steps === null ? s : { steps: s.steps + 1 }));

/** Every rolled-up rollo whose bundle one of the boxes (the claw swipe's, the fireballs') touches starts to unroll. */
export const unrollTouched = (rollos: readonly Rollo[], states: readonly RolloState[], boxes: readonly Box[]): RolloState[] =>
  states.map((s, i) => (s.steps === null && boxes.some((b) => overlaps(b, bundleBox(rollos[i]!))) ? { steps: 0 } : s));

/** The tops of every cordel and of the strung part of every rollo, for whatever stands or walks on them (GDD-ENM-03, GDD-BOS-03). */
export const stringTops = (cordeles: readonly Cordel[], rollos: readonly Rollo[], states: readonly RolloState[]): PlatformPos[] => [
  ...cordeles.map(({ x, y, w }) => ({ x, y, w })),
  ...rollos.flatMap((r, i) => strungPart(r, states[i]!) ?? []),
];

/** Tops as platforms that do not move (both ends the same point), for `landOnPlatforms` (GDD-WLD-05). */
export const stillPlatforms = (tops: readonly PlatformPos[]): MovingPlatform[] => tops.map(({ x, y, w }) => ({ x0: x, y0: y, x1: x, y1: y, w }));
