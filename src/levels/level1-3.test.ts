import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { blockAt, type MovingBlock } from '../sim/block';
import { enemyBox, feetOf, kindOf, type Enemy } from '../sim/enemy';
import { touchesHilo } from '../sim/hilo';
import { loseLife, startWorld } from '../sim/lives';
import { spawn, type PlayerInput } from '../sim/movement';
import { platformAt, standsOnPlatform, type MovingPlatform } from '../sim/platform';
import { medal } from '../sim/results';
import { startRun, stepRun, touchesExit, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import { LEVEL_1_3 } from './level1-3';
import { LEVELS } from './index';
import { gaps } from './validate';

/** The level 1-3 comes after (GDD-UI-02). */
const PREV = '1-2';

const world = LEVEL_1_3.world;
const mid = (col: number) => col * TILE + TILE / 2;
const quiet: Level = { ...LEVEL_1_3, enemies: [] };
const standing = (x: number, y: number) => ({ ...spawn(x, y), grounded: true });
const idle: PlayerInput = { move: 0, jumpHeld: false };
/** Ground: a level tile or a sand slope (GDD-MOV-09). */
const ground = (col: number, row: number) => world.solidTile(col, row) || world.slopeAt(col, row) !== null;

/** Whether a standable top (ground with no ground above it) in `col` is 0 to 88 px below `midY`: 32 px body plus the 56 px jump (GDD-MOV-02, GDD-MOV-06). */
const topBelow = (col: number, midY: number): boolean => {
  for (let row = 0; row < world.height; row++) {
    if (!ground(col, row) || ground(col, row - 1)) continue;
    const drop = row * TILE - midY;
    if (drop >= 0 && drop <= 88) return true;
  }
  return false;
};

/** The tiles a box `w` x `h` covers on its way from (x0, y0) to (x1, y1), as "col,row". */
const swept = (x0: number, x1: number, y0: number, y1: number, w: number, h: number): string[] => {
  const cells: string[] = [];
  for (let c = Math.floor(Math.min(x0, x1) / TILE); c <= Math.floor((Math.max(x0, x1) + w - 1) / TILE); c++)
    for (let r = Math.floor(Math.min(y0, y1) / TILE); r <= Math.floor((Math.max(y0, y1) + h - 1) / TILE); r++) cells.push(`${c},${r}`);
  return cells;
};

describe('GDD-WLD-09 level 1-3', () => {
  it('GDD-WLD-09 1-3 is 180 by 17 tiles, a World 1 level, no test level, it comes after 1-2 and leads on to 1-4', () => {
    expect(world.width).toBe(180);
    expect(world.height).toBe(17);
    const entry = LEVELS.find((e) => e.id === '1-3');
    expect(entry).toBeDefined();
    expect(entry!.world).toBe(1);
    expect(entry!.test).toBe(false);
    expect(entry!.level).toBe(LEVEL_1_3);
    expect(entry!.tips).toBeUndefined();
    expect(entry!.next).toBe('1-4');
    expect(LEVELS.find((e) => e.id === PREV)!.next).toBe('1-3');
  });

  it('GDD-WLD-09 1-3 starts at column 3 on the floor, and the exit stands at column 174 on the last cliff', () => {
    expect(LEVEL_1_3.spawn).toEqual({ x: 56, y: 224 });
    expect(LEVEL_1_3.exit).toEqual({ x: 2792, y: 128 });
    expect(world.solidTile(174, 8)).toBe(true);
    expect(world.solidTile(174, 7)).toBe(false);
    expect(LEVEL_1_3.abilities).toBeUndefined();
  });

  it('GDD-WLD-03 1-3 ofrendas stand at columns 45, 98 and 153, about 25 55 and 85 percent', () => {
    expect(LEVEL_1_3.ofrendas.map((o) => o.x)).toEqual([728, 1576, 2456]);
    expect(LEVEL_1_3.ofrendas.map((o) => o.id)).toEqual(['1-3-1', '1-3-2', '1-3-3']);
    [0.25, 0.55, 0.85].forEach((share, i) => {
      expect(Math.abs(LEVEL_1_3.ofrendas[i]!.x / 2880 - share), `ofrenda ${i + 1}`).toBeLessThan(0.03);
      expect(LEVEL_1_3.ofrendas[i]!.y).toBe(224);
    });
  });

  it('GDD-WLD-03 1-3 gaps are 2 and 3 tiles', () => {
    expect(gaps(world)).toEqual([
      { col: 25, width: 2 },
      { col: 83, width: 3 },
    ]);
  });

  it('GDD-WLD-09 1-3 has the hill, walls, cliffs, dune, corridor and ramps of the GDD and no other ground above the floor', () => {
    const expected = new Set<string>();
    const add = (c0: number, c1: number, r0: number, r1: number) => {
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) expected.add(`${c},${r}`);
    };
    add(7, 10, 13, 13); // the 45-degree hill's body
    add(8, 9, 12, 12); // and its top, y = 192
    add(36, 37, 12, 13); // the 2-tile wall before the piñata
    add(51, 54, 8, 13); // the first cliff, top y = 128
    add(67, 67, 13, 13); // the Tlacuache pen's block
    add(71, 74, 13, 13); // the dune's top, y = 208
    add(100, 103, 12, 13); // the step before the shuttle
    add(112, 113, 12, 13); // the wall after it
    add(107, 108, 9, 9); // the veladora ledge, top y = 144
    add(119, 119, 13, 13); // the Alacrán pen's block, beside the crusher at 120
    add(128, 128, 9, 11); // the corridor ceiling, top y = 144, underside y = 192 (columns 126 and 127 open)
    add(130, 132, 9, 11);
    add(134, 137, 9, 11);
    add(147, 147, 12, 13); // the Tlacuache pen's wall
    add(157, 157, 13, 13); // under the up ramp's top
    add(163, 163, 13, 13); // under the down ramp's top
    add(169, 179, 8, 13); // the last cliff, top y = 128
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 14; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
    const slopes: string[] = [];
    for (let c = 0; c < world.width; c++) for (let r = 0; r < world.height; r++) if (world.slopeAt(c, r) !== null) slopes.push(`${c},${r},${world.slopeAt(c, r)}`);
    expect(slopes).toEqual(['6,13,/', '7,12,/', '10,12,\\', '11,13,\\', '69,13,r', '70,13,R', '75,13,F', '76,13,f', '156,13,/', '157,12,/', '163,12,\\', '164,13,\\']);
    for (let c = 0; c < world.width; c++) for (let r = 14; r < 17; r++) expect(world.solidTile(c, r), `${c},${r}`).toBe(!(c >= 25 && c <= 26) && !(c >= 83 && c <= 85));
  });

  it('GDD-WLD-09 1-3 spikes, crumbling tiles, the piñata and the veladora', () => {
    expect(LEVEL_1_3.spikes).toEqual([104, 105, 106, 107, 108, 109, 110, 111, 158, 159, 160, 161, 162].map((col) => ({ col, row: 13 })));
    expect(LEVEL_1_3.crumbles).toEqual([158, 159, 160, 161, 162].map((col) => ({ col, row: 12 })));
    expect(LEVEL_1_3.pinatas).toEqual([{ col: 39, row: 10 }]);
    expect(LEVEL_1_3.veladora).toEqual({ col: 107, row: 8 });
    expect(LEVEL_1_3.springs).toEqual([]);
    expect(LEVEL_1_3.tacos).toEqual([]);
  });

  it('GDD-WLD-09 1-3 doors, keys and fragile walls', () => {
    expect(LEVEL_1_3.doors).toEqual([18, 80, 140].map((col) => ({ col, row: 10, height: 4 })));
    expect(LEVEL_1_3.keys).toEqual([
      { col: 14, row: 13 },
      { col: 73, row: 12 },
      { col: 131, row: 13 },
    ]);
    expect(LEVEL_1_3.fragiles).toEqual([31, 115, 143].flatMap((col) => [10, 11, 12, 13].map((row) => ({ col, row }))));
  });

  it('GDD-WLD-09 1-3 moving platforms and moving blocks', () => {
    expect(LEVEL_1_3.platforms).toEqual([
      { x0: 768, y0: 192, x1: 768, y1: 128, w: 48 },
      { x0: 1664, y0: 192, x1: 1744, y1: 192, w: 48 },
      { x0: 2656, y0: 192, x1: 2656, y1: 128, w: 48 },
    ]);
    expect(LEVEL_1_3.blocks).toEqual([
      { x0: 1024, y0: 96, x1: 1024, y1: 192, w: 16, h: 32 },
      { x0: 1920, y0: 96, x1: 1920, y1: 192, w: 16, h: 32 },
      { x0: 2064, y0: 128, x1: 2064, y1: 192, w: 16, h: 32 },
      { x0: 2128, y0: 192, x1: 2128, y1: 128, w: 16, h: 32 },
    ]);
  });

  it('GDD-ENM-02 1-3 has one cactus buddy, three Tlacuaches, one Zopilote and one Alacrán where the GDD puts them', () => {
    expect(LEVEL_1_3.enemies.map((e) => [kindOf(e), e.x, e.y])).toEqual([
      ['cactus', mid(22), 224],
      ['tlacuache', mid(72), 208],
      ['zopilote', mid(108), 112],
      ['alacran', mid(117), 224],
      ['tlacuache', mid(145), 224],
      ['tlacuache', mid(177), 128],
    ]);
  });

  it('GDD-WLD-09 1-3 has 50 hilos each in an empty tile within a jump of the ground', () => {
    const hilos = LEVEL_1_3.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    const things = [...LEVEL_1_3.pinatas, ...LEVEL_1_3.keys, ...LEVEL_1_3.fragiles, ...LEVEL_1_3.crumbles, ...LEVEL_1_3.spikes, LEVEL_1_3.veladora!, ...LEVEL_1_3.doors.flatMap((d) => [0, 1, 2, 3].map((i) => ({ col: d.col, row: d.row + i })))];
    for (const h of hilos) {
      const where = `hilo at ${h.col},${h.row}`;
      expect(ground(h.col, h.row), where).toBe(false);
      expect(things.some((t) => t.col === h.col && t.row === h.row), where).toBe(false);
      expect([-2, -1, 0, 1, 2].some((d) => topBelow(h.col + d, h.row * TILE + TILE / 2)), where).toBe(true);
    }
  });

  it('GDD-WLD-09 1-3 no hilo is touched by Poncho standing at the start or at an ofrenda', () => {
    for (const at of [LEVEL_1_3.spawn, ...LEVEL_1_3.ofrendas]) {
      for (const h of LEVEL_1_3.hilos!) expect(touchesHilo(spawn(at.x, at.y), h), `${at.x}: ${h.col},${h.row}`).toBe(false);
    }
  });

  it('GDD-WLD-09 1-3 each key lies before its door with no ofrenda between them', () => {
    LEVEL_1_3.keys.forEach((k, i) => {
      const door = LEVEL_1_3.doors[i]!;
      expect(k.col, `key ${i + 1}`).toBeLessThan(door.col);
      expect(LEVEL_1_3.ofrendas.some((o) => o.x > k.col * TILE && o.x < door.col * TILE), `key ${i + 1}`).toBe(false);
    });
  });

  it('GDD-MOV-09 1-3 no moving platform or moving block path crosses a slope tile', () => {
    const paths = [...LEVEL_1_3.platforms.map((p: MovingPlatform) => swept(p.x0, p.x1, p.y0, p.y1, p.w, 8)), ...LEVEL_1_3.blocks!.map((b: MovingBlock) => swept(b.x0, b.x1, b.y0, b.y1, b.w, b.h))];
    for (const cells of paths) for (const cell of cells) {
      const [c, r] = cell.split(',').map(Number);
      expect(world.slopeAt(c!, r!), cell).toBeNull();
    }
  });
});

