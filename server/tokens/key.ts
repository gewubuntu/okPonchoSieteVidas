// GDD-TEC-10, docs/decisions/0004-game-server.md ("Start tokens"): the key the server signs start tokens with comes from the environment, never from a file of the repository.
import { createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto';

export interface TokenKey { readonly privateKey: KeyObject; readonly publicKey: KeyObject; readonly publicText: string; readonly generated: boolean }

const withPublic = (privateKey: KeyObject, generated: boolean): TokenKey => {
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey, publicText: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), generated };
};

/**
 * `text` is the environment's `PONCHO_TOKEN_KEY`: a PKCS#8 Ed25519 private key, DER, in base64 (the ADR's format).
 * Unset or empty: the mock chain makes a key for the run (its tokens read only until the server stops); a real chain does not start.
 * No message here holds the text.
 */
export function loadTokenKey(text: string | undefined, mode: 'mock' | 'base'): TokenKey {
  if (text === undefined || text === '') {
    if (mode === 'base') throw new Error('PONCHO_TOKEN_KEY is not set');
    return withPublic(generateKeyPairSync('ed25519').privateKey, true);
  }
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({ key: Buffer.from(text, 'base64'), format: 'der', type: 'pkcs8' });
  } catch {
    throw new Error('PONCHO_TOKEN_KEY does not read');
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('PONCHO_TOKEN_KEY is not an Ed25519 key');
  return withPublic(privateKey, false);
}
