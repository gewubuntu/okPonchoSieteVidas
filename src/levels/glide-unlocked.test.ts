import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startRun, stepRun } from '../sim/run';
import { GLIDE_OFF_TESTS } from './glide-unlocked.setup';
import { LEVEL_1_1 } from './level1-1';

// GDD-PRG-01: the opt-out list of the glide run names real tests of the level files it runs, so a renamed or deleted test cannot leave a
// stale entry behind (as `src/sim/all-abilities.test.ts` checks its own list).
describe('GDD-PRG-01 the glide-unlocked run', () => {
  const sources = readdirSync(new URL('.', import.meta.url))
    .filter((f) => /^level[0-2]-\d\.test\.ts$/.test(f))
    .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'));

  it('opts out only tests that exist, each with a reason', () => {
    expect(sources.length).toBeGreaterThan(0);
    for (const [name, reason] of GLIDE_OFF_TESTS) {
      const parts = name.split(' > ');
      // All in one file, each part after the one before it, as a describe's name comes before its tests'.
      const inOrder = (s: string) => parts.reduce((at, part) => (at < 0 ? -1 : s.indexOf(`'${part}'`, at)), 0) >= 0;
      expect(sources.some(inOrder), name).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  it.runIf(process.env['PONCHO_GLIDE_UNLOCKED'] === '1')('switches the glide on in 1-1, whose own data has none', () => {
    // From the spawn, jump held: in 1-1 as written he never glides (`levels.test.ts`); under the glide run he does.
    let r = startRun(LEVEL_1_1);
    let glided = false;
    for (let i = 0; i < 60; i++) {
      r = stepRun(r, { move: 0, jumpHeld: true }, LEVEL_1_1);
      glided ||= r.player.gliding === true;
    }
    expect(glided).toBe(true);
  });
});
