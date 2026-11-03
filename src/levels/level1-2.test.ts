import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { withCrumbles } from '../sim/crumble';
import { feetOf, kindOf, type Enemy, type EnemyState } from '../sim/enemy';
import { loseLife, startWorld } from '../sim/lives';
import { spawn, step, type PlayerInput } from '../sim/movement';
import { startRun, stepRun, touchesExit, type Level, type RunState } from '../sim/run';
import { isGround } from '../sim/slope';
import { withSprings } from '../sim/spring';
import { SLOPE_HEIGHTS } from '../sim/tilemap';
import { veladoraUsed } from '../sim/veladora';
import { LEVEL_1_2 } from './level1-2';
import { LEVELS } from './index';
import { gaps } from './validate';

const world = LEVEL_1_2.world;
const mid = (col: number) => col * TILE + TILE / 2;

/** Whether tile (col, row) holds a crumbling tile of 1-2. */
const isCrumble = (col: number, row: number): boolean => LEVEL_1_2.crumbles.some((c) => c.col === col && c.row === row);
/** Whether tile (col, row) holds a spring of 1-2. */
const isSpring = (col: number, row: number): boolean => LEVEL_1_2.springs.some((s) => s.col === col && s.row === row);

/**
 * The tops one can stand on in `col`, as y: a level tile, crumbling tile or spring with no ground and no crumbling tile above it (its top
 * `row * 16`), or a slope tile (the higher of its two edges).
 */
const topsIn = (col: number): number[] => {
  const tops: number[] = [];
  for (let row = 0; row < world.height; row++) {
    const slope = world.slopeAt(col, row);
    if (slope !== null) {
      const { left, right } = SLOPE_HEIGHTS[slope];
      tops.push((row + 1) * TILE - Math.max(left, right));
    } else if ((world.solidTile(col, row) || isCrumble(col, row) || isSpring(col, row)) && !isGround(world, col, row - 1) && !isCrumble(col, row - 1)) tops.push(row * TILE);
  }
  return tops;
};

/** Whether a standable top in `col` is 0 to 88 px below `midY`: 32 px body plus the 56 px jump (GDD-MOV-02, GDD-MOV-06). */
const topBelow = (col: number, midY: number): boolean => topsIn(col).some((top) => top - midY >= 0 && top - midY <= 88);

/** The level with no enemies. */
const QUIET: Level = { ...LEVEL_1_2, enemies: [] };

/** A run of `level` with Poncho standing at (x, y), and whatever else `over` sets. */
const standing = (level: Level, x: number, y: number, over: Partial<RunState> = {}): RunState => ({ ...startRun(level), ...over, player: { ...spawn(x, y), grounded: true } });

/** `n` steps of `input` from `run`, or until `until` holds; returns the run and the steps taken. */
const go = (level: Level, run: RunState, n: number, input: PlayerInput | ((i: number, r: RunState) => PlayerInput), until?: (r: RunState) => boolean): { run: RunState; steps: number } => {
  let steps = 0;
  while (steps < n) {
    run = stepRun(run, typeof input === 'function' ? input(steps, run) : input, level);
    steps++;
    if (until?.(run)) break;
  }
  return { run, steps };
};

const STILL: PlayerInput = { move: 0, jumpHeld: false };
const RIGHT: PlayerInput = { move: 1, jumpHeld: false };

