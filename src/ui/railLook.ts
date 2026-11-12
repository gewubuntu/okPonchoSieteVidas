// GDD-WLD-15, GDD-ART-06: how a level's rails and carts are drawn from World 3's railway sheets (`scripts/art/rails.mjs`): for each rail the
// images of its tiles, its trestle where it has no ground under it, its buffer or its broken end's warning post; and each cart's look by its
// state. Pure, no Phaser: the scene creates the images this lists.
import { CART, TILE } from '../config/tuning';
import { railGround, railLength, warningPost, type CartState, type Rail } from '../sim/cart';
import type { World } from '../sim/movement';

/**
 * The rail sheet's layout (`scripts/art/rails.mjs`, a test compares them): frames 16 x 24 game px, a rail tile's frame placed with the lower
 * of its two grounds at row `ground`. The frames in sheet order; a bent's top goes `BENT_TOP` px under (over, if negative) that ground.
 */
export const RAIL_ART = { w: 16, h: 24, ground: 20 } as const;
export const RAIL_FRAMES = ['level', 'slopeUp', 'slopeDown', 'broken', 'stringerLevel', 'stringerUp', 'stringerDown', 'bentLevel', 'bentUp', 'bentDown', 'leg'] as const;
export type RailFrame = (typeof RAIL_FRAMES)[number];
export const BENT_TOP = { level: 2, slope: -13 } as const;
/** The buffer's frame (16 x 16) and the warning post's (8 x 24), each a sheet of one frame. */
export const BUFFER_SIZE = { w: 16, h: 16 } as const;
export const POST_SIZE = { w: 8, h: 24 } as const;

/** The cart's looks, in the vagoneta sheet's order: its back layers are frames 0 to 2, its front layers 3 to 5. */
export const CART_LOOKS = ['standing', 'rolling0', 'rolling1'] as const;
export type CartLook = (typeof CART_LOOKS)[number];
/** GDD-ART-06: a rolling cart shows its next rolling frame every `CART_FRAME_STEPS` steps. */
export const CART_FRAME_STEPS = 4;

/**
 * One image of the railway: `part` says what it is, `frame` which frame of its sheet (the rail sheet's by name; the buffer and the post have
 * one), `x` and `y` its top left in game px, `flip` mirrored left to right, `height` how much of its frame is drawn from its top (less than
 * the frame where a bent reaches the ground), and `rail` the rail's place in the level's list.
 */
export interface RailImage {
  readonly part: 'rail' | 'stringer' | 'bent' | 'leg' | 'buffer' | 'post';
  readonly frame: RailFrame | 'buffer' | 'post';
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
  readonly height: number;
  readonly rail: number;
}

type Shape = 'Level' | 'Up' | 'Down';
const RAIL_FRAME = { Level: 'level', Up: 'slopeUp', Down: 'slopeDown' } as const;

/** Is there ground in tile (tx, ty): a solid tile or a slope (GDD-MOV-09)? */
const groundAt = (world: World, tx: number, ty: number): boolean => world.solidTile(tx, ty) || (world.slopeAt?.(tx, ty) ?? null) !== null;

/**
 * GDD-ART-06: the images of every rail, in the level's order. For each rail tile (a tile column it crosses): its frame, level, up or down as
 * its ground runs on the screen (rising to the right is up, whichever way the cart rolls), and a broken rail's last tile its broken end,
 * mirrored for a cart rolling left. A rail tile with no ground in the tile its rail lies in (under a level tile's ground, or the tile a slope
 * crosses) stands on a trestle: a stringer under it, and on every second tile of each run of such tiles, from the run's first, a bent (32 px
 * apart) down to the top of the first ground tile under it or the level's bottom (`rows` tiles down): its top, then legs as far as it goes.
 * A buffer stands on the ground past the rail's end, its plate toward the cart; a broken rail's warning post 6 tiles before its end
 * (`warningPost`). The crumbling tiles are not ground here: no level lays a rail on them yet.
 */
