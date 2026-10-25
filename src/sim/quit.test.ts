import { describe, expect, it } from 'vitest';
import { SANDBOX_LEVEL } from '../levels/sandbox';
import { loseLife } from './lives';
import { startRun, stepRun, type RunState } from './run';

describe('GDD-UI-02 quit to title: the run is fresh', () => {
  it('starting a run again after a played one gives the state of the first start', () => {
    const level = SANDBOX_LEVEL;
    const fresh = startRun(level);
    // A played run: lives lost, a power-up, a key, the first hilo and the first taco taken, some steps walked.
    let played: RunState = { ...fresh, lives: loseLife(loseLife(fresh.lives)), power: 'taco', keysHeld: 1 };
    played = { ...played, hilosTaken: played.hilosTaken.map(() => true), tacosTaken: played.tacosTaken.map(() => true) };
    for (let i = 0; i < 90; i++) played = stepRun(played, { move: 1, jumpHeld: i % 40 < 10 }, level);
    expect(played).not.toEqual(fresh);
    expect(startRun(level)).toEqual(fresh);
    expect(fresh.lives.lives).toBe(7);
    expect(fresh.hilosTaken.every((t) => !t)).toBe(true);
  });
});
