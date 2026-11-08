import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ART_SCALE, ENEMY_ART } from '../../src/config/tuning';
import { ENEMY_LOOKS } from '../../src/ui/enemyLooks';
import { flashed, OUTLINE } from './enemies2/kit.mjs';
import { buildEnemies, enemySheet, KINDS as ALL_KINDS } from './make-enemies.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'enemies');

// GDD-ART-06: World 2's 24 colours, in the GDD's order, the Chapulín's darkened leaf (GDD-ENM-03), the outline, and the telegraph's two reds.
const W2_COLOURS = ['#86BEE0', '#A9D3EA', '#CFE8F1', '#C3C6DE', '#9AA6CD', '#7C86B5', '#E6C2B8', '#C99A9E', '#E4CC9E', '#4E4A78', '#E07A52', '#C45E3E', '#8A3B30', '#F2B0A6', '#E07F8E', '#B85E6E', '#1C3F9E', '#F4EFE2', '#E9B53F', '#D9327E', '#2AA198', '#4F8F4C', '#3B2B3C', '#7E5A3E'];
const LEAF = '#3E7A3C';
const OLD_GREEN = '#4F8F4C';
const IRON = '#3B2B3C';
const BLACK = '#070509';
const FLASH_RED = '#D8473A';
const FLASH_SHADE = '#A0472F';
const GLAZE = '#F4EFE2';
const KINDS = Object.fromEntries(Object.entries(ALL_KINDS).filter(([name]) => ['paloma', 'chapulin', 'trompo'].includes(name)));
// Drawing the frames takes a moment, so they are drawn once.
const FRAMES = Object.fromEntries(Object.entries(KINDS).map(([name, m]) => [name, m.drawFrames()]));
const frame = (kind, look) => FRAMES[kind].find((f) => f.look === look).grid;
const all = () => Object.entries(FRAMES).flatMap(([kind, frames]) => frames.map((f) => ({ kind, look: f.look, grid: f.grid })));
const row = (grid, y) => Array.from({ length: grid.width }, (_, x) => grid.get(x, y));
const column = (grid, x) => Array.from({ length: grid.height }, (_, y) => grid.get(x, y));
/** The painted cells that are not the outline and have an empty 4-neighbour, one outside the frame counting as empty (boss.test.mjs). */
function bare(grid) {
  const off = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const c = grid.get(x, y);
      if (c === null || c === OUTLINE) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid.get(x + dx, y + dy) === null)) off.push(`${x},${y}`);
    }
  }
  return off;
}
// The frames that stand on the ground: their feet on the frame's bottom row (the Trompo's tip or its side, in every frame).
const STANDING = {
  paloma: /^(walk|tele|squash|hit)/,
  chapulin: /^(crouch|tele|squash|hit)/,
  trompo: /./,
};

