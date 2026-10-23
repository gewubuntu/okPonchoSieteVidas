---
name: harness-feature
description: "Implement one GDD ID end to end for PONCHO: Siete Vidas. Use when asked to build, implement or work on a game feature, mechanic, enemy, level or system. Takes a GDD ID such as GDD-MOV-02."
---

# Feature

Implements exactly one GDD ID (or a small named group of them) from spec to tested code.

## Steps

1. **Resolve the ID.** Find the `### GDD-XXX-NN` section in `docs/GDD.md`. If it does not exist, stop and use `harness-gdd-update`.
2. **Check status.** If `Status: Proposed`, tell the user you are implementing a proposal and continue only if they asked for this feature. If `Deprecated`, stop.
3. **Check blockers.** Read the GDD's Open Questions and the section's dependencies. Anything that needs the character reference image (`GDD-ART-02`) or another unmade user decision: stop and ask, or build with a clearly marked placeholder.
4. **Mark `doing`** in `docs/BACKLOG.md`.
5. **Write tests first** for the pure logic (Vitest, no Phaser imports). Test names include the GDD ID, e.g. `describe('GDD-MOV-02 jump', ...)`. Numbers come from `src/config/tuning.ts`, which mirrors the GDD.
   **Input rules (L-019):** when a rule reads buttons (presses, releases, holds), list every source that produces each one (keyboard keys, touch buttons, the slide stick, raw-event latches) and the pairs that combine (left and right into `move`), and test each source and each pair. Read single buttons raw, never from a combined value. **Shared buttons (L-024):** list every existing rule that already reads the same button (jump buffer, coyote time, variable jump, stomp boost, and the "already held" marks left by the respawn and by the pause resume, GDD-UI-02) and test each one with the new rule on. A new rule on a held button counts the hold from a press the simulation saw, never from any held input.
6. **Implement** the minimum that satisfies the GDD text. No extras the GDD does not list.
   **Prove each new test can fail:** for every new rule or bullet in the GDD diff, break the code (remove the rule, move a threshold by one), see a test go red, then restore it (L-010). Write expected values from the GDD into the test, not read back from the code under test. Go sentence by sentence, not bullet by bullet: split each new GDD bullet into its clauses ("A or B wins over C" is two rules; a warning or a pose drawn on screen is a rule too) and give each clause its own mutation. Run them with `node scripts/mutate.mjs <mutants.json>` (L-020), never by hand with `sed` or an ad hoc script: it restores each file and leaves a marker that fails the gate if the run is killed. Run it in the foreground, splitting a long list so each run fits the time limit. **A surviving guard (L-025):** when a mutant that removes a guard survives, check whether another rule already covers that case; if so, delete the guard and name the covering rule in a comment. List the mutations in the PR description.
7. **Playtest** with the `harness-playtest` skill when the feature is visible or interactive.
   **If anything visible changed**, follow the screenshot approval rule in `CLAUDE.md` now: `npm run shots`, look at the images, show them to the user with `SendUserFile`, and wait for their approval before opening the PR.
8. **Update docs.** Mark the backlog row `done`. If implementation forced a rule change, update the GDD with `harness-gdd-update`.
   **Hunt the stale sentences (L-013).** Search `docs/GDD.md` for the feature's neighbours (the IDs and names it touches) and for "yet", "so far", "only", "not built" and "built for", and fix every sentence the feature now falsifies. Each section named in the changelog line must be in the diff. A claim about where things are in the sandbox level (reach, clearance, spotting) needs a test over the real level data (L-014).
9. **Gate.** Run `node scripts/check.mjs` and fix everything before committing. Chain the commit on its exit code (`node scripts/check.mjs && git commit ...`), never behind a pipe to `tail` or after `;` (L-012).
10. **Retro.** Run the `harness-retro` skill.
11. **Commit** as `feat(GDD-XXX-NN): <summary>`. One feature per commit.

## Never

- Add behaviour with no GDD ID.
- Change a tuning number in code without changing the GDD (or the reverse).
- Mark a backlog row `done` without a passing test or a recorded playtest.
