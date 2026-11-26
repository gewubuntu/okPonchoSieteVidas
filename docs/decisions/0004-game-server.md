# 0004 The game server: Node and TypeScript in this repository, on Node's own modules, viem and SQLite

- **Status:** Decided: a Node and TypeScript server in this repository that runs the game's own simulation
  code, written up in an ADR first, built and tested against a mock chain while no contract address exists, and
  deployed only as a later step the user approves (user, 2026-11-21: "In this repo, TypeScript (Recommended)";
  Conflict C14), and four points of the stack (user, 2026-11-22: "Approve as proposed (Recommended)"): Node's own
  HTTP server; Node's own SQLite behind a storage interface; one library, viem, for the wallet sign-in and the
  chain's events; and start tokens signed with Ed25519, the key from the environment. Every other detail below (the
  folder, the scripts, the session cookie, where the config lives, the chain interface and its dev routes, the Node
  version) is the main session's proposal, built as a placeholder (GDD-CHAIN-01) where the GDD holds the point open.
  What is listed under "Not decided here" stays open.
- **Built:** nothing when this record was written. The files, scripts and line counts it names are the plan's; "is
  written" and "built as" say what the plan builds.
- **GDD:** GDD-TEC-10, GDD-LIFE-06, GDD-CHAIN-02, GDD-CHAIN-03, GDD-CHAIN-04, GDD-TEC-09, GDD-TEC-07

## Context

The game is static files with no server of its own (GDD-TEC-08). The Poncho on Base proposal needs one (GDD-TEC-10):
the only place that counts ledger lives (GDD-LIFE-06), the issuer of start tokens, wallet sessions by Sign-In with
Ethereum, a listener for the chain events `LivesBought(buyer, n)` and `Activated(tokenId, owner, season)`, and a save
per wallet. In Phase 2 it also replays league records with the very simulation the game runs (GDD-TEC-09), so its
code has to be able to import `src/sim/`, `src/levels/` and `src/config/tuning.ts` and never hold a second copy.

What was checked for this record (2026-11-21, in a throwaway copy of the repository, not in it):

- The cloud container runs Node 22.23.5 and CI runs Node 24; both must pass (ADR 0002).
- `node:sqlite` is in both. Node 22 marks it "1.1 Active development" (no flag since 22.13.0, a warning on first
  use); Node 24 marks it "1.2 Release candidate" since 24.15.0. A table, an upsert and a transaction ran on 22.23.5.
- `viem` 2.58.4 (the `latest` tag; 3.0.0 is a pre-release) type-checks under TypeScript 7.0.2 with this
  repository's strict settings, and added to this repository's lock file it installs 13 packages. Its Sign-In with
  Ethereum helpers, its contract-wallet signature check (one `eth_call` to the ERC-6492 validator, which also
  covers ERC-1271) and its event log reading were each run against a fake JSON-RPC answer.
- Vitest 5.1.0 runs tests that import `node:sqlite` and `viem`; Oxlint lints a `server/` folder with no config
  change; `vite build --ssr server/main.ts` bundles a server that imports `../src/levels/index` and
  `../src/sim/save` into one file that Node runs.

## Decision

- **Where it lives:** a `server/` folder at the repository's top, beside `src/`. One package, one lock file, one
  `npm ci`. Server code imports the game's own modules by relative path (`../src/sim/save`,
  `../src/levels/index`); nothing of the game imports `server/`.
- **How the gate reaches it:** `server/tsconfig.json` extends the root one without the browser's types
  (`lib: ["ES2022"]`, `types: ["node"]`), so server code, and whatever of `src/` it imports, cannot use the DOM;
  `npm run typecheck` runs both projects. `npm run lint` already covers the folder. `npm test` gains
  `server/**/*.test.ts`. No change to `scripts/check.mjs`.
- **How it runs:** Vite, already the bundler, builds it: `npm run server:build` writes `server/dist/main.js`
  (ignored by git, the linter and the gate through their existing `dist` rules), `npm run server` builds and starts
  it, and `npm run server:check` builds, boots, reads its own config endpoint and exits (the CI step). With nothing
  configured it starts on the mock chain with a memory store.
- **HTTP:** Node's own `node:http`, with handlers written against the standard `Request` and `Response`, so tests
  call them with no socket. About a dozen routes with no path parameters: a router would be a dependency for a
  `switch`.
