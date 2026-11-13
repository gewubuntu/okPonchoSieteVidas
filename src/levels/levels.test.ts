import { describe, expect, it } from 'vitest';
import { startRun, stepRun, type Level } from '../sim/run';
import { frontierWorld, GLIDE_UNLOCK_ID, LEVELS, levelById, livesInto, SAVED_LEVELS, SAVED_OFRENDAS, SAVED_WORLD_LEVELS, SAVED_WORLDS, startLevel, unlockedAbilities, withUnlocks, worldAtAfter, worldLevels, worldLivesAfter, worldStart, type LevelEntry } from './index';
import { LEVEL_1_1 } from './level1-1';
import { SANDBOX_LEVEL } from './sandbox';
import { gaps, validateLevel } from './validate';

/** A level cleared in the saved progress (GDD-PRG-02). */
const c = { cleared: true };
/** What "Start" plays, and with how many lives, for an address and a save: whether the tutorial started, the levels cleared, the lives kept per world, the level each world's run has reached. */
const pick = (search: string, tutorialPlayed: boolean, levels: Record<string, { cleared: boolean }> = {}, worldLives: Record<string, number> = {}, worldAt: Record<string, string> = {}) =>
  startLevel(search, { tutorialPlayed, levels, worldLives, worldAt });
/** The level entry with this id. */
const entryOf = (id: string): LevelEntry => levelById(id)!;

describe('GDD-TEC-04 every level passes the validator', () => {
  for (const entry of LEVELS) {
    it(entry.id, () => {
      expect(validateLevel(entry), entry.id).toEqual([]);
    });
  }

  it('the sandbox is a World 1 test level', () => {
    const sandbox = LEVELS.find((e) => e.id === 'sandbox');
    expect(sandbox).toBeDefined();
    expect(sandbox!.world).toBe(1);
    expect(sandbox!.test).toBe(true);
    expect(sandbox!.level).toBe(SANDBOX_LEVEL);
  });
});

describe('GDD-WLD-03 the sandbox pit', () => {
  it('is one gap, columns 14 to 16, 3 tiles wide (the spring slot in column 12 has a floor under it)', () => {
    expect(gaps(SANDBOX_LEVEL.world)).toEqual([{ col: 14, width: 3 }]);
  });
});

