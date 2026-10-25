import { describe, expect, it } from 'vitest';
import { GamepadReader, stickSpeed, type PadSnapshot } from './gamepad';

/** A standard-mapping pad with 17 buttons (the listed indices pressed) and a left stick at (x, y). */
const pad = ({ buttons = [], x = 0, y = 0, mapping = 'standard' }: { buttons?: number[]; x?: number; y?: number; mapping?: string } = {}): PadSnapshot => ({
  mapping,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) })),
  axes: [x, y, 0, 0],
});
const SOUTH = 0;
const EAST = 1;
const WEST = 2;
const START = 9;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

/** A reader after one poll of one pad. */
const read = (p: PadSnapshot | null = pad()) => {
  const reader = new GamepadReader();
  reader.poll([p]);
  return reader;
};

describe('GDD-CTL-02 stick speed', () => {
  it('nothing inside the dead zone of 0.2, then an even rise to full at the edge', () => {
    expect(stickSpeed(0)).toBe(0);
    expect(stickSpeed(0.2)).toBe(0);
    expect(stickSpeed(-0.2)).toBe(0);
    expect(stickSpeed(0.19)).toBe(0);
    expect(stickSpeed(0.6)).toBeCloseTo(0.5, 10);
    expect(stickSpeed(-0.6)).toBeCloseTo(-0.5, 10);
    expect(stickSpeed(1)).toBeCloseTo(1, 10);
    expect(stickSpeed(-1)).toBeCloseTo(-1, 10);
    expect(stickSpeed(0.3)).toBeCloseTo(0.125, 10);
  });
});

describe('GDD-CTL-02 gamepad input', () => {
  it('south jumps, west claws, east spits', () => {
    const south = read(pad({ buttons: [SOUTH] })).input();
    expect([south.jumpHeld, south.claw, south.fuego]).toEqual([true, false, false]);
    const west = read(pad({ buttons: [WEST] })).input();
    expect([west.jumpHeld, west.claw, west.fuego]).toEqual([false, true, false]);
    const east = read(pad({ buttons: [EAST] })).input();
    expect([east.jumpHeld, east.claw, east.fuego]).toEqual([false, false, true]);
    expect(read().input()).toEqual({ move: 0, jumpHeld: false, claw: false, fuego: false, left: false, right: false });
  });

  it('the D-pad moves at full speed', () => {
    const right = read(pad({ buttons: [RIGHT] })).input();
    expect([right.move, right.right, right.left]).toEqual([1, true, false]);
    const left = read(pad({ buttons: [LEFT] })).input();
    expect([left.move, left.left, left.right]).toEqual([-1, true, false]);
  });

  it('the stick moves with analog speed past the dead zone', () => {
    const half = read(pad({ x: 0.6 })).input();
    expect(half.move).toBeCloseTo(0.5, 10);
    expect([half.right, half.left]).toEqual([true, false]);
    const full = read(pad({ x: -1 })).input();
    expect(full.move).toBeCloseTo(-1, 10);
    expect([full.left, full.right]).toEqual([true, false]);
    const dead = read(pad({ x: 0.15 })).input();
    expect([dead.move, dead.left, dead.right]).toEqual([0, false, false]);
  });

  it('a stick push mostly up or down moves but is no Left or Right press', () => {
    const steep = read(pad({ x: 0.3, y: 0.9 })).input();
    expect(steep.move).toBeCloseTo(0.125, 10);
    expect([steep.right, steep.left]).toEqual([false, false]);
    expect(read(pad({ x: 0.5, y: 0.3 })).input().right).toBe(true);
    const tie = read(pad({ x: -0.5, y: -0.5 })).input();
    expect(tie.left).toBe(false); // a tie is not larger
  });

  it('the stick is a Left or Right press just past the dead zone', () => {
    expect(read(pad({ x: 0.25 })).input().right).toBe(true);
    expect(read(pad({ x: -0.25 })).input().left).toBe(true);
    const edge = read(pad({ x: 0.2 })).input();
    expect([edge.left, edge.right]).toEqual([false, false]);
  });

  it('the D-pad and stick add up and cancel out', () => {
    const cancel = read(pad({ buttons: [LEFT], x: 1 })).input();
    expect([cancel.move, cancel.left, cancel.right]).toEqual([0, true, true]);
    expect(read(pad({ buttons: [RIGHT], x: 0.6 })).input().move).toBe(1); // capped
  });

  it('pads add up', () => {
    const reader = new GamepadReader();
    reader.poll([pad({ buttons: [RIGHT] }), pad({ x: -1 })]);
    const both = reader.input();
    expect([both.move, both.left, both.right]).toEqual([0, true, true]);
    reader.poll([pad({ buttons: [SOUTH] }), pad({ buttons: [WEST] })]);
    const two = reader.input();
    expect([two.jumpHeld, two.claw]).toEqual([true, true]);
  });

  it('claw and Fuego from one pad count with another pad idle', () => {
    const reader = new GamepadReader();
    reader.poll([pad({ buttons: [WEST, EAST] }), pad()]);
    expect([reader.input().claw, reader.input().fuego]).toEqual([true, true]);
  });

  it('only standard pads are read', () => {
    const other = read(pad({ buttons: [SOUTH, RIGHT], mapping: '' })).input();
    expect([other.jumpHeld, other.move]).toEqual([false, 0]);
    const reader = new GamepadReader();
    reader.poll([null, pad({ buttons: [SOUTH] })]);
    expect(reader.input().jumpHeld).toBe(true);
  });

  it('up and down do nothing in a level', () => {
    for (const p of [pad({ buttons: [UP] }), pad({ buttons: [DOWN] }), pad({ y: -1 })]) {
      const input = read(p).input();
      expect([input.move, input.jumpHeld, input.left, input.right]).toEqual([0, false, false, false]);
    }
  });
});

