import { describe, expect, it } from 'vitest';
import { spawn } from './movement';
import { collectHilos, hilosCollected, touchesHilo, type Hilo } from './hilo';

// The hilo at (5, 13): its middle is (88, 216), so its 8 x 8 box is x 84 to 92, y 212 to 220. Poncho's body box is 12 x 14,
// `x` its middle and `y` its feet.
const hilo: Hilo = { col: 5, row: 13 };

describe('GDD-WLD-04 hilo pickups', () => {
  it('touches when the body box overlaps the 8 x 8 box, not when they only share an edge', () => {
    expect(touchesHilo(spawn(78, 216), hilo)).toBe(false); // body right edge x = 84
    expect(touchesHilo(spawn(78.5, 216), hilo)).toBe(true);
    expect(touchesHilo(spawn(98, 216), hilo)).toBe(false); // body left edge x = 92
    expect(touchesHilo(spawn(97.5, 216), hilo)).toBe(true);
    expect(touchesHilo(spawn(88, 212), hilo)).toBe(false); // feet at the hilo's top
    expect(touchesHilo(spawn(88, 212.5), hilo)).toBe(true);
    expect(touchesHilo(spawn(88, 234), hilo)).toBe(false); // head (14 above) at the hilo's bottom
    expect(touchesHilo(spawn(88, 233.5), hilo)).toBe(true);
  });

  it('collects every hilo touched in one step and keeps the ones already collected', () => {
    const two: Hilo[] = [{ col: 5, row: 13 }, { col: 6, row: 13 }];
    expect(collectHilos(two, [false, false], spawn(96, 216))).toEqual([true, true]);
    expect(collectHilos(two, [true, false], spawn(200, 216))).toEqual([true, false]);
  });

  it('counts the collected ones', () => {
    expect(hilosCollected([true, false, true])).toBe(2);
  });
});
