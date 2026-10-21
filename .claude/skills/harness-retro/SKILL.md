---
name: harness-retro
description: "Run after finishing any task or fixing any mistake in PONCHO: Siete Vidas. Reviews the diff and the session for errors and friction, appends lessons to docs/LESSONS.md, promotes recurring lessons into automated checks, skills or CLAUDE.md. Use at the end of every task, before the final commit."
---

# Retro

Goal: make the next task cheaper and safer than this one.

## Steps

1. Review what happened: `git diff` against the task start, failed commands, rework, anything the user corrected.
2. For each real mistake or avoidable friction, decide:
   - Is it already in `docs/LESSONS.md`? If yes, increase its `Recurrence` by 1.
   - If not, append a new entry using the template in that file. Root cause must be a
     process or knowledge gap, never "careless".
3. For every lesson with `Recurrence >= 2`, promote it now:
   1. Preferred: add an automated check to `scripts/check.mjs` and prove it fails on a bad input.
   2. Otherwise add a step to the relevant skill in `.claude/skills/`.
   3. Otherwise add a short rule to `CLAUDE.md`.
   Then set `Promoted:` to where the rule now lives.
4. Check the GDD: did the task reveal an unclear or missing rule? If yes, use the `harness-gdd-update` skill or add it to the GDD Open Questions.
5. Run `node scripts/check.mjs`. It must pass.
6. Commit the lesson and harness changes together with the task, or in their own commit with message `chore(harness): <what>`.

## Output

Report in two or three lines: lessons added or bumped, anything promoted, anything left for the user.
If nothing went wrong, say so and add nothing. Do not invent lessons.
