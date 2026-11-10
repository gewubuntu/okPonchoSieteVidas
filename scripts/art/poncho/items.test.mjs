import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FX_MOUTH, HELD_HAND, ITEM_FRAMES, SWIPE_BOX } from '../../../src/ui/ponchoFrames';
import { ITEM_LOOKS, ITEM_SHEETS } from '../../../src/ui/ponchoLooks';
import { CLAW, PONCHO_ART, TACO } from '../../../src/config/tuning';
import { glowColour } from '../../../src/ui/fantasmaGlow';
import { itemAt } from '../../../src/ui/ponchoPose';
import { buildItems, ITEM_SHEETS as MODULES, itemSheet } from '../make-poncho-items.mjs';
import { COLOURS } from '../poncho-pixels.mjs';
import { FANTASMA_COLOURS, GOLD, ITEM_COLOURS } from './items.mjs';
import { VICTORY_COLOURS } from './victory.mjs';
import { check } from './rig.mjs';

// GDD-ART-04, GDD-PWR-02, GDD-PWR-03, GDD-CMB-02: the taco, the chile, what Poncho holds, the claw swipe and the effects at his mouth.
// L-059: the frames of assets/sprites/poncho/ are placed by his frames' anchors (his own sheet's pins are in scripts/art/poncho.test.mjs);
// none of them stands on the ground but the walking taco, and scripts/art/poncho.levels.test.mjs fits his frames over the real levels.
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'sprites', 'poncho');
const PALETTE = [...Object.values(COLOURS), ...Object.values(ITEM_COLOURS)];
// Drawing the frames takes a moment, so they are drawn once.
const FRAMES = Object.fromEntries(Object.entries(MODULES).map(([name, m]) => [name, m.draw()]));
const all = () => Object.entries(FRAMES).flatMap(([sheet, frames]) => frames.map((f) => ({ sheet, look: f.look, grid: f.grid })));
// GDD-PWR-04: the Chile Fantasma's pepper and its glow's effects are the only ones that use the three added colours (GDD-ART-03).
const FANTASMA_SHEETS = new Set(['fantasma', 'glow']);
const OUTLINE_COLOUR = COLOURS['#'];
const PALETTE_FANTASMA = [...PALETTE, ...Object.values(FANTASMA_COLOURS), GOLD];

/**
 * The chile's glow: the fur-orange ring round its outline and the wisps of heat, which lie outside the outline (GDD-ART-05 is to allow
 * them as a glow). Every fur-orange pixel reached from the frame's edge through empty and fur-orange pixels only.
 */
function glowOf(grid) {
  const seen = new Set();
  const stack = [];
  for (let x = 0; x < grid.width; x++) stack.push([x, 0], [x, grid.height - 1]);
  for (let y = 0; y < grid.height; y++) stack.push([0, y], [grid.width - 1, y]);
  const glow = [];
  while (stack.length) {
    const [x, y] = stack.pop();
    const k = y * grid.width + x;
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height || seen.has(k)) continue;
    const c = grid.get(x, y);
    if (c !== null && c !== COLOURS.f) continue;
    seen.add(k);
    if (c === COLOURS.f) glow.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stack.push([x + dx, y + dy]);
  }
  return glow;
}
const CHILES = new Set(['chileBob0', 'chileBob1', 'chileBob2', 'chileBob3', 'chileGlint', 'chileHeld', 'chileFood']);

