// GDD-BOS-01: which boss a level holds, if any. Pure, no Phaser. A level with a boss is a boss level: the validator holds it to the
// boss-level rule (GDD-TEC-04), the scene shows the boss bar (GDD-UI-01). A new boss adds its id and its `Level` field here.
import type { Level } from './run';

/** The bosses, by id: Don Zopilote (GDD-BOS-02), La Estrella (GDD-BOS-03) and La Catorce (GDD-BOS-04). */
export type BossId = 'zopilote' | 'estrella' | 'catorce';

/** The boss of `level`, or null in a level without one. */
export const levelBoss = (level: Level): BossId | null => (level.boss ? 'zopilote' : level.estrella ? 'estrella' : level.catorce ? 'catorce' : null);

/** GDD-BOS-01: whether `level` is a boss level. */
export const isBossLevel = (level: Level): boolean => levelBoss(level) !== null;
