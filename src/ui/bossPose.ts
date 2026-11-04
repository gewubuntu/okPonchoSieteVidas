// GDD-BOS-02, GDD-UI-01: how Don Zopilote is drawn in each mode, and the boss bar's pips. Pure, no Phaser: the scene draws what this says.
import { BASE_WIDTH, BOSS, BOSS_BAR } from '../config/tuning';
import type { BossState } from '../sim/boss';

export interface BossPose {
  /** Raised for the telegraph and on the upbeat of a flap; lowered otherwise. */
  readonly wings: 'raised' | 'lowered';
  /** The body's flash: red in the telegraph (GDD-ENM-01), white when hurt or defeated, on for BOSS.flashSteps and off for as many. */
  readonly flash: 'red' | 'white' | null;
  /** Three pale dots over his head while he is stuck in the sand. */
  readonly dazed: boolean;
}

/** The modes in which he flaps his wings, up for BOSS.flapSteps and down for as many. */
const FLAPPING: readonly BossState['mode'][] = ['lap', 'climb', 'drop', 'sweep'];

export function bossPose(b: BossState): BossPose {
  const blink = Math.floor(b.age / BOSS.flashSteps) % 2 === 0;
  const flapUp = FLAPPING.includes(b.mode) && Math.floor(b.age / BOSS.flapSteps) % 2 === 0;
  return {
    wings: b.mode === 'telegraph' || flapUp ? 'raised' : 'lowered',
    flash: b.mode === 'telegraph' && blink ? 'red' : (b.mode === 'hurt' || b.mode === 'defeated') && blink ? 'white' : null,
    dazed: b.mode === 'stuck',
  };
}

/** GDD-UI-01: how many of the boss bar's pips are filled: one for each hit he has left. */
export const bossPips = (b: BossState): number => BOSS.hits - b.hits;

/** GDD-UI-01: the boss bar's `pips` pips (one per hit that beats the boss, `bossBar`), left to right, centred together on the screen's middle, in game px. */
export function bossPipBoxes(pips: number): { x: number; y: number; w: number; h: number }[] {
  const width = pips * BOSS_BAR.pipSize + (pips - 1) * BOSS_BAR.pipGap;
  const left = BASE_WIDTH / 2 - width / 2;
  return Array.from({ length: pips }, (_, i) => ({ x: left + i * (BOSS_BAR.pipSize + BOSS_BAR.pipGap), y: BOSS_BAR.pipTop, w: BOSS_BAR.pipSize, h: BOSS_BAR.pipSize }));
}
