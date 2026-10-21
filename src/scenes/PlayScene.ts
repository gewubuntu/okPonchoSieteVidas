// Placeholder scene: proves the loop (input, fixed-step simulation, tile collision, pits, rendering) on the sandbox level.
// Final art arrives with GDD-ART-01 and GDD-ART-02, Tiled levels with GDD-TEC-04.
import Phaser from 'phaser';
import { BASE_WIDTH, HITBOX, OFRENDA, SPIKE, TILE } from '../config/tuning';
import { SANDBOX_OFRENDAS, SANDBOX_ROWS, SANDBOX_SPAWN, SANDBOX_SPIKES, SANDBOX_CRUMBLES, SANDBOX_PLATFORMS, SANDBOX_SPRINGS, SANDBOX_TACOS, SANDBOX_PINATAS, SANDBOX_DOORS, SANDBOX_KEYS } from '../levels/sandbox';
import { FixedStepper } from '../sim/fixedStep';
import ofrendaOgg from '../../assets/audio/sfx/ofrenda.ogg';
import ofrendaMp3 from '../../assets/audio/sfx/ofrenda.mp3';
import { activateOfrenda, collectVeladora, loseLife } from '../sim/lives';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { flipPose } from '../sim/respawnFlip';
import { platformAt } from '../sim/platform';
import { respawnPoint, startRun, stepRun, type Level, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { Power } from '../sim/taco';
import { crackFrame, crackLine, updateCracks, type Crack } from '../ui/lifeCrack';
import { layoutLives, LIVES_HUD } from '../ui/livesLayout';
import { TouchControls, type TouchDebug } from '../ui/TouchControls';

// GDD-MOV-06: Poncho collides with the tile grid. The spawn stands on the floor, so its y is the floor level.
const world = parseTiles(SANDBOX_ROWS);
const level: Level = { world, spawn: SANDBOX_SPAWN, ofrendas: SANDBOX_OFRENDAS, spikes: SANDBOX_SPIKES, crumbles: SANDBOX_CRUMBLES, springs: SANDBOX_SPRINGS, platforms: SANDBOX_PLATFORMS, tacos: SANDBOX_TACOS, pinatas: SANDBOX_PINATAS, doors: SANDBOX_DOORS, keys: SANDBOX_KEYS };
const FLOOR_Y = SANDBOX_SPAWN.y;
/** How many ofrendas an `usedKey` string marks as used. */
const countUsed = (key: string) => key.split('1').length - 1;
const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);
/** Steps per half of the invulnerability blink (0.1 s). */
const BLINK_STEPS = 6;
/** Height of the pale strip along Poncho's feet on the placeholder body, in px. */
const FEET_HEIGHT = 3;

