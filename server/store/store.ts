// The ledger's kinds of row (GDD-TEC-10): per wallet, per Pal token ID, the listener's cursor (`chain`), each chain event handled (`event`), each Pal's activation per season (`activation`), each start token issued (`token`), the nonces given out and not yet used (`nonce`), the sessions by the SHA-256 of their secret (`session`). Each later table comes with the code that reads it.
export type Table = 'wallet' | 'pal' | 'chain' | 'event' | 'activation' | 'token' | 'nonce' | 'session';
export interface Store {
  get(table: Table, key: string): string | undefined;
  put(table: Table, key: string, value: string): void;
  delete(table: Table, key: string): boolean; // whether the row was there
  /** One table's rows, by key compared as plain text: byte by byte in UTF-8, as SQLite orders text (so '10' before '9', 'B' before 'a'). */
  entries(table: Table): readonly (readonly [string, string])[];
  transaction<T>(work: () => T): T; // synchronous; never nested
}
