// Placeholder scene: proves the loop (input, fixed-step simulation, rendering) on a flat floor.
// Final art arrives with GDD-ART-01 and GDD-ART-02, levels with GDD-TEC-04.
import Phaser from 'phaser';
import { BASE_WIDTH, HITBOX, TILE } from '../config/tuning';
import { SANDBOX_ROWS, SANDBOX_SPAWN } from '../levels/sandbox';
import { FixedStepper } from '../sim/fixedStep';
import { activateOfrenda, collectVeladora, loseLife, startWorld, type LivesState } from '../sim/lives';
import { spawn, step, type PlayerInput, type PlayerState } from '../sim/movement';
import { parseTiles } from '../sim/tilemap';
import { layoutLives } from '../ui/livesLayout';

// GDD-MOV-06: Poncho collides with the tile grid. The spawn stands on the floor, so its y is the floor level.
const world = parseTiles(SANDBOX_ROWS);
const FLOOR_Y = SANDBOX_SPAWN.y;
const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);

/** Dev-only hook for the `playtest` skill. Exposed only by the Vite dev server (see PlayScene.create). */
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
}

declare global {
  interface Window {
    __PONCHO__?: PonchoDebug;
  }
}

export class PlayScene extends Phaser.Scene {
  private readonly stepper = new FixedStepper();
  private player: PlayerState = spawn(SANDBOX_SPAWN.x, SANDBOX_SPAWN.y);
  private prevPlayer: PlayerState = this.player;
  private ticks = 0;
  private peak = 0;
  private lastPeak = 0;
  private lives: LivesState = startWorld();
  private hud!: Phaser.GameObjects.Graphics;
  private hudFilled = 0;
  private devOfrendas = 0;
  private devVeladoras = 0;
  private devKeys?: Record<'lose' | 'ofrenda' | 'veladora', Phaser.Input.Keyboard.Key>;
  private body!: Phaser.GameObjects.Rectangle;
  private keys!: Record<'left' | 'right' | 'jump', Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('play');
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

    // GDD-MOV-06: body hitbox, feet at the origin.
    this.body = this.add.rectangle(this.player.x, this.player.y, HITBOX.width, HITBOX.height, 0xb94842).setOrigin(0.5, 1);

    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input is unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.SPACE), kb.addKey(K.Z), kb.addKey(K.UP), kb.addKey(K.W)],
    };

    if (import.meta.env.DEV) {
      window.__PONCHO__ = {
        state: () => this.player,
        ticks: () => this.ticks,
        peakRise: () => this.lastPeak,
        lives: () => this.lives.lives,
        hudFilled: () => this.hudFilled,
        loseLife: () => this.setLives(loseLife(this.lives)),
        activateOfrenda: (id) => this.setLives(activateOfrenda(this.lives, id)),
        teleport: (x, y) => {
          this.player = { ...spawn(x, y), grounded: false };
          this.prevPlayer = this.player;
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

  private setLives(next: LivesState): void {
    this.lives = next;
    this.drawHud();
  }

  /** GDD-UI-01: filled triangle per life, outline only per lost life. */
  private drawHud(): void {
    this.hud.clear();
    this.hudFilled = 0;
    for (const { points: [x1, y1, x2, y2, x3, y3], filled } of layoutLives(this.lives.lives)) {
      if (filled) {
        this.hudFilled++;
        this.hud.fillStyle(0xb94842, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
        this.hud.lineStyle(1, 0xfff3dc, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
      } else {
        this.hud.lineStyle(1, 0x9ba3c4, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
      }
    }
  }

  override update(_time: number, deltaMs: number): void {
    const dev = this.devKeys;
    if (dev) {
      if (Phaser.Input.Keyboard.JustDown(dev.lose)) this.setLives(loseLife(this.lives));
      if (Phaser.Input.Keyboard.JustDown(dev.ofrenda)) this.setLives(activateOfrenda(this.lives, `dev-${this.devOfrendas++}`));
      if (Phaser.Input.Keyboard.JustDown(dev.veladora)) this.setLives(collectVeladora(this.lives, `dev-${this.devVeladoras++}`));
    }

    const input: PlayerInput = {
      move: (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0),
      jumpHeld: down(this.keys.jump),
    };

    const alpha = this.stepper.advance(deltaMs / 1000, () => {
      this.prevPlayer = this.player;
      this.player = step(this.player, input, world);
      this.ticks++;
      if (this.player.grounded) {
        if (this.peak > 0) this.lastPeak = this.peak;
        this.peak = 0;
      } else {
        this.peak = Math.max(this.peak, FLOOR_Y - this.player.y);
      }
    });

    // Render interpolated between the last two simulation states.
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    this.body.setPosition(lerp(this.prevPlayer.x, this.player.x), lerp(this.prevPlayer.y, this.player.y));
  }
}
