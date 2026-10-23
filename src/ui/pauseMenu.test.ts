import { describe, expect, it } from 'vitest';
import { layoutTouchButtons } from './touchLayout';
import { layoutPauseMenu, pauseMenuItemAt } from './pauseMenu';

describe('GDD-UI-02 pause menu rows', () => {
  it('two rows, Resume then Quit to title, 160 by 28, centred, the first at 136, the second right below', () => {
    expect(layoutPauseMenu(2)).toEqual([
      { item: 'resume', x: 160, y: 136, w: 160, h: 28 },
      { item: 'quit', x: 160, y: 164, w: 160, h: 28 },
    ]);
  });

  it('on a small screen the rows grow to 48 CSS px', () => {
    const [resume, quit] = layoutPauseMenu(1);
    expect(resume.h).toBe(48);
    expect(quit).toMatchObject({ y: 184, h: 48 });
    expect(layoutPauseMenu(48 / 40)[0].h).toBe(40);
    expect(layoutPauseMenu(1.44)[0].h).toBe(34); // ceil(33.33): 34 virtual px are at least 48 CSS px
  });

  it('a point picks the row it is on, edges as the touch buttons', () => {
    const rows = layoutPauseMenu(2);
    expect(pauseMenuItemAt(rows, 160, 136)).toBe('resume');
    expect(pauseMenuItemAt(rows, 319, 163)).toBe('resume');
    expect(pauseMenuItemAt(rows, 320, 150)).toBeNull();
    expect(pauseMenuItemAt(rows, 200, 164)).toBe('quit');
    expect(pauseMenuItemAt(rows, 200, 191)).toBe('quit');
    expect(pauseMenuItemAt(rows, 200, 192)).toBeNull();
    expect(pauseMenuItemAt(rows, 159, 150)).toBeNull();
    expect(pauseMenuItemAt(rows, 200, 135)).toBeNull();
  });

  it('the rows never overlap a touch button or the pause button, and stay below "Paused" and inside the screen', () => {
    for (const css of [1, 1.1, 1.2, 1.44, 1.6, 2, 3]) {
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