describe('GDD-WLD-08 level 1-2', () => {
  it('GDD-WLD-08 1-2 is 180 by 17 tiles, a World 1 level, no test level, and it comes after 1-1 and leads on to 1-3', () => {
    expect(world.width).toBe(180);
    expect(world.height).toBe(17);
    const entry = LEVELS.find((e) => e.id === '1-2');
    expect(entry).toBeDefined();
    expect(entry!.world).toBe(1);
    expect(entry!.test).toBe(false);
    expect(entry!.level).toBe(LEVEL_1_2);
    expect(entry!.tips).toBeUndefined();
    expect(entry!.next).toBe('1-3');
    expect(LEVELS.find((e) => e.id === '1-1')!.next).toBe('1-2');
  });

  it('GDD-WLD-08 1-2 starts at column 3 on the floor, and the exit stands at column 174', () => {
    expect(LEVEL_1_2.spawn).toEqual({ x: 56, y: 224 });
    expect(LEVEL_1_2.exit).toEqual({ x: 2792, y: 224 });
    expect(LEVEL_1_2.abilities).toBeUndefined();
  });

  it('GDD-WLD-03 1-2 ofrendas stand at columns 47, 99 and 153, about 25 55 and 85 percent', () => {
    expect(LEVEL_1_2.ofrendas.map((o) => o.x)).toEqual([760, 1592, 2456]);
    [0.25, 0.55, 0.85].forEach((share, i) => {
      expect(Math.abs(LEVEL_1_2.ofrendas[i]!.x / 2880 - share), `ofrenda ${i + 1}`).toBeLessThan(0.03);
      expect(LEVEL_1_2.ofrendas[i]!.y).toBe(224);
    });
    expect(LEVEL_1_2.ofrendas.map((o) => o.id)).toEqual(['1-2-1', '1-2-2', '1-2-3']);
  });

  it('GDD-WLD-03 1-2 gaps are 2, 3 and 3 tiles', () => {
    expect(gaps(world)).toEqual([
      { col: 26, width: 2 },
      { col: 118, width: 3 },
      { col: 169, width: 3 },
    ]);
    // The floor's top is row 14 (GDD-WLD-03): `gaps` reads only the bottom row, so every row of the floor is read here.
    const empty = new Set([26, 27, 118, 119, 120, 169, 170, 171]);
    const springs = new Set([77, 88, 137]);
    for (let col = 0; col < world.width; col++) {
      for (let row = 14; row <= 16; row++) {
        const hole = empty.has(col) || (row === 14 && springs.has(col));
        expect(world.solidTile(col, row), `tile ${col},${row}`).toBe(!hole);
      }
    }
  });

  it('GDD-WLD-08 1-2 has the blocks, walls, pillars and ledges of the GDD and no other level tile above the floor', () => {
    const expected = new Set<string>();
    const add = (c0: number, c1: number, r0: number, r1: number) => {
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) expected.add(`${c},${r}`);
    };
    for (const c of [33, 122, 134, 156, 166]) add(c, c, 13, 13); // 1-tile blocks
    add(10, 11, 13, 13); // the first dune's top
    add(18, 21, 13, 13); // the first hill
    add(19, 20, 12, 12);
    add(50, 51, 13, 13); // under the walkway's ramp
    add(51, 51, 12, 12);
    add(56, 57, 11, 13); // the walkway's pillar
    add(58, 58, 12, 13); // under its ramp down
    add(59, 59, 13, 13);
    add(62, 63, 12, 13); // the pen walls
    add(72, 73, 12, 13);
    add(75, 76, 7, 7); // the veladora ledge, top y = 112
    add(78, 79, 10, 13); // the 4-tile walls
    add(91, 92, 10, 13);
    add(103, 104, 13, 13); // under the bridge's ramp
    add(104, 104, 12, 12);
    add(111, 112, 11, 13); // the bridge's pillar
    add(113, 113, 12, 13); // under its ramp down
    add(114, 114, 13, 13);
    add(127, 130, 13, 13); // the second hill
    add(128, 129, 12, 12);
    add(144, 145, 8, 13); // the tall wall
    for (let i = 0; i < 5; i++) add(146 + i, 146 + i, 9 + i, 13); // under the long slope
    add(161, 162, 13, 13); // the last dune's top
    add(168, 168, 13, 13); // the last ramp's top
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 14; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
  });

  it('GDD-MOV-09 1-2 has the sand slopes of the GDD and no other', () => {
    const expected = new Set<string>();
    const add = (char: string, row: number, cols: number[]) => cols.forEach((c) => expected.add(`${char}${c},${row}`));
    add('r', 13, [8, 24, 35, 41, 159]);
    add('R', 13, [9, 25, 36, 42, 160]);
    add('F', 13, [12, 37, 43, 163]);
    add('f', 13, [13, 38, 44, 164]);
    add('/', 13, [17, 49, 102, 126, 167]);
    add('\\', 13, [22, 60, 115, 131, 151]);
    add('/', 12, [18, 50, 103, 127]);
    add('\\', 12, [21, 59, 114, 130, 150]);
    add('/', 11, [51, 104]);
    add('\\', 11, [58, 113, 149]);
    add('\\', 10, [148]);
    add('\\', 9, [147]);
    add('\\', 8, [146]);
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < world.height; r++) {
      const slope = world.slopeAt(c, r);
      if (slope !== null) found.add(`${slope}${c},${r}`);
    }
    expect(found).toEqual(expected);
    expect(found.size).toBe(45);
  });

  it('GDD-WLD-08 1-2 spikes, springs, crumbling tiles, piñatas and the veladora', () => {
    expect(LEVEL_1_2.spikes).toEqual([39, 40, 89, 90, 105, 106, 107, 108, 109, 110, 138, 139, 140, 141, 142, 143].map((col) => ({ col, row: 13 })));
    expect(LEVEL_1_2.springs).toEqual([77, 88, 137].map((col) => ({ col, row: 14 })));
    expect(LEVEL_1_2.crumbles).toEqual([
      ...[52, 53, 54, 55].map((col) => ({ col, row: 11 })),
      ...[105, 106, 107, 108, 109, 110].map((col) => ({ col, row: 11 })),
      ...[140, 141, 142].map((col) => ({ col, row: 10 })),
    ]);
    expect(LEVEL_1_2.pinatas).toEqual([
      { col: 30, row: 10 },
      { col: 65, row: 10 },
    ]);
    expect(LEVEL_1_2.veladora).toEqual({ col: 75, row: 6 });
    for (const empty of ['tacos', 'platforms', 'doors', 'keys', 'fragiles'] as const) expect(LEVEL_1_2[empty], empty).toEqual([]);
    expect(LEVEL_1_2.blocks).toBeUndefined();
  });

  it('GDD-ENM-02 1-2 has three Tlacuaches and a cactus buddy where the GDD puts them', () => {
    expect(LEVEL_1_2.enemies.map((e) => [kindOf(e), e.x, e.y])).toEqual([
      ['tlacuache', mid(68), 224],
      ['cactus', mid(81), 224],
      ['tlacuache', mid(128), 192],
      ['tlacuache', mid(161), 208],
    ]);
  });

  it('GDD-WLD-08 1-2 has 50 hilos each in an empty tile within a jump of something to stand on', () => {
    const hilos = LEVEL_1_2.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    for (const h of hilos) {
      const where = `hilo at ${h.col},${h.row}`;
      expect(isGround(world, h.col, h.row), where).toBe(false);
      expect(isCrumble(h.col, h.row), where).toBe(false);
      expect(isSpring(h.col, h.row), where).toBe(false);
      expect(LEVEL_1_2.spikes.some((s) => s.col === h.col && s.row === h.row), where).toBe(false);
      expect(LEVEL_1_2.pinatas.some((p) => p.col === h.col && p.row === h.row), where).toBe(false);
      const midY = h.row * TILE + TILE / 2;
      expect([-2, -1, 0, 1, 2].some((d) => topBelow(h.col + d, midY)), where).toBe(true);
    }
  });

  it('GDD-WLD-04 1-2 hilos lie along the path where the GDD lists them', () => {
    const hilos = LEVEL_1_2.hilos!;
    expect(hilos.slice(0, 3)).toEqual([
      { col: 4, row: 13 },
      { col: 5, row: 13 },
      { col: 6, row: 13 },
    ]);
    const has = (c0: number, c1: number, r0: number, r1: number) => hilos.some((h) => h.col >= c0 && h.col <= c1 && h.row >= r0 && h.row <= r1);
    expect(has(8, 13, 0, 12), 'over the first dune').toBe(true);
    expect(has(17, 22, 0, 11), 'over the first hill').toBe(true);
    for (const [c0, c1] of [[26, 27], [118, 120], [169, 171]] as const) expect(has(c0, c1, 0, 13), `over the gap at ${c0}`).toBe(true);
    for (const p of LEVEL_1_2.pinatas) expect(hilos.some((h) => Math.abs(h.col - p.col) <= 2 && Math.abs(h.row - p.row) <= 2), `beside the piñata at ${p.col}`).toBe(true);
    expect(has(39, 40, 0, 12), 'over the spiked dip').toBe(true);
    expect(has(52, 55, 9, 10), 'on the walkway').toBe(true);
    expect(has(105, 110, 9, 10), 'on the bridge').toBe(true);
    expect(has(140, 142, 8, 9), 'on the third spring crumbling tiles').toBe(true);
    expect(has(62, 63, 0, 11), 'on the left pen wall').toBe(true);
    expect(has(72, 73, 0, 11), 'on the right pen wall').toBe(true);
    expect(has(64, 71, 12, 13), 'in the pen').toBe(true);
    for (const col of [77, 88, 137]) expect(has(col, col, 0, 13), `over the spring at ${col}`).toBe(true);
    expect(has(78, 79, 0, 9), 'on the first wall').toBe(true);
    expect(has(91, 92, 0, 9), 'on the second wall').toBe(true);
    expect(has(144, 145, 0, 7), 'on the tall wall').toBe(true);
    expect(hilos.filter((h) => h.row === 6 && (h.col === 75 || h.col === 76))).toHaveLength(1);
    expect(hilos.filter((h) => h.col >= 146 && h.col <= 151).length).toBeGreaterThanOrEqual(2);
    expect(has(172, 176, 12, 13), 'beside the exit').toBe(true);
  });
});

