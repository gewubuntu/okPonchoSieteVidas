import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CART, HITBOX, TILE } from '../../src/config/tuning';
import { parseTiles } from '../../src/sim/tilemap';
import * as look from '../../src/ui/railLook';
import { buildRails } from './make-rails.mjs';
import {
  BENT_TOP, BUFFER_ART, CART_ART, CART_LOOKS, drawBuffer, drawCartFrames, drawPost, drawRail, drawVagoneta, drawViga, drawVigaPieces, POST_ART, RAIL_ART, RAIL_FRAMES,
  SILL_ROWS, VIGA_ART, VIGA_PIECES,
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

/** A cart front layer's chock (timber under the leading, right, wheel: game px columns 28 to 31, rows 8 to 11) and its dust (timber lit in columns 0 to 2), in art px. */
const chock = (front) => count(front, TIMBER, 28 * S, 8 * S, 4 * S, 4 * S) + count(front, TIMBER_LIT, 28 * S, 8 * S, 4 * S, 4 * S);
const dust = (front) => count(front, TIMBER_LIT, 0, 0, 3 * S, CART_ART.h * S);

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
    expect(look.SILL_ROWS).toBe(SILL_ROWS);
    expect([...look.CART_LOOKS]).toEqual(CART_LOOKS);
    expect([look.BUFFER_SIZE, look.POST_SIZE.w, look.POST_SIZE.h, look.CART_SIZE]).toEqual([BUFFER_ART, POST_ART.w, POST_ART.h, { w: CART_ART.w, h: CART_ART.h }]);
  });

  it('GDD-ART-06 the sheets have their sizes, none over 4096 px a side (L-068)', () => {
    const sizes = [RAIL, drawBuffer(), drawPost(), drawVagoneta(), drawViga()].map((g) => [g.width, g.height]);
    // The rail: 15 frames of 16 x 24 game px; the buffer 16 x 16; the post 8 x 24; the cart 4 looks x 2 layers of 32 x 16; the beam 4 x 16 x 16.
    expect(sizes).toEqual([[960, 96], [64, 64], [32, 96], [512, 128], [256, 64]]);
    expect(RAIL_FRAMES).toHaveLength(15);
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
    expect(CARTS.map((f) => f.look)).toEqual(CART_LOOKS);
    expect(chock(CARTS[0].front)).toBeGreaterThan(0);
    for (const f of CARTS.slice(1)) expect(chock(f.front), f.look).toBe(0);
    for (const f of CARTS) expect(count(f.back, TIMBER) + count(f.back, TIMBER_LIT), f.look).toBe(0);
    // Rolling, 2 px of dust trail the rear wheel; the hubs' glint turns and the tub sits 1 px lower on its second frame.
    expect(CARTS.map((f) => dust(f.front))).toEqual([0, 2 * S * S, 2 * S * S, 0]);
    expect(CARTS[1].front.cells).not.toEqual(CARTS[2].front.cells);
    const top = (grid) => Math.floor(grid.cells.findIndex((c) => c !== null) / grid.width);
    expect(CARTS.map((f) => top(f.back))).toEqual([0, 0, S, 0]);
  });

  it('GDD-ART-06 a cart stopped at its buffer shows the standing frame without its chock or dust', () => {
    const [standing, stopped] = ['standing', 'stopped'].map((name) => CARTS.find((f) => f.look === name));
    expect(stopped).toBeDefined();
    expect([chock(stopped.front), dust(stopped.front)]).toEqual([0, 0]);
    // Its back layer is the standing one's, and so is its front layer left of the chock and the outline round it (game px 0 to 25): the
    // hubs' glint where it stands, the tub not lowered.
    expect(stopped.back.cells).toEqual(standing.back.cells);
    for (let y = 0; y < CART_ART.h * S; y++) for (let x = 0; x < 26 * S; x++) expect(stopped.front.get(x, y), `${x},${y}`).toBe(standing.front.get(x, y));
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
    expect(VIGA_PIECES).toEqual(['left', 'middle', 'right', 'single']);
  });

  it('GDD-ART-06 the one-tile beam has both ends\' end grain in one piece', () => {
    // A beam one tile along: its left 4 game px are the left end's, its right 4 the right end's, outline and rings, its strap between.
    const pieces = Object.fromEntries(drawVigaPieces().map(({ piece, grid }) => [piece, grid]));
    const end = 4 * S;
    for (let y = 0; y < VIGA_ART.h * S; y++) {
      for (let x = 0; x < end; x++) {
        expect(pieces.single.get(x, y), `left ${x},${y}`).toBe(pieces.left.get(x, y));
        expect(pieces.single.get(VIGA_ART.w * S - 1 - x, y), `right ${x},${y}`).toBe(pieces.right.get(VIGA_ART.w * S - 1 - x, y));
      }
    }
    expect(count(pieces.single, IRON, end, 0, VIGA_ART.w * S - 2 * end, VIGA_ART.h * S)).toBeGreaterThan(0);
  });
});

