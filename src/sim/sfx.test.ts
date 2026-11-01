import { describe, expect, it } from 'vitest';
import { loseLife } from './lives';
import { spawn, type Abilities, type PlayerInput, type PlayerState } from './movement';
import type { MovingBlock } from './block';
import { resumeRun, startRun, stepRun, type Level, type RunState } from './run';
import { NO_COMBO, noteRate, stepHiloCombo, stepSounds, type HiloCombo, type Sfx, type SfxName } from './sfx';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };
const claw: PlayerInput = { move: 0, jumpHeld: false, claw: true };

const base = { ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] } as const;

// A flat floor, top at y = 64 (row 4), 40 tiles wide.
const flatWorld = parseTiles([...Array.from({ length: 4 }, () => '.'.repeat(40)), '#'.repeat(40), '#'.repeat(40)]);
const flat: Level = { ...base, world: flatWorld, spawn: { x: 24, y: 64 } };
// Floor on the left (x < 80), a 3-tile pit (x 80 to 128), floor on the right. Floor top y = 64.
const pitWorld = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
const pit: Level = { ...base, world: pitWorld, spawn: { x: 24, y: 64 } };

interface Beat {
  readonly after: RunState;
  readonly sounds: Sfx[];
  readonly names: SfxName[];
}

/** Plays on, returning what each step asked for. The hilo combo is threaded through. */
function play(level: Level, r: RunState, steps: number, input: (i: number) => PlayerInput = () => idle, combo: HiloCombo = NO_COMBO): Beat[] {
  const beats: Beat[] = [];
  for (let i = 0; i < steps; i++) {
    const after = stepRun(r, input(i), level);
    const out = stepSounds(r, after, combo);
    combo = out.combo;
    beats.push({ after, sounds: out.sounds, names: out.sounds.map((s) => s.name) });
    r = after;
  }
  return beats;
}
/** The names of the sounds one step asks for. */
const soundsOf = (before: RunState, input: PlayerInput, level: Level, combo: HiloCombo = NO_COMBO): SfxName[] => play(level, before, 1, () => input, combo)[0]!.names;
const withPlayer = (level: Level, player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const airborne = (x: number, y: number, vy: number): PlayerState => ({ ...spawn(x, y), grounded: false, vy });
/** Beside the left wall of the level, high in the air, falling. */
const wall = (abilities: Abilities = {}): [Level, RunState] => {
  const level: Level = { ...flat, abilities };
  return [level, withPlayer(level, airborne(6, 30, 100))];
};
// Ground at row 8 (top y = 128). A platform in row 5, columns 4 to 8 (x 64 to 144, top y = 80) with an enemy on it.
const stomping = (enemies: Level['enemies'], player: PlayerState): [Level, RunState] => {
  const world = parseTiles(Array.from({ length: 10 }, (_, r) => (r === 5 ? '....#####...........' : r >= 8 ? '#'.repeat(20) : '.'.repeat(20))));
  const level: Level = { ...base, world, spawn: { x: 24, y: 128 }, enemies };
  return [level, withPlayer(level, player)];
};
/** Plays on from `r` into the pit, to the step a life is lost. */
const fallen = (r: RunState = startRun(pit)): RunState => {
  for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, pit);
  return r;
};
/** The index of the first beat whose names include `name`, or -1. */
const firstWith = (beats: Beat[], name: SfxName): number => beats.findIndex((b) => b.names.includes(name));
const count = (beats: Beat[], name: SfxName): number => beats.filter((b) => b.names.includes(name)).length;

