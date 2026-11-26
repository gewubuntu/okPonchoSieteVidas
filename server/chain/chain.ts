// GDD-TEC-10, docs/decisions/0004-game-server.md ("The mock chain"): the chain as the server reads it.
// Async because the real source (viem, a later phase) is; the store stays synchronous.
// `verifySignature` is not here: it belongs to the wallet sessions and is added with its first caller.
// `ownerOf` reads the collection as a start token is asked for (Decided, user, 2026-11-26, Open Question 54 (c)); `palsOf` (ADR 0004) is not here, since nothing asks for it until hero select, which is not in the first wave.
export type Address = string; // 0x and 40 hex digits, as read
export interface EventPlace { readonly block: number; readonly txHash: string; readonly logIndex: number }
export type ChainEvent =
  | (EventPlace & { readonly kind: 'LivesBought'; readonly buyer: Address; readonly n: number })
  | (EventPlace & { readonly kind: 'Activated'; readonly tokenId: string; readonly owner: Address; readonly season: number });

export interface ChainSource {
  head(): Promise<number>; // the latest sealed block number
  events(fromBlock: number, toBlock: number): Promise<readonly ChainEvent[]>; // both ends included; in block, then log index, order
  ownerOf(tokenId: string): Promise<Address | null>; // the collection's owner of the Pal, as read now; null: no such token
}

/** Placeholder: an event is its transaction hash and log index, not its block; that is what "counts once" rests on (GDD-TEC-10). */
export const eventId = (e: EventPlace): string => `${e.txHash}:${e.logIndex}`;
/** Placeholder: addresses are kept lowercased, so a checksummed and a lowercase spelling are one wallet. Null: not an address. */
export const normalAddress = (a: string): Address | null => (/^0x[0-9a-fA-F]{40}$/.test(a) ? a.toLowerCase() : null);

/** Placeholder: a token ID is a run of decimal digits. */
export const isTokenId = (t: string): boolean => /^\d+$/.test(t);
/** Placeholder: '007' and '7' are one token, so a Pal is keyed by its canonical decimal. */
export const canonicalToken = (tokenId: string): string => BigInt(tokenId).toString();
