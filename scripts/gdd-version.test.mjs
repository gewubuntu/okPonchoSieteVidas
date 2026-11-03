import { describe, expect, it } from 'vitest';
import { addedVersions, oneVersionErrors } from './gdd-version.mjs';

const gdd = (...versions) =>
  ['# GDD', '', `Version: ${versions[0]}`, '', '## Changelog', '', ...versions.map((v) => `- **${v}** (2026-11-03) GDD-WLD-09: text`), ''].join('\n');

describe('gdd-version (L-057)', () => {
  const base = gdd('0.9.2', '0.9.1');

  it('finds the versions a branch added, newest first', () => {
    expect(addedVersions(base, gdd('0.9.4', '0.9.3', '0.9.2', '0.9.1'))).toEqual(['0.9.4', '0.9.3']);
  });

  it('fails a branch that adds two versions', () => {
    const errors = oneVersionErrors(base, gdd('0.9.4', '0.9.3', '0.9.2', '0.9.1'));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('0.9.4, 0.9.3');
  });

  it('lets one added version through', () => {
    expect(oneVersionErrors(base, gdd('0.9.3', '0.9.2', '0.9.1'))).toEqual([]);
  });

  it('lets an unchanged GDD through', () => {
    expect(oneVersionErrors(base, base)).toEqual([]);
  });

  it('counts only versions the base lacks, after main took one and the branch merged it', () => {
    const mainNow = gdd('0.9.3', '0.9.2', '0.9.1');
    expect(oneVersionErrors(mainNow, gdd('0.9.4', '0.9.3', '0.9.2', '0.9.1'))).toEqual([]);
  });

  it('does not read a version mentioned inside a changelog line as an entry', () => {
    const head = gdd('0.9.3', '0.9.2', '0.9.1').replace('GDD-WLD-09: text', 'GDD-WLD-09: replaces - **0.9.9** wording');
    expect(addedVersions(base, head)).toEqual(['0.9.3']);
  });
});
