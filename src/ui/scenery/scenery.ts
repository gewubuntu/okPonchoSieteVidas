// GDD-ART-06: a world's scenery in the scene: the backdrop (sky, sun, clouds, far band and its foot, mid band), the decor on the top
// tiles and the ground tiles. The scene asks `sceneryFor` for its level's world and calls `preload`, `create` and, as the camera moves,
// `follow`; everything else about the look is data (`looks.ts`, `files.ts`).
import type Phaser from 'phaser';
import { ART_SCALE, BASE_HEIGHT, BASE_WIDTH, TILE } from '../../config/tuning';
import type { Level } from '../../sim/run';
import { parallaxOffset } from '../backdrop';
import { groundFrame } from '../groundTiles';
import { plantSpots } from '../plants';
import { FILES, type ArtFiles } from './files';
import { artSetFor, LOOKS, midImage, textureKey, type ArtSet, type Look } from './looks';

/** What the debug hooks read of the drawn scenery (`PonchoDebug.backdrop`, `backdropLayout`, `groundFrame`, `plants`, `scenery`). */
export interface Scenery {
  /** Loads the images of this world only, under keys of their own. */
  preload(load: Phaser.Loader.LoaderPlugin): void;
  /** Draws the backdrop, the decor and the ground tiles of `level`, under everything else in the level. */
  create(scene: Phaser.Scene, level: Level): void;
  /** Moves the far layers by their shares of the camera's scroll (game px). */
  follow(scrollX: number): void;
  /** How far the clouds, the far band and the mid band are shifted, in game px, read back from what was drawn. */
  backdrop(): { clouds: number; mountains: number; desert: number };
  /** Where the fixed parts are drawn, in game px: the sun's centre (null without a sun), the far band's top, its foot's top, the mid band's top. */
  backdropLayout(): { sunX: number | null; sunY: number | null; mountainsY: number; footY: number; desertY: number };
  /** The art set chosen and the texture key of the drawn mid band (`mercado:plaza` in World 2's arena). */
  drawn(): { set: ArtSet; midKey: string };
  /** The ground sheet's frame drawn at tile (tx, ty), or null where no ground image is. */
  groundFrame(tx: number, ty: number): number | null;
  /** The decor drawn: each item's kind (its frame), its foot (game px) and its depth. */
  plants(): { kind: number; x: number; y: number; depth: number }[];
}

/** GDD-ART-06: the scenery of a level of `world`; in a boss level (`bossLevel`) World 2's mid band is the plaza. */
export const sceneryFor = (world: number, bossLevel: boolean): Scenery => new BandScenery(artSetFor(world), bossLevel);

/**
 * A world's scenery drawn from its look, so that little of the screen is textured: the sky's bands as flat colours with the dither
 * strips and the sun (if any) over them as small images (the last band is the camera's background), a small image for each cloud, the
 * far band as one repeating layer and its foot as a flat colour, and the mid band in front of them. The sky is fixed to the screen; the
 * clouds, the far band and the mid band each move by their share of the camera's scroll, in `follow`. The decor is one image per spot of
 * `plantSpots`, rooted 1 game px into its top tile, behind the ground (depth 1) and in front of the backdrop; the ground one image of the
 * ground sheet per solid or slope tile (GDD-MOV-09).
 */
class BandScenery implements Scenery {
  private readonly set: ArtSet;
  private readonly look: Look;
  private readonly files: ArtFiles;
  private readonly mid: 'mid' | 'plaza';
  private cloudImages: Phaser.GameObjects.Image[][] = [];
  private sun: Phaser.GameObjects.Image | null = null;
  private far!: Phaser.GameObjects.TileSprite;
  private foot!: Phaser.GameObjects.Rectangle;
  private midBand!: Phaser.GameObjects.TileSprite;
  private decorImages: Phaser.GameObjects.Image[] = [];
  private readonly groundImages = new Map<string, Phaser.GameObjects.Image>();

  constructor(set: ArtSet, bossLevel: boolean) {
    this.set = set;
    this.look = LOOKS[set];
    this.files = FILES[set];
    this.mid = midImage(set, bossLevel);
  }

  private key(image: string): string {
    return textureKey(this.set, image);
  }

  preload(load: Phaser.Loader.LoaderPlugin): void {
    // The sky's dither strips, the sun, a picture of each cloud, the far band and the ground sheet, 28 frames of one tile (TILE * ART_SCALE)
    // each (GDD-MOV-09).
    load.spritesheet(this.key('sky-strips'), this.files.skyStrips, { frameWidth: BASE_WIDTH * ART_SCALE, frameHeight: this.look.stripArt });
    if (this.files.sun !== null) load.image(this.key('sun'), this.files.sun);
    this.files.clouds.forEach((png, i) => load.image(this.key(`cloud-${i}`), png));
    load.image(this.key('far'), this.files.far);
    load.spritesheet(this.key('ground'), this.files.ground, { frameWidth: TILE * ART_SCALE, frameHeight: TILE * ART_SCALE });
    // The mid band (the plaza in its place in World 2's arena) and the decor sheet, one frame per kind, each as large as the largest item.
    load.image(this.key(this.mid), this.mid === 'plaza' ? this.files.plaza! : this.files.mid);
    const { decor } = this.look;
    load.spritesheet(this.key('decor'), this.files.decor, { frameWidth: Math.max(...decor.map((p) => p.w)) * ART_SCALE, frameHeight: Math.max(...decor.map((p) => p.h)) * ART_SCALE });
  }

