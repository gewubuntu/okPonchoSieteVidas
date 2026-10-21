import { describe, expect, it } from 'vitest';
import { effectiveHeld, InputLatch } from './inputLatch';

describe('L-006 input latch', () => {
  it('a press that is over before the poll still counts as held for the next step', () => {
    const latch = new InputLatch();
    expect(effectiveHeld(false, latch)).toBe(false);
    latch.press(); // keydown and keyup in the same frame: the poll sees the button up
    expect(effectiveHeld(false, latch)).toBe(true);
  });

  it('stays held until a step has used it, even over frames that run no step', () => {
    const latch = new InputLatch();
    latch.press();
    expect(effectiveHeld(false, latch)).toBe(true);
    expect(effectiveHeld(false, latch)).toBe(true); // a frame shorter than a step ran no step
    latch.consume();
    expect(effectiveHeld(false, latch)).toBe(false);
  });

  it('a button that is still down is held whether or not it is latched', () => {
    const latch = new InputLatch();
    expect(effectiveHeld(true, latch)).toBe(true);
    latch.press();
    latch.consume();
    expect(effectiveHeld(true, latch)).toBe(true);
  });

  it('a second press before the step is still one press', () => {
    const latch = new InputLatch();
    latch.press();
    latch.press();
    latch.consume();
    expect(latch.latched).toBe(false);
  });
});
