import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ART_SCALE, ENEMY_ART } from '../../src/config/tuning';
import { ENEMY_LOOKS, MURCIELAGO_LOOKS } from '../../src/ui/enemyLooks';
import { OUTLINE } from './enemies2/kit.mjs';
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
