# Development harness

The harness is the set of files and checks that keep the game honest and make the
project get better at itself over time.

## Parts

| Part | Role |
| --- | --- |
| `docs/GDD.md` | Anchor. Stable IDs, statuses, versioned changelog. |
| `docs/BACKLOG.md` | One row per GDD ID: `todo`, `doing`, `done` or `cut`. |
| `docs/LESSONS.md` | Append-only log of mistakes and the rules that came out of them. |
| `docs/decisions/` | Architecture decision records (ADRs). |
| `.claude/skills/*` | Repeatable procedures: `harness-feature`, `harness-gdd-update`, `harness-playtest`, `harness-retro` (all start with `harness-`, so typing `/harness` lists them). A skill's `SKILL.md` holds its steps; `harness-feature` keeps the rules a plan follows in `.claude/skills/harness-feature/rules/`, one file per kind of change, named in its step 5 (L-098). |
| `.claude/agents/pr-reviewer.md` | The subagent that reviews every pull request in depth. |
| `.claude/agents/implementer.md` | The subagent that builds a feature from the main session's plan. |
| `.claude/settings.json` | Project hooks, each a script in `scripts/hooks/` with a test beside it. After the GitHub tool creates a PR, `after-pr.mjs` tells Claude to run the reviewer and not to merge before it reports (L-043), and after a `git push`, `after-push.mjs` tells it to open a draft PR or have the new commits re-reviewed (L-043), with the PR description first rewritten to match the head (L-070). Before a shell command, `gate-pipe.mjs` denies one that commits (`git commit`, and `cherry-pick`, `merge`, `revert`, `am` or `rebase`) after a run of the gate (`node scripts/check.mjs` or `npm run check`) with anything but `&&` between them (L-012), and one that pushes after such a commit in the same command (L-078). Before a `git push` or a new PR, `stale-main.mjs` fetches `main` and asks the user first when the branch lacks some of it (L-052, L-030). Before a merge, `before-merge.mjs` asks the user, with the reason that a PR is merged only after its review (L-043). Before the `implementer` is launched, `before-implementer.mjs` denies the launch when its plan has no `## Worked cases` section with at least two lines carrying numbers, or no `## Existing fixtures` section with a line in it (L-077), or no `## Families` section with a line in it (L-080). |
| `scripts/check.mjs` | The gate. Zero dependencies. Run before every commit and in CI. |
| `.github/workflows/check.yml` | Runs the gate, the build and the playtests on every push and pull request, and warns when a visible change has no screenshots. |
| `.github/workflows/deploy.yml` | Deploys `main`'s newest commit to https://poncho.forkfall.xyz once its `check` run passes (GDD-TEC-08, `docs/deploy.md`). Not part of the gate. |
| `.github/pull_request_template.md` | The PR description every PR follows, including screenshots for visible changes. |

## What `scripts/check.mjs` enforces

1. GDD has a `Version:` line and the changelog mentions that version. A branch adds at most one changelog version since its merge base with `origin/main` (`gdd-one-version`, L-057). Without that merge base (no `origin/main`, or a shallow clone) the check passes, except under CI, where it fails, so CI's gate job fetches the full history. A stale local `origin/main` makes main's own versions count; `git fetch origin main` first. That version's changelog line names, before its first colon, every `### GDD-` section that differs from the merge base and no other, GDD-TEC-07 aside (a dependency review may name it without changing it), and a branch that changes a section adds a version; a section whose only change is the number of an Open Question it cites, renumbered when an answered one was removed, may be named or left out (`gdd-changelog-sections`, `scripts/gdd-version.mjs`, L-013). No `Open Question N` in the GDD (outside its changelog) or the backlog points past the end of the Open Questions list (`gdd-open-questions`): removing a question renumbers the ones after it.
2. Every `GDD-XXX-NN` heading is unique and has a valid `Status:` line.
3. Every GDD ID mentioned anywhere in the repo (docs, source, tests, skills) exists in the GDD, and every repository path that a skill, a subagent or `CLAUDE.md` names in backticks exists (`harness-paths`, `scripts/harness-paths.mjs`); a placeholder such as `docs/screenshots/<slug>/` is skipped. So does every such path in `docs/GDD.md` (its changelog aside, which is history) and `docs/BACKLOG.md`, where a file that is designed and not built yet is marked ` (planned)` right after its backticks, and a marked path that exists fails (L-013).
4. `docs/BACKLOG.md` has exactly one valid row for every non-deprecated GDD ID and no unknown IDs.
5. `docs/LESSONS.md` entries are well formed, each with an `Area` from the template's list (the index `--lessons` reads), IDs are unique, count up and are never deleted (only the IDs after `Retired IDs:` may be missing), any lesson with
   `Recurrence >= 2` has been promoted, and from `Recurrence` 3 its `Promoted:` names an automated guard that exists, or says why there is none (`Guard:`). Every lesson ID cited in the repository exists.
