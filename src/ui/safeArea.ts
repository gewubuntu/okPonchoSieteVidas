// GDD-CTL-03: the safe area, the part of the screen no notch, rounded corner or home indicator covers, and how far it reaches into
// the canvas. Pure arithmetic plus the one DOM read; the touch buttons keep their distance from its edges, not the screen's.
import { BASE_WIDTH } from '../config/tuning';

/** How far the safe area's edge lies inside the canvas on each side, in game px. */
export interface Insets {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Four edges in CSS px, as a `DOMRect` has them. */
interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const NO_INSETS: Insets = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * GDD-CTL-03: per side, how far the safe area's edge lies inside the canvas, past the letterbox bar on that side: max(0, overlap) in CSS px,
 * turned into game px and rounded up. `safe` and `canvas` are in viewport CSS px.
 */
export function canvasInsets(safe: Box, canvas: Box & { width: number }): Insets {
  // Multiply by BASE_WIDTH before dividing, so a whole number of game px stays whole (40 * 480 / 800 is exactly 24).
  const px = (css: number) => Math.ceil((Math.max(0, css) * BASE_WIDTH) / canvas.width);
  return {
    left: px(safe.left - canvas.left),
    right: px(canvas.right - safe.right),
    top: px(safe.top - canvas.top),
    bottom: px(canvas.bottom - safe.bottom),
  };
}

/** Whether two sets of insets are the same on every side. */
export const sameInsets = (a: Insets, b: Insets): boolean => a.left === b.left && a.right === b.right && a.top === b.top && a.bottom === b.bottom;

/** The one probe of the page, made on the first read and reused by every later scene. */
let probe: HTMLDivElement | undefined;

/**
 * GDD-CTL-03: the safe area in viewport CSS px. A hidden fixed box is placed at the browser's `env(safe-area-inset-*)` distances from
 * each edge (`viewport-fit=cover`, `index.html`), and its rectangle is the safe area. Read it every frame: a phone turned round can move
 * a cutout to the other side without a resize.
 */
export function readSafeRect(): DOMRect {
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('data-safe-area', '');
    probe.style.cssText =
      'position:fixed;left:env(safe-area-inset-left);right:env(safe-area-inset-right);top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
  }
  return probe.getBoundingClientRect();
}
