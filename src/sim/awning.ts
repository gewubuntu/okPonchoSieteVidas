// GDD-WLD-10: awnings (toldos). An awning is a flat market tarp, a one-way surface like a platform's top that does not move: Poncho
// lands on it from above and passes through it from below and the sides. Landing on it holding jump (or with jump pressed in the
// buffer, GDD-MOV-03) throws him up at the next tier over held rebounds in a row (the hold ladder, user, 2026-11-04); landing without
// gives at most one small rebound, then he stands on it. A torn awning bounces him once, then is gone until a life is lost.
// Pure logic, no Phaser (GDD-TEC-02).
import { AWNING, HITBOX } from '../config/tuning';
import type { PlayerInput, PlayerState } from './movement';
import type { PlatformPos } from './platform';

/** An awning's top surface: its left edge, its top (the bounce line) and its width, in px. A torn one bounces once (GDD-WLD-10). */
export interface Awning {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly torn?: boolean;
}

/** GDD-WLD-10: the latest rebound off an awning: which awning (-1 for a late press in the air), its tier (0 a plain rebound) and the run clock of its step. */
export interface AwningBounce {
  readonly awning: number;
  readonly tier: number;
  readonly at: number;
}

/** What a step's landing on the awnings did: Poncho after it, the rebound if there was one, and the torn awning he landed on (-1 if none). */
export interface AwningLanding {
  readonly player: PlayerState;
  readonly bounce: { readonly awning: number; readonly tier: number } | null;
  readonly tore: number;
}

/** Keeps floating point noise from deciding whether feet are on a surface (as on a platform). */
const EPS = 1e-6;
const HALF = HITBOX.width / 2;

const overlapsX = (player: PlayerState, a: Awning): boolean => player.x + HALF > a.x && player.x - HALF < a.x + a.w;

/** One flag per awning: is it gone (a torn awning after its one bounce)? All there at the start and after a lost life. */
export const freshAwnings = (awnings: readonly Awning[]): boolean[] => awnings.map(() => false);

/** The tops of the awnings that are there now, for whatever else lands on them (GDD-ENM-03, GDD-BOS-03). */
export const awningTops = (awnings: readonly Awning[], gone: readonly boolean[]): PlatformPos[] =>
  awnings.filter((_, i) => !gone[i]).map(({ x, y, w }) => ({ x, y, w }));

/**
 * Up at `speed`, in the air, with no coyote jump: like a spring's launch, but a release still cuts it like a jump (GDD-MOV-02), so
 * `bounced` is left false (a falling Poncho's always is, and a launch from standing follows a jump). The jump buffer is left as it is:
 * nothing reads it until he next lands, at least 0.1 s later.
 */
function launch(player: PlayerState, speed: number): PlayerState {
  // A wall slide has ended already: on landing (the `on` state below), and a late press is made rising, where none starts.
  const p: PlayerState = { ...player, vy: -speed, grounded: false, coyote: 0, gliding: false };
  delete p.takeoff; // a rebound is not a jump (GDD-AUD-02)
  return p;
}

/**
 * Poncho after a step, landed on the awnings. `before` is Poncho before the step (after any carry), `stepped` after it and after landing
 * on the level's platforms and cordeles, `gone` one flag per awning.
 * - Grounded on anything else (a tile wins over an awning at its height, a slope, a platform, a cordel, a spring's top): the chain and
 *   the late press end.
 * - A jump press in the `AWNING.lateSteps` after a plain landing counts as held at it: he leaves at that tier from this step (from the
 *   awning's top if he stood on it), unless the press kicked off a wall (GDD-MOV-08).
 * - Standing on an awning at the step's start, he stays on it: no landing.
 * - Landing on one (feet at or above its top before, at or below it after, his body box over its width by any amount): with jump held
 *   from a press the simulation saw (L-035) or pressed in the buffer, the next tier; without, half the landing speed, or standing on it
 *   below `AWNING.settleSpeed` (never on a torn one, which rebounds at least at `AWNING.tornMinSpeed`). A torn one tears.
 * Standing there never puts his box into a tile: the box at its top lies between his boxes before and after the step, which were clear.
 */
export function landOnAwnings(before: PlayerState, stepped: PlayerState, input: PlayerInput, awnings: readonly Awning[], gone: readonly boolean[]): AwningLanding {
  if (awnings.length === 0) return { player: stepped, bounce: null, tore: -1 };
  if (stepped.grounded) return { player: { ...stepped, awningChain: 0, awningLate: 0 }, bounce: null, tore: -1 };
  const chain = stepped.awningChain ?? 0;
  const late = stepped.awningLate ?? 0;
  // A torn one never holds him, so it is never stood on, gone or not.
  const standing = awnings.findIndex((a) => before.grounded && Math.abs(before.y - a.y) < EPS && overlapsX(before, a));
  const pressed = input.jumpHeld && !before.jumpWasHeld;
  if (pressed && late > 0 && stepped.takeoff !== 'kick') {
    const tier = stepped.awningLateTier ?? 1;
    const from = standing >= 0 ? { ...stepped, y: awnings[standing]!.y } : stepped;
    return { player: { ...launch(from, AWNING.tiers[tier - 1]!), awningChain: tier, awningLate: 0 }, bounce: { awning: standing, tier }, tore: -1 };
  }
  const i = awnings.findIndex((a, k) => !gone[k] && overlapsX(stepped, a) && before.y <= a.y + EPS && stepped.y >= a.y - EPS);
  const counted = late > 0 ? { ...stepped, awningLate: late - 1 } : stepped;
  if (i < 0) return { player: counted, bounce: null, tore: -1 };
  const a = awnings[i]!;
  // Standing or settling, as on a floor; a glide needs jump held, so he is not gliding here.
  const on: PlayerState = { ...counted, y: a.y, vy: 0, grounded: true, clinging: false };
  if (i === standing) return { player: on, bounce: null, tore: -1 };
  const tore = a.torn === true ? i : -1;
  const next = Math.min(chain + 1, AWNING.tiers.length);
  if ((stepped.jumpHeldSteps ?? 0) > 0 || stepped.jumpBuffer > 0) {
    // No late press is pending: a held landing comes far more than 0.1 s after the last plain one.
    return { player: { ...launch(on, AWNING.tiers[next - 1]!), awningChain: next }, bounce: { awning: i, tier: next }, tore };
  }
  const half = stepped.vy * AWNING.plainFactor;
  const speed = a.torn === true ? Math.max(half, AWNING.tornMinSpeed) : half;
  const after = { awningChain: 0, awningLate: AWNING.lateSteps, awningLateTier: next };
  if (speed < AWNING.settleSpeed) return { player: { ...on, ...after }, bounce: null, tore };
  return { player: { ...launch(on, speed), ...after }, bounce: { awning: i, tier: 0 }, tore };
}
