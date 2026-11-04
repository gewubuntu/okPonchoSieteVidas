import { describe, expect, it } from 'vitest';
import { parseTiles } from './tilemap';
import { spawn, type PlayerState } from './movement';
import { bossBox, bossCrown, bossHarms, bossHittable, bossStart, freshRocks, fruitBox, hitBoss, knock, lapPoint, ponchoBox, rockBox, stepBoss, stepFruit, stepRock, type Boss, type BossMode, type BossState, type Fruit, type RockState } from './boss';

// GDD-BOS-02: Don Zopilote's pattern in the arena of 1-4: his lap's middle at (240, 72), the floor's top at y = 224, so his middle on the
// floor is at y = 209 (his box is 48 x 30). Expected values come from the GDD's numbers.
const DEF: Boss = { x: 240, y: 72, floor: 224 };
const at = (x: number): PlayerState => ({ ...spawn(x, 224), grounded: true });
/** A rock resting on the left pillar's spot. */
const rest = (): RockState => freshRocks([{ x: 56, y: 176 }])[0]!;
const ARENA = parseTiles([...Array<string>(11).fill('.'.repeat(30)), ...Array<string>(3).fill('####' + '.'.repeat(22) + '####'), ...Array<string>(3).fill('#'.repeat(30))]);

/** Steps the boss `n` times with Poncho standing at `x`; returns every state and every drop. */
function fly(b: BossState, n: number, x = 232): { states: BossState[]; drops: { step: number; fruit: Fruit }[] } {
  const states: BossState[] = [];
  const drops: { step: number; fruit: Fruit }[] = [];
  let s = b;
  for (let i = 1; i <= n; i++) {
    const r = stepBoss(DEF, s, at(x));
    s = r.boss;
    states.push(s);
    if (r.drop) drops.push({ step: i, fruit: r.drop });
  }
  return { states, drops };
}
/** The first step (1-based) at which the boss is in `mode`, from the states `fly` returns. */
const firstIn = (states: BossState[], mode: BossMode, from = 0): number => states.findIndex((s, i) => i >= from && s.mode === mode) + 1;

describe('GDD-BOS-02 Don Zopilote circles', () => {
  it('GDD-BOS-02 he starts at the right end of his lap, a lap about to start, facing left', () => {
    expect(bossStart(DEF, 0)).toEqual({ x: 392, y: 72, dir: -1, hits: 0, mode: 'lap', age: 0, side: 1, tx: 392, ty: 72 });
    expect(bossStart(DEF, 2).hits).toBe(2);
  });

  it('GDD-BOS-02 lap points: from the right end he goes along the lower half first, a lap in 240 steps', () => {
    const expected = [[60, 240, 88], [120, 88, 72], [180, 240, 56], [240, 392, 72]] as const;
    for (const [age, x, y] of expected) {
      const p = lapPoint(DEF, 1, age);
      expect(p.x, `x at ${age}`).toBeCloseTo(x, 6);
      expect(p.y, `y at ${age}`).toBeCloseTo(y, 6);
    }
  });

  it('GDD-BOS-02 lap points from the left end go along the upper half first', () => {
    const expected = [[60, 240, 56], [120, 392, 72], [180, 240, 88], [240, 88, 72]] as const;
    for (const [age, x, y] of expected) {
      const p = lapPoint(DEF, -1, age);
      expect(p.x, `x at ${age}`).toBeCloseTo(x, 6);
      expect(p.y, `y at ${age}`).toBeCloseTo(y, 6);
    }
  });

  it('GDD-BOS-02 he drops a fruit at lap steps 40 100 160 and 220, its top at his box bottom', () => {
    const { drops } = fly(bossStart(DEF, 0), 240);
    expect(drops.map((d) => d.step)).toEqual([40, 100, 160, 220]);
    const expected = [[316, 85.856 + 23], [108.364, 80 + 23], [164, 58.144 + 23], [371.636, 64 + 23]] as const;
    drops.forEach((d, i) => {
      expect(d.fruit.x).toBeCloseTo(expected[i]![0], 2);
      expect(d.fruit.y).toBeCloseTo(expected[i]![1], 2);
      expect(d.fruit).toMatchObject({ landed: false, age: 0 });
    });
  });

  it('GDD-BOS-02 from the left end his fruit drops at x 164 372 316 and 108', () => {
    const { drops } = fly({ ...bossStart(DEF, 0), x: 88, dir: 1, side: -1, tx: 88 }, 240);
    expect(drops.map((d) => d.step)).toEqual([40, 100, 160, 220]);
    const expected = [164, 371.636, 316, 108.364];
    drops.forEach((d, i) => expect(d.fruit.x, `drop ${i + 1}`).toBeCloseTo(expected[i]!, 2));
  });

  it('GDD-BOS-02 he faces the way he moves across a lap', () => {
    const { states } = fly(bossStart(DEF, 0), 239);
    expect(states[0]!.dir).toBe(-1); // from the right end, leftwards along the lower half
    expect(states[130]!.dir).toBe(1); // back rightwards along the upper half
  });
});