// GDD-ART-06 (Things, the trestle; the second pass): the trestle as the game lays it out (`railLook`), its frames painted in list order onto
// the level in game px, each down to its height.
const TIMBER_DARK = '#43362F';
const STRINGERS = ['stringer'];
const TRESTLE = ['bent', 'leg', 'sill'];

/** The colour of every game px the images of `parts` paint, by row: `grid[y][x]`, null where none does. */
function laidOut(world, rails, rows, cols, parts) {
  const grid = Array.from({ length: rows * TILE }, () => Array(cols * TILE).fill(null));
  for (const im of look.railLook(world, rails, rows)) {
    if (!parts.includes(im.part)) continue;
    for (let y = 0; y < im.height; y++) {
      for (let x = 0; x < RAIL_ART.w; x++) {
        const c = railCell(im.frame, im.flip ? RAIL_ART.w - 1 - x : x, y);
        if (c !== null) grid[im.y + y][im.x + x] = c;
      }
    }
  }
  return grid;
}

/** A level `rows` x `cols` from a function of (column, row) that says where ground is. */
const levelOf = (rows, cols, ground) => parseTiles(Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_t, c) => (ground(c, r) ? '#' : '.')).join('')));

// 20 rows (bottom y = 320), 34 columns, the floor at row 8 (y = 128): a pit open to the level's bottom at columns 10 to 14 and one floored at
// row 17 (y = 272) at columns 20 to 24. A level rail on the floor from column 6 to 27 crosses both, so each holds three bents (columns 10, 12,
// 14 and 20, 22, 24) 190 and 142 px tall, from 130 (2 px under the rail's ground) down to the bottom and to the floor.
const DEEP = levelOf(20, 34, (c, r) => (c >= 10 && c <= 14 ? false : c >= 20 && c <= 24 ? r >= 17 : r >= 8));
const DEEP_RAIL = { x: 6 * TILE, y: 128, dir: 1, segments: [{ kind: 'level', tiles: 22 }], end: 'buffer' };
const DEEP_LAID = laidOut(DEEP, [DEEP_RAIL], 20, 34, TRESTLE);
const DEEP_BENTS = [
  ...[10, 12, 14].map((col) => ({ col, top: 130, foot: 320, sill: false })),
  ...[20, 22, 24].map((col) => ({ col, top: 130, foot: 272, sill: true })),
];

/** In row `y` of bent `col`, its two posts: each one's left column in the bent's frame (its timber edge) and what is between them. */
function postsAt(grid, col, y) {
  const row = grid[y].slice(col * TILE, col * TILE + TILE);
  const edges = row.map((c, x) => (c === TIMBER ? x : -1)).filter((x) => x >= 0);
  return { row, edges };
}

