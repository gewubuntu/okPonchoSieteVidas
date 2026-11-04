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
  /** The middle of her box (the clay-pot core), shaken ESTRELLA.shakePx to either side in her telegraph. */
  readonly x: number;
  readonly y: number;
  /** The cones she has left: 7, then 5, 3 and none after each hit; the bottom ones tear off first, the pale top three last. */
  readonly cones: readonly Cone[];
  /** The body's flash: red in the telegraph (GDD-ENM-01), white hurt or defeated, on for ESTRELLA.flashSteps and off for as many. */
  readonly flash: 'red' | 'white' | null;
  /** The trolley on the cable her rope hangs from: above her middle, shaken with her in her telegraph. It stays on the cable once she is defeated. */
  readonly trolley: { readonly x: number; readonly y: number };
  /** Her rope, straight from the trolley down to her top. None once defeated (it snapped). */
  readonly rope: readonly { readonly x: number; readonly y: number }[] | null;
}

/** The order her cones tear off: the two at the bottom, the two at her sides, then the three pale ones at the top. */
const TEAR_ORDER = [3, 4, 2, 5, 1, 6, 0] as const;
const CONES = TEAR_ORDER.length;
const PALE: readonly number[] = [0, 1, 6];

/**
 * Her telegraph (GDD-ENM-01) shakes her: her rope has no length while she telegraphs high under the cable, so her body and the trolley
 * jump ESTRELLA.shakePx to the right and to the left in turn, every flashSteps, in time with the red flash.
 */
export function estrellaPose(e: EstrellaState): EstrellaPose {
  const blink = Math.floor(e.age / ESTRELLA.flashSteps) % 2 === 0;
  const x = e.mode === 'telegraph' ? e.x + (blink ? ESTRELLA.shakePx : -ESTRELLA.shakePx) : e.x;
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
    trolley: { x, y: ESTRELLA.cableY },
    rope: e.mode === 'defeated' ? null : [{ x, y: ESTRELLA.cableY }, { x, y: e.y - ESTRELLA.height }],
  };
}

/** The tejocotes out of her and rolling, as boxes to draw (left, top, size). */
export const tejocoteBoxes = (tejocotes: readonly Tejocote[]): { x: number; y: number; w: number; h: number }[] =>
  tejocotes.filter(tejocoteOut).map((t) => ({ x: t.x - TEJOCOTE.size / 2, y: t.y - TEJOCOTE.size, w: TEJOCOTE.size, h: TEJOCOTE.size }));