describe('GDD-BOS-02 telegraph and dive', () => {
  it('GDD-BOS-02 at the end of the lap he telegraphs, frozen for 30 steps', () => {
    const { states } = fly(bossStart(DEF, 0), 270);
    expect(firstIn(states, 'telegraph')).toBe(240);
    expect(states[239]).toMatchObject({ x: 392, mode: 'telegraph', age: 0 });
    expect(states[239]!.y).toBeCloseTo(72, 6);
    for (let i = 239; i < 269; i++) expect(states[i]!.mode, `step ${i + 1}`).toBe('telegraph');
    expect(states[269]).toMatchObject({ mode: 'dive', age: 0, x: 392 });
  });

  it('GDD-BOS-02 in his telegraph he faces Poncho', () => {
    const tele = { ...bossStart(DEF, 0), mode: 'telegraph' as const, age: 0, dir: 1 as const };
    expect(stepBoss(DEF, tele, at(100)).boss.dir).toBe(-1);
    expect(stepBoss(DEF, { ...tele, dir: -1 }, at(430)).boss.dir).toBe(1);
  });

  it('GDD-BOS-02 the dive aims at Poncho where he is when the telegraph ends', () => {
    let b: BossState = { ...bossStart(DEF, 0), mode: 'telegraph', age: 0 };
    for (let i = 0; i < 29; i++) b = stepBoss(DEF, b, at(300)).boss;
    expect(b.mode).toBe('telegraph');
    b = stepBoss(DEF, b, at(200)).boss;
    expect(b).toMatchObject({ mode: 'dive', tx: 200, ty: 209 });
  });

  it('GDD-BOS-02 the dive aim stays between the ends of his lap', () => {
    const last = { ...bossStart(DEF, 0), mode: 'telegraph' as const, age: 29 };
    expect(stepBoss(DEF, last, at(30)).boss).toMatchObject({ mode: 'dive', tx: 88, ty: 209 });
    expect(stepBoss(DEF, last, at(450)).boss).toMatchObject({ mode: 'dive', tx: 392, ty: 209 });
  });

  it('GDD-BOS-02 the phase 1 dive moves 3 px a step and sticks him in the sand on step 341', () => {
    const { states } = fly(bossStart(DEF, 0), 345);
    const a = states[269]!;
    const b = states[270]!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(3, 6);
    expect(firstIn(states, 'stuck')).toBe(341);
    expect(states[340]).toMatchObject({ x: 232, y: 209, mode: 'stuck', age: 0 });
  });

  it('GDD-BOS-02 the phase 3 dive is faster, 5 px a step, stuck on step 313', () => {
    const { states } = fly(bossStart(DEF, 2), 320);
    const a = states[269]!;
    const b = states[270]!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(5, 6);
    expect(firstIn(states, 'stuck')).toBe(313);
  });

  it('GDD-BOS-02 stuck for 1.0 s in phase 1, then he climbs to the nearer end at 2 px a step and laps from it', () => {
    const { states } = fly(bossStart(DEF, 0), 510);
    expect(firstIn(states, 'climb')).toBe(401);
    expect(states[400]).toMatchObject({ mode: 'climb', age: 0, x: 232, y: 209, tx: 88, ty: 72, side: -1 });
    expect(Math.hypot(states[401]!.x - 232, states[401]!.y - 209)).toBeCloseTo(2, 6);
    expect(firstIn(states, 'lap', 400)).toBe(501);
    expect(states[500]).toMatchObject({ x: 88, y: 72, mode: 'lap', age: 0, side: -1 });
  });

  it('GDD-BOS-02 stuck for 0.6 s in phase 3', () => {
    const { states } = fly(bossStart(DEF, 2), 360);
    expect(firstIn(states, 'climb')).toBe(349);
  });

  it('GDD-BOS-02 from the middle he climbs to the right end', () => {
    const stuck = { ...bossStart(DEF, 0), mode: 'stuck' as const, age: 59, x: 240, y: 209 };
    expect(stepBoss(DEF, stuck, at(100)).boss).toMatchObject({ mode: 'climb', tx: 392, side: 1 });
    expect(stepBoss(DEF, { ...stuck, x: 239 }, at(100)).boss).toMatchObject({ mode: 'climb', tx: 88, side: -1 });
  });
});