describe('GDD-UI-02 which level', () => {
  it('GDD-UI-02 which level: no address gives 0-1 before the tutorial has started and 1-1 after, with nothing cleared', () => {
    expect(pick('', false).entry.id).toBe('0-1');
    expect(pick('', true).entry.id).toBe('1-1');
    expect(pick('', false).lives).toBe(7);
    expect(pick('', true).lives).toBe(7);
  });

  it('GDD-UI-02 which level: an address wins over the save', () => {
    for (const played of [false, true]) expect(pick('?level=sandbox', played).entry.id, `sandbox ${played}`).toBe('sandbox');
    expect(pick('?level=1-1', false).entry.id).toBe('1-1');
    expect(pick('?level=0-1', true).entry.id).toBe('0-1');
    expect(pick('?x=1&level=1-1', false).entry.id).toBe('1-1');
    expect(pick('?x=1&level=sandbox', true).entry.id).toBe('sandbox');
    for (const played of [false, true]) expect(pick('?level=1-2', played).entry.id).toBe('1-2');
    expect(pick('?level=1-1', true, { '1-1': c }, { '1': 4 }).entry.id).toBe('1-1');
    expect(pick('?level=1-2', true, { '1-1': c, '1-2': c }).entry.id).toBe('1-2');
    for (const played of [false, true]) expect(pick('?level=1-3', played).entry.id, `1-3 ${played}`).toBe('1-3');
    expect(pick('?level=1-3', true, { '1-1': c, '1-2': c, '1-3': c }).entry.id).toBe('1-3');
    for (const played of [false, true]) expect(pick('?level=1-4', played).entry.id, `1-4 ${played}`).toBe('1-4');
    expect(pick('?level=1-4', true, { '1-1': c, '1-2': c, '1-3': c }, { '1': 3 }).entry.id).toBe('1-4');
  });

  it('GDD-UI-02 which level: an address gives seven lives, whatever lives World 1 keeps', () => {
    expect(pick('?level=1-2', true, { '1-1': c }, { '1': 3 })).toMatchObject({ lives: 7 });
    expect(pick('?level=1-1', true, {}, { '1': 0 })).toMatchObject({ lives: 7 });
    expect(pick('?level=slopes', true, {}, { '1': 2 })).toMatchObject({ lives: 7 });
  });

  it('GDD-UI-02 which level: any other address gives the rule', () => {
    for (const search of ['?level=nope', '?level=', '?level=8-1', '?levels=2-1']) {
      expect(pick(search, false).entry.id, search).toBe('0-1');
      expect(pick(search, true).entry.id, search).toBe('1-1');
      expect(pick(search, true, { '1-1': c }, { '1': 5 }), search).toMatchObject({ entry: { id: '1-2' }, lives: 5 });
    }
  });

  it('GDD-UI-02 which level: an address opens a World 2 level, with seven, whatever is saved', () => {
    for (const id of ['2-1', '2-2', '2-3', '2-4']) {
      for (const played of [false, true]) expect(pick(`?level=${id}`, played), `${id} ${played}`).toMatchObject({ entry: { id }, lives: 7 });
      expect(pick(`?level=${id}`, true, { '1-4': c }, { '2': 2 }, { '2': '2-3' }), id).toMatchObject({ entry: { id }, lives: 7 });
    }
  });

  it('GDD-UI-02 which level: the slopes address opens the slopes test level', () => {
    expect(pick('?level=slopes', false).entry.id).toBe('slopes');
    expect(pick('?level=slopes', true).entry.id).toBe('slopes');
  });

  it('GDD-UI-02 which level: once the tutorial has started, Start plays the first World 1 level not cleared', () => {
    expect(pick('', true, {}).entry.id).toBe('1-1');
    expect(pick('', true, { '1-1': c }).entry.id).toBe('1-2');
    // An entry that is not cleared, as the Siete vidas gastadas screen writes (GDD-PRG-02).
    expect(pick('', true, { '1-1': { cleared: false } }).entry.id).toBe('1-1');
    expect(pick('', true, { '1-2': c }).entry.id).toBe('1-1');
    // The tutorial is not a World 1 level.
    expect(pick('', true, { '0-1': c }).entry.id).toBe('1-1');
    expect(pick('', true, { '1-1': c, '1-2': { cleared: false } }).entry.id).toBe('1-2');
    expect(pick('', true, { '1-1': c, '1-2': c }).entry.id).toBe('1-3');
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': { cleared: false } }).entry.id).toBe('1-3');
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c }).entry.id).toBe('1-4');
    // The earliest not cleared.
    expect(pick('', true, { '1-1': c, '1-3': c }).entry.id).toBe('1-2');
  });

  it('GDD-LIFE-05 which level: Start plays a later World 1 level with the lives World 1 keeps, seven when it keeps none', () => {
    expect(pick('', true, { '1-1': c }, { '1': 4 })).toMatchObject({ entry: { id: '1-2' }, lives: 4 });
    expect(pick('', true, { '1-1': c }, { '1': 1 })).toMatchObject({ entry: { id: '1-2' }, lives: 1 });
    expect(pick('', true, { '1-1': c, '1-2': c }, { '1': 4 })).toMatchObject({ entry: { id: '1-3' }, lives: 4 });
    // A save from before the lives were kept.
    expect(pick('', true, { '1-1': c }, {})).toMatchObject({ entry: { id: '1-2' }, lives: 7 });
  });

  it('GDD-LIFE-05 which level: after a game over in World 1, Start plays 1-1 with seven, whatever is cleared', () => {
    // "After a game over the world restarts at 1-1 with 7, however you get there."
    expect(pick('', true, { '1-1': c }, { '1': 0 })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
    expect(pick('', true, {}, { '1': 0 })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
  });

  it('GDD-LIFE-05 which level: 1-1, the world start, always starts with seven', () => {
    expect(pick('', true, { '1-2': c }, { '1': 3 })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
    expect(pick('', true, {}, { '1': 3 })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
  });

  it('GDD-UI-02 which level: with every World 1 level cleared Start plays World 2 from 2-1 with seven, never a test level', () => {
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c, '1-4': c }, { '1': 3 })).toMatchObject({ entry: { id: '2-1' }, lives: 7 });
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c, '1-4': c, sandbox: c, slopes: c }).entry.id).toBe('2-1');
  });

  it('GDD-UI-02 which level: before the tutorial has started Start plays 0-1 with seven, whatever is cleared or kept', () => {
    expect(pick('', false, { '1-1': c }, { '1': 3 })).toMatchObject({ entry: { id: '0-1' }, lives: 7 });
    expect(pick('', false, { '1-1': c, '1-2': c, '1-3': c, '1-4': c }).entry.id).toBe('0-1');
  });

  it('GDD-WLD-01 World 1 levels are 1-1, 1-2, 1-3 and the boss arena 1-4 in order, the test levels left out', () => {
    expect(worldLevels(1).map((x) => x.id)).toEqual(['1-1', '1-2', '1-3', '1-4']);
    expect(worldLevels(0).map((x) => x.id)).toEqual(['0-1']);
    // World 3's labs lab-3c, lab-3t, lab-3m and lab-3a are test levels: 3-1 and 3-2 are its levels, in that order.
    expect(worldLevels(3).map((x) => x.id)).toEqual(['3-1', '3-2']);
  });

  it('GDD-WLD-01 World 2 levels are 2-1, 2-2, 2-3 and the boss arena 2-4 in order', () => {
    expect(worldLevels(2).map((x) => x.id)).toEqual(['2-1', '2-2', '2-3', '2-4']);
  });

  it('GDD-LIFE-05 the save keeps the lives of Worlds 1, 2 and 3, the worlds with a real level', () => {
    expect(SAVED_WORLDS).toEqual([1, 2, 3]);
    expect(SAVED_WORLD_LEVELS).toEqual({ '1': ['1-1', '1-2', '1-3', '1-4'], '2': ['2-1', '2-2', '2-3', '2-4'], '3': ['3-1', '3-2'] });
  });

  it('GDD-UI-02 the level after 0-1 is 1-1, after 1-1 is 1-2, after 1-2 is 1-3, after 1-3 is the boss arena 1-4, after 1-4 is 2-1 and so on to 2-4, 3-1 and 3-2, after which none comes, nor after a test level', () => {
    expect(levelById('0-1')!.next).toBe('1-1');
    expect(levelById('1-1')!.next).toBe('1-2');
    expect(levelById('1-2')!.next).toBe('1-3');
    expect(levelById('1-3')!.next).toBe('1-4');
    expect(levelById('1-4')!.next).toBe('2-1');
    expect(levelById('2-1')!.next).toBe('2-2');
    expect(levelById('2-2')!.next).toBe('2-3');
    expect(levelById('2-3')!.next).toBe('2-4');
    expect(levelById('2-4')!.next).toBe('3-1');
    expect(levelById('3-1')!.next).toBe('3-2');
    expect(levelById('3-2')!.next).toBeUndefined();
    expect(levelById('sandbox')!.next).toBeUndefined();
    expect(levelById('slopes')!.next).toBeUndefined();
    expect(levelById('nope')).toBeUndefined();
  });
});