/** Dev-only hook for the `harness-playtest` skill. Exposed only by the Vite dev server (see PlayScene.create). */
export interface PonchoDebug {
  state(): PlayerState;
  ticks(): number;
  /** Highest point above the floor reached in the most recent completed jump, in px. */
  peakRise(): number;
  /** Lives left according to the game state. */
  lives(): number;
  /** Triangles currently drawn filled on the HUD. Read from what was drawn, not from the game state. */
  hudFilled(): number;
  /** Test hooks: stand in for hazards and checkpoints until they exist (GDD-LIFE-02, GDD-LIFE-03). */
  loseLife(): void;
  activateOfrenda(id: string): void;
  /** Puts Poncho at (x, y), feet position, at rest and in the air. */
  teleport(x: number, y: number): void;
  /** 'playing', or 'respawning' while waiting after a lost life (GDD-LIFE-02). */
  phase(): RunState['phase'];
  /** Steps of invulnerability left after a respawn (GDD-LIFE-02). */
  invulnerable(): number;
  /** Whether Poncho's body is drawn, and how opaque (hidden while waiting to respawn, dim half of the blink). */
  bodyVisible(): boolean;
  bodyAlpha(): number;
  /** Where the body is drawn: feet position, and turn in radians (GDD-LIFE-02 respawn flip). */
  bodyPose(): { x: number; y: number; rotation: number };
  /** Each ofrenda as drawn: its id and whether it is drawn as used. Read from what was drawn, not from the game state. */
  ofrendas(): { id: string; x: number; used: boolean }[];
  /** Every sound effect asked for so far, in order (GDD-AUD-02). Browsers keep audio locked until a first gesture. */
  sfx(): string[];
  /** Whether the ofrenda sound file was loaded and decoded into the audio cache. */
  sfxLoaded(): boolean;
  /** Triangles the HUD was asked to draw as cracking (GDD-LIFE-02): the place in the row and the fill and crack alpha. The pixels themselves are checked by reading the screenshot. */
  hudCracking(): { index: number; fillAlpha: number; crackAlpha: number }[];
  /** Freezes the simulation and the animations on the current frame, for screenshots and pixel tests. */
  pause(on: boolean): void;
  /** While paused, runs exactly `n` simulation steps, with no input unless given, so a frame can be reached without timing luck. */
  step(n: number, input?: PlayerInput): void;
  /** The touch buttons: whether shown (touch devices only), where they are, and which are drawn pressed (GDD-CTL-03). */
  touch(): TouchDebug;
  /** Where each moving platform is: the left end of its top surface and its width (GDD-WLD-05). */
  platforms(): { x: number; y: number; w: number }[];
  /** The crumbling tiles and their state, read from the run (GDD-WLD-05). */
  crumbles(): { col: number; row: number; phase: string; steps: number }[];
  /** Where Poncho would respawn now (GDD-LIFE-02). */
  checkpoint(): { x: number; y: number };
  /** The power-up state (GDD-PWR-01), and the taco pickups the scene painted in the level (GDD-PWR-02). */
  power(): Power;
  tacosDrawn(): number;
  /** Whether the taco in Poncho's hand and the power-up icon on the HUD are drawn. Read from what was drawn. */
  heldTacoVisible(): boolean;
  /** Each piñata as drawn: whether it is drawn open (GDD-PWR-05). And the walking tacos as drawn: where their feet are (GDD-PWR-02). */
  pinatasDrawn(): boolean[];
  itemsDrawn(): { x: number; y: number }[];
  /** Keys Poncho carries, the keys still drawn on the floor, the doors drawn open, and the key icons on the HUD (GDD-WLD-05). Read from what was drawn. */
  keysHeld(): number;
  keysDrawn(): number;
  doorsDrawn(): boolean[];
  hudKeys(): number;
  hudPowerIcon(): boolean;
}

declare global {
  interface Window {
    __PONCHO__?: PonchoDebug;
  }
}

