import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { enemyBox, freshEnemies, kindOf, stepEnemy } from '../sim/enemy';
import { spawn, step, type PlayerState } from '../sim/movement';
import { startRun, stepRun, type RunState } from '../sim/run';
import type { SlopeChar } from '../sim/tilemap';
import { LEVELS, SAVED_LEVELS } from './index';
import { SLOPES_ENEMIES, SLOPES_LEVEL, SLOPES_OFRENDAS, SLOPES_ROWS, SLOPES_SPAWN } from './slopes';
import { gaps } from './validate';

// GDD-MOV-09 the slopes level. The heights are the GDD's table, written here: [surface height at the tile's left edge, at its right edge] in px.
const HEIGHTS: Record<string, [number, number]> = { '/': [0, 16], '\\': [16, 0], r: [0, 8], R: [8, 16], F: [16, 8], f: [8, 0] };

/** The y of the ground at x, read from the top of x's column: the first `#` gives `row * 16`, the first slope character the slope's surface there, none gives Infinity. */
function ground(x: number): number {
  const col = Math.floor(x / TILE);
  for (let row = 0; row < SLOPES_ROWS.length; row++) {
    const c = SLOPES_ROWS[row]![col]!;
    if (c === '#') return row * TILE;
    const h = HEIGHTS[c];
    if (h) return (row + 1) * TILE - (h[0] + ((h[1] - h[0]) * (x - col * TILE)) / TILE);
  }
  return Infinity;
}

const right = { move: 1, jumpHeld: false };
const far = (): PlayerState => spawn(SLOPES_SPAWN.x, SLOPES_SPAWN.y);

