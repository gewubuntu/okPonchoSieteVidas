// GDD-TEC-10, docs/decisions/0004-game-server.md ("The mock chain"): the chain as the server reads it.
// Async because the real source (viem, a later phase) is; the store stays synchronous.
// `verifySignature` is not here: it belongs to the wallet sessions and is added with its first caller.
// Who owns a Pal (`ownerOf`, `palsOf` in ADR 0004) is left out until Open Question 54 (c) is put to the user, with its first caller (start tokens, phase C).
export type Address = string; // 0x and 40 hex digits, as read
export interface EventPlace { readonly block: number; readonly txHash: string; readonly logIndex: number }
export type ChainEvent =
  | (EventPlace & { readonly kind: 'LivesBought'; readonly buyer: Address; readonly n: number })
  | (EventPlace & { readonly kind: 'Activated'; readonly tokenId: string; readonly owner: Address; readonly season: number });

export interface ChainSource {
  head(): Promise<number>; // the latest sealed block number
  events(fromBlock: number, toBlock: number): Promise<readonly ChainEvent[]>; // both ends included; in block, then log index, order
}

/** Placeholder: an event is its transaction hash and log index, not its block; that is what "counts once" rests on (GDD-TEC-10). */
export const eventId = (e: EventPlace): string => `${e.txHash}:${e.logIndex}`;
/** Placeholder: addresses are kept lowercased, so a checksummed and a lowercase spelling are one wallet. Null: not an address. */
export const normalAddress = (a: string): Address | null => (/^0x[0-9a-fA-F]{40}$/.test(a) ? a.toLowerCase() : null);
