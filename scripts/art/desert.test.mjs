import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BACKDROP, BACKDROP_ART } from '../../src/config/tuning';
import { CLOUD_BOXES, drawCloudImages, drawClouds, drawGround, drawMountains, drawMountainsFull, drawSky, drawSkyStrips, drawSun, FOOT_ROW, PALETTE, SKY_ENDS, STRIP, SUN as SUN_ART } from './desert.mjs';
import { buildDesert } from './make-desert.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'desierto');

// GDD-ART-06: the 20 colours of World 1's backdrop and ground, in the GDD's order.
const SKY = ['#E39A48', '#EDB15A', '#F4C66E', '#F9DA8E'];
const SUN = { disc: '#FFF6D0', ring: '#FFD25A' };
const CLOUD = { top: '#FFF4DC', under: '#E9B98A' };
const MOUNTAIN = { purple: '#8E6A96', rust: '#A65B5B', blue: '#4D5A9C', shadow: '#3A4580' };
const GRASS = { light: '#9CC24E', base: '#6FA03A', dark: '#4E7A2C' };
const SAND = { light: '#F4D29C', base: '#E8B87A', dark: '#D19A5E' };
const EARTH = { base: '#A0472F', dark: '#7A3326' };
const ALL = [...SKY, SUN.disc, SUN.ring, CLOUD.top, CLOUD.under, ...Object.values(MOUNTAIN), ...Object.values(GRASS), ...Object.values(SAND), ...Object.values(EARTH)];

const painted = (grid) => new Set(grid.cells.filter((c) => c !== null));
const column = (grid, x) => Array.from({ length: grid.height }, (_, y) => grid.get(x, y));
/** The tile frame `n` of the ground sheet as a cell reader. */
const tile = (grid, n) => (x, y) => grid.get(n * 64 + x, y);
const kind = (colour) => (Object.values(GRASS).includes(colour) ? 'grass' : Object.values(SAND).includes(colour) ? 'sand' : Object.values(EARTH).includes(colour) ? 'earth' : 'other');

