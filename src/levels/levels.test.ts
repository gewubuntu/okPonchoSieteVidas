import { describe, expect, it } from 'vitest';
import { LEVELS, levelById, livesInto, SAVED_LEVELS, SAVED_OFRENDAS, SAVED_WORLDS, startLevel, worldAtAfter, worldLevels, worldLivesAfter, worldStart, type LevelEntry } from './index';
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
  });

  it('GDD-UI-02 which level: an address gives seven lives, whatever lives World 1 keeps', () => {
    expect(pick('?level=1-2', true, { '1-1': c }, { '1': 3 })).toMatchObject({ lives: 7 });
    expect(pick('?level=1-1', true, {}, { '1': 0 })).toMatchObject({ lives: 7 });
    expect(pick('?level=slopes', true, {}, { '1': 2 })).toMatchObject({ lives: 7 });
  });

  it('GDD-UI-02 which level: any other address gives the rule', () => {
    for (const search of ['?level=nope', '?level=', '?level=2-1']) {
      expect(pick(search, false).entry.id, search).toBe('0-1');
      expect(pick(search, true).entry.id, search).toBe('1-1');
      expect(pick(search, true, { '1-1': c }, { '1': 5 }), search).toMatchObject({ entry: { id: '1-2' }, lives: 5 });
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

  it('GDD-UI-02 which level: with every World 1 level cleared Start plays 1-1 with seven, never a test level', () => {
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c }, { '1': 3 })).toMatchObject({ entry: { id: '1-1' }, lives: 7 });
    expect(pick('', true, { '1-1': c, '1-2': c, '1-3': c, sandbox: c, slopes: c }).entry.id).toBe('1-1');
  });

  it('GDD-UI-02 which level: before the tutorial has started Start plays 0-1 with seven, whatever is cleared or kept', () => {
    expect(pick('', false, { '1-1': c }, { '1': 3 })).toMatchObject({ entry: { id: '0-1' }, lives: 7 });
    expect(pick('', false, { '1-1': c, '1-2': c, '1-3': c }).entry.id).toBe('0-1');
  });

  it('GDD-WLD-01 World 1 levels are 1-1, 1-2 and 1-3 in order, the test levels left out', () => {
    expect(worldLevels(1).map((x) => x.id)).toEqual(['1-1', '1-2', '1-3']);
    expect(worldLevels(0).map((x) => x.id)).toEqual(['0-1']);
    expect(worldLevels(2)).toEqual([]);
  });

  it('GDD-LIFE-05 the save keeps the lives of World 1, the only world with a real level', () => {
    expect(SAVED_WORLDS).toEqual([1]);
  });

  it('GDD-UI-02 the level after 0-1 is 1-1, after 1-1 is 1-2, after 1-2 is 1-3, and none comes after 1-3 or a test level', () => {
    expect(levelById('0-1')!.next).toBe('1-1');
    expect(levelById('1-1')!.next).toBe('1-2');
    expect(levelById('1-2')!.next).toBe('1-3');
    expect(levelById('1-3')!.next).toBeUndefined();
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
    expect(livesInto(entryOf('1-1'), entryOf('1-1'), 5)).toBe(5);
  });

  it('GDD-LIFE-05 the lives of the tutorial carry neither into 1-1 nor into its own Retry', () => {
    // GDD-WLD-06: the tutorial is outside the seven worlds.
    expect(livesInto(entryOf('0-1'), entryOf('1-1'), 4)).toBe(7);
    expect(livesInto(entryOf('0-1'), entryOf('0-1'), 4)).toBe(7);
  });

  it('GDD-LIFE-05 a level of another world starts with seven', () => {
    // A made-up World 2 entry, since none exists yet.
    const w2: LevelEntry = { ...entryOf('1-1'), id: '2-1', world: 2 };
    expect(livesInto(entryOf('1-2'), w2, 3)).toBe(7);
  });

  it('GDD-LIFE-05 out of lives the restart plays the first level of the world, or a test level own start', () => {
    expect(worldStart(entryOf('1-1')).id).toBe('1-1');
    expect(worldStart(entryOf('1-2')).id).toBe('1-1');
    expect(worldStart(entryOf('1-3')).id).toBe('1-1');
    expect(worldStart(entryOf('0-1')).id).toBe('0-1');
    expect(worldStart(entryOf('sandbox')).id).toBe('sandbox');
    expect(worldStart(entryOf('slopes')).id).toBe('slopes');
  });

  it('GDD-LIFE-05 a clear in a World 1 level keeps its lives at the exit for World 1', () => {
    expect(worldLivesAfter({}, entryOf('1-1'), 4)).toEqual({ '1': 4 });
    expect(worldLivesAfter({ '1': 4 }, entryOf('1-2'), 2)).toEqual({ '1': 2 });
    expect(worldLivesAfter({ '1': 2 }, entryOf('1-3'), 5)).toEqual({ '1': 5 });
    // A clear after a game over.
    expect(worldLivesAfter({ '1': 0 }, entryOf('1-1'), 6)).toEqual({ '1': 6 });
    // Each world keeps its own (GDD-LIFE-05).
    expect(worldLivesAfter({ '2': 5 }, entryOf('1-1'), 4)).toEqual({ '1': 4, '2': 5 });
  });

  it('GDD-LIFE-05 the Siete vidas gastadas screen in a World 1 level keeps 0 for World 1', () => {
    expect(worldLivesAfter({ '1': 4 }, entryOf('1-2'), 0)).toEqual({ '1': 0 });
    expect(worldLivesAfter({}, entryOf('1-1'), 0)).toEqual({ '1': 0 });
    expect(worldLivesAfter({ '1': 3 }, entryOf('1-3'), 0)).toEqual({ '1': 0 });
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
  it('GDD-PRG-02 0-1, 1-1, 1-2 and 1-3 are saved, with their hilo counts, and the test levels are not', () => {
    // Real levels keep 50 hilos (GDD-WLD-04); the sandbox and the slopes level, test levels, are never saved.
    expect(SAVED_LEVELS).toEqual({ '0-1': 50, '1-1': 50, '1-2': 50, '1-3': 50 });
  });
});