describe('GDD-LIFE-05 lives through a world', () => {
  it('GDD-LIFE-05 lives carry from a World 1 level into the next and into its Retry', () => {
    expect(livesInto(entryOf('1-1'), entryOf('1-2'), 3)).toBe(3);
    expect(livesInto(entryOf('1-1'), entryOf('1-2'), 1)).toBe(1);
    expect(livesInto(entryOf('1-2'), entryOf('1-2'), 2)).toBe(2);
    expect(livesInto(entryOf('1-2'), entryOf('1-3'), 4)).toBe(4);
    expect(livesInto(entryOf('1-2'), entryOf('1-3'), 1)).toBe(1);
    expect(livesInto(entryOf('1-3'), entryOf('1-3'), 2)).toBe(2);
    expect(livesInto(entryOf('1-3'), entryOf('1-4'), 5)).toBe(5);
    expect(livesInto(entryOf('1-3'), entryOf('1-4'), 1)).toBe(1);
    expect(livesInto(entryOf('1-4'), entryOf('1-4'), 3)).toBe(3);
    expect(livesInto(entryOf('1-1'), entryOf('1-1'), 5)).toBe(5);
  });

  it('GDD-LIFE-05 the lives of the tutorial carry neither into 1-1 nor into its own Retry', () => {
    // GDD-WLD-06: the tutorial is outside the seven worlds.
    expect(livesInto(entryOf('0-1'), entryOf('1-1'), 4)).toBe(7);
    expect(livesInto(entryOf('0-1'), entryOf('0-1'), 4)).toBe(7);
  });

  it('GDD-LIFE-05 a level of another world starts with seven', () => {
    expect(livesInto(entryOf('1-2'), entryOf('2-1'), 3)).toBe(7);
    // 1-4's Next level starts 2-1 with seven (user, 2026-11-04).
    expect(livesInto(entryOf('1-4'), entryOf('2-1'), 3)).toBe(7);
    expect(livesInto(entryOf('1-4'), entryOf('2-1'), 1)).toBe(7);
  });

  it('GDD-LIFE-05 lives carry from a World 2 level into the next and into its Retry', () => {
    expect(livesInto(entryOf('2-1'), entryOf('2-2'), 3)).toBe(3);
    expect(livesInto(entryOf('2-3'), entryOf('2-4'), 2)).toBe(2);
    expect(livesInto(entryOf('2-2'), entryOf('2-2'), 4)).toBe(4);
  });

  it('GDD-LIFE-05 out of lives the restart plays the first level of the world, or a test level own start', () => {
    expect(worldStart(entryOf('1-1')).id).toBe('1-1');
    expect(worldStart(entryOf('1-2')).id).toBe('1-1');
    expect(worldStart(entryOf('1-3')).id).toBe('1-1');
    expect(worldStart(entryOf('1-4')).id).toBe('1-1');
    // World 2 restarts at 2-1 (GDD-LIFE-05's per-world rule, user, 2026-11-04).
    for (const id of ['2-1', '2-2', '2-3', '2-4']) expect(worldStart(entryOf(id)).id, id).toBe('2-1');
    expect(worldStart(entryOf('0-1')).id).toBe('0-1');
    expect(worldStart(entryOf('sandbox')).id).toBe('sandbox');
    expect(worldStart(entryOf('slopes')).id).toBe('slopes');
  });

  it('GDD-LIFE-05 a clear in a World 1 level keeps its lives at the exit for World 1', () => {
    expect(worldLivesAfter({}, entryOf('1-1'), 4)).toEqual({ '1': 4 });
    expect(worldLivesAfter({ '1': 4 }, entryOf('1-2'), 2)).toEqual({ '1': 2 });
    expect(worldLivesAfter({ '1': 2 }, entryOf('1-3'), 5)).toEqual({ '1': 5 });
    expect(worldLivesAfter({ '1': 5 }, entryOf('1-4'), 3)).toEqual({ '1': 3 });
    // A clear after a game over.
    expect(worldLivesAfter({ '1': 0 }, entryOf('1-1'), 6)).toEqual({ '1': 6 });
    // Each world keeps its own (GDD-LIFE-05).
    expect(worldLivesAfter({ '2': 5 }, entryOf('1-1'), 4)).toEqual({ '1': 4, '2': 5 });
  });

  it('GDD-LIFE-05 the Siete vidas gastadas screen in a World 1 level keeps 0 for World 1', () => {
    expect(worldLivesAfter({ '1': 4 }, entryOf('1-2'), 0)).toEqual({ '1': 0 });
    expect(worldLivesAfter({}, entryOf('1-1'), 0)).toEqual({ '1': 0 });
    expect(worldLivesAfter({ '1': 3 }, entryOf('1-3'), 0)).toEqual({ '1': 0 });
    expect(worldLivesAfter({ '1': 3 }, entryOf('1-4'), 0)).toEqual({ '1': 0 });
  });

  it('GDD-LIFE-05 a World 2 level keeps its lives for World 2, and 0 at the Siete vidas gastadas screen', () => {
    expect(worldLivesAfter({ '1': 3 }, entryOf('2-1'), 5)).toEqual({ '1': 3, '2': 5 });
    expect(worldLivesAfter({ '1': 3, '2': 5 }, entryOf('2-2'), 0)).toEqual({ '1': 3, '2': 0 });
  });

  it('GDD-LIFE-05 the tutorial keeps no lives for any world', () => {
    expect(worldLivesAfter({ '1': 4 }, entryOf('0-1'), 2)).toEqual({ '1': 4 });
    expect(worldLivesAfter({}, entryOf('0-1'), 0)).toEqual({});
  });
});