- **Dependencies:** one, `viem` `^2.58.4`: reading and checking Sign-In with Ethereum messages, recovering a plain
  key's signature, checking a contract wallet's signature on Base (ERC-1271, and ERC-6492 for a wallet not yet
  deployed, which is what "Coinbase Smart Wallet first" needs), and reading event logs and a token's owner. It is
  imported only by `server/sessions.ts` and `server/chain/viem.ts`.
- **Storage:** Node's own `node:sqlite`, one file, behind a five-method `Store` interface (`get`, `put`, `delete`,
  `entries`, `transaction`) with two implementations, memory (tests, local runs) and SQLite, held to the same
  contract tests. Rows are JSON text under a table name and a key. The interface is synchronous, as both
  implementations are: a ledger life and its token are read and written in one synchronous transaction, so two
  requests can never both take the last life.
- **Start tokens:** signed with Ed25519 through `node:crypto` (`sign`, `verify`): the text is the token's JSON in
  base64url, a dot, and the signature. The public key is served with the public config, so a client, or Phase 2's
  replay, can check a token without the private key. The server also keeps a row per token (issued, started,
  continued), which is what "single use" rests on.
- **Keys and secrets:** the token key is supplied in the environment (`PONCHO_TOKEN_KEY`, a PKCS#8 Ed25519 key in
  base64), never in a file of the repository; `.env` files are already ignored. With the mock chain and no key the
  server makes a key for the run and says so. With a real chain and no key it does not start. The RPC address may
  hold a provider's key, so it also comes from the environment (`PONCHO_RPC_URL`) and is never in the public config.
- **Sessions:** a random 32-byte secret in a cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, path `/api`); the store
  holds only its SHA-256. The API is meant to be served from the game's own origin under `/api/v1`, so the cookie is
  first-party and no cross-origin rules are needed. State-changing requests that carry an `Origin` other than the
  game's are refused.
