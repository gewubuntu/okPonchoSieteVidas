---
name: harness-retro
description: "Run after finishing any task or fixing any mistake in PONCHO: Siete Vidas, including fixes for pr-reviewer findings and anything the user corrected. Reviews the diff and the session for errors and friction, appends or bumps lessons in docs/LESSONS.md, promotes recurring lessons into automated checks, skills or CLAUDE.md, and escalates a lesson that recurs after promotion. Use at the end of every task, before the final commit."
---

# Retro

Goal: make the next task cheaper and safer than this one.

## Steps

1. Review what happened: `git diff` against the task start, failed commands, rework, anything the user corrected, every blocking finding of the `pr-reviewer`, and every deviation or surviving mutant in the `implementer`'s report.
2. For each real mistake or avoidable friction, decide:
   - Is it already in `docs/LESSONS.md`? List the area's titles and rules (`node scripts/check.mjs --lessons <area>`), search for the area's words, and read the matches in full. If yes, increase its `Recurrence` by 1 and add the occurrence line that the file's promotion rule describes, in one or two sentences: what happened, and why the rule already in place did not stop it.
   - If not, append a new entry using the template in that file, with the next free ID. Root cause must be a
     process or knowledge gap, never "careless".
   - Never delete, renumber or reuse an entry. A new entry that turns out to repeat an older lesson stays: bump the older one and set the new one's `Promoted:` to `merged into L-NNN`.
3. For every lesson whose `Recurrence` reached 2 or more in this retro, promote it now:
   1. Preferred: an automated guard. A check in `scripts/check.mjs` (name the lesson in a comment and prove it fails on a bad input), a unit test or playtest, a hook in `scripts/hooks/` wired in `.claude/settings.json` when the mistake is a tool call (a command, a merge) rather than a file (`docs/HARNESS.md`, Adding a check), or a script that does the step.
   2. Otherwise add a step to the relevant skill in `.claude/skills/`.
   3. Otherwise add a short rule to `CLAUDE.md`.
   Then set `Promoted:` to where the rule now lives, and cite the lesson ID where the rule is written. A promotion changes the harness, never a game rule: that goes to step 4. After a promotion or any other change to a harness rule, search `CLAUDE.md`, `docs/HARNESS.md`, `.claude/`, the PR template, the hook messages and the lesson rules (`node scripts/check.mjs --lessons`) for the old rule's words and fix every sentence it now falsifies, in the same commit (L-053).
   **Escalate.** A lesson that recurs after it was promoted to a skill step or a `CLAUDE.md` rule shows the prose did not hold: move it up to an automated guard instead of rewording the prose. From `Recurrence` 3 its `Promoted:` names that guard, or says why none can work, in the `Guard:` form of the file's promotion rule; the gate checks it. Name every lesson that recurred with `Guard: none` to the user in the report.
4. Check the GDD: did the task reveal an unclear or missing rule? If yes, use the `harness-gdd-update` skill to change the rule or to add it to the GDD Open Questions.
5. Run `node scripts/check.mjs`. It must pass. When you commit here, chain the commit on it (`node scripts/check.mjs && git commit ...`), never behind a pipe (L-012).
6. Commit the lesson and harness changes in the task's own commit (for a feature, `harness-feature` step 12 makes it), or, when there is none, in their own commit `chore(harness): <what> (L-NNN)`.

## Output

Report in two or three lines: lessons added or bumped, anything promoted or escalated, anything left for the user.
If nothing went wrong, say so and add nothing. Do not invent lessons.
