// L-066: the art lineup puts new art beside its neighbours and the user's references on one page.
import { describe, expect, it } from 'vitest';
import { imagesOf, lineupHtml, REF_HEIGHT } from './art-lineup.mjs';

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