export class PlayScene extends Phaser.Scene {
  private readonly stepper = new FixedStepper();
  private run: RunState = startRun(level);
  private prevPlayer: PlayerState = this.run.player;
  private ticks = 0;
  private peak = 0;
  private lastPeak = 0;
  private hud!: Phaser.GameObjects.Graphics;
  private hudFilled = 0;
  private platformGfx!: Phaser.GameObjects.Graphics;
  private crumbleGfx!: Phaser.GameObjects.Graphics;
  private crumblesKey = '';
  private tacoGfx!: Phaser.GameObjects.Graphics;
  private heldGfx!: Phaser.GameObjects.Graphics;
  private tacosKey = '';
  private tacosPainted = 0;
  private pinatasPainted: boolean[] = [];
  private doorsPaintedShut: boolean[] = [];
  private keysPainted = 0;
  private pinataGfx!: Phaser.GameObjects.Graphics;
  private itemGfx!: Phaser.GameObjects.Graphics;
  private pinatasKey = '';
  private doorGfx!: Phaser.GameObjects.Graphics;
  private keyGfx!: Phaser.GameObjects.Graphics;
  private doorsKey = '';
  private hudKeyCount = 0;
  private itemsDrawn: { x: number; y: number }[] = [];
  private hudPower: Power = 'base';
  private ofrendaGfx!: Phaser.GameObjects.Graphics;
  private ofrendasDrawn: { id: string; x: number; used: boolean }[] = [];
  private drawnLives = 0;
  private cracks: Crack[] = [];
  private cracksDrawn: { index: number; fillAlpha: number; crackAlpha: number }[] = [];
  private paused = false;
  /** Which ofrendas the drawing shows as used, as a key, so a change of the set itself (not only its size) redraws. */
  private ofrendasKey = '';
  private sfxLog: string[] = [];
  private devOfrendas = 0;
  private devVeladoras = 0;
  private devKeys?: Record<'lose' | 'ofrenda' | 'veladora', Phaser.Input.Keyboard.Key>;
  /** Placeholder body: a red box with a pale strip along the feet, so a flip shows which way up he is. */
  private body!: Phaser.GameObjects.Container;
  private touch!: TouchControls;
  private keys!: Record<'left' | 'right' | 'jump', Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('play');
  }

  preload(): void {
    // GDD-AUD-02: Ogg where it plays, MP3 elsewhere. Phaser picks the first format the browser supports.
    this.load.audio('sfx-ofrenda', [ofrendaOgg, ofrendaMp3]);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b2036');
    this.drawTiles();
    this.add
      .text(BASE_WIDTH / 2, 28, 'PONCHO: Siete Vidas', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3dc' })
      .setOrigin(0.5);
    this.add
      .text(BASE_WIDTH / 2, 48, 'placeholder: arrows or A/D to run, space to jump', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#9ba3c4',
      })
      .setOrigin(0.5);

    // GDD-UI-01: seven life triangles, top-left, above the camera so they stay put.
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawHud();

    this.ofrendaGfx = this.add.graphics().setDepth(2);
    this.drawOfrendas();
    this.drawSpikes();
    this.drawSprings();
    this.tacoGfx = this.add.graphics().setDepth(2);
    this.drawTacos();
    this.heldGfx = this.add.graphics().setDepth(4);
    this.pinataGfx = this.add.graphics().setDepth(1);
    this.drawPinatas();
    this.itemGfx = this.add.graphics().setDepth(2);
    this.doorGfx = this.add.graphics().setDepth(1);
    this.keyGfx = this.add.graphics().setDepth(2);
    this.drawDoorsAndKeys();
    this.platformGfx = this.add.graphics().setDepth(1);
    this.crumbleGfx = this.add.graphics().setDepth(1);
    this.drawCrumbles();

    // GDD-MOV-06: body hitbox, feet at the origin.
    this.body = this.add
      .container(this.run.player.x, this.run.player.y - HITBOX.height / 2, [
        this.add.rectangle(0, 0, HITBOX.width, HITBOX.height, 0xb94842),
        this.add.rectangle(0, (HITBOX.height - FEET_HEIGHT) / 2, HITBOX.width, FEET_HEIGHT, 0xfff3dc),
      ])
      .setDepth(3);

    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input is unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.SPACE), kb.addKey(K.Z), kb.addKey(K.UP), kb.addKey(K.W)],
    };

    // GDD-CTL-03: on-screen buttons on touch devices, merged with the keyboard below.
    this.touch = new TouchControls(this);

    if (import.meta.env.DEV) {
      window.__PONCHO__ = {
        state: () => this.run.player,
        ticks: () => this.ticks,
        peakRise: () => this.lastPeak,
        lives: () => this.run.lives.lives,
        phase: () => this.run.phase,
        invulnerable: () => this.run.invulnerable,
        bodyVisible: () => this.body.visible,
        bodyAlpha: () => this.body.alpha,
        bodyPose: () => ({ x: this.body.x, y: this.body.y + HITBOX.height / 2, rotation: this.body.rotation }),
        hudFilled: () => this.hudFilled,
        hudCracking: () => this.cracksDrawn,
        pause: (on) => {
          this.paused = on;
        },
        step: (n, input = { move: 0, jumpHeld: false }) => {
          if (!this.paused) throw new Error('step() needs the game paused');
          for (let i = 0; i < n; i++) this.simStep(input);
          this.drawHud();
          this.drawCrumbles();
          this.drawTacos();
          this.drawPinatas();
          this.drawItems();
          this.drawDoorsAndKeys();
          this.renderPlatforms(1);
          this.renderBody(1); // draw now, so a test that reads the picture right away sees this step
        },
        ofrendas: () => this.ofrendasDrawn,
        platforms: () => level.platforms.map((p) => platformAt(p, this.run.platformTick)),
        crumbles: () => level.crumbles.map((c, i) => ({ ...c, ...this.run.crumbles[i]! })),
        checkpoint: () => this.run.checkpoint,
        power: () => this.run.power,
        tacosDrawn: () => this.tacosPainted,
        heldTacoVisible: () => this.heldGfx.visible,
        hudPowerIcon: () => this.hudPower === 'taco',
        pinatasDrawn: () => this.pinatasPainted,
        itemsDrawn: () => this.itemsDrawn,
        keysHeld: () => this.run.keysHeld,
        keysDrawn: () => this.keysPainted,
        doorsDrawn: () => this.doorsPaintedShut.map((shut) => !shut),
        hudKeys: () => this.hudKeyCount,
        sfx: () => this.sfxLog,
        touch: () => this.touch.debug(),
        sfxLoaded: () => this.cache.audio.exists('sfx-ofrenda'),
        loseLife: () => this.setLives(loseLife(this.run.lives)),
        activateOfrenda: (id) => this.setLives(activateOfrenda(this.run.lives, id)),
        teleport: (x, y) => {
          this.run = { ...this.run, player: { ...spawn(x, y), grounded: false } };
          this.prevPlayer = this.run.player;
        },
      };
      // Dev only: L loses a life, O activates a fresh ofrenda, V collects a fresh veladora.
      // Polled with JustDown, not 'keydown-X' events: Phaser 4.2.1 can fire those more than once when several
      // key events land in the same frame (see docs/LESSONS.md L-006).
      this.devKeys = { lose: kb.addKey(K.L), ofrenda: kb.addKey(K.O), veladora: kb.addKey(K.V) };
      this.add.text(BASE_WIDTH - 6, 6, 'dev: L lose life, O ofrenda, V veladora', { fontFamily: 'monospace', fontSize: '8px', color: '#9ba3c4' }).setOrigin(1, 0);
    }
  }

  /** Placeholder tile art: one blue square per solid tile with a darker edge. */
  private drawTiles(): void {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x44588a, 1).lineStyle(1, 0x35466f, 1);
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        if (!world.solidTile(tx, ty)) continue;
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE).strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  /**
   * Placeholder crumbling tiles (GDD-WLD-05): sandy blocks with a crack. While warning they shake sideways and flash pale
   * in turn, so the warning shows by movement and not only by colour (GDD-UI-03); once gone they are not drawn.
   */
  private drawCrumbles(): void {
    this.crumblesKey = this.run.crumbles.map((c) => `${c.phase}${c.steps}`).join();
    this.crumbleGfx.clear();
    level.crumbles.forEach((c, i) => {
      const state = this.run.crumbles[i]!;
      if (state.phase === 'gone') return;
      const warning = state.phase === 'warning';
      const dx = warning ? (state.steps % 4 < 2 ? -1 : 1) : 0;
      const x = c.col * TILE + dx;
      const y = c.row * TILE;
      this.crumbleGfx.fillStyle(warning && state.steps % 8 < 4 ? 0xe9d3a3 : 0xc9a46a, 1).fillRect(x, y, TILE, TILE);
      this.crumbleGfx.lineStyle(1, 0x7d6038, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      this.crumbleGfx.lineBetween(x + 4, y + 1, x + 8, y + 7).lineBetween(x + 8, y + 7, x + 6, y + 14);
    });
  }

  /**
   * Placeholder moving platforms (GDD-WLD-05): a teal slab, 8 px thick, with a darker underside and a pale top edge so it
   * reads as a floor you can stand on and not as a tile. Drawn between the last two steps, like Poncho, so he does not
   * slide on it.
   */
  private renderPlatforms(alpha: number): void {
    this.platformGfx.clear();
    for (const p of level.platforms) {
      const at = platformAt(p, Math.max(0, this.run.platformTick - 1 + alpha));
      this.platformGfx.fillStyle(0x3f8f8a, 1).fillRect(at.x, at.y, at.w, 8);
      this.platformGfx.fillStyle(0x2a5f5c, 1).fillRect(at.x, at.y + 5, at.w, 3);
      this.platformGfx.fillStyle(0xd7f2ee, 1).fillRect(at.x, at.y, at.w, 1);
    }
  }

  /**
   * Placeholder taco (GDD-PWR-02, GDD-VIS-01): a tan shell folded into a half circle, green lettuce along the open edge and
   * two red tomato dots. `size` is the width in px. Used for the pickup, the taco in Poncho's hand and the HUD icon.
   */
  private paintTaco(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    const r = size / 2;
    g.fillStyle(0xe8b755, 1).beginPath().arc(cx, cy + r / 2, r, Math.PI, 0, false).closePath().fillPath();
    g.fillStyle(0x6fae4a, 1).fillRect(cx - r, cy + r / 2 - 1, size, 1);
    g.fillStyle(0xc2392d, 1).fillRect(cx - r / 2, cy - 1, 1.5, 1.5).fillRect(cx + r / 4, cy - 1.5, 1.5, 1.5);
    g.lineStyle(1, 0x5a3a14, 1).beginPath().arc(cx, cy + r / 2, r, Math.PI, 0, false).strokePath();
  }

  /** The taco pickups still waiting in the level (GDD-PWR-02). Redrawn when one is picked up or they all come back. */
  private drawTacos(): void {
    this.tacosKey = this.run.tacosTaken.join();
    this.tacoGfx.clear();
    this.tacosPainted = 0;
    level.tacos.forEach((t, i) => {
      if (this.run.tacosTaken[i]) return;
      this.tacosPainted++;
      this.paintTaco(this.tacoGfx, t.col * TILE + TILE / 2, t.row * TILE + TILE / 2 - 1, 12);
    });
  }

  /**
   * Placeholder piñata art (GDD-PWR-05): a closed one is a diamond in four party colours with a fringe along the top and a
   * string, so it reads as a piñata and not as a tile. An open one is a dull torn shell with a dark hole, so the two
   * differ by shape and not only by colour (GDD-UI-03).
   */
  private drawPinatas(): void {
    this.pinatasKey = this.run.pinatasOpen.join();
    this.pinataGfx.clear();
    this.pinatasPainted = level.pinatas.map(() => false);
    level.pinatas.forEach((p, i) => {
      const x = p.col * TILE;
      const y = p.row * TILE;
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      if (this.run.pinatasOpen[i]) {
        this.pinatasPainted[i] = true; // painted as the open shell
        this.pinataGfx.fillStyle(0x8a7a62, 1).fillTriangle(x + 1, cy, cx, y + 2, x + TILE - 1, cy).fillTriangle(x + 1, cy, x + TILE - 1, cy, cx, y + TILE - 1);
        this.pinataGfx.fillStyle(0x2a2218, 1).fillRect(cx - 4, cy - 2, 8, 4);
        this.pinataGfx.lineStyle(1, 0x4a3f2e, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        return;
      }
      this.pinataGfx.fillStyle(0xe0508a, 1).fillTriangle(x + 1, cy, cx, y + 1, cx, cy);
      this.pinataGfx.fillStyle(0xf2c230, 1).fillTriangle(x + TILE - 1, cy, cx, y + 1, cx, cy);
      this.pinataGfx.fillStyle(0x2fb5a0, 1).fillTriangle(x + 1, cy, cx, y + TILE - 1, cx, cy);
      this.pinataGfx.fillStyle(0xf28a30, 1).fillTriangle(x + TILE - 1, cy, cx, y + TILE - 1, cx, cy);
      this.pinataGfx.lineStyle(1, 0x3a1530, 1).strokeTriangle(x + 1, cy, cx, y + 1, x + TILE - 1, cy).strokeTriangle(x + 1, cy, cx, y + TILE - 1, x + TILE - 1, cy);
      this.pinataGfx.fillStyle(0xfff3dc, 1).fillRect(x + 3, y, TILE - 6, 1);
    });
  }

  /** A small golden key: a ring for the head, a shaft and two teeth. `size` is the height in px. */
  private paintKey(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    const u = size / 12;
    g.fillStyle(0xf2c230, 1).fillCircle(cx, cy - 3 * u, 3 * u).fillRect(cx - 0.75 * u, cy - u, 1.5 * u, 6 * u).fillRect(cx, cy + 3 * u, 2.5 * u, 1.2 * u).fillRect(cx, cy + 5 * u, 2 * u, 1.2 * u);
    g.fillStyle(0x1b2036, 1).fillCircle(cx, cy - 3 * u, 1.2 * u);
    g.lineStyle(1, 0x6b4e0a, 1).strokeCircle(cx, cy - 3 * u, 3 * u);
  }

  /**
   * Placeholder doors and keys (GDD-WLD-05): a shut door is a wooden plank wall with an iron band and a keyhole, so it reads
   * as a door and not as a tile; once open it is not drawn. A key lying on the floor is the golden key, until picked up.
   */
  private drawDoorsAndKeys(): void {
    this.doorsKey = `${this.run.doorsOpen.join()}|${this.run.keysTaken.join()}`;
    this.doorGfx.clear();
    this.doorsPaintedShut = level.doors.map(() => false);
    level.doors.forEach((d, i) => {
      if (this.run.doorsOpen[i]) return;
      this.doorsPaintedShut[i] = true;
      const x = d.col * TILE;
      const y = d.row * TILE;
      const h = d.height * TILE;
      this.doorGfx.fillStyle(0x8b5a2b, 1).fillRect(x, y, TILE, h);
      this.doorGfx.lineStyle(1, 0x4a2f14, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, h - 1).lineBetween(x + TILE / 2, y, x + TILE / 2, y + h);
      this.doorGfx.fillStyle(0x3a3f4f, 1).fillRect(x, y + 4, TILE, 2).fillRect(x, y + h - 6, TILE, 2);
      this.doorGfx.fillStyle(0xf2c230, 1).fillCircle(x + TILE / 2, y + h / 2, 2).fillRect(x + TILE / 2 - 0.5, y + h / 2, 1, 4);
    });
    this.keyGfx.clear();
    this.keysPainted = 0;
    level.keys.forEach((k, i) => {
      if (this.run.keysTaken[i]) return;
      this.keysPainted++;
      this.paintKey(this.keyGfx, k.col * TILE + TILE / 2, k.row * TILE + TILE / 2, 12);
    });
  }

  /** The tacos walking about after a piñata (GDD-PWR-02), drawn where the simulation has them. */
  private drawItems(): void {
    this.itemGfx.clear();
    this.itemsDrawn = this.run.items.map((it) => ({ x: it.x, y: it.y }));
    for (const it of this.run.items) this.paintTaco(this.itemGfx, it.x, it.y - 7, 12);
  }

  /** Placeholder spring art (GDD-WLD-05): a red block with a pale zigzag coil and a bar on top, to read as springy and not as floor. */
  private drawSprings(): void {
    const g = this.add.graphics().setDepth(1);
    for (const sp of level.springs) {
      const x = sp.col * TILE;
      const y = sp.row * TILE;
      g.fillStyle(0xb8453a, 1).fillRect(x, y, TILE, TILE);
      g.lineStyle(1, 0x5e1f1a, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      g.fillStyle(0xfff3dc, 1).fillRect(x + 1, y + 1, TILE - 2, 3);
      g.lineStyle(1, 0xfff3dc, 1).lineBetween(x + 3, y + 6, x + 13, y + 8).lineBetween(x + 13, y + 8, x + 3, y + 10).lineBetween(x + 3, y + 10, x + 13, y + 12);
    }
  }

  /** Placeholder spike art: two light points per tile with a dark outline, inside the lower half that hurts (GDD-WLD-05, GDD-UI-03 high-contrast hazards). */
  private drawSpikes(): void {
    const g = this.add.graphics().setDepth(2);
    for (const s of level.spikes) {
      const x = s.col * TILE;
      const bottom = (s.row + 1) * TILE;
      for (const px of [x, x + TILE / 2]) {
        g.fillStyle(0xe5e8f2, 1).fillTriangle(px + 0.5, bottom, px + TILE / 2 - 0.5, bottom, px + TILE / 4, bottom - SPIKE.height);
        g.lineStyle(1, 0x12162a, 1).strokeTriangle(px + 0.5, bottom, px + TILE / 2 - 0.5, bottom, px + TILE / 4, bottom - SPIKE.height);
      }
    }
  }

  /**
   * Placeholder ofrenda art (GDD-WLD-05): an outlined frame when unused, filled with a flame on top once used, so the two
   * differ by shape and not only by colour (GDD-UI-03). Real art arrives with GDD-ART-01.
   */
  private drawOfrendas(): void {
    this.ofrendaGfx.clear();
    this.ofrendasDrawn = level.ofrendas.map((o) => ({ id: o.id, x: o.x, used: this.run.lives.used.has(`ofrenda:${o.id}`) }));
    for (const o of level.ofrendas) {
      const used = this.run.lives.used.has(`ofrenda:${o.id}`);
      const x = o.x - OFRENDA.width / 2;
      const y = o.y - OFRENDA.height;
      if (used) {
        this.ofrendaGfx.fillStyle(0xe8a33d, 1).fillRect(x + 2, y + 10, OFRENDA.width - 4, OFRENDA.height - 10);
        this.ofrendaGfx.fillStyle(0xfff3dc, 1).fillTriangle(x + 8, y, x + 4, y + 10, x + 12, y + 10);
      }
      this.ofrendaGfx.lineStyle(1, used ? 0xfff3dc : 0x9ba3c4, 1).strokeRect(x + 2.5, y + 10.5, OFRENDA.width - 5, OFRENDA.height - 11);
    }
    this.ofrendasKey = this.usedKey();
  }

  private playSfx(name: 'ofrenda'): void {
    this.sfxLog.push(name);
    this.sound.play(`sfx-${name}`);
  }

  private usedKey(): string {
    return level.ofrendas.map((o) => (this.run.lives.used.has(`ofrenda:${o.id}`) ? '1' : '0')).join('');
  }

  private setLives(lives: RunState['lives']): void {
    this.run = { ...this.run, lives };
    this.drawHud();
  }

  /** GDD-UI-01: filled triangle per life, outline only per lost life. */
  private drawHud(): void {
    this.hud.clear();
    this.hudFilled = 0;
    // GDD-LIFE-02: a life lost since the last drawing starts a crack on its triangle.
    this.cracks = updateCracks(this.cracks, this.drawnLives, this.run.lives.lives, this.ticks);
    this.drawnLives = this.run.lives.lives;
    this.cracksDrawn = [];
    // GDD-UI-01: a small icon of the power-up state, to the right of the triangles. Nothing in Base.
    this.hudPower = this.run.power;
    if (this.run.power === 'taco') this.paintTaco(this.hud, LIVES_HUD.left + 7 * (LIVES_HUD.width + LIVES_HUD.gap) + 6, LIVES_HUD.top + 3, 13);
    // GDD-WLD-05: one small key per key Poncho carries, after the power-up icon.
    this.hudKeyCount = this.run.keysHeld;
    for (let i = 0; i < this.run.keysHeld; i++) this.paintKey(this.hud, LIVES_HUD.left + 7 * (LIVES_HUD.width + LIVES_HUD.gap) + 24 + i * 9, LIVES_HUD.top + 5, 12);
    layoutLives(this.run.lives.lives).forEach((triangle, index) => {
      const { points: [x1, y1, x2, y2, x3, y3], filled } = triangle;
      if (filled) {
        this.hudFilled++;
        this.hud.fillStyle(0xb94842, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
        this.hud.lineStyle(1, 0xfff3dc, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
        return;
      }
      const frame = crackFrame(this.cracks.find((c) => c.index === index) ?? { index, start: Infinity }, this.ticks);
      if (frame) {
        // Cracking: the red fill fades out, and a crack line shows across it, over the outline of a lost life.
        this.cracksDrawn.push({ index, ...frame });
        this.hud.fillStyle(0xb94842, frame.fillAlpha).fillTriangle(x1, y1, x2, y2, x3, y3);
        const line = crackLine(triangle);
        this.hud.lineStyle(1, 0xfff3dc, frame.crackAlpha).beginPath().moveTo(line[0]!, line[1]!);
        for (let i = 2; i < line.length; i += 2) this.hud.lineTo(line[i]!, line[i + 1]!);
        this.hud.strokePath();
      }
      this.hud.lineStyle(1, 0x9ba3c4, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
    });
  }

  /** One fixed simulation step with the given input. */
  private simStep(input: PlayerInput): void {
    const before = this.run;
    this.run = stepRun(before, input, level);
    // Do not smear the picture across a respawn: only interpolate while playing on both sides of the step.
    this.prevPlayer = before.phase === 'playing' && this.run.phase === 'playing' ? before.player : this.run.player;
    this.ticks++;
    const { player } = this.run;
    if (player.grounded) {
      if (this.peak > 0) this.lastPeak = this.peak;
      this.peak = 0;
    } else {
      this.peak = Math.max(this.peak, FLOOR_Y - player.y);
    }
  }

  /**
   * Draws Poncho. Interpolated between the last two simulation states while playing. While waiting to respawn he is
   * hidden and then flips in; after it he blinks while invulnerable (GDD-LIFE-02).
   */
  private renderBody(alpha: number): void {
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const { player } = this.run;
    if (this.run.phase === 'respawning') {
      // GDD-LIFE-02: hidden at first, then he drops in above the respawn point, turning once, and lands feet-first.
      const pose = flipPose(this.run.wait);
      const at = respawnPoint(this.run, level);
      this.body.setPosition(at.x, at.y - pose.dy - HITBOX.height / 2).setRotation(pose.angle).setVisible(pose.visible);
    } else {
      this.body.setPosition(lerp(this.prevPlayer.x, player.x), lerp(this.prevPlayer.y, player.y) - HITBOX.height / 2).setRotation(0).setVisible(true);
    }
    // The blink phase comes from the invulnerability counter, so it is the same every time: bright for the first
    // 0.1 s after a respawn, then dim and bright in turn.
    this.body.setAlpha(Math.floor(this.run.invulnerable / BLINK_STEPS) % 2 === 1 ? 0.3 : 1);
    // GDD-PWR-01: in Taco he holds a taco in front of him, on the side he faces. It follows the body, blink and all.
    this.heldGfx.clear().setVisible(this.run.power === 'taco' && this.run.phase === 'playing').setAlpha(this.body.alpha);
    if (this.heldGfx.visible) this.paintTaco(this.heldGfx, this.body.x + player.facing * (HITBOX.width / 2 + 1), this.body.y - 1, 10);
  }

  override update(_time: number, deltaMs: number): void {
    const dev = this.devKeys;
    if (dev) {
      if (Phaser.Input.Keyboard.JustDown(dev.lose)) this.setLives(loseLife(this.run.lives));
      if (Phaser.Input.Keyboard.JustDown(dev.ofrenda)) this.setLives(activateOfrenda(this.run.lives, `dev-${this.devOfrendas++}`));
      if (Phaser.Input.Keyboard.JustDown(dev.veladora)) this.setLives(collectVeladora(this.run.lives, `dev-${this.devVeladoras++}`));
    }

    // Keyboard and touch work together: either can move or jump (GDD-CTL-01, GDD-CTL-03).
    const touch = this.touch.read();
    const input: PlayerInput = {
      move: Math.max(-1, Math.min(1, (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0) + touch.move)),
      jumpHeld: down(this.keys.jump) || touch.jumpHeld,
    };

    const alpha = this.paused ? 1 : this.stepper.advance(deltaMs / 1000, () => this.simStep(input));
    // Redraw when the lives change, and on every step while a triangle is cracking.
    if (this.run.lives.lives !== this.drawnLives || this.cracks.length > 0 || this.run.power !== this.hudPower || this.run.keysHeld !== this.hudKeyCount) this.drawHud();
    if (`${this.run.doorsOpen.join()}|${this.run.keysTaken.join()}` !== this.doorsKey) this.drawDoorsAndKeys();
    if (this.run.tacosTaken.join() !== this.tacosKey) this.drawTacos();
    if (this.run.pinatasOpen.join() !== this.pinatasKey) this.drawPinatas();
    this.drawItems();
    if (this.run.crumbles.map((c) => `${c.phase}${c.steps}`).join() !== this.crumblesKey) this.drawCrumbles();
    const key = this.usedKey();
    if (key !== this.ofrendasKey) {
      // GDD-AUD-02: the marimba plays when an ofrenda is used for the first time, not when a restart resets them.
      const activated = countUsed(key) > countUsed(this.ofrendasKey);
      this.drawOfrendas();
      if (activated) this.playSfx('ofrenda');
    }

    this.renderPlatforms(alpha);
    this.renderBody(alpha);
  }
}
