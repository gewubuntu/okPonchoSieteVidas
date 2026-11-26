// GDD-TEC-10, "Start tokens": the server issues one only if the player has a ledger life left, and takes that life as it issues the token
// (which life: GDD-LIFE-06, "Order"). A token starts one attempt and is refused a second time.
// Not built, each undecided: a guest's token (Open Question 53 (a)), a league token (Open Question 57), a life given back for a token never
// started (Open Question 52 (f)). The player is the wallet as given: the session that proves it is the next phase's.
import type { KeyObject } from 'node:crypto';
import { canonicalToken, isTokenId, normalAddress, type ChainSource } from '../chain/chain';
import { activationOf } from '../chain/listener';
import type { ServerConfig } from '../config';
import { EMPTY_WALLET, takeLife, type PalLedger, type WalletLedger } from '../ledger';
import { seasonAt } from '../season';
import type { Store } from '../store/store';
import { readToken, signToken, type Hero, type StartToken } from './token';

export interface TokenDeps {
  readonly store: Store;
  readonly chain: ChainSource;
  readonly config: ServerConfig;
  readonly privateKey: KeyObject;
  readonly sim: string; // the simulation version (GDD-TEC-09)
  readonly random: (bytes: number) => Buffer;
}
export type Issued =
  | { readonly ok: true; readonly token: string; readonly payload: StartToken }
  | { readonly ok: false; readonly reason: string; readonly resetAt?: number };
export type Started = { readonly ok: true; readonly payload: StartToken } | { readonly ok: false; readonly reason: string };

/** What the store keeps of each token issued, by the token's ID. */
interface TokenRow {
  status: 'issued' | 'started';
  readonly player: string;
  readonly world: number;
  readonly hero: Hero;
  readonly startBy: number;
  continuedBy: string | null;
}

const refuse = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const rowOf = (store: Store, id: string): TokenRow | null => {
  const text = store.get('token', id);
  return text === undefined ? null : JSON.parse(text);
};

/** Placeholder: 16 random bytes as 32 lowercase hex digits for the ID, a random unsigned 32-bit whole number for the seed (nothing in the simulation reads it yet, GDD-TEC-09). */
function build(deps: TokenDeps, store: Store, nowMs: number, startWithin: number, fields: Pick<StartToken, 'player' | 'hero' | 'world' | 'cost' | 'after'>): Issued {
  const payload: StartToken = {
    v: 1,
    id: deps.random(16).toString('hex'),
    ...fields,
    seed: deps.random(4).readUInt32BE(0),
    sim: deps.sim,
    // GDD-TEC-10: the time of issue is the server's and is never read by the simulation.
    issuedAt: nowMs,
    // Placeholder (Open Question 54 (e)): START_TOKEN.startWithin is in seconds, and starting is allowed while now <= startBy.
    startBy: nowMs + startWithin * 1000,
  };
  if (store.get('token', payload.id) !== undefined) throw new Error('a token with this ID exists already');
  const row: TokenRow = { status: 'issued', player: payload.player, world: payload.world, hero: payload.hero, startBy: payload.startBy, continuedBy: null };
  store.put('token', payload.id, JSON.stringify(row));
  return { ok: true, token: signToken(payload, deps.privateKey), payload };
}

function startWithinOf(config: ServerConfig): number {
  const { startWithin } = config.START_TOKEN;
  if (startWithin === null) throw new Error('START_TOKEN.startWithin is not set');
  return startWithin;
}