describe('GDD-ART-06 the trestle\'s bents, squared timber', () => {
  it('GDD-ART-06 a bent\'s two posts are 3 px wide, timber dark with a timber edge on the lit left side, all the way down', () => {
    for (const { col, top, foot, sill } of DEEP_BENTS) {
      for (let y = top + 3; y < foot - (sill ? SILL_ROWS : 0); y++) {
        const { row, edges } = postsAt(DEEP_LAID, col, y);
        expect(edges, `bent ${col} row ${y}`).toHaveLength(2);
        const [a, b] = edges;
        // Left post: nothing on its outer (left) side; right post: nothing on its outer (right) side.
        expect([row[a - 1] ?? null, row[a + 1], row[a + 2]], `bent ${col} row ${y} left post`).toEqual([null, TIMBER_DARK, TIMBER_DARK]);
        expect([row[b + 1], row[b + 2], row[b + 3] ?? null], `bent ${col} row ${y} right post`).toEqual([TIMBER_DARK, TIMBER_DARK, null]);
      }
    }
  });

  it('GDD-ART-06 a bent\'s posts lean in 2 px as straight lines, each edge moving at most 1 px per 8 rows and only one way', () => {
    for (const { col, top, foot, sill } of DEEP_BENTS) {
      const lefts = [];
      for (let y = top + 3; y < foot - (sill ? SILL_ROWS : 0); y++) {
        const [a, b] = postsAt(DEEP_LAID, col, y).edges;
        // The two posts mirror each other about the bent's middle.
        expect(a + b + 2, `bent ${col} row ${y}`).toBe(TILE - 1);
        lefts.push(a);
      }
      // Going down, the left post's edge only moves left (the right one only right), 1 px at a time, each step at least 8 rows after the last.
      const steps = lefts.map((a, i) => (i > 0 && a !== lefts[i - 1] ? i : -1)).filter((i) => i > 0);
      for (const i of steps) expect(lefts[i - 1] - lefts[i], `bent ${col} step at ${i}`).toBe(1);
      for (let k = 0; k < steps.length; k++) expect(steps[k] - (k > 0 ? steps[k - 1] : 0), `bent ${col} step ${k}`).toBeGreaterThanOrEqual(8);
      // 2 px in all, top to foot.
      expect(lefts[0] - lefts[lefts.length - 1], `bent ${col}`).toBe(2);
    }
  });

  it('GDD-ART-06 a bent has an X of cross braces 2 px wide every 32 px of its height', () => {
    for (const { col, top, foot, sill } of DEEP_BENTS) {
      const between = (y) => {
        const { row, edges } = postsAt(DEEP_LAID, col, y);
        return row.map((c, x) => (x > edges[0] + 2 && x < edges[1] && c !== null ? x : -1)).filter((x) => x >= 0);
      };
      const bottom = foot - (sill ? SILL_ROWS : 0);
      // Where the posts stand plumb (from 19 rows under the bent's top): in every row two arms 2 px wide, mirrored about the middle, or one
      // 2 px run where they cross; and the same again 32 rows down.
      for (let y = top + 19; y < bottom; y++) {
        const xs = between(y);
        expect([2, 4], `bent ${col} row ${y}: ${xs}`).toContain(xs.length);
        // Each arm is 2 px across: the runs of brace are 2 px, or 4 where the two arms touch.
        const runs = xs.reduce((r, x, i) => (i > 0 && x === xs[i - 1] + 1 ? [...r.slice(0, -1), r[r.length - 1] + 1] : [...r, 1]), []);
        for (const n of runs) expect([2, 4], `bent ${col} row ${y}: ${xs}`).toContain(n);
        expect(xs.map((x) => TILE - 1 - x).sort((p, q) => p - q), `bent ${col} row ${y}`).toEqual(xs);
        if (y + 32 < bottom) expect(between(y + 32), `bent ${col} rows ${y} and ${y + 32}`).toEqual(xs);
      }
      // Each X crosses: a row in every 32 where the arms meet in the middle.
      for (let y0 = top + 19; y0 + 32 <= bottom; y0 += 32) {
        expect(Array.from({ length: 32 }, (_, i) => between(y0 + i)).some((xs) => xs.length === 2), `bent ${col} from ${y0}`).toBe(true);
      }
    }
  });

  it('GDD-ART-06 a bent has no outline, only the timber colours, and over a pit runs to the level\'s bottom; on the ground it stands on a sill', () => {
    for (const { col, foot, sill } of DEEP_BENTS) {
      const columns = Array.from({ length: TILE }, (_, x) => col * TILE + x);
      const painted = new Set();
      for (const row of DEEP_LAID) for (const x of columns) if (row[x] !== null) painted.add(row[x]);
      expect([...painted].sort(), `bent ${col}`).toEqual([TIMBER, TIMBER_DARK].sort());
      // Its last rows: over the pit open to the bottom, its two posts reach the level's bottom row; on the floor, the sill, 2 px tall,
      // across the whole tile, its left end lit.
      if (sill) {
        for (const y of [foot - 2, foot - 1]) expect(columns.map((x) => DEEP_LAID[y][x]), `bent ${col} row ${y}`).toEqual([TIMBER, ...Array(TILE - 1).fill(TIMBER_DARK)]);
        expect(SILL_ROWS).toBe(2);
      } else {
        expect(foot).toBe(20 * TILE);
        expect(postsAt(DEEP_LAID, col, foot - 1).edges, `bent ${col}`).toHaveLength(2);
      }
    }
    expect(count(RAIL, OUTLINE)).toBe(0);
  });

  it('GDD-ART-06 under a sloped rail each bent\'s cap, 3 px deep, meets the stringer at its own height in every column', () => {
    // 20 rows, the floor at row 8 (y = 128) but for a pit floored at row 16 at columns 10 to 17. A rail from column 8: 2 level, a climb of 2
    // over the pit, 2 level, a descent of 2, 3 level: a trestle from column 10 to 17 with bents at 10 (up), 12 (level), 14 (down) and 16 (level).
    const world = levelOf(20, 24, (c, r) => (c >= 10 && c <= 17 ? r >= 16 : r >= 8));
    const rail = {
      x: 8 * TILE, y: 128, dir: 1, end: 'buffer',
      segments: [{ kind: 'level', tiles: 2 }, { kind: 'climb', tiles: 2 }, { kind: 'level', tiles: 2 }, { kind: 'descent', tiles: 2 }, { kind: 'level', tiles: 3 }],
    };
    const bents = look.railLook(world, [rail], 20).filter((im) => im.part === 'bent');
    expect(bents.map((im) => [im.frame, im.x / TILE])).toEqual([['bentUp', 10], ['bentLevel', 12], ['bentDown', 14], ['bentLevel', 16]]);
    const stringer = laidOut(world, [rail], 20, 24, STRINGERS);
    const trestle = laidOut(world, [rail], 20, 24, TRESTLE);
    for (const im of bents) {
      // The cap spans the bent's columns 2 to 13; in each, its top row is the row under the stringer's last, and it is 3 px deep.
      for (let x = im.x + 2; x <= im.x + 13; x++) {
        const under = Math.max(...stringer.map((row, y) => (row[x] !== null ? y : -1))) + 1;
        const first = trestle.findIndex((row) => row[x] !== null);
        expect(first, `${im.frame} at ${im.x / TILE}, column ${x - im.x}`).toBe(under);
        for (let y = under; y < under + 3; y++) expect(trestle[y][x], `${im.frame} column ${x - im.x} row ${y}`).not.toBeNull();
      }
      for (const x of [im.x, im.x + 1, im.x + 14, im.x + 15]) expect(trestle.findIndex((row) => row[x] !== null), `${im.frame} column ${x - im.x}`).toBeGreaterThan(im.y + 3);
    }
  });
});
