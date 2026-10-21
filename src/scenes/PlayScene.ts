// Placeholder scene: proves the loop (input, fixed-step simulation, tile collision, pits, rendering) on the sandbox level.
// Final art arrives with GDD-ART-01 and GDD-ART-02, Tiled levels with GDD-TEC-04.
import Phaser from 'phaser';
import { BASE_WIDTH, HITBOX, OFRENDA, SPIKE, TILE } from '../config/tuning';
import { SANDBOX_OFRENDAS, SANDBOX_ROWS, SANDBOX_SPAWN, SANDBOX_SPIKES } from '../levels/sandbox';
import { FixedStepper } from '../sim/fixedStep';
import ofrendaOgg from '../../assets/audio/sfx/ofrenda.ogg';
import ofrendaMp3 from '../../assets/audio/sfx/ofrenda.mp3';
import { activateOfrenda, collectVeladora, loseLife } from '../sim/lives';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { flipPose } from '../sim/respawnFlip';
import { respawnPoint, startRun, stepRun, type Level, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { crackFrame, crackLine, updateCracks, type Crack } from '../ui/lifeCrack';
import { layoutLives } from '../ui/livesLayout';
import { TouchControls, type TouchDebug } from '../ui/TouchControls';

// GDD-MOV-06: Poncho collides with the tile grid. The spawn stands on the floor, so its y is the floor level.
const world = parseTiles(SANDBOX_ROWS);
const level: Level = { world, spawn: SANDBOX_SPAWN, ofrendas: SANDBOX_OFRENDAS, spikes: SANDBOX_SPIKES };
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
  /** Where Poncho would respawn now (GDD-LIFE-02). */
  checkpoint(): { x: number; y: number };
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
          this.renderBody(1); // draw now, so a test that reads the picture right away sees this step
        },
        ofrendas: () => this.ofrendasDrawn,
        checkpoint: () => this.run.checkpoint,
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
    if (this.run.lives.lives !== this.drawnLives || this.cracks.length > 0) this.drawHud();
    const key = this.usedKey();
    if (key !== this.ofrendasKey) {
      // GDD-AUD-02: the marimba plays when an ofrenda is used for the first time, not when a restart resets them.
      const activated = countUsed(key) > countUsed(this.ofrendasKey);
      this.drawOfrendas();
      if (activated) this.playSfx('ofrenda');
    }

    this.renderBody(alpha);
  }
}