describe('GDD-BOS-02 phase 2 sweep', () => {
  it('GDD-BOS-02 phase 2 drops straight down at 3 px a step, sweeps the floor at 2.5 px a step and climbs straight up', () => {
    const { states } = fly(bossStart(DEF, 1), 510);
    expect(firstIn(states, 'dive')).toBe(0);
    expect(states[269]).toMatchObject({ mode: 'drop', x: 392, tx: 392, ty: 209, dir: -1 });
    expect(states[270]).toMatchObject({ x: 392, dir: -1 });
    expect(states[270]!.y).toBeCloseTo(75, 6);
    expect(firstIn(states, 'sweep')).toBe(316);
    expect(states[315]).toMatchObject({ x: 392, y: 209, tx: 88, ty: 209 });
    expect(states[316]!.x).toBeCloseTo(389.5, 6);
    expect(states[316]!.dir).toBe(-1);
    expect(firstIn(states, 'climb')).toBe(438);
    expect(states[437]).toMatchObject({ x: 88, y: 209, tx: 88, ty: 72, side: -1 });
    expect(firstIn(states, 'lap', 437)).toBe(507);
    expect(states[506]).toMatchObject({ x: 88, y: 72, mode: 'lap', age: 0, side: -1 });
  });
});

describe('GDD-BOS-02 hits', () => {
  it('GDD-BOS-02 a hit leaves him hurt, the third defeats him', () => {
    const b = bossStart(DEF, 0);
    expect(hitBoss(b)).toMatchObject({ hits: 1, mode: 'hurt', age: 0 });
    expect(hitBoss({ ...b, hits: 1 })).toMatchObject({ hits: 2, mode: 'hurt', age: 0 });
    expect(hitBoss({ ...b, hits: 2 })).toMatchObject({ hits: 3, mode: 'defeated', age: 0 });
  });

  it('GDD-BOS-02 the hit that defeats him keeps where it hit him, a hurt hit does not change tx or ty', () => {
    const stuck: BossState = { ...bossStart(DEF, 2), mode: 'stuck', x: 232, y: 209, tx: 100, ty: 50 };
    expect(hitBoss(stuck)).toMatchObject({ mode: 'defeated', tx: 232, ty: 209 });
    expect(hitBoss({ ...stuck, x: 310, y: 150 })).toMatchObject({ mode: 'defeated', tx: 310, ty: 150 });
    expect(hitBoss({ ...stuck, hits: 0 })).toMatchObject({ mode: 'hurt', tx: 100, ty: 50 });
    expect(hitBoss({ ...stuck, hits: 1 })).toMatchObject({ mode: 'hurt', tx: 100, ty: 50 });
  });

  it('GDD-BOS-02 hurt for 1.0 s, still, then he climbs to the nearer end', () => {
    const hurt: BossState = { ...bossStart(DEF, 1), mode: 'hurt', age: 0, x: 300, y: 209 };
    const { states } = fly(hurt, 61);
    for (let i = 0; i < 59; i++) expect(states[i], `step ${i + 1}`).toMatchObject({ mode: 'hurt', x: 300, y: 209 });
    expect(states[59]).toMatchObject({ mode: 'climb', tx: 392, side: 1 });
  });

  it('GDD-BOS-02 defeated he falls 2 px a step to the floor and stays there', () => {
    const down: BossState = { ...bossStart(DEF, 3), mode: 'defeated', age: 0, x: 300, y: 150 };
    const { states } = fly(down, 60);
    expect(states[0]).toMatchObject({ x: 300, y: 152, age: 1, mode: 'defeated' });
    expect(states[59]).toMatchObject({ x: 300, y: 209, age: 60, mode: 'defeated' });
  });

  it('GDD-BOS-02 he harms in lap telegraph dive drop and sweep, and not stuck climbing hurt or defeated', () => {
    const harms: [BossMode, boolean][] = [['lap', true], ['telegraph', true], ['dive', true], ['drop', true], ['sweep', true], ['stuck', false], ['climb', false], ['hurt', false], ['defeated', false]];
    for (const [mode, expected] of harms) expect(bossHarms({ ...bossStart(DEF, 0), mode }), mode).toBe(expected);
  });

  it('GDD-BOS-02 a rock can hit him unless he is hurt or defeated', () => {
    for (const mode of ['lap', 'telegraph', 'dive', 'drop', 'sweep', 'stuck', 'climb'] as const) expect(bossHittable({ ...bossStart(DEF, 0), mode }), mode).toBe(true);
    for (const mode of ['hurt', 'defeated'] as const) expect(bossHittable({ ...bossStart(DEF, 0), mode }), mode).toBe(false);
  });

  it('GDD-BOS-02 the box he and his fruit hit is the hurtbox of Poncho, 10 by 30 in his body box', () => {
    // GDD-MOV-06: the hurtbox is 10 x 30, centred across the 12 x 32 body box standing on y.
    expect(ponchoBox(spawn(100, 224))).toEqual({ x0: 95, x1: 105, y0: 193, y1: 223 });
  });

  it('GDD-BOS-02 his box is 48 by 30 around his middle', () => {
    expect(bossBox({ ...bossStart(DEF, 0), x: 100, y: 50 })).toEqual({ x0: 76, x1: 124, y0: 35, y1: 65 });
  });

  it('GDD-BOS-02 a fruit is an 8 px square and a rock a 12 px square, standing on their y', () => {
    expect(fruitBox({ x: 316, y: 224, landed: true, age: 0 })).toEqual({ x0: 312, x1: 320, y0: 216, y1: 224 });
    expect(rockBox({ x: 56, y: 176, vx: 0, vy: 0, mode: 'rest', age: 0 })).toEqual({ x0: 50, x1: 62, y0: 164, y1: 176 });
  });
});

