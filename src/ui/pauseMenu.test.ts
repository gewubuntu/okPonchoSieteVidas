import { describe, expect, it } from 'vitest';
import { layoutTouchButtons } from './touchLayout';
import { layoutPauseMenu, layoutResultsMenu, layoutTitleMenu, pauseMenuItemAt, resultsMenuItemAt, titleMenuItemAt } from './pauseMenu';

describe('GDD-UI-02 pause menu rows', () => {
  it('three rows, Resume, Settings and Quit to title, 160 by 28, centred, the first at 136, each next right below', () => {
    expect(layoutPauseMenu(2)).toEqual([
      { item: 'resume', x: 160, y: 136, w: 160, h: 28 },
      { item: 'settings', x: 160, y: 164, w: 160, h: 28 },
      { item: 'quit', x: 160, y: 192, w: 160, h: 28 },
    ]);
  });

  it('on a small screen the rows grow to 48 CSS px', () => {
    const [resume, settings, quit] = layoutPauseMenu(1);
    expect(resume).toMatchObject({ y: 136, h: 48 });
    expect(settings).toMatchObject({ y: 184, h: 48 });
    expect(quit).toMatchObject({ y: 232, h: 48 });
    expect(layoutPauseMenu(48 / 40)[0]!.h).toBe(40);
    expect(layoutPauseMenu(1.44)[0]!.h).toBe(34); // ceil(33.33): 34 game px are at least 48 CSS px
    // The 844 x 390 phone: the canvas is fit to its height, 1.444 CSS px per game px.
    expect(layoutPauseMenu(390 / 270).map((r) => [r.y, r.h])).toEqual([[136, 34], [170, 34], [204, 34]]);
  });

  it('a point picks the row it is on, edges as the touch buttons', () => {
    const rows = layoutPauseMenu(2);
    expect(pauseMenuItemAt(rows, 160, 136)).toBe('resume');
    expect(pauseMenuItemAt(rows, 319, 163)).toBe('resume');
    expect(pauseMenuItemAt(rows, 320, 150)).toBeNull();
    expect(pauseMenuItemAt(rows, 200, 164)).toBe('settings');
    expect(pauseMenuItemAt(rows, 200, 191)).toBe('settings');
    expect(pauseMenuItemAt(rows, 200, 192)).toBe('quit');
    expect(pauseMenuItemAt(rows, 200, 219)).toBe('quit');
    expect(pauseMenuItemAt(rows, 200, 220)).toBeNull();
    expect(pauseMenuItemAt(rows, 159, 150)).toBeNull();
    expect(pauseMenuItemAt(rows, 200, 135)).toBeNull();
  });

  it('the rows never overlap a touch button or the pause button, and stay below "Paused" and inside the screen', () => {
    for (const css of [1.1, 1.2, 1.44, 1.6, 2, 3]) {
      const rows = layoutPauseMenu(css);
      for (const mode of ['buttons', 'stick'] as const) {
        for (const fuego of [false, true]) {
          for (const b of layoutTouchButtons(css, mode, fuego)) {
            for (const r of rows) {
              const apart = r.x + r.w <= b.x || b.x + b.w <= r.x || r.y + r.h <= b.y || b.y + b.h <= r.y;
              expect(apart, `css ${css} ${mode} fuego ${fuego}: ${r.item} row against ${b.id}`).toBe(true);
            }
          }
        }
      }
      for (const r of rows) {
        expect(r.y).toBeGreaterThanOrEqual(136);
        expect(r.y + r.h).toBeLessThanOrEqual(270);
      }
    }
  });
});

