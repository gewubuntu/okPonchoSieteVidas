// GDD-TEC-09: a run's whole state as one canonical text, and its 64-bit hash, the same in every engine for the same state.
import { bitsOf } from './detmath';
import { fnv1a64 } from './fnv';

/**
 * The canonical text of plain data: object keys in sorted order (a respawn builds the state as a fresh literal and a step by a
 * spread, so two equal states can hold their keys in different orders), a key whose value is undefined kept, numbers by their 64
 * bits, a Set (`LivesState.used`) in its own order, and every character of a string from U+0080 up as `\uXXXX`, so `fnv1a64` reads
 * ASCII only. Anything else (a function, a Map, a class instance) is no state.
 */
export function stateText(value: unknown): string {
  if (value === null) return 'N';
  if (value === undefined) return 'U';
  if (value === true) return 'T';
  if (value === false) return 'F';
  if (typeof value === 'number') return `n${bitsOf(value)}`;
  if (typeof value === 'string') return JSON.stringify(value).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (Array.isArray(value)) return `[${value.map(stateText).join(',')}]`;
  if (value instanceof Set) return `S[${[...value].map(stateText).join(',')}]`;
  // A function's, a Map's and a class instance's prototype is not Object's (nor a bigint's or a symbol's), so this one test refuses them all.
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('a state holds plain data only');
  const fields = new Map<string, unknown>(Object.entries(value));
  const keys = [...fields.keys()];
  keys.sort();
  return `{${keys.map((k) => `${k}:${stateText(fields.get(k))}`).join(',')}}`;
}

/** GDD-TEC-09: the hash of a run's state (or any plain data). */
export const stateHash = (value: unknown): string => fnv1a64(stateText(value));
