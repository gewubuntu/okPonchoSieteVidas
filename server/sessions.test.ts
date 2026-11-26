import { createHash } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { describe, expect, it } from 'vitest';
import type { ChainSource } from './chain/chain';
import { mockChain, type MockChain } from './chain/mock';
import { resolveConfig, type ServerConfig } from './config';
import { issueNonce, sessionOf, signIn, signOut, type SessionDeps } from './sessions';
import { memoryStore } from './store/memory';
import type { Store } from './store/store';

const NOON = Date.parse('2026-11-21T12:00:00.000Z');
const site = { domain: 'poncho.example', uri: 'https://poncho.example' };
const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const stranger = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const wallet = account.address.toLowerCase();
const B = `0x${'cd'.repeat(20)}` as const; // a contract wallet: no key

const configOf = (overrides: unknown = {}): ServerConfig => {
  const { config, problems } = resolveConfig(overrides);
  if (config === null) throw new Error(problems.join(', '));
  return config;
};

/** Each call gives `n` bytes all equal to the call's number: call 1 (the first nonce) is 16 x 0x01, call 2 (its secret) 32 x 0x02, and so on. */
const counter = (): SessionDeps['random'] => {
  let calls = 0;
  return (bytes) => Buffer.alloc(bytes, ++calls);
};

interface Fixture { readonly store: Store; readonly chain: MockChain; readonly deps: SessionDeps }
const fixture = (chainOf: (chain: MockChain) => ChainSource = (chain) => chain): Fixture => {
  const store = memoryStore();
  const chain = mockChain();
  return { store, chain, deps: { store, chain: chainOf(chain), config: configOf(), site, random: counter() } };
};

interface Fields { address?: `0x${string}`; domain?: string; uri?: string; chainId?: number; expirationTime?: Date; notBefore?: Date }
const messageOf = (nonce: string, fields: Fields = {}): string =>
  createSiweMessage({
    address: fields.address ?? account.address,
    domain: fields.domain ?? site.domain,
    uri: fields.uri ?? site.uri,
    chainId: fields.chainId ?? 8453,
    nonce,
    version: '1',
    issuedAt: new Date(NOON - 1000),
    ...(fields.expirationTime === undefined ? {} : { expirationTime: fields.expirationTime }),
    ...(fields.notBefore === undefined ? {} : { notBefore: fields.notBefore }),
  });
const request = async (nonce: string, fields: Fields = {}, signer = account) => {
  const message = messageOf(nonce, fields);
  return { message, signature: await signer.signMessage({ message }) };
};
const signedMessage = async (message: string) => ({ message, signature: await account.signMessage({ message }) });
const sha256hex = (text: string): string => createHash('sha256').update(text).digest('hex');
const reasonOf = (signed: Awaited<ReturnType<typeof signIn>>): string => (signed.ok ? 'ok' : signed.reason);
const secretOf = (signed: Awaited<ReturnType<typeof signIn>>): string => {
  if (!signed.ok) throw new Error(`refused: ${signed.reason}`);
  return signed.secret;
};