describe('GDD-ART-04 the taco, the chile, the held items, the claw swipe and the effects', { timeout: 60_000 }, () => {
  it('GDD-ART-04 the committed PNGs are the ones the script makes', () => {
    const built = buildItems();
    expect(Object.keys(built).sort()).toEqual(['chile.png', 'fantasma.png', 'fx.png', 'glow.png', 'held.png', 'swipe.png', 'taco.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
  });

  it('GDD-ART-04 each sheet is one row of its frames, in the order the game picks them', () => {
    expect(Object.keys(MODULES)).toEqual([...ITEM_SHEETS]);
    for (const [name, m] of Object.entries(MODULES)) {
      expect(m.LOOKS, name).toEqual([...ITEM_LOOKS[name]]);
      expect(FRAMES[name].map((f) => f.look), name).toEqual(m.LOOKS);
      expect(ITEM_FRAMES[name], name).toEqual(m.FRAME);
      const s = itemSheet(m, FRAMES[name]);
      expect([s.width, s.height], name).toEqual([m.LOOKS.length * m.FRAME.w * 2, m.FRAME.h * 2]);
    }
  });

  it('GDD-ART-04 the anchors the game places them by are the drawings\'', () => {
    expect(HELD_HAND).toEqual(MODULES.held.HAND);
    expect(SWIPE_BOX).toEqual(MODULES.swipe.BOX);
    expect(FX_MOUTH).toEqual(MODULES.fx.MOUTH);
    // GDD-CMB-02: the swipe's box is the claw's, 20 x 32 game px, its bottom row on his feet (the frame's bottom row).
    expect([(SWIPE_BOX.x1 - SWIPE_BOX.x0) / 2, (SWIPE_BOX.y1 - SWIPE_BOX.y0) / 2]).toEqual([CLAW.reach, CLAW.height]);
    expect(SWIPE_BOX.y1).toBe(MODULES.swipe.FRAME.h);
    // Its box is as far in from the frame's right as from its left, so mirrored for a swipe to the left it lies the same way (ponchoParts).
    expect(MODULES.swipe.FRAME.w - SWIPE_BOX.x1).toBe(SWIPE_BOX.x0);
  });

  it('GDD-ART-03 the items add 2 colours to his 13 (the victory\'s gold makes 16, poncho.test.mjs)', () => {
    expect(Object.keys(ITEM_COLOURS)).toHaveLength(2);
    expect(new Set(PALETTE).size).toBe(15);
    for (const { sheet, look, grid } of all()) {
      if (FANTASMA_SHEETS.has(sheet)) continue;
      const off = new Set(grid.cells.filter((c) => c !== null && !PALETTE.includes(c)));
      expect([...off], `${sheet} ${look}`).toEqual([]);
    }
  });

  it('GDD-ART-03 the fantasma and glow sheets add the pale lavender-white, the lavender shade and the pale gold to the gold he has', () => {
    // The cap is 19 for them alone (user, 2026-11-10); the gold is the victory frame's. Measured on the user's references (L-072).
    expect(FANTASMA_COLOURS).toEqual({ l: '#E4E9FC', v: '#BEC3F7', P: '#D3C193' });
    expect(GOLD).toBe(VICTORY_COLOURS.y);
    expect(new Set([...PALETTE, ...Object.values(FANTASMA_COLOURS), GOLD]).size).toBe(19);
    for (const { sheet, look, grid } of all()) {
      if (!FANTASMA_SHEETS.has(sheet)) continue;
      const off = new Set(grid.cells.filter((c) => c !== null && !PALETTE_FANTASMA.includes(c)));
      expect([...off], `${sheet} ${look}`).toEqual([]);
    }
  });

  it('GDD-ART-05 every frame is its FRAME in size and clear of the frame\'s edges', () => {
    for (const { sheet, look, grid } of all()) {
      const { w, h } = MODULES[sheet].FRAME;
      expect([grid.width, grid.height], `${sheet} ${look}`).toEqual([w, h]);
      const edge = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid.get(x, y) && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) edge.push(`${x},${y}`);
      expect(edge, `${sheet} ${look}`).toEqual([]);
    }
  });

  it('GDD-ART-05 the pickups, the held items and the effects are outlined, the chile\'s glow ring and wisps aside', () => {
    // The claw swipe is a smear of light with a crimson edge, not an outlined thing (GDD-ART-05 names characters, enemies, items and
    // pickups), so only its colours and its frame are checked above.
    for (const { sheet, look, grid } of all()) {
      // The glow's sparkles, flames and streaks are plain gold, not outlined things, like the swipe; the pepper is outlined and glows (below).
      if (sheet === 'swipe' || sheet === 'glow' || sheet === 'fantasma') continue;
      const g = MODULES[sheet].draw().find((f) => f.look === look).grid;
      if (CHILES.has(look)) for (const [x, y] of glowOf(g)) g.set(x, y, null);
      expect(check(g, { palette: PALETTE }), `${sheet} ${look}`).toEqual([]);
      if (!CHILES.has(look)) expect(glowOf(grid), `${sheet} ${look} has no glow`).toEqual([]);
    }
  });

  // L-059: the taco and chile frames of assets/sprites/poncho/ (taco.png, chile.png); scripts/art/poncho/items.levels.test.mjs fits them over
  // the real levels.
  it('GDD-ART-04 the taco and chile frames reach past their square exactly as far as PONCHO_ART.pickup.reach says (L-059)', () => {
    // The 12 px square (GDD-PWR-06) with its middle on the frame's middle; how far the painted pixels stand past it, in game px.
    const half = TACO.size; // drawing px
    for (const kind of ['taco', 'chile']) {
      const { w, h } = MODULES[kind].FRAME;
      const box = { x0: w / 2 - half, x1: w / 2 + half, y0: h / 2 - half, y1: h / 2 + half };
      const reach = { behind: 0, front: 0, above: 0, below: 0 };
      for (const { grid } of FRAMES[kind]) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (grid.get(x, y) === null) continue;
          reach.behind = Math.max(reach.behind, (box.x0 - x) / 2);
          reach.front = Math.max(reach.front, (x + 1 - box.x1) / 2);
          reach.above = Math.max(reach.above, (box.y0 - y) / 2);
          reach.below = Math.max(reach.below, (y + 1 - box.y1) / 2);
        }
      }
      expect(reach, kind).toEqual(PONCHO_ART.pickup.reach[kind]);
    }
  });

  it('GDD-ART-04 a taco or chile standing on its feet is placed so no frame reaches below them (L-059)', () => {
    for (const kind of ['taco', 'chile']) {
      const { w, h } = MODULES[kind].FRAME;
      const at = itemAt(kind, 100, 200);
      expect(at.x).toBe(100);
      let lowest = -Infinity;
      for (const { grid } of FRAMES[kind]) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid.get(x, y) !== null) lowest = Math.max(lowest, at.y + (y + 1 - h / 2) / 2);
      }
      // The lowest painted pixel's bottom edge, over every frame: on the feet, not below and not floating.
      expect(lowest, kind).toBe(200);
    }
  });

  it('GDD-PWR-03 the chile glows: a fur-orange ring outside its outline', () => {
    for (const look of CHILES) {
      const sheet = look.startsWith('chileBob') || look === 'chileGlint' ? 'chile' : 'held';
      const grid = FRAMES[sheet].find((f) => f.look === look).grid;
      expect(glowOf(grid).length, look).toBeGreaterThan(10);
    }
  });
});

