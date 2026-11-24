import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OUTLINE } from './enemies1/kit.mjs';
import { BOX, COLD_FLAME, COLUMNS, drawDigits, drawFrames, drawLook, drawPlumeFrames, FRAME, LAMPS, LOOKS, PLUME, STUD_TOP, STUDS, W3 } from './catorce.mjs';
import { CATORCE_ART } from '../../src/config/tuning';
import { CATORCE_LOOKS } from '../../src/ui/catorceLooks';
import { buildCatorce } from './make-catorce.mjs';

// GDD-BOS-04: La Catorce's sprite, drawn by scripts/art/catorce.mjs as the user approved it (user, 2026-11-22: "Approve"; her cold flame, "Yes,
// this blue-green"; assets/characters/la-catorce/). The drawing is pinned by the committed PNGs' bytes; the checks below state what the game
// relies on, each measured on the approved drawing (L-072).
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'assets', 'sprites', 'boss');
const out = (s) => process.stdout.write(`${s}\n`);

// Drawing the frames takes seconds, so they are drawn once.
const FRAMES = drawFrames();
const frame = (look, left = false) => FRAMES.find((f) => f.look === look && f.left === left).grid;

/** The painted extent of a grid: its first and last painted column and row. */
function extent(grid) {
  let [x0, x1, y0, y1] = [Infinity, -1, Infinity, -1];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get(x, y) === null) continue;
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    }
  }
  return { x0, x1, y0, y1 };
}

/** CIE L*a*b* (D65) of a colour (as `scripts/art/mercado.test.mjs` measures it). */
function lab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** CIE76: the distance between two colours in L*a*b*. */
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

/** Her body moved on her springs in a look (drawing px down), her wheels staying on the rail: hurt 1, the wreck 3, the rest none. */
const SAG = { rest3: 0, rest2: 0, spin1_0: 0, spinRed3_0: 0, hurtWhite2: 1, wreck: 3 };
/** The colour at each hit lamp's middle + (1, 1), rear to front, in a look facing right: inside the flame, clear of its mist glint. */
const lampsOf = (look) => LAMPS.map(([x, y]) => frame(look).get(BOX.x0 + x + 1, BOX.y0 + y + 1 + SAG[look]));

