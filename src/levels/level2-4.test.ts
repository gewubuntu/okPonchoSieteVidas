import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ESTRELLA } from '../config/tuning';
import { awningTops } from '../sim/awning';
import { isBossLevel } from '../sim/bossLevel';
import { clawBox } from '../sim/claw';
import { overlaps } from '../sim/enemy';
import { aimAt, bumps, estrellaBox, estrellaStart, moveEstrella, surfaceUnder, type EstrellaState } from '../sim/estrella';
import { hurtbox } from '../sim/hazards';
import { spawn, type PlayerInput } from '../sim/movement';
import { medal } from '../sim/results';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { estrellaFrameInfo, estrellaPose } from '../ui/estrellaPose';
import { LEVEL_2_4, LEVEL_2_4_AWNINGS, LEVEL_2_4_CORDELES } from './level2-4';
import { LEVELS, levelById } from './index';
import { gaps, validateLevel } from './validate';

// GDD-BOS-03: the arena 2-4 and La Estrella's fight in it, measured over the real level data and `stepRun` (L-003, L-014). Expected
// values come from the GDD's numbers: the floor's top at y = 224, awnings' tops at 176 (x 48 to 112, 208 to 272, 368 to 432), cordeles'
// tops at 136 (x 112 to 208, 272 to 368), her box 32 x 32 px with its bottom at 40 high, 112 low in phase 1 and 72 in phases 2 and 3.
const world = LEVEL_2_4.world;
const DEF = LEVEL_2_4.estrella!;
const STILL: PlayerInput = { move: 0, jumpHeld: false };
const JUMP: PlayerInput = { move: 0, jumpHeld: true };
/** Long enough to outlast any test: her touches and her tejocotes cannot cost him a life, so only the hits on her are measured. */
const UNHURT = 1e6;

/** A run of 2-4 with Poncho standing at (x, y) facing `facing`, and her as given. */
const standing = (x: number, y: number, estrella: EstrellaState = estrellaStart(DEF, 0), facing: 1 | -1 = 1): RunState => ({ ...startRun(LEVEL_2_4), player: { ...spawn(x, y), grounded: true, facing }, estrella });
function play(run: RunState, n: number, input: (i: number) => PlayerInput = () => STILL, level: Level = LEVEL_2_4): RunState {
  let r = run;
  for (let i = 1; i <= n; i++) r = stepRun(r, input(i), level);
  return r;
}

/** A fresh run of 2-4 with `lives` left. */
const withLives = (lives: number): RunState => ({ ...startRun(LEVEL_2_4), lives: { lives, used: new Set<string>() } });
/** Whether Poncho standing at x on an awning top loses a life in her first 1000 steps of phase 1. */
const lostOnAwning = (x: number): boolean => play(standing(x, 176, estrellaStart(DEF, 0)), 1000).lives.lives < 7;

/** Whether Poncho standing still on the floor at x loses a life to her drop in phase 3 from `estrella` with these awnings gone, and her mode and drop target on the step that costs it. */
function dropReaches(x: number, estrella: EstrellaState, gone: boolean[]): { lives: number; mode: string; tx: number } {
  let run: RunState = { ...standing(x, 224, estrella), awningsGone: gone };
  let mode = '';
  for (let i = 0; i < 600 && run.lives.lives === 7; i++) {
    mode = run.estrella!.mode;
    run = stepRun(run, STILL, LEVEL_2_4);
  }
  return { lives: run.lives.lives, mode, tx: run.estrella!.tx };
}

