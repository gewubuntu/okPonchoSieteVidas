// GDD-WLD-15, GDD-ART-06: how a cart on its rail is drawn (placeholder): a rigid tub on its two wheels, tilted with the rail under them.
// Pure, no Phaser: the scene draws what this says. The simulation's floor still follows the rail under the rider's own feet (`floorUnder`).
import { CART } from '../config/tuning';
import { railGround, railLength, type CartState, type Rail } from '../sim/cart';

/** How far each wheel's middle stands from the cart's middle, across: the wheels are 4 px wide, 5 px in from each end of the tub. */
export const WHEEL_OFFSET = CART.width / 2 - 7;

export interface CartPose {
  /**
   * The simulation's floor under the cart's middle (`cartFloor`): the tub is drawn turned about this point, which lies on its floor line at
   * its middle, so a rider's feet, 8 px over the rail under his own x, are on the floor drawn.
   */
  readonly x: number;
  readonly y: number;
  /** The tub's turn in radians, positive clockwise on the screen (y points down): 0 on level rail, -45 degrees with its right side up. */
  readonly angle: number;
  /** How far the tub's bottom is below its floor line, in its own frame: CART.floorPx when level, CART.floorPx * cos(angle) tilted. */
  readonly bottom: number;
}

/**
 * The pose of a cart on its rail: each wheel stands on the rail's ground under its own middle, WHEEL_OFFSET behind and ahead of the cart's
 * middle along the way it rolls (read at the rail's nearer end past either end), and the tub lies along the line through the two contacts,
 * its floor line through the floor under its middle. On a straight slope its bottom then lies on the rail's line (CART.floorPx * cos(angle)
 * across its own frame is CART.floorPx down the screen); elsewhere a wheel can be off the rail: up to 5.6 px at a join between a level
 * stretch and a slope, 9 px at a peak or a dip (measured in `cartPose.test.ts`).
 */
export function cartPose(rail: Rail, cart: CartState): CartPose {
  const length = railLength(rail);
  const ground = (m: number) => railGround(rail, Math.min(length, Math.max(0, m)));
  const back = ground(cart.m - WHEEL_OFFSET);
  const front = ground(cart.m + WHEEL_OFFSET);
  // Left to right on the screen: from the back wheel to the front one when it rolls right, the other way round when it rolls left.
  const angle = Math.atan2(rail.dir * (front - back), 2 * WHEEL_OFFSET);
  return { x: rail.x + rail.dir * cart.m, y: ground(cart.m) - CART.floorPx, angle, bottom: CART.floorPx * Math.cos(angle) };
}
