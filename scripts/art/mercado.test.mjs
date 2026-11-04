import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLOPE_CHARS, SLOPE_HEIGHTS } from '../../src/sim/tilemap';
import {
  AWNING_ART, CLOUD_BOXES, CORDEL_ART, DECOR_FRAME, DECOR_SIZES, drawAwning, drawCloudImages, drawClouds, drawCordel, drawDecor, drawFarTown,
  drawGround, drawMidRoofs, drawPlaza, drawRollo, drawSky, drawSkyStrips, FAR, FOOT_COLOUR, MID, OUTLINE, PALETTE, ROLLO_ART, SKY_ENDS, SLOPE_ORDER,
  slopeTopRow, STRIP,
} from './mercado.mjs';
import { buildMercado } from './make-mercado.mjs';
import { COLOURS as PONCHO } from './poncho-pixels.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'mercado');

// The World 2 art spec's 24 colours (2.1), in its order, written here rather than read back from the script (L-011).
const SPEC = [
  '#86BEE0', '#A9D3EA', '#CFE8F1', // sky top, middle, horizon
  '#C3C6DE', '#9AA6CD', '#7C86B5', // far lit, base, shade
  '#E6C2B8', '#C99A9E', '#E4CC9E', '#4E4A78', // mid rose, rose shade, ochre, street
  '#E07A52', '#C45E3E', '#8A3B30', // teja lit, teja, teja dark
  '#F2B0A6', '#E07F8E', '#B85E6E', // plaster lit, plaster, plaster shade
  '#1C3F9E', '#F4EFE2', '#E9B53F', // talavera cobalt, glaze white, talavera yellow
  '#D9327E', '#2AA198', '#4F8F4C', '#3B2B3C', '#7E5A3E', // rosa mexicano, teal, leaf, wrought iron, wood
];
const [SKY_TOP, SKY_MID, SKY_HORIZON, FAR_LIT, FAR_BASE, FAR_SHADE, MID_ROSE, MID_SHADE, MID_OCHRE, STREET, TEJA_LIT, , , PL_LIT, PLASTER, PL_SHADE, COBALT, GLAZE, YELLOW, ROSA, TEAL] = SPEC;
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
/** A frame `w` x `h` art px at column `n` (and `row`) of a sheet, as a reader. */
const frameAt = (grid, n, w, h, row = 0) => (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : grid.get(n * w + x, row * h + y));

/** CIE L*a*b* (D65) of a colour. */
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
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const a = grid.get(x, y);
      if (a === null) continue;
      for (const b of [grid.get(x + 1, y), grid.get(x, y + 1)]) if (b !== null && b !== a) best = Math.max(best, Math.abs(lab(a)[0] - lab(b)[0]));
    }
  }
  return best;
};

