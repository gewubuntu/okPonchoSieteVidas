import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';
import { rolloLength } from '../sim/papel';
import { startRun, stepRun, type RunState } from '../sim/run';
import { levelById, startLevel } from './index';
import { LAB_2M_AWNINGS, LAB_2M_FLOOR, LAB_2M_LEVEL, LAB_2M_ROLLOS, LAB_2M_TOWER } from './lab2m';
import { gaps, openGaps, validateLevel } from './validate';

const level = LAB_2M_LEVEL;
const ladder = LAB_2M_AWNINGS[0]!;
const bridge = LAB_2M_ROLLOS[0]!;
const towerTop = LAB_2M_TOWER.topRow * TILE;
const towerX = LAB_2M_TOWER.col * TILE;

/**
 * The bot (L-048: it lets go of a button for a step before pressing it again). From the spawn it walks onto the middle of the ladder
 * awning's left half, jumps onto the awning and holds jump: the hold ladder (410, then 480, 540, 600). From the third held rebound it
 * holds right too, against the tower, and lands on its top. Then it walks right off the tower, along the floor under the torn awning and
 * the cordeles, stops at the rollo's post, claws the bundle while running on, and jumps once it unrolls.
 */
function bot(r: RunState, phase: { name: string }): PlayerInput {
  const p = r.player;
  switch (phase.name) {
    case 'walk':
      if (p.x < 104) return { move: 1, jumpHeld: false };
      phase.name = 'ladder';
      return { move: 0, jumpHeld: false };
    case 'ladder':
      if ((p.awningChain ?? 0) >= 3) phase.name = 'tower';
      return { move: 0, jumpHeld: true };
    case 'tower':
      if (p.grounded && p.y === towerTop) phase.name = 'post';
      return { move: 1, jumpHeld: true };
    case 'post':
      if (p.x < bridge.x - 10 || !p.grounded || p.y !== LAB_2M_FLOOR) return { move: p.x < bridge.x - 10 ? 1 : 0, jumpHeld: false };
      if (Math.abs(p.vx) > 0) return { move: 0, jumpHeld: false };
      phase.name = 'claw';
      return { move: 0, jumpHeld: false, claw: true };
    default: {
      // Runs on as soon as the claw is pressed, and jumps (held for 20 steps) once the bundle starts to unroll.
      const since = r.rollos[0]!.steps;
      return { move: 1, jumpHeld: since !== null && since < 20 };
    }
  }
}

describe('GDD-WLD-10 GDD-WLD-11 the Mercado lab, lab-2m', () => {
  it('is a World 2 test level that passes the validator, opened by its address', () => {
    const entry = levelById('lab-2m')!;
    expect(entry).toMatchObject({ world: 2, test: true });
    expect(validateLevel(entry)).toEqual([]);
    expect(startLevel('?level=lab-2m', { tutorialPlayed: true, levels: {}, worldLives: {}, worldAt: {} }).entry).toBe(entry);
  });

  it('its pits are covered: the rollo bridge entirely, the pit round the 2-tile awning but for 2 tiles a side', () => {
    expect(gaps(level.world)).toEqual([
      { col: 27, width: 6 },
      { col: 36, width: 6 },
      { col: 46, width: 4 },
    ]);
    expect(openGaps(level)).toEqual([
      { col: 36, width: 2 },
      { col: 40, width: 2 },
    ]);
  });

  it('a bot climbs the ladder to the tower top, which only a tier 3 rebound clears, and crosses the rollo bridge', () => {
    let r = startRun(level);
    const phase = { name: 'walk' };
    const states: RunState[] = [];
    for (let i = 0; i < 1500 && r.player.x < bridge.x + bridge.w + 24; i++) {
      r = stepRun(r, bot(r, phase), level);
      states.push(r);
    }
    expect(states.every((s) => s.phase === 'playing')).toBe(true);
    const speeds = states.flatMap((s, i) => (i > 0 && s.awningBounce !== states[i - 1]!.awningBounce ? [s.player.vy] : []));
    expect(speeds.slice(0, 3)).toEqual([-480, -540, -600]);
    expect(states.some((s) => s.player.grounded && s.player.y === towerTop && s.player.x > towerX - 6)).toBe(true);
    // On the bridge, on its strung part, and over the pit.
    expect(states.some((s) => s.player.grounded && s.player.y === bridge.y && s.player.x > bridge.x + 8)).toBe(true);
    expect(rolloLength(bridge, r.rollos[0]!)).toBe(bridge.w);
    expect(r.player.x).toBeGreaterThanOrEqual(bridge.x + bridge.w + 24);
    expect(ladder.y - towerTop).toBe(112); // above tier 2's 98 px, under tier 3's 120 (GDD-WLD-10)
  });

  it('tier 2 does not clear the tower: holding right from the second rebound, he falls back to the floor', () => {
    let r = startRun(level);
    const phase = { name: 'walk' };
    const states: RunState[] = [];
    for (let i = 0; i < 600; i++) {
      const input = bot(r, phase);
      if (phase.name === 'ladder' && (r.player.awningChain ?? 0) >= 2) phase.name = 'tower';
      r = stepRun(r, input, level);
      states.push(r);
    }
    expect(states.some((s) => s.player.y === towerTop)).toBe(false);
  });
});
