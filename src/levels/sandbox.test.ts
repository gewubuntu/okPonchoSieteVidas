import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { blockAt } from '../sim/block';
import { freshEnemies, stepEnemy, touchesEnemy } from '../sim/enemy';
import { spawn, type PlayerState } from '../sim/movement';
import { touchesHilo } from '../sim/hilo';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import {
  SANDBOX_ABILITIES,
  SANDBOX_BLOCKS,
  SANDBOX_CRUMBLES,
  SANDBOX_DOORS,
  SANDBOX_ENEMIES,
  SANDBOX_FRAGILES,
  SANDBOX_HILOS,
  SANDBOX_KEYS,
  SANDBOX_OFRENDAS,
  SANDBOX_PINATAS,
  SANDBOX_PLATFORMS,
  SANDBOX_ROWS,
  SANDBOX_SPAWN,
  SANDBOX_SPIKES,
  SANDBOX_SPRINGS,
  SANDBOX_TACOS,
} from './sandbox';

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

describe('GDD-ENM-02 the sandbox Tlacuache and its ledge (row 6, columns 25 to 29, x 400 to 480, top y = 96)', () => {
  const tlacuache = SANDBOX_ENEMIES.find((e) => e.kind === 'tlacuache')!;
  const away = standing(24, 14 * TILE);

  it('stands on the ledge and walks it end to end without leaving it', () => {
    expect(tlacuache.y).toBe(6 * TILE);
    let s = freshEnemies([tlacuache])[0]!;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 2000; i++) {
      s = stepEnemy(tlacuache, s, world, away);
      min = Math.min(min, s.x);
      max = Math.max(max, s.x);
    }
    expect(min).toBeCloseTo(400 + 8, 6); // it turns where the ground under its leading edge ends
    expect(max).toBe(480 - 8); // flush against the right edge of the level
  });

  it('Poncho gets onto it from the moving platform at its right end, with a jump to the right', () => {
    const sandbox: Level = { world, spawn: SANDBOX_SPAWN, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: SANDBOX_PLATFORMS, tacos: [], pinatas: SANDBOX_PINATAS, doors: [], keys: [], fragiles: [], enemies: [] };
    // The platform reaches its right end (x 336 to 384) after 96 px at 40 px/s, 144 steps.
    let r: RunState = { ...startRun(sandbox), player: standing(378, 128), platformTick: 144 };
    let landed = false;
    for (let i = 0; i < 120 && !landed; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i < 20 }, sandbox);
      landed = r.player.grounded && r.player.y === 96;
    }
    expect(landed).toBe(true);
    expect(r.player.x).toBeGreaterThan(400);
  });

  it('is out of the Zopilote\'s reach: it never spots Poncho anywhere on the ledge', () => {
    for (let x = 406; x <= 474; x += 4) expect(spotted(standing(x, 6 * TILE)), `x = ${x}`).toBe(false);
  });
});

describe('GDD-WLD-05 the sandbox moving block', () => {
  const block = SANDBOX_BLOCKS[0]!;
  const sandbox: Level = { world, spawn: SANDBOX_SPAWN, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [], blocks: SANDBOX_BLOCKS };
  const idle = { move: 0, jumpHeld: false };
  const play = (r: RunState, steps: number): RunState[] => {
    const states: RunState[] = [];
    for (let i = 0; i < steps; i++) states.push((r = stepRun(r, idle, sandbox)));
    return states;
  };

  it('is one tile square in column 28, from flush under the Tlacuache\'s ledge down to the floor', () => {
    expect(SANDBOX_BLOCKS).toHaveLength(1);
    expect(blockAt(block, 0)).toEqual({ x: 448, y: 112, w: 16, h: 16 });
    expect(world.solidTile(28, 6)).toBe(true); // the ledge, whose underside is y = 112
    expect(world.solidTile(28, 7)).toBe(false);
    const end = blockAt(block, 144);
    expect(end.y + end.h).toBe(224); // resting on the floor
    expect(world.solidTile(28, 14)).toBe(true);
  });

  it('crushes Poncho standing on the floor under it, before it reaches the floor', () => {
    const states = play({ ...startRun(sandbox), player: standing(456, 224) }, 144);
    expect(states[143]!.lives.lives).toBe(6);
    expect(states.findIndex((s) => s.phase === 'respawning')).toBeGreaterThan(0);
  });

  it('never crushes Poncho standing in column 29 beside it, over two round trips', () => {
    const states = play({ ...startRun(sandbox), player: standing(472, 224) }, 576);
    expect(states.every((s) => s.lives.lives === 7 && s.phase === 'playing')).toBe(true);
  });

  it('crushes Poncho riding it up into the ledge, before it reaches its top end', () => {
    const states = play({ ...startRun(sandbox), player: standing(456, 208), platformTick: 144 }, 144);
    const crushed = states.findIndex((s) => s.phase === 'respawning');
    expect(crushed).toBeGreaterThan(0);
    expect(states[crushed]!.lives.lives).toBe(6);
    expect(states[crushed - 1]!.player.grounded).toBe(true);
  });
});

