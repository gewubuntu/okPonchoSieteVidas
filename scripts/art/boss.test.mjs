import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOSS_ART } from '../../src/config/tuning';
import { BOSS_DEFEAT_LOOKS, BOSS_LOOKS } from '../../src/ui/bossPose';
import { bossFrames, COLUMNS, DEFEAT_LOOKS, drawBossSheet, drawFruitSheet, drawRock, FRAME, LOOKS, OUTLINE, STUCK_FLOOR } from './boss.mjs';
import { buildBoss } from './make-boss.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'boss');

// GDD-ART-06: the 24 colours of World 1, in the GDD's order (the same list as desert.test.mjs).
const SKY = ['#E39A48', '#EDB15A', '#F4C66E', '#F9DA8E'];
const SUN = { disc: '#FFF6D0', ring: '#FFD25A' };
const CLOUD = { top: '#FFF4DC', under: '#E9B98A' };
const MOUNTAIN = { purple: '#8E6A96', rust: '#A65B5B', blue: '#4D5A9C', shadow: '#3A4580' };
const GRASS = { light: '#9CC24E', base: '#6FA03A', dark: '#4E7A2C' };
const SAND = { light: '#F4D29C', base: '#E8B87A', dark: '#D19A5E' };
const EARTH = { base: '#A0472F', dark: '#7A3326' };
const PLANT = { red: '#D8473A', orange: '#F08A3C', blueGreen: '#6F9C8E', deep: '#2F5A3A' };
const WORLD_1 = [...SKY, SUN.disc, SUN.ring, CLOUD.top, CLOUD.under, ...Object.values(MOUNTAIN), ...Object.values(GRASS), ...Object.values(SAND), ...Object.values(EARTH), ...Object.values(PLANT)];
const RED = PLANT.red;
const WHITE = SUN.disc;
const GOLD = SUN.ring;

const painted = (grid) => new Set(grid.cells.filter((c) => c !== null));
// Drawing the frames takes seconds, so they are drawn once.
const FRAMES = bossFrames();
const SHEET = drawBossSheet();
const frame = (look, crown) => FRAMES.find((f) => f.look === look && f.crown === crown);
const count = (grid, colour) => grid.cells.filter((c) => c === colour).length;
/** The most common colour of a grid that is not the outline. */
function commonest(grid) {
  const tally = new Map();
  for (const c of grid.cells) if (c !== null && c !== OUTLINE) tally.set(c, (tally.get(c) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
/** The painted cells of the box [x0, x0 + w) x [y0, y0 + h) of `grid` that are not the outline and have an empty 4-neighbour inside the box. */
function bare(grid, x0, y0, w, h) {
  const off = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid.get(x0 + x, y0 + y);
      if (c === null || c === OUTLINE) continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && grid.get(x0 + x + dx, y0 + y + dy) === null);
      if (open) off.push(`${x},${y}`);
    }
  }
  return off;
}