describe('GDD-BOS-02 cactus fruit', () => {
  const falling: Fruit = { x: 316, y: 200, landed: false, age: 0 };
  it('GDD-BOS-02 a fruit falls 2 px a step', () => {
    expect(stepFruit(falling, ARENA, 1)).toEqual({ x: 316, y: 202, landed: false, age: 0 });
  });

  it('GDD-BOS-02 a fruit bursts on the floor in phases 1 and 2', () => {
    const low = { ...falling, y: 223 };
    expect(stepFruit(low, ARENA, 1)).toBeNull();
    expect(stepFruit(low, ARENA, 2)).toBeNull();
  });

  it('GDD-BOS-02 in phase 3 a fruit lies on the floor for 3.0 s', () => {
    let f = stepFruit({ ...falling, y: 223 }, ARENA, 3);
    expect(f).toEqual({ x: 316, y: 224, landed: true, age: 0 });
    for (let i = 1; i < 180; i++) f = stepFruit(f!, ARENA, 3);
    expect(f).toEqual({ x: 316, y: 224, landed: true, age: 179 });
    expect(stepFruit(f!, ARENA, 3)).toBeNull();
  });
});

describe('GDD-BOS-02 rocks', () => {
  it('GDD-BOS-02 rocks start resting on their spots', () => {
    expect(freshRocks([{ x: 56, y: 176 }, { x: 424, y: 176 }])).toEqual([
      { x: 56, y: 176, vx: 0, vy: 0, mode: 'rest', age: 0 },
      { x: 424, y: 176, vx: 0, vy: 0, mode: 'rest', age: 0 },
    ]);
    expect(stepRock(rest(), { x: 56, y: 176 }, ARENA)).toEqual(rest());
  });

  it('GDD-BOS-02 a knocked rock flies the way the swipe faces, up, then falls and breaks on the floor', () => {
    expect(knock(rest(), 1)).toEqual({ x: 56, y: 176, vx: 90, vy: -150, mode: 'flying', age: 0 });
    expect(knock(rest(), -1)).toMatchObject({ vx: -90, vy: -150 });
    let r = knock(rest(), 1);
    for (let i = 0; i < 12; i++) r = stepRock(r, { x: 56, y: 176 }, ARENA);
    expect(r.mode).toBe('flying');
    expect(r.x).toBeCloseTo(74, 6);
    expect(r.y).toBeCloseTo(176, 6);
    for (let i = 12; i < 22; i++) r = stepRock(r, { x: 56, y: 176 }, ARENA);
    expect(r.mode).toBe('flying');
    expect(r.y).toBeCloseTo(221.8, 1);
    r = stepRock(r, { x: 56, y: 176 }, ARENA);
    expect(r).toMatchObject({ mode: 'gone', age: 0 });
    expect(r.x).toBeCloseTo(90.5, 6); // 23 steps at 1.5 px: about 35 px out from where it rested
  });

  it('GDD-BOS-02 a rock knocked back over its pillar breaks on the pillar top', () => {
    let r = knock(rest(), -1);
    for (let i = 0; i < 12; i++) r = stepRock(r, { x: 56, y: 176 }, ARENA);
    expect(r.mode).toBe('flying');
    r = stepRock(r, { x: 56, y: 176 }, ARENA);
    expect(r.mode).toBe('gone');
  });

  it('GDD-BOS-02 a rock that falls out of the level breaks', () => {
    const sky = parseTiles(Array<string>(17).fill('.'.repeat(30)));
    let r = knock(rest(), 1);
    let steps = 0;
    while (r.mode === 'flying' && steps < 200) {
      r = stepRock(r, { x: 56, y: 176 }, sky);
      steps++;
    }
    expect(r.mode).toBe('gone');
    expect(r.y - 12).toBeGreaterThan(17 * 16);
  });

  it('GDD-BOS-02 a broken rock is back on its spot 2.0 s later', () => {
    let r: RockState = { x: 90, y: 228, vx: 90, vy: 300, mode: 'gone', age: 0 };
    for (let i = 0; i < 119; i++) r = stepRock(r, { x: 56, y: 176 }, ARENA);
    expect(r).toMatchObject({ mode: 'gone', age: 119 });
    expect(stepRock(r, { x: 56, y: 176 }, ARENA)).toEqual(rest());
  });
});