describe('GDD-BOS-04 La Catorce art', { timeout: 120_000 }, () => {
  it('GDD-BOS-04 art sheet: the committed PNGs are the ones the script makes, the sheet under the phone\'s texture limit', () => {
    const built = buildCatorce();
    expect(Object.keys(built).sort()).toEqual(['catorce-plume.png', 'la-catorce.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
    // A PNG's width and height are the IHDR's first two words.
    const size = (bytes) => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    // 8 columns of 7 rows facing right over 7 facing left, each frame 288 x 144 art px (72 x 36 game px).
    expect(size(built['la-catorce.png'])).toEqual([2304, 2016]);
    expect(Math.max(...size(built['la-catorce.png']))).toBeLessThanOrEqual(4096); // L-068
    expect(size(built['catorce-plume.png'])).toEqual([48, 40]); // two frames of 24 x 40 art px: 6 x 10 game px
    expect(LOOKS).toHaveLength(49);
    expect(new Set(LOOKS).size).toBe(49);
    expect(FRAMES).toHaveLength(98);
  });

  it('GDD-BOS-04 art looks: the game loads her sheet as the art makes it, CATORCE_ART and the looks agree with the drawing', () => {
    expect(CATORCE_LOOKS).toEqual(LOOKS);
    expect([CATORCE_ART.frameW, CATORCE_ART.frameH]).toEqual([FRAME.w / 2, FRAME.h / 2]);
    expect([CATORCE_ART.boxX, CATORCE_ART.boxY]).toEqual([BOX.x0 / 2, BOX.y0 / 2]);
    expect([CATORCE_ART.columns, CATORCE_ART.looks]).toEqual([COLUMNS, LOOKS.length]);
    expect([CATORCE_ART.plume.w, CATORCE_ART.plume.h]).toEqual([PLUME.w / 2, PLUME.h / 2]);
    // The plume stands over her middle stud: 3 drawing px wide from STUDS[1] - 1, its middle measured from her box's (L-003), its foot
    // on the stud's top row.
    expect(CATORCE_ART.plume.ahead).toBe((STUDS[1] - 1 + 3 / 2 - (BOX.x1 - BOX.x0) / 2) / 2);
    expect(CATORCE_ART.plume.rise).toBe(STUD_TOP / 2);
  });

  // L-059: how far each frame of assets/sprites/boss/la-catorce.png reaches past her 64 x 32 box (drawing px 8 to 135 across, 8 to 71 down),
  // measured on the approved drawing; src/levels/level3-4.sprite.test.ts fits them over the fight.
  it('GDD-BOS-04 art box: every frame inside her box but the slam\'s squash, 1 game px ahead, her wheels on its bottom row', () => {
    expect(FRAME).toEqual({ w: 144, h: 72 });
    expect(BOX).toEqual({ x0: 8, y0: 8, x1: 136, y1: 72 });
    for (const { look, left, grid } of FRAMES) {
      const e = extent(grid);
      const name = `${look} ${left ? 'left' : 'right'}`;
      // Her slam moves her body 1 game px forward; her cowcatcher stops 1 drawing px short of her box's front, so the squash reaches 1
      // drawing px past it (column 135 facing right, 8 facing left).
      const ahead = look.startsWith('slam');
      if (ahead && !left) expect([e.x0 >= 8, e.x1], name).toEqual([true, 136]);
      else if (ahead) expect([e.x0, e.x1 <= 135], name).toEqual([7, true]);
      else expect([e.x0 >= 8, e.x1 <= 135], name).toEqual([true, true]);
      expect(e.y0, name).toBeGreaterThanOrEqual(8);
      // Her wheels' outline is on her box's bottom row (the floor's top is under it).
      expect(e.y1, name).toBe(71);
      expect([...Array(FRAME.w).keys()].some((x) => grid.get(x, 71) === OUTLINE), `${name} wheels`).toBe(true);
      // Nothing touches the frame's edges.
      expect([e.x0 > 0, e.x1 < 143, e.y0 > 0], name).toEqual([true, true, true]);
    }
  });

  it('GDD-BOS-04 art colours: World 3\'s colours, the outline, the flash reds and her cold flame, far from the sky, the mist and the steel', () => {
    const used = new Set(FRAMES.flatMap(({ grid }) => grid.cells.filter((c) => c !== null)));
    const want = ['#070509', '#93A0AE', '#221D2E', '#353A48', '#EEF1EA', '#EDCB86', '#F0A23A', '#3D3650', '#9A6A2C', '#2E9E96', '#63E6C4', '#D8473A', '#A0472F', '#5A3B28'];
    expect([...used].sort()).toEqual([...want].sort());
    expect(COLD_FLAME).toBe('#63E6C4');
    // GDD-ART-06: the cold flame stands out from the mist, the steel and the three sky bands of World 3, and from Poncho's blue (GDD-ART-03).
    const against = { mist: '#EEF1EA', steel: '#93A0AE', 'sky top': '#527391', 'sky middle': '#8AA5B8', 'sky horizon': '#BFCDD2', "Poncho's blue": '#3F66B1' };
    const figures = Object.entries(against).map(([name, c]) => [name, c, deltaE(COLD_FLAME, c)]);
    out(`GDD-BOS-04 cold flame ${COLD_FLAME}, CIE76 against ${figures.map(([name, c, d]) => `${name} ${c} ${d.toFixed(1)}`).join(', ')}`);
    for (const [name, c, d] of figures) expect(d, `${name} ${c}`).toBeGreaterThanOrEqual(12);
  });

  it('GDD-BOS-04 art lamps: three, two, one, none lit, the front one out first, the flame lit through both flashes', () => {
    const lit = (look) => lampsOf(look).map((c) => c === COLD_FLAME);
    expect(lit('rest3')).toEqual([true, true, true]);
    expect(lit('rest2')).toEqual([true, true, false]);
    expect(lit('spin1_0')).toEqual([true, false, false]);
    expect(lit('wreck')).toEqual([false, false, false]);
    // The red and the white flash recolour her, not the cold flame.
    expect(lampsOf('spinRed3_0')).toEqual([COLD_FLAME, COLD_FLAME, COLD_FLAME]);
    expect(lampsOf('hurtWhite2').slice(0, 2)).toEqual([COLD_FLAME, COLD_FLAME]);
  });

  it('GDD-BOS-04 art left: facing left is the mirror image but for her plate\'s 14, which reads the same both ways', () => {
    const right = frame('rest3');
    const left = drawLook('rest3', true);
    const digits = drawDigits();
    // The digits' place: 9 x 7 drawing px at x 22, y 40 facing right; mirrored, at x 144 - 22 - 9 = 113.
    const place = { x: 113, y: 40, w: 9, h: 7 };
    const inPlace = (x, y) => x >= place.x && x < place.x + place.w && y >= place.y && y < place.y + place.h;
    const off = [];
    for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) if (!inPlace(x, y) && left.get(x, y) !== right.get(FRAME.w - 1 - x, y)) off.push(`${x},${y}`);
    expect(off).toEqual([]);
    // There, the digits unmirrored, as facing right, on the plate's lamp amber.
    for (let j = 0; j < place.h; j++) {
      for (let i = 0; i < place.w; i++) {
        const d = digits.get(i, j);
        expect(left.get(place.x + i, place.y + j), `${i},${j}`).toBe(d ?? W3.lampAmber);
        if (d) expect(right.get(22 + i, place.y + j), `right ${i},${j}`).toBe(d);
      }
    }
    // The wreck has lost her plate: an exact mirror.
    const wreck = frame('wreck');
    const wreckLeft = frame('wreck', true);
    const differ = [];
    for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) if (wreckLeft.get(x, y) !== wreck.get(FRAME.w - 1 - x, y)) differ.push(`${x},${y}`);
    expect(differ).toEqual([]);
  });

  it('GDD-BOS-04 art studs: three mist white studs close together on her boiler\'s top, the mark that she cannot be stomped', () => {
    // GDD-CMB-01: the not-stompable mark.
    expect([STUDS, STUD_TOP]).toEqual([[61, 66, 71], 8]);
    for (const x of [61, 66, 71]) expect(frame('rest3').get(BOX.x0 + x, BOX.y0 + STUD_TOP + 1), `stud ${x}`).toBe('#EEF1EA');
  });

  it('GDD-BOS-04 art plume: two frames of 12 by 20, mist and steel only, not outlined, its foot on the bottom row', () => {
    const plume = drawPlumeFrames();
    expect(plume).toHaveLength(2);
    for (const [k, g] of plume.entries()) {
      expect([g.width, g.height], `frame ${k}`).toEqual([12, 20]);
      expect([...new Set(g.cells.filter((c) => c !== null))].sort(), `frame ${k}`).toEqual(['#93A0AE', '#EEF1EA']);
      expect(extent(g).y1, `frame ${k}`).toBe(19);
    }
    expect(plume[0].cells.some((c, i) => c !== plume[1].cells[i])).toBe(true);
  });
});
