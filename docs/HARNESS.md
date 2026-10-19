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
| `.claude/skills/*` | Repeatable procedures: `feature`, `gdd-update`, `playtest`, `retro`. |
| `scripts/check.mjs` | The gate. Zero dependencies. Run before every commit and in CI. |
| `.github/workflows/check.yml` | Runs the gate on every push and pull request. |

## What `scripts/check.mjs` enforces

1. GDD has a `Version:` line and the changelog mentions that version.
2. Every `GDD-XXX-NN` heading is unique and has a valid `Status:` line.
3. Every GDD ID mentioned anywhere in the repo (docs, source, tests, skills) exists in the GDD.
4. `docs/BACKLOG.md` has exactly one valid row for every non-deprecated GDD ID and no unknown IDs.
5. `docs/LESSONS.md` entries are well formed, IDs are unique, and any lesson with
   `Recurrence >= 2` has been promoted.
6. Every skill has `name` (matching its folder) and `description` in its frontmatter.
7. No AI model identifiers in repository files.
8. If `package.json` defines `lint`, `typecheck` or `test` scripts, they run and must pass. Run `npm install` first; the gate fails without `node_modules`.

## The improvement loop

```
task --> mistake or friction --> LESSON (retro skill)
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
the `checks` array, and make sure it fails on a bad input. The retro skill should name the
lesson that motivated the check in a comment.

## Playtesting

The `playtest` skill (`npm run test:e2e`) drives the real game in headless Chromium on a desktop and a
landscape phone viewport and asserts on game state. It is not part of the gate because it needs a browser;
CI runs it as a separate job.
