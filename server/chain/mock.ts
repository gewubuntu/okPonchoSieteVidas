// GDD-TEC-10, docs/decisions/0004-game-server.md: the mock chain is what tests and local runs use.
// Placeholder (Open Question 54 (c)): `ownerOf` and `palsOf`, read as a token is asked for, stand in for the collection read.
import type { Address, ChainEvent, ChainSource } from './chain';

export interface MockChain extends ChainSource {
  emitLivesBought(buyer: Address, n: number): ChainEvent;
  emitActivated(tokenId: string, owner: Address, season: number): ChainEvent;
  /** `null` removes the token. */
  setOwner(tokenId: string, owner: Address | null): void;
  /** Raises the head by `blocks` (a whole number of at least 1) and returns it. */
  mine(blocks?: number): number;
}

const byNumber = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);

/** In memory, from head 0. It keeps what it is given as given, so a test can send an event that does not read. */
export function mockChain(): MockChain {
  let head = 0;
  let txCount = 0;
  const log: ChainEvent[] = [];
  const owners = new Map<string, Address>();
  // An event goes into the head block, the one being built, its log index counting from 0 within the block.
  const place = () => ({ block: head, logIndex: log.filter((e) => e.block === head).length, txHash: `0x${(++txCount).toString(16).padStart(64, '0')}` });
  const emit = (event: ChainEvent): ChainEvent => {
    log.push(event);
    return event;
  };
  return {
    head: () => Promise.resolve(head),
    events: (from, to) => Promise.resolve(log.filter((e) => from <= e.block && e.block <= to)),
    ownerOf: (tokenId) => Promise.resolve(owners.get(tokenId) ?? null),
    palsOf: (owner) => Promise.resolve([...owners].filter(([, o]) => o.toLowerCase() === owner.toLowerCase()).map(([id]) => id).toSorted(byNumber)),
    emitLivesBought: (buyer, n) => emit({ kind: 'LivesBought', ...place(), buyer, n }),
    emitActivated: (tokenId, owner, season) => emit({ kind: 'Activated', ...place(), tokenId, owner, season }),
    setOwner: (tokenId, owner) => {
      if (owner === null) owners.delete(tokenId);
      else owners.set(tokenId, owner);
    },
    mine: (blocks = 1) => {
      if (!Number.isSafeInteger(blocks) || blocks < 1) throw new RangeError(`mine takes a positive whole number of blocks, not ${blocks}`);
      head += blocks;
      return head;
    },
  };
}