describe('GDD-BOS-03 level 2-4', () => {
  it('GDD-BOS-03 2-4 is 30 by 17 tiles, World 2 last level after 2-3, a boss level the validator passes', () => {
    expect([world.width, world.height]).toEqual([30, 17]);
    const entry = LEVELS.find((e) => e.id === '2-4')!;
    expect(entry).toMatchObject({ world: 2, test: false });
    expect(entry.level).toBe(LEVEL_2_4);
    expect(entry.next).toBeUndefined();
    expect(levelById('2-3')!.next).toBe('2-4');
    expect(entry.tips).toBeUndefined();
    expect(isBossLevel(LEVEL_2_4)).toBe(true);
    expect(validateLevel(entry)).toEqual([]);
  });

  it('GDD-BOS-03 2-4 has a flat floor at row 14 across the whole width, no pit and no other solid tile', () => {
    for (let c = 0; c < 30; c++) for (let r = 0; r < 17; r++) expect(world.solidTile(c, r), `${c},${r}`).toBe(r >= 14);
    expect(gaps(world)).toEqual([]);
  });

  it('GDD-BOS-03 2-4 has three whole awnings and two cordeles end to end, its spawn, La Estrella, and nothing else', () => {
    expect(LEVEL_2_4.awnings).toBe(LEVEL_2_4_AWNINGS);
    expect(LEVEL_2_4_AWNINGS).toEqual([
      { x: 48, y: 176, w: 64 },
      { x: 208, y: 176, w: 64 },
      { x: 368, y: 176, w: 64 },
    ]);
    expect(LEVEL_2_4.cordeles).toBe(LEVEL_2_4_CORDELES);
    expect(LEVEL_2_4_CORDELES).toEqual([
      { x: 112, y: 136, w: 96 },
      { x: 272, y: 136, w: 96 },
    ]);
    expect(LEVEL_2_4.spawn).toEqual({ x: 240, y: 224 });
    expect(DEF).toEqual({ floor: 224, spots: [[400, 80], [320, 160], [400]], tear: { x: 240, y: 176, awning: 1 } });
    for (const empty of ['ofrendas', 'spikes', 'crumbles', 'springs', 'platforms', 'tacos', 'pinatas', 'doors', 'keys', 'fragiles', 'enemies'] as const) expect(LEVEL_2_4[empty], empty).toEqual([]);
    for (const none of ['exit', 'hilos', 'veladora', 'blocks', 'abilities', 'boss', 'rocks', 'rollos'] as const) expect(LEVEL_2_4[none], none).toBeUndefined();
  });

  it('GDD-BOS-03 the tear is the middle awning: its middle across and its top', () => {
    const middle = LEVEL_2_4_AWNINGS[1]!;
    expect(middle.x + middle.w / 2).toBe(240);
    expect(middle.y).toBe(176);
    expect(DEF.tear).toEqual({ x: 240, y: 176, awning: 1 });
  });

  it('GDD-BOS-03 her box middle starts each phase 256, 215 and 256 px from the spawn, over 3 tiles', () => {
    const d = [0, 1, 2].map((hits) => {
      const s = estrellaStart(DEF, hits);
      return Math.floor(Math.hypot(s.x - 240, s.y - ESTRELLA.height / 2 - 224));
    });
    expect(d).toEqual([256, 215, 256]);
  });

  it('GDD-PRG-03 in 2-4, which has no hilos, the medal is gold with at most 3 lives lost, else silver', () => {
    expect([4, 3, 1].map((l) => medal(withLives(l), LEVEL_2_4))).toEqual(['gold', 'silver', 'silver']);
  });
});

