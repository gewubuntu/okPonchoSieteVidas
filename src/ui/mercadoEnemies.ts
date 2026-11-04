// GDD-ENM-03, GDD-ENM-01, GDD-CMB-01: the placeholder drawings of World 2's enemies (the Paloma, the Chapulín, the Trompo), as flat shapes
// in game px in World 2's palette (GDD-ART-03). Pure, no Phaser: the scene paints what this returns. Drawn facing right and mirrored for
// left; each stays within 2 px of its box. The telegraph flashes the body red as World 1's do (GDD-ENM-01), and the not-stompable mark is
// three pale points along the top (GDD-CMB-01), on the spinning Trompo only.
import { CHAPULIN, PALOMA, TROMPO } from '../config/tuning';
import type { EnemyState } from '../sim/enemy';

/** A filled rectangle (left, top, width, height) or triangle (three corners), in one colour. */
export type Shape = { readonly rect: readonly [number, number, number, number]; readonly colour: number } | { readonly tri: readonly [number, number, number, number, number, number]; readonly colour: number };

/** World 2's palette (GDD-ART-03), the shared outline, and World 1's telegraph red, which every world keeps (GDD-ENM-01). */
export const COLOURS = {
  outline: 0x070509,
  /** Glaze white: only the not-stompable mark (GDD-CMB-01). */
  glaze: 0xf4efe2,
  telegraph: 0xff5030,
  street: 0x4e4a78,
  farShade: 0x7c86b5,
  iron: 0x3b2b3c,
  teal: 0x2aa198,
  rosa: 0xd9327e,
  // GDD-ART-06: at least 15 L* from the pink wall (#E07F8E), so the Chapulín reads against it.
  leaf: 0x3e7a3c,
  yellow: 0xe9b53f,
  wood: 0x7e5a3e,
  tejaLit: 0xe07a52,
} as const;

/** The telegraph's flash: on for 4 steps and off for 4, from the step it starts, like World 1's enemies. */
const blink = (steps: number): boolean => Math.floor(steps / 4) % 2 === 0;

/** Shapes drawn facing right about x, mirrored when `d` is -1. */
const mirror = (shapes: readonly Shape[], x: number, d: 1 | -1): Shape[] =>
  d > 0
    ? [...shapes]
    : shapes.map((s) =>
        'rect' in s
          ? { rect: [2 * x - s.rect[0] - s.rect[2], s.rect[1], s.rect[2], s.rect[3]] as const, colour: s.colour }
          : { tri: [2 * x - s.tri[0], s.tri[1], 2 * x - s.tri[2], s.tri[3], 2 * x - s.tri[4], s.tri[5]] as const, colour: s.colour },
      );

const rect = (x: number, y: number, w: number, h: number, colour: number): Shape => ({ rect: [x, y, w, h], colour });
const tri = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, colour: number): Shape => ({ tri: [x1, y1, x2, y2, x3, y3], colour });

/**
 * The Paloma (GDD-ENM-03), size class M: a slate pigeon with a teal neck, a dark beak and pink feet, its feet at `feet` (the ground less how
 * high it has flown). Telegraphing it puffs up 2 px wider with its wings half raised and its body flashing red; rising and hovering its
 * wings beat up and down, hovering it bobs PALOMA.bobPx down and back every 15 steps, inside its box; coming down its wings are spread.
 */
export function palomaShapes(state: EnemyState, feet: number): Shape[] {
  const w = state.wing!;
  const { x } = state;
  const y = feet + (w.phase === 'hover' && Math.floor(w.age / 15) % 2 === 1 ? PALOMA.bobPx : 0);
  const puff = w.phase === 'telegraph' ? 1 : 0;
  const body = w.phase === 'telegraph' && blink(w.age) ? COLOURS.telegraph : COLOURS.street;
  const flying = w.phase === 'rise' || w.phase === 'hover' || w.phase === 'descend';
  const shapes: Shape[] = [
    rect(x - 6.5 - puff, y - 9.5 - puff, 11 + 2 * puff, 8 + puff, COLOURS.outline),
    rect(x - 6 - puff, y - 9 - puff, 10 + 2 * puff, 7 + puff, body),
    rect(x + 2.5, y - 12.5, 5, 5, COLOURS.outline),
    rect(x + 3, y - 12, 4, 4, body),
    rect(x + 3, y - 9, 3, 2, COLOURS.teal),
    rect(x + 7, y - 11, 2, 1, COLOURS.iron),
    rect(x + 5, y - 11, 1, 1, COLOURS.outline),
  ];
  if (w.phase === 'telegraph') shapes.push(tri(x - 5, y - 8, x + 1, y - 8, x - 4, y - 12, COLOURS.farShade));
  else if (w.phase === 'descend') shapes.push(tri(x - 7, y - 7, x + 1, y - 8, x - 8, y - 12, COLOURS.farShade));
  else if (flying) shapes.push(tri(x - 5, y - 8, x + 1, y - 8, x - 5, Math.floor(w.age / 6) % 2 === 0 ? y - 13 : y - 3, COLOURS.farShade));
  else shapes.push(rect(x - 4, y - 7, 6, 3, COLOURS.farShade));
  if (!flying) shapes.push(rect(x - 2, y - 2, 1, 2, COLOURS.rosa), rect(x + 1, y - 2, 1, 2, COLOURS.rosa));
  return mirror(shapes, x, state.dir);
}