/** An awake Tlacuache: alive and not playing dead (GDD-ENM-02). */
const awake = (def: Enemy, s: EnemyState): boolean => kindOf(def) === 'tlacuache' && s.alive && s.gait!.phase !== 'dead';

/**
 * A bot that holds right. Its world is the level's tiles plus the springs and the crumbling tiles not gone yet. It presses claw when an
 * awake Tlacuache's box starts -8 to 14 px past his front edge (24 px while it charges) and is level enough for the claw box (its feet
 * less than 10 px below his and less than 32 px above), and stands still for a step when one is -4 to 10 px ahead while his claw is
 * idle and cooling down. On the ground, after a step with jump up, it jumps (jump held 20 steps) when: seven steps of running on with
 * no jump would stop him against something (the real movement step); a column within 10 px of his front edge has three or more empty
 * tiles under his feet; a spike's base is within 16 px of his feet and its left edge 0 to 26 px ahead of his middle; a cactus buddy is
 * 0 to 40 px ahead with its feet within 12 px of his; an awake Tlacuache is 0 to 48 px ahead with its feet 10 to 16 px below his (the
 * claw misses it there); or a closed piñata hangs 48 px over his feet with its left edge 2 to 12 px left of his middle, unless an awake
 * Tlacuache is 0 to 48 px ahead. It never jumps while a spring's left edge is 28 px behind to 20 px ahead of his front edge: the spring
 * throws him instead.
 */