/**
 * A bot that holds right, like 1-1's (GDD-WLD-07), with what 1-3 adds. On the ground, after letting go of jump for a step (L-048), it
 * jumps (held 20 steps) at a wall in the row above its feet within 14 px of its front edge (not a tile a 45-degree or upper gentle ramp
 * leads up to), a drop of three tiles or more within 10 px, a spike on its floor starting within 26 px, a cactus buddy on its level
 * within 40 px, or a closed piñata 48 px over its feet. It claws a Zopilote that telegraphs or dives just in front of and above it, a
 * fragile tile in its body's rows within 12 px of its front edge, and an Alacrán or a Tlacuache on its level whose near edge is within
 * 26 px of its front edge. Before a moving block whose column starts within 20 px of its front edge (plus its braking distance) it
 * waits, or backs out if its front is already under it, until the block rises with its underside 8 px clear of its head. Under a lift
 * it walks to the lift's middle, waits, and jumps when the lift is at its low end; on the ledge before the shuttle it walks to 3 px
 * from the edge and steps on when the shuttle is under its front. Riding a lift it holds right once the lift is within 16 px of its top;
 * riding the shuttle it walks to 8 px from its leading edge, waits, and holds right when it is within 4 px of its far end. It returns
 * the run, the steps it took and the number of steps on which a life was lost (GDD-LIFE-05: 1-3 is often entered with fewer than seven).
 */
