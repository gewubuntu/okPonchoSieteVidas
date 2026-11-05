import { describe, expect, it } from 'vitest';
import { sheetsOf, spriteFitErrors } from './sprite-fit.mjs';

describe('L-059 sprite-fit: every character sheet has a fit test', () => {
  it('covers every folder but the scenery ones, and the PNGs at the top', () => {
    const entries = [
      { name: 'boss', dir: true },
      { name: 'desierto', dir: true },
      { name: 'mercado', dir: true },
      { name: 'enemies', dir: true },
      { name: 'poncho.png', dir: false },
      { name: 'README.md', dir: false },
    ];
    expect(sheetsOf(entries)).toEqual(['boss', 'enemies', 'poncho.png']);
  });

  it('passes a sheet named by a test that cites L-059', () => {
    expect(spriteFitErrors(['enemies'], [{ path: 'a.test.mjs', text: '// L-059: assets/sprites/enemies/ frames' }], {})).toEqual([]);
  });

  it('fails a sheet whose only test names it without citing L-059', () => {
    expect(spriteFitErrors(['boss'], [{ path: 'b.test.mjs', text: 'reads assets/sprites/boss/' }], {})).toHaveLength(1);
  });

  it('fails a sheet that a test citing L-059 does not name', () => {
    expect(spriteFitErrors(['boss'], [{ path: 'c.test.mjs', text: 'L-059 assets/sprites/enemies/' }], {})).toHaveLength(1);
  });

  it('fails a sheet only named bare, not by its path, in a test citing L-059', () => {
    expect(spriteFitErrors(['boss'], [{ path: 'd.test.mjs', text: '// L-059, see boss.test.mjs' }], {})).toHaveLength(1);
  });

  it('skips an exempt sheet', () => {
    expect(spriteFitErrors(['poncho.png'], [], { 'poncho.png': 'reason' })).toEqual([]);
  });
});
