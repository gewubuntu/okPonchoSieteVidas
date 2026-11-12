import { describe, expect, it } from 'vitest';
import { artFiles, type ArtFiles } from './files';

/** The file names an art set's images are loaded from, the plaza and the sun only where there are. */
const names = (f: ArtFiles): string[] =>
  [f.skyStrips, f.sun, ...f.clouds, f.far, f.mid, f.plaza, f.ground, f.decor].filter((u): u is string => u !== null).map((u) => u.split('/').at(-1)!.split('?')[0]!);

describe('GDD-TEC-03 only the played level files are loaded', () => {
  it('GDD-TEC-03 a canyon level loads the canyon files and a mine level the mine files, and none of the other', () => {
    const canyon = names(artFiles('sierra', 'barranca'));
    const mine = names(artFiles('sierra', 'mina'));
    expect(canyon).toEqual(['sky-strips.png', 'cloud-0.png', 'cloud-1.png', 'cloud-2.png', 'far-barranca.png', 'mid-barranca.png', 'ground.png', 'decor.png']);
    // The mine has no clouds and no sun.
    expect(mine).toEqual(['sky-mina.png', 'far-mina.png', 'mid-mina.png', 'ground-mina.png', 'decor-mina.png']);
    expect(canyon.filter((n) => mine.includes(n))).toEqual([]);
  });

  it('GDD-TEC-03 the other worlds load their own files whatever place is asked', () => {
    expect(names(artFiles('mercado', null))).toContain('plaza.png');
    expect(names(artFiles('desierto', null))).toContain('sun.png');
  });
});
