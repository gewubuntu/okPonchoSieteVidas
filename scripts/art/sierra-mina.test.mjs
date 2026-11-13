import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMina } from './make-sierra.mjs';
import { COLOURS as PONCHO } from './poncho-pixels.mjs';
import { DECOR_FRAME } from '../../src/config/tuning';
import { drawGround } from './sierra.mjs';
import {
  drawBackwall, drawDecorMina, drawFarMina, drawGroundMina, drawMidMina, drawMinaSkyStrip, FAR_MINA, LAMPS, MID_MINA, MID_MINA_FOOT, MINA_DECOR_SIZES,
  MINA_FOOT, MINA_SKY_END, MINA_STRIP, STRATA_MINA, strataRow, TUNNELS, VEIN_BED, veinRow,
} from './sierra-mina.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'sierra');

// GDD-ART-06: World 3's 24 colours, in the GDD's table's order, written here rather than read back from the script (L-011).
const GDD = [
  '#527391', '#8AA5B8', '#BFCDD2', '#EEF1EA', '#A9B8AC', '#7F9488', '#5B7067', '#24403A', '#3F6350', '#A3A85A', '#EDCB86', '#CC983F', '#9A6A2C',
  '#5A3B28', '#A89480', '#75614F', '#43362F', '#93A0AE', '#353A48', '#B0562E', '#221D2E', '#3D3650', '#5C5269', '#F0A23A',
];
const MIST = '#EEF1EA', PINE_DEEP = '#24403A', PINE = '#3F6350', ZACATE = '#A3A85A', OCHRE_LIGHT = '#EDCB86', OCHRE = '#CC983F', OCHRE_SHADE = '#9A6A2C';
const ROCK_DEEP = '#5A3B28', TIMBER_LIT = '#A89480', TIMBER = '#75614F', STEEL = '#93A0AE', GALLERY_DEEP = '#221D2E', GALLERY_BASE = '#3D3650';
const GALLERY_LIT = '#5C5269', LAMP_AMBER = '#F0A23A', TIMBER_DARK = '#43362F';
const NEAR_BLACK = '#070509';
/** The back wall's versions (`src/ui/scenery/backWall.ts`), and its mean L* over the four, measured (L-072). */
const WALL_VERSIONS = [0, 1, 2, 3];
const WALL_L = 47.8;

const painted = (grid) => new Set(grid.cells.filter((c) => c !== null));
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
/** The mean L* of the art pixels of `grid` from column x0, `w` wide. */
const meanL = (grid, x0, w) => {
  let sum = 0;
  for (let y = 0; y < grid.height; y++) for (let x = x0; x < x0 + w; x++) sum += lab(grid.get(x, y))[0];
  return sum / (grid.height * w);
};

// A strip in game px: the colour of game pixel (x, y), y on the screen.
const at = (grid, top) => (x, y) => grid.get(x * 4, (y - top) * 4);
/** How many rows of a strip `h` game px tall differ between game columns a and b. */
const columnDiff = (px, top, h, a, b) => Array.from({ length: h }, (_, i) => px(a, top + i) !== px(b, top + i)).filter(Boolean).length;
// The ground and the back wall: cell (x, r) of frame n is the art pixel (64 n + 4 x, 4 r).
const cell = (g, n, x, r) => g.get(n * 64 + 4 * x, 4 * r);
const tileColumn = (g, n, x) => Array.from({ length: 16 }, (_, r) => cell(g, n, x, r));
const tileRow = (g, n, r) => Array.from({ length: 16 }, (_, x) => cell(g, n, x, r));
const tileCells = (g, n) => Array.from({ length: 256 }, (_, i) => cell(g, n, i % 16, i >> 4));
/** The groups of touching cells (across or down) of `colour` in rows r0 to r1 of frame n. */
const chips = (g, n, colour, r0, r1) => {
  const seen = new Set();
  let groups = 0;
  for (let r = r0; r <= r1; r++) {
    for (let x = 0; x < 16; x++) {
      if (cell(g, n, x, r) !== colour || seen.has(`${x},${r}`)) continue;
      groups++;
      const stack = [[x, r]];
      while (stack.length) {
        const [cx, cr] = stack.pop();
        if (cx < 0 || cx > 15 || cr < r0 || cr > r1 || seen.has(`${cx},${cr}`) || cell(g, n, cx, cr) !== colour) continue;
        seen.add(`${cx},${cr}`);
        stack.push([cx + 1, cr], [cx - 1, cr], [cx, cr + 1], [cx, cr - 1]);
      }
    }
  }
  return groups;
};

