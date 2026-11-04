import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { startRun, stepRun, type RunState } from '../sim/run';
import { spawn } from '../sim/movement';
import { LEVEL_1_4, LEVEL_1_4_ROWS } from './level1-4';
import { LEVEL_2_1 } from './level2-1';
import { LEVEL_2_2 } from './level2-2';
import { LEVEL_2_3 } from './level2-3';
import { LEVEL_2_4 } from './level2-4';
import { levelById } from './index';
import { gaps } from './validate';

// GDD-WLD-01: World 2's levels are stubs until they are designed: 2-1 to 2-3 three screens (90 x 17 tiles) with three ofrendas and an
// exit, 2-4 a copy of 1-4's arena with Don Zopilote standing in for World 2's boss.
const STUBS = { '2-1': LEVEL_2_1, '2-2': LEVEL_2_2, '2-3': LEVEL_2_3 };

describe('GDD-WLD-01 World 2 stubs', () => {
  for (const [id, level] of Object.entries(STUBS)) {
    it(`GDD-WLD-01 stub ${id} is 90 by 17, a World 2 level, three ofrendas, an exit at column 87, no hilos and one 4-tile gap`, () => {
      expect(levelById(id)).toMatchObject({ world: 2, test: false });
      expect(levelById(id)!.level).toBe(level);
      expect([level.world.width, level.world.height]).toEqual([90, 17]);
      expect(level.ofrendas.map((o) => o.id)).toEqual([`${id}-1`, `${id}-2`, `${id}-3`]);
      expect(level.exit).toEqual({ x: 87 * TILE + TILE / 2, y: 224 });
      expect(level.hilos).toBeUndefined();
      expect(level.enemies).toEqual([]);
      expect(gaps(level.world)).toEqual([{ col: 40, width: 4 }]);
    });
  }

  it('GDD-WLD-01 stub 2-1: a full run-up jump clears the 4-tile gap, walking on reaches the exit', () => {
    // From the floor at column 30, run right, press jump 4 px before the gap (column 40) and hold it 24 steps: he lands past the gap and
    // walks on to the exit.
    let run: RunState = { ...startRun(LEVEL_2_1), player: { ...spawn(30 * TILE, 224), grounded: true } };
    let cleared = false;
    let pressedAt = -1;
    for (let i = 0; i < 600 && !cleared; i++) {
      if (pressedAt < 0 && run.player.x >= 40 * TILE - 4) pressedAt = i;
      const jump = pressedAt >= 0 && i < pressedAt + 24;
      run = stepRun(run, { move: 1, jumpHeld: jump }, LEVEL_2_1);
      cleared = run.phase === 'clear';
      expect(run.lives.lives, `step ${i}`).toBe(7);
    }
    expect(cleared).toBe(true);
  });

  it('GDD-BOS-01 stub 2-4 is 1-4 arena with Don Zopilote, in a tile grid of its own', () => {
    expect(levelById('2-4')).toMatchObject({ world: 2, test: false });
    expect(levelById('2-4')!.next).toBeUndefined();
    expect(LEVEL_2_4.world).not.toBe(LEVEL_1_4.world);
    for (let r = 0; r < 17; r++) for (let c = 0; c < 30; c++) expect(LEVEL_2_4.world.solidTile(c, r), `${c},${r}`).toBe(LEVEL_1_4_ROWS[r]![c] === '#');
    expect({ ...LEVEL_2_4, world: null }).toEqual({ ...LEVEL_1_4, world: null });
  });
});