describe('GDD-ART-06 desert art', () => {
  it('GDD-ART-06 the committed PNGs are the ones the script makes', () => {
    const built = buildDesert();
    expect(Object.keys(built).sort()).toEqual(['cloud-0.png', 'cloud-1.png', 'cloud-2.png', 'cloud-3.png', 'ground.png', 'mountains.png', 'sky-strips.png', 'sun.png']);
    for (const [name, bytes] of Object.entries(built)) expect(bytes.equals(readFileSync(join(dir, name))), name).toBe(true);
  });

  it('GDD-ART-06 the images have the sizes the scene loads', () => {
    expect([drawSkyStrips().width, drawSkyStrips().height]).toEqual([1920, 6]); // three strips, 2 art px tall
    expect([drawSun().width, drawSun().height]).toEqual([152, 152]);
    expect(drawCloudImages().map((g) => [g.width, g.height])).toEqual(CLOUD_BOXES.map((b) => [b.w * 4, b.h * 4]));
    expect([drawMountains().width, drawMountains().height]).toEqual([1920, 488]);
    expect([drawGround().width, drawGround().height]).toEqual([256, 64]);
    // The whole pictures the pieces make.
    expect([drawSky().width, drawSky().height]).toEqual([1920, 1080]);
    expect([drawClouds().width, drawClouds().height]).toEqual([1920, 352]);
    expect([drawMountainsFull().width, drawMountainsFull().height]).toEqual([1920, 712]);
  });

  it('GDD-ART-06 the numbers the scene draws the pieces with are the art\'s', () => {
    const hex = (n) => `#${n.toString(16).toUpperCase().padStart(6, '0')}`;
    expect(BACKDROP_ART.skyBands.map(hex)).toEqual(PALETTE.sky);
    expect([...BACKDROP_ART.skyEnds]).toEqual(SKY_ENDS);
    expect(BACKDROP_ART.stripArt).toBe(STRIP);
    expect(BACKDROP_ART.sunHalf).toBe(SUN_ART.half);
    expect([BACKDROP.sunX, BACKDROP.sunY]).toEqual([SUN_ART.x, SUN_ART.y]);
    // The four clouds' boxes in game px (the two small ones 37 x 15, the two big ones 59 x 21), between game y 16 and 88.
    expect(CLOUD_BOXES).toEqual([{ x: 38, y: 55, w: 37, h: 15 }, { x: 140, y: 21, w: 59, h: 21 }, { x: 272, y: 17, w: 59, h: 21 }, { x: 402, y: 61, w: 37, h: 15 }]);
    expect(BACKDROP_ART.clouds).toEqual(CLOUD_BOXES.map((b) => ({ x: b.x, y: b.y })));
    expect(BACKDROP_ART.mountainBandArt).toBe(FOOT_ROW * 4);
    expect(hex(BACKDROP_ART.footColour)).toBe(PALETTE.mountains[3]);
    expect(BACKDROP.mountainTop + FOOT_ROW).toBe(214);
    expect(BACKDROP.cloudTop).toBe(16);
  });

  it('GDD-ART-06 each dither strip is a checker of 2 px cells in the colours either side of its border', () => {
    const strips = drawSkyStrips();
    for (let i = 0; i < 3; i++) {
      for (const y of [i * 2, i * 2 + 1]) {
        const row = Array.from({ length: 12 }, (_, x) => strips.get(x, y));
        expect(row, `strip ${i} row ${y}`).toEqual(['#A', '#A', '#B', '#B', '#A', '#A', '#B', '#B', '#A', '#A', '#B', '#B'].map((k) => (k === '#A' ? SKY[i] : SKY[i + 1])));
      }
    }
  });

  it('GDD-ART-06 the sky is its flat bands, the dither strips and the sun, as the scene draws them', () => {
    const strips = drawSkyStrips();
    const sun = drawSun();
    const whole = drawSky();
    const off = [];
    const bands = BACKDROP_ART.skyBands.map((n) => `#${n.toString(16).toUpperCase().padStart(6, '0')}`);
    for (let y = 0; y < 1080; y++) {
      const strip = BACKDROP_ART.skyEnds.findIndex((e) => y >= e - BACKDROP_ART.stripArt && y < e);
      for (let x = 0; x < 1920; x++) {
        let c = strip >= 0 ? strips.get(x, strip * BACKDROP_ART.stripArt + y - (BACKDROP_ART.skyEnds[strip] - BACKDROP_ART.stripArt)) : bands[BACKDROP_ART.skyEnds.filter((e) => y >= e).length];
        const sx = x - (BACKDROP.sunX - BACKDROP_ART.sunHalf) * 4;
        const sy = y - (BACKDROP.sunY - BACKDROP_ART.sunHalf) * 4;
        c = sun.get(sx, sy) ?? c;
        if (c !== whole.get(x, y)) off.push(`${x},${y}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('GDD-ART-06 the clouds are their pictures at their places, as the scene draws them', () => {
    const whole = drawClouds();
    const pieces = new Map();
    drawCloudImages().forEach((g, i) => {
      for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.get(x, y)) pieces.set(`${BACKDROP_ART.clouds[i].x * 4 + x},${BACKDROP_ART.clouds[i].y * 4 + y}`, g.get(x, y));
    });
    const off = [];
    for (let y = 0; y < 352; y++) for (let x = 0; x < 1920; x++) if ((pieces.get(`${x},${y}`) ?? null) !== whole.get(x, y)) off.push(`${x},${y}`);
    expect(off).toEqual([]);
  });

  it('GDD-ART-06 the mountains are the ridge band over the flat foot, as the scene draws them', () => {
    const band = drawMountains();
    const whole = drawMountainsFull();
    const foot = `#${BACKDROP_ART.footColour.toString(16).toUpperCase()}`;
    const off = [];
    for (let y = 0; y < 712; y++) for (let x = 0; x < 1920; x++) if ((y < band.height ? band.get(x, y) : foot) !== whole.get(x, y)) off.push(`${x},${y}`);
    expect(off).toEqual([]);
  });

  it('GDD-ART-06 the palette is the 20 colours and every pixel is one of them', () => {
    expect(Object.values(PALETTE).flat().sort()).toEqual([...ALL].sort());
    expect(ALL).toHaveLength(20);
    const used = new Set();
    for (const grid of [drawSky(), drawSkyStrips(), drawSun(), ...drawCloudImages(), drawClouds(), drawMountains(), drawMountainsFull(), drawGround()]) for (const c of painted(grid)) used.add(c);
    for (const c of used) expect(ALL, c).toContain(c);
    expect(used.has('#070509')).toBe(false);
  });

  it('GDD-ART-06 the sky is fully painted from deep amber at the top to pale gold at the horizon', () => {
    const sky = drawSky();
    expect(sky.cells.every((c) => c !== null)).toBe(true);
    expect(sky.get(0, 0)).toBe('#E39A48');
    expect(sky.get(1919, 0)).toBe('#E39A48');
    expect(sky.get(0, 1079)).toBe('#F9DA8E');
    expect(painted(sky).size).toBeGreaterThanOrEqual(6); // four bands and the sun's two colours
    for (const c of SKY) expect(painted(sky).has(c), c).toBe(true);
  });

  it('GDD-ART-06 the sun is a pale disc with a gold ring, centred at game (104, 36)', () => {
    const sky = drawSky();
    expect(sky.get(416, 144)).toBe('#FFF6D0'); // the centre, art (416, 144)
    expect(sky.get(416 + 44, 144)).toBe('#FFF6D0'); // inside the 48 art px radius
    expect(sky.get(416 + 48 + 4, 144)).toBe('#FFD25A'); // in the ring, 2 game px wide
    expect(sky.get(416 - 48 - 4, 144)).toBe('#FFD25A');
    expect(sky.get(416, 144 - 48 - 4)).toBe('#FFD25A');
    expect(sky.get(416 + 48 + 8 + 4, 144)).not.toBe('#FFD25A'); // beyond the ring and before the rays
    // The disc is 24 game px (96 art px) across, centred: its edge is the same distance either side, across and down.
    expect([sky.get(416 + 47, 144), sky.get(416 + 48, 144)]).toEqual(['#FFF6D0', '#FFD25A']);
    expect([sky.get(416 - 48, 144), sky.get(416 - 49, 144)]).toEqual(['#FFF6D0', '#FFD25A']);
    expect([sky.get(416, 144 + 47), sky.get(416, 144 + 48)]).toEqual(['#FFF6D0', '#FFD25A']);
    expect([sky.get(416, 144 - 48), sky.get(416, 144 - 49)]).toEqual(['#FFF6D0', '#FFD25A']);
    // The ring is 8 art px wide, and then the sky.
    expect([sky.get(416 + 55, 144), sky.get(416 + 56, 144)]).toEqual(['#FFD25A', SKY[0]]);
  });

  it('GDD-ART-06 the sun has eight short rays of gold in whole game pixels', () => {
    const sky = drawSky();
    const gold = (x, y) => sky.get(x, y) === '#FFD25A';
    // Along the four axes and the four diagonals, past the ring (which ends 56 art px from the centre).
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(gold(416 + dx * 70, 144 + dy * 70), `ray ${dx},${dy}`).toBe(true);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) expect(gold(416 + dx * 50, 144 + dy * 50), `ray ${dx},${dy}`).toBe(true);
    // Between two rays there is only sky.
    expect(gold(416 + 70, 144 + 30)).toBe(false);
  });

  it('GDD-ART-06 the clouds sit between game y 16 and 88 and repeat without a seam', () => {
    const clouds = drawClouds();
    const some = clouds.cells.some((c) => c !== null);
    expect(some).toBe(true);
    expect(clouds.cells.slice(0, 64 * 1920).every((c) => c === null)).toBe(true); // nothing above art row 64
    expect(painted(clouds)).toEqual(new Set([CLOUD.top, CLOUD.under]));
    expect(column(clouds, 0)).toEqual(column(clouds, 1919));
    expect(column(clouds, 0).every((c) => c === null)).toBe(true);
  });

  it('GDD-ART-06 there are three or four clouds', () => {
    const clouds = drawClouds();
    let count = 0;
    let inside = false;
    for (let x = 0; x < 1920; x++) {
      const has = column(clouds, x).some((c) => c !== null);
      if (has && !inside) count++;
      inside = has;
    }
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(4);
  });

  it('GDD-ART-06 the mountains fill every column down to the bottom and repeat without a seam', () => {
    const m = drawMountainsFull();
    const first = (x) => column(m, x).findIndex((c) => c !== null);
    const gaps = [];
    for (let x = 0; x < 1920; x++) {
      if (m.get(x, 711) === null) gaps.push(`bottom of ${x}`);
      for (let y = first(x); y < 712; y++) if (m.get(x, y) === null) gaps.push(`${x},${y}`);
    }
    expect(gaps).toEqual([]);
    // The foot of the range, from game row 122 (art 488) to the bottom, is all the dark blue, so a pit shows a plain shadow.
    expect(m.cells.slice(488 * 1920).every((c) => c === '#3A4580')).toBe(true);
    expect(Math.abs(first(0) - first(1919))).toBeLessThanOrEqual(4);
    expect(Math.min(...Array.from({ length: 1920 }, (_, x) => first(x)))).toBe(0); // the tallest peaks reach the top
    for (const c of Object.values(MOUNTAIN)) expect(painted(m).has(c), c).toBe(true);
  });

  it('GDD-ART-06 the ground sheet has two top tiles and two earth tiles', () => {
    const g = drawGround();
    expect(g.cells.every((c) => c !== null)).toBe(true);
    for (const n of [0, 1]) {
      const at = tile(g, n);
      const topRows = new Set();
      for (let y = 0; y < 4; y++) for (let x = 0; x < 64; x++) topRows.add(at(x, y));
      expect([GRASS.base, GRASS.light].some((c) => topRows.has(c)), `frame ${n} grass`).toBe(true);
      expect(Array.from({ length: 64 }, (_, x) => kind(at(x, 0))).every((k) => k === 'grass'), `frame ${n} top row`).toBe(true);
      let sand = 0;
      for (let y = 16; y < 28; y++) for (let x = 0; x < 64; x++) if (kind(at(x, y)) === 'sand') sand++;
      expect(sand, `frame ${n} sand`).toBeGreaterThan(64 * 4);
      expect(Array.from({ length: 64 }, (_, x) => at(x, 63)).some((c) => c === EARTH.base), `frame ${n} bottom row`).toBe(true);
      expect(Array.from({ length: 64 }, (_, x) => kind(at(x, 63))).every((k) => k === 'earth')).toBe(true);
    }
    for (const n of [2, 3]) {
      const seen = new Set();
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) seen.add(tile(g, n)(x, y));
      expect(seen, `frame ${n}`).toEqual(new Set([EARTH.base, EARTH.dark]));
    }
    const same = (a, b) => Array.from({ length: 64 * 64 }, (_, i) => tile(g, a)(i % 64, Math.floor(i / 64)) === tile(g, b)(i % 64, Math.floor(i / 64))).every(Boolean);
    expect(same(0, 1)).toBe(false);
    expect(same(2, 3)).toBe(false);
  });

  it('GDD-ART-06 the ground tiles repeat sideways without a seam', () => {
    const g = drawGround();
    for (const n of [0, 1, 2, 3]) {
      const at = tile(g, n);
      for (let y = 0; y < 64; y++) expect(kind(at(0, y)), `frame ${n} row ${y}`).toBe(kind(at(63, y)));
    }
  });

  it('GDD-ART-06 the ground is drawn in whole game pixels, 4 x 4 art pixels', () => {
    const g = drawGround();
    const off = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) if (g.get(x, y) !== g.get(x - (x % 4), y - (y % 4))) off.push(`${x},${y}`);
    expect(off).toEqual([]);
  });

  it('GDD-ART-06 the clouds and mountains are drawn in whole game pixels', () => {
    for (const grid of [drawClouds(), ...drawCloudImages(), drawMountains()]) {
      const off = [];
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) !== grid.get(x - (x % 4), y - (y % 4))) off.push(`${x},${y}`);
      expect(off).toEqual([]);
    }
  });
});
