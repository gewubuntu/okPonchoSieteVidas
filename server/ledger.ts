// GDD-LIFE-06, GDD-TEC-10: the lives ledger. Pure: the clock and the stored counts are handed in.
export const DAY_MS = 86_400_000;

export interface LedgerRules { readonly freePerDay: number; readonly palFreePerDay: number; readonly resetUtc: string }
/** Free lives used on ledger day `day`; a count of another day reads as none used. */
export interface DayCount { readonly day: number; readonly used: number }
export interface WalletLedger extends DayCount { readonly bought: number }
export type PalLedger = DayCount;
export const EMPTY_WALLET: WalletLedger = { day: 0, used: 0, bought: 0 };
export const EMPTY_PAL: PalLedger = { day: 0, used: 0 };

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
  if (pal === null) {
    if (freeLeft(wallet, day, rules.freePerDay) > 0) return { ok: true, took: 'free', wallet: { ...wallet, day, used: usedOn(wallet, day) + 1 }, pal: null };
  } else if (freeLeft(pal, day, rules.palFreePerDay) > 0) {
    return { ok: true, took: 'free', wallet, pal: { day, used: usedOn(pal, day) + 1 } };
  }
  if (wallet.bought > 0) return { ok: true, took: 'bought', wallet: { ...wallet, bought: wallet.bought - 1 }, pal };
  return { ok: false, resetAt: nextResetMs(nowMs, rules.resetUtc) };
}

export const creditBought = (wallet: WalletLedger, n: number): WalletLedger => ({ ...wallet, bought: wallet.bought + n });
