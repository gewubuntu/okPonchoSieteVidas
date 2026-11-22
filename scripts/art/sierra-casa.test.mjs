import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCasa } from './make-sierra.mjs';
import { ARCHES, drawMidCasa, inArch, RODS, ROOF, SILL, SPRING } from './sierra-casa.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'sierra');

// GDD-ART-06: World 3's 24 colours, in the GDD's table's order, written here rather than read back from the script (L-011).
const GDD = [
  '#527391', '#8AA5B8', '#BFCDD2', '#EEF1EA', '#A9B8AC', '#7F9488', '#5B7067', '#24403A', '#3F6350', '#A3A85A', '#EDCB86', '#CC983F', '#9A6A2C',
  '#5A3B28', '#A89480', '#75614F', '#43362F', '#93A0AE', '#353A48', '#B0562E', '#221D2E', '#3D3650', '#5C5269', '#F0A23A',
];
const TIMBER_DARK = '#43362F', GALLERY_DEEP = '#221D2E', GALLERY_BASE = '#3D3650', IRON_DARK = '#353A48', STEEL = '#93A0AE', PEAK_SHADE = '#5B7067';
const NEAR_BLACK = '#070509';
/** The colours the back wall uses, measured on the approved drawing (L-072). */
const CASA_COLOURS = ['#43362F', '#221D2E', '#A89480', '#75614F', '#353A48', '#5B7067', '#7F9488', '#93A0AE', '#A9B8AC', '#EEF1EA', '#3D3650', '#5A3B28'];

const painted = (grid) => new Set(grid.cells.filter((c) => c !== null));
/** The art pixels that differ from the top left pixel of their 4 x 4 game pixel. */
const offGrid = (grid) => {
  const off = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) !== grid.get(x - (x % 4), y - (y % 4))) off.push(`${x},${y}`);
  return off;
};
// The wall is one screen from game y 0: the colour of game pixel (x, y) is its art pixel (4 x, 4 y).
const at = (grid) => (x, y) => grid.get(x * 4, y * 4);

describe('GDD-ART-06 the engine shed back wall', () => {
  const grid = drawMidCasa();
  const px = at(grid);

  it('GDD-ART-06 casa file: mid-casa.png is what the drawing gives, 1920 x 896', () => {
    const built = buildCasa();
    expect(Object.keys(built)).toEqual(['mid-casa.png']);
    expect(built['mid-casa.png'].equals(readFileSync(join(dir, 'mid-casa.png')))).toBe(true);
    // The screen's width from game y 0 to the floor's top at 224, at 4 art px per game px; under 4096 on a side (L-068).
    expect([grid.width, grid.height]).toEqual([1920, 896]);
  });

  it('GDD-ART-03 casa colours: twelve of World 3\'s 24, no outline', () => {
    const used = painted(grid);
    expect(used).toEqual(new Set(CASA_COLOURS));
    for (const c of used) expect(GDD, c).toContain(c);
    expect(used.has(NEAR_BLACK)).toBe(false);
  });

  it('GDD-ART-06 casa whole pixels: drawn in 4 x 4 art pixels', () => {
    expect(offGrid(grid)).toEqual([]);
  });

  it('GDD-ART-06 casa arches: see-through only in the three openings, above the sill', () => {
    // Every see-through game pixel lies in an opening (`inArch`), and an opening's painted pixels are only the reveal's peak shade and, in
    // the middle opening, the gantry's two rods: measured (L-072), 25665 see-through, 883 of reveal and 188 of rod.
    expect(ARCHES).toEqual([[60, 140], [200, 280], [340, 420]]);
    expect([SILL, SPRING]).toEqual([184, 104]);
    let see = 0, reveal = 0, rod = 0;
    const stray = [];
    for (let y = 0; y < 224; y++) {
      for (let x = 0; x < 480; x++) {
        const c = px(x, y);
        if (c === null) {
          see++;
          if (!inArch(x, y) || y >= SILL) stray.push(`${x},${y} see-through`);
        } else if (inArch(x, y)) {
          if (c === PEAK_SHADE) reveal++;
          else if (RODS.includes(x) && (c === IRON_DARK || c === STEEL)) rod++;
          else stray.push(`${x},${y} ${c}`);
        }
      }
    }
    expect(stray).toEqual([]);
    expect([see, reveal, rod]).toEqual([25665, 883, 188]);
    // At the springing line each opening is see-through from 2 px in (the reveal's shade on its left) to its last column, but for the
    // rods crossing the middle one.
    for (const [x0, x1] of ARCHES) {
      const open = Array.from({ length: 480 }, (_, x) => x).filter((x) => x >= x0 - 4 && x < x1 + 4 && px(x, SPRING) === null);
      const want = Array.from({ length: x1 - x0 - 2 }, (_, i) => x0 + 2 + i).filter((x) => !RODS.includes(x));
      expect(open, `arch ${x0}`).toEqual(want);
    }
  });

  it('GDD-BOS-04 casa behind her: no dark patch behind the black engine in her rows 192 to 223', () => {
    // Her box's rows, over the whole width: none of gallery deep, gallery base or iron dark (measured: 0).
    const dark = [];
    for (let y = 192; y < 224; y++) for (let x = 0; x < 480; x++) if ([GALLERY_DEEP, GALLERY_BASE, IRON_DARK].includes(px(x, y))) dark.push(`${x},${y} ${px(x, y)}`);
    expect(dark).toEqual([]);
  });

  it('GDD-UI-01 casa behind the HUD: rows 0 to 21 are the plain boards, timber dark and gallery deep', () => {
    // Down to the truss's top chord (`ROOF.bottom - 18`, row 22, timber lit), the HUD lies on plain boards (measured, L-072).
    expect(ROOF.bottom - 18).toBe(22);
    const above = new Set();
    for (let y = 0; y < 22; y++) for (let x = 0; x < 480; x++) above.add(px(x, y));
    expect(above).toEqual(new Set([TIMBER_DARK, GALLERY_DEEP]));
  });

  it('GDD-BOS-04 casa rods: two iron rods from the tie beam to above home', () => {
    // Columns 227 and 252, from row 45 (`ROOF.bottom + ROOF.beam`, under the tie beam) to row 159, iron dark with steel glints; row 160,
    // home's top, is the middle opening's see-through (measured: null).
    expect(RODS).toEqual([227, 252]);
    expect(ROOF.bottom + ROOF.beam).toBe(45);
    for (const x of RODS) {
      for (let y = 45; y <= 159; y++) expect([IRON_DARK, STEEL], `${x},${y}`).toContain(px(x, y));
      expect(px(x, 160), `${x},160`).toBe(null);
    }
  });
});
