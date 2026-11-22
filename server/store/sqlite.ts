import { DatabaseSync } from 'node:sqlite';
import type { Store } from './store';

export function sqliteStore(path: string): Store & { close(): void } {
  const db = new DatabaseSync(path);
  db.exec('pragma journal_mode = wal; pragma synchronous = full;');
  db.exec('create table if not exists kv (tbl text not null, key text not null, value text not null, primary key (tbl, key)) strict, without rowid');
  const get = db.prepare('select value from kv where tbl = ? and key = ?');
  const put = db.prepare('insert into kv (tbl, key, value) values (?, ?, ?) on conflict (tbl, key) do update set value = excluded.value');
  const del = db.prepare('delete from kv where tbl = ? and key = ?');
  const all = db.prepare('select key, value from kv where tbl = ? order by key');
  return {
    get: (table, key) => {
      const row = get.get(table, key);
      return typeof row?.['value'] === 'string' ? row['value'] : undefined;
    },
    put: (table, key, value) => {
      put.run(table, key, value);
    },
    delete: (table, key) => del.run(table, key).changes > 0,
    entries: (table) => all.all(table).map((row) => [String(row['key']), String(row['value'])] as const),
    transaction: (work) => {
      db.exec('begin immediate');
      try {
        const result = work();
        db.exec('commit');
        return result;
      } catch (error) {
        db.exec('rollback');
        throw error;
      }
    },
    close: () => {
      db.close();
    },
  };
}
