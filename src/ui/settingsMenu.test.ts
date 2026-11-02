import { describe, expect, it } from 'vitest';
import { SETTINGS_MENU } from '../config/tuning';
import { languageValueX, layoutSettingsMenu, settingsTapAt, volumeBars } from './settingsMenu';

describe('GDD-UI-02 settings rows', () => {
  it('six rows, Master volume, Effects volume, Language, Button opacity, Layout and Back, 260 by 28, centred, the first at 62, each next right below', () => {
    expect(layoutSettingsMenu(2)).toEqual([
      { item: 'master', x: 110, y: 62, w: 260, h: 28 },
      { item: 'effects', x: 110, y: 90, w: 260, h: 28 },
      { item: 'language', x: 110, y: 118, w: 260, h: 28 },
      { item: 'buttonOpacity', x: 110, y: 146, w: 260, h: 28 },
      { item: 'layout', x: 110, y: 174, w: 260, h: 28 },
      { item: 'back', x: 110, y: 202, w: 260, h: 28 },
    ]);
  });

  it('on a small screen the rows grow to 48 CSS px', () => {
    expect(layoutSettingsMenu(390 / 270).map((r) => [r.item, r.y, r.h])).toEqual([['master', 62, 34], ['effects', 96, 34], ['language', 130, 34], ['buttonOpacity', 164, 34], ['layout', 198, 34], ['back', 232, 34]]);
    expect(layoutSettingsMenu(1).map((r) => [r.y, r.h])).toEqual([[62, 48], [110, 48], [158, 48], [206, 48], [254, 48], [302, 48]]);
  });
});

describe('GDD-UI-02 a tap on a settings row picks its half', () => {
  const rows = layoutSettingsMenu(2);

  it('the left half up to the middle, the right half from it, and nothing outside', () => {
    expect(settingsTapAt(rows, 110, 66)).toEqual({ row: 'master', side: 'left' });
    expect(settingsTapAt(rows, 239.9, 66)).toEqual({ row: 'master', side: 'left' });
    expect(settingsTapAt(rows, 240, 66)).toEqual({ row: 'master', side: 'right' });
    expect(settingsTapAt(rows, 369.9, 66)).toEqual({ row: 'master', side: 'right' });
    expect(settingsTapAt(rows, 370, 66)).toBeNull();
    expect(settingsTapAt(rows, 109.9, 66)).toBeNull();
  });

  it('the row is the one under the point, its top edge in and its bottom edge out', () => {
    expect(settingsTapAt(rows, 200, 90)).toEqual({ row: 'effects', side: 'left' });
    expect(settingsTapAt(rows, 300, 117.9)).toEqual({ row: 'effects', side: 'right' });
    expect(settingsTapAt(rows, 300, 118)).toEqual({ row: 'language', side: 'right' });
    expect(settingsTapAt(rows, 300, 146)).toEqual({ row: 'buttonOpacity', side: 'right' });
    expect(settingsTapAt(rows, 300, 174)).toEqual({ row: 'layout', side: 'right' });
    expect(settingsTapAt(rows, 200, 174)).toEqual({ row: 'layout', side: 'left' });
    expect(settingsTapAt(rows, 300, 202)).toEqual({ row: 'back', side: 'right' });
    expect(settingsTapAt(rows, 200, 61.9)).toBeNull();
    expect(settingsTapAt(rows, 200, 230)).toBeNull();
  });
});

describe('GDD-UI-02 volume bars', () => {
  const row = { item: 'master', x: 110, y: 62, w: 260, h: 28 } as const;

  it('ten bars 5 px wide and 2 px apart, the last ending 20 px inside the row, 10 px tall and centred in it', () => {
    const bars = volumeBars(row, 3);
    expect(bars).toHaveLength(10);
    expect(bars[0]).toMatchObject({ x: 282, y: 71, w: 5, h: 10 });
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
  it('six rows, language third, Button opacity fourth, Layout fifth', () => {
    const rows = layoutSettingsMenu(2);
    expect(rows.map((r) => r.item)).toEqual(['master', 'effects', 'language', 'buttonOpacity', 'layout', 'back']);
    expect(rows[2]!.y).toBe(118);
    expect(rows[3]!.y).toBe(146);
    expect(rows[4]!.y).toBe(174);
    expect(rows[5]!.y).toBe(202);
    expect(rows.every((r) => r.x === 110 && r.w === 260 && r.h === 28)).toBe(true);
  });

  it('on a landscape phone the six rows grow to 34 px and end at 266', () => {
    const rows = layoutSettingsMenu(390 / 270);
    expect(rows.every((r) => r.h === 34)).toBe(true);
    expect(rows[0]!.y).toBe(62);
    expect(rows[2]!.y).toBe(130);
    expect(rows[5]!.y).toBe(232);
    expect(rows[5]!.y + rows[5]!.h).toBe(266);
  });

  it('the language name is centred where the bars are', () => {
    const row = layoutSettingsMenu(2)[2]!;
    expect(languageValueX(row)).toBe(316);
    const bars = volumeBars(row, 0);
    expect(languageValueX(row)).toBe((bars[0]!.x + bars[9]!.x + bars[9]!.w) / 2);
    // It follows the row.
    expect(languageValueX({ ...row, x: 100 })).toBe(306);
  });

  it('on a desktop the six rows end at 230', () => {
    const rows = layoutSettingsMenu(2);
    expect(rows[5]!.y + rows[5]!.h).toBe(230);
  });

  it("a tap on the language row's halves", () => {
    const rows = layoutSettingsMenu(2);
    expect(settingsTapAt(rows, 239, 126)).toEqual({ row: 'language', side: 'left' });
    expect(settingsTapAt(rows, 240, 126)).toEqual({ row: 'language', side: 'right' });
  });
});

describe('GDD-UI-02 the settings title makes room for the sixth row', () => {
  it('the title stands at 44, above the first row at 62', () => {
    expect(SETTINGS_MENU.titleY).toBe(44);
    expect(SETTINGS_MENU.top).toBe(62);
    expect(layoutSettingsMenu(2)[0]!.y).toBe(62);
  });
});
