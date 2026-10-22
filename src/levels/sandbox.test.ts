import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { freshEnemies, stepEnemy, touchesEnemy } from '../sim/enemy';
import { spawn, type PlayerState } from '../sim/movement';
import { parseTiles } from '../sim/tilemap';
import { SANDBOX_ENEMIES, SANDBOX_OFRENDAS, SANDBOX_ROWS, SANDBOX_SPAWN } from './sandbox';

const world = parseTiles(SANDBOX_ROWS);
const def = SANDBOX_ENEMIES.find((e) => e.kind === 'zopilote')!;
const standing = (x: number, y: number): PlayerState => ({ ...spawn(x, y), grounded: true });

/** Does the sandbox Zopilote spot Poncho standing still at (x, y) at some point in 600 steps (4 bobs), if nothing else changes? */
function spotted(p: PlayerState): boolean {
  let s = freshEnemies([def])[0]!;
  for (let i = 0; i < 600; i++) {
    s = stepEnemy(def, s, world, p);
    if (s.flight!.phase === 'telegraph') return true;
  }
  return false;
}

describe('GDD-ENM-02 the sandbox Zopilote', () => {
  it('never spots Poncho standing on the floor, wherever he is along it', () => {
    for (let x = 8; x < 30 * TILE; x += 8) expect(spotted(standing(x, 14 * TILE))).toBe(false);
  });

  it('spots him on the spring ledge, on the Alacrán platform, and in the moving platform route', () => {
    expect(spotted(standing(224, 8 * TILE))).toBe(true); // the spring ledge, columns 13 and 14
    expect(spotted(standing(140, 10 * TILE))).toBe(true); // the Alacrán's platform, at its low bob only
    expect(spotted(standing(300, 8 * TILE))).toBe(true); // the moving platform (top y = 128)
  });

  it('does not spot him on the Alacrán platform at the far left end, out of its sideways reach', () => {
    expect(spotted(standing(68, 10 * TILE))).toBe(false);
  });
});

describe('GDD-ENM-01 no enemy starts within 3 tiles of a respawn', () => {
  it('holds for every enemy in the sandbox against Poncho\'s spawn and every ofrenda', () => {
    const respawns = [SANDBOX_SPAWN, ...SANDBOX_OFRENDAS];
    for (const e of SANDBOX_ENEMIES) {
      const kind = e.kind ?? 'alacran';
      for (const r of respawns) expect(Math.hypot(e.x - r.x, e.y - r.y), `${kind} at ${e.x},${e.y} against ${r.x},${r.y}`).toBeGreaterThanOrEqual(3 * TILE);
    }
  });
});

describe('GDD-ENM-02 the sandbox cactus buddy', () => {
  const cactus = SANDBOX_ENEMIES.find((e) => e.kind === 'cactus')!;
  const state = freshEnemies([cactus])[0]!;
  it('leaves room on top of the 2-tile wall to stand on, from the wall\'s left edge (x = 160) to just short of it', () => {
    expect(cactus.y).toBe(12 * TILE); // on the wall top
    for (const x of [166, 170, 173]) expect(touchesEnemy(standing(x, 12 * TILE), cactus, state), `x = ${x}`).toBe(false);
    expect(touchesEnemy(standing(174, 12 * TILE), cactus, state)).toBe(true);
  });
});