describe('GDD-TEC-04 level 0-1', () => {
  it('GDD-TEC-04 0-1 is a tutorial level held to the exit rule', () => {
    const entry = LEVELS.find((e) => e.id === '0-1')!;
    expect(entry.test).toBe(false);
    const { exit: _exit, ...withoutExit } = entry.level;
    expect(validateLevel({ ...entry, level: withoutExit })).toContain('no exit');
  });
});

describe('GDD-PRG-02 which levels are saved', () => {
  it('GDD-PRG-02 0-1, 1-1, 1-2, 1-3, 1-4, 2-1 to 2-4, 3-1 and 3-2 are saved, with their hilo counts, and the test levels are not', () => {
    // Real levels keep 50 hilos (GDD-WLD-04), the boss arenas 1-4 and 2-4 none (GDD-BOS-01). The sandbox and the slopes level, test levels, are never saved.
    expect(SAVED_LEVELS).toEqual({ '0-1': 50, '1-1': 50, '1-2': 50, '1-3': 50, '1-4': 0, '2-1': 50, '2-2': 50, '2-3': 50, '2-4': 0, '3-1': 50, '3-2': 50 });
  });
});

describe('GDD-PRG-02 saved run: the ofrendas of the saved levels', () => {
  it('GDD-PRG-02 0-1, 1-1, 1-2, 1-3, 2-1 to 2-3, 3-1 and 3-2 have three ofrendas each, 1-4 and 2-4 none, and the test levels are not saved', () => {
    expect(SAVED_OFRENDAS).toEqual({ '0-1': 3, '1-1': 3, '1-2': 3, '1-3': 3, '1-4': 0, '2-1': 3, '2-2': 3, '2-3': 3, '2-4': 0, '3-1': 3, '3-2': 3 });
  });
});

