// Placeholder scene: proves the loop (input, fixed-step simulation, rendering) on a flat floor.
// Final art arrives with GDD-ART-01 and GDD-ART-02, levels with GDD-TEC-04.
import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, HITBOX } from '../config/tuning';
import { FixedStepper } from '../sim/fixedStep';
import { flatWorld, spawn, step, type PlayerInput, type PlayerState } from '../sim/movement';

const FLOOR_Y = 224;
const world = flatWorld(FLOOR_Y);
const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);

/** Dev-only hook for the `playtest` skill. Exposed only by the Vite dev server (see PlayScene.create). */
export interface PonchoDebug {
  state(): PlayerState;
  ticks(): number;
  /** Highest point above the floor reached in the most recent completed jump, in px. */
  peakRise(): number;
}

declare global {
  interface Window {
    __PONCHO__?: PonchoDebug;
  }
}

export class PlayScene extends Phaser.Scene {
  private readonly stepper = new FixedStepper();
  private player: PlayerState = spawn(BASE_WIDTH / 2, FLOOR_Y);
  private prevPlayer: PlayerState = this.player;
  private ticks = 0;
  private peak = 0;
  private lastPeak = 0;
  private body!: Phaser.GameObjects.Rectangle;
  private keys!: Record<'left' | 'right' | 'jump', Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('play');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b2036');
    this.add.rectangle(0, FLOOR_Y, BASE_WIDTH, BASE_HEIGHT - FLOOR_Y, 0x44588a).setOrigin(0, 0);
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
      window.__PONCHO__ = { state: () => this.player, ticks: () => this.ticks, peakRise: () => this.lastPeak };
    }
  }

  override update(_time: number, deltaMs: number): void {
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