describe('GDD-BOS-03 2-4 measured', () => {
  it('GDD-BOS-03 from the spawn a full jump rises through the middle awning and lands on it; held through the landing it rebounds', () => {
    // Jump held 24 steps (past the apex, feet at 167.6, above the awning's 176) and let go: a plain landing on the awning.
    let run = play(standing(240, 224), 60, (i) => ({ ...STILL, jumpHeld: i <= 24 }));
    expect(run.player).toMatchObject({ grounded: true, y: 176 });
    run = play(standing(240, 224), 60, () => JUMP);
    expect(run.awningBounce).toMatchObject({ awning: 1, tier: 1 });
  });

  it('GDD-BOS-03 the head peaks through the run, on the real awnings and cordeles', () => {
    // Without her, jump held all the way: each rise's highest hurtbox top until the next landing or rebound. From the left awning a jump,
    // then the held rebounds of tiers 1 to 3; from the left cordel a jump; from the floor under it a jump. He is first dropped from 1 px
    // above the surface and stands on it, so the surface is the level's own.
    const { estrella: _e, ...bare } = LEVEL_2_4;
    const peaks = (x: number, y: number, rises: number): number[] => {
      let run = play({ ...startRun(bare), player: { ...spawn(x, y - 1), grounded: false } }, 10, () => STILL, bare);
      expect(run.player, `standing at ${x}, ${y}`).toMatchObject({ grounded: true, y });
      const out: number[] = [];
      let top = Infinity;
      for (let i = 0; i < 400 && out.length < rises; i++) {
        const before = run;
        run = stepRun(run, JUMP, bare);
        top = Math.min(top, hurtbox(run.player).y);
        if (i > 2 && (run.player.grounded || run.awningBounce !== before.awningBounce)) {
          out.push(Math.round(top * 100) / 100);
          top = Infinity;
        }
      }
      return out;
    };
    expect(peaks(80, 176, 4)).toEqual([88.56, 67.92, 47.73, 24.79]);
    expect(peaks(160, 136, 1)).toEqual([48.56]);
    expect(peaks(160, 224, 1)).toEqual([136.56]);
  });

  it('GDD-BOS-03 every drop follows 30 steps of telegraph high on the cable and falls for at least 23 steps', () => {
    for (const hits of [0, 1, 2]) {
      for (const x of [80, 160, 240]) {
        let run: RunState = { ...standing(x, 224, estrellaStart(DEF, hits)), invulnerable: UNHURT };
        const states: EstrellaState[] = [];
        for (let i = 0; i < 1500; i++) {
          run = stepRun(run, STILL, LEVEL_2_4);
          states.push(run.estrella!);
        }
        const drops = states.flatMap((s, i) => (s.mode === 'drop' && s.age === 0 ? [i] : []));
        expect(drops.length, `phase ${hits + 1} x ${x}`).toBeGreaterThanOrEqual(3);
        for (const i of drops) {
          expect(states.slice(i - 30, i).every((s) => s.mode === 'telegraph' && s.y === 40), `phase ${hits + 1} step ${i + 1}`).toBe(true);
          expect(states[i - 31]!.mode).not.toBe('telegraph');
          const end = states.findIndex((s, j) => j > i && s.mode !== 'drop');
          if (end < 0) continue;
          expect(end - i, `phase ${hits + 1} step ${i + 1}`).toBeGreaterThanOrEqual(23);
        }
      }
    }
  });

  it('GDD-BOS-03 in phases 1 and 2 nothing of hers reaches a Poncho standing on a side awning outer end', () => {
    for (const hits of [0, 1]) {
      for (const x of [43, 50, 58, 422, 430, 437]) {
        const run = play(standing(x, 176, estrellaStart(DEF, hits), x < 240 ? 1 : -1), 1000);
        expect(run.lives.lives, `phase ${hits + 1} x ${x}`).toBe(7);
      }
    }
  });

  it('GDD-BOS-03 her phase 1 drop onto an awning reaches him at x 60 and 420, not at 58 and 422', () => {
    // Her box over the left awning spans 64 to 96, over the right one 384 to 416; his hurtbox is 10 px wide.
    expect([58, 60, 420, 422].map(lostOnAwning)).toEqual([false, true, true, false]);
  });

  it('GDD-BOS-03 in phase 3 an awning is no shelter: before the tear, standing still under the middle awning, her tear drop reaches him', () => {
    expect(dropReaches(240, estrellaStart(DEF, 2), [false, false, false])).toEqual({ lives: 6, mode: 'drop', tx: 240 });
  });

  it('GDD-BOS-03 in phase 3 an awning is no shelter: after the tear, standing still under a side awning she aims at, her drop reaches him', () => {
    for (const x of [80, 400]) {
      expect(dropReaches(x, estrellaStart(DEF, 2, true), [false, true, false]), `x ${x}`).toEqual({ lives: 6, mode: 'drop', tx: x });
    }
  });

  it('GDD-BOS-03 the tear: untorn, standing under a side awning she does not aim at, her first drop does not reach him', () => {
    // Her first drop is at x 240 whoever stands where: at x 80 the first thing to reach him is the tejocotes rolling out of her thud.
    const out = dropReaches(80, estrellaStart(DEF, 2), [false, false, false]);
    expect(out).toMatchObject({ lives: 6 });
    expect(out.mode).not.toBe('drop');
  });

  it('GDD-BOS-03 her box stays on screen and under the cable, and never ends a drop inside a tile, wherever she aims', () => {
    const awnings = awningTops(LEVEL_2_4_AWNINGS, [false, false, false]);
    // The tear's drop too, at x 240 down to the floor, and every aimed drop after it.
    for (const tx of [DEF.tear.x, ...Array.from({ length: 481 }, (_, x) => aimAt(spawn(x, 224)))]) {
      const bottom = surfaceUnder(DEF, awnings, tx);
      const box = estrellaBox({ ...estrellaStart(DEF, 2), x: tx, y: bottom });
      // Swaying 16 px either way as she hangs.
      expect(box.x0 - ESTRELLA.swayPx[2], `aim at ${tx}`).toBeGreaterThanOrEqual(0);
      expect(box.x1 + ESTRELLA.swayPx[2], `aim at ${tx}`).toBeLessThanOrEqual(480);
      expect(bottom === 224 || bottom === 176, `aim at ${tx}`).toBe(true);
      for (let c = Math.floor(box.x0 / 16); c * 16 < box.x1; c++) for (let r = Math.floor(box.y0 / 16); r * 16 < box.y1; r++) expect(world.solidTile(c, r), `aim at ${tx}`).toBe(false);
    }
    for (const hits of [0, 1, 2]) expect(estrellaBox(estrellaStart(DEF, hits)).y0).toBe(ESTRELLA.cableY);
  });
});

