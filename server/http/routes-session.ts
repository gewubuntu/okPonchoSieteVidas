// GDD-TEC-10, "Wallet sessions": the sign-in routes. The nonce is the first; sign-in, session and sign-out come with phase D2.
import { issueNonce } from '../sessions';
import type { Route } from './app';
import { json } from './boundary';

export const sessionRoutes: readonly Route[] = [
  {
    method: 'POST',
    path: '/api/v1/sign-in/nonce',
    keys: [],
    handler: ({ deps }) => {
      const { store, chain, config, site, random } = deps;
      return json(200, { nonce: issueNonce({ store, chain, config, site: { domain: site.domain, uri: site.uri }, random }) });
    },
  },
];
