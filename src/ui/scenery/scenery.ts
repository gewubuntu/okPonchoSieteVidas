// GDD-ART-06: a world's scenery in the scene: the backdrop (sky, sun, clouds, far band and its foot, mid band), the decor on the top
// tiles and the ground tiles. The scene asks `sceneryFor` for its level's world and calls `preload`, `create` and, as the camera moves,
// `follow`; everything else about the look is data (`looks.ts`, `files.ts`).
import type Phaser from 'phaser';
import { ART_SCALE, BASE_HEIGHT, BASE_WIDTH, DECOR_FRAME, TILE } from '../../config/tuning';
import type { Level } from '../../sim/run';
import { parallaxOffset } from '../backdrop';
import { groundFrameFor } from '../groundTiles';
import { plantSpots } from '../plants';
import { BACK_WALL_DEPTH, backWallTiles } from './backWall';
import { artFiles, type ArtFiles } from './files';
import { artSetFor, imageKey, lookFor, midImage, placeFor, riseShift, textureKey, type ArtSet, type BackdropLayer, type Look, type Place } from './looks';
import { decorInView, tileInView, tilesInView, type TileView } from './view';

/** What the debug hooks read of the drawn scenery (`PonchoDebug.backdrop`, `backdropLayout`, `groundFrame`, `plants`, `scenery`). */
export interface Scenery {
  /** Loads the images of this world (in World 3, of this place) only, under keys of their own. */
  preload(load: Phaser.Loader.LoaderPlugin): void;
  /**
   * Draws the backdrop, the decor and the ground tiles of `level`, under everything else in the level, and its rock back walls (GDD-WLD-17,
   * `assets/sprites/sierra/backwall.png`, loaded by the scene as `sierra:backwall` when the level has any) between the backdrop and the
   * level.
   */
  create(scene: Phaser.Scene, level: Level): void;
  /**
   * Moves the far layers by their shares of the camera's scroll (game px); draws the far strip, its foot and the mid strip their shares of
   * the camera's rise above its lowest y lower (`cameraY` and `lowestY`, GDD-UI-04, GDD-ART-06: 0 in a one-screen level); and draws the
   * whole backdrop `offsetY` game px lower (negative: higher), the offset the camera draws the world at, so that a screen shake moves the
   * backdrop with the level (GDD-BOS-01). Shows only the ground, back wall and decor images in the view at the scroll (`scrollX`, `scrollY`, the y
   * scroll the camera draws at, shake included; GDD-TEC-03).
   */
  follow(scrollX: number, scrollY: number, cameraY: number, lowestY: number, offsetY: number): void;
  /** How far each object of the backdrop is drawn from where it rests, in game px: its share of the camera's rise plus `follow`'s `offsetY`. */
  backdropShifts(): number[];
  /** How far the clouds, the far band and the mid band are shifted, in game px, read back from what was drawn; the clouds 0 where there are none (the mine). */
  backdrop(): { clouds: number; mountains: number; desert: number };
  /**
   * Where the fixed parts are drawn, in game px, without the shake: the sun's centre (null without a sun), the far band's top, its foot's top,
   * the mid band's top (each with its share of the camera's rise in a tall level).
   */
  backdropLayout(): { sunX: number | null; sunY: number | null; mountainsY: number; footY: number; desertY: number };
  /**
   * The art set chosen, the texture key of the drawn mid band (`mercado:plaza` in World 2's arena, `sierra:mid-mina` in the mine) and, in
   * World 3 only, the level's place (`barranca` or `mina`).
   */
  drawn(): { set: ArtSet; midKey: string; place?: Place };
  /** The ground sheet's frame drawn at tile (tx, ty), or null where no ground image is, whether the image is shown or not. */
  groundFrame(tx: number, ty: number): number | null;
  /** How many ground images are shown (in the view, GDD-TEC-03) and how many there are. */
  groundShown(): { shown: number; total: number };
  /** How many back wall images are shown (in the view, GDD-TEC-03), how many there are, and their depth (null with none). */
  backWall(): { shown: number; total: number; depth: number | null };
  /** The back wall's frame (its version) drawn at tile (tx, ty), or null where no back wall image is, whether the image is shown or not. */
  backWallFrame(tx: number, ty: number): number | null;
  /** The decor drawn: each item's kind (its frame), its foot (game px) and its depth. */
  plants(): { kind: number; x: number; y: number; depth: number }[];
}

/**
 * GDD-ART-06: the scenery of a level of `world`; in a boss level (`bossLevel`) World 2's mid band is the plaza; in World 3 the level's
 * `place` (the canyon when it names none) chooses the backdrop, the ground sheet and the decor sheet.
 */
