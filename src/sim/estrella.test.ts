import { describe, expect, it } from 'vitest';
import type { Box } from './enemy';
import { hurtbox } from './hazards';
import { spawn, step, type PlayerState, type World } from './movement';
import type { PlatformPos } from './platform';
import { parseTiles } from './tilemap';
import {
  aimAt,
  bumps,
  estrellaActive,
  estrellaHittable,
  estrellaBox,
  estrellaCleared,
  estrellaStart,
  hitEstrella,
  moveEstrella,
  stepEstrella,
  stepTejocote,
  surfaceUnder,
  type Estrella,
  type EstrellaMode,
  type EstrellaState,
  type EstrellaStep,
  type Tejocote,
} from './estrella';

// GDD-BOS-03: La Estrella in an arena laid out like the proposed 2-4: the floor's top at y = 224 across the whole width (rows 14 to 16),
// three whole awnings 4 tiles wide with their tops at y = 176 (x 48 to 112, 208 to 272, 368 to 432), and two cordeles at y = 136 between
// them (x 112 to 208 and 272 to 368), which she passes through, so they are not given to her. Phase 1 starts over x = 400 and drops at 80,
// then 400; phase 2 starts over 320 and drops at 160, then 320; phase 3 starts over 400 and aims at Poncho. Expected values come from
// the design's numbers (ESTRELLA, TEJOCOTE); her box is 32 x 32 px, her y is its bottom.
const DEF: Estrella = { floor: 224, spots: [[400, 80], [320, 160], [400]] };
const AWNINGS: readonly PlatformPos[] = [
  { x: 48, y: 176, w: 64 },
  { x: 208, y: 176, w: 64 },
  { x: 368, y: 176, w: 64 },
];
const CORDEL_Y = 136;
const WORLD = parseTiles([...Array<string>(14).fill('.'.repeat(30)), ...Array<string>(3).fill('#'.repeat(30))]);
/** Poncho standing at x on a surface whose top is y. */
const at = (x: number, y = 224): PlayerState => spawn(x, y);

/** Moves her `n` steps with Poncho as `poncho(i)` gives on step i (1-based); every state, and the step of each landing. */
function cycle(e: EstrellaState, n: number, poncho: (i: number) => PlayerState = () => at(240)): { states: EstrellaState[]; landed: { step: number; on: 'awning' | 'floor' }[] } {
  const states: EstrellaState[] = [];
  const landed: { step: number; on: 'awning' | 'floor' }[] = [];
  let s = e;
  for (let i = 1; i <= n; i++) {
    const r = moveEstrella(DEF, s, poncho(i), AWNINGS);
    s = r.estrella;
    states.push(s);
    if (r.landed) landed.push({ step: i, on: r.landed });
  }
  return { states, landed };
}
/** The first step (1-based) at or after step `from` at which she is in `mode` with age 0. */
const firstIn = (states: EstrellaState[], mode: EstrellaMode, from = 1): number => states.findIndex((s, i) => i + 1 >= from && s.mode === mode && s.age === 0) + 1;

/** Her, in `mode` at age `age`, at x with her bottom at y. */
const posed = (mode: EstrellaMode, x: number, y: number, hits = 0, age = 0): EstrellaState => ({ ...estrellaStart(DEF, hits), mode, age, x, y, tx: x, ty: y });
/** Poncho rising: his hurtbox's top at `fromTop` before the step and at `toTop` after it. */
const rising = (x: number, fromTop: number, toTop: number): { before: PlayerState; after: PlayerState } => ({
  before: { ...spawn(x, fromTop + 31), grounded: false, vy: -240 },
  after: { ...spawn(x, toTop + 31), grounded: false, vy: -220 },
});
/** One step of the fight with nothing but Poncho, unless the extras say otherwise. */
function fightStep(e: EstrellaState, poncho: { before: PlayerState; after: PlayerState }, extras: { claw?: Box | null; fireballs?: Box[]; tejocotes?: Tejocote[] } = {}): EstrellaStep {
  return stepEstrella(DEF, { estrella: e, tejocotes: extras.tejocotes ?? [] }, { ...poncho, claw: extras.claw ?? null, fireballs: extras.fireballs ?? [], awnings: AWNINGS, world: WORLD });
}
const standing = (x: number, y = 224) => ({ before: at(x, y), after: at(x, y) });
/** Plays the fight `n` steps with Poncho standing still at (x, y); every step's result. */
function play(e: EstrellaState, n: number, x: number, y = 224): EstrellaStep[] {
  const out: EstrellaStep[] = [];
  let fight = { estrella: e, tejocotes: [] as readonly Tejocote[] };
  for (let i = 0; i < n; i++) {
    const r = stepEstrella(DEF, fight, { ...standing(x, y), claw: null, fireballs: [], awnings: AWNINGS, world: WORLD });
    out.push(r);
    fight = r;
  }
  return out;
}