describe('GDD-AUD-02 sound triggers', () => {
  it('a jump from the ground plays jump', () => {
    const start = startRun(flat);
    expect(soundsOf(start, jump, flat)).toEqual(['jump']);
    // Holding the button on does not jump again, and the rise itself is silent.
    const beats = play(flat, start, 12, () => jump);
    expect(beats.map((b) => b.names)).toEqual([['jump'], ...Array.from({ length: 11 }, () => [])]);
  });

  it('a jump in coyote time plays jump', () => {
    const beats = play(pit, startRun(pit), 60, () => right);
    const off = beats.findIndex((b) => !b.after.player.grounded);
    expect(off).toBeGreaterThan(0);
    expect(beats.slice(0, off + 1).every((b) => b.names.length === 0)).toBe(true);
    const press = play(pit, beats[off]!.after, 1, () => ({ move: 1, jumpHeld: true }))[0]!;
    expect(press.names).toEqual(['jump']);
    expect(beats[off]!.after.player.grounded).toBe(false);
    expect(press.after.player.vy).toBeLessThan(0);
  });

  it('a buffered jump plays jump on the takeoff step, not on the press', () => {
    const beats = play(flat, withPlayer(flat, airborne(24, 56, 150)), 14, () => jump);
    expect(beats[0]!.names).toEqual([]);
    const takeoff = firstWith(beats, 'jump');
    expect(takeoff).toBeGreaterThan(0);
    expect(count(beats, 'jump')).toBe(1);
    // The step before is the touchdown; the takeoff is the first step on the ground.
    expect(beats[takeoff - 1]!.names).toEqual(['land']);
    expect(beats[takeoff - 1]!.after.player.grounded).toBe(true);
    expect(beats[takeoff]!.after.player.vy).toBeLessThan(0);
  });

  it('a wall kick plays jump', () => {
    const [level, start] = wall({ wallCling: true });
    expect(soundsOf(start, { move: -1, jumpHeld: true }, level)).toEqual(['jump']);
    expect(stepRun(start, { move: -1, jumpHeld: true }, level).player.vx).toBeGreaterThan(0);
    // The sound follows the kick: without the ability the same press kicks nothing and is silent.
    const [bare, bareStart] = wall();
    expect(soundsOf(bareStart, { move: -1, jumpHeld: true }, bare)).toEqual([]);
  });

  it('a spring launch does not play jump or land', () => {
    // A floor at row 8 (top y = 128) with a spring set into it at column 3 (x 48 to 64).
    const springWorld = parseTiles([...Array.from({ length: 8 }, () => '.'.repeat(10)), '###.######']);
    const level: Level = { ...base, world: springWorld, spawn: { x: 24, y: 128 }, springs: [{ col: 3, row: 8 }] };
    // Dropped from 48 px up, so he lands on it at the 360 px/s terminal speed.
    const beats = play(level, withPlayer(level, airborne(56, 80, 0)), 60);
    const launch = beats.findIndex((b) => b.after.player.vy === -480);
    expect(launch).toBeGreaterThan(3);
    expect(beats.slice(0, launch + 1).map((b) => b.names)).toEqual(Array.from({ length: launch + 1 }, () => []));
  });

  it('a stomp plays stomp, not jump or land', () => {
    const [level, start] = stomping([{ x: 104, y: 80 }], airborne(104, 62, 150));
    const beats = play(level, start, 12);
    const stomp = beats.findIndex((b) => !b.after.enemies[0]!.alive);
    expect(stomp).toBeGreaterThan(0);
    expect(beats[stomp]!.names).toEqual(['stomp']);
    expect(beats[stomp]!.after.player.vy).toBe(-260);
    expect(beats.slice(0, stomp).every((b) => b.names.length === 0)).toBe(true);
  });

  it('two enemies stomped in one step play stomp once', () => {
    const [level, start] = stomping([{ x: 104, y: 80 }, { x: 106, y: 80 }], airborne(105, 62, 150));
    const beats = play(level, start, 12);
    const stomp = beats.findIndex((b) => b.after.enemies.every((e) => !e.alive));
    expect(stomp).toBeGreaterThan(0);
    expect(beats[stomp]!.names).toEqual(['stomp']);
    expect(count(beats, 'stomp')).toBe(1);
  });

  it("a Tlacuache's first stomp plays stomp (it plays dead)", () => {
    const [level, start] = stomping([{ x: 104, y: 80, kind: 'tlacuache' }], airborne(104, 62, 150));
    const beats = play(level, start, 12);
    const stomp = firstWith(beats, 'stomp');
    expect(stomp).toBeGreaterThan(0);
    expect(beats[stomp]!.names).toEqual(['stomp']);
    expect(beats[stomp]!.after.enemies[0]).toMatchObject({ alive: true, gait: { phase: 'dead' } });
  });

  it('a stomp on the step a life is lost still plays stomp, after lifeLost', () => {
    // Landing on the Alacrán while touching a cactus buddy beside it (12 px wide, 16 tall, x 108 to 120): a hit in Base.
    const [level, start] = stomping([{ x: 104, y: 80 }, { x: 114, y: 80, kind: 'cactus' }], airborne(104, 69, 150));
    const [beat] = play(level, start, 1);
    expect(beat!.after.phase).toBe('respawning');
    expect(beat!.after.enemies[0]!.alive).toBe(false);
    expect(beat!.names).toEqual(['lifeLost', 'stomp']);
    // The same falling into a pit: an Alacrán below the level's bottom edge (y = 160), stomped as he drops past it.
    const [deep, below] = stomping([{ x: 104, y: 200 }], airborne(104, 192, 300)); // his 32 px body just clear of the floor above (it ends at y = 160)
    const [pitBeat] = play(deep, below, 1);
    expect(pitBeat!.after.phase).toBe('respawning');
    expect(pitBeat!.names).toEqual(['lifeLost', 'stomp']);
  });

  it('the stomp mark is for the step it landed on only', () => {
    // A mark left over from a step in play does not carry through the wait, the respawn or the screen after the last life.
    const marked = { ...startRun(pit), stomped: true };
    const lastLife = { ...marked, lives: { ...marked.lives, lives: 0 } };
    const steps = {
      'waiting to respawn': stepRun({ ...marked, phase: 'respawning', wait: 30 }, idle, pit),
      'respawning': stepRun({ ...marked, phase: 'respawning', wait: 1 }, idle, pit),
      'ending the wait after the last life': stepRun({ ...lastLife, phase: 'respawning', wait: 1 }, idle, pit),
      'on the screen after the last life': stepRun({ ...lastLife, phase: 'gameover', wait: 5 }, idle, pit),
      'restarting from the screen': stepRun({ ...lastLife, phase: 'gameover', wait: 80 }, jump, pit),
      'on the level clear screen': stepRun({ ...marked, phase: 'clear', wait: 5 }, idle, pit),
      'ending the level clear screen': stepRun({ ...marked, phase: 'clear', wait: 80 }, jump, pit),
    };
    for (const [where, after] of Object.entries(steps)) expect(after.stomped, where).toBe(false);
  });

  it('landing from a fall at 60 px/s or faster plays land', () => {
    // Half a pixel above the floor (y = 64), so this step touches down.
    const fast = withPlayer(flat, airborne(24, 63.5, 60));
    expect(soundsOf(fast, idle, flat)).toEqual(['land']);
    expect(stepRun(fast, idle, flat).player.grounded).toBe(true);
  });

  it('landing slower than 60 px/s is silent', () => {
    const slow = withPlayer(flat, airborne(24, 63.5, 59.9));
    expect(stepRun(slow, idle, flat).player.grounded).toBe(true);
    expect(soundsOf(slow, idle, flat)).toEqual([]);
  });

  it('walking along the ground plays nothing', () => {
    const beats = play(flat, startRun(flat), 10, () => right);
    expect(beats.map((b) => b.names)).toEqual(Array.from({ length: 10 }, () => []));
    expect(beats[9]!.after.player.x).toBeGreaterThan(24);
  });

  it('a landing that loses a life plays lifeLost, not land', () => {
    // A spike in column 8, row 3 (its lower half is y 56 to 64); he comes down onto the floor beside it, on it.
    const spiked: Level = { ...flat, spikes: [{ col: 8, row: 3 }] };
    const start = withPlayer(spiked, airborne(136, 63.5, 100));
    expect(stepRun(start, idle, spiked).player.grounded).toBe(true);
    expect(soundsOf(start, idle, spiked)).toEqual(['lifeLost']);
  });

  it('a claw swing start plays claw; a press during the swing or its cooldown is silent', () => {
    const beats = play(flat, startRun(flat), 30, (i) => ({ move: 0, jumpHeld: false, claw: i % 2 === 0 }));
    expect(beats[0]!.names).toEqual(['claw']);
    // The wind-up lasts two steps and the swing three, but the cooldown is 15 steps: presses on steps 2, 4, ... are ignored.
    expect(count(beats.slice(0, 15), 'claw')).toBe(1);
    expect(beats.slice(1, 15).every((b) => b.names.length === 0)).toBe(true);
    // Once the cooldown is over the next press swings again.
    expect(beats[16]!.names).toEqual(['claw']);
    // Holding the button never swings again.
    expect(count(play(flat, startRun(flat), 40, () => claw), 'claw')).toBe(1);
  });

  it('a hit in Base plays lifeLost', () => {
    const spiked: Level = { ...flat, spikes: [{ col: 8, row: 3 }] };
    const start = withPlayer(spiked, spawn(136, 64));
    expect(soundsOf(start, idle, spiked)).toEqual(['lifeLost']);
  });

  it('a fall into a pit plays lifeLost', () => {
    const beats = play(pit, startRun(pit), 200, () => right);
    const lost = beats.findIndex((b) => b.after.phase === 'respawning');
    expect(lost).toBeGreaterThan(0);
    expect(beats[lost]!.names).toEqual(['lifeLost']);
    // Nothing on the way to the pit, nor in the wait that follows it.
    expect(beats.slice(0, lost).every((b) => b.names.length === 0)).toBe(true);
    expect(count(beats.slice(lost, lost + 28), 'lifeLost')).toBe(1);
  });

  // A floor at row 12 (top y = 192); a block coming down onto Poncho standing at x = 108 crushes him after about 66 steps.
  const crushWorld = parseTiles(Array.from({ length: 13 }, (_, r) => (r === 12 ? '#'.repeat(20) : '.'.repeat(20))));
  const dropper: MovingBlock = { x0: 100, y0: 100, x1: 100, y1: 176, w: 16, h: 16 };
  const crusher = (more: Partial<Level> = {}): Level => ({ ...base, world: crushWorld, spawn: { x: 16, y: 192 }, blocks: [dropper], ...more });

  it('a crush plays lifeLost', () => {
    const level = crusher();
    const beats = play(level, withPlayer(level, spawn(108, 192)), 130);
    const lost = beats.findIndex((b) => b.after.phase === 'respawning');
    expect(lost).toBeGreaterThan(60);
    expect(beats[lost]!.names).toEqual(['lifeLost']);
    expect(count(beats, 'lifeLost')).toBe(1);
  });

  it('hilos collected on the step a life is lost still play', () => {
    // From tick 66 the block is already beside his head: the first step crushes him and pushes his body onto the hilo in
    // tile (7, 11), so the crush step is the step he touches it.
    const level = crusher({ hilos: [{ col: 7, row: 11 }] });
    const start = withPlayer(level, spawn(108, 192), { platformTick: 66 });
    const [first] = play(level, start, 1);
    expect(first!.after.phase).toBe('respawning');
    expect(first!.sounds).toEqual([{ name: 'lifeLost' }, { name: 'hilo', semitones: 0 }]);
  });

  it('a hit absorbed in Taco does not play lifeLost', () => {
    const spiked: Level = { ...flat, spikes: [{ col: 8, row: 3 }] };
    const start = withPlayer(spiked, spawn(136, 64), { power: 'taco' });
    const after = stepRun(start, idle, spiked);
    expect(after).toMatchObject({ phase: 'playing', power: 'base' });
    expect(soundsOf(start, idle, spiked)).toEqual([]);
  });

  it('the meow plays on the first step of the respawn flip', () => {
    const beats = play(pit, fallen(), 48);
    const meow = firstWith(beats, 'meow');
    expect(meow).toBeGreaterThanOrEqual(0);
    expect(beats[meow]!.after.wait).toBe(21); // the flip is the last 0.35 s (21 steps) of the 0.8 s wait
    expect(beats[meow]!.after.phase).toBe('respawning');
    expect(beats[meow]!.names).toEqual(['meow']);
    expect(count(beats, 'meow')).toBe(1);
    // Control returns on the last step, silently.
    expect(beats[47]!.after.phase).toBe('playing');
    expect(beats[47]!.names).toEqual([]);
  });

  it('a skip before the flip plays the meow at the respawn', () => {
    // Any button after 0.3 s (step 18 of the wait) ends the wait; the flip would not have started yet (it starts on step 28).
    const beats = play(pit, fallen(), 18, (i) => (i === 17 ? jump : idle));
    expect(beats[17]!.after.phase).toBe('playing');
    expect(beats[17]!.names).toEqual(['meow']);
    expect(count(beats, 'meow')).toBe(1);
    // A skip during the flip has had its meow already: one sound over the whole wait.
    const late = play(pit, fallen(), 40, (i) => (i === 35 ? jump : idle));
    expect(late[35]!.after.phase).toBe('playing');
    expect(count(late, 'meow')).toBe(1);
    expect(late[35]!.names).toEqual([]);
  });

  it('no meow after the last life until the restart flips him in', () => {
    let r = startRun(pit);
    for (let i = 0; i < 6; i++) r = { ...r, lives: loseLife(r.lives) };
    r = fallen(r);
    expect(r.lives.lives).toBe(0);
    // The wait after the last life, then the screen up for its first second.
    const wait = play(pit, r, 48);
    expect(wait[47]!.after.phase).toBe('gameover');
    expect(count(wait, 'meow')).toBe(0);
    const screen = play(pit, wait[47]!.after, 60);
    expect(screen[59]!.after.wait).toBe(60);
    expect(count(screen, 'meow')).toBe(0);
    // The first press the screen takes restarts the world and flips him in.
    const restart = play(pit, screen[59]!.after, 1, () => jump)[0]!;
    expect(restart.after).toMatchObject({ phase: 'respawning', restarting: true, wait: 21 });
    expect(restart.names).toEqual(['meow']);
    // The flip runs on to the end of control returning, without a second meow.
    const rest = play(pit, restart.after, 25);
    expect(rest[rest.length - 1]!.after.phase).toBe('playing');
    expect(count(rest, 'meow')).toBe(0);
  });

  it('sounds only while in play', () => {
    // Every button held through the whole wait: nothing but the meow, and no landing sound when control returns (his last
    // state in the pit was a fall at speed).
    const all: PlayerInput = { move: 1, jumpHeld: true, claw: true, fuego: true };
    const lost = fallen();
    expect(lost.player.vy).toBeGreaterThan(60);
    expect(lost.player.grounded).toBe(false);
    const wait = play(pit, lost, 48, (i) => (i < 17 ? idle : all));
    expect(wait.find((b) => b.after.phase === 'playing')).toBeDefined();
    expect(wait.flatMap((b) => b.names)).toEqual(['meow']);
    // The same on the screen after the last life, held down since before it came up so nothing restarts it.
    let r = startRun(pit);
    for (let i = 0; i < 6; i++) r = { ...r, lives: loseLife(r.lives) };
    const screen = play(pit, fallen(r), 48 + 40, () => all);
    expect(screen[88 - 1]!.after.phase).toBe('gameover');
    expect(screen.flatMap((b) => b.names)).toEqual([]);
  });
});