describe('GDD-ENM-03 World 2\'s enemy sprites', { timeout: 60_000 }, () => {
  it('GDD-ENM-03 the committed PNGs are the ones the script makes', () => {
    const built = buildEnemies();
    for (const name of ['paloma.png', 'chapulin.png', 'trompo.png']) {
      expect(Object.keys(built), name).toContain(name);
      expect(built[name].equals(readFileSync(join(dir, name))), name).toBe(true);
    }
  });

  it('GDD-ENM-03 each sheet is one row of its frames, in the order the game picks them', () => {
    expect(Object.keys(KINDS)).toEqual(['paloma', 'chapulin', 'trompo']);
    for (const [kind, m] of Object.entries(KINDS)) {
      expect(m.LOOKS, kind).toEqual([...ENEMY_LOOKS[kind]]);
      expect(FRAMES[kind].map((f) => f.look), kind).toEqual(m.LOOKS);
      const s = enemySheet(m, FRAMES[kind]);
      expect([s.width, s.height], kind).toEqual([m.LOOKS.length * ENEMY_ART.frames[kind].w * ART_SCALE, ENEMY_ART.frames[kind].h * ART_SCALE]);
      expect(s.width, kind).toBeLessThanOrEqual(4096); // L-068
    }
    expect(KINDS.paloma.LOOKS).toHaveLength(13);
    expect(enemySheet(KINDS.paloma, FRAMES.paloma).width).toBe(1248);
  });

  it('GDD-ENM-03 the frame sizes the scene loads are each module\'s FRAME in game px', () => {
    for (const [kind, m] of Object.entries(KINDS)) expect(ENEMY_ART.frames[kind], kind).toEqual({ w: m.FRAME.w / 2, h: m.FRAME.h / 2 });
    expect(ENEMY_ART.frames.paloma).toEqual({ w: 24, h: 20 });
    expect(ENEMY_ART.frames.chapulin).toEqual({ w: 20, h: 16 });
    expect(ENEMY_ART.frames.trompo).toEqual({ w: 20, h: 20 });
  });

  it('GDD-ART-06 World 2\'s enemies use only World 2\'s colours, the Chapulín\'s leaf, the outline and the telegraph red', () => {
    const plain = [...W2_COLOURS, LEAF, BLACK];
    for (const { kind, look, grid } of all()) {
      expect([grid.width, grid.height], `${kind} ${look}`).toEqual([KINDS[kind].FRAME.w, KINDS[kind].FRAME.h]);
      const reds = look === 'teleRed' ? [FLASH_RED, FLASH_SHADE] : [];
      for (const c of new Set(grid.cells.filter((c) => c !== null))) expect([...plain, ...reds], `${kind} ${look} ${c}`).toContain(c);
    }
    expect(OUTLINE).toBe(BLACK);
    // The flash reds are used in the teleRed frames, and only there.
    for (const kind of ['paloma', 'chapulin']) expect(new Set(frame(kind, 'teleRed').cells), kind).toContain(FLASH_RED);
  });

  it('GDD-ART-05 every World 2 frame has a 1 px outline', () => {
    for (const { kind, look, grid } of all()) expect(bare(grid), `${kind} ${look}`).toEqual([]);
  });

  it('GDD-ART-05 nothing is cut off by a frame\'s edge, and standing frames have their feet on the bottom row', () => {
    for (const { kind, look, grid } of all()) {
      const name = `${kind} ${look}`;
      expect(row(grid, 0).filter(Boolean), `${name} top`).toEqual([]);
      expect(column(grid, 0).filter(Boolean), `${name} left`).toEqual([]);
      expect(column(grid, grid.width - 1).filter(Boolean), `${name} right`).toEqual([]);
      const bottom = row(grid, grid.height - 1).filter(Boolean);
      if (STANDING[kind].test(look)) {
        expect(bottom.length, `${name} feet`).toBeGreaterThan(0);
        expect(new Set(bottom), `${name} feet`).toEqual(new Set([OUTLINE]));
      } else expect(KINDS[kind].BOX.y1, `${name}: nothing below the box (frame bottom = box bottom)`).toBe(grid.height);
    }
  });

  it('GDD-ENM-01 the red telegraph is the telegraph flashed', () => {
    for (const kind of ['paloma', 'chapulin']) expect(frame(kind, 'teleRed').cells, kind).toEqual(flashed(frame(kind, 'tele')).cells);
  });

  it('GDD-CMB-01 the spinning Trompo carries three pale points on its crown, and nothing else does', () => {
    // The columns over the middle half of the box whose topmost colour (the outline aside) is the glaze white.
    const points = (kind, look) => {
      const grid = frame(kind, look);
      const { x0, x1 } = KINDS[kind].BOX;
      const quarter = (x1 - x0) / 4;
      let n = 0;
      for (let x = Math.ceil(x0 + quarter); x < x1 - quarter; x++) {
        for (let y = 0; y < grid.height; y++) {
          const c = grid.get(x, y);
          if (c === null || c === OUTLINE) continue;
          if (c === GLAZE) n++;
          break;
        }
      }
      return n;
    };
    for (const look of ['spin0', 'spin1', 'spin2', 'spin3']) expect(points('trompo', look), `trompo ${look}`).toBeGreaterThanOrEqual(3);
    for (const look of ['stun', 'stunWobble', 'squash']) expect(points('trompo', look), `trompo ${look}`).toBe(0);
    expect(points('paloma', 'walk0'), 'paloma walk0').toBe(0);
    expect(points('chapulin', 'crouch0'), 'chapulin crouch0').toBe(0);
    // The tacks stand on the crown, never in the face: every glaze pixel of a spin frame is above the box's top + 4 drawing px.
    const { y0 } = KINDS.trompo.BOX;
    for (const look of ['spin0', 'spin1', 'spin2', 'spin3']) {
      const grid = frame('trompo', look);
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) === GLAZE) expect(y, `trompo ${look} glaze at ${x},${y}`).toBeLessThan(y0 + 4);
    }
  });

  it('GDD-ENM-03 the Chapulín stays leaf green', () => {
    // The most-painted colour other than the outline and the dark iron of its shadows and legs (#3B2B3C, which has 104 pixels to the
    // leaf's 90 in crouch0): the leaf, not the lighter green it was darkened from (GDD-ENM-03, Open Question 34).
    const grid = frame('chapulin', 'crouch0');
    const count = new Map();
    for (const c of grid.cells) if (c && c !== OUTLINE && c !== IRON) count.set(c, (count.get(c) ?? 0) + 1);
    const [top] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    expect(top).toBe(LEAF);
    expect(count.get(LEAF)).toBeGreaterThan(count.get(OLD_GREEN));
  });

  // L-059: the frames of assets/sprites/enemies/; scripts/art/enemies2.levels.test.mjs fits them over the real levels.
  it('GDD-ENM-03 each kind reaches past its box exactly as far as ENEMY_ART.reach says (L-059)', () => {
    // Over every frame of the kind, facing right: how far its painted pixels (the outline included) stand behind, in front of, above and
    // below its box, in game px (a drawing pixel is half a game px).
    for (const kind of ['paloma', 'chapulin', 'trompo']) {
      const { BOX } = KINDS[kind];
      const reach = { behind: 0, front: 0, above: 0, below: 0 };
      for (const look of KINDS[kind].LOOKS) {
        const grid = frame(kind, look);
        for (let y = 0; y < grid.height; y++) {
          for (let x = 0; x < grid.width; x++) {
            if (grid.get(x, y) === null) continue;
            reach.behind = Math.max(reach.behind, (BOX.x0 - x) / 2);
            reach.front = Math.max(reach.front, (x + 1 - BOX.x1) / 2);
            reach.above = Math.max(reach.above, (BOX.y0 - y) / 2);
            reach.below = Math.max(reach.below, (y + 1 - BOX.y1) / 2);
          }
        }
      }
      expect(reach, kind).toEqual(ENEMY_ART.reach[kind]);
    }
  });

  it('GDD-ENM-03 the body fills at least half the hit box, so hits are fair', () => {
    for (const [kind, look] of [['paloma', 'walk0'], ['chapulin', 'crouch0'], ['trompo', 'spin0']]) {
      const { x0, y0, x1, y1 } = KINDS[kind].BOX;
      const grid = frame(kind, look);
      let painted = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (grid.get(x, y) !== null) painted++;
      expect(painted / ((x1 - x0) * (y1 - y0)), `${kind} ${look}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('GDD-ENM-03 each box sits on the frame\'s bottom middle', () => {
    for (const [kind, { FRAME, BOX }] of Object.entries(KINDS)) {
      expect((BOX.x0 + BOX.x1) / 2, kind).toBe(FRAME.w / 2);
      expect(BOX.y1, kind).toBe(FRAME.h);
    }
  });

  // Rules the placeholder shapes' tests pinned (src/ui/mercadoEnemies.test.ts, removed with them), now on the drawings.
  it('GDD-ART-06 the Chapulín\'s leaf is at least 15 L* from World 2\'s pink plaster', () => {
    // CIE L* of an sRGB colour, as the art guide measures it (GDD-ART-03); the plaster is #E07F8E, its lit pink.
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const lightness = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
    };
    expect(Math.abs(lightness(LEAF) - lightness('#E07F8E'))).toBeGreaterThanOrEqual(15);
  });

  it('GDD-ENM-03 the stunned Trompo lies on its side, wider than tall and lower than the spinning one, and rocks in stunWobble', () => {
    const size = (grid) => {
      let [x0, y0, x1, y1] = [grid.width, grid.height, -1, -1];
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) !== null) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    const lying = size(frame('trompo', 'stun'));
    expect(lying.w).toBeGreaterThan(lying.h);
    expect(size(frame('trompo', 'spin0')).h).toBeGreaterThan(lying.h);
    expect(frame('trompo', 'stunWobble').cells).not.toEqual(frame('trompo', 'stun').cells);
  });

  it('GDD-ENM-03 the spinning Trompo\'s four frames are all different, so it turns', () => {
    const cells = ['spin0', 'spin1', 'spin2', 'spin3'].map((look) => frame('trompo', look).cells.join());
    expect(new Set(cells).size).toBe(4);
  });
});