/**
 * The Chapulín (GDD-ENM-03), size class S: a leaf-green grasshopper with a yellow belly and long dark hind legs, its feet at `feet`.
 * Crouched its body is low and its legs folded, and in the last CHAPULIN.flashSteps of its crouch (its telegraph) its body flashes red; in
 * the air its body is up and its hind legs stretched back.
 */
export function chapulinShapes(state: EnemyState, feet: number): Shape[] {
  const h = state.hop!;
  const { x } = state;
  const y = feet;
  const flashFrom = CHAPULIN.crouchSteps - CHAPULIN.flashSteps;
  const body = h.phase === 'crouch' && h.age >= flashFrom && blink(h.age - flashFrom) ? COLOURS.telegraph : COLOURS.leaf;
  const low = h.phase === 'crouch' ? 3 : 0;
  const top = y - 9 + low;
  const shapes: Shape[] = [
    rect(x - 5.5, top - 0.5, 11, 5, COLOURS.outline),
    rect(x - 5, top, 10, 4, body),
    rect(x - 4, top + 3, 7, 1, COLOURS.yellow),
    rect(x + 3.5, top - 2.5, 4, 4, COLOURS.outline),
    rect(x + 4, top - 2, 3, 3, body),
    rect(x + 5, top - 1, 1, 1, COLOURS.outline),
    rect(x + 4, top - 3, 1, 1, COLOURS.iron),
  ];
  if (h.phase === 'crouch') shapes.push(tri(x - 1, top, x - 6, top - 3, x - 6, y, COLOURS.iron), rect(x + 2, y - 1, 1, 1, COLOURS.iron));
  else shapes.push(tri(x - 2, top + 2, x - 7, top + 1, x - 7, y, COLOURS.iron), rect(x + 2, top + 4, 1, 3, COLOURS.iron));
  return mirror(shapes, x, state.dir);
}

/**
 * The Trompo (GDD-ENM-03), size class M: a wooden spinning top with a rosa band, wide crown up and its iron tip on the ground at `feet`.
 * Spinning, a lit patch runs round its crown and three pale points stand on its crown, the not-stompable mark (GDD-CMB-01). Stunned it lies
 * on its side, crown behind it, with no mark (a stomp defeats it then), and in its last TROMPO.wobbleSteps it rocks 1 px every 4 steps.
 */
export function trompoShapes(state: EnemyState, feet: number): Shape[] {
  const s = state.spin!;
  const { x } = state;
  const y = feet;
  if (s.phase === 'stunned') {
    const wobble = s.age >= TROMPO.stunSteps - TROMPO.wobbleSteps && Math.floor(s.age / 4) % 2 === 0 ? 1 : 0;
    const shapes: Shape[] = [
      rect(x - 7.5 + wobble, y - 10.5, 7, 10.5, COLOURS.outline),
      rect(x - 7 + wobble, y - 10, 6, 10, COLOURS.wood),
      rect(x - 5 + wobble, y - 10, 2, 10, COLOURS.rosa),
      rect(x - 1.5 + wobble, y - 8.5, 5, 7, COLOURS.outline),
      rect(x - 1 + wobble, y - 8, 4, 6, COLOURS.wood),
      rect(x + 3 + wobble, y - 6, 3, 2, COLOURS.iron),
    ];
    return mirror(shapes, x, state.dir);
  }
  const lit = x - 6 + (Math.floor(s.age / 3) % 4) * 3;
  const shapes: Shape[] = [
    rect(x - 7.5, y - 12.5, 15, 6, COLOURS.outline),
    rect(x - 7, y - 12, 14, 5, COLOURS.wood),
    rect(x - 7, y - 10, 14, 2, COLOURS.rosa),
    rect(lit, y - 12, 2, 2, COLOURS.tejaLit),
    rect(x - 5.5, y - 7.5, 11, 5, COLOURS.outline),
    rect(x - 5, y - 7, 10, 4, COLOURS.wood),
    rect(x - 3, y - 3, 6, 1, COLOURS.wood),
    rect(x - 1, y - 2, 2, 2, COLOURS.iron),
  ];
  // GDD-CMB-01: three pale points, 2 x 3 px, evenly spaced along the crown's top edge.
  for (const px of [-5, -1, 3]) shapes.push(tri(x + px, y - 12, x + px + 2, y - 12, x + px + 1, y - 15, COLOURS.glaze));
  return mirror(shapes, x, state.dir);
}
