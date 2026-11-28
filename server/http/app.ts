// GDD-TEC-10, docs/decisions/0004-game-server.md ("HTTP"): the routes as functions of the standard Request to a Response, so a test calls them with no socket.
// Placeholder (ADR 0004, "Not decided here"): the API is served from the game's own origin under /api/v1, so `deps.site.origin` is the one
// origin a state-changing request may carry. Where the game is served is not decided.
// Every request passes the same steps in this order, and each can only refuse, before anything is written:
//   route, no query, (on a POST: Origin, content type, body, fields), the clock, then the handler, which may await the chain (a contract
//   wallet's signature) and write. A throw is a 500. Every handler is handed the session cookie's secret, read but not yet looked up.
import type { ChainSource } from '../chain/chain';
import { publicConfig, type ServerConfig } from '../config';
import type { Store } from '../store/store';
import type { TokenKey } from '../tokens/key';
import { BODY_LIMIT, fieldsOf, fromElsewhere, isJsonType, json, methodOf, readBody, REASON, refuse, withLine } from './boundary';
import { secretOf } from './cookie';
import { sessionRoutes } from './routes-session';

/** Where the game is served: its origin, and the domain and URI a sign-in message must name (docs/decisions/0004-game-server.md; a placeholder). */
export interface Site { readonly origin: string; readonly domain: string; readonly uri: string }
export type { RequestLog } from './boundary';
export interface AppDeps {
  readonly store: Store;
  readonly chain: ChainSource;
  readonly config: ServerConfig;
  readonly key: TokenKey;
  readonly site: Site;
  readonly clock: { now(): number };
  readonly random: (bytes: number) => Buffer;
  /** The simulation version this build was made with (GDD-TEC-09). */
  readonly sim: string;
}
/**
 * What a handler is given: the server's time (a finite number, read once); of a POST, the body, which has exactly the route's keys; and
 * `session`, the secret the request's cookie carries, of a secret's shape and not yet looked up (undefined: none, a guest).
 */
export interface Context { readonly deps: AppDeps; readonly now: number; readonly body: Readonly<Record<string, unknown>>; readonly session: string | undefined }
/** A route has no path parameters. A POST's body has exactly `keys` (a GET's `keys` are not read). */
export interface Route {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly keys: readonly string[];
  readonly handler: (context: Context) => Response | Promise<Response>;
}

// GDD-CHAIN-01 (Conflict C13, a placeholder): the one endpoint the client reads the config from; ADR 0004 ("Start tokens"): the public key is served with it.
const configRoute: Route = {
  method: 'GET',
  path: '/api/v1/config',
  keys: [],
  handler: ({ deps, now }) => json(200, { ...publicConfig(deps.config), tokenKey: deps.key.publicText, sim: deps.sim, now }),
};

const ROUTES: readonly Route[] = [configRoute, ...sessionRoutes];
const PATHS: ReadonlySet<string> = new Set(ROUTES.map((route) => route.path));

async function respond(deps: AppDeps, request: Request, path: string): Promise<Response> {
  const here = ROUTES.filter((route) => route.path === path);
  if (here.length === 0) return refuse(404, REASON.noRoute);
  const route = here.find((candidate) => candidate.method === request.method);
  // HEAD and OPTIONS are no route's method: they get a 405, so no CORS answer is ever given.
  if (route === undefined) return refuse(405, REASON.noMethod, here.map((candidate) => candidate.method).join(', '));
  if (new URL(request.url).search !== '') return refuse(400, REASON.noQuery);
  let body: Readonly<Record<string, unknown>> = {};
  if (route.method === 'POST') {
    if (fromElsewhere(request, deps.site.origin)) return refuse(403, REASON.notFromSite);
    if (!isJsonType(request.headers.get('content-type'))) return refuse(415, REASON.notJsonRequest);
    const read = await readBody(request, BODY_LIMIT);
    if (!read.ok) return refuse(read.status, read.reason);
    if (!fieldsOf(read.body, route.keys)) return refuse(400, REASON.otherFields);
    body = read.body;
  }
  // The clock is read once, after the body, so a request refused before it never needs it; a time that is no number is the server's fault.
  const now = deps.clock.now();
  if (!Number.isFinite(now)) return refuse(500, REASON.serverError);
  return route.handler({ deps, now, body, session: secretOf(request.headers.get('cookie')) });
}

/**
 * The server as a function: every answer, refusals and the 500 included, has the fixed headers and carries the one line it leaves
 * (`lineOf`), which the socket adapter logs once the answer is written. A 408 for a body that did not arrive whole is so never logged:
 * node gave up on the request and the adapter answered it as node does, or the client is gone.
 */
export function createApp(deps: AppDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const path = new URL(request.url).pathname;
    let response: Response;
    try {
      response = await respond(deps, request, path);
    } catch {
      // Nothing of what was thrown is answered or logged: on a real chain it could hold a key (PONCHO_RPC_URL).
      response = refuse(500, REASON.serverError);
    }
    return withLine(response, { method: methodOf(request.method), route: PATHS.has(path) ? path : '(none)', status: response.status });
  };
}
