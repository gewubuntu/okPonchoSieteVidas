// GDD-CTL-02: the gamepads, polled once per frame (browsers report a pad only when asked, so there is no latch to keep, GDD-CTL-04).
// Pure, no Phaser. `poll` takes what `navigator.getGamepads()` returns and gives the menu presses of that frame; `input` is the
// game input of the last poll. Only pads with the browser's standard mapping are read, all at once.
import { GAMEPAD } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';
import type { PauseEvent } from '../sim/pause';

/** What the reader needs of a browser `Gamepad`; a missing button reads as up and a missing axis as 0. */
export interface PadSnapshot {
  readonly mapping: string;
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

// The standard mapping: face buttons south, east and west, start, and the D-pad.
const SOUTH = 0;
const EAST = 1;
const WEST = 2;
const START = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

/** The left stick's speed for a sideways push: nothing inside the dead zone, then an even rise to full at the edge (GDD-MOV-01). */
export function stickSpeed(x: number): number {
  const push = Math.abs(x);
  if (push <= GAMEPAD.deadZone) return 0;
  return Math.sign(x) * Math.min(1, (push - GAMEPAD.deadZone) / (1 - GAMEPAD.deadZone));
}

/** What one pad gives the level on the last poll. */
interface PadNow {
  readonly dpadLeft: boolean;
  readonly dpadRight: boolean;
  readonly x: number;
  readonly y: number;
  readonly south: boolean;
  readonly west: boolean;
  readonly east: boolean;
}

/** What one pad pressed on the last poll, to tell a new press from a held one: up, down, left, right, south, start. */
type PadPressed = readonly [boolean, boolean, boolean, boolean, boolean, boolean];

/** The menu events, in the order a poll gives them. */
const PRESS_EVENTS: readonly PauseEvent[] = ['menuUp', 'menuDown', 'menuLeft', 'menuRight', 'pick', 'start'];

/** The stick as menu directions: the larger axis, once its push is past half. A tie is none. [up, down, left, right]. */
function stickDirections(x: number, y: number): readonly [boolean, boolean, boolean, boolean] {
  const sideways = Math.abs(x) > Math.abs(y) && Math.abs(x) > GAMEPAD.menuThreshold;
  const vertical = Math.abs(y) > Math.abs(x) && Math.abs(y) > GAMEPAD.menuThreshold;
  return [vertical && y < 0, vertical && y > 0, sideways && x < 0, sideways && x > 0];
}

export class GamepadReader {
  private now = new Map<number, PadNow>();
  private previous = new Map<number, PadPressed>();
  /** GDD-UI-02: the sources (pad, D-pad left, D-pad right, stick) down when the pause began, and the ones `input` ignores until they are let go. */
  private downAtPause = new Set<string>();
  private readonly heldBack = new Set<string>();

  /** Reads every standard pad and returns the menu presses new since the pad's last poll, pad by pad. */
  poll(pads: readonly (PadSnapshot | null)[]): PauseEvent[] {
    const events: PauseEvent[] = [];
    const now = new Map<number, PadNow>();
    const seen = new Map<number, PadPressed>();
    pads.forEach((pad, index) => {
      if (pad === null || pad.mapping !== 'standard') return;
      const button = (i: number) => pad.buttons[i]?.pressed === true;
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      const [up, down, left, right] = stickDirections(x, y);
      // The D-pad and the stick pushing the same way are one press.
      const pressed: PadPressed = [button(DPAD_UP) || up, button(DPAD_DOWN) || down, button(DPAD_LEFT) || left, button(DPAD_RIGHT) || right, button(SOUTH), button(START)];
      // The first poll of a pad has no previous state: everything was up before.
      const before = this.previous.get(index);
      PRESS_EVENTS.forEach((event, i) => {
        if (pressed[i] && !before?.[i]) events.push(event);
      });
      seen.set(index, pressed);
      now.set(index, { dpadLeft: button(DPAD_LEFT), dpadRight: button(DPAD_RIGHT), x, y, south: button(SOUTH), west: button(WEST), east: button(EAST) });
    });
    this.previous = seen; // a pad that is gone forgets its state
    this.now = now;
    // A source that is up now is let go: it is no longer held back, and a press of it later is a new press.
    const down = this.sourcesDown();
    for (const s of this.downAtPause) if (!down.has(s)) this.downAtPause.delete(s);
    for (const s of this.heldBack) if (!down.has(s)) this.heldBack.delete(s);
    return events;
  }

  /** The game input of the last poll, with the sources held back left out of `move`, `left` and `right`. All pads add up, capped at full speed. */
  input(): PlayerInput {
    let move = 0;
    const input = { move: 0, jumpHeld: false, claw: false, fuego: false, left: false, right: false };
    for (const [index, pad] of this.now) {
      const dpadLeft = pad.dpadLeft && !this.heldBack.has(`${index}:dpadLeft`);
      const dpadRight = pad.dpadRight && !this.heldBack.has(`${index}:dpadRight`);
      const x = this.heldBack.has(`${index}:stick`) ? 0 : pad.x;
      move += (dpadRight ? 1 : 0) - (dpadLeft ? 1 : 0) + stickSpeed(x);
      // Raw left and right for the screens that count presses (L-019): the stick counts when its sideways push is the larger.
      const sideways = Math.abs(x) > GAMEPAD.deadZone && Math.abs(x) > Math.abs(pad.y);
      input.left ||= dpadLeft || (sideways && x < 0);
      input.right ||= dpadRight || (sideways && x > 0);
      input.jumpHeld ||= pad.south;
      input.claw ||= pad.west;
      input.fuego ||= pad.east;
    }
    input.move = Math.max(-1, Math.min(1, move));
    return input;
  }

  /** GDD-UI-02: the pause begins. What is down now keeps working after it. */
  notePause(): void {
    this.downAtPause = this.sourcesDown();
  }

  /** GDD-UI-02: the level goes on. Whatever went down since the pause began does nothing until it is let go. */
  holdBack(): void {
    for (const s of this.sourcesDown()) if (!this.downAtPause.has(s)) this.heldBack.add(s);
    this.downAtPause = new Set();
  }

  /** The D-pad's left and right, and the stick (past the dead zone), of every pad, by pad index. */
  private sourcesDown(): Set<string> {
    const down = new Set<string>();
    for (const [index, pad] of this.now) {
      if (pad.dpadLeft) down.add(`${index}:dpadLeft`);
      if (pad.dpadRight) down.add(`${index}:dpadRight`);
      if (Math.abs(pad.x) > GAMEPAD.deadZone) down.add(`${index}:stick`);
    }
    return down;
  }
}
