import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { catchUp } from '../chain/listener';
import { mockChain, type MockChain } from '../chain/mock';
import { resolveConfig, type ServerConfig } from '../config';
import { memoryStore } from '../store/memory';
import type { Store } from '../store/store';
import { issueContinue, issueStart, startAttempt, type TokenDeps } from './issue';
import { readToken, type StartToken } from './token';

// 1795262400000, ledger day 20778 (server/ledger.test.ts); the next reset is at 1795305600000.
const NOON = Date.parse('2026-11-21T12:00:00.000Z');
const A = '0x' + 'ab'.repeat(20);
const B = '0x' + 'cd'.repeat(20);
const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const configOf = (overrides: unknown = {}): ServerConfig => {
  const { config, problems } = resolveConfig(overrides);
  if (config === null) throw new Error(problems.join(', '));
  return config;
};

/** Each call gives `n` bytes all equal to the call's number: call 1 (the first id) is 16 x 0x01, call 2 (its seed) 4 x 0x02, and so on. */
const counter = (): TokenDeps['random'] => {
  let calls = 0;
  return (bytes) => Buffer.alloc(bytes, ++calls);
};

interface Fixture { readonly store: Store; readonly chain: MockChain; readonly deps: TokenDeps }
const fixture = (overrides: unknown = {}, chainOf: (chain: MockChain) => TokenDeps['chain'] = (chain) => chain): Fixture => {
  const store = memoryStore();
  const chain = mockChain();
  return { store, chain, deps: { store, chain: chainOf(chain), config: configOf(overrides), privateKey, sim: 'test-sim', random: counter() } };
};

/** The Pal is activated for season 4 as the listener reads it, with `confirmations` 3. */
const activate = async ({ store, chain }: Fixture, season = 4): Promise<void> => {
  chain.emitActivated('42', A, season);
  chain.mine(4);
  await catchUp(chain, store, 3);
};

const row = (store: Store, table: 'wallet' | 'pal' | 'token', key: string): any => {
  const text = store.get(table, key);
  return text === undefined ? undefined : JSON.parse(text);
};
const everything = (store: Store): string => JSON.stringify([store.entries('wallet'), store.entries('pal'), store.entries('token')]);
const ok = (issued: Awaited<ReturnType<typeof issueStart>>): StartToken => {
  if (!issued.ok) throw new Error(`refused: ${issued.reason}`);
  return issued.payload;
};
const poncho = { kind: 'poncho' } as const;
const palRequest = (tokenId = '42') => ({ player: A, hero: { kind: 'pal', tokenId } as const, world: 1 });

