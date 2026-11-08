import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FX_MOUTH, HELD_HAND, ITEM_FRAMES, SWIPE_BOX } from '../../../src/ui/ponchoFrames';
import { ITEM_LOOKS, ITEM_SHEETS } from '../../../src/ui/ponchoLooks';
import { CLAW } from '../../../src/config/tuning';
import { buildItems, ITEM_SHEETS as MODULES, itemSheet } from '../make-poncho-items.mjs';
import { COLOURS } from '../poncho-pixels.mjs';
import { ITEM_COLOURS } from './items.mjs';
import { check } from './rig.mjs';

// GDD-ART-04, GDD-PWR-02, GDD-PWR-03, GDD-CMB-02: the taco, the chile, what Poncho holds, the claw swipe and the effects at his mouth.
// L-059: the frames of assets/sprites/poncho/ are placed by his frames' anchors (his own sheet's pins are in scripts/art/poncho.test.mjs);
// none of them stands on the ground but the walking taco, and scripts/art/poncho.levels.test.mjs fits his frames over the real levels.
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'sprites', 'poncho');
const PALETTE = [...Object.values(COLOURS), ...Object.values(ITEM_COLOURS)];
// Drawing the frames takes a moment, so they are drawn once.
const FRAMES = Object.fromEntries(Object.entries(MODULES).map(([name, m]) => [name, m.draw()]));
const all = () => Object.entries(FRAMES).flatMap(([sheet, frames]) => frames.map((f) => ({ sheet, look: f.look, grid: f.grid })));

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
    expect(Object.keys(built).sort()).toEqual(['chile.png', 'fx.png', 'held.png', 'swipe.png', 'taco.png']);
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

  it('GDD-ART-03 the items add at most 3 colours to his 13: 15 of the 16 used', () => {
    expect(Object.keys(ITEM_COLOURS).length).toBeLessThanOrEqual(3);
    expect(new Set(PALETTE).size).toBe(15);
    for (const { sheet, look, grid } of all()) {
      const off = new Set(grid.cells.filter((c) => c !== null && !PALETTE.includes(c)));
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
      if (sheet === 'swipe') continue;
      const g = MODULES[sheet].draw().find((f) => f.look === look).grid;
      if (CHILES.has(look)) for (const [x, y] of glowOf(g)) g.set(x, y, null);
      expect(check(g, { palette: PALETTE }), `${sheet} ${look}`).toEqual([]);
      if (!CHILES.has(look)) expect(glowOf(grid), `${sheet} ${look} has no glow`).toEqual([]);
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
