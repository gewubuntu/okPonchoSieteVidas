import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { loseLife, startWorld } from '../sim/lives';
import { spawn, type PlayerInput } from '../sim/movement';
import { startRun, stepRun, touchesExit, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import { LEVEL_1_1 } from './level1-1';
import { LEVELS } from './index';
import { gaps } from './validate';

const world = LEVEL_1_1.world;

/** Whether a standable top (a solid tile with an empty tile above it) in `col` is 0 to 88 px below `midY`: 32 px body plus the 56 px jump (GDD-MOV-02, GDD-MOV-06). */
const topBelow = (col: number, midY: number): boolean => {
  for (let row = 0; row < world.height; row++) {
    if (!world.solidTile(col, row) || world.solidTile(col, row - 1)) continue;
    const drop = row * TILE - midY;
    if (drop >= 0 && drop <= 88) return true;
  }
  return false;
};

describe('GDD-WLD-06 level 1-1', () => {
  it('GDD-WLD-06 1-1 is 90 by 17 tiles, a World 1 level and no test level', () => {
    expect(world.width).toBe(90);
    expect(world.height).toBe(17);
    const entry = LEVELS.find((e) => e.id === '1-1');
    expect(entry).toBeDefined();
    expect(entry!.world).toBe(1);
    expect(entry!.test).toBe(false);
    expect(entry!.level).toBe(LEVEL_1_1);
  });

  it('GDD-WLD-03 1-1 ofrendas stand at about 25 55 and 85 percent', () => {
    const width = 1440;
    expect(LEVEL_1_1.ofrendas).toHaveLength(3);
    [0.25, 0.55, 0.85].forEach((share, i) => {
      expect(Math.abs(LEVEL_1_1.ofrendas[i]!.x / width - share), `ofrenda ${i + 1}`).toBeLessThan(0.03);
    });
  });

  it('GDD-WLD-03 1-1 gaps are 1 2 3 and 3 tiles', () => {
    expect(gaps(world)).toEqual([
      { col: 16, width: 1 },
      { col: 19, width: 2 },
      { col: 53, width: 3 },
      { col: 71, width: 3 },
    ]);
  });

  it('GDD-WLD-06 1-1 has 50 hilos each in an empty tile within a jump of a floor', () => {
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
 * A bot that always holds right and jumps (held for 20 steps) when something is ahead: a wall in the row above his feet within
 * 14 px of his front edge, a drop of three tiles or more within 10 px, a spike starting within 26 px of him, or a live Alacrán on his level
 * within 40 px.
 */
function bot(level: Level, maxSteps: number): { run: RunState; steps: number } {
  let run = startRun(level);
  let hold = 0;
  let steps = 0;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const { x, y, grounded } = run.player;
    if (run.phase === 'playing' && grounded && hold === 0) {
      const front = x + 6;
      const feetRow = Math.floor((y - 1) / TILE);
      let jump = false;
      for (let d = 0; d <= 14; d++) if (world.solidTile(Math.floor((front + d) / TILE), feetRow)) jump = true;
      // A drop of three tiles or more (a gap, or the edge of a wall 3 tiles high); a smaller step down is just walked off.
      for (let d = 0; d <= 10; d++) {
        const col = Math.floor((front + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < world.height && !world.solidTile(col, feetRow + 1 + empty)) empty++;
        if (empty >= 3) jump = true;
      }
      for (const s of level.spikes) if (s.row === feetRow && s.col * TILE - x >= 0 && s.col * TILE - x <= 26) jump = true;
      level.enemies.forEach((e, i) => {
        if (run.enemies[i]!.alive && Math.abs(e.y - y) < 4 && run.enemies[i]!.x - x >= 0 && run.enemies[i]!.x - x <= 40) jump = true;
      });
      if (jump) hold = 20;
    }
    const input: PlayerInput = { move: 1, jumpHeld: hold > 0 };
    if (hold > 0) hold--;
    run = stepRun(run, input, level);
    steps++;
  }
  return { run, steps };
}

describe('GDD-WLD-06 playing 1-1', () => {
  it('GDD-WLD-06 1-1 can be played from the start to the exit with all seven lives', () => {
    const { run, steps } = bot(LEVEL_1_1, 900);
    expect(run.phase).toBe('clear');
    expect(steps).toBeLessThan(900);
    expect(run.lives.lives).toBe(7);
    expect(touchesExit(run.player, LEVEL_1_1.exit!)).toBe(true);
  });

  it('GDD-WLD-06 1-1 the veladora ledge is reached by a full jump from the right end of the raised platform', () => {
    const level: Level = { ...LEVEL_1_1, enemies: [] };
    const veladora = LEVEL_1_1.veladora!;
    const attempt = (jumpHeld: boolean): RunState => {
      let run: RunState = { ...startRun(level), lives: loseLife(startWorld()), player: { ...spawn(1096, 160), grounded: true } };
      for (let i = 0; i < 90; i++) run = stepRun(run, { move: 1, jumpHeld }, level);
      return run;
    };
    const jumped = attempt(true);
    expect(veladoraUsed(jumped.lives, veladora)).toBe(true);
    expect(jumped.lives.lives).toBe(7);
    const walked = attempt(false);
    expect(veladoraUsed(walked.lives, veladora)).toBe(false);
  });
});
