import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CART, HITBOX } from '../../src/config/tuning';
import * as look from '../../src/ui/railLook';
import { buildRails } from './make-rails.mjs';
import {
  BENT_TOP, BUFFER_ART, CART_ART, CART_LOOKS, drawBuffer, drawCartFrames, drawPost, drawRail, drawVagoneta, drawViga, drawVigaPieces, POST_ART, RAIL_ART, RAIL_FRAMES,
  VIGA_ART, VIGA_PIECES,
} from './rails.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'sierra');

// GDD-ART-06: World 3's 24 colours and the outline, written here rather than read back from the script (L-011).
const GDD = [
  '#527391', '#8AA5B8', '#BFCDD2', '#EEF1EA', '#A9B8AC', '#7F9488', '#5B7067', '#24403A', '#3F6350', '#A3A85A', '#EDCB86', '#CC983F', '#9A6A2C',
  '#5A3B28', '#A89480', '#75614F', '#43362F', '#93A0AE', '#353A48', '#B0562E', '#221D2E', '#3D3650', '#5C5269', '#F0A23A',
];
const OUTLINE = '#070509';
const [MIST, STEEL, IRON, RUST, OCHRE, GALLERY_BASE, TIMBER_LIT, TIMBER] = ['#EEF1EA', '#93A0AE', '#353A48', '#B0562E', '#CC983F', '#3D3650', '#A89480', '#75614F'];
const S = 4; // art px a game px

