// GDD-ART-06: each world's look: which art a level is drawn with and the numbers that put its backdrop together. Pure, no Phaser and
// no image imports (those are in `files.ts`), so it is unit-tested. World 1 (and the tutorial, the World 1 test levels and any world not
// drawn yet) is the desert; World 2 the Mercado; World 3 the Sierra (its canyon).
import { ART_SCALE, BACKDROP, BACKDROP_ART, BACKDROP_RISE, MERCADO, PLANTS, SIERRA } from '../../config/tuning';

/** The art sets, by their folder under `assets/sprites/`. */
export type ArtSet = 'desierto' | 'mercado' | 'sierra';

/** A world's backdrop and decor, in the units of `BACKDROP` and `BACKDROP_ART` (game px, art px where the name says so). */
export interface Look {
  /** The clouds', the far layer's and the mid layer's shares of the camera's scroll. */
  readonly cloudFactor: number;
  readonly farFactor: number;
  readonly midFactor: number;
  /** The sky's flat bands, top down, the last the camera's background; each but the last ends `skyEnds` art px from the top under a dither strip `stripArt` px tall. */
  readonly skyBands: readonly number[];
  readonly skyEnds: readonly number[];
  readonly stripArt: number;
  /** The sun's centre (game px) and how far its image reaches from it, or null for no sun. */
  readonly sun: { readonly x: number; readonly y: number; readonly half: number } | null;
  /** Each cloud image's top left in the cloud layer, game px. */
  readonly clouds: readonly { readonly x: number; readonly y: number }[];
  /** The far band's top (game px) and height (art px), the flat foot's colour below it, the mid band's top and height. */
  readonly farTop: number;
  readonly farBandArt: number;
  readonly footColour: number;
  readonly midTop: number;
  readonly midBandArt: number;
  /** The decor's sizes by kind (World 1's plants), game px. */
  readonly decor: readonly { readonly w: number; readonly h: number }[];
}

export const LOOKS: Readonly<Record<ArtSet, Look>> = {
  desierto: {
    cloudFactor: BACKDROP.cloudFactor,
    farFactor: BACKDROP.mountainFactor,
    midFactor: BACKDROP.desertFactor,
    skyBands: BACKDROP_ART.skyBands,
    skyEnds: BACKDROP_ART.skyEnds,
    stripArt: BACKDROP_ART.stripArt,
    sun: { x: BACKDROP.sunX, y: BACKDROP.sunY, half: BACKDROP_ART.sunHalf },
    clouds: BACKDROP_ART.clouds,
    farTop: BACKDROP.mountainTop,
    farBandArt: BACKDROP_ART.mountainBandArt,
    footColour: BACKDROP_ART.footColour,
    midTop: BACKDROP.desertTop,
    midBandArt: BACKDROP_ART.desertBandArt,
    decor: PLANTS,
  },
  mercado: {
    cloudFactor: MERCADO.cloudFactor,
    farFactor: MERCADO.farFactor,
    midFactor: MERCADO.midFactor,
    skyBands: MERCADO.skyBands,
    skyEnds: MERCADO.skyEnds,
    stripArt: MERCADO.stripArt,
    sun: null,
    clouds: MERCADO.clouds,
    farTop: MERCADO.farTop,
    farBandArt: MERCADO.farBandArt,
    footColour: MERCADO.footColour,
    midTop: MERCADO.midTop,
    midBandArt: MERCADO.midBandArt,
    decor: MERCADO.decor,
  },
  sierra: {
    cloudFactor: SIERRA.cloudFactor,
    farFactor: SIERRA.farFactor,
    midFactor: SIERRA.midFactor,
    skyBands: SIERRA.skyBands,
    skyEnds: SIERRA.skyEnds,
    stripArt: SIERRA.stripArt,
    sun: null,
    clouds: SIERRA.clouds,
    farTop: SIERRA.farTop,
    farBandArt: SIERRA.farBandArt,
    footColour: SIERRA.footColour,
    midTop: SIERRA.midTop,
    midBandArt: SIERRA.midBandArt,
    decor: SIERRA.decor,
  },
};

/**
 * GDD-ART-06: the art a level of `world` is drawn with: the Mercado for World 2, the Sierra for World 3, the desert for every other world
 * until it is drawn.
 */
export const artSetFor = (world: number): ArtSet => (world === 2 ? 'mercado' : world === 3 ? 'sierra' : 'desierto');

/** GDD-ART-06: the mid band's image: in World 2's boss arena the plaza with the kiosco, else the world's mid layer. */
export const midImage = (set: ArtSet, bossLevel: boolean): 'mid' | 'plaza' => (set === 'mercado' && bossLevel ? 'plaza' : 'mid');

/** The texture key of an image of a set: Phaser's texture cache is global, so each world's images have keys of their own. */
export const textureKey = (set: ArtSet, image: string): string => `${set}:${image}`;

/** GDD-ART-06: the backdrop's layers, as they move up and down: the sky's bands and strips, the sun, the clouds, the far strip, its foot and the mid strip. */
export type BackdropLayer = 'sky' | 'sun' | 'clouds' | 'far' | 'foot' | 'mid';

/** GDD-ART-06: each layer's share of the camera's rise above its lowest (GDD-UI-04), drawn that much lower; the sky, the sun and the clouds are fixed. */
export const VERTICAL_FACTOR: Readonly<Record<BackdropLayer, number>> = { sky: 0, sun: 0, clouds: 0, far: BACKDROP_RISE.far, foot: BACKDROP_RISE.far, mid: BACKDROP_RISE.mid };

/**
 * GDD-ART-06: how far `layer` is drawn below where it rests (game px), with the camera's y at `cameraY` and its lowest at `lowestY`, at
 * whole art pixels: 0 at the camera's lowest, so a one-screen level (lowest 0) never shifts, and only ever down above it.
 */
export const riseShift = (layer: BackdropLayer, cameraY: number, lowestY: number): number => Math.round(VERTICAL_FACTOR[layer] * (lowestY - cameraY) * ART_SCALE) / ART_SCALE;