export const sceneryFor = (world: number, bossLevel: boolean, place?: Place): Scenery => new BandScenery(artSetFor(world), placeFor(world, place), bossLevel);

/**
 * A world's scenery drawn from its look, so that little of the screen is textured: the sky's bands as flat colours with the dither
 * strips and the sun (if any) over them as small images (the last band is the camera's background), a small image for each cloud, the
 * far band as one repeating layer and its foot as a flat colour, and the mid band in front of them. The sky is fixed to the screen; the
 * clouds, the far band and the mid band each move by their share of the camera's scroll, and in a tall level the far band, its foot and
 * the mid band sink by their shares of the camera's rise, in `follow`. The decor is one image per spot of
 * `plantSpots`, rooted 1 game px into its top tile, behind the ground (depth 1) and in front of the backdrop; the ground one image of the
 * ground sheet per solid or slope tile (GDD-MOV-09). Only the ground, back wall and decor images in the camera's view are shown (GDD-TEC-03): each
 * frame the view moves, the images it leaves are hidden and those it reaches shown, and no other image is touched.
 */
class BandScenery implements Scenery {
  private readonly set: ArtSet;
  private readonly place: Place | null;
  private readonly look: Look;
  private readonly files: ArtFiles;
  private readonly mid: 'mid' | 'plaza';
  private cloudImages: Phaser.GameObjects.Image[][] = [];
  private sun: Phaser.GameObjects.Image | null = null;
  private far!: Phaser.GameObjects.TileSprite;
  private foot!: Phaser.GameObjects.Rectangle;
  private midBand!: Phaser.GameObjects.TileSprite;
  /** Every object of the backdrop, its layer and the y it rests at, which `follow` shifts by the layer's share of the camera's rise and the screen shake's offset. */
  private readonly layers: { readonly object: Phaser.GameObjects.Components.Transform; readonly layer: BackdropLayer; readonly rest: number }[] = [];
  private offsetY = 0;
  private decorImages: Phaser.GameObjects.Image[] = [];
  /** Each decor image's column, foot and height, for the view (GDD-TEC-03). */
  private decorPlaces: { col: number; footY: number; height: number }[] = [];
  /** The ground images by tile, `ty * columns + tx`, null where none is. */
  private groundImages: (Phaser.GameObjects.Image | null)[] = [];
  /** The back wall images by tile, as the ground's (GDD-WLD-17). */
  private backWallImages: (Phaser.GameObjects.Image | null)[] = [];
  private columns = 0;
  private rows = 0;
  /** The view whose images are shown, null before the first `follow`. */
  private view: TileView | null = null;

  constructor(set: ArtSet, place: Place | null, bossLevel: boolean) {
    this.set = set;
    this.place = place;
    this.look = lookFor(set, place);
    this.files = artFiles(set, place);
    this.mid = midImage(set, bossLevel);
  }

  private key(image: string): string {
    return imageKey(this.set, this.place, image);
  }

  preload(load: Phaser.Loader.LoaderPlugin): void {
    // The sky's dither strips, the sun, a picture of each cloud, the far band and the ground sheet, 28 frames of one tile (TILE * ART_SCALE)
    // each (GDD-MOV-09), the mine's 35 (`groundFrameFor`).
    load.spritesheet(this.key('sky-strips'), this.files.skyStrips, { frameWidth: BASE_WIDTH * ART_SCALE, frameHeight: this.look.stripArt });
    if (this.files.sun !== null) load.image(this.key('sun'), this.files.sun);
    this.files.clouds.forEach((png, i) => load.image(this.key(`cloud-${i}`), png));
    load.image(this.key('far'), this.files.far);
    load.spritesheet(this.key('ground'), this.files.ground, { frameWidth: TILE * ART_SCALE, frameHeight: TILE * ART_SCALE });
    // The mid band (the plaza in its place in World 2's arena) and the decor sheet, one frame per kind, each World 1's plants' frame.
    load.image(this.key(this.mid), this.mid === 'plaza' ? this.files.plaza! : this.files.mid);
    load.spritesheet(this.key('decor'), this.files.decor, { frameWidth: DECOR_FRAME.w * ART_SCALE, frameHeight: DECOR_FRAME.h * ART_SCALE });
  }

  create(scene: Phaser.Scene, level: Level): void {
    this.drawBackdrop(scene);
    this.drawDecor(scene, level);
    this.drawTiles(scene, level);
    this.drawBackWalls(scene, level);
  }

