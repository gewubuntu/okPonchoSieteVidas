// GDD-CTL-03: the on-screen buttons, drawn and read each frame. Layout and hit testing are pure and live in
// touchLayout.ts; this file only talks to Phaser. Shown only on devices that report touch.
import Phaser from 'phaser';
import { BASE_WIDTH } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';
import { layoutTouchButtons, pressedButtons, stickMove, touchInput, type TouchButton, type TouchButtonId, type TouchMode } from './touchLayout';

const IDLE_ALPHA = 0.35;
const PRESSED_ALPHA = 0.75;
const MODE_KEY = 'poncho.touchMode';

/** The player's choice survives a reload; storage can be blocked, so it is only a convenience (GDD-CTL-03). */
const loadMode = (): TouchMode => {
  try {
    return localStorage.getItem(MODE_KEY) === 'stick' ? 'stick' : 'buttons';
  } catch {
    return 'buttons';
  }
};
const saveMode = (mode: TouchMode): void => {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore: the choice just lasts until the page closes
  }
};

export interface TouchDebug {
  visible: boolean;
  buttons: readonly TouchButton[];
  /** Buttons drawn as pressed, read from what was drawn. */
  pressed: readonly TouchButtonId[];
  /** Whether the left thumb zone holds buttons or the slide stick, and the stick's last analog move (-1 to 1). */
  mode: TouchMode;
  stick: number;
}

export class TouchControls {
  private readonly enabled: boolean;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private buttons: TouchButton[] = [];
  private pressed = new Set<TouchButtonId>();
  private drawnPressed: TouchButtonId[] = [];
  private mode: TouchMode = loadMode();
  private stick = 0;
  /** Fingers that already flipped the mode, so one touch flips it once. */
  private readonly flipped = new Set<number>();

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
    // A finger that went down on the mode switch flips the zone once. A finger that slid onto it from the stick, or
    // that stays on it, does not.
    const live = new Set(fingers.map((f) => f.id));
    for (const id of this.flipped) if (!live.has(id)) this.flipped.delete(id);
    const mode = this.buttons.filter((b) => b.id === 'mode');
    const flip = fingers.find((f) => !this.flipped.has(f.id) && pressedButtons(mode, [{ x: f.downX, y: f.downY }]).size > 0);
    if (flip) {
      this.flipped.add(flip.id);
      this.setMode(this.mode === 'stick' ? 'buttons' : 'stick');
    }
    const stick = stickMove(this.buttons, fingers);
    if (pressed.size !== this.pressed.size || [...pressed].some((id) => !this.pressed.has(id)) || stick !== this.stick) {
      this.pressed = pressed;
      this.stick = stick;
      this.draw();
    }
    return touchInput(pressed, stick);
  }

  debug(): TouchDebug {
    return { visible: this.enabled && this.gfx.visible, buttons: this.buttons, pressed: this.drawnPressed, mode: this.mode, stick: this.stick };
  }

  private setMode(mode: TouchMode): void {
    this.mode = mode;
    saveMode(mode);
    this.relayout();
  }

  private relayout(): void {
    this.buttons = layoutTouchButtons(this.scene.scale.displaySize.width / BASE_WIDTH, this.mode);
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
      else if (b.id === 'stick') this.drawStick(b);
      else if (b.id === 'mode') this.drawModeIcon(b);
      else if (b.id === 'claw') this.drawClawIcon(b, down);
      else this.gfx.fillTriangle(cx, cy - r, cx - r, cy + r, cx + r, cy + r);
    }
  }

  /** Placeholder: a groove with the two directions as small triangles and a thumb where the finger steers. */
  private drawStick(b: TouchButton): void {
    const cy = b.y + b.h / 2;
    const r = b.h * 0.18;
    const live = this.stick !== 0;
    this.gfx.fillStyle(0xfff3dc, IDLE_ALPHA + 0.1);
    this.gfx.fillTriangle(b.x + 6, cy, b.x + 6 + r, cy - r, b.x + 6 + r, cy + r);
    this.gfx.fillTriangle(b.x + b.w - 6, cy, b.x + b.w - 6 - r, cy - r, b.x + b.w - 6 - r, cy + r);
    const travel = b.w / 2 - b.h * 0.3;
    const thumbX = b.x + b.w / 2 + this.stick * travel;
    this.gfx.fillStyle(live ? 0xe8a33d : 0xfff3dc, live ? PRESSED_ALPHA : IDLE_ALPHA + 0.25);
    this.gfx.fillCircle(thumbX, cy, b.h * 0.3);
  }

  /** Placeholder: three slanted claw marks, the same as the swipe. */
  private drawClawIcon(b: TouchButton, down: boolean): void {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const r = b.w * 0.28;
    this.gfx.lineStyle(2, down ? 0xe8a33d : 0xfff3dc, down ? PRESSED_ALPHA : IDLE_ALPHA + 0.25);
    for (const dx of [-r * 0.7, 0, r * 0.7]) this.gfx.lineBetween(cx + dx - r * 0.4, cy - r, cx + dx + r * 0.4, cy + r);
  }

  /** The switch shows what a tap changes to: the stick's groove while on buttons, a pair of triangles while on the stick. */
  private drawModeIcon(b: TouchButton): void {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const r = b.w * 0.14;
    this.gfx.fillStyle(0xfff3dc, IDLE_ALPHA + 0.25);
    if (this.mode === 'buttons') {
      this.gfx.fillRect(cx - b.w * 0.3, cy - 1, b.w * 0.6, 2);
      this.gfx.fillCircle(cx, cy, r);
    } else {
      this.gfx.fillTriangle(cx - 2, cy, cx - 2 - r * 2, cy - r, cx - 2 - r * 2, cy + r);
      this.gfx.fillTriangle(cx + 2, cy, cx + 2 + r * 2, cy - r, cx + 2 + r * 2, cy + r);
    }
  }
}