describe('GDD-MOV-09 the slopes level', () => {
  it('GDD-MOV-09 the slopes level is a 30 by 17 World 1 test level with no next level, never saved', () => {
    expect([SLOPES_LEVEL.world.width, SLOPES_LEVEL.world.height]).toEqual([30, 17]);
    const entry = LEVELS.find((e) => e.id === 'slopes');
    expect(entry).toBeDefined();
    expect(entry!.world).toBe(1);
    expect(entry!.test).toBe(true);
    expect(entry!.level).toBe(SLOPES_LEVEL);
    expect(entry!.next).toBeUndefined();
    expect(entry!.tips).toBeUndefined();
    expect('slopes' in SAVED_LEVELS).toBe(false);
  });

  it('GDD-MOV-09 the slopes level has the hill, the dune, the two bumps and the gap of the GDD', () => {
    const slopes: string[] = [];
    const solid: string[] = [];
    for (let row = 0; row < 17; row++) {
      for (let col = 0; col < 30; col++) {
        const slope: SlopeChar | null = SLOPES_LEVEL.world.slopeAt(col, row);
        if (slope !== null) slopes.push(`${col},${row},${slope}`);
        else if (row < 14 && SLOPES_LEVEL.world.solidTile(col, row)) solid.push(`${col},${row}`);
      }
    }
    const wantSlopes = ['4,13,/', '5,12,/', '8,12,\\', '9,13,\\', '12,13,r', '13,13,R', '17,13,F', '18,13,f', '20,13,/', '21,13,\\', '25,13,/', '26,13,\\'];
    const wantSolid = ['6,12', '7,12', '5,13', '6,13', '7,13', '8,13', '14,13', '15,13', '16,13'];
    expect(slopes).toHaveLength(wantSlopes.length);
    expect(new Set(slopes)).toEqual(new Set(wantSlopes));
    expect(solid).toHaveLength(wantSolid.length);
    expect(new Set(solid)).toEqual(new Set(wantSolid));
    expect(gaps(SLOPES_LEVEL.world)).toEqual([{ col: 22, width: 3 }]);
  });

  it('GDD-MOV-09 the slopes level starts at column 3 with ofrendas at columns 11, 15 and 19 on flat ground', () => {
    expect(SLOPES_SPAWN).toEqual({ x: 56, y: 224 });
    expect(SLOPES_OFRENDAS.map((o) => o.x)).toEqual([184, 248, 312]);
    expect(SLOPES_OFRENDAS.map((o) => o.y)).toEqual([224, 208, 224]);
    expect(SLOPES_LEVEL.exit).toBeUndefined();
    expect(SLOPES_LEVEL.abilities).toBeUndefined();
    expect(SLOPES_ENEMIES.map((e) => [kindOf(e), e.x, e.y])).toEqual([['alacran', 120, 192], ['tlacuache', 472, 224]]);
  });

  it('GDD-MOV-09 slopes route: holding right he runs over every slope on the ground and a jump crosses the gap', () => {
    const L = { ...SLOPES_LEVEL, enemies: [] };
    let run: RunState = startRun(L);
    const xs = [run.player.x];
    let jumpAt = -1;
    let landedAt = -1;
    let reachedEnd = -1;
    for (let i = 0; i < 1000 && reachedEnd < 0; i++) {
      const jumping = jumpAt >= 0 && landedAt < 0;
      const press = jumpAt < 0 && run.player.x >= 340;
      const next = stepRun(run, { move: 1, jumpHeld: press || jumping }, L);
      if (press) jumpAt = i;
      else if (jumping && next.player.grounded && i > jumpAt + 1) landedAt = i;
      expect(next.phase, `step ${i}`).toBe('playing');
      expect(next.lives.lives, `step ${i}`).toBe(7);
      if (jumpAt < 0 || (landedAt >= 0 && i > landedAt)) expect(next.player.grounded, `step ${i}`).toBe(true);
      if (jumpAt < 0 && i >= 9) expect(next.player.x - run.player.x, `step ${i}`).toBeCloseTo(2, 9);
      if (landedAt === i) {
        expect(next.player.x).toBeCloseTo(409, 9);
        expect(next.player.y).toBeCloseTo(215, 9);
      }
      run = next;
      xs.push(run.player.x);
      if (run.player.x >= 474 - 1e-6) reachedEnd = i;
    }
    expect(jumpAt).toBeGreaterThan(0);
    expect(xs[jumpAt]).toBeCloseTo(341, 9);
    expect(landedAt).toBeGreaterThan(jumpAt);
    expect(reachedEnd).toBeGreaterThan(landedAt);
    expect(run.player.x).toBeCloseTo(474, 9);
  });

  it('GDD-MOV-09 slopes timing: the 45 degree hill takes 48 steps, as long as flat ground', () => {
    let s = far();
    const xs = [s.x];
    for (let i = 0; i < 100; i++) {
      s = step(s, right, SLOPES_LEVEL.world);
      xs.push(s.x);
    }
    const first = (x: number): number => xs.findIndex((v) => v >= x);
    const a = first(64);
    const b = first(160);
    expect(a).toBeGreaterThan(0);
    expect(b - a).toBe(48);
  });

  it('GDD-MOV-09 the slopes level Alacrán walks from the left edge to the gap, feet on the ground every step', () => {
    const def = SLOPES_ENEMIES[0]!;
    let s = freshEnemies([def])[0]!;
    const xs: number[] = [];
    for (let i = 0; i < 3000; i++) {
      s = stepEnemy(def, s, SLOPES_LEVEL.world, far());
      xs.push(s.x);
      expect(enemyBox(def, s).y1, `step ${i}`).toBeCloseTo(ground(s.x), 9);
    }
    expect(Math.min(...xs)).toBeCloseTo(7, 9);
    expect(Math.max(...xs)).toBeCloseTo(345, 9);
  });

  it('GDD-MOV-09 the slopes level Tlacuache walks the second bump', () => {
    const def = SLOPES_ENEMIES[1]!;
    let s = freshEnemies([def])[0]!;
    const xs: number[] = [];
    for (let i = 0; i < 3000; i++) {
      s = stepEnemy(def, s, SLOPES_LEVEL.world, far());
      xs.push(s.x);
      expect(s.gait!.phase, `step ${i}`).toBe('walk');
      expect(enemyBox(def, s).y1, `step ${i}`).toBeCloseTo(ground(s.x), 9);
    }
    expect(Math.min(...xs)).toBeCloseTo(408, 9);
    expect(Math.max(...xs)).toBeCloseTo(472, 9);
  });
});