describe('GDD-BOS-03 La Estrella starts', () => {
  it('GDD-BOS-03 the fight starts with her high at x 400, her box bottom at y 40, a glide about to start', () => {
    expect(estrellaStart(DEF, 0)).toMatchObject({ x: 400, y: 40, hits: 0, mode: 'glide', age: 0 });
    expect(estrellaBox(estrellaStart(DEF, 0))).toEqual({ x0: 384, x1: 416, y0: 8, y1: 40 });
  });

  it('GDD-BOS-03 a lost life starts her phase again keeping her hits: phase 2 over x 320, phase 3 over x 400', () => {
    expect(estrellaStart(DEF, 1)).toMatchObject({ x: 320, y: 40, hits: 1, mode: 'glide', age: 0 });
    expect(estrellaStart(DEF, 2)).toMatchObject({ x: 400, y: 40, hits: 2, mode: 'glide', age: 0 });
  });
});

describe('GDD-BOS-03 phase 1 Arriba', () => {
  it('GDD-BOS-03 phase 1 glides left at 80 px a second and telegraphs over x 80 on step 240', () => {
    const { states } = cycle(estrellaStart(DEF, 0), 240);
    expect(states[0]!.x).toBeCloseTo(400 - 4 / 3, 6);
    expect(states[0]!.y).toBe(40);
    expect(states[238]).toMatchObject({ mode: 'glide' });
    expect(states[239]).toMatchObject({ mode: 'telegraph', age: 0, x: 80, y: 40 });
  });

  it('GDD-BOS-03 the telegraph lasts 30 steps, still, then the drop starts', () => {
    const { states } = cycle(estrellaStart(DEF, 0), 270);
    for (let i = 239; i < 269; i++) expect(states[i], `step ${i + 1}`).toMatchObject({ mode: 'telegraph', x: 80, y: 40 });
    expect(states[269]).toMatchObject({ mode: 'drop', age: 0, x: 80, y: 40, ty: 176 });
  });

  it('GDD-BOS-03 phase 1 drops at 300 px a second onto the left awning on step 298', () => {
    const { states, landed } = cycle(estrellaStart(DEF, 0), 300);
    expect(states[270]!.y).toBeCloseTo(45, 6);
    expect(states[296]).toMatchObject({ mode: 'drop', y: 175 });
    expect(states[297]).toMatchObject({ mode: 'bounce', age: 0, x: 80, y: 176 });
    expect(landed).toEqual([{ step: 298, on: 'awning' }]);
  });

  it('GDD-BOS-03 the awning throws her up at 240 px a second to y 112 where she hangs on step 314', () => {
    const { states } = cycle(estrellaStart(DEF, 0), 320);
    expect(states[298]!.y).toBeCloseTo(172, 6);
    expect(states[312]!.mode).toBe('bounce');
    expect(states[313]).toMatchObject({ mode: 'hang', age: 0, x: 80, y: 112 });
  });

  it('GDD-BOS-03 phase 1 hangs still for 120 steps, then the yank', () => {
    const { states } = cycle(estrellaStart(DEF, 0), 440);
    for (let i = 313; i < 433; i++) expect(states[i], `step ${i + 1}`).toMatchObject({ mode: 'hang', x: 80, y: 112 });
    expect(states[433]).toMatchObject({ mode: 'yank', age: 0, x: 80, y: 112 });
  });

  it('GDD-BOS-03 the yank pulls her up at 180 px a second to the cable on step 458', () => {
    const { states } = cycle(estrellaStart(DEF, 0), 460);
    expect(states[434]!.y).toBeCloseTo(109, 6);
    expect(states[456]!.mode).toBe('yank');
    expect(states[457]).toMatchObject({ mode: 'glide', age: 0, x: 80, y: 40 });
  });

  it('GDD-BOS-03 phase 1 then glides to x 400 and drops onto the right awning', () => {
    const { states, landed } = cycle(estrellaStart(DEF, 0), 1000);
    expect(firstIn(states, 'telegraph', 459)).toBe(698);
    expect(states[697]).toMatchObject({ x: 400, y: 40 });
    expect(landed.map((l) => l.on)).toEqual(['awning', 'awning']);
    expect(states[landed[1]!.step - 1]).toMatchObject({ x: 400, y: 176 });
  });

  it('GDD-BOS-03 phase 1 never reaches the floor: a Poncho on the floor is never touched', () => {
    for (const x of [24, 80, 160, 240, 320, 400, 456]) {
      expect(play(estrellaStart(DEF, 0), 1400, x).filter((r) => r.touch !== undefined), `x ${x}`).toEqual([]);
    }
  });

  it('GDD-BOS-03 phase 1 her drop hits a Poncho on the left awning at x 60 but not at x 58', () => {
    expect(play(estrellaStart(DEF, 0), 320, 60, 176).some((r) => r.touch === 80)).toBe(true);
    expect(play(estrellaStart(DEF, 0), 320, 58, 176).some((r) => r.touch !== undefined)).toBe(false);
  });
});