describe('GDD-TEC-10 wallet sessions', () => {
  it('a wallet that signs the game\'s message with a nonce given out opens a session', async () => {
    const { store, deps } = fixture();
    const nonce = issueNonce(deps);
    expect(nonce).toBe('01'.repeat(16));
    expect(store.entries('nonce')).toEqual([[nonce, '{}']]);
    const signed = await signIn(deps, await request(nonce), NOON);
    const secret = Buffer.alloc(32, 2).toString('base64url');
    expect(signed).toEqual({ ok: true, wallet, secret, expiresAt: NOON + 604800000 });
    expect(secret).toHaveLength(43);
    expect(sessionOf(store, secret, NOON)).toBe(wallet);
    const rows = store.entries('session');
    expect(rows.map(([key]) => key)).toEqual([sha256hex(secret)]);
    expect(JSON.parse(rows[0]?.[1] ?? '')).toEqual({ wallet, expiresAt: NOON + 604800000 });
    for (const table of ['wallet', 'pal', 'chain', 'event', 'activation', 'token', 'nonce', 'session'] as const) {
      for (const [key, value] of store.entries(table)) {
        expect(key).not.toContain(secret);
        expect(value).not.toContain(secret);
      }
    }
  });

  it('a nonce is good once', async () => {
    const { deps } = fixture();
    const signedRequest = await request(issueNonce(deps));
    expect((await signIn(deps, signedRequest, NOON)).ok).toBe(true);
    expect(reasonOf(await signIn(deps, signedRequest, NOON))).toBe('the nonce was not given out, or was used');
  });

  it('a nonce the server did not give out is refused', async () => {
    const { deps } = fixture();
    expect(reasonOf(await signIn(deps, await request('abcdef1234567890'), NOON))).toBe('the nonce was not given out, or was used');
  });

  it('the message names the game\'s site and Base', async () => {
    const { store, deps } = fixture();
    const refusals: readonly [Fields, string][] = [
      [{ domain: 'other.example' }, 'not this game\'s site'],
      [{ uri: 'https://other.example' }, 'not this game\'s site'],
      [{ chainId: 1 }, 'not on Base'],
    ];
    for (const [fields, reason] of refusals) {
      const nonce = issueNonce(deps);
      expect(reasonOf(await signIn(deps, await request(nonce, fields), NOON))).toBe(reason);
      expect(store.get('nonce', nonce)).toBe('{}'); // the refusal comes before the nonce is spent
      expect((await signIn(deps, await request(nonce), NOON)).ok).toBe(true);
    }
  });

  it('a message that has run out or is not good yet is refused', async () => {
    const { store, deps } = fixture();
    const run = async (fields: Fields, at: number) => signIn(deps, await request(issueNonce(deps), fields), at);
    expect(reasonOf(await run({ expirationTime: new Date(NOON) }, NOON))).toBe('the message has run out');
    expect((await run({ expirationTime: new Date(NOON) }, NOON - 1)).ok).toBe(true);
    expect(reasonOf(await run({ notBefore: new Date(NOON + 1) }, NOON))).toBe('the message is not good yet');
    expect((await run({ notBefore: new Date(NOON + 1) }, NOON + 1)).ok).toBe(true);
    // The two refusals come before the nonce is spent: nonce calls 1 and 4 are still there (calls 3 and 6 were the secrets of the two sign-ins).
    expect(store.entries('nonce').map(([key]) => key)).toEqual([Buffer.alloc(16, 1).toString('hex'), Buffer.alloc(16, 4).toString('hex')]);
  });

  it('a message of another version or scheme, or with a time that does not read, is refused before the nonce', async () => {
    const { store, deps } = fixture();
    const later = new Date(NOON + 3_600_000).toISOString(); // 2026-11-21T13:00:00.000Z
    const cases: readonly [(nonce: string) => string, string][] = [
      [(nonce) => messageOf(nonce).replace('Version: 1', 'Version: 2'), 'not a sign-in message'],
      [(nonce) => `http://${messageOf(nonce)}`, 'not this game\'s site'],
      // A year past, written without its zone: an invalid date to the parser, never "no expiry".
      [(nonce) => messageOf(nonce, { expirationTime: new Date(later) }).replace(`Expiration Time: ${later}`, 'Expiration Time: 2025-11-21T12:00:00.000'), 'not a sign-in message'],
      // A year ahead, written with a space for the T.
      [(nonce) => messageOf(nonce, { notBefore: new Date(later) }).replace(`Not Before: ${later}`, 'Not Before: 2027-11-21 12:00:00.000Z'), 'not a sign-in message'],
    ];
    for (const [make, reason] of cases) {
      const nonce = issueNonce(deps);
      const message = make(nonce);
      expect(message).not.toBe(messageOf(nonce));
      expect(reasonOf(await signIn(deps, await signedMessage(message), NOON))).toBe(reason);
      expect(store.get('nonce', nonce)).toBe('{}');
    }
    // The site's own scheme, and readable times around NOON, are accepted.
    expect((await signIn(deps, await signedMessage(`https://${messageOf(issueNonce(deps))}`), NOON)).ok).toBe(true);
    expect((await signIn(deps, await request(issueNonce(deps), { expirationTime: new Date(later), notBefore: new Date(NOON) }), NOON)).ok).toBe(true);
  });

  it('a text that is not a sign-in message is refused', async () => {
    const { deps } = fixture();
    expect(reasonOf(await signIn(deps, { message: 'hello', signature: '0x00' }, NOON))).toBe('not a sign-in message');
    // A message the parser reads only in part: without the line that names the domain and address, or without the chain, so with no URI, chain or nonce.
    const whole = messageOf(issueNonce(deps));
    const noAddress = whole.replace(/^.* wants you to sign in with your Ethereum account:/, 'wants you to sign in with your Ethereum account:');
    const noNonce = whole.replace('Chain ID: 8453\n', '');
    for (const message of [noAddress, noNonce]) {
      expect(message).not.toBe(whole);
      expect(reasonOf(await signIn(deps, { message, signature: await account.signMessage({ message }) }, NOON))).toBe('not a sign-in message');
    }
  });

  it('a signature of another key is refused, and spends the nonce', async () => {
    const { store, deps } = fixture();
    const nonce = issueNonce(deps);
    expect(reasonOf(await signIn(deps, await request(nonce, {}, stranger), NOON))).toBe('the signature is not this wallet\'s');
    expect(store.get('nonce', nonce)).toBeUndefined();
    expect(store.entries('session')).toEqual([]);
  });

  it('a text that is not hex is never asked of the chain', async () => {
    const { chain, deps } = fixture();
    const message = messageOf(issueNonce(deps), { address: B });
    chain.acceptSignature(B, message, 'not hex');
    expect(reasonOf(await signIn(deps, { message, signature: 'not hex' }, NOON))).toBe('the signature is not this wallet\'s');
  });

  it('a contract wallet\'s signature is checked on the chain', async () => {
    const { chain, deps } = fixture();
    const message = messageOf(issueNonce(deps), { address: B });
    expect(reasonOf(await signIn(deps, { message, signature: '0x1234' }, NOON))).toBe('the signature is not this wallet\'s');
    const second = messageOf(issueNonce(deps), { address: B });
    chain.acceptSignature(B, second, '0x1234');
    const signed = await signIn(deps, { message: second, signature: '0x1234' }, NOON);
    expect(signed.ok && signed.wallet).toBe(B);
    // The chain is asked only when recovery does not give the address.
    let asked = 0;
    const counted = fixture((c) => ({ ...c, verifySignature: (...args) => (asked++, c.verifySignature(...args)) }));
    expect((await signIn(counted.deps, await request(issueNonce(counted.deps)), NOON)).ok).toBe(true);
    expect(asked).toBe(0);
  });

  it('a session runs out after SESSION.length', async () => {
    const { store, deps } = fixture();
    const secret = secretOf(await signIn(deps, await request(issueNonce(deps)), NOON));
    const expiresAt = NOON + 604800 * 1000;
    expect(sessionOf(store, secret, expiresAt - 1)).toBe(wallet);
    expect(sessionOf(store, secret, expiresAt)).toBeNull();
    expect(store.entries('session')).toEqual([]);
  });

  it('signing out leaves a guest', async () => {
    const { store, deps } = fixture();
    const secret = secretOf(await signIn(deps, await request(issueNonce(deps)), NOON));
    expect(signOut(store, secret)).toBe(true);
    expect(sessionOf(store, secret, NOON)).toBeNull();
    expect(signOut(store, secret)).toBe(false);
  });

  it('one wallet, many browsers', async () => {
    const { store, deps } = fixture();
    const first = secretOf(await signIn(deps, await request(issueNonce(deps)), NOON));
    const second = secretOf(await signIn(deps, await request(issueNonce(deps)), NOON));
    expect(second).not.toBe(first);
    expect(sessionOf(store, first, NOON)).toBe(wallet);
    expect(sessionOf(store, second, NOON)).toBe(wallet);
    expect(signOut(store, first)).toBe(true);
    expect(sessionOf(store, first, NOON)).toBeNull();
    expect(sessionOf(store, second, NOON)).toBe(wallet);
  });

  it('a secret the server did not give out reads as no session', () => {
    const { store } = fixture();
    expect(sessionOf(store, 'abc', NOON)).toBeNull();
  });
});