/** Steps the combo once per entry of `collected`, returning the semitones of each (null for no note). */
const runCombo = (collected: number[], combo: HiloCombo = NO_COMBO) => {
  const out: (number | null)[] = [];
  for (const c of collected) {
    const r = stepHiloCombo(combo, c);
    combo = r.combo;
    out.push(r.semitones);
  }
  return { out, combo };
};
/** One hilo, then `gap` steps with none. */
const spaced = (n: number, gap: number): number[] => Array.from({ length: n * (gap + 1) }, (_, i) => (i % (gap + 1) === 0 ? 1 : 0));

describe('GDD-AUD-02 hilo combo', () => {
  it('the first hilo plays the root', () => {
    expect(stepHiloCombo(NO_COMBO, 1).semitones).toBe(0);
    expect(stepHiloCombo(NO_COMBO, 0).semitones).toBeNull();
  });

  it('each hilo within 0.75 s climbs the major scale', () => {
    const notes = runCombo(spaced(8, 9)).out.filter((s) => s !== null);
    expect(notes).toEqual([0, 2, 4, 5, 7, 9, 11, 12]);
  });

  it('it stays on the octave', () => {
    const notes = runCombo(spaced(10, 9)).out.filter((s) => s !== null);
    expect(notes.slice(8)).toEqual([12, 12]);
  });

  it('a hilo exactly 0.75 s (45 steps) after the previous still climbs; 46 steps starts again', () => {
    const first = runCombo([1]).combo;
    expect(runCombo([...Array.from({ length: 44 }, () => 0), 1], first).out.at(-1)).toBe(2);
    expect(runCombo([...Array.from({ length: 45 }, () => 0), 1], first).out.at(-1)).toBe(0);
  });

  it('two hilos in one step move on by two and play once', () => {
    const r = runCombo([2]);
    expect(r.out).toEqual([2]);
    expect(r.combo.degree).toBe(1);
    expect(runCombo([1], r.combo).out).toEqual([4]);
    // Climbing too: the root, then two at once, is the third note (degree 2).
    expect(runCombo([1, 2]).out).toEqual([0, 4]);
  });

  it('three hilos at once at the start play the third note', () => {
    const r = runCombo([3]);
    expect(r.out).toEqual([4]);
    expect(r.combo.degree).toBe(2);
  });

  it('hilos picked up one after another play rising notes', () => {
    // Three hilos one tile apart along the floor (rows 3, columns 4 to 6): running through takes about 8 steps for each.
    const level: Level = { ...flat, hilos: [{ col: 4, row: 3 }, { col: 5, row: 3 }, { col: 6, row: 3 }] };
    const beats = play(level, startRun(level), 60, () => right);
    const notes = beats.flatMap((b) => b.sounds).filter((s) => s.name === 'hilo');
    expect(notes).toEqual([{ name: 'hilo', semitones: 0 }, { name: 'hilo', semitones: 2 }, { name: 'hilo', semitones: 4 }]);
  });
});

