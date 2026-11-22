import { describe, expect, it } from 'vitest';
import { catorcePose } from '../ui/catorcePose';
import { CATORCE_LOOKS } from '../ui/catorceLooks';
import { runBot } from './bots';
import { base, fightTasks } from './level3-4.drive';
import { LEVEL_3_4 } from './level3-4';

// GDD-BOS-04, L-059: the frames of assets/sprites/boss/la-catorce.png (scripts/art/catorce.test.mjs pins their reach: everything inside her
// 64 x 32 box but the slam's squash, 1 px ahead of her front) and of assets/sprites/boss/catorce-plume.png, over the real
// fight: the floor-free bot's whole fight (`level3-4.bot.test.ts`, 1367 steps to the clear), every look her pose picks on the way. The room she
// has: the screen, x 0 to 480, the floor's top, y 224, and for the plume the gap between her box's top and home's underside (y 176).
const DEF = LEVEL_3_4.catorce!;
const HOME_UNDERSIDE = 176;
const FLOOR = 224;

describe('GDD-BOS-04 3-4 her sprite', () => {
  it('GDD-BOS-04 3-4 her frame fits the room at every step of the fight', () => {
    const b = runBot(fightTasks(), base(), LEVEL_3_4, 4000);
    expect(b.end.phase).toBe('clear');
    expect(b.states).toHaveLength(1367);
    const looks = new Set<string>();
    for (const [i, r] of [base(), ...b.states].entries()) {
      const pose = catorcePose(DEF, r.catorce!);
      const at = `step ${i} ${pose.look}`;
      looks.add(pose.look);
      expect(CATORCE_LOOKS, at).toContain(pose.look);
      // Her drawn reach: her box, and 1 px ahead of her front in the slam's squash (she has turned by then, so ahead is into the room).
      const ahead = pose.look.startsWith('slam') ? 1 : 0;
      const x0 = pose.body.x0 - (pose.left ? ahead : 0);
      const x1 = pose.body.x1 + (pose.left ? 0 : ahead);
      expect([x0 >= 0, x1 <= 480, pose.body.y1 <= FLOOR], at).toEqual([true, true, true]);
      if (pose.plume) {
        expect([pose.plume.box.y0 >= HOME_UNDERSIDE, pose.plume.box.y1 <= pose.body.y0 + 5], `${at} plume`).toEqual([true, true]);
      }
    }
    // Every kind of look is posed over the fight: the sim reaches them all.
    const kinds = new Set([...looks].map((l) => l.replace(/\d.*$/, '')));
    expect(kinds).toEqual(new Set(['defeated', 'defeatedWhite', 'hurt', 'hurtWhite', 'rest', 'run', 'slam', 'slamRed', 'spin', 'spinRed', 'wreck']));
    expect(looks.has('slamRed1')).toBe(true);
  });
});
