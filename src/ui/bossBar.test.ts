import { describe, expect, it } from 'vitest';
import { LEVEL_1_1 } from '../levels/level1-1';
import { LEVEL_1_4 } from '../levels/level1-4';
import { LEVEL_2_4 } from '../levels/level2-4';
import { bossStart } from '../sim/boss';
import { estrellaStart } from '../sim/estrella';
import { startRun } from '../sim/run';
import { BOSS_NAMES, bossBar } from './bossBar';
import { TEXT } from './text';

describe('GDD-UI-01 boss bar per boss', () => {
  it('GDD-UI-01 bossbar in 1-4: Don Zopilote, three pips, all filled at the start', () => {
    expect(bossBar(LEVEL_1_4, startRun(LEVEL_1_4))).toEqual({ name: 'zopilote', pips: 3, left: 3 });
  });

  it('GDD-UI-01 bossbar after hits: one pip fewer filled per hit taken, the pips drawn stay three', () => {
    const run = startRun(LEVEL_1_4);
    expect(bossBar(LEVEL_1_4, { ...run, boss: bossStart(LEVEL_1_4.boss!, 1) })).toEqual({ name: 'zopilote', pips: 3, left: 2 });
    expect(bossBar(LEVEL_1_4, { ...run, boss: bossStart(LEVEL_1_4.boss!, 3) })).toEqual({ name: 'zopilote', pips: 3, left: 0 });
  });

  it('GDD-UI-01 bossbar in 2-4: La Estrella, three pips, one fewer filled per hit she has taken', () => {
    const run = startRun(LEVEL_2_4);
    expect(bossBar(LEVEL_2_4, run)).toEqual({ name: 'estrella', pips: 3, left: 3 });
    expect(bossBar(LEVEL_2_4, { ...run, estrella: estrellaStart(LEVEL_2_4.estrella!, 1) })).toEqual({ name: 'estrella', pips: 3, left: 2 });
    expect(bossBar(LEVEL_2_4, { ...run, estrella: { ...estrellaStart(LEVEL_2_4.estrella!, 2), hits: 3, mode: 'defeated' } })).toEqual({ name: 'estrella', pips: 3, left: 0 });
  });

  it('GDD-UI-01 bossbar: none in a level without a boss', () => {
    expect(bossBar(LEVEL_1_1, startRun(LEVEL_1_1))).toBeNull();
  });

  it('GDD-UI-02 bossbar names: Don Zopilote in every language', () => {
    for (const lang of ['en', 'es', 'de'] as const) expect(TEXT[lang][BOSS_NAMES.zopilote], lang).toBe('Don Zopilote');
    for (const lang of ['en', 'es', 'de'] as const) expect(TEXT[lang][BOSS_NAMES.estrella], lang).toBe('La Estrella');
  });
});
