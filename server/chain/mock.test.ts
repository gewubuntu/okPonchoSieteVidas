import { describe, expect, it } from 'vitest';
import { mockChain } from './mock';

const A = '0x' + 'ab'.repeat(20);

describe('GDD-TEC-10 mock chain', () => {
  it('emitted events land in the next block and are read once it is mined', async () => {
    const chain = mockChain();
    const first = chain.emitLivesBought(A, 1);
    expect([first.block, first.logIndex]).toEqual([1, 0]);
    // Head 0 is the empty genesis block: block 1 is open, and not read whatever range is asked for.
    expect(await chain.head()).toBe(0);
    expect(await chain.events(0, 0)).toEqual([]);
    expect(await chain.events(0, 5)).toEqual([]);
    chain.mine();
    expect(await chain.head()).toBe(1);
    expect((await chain.events(0, 1)).map((e) => [e.block, e.logIndex])).toEqual([[1, 0]]);
    chain.emitLivesBought(A, 2);
    chain.emitActivated('7', A, 1);
    chain.mine(2); // seals blocks 2 and 3; both emits are in block 2
    expect(await chain.head()).toBe(3);
    const second = await chain.events(2, 2);
    expect(second.map((e) => [e.block, e.logIndex])).toEqual([[2, 0], [2, 1]]);
    expect(second.map((e) => e.kind)).toEqual(['LivesBought', 'Activated']);
    const all = await chain.events(0, 3);
    expect(all.map((e) => [e.block, e.logIndex])).toEqual([[1, 0], [2, 0], [2, 1]]);
    expect((await chain.events(1, 1)).map((e) => [e.block, e.logIndex])).toEqual([[1, 0]]);
    expect(await chain.events(3, 3)).toEqual([]);
    expect(new Set(all.map((e) => e.txHash)).size).toBe(3);
    for (const e of all) expect(e.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('mine refuses a count that is not a positive whole number', async () => {
    const chain = mockChain();
    expect(() => chain.mine(0)).toThrow(RangeError);
    expect(() => chain.mine(1.5)).toThrow(RangeError);
    expect(await chain.head()).toBe(0);
  });
});
