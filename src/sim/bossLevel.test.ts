import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { isBossLevel, levelBoss } from './bossLevel';

describe('GDD-BOS-01 boss levels', () => {
  it('GDD-BOS-01 bosslevel: 1-4 holds Don Zopilote, 2-4 La Estrella, every other level none', () => {
    const bosses = Object.fromEntries(LEVELS.map((e) => [e.id, levelBoss(e.level)]));
    expect(bosses).toEqual({ '0-1': null, '1-1': null, '1-2': null, '1-3': null, '1-4': 'zopilote', '2-1': null, '2-2': null, '2-3': null, '2-4': 'estrella', sandbox: null, slopes: null, 'lab-2m': null, 'lab-2e': null });
    expect(LEVELS.filter((e) => isBossLevel(e.level)).map((e) => e.id)).toEqual(['1-4', '2-4']);
  });
});