  create(scene: Phaser.Scene, level: Level): void {
    this.drawBackdrop(scene);
    this.drawDecor(scene, level);
    this.drawTiles(scene, level);
  }

  private drawBackdrop(scene: Phaser.Scene): void {
    const art = 1 / ART_SCALE;
    const { skyBands, skyEnds, stripArt, sun } = this.look;
    scene.cameras.main.setBackgroundColor(skyBands[skyBands.length - 1]);
    const bands = scene.add.graphics().setScrollFactor(0).setDepth(-4);
    let top = 0;
    skyEnds.forEach((end, i) => {
      // The band runs on to its end: the dither strip, drawn over its last rows, covers them.
      bands.fillStyle(skyBands[i]!, 1).fillRect(0, top * art, BASE_WIDTH, (end - top) * art);
      top = end;
      scene.add.image(0, (end - stripArt) * art, this.key('sky-strips'), i).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-3.5);
    });
    if (sun !== null) this.sun = scene.add.image(sun.x - sun.half, sun.y - sun.half, this.key('sun')).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-3);
    this.cloudImages = this.look.clouds.map(({ x, y }, i) =>
      [x, x - BASE_WIDTH].map((at) => scene.add.image(at, y, this.key(`cloud-${i}`)).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-2)),
    );
    const { farTop, farBandArt, footColour, midTop, midBandArt } = this.look;
    this.far = scene.add.tileSprite(0, farTop, BASE_WIDTH * ART_SCALE, farBandArt, this.key('far')).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-1);
    const foot = farTop + farBandArt * art;
    this.foot = scene.add.rectangle(0, foot, BASE_WIDTH, BASE_HEIGHT - foot, footColour).setOrigin(0).setScrollFactor(0).setDepth(-1);
    this.midBand = scene.add.tileSprite(0, midTop, BASE_WIDTH * ART_SCALE, midBandArt, this.key(this.mid)).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-0.5);
  }

  private drawDecor(scene: Phaser.Scene, level: Level): void {
    this.decorImages = plantSpots(level, this.look.decor).map(({ kind, col, row }) =>
      scene.add.image(col * TILE + TILE / 2, row * TILE + 1, this.key('decor'), kind).setOrigin(0.5, 1).setScale(1 / ART_SCALE).setDepth(0.5),
    );
  }

  private drawTiles(scene: Phaser.Scene, level: Level): void {
    const world = level.world;
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        const slope = world.slopeAt(tx, ty);
        if (!world.solidTile(tx, ty) && slope === null) continue;
        const image = scene.add.image(tx * TILE, ty * TILE, this.key('ground'), groundFrame((x, y) => world.solidTile(x, y), tx, ty, (x, y) => world.slopeAt(x, y))).setOrigin(0).setScale(1 / ART_SCALE).setDepth(1);
        this.groundImages.set(`${tx},${ty}`, image);
      }
    }
  }

  follow(scrollX: number): void {
    const cloudShift = parallaxOffset(scrollX, this.look.cloudFactor);
    this.look.clouds.forEach(({ x }, i) => {
      const at = (((x - cloudShift) % BASE_WIDTH) + BASE_WIDTH) % BASE_WIDTH;
      this.cloudImages[i]![0]!.x = at;
      this.cloudImages[i]![1]!.x = at - BASE_WIDTH;
    });
    this.far.tilePositionX = parallaxOffset(scrollX, this.look.farFactor) * ART_SCALE;
    this.midBand.tilePositionX = parallaxOffset(scrollX, this.look.midFactor) * ART_SCALE;
  }

  backdrop(): { clouds: number; mountains: number; desert: number } {
    const first = this.look.clouds[0]!.x;
    return { clouds: (((first - this.cloudImages[0]![0]!.x) % BASE_WIDTH) + BASE_WIDTH) % BASE_WIDTH, mountains: this.far.tilePositionX / ART_SCALE, desert: this.midBand.tilePositionX / ART_SCALE };
  }

  backdropLayout(): { sunX: number | null; sunY: number | null; mountainsY: number; footY: number; desertY: number } {
    const half = this.look.sun?.half ?? 0;
    return { sunX: this.sun === null ? null : this.sun.x + half, sunY: this.sun === null ? null : this.sun.y + half, mountainsY: this.far.y, footY: this.foot.y, desertY: this.midBand.y };
  }

  drawn(): { set: ArtSet; midKey: string } {
    return { set: this.set, midKey: this.midBand.texture.key };
  }

  groundFrame(tx: number, ty: number): number | null {
    const image = this.groundImages.get(`${tx},${ty}`);
    return image === undefined ? null : Number(image.frame.name);
  }

  plants(): { kind: number; x: number; y: number; depth: number }[] {
    return this.decorImages.map((image) => ({ kind: Number(image.frame.name), x: image.x, y: image.y, depth: image.depth }));
  }
}
