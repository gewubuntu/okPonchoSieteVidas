import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SIERRA } from '../../src/config/tuning';
import { SLOPE_CHARS, SLOPE_HEIGHTS } from '../../src/sim/tilemap';
import {
  CLOUD_BOXES, DECOR_FRAME, DECOR_SIZES, drawCloudImages, drawClouds, drawDecor, drawFarBarranca, drawGround, drawLedge, drawMidBarranca, drawSky,
  drawSkyStrips, FAR, FOOT_COLOUR, MID, OUTLINE, SIERRA_PALETTE, SKY_ENDS, SLOPE_ORDER, slopeTopRow, STRIP,
} from './sierra.mjs';
import { buildSierra } from './make-sierra.mjs';
import { COLOURS as PONCHO } from './poncho-pixels.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'sierra');

// GDD-ART-06: World 3's 24 colours, in the GDD's table's order, written here rather than read back from the script (L-011).
const GDD = [
  '#527391', '#8AA5B8', '#BFCDD2', // sky top, sky middle, sky horizon
  '#EEF1EA', // mist white
  '#A9B8AC', '#7F9488', '#5B7067', // peak lit, peak base, peak shade
  '#24403A', '#3F6350', // pine deep, pine green
  '#A3A85A', // zacate
  '#EDCB86', '#CC983F', '#9A6A2C', // ochre light, ochre, ochre shade
  '#5A3B28', // rock deep
  '#A89480', '#75614F', '#43362F', // timber lit, timber, timber dark
  '#93A0AE', '#353A48', // steel, iron dark
  '#B0562E', // rust
  '#221D2E', '#3D3650', '#5C5269', // gallery deep, gallery base, gallery lit
  '#F0A23A', // lamp amber
];
const [SKY_TOP, SKY_MID, SKY_HORIZON, MIST, PEAK_LIT, PEAK, PEAK_SHADE, PINE_DEEP, PINE, ZACATE, OCHRE_LIGHT, OCHRE, OCHRE_SHADE, ROCK_DEEP] = GDD;
const NEAR_BLACK = '#070509';

const painted = (grid) => new Set(grid.cells.filter((c) => c !== null));
const column = (grid, x) => Array.from({ length: grid.height }, (_, y) => grid.get(x, y));
const firstPainted = (grid, x) => column(grid, x).findIndex((c) => c !== null);
/** The art pixels that differ from the top left pixel of their 4 x 4 game pixel. */
const offGrid = (grid) => {
  const off = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) !== grid.get(x - (x % 4), y - (y % 4))) off.push(`${x},${y}`);
  return off;
};

/** CIE L*a*b* (D65) of a colour, as `scripts/art/mercado.test.mjs` works it out. */
function lab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
/** The largest L* step between two painted neighbours (across or down) in a picture. */
const largestStep = (grid) => {
  let best = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const a = grid.get(x, y);
      if (a === null) continue;
      for (const b of [grid.get(x + 1, y), grid.get(x, y + 1)]) if (b !== null && b !== a) best = Math.max(best, Math.abs(lab(a)[0] - lab(b)[0]));
    }
  }
  return best;
};

// The ground: cell (x, r) of frame n is the art pixel (64 n + 4 x, 4 r).
const cell = (g, n, x, r) => g.get(n * 64 + 4 * x, 4 * r);
const tileColumn = (g, n, x) => Array.from({ length: 16 }, (_, r) => cell(g, n, x, r));
const tileRow = (g, n, r) => Array.from({ length: 16 }, (_, x) => cell(g, n, x, r));