/** Steps a run of 2-4 from `run` with `input(j)` until his first landing or awning rebound (or 80 steps); whether it hit her, and whether her bottom was crossed by a rise from below or overlapped by the claw (so the case could have hit her). */
function branch(run: RunState, input: (j: number) => PlayerInput): { hit: boolean; reached: boolean } {
  let r = run;
  let reached = false;
  for (let j = 0; j < 80; j++) {
    const before = r;
    r = { ...stepRun(r, input(j), LEVEL_2_4), invulnerable: UNHURT };
    const e = r.estrella!;
    if (e.hits > before.estrella!.hits) return { hit: true, reached: true };
    const box = clawBox(r.player, r.claw);
    if (bumps(before.player, r.player, e) || (box !== null && overlaps(box, estrellaBox(e)))) reached = true;
    if (j > 2 && (r.player.grounded || r.awningBounce !== before.awningBounce)) break;
  }
  return { hit: false, reached };
}

describe('GDD-BOS-03 only awning rebounds and cordel jumps reach her (user, 2026-11-04)', () => {
  it('GDD-BOS-03 a claw from the floor at x 133 while she rests and rises at x 160 in phase 2 does not hit her', () => {
    // Phase 2 from its start: she thuds on the floor at x 160 on step 163, rests 18 steps and rises; his claw box (139 to 159) reaches her
    // box (144 to 176) while it is low.
    const snaps: RunState[] = [];
    let run: RunState = { ...standing(133, 224, estrellaStart(DEF, 1)), invulnerable: UNHURT };
    for (let k = 0; k <= 200; k++) {
      snaps.push(run);
      run = { ...stepRun(run, STILL, LEVEL_2_4), invulnerable: UNHURT };
    }
    const reached: number[] = [];
    for (let k = 160; k <= 200; k++) {
      const out = branch(snaps[k]!, (j) => ({ ...STILL, claw: j === 0 }));
      expect(out.hit, `claw on step ${k + 1}`).toBe(false);
      if (out.reached) reached.push(k + 1);
    }
    expect([reached[0], reached[reached.length - 1]]).toEqual([161, 194]);
  });

  it('GDD-BOS-03 a jump from the floor under her as she rises in phase 2 does not hit her', () => {
    const snaps: RunState[] = [];
    let run: RunState = { ...standing(160, 224, estrellaStart(DEF, 1)), invulnerable: UNHURT };
    for (let k = 0; k <= 215; k++) {
      snaps.push(run);
      run = { ...stepRun(run, STILL, LEVEL_2_4), invulnerable: UNHURT };
    }
    const reached: number[] = [];
    for (let k = 180; k <= 215; k++) {
      const out = branch(snaps[k]!, () => JUMP);
      expect(out.hit, `jump on step ${k + 1}`).toBe(false);
      if (out.reached) reached.push(k + 1);
    }
    expect([reached[0], reached[reached.length - 1]]).toEqual([197, 211]);
  });

  it('GDD-BOS-03 in no phase does a jump, a claw or a jump and claw from the floor hit her', () => {
    // Poncho waits on the floor at x0 (her phase 3 aims at him there): under the left awning, under the left cordel, at the spawn. From
    // every other step of her first 900, a jump held up to its landing (straight, or moving towards her), a claw towards her, or a jump with
    // a claw at its top, from her middle across and 12 px either side of it.
    let reachedAny = 0;
    for (const hits of [0, 1, 2]) {
      for (const x0 of [80, 160, 240]) {
        let run: RunState = { ...standing(x0, 224, estrellaStart(DEF, hits)), invulnerable: UNHURT };
        for (let k = 0; k < 900; k++) {
          if (k % 2 === 0 && run.estrella!.mode !== 'hurt') {
            const ex = run.estrella!.x;
            for (const dx of [-12, 0, 12]) {
              const x = Math.max(8, Math.min(472, ex + dx));
              const face: 1 | -1 = dx > 0 ? -1 : 1;
              const from = { ...run, player: { ...spawn(x, 224), grounded: true, facing: face } };
              const cases: ((j: number) => PlayerInput)[] = [
                () => JUMP,
                () => ({ move: -face, jumpHeld: true }),
                (j) => ({ ...STILL, claw: j === 0 }),
                (j) => ({ ...JUMP, claw: j === 14 }),
              ];
              for (const input of cases) {
                const out = branch(from, input);
                expect(out.hit, `phase ${hits + 1} x0 ${x0} step ${k + 1} x ${x}`).toBe(false);
                if (out.reached) reachedAny++;
              }
            }
          }
          run = { ...stepRun(run, STILL, LEVEL_2_4), invulnerable: UNHURT };
        }
      }
    }
    // The cases do reach her box, low in her drops, bounces, rests and rises: they would hit her there.
    expect(reachedAny).toBeGreaterThan(100);
  }, 60_000);
});

