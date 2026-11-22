import { describe, expect, it } from 'vitest';
import { LEVEL_0_1 } from '../levels/level0-1';
import { fromBits } from './detmath';
import { startRun, stepRun } from './run';
import { stateHash, stateText } from './stateHash';

/** The hashes of 0-1's start and of its first three steps running right. */
function hashes(): string[] {
  let r = startRun(LEVEL_0_1);
  const out = [stateHash(r)];
  for (let i = 0; i < 3; i++) {
    r = stepRun(r, { move: 1, jumpHeld: false }, LEVEL_0_1);
    out.push(stateHash(r));
  }
  return out;
}

describe('GDD-TEC-09 state hash', () => {
  it('GDD-TEC-09 stateText writes plain data one way', () => {
    expect(stateText({ b: 1, a: [true, null, undefined, -0, 'x'], c: new Set(['q']) })).toBe('{a:[T,N,U,n8000000000000000,"x"],b:n3ff0000000000000,c:S["q"]}');
  });

  it('GDD-TEC-09 stateText is the same whatever order the keys were written in', () => {
    expect(stateText({ a: 1, b: 2 })).toBe(stateText({ b: 2, a: 1 }));
    expect(stateText({ b: 2, a: 1 })).toBe('{a:n3ff0000000000000,b:n4000000000000000}');
  });

  it('GDD-TEC-09 stateText: a key left out and a key that is undefined are different', () => {
    expect(stateText({})).toBe('{}');
    expect(stateText({ a: undefined })).toBe('{a:U}');
  });

  it('GDD-TEC-09 stateText: 0 and -0, and 1 and true, are different', () => {
    expect(stateText(0)).toBe('n0000000000000000');
    expect(stateText(-0)).toBe('n8000000000000000');
    expect(stateText(1)).toBe('n3ff0000000000000');
    expect(stateText(true)).toBe('T');
    expect(stateText(false)).toBe('F');
  });

  it('GDD-TEC-09 stateText: a NaN is one text', () => {
    expect(stateText(fromBits('fff8000000000001'))).toBe('n7ff8000000000000');
    expect(stateText(Number.NaN)).toBe('n7ff8000000000000');
  });

  it('GDD-TEC-09 stateText: a Set keeps its order and an array its length', () => {
    expect(stateText(new Set(['a', 'b']))).toBe('S["a","b"]');
    expect(stateText(new Set(['b', 'a']))).toBe('S["b","a"]');
    expect(stateText([null])).toBe('[N]');
    expect(stateText([])).toBe('[]');
  });

  it('GDD-TEC-09 stateText: the characters of a string past ASCII are escaped', () => {
    expect(stateText('ñ')).toBe('"\\u00f1"');
    // The bound: U+007F is ASCII and stays as it is, U+0080 is the first one escaped, and U+FFFF the last code unit.
    expect(stateText('\u007f')).toBe('"\u007f"');
    expect(stateText('\u0080')).toBe('"\\u0080"');
    expect(stateText('\uffff')).toBe('"\\uffff"');
    // A character past U+FFFF is two code units, each escaped.
    expect(stateText('\u{1f408}')).toBe('"\\ud83d\\udc08"');
  });

  it('GDD-TEC-09 stateText refuses a function, a Map and a class instance', () => {
    class Thing {
      readonly a = 1;
    }
    expect(() => stateText(() => 1)).toThrow(TypeError);
    expect(() => stateText(new Map([['a', 1]]))).toThrow(TypeError);
    expect(() => stateText(new Thing())).toThrow(TypeError);
    expect(() => stateText({ inside: new Map() })).toThrow(TypeError);
  });

  it('GDD-TEC-09 stateHash of a real run changes with every step and is the same for the same state', () => {
    const first = hashes();
    expect(new Set(first).size).toBe(4);
    for (const h of first) expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(hashes()).toEqual(first);
  });
});
