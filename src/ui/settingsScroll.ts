// GDD-UI-02, "Scrolling": where the settings list shows its rows when they do not all fit, and its two arrows. Pure data, no
// Phaser, so it can be unit tested (L-010). The list scrolls by whole rows; the rows shown keep the places and heights they have
// with the list at its top. The scene keeps the first row shown and feeds in where the pointer went down.
import { BASE_HEIGHT, SETTINGS_MENU } from '../config/tuning';
import { SETTINGS_ROWS, type SettingsRow } from '../sim/settings';
import type { SettingsMenuRow } from './settingsMenu';

/** How many whole rows of `rowHeight` game px fit between the first row's top and the screen's bottom. */
export const rowsThatFit = (rowHeight: number): number => Math.floor((BASE_HEIGHT - SETTINGS_MENU.top) / rowHeight);

/**
 * The first row shown once row `chosen` is chosen: `first` kept inside the list, then moved by the smallest amount that shows the
 * chosen row whole. Choosing Master volume brings the list back to its top, which is also why a screen that opens on it opens at the top.
 */
export function scrollFirst(chosen: number, first: number, fit: number, count: number): number {
  const kept = Math.max(0, Math.min(count - fit, first));
  if (chosen < kept) return chosen;
  if (chosen > kept + fit - 1) return chosen - fit + 1;
  return kept;
}

/** The rows shown, `fit` of them from `first`, each at the place the row in that position has with the list at its top. */
export function shownSettingsRows(rows: readonly SettingsMenuRow[], first: number, fit: number): SettingsMenuRow[] {
  return rows.slice(first, first + fit).map((r, i) => ({ ...r, y: rows[i]!.y }));
}

/** A scroll arrow: `below` is the one pointing down (rows hidden below), `above` the one pointing up. The triangle's box and the box a tap on it is read in, in game px. */
export interface ScrollArrow {
  readonly dir: 'above' | 'below';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly tap: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

/**
 * The arrows now drawn, up first: the down one while rows are hidden below, the up one while rows are hidden above, none when all
 * fit. The triangle is centred on the title's line, 8 px inside the rows' right edge (down) or left edge (up); a tap on it is read in
 * a square of `tapCssPx` CSS px about its middle, never smaller than the triangle, cut off at the first row's top so it never takes a tap
 * on a row (GDD-UI-02; it reaches that far on windows under 360 CSS px tall).
 */
export function scrollArrows(rows: readonly SettingsMenuRow[], first: number, fit: number, cssPerVirtualPx: number): ScrollArrow[] {
  const { width, height, inset, tapCssPx } = SETTINGS_MENU.scrollArrow;
  const edge = rows[0]!;
  const side = tapCssPx / cssPerVirtualPx;
  const arrow = (dir: 'above' | 'below', cx: number): ScrollArrow => {
    const cy = SETTINGS_MENU.titleY;
    const tw = Math.max(width, side);
    const th = Math.max(height, side);
    const top = cy - th / 2;
    return { dir, x: cx - width / 2, y: cy - height / 2, w: width, h: height, tap: { x: cx - tw / 2, y: top, w: tw, h: Math.min(th, edge.y - top) } };
  };
  const arrows: ScrollArrow[] = [];
  if (first > 0) arrows.push(arrow('above', edge.x + inset));
  if (first + fit < rows.length) arrows.push(arrow('below', edge.x + edge.w - inset));
  return arrows;
}

/** The arrow whose tap box holds the point (it covers its left and top edge but not its right and bottom edge), or null. */
export function scrollArrowAt(arrows: readonly ScrollArrow[], x: number, y: number): 'above' | 'below' | null {
  const hit = arrows.find((a) => x >= a.tap.x && x < a.tap.x + a.tap.w && y >= a.tap.y && y < a.tap.y + a.tap.h);
  return hit ? hit.dir : null;
}

/** A tap on an arrow: the list moves one row that way, and the row that comes into view (the new last one going down, the new first going up) is chosen. */
export function arrowTapTarget(dir: 'above' | 'below', first: number, fit: number, count: number): { row: SettingsRow; first: number } {
  const next = Math.max(0, Math.min(count - fit, first + (dir === 'below' ? 1 : -1)));
  return { row: SETTINGS_ROWS[dir === 'below' ? next + fit - 1 : next]!, first: next };
}
