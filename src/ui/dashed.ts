// GDD-UI-05: the dashed outline of a tip's highlight, drawn on a Phaser graphics object by the level and by the touch buttons.
import type Phaser from 'phaser';
import { TIPS } from '../config/tuning';

/** Strokes the rectangle's four sides in dashes (`TIPS.dashPx` long, `TIPS.gapPx` apart) with the graphics' current line style. */
export function dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  const side = (x0: number, y0: number, dx: number, dy: number, length: number) => {
    for (let at = 0; at < length; at += TIPS.dashPx + TIPS.gapPx) {
      const to = Math.min(at + TIPS.dashPx, length);
      g.lineBetween(x0 + dx * at, y0 + dy * at, x0 + dx * to, y0 + dy * to);
    }
  };
  side(x, y, 1, 0, w);
  side(x + w, y, 0, 1, h);
  side(x + w, y + h, -1, 0, w);
  side(x, y + h, 0, -1, h);
}
