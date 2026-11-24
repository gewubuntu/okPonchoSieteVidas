import { describe, expect, it } from 'vitest';
import { FLIP, GAME_OVER, TILE } from '../config/tuning';
import { LEVEL_0_1 } from '../levels/level0-1';
import { LEVEL_3_3 } from '../levels/level3-3';
import type { PlayerInput } from './movement';
import { resumeHeld } from './pause';
import { codeInput, inputCode, readRecord, replay, RunRecorder, writeRecord, type RecordEntry, type RecordHeader, type RunRecord } from './replay';
import { restartRun, resumeRun, startRun, stepRun, type Level, type Point, type RunState } from './run';
import type { SavedRun } from './save';
import { stateHash } from './stateHash';
import { parseTiles } from './tilemap';

const still: PlayerInput = { move: 0, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };
/** The scene's input with nothing down: every field set. */
const idle: PlayerInput = { left: false, right: false, move: 0, jumpHeld: false, claw: false, fuego: false };
const running: PlayerInput = { left: false, right: true, move: 1, jumpHeld: false, claw: false, fuego: false };

/** 0-1's hilos: 50, the first and the third saved. */
const SAVED = Array.from({ length: LEVEL_0_1.hilos!.length }, (_, i) => i === 0 || i === 2);
const savedText = SAVED.map((h) => (h ? '1' : '0')).join('');
const header = (over: Partial<RecordHeader> = {}): RecordHeader => ({ format: 1, sim: 'test', level: '0-1', seed: 0, token: null, start: 'start', lives: 7, hilos: '0'.repeat(SAVED.length), abilities: {}, resume: null, ...over });
const steps = (input: PlayerInput, n: number): RecordEntry[] => Array.from({ length: n }, () => ({ input }));
const record = (entries: readonly RecordEntry[], over: Partial<RecordHeader> = {}): RunRecord => ({ header: header(over), entries });
/** The state after each step of the record: the end of its replay cut after each step entry. */
const statesOf = (r: RunRecord, level: Level): RunState[] =>
  r.entries.flatMap((e, i) => (e.held ? [] : [replay({ header: r.header, entries: r.entries.slice(0, i + 1) }, level).end]));
const jumpIdle: PlayerInput = { ...idle, jumpHeld: true };
const jumpRunning: PlayerInput = { ...running, jumpHeld: true };
/** The `inputs` field of the record's text. */
function inputsOf(entries: readonly RecordEntry[]): unknown {
  const data: unknown = JSON.parse(writeRecord(record(entries)));
  return typeof data === 'object' && data !== null ? (data as { inputs?: unknown }).inputs : undefined;
}
/** `readRecord` with a limit no record of these tests reaches. */
const read = (t: string): RunRecord | null => readRecord(t, 1000);
/** A record's text: the default header with `over` written over it, and `inputs`. */
const text = (inputs: unknown, over: Record<string, unknown> = {}): string => JSON.stringify({ ...header(), inputs, ...over });
const resumed: Omit<SavedRun, 'level'> = { checkpoint: 1, lives: 5, livesIn: 6, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'], hilos: SAVED.map((_, i) => i === 1), clock: 600 };
/** How many held marks a recorder keeps for one `held(input)`. */
function marks(input: PlayerInput): number {
  const recorder = new RunRecorder(header());
  recorder.held(input);
  return recorder.record()!.entries.length;
}
const end = (over: Partial<RecordHeader>): RunState => replay(record([], over), LEVEL_0_1).end;
const glides = (abilities: RecordHeader['abilities']): boolean => statesOf(record(steps(jump, 60), { abilities }), LEVEL_0_1).some((s) => s.player.gliding === true);
function freeze<T>(value: T, seen = new Set<unknown>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const v of value instanceof Set ? [...(value as Set<unknown>)] : Object.values(value)) freeze(v, seen);
  return Object.freeze(value);
}
/** Every field of the input in turn, jump let go between presses (L-048). */
const scripted = (i: number): PlayerInput => ({
  move: i % 200 < 150 ? 1 : i % 200 < 170 ? -1 : 0,
  jumpHeld: i % 30 < 12,
  claw: i % 45 < 3,
  fuego: i % 50 < 2,
  left: i % 200 >= 150 && i % 200 < 170,
  right: i % 200 < 150,
});

