import { describe, expect, it } from 'vitest';
import { hunt, huntArgs, ownerOf, reportLine, sentences, STATUS_WORDS, termPattern } from './gdd-hunt.mjs';

describe('gdd-hunt (L-013, L-053)', () => {
  it('splits a line into sentences after a stop, a question or an exclamation mark', () => {
    expect(sentences('One thing. Two things? Three things! Four.')).toEqual(['One thing.', 'Two things?', 'Three things!', 'Four.']);
  });

  it('splits before a quote, a bracket, a backtick or bold, and after a closing bracket or quote', () => {
    expect(sentences('He lands (see below). "Quoted" next. (An aside.) `code` here. **Bold** last. He said "stop." Then went.')).toEqual([
      'He lands (see below).', '"Quoted" next.', '(An aside.)', '`code` here.', '**Bold** last.', 'He said "stop."', 'Then went.',
    ]);
    expect(sentences("It ends. 'Single' next. He said 'go.' Then went.")).toEqual(['It ends.', "'Single' next.", "He said 'go.'", 'Then went.']);
  });

  it('does not split inside a number, an abbreviation or before a small letter', () => {
    expect(sentences('Sweeps 0.2 tile apart, e.g. at 1.5 s. then nothing')).toEqual(['Sweeps 0.2 tile apart, e.g. at 1.5 s. then nothing']);
    expect(sentences('   ')).toEqual([]);
  });

  it('knows every status word, as a whole word, whatever its case', () => {
    for (const word of ['yet', 'so far', 'only', 'not built', 'built for', 'checked by', 'to come', 'to be', 'pending', 'stand-in', 'placeholder', 'until', 'still']) {
      expect(STATUS_WORDS.test(`it is ${word} there`), word).toBe(true);
    }
    expect(STATUS_WORDS.test('Yet another')).toBe(true);
    expect(STATUS_WORDS.test('commonly distilled, a byte, rebuilt forward')).toBe(false);
    expect(STATUS_WORDS.test('stillness, a yeti, to become, untilled')).toBe(false);
  });

  it('gives each GDD line its section, ended by a heading of level 1 to 3 or a rule', () => {
    const lines = ['intro', '### GDD-WLD-01 A', 'one', '#### deeper', 'still one', '### GDD-WLD-02 B', 'two', '---', 'after the rule', '### GDD-UI-05 C', 'ten', '## Open Questions', '1. q', '### Conflicts', 'c', '# Top', 't', '--- no rule', 'x'];
    expect(ownerOf(lines)).toEqual([null, 'GDD-WLD-01', 'GDD-WLD-01', 'GDD-WLD-01', 'GDD-WLD-01', 'GDD-WLD-02', 'GDD-WLD-02', null, null, 'GDD-UI-05', 'GDD-UI-05', null, null, null, null, null, null, null, null]);
    expect(ownerOf(['### GDD-WLD-01 A', '--- no rule', 'x'])).toEqual(['GDD-WLD-01', 'GDD-WLD-01', 'GDD-WLD-01']);
    expect(ownerOf(['### GDD-WLD-01 A', '# Top', 'x'])).toEqual(['GDD-WLD-01', null, null]);
    expect(ownerOf(['### GDD-WLD-01 A', '---  ', 'x'])).toEqual(['GDD-WLD-01', null, null]);
  });

  it('gives each backlog row its own ID, and a line between rows the section before it', () => {
    expect(ownerOf(['# Backlog', '| GDD ID | Status | Notes |', '| GDD-WLD-01 | done | names GDD-WLD-02 |', '| GDD-WLD-02 | todo |  |', 'x | GDD-WLD-03 | not a row', '| GDD-WLD-04 and no cell end'])).toEqual([null, null, 'GDD-WLD-01', 'GDD-WLD-02', null, null]);
  });

  const gdd = [
    '### GDD-WLD-01 Structure',                                              // 1
    'Built: 1-1 to 1-3. The world map is not built. See GDD-WLD-02.',        // 2
    '### GDD-WLD-02 Worlds',                                                 // 3
    'World 3 has 3-1 only (GDD-WLD-01). It is drawn. It has no boss yet.',   // 4
    '### GDD-UI-05 Menus',                                                   // 5
    'The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1. Nothing else here.',    // 6
    '## Open Questions',                                                     // 7
    '1. Is GDD-WLD-02 final? The Sierra waits.',                             // 8
  ].join('\n');
  const files = [{ name: 'docs/GDD.md', text: gdd }];
  const at = (found) => found.map((f) => `${f.status ? '!' : ' '}${f.line} ${f.text}`);

  it('lists the sentences outside the changed section that name it, a range included, with the status sentences of their line, and inside it only those with a status word', () => {
    expect(at(hunt({ ids: ['GDD-WLD-02'], files }))).toEqual([
      '!2 The world map is not built.',
      '!4 World 3 has 3-1 only (GDD-WLD-01).',
      '!4 It has no boss yet.',
      ' 2 See GDD-WLD-02.',
      ' 6 The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1.',
      ' 8 Is GDD-WLD-02 final?',
    ]);
  });

  it('lists a sentence that holds a term, whatever its case, and ignores an empty term', () => {
    expect(at(hunt({ ids: [], terms: ['sierra', ''], files }))).toEqual([' 8 The Sierra waits.']);
    expect(at(hunt({ ids: [], terms: ['SIERRA'], files }))).toEqual([' 8 The Sierra waits.']);
    expect(at(hunt({ ids: [], terms: ['3-1'], files }))).toEqual(['!4 World 3 has 3-1 only (GDD-WLD-01).', '!4 It has no boss yet.', ' 6 The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1.']);
  });

  it('inside a changed section lists a sentence for a status word or a term, and not for naming an ID', () => {
    expect(at(hunt({ ids: ['GDD-WLD-01', 'GDD-WLD-02'], terms: ['drawn'], files }))).toEqual([
      '!2 The world map is not built.',
      '!4 World 3 has 3-1 only (GDD-WLD-01).',
      '!4 It has no boss yet.',
      ' 4 It is drawn.',
      ' 6 The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1.',
      ' 8 Is GDD-WLD-02 final?',
    ]);
  });

  it('does not list a status sentence outside for standing on a line that names nothing hunted', () => {
    expect(at(hunt({ ids: ['GDD-UI-05'], files }))).toEqual([]);
    expect(at(hunt({ ids: ['GDD-WLD-03'], files }))).toEqual([' 6 The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1.']);
  });

  it('searches a term that starts with in: inside the changed sections only', () => {
    expect(at(hunt({ ids: ['GDD-WLD-02'], terms: ['in:3-1'], files })).filter((l) => l.includes('3-1'))).toEqual(['!4 World 3 has 3-1 only (GDD-WLD-01).', ' 6 The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1.']);
    expect(at(hunt({ ids: [], terms: ['in:3-1'], files }))).toEqual([]);
    expect(at(hunt({ ids: ['GDD-WLD-02'], terms: ['in:drawn'], files }))).toContain(' 4 It is drawn.');
    expect(at(hunt({ ids: ['GDD-WLD-01'], terms: ['in:drawn', 'in:'], files }))).toEqual(['!2 The world map is not built.', '!4 World 3 has 3-1 only (GDD-WLD-01).', '!4 It has no boss yet.', ' 6 The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1.']);
  });

  it('matches a term as a whole word where it starts or ends with a letter or a digit, whatever its case and signs', () => {
    expect(termPattern('top').test('They stop.')).toBe(false);
    expect(termPattern('top').test('The laptop')).toBe(false);
    expect(termPattern('top').test('the Top row')).toBe(true);
    expect(termPattern('3-1').test('13-1')).toBe(false);
    expect(termPattern('3-1').test('3-12')).toBe(false);
    expect(termPattern('a (b)').test('it has A (b) there')).toBe(true);
    expect(termPattern('a.b').test('axb')).toBe(false);
    expect(termPattern('(b)').test('see ((b))')).toBe(true);
    expect(termPattern('"yes"').test('said"yes"then')).toBe(true);
    for (const sign of '.*+?^${}()|[]\\') expect(termPattern(`a${sign}b`).test(`xa${sign}b a${sign}b`), sign).toBe(true);
  });

  it('lists nothing without an ID or a term', () => {
    expect(hunt({ ids: [], files })).toEqual([]);
  });

  it('reads a changed ID own backlog row for status words only, other rows and files for its name', () => {
    const backlog = ['| GDD-WLD-01 | done | after GDD-WLD-02 |', '| GDD-WLD-02 | doing | 3-1 built. Its art is pending. |'].join('\n');
    const found = hunt({ ids: ['GDD-WLD-02'], files: [{ name: 'docs/BACKLOG.md', text: backlog }, { name: 'CLAUDE.md', text: 'x\nFollows GDD-WLD-02.' }] });
    expect(found).toEqual([
      { file: 'docs/BACKLOG.md', line: 2, owner: 'GDD-WLD-02', text: 'Its art is pending. |', status: true },
      { file: 'docs/BACKLOG.md', line: 1, owner: 'GDD-WLD-01', text: '| GDD-WLD-01 | done | after GDD-WLD-02 |', status: false },
      { file: 'CLAUDE.md', line: 2, owner: null, text: 'Follows GDD-WLD-02.', status: false },
    ]);
  });

  it('leaves skipped lines out', () => {
    expect(at(hunt({ ids: ['GDD-WLD-02'], files: [{ name: 'docs/GDD.md', text: gdd, skip: (i) => i === 1 || i === 3 }] }))).toEqual([
      ' 6 The menus of GDD-WLD-01 to GDD-WLD-03 list 3-1.',
      ' 8 Is GDD-WLD-02 final?',
    ]);
  });

  it('writes a result as one line: its mark, place, owner and text, cut to the width', () => {
    const f = { file: 'docs/GDD.md', line: 4, owner: 'GDD-WLD-02', text: 'It has no boss yet.', status: true };
    expect(reportLine(f)).toBe('! docs/GDD.md:4 [GDD-WLD-02] It has no boss yet.');
    expect(reportLine({ ...f, owner: null, status: false })).toBe('  docs/GDD.md:4 It has no boss yet.');
    expect(reportLine(f, 19)).toBe('! docs/GDD.md:4 [GDD-WLD-02] It has no boss yet.');
    expect(reportLine(f, 18)).toBe('! docs/GDD.md:4 [GDD-WLD-02] It has no boss ye…');
    expect(reportLine({ ...f, text: 'x'.repeat(301) })).toBe(`! docs/GDD.md:4 [GDD-WLD-02] ${'x'.repeat(299)}…`);
    expect(reportLine({ ...f, text: 'x'.repeat(300) })).toBe(`! docs/GDD.md:4 [GDD-WLD-02] ${'x'.repeat(300)}`);
  });
  it('reads the arguments: split at commas, IDs apart from terms, up to the next option', () => {
    expect(huntArgs(['GDD-WLD-01, 3-3 ,', 'left right', '--other', 'GDD-WLD-02'])).toEqual({ ids: ['GDD-WLD-01'], terms: ['3-3', 'left right'] });
    expect(huntArgs([])).toEqual({ ids: [], terms: [] });
    expect(huntArgs(['--other'])).toEqual({ ids: [], terms: [] });
    expect(huntArgs(['GDD-WLD-01,GDD-UI-05'])).toEqual({ ids: ['GDD-WLD-01', 'GDD-UI-05'], terms: [] });
  });

  it('takes only a whole GDD ID for an ID, and keeps a comma written with a backslash', () => {
    expect(huntArgs(['gdd-wld-01,GDD-WLD-1x,xGDD-WLD-01,GDD-WLD-01x,GDD-wld-01']).ids).toEqual([]);
    expect(huntArgs(['1-2\\, 1-3 and 1-4,3-3'])).toEqual({ ids: [], terms: ['1-2, 1-3 and 1-4', '3-3'] });
  });
});
