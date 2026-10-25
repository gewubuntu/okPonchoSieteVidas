import { describe, expect, it } from 'vitest';
import { layoutTouchButtons } from './touchLayout';
import { layoutPauseMenu, layoutTitleMenu, pauseMenuItemAt, titleMenuItemAt } from './pauseMenu';

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
    expect(layoutPauseMenu(1.44)[0]!.h).toBe(34); // ceil(33.33): 34 virtual px are at least 48 CSS px
    // The 844 x 390 phone: the canvas is fit to its height, 1.444 CSS px per virtual px.
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
  it('two rows, Start and Settings, 160 by 28, centred, the first at 176, the second right below', () => {
    expect(layoutTitleMenu(2)).toEqual([
      { item: 'start', x: 160, y: 176, w: 160, h: 28 },
      { item: 'settings', x: 160, y: 204, w: 160, h: 28 },
    ]);
  });

  it('on a small screen the rows grow to 48 CSS px', () => {
    expect(layoutTitleMenu(1).map((r) => [r.y, r.h])).toEqual([[176, 48], [224, 48]]);
    expect(layoutTitleMenu(390 / 270).map((r) => [r.y, r.h])).toEqual([[176, 34], [210, 34]]);
  });

  it('a point picks the row it is on, edges as the touch buttons', () => {
    const rows = layoutTitleMenu(2);
    expect(titleMenuItemAt(rows, 160, 176)).toBe('start');
    expect(titleMenuItemAt(rows, 319, 203)).toBe('start');
    expect(titleMenuItemAt(rows, 320, 190)).toBeNull();
    expect(titleMenuItemAt(rows, 159, 190)).toBeNull();
    expect(titleMenuItemAt(rows, 200, 175)).toBeNull();
    expect(titleMenuItemAt(rows, 200, 204)).toBe('settings');
    expect(titleMenuItemAt(rows, 200, 231)).toBe('settings');
    expect(titleMenuItemAt(rows, 200, 232)).toBeNull();
  });
});