/** A token for the first world of a run of seven, or for any world a player starts afresh; it takes a ledger life. */
export async function issueStart(
  deps: TokenDeps,
  request: { player: string; hero: { kind: 'poncho' } | { kind: 'pal'; tokenId: string }; world: number },
  nowMs: number,
): Promise<Issued> {
  const { store, chain, config } = deps;
  const startWithin = startWithinOf(config);
  const player = normalAddress(request.player);
  if (player === null) return refuse('player is not an address');
  // GDD-LIFE-06: a run of seven in one of the seven worlds; the tutorial, world 0, never needs a token.
  const { world } = request;
  if (!Number.isSafeInteger(world) || world < 1 || world > 7) return refuse('world is not one of the seven');
  let hero: Hero = { kind: 'poncho' };
  let palId = '';
  if (request.hero.kind === 'pal') {
    if (!isTokenId(request.hero.tokenId)) return refuse('tokenId is not a token ID');
    palId = canonicalToken(request.hero.tokenId);
    // GDD-CHAIN-04: that the wallet owns the Pal is checked as the start token is issued. Decided (user, 2026-11-26, Open Question 54 (c)):
    // the owner is read from the collection as a token is asked for, its transfers are not followed, and a Pal counts only for the wallet that holds it.
    const owner = await chain.ownerOf(palId);
    if (normalAddress(owner ?? '') !== player) return refuse('the Pal is not this wallet\'s');
    // Only a Pal needs the season: a Poncho token is issued with SEASON.firstStartUtc unset.
    const { firstStartUtc, months } = config.SEASON;
    if (firstStartUtc === null) throw new Error('SEASON.firstStartUtc is not set');
    const season = seasonAt(nowMs, firstStartUtc, months);
    if (season === null) return refuse('no season is running');
    hero = { kind: 'pal', tokenId: palId, season };
  }
  return store.transaction((): Issued => {
    // GDD-CHAIN-04: that the Pal is activated for the running season is checked as the start token is issued.
    // An activation follows the Pal to a new owner within its season, so it is read for the token, whoever activated it (Decided, user, 2026-11-26, Open Question 55 (b)).
    if (hero.kind === 'pal' && activationOf(store, palId, hero.season) === null) return refuse('the Pal is not activated this season');
    const walletRow = store.get('wallet', player);
    const wallet: WalletLedger = walletRow === undefined ? EMPTY_WALLET : JSON.parse(walletRow);
    let pal: PalLedger | null = null;
    if (hero.kind === 'pal') {
      const palRow = store.get('pal', palId);
      pal = palRow === undefined ? { day: 0, used: 0 } : JSON.parse(palRow);
    }
    const took = takeLife(wallet, pal, nowMs, config.LEDGER);
    if (!took.ok) return { ok: false, reason: 'no ledger life left', resetAt: took.resetAt };
    store.put('wallet', player, JSON.stringify(took.wallet));
    if (took.pal !== null) store.put('pal', palId, JSON.stringify(took.pal));
    return build(deps, store, nowMs, startWithin, { player, hero, world, cost: took.took, after: null });
  });
}

/**
 * GDD-TEC-10, GDD-LIFE-06: a run that clears its world goes on into the next world under a token issued at no cost, whatever the ledger holds.
 * The client is trusted for the clear (Phase 1, "What the server trusts"). GDD-CHAIN-04: an attempt under way keeps its Pal to its end,
 * across a sale or the season's turn too, so the hero is copied and neither the Pal nor the ledger is read. Placeholder: that is GDD-CHAIN-04's recommended
 * reading while Open Question 55 (c) is open; the other checks again at every level started.
 */
export function issueContinue(deps: TokenDeps, request: { player: string; after: string }, nowMs: number): Issued {
  const { store } = deps;
  const startWithin = startWithinOf(deps.config);
  const player = normalAddress(request.player);
  if (player === null) return refuse('player is not an address');
  return store.transaction((): Issued => {
    const before = rowOf(store, request.after);
    if (before === null) return refuse('no such token');
    if (before.player !== player) return refuse('not this wallet\'s token');
    if (before.status !== 'started') return refuse('the token was not started');
    if (before.continuedBy !== null) return refuse('already continued');
    if (before.world >= 7) return refuse('no world after the seventh');
    const issued = build(deps, store, nowMs, startWithin, { player, hero: before.hero, world: before.world + 1, cost: 'none', after: request.after });
    if (issued.ok) store.put('token', request.after, JSON.stringify({ ...before, continuedBy: issued.payload.id }));
    return issued;
  });
}

/** Starts the attempt a token is for, once: a token is refused a second time, and after START_TOKEN.startWithin has passed. */
export function startAttempt(store: Store, publicKey: KeyObject, text: string, nowMs: number): Started {
  const payload = readToken(text, publicKey);
  if (payload === null) return refuse('not a token');
  return store.transaction((): Started => {
    const row = rowOf(store, payload.id);
    if (row === null) return refuse('no such token');
    if (row.status === 'started') return refuse('already started');
    if (nowMs > row.startBy) return refuse('expired');
    store.put('token', payload.id, JSON.stringify({ ...row, status: 'started' }));
    return { ok: true, payload };
  });
}