describe('GDD-UI-02 Start follows the World 1 run', () => {
  it('GDD-UI-02 worldAt 1-2 with 4 lives starts 1-2 with 4', () => {
    expect(pick('', true, {}, { '1': 4 }, { '1': '1-2' })).toMatchObject({ entry: { id: '1-2' }, lives: 4 });
  });

  it('GDD-UI-02 worldAt 1-3 with 4 lives starts 1-3 with 4', () => {
    expect(pick('', true, { '1-1': c, '1-2': c }, { '1': 4 }, { '1': '1-3' })).toMatchObject({ entry: { id: '1-3' }, lives: 4 });
  });

  it('GDD-UI-02 worldAt 1-4 with 3 lives starts 1-4 with 3', () => {
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c }, { '1': 3 }, { '1': '1-4' })).toMatchObject({ entry: { id: '1-4' }, lives: 3 });
    expect(pick('', true, {}, { '1': 1 }, { '1': '1-4' })).toMatchObject({ entry: { id: '1-4' }, lives: 1 });
  });

  it('GDD-UI-02 after a game over Start plays 1-1 with seven even with later levels cleared', () => {
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c }, { '1': 0 }, { '1': '1-1' })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
  });

  it('GDD-UI-02 a run kept with no lives plays 1-1 with seven', () => {
    expect(pick('', true, { '1-1': { cleared: true } }, { '1': 0 }, { '1': '1-2' })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
  });

  it('GDD-UI-02 the run wins over the first level not cleared', () => {
    // First-not-cleared would give 1-1 here, all being cleared.
    expect(pick('', true, { '1-1': c, '1-2': c }, { '1': 3 }, { '1': '1-2' })).toMatchObject({ entry: { id: '1-2' }, lives: 3 });
  });

  it('GDD-UI-02 1-1 from the run always gets seven', () => {
    expect(pick('', true, {}, { '1': 5 }, { '1': '1-1' })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
  });

  it('GDD-UI-02 with no run saved the old rule stands', () => {
    expect(pick('', true, { '1-1': c }, {}, {})).toMatchObject({ entry: { id: '1-2' }, lives: 7 });
    expect(pick('', true, {}, {}, {})).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
  });

  it('GDD-UI-02 a run naming no real World 1 level is ignored', () => {
    for (const at of ['sandbox', 'zz', '0-1', 'slopes']) expect(pick('', true, { '1-1': c }, {}, { '1': at }), at).toMatchObject({ entry: { id: '1-2' }, lives: 7 });
  });

  it('GDD-UI-02 an address still wins over the run', () => {
    expect(pick('?level=1-1', true, {}, {}, { '1': '1-2' })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
  });

  it('GDD-UI-02 the tutorial before it has started still wins over the run', () => {
    expect(pick('', false, {}, { '1': 4 }, { '1': '1-2' })).toMatchObject({ entry: { id: '0-1' }, lives: 7 });
  });
});

describe('GDD-PRG-02 worldAtAfter', () => {
  it('GDD-PRG-02 a clear of 1-1 moves the run to 1-2', () => {
    expect(worldAtAfter({}, entryOf('1-1'), 'clear')).toEqual({ '1': '1-2' });
  });

  it('GDD-PRG-02 a clear of the world last level starts a new run at 1-1', () => {
    const world1 = worldLevels(1);
    const last = world1[world1.length - 1]!;
    // World 1's last level is the boss arena 1-4; this test follows the real last one.
    expect(last.id).toBe('1-4');
    expect(worldAtAfter({ '1': last.id }, last, 'clear')).toEqual({ '1': '1-1' });
  });

  it('GDD-PRG-02 a clear of 1-2 moves the run to 1-3', () => {
    expect(worldAtAfter({ '1': '1-2' }, entryOf('1-2'), 'clear')).toEqual({ '1': '1-3' });
  });

  it('GDD-PRG-02 a clear of 1-3 moves the run to 1-4', () => {
    expect(worldAtAfter({ '1': '1-3' }, entryOf('1-3'), 'clear')).toEqual({ '1': '1-4' });
  });

  it('GDD-PRG-02 a clear of 1-4 moves the run back to 1-1', () => {
    expect(worldAtAfter({ '1': '1-4' }, entryOf('1-4'), 'clear')).toEqual({ '1': '1-1' });
  });

  it('GDD-PRG-02 a game over puts the run back at the world first level', () => {
    expect(worldAtAfter({ '1': '1-2' }, entryOf('1-2'), 'gameover')).toEqual({ '1': '1-1' });
    // In a level that names a next one too: a game over never moves the run on (review of PR #72).
    expect(worldAtAfter({ '1': '1-2' }, entryOf('1-1'), 'gameover')).toEqual({ '1': '1-1' });
    expect(worldAtAfter({ '1': '1-3' }, entryOf('1-3'), 'gameover')).toEqual({ '1': '1-1' });
    expect(worldAtAfter({ '1': '1-4' }, entryOf('1-4'), 'gameover')).toEqual({ '1': '1-1' });
  });

  it('GDD-PRG-02 a clear in World 2 moves its run on, the clear of its last level 2-4 back to 2-1, a game over back to 2-1', () => {
    expect(worldAtAfter({ '1': '1-1' }, entryOf('2-1'), 'clear')).toEqual({ '1': '1-1', '2': '2-2' });
    expect(worldAtAfter({ '2': '2-3' }, entryOf('2-3'), 'clear')).toEqual({ '2': '2-4' });
    expect(worldAtAfter({ '2': '2-4' }, entryOf('2-4'), 'clear')).toEqual({ '2': '2-1' });
    expect(worldAtAfter({ '2': '2-3' }, entryOf('2-3'), 'gameover')).toEqual({ '2': '2-1' });
  });

  it('GDD-PRG-02 the tutorial writes nothing', () => {
    expect(worldAtAfter({ '1': '1-2' }, entryOf('0-1'), 'clear')).toEqual({ '1': '1-2' });
    expect(worldAtAfter({ '1': '1-2' }, entryOf('0-1'), 'gameover')).toEqual({ '1': '1-2' });
  });

  it('GDD-PRG-02 other worlds entries are kept', () => {
    expect(worldAtAfter({ '2': '2-1' }, entryOf('1-1'), 'clear')).toEqual({ '1': '1-2', '2': '2-1' });
  });
});

// GDD-UI-02 (user, 2026-11-04): "Start" plays the latest world reached: once 1-4 is cleared it continues World 2's run, and a save from
// before World 2 that cleared 1-4 goes to 2-1 with seven (no save migration).
const WORLD_1 = { '1-1': c, '1-2': c, '1-3': c, '1-4': c };
/** Every World 2 level cleared, its boss arena 2-4 included. */
const WORLD_2 = { '2-1': c, '2-2': c, '2-3': c, '2-4': c };

describe('GDD-UI-02 Start frontier', () => {
  it('GDD-UI-02 frontier world: World 1 until 1-4 is cleared, then World 2 until 2-4 is cleared, then World 3', () => {
    expect(frontierWorld({})).toBe(1);
    expect(frontierWorld({ '1-1': c, '1-2': c, '1-3': c })).toBe(1);
    expect(frontierWorld({ '1-4': { cleared: false } })).toBe(1);
    expect(frontierWorld({ '1-4': c })).toBe(2);
    expect(frontierWorld(WORLD_1)).toBe(2);
    expect(frontierWorld({ ...WORLD_1, '2-1': c, '2-2': c, '2-3': c })).toBe(2);
    expect(frontierWorld({ ...WORLD_1, ...WORLD_2, '2-4': { cleared: false } })).toBe(2);
    // 2-4 names 3-1: World 3 is the latest once it is cleared.
    expect(frontierWorld({ ...WORLD_1, ...WORLD_2 })).toBe(3);
    // 3-1 names 3-2, in the same world, and 3-2, the last level built, names no next level: World 3 stays the latest.
    expect(frontierWorld({ ...WORLD_1, ...WORLD_2, '3-1': c })).toBe(3);
    expect(frontierWorld({ ...WORLD_1, ...WORLD_2, '3-1': c, '3-2': c })).toBe(3);
  });

  it('GDD-UI-02 frontier old save: 1-4 cleared and nothing of World 2 plays 2-1 with seven, whatever World 1 keeps', () => {
    expect(pick('', true, WORLD_1, { '1': 3 }, { '1': '1-1' })).toMatchObject({ entry: { id: '2-1' }, lives: 7 });
    expect(pick('', true, { '1-4': c }, {}, {})).toMatchObject({ entry: { id: '2-1' }, lives: 7 });
    expect(pick('', true, WORLD_1, { '1': 0 }, { '1': '1-1' })).toMatchObject({ entry: { id: '2-1' }, lives: 7 });
  });

  it('GDD-UI-02 frontier run: the World 2 run plays where it is with the lives World 2 keeps', () => {
    expect(pick('', true, WORLD_1, { '1': 6, '2': 4 }, { '1': '1-1', '2': '2-3' })).toMatchObject({ entry: { id: '2-3' }, lives: 4 });
    expect(pick('', true, { ...WORLD_1, '2-1': c }, { '2': 2 }, { '2': '2-2' })).toMatchObject({ entry: { id: '2-2' }, lives: 2 });
    expect(pick('', true, WORLD_1, { '2': 3 }, { '2': '2-4' })).toMatchObject({ entry: { id: '2-4' }, lives: 3 });
  });

  it('GDD-UI-02 frontier run start: 2-1 from the run always gets seven', () => {
    expect(pick('', true, WORLD_1, { '2': 3 }, { '2': '2-1' })).toMatchObject({ entry: { id: '2-1' }, lives: 7 });
  });

  it('GDD-LIFE-05 frontier game over: after the last life in World 2 Start plays 2-1 with seven', () => {
    expect(pick('', true, { ...WORLD_1, '2-1': c, '2-2': c }, { '2': 0 }, { '2': '2-1' })).toMatchObject({ entry: { id: '2-1' }, lives: 7 });
    // A run kept with no lives, which only a damaged save holds.
    expect(pick('', true, WORLD_1, { '2': 0 }, { '2': '2-3' })).toMatchObject({ entry: { id: '2-1' }, lives: 7 });
  });

  it('GDD-UI-02 frontier without a run: the first World 2 level not cleared, with the lives World 2 keeps', () => {
    expect(pick('', true, { ...WORLD_1, '2-1': c }, { '2': 5 })).toMatchObject({ entry: { id: '2-2' }, lives: 5 });
    expect(pick('', true, { ...WORLD_1, '2-1': c, '2-2': c }, {})).toMatchObject({ entry: { id: '2-3' }, lives: 7 });
    // A run naming no World 2 level is ignored.
    for (const at of ['1-2', 'sandbox', 'zz']) expect(pick('', true, { ...WORLD_1, '2-1': c }, { '2': 5 }, { '2': at }), at).toMatchObject({ entry: { id: '2-2' }, lives: 5 });
  });

  it('GDD-UI-02 frontier all cleared: with every level of the latest world cleared Start plays its first level with seven', () => {
    // World 3, the latest world, holds 3-1 and 3-2 so far.
    const world3 = { ...WORLD_1, ...WORLD_2, '3-1': c, '3-2': c };
    expect(pick('', true, world3, { '2': 3, '3': 3 })).toMatchObject({ entry: { id: '3-1' }, lives: 7 });
    expect(pick('', true, world3, { '3': 3 }, { '3': '3-1' })).toMatchObject({ entry: { id: '3-1' }, lives: 7 });
    // With 3-1 cleared and 3-2 not, and no run kept, its first level not cleared, with the lives World 3 keeps.
    expect(pick('', true, { ...WORLD_1, ...WORLD_2, '3-1': c }, { '2': 3, '3': 3 })).toMatchObject({ entry: { id: '3-2' }, lives: 3 });
  });

  it('GDD-UI-02 frontier stays: before 1-4 is cleared World 2 entries change nothing', () => {
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c, '2-1': c }, { '1': 3, '2': 5 }, { '1': '1-4', '2': '2-2' })).toMatchObject({ entry: { id: '1-4' }, lives: 3 });
    expect(pick('', true, { '1-1': c, '2-1': c }, { '2': 5 })).toMatchObject({ entry: { id: '1-2' }, lives: 7 });
  });

  it('GDD-UI-02 frontier tutorial: before the tutorial has started it still wins', () => {
    expect(pick('', false, WORLD_1, { '2': 4 }, { '2': '2-3' })).toMatchObject({ entry: { id: '0-1' }, lives: 7 });
  });
});

