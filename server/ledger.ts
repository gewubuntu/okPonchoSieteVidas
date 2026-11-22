// GDD-LIFE-06, GDD-TEC-10: the lives ledger. Pure: the clock and the stored counts are handed in.
export const DAY_MS = 86_400_000;

export interface LedgerRules { readonly freePerDay: number; readonly palFreePerDay: number; readonly resetUtc: string }
/** Free lives used on ledger day `day`; a count of another day reads as none used. */
export interface DayCount { readonly day: number; readonly used: number }
export interface WalletLedger extends DayCount { readonly bought: number }
export type PalLedger = DayCount;
export const EMPTY_WALLET: WalletLedger = { day: 0, used: 0, bought: 0 };

export const resetOffsetMs = (resetUtc: string): number => (Number(resetUtc.slice(0, 2)) * 60 + Number(resetUtc.slice(3, 5))) * 60_000;
export const ledgerDay = (nowMs: number, resetUtc: string): number => Math.floor((nowMs - resetOffsetMs(resetUtc)) / DAY_MS);
export const nextResetMs = (nowMs: number, resetUtc: string): number => (ledgerDay(nowMs, resetUtc) + 1) * DAY_MS + resetOffsetMs(resetUtc);
export const usedOn = (count: DayCount, day: number): number => (count.day === day ? count.used : 0);
export const freeLeft = (count: DayCount, day: number, perDay: number): number => Math.max(0, perDay - usedOn(count, day));

export type Took = 'free' | 'bought';
export type TakeResult =
  | { readonly ok: true; readonly took: Took; readonly wallet: WalletLedger; readonly pal: PalLedger | null }
  | { readonly ok: false; readonly resetAt: number };

export function takeLife(wallet: WalletLedger, pal: PalLedger | null, nowMs: number, rules: LedgerRules): TakeResult {
  const day = ledgerDay(nowMs, rules.resetUtc);
  // Placeholder (Open Question 52 (c)): a Pal's allowance is beside the wallet's own, never in its place; each hero draws on its own.
  if (pal === null) {
    if (freeLeft(wallet, day, rules.freePerDay) > 0) return { ok: true, took: 'free', wallet: { ...wallet, day, used: usedOn(wallet, day) + 1 }, pal: null };
  } else if (freeLeft(pal, day, rules.palFreePerDay) > 0) {
    return { ok: true, took: 'free', wallet, pal: { day, used: usedOn(pal, day) + 1 } };
  }
  // Placeholder (Open Question 52 (d)): bought lives never run out; nothing here reads when they were bought.
  if (wallet.bought > 0) return { ok: true, took: 'bought', wallet: { ...wallet, bought: wallet.bought - 1 }, pal };
  return { ok: false, resetAt: nextResetMs(nowMs, rules.resetUtc) };
}

/**
 * GDD-CHAIN-03: `n` bought lives added to the wallet's. `n` is a positive whole number; anything else throws a RangeError
 * and is never rounded or clamped. Counting each chain event once is the chain listener's, not this function's.
 */
export function creditBought(wallet: WalletLedger, n: number): WalletLedger {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`a credit is a positive whole number of lives, not ${n}`);
  // Placeholder (Open Question 52 (d)): bought lives have no cap.
  return { ...wallet, bought: wallet.bought + n };
}
