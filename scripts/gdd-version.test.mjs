import { describe, expect, it } from 'vitest';
import { addedVersions, changedSections, changelogSectionErrors, gddVersionErrors, namedSections, oneVersionErrors, sectionTexts } from './gdd-version.mjs';

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

  it('tells the author to fetch main when the base may be stale', () => {
    expect(oneVersionErrors(base, gdd('0.9.4', '0.9.3', '0.9.2', '0.9.1'))[0]).toContain('git fetch origin main');
  });

  // A fake git: `merge-base origin/main HEAD` answers with `baseSha` (or fails without one), `show` with the base's GDD (or
  // fails without one). Any other call fails, so asking for another merge base turns the check off and the tests see it.
  const fakeGit = (baseSha, baseText) => (cmd, ...args) => {
    if (cmd === 'merge-base' && args.join(' ') === 'origin/main HEAD') return baseSha ? { status: 0, stdout: `${baseSha}\n` } : { status: 1, stdout: '' };
    if (cmd === 'show' && args[0] === `${baseSha}:docs/GDD.md`) return baseText ? { status: 0, stdout: baseText } : { status: 128, stdout: '' };
    return { status: 1, stdout: '' };
  };
  const twoAdded = gdd('0.9.4', '0.9.3', '0.9.2', '0.9.1');

  // L-088: during `git merge origin/main`, before the merge is committed, HEAD's merge base is still the old one, so main's
  // versions counted as the branch's and the gate could not pass on the merge it is run to check.
  it('reads the GDD at the merge base the merge in progress will have', () => {
    const merging = (cmd, ...args) => {
      if (cmd === 'rev-parse' && args.join(' ') === '-q --verify MERGE_HEAD') return { status: 0, stdout: 'm\n' };
      if (cmd === 'merge-base' && args.join(' ') === 'origin/main HEAD MERGE_HEAD') return { status: 0, stdout: 'main\n' };
      if (cmd === 'merge-base' && args.join(' ') === 'origin/main HEAD') return { status: 0, stdout: 'old\n' };
      if (cmd === 'show' && args[0] === 'main:docs/GDD.md') return { status: 0, stdout: gdd('0.9.3', '0.9.2', '0.9.1') };
      if (cmd === 'show' && args[0] === 'old:docs/GDD.md') return { status: 0, stdout: base };
      return { status: 1, stdout: '' };
    };
    expect(gddVersionErrors(merging, twoAdded, false)).toEqual([]);
    expect(gddVersionErrors(merging, gdd('0.9.5', '0.9.4', '0.9.3', '0.9.2', '0.9.1'), false)).toHaveLength(1);
  });

  it('reads the GDD at the merge base and fails a branch that adds two versions', () => {
    expect(gddVersionErrors(fakeGit('abc123', base), twoAdded, false)).toHaveLength(1);
    expect(gddVersionErrors(fakeGit('abc123', base), gdd('0.9.3', '0.9.2', '0.9.1'), false)).toEqual([]);
  });

  it('passes without a merge base outside CI, and fails without one under CI', () => {
    expect(gddVersionErrors(fakeGit(null, base), twoAdded, false)).toEqual([]);
    const errors = gddVersionErrors(fakeGit(null, base), twoAdded, true);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('fetch-depth: 0');
  });

  it('passes when the base has no GDD', () => {
    expect(gddVersionErrors(fakeGit('abc123', null), twoAdded, true)).toEqual([]);
  });
});

