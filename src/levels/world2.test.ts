import { describe, expect, it } from 'vitest';
import { LEVEL_1_4, LEVEL_1_4_ROWS } from './level1-4';
import { LEVEL_2_1 } from './level2-1';
import { LEVEL_2_2 } from './level2-2';
import { LEVEL_2_3 } from './level2-3';
import { LEVEL_2_4 } from './level2-4';
import { levelById } from './index';

// GDD-WLD-01: World 2's levels, the Mercado: 2-1 to 2-3 (GDD-WLD-12 to GDD-WLD-14), each tested in its own file, and 2-4, its boss arena,
// a copy of 1-4's arena with Don Zopilote standing in for World 2's boss until La Estrella's arena replaces it.
const LEVELS_2 = { '2-1': LEVEL_2_1, '2-2': LEVEL_2_2, '2-3': LEVEL_2_3 };

describe('GDD-WLD-01 World 2 levels', () => {
  for (const [id, level] of Object.entries(LEVELS_2)) {
    it(`GDD-WLD-01 ${id} is a World 2 level of 180 by 17 tiles with three ofrendas, 50 hilos and an exit, played after the one before`, () => {
      expect(levelById(id)).toMatchObject({ world: 2, test: false });
      expect(levelById(id)!.level).toBe(level);
      expect([level.world.width, level.world.height]).toEqual([180, 17]);
      expect(level.ofrendas).toHaveLength(3);
      expect(level.hilos).toHaveLength(50);
      expect(level.exit).toBeDefined();
    });
  }

  it('GDD-UI-02 the World 2 run goes 1-4, 2-1, 2-2, 2-3, 2-4', () => {
    expect(['1-4', '2-1', '2-2', '2-3'].map((id) => levelById(id)!.next)).toEqual(['2-1', '2-2', '2-3', '2-4']);
  });

  it('GDD-BOS-01 stub 2-4 is 1-4 arena with Don Zopilote, in a tile grid of its own', () => {
    expect(levelById('2-4')).toMatchObject({ world: 2, test: false });
    expect(levelById('2-4')!.next).toBeUndefined();
    expect(LEVEL_2_4.world).not.toBe(LEVEL_1_4.world);
    for (let r = 0; r < 17; r++) for (let c = 0; c < 30; c++) expect(LEVEL_2_4.world.solidTile(c, r), `${c},${r}`).toBe(LEVEL_1_4_ROWS[r]![c] === '#');
    expect({ ...LEVEL_2_4, world: null }).toEqual({ ...LEVEL_1_4, world: null });
  });
});
