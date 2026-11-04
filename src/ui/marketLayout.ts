// GDD-WLD-10, GDD-WLD-11, GDD-ART-06: where the awnings, cordeles and rollos are drawn and with which frame of their sheets
// (assets/sprites/mercado/, laid out by scripts/art/mercado.mjs: AWNING_ART, CORDEL_ART, ROLLO_ART). Pure, no Phaser; MarketThings.ts draws.
import { AWNING, TICK_HZ, TILE } from '../config/tuning';
import type { Awning, AwningBounce } from '../sim/awning';
import { rolloLength, type Rollo, type RolloState } from '../sim/papel';
import type { TileGrid } from '../sim/tilemap';

/** awning.png: frames 16 x 16 game px, three columns (left end, middle, right end); a frame's top is 1 px above the awning's top. */
export const AWNING_SHEET = { frame: TILE, columns: 3, canvasTop: 1, rows: { torn: 4, tornHalves: 8, posts: 9 }, sags: [0, 2, 4, 6] } as const;
/** cordel.png: frames 24 x 16, drawn at (tile x - 4, line top - 2). 0 to 2 and 3 to 5: the two flag pairs at rest, swayed right and left; 6, 7 the left post's top and pole, 8, 9 the right post's. */
export const CORDEL_SHEET = { w: 24, h: 16, margin: 4, lineTop: 2, leftPost: 6, rightPost: 8 } as const;
/** rollo.png: frames 24 x 24, drawn at (tile x - 4, line top - 2) of the end tile by the post. 0 to 2 by a left post (rest, swayed, flapping open), 3 to 5 by a right post. */
export const ROLLO_SHEET = { frame: 24, margin: 4, lineTop: 2, flap: 2, right: 3 } as const;

/**
 * GDD-WLD-10: how far the awning's middle sags (px) and how far it is lifted above rest (px), `since` steps after its latest rebound
 * (1 on the rebound's own step): `AWNING.sagPx[tier]` for `AWNING.sagSteps` (a plain rebound 2 px, tiers 1 to 3 2, 4 and 6), then
 * `AWNING.liftPx` up for `AWNING.liftSteps`, then at rest. Only the awning that was bounced on moves.
 */
export function awningSag(bounce: AwningBounce | null, index: number, clock: number): { sag: number; lift: number } {
  if (bounce === null || bounce.awning !== index) return { sag: 0, lift: 0 };
  const since = clock - bounce.at;
  if (since >= 1 && since <= AWNING.sagSteps) return { sag: AWNING.sagPx[bounce.tier]!, lift: 0 };
  if (since > AWNING.sagSteps && since <= AWNING.sagSteps + AWNING.liftSteps) return { sag: 0, lift: AWNING.liftPx };
  return { sag: 0, lift: 0 };
}

/** The piece of tile `i` of an awning `tiles` wide: 0 the left end, 1 a middle piece, 2 the right end. */
export const awningPiece = (i: number, tiles: number): number => (i === 0 ? 0 : i === tiles - 1 ? 2 : 1);

/** The frame of tile `i` of an awning `tiles` wide, whole or torn, sagging `sag` px: 0, 2, 4 or 6, the rows of `AWNING_SHEET.sags`, one per 2 px. */
export const awningFrame = (i: number, tiles: number, sag: number, torn: boolean): number =>
  ((torn ? AWNING_SHEET.rows.torn : 0) + sag / 2) * AWNING_SHEET.columns + awningPiece(i, tiles);

