import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryStore } from './memory';
import { sqliteStore } from './sqlite';
import type { Store } from './store';

describe.each([
  ['memory', (): Store => memoryStore()],
  ['sqlite', (): Store => sqliteStore(':memory:')],
])('GDD-TEC-10 store: %s', (_kind, open) => {
  it('a value put is read back, apart for each table', () => {
    const store = open();
    store.put('wallet', 'a', '1');
    store.put('pal', 'a', '2');
    expect(store.get('wallet', 'a')).toBe('1');
    expect(store.get('pal', 'a')).toBe('2');
    expect(store.get('wallet', 'b')).toBeUndefined();
  });

  it('a second put replaces the first', () => {
    const store = open();
    store.put('wallet', 'a', '1');
    store.put('wallet', 'a', '3');
    expect(store.get('wallet', 'a')).toBe('3');
  });

  it('delete says whether the row was there', () => {
    const store = open();
    store.put('wallet', 'a', '1');
    expect(store.delete('wallet', 'a')).toBe(true);
    expect(store.delete('wallet', 'a')).toBe(false);
  });

  it('entries lists one table rows only, by key', () => {
    const store = open();
    store.put('wallet', 'a', '1');
    store.put('pal', 'a', '2');
    expect(store.entries('wallet')).toEqual([['a', '1']]);
  });

  it('a transaction that throws leaves nothing written', () => {
    const store = open();
    store.put('wallet', 'a', '3');
    expect(() =>
      store.transaction(() => {
        store.put('wallet', 'a', '9');
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(store.get('wallet', 'a')).toBe('3');
  });

  it('a transaction returns what its work returns', () => {
    const store = open();
    expect(store.transaction(() => 42)).toBe(42);
  });
});

describe('GDD-TEC-10 store: sqlite file', () => {
  it('what was written is there after the file is opened again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'poncho-'));
    try {
      const path = join(dir, 'server.db');
      const first = sqliteStore(path);
      first.put('wallet', 'a', '1');
      first.close();
      const again = sqliteStore(path);
      expect(again.get('wallet', 'a')).toBe('1');
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