describe('GDD-BOS-03 phase 2 Vaiven', () => {
  it('GDD-BOS-03 phase 2 glides at 100 px a second to x 160 and telegraphs on step 96', () => {
    const { states } = cycle(estrellaStart(DEF, 1), 130);
    expect(states[0]!.x).toBeCloseTo(320 - 5 / 3, 6);
    expect(states[95]).toMatchObject({ mode: 'telegraph', age: 0, x: 160, y: 40 });
    expect(states[125]).toMatchObject({ mode: 'drop', age: 0, ty: 224 });
  });

  it('GDD-BOS-03 she falls through the cordel to the floor on step 163 and rests 18 steps', () => {
    const { states, landed } = cycle(estrellaStart(DEF, 1), 190);
    expect(states[161]).toMatchObject({ mode: 'drop', y: 220 });
    expect(states[162]).toMatchObject({ mode: 'rest', age: 0, x: 160, y: 224 });
    expect(landed).toEqual([{ step: 163, on: 'floor' }]);
    for (let i = 162; i < 180; i++) expect(states[i], `step ${i + 1}`).toMatchObject({ mode: 'rest', y: 224 });
    expect(states[180]).toMatchObject({ mode: 'rise', age: 0, y: 224 });
  });

  it('GDD-BOS-03 she is pulled up at 120 px a second to y 72 and hangs on step 257', () => {
    const { states } = cycle(estrellaStart(DEF, 1), 260);
    expect(states[181]!.y).toBeCloseTo(222, 6);
    expect(states[255]!.mode).toBe('rise');
    expect(states[256]).toMatchObject({ mode: 'hang', age: 0, x: 160, y: 72 });
  });

  it('GDD-BOS-03 phase 2 hangs 90 steps swaying 8 px on a 1 s sine', () => {
    const { states } = cycle(estrellaStart(DEF, 1), 350);
    expect(states[256 + 15]!.x).toBeCloseTo(168, 6);
    expect(states[256 + 30]!.x).toBeCloseTo(160, 6);
    expect(states[256 + 45]!.x).toBeCloseTo(152, 6);
    for (let i = 256; i < 346; i++) expect(states[i]!.mode, `step ${i + 1}`).toBe('hang');
    expect(states[346]).toMatchObject({ mode: 'yank', age: 0, x: 160, y: 72 });
  });

  it('GDD-BOS-03 the phase 2 yank reaches the cable in 11 steps and she glides to x 320', () => {
    const { states, landed } = cycle(estrellaStart(DEF, 1), 700);
    expect(states[356]!.mode).toBe('yank');
    expect(states[357]).toMatchObject({ mode: 'glide', age: 0, x: 160, y: 40 });
    expect(firstIn(states, 'telegraph', 359)).toBe(358 + 96);
    expect(states[358 + 96 - 1]).toMatchObject({ x: 320 });
    expect(landed.map((l) => l.on)).toEqual(['floor', 'floor']);
  });

  it('GDD-BOS-03 one tejocote rolls out each way on her thud, from her middle on the floor', () => {
    const steps = play(estrellaStart(DEF, 1), 163, 470);
    expect(steps[161]!.tejocotes).toEqual([]);
    expect(steps[162]!.tejocotes).toEqual([
      { x: 160, y: 224, dir: -1, wait: 0 },
      { x: 160, y: 224, dir: 1, wait: 0 },
    ]);
  });
});