describe('GDD-UI-02 title menu rows', () => {
  it('GDD-UI-02 three rows, Start, Tutorial and Settings, 160 by 28, centred, the first at 160', () => {
    expect(layoutTitleMenu(2)).toEqual([
      { item: 'start', x: 160, y: 160, w: 160, h: 28 },
      { item: 'tutorial', x: 160, y: 188, w: 160, h: 28 },
      { item: 'settings', x: 160, y: 216, w: 160, h: 28 },
    ]);
  });

  it('GDD-UI-02 on a landscape phone the three title rows grow to 34 px and end above the screen\'s bottom', () => {
    const rows = layoutTitleMenu(390 / 270);
    expect(rows.map((r) => [r.y, r.h])).toEqual([[160, 34], [194, 34], [228, 34]]);
    const last = rows[2]!;
    expect(last.y + last.h).toBe(262);
    expect(last.y + last.h).toBeLessThanOrEqual(270);
  });

  it('on a small screen the rows grow to 48 CSS px', () => {
    expect(layoutTitleMenu(1).map((r) => [r.y, r.h])).toEqual([[160, 48], [208, 48], [256, 48]]);
  });

  it('a point picks the row it is on, edges as the touch buttons', () => {
    const rows = layoutTitleMenu(2);
    expect(titleMenuItemAt(rows, 160, 160)).toBe('start');
    expect(titleMenuItemAt(rows, 319, 187)).toBe('start');
    expect(titleMenuItemAt(rows, 320, 170)).toBeNull();
    expect(titleMenuItemAt(rows, 159, 170)).toBeNull();
    expect(titleMenuItemAt(rows, 200, 159)).toBeNull();
    expect(titleMenuItemAt(rows, 200, 188)).toBe('tutorial');
    expect(titleMenuItemAt(rows, 200, 215)).toBe('tutorial');
    expect(titleMenuItemAt(rows, 200, 216)).toBe('settings');
    expect(titleMenuItemAt(rows, 200, 243)).toBe('settings');
    expect(titleMenuItemAt(rows, 200, 244)).toBeNull();
  });

  it('titleMenuItemAt finds \'tutorial\' in its row', () => {
    expect(titleMenuItemAt(layoutTitleMenu(390 / 270), 240, 210)).toBe('tutorial');
  });
});

describe('GDD-UI-02 results menu rows', () => {
  it('GDD-UI-02 three rows, Next level, Retry and Quit to title, 160 by 28, centred, the first at 162', () => {
    expect(layoutResultsMenu(2)).toEqual([
      { item: 'next', x: 160, y: 162, w: 160, h: 28 },
      { item: 'retry', x: 160, y: 190, w: 160, h: 28 },
      { item: 'quit', x: 160, y: 218, w: 160, h: 28 },
    ]);
  });

  it('GDD-UI-02 on a landscape phone the three results rows grow to 34 px and end above the screen\'s bottom', () => {
    const rows = layoutResultsMenu(390 / 270);
    expect(rows.map((r) => [r.y, r.h])).toEqual([[162, 34], [196, 34], [230, 34]]);
    expect(rows[2]!.y + rows[2]!.h).toBeLessThanOrEqual(270);
    expect(layoutResultsMenu(1).map((r) => [r.y, r.h])).toEqual([[162, 48], [210, 48], [258, 48]]);
  });

  it('GDD-UI-02 a point picks the results row it is on, edges as the touch buttons', () => {
    const rows = layoutResultsMenu(2);
    expect(resultsMenuItemAt(rows, 160, 162)).toBe('next');
    expect(resultsMenuItemAt(rows, 319, 189)).toBe('next');
    expect(resultsMenuItemAt(rows, 320, 170)).toBeNull();
    expect(resultsMenuItemAt(rows, 159, 170)).toBeNull();
    expect(resultsMenuItemAt(rows, 200, 161)).toBeNull();
    expect(resultsMenuItemAt(rows, 200, 190)).toBe('retry');
    expect(resultsMenuItemAt(rows, 200, 217)).toBe('retry');
    expect(resultsMenuItemAt(rows, 200, 218)).toBe('quit');
    expect(resultsMenuItemAt(rows, 200, 245)).toBe('quit');
    expect(resultsMenuItemAt(rows, 200, 246)).toBeNull();
  });
});
