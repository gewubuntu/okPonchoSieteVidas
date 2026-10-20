// GDD-CTL-03: the on-screen buttons, drawn and read each frame. Layout and hit testing are pure and live in
// touchLayout.ts; this file only talks to Phaser. Shown only on devices that report touch.
import Phaser from 'phaser';
import { BASE_WIDTH } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';
import { layoutTouchButtons, pressedButtons, touchInput, type TouchButton, type TouchButtonId } from './touchLayout';

const IDLE_ALPHA = 0.35;
const PRESSED_ALPHA = 0.75;

export interface TouchDebug {
  visible: boolean;
  buttons: readonly TouchButton[];
  /** Buttons drawn as pressed, read from what was drawn. */
  pressed: readonly TouchButtonId[];
}

export class TouchControls {
  private readonly enabled: boolean;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private buttons: TouchButton[] = [];
  private pressed = new Set<TouchButtonId>();
  private drawnPressed: TouchButtonId[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.enabled = scene.sys.game.device.input.touch;
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(10).setVisible(this.enabled);
    if (!this.enabled) return;
    this.relayout();
    // Buttons keep their size on the player's screen, so lay them out again when the canvas is resized.
    const onResize = () => this.relayout();
    scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  /** What the fingers on the screen press now, as the same input the keyboard gives. */
  read(): PlayerInput {
    if (!this.enabled) return { move: 0, jumpHeld: false };
    const fingers = this.scene.input.manager.pointers.filter((p) => p.isDown);
    const pressed = pressedButtons(this.buttons, fingers);
    if (pressed.size !== this.pressed.size || [...pressed].some((id) => !this.pressed.has(id))) {
      this.pressed = pressed;
      this.draw();
    }
    return touchInput(pressed);
  }

  debug(): TouchDebug {
    return { visible: this.enabled && this.gfx.visible, buttons: this.buttons, pressed: this.drawnPressed };
  }

  private relayout(): void {
    this.buttons = layoutTouchButtons(this.scene.scale.displaySize.width / BASE_WIDTH);
    this.draw();
  }

  /** Placeholder look: a triangle in a frame, pointing the way the button moves (the poncho motif, GDD-ART-02). */
  private draw(): void {
    this.gfx.clear();
    this.drawnPressed = [];
    for (const b of this.buttons) {
      const down = this.pressed.has(b.id);
      if (down) this.drawnPressed.push(b.id);
      this.gfx.fillStyle(0x1b2036, down ? 0.7 : 0.45).fillRect(b.x, b.y, b.w, b.h);
      this.gfx.lineStyle(1, 0xfff3dc, down ? PRESSED_ALPHA : IDLE_ALPHA).strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const r = b.w * 0.25;
      this.gfx.fillStyle(down ? 0xe8a33d : 0xfff3dc, down ? PRESSED_ALPHA : IDLE_ALPHA + 0.25);
      if (b.id === 'left') this.gfx.fillTriangle(cx - r, cy, cx + r, cy - r, cx + r, cy + r);
      else if (b.id === 'right') this.gfx.fillTriangle(cx + r, cy, cx - r, cy - r, cx - r, cy + r);
      else this.gfx.fillTriangle(cx, cy - r, cx - r, cy + r, cx + r, cy + r);
    }
  }
}
