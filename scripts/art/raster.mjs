// A pixel grid and the shapes the art scripts draw with (GDD-ART-01, GDD-ART-05).
// Shapes are tests on a pixel's centre, in art pixels; later layers paint over earlier ones.

export const ellipse = (cx, cy, rx, ry, rot = 0) => (x, y) => {
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dy = y - cy;
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
};

export const polygon = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

function segmentDistance(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** A thick line through `pts`, `width` art pixels across. */
export const stroke = (pts, width) => (x, y) => pts.slice(1).some((p, i) => segmentDistance(x, y, pts[i], p) <= width / 2);

export const rect = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
export const and = (...tests) => (x, y) => tests.every((t) => t(x, y));
export const or = (...tests) => (x, y) => tests.some((t) => t(x, y));
export const not = (test) => (x, y) => !test(x, y);

export function hexToRgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(null);
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height ? this.cells[y * this.width + x] : null;
  }

  set(x, y, colour) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y * this.width + x] = colour;
  }

  /** Paints every pixel whose centre passes `test` (and is already painted, when `onlyPainted`). */
  fill(test, colour, onlyPainted = false) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (onlyPainted && this.get(x, y) === null) continue;
        if (test(x + 0.5, y + 0.5)) this.set(x, y, colour);
      }
    }
  }

  /** Recolours painted pixels of colour `from` that pass `test`. */
  recolour(from, to, test = () => true) {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.get(x, y) === from && test(x + 0.5, y + 0.5)) this.set(x, y, to);
  }

  /** A ring `thickness` pixels wide around everything painted, on the outside only (GDD-ART-05). */
  outline(colour, thickness) {
    for (let pass = 0; pass < thickness; pass++) {
      const add = [];
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (this.get(x, y) !== null) continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) !== null)) add.push([x, y]);
        }
      }
      for (const [x, y] of add) this.set(x, y, colour);
    }
  }

  /** Mirrors left to right, for the frames facing left. */
  flipped() {
    const g = new Grid(this.width, this.height);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) g.set(this.width - 1 - x, y, this.get(x, y));
    return g;
  }

  toRgba() {
    const out = new Uint8Array(this.width * this.height * 4);
    this.cells.forEach((c, i) => {
      if (c) out.set(hexToRgba(c), i * 4);
    });
    return out;
  }
}
