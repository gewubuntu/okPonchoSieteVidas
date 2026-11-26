# The game server, wallets and the chain

Rules for step 5 of the `harness-feature` skill, one to a line, each with where it comes from: the GDD, `docs/decisions/0004-game-server.md`, or a lesson. Of the ADR the user decided the four points its Status names; the rest of it is how the server is built so far, a placeholder until decided, and a plan that leans on such a rule names it as one. Read when the change touches `server/`, or builds a wallet, token or chain feature of the GDD's section 16.

## What is decided, and what is not (GDD-CHAIN-01, GDD-TEC-10)

- Build only what the first wave of GDD-CHAIN-01 names, or what the user has decided since, with their words quoted in the plan. Before the plan goes out, list under its `## Families` heading every Open Question of the sections its rules touch (for a Pal: Open Questions 54 and 55, each letter) and say for each what the build does: nothing, a named placeholder, or the user's answer (L-096). An ADR's placeholder for an Open Question is not an answer: it waits for the question to be put to the user with its first caller, as ADR 0004's `ownerOf` and `palsOf` waited for Open Question 54 (c) until the user answered it (2026-11-26) (L-096). Hero select, the leagues, the cosmetics and a real wallet adapter are not decided: a plan that needs one stops and asks.
- The chain is the mock: tests and local runs use the chain interface's in-memory one. A call to a real chain, a contract address, or anything in `Dockerfile`, `deploy/` or `.github/workflows/deploy.yml` is a later step the user approves, never part of a feature's plan.
- What a player could reach of the lives, wallet and Pal features stays off in the production build until the user turns it on, and no build holds the stand-in Pals. A plan that adds such a thing names the switch that keeps it out and plans the test that shows it off in a production build.
- Where the build meets a conflict of section 16 that is not decided, it builds what GDD-CHAIN-01's "Placeholders" sentence names for that conflict, and nothing else: the recommended resolution for C3, C4, C10, C11 and C13 only; nothing of C5 and of C6; C8 and C12 as that sentence words them. A conflict it does not name, and an Open Question, stop the plan and go to the user (step 3). A placeholder is named as one in a comment at its code, in the GDD section that says what is built, and in the pull request; changing it later is that conflict's decision.
- A sentence that says a thing is built, named or tested is checked against the diff (the function, the test's name) before it goes into the GDD, the changelog or the pull request, never taken from the plan (L-097).

## How server code is written (`docs/decisions/0004-game-server.md`)

- Server code lives under `server/` and imports the game's modules by relative path; nothing under `src/` imports `server/` (the gate's `server-one-way`).
- It has no browser types: `server/tsconfig.json` leaves the DOM out, and so does whatever of `src/` it imports. A plan that imports a new game module into the server checks that module, and what it imports, uses nothing of the browser.
- A rule is a pure function: the time and the stored counts are handed in, as in `server/ledger.ts`, so a test sets the time it needs. (This is how the first phase is built, not a decision of the ADR.)
- A number the GDD names (`LEDGER.*`, `SEASON.*`, `START_TOKEN.*`, `SESSION.*`, `CHAIN.*`) lives in `server/config.ts` under that name, never as a number in code (that file is Conflict C13's placeholder, not a decision). One the GDD leaves unset is `null`; a stand-in for it is marked as one, and a real chain listener does not start while any is `null`.
- Keys and secrets come from the environment (`PONCHO_TOKEN_KEY`, `PONCHO_RPC_URL`): never from a file of the repository, never into the public config, a log line or a test's expected text.
- Storage goes through the `Store` interface, and both implementations (memory, SQLite) pass the same contract tests: a new method or guarantee is added to those tests, not to one implementation's own. A read and a write that must not be split by another request are one synchronous transaction.
- A handler is written against the standard `Request` and `Response` and tested by calling it, with no socket.
- A new dependency is the user's decision and an edit of the ADR; its version is looked up in the registry, not remembered (GDD-TEC-07, L-005). `viem` is imported only where the ADR says.

## Tests

- Every bound gets a fixture on it: the last bought life, the clamp of what is left, the carry of a month or a year into the next (L-010, recurrence 36). `node scripts/mutate.mjs --suggest` lists them.
- A rule that carries several fields over (hours, minutes, seconds, milliseconds) gets a fixture where each is not zero, so dropping one changes the answer (L-010, recurrence 37).
- A pattern's quantifier and anchors are bounds too: a check of a shape (an address, a token ID) gets a fixture exactly one step longer and one step shorter (on the bound, not anywhere past it), empty, and with text before it and after it, at every place that checks the shape (L-010).
- A mock of the chain models what the listener relies on: its head is a sealed block, and the plan works a case where an event arrives after a read, not only the first read (L-077).
- A thing that counts once gets a test that sends it twice and checks the second changes nothing: a start token is single use by the ADR, and so is whatever a later decision makes count once.
- A rule that refuses someone gets a test for the one refused, not only for the one let through: as built, a state-changing request from another origin is refused (the ADR lists the game's own origin as an assumption, not a decision).

## The GDD after the build (L-013)

- The first code for a section makes "not built", "none of it is in code yet" and a `todo` backlog row false in sections well beyond the one being built: give `node scripts/check.mjs --gdd-hunt` every GDD ID a comment in the diff cites, not only the plan's own (L-013, recurrences 39 and 40).
