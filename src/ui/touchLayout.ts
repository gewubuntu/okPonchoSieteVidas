// GDD-CTL-03: where the touch buttons go and what a set of fingers presses. Pure data, no Phaser, so it can be unit
// tested. The scene draws the buttons and feeds in where the fingers are.
import { BASE_HEIGHT, BASE_WIDTH, TOUCH } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';

export type TouchButtonId = 'left' | 'right' | 'jump';

/** A button's rectangle in virtual pixels. */
export interface TouchButton {
  readonly id: TouchButtonId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Left and right buttons bottom-left, jump bottom-right. `cssPerVirtualPx` is how big one virtual pixel is on the
 * player's screen: a button is never smaller than TOUCH.minCssPx there, so on a small screen it grows (GDD-CTL-03).
 */
export function layoutTouchButtons(cssPerVirtualPx: number): TouchButton[] {
  const min = Math.ceil(TOUCH.minCssPx / cssPerVirtualPx);
  const size = Math.max(TOUCH.size, min);
  const jump = Math.max(TOUCH.jumpSize, min);
  const bottom = BASE_HEIGHT - TOUCH.margin;
  return [
    { id: 'left', x: TOUCH.margin, y: bottom - size, w: size, h: size },
    { id: 'right', x: TOUCH.margin + size + TOUCH.gap, y: bottom - size, w: size, h: size },
    { id: 'jump', x: BASE_WIDTH - TOUCH.margin - jump, y: bottom - jump, w: jump, h: jump },
  ];
}

/** Which buttons at least one finger is on. A button covers its left and top edge but not its right and bottom edge. */
export function pressedButtons(buttons: readonly TouchButton[], fingers: readonly { x: number; y: number }[]): Set<TouchButtonId> {
  const pressed = new Set<TouchButtonId>();
  for (const b of buttons) {
    if (fingers.some((f) => f.x >= b.x && f.x < b.x + b.w && f.y >= b.y && f.y < b.y + b.h)) pressed.add(b.id);
  }
  return pressed;
}

/** The same input the keyboard gives: left and right together cancel out. */
export function touchInput(pressed: ReadonlySet<TouchButtonId>): PlayerInput {
  return { move: (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0), jumpHeld: pressed.has('jump') };
}
