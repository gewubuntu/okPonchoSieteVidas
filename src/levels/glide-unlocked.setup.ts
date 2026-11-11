// GDD-PRG-01: the level tests of Worlds 0 to 2 run a second time (`npm run test:glide`) with the glide on, as it is in every level once
// 2-4 is cleared. A test that may not run with it on is listed in GLIDE_OFF_TESTS with its reason; `glide-unlocked.test.ts` fails when a
// listed test is gone.
import { expect, vi } from 'vitest';
import type * as Movement from '../sim/movement';

/** Full names (`describe > test`) of the tests that keep the abilities their level gives. */
export const GLIDE_OFF_TESTS: ReadonlyMap<string, string> = new Map([
  [
    'GDD-WLD-07 playing 1-1 > GDD-WLD-07 1-1 in Taco, a claw from the right end of the 2-tile wall opens the piñata at column 75, and a hop onto it takes the chile',
    'holds jump 30 steps for a hop onto the piñata; with the glide he has not taken the chile by then',
  ],
  [
    'GDD-WLD-08 playing 1-2 > GDD-PWR-05 1-2 in Taco, a claw from the right end of the left pen wall opens the piñata at column 65, and a hop onto it takes the chile',
    'holds jump 30 steps for a hop onto the piñata; with the glide he has not taken the chile by then',
  ],
  [
    'GDD-WLD-09 playing 1-3 > GDD-WLD-09 1-3 in Taco a claw from the right end of the 2-tile wall opens the piñata, and a hop onto it takes the chile',
    'holds jump 30 steps for a hop onto the piñata; with the glide he has not taken the chile by then',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-WLD-12 2-1 Ki: holding jump on the first awning climbs the ladder, and its column of hilos gives one hilo per beat',
    'holds jump through the falls between rebounds; the glide slows each fall, and fewer rebounds come in the steps it measures',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-PWR-05 GDD-WLD-10 2-1 Ki: a first tier rebound opens the piñata over the first awning and a jump does not, and the taco falls clear of the awning',
    'holds jump through the fall onto the awning; with the glide the piñata does not open in the steps it measures',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-WLD-12 2-1 Sho: holding jump and right from the floor, the stall row climbs tiers 1 2 and 3 and the ladder awning carries him onto the first rooftop',
    'holds jump and right through the falls; with the glide no tier rebound comes on the stall row',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-WLD-10 GDD-CMB-01 2-1 Sho: the rung, a tier 1 rebound onto the Paloma, held through the stomp, then tier 2 off the landing awning onto the third rooftop',
    'holds jump through the stomp and the falls; with the glide his first rebound is off another awning',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-WLD-12 GDD-ENM-03 2-1 Sho: over a whole round of the rung Paloma, the take-off rebound lands on it or beside it, and only a near miss is a hit',
    'holds jump through the fall onto the Paloma; with the glide the counts of landings on it, beside it and hits change',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-WLD-10 2-1 Ten: every running jump that reaches the pit awning crosses the pit held, which a 9-tile pit would not allow',
    'asserts which jumps fall into a wider pit a plain jump and rebound cannot cross; with the glide the jumps that cross change',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-ENM-03 GDD-CMB-01 2-1 Ten: from the crate, a jump onto the pit Paloma stomps it, and held through the stomp it is a stepping stone onto the pit awning',
    'holds jump through the stomp; with the glide he loses a life where the test expects none',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-LIFE-03 2-1 Ten: three held rebounds in place on the pit awning reach the veladora at the top of the third and not before, and its column gives one hilo per beat',
    'holds jump through the falls between rebounds; the glide slows each fall, and fewer rebounds come in the steps it measures',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-WLD-12 2-1 can be played from the start to the exit with all seven lives, every ofrenda and every Paloma clawed, in under 3000 steps',
    'plays the plain-jump route; its glided twin, GDD-PRG-01, plays the level with the glide (the plain route\'s step count is pinned)',
  ],
  [
    'GDD-WLD-12 playing 2-1 > GDD-WLD-04 2-1 the playthrough collects 44 hilos and the two in-place climbs the other 6',
    'counts the hilos of the plain-jump play-through; with the glide it misses more of them',
  ],
  [
    'GDD-WLD-13 playing 2-2: shō > GDD-WLD-11 2-2 on every floor pit the bot claws from the edge and the bridge front stays ahead of his centre',
    'a scripted route out of step with the glide: its jumps held through falls glide past their landings; the twin lets go in falls',
  ],
  [
    'GDD-WLD-13 playing 2-2: ketsu, rollos with awnings > GDD-WLD-13 2-2 the aisle: no jump from its bridge reaches the cordel, a held rebound off the first awning does',
    'holds jump through the fall onto the awning; with the glide the held rebound does not land him on the cordel',
  ],
  [
    'GDD-WLD-13 2-2 played through > GDD-WLD-13 2-2 the bot plays the main route from the start to the exit through every ofrenda, losing no life',
    'a scripted route out of step with the glide: its jumps held through falls glide past their landings; the twin lets go in falls',
  ],
  [
    'GDD-WLD-13 2-2 played through > GDD-WLD-13 2-2 on the way it unrolls every rollo, the fireball one by a fireball, and collects 49 hilos',
    'a scripted route out of step with the glide: its jumps held through falls glide past their landings; the twin lets go in falls',
  ],
  [
    'GDD-WLD-13 2-2 played through > GDD-WLD-13 2-2 the expert route takes the veladora off the main route and still reaches the exit, and between them every hilo is taken',
    'a scripted route out of step with the glide: its jumps held through falls glide past their landings; the twin lets go in falls',
  ],
  [
    'GDD-WLD-13 2-2 played through > GDD-WLD-13 2-2 after waiting 1, 2, 3 or 4 s at the start the bot still reaches the exit losing no life',
    'a scripted route out of step with the glide: its jumps held through falls glide past their landings; the twin lets go in falls',
  ],
  [
    'GDD-WLD-14 2-3 the torn chain over the chimneys (the Shō) > GDD-WLD-10 2-3 holding jump and right from the roof edge rebounds on T2, T3 and T4 at tiers 1, 2, 3, tears each, and lands on the roof',
    'holds jump through the falls between rebounds; the glide slows each fall, and fewer rebounds come in the steps it measures',
  ],
  [
    'GDD-WLD-14 2-3 the mixed chain: stripes to stop on, patches to bounce on (the Shō) > GDD-WLD-10 2-3 a jump from Wa that comes down on Tb is a tier 1 rebound that peaks 2.9 px under the tall chimney and costs a life',
    'holds jump through the fall onto Tb; with the glide he keeps the life the test expects him to lose',
  ],
  [
    'GDD-WLD-14 2-3 the mixed chain: stripes to stop on, patches to bounce on (the Shō) > GDD-WLD-10 2-3 hopping in place on Wa starts the chain: Wa tier 1, then Tb tier 2 over the tall chimney; let go past it, he settles on Wc',
    'holds jump through the falls between rebounds; the glide slows each fall, and fewer rebounds come in the steps it measures',
  ],
  [
    'GDD-WLD-14 2-3 the mixed chain: stripes to stop on, patches to bounce on (the Shō) > GDD-ENM-03 2-3 the Trompo on L never reaches Poncho waiting on Wc; going as it turns at the pit edge lands him behind it',
    'holds jump and right until he lands on L; with the glide the measured count of takeoffs that are hit changes',
  ],
  [
    'GDD-WLD-14 2-3 the exam (the Ketsu) > GDD-WLD-11 2-3 without R4, T5 one bounce never reaches the exit roof, wherever it is steered',
    'holds jump through the bounce off T5; with the glide he keeps the life the test expects him to lose',
  ],
  [
    'GDD-WLD-04 2-3 hilos > GDD-WLD-04 2-3 the playthrough takes 40 hilos: all but the Ki two columns and the top of Wa column (the ladder and the chain take them) and the Fuego pair',
    'counts the hilos of the plain-jump play-through; with the glide it misses more of them',
  ],
  [
    'GDD-WLD-14 playing 2-3 > GDD-WLD-14 2-3 the bot plays from the start through every ofrenda to the exit with all seven lives, in under 2700 steps',
    'plays the plain-jump route; its glided twin, GDD-PRG-01, plays the level with the glide (the plain route\'s step limit)',
  ],
  [
    'GDD-BOS-03 playing 2-4 > GDD-BOS-03 2-4 can be won from the spawn with all seven lives in under 1800 steps',
    'plays the plain-jump route; its glided twin, GDD-PRG-01, plays the level with the glide (the plain fight\'s hit steps are pinned)',
  ],
]);

vi.mock('../sim/movement', async (importOriginal) => {
  const m = await importOriginal<typeof Movement>();
  const step: typeof m.step = (prev, input, world, abilities, runSpeed) =>
    GLIDE_OFF_TESTS.has(expect.getState().currentTestName ?? '')
      ? m.step(prev, input, world, abilities, runSpeed)
      : m.step(prev, input, world, { ...abilities, glide: true }, runSpeed);
  return { ...m, step };
});
