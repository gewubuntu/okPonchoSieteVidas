export type Table = 'wallet' | 'pal' | 'event' | 'meta' | 'activation' | 'token' | 'nonce' | 'session' | 'save' | 'hero';
export interface Store {
  get(table: Table, key: string): string | undefined;
  put(table: Table, key: string, value: string): void;
  delete(table: Table, key: string): boolean; // whether the row was there
  entries(table: Table): readonly (readonly [string, string])[];
  transaction<T>(work: () => T): T; // synchronous; never nested
}
