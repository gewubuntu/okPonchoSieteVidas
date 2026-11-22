// GDD-TEC-09: a record replayed against the registered level it names, and only on its own simulation version.
import { LIVES_MAX } from '../config/tuning';
import { replay, type RecordHeader, type Replayed, type RunRecord } from '../sim/replay';
import { levelById, SAVED_LEVELS, type LevelEntry } from './index';

/** A whole number from `min` to `max`, as `readSave` reads one (GDD-PRG-02). */
const whole = (n: number, min: number, max = Infinity): boolean => Number.isInteger(n) && n >= min && n <= max;

/**
 * Whether the level can start the run the header names: lives a whole number from 1 to LIVES_MAX (GDD-LIFE-05), one hilo flag per hilo
 * of the level (GDD-WLD-04), and for a 'resume' a saved run as `readSave` accepts one (GDD-PRG-02): a saved level, the checkpoint one of
 * its ofrendas, the lives and the lives it started with whole numbers from 1 to LIVES_MAX, one hilo flag per hilo and a clock of 0 or more.
 */
function startsHere(header: RecordHeader, entry: LevelEntry): boolean {
  const hilos = entry.level.hilos?.length ?? 0;
  if (!whole(header.lives, 1, LIVES_MAX) || header.hilos.length !== hilos) return false;
  const saved = header.resume;
  if (saved === null) return true;
  return (
    SAVED_LEVELS[entry.id] !== undefined &&
    whole(saved.checkpoint, 0, entry.level.ofrendas.length - 1) &&
    whole(saved.lives, 1, LIVES_MAX) &&
    whole(saved.livesIn, 1, LIVES_MAX) &&
    saved.hilos.length === hilos &&
    whole(saved.clock, 0)
  );
}

/**
 * The replay of `record` on `version` (the simulation version replaying it), or why it cannot be replayed here, checked in this order:
 * another version, a level that is not registered, a header the level cannot start.
 */
export function replayRecord(record: RunRecord, version: string): Replayed | { error: 'version' | 'level' | 'header' } {
  // 'unbuilt' is what a process without the build's define calls itself (`SIM_VERSION`): no version to replay on.
  if (record.header.sim !== version || version === 'unbuilt') return { error: 'version' };
  const entry = levelById(record.header.level);
  if (entry === undefined) return { error: 'level' };
  if (!startsHere(record.header, entry)) return { error: 'header' };
  return replay(record, entry.level);
}