  private drawBackdrop(scene: Phaser.Scene): void {
    const art = 1 / ART_SCALE;
    const { skyBands, skyEnds, stripArt, sun } = this.look;
    scene.cameras.main.setBackgroundColor(skyBands[skyBands.length - 1]);
    const bands = scene.add.graphics().setScrollFactor(0).setDepth(-4);
    this.layers.push({ object: bands, layer: 'sky', rest: 0 });
    let top = 0;
    skyEnds.forEach((end, i) => {
      // The band runs on to its end: the dither strip, drawn over its last rows, covers them.
      bands.fillStyle(skyBands[i]!, 1).fillRect(0, top * art, BASE_WIDTH, (end - top) * art);
      top = end;
      const strip = scene.add.image(0, (end - stripArt) * art, this.key('sky-strips'), i).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-3.5);
      this.layers.push({ object: strip, layer: 'sky', rest: strip.y });
    });
    if (sun !== null) {
      this.sun = scene.add.image(sun.x - sun.half, sun.y - sun.half, this.key('sun')).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-3);
      this.layers.push({ object: this.sun, layer: 'sun', rest: this.sun.y });
    }
    this.cloudImages = this.look.clouds.map(({ x, y }, i) =>
      [x, x - BASE_WIDTH].map((at) => scene.add.image(at, y, this.key(`cloud-${i}`)).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-2)),
    );
    this.look.clouds.forEach(({ y }, i) => this.cloudImages[i]!.forEach((image) => this.layers.push({ object: image, layer: 'clouds', rest: y })));
    const { farTop, farBandArt, footColour, midTop, midBandArt } = this.look;
    this.far = scene.add.tileSprite(0, farTop, BASE_WIDTH * ART_SCALE, farBandArt, this.key('far')).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-1);
    const foot = farTop + farBandArt * art;
    this.foot = scene.add.rectangle(0, foot, BASE_WIDTH, BASE_HEIGHT - foot, footColour).setOrigin(0).setScrollFactor(0).setDepth(-1);
    this.midBand = scene.add.tileSprite(0, midTop, BASE_WIDTH * ART_SCALE, midBandArt, this.key(this.mid)).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-0.5);
    this.layers.push({ object: this.far, layer: 'far', rest: farTop }, { object: this.foot, layer: 'foot', rest: foot }, { object: this.midBand, layer: 'mid', rest: midTop });
  }

  private drawDecor(scene: Phaser.Scene, level: Level): void {
    const spots = plantSpots(level, this.look.decor);
    // Hidden until the first `follow` shows those in the view (GDD-TEC-03).
    this.decorImages = spots.map(({ kind, col, row }) =>
      scene.add.image(col * TILE + TILE / 2, row * TILE + 1, this.key('decor'), kind).setOrigin(0.5, 1).setScale(1 / ART_SCALE).setDepth(0.5).setVisible(false),
    );
    this.decorPlaces = spots.map(({ kind, col, row }) => ({ col, footY: row * TILE + 1, height: this.look.decor[kind]!.h }));
  }

  private drawTiles(scene: Phaser.Scene, level: Level): void {
    const world = level.world;
    this.columns = world.width;
    this.rows = world.height;
    this.groundImages = Array.from({ length: world.width * world.height }, () => null);
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        const slope = world.slopeAt(tx, ty);
        if (!world.solidTile(tx, ty) && slope === null) continue;
        // Hidden until the first `follow` shows those in the view (GDD-TEC-03).
        const image = scene.add.image(tx * TILE, ty * TILE, this.key('ground'), groundFrameFor(this.place, world, tx, ty)).setOrigin(0).setScale(1 / ART_SCALE).setDepth(1).setVisible(false);
        this.groundImages[ty * world.width + tx] = image;
      }
    }
  }

  /**
   * GDD-WLD-17: the rock back wall, one image per tile of `backWallTiles` in its version, moving with the level, in front of the backdrop
   * and behind everything in the level (`BACK_WALL_DEPTH`).
   */
  private drawBackWalls(scene: Phaser.Scene, level: Level): void {
    this.backWallImages = Array.from({ length: this.columns * this.rows }, () => null);
    for (const { tx, ty, frame } of backWallTiles(level)) {
      // Hidden until the first `follow` shows those in the view (GDD-TEC-03).
      this.backWallImages[ty * this.columns + tx] = scene.add.image(tx * TILE, ty * TILE, textureKey('sierra', 'backwall'), frame).setOrigin(0).setScale(1 / ART_SCALE).setDepth(BACK_WALL_DEPTH).setVisible(false);
    }
  }

  /** The ground image at tile (tx, ty), or null outside the level and where none is. */
  private groundAt(tx: number, ty: number): Phaser.GameObjects.Image | null {
    if (tx < 0 || ty < 0 || tx >= this.columns || ty >= this.rows) return null;
    return this.groundImages[ty * this.columns + tx]!;
  }

  /**
   * GDD-TEC-03: shows the ground, back wall and decor images in the view at the scroll and hides those that left it. Only when the view's tiles change,
   * and then only the images whose visibility changes: the tiles of the old view not in the new are hidden, those of the new not in the old
   * shown.
   */
  private showView(scrollX: number, scrollY: number): void {
    const next = tilesInView(scrollX, scrollY);
    const last = this.view;
    if (last !== null && last.col0 === next.col0 && last.col1 === next.col1 && last.row0 === next.row0 && last.row1 === next.row1) return;
    if (last !== null) this.setTiles(last, next, false);
    this.setTiles(next, last, true);
    this.view = next;
    this.decorImages.forEach((image, i) => {
      const { col, footY, height } = this.decorPlaces[i]!;
      const shown = decorInView(next, col, footY, height);
      if (image.visible !== shown) image.setVisible(shown);
    });
  }

  /** Sets the ground and back wall images of the tiles in `view` but not in `except` to `shown`. */
  private setTiles(view: TileView, except: TileView | null, shown: boolean): void {
    for (let ty = Math.max(0, view.row0); ty <= Math.min(this.rows - 1, view.row1); ty++) {
      for (let tx = Math.max(0, view.col0); tx <= Math.min(this.columns - 1, view.col1); tx++) {
        if (except !== null && tileInView(except, tx, ty)) continue;
        for (const image of [this.groundAt(tx, ty), this.backWallImages[ty * this.columns + tx] ?? null]) if (image !== null && image.visible !== shown) image.setVisible(shown);
      }
    }
  }

  follow(scrollX: number, scrollY: number, cameraY: number, lowestY: number, offsetY: number): void {
    this.showView(scrollX, scrollY);
    this.offsetY = offsetY;
    for (const { object, layer, rest } of this.layers) object.y = rest + riseShift(layer, cameraY, lowestY) + offsetY;
    const cloudShift = parallaxOffset(scrollX, this.look.cloudFactor);
    this.look.clouds.forEach(({ x }, i) => {
      const at = (((x - cloudShift) % BASE_WIDTH) + BASE_WIDTH) % BASE_WIDTH;
      this.cloudImages[i]![0]!.x = at;
      this.cloudImages[i]![1]!.x = at - BASE_WIDTH;
    });
    this.far.tilePositionX = parallaxOffset(scrollX, this.look.farFactor) * ART_SCALE;
    this.midBand.tilePositionX = parallaxOffset(scrollX, this.look.midFactor) * ART_SCALE;
  }

  backdropShifts(): number[] {
    return this.layers.map(({ object, rest }) => object.y - rest);
  }

  backdrop(): { clouds: number; mountains: number; desert: number } {
    const first = this.look.clouds[0]?.x;
    const clouds = first === undefined ? 0 : (((first - this.cloudImages[0]![0]!.x) % BASE_WIDTH) + BASE_WIDTH) % BASE_WIDTH;
    return { clouds, mountains: this.far.tilePositionX / ART_SCALE, desert: this.midBand.tilePositionX / ART_SCALE };
  }

  backdropLayout(): { sunX: number | null; sunY: number | null; mountainsY: number; footY: number; desertY: number } {
    const half = this.look.sun?.half ?? 0;
    return { sunX: this.sun === null ? null : this.sun.x + half, sunY: this.sun === null ? null : this.sun.y - this.offsetY + half, mountainsY: this.far.y - this.offsetY, footY: this.foot.y - this.offsetY, desertY: this.midBand.y - this.offsetY };
  }

  drawn(): { set: ArtSet; midKey: string; place?: Place } {
    return { set: this.set, midKey: this.midBand.texture.key, ...(this.place === null ? {} : { place: this.place }) };
  }

  groundFrame(tx: number, ty: number): number | null {
    const image = this.groundAt(tx, ty);
    return image === null ? null : Number(image.frame.name);
  }

  groundShown(): { shown: number; total: number } {
    const images = this.groundImages.filter((image) => image !== null);
    return { shown: images.filter((image) => image.visible).length, total: images.length };
  }

  backWall(): { shown: number; total: number; depth: number | null } {
    const images = this.backWallImages.filter((image) => image !== null);
    return { shown: images.filter((image) => image.visible).length, total: images.length, depth: images[0]?.depth ?? null };
  }

  backWallFrame(tx: number, ty: number): number | null {
    if (tx < 0 || ty < 0 || tx >= this.columns || ty >= this.rows) return null;
    const image = this.backWallImages[ty * this.columns + tx]!;
    return image === null ? null : Number(image.frame.name);
  }

  plants(): { kind: number; x: number; y: number; depth: number }[] {
    return this.decorImages.map((image) => ({ kind: Number(image.frame.name), x: image.x, y: image.y, depth: image.depth }));
  }
}
