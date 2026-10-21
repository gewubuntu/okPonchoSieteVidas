// GDD-CTL-03: where the touch buttons go and what a set of fingers presses. Pure data, no Phaser, so it can be unit
// tested. The scene draws the buttons and feeds in where the fingers are.
import { BASE_HEIGHT, BASE_WIDTH, TOUCH } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';

export type TouchButtonId = 'left' | 'right' | 'jump' | 'stick' | 'mode';

/** The left thumb zone is either two buttons or one slide stick (GDD-CTL-03, the player's choice). */
export type TouchMode = 'buttons' | 'stick';

/** A button's rectangle in virtual pixels. */
export interface TouchButton {
  readonly id: TouchButtonId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Jump bottom-right and a mode switch above the left thumb zone, which holds either the left and right buttons or one
 * slide stick as wide as both. `cssPerVirtualPx` is how big one virtual pixel is on the player's screen: a button is
 * never smaller than TOUCH.minCssPx there, so on a small screen it grows (GDD-CTL-03).
 */
export function layoutTouchButtons(cssPerVirtualPx: number, mode: TouchMode = 'buttons'): TouchButton[] {
  const min = Math.ceil(TOUCH.minCssPx / cssPerVirtualPx);
  const size = Math.max(TOUCH.size, min);
  const jump = Math.max(TOUCH.jumpSize, min);
  const bottom = BASE_HEIGHT - TOUCH.margin;
  const y = bottom - size;
  const left: TouchButton[] =
    mode === 'stick'
      ? [{ id: 'stick', x: TOUCH.margin, y, w: 2 * size + TOUCH.gap, h: size }]
      : [
          { id: 'left', x: TOUCH.margin, y, w: size, h: size },
          { id: 'right', x: TOUCH.margin + size + TOUCH.gap, y, w: size, h: size },
        ];
  return [
    ...left,
    { id: 'mode', x: TOUCH.margin, y: y - TOUCH.gap - size, w: size, h: size },
    { id: 'jump', x: BASE_WIDTH - TOUCH.margin - jump, y: bottom - jump, w: jump, h: jump },
  ];
}

/** Which buttons at least one finger is on. A button covers its left and top edge but not its right and bottom edge. */
export function pressedButtons(buttons: readonly TouchButton[], fingers: readonly { x: number; y: number }[]): Set<TouchButtonId> {
  const pressed = new Set<TouchButtonId>();
  for (const b of buttons) {
    if (b.id !== 'stick' && fingers.some((f) => inside(b, f))) pressed.add(b.id);
  }
  return pressed;
}

/** The same input the keyboard gives: left and right together cancel out. `stick` is the slide stick's analog move. */
export function touchInput(pressed: ReadonlySet<TouchButtonId>, stick = 0): PlayerInput {
  const move = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0) + stick;
  return { move: Math.max(-1, Math.min(1, move)), jumpHeld: pressed.has('jump') };
}

/**
 * The slide stick: a finger anywhere in the lower left quarter of the screen (outside the mode switch) steers by how far
 * left or right of the track's centre it is. Inside the dead zone nothing happens, beyond it speed grows to full at the
 * track's edge and stays full past it (analog speed, GDD-MOV-01). With no finger there it is 0.
 */
export function stickMove(buttons: readonly TouchButton[], fingers: readonly { x: number; y: number }[]): number {
  const track = buttons.find((b) => b.id === 'stick');
  const mode = buttons.find((b) => b.id === 'mode');
  if (!track) return 0;
  const finger = fingers.find(
    (f) => f.x >= 0 && f.x < BASE_WIDTH / 2 && f.y >= BASE_HEIGHT / 2 && !(mode && inside(mode, f)),
  );
  if (!finger) return 0;
  const d = Math.max(-1, Math.min(1, (finger.x - (track.x + track.w / 2)) / (track.w / 2)));
  const out = (Math.abs(d) - TOUCH.stickDeadZone) / (1 - TOUCH.stickDeadZone);
  return out > 0 ? Math.sign(d) * out : 0;
}

const inside = (b: TouchButton, f: { x: number; y: number }) => f.x >= b.x && f.x < b.x + b.w && f.y >= b.y && f.y < b.y + b.h;
