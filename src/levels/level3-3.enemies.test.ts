import { describe, expect, it } from 'vitest';
import { CACOMIXTLE, CART, HITBOX, RUN, TILE, ZOPILOTE } from '../config/tuning';
import { centre, enemyBox, enemyPhase } from '../sim/enemy';
import { touchesOfrenda, type Level } from '../sim/run';
import { stepRun, type RunState } from '../sim/run';
import {
  apart,
  at,
  atT,
  causeOf,
  cartOf,
  clocks,
  drive,
  type Drive,
  E,
  fly,
  idle,
  idleRun,
  jumpFrom,
  jumper,
  L,
  landedAs,
  last,
  mid,
  onA,
  onP5,
  play,
  railOf,
  right,
  ringtail,
  runsOf,
  standing,
  tag,
  tookOf,
  underBat,
  waited,
  whereIs,
  withParked,
  Y,
  zopilote,
  type Name,
} from './level3-3.drive';
import { idlePeriods } from './sightSweep';

// GDD-WLD-18, phase B1: level 3-3's enemies driven over their clocks (L-014), the Cacomixtles with their ringtails riding. Every expected number
// is what the real `stepRun` gives on the real level with every enemy in it (L-003); where GDD-WLD-18 names a figure, the comment says "GDD says"
// and where a drive contradicts a sentence of it the test pins what happens and says so, the layout left as it is. The level is registered after 3-2 (`src/levels/index.ts`).

/** Enemy `i`'s state at clock `t` as `idlePeriods` reads it, with the box one step on too, so a bat going the other way is another state. */
function periodState(t: number, i: number): string {
  const [now, next] = [idleRun(t), idleRun(t + 1)];
  const box = (r: RunState) => Object.values(enemyBox(L.enemies[i]!, r.enemies[i]!)).map((v) => Math.round(v * 1e4) / 1e4);
  return JSON.stringify([box(now), box(next), enemyPhase(now.enemies[i]!), now.enemies[i]!.dir]);
}

describe('GDD-WLD-18 level 3-3 the enemies, their clocks', () => {
  it('GDD-WLD-18 3-3 each enemy comes round to its own state after an idle period: six of the eight clocks the sight sweep reads, two longer', () => {
    // The sight sweep's `idlePeriods` (an enemy's box, phase and heading come round) counts the three Cacomixtles' 1 (waiting), the Armadillo's 1,058
    // steps, the bats' 120 and, for the Zopilote, its cap (3,000): not a period. Two of them are not the enemy's own: a row bat (`rx` 0) is at its
    // middle again after 120 steps but going the other way (its loop is 240), and the Zopilote's cruise (288 steps there and back) and its bob (150)
    // come round together after 7,200. Compared here with the box one step on too, so a bat going the other way is another state.
    expect(idlePeriods(L)).toEqual([1, 1, 1, 1058, 120, 120, 120, 3000]);
    const periods = L.enemies.map((_, i) => {
      for (let t = 1; t <= 8000; t++) if (periodState(t, i) === periodState(0, i)) return t;
      return -1;
    });
    expect(periods).toEqual([1, 1, 1, 1058, 240, 240, 240, 7200]);
    // Every clock: start times at most 6 apart over a whole period, one for a period of 1.
    expect(periods.map((p) => clocks(p).length)).toEqual([1, 1, 1, 177, 40, 40, 40, 1200]);
    expect(clocks(7200).at(-1)).toBe(7194);
  }, 60_000);
});

/** Poncho standing at (x, y) on step 0, the enemies at clock 0: the run after that step (his hurtbox centre is what a ringtail sees). */
const wokenAt = (x: number, y: number): RunState => stepRun(at(x, y), idle, L);

