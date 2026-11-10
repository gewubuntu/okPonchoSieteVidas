import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { blockAt } from '../sim/block';
import { freshEnemies, stepEnemy, touchesEnemy } from '../sim/enemy';
import { spawn, type PlayerState } from '../sim/movement';
import { touchesHilo } from '../sim/hilo';
import { withPinatas } from '../sim/pinata';
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
  SANDBOX_LEVEL,
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
    expect(spotted(standing(224, 7 * TILE))).toBe(true); // the spring ledge, columns 13 and 14 (top y = 112)
    expect(spotted(standing(140, 10 * TILE))).toBe(true); // the Alacrán's platform, at the piñata on its right end
    expect(spotted(standing(300, 8 * TILE))).toBe(true); // the moving platform (top y = 128)
  });

  it('spots him on the Alacrán platform whenever it is at or below its line: on its first step, 80 px above his hurtbox centre', () => {
    const p = standing(140, 10 * TILE);
    const s = stepEnemy(def, freshEnemies([def])[0]!, world, p);
    expect(s.flight!.phase).toBe('telegraph');
    // 1 px lower, out of reach at the cruise line, so the first step does not spot him: the 80 px reach is what decides it.
    expect(stepEnemy(def, freshEnemies([def])[0]!, world, standing(140, 10 * TILE + 1)).flight!.phase).not.toBe('telegraph');
  });

  it('does not spot him on the Alacrán platform at the far left end, out of its sideways reach', () => {
    expect(spotted(standing(68, 10 * TILE))).toBe(false);
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

describe('GDD-ENM-02 the sandbox Alacrán and its platform (row 10, columns 4 to 7, then the piñata at column 8, top y = 160)', () => {
  const alacran = SANDBOX_ENEMIES.find((e) => e.kind === undefined)!;
  const away = standing(24, 14 * TILE);

  it('patrols from the platform\'s left end (x = 64) across the piñata\'s top to its right end (x = 144), turning 7 px short of each', () => {
    expect(alacran.y).toBe(160);
    expect(SANDBOX_PINATAS[0]).toEqual({ col: 8, row: 10 });
    let s = freshEnemies([alacran])[0]!;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 1200; i++) {
      s = stepEnemy(alacran, s, withPinatas(world, SANDBOX_PINATAS), away);
      min = Math.min(min, s.x);
      max = Math.max(max, s.x);
    }
    expect(min).toBe(71);
    expect(max).toBe(137);
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
    // The platform reaches its right end (x 336 to 384) after 96 px at 40 px/s, 144 steps. The piñata at column 23 (x 368 to 384,
    // y 112 to 128) stops him at x = 362, so the jump rises 16 px against its side, clears its top and comes down on the ledge.
    let r: RunState = { ...startRun(sandbox), player: standing(362, 128), platformTick: 144 };
    let landed = false;
    for (let i = 0; i < 120 && !landed; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i < 20 }, sandbox);
      landed = r.player.grounded && r.player.y === 96;
    }
    expect(landed).toBe(true);
    expect(r.player.x).toBeGreaterThanOrEqual(400); // lands at x = 400 with a 20 step hold: his middle on the ledge's edge
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
    // From the top of the 2-tile wall (columns 10 and 11, top y = 192): jump held for 12 steps, right held for the first 14 steps,
    // then let go until step 29 (he comes down on the spring at step 34 and is thrown up), then right again over the pit.
    // Holding right all the way flies past the spring (the spring ledge is 16 px higher since the body grew, GDD-MOV-06).
    let r: RunState = { ...startRun(sandbox), player: standing(166, 12 * TILE) };
    expect(r.hilosTaken[pit]).toBe(false);
    // Stop at the first landing past the pit (it ends at x = 272), asserting every step on the way.
    let landed = false;
    let launched = false;
    for (let i = 0; i < 200 && !landed; i++) {
      r = stepRun(r, { move: i < 14 || i >= 29 ? 1 : 0, jumpHeld: i < 12 }, sandbox);
      launched ||= r.player.vy <= -450; // the spring's plain launch is 480 px/s up; his own jump is 410
      expect(r.phase, `step ${i}`).toBe('playing');
      expect(r.lives.lives, `step ${i}`).toBe(7);
      landed = r.player.grounded && r.player.x > 272;
    }
    expect(landed).toBe(true);
    expect(launched).toBe(true);
    expect(r.hilosTaken[pit]).toBe(true);
  });
});

