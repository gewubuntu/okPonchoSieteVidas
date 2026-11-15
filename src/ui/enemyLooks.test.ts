import { describe, expect, it } from 'vitest';
import { levelById, LEVELS } from '../levels/index';
import { kindOf, type Enemy, type EnemyKind } from '../sim/enemy';
import { SHEETS, sheetsFor } from './enemyLooks';

const lab = (kinds: EnemyKind[]) => ({ enemies: kinds.map((kind, i): Enemy => ({ x: i * 100, y: 100, kind, rail: 0 })) });

describe('GDD-ENM-04 the sheets a level loads', () => {
  it('GDD-ENM-04 the Cacomixtle sheet is loaded only in a level that has one, the Armadillo\'s only in a level that has one', () => {
    expect(sheetsFor(lab(['alacran']))).toEqual(SHEETS);
    expect(sheetsFor(lab(['armadillo']))).toEqual([...SHEETS, 'armadillo']);
    expect(sheetsFor(lab(['cacomixtle']))).toEqual([...SHEETS, 'cacomixtle']);
    expect(sheetsFor(lab(['cacomixtle', 'armadillo', 'cacomixtle']))).toEqual([...SHEETS, 'armadillo', 'cacomixtle']);
    // lab-3k has Cacomixtles and no Armadillo; lab-3a has Armadillos and no Cacomixtle.
    expect(sheetsFor(levelById('lab-3k')!.level)).toEqual([...SHEETS, 'cacomixtle']);
    expect(sheetsFor(levelById('lab-3a')!.level)).toEqual([...SHEETS, 'armadillo']);
    for (const e of LEVELS) expect(sheetsFor(e.level).includes('cacomixtle'), e.id).toBe(e.level.enemies.some((d) => kindOf(d) === 'cacomixtle'));
    expect(SHEETS).not.toContain('cacomixtle');
  });

  it('GDD-ENM-04 the Armadillo sheet is loaded only in a level that has one', () => {
    // GDD-TEC-03: lab-3a has Armadillos; lab-3m (the mine's other lab), 1-1 and 3-1 have none.
    expect(sheetsFor(levelById('lab-3a')!.level)).toEqual([...SHEETS, 'armadillo']);
    for (const id of ['lab-3m', '1-1', '3-1']) expect(sheetsFor(levelById(id)!.level), id).toEqual(SHEETS);
    for (const e of LEVELS) expect(sheetsFor(e.level).includes('armadillo'), e.id).toBe(e.level.enemies.some((d) => kindOf(d) === 'armadillo'));
    // Every other sheet in every level, as before.
    expect(SHEETS).toEqual(['alacran', 'zopilote', 'cactus', 'tlacuache', 'paloma', 'chapulin', 'trompo', 'murcielago', 'poof']);
  });
});
