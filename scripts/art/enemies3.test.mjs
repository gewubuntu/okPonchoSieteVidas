import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ART_SCALE, ENEMY_ART } from '../../src/config/tuning';
import { ARMADILLO_LOOK_BOXES, ARMADILLO_LOOKS, ENEMY_LOOKS, MURCIELAGO_LOOKS, SHEETS } from '../../src/ui/enemyLooks';
import { OUTLINE } from './enemies2/kit.mjs';
import { FLASH } from './enemies1/kit.mjs';
import * as armadillo from './enemies3/armadillo.mjs';
import * as murcielago from './enemies3/murcielago.mjs';
import { buildEnemies, enemySheet, KINDS } from './make-enemies.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'enemies');

// GDD-ENM-04, GDD-ART-06: the bat's colours from World 3's palette, rust, rock deep, ochre light, ochre and mist white, and the outline.
const COLOURS = ['#B0562E', '#5A3B28', '#EDCB86', '#CC983F', '#EEF1EA', '#070509'];
// Drawing the frames takes a moment, so they are drawn once.
const FRAMES = murcielago.drawFrames();
const frame = (look) => FRAMES.find((f) => f.look === look).grid;
const FLAPS = ['flap0', 'flap1', 'flap2', 'flap3'];
const { BOX, FRAME } = murcielago;
const row = (grid, y) => Array.from({ length: grid.width }, (_, x) => grid.get(x, y));
const column = (grid, x) => Array.from({ length: grid.height }, (_, y) => grid.get(x, y));
/** The painted cells that are not the outline and have an empty 4-neighbour, one outside the frame counting as empty (boss.test.mjs). */
function bare(grid) {
  const off = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const c = grid.get(x, y);
      if (c === null || c === OUTLINE) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid.get(x + dx, y + dy) === null)) off.push(`${x},${y}`);
    }
  }
  return off;
}

