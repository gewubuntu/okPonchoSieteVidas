// GDD-UI-02: where the pause menu's, the title menu's and the results menu's three rows are and which one a point is on. Pure data, no
// Phaser, so it can be unit tested. The scene draws the texts and feeds in where the pointer went down.
import { BASE_WIDTH, PAUSE_MENU, RESULTS_MENU, TITLE_MENU, TOUCH } from '../config/tuning';
import type { MenuItem } from '../sim/pause';
import type { ResultsItem } from '../sim/results';
import type { TitleItem } from '../sim/title';

/** A row's rectangle in game pixels. */
export interface MenuRow<Item extends string = MenuItem> {
  readonly item: Item;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Rows for `items`, centred, the first's top at `top` and each next directly below. A row is never under TOUCH.minCssPx tall on
 * the player's screen, so on a small screen they grow. `cssPerVirtualPx` is how big one game pixel is there.
 */
function stackRows<Item extends string>(items: readonly Item[], menu: { width: number; rowHeight: number; top: number }, cssPerVirtualPx: number): MenuRow<Item>[] {
  const h = Math.max(menu.rowHeight, Math.ceil(TOUCH.minCssPx / cssPerVirtualPx));
  const x = (BASE_WIDTH - menu.width) / 2;
  return items.map((item, i) => ({ item, x, y: menu.top + i * h, w: menu.width, h }));
}

/** Three rows, "Resume", "Settings" and "Quit to title", the first's top at PAUSE_MENU.top. */
export const layoutPauseMenu = (cssPerVirtualPx: number): MenuRow[] => stackRows(['resume', 'settings', 'quit'] as const, PAUSE_MENU, cssPerVirtualPx);

/** Three rows, "Start", "Tutorial" and "Settings", the first's top at TITLE_MENU.top. */
export const layoutTitleMenu = (cssPerVirtualPx: number): MenuRow<TitleItem>[] => stackRows(['start', 'tutorial', 'settings'] as const, TITLE_MENU, cssPerVirtualPx);

/** Three rows, "Next level", "Retry" and "Quit to title", the first's top at RESULTS_MENU.top. */
export const layoutResultsMenu = (cssPerVirtualPx: number): MenuRow<ResultsItem>[] => stackRows(['next', 'retry', 'quit'] as const, RESULTS_MENU, cssPerVirtualPx);

/** The item whose row holds the point, or null. A row covers its left and top edge but not its right and bottom edge, like a touch button. */
function itemAt<Item extends string>(rows: readonly MenuRow<Item>[], x: number, y: number): Item | null {
  return rows.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.item ?? null;
}

export const pauseMenuItemAt = (rows: readonly MenuRow[], x: number, y: number): MenuItem | null => itemAt(rows, x, y);
export const titleMenuItemAt = (rows: readonly MenuRow<TitleItem>[], x: number, y: number): TitleItem | null => itemAt(rows, x, y);
export const resultsMenuItemAt = (rows: readonly MenuRow<ResultsItem>[], x: number, y: number): ResultsItem | null => itemAt(rows, x, y);