const tiles = (list: readonly { col: number; row: number }[]) => list.map((t) => `${t.col},${t.row}`);

describe('GDD-WLD-04 the sandbox hilos', () => {
  it('has 20', () => {
    expect(SANDBOX_HILOS.length).toBe(20);
  });

  it('each sits in an empty tile', () => {
    const doorTiles = SANDBOX_DOORS.flatMap((d) => Array.from({ length: d.height }, (_, i) => ({ col: d.col, row: d.row + i })));
    const taken = new Set([
      ...tiles(SANDBOX_SPRINGS),
      ...tiles(doorTiles),
      ...tiles(SANDBOX_FRAGILES),
      ...tiles(SANDBOX_PINATAS),
      ...tiles(SANDBOX_CRUMBLES),
      ...tiles(SANDBOX_SPIKES),
      ...tiles(SANDBOX_KEYS),
      ...tiles(SANDBOX_TACOS),
    ]);
    for (const h of SANDBOX_HILOS) {
      const at = `${h.col},${h.row}`;
      expect(world.solidTile(h.col, h.row), `solid at ${at}`).toBe(false);
      expect(taken.has(at), `shared with another object at ${at}`).toBe(false);
      for (const o of SANDBOX_OFRENDAS) {
        // An ofrenda stands on the floor, one tile wide and two tall.
        const inOfrenda = h.col === Math.floor(o.x / TILE) && h.row >= o.y / TILE - 2 && h.row < o.y / TILE;
        expect(inOfrenda, `inside an ofrenda at ${at}`).toBe(false);
      }
    }
  });

  it('none is touched by Poncho standing at the spawn or at any ofrenda, so a respawn never lands on one', () => {
    for (const p of [SANDBOX_SPAWN, ...SANDBOX_OFRENDAS]) for (const h of SANDBOX_HILOS) expect(touchesHilo(standing(p.x, p.y), h), `hilo ${h.col},${h.row} at ${p.x}`).toBe(false);
  });

  it('the pit hilo is collected by a jump over the cactus buddy that comes down on the spring', () => {
    const sandbox: Level = {
      world,
      spawn: SANDBOX_SPAWN,
      ofrendas: SANDBOX_OFRENDAS,
      spikes: SANDBOX_SPIKES,
      crumbles: SANDBOX_CRUMBLES,
      springs: SANDBOX_SPRINGS,
      platforms: SANDBOX_PLATFORMS,
      blocks: SANDBOX_BLOCKS,
      tacos: SANDBOX_TACOS,
      pinatas: SANDBOX_PINATAS,
      doors: SANDBOX_DOORS,
      keys: SANDBOX_KEYS,
      fragiles: SANDBOX_FRAGILES,
      enemies: SANDBOX_ENEMIES,
      hilos: SANDBOX_HILOS,
      abilities: SANDBOX_ABILITIES,
    };
    const pit = SANDBOX_HILOS.findIndex((h) => h.col === 15);
    expect(pit).toBeGreaterThanOrEqual(0);
    // From the top of the 2-tile wall (columns 10 and 11, top y = 192), holding right with jump held for 12 steps.
    let r: RunState = { ...startRun(sandbox), player: standing(166, 12 * TILE) };
    expect(r.hilosTaken[pit]).toBe(false);
    // Stop at the first landing past the pit (it ends at x = 272), asserting every step on the way.
    let landed = false;
    for (let i = 0; i < 200 && !landed; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i < 12 }, sandbox);
      expect(r.phase, `step ${i}`).toBe('playing');
      expect(r.lives.lives, `step ${i}`).toBe(7);
      landed = r.player.grounded && r.player.x > 272;
    }
    expect(landed).toBe(true);
    expect(r.hilosTaken[pit]).toBe(true);
  });
});