describe('GDD-ENM-04 the Murciélago sprite', { timeout: 60_000 }, () => {
  it('GDD-ENM-04 the committed PNG is the one the script makes', () => {
    const built = buildEnemies();
    expect(Object.keys(built)).toContain('murcielago.png');
    expect(built['murcielago.png'].equals(readFileSync(join(dir, 'murcielago.png')))).toBe(true);
  });

  it('GDD-ENM-04 the sheet is one row of its 6 frames of 128 x 96 art px, in the order the game picks them', () => {
    expect(KINDS.murcielago).toBe(murcielago);
    expect(murcielago.LOOKS).toEqual([...MURCIELAGO_LOOKS]);
    expect(murcielago.LOOKS).toEqual([...ENEMY_LOOKS.murcielago]);
    expect(FRAMES.map((f) => f.look)).toEqual(['flap0', 'flap1', 'flap2', 'flap3', 'squash', 'hit']);
    const s = enemySheet(murcielago, FRAMES);
    expect([s.width, s.height]).toEqual([768, 96]);
    expect([s.width, s.height]).toEqual([6 * ENEMY_ART.frames.murcielago.w * ART_SCALE, ENEMY_ART.frames.murcielago.h * ART_SCALE]);
    expect(s.width).toBeLessThanOrEqual(4096); // L-068
    expect(ENEMY_ART.frames.murcielago).toEqual({ w: 32, h: 24 });
    expect(ENEMY_ART.frames.murcielago).toEqual({ w: FRAME.w / 2, h: FRAME.h / 2 });
  });

  it('GDD-ART-06 the Murciélago uses only rust, rock deep, the two ochres, mist white and the outline', () => {
    for (const { look, grid } of FRAMES) {
      expect([grid.width, grid.height], look).toEqual([64, 48]);
      for (const c of new Set(grid.cells.filter((c) => c !== null))) expect(COLOURS, `${look} ${c}`).toContain(c);
    }
    // The eye is mist white wherever it is open, and the fur rust.
    for (const look of FLAPS) expect(new Set(frame(look).cells), look).toContain('#EEF1EA');
    for (const { look, grid } of FRAMES) expect(new Set(grid.cells), look).toContain('#B0562E');
  });

  // L-059: assets/sprites/enemies/murcielago.png. It is drawn centred on its box in the air, never on the ground: no frame is cut off by its
  // frame's edge. (Its fit over a real level comes with the level that has one, 3-1.)
  it('GDD-ART-05 every frame has the outline round it and nothing on the frame\'s edge (L-059)', () => {
    for (const { look, grid } of FRAMES) {
      expect(bare(grid), look).toEqual([]);
      expect(row(grid, 0).filter(Boolean), `${look} top`).toEqual([]);
      expect(row(grid, grid.height - 1).filter(Boolean), `${look} bottom`).toEqual([]);
      expect(column(grid, 0).filter(Boolean), `${look} left`).toEqual([]);
      expect(column(grid, grid.width - 1).filter(Boolean), `${look} right`).toEqual([]);
    }
  });

  it('GDD-ENM-04 the box is 16 x 10 game px in the frame\'s middle', () => {
    expect(BOX).toEqual({ x0: 16, y0: 14, x1: 48, y1: 34 });
    expect((BOX.x0 + BOX.x1) / 2).toBe(FRAME.w / 2);
    expect((BOX.y0 + BOX.y1) / 2).toBe(FRAME.h / 2);
  });

  it('GDD-ENM-04 in every flap frame the body fills the box and the wing tips reach outside it across', () => {
    // Measured (L-072): the middle half of the box across and down (x 24 to 40, y 19 to 29 drawing px: 8 x 5 game px) is painted all over,
    // and at least 70% of the whole box is painted (76.6% in flap2, the least); the wings reach past both its sides.
    for (const look of FLAPS) {
      const grid = frame(look);
      const qx = (BOX.x1 - BOX.x0) / 4;
      const qy = (BOX.y1 - BOX.y0) / 4;
      const holes = [];
      for (let y = BOX.y0 + Math.floor(qy); y < BOX.y1 - Math.floor(qy); y++) for (let x = BOX.x0 + qx; x < BOX.x1 - qx; x++) if (!grid.get(x, y)) holes.push(`${x},${y}`);
      expect(holes, look).toEqual([]);
      let painted = 0;
      for (let y = BOX.y0; y < BOX.y1; y++) for (let x = BOX.x0; x < BOX.x1; x++) if (grid.get(x, y)) painted++;
      expect(painted / ((BOX.x1 - BOX.x0) * (BOX.y1 - BOX.y0)), look).toBeGreaterThanOrEqual(0.7);
      const xs = [];
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y)) xs.push(x);
      expect(Math.min(...xs), `${look} left`).toBeLessThan(BOX.x0);
      expect(Math.max(...xs), `${look} right`).toBeGreaterThanOrEqual(BOX.x1);
    }
  });

  it('GDD-ENM-04 the four flap frames all differ, so it beats its wings', () => {
    expect(new Set(FLAPS.map((look) => frame(look).cells.join())).size).toBe(4);
  });

  it('GDD-ENM-04 the squash is flatter than a flap and the hit frame differs from both', () => {
    const height = (grid) => {
      const ys = [];
      for (let y = 0; y < grid.height; y++) if (row(grid, y).some(Boolean)) ys.push(y);
      return ys.length;
    };
    for (const look of FLAPS) expect(height(frame('squash')), look).toBeLessThan(height(frame(look)));
    expect(frame('hit').cells).not.toEqual(frame('flap1').cells);
    expect(frame('hit').cells).not.toEqual(frame('squash').cells);
  });
});