describe('GDD-TEC-09 record and replay', () => {
  it('GDD-TEC-09 inputCode', () => {
    expect(inputCode({ move: 0, jumpHeld: false })).toBe('0');
    expect(inputCode({ move: 1, jumpHeld: true })).toBe('201');
    expect(inputCode({ move: -1, jumpHeld: false })).toBe('400');
    expect(inputCode(idle)).toBe('aa');
    expect(inputCode(running)).toBe('32a');
    expect(inputCode({ move: 0.5, jumpHeld: false })).toBe('600:3fe0000000000000');
    expect(inputCode({ move: -0, jumpHeld: false })).toBe('600:8000000000000000');
    // Each field alone: jump bit 0; claw bits 1-2, Fuego 3-4, left 5-6, right 7-8, each 1 for false and 2 for true.
    expect(inputCode({ move: 0, jumpHeld: true })).toBe('1');
    expect(inputCode({ ...still, claw: false })).toBe('2');
    expect(inputCode({ ...still, claw: true })).toBe('4');
    expect(inputCode({ ...still, fuego: false })).toBe('8');
    expect(inputCode({ ...still, fuego: true })).toBe('10');
    expect(inputCode({ ...still, left: false })).toBe('20');
    expect(inputCode({ ...still, left: true })).toBe('40');
    expect(inputCode({ ...still, right: false })).toBe('80');
    expect(inputCode({ ...still, right: true })).toBe('100');
    // A move next to 1 and -1, but not either, keeps its bits; so does a NaN, as the one NaN.
    expect(inputCode({ move: 0.9999999999999999, jumpHeld: false })).toBe('600:3fefffffffffffff');
    expect(inputCode({ move: -0.9999999999999999, jumpHeld: false })).toBe('600:bfefffffffffffff');
    expect(inputCode({ move: Number.NaN, jumpHeld: false })).toBe('600:7ff8000000000000');
  });

  const cases: PlayerInput[] = [
    { move: 0, jumpHeld: false },
    { move: 1, jumpHeld: true },
    { move: -1, jumpHeld: false },
    idle,
    running,
    { move: 0.5, jumpHeld: false },
    { move: -0, jumpHeld: false },
    { move: -0.25, jumpHeld: true, claw: true, fuego: true, left: true, right: true },
    ...(['claw', 'fuego', 'left', 'right'] as const).flatMap((field) => [true, false].map((value) => ({ ...still, [field]: value }))),
  ];

  it('GDD-TEC-09 codeInput gives back exactly the input, a field left out left out', () => {
    expect(cases.length).toBe(16);
    for (const input of cases) expect(codeInput(inputCode(input)), JSON.stringify(input)).toStrictEqual(input);
    expect(Object.is(codeInput('600:8000000000000000')!.move, -0)).toBe(true);
  });

  it('GDD-TEC-09 codeInput refuses what is not a code', () => {
    for (const code of ['', 'xyz', '1000', '600', '200:3fe0000000000000']) expect(codeInput(code), code).toBeNull();
    // Codes inputCode never writes: a field in a fourth state (claw bits 3), bit 11, a leading 0, capitals, the bits for a move of
    // 0, 1 or -1, a NaN other than the one NaN, and bits one digit short or one too many.
    for (const code of ['6', '800', '0aa', 'AA', '600:0000000000000000', '600:3ff0000000000000', '600:fff8000000000000', '600:3fe000000000000', '600:3fe00000000000000', 'aa:', ':', 'aa aa']) {
      expect(codeInput(code), code).toBeNull();
    }
    // The bounds those sit beside: three digits, and 16 digits of bits.
    expect(codeInput('32a')).toStrictEqual(running);
    expect(codeInput('600:3fe0000000000000')).toStrictEqual({ move: 0.5, jumpHeld: false });
  });

  it('GDD-TEC-09 codeInput refuses a move outside -1 to 1', () => {
    // The doubles next to 1 and to -1 on the inside read; the ones next to them on the outside, the infinities and NaN do not.
    expect(codeInput('600:3fefffffffffffff')?.move).toBe(0.9999999999999999);
    expect(codeInput('600:bfefffffffffffff')?.move).toBe(-0.9999999999999999);
    for (const bits of ['3ff0000000000001', 'bff0000000000001', '7ff0000000000000', 'fff0000000000000', '7ff8000000000000']) {
      expect(codeInput(`600:${bits}`), bits).toBeNull();
    }
  });

  it('GDD-TEC-09 readRecord reads nothing under a limit that is no whole number of steps', () => {
    const one = writeRecord(record([{ input: idle }]));
    expect(readRecord(one, 1)).not.toBeNull();
    for (const limit of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY, 2 ** 53]) expect(readRecord(one, limit), String(limit)).toBeNull();
    expect(readRecord(one, Number.MAX_SAFE_INTEGER)).not.toBeNull();
    // A record with no step is within any limit but one that is no limit at all.
    expect(readRecord(writeRecord(record([])), 0)).not.toBeNull();
    expect(readRecord(writeRecord(record([])), -1)).toBeNull();
  });

  it('GDD-TEC-09 writeRecord run-length codes the entries', () => {
    expect(inputCode(jumpIdle)).toBe('ab');
    expect(inputCode(jumpRunning)).toBe('32b');
    expect(inputsOf([...steps(idle, 3), { input: jumpIdle }, { input: jumpRunning, held: true }, ...steps(running, 2)])).toBe('3*aa ab h32b 2*32a');
    expect(inputsOf([])).toBe('');
    // One step is its code alone, two a count; a held mark is never counted and splits the steps around it, even with the same code.
    expect(inputsOf(steps(idle, 1))).toBe('aa');
    expect(inputsOf(steps(idle, 2))).toBe('2*aa');
    expect(inputsOf([{ input: idle }, { input: idle, held: true }, { input: idle }])).toBe('aa haa aa');
    expect(inputsOf([{ input: jump, held: true }, { input: jump, held: true }, ...steps(jump, 2)])).toBe('h1 h1 2*1');
  });

  it('GDD-TEC-09 readRecord gives back the record', () => {
    const full: RunRecord = {
      header: { format: 1, sim: '0123456789abcdef', level: '0-1', seed: 42, token: 'token-1', start: 'resume', lives: 5, hilos: savedText, abilities: { glide: true }, resume: resumed },
      entries: [{ input: running }, { input: running }, { input: jumpIdle, held: true }, { input: { move: -0.5, jumpHeld: true, claw: true } }, { input: still }],
    };
    expect(read(writeRecord(full))).toStrictEqual(full);
    expect(read(writeRecord(record([])))).toStrictEqual(record([]));
  });

  it('GDD-TEC-09 readRecord refuses a malformed text', () => {
    expect(read('{')).toBeNull();
    expect(read(text('aa', { format: 2 }))).toBeNull();
    expect(read(JSON.stringify(header()))).toBeNull();
    expect(read(text('0*aa'))).toBeNull();
    expect(read(text('2*zz'))).toBeNull();
    // A count is a whole number from 1 written in digits; a held mark has none; one space between tokens; no JSON but an object.
    for (const inputs of ['*aa', '01*aa', '2.5*aa', '-1*aa', 'h2*aa', '2*haa', ' aa', 'aa ', 'aa  aa', ' ']) expect(read(text(inputs)), inputs).toBeNull();
    for (const json of ['null', '5', '"aa"', '[]']) expect(read(json), json).toBeNull();
    // Only what `writeRecord` writes is read: no count of 1, no two runs of one code side by side (a held mark between them parts them).
    for (const inputs of ['1*aa', 'aa aa', '2*aa 3*aa', '2*aa aa', 'aa 2*aa']) expect(read(text(inputs)), inputs).toBeNull();
    expect(read(text('2*aa haa 2*aa'))!.entries).toStrictEqual([...steps(idle, 2), { input: idle, held: true }, ...steps(idle, 2)]);
    expect(read(text('haa haa'))!.entries).toStrictEqual([{ input: idle, held: true }, { input: idle, held: true }]);
    expect(read(text(`2*aa 2*${inputCode(jump)} 2*aa`))!.entries).toHaveLength(6);
    // The bounds beside those: a count of 2, one step, and no entries.
    expect(read(text('2*aa'))!.entries).toStrictEqual(steps(idle, 2));
    expect(read(text('aa'))!.entries).toStrictEqual(steps(idle, 1));
    expect(read(text(''))!.entries).toStrictEqual([]);
  });

  it('GDD-TEC-09 readRecord refuses a header field of the wrong type', () => {
    expect(read(text('aa'))!.header).toStrictEqual(header());
    // Each field alone, wrong or left out.
    const wrong: Record<string, unknown[]> = {
      format: [2, '1', undefined],
      sim: [5, null, undefined],
      level: [null, 1, undefined],
      seed: ['0', null, undefined],
      token: [5, false, undefined],
      start: ['begin', null, undefined],
      lives: ['7', null, undefined],
      // 10 and [] read as text are '10' and '', which are digits 0 and 1.
      hilos: ['012', '2', 5, 10, [], undefined],
      abilities: [null, 5, { glide: 'yes' }, { wallCling: 1 }, undefined],
      resume: [5, 'x', [], undefined],
    };
    for (const [field, values] of Object.entries(wrong)) for (const value of values) expect(read(text('aa', { [field]: value })), `${field} ${JSON.stringify(value)}`).toBeNull();
    // Each field of the saved run alone, wrong or left out; and a 'resume' with none.
    const wrongSaved: Record<string, unknown[]> = { checkpoint: ['1', undefined], lives: ['5', undefined], livesIn: ['6', undefined], used: [[1], 'a', undefined], hilos: [[1], '01', undefined], clock: ['600', undefined] };
    expect(read(text('aa', { start: 'resume', resume: resumed }))!.header.resume).toStrictEqual(resumed);
    for (const [field, values] of Object.entries(wrongSaved)) {
      for (const value of values) expect(read(text('aa', { start: 'resume', resume: { ...resumed, [field]: value } })), `${field} ${JSON.stringify(value)}`).toBeNull();
    }
    expect(read(text('aa', { start: 'resume', resume: null }))).toBeNull();
    // A record says one thing about how it began: a 'start' or a 'restart' with a saved run is refused.
    expect(read(text('aa', { start: 'start', resume: resumed }))).toBeNull();
    expect(read(text('aa', { start: 'restart', resume: resumed }))).toBeNull();
    // The bounds beside those: a token, no hilos, each ability alone, a restart, a saved run with nothing used and no hilos.
    for (const over of [{ token: 't' }, { hilos: '' }, { hilos: '01' }, { abilities: { glide: true } }, { abilities: { wallCling: true } }, { seed: Number.MAX_SAFE_INTEGER }, { start: 'restart' as const }]) {
      expect(read(text('aa', over))!.header, JSON.stringify(over)).toStrictEqual(header(over));
    }
    // An ability is added or left out, never turned off; a seed is a whole number from 0 that a number holds exactly.
    for (const abilities of [{ glide: false }, { wallCling: false }, { glide: true, wallCling: false }, [], 'glide', 5, null]) expect(read(text('aa', { abilities })), JSON.stringify(abilities)).toBeNull();
    for (const seed of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) expect(read(text('aa', { seed })), String(seed)).toBeNull();
    expect(read(text('aa').replace('"seed":0', '"seed":1e999'))).toBeNull();
    const bare = { ...resumed, used: [], hilos: [] };
    expect(read(text('aa', { start: 'resume', resume: bare }))!.header.resume).toStrictEqual(bare);
    // A field the header has no place for is not read.
    expect(read(text('aa', { extra: 1, abilities: { glide: true, fly: true } }))!.header).toStrictEqual(header({ abilities: { glide: true } }));
  });

  it('GDD-TEC-09 readRecord refuses more steps than its limit', () => {
    // Exactly the limit reads, one more does not; a held mark is no step; a limit of 0 reads a record of none.
    expect(readRecord(text('3*aa ab'), 4)!.entries.length).toBe(4);
    expect(readRecord(text('3*aa ab'), 3)).toBeNull();
    expect(readRecord(text('4*aa'), 4)!.entries.length).toBe(4);
    expect(readRecord(text('5*aa'), 4)).toBeNull();
    expect(readRecord(text('2*aa h1 h1 2*aa'), 4)!.entries.length).toBe(6);
    expect(readRecord(text('2*aa h1 h1 3*aa'), 4)).toBeNull();
    expect(readRecord(text('h1'), 0)!.entries).toStrictEqual([{ input: jump, held: true }]);
    expect(readRecord(text(''), 0)!.entries).toStrictEqual([]);
    expect(readRecord(text('aa'), 0)).toBeNull();
    // A huge count is refused before any entry is built (this returns at once), also when the steps before it are within the limit.
    expect(readRecord(text('999999999999*aa'), 1000)).toBeNull();
    expect(readRecord(text('aa 999999999999*aa'), 999999999999)).toBeNull();
    expect(readRecord(text(`h1 ${Number.MAX_SAFE_INTEGER}*aa`), Number.MAX_SAFE_INTEGER - 1)).toBeNull();
    // A count past the safe integers is refused even under a limit above them.
    expect(readRecord(text('9007199254740993*aa'), 2 ** 60)).toBeNull();
  });

  it('GDD-TEC-09 the recorder keeps a held mark only when a button is down', () => {
    expect(marks({ move: 0, jumpHeld: false })).toBe(0);
    expect(marks(idle)).toBe(0);
    expect(marks({ move: 0, jumpHeld: true })).toBe(1);
    expect(marks({ move: 1, jumpHeld: false })).toBe(1);
    expect(marks({ move: -1, jumpHeld: false })).toBe(1);
    expect(marks({ ...idle, left: true })).toBe(1);
    expect(marks({ ...idle, claw: true })).toBe(1);
    expect(marks({ ...idle, fuego: true })).toBe(1);
    const recorder = new RunRecorder(header());
    recorder.held(jump);
    expect(recorder.record()!.entries).toStrictEqual([{ input: jump, held: true }]);
  });

  it('GDD-TEC-09 the recorder copies each input', () => {
    const recorder = new RunRecorder(header());
    const input: PlayerInput = { move: 1, jumpHeld: true };
    recorder.step(input);
    recorder.held(input);
    const before = recorder.record()!;
    input.move = -1;
    input.jumpHeld = false;
    recorder.step(input);
    expect(recorder.record()!.entries).toStrictEqual([{ input: { move: 1, jumpHeld: true } }, { input: { move: 1, jumpHeld: true }, held: true }, { input: { move: -1, jumpHeld: false } }]);
    // A record taken before does not grow with the steps after it.
    expect(before.entries.length).toBe(2);
    expect(before.header).toStrictEqual(header());
  });

  it('GDD-TEC-09 a spoiled recorder has no record', () => {
    const recorder = new RunRecorder(header());
    recorder.step(still);
    expect(recorder.record()).not.toBeNull();
    recorder.spoil();
    expect(recorder.record()).toBeNull();
    recorder.step(still);
    expect(recorder.record()).toBeNull();
  });

  it('GDD-TEC-09 a replay starts as its header says', () => {
    const started = end({ start: 'start', lives: 4, hilos: savedText });
    expect(started.lives.lives).toBe(4);
    expect(started.hilosSaved).toStrictEqual(SAVED);
    expect(stateHash(started)).toBe(stateHash(startRun(LEVEL_0_1, SAVED, 4)));

    const restarted = end({ start: 'restart', hilos: savedText });
    expect(restarted.phase).toBe('respawning');
    expect(restarted.wait).toBe(FLIP.steps + 1);
    expect(stateHash(restarted)).toBe(stateHash(restartRun(LEVEL_0_1, SAVED)));

    const back = end({ start: 'resume', hilos: savedText, resume: resumed });
    expect(back.checkpointIndex).toBe(1);
    expect(back.lives.lives).toBe(5);
    expect(back.clock).toBe(600);
    expect(back.hilosTaken.slice(0, 3)).toStrictEqual([true, true, true]);
    expect(stateHash(back)).toBe(stateHash(resumeRun(LEVEL_0_1, { ...resumed, level: '0-1' }, SAVED)));
  });

  it('GDD-TEC-09 a replay adds the abilities of the header to the level', () => {
    expect(glides({ glide: true })).toBe(true);
    expect(glides({})).toBe(false);
    // Added, never taken away: a header built in code that turns an ability off leaves the level's own on.
    const own: Level = { ...LEVEL_0_1, abilities: { glide: true } };
    const glidesOn = (abilities: RecordHeader['abilities']): boolean => statesOf(record(steps(jump, 60), { abilities }), own).some((s) => s.player.gliding === true);
    expect(glidesOn({})).toBe(true);
    expect(glidesOn({ glide: false })).toBe(true);
    expect(glidesOn({ wallCling: true })).toBe(true);
    // The wall cling, alone: a jump into a wall clings only with it, and the level's own stays on.
    const rows = ['#.........', '#.........', '#.........', '#.........', '#.........', '#.........', '##########'];
    const wall: Level = { world: parseTiles(rows), spawn: { x: 40, y: 96 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };
    const intoWall = steps({ move: -1, jumpHeld: true }, 60);
    const clings = (abilities: RecordHeader['abilities'], level: Level): boolean => statesOf(record(intoWall, { abilities, hilos: '' }), level).some((s) => s.player.clinging === true);
    expect(clings({ wallCling: true }, wall)).toBe(true);
    expect(clings({}, wall)).toBe(false);
    expect(clings({ glide: true }, wall)).toBe(false);
    expect(clings({ wallCling: false }, { ...wall, abilities: { wallCling: true } })).toBe(true);
  });

  it('GDD-TEC-09 a held mark holds the jump back', () => {
    // Step 1 with jump down and `jumpWasHeld` false is a press, and he takes off; with the mark `jumpWasHeld` is true and he stays.
    const marked = statesOf(record([{ input: jump, held: true }, ...steps(jump, 5)]), LEVEL_0_1);
    expect(marked.map((s) => s.player.grounded)).toStrictEqual([true, true, true, true, true]);
    expect(statesOf(record(steps(jump, 1)), LEVEL_0_1)[0]!.player.grounded).toBe(false);

    const claw: PlayerInput = { ...still, claw: true };
    const swung = statesOf(record([{ input: claw, held: true }, ...steps(claw, 5)]), LEVEL_0_1);
    expect(swung.map((s) => s.claw.phase)).toStrictEqual(['idle', 'idle', 'idle', 'idle', 'idle']);
    expect(statesOf(record(steps(claw, 1)), LEVEL_0_1)[0]!.claw.phase).toBe('windup');
  });

  it('GDD-TEC-09 a held mark holds a button back on the Siete vidas gastadas screen', () => {
    // Floor on the left (x < 80), a 3-tile pit (x 80 to 128), floor again on the right, its top at y = 64. One life: he walks into the pit,
    // and after the wait the screen is up; well past its 1.0 s lockout, a new jump press would restart.
    const world = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
    const pit: Level = { world, spawn: { x: 24, y: 4 * TILE }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };
    const before = [...steps({ move: 1, jumpHeld: false }, 40), ...steps(still, 150)];
    const screen = replay(record(before, { lives: 1, hilos: '' }), pit).end;
    expect(screen.phase).toBe('gameover');
    expect(screen.wait).toBeGreaterThan(GAME_OVER.lockoutSteps);
    expect(replay(record([...before, { input: jump, held: true }, { input: jump }], { lives: 1, hilos: '' }), pit).end.phase).toBe('gameover');
    expect(replay(record([...before, { input: jump }], { lives: 1, hilos: '' }), pit).end.phase).toBe('respawning');
  });

  it('GDD-TEC-09 replay gives one hash a step and the step that cleared', () => {
    // A flat level, the floor's top at y = 224, the exit one tile right of the spawn. A held mark before the walk, so the entries and
    // the steps are counted apart.
    const flat = parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('##############################')]);
    const spawn: Point = { x: 24, y: 224 };
    const level: Level = { world: flat, spawn, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [], exit: { x: 40, y: 224 } };
    const right: PlayerInput = { move: 1, jumpHeld: false };
    const entries: RecordEntry[] = [...steps(still, 2), { input: jump, held: true }, ...steps(right, 20)];
    const r = replay(record(entries, { hilos: '' }), level);
    expect(r.hashes.length).toBe(22);
    let direct = startRun(level, []);
    const states: RunState[] = [];
    for (let i = 0; i < 22; i++) {
      if (i === 2) direct = resumeHeld(direct, jump);
      direct = stepRun(direct, i < 2 ? still : right, level);
      states.push(direct);
    }
    expect(r.hashes).toStrictEqual(states.map(stateHash));
    const first = states.findIndex((s) => s.phase === 'clear');
    expect(first).toBeGreaterThan(2);
    expect(states[states.length - 1]!.phase).toBe('clear');
    expect(r.clearStep).toBe(first + 1);
    expect(replay(record(entries.slice(0, first + 1), { hilos: '' }), level).clearStep).toBeNull();
    expect(replay(record(entries.slice(0, first + 2), { hilos: '' }), level).clearStep).toBe(first + 1);
  });

  it('GDD-TEC-09 a step is pure: its arguments frozen, twice the same', () => {
    for (const level of [LEVEL_0_1, LEVEL_3_3]) {
      freeze(level);
      let run = freeze(startRun(level));
      for (let i = 0; i < 600; i++) {
        const input = freeze(scripted(i));
        const before = stateHash(run);
        const a = stepRun(run, input, level);
        const b = stepRun(run, input, level);
        expect(stateHash(a), `step ${i + 1}`).toBe(stateHash(b));
        // A frozen Set can still be added to: its text before and after the steps shows that it was not.
        expect(stateHash(run), `step ${i + 1}`).toBe(before);
        run = freeze(a);
      }
    }
  });
});