describe('GDD-CTL-02 gamepad menu presses', () => {
  it('D-pad directions, south and start are menu events on a new press', () => {
    const reader = new GamepadReader();
    expect(reader.poll([pad({ buttons: [UP] })])).toEqual(['menuUp']);
    expect(reader.poll([pad({ buttons: [UP] })])).toEqual([]);
    expect(reader.poll([pad()])).toEqual([]);
    expect(reader.poll([pad({ buttons: [DOWN] })])).toEqual(['menuDown']);
    expect(reader.poll([pad()])).toEqual([]);
    expect(reader.poll([pad({ buttons: [LEFT] })])).toEqual(['menuLeft']);
    expect(reader.poll([pad()])).toEqual([]);
    expect(reader.poll([pad({ buttons: [RIGHT] })])).toEqual(['menuRight']);
    expect(reader.poll([pad()])).toEqual([]);
    expect(reader.poll([pad({ buttons: [SOUTH] })])).toEqual(['pick']);
    expect(reader.poll([pad()])).toEqual([]);
    expect(reader.poll([pad({ buttons: [START] })])).toEqual(['start']);
  });

  it('a button down at a pad first poll is a new press', () => {
    expect(new GamepadReader().poll([pad({ buttons: [START] })])).toEqual(['start']);
  });

  it('presses of one poll come in a fixed order', () => {
    expect(new GamepadReader().poll([pad({ buttons: [UP, SOUTH, START] })])).toEqual(['menuUp', 'pick', 'start']);
    expect(new GamepadReader().poll([pad({ buttons: [RIGHT, DOWN, SOUTH] })])).toEqual(['menuDown', 'menuRight', 'pick']);
  });

  it('the stick is a direction past half, along its larger axis', () => {
    const reader = new GamepadReader();
    const centre = () => reader.poll([pad()]);
    expect(reader.poll([pad({ y: -0.6 })])).toEqual(['menuUp']);
    centre();
    expect(reader.poll([pad({ y: 0.6 })])).toEqual(['menuDown']);
    centre();
    expect(reader.poll([pad({ x: -0.6 })])).toEqual(['menuLeft']);
    centre();
    expect(reader.poll([pad({ x: 0.6 })])).toEqual(['menuRight']);
    centre();
    expect(reader.poll([pad({ x: 0.4 })])).toEqual([]);
    centre();
    expect(reader.poll([pad({ x: 0.5 })])).toEqual([]);
    centre();
    expect(reader.poll([pad({ y: -0.5 })])).toEqual([]);
    centre();
    expect(reader.poll([pad({ x: 0.6, y: 0.6 })])).toEqual([]);
    centre();
    expect(reader.poll([pad({ x: 0.55, y: 0.3 })])).toEqual(['menuRight']);
  });

  it('a stick held past half does not repeat, and counts again after coming back under half', () => {
    const reader = new GamepadReader();
    const events = [0.6, 0.9, 0.6].flatMap((y) => reader.poll([pad({ y })]));
    expect(events).toEqual(['menuDown']);
    expect(reader.poll([pad({ y: 0.4 })])).toEqual([]);
    expect(reader.poll([pad({ y: 0.6 })])).toEqual(['menuDown']);
  });

  it('the D-pad and the stick pushing the same way are one press', () => {
    expect(new GamepadReader().poll([pad({ buttons: [DOWN], y: 0.8 })])).toEqual(['menuDown']);
  });

  it('each pad presses count', () => {
    expect(new GamepadReader().poll([pad({ buttons: [SOUTH] }), pad({ buttons: [SOUTH] })])).toEqual(['pick', 'pick']);
  });

  it('east and west are no menu events', () => {
    const reader = new GamepadReader();
    expect(reader.poll([pad({ buttons: [EAST] })])).toEqual([]);
    reader.poll([pad()]);
    expect(reader.poll([pad({ buttons: [WEST] })])).toEqual([]);
  });

  it('a pad that goes away and comes back presses again', () => {
    const reader = new GamepadReader();
    expect(reader.poll([pad({ buttons: [START] })])).toEqual(['start']);
    expect(reader.poll([])).toEqual([]);
    expect(reader.poll([pad({ buttons: [START] })])).toEqual(['start']);
  });
});

