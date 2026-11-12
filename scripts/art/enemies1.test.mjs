import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ART_SCALE, ENEMY_ART } from '../../src/config/tuning';
import { ENEMY_LOOKS } from '../../src/ui/enemyLooks';
import { flashed, OUTLINE, W1, WORLD_1 } from './enemies1/kit.mjs';
import { buildEnemies, enemySheet, KINDS as ALL_KINDS } from './make-enemies.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'enemies');

// GDD-ART-06: the 24 colours of World 1, in the GDD's order (the same list as desert.test.mjs and boss.test.mjs).
const W1_COLOURS = ['#E39A48', '#EDB15A', '#F4C66E', '#F9DA8E', '#FFF6D0', '#FFD25A', '#FFF4DC', '#E9B98A', '#8E6A96', '#A65B5B', '#4D5A9C', '#3A4580', '#9CC24E', '#6FA03A', '#4E7A2C', '#F4D29C', '#E8B87A', '#D19A5E', '#A0472F', '#7A3326', '#D8473A', '#F08A3C', '#6F9C8E', '#2F5A3A'];
const PALE = [W1.cloudTop, W1.sunDisc];
// World 1's kinds and the poof; World 2's three are checked by enemies2.test.mjs and World 3's Murciélago by enemies3.test.mjs.
const KINDS = Object.fromEntries(Object.entries(ALL_KINDS).filter(([name]) => !['paloma', 'chapulin', 'trompo', 'murcielago', 'armadillo'].includes(name)));
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
// The frames a ground walker shows standing on the ground: its feet on the frame's bottom row.
const STANDING = /^(walk|tele|doze|peek|alarm|dead|squash)/;
const WALKERS = ['alacran', 'cactus', 'tlacuache'];