function bot(level: Level, maxSteps: number, onStep?: (run: RunState) => void): { run: RunState; steps: number } {
  let run = startRun(level);
  let steps = 0;
  let hold = 0;
  let jumpBefore = false;
  let clawBefore = false;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const { x, y, grounded } = run.player;
    const front = x + 6;
    const tiles = withCrumbles(withSprings(level.world, level.springs), level.crumbles, run.crumbles);
    const playing = run.phase === 'playing';
    let claw = false;
    let stop = false;
    level.enemies.forEach((def, i) => {
      const s = run.enemies[i]!;
      if (!playing || !awake(def, s)) return;
      const ey = feetOf(def, s);
      const gap = s.x - 8 - front;
      const reach = s.gait!.phase === 'charge' ? 24 : 14;
      if (ey - 10 < y && ey > y - 32 && gap >= -8 && gap <= reach) claw = true;
      if (gap >= -4 && gap <= 10 && run.claw.phase === 'idle' && run.claw.cooldown > 0 && hold === 0) stop = true;
    });
    if (playing && grounded && hold === 0 && !jumpBefore) {
      let jump = false;
      let probe = run.player;
      for (let k = 0; k < 7 && !jump; k++) {
        probe = step(probe, { move: 1, jumpHeld: false }, tiles);
        if (probe.vx === 0) jump = true;
      }
      const feetRow = Math.floor((y - 1) / TILE);
      for (let d = 0; d <= 10; d++) {
        const col = Math.floor((front + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < tiles.height && !isGround(tiles, col, feetRow + 1 + empty)) empty++;
        if (empty >= 3) jump = true;
      }
      for (const sp of level.spikes) if (Math.abs((sp.row + 1) * TILE - y) <= 16 && sp.col * TILE - x >= 0 && sp.col * TILE - x <= 26) jump = true;
      let tlacuacheNear = false;
      level.enemies.forEach((def, i) => {
        const s = run.enemies[i]!;
        const ey = feetOf(def, s);
        const ahead = s.x - x;
        if (awake(def, s) && ahead >= 0 && ahead <= 48) {
          tlacuacheNear = true;
          if (ey - y >= 10 && ey - y <= 16) jump = true;
        }
        if ((kindOf(def) === 'alacran' || kindOf(def) === 'cactus') && s.alive && Math.abs(ey - y) < 12 && ahead >= 0 && ahead <= 40) jump = true;
      });
      level.pinatas.forEach((p, i) => {
        if (!run.pinatasOpen[i] && (p.row + 4) * TILE === y && p.col * TILE - x >= -12 && p.col * TILE - x <= -2 && !tlacuacheNear) jump = true;
      });
      if (level.springs.some((sp) => sp.col * TILE - front >= -28 && sp.col * TILE - front <= 20)) jump = false;
      if (jump) hold = 20;
    }
    const input: PlayerInput = { move: stop ? 0 : 1, jumpHeld: hold > 0, claw: claw && !clawBefore };
    jumpBefore = input.jumpHeld;
    clawBefore = input.claw === true;
    if (hold > 0) hold--;
    run = stepRun(run, input, level);
    steps++;
    onStep?.(run);
  }
  return { run, steps };
}

