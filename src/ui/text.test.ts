import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGE_NAMES, TEXT } from './text';

/** The rows of the GDD-UI-02 language table: English, Español, Deutsch. */
function gddTable(): string[][] {
  const lines = readFileSync(new URL('../../docs/GDD.md', import.meta.url), 'utf8').split('\n');
  const head = lines.findIndex((l) => l.trim() === '| English | Español | Deutsch |');
  expect(head, 'the table is in the GDD').toBeGreaterThan(-1);
  const rows: string[][] = [];
  for (const line of lines.slice(head + 2)) {
    const t = line.trim();
    if (!t.startsWith('|')) break;
    rows.push(t.slice(1, -1).split('|').map((c) => c.trim()));
  }
  return rows;
}

describe('GDD-UI-02 texts in each language', () => {
  it("the GDD's table matches TEXT", () => {
    const rows = gddTable();
    const en = Object.entries(TEXT.en);
    const es = new Map(Object.entries(TEXT.es));
    const de = new Map(Object.entries(TEXT.de));
    expect(rows).toHaveLength(en.length);
    const seen = new Set<string>();
    for (const [english, spanish, german] of rows) {
      const key = en.find(([, text]) => text === english)?.[0];
      expect(key, `a key for "${english}"`).toBeDefined();
      expect(es.get(key!), `es ${english}`).toBe(spanish);
      expect(de.get(key!), `de ${english}`).toBe(german);
      seen.add(key!);
    }
    // Every key of UiText is in exactly one row.
    expect(seen).toEqual(new Set(en.map(([key]) => key)));
  });

  it('the language names', () => {
    expect(LANGUAGE_NAMES).toEqual({ en: 'English', es: 'Español', de: 'Deutsch' });
  });
});
