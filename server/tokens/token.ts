// GDD-TEC-10, "Start tokens": what a token holds, and its text. The server signs it; only the server issues one.
import { sign, verify, type KeyObject } from 'node:crypto';
import type { Address } from '../chain/chain';

export type Hero = { readonly kind: 'poncho' } | { readonly kind: 'pal'; readonly tokenId: string; readonly season: number };

/**
 * GDD-TEC-10 token contents: the token's ID; the player (a wallet address; a guest's ID is not built, Open Question 53 (a));
 * the hero (Poncho, or a Pal's token ID and its season); what is played (the world; the league week is not built, Open Question 57);
 * the seed and the simulation version (GDD-TEC-09); when it was issued, and until when it can be started.
 */
export interface StartToken {
  readonly v: 1;
  readonly id: string;
  readonly player: Address;
  readonly hero: Hero;
  readonly world: number;
  readonly seed: number;
  readonly sim: string;
  readonly issuedAt: number; // the server's time of issue, never read by the simulation (GDD-TEC-10)
  readonly startBy: number; // issuedAt + START_TOKEN.startWithin seconds
  readonly cost: 'free' | 'bought' | 'none'; // the ledger life the token took, or none (a world gone on into, GDD-LIFE-06)
  readonly after: string | null; // the token this one continues
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * Placeholder (ADR 0004, "Start tokens"; the field names are the build's): the text is `base64url(JSON payload)`, a dot, and
 * `base64url(Ed25519 signature over the first part's ASCII bytes)`.
 */
export function signToken(payload: StartToken, privateKey: KeyObject): string {
  const first = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${first}.${sign(null, Buffer.from(first, 'ascii'), privateKey).toString('base64url')}`;
}

/** The payload if the text is a token this key signed, else null. Only the server signs, so the fields are not checked further. */
export function readToken(text: string, publicKey: KeyObject): StartToken | null {
  const parts = text.split('.');
  if (parts.length !== 2) return null;
  const [first = '', second = ''] = parts;
  if (!BASE64URL.test(first) || !BASE64URL.test(second)) return null;
  if (!verify(null, Buffer.from(first, 'ascii'), publicKey, Buffer.from(second, 'base64url'))) return null;
  let payload: StartToken;
  try {
    payload = JSON.parse(Buffer.from(first, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  // A signed text that is not an object (a number, a string) has no `v` and fails the version check, so it needs no check of its own.
  return payload !== null && payload.v === 1 ? payload : null;
}
