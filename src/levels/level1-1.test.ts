import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { kindOf } from '../sim/enemy';
import { loseLife, startWorld } from '../sim/lives';
import { spawn, type PlayerInput } from '../sim/movement';
import { startRun, stepRun, touchesExit, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import { LEVEL_1_1 } from './level1-1';
import { LEVELS } from './index';
import { gaps } from './validate';

const world = LEVEL_1_1.world;
const mid = (col: number) => col * TILE + TILE / 2;

/** Whether a standable top (a solid tile with an empty tile above it) in `col` is 0 to 88 px below `midY`: 32 px body plus the 56 px jump (GDD-MOV-02, GDD-MOV-06). */
const topBelow = (col: number, midY: number): boolean => {
  for (let row = 0; row < world.height; row++) {
    if (!world.solidTile(col, row) || world.solidTile(col, row - 1)) continue;
    const drop = row * TILE - midY;
    if (drop >= 0 && drop <= 88) return true;
  }
  return false;
};

describe('GDD-WLD-07 level 1-1', () => {
  it('GDD-WLD-07 1-1 is 180 by 17 tiles, a World 1 level, no test level, and it comes after 0-1', () => {
    expect(world.width).toBe(180);
    expect(world.height).toBe(17);
    const entry = LEVELS.find((e) => e.id === '1-1');
    expect(entry).toBeDefined();
    expect(entry!.world).toBe(1);
    expect(entry!.test).toBe(false);
    expect(entry!.level).toBe(LEVEL_1_1);
    expect(entry!.tips).toBeUndefined();
    expect(entry!.next).toBeUndefined();
    expect(LEVELS.find((e) => e.id === '0-1')!.next).toBe('1-1');
  });

  it('GDD-WLD-07 1-1 starts at column 3 on the floor, and the exit stands at column 174', () => {
    expect(LEVEL_1_1.spawn).toEqual({ x: 56, y: 224 });
    expect(LEVEL_1_1.exit).toEqual({ x: 2792, y: 224 });
    expect(LEVEL_1_1.abilities).toBeUndefined();
  });

  it('GDD-WLD-03 1-1 ofrendas stand at columns 45, 99 and 153, about 25 55 and 85 percent', () => {
    expect(LEVEL_1_1.ofrendas.map((o) => o.x)).toEqual([728, 1592, 2456]);
    [0.25, 0.55, 0.85].forEach((share, i) => {
      expect(Math.abs(LEVEL_1_1.ofrendas[i]!.x / 2880 - share), `ofrenda ${i + 1}`).toBeLessThan(0.03);
      expect(LEVEL_1_1.ofrendas[i]!.y).toBe(224);
    });
  });

  it('GDD-WLD-03 1-1 gaps are 2, 1, 3, 3 and 3 tiles', () => {
    expect(gaps(world)).toEqual([
      { col: 17, width: 2 },
      { col: 43, width: 1 },
      { col: 62, width: 3 },
      { col: 116, width: 3 },
      { col: 130, width: 3 },
    ]);
  });

  it('GDD-WLD-07 1-1 has the blocks, walls, raised platform and ledge of the GDD and no other solid tile above the floor', () => {
    const expected = new Set<string>();
    const add = (c0: number, c1: number, r0: number, r1: number) => {
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) expected.add(`${c},${r}`);
    };
    for (const c of [8, 21, 30, 78, 88, 136, 145, 171]) add(c, c, 13, 13); // 1-tile blocks
    for (const c of [12, 72, 94, 122, 162]) add(c, c + 1, 12, 13); // 2-tile walls
    add(103, 104, 11, 13); // the 3-tile wall
    add(107, 113, 10, 10); // the raised platform, top y = 160
    add(115, 116, 7, 7); // the veladora ledge, top y = 112
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 14; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
  });

  it('GDD-WLD-07 1-1 spikes, piñatas and the veladora', () => {
    expect(LEVEL_1_1.spikes).toEqual([39, 40, 109, 110, 111].map((col) => ({ col, row: 13 })));
    expect(LEVEL_1_1.pinatas).toEqual([
      { col: 34, row: 10 },
      { col: 75, row: 10 },
    ]);
    expect(LEVEL_1_1.veladora).toEqual({ col: 115, row: 6 });
    for (const empty of ['tacos', 'crumbles', 'springs', 'platforms', 'doors', 'keys', 'fragiles'] as const) expect(LEVEL_1_1[empty], empty).toEqual([]);
    expect(LEVEL_1_1.blocks).toBeUndefined();
  });

  it('GDD-ENM-02 1-1 has six Alacranes, two Zopilotes and three cactus buddies where the GDD puts them', () => {
    expect(LEVEL_1_1.enemies.map((e) => [kindOf(e), e.x, e.y])).toEqual([
      ['alacran', mid(25), 224],
      ['zopilote', mid(56), 136],
      ['cactus', mid(68), 224],
      ['alacran', mid(82), 224],
      ['alacran', mid(85), 224],
      ['alacran', mid(110), 160],
      ['cactus', mid(128), 224],
      ['zopilote', mid(131), 136],
      ['alacran', mid(140), 224],
      ['cactus', mid(158), 224],
      ['alacran', mid(167), 224],
    ]);
  });

  it('GDD-WLD-07 1-1 has 50 hilos each in an empty tile within a jump of a floor', () => {
    const hilos = LEVEL_1_1.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    for (const h of hilos) {
      const where = `hilo at ${h.col},${h.row}`;
      expect(world.solidTile(h.col, h.row), where).toBe(false);
      expect(LEVEL_1_1.pinatas.some((p) => p.col === h.col && p.row === h.row), where).toBe(false);
      const midY = h.row * TILE + TILE / 2;
      expect([-2, -1, 0, 1, 2].some((d) => topBelow(h.col + d, midY)), where).toBe(true);
    }
  });
});

