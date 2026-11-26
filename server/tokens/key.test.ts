import { generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadTokenKey } from './key';

const privateText = (key: KeyObject): string => key.export({ format: 'der', type: 'pkcs8' }).toString('base64');

describe('GDD-TEC-10 token key', () => {
  it('reads an Ed25519 key from the environment', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const loaded = loadTokenKey(privateText(privateKey), 'base');
    expect(loaded.generated).toBe(false);
    const message = Buffer.from('a start token');
    expect(verify(null, message, publicKey, sign(null, message, loaded.privateKey))).toBe(true);
    expect(loaded.publicText).toBe(publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
  });

  it('makes a key for the run with the mock chain and none set', () => {
    for (const text of [undefined, '']) {
      const loaded = loadTokenKey(text, 'mock');
      expect(loaded.generated).toBe(true);
      expect(loaded.privateKey.asymmetricKeyType).toBe('ed25519');
      expect(loaded.publicKey.asymmetricKeyType).toBe('ed25519');
      const message = Buffer.from('a start token');
      expect(verify(null, message, loaded.publicKey, sign(null, message, loaded.privateKey))).toBe(true);
    }
  });

  it('a real chain does not start without a key', () => {
    expect(() => loadTokenKey(undefined, 'base')).toThrow('PONCHO_TOKEN_KEY is not set');
    expect(() => loadTokenKey('', 'base')).toThrow('PONCHO_TOKEN_KEY is not set');
  });

  it('refuses a key that is not Ed25519 or does not read', () => {
    const other = generateKeyPairSync('x25519').privateKey;
    expect(() => loadTokenKey(privateText(other), 'base')).toThrow('PONCHO_TOKEN_KEY is not an Ed25519 key');
    expect(() => loadTokenKey('not a key', 'base')).toThrow('PONCHO_TOKEN_KEY does not read');
    let message = '';
    try {
      loadTokenKey('not a key', 'mock');
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('PONCHO_TOKEN_KEY does not read');
    expect(message).not.toContain('not a key');
  });
});