- **Config:** the proposal's named values (`LEDGER.*`, `SEASON.*`, `START_TOKEN.*`, `SESSION.*`, `CHAIN.*`) live in
  `server/config.ts` with the GDD's starting values, an optional JSON file of overrides read at start
  (`PONCHO_SERVER_CONFIG`), and one endpoint the client reads them from (Conflict C13's recommendation). The values
  the GDD leaves unset are `null`. With the mock chain they take stand-ins that are marked as such; a real chain
  listener does not start while any is `null`.
- **The mock chain:** the chain is an interface (`head`, `events`, `ownerOf`, `palsOf`, `verifySignature`). The
  mock implements it in memory and is what tests and local runs use; routes under `/api/v1/dev/` (mock only) let a
  developer or a playtest emit a purchase or an activation, set a Pal's owner, mine blocks and move the server's
  clock. The real one, built on viem, is selected only by `CHAIN.mode: "base"` with every address set.
- **Not deployed.** Nothing in `Dockerfile`, `deploy/` or `.github/workflows/deploy.yml` changes; the game's image
  holds only `dist/`.

### Not decided here

- The values not set (Open Question 54 (e)): `LEDGER.packPrice`, `START_TOKEN.startWithin`, `SESSION.length`,
  `CHAIN.confirmations`, `SEASON.firstStartUtc`.
- The contracts: their addresses, the events' exact ABI (which arguments are indexed), whether one contract emits
  both events, how seasons are numbered, and whether the Pals collection can list an owner's tokens. The real chain
  source is written against assumptions that are named in its code and has only ever met a fake JSON-RPC.
- Whether the server ever counts guests (Open Question 53 (a); built as: it does not), whether campaign results are
  replayed (Open Question 54 (b); built as: trusted), which save wins where the browser's and the server's differ
  (Open Question 53 (c); the server only refuses a write based on an older revision), what is kept about a player
  and for how long (Open Question 54 (d); nothing is deleted but expired nonces and sessions), and league tokens
  (Open Question 57; none is issued).
- Where the config values live (Conflict C13, Open Question 54 (f)): `server/config.ts` with one endpoint is the
  recommended resolution, built as a placeholder.
- How a Pal's owner is known (Open Question 54 (c)): answered since (user, 2026-11-26: "Go with your recommendations,
  start phase C"): the collection is read for the owner as a start token is asked for (the chain interface's `ownerOf`),
  its transfers are not followed, and a Pal counts only for the wallet that holds it.
- That the API is served from the game's own origin: an assumption of the cookie's design, since where the server
  runs is not decided. Another origin needs cross-origin rules and another cookie.
- Where it is deployed and how (below).

## Alternatives

- **A router or framework (Hono 4.13.19, Fastify):** routing and body parsing for a dozen fixed routes; a
  dependency to keep current (GDD-TEC-07) for what a `switch` does.
- **The `siwe` package (3.0.0):** needs `ethers` beside it; viem reads the same message and is needed for the
  contract-wallet check and the logs anyway.
- **`better-sqlite3` (13.2.0):** stable and fast, but a native addon to build or download for each Node version and
  for the server's image. `node:sqlite` is the same engine with nothing to install; its risk is its status, held
  behind the `Store` interface.
- **A JSON file as the store:** no transactions; a crash between a credit and its "applied" mark would count a
  purchase twice.
- **Postgres or another database server:** a second thing to run, back up and secure for a ledger of at most a few
  thousand wallets.
- **A signed cookie or JWT with no session row:** signing out could not end a session before it runs out.
- **HMAC for the start token:** simpler, but only the holder of the secret can check a token; Phase 2's replay and
  the client would have to ask the server.
- **Running the TypeScript directly (Node's type stripping, or `tsx` 4.23.15):** the game's modules import each
  other without file extensions, which Node's own loader refuses; `tsx` would be a second tool doing what Vite
  already does.
- **A separate package or workspace for the server:** two lock files or a workspace setup, for no gain while the
  server must import `src/`.

## Consequences

- The repository has its first runtime dependency beside Phaser. viem brings 13 packages into the lock file; the
  game's bundle changes only if client code imports it.
- `engines.node` moves from `>=22.12.0` to `>=22.13.0` (`node:sqlite` without a flag). On Node 22 the first use of
  SQLite prints an experimental warning; it is not an error.
- `node:sqlite` is not yet stable. If its API changes, `server/store/sqlite.ts` (about 40 lines) changes and the
  contract tests say whether it still holds; moving to another store means writing one more implementation of the
  five methods. A networked database would make the interface asynchronous, which is a rewrite of the callers'
  transactions, not a swap.
- Rows are JSON under a key, so there are no queries across wallets (a table of all purchases, say) without reading
  a whole table. Fine for the ledger; Phase 2's league tables will want real tables, in the same file.
- Nonces and sessions are swept when they are read or on a timer; nothing else is ever deleted. There is no rate
  limit: anyone can ask for nonces. Both are for the deploy step to settle (a limit at the edge Caddy).
- A reorganisation of the chain deeper than `CHAIN.confirmations` is not undone: the event stays counted.
- The life is taken when the token is issued. A token whose answer is lost on the way still cost its life (Open
  Question 52 (f)).
- The server trusts the client for campaign results (Open Question 54 (b)): a changed client can ask for the
  no-cost token of the next world without having cleared the world. It gains the play and nothing else.
- The real chain source cannot be checked against a real contract until one exists. Until then `CHAIN.mode: "base"`
  is not to be used outside a rehearsal.

## What deploying or upgrading later needs

Deploying is its own step, with the user's approval and its own ADR or an addition to this one (GDD-TEC-08, ADR
0003, `docs/deploy.md`):

- a second image (Node 24 and `server/dist/main.js` with its `node_modules`), a `server` service in
  `deploy/compose.yaml` with a volume for the SQLite file, and a route for `/api/*` in the project's own
  `deploy/Caddyfile`, changing nothing of another project on the server (L-087);
- the secrets on the server, not in GitHub's build: `PONCHO_TOKEN_KEY`, `PONCHO_RPC_URL`, and the config file with
  the values the user has decided by then;
- a backup of the SQLite file (it is the ledger: bought lives are paid for), and a rule for rotating the token key
  (tokens not yet started die with the old key; started ones live on in their rows);
- a rate limit, and a health check for the deploy script;
- a dry run that reproduces what differs on the runner and on the server (L-083): Node 24, a fresh install, two
  deploys at once, a restart in the middle of a batch of events, an RPC that fails.

Upgrading: viem 3 when it is stable (the calls used are few: `parseSiweMessage`, `recoverMessageAddress`,
`createPublicClient`, `getLogs`, `readContract`, `verifyMessage`); `node:sqlite` when Node marks it stable; and
GDD-TEC-09's simulation version in place of the token's stand-in once the replay work has one.
