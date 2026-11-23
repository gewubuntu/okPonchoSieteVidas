---
name: harness-feature
description: "Implement one GDD ID end to end for PONCHO: Siete Vidas, from plan to tested commit. Use when asked to build, implement, change or fix how the game behaves or looks: a mechanic, enemy, level, screen, menu, HUD, sound or art, or a part of the game server or of replays (GDD-TEC-09, GDD-TEC-10). Takes a GDD ID such as GDD-MOV-02; a request with no ID goes through harness-gdd-update first."
---

# Feature

Implements exactly one GDD ID (or a small named group of them) from spec to tested code. You, the main session, plan and check; in step 6 the `implementer` subagent (`.claude/agents/implementer.md`) writes the tests and the code from your plan, on the model step 6 names (`docs/HARNESS.md`). Every other step is yours.

## Steps

1. **Resolve the ID.** Find the `### GDD-XXX-NN` section in `docs/GDD.md`. If it does not exist, stop and use `harness-gdd-update`.
2. **Check status.** If `Status: Proposed`, tell the user you are implementing a proposal and continue only if they asked for this feature. If `Deprecated`, stop.
3. **Check blockers.** Read the GDD's Open Questions and the section's dependencies. Anything that needs an unmade user decision: stop and ask (record the answer with `harness-gdd-update` before the plan), or build with a clearly marked placeholder. Before drawing new art (a sprite, a tileset, a scene, a UI look), ask the user for their reference images for it and save any they share under `assets/` with a README (L-039).
4. **Mark `doing`** in `docs/BACKLOG.md`.
5. **Plan.** Write `.plans/<GDD-ID>.md` (gitignored). The implementer starts cold and builds only what it lists, so make it self-contained:
   - the GDD IDs and sections, and the user's decisions from this session, quoted;
   - the files to touch, with the functions or line ranges, and the tuning numbers with their GDD source;
   - every test, by name, with its setup and expected values written from the GDD, not from code. Test names include the GDD ID, e.g. `describe('GDD-MOV-02 jump', ...)`. Pure logic gets Vitest tests with no Phaser imports; a new press-driven action gets its one-task tap in `e2e/subframe.spec.ts`; a playtest or screenshot scenario follows the `harness-playtest` skill (load it before planning one);
   - the mutant list in the `scripts/mutate.mjs` format, each naming the test that must kill it;
   - whether the change is visible (screenshots needed) and which playtests to run. Motion counts (L-007): a change that moves what is drawn (a shake, an animation, a camera move, the timing of a drawn thing) is visible, since its frames differ; plan a screenshot scenario of its extreme frames (for a shake, its biggest down and up frames) and the user's approval, never "cannot be seen in a still frame";
   - the lessons that apply, by ID, found with `node scripts/check.mjs --lessons <area,...>` (the implementer reads each one the plan names with `--lesson`).
   - the rules files below that the plan followed.
   **Rules.** The rules a plan follows are in files beside this one, one rule to a line with its lesson. Read the first for every plan and each other whose row fits the change. A lesson, a hook message or a review that cites "harness-feature step 5" means this step and these files.

   | The change | Read |
   | --- | --- |
   | every plan: its mutants, worked cases, existing fixtures, families and size | `.claude/skills/harness-feature/rules/plan.md` |
   | reads a button (a press, a release, a hold) or adds a tap target | `.claude/skills/harness-feature/rules/input.md` |
   | places things in a level by a rule, claims where things are or what a path costs, or drives a level in a test | `.claude/skills/harness-feature/rules/levels.md` |
   | draws or redraws a sprite, or replaces a stand-in (a stub level, a placeholder drawing or sound) | `.claude/skills/harness-feature/rules/art.md` |
   | sets each frame something other code reads, or shows the player a new text | `.claude/skills/harness-feature/rules/screen.md` |

   For a change smaller than its plan would be (a tuning tweak, a one-line fix), skip the plan file and the implementer and build it yourself, but still apply every step 5 rule that fits the change (input, shared buttons, placement, touch areas, on-screen texts, mutants): write those tests and run those mutants with `node scripts/mutate.mjs`, then do step 7's checks.
