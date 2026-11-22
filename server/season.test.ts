import { describe, expect, it } from 'vitest';
import { addMonthsUtc, seasonAt, seasonStartMs } from './season';

const FIRST = '2026-01-01T00:00:00.000Z';
const NOON = Date.parse('2026-11-21T12:00:00.000Z');
const at = (iso: string): number => Date.parse(iso);

describe('GDD-CHAIN-04 season', () => {
  it('the first season is 1, from SEASON.firstStartUtc', () => {
    expect(seasonAt(Date.parse(FIRST), FIRST, 3)).toBe(1);
    expect(seasonStartMs(1, FIRST, 3)).toBe(Date.parse(FIRST));
    expect(seasonAt(NOON, FIRST, 3)).toBe(4);
  });

  it('a new season starts on the first millisecond of its first month', () => {
    expect(seasonAt(at('2026-04-01T00:00:00.000Z'), FIRST, 3)).toBe(2);
  });

  it('a season lasts SEASON.months months, to its last millisecond', () => {
    expect(seasonAt(at('2026-03-31T23:59:59.999Z'), FIRST, 3)).toBe(1);
  });

  it('before the first start there is no season', () => {
    expect(seasonAt(at('2025-12-31T23:59:59.999Z'), FIRST, 3)).toBeNull();
  });

  it('a start on the 31st is clamped to a shorter month last day', () => {
    const first = '2026-01-31T00:00:00.000Z';
    expect(seasonAt(at('2026-02-28T00:00:00.000Z'), first, 1)).toBe(2);
    expect(seasonAt(at('2026-02-27T23:59:59.999Z'), first, 1)).toBe(1);
  });

  // L-028: adding month by month would carry February's 28 into March; the clamp is taken from the 31st itself.
  it('the clamp is taken from the first start day, not from the month before', () => {
    const first = '2026-01-31T00:00:00.000Z';
    expect(seasonAt(at('2026-03-30T23:59:59.999Z'), first, 1)).toBe(2);
    expect(seasonAt(at('2026-03-31T00:00:00.000Z'), first, 1)).toBe(3);
  });

  it('a season that starts past a year end starts in the next year', () => {
    expect(seasonStartMs(5, FIRST, 3)).toBe(at('2027-01-01T00:00:00.000Z'));
    const first = '2026-01-15T12:00:00.000Z';
    expect(seasonAt(at('2027-01-15T11:59:59.999Z'), first, 3)).toBe(4);
    expect(seasonAt(at('2027-01-15T12:00:00.000Z'), first, 3)).toBe(5);
  });

  it('a season whose months reach past December twice starts two years on', () => {
    expect(seasonStartMs(9, FIRST, 3)).toBe(at('2028-01-01T00:00:00.000Z'));
    expect(seasonStartMs(3, FIRST, 12)).toBe(at('2028-01-01T00:00:00.000Z'));
  });

  it('months taken away go back across a year end', () => {
    expect(addMonthsUtc(at('2026-01-31T00:00:00.000Z'), -1)).toBe(at('2025-12-31T00:00:00.000Z'));
    expect(addMonthsUtc(at('2026-03-31T00:00:00.000Z'), -13)).toBe(at('2025-02-28T00:00:00.000Z'));
  });

  it('a start in the middle of a day keeps its hour', () => {
    const first = '2026-01-15T12:00:00.000Z';
    expect(seasonAt(at('2026-04-15T11:59:59.999Z'), first, 3)).toBe(1);
    expect(seasonAt(at('2026-04-15T12:00:00.000Z'), first, 3)).toBe(2);
  });
});