// GDD-WLD-16, GDD-UI-02, GDD-LIFE-05: 3-1, World 3's first level, follows 2-4 as 2-1 follows 1-4.
describe('GDD-UI-02 World 3 after 2-4', () => {
  it("GDD-UI-02 2-4's next level is 3-1, which starts with seven lives whatever he had", () => {
    expect(levelById('2-4')!.next).toBe('3-1');
    expect(levelById('3-1')).toMatchObject({ id: '3-1', world: 3, test: false });
    // 3-1's next level is 3-2, in the same world (GDD-WLD-17); 3-2 is the last level built: it names none, and its results menu leads
    // to the title.
    expect(levelById('3-1')!.next).toBe('3-2');
    expect(levelById('3-2')!.next).toBeUndefined();
    for (const lives of [1, 3, 6, 7]) expect(livesInto(entryOf('2-4'), entryOf('3-1'), lives), `${lives}`).toBe(7);
    // Its Retry keeps his lives, as in any level of the seven worlds, and so does its Next level, 3-2 (GDD-LIFE-05).
    expect(livesInto(entryOf('3-1'), entryOf('3-1'), 4)).toBe(4);
    expect(livesInto(entryOf('3-1'), entryOf('3-2'), 4)).toBe(4);
  });

  it("GDD-UI-02 once 2-4 is cleared Start plays World 3: 3-1 with seven lives; before that it plays World 2's run", () => {
    expect(pick('', true, { ...WORLD_1, ...WORLD_2 }, { '2': 3 }, { '2': '2-1' })).toMatchObject({ entry: { id: '3-1' }, lives: 7 });
    // The world's first level always with seven, whatever World 3 keeps.
    expect(pick('', true, { ...WORLD_1, ...WORLD_2 }, { '3': 2 }, { '3': '3-1' })).toMatchObject({ entry: { id: '3-1' }, lives: 7 });
    expect(pick('', true, { ...WORLD_1, ...WORLD_2 }, {}, {})).toMatchObject({ entry: { id: '3-1' }, lives: 7 });
    // Before 2-4 is cleared: World 2's run, where it is.
    expect(pick('', true, { ...WORLD_1, '2-1': c, '2-2': c, '2-3': c }, { '2': 4 }, { '2': '2-4' })).toMatchObject({ entry: { id: '2-4' }, lives: 4 });
    expect(pick('', true, { ...WORLD_1, '2-1': c, '2-2': c, '2-3': c, '2-4': { cleared: false } }, { '2': 4, '3': 2 }, { '2': '2-3', '3': '3-1' })).toMatchObject({ entry: { id: '2-3' }, lives: 4 });
  });

  it("GDD-LIFE-05 the restart after the last life in 3-1 or 3-2 plays 3-1, and World 3's lives are kept in the save", () => {
    expect(worldStart(entryOf('3-1')).id).toBe('3-1');
    expect(worldStart(entryOf('3-2')).id).toBe('3-1');
    expect(worldLivesAfter({ '2': 3 }, entryOf('3-1'), 5)).toEqual({ '2': 3, '3': 5 });
    expect(worldLivesAfter({ '2': 3, '3': 5 }, entryOf('3-1'), 0)).toEqual({ '2': 3, '3': 0 });
    // A clear of 3-1 moves World 3's run to 3-2; a clear of 3-2, the last level built, and a game over in either put it at 3-1.
    expect(worldAtAfter({ '2': '2-4' }, entryOf('3-1'), 'clear')).toEqual({ '2': '2-4', '3': '3-2' });
    expect(worldAtAfter({}, entryOf('3-2'), 'clear')).toEqual({ '3': '3-1' });
    expect(worldAtAfter({}, entryOf('3-1'), 'gameover')).toEqual({ '3': '3-1' });
    expect(worldAtAfter({}, entryOf('3-2'), 'gameover')).toEqual({ '3': '3-1' });
    // A clear of 2-4 starts World 2's run again at 2-1: its next level is in World 3.
    expect(worldAtAfter({ '2': '2-4' }, entryOf('2-4'), 'clear')).toEqual({ '2': '2-1' });
    expect(SAVED_WORLDS).toEqual([1, 2, 3]);
    expect(SAVED_WORLD_LEVELS['3']).toEqual(['3-1', '3-2']);
  });

  it("GDD-PRG-02 3-1's and 3-2's progress is saved: their 50 hilos and three ofrendas", () => {
    expect(SAVED_LEVELS['3-1']).toBe(50);
    expect(SAVED_OFRENDAS['3-1']).toBe(3);
    expect(SAVED_LEVELS['3-2']).toBe(50);
    expect(SAVED_OFRENDAS['3-2']).toBe(3);
  });
});

