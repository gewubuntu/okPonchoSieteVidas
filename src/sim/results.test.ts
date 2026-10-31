import { describe, expect, it } from 'vitest';
import { HILO, MEDAL, RESULTS, RESULTS_MENU } from '../config/tuning';
import { loseLife, startWorld } from './lives';
import type { PlayerInput } from './movement';
import { PLAYING, TAP_OFF, type PauseEvent, type PauseState, type Tap } from './pause';
import { bestTimeSuffix, clearTime, medal, medalLine, medalSuffix, openResults, resultsFrame, resultsShown, revealedLines, type ResultsItem, type ResultsMenu } from './results';
import { startRun, stepRun, type Level, type RunState } from './run';
import { DEFAULT_SETTINGS } from './settings';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };

// A flat level, 30 x 17 tiles, the floor's top at row 14 (y = 224), as in exit.test.ts.
const flat = parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('##############################')]);
const bare: Level = { world: flat, spawn: { x: 24, y: 224 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };
const base: Level = { ...bare, exit: { x: 200, y: 224 } };
/** A level with `n` hilos, placed away from the floor's start. */
const withHilos = (n: number): Level => ({ ...base, hilos: Array.from({ length: n }, (_, i) => ({ col: 2 + (i % 20), row: 8 + Math.floor(i / 20) })) });
/** A run with `taken` of the level's hilos collected and `lives` lives left. */
const runWith = (level: Level, taken: number, lives: number): RunState => {
  let lost = startWorld();
  for (let i = startWorld().lives; i > lives; i--) lost = loseLife(lost);
  const r = startRun(level);
  return { ...r, hilosTaken: r.hilosTaken.map((_, i) => i < taken), lives: lost };
};

describe('GDD-UI-02 clear time', () => {
  it('GDD-UI-02 clear time is minutes and whole seconds, rounded down', () => {
    expect(clearTime(0, 'Time')).toBe('Time 0:00');
    expect(clearTime(59, 'Time')).toBe('Time 0:00');
    expect(clearTime(60, 'Time')).toBe('Time 0:01');
    expect(clearTime(7 * 60, 'Time')).toBe('Time 0:07');
    expect(clearTime(134 * 60 + 59, 'Time')).toBe('Time 2:14');
    expect(clearTime(725 * 60, 'Time')).toBe('Time 12:05');
    // The word is the language's (GDD-UI-02 Language).
    expect(clearTime(134 * 60, 'Zeit')).toBe('Zeit 2:14');
  });

  it('GDD-UI-02 clear time stops at 99:59', () => {
    expect(clearTime(5999 * 60, 'Time')).toBe('Time 99:59');
    expect(clearTime(6000 * 60, 'Time')).toBe('Time 99:59');
    expect(clearTime(10_000 * 60, 'Time')).toBe('Time 99:59');
  });
});

/** Walks right from x 150 with 3 lives left (4 lost), to the exit, and returns the run there. */
const walk = (l: Level): RunState => {
  let r = startRun(l);
  for (let i = 0; i < 4; i++) r = { ...r, lives: loseLife(r.lives) };
  r = { ...r, player: { ...r.player, x: 150 } };
  for (let i = 0; i < 80 && r.phase === 'playing'; i++) r = stepRun(r, right, l);
  return r;
};

describe('GDD-PRG-03 medals', () => {
  it('GDD-PRG-03 bronze for a clear without every hilo', () => {
    const level = withHilos(50);
    expect(medal(runWith(level, 49, 7), level)).toBe('bronze');
    expect(medal(runWith(level, 0, 7), level)).toBe('bronze');
  });

  it('GDD-PRG-03 silver for every hilo with 3 lives', () => {
    const level = withHilos(50);
    expect(medal(runWith(level, 50, 3), level)).toBe('silver');
    expect(medal(runWith(level, 50, 1), level)).toBe('silver');
  });

  it('GDD-PRG-03 gold for every hilo and 4 lives', () => {
    const level = withHilos(50);
    expect(medal(runWith(level, 50, 4), level)).toBe('gold');
    expect(medal(runWith(level, 50, 7), level)).toBe('gold');
  });

  it('GDD-PRG-03 a level without hilos has them all', () => {
    expect(medal(runWith(base, 0, 7), base)).toBe('gold');
    expect(medal(runWith(base, 0, 3), base)).toBe('silver');
  });

  it('GDD-PRG-03 hilos kept through the restart after the last life count', () => {
    // A floor with a 3-tile pit, and a hilo at the spawn.
    const pitWorld = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
    const level: Level = { ...bare, world: pitWorld, spawn: { x: 24, y: 64 }, hilos: [{ col: 1, row: 3 }] };
    let r = stepRun(startRun(level), idle, level);
    expect(r.hilosTaken).toEqual([true]);
    // One life left; the pit takes it, the screen after the last life comes up and a press restarts the world.
    for (let i = 0; i < 6; i++) r = { ...r, lives: loseLife(r.lives) };
    for (let i = 0; i < 600 && r.phase !== 'gameover'; i++) r = stepRun(r, right, level);
    expect(r.phase).toBe('gameover');
    for (let i = 0; i < 60; i++) r = stepRun(r, idle, level);
    r = stepRun(r, jump, level);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(7);
    expect(r.hilosTaken).toEqual([true]);
    expect(medal(r, level)).toBe('gold');
  });

  it('GDD-PRG-03 a life restored by an ofrenda counts at the exit', () => {
    const level: Level = { ...base, hilos: [{ col: 10, row: 13 }], ofrendas: [{ id: 'a', x: 170, y: 224 }] };
    // 3 lives are left until the ofrenda gives one back: 4, which is gold.
    const withOfrenda = walk(level);
    expect(withOfrenda.phase).toBe('clear');
    expect(withOfrenda.hilosTaken).toEqual([true]);
    expect(withOfrenda.lives.lives).toBe(4);
    expect(medal(withOfrenda, level)).toBe('gold');
    // The same walk without the ofrenda ends with 3 lives: silver.
    const without = walk({ ...level, ofrendas: [] });
    expect(without.lives.lives).toBe(3);
    expect(medal(without, level)).toBe('silver');
  });

});

/** A run on the clear screen, `wait` steps into it. */
const onScreen = (wait: number, revealAll = false): RunState => ({ ...startRun(base), phase: 'clear', wait, revealAll });

describe('GDD-UI-02 reveal', () => {
  it('GDD-UI-02 the lines appear at 15, 30 and 45 steps', () => {
    const expected: [number, number][] = [[0, 0], [14, 0], [15, 1], [29, 1], [30, 2], [44, 2], [45, 3], [100, 3]];
    for (const [wait, lines] of expected) expect(revealedLines(onScreen(wait)), `wait ${wait}`).toBe(lines);
    expect(revealedLines(onScreen(1, true))).toBe(3);
  });

  it('GDD-UI-02 the medal line is centred with its disc', () => {
    // The disc is 10 across and 6 from the text: with a text 60 wide the pair is 76 wide, from 202 to 278.
    expect(medalLine(60)).toEqual({ discX: 207, textX: 218 });
    expect(medalLine(0)).toEqual({ discX: 237, textX: 248 });
  });
});

describe('GDD-UI-02 tuning derived from the GDD', () => {
  it('GDD-UI-02 the reveal steps are 0.25, 0.5 and 0.75 s', () => {
    expect([...RESULTS.revealSteps]).toEqual([15, 30, 45]);
  });

  it('GDD-PRG-03 gold needs 4 lives', () => {
    expect(MEDAL.goldLives).toBe(4);
  });

  it('GDD-UI-02 the results menu rows: 160 by 28, the first at 162, the greyed colour', () => {
    expect({ ...RESULTS_MENU }).toEqual({ width: 160, rowHeight: 28, top: 162, greyed: 0x5c6178 });
  });
});

const PAUSED: PauseState = { ...PLAYING, paused: true };
const at = (choice: ResultsItem): ResultsMenu => ({ choice });
const tap = (t: Partial<Tap>): Tap => ({ ...TAP_OFF, ...t });
/** One frame of events on the menu, Next level available unless said. */
const frame = (menu: ResultsMenu, events: readonly PauseEvent[], hasNext = true, pause: PauseState = PLAYING) => resultsFrame(pause, menu, events, hasNext, DEFAULT_SETTINGS);
/** The row chosen after the events, none of which picks. */
const chosen = (menu: ResultsMenu, events: readonly PauseEvent[], hasNext = true): ResultsItem => {
  const r = frame(menu, events, hasNext);
  expect(r.pick, JSON.stringify(events)).toBeNull();
  return r.menu.choice;
};

/** A run in `phase`, `wait` steps into it. */
const onPhase = (phase: RunState['phase'], wait: number): RunState => ({ ...startRun(base), phase, wait });

describe('GDD-UI-02 results menu', () => {
  it('GDD-UI-02 results menu opens on Next level, or on Retry without a next level', () => {
    expect(openResults(true).choice).toBe('next');
    expect(openResults(false).choice).toBe('retry');
  });

  it("GDD-UI-02 results menu is up from the clear screen's first 1.0 s", () => {
    expect(resultsShown(onPhase('clear', 59))).toBe(false);
    expect(resultsShown(onPhase('clear', 60))).toBe(true);
    expect(resultsShown(onPhase('clear', 200))).toBe(true);
    expect(resultsShown(onPhase('playing', 100))).toBe(false);
    expect(resultsShown(onPhase('gameover', 100))).toBe(false);
  });

  it('GDD-UI-02 results menu Up and Down choose, no wrap-around', () => {
    let m = at('next');
    const down = () => (m = { choice: chosen(m, ['menuDown']) });
    const up = () => (m = { choice: chosen(m, ['menuUp']) });
    expect([down(), down(), down()].map((x) => x.choice)).toEqual(['retry', 'quit', 'quit']);
    expect([up(), up(), up()].map((x) => x.choice)).toEqual(['retry', 'next', 'next']);
  });

  it('GDD-UI-02 results menu: the greyed Next level cannot be chosen', () => {
    expect(chosen(at('retry'), ['menuUp'], false)).toBe('retry');
    expect(chosen(at('quit'), ['menuUp', 'menuUp'], false)).toBe('retry');
    expect(chosen(at('retry'), ['menuUp', 'menuDown'], false)).toBe('quit');
  });

  it('GDD-UI-02 results menu: pick picks the chosen row', () => {
    for (const item of ['next', 'retry', 'quit'] as const) {
      const r = frame(at(item), ['pick']);
      expect(r.pick, item).toBe(item);
      expect(r.quit).toBe(false);
    }
  });

  it('GDD-UI-02 results menu: a tap picks its row at once, whichever is chosen', () => {
    expect(frame(at('next'), [tap({ results: 'quit' })]).pick).toBe('quit');
    expect(frame(at('next'), [tap({ results: 'retry' })]).pick).toBe('retry');
    expect(frame(at('quit'), [tap({ results: 'next' })]).pick).toBe('next');
  });

  it('GDD-UI-02 results menu: a tap on the greyed Next level does nothing, nor one off the rows', () => {
    const greyed = frame(at('retry'), [tap({ results: 'next' })], false);
    expect(greyed.pick).toBeNull();
    expect(greyed.menu).toEqual(at('retry'));
    expect(greyed.pause).toEqual(PLAYING);
    const off = frame(at('retry'), [TAP_OFF]);
    expect(off.pick).toBeNull();
    expect(off.menu).toEqual(at('retry'));
    expect(off.pause).toEqual(PLAYING);
  });

  it('GDD-UI-02 results menu: Left and Right do nothing', () => {
    for (const e of ['menuLeft', 'menuRight'] as const) {
      const r = frame(at('retry'), [e]);
      expect(r).toMatchObject({ menu: at('retry'), pick: null, quit: false, pause: PLAYING });
    }
  });

  it('GDD-UI-02 results menu: the presses of one frame count in order', () => {
    expect(frame(at('next'), ['menuDown', 'menuDown', 'pick']).pick).toBe('quit');
    // Nothing after a pick counts.
    const r = frame(at('next'), ['pick', 'menuDown']);
    expect(r.pick).toBe('next');
    expect(r.menu).toEqual(at('next'));
    expect(frame(at('next'), ['pick', 'key']).pause).toEqual(PLAYING);
  });

  it('GDD-UI-02 results menu: Escape pauses, picks nothing, and resume keeps the choice', () => {
    const paused = frame(at('next'), ['menuDown', 'key']);
    expect(paused).toMatchObject({ pick: null, quit: false, menu: at('retry') });
    expect(paused.pause.paused).toBe(true);
    const resumed = frame(paused.menu, ['key'], true, paused.pause);
    expect(resumed.pause.paused).toBe(false);
    expect(resumed.menu).toEqual(at('retry'));
    expect(frame(resumed.menu, ['pick'], true, resumed.pause).pick).toBe('retry');
  });

  it('GDD-UI-02 results menu: while paused the menu keys go to the pause menu', () => {
    const r = frame(at('next'), ['menuDown', 'menuDown', 'pick'], true, PAUSED);
    expect(r.quit).toBe(true);
    expect(r.pick).toBeNull();
    expect(r.menu).toEqual(at('next'));
    // Resume is the pause menu's first row: a pick resumes, and picks nothing here.
    const resumed = frame(at('quit'), ['pick'], true, PAUSED);
    expect(resumed).toMatchObject({ pick: null, quit: false, menu: at('quit') });
    expect(resumed.pause.paused).toBe(false);
    // A tap on a results row while paused resumes, as a tap anywhere does, and picks nothing.
    const tapped = frame(at('next'), [tap({ results: 'quit' })], true, PAUSED);
    expect(tapped.pick).toBeNull();
    expect(tapped.pause.paused).toBe(false);
  });

  it('GDD-UI-02 results menu: blur and portrait pause', () => {
    const blurred = frame(at('retry'), ['blur']);
    expect(blurred.pause.paused).toBe(true);
    expect(blurred.pause.portrait).toBe(false);
    const upright = frame(at('retry'), ['portrait']);
    expect(upright.pause).toMatchObject({ paused: true, portrait: true });
    expect(upright.portrait).toBe(true);
    // Upright, a pick picks nothing.
    const stuck = frame(at('retry'), ['pick'], true, upright.pause);
    expect(stuck.pick).toBeNull();
    expect(stuck.quit).toBe(false);
    expect(stuck.pause).toEqual(upright.pause);
  });

  it('GDD-UI-02 results menu: the gamepad start pauses', () => {
    const r = frame(at('retry'), ['start']);
    expect(r.pause.paused).toBe(true);
    expect(r.pick).toBeNull();
  });

  it('GDD-UI-02 results menu: after a pick the frame only tracks the orientation', () => {
    expect(frame(at('next'), ['pick', 'portrait'])).toMatchObject({ pick: 'next', portrait: true });
    expect(frame(at('next'), ['pick', 'portrait', 'landscape'])).toMatchObject({ pick: 'next', portrait: false });
    expect(frame(at('next'), ['pick'])).toMatchObject({ pick: 'next', portrait: false });
    // The same after the pause menu's Quit to title.
    expect(frame(at('next'), ['menuDown', 'menuDown', 'pick'], true, PAUSED)).toMatchObject({ quit: true, portrait: false });
    expect(frame(at('next'), ['menuDown', 'menuDown', 'pick', 'portrait'], true, PAUSED)).toMatchObject({ quit: true, portrait: true });
  });
});

describe('GDD-UI-02 best time and new bests', () => {
  const en = { best: 'Best', newBest: 'New best!' };
  const de = { best: 'Bestzeit', newBest: 'Neuer Rekord!' };

  it('GDD-UI-02 bestTimeSuffix is empty for a level cleared the first time', () => {
    expect(bestTimeSuffix(8040, null, en)).toBe('');
  });

  it('GDD-UI-02 bestTimeSuffix says New best! for a shorter time', () => {
    expect(bestTimeSuffix(7000, 8040, en)).toBe('New best!');
    expect(bestTimeSuffix(8039, 8040, en)).toBe('New best!');
    expect(bestTimeSuffix(7000, 8040, de)).toBe('Neuer Rekord!');
  });

  it('GDD-UI-02 bestTimeSuffix shows the saved best otherwise, an equal time included', () => {
    expect(bestTimeSuffix(9000, 8040, en)).toBe('Best 2:14'); // 8040 steps = 134 s
    expect(bestTimeSuffix(8040, 8040, en)).toBe('Best 2:14');
    expect(bestTimeSuffix(9000, 8040, de)).toBe('Bestzeit 2:14');
    expect(bestTimeSuffix(9000, 59, en)).toBe('Best 0:00');
    expect(bestTimeSuffix(7_000_000, 6000 * 60, en)).toBe('Best 99:59');
  });

  it('GDD-UI-02 medalSuffix is New best! only for a better medal than a saved one', () => {
    expect(medalSuffix('gold', null, 'New best!')).toBe('');
    expect(medalSuffix('gold', 'silver', 'New best!')).toBe('New best!');
    expect(medalSuffix('silver', 'bronze', 'Neuer Rekord!')).toBe('Neuer Rekord!');
    expect(medalSuffix('gold', 'bronze', 'New best!')).toBe('New best!');
    expect(medalSuffix('silver', 'silver', 'New best!')).toBe('');
    expect(medalSuffix('bronze', 'gold', 'New best!')).toBe('');
    expect(medalSuffix('silver', 'gold', 'New best!')).toBe('');
    expect(medalSuffix('bronze', 'silver', 'New best!')).toBe('');
  });

  it('GDD-WLD-04 a saved hilo is drawn at 35 percent opacity', () => {
    expect(HILO.savedAlpha).toBe(0.35);
  });
});
