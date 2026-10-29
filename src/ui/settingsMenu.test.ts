import { describe, expect, it } from 'vitest';
import { languageValueX, layoutSettingsMenu, settingsTapAt, volumeBars } from './settingsMenu';

describe('GDD-UI-02 settings rows', () => {
  it('four rows, Master volume, Effects volume, Language and Back, 260 by 28, centred, the first at 96, each next right below', () => {
    expect(layoutSettingsMenu(2)).toEqual([
      { item: 'master', x: 110, y: 96, w: 260, h: 28 },
      { item: 'effects', x: 110, y: 124, w: 260, h: 28 },
      { item: 'language', x: 110, y: 152, w: 260, h: 28 },
      { item: 'back', x: 110, y: 180, w: 260, h: 28 },
    ]);
  });

  it('on a small screen the rows grow to 48 CSS px', () => {
    expect(layoutSettingsMenu(390 / 270).map((r) => [r.item, r.y, r.h])).toEqual([['master', 96, 34], ['effects', 130, 34], ['language', 164, 34], ['back', 198, 34]]);
    expect(layoutSettingsMenu(1).map((r) => [r.y, r.h])).toEqual([[96, 48], [144, 48], [192, 48], [240, 48]]);
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
    expect(settingsTapAt(rows, 300, 152)).toEqual({ row: 'language', side: 'right' });
    expect(settingsTapAt(rows, 300, 180)).toEqual({ row: 'back', side: 'right' });
    expect(settingsTapAt(rows, 200, 95.9)).toBeNull();
    expect(settingsTapAt(rows, 200, 208)).toBeNull();
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

describe('GDD-UI-02 settings menu with the language row', () => {
  it('four rows, language third', () => {
    const rows = layoutSettingsMenu(2);
    expect(rows.map((r) => r.item)).toEqual(['master', 'effects', 'language', 'back']);
    expect(rows[2]!.y).toBe(152);
    expect(rows[3]!.y).toBe(180);
    expect(rows.every((r) => r.x === 110 && r.w === 260 && r.h === 28)).toBe(true);
  });

  it('on a landscape phone the four rows grow to 34 px and end at 232', () => {
    const rows = layoutSettingsMenu(390 / 270);
    expect(rows.every((r) => r.h === 34)).toBe(true);
    expect(rows[2]!.y).toBe(164);
    expect(rows[3]!.y).toBe(198);
    expect(rows[3]!.y + rows[3]!.h).toBe(232);
  });

  it('the language name is centred where the bars are', () => {
    const row = layoutSettingsMenu(2)[2]!;
    expect(languageValueX(row)).toBe(316);
    const bars = volumeBars(row, 0);
    expect(languageValueX(row)).toBe((bars[0]!.x + bars[9]!.x + bars[9]!.w) / 2);
    // It follows the row.
    expect(languageValueX({ ...row, x: 100 })).toBe(306);
  });

  it("a tap on the language row's halves", () => {
    const rows = layoutSettingsMenu(2);
    expect(settingsTapAt(rows, 239, 160)).toEqual({ row: 'language', side: 'left' });
    expect(settingsTapAt(rows, 240, 160)).toEqual({ row: 'language', side: 'right' });
  });
});
