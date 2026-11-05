// GDD-ENM-02, GDD-ART-05: which frame of its sheet each World 1 enemy shows, and where. Pure, no Phaser: the scene draws what this says.
import { CACTUS, ENEMY_ART, TLACUACHE } from '../config/tuning';
import { feetOf, kindOf, type Enemy, type EnemyState } from '../sim/enemy';
import { isWorld1, lookFrame, type EnemyLook, type World1Kind } from './enemyLooks';

/** What a pose is picked from: the run's clock (the cactus buddy's breathing and shiver) and the middle of Poncho's hurtbox (`centre`). */
export interface PoseContext {
  readonly clock: number;
  readonly poncho: { readonly x: number; readonly y: number };
}

export interface EnemyPose {
  readonly look: EnemyLook;
  /** The frame of `look` in the kind's sheet. */
  readonly frame: number;
  /** The middle of its box across; down, a walker's feet and the middle of a Zopilote's box (its flight y). */
  readonly x: number;
  readonly y: number;
  /** Mirrored: it faces left (the art faces right). */
  readonly flip: boolean;
}

/** `n` mod `m`, never negative (a walker's x can be). */
const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Every `steps`, the next of `count` frames. */
const cycle = (age: number, steps: number, count: number): number => mod(Math.floor(age / steps), count);

const WALK = ['walk0', 'walk1', 'walk2', 'walk3'] as const;
const RUN = ['run0', 'run1', 'run2', 'run3'] as const;
const FLAP = ['flap0', 'flap1', 'flap2', 'flap3'] as const;
const CLIMB = ['climb0', 'climb1'] as const;
const DOZE = ['doze0', 'doze1'] as const;
const ALARM = ['alarm0', 'alarm1'] as const;

/** The telegraph's red flash (GDD-ENM-01): red for flashSteps, plain for as many. */
const flash = (age: number): EnemyLook => (Math.floor(age / ENEMY_ART.flashSteps) % 2 === 0 ? 'teleRed' : 'tele');

/** The look and the facing of each World 1 kind (see `enemyPose`). */
function lookOf(kind: World1Kind, def: Enemy, state: EnemyState, ctx: PoseContext): { look: EnemyLook; flip: boolean } {
  const left = state.dir < 0;
  switch (kind) {
    case 'alacran':
      return { look: WALK[cycle(state.x, ENEMY_ART.walkPx, 4)]!, flip: left };
    case 'zopilote': {
      const f = state.flight!;
      if (f.phase === 'telegraph') return { look: flash(f.age), flip: left };
      if (f.phase === 'dive') {
        const steep = Math.abs(f.aimY - f.y) >= ENEMY_ART.steepRatio * Math.abs(f.aimX - state.x);
        return { look: steep ? 'diveSteep' : 'diveShallow', flip: f.aimX === state.x ? left : f.aimX < state.x };
      }
      if (f.phase === 'return') return { look: CLIMB[cycle(f.age, ENEMY_ART.climbSteps, 2)]!, flip: left };
      return { look: FLAP[cycle(f.age, ENEMY_ART.flapSteps, 4)]!, flip: left };
    }
    case 'cactus': {
      // It faces Poncho while it peeks or is alarmed, and dozes facing right.
      const dx = ctx.poncho.x - state.x;
      const dy = ctx.poncho.y - (feetOf(def, state) - CACTUS.height / 2);
      const within = (r: { x: number; y: number }) => Math.abs(dx) <= r.x && Math.abs(dy) <= r.y;
      if (within(ENEMY_ART.alarm)) return { look: ALARM[cycle(ctx.clock, ENEMY_ART.shiverSteps, 2)]!, flip: dx < 0 };
      if (within(ENEMY_ART.peek)) return { look: 'peek', flip: dx < 0 };
      return { look: DOZE[cycle(ctx.clock, ENEMY_ART.dozeSteps, 2)]!, flip: false };
    }
    case 'tlacuache': {
      const g = state.gait!;
      if (g.phase === 'telegraph') return { look: flash(g.age), flip: left };
      if (g.phase === 'charge') return { look: RUN[cycle(state.x, ENEMY_ART.chargePx, 4)]!, flip: left };
      if (g.phase === 'dead') {
        // Its feet curl in the last twitchSteps before it wakes, every other 4 steps (the placeholder's twitch).
        const twitch = g.age >= TLACUACHE.playDeadSteps - TLACUACHE.twitchSteps && Math.floor(g.age / 4) % 2 === 0;
        return { look: twitch ? 'deadTwitch' : 'dead', flip: left };
      }
      return { look: WALK[cycle(state.x, ENEMY_ART.walkPx, 4)]!, flip: left };
    }
    default:
      return kind satisfies never;
  }
}

/**
 * The pose of a World 1 enemy (GDD-ENM-02), or null for World 2's kinds. An Alacrán and a walking Tlacuache show the next walk frame every
 * ENEMY_ART.walkPx px they walk (a charging Tlacuache the next run frame every chargePx), so their legs keep pace with the ground. A cruising
 * Zopilote flaps, climbing back it beats harder, and diving it shows the steep look when the dive's drop is at least steepRatio times its run.
 * A telegraph flashes red (GDD-ENM-01). The cactus buddy dozes, peeks when Poncho comes near and is alarmed when he is close. A Tlacuache
 * playing dead twitches in its last TLACUACHE.twitchSteps. Each faces the way it goes, a Zopilote the way it dives.
 */
export function enemyPose(def: Enemy, state: EnemyState, ctx: PoseContext): EnemyPose | null {
  const kind = kindOf(def);
  if (!isWorld1(kind)) return null;
  const { look, flip } = lookOf(kind, def, state, ctx);
  return { look, frame: lookFrame(kind, look), x: state.x, y: state.flight?.y ?? feetOf(def, state), flip };
}