function bot(level: Level, maxSteps: number, wait = 0): { run: RunState; steps: number; lost: number } {
  const w = level.world;
  let run = startRun(level);
  for (let i = 0; i < wait; i++) run = stepRun(run, idle, level);
  let hold = 0;
  let steps = 0;
  let jumpBefore = false;
  let clawBefore = false;
  let lost = 0;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const { x, y, grounded, vx } = run.player;
    const tick = run.platformTick;
    const front = x + 6;
    const brake = (vx * vx) / 2000; // 120 px/s stops in 7.2 px at 1000 px/s squared (GDD-MOV-01)
    let claw = false;
    let move = 1;
    let still = false; // waiting or riding: no jump
    if (run.phase === 'playing') {
      level.enemies.forEach((e, i) => {
        const s = run.enemies[i]!;
        if (!s.alive) return;
        const k = kindOf(e);
        if (s.flight && (s.flight.phase === 'telegraph' || s.flight.phase === 'dive')) {
          const dx = s.x - x;
          const dy = y - s.flight.y;
          if (dx > -8 && dx < 28 && dy > 0 && dy < 44) claw = true;
        }
        if (k === 'alacran' || k === 'tlacuache') {
          const d = s.x - (k === 'tlacuache' ? 8 : 7) - front;
          if (Math.abs(feetOf(e, s) - y) <= 16 && d >= -6 && d <= 26) claw = true;
        }
      });
      level.fragiles.forEach((f, i) => {
        const d = f.col * TILE - front;
        if (!run.fragilesBroken[i] && d >= -0.01 && d <= 12 && f.row * TILE < y && (f.row + 1) * TILE > y - 32) claw = true;
      });
      (level.blocks ?? []).forEach((b) => {
        const at = blockAt(b, tick);
        const ahead = at.x - front;
        if (!grounded || ahead < -12 || ahead > 20 + brake) return;
        const clear = blockAt(b, tick + 1).y < at.y && at.y + at.h <= y - 32 - 8;
        if (!clear) {
          move = ahead < 0 ? -1 : 0;
          still = true;
        }
      });
      level.platforms.forEach((p) => {
        const at = platformAt(p, tick);
        const lift = p.x0 === p.x1;
        if (standsOnPlatform(run.player, at)) {
          still = true;
          const far = lift ? at.y - Math.min(p.y0, p.y1) < 16 : Math.abs(at.x - Math.max(p.x0, p.x1)) < 4;
          move = far || (!lift && x < at.x + at.w - 8 - brake) ? 1 : 0;
          return;
        }
        if (!grounded) return;
        if (lift && x >= p.x0 - 8 && x < p.x0 + p.w && y > Math.max(p.y0, p.y1)) {
          still = true;
          move = x < p.x0 + p.w / 2 - 2 ? 1 : 0;
          if (move === 0 && Math.abs(at.y - Math.max(p.y0, p.y1)) < 1 && hold === 0 && !jumpBefore) hold = 20;
        } else if (!lift && Math.abs(y - p.y0) < 0.01 && x >= p.x0 - 40 && x <= p.x0 + 6) {
          still = true;
          move = at.x < front - 0.5 || x < p.x0 - 3 - brake ? 1 : 0;
        }
      });
    }
    if (run.phase === 'playing' && grounded && hold === 0 && !jumpBefore && !still && move !== 0) {
      const feetRow = Math.floor((y - 1) / TILE);
      let jump = false;
      for (let d = 0; d <= 14; d++) {
        const col = Math.floor((front + d) / TILE);
        if (w.solidTile(col, feetRow) && y - feetRow * TILE > 4 && !['/', 'R'].includes(w.slopeAt(col - 1, feetRow) ?? '')) jump = true;
      }
      for (let d = 0; d <= 10; d++) {
        const col = Math.floor((front + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < w.height && !w.solidTile(col, feetRow + 1 + empty) && w.slopeAt(col, feetRow + 1 + empty) === null) empty++;
        if (empty >= 3) jump = true;
      }
      for (const s of level.spikes) if (s.row === feetRow && y >= (s.row + 1) * TILE - 4 && s.col * TILE - x >= 0 && s.col * TILE - x <= 26) jump = true;
      level.enemies.forEach((e, i) => {
        const s = run.enemies[i]!;
        if (kindOf(e) === 'cactus' && s.alive && Math.abs(feetOf(e, s) - y) < 4 && s.x - x >= 0 && s.x - x <= 40) jump = true;
      });
      level.pinatas.forEach((p, i) => {
        if (!run.pinatasOpen[i] && (p.row + 4) * TILE === y && p.col * TILE - x >= -12 && p.col * TILE - x <= -2) jump = true;
      });
      if (jump) hold = 20;
    }
    const input: PlayerInput = { move, jumpHeld: hold > 0, claw: claw && !clawBefore };
    jumpBefore = input.jumpHeld;
    clawBefore = input.claw === true;
    if (hold > 0) hold--;
    const before = run.lives.lives;
    run = stepRun(run, input, level);
    if (run.lives.lives < before) lost++;
    steps++;
  }
  return { run, steps, lost };
}

