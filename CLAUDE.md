# PONCHO: Siete Vidas

A 2D pixel-art platformer. The hero is **Poncho**, a cat in a Mexican poncho (serape), the origin
character of Poncho on Base ("PB"). The game is built on **Phaser 4 + TypeScript 7 + Vite 8 + Vitest 5**,
linted with Oxlint, targeting **web and mobile browsers**. The stack tracks the latest stable releases
(`GDD-TEC-01`, `GDD-TEC-07`, `docs/decisions/0002-state-of-the-art-stack.md`). Do not reintroduce ESLint or Phaser 3.

## The anchor rule

`docs/GDD.md` is the single source of truth. Every feature, test, backlog row and
commit refers to a stable GDD ID such as `GDD-MOV-02`.

- No GDD ID, no feature. If an idea has no ID, use the `harness-gdd-update` skill first.
- Never present a guess as a decision. Each GDD section has `Status: Decided | Proposed | Deprecated`.
  Only the user turns `Proposed` into `Decided`.
- Tuning numbers live in the GDD and in one code file (`src/config/tuning.ts`, once it exists).
  Change both together, in the same commit.
- Poncho's look is defined by the user's reference image (`GDD-ART-02`). Never invent visual
  details that image might contradict.

## Work loop (every task)

1. **Read** the GDD section(s) you are implementing, and `docs/LESSONS.md`.
2. **Plan** briefly. Name the GDD IDs touched. Ask the user only when blocked on a decision that is theirs.
3. **Test first** where logic is testable (movement, lives, damage, save data are pure code).
4. **Implement** the smallest change that satisfies the GDD text. For a feature, the main session writes the plan and the `implementer` subagent writes the tests and code from it, then the main session checks the result (`harness-feature` steps 5 to 7, `docs/HARNESS.md`).
5. **Check**: run `node scripts/check.mjs`. It must pass before every commit.
6. **Retro**: run the `harness-retro` skill. Append lessons, promote recurring ones.
7. **Commit** with the GDD IDs in the message, e.g. `feat(GDD-MOV-02): variable jump height`.

## Self-improvement loop

The harness improves itself through `docs/LESSONS.md` and `scripts/check.mjs`.

- A mistake becomes a lesson (what went wrong, root cause, rule).
- A lesson that recurs (Recurrence >= 2) must be **promoted**: into a rule in this file,
  a step in a skill, or best of all an automated check in `scripts/check.mjs`.
- Prefer automated checks over prose rules. A rule nobody enforces will be broken again.
- Details: `docs/HARNESS.md`.

## Commands

