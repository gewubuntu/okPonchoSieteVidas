// GDD-BOS-01: which boss a level holds, if any. Pure, no Phaser. A level with a boss is a boss level: the validator holds it to the
// boss-level rule (GDD-TEC-04), the scene shows the boss bar (GDD-UI-01). A new boss adds its id and its `Level` field here.
import type { Level } from './run';

/** The bosses, by id: Don Zopilote (GDD-BOS-02). */
export type BossId = 'zopilote';

/** The boss of `level`, or null in a level without one. */
export const levelBoss = (level: Level): BossId | null => (level.boss ? 'zopilote' : null);

/** GDD-BOS-01: whether `level` is a boss level. */
export const isBossLevel = (level: Level): boolean => levelBoss(level) !== null;
