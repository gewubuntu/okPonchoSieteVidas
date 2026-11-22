import type { Store, Table } from './store';

const at = (table: Table, key: string): string => `${table}\n${key}`;

export function memoryStore(): Store {
  let rows = new Map<string, string>();
  return {
    get: (table, key) => rows.get(at(table, key)),
    put: (table, key, value) => {
      rows.set(at(table, key), value);
    },
    delete: (table, key) => rows.delete(at(table, key)),
    entries: (table) => [...rows].filter(([k]) => k.startsWith(`${table}\n`)).map(([k, v]) => [k.slice(table.length + 1), v] as const),
    transaction: (work) => {
      const before = new Map(rows);
      try {
        return work();
      } catch (error) {
        rows = before;
        throw error;
      }
    },
  };
}
