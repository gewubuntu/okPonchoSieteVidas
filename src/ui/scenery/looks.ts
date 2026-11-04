// GDD-ART-06: each world's look: which art a level is drawn with and the numbers that put its backdrop together. Pure, no Phaser and
// no image imports (those are in `files.ts`), so it is unit-tested. World 1 (and the tutorial, the test levels and any world not drawn
// yet) is the desert; World 2 the Mercado.
import { BACKDROP, BACKDROP_ART, MERCADO, PLANTS } from '../../config/tuning';

/** The art sets, by their folder under `assets/sprites/`. */
export type ArtSet = 'desierto' | 'mercado';

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
};

/** GDD-ART-06: the art a level of `world` is drawn with: the Mercado for World 2, the desert for every other world until it is drawn. */
export const artSetFor = (world: number): ArtSet => (world === 2 ? 'mercado' : 'desierto');

/** GDD-ART-06: the mid band's image: in World 2's boss arena the plaza with the kiosco, else the world's mid layer. */
export const midImage = (set: ArtSet, bossLevel: boolean): 'mid' | 'plaza' => (set === 'mercado' && bossLevel ? 'plaza' : 'mid');

/** The texture key of an image of a set: Phaser's texture cache is global, so each world's images have keys of their own. */
export const textureKey = (set: ArtSet, image: string): string => `${set}:${image}`;
