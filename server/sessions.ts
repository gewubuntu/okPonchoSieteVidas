// GDD-TEC-10, "Wallet sessions": Sign-In with Ethereum. The wallet signs a message that names the game's site, Base and a nonce the
// server gave out once; the server checks it and opens a session. A session is a random secret the player keeps (phase D puts it in a
// cookie); the store holds only its SHA-256, so a copy of the store opens nothing (docs/decisions/0004-game-server.md, "Sessions").
// Several sessions of one wallet are all good: nothing but the wallet is the player's (GDD-CHAIN-02, "One wallet, many browsers").
// One of the two files that import viem (the other is server/chain/viem.ts, a later phase).
import { createHash } from 'node:crypto';
import { isHex, recoverMessageAddress } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import type { Address, ChainSource } from './chain/chain';
import { BASE_CHAIN_ID, type ServerConfig } from './config';
import type { Store } from './store/store';

/** Placeholder: where the game is served is not decided (ADR 0004, "Not decided here"), so the domain and URI the message must name are handed in. */
export interface SignInSite { readonly domain: string; readonly uri: string }
export interface SessionDeps {
  readonly store: Store;
  readonly chain: ChainSource;
  readonly config: ServerConfig;
  readonly site: SignInSite;
  readonly random: (bytes: number) => Buffer;
}
export type SignedIn =
  | { readonly ok: true; readonly wallet: Address; readonly secret: string; readonly expiresAt: number }
  | { readonly ok: false; readonly reason: string };

const refuse = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const sha256hex = (text: string): string => createHash('sha256').update(text).digest('hex');

/**
 * A nonce for a sign-in message: 16 random bytes as 32 lowercase hex digits (SIWE needs at least 8 alphanumeric characters).
 * Placeholder, the user's answer (2026-11-26, "Until used, for now (Recommended)"): it is good once and has no time limit; a time limit
 * can be set later as a named config value.
 */
export function issueNonce(deps: SessionDeps): string {
  const nonce = deps.random(16).toString('hex');
  deps.store.put('nonce', nonce, '{}');
  return nonce;
}

/** A plain key's signature is recovered to its address; only when that is not the message's address is the chain asked, for a contract wallet (ERC-1271, ERC-6492). */
async function signedBy(chain: ChainSource, address: Address, message: string, signature: string): Promise<boolean> {
  // A text that is not hex is no signature at all, and the chain is never asked about it.
  if (!isHex(signature)) return false;
  // A hex signature that does not recover is no plain key's: the chain is asked.
  const recovered = await recoverMessageAddress({ message, signature }).catch(() => null);
  if (recovered !== null && recovered.toLowerCase() === address) return true;
  return chain.verifySignature(address, message, signature);
}

/**
 * Checks the signed message and opens a session. Every refusal before the signature leaves the nonce unspent; from the nonce on it is spent,
 * whatever the signature turns out to be.
 * Placeholder (Open Question 54 (d), ADR 0004): the session row keeps the wallet address and the end time; an ended session is deleted as it is read; nothing else is deleted.
 * A session lasts `SESSION.length` seconds from the sign-in, with no renewal (the mock's stand-in for the unset length is in `MOCK_PLACEHOLDERS`).
 */
export async function signIn(deps: SessionDeps, request: { message: string; signature: string }, nowMs: number): Promise<SignedIn> {
  const { store, chain, config, site, random } = deps;
  const { message, signature } = request;
  const parsed = parseSiweMessage(message);
  // The parser reads a message in two blocks, the domain with the address and then the URI with the chain and the nonce, and gives nothing of a block it cannot read:
  // so the address and the nonce stand for their blocks, and a missing domain, URI or chain ID is covered by them (L-025).
  if (parsed.address === undefined || parsed.nonce === undefined) return refuse('not a sign-in message');
  if (parsed.domain !== site.domain) return refuse('not this game\'s site');
  if (parsed.uri !== site.uri) return refuse('not this game\'s site');
  // The scheme is optional in a message; given, it is the site's.
  if (parsed.scheme !== undefined && `${parsed.scheme}:` !== new URL(site.uri).protocol) return refuse('not this game\'s site');
  if (parsed.chainId !== BASE_CHAIN_ID) return refuse('not on Base');
  if (parsed.version !== '1') return refuse('not a sign-in message');
  // The parser reads only `0x` and 40 hex digits as an address, so it needs no check of its own here; lowercased, it is one wallet however spelled.
  const address: Address = parsed.address.toLowerCase();
  // The parser gives an invalid date for a time it cannot read; such a time is refused, never taken as no time at all.
  const expires = parsed.expirationTime?.getTime();
  const from = parsed.notBefore?.getTime();
  if (Number.isNaN(expires ?? 0) || Number.isNaN(from ?? 0)) return refuse('not a sign-in message');
  // No expiry is an expiry never reached; no not-before is a start already passed.
  if (nowMs >= (expires ?? Number.POSITIVE_INFINITY)) return refuse('the message has run out');
  if (nowMs < (from ?? Number.NEGATIVE_INFINITY)) return refuse('the message is not good yet');
  const { nonce } = parsed;
  const given = store.transaction(() => store.delete('nonce', nonce)); // the row is there, and gone: good once
  if (!given) return refuse('the nonce was not given out, or was used');
  if (!(await signedBy(chain, address, message, signature))) return refuse('the signature is not this wallet\'s');
  const { length } = config.SESSION;
  if (length === null) throw new Error('SESSION.length is not set');
  const secret = random(32).toString('base64url');
  const expiresAt = nowMs + length * 1000;
  store.put('session', sha256hex(secret), JSON.stringify({ wallet: address, expiresAt }));
  return { ok: true, wallet: address, secret, expiresAt };
}

/** The wallet a secret belongs to, or null (a guest): no such session, or it has run out, which deletes it. */
export function sessionOf(store: Store, secret: string, nowMs: number): Address | null {
  const key = sha256hex(secret);
  const text = store.get('session', key);
  if (text === undefined) return null;
  const row: { wallet: Address; expiresAt: number } = JSON.parse(text);
  if (nowMs >= row.expiresAt) {
    store.delete('session', key);
    return null;
  }
  return row.wallet;
}

/** Signing out: the session is deleted. Whether it was there. */
export function signOut(store: Store, secret: string): boolean {
  return store.delete('session', sha256hex(secret));
}