describe('GDD-BOS-03 phase 3 Remolino', () => {
  it('GDD-BOS-03 phase 3 glides at 120 px a second to the spot above Poncho and telegraphs there', () => {
    const { states } = cycle(estrellaStart(DEF, 2), 110, () => at(240));
    expect(states[0]!.x).toBeCloseTo(398, 6);
    expect(states[79]).toMatchObject({ mode: 'telegraph', age: 0, x: 240, y: 40 });
    expect(states[109]).toMatchObject({ mode: 'drop', age: 0, tx: 240, ty: 176 });
  });

  it('GDD-BOS-03 her glide target follows Poncho', () => {
    const { states } = cycle(estrellaStart(DEF, 2), 50, (i) => at(i <= 10 ? 100 : 440));
    expect(states[9]!.x).toBeCloseTo(380, 6);
    expect(states[19]!.x).toBeCloseTo(400, 6);
  });

  it('GDD-BOS-03 phase 3 drops at 360 px a second onto the awning under Poncho and is thrown to y 72', () => {
    const { states, landed } = cycle(estrellaStart(DEF, 2), 200, () => at(240));
    expect(states[110]!.y).toBeCloseTo(46, 6);
    expect(states[131]!.mode).toBe('drop');
    expect(states[132]).toMatchObject({ mode: 'bounce', x: 240, y: 176 });
    expect(landed[0]).toEqual({ step: 133, on: 'awning' });
    expect(states[158]).toMatchObject({ mode: 'hang', age: 0, x: 240, y: 72 });
  });

  it('GDD-BOS-03 phase 3 hangs 60 steps swaying 16 px', () => {
    const { states } = cycle(estrellaStart(DEF, 2), 230, () => at(240));
    expect(states[158 + 15]!.x).toBeCloseTo(256, 6);
    expect(states[158 + 45]!.x).toBeCloseTo(224, 6);
    expect(states[217]!.mode).toBe('hang');
    expect(states[218]).toMatchObject({ mode: 'yank', age: 0, x: 240, y: 72 });
  });

  it('GDD-BOS-03 phase 3 aims where Poncho is as the telegraph ends, not before', () => {
    const last = posed('telegraph', 300, 40, 2, 28);
    expect(moveEstrella(DEF, last, at(300), AWNINGS).estrella).toMatchObject({ mode: 'telegraph', age: 29, x: 300 });
    expect(moveEstrella(DEF, { ...last, age: 29 }, at(200), AWNINGS).estrella).toMatchObject({ mode: 'drop', age: 0, x: 300, tx: 200, ty: 224 });
  });

  it('GDD-BOS-03 phases 1 and 2 drop straight down whatever Poncho does', () => {
    expect(moveEstrella(DEF, posed('telegraph', 160, 40, 1, 29), at(300), AWNINGS).estrella).toMatchObject({ mode: 'drop', tx: 160, ty: 224 });
    expect(moveEstrella(DEF, posed('telegraph', 80, 40, 0, 29), at(300), AWNINGS).estrella).toMatchObject({ mode: 'drop', tx: 80, ty: 176 });
  });

  it('GDD-BOS-03 her phase 3 aim is kept between x 56 and 424', () => {
    expect(aimAt(at(20))).toBe(56);
    expect(aimAt(at(470))).toBe(424);
    expect(aimAt(at(57))).toBe(57);
    expect(moveEstrella(DEF, posed('telegraph', 100, 40, 2, 29), at(20), AWNINGS).estrella).toMatchObject({ tx: 56, ty: 176 });
  });

  it('GDD-BOS-03 her phase 3 drop is a straight line to the surface under the aim', () => {
    const drop = posed('drop', 300, 40, 2);
    const moved = moveEstrella(DEF, { ...drop, tx: 240, ty: 176 }, at(240), AWNINGS).estrella;
    const d = Math.hypot(240 - 300, 176 - 40);
    expect(moved.x).toBeCloseTo(300 - (60 / d) * 6, 6);
    expect(moved.y).toBeCloseTo(40 + (136 / d) * 6, 6);
  });

  it('GDD-BOS-03 phase 3 on the floor: two tejocotes each way, the second pair 24 steps after the first', () => {
    const steps = play(estrellaStart(DEF, 2), 210, 160);
    const thud = steps.findIndex((r) => r.landed === 'floor');
    expect(thud + 1).toBe(181);
    expect(steps[thud]!.tejocotes).toEqual([
      { x: 160, y: 224, dir: -1, wait: 0 },
      { x: 160, y: 224, dir: 1, wait: 0 },
      { x: 160, y: 224, dir: -1, wait: 24 },
      { x: 160, y: 224, dir: 1, wait: 24 },
    ]);
    expect(steps[thud + 23]!.tejocotes.filter((t) => t.wait === 0)).toHaveLength(2);
    expect(steps[thud + 24]!.tejocotes.slice(2)).toEqual([
      { x: 160, y: 224, dir: -1, wait: 0 },
      { x: 160, y: 224, dir: 1, wait: 0 },
    ]);
    expect(steps[thud + 25]!.tejocotes[2]!.x).toBeCloseTo(158.5, 6);
  });
});

describe('GDD-BOS-03 surfaces', () => {
  it('GDD-BOS-03 she drops onto an awning whose top spans her middle, else the floor', () => {
    expect(surfaceUnder(DEF, AWNINGS, 48)).toBe(176);
    expect(surfaceUnder(DEF, AWNINGS, 111.9)).toBe(176);
    expect(surfaceUnder(DEF, AWNINGS, 112)).toBe(224);
    expect(surfaceUnder(DEF, AWNINGS, 47.9)).toBe(224);
    expect(surfaceUnder(DEF, AWNINGS, 160)).toBe(224);
    expect(surfaceUnder(DEF, [...AWNINGS, { x: 140, y: 144, w: 32 }, { x: 150, y: 160, w: 32 }], 160)).toBe(144);
  });

  it('GDD-BOS-03 she passes through the cordel: a Poncho standing on it under her drop is hit', () => {
    expect(play(estrellaStart(DEF, 1), 170, 160, CORDEL_Y).some((r) => r.touch === 160 && r.estrella.mode === 'drop')).toBe(true);
  });
});

