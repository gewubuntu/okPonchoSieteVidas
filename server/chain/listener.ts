// GDD-TEC-10, "Chain events": the listener counts each chain event once, after the confirmations, and catches up after an outage.
import { creditBought, EMPTY_WALLET, type WalletLedger } from '../ledger';
import type { Store } from '../store/store';
import { canonicalToken, eventId, isTokenId, normalAddress, type Address, type ChainEvent, type ChainSource } from './chain';

export interface CatchUpResult {
  readonly from: number;
  readonly to: number | null; // null: nothing was safe to read yet
  readonly applied: readonly string[];
  readonly refused: readonly { id: string; reason: string }[];
}

/** Where the listener has got to: the last block handled, or -1 (so it reads from block 0) with nothing stored. */
const cursorOf = (store: Store): number => Number(store.get('chain', 'cursor') ?? -1);

const activationKey = (tokenId: string, season: number): string => `${tokenId}/${season}`;

/** Why the event cannot be applied, or null once it was. */
function apply(store: Store, e: ChainEvent): string | null {
  if (e.kind === 'LivesBought') {
    // GDD-CHAIN-03: LivesBought(buyer, n) adds n bought ledger lives to the buyer's wallet.
    const buyer = normalAddress(e.buyer);
    if (buyer === null) return 'buyer is not an address';
    const row = store.get('wallet', buyer);
    const before: WalletLedger = row === undefined ? EMPTY_WALLET : JSON.parse(row);
    try {
      store.put('wallet', buyer, JSON.stringify(creditBought(before, e.n)));
    } catch (error) {
      if (error instanceof RangeError) return 'n is not a positive whole number';
      throw error;
    }
    return null;
  }
  // GDD-CHAIN-04: Activated(tokenId, owner, season) marks that Pal as activated for that season.
  if (!isTokenId(e.tokenId)) return 'tokenId is not a token ID';
  const owner = normalAddress(e.owner);
  if (owner === null) return 'owner is not an address';
  if (!Number.isSafeInteger(e.season) || e.season < 1) return 'season is not a season';
  // The owner is kept beside the activation and nothing reads it: an activation follows the Pal to a new owner within its season (Decided, user, 2026-11-26, Open Question 55 (b)).
  store.put('activation', activationKey(canonicalToken(e.tokenId), e.season), JSON.stringify({ owner, block: e.block }));
  return null;
}

/**
 * Reads the blocks after the cursor that have `confirmations` blocks after them and applies their events.
 * Placeholder: with no cursor stored it starts at block 0; a real chain needs the contract's deploy block, which is not decided.
 */
export async function catchUp(chain: ChainSource, store: Store, confirmations: number): Promise<CatchUpResult> {
  // GDD-TEC-10: "after an outage the listener catches up from the last block it handled".
  const from = cursorOf(store) + 1;
  // GDD-TEC-10: "only after CHAIN.confirmations blocks". Reading: a block counts once `confirmations` blocks have followed it.
  const safe = (await chain.head()) - confirmations;
  if (safe < from) return { from, to: null, applied: [], refused: [] };
  const events = await chain.events(from, safe);
  return store.transaction(() => {
    const applied: string[] = [];
    const refused: { id: string; reason: string }[] = [];
    for (const e of events) {
      const id = eventId(e);
      // GDD-TEC-10: "each event counts once however often it is read". Another call may have counted it while this one awaited.
      if (store.get('event', id) !== undefined) continue;
      const reason = apply(store, e);
      // A refused event is recorded too, so it counts once and the listener never sticks on it.
      store.put('event', id, JSON.stringify(reason === null ? { block: e.block, applied: true } : { block: e.block, applied: false, reason }));
      if (reason === null) applied.push(id);
      else refused.push({ id, reason });
    }
    // Another call may have moved the cursor while this one awaited: it never goes back.
    store.put('chain', 'cursor', String(Math.max(cursorOf(store), safe)));
    return { from, to: safe, applied, refused };
  });
}

export function activationOf(store: Store, tokenId: string, season: number): { owner: Address; block: number } | null {
  if (!isTokenId(tokenId)) return null;
  const row = store.get('activation', activationKey(canonicalToken(tokenId), season));
  if (row === undefined) return null;
  const activation: { owner: Address; block: number } = JSON.parse(row);
  return activation;
}
