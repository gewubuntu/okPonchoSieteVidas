// GDD-TEC-10, docs/decisions/0004-game-server.md: the mock chain is what tests and local runs use.
import { canonicalToken, type Address, type ChainEvent, type ChainSource } from './chain';

export interface MockChain extends ChainSource {
  emitLivesBought(buyer: Address, n: number): ChainEvent;
  emitActivated(tokenId: string, owner: Address, season: number): ChainEvent;
  /** Seals the blocks up to `head + blocks` (a whole number of at least 1), the block holding what was emitted since among them, and returns the new head. */
  mine(blocks?: number): number;
  /** Sets who owns the Pal as the collection holds it now, as given (null: no owner, the token is gone); the token is kept by its canonical number. */
  setOwner(tokenId: string, owner: Address | null): void;
}

/** In memory, from head 0, an empty genesis block. It keeps what it is given as given, so a test can send an event that does not read. */
export function mockChain(): MockChain {
  let head = 0; // the last sealed block
  let txCount = 0;
  const log: ChainEvent[] = [];
  const owners = new Map<string, Address>();
  // An event goes into the next block, `head + 1`, not yet sealed (so not yet read), its log index counting from 0 within the block.
  const place = () => ({ block: head + 1, logIndex: log.filter((e) => e.block === head + 1).length, txHash: `0x${(++txCount).toString(16).padStart(64, '0')}` });
  const emit = (event: ChainEvent): ChainEvent => {
    log.push(event);
    return event;
  };
  return {
    head: () => Promise.resolve(head),
    // Never a block above the head: an open block is not read, so the listener cannot pass an event that lands in it later.
    events: (from, to) => Promise.resolve(log.filter((e) => from <= e.block && e.block <= to && e.block <= head)),
    emitLivesBought: (buyer, n) => emit({ kind: 'LivesBought', ...place(), buyer, n }),
    emitActivated: (tokenId, owner, season) => emit({ kind: 'Activated', ...place(), tokenId, owner, season }),
    ownerOf: (tokenId) => Promise.resolve(owners.get(canonicalToken(tokenId)) ?? null),
    setOwner: (tokenId, owner) => {
      if (owner === null) owners.delete(canonicalToken(tokenId));
      else owners.set(canonicalToken(tokenId), owner);
    },
    mine: (blocks = 1) => {
      if (!Number.isSafeInteger(blocks) || blocks < 1) throw new RangeError(`mine takes a positive whole number of blocks, not ${blocks}`);
      head += blocks;
      return head;
    },
  };
}