describe('GDD-BOS-03 after a hit', () => {
  it('GDD-BOS-03 a hit leaves her hurt; the third defeats her', () => {
    expect(hitEstrella(posed('hang', 80, 112))).toMatchObject({ hits: 1, mode: 'hurt', age: 0 });
    expect(hitEstrella(posed('hang', 80, 72, 1))).toMatchObject({ hits: 2, mode: 'hurt', age: 0 });
    expect(hitEstrella(posed('hang', 80, 72, 2))).toMatchObject({ hits: 3, mode: 'defeated', age: 0 });
  });

  it('GDD-BOS-03 hurt she stays still 60 steps, then is yanked up and drops in phase 2 at the spot nearest her', () => {
    const { states } = cycle(posed('hurt', 80, 112, 1), 140);
    for (let i = 0; i < 59; i++) expect(states[i], `step ${i + 1}`).toMatchObject({ mode: 'hurt', x: 80, y: 112 });
    expect(states[59]).toMatchObject({ mode: 'yank', age: 0, x: 80, y: 112 });
    expect(states[83]).toMatchObject({ mode: 'glide', age: 0, x: 80, y: 40 });
    expect(firstIn(states, 'telegraph')).toBe(84 + 48);
    expect(states[84 + 48 - 1]).toMatchObject({ x: 160 });
  });

  it('GDD-BOS-03 she is yanked straight up from where her hurt left her, off the middle of her sway', () => {
    const { states } = cycle({ ...posed('hurt', 168, 72, 1), tx: 160 }, 62);
    expect(states[59]).toMatchObject({ mode: 'yank', x: 168, y: 72 });
    expect(states[60]).toMatchObject({ mode: 'yank', x: 168, y: 69 });
  });

  it('GDD-BOS-03 hurt over x 400 her phase 2 starts at x 320', () => {
    const { states } = cycle(posed('hurt', 400, 112, 1), 200);
    const t = firstIn(states, 'telegraph');
    expect(states[t - 1]).toMatchObject({ x: 320, y: 40 });
  });

  it('GDD-BOS-03 after her second hurt she aims at Poncho', () => {
    const { states } = cycle(posed('hurt', 160, 72, 2), 300, () => at(300));
    const t = firstIn(states, 'telegraph');
    expect(states[t - 1]).toMatchObject({ x: 300, y: 40 });
  });

  it('GDD-BOS-03 defeated she falls at 120 px a second to the floor and lies there; clear 60 steps after the hit', () => {
    const { states } = cycle(posed('defeated', 80, 112, 3), 100);
    expect(states[0]!.y).toBeCloseTo(114, 6);
    expect(states[55]!.y).toBeCloseTo(224, 6);
    expect(states[99]).toMatchObject({ mode: 'defeated', y: 224, age: 100 });
    expect(estrellaCleared(states[58]!)).toBe(false);
    expect(estrellaCleared(states[59]!)).toBe(true);
    expect(estrellaCleared(posed('hurt', 80, 112, 2, 60))).toBe(false);
  });
});

