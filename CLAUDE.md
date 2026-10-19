# PONCHO: Siete Vidas

A 2D platformer. The hero is **Poncho**, a cat in a Mexican poncho (serape). The game
is built on **Phaser 3 + TypeScript + Vite + Vitest**, targeting **web and mobile browsers**.

## The anchor rule

`docs/GDD.md` is the single source of truth. Every feature, test, backlog row and
commit refers to a stable GDD ID such as `GDD-MOV-02`.

- No GDD ID, no feature. If an idea has no ID, use the `gdd-update` skill first.
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
4. **Implement** the smallest change that satisfies the GDD text.
5. **Check**: run `node scripts/check.mjs`. It must pass before every commit.
6. **Retro**: run the `retro` skill. Append lessons, promote recurring ones.
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
| `node scripts/check.mjs` | Run all harness checks (GDD integrity, backlog, lessons, skills). Also runs `lint`, `typecheck` and `test` npm scripts once they exist. |
| `node scripts/check.mjs --backlog-stub` | Print backlog rows for GDD IDs missing from `docs/BACKLOG.md`. |

## Repository map

- `docs/GDD.md` game design document (anchor)
- `docs/BACKLOG.md` GDD ID to status
- `docs/LESSONS.md` append-only lessons log
- `docs/HARNESS.md` how the harness works
- `docs/decisions/` architecture decision records
- `.claude/skills/` project skills: `feature`, `gdd-update`, `playtest`, `retro`
- `scripts/check.mjs` the gate
- `assets/` art and audio (character reference image goes in `assets/characters/poncho/`)

## Conventions

- Cite GDD IDs in code comments only where a number or rule comes from the GDD.
- Keep simulation logic (movement, lives, damage) free of Phaser imports so it is unit-testable.
- Do not add game code that no GDD ID asks for.
- Do not name AI models in repository files or in commit subjects and bodies. Attribution trailers (such as `Co-Authored-By`) follow the session's own instructions.
- Commit on the branch the session designates. Do not open a PR unless the user asks.
