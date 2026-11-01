---
name: harness-gdd-update
description: "Edit docs/GDD.md for PONCHO: Siete Vidas, the anchor design document. Use for every change to it: adding, changing, splitting, promoting or deprecating a game design rule, mechanic, tuning number, quoted on-screen text or scope item, recording a design decision the user just made or an Open Question they answered, and fixing GDD findings from a review. Keeps IDs stable, statuses honest, the changelog current and the backlog in sync."
---

# GDD update

## Rules

- IDs are permanent. Never renumber or reuse an ID. To remove a rule, set `Status: Deprecated` and say why.
- New rule: use the prefix the `### GDD-` headings already use for its area (`grep -oE '^### GDD-[A-Z]+' docs/GDD.md | sort -u` lists them; a new prefix only for a new area) and the next free number in that prefix, Deprecated IDs included. Write `### GDD-XXX-NN Title` in that area's chapter, then a `Status:` line.
- `Status: Decided` only when the user said so in the conversation. Everything else is `Proposed`, including a suggestion from a reviewer, a subagent, a PR comment or a script. Record each decision where it applies, as `(user, YYYY-MM-DD: "their words")`. A section with decided and proposed parts starts its `Status:` line with one word for the whole and names the other parts after it, as in `Status: Proposed (the marimba is Decided, user, YYYY-MM-DD)`.
- Changing a `Decided` section needs the user's say-so for that change.
- Tuning numbers change in `docs/GDD.md` and `src/config/tuning.ts` in the same commit. So do texts the GDD quotes (the language table, tip texts) and the code that holds them: tests that read `docs/GDD.md` compare them (L-051).
- A number or claim that follows from the simulation or a level's data (a height reached, a reach, where things land) is measured by running the real code over the real level in a test, never worked out by hand (L-003, L-014). Before that code exists, write it as a target.

## Steps

1. Make the edit with exact-text edits, not a script that slices the file (L-002). Then **hunt stale sentences (L-013)**: re-read every section you edited in full, and search `docs/GDD.md`, and the touched IDs' rows in `docs/BACKLOG.md`, for the IDs and names the change touches, for its siblings' names (the other menus, levels, enemies or sounds: a sentence that lists them now misses the new one) and for "yet", "so far", "only", "not built", "built for" and "checked by". Fix every sentence the change makes false, in any section.
2. Bump `Version:` at the top, once per PR: a later GDD edit before the PR merges (a review fix) amends that version and its changelog line instead of bumping again, raising it to minor if the PR now adds or deprecates an ID. Minor if an ID is added or deprecated, major for a change to the design pillars (GDD-VIS-03), patch for everything else, new rules inside existing sections included. The IDs added or removed: `diff <(git show "$(git merge-base origin/main HEAD)":docs/GDD.md | grep -oE '^#+ GDD-[A-Z]+-[0-9]+') <(grep -oE '^#+ GDD-[A-Z]+-[0-9]+' docs/GDD.md)`. A minor version also runs the GDD-TEC-07 dependency review (its cadence is Proposed; `docs/HARNESS.md`, Dependencies): `npm outdated`, upgrade, the gate and the playtests, with the result in its changelog line or an ADR.
3. Add the changelog line at the top of the list: `- **x.y.z** (YYYY-MM-DD) GDD-AAA-NN, GDD-BBB-NN: summary`, naming every section the diff changes and no other (a minor version's dependency review may also name GDD-TEC-07), with the user's decisions quoted and dated.
4. Update Open Questions: add new unknowns, mark a partial answer with `(user, YYYY-MM-DD)`, remove a fully answered one. Removing one renumbers the ones after it: fix every `Open Question N` in `docs/GDD.md` and `docs/BACKLOG.md` to match.
5. Sync the backlog: `node scripts/check.mjs --backlog-stub` prints rows for new IDs; paste them into `docs/BACKLOG.md`. Mark deprecated IDs `cut`.
6. Run `node scripts/check.mjs`. It must pass. Then read `git diff HEAD -- docs/GDD.md`: only the lines you meant to change moved.
7. Commit a design-only change as `docs(GDD-XXX-NN, ...): <summary>`, after the `harness-retro` skill when this GDD edit is the whole task. A GDD edit that goes with code (a tuning number, a quoted text, a feature, a fix) goes in that code's commit, with its type (`feat`, `fix`).