describe('GDD-PWR-05 the sandbox piñata at column 8, above the door', () => {
  it('opens when Poncho stands under it in the open door\'s column and jumps: his 32 px head is 16 px short of its underside (y = 176) before the jump', () => {
    const L = SANDBOX_LEVEL;
    let r: RunState = { ...startRun(L), player: standing(136, 14 * TILE), doorsOpen: [true] };
    expect(r.player.y - 32).toBe(192); // head 16 px under the underside, no touch
    expect(r.pinatasOpen[0]).toBe(false);
    for (let i = 0; i < 40 && !r.pinatasOpen[0]; i++) r = stepRun(r, { move: 0, jumpHeld: true }, L);
    expect(r.pinatasOpen[0]).toBe(true);
    expect(r.items).toHaveLength(1);
  });

  it('closes off the top of the door: the door (column 8, rows 11 to 13) ends right under it, and row 10 column 8 is not a level tile', () => {
    expect(SANDBOX_DOORS[0]).toEqual({ col: 8, row: 11, height: 3 });
    expect(SANDBOX_PINATAS[0]).toEqual({ col: 8, row: 10 });
    expect(SANDBOX_ROWS[10]![8]).toBe('.');
    expect(SANDBOX_ROWS[10]!.slice(4, 8)).toBe('####');
    expect(SANDBOX_ROWS[10]![9]).toBe('.'); // column 9 is open to the sky
  });

  it('opens with a claw swipe from the left edge of the 2-tile wall\'s top, facing it', () => {
    const L = SANDBOX_LEVEL;
    let r: RunState = { ...startRun(L), player: standing(166, 12 * TILE) };
    r = stepRun(r, { move: -1, jumpHeld: false }, L); // face left
    expect(r.pinatasOpen[0]).toBe(false);
    r = stepRun(r, { move: 0, jumpHeld: false, claw: true }, L);
    for (let i = 0; i < 10 && !r.pinatasOpen[0]; i++) r = stepRun(r, { move: 0, jumpHeld: false }, L);
    expect(r.pinatasOpen[0]).toBe(true);
  });
});

describe('GDD-WLD-05 the sandbox route on foot past the door and up the 2-tile wall', () => {
  it('from the spawn, holding right takes the key, opens the door and stops him against the wall; a short jump lands him on its top', () => {
    const L = SANDBOX_LEVEL;
    let r: RunState = startRun(L);
    let landed = false;
    for (let i = 0; i < 200 && !landed; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i >= 120 && i < 126 }, L);
      expect(r.phase, `step ${i}`).toBe('playing');
      expect(r.lives.lives, `step ${i}`).toBe(7);
      if (i === 119) {
        expect(r.player.grounded).toBe(true);
        expect(r.player.y).toBe(224);
        expect(r.player.x).toBe(154); // against the wall at x = 160, half width 6
        expect(r.keysTaken[0]).toBe(true);
        expect(r.doorsOpen[0]).toBe(true);
      }
      landed = i >= 120 && r.player.grounded && r.player.y === 192;
    }
    expect(landed).toBe(true);
    expect(r.player.x).toBeGreaterThanOrEqual(160);
    expect(r.player.x).toBeLessThanOrEqual(178); // short of the cactus buddy's box (x 178 to 190)
    expect(r.pinatasOpen).toEqual([false, false, false]);
  });
});

describe('GDD-PWR-03 the sandbox piñata at column 23 (row 7, underside y = 128)', () => {
  it('opens when Poncho jumps from the top of the 3-tile wall (y = 176) under it: his 32 px head is 16 px short of it before the jump', () => {
    const L: Level = { ...SANDBOX_LEVEL, enemies: [] };
    let r: RunState = { ...startRun(L), player: standing(372, 11 * TILE) };
    expect(r.player.y - 32).toBe(144); // head 16 px under the underside, no touch
    expect(r.pinatasOpen[1]).toBe(false);
    for (let i = 0; i < 40 && !r.pinatasOpen[1]; i++) r = stepRun(r, { move: 0, jumpHeld: true }, L);
    expect(r.pinatasOpen[1]).toBe(true);
  });
});

