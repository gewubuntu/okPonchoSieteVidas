// L-024: the simulation tests run a second time (`npm run test:abilities`, in the gate) with every progression ability on,
// so a new ability meets every older rule's tests and a new rule meets every ability. A test that may not run with an
// ability on is listed in ABILITY_OFF_TESTS with its reason; `all-abilities.test.ts` fails when a listed test is gone.
import { expect, vi } from 'vitest';
import type * as Movement from './movement';
import type { Abilities } from './movement';

/** Every ability on. `Required` makes the typecheck fail here when a new ability is added and left out. */
export const ALL_ABILITIES = { glide: true, wallCling: true } as const satisfies Required<Abilities>;

/** Full names (`describe > test`) of the tests that keep the abilities their own code gives. */
export const ABILITY_OFF_TESTS: ReadonlyMap<string, string> = new Map([
  ['GDD-MOV-08 wall cling > only with the ability', 'tests the ability off'],
  ['GDD-MOV-08 wall kick > only with the ability: without it a jump in the air beside a wall does nothing', 'tests the ability off'],
  ['GDD-MOV-08 in a run > a level turns it on; left out, it is off', 'tests the ability off'],
  [
    'GDD-MOV-07 glide in a run > a level can turn the glide on (the sandbox does, until worlds unlock it, GDD-PRG-01); a level that does not, does not glide',
    'tests the ability off',
  ],
  ['GDD-AUD-02 sound triggers > a wall kick plays jump', 'compares a wall kick with a bare world that has no wall cling'],
  ['GDD-MOV-02 and GDD-WLD-03 against real tiles > a running jump cannot cross a gap 6 tiles wide', 'holds jump while falling, so the glide carries him'],
  [
    'GDD-TEC-05 derived jump numbers (GDD section 4) > full jump at full run speed covers about 66 to 68 px, within one step of travel',
    'holds jump while falling, so the glide carries him',
  ],
  [
    'GDD-WLD-05 spring > a jump pressed just before landing (a timed press) > a press 6 or more steps early, or after the landing, gives the plain 480',
    'holds jump while falling, so the glide changes when he lands',
  ],
]);

vi.mock('./movement', async (importOriginal) => {
  const m = await importOriginal<typeof Movement>();
  const step: typeof m.step = (prev, input, world, abilities) =>
    ABILITY_OFF_TESTS.has(expect.getState().currentTestName ?? '')
      ? m.step(prev, input, world, abilities)
      : m.step(prev, input, world, { ...ALL_ABILITIES, ...abilities });
  return { ...m, step };
});