/** One life lost to a pit in 1-3: Poncho dropped into the 2-tile gap at columns 25 and 26, then played on until he is back at the start. */
function lostToPit(run: RunState): RunState {
  let r: RunState = { ...run, player: { ...spawn(416, 224), grounded: false } };
  for (let i = 0; i < 200 && r.phase === 'playing'; i++) r = stepRun(r, idle, LEVEL_1_3);
  for (let i = 0; i < 200 && r.phase === 'respawning'; i++) r = stepRun(r, idle, LEVEL_1_3);
  return r;
}

/** Plays `level` from `run` with no input for `steps` steps; the step a life is lost (1-based), or -1. */
function lostAt(level: Level, run: RunState, steps: number): number {
  let r = run;
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, idle, level);
    if (r.phase !== 'playing') return i + 1;
  }
  return -1;
}

describe('GDD-WLD-09 playing 1-3', () => {
  it('GDD-WLD-09 1-3 no jump without a key gets Poncho past a door', () => {
    const level: Level = { ...quiet, keys: [], blocks: [] };
    for (const d of LEVEL_1_3.doors) {
      let r: RunState = { ...startRun(level), player: standing(d.col * TILE - 26, 224) };
      let hold = 0;
      let before = false;
      for (let i = 0; i < 240; i++) {
        if (r.player.grounded && hold === 0 && !before) hold = 20;
        const input = { move: 1, jumpHeld: hold > 0 };
        before = input.jumpHeld;
        if (hold > 0) hold--;
        r = stepRun(r, input, level);
        expect(r.player.x, `door ${d.col}, step ${i}`).toBeLessThanOrEqual(d.col * TILE - 6 + 1e-9);
      }
      expect(r.doorsOpen).toEqual([false, false, false]);
    }
  });

  it('GDD-WLD-09 1-3 no jump from the top of the crusher at column 120 reaches the corridor ceiling, from which a jump reaches the top of the door at column 140', () => {
    // The crusher at column 120 stands on the floor at step 144 and is back at its top, y = 96, 144 steps later, so Poncho can ride it
    // up. From its top (step 288), standing anywhere on it, he holds right and presses jump (held 20 steps) on any of the next 41 steps:
    // a standing jump, a running jump from its right edge, or a coyote jump just past it. Each comes down on the floor (y = 224), never
    // on the corridor's ceiling (top y = 144), from which a jump would reach the top of the door at column 140 without its key.
    let r: RunState = { ...startRun(quiet), platformTick: 144, player: standing(1941.5, 192) };
    for (let i = 0; i < 144; i++) r = stepRun(r, idle, quiet);
    expect(r.player.y).toBeCloseTo(96, 9);
    expect(r.player.grounded).toBe(true);
    for (let x0 = 1915; x0 <= 1941; x0 += 2) {
      for (let k = 0; k <= 40; k++) {
        let s: RunState = { ...startRun(quiet), platformTick: 288, player: standing(x0, 96) };
        let air = false;
        let landed = -1;
        for (let i = 0; i < 160 && landed < 0; i++) {
          s = stepRun(s, { move: 1, jumpHeld: i >= k && i < k + 20 }, quiet);
          expect(s.phase, `x ${x0}, jump at ${k}, step ${i}`).toBe('playing');
          if (!s.player.grounded) air = true;
          else if (air) landed = s.player.y;
        }
        expect(landed, `x ${x0}, jump at ${k}`).toBe(224);
      }
    }
    // Why it must be out of reach: from the ceiling's right end (x 2196, y 144) a jump to the right comes down on the door's top (y = 160).
    let c: RunState = { ...startRun(quiet), player: standing(2196, 144) };
    let top = -1;
    for (let i = 0; i < 60 && top < 0; i++) {
      c = stepRun(c, { move: 1, jumpHeld: i < 20 }, quiet);
      if (i > 2 && c.player.grounded) top = c.player.y;
    }
    expect(top).toBe(160);
  });

  it('GDD-WLD-09 1-3 a claw from the floor opens each fragile wall two tiles high and he walks through', () => {
    const level: Level = { ...quiet, blocks: [] };
    [31, 115, 143].forEach((col, wall) => {
      let r: RunState = { ...startRun(level), player: standing(col * TILE - 6, 224) };
      r = stepRun(r, idle, level);
      r = stepRun(r, { ...idle, claw: true }, level);
      for (let i = 0; i < 10; i++) r = stepRun(r, idle, level);
      expect(r.fragilesBroken.slice(wall * 4, wall * 4 + 4), `wall ${col}`).toEqual([false, false, true, true]);
      for (let i = 0; i < 30; i++) r = stepRun(r, { move: 1, jumpHeld: false }, level);
      expect(r.player.x, `wall ${col}`).toBeGreaterThan(col * TILE + TILE + 6);
      expect(r.player.y).toBe(224);
    });
  });

  for (const [name, index] of [['first lift', 0], ['last lift', 2]] as const) {
    it(`GDD-WLD-09 1-3 a jump from under the ${name} at its low end lands him on it, and holding right then puts him on its cliff`, () => {
      const p = LEVEL_1_3.platforms[index]!;
      let r: RunState = { ...startRun(quiet), player: standing(p.x0 + p.w / 2, 224) };
      let on = -1;
      let top = -1;
      for (let i = 0; i < 200 && top < 0; i++) {
        r = stepRun(r, { move: on >= 0 ? 1 : 0, jumpHeld: i < 20 }, quiet);
        expect(r.lives.lives, `step ${i}`).toBe(7);
        if (on < 0 && standsOnPlatform(r.player, platformAt(p, r.platformTick))) on = i + 1;
        if (r.player.grounded && r.player.y === 128 && r.player.x - 6 >= p.x0 + p.w) top = i + 1;
      }
      expect(on).toBe(25);
      expect(top).toBe(106);
    });
  }

  it('GDD-WLD-09 1-3 from the step Poncho walks onto the shuttle at its first end', () => {
    const p = LEVEL_1_3.platforms[1]!;
    let r: RunState = { ...startRun(quiet), player: standing(1658, 192) };
    for (let i = 0; i < 40; i++) {
      r = stepRun(r, { move: i < 15 ? 1 : 0, jumpHeld: false }, quiet);
      expect(r.player.y, `step ${i}`).toBe(192);
    }
    expect(standsOnPlatform(r.player, platformAt(p, r.platformTick))).toBe(true);
    expect(r.player.x - 6).toBeGreaterThan(1664); // off the step
  });

  it('GDD-WLD-09 1-3 the shuttle carries Poncho over the spikes to the far wall', () => {
    let r: RunState = { ...startRun(quiet), player: standing(1704, 192) };
    let wall = -1;
    for (let i = 0; i < 150 && wall < 0; i++) {
      r = stepRun(r, { move: i >= 120 ? 1 : 0, jumpHeld: false }, quiet);
      expect(r.lives.lives, `step ${i}`).toBe(7);
      expect(r.player.y, `step ${i}`).toBe(192);
      if (r.player.grounded && r.player.x - 6 >= 1792) wall = i + 1;
    }
    expect(wall).toBe(136);
  });

  it('GDD-WLD-09 1-3 the veladora is reached by a full jump from the shuttle and not by riding it', () => {
    const veladora = LEVEL_1_3.veladora!;
    let r: RunState = { ...startRun(quiet), lives: loseLife(startWorld()), player: standing(1690, 192) };
    let landed: { x: number; y: number } | null = null;
    for (let i = 0; i < 90; i++) {
      r = stepRun(r, { move: i < 30 ? 1 : 0, jumpHeld: i < 30 }, quiet);
      if (!landed && i > 3 && r.player.grounded) landed = { x: r.player.x, y: r.player.y };
    }
    expect(landed!.y).toBe(144); // on the ledge
    expect(veladoraUsed(r.lives, veladora)).toBe(true);
    expect(r.lives.lives).toBe(7);
    let ride: RunState = { ...startRun(quiet), lives: loseLife(startWorld()), player: standing(1690, 192) };
    for (let i = 0; i < 240; i++) ride = stepRun(ride, idle, quiet);
    expect(veladoraUsed(ride.lives, veladora)).toBe(false);
    expect(ride.lives.lives).toBe(6);
  });

  it('GDD-WLD-09 1-3 the crusher at column 64 crushes Poncho under it and never beside it', () => {
    expect(lostAt(quiet, { ...startRun(quiet), player: standing(1032, 224) }, 300)).toBe(97);
    for (const x of [1010, 1054]) expect(lostAt(quiet, { ...startRun(quiet), player: standing(x, 224) }, 576), `x ${x}`).toBe(-1);
  });

  it('GDD-WLD-09 1-3 the crusher past the Alacrán pen crushes Poncho under it and never beside it', () => {
    expect(lostAt(quiet, { ...startRun(quiet), player: standing(1928, 224) }, 300)).toBe(97);
    for (const [x, y] of [[1906, 208], [1950, 224]] as const) expect(lostAt(quiet, { ...startRun(quiet), player: standing(x, y) }, 576), `x ${x}`).toBe(-1);
  });

  it('GDD-WLD-09 1-3 each corridor crusher crushes Poncho under it, and the key between them is safe', () => {
    expect(lostAt(quiet, { ...startRun(quiet), player: standing(2072, 224) }, 300)).toBe(49);
    expect(lostAt(quiet, { ...startRun(quiet), platformTick: 96, player: standing(2136, 224) }, 300)).toBe(49);
    for (const tick of [0, 96]) expect(lostAt(quiet, { ...startRun(quiet), platformTick: tick, player: standing(2104, 224) }, 384), `tick ${tick}`).toBe(-1);
  });

  it('GDD-WLD-09 1-3 in Base a jump under the piñata opens it, and holding right once the taco has dropped catches it', () => {
    let r: RunState = { ...startRun(quiet), player: standing(632, 224) };
    let opened = -1;
    let dropped = -1;
    let taco = -1;
    for (let i = 0; i < 80; i++) {
      r = stepRun(r, { move: i >= 40 ? 1 : 0, jumpHeld: i < 10 }, quiet);
      if (opened < 0 && r.pinatasOpen[0]) opened = i + 1;
      if (dropped < 0 && r.items[0]?.y === 224) dropped = i + 1;
      if (taco < 0 && r.power === 'taco') taco = i + 1;
    }
    expect(opened).toBe(3);
    expect(dropped).toBe(40);
    expect(taco).toBe(57);
  });

  it('GDD-WLD-09 1-3 in Taco a claw from the right end of the 2-tile wall opens the piñata, and a hop onto it takes the chile', () => {
    let r: RunState = { ...startRun(quiet), power: 'taco', player: standing(600, 192) };
    const go = (n: number, input: PlayerInput) => {
      for (let i = 0; i < n; i++) r = stepRun(r, input, quiet);
    };
    go(1, idle);
    go(1, { ...idle, claw: true });
    go(10, idle);
    expect(r.pinatasOpen).toEqual([true]);
    expect(r.items.map((i) => [i.kind, i.x, i.y])).toEqual([['chile', 632, 160]]);
    go(30, { move: 1, jumpHeld: true });
    expect(r.power).toBe('fuego');
  });

  it('GDD-ENM-01 1-3 no Zopilote or Tlacuache spots Poncho standing at the start or at an ofrenda', () => {
    const level: Level = { ...LEVEL_1_3, enemies: LEVEL_1_3.enemies.filter((e) => kindOf(e) === 'zopilote' || kindOf(e) === 'tlacuache') };
    for (const at of [LEVEL_1_3.spawn, ...LEVEL_1_3.ofrendas]) {
      let r: RunState = { ...startRun(level), player: standing(at.x, at.y) };
      for (let i = 0; i < 600; i++) {
        r = stepRun(r, idle, level);
        expect(r.enemies.map((e) => e.flight?.phase ?? e.gait!.phase), `at ${at.x}, step ${i}`).toEqual(['walk', 'cruise', 'walk', 'walk']);
      }
    }
  });

  it('GDD-WLD-09 1-3 the Zopilote spots Poncho waiting on the step for the shuttle', () => {
    const level: Level = { ...LEVEL_1_3, enemies: [LEVEL_1_3.enemies[2]!] };
    for (const [x, at] of [[1606, 195], [1630, 159], [1658, 1]] as const) {
      let r: RunState = { ...startRun(level), player: standing(x, 192) };
      let spotted = -1;
      for (let i = 0; i < 300 && spotted < 0; i++) {
        r = stepRun(r, idle, level);
        if (r.enemies[0]!.flight!.phase === 'telegraph') spotted = i + 1;
      }
      expect(spotted, `x ${x}`).toBe(at);
    }
  });

  it('GDD-WLD-09 1-3 each walker keeps to its stretch', () => {
    // Poncho idle at the start, so every door stays shut and every fragile wall whole. [index, min x, max x, min feet, max feet]
    for (const [index, x0, x1, f0, f1] of [[1, 1096, 1272, 208, 224], [3, 1863, 1897, 224, 224], [4, 2312, 2344, 224, 224], [5, 2712, 2872, 128, 128]] as const) {
      const e = LEVEL_1_3.enemies[index]!;
      const level: Level = { ...LEVEL_1_3, enemies: [e] };
      let r = startRun(level);
      let lo = Infinity;
      let hi = -Infinity;
      let low = Infinity;
      let high = -Infinity;
      for (let i = 0; i < 4000; i++) {
        r = stepRun(r, idle, level);
        const s = r.enemies[0]!;
        lo = Math.min(lo, s.x);
        hi = Math.max(hi, s.x);
        low = Math.min(low, feetOf(e, s));
        high = Math.max(high, feetOf(e, s));
      }
      expect([lo, hi, low, high].map((v) => Math.round(v * 1000) / 1000), `enemy ${index}`).toEqual([x0, x1, f0, f1]);
    }
  });

  it('GDD-WLD-09 1-3 no enemy walks or flies through a moving block column', () => {
    // Each enemy alone, Poncho idle at the start (doors shut, fragile walls whole), and the Alacrán again with the fragile walls gone,
    // as once Poncho has clawed his way into its pen: the first step on which its box shares x with a block's column, or -1.
    const columns = LEVEL_1_3.blocks!.map((b) => [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1) + b.w] as const);
    const firstHit = (base: Level, e: Enemy): number => {
      const level: Level = { ...base, enemies: [e] };
      let r = startRun(level);
      for (let i = 0; i < 4000; i++) {
        r = stepRun(r, idle, level);
        const box = enemyBox(e, r.enemies[0]!);
        if (columns.some(([x0, x1]) => box.x0 < x1 && box.x1 > x0)) return i + 1;
      }
      return -1;
    };
    expect(LEVEL_1_3.enemies.map((e) => firstHit(LEVEL_1_3, e))).toEqual([-1, -1, -1, -1, -1, -1]);
    expect(firstHit({ ...LEVEL_1_3, fragiles: [] }, LEVEL_1_3.enemies[3]!)).toBe(-1);
  });

  it('GDD-WLD-09 1-3 the Alacrán let out of its pen walks from the far wall to the pen block', () => {
    // Its fragile wall broken (all three gone here), the Alacrán walks out over the floor column at 114 as far as the far wall (its right
    // face x = 1824, less half its 14 px width) and back to the pen's block at 119 (its left face x = 1904, less half its width).
    const e = LEVEL_1_3.enemies[3]!;
    const level: Level = { ...LEVEL_1_3, enemies: [e], fragiles: [] };
    let r = startRun(level);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 4000; i++) {
      r = stepRun(r, idle, level);
      lo = Math.min(lo, r.enemies[0]!.x);
      hi = Math.max(hi, r.enemies[0]!.x);
    }
    expect([lo, hi].map((v) => Math.round(v * 1000) / 1000)).toEqual([1831, 1897]);
  });

  it('GDD-WLD-09 1-3 a full jump from the far wall clears the second fragile wall into the Alacrán pen', () => {
    // Known and accepted (main session, 2026-11-02): the far wall's top is two tiles below the fragile wall's, so from its right end a
    // full jump clears the wall, a second way into the pen beside the claw from the floor; the wall stays whole, so the Alacrán stays in.
    let r: RunState = { ...startRun(quiet), player: standing(1818, 192) };
    let landed: { x: number; y: number; step: number } | null = null;
    for (let i = 0; i < 60 && !landed; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i < 20 }, quiet);
      if (i > 3 && r.player.grounded) landed = { x: r.player.x, y: r.player.y, step: i + 1 };
    }
    expect(landed!.y).toBe(224);
    expect(Math.round(landed!.x * 100) / 100).toBe(1884.61); // in the pen, columns 116 to 118
    expect(landed!.step).toBe(39);
    expect(r.fragilesBroken.slice(4, 8)).toEqual([false, false, false, false]);
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-WLD-09 1-3 the Tlacuache behind the third fragile wall, let out, walks into the crusher columns', () => {
    // Known and accepted (main session, 2026-11-02): with its wall broken and the door at column 140 open, it walks out left through the
    // corridor and its two crushers to the block of the Alacrán's pen. The first step its box shares x with a block's column, and its walk.
    const columns = LEVEL_1_3.blocks!.map((b) => [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1) + b.w] as const);
    const e = LEVEL_1_3.enemies[4]!;
    const level: Level = { ...LEVEL_1_3, enemies: [e], fragiles: LEVEL_1_3.fragiles.filter((f) => f.col !== 143), doors: LEVEL_1_3.doors.filter((d) => d.col !== 140) };
    let r = startRun(level);
    let hit = -1;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 4000; i++) {
      r = stepRun(r, idle, level);
      const box = enemyBox(e, r.enemies[0]!);
      lo = Math.min(lo, r.enemies[0]!.x);
      hi = Math.max(hi, r.enemies[0]!.x);
      if (hit < 0 && columns.some(([x0, x1]) => box.x0 < x1 && box.x1 > x0)) hit = i + 1;
    }
    expect(hit).toBe(521);
    expect([lo, hi].map((v) => Math.round(v * 1000) / 1000)).toEqual([1928, 2344]);
  });

  it('GDD-WLD-09 1-3 holding right from the start collects the first three hilos by step 60', () => {
    let r = startRun(LEVEL_1_3);
    for (let i = 0; i < 60; i++) r = stepRun(r, { move: 1, jumpHeld: false }, LEVEL_1_3);
    expect(r.hilosTaken.slice(0, 4)).toEqual([false, true, true, true]); // (2,13) is behind the start
  });

  it('GDD-WLD-09 1-3 can be played from the start to the exit with all seven lives in under 2400 steps', () => {
    const { run, steps, lost } = bot(LEVEL_1_3, 2400);
    expect(run.phase).toBe('clear');
    expect(lost).toBe(0);
    expect(steps).toBeLessThan(2400);
    expect(run.lives.lives).toBe(7);
    expect(touchesExit(run.player, LEVEL_1_3.exit!)).toBe(true);
    expect(run.keysTaken).toEqual([true, true, true]);
    expect(run.doorsOpen).toEqual([true, true, true]);
  });

  it('GDD-WLD-09 1-3 the playthrough collects 45 of the 50 hilos', () => {
    const { run } = bot(LEVEL_1_3, 2400);
    expect(run.hilosTaken.filter(Boolean)).toHaveLength(45);
  });

  it('GDD-WLD-09 1-3 the bot also clears it after waiting 60 120 180 or 240 steps at the start', () => {
    for (const wait of [60, 120, 180, 240]) {
      const { run, lost } = bot(LEVEL_1_3, 2400, wait);
      expect(run.phase, `wait ${wait}`).toBe('clear');
      expect(lost, `wait ${wait}`).toBe(0);
      expect(run.lives.lives, `wait ${wait}`).toBe(7);
    }
  });

  it('GDD-PRG-03 1-3 gold counts the lives lost in 1-3, whatever it was entered with', () => {
    // User, 2026-11-02: "Gold if you lose at most 3 lives in that level, whatever you came in with." Every hilo saved, so each run has
    // them all; it starts with the lives 1-2 would hand over (startRun's third argument, GDD-LIFE-05), loses some to the pit and is put
    // at the exit. Entered with 3 and losing none is gold, as is entered with 5 and losing 3; losing 4 is silver.
    const all = LEVEL_1_3.hilos!.map(() => true);
    for (const [entered, losses, expected] of [[3, 0, 'gold'], [5, 3, 'gold'], [7, 3, 'gold'], [7, 4, 'silver']] as const) {
      const at = `entered with ${entered}, ${losses} lost`;
      let r = startRun(LEVEL_1_3, all, entered);
      for (let k = 0; k < losses; k++) r = lostToPit(r);
      expect(r.phase, at).toBe('playing');
      expect(r.lives.lives, at).toBe(entered - losses);
      r = stepRun({ ...r, player: standing(2792, 128) }, idle, LEVEL_1_3);
      expect(r.phase, at).toBe('clear');
      expect(medal(r, LEVEL_1_3), at).toBe(expected);
    }
  });
});