describe('GDD-BOS-03 hitting her', () => {
  const hang = posed('hang', 80, 112);

  it('GDD-BOS-03 a bump from below hits her and stops his rise with his head under her', () => {
    const r = fightStep(hang, rising(80, 113, 109));
    expect(r.hit).toBe(true);
    expect(r.estrella).toMatchObject({ hits: 1, mode: 'hurt' });
    expect(r.player).toMatchObject({ x: 80, y: 144, vy: 0 });
    expect(r.touch).toBeUndefined();
  });

  it('GDD-BOS-03 a bump counts from his hurtbox top exactly at her bottom', () => {
    expect(fightStep(hang, rising(80, 112, 108)).hit).toBe(true);
    expect(bumps(rising(80, 112, 108).before, rising(80, 112, 108).after, hang)).toBe(true);
  });

  it('GDD-BOS-03 a head already inside her is no bump but her touch', () => {
    const r = fightStep(hang, rising(80, 111, 107));
    expect(r.hit).toBe(false);
    expect(r.estrella.mode).toBe('hang');
    expect(r.player.vy).toBe(-220);
    expect(r.touch).toBe(80);
  });

  it('GDD-BOS-03 a rise that stops short of her bottom, or a fall, is no bump', () => {
    const short = rising(80, 120, 116);
    expect(bumps(short.before, short.after, hang)).toBe(false);
    const down = rising(80, 109, 113);
    expect(bumps(down.before, down.after, hang)).toBe(false);
  });

  it('GDD-BOS-03 the bump needs his body box over her width', () => {
    expect(fightStep(hang, rising(80 + 21.9, 113, 109)).hit).toBe(true);
    expect(fightStep(hang, rising(80 - 21.9, 113, 109)).hit).toBe(true);
    expect(fightStep(hang, rising(80 + 22, 113, 109)).hit).toBe(false);
    expect(fightStep(hang, rising(80 - 22, 113, 109)).hit).toBe(false);
  });

  it('GDD-BOS-03 landing on her is a touch like any other, never a stomp', () => {
    const r = fightStep(hang, { before: { ...spawn(80, 78), grounded: false, vy: 200 }, after: { ...spawn(80, 83), grounded: false, vy: 220 } });
    expect(r.hit).toBe(false);
    expect(r.touch).toBe(80);
  });

  it('GDD-BOS-03 the claw hits her', () => {
    const r = fightStep(hang, standing(240), { claw: { x0: 90, x1: 110, y0: 80, y1: 112 } });
    expect(r.hit).toBe(true);
    expect(r.estrella.mode).toBe('hurt');
    expect(r.player).toEqual(at(240));
    expect(fightStep(hang, standing(240), { claw: { x0: 96, x1: 116, y0: 80, y1: 112 } }).hit).toBe(false);
  });

  it('GDD-BOS-03 a fireball is used up on her and does nothing', () => {
    const r = fightStep(hang, standing(240), { fireballs: [{ x0: 78, x1: 84, y0: 100, y1: 106 }, { x0: 300, x1: 306, y0: 100, y1: 106 }] });
    expect(r.spent).toEqual([true, false]);
    expect(r.hit).toBe(false);
    expect(r.estrella).toMatchObject({ mode: 'hang', hits: 0 });
    expect(fightStep(posed('hurt', 80, 112, 1), standing(240), { fireballs: [{ x0: 78, x1: 84, y0: 100, y1: 106 }] }).spent).toEqual([true]);
  });

  it('GDD-BOS-03 defeated she lets fireballs through', () => {
    expect(fightStep(posed('defeated', 80, 112, 3), standing(240), { fireballs: [{ x0: 78, x1: 84, y0: 100, y1: 106 }] }).spent).toEqual([false]);
  });

  it('GDD-BOS-03 she can be hit while she glides, telegraphs, hangs or is yanked', () => {
    // Each still in its mode after her move: a glide towards x 160, a yank up to the cable.
    const cases = [{ ...posed('glide', 80, 40, 1), tx: 160 }, posed('telegraph', 80, 40, 1), posed('hang', 80, 72, 1), { ...posed('yank', 80, 72, 1), ty: 40 }];
    for (const e of cases) {
      expect(estrellaHittable(e), e.mode).toBe(true);
      const r = fightStep(e, standing(240), { claw: { x0: 70, x1: 90, y0: e.y - 20, y1: e.y - 10 } });
      expect([r.estrella.hits, r.hit], e.mode).toEqual([2, true]);
      const b = fightStep(e, rising(80, e.y + 4, e.y - 6));
      expect([b.hit, b.player.vy], e.mode).toEqual([true, 0]);
    }
  });

  it('GDD-BOS-03 she cannot be hit while she drops, is thrown up by an awning, rests on the floor or rises from it, but her touch still hurts', () => {
    // Each still in its mode after her move, her bottom then at y 105 (a phase 2 drop from 100), 146 (a bounce from 150), 224 (resting) and
    // 198 (rising from 200): the claw over her and a rise through her bottom (as a bump would be) do nothing to her and he is touched.
    const cases = [
      [{ ...posed('drop', 80, 100, 1), ty: 224 }, 105],
      [{ ...posed('bounce', 80, 150, 1), ty: 112 }, 146],
      [posed('rest', 80, 224, 1), 224],
      [{ ...posed('rise', 80, 200, 1), ty: 72 }, 198],
    ] as const;
    for (const [e, bottom] of cases) {
      expect(estrellaHittable(e), e.mode).toBe(false);
      expect(estrellaActive(e), e.mode).toBe(true);
      const r = fightStep(e, standing(240), { claw: { x0: 70, x1: 90, y0: bottom - 20, y1: bottom - 10 } });
      expect([r.estrella.mode, r.estrella.y, r.hit], e.mode).toEqual([e.mode, bottom, false]);
      const b = fightStep(e, rising(80, bottom + 1, bottom - 3));
      expect([b.hit, b.player.vy, b.touch], e.mode).toEqual([false, -220, 80]);
    }
  });

  it('GDD-BOS-03 hurt or defeated she is neither hit nor bumped nor harmful', () => {
    for (const e of [posed('hurt', 80, 112, 1), posed('defeated', 80, 112, 3)]) {
      const r = fightStep(e, rising(80, 113, 109), { claw: { x0: 70, x1: 90, y0: 90, y1: 100 } });
      expect(r.hit, e.mode).toBe(false);
      expect(r.player.vy, e.mode).toBe(-220);
      expect(fightStep(e, rising(80, 111, 107)).touch, e.mode).toBeUndefined();
    }
  });
});