/**
 * A bot for 2-4 (GDD-BOS-03), reading her state each step. Phase 1: it walks from the spawn to the floor under the left awning (x 80);
 * when she hangs over it, a floor jump held through its landing on the awning: the tier 1 rebound bumps her. Phase 2: from the left
 * awning it jumps right onto the left cordel and stands at x 127, clear of her drop at 160; when she hangs, it steps under the middle of
 * her sway and a cordel jump bumps her. Phase 3: her first drop is the tear, at x 240 whatever he does, and takes the middle awning away; he
 * stays on the left cordel, clear of her line, and waits at its right end (x 205); once she hangs and her sway brings her within 21 px
 * across, a cordel jump bumps her. It lets go of jump for a step before
 * pressing it again (L-048).
 */
function bot(level: Level, maxSteps: number, each: (run: RunState) => void = () => {}): { run: RunState; steps: number; hitsAt: number[] } {
  let run = startRun(level);
  let steps = 0;
  let held = false;
  const hitsAt: number[] = [];
  while (run.phase !== 'clear' && steps < maxSteps) {
    each(run);
    const { x, y, grounded } = run.player;
    const e = run.estrella!;
    const floor = grounded && y === 224;
    let target = x;
    let jump = false;
    // How near the target it lets go of the run button: from a run it slides about 7 px to a stop.
    let near = 2;
    if (run.phase === 'playing' && e.mode !== 'defeated') {
      if (e.hits === 1) {
        if (grounded && y === 136) {
          target = e.mode === 'hang' ? e.tx : 127;
          jump = e.mode === 'hang' && Math.abs(x - e.tx) < 3;
        } else if (grounded && y === 176) {
          target = 140;
          jump = x >= 100;
        } else if (floor) {
          target = 80;
          jump = Math.abs(x - 80) < 3;
        } else {
          target = 127;
          // Let go at the top, so the landing on the cordel is a plain one.
          jump = held && run.player.vy < 0;
        }
      } else if (e.hits === 0) {
        if (floor) {
          target = e.mode === 'hang' ? e.tx : 80;
          jump = e.mode === 'hang' && e.tx < 112 && Math.abs(x - e.tx) < 3;
        } else {
          target = e.tx;
          jump = held;
        }
      } else {
        // Phase 3: he stays on the left cordel (x 112 to 208), clear of her tear drop at x 240 (her box 224 to 256), and waits at its right
        // end, x 205. Once she hangs and her sway brings her within 21 px across (a bump needs under 22), a cordel jump bumps her.
        if (!grounded) jump = held && run.player.vy < 0;
        else {
          target = 205;
          jump = e.mode === 'hang' && y === 136 && Math.abs(e.x - x) < 21;
        }
      }
    }
    const move = Math.abs(target - x) < near ? 0 : Math.sign(target - x);
    // A new press only after a step with jump up (L-048).
    if (jump && !held && run.player.jumpWasHeld) jump = false;
    held = jump;
    const before = run;
    run = stepRun(run, { move, jumpHeld: jump }, level);
    steps++;
    if (run.estrella!.hits > before.estrella!.hits) {
      hitsAt.push(steps);
      held = false;
    }
  }
  return { run, steps, hitsAt };
}

