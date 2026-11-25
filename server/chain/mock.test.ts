import { describe, expect, it } from 'vitest';
import { mockChain } from './mock';

const A = '0x' + 'ab'.repeat(20);
const A_MIXED = '0x' + 'AB'.repeat(20);
const B = '0x' + 'cd'.repeat(20);

describe('GDD-TEC-10 mock chain', () => {
  it('emitted events land in the head block and are read by range', async () => {
    const chain = mockChain();
    chain.emitLivesBought(A, 1);
    chain.mine();
    chain.emitLivesBought(A, 2);
    chain.emitActivated('7', A, 1);
    chain.mine(2);
    expect(await chain.head()).toBe(3);
    const first = await chain.events(0, 0);
    expect(first.map((e) => [e.block, e.logIndex])).toEqual([[0, 0]]);
    const second = await chain.events(1, 1);
    expect(second.map((e) => [e.block, e.logIndex])).toEqual([[1, 0], [1, 1]]);
    expect(second.map((e) => e.kind)).toEqual(['LivesBought', 'Activated']);
    const all = await chain.events(0, 3);
    expect(all.map((e) => [e.block, e.logIndex])).toEqual([[0, 0], [1, 0], [1, 1]]);
    expect(await chain.events(2, 3)).toEqual([]);
    expect(new Set(all.map((e) => e.txHash)).size).toBe(3);
    for (const e of all) expect(e.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('mine refuses a count that is not a positive whole number', async () => {
    const chain = mockChain();
    expect(() => chain.mine(0)).toThrow(RangeError);
    expect(() => chain.mine(1.5)).toThrow(RangeError);
    expect(await chain.head()).toBe(0);
  });

  it('ownerOf and palsOf read the owners set', async () => {
    const chain = mockChain();
    chain.setOwner('10', A);
    chain.setOwner('2', A_MIXED);
    chain.setOwner('5', B);
    expect(await chain.ownerOf('10')).toBe(A);
    expect(await chain.ownerOf('7')).toBeNull();
    expect(await chain.palsOf(A)).toEqual(['2', '10']);
    chain.setOwner('10', null);
    expect(await chain.ownerOf('10')).toBeNull();
    expect(await chain.palsOf(A)).toEqual(['2']);
  });
});
