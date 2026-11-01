import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLIDE } from '../config/tuning';
import { ABILITY_OFF_TESTS } from './all-abilities.setup';
import { flatWorld, spawn, step } from './movement';

// L-024: the opt-out list of the all-abilities run names real tests, so a renamed or deleted test cannot leave a stale
// entry behind. (The setup's `Required<Abilities>` covers the other direction: a new ability must be switched on there.)
describe('L-024 the all-abilities run', () => {
  const sources = readdirSync(new URL('.', import.meta.url))
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'));

  it('opts out only tests that exist, each with a reason', () => {
    expect(ABILITY_OFF_TESTS.size).toBeGreaterThan(0);
    for (const [name, reason] of ABILITY_OFF_TESTS) {
      const parts = name.split(' > ');
      for (const part of parts) expect(sources.some((s) => s.includes(`'${part}'`)), `${name}: "${part}"`).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  it.runIf(process.env['PONCHO_ALL_ABILITIES'] === '1')('switches the abilities on for a test that names none', () => {
    const falling = { ...spawn(0, 0), y: -400, vy: 300, grounded: false, jumpWasHeld: true, jumpHeldSteps: GLIDE.holdSteps };
    expect(step(falling, { move: 0, jumpHeld: true }, flatWorld(0)).gliding).toBe(true);
  });
});
