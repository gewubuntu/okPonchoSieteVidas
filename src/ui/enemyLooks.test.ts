import { describe, expect, it } from 'vitest';
import { levelById, LEVELS } from '../levels/index';
import { kindOf } from '../sim/enemy';
import { SHEETS, sheetsFor } from './enemyLooks';

describe('GDD-ENM-04 the sheets a level loads', () => {
  it('GDD-ENM-04 the Armadillo sheet is loaded only in a level that has one', () => {
    // GDD-TEC-03: lab-3a has Armadillos; lab-3m (the mine's other lab), 1-1 and 3-1 have none.
    expect(sheetsFor(levelById('lab-3a')!.level)).toEqual([...SHEETS, 'armadillo']);
    for (const id of ['lab-3m', '1-1', '3-1']) expect(sheetsFor(levelById(id)!.level), id).toEqual(SHEETS);
    for (const e of LEVELS) expect(sheetsFor(e.level).includes('armadillo'), e.id).toBe(e.level.enemies.some((d) => kindOf(d) === 'armadillo'));
    // Every other sheet in every level, as before.
    expect(SHEETS).toEqual(['alacran', 'zopilote', 'cactus', 'tlacuache', 'paloma', 'chapulin', 'trompo', 'murcielago', 'poof']);
  });
});
