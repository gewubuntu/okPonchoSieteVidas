import { describe, expect, it } from 'vitest';
import { lessonBrief, lessonEntry } from './lessons.mjs';

describe('lessons (L-098)', () => {
  const occurrence = (n) => `- **Recurrence ${n} (2026-11-0${n}, PR #${n}):** what happened ${n}.`;
  const entry = (id, ns) => [`## ${id} A title`, '', '- **Date:** 2026-10-19', '- **Rule:** the rule', ...ns.map(occurrence), `- **Recurrence:** ${ns.length + 1}`, '- **Promoted:** no'].join('\n');
  const file = ['# Lessons', '', '```', '## L-000 Short title', '- **Rule:** template', '```', '', '## Entries', '', entry('L-001', []), '', entry('L-002', [2, 3]), '', entry('L-010', [2]), ''].join('\n');

  it('finds an entry by its ID, without the blank lines after it', () => {
    expect(lessonEntry(file, 'L-002')).toBe(entry('L-002', [2, 3]));
    expect(lessonEntry(file, 'L-010')).toBe(entry('L-010', [2]));
  });

  it('reads past a second code fence, and takes only a three-digit ID for the start of an entry', () => {
    const two = ['```', '## L-000 Short title', '```', '', '## L-001 A', '- **Rule:** one, see ```## L-002 quoted```', '', '## L-1 a heading that is no entry', '- **Rule:** still L-001', '', '## L-002 B', '- **Rule:** two', '', '```', 'another fence', '```', ''].join('\n');
    expect(lessonEntry(two, 'L-001')).toBe(['## L-001 A', '- **Rule:** one, see ', '', '## L-1 a heading that is no entry', '- **Rule:** still L-001'].join('\n'));
    expect(lessonEntry(two, 'L-002')).toBe('## L-002 B\n- **Rule:** two');
  });

  it('finds no entry for an unknown ID, a part of an ID, or the template', () => {
    expect(lessonEntry(file, 'L-003')).toBeNull();
    expect(lessonEntry(file, 'L-01')).toBeNull();
    expect(lessonEntry(file, 'L-000')).toBeNull();
  });

  it('keeps an entry whole while it has no more occurrences than it keeps', () => {
    expect(lessonBrief(entry('L-001', []))).toBe(entry('L-001', []));
    expect(lessonBrief(entry('L-002', [2, 3, 4]))).toBe(entry('L-002', [2, 3, 4]));
    expect(lessonBrief(entry('L-002', [2, 3]))).toBe(entry('L-002', [2, 3]));
  });

  it('keeps the last three occurrences and says how many it left out, where they stood', () => {
    expect(lessonBrief(entry('L-002', [2, 3, 4, 5, 6])).split('\n')).toEqual([
      '## L-002 A title', '', '- **Date:** 2026-10-19', '- **Rule:** the rule',
      '- (2 earlier occurrences left out; docs/LESSONS.md has them)',
      occurrence(4), occurrence(5), occurrence(6), '- **Recurrence:** 6', '- **Promoted:** no',
    ]);
  });

  it('takes a line that records two occurrences for one of them', () => {
    const both = entry('L-002', [4, 5, 6]).replace(occurrence(4), `- **Recurrence 2 and 3 (2026-11-01, PR #1):** two at once.\n${occurrence(4)}`);
    expect(lessonBrief(both).split('\n').slice(4, 6)).toEqual(['- (1 earlier occurrence left out; docs/LESSONS.md has it)', occurrence(4)]);
  });

  it('words one left-out occurrence in the singular', () => {
    expect(lessonBrief(entry('L-002', [2, 3, 4, 5])).split('\n')[4]).toBe('- (1 earlier occurrence left out; docs/LESSONS.md has it)');
  });

  it('keeps as many as asked, none included, and never the count line for an occurrence', () => {
    expect(lessonBrief(entry('L-002', [2, 3, 4]), 1).split('\n').slice(4)).toEqual(['- (2 earlier occurrences left out; docs/LESSONS.md has them)', occurrence(4), '- **Recurrence:** 4', '- **Promoted:** no']);
    expect(lessonBrief(entry('L-002', [2, 3]), 0).split('\n').slice(4)).toEqual(['- (2 earlier occurrences left out; docs/LESSONS.md has them)', '- **Recurrence:** 3', '- **Promoted:** no']);
  });
});
