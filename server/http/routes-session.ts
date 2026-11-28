// GDD-TEC-10, "Wallet sessions": the sign-in routes. The nonce; the sign-in, which opens a session and gives its secret in the cookie
// only, never in the body; the session, which reads the cookie's wallet (a guest is null); and the sign-out, which leaves a guest.
// The two POSTs are under the pipeline's Origin rule (ADR 0004, "Sessions": state-changing requests); the GET is not, as it changes
// nothing a client chooses (a session read after its end is deleted). Several sessions of one wallet are all good (GDD-CHAIN-02), so a
// sign-in leaves a session the request's own cookie already names as it is.
import { issueNonce, sessionOf, signIn, signOut, type SessionDeps } from '../sessions';
import type { AppDeps, Route, Site } from './app';
import { json, refuse } from './boundary';
import { clearedCookie, sessionCookie } from './cookie';

const sessionDeps = ({ store, chain, config, site, random }: AppDeps): SessionDeps => ({ store, chain, config, site: { domain: site.domain, uri: site.uri }, random });
/**
 * Placeholder: ADR 0004 says Secure, and where the server runs is not decided. The cookie is Secure on an https site only, since the
 * default origin is http (the Vite dev server's) and a browser keeps a Secure cookie from an http page only on some engines.
 */
const secureOn = (site: Site): boolean => site.origin.startsWith('https://');

export const sessionRoutes: readonly Route[] = [
  {
    method: 'POST',
    path: '/api/v1/sign-in/nonce',
    keys: [],
    handler: ({ deps }) => json(200, { nonce: issueNonce(sessionDeps(deps)) }),
  },
  {
    method: 'POST',
    path: '/api/v1/sign-in',
    keys: ['message', 'signature'],
    handler: async ({ deps, now, body }) => {
      const signed = await signIn(sessionDeps(deps), { message: body['message'], signature: body['signature'] }, now);
      // The reason is signIn's own text, never the client's. A 403, not a 401: a 401 must carry a WWW-Authenticate header, and none fits.
      if (!signed.ok) return refuse(403, signed.reason);
      const { wallet, secret, expiresAt } = signed;
      // The cookie ends when the session does: Max-Age is the session's length in whole seconds (SESSION.length).
      return json(200, { wallet, expiresAt }, [sessionCookie(secret, (expiresAt - now) / 1000, secureOn(deps.site))]);
    },
  },
  {
    method: 'GET',
    path: '/api/v1/session',
    keys: [],
    handler: ({ deps, now, session }) => json(200, { wallet: sessionOf(deps.store, session, now) }),
  },
  {
    method: 'POST',
    path: '/api/v1/sign-out',
    keys: [],
    // The cookie is taken away whether or not a session was there.
    handler: ({ deps, session }) => {
      signOut(deps.store, session);
      return json(200, {}, [clearedCookie(secureOn(deps.site))]);
    },
  },
];