describe('World 3 (Sierra) art, the mine', () => {
  it('GDD-ART-06 the mine files are what the drawing gives, at their sizes', () => {
    const built = buildMina();
    expect(Object.keys(built).sort()).toEqual(['backwall.png', 'decor-mina.png', 'far-mina.png', 'ground-mina.png', 'mid-mina.png', 'sky-mina.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
    // The GDD's sizes, art px: far-mina 1920 x 640 (game y 40 to 200), mid-mina 1920 x 496 (y 100 to 224), the ground sheet's 28 frames of
    // 64 and the mine's 7 after them (the underside, deep rock and the one-tile ledge in two versions each, the plain rock tile's second
    // version with no ore), seven decor frames of 64 x 160, the back wall's versions of 64; the roof band's strip 1920 x 2, at game y 40.
    const sizes = [drawMinaSkyStrip(), drawFarMina(), drawMidMina(), drawGroundMina(), drawDecorMina(), drawBackwall()].map((g) => [g.width, g.height]);
    expect(sizes).toEqual([[1920, 2], [1920, 640], [1920, 496], [35 * 64, 64], [7 * 64, 160], [4 * 64, 64]]);
    expect([FAR_MINA.top, FAR_MINA.h, MID_MINA.top, MID_MINA.h, MINA_SKY_END, MINA_STRIP]).toEqual([40, 160, 100, 124, 160, 2]);
    // The decor sheet's frames are World 1's plants' frame, 16 x 40 game px, as the scene slices it (`DECOR_FRAME`).
    expect([DECOR_FRAME.w, DECOR_FRAME.h]).toEqual([16, 40]);
    expect(sizes[4]).toEqual([7 * DECOR_FRAME.w * 4, DECOR_FRAME.h * 4]);
    // L-068: no sheet over 4096 px on a side.
    for (const [w, h] of sizes) expect(Math.max(w, h)).toBeLessThanOrEqual(4096);
  });

  it('GDD-ART-03 the mine uses only the Sierra 24 colours, with no outline', () => {
    for (const grid of [drawMinaSkyStrip(), drawFarMina(), drawMidMina(), drawGroundMina(), drawDecorMina(), drawBackwall()]) {
      for (const c of painted(grid)) expect(GDD, c).toContain(c);
    }
  });

  it('GDD-ART-06 every mine picture is drawn in whole game pixels, 4 x 4 art pixels', () => {
    for (const [name, grid] of Object.entries({ far: drawFarMina(), mid: drawMidMina(), ground: drawGroundMina(), decor: drawDecorMina(), backwall: drawBackwall() })) expect(offGrid(grid), name).toEqual([]);
  });

  it('GDD-ART-06 the sky slot underground: a checker strip between the roof band of gallery deep and the gallery base, the foot gallery deep', () => {
    const strip = drawMinaSkyStrip();
    for (const y of [0, 1]) expect(Array.from({ length: 8 }, (_, x) => strip.get(x, y))).toEqual([GALLERY_DEEP, GALLERY_DEEP, GALLERY_BASE, GALLERY_BASE, GALLERY_DEEP, GALLERY_DEEP, GALLERY_BASE, GALLERY_BASE]);
    expect(painted(strip)).toEqual(new Set([GALLERY_DEEP, GALLERY_BASE]));
    expect(MINA_FOOT).toBe(GALLERY_DEEP);
  });

  it('GDD-ART-06 the far and mid strips underground repeat every 480 px without a seam', () => {
    // The wall's beds and the ore vein run on over the seam: their courses repeat every 480 px.
    for (let x = 0; x < 480; x++) {
      STRATA_MINA.forEach((y0, k) => expect(strataRow(y0, x + 480, k), `bed ${k} at ${x}`).toBe(strataRow(y0, x, k)));
      expect(veinRow(x + 480), `vein at ${x}`).toBe(veinRow(x));
    }
    // And the seam (column 479 against 0) differs in no more rows than any two neighbouring columns of plain wall (no timber in either) do
    // inside the strip. Measured: the far strip's seam 7 rows, its 403 plain pairs at most 10 (a bed's pieces all starting at the seam made
    // it 13); the mid strip's seam 3, its 212 plain pairs at most 95.
    for (const [name, grid, top, h] of [['far', drawFarMina(), FAR_MINA.top, FAR_MINA.h], ['mid', drawMidMina(), MID_MINA.top, MID_MINA.h]]) {
      const px = at(grid, top);
      const plain = (x) => Array.from({ length: h }, (_, i) => px(x, top + i)).every((c) => c !== TIMBER_DARK);
      const pairs = Array.from({ length: 479 }, (_, x) => x).filter((x) => plain(x) && plain(x + 1)).map((x) => columnDiff(px, top, h, x, x + 1)).sort((a, b) => a - b);
      expect(plain(479) && plain(0), name).toBe(true);
      expect(columnDiff(px, top, h, 479, 0), name).toBeLessThanOrEqual(pairs.at(-1));
    }
  });

  it('GDD-ART-06 the ore vein is a seam in the rock: three or four runs 2 to 4 px thick along a bed, of uneven thickness, a few pockets', () => {
    const far = at(drawFarMina(), FAR_MINA.top);
    const ore = (x, y) => far(x, y) === STEEL || far(x, y) === MIST;
    // Its course follows one of the wall's beds, a fixed distance under it.
    const offsets = new Set(Array.from({ length: 480 }, (_, x) => veinRow(x) - strataRow(STRATA_MINA[VEIN_BED], x, VEIN_BED)));
    expect(offsets.size).toBe(1);
    expect([...offsets][0]).toBeGreaterThanOrEqual(8);
    // In each column, the ore in the band along its course (a row over it to 4 under) is one unbroken piece 2 to 4 px thick, or none.
    const thick = Array.from({ length: 480 }, (_, x) => {
      const rows = Array.from({ length: 6 }, (_, i) => veinRow(x) - 1 + i).filter((y) => ore(x, y));
      if (rows.length > 0) expect(rows.at(-1) - rows[0] + 1, `column ${x} unbroken`).toBe(rows.length);
      return rows.length;
    });
    const runs = [];
    thick.forEach((t, x) => {
      if (t === 0) return;
      expect(t, `column ${x}`).toBeGreaterThanOrEqual(2);
      expect(t, `column ${x}`).toBeLessThanOrEqual(4);
      if (x > 0 && thick[x - 1] > 0) runs.at(-1)[1] = x;
      else runs.push([x, x]);
    });
    expect(runs.length).toBeGreaterThanOrEqual(3);
    expect(runs.length).toBeLessThanOrEqual(4);
    // Each run long, the gaps between them clear, and its thickness uneven: 2, 3 and 4 px all show.
    for (const [x0, x1] of runs) expect(x1 - x0 + 1, `run ${x0}`).toBeGreaterThanOrEqual(30);
    expect(new Set(thick.filter((t) => t > 0))).toEqual(new Set([2, 3, 4]));
    // The pockets: ore off the band, in small pieces no bigger than 3 x 3, not touching it.
    const seen = new Set();
    const pockets = [];
    for (let x = 0; x < 480; x++) {
      for (let y = FAR_MINA.top; y < FAR_MINA.top + FAR_MINA.h; y++) {
        if (!ore(x, y) || seen.has(`${x},${y}`) || (y >= veinRow(x) - 1 && y <= veinRow(x) + 4)) continue;
        const piece = [];
        const stack = [[x, y]];
        while (stack.length) {
          const [cx, cy] = stack.pop();
          if (cx < 0 || cx >= 480 || seen.has(`${cx},${cy}`) || !ore(cx, cy)) continue;
          seen.add(`${cx},${cy}`);
          piece.push([cx, cy]);
          stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        pockets.push(piece);
      }
    }
    expect(pockets.length).toBeGreaterThanOrEqual(3);
    expect(pockets.length).toBeLessThanOrEqual(6);
    for (const piece of pockets) {
      const xs = piece.map(([px]) => px), ys = piece.map(([, py]) => py);
      expect(Math.max(...xs) - Math.min(...xs), `pocket at ${xs[0]}`).toBeLessThan(3);
      expect(Math.max(...ys) - Math.min(...ys), `pocket at ${xs[0]}`).toBeLessThan(3);
      expect(piece.every(([px, py]) => py < veinRow(px) - 2 || py > veinRow(px) + 5), `pocket at ${xs[0]} detached`).toBe(true);
    }
  });

  it('GDD-ART-06 behind the rows he plays in the mine has no gallery deep outside its two side tunnels, and no timber lit or timber', () => {
    // The play rows are y 40 to 224: all of the far strip and the mid strip. The tunnels' gallery deep lies inside their boxes (`TUNNELS`,
    // the openings' bounds, every bound included).
    const stray = [];
    const far = at(drawFarMina(), FAR_MINA.top);
    for (let y = FAR_MINA.top; y < FAR_MINA.top + FAR_MINA.h; y++) {
      for (let x = 0; x < 480; x++) {
        const c = far(x, y);
        if (c === null) stray.push(`far ${x},${y} empty`);
        if (c === GALLERY_DEEP && !TUNNELS.some((t) => x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1)) stray.push(`far ${x},${y}`);
        if (c === TIMBER_LIT || c === TIMBER) stray.push(`far ${x},${y} ${c}`);
      }
    }
    const mid = at(drawMidMina(), MID_MINA.top);
    for (let y = MID_MINA.top; y < MID_MINA.top + MID_MINA.h; y++) {
      for (let x = 0; x < 480; x++) if ([GALLERY_DEEP, TIMBER_LIT, TIMBER].includes(mid(x, y))) stray.push(`mid ${x},${y} ${mid(x, y)}`);
    }
    expect(stray).toEqual([]);
    expect(TUNNELS).toHaveLength(2);
    // Each tunnel is mostly gallery deep: a dark opening, not a mark.
    for (const t of TUNNELS) {
      let deep = 0;
      for (let y = t.y0; y <= t.y1; y++) for (let x = t.x0; x <= t.x1; x++) if (far(x, y) === GALLERY_DEEP) deep++;
      expect(deep / ((t.x1 - t.x0 + 1) * (t.y1 - t.y0 + 1))).toBeGreaterThan(0.9);
    }
  });

  it('GDD-ART-06 the mid strip underground is filled from y 200 to the floor, so the foot shows only in a pit, and see-through between its pieces above', () => {
    const mid = at(drawMidMina(), MID_MINA.top);
    const gaps = [];
    for (let y = MID_MINA_FOOT; y < 224; y++) for (let x = 0; x < 480; x++) if (mid(x, y) === null) gaps.push(`${x},${y}`);
    expect(MID_MINA_FOOT).toBe(200);
    expect(gaps).toEqual([]);
    let empty = 0;
    for (let y = MID_MINA.top; y < MID_MINA_FOOT; y++) for (let x = 0; x < 480; x++) if (mid(x, y) === null) empty++;
    expect(empty / (480 * (MID_MINA_FOOT - MID_MINA.top))).toBeGreaterThan(0.5);
  });

  it('GDD-ART-06 no lit flame colour in the mine backdrop outside its lamps, one from every second cap', () => {
    // Lamp amber and ochre light only inside the lamps' 6 x 8 boxes; each lamp has both, its core and its glow.
    expect(LAMPS).toHaveLength(3);
    expect(LAMPS.map((l) => [l.w, l.h])).toEqual([[6, 8], [6, 8], [6, 8]]);
    const mid = at(drawMidMina(), MID_MINA.top);
    const stray = [];
    for (let y = MID_MINA.top; y < MID_MINA.top + MID_MINA.h; y++) {
      for (let x = 0; x < 480; x++) {
        if (mid(x, y) !== LAMP_AMBER && mid(x, y) !== OCHRE_LIGHT) continue;
        if (!LAMPS.some((l) => x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h)) stray.push(`${x},${y}`);
      }
    }
    expect(stray).toEqual([]);
    for (const l of LAMPS) {
      const inside = new Set();
      for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) inside.add(mid(x, y));
      expect(inside.has(LAMP_AMBER) && inside.has(OCHRE_LIGHT)).toBe(true);
    }
    expect([...painted(drawFarMina())].filter((c) => c === LAMP_AMBER || c === OCHRE_LIGHT)).toEqual([]);
    // Their pools of light on the wall, gallery lit.
    for (const l of LAMPS) expect(mid(l.x - 6, l.y + 4)).toBe(GALLERY_LIT);
  });

  it('GDD-ART-06 the mine ground sheet: the outdoor walk line and ledge rows pixel for pixel, no grass, two chips of ochre shade and one of steel', () => {
    const mine = drawGroundMina();
    const outdoor = drawGround();
    for (const n of [0, 1]) {
      for (const r of [0, 4, 5]) {
        for (let y = 4 * r; y < 4 * r + 4; y++) for (let x = 0; x < 64; x++) expect(mine.get(n * 64 + x, y), `frame ${n} ${x},${y}`).toBe(outdoor.get(n * 64 + x, y));
      }
      expect(tileRow(mine, n, 0).every((c) => c === OCHRE_LIGHT)).toBe(true);
      // The trodden floor under the walk line: ochre with two chips of ochre shade and one of steel.
      expect(new Set([1, 2, 3].flatMap((r) => tileRow(mine, n, r)))).toEqual(new Set([OCHRE, OCHRE_SHADE, STEEL]));
      expect([chips(mine, n, OCHRE_SHADE, 1, 3), chips(mine, n, STEEL, 1, 3)], `frame ${n}`).toEqual([2, 1]);
    }
    for (const c of [ZACATE, PINE, PINE_DEEP]) expect(painted(mine).has(c), c).toBe(false);
    // The rock tile: a crack in version 0, a streak of ore (steel and one mist white pixel) in version 1.
    expect(tileCells(mine, 2).includes(ROCK_DEEP)).toBe(true);
    expect(tileCells(mine, 3).filter((c) => c === MIST)).toHaveLength(1);
    expect(tileCells(mine, 3).includes(STEEL)).toBe(true);
  });

  it('GDD-ART-06 the mine ground tiles meet without a seam in any order of versions', () => {
    const g = drawGroundMina();
    for (const [a, b] of [[0, 1], [2, 3]]) for (const x of [0, 15]) expect(tileColumn(g, a, x), `frames ${a} ${b} column ${x}`).toEqual(tileColumn(g, b, x));
    for (const n of [0, 1, 2, 3]) expect(tileColumn(g, n, 0), `frame ${n}`).toEqual(tileColumn(g, n, 15));
  });

  // The mine's frames after the shared 28 (`src/ui/groundTiles.ts`): the underside 28 and 29, deep rock 30 and 31, the one-tile ledge 32
  // and 33, the plain rock tile's second version with no ore 34. Frame 3 is the rock tile with the ore streak.
  const UNDERSIDE = [28, 29], DEEP = [30, 31], LEDGE = [32, 33], ROCK = [2, 34];
  /** Deep rock's mean L*, measured (L-072). */
  const DEEP_L = 46.6;

  it('GDD-ART-06 the ore streak underground is frame 3 alone: no slope, no tile under a slope and no new frame carries it', () => {
    const g = drawGroundMina();
    const streak = Array.from({ length: 35 }, (_, n) => n).filter((n) => tileCells(g, n).includes(MIST));
    expect(streak).toEqual([3]);
    // The plain rock tile's second version is frame 3 without it: the same strata and specks, ochre where the streak was.
    const diff = tileCells(g, 3).map((c, i) => [c, tileCells(g, 34)[i]]).filter(([a, b]) => a !== b);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.every(([a, b]) => [STEEL, MIST].includes(a) && b === OCHRE)).toBe(true);
  });

  it('GDD-ART-06 the underside: the rock frame over a 3 px lip of ochre shade, its last row a broken line of rock deep, a chip or two, no pale colour', () => {
    const g = drawGroundMina();
    for (const v of [0, 1]) {
      const n = UNDERSIDE[v];
      // Above the lip the tile is the plain rock frame of its version, the lit skin.
      for (let r = 0; r < 13; r++) expect(tileRow(g, n, r), `frame ${n} row ${r}`).toEqual(tileRow(g, ROCK[v], r));
      const lip = [13, 14, 15].flatMap((r) => tileRow(g, n, r));
      expect(new Set(lip), `frame ${n}`).toEqual(new Set([OCHRE_SHADE, ROCK_DEEP]));
      for (const c of [OCHRE_LIGHT, OCHRE, ZACATE]) expect(lip.includes(c), `frame ${n} ${c}`).toBe(false);
      // Rows 13 and 14 ochre shade but for the chips; the last row rock deep, broken.
      expect(tileRow(g, n, 13).every((c) => c === OCHRE_SHADE), `frame ${n} row 13`).toBe(true);
      const last = tileRow(g, n, 15);
      expect(last.filter((c) => c === ROCK_DEEP).length, `frame ${n} row 15`).toBeGreaterThanOrEqual(10);
      expect(last.includes(OCHRE_SHADE), `frame ${n} row 15 broken`).toBe(true);
      // The chips: rock deep in row 14 over rock deep in row 15, with a break in the line beside them, one or two per tile.
      const chipsAt = tileRow(g, n, 14).flatMap((c, x) => (c === ROCK_DEEP ? [x] : []));
      expect(chipsAt.length, `frame ${n} chips`).toBeGreaterThanOrEqual(1);
      expect(chipsAt.length, `frame ${n} chips`).toBeLessThanOrEqual(2);
      for (const x of chipsAt) expect([last[x], last[x - 1], last[x + 1]], `frame ${n} chip ${x}`).toEqual([ROCK_DEEP, OCHRE_SHADE, OCHRE_SHADE]);
    }
    expect(tileCells(g, UNDERSIDE[0])).not.toEqual(tileCells(g, UNDERSIDE[1]));
  });

  it('GDD-ART-06 the one-tile ledge: the top tile walk line and ledge over the underside lip of its version', () => {
    const g = drawGroundMina();
    for (const v of [0, 1]) {
      for (let r = 0; r < 13; r++) expect(tileRow(g, LEDGE[v], r), `frame ${LEDGE[v]} row ${r}`).toEqual(tileRow(g, v, r));
      for (const r of [13, 14, 15]) expect(tileRow(g, LEDGE[v], r), `frame ${LEDGE[v]} row ${r}`).toEqual(tileRow(g, UNDERSIDE[v], r));
    }
  });

  it('GDD-ART-06 deep rock: ochre shade with two long broken strata of rock deep and a few ochre specks, no ore, quieter than the lit skin', () => {
    const g = drawGroundMina();
    for (const n of DEEP) {
      const cells = tileCells(g, n);
      expect(new Set(cells), `frame ${n}`).toEqual(new Set([OCHRE_SHADE, ROCK_DEEP, OCHRE]));
      // Two strata, each mostly across the tile: rock deep in at least 12 of the 16 columns over the two rows of each (its row and its dip).
      for (const row of [5, 12]) {
        const cols = Array.from({ length: 16 }, (_, x) => cell(g, n, x, row) === ROCK_DEEP || cell(g, n, x, row + 1) === ROCK_DEEP).filter(Boolean).length;
        expect(cols, `frame ${n} stratum ${row}`).toBeGreaterThanOrEqual(12);
        expect(cols, `frame ${n} stratum ${row} broken`).toBeLessThan(16);
      }
      expect(cells.filter((c) => c === OCHRE).length, `frame ${n} specks`).toBeGreaterThanOrEqual(2);
      expect(cells.filter((c) => c === OCHRE).length, `frame ${n} specks`).toBeLessThanOrEqual(4);
    }
    expect(tileCells(g, DEEP[0])).not.toEqual(tileCells(g, DEEP[1]));
    // Measured (L-072): deep rock's mean L* 46.6, ΔL 17.8 under the bright rock frame's 64.4 (frames 2 and 3, as B1 measured it) and
    // 22.2 over gallery base's.
    const deep = meanL(g, 30 * 64, 128), bright = meanL(g, 128, 128), gallery = lab(GALLERY_BASE)[0];
    expect([Math.round(deep * 10) / 10, Math.round(bright * 10) / 10]).toEqual([DEEP_L, 64.4]);
    expect([Math.round((bright - deep) * 10) / 10, Math.round((deep - gallery) * 10) / 10]).toEqual([17.8, 22.2]);
    expect(bright - deep).toBeGreaterThanOrEqual(12);
    expect(deep - gallery).toBeGreaterThanOrEqual(15);
    // The floor's ochre over gallery base stays ΔL 41.9.
    expect(Math.round((lab(OCHRE)[0] - gallery) * 10) / 10).toBe(41.9);
  });

  it('GDD-ART-06 the mine new frames meet their neighbours without a seam, left to right and deep over deep', () => {
    const g = drawGroundMina();
    // Left to right: each new frame's two edge columns are alike, and alike in both versions; the underside and the ledge share the plain
    // rock's and the top tile's edges above the lip.
    for (const pair of [UNDERSIDE, DEEP, LEDGE, ROCK]) {
      for (const n of pair) expect(tileColumn(g, n, 0), `frame ${n}`).toEqual(tileColumn(g, n, 15));
      expect(tileColumn(g, pair[0], 0), `frames ${pair}`).toEqual(tileColumn(g, pair[1], 0));
    }
    expect(tileColumn(g, UNDERSIDE[0], 0).slice(0, 13)).toEqual(tileColumn(g, 2, 0).slice(0, 13));
    expect(tileColumn(g, LEDGE[0], 0).slice(0, 13)).toEqual(tileColumn(g, 0, 0).slice(0, 13));
    // Deep over deep, in any order of versions: a tile's last row meets the first row of the one under it.
    for (const a of DEEP) for (const b of DEEP) expect(tileRow(g, a, 15), `${a} over ${b}`).toEqual(tileRow(g, b, 0));
  });

  it('GDD-ART-06 each mine decor frame is as tall as its kind and stands on the frame bottom row', () => {
    // The GDD's sizes, game px: ore heap 14 x 8, timber stack 16 x 10, barrel 10 x 12, pick and shovel 12 x 16, ore bucket 10 x 10, lantern
    // on a peg post 8 x 24, ore sacks 14 x 10.
    const sizes = [[14, 8], [16, 10], [10, 12], [12, 16], [10, 10], [8, 24], [14, 10]];
    expect(MINA_DECOR_SIZES).toEqual(sizes);
    const g = drawDecorMina();
    sizes.forEach(([w, h], n) => {
      const px = [];
      for (let y = 0; y < 160; y++) for (let x = 0; x < 64; x++) if (g.get(n * 64 + x, y) !== null) px.push({ x, y, colour: g.get(n * 64 + x, y) });
      const xs = px.map((p) => p.x), ys = px.map((p) => p.y);
      expect(Math.min(...ys), `decor ${n} ${h} tall`).toBe(160 - h * 4);
      expect(ys.includes(159), `decor ${n} stands on the bottom row`).toBe(true);
      expect(Math.max(...xs) - Math.min(...xs) + 1, `decor ${n} width`).toBeLessThanOrEqual(w * 4);
      expect(Math.abs((Math.min(...xs) + Math.max(...xs) + 1) / 2 - 32), `decor ${n} centred`).toBeLessThanOrEqual(4);
      // No lit lamp, candle or flame: none of the flame colours.
      expect(px.some((p) => p.colour === LAMP_AMBER || p.colour === OCHRE_LIGHT), `decor ${n} flame`).toBe(false);
    });
  });

  it('GDD-ART-06 no mine ground, decor or back wall colour is within ΔE 12 of Poncho\'s body colours', () => {
    const body = Object.entries(PONCHO).filter(([k]) => !['#', 'n', 'W'].includes(k)).map(([, c]) => c);
    expect(body).toHaveLength(10);
    for (const c of new Set([...painted(drawGroundMina()), ...painted(drawDecorMina()), ...painted(drawBackwall())])) {
      for (const p of body) expect(deltaE(c, p), `${c} against ${p}`).toBeGreaterThan(12);
    }
  });

  it('GDD-ART-06 the floor underground is 42 L* lighter than the gallery wall behind it', () => {
    expect(Math.round(lab(OCHRE)[0] - lab(GALLERY_BASE)[0])).toBe(42);
  });

  it('GDD-WLD-17 the back wall: ochre shade with rock deep marks and ochre specks, no walk line, darker than the rock tile and far from the outline', () => {
    const wall = drawBackwall();
    const ground = drawGroundMina();
    for (const n of WALL_VERSIONS) {
      const cells = tileCells(wall, n);
      expect(new Set(cells), `version ${n}`).toEqual(new Set([OCHRE_SHADE, ROCK_DEEP, OCHRE]));
      // Mostly ochre shade, a handful of marks.
      expect(cells.filter((c) => c === OCHRE_SHADE).length, `version ${n}`).toBeGreaterThanOrEqual(256 - 16);
      expect(tileRow(wall, n, 0).every((c) => c === OCHRE_SHADE), `version ${n} no walk line`).toBe(true);
    }
    // Four versions, each its own.
    expect(new Set(WALL_VERSIONS.map((n) => tileCells(wall, n).join())).size).toBe(4);
    // Measured (L-072): the back wall's mean L* over its four versions is 47.8, the rock tile's 64.4 (the canyon's 64.3): ΔL 16.6 (B1's
    // two versions gave 47.9 and 16.5).
    const dl = meanL(ground, 128, 128) - meanL(wall, 0, 256);
    expect(Math.round(meanL(wall, 0, 256) * 10) / 10).toBe(WALL_L);
    expect(Math.round(dl * 10) / 10).toBe(16.6);
    expect(dl).toBeGreaterThanOrEqual(15);
    expect(meanL(drawGround(), 128, 128) - meanL(wall, 0, 256)).toBeGreaterThanOrEqual(15);
    for (const n of WALL_VERSIONS) expect(meanL(ground, 128, 128) - meanL(wall, 64 * n, 64), `version ${n}`).toBeGreaterThanOrEqual(15);
    // Its colours are ΔE 20 or more from the outline (measured: ochre shade 64.6, rock deep 33.9, ochre 84.8).
    for (const c of painted(wall)) expect(deltaE(c, NEAR_BLACK), c).toBeGreaterThanOrEqual(20);
  });

  it('GDD-WLD-17 the back wall tiles meet without a seam on every side in any order of versions', () => {
    const wall = drawBackwall();
    for (const n of WALL_VERSIONS) {
      for (const i of [0, 15]) {
        expect(tileRow(wall, n, i).every((c) => c === OCHRE_SHADE), `version ${n} row ${i}`).toBe(true);
        expect(tileColumn(wall, n, i).every((c) => c === OCHRE_SHADE), `version ${n} column ${i}`).toBe(true);
      }
      // Its lower right 2 x 2 cells are plain ochre shade in every version: where `e2e/level3-1.spec.ts` reads it by pixels (L-017).
      for (const [x, r] of [[14, 14], [15, 14], [14, 15], [15, 15]]) expect(cell(wall, n, x, r), `version ${n} ${x},${r}`).toBe(OCHRE_SHADE);
    }
  });
});
