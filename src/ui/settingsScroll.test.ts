import { describe, expect, it } from 'vitest';
import { SETTINGS_MENU } from '../config/tuning';
import { SETTINGS_ROWS } from '../sim/settings';
import { layoutSettingsMenu } from './settingsMenu';
import { arrowTapTarget, rowsThatFit, scrollArrowAt, scrollArrows, scrollFirst, shownSettingsRows } from './settingsScroll';

const COUNT = 7;

describe('GDD-UI-02 the settings list scrolls', () => {
  it('GDD-UI-02 with 28 px rows all seven fit and nothing scrolls', () => {
    // floor((270 - 62) / 28) = floor(208 / 28) = 7
    expect(rowsThatFit(28)).toBe(7);
    for (let chosen = 0; chosen < COUNT; chosen++) expect(scrollFirst(chosen, 0, 7, COUNT)).toBe(0);
    expect(scrollArrows(layoutSettingsMenu(2), 0, 7, 2)).toEqual([]);
  });

  it('GDD-UI-02 with 34 px rows six fit', () => {
    // floor(208 / 34) = 6
    expect(rowsThatFit(34)).toBe(6);
    expect(rowsThatFit(48)).toBe(4);
  });

  it('GDD-UI-02 choosing Back, the seventh row, with six shown scrolls the list one row: Effects volume to Back shown', () => {
    const first = scrollFirst(SETTINGS_ROWS.indexOf('back'), 0, 6, COUNT);
    expect(first).toBe(1);
    const rows = shownSettingsRows(layoutSettingsMenu(390 / 270), first, 6);
    expect(rows.map((r) => r.item)).toEqual(['effects', 'language', 'buttonOpacity', 'layout', 'shake', 'back']);
    // The rows keep the places they have at the top: Effects volume where Master volume is.
    expect(rows.map((r) => [r.y, r.h])).toEqual([[62, 34], [96, 34], [130, 34], [164, 34], [198, 34], [232, 34]]);
  });

  it('GDD-UI-02 with four shown, choosing the row after the last one shown moves the list just enough, not to the chosen row', () => {
    expect(scrollFirst(4, 0, 4, COUNT)).toBe(1);
    expect(scrollFirst(5, 1, 4, COUNT)).toBe(2);
    expect(scrollFirst(6, 2, 4, COUNT)).toBe(3);
  });

  it('GDD-UI-02 choosing Master volume again scrolls back to the top', () => {
    expect(scrollFirst(0, 1, 6, COUNT)).toBe(0);
    expect(scrollFirst(1, 3, 4, COUNT)).toBe(1);
  });

  it('GDD-UI-02 choosing a row already shown does not scroll', () => {
    for (let chosen = 1; chosen <= 6; chosen++) expect(scrollFirst(chosen, 1, 6, COUNT), `row ${chosen}`).toBe(1);
    for (let chosen = 0; chosen <= 5; chosen++) expect(scrollFirst(chosen, 0, 6, COUNT), `row ${chosen}`).toBe(0);
  });

  it('GDD-UI-02 the down arrow shows only while rows are hidden below, the up arrow only while rows are hidden above', () => {
    const rows = layoutSettingsMenu(390 / 270);
    expect(scrollArrows(rows, 0, 6, 390 / 270).map((a) => a.dir)).toEqual(['below']);
    expect(scrollArrows(rows, 1, 6, 390 / 270).map((a) => a.dir)).toEqual(['above']);
    // Four shown of seven: in the middle both are drawn.
    expect(scrollArrows(layoutSettingsMenu(1), 1, 4, 1).map((a) => a.dir)).toEqual(['above', 'below']);
  });

  it('GDD-UI-02 the arrows are 8 px wide and 5 px tall on the title line, 8 px inside the rows edges: down at the right, up at the left', () => {
    const [down] = scrollArrows(layoutSettingsMenu(390 / 270), 0, 6, 390 / 270);
    // The rows span 110 to 370; the arrow's middle is 8 px inside the right edge, the title's middle is 44 from the top.
    expect(down).toMatchObject({ dir: 'below', x: 362 - 4, y: 44 - 2.5, w: 8, h: 5 });
    const [up] = scrollArrows(layoutSettingsMenu(390 / 270), 1, 6, 390 / 270);
    expect(up).toMatchObject({ dir: 'above', x: 118 - 4, y: 44 - 2.5, w: 8, h: 5 });
    expect(SETTINGS_MENU.titleY).toBe(44);
  });

  it('GDD-UI-02 an arrow is tapped in a square of 48 CSS px about it, at least the arrow', () => {
    // 2 CSS px per game px: 48 CSS px are 24 game px, about the middle (362, 44).
    const rows = layoutSettingsMenu(2);
    const [down] = scrollArrows(rows, 0, 4, 2);
    expect(down!.tap).toEqual({ x: 350, y: 32, w: 24, h: 24 });
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 2), 350, 32)).toBe('below');
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 2), 373.9, 55.9)).toBe('below');
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 2), 374, 44)).toBeNull();
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 2), 349.9, 44)).toBeNull();
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 2), 362, 56)).toBeNull();
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 2), 362, 31.9)).toBeNull();
    // On a large screen the square is no smaller than the arrow.
    const [big] = scrollArrows(rows, 0, 4, 20);
    expect(big!.tap).toEqual({ x: 358, y: 41.5, w: 8, h: 5 });
  });

  it('GDD-UI-02 the arrow tap box stops at the first row top, so a tap on the row is the row', () => {
    // 1 CSS px per game px (a window 270 CSS px tall): 48 game px about y 44 would reach 68, past the first row top at 62.
    const rows = layoutSettingsMenu(1);
    const [down] = scrollArrows(rows, 0, 4, 1);
    expect(rows[0]!.y).toBe(62);
    expect(down!.tap).toEqual({ x: 338, y: 20, w: 48, h: 42 });
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 1), 362, 61.9)).toBe('below');
    expect(scrollArrowAt(scrollArrows(rows, 0, 4, 1), 362, 62)).toBeNull();
  });

  it('GDD-UI-02 a tap on the down arrow moves the list one row and chooses the row that comes into view, and the same for the up arrow', () => {
    // Six shown from the top: Back comes into view.
    expect(arrowTapTarget('below', 0, 6, COUNT)).toEqual({ row: 'back', first: 1 });
    // Four shown: first 0 shows rows 0-3, one down shows 1-4 and row 4 (Layout) comes into view.
    expect(arrowTapTarget('below', 0, 4, COUNT)).toEqual({ row: 'layout', first: 1 });
    expect(arrowTapTarget('below', 2, 4, COUNT)).toEqual({ row: 'back', first: 3 });
    // Up: the list shows 2-5 and one up shows 1-4, row 1 (Effects volume) comes into view.
    expect(arrowTapTarget('above', 2, 4, COUNT)).toEqual({ row: 'effects', first: 1 });
    expect(arrowTapTarget('above', 1, 6, COUNT)).toEqual({ row: 'master', first: 0 });
    // The row chosen is the one scrollFirst keeps the new first for.
    const down = arrowTapTarget('below', 0, 6, COUNT);
    expect(scrollFirst(SETTINGS_ROWS.indexOf(down.row), 0, 6, COUNT)).toBe(down.first);
    const up = arrowTapTarget('above', 2, 4, COUNT);
    expect(scrollFirst(SETTINGS_ROWS.indexOf(up.row), 2, 4, COUNT)).toBe(up.first);
  });

  it('GDD-UI-02 a tap on a shown row matches it at its shown place, scrolled', () => {
    const rows = shownSettingsRows(layoutSettingsMenu(390 / 270), 1, 6);
    // Scrolled by one: the first shown row is drawn where the first row is, y 62 to 96, and is Effects volume, not Master volume.
    expect(rows[0]).toMatchObject({ item: 'effects', y: 62 });
    expect(rows.find((r) => 70 >= r.y && 70 < r.y + r.h)!.item).toBe('effects');
    expect(rows.find((r) => 250 >= r.y && 250 < r.y + r.h)!.item).toBe('back');
  });

  it('GDD-UI-02 hidden rows are not shown, so they cannot be tapped', () => {
    const top = shownSettingsRows(layoutSettingsMenu(390 / 270), 0, 6);
    expect(top.map((r) => r.item)).not.toContain('back');
    const scrolled = shownSettingsRows(layoutSettingsMenu(390 / 270), 1, 6);
    expect(scrolled.map((r) => r.item)).not.toContain('master');
  });

  it('GDD-UI-02 a list that no longer fits, a window that grew, is brought back into range before the chosen row is kept', () => {
    // First 3 with four shown, then the window grows and seven fit: the list is at the top.
    expect(scrollFirst(6, 3, 7, COUNT)).toBe(0);
    expect(scrollFirst(6, 3, 6, COUNT)).toBe(1);
  });
});
