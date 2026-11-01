// GDD-UI-02: where the settings screen's rows are, which half of one a point is on, and where a volume's bars are. Pure data, no
// Phaser, so it can be unit tested (L-010). The scene draws the texts and bars and feeds in where the pointer went down.
import { BASE_WIDTH, SETTINGS_MENU, TOUCH, VOLUME } from '../config/tuning';
import { SETTINGS_ROWS, type SettingsRow } from '../sim/settings';

/** A row's rectangle in game pixels. */
export interface SettingsMenuRow {
  readonly item: SettingsRow;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One bar of a volume row: filled for each share of the value, the rest outlined. */
export interface VolumeBar {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly filled: boolean;
}

/**
 * Five rows, "Master volume", "Effects volume", "Language", "Button opacity" and "Back", centred, the first's top at SETTINGS_MENU.top and each next
 * directly below, growing like the pause menu's rows so none is under TOUCH.minCssPx tall on the player's screen.
 */
export function layoutSettingsMenu(cssPerVirtualPx: number): SettingsMenuRow[] {
  const h = Math.max(SETTINGS_MENU.rowHeight, Math.ceil(TOUCH.minCssPx / cssPerVirtualPx));
  const x = (BASE_WIDTH - SETTINGS_MENU.width) / 2;
  return SETTINGS_ROWS.map((item, i) => ({ item, x, y: SETTINGS_MENU.top + i * h, w: SETTINGS_MENU.width, h }));
}

/**
 * The row whose box holds the point and the half of it the point is on, or null. A row covers its left and top edge but not its
 * right and bottom edge, like a touch button; the left half is up to the middle, which belongs to the right half.
 */
export function settingsTapAt(rows: readonly SettingsMenuRow[], x: number, y: number): { row: SettingsRow; side: 'left' | 'right' } | null {
  const hit = rows.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  return hit ? { row: hit.item, side: x < hit.x + hit.w / 2 ? 'left' : 'right' } : null;
}

/** The width of the bars of a volume row, from the left of the first to the right of the last. */
const barsSpan = (): number => VOLUME.steps * SETTINGS_MENU.barWidth + (VOLUME.steps - 1) * SETTINGS_MENU.barGap;

/** The volume's bars, left to right: `VOLUME.steps` of them, the last ending `barsInset` inside the row's right edge, vertically centred; the first `value` filled. */
export function volumeBars(row: SettingsMenuRow, value: number): VolumeBar[] {
  const { barWidth, barHeight, barGap, barsInset } = SETTINGS_MENU;
  const span = barsSpan();
  const left = row.x + row.w - barsInset - span;
  const y = row.y + (row.h - barHeight) / 2;
  return Array.from({ length: VOLUME.steps }, (_, i) => ({ x: left + i * (barWidth + barGap), y, w: barWidth, h: barHeight, filled: i < value }));
}

/** GDD-UI-02, GDD-CTL-03: the middle x of the language's name or the Button opacity step's name, where a volume row's bars are (the middle of their span). */
export const languageValueX = (row: SettingsMenuRow): number => row.x + row.w - SETTINGS_MENU.barsInset - barsSpan() / 2;