describe('GDD-BOS-03 playing 2-4', () => {
  it('GDD-BOS-03 2-4 can be won from the spawn with all seven lives in under 1800 steps', () => {
    const { run, steps, hitsAt } = bot(LEVEL_2_4, 1800);
    expect(run.phase).toBe('clear');
    expect(steps).toBeLessThan(1800);
    expect(run.lives.lives).toBe(7);
    expect(run.estrella).toMatchObject({ hits: 3, mode: 'defeated', tore: true });
    // She tore the middle awning away on her way, and it stays gone.
    expect(run.awningsGone).toEqual([false, true, false]);
    // Measured: the hits on steps 344, 663 and 975, the clear 60 steps after the third.
    expect(hitsAt).toEqual([344, 663, 975]);
    expect(steps).toBe(1035);
  });
});

// L-059: how far each frame of assets/sprites/boss/la-estrella.png reaches below her box, in game px, as the design measured it
// (scripts/art/estrella-approved/report.json; scripts/art/estrella.test.mjs pins the art to it), over the real fight.
interface ReachRow {
  look: string;
  hits: number;
  below: number;
}
function reachRows(text: string): ReachRow[] {
  const table: { reach: ReachRow[] } = JSON.parse(text);
  return table.reach;
}
const BELOW = new Map(reachRows(readFileSync(new URL('../../scripts/art/estrella-approved/report.json', import.meta.url), 'utf8')).map((r) => [`${r.look}-${r.hits}`, r.below]));
/** The look without its flash or its side: 'telegraphLRed' is a telegraph, 'hangL' a hang. */
const kind = (look: string): string => look.replace(/(Red|White)$/, '').replace(/[LR]$/, '');