describe('GDD-TEC-10 start tokens', () => {
  it('a start token takes a free life of the player\'s own as Poncho', async () => {
    const { store, deps } = fixture();
    const issued = await issueStart(deps, { player: A, hero: poncho, world: 1 }, NOON);
    expect(issued.ok).toBe(true);
    expect(row(store, 'wallet', A)).toEqual({ day: 20778, used: 1, bought: 0 });
    expect(store.entries('pal')).toEqual([]); // a Poncho life is no Pal's
    const expected: StartToken = { v: 1, id: '01'.repeat(16), player: A, hero: { kind: 'poncho' }, world: 1, seed: 0x02020202, sim: 'test-sim', issuedAt: NOON, startBy: NOON + 600000, cost: 'free', after: null };
    if (!issued.ok) return;
    expect(issued.payload).toEqual(expected);
    expect(readToken(issued.token, publicKey)).toEqual(expected);
    expect(row(store, 'token', expected.id)).toEqual({ status: 'issued', player: A, world: 1, hero: { kind: 'poncho' }, startBy: NOON + 600000, continuedBy: null });
  });

  it('free first, then bought, then none left with the time of the reset', async () => {
    const bought = fixture();
    bought.store.put('wallet', A, JSON.stringify({ day: 20778, used: 3, bought: 2 }));
    expect(ok(await issueStart(bought.deps, { player: A, hero: poncho, world: 1 }, NOON)).cost).toBe('bought');
    expect(row(bought.store, 'wallet', A)).toEqual({ day: 20778, used: 3, bought: 1 });

    const none = fixture();
    none.store.put('wallet', A, JSON.stringify({ day: 20778, used: 3, bought: 0 }));
    const before = everything(none.store);
    expect(await issueStart(none.deps, { player: A, hero: poncho, world: 1 }, NOON)).toEqual({ ok: false, reason: 'no ledger life left', resetAt: 1795305600000 });
    expect(everything(none.store)).toBe(before);
    expect(none.store.entries('token')).toEqual([]);
  });

  it('the player is a wallet, spelled any way', async () => {
    const { store, deps } = fixture();
    const spelled = A.toUpperCase().replace('0X', '0x');
    expect(ok(await issueStart(deps, { player: spelled, hero: poncho, world: 1 }, NOON)).player).toBe(A);
    expect(row(store, 'wallet', A)).toEqual({ day: 20778, used: 1, bought: 0 });
    expect(store.get('wallet', spelled)).toBeUndefined();

    const refused = fixture();
    expect(await issueStart(refused.deps, { player: '0x12', hero: poncho, world: 1 }, NOON)).toEqual({ ok: false, reason: 'player is not an address' });
    expect(everything(refused.store)).toBe(everything(fixture().store));
  });

  it('a run of seven in one of the seven worlds', async () => {
    const { store, deps } = fixture();
    expect(ok(await issueStart(deps, { player: A, hero: poncho, world: 1 }, NOON)).world).toBe(1);
    expect(ok(await issueStart(deps, { player: A, hero: poncho, world: 7 }, NOON)).world).toBe(7);
    const before = everything(store);
    for (const world of [0, 8, 1.5]) {
      expect(await issueStart(deps, { player: A, hero: poncho, world }, NOON)).toEqual({ ok: false, reason: 'world is not one of the seven' });
    }
    expect(everything(store)).toBe(before);
    const fresh = fixture();
    await issueStart(fresh.deps, { player: A, hero: poncho, world: 0 }, NOON);
    expect(fresh.store.get('wallet', A)).toBeUndefined();
  });

  it('a Pal the wallet holds, activated this season, takes the Pal\'s own free life', async () => {
    const f = fixture();
    await activate(f);
    f.chain.setOwner('42', A.toUpperCase().replace('0X', '0x')); // the collection's spelling is not the wallet's
    f.store.put('wallet', A, JSON.stringify({ day: 20778, used: 3, bought: 0 })); // no Poncho life left
    const payload = ok(await issueStart(f.deps, { player: A, hero: { kind: 'pal', tokenId: '042' }, world: 1 }, NOON));
    expect(payload.cost).toBe('free');
    expect(payload.hero).toEqual({ kind: 'pal', tokenId: '42', season: 4 });
    expect(row(f.store, 'pal', '42')).toEqual({ day: 20778, used: 1 });
    expect(row(f.store, 'wallet', A)).toEqual({ day: 20778, used: 3, bought: 0 });
    expect(row(f.store, 'token', payload.id)).toMatchObject({ status: 'issued', hero: { kind: 'pal', tokenId: '42', season: 4 } });
  });

  it('a Pal of another wallet is refused', async () => {
    const f = fixture();
    await activate(f);
    f.chain.setOwner('42', B);
    const before = everything(f.store);
    expect(await issueStart(f.deps, palRequest(), NOON)).toEqual({ ok: false, reason: 'the Pal is not this wallet\'s' });
    f.chain.setOwner('42', null); // no owner at all
    expect(await issueStart(f.deps, palRequest(), NOON)).toEqual({ ok: false, reason: 'the Pal is not this wallet\'s' });
    expect(everything(f.store)).toBe(before);
    expect(f.store.get('pal', '42')).toBeUndefined();
    expect(f.store.get('wallet', A)).toBeUndefined();
  });

  it('a Pal kept in another wallet does not count (Open Question 54 c, decided 2026-11-26)', async () => {
    const f = fixture();
    await activate(f); // activated by A, kept for safekeeping in B
    f.chain.setOwner('42', B);
    expect(await issueStart(f.deps, palRequest(), NOON)).toEqual({ ok: false, reason: 'the Pal is not this wallet\'s' });
  });

  it('a Pal not activated this season is refused', async () => {
    const f = fixture();
    await activate(f, 3);
    f.chain.setOwner('42', A);
    const before = everything(f.store);
    expect(await issueStart(f.deps, palRequest(), NOON)).toEqual({ ok: false, reason: 'the Pal is not activated this season' });
    expect(everything(f.store)).toBe(before);
  });

  it('no season before the first one starts', async () => {
    const f = fixture({ SEASON: { firstStartUtc: '2027-01-01T00:00:00.000Z' } });
    f.chain.setOwner('42', A);
    expect(await issueStart(f.deps, palRequest(), NOON)).toEqual({ ok: false, reason: 'no season is running' });
    expect(everything(f.store)).toBe(everything(fixture().store));
  });

  it('only a Pal needs SEASON.firstStartUtc', async () => {
    const f = fixture();
    const unset: TokenDeps = { ...f.deps, config: { ...f.deps.config, SEASON: { ...f.deps.config.SEASON, firstStartUtc: null } } };
    f.chain.setOwner('42', A);
    expect((await issueStart(unset, { player: A, hero: poncho, world: 1 }, NOON)).ok).toBe(true);
    await expect(issueStart(unset, palRequest(), NOON)).rejects.toThrow('SEASON.firstStartUtc is not set');
  });

  it('a token ID that is not one is refused', async () => {
    let asked = 0;
    const f = fixture({}, (chain) => ({ ...chain, ownerOf: (tokenId) => (asked++, chain.ownerOf(tokenId)) }));
    f.chain.setOwner('1', A);
    for (const tokenId of ['x1', '', ' 1', '1 ', '-1', '1.5']) {
      expect(await issueStart(f.deps, palRequest(tokenId), NOON)).toEqual({ ok: false, reason: 'tokenId is not a token ID' });
    }
    expect(asked).toBe(0);
  });

  it('the owner is read as the token is asked for', async () => {
    const f = fixture();
    await activate(f);
    f.chain.setOwner('42', A);
    expect(ok(await issueStart(f.deps, palRequest(), NOON)).hero).toEqual({ kind: 'pal', tokenId: '42', season: 4 });
    f.chain.setOwner('42', B); // sold; the transfer is not followed, the collection is read again
    expect(await issueStart(f.deps, palRequest(), NOON)).toEqual({ ok: false, reason: 'the Pal is not this wallet\'s' });
  });

  it('a token ID that exists already is never issued again, and the life stays', async () => {
    const { store, deps } = fixture();
    const same = { ...deps, random: (bytes: number) => Buffer.alloc(bytes, 9) };
    const first = ok(await issueStart(same, { player: A, hero: poncho, world: 1 }, NOON));
    const before = everything(store);
    await expect(issueStart(same, { player: A, hero: poncho, world: 1 }, NOON)).rejects.toThrow('a token with this ID exists already');
    expect(everything(store)).toBe(before); // the wallet's second life was not taken
    expect(row(store, 'wallet', A)).toEqual({ day: 20778, used: 1, bought: 0 });
    expect(row(store, 'token', first.id).status).toBe('issued');
  });

  it('a token starts one attempt and is refused a second time', async () => {
    const { store, deps } = fixture();
    const issued = await issueStart(deps, { player: A, hero: poncho, world: 1 }, NOON);
    if (!issued.ok) throw new Error(issued.reason);
    expect(startAttempt(store, publicKey, issued.token, NOON)).toEqual({ ok: true, payload: issued.payload });
    expect(row(store, 'token', issued.payload.id).status).toBe('started');
    expect(startAttempt(store, publicKey, issued.token, NOON)).toEqual({ ok: false, reason: 'already started' });
    expect(row(store, 'token', issued.payload.id).status).toBe('started');
  });

  it('a token starts until START_TOKEN.startWithin has passed', async () => {
    const { store, deps } = fixture();
    const first = await issueStart(deps, { player: A, hero: poncho, world: 1 }, NOON);
    const second = await issueStart(deps, { player: A, hero: poncho, world: 1 }, NOON);
    if (!first.ok || !second.ok) throw new Error('not issued');
    expect(startAttempt(store, publicKey, first.token, NOON + 600000).ok).toBe(true);
    expect(startAttempt(store, publicKey, second.token, NOON + 600001)).toEqual({ ok: false, reason: 'expired' });
    expect(row(store, 'token', second.payload.id).status).toBe('issued');
  });

  it('a token the server did not sign does not start', async () => {
    const { store, deps } = fixture();
    const issued = await issueStart(deps, { player: A, hero: poncho, world: 1 }, NOON);
    if (!issued.ok) throw new Error(issued.reason);
    expect(startAttempt(store, publicKey, 'abc', NOON)).toEqual({ ok: false, reason: 'not a token' });
    const foreign = generateKeyPairSync('ed25519').privateKey;
    const foreignToken = await issueStart({ ...fixture().deps, privateKey: foreign }, { player: A, hero: poncho, world: 1 }, NOON);
    if (!foreignToken.ok) throw new Error(foreignToken.reason);
    expect(startAttempt(store, publicKey, foreignToken.token, NOON)).toEqual({ ok: false, reason: 'not a token' });
    expect(row(store, 'token', issued.payload.id).status).toBe('issued');
    store.delete('token', issued.payload.id);
    expect(startAttempt(store, publicKey, issued.token, NOON)).toEqual({ ok: false, reason: 'no such token' });
  });

  it('a cleared world goes on at no cost, whatever the ledger holds', async () => {
    const { store, deps } = fixture();
    store.put('wallet', A, JSON.stringify({ day: 20778, used: 2, bought: 0 }));
    const issued = await issueStart(deps, { player: A, hero: poncho, world: 2 }, NOON);
    if (!issued.ok) throw new Error(issued.reason);
    expect(row(store, 'wallet', A)).toEqual({ day: 20778, used: 3, bought: 0 }); // none left now
    startAttempt(store, publicKey, issued.token, NOON);
    const next = issueContinue(deps, { player: A, after: issued.payload.id }, NOON + 1000);
    if (!next.ok) throw new Error(next.reason);
    expect(next.payload).toEqual({ v: 1, id: '03'.repeat(16), player: A, hero: { kind: 'poncho' }, world: 3, seed: 0x04040404, sim: 'test-sim', issuedAt: NOON + 1000, startBy: NOON + 601000, cost: 'none', after: issued.payload.id });
    expect(readToken(next.token, publicKey)).toEqual(next.payload);
    expect(row(store, 'wallet', A)).toEqual({ day: 20778, used: 3, bought: 0 });
    expect(row(store, 'token', issued.payload.id)).toMatchObject({ status: 'started', continuedBy: next.payload.id });
    expect(row(store, 'token', next.payload.id)).toEqual({ status: 'issued', player: A, world: 3, hero: { kind: 'poncho' }, startBy: NOON + 601000, continuedBy: null });
    // The new token starts like any other.
    expect(startAttempt(store, publicKey, next.token, NOON + 1000).ok).toBe(true);
  });

  it('a continuation keeps the attempt\'s Pal, after a sale too', async () => {
    const f = fixture();
    await activate(f);
    f.chain.setOwner('42', A);
    const issued = await issueStart(f.deps, palRequest(), NOON);
    if (!issued.ok) throw new Error(issued.reason);
    startAttempt(f.store, publicKey, issued.token, NOON);
    f.chain.setOwner('42', B); // sold during the attempt
    const palBefore = f.store.get('pal', '42');
    const next = issueContinue(f.deps, { player: A, after: issued.payload.id }, NOON + 1000);
    if (!next.ok) throw new Error(next.reason);
    expect(next.payload.hero).toEqual({ kind: 'pal', tokenId: '42', season: 4 });
    expect(next.payload.world).toBe(2);
    expect(f.store.get('pal', '42')).toBe(palBefore);
  });

  it('a continuation is refused where the run did not go on', async () => {
    const { store, deps } = fixture();
    const issue = async (world: number, player = A): Promise<{ token: string; id: string }> => {
      const issued = await issueStart(deps, { player, hero: poncho, world }, NOON);
      if (!issued.ok) throw new Error(issued.reason);
      return { token: issued.token, id: issued.payload.id };
    };
    const refuses = (request: { player: string; after: string }, reason: string): void => {
      const before = everything(store);
      expect(issueContinue(deps, request, NOON + 1000)).toEqual({ ok: false, reason });
      expect(everything(store)).toBe(before);
    };
    const started = await issue(2);
    startAttempt(store, publicKey, started.token, NOON);
    const idle = await issue(2); // issued, never started
    const seventh = await issue(7);
    startAttempt(store, publicKey, seventh.token, NOON);

    refuses({ player: A, after: '00'.repeat(16) }, 'no such token');
    refuses({ player: '0x12', after: started.id }, 'player is not an address');
    refuses({ player: B, after: started.id }, 'not this wallet\'s token');
    refuses({ player: A, after: idle.id }, 'the token was not started');
    refuses({ player: A, after: seventh.id }, 'no world after the seventh');

    expect(issueContinue(deps, { player: A, after: started.id }, NOON + 1000).ok).toBe(true);
    refuses({ player: A, after: started.id }, 'already continued');
  });
});