describe('GDD-PRG-02 saved run: the ofrendas of the saved levels', () => {
  it('GDD-PRG-02 0-1, 1-1, 1-2 and 1-3 have three ofrendas each, and the test levels are not saved', () => {
    expect(SAVED_OFRENDAS).toEqual({ '0-1': 3, '1-1': 3, '1-2': 3, '1-3': 3 });
  });
});

describe('GDD-UI-02 Start follows the World 1 run', () => {
  it('GDD-UI-02 worldAt 1-2 with 4 lives starts 1-2 with 4', () => {
    expect(pick('', true, {}, { '1': 4 }, { '1': '1-2' })).toMatchObject({ entry: { id: '1-2' }, lives: 4 });
  });

  it('GDD-UI-02 worldAt 1-3 with 4 lives starts 1-3 with 4', () => {
    expect(pick('', true, { '1-1': c, '1-2': c }, { '1': 4 }, { '1': '1-3' })).toMatchObject({ entry: { id: '1-3' }, lives: 4 });
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
    // Today's last level of World 1 is 1-3 (the boss, 1-4, will follow it); this test follows the real last one.
    expect(last.id).toBe('1-3');
    expect(worldAtAfter({ '1': last.id }, last, 'clear')).toEqual({ '1': '1-1' });
  });

  it('GDD-PRG-02 a clear of 1-2 moves the run to 1-3', () => {
    expect(worldAtAfter({ '1': '1-2' }, entryOf('1-2'), 'clear')).toEqual({ '1': '1-3' });
  });

  it('GDD-PRG-02 a game over puts the run back at the world first level', () => {
    expect(worldAtAfter({ '1': '1-2' }, entryOf('1-2'), 'gameover')).toEqual({ '1': '1-1' });
    // In a level that names a next one too: a game over never moves the run on (review of PR #72).
    expect(worldAtAfter({ '1': '1-2' }, entryOf('1-1'), 'gameover')).toEqual({ '1': '1-1' });
    expect(worldAtAfter({ '1': '1-3' }, entryOf('1-3'), 'gameover')).toEqual({ '1': '1-1' });
  });

  it('GDD-PRG-02 the tutorial writes nothing', () => {
    expect(worldAtAfter({ '1': '1-2' }, entryOf('0-1'), 'clear')).toEqual({ '1': '1-2' });
    expect(worldAtAfter({ '1': '1-2' }, entryOf('0-1'), 'gameover')).toEqual({ '1': '1-2' });
  });

  it('GDD-PRG-02 other worlds entries are kept', () => {
    expect(worldAtAfter({ '2': '2-1' }, entryOf('1-1'), 'clear')).toEqual({ '1': '1-2', '2': '2-1' });
  });
});