/** GDD-PRG-01: whether he glides on any of 60 steps of jump held from the level's spawn. */
const glides = (level: Level): boolean => {
  let r = startRun(level);
  let glided = false;
  for (let i = 0; i < 60; i++) {
    r = stepRun(r, { move: 0, jumpHeld: true }, level);
    glided ||= r.player.gliding === true;
  }
  return glided;
};

describe('GDD-PRG-01 the glide unlock', () => {
  it('GDD-PRG-01 the glide is unlocked once 2-4 is cleared, and by nothing else', () => {
    expect(unlockedAbilities({})).toEqual({});
    const allBut24 = Object.fromEntries(LEVELS.filter((e) => e.id !== '2-4').map((e) => [e.id, c]));
    expect(allBut24).toMatchObject({ '1-4': c, '2-3': c });
    expect(unlockedAbilities(allBut24)).toEqual({});
    expect(unlockedAbilities({ '2-4': { cleared: false } })).toEqual({});
    expect(unlockedAbilities({ '2-4': c })).toEqual({ glide: true });
    expect(unlockedAbilities({ ...allBut24, '2-4': c })).toEqual({ glide: true });
    expect(GLIDE_UNLOCK_ID).toBe('2-4');
  });

  it('GDD-PRG-01 an unlocked glide is added to every level and takes nothing a level has away', () => {
    for (const e of LEVELS) {
      const glided = withUnlocks(e.level, { glide: true });
      expect(glided.abilities?.glide, e.id).toBe(true);
      expect(glided.abilities?.wallCling, e.id).toBe(e.level.abilities?.wallCling);
      const fields = new Map(Object.entries(glided));
      for (const [key, value] of Object.entries(e.level)) if (key !== 'abilities') expect(fields.get(key), `${e.id} ${key}`).toBe(value);
      expect(new Set([...fields.keys()].filter((k) => k !== 'abilities')), e.id).toEqual(new Set(Object.keys(e.level).filter((k) => k !== 'abilities')));
      expect(withUnlocks(e.level, {}), e.id).toBe(e.level);
    }
    expect(withUnlocks(SANDBOX_LEVEL, { glide: true }).abilities).toEqual({ glide: true, wallCling: true });
  });

  it('GDD-PRG-01 with the glide unlocked a held jump glides in 1-1, and without it does not', () => {
    expect(glides(LEVEL_1_1)).toBe(false);
    expect(glides(withUnlocks(LEVEL_1_1, { glide: true }))).toBe(true);
  });
});