describe('gdd-changelog-sections (L-013)', () => {
  /** A GDD whose newest changelog line is `line`, with the given sections (`[id, body]`) in two chapters. */
  const doc = (line, sections, extra = '') =>
    ['# GDD', '', 'Version: 0.9.3', '', '## Changelog', '', ...(line ? [line] : []), '- **0.9.2** (2026-11-03) GDD-WLD-09: text', '', '---', '', '## 8. World', '',
      ...sections.flatMap(([id, body]) => [`### ${id} Title`, '', 'Status: Proposed', '', body, '']), '---', '', '## Open Questions', '', `1. A question. ${extra}`, ''].join('\n');
  const three = [['GDD-WLD-01', 'one'], ['GDD-WLD-02', 'two'], ['GDD-UI-05', 'ten']];
  const base = doc('', three);
  const line = (ids) => `- **0.9.3** (2026-11-04) ${ids}: summary that names GDD-UI-05 and says: more`;
  const edit = (id, body) => three.map((s) => (s[0] === id ? [id, body] : s));

  it('reads each section from its heading to the next heading or rule', () => {
    const texts = sectionTexts(base);
    expect([...texts.keys()]).toEqual(['GDD-WLD-01', 'GDD-WLD-02', 'GDD-UI-05']);
    expect(texts.get('GDD-WLD-01')).toBe('### GDD-WLD-01 Title\n\nStatus: Proposed\n\none\n\n');
    expect(texts.get('GDD-UI-05')).toBe('### GDD-UI-05 Title\n\nStatus: Proposed\n\nten\n\n');
  });

  it('ends a section at a heading of level 1, 2 or 3 and at a rule, and not at a deeper heading', () => {
    const text = (stop) => `### GDD-WLD-01 T\nbody\n${stop}\nafter\n`;
    expect(sectionTexts(text('# Top')).get('GDD-WLD-01')).toBe('### GDD-WLD-01 T\nbody\n');
    expect(sectionTexts(text('## 9. Enemies')).get('GDD-WLD-01')).toBe('### GDD-WLD-01 T\nbody\n');
    expect(sectionTexts(text('### Conflicts')).get('GDD-WLD-01')).toBe('### GDD-WLD-01 T\nbody\n');
    expect(sectionTexts(text('---')).get('GDD-WLD-01')).toBe('### GDD-WLD-01 T\nbody\n');
    expect(sectionTexts(text('#### Deeper')).get('GDD-WLD-01')).toContain('body\n#### Deeper\nafter\n');
    expect(sectionTexts(text('--- a dash line that is no rule')).get('GDD-WLD-01')).toContain('after');
    expect(sectionTexts(text('---  ')).get('GDD-WLD-01')).toBe('### GDD-WLD-01 T\nbody\n');
  });

  it('finds the sections that differ, the added and the removed ones too', () => {
    expect(changedSections(base, base)).toEqual([]);
    expect(changedSections(base, doc('', edit('GDD-WLD-02', 'TWO')))).toEqual(['GDD-WLD-02']);
    expect(changedSections(base, doc('', [...three, ['GDD-UI-06', 'new']]))).toEqual(['GDD-UI-06']);
    expect(changedSections(base, doc('', three.slice(1)))).toEqual(['GDD-WLD-01']);
  });

  it('takes a blank line more or less at a section end for no change, as when a section is added after a chapter last', () => {
    expect(changedSections('### GDD-WLD-01 T\nbody\n\n---\n', '### GDD-WLD-01 T\nbody\n\n\n### GDD-WLD-02 T\nnew\n')).toEqual(['GDD-WLD-02']);
  });

  it('takes a renumbered Open Question for no change, and a change beside it for one', () => {
    const cite = (text) => doc('', edit('GDD-WLD-02', text));
    expect(changedSections(cite('See Open Question 7. And Open Questions 8, 9 and 12 or 14 to 16.'), cite('See Open Question 6. And Open Questions 7, 8 and 11 or 13 to 15.'))).toEqual([]);
    expect(changedSections(cite('See Open Question 7 (a).'), cite('See Open Question 6 (b).'))).toEqual(['GDD-WLD-02']);
    expect(changedSections(cite('Question 7 of 9.'), cite('Question 6 of 9.'))).toEqual(['GDD-WLD-02']);
  });

  it('does not count a change outside the sections', () => {
    expect(changedSections(base, doc(line('GDD-WLD-01'), three, 'Answered.'))).toEqual([]);
  });

  it('reads the IDs before the first colon of a changelog line, ranges written out', () => {
    expect(namedSections(line('GDD-WLD-01, GDD-UI-05'))).toEqual(['GDD-WLD-01', 'GDD-UI-05']);
    expect(namedSections(line('GDD-WLD-01'))).toEqual(['GDD-WLD-01']);
    expect(namedSections('- **1.0.0** (2026-11-20) GDD-CHAIN-01 to GDD-CHAIN-03, GDD-LIFE-06: text')).toEqual(['GDD-CHAIN-01', 'GDD-CHAIN-02', 'GDD-CHAIN-03', 'GDD-LIFE-06']);
    expect(namedSections('- **1.0.0** (2026-11-20) GDD-WLD-09 to GDD-WLD-11: text')).toEqual(['GDD-WLD-09', 'GDD-WLD-10', 'GDD-WLD-11']);
    expect(namedSections('- **1.0.0** (2026-11-20) GDD-WLD-09 to GDD-UI-02: text')).toEqual(['GDD-WLD-09', 'GDD-UI-02']);
    expect(namedSections('- **1.0.0** (2026-11-20) GDD-WLD-11 to GDD-WLD-09: text')).toEqual(['GDD-WLD-09', 'GDD-WLD-10', 'GDD-WLD-11']);
    expect(namedSections('- **1.0.0** (2026-11-20) a line with no colon that ends in GDD-WLD-09')).toEqual(['GDD-WLD-09']);
  });

  it('passes a line that names exactly the changed sections', () => {
    expect(changelogSectionErrors(base, doc(line('GDD-WLD-02'), edit('GDD-WLD-02', 'TWO')))).toEqual([]);
  });

  it('passes a branch that changes no section and adds no version', () => {
    expect(changelogSectionErrors(base, base)).toEqual([]);
  });

  it('fails a line that names a section on a branch that changes none', () => {
    const errors = changelogSectionErrors(base, doc(line('GDD-WLD-01'), three, 'Answered.'));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('names GDD-WLD-01, which did not change');
    expect(changelogSectionErrors(base, doc('- **0.9.3** (2026-11-04) Open Question 1 answered: text', three, 'Answered.'))).toEqual([]);
  });

  it('fails a changed section the line does not name, though the summary mentions it', () => {
    const errors = changelogSectionErrors(base, doc(line('GDD-WLD-02'), edit('GDD-UI-05', 'TEN').map((s) => (s[0] === 'GDD-WLD-02' ? [s[0], 'TWO'] : s))));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('the changelog line of 0.9.3 does not name GDD-UI-05, which changed since origin/main');
    expect(errors[0]).toContain('git fetch origin main');
  });

  it('fails a named section the diff leaves alone', () => {
    const errors = changelogSectionErrors(base, doc(line('GDD-WLD-01, GDD-WLD-02'), edit('GDD-WLD-02', 'TWO')));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('the changelog line of 0.9.3 names GDD-WLD-01, which did not change since origin/main');
    expect(errors[0]).toContain('git fetch origin main');
  });

  it('reports both kinds at once, and names the base it was given', () => {
    const errors = changelogSectionErrors(base, doc(line('GDD-WLD-01'), edit('GDD-WLD-02', 'TWO')), 'the base');
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('does not name GDD-WLD-02, which changed since the base');
    expect(errors[1]).toContain('names GDD-WLD-01, which did not change since the base');
  });

  it('lets the line name GDD-TEC-07 without a change to it, for the dependency review, and no other section so', () => {
    const withTec = [...three, ['GDD-TEC-07', 'deps'], ['GDD-TEC-08', 'deploy']];
    const b = doc('', withTec);
    const head = (ids) => doc(line(ids), withTec.map((s) => (s[0] === 'GDD-WLD-02' ? [s[0], 'TWO'] : s)));
    expect(changelogSectionErrors(b, head('GDD-WLD-02, GDD-TEC-07'))).toEqual([]);
    expect(changelogSectionErrors(b, head('GDD-WLD-02, GDD-TEC-08'))).toHaveLength(1);
  });

  it('fails a changed section on a branch that adds no version', () => {
    const errors = changelogSectionErrors(base, doc('', edit('GDD-WLD-02', 'TWO')));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('GDD-WLD-02 changed since origin/main and the changelog has no new version');
    expect(errors[0]).toContain('git fetch origin main');
    expect(changelogSectionErrors(base, doc('', edit('GDD-WLD-02', 'TWO')), 'the base')[0]).toContain('changed since the base and');
  });

  it('reads the line of the version the branch added, not an older line', () => {
    const head = doc(line('GDD-WLD-02'), edit('GDD-WLD-02', 'TWO')).replace('GDD-WLD-09: text', 'GDD-WLD-01: text');
    expect(changelogSectionErrors(base.replace('GDD-WLD-09: text', 'GDD-WLD-01: text'), head)).toEqual([]);
  });

  it('reads the newest line when a branch added two versions', () => {
    const head = doc(line('GDD-WLD-02'), edit('GDD-WLD-02', 'TWO')).replace('- **0.9.2**', '- **0.9.25** (2026-11-04) GDD-WLD-01: an added older line\n- **0.9.2**');
    expect(changelogSectionErrors(base, head)).toEqual([]);
  });

  it('runs through the gate entry against the merge base, given as its check', () => {
    const head = doc(line('GDD-WLD-01'), edit('GDD-WLD-02', 'TWO'));
    const git = (...args) => (args[0] === 'rev-parse' ? { status: 1, stdout: '' } : args[0] === 'merge-base' ? { status: 0, stdout: 'abc\n' } : { status: 0, stdout: base });
    expect(gddVersionErrors(git, head, false, changelogSectionErrors)).toHaveLength(2);
    expect(gddVersionErrors(git, head, false)).toEqual([]);
  });
});