describe('GDD-BOS-03 touching her', () => {
  it('GDD-BOS-03 touching her is a hit while she glides, telegraphs, drops, bounces, rests, rises, hangs or is yanked', () => {
    for (const mode of ['glide', 'telegraph', 'drop', 'bounce', 'rest', 'rise', 'hang', 'yank'] as const) {
      const r = fightStep(posed(mode, 240, 150, 1), standing(240, 160));
      expect(r.touch, mode).toBe(r.estrella.x);
    }
  });

  it('GDD-BOS-03 boxes that only share an edge do not touch', () => {
    expect(fightStep(posed('hang', 80, 112), standing(80 + 21, 130)).touch).toBeUndefined();
    expect(fightStep(posed('hang', 80, 112), standing(80 + 20.9, 130)).touch).toBe(80);
  });

  it('GDD-BOS-03 the step that hits her does not hurt him through her', () => {
    const r = fightStep(posed('hang', 240, 150, 1), standing(240, 160), { claw: { x0: 240, x1: 260, y0: 128, y1: 160 } });
    expect(r.hit).toBe(true);
    expect(r.touch).toBeUndefined();
  });

  it('GDD-BOS-03 a tejocote touching him on the step that hits her is still reported, so the run can see the step costs a life', () => {
    const r = fightStep(posed('hang', 240, 150, 1), standing(240, 224), { claw: { x0: 230, x1: 250, y0: 128, y1: 150 }, tejocotes: [{ x: 238.5, y: 224, dir: 1, wait: 0 }] });
    expect(r.hit).toBe(true);
    expect(r.touch).toBe(240);
  });
});

/** The step on which a tejocote rolling from x 160 is gone, or -1. */
function life(dir: 1 | -1): number {
  let t: Tejocote | null = { x: 160, y: 224, dir, wait: 0 };
  for (let i = 1; i < 400; i++) {
    t = stepTejocote(t, WORLD);
    if (t === null) return i;
  }
  return -1;
}

describe('GDD-BOS-03 tejocotes', () => {
  it('GDD-BOS-03 a tejocote rolls 90 px a second along the floor', () => {
    expect(stepTejocote({ x: 160, y: 224, dir: -1, wait: 0 }, WORLD)).toEqual({ x: 158.5, y: 224, dir: -1, wait: 0 });
    expect(stepTejocote({ x: 160, y: 224, dir: 1, wait: 0 }, WORLD)).toEqual({ x: 161.5, y: 224, dir: 1, wait: 0 });
  });

  it('GDD-BOS-03 a tejocote is gone at the wall: from x 160 on the 105th step leftwards, the 211th rightwards', () => {
    expect(life(-1)).toBe(105);
    expect(life(1)).toBe(211);
  });

  it('GDD-BOS-03 a waiting tejocote stays where it is until it comes out', () => {
    expect(stepTejocote({ x: 160, y: 224, dir: 1, wait: 24 }, WORLD)).toEqual({ x: 160, y: 224, dir: 1, wait: 23 });
    expect(stepTejocote({ x: 160, y: 224, dir: 1, wait: 1 }, WORLD)).toEqual({ x: 160, y: 224, dir: 1, wait: 0 });
  });

  it('GDD-BOS-03 touching a tejocote is a hit', () => {
    const r = fightStep(posed('glide', 400, 40), standing(300), { tejocotes: [{ x: 290, y: 224, dir: 1, wait: 0 }] });
    expect(r.touch).toBeCloseTo(291.5, 6);
    expect(fightStep(posed('glide', 400, 40), standing(300), { tejocotes: [{ x: 300, y: 224, dir: 1, wait: 3 }] }).touch).toBeUndefined();
  });

  it('GDD-BOS-03 the claw bursts a tejocote', () => {
    const claw = { x0: 290, x1: 310, y0: 192, y1: 224 };
    expect(fightStep(posed('glide', 400, 40), standing(240), { claw, tejocotes: [{ x: 300, y: 224, dir: 1, wait: 0 }] }).tejocotes).toEqual([]);
    expect(fightStep(posed('glide', 400, 40), standing(240), { claw, tejocotes: [{ x: 300, y: 224, dir: 1, wait: 5 }] }).tejocotes).toHaveLength(1);
    expect(fightStep(posed('glide', 400, 40), standing(240), { claw, tejocotes: [{ x: 330, y: 224, dir: 1, wait: 0 }] }).tejocotes).toHaveLength(1);
  });

  it('GDD-BOS-03 a fireball bursts a tejocote and is used up', () => {
    const r = fightStep(posed('glide', 400, 40), standing(240), { fireballs: [{ x0: 300, x1: 306, y0: 216, y1: 222 }], tejocotes: [{ x: 300, y: 224, dir: 1, wait: 0 }] });
    expect(r.tejocotes).toEqual([]);
    expect(r.spent).toEqual([true]);
    const waiting = fightStep(posed('glide', 400, 40), standing(240), { fireballs: [{ x0: 297, x1: 303, y0: 216, y1: 222 }], tejocotes: [{ x: 300, y: 224, dir: 1, wait: 5 }] });
    expect(waiting.tejocotes).toHaveLength(1);
    expect(waiting.spent).toEqual([false]);
  });

  it('GDD-BOS-03 her defeat clears every tejocote; a hurt does not', () => {
    const tejocotes: Tejocote[] = [{ x: 300, y: 224, dir: 1, wait: 0 }, { x: 160, y: 224, dir: 1, wait: 10 }];
    const claw = { x0: 70, x1: 90, y0: 90, y1: 100 };
    expect(fightStep(posed('hang', 80, 112, 2), standing(240), { claw, tejocotes }).tejocotes).toEqual([]);
    expect(fightStep(posed('hang', 80, 112, 1), standing(240), { claw, tejocotes }).tejocotes).toHaveLength(2);
  });
});

