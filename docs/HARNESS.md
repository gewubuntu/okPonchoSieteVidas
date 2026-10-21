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
| `.claude/settings.json` | Project hooks. After a PR is created, a hook tells Claude to run the reviewer. |
| `scripts/check.mjs` | The gate. Zero dependencies. Run before every commit and in CI. |
| `.github/workflows/check.yml` | Runs the gate, the build and the playtests on every push and pull request, and warns when a visible change has no screenshots. |
| `.github/pull_request_template.md` | The PR description every PR follows, including screenshots for visible changes. |

## What `scripts/check.mjs` enforces

1. GDD has a `Version:` line and the changelog mentions that version.
2. Every `GDD-XXX-NN` heading is unique and has a valid `Status:` line.
3. Every GDD ID mentioned anywhere in the repo (docs, source, tests, skills) exists in the GDD.
4. `docs/BACKLOG.md` has exactly one valid row for every non-deprecated GDD ID and no unknown IDs.
5. `docs/LESSONS.md` entries are well formed, IDs are unique, and any lesson with
   `Recurrence >= 2` has been promoted.
6. Every skill and every subagent in `.claude/agents/` has valid frontmatter (name matching its folder or file, a description, values with `: ` quoted). Agents list their tools and, if they set a model, set `inherit`, because repository files do not name models. `.claude/settings.json` is valid JSON and every hook script it points at exists.
7. No AI model identifiers in repository files.
8. If `package.json` defines `lint`, `typecheck` or `test` scripts, they run and must pass. Run `npm install` first; the gate fails without `node_modules`.

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

Promotion order of preference: automated check, then skill step, then prose rule in `CLAUDE.md`.
When a lesson is promoted, set its `Promoted:` field to where the rule now lives.

## Adding a check

Add a function to `scripts/check.mjs` that returns a list of error strings, register it in
the `checks` array, and make sure it fails on a bad input. The harness-retro skill should name the
lesson that motivated the check in a comment.

## Pull request review

Every PR is reviewed by the `pr-reviewer` subagent (`.claude/agents/pr-reviewer.md`). It is a read-only agent with its own context. It goes well beyond reading the diff:

- checks the PR out in a temporary worktree, runs the gate and, for visible changes, the browser tests, and probes new logic with edge cases;
- audits the GDD changes for validity: IDs never deleted, statuses honest, version and changelog bumped, no internal contradictions, GDD and `tuning.ts` in agreement, backlog truthful;
- looks at the screenshots and checks the user approved them;
- posts one GitHub review with 🔴 blocking, 🟡 optional and 🟣 pre-existing findings, never approving or merging.

Read-only is a rule the agent follows, not a sandbox: its tool list cannot restrict `Bash`. For each new rule the reviewer also mutates the code in its worktree and confirms a test fails.

It runs in two places:

1. **In a session, when Claude opens a PR.** A project hook (`.claude/settings.json` runs `scripts/hooks/after-pr.mjs` after
   `mcp__github__create_pull_request`) tells Claude the review has not run yet. Claude launches the subagent, fixes
   blocking findings, then subscribes to the PR.
2. **In a session, when the user opens a PR.** Tell Claude the PR is up and it launches the subagent on it.

Findings carry a severity: 🔴 blocking, 🟡 optional, 🟣 pre-existing.

There is no automatic review in CI. It used to run on every PR through `.github/workflows/claude-review.yml` and an `ANTHROPIC_API_KEY` secret; the user removed it, together with the 300-line size guideline (`scripts/pr-size.mjs`), because PRs were over it almost every time.

## Visual review

Anything the player can see needs the user's eyes before it merges.

1. `npm run shots` produces desktop and phone screenshots from `e2e/shots/`.
2. Claude looks at them, shows them to the user in the session with `SendUserFile`, and asks for approval.
3. After approval, the images go under `docs/screenshots/<slug>/` and are embedded in the PR description.
4. CI warns when visible files change and no screenshot was added (`scripts/pr-screenshots.mjs`), and the `pr-reviewer` subagent treats missing screenshots or missing approval as blocking.

## Dependencies

The stack tracks the latest stable releases (GDD-TEC-07). At every GDD minor version run `npm outdated`, upgrade, run
`node scripts/check.mjs` and `npm run test:e2e`, and record what moved. Before choosing or pinning any version, look it up in
the registry; do not rely on memory (see L-005).

## Playtesting

The `harness-playtest` skill (`npm run test:e2e`) drives the real game in headless Chromium on a desktop and a
landscape phone viewport and asserts on game state. It is not part of the gate because it needs a browser;
CI runs it as a separate job.