describe('World 2 (Mercado) art', () => {
  it('GDD-ART-06 the committed PNGs are the ones the script makes', () => {
    const built = buildMercado();
    expect(Object.keys(built).sort()).toEqual(['awning.png', 'cloud-0.png', 'cloud-1.png', 'cloud-2.png', 'cordel.png', 'decor.png', 'far-town.png', 'ground.png', 'mid-roofs.png', 'plaza.png', 'rollo.png', 'sky-strips.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
  });

  it('GDD-ART-06 the images have the spec\'s sizes', () => {
    expect([drawSkyStrips().width, drawSkyStrips().height]).toEqual([1920, 4]); // two strips, 2 art px tall
    expect(drawCloudImages().map((g) => [g.width, g.height])).toEqual(CLOUD_BOXES.map((b) => [b.w * 4, b.h * 4]));
    expect([drawFarTown().width, drawFarTown().height]).toEqual([1920, 464]); // game y 84 to 200
    expect([drawMidRoofs().width, drawMidRoofs().height]).toEqual([1920, 304]); // game y 148 to 224
    expect([drawPlaza().width, drawPlaza().height]).toEqual([1920, 304]); // the arena's mid layer, the same band
    expect([drawGround().width, drawGround().height]).toEqual([1792, 64]); // 28 frames, World 1's layout
    expect([drawDecor().width, drawDecor().height]).toEqual([448, 160]); // seven frames of 64 x 160
    expect([drawAwning().width, drawAwning().height]).toEqual([192, 640]); // 3 pieces x 10 rows of 64 x 64
    expect([drawCordel().width, drawCordel().height]).toEqual([960, 64]); // 10 frames of 96 x 64
    expect([drawRollo().width, drawRollo().height]).toEqual([576, 96]); // 6 frames of 96 x 96
    expect([drawSky().width, drawSky().height]).toEqual([1920, 1080]);
    expect([FAR.top, FAR.h, MID.top, MID.h]).toEqual([84, 116, 148, 76]);
    expect(SKY_ENDS).toEqual([240, 440]);
    expect(STRIP).toBe(2);
    expect(FOOT_COLOUR).toBe(STREET);
    expect([DECOR_FRAME.w, DECOR_FRAME.h]).toEqual([16, 40]);
    // The spec's decor sizes (2.7): maceta 10 x 12, bugambilia 16 x 20, huacal 14 x 10, ollas 14 x 14, farol 8 x 40, rebozos 16 x 24, lotería 12 x 16.
    expect(DECOR_SIZES).toEqual([[10, 12], [16, 20], [14, 10], [14, 14], [8, 40], [16, 24], [12, 16]]);
  });

  it('GDD-ART-06 the palette is the spec\'s 24 colours and every pixel is one of them, the outline only on touchable objects', () => {
    expect(Object.values(PALETTE).flat()).toEqual(SPEC);
    expect(new Set(SPEC).size).toBe(24);
    expect(OUTLINE).toBe(NEAR_BLACK);
    const scenery = [drawSky(), drawSkyStrips(), ...drawCloudImages(), drawClouds(), drawFarTown(), drawMidRoofs(), drawPlaza(), drawGround(), drawDecor()];
    const touchable = [drawAwning(), drawCordel(), drawRollo()];
    const used = new Set();
    for (const grid of scenery) {
      for (const c of painted(grid)) {
        expect(SPEC, c).toContain(c);
        used.add(c);
      }
    }
    for (const grid of touchable) {
      expect(painted(grid).has(NEAR_BLACK)).toBe(true);
      for (const c of painted(grid)) if (c !== NEAR_BLACK) {
        expect(SPEC, c).toContain(c);
        used.add(c);
      }
    }
    expect(used.size).toBeLessThanOrEqual(24);
  });

  it('GDD-ART-06 every layer is drawn in whole game pixels, 4 x 4 art pixels', () => {
    for (const [name, grid] of Object.entries({ far: drawFarTown(), mid: drawMidRoofs(), plaza: drawPlaza(), ground: drawGround(), decor: drawDecor(), clouds: drawClouds() })) expect(offGrid(grid), name).toEqual([]);
    drawCloudImages().forEach((g, i) => expect(offGrid(g), `cloud ${i}`).toEqual([]));
  });

  it('GDD-ART-06 each dither strip is a checker of 2 px cells in the colours either side of its border, and the sky is the bands with them', () => {
    const strips = drawSkyStrips();
    const bands = [SKY_TOP, SKY_MID, SKY_HORIZON];
    for (let i = 0; i < 2; i++) {
      for (const y of [i * 2, i * 2 + 1]) {
        expect(Array.from({ length: 8 }, (_, x) => strips.get(x, y)), `strip ${i}`).toEqual([0, 0, 1, 1, 0, 0, 1, 1].map((k) => bands[i + k]));
      }
    }
    const sky = drawSky();
    expect(painted(sky)).toEqual(new Set(bands)); // no sun (D3)
    expect([sky.get(0, 0), sky.get(1919, 237), sky.get(0, 300), sky.get(0, 1079)]).toEqual([SKY_TOP, SKY_TOP, SKY_MID, SKY_HORIZON]);
    for (const [end, i] of [[240, 0], [440, 1]]) for (let x = 0; x < 16; x++) expect([sky.get(x, end - 2), sky.get(x, end - 1)]).toEqual([strips.get(x, i * 2), strips.get(x, i * 2 + 1)]);
  });

  it('GDD-ART-06 three small clouds, glaze on top and horizon blue under, between game y 14 and 64, off the strip\'s sides', () => {
    expect(CLOUD_BOXES).toHaveLength(3);
    // About 34 x 12, 46 x 16 and 28 x 10, near x = 90, 250 and 410 (2.2).
    const sizes = [[34, 12], [46, 16], [28, 10]];
    const centres = [90, 250, 410];
    CLOUD_BOXES.forEach((b, i) => {
      expect(Math.abs(b.w - sizes[i][0]), `cloud ${i} width`).toBeLessThanOrEqual(2);
      expect(Math.abs(b.h - sizes[i][1]), `cloud ${i} height`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.x + b.w / 2 - centres[i]), `cloud ${i} centre`).toBeLessThanOrEqual(2);
      expect(b.y, `cloud ${i} top`).toBeGreaterThanOrEqual(14);
      expect(b.y + b.h, `cloud ${i} bottom`).toBeLessThanOrEqual(64);
    });
    const clouds = drawClouds();
    expect(painted(clouds)).toEqual(new Set([GLAZE, SKY_HORIZON]));
    expect(column(clouds, 0).every((c) => c === null) && column(clouds, 1919).every((c) => c === null)).toBe(true);
  });

  it('GDD-ART-06 the far town is cool and pale, fills every column below the hill\'s first row, and repeats without a seam', () => {
    const far = drawFarTown();
    expect(painted(far)).toEqual(new Set([FAR_LIT, FAR_BASE, FAR_SHADE, SKY_HORIZON]));
    for (const c of painted(far)) expect(lab(c)[2], `${c} is cool (b* < 0)`).toBeLessThan(0);
    // Below game y 170 (the hill's lowest ridge) every pixel is painted; above it, gaps between painted pixels of a column (a ledge, a
    // cross's arm) are only in the two landmarks, the church (x 126 to 176) and the chapel (x 356 to 372).
    const gaps = [];
    for (let x = 0; x < 1920; x++) {
      for (let y = firstPainted(far, x); y < 464; y++) {
        if (far.get(x, y) !== null) continue;
        const gx = x / 4;
        if (y >= (170 - 84) * 4 || !((gx >= 126 && gx < 176) || (gx >= 356 && gx < 372))) gaps.push(`${x},${y}`);
      }
    }
    expect(gaps).toEqual([]);
    expect(Math.abs(firstPainted(far, 0) - firstPainted(far, 1919))).toBeLessThanOrEqual(4);
    // The hill is 170 at the sides, its crest 128; the church's cross is the highest pixel, at game y 84 (the band's top row).
    expect(Math.round(firstPainted(far, 0) / 4) + 84).toBe(170);
    expect(Math.min(...Array.from({ length: 1920 }, (_, x) => firstPainted(far, x)))).toBe(0);
    const top = Array.from({ length: 480 }, (_, x) => firstPainted(far, x * 4));
    expect(top.indexOf(0)).toBeGreaterThanOrEqual(126);
    expect(top.indexOf(0)).toBeLessThan(176);
  });

  it('GDD-ART-06 the mid rooftops: nothing above game y 156, every column filled from y 196 down, the street\'s dark at the foot, no seam', () => {
    for (const [name, mid] of Object.entries({ roofs: drawMidRoofs(), plaza: drawPlaza() })) {
      if (name === 'roofs') for (let x = 0; x < 1920; x++) expect(firstPainted(mid, x), `${name} column ${x}`).toBeGreaterThanOrEqual((156 - 148) * 4);
      const gaps = [];
      for (let x = 0; x < 1920; x++) for (let y = (196 - 148) * 4; y < 304; y++) if (mid.get(x, y) === null) gaps.push(`${x},${y}`);
      expect(gaps, name).toEqual([]);
      for (let x = 0; x < 1920; x++) for (const y of [300, 303]) expect(mid.get(x, y), `${name} foot ${x}`).toBe(STREET);
      expect(Math.abs(firstPainted(mid, 0) - firstPainted(mid, 1919)), name).toBeLessThanOrEqual(4);
    }
    const roofs = drawMidRoofs();
    expect([MID_ROSE, MID_SHADE, MID_OCHRE, STREET].every((c) => painted(roofs).has(c))).toBe(true);
  });

  it('GDD-ART-06 the value hierarchy: far softer than mid, mid softer than the playfield; the walk line stands out from the backdrop', () => {
    const [far, mid, ground] = [drawFarTown(), drawMidRoofs(), drawGround()].map(largestStep);
    expect(far).toBeLessThan(24);
    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(ground);
    for (const c of [FAR_LIT, FAR_BASE, FAR_SHADE, SKY_HORIZON, MID_ROSE, MID_SHADE, MID_OCHRE, STREET]) expect(deltaE(TEJA_LIT, c), c).toBeGreaterThanOrEqual(15);
  });

  it('GDD-ART-06 Poncho stays readable: no playfield colour is within ΔE 12 of his body colours', () => {
    // His chromatic colours, from his sprite's own table; his outline, navy and white are left out: the scenery's iron (ΔE 9) and
    // glaze white (ΔE 4) are near them, and his outline keeps those small accents apart from any background.
    const body = Object.entries(PONCHO).filter(([k]) => !['#', 'n', 'W'].includes(k)).map(([, c]) => c);
    expect(body).toHaveLength(10);
    const used = new Set([...painted(drawGround()), ...painted(drawDecor())]);
    for (const c of used) for (const p of body) expect(deltaE(c, p), `${c} against ${p}`).toBeGreaterThan(12);
  });

  // The ground (2.6). Cell (x, r) of frame n is the art pixel (64 n + 4 x, 4 r).
  const cell = (g, n, x, r) => g.get(n * 64 + 4 * x, 4 * r);
  const tileColumn = (g, n, x) => Array.from({ length: 16 }, (_, r) => cell(g, n, x, r));

  it('GDD-ART-06 the top tile is the walk line, the tejas, the eave\'s shadow, the talavera band and plaster, the same band in both versions', () => {
    const g = drawGround();
    for (const v of [0, 1]) {
      expect(Array.from({ length: 16 }, (_, x) => cell(g, v, x, 0)).every((c) => c === TEJA_LIT), `v${v} walk line`).toBe(true);
      for (const r of [8, 12]) expect(Array.from({ length: 16 }, (_, x) => cell(g, v, x, r)).every((c) => c === COBALT), `v${v} border ${r}`).toBe(true);
      expect(Array.from({ length: 16 }, (_, x) => cell(g, v, x, 10)), `v${v} flowers`).toEqual(Array.from({ length: 16 }, (_, x) => [COBALT, YELLOW, COBALT, GLAZE][x % 4]));
      for (const r of [5, 6]) expect(Array.from({ length: 16 }, (_, x) => cell(g, v, x, r)).every((c) => c === PL_SHADE), `v${v} eave shadow ${r}`).toBe(true);
    }
    for (let r = 8; r <= 12; r++) for (let x = 0; x < 16; x++) expect(cell(g, 0, x, r), `band ${x},${r}`).toBe(cell(g, 1, x, r));
    const same = (a, b) => Array.from({ length: 256 }, (_, i) => cell(g, a, i % 16, i >> 4) === cell(g, b, i % 16, i >> 4)).every(Boolean);
    expect(same(0, 1)).toBe(false);
    expect(same(2, 3)).toBe(false);
  });

  it('GDD-ART-06 the ground tiles meet without a seam in any order of versions', () => {
    const g = drawGround();
    // Top tiles: the outer columns are the same in both versions, and the period-4 pattern runs on through them (column 0 is column 4's
    // pattern, column 15 column 11's), so any version meets any other.
    for (const x of [0, 15]) expect(tileColumn(g, 0, x), `top column ${x}`).toEqual(tileColumn(g, 1, x));
    for (const v of [0, 1]) {
      expect(tileColumn(g, v, 0)).toEqual(tileColumn(g, v, 4));
      expect(tileColumn(g, v, 15)).toEqual(tileColumn(g, v, 11));
    }
    // Wall tiles: plain plaster in the outer columns.
    for (const n of [2, 3]) for (const x of [0, 15]) expect(tileColumn(g, n, x).every((c) => c === PLASTER), `wall ${n} column ${x}`).toBe(true);
    for (const n of [2, 3]) expect(painted({ cells: Array.from({ length: 256 }, (_, i) => cell(g, n, i % 16, i >> 4)) }).has(PLASTER)).toBe(true);
  });

  // The slopes: frame 4 + 2k + v is slope k (/ \ r R F f) in version v, 16 + 2k + v the tile under it (GDD-MOV-09).
  const SLOPES = [['/', 0, 16], ['\\', 16, 0], ['r', 0, 8], ['R', 8, 16], ['F', 16, 8], ['f', 8, 0]];
  const topOf = (left, right, x) => Math.floor(16 - (left + ((right - left) * (x + 0.5)) / 16));

  it('GDD-ART-06 the slopes are the GDD-MOV-09 slopes, each the top tile over the wall tile cut along it (a pitched roof)', () => {
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
          if (top < 16) expect(cell(g, 4 + 2 * k + v, x, top), `${c} v${v} ${x} walk line`).toBe(TEJA_LIT);
        }
      }
    });
  });

  it('GDD-ART-06 a slope meets the flat roof at its high end without a seam', () => {
    const g = drawGround();
    for (const v of [0, 1]) {
      // `/` and `R` end at the full height in column 15, which is the top tile's column 15; `\` and `F` start so in column 0.
      for (const n of [4 + v, 10 + v]) expect(tileColumn(g, n, 15), `rising ${n}`).toEqual(tileColumn(g, v, 15));
      for (const n of [6 + v, 12 + v]) expect(tileColumn(g, n, 0), `falling ${n}`).toEqual(tileColumn(g, v, 0));
    }
  });

  // Decor (2.7): frame n is kind n, 64 x 160 art px.
  const decorPixels = (n) => {
    const g = drawDecor();
    const out = [];
    for (let y = 0; y < 160; y++) for (let x = 0; x < 64; x++) if (g.get(n * 64 + x, y) !== null) out.push({ x, y, colour: g.get(n * 64 + x, y) });
    return out;
  };

  it('GDD-ART-06 each decor item fits its size, stands on the frame\'s bottom row, is centred, and uses at least two colours', () => {
    DECOR_SIZES.forEach(([w, h], n) => {
      const px = decorPixels(n);
      const xs = px.map((p) => p.x), ys = px.map((p) => p.y);
      expect(Math.max(...xs) - Math.min(...xs) + 1, `decor ${n} width`).toBeLessThanOrEqual(w * 4);
      expect(Math.min(...ys), `decor ${n} top`).toBeGreaterThanOrEqual(160 - h * 4);
      expect(Math.min(...ys), `decor ${n} height`).toBeLessThanOrEqual(160 - h * 4 + 4);
      expect(ys.includes(159), `decor ${n} stands`).toBe(true);
      expect(Math.abs((Math.min(...xs) + Math.max(...xs) + 1) / 2 - 32), `decor ${n} centred`).toBeLessThanOrEqual(4);
      expect(new Set(px.map((p) => p.colour)).size, `decor ${n} colours`).toBeGreaterThanOrEqual(2);
    });
  });

  it('GDD-ART-06 the decor carries the colours the spec gives it, and none of the reserved shapes\' colours on its own', () => {
    const colours = (n) => new Set(decorPixels(n).map((p) => p.colour));
    expect([GLAZE, COBALT, ROSA].every((c) => colours(0).has(c)), 'maceta').toBe(true);
    expect([ROSA, '#4F8F4C', '#C45E3E'].every((c) => colours(1).has(c)), 'bugambilia').toBe(true);
    expect(['#7E5A3E', YELLOW, '#3B2B3C'].every((c) => colours(2).has(c)), 'huacal').toBe(true);
    expect(['#C45E3E', TEJA_LIT, '#8A3B30', GLAZE].every((c) => colours(3).has(c)), 'ollas').toBe(true);
    expect(['#3B2B3C', GLAZE, YELLOW].every((c) => colours(4).has(c)), 'farol').toBe(true);
    expect(['#7E5A3E', TEAL, ROSA, YELLOW, COBALT, GLAZE].every((c) => colours(5).has(c)), 'rebozos').toBe(true);
    expect(['#7E5A3E', GLAZE, YELLOW, TEJA_LIT].every((c) => colours(6).has(c)), 'lotería').toBe(true);
    expect(painted(drawDecor()).has(NEAR_BLACK)).toBe(false);
  });

  // Awnings (3.1): 3 pieces x 10 rows of 64 x 64 art px.
  const awning = drawAwning();
  const piece = (col, row) => frameAt(awning, col, 64, 64, row);
  const rowOf = (name) => AWNING_ART.rows.indexOf(name);
  const topRow = (f, x) => Array.from({ length: 64 }, (_, y) => f(x, y)).findIndex((c) => c !== null);
  const bottomRow = (f, x) => 63 - Array.from({ length: 64 }, (_, y) => f(x, 63 - y)).findIndex((c) => c !== null);

  it('GDD-ART-06 the awning is rosa and white stripes 4 px wide over a scalloped valance, outlined, its top 1 game px under the frame\'s', () => {
    const rest = rowOf('rest');
    expect(AWNING_ART.canvasTop).toBe(1);
    for (let col = 0; col < 3; col++) {
      const f = piece(col, rest);
      // The outline 2 art px above the canvas, the canvas's white hem on its top row, then the stripes.
      expect([f(20, 2), f(20, 3), f(20, 4)]).toEqual([NEAR_BLACK, NEAR_BLACK, GLAZE]);
      expect(Array.from({ length: 4 }, (_, k) => f(k * 16 + 6, 8)), `piece ${col} stripes`).toEqual([ROSA, GLAZE, ROSA, GLAZE]);
    }
    // The canvas is 8 game px tall with its valance: from art row 4 to row 35, then the outline.
    const mid = piece(1, rest);
    expect(mid(6, 35)).not.toBe(null);
    expect([mid(6, 36), mid(6, 37)]).toEqual([NEAR_BLACK, NEAR_BLACK]);
    // Scallops: in each 4 px stripe the valance's last row has only its middle two game px.
    expect([mid(1, 34), mid(5, 34), mid(9, 34), mid(13, 34)].map((c) => c !== null && c !== NEAR_BLACK)).toEqual([false, true, true, false]);
    // The outline sits inside the tiles at the awning's two ends.
    expect([piece(0, rest)(0, 10), piece(0, rest)(2, 10), piece(2, rest)(63, 10), piece(2, rest)(61, 10)]).toEqual([NEAR_BLACK, ROSA, NEAR_BLACK, PL_LIT]); // the last stripe is white, in shade
  });

  it('GDD-ART-06 the awning sags 2, 4 and 6 px in the middle, its ends fixed, and its pieces meet in any width without a seam', () => {
    ['rest', 'sag2', 'sag4', 'sag6'].forEach((name, i) => {
      const d = [0, 2, 4, 6][i];
      const [l, m, r] = [0, 1, 2].map((c) => piece(c, rowOf(name)));
      expect(topRow(m, 30), `${name} middle`).toBe(2 + d * 4);
      expect(topRow(l, 2), `${name} left end`).toBe(2);
      expect(topRow(r, 61), `${name} right end`).toBe(2);
      // Left | middle, middle | middle, middle | right, and left | right (a 2-tile awning) continue the same top and bottom edge.
      for (const [a, b] of [[l, m], [m, m], [m, r], [l, r]]) {
        expect(topRow(a, 63), name).toBe(topRow(b, 0));
        expect(bottomRow(a, 63), name).toBe(bottomRow(b, 0));
      }
    });
  });

  it('GDD-ART-06 the torn awning is faded with two patches; its halves and the posts are scenery without the outline', () => {
    for (const name of ['tornRest', 'tornSag2', 'tornSag4', 'tornSag6']) {
      const used = new Set();
      for (let c = 0; c < 3; c++) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) used.add(piece(c, rowOf(name))(x, y));
      expect(used.has(ROSA), name).toBe(false);
      expect([PLASTER, GLAZE, TEAL, YELLOW, NEAR_BLACK].every((c) => used.has(c)), name).toBe(true);
    }
    for (const name of ['tornHalves', 'posts']) {
      const used = new Set();
      for (let c = 0; c < 3; c++) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) used.add(piece(c, rowOf(name))(x, y));
      expect(used.has(NEAR_BLACK), name).toBe(false);
      expect(used.size, name).toBeGreaterThan(1);
    }
    // The torn halves hang at the two ends; the middle piece is gone.
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) expect(piece(1, rowOf('tornHalves'))(x, y)).toBe(null);
  });

  // Cordeles (3.2): 10 frames of 96 x 64 art px.
  const cordel = drawCordel();
  const cordelFrame = (n) => frameAt(cordel, n, 96, 64);

  it('GDD-ART-06 a cordel tile is a 2 px line with two outlined flags 6 x 8 under it, one every 8 px, with see-through cut-outs', () => {
    expect([CORDEL_ART.frameW, CORDEL_ART.margin, CORDEL_ART.lineTop, CORDEL_ART.flagTop]).toEqual([24, 4, 2, 4]);
    const pairs = [[ROSA, YELLOW], [ROSA, YELLOW], [ROSA, YELLOW], [TEAL, COBALT], [TEAL, COBALT], [TEAL, COBALT]];
    pairs.forEach(([a, b], n) => {
      const f = cordelFrame(n);
      // The line covers the tile (art x 16 to 79) on its two rows, and nothing of it reaches the margins.
      for (let x = 16; x < 80; x++) for (const y of [8, 15]) expect(f(x, y), `frame ${n} line ${x}`).not.toBe(null);
      for (const x of [0, 15, 80, 95]) expect(f(x, 9), `frame ${n} margin ${x}`).toBe(null);
      // The flags' colours at their top halves (which never sway), their outline, and a hole in the middle of each.
      expect([f(16 + 4 * 2 + 1, 4 * 5 + 1), f(16 + 4 * 10 + 1, 4 * 5 + 1)], `frame ${n}`).toEqual([a, b]);
      expect(f(16 + 3, 4 * 5 + 1), `frame ${n} outline`).toBe(NEAR_BLACK);
      expect(f(16 + 4 * 3 + 2, 4 * 7 + 2), `frame ${n} cut-out`).toBe(null);
    });
    // The sway frames move the flags' lower halves 1 game px right and left.
    const low = (n) => Array.from({ length: 96 }, (_, x) => cordelFrame(n)(x, 4 * 10 + 1));
    const firstFlag = (row) => row.findIndex((c) => c !== null && c !== NEAR_BLACK);
    expect([firstFlag(low(1)) - firstFlag(low(0)), firstFlag(low(2)) - firstFlag(low(0))]).toEqual([4, -4]);
    // The posts (frames 6 to 9) are scenery.
    for (const n of [6, 7, 8, 9]) for (let y = 0; y < 64; y++) for (let x = 0; x < 96; x++) expect(cordelFrame(n)(x, y)).not.toBe(NEAR_BLACK);
  });

  it('GDD-ART-06 the rollo is an outlined roll of the four flag colours, swaying 1 px, with a flapping-open frame, for either post', () => {
    expect(ROLLO_ART.frames).toEqual(['restRight', 'swayRight', 'flapRight', 'restLeft', 'swayLeft', 'flapLeft']);
    const rollo = drawRollo();
    const f = (n) => frameAt(rollo, n, 96, 96);
    for (let n = 0; n < 6; n++) {
      const used = new Set();
      for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) used.add(f(n)(x, y));
      expect([ROSA, YELLOW, TEAL, COBALT, NEAR_BLACK].every((c) => used.has(c)), `frame ${n}`).toBe(true);
    }
    const left = (n) => Math.min(...Array.from({ length: 96 }, (_, y) => Array.from({ length: 96 }, (_, x) => f(n)(x, y)).findIndex((c) => c === ROSA)).filter((x) => x >= 0));
    expect(left(1) - left(0)).toBe(4);
    // The two sides mirror each other.
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) expect(f(3)(x, y), `${x},${y}`).toBe(f(0)(95 - x, y));
  });

  it('GDD-ART-06 the arena\'s plaza has the kiosco in the middle, x 200 to 280, its dome the highest thing in the band', () => {
    const plaza = drawPlaza();
    const top = Array.from({ length: 480 }, (_, x) => firstPainted(plaza, x * 4));
    const highest = Math.min(...top);
    const where = top.map((t, x) => (t === highest ? x : -1)).filter((x) => x >= 0);
    for (const x of where) {
      expect(x).toBeGreaterThanOrEqual(200);
      expect(x).toBeLessThan(280);
    }
    expect(painted(plaza)).toEqual(new Set([MID_ROSE, MID_SHADE, MID_OCHRE, STREET, FAR_LIT, FAR_BASE]));
  });
});