6. **Build.** Launch the Agent tool with `subagent_type` `implementer`, the plan's path, and its `model` parameter set to the tier one below the main session's model, but never the smallest tier: when the main session already runs on the middle tier, give that same tier. If that agent type is not available, launch a general-purpose agent told to follow `.claude/agents/implementer.md` exactly. If it stops on a question, answer it (ask the user when the decision is theirs), update the plan, and continue it with SendMessage.
7. **Check its work.** The report is a claim, not proof:
   - Read the whole diff against the plan: nothing missing, nothing extra, expected values from the GDD, code that reads like its neighbours.
   - Run `node scripts/check.mjs` yourself.
   - Every planned mutant must have been killed by its named test, run alone (L-026): each mutant has its own `test` command that runs only that test, with `-t` for Vitest or `-g` for Playwright (L-034). Re-run any the report does not account for with `node scripts/mutate.mjs <mutants.json>` (L-020), never by hand with `sed` or an ad hoc script, in the foreground. A surviving guard that another rule covers is deleted, with the covering rule named in a comment (L-025).
   - Every change in the diff the plan did not list (a guard, a branch, a new call) gets its own mutant and a test that kills it, like the planned ones (L-010).
   - Fix small things yourself; send larger ones back to the implementer with SendMessage. List the mutations in the PR description.
8. **Playtest** with the `harness-playtest` skill when the feature is visible or interactive.
   **If a sprite sheet is new or redrawn**, first build its lineup (L-066): `node scripts/art-lineup.mjs <scratchpad>/lineup.png <its folder or sheet> <the approved sheets it must match> <the user's references, if any>`, for example `assets/sprites/enemies` for an enemy, or `assets/sprites/poncho.png assets/sprites/poncho assets/characters/poncho` for Poncho. Look at it and check the new art against the others, item by item: silhouette, profile and facing, proportions, shading depth, pattern, outline, face. Fix what fails before the user sees it, and send the lineup with the shots, saying what was checked.
   **If anything visible changed**, follow the screenshot approval rule in `CLAUDE.md` now: `npm run shots`, look at the images, show them to the user with `SendUserFile`, and wait for their approval before the PR is marked ready for review.
9. **Update docs.** Mark the backlog row `done`, only with a passing test or a recorded playtest. Make every GDD edit, including a rule change the implementation forced, with `harness-gdd-update` (version, changelog, its stale-sentence hunt).
   **Hunt the stale sentences (L-013)** with step 1 of `harness-gdd-update`, also when the feature needs no GDD edit of its own (then give the hunt the feature's GDD IDs, since no section changed): what it built can make sentences elsewhere false (a "not built yet", a list its new level, menu, enemy or input source must join in `docs/GDD.md` or `docs/BACKLOG.md`, a rule "checked by" a test file it deleted or moved). Run the hunt for every phase and commit of the feature, not only the first (L-013, recurrence 35). Each section named in the changelog line must be in the diff (the gate's `gdd-changelog-sections`). A claim about where things are in a level (reach, clearance, spotting, a route) needs a test over that level's real data in `src/levels/` (L-014).
10. **Gate.** Run `node scripts/check.mjs` and fix everything before the retro.
11. **Retro.** Run the `harness-retro` skill.
12. **Commit** as `feat(GDD-XXX-NN): <summary>`, one feature per commit, chained on the gate's exit code: `node scripts/check.mjs && git commit ...`, never behind a pipe or after `;` (L-012; a hook denies it). Push in a command of its own, after reading that the gate passed and the head moved (L-078; the same hook denies a push chained after the commit).
13. **Push and pull request.** Right before pushing, `git fetch origin main`; if it moved, merge it, re-run the gate and the touched playtests, retake the screenshots it affects, and follow the conventions its new GDD changelog lines set (L-052; a hook asks before a push while `origin/main` has commits the branch lacks). If the merge gives two lessons one ID, main's keep theirs and the branch's unmerged lessons take the next free IDs after main's last; move only what the branch added: the lessons' headings and the references the branch added (`git diff <merge-base> HEAD`, lines with the old IDs), never a regex over every ID, which also rewrites the history told inside the lessons (L-086). After the push, open a draft PR if the branch has no open one, by the rules in `CLAUDE.md` ("Pull requests"). Once the `pr-reviewer`'s findings are fixed, run `harness-retro` on them: a finding that a rule in this skill should have prevented raises that lesson's `Recurrence` (L-010, L-013).
