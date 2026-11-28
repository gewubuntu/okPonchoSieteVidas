import { describe, expect, it } from 'vitest';
import { clearedCookie, secretOf, sessionCookie } from './cookie';

// A secret's shape: 43 characters of base64url, as 32 random bytes write (server/sessions.ts).
const S = 'A'.repeat(43);
const T = 'B'.repeat(43);

describe('GDD-TEC-10 the session cookie', () => {
  it('reads the one cookie of the name', () => {
    expect(secretOf(`poncho_session=${S}`)).toBe(S);
  });

  it.each([
    ['42 characters', 'A'.repeat(42)],
    ['44 characters', 'A'.repeat(44)],
    ['an empty value', ''],
    ['43 with one plus sign', `${'A'.repeat(42)}+`],
    ['43 with one slash', `${'A'.repeat(42)}/`],
    ['43 with one equals sign inside', `${'A'.repeat(21)}=${'A'.repeat(21)}`],
    ['the value in double quotes', `"${S}"`],
    ['a character before the secret', `x${S}`],
    ['a character after the secret', `${S}x`],
  ])('a value not of a secret\'s shape is a guest: %s', (_name, value) => {
    expect(secretOf(`poncho_session=${value}`)).toBeUndefined();
  });

  it('takes every character of base64url', () => {
    const value = 'abcXYZ019_-'.repeat(4).slice(0, 43);
    expect(value).toHaveLength(43);
    expect(secretOf(`poncho_session=${value}`)).toBe(value);
  });

  it.each([
    ['after another', `a=1; poncho_session=${S}`],
    ['before another', `poncho_session=${S}; b=2`],
    ['with no spaces between', `a=1;poncho_session=${S};b=2`],
    ['with spaces round the name and the value', `  poncho_session = ${S}  `],
    ['with tabs round the name and the value', `\tponcho_session\t=\t${S}\t`],
    ['beside a cookie whose name ends in a no-break space', `poncho_session\u00a0=${T}; poncho_session=${S}`],
    ['after a part with no equals sign', `a; poncho_session=${S}`],
    ['after a part with no equals sign that starts with the name', `poncho_sessionx; poncho_session=${S}`],
  ])('the cookie among others is read: %s', (_name, header) => {
    expect(secretOf(header)).toBe(S);
  });

  it('spaces and tabs inside a name or a value stay, and only those round it go', () => {
    expect(secretOf(`poncho _session=${S}`)).toBeUndefined();
    expect(secretOf(`poncho_session=${'A'.repeat(21)} ${'A'.repeat(21)}`)).toBeUndefined();
    expect(secretOf(`poncho_session= \t \t${S}\t \t `)).toBe(S);
    expect(secretOf('poncho_session= \t ')).toBeUndefined();
    expect(secretOf(` \t =${S}; poncho_session=${S}`)).toBe(S);
  });

  it('a run of 16000 spaces or tabs inside a name is read in time that grows with its length, not its square', () => {
    for (const blank of [' ', '\t']) {
      const header = `a${blank.repeat(16000)}b=1; poncho_session=${S}`;
      const from = performance.now();
      for (let n = 0; n < 200; n += 1) expect(secretOf(header)).toBe(S);
      // Measured: 200 reads take about 10 ms with the scan; with a pattern they took about 120 ms each, 24 s in all.
      expect(performance.now() - from).toBeLessThan(2000);
    }
  });

  it('two cookies of the name are a guest', () => {
    expect(secretOf(`poncho_session=${S}; poncho_session=${T}`)).toBeUndefined();
    expect(secretOf(`poncho_session=${S}; poncho_session=${S}`)).toBeUndefined();
    expect(secretOf(`poncho_session=${S}; poncho_session=x`)).toBeUndefined();
    // The second one's value holds an equals sign: it is still a cookie of the name, read up to its first '='.
    expect(secretOf(`poncho_session=${S}; poncho_session=a=b`)).toBeUndefined();
  });

  it.each([
    ['the name in other letters', `Poncho_Session=${S}`],
    ['a letter before the name', `xponcho_session=${S}`],
    ['a letter after the name', `poncho_sessionx=${S}`],
    ['the name inside a value', `a=poncho_session=${S}`],
    ['a no-break space after the name', `poncho_session\u00a0=${S}`],
    ['a no-break space before the name', `\u00a0poncho_session=${S}`],
    ['a no-break space after the secret', `poncho_session=${S}\u00a0`],
    ['a no-break space before the secret', `poncho_session=\u00a0${S}`],
    ['a line feed after the secret', `poncho_session=${S}\n`],
    ['no header', null],
    ['the empty header', ''],
    ['only separators', ';;;'],
  ])('another name, or none, is a guest: %s', (_name, header) => {
    expect(secretOf(header)).toBeUndefined();
  });

  it('two Cookie headers read as one list', () => {
    const headers = new Headers();
    headers.append('cookie', 'a=1');
    headers.append('cookie', `poncho_session=${S}`);
    expect(secretOf(headers.get('cookie'))).toBe(S);
    const doubled = new Headers();
    doubled.append('cookie', `poncho_session=${S}`);
    doubled.append('cookie', `poncho_session=${S}`);
    expect(secretOf(doubled.get('cookie'))).toBeUndefined();
  });

  it('writes the cookie', () => {
    expect(sessionCookie(S, 604800, false)).toBe(`poncho_session=${S}; Max-Age=604800; Path=/api; HttpOnly; SameSite=Lax`);
    expect(sessionCookie(S, 604800, true)).toBe(`poncho_session=${S}; Max-Age=604800; Path=/api; HttpOnly; SameSite=Lax; Secure`);
  });

  it('takes the cookie away', () => {
    expect(clearedCookie(false)).toBe('poncho_session=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax');
    expect(clearedCookie(true)).toBe('poncho_session=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax; Secure');
  });

  it('what it writes it reads back', () => {
    expect(secretOf(sessionCookie(S, 1, true).split(';')[0] ?? '')).toBe(S);
    expect(secretOf(clearedCookie(true).split(';')[0] ?? '')).toBeUndefined();
  });
});