describe('GDD-AUD-02 hilo note rate', () => {
  it('plays a note faster by the equal-tempered ratio of its semitones', () => {
    expect(noteRate(0)).toBe(1);
    expect(noteRate(2)).toBeCloseTo(1.122462, 6);
    expect(noteRate(7)).toBeCloseTo(1.498307, 6);
    expect(noteRate(12)).toBe(2);
  });
});

/** The steps that played a tick. */
const ticks = (beats: Beat[]) => beats.filter((b) => b.names.includes('tick'));

describe('GDD-AUD-02 tick', () => {
  // The exit stands 10 px from Poncho's middle, so the first step reaches it.
  const exitLevel: Level = { ...flat, exit: { x: 40, y: 64 } };
  const atExit = (): RunState => withPlayer(exitLevel, { ...spawn(30, 64), grounded: true });

  it('GDD-AUD-02 a tick as each clear screen line appears', () => {
    const beats = play(exitLevel, atExit(), 101);
    expect(beats[0]!.after.phase).toBe('clear');
    // Not on the step that reaches the exit.
    expect(beats[0]!.names).toEqual([]);
    expect(ticks(beats).map((b) => b.after.wait)).toEqual([15, 30, 45]);
    for (const b of ticks(beats)) expect(b.names).toEqual(['tick']);
  });

  it('GDD-AUD-02 a skip plays one tick', () => {
    // A press on the screen's 3rd step shows all three lines at once: one tick, and none after.
    const early = play(exitLevel, atExit(), 101, (i) => (i === 3 ? jump : idle));
    expect(early[3]!.after.wait).toBe(3);
    expect(early[3]!.names).toEqual(['tick']);
    expect(ticks(early)).toHaveLength(1);
    // A press on the 20th, with the hilo line already shown: one tick for the skip, two in all.
    const later = play(exitLevel, atExit(), 101, (i) => (i === 20 ? jump : idle));
    expect(later[20]!.after.wait).toBe(20);
    expect(ticks(later).map((b) => b.after.wait)).toEqual([15, 20]);
    expect(later[20]!.names).toEqual(['tick']);
  });

  it('GDD-AUD-02 no tick on the Siete vidas gastadas screen', () => {
    let r = startRun(pit);
    for (let i = 0; i < 6; i++) r = { ...r, lives: loseLife(r.lives) };
    const beats = play(pit, fallen(r), 48 + 100);
    expect(beats[beats.length - 1]!.after.phase).toBe('gameover');
    expect(beats[beats.length - 1]!.after.wait).toBeGreaterThan(50);
    expect(count(beats, 'tick')).toBe(0);
  });
});

describe('GDD-PRG-02 the resumed flip', () => {
  const resumable: Level = { ...pit, ofrendas: [{ id: 'a', x: 56, y: 64 }] };
  const saved = { level: '0-1', checkpoint: 0, lives: 4, used: ['ofrenda:a'], hilos: [], clock: 100 };

  it('GDD-PRG-02 the resumed flip plays the meow once, on its first step, and nothing else', () => {
    const beats = play(resumable, resumeRun(resumable, saved), 40);
    expect(beats[0]!.names).toEqual(['meow']);
    expect(beats[0]!.after.phase).toBe('respawning');
    expect(count(beats, 'meow')).toBe(1);
    expect(beats.slice(1).every((b) => b.names.length === 0)).toBe(true);
    expect(beats[39]!.after.phase).toBe('playing');
  });
});
