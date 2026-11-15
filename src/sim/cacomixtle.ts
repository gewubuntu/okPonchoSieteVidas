// GDD-ENM-04: the Cacomixtle (ringtail), World 3's rider of a cart of its own. It waits in its cart at its start, and when Poncho is ahead of it
// along its rail (by more than 0 and up to CACOMIXTLE.sightX) with his feet within CACOMIXTLE.sightY of the cart's floor, it telegraphs for
// CACOMIXTLE.telegraphSteps with the cart still, then the cart rolls with a cart's speeds (GDD-WLD-15) to its buffer, where the ringtail is
// parked. An enemy's step has no rails (`stepEnemy`), so every Cacomixtle of a level is stepped here against the rails and the carts, after
// this step's carts have rolled. Pure logic, no Phaser (GDD-TEC-02).
import { CACOMIXTLE } from '../config/tuning';
import { cartFloor, type CartState, type Rail } from './cart';
import { centre, kindOf, type Enemy, type EnemyState, type Ride } from './enemy';
import type { PlayerState } from './movement';

/** The places in `Level.rails` of the rails that a Cacomixtle of the level rides, alive or not. */
export const cacomixtleRails = (defs: readonly Enemy[]): ReadonlySet<number> => new Set(defs.flatMap((d) => (kindOf(d) === 'cacomixtle' ? [d.rail!] : [])));

/** The places in `Level.rails` of the rails with a live Cacomixtle in its cart. */
export const riderRails = (defs: readonly Enemy[], states: readonly EnemyState[]): ReadonlySet<number> =>
  new Set(defs.flatMap((d, i) => (kindOf(d) === 'cacomixtle' && states[i]!.alive ? [d.rail!] : [])));

/**
 * Is the telegraph's flash red: the first CACOMIXTLE.flashOn steps of it, then CACOMIXTLE.flashOff plain, and so on (GDD-ENM-04, 4 on and
 * 4 off). Only a telegraphing ringtail flashes.
 */
export const cacomixtleRed = (state: EnemyState): boolean => {
  const ride = state.ride!;
  return ride.phase === 'telegraph' && (ride.t - 1) % (CACOMIXTLE.flashOn + CACOMIXTLE.flashOff) < CACOMIXTLE.flashOn;
};

/**
 * Does the ringtail waiting in `cart` see Poncho (`player`, as he was at the step's start)? His hurtbox's centre is ahead of its middle `x`
 * along the rail's way by more than 0 and up to CACOMIXTLE.sightX, and his feet are within CACOMIXTLE.sightY of the cart's floor, up or down.
 */
function sees(player: PlayerState, rail: Rail, cart: CartState, x: number): boolean {
  const ahead = (centre(player).x - x) * rail.dir;
  return ahead > 0 && ahead <= CACOMIXTLE.sightX && Math.abs(player.y - cartFloor(rail, cart).y) <= CACOMIXTLE.sightY;
}

const PARKED: Ride = { phase: 'parked', t: 0 };

/**
 * A live ringtail's ride after a step: waiting, it starts to telegraph when it sees him; a telegraph counts its steps on and then rides,
 * whatever he does ("never stopping or turning for him", so `sighted` is read only while it waits); riding, it parks on the step its cart has stopped.
 */
function nextRide(ride: Ride, sighted: boolean, cart: CartState): Ride {
  if (ride.phase === 'waiting') return sighted ? { phase: 'telegraph', t: 1 } : ride;
  const now: Ride = ride.phase === 'telegraph' ? (ride.t < CACOMIXTLE.telegraphSteps ? { phase: 'telegraph', t: ride.t + 1 } : { phase: 'riding', t: 0 }) : ride;
  return now.phase === 'riding' && cart.phase === 'stopped' ? PARKED : now;
}

/**
 * GDD-ENM-04: one step of every Cacomixtle in `defs` (`states` are the enemies before the step, `carts` the carts after this step's roll;
 * each ringtail's `Enemy.rail` is its cart's place in `rails`). A live one stands at its cart's middle with its feet on the cart's floor
 * there, the cart having rolled; a waiting one tests its sight against `player` (as he was at the step's start), and on the step its
 * telegraph's last step is counted its cart starts rolling. A defeated one stays where it fell. Other enemies come back as they were.
 *
 * The cart started on the telegraph's last step keeps the `m` it had: this step's roll is done, so the next step's `rollCarts` first moves it,
 * as a cart Poncho boards moves first on the step after (GDD-WLD-15).
 */
export function stepCacomixtles(defs: readonly Enemy[], states: readonly EnemyState[], rails: readonly Rail[], carts: readonly CartState[], player: PlayerState): { enemies: EnemyState[]; carts: CartState[] } {
  const started = [...carts];
  const enemies = states.map((s, i) => {
    const def = defs[i]!;
    if (kindOf(def) !== 'cacomixtle' || !s.alive) return s;
    const rail = rails[def.rail!]!;
    const cart = carts[def.rail!]!;
    const x = rail.x + rail.dir * cart.m;
    const ride = nextRide(s.ride!, sees(player, rail, cart, x), cart);
    if (ride.phase === 'telegraph' && ride.t === CACOMIXTLE.telegraphSteps) started[def.rail!] = { ...cart, phase: 'rolling' };
    return { ...s, x, y: cartFloor(rail, cart).y, ride };
  });
  return { enemies, carts: started };
}
