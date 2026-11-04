// GDD-WLD-10, GDD-WLD-11, GDD-ART-06: draws the awnings, cordeles and rollos from World 2's sheets each frame. Where and which frame
// is worked out in marketLayout.ts; this file only talks to Phaser. The posts are scenery behind Poncho; the canvas, the line and the
// bundle are what he touches.
import type Phaser from 'phaser';
import { ART_SCALE } from '../config/tuning';
import type { Level, RunState } from '../sim/run';
import { AWNING_SHEET, awningImages, awningSag, cordelImages, CORDEL_SHEET, rolloImages, ROLLO_SHEET, type Placed } from './marketLayout';
import awningPng from '../../assets/sprites/mercado/awning.png';
import cordelPng from '../../assets/sprites/mercado/cordel.png';
import rolloPng from '../../assets/sprites/mercado/rollo.png';

const KEYS = { awning: 'mercado-awning', cordel: 'mercado-cordel', rollo: 'mercado-rollo' } as const;
/** Depths: the posts behind the ground tiles and Poncho, the touchable cloth, line and bundle over the tiles (GDD-ART-05). */
const POST_DEPTH = 0.6;
const THING_DEPTH = 1.5;

/** Does the level have anything this draws? Only then are its sheets loaded (GDD-TEC-03). */
export const hasMarketThings = (level: Level): boolean => (level.awnings?.length ?? 0) + (level.cordeles?.length ?? 0) + (level.rollos?.length ?? 0) > 0;

/** Loads the three sheets, their frames in game px times ART_SCALE. */
export function loadMarketThings(scene: Phaser.Scene): void {
  scene.load.spritesheet(KEYS.awning, awningPng, { frameWidth: AWNING_SHEET.frame * ART_SCALE, frameHeight: AWNING_SHEET.frame * ART_SCALE });
  scene.load.spritesheet(KEYS.cordel, cordelPng, { frameWidth: CORDEL_SHEET.w * ART_SCALE, frameHeight: CORDEL_SHEET.h * ART_SCALE });
  scene.load.spritesheet(KEYS.rollo, rolloPng, { frameWidth: ROLLO_SHEET.frame * ART_SCALE, frameHeight: ROLLO_SHEET.frame * ART_SCALE });
}

/** What the last draw showed, for the playtests: each awning's sag and lift and whether it is drawn torn apart; each rollo's bundle frame (null when strung) and line tiles. */
export interface MarketDrawn {
  readonly awnings: { readonly sag: number; readonly lift: number; readonly gone: boolean }[];
  readonly rollos: { readonly bundle: number | null; readonly tiles: number }[];
}

export class MarketThings {
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private used = 0;
  drawn: MarketDrawn = { awnings: [], rollos: [] };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: Level,
  ) {}

  /** Draws everything for this run state, reusing the images from frame to frame. */
  draw(run: RunState): void {
    this.used = 0;
    const world = this.level.world;
    const awnings = (this.level.awnings ?? []).map((a, i) => {
      const sag = awningSag(run.awningBounce, i, run.clock);
      const gone = run.awningsGone[i] ?? false;
      const { posts, cloth } = awningImages(a, gone, sag, world);
      this.put(KEYS.awning, posts, POST_DEPTH);
      this.put(KEYS.awning, cloth, THING_DEPTH);
      return { ...sag, gone };
    });
    for (const c of this.level.cordeles ?? []) this.put(KEYS.cordel, cordelImages(c.x, c.y, c.w, run.clock, world), THING_DEPTH);
    const rollos = (this.level.rollos ?? []).map((r, i) => {
      const { line, bundle } = rolloImages(r, run.rollos[i]!, run.clock, world);
      this.put(KEYS.cordel, line, THING_DEPTH);
      if (bundle) this.put(KEYS.rollo, [bundle], THING_DEPTH);
      return { bundle: bundle?.frame ?? null, tiles: line.filter((p) => p.frame < CORDEL_SHEET.leftPost).length };
    });
    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
    this.drawn = { awnings, rollos };
  }

  private put(key: string, images: readonly Placed[], depth: number): void {
    for (const p of images) {
      let image = this.pool[this.used];
      if (!image) {
        image = this.scene.add.image(0, 0, key, p.frame).setOrigin(0).setScale(1 / ART_SCALE);
        this.pool.push(image);
      }
      image.setTexture(key, p.frame).setPosition(p.x, p.y).setDepth(depth).setVisible(true);
      this.used++;
    }
  }
}
