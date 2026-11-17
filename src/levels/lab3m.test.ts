import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { railLength } from '../sim/cart';
import { kindOf } from '../sim/enemy';
import { levelById } from './index';
import { LAB_3M_ENEMIES, LAB_3M_FLOOR_ROW, LAB_3M_ID, LAB_3M_LEVEL, LAB_3M_LOW_ROOF, LAB_3M_LOWER, LAB_3M_OFRENDAS, LAB_3M_PIT, LAB_3M_RAILS, LAB_3M_RAMP, LAB_3M_SPAWN } from './lab3m';
import { gaps, validateLevel } from './validate';

// GDD-ART-06, GDD-TEC-04: lab-3m, the mine lab, over the real level data (L-014). Positions are read from `src/levels/lab3m.ts`.
const { world } = LAB_3M_LEVEL;
const solid = (col: number, row: number) => world.solidTile(col, row);
const cols = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('GDD-ART-06 lab-3m, the mine lab', () => {
  it('GDD-ART-06 lab-3m is a World 3 test level in the mine, 60 x 17, and passes the validator', () => {
    const entry = levelById(LAB_3M_ID)!;
    expect(LAB_3M_ID).toBe('lab-3m');
    expect(entry).toMatchObject({ world: 3, test: true, place: 'mina' });
    expect(entry.level).toBe(LAB_3M_LEVEL);
    expect([world.width, world.height]).toEqual([60, 17]);
    expect(validateLevel(entry)).toEqual([]);
    // GDD-MOV-07: the glide is on.
    expect(LAB_3M_LEVEL.abilities).toEqual({ glide: true });
  });

  it('GDD-ART-06 lab-3m is a roofed gallery: the roof rows 0 to 4 over every column, the floor row 13', () => {
    for (let col = 0; col < 60; col++) for (let row = 0; row <= 4; row++) expect(solid(col, row), `roof ${col},${row}`).toBe(true);
    expect(LAB_3M_FLOOR_ROW).toBe(13);
    // The floor's top tile at row 13 with open air over it, left of the ramp but for the pit.
    for (const col of [...cols(0, LAB_3M_PIT.col0 - 1), ...cols(LAB_3M_PIT.col1 + 1, LAB_3M_RAMP.col0 - 1)]) {
      expect([solid(col, 12), solid(col, 13), solid(col, 16)], `column ${col}`).toEqual([false, true, true]);
    }
    expect(LAB_3M_SPAWN).toEqual({ x: 3 * TILE + TILE / 2, y: 13 * TILE });
  });

  it('GDD-ART-06 lab-3m has a pit 3 tiles wide, a black shaft open to the level bottom', () => {
    expect(LAB_3M_PIT.col1 - LAB_3M_PIT.col0 + 1).toBe(3);
    expect(gaps(world)).toEqual([{ col: LAB_3M_PIT.col0, width: 3 }]);
    for (const col of cols(LAB_3M_PIT.col0, LAB_3M_PIT.col1)) for (let row = 5; row < 17; row++) expect(solid(col, row), `${col},${row}`).toBe(false);
  });

  it('GDD-ART-06 lab-3m has a stretch under a low roof 4 tiles over the floor', () => {
    expect(LAB_3M_LOW_ROOF.col1 - LAB_3M_LOW_ROOF.col0 + 1).toBeGreaterThanOrEqual(6);
    for (const col of cols(LAB_3M_LOW_ROOF.col0, LAB_3M_LOW_ROOF.col1)) {
      // Solid from the roof down to row 8, open rows 9 to 12: its underside 4 tiles (64 px) over the floor's top.
      for (let row = 0; row <= 8; row++) expect(solid(col, row), `${col},${row}`).toBe(true);
      for (let row = 9; row <= 12; row++) expect(solid(col, row), `${col},${row}`).toBe(false);
    }
    expect(LAB_3M_FLOOR_ROW * TILE - (LAB_3M_LOW_ROOF.row + 1) * TILE).toBe(4 * TILE);
  });

  it('GDD-ART-06 lab-3m has a ramp of 4 slope tiles down to a lower floor', () => {
    expect(cols(LAB_3M_RAMP.col0, LAB_3M_RAMP.col1)).toHaveLength(4);
    // Falling to the right: F f at row 13, then F f at row 14, each over a level tile; the lower floor's top at row 15 to the level's end.
    expect(cols(LAB_3M_RAMP.col0, LAB_3M_RAMP.col1).map((col) => [world.slopeAt(col, 13), world.slopeAt(col, 14)])).toEqual([['F', null], ['f', null], [null, 'F'], [null, 'f']]);
    expect(LAB_3M_LOWER).toEqual({ col0: LAB_3M_RAMP.col1 + 1, row: 15 });
    for (const col of cols(LAB_3M_LOWER.col0, 59)) expect([solid(col, 14), solid(col, 15), solid(col, 16)], `column ${col}`).toEqual([false, true, true]);
  });

  it('GDD-ART-06 lab-3m has one rail with its cart and a buffer on the lower floor', () => {
    expect(LAB_3M_RAILS).toHaveLength(1);
    const rail = LAB_3M_RAILS[0]!;
    expect(rail.end).toBe('buffer');
    expect(rail.segments.every((s) => s.kind === 'level')).toBe(true);
    expect(rail.y).toBe(LAB_3M_LOWER.row * TILE);
    expect(rail.x).toBeGreaterThanOrEqual(LAB_3M_LOWER.col0 * TILE);
    expect(rail.x + railLength(rail)).toBeLessThanOrEqual(60 * TILE);
  });

  it('GDD-ART-06 lab-3m has two Alacranes and three ofrendas on its floors', () => {
    expect(LAB_3M_ENEMIES.map(kindOf)).toEqual(['alacran', 'alacran']);
    expect(LAB_3M_OFRENDAS).toHaveLength(3);
    for (const p of [...LAB_3M_ENEMIES, ...LAB_3M_OFRENDAS]) {
      const col = Math.floor(p.x / TILE);
      expect(solid(col, p.y / TILE), `${p.x},${p.y} on ground`).toBe(true);
      expect(solid(col, p.y / TILE - 1), `${p.x},${p.y} in the open`).toBe(false);
    }
  });
});
