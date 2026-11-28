// GDD-TEC-10, "Wallet sessions"; docs/decisions/0004-game-server.md ("Sessions"): the session's secret travels in a cookie, which a
// browser keeps for the session's length, so a returning player's session is restored with no prompt (GDD-CHAIN-02).
// Placeholders of phase D2 (ADR 0004's proposal; where the server runs is not decided): the cookie's name, HttpOnly, SameSite=Lax and
// the path /api, and Secure only on an https site (routes-session.ts). What a client's Cookie header holds is never trusted to be a
// secret: anything not of a secret's shape is a guest, and nothing here can throw.

/** The session cookie's name (a placeholder: no document names one). */
export const SESSION_COOKIE = 'poncho_session';
// A session secret is 32 random bytes in base64url (server/sessions.ts): exactly 43 of these characters.
const SECRET = /^[A-Za-z0-9_-]{43}$/;

// A cookie header's optional white space is the space and the tab (RFC 6265), not all that `trim` takes: a no-break space is part of a name
// or a value, so `poncho_session\u00a0` is another cookie and a secret with one after it is 44 characters.
// A scan from each end, never a pattern: `[ \t]+$` tried from every place in a run of spaces takes time with the run's square (16 KiB of
// spaces inside a name held every other request up for 0.1 s).
const blank = (code: number): boolean => code === 0x20 || code === 0x09;
const bare = (text: string): string => {
  let start = 0;
  let end = text.length;
  // Neither loop needs a bound of its own (L-025): past either end `charCodeAt` gives NaN, which is not blank, and a text that is all
  // blank leaves `end` at or below `start`, which slices to nothing.
  while (blank(text.charCodeAt(start))) start += 1;
  while (blank(text.charCodeAt(end - 1))) end -= 1;
  return text.slice(start, end);
};

/**
 * The secret a Cookie header carries: the value of the one cookie of the name, if it has a secret's shape; else undefined (a guest).
 * A part's name is the text before its first '=' and its value the text after it, each without the spaces and tabs round it; a part with no '=' is no cookie. Names
 * are compared exactly. Two cookies of the name are a guest even when they are equal, as a doubled Origin is refused. Two Cookie headers
 * read as one list joined with '; ' (`Headers`); joined with ', ' the value fails the shape.
 */
export function secretOf(header: string | null): string | undefined {
  if (header === null) return undefined;
  const values: string[] = [];
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at === -1) continue;
    if (bare(part.slice(0, at)) === SESSION_COOKIE) values.push(bare(part.slice(at + 1)));
  }
  return values.length === 1 && SECRET.test(values[0] ?? '') ? values[0] : undefined;
}

/** The Set-Cookie text that keeps `secret` for `maxAge` seconds. */
export function sessionCookie(secret: string, maxAge: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${secret}; Max-Age=${maxAge}; Path=/api; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** The Set-Cookie text that takes the cookie away. */
export function clearedCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
