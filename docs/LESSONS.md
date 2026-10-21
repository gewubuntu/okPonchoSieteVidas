# Lessons

Append-only. Never rewrite history; add a new entry or update `Recurrence` and `Promoted` of an existing one.

## How to write an entry

Copy this template to the end of the file. IDs count up: `L-001`, `L-002`, ...

```
## L-000 Short title

- **Date:** YYYY-MM-DD
- **What went wrong:** what actually happened, factually
- **Root cause:** why it happened (process or knowledge gap, not "careless")
- **Rule:** the concrete behaviour that prevents it
- **Recurrence:** 1
- **Promoted:** no
```

## Promotion rule

When `Recurrence` reaches 2 or more, the lesson must be promoted and `Promoted:` must say where
(`scripts/check.mjs`, a skill name, or `CLAUDE.md`). `scripts/check.mjs` fails otherwise.
Prefer an automated check over a prose rule.

## Entries

## L-001 Skill frontmatter validated by regex, not by YAML rules

- **Date:** 2026-10-19
- **What went wrong:** All four skill descriptions contained an unquoted ": " (as in "PONCHO: Siete Vidas"), which is invalid YAML. The harness check passed anyway because it matched the frontmatter with a regex.
- **Root cause:** The check approximated the format instead of applying the rules of the real consumer (the skill loader's YAML parser). A passing self-test only proved the check agreed with itself.
- **Rule:** When a check guards a file format, encode the consumer's actual rules, and prove the check fails on a known-bad sample. Quote any frontmatter value that contains ": " or " #".
- **Recurrence:** 1
- **Promoted:** scripts/check.mjs (checkSkills quoting rule)

## L-002 Section edit sliced through neighbouring GDD sections

- **Date:** 2026-10-19
- **What went wrong:** Replacing GDD-MOV-06 by slicing from its heading to the next horizontal rule also deleted GDD-MOV-07 and GDD-MOV-08, which sit between them.
- **Root cause:** The end marker I chose was the end of the whole chapter, not the end of the section. Nothing about the edit made me check which IDs the slice contained.
- **Rule:** When editing a GDD section by script, end the slice at the next heading (`^#{1,6} `), and compare the set of GDD IDs before and after the edit. The gate's unknown-reference and backlog checks catch deletions, so always run `node scripts/check.mjs` before committing.
- **Recurrence:** 1
- **Promoted:** no

## L-003 GDD numbers were derived outside the code they describe

- **Date:** 2026-10-19
- **What went wrong:** The GDD's jump peak, jump distance and minimum hop were calculated with a separate scratch simulation. The real 60 Hz simulation gave a peak about 3 px lower and a minimum hop of 15 px, not 9 px. The first unit tests failed.
- **Root cause:** The numbers came from a different integrator and a different release timing than the shipped code, and nothing tied the GDD to the code until tests existed.
- **Rule:** Derive any GDD number that depends on simulation from the real simulation code through a test, then write the measured value into the GDD. The tuning tests in `src/sim/movement.test.ts` are the source for those figures.
- **Recurrence:** 1
- **Promoted:** no

## L-004 Debug hook returned the wrong value after landing

- **Date:** 2026-10-19
- **What went wrong:** `peakRise()` reset to 0 on landing, so the e2e jump test, which reads it after landing, always saw 0.
- **Root cause:** The hook's meaning ("current jump so far") was not the one the test needed ("last completed jump"), and its doc comment did not pin it down.
- **Rule:** Write the semantics of a debug hook in its doc comment before the first test uses it, and test the hook after the action it measures has finished.
- **Recurrence:** 1
- **Promoted:** no

## L-005 Stack versions chosen from memory, not from the registry

- **Date:** 2026-10-19
- **What went wrong:** The stack was set up on Phaser 3 and a TypeScript 5 toolchain while Phaser 4 and TypeScript 7 were already the latest releases. The user had asked for the state of the art and had to ask for it explicitly.
- **Root cause:** Versions were picked from training knowledge instead of checking the registry, and the intent behind "stack" was not made explicit (recommended versus latest).
- **Rule:** Before choosing or pinning any dependency, run `npm view <pkg> version` (and check peer ranges and release notes for majors). Default to the latest stable unless a written blocker says otherwise (GDD-TEC-07).
- **Recurrence:** 1
- **Promoted:** no

## L-006 Phaser key events and polling both misbehave on sub-frame input

- **Date:** 2026-10-19
- **What went wrong:** The HUD's dev key used `keydown-L` event handlers. When three presses landed in one frame (as Playwright's instant `press()` does), Phaser 4.2.1 ran the handler up to seven times, so lives dropped by 6 or 7 instead of 3. Switching to `JustDown` polling then missed taps that started and ended inside one frame, because `Key.onUp` clears the just-pressed flag.
- **Root cause:** Keyboard input was handled through the engine's convenience layer without checking how it treats several events in one frame. The e2e test only pressed one key once, so it passed; a screenshot taken after three quick presses exposed it.
- **Rule:** For game input, test taps that are quick and repeated, and test with a realistic key hold time. Do not rely on `keydown-X` event handlers for game logic. Poll key state per fixed step. For the jump button (GDD-CTL-04, GDD-MOV-03) a press shorter than one frame must still count, so latch presses from raw key events before relying on polling.
- **Recurrence:** 2
- **Promoted:** (second time, PR #27: the claw press, which needs an edge, was polled the same way and a tap inside one frame was lost; the reviewer measured 0 swings of 8) `src/ui/inputLatch.ts` (jump and claw, keyboard and touch, are latched from raw events and cleared by the step that uses them), `e2e/subframe.spec.ts` (taps dispatched inside one task for X, J, Space and both touch buttons), and a rule in CLAUDE.md

## L-007 A visible change was built and merged without the user seeing it

- **Date:** 2026-10-19
- **What went wrong:** The lives HUD (PR #3) was built, reviewed and merged with the HUD checked only by screenshots that Claude looked at. The user never saw the images and had to ask for them.
- **Root cause:** The harness had no step for visual approval. The playtest skill said to look at screenshots, but not to show them to the person who decides whether the result is good.
- **Rule:** Anything the player can see is shown to the user, in the session, as desktop and phone screenshots, and approved before the PR opens (CLAUDE.md "Visible changes need the user's approval"). Approved images are committed under `docs/screenshots/` and embedded in the PR.
- **Recurrence:** 1
- **Promoted:** scripts/pr-screenshots.mjs (CI warning), pr-reviewer subagent (blocking finding), CLAUDE.md

## L-008 The no-model-names check missed a bare model alias

- **Date:** 2026-10-19
- **What went wrong:** The new review subagent was first written with its `model` field set to a model alias. The rule says repository files do not name models, but the check only looked for names followed by a version number, so the gate passed. It was found by rereading the file, not by the harness.
- **Root cause:** The check encoded one spelling of the rule (names with a version) instead of the rule itself, and no check covered agent files at all.
- **Rule:** When a check guards a rule, test it against every spelling the rule is meant to forbid, including config fields. Agent files must use `model: inherit` (enforced in `scripts/check.mjs`).
- **Recurrence:** 1
- **Promoted:** scripts/check.mjs (no-model-ids now catches a model alias in a `model` field, checkAgents requires `inherit`)

## L-009 The GitHub tool mangled image URLs in the PR description

- **Date:** 2026-10-20
- **What went wrong:** The six approved screenshots were written into the PR description as markdown images, but the stored description had each URL wrapped in a growing number of backticks, so none rendered. The `pr-reviewer` agent caught it as a blocking finding; I had not read the description back.
- **Root cause:** The create and update tools rewrite URLs in the body in an inconsistent way (the first one or two links survive, later ones get wrapped; the `?raw=true` form, reference-style links and HTML image tags were also affected). I trusted what I sent instead of checking what was stored.
- **Rule:** After creating or editing a PR description, read it back with the GitHub tool and check every link. Embed a single overview image per PR, as a markdown image with a `/raw/<commit sha>/` path and no query string, and list the other files as plain links. The reviewer treats unrendered images as missing screenshots.
- **Recurrence:** 1
- **Promoted:** CLAUDE.md, PR template and the pr-reviewer agent

## L-010 A test that could not fail

- **Date:** 2026-10-20
- **What went wrong:** The held-jump test for the respawn rule (PR #7) passed with the rule removed, because the input it fed never exercised the rule. The skip window was also one step late. The `pr-reviewer` agent found both by mutating the code; my own run did not. It happened again in PR #9 (the rule "touching a used ofrenda again moves the checkpoint" had no test that could fail, because my own mutations covered other rules) and in PR #11 (the pitch test read its notes from the code under test), and in PR #24 (the item wall-turn snap and the item's solid-world argument had no test that could fail).
- **Root cause:** I wrote the test, saw it green and stopped. A green test only proves the code and the test agree, not that the test can detect the rule being broken.
- **Rule:** After writing a test for a rule, break the code (remove the rule, move a threshold by one) and confirm the test fails, then restore. Do it for every new rule or bullet in the GDD diff, not a sample, and write the expected values from the GDD into the test instead of reading them from the code under test. The `feature` skill has this step and the `pr-reviewer` agent does it on every PR.
- **Recurrence:** 4
- **Promoted:** .claude/skills/feature (mutation step, now one mutation per new GDD rule), pr-reviewer subagent

## L-011 Generated audio was never listened to or measured

- **Date:** 2026-10-20
- **What went wrong:** The first two ofrenda sound files were almost silent: an attack ramp made the envelope exactly 0 at the first sample, which ended the tone loop at once, so only a 12 ms click was written. I checked the length and peak level, sent the files, and the user had to tell me they sounded wrong.
- **Root cause:** I verified that the generator ran and the file had the right size, not what was inside it. A peak level can come from one click, and I cannot hear.
- **Rule:** For any generated asset (audio, images), measure the output itself before showing it: non-silent samples over time, the expected frequencies, decay. Pin the expected values from the GDD in a test (`scripts/audio/ofrenda.test.mjs`), not values read back from the code under test.
- **Recurrence:** 1
- **Promoted:** scripts/audio/ofrenda.test.mjs (decoded-energy and pitch tests)

## L-012 A failing gate was committed and pushed

- **Date:** 2026-10-20
- **What went wrong:** For the touch controls I ran `node scripts/check.mjs | tail -1; git commit ...`. The gate had failed (a TypeScript error: `toSorted` is not in the ES2022 lib), but the pipe kept only `tail`'s exit status and `;` ignores failures, so the commit and push went ahead. I saw "1 problem(s) found" in the output and fixed it in a second commit before opening the PR, so nothing broke, but CLAUDE.md says the gate must pass before every commit.
- **Root cause:** I chained the commit after a pipeline that hides the gate's exit code, and read the result only after the commit had happened.
- **Rule:** Run the gate on its own and check its exit code, then commit: `node scripts/check.mjs && git commit ...` with no pipe to `tail` (or `set -o pipefail`). If the output is needed, read it from a separate run.
- **Recurrence:** 1
- **Promoted:** .claude/skills/feature (Gate step)