describe('GDD-BOS-02 Don Zopilote\'s art', { timeout: 60_000 }, () => {
  it('GDD-BOS-02 the committed PNGs are the ones the script makes', () => {
    const built = buildBoss();
    expect(Object.keys(built).sort()).toEqual(['don-zopilote.png', 'fruit.png', 'rock.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
  });

  it('GDD-BOS-02 the sheets have the sizes the scene loads', () => {
    const sheet = SHEET;
    expect([sheet.width, sheet.height]).toEqual([2100, 1240]); // 7 x 5 frames of 300 x 248 art px
    expect([sheet.width, sheet.height]).toEqual([COLUMNS * FRAME.w * 2, 5 * FRAME.h * 2]);
    expect([drawFruitSheet().width, drawFruitSheet().height]).toEqual([72, 36]);
    expect([drawRock().width, drawRock().height]).toEqual([52, 52]);
    expect([FRAME.w / 2, FRAME.h / 2]).toEqual([BOSS_ART.frameW, BOSS_ART.frameH]);
    expect(COLUMNS).toBe(BOSS_ART.columns);
    expect(18 / 2).toBe(BOSS_ART.fruitFrame);
    expect(26 / 2).toBe(BOSS_ART.rock);
  });

  it('GDD-BOS-02 the frames come in the order the game picks them', () => {
    const want = [3, 2, 1].flatMap((crown) => LOOKS.map((look) => [look, crown]));
    for (const look of DEFEAT_LOOKS) want.push([look, 0]);
    expect(FRAMES.map((f) => [f.look, f.crown])).toEqual(want);
    expect(want).toHaveLength(35);
    expect(LOOKS).toEqual([...BOSS_LOOKS]);
    expect(DEFEAT_LOOKS).toEqual([...BOSS_DEFEAT_LOOKS]);
  });

  it('GDD-ART-06 he, his fruit and the rocks use only World 1\'s colours and the outline', () => {
    expect(WORLD_1).toHaveLength(24);
    for (const [name, grid] of [['sheet', SHEET], ['fruit', drawFruitSheet()], ['rock', drawRock()]]) {
      for (const c of painted(grid)) expect([...WORLD_1, OUTLINE], `${name} ${c}`).toContain(c);
    }
  });

  it('GDD-ART-05 every frame is outlined', () => {
    // The stuck frame's sand mound is scenery, with no outline (GDD-ART-05): it is checked above the mound's top (STUCK_FLOOR - 24).
    for (const f of FRAMES) expect(bare(f.grid, 0, 0, FRAME.w, f.look === 'stuck' ? STUCK_FLOOR - 25 : FRAME.h), `${f.look} ${f.crown}`).toEqual([]);
    const fruit = drawFruitSheet();
    for (const i of [0, 1]) expect(bare(fruit, i * 36, 0, 36, 36), `fruit ${i}`).toEqual([]);
    const rock = drawRock();
    expect(bare(rock, 0, 0, 52, 52), 'rock').toEqual([]);
  });

  it('GDD-BOS-02 his crown loses a point for each hit', () => {
    // Every look that shows his colours (the flashes paint the crown too): more gold at each crown than at the one below it (L-010).
    for (const look of LOOKS.filter((l) => !['telegraphRed', 'hurtWhite'].includes(l))) {
      const gold = [3, 2, 1].map((crown) => count(frame(look, crown).grid, GOLD));
      expect(gold[0], look).toBeGreaterThan(gold[1]);
      expect(gold[1], look).toBeGreaterThan(gold[2]);
      expect(gold[2], look).toBeGreaterThan(0);
    }
    expect(count(frame('defeat', 0).grid, GOLD)).toBe(0);
  });

  it('GDD-BOS-02 the frames he shows resting on the floor stay above it', () => {
    // Stuck, sweeping, hurt (after a claw hit he is on the floor) and defeated (lying there), his box's bottom is on the floor's top: the
    // frame's row FRAME.h / 2 + 30 (his box 60 drawing px tall), so nothing is painted from that row down.
    const floorRow = FRAME.h / 2 + 30;
    expect(floorRow).toBe(STUCK_FLOOR);
    for (const f of FRAMES.filter((fr) => ['stuck', 'sweep', 'hurt', 'hurtWhite', 'defeat', 'defeatWhite'].includes(fr.look))) {
      expect(f.grid.cells.slice(floorRow * FRAME.w).filter((c) => c !== null).length, `${f.look} ${f.crown}`).toBe(0);
    }
  });

  it('GDD-BOS-02 the flashes', () => {
    for (const crown of [3, 2, 1]) {
      expect(commonest(frame('telegraphRed', crown).grid), `telegraphRed ${crown}`).toBe(RED);
      expect(commonest(frame('hurtWhite', crown).grid), `hurtWhite ${crown}`).toBe(WHITE);
      expect([RED, WHITE], `telegraph ${crown}`).not.toContain(commonest(frame('telegraph', crown).grid));
      expect([RED, WHITE], `hurt ${crown}`).not.toContain(commonest(frame('hurt', crown).grid));
    }
    expect(commonest(frame('defeatWhite', 0).grid)).toBe(WHITE);
    expect([RED, WHITE]).not.toContain(commonest(frame('defeat', 0).grid));
  });

  it('GDD-BOS-02 the stuck frame stands on its floor line', () => {
    for (const crown of [3, 2, 1]) {
      const { grid } = frame('stuck', crown);
      expect(grid.cells.slice(STUCK_FLOOR * FRAME.w).filter((c) => c !== null), `crown ${crown} below the floor`).toEqual([]);
      // The mound's last row is sand and nothing else.
      const row = Array.from({ length: FRAME.w }, (_, x) => grid.get(x, STUCK_FLOOR - 1)).filter((c) => c !== null);
      expect(row.length, `crown ${crown} sand`).toBeGreaterThan(0);
      for (const c of row) expect([SAND.base, SAND.dark], `crown ${crown}`).toContain(c);
    }
  });
});
