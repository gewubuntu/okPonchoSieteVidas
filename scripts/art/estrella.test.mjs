import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { scaled, W2 } from './enemies2/kit.mjs';
import { BOX, COLUMNS, CONES_LEFT, DEFEAT_LOOKS, drawCable, drawCableTile, drawEstrellaSheet, drawRope, drawRopeTile, drawTejocote, drawTejocoteSheet, drawTrolley, drawTrolleySheet, estrellaFrames, FRAME, LOOKS, PALE, reach, TEAR_ORDER } from './estrella.mjs';
import { ESTRELLA, ESTRELLA_ART } from '../../src/config/tuning';
import { ESTRELLA_DEFEAT_LOOKS, ESTRELLA_LOOKS } from '../../src/ui/estrellaPose';
import { buildEstrella } from './make-estrella.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'assets', 'sprites', 'boss');
const approved = (name) => join(here, 'estrella-approved', name);

// GDD-ART-06: World 2's 24 colours (the kit's W2 without the Chapulín's leaf), the outline and the two flash reds every world's enemies share.
const WORLD_2 = Object.entries(W2).filter(([k]) => k !== 'leaf').map(([, c]) => c);
const OUTLINE = '#070509';
const FLASH_REDS = ['#D8473A', '#A0472F'];
const RED = FLASH_REDS[0];
const GLAZE = '#F4EFE2';
const IRON = '#3B2B3C';

// Drawing the frames takes seconds, so they are drawn once.
const FRAMES = estrellaFrames();
const frame = (look, hits) => FRAMES.find((f) => f.look === look && f.hits === hits);
const painted = (grid) => new Set(grid.cells.filter((c) => c !== null));

/** A PNG file of this repo's encoder (8-bit RGBA, filter none) as a grid-like { width, height, cells } of '#RRGGBB' or null. */
function decodePng(bytes) {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const idat = [];
  for (let at = 8; at < bytes.length; ) {
    const len = bytes.readUInt32BE(at);
    if (bytes.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(bytes.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const cells = [];
  for (let y = 0; y < height; y++) {
    expect(raw[y * (width * 4 + 1)], 'filter').toBe(0);
    for (let x = 0; x < width; x++) {
      const o = y * (width * 4 + 1) + 1 + x * 4;
      cells.push(raw[o + 3] === 0 ? null : `#${[0, 1, 2].map((k) => raw[o + k].toString(16).padStart(2, '0')).join('').toUpperCase()}`);
    }
  }
  return { width, height, cells };
}

/** The first cell that differs between the grid (blown up to art pixels) and the approved PNG, or null when they are the same. */
function firstDifference(grid, name) {
  const want = decodePng(readFileSync(approved(name)));
  if (grid.width !== want.width || grid.height !== want.height) return `size ${grid.width} x ${grid.height}, approved ${want.width} x ${want.height}`;
  const at = grid.cells.findIndex((c, i) => c !== want.cells[i]);
  return at < 0 ? null : `art px ${at % grid.width},${Math.floor(at / grid.width)}: ${grid.cells[at]}, approved ${want.cells[at]}`;
}

/**
 * The painted cells of the box [x0, x0 + w) x [y0, y0 + h) of `grid` that are not the outline and have an empty 4-neighbour, a neighbour
 * outside the box counting as empty: a drawing cut off by its frame's edge has lost its outline there. Only the first `rows` rows are checked.
 */
function bare(grid, x0, y0, w, h, rows = h) {
  const off = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid.get(x0 + x, y0 + y);
      if (c === null || c === OUTLINE) continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h || grid.get(x0 + x + dx, y0 + y + dy) === null);
      if (open) off.push(`${x},${y}`);
    }
  }
  return off;
}

/** The point `d` drawing px out from the frame's middle along cone `i` (0 points up, the rest clockwise, seven round), as the GDD counts them. */
const along = (i, d, [cx, cy] = [72, 72]) => [cx + Math.sin((2 * Math.PI * i) / 7) * d, cy - Math.cos((2 * Math.PI * i) / 7) * d];
/** The colours of the 2 x 2 drawing px round a point. */
const around = (grid, [x, y]) => [[-1, -1], [0, -1], [-1, 0], [0, 0]].map(([dx, dy]) => grid.get(Math.round(x) + dx, Math.round(y) + dy));