/**
 * How far the frame she is drawn with at this step reaches into the room under her, in game px (negative: clear of it). The room is the floor,
 * the awning she is dropping onto, or the one she is thrown up from (she tears through the awnings in phase 3 and her pot falls through them).
 */
function intrusion(run: RunState): { look: string; px: number } {
  const e = run.estrella!;
  const pose = estrellaPose(e, run.player, DEF);
  const info = estrellaFrameInfo(pose.frame);
  const below = BELOW.get(`${info.look}-${info.hits}`)!;
  const surface = e.mode === 'drop' ? e.ty : e.mode === 'bounce' ? surfaceUnder(DEF, awningTops(LEVEL_2_4_AWNINGS, run.awningsGone), e.x) : DEF.floor;
  return { look: info.look, px: e.y + below - surface };
}

describe('GDD-BOS-03 her frames over the real 2-4 fight (L-059)', () => {
  it('GDD-BOS-03 through the whole fight no frame of hers reaches below the floor or into the awning she lands on, and every look is posed', () => {
    const looks = new Set<string>();
    let worst = -Infinity;
    // Her three landings (drops onto the awning in phase 1, thuds on the floor in phases 2 and 3) and every step round them are in this run.
    const { run } = bot(LEVEL_2_4, 1800, (r) => {
      const { look, px } = intrusion(r);
      looks.add(kind(look));
      worst = Math.max(worst, px);
    });
    expect(run.phase).toBe('clear');
    expect(worst).toBeLessThanOrEqual(0);
    // The fight shows each of these; defeated she is checked below.
    expect(looks).toEqual(new Set(['glide', 'telegraph', 'drop', 'land', 'bounce', 'rest', 'rise', 'hang', 'yank', 'hurt', 'fall']));
  });

  it('GDD-BOS-03 the check is not empty: her in-air looks do come within 14 px of a surface (the landing look keeps the rest of the frame off it)', () => {
    // Her drops, in the 14 px above the surface, show the splayed look (reach 0 below), not the drop's 11 px.
    const near: string[] = [];
    bot(LEVEL_2_4, 1800, (r) => {
      const e = r.estrella!;
      if (e.mode === 'drop' && e.ty - e.y <= 14) near.push(intrusion(r).look);
    });
    expect(near.length).toBeGreaterThan(0);
    expect(new Set(near)).toEqual(new Set(['rest']));
  });

  it('GDD-BOS-03 defeated from any height she can be hit at, her pot falls and lies on the floor, no frame below it', () => {
    const awnings = awningTops(LEVEL_2_4_AWNINGS, [false, true, false]);
    for (const y0 of [40, 41, 55, 72, 90, 111, 112]) {
      let e: EstrellaState = { ...estrellaStart(DEF, 2), hits: 3, mode: 'defeated', age: 0, x: 240, y: y0 };
      const looks: string[] = [];
      for (let i = 0; i < 100; i++) {
        const { look, px } = intrusion({ ...startRun(LEVEL_2_4), estrella: e });
        expect(px, `y0 ${y0} step ${i} ${look}`).toBeLessThanOrEqual(0);
        looks.push(kind(look));
        e = moveEstrella(DEF, e, spawn(240, 224), awnings).estrella;
      }
      expect(new Set(looks), `y0 ${y0}`).toEqual(new Set(['fall', 'lie']));
      expect(looks[0]).toBe('fall');
      expect(looks[99]).toBe('lie');
    }
  });
});