const RAIL = drawRail();
const CARTS = drawCartFrames();
const painted = (grid) => new Set(grid.cells.filter((c) => c !== null));
/** The game px cell (x, y) of frame `n` of a sheet of `w` x `h` game px frames in one row: its colour, read in the cell's middle. */
const cell = (sheet, w, n, x, y) => sheet.get((n * w + x) * S + 2, y * S + 2);
const railCell = (frame, x, y) => cell(RAIL, RAIL_ART.w, RAIL_FRAMES.indexOf(frame), x, y);
/** The art px of a picture (or part of it) in a colour. */
const count = (grid, colour, x0 = 0, y0 = 0, w = grid.width, h = grid.height) => {
  let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (grid.get(x, y) === colour) n++;
  return n;
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
const deltaL = (a, b) => Math.abs(lab(a)[0] - lab(b)[0]);
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

describe('GDD-ART-06 the railway things', () => {
  it('GDD-ART-06 the committed rail, buffer, post, vagoneta and viga PNGs are the ones the script makes', () => {
    const built = buildRails();
    expect(Object.keys(built)).toEqual(['rail.png', 'buffer.png', 'post.png', 'vagoneta.png', 'viga.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
  });

  it('GDD-ART-06 the game\'s copy of the sheets\' layout is the script\'s (src/ui/railLook.ts)', () => {
    expect([...look.RAIL_FRAMES]).toEqual(RAIL_FRAMES);
    expect(look.RAIL_ART).toEqual(RAIL_ART);
    expect(look.BENT_TOP).toEqual(BENT_TOP);
    expect([...look.CART_LOOKS]).toEqual(CART_LOOKS);
    expect([look.BUFFER_SIZE, look.POST_SIZE.w, look.POST_SIZE.h, look.CART_SIZE]).toEqual([BUFFER_ART, POST_ART.w, POST_ART.h, { w: CART_ART.w, h: CART_ART.h }]);
  });

  it('GDD-ART-06 the sheets have their sizes, none over 4096 px a side (L-068)', () => {
    const sizes = [RAIL, drawBuffer(), drawPost(), drawVagoneta(), drawViga()].map((g) => [g.width, g.height]);
    // The rail: 11 frames of 16 x 24 game px; the buffer 16 x 16; the post 8 x 24; the cart 3 looks x 2 layers of 32 x 16; the beam 3 x 16 x 16.
    expect(sizes).toEqual([[704, 96], [64, 64], [32, 96], [384, 128], [192, 64]]);
    expect(RAIL_FRAMES).toHaveLength(11);
    expect([BUFFER_ART, POST_ART.w, POST_ART.h, CART_ART.w, CART_ART.h, VIGA_ART.w, VIGA_ART.h]).toEqual([{ w: 16, h: 16 }, 8, 24, CART.width, CART.height, 16, 16]);
    for (const [w, h] of sizes) expect(Math.max(w, h)).toBeLessThanOrEqual(4096);
  });

  it('GDD-ART-06 every railway thing uses only World 3\'s 24 colours and the outline', () => {
    for (const g of [RAIL, drawBuffer(), drawPost(), drawVagoneta(), drawViga()]) for (const c of painted(g)) expect([...GDD, OUTLINE]).toContain(c);
  });

  it('GDD-ART-06 the level rail is steel over iron dark in every column and fills only the bottom 4 px of its tile', () => {
    const g = RAIL_ART.ground;
    for (let x = 0; x < RAIL_ART.w; x++) {
      expect([railCell('level', x, g - 4), railCell('level', x, g - 3)], `column ${x}`).toEqual([STEEL, IRON]);
      for (let y = 0; y < RAIL_ART.h; y++) if (y < g - 4 || y >= g) expect(railCell('level', x, y), `${x},${y}`).toBeNull();
    }
    // Sleepers 4 x 2 every 8 px, see-through between them.
    expect(Array.from({ length: 16 }, (_, x) => (railCell('level', x, g - 1) === TIMBER ? 1 : 0)).join('')).toBe('0011110000111100');
  });

  it('GDD-ART-06 on a slope the rail steps 1 px per px', () => {
    const g = RAIL_ART.ground;
    for (let x = 0; x < RAIL_ART.w; x++) {
      expect([railCell('slopeUp', x, g - 4 - x), railCell('slopeUp', x, g - 3 - x)], `up ${x}`).toEqual([STEEL, IRON]);
      expect([railCell('slopeDown', x, g - 19 + x), railCell('slopeDown', x, g - 18 + x)], `down ${x}`).toEqual([STEEL, IRON]);
    }
  });

  it('GDD-ART-05 the rail, the trestle and the broken end have no outline; the buffer, the cart, the beam and the post\'s board and lantern do', () => {
    expect(count(RAIL, OUTLINE)).toBe(0);
    expect(count(drawBuffer(), OUTLINE)).toBeGreaterThan(0);
    for (const { look, back, front } of CARTS) {
      expect(count(back, OUTLINE), `${look} back`).toBeGreaterThan(0);
      expect(count(front, OUTLINE), `${look} front`).toBeGreaterThan(0);
    }
    for (const { piece, grid } of drawVigaPieces()) expect(count(grid, OUTLINE), piece).toBeGreaterThan(0);
    const post = drawPost();
    const { board, lantern } = POST_ART;
    expect(count(post, OUTLINE, 0, 0, post.width, board * S)).toBeGreaterThan(0);
    expect(count(post, OUTLINE, lantern.x * S, lantern.y * S, lantern.w * S, lantern.h * S)).toBeGreaterThan(0);
    // The pole, under the lantern down to the ground: no outline.
    const below = (lantern.y + lantern.h) * S;
    expect(count(post, OUTLINE, 0, below, post.width, post.height - below)).toBe(0);
    expect(count(post, TIMBER, 0, below, post.width, post.height - below)).toBeGreaterThan(0);
  });

  it('GDD-ART-06 the broken end\'s torn tips are mist white', () => {
    for (const x of [14, 15]) {
      const ys = Array.from({ length: RAIL_ART.h }, (_, y) => y).filter((y) => railCell('broken', x, y) !== null);
      expect(railCell('broken', x, ys[0]), `column ${x}`).toBe(MIST);
    }
    // Nothing past the tips: the rail's two rows end in the tile's last column.
    expect(railCell('broken', 15, RAIL_ART.ground - 4)).toBeNull();
  });

  it('GDD-ART-06 the three rail ends differ by silhouette', () => {
    // Each end's silhouette (its painted game px), cropped to its box and lined up on its bottom middle: the broken end's last tile, the
    // buffer, the post's board. Measured (L-072): their overlap over their union is 0.23 (broken end, buffer), 0.28 (broken end, board) and
    // 0.20 (buffer, board), each under 0.6.
    const mask = (grid, x0, y0, w, h) => {
      const m = [];
      for (let y = y0; y < y0 + h; y += S) for (let x = x0; x < x0 + w; x += S) if (grid.get(x + 2, y + 2) !== null) m.push([(x - x0) / S, (y - y0) / S]);
      const [xs, ys] = [m.map((p) => p[0]), m.map((p) => p[1])];
      const [mid, bottom] = [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.max(...ys)];
      return new Set(m.map(([x, y]) => `${x - mid},${y - bottom}`));
    };
    const ends = {
      broken: mask(RAIL, RAIL_FRAMES.indexOf('broken') * RAIL_ART.w * S, 0, RAIL_ART.w * S, RAIL_ART.h * S),
      buffer: mask(drawBuffer(), 0, 0, 64, 64),
      board: mask(drawPost(), 0, 0, POST_ART.w * S, POST_ART.board * S),
    };
    const overlap = (a, b) => {
      let both = 0;
      for (const k of a) if (b.has(k)) both++;
      return both / (a.size + b.size - both);
    };
    expect(overlap(ends.broken, ends.buffer)).toBeLessThan(0.6);
    expect(overlap(ends.broken, ends.board)).toBeLessThan(0.6);
    expect(overlap(ends.buffer, ends.board)).toBeLessThan(0.6);
  });

  it('GDD-ART-06 the cart\'s front layer covers Poncho\'s feet and shins on its floor', () => {
    // His feet are on the floor CART.floorPx over the rail's ground, the cart's bottom: the 4 rows over it, across his body's width round
    // the cart's middle, are the front wall's in every look.
    const floor = CART.height - CART.floorPx;
    expect(floor).toBe(CART_ART.floor);
    for (const { look, front } of CARTS) {
      for (let y = floor - 4; y < floor; y++) {
        for (let x = CART.width / 2 - HITBOX.width / 2; x < CART.width / 2 + HITBOX.width / 2; x++) {
          for (const [dx, dy] of [[0, 0], [3, 3]]) expect(front.get(x * S + dx, y * S + dy), `${look} ${x},${y}`).not.toBeNull();
        }
      }
    }
  });

  it('GDD-ART-06 standing and rolling differ by the chock', () => {
    // The chock: timber wedged under the leading (right) wheel, columns 28 to 31, rows 8 to 11; only the standing look has it.
    const chock = (front) => count(front, TIMBER, 28 * S, 8 * S, 4 * S, 4 * S) + count(front, TIMBER_LIT, 28 * S, 8 * S, 4 * S, 4 * S);
    expect(CARTS.map((f) => f.look)).toEqual(CART_LOOKS);
    expect(chock(CARTS[0].front)).toBeGreaterThan(0);
    for (const f of CARTS.slice(1)) expect(chock(f.front), f.look).toBe(0);
    for (const f of CARTS) expect(count(f.back, TIMBER) + count(f.back, TIMBER_LIT), f.look).toBe(0);
    // Rolling, 2 px of dust trail the rear wheel; the hubs' glint turns and the tub sits 1 px lower on its second frame.
    const dust = (front) => count(front, TIMBER_LIT, 0, 0, 3 * S, CART_ART.h * S);
    expect(CARTS.map((f) => dust(f.front))).toEqual([0, 2 * S * S, 2 * S * S]);
    expect(CARTS[1].front.cells).not.toEqual(CARTS[2].front.cells);
    const top = (grid) => Math.floor(grid.cells.findIndex((c) => c !== null) / grid.width);
    expect(CARTS.map((f) => top(f.back))).toEqual([0, 0, S]);
  });

  it('GDD-ART-06 the cart\'s rust stands off the ochre floor and the gallery wall', () => {
    // Measured on the palette (L-072): ΔL 19 from ochre and 23 from gallery base, as the GDD has it.
    expect(Math.round(deltaL(RUST, OCHRE))).toBe(19);
    expect(Math.round(deltaL(RUST, GALLERY_BASE))).toBe(23);
    expect(Math.round(deltaE(RUST, OCHRE))).toBe(33);
    for (const { look, front } of CARTS) expect(count(front, RUST), look).toBeGreaterThan(count(front, STEEL));
  });

  it('GDD-ART-06 the beam is 10 px thick against its tile\'s bottom, with a mist white lower edge', () => {
    for (const { piece, grid } of drawVigaPieces()) {
      for (let x = 0; x < grid.width; x++) {
        const col = Array.from({ length: grid.height }, (_, y) => grid.get(x, y));
        expect(col.slice(0, (VIGA_ART.h - VIGA_ART.thick) * S).every((c) => c === null), `${piece} ${x} over`).toBe(true);
        expect(col.slice((VIGA_ART.h - VIGA_ART.thick) * S).every((c) => c !== null), `${piece} ${x} body`).toBe(true);
        // Its lowest row that is not the outline is mist white (the end columns are the outline all the way down).
        const inner = col.map((c, y) => [c, y]).filter(([c]) => c !== null && c !== OUTLINE);
        if (inner.length > 0) expect(inner[inner.length - 1][0], `${piece} ${x}`).toBe(MIST);
      }
    }
    expect(VIGA_PIECES).toEqual(['left', 'middle', 'right']);
  });
});
