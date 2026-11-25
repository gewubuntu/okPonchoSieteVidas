import { describe, expect, it } from 'vitest';
import { startRun, type Level, type RunState } from '../sim/run';
import { stateHash } from '../sim/stateHash';
import { runBot, type Bot } from './bots';
import { LEVEL_3_2 } from './level3-2';
import { bot as bot32, RIDE_KETSU, RIDE_KI, RIDE_SHO, RIDE_TEN } from './level3-2.drive';
import { LEVEL_3_3 } from './level3-3';
import { bot as bot33, RIDER } from './level3-3.drive';
import { LEVEL_3_4 } from './level3-4';
import { base, fightTasks } from './level3-4.drive';
import { expectReplay, headerFor } from './tape';

// GDD-TEC-09: the bots of 3-2, 3-3 and 3-4 are built on `runBot`, which steps with the simulation's own `stepRun`, so there is no tape here: a
// `Bot` keeps what each step read (`inputs`) and its state (`states`), and the run is replayed from those.

/** The run `b` played from `from` as the record of `id`'s level, replayed on `level`: every hash equal, the clear on the run's last step. */
function replaysAs(id: string, level: Level, from: RunState, b: Bot, steps: number): void {
  expect(b.end.phase).toBe('clear');
  expect(b.lost).toEqual([]);
  expect(b.states).toHaveLength(steps);
  const clearAt = b.states.findIndex((r) => r.phase === 'clear') + 1;
  const replayed = expectReplay({ start: from, inputs: b.inputs, hashes: b.states.map(stateHash), clearAt }, headerFor(id, level), level);
  expect(replayed.firstDiff).toBe(-1);
  expect(replayed.steps).toBe(b.states.length);
  expect(replayed.clearReplay).toBe(replayed.clearTaped);
  expect(replayed.clearReplay).toBe(b.states.length);
}

describe("GDD-TEC-09 World 3's bots replay", () => {
  it("GDD-TEC-09 3-2 the rider's run replays from its record", () => {
    const from = startRun(LEVEL_3_2);
    const b = bot32([...RIDE_KI(), ...RIDE_SHO(), ...RIDE_TEN(), ...RIDE_KETSU()], from, 8000);
    replaysAs('3-2', LEVEL_3_2, from, b, 1750); // measured 2026-11-21
  });

  it("GDD-TEC-09 3-3 the rider's run replays from its record", () => {
    const from = startRun(LEVEL_3_3);
    const b = bot33(RIDER(), from, 8000);
    replaysAs('3-3', LEVEL_3_3, from, b, 2750); // measured 2026-11-21
  });

  it('GDD-TEC-09 3-4 the fight replays from its record', () => {
    const from = base();
    const b = runBot(fightTasks(), from, LEVEL_3_4, 4000);
    replaysAs('3-4', LEVEL_3_4, from, b, 1367); // level3-4.bot.test.ts pins it
  });
});
