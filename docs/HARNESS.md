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
| `.claude/skills/*` | Repeatable procedures: `harness-feature`, `harness-gdd-update`, `harness-playtest`, `harness-retro` (all start with `harness-`, so typing `/harness` lists them). |
| `.claude/agents/pr-reviewer.md` | The subagent that reviews every pull request in depth. |
| `.claude/agents/implementer.md` | The subagent that builds a feature from the main session's plan. |
| `.claude/settings.json` | Project hooks, each a script in `scripts/hooks/` with a test beside it. After the GitHub tool creates a PR, `after-pr.mjs` tells Claude to run the reviewer and not to merge before it reports (L-043), and after a `git push`, `after-push.mjs` tells it to open a draft PR or have the new commits re-reviewed (L-043). Before a shell command, `gate-pipe.mjs` denies one that commits after a run of the gate (`node scripts/check.mjs` or `npm run check`) with anything but `&&` between them (L-012). Before a `git push` or a new PR, `stale-main.mjs` fetches `main` and asks the user first when the branch lacks some of it (L-052, L-030). Before a merge, `before-merge.mjs` asks the user, with the reason that a PR is merged only after its review (L-043). |
| `scripts/check.mjs` | The gate. Zero dependencies. Run before every commit and in CI. |
| `.github/workflows/check.yml` | Runs the gate, the build and the playtests on every push and pull request, and warns when a visible change has no screenshots. |
| `.github/pull_request_template.md` | The PR description every PR follows, including screenshots for visible changes. |

## What `scripts/check.mjs` enforces

1. GDD has a `Version:` line and the changelog mentions that version. No `Open Question N` in the GDD (outside its changelog) or the backlog points past the end of the Open Questions list (`gdd-open-questions`): removing a question renumbers the ones after it.
2. Every `GDD-XXX-NN` heading is unique and has a valid `Status:` line.
3. Every GDD ID mentioned anywhere in the repo (docs, source, tests, skills) exists in the GDD, and every repository path that a skill, a subagent or `CLAUDE.md` names in backticks exists (`harness-paths`); a placeholder such as `docs/screenshots/<slug>/` is skipped.
4. `docs/BACKLOG.md` has exactly one valid row for every non-deprecated GDD ID and no unknown IDs.
5. `docs/LESSONS.md` entries are well formed, each with an `Area` from the template's list (the index `--lessons` reads), IDs are unique, count up and are never deleted (only the IDs after `Retired IDs:` may be missing), any lesson with
   `Recurrence >= 2` has been promoted, and from `Recurrence` 3 its `Promoted:` names an automated guard that exists, or says why there is none (`Guard:`). Every lesson ID cited in the repository exists.
6. Every skill and every subagent in `.claude/agents/` has valid frontmatter (name matching its folder or file, a description, values with `: ` quoted). Agents list their tools and, if they set a model, set `inherit`, because repository files do not name models; `pr-reviewer` must set it, so it runs on the main session's model. `.claude/settings.json` is valid JSON and every hook script it points at exists and has a `.test.mjs` beside it.
7. No AI model identifiers in repository files.
8. No mutation run was interrupted (`no-mutation`, L-020): `.mutating.json` from `scripts/mutate.mjs` must not exist, except for the test that the runner itself runs.
9. Phaser key-down events (`'down'`, `Events.DOWN`, `'keydown-X'`) in `src/` appear only in the one-line form that presses an input latch (`key-down-handlers`, L-006).
10. Every `waitForTimeout` or `setTimeout` in `e2e/` (a test's own time limit aside) says why real time is fine there in an `// L-042:` comment on its line; the waits written before the check are counted per file, and a count may only go down (`realtime-waits`, L-042).
11. If `package.json` defines `lint`, `typecheck`, `test` or `test:abilities` scripts, they run and must pass. `test:abilities` reruns the simulation tests with every progression ability on (`src/sim/all-abilities.setup.ts`, L-024); a test that must keep an ability off is listed there with its reason, and a new ability fails the typecheck until it is switched on there. Run `npm install` first; the gate fails without `node_modules`.

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
When a lesson is promoted, set its `Promoted:` field to where the rule now lives. A lesson that recurs after a promotion to prose moves up to an automated guard (`harness-retro` step 3).

## Adding a check

Add a function to `scripts/check.mjs` that returns a list of error strings, register it in
the `checks` array, and make sure it fails on a bad input. Name the lesson that
motivated the check in a comment beside it.

A hook is added the same way: a script in `scripts/hooks/` that exports its decision as a pure function, a `.test.mjs`
beside it (run by `npm test` in the gate) holding every spelling the hook must catch and a mention it must let through
(L-008), and an entry in `.claude/settings.json`. A hook never fails: on any problem it prints nothing and exits 0.

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

It runs in three places:

1. **In a session, when Claude opens a PR.** A project hook (`.claude/settings.json` runs `scripts/hooks/after-pr.mjs` after
   the GitHub tool's `create_pull_request`) tells Claude the review has not run yet. Claude launches the subagent, fixes
   blocking findings, then subscribes to the PR.
2. **In a session, when the user opens a PR.** Tell Claude the PR is up and it launches the subagent on it.
3. **After each later push to a PR.** `scripts/hooks/after-push.mjs` reminds Claude that the review covers only the head it saw,
   so the subagent re-reviews the new commits before the PR is reported ready or merged (L-043).

There is no automatic review in CI. It used to run on every PR through `.github/workflows/claude-review.yml` and an `ANTHROPIC_API_KEY` secret; the user removed it, together with the 300-line size guideline (`scripts/pr-size.mjs`), because PRs were over it almost every time.

## Visual review

Anything the player can see needs the user's eyes before it merges.

1. `npm run shots` produces desktop and phone screenshots from `e2e/shots/`.
2. Claude looks at them, shows them to the user in the session with `SendUserFile`, and asks for approval.
3. After approval, the images go under `docs/screenshots/<slug>/` with an `overview.png` sheet of them (`node scripts/overview.mjs`, L-031), and only that overview is embedded in the PR description (L-009).
4. CI warns when visible files change and no screenshot was added (`scripts/pr-screenshots.mjs`), and the `pr-reviewer` subagent treats missing screenshots or missing approval as blocking.

## Dependencies

The stack tracks the latest stable releases (GDD-TEC-07). At every GDD minor version run `npm outdated`, upgrade, run
`node scripts/check.mjs` and `npm run test:e2e`, and record what moved. Before choosing or pinning any version, look it up in
the registry; do not rely on memory (see L-005).

## Playtesting

The `harness-playtest` skill (`npm run test:e2e`) drives the real game in headless Chromium on a desktop and a
landscape phone viewport and asserts on game state. It is not part of the gate because it needs a browser;
CI runs it as a separate job.
