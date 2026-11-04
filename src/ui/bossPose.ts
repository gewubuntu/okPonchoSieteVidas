// GDD-BOS-02, GDD-UI-01: how Don Zopilote is drawn in each mode, and the boss bar's pips. Pure, no Phaser: the scene draws what this says.
import { BASE_WIDTH, BOSS, BOSS_ART, BOSS_BAR, BOSS_DEFEAT } from '../config/tuning';
import type { BossState } from '../sim/boss';

/** The looks of one crown in his sheet, in order (the order of `scripts/art/boss.mjs`: a test compares them). */
export const BOSS_LOOKS = ['flapUp', 'flapDown', 'climbUp', 'climbDown', 'telegraph', 'telegraphRed', 'dive', 'stuck', 'sweep', 'hurt', 'hurtWhite'] as const;
/** The looks with no crown, last in his sheet: tumbling as he falls (turns A and B), then lying on his back, each with its white flash. */
export const BOSS_DEFEAT_LOOKS = ['tumbleA', 'tumbleAWhite', 'tumbleB', 'tumbleBWhite', 'defeat', 'defeatWhite'] as const;
export type BossLook = (typeof BOSS_LOOKS)[number] | (typeof BOSS_DEFEAT_LOOKS)[number];

export interface BossPose {
  /** Raised for the telegraph and on the upbeat of a flap, tucked while he dives, sweeps, is hurt or defeated, lowered otherwise. */
  readonly wings: 'raised' | 'lowered' | 'tucked';
  /** The body's flash: red in the telegraph (GDD-ENM-01), white when hurt or defeated, on for BOSS.flashSteps and off for as many. */
  readonly flash: 'red' | 'white' | null;
  /** Three pale dots over his head while he is stuck in the sand or lies defeated. */
  readonly dazed: boolean;
  /** The points on his crown: one for each hit he has left, none once he is defeated. */
  readonly crown: number;
  /** The look of his frame in the sheet. */
  readonly look: BossLook;
}

/** The modes in which he flaps his wings, up for BOSS.flapSteps and down for as many. */
const FLAPPING: readonly BossState['mode'][] = ['lap', 'climb', 'drop'];

/**
 * His pose; `floor` is the y of the arena's floor (his def's `floor`). Flapping, his wings stay raised while lowered ones would reach into the
 * floor: his box's bottom less than BOSS_ART.wingsBelow px above it, as at the end of a drop or the start of a climb. Defeated, he
 * tumbles, turn A or B by his age, but a tumble shows only while it fits above the floor (BOSS_ART.tumbleABelow, tumbleBBelow), else he lies.
 */
export function bossPose(b: BossState, floor: number): BossPose {
  const blink = Math.floor(b.age / BOSS.flashSteps) % 2 === 0;
  const room = floor - (b.y + BOSS.height / 2);
  const flapUp = FLAPPING.includes(b.mode) && (Math.floor(b.age / BOSS.flapSteps) % 2 === 0 || room < BOSS_ART.wingsBelow);
  const flash = b.mode === 'telegraph' && blink ? 'red' : (b.mode === 'hurt' || b.mode === 'defeated') && blink ? 'white' : null;
  const look = ((): BossLook => {
    switch (b.mode) {
      case 'climb':
        return flapUp ? 'climbUp' : 'climbDown';
      case 'telegraph':
        return flash === 'red' ? 'telegraphRed' : 'telegraph';
      case 'dive':
        return 'dive';
      case 'stuck':
        return 'stuck';
      case 'sweep':
        return 'sweep';
      case 'hurt':
        return flash === 'white' ? 'hurtWhite' : 'hurt';
      case 'defeated': {
        const turnB = Math.floor(b.age / BOSS_DEFEAT.tumbleSteps) % 2 === 1;
        const lying = room < BOSS_ART.tumbleABelow;
        const kind = lying ? 'defeat' : turnB && room >= BOSS_ART.tumbleBBelow ? 'tumbleB' : 'tumbleA';
        return flash === 'white' ? (`${kind}White` as BossLook) : kind;
      }
      default:
        return flapUp ? 'flapUp' : 'flapDown';
    }
  })();
  return {
    wings: b.mode === 'dive' || b.mode === 'sweep' || b.mode === 'hurt' || b.mode === 'defeated' ? 'tucked' : b.mode === 'telegraph' || flapUp ? 'raised' : 'lowered',
    flash,
    dazed: look === 'stuck' || look === 'defeat' || look === 'defeatWhite',
    crown: bossPips(b),
    look,
  };
}

/** The frame of his sheet for a look and a crown: the three crowns' looks in turn, then the defeat looks (crown 0). */
export function bossFrame(p: { look: BossLook; crown: number }): number {
  const defeat = (BOSS_DEFEAT_LOOKS as readonly BossLook[]).indexOf(p.look);
  if (defeat >= 0) return BOSS.hits * BOSS_LOOKS.length + defeat;
  return (BOSS.hits - p.crown) * BOSS_LOOKS.length + (BOSS_LOOKS as readonly BossLook[]).indexOf(p.look);
}

/** What a frame of his sheet shows, to read back what was drawn (L-010): `bossFrame`'s inverse, with the wings, flash and dots of its look. */
export function bossFrameInfo(frame: number): { look: BossLook; crown: number; wings: BossPose['wings']; flash: BossPose['flash']; dots: number } {
  const defeated = frame >= BOSS.hits * BOSS_LOOKS.length;
  const look: BossLook = defeated ? BOSS_DEFEAT_LOOKS[frame - BOSS.hits * BOSS_LOOKS.length]! : BOSS_LOOKS[frame % BOSS_LOOKS.length]!;
  const crown = defeated ? 0 : BOSS.hits - Math.floor(frame / BOSS_LOOKS.length);
  const wings = look.startsWith('flap') || look.startsWith('climb') ? (look.endsWith('Up') ? 'raised' : 'lowered') : look.startsWith('telegraph') ? 'raised' : look === 'dive' || look === 'sweep' || look.startsWith('hurt') || look.startsWith('defeat') || look.startsWith('tumble') ? 'tucked' : 'lowered';
  const flash = look === 'telegraphRed' ? 'red' : look.endsWith('White') ? 'white' : null;
  return { look, crown, wings, flash, dots: look === 'stuck' || look.startsWith('defeat') ? 3 : 0 };
}

/** GDD-UI-01: how many of the boss bar's pips are filled: one for each hit he has left. */
export const bossPips = (b: BossState): number => BOSS.hits - b.hits;

/** GDD-UI-01: the boss bar's `pips` pips (one per hit that beats the boss, `bossBar`), left to right, centred together on the screen's middle, in game px. */
export function bossPipBoxes(pips: number): { x: number; y: number; w: number; h: number }[] {
  const width = pips * BOSS_BAR.pipSize + (pips - 1) * BOSS_BAR.pipGap;
  const left = BASE_WIDTH / 2 - width / 2;
  return Array.from({ length: pips }, (_, i) => ({ x: left + i * (BOSS_BAR.pipSize + BOSS_BAR.pipGap), y: BOSS_BAR.pipTop, w: BOSS_BAR.pipSize, h: BOSS_BAR.pipSize }));
}