/** P14: the hop right onto the first spring from under the veladora ledge, with jump pressed again for the timed launch when `timed`; the lowest the spring's throw gets before it lands. */
const launchAttempt = (timed: boolean) => {
  let run = standing(QUIET, mid(76), 224, { lives: loseLife(startWorld()) });
  let up = false;
  let launched = false;
  let landed = false;
  let lowest = Infinity;
  for (let i = 0; i < 200; i++) {
    if (run.player.vy <= -550) up = true;
    run = stepRun(run, { move: up ? (run.player.y < 112 ? -1 : 0) : 1, jumpHeld: i < 20 || (timed && i >= 28 && !up) }, QUIET);
    // From the first step that ends with the spring's throw (the plain launch is 480, a jump 410) to the first step after it that ends grounded.
    const first: boolean = !launched && run.player.vy <= -450;
    launched ||= first;
    if (launched && !landed) {
      lowest = Math.min(lowest, run.player.y);
      landed = !first && run.player.grounded;
    }
  }
  return { run, lowest };
};

describe('GDD-WLD-08 playing 1-2', () => {
  it('GDD-WLD-08 1-2 can be played from the start to the exit with all seven lives in under 1800 steps', () => {
    let lost = 0;
    let before = 7;
    const { run, steps } = bot(LEVEL_1_2, 1800, (r) => {
      if (r.lives.lives < before) lost++;
      before = r.lives.lives;
    });
    expect(run.phase).toBe('clear');
    expect(steps).toBeLessThan(1800);
    expect(lost).toBe(0);
    expect(run.lives.lives).toBe(7);
    expect(touchesExit(run.player, LEVEL_1_2.exit!)).toBe(true);
  });

  it('GDD-WLD-08 1-2 holding right from the start runs over the first dune and hill on the ground and collects the first three hilos', () => {
    let run = startRun(LEVEL_1_2);
    let hilosAt = -1;
    let airX = -1;
    for (let i = 1; i <= 300 && airX < 0; i++) {
      run = stepRun(run, { move: 1, jumpHeld: false }, LEVEL_1_2);
      if (hilosAt < 0 && run.hilosTaken[0] && run.hilosTaken[1] && run.hilosTaken[2]) hilosAt = i;
      if (!run.player.grounded) airX = run.player.x;
    }
    expect(hilosAt).toBeGreaterThanOrEqual(1);
    expect(hilosAt).toBeLessThanOrEqual(30);
    expect(airX).toBeGreaterThanOrEqual(416);
    expect(airX).toBeLessThanOrEqual(418);
  });

  it('GDD-PWR-05 1-2 in Base, a jump under the piñata at column 30 releases a taco that turns at the block at column 33 and comes back', () => {
    let run = standing(QUIET, mid(30), 224);
    let widest = 0;
    let steps = 0;
    for (let i = 0; i < 150 && run.power !== 'taco'; i++) {
      run = stepRun(run, { move: 0, jumpHeld: i < 20 }, QUIET);
      steps++;
      for (const item of run.items) widest = Math.max(widest, item.x);
    }
    expect(run.pinatasOpen[0]).toBe(true);
    expect(run.power).toBe('taco');
    expect(steps).toBeLessThan(150);
    // Flush against the block's left side (x = 528), less half the 12 px taco (GDD-PWR-02: it turns at walls).
    expect(widest).toBeCloseTo(522, 6);
  });

  it('GDD-PWR-05 1-2 in Taco, the chile of the piñata at column 30 is reached by a jump from the block at column 33', () => {
    let run = standing(QUIET, mid(30), 224, { power: 'taco' });
    run = go(QUIET, run, 40, (i) => ({ move: 0, jumpHeld: i < 20 })).run;
    // A chile stays on top of its piñata (GDD-PWR-03).
    expect(run.items.map((i) => [i.kind, i.x, i.y])).toEqual([['chile', 488, 160]]);
    run = { ...run, player: { ...spawn(mid(33), 208), grounded: true, facing: -1 } };
    run = stepRun(run, STILL, QUIET);
    expect(run.player).toMatchObject({ y: 208, grounded: true });
    run = go(QUIET, run, 40, { move: -1, jumpHeld: true }, (r) => r.power === 'fuego').run;
    expect(run.power).toBe('fuego');
  });

  it('GDD-PWR-05 1-2 in Taco, a claw from the right end of the left pen wall opens the piñata at column 65, and a hop onto it takes the chile', () => {
    let run = standing(QUIET, mid(63), 192, { power: 'taco' });
    run = stepRun(run, STILL, QUIET);
    run = stepRun(run, { move: 0, jumpHeld: false, claw: true }, QUIET);
    run = go(QUIET, run, 10, STILL).run;
    expect(run.pinatasOpen).toEqual([false, true]);
    expect(run.items.map((i) => i.kind)).toEqual(['chile']);
    expect(run.power).toBe('taco');
    run = go(QUIET, run, 30, { move: 1, jumpHeld: true }).run;
    expect(run.power).toBe('fuego');
  });

  it('GDD-PWR-03 1-2 in Fuego, fireballs spat from the top of the left pen wall defeat the pen Tlacuache', () => {
    const run = go(LEVEL_1_2, standing(LEVEL_1_2, mid(63), 192, { power: 'fuego' }), 360, (i) => ({ move: 0, jumpHeld: false, fuego: i % 20 === 0 })).run;
    expect(run.enemies[0]!.alive).toBe(false);
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-ENM-02 1-2 the pen Tlacuache never spots Poncho standing on either pen wall', () => {
    const level: Level = { ...LEVEL_1_2, enemies: [LEVEL_1_2.enemies[0]!] };
    for (const col of [62, 63, 72, 73]) {
      let run = standing(level, mid(col), 192);
      for (let i = 0; i < 1200; i++) {
        run = stepRun(run, STILL, level);
        // His feet are 32 px above its own, and it spots only within 16 px (GDD-ENM-02).
        expect(run.enemies[0]!.gait!.phase, `wall ${col}, step ${i}`).toBe('walk');
      }
    }
  });

  it('GDD-ENM-01 1-2 each Tlacuache walks only in its pen, at least 3 tiles from every respawn', () => {
    const respawns = [LEVEL_1_2.spawn, ...LEVEL_1_2.ofrendas];
    // x range and feet y range from the pen's sides (it turns flush, half its 16 px width in) and the hill and dune under it (GDD-MOV-09).
    const expected = new Map([
      [0, { minX: 1032, maxX: 1144, minY: 224, maxY: 224 }],
      [2, { minX: 1976, maxX: 2136, minY: 192, maxY: 224 }],
      [3, { minX: 2520, maxX: 2648, minY: 208, maxY: 224 }],
    ]);
    for (const [index, want] of expected) {
      const def = LEVEL_1_2.enemies[index]!;
      const level: Level = { ...LEVEL_1_2, enemies: [def] };
      for (const at of respawns) {
        let run = standing(level, at.x, at.y);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < 2000; i++) {
          run = stepRun(run, STILL, level);
          expect(run.lives.lives, `Tlacuache ${index} from ${at.x}, step ${i}`).toBe(7);
          const s = run.enemies[0]!;
          minX = Math.min(minX, s.x);
          maxX = Math.max(maxX, s.x);
          minY = Math.min(minY, feetOf(def, s));
          maxY = Math.max(maxY, feetOf(def, s));
        }
        expect(minX, `Tlacuache ${index} min x from ${at.x}`).toBeCloseTo(want.minX, 6);
        expect(maxX, `Tlacuache ${index} max x from ${at.x}`).toBeCloseTo(want.maxX, 6);
        expect(minY, `Tlacuache ${index} min y from ${at.x}`).toBeCloseTo(want.minY, 6);
        expect(maxY, `Tlacuache ${index} max y from ${at.x}`).toBeCloseTo(want.maxY, 6);
      }
      for (const at of respawns) {
        const distance = at.x < want.minX ? want.minX - at.x : at.x > want.maxX ? at.x - want.maxX : 0;
        expect(distance, `Tlacuache ${index} from ${at.x}`).toBeGreaterThanOrEqual(48);
      }
    }
  });

  it('GDD-WLD-05 1-2 the first spring throws Poncho onto the 4-tile wall that a jump cannot climb', () => {
    const thrown = go(QUIET, standing(QUIET, mid(74), 224), 120, RIGHT, (r) => r.player.grounded && r.player.y === 160);
    expect(thrown.run.player.grounded).toBe(true);
    expect(thrown.run.player.y).toBe(160);
    expect(thrown.run.player.x).toBeGreaterThanOrEqual(1248);
    // GDD-WLD-03: a full jump climbs 3 tiles, not 4.
    const level: Level = { ...QUIET, springs: [] };
    let run = standing(level, mid(76), 224);
    for (let i = 0; i < 90; i++) {
      run = stepRun(run, { move: 1, jumpHeld: true }, level);
      expect(run.player.grounded && run.player.y === 160, `step ${i}`).toBe(false);
    }
  });

  it('GDD-WLD-05 1-2 the second spring throws Poncho over the spikes onto the wall, and a jump over the spring lands on them', () => {
    const thrown = go(QUIET, standing(QUIET, mid(85), 224), 120, RIGHT, (r) => r.player.grounded && r.player.y === 160 && r.player.x >= 1456);
    expect(thrown.run.player).toMatchObject({ grounded: true, y: 160 });
    expect(thrown.run.player.x).toBeGreaterThanOrEqual(1456);
    expect(thrown.run.lives.lives).toBe(7);
    const jumped = go(QUIET, standing(QUIET, mid(85), 224), 120, (i) => ({ move: 1, jumpHeld: i >= 20 && i < 40 }), (r) => r.lives.lives < 7);
    expect(jumped.run.lives.lives).toBeLessThan(7);
  });

  it('GDD-WLD-05 1-2 the crumbling walkway is safe, and a full jump climbs out from under it', () => {
    // (a) Standing at the first ofrenda, running right: onto the pillar, never in the air over the walkway.
    let run = standing(QUIET, 760, 224);
    let onPillar = false;
    for (let i = 0; i < 150 && !onPillar; i++) {
      run = stepRun(run, RIGHT, QUIET);
      if (run.player.x > 832 && run.player.x < 896) expect(run.player.grounded, `step ${i}, x ${run.player.x}`).toBe(true);
      onPillar = run.player.grounded && run.player.y === 176 && run.player.x > 902;
    }
    expect(onPillar).toBe(true);
    // (b) Standing on it still: the tiles go after 0.5 s (GDD-WLD-05) and the floor is 48 px below.
    run = go(QUIET, standing(QUIET, mid(53), 176), 60, STILL).run;
    expect(run.player).toMatchObject({ grounded: true, y: 224 });
    expect(run.lives.lives).toBe(7);
    // (c) From that floor a full jump climbs back onto the pillar.
    const out = go(QUIET, run, 60, (i) => ({ move: 1, jumpHeld: i < 30 }), (r) => r.player.grounded && r.player.y === 176 && r.player.x > 896);
    expect(out.run.player).toMatchObject({ grounded: true, y: 176 });
    expect(out.run.player.x).toBeGreaterThan(896);
  });

  it('GDD-WLD-05 1-2 the crumbling bridge over the spikes is safe running and costs a life standing', () => {
    const across = go(QUIET, standing(QUIET, 1592, 224), 150, RIGHT, (r) => r.player.grounded && r.player.y === 176 && r.player.x > 1782);
    expect(across.run.player).toMatchObject({ grounded: true, y: 176 });
    expect(across.run.player.x).toBeGreaterThan(1782);
    expect(across.run.lives.lives).toBe(7);
    const still = go(QUIET, standing(QUIET, mid(107), 176), 60, STILL, (r) => r.lives.lives < 7);
    expect(still.run.lives.lives).toBeLessThan(7);
  });

  it('GDD-WLD-05 1-2 the third spring throws Poncho onto crumbling tiles, from which a jump reaches the tall wall', () => {
    const thrown = go(QUIET, standing(QUIET, mid(135), 224), 60, RIGHT, (r) => r.player.grounded && r.player.y === 160);
    expect(thrown.run.player).toMatchObject({ grounded: true, y: 160 });
    // Holding right, jump on the first step that starts with x >= 2276 and hold it 20 steps.
    let run = thrown.run;
    let pressed = -1;
    let landed = false;
    for (let i = 0; i < 60 && !landed; i++) {
      if (pressed < 0 && run.player.x >= 2276) pressed = i;
      run = stepRun(run, { move: 1, jumpHeld: pressed >= 0 && i < pressed + 20 }, QUIET);
      landed = run.player.grounded && run.player.y === 128;
    }
    expect(landed).toBe(true);
    expect(run.lives.lives).toBe(7);
    // Standing on them costs a life.
    const still = go(QUIET, standing(QUIET, mid(141), 160), 60, STILL, (r) => r.lives.lives < 7);
    expect(still.run.lives.lives).toBeLessThan(7);
  });

  it('GDD-LIFE-03 1-2 the veladora ledge is reached by the timed launch of the first spring and not by the plain one', () => {
    const timed = launchAttempt(true);
    expect(veladoraUsed(timed.run.lives, LEVEL_1_2.veladora!)).toBe(true);
    expect(timed.run.lives.lives).toBe(7);
    const plain = launchAttempt(false);
    expect(veladoraUsed(plain.run.lives, LEVEL_1_2.veladora!)).toBe(false);
    // The plain launch falls short of the ledge's top (y = 112): the GDD's own words, asserted directly (L-026).
    expect(plain.lowest).toBeGreaterThan(112);
  });

  it('GDD-LIFE-03 1-2 a full jump left from the top of the first 4-tile wall reaches the veladora ledge', () => {
    let run = standing(QUIET, mid(74), 224, { lives: loseLife(startWorld()) });
    // First the plain launch puts him where the GDD says the jump starts: on the wall's top, 48 px below the ledge's.
    run = go(QUIET, run, 120, RIGHT, (r) => r.player.grounded && r.player.y === 160).run;
    expect(run.player).toMatchObject({ grounded: true, y: 160 });
    // A jump taken while he still slides right falls short, so he stops first.
    run = go(QUIET, run, 60, STILL, (r) => r.player.vx === 0).run;
    expect(run.player.vx).toBe(0);
    const jumped = go(QUIET, run, 120, (i) => ({ move: -1, jumpHeld: i < 20 }), (r) => veladoraUsed(r.lives, LEVEL_1_2.veladora!));
    expect(veladoraUsed(jumped.run.lives, LEVEL_1_2.veladora!)).toBe(true);
    expect(jumped.run.lives.lives).toBe(7);
  });

  it('GDD-ENM-02 1-2 the hill Tlacuache charges down its hill at Poncho on the pen floor', () => {
    const level: Level = { ...LEVEL_1_2, enemies: [LEVEL_1_2.enemies[2]!] };
    let run = standing(level, mid(132), 224);
    let charged = false;
    let lost = false;
    for (let i = 0; i < 600 && !lost; i++) {
      run = stepRun(run, STILL, level);
      if (run.lives.lives < 7) lost = true;
      else if (run.enemies[0]!.gait!.phase === 'charge') {
        const feet = feetOf(level.enemies[0]!, run.enemies[0]!);
        if (feet > 208 && feet < 224) charged = true;
      }
    }
    expect(lost).toBe(true);
    // It charges along the slope (GDD-MOV-09, GDD-ENM-02).
    expect(charged).toBe(true);
  });

  it('GDD-PWR-05 1-2 in Base, the taco of the piñata at column 65 drops into the pen, where Poncho takes it', () => {
    let run = standing(QUIET, mid(63), 192);
    run = stepRun(run, STILL, QUIET);
    run = stepRun(run, { move: 0, jumpHeld: false, claw: true }, QUIET);
    run = go(QUIET, run, 10, STILL).run;
    expect(run.pinatasOpen).toEqual([false, true]);
    expect(run.items.map((i) => i.kind)).toEqual(['taco']);
    run = go(QUIET, run, 120, STILL, (r) => r.items[0]?.y === 224).run;
    expect(run.items[0]!.y).toBe(224);
    // On the pen's floor between the walls' inner sides (x = 1024 and 1152), half the 12 px taco in from each.
    expect(run.items[0]!.x).toBeGreaterThanOrEqual(1030);
    expect(run.items[0]!.x).toBeLessThanOrEqual(1146);
    run = go(QUIET, run, 240, RIGHT, (r) => r.power === 'taco').run;
    expect(run.power).toBe('taco');
  });
});
