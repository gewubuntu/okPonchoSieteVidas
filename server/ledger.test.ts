import { describe, expect, it } from 'vitest';
import { EMPTY_WALLET, creditBought, freeLeft, ledgerDay, nextResetMs, takeLife, usedOn, type PalLedger, type WalletLedger } from './ledger';

const RULES = { freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00' };
// 1795262400000, ledger day 20778.
const NOON = Date.parse('2026-11-21T12:00:00.000Z');

const wallet = (day: number, used: number, bought: number): WalletLedger => ({ day, used, bought });
const pal = (day: number, used: number): PalLedger => ({ day, used });

describe('GDD-LIFE-06 ledger', () => {
  it('the ledger day turns over at LEDGER.resetUtc, not at midnight', () => {
    expect(ledgerDay(Date.parse('2026-11-21T06:29:59.999Z'), '06:30')).toBe(20777);
    expect(ledgerDay(Date.parse('2026-11-21T06:30:00.000Z'), '06:30')).toBe(20778);
    expect(ledgerDay(NOON, '00:00')).toBe(20778);
  });

  it('the next reset is at LEDGER.resetUtc of the coming day', () => {
    expect(nextResetMs(Date.parse('2026-11-21T05:00:00.000Z'), '06:30')).toBe(1795242600000);
    expect(nextResetMs(NOON, '00:00')).toBe(1795305600000);
  });

  it('free first as Poncho: a free life is taken while one is left, though bought lives wait', () => {
    expect(takeLife(wallet(20778, 2, 5), null, NOON, RULES)).toEqual({ ok: true, took: 'free', wallet: wallet(20778, 3, 5), pal: null });
  });

  it('free first as a Pal: its own free life is taken, though bought lives wait', () => {
    // No free life used as Poncho, so the answer is the same under either reading of Open Question 52 (c).
    expect(takeLife(wallet(20778, 0, 5), pal(20778, 6), NOON, RULES)).toEqual({ ok: true, took: 'free', wallet: wallet(20778, 0, 5), pal: pal(20778, 7) });
  });

  it('bought only then: with the free lives used a bought life is taken, and one fewer is left', () => {
    expect(takeLife(wallet(20778, 3, 5), null, NOON, RULES)).toMatchObject({ ok: true, took: 'bought', wallet: wallet(20778, 3, 4) });
  });

  it('the fourth attempt of a day as Poncho finds no free life', () => {
    expect(takeLife(wallet(20778, 3, 0), null, NOON, RULES).ok).toBe(false);
  });

  it('the eighth attempt of a day as a Pal finds no free life', () => {
    expect(takeLife(wallet(20778, 3, 0), pal(20778, 7), NOON, RULES).ok).toBe(false);
  });

  it('a Pal draws on its own allowance: seven used as the Pal, none as Poncho, nothing bought, gives none', () => {
    expect(takeLife(wallet(20778, 0, 0), pal(20778, 7), NOON, RULES)).toEqual({ ok: false, resetAt: 1795305600000 });
  });

  it('at zero: no life is given, with the time of the next reset', () => {
    expect(takeLife(wallet(20778, 3, 0), null, NOON, RULES)).toEqual({ ok: false, resetAt: 1795305600000 });
  });

  it('after the reset every free allowance is full again', () => {
    expect(takeLife(wallet(20777, 3, 0), null, NOON, RULES)).toMatchObject({ ok: true, took: 'free', wallet: wallet(20778, 1, 0) });
    expect(takeLife(wallet(20777, 3, 0), pal(20777, 7), NOON, RULES)).toMatchObject({ ok: true, took: 'free', pal: pal(20778, 1) });
  });

  it('bought lives do not expire daily', () => {
    const result = takeLife(wallet(20777, 3, 5), null, NOON, RULES);
    expect(result).toMatchObject({ ok: true, took: 'free' });
    expect(result.ok && result.wallet.bought).toBe(5);
  });

  it('a credit adds to the bought lives already held', () => {
    expect(creditBought(wallet(0, 0, 2), 7).bought).toBe(9);
  });

  it('a wallet never seen has three free lives and none bought', () => {
    let held = EMPTY_WALLET;
    for (let i = 0; i < 3; i++) {
      const result = takeLife(held, null, NOON, RULES);
      expect(result).toMatchObject({ ok: true, took: 'free' });
      if (result.ok) held = result.wallet;
    }
    expect(takeLife(held, null, NOON, RULES).ok).toBe(false);
  });

  it('as a Pal with its lives used a bought life is taken and the wallet free lives stay', () => {
    expect(takeLife(wallet(20778, 0, 5), pal(20778, 7), NOON, RULES)).toEqual({ ok: true, took: 'bought', wallet: wallet(20778, 0, 4), pal: pal(20778, 7) });
  });

  it('the last bought life is taken, and none is left', () => {
    expect(takeLife(wallet(20778, 3, 1), null, NOON, RULES)).toEqual({ ok: true, took: 'bought', wallet: wallet(20778, 3, 0), pal: null });
  });

  it('a count above the allowance, as after the allowance is lowered, leaves no free life, never a negative', () => {
    expect(freeLeft(wallet(20778, 5, 0), 20778, 3)).toBe(0);
    expect(freeLeft(pal(20778, 9), 20778, 7)).toBe(0);
  });

  it('a count of a later day reads as none used too', () => {
    expect(usedOn(wallet(20779, 3, 0), 20778)).toBe(0);
  });

  it('a credit of one life adds one', () => {
    expect(creditBought(wallet(20778, 3, 0), 1)).toEqual(wallet(20778, 3, 1));
  });

  it.each([-9, 0, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY])(
    'a credit that is not a positive whole number of lives is refused: %s',
    (n) => {
      expect(() => creditBought(wallet(20778, 3, 2), n)).toThrow(RangeError);
    },
  );

  it('placeholder Open Question 52 c: a Pal seven a day are beside the wallet own three, ten free in one day', () => {
    // Four attempts as Poncho, then eight as the Pal; the other reading, the seven in place of the three, gives seven.
    let held = { wallet: EMPTY_WALLET, pal: pal(0, 0) };
    let free = 0;
    for (let i = 0; i < 12; i++) {
      const result = takeLife(held.wallet, i >= 4 ? held.pal : null, NOON, RULES);
      if (!result.ok || result.took !== 'free') continue;
      free++;
      held = { wallet: result.wallet, pal: result.pal ?? held.pal };
    }
    expect(free).toBe(10);
    expect(held).toEqual({ wallet: wallet(20778, 3, 0), pal: pal(20778, 7) });
  });

  it('placeholder Open Question 52 d: bought lives have no cap and never run out', () => {
    expect(creditBought(wallet(20778, 3, 1_000_000), 7).bought).toBe(1_000_007);
    // Seven bought on a wallet never seen, and played in 2052: the fourth attempt of that day takes one of them.
    const later = Date.parse('2052-01-01T12:00:00.000Z');
    let held = creditBought(EMPTY_WALLET, 7);
    for (let i = 0; i < 3; i++) {
      const result = takeLife(held, null, later, RULES);
      if (result.ok) held = result.wallet;
    }
    expect(takeLife(held, null, later, RULES)).toMatchObject({ ok: true, took: 'bought', wallet: { bought: 6 } });
  });
});