/** One image of a sheet: its frame and where its top left goes, in game px. */
export interface Placed {
  readonly frame: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The images of an awning: its posts (from its top down to the ground, scenery behind Poncho), then its canvas tile by tile, or, once a
 * torn one is gone, its two halves hanging from the end posts.
 */
export function awningImages(a: Awning, gone: boolean, sag: { sag: number; lift: number }, world: TileGrid): { posts: Placed[]; cloth: Placed[] } {
  const tiles = Math.round(a.w / TILE);
  const top = a.y - AWNING_SHEET.canvasTop;
  const postFrame = (piece: number) => AWNING_SHEET.rows.posts * AWNING_SHEET.columns + piece;
  const posts = [0, tiles - 1].flatMap((i) => poleSteps(world, a.x + i * TILE + TILE / 2, top).map((y) => ({ frame: postFrame(awningPiece(i, tiles)), x: a.x + i * TILE, y })));
  if (gone) {
    const halves = AWNING_SHEET.rows.tornHalves * AWNING_SHEET.columns;
    return { posts, cloth: [{ frame: halves, x: a.x, y: top }, { frame: halves + 2, x: a.x + (tiles - 1) * TILE, y: top }] };
  }
  const cloth = Array.from({ length: tiles }, (_, i) => ({ frame: awningFrame(i, tiles, sag.sag, a.torn === true), x: a.x + i * TILE, y: top - sag.lift }));
  return { posts, cloth };
}

/** The tops of a pole's 16 px pieces from `top` down to the ground in column x (the first solid tile at or under it), or to the level's bottom. */
export function poleSteps(world: TileGrid, x: number, top: number): number[] {
  const col = Math.floor(x / TILE);
  let ground = world.height * TILE;
  for (let row = Math.max(0, Math.floor(top / TILE)); row < world.height; row++) {
    if (world.solidTile(col, row)) {
      ground = row * TILE;
      break;
    }
  }
  const steps: number[] = [];
  for (let y = top; y < ground; y += TILE) steps.push(y);
  return steps;
}

/** GDD-WLD-11: a flag pair's sway frame offset (0 rest, 1 right, 2 left) on a 2 s sine, its phase set by the tile's index along the line. */
export function swayOffset(tile: number, clock: number): number {
  const s = Math.sin((2 * Math.PI * clock) / (2 * TICK_HZ) + tile * 0.9);
  return s > 0.5 ? 1 : s < -0.5 ? 2 : 0;
}

/** The line's tiles strung from `x` over `w` px (whole tiles only), and the two posts at its ends, which stand down to the ground. */
export function cordelImages(x: number, y: number, w: number, clock: number, world: TileGrid, from: number = x, to: number = x + w): Placed[] {
  const { margin, lineTop, leftPost, rightPost } = CORDEL_SHEET;
  const images: Placed[] = [];
  for (let i = 0; i * TILE < w; i++) {
    const tx = x + i * TILE;
    if (tx < from - 1e-6 || tx + TILE > to + 1e-6) continue;
    images.push({ frame: (i % 2 === 0 ? 0 : 3) + swayOffset(i, clock), x: tx - margin, y: y - lineTop });
  }
  const pole = (px: number, frame: number, at: number) =>
    poleSteps(world, px, y - lineTop).map((py, k) => ({ frame: k === 0 ? frame : frame + 1, x: at, y: py }));
  images.push(...pole(x - 1, leftPost, x - TILE - margin), ...pole(x + w + 1, rightPost, x + w - margin));
  return images;
}

/**
 * GDD-WLD-11: a rollo's images: its line as a cordel over the strung part (whole tiles) with its posts, and its bundle: rolled up by its
 * post, swaying 1 px for half of every second; while it unrolls, flapping open at the front; none once it is strung to its full length.
 */
export function rolloImages(r: Rollo, s: RolloState, clock: number, world: TileGrid): { line: Placed[]; bundle: Placed | null } {
  const len = rolloLength(r, s);
  const left = r.post === 'left';
  const line = cordelImages(r.x, r.y, r.w, clock, world, left ? r.x : r.x + r.w - len, left ? r.x + len : r.x + r.w);
  if (len >= r.w) return { line, bundle: null };
  const base = left ? 0 : ROLLO_SHEET.right;
  const strungTiles = Math.floor(len / TILE);
  const tileX = left ? r.x + strungTiles * TILE : r.x + r.w - (strungTiles + 1) * TILE;
  const frame = s.steps === null ? base + (Math.floor(clock / (TICK_HZ / 2)) % 2) : base + ROLLO_SHEET.flap;
  return { line, bundle: { frame, x: tileX - ROLLO_SHEET.margin, y: r.y - ROLLO_SHEET.lineTop } };
}
