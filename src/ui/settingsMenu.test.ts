import { describe, expect, it } from 'vitest';
import { layoutSettingsMenu, settingsTapAt, volumeBars } from './settingsMenu';

describe('GDD-UI-02 settings rows', () => {
  it('three rows, Master volume, Effects volume and Back, 260 by 28, centred, the first at 96, each next right below', () => {
    expect(layoutSettingsMenu(2)).toEqual([
      { item: 'master', x: 110, y: 96, w: 260, h: 28 },
      { item: 'effects', x: 110, y: 124, w: 260, h: 28 },
      { item: 'back', x: 110, y: 152, w: 260, h: 28 },
    ]);
  });

  it('on a small screen the rows grow to 48 CSS px', () => {
    expect(layoutSettingsMenu(390 / 270).map((r) => [r.item, r.y, r.h])).toEqual([['master', 96, 34], ['effects', 130, 34], ['back', 164, 34]]);
    expect(layoutSettingsMenu(1).map((r) => [r.y, r.h])).toEqual([[96, 48], [144, 48], [192, 48]]);
  });
});

describe('GDD-UI-02 a tap on a settings row picks its half', () => {
  const rows = layoutSettingsMenu(2);

  it('the left half up to the middle, the right half from it, and nothing outside', () => {
    expect(settingsTapAt(rows, 110, 100)).toEqual({ row: 'master', side: 'left' });
    expect(settingsTapAt(rows, 239.9, 100)).toEqual({ row: 'master', side: 'left' });
    expect(settingsTapAt(rows, 240, 100)).toEqual({ row: 'master', side: 'right' });
    expect(settingsTapAt(rows, 369.9, 100)).toEqual({ row: 'master', side: 'right' });
    expect(settingsTapAt(rows, 370, 100)).toBeNull();
    expect(settingsTapAt(rows, 109.9, 100)).toBeNull();
  });

  it('the row is the one under the point, its top edge in and its bottom edge out', () => {
    expect(settingsTapAt(rows, 200, 124)).toEqual({ row: 'effects', side: 'left' });
    expect(settingsTapAt(rows, 300, 151.9)).toEqual({ row: 'effects', side: 'right' });
    expect(settingsTapAt(rows, 300, 152)).toEqual({ row: 'back', side: 'right' });
    expect(settingsTapAt(rows, 200, 95.9)).toBeNull();
    expect(settingsTapAt(rows, 200, 180)).toBeNull();
  });
});

describe('GDD-UI-02 volume bars', () => {
  const row = { item: 'master', x: 110, y: 96, w: 260, h: 28 } as const;

  it('ten bars 5 px wide and 2 px apart, the last ending 20 px inside the row, 10 px tall and centred in it', () => {
    const bars = volumeBars(row, 3);
    expect(bars).toHaveLength(10);
    expect(bars[0]).toMatchObject({ x: 282, y: 105, w: 5, h: 10 });
    expect(bars[1]!.x).toBe(289);
    expect(bars[9]).toMatchObject({ x: 345, w: 5 });
    expect(bars[9]!.x + bars[9]!.w).toBe(350);
  });

  it('as many bars filled as the value, the first ones', () => {
    expect(volumeBars(row, 3).map((b) => b.filled)).toEqual([true, true, true, false, false, false, false, false, false, false]);
    expect(volumeBars(row, 0).some((b) => b.filled)).toBe(false);
    expect(volumeBars(row, 10).every((b) => b.filled)).toBe(true);
  });

  it('they are centred in a taller row', () => {
    expect(volumeBars({ ...row, y: 130, h: 34 }, 5)[0]!.y).toBe(142);
  });
});
