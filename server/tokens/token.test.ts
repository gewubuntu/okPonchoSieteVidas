import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readToken, signToken, type StartToken } from './token';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const A = '0x' + 'ab'.repeat(20);
const NOON = Date.parse('2026-11-21T12:00:00.000Z');

const payload = (over: Partial<StartToken> = {}): StartToken => ({
  v: 1,
  id: '01'.repeat(16),
  player: A,
  hero: { kind: 'pal', tokenId: '42', season: 4 },
  world: 2,
  seed: 0x02020202,
  sim: 'test-sim',
  issuedAt: NOON,
  startBy: NOON + 600000,
  cost: 'free',
  after: '0a'.repeat(16),
  ...over,
});
const b64 = (text: string): string => Buffer.from(text).toString('base64url');
/** A token text with this payload text and a signature over it made with `key`. */
const textOf = (payloadText: string, key = privateKey): string => {
  const first = b64(payloadText);
  return `${first}.${sign(null, Buffer.from(first, 'ascii'), key).toString('base64url')}`;
};

describe('GDD-TEC-10 token text', () => {
  it('a signed token reads back as it was signed', () => {
    const p = payload();
    const text = signToken(p, privateKey);
    expect(readToken(text, publicKey)).toEqual(p);
    expect(text.split('.')).toHaveLength(2);
    expect(text).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('a changed or foreign token does not read', () => {
    const [, signature = ''] = signToken(payload({ world: 2 }), privateKey).split('.');
    const [, otherSignature = ''] = signToken(payload({ world: 5 }), privateKey).split('.');
    const changed = `${b64(JSON.stringify(payload({ world: 3 })))}.${signature}`;
    expect(readToken(changed, publicKey)).toBeNull();
    const [first = ''] = signToken(payload({ world: 2 }), privateKey).split('.');
    expect(readToken(`${first}.${otherSignature}`, publicKey)).toBeNull();
    const foreign = generateKeyPairSync('ed25519').privateKey;
    expect(readToken(signToken(payload(), foreign), publicKey)).toBeNull();
    expect(readToken('', publicKey)).toBeNull();
    expect(readToken('abc', publicKey)).toBeNull();
    expect(readToken('a.b.c', publicKey)).toBeNull();
    expect(readToken(`${signToken(payload(), privateKey)}.${signature}`, publicKey)).toBeNull();
    // A signature part that decodes the same but is not base64url (padding, a space) is no signature.
    expect(readToken(`${signToken(payload(), privateKey)}=`, publicKey)).toBeNull();
    expect(readToken(`${signToken(payload(), privateKey)} `, publicKey)).toBeNull();
    // A payload part that is not base64url, signed as it stands, is no token either.
    const padded = `${b64(JSON.stringify(payload()))}=`;
    expect(readToken(`${padded}.${sign(null, Buffer.from(padded, 'ascii'), privateKey).toString('base64url')}`, publicKey)).toBeNull();
    expect(readToken('.', publicKey)).toBeNull();
    expect(readToken(textOf('not json'), publicKey)).toBeNull();
    for (const text of ['null', '5', '"x"', '[]', '{}']) expect(readToken(textOf(text), publicKey)).toBeNull();
    expect(readToken(textOf(JSON.stringify({ ...payload(), v: 2 })), publicKey)).toBeNull();
    // Each of these is sound but for the one thing named.
    expect(readToken(textOf(JSON.stringify(payload())), publicKey)).toEqual(payload());
  });
});
