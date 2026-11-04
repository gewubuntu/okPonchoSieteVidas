import { describe, expect, it } from 'vitest';
import { parseTiles } from '../sim/tilemap';
import { awningFrame, awningImages, awningSag, cordelImages, poleSteps, rolloImages, swayOffset } from './marketLayout';

// The floor's top at row 14 (y = 224), 30 tiles wide.
const world = parseTiles(Array.from({ length: 17 }, (_row, r) => (r >= 14 ? '#' : '.').repeat(30)));
const bounce = (tier: number, at = 100) => ({ awning: 0, tier, at });

describe('GDD-WLD-10 awning drawing: the sag', () => {
  it('sags 2 px for a plain rebound and 2, 4, 6 px for tiers 1 to 3, for 4 steps from the rebound', () => {
    for (const [tier, sag] of [[0, 2], [1, 2], [2, 4], [3, 6]] as const) {
      for (let since = 1; since <= 4; since++) expect(awningSag(bounce(tier), 0, 100 + since)).toEqual({ sag, lift: 0 });
    }
  });

  it('then springs 1 px above rest for 4 steps, then rests', () => {
    for (let since = 5; since <= 8; since++) expect(awningSag(bounce(3), 0, 100 + since)).toEqual({ sag: 0, lift: 1 });
    expect(awningSag(bounce(3), 0, 109)).toEqual({ sag: 0, lift: 0 });
    expect(awningSag(bounce(3), 0, 100)).toEqual({ sag: 0, lift: 0 });
  });

  it('only the awning bounced on moves; none before any rebound', () => {
    expect(awningSag(bounce(3), 1, 101)).toEqual({ sag: 0, lift: 0 });
    expect(awningSag(null, 0, 101)).toEqual({ sag: 0, lift: 0 });
  });
});

describe('GDD-WLD-10 awning drawing: frames of awning.png (three columns: left end, middle, right end)', () => {
  it('puts the ends at the ends and repeats the middle, row by sag, the torn rows after the whole ones', () => {
    expect([0, 1, 2, 3].map((i) => awningFrame(i, 4, 0, false))).toEqual([0, 1, 1, 2]);
    expect([0, 1].map((i) => awningFrame(i, 2, 0, false))).toEqual([0, 2]);
    expect([0, 1, 2].map((i) => awningFrame(i, 3, 2, false))).toEqual([3, 4, 5]);
    expect([0, 1, 2].map((i) => awningFrame(i, 3, 4, false))).toEqual([6, 7, 8]);
    expect([0, 1, 2].map((i) => awningFrame(i, 3, 6, false))).toEqual([9, 10, 11]);
    expect([0, 1, 2].map((i) => awningFrame(i, 3, 0, true))).toEqual([12, 13, 14]);
    expect([0, 1, 2].map((i) => awningFrame(i, 3, 6, true))).toEqual([21, 22, 23]);
  });

  it('places each tile a pixel above the top, lifted when it springs back, and its two posts down to the ground', () => {
    const { posts, cloth } = awningImages({ x: 80, y: 176, w: 48 }, false, { sag: 0, lift: 1 }, world);
    expect(cloth).toEqual([
      { frame: 0, x: 80, y: 174 },
      { frame: 1, x: 96, y: 174 },
      { frame: 2, x: 112, y: 174 },
    ]);
    // Row 9 holds the posts: the left one in column 0, the right one in column 2; from y = 175 down to 224, four pieces each.
    expect(posts).toEqual([
      ...[175, 191, 207, 223].map((y) => ({ frame: 27, x: 80, y })),
      ...[175, 191, 207, 223].map((y) => ({ frame: 29, x: 112, y })),
    ]);
  });

  it('a torn one is drawn torn, and once gone as its two halves hanging at its ends', () => {
    expect(awningImages({ x: 80, y: 176, w: 48, torn: true }, false, { sag: 2, lift: 0 }, world).cloth.map((p) => p.frame)).toEqual([15, 16, 17]);
    expect(awningImages({ x: 80, y: 176, w: 48, torn: true }, true, { sag: 0, lift: 0 }, world).cloth).toEqual([
      { frame: 24, x: 80, y: 175 },
      { frame: 26, x: 112, y: 175 },
    ]);
  });

  it('a pole stops at the first solid tile under it, or the level bottom over a pit', () => {
    expect(poleSteps(world, 100, 200)).toEqual([200, 216]);
    expect(poleSteps(parseTiles(Array.from({ length: 4 }, () => '....')), 8, 30)).toEqual([30, 46, 62]);
  });
});

describe('GDD-WLD-11 cordel and rollo drawing', () => {
  it('a cordel alternates its two flag pairs tile by tile, 4 px left of each tile and 2 px above its line, posts outside its ends', () => {
    const images = cordelImages(160, 192, 32, 0, world);
    const flags = images.filter((p) => p.frame < 6);
    expect(flags.map((p) => [p.frame - swayOffset(flags.indexOf(p), 0), p.x, p.y])).toEqual([
      [0, 156, 190],
      [3, 172, 190],
    ]);
    // Left post: its top piece then its pole, drawn a tile to the left; the right post's at the line's end. Down to y = 224.
    expect(images.filter((p) => p.frame >= 6)).toEqual([
      { frame: 6, x: 140, y: 190 },
      { frame: 7, x: 140, y: 206 },
      { frame: 7, x: 140, y: 222 },
      { frame: 8, x: 188, y: 190 },
      { frame: 9, x: 188, y: 206 },
      { frame: 9, x: 188, y: 222 },
    ]);
  });

  it('the flags sway right and left on a 2 s sine, each tile out of step with the next', () => {
    const offsets = Array.from({ length: 120 }, (_step, t) => swayOffset(0, t));
    expect(new Set(offsets)).toEqual(new Set([0, 1, 2]));
    expect(swayOffset(0, 30)).not.toBe(swayOffset(3, 30));
  });

  it('a rolled rollo is its bundle by the post, swaying for half of each second, and no line', () => {
    const left = { x: 160, y: 216, w: 64, post: 'left' as const };
    const rolled = rolloImages(left, { steps: null }, 0, world);
    expect(rolled.bundle).toEqual({ frame: 0, x: 156, y: 214 });
    expect(rolloImages(left, { steps: null }, 30, world).bundle?.frame).toBe(1);
    expect(rolled.line.filter((p) => p.frame < 6)).toEqual([]);
    expect(rolloImages({ ...left, post: 'right' }, { steps: null }, 0, world).bundle).toEqual({ frame: 3, x: 204, y: 214 });
  });

  it('while it unrolls the bundle flaps open at the front of the whole tiles strung; strung, it has none', () => {
    const left = { x: 160, y: 216, w: 64, post: 'left' as const };
    // 12 steps: 32 px, two whole tiles.
    const growing = rolloImages(left, { steps: 12 }, 0, world);
    expect(growing.line.filter((p) => p.frame < 6).map((p) => p.x)).toEqual([156, 172]);
    expect(growing.bundle).toEqual({ frame: 2, x: 188, y: 214 });
    const right = rolloImages({ ...left, post: 'right' }, { steps: 12 }, 0, world);
    expect(right.line.filter((p) => p.frame < 6).map((p) => p.x)).toEqual([188, 204]);
    expect(right.bundle).toEqual({ frame: 5, x: 172, y: 214 });
    const strung = rolloImages(left, { steps: 24 }, 0, world);
    expect(strung.bundle).toBeNull();
    expect(strung.line.filter((p) => p.frame < 6)).toHaveLength(4);
  });
});
