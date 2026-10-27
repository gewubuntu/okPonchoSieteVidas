// GDD-CTL-03: the on-screen buttons, drawn and read each frame. Layout and hit testing are pure and live in
// touchLayout.ts; this file only talks to Phaser. Shown only on devices that report touch.
import Phaser from 'phaser';
import { BASE_WIDTH, TIPS } from '../config/tuning';
import type { PlayerInput } from '../sim/movement';
import { dashedRect } from './dashed';
import { gamePoint } from './gamePoint';
import { effectiveHeld, InputLatch } from './inputLatch';
import { layoutTouchButtons, pressedButtons, stickMove, touchInput, type TouchButton, type TouchButtonId, type TouchMode } from './touchLayout';

const IDLE_ALPHA = 0.35;
const PRESSED_ALPHA = 0.75;
const MODE_KEY = 'poncho.touchMode';

/** A finger, told apart from a later one on the same pointer slot by when it went down. */
const fingerKey = (p: { id: number; downTime: number }): string => `${p.id}:${p.downTime}`;

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
  /** GDD-UI-05: the button outlined by a tutorial tip, as drawn: 'move' for the left and right buttons or the stick, or null. */
  highlighted: TouchButtonId | 'move' | null;
}

export class TouchControls {
  private readonly enabled: boolean;
  private readonly gfx: Phaser.GameObjects.Graphics;
  /** GDD-UI-05: the dashed outline a tutorial tip draws round a button, just above the buttons, and what it is round. */
  private readonly highlightGfx: Phaser.GameObjects.Graphics;
  private highlighted: TouchButtonId | 'move' | null = null;
  private buttons: TouchButton[] = [];
  private pressed = new Set<TouchButtonId>();
  private drawnPressed: TouchButtonId[] = [];
  private mode: TouchMode = loadMode();
  private stick = 0;
  /** L-006: a tap on Jump or Claw that is over before the next poll still counts for one step. Left and right too: a tap of
   * either ends the Siete vidas gastadas screen (GDD-LIFE-05). */
  private readonly jumpLatch = new InputLatch();
  private readonly leftLatch = new InputLatch();
  private readonly rightLatch = new InputLatch();
  private readonly clawLatch = new InputLatch();
  private readonly fuegoLatch = new InputLatch();
  /** GDD-PWR-03: whether the Fuego button is shown, which is only while Poncho is in the Fuego state. */
  private fuego = false;
  /** Hidden on the title screen (GDD-UI-02). */
  private hidden = false;
  /** Fingers that already flipped the mode, so one touch flips it once. */
  private readonly flipped = new Set<number>();
  /** GDD-UI-02: the fingers down when the pause began, which keep steering after it, and the fingers the slide stick ignores until they lift. */
  private downAtPause = new Set<string>();
  private readonly heldBack = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {
    this.enabled = scene.sys.game.device.input.touch;
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(10).setVisible(this.enabled);
    this.highlightGfx = scene.add.graphics().setScrollFactor(0).setDepth(10.5).setVisible(this.enabled);
    if (!this.enabled) return;
    this.relayout();
    // Buttons keep their size on the player's screen, so lay them out again when the canvas is resized.
    const onResize = () => this.relayout();
    scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // A tap latched while the buttons are hidden is never read: `read()` returns nothing while hidden, and the latches are spent
      // each frame of the title and when it closes (`consume`, `holdBack`). No guard here (L-025).
      const hit = pressedButtons(this.buttons, [gamePoint(p)]);
      if (hit.has('jump')) this.jumpLatch.press();
      if (hit.has('claw')) this.clawLatch.press();
      if (hit.has('fuego')) this.fuegoLatch.press();
      if (hit.has('left')) this.leftLatch.press();
      if (hit.has('right')) this.rightLatch.press();
    });
    // A scene removed for the next level is destroyed without a shutdown (GDD-UI-02), so both events unhook it.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  /** What the fingers on the screen press now, as the same input the keyboard gives. Nothing while the buttons are hidden. */
  read(): PlayerInput {
    if (!this.enabled) return { move: 0, jumpHeld: false };
    const fingers = this.scene.input.manager.pointers.filter((p) => p.isDown);
    // Fingers that have lifted no longer count as flipped, so the next touch can flip the mode.
    const live = new Set(fingers.map((f) => f.id));
    for (const id of this.flipped) if (!live.has(id)) this.flipped.delete(id);
    if (this.hidden) {
      // GDD-UI-02: hidden buttons press nothing, the slide stick's area included, and a finger that went down while they were
      // hidden flips nothing, then or later.
      for (const f of fingers) this.flipped.add(f.id);
      if (this.pressed.size > 0 || this.stick !== 0) {
        this.pressed = new Set();
        this.stick = 0;
        this.draw();
      }
      return { move: 0, jumpHeld: false };
    }
    // GDD-UI-02: a finger held back since a pause presses nothing until it lifts.
    const keys = new Set(fingers.map(fingerKey));
    for (const k of this.heldBack) if (!keys.has(k)) this.heldBack.delete(k);
    const active = fingers.filter((f) => !this.heldBack.has(fingerKey(f)));
    // Pointer positions are canvas pixels; the buttons are laid out in game pixels (GDD-ART-01).
    const points = active.map(gamePoint);
    const pressed = pressedButtons(this.buttons, points);
    // A finger that went down on the mode switch flips the zone once. A finger that slid onto it from the stick, or
    // that stays on it, does not.
    const mode = this.buttons.filter((b) => b.id === 'mode');
    const flip = fingers.find((f) => !this.flipped.has(f.id) && pressedButtons(mode, [gamePoint({ x: f.downX, y: f.downY })]).size > 0);
    if (flip) {
      this.flipped.add(flip.id);
      this.setMode(this.mode === 'stick' ? 'buttons' : 'stick');
    }
    const stick = stickMove(this.buttons, points);
    if (pressed.size !== this.pressed.size || [...pressed].some((id) => !this.pressed.has(id)) || stick !== this.stick) {
      this.pressed = pressed;
      this.stick = stick;
      this.draw();
    }
    const effective = new Set(pressed);
    if (effectiveHeld(false, this.jumpLatch)) effective.add('jump');
    if (effectiveHeld(false, this.clawLatch)) effective.add('claw');
    if (effectiveHeld(false, this.fuegoLatch)) effective.add('fuego');
    if (effectiveHeld(false, this.leftLatch)) effective.add('left');
    if (effectiveHeld(false, this.rightLatch)) effective.add('right');
    return touchInput(effective, stick);
  }

  /** GDD-UI-02: the game pauses. A finger down now, pressing or steering before the pause, keeps doing so after it. */
  notePause(): void {
    this.downAtPause = new Set(this.liveFingers().map(fingerKey));
  }

  /**
   * GDD-UI-02: the level goes on after a pause, or starts from the title screen. A finger that went down meanwhile (the tap that
   * resumed, on a button, the Resume row or anywhere) is no game press: no button or stick reads it until it lifts, and the
   * taps latched meanwhile are spent.
   */
  holdBack(): void {
    for (const f of this.liveFingers()) if (!this.downAtPause.has(fingerKey(f))) this.heldBack.add(fingerKey(f));
    this.downAtPause = new Set();
    this.consume();
  }

  private liveFingers(): Phaser.Input.Pointer[] {
    return this.enabled ? this.scene.input.manager.pointers.filter((p) => p.isDown) : [];
  }

  /** A simulation step has used what was read: the taps latched since the last step are spent. */
  consume(): void {
    this.jumpLatch.consume();
    this.clawLatch.consume();
    this.fuegoLatch.consume();
    this.leftLatch.consume();
    this.rightLatch.consume();
  }

  /** Shows or hides the Fuego button (GDD-PWR-03, GDD-CTL-03). */
  setFuego(on: boolean): void {
    if (on === this.fuego || !this.enabled) return;
    this.fuego = on;
    this.relayout();
  }

  /** Hides the buttons on the title screen (GDD-UI-02). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.gfx.setVisible(this.enabled && !hidden);
    this.highlightGfx.setVisible(this.enabled && !hidden);
  }

  /**
   * GDD-UI-05: outlines `button` with the tip's dashed line, `grow` (0 to 1) of the way to its widest, at `alpha`. 'move' is the left
   * and right buttons together, or the slide stick's track. Nothing without touch, for null or while the tip is faded out.
   */
  highlight(button: TouchButtonId | 'move' | null, grow: number, alpha: number): void {
    this.highlightGfx.clear();
    this.highlighted = null;
    if (!this.enabled || button === null || alpha <= 0) return;
    const boxes = this.buttons.filter((b) => (button === 'move' ? b.id === 'left' || b.id === 'right' || b.id === 'stick' : b.id === button));
    if (boxes.length === 0) return;
    const grown = TIPS.marginPx + grow * TIPS.growPx;
    const x0 = Math.min(...boxes.map((b) => b.x)) - grown;
    const y0 = Math.min(...boxes.map((b) => b.y)) - grown;
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + grown;
    const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + grown;
    this.highlightGfx.lineStyle(1, 0xfff3dc, alpha);
    dashedRect(this.highlightGfx, x0, y0, x1 - x0, y1 - y0);
    this.highlighted = button;
  }

  /** Whether a point (in game px) is on the pause button (GDD-UI-02). Always false without touch. */
  isPauseButton(x: number, y: number): boolean {
    return pressedButtons(this.buttons.filter((b) => b.id === 'pause'), [{ x, y }]).size > 0;
  }

  debug(): TouchDebug {
    return { visible: this.enabled && this.gfx.visible, buttons: this.buttons, pressed: this.drawnPressed, mode: this.mode, stick: this.stick, highlighted: this.highlighted };
  }

  private setMode(mode: TouchMode): void {
    this.mode = mode;
    saveMode(mode);
    this.relayout();
  }

  private relayout(): void {
    this.buttons = layoutTouchButtons(this.scene.scale.displaySize.width / BASE_WIDTH, this.mode, this.fuego);
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
      else if (b.id === 'fuego') this.drawFuegoIcon(b, down);
      else if (b.id === 'pause') this.drawPauseIcon(b, down);
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

  /** Placeholder: a flame, a drop with a point, in orange. */
  private drawFuegoIcon(b: TouchButton, down: boolean): void {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const r = b.w * 0.26;
    this.gfx.fillStyle(down ? 0xfff3dc : 0xe8602d, down ? PRESSED_ALPHA : IDLE_ALPHA + 0.35);
    this.gfx.fillCircle(cx, cy + r * 0.3, r * 0.8).fillTriangle(cx - r * 0.7, cy, cx + r * 0.7, cy, cx + r * 0.1, cy - r * 1.4);
  }

  /** Placeholder: two upright bars, the usual pause sign. */
  private drawPauseIcon(b: TouchButton, down: boolean): void {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const h = b.h * 0.44;
    const w = Math.max(2, Math.round(b.w * 0.12));
    this.gfx.fillStyle(down ? 0xe8a33d : 0xfff3dc, down ? PRESSED_ALPHA : IDLE_ALPHA + 0.25);
    this.gfx.fillRect(cx - w * 1.5, cy - h / 2, w, h).fillRect(cx + w * 0.5, cy - h / 2, w, h);
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