const LIVING = [...Array(3).keys()].flatMap((hits) => LOOKS.map((look) => [look, hits]));

describe('GDD-BOS-03 La Estrella\'s art', { timeout: 120_000 }, () => {
  it('GDD-BOS-03 the committed PNGs are the ones the script makes', () => {
    const built = buildEstrella();
    expect(Object.keys(built).sort()).toEqual(['cable.png', 'la-estrella.png', 'rope.png', 'tejocote.png', 'trolley.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
  });

  it('GDD-BOS-03 the sheets have the sizes the scene loads, the big one under the phone\'s texture limit', () => {
    const sheet = drawEstrellaSheet();
    expect([sheet.width, sheet.height]).toEqual([2304, 2016]); // 8 x 7 frames of 288 x 288 art px (49 frames)
    expect([sheet.width, sheet.height]).toEqual([COLUMNS * FRAME.w * 2, 7 * FRAME.h * 2]);
    expect(Math.max(sheet.width, sheet.height)).toBeLessThanOrEqual(4096); // L-068
    expect([FRAME.w / 2, FRAME.h / 2]).toEqual([72, 72]); // 72 x 72 game px, her box's middle at its middle
    const sizes = (g) => [g.width, g.height];
    expect(sizes(drawTejocoteSheet())).toEqual([128, 32]); // four frames of 32 x 32 art px: 8 x 8 game px
    expect(sizes(drawTrolleySheet())).toEqual([128, 64]); // two frames of 64 x 64 art px: 16 x 16 game px
    expect(sizes(drawRopeTile())).toEqual([4, 8]);
    expect(sizes(drawCableTile())).toEqual([64, 4]); // 16 x 1 game px
    expect([BOX.x1 - BOX.x0, BOX.y1 - BOX.y0]).toEqual([64, 64]); // her 32 x 32 game px box in drawing px
  });

  it('GDD-BOS-03 the frames come in the order the game picks them', () => {
    const looks = ['glide', 'telegraphL', 'telegraphLRed', 'telegraphR', 'telegraphRRed', 'drop', 'land', 'bounce', 'rest', 'rise', 'hangL', 'hangR', 'yank', 'hurt', 'hurtWhite'];
    expect(LOOKS).toEqual(looks);
    expect(DEFEAT_LOOKS).toEqual(['fall', 'fallWhite', 'lie', 'lieWhite']);
    const want = [0, 1, 2].flatMap((hits) => looks.map((look) => [look, hits]));
    for (const look of DEFEAT_LOOKS) want.push([look, 3]);
    expect(FRAMES.map((f) => [f.look, f.hits])).toEqual(want);
    expect(want).toHaveLength(49);
    expect(COLUMNS).toBe(8);
  });

  it('GDD-BOS-03 every frame is pixel for pixel the approved design', () => {
    // scripts/art/estrella-approved/ holds the design's own frames (the drawing the user approved, 2026-11-09): nothing is redrawn (L-066).
    for (const f of FRAMES) expect(firstDifference(scaled(f.grid, 2), `${f.look}-${f.hits}.png`), `${f.look} ${f.hits}`).toBeNull();
    for (let k = 0; k < 4; k++) expect(firstDifference(scaled(drawTejocote(k), 2), `tejocote-${k}.png`), `tejocote ${k}`).toBeNull();
    for (let k = 0; k < 2; k++) expect(firstDifference(scaled(drawTrolley(k), 2), `trolley-${k}.png`), `trolley ${k}`).toBeNull();
    expect(firstDifference(scaled(drawRope(), 2), 'rope.png'), 'rope').toBeNull();
    expect(firstDifference(scaled(drawCable(), 2), 'cable.png'), 'cable').toBeNull();
  });

  it('GDD-BOS-03 the game loads her sheets as the art makes them: ESTRELLA_ART and the looks agree with the drawing', () => {
    expect(ESTRELLA_LOOKS).toEqual(LOOKS);
    expect(ESTRELLA_DEFEAT_LOOKS).toEqual(DEFEAT_LOOKS);
    expect([ESTRELLA_ART.frame, ESTRELLA_ART.columns, ESTRELLA_ART.looks]).toEqual([FRAME.w / 2, COLUMNS, LOOKS.length]);
    expect([ESTRELLA_ART.tejocoteFrame, ESTRELLA_ART.trolleyFrame]).toEqual([16 / 2, 32 / 2]);
    // The cable's middle is the trolley frame's row 16 (game y 8 from its top), the cable's y 8 (ESTRELLA.cableY); the wheel 7.2 drawing px in radius.
    expect([ESTRELLA_ART.trolleyCable, ESTRELLA_ART.trolleyWheel]).toEqual([16 / 2, 7.2 / 2]);
    expect(ESTRELLA.cableY).toBe(ESTRELLA_ART.trolleyCable);
    // Her top cone's tip is ESTRELLA.coneTip above her middle (the frame's row 16 of 144, the tip 28 game px up), and the trolley's eye's middle
    // is row 21.5 of its frame: 2.75 game px under the cable's middle (row 16).
    expect(ESTRELLA.coneTip).toBe((72 - 16) / 2);
    expect(ESTRELLA_ART.ropeFrom).toBe((21.5 - 16) / 2);
    // The in-air looks reach up to 14 px below her box (the landing look's distance), the falling pot's look 2.
    const reaches = FRAMES.filter((f) => f.hits < 3).map((f) => reach(f.grid).below);
    expect(ESTRELLA_ART.landLook).toBe(Math.ceil(Math.max(...reaches)));
    expect(ESTRELLA_ART.fallBelow).toBe(reach(frame('fall', 3).grid).below);
  });

  it('GDD-BOS-03 the sheets hold those frames, side by side in order', () => {
    // Each cell of the big sheet is its frame's cell: the sheet is the frames in order, COLUMNS across.
    const sheet = drawEstrellaSheet();
    const w = FRAME.w * 2;
    FRAMES.forEach((f, i) => {
      const [x0, y0] = [(i % COLUMNS) * w, Math.floor(i / COLUMNS) * w];
      const want = scaled(f.grid, 2);
      const same = want.cells.every((c, k) => sheet.get(x0 + (k % w), y0 + Math.floor(k / w)) === c);
      expect(same, `${f.look} ${f.hits} at frame ${i}`).toBe(true);
    });
    const tejocotes = drawTejocoteSheet();
    for (let k = 0; k < 4; k++) expect(scaled(drawTejocote(k), 2).cells.every((c, i) => tejocotes.get(k * 32 + (i % 32), Math.floor(i / 32)) === c), `tejocote ${k}`).toBe(true);
    const trolleys = drawTrolleySheet();
    for (let k = 0; k < 2; k++) expect(scaled(drawTrolley(k), 2).cells.every((c, i) => trolleys.get(k * 64 + (i % 64), Math.floor(i / 64)) === c), `trolley ${k}`).toBe(true);
  });

  it('GDD-ART-06 she, her tejocotes and her trolley use only World 2\'s colours, the outline and the flash reds', () => {
    expect(WORLD_2).toHaveLength(24);
    const allowed = [...WORLD_2, OUTLINE, ...FLASH_REDS];
    for (const [name, grid] of [['sheet', drawEstrellaSheet()], ['tejocote', drawTejocoteSheet()], ['trolley', drawTrolleySheet()], ['rope', drawRopeTile()], ['cable', drawCableTile()]]) {
      for (const c of painted(grid)) expect(allowed, `${name} ${c}`).toContain(c);
    }
  });

  it('GDD-ART-05 every frame is outlined and none is cut off by its frame\'s edge', () => {
    for (const f of FRAMES) {
      // A lying pot rests on the floor line (row 103): the floor is scenery, so the bottom is open there and only the rows above it are checked.
      const rows = f.look.startsWith('lie') ? 103 : FRAME.h;
      expect(bare(f.grid, 0, 0, FRAME.w, FRAME.h, rows), `${f.look} ${f.hits}`).toEqual([]);
      expect(reach(f.grid).edge, `${f.look} ${f.hits} edge`).toBe(false);
    }
    for (let k = 0; k < 4; k++) expect(bare(drawTejocote(k), 0, 0, 16, 16), `tejocote ${k}`).toEqual([]);
  });

  // L-059: how far each frame of assets/sprites/boss/la-estrella.png reaches past her 32 x 32 box, in game px, as the design measured it
  // (scripts/art/estrella-approved/report.json); src/levels/level2-4.test.ts fits them over the fight.
  it('GDD-BOS-03 each frame reaches past her box as far as the design measured', () => {
    const table = JSON.parse(readFileSync(approved('report.json'), 'utf8')).reach;
    expect(table).toHaveLength(FRAMES.length);
    for (const row of table) {
      const { above, below, left, right } = reach(frame(row.look, row.hits).grid);
      expect({ above, below, left, right }, `${row.look} ${row.hits}`).toEqual({ above: row.above, below: row.below, left: row.left, right: row.right });
    }
    // A few of them by hand from the design's canvas: her in-air looks hang up to 14 px below her box, her torn ones less.
    expect(reach(frame('telegraphL', 0).grid)).toMatchObject({ above: 15, below: 14, left: 16, right: 16 });
    expect(reach(frame('drop', 0).grid)).toMatchObject({ above: 16, below: 11 });
    expect(reach(frame('hangL', 2).grid)).toMatchObject({ below: 2 });
  });

  it('GDD-BOS-03 her landing, bounce, rest and rise looks and the lying pot reach nothing below her box, at every hit count', () => {
    for (const hits of [0, 1, 2]) for (const look of ['land', 'bounce', 'rest', 'rise']) expect(reach(frame(look, hits).grid).below, `${look} ${hits}`).toBe(0);
    for (const look of ['lie', 'lieWhite']) expect(reach(frame(look, 3).grid).below, look).toBe(0);
    // And the in-air looks do reach below it at no hit count by more than the 14 px the GDD names.
    for (const f of FRAMES) expect(reach(f.grid).below, `${f.look} ${f.hits}`).toBeLessThanOrEqual(14);
  });

  it('GDD-BOS-03 the top three cones\' tips are glaze white in every look that shows them, the not-stompable marker', () => {
    expect(PALE).toEqual([0, 1, 6]);
    // The flashes recolour the whole frame, so the tips are only checked in the looks that show her own colours.
    for (const [look, hits] of LIVING.filter(([l]) => !['telegraphLRed', 'telegraphRRed', 'hurtWhite'].includes(l))) {
      const g = frame(look, hits).grid;
      // The thud squashes her and moves the cones down 2.5 drawing px.
      const centre = look === 'land' ? [72, 74.5] : [72, 72];
      for (const i of PALE) expect(around(g, along(i, 46, centre)), `${look} ${hits} cone ${i}`).toContain(GLAZE);
      // The cones below do not have it (cone 2 and 5 are yellow, 3 and 4 cobalt; a torn one is gone by then).
      for (const i of [2, 3, 4, 5]) expect(around(g, along(i, 46, centre)).filter((c) => c === GLAZE), `${look} ${hits} cone ${i}`).toHaveLength(0);
    }
  });

  it('GDD-BOS-03 the eyes stay dark through the red and the white flash', () => {
    // The eye holes (columns about 56 to 66 and 78 to 88, rows 63 to 70 of the frame): their dark cells are the same with and without the flash.
    const dark = (g, x0) => {
      const out = [];
      for (let y = 62; y < 71; y++) for (let x = x0; x < x0 + 12; x++) if ([OUTLINE, IRON].includes(g.get(x, y))) out.push(`${x},${y}`);
      return out;
    };
    const pairs = [['telegraphLRed', 'telegraphL'], ['telegraphRRed', 'telegraphR'], ['hurtWhite', 'hurt']];
    for (const hits of [0, 1, 2]) {
      for (const [flash, plain] of pairs) {
        for (const x0 of [55, 77]) {
          const eye = dark(frame(flash, hits).grid, x0);
          expect(eye.length, `${flash} ${hits} ${x0}`).toBeGreaterThan(10);
          expect(eye, `${flash} ${hits} ${x0}`).toEqual(dark(frame(plain, hits).grid, x0));
        }
      }
    }
    for (const [flash, plain] of [['fallWhite', 'fall']]) expect(dark(frame(flash, 3).grid, 55), flash).toEqual(dark(frame(plain, 3).grid, 55));
  });

  it('GDD-BOS-03 the flashes are the shared red and the white', () => {
    // A flash recolours every cell but the outline and the eyes: the red one into the two flash reds, the white one into glaze white and
    // the far town's pale lilac (#C3C6DE, the shadows). The share of the frame's cells (outline apart) in those colours tells a flash from a plain look.
    const share = (grid, colours) => {
      const cells = grid.cells.filter((c) => c !== null && c !== OUTLINE);
      return cells.filter((c) => colours.includes(c)).length / cells.length;
    };
    const WHITES = [GLAZE, '#C3C6DE'];
    for (const hits of [0, 1, 2]) {
      for (const look of ['telegraphLRed', 'telegraphRRed']) expect(share(frame(look, hits).grid, FLASH_REDS), `${look} ${hits}`).toBeGreaterThan(0.9);
      expect(share(frame('hurtWhite', hits).grid, WHITES), `hurtWhite ${hits}`).toBeGreaterThan(0.9);
      for (const look of ['telegraphL', 'telegraphR', 'hurt']) {
        expect(share(frame(look, hits).grid, FLASH_REDS), `${look} ${hits} red`).toBeLessThan(0.05);
        expect(share(frame(look, hits).grid, WHITES), `${look} ${hits} white`).toBeLessThan(0.2);
      }
    }
    for (const look of ['fallWhite', 'lieWhite']) expect(share(frame(look, 3).grid, WHITES), look).toBeGreaterThan(0.9);
    for (const look of ['fall', 'lie']) expect(share(frame(look, 3).grid, WHITES), look).toBeLessThan(0.2);
    // The flash reds are used by the red looks and by nothing else.
    for (const f of FRAMES) expect(FLASH_REDS.some((c) => painted(f.grid).has(c)), `${f.look} ${f.hits}`).toBe(f.look.endsWith('Red'));
  });

  it('GDD-BOS-03 each torn cone shows its stub, and the cones left show their full length', () => {
    // Cones 7, 5, 3 and 0 left after 0, 1, 2 hits and the defeat; the torn ones go bottom first (TEAR_ORDER). The stub is a rim of paper just
    // past the pot, 34 drawing px out on the cone's axis; a whole cone runs on to its tip (50 px out), a torn one stops short of 40.
    expect(CONES_LEFT).toEqual([7, 5, 3, 0]);
    expect(TEAR_ORDER).toEqual([3, 4, 2, 5, 1, 6, 0]);
    const torn = { 0: [], 1: [3, 4], 2: [3, 4, 2, 5], 3: [0, 1, 2, 3, 4, 5, 6] };
    // The looks that keep every cone straight at the centre (no thud: the thud splays the bottom cones).
    for (const [look, hits] of [...LIVING.filter(([l]) => ['glide', 'telegraphL', 'drop', 'hangL', 'yank', 'hurt'].includes(l)), ['fall', 3]]) {
      const g = frame(look, hits).grid;
      for (let i = 0; i < 7; i++) {
        if (torn[hits].includes(i)) {
          expect(around(g, along(i, 34)).every((c) => c !== null), `${look} ${hits} stub ${i}`).toBe(true);
          expect(around(g, along(i, 41)).every((c) => c === null), `${look} ${hits} cone ${i} gone`).toBe(true);
        } else {
          expect(around(g, along(i, 41)).every((c) => c !== null), `${look} ${hits} cone ${i} whole`).toBe(true);
        }
      }
    }
  });
});
