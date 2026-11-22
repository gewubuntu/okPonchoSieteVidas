import { describe, expect, it } from 'vitest';
import { bitsOf, cos, fromBits, hypot, sin } from './detmath';
import { ANGLES, PAIRS, SUMS } from './detmath.vectors';
import { fnv1a64 } from './fnv';

/** The FNV-1a 64 of the bits of f(k) for k from 0 to n - 1, joined. */
const sum = (n: number, f: (k: number) => number): string => fnv1a64(Array.from({ length: n }, (_, k) => bitsOf(f(k))).join(''));

describe('GDD-TEC-09 deterministic maths', () => {
  it('GDD-TEC-09 bitsOf and fromBits name a double by its 64 bits, and every NaN the same way', () => {
    expect(bitsOf(1)).toBe('3ff0000000000000');
    expect(bitsOf(-2)).toBe('c000000000000000');
    expect(bitsOf(-0)).toBe('8000000000000000');
    expect(bitsOf(0.1)).toBe('3fb999999999999a');
    expect(bitsOf(NaN)).toBe('7ff8000000000000');
    expect(bitsOf(fromBits('fff8000000000001'))).toBe('7ff8000000000000');
    expect(fromBits('3fb999999999999a')).toBe(0.1);
    expect(Object.is(fromBits('8000000000000000'), -0)).toBe(true);
    expect(fromBits('c000000000000000')).toBe(-2);
    expect(fromBits('7ff0000000000000')).toBe(Infinity);
  });

  it('GDD-TEC-09 sin gives the measured bits for every angle of the table', () => {
    const wrong = ANGLES.flatMap(([x, s]) => (bitsOf(sin(fromBits(x))) === s ? [] : [`sin ${fromBits(x)}: ${bitsOf(sin(fromBits(x)))}, not ${s}`]));
    expect(wrong).toEqual([]);
  });

  it('GDD-TEC-09 cos gives the measured bits for every angle of the table', () => {
    const wrong = ANGLES.flatMap(([x, , c]) => (bitsOf(cos(fromBits(x))) === c ? [] : [`cos ${fromBits(x)}: ${bitsOf(cos(fromBits(x)))}, not ${c}`]));
    expect(wrong).toEqual([]);
  });

  it('GDD-TEC-09 hypot gives the measured bits for every pair of the table', () => {
    const wrong = PAIRS.flatMap(([a, b, h]) =>
      bitsOf(hypot(fromBits(a), fromBits(b))) === h ? [] : [`hypot ${fromBits(a)}, ${fromBits(b)}: ${bitsOf(hypot(fromBits(a), fromBits(b)))}, not ${h}`],
    );
    expect(wrong).toEqual([]);
  });

  it('GDD-TEC-09 the angles the simulation passes: the bats, the Zopilote, the boss lap and La Estrella sway', () => {
    // MURCIELAGO.periodSteps 240, ZOPILOTE.periodSteps 150, BOSS.lapSteps 240 and ESTRELLA.swayPeriodSteps 60, each angle written as
    // its call site writes it.
    expect(sum(240, (k) => sin((2 * Math.PI * k) / 240))).toBe(SUMS['sin 2 pi k / 240, k 0 to 239']);
    expect(sum(240, (k) => cos((2 * Math.PI * k) / 240))).toBe(SUMS['cos 2 pi k / 240, k 0 to 239']);
    expect(sum(7201, (k) => sin((2 * Math.PI * k) / 150))).toBe(SUMS['sin 2 pi k / 150, k 0 to 7200']);
    expect(sum(121, (k) => sin((2 * Math.PI * k) / 60))).toBe(SUMS['sin 2 pi k / 60, k 0 to 120']);
    expect(sum(480, (k) => sin((2 * Math.PI * ((0.5 * k) % 240)) / 240))).toBe(SUMS['sin 2 pi 0.5 k / 240, k 0 to 479']);
  });

  it('GDD-TEC-09 hypot over sixtieths of a px', () => {
    const all: string[] = [];
    for (let i = 0; i <= 300; i += 7) for (let j = 0; j <= 300; j += 11) all.push(bitsOf(hypot(i / 60, j / 60)));
    expect(fnv1a64(all.join(''))).toBe(SUMS['hypot i / 60, j / 60 px, i 0 to 300 by 7, j 0 to 300 by 11']);
  });
});