describe('GDD-BOS-03 reach from awnings and cordeles', () => {
  // Poncho's real movement (GDD-MOV-02, GDD-MOV-04), jump held all the way up. A plain jump takes off from standing; an awning rebound is
  // stood in for by a launch set the way a spring sets it (GDD-WLD-05): on the surface, leaving at 480, 540 or 600 px/s (the awning tiers).
  const EMPTY: World = { solidTile: () => false };
  function rise(surface: number, launch: number | null): PlayerState[] {
    let s: PlayerState = launch === null ? at(240, surface) : { ...at(240, surface), grounded: false, vy: -launch, jumpWasHeld: true };
    const out = [s];
    for (let i = 0; i < 200 && s.vy <= 0; i++) {
      s = step(s, { move: 0, jumpHeld: true }, EMPTY);
      out.push(s);
    }
    return out;
  }
  // From, surface, launch, the measured peak of his hurtbox's top, and whether he reaches her high (40), low in phase 1 (112), low in phases 2 and 3 (72).
  const ROWS = [
    ['floor jump', 224, null, 136.56, [false, false, false]],
    ['awning jump', 176, null, 88.56, [false, true, false]],
    ['awning tier 1', 176, 480, 67.92, [false, true, true]],
    ['awning tier 2', 176, 540, 47.73, [false, true, true]],
    // On the cordel his hurtbox already reaches above y 112 (its top at 105): beside her low phase 1 height, not under it, so no bump.
    ['cordel jump', CORDEL_Y, null, 48.56, [false, false, true]],
    ['awning tier 3', 176, 600, 24.79, [true, true, true]],
  ] as const;

  it('GDD-BOS-03 the head peaks measured on the real jump', () => {
    for (const [from, surface, launch, peak] of ROWS) expect(Math.min(...rise(surface, launch).map((s) => hurtbox(s).y)), from).toBeCloseTo(peak, 1);
  });

  it('GDD-BOS-03 the reach table: which jumps bump her high and low', () => {
    for (const [from, surface, launch, , reach] of ROWS) {
      const path = rise(surface, launch);
      const got = [40, 112, 72].map((bottom) => path.some((s, i) => i > 0 && bumps(path[i - 1]!, s, posed('hang', 240, bottom))));
      expect(got, from).toEqual(reach);
    }
  });
});

describe('GDD-BOS-03 fairness', () => {
  it('GDD-BOS-03 every drop follows 30 steps of telegraph and falls for at least 23 steps', () => {
    for (const hits of [0, 1, 2]) {
      // Poncho walks to and fro on the floor, slower than her glide.
      const { states } = cycle(estrellaStart(DEF, hits), 3000, (i) => at(240 + 160 * Math.sin(i / 120)));
      const drops = states.flatMap((s, i) => (s.mode === 'drop' && s.age === 0 ? [i] : []));
      expect(drops.length, `phase ${hits + 1}`).toBeGreaterThanOrEqual(4);
      for (const i of drops) {
        expect(states.slice(i - 30, i).every((s) => s.mode === 'telegraph'), `phase ${hits + 1} step ${i + 1}`).toBe(true);
        expect(states[i - 31]!.mode).not.toBe('telegraph');
        expect(states[i]!.y).toBe(40);
        const end = states.findIndex((s, j) => j > i && s.mode !== 'drop');
        if (end < 0) continue;
        expect(end - i, `phase ${hits + 1} step ${i + 1}`).toBeGreaterThanOrEqual(23);
      }
    }
  });

  it('GDD-BOS-03 in phases 1 and 2 nothing reaches a Poncho standing on a side awning outer end', () => {
    for (const hits of [0, 1]) {
      for (const x of [43, 50, 58, 422, 430, 437]) {
        expect(play(estrellaStart(DEF, hits), 1500, x, 176).filter((r) => r.touch !== undefined), `phase ${hits + 1} x ${x}`).toEqual([]);
      }
    }
  });

  it('GDD-BOS-03 her box stays on screen, under the cable, and never ends a drop inside a tile', () => {
    for (let x = 0; x <= 480; x += 1) {
      const tx = aimAt(at(x));
      const box = estrellaBox({ ...posed('drop', tx, surfaceUnder(DEF, AWNINGS, tx)) });
      expect(box.x0, `aim at ${x}`).toBeGreaterThanOrEqual(0);
      expect(box.x1, `aim at ${x}`).toBeLessThanOrEqual(480);
      expect(box.y1, `aim at ${x}`).toBeLessThanOrEqual(224);
    }
    for (const spot of [...DEF.spots[0], ...DEF.spots[1]]) {
      const box = estrellaBox(posed('glide', spot, 40));
      expect(box.x0).toBeGreaterThanOrEqual(0);
      expect(box.x1).toBeLessThanOrEqual(480);
    }
    expect(estrellaBox(estrellaStart(DEF, 0)).y0).toBe(8);
  });
});
