import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, TOUCH } from '../config/tuning';
import { layoutTouchButtons, pressedButtons, stickMove, touchInput, type TouchButton } from './touchLayout';

/** CSS px per virtual px on an 844 x 390 landscape phone: the 480 x 270 canvas is limited by the height, 390 / 270. */
const PHONE = 390 / 270;
const find = (buttons: TouchButton[], id: string) => buttons.find((b) => b.id === id)!;
const centre = (b: TouchButton) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
/** The buttons a finger in the middle of each named button presses. */
const pressIn = (buttons: TouchButton[], ...ids: string[]) => pressedButtons(buttons, ids.map((id) => centre(find(buttons, id))));

describe('GDD-CTL-03 touch button layout', () => {
  const buttons = layoutTouchButtons(PHONE);

  it('has a left, a right, a jump and a claw button, the mode switch and the pause button', () => {
    expect(new Set(buttons.map((b) => b.id))).toEqual(new Set(['left', 'right', 'jump', 'claw', 'mode', 'pause']));
    expect(buttons).toHaveLength(6);
  });

  it('puts move buttons bottom-left and jump bottom-right, inside the screen', () => {
    const [left, right, jump] = [find(buttons, 'left'), find(buttons, 'right'), find(buttons, 'jump')];
    expect(left.x).toBe(TOUCH.margin);
    expect(right.x).toBeGreaterThan(left.x + left.w);
    expect(jump.x + jump.w).toBe(BASE_WIDTH - TOUCH.margin);
    for (const b of buttons.filter((x) => x.id !== 'mode' && x.id !== 'pause')) {
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

describe('GDD-UI-02 the touch pause button', () => {
  it('sits in the top-right corner, 6 px from both edges, 24 px on a big screen', () => {
    const big = find(layoutTouchButtons(3), 'pause');
    expect(big).toEqual({ id: 'pause', x: BASE_WIDTH - 6 - 24, y: 6, w: 24, h: 24 });
  });

  it('grows to 48 CSS px on a phone, still in the corner', () => {
    const p = find(layoutTouchButtons(PHONE), 'pause');
    expect(p.w * PHONE).toBeGreaterThanOrEqual(48);
    expect((p.w - 1) * PHONE).toBeLessThan(48);
    expect([p.x + p.w, p.y]).toEqual([BASE_WIDTH - 6, 6]);
  });

  it('is there in both modes and in Fuego, and is no game input', () => {
    for (const b of [layoutTouchButtons(PHONE, 'stick'), layoutTouchButtons(PHONE, 'buttons', true)]) expect(b.some((x) => x.id === 'pause')).toBe(true);
    expect(touchInput(pressIn(layoutTouchButtons(PHONE), 'pause'))).toEqual({ move: 0, jumpHeld: false, claw: false, fuego: false, left: false, right: false });
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
    expect(touchInput(press('right', 'jump'))).toEqual({ move: 1, jumpHeld: true, claw: false, fuego: false, left: false, right: true });
    expect(touchInput(press('left', 'jump'))).toEqual({ move: -1, jumpHeld: true, claw: false, fuego: false, left: true, right: false });
  });

  it('one button each, and nothing pressed means no input', () => {
    expect(touchInput(press('left'))).toEqual({ move: -1, jumpHeld: false, claw: false, fuego: false, left: true, right: false });
    expect(touchInput(press('right'))).toEqual({ move: 1, jumpHeld: false, claw: false, fuego: false, left: false, right: true });
    expect(touchInput(press('jump'))).toEqual({ move: 0, jumpHeld: true, claw: false, fuego: false, left: false, right: false });
    expect(touchInput(press())).toEqual({ move: 0, jumpHeld: false, claw: false, fuego: false, left: false, right: false });
  });

  it('left and right together cancel out, as on the keyboard', () => {
    expect(touchInput(press('left', 'right')).move).toBe(0);
    expect(touchInput(press('left', 'right'))).toMatchObject({ left: true, right: true }); // both still reported, for GDD-LIFE-05
  });

  it('two fingers on the same button still count as one press', () => {
    const c = centre(find(buttons, 'jump'));
    expect(touchInput(pressedButtons(buttons, [c, c]))).toEqual({ move: 0, jumpHeld: true, claw: false, fuego: false, left: false, right: false });
  });
});

describe('GDD-CMB-02 the claw button', () => {
  const buttons = layoutTouchButtons(PHONE);
  const press = (...ids: string[]) => pressedButtons(buttons, ids.map((id) => centre(find(buttons, id))));
  it('sits next to jump on the right, on the floor line, a full gap away from it', () => {
    const claw = find(buttons, 'claw');
    const jump = find(buttons, 'jump');
    expect(claw.x + claw.w + TOUCH.gap).toBe(jump.x);
    expect(claw.y + claw.h).toBe(jump.y + jump.h);
  });
  it('a finger on it presses the claw, and jump and claw work together', () => {
    expect(touchInput(press('claw'))).toEqual({ move: 0, jumpHeld: false, claw: true, fuego: false, left: false, right: false });
    expect(touchInput(press('claw', 'jump'))).toEqual({ move: 0, jumpHeld: true, claw: true, fuego: false, left: false, right: false });
    expect(touchInput(press('right', 'claw'))).toEqual({ move: 1, jumpHeld: false, claw: true, fuego: false, left: false, right: true });
  });
  it('is at least 48 CSS px on a small screen, like every button', () => {
    const small = layoutTouchButtons(0.5);
    const claw = find(small, 'claw');
    expect(claw.w * 0.5).toBeGreaterThanOrEqual(TOUCH.minCssPx);
    expect(claw.h * 0.5).toBeGreaterThanOrEqual(TOUCH.minCssPx);
  });
  it('does not overlap any other button', () => {
    const claw = find(buttons, 'claw');
    for (const other of buttons.filter((b) => b.id !== 'claw')) {
      const apart = claw.x + claw.w <= other.x || other.x + other.w <= claw.x || claw.y + claw.h <= other.y || other.y + other.h <= claw.y;
      expect(apart).toBe(true);
    }
  });
});

describe('GDD-PWR-03 the Fuego button', () => {
  it('is not there outside the Fuego state', () => {
    expect(layoutTouchButtons(PHONE).some((b) => b.id === 'fuego')).toBe(false);
    expect(layoutTouchButtons(PHONE, 'stick').some((b) => b.id === 'fuego')).toBe(false);
  });
  it('shows above the claw button, in both left-zone modes, a gap away from it', () => {
    for (const mode of ['buttons', 'stick'] as const) {
      const buttons = layoutTouchButtons(PHONE, mode, true);
      const fuego = find(buttons, 'fuego');
      const claw = find(buttons, 'claw');
      expect(fuego.x).toBe(claw.x);
      expect(fuego.y + fuego.h + TOUCH.gap).toBe(claw.y);
    }
  });
  it('a finger on it presses Fuego, together with the others', () => {
    const buttons = layoutTouchButtons(PHONE, 'buttons', true);
    expect(touchInput(pressIn(buttons, 'fuego'))).toEqual({ move: 0, jumpHeld: false, claw: false, fuego: true, left: false, right: false });
    expect(touchInput(pressIn(buttons, 'fuego', 'jump', 'right'))).toEqual({ move: 1, jumpHeld: true, claw: false, fuego: true, left: false, right: true });
  });
  it('is at least 48 CSS px on a small screen and overlaps no other button', () => {
    const buttons = layoutTouchButtons(0.5, 'buttons', true);
    const fuego = find(buttons, 'fuego');
    expect(fuego.w * 0.5).toBeGreaterThanOrEqual(TOUCH.minCssPx);
    for (const other of buttons.filter((b) => b.id !== 'fuego')) {
      const apart = fuego.x + fuego.w <= other.x || other.x + other.w <= fuego.x || fuego.y + fuego.h <= other.y || other.y + other.h <= fuego.y;
      expect(apart).toBe(true);
    }
  });
});

describe('GDD-CTL-03 slide stick', () => {
  const stick = layoutTouchButtons(PHONE, 'stick');
  const track = find(stick, 'stick');
  const mode = find(stick, 'mode');
  const mid = track.x + track.w / 2;
  const half = track.w / 2;
  const at = (dx: number, y = track.y + track.h / 2) => [{ x: mid + dx, y }];

  it('swaps the left and right buttons for one track as wide as both, and keeps jump and the switch', () => {
    expect(new Set(stick.map((b) => b.id))).toEqual(new Set(['stick', 'jump', 'claw', 'mode', 'pause']));
    const buttons = layoutTouchButtons(PHONE);
    const [left, right] = [find(buttons, 'left'), find(buttons, 'right')];
    expect([track.x, track.w, track.y]).toEqual([left.x, right.x + right.w - left.x, left.y]);
    for (const b of stick) {
      expect(b.w * PHONE).toBeGreaterThanOrEqual(TOUCH.minCssPx);
      expect(b.h * PHONE).toBeGreaterThanOrEqual(TOUCH.minCssPx);
    }
  });

  it('puts the mode switch in the same place in both modes, above the left zone and clear of it', () => {
    expect(find(layoutTouchButtons(PHONE), 'mode')).toEqual(mode);
    expect(mode.y + mode.h).toBeLessThanOrEqual(track.y);
  });

  it('does nothing with no finger, in the dead zone, or on the centre', () => {
    expect(stickMove(stick, [])).toBe(0);
    expect(stickMove(stick, at(0))).toBe(0);
    expect(stickMove(stick, at(0.2 * half - 0.01))).toBe(0);
    expect(stickMove(stick, at(-0.2 * half + 0.01))).toBe(0);
  });

  it('ramps up from the 0.2 dead zone to full speed at the edge, either way', () => {
    expect(stickMove(stick, at(0.6 * half))).toBeCloseTo(0.5, 5); // (0.6 - 0.2) / 0.8
    expect(stickMove(stick, at(-0.6 * half))).toBeCloseTo(-0.5, 5);
    expect(stickMove(stick, at(half))).toBeCloseTo(1, 5);
    expect(stickMove(stick, at(-half))).toBeCloseTo(-1, 5);
  });

  it('stays at full speed when the finger slides past either end of the track', () => {
    expect(stickMove(stick, at(half + 30))).toBe(1);
    expect(stickMove(stick, [{ x: 0, y: track.y }])).toBe(-1);
  });

  it('follows a finger above the track too, anywhere in the lower left quarter', () => {
    expect(stickMove(stick, at(half, BASE_HEIGHT / 2))).toBeCloseTo(1, 5);
    expect(stickMove(stick, at(half, BASE_HEIGHT / 2 - 1))).toBe(0); // the quarter starts at mid height
    expect(stickMove(stick, [{ x: BASE_WIDTH / 2, y: track.y }])).toBe(0); // and ends at mid width
    expect(stickMove(stick, [{ x: BASE_WIDTH / 2 - 1, y: track.y }])).toBe(1);
  });

  it('a finger on the mode switch does not steer', () => {
    expect(stickMove(stick, [centre(mode)])).toBe(0);
  });

  it('in button mode there is no stick', () => {
    expect(stickMove(layoutTouchButtons(PHONE), at(half))).toBe(0);
  });

  it('feeds the move input and adds up with the buttons without leaving -1 to 1', () => {
    expect(touchInput(new Set(), 0.5)).toEqual({ move: 0.5, jumpHeld: false, claw: false, fuego: false, left: false, right: true });
    expect(touchInput(new Set(['jump']), -0.5)).toEqual({ move: -0.5, jumpHeld: true, claw: false, fuego: false, left: true, right: false });
    expect(touchInput(new Set(['right']), 0.5).move).toBe(1);
    // GDD-LIFE-05: a push of the stick is a press of left or right for the Siete vidas gastadas screen; inside its dead zone it is 0.
    expect(touchInput(new Set(), -1)).toMatchObject({ left: true, right: false });
    expect(touchInput(new Set(), 0.3)).toMatchObject({ left: false, right: true });
    expect(touchInput(new Set(), 0)).toMatchObject({ left: false, right: false });
    expect(pressedButtons(stick, [centre(track)]).size).toBe(0); // the stick is read by stickMove, not as a press
    expect([...pressedButtons(stick, [centre(mode)])]).toEqual(['mode']);
  });
});
