// GDD-TEC-10, "Wallet sessions": Sign-In with Ethereum. The wallet signs a message that names the game's site, Base and a nonce the
// server gave out once; the server checks it and opens a session. A session is a random secret the player keeps (phase D puts it in a
// cookie); the store holds only its SHA-256, so a copy of the store opens nothing (docs/decisions/0004-game-server.md, "Sessions").
// Several sessions of one wallet are all good: nothing but the wallet is the player's (GDD-CHAIN-02, "One wallet, many browsers").
// One of the two files that import viem (the other is server/chain/viem.ts, a later phase).
import { createHash } from 'node:crypto';
import { isHex, recoverMessageAddress, zeroAddress } from 'viem';
import { createSiweMessage, parseSiweMessage, type SiweMessage } from 'viem/siwe';
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
/** A URI's scheme, lowercased: a scheme is the same in any case (RFC 3986, 3.1). Read from the text, as a URI viem takes can still be one `URL` refuses (a port above 65535). */
const schemeOf = (uri: string): string => uri.slice(0, uri.indexOf(':')).toLowerCase();
/** The server's clock is handed in; a time that is not a finite number is the server's fault, never a time to compare with (every comparison with NaN is false). */
const clockOf = (nowMs: number): number => {
  if (!Number.isFinite(nowMs)) throw new RangeError('the clock gives no time');
  return nowMs;
};

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
 * Placeholder (the game's client writes the message with viem's `createSiweMessage`): a message is good only if it is exactly what that
 * writer makes of the fields the parser read. The parser skips a line it does not expect where it is (a time after another line, a field
 * misspelt, a line after a blank one or at the end) and gives an invalid date for a time it cannot read; the writer throws on that date, on a
 * version other than 1 and on every empty field, and writes the fields in one order with the address checksummed, so each such message
 * writes back differently or not at all (L-101). A field the parser did not read takes a stand-in that cannot write back the message:
 * an empty one the writer throws on (`NaN` for the chain), or for the address the zero address, which the parser would have read had the
 * message held it.
 */
type Parsed = ReturnType<typeof parseSiweMessage>;
function writesBack(parsed: Parsed, message: string): parsed is Parsed & SiweMessage {
  try {
    // A version line missing leaves the nonce unread too (they are one block), so its stand-in may be the one good version.
    const { address = zeroAddress, chainId = Number.NaN, domain = '', nonce = '', uri = '', version = '1' } = parsed;
    return createSiweMessage({ ...parsed, address, chainId, domain, nonce, uri, version }) === message;
  } catch {
    return false;
  }
}

/**
 * Checks the signed message and opens a session. Every refusal before the signature leaves the nonce unspent; from the nonce on it is spent,
 * whatever the signature turns out to be.
 * Placeholder (Open Question 54 (d), ADR 0004): the session row keeps the wallet address and the end time; an ended session is deleted as it is read; nothing else is deleted.
 * A session lasts `SESSION.length` seconds from the sign-in, with no renewal (the mock's stand-in for the unset length is in `MOCK_PLACEHOLDERS`).
 */
export async function signIn(deps: SessionDeps, request: { message: unknown; signature: unknown }, nowMs: number): Promise<SignedIn> {
  const { store, chain, config, site, random } = deps;
  const now = clockOf(nowMs);
  // The request is what a client sent (phase D's body): a message or signature that is not text is no sign-in message.
  const { signature } = request;
  if (typeof signature !== 'string') return refuse('not a sign-in message');
  // A message that is not text is read as the empty message, which is no sign-in message (the parse would refuse it anyway, below).
  const message = typeof request.message === 'string' ? request.message : '';
  let parsed: Parsed;
  try {
    parsed = parseSiweMessage(message);
  } catch {
    // A message long enough (a Resources list of millions of lines) overflows the parser's regular expression.
    return refuse('not a sign-in message');
  }
  // A missing field, a version other than 1 and a time the parser cannot read are all covered here (`writesBack`).
  if (!writesBack(parsed, message)) return refuse('not a sign-in message');
  if (parsed.domain !== site.domain) return refuse('not this game\'s site');
  if (parsed.uri !== site.uri) return refuse('not this game\'s site');
  // The scheme is optional in a message; given, it is the site's.
  if (parsed.scheme !== undefined && parsed.scheme.toLowerCase() !== schemeOf(site.uri)) return refuse('not this game\'s site');
  if (parsed.chainId !== BASE_CHAIN_ID) return refuse('not on Base');
  // The parser reads only `0x` and 40 hex digits as an address, so it needs no check of its own here; lowercased, it is one wallet however spelled.
  const address: Address = parsed.address.toLowerCase();
  // A time the parser could not read never gets here (`writesBack`), so a time is a real one, or none.
  const expires = parsed.expirationTime?.getTime();
  const from = parsed.notBefore?.getTime();
  // No expiry is an expiry never reached; no not-before is a start already passed.
  if (now >= (expires ?? Number.POSITIVE_INFINITY)) return refuse('the message has run out');
  if (now < (from ?? Number.NEGATIVE_INFINITY)) return refuse('the message is not good yet');
  const { nonce } = parsed;
  const given = store.transaction(() => store.delete('nonce', nonce)); // the row is there, and gone: good once
  if (!given) return refuse('the nonce was not given out, or was used');
  if (!(await signedBy(chain, address, message, signature))) return refuse('the signature is not this wallet\'s');
  const { length } = config.SESSION;
  if (length === null) throw new Error('SESSION.length is not set');
  const secret = random(32).toString('base64url');
  // SESSION.length is a whole number of seconds whose milliseconds are a safe whole number (`server/config.ts`), so the end is a finite time.
  const expiresAt = now + length * 1000;
  store.put('session', sha256hex(secret), JSON.stringify({ wallet: address, expiresAt }));
  return { ok: true, wallet: address, secret, expiresAt };
}

/** The wallet a secret belongs to, or null (a guest): no such session, or it has run out, which deletes it. */
export function sessionOf(store: Store, secret: unknown, nowMs: number): Address | null {
  const now = clockOf(nowMs);
  // A missing or malformed secret (phase D's cookie) is a guest.
  if (typeof secret !== 'string') return null;
  const key = sha256hex(secret);
  const text = store.get('session', key);
  if (text === undefined) return null;
  const row: { wallet: Address; expiresAt: number } = JSON.parse(text);
  if (now >= row.expiresAt) {
    store.delete('session', key);
    return null;
  }
  return row.wallet;
}

/** Signing out: the session is deleted. Whether it was there. */
export function signOut(store: Store, secret: unknown): boolean {
  return typeof secret === 'string' && store.delete('session', sha256hex(secret));
}