describe('GDD-WLD-05 the moving platform meets the piñata at column 23 (x 368 to 384, y 112 to 128)', () => {
  it('stops Poncho standing on its right end against the piñata at x = 362, keeps his lives, and the run goes on', () => {
    const L: Level = { ...SANDBOX_LEVEL, enemies: [] };
    // Standing 40 px in from the platform's left edge (x = 240 at the start), carried right by its 96 px travel: the body's right edge
    // (x + 6) meets the piñata's left side (x = 368) at x = 362, while the platform is still 14 px short of its far end.
    let r: RunState = { ...startRun(L), player: standing(280, 8 * TILE) };
    let stopped = 0;
    for (let i = 0; i < 300; i++) {
      r = stepRun(r, { move: 0, jumpHeld: false }, L);
      expect(r.phase, `step ${i}`).toBe('playing');
      expect(r.lives.lives, `step ${i}`).toBe(7);
      expect(r.player.x, `step ${i}`).toBeLessThanOrEqual(362);
      expect(r.player.y, `step ${i}`).toBe(128);
      if (r.player.x === 362) stopped++;
    }
    expect(stopped).toBeGreaterThan(20); // held there while the platform runs on to its far end and turns back
    expect(r.pinatasOpen[1]).toBe(false); // carried against its side, not into it from below
  });
});

/** The special piñata's place in the sandbox's list, read from the level (L-062). */
const SPECIAL = SANDBOX_PINATAS.findIndex((p) => p.special === true);
const open = (r: RunState): boolean => r.pinatasOpen[SPECIAL]!;