/**
 * A bot that always holds right. On the ground, after letting go of jump for a step, it jumps (held for 20 steps) when something
 * is ahead: a wall in the row above his feet within 14 px of his front edge, a drop of three tiles or more within 10 px, a spike
 * starting within 26 px of him, a live Alacrán or cactus buddy on his level within 40 px, or a closed piñata 48 px over his
 * feet (GDD-PWR-05). It claws a Zopilote that telegraphs or dives just in front of him and above him. It never spits a fireball.
 */
function bot(level: Level, maxSteps: number): { run: RunState; steps: number } {
  let run = startRun(level);
  let hold = 0;
  let steps = 0;
  let jumpBefore = false;
  let clawBefore = false;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const { x, y, grounded } = run.player;
    let claw = false;
    if (run.phase === 'playing') {
      level.enemies.forEach((_e, i) => {
        const s = run.enemies[i]!;
        if (!s.alive || !s.flight || (s.flight.phase !== 'telegraph' && s.flight.phase !== 'dive')) return;
        const dx = s.x - x;
        const dy = y - s.flight.y;
        if (dx > -8 && dx < 28 && dy > 0 && dy < 44) claw = true;
      });
    }
    if (run.phase === 'playing' && grounded && hold === 0 && !jumpBefore) {
      const front = x + 6;
      const feetRow = Math.floor((y - 1) / TILE);
      let jump = false;
      for (let d = 0; d <= 14; d++) if (world.solidTile(Math.floor((front + d) / TILE), feetRow)) jump = true;
      for (let d = 0; d <= 10; d++) {
        const col = Math.floor((front + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < world.height && !world.solidTile(col, feetRow + 1 + empty)) empty++;
        if (empty >= 3) jump = true;
      }
      for (const s of level.spikes) if (s.row === feetRow && s.col * TILE - x >= 0 && s.col * TILE - x <= 26) jump = true;
      level.enemies.forEach((e, i) => {
        if (kindOf(e) === 'zopilote') return;
        if (run.enemies[i]!.alive && Math.abs(e.y - y) < 4 && run.enemies[i]!.x - x >= 0 && run.enemies[i]!.x - x <= 40) jump = true;
      });
      level.pinatas.forEach((p, i) => {
        if (!run.pinatasOpen[i] && (p.row + 4) * TILE === y && p.col * TILE - x >= -12 && p.col * TILE - x <= -2) jump = true;
      });
      if (jump) hold = 20;
    }
    const input: PlayerInput = { move: 1, jumpHeld: hold > 0, claw: claw && !clawBefore };
    jumpBefore = input.jumpHeld;
    clawBefore = input.claw === true;
    if (hold > 0) hold--;
    run = stepRun(run, input, level);
    steps++;
  }
  return { run, steps };
}

