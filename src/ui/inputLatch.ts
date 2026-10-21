// L-006: input read by polling once per frame loses a press that starts and ends inside one frame (a quick tap, or a hitch
// on a phone). A latch remembers that a press happened until a simulation step has used it. Pure, no Phaser.

export class InputLatch {
  private pending = false;

  /** A raw key or pointer event saw the press go down. */
  press(): void {
    this.pending = true;
  }

  /** Is there a press no step has used yet? */
  get latched(): boolean {
    return this.pending;
  }

  /** A simulation step has used the press. */
  consume(): void {
    this.pending = false;
  }
}

/** The state the next step sees: the button is down now, or it went down and up since the last step. */
export const effectiveHeld = (polledDown: boolean, latch: InputLatch): boolean => polledDown || latch.latched;