6. Every skill and every subagent in `.claude/agents/` has valid frontmatter (name matching its folder or file, a description, values with `: ` quoted). No file under `.claude/skills/` has more than 2,000 words (`skill-size`, L-098): a skill is read whole each time, and a context compaction keeps only its first 5,000 tokens. Agents list their tools and, if they set a model, set `inherit`, because repository files do not name models; `pr-reviewer` must set it, so it runs on the main session's model. `.claude/settings.json` is valid JSON and every hook script it points at exists and has a `.test.mjs` beside it; the test of a hook that reads shell commands holds a here-document (a commit message) it must let through (L-008), and such a hook that answers `ask` reads commands through `scripts/hooks/command-text.mjs` (L-053).
7. No AI model identifiers in repository files.
8. No mutation run was interrupted (`no-mutation`, L-020): `.mutating.json` from `scripts/mutate.mjs` must not exist, except for the test that the runner itself runs.
9. Phaser key-down events (`'down'`, `Events.DOWN`, `'keydown-X'`) in `src/` appear only in the one-line form that presses an input latch (`key-down-handlers`, L-006).
10. Every `waitForTimeout` or `setTimeout` in `e2e/` (a test's own time limit aside) says why real time is fine there in an `// L-042:` comment on its line; the waits written before the check are counted per file, and a count may only go down (`realtime-waits`, L-042).
11. Every `spotsIn` call in `e2e/` that reads spots under 2 px across (`size` under 2) says on its line, in an `// L-017:` comment, why it may (its spots are filtered clear of colour edges, or the line predates the check) (`small-spots`, L-017): on the phone a game px is not a whole number of screen pixels.
12. No playtest in `e2e/` compares the whole saved game or the whole saved settings with `toEqual` (`whole-save-pins`, L-054); a test of the save format itself marks its line `// L-054: format`.
13. No screenshot scenario in `e2e/shots/` that only the phone takes (`test.skip(!isMobile, ...)`) presses keys: it is driven by touch, as a phone player plays (`phone-shots-by-touch`, L-045).
14. Every character sprite sheet (each folder of `assets/sprites/` but the scenery sets', and each PNG at its top) is named by its path (`sprites/<folder>/`, with the slash, or `sprites/<file>`) in a test that cites L-059: one that pins how far its frames reach past their box and fits them over the real levels (`sprite-fit`, `scripts/sprite-fit.mjs`, L-059). A sheet with no such test yet is listed in that module's `EXEMPT` with its reason.
15. No `.ts` file under `src/sim/`, `src/levels/` or `src/config/` (tests aside, test support included) uses what is not the same in every engine or run: any use of `Math` but its exact members (`sqrt`, `abs`, `floor`, `ceil`, `round`, `trunc`, `sign`, `min`, `max`, `fround`, `imul`, `clz32` and the constants), so also a destructured, aliased or bracketed `Math`; `Date`, `Temporal`, `performance` or `crypto`; or the `**` operator. The files are read with a real parser (Vite's `parseSync`), so comments, strings and regular expressions are not taken for code, and a file that does not parse fails (`sim-determinism`, GDD-TEC-09; `scripts/sim-determinism.mjs`). `src/sim/detmath.ts` has the sine, cosine and hypot to use; a line that never reaches a step says why in a `// sim-determinism: <reason>` comment.
16. If `package.json` defines `lint`, `typecheck`, `test`, `test:abilities`, `test:glide` or `test:sight` scripts, they run and must pass. `test:sight` flies the sight sweep over every World 3 level that is not a test or boss level (`src/levels/sightSweep.ts`, `src/levels/sight.test.ts`, GDD-WLD-03, L-014): from every place Poncho can stand it flies the flights a player would try and fails on a life lost to something that was off screen at the take-off, unless `SIGHT_ACCEPTED` names that family with the GDD sentence that accepts it; it takes about 9 minutes for 3-1 to 3-3. `test:glide` reruns the level tests of Worlds 0 to 2 with the glide on, as a player has them after clearing 2-4 (GDD-PRG-01, `src/levels/glide-unlocked.setup.ts`): a test that must keep the plain jump is listed there with its reason, and each such play-through has a glided twin in the normal run. `test:abilities` reruns the simulation tests with every progression ability on (`src/sim/all-abilities.setup.ts`, L-024); a test that must keep an ability off is listed there with its reason, and a new ability fails the typecheck until it is switched on there. Run `npm install` first; the gate fails without `node_modules`. These scripts are not run while any check above them has failed: they take about half an hour, and nothing can be committed until that check is fixed (L-099).

`node scripts/check.mjs --gdd-hunt [GDD-XXX-NN,...] [term,...]` is no check and never fails: it prints the stale-sentence hunt's reading list (`scripts/gdd-hunt.mjs`, L-013, L-053), from the GDD (its changelog aside), the backlog, `CLAUDE.md`, this file and `.claude/`. It hunts the sections the branch changed since its merge base with `origin/main` and the IDs given (a feature that edits no section gives its own). Outside those sections it lists each sentence that names one of them or holds a term (a whole word, case ignored), and the sentences with a status word ("yet", "only", "not built") on the same line; inside them the sentences with a status word or a term. A term written `in:left` is searched inside them only. Sentences with a status word come first. Without a merge base it says the changed sections are not known.

`node scripts/check.mjs --lesson L-NNN[,L-NNN...]` prints those lessons' entries, each with its last three occurrences only (`scripts/lessons.mjs`), for reading before work; `docs/LESSONS.md` keeps every occurrence.

## The improvement loop

```
task --> mistake or friction --> LESSON (harness-retro skill)
                                   |
                       Recurrence >= 2 ?  --yes--> PROMOTE
                                   |                 |-- automated check in scripts/check.mjs (preferred)
                                   no                |-- step in a skill
                                   |                 `-- rule in CLAUDE.md
                                 keep logged
```

Promotion order of preference: an automated guard (a gate check in `scripts/check.mjs`, a test, a script, or a hook in `scripts/hooks/` when the mistake is a tool call such as a command or a merge rather than a file), then skill step, then prose rule in `CLAUDE.md`.
A recurrence is counted when a mistake is found after the push, or before it by anything other than the step meant to catch it; one that step caught before the commit is the guard working and is not counted (user, 2026-11-22; `docs/LESSONS.md`, Promotion rule).
When a lesson is promoted, set its `Promoted:` field to where the rule now lives. A lesson that recurs after a promotion to prose moves up to an automated guard (`harness-retro` step 3).

## Adding a check

Add a function to `scripts/check.mjs` that returns a list of error strings, register it in
the `checks` array, and make sure it fails on a bad input. Name the lesson that
motivated the check in a comment beside it. A check whose logic goes beyond one pattern match keeps that logic in a module with
unit tests beside it, as `scripts/gdd-version.mjs` does: one mutant per condition and per argument inside that module
(`scripts/mutate.mjs`), each caught by those tests (L-010). The lines in `scripts/check.mjs` that call the module are proved
by the gate run on a bad input.

A hook is added the same way: a script in `scripts/hooks/` that exports its decision as a pure function, a `.test.mjs`
beside it (run by `npm test` in the gate) holding every spelling the hook must catch and the mentions it must let through, a commit message's here-document and a quoted string among them
(L-008), and an entry in `.claude/settings.json`. A hook never fails: on any problem it prints nothing and exits 0. A hook whose answer is `ask` leans to asking: through `scripts/hooks/command-text.mjs` it joins line continuations and removes here-document bodies no shell reads, but reads quoted text as written, since emptying quotes let quotes inside quotes hide real calls, and an extra question costs a click where a missed one costs the guard (L-008).

## Planning and building on different models

Planning a feature takes judgement (the user's decisions, conflicts across the GDD, which older rules share a button); building it from a good plan mostly does not. So `harness-feature` splits the work:

1. The main session reads the GDD, asks the user's design questions and writes a self-contained plan in `.plans/<GDD-ID>.md` (gitignored): files, tuning numbers, every test with expected values from the GDD, and the mutant list.
2. The `implementer` subagent writes the tests and the code from the plan, runs the gate and the mutants, and reports. It never commits, edits the GDD or decides design; it stops and asks instead.
3. The main session reads the diff, re-runs the gate and any unaccounted mutant, then does screenshots, docs, the retro and the commit as before. The `pr-reviewer` still reviews the PR.

Repository files do not name models (gate check 7), so the agent file sets no model. Step 6 of `harness-feature` launches it with the Agent tool's `model` parameter set to the tier one below the main session's model, but never the smallest tier (the main session's own tier when that is the middle one); that parameter overrides the agent file, and needs no environment setting, so it works from any device. The `pr-reviewer` sets `model: inherit` (the gate requires it) and is launched without a `model`, so it always runs on the main session's model.

## Pull request review

Every PR is reviewed by the `pr-reviewer` subagent (`.claude/agents/pr-reviewer.md`). It is a read-only agent with its own context. It goes well beyond reading the diff:

- checks the PR out in a temporary worktree, runs the gate and, for visible changes, the browser tests, and probes new logic with edge cases;
- audits the GDD changes for validity: IDs never deleted, statuses honest, version and changelog bumped, no internal contradictions, GDD and `tuning.ts` in agreement, backlog truthful;
- looks at the screenshots and checks the user approved them;
- posts one GitHub review with 🔴 blocking, 🟡 optional and 🟣 pre-existing findings, never approving or merging.

Read-only is a rule the agent follows, not a sandbox: its tool list cannot restrict `Bash`. For each new rule the reviewer also mutates the code in its worktree and confirms a test fails.

It runs in three places, and a fourth time without a pull request: before a GDD change is committed, `harness-gdd-update` step 6 launches it with the words "local GDD audit", and it reads the branch's GDD and backlog diff and the hunt's list (`node scripts/check.mjs --gdd-hunt`) in the main checkout, runs and posts nothing, and returns its findings (L-013).

1. **In a session, when Claude opens a PR.** A project hook (`.claude/settings.json` runs `scripts/hooks/after-pr.mjs` after
   the GitHub tool's `create_pull_request`) tells Claude the review has not run yet. Claude launches the subagent, fixes
   blocking findings, then subscribes to the PR.
2. **In a session, when the user opens a PR.** Tell Claude the PR is up and it launches the subagent on it.
3. **After each later push to a PR.** `scripts/hooks/after-push.mjs` reminds Claude that the review covers only the head it saw,
   so the subagent re-reviews the new commits before the PR is reported ready or merged (L-043), and that the PR description's
   Scope, checks, Screenshots and Notes are rewritten to match the head before that re-review (L-070).

There is no automatic review in CI. It used to run on every PR through `.github/workflows/claude-review.yml` and an `ANTHROPIC_API_KEY` secret; the user removed it, together with the 300-line size guideline (`scripts/pr-size.mjs`), because PRs were over it almost every time.

## Visual review

Anything the player can see needs the user's eyes before it merges.

1. `npm run shots` produces desktop and phone screenshots from `e2e/shots/`.
2. Claude looks at them, shows them to the user in the session with `SendUserFile`, and asks for approval. New or redrawn sprite sheets first go beside the approved sheets they must match and the user's references (`node scripts/art-lineup.mjs`, L-066), and that lineup is sent with the shots.
3. After approval, the images go under `docs/screenshots/<slug>/` with an `overview.png` sheet of them (`node scripts/overview.mjs`, L-031), and only that overview is embedded in the PR description (L-009).
4. CI warns when visible files change and no screenshot was added (`scripts/pr-screenshots.mjs`), and the `pr-reviewer` subagent treats missing screenshots or missing approval as blocking, except on a draft that says its screenshots await approval.

## Dependencies

The stack tracks the latest stable releases (GDD-TEC-07). At every GDD minor version run `npm outdated`, upgrade, run
`node scripts/check.mjs` and `npm run test:e2e`, and record what moved. Before choosing or pinning any version, look it up in
the registry; do not rely on memory (see L-005).

## Playtesting

The `harness-playtest` skill (`npm run test:e2e`) drives the real game in headless Chromium on a desktop and a
landscape phone viewport and asserts on game state. It is not part of the gate because it needs a browser;
CI runs it as a separate job. That job installs the browser and, in a step of its own, the browser's system packages, which are tried twice and end in a warning when the runner's mirrors cannot be reached: the playtests run either way (L-076). When CI's playtests cannot run for a cause outside the pull request, run the whole suite locally on its head and say so in its description.