/** He defeated at (x, y) facing `dir`, `age` steps after the hit (his own fall is not needed: the crown starts where the hit was). */
const defeatedAt = (x: number, y: number, dir: 1 | -1, age: number): BossState => ({ ...bossStart(DEF, 3), mode: 'defeated', x, y, tx: x, ty: y, dir, age });

const crownAt = (x: number, y: number, dir: 1 | -1, age: number) => bossCrown(DEF, defeatedAt(x, y, dir, age))!;

/** Every crown from the hit's step (age 0) to age `n`. */
const crowns = (x: number, y: number, dir: 1 | -1, n: number) => Array.from({ length: n + 1 }, (_, age) => crownAt(x, y, dir, age));

describe('GDD-BOS-02 his crown pops off', () => {

  it('GDD-BOS-02 there is a crown only while he is defeated', () => {
    for (const mode of ['lap', 'telegraph', 'dive', 'stuck', 'drop', 'sweep', 'climb', 'hurt'] as const) expect(bossCrown(DEF, { ...bossStart(DEF, 2), mode }), mode).toBeNull();
    expect(bossCrown(DEF, defeatedAt(232, 209, 1, 0))).not.toBeNull();
  });

  it('GDD-BOS-02 his crown starts at his head, 17 px to the side he faces and 12 px up from his middle', () => {
    expect(crownAt(232, 209, 1, 0)).toMatchObject({ x: 249, y: 197, resting: false });
    expect(crownAt(232, 209, -1, 0)).toMatchObject({ x: 215, y: 197, resting: false });
  });

  it('GDD-BOS-02 his crown rises first, 180 px/s up under 1800 px/s squared', () => {
    const c = crowns(232, 209, 1, 8);
    // y after k steps: 197 + sum of (-3 + 0.5 j) for j = 1..k; the apex, 7.5 px up, is on step 6.
    [194.5, 192.5, 191, 190, 189.5, 189.5].forEach((y, i) => expect(c[i + 1]!.y, `step ${i + 1}`).toBeCloseTo(y, 6));
    for (let a = 1; a <= 5; a++) expect(c[a]!.y, `step ${a}`).toBeLessThan(c[a - 1]!.y);
    expect(c[8]!.y).toBeGreaterThan(c[6]!.y);
  });

  it('GDD-BOS-02 his crown moves 45 px/s towards the arena\'s middle, rightwards from the middle itself', () => {
    expect(crownAt(232, 209, 1, 4).x).toBeCloseTo(249 + 3, 6); // hit at x 232, left of the middle 240: rightwards
    expect(crownAt(300, 209, 1, 4).x).toBeCloseTo(317 - 3, 6); // hit at x 300, right of it: leftwards, whichever way he faces
    expect(crownAt(300, 209, -1, 4).x).toBeCloseTo(283 - 3, 6);
    expect(crownAt(240, 209, -1, 4).x).toBeCloseTo(223 + 3, 6); // at the middle: rightwards
  });

  it('GDD-BOS-02 his crown lands on the floor, bounces once at 0.3 of its speed and rests, hit stuck at the start', () => {
    const c = crowns(232, 209, 1, 60);
    // Measured: it first reaches the floor (y 224) on its 18th step, at x 262.5, and rests on its 25th, at x 267.75, for good.
    expect(c.findIndex((k) => k.y === 224)).toBe(18);
    for (let a = 1; a < 18; a++) expect(c[a]!.y, `step ${a}`).toBeLessThan(224);
    expect(c[18]).toMatchObject({ y: 224, resting: false });
    expect(c[18]!.x).toBeCloseTo(262.5, 6);
    // After the bounce it goes up again: it lands at 360 px/s, 0.3 of that is 108 px/s up, which peaks 2.4 px above the floor.
    expect(Math.min(...c.slice(19, 25).map((k) => k.y))).toBeCloseTo(224 - 2.4, 6);
    for (let a = 19; a < 25; a++) expect(c[a]!.y, `step ${a}`).toBeLessThan(224);
    expect(c.findIndex((k) => k.resting)).toBe(25);
    expect(c[25]).toMatchObject({ y: 224, resting: true });
    expect(c[25]!.x).toBeCloseTo(267.75, 6);
    for (let a = 25; a <= 60; a++) expect(c[a], `step ${a}`).toEqual(c[25]);
  });

  it('GDD-BOS-02 his crown lands and rests the same way moving left from the right of the middle', () => {
    const c = crowns(300, 209, -1, 60);
    expect(c.findIndex((k) => k.y === 224)).toBe(18);
    expect(c[18]!.x).toBeCloseTo(269.5, 6);
    expect(c.findIndex((k) => k.resting)).toBe(25);
    expect(c[25]!.x).toBeCloseTo(264.25, 6);
    expect(c[60]).toEqual(c[25]);
  });

  it('GDD-BOS-02 hit in the air at y 150 his crown lands on its 25th step and rests on its 36th', () => {
    const c = crowns(232, 150, 1, 70);
    expect(c[0]).toMatchObject({ x: 249, y: 138 });
    expect(c.findIndex((k) => k.y === 224)).toBe(25);
    expect(c.findIndex((k) => k.resting)).toBe(36);
    expect(c[36]!.x).toBeCloseTo(276, 6);
  });

  it('GDD-BOS-02 from wherever he can be defeated his crown rests on the floor before the clear screen', () => {
    // The clear screen comes 60 steps after the hit (GDD-BOS-02, BOSS.defeatSteps). He can be hit from the top of his lap (y 56) down to
    // stuck on the floor (y 209), at the lap's ends (x 88, 392) or the middle, facing either way.
    let worst = 0;
    for (let y = 56; y <= 209; y++) {
      for (const x of [88, 240, 392]) {
        for (const dir of [1, -1] as const) {
          const restStep = crowns(x, y, dir, 70).findIndex((k) => k.resting);
          expect(restStep, `hit at ${x}, ${y}, facing ${dir}`).toBeGreaterThan(0);
          expect(restStep, `hit at ${x}, ${y}, facing ${dir}`).toBeLessThan(60);
          worst = Math.max(worst, restStep);
        }
      }
    }
    // The worst is the highest hit, at the top of his lap: it rests on its 49th step.
    expect(worst).toBe(49);
  });

  it('GDD-BOS-02 his crown shows its tilted frame on every other 4 steps while it is in the air, never at rest', () => {
    const c = crowns(232, 209, 1, 60);
    const air = c.slice(0, 25).map((k) => k.tilted);
    expect(air.slice(0, 12)).toEqual([false, false, false, false, true, true, true, true, false, false, false, false]);
    expect(air.slice(20, 25)).toEqual([true, true, true, true, false]); // steps 20 to 23 are the 6th block of 4, an odd one
    expect(air.filter(Boolean)).toHaveLength(12);
    for (let a = 25; a <= 60; a++) expect(c[a]!.tilted, `resting at ${a}`).toBe(false);
  });
});