describe('World 3 (Sierra) art, the canyon', () => {
  it('GDD-ART-06 the Sierra\'s files are what the drawing gives', () => {
    const built = buildSierra();
    expect(Object.keys(built).sort()).toEqual(['cloud-0.png', 'cloud-1.png', 'cloud-2.png', 'decor.png', 'far-barranca.png', 'ground.png', 'ledge.png', 'mid-barranca.png', 'sky-strips.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
    // Their sizes, art px: the far strip game y 84 to 200, the mid strip 148 to 224, 28 ground frames of 64, seven decor frames of 64 x 160,
    // two ledge frames of 64.
    expect([drawFarBarranca().width, drawFarBarranca().height]).toEqual([1920, 464]);
    expect([drawMidBarranca().width, drawMidBarranca().height]).toEqual([1920, 304]);
    expect([drawGround().width, drawGround().height]).toEqual([28 * 64, 64]);
    expect([drawDecor().width, drawDecor().height]).toEqual([7 * 64, 160]);
    expect([drawLedge().width, drawLedge().height]).toEqual([2 * 64, 64]);
    expect([drawSkyStrips().width, drawSkyStrips().height]).toEqual([1920, 4]);
    expect(drawCloudImages().map((g) => [g.width, g.height])).toEqual(CLOUD_BOXES.map((b) => [b.w * 4, b.h * 4]));
    expect([FAR.top, FAR.h, MID.top, MID.h]).toEqual([84, 116, 148, 76]);
    expect(SKY_ENDS).toEqual([240, 440]);
    expect(STRIP).toBe(2);
    expect([DECOR_FRAME.w, DECOR_FRAME.h]).toEqual([16, 40]);
  });

  it('GDD-ART-03 the Sierra uses only its 24 colours, and the outline only on the ledge', () => {
    expect(Object.values(SIERRA_PALETTE)).toEqual(GDD);
    expect(new Set(GDD).size).toBe(24);
    expect(OUTLINE).toBe(NEAR_BLACK);
    const files = { 'sky-strips.png': [drawSkyStrips(), drawSky()], 'cloud-n.png': [...drawCloudImages(), drawClouds()], 'far-barranca.png': [drawFarBarranca()], 'mid-barranca.png': [drawMidBarranca()], 'ground.png': [drawGround()], 'decor.png': [drawDecor()], 'ledge.png': [drawLedge()] };
    for (const [name, grids] of Object.entries(files)) {
      for (const grid of grids) {
        for (const c of painted(grid)) {
          if (c === NEAR_BLACK && name === 'ledge.png') continue;
          expect(GDD, `${name}: ${c}`).toContain(c);
        }
      }
    }
    expect(painted(drawLedge()).has(NEAR_BLACK)).toBe(true);
  });

  it('GDD-ART-06 every layer is drawn in whole game pixels, 4 x 4 art pixels', () => {
    for (const [name, grid] of Object.entries({ far: drawFarBarranca(), mid: drawMidBarranca(), ground: drawGround(), decor: drawDecor(), clouds: drawClouds() })) expect(offGrid(grid), name).toEqual([]);
    drawCloudImages().forEach((g, i) => expect(offGrid(g), `cloud ${i}`).toEqual([]));
  });

  it('GDD-ART-06 each dither strip is a checker of 2 px cells in the colours either side of its border, and the sky is the bands with them', () => {
    const strips = drawSkyStrips();
    const bands = [SKY_TOP, SKY_MID, SKY_HORIZON];
    for (let i = 0; i < 2; i++) {
      for (const y of [i * 2, i * 2 + 1]) expect(Array.from({ length: 8 }, (_, x) => strips.get(x, y)), `strip ${i}`).toEqual([0, 0, 1, 1, 0, 0, 1, 1].map((k) => bands[i + k]));
    }
    const sky = drawSky();
    // No sun: three bands, #527391 to game y 60, #8AA5B8 to 110, #BFCDD2 below.
    expect(painted(sky)).toEqual(new Set(bands));
    expect([sky.get(0, 0), sky.get(1919, 237), sky.get(0, 300), sky.get(0, 1079)]).toEqual([SKY_TOP, SKY_TOP, SKY_MID, SKY_HORIZON]);
  });

  it('GDD-ART-06 three long flat streaks of cloud, mist white on top and sky middle under, on the top band, clear of the HUD', () => {
    // About 60 x 8, 44 x 6 and 72 x 10, all between y = 20 and 58.
    const sizes = [[60, 8], [44, 6], [72, 10]];
    expect(CLOUD_BOXES).toHaveLength(3);
    CLOUD_BOXES.forEach((b, i) => {
      expect(Math.abs(b.w - sizes[i][0]), `cloud ${i} width`).toBeLessThanOrEqual(2);
      expect(Math.abs(b.h - sizes[i][1]), `cloud ${i} height`).toBeLessThanOrEqual(1);
      expect(b.y, `cloud ${i} top`).toBeGreaterThanOrEqual(20);
      expect(b.y + b.h, `cloud ${i} bottom`).toBeLessThanOrEqual(58);
      // Right of the lives (x 8 to 100) and left of the hilo counter's corner (its left edge at x 409 or more on any device).
      expect(b.x, `cloud ${i} left`).toBeGreaterThan(100);
      expect(b.x + b.w, `cloud ${i} right`).toBeLessThan(400);
    });
    // The game puts each image where the drawing has it.
    expect(SIERRA.clouds).toEqual(CLOUD_BOXES.map(({ x, y }) => ({ x, y })));
    const clouds = drawClouds();
    expect(painted(clouds)).toEqual(new Set([MIST, SKY_MID]));
    // Flat underneath: each streak's bottom row is sky middle all along.
    drawCloudImages().forEach((g, i) => expect(new Set(Array.from({ length: g.width }, (_, x) => g.get(x, g.height - 1)).filter((c) => c !== null)), `cloud ${i}`).toEqual(new Set([SKY_MID])));
  });

  it('GDD-ART-06 the far and mid strips tile without a seam', () => {
    for (const [name, strip] of Object.entries({ far: drawFarBarranca(), mid: drawMidBarranca() })) {
      // Column 1919 runs on into column 0: their first rows within a game px, and every column painted from there to the strip's bottom.
      expect(Math.abs(firstPainted(strip, 0) - firstPainted(strip, 1919)), name).toBeLessThanOrEqual(4);
      for (const x of [0, 1919]) expect(column(strip, x).slice(firstPainted(strip, x)).every((c) => c !== null), `${name} ${x}`).toBe(true);
    }
  });

  it('GDD-ART-06 the far strip: two ranges, the farther crest near y 96, the nearer crests between 120 and 150, and the foot into pine deep', () => {
    const far = drawFarBarranca();
    const tops = Array.from({ length: 480 }, (_, x) => firstPainted(far, x * 4) / 4 + 84);
    // The farther range's crest near y 96 (the mine's chimney on the far ridge at x 370 to 400 rises over it).
    expect(Math.min(...tops.filter((_, x) => x < 370 || x > 400))).toBe(96);
    for (let x = 370; x <= 400; x++) expect(tops[x], `mine at ${x}`).toBeGreaterThanOrEqual(96 - 4);
    // Every column painted from its first row down, but the mine's open frame (x 370 to 400); the last rows pine deep, as the flat foot below the strip.
    for (let x = 0; x < 1920; x++) {
      const col = column(far, x);
      if (x < 370 * 4 || x >= 400 * 4) expect(col.slice(firstPainted(far, x)).every((c) => c !== null), `column ${x}`).toBe(true);
      expect(col.at(-1), `column ${x}`).toBe(PINE_DEEP);
    }
    expect(FOOT_COLOUR).toBe(PINE_DEEP);
    expect([PEAK_LIT, PEAK, PEAK_SHADE, PINE, SKY_HORIZON].every((c) => painted(far).has(c))).toBe(true);
  });

  it('GDD-ART-06 the mid strip: every column filled from y 196 down, pine deep at the foot, the waterfall in mist white', () => {
    const mid = drawMidBarranca();
    const gaps = [];
    for (let x = 0; x < 1920; x++) for (let y = (196 - 148) * 4; y < 304; y++) if (mid.get(x, y) === null) gaps.push(`${x},${y}`);
    expect(gaps).toEqual([]);
    for (let x = 0; x < 1920; x++) for (const y of [300, 303]) expect(mid.get(x, y), `foot ${x}`).toBe(PINE_DEEP);
    expect(painted(mid)).toEqual(new Set([PEAK, PEAK_SHADE, PINE, PINE_DEEP, MIST]));
    // The waterfall is 2 to 3 px wide above its splash, its right edge broken.
    const widths = [];
    for (let y = (171 - 148) * 4; y < (208 - 148) * 4; y += 4) widths.push(Array.from({ length: 480 }, (_, x) => mid.get(x * 4, y)).filter((c) => c === MIST).length);
    expect(Math.min(...widths)).toBe(2);
    expect(Math.max(...widths)).toBe(3);
  });

  it('GDD-ART-06 the value hierarchy: far softer than mid, mid softer than the ground', () => {
    const [far, mid, ground] = [drawFarBarranca(), drawMidBarranca(), drawGround()].map(largestStep);
    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(ground);
  });

  it('GDD-ART-06 the ochre ground is at least 15 L* from each colour that covers a tenth or more of the mid strip', () => {
    const mid = drawMidBarranca();
    const opaque = mid.cells.filter((c) => c !== null);
    const share = (c) => (100 * opaque.filter((p) => p === c).length) / opaque.length;
    // Measured (L-072), share of the opaque pixels and L* (ochre 66.3): peak shade 70.5% (45.3, ΔL 20.9), pine deep 14.5% (24.8, 41.5),
    // pine green 7.7% (38.8, 27.4), peak base 6.9% (59.4, 6.85), mist white 0.4% (94.8, 28.5 lighter). The colours that make up the wall's
    // mass keep the 15 L*; peak base, thin lit lips, ledges and the trail, and the waterfall's mist white are detail, each under a tenth.
    expect([PEAK_SHADE, PINE_DEEP, PINE, PEAK, MIST].map((c) => Math.round(share(c) * 10) / 10)).toEqual([70.5, 14.5, 7.7, 6.9, 0.4]);
    const mass = [...painted(mid)].filter((c) => share(c) >= 10);
    expect(mass.sort()).toEqual([PEAK_SHADE, PINE_DEEP].sort());
    for (const c of mass) expect(lab(OCHRE)[0] - lab(c)[0], c).toBeGreaterThanOrEqual(15);
    // The detail colour nearest the ground stays under a tenth of the strip.
    expect(share(PEAK)).toBeLessThan(10);
  });

  it('GDD-ART-06 no Sierra ground, decor or ledge colour is within ΔE 12 of Poncho\'s body colours', () => {
    // His chromatic colours, from his sprite's own table; his outline, navy and white are left out, as for World 2.
    const body = Object.entries(PONCHO).filter(([k]) => !['#', 'n', 'W'].includes(k)).map(([, c]) => c);
    expect(body).toHaveLength(10);
    const used = new Set([...painted(drawGround()), ...painted(drawDecor()), ...painted(drawLedge())]);
    used.delete(NEAR_BLACK);
    let nearest = Infinity;
    for (const c of used) {
      for (const p of body) {
        expect(deltaE(c, p), `${c} against ${p}`).toBeGreaterThan(12);
        nearest = Math.min(nearest, deltaE(c, p));
      }
    }
    // Measured: the nearest pair is the madroño's rust against his dark fur.
    expect(nearest).toBeCloseTo(deltaE('#B0562E', '#B06948'), 6);
  });

  it('GDD-ART-06 the top tile\'s walk line is one unbroken row of ochre light in both versions, and the rock tile\'s strata lines are at the same rows in both', () => {
    const g = drawGround();
    for (const v of [0, 1]) expect(tileRow(g, v, 0).every((c) => c === OCHRE_LIGHT), `top v${v} walk line`).toBe(true);
    // The zacate strip under it and the pale ledge 2 px thick, the same in both versions.
    for (const v of [0, 1]) {
      expect(tileRow(g, v, 1).every((c) => c === ZACATE || c === PINE), `top v${v} zacate`).toBe(true);
      for (const r of [4, 5]) expect(tileRow(g, v, r).every((c) => c === OCHRE_LIGHT), `top v${v} ledge ${r}`).toBe(true);
    }
    // A strata line: in the top tile a whole row of ochre shade; in the rock tile a row that is ochre shade at both edges (so it runs on
    // into the next tile) and for at least half its width (it breaks and steps a row aside in places).
    const strataRows = (n) => Array.from({ length: 16 }, (_, r) => r).filter((r) => {
      const row = tileRow(g, n, r);
      if (n < 2) return row.every((c) => c === OCHRE_SHADE);
      return row[0] === OCHRE_SHADE && row[15] === OCHRE_SHADE && row.filter((c) => c === OCHRE_SHADE).length >= 8;
    });
    // One strata line in the top tile, two in the rock tile, at the same rows in both versions.
    expect(strataRows(0)).toHaveLength(1);
    expect(strataRows(1)).toEqual(strataRows(0));
    expect(strataRows(2)).toHaveLength(2);
    expect(strataRows(3)).toEqual(strataRows(2));
    // The versions differ: a tuft or a pebble, a crack or lichen.
    const same = (a, b) => Array.from({ length: 256 }, (_, i) => cell(g, a, i % 16, i >> 4) === cell(g, b, i % 16, i >> 4)).every(Boolean);
    expect(same(0, 1)).toBe(false);
    expect(same(2, 3)).toBe(false);
    expect(Array.from({ length: 256 }, (_, i) => cell(g, 2, i % 16, i >> 4)).includes(ROCK_DEEP), 'crack').toBe(true);
    expect(Array.from({ length: 256 }, (_, i) => cell(g, 3, i % 16, i >> 4)).includes(PEAK), 'lichen').toBe(true);
  });

  it('GDD-ART-06 the ground tiles meet without a seam in any order of versions', () => {
    const g = drawGround();
    // The outer columns are the same in both versions. The top tile's 8-column pattern runs on through them (column 0 is column 8's, 15
    // is 7's); the rock tile's edges are plain ochre but for its strata, at the same rows on both edges, so the bedding runs on.
    for (const [a, b] of [[0, 1], [2, 3]]) for (const x of [0, 15]) expect(tileColumn(g, a, x), `frames ${a} ${b} column ${x}`).toEqual(tileColumn(g, b, x));
    for (const n of [0, 1]) {
      expect(tileColumn(g, n, 0), `frame ${n}`).toEqual(tileColumn(g, n, 8));
      expect(tileColumn(g, n, 15), `frame ${n}`).toEqual(tileColumn(g, n, 7));
    }
    for (const n of [2, 3]) {
      expect(tileColumn(g, n, 0), `frame ${n}`).toEqual(tileColumn(g, n, 15));
      expect(new Set(tileColumn(g, n, 0)), `frame ${n}`).toEqual(new Set([OCHRE, OCHRE_SHADE]));
    }
  });

  it('GDD-ART-06 the rock tile is quiet: a few small marks on plain ochre', () => {
    const g = drawGround();
    for (const n of [2, 3]) {
      const cells = Array.from({ length: 256 }, (_, i) => cell(g, n, i % 16, i >> 4));
      // Ochre covers most of it; the marks other than the strata (specks, the crack or the lichen) are a handful of cells.
      expect(cells.filter((c) => c === OCHRE).length, `frame ${n} ochre`).toBeGreaterThanOrEqual(256 - 2 * 16 - 8);
      expect(cells.filter((c) => c !== OCHRE && c !== OCHRE_SHADE).length, `frame ${n} marks`).toBeLessThanOrEqual(6);
    }
  });

  // The slopes: frame 4 + 2k + v is slope k (/ \ r R F f) in version v, 16 + 2k + v the tile under it (GDD-MOV-09).
  const SLOPES = [['/', 0, 16], ['\\', 16, 0], ['r', 0, 8], ['R', 8, 16], ['F', 16, 8], ['f', 8, 0]];
  const topOf = (left, right, x) => Math.floor(16 - (left + ((right - left) * (x + 0.5)) / 16));

  it('GDD-ART-06 the slopes are the GDD-MOV-09 slopes, each the top tile over the rock tile cut along it (a scree slope)', () => {
    expect(SLOPE_ORDER).toEqual(SLOPE_CHARS.map((c) => [c, SLOPE_HEIGHTS[c].left, SLOPE_HEIGHTS[c].right]));
    expect(SLOPE_ORDER).toEqual(SLOPES);
    expect(slopeTopRow(0, 16, 3)).toBe(topOf(0, 16, 3));
    const g = drawGround();
    SLOPES.forEach(([c, left, right], k) => {
      for (const v of [0, 1]) {
        for (let x = 0; x < 16; x++) {
          const top = topOf(left, right, x);
          for (let r = 0; r < top; r++) expect(cell(g, 4 + 2 * k + v, x, r), `${c} v${v} ${x},${r} empty`).toBe(null);
          const strip = (r) => (r < 16 ? cell(g, 4 + 2 * k + v, x, r) : cell(g, 16 + 2 * k + v, x, r - 16));
          const tile = (r) => (r < 16 ? cell(g, v, x, r) : cell(g, 2 + v, x, r - 16));
          for (let r = top; r < 32; r++) expect(strip(r), `${c} v${v} ${x} row ${r}`).toBe(tile(r - top));
          if (top < 16) expect(cell(g, 4 + 2 * k + v, x, top), `${c} v${v} ${x} walk line`).toBe(OCHRE_LIGHT);
        }
      }
    });
  });

  it('GDD-ART-06 a slope meets the flat top tile at its high end without a seam', () => {
    const g = drawGround();
    for (const v of [0, 1]) {
      for (const n of [4 + v, 10 + v]) expect(tileColumn(g, n, 15), `rising ${n}`).toEqual(tileColumn(g, v, 15));
      for (const n of [6 + v, 12 + v]) expect(tileColumn(g, n, 0), `falling ${n}`).toEqual(tileColumn(g, v, 0));
    }
  });

  // Decor: frame n is kind n, 64 x 160 art px.
  const decorPixels = (n) => {
    const g = drawDecor();
    const out = [];
    for (let y = 0; y < 160; y++) for (let x = 0; x < 64; x++) if (g.get(n * 64 + x, y) !== null) out.push({ x, y, colour: g.get(n * 64 + x, y) });
    return out;
  };

  it('GDD-ART-06 a decor frame is no taller than its kind\'s size and stands on the frame\'s bottom row', () => {
    // The GDD's sizes, game px: pino 16 x 40, encino 16 x 28, madroño 14 x 24, maguey 16 x 12, sotol 10 x 32, tocón 14 x 8, zacatón 12 x 8.
    const sizes = [[16, 40], [16, 28], [14, 24], [16, 12], [10, 32], [14, 8], [12, 8]];
    expect(DECOR_SIZES).toEqual(sizes);
    sizes.forEach(([w, h], n) => {
      const px = decorPixels(n);
      const xs = px.map((p) => p.x), ys = px.map((p) => p.y);
      expect(Math.min(...ys), `decor ${n} no taller than ${h}`).toBeGreaterThanOrEqual(160 - h * 4);
      expect(Math.min(...ys), `decor ${n} about ${h} tall`).toBeLessThanOrEqual(160 - h * 4 + 4);
      expect(ys.includes(159), `decor ${n} stands on the bottom row`).toBe(true);
      expect(Math.max(...xs) - Math.min(...xs) + 1, `decor ${n} width`).toBeLessThanOrEqual(w * 4);
      expect(Math.abs((Math.min(...xs) + Math.max(...xs) + 1) / 2 - 32), `decor ${n} centred`).toBeLessThanOrEqual(4);
      expect(new Set(px.map((p) => p.colour)).size, `decor ${n} colours`).toBeGreaterThanOrEqual(2);
    });
  });

  // The ledge: two frames of 64 x 64 art px. L-059: the rock ledge (assets/sprites/sierra/ledge.png) is drawn at its crumbling tile's top
  // left, a tile square (1 px either way in its warning shake, as the placeholder), and its frames reach nowhere past that tile: the slab's
  // top is the tile's top edge, where he stands, its outline inside the tile, and nothing hangs below 9 px (the test below), so over any
  // level it covers only its own tile and leaves the empty air under it, the sign of a ledge (GDD-UI-03).
  const ledge = drawLedge();
  const ledgeAt = (n) => (x, y) => (x < 0 || y < 0 || x >= 64 || y >= 64 ? null : ledge.get(n * 64 + x, y));

  it('GDD-ART-06 the ledge\'s slab is 6 px thick at the tile\'s top, with nothing drawn below 9 px but transparency, and frame 1 differs from frame 0 only in the slab\'s fill colours', () => {
    for (const n of [0, 1]) {
      const f = ledgeAt(n);
      // Across the tile (but its rounded outlined corners), the slab is painted from the tile's top edge down 6 game px (24 art px).
      for (let x = 4; x < 60; x++) for (let y = 0; y < 24; y++) expect(f(x, y), `frame ${n} slab ${x},${y}`).not.toBe(null);
      // Where no stone hangs, nothing under it: the slab is exactly 6 px thick there, and some columns are such.
      const bare = Array.from({ length: 56 }, (_, i) => i + 4).filter((x) => f(x, 24) === null);
      expect(bare.length, `frame ${n} bare columns`).toBeGreaterThan(20);
      // The loose stones hang under it, 3 px at most: nothing from 9 px down.
      expect(Array.from({ length: 64 }, (_, x) => f(x, 24) !== null).some(Boolean), `frame ${n} stones`).toBe(true);
      for (let y = 36; y < 64; y++) for (let x = 0; x < 64; x++) expect(f(x, y), `frame ${n} ${x},${y}`).toBe(null);
      // Outlined, on the tile's top edge too, where he stands; inside the tile at its sides.
      for (let x = 4; x < 60; x++) expect(f(x, 0), `frame ${n} top ${x}`).toBe(NEAR_BLACK);
      for (let y = 4; y < 20; y++) expect([f(0, y), f(63, y)], `frame ${n} sides ${y}`).toEqual([NEAR_BLACK, NEAR_BLACK]);
    }
    // Frame 0: the slab in ochre light and ochre with cracks of rock deep through it.
    const slab0 = new Set(Array.from({ length: 64 * 24 }, (_, i) => ledgeAt(0)(i % 64, Math.floor(i / 64))).filter((c) => c !== null));
    expect(slab0).toEqual(new Set([NEAR_BLACK, OCHRE_LIGHT, OCHRE, ROCK_DEEP]));
    // Frame 1, its pale flash, differs from frame 0 only in the slab's fill colours, lifted: the outline and the cracks stay.
    const [a, b] = [ledgeAt(0), ledgeAt(1)];
    const lifted = { [OCHRE_LIGHT]: MIST, [OCHRE]: OCHRE_LIGHT };
    let changed = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (a(x, y) === b(x, y)) continue;
        changed++;
        expect(y, `${x},${y} in the slab`).toBeLessThan(24);
        expect(b(x, y), `${x},${y} lifted`).toBe(lifted[a(x, y)]);
      }
    }
    expect(changed).toBeGreaterThan(0);
  });
});