describe('GDD-CTL-02 GDD-UI-02 gamepad held through a pause', () => {
  it('a D-pad direction pressed while paused does nothing until released', () => {
    const reader = new GamepadReader();
    reader.poll([pad()]);
    reader.notePause();
    reader.poll([pad({ buttons: [RIGHT] })]);
    reader.holdBack();
    expect(reader.input()).toMatchObject({ move: 0, right: false });
    reader.poll([pad({ buttons: [RIGHT] })]);
    expect(reader.input()).toMatchObject({ move: 0, right: false });
    reader.poll([pad()]);
    reader.poll([pad({ buttons: [RIGHT] })]);
    expect(reader.input()).toMatchObject({ move: 1, right: true });
  });

  it('a D-pad direction held since before the pause keeps moving', () => {
    const reader = new GamepadReader();
    reader.poll([pad({ buttons: [LEFT] })]);
    reader.notePause();
    reader.poll([pad({ buttons: [LEFT] })]);
    reader.holdBack();
    expect(reader.input()).toMatchObject({ move: -1, left: true });
  });

  it('one released and pressed again while paused is a new press', () => {
    const reader = new GamepadReader();
    reader.poll([pad({ buttons: [LEFT] })]);
    reader.notePause();
    reader.poll([pad()]);
    reader.poll([pad({ buttons: [LEFT] })]);
    reader.holdBack();
    expect(reader.input()).toMatchObject({ move: 0, left: false });
  });

  it('the stick pushed while paused does not steer until back in its dead zone', () => {
    const reader = new GamepadReader();
    reader.poll([pad()]);
    reader.notePause();
    reader.poll([pad({ x: 0.6 })]);
    reader.holdBack();
    expect(reader.input()).toMatchObject({ move: 0, right: false });
    reader.poll([pad({ x: -0.8 })]);
    expect(reader.input()).toMatchObject({ move: 0, left: false }); // still outside the dead zone
    reader.poll([pad({ x: 0.1 })]);
    expect(reader.input().move).toBe(0);
    reader.poll([pad({ x: 0.6 })]);
    const steer = reader.input();
    expect(steer.move).toBeCloseTo(0.5, 10);
    expect(steer.right).toBe(true);
  });

  it('a held-back stick is let go only inside its dead zone', () => {
    const reader = new GamepadReader();
    reader.poll([pad()]);
    reader.notePause();
    reader.poll([pad({ x: 0.6 })]);
    reader.holdBack();
    reader.poll([pad({ x: 0.3 })]);
    expect(reader.input().move).toBe(0); // eased back, still outside the dead zone
    reader.poll([pad({ x: 0.2 })]); // at the dead zone's edge: let go
    reader.poll([pad({ x: 0.3 })]);
    expect(reader.input().move).toBeCloseTo(0.125, 10);
  });

  it('the stick held since before the pause keeps steering', () => {
    const reader = new GamepadReader();
    reader.poll([pad({ x: 1 })]);
    reader.notePause();
    reader.poll([pad({ x: 1 })]);
    reader.holdBack();
    expect(reader.input().move).toBeCloseTo(1, 10);
  });

  it('a held-back D-pad left leaves the stick and the other side working', () => {
    const reader = new GamepadReader();
    reader.poll([pad()]);
    reader.notePause();
    reader.poll([pad({ buttons: [LEFT] })]);
    reader.holdBack();
    reader.poll([pad({ buttons: [LEFT], x: 0.6 })]);
    const input = reader.input();
    expect(input.move).toBeCloseTo(0.5, 10);
    expect([input.left, input.right]).toEqual([false, true]);

    const second = new GamepadReader();
    second.poll([pad()]);
    second.notePause();
    second.poll([pad({ x: 0.6 })]);
    second.holdBack();
    second.poll([pad({ buttons: [RIGHT], x: 0.6 })]);
    expect(second.input()).toMatchObject({ move: 1, right: true });
  });

  it('holdBack forgets the pause: a second hold-back holds back what was down at the first pause', () => {
    const reader = new GamepadReader();
    reader.poll([pad({ buttons: [RIGHT] })]);
    reader.notePause();
    reader.poll([pad({ buttons: [RIGHT] })]);
    reader.holdBack();
    expect(reader.input().move).toBe(1);
    reader.holdBack();
    expect(reader.input().move).toBe(0);
  });

  it('south, west and east are not held back by the reader', () => {
    const reader = new GamepadReader();
    reader.poll([pad()]);
    reader.notePause();
    reader.poll([pad({ buttons: [SOUTH, WEST, EAST] })]);
    reader.holdBack();
    const input = reader.input();
    expect([input.jumpHeld, input.claw, input.fuego]).toEqual([true, true, true]);
  });

  it('hold-back is per pad', () => {
    const reader = new GamepadReader();
    reader.poll([pad({ buttons: [RIGHT] }), pad()]);
    reader.notePause();
    reader.poll([pad({ buttons: [RIGHT] }), pad({ buttons: [RIGHT] })]);
    reader.holdBack();
    expect(reader.input()).toMatchObject({ move: 1, right: true }); // pad 0 only
    reader.poll([pad(), pad({ buttons: [RIGHT] })]);
    expect(reader.input()).toMatchObject({ move: 0, right: false });
  });
});
