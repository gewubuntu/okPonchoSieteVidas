// GDD-CHAIN-04: seasons of SEASON.months calendar months (UTC) from SEASON.firstStartUtc; the first season is 1.
const daysIn = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

export function addMonthsUtc(ms: number, months: number): number {
  const d = new Date(ms);
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return Date.UTC(year, month, Math.min(d.getUTCDate(), daysIn(year, month)), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

export const seasonStartMs = (season: number, firstStartUtc: string, months: number): number => addMonthsUtc(Date.parse(firstStartUtc), (season - 1) * months);

export function seasonAt(nowMs: number, firstStartUtc: string, months: number): number | null {
  const first = new Date(Date.parse(firstStartUtc));
  const now = new Date(nowMs);
  const apart = (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + (now.getUTCMonth() - first.getUTCMonth());
  let season = Math.floor(apart / months) + 1;
  if (seasonStartMs(season, firstStartUtc, months) > nowMs) season -= 1;
  return season < 1 ? null : season;
}