describe('GDD-PWR-04 the Chile Fantasma pickup (assets/characters/poncho/fantasma/pickup.jpg)', () => {
  const PEPPER = FRAMES.fantasma;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  /** The pepper with its gold (the glow ring and the sparkles) taken out: what is left must be an ordinary outlined drawing. */
  const withoutGold = (grid) => {
    const g = MODULES.fantasma.draw().find((f) => f.look === grid.look).grid;
    for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === GOLD) g.cells[i] = null;
    return g;
  };

  it('GDD-PWR-04 the fantasma frames bob down: each one\'s lowest outline pixel is lower than the one before\'s', () => {
    const lowest = PEPPER.map(({ grid }) => {
      let low = -1;
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) === OUTLINE_COLOUR) low = y;
      return low;
    });
    expect(lowest).toHaveLength(3);
    expect(lowest[1]).toBeGreaterThan(lowest[0]);
    expect(lowest[2]).toBeGreaterThan(lowest[1]);
  });

  it('GDD-PWR-04 the pepper is outlined in near-black, its colours are the lavender ones, the leaf greens and the face; its gold ring and sparkles lie outside', () => {
    for (const f of PEPPER) {
      const g = withoutGold(f);
      expect(check(g, { palette: PALETTE_FANTASMA }), f.look).toEqual([]);
      const used = new Set(g.cells.filter((c) => c !== null));
      for (const c of [FANTASMA_COLOURS.l, FANTASMA_COLOURS.v, ITEM_COLOURS.g, ITEM_COLOURS.G, COLOURS['#']]) expect(used.has(c), `${f.look} ${c}`).toBe(true);
    }
  });

  it('GDD-PWR-04 the pepper has a gold outline outside its near-black one, closed all round', () => {
    for (const { look, grid } of PEPPER) {
      let outline = 0;
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        if (grid.get(x, y) !== COLOURS['#']) continue;
        outline++;
        for (const [dx, dy] of N4) expect(grid.get(x + dx, y + dy), `${look} ${x},${y} open to ${dx},${dy}`).not.toBeNull();
      }
      expect(outline, look).toBeGreaterThan(40);
    }
  });

  it('GDD-PWR-04 each frame has two or three gold sparkles clear of the pepper', () => {
    for (const { look, grid } of PEPPER) {
      // Gold pixels not touching the pepper's near-black outline: the sparkles, as clumps of them.
      const seen = new Set();
      let sparkles = 0;
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        if (grid.get(x, y) !== GOLD || seen.has(`${x},${y}`)) continue;
        const clump = [[x, y]];
        seen.add(`${x},${y}`);
        for (let k = 0; k < clump.length; k++) for (const [dx, dy] of [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const [cx, cy] = [clump[k][0] + dx, clump[k][1] + dy];
          if (grid.get(cx, cy) === GOLD && !seen.has(`${cx},${cy}`)) { seen.add(`${cx},${cy}`); clump.push([cx, cy]); }
        }
        if (!clump.some(([cx, cy]) => N4.some(([dx, dy]) => grid.get(cx + dx, cy + dy) === COLOURS['#']))) sparkles++;
      }
      expect(sparkles, look).toBeGreaterThanOrEqual(2);
      expect(sparkles, look).toBeLessThanOrEqual(3);
    }
  });

  it('GDD-PWR-04 no fantasma frame is cut off by its frame\'s edge (L-059)', () => {
    for (const { look, grid } of [...PEPPER, ...FRAMES.glow]) {
      for (let i = 0; i < grid.cells.length; i++) {
        if (grid.cells[i] === null) continue;
        const x = i % grid.width, y = Math.floor(i / grid.width);
        expect(x > 0 && y > 0 && x < grid.width - 1 && y < grid.height - 1, `${look} ${x},${y}`).toBe(true);
      }
    }
  });

  it('GDD-PWR-04 each fantasma frame reaches past its 12 px square exactly as far as pinned, and PONCHO_ART.pickup.reach.fantasma is the most (L-059)', () => {
    const { w, h } = MODULES.fantasma.FRAME;
    const half = TACO.size;
    const box = { x0: w / 2 - half, x1: w / 2 + half, y0: h / 2 - half, y1: h / 2 + half };
    const reachOf = (grid) => {
      const r = { behind: 0, front: 0, above: 0, below: 0 };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (grid.get(x, y) === null) continue;
        r.behind = Math.max(r.behind, (box.x0 - x) / 2);
        r.front = Math.max(r.front, (x + 1 - box.x1) / 2);
        r.above = Math.max(r.above, (box.y0 - y) / 2);
        r.below = Math.max(r.below, (y + 1 - box.y1) / 2);
      }
      return r;
    };
    expect(PEPPER.map((f) => reachOf(f.grid))).toEqual([
      { behind: 0.5, front: 1, above: 1.5, below: 0 },
      { behind: 0, front: 0.5, above: 0.5, below: 0.5 },
      { behind: 0.5, front: 0.5, above: 0, below: 1.5 },
    ]);
    expect(PONCHO_ART.pickup.reach.fantasma).toEqual({ behind: 0.5, front: 1, above: 1.5, below: 1.5 });
  });

  it('GDD-PWR-04 the Chile Fantasma standing on its feet is placed so no frame reaches below them (L-059)', () => {
    const { h } = MODULES.fantasma.FRAME;
    const at = itemAt('fantasma', 100, 200);
    expect(at.x).toBe(100);
    let lowest = -Infinity;
    for (const { grid } of PEPPER) {
      for (let y = 0; y < h; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) !== null) lowest = Math.max(lowest, at.y + (y + 1 - h / 2) / 2);
    }
    expect(lowest).toBe(200);
  });
});

describe('GDD-PWR-04 the glow\'s effects (assets/characters/poncho/fantasma/glow.jpg)', () => {
  it('GDD-PWR-04 the game tints his glow in the sheet\'s own golds', () => {
    expect(glowColour('bright')).toBe(GOLD);
    expect(glowColour('dim')).toBe(FANTASMA_COLOURS.P);
  });

  it('GDD-PWR-04 the glow sheet is a four-pointed star, a plus, a flame and a streak, in gold and at most the pale gold', () => {
    expect(FRAMES.glow.map((f) => f.look)).toEqual(['sparkleStar', 'sparklePlus', 'flame', 'streak']);
    expect(MODULES.glow.FRAME).toEqual({ w: 16, h: 16 });
    for (const { look, grid } of FRAMES.glow) {
      const used = new Set(grid.cells.filter((c) => c !== null));
      expect(used.has(GOLD), look).toBe(true);
      for (const c of used) expect([GOLD, FANTASMA_COLOURS.P], `${look} ${c}`).toContain(c);
    }
  });
});
