import { describe, expect, it } from 'vitest';
import { runBot, type Bot } from './bots';
import { base, fightFrom, fightTasks, ground } from './level3-4.drive';
import { LEVEL_3_4 } from './level3-4';

// GDD-BOS-04: the floor-free fight, played whole over the real arena by a bot (L-014): home, cart, perch, glide, home, three times (the GDD's "a target, for a
// bot to show"). It plays the left cart only and reads the screen (where she is and what she is doing, where the cart is), never the clock. The tasks are in
// `level3-4.drive.ts`, the moves they use are measured in `level3-4.moves.test.ts`. No protection: a touch of her costs a life.
const out = (s: string) => process.stdout.write(`${s}\n`);

/** The steps (counted from 1) on which her hits went up. */
const hitSteps = (b: Bot): number[] => b.states.flatMap((r, i) => (r.catorce!.hits > (i === 0 ? 0 : b.states[i - 1]!.catorce!.hits) ? [i + 1] : []));
/** The steps (counted from 1) on which the left cart went from `from` to `to`. */
const changes = (b: Bot, from: string, to: string): number[] => b.states.flatMap((r, i) => (i > 0 && b.states[i - 1]!.carts[0]!.phase === from && r.carts[0]!.phase === to ? [i + 1] : []));
/** The steps on which the left cart went from standing to rolling: a boarding. */
const boardings = (b: Bot): number[] => b.states.flatMap((r, i) => ((i === 0 ? 'waiting' : b.states[i - 1]!.carts[0]!.phase) === 'waiting' && r.carts[0]!.phase === 'rolling' ? [i + 1] : []));
/** The steps on which he stood on the floor's top (y 224): the floor's tiles and the two springs'. */
const onFloor = (b: Bot): number[] => b.states.flatMap((r, i) => (ground(r.player) === 'floor' ? [i + 1] : []));

describe('GDD-BOS-04 3-4 bot', () => {
  it('GDD-BOS-04 3-4 bot: the floor-free fight beats her with all seven lives', () => {
    const b = runBot(fightTasks(), base(), LEVEL_3_4, 4000);
    const hits = hitSteps(b);
    out(`GDD-BOS-04 bot: ${b.end.phase} in ${b.states.length} steps, hits on steps ${hits.join(', ')}, tasks done on ${b.marks.join(', ')}, lives ${b.end.lives.lives}, lost on ${b.lost.join(', ') || 'none'}, floor steps ${onFloor(b).length}`);
    expect(b.end.phase).toBe('clear');
    expect(b.lost).toEqual([]);
    expect(b.end.lives.lives).toBe(7);
    expect(b.end.catorce!.hits).toBe(3);
    // He never stands on the floor's top (the floor's tiles and the springs').
    expect(onFloor(b)).toEqual([]);
    // Every hit came from a cart not ridden off: the cart that broke on her was falling with `ridden` false the step before.
    expect(hits).toHaveLength(3);
    for (const h of hits) {
      const cart = b.states[h - 2]!.carts[0]!;
      expect([h, cart.phase, cart.ridden]).toEqual([h, 'falling', false]);
    }
    // Pinned: her first slam at the left stop is step 270 (armoured until then), the press lands him in the cart on step 297 and the hit is 55 steps after the
    // landing's boarding (the cart's 55 from boarding to her roof, `level3-4.windows.test.ts`): the first hit on step 352; then 877 and 1307; her defeat
    // clears the level 60 steps after the last, on step 1367. The GDD's target for a bot limited only by the armour was about 780 steps: this one is slower
    // (it rides and glides home between hits and waits for each phase's window).
    expect(hits).toEqual([352, 877, 1307]);
    expect(b.states.length).toBe(1367);
    expect(b.marks.slice(0, 4)).toEqual([270, 297, 350, 453]);
  });

  it('GDD-BOS-04 3-4 bot: each hit cost one ride, no cart missed', () => {
    const b = runBot(fightTasks(), base(), LEVEL_3_4, 4000);
    const rides = boardings(b);
    out(`GDD-BOS-04 bot: boardings on steps ${rides.join(', ')}, hits on steps ${hitSteps(b).join(', ')}`);
    // One boarding per hit, each 55 steps before its hit (boarding to her roof, `level3-4.windows.test.ts`), and the right cart never boarded (it is gone from the third hit: her defeat takes both carts).
    expect(rides).toHaveLength(hitSteps(b).length);
    expect(rides).toEqual([297, 822, 1252]);
    expect(rides.map((r, i) => hitSteps(b)[i]! - r)).toEqual([55, 55, 55]);
    expect(b.states.some((r) => r.carts[1]!.phase === 'rolling')).toBe(false);
    // Each cart leaves its rail 32 steps after its boarding and is back at its start 180 steps after it left it (CATORCE.cartReturnSteps, 3.0 s, the arena's rule,
    // not the levels' 120): on steps 509 and 1034; the third is gone with her defeat and does not come back.
    const left = changes(b, 'rolling', 'falling');
    expect(left).toEqual([329, 854, 1284]);
    expect(left.map((l, i) => l - rides[i]!)).toEqual([32, 32, 32]);
    expect(changes(b, 'gone', 'waiting')).toEqual([509, 1034]);
  });

  it('GDD-BOS-04 3-4 bot: the same fight from each start clock', { timeout: 240_000 }, () => {
    // The bot starts after waiting `w` idle steps on home, w from 0 to 450 in steps of 7. 7 shares no factor with her legs (450 in phase 1, 265, 197 and the
    // others) or the carts' return (180), so it meets every phase of her phase 1 leg (period 450, L-092); the result is the same fight, later or in the next
    // window of her phase 1 (a start after step 410 has missed the first window, which closes 140 steps after her slam at 270).
    const totals: number[] = [];
    for (let w = 0; w <= 450; w += 7) {
      const b = runBot(fightFrom(w), base(), LEVEL_3_4, 8000);
      expect(b.end.phase, `start ${w}`).toBe('clear');
      expect(b.lost, `start ${w}: lives lost`).toEqual([]);
      expect(b.end.lives.lives, `start ${w}`).toBe(7);
      expect(b.end.catorce!.hits, `start ${w}`).toBe(3);
      expect(onFloor(b), `start ${w}: steps on the floor`).toEqual([]);
      totals.push(b.states.length);
    }
    out(`GDD-BOS-04 bot: steps to the clear from each start clock: ${totals.join(' ')}`);
    // 1367 for every start up to 266 (the bot is ready before her first slam, step 270); a later start takes the first window as it finds it, as long as it
    // opens by age 140 (step 410): 1370 at w 273 up to 1497 at w 406; a start after that has missed it and waits for her second visit to the left stop
    // (slam 1170): 2267.
    expect(totals.slice(0, 39).every((n) => n === 1367)).toBe(true);
    expect(totals.slice(39, 59)).toEqual([1370, 1377, 1384, 1391, 1398, 1405, 1412, 1419, 1426, 1433, 1440, 1447, 1454, 1461, 1468, 1475, 1482, 1489, 1495, 1497]);
    expect(totals.slice(59)).toEqual([2267, 2267, 2267, 2267, 2267, 2267]);
  });
});
