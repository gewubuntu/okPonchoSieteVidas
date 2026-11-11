import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKDROP, BACKDROP_ART, PLANTS, TILE } from '../../config/tuning';
import { LEVELS } from '../../levels';
import { cameraLimits } from '../camera';
import { artSetFor, LOOKS, midImage, riseShift, textureKey, VERTICAL_FACTOR, type BackdropLayer } from './looks';

/** A PNG's width and height in art px, read from its header. */
const pngSize = (set: string, file: string): [number, number] => {
  const bytes = readFileSync(new URL(`../../../assets/sprites/${set}/${file}`, import.meta.url));
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

describe('GDD-ART-06 a look per world', () => {
  it('GDD-ART-06 artset: World 2 is the Mercado; the tutorial, World 1 and worlds not drawn yet the desert', () => {
    expect([0, 1, 2, 3, 7].map(artSetFor)).toEqual(['desierto', 'desierto', 'mercado', 'desierto', 'desierto']);
  });

  it('GDD-ART-06 artset of every level: World 2 levels the Mercado (its labs too), the rest (the World 1 test levels too) the desert', () => {
    expect(Object.fromEntries(LEVELS.map((e) => [e.id, artSetFor(e.world)]))).toEqual({
      '0-1': 'desierto',
      '1-1': 'desierto',
      '1-2': 'desierto',
      '1-3': 'desierto',
      '1-4': 'desierto',
      '2-1': 'mercado',
      '2-2': 'mercado',
      '2-3': 'mercado',
      '2-4': 'mercado',
      sandbox: 'desierto',
      slopes: 'desierto',
      'lab-2m': 'mercado',
      'lab-2e': 'mercado',
      'lab-3c': 'desierto',
      'lab-3t': 'desierto',
    });
  });

  it('GDD-ART-06 midimage: the plaza in World 2 boss arena only', () => {
    expect([midImage('mercado', true), midImage('mercado', false), midImage('desierto', true), midImage('desierto', false)]).toEqual(['plaza', 'mid', 'mid', 'mid']);
  });

  it('GDD-ART-06 texture keys differ per world, as Phaser texture cache is global', () => {
    expect(textureKey('desierto', 'ground')).not.toBe(textureKey('mercado', 'ground'));
  });

  it('GDD-ART-06 desert look is World 1 backdrop as before', () => {
    expect(LOOKS.desierto).toEqual({
      cloudFactor: 0.1,
      farFactor: 0.3,
      midFactor: 0.5,
      skyBands: BACKDROP_ART.skyBands,
      skyEnds: [200, 340, 480],
      stripArt: 2,
      sun: { x: 104, y: 36, half: 19 },
      clouds: BACKDROP_ART.clouds,
      farTop: 92,
      farBandArt: 488,
      footColour: 0x3a4580,
      midTop: BACKDROP.desertTop,
      midBandArt: 176,
      decor: PLANTS,
    });
  });

  it('GDD-ART-06 mercado look: a pale blue sky in three bands and no sun, the shares of World 1', () => {
    const m = LOOKS.mercado;
    expect([m.cloudFactor, m.farFactor, m.midFactor]).toEqual([0.1, 0.3, 0.5]);
    expect(m.skyBands).toEqual([0x86bee0, 0xa9d3ea, 0xcfe8f1]);
    expect(m.skyEnds).toEqual([240, 440]);
    expect(m.sun).toBeNull();
    expect(m.footColour).toBe(0x4e4a78);
    // The far band from y 84 to 200, the mid band from 148 to the floor's top at 224.
    expect([m.farTop, m.farTop + m.farBandArt / 4]).toEqual([84, 200]);
    expect([m.midTop, m.midTop + m.midBandArt / 4]).toEqual([148, 224]);
    expect(m.decor.map((d) => [d.w, d.h])).toEqual([[10, 12], [16, 20], [14, 10], [14, 14], [8, 40], [16, 24], [12, 16]]);
  });

  it('GDD-ART-06 mercado clouds: centred near x 90, 250 and 410, between y 14 and 64, clear of the strip sides', () => {
    const sizes = [0, 1, 2].map((i) => pngSize('mercado', `cloud-${i}.png`).map((n) => n / 4));
    LOOKS.mercado.clouds.forEach(({ x, y }, i) => {
      const [w, h] = sizes[i]!;
      expect(Math.abs(x + w! / 2 - [90, 250, 410][i]!), `cloud ${i}`).toBeLessThanOrEqual(1);
      expect(y, `cloud ${i}`).toBeGreaterThanOrEqual(14);
      expect(y + h!, `cloud ${i}`).toBeLessThanOrEqual(64);
      expect(x, `cloud ${i}`).toBeGreaterThan(0);
      expect(x + w!, `cloud ${i}`).toBeLessThan(480);
    });
  });

  it('GDD-ART-06 mercado files are the sizes the scene loads', () => {
    const m = LOOKS.mercado;
    expect(pngSize('mercado', 'sky-strips.png')).toEqual([1920, m.stripArt * m.skyEnds.length]);
    expect(pngSize('mercado', 'far-town.png')).toEqual([1920, m.farBandArt]);
    expect(pngSize('mercado', 'mid-roofs.png')).toEqual([1920, m.midBandArt]);
    expect(pngSize('mercado', 'plaza.png')).toEqual([1920, m.midBandArt]);
    // 28 ground frames of 64 art px, and seven decor frames as large as the largest item (16 x 40 game px).
    expect(pngSize('mercado', 'ground.png')).toEqual([28 * 64, 64]);
    expect(pngSize('mercado', 'decor.png')).toEqual([7 * 16 * 4, 40 * 4]);
    expect(Math.max(...m.decor.map((d) => d.w))).toBe(16);
    expect(Math.max(...m.decor.map((d) => d.h))).toBe(40);
  });
});

describe('GDD-ART-06 the backdrop up and down in a tall level', () => {
  const LAYERS: readonly BackdropLayer[] = ['sky', 'sun', 'clouds', 'far', 'foot', 'mid'];
  const shifts = (cameraY: number, lowestY: number) => Object.fromEntries(LAYERS.map((l) => [l, riseShift(l, cameraY, lowestY)]));

  it('GDD-ART-06 in a tall level the far layers shift by 0.1 and the mid by 0.2 of the camera rise, downwards, and the sky does not move', () => {
    // A level 40 rows tall: the camera's lowest y is 368. 100 px above it the far strip and its foot are drawn 10 px lower, the mid 20.
    const lowest = cameraLimits(40 * TILE).bottom;
    expect(lowest).toBe(368);
    expect(shifts(268, lowest)).toEqual({ sky: 0, sun: 0, clouds: 0, far: 10, foot: 10, mid: 20 });
    // At the level's top, 368 px above it: 36.8 and 73.6, at whole art pixels (a quarter px).
    expect(shifts(0, lowest)).toEqual({ sky: 0, sun: 0, clouds: 0, far: 36.75, foot: 36.75, mid: 73.5 });
    // A 51-row level, the tallest: at most 54 and 109 px (54.4 and 108.8, at whole art pixels).
    expect(shifts(0, cameraLimits(51 * TILE).bottom)).toMatchObject({ far: 54.5, mid: 108.75 });
    // Only ever down from the rest, and never more than its share.
    for (let y = 0; y <= lowest; y += 0.25) {
      for (const l of LAYERS) {
        const s = riseShift(l, y, lowest);
        expect(s, `${l} at ${y}`).toBeGreaterThanOrEqual(0);
        expect(Math.abs(s - VERTICAL_FACTOR[l] * (lowest - y)), `${l} at ${y}`).toBeLessThanOrEqual(1 / 8);
        expect(s * 4, `${l} at ${y}`).toBe(Math.round(s * 4));
      }
    }
  });

  it('GDD-ART-06 at the camera lowest every layer is at its approved place', () => {
    expect(shifts(368, 368)).toEqual({ sky: 0, sun: 0, clouds: 0, far: 0, foot: 0, mid: 0 });
    expect(shifts(128, 128)).toEqual({ sky: 0, sun: 0, clouds: 0, far: 0, foot: 0, mid: 0 });
  });

  it('GDD-ART-06 a 17-row level: no vertical shift', () => {
    const lowest = cameraLimits(17 * TILE).bottom;
    expect(shifts(0, lowest)).toEqual({ sky: 0, sun: 0, clouds: 0, far: 0, foot: 0, mid: 0 });
  });
});
