// L-066: the art lineup puts new art beside its neighbours and the user's references on one page.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { imagesOf, isWithin, lineupHtml, parseArgs, REF_HEIGHT, REPO } from './art-lineup.mjs';

const image = (file) => ({ file, data: Buffer.from(file) });
const names = (html) => [...html.matchAll(/<div class="name">([^<]+)<\/div>/g)].map((m) => m[1]);

describe('L-066 art lineup', () => {
  it('names every image, in the order given', () => {
    expect(names(lineupHtml([image('b/z.png'), image('a/a.png'), image('r/ref.jpg')]))).toEqual(['b/z.png', 'a/a.png', 'r/ref.jpg']);
  });

  it('draws every sprite sheet at the same zoom, unsmoothed', () => {
    const html = lineupHtml([image('a.png'), image('b.png')], 2);
    expect([...html.matchAll(/style="zoom:(\d+)"/g)].map((m) => m[1])).toEqual(['2', '2']);
    expect(html).toContain('image-rendering:pixelated');
  });

  it('draws every reference at the reference height times the zoom, as a JPEG', () => {
    const html = lineupHtml([image('ref.jpg'), image('pixel.JPEG'), image('sheet.png')], 2);
    expect([...html.matchAll(/style="height:(\d+)px"/g)].map((m) => Number(m[1]))).toEqual([REF_HEIGHT * 2, REF_HEIGHT * 2]);
    expect([...html.matchAll(/data:(image\/\w+);/g)].map((m) => m[1])).toEqual(['image/jpeg', 'image/jpeg', 'image/png']);
  });

  it('embeds each image\'s own bytes', () => {
    const html = lineupHtml([image('a.png'), image('b.jpg')]);
    expect(html).toContain(Buffer.from('a.png').toString('base64'));
    expect(html).toContain(Buffer.from('b.jpg').toString('base64'));
  });
});

describe('L-066 the images a lineup takes', () => {
  const tree = { sheets: ['z.png', 'a.png', 'notes.md'], refs: ['sprite-pixel.jpg', 'reference.JPEG', 'x.txt'] };
  const fs = { isDir: (p) => p in tree, list: (p) => tree[p] };

  it('takes a folder\'s .png, .jpg and .jpeg files in name order, and a file as itself', () => {
    expect(imagesOf(['poncho.png', 'sheets', 'refs'], fs)).toEqual(['poncho.png', 'sheets/a.png', 'sheets/z.png', 'refs/reference.JPEG', 'refs/sprite-pixel.jpg']);
  });

  it('skips a named file that is no image', () => {
    expect(imagesOf(['notes.md', 'a.png'], fs)).toEqual(['a.png']);
  });
});

describe('L-066 the lineup command line', () => {
  it('takes the output first, then the inputs, and the zoom anywhere', () => {
    expect(parseArgs(['/tmp/l.png', 'assets/sprites/enemies'])).toEqual({ out: '/tmp/l.png', paths: ['assets/sprites/enemies'], zoom: 1 });
    expect(parseArgs(['--zoom', '2', '/tmp/l.png', 'a', 'b'])).toEqual({ out: '/tmp/l.png', paths: ['a', 'b'], zoom: 2 });
    expect(parseArgs(['/tmp/l.png', 'a', '--zoom', '3'])).toEqual({ out: '/tmp/l.png', paths: ['a'], zoom: 3 });
  });

  it('never writes over an input: a sheet named first, or an output inside an input folder', () => {
    expect(parseArgs(['assets/sprites/poncho.png', 'assets/sprites/poncho', 'assets/characters/poncho'])).toHaveProperty('error');
    expect(parseArgs(['/tmp/l.png', '/tmp/l.png'])).toHaveProperty('error');
    expect(parseArgs(['/tmp/sheets/lineup.png', '/tmp/sheets'])).toHaveProperty('error');
    expect(parseArgs(['/tmp/sheets-lineup.png', '/tmp/sheets'])).not.toHaveProperty('error');
    expect(parseArgs([join(REPO, 'assets', 'lineup.png'), '/tmp/sheets'])).toHaveProperty('error');
    expect(parseArgs([join(REPO, 'docs', 'screenshots', 'level-3-1', 'overview.png'), '/tmp/sheets'])).toHaveProperty('error');
  });

  it('takes a .png output in any case', () => {
    expect(parseArgs(['/tmp/L.PNG', 'a'])).toEqual({ out: '/tmp/L.PNG', paths: ['a'], zoom: 1 });
  });

  it('refuses an output that is not a .png, no input, and a zoom that is not a positive number', () => {
    expect(parseArgs(['/tmp/l.jpg', 'a'])).toHaveProperty('error');
    expect(parseArgs(['/tmp/l.png'])).toHaveProperty('error');
    expect(parseArgs([])).toHaveProperty('error');
    expect(parseArgs(['/tmp/l.png', 'a', '--zoom', 'x'])).toHaveProperty('error');
    expect(parseArgs(['/tmp/l.png', 'a', '--zoom', '0'])).toHaveProperty('error');
  });
});

describe('L-066 a lineup reads subfolders', () => {
  const tree = { refs: ['sprite-pixel.jpg', 'front', 'notes.md'], 'refs/front': ['b.jpg', 'a.png'] };
  const fs = { isDir: (p) => p in tree, list: (p) => tree[p] };

  it('takes a subfolder\'s images in its place in name order', () => {
    expect(imagesOf(['refs'], fs)).toEqual(['refs/front/a.png', 'refs/front/b.jpg', 'refs/sprite-pixel.jpg']);
  });
});

describe('L-066 what lies within a folder', () => {
  it('is the folder itself, a file in it, or a file deeper in it', () => {
    expect(isWithin('/tmp/sheets', '/tmp/sheets')).toBe(true);
    expect(isWithin('/tmp/sheets', '/tmp/sheets/l.png')).toBe(true);
    expect(isWithin('/tmp/sheets', '/tmp/sheets/a/b/l.png')).toBe(true);
  });

  it('counts a name that only starts with dots as inside', () => {
    expect(isWithin('/tmp/sheets', '/tmp/sheets/..l.png')).toBe(true);
    expect(isWithin('/tmp/sheets', '/tmp/sheets/.l.png')).toBe(true);
  });

  it('is not the folder\'s parent, a sibling, or a name that only begins like it', () => {
    expect(isWithin('/tmp/sheets', '/tmp')).toBe(false);
    expect(isWithin('/tmp/sheets', '/tmp/other/l.png')).toBe(false);
    expect(isWithin('/tmp/sheets', '/tmp/sheets-lineup.png')).toBe(false);
  });
});