describe('GDD-ENM-02 World 1\'s enemy sprites', { timeout: 60_000 }, () => {
  it('GDD-ENM-02 the committed PNGs are the ones the script makes', () => {
    const built = buildEnemies();
    expect(Object.keys(built).sort()).toEqual(['alacran.png', 'armadillo.png', 'cactus.png', 'chapulin.png', 'murcielago.png', 'paloma.png', 'poof.png', 'tlacuache.png', 'trompo.png', 'zopilote.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
  });

  it('GDD-ENM-02 each sheet is one row of its frames, in the order the game picks them', () => {
    for (const [kind, m] of Object.entries(KINDS)) {
      expect(m.LOOKS, kind).toEqual([...ENEMY_LOOKS[kind]]);
      expect(FRAMES[kind].map((f) => f.look), kind).toEqual(m.LOOKS);
      const s = enemySheet(m, FRAMES[kind]);
      expect([s.width, s.height], kind).toEqual([m.LOOKS.length * ENEMY_ART.frames[kind].w * ART_SCALE, ENEMY_ART.frames[kind].h * ART_SCALE]);
    }
  });

  it('GDD-ENM-02 the frame sizes the scene loads are each module\'s FRAME in game px', () => {
    for (const [kind, m] of Object.entries(KINDS)) expect(ENEMY_ART.frames[kind], kind).toEqual({ w: m.FRAME.w / 2, h: m.FRAME.h / 2 });
    expect(ENEMY_ART.frames).toMatchObject({ alacran: { w: 24, h: 16 }, zopilote: { w: 32, h: 24 }, cactus: { w: 16, h: 24 }, tlacuache: { w: 28, h: 16 }, poof: { w: 24, h: 24 } });
  });

  it('GDD-ART-06 every frame is its FRAME in size and uses only World 1\'s colours and the outline', () => {
    expect(WORLD_1).toEqual(W1_COLOURS);
    for (const { kind, look, grid } of all()) {
      expect([grid.width, grid.height], `${kind} ${look}`).toEqual([KINDS[kind].FRAME.w, KINDS[kind].FRAME.h]);
      for (const c of new Set(grid.cells.filter((c) => c !== null))) expect([...W1_COLOURS, OUTLINE], `${kind} ${look} ${c}`).toContain(c);
    }
  });

  it('GDD-ART-05 every frame has a 1 px outline', () => {
    for (const { kind, look, grid } of all()) expect(bare(grid), `${kind} ${look}`).toEqual([]);
  });

  it('GDD-ART-05 nothing is cut off by a frame\'s edge, and a walker standing has its feet on the bottom row', () => {
    for (const { kind, look, grid } of all()) {
      const name = `${kind} ${look}`;
      expect(row(grid, 0).filter(Boolean), `${name} top`).toEqual([]);
      expect(column(grid, 0).filter(Boolean), `${name} left`).toEqual([]);
      expect(column(grid, grid.width - 1).filter(Boolean), `${name} right`).toEqual([]);
      const bottom = row(grid, grid.height - 1).filter(Boolean);
      if (WALKERS.includes(kind) && STANDING.test(look)) {
        expect(bottom.length, `${name} feet`).toBeGreaterThan(0);
        expect(new Set(bottom), `${name} feet`).toEqual(new Set([OUTLINE]));
      } else if (!WALKERS.includes(kind)) expect(bottom, `${name} bottom`).toEqual([]);
    }
  });

  it('GDD-ENM-01 the red telegraph is the telegraph flashed', () => {
    for (const kind of ['zopilote', 'tlacuache']) expect(frame(kind, 'teleRed').cells, kind).toEqual(flashed(frame(kind, 'tele')).cells);
  });

  it('GDD-CMB-01 the enemies that cannot be stomped carry pale points at the top of their box', () => {
    // GDD-ART-05: the mark is pale points standing on top: over the middle half of the box (sideways), the columns whose topmost colour
    // (the outline aside) is cream or pale white (cloudTop, sunDisc). Three for the Zopilote's cholla spines (wings level, in flap2, so the
    // raised wing does not cover them) and the cactus buddy's head needles; none for the Tlacuache, which can be stomped. The Alacrán is
    // left out: its pale stinger, arched over its back, is its hazard mark (GDD-ART-05), and it can be stomped.
    const points = (kind, look) => {
      const grid = frame(kind, look);
      const { x0, x1 } = KINDS[kind].BOX;
      const quarter = (x1 - x0) / 4;
      let n = 0;
      for (let x = Math.ceil(x0 + quarter); x < x1 - quarter; x++) {
        for (let y = 0; y < grid.height; y++) {
          const c = grid.get(x, y);
          if (c === null || c === OUTLINE) continue;
          if (PALE.includes(c)) n++;
          break;
        }
      }
      return n;
    };
    expect(points('zopilote', 'flap2'), 'zopilote flap2').toBeGreaterThanOrEqual(3);
    expect(points('cactus', 'doze0'), 'cactus doze0').toBeGreaterThanOrEqual(3);
    expect(points('tlacuache', 'walk0'), 'tlacuache walk0').toBe(0);
  });

  // L-059: the frames of assets/sprites/enemies/; scripts/art/enemies1.levels.test.mjs fits them over the real levels.
  it('GDD-ENM-02 each kind reaches past its box exactly as far as ENEMY_ART.reach says (L-059)', () => {
    // Over every frame of the kind, facing right: how far its painted pixels (the outline included) stand behind, in front of, above and
    // below its box, in game px (a drawing pixel is half a game px).
    for (const kind of ['alacran', 'zopilote', 'cactus', 'tlacuache']) {
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

  it('GDD-ENM-02 the body fills at least half the hit box, so hits are fair', () => {
    for (const [kind, look] of [['alacran', 'walk0'], ['zopilote', 'flap0'], ['cactus', 'doze0'], ['tlacuache', 'walk0']]) {
      const { x0, y0, x1, y1 } = KINDS[kind].BOX;
      const grid = frame(kind, look);
      let painted = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (grid.get(x, y) !== null) painted++;
      expect(painted / ((x1 - x0) * (y1 - y0)), `${kind} ${look}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('GDD-ENM-02 each box sits where the game puts it: a walker\'s on the frame\'s bottom middle, the Zopilote\'s on its middle', () => {
    for (const kind of ['alacran', 'cactus', 'tlacuache', 'zopilote']) {
      const { FRAME, BOX } = KINDS[kind];
      expect((BOX.x0 + BOX.x1) / 2, kind).toBe(FRAME.w / 2);
      if (kind === 'zopilote') expect((BOX.y0 + BOX.y1) / 2).toBe(FRAME.h / 2);
      else expect(BOX.y1, kind).toBe(FRAME.h);
    }
  });
});
