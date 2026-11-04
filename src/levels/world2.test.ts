import { describe, expect, it } from 'vitest';
import { LEVEL_2_1 } from './level2-1';
import { LEVEL_2_2 } from './level2-2';
import { LEVEL_2_3 } from './level2-3';
import { LEVEL_2_4 } from './level2-4';
import { levelById } from './index';

// GDD-WLD-01: World 2's levels, the Mercado: 2-1 to 2-3 (GDD-WLD-12 to GDD-WLD-14), each tested in its own file, and 2-4, its boss arena,
// La Estrella's arena (GDD-BOS-03).
const LEVELS_2 = { '2-1': LEVEL_2_1, '2-2': LEVEL_2_2, '2-3': LEVEL_2_3 };

describe('GDD-WLD-01 World 2 levels', () => {
  for (const [id, level] of Object.entries(LEVELS_2)) {
    it(`GDD-WLD-01 ${id} is a World 2 level of 240 by 17 tiles (8 screens, GDD-WLD-03) with three ofrendas, 50 hilos and an exit, played after the one before`, () => {
      expect(levelById(id)).toMatchObject({ world: 2, test: false });
      expect(levelById(id)!.level).toBe(level);
      expect([level.world.width, level.world.height]).toEqual([240, 17]);
      expect(level.ofrendas).toHaveLength(3);
      expect(level.hilos).toHaveLength(50);
      expect(level.exit).toBeDefined();
    });
  }

  it('GDD-UI-02 the World 2 run goes 1-4, 2-1, 2-2, 2-3, 2-4', () => {
    expect(['1-4', '2-1', '2-2', '2-3'].map((id) => levelById(id)!.next)).toEqual(['2-1', '2-2', '2-3', '2-4']);
  });

  it('GDD-BOS-03 2-4 is World 2 boss arena, La Estrella level, the last level built (its layout in level2-4.test.ts)', () => {
    expect(levelById('2-4')).toMatchObject({ world: 2, test: false });
    expect(levelById('2-4')!.level).toBe(LEVEL_2_4);
    expect(levelById('2-4')!.next).toBeUndefined();
    expect(LEVEL_2_4.estrella).toBeDefined();
    expect(LEVEL_2_4.boss).toBeUndefined();
  });
});
