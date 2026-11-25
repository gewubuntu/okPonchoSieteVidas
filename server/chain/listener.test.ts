import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChainSource } from './chain';
import { activationOf, catchUp } from './listener';
import { mockChain } from './mock';
import { memoryStore } from '../store/memory';
import { sqliteStore } from '../store/sqlite';
import type { Store } from '../store/store';

const A = '0x' + 'ab'.repeat(20);
const A_MIXED = '0x' + 'AB'.repeat(20);
const B = '0x' + 'cd'.repeat(20);

const wallet = (store: Store, key: string): unknown => {
  const row = store.get('wallet', key);
  return row === undefined ? undefined : JSON.parse(row);
};

describe('GDD-TEC-10 chain listener', () => {
  it('LivesBought adds n bought lives to the buyer', async () => {
    const chain = mockChain();
    const store = memoryStore();
    store.put('wallet', A, JSON.stringify({ day: 20778, used: 2, bought: 5 }));
    chain.emitLivesBought(A, 7);
    chain.mine(3);
    const result = await catchUp(chain, store, 3);
    expect(wallet(store, A)).toEqual({ day: 20778, used: 2, bought: 12 });
    expect(result.applied).toHaveLength(1);
    expect(result.refused).toEqual([]);
  });

  it('a buyer with no row starts from the empty wallet', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(B, 7);
    chain.mine(3);
    await catchUp(chain, store, 3);
    expect(wallet(store, B)).toEqual({ day: 0, used: 0, bought: 7 });
  });

  it('one wallet however the address is spelled', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A_MIXED, 7);
    chain.emitLivesBought(A, 1);
    chain.mine(3);
    await catchUp(chain, store, 3);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 8 });
    expect(store.get('wallet', A_MIXED)).toBeUndefined();
  });

  it('Activated marks the Pal activated for that season', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitActivated('42', A_MIXED, 2);
    chain.emitActivated('44', B, 1);
    chain.mine(3);
    await catchUp(chain, store, 3);
    expect(activationOf(store, '42', 2)).toEqual({ owner: A, block: 0 });
    expect(activationOf(store, '44', 1)).toEqual({ owner: B, block: 0 });
    expect(activationOf(store, '42', 1)).toBeNull();
    expect(activationOf(store, '43', 2)).toBeNull();
  });

  it('counts once however often it is read', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 7);
    chain.mine(3);
    await catchUp(chain, store, 3);
    await catchUp(chain, store, 3);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
    expect(store.delete('chain', 'cursor')).toBe(true);
    const again = await catchUp(chain, store, 3);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
    expect(again.applied).toEqual([]);
  });

  it('two overlapping catch-ups count each event once', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 7);
    chain.mine(3);
    const [one, two] = await Promise.all([catchUp(chain, store, 3), catchUp(chain, store, 3)]);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
    expect(one.applied.length + two.applied.length).toBe(1);
  });

  it('waits for CHAIN.confirmations blocks', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 7);
    chain.mine(2);
    const early = await catchUp(chain, store, 3);
    expect(store.get('wallet', A)).toBeUndefined();
    expect(early.to).toBeNull();
    chain.mine(1);
    const result = await catchUp(chain, store, 3);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
    expect(result).toMatchObject({ from: 0, to: 0 });
  });

  it('with no confirmations an event counts in the head block', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 7);
    await catchUp(chain, store, 0);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
  });

  it('the cursor is the last block handled and never moves back', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 1);
    chain.mine(5);
    await catchUp(chain, store, 3);
    expect(store.get('chain', 'cursor')).toBe('2');
    const idle = await catchUp(chain, store, 4);
    expect(idle.to).toBeNull();
    expect(store.get('chain', 'cursor')).toBe('2');
    store.put('chain', 'cursor', '9');
    chain.emitLivesBought(A, 1);
    chain.mine(10);
    const result = await catchUp(chain, store, 3);
    expect(result).toMatchObject({ from: 10, to: 12 });
    expect(store.get('chain', 'cursor')).toBe('12');

    // An overlapping call that read an older cursor does not lower it.
    const chain2 = mockChain();
    const store2 = memoryStore();
    chain2.mine(5);
    let entered!: () => void;
    const inside = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    const slow: ChainSource = {
      ...chain2,
      events: async (from, to) => {
        if (first) {
          first = false;
          entered();
          await gate;
        }
        return chain2.events(from, to);
      },
    };
    const one = catchUp(slow, store2, 3);
    await inside;
    chain2.mine(3);
    await catchUp(chain2, store2, 3);
    expect(store2.get('chain', 'cursor')).toBe('5');
    release();
    await one;
    expect(store2.get('chain', 'cursor')).toBe('5');
  });

  it.each(['memory', 'sqlite'])('after an outage it catches up from the last block it handled on %s', async (kind) => {
    const dir = mkdtempSync(join(tmpdir(), 'poncho-listener-'));
    const file = join(dir, 'ledger.db');
    const memory = memoryStore();
    const open = (): Store & { close?: () => void } => (kind === 'sqlite' ? sqliteStore(file) : memory);
    try {
      const chain = mockChain();
      let store = open();
      chain.emitLivesBought(A, 7);
      chain.mine(3);
      await catchUp(chain, store, 3);
      expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
      expect(store.get('chain', 'cursor')).toBe('0');
      store.close?.();
      // The server is down: purchases at blocks 3 and 4.
      chain.emitLivesBought(A, 1);
      chain.mine(1);
      chain.emitLivesBought(A, 2);
      chain.mine(5);
      store = open();
      const result = await catchUp(chain, store, 3);
      expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 10 });
      expect(result).toMatchObject({ from: 1, to: 6 });
      expect(result.applied).toHaveLength(2);
      store.close?.();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a failed read writes nothing, and the next one counts it', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 7);
    chain.mine(3);
    let failed = false;
    const flaky: ChainSource = {
      ...chain,
      events: async (from, to) => {
        if (!failed) {
          failed = true;
          throw new Error('rpc down');
        }
        return chain.events(from, to);
      },
    };
    await expect(catchUp(flaky, store, 3)).rejects.toThrow('rpc down');
    expect(store.get('wallet', A)).toBeUndefined();
    expect(store.get('chain', 'cursor')).toBeUndefined();
    await catchUp(flaky, store, 3);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
  });

  it('an event that does not read is refused, counts once, and the listener goes on', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 0);
    chain.emitLivesBought(A, 2.5);
    chain.emitLivesBought('0x12', 7);
    chain.emitActivated('x1', A, 1);
    chain.emitActivated('1', 'nope', 1);
    chain.emitActivated('1', A, 0);
    chain.emitActivated('1', A, 1.5);
    chain.emitLivesBought(A, 7);
    chain.mine(3);
    const result = await catchUp(chain, store, 3);
    expect(result.refused.map((r) => r.reason)).toEqual([
      'n is not a positive whole number',
      'n is not a positive whole number',
      'buyer is not an address',
      'tokenId is not a token ID',
      'owner is not an address',
      'season is not a season',
      'season is not a season',
    ]);
    expect(result.applied).toHaveLength(1);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
    expect(activationOf(store, '1', 0)).toBeNull();
    expect(activationOf(store, '1', 1)).toBeNull();
    for (const { id } of result.refused) expect(JSON.parse(store.get('event', id) ?? 'null')).toMatchObject({ applied: false });
    store.delete('chain', 'cursor');
    const again = await catchUp(chain, store, 3);
    expect(again.refused).toEqual([]);
    expect(again.applied).toEqual([]);
  });

  it('a write that fails midway leaves the whole batch unwritten', async () => {
    const chain = mockChain();
    const store = memoryStore();
    chain.emitLivesBought(A, 7);
    chain.mine(3);
    const full: Store = {
      ...store,
      put: (table, key, value) => {
        if (table === 'chain') throw new Error('disk full');
        store.put(table, key, value);
      },
    };
    await expect(catchUp(chain, full, 3)).rejects.toThrow('disk full');
    expect(store.get('wallet', A)).toBeUndefined();
    expect(store.entries('event')).toEqual([]);
    await catchUp(chain, store, 3);
    expect(wallet(store, A)).toEqual({ day: 0, used: 0, bought: 7 });
  });
});