describe('GDD-WLD-18 level 3-3 the Cacomixtles woken, the first flash to the place GDD-WLD-18 names', () => {
  it('GDD-WLD-18 3-3 each ringtail wakes from the edge of its sight, and its cart enters 99, 88 and 82 steps after the first flash with the ringtail riding', () => {
    // K1 (R2, rolling left): its cart's middle starts at 928, so it sees his hurtbox's centre in x from 728 (200 px ahead, CACOMIXTLE.sightX) up
    // to 928; K2's (R5) at 2848, from 2648; K3's (R6) at 3152, from 2952. 0.1 px short of it nothing wakes.
    const wake = [[E.K1, 728, Y(26)], [E.K2, 2648, Y(25)], [E.K3, 2952, Y(25)]] as const;
    for (const [i, x, y] of wake) {
      expect(wokenAt(x, y).enemies[i]!.ride, `${i} at ${x}`).toEqual({ phase: 'telegraph', t: 1 });
      expect(wokenAt(x - 0.1, y).enemies[i]!.ride, `${i} at ${x - 0.1}`).toEqual({ phase: 'waiting', t: 0 });
    }
    expect(wake.map(([i]) => L.enemies[i]!.x - CACOMIXTLE.sightX)).toEqual([728, 2648, 2952]);
    // From the first flash (the state with t = 1) to the step on which the cart's front edge is in the column GDD-WLD-18 names (K1's 46 on P1, K2's
    // pier at 167, K3's 187): the ringtail woken by him standing at the edge of its sight, he then stepped away to a place its cart never comes to
    // so that it rolls to its buffer. Counting the flash step as the first, the cart alone plus the telegraph's 30 steps gave 99, 88 and 82.
    const away: Partial<Record<Name, number>> = { R2: 650, R5: 2456, R6: 3240 };
    const reach: readonly (readonly [Name, number, number, number, number])[] = [['R2', E.K1, 728, Y(26), 46], ['R5', E.K2, 2648, Y(25), 167], ['R6', E.K3, 2952, Y(25), 187]];
    const got = reach.map(([name, i, x, y, col]) => {
      const rail = railOf(name);
      const flash = wokenAt(x, y);
      const states = [flash, ...play({ ...flash, player: standing(away[name]!, name === 'R6' ? Y(17) : y) }, 300, () => idle)];
      const front = (r: RunState) => rail.x + rail.dir * (r.carts[cartOf(name)]!.m + CART.width / 2);
      const entered = states.findIndex((r) => front(r) < (col + 1) * TILE);
      // The cart rolls on its 31st step from the flash state, and nothing else of it is moved by him: he lives, the ringtail rides.
      const rolling = states.findIndex((r) => r.carts[cartOf(name)]!.phase === 'rolling');
      return { name, entered: entered + 1, rolling, lives: states[entered]!.lives.lives, ride: states[entered]!.enemies[i]!.ride, flash: states[0]!.enemies[i]!.ride };
    });
    // 1.65 s, 1.47 s and 1.37 s after the first flash, as GDD-WLD-18 gives them; 99 = the 98 steps after the flash state, and the flash step.
    expect(got).toEqual([
      { name: 'R2', entered: 99, rolling: 29, lives: 7, ride: { phase: 'riding', t: 0 }, flash: { phase: 'telegraph', t: 1 } },
      { name: 'R5', entered: 88, rolling: 29, lives: 7, ride: { phase: 'riding', t: 0 }, flash: { phase: 'telegraph', t: 1 } },
      { name: 'R6', entered: 82, rolling: 29, lives: 7, ride: { phase: 'riding', t: 0 }, flash: { phase: 'telegraph', t: 1 } },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// K1 on P1.

/** The take-off steps `ks` (from `k0`) whose tags are `label`, as "first-last (n)", with a gap shown as two runs. */
function window(tags: readonly string[], label: string, k0: number): string {
  const runs = runsOf(tags, k0).filter((r) => r.slice(r.indexOf(' ') + 1) === label);
  const count = tags.filter((t) => t === label).length;
  return runs.length === 0 ? `${label} none` : `${label} ${runs.map((r) => r.slice(0, r.indexOf(' '))).join(',')} (${count})`;
}

/** K1's ringtail has parked and 30 steps more have gone, a life is lost, or 500 steps. */
const k1Done = () => {
  let parked = -1;
  return (r: RunState, i: number) => {
    if (parked < 0 && ringtail(r, E.K1).ride!.phase === 'parked') parked = i;
    return parked >= 0 && i >= parked + 30;
  };
};

/**
 * From P1 at x = 650 standing, K1 waiting (as phase A2's walk out of C1 leaves him): right held until his middle is at `x` (a stopping distance
 * short of it when `way` is 'stand', then nothing held until he stands still): the take-off state.
 */
function approach(x: number, way: 'walk' | 'stand'): { from: RunState; lost: boolean; cause: string } {
  const brake = way === 'stand' ? RUN.maxSpeed ** 2 / (2 * RUN.groundDecel) : 0;
  const d = drive(at(650, Y(26)), 400, (r) => (r.player.x < x - brake ? right : idle), (r) => r.player.x >= x - brake && (way === 'walk' || r.player.vx === 0));
  return { from: d.lost ? last(d.states) : d.states.length > 0 ? last(d.states) : at(650, Y(26)), lost: d.lost, cause: d.cause };
}

describe('GDD-WLD-18 level 3-3 K1 on P1, the answers driven with the ringtail riding', () => {
  it('GDD-WLD-18 3-3 K1: the jump back onto the perch, the cart jumped held and plain, the ringtail stomped and standing still, from where it wakes to 3 tiles on', () => {
    const rows: string[] = [];
    const cps = new Set<number>();
    const parks = new Set<number>();
    for (const way of ['walk', 'stand'] as const) {
      // Walking, the cart is met at x = 845 (a walk with right held and no jump is hit there on step 103, K1 at 860 on the slope): the take-offs go on from
      // 3 tiles past the wake to 3 tiles past that point, 51 of them; the last 15 are past where he is hit and cannot be walked to.
      for (let n = 0; n <= (way === 'walk' ? 51 : 15); n++) {
        const x = 728 + n * 3.2;
        const { from, lost: onTheWay, cause } = approach(x, way);
        if (onTheWay) {
          rows.push(`${way} ${x.toFixed(1)} lost ${cause} on the way`);
          continue;
        }
        // K1 has begun its telegraph by the take-off, but for the walk's first (his box at 729 still, one step from the wake).
        const flash = ringtail(from, E.K1).ride!.t;
        const back = tag(jumpFrom(from, 'held', -1, 500, k1Done()), E.K1, cps, parks);
        const still = tag(drive(from, 500, () => idle, k1Done()), E.K1, cps, parks);
        const row = [`${way} ${x.toFixed(1)} (t ${flash}) back ${back}`, `still ${still}`];
        // Over the cart, held and plain; walking he cannot wait, so right held from the take-off at once, standing from every step of the cart's way.
        for (const kind of ['held', 'top'] as const) {
          const waits = way === 'stand' ? waited(from, 120) : [from];
          const tags = waits.map((w) => tag(jumpFrom(w, kind, way === 'walk' ? 1 : 0, 500, k1Done()), E.K1, cps, parks));
          const first = Math.max(0, flash - 1);
          const labels = [...new Set(tags.filter((t) => !t.startsWith('lost')))];
          row.push(`${kind} ${labels.map((l) => window(tags, l, first)).join(' ') || 'all lost'}`);
        }
        rows.push(row.join(' | '));
      }
    }
    // GDD-WLD-05: a walk-on jump over the cart glides on to T1 and over its ofrenda (column 65), which it reaches; no other drive here does.
    // Measured, GDD-WLD-18 saying "he wakes K1 from P1 and jumps back onto the perch; the cart stops under it ... nothing touches him there" and "a Poncho
    // who stays on the rail jumps the cart or stomps the ringtail": the held jump back lands on the perch from 11 of the 16 take-offs standing (731.2 to
    // 763.2) and from the first 3 walking, and the glide carries him past it onto P1 left of it from the rest, with no life lost by any jump back; standing
    // still loses the life to K1 from every take-off, walking or standing. Over the cart, standing: a held jump has a window of 37 or 38 steps (the glide
    // is on), a plain one 15 or 16 (cacomixtle.test's 15 with the glide off), the stomp 12 or 13 held and 10 or 11 plain, and a landing in its cart, behind
    // the ringtail, 4 held and 6 plain (the plain two runs); the windows slide 19 steps earlier over the 48 px. Walking he jumps right (take-offs to x = 840, the last before the
    // cart meets a walker at x = 845; 846.4 and on are lost on the way): a held jump keeps the life from every one, stomping it from 728.0 to 753.6 and
    // landing past it on T1's step (756.8 to 776.0) and on T1 (779.2 to 840.0); a plain one is lost up to 782.4, from 785.6 stomps it (to 798.4) and from
    // 801.6 to 840.0 clears it onto T1's step. The cart rolls from 30 steps after the wake, so a plain jump walked into it works from x = 785.6. The last number of each window is the
    // step on which the cart is on him.
    expect([...cps]).toEqual([-1, 0]);
    // GDD-WLD-18: its cart stops at its buffer at column 41, the ringtail parked at x = 688 under the perch, after every answer that leaves it alive.
    expect([...parks]).toEqual([688]);
    expect(rows).toEqual([
      "walk 728.0 (t 0) back perch | still lost K1 | held stomp ground 416 0 (1) | top all lost",
      "walk 731.2 (t 2) back perch | still lost K1 | held stomp ground 416 1 (1) | top all lost",
      "walk 734.4 (t 3) back perch | still lost K1 | held stomp T1 2 (1) | top all lost",
      "walk 737.6 (t 5) back P1 left of the perch | still lost K1 | held stomp T1 4 (1) | top all lost",
      "walk 740.8 (t 6) back P1 left of the perch | still lost K1 | held stomp T1 5 (1) | top all lost",
      "walk 744.0 (t 8) back P1 left of the perch | still lost K1 | held stomp T1 7 (1) | top all lost",
      "walk 747.2 (t 10) back P1 left of the perch | still lost K1 | held stomp T1 9 (1) | top all lost",
      "walk 750.4 (t 11) back P1 left of the perch | still lost K1 | held stomp T1 10 (1) | top all lost",
      "walk 753.6 (t 13) back P1 left of the perch | still lost K1 | held stomp T1 12 (1) | top all lost",
      "walk 756.8 (t 14) back P1 left of the perch | still lost K1 | held T1step 13 (1) | top all lost",
      "walk 760.0 (t 16) back P1 left of the perch | still lost K1 | held T1step 15 (1) | top all lost",
      "walk 763.2 (t 18) back P1 left of the perch | still lost K1 | held T1step 17 (1) | top all lost",
      "walk 766.4 (t 19) back P1 left of the perch | still lost K1 | held T1step 18 (1) | top all lost",
      "walk 769.6 (t 21) back P1 left of the perch | still lost K1 | held T1step 20 (1) | top all lost",
      "walk 772.8 (t 22) back P1 left of the perch | still lost K1 | held T1step 21 (1) | top all lost",
      "walk 776.0 (t 24) back P1 under the perch | still lost K1 | held T1step 23 (1) | top all lost",
      "walk 779.2 (t 26) back lost K1 | still lost K1 | held T1 25 (1) | top all lost",
      "walk 782.4 (t 27) back lost K1 | still lost K1 | held T1 26 (1) | top all lost",
      "walk 785.6 (t 29) back lost K1 | still lost K1 | held T1 28 (1) | top stomp T1step 28 (1)",
      "walk 788.8 (t 30) back lost K1 | still lost K1 | held T1 29 (1) | top stomp T1step 29 (1)",
      "walk 792.0 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top stomp T1step 0 (1)",
      "walk 795.2 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top stomp T1step 0 (1)",
      "walk 798.4 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top stomp T1step 0 (1)",
      "walk 801.6 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 804.8 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 808.0 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 811.2 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 814.4 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 817.6 (t 0) back lost K1 | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 820.8 (t 0) back stomp P1 left of the perch | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 824.0 (t 0) back stomp P1 left of the perch | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 827.2 (t 0) back stomp P1 left of the perch | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 830.4 (t 0) back stomp P1 left of the perch | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 833.6 (t 0) back P1 right of the perch | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 836.8 (t 0) back P1 right of the perch | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 840.0 (t 0) back P1 right of the perch | still lost K1 | held T1 0 (1) | top T1step 0 (1)",
      "walk 843.2 (t 0) back lost K1 | still lost K1 | held all lost | top all lost",
      "walk 846.4 lost K1 on the way",
      "walk 849.6 lost K1 on the way",
      "walk 852.8 lost K1 on the way",
      "walk 856.0 lost K1 on the way",
      "walk 859.2 lost K1 on the way",
      "walk 862.4 lost K1 on the way",
      "walk 865.6 lost K1 on the way",
      "walk 868.8 lost K1 on the way",
      "walk 872.0 lost K1 on the way",
      "walk 875.2 lost K1 on the way",
      "walk 878.4 lost K1 on the way",
      "walk 881.6 lost K1 on the way",
      "walk 884.8 lost K1 on the way",
      "walk 888.0 lost K1 on the way",
      "walk 891.2 lost K1 on the way",
      "stand 728.0 (t 2) back P1 left of the perch | still lost K1 | held cart R2 43-46 (4) stomp P1 right of the perch 56-68 (13) P1 right of the perch 69-105 (37) | top cart R2 73-76,89-90 (6) stomp P1 right of the perch 78-88 (11) P1 right of the perch 91-105 (15)",
      "stand 731.2 (t 6) back perch | still lost K1 | held cart R2 42-45 (4) stomp P1 right of the perch 55-66 (12) P1 right of the perch 67-104 (38) | top cart R2 72-75,87-88 (6) stomp P1 right of the perch 77-86 (10) P1 right of the perch 89-104 (16)",
      "stand 734.4 (t 8) back perch | still lost K1 | held cart R2 40-43 (4) stomp P1 right of the perch 53-65 (13) P1 right of the perch 66-102 (37) | top cart R2 70-73,86-87 (6) stomp P1 right of the perch 75-85 (11) P1 right of the perch 88-102 (15)",
      "stand 737.6 (t 9) back perch | still lost K1 | held cart R2 39-42 (4) stomp P1 right of the perch 52-64 (13) P1 right of the perch 65-101 (37) | top cart R2 69-72,85-86 (6) stomp P1 right of the perch 74-84 (11) P1 right of the perch 87-101 (15)",
      "stand 740.8 (t 11) back perch | still lost K1 | held cart R2 38-41 (4) stomp P1 right of the perch 51-62 (12) P1 right of the perch 63-100 (38) | top cart R2 68-71,83-84 (6) stomp P1 right of the perch 73-82 (10) P1 right of the perch 85-100 (16)",
      "stand 744.0 (t 12) back perch | still lost K1 | held cart R2 37-40 (4) stomp P1 right of the perch 50-62 (13) P1 right of the perch 63-99 (37) | top cart R2 67-70,83-84 (6) stomp P1 right of the perch 72-82 (11) P1 right of the perch 85-99 (15)",
      "stand 747.2 (t 14) back perch | still lost K1 | held cart R2 35-38 (4) stomp P1 right of the perch 48-60 (13) P1 right of the perch 61-97 (37) | top cart R2 65-68,81-82 (6) stomp P1 right of the perch 70-80 (11) P1 right of the perch 83-97 (15)",
      "stand 750.4 (t 16) back perch | still lost K1 | held cart R2 34-37 (4) stomp P1 right of the perch 47-58 (12) P1 right of the perch 59-96 (38) | top cart R2 64-67,79-80 (6) stomp P1 right of the perch 69-78 (10) P1 right of the perch 81-96 (16)",
      "stand 753.6 (t 17) back perch | still lost K1 | held cart R2 33-36 (4) stomp P1 right of the perch 46-58 (13) P1 right of the perch 59-95 (37) | top cart R2 63-66,79-80 (6) stomp P1 right of the perch 68-78 (11) P1 right of the perch 81-95 (15)",
      "stand 756.8 (t 19) back perch | still lost K1 | held cart R2 31-34 (4) stomp P1 right of the perch 44-56 (13) P1 right of the perch 57-93 (37) | top cart R2 61-64,77-78 (6) stomp P1 right of the perch 66-76 (11) P1 right of the perch 79-93 (15)",
      "stand 760.0 (t 20) back perch | still lost K1 | held cart R2 31-34 (4) stomp P1 right of the perch 44-55 (12) P1 right of the perch 56-93 (38) | top cart R2 61-64,76-77 (6) stomp P1 right of the perch 66-75 (10) P1 right of the perch 78-93 (16)",
      "stand 763.2 (t 22) back perch | still lost K1 | held cart R2 29-32 (4) stomp P1 right of the perch 42-54 (13) P1 right of the perch 55-91 (37) | top cart R2 59-62,75-76 (6) stomp P1 right of the perch 64-74 (11) P1 right of the perch 77-91 (15)",
      "stand 766.4 (t 24) back P1 left of the perch | still lost K1 | held cart R2 27-30 (4) stomp P1 right of the perch 40-52 (13) P1 right of the perch 53-89 (37) | top cart R2 57-60,73-74 (6) stomp P1 right of the perch 62-72 (11) P1 right of the perch 75-89 (15)",
      "stand 769.6 (t 25) back P1 left of the perch | still lost K1 | held cart R2 27-30 (4) stomp P1 right of the perch 40-51 (12) P1 right of the perch 52-89 (38) | top cart R2 57-60,72-73 (6) stomp P1 right of the perch 62-71 (10) P1 right of the perch 74-89 (16)",
      "stand 772.8 (t 27) back P1 left of the perch | still lost K1 | held cart R2 26-28 (3) stomp P1 right of the perch 38-50 (13) P1 right of the perch 51-87 (37) | top cart R2 55-58,71-72 (6) stomp P1 right of the perch 60-70 (11) P1 right of the perch 73-87 (15)",
      "stand 776.0 (t 28) back P1 left of the perch | still lost K1 | held cart R2 27 (1) stomp P1 right of the perch 37-49 (13) P1 right of the perch 50-86 (37) | top cart R2 54-57,70-71 (6) stomp P1 right of the perch 59-69 (11) P1 right of the perch 72-86 (15)",
    ]);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// K2 on bridge B.

/** K2's ringtail has parked and 60 steps more have gone (the planks he stands on are gone by then): the drive's end. */
const k2Done = () => {
  let parked = -1;
  return (r: RunState, i: number) => {
    if (parked < 0 && ringtail(r, E.K2).ride!.phase === 'parked') parked = i;
    return parked >= 0 && i >= parked + 60;
  };
};

describe('GDD-WLD-18 level 3-3 K2 on bridge B, driven with K2 live', () => {
  it('GDD-WLD-18 3-3 K2: run across with right held and no jump, and it meets him on the far span', () => {
    // From Q at the 3 tiles before the bridge's lip (x = 2560), standing and running, and from Q's column 156: right held until he is on P5 or a life
    // is lost. K2 wakes at x = 2648 (a plank over the first span), the cart rolls left from 2848.
    const lip = Y(160);
    const starts = [mid(156), ...apart(lip - 3 * TILE, lip)];
    const runs = [0, 120].flatMap((vx) =>
      starts.map((x) => {
        const d = drive(at(x, Y(25), vx), 400, () => right, (r) => r.phase !== 'playing' || r.lives.lives < 7 || (r.player.grounded && r.player.x > Y(176)));
        return { vx, x, d, meets: d.states[d.states.length - 2]!.player.x };
      }),
    );
    // Every run is lost to K2, on the second span (columns 168 to 175, x 2688 to 2816), 2764 to 2766 across: column 172.8. K2 wakes on the first span.
    const meets = runs.map((m) => m.meets);
    expect(new Set(runs.map((m) => last(m.d.states).checkpointIndex))).toEqual(new Set([-1]));
    expect([runs.length, runs.filter((m) => m.d.lost && m.d.cause === 'K2').length, Math.min(...meets), Math.max(...meets)]).toEqual([34, 34, 2764, 2765.8]);
    // The step on which he passes x = 2648 wakes the ringtail: it is first seen telegraphing with his middle 2650 to 2651.8 across, on the first span
    // (the step carries him up to 2 px past the line), GDD says "wakes when he passes x = 2648".
    const flash = runs.map((m) => m.d.states.find((r) => ringtail(r, E.K2).ride!.phase !== 'waiting')!.player.x);
    expect([Math.min(...flash), Math.max(...flash)]).toEqual([2650, 2651.8]);
  }, 60_000);

  it('GDD-WLD-18 3-3 K2: stopped on the pier at every arrival step, the cart jumped held and plain at every step of its window, and stomped', () => {
    // From Q's column 156, right held for `rel` steps and then nothing: the steps at which he lets go, and so the step he comes to rest, on each of
    // which he stands on the pier (`whereIs` 'pier', no life lost). 8 of them. K2 is first seen telegraphing at step 77, 88 steps before its cart
    // reaches the pier. From each rest state a jump is pressed on every step k of the next 120: held to the landing and plain, in place.
    const arrivals: string[] = [];
    const cps = new Set<number>();
    for (let rel = 0; rel <= 140; rel++) {
      const rest = drive(at(mid(156), Y(25)), 300, (_r, i) => (i < rel ? right : idle), (r, i) => r.phase !== 'playing' || (i > rel && r.player.vx === 0 && r.player.grounded));
      const from = last(rest.states);
      if (rest.lost || whereIs(from) !== 'pier') continue;
      const flash = rest.states.findIndex((r) => ringtail(r, E.K2).ride!.phase !== 'waiting');
      const waits = waited(from, 120);
      const row = [`rest ${rest.states.length - flash} after the first flash, x ${from.player.x.toFixed(1)}`];
      for (const kind of ['held', 'top'] as const) {
        const tags = waits.map((w) => tag(jumpFrom(w, kind, 0, 500, k2Done()), E.K2, cps));
        const labels = [...new Set(tags.filter((t) => !t.startsWith('lost')))];
        row.push(`${kind} ${labels.map((l) => window(tags, l, rest.states.length - flash)).join(' ')}`);
      }
      arrivals.push(row.join(' | '));
    }
    // Measured, GDD-WLD-18 "he jumps the cart (15 steps of window, GDD-ENM-04), stomps or claws the ringtail": at each of the 8 arrivals (at rest 16 to 23
    // steps after the first flash, the cart reaching the pier 88 after) a plain jump has a window of 15 or 16 steps over the cart (GDD says 15, the
    // glide-off figure of `cacomixtle.test.ts`), a held one with the glide on 37 or 38, and a stomp 12 or 13 held and 10 or 11 plain; a landing in its
    // cart behind the ringtail is 4 held and 6 plain, all with no life lost. A window is counted from the first flash.
    // GDD-WLD-05: no ofrenda between Q and the pier (the second is on P4, column 130): no checkpoint.
    expect([...cps]).toEqual([-1]);
    expect(arrivals).toEqual([
      "rest 16 after the first flash, x 2672.2 | held cart R5 30-33 (4) stomp pier 43-55 (13) pier 56-92 (37) | top cart R5 60-63,76-77 (6) stomp pier 65-75 (11) pier 78-92 (15)",
      "rest 17 after the first flash, x 2674.2 | held cart R5 29-32 (4) stomp pier 42-54 (13) pier 55-91 (37) | top cart R5 59-62,75-76 (6) stomp pier 64-74 (11) pier 77-91 (15)",
      "rest 18 after the first flash, x 2676.2 | held cart R5 28-31 (4) stomp pier 41-53 (13) pier 54-90 (37) | top cart R5 58-61,74-75 (6) stomp pier 63-73 (11) pier 76-90 (15)",
      "rest 19 after the first flash, x 2678.2 | held cart R5 28-31 (4) stomp pier 41-52 (12) pier 53-90 (38) | top cart R5 58-61,73-74 (6) stomp pier 63-72 (10) pier 75-90 (16)",
      "rest 20 after the first flash, x 2680.2 | held cart R5 27-30 (4) stomp pier 40-51 (12) pier 52-89 (38) | top cart R5 57-60,72-73 (6) stomp pier 62-71 (10) pier 74-89 (16)",
      "rest 21 after the first flash, x 2682.2 | held cart R5 26-29 (4) stomp pier 39-51 (13) pier 52-88 (37) | top cart R5 56-59,72-73 (6) stomp pier 61-71 (11) pier 74-88 (15)",
      "rest 22 after the first flash, x 2684.2 | held cart R5 25-28 (4) stomp pier 38-50 (13) pier 51-87 (37) | top cart R5 55-58,71-72 (6) stomp pier 60-70 (11) pier 73-87 (15)",
      "rest 23 after the first flash, x 2686.2 | held cart R5 24-27 (4) stomp pier 37-49 (13) pier 50-86 (37) | top cart R5 54-57,70-71 (6) stomp pier 59-69 (11) pier 72-86 (15)"
    ]);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// K3 and the Zopilote on P5, over every clock of the Zopilote (7,200 steps, 1,200 clocks 6 apart).

describe('GDD-WLD-18 level 3-3 K3 and the Zopilote on P5, driven over every clock of the Zopilote', () => {
  it('GDD-WLD-18 3-3 K3 and the vulture: walking in from column 176 with right held loses a life to K3 alone at every one of the 1,200 clocks, the vulture never sees him', () => {
    const lostTo: Record<string, number> = {};
    const where: Record<string, [number, number]> = {};
    const cps = new Set<number>();
    let telegraphs = 0;
    for (const t of clocks(7200)) {
      const d = drive(onP5(mid(176), Y(25), t), 300, () => right, (r) => r.phase !== 'playing' || r.lives.lives < 7 || r.player.x > Y(199));
      cps.add(last(d.states).checkpointIndex);
      if (d.states.some((r) => zopilote(r).flight!.phase === 'telegraph')) telegraphs++;
      const key = d.lost ? d.cause : 'none';
      lostTo[key] = (lostTo[key] ?? 0) + 1;
      const x = d.states[d.states.length - 2]!.player.x;
      where[key] = [Math.min(where[key]?.[0] ?? x, x), Math.max(where[key]?.[1] ?? x, x)];
    }
    // Measured, GDD-WLD-18 "the cart under the vulture, jumping K3 under it" as where a first-time player loses a life: walking in with right held loses
    // one at every clock, all to K3, who meets him at x = 3069 (column 191.8); the vulture, its lowest point 108 px over P5's top, never sees a walker
    // (V1 had 649 to K3 and 534 to the vulture with it 48 px over, 17 to both).
    // GDD-WLD-05: the third ofrenda (column 203) is past MP2, not reached: no checkpoint.
    expect([...cps]).toEqual([-1]);
    expect(telegraphs).toBe(0);
    expect({ lostTo, where }).toEqual({ lostTo: { K3: 1200 }, where: { K3: [3069, 3069] } });
  }, 60_000);
});

describe('GDD-WLD-18 level 3-3 K3 awake and the vulture blind to him on the ground', () => {
  it('GDD-WLD-18 3-3 K3 awake and the vulture blind to him on the ground: its lowest point 92.0026 px over his centre on P5 and 84.0026 in K3 cart, never a telegraph at any x', () => {
    // The vulture's trigger box (ZOPILOTE.triggerX 96 across from its middle, triggerY 80 below its y) over its line (x = 2976 to 3072, centred on
    // x = 3024) is x = 2880 to 3168 across: K3 wakes from x = 2952 (to 3152, its sight), inside that, and the lift MP2 (a rider's centre from x = 3179)
    // is outside it. Its lowest point, over a whole period of its bob (150 steps), is y = 291.9974
    // (its line at 280, the bob 12 px either way), so the least gap between its y and his hurtbox's centre is 92.0026 standing on P5 (feet 400, centre
    // 384) and 84.0026 standing on K3's cart floor (feet 392, centre 376): both over triggerY 80, so it never sees him on the ground (V1 had its line at
    // 340 and the gap 32.0026 on P5: it saw him wherever K3 was awake). Every 6th clock: these are the exact pins.
    const z = L.enemies[E.ZOPILOTE]!;
    expect([z.x - ZOPILOTE.range - ZOPILOTE.triggerX, z.x + ZOPILOTE.range + ZOPILOTE.triggerX]).toEqual([2880, 3168]);
    const lowest = Math.max(...Array.from({ length: ZOPILOTE.periodSteps }, (_, i) => zopilote(idleRun(i + 1)).flight!.y));
    const gap = (feet: number) => Math.round((centre(standing(3000, feet)).y - lowest) * 1e4) / 1e4;
    expect([gap(Y(25)), gap(Y(25) - 8)]).toEqual([92.0026, 84.0026]);
    // Standing at x, 400 steps over every clock (K3 parked at its buffer): the clocks with a telegraph and the clocks that cost the life.
    const sees = [2952, 2968, 2984, 3000, 3040].map((x) => {
      let telegraphs = 0;
      let lost = 0;
      for (const t of clocks(7200)) {
        const w = waited(withParked(atT(x, Y(25), t), 'K2', 'K3'), 400);
        if (w.some((r) => zopilote(r).flight!.phase === 'telegraph')) telegraphs++;
        if (w.length <= 400) lost++;
      }
      return `${x}: telegraph at ${telegraphs} of 1200 clocks, life lost at ${lost}`;
    });
    expect(sees).toEqual([
      "2952: telegraph at 0 of 1200 clocks, life lost at 0",
      "2968: telegraph at 0 of 1200 clocks, life lost at 0",
      "2984: telegraph at 0 of 1200 clocks, life lost at 0",
      "3000: telegraph at 0 of 1200 clocks, life lost at 0",
      "3040: telegraph at 0 of 1200 clocks, life lost at 0"
    ]);
  }, 300_000);
});

describe('GDD-WLD-18 level 3-3 the vulture sees a jump under its middle', () => {
  it('GDD-WLD-18 3-3 the vulture sees a held jump from x 3024, under the middle of its line, at every one of the 1,200 clocks', () => {
    // A held jump rises his centre past 372 (its lowest point 291.9974 + triggerY 80), 12 px up, early in the jump, while its middle is within 96 px of
    // him: x = 3024 is under the middle of its line (2976 to 3072), K3 parked, standing, every 6th clock. At 140 px over P5 it sees it at about half.
    let seen = 0;
    for (const t of clocks(7200)) {
      let air = false;
      const d = drive(withParked(atT(3024, Y(25), t), 'K2', 'K3'), 400, jumper('held', 0), (r, i) => {
        if (!r.player.grounded) air = true;
        return air && r.player.grounded && i > 0;
      });
      if (d.states.some((r) => zopilote(r).flight!.phase === 'telegraph')) seen++;
    }
    expect(seen).toBe(1200);
  }, 60_000);
});

describe('GDD-WLD-18 level 3-3 the fall off A onto K3 cart, driven over every clock', () => {
  it('GDD-WLD-18 3-3 off A left lip walking left at every one of the 1,200 clocks: where he lands, and 2 s after, with K3 waiting and K3 parked', () => {
    // A2 found 2 of 12 start times of MP2 (platform clocks only, the enemies at their start) land on the back edge of K3's cart beside the ringtail.
    // Here the lift and every enemy are at one clock, left held from A's lip (x = 3240) until he stands again, then nothing for 2 s (120 steps, or
    // until a life is lost): the landing and what 2 s cost, K3 never woken (as that drive left it) and K3 woken and parked at its buffer (as he finds
    // it after any answer of his to it).
    const out: Record<string, Record<string, number>> = {};
    const cps = new Set<number>();
    for (const state of ['K3 waiting', 'K3 parked'] as const) {
      const tally: Record<string, number> = {};
      for (const t of clocks(7200)) {
        const from = state === 'K3 parked' ? withParked(onP5(Y(202) + 8, Y(17), t), 'K3') : onP5(Y(202) + 8, Y(17), t);
        let air = false;
        let landing: RunState | undefined;
        let landedAt = 0;
        const d = drive(from, 600, () => (landing ? idle : { move: -1, jumpHeld: false }), (r, i) => {
          if (!r.player.grounded) air = true;
          if (!landing && air && r.player.grounded) {
            landing = r;
            landedAt = i;
          }
          return landing !== undefined && i >= landedAt + 120;
        });
        cps.add(last(d.states).checkpointIndex);
        const key = `${landing ? whereIs(landing) : 'air'} ${d.lost ? `lost ${d.cause}` : 'ok'}`;
        tally[key] = (tally[key] ?? 0) + 1;
      }
      out[state] = tally;
    }
    // GDD-WLD-05: the third ofrenda (column 203, x = 3256) is 16 px from his start, short of touching it: no checkpoint.
    // Measured, GDD-WLD-18 "at 2 of 12 start times off A he lands on the back edge of K3's cart, beside the ringtail: no life lost in 60 steps, to be
    // driven with the ringtail riding": K3 waiting, he lands on MP2 at 983 of the 1,200 clocks (964 keep the life for 2 s) and on the back edge of K3's
    // cart at 217 (18%, as the 2 of 12 were): 198 keep it and 19 lose it to K3 (he slides left off the cart's back edge into the ringtail); the
    // vulture takes none (V1, the vulture 48 px over P5: 96 on MP2 and 98 on the cart; at 108 px centred on x 3048: 82 and 26). K3 parked, the cart is
    // gone and he lands on P5 at those 217: 211 keep the life, 6 lose it to the vulture; on MP2 all 983 keep it (A at 3048: 87 lost on MP2, 38 on P5).
    // The 6 are the loss family left, a fall through its sight: at 6 clocks (564 and every 1,152 on) he falls past x = 3143 with his centre in the band
    // its trigger reads (feet 358.9, over x 3168, its sight's end) while its middle is at x 3051, and lands on P5 at x = 3129 as it dives. No ofrenda
    // is reached: no checkpoint.
    expect([...cps]).toEqual([-1]);
    expect(out).toEqual({
      "K3 waiting": {
        "MP2 lost K3": 19,
        "MP2 ok": 964,
        "cart R6 lost K3": 19,
        "cart R6 ok": 198
      },
      "K3 parked": {
        "MP2 ok": 983,
        "P5 lost Zopilote": 6,
        "P5 ok": 211
      }
    });
  }, 60_000);
});

/**
 * The first-time line (GDD-WLD-18 "jumping K3 under it") at clock `t`: right held from column 176; when K3's cart is rolling and its front is `dist` px or
 * less from his front edge, a held jump (right held through it); on landing, right held on to A. The distance is the bot's choice, not the GDD's.
 */
function firstTimeLine(t: number, dist: number): string {
  const rail = railOf('R6');
  let stage = 0;
  let j = 0;
  let air = false;
  const jump = jumper('held', 1);
  const d = drive(onP5(mid(176), Y(25), t), 1500, (r) => {
    if (stage === 0) {
      const c = r.carts[cartOf('R6')]!;
      if (c.phase === 'rolling' && rail.x + rail.dir * (c.m + CART.width / 2) - (r.player.x + HITBOX.width / 2) <= dist) stage = 1;
    }
    if (stage === 1) {
      if (!r.player.grounded) air = true;
      else if (air && j > 0) stage = 2;
    }
    return stage === 1 ? jump(r, j++) : right;
  }, onA);
  return d.lost ? `lost ${d.cause} ${stage === 0 ? 'before the jump' : stage === 1 ? 'in the jump' : 'after it'}` : onA(last(d.states)) ? 'reached A' : 'no A';
}

describe('GDD-WLD-18 level 3-3 the first-time line past K3 under the vulture', () => {
  it('GDD-WLD-18 3-3 the first-time line reaches A: right held from column 176, a held jump over K3 cart 32 px away, right held on to A, at every one of the 1,200 clocks', () => {
    // V1 (the vulture at 48) lost it at every clock; at 108 the jump is under the vulture, seen, but he is in the air and over the cart before it dives,
    // and A is reached with the life at every clock. Then walking on, the dive it started has landed behind him: this line is the named one (32 px).
    const outcome: Record<string, number> = {};
    for (const t of clocks(7200)) {
      const key = firstTimeLine(t, 32);
      outcome[key] = (outcome[key] ?? 0) + 1;
    }
    expect(outcome).toEqual({ 'reached A': 1200 });
  }, 120_000);

  it('GDD-WLD-18 3-3 the first-time line, the jump 0 to 96 px from K3 cart front in steps of 8, at every 24th clock (step 24, 300 clocks): the clocks reaching A and what takes the others', () => {
    // The 32 px of the named line is the bot's choice (GDD-WLD-18 says "jumping K3 under it", no distance): the jump nearer is later, the cart nearer him.
    const outcomes: Record<string, Record<string, number>> = {};
    for (let dist = 0; dist <= 96; dist += 8) {
      const tally: Record<string, number> = {};
      for (const t of clocks(7200, 24)) {
        const key = firstTimeLine(t, dist);
        tally[key] = (tally[key] ?? 0) + 1;
      }
      outcomes[`${dist} px`] = tally;
    }
    // Measured: from 8 px to 96 px every clock reaches A with the life (300 of 300); at 0 px the jump is pressed when his front edge touches the cart's
    // and K3 takes the life in the jump at every clock. The named 32 px is not a knife edge: the line holds over 8 to 96 px.
    const reached = { 'reached A': 300 };
    expect(outcomes).toEqual({
      '0 px': { 'lost K3 in the jump': 300 },
      ...Object.fromEntries([8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96].map((d) => [`${d} px`, reached])),
    });
  }, 240_000);
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// The bats and the Armadillo on P3, over every clock of the Armadillo (1,058 steps, 177 clocks 6 apart, which cover the bats' 240 five times over).

/** The level without the Armadillo, to tell a flight that is lost from one that only has the Armadillo beside it. */
const noArmadillo: Level = { ...L, enemies: L.enemies.filter((_, i) => i !== E.ARMADILLO) };

describe('GDD-WLD-18 level 3-3 the glide on foot from the lip of P3 to P4, over every clock', () => {
  it('GDD-WLD-18 3-3 the glide on foot from P3 lip: the least clearance under each bat and every flight that loses a life, at every clock', () => {
    const lip = Y(120);
    const least: Record<string, { gap: number; at: string }> = {};
    const lostBy: Record<string, Record<string, number>> = {};
    const lostAt: Record<string, number[]> = {};
    const checkpoints = new Set<number>();
    let flights = 0;
    let landedP4 = 0;
    for (const t of clocks(1058)) {
      for (const vx of [0, 120]) {
        for (const x of apart(lip - 3 * TILE, lip)) {
          const f = fly(atT(x, Y(22), t, vx), 'held', 1);
          const name = `${vx === 0 ? 'standing' : 'running'} ${((lip - x) / TILE).toFixed(1)} tiles early`;
          flights++;
          for (const bat of [E.BAT1, E.BAT2, E.BAT3]) {
            const gap = underBat(f, bat);
            const key = `bat ${bat - E.BAT1 + 1}`;
            if (gap < (least[key]?.gap ?? Infinity)) least[key] = { gap: Math.round(gap * 10) / 10, at: `${name}, clock ${t}` };
          }
          if (f.lost) {
            // The step that took the life: his last step's input is the jump's.
            const from = atT(x, Y(22), t, vx);
            const cause = causeOf(f.states.length > 1 ? f.states[f.states.length - 2]! : from, { move: 1, jumpHeld: true });
            // A life the Armadillo takes is its own family: the same flight on a copy without it, and whether that one lives ("the Armadillo, not the flight").
            const family = cause.includes('Armadillo') ? (fly({ ...from, enemies: from.enemies.filter((_, i) => i !== E.ARMADILLO) }, 'held', 1, noArmadillo).lost ? 'Armadillo and the flight' : 'the Armadillo, not the flight') : cause;
            const by = (lostBy[family] ??= {});
            by[name] = (by[name] ?? 0) + 1;
            const seen = (lostAt[family] ??= []);
            if (!seen.includes(t)) seen.push(t);
          } else if (f.landed) {
            checkpoints.add(f.landed.checkpointIndex);
            if (f.landed.player.y === Y(25)) landedP4++;
            // GDD-WLD-05: a glide over an ofrenda reaches it: a flight that passes the second ofrenda ends with its checkpoint, one that does not has none.
            expect(f.states.some((r) => touchesOfrenda(r.player, L.ofrendas[1]!)), `${name} ${t}`).toBe(f.landed.checkpointIndex === 1);
          }
        }
      }
    }
    // Measured, GDD-WLD-18 "the plain glide passes 17 px under the last bat taken at a run 2 tiles early, 15 px from the lip (measured at the bats' start)":
    // over every clock the last bat is passed 10.6 px under at the least (running from the lip, clock 1002), under 15 and 17; the middle bat is hit by
    // the standing take-off 3 tiles before the lip at 40 of the 177 clocks (-4.6 px at the worst, clock 78: the flight's own loss); the first bat is
    // never across from a take-off. The Armadillo is its own family, "the Armadillo, not the flight": the same flight on a copy without it lives in
    // every one. It takes the life at the clocks 84 to 396 (26 clocks at every take-off from 3 tiles to 1.6 early, fewer to the lip: he stands beside an
    // Armadillo that is tucked or rolling, whatever the flight does). 4,963 of 5,664 flights land on P4 with the checkpoint (the second ofrenda
    // reached); the other 701 lose the life, 40 to the bat and 661 to the Armadillo.
    expect({ lostAt, flights, landedP4, checkpoints: [...checkpoints], least, lostBy }).toEqual({
      "lostAt": {
        "bat 2": [
          30,
          36,
          42,
          48,
          54,
          60,
          66,
          72,
          270,
          276,
          282,
          288,
          294,
          300,
          306,
          312,
          510,
          516,
          522,
          528,
          534,
          540,
          546,
          552,
          750,
          756,
          762,
          768,
          774,
          780,
          786,
          792,
          990,
          996,
          1002,
          1008,
          1014,
          1020,
          1026,
          1032
        ],
        "the Armadillo, not the flight": [
          84,
          90,
          96,
          102,
          108,
          114,
          120,
          126,
          132,
          138,
          144,
          150,
          156,
          162,
          168,
          174,
          180,
          186,
          192,
          198,
          204,
          210,
          216,
          222,
          228,
          234,
          240,
          246,
          252,
          258,
          264,
          270,
          276,
          282,
          288,
          294,
          300,
          306,
          312,
          318,
          324,
          330,
          336,
          342,
          348,
          354,
          360,
          366,
          372,
          378,
          384,
          390,
          396
        ]
      },
      "flights": 5664,
      "landedP4": 4963,
      "checkpoints": [
        1
      ],
      "least": {
        "bat 2": {
          "gap": -4.6,
          "at": "standing 3.0 tiles early, clock 78"
        },
        "bat 3": {
          "gap": 10.6,
          "at": "running 0.0 tiles early, clock 1002"
        }
      },
      "lostBy": {
        "bat 2": {
          "standing 3.0 tiles early": 40
        },
        "the Armadillo, not the flight": {
          "standing 3.0 tiles early": 26,
          "standing 2.8 tiles early": 26,
          "running 3.0 tiles early": 26,
          "running 2.8 tiles early": 26,
          "standing 2.6 tiles early": 26,
          "running 2.6 tiles early": 26,
          "standing 2.4 tiles early": 26,
          "standing 2.2 tiles early": 26,
          "running 2.4 tiles early": 26,
          "running 2.2 tiles early": 26,
          "standing 2.0 tiles early": 26,
          "standing 1.8 tiles early": 26,
          "running 2.0 tiles early": 26,
          "running 1.8 tiles early": 26,
          "standing 1.6 tiles early": 26,
          "running 1.6 tiles early": 26,
          "standing 1.4 tiles early": 26,
          "standing 1.2 tiles early": 25,
          "running 1.4 tiles early": 25,
          "running 1.2 tiles early": 23,
          "standing 1.0 tiles early": 21,
          "standing 0.8 tiles early": 18,
          "running 1.0 tiles early": 19,
          "running 0.8 tiles early": 16,
          "standing 0.6 tiles early": 15,
          "running 0.6 tiles early": 13,
          "standing 0.4 tiles early": 11,
          "standing 0.2 tiles early": 9,
          "running 0.4 tiles early": 9,
          "running 0.2 tiles early": 7,
          "standing 0.0 tiles early": 5,
          "running 0.0 tiles early": 3
        }
      }
    });
  }, 300_000);
});

describe('GDD-WLD-18 level 3-3 the bat route and the Armadillo on P3', () => {
  it('GDD-WLD-18 3-3 the bat route: a held jump from P3 left half takes all four hilos at 35 of the 40 clocks, lands over bridge A, every life kept', () => {
    // A held jump with right held from P3's left end (every 0.2 tile from 1.0 px in from the face to 6 px short of the lip, standing and running)
    // stomps the bats in turn (his bounce with jump held) and glides on. Each flight that takes the four hilos is run on, right held, to the stone Q.
    const HILOS = [[113, 14], [118, 12], [123, 10], [124, 10]] as const;
    const routes: Record<number, number> = {};
    const ends: Record<string, number> = {};
    const lostBy: Record<string, number> = {};
    for (const t of clocks(240)) {
      for (const vx of [0, 120]) {
        for (const x of apart(Y(108) + 6, Y(120) - 6)) {
          const from = atT(x, Y(22), t, vx);
          const f = fly(from, 'held', 1);
          if (f.lost) {
            const cause = causeOf(f.states.length > 1 ? f.states[f.states.length - 2]! : from, { move: 1, jumpHeld: true });
            lostBy[cause] = (lostBy[cause] ?? 0) + 1;
            continue;
          }
          if (!f.landed || tookOf(f.landed, HILOS).length < 4) continue;
          routes[t] = (routes[t] ?? 0) + 1;
          const run = drive(f.landed, 400, () => right, (r) => r.phase === 'clear' || (r.player.grounded && whereIs(r) === 'Q'));
          const end = run.states.length > 0 ? last(run.states) : f.landed;
          const key = `${run.lost ? `lost ${run.cause}` : `on ${whereIs(end)}`}, ${landedAs(f)} first, checkpoint ${end.checkpointIndex}, lives ${end.lives.lives}`;
          ends[key] = (ends[key] ?? 0) + 1;
        }
      }
    }
    // Measured, GDD-WLD-18 "a reward route to four hilos and a higher, longer glide (nothing needs it)": a held jump from P3's left end (x = 1734 to 1750,
    // standing, and running from the face) takes all four hilos at 35 of the 40 clocks of the bats' loop (not from 150 to 174), 209 of the
    // 4,560 flights, and glides on to bridge A's planks (column 147), over the ofrenda, with the checkpoint; run on to Q with right held, every one keeps
    // every life. 3,222 flights lose it: to the first bat 1,131, the second 1,367, the Armadillo 639, the third 12 and, 73 times, no enemy (a pit).
    expect({ clocks: runsOf(clocks(240).map((t) => (routes[t] ? 'four hilos' : 'none'))).map((r) => r.replace(/^(\d+)(-(\d+))?/, (_m, a: string, _b: string, c?: string) => `${Number(a) * 6}${c ? `-${Number(c) * 6}` : ''}`)), routes: Object.values(routes).reduce((a, b) => a + b, 0), ends, lostBy }).toEqual({
      "clocks": [
        "0-144 four hilos",
        "150-174 none",
        "180-234 four hilos"
      ],
      "routes": 209,
      "ends": {
        "on Q, plank first, checkpoint 1, lives 7": 209
      },
      "lostBy": {
        "bat 1": 1131,
        "bat 2": 1367,
        "Armadillo": 639,
        "bat 3": 12,
        "no enemy": 73
      }
    });
  }, 300_000);
});

const armadillo = (r: RunState) => r.enemies[E.ARMADILLO]!;

/** Right held from P3's left end (x = 1734) at clock `t` until the Armadillo tucks (startled), a life is lost or 300 steps: where it tucked. */
function toTuck(t: number) {
  const d = drive(atT(Y(108) + 6, Y(22), t), 300, () => right, (r) => r.phase !== 'playing' || armadillo(r).shell!.phase !== 'walk');
  return { d, from: d.states.length > 0 ? last(d.states) : atT(Y(108) + 6, Y(22), t) };
}

describe('GDD-WLD-18 level 3-3 the Armadillo on P3, over every clock of its walk (1,058 steps, 177 clocks)', () => {
  it('GDD-WLD-18 3-3 the Armadillo: walking onto P3 from the lift with right held, where it tucks at each clock, and standing still costs the life', () => {
    // He steps onto P3 at x = 1734 (the lift MP1 is flush with it) and walks right: it tucks when his hurtbox centre is within 80 px of its middle
    // and his feet within 24 of its own (ARMADILLO.sightX, sightY), on his first step if it is already so near. Then he stands still: the ball rolls at
    // him and the narrow peak (12 tiles) has nowhere else for him to go.
    const cps = new Set<number>();
    const rows = clocks(1058).map((t) => {
      const { d, from } = toTuck(t);
      cps.add(from.checkpointIndex);
      const tucked = !d.lost && armadillo(from).shell!.phase === 'tuck';
      const still = tucked ? drive(from, 200, () => idle, (_r, i) => i >= 150) : undefined;
      return { t, lost: d.lost ? d.cause : '', tucked, after: d.states.length, player: Math.round(from.player.x * 10) / 10, arm: Math.round(armadillo(from).x * 10) / 10, dir: armadillo(from).dir, still: still ? (still.lost ? still.cause : 'survives') : '' };
    });
    const range = (key: 'after' | 'player' | 'arm') => [Math.min(...rows.map((r) => r[key])), Math.max(...rows.map((r) => r[key]))];
    const count = (key: 'lost' | 'still' | 'dir') => Object.fromEntries([...new Set(rows.map((r) => String(r[key])))].map((v) => [v, rows.filter((r) => String(r[key]) === v).length]));
    // GDD-WLD-05: the second ofrenda (column 130) is on P4, across the pit: no checkpoint on P3.
    // He is put on P3's left end (x = 1734) at each clock, as he stands on stepping off the lift MP1 when it is flush with P3; the lift's own round and
    // the ride up it are not driven here (the spring's test in `level3-3.test.ts` has them), so every clock is one he can arrive at by waiting.
    // Measured, GDD-WLD-18 "an Armadillo (from column 114) ... jump it, or bounce on its ball": walking onto P3 with right held it tucks at 166 of the
    // 177 clocks on his 1st to 55th step (his middle at x = 1734 to 1835, its at 1736 to 1912) and rolls left at him, and standing still takes the life at
    // every one of them; at the other 11 clocks (738 to 798) it walks at x = 1739 to 1746, where
    // he steps on, and touches him on his first step.
    expect([...cps]).toEqual([-1]);
    expect({ clocks: rows.length, lostAt: rows.filter((r) => r.lost).map((r) => r.t), tucked: rows.filter((r) => r.tucked).length, after: range('after'), player: range('player'), arm: range('arm'), lost: count('lost'), still: count('still'), dir: count('dir') }).toEqual({
      "clocks": 177,
      "lostAt": [738, 744, 750, 756, 762, 768, 774, 780, 786, 792, 798],
      "tucked": 166,
      "after": [
        1,
        55
      ],
      "player": [
        1734.1,
        1835
      ],
      "arm": [
        1736,
        1912
      ],
      "lost": {
        "": 166,
        "Armadillo": 11
      },
      "still": {
        "Armadillo": 166,
        "": 11
      },
      "dir": {
        "-1": 177
      }
    });
  });
});

describe('GDD-WLD-18 level 3-3 the Armadillo on P3, the answers: jump it or bounce on its ball, at every clock', () => {
  it('GDD-WLD-18 3-3 the Armadillo: a held and a plain jump at every step from the tuck, with the lives, and the clocks where the narrow peak leaves no answer', () => {
    // From the tuck (above), nothing held (he slows and stands) and a jump pressed in place at step k of the next 60: over its ball, bounced on it (a
    // stomp on a rolling ball bounces him and does not defeat it) or lost. The drive ends 20 steps after he lands.
    const noAnswer: number[] = [];
    const out: Record<string, { safe: number[]; bounced: number; over: number; lostTo: Record<string, number> }> = {};
    const walkLost: number[] = [];
    for (const t of clocks(1058)) {
      const { d, from } = toTuck(t);
      if (d.lost) {
        walkLost.push(t);
        continue;
      }
      const waits = waited(from, 60);
      let any = false;
      for (const kind of ['held', 'top'] as const) {
        const o = (out[kind] ??= { safe: [], bounced: 0, over: 0, lostTo: {} });
        let safe = 0;
        for (let k = 0; k < 61; k++) {
          const j = k < waits.length ? jumpFrom(waits[k]!, kind, 0, 400, (_r, after) => after >= 20) : null;
          if (j && !j.lost) {
            safe++;
            if (j.states.some((r) => r.stomped)) o.bounced++;
            else o.over++;
          } else o.lostTo[j ? j.cause : 'while waiting'] = (o.lostTo[j ? j.cause : 'while waiting'] ?? 0) + 1;
        }
        o.safe.push(safe);
        if (safe > 0) any = true;
      }
      if (!any) noAnswer.push(t);
    }
    const summary = Object.fromEntries(Object.entries(out).map(([k, o]) => [k, { safe: [Math.min(...o.safe), Math.max(...o.safe)], clocksWith: o.safe.filter((n) => n > 0).length, bounced: o.bounced, over: o.over, lostTo: o.lostTo }]));
    // Measured: jump or bounce, in place, from the tuck at every step of the next 60. A held jump keeps the life at up to 59 of the 61 steps and a plain
    // one at up to 37, at 140 of the 166 clocks; bounced on the ball 808 and 1,681 times, over it 6,102 and 2,718. At 26 clocks (12 to 72 and 348 to
    // 432) nothing keeps it: the first bat is over the spot where it tucks and every jump goes into it (1,457 take-offs), or the ball takes him; the
    // narrow peak leaves no answer there. At the other clocks the plain jump meets the ball more (2,676 take-offs) than the held one (165).
    // A no-answer clock is a timing choice, not a dead end: he waits where it cannot touch him (L1, below) and arrives later. From each of the 26, the
    // steps to the next clock at which an answer exists: 6 to 90 (66 from clock 12 to 78, 90 from clock 348 to 438).
    const answered = new Set(clocks(1058).filter((t) => !noAnswer.includes(t) && !walkLost.includes(t)));
    const waitTo = noAnswer.map((t) => {
      let w = 6;
      while (!answered.has(t + w) && t + w < 1058) w += 6;
      return w;
    });
    expect([Math.min(...waitTo), Math.max(...waitTo), waitTo[0], waitTo[11]]).toEqual([6, 90, 66, 90]);
    expect({ walkLost, summary, noAnswer }).toEqual({
      "walkLost": [
        738,
        744,
        750,
        756,
        762,
        768,
        774,
        780,
        786,
        792,
        798
      ],
      "summary": {
        "held": {
          "safe": [
            0,
            59
          ],
          "clocksWith": 140,
          "bounced": 808,
          "over": 6102,
          "lostTo": {
            "bat 1": 1457,
            "Armadillo": 165,
            "while waiting": 1590,
            "Armadillo + bat 1": 1,
            "bat 2": 3
          }
        },
        "top": {
          "safe": [
            0,
            37
          ],
          "clocksWith": 140,
          "bounced": 1681,
          "over": 2718,
          "lostTo": {
            "bat 1": 1457,
            "Armadillo": 2676,
            "while waiting": 1590,
            "Armadillo + bat 1": 1,
            "bat 2": 3
          }
        }
      },
      "noAnswer": [
        12,
        18,
        24,
        30,
        36,
        42,
        48,
        54,
        60,
        66,
        72,
        348,
        354,
        360,
        366,
        372,
        378,
        384,
        390,
        396,
        402,
        408,
        414,
        420,
        426,
        432
      ]
    });
  }, 600_000);
});

/** From L1 (column 103) at clock `t`: the spring's plain launch onto the lift (right held once he is on it, as the spring's test), up to P3, and right held on to the Armadillo's tuck. */
function viaLift(t: number): { drive: Drive; from: RunState } {
  let launched = false;
  let onLift = false;
  const up = drive(atT(mid(103), Y(29), t), 900, (r) => {
    if (r.player.vy < -400) launched = true;
    if (whereIs(r) === 'MP1') onLift = true;
    return !launched || onLift ? right : idle;
  }, (r) => r.phase !== 'playing' || (r.player.grounded && r.player.y === Y(22) && r.player.x - 6 >= Y(108)));
  if (up.lost) return { drive: up, from: atT(mid(103), Y(29), t) };
  const walk = drive(last(up.states), 300, () => right, (r) => r.phase !== 'playing' || armadillo(r).shell!.phase !== 'walk');
  return { drive: walk, from: walk.states.length > 0 ? last(walk.states) : last(up.states) };
}

/** From a tucked Armadillo: how many of the next 61 steps a held and a plain jump pressed in place keep the life (the drive ends 20 steps after he lands). */
function answersFrom(from: RunState): Record<'held' | 'top', number> {
  const waits = waited(from, 60);
  const safe = (kind: 'held' | 'top') => waits.filter((w) => !jumpFrom(w, kind, 0, 400, (_r, after) => after >= 20).lost).length;
  return { held: safe('held'), top: safe('top') };
}

describe('GDD-WLD-18 level 3-3 the Armadillo on P3, waiting on L1 for a clock with an answer', () => {
  it('GDD-WLD-18 3-3 the Armadillo: a clock with no answer is a clock to wait out on L1, which costs nothing, and the wait that works', () => {
    // Waiting on L1 (column 103, 112 px under P3's Armadillo and its bats) for 2,116 steps nothing touches him. Arriving by the spring and the lift at
    // clock t (the lift is at the enemies' clock, so he reaches P3 about 85 to 270 steps later), `viaLift` and the answers of the test above give each
    // start clock one of: lost on the way, no answer, an answer. A start with none waits to the next one that has one (clocks in steps, 6 apart).
    const idleOnL1 = drive(atT(mid(103), Y(29), 0), 2116, () => idle);
    expect([idleOnL1.lost, idleOnL1.states.length, last(idleOnL1.states).lives.lives]).toEqual([false, 2116, 7]);
    const verdicts = new Map<number, string>();
    const verdict = (t: number): string => {
      let v = verdicts.get(t);
      if (v === undefined) {
        const { drive: d, from } = viaLift(t);
        const a = d.lost ? undefined : answersFrom(from);
        v = d.lost ? `lost to ${d.cause}` : a!.held + a!.top > 0 ? 'answer' : 'no answer';
        verdicts.set(t, v);
      }
      return v;
    };
    const bad: [number, string, number][] = [];
    for (const t of clocks(1058)) {
      if (verdict(t) === 'answer') continue;
      let wait = 6;
      while (verdict(t + wait) !== 'answer' && wait < 2116) wait += 6;
      bad.push([t, verdict(t), wait]);
    }
    // Measured: of the 177 start clocks 64 are bad, 390 to 768 in one block, every one a life lost to the Armadillo on the walk onto P3 (none is a clock
    // with no answer: the lift's arrival differs from the arrival above), and every one waits to the same good start, 774, at most 384 steps (6.4 s) on L1.
    expect({ starts: clocks(1058).length, bad: bad.map((b) => b[1]).filter((v, i, all) => all.indexOf(v) === i), count: bad.length, first: bad[0]![0], last: bad[bad.length - 1]![0], goodAt: [...new Set(bad.map((b) => b[0] + b[2]))], maxWait: Math.max(...bad.map((b) => b[2])) }).toEqual({
      starts: 177,
      bad: ['lost to Armadillo'],
      count: 64,
      first: 390,
      last: 768,
      goodAt: [774],
      maxWait: 384,
    });
  }, 900_000);
});
