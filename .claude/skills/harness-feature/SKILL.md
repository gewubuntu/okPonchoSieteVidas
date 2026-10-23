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
The main session plans and checks; the `implementer` subagent (`.claude/agents/implementer.md`) writes the tests and the code, on a cheaper model (`docs/HARNESS.md`). Steps 1 to 5 and 7 onward are yours.

5. **Plan.** Write `.plans/<GDD-ID>.md` (gitignored). The implementer starts cold and builds only what it lists, so make it self-contained:
   - the GDD IDs and sections, and the user's decisions from this session, quoted;
   - the files to touch, with the functions or line ranges, and the tuning numbers with their GDD source;
   - every test, by name, with its setup and expected values written from the GDD, not from code. Test names include the GDD ID, e.g. `describe('GDD-MOV-02 jump', ...)`. Pure logic gets Vitest tests with no Phaser imports; a new press-driven action gets its one-task tap in `e2e/subframe.spec.ts`;
   - the mutant list in the `scripts/mutate.mjs` format, each naming the test that must kill it;
   - whether the change is visible (screenshots needed) and which playtests to run;
   - the lessons that apply (search `docs/LESSONS.md` for the area).
   **Input rules (L-019):** when a rule reads buttons (presses, releases, holds), list every source that produces each one (keyboard keys, touch buttons, the slide stick, raw-event latches) and the pairs that combine (left and right into `move`), and plan a test for each source and each pair. Read single buttons raw, never from a combined value. **Shared buttons (L-024):** list every existing rule that already reads the same button (jump buffer, coyote time, variable jump, stomp boost, the spring launch that no press replaces, GDD-WLD-05, and the "already held" marks left by the respawn and by the pause resume, GDD-UI-02; search the whole GDD for the button's name, not only section 4) and plan a test for each one with the new rule on. A new rule on a held button counts the hold from a press the simulation saw, never from any held input.
   **Mutants (L-010):** go sentence by sentence through the GDD text, not bullet by bullet: split each new bullet into its clauses ("A or B wins over C" is two rules; a warning or a pose drawn on screen is a rule too) and give each clause its own mutant (remove the rule, move a threshold by one).
   For a change smaller than its plan would be (a tuning tweak, a one-line fix), skip the plan file and the implementer and build it yourself, but still apply step 5's input, shared-button and mutant rules: write those tests and run those mutants with `node scripts/mutate.mjs`, then do step 7's checks.
6. **Build.** Launch the Agent tool with `subagent_type` `implementer`, the plan's path, and its `model` parameter set to the mid-tier model, cheaper than the main session's and more capable than the smallest. Name no model when you launch the `pr-reviewer`. If that agent type is not available, launch a general-purpose agent told to follow `.claude/agents/implementer.md` exactly. If it stops on a question, answer it (ask the user when the decision is theirs), update the plan, and continue it with SendMessage.
7. **Check its work.** The report is a claim, not proof:
   - Read the whole diff against the plan: nothing missing, nothing extra, expected values from the GDD, code that reads like its neighbours.
   - Run `node scripts/check.mjs` yourself.
   - Every planned mutant must have been killed by its named test, run alone with `-t` (L-026). Re-run any the report does not account for with `node scripts/mutate.mjs <mutants.json>` (L-020), never by hand with `sed` or an ad hoc script, in the foreground. A surviving guard that another rule covers is deleted, with the covering rule named in a comment (L-025).
   - Fix small things yourself; send larger ones back to the implementer with SendMessage. List the mutations in the PR description.
8. **Playtest** with the `harness-playtest` skill when the feature is visible or interactive.
   **If anything visible changed**, follow the screenshot approval rule in `CLAUDE.md` now: `npm run shots`, look at the images, show them to the user with `SendUserFile`, and wait for their approval before opening the PR.
9. **Update docs.** Mark the backlog row `done`. If implementation forced a rule change, update the GDD with `harness-gdd-update`.
   **Hunt the stale sentences (L-013).** Search `docs/GDD.md` for the feature's neighbours (the IDs and names it touches) and for "yet", "so far", "only", "not built" and "built for", and fix every sentence the feature now falsifies. Each section named in the changelog line must be in the diff. A claim about where things are in the sandbox level (reach, clearance, spotting) needs a test over the real level data (L-014).
10. **Gate.** Run `node scripts/check.mjs` and fix everything before committing. Chain the commit on its exit code (`node scripts/check.mjs && git commit ...`), never behind a pipe to `tail` or after `;` (L-012).
11. **Retro.** Run the `harness-retro` skill.
12. **Commit** as `feat(GDD-XXX-NN): <summary>`. One feature per commit.

## Never

- Add behaviour with no GDD ID.
- Change a tuning number in code without changing the GDD (or the reverse).
- Mark a backlog row `done` without a passing test or a recorded playtest.
