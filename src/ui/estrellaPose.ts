// GDD-BOS-03: how La Estrella's placeholder is drawn in each mode, and her tejocotes. Pure, no Phaser: the scene draws what this says.
import { ESTRELLA, TEJOCOTE } from '../config/tuning';
import { tejocoteOut, type EstrellaState, type Tejocote } from '../sim/estrella';

/** One of her seven paper cones: `index` 0 points straight up, the others follow clockwise; its tip, and whether the tip is pale. */
export interface Cone {
  readonly index: number;
  readonly tipX: number;
  readonly tipY: number;
  /** The three top cones have pale tips: she cannot be stomped (the three-thorn convention, GDD-CMB-01). */
  readonly pale: boolean;
}

export interface EstrellaPose {
  /** The middle of her box (the clay-pot core). */
  readonly x: number;
  readonly y: number;
  /** The cones she has left: 7, then 5, 3 and none after each hit; the bottom ones tear off first, the pale top three last. */
  readonly cones: readonly Cone[];
  /** The body's flash: red in the telegraph (GDD-ENM-01), white hurt or defeated, on for ESTRELLA.flashSteps and off for as many. */
  readonly flash: 'red' | 'white' | null;
  /** Her rope from the cable to her top, as a line through these points: straight, or a zigzag in her telegraph. None once defeated (it snapped). */
  readonly rope: readonly { readonly x: number; readonly y: number }[] | null;
}

/** The order her cones tear off: the two at the bottom, the two at her sides, then the three pale ones at the top. */
const TEAR_ORDER = [3, 4, 2, 5, 1, 6, 0] as const;
const CONES = TEAR_ORDER.length;
const PALE: readonly number[] = [0, 1, 6];

/** Her rope: from the cable straight down to her top; in her telegraph a zigzag ESTRELLA.zigzagPx to either side every zigzagStepPx, flipping every flashSteps. */
function rope(e: EstrellaState, blink: boolean): { x: number; y: number }[] {
  const top = e.y - ESTRELLA.height;
  if (e.mode !== 'telegraph') return [{ x: e.x, y: ESTRELLA.cableY }, { x: e.x, y: top }];
  const points: { x: number; y: number }[] = [{ x: e.x, y: ESTRELLA.cableY }];
  for (let k = 1, y = ESTRELLA.cableY + ESTRELLA.zigzagStepPx; y < top; k++, y += ESTRELLA.zigzagStepPx) {
    points.push({ x: e.x + ((k % 2 === 1) === blink ? ESTRELLA.zigzagPx : -ESTRELLA.zigzagPx), y });
  }
  return [...points, { x: e.x, y: top }];
}

export function estrellaPose(e: EstrellaState): EstrellaPose {
  const blink = Math.floor(e.age / ESTRELLA.flashSteps) % 2 === 0;
  const x = e.x;
  const y = e.y - ESTRELLA.height / 2;
  const kept: readonly number[] = TEAR_ORDER.slice(CONES - ESTRELLA.cones[Math.min(e.hits, ESTRELLA.hits)]!);
  const cones = Array.from({ length: CONES }, (_, index) => index).filter((index) => kept.includes(index)).map((index): Cone => {
    const angle = (2 * Math.PI * index) / CONES;
    return { index, tipX: x + ESTRELLA.coneTip * Math.sin(angle), tipY: y - ESTRELLA.coneTip * Math.cos(angle), pale: PALE.includes(index) };
  });
  const dormant = e.mode === 'hurt' || e.mode === 'defeated';
  return {
    x,
    y,
    cones,
    flash: e.mode === 'telegraph' && blink ? 'red' : dormant && blink ? 'white' : null,
    rope: e.mode === 'defeated' ? null : rope(e, blink),
  };
}

/** The tejocotes out of her and rolling, as boxes to draw (left, top, size). */
export const tejocoteBoxes = (tejocotes: readonly Tejocote[]): { x: number; y: number; w: number; h: number }[] =>
  tejocotes.filter(tejocoteOut).map((t) => ({ x: t.x - TEJOCOTE.size / 2, y: t.y - TEJOCOTE.size, w: TEJOCOTE.size, h: TEJOCOTE.size }));
