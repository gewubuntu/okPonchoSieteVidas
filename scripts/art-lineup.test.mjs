// L-066: the art lineup puts every sheet on one page, in name order, at one zoom, each named.
import { describe, expect, it } from 'vitest';
import { lineupHtml } from './art-lineup.mjs';

const sheet = (name) => ({ name, png: Buffer.from(name) });

describe('L-066 art lineup', () => {
  it('names every sheet, in name order', () => {
    const html = lineupHtml([sheet('zopilote'), sheet('alacran'), sheet('cacomixtle')]);
    const names = [...html.matchAll(/<div class="name">([^<]+)<\/div>/g)].map((m) => m[1]);
    expect(names).toEqual(['alacran', 'cacomixtle', 'zopilote']);
  });

  it('draws every sheet at the same zoom, unsmoothed', () => {
    const html = lineupHtml([sheet('a'), sheet('b')], 2);
    expect([...html.matchAll(/zoom:(\d+)/g)].map((m) => m[1])).toEqual(['2', '2']);
    expect(html).toContain('image-rendering:pixelated');
  });

  it('embeds each sheet\'s own bytes', () => {
    const html = lineupHtml([sheet('a'), sheet('b')]);
    expect(html).toContain(Buffer.from('a').toString('base64'));
    expect(html).toContain(Buffer.from('b').toString('base64'));
  });
});