export function railLook(world: World, rails: readonly Rail[], rows: number): RailImage[] {
  const out: RailImage[] = [];
  const bottom = rows * TILE;
  rails.forEach((r, rail) => {
    const tiles = railLength(r) / TILE;
    const trestle: { col: number; shape: Shape; low: number }[][] = [];
    let run: { col: number; shape: Shape; low: number }[] = [];
    for (let t = 0; t < tiles; t++) {
      const col = r.dir > 0 ? Math.floor(r.x / TILE) + t : Math.floor(r.x / TILE) - 1 - t;
      // Its grounds at its left and right edges on the screen.
      const [a, b] = [railGround(r, t * TILE), railGround(r, (t + 1) * TILE)];
      const [left, right] = r.dir > 0 ? [a, b] : [b, a];
      const shape: Shape = right < left ? 'Up' : right > left ? 'Down' : 'Level';
      const low = Math.max(left, right);
      const broken = r.end === 'broken' && t === tiles - 1;
      out.push({ part: 'rail', frame: broken ? 'broken' : RAIL_FRAME[shape], x: col * TILE, y: low - RAIL_ART.ground, flip: broken && r.dir < 0, height: RAIL_ART.h, rail });
      // The tile its rail lies in: under a level ground, the one below it; on a slope, the one the slope crosses.
      const under = shape === 'Level' ? low / TILE : low / TILE - 1;
      if (groundAt(world, col, under)) {
        if (run.length) trestle.push(run);
        run = [];
      } else run.push({ col, shape, low });
    }
    if (run.length) trestle.push(run);
    for (const stretch of trestle) {
      stretch.forEach(({ col, shape, low }, k) => {
        out.push({ part: 'stringer', frame: `stringer${shape}`, x: col * TILE, y: low - RAIL_ART.ground, flip: false, height: RAIL_ART.h, rail });
        if (k % 2 !== 0) return;
        const top = low + (shape === 'Level' ? BENT_TOP.level : BENT_TOP.slope);
        let ty = Math.floor(low / TILE);
        while (ty < rows && !groundAt(world, col, ty)) ty++;
        const foot = Math.min(ty * TILE, bottom);
        for (let y = top, first = true; y < foot; y += RAIL_ART.h, first = false) {
          out.push({ part: first ? 'bent' : 'leg', frame: first ? `bent${shape}` : 'leg', x: col * TILE, y, flip: false, height: Math.min(RAIL_ART.h, foot - y), rail });
        }
      });
    }
    const post = warningPost(r);
    if (post) out.push({ part: 'post', frame: 'post', x: post.x - POST_SIZE.w / 2, y: post.y - POST_SIZE.h, flip: false, height: POST_SIZE.h, rail });
    if (r.end === 'buffer') {
      const end = r.x + r.dir * railLength(r);
      out.push({ part: 'buffer', frame: 'buffer', x: r.dir > 0 ? end : end - BUFFER_SIZE.w, y: railGround(r, railLength(r)) - BUFFER_SIZE.h, flip: r.dir < 0, height: BUFFER_SIZE.h, rail });
    }
  });
  return out;
}

/**
 * GDD-ART-06: the look a cart is drawn with. Waiting at its start it stands, with its chock; rolling it shows rolling0 and rolling1 by
 * turns, a new one every CART_FRAME_STEPS of the run's steps (`clock`, so it holds still while the game is paused); stopped at its buffer or
 * falling off a broken end it keeps `last`, the look of its last rolling step; gone it is not drawn (null).
 */
export function cartLook(cart: CartState, clock: number, last: CartLook): CartLook | null {
  switch (cart.phase) {
    case 'waiting':
      return 'standing';
    case 'rolling':
      return Math.floor(clock / CART_FRAME_STEPS) % 2 === 0 ? 'rolling0' : 'rolling1';
    case 'gone':
      return null;
    default:
      return last;
  }
}

/** The cart's frame size: its box (GDD-WLD-15). */
export const CART_SIZE = { w: CART.width, h: CART.height } as const;
