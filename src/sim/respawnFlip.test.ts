import { describe, expect, it } from 'vitest';
import { FLIP, RESPAWN, TILE } from '../config/tuning';
import { flipPose } from './respawnFlip';
import { respawnPoint, startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

describe('GDD-LIFE-02 and GDD-MOV-05 respawn flip', () => {
  it('lasts 0.35 s, which is 21 steps, ending when the 0.8 s wait ends', () => {
    expect(FLIP.steps).toBe(21);
    expect(FLIP.steps).toBeLessThan(RESPAWN.delaySteps);
  });

  it('keeps Poncho hidden until the last 21 steps of the wait, then shows him', () => {
    expect(flipPose(RESPAWN.delaySteps).visible).toBe(false);
    expect(flipPose(FLIP.steps + 1).visible).toBe(false);
    expect(flipPose(FLIP.steps).visible).toBe(true);
    expect(flipPose(1).visible).toBe(true);
  });

  it('drops from 48 px above the respawn point down to it, faster and faster', () => {
    // The numbers are written out from GDD-LIFE-02, not read back from the tuning file.
    expect(FLIP.height).toBe(48);
    expect(FLIP.turns).toBe(1);
    expect(flipPose(11).dy).toBeCloseTo(34.8, 1); // part way down: a straight, a quadratic and a cubic drop all differ here
    const poses = Array.from({ length: FLIP.steps }, (_, i) => flipPose(FLIP.steps - i));
    expect(poses[0]!.dy).toBeGreaterThan(FLIP.height - 1);
    expect(poses[0]!.dy).toBeLessThanOrEqual(FLIP.height);
    expect(poses.at(-1)!.dy).toBe(0);
    const drops = poses.slice(1).map((p, i) => poses[i]!.dy - p.dy);
    for (const d of drops) expect(d).toBeGreaterThan(0);
    for (let i = 1; i < drops.length; i++) expect(drops[i]!).toBeGreaterThan(drops[i - 1]!); // accelerating
  });

  it('turns exactly once and lands feet-first: upright on the last step', () => {
    const poses = Array.from({ length: FLIP.steps }, (_, i) => flipPose(FLIP.steps - i));
    for (let i = 1; i < poses.length; i++) expect(poses[i]!.angle).toBeGreaterThan(poses[i - 1]!.angle);
    expect(poses.at(-1)!.angle).toBeCloseTo(FLIP.turns * 2 * Math.PI, 10);
    expect(poses[0]!.angle).toBeLessThan(2 * Math.PI * 0.1); // starts upright-ish, not already turned
    // upside down about half way through
    expect(Math.abs(poses[10]!.angle - Math.PI)).toBeLessThan(0.5);
  });

  it('is on the ground and upright when the wait is over', () => {
    expect(flipPose(0)).toEqual({ visible: true, dy: 0, angle: 0 });
  });
});

describe('GDD-LIFE-02 where the flip lands', () => {
  const world = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
  const level: Level = {
    world,
    spawn: { x: 24, y: 4 * TILE },
    ofrendas: [{ id: 'a', x: 152, y: 4 * TILE }],
    spikes: [],
    crumbles: [],
    springs: [],
    platforms: [],
    tacos: [],
    pinatas: [],
  };

  it('is the level start without an ofrenda, and the latest ofrenda after one', () => {
    const run = startRun(level);
    expect(respawnPoint(run, level)).toEqual({ x: 24, y: 64 });
    expect(respawnPoint({ ...run, checkpoint: { x: 152, y: 64 }, checkpointIndex: 0 }, level)).toEqual({ x: 152, y: 64 });
  });

  it('is the level start when the last life is gone, whatever the checkpoint', () => {
    const run: RunState = { ...startRun(level), checkpoint: { x: 152, y: 64 }, checkpointIndex: 0 };
    const spent: RunState = { ...run, lives: { ...run.lives, lives: 0 } };
    expect(respawnPoint(spent, level)).toEqual({ x: 24, y: 64 });
  });

  it('is where Poncho really appears when the wait ends', () => {
    let run: RunState = { ...startRun(level), checkpoint: { x: 152, y: 64 }, checkpointIndex: 0 };
    run = { ...run, player: { ...run.player, x: 104, y: 200 } };
    run = stepRun(run, { move: 0, jumpHeld: false }, level); // into the pit
    expect(run.phase).toBe('respawning');
    const landing = respawnPoint(run, level);
    for (let i = 0; i < RESPAWN.delaySteps; i++) run = stepRun(run, { move: 0, jumpHeld: false }, level);
    expect(run.phase).toBe('playing');
    expect(run.player).toMatchObject(landing);
  });
});
