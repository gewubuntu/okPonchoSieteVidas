import { describe, expect, it } from 'vitest';
import { spawn, type PlayerInput } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';
import { stepVibration } from './vibration';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const base = { ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] } as const;

// A flat floor, top at y = 64 (row 4), 40 tiles wide.
const flat: Level = { ...base, world: parseTiles([...Array.from({ length: 4 }, () => '.'.repeat(40)), '#'.repeat(40), '#'.repeat(40)]), spawn: { x: 24, y: 64 } };
// Floor on the left (x < 80), a 3-tile pit (x 80 to 128), floor on the right. Floor top y = 64.
const pit: Level = { ...base, world: parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']), spawn: { x: 24, y: 64 } };

/** The vibration each step asks for, playing on from `r`. */
function play(level: Level, r: RunState, steps: number, input: PlayerInput): { after: RunState; ms: number | null }[] {
  const out: { after: RunState; ms: number | null }[] = [];
  for (let i = 0; i < steps; i++) {
    const after = stepRun(r, input, level);
    out.push({ after, ms: stepVibration(r, after) });
    r = after;
  }
  return out;
}

describe('GDD-CTL-03 vibration on life loss', () => {
  it('a fall into a pit vibrates 50 ms once, on the step the life is lost', () => {
    const beats = play(pit, startRun(pit), 200, right);
    const lost = beats.findIndex((b) => b.after.lives.lives === 6);
    expect(lost).toBeGreaterThan(0);
    expect(beats[lost]!.ms).toBe(50);
    // Nothing on the way to the pit, nor in the wait that follows it (0.8 s, 48 steps).
    expect(beats.slice(0, lost + 48).filter((b) => b.ms !== null)).toHaveLength(1);
  });

  it('a spike hit vibrates 50 ms', () => {
    const spiked: Level = { ...flat, spikes: [{ col: 8, row: 3 }] };
    const before: RunState = { ...startRun(spiked), player: spawn(136, 64) };
    const after = stepRun(before, idle, spiked);
    expect(after.lives.lives).toBe(6);
    expect(stepVibration(before, after)).toBe(50);
  });

  it('losing the last life vibrates too', () => {
    const start = startRun(pit);
    const before: RunState = { ...start, lives: { ...start.lives, lives: 1 } };
    const beats = play(pit, before, 200, right);
    const lost = beats.findIndex((b) => b.after.lives.lives === 0);
    expect(lost).toBeGreaterThan(0);
    expect(beats[lost]!.ms).toBe(50);
  });

  it('steps that keep or gain lives do not vibrate', () => {
    const r = startRun(flat);
    expect(play(flat, r, 60, right).every((b) => b.ms === null)).toBe(true);
    // A life given back (an ofrenda, the restart with seven lives) is no loss.
    const fewer: RunState = { ...r, lives: { ...r.lives, lives: 3 } };
    expect(stepVibration(fewer, r)).toBeNull();
  });
});