// GDD-ENM-04, GDD-ART-06: the Armadillo's colours from World 3's palette (timber lit, mist white, timber, timber dark, rust, iron dark,
// peak lit for its dust, lamp amber for its stars) and the outline; the tuck's red frame adds the telegraph's two reds (GDD-ENM-01).
const ARMADILLO_COLOURS = ['#A89480', '#EEF1EA', '#75614F', '#43362F', '#B0562E', '#353A48', '#A9B8AC', '#F0A23A', '#070509'];
const A_FRAMES = armadillo.drawFrames();
const aFrame = (look) => A_FRAMES.find((f) => f.look === look).grid;
const WALKS = ['walk0', 'walk1', 'walk2', 'walk3'];
const ROLLS = ['roll0', 'roll1', 'roll2', 'roll3'];
/** The painted cells' box, of those that pass `keep`. */
const boxOf = (grid, keep = (c) => c !== null) => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (keep(grid.get(x, y))) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
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

describe('GDD-ENM-04 the Armadillo sprite', { timeout: 60_000 }, () => {
  it('GDD-ENM-04 the committed armadillo PNG is the one the script makes', () => {
    expect(KINDS.armadillo).toBe(armadillo);
    expect(buildEnemies()['armadillo.png'].equals(readFileSync(join(dir, 'armadillo.png')))).toBe(true);
  });

  it('GDD-ENM-04 the sheet is one row of 12 equal cells of 28 x 16 game px, each look\'s box in a table the game imports', () => {
    expect(armadillo.LOOKS).toEqual([...ARMADILLO_LOOKS]);
    expect(armadillo.LOOK_BOXES).toEqual(ARMADILLO_LOOK_BOXES);
    expect(ENEMY_ART.frames.armadillo).toEqual({ w: 28, h: 16 });
    expect(ENEMY_ART.frames.armadillo).toEqual({ w: armadillo.FRAME.w / 2, h: armadillo.FRAME.h / 2 });
    const s = enemySheet(armadillo, A_FRAMES);
    expect([s.width, s.height]).toEqual([12 * 28 * ART_SCALE, 16 * ART_SCALE]);
    expect(s.width).toBeLessThanOrEqual(4096); // L-068
    // Its rules come with 3-2: the game does not load it yet.
    expect(SHEETS).not.toContain('armadillo');
    expect(Object.keys(ENEMY_LOOKS)).not.toContain('armadillo');
    // Walking and dazed in the whole cell, the tuck and the roll in its 20 x 16 middle (GDD-ENM-04's frames).
    for (const look of [...WALKS, 'dazed', 'dazedKick']) expect(ARMADILLO_LOOK_BOXES[look], look).toEqual({ x: 0, y: 0, w: 28, h: 16 });
    for (const look of ['tuck', 'tuckRed', ...ROLLS]) expect(ARMADILLO_LOOK_BOXES[look], look).toEqual({ x: 4, y: 0, w: 20, h: 16 });
  });

  it('GDD-ART-06 the Armadillo uses only World 3\'s colours and the outline, and the telegraph\'s reds only in its red tuck', () => {
    for (const { look, grid } of A_FRAMES) {
      expect([grid.width, grid.height], look).toEqual([56, 32]);
      const allowed = look === 'tuckRed' ? [OUTLINE, FLASH.colour, FLASH.shade] : ARMADILLO_COLOURS;
      for (const c of new Set(grid.cells.filter((c) => c !== null))) expect(allowed, `${look} ${c}`).toContain(c);
    }
    // The red tuck is the tuck's shape, flashed.
    expect(aFrame('tuckRed').cells.map((c) => c !== null)).toEqual(aFrame('tuck').cells.map((c) => c !== null));
    // Its shell is timber lit with mist white bands in every walking and rolling frame.
    for (const look of [...WALKS, ...ROLLS]) for (const c of ['#A89480', '#EEF1EA']) expect(new Set(aFrame(look).cells), `${look} ${c}`).toContain(c);
  });

  // L-059: assets/sprites/enemies/armadillo.png. Feet on the bottom row in every frame (on its back, its shell), none cut by its cell's
  // edge: only the outline touches the bottom row and nothing the other edges. Its fit over a real level comes with 3-2, which has one.
  it('GDD-ENM-04 every frame stands on its cell\'s bottom row and none is cut by its cell\'s edge (L-059)', () => {
    for (const { look, grid } of A_FRAMES) {
      const bottom = row(grid, grid.height - 1).filter(Boolean);
      expect(bottom.length, `${look} bottom row`).toBeGreaterThan(0);
      const box = ARMADILLO_LOOK_BOXES[look];
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        if (!grid.get(x, y)) continue;
        expect(x >= box.x * 2 && x < (box.x + box.w) * 2 && y >= box.y * 2 && y < (box.y + box.h) * 2, `${look} ${x},${y} inside its box`).toBe(true);
      }
      expect(row(grid, 0).filter(Boolean), `${look} top`).toEqual([]);
      expect(column(grid, 0).filter(Boolean), `${look} left`).toEqual([]);
      expect(column(grid, grid.width - 1).filter(Boolean), `${look} right`).toEqual([]);
      // Every body cell is inside its outline, so none is cut; only the effects drawn without one, the roll's dust (peak lit) and the dazed
      // stars over it (mist white round lamp amber, in the cell's top 10 rows), have bare cells.
      const effect = (p) => {
        const [x, y] = p.split(',').map(Number);
        const c = grid.get(x, y);
        return (look.startsWith('roll') && c === '#A9B8AC') || (look.startsWith('dazed') && y < 10 && (c === '#EEF1EA' || c === '#F0A23A'));
      };
      expect(bare(grid).filter((p) => !effect(p)), look).toEqual([]);
    }
  });

  it('GDD-ENM-04 the rolling frames are round, and walking and rolling differ by the ears and the tail', () => {
    // Measured (L-072): the roll's outline is 24 x 23 drawing px in every frame.
    for (const look of ROLLS) {
      const o = boxOf(aFrame(look), (c) => c === OUTLINE);
      expect(Math.abs(o.w - o.h), look).toBeLessThanOrEqual(2);
    }
    // Walking, the ear stands over the disc's top and the tail reaches back past the ball's box; rolling, neither does.
    for (const look of WALKS) {
      const b = boxOf(aFrame(look), (c) => c !== null && c !== OUTLINE);
      expect(b.x0, `${look} tail`).toBeLessThan(8);
      expect(new Set(aFrame(look).cells), `${look} ear`).toContain('#B0562E');
    }
    for (const look of ROLLS) expect(boxOf(aFrame(look)).x0, look).toBeGreaterThanOrEqual(8);
    // Their silhouettes overlap little: measured 0.52 of their union for walk0 and roll0, under 0.6.
    const sil = (g) => new Set(g.cells.flatMap((c, i) => (c ? [i] : [])));
    const [w, r] = [sil(aFrame('walk0')), sil(aFrame('roll0'))];
    const both = [...w].filter((i) => r.has(i)).length;
    expect(both / (w.size + r.size - both)).toBeLessThan(0.6);
    // The four rolls and the four trot frames all differ.
    expect(new Set(ROLLS.map((l) => aFrame(l).cells.join())).size).toBe(4);
    expect(new Set(WALKS.map((l) => aFrame(l).cells.join())).size).toBe(4);
  });

  it('GDD-ART-06 the Armadillo\'s shell stands off the gallery wall, the ochre and the timber', () => {
    // Measured (L-072): timber lit is 38.2 L* over gallery base (an enemy met underground needs 20), ΔE 40.1 from ochre and 20.0 from timber
    // (a beam's body; a beam's lit top is timber lit itself, ΔE 0).
    const [shell, gallery, ochre, timber] = ['#A89480', '#3D3650', '#CC983F', '#75614F'];
    expect(lab(shell)[0] - lab(gallery)[0]).toBeGreaterThanOrEqual(20);
    const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
    expect(Math.round(dE(shell, ochre))).toBe(40);
    expect(Math.round(dE(shell, timber))).toBe(20);
  });
});