describe('GDD-PWR-04 the sandbox special piñata', () => {
  // The special piñata hangs at column 26, row 2 (x 416 to 432, underside y = 48), 48 px above the top right ledge (row 6, columns 25 to 29,
  // top y = 96), last in the list. Its top is free (row 1), so the Chile Fantasma stands on it at y = 32. Set aside the Tlacuache that walks the
  // ledge (the tests are about the piñata and the pepper; the claw deals with it in play).
  const L: Level = { ...SANDBOX_LEVEL, enemies: [] };
  it('is the last piñata, drawn like any other', () => {
    expect(SANDBOX_PINATAS).toHaveLength(3);
    expect(SANDBOX_PINATAS[2]).toEqual({ col: 26, row: 2, special: true });
    expect(SANDBOX_ROWS[1]![26]).toBe('.'); // its top is free, so what it releases has room
    expect(SANDBOX_ROWS[2]![26]).toBe('.'); // and it is not a level tile
  });

  it('a jump from the ledge under it bumps it open and the Chile Fantasma stands on its top', () => {
    let r: RunState = { ...startRun(L), player: standing(26 * TILE + 8, 96) };
    expect(r.player.y - 32).toBe(64); // his head is 16 px under its underside (y = 48) before the jump
    for (let i = 0; i < 40 && !open(r); i++) r = stepRun(r, { move: 0, jumpHeld: true }, L);
    expect(open(r)).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ kind: 'fantasma', x: 424, y: 32, vx: 0 });
  });

  /**
   * The pepper on its top is reached from the ledge, by a wall kick: standing at the piñata's left (x = 408) he jumps against its left face, kicks
   * off it in the air (jump let go for a step first, L-048), rises past its top, holds right and jump to glide back over it and lands on it.
   * The sandbox has the wall cling and the glide (SANDBOX_ABILITIES). Straight up, a jump reaches 56 px and its top is 64 px above the ledge.
   */
  it('the pepper on its top is reached from the ledge, by a wall kick and a glide', () => {
    let r: RunState = { ...startRun(L), player: standing(26 * TILE + 8, 96) };
    for (let i = 0; i < 40 && !open(r); i++) r = stepRun(r, { move: 0, jumpHeld: true }, L);
    for (let i = 0; i < 60 && !(r.player.grounded && r.items.length === 1); i++) r = stepRun(r, { move: 0, jumpHeld: false }, L);
    expect(r.player.y).toBe(96);
    // To the piñata's left, 16 px short of it, and still.
    for (let i = 0; i < 40 && r.player.x > 408; i++) r = stepRun(r, { move: -1, jumpHeld: false }, L);
    for (let i = 0; i < 30; i++) r = stepRun(r, { move: 0, jumpHeld: false }, L);
    expect(r.player.grounded).toBe(true);
    expect(r.player.x).toBeLessThanOrEqual(408);
    expect(r.fantasma).toBe(0);
    let top = Infinity;
    let got = -1;
    for (let i = 0; i < 120 && got < 0; i++) {
      // Right and jump held to rise against the face; jump let go at step 10 and held again from step 11 (the kick); right held to step 48, jump to step 49.
      r = stepRun(r, { move: i < 49 ? 1 : 0, jumpHeld: i < 10 || (i >= 11 && i < 50) }, L);
      top = Math.min(top, r.player.y);
      expect(r.phase, `step ${i}`).toBe('playing');
      if (r.fantasma > 0) got = i;
    }
    expect(got).toBeGreaterThan(0);
    expect(r.fantasma).toBeGreaterThan(0);
    expect(r.items).toEqual([]); // eaten
    expect(r.player.y).toBe(32); // on the piñata's top
    expect(r.lives.lives).toBe(7);
  });

  /**
   * The ledge is reached on foot from the spawn, with the sandbox's abilities, in four legs by a bot that reads where he is (the Tlacuache and the
   * other enemies set aside): the key, the door and a short jump up the 2-tile wall (the route test above); off the wall's right edge onto the
   * spring with a timed press, braking so as to land on its half clear of the spring ledge, and rising straight up to the ledge's side; the moving
   * platform from the ledge's right end, carried to its far end where the piñata at column 23 stops him; and a jump to the right onto the ledge.
   */
  it('the ledge is reached on foot from the spawn: the wall, the spring ledge, the moving platform and the jump onto it', () => {
    let r: RunState = startRun(L);
    const t = { step: 0 };
    const play = (input: { move: number; jumpHeld: boolean }): void => {
      r = stepRun(r, input, L);
      t.step++;
      expect(r.phase, `step ${t.step}`).toBe('playing');
      expect(r.lives.lives, `step ${t.step}`).toBe(7);
    };
    // Leg 1: the 2-tile wall's top (y = 192).
    while (t.step < 200 && !(t.step >= 120 && r.player.grounded && r.player.y === 192)) play({ move: 1, jumpHeld: t.step >= 120 && t.step < 126 });
    expect(r.player.y).toBe(192);
    // Leg 2: right to x = 179 and stop, then on to the wall's right edge, off it and onto the spring, a timed press as he lands; right again once he
    // is above the ledge's top (y = 112 less 4), onto the spring ledge (columns 13 and 14, x 208 to 240).
    while (t.step < 400 && !(r.player.grounded && r.player.y === 112 && r.player.x >= 208 && r.player.x <= 240)) {
      const p = r.player;
      const falling = p.vy > 0 && !p.grounded && p.y > 214;
      let move = 0;
      if (p.grounded && p.y === 192) move = p.x < 179 || p.vx === 0 ? 1 : 0;
      else if (p.y < 108) move = 1;
      play({ move, jumpHeld: falling || p.vy < 0 });
    }
    expect(r.player).toMatchObject({ y: 112, grounded: true });
    const onLedge = t.step;
    expect(onLedge).toBeLessThan(400);
    // Leg 3: still on the spring ledge for 249 steps (the platform comes round), then right and off its end onto the platform (top y = 128), which
    // carries him to its far end, where the piñata at column 23 stops him at x 356 or more. Leg 4: right and jump, held 24 steps.
    let jumpFrom = -1;
    while (t.step < 1000 && !(r.player.grounded && r.player.y === 96 && r.player.x >= 400)) {
      const p = r.player;
      const k = t.step - onLedge;
      let move = 0;
      let jumpHeld = false;
      if (k < 249) move = 0;
      else if (jumpFrom < 0 && p.y === 112) move = 1;
      else if (jumpFrom < 0 && p.y === 128 && p.x >= 356) jumpFrom = k;
      if (jumpFrom >= 0) {
        move = 1;
        jumpHeld = k < jumpFrom + 24;
      }
      play({ move, jumpHeld });
    }
    expect(r.player).toMatchObject({ y: 96, grounded: true });
    expect(r.player.x).toBeGreaterThanOrEqual(400);
    expect(open(r)).toBe(false); // the pepper is still to be earned
  });
});