| Command | Purpose |
| --- | --- |
| `node scripts/check.mjs` | The gate: GDD integrity, backlog, lessons, skills, then `npm run lint`, `typecheck` and `test`. Must pass before every commit. |
| `npm install` | Install dependencies (needed once, and by CI). |
| `npm run dev` | Dev server on port 5173. |
| `npm run build` | Typecheck and production build into `dist/`. |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`). |
| `npm run shots` | Screenshots for visual review: desktop and phone viewport, into `shots/` (not committed). Scenarios live in `e2e/shots/`. |
| `node scripts/overview.mjs docs/screenshots/<slug>` | Compose the approved screenshots in that folder into its `overview.png` sheet (L-031). |
| `node scripts/pr-screenshots.mjs [base]` | Warn if visible files changed and no screenshot was added under `docs/screenshots/`. |
| `npm run test:e2e` | Playwright playtests on desktop and phone viewports (see the `harness-playtest` skill). |
| `node scripts/mutate.mjs <mutants.json>` | Run mutants (L-010) and restore each file; `--restore` after an interrupted run, which the gate otherwise fails on (L-020). |
| `node scripts/check.mjs --backlog-stub` | Print backlog rows for GDD IDs missing from `docs/BACKLOG.md`. |

## Repository map

- `docs/GDD.md` game design document (anchor)
- `docs/BACKLOG.md` GDD ID to status
- `docs/LESSONS.md` append-only lessons log
- `docs/HARNESS.md` how the harness works
- `docs/decisions/` architecture decision records
- `.claude/skills/` project skills, all prefixed `harness-`: `harness-feature`, `harness-gdd-update`, `harness-playtest`, `harness-retro`
- `.claude/agents/pr-reviewer.md` the subagent that reviews every pull request
- `.claude/agents/implementer.md` the subagent that builds a feature from the main session's plan (`harness-feature` steps 5 to 7)
- `.claude/settings.json` project hooks (a hook reminds you to run the reviewer after a PR is created)
- `scripts/check.mjs` the gate
- `src/config/tuning.ts` every gameplay number, tagged with its GDD ID
- `src/sim/` pure game logic (movement, fixed-step loop), no Phaser imports
- `src/scenes/` Phaser scenes: wiring only (input, rendering, audio)
- `e2e/` Playwright playtests; `e2e/shots/` screenshot scenarios for visual review
- `docs/screenshots/<slug>/` screenshots the user approved, embedded in PR descriptions
- `assets/` art and audio. `assets/characters/poncho/reference.jpg` is Poncho's reference image

## Conventions

- Cite GDD IDs in code comments only where a number or rule comes from the GDD.
- Keep simulation logic (movement, lives, damage) free of Phaser imports so it is unit-testable.
- Input that starts something on a press (jump, claw, and later Fuego) is latched from raw key and pointer events with `src/ui/inputLatch.ts` and cleared by the step that uses it, never only polled once per frame (L-006). A new press-driven action needs a test in `e2e/subframe.spec.ts` that taps it inside one task. Pause (Escape, P) is the exception: it is applied per frame, not per step, from raw browser `keydown` events with auto-repeat ignored, so it needs no latch. It must not use Phaser `Key` `down` events, which can fire again on the release when a press and release land in one frame (L-006), and an extra event toggles the pause back. Its one-task tap tests are in `e2e/pause.spec.ts`. The gamepad is the other exception: browsers give no raw pad events, so it is polled once per frame in `src/ui/gamepad.ts` with no latch, and a press shorter than a frame can be missed (user, 2026-10-25; GDD-CTL-02, GDD-CTL-04). It needs no `e2e/subframe.spec.ts` test.
- Do not add game code that no GDD ID asks for.
- Do not name AI models in repository files or in commit subjects and bodies. Attribution trailers (such as `Co-Authored-By`) follow the session's own instructions.
- Commit on the branch the session designates. Do not open a PR unless the user asks.

## Pull requests

- Base branch is `main`. Work step by step: one small PR at a time, each one a single GDD ID or a tight group of them.
- Every PR keeps the gate green (`node scripts/check.mjs`) and CI green, updates the backlog row, and fills in `.github/pull_request_template.md`.
- **Every PR gets a deep review from the `pr-reviewer` subagent.** Right after you create a PR (a hook reminds you), launch it with the Agent tool: `subagent_type` `pr-reviewer`, prompt with the PR number. It checks the PR out, runs it, audits the GDD changes, looks at the screenshots and posts one GitHub review. Fix its blocking findings with a push before you tell the user the PR is ready, and include its verdict in your report. When the user says they opened a PR, launch it on that PR too. If the agent type is not available in the session (the first time `.claude/agents/` appears a restart is needed), launch a general-purpose agent with the instruction to follow `.claude/agents/pr-reviewer.md` exactly.
- **Visible changes need the user's approval before the PR.** For any UI or UX work (scenes, HUD, layout, art, colours, animation, text on screen): run `npm run shots`, look at every image yourself, then show them to the user with `SendUserFile` (display `render`, desktop and phone) and ask whether they like it. Iterate until they approve. Only then open the PR, commit the approved images under `docs/screenshots/<slug>/` plus one `overview.png` sheet of them (`node scripts/overview.mjs docs/screenshots/<slug>`), embed the overview in the PR description as a markdown image with a `/raw/<commit sha>/` URL, and say "approved in session" there. Read the description back after writing it: the GitHub tool can mangle image URLs (L-009). Never open a PR for a visible change without that approval. CI warns when visible files change and no screenshots are added (`scripts/pr-screenshots.mjs`).
- Do not start the next PR's work until the current one is merged or the user says to.
- After a PR is merged, restart the working branch from `main` (same branch name) before the next piece.
