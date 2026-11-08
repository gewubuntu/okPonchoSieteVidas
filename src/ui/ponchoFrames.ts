// GDD-ART-04: where things go on each of Poncho's frames and on his item sheets, copied from the art modules (scripts/art/poncho/:
// moves.mjs and actions.mjs `drawFrames()`, items.mjs; a test in scripts/art/poncho.test.mjs compares them). All in drawing px, two to a
// game px, in a frame facing right, x right and y down from the frame's top left.
import type { PonchoLook } from './ponchoLooks';

/** How a frame shows what Poncho holds: a paw holding it at `hand` ('paw'), the food alone at `hand` in his own paw ('food'), or nothing. */
export type Holds = 'paw' | 'food' | 'none';

export interface PonchoFrameData {
  /** Where the middle of a held item goes. */
  readonly hand: { readonly x: number; readonly y: number };
  readonly holds: Holds;
  /** The eat and spit frames: where the crumbs and the flame burst leave his mouth. */
  readonly mouth?: { readonly x: number; readonly y: number };
}

/** Poncho's frame, in drawing px (rig.mjs `POSE_FRAME`), and his body box in it (`BOX`: its middle on the frame's middle, feet on the bottom row). */
export const PONCHO_FRAME = { w: 96, h: 96 } as const;
export const PONCHO_BOX = { x0: 36, y0: 32, x1: 60, y1: 96 } as const;

export const PONCHO_FRAMES: Readonly<Record<PonchoLook, PonchoFrameData>> = {
  idle: { hand: { x: 72, y: 73 }, holds: 'paw' },
  run0: { hand: { x: 72, y: 72 }, holds: 'paw' },
  run1: { hand: { x: 72, y: 68 }, holds: 'paw' },
  run2: { hand: { x: 72, y: 70 }, holds: 'paw' },
  run3: { hand: { x: 72, y: 71 }, holds: 'paw' },
  blink: { hand: { x: 72, y: 73 }, holds: 'paw' },
  glance: { hand: { x: 72, y: 73 }, holds: 'paw' },
  jump0: { hand: { x: 71, y: 71 }, holds: 'paw' },
  jump1: { hand: { x: 72, y: 70 }, holds: 'paw' },
  apex: { hand: { x: 72, y: 70 }, holds: 'paw' },
  fall0: { hand: { x: 72, y: 70 }, holds: 'paw' },
  fall1: { hand: { x: 71, y: 70 }, holds: 'paw' },
  land: { hand: { x: 74, y: 75 }, holds: 'paw' },
  skid: { hand: { x: 70, y: 73 }, holds: 'paw' },
  flip0: { hand: { x: 72, y: 71 }, holds: 'none' },
  flip1: { hand: { x: 54, y: 82 }, holds: 'none' },
  flip2: { hand: { x: 34, y: 78 }, holds: 'none' },
  flip3: { hand: { x: 23, y: 60 }, holds: 'none' },
  flip4: { hand: { x: 27, y: 40 }, holds: 'none' },
  flip5: { hand: { x: 45, y: 29 }, holds: 'none' },
  flip6: { hand: { x: 65, y: 33 }, holds: 'none' },
  flip7: { hand: { x: 76, y: 51 }, holds: 'none' },
  clawWind: { hand: { x: 30, y: 61 }, holds: 'none' },
  clawSwipe: { hand: { x: 82, y: 73 }, holds: 'none' },
  clawFollow: { hand: { x: 77, y: 86 }, holds: 'none' },
  hurt0: { hand: { x: 69, y: 77 }, holds: 'none' },
  hurt1: { hand: { x: 68, y: 77 }, holds: 'none' },
  eat0: { hand: { x: 79, y: 62 }, holds: 'food', mouth: { x: 71, y: 57 } },
  eat1: { hand: { x: 81, y: 70 }, holds: 'food', mouth: { x: 72, y: 66 } },
  spit0: { hand: { x: 65, y: 80 }, holds: 'paw', mouth: { x: 68, y: 61 } },
  spit1: { hand: { x: 75, y: 81 }, holds: 'paw', mouth: { x: 79, y: 62 } },
  victory0: { hand: { x: 48, y: 96 }, holds: 'none' },
  victory1: { hand: { x: 48, y: 96 }, holds: 'none' },
  victory2: { hand: { x: 48, y: 96 }, holds: 'none' },
  victory3: { hand: { x: 48, y: 96 }, holds: 'none' },
};

/**
 * The item sheets' frames, in drawing px, and their anchors (items.mjs): the held frame's paw middle (`HELD_HAND`, put on a frame's
 * `hand`), the claw's box in the swipe frame (`SWIPE_BOX`, put on the claw's box, `clawBox`; its bottom row is his feet's) and his
 * mouth in the effects frame (`FX_MOUTH`, put on a frame's `mouth`).
 */
export const ITEM_FRAMES = { taco: { w: 32, h: 32 }, chile: { w: 32, h: 32 }, held: { w: 24, h: 24 }, swipe: { w: 64, h: 64 }, fx: { w: 32, h: 32 } } as const;
export const HELD_HAND = { x: 12, y: 12 } as const;
export const SWIPE_BOX = { x0: 12, y0: 0, x1: 52, y1: 64 } as const;
export const FX_MOUTH = { x: 3, y: 17 } as const;
