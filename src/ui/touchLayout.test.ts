import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, TOUCH } from '../config/tuning';
import { layoutTouchButtons, pressedButtons, touchInput, type TouchButton } from './touchLayout';

/** CSS px per virtual px on an 844 x 390 landscape phone: the 480 x 270 canvas is limited by the height, 390 / 270. */
const PHONE = 390 / 270;
const find = (buttons: TouchButton[], id: string) => buttons.find((b) => b.id === id)!;
const centre = (b: TouchButton) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

describe('GDD-CTL-03 touch button layout', () => {
  const buttons = layoutTouchButtons(PHONE);

  it('has a left, a right and a jump button', () => {
    expect(new Set(buttons.map((b) => b.id))).toEqual(new Set(['left', 'right', 'jump']));
    expect(buttons).toHaveLength(3);
  });

  it('puts move buttons bottom-left and jump bottom-right, inside the screen', () => {
    const [left, right, jump] = [find(buttons, 'left'), find(buttons, 'right'), find(buttons, 'jump')];
    expect(left.x).toBe(TOUCH.margin);
    expect(right.x).toBeGreaterThan(left.x + left.w);
    expect(jump.x + jump.w).toBe(BASE_WIDTH - TOUCH.margin);
    for (const b of buttons) {
      expect(b.y + b.h).toBe(BASE_HEIGHT - TOUCH.margin);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(BASE_WIDTH);
    }
    expect(jump.w).toBeGreaterThan(left.w);
  });

  it('never overlaps the left and right buttons, so one thumb cannot press both', () => {
    const [left, right] = [find(buttons, 'left'), find(buttons, 'right')];
    expect(right.x - (left.x + left.w)).toBe(TOUCH.gap);
  });

  it('keeps every button at least 48 CSS px on the player screen, and grows them on a small one', () => {
    for (const b of buttons) {
      expect(b.w * PHONE).toBeGreaterThanOrEqual(TOUCH.minCssPx);
      expect(b.h * PHONE).toBeGreaterThanOrEqual(TOUCH.minCssPx);
    }
    const tiny = layoutTouchButtons(0.8); // a very small canvas: 384 x 216 CSS px
    for (const b of tiny) expect(b.w * 0.8).toBeGreaterThanOrEqual(TOUCH.minCssPx);
    expect(find(tiny, 'left').w).toBeGreaterThan(find(buttons, 'left').w);
    // and they do not shrink below the design size on a big one
    expect(find(layoutTouchButtons(3), 'left').w).toBe(TOUCH.size);
  });
});

describe('GDD-CTL-03 touch input', () => {
  const buttons = layoutTouchButtons(PHONE);
  const press = (...ids: string[]) => pressedButtons(buttons, ids.map((id) => centre(find(buttons, id))));

  it('a finger on a button presses it, and a finger elsewhere presses nothing', () => {
    expect([...press('left')]).toEqual(['left']);
    expect([...pressedButtons(buttons, [{ x: 240, y: 100 }])]).toEqual([]);
    expect([...pressedButtons(buttons, [])]).toEqual([]);
  });

  it('buttons include their edges on the near side and exclude the far side', () => {
    const left = find(buttons, 'left');
    expect(pressedButtons(buttons, [{ x: left.x, y: left.y }]).has('left')).toBe(true);
    expect(pressedButtons(buttons, [{ x: left.x + left.w, y: left.y }]).has('left')).toBe(false);
  });

  it('moving and jumping at the same time works with two fingers', () => {
    expect(touchInput(press('right', 'jump'))).toEqual({ move: 1, jumpHeld: true });
    expect(touchInput(press('left', 'jump'))).toEqual({ move: -1, jumpHeld: true });
  });

  it('one button each, and nothing pressed means no input', () => {
    expect(touchInput(press('left'))).toEqual({ move: -1, jumpHeld: false });
    expect(touchInput(press('right'))).toEqual({ move: 1, jumpHeld: false });
    expect(touchInput(press('jump'))).toEqual({ move: 0, jumpHeld: true });
    expect(touchInput(press())).toEqual({ move: 0, jumpHeld: false });
  });

  it('left and right together cancel out, as on the keyboard', () => {
    expect(touchInput(press('left', 'right')).move).toBe(0);
  });

  it('two fingers on the same button still count as one press', () => {
    const c = centre(find(buttons, 'jump'));
    expect(touchInput(pressedButtons(buttons, [c, c]))).toEqual({ move: 0, jumpHeld: true });
  });
});
