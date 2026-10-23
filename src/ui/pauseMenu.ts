// GDD-UI-02: where the pause menu's two rows are and which one a point is on. Pure data, no Phaser, so it can be unit
// tested. The scene draws the texts and feeds in where the pointer went down.
import { BASE_WIDTH, PAUSE_MENU, TOUCH } from '../config/tuning';
import type { MenuItem } from '../sim/pause';

/** A row's rectangle in virtual pixels. */
export interface MenuRow {
  readonly item: MenuItem;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Two rows, "Resume" then "Quit to title", centred, the first's top at PAUSE_MENU.top and the second directly below. A row is
 * never under TOUCH.minCssPx tall on the player's screen, so on a small screen both grow. `cssPerVirtualPx` is how big one
 * virtual pixel is there.
 */
export function layoutPauseMenu(cssPerVirtualPx: number): [MenuRow, MenuRow] {
  const h = Math.max(PAUSE_MENU.rowHeight, Math.ceil(TOUCH.minCssPx / cssPerVirtualPx));
  const x = (BASE_WIDTH - PAUSE_MENU.width) / 2;
  return [
    { item: 'resume', x, y: PAUSE_MENU.top, w: PAUSE_MENU.width, h },
    { item: 'quit', x, y: PAUSE_MENU.top + h, w: PAUSE_MENU.width, h },
  ];
}

/** The item whose row holds the point, or null. A row covers its left and top edge but not its right and bottom edge, like a touch button. */
export function pauseMenuItemAt(rows: readonly MenuRow[], x: number, y: number): MenuItem | null {
  return rows.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.item ?? null;
}