describe('GDD-WLD-07 playing 1-1', () => {
  it('GDD-WLD-07 1-1 can be played from the start to the exit with all seven lives in under 1500 steps', () => {
    const { run, steps } = bot(LEVEL_1_1, 1500);
    expect(run.phase).toBe('clear');
    expect(steps).toBeLessThan(1500);
    expect(run.lives.lives).toBe(7);
    expect(touchesExit(run.player, LEVEL_1_1.exit!)).toBe(true);
  });

  it('GDD-WLD-07 1-1 in Taco, a claw from the right end of the 2-tile wall opens the piñata at column 75, and a hop onto it takes the chile', () => {
    const level: Level = { ...LEVEL_1_1, enemies: [] };
    let run: RunState = { ...startRun(level), power: 'taco', player: { ...spawn(1176, 192), grounded: true } };
    const go = (n: number, input: PlayerInput) => {
      for (let i = 0; i < n; i++) run = stepRun(run, input, level);
    };
    go(1, { move: 0, jumpHeld: false });
    go(1, { move: 0, jumpHeld: false, claw: true });
    go(10, { move: 0, jumpHeld: false });
    expect(run.pinatasOpen).toEqual([false, true]);
    expect(run.items.map((i) => i.kind)).toEqual(['chile']);
    expect(run.power).toBe('taco');
    go(30, { move: 1, jumpHeld: true });
    expect(run.power).toBe('fuego');
  });

  it('GDD-WLD-07 1-1 in Fuego, fireballs spat from the left block of the pen at column 78 defeat both of its Alacranes', () => {
    let run: RunState = { ...startRun(LEVEL_1_1), power: 'fuego', player: { ...spawn(mid(78), 208), grounded: true } };
    for (let i = 0; i < 360; i++) run = stepRun(run, { move: 0, jumpHeld: false, fuego: i % 20 === 0 }, LEVEL_1_1);
    expect(run.enemies[3]!.alive).toBe(false);
    expect(run.enemies[4]!.alive).toBe(false);
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-ENM-01 1-1 no Zopilote spots Poncho standing at the start or at an ofrenda', () => {
    const level: Level = { ...LEVEL_1_1, enemies: LEVEL_1_1.enemies.filter((e) => kindOf(e) === 'zopilote') };
    for (const at of [LEVEL_1_1.spawn, ...LEVEL_1_1.ofrendas]) {
      let run: RunState = { ...startRun(level), player: { ...spawn(at.x, at.y), grounded: true } };
      for (let i = 0; i < 600; i++) {
        run = stepRun(run, { move: 0, jumpHeld: false }, level);
        expect(run.enemies.map((e) => e.flight!.phase), `at ${at.x}, step ${i}`).toEqual(['cruise', 'cruise']);
      }
    }
  });

  it('GDD-WLD-07 1-1 each Zopilote spots Poncho on the floor under its start', () => {
    [1, 7].forEach((index) => {
      const z = LEVEL_1_1.enemies[index]!;
      const level: Level = { ...LEVEL_1_1, enemies: [z] };
      let run: RunState = { ...startRun(level), player: { ...spawn(z.x, 224), grounded: true } };
      let spotted = false;
      for (let i = 0; i < 150 && !spotted; i++) {
        run = stepRun(run, { move: 0, jumpHeld: false }, level);
        spotted = run.enemies[0]!.flight!.phase === 'telegraph';
      }
      expect(spotted, `Zopilote at ${z.x}`).toBe(true);
    });
  });

  it('GDD-WLD-07 1-1 the veladora ledge is reached by a full jump from the right end of the raised platform', () => {
    const level: Level = { ...LEVEL_1_1, enemies: [] };
    const veladora = LEVEL_1_1.veladora!;
    const attempt = (jumpHeld: boolean): RunState => {
      let run: RunState = { ...startRun(level), lives: loseLife(startWorld()), player: { ...spawn(1816, 160), grounded: true } };
      for (let i = 0; i < 90; i++) run = stepRun(run, { move: 1, jumpHeld }, level);
      return run;
    };
    const jumped = attempt(true);
    expect(veladoraUsed(jumped.lives, veladora)).toBe(true);
    expect(jumped.lives.lives).toBe(7);
    expect(veladoraUsed(attempt(false).lives, veladora)).toBe(false);
  });
});
