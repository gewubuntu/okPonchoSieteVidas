import { describe, expect, it } from 'vitest';
import { RUN } from '../config/tuning';
import { apart, clocks, drive, idle, jumper, last, onA, onGroundAt, right, telegraphed, lostToVulture, Y } from './level3-3.drive';

// GDD-WLD-18, phase V2: a jump under the Zopilote (108 px over P5 at its lowest, centred on x = 3024, its sight x 2880 to 3168), over every take-off
// 0.2 tile apart (L-014) and every JUMP_STEPth clock. Alone in its file: it is the longest sweep, and vitest runs the 3-3 files in parallel.

const JUMP_STEP = 144;

interface JumpTally {
  flights: number;
  telegraph: number;
  telegraphClocks: number;
  lostInFlight: number;
  lostOther: number;
  standFollowed: number;
  standLost: number;
  standLostClocks: number;
  walkFollowed: number;
  walkLost: number;
  walkLostClocks: number;
  walkNoA: number;
}

describe('GDD-WLD-18 level 3-3 the vulture over a jump', () => {
  it('GDD-WLD-18 3-3 the vulture: a jump under it is seen, and standing after it costs the life, at every 144th clock (step 144, 50 clocks)', () => {
    // Held and plain jumps, standing and running (right held, at the run speed), from take-offs 0.2 tile (3.2 px) apart across its reach, x 2880 to 3168,
    // K3 parked at its buffer (the take-offs at x 2880 to 2944 that stand in its parked cart and ringtail are K3's: `lostOther`, 7 of the 91 standing and
    // 9 running). A jump lifts his centre through the band it reads (more than 12 px up, over its lowest point), so it sees him while its middle is
    // within 96 px of him. Over every 144th clock (50 of the 1,200; step 144): at step 6 this drive is some 90 minutes (91 take-offs, four kinds, 1,200
    // clocks, then 300 steps standing and up to 1,200 walking on to A after each), alone in this file to keep it within 300 s.
    // Per kind: flights, flights with a telegraph (and the clocks with any), life lost in the flight, flights lost to K3, then after each telegraphed
    // flight that kept it: 300 steps standing, the life lost to the vulture (and the clocks with any), and walking right on to A, the life lost to it
    // (and the clocks with any) and the walks that reached neither A nor a loss.
    const xs = apart(2880, 3168);
    const tally: Record<string, JumpTally> = {};
    for (const kind of ['held', 'top'] as const) {
      for (const run of [false, true]) {
        const k: JumpTally = { flights: 0, telegraph: 0, telegraphClocks: 0, lostInFlight: 0, lostOther: 0, standFollowed: 0, standLost: 0, standLostClocks: 0, walkFollowed: 0, walkLost: 0, walkLostClocks: 0, walkNoA: 0 };
        tally[`${kind} ${run ? 'running' : 'standing'}`] = k;
        for (const t of clocks(7200, JUMP_STEP)) {
          let [tele, stand, walk] = [false, false, false];
          for (const x of xs) {
            const from = onGroundAt(x, Y(25), t, run ? RUN.maxSpeed : 0, 'K3');
            const jump = jumper(kind, run ? 1 : 0);
            let air = false;
            const d = drive(from, 400, jump, (r, i) => {
              if (!r.player.grounded) air = true;
              return air && r.player.grounded && i > 0;
            });
            k.flights++;
            if (telegraphed(d.states)) {
              k.telegraph++;
              tele = true;
            }
            if (d.lost) {
              if (lostToVulture(d)) k.lostInFlight++;
              else k.lostOther++;
              continue;
            }
            if (!telegraphed(d.states)) continue;
            const end = last(d.states);
            const st = drive(end, 300, () => idle);
            k.standFollowed++;
            if (lostToVulture(st)) {
              k.standLost++;
              stand = true;
            }
            const wk = drive(end, 1200, () => right, onA);
            k.walkFollowed++;
            if (lostToVulture(wk)) {
              k.walkLost++;
              walk = true;
            } else if (!wk.lost && !onA(last(wk.states))) k.walkNoA++;
          }
          if (tele) k.telegraphClocks++;
          if (stand) k.standLostClocks++;
          if (walk) k.walkLostClocks++;
        }
      }
    }
    // The vulture takes no life in the air (it freezes 30 steps first). Standing 300 steps after the landing costs the life to it after the plain jump at every
    // telegraphed flight and every clock, after the held jump at 297 of 3,205 (all 50 clocks) from standing and 50 of 3,177 (25 clocks) from running; walking
    // right on to A loses none, for any kind. No walk misses A.
    expect(tally).toEqual({
      'held standing': {
        flights: 4550, telegraph: 3205, telegraphClocks: 50, lostInFlight: 0, lostOther: 350, standFollowed: 3205, standLost: 297, standLostClocks: 50, walkFollowed: 3205, walkLost: 0, walkLostClocks: 0, walkNoA: 0,
      },
      'held running': {
        flights: 4550, telegraph: 3177, telegraphClocks: 50, lostInFlight: 0, lostOther: 450, standFollowed: 3177, standLost: 50, standLostClocks: 25, walkFollowed: 3177, walkLost: 0, walkLostClocks: 0, walkNoA: 0,
      },
      'top standing': {
        flights: 4550, telegraph: 3017, telegraphClocks: 50, lostInFlight: 0, lostOther: 350, standFollowed: 3017, standLost: 3017, standLostClocks: 50, walkFollowed: 3017, walkLost: 0, walkLostClocks: 0, walkNoA: 0,
      },
      'top running': {
        flights: 4550, telegraph: 3085, telegraphClocks: 50, lostInFlight: 0, lostOther: 450, standFollowed: 3085, standLost: 3085, standLostClocks: 50, walkFollowed: 3085, walkLost: 0, walkLostClocks: 0, walkNoA: 0,
      },
    });
  }, 430_000);
});
