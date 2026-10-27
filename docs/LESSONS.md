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
- **Recurrence 3 (2026-10-22, PR #37):** the pause keys (GDD-UI-02) used Phaser `Key` `down` events. A probe of 40 real presses showed one press firing `down` twice in most runs, toggling the pause straight back; it surfaced as a CI flake in `e2e/pause.spec.ts`. Pause now reads raw `keydown` events by `keyCode` (the key's label, so the P key pauses on Dvorak too), auto-repeat ignored. A playtest of 40 real presses fails with the old wiring only in some runs (about one in four), so the deterministic guard is a gate check: `scripts/check.mjs` (`key-down-handlers`) allows a Phaser key-down event (`'down'`, `Events.DOWN`, `'keydown-X'`) in `src/` only in the one-line form that presses a latch, so a multi-line, named or `once` handler fails by default. Gate-check mutants run through `scripts/mutate.mjs` are judged correctly: the runner sets `PONCHO_MUTATING` so `no-mutation` does not fail on the run's own marker.
- **Recurrence:** 3
- **Promoted:** `scripts/check.mjs` (`key-down-handlers`, Recurrence 3); before that (second time, PR #27: the claw press, which needs an edge, was polled the same way and a tap inside one frame was lost; the reviewer measured 0 swings of 8) `src/ui/inputLatch.ts` (jump and claw, keyboard and touch, are latched from raw events and cleared by the step that uses them), `e2e/subframe.spec.ts` (taps dispatched inside one task for X, J, Space and both touch buttons), and a rule in CLAUDE.md

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
- **Recurrence:** 8
- **Promoted:** .claude/skills/harness-feature (mutation step, now one mutation per new GDD rule), pr-reviewer subagent. (Fifth time, the Tlacuache: two play-dead tests read the 2.0 s from `TLACUACHE.playDeadSteps`, so moving it did not fail them; the mutation step caught it before the commit, and the tests now say 119 and 120 steps.) (Sixth time, the same PR: the reviewer found two Tlacuache rules with no test that could fail, the claw half of "the claw or a fireball wins over a first stomp" and the wake-up twitch. My mutations went bullet by bullet and missed clauses; the feature skill now asks for one mutation per clause.) (Seventh time, PR #35: the clause "so it always starts at its normal size" was tested only for the first drop to one; resetting the start when the lives leave one had no test. The start tracking moved into a pure helper with unit tests for each path.) (Eighth time, PR #44: the hilo playback rate was computed in `PlayScene`, and the plan left the scene out of the mutants, so the reviewer could set the rate to 1 with every test green. The rate moved into a pure helper (`noteRate`) and the scene logs the rate it passes, checked in e2e; the feature skill now names numbers computed in a scene.)

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
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-feature (Gate step), then, after the second time, `scripts/hooks/gate-pipe.mjs`: a PreToolUse hook that denies a shell command committing after the gate with anything but `&&` between them. Second time (2026-10-25, GDD-ART-02): `node scripts/check.mjs 2>&1 | tail -1 && git commit` committed a lessons-format failure; the next commit fixed it. The rule stands: never pipe the gate.

## L-013 Sentences the new feature made false were left in the GDD

- **Date:** 2026-10-22
- **What went wrong:** In PR #29 (the Alacrán) the GDD still said "nothing is hurt by a fireball yet" and "not built yet: enemies" after the feature made both false, and the reviewer called it blocking. In PR #30 (the Zopilote) GDD-CMB-03 still said the knockback was built "for spike hits and the Alacrán". The changelog named those sections as touched, but I had edited only the section I was working in. Again in PR #43, GDD-TEC-04: the PR deleted the sandbox's GDD-ENM-01 test, and GDD-ENM-02 still said "checked by `src/levels/sandbox.test.ts`" for the cactus buddy and the Tlacuache. The hunt searched for the rule's words, not for the path of the test it removed.
- **Root cause:** I wrote the new text and never searched for the old text it contradicts. Phrases like "not built yet", "so far", "only", "yet" and the names of the neighbouring features sit in other sections and go stale silently.
- **Rule:** After editing the GDD for a feature, search `docs/GDD.md` for the feature's neighbours (the IDs and names it touches) and for "yet", "so far", "only", "not built" and "built for", and fix every sentence the feature falsifies. Every section named in the changelog line must actually be in the diff.
- **Recurrence:** 3
- **Promoted:** .claude/skills/harness-feature (Update docs step, which now also searches for the path of every test file or block the feature deletes or moves)

## L-014 A claim about where things are in the sandbox level had no test

- **Date:** 2026-10-22
- **What went wrong:** The GDD, a code comment, an e2e comment and the PR description said only the spring ledge and the moving platform put Poncho in the Zopilote's reach. It also reached the Alacrán's platform (89 px below its line, inside the 80 px trigger at the low end of its bob). The reviewer found it by running the sandbox level.
- **Root cause:** I reasoned about the geometry from the floor and two obvious places and never ran the real level through the sim. A statement about the level is a claim the sim can check.
- **Rule:** When the GDD or a comment says where something can or cannot happen in the sandbox level (reach, spotting, clearance from a respawn), put a test over the real level data (`src/levels/sandbox.test.ts`) that runs the sim and states it, and mutate the level numbers to see it fail.
- **Recurrence:** 2
- **Promoted:** src/levels/sandbox.test.ts (the Zopilote's reach); .claude/skills/harness-feature (step 5: a placement rule is run over every real level before it goes into the GDD or a plan). Second time (2026-10-27, GDD-ART-06): I wrote the plants' kind rule as (7 x column + row) mod 7 into the GDD and the plan without running it; a coefficient equal to the modulus cancels, so it was just row mod 7 and every plant on a row was the same kind, and 0-1 got 5 plants and the sandbox none. The rule was rerun over both levels and the counts (12 and 4) went into the GDD and a test.

## L-015 An e2e test picked an enemy out by where it is, and a new enemy matched

- **Date:** 2026-10-22
- **What went wrong:** The Zopilote playtest found its painted enemy with `e.y < 120`. Adding the Tlacuache on a ledge at y = 96 made that filter match it too, so "the defeated Zopilote is gone from the picture" failed on both viewports.
- **Root cause:** The debug hook's `enemiesDrawn()` gives only positions, so each enemy test identifies its enemy by a place in the sandbox, which holds only until something new is put there.
- **Rule:** When adding anything to the sandbox level, run the whole e2e suite, not only the new spec. Identify an enemy in a test by its index or kind, not by a region of the screen; if the hook cannot say which is which, extend the hook.
- **Recurrence:** 1
- **Promoted:** no

## L-016 A screenshot scenario took the wrong picture and still passed

- **Date:** 2026-10-22
- **What went wrong:** The Tlacuache's "playing dead" shot showed it walking: the scenario stomped too early (while it charged away) and then moved Poncho away before he landed. The "telegraph" shot put Poncho 0.4 px into the level's right wall, which pushed him out of the picture. Both were caught only by looking at the images.
- **Root cause:** Shot scenarios had no assertions, so a scenario that misses the state it is named for runs green.
- **Rule:** In every `e2e/shots/` scenario, assert the state the shot is named for (phase, position in view) right before taking it.
- **Recurrence:** 1
- **Promoted:** no

## L-017 A 1 px drawing could not be checked by pixels on the phone viewport

- **Date:** 2026-10-22
- **What went wrong:** The Tlacuache's twitching feet were 1 px columns. The pixel test passed on desktop, but on the phone viewport (1.44x scale) the columns merged or vanished, and it found 1 of 4 feet.
- **Root cause:** At a non-integer scale a 1 px detail is not reliably drawn where its virtual pixel is, so a pixel sample has no margin.
- **Rule:** Anything an e2e test reads by pixels must be at least 2 px in each direction, and sample it in its middle, 1 px or more from any edge. Run pixel tests on both viewports before pushing.
- **Recurrence:** 1
- **Promoted:** no

## L-018 A pixel sample on the phone landed under a touch button

- **Date:** 2026-10-22
- **What went wrong:** The game-over test checked that the level is dimmed by reading a floor tile at the bottom left. On the phone viewport that spot is under the touch Left button, which is drawn above the screen, so the test failed there. The same thing happened before: a fragile-tile pixel test is skipped on the phone because the Jump button covers its tile.
- **Root cause:** Pixel sample points were chosen on the desktop picture. On the phone the touch buttons cover the bottom corners and sit on top of everything.
- **Rule:** Choose pixel sample points clear of the touch buttons (their boxes come from `touch().buttons`), and run pixel tests on both viewports before pushing.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-playtest (step 6 of "Writing a scenario")

## L-019 A press was read from a value that had already combined two buttons

- **Date:** 2026-10-22
- **What went wrong:** The Siete vidas gastadas screen counts a new press of any button. Left and right reached the simulation only as `move`, their sum, so with right held a press of left made `move` 0: the press was lost, and its release then looked like a new press of right. The reviewer found it with a probe. My test held right and pressed jump, never the opposite direction.
- **Root cause:** I tested the rule with buttons that are independent in the input and missed the two that are not. The input had already merged them before the new rule needed them apart.
- **Rule:** When a rule counts presses or releases of single buttons, read each button raw, never a value that combines several (`move`), and test the pairs that combine: both directions at once.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-feature (step 5: list every input source that produces each button the rule reads, and test each). (Second time, the same PR: the fix passed raw left/right from the keys and touch buttons, but set them to false in slide-stick mode, so a stick push stopped counting. The reviewer found it.)

## L-020 A hand-run mutation was left in the code

- **Date:** 2026-10-22
- **What went wrong:** For the respawn-skip fix I ran a mutation with `sed` straight in the shell, chained to a test run but not to a restore. The next test output came from the mutated file, and the `git diff` showed the mutation still in place. I caught it before committing and put the fix back.
- **Root cause:** The earlier mutations ran through a script that restored each file in a `finally`. This one-off went around it, so nothing undid it.
- **Rule:** Run every mutation through a small script that, for each mutant, replaces the exact text in the file, runs the tests, and puts the original back in a `finally` block; then check that `git diff` of the source files shows only the intended change before the gate and the commit. Do not mutate files while `npm run test:e2e` is running: the Vite dev server reloads the pages and unrelated playtests fail with `__PONCHO__` undefined.
- **Recurrence 2 (2026-10-22, GDD-UI-02):** the pause mutations ran in the background through an ad hoc script. The background time limit killed it in the middle of a mutant, so its `finally` never ran, and the scene was left with one prompt line instead of two. A grep before the gate caught it.
- **Recurrence:** 2
- **Promoted:** scripts/check.mjs (no-mutation) and scripts/mutate.mjs: the runner mutants from a JSON list and keeps the original in `.mutating.json` while a mutant is in place; `scripts/check.mjs` (`no-mutation`) fails while that marker exists, and `node scripts/mutate.mjs --restore` puts the file back. Step 7 of the `harness-feature` skill and step 4 of `.claude/agents/implementer.md` name the runner.

## L-021 A paused playtest skipped the code that animates the HUD in real play

- **Date:** 2026-10-22
- **What went wrong:** The last-life pulse needs the HUD redrawn on every step, which the scene's `update()` does only under a condition. The playtest drove the game with the debug `step()` hook, which calls `drawHud()` itself, so removing that condition left every test green while in real play the triangle froze after the crack. The reviewer found it with an unpaused probe.
- **Root cause:** The debug `step()` hook redraws everything on each call, so a paused test cannot see what `update()` draws, or fails to draw, on its own.
- **Rule:** For anything that animates or redraws over time, add at least one playtest that runs the game unpaused through its own frames and checks the picture (or the drawn state) keeps changing.
- **Recurrence:** 1
- **Promoted:** no

## L-022 A playtest released a held key and pressed it again inside one frame

- **Date:** 2026-10-22
- **What went wrong:** The pause playtest held Space through the resume, then called `keyboard.up('Space')` and at once `keyboard.press('Space')`. Two runs in three failed: no jump. No step ran between the release and the new press, so the simulation saw jump held throughout and found no new press.
- **Root cause:** Presses are latched (L-006), releases are not: the step reads the key as held when the release and the next press land in the same frame. That is how the game behaves for a player too, so the test, not the game, was wrong.
- **Rule:** In a playtest, after releasing a held button and before pressing it again, wait until a step has seen the release (for jump, `state().jumpWasHeld` is false). Run a new real-time playtest with `--repeat-each=3` before trusting it.
- **Recurrence:** 1
- **Promoted:** no

## L-023 A layer's "stays on top" and a check made once at start had no test

- **Date:** 2026-10-22
- **What went wrong:** The review of GDD-UI-02 found two scene rules no playtest could fail. Raising the pause screen above the HUD and touch buttons stayed green, because the only pixel check was on a level tile. Removing the orientation check at start stayed green, because the portrait test always booted in landscape and rotated later.
- **Root cause:** The pixel test only checked what the overlay covers, not what must show through it. And the tests only reached the state by changing into it, never by starting in it.
- **Rule:** For an overlay, sample one pixel it must dim and one it must leave alone (HUD, buttons). For anything checked on an event and also once at start (orientation, focus, storage), add a test that starts in that state.
- **Recurrence:** 1
- **Promoted:** no

## L-024 A new rule on a held button took a short press away from an older rule

- **Date:** 2026-10-22
- **What went wrong:** The glide read "jump held while falling". A one-step jump press just before landing, which the jump buffer (GDD-MOV-03) turns into a jump on landing, now also glided for that step, slowed the fall, and landed after the buffer had run out: no jump. The new unit tests were green; the old spring playtest that times a buffered press caught it.
- **Root cause:** The new rule and the jump buffer both read the jump button while falling, and nothing checked them together.
- **Rule:** When a new rule reads a button that an existing rule already reads (jump buffer, coyote time, variable jump, stomp boost), list those rules, write a unit test that plays each one with the new rule switched on, and run the whole playtest suite before showing screenshots.
- **Recurrence 2 (2026-10-22, same PR, found by the review):** the list missed GDD-UI-02. A jump pressed while paused and held through the resume (marked as held by `resumeHeld`) still glided, because the glide counted any held input instead of a press the simulation saw.
- **Recurrence 3 (2026-10-23, GDD-MOV-08, found by the review):** the wall kick reads a jump press in the air, and the list did not have the spring launch, which GDD-WLD-05 says no jump press replaces. At the sandbox spring, against a wall, a late press kicked and cut the launch from 77 to 56 px. The skill's list now names the spring launch and stomp bounce, and says to look for the button in every GDD section, not only in movement.
- **Recurrence:** 3
- **Promoted:** step 5 of the `harness-feature` skill (input rules): list every rule that already reads the button, including the "already held" marks of the respawn and of the pause resume, and test each with the new rule on.

## L-025 A guard that another rule already covers survived its mutant

- **Date:** 2026-10-23
- **What went wrong:** In the glide (GDD-MOV-07) a "not on the ground" condition survived its mutant, because landing ended the glide anyway. In the wall cling (GDD-MOV-08) the same happened twice: "not touching on the ground" and the kick's "not grounded" check, both already covered by the normal jump taking the press first and by landing ending the slide.
- **Root cause:** Each guard was written for a case another rule already handles, so it had no behaviour of its own for a test to pin down.
- **Rule:** When a mutant of a guard survives, first ask whether another rule already covers that case. If it does, delete the guard and say in a comment which rule covers it, instead of adding a test that cannot fail for the guard alone.
- **Recurrence 3 (2026-10-23, GDD-WLD-05 moving blocks):** a `clinging: false` on the block's side stop survived, since movement only clings to tiles; deleted with a comment naming the covering rule. The skill step worked as written.
- **Recurrence 4 (2026-10-23, GDD-UI-02 pause menu):** the plan itself designed the redundancy: a `tapResume` event for a tap on the Resume row, which did exactly what a plain `tap` already did (resume, whichever item is chosen). Its mutant could not die. Deleted in the check step, the Resume row now sends `tap`. The rule caught it, but only after a plan, an implementation and tests had been built for it.
- **Recurrence:** 4
- **Promoted:** step 7 of the `harness-feature` skill (step 4 of `.claude/agents/implementer.md` too), and since recurrence 4 also step 5 (plan): a new event, state or branch must do something no existing one does.

## L-026 A test measured over a window wide enough to include a second, unrelated event

- **Date:** 2026-10-23
- **What went wrong:** The sandbox spring test (GDD-MOV-08, GDD-WLD-05) took Poncho's highest point over 60 steps. With the spring guard removed, a press kicked him only 56 px up, but holding left walked him back onto the spring and a second launch reached the same 77 px, so the test stayed green. I claimed the mutant failed it after checking only the whole file, where another test caught it.
- **Root cause:** The measuring window was longer than the event under test, and the mutant was checked against the file, not against the new test alone.
- **Rule:** Stop a measurement at the end of the event it is about (the first apex, the first landing), and assert the sign of the effect directly on every step. When a description says a mutant fails a particular test, run that mutant against that test alone (`-t`).
- **Recurrence:** 1
- **Promoted:** no

## L-027 A new HUD element pushed older on-screen text into the title

- **Date:** 2026-10-23
- **What went wrong:** The hilo counter (GDD-UI-01) took the top-right corner, where the dev-only key hint was. The implementer moved the hint down to y = 20, straight over the centred game title. No test reads either text, so the gate and the playtests were green; it showed only in the screenshots.
- **Root cause:** The plan named the counter's place but not what else already draws near it, so the clash was solved by moving the old text without checking where it landed. Text overlap has no automated check.
- **Rule:** When a plan puts something on the HUD or moves on-screen text, list every text and graphic already drawn in that area (title, controls line, dev hint, pause button, keys and icons) and say where each one goes, then look at both viewports' screenshots for overlap before showing them.
- **Recurrence:** 1
- **Promoted:** no

## L-028 An exemption flag was tested only for what it skips, not for what it keeps

- **Date:** 2026-10-23
- **What went wrong:** In PR #43 (GDD-TEC-04) the sandbox is a test level that skips the exit and length checks. The tests proved those two are skipped, but nothing proved the ofrenda, gap and enemy checks still run for a test level, so `if (entry.test) return [];` passed every test while the PR deleted the sandbox's own enemy-distance test. The reviewer also found the "bottom row" gap rule and the straight-line distance unpinned: every fixture cleared all floor rows and put enemies level with the respawn.
- **Root cause:** The plan's mutants came from the rules as written ("skips X"), not from the rule's other half ("and keeps Y"), and the fixtures were built so that neighbouring definitions (bottom row against all floor rows, straight-line against axis distance) gave the same answer.
- **Rule:** For a flag that exempts something from some rules, plan a test with the flag on that breaks every rule it does not exempt, and a mutant that makes the flag exempt everything. For each definition, pick a fixture where the likely wrong definition gives a different answer.
- **Recurrence:** 1
- **Promoted:** no

## L-029 Planned mutants with no test to kill them

- **Date:** 2026-10-23
- **What went wrong:** The GDD-AUD-02 plan listed mutants for the land-only-in-play guard, the stomp mark on the life-lost returns and the stomp mark being cleared on the respawn paths, but named no test for them ("pick the test; or report if none"). The implementer had to design three extra tests on its own, and a `-t` filter with "(45 steps)" in the test name matched nothing, because `-t` is a regular expression.
- **Root cause:** The plan was written from the rules down to mutants, not from each mutant back to a planned test, so a clause with no test only showed up when its mutant survived.
- **Rule:** Every planned mutant names a test that is in the same plan. When a mutant has none, add the test to the plan (setup and expected value) before launching the implementer. Keep test names free of regex characters such as parentheses, or filter on a plain prefix.
- **Recurrence 2 (2026-10-25, GDD-CTL-02):** the other direction. The plan listed `this.pad.holdBack()` in `quitToTitle` as a code change but gave it no mutant and no test; the implementer's own mutant survived every test and it added a playtest.
- **Recurrence:** 2
- **Promoted:** step 5 of the `harness-feature` skill (mutants): every code line the plan lists gets a mutant, and every mutant a test in the plan.

## L-030 The session started on a branch left behind by an earlier merged PR

- **Date:** 2026-10-23
- **What went wrong:** The designated branch still held the commits of an old, already merged PR and was 57 commits behind `main`. The first backlog read came from that stale copy and showed rows as `todo` that `main` had already built, so the next-feature choice offered to the user was nearly built on old state. A fetch caught it before any code was written.
- **Root cause:** The work loop says to restart the branch from `main` after a merge, but nothing says to check that at the start of a session, when the merge happened in another session.
- **Rule:** At the start of every task, `git fetch origin main` and compare; if the branch carries only merged history, restart it from `origin/main` before reading the backlog or the GDD.
- **Recurrence:** 1
- **Promoted:** no

## L-031 The PR overview sheet has no tool, so each session builds one by hand

- **Date:** 2026-10-23
- **What went wrong:** `CLAUDE.md` asks for an `overview.png` sheet of the approved screenshots in every visible PR, but the repository has no script for it. This session wrote a throwaway Playwright page in the scratchpad to compose the sheet, as earlier sessions must have done, each with its own layout.
- **Root cause:** A required step of the PR rule was written as prose with no tool behind it.
- **Rule:** Until there is a script, compose the sheet from the committed screenshots only (never from `shots/`), with each file name under its image, and look at it before committing.
- **Recurrence 2 (2026-10-25, GDD-UI-02 settings):** the sheet was about to be built by hand again; `scripts/overview.mjs` now composes it from a `docs/screenshots/<slug>/` folder.
- **Recurrence:** 2
- **Promoted:** `scripts/overview.mjs`, named in the `CLAUDE.md` commands table and its Pull requests rule.

## L-032 Hiding the touch buttons hid only their drawing

- **Date:** 2026-10-23
- **What went wrong:** On the title screen (GDD-UI-02) the touch buttons were hidden with `setVisible(false)`, but `read()` still acted on them: a finger held on the invisible mode switch flipped the slide stick and saved the choice. A tap and a turn upright in the same frame also started the level upright. The review found both with probes; the playtests used `page.touchscreen.tap`, which is shorter than a frame, and never put two events in one frame.
- **Root cause:** The plan treated "hidden" as a drawing change and listed every input source for starting the level, but not the side effects those sources have on their own (the mode switch). Events were applied in order, but the rule was really about the state at the end of the frame.
- **Rule:** When a screen hides controls, list what each hidden control does besides the press the screen reads, and test a held touch (CDP, several frames), not only a tap. When a rule reads several events from one frame, decide on the state at the end of the frame and test a pair of conflicting events in one frame.
- **Recurrence 2 (2026-10-25, GDD-UI-02 pause menu, found by the review):** the Resume row was placed half inside the lower left quarter of the screen, which the slide stick reads, so in stick mode the tap that resumed also steered Poncho. The plan's unit test checked the rows against the stick's drawn track only, not the area it reads, and passed. Fixed by holding back from the stick any finger that went down while paused or on the title screen, until it lifts.
- **Recurrence:** 2
- **Promoted:** step 5 of the `harness-feature` skill: a new on-screen tap target is checked against the area each touch control reads, not only its drawn box.

## L-033 A visibility was set from state before that frame changed the state

- **Date:** 2026-10-23
- **What went wrong:** The title screen hid the touch buttons with `setHidden(this.title.shown)` at the top of `update()`, but the title closes later in the same `update()`. For one frame after the title went the buttons stayed hidden. CI's phone run read `touch().visible` in that frame right after `boot()` and failed; 15 local runs passed.
- **Root cause:** Drawing and visibility were set in two places, one before and one after the state change, and the playtests read the result a few frames later, so the lag never showed locally.
- **Rule:** Set every visibility that follows a state in the same draw step that runs after the state can change (the `draw*` calls at the end of `update()`). When a test checks that two things change together, read both in one `waitForFunction` callback.
- **Recurrence:** 1
- **Promoted:** no

## L-034 The mutation runner took one test command per file, but each mutant needs its own test

- **Date:** 2026-10-23
- **What went wrong:** L-026 says to run each mutant against the one test that must kill it, alone. `scripts/mutate.mjs` took a single `test` command for the whole file, so for GDD-UI-02 the implementer and then the main session each wrote an ad hoc wrapper that made one mutants file per mutant (57 mutants, unit and playtest).
- **Root cause:** The runner was built before the rule; the rule was added as prose and the tool never caught up.
- **Rule:** Give each mutant its own `test` command in the mutants file (it replaces the file's `test`), so `node scripts/mutate.mjs <file>` runs every mutant against its named test with no wrapper.
- **Recurrence:** 2
- **Promoted:** `scripts/mutate.mjs` (a mutant's own `test` field), and step 7 of the `harness-feature` skill.

## L-035 An "already held" mark that only some readers honoured

- **Date:** 2026-10-25
- **What went wrong:** GDD-UI-02 says a button pressed while paused does nothing until it is released and pressed again. `resumeHeld` marked such buttons as held, but only the rules that read the mark obeyed it (jump, claw, Fuego, the Siete vidas gastadas screen). `move` read the keys and fingers directly, so a Left or Right key or button pressed while paused, or the slide-stick finger that resumed, made Poncho run.
- **Root cause:** The rule was built as a flag on some readers of a button instead of at the input source, and no test played the rule through each reader of the button.
- **Rule:** Apply a "does nothing until released" rule where the input is read (the key or finger itself), so every reader of that button sees it up, and test it for every source of the button (each key, each touch control) and every reader (move, jump, the screens that count presses).
- **Recurrence 2 (2026-10-25, GDD-UI-02):** first in the review of PR #46, for the slide stick; then for the Left and Right keys and touch buttons.
- **Recurrence:** 2
- **Promoted:** step 5 of the `harness-feature` skill (shared buttons).

## L-036 A held-back press was tracked by its key or pointer slot, not by the press

- **Date:** 2026-10-25
- **What went wrong:** The rule "a button pressed while paused does nothing until released" stored the Phaser `Key` object (and first, in PR #46, the pointer id). A key held at the pause and pressed again while paused counted as held since before the pause and ran; a key released and pressed again inside one frame stayed held back. Both were found in review.
- **Root cause:** A press was identified by where it comes from, not by when it went down, so two presses of the same key or pointer slot looked like one.
- **Rule:** Track a press by its source and its down time (`Key.timeDown`, `Pointer.downTime`), and test both a new press of a key held at the pause and a release and press inside one frame.
- **Recurrence 2 (2026-10-25, GDD-UI-02):** the pointer id in PR #46 (caught before merge by keying fingers with `downTime`), then the `Key` object in PR #47.
- **Recurrence:** 2
- **Promoted:** step 5 of the `harness-feature` skill (shared buttons).

## L-037 A latched press stayed pending on a screen where no step runs

- **Date:** 2026-10-25
- **What went wrong:** On the settings screen opened from the title (GDD-UI-02), a quick Left or Right tap stayed latched, because latches are spent only by a simulation step and none runs on the title. When the screen closed, the still-pending latch made the held key look like a new press and started the level. The plan did not cover it; the implementer found it in a playtest.
- **Root cause:** The latch rule (L-006) says "cleared by the step that uses it", and the plan added a screen that reads presses without stepping, so nothing was using and spending them.
- **Rule:** Any screen that reads presses while no step runs (title, pause, settings, menus) spends the latches each frame it reads them (`consumeLatches()` in `PlayScene`), and its plan has a test of a quick tap there followed by leaving the screen.
- **Recurrence:** 1
- **Promoted:** no

## L-038 "Held through a screen" was planned on frame boundaries, not on presses within a frame

- **Date:** 2026-10-25
- **What went wrong:** GDD-UI-02 says a game button held through the title's settings screen is no new press after it. The plan compared the buttons down with the ones down on the frame before, so a Left going down in the same frame that the settings screen was left (or opened and left) still counted as new and started the level. It was found in review of the implementer's report, which named the case as "timing-sensitive by design".
- **Root cause:** The plan stated the rule per frame, and the events within one frame are applied in order, so a screen can open and close between two frame boundaries.
- **Rule:** When a rule depends on a screen being open, decide it on "open at any time in the frame", and plan a unit test where the screen opens or closes in the same frame as the press.
- **Recurrence:** 1
- **Promoted:** no

## L-039 A style mock-up was drawn before asking for the user's own art references

- **Date:** 2026-10-25
- **What went wrong:** For the style guide (GDD-ART-01 to GDD-ART-07) I drew a full mock-up board from the one illustration in the repository: a front-facing Poncho, an orange sky. The user then shared side-view sprite sheets and a desert scene of their own, which changed the view, the proportions, the colours and the resolution (480 x 270 to 1920 x 1080). The first board was thrown away.
- **Root cause:** The feature skill only asks whether the character reference blocks the work. It does not ask whether the user has further references (sprite sheets, scenes, moods) for the specific art about to be drawn.
- **Rule:** Before drawing any new art (a sprite, a tileset, a scene, a UI look), ask the user whether they have reference images for it, and save any they share under `assets/` with a README before drawing.
- **Recurrence:** 1
- **Promoted:** no

## L-040 Source files edited while the playtests ran

- **Date:** 2026-10-25
- **What went wrong:** During the 0.5.0 dependency review (GDD-TEC-07) I edited comments in `src/` while `npm run test:e2e` was running. The Vite dev server reloaded the page, and two playtests failed with "Execution context was destroyed". Both passed alone and in a full re-run, but it cost a second 8-minute run.
- **Root cause:** The playtests run against the live dev server, which reloads on any change under `src/`, and nothing warns that the run is still going.
- **Rule:** Finish every edit under `src/`, `index.html` and `e2e/` before starting `npm run test:e2e`, and make no edits there until it ends. A failure with "Execution context was destroyed" during a run with edits is a reload, so re-run the whole suite rather than counting it as a pass.
- **Recurrence:** 1
- **Promoted:** no

## L-041 A "pressed while paused" test used a button the pause menu also reads

- **Date:** 2026-10-25
- **What went wrong:** The GDD-CTL-02 plan had a playtest press the gamepad's south button while paused and hold it through a resume by start. South is also "pick" on the pause menu, so the press itself picked Resume, and the start press after it paused again. The implementer rewrote the test to hold south through the resume that its own press causes.
- **Root cause:** The plan treated south only as the jump button and did not look up what the paused screen does with it (Space and Z have the same double role).
- **Rule:** Before planning a press made on a menu or pause screen, look up what that screen does with the button (`pauseEvent`, `titleFrame`, `settingsEvent`); for a button that picks (Space, Z, south), the hold-back test holds the press that picked.
- **Recurrence:** 1
- **Promoted:** no

## L-042 A bigger canvas slowed the playtests' frames and exposed timing by polls

- **Date:** 2026-10-25
- **What went wrong:** With the 1920 x 1080 canvas (GDD-ART-01) the headless browser, which has no GPU, drew about 20 to 30 frames a second instead of 60. Phaser's delta smoothing fed the fixed-step loop 1/60 s per frame, so the game ran in slow motion and ten playtests failed. With smoothing off, two still failed: one timed the respawn skip by polling `ticks()`, which lags a few steps per slow frame, and one did slow setup (a CDP session) after putting Poncho in the air, so he landed first.
- **Root cause:** The playtests assumed a fast frame rate: they measured steps from polls and spent real time inside a timed window. Nothing had ever made the frames slow before.
- **Rule:** A playtest times things in simulation steps recorded where they happen (`phaseSince()`, the step counters), never by polling `ticks()` around an event, and does all its slow setup (layout reads, CDP sessions) before it starts anything timed. The game keeps Phaser's delta smoothing off, so the fixed-step loop holds real time on slow frames.
- **Recurrence:** 5
- **Promoted:** .claude/skills/harness-playtest (Writing a scenario: time in simulation steps). Third and fourth times (2026-10-25, GDD-MOV-06): the gamepad "held through the pause" test let real-time waits around the pause run Poncho into a door (found by the review of PR #51), and the Tlacuache screenshot scenario assumed where the Tlacuache had walked before the pause; both now step the game to a known state. An automated check is still open: no cheap rule tells a harmless real-time wait from a timed one. Second time, the same PR, in the full run after merging main: the touch stick speed test waited 300 ms of real time before reading the speed; under the parallel run the game lagged behind and he had not reached top speed. It now waits 18 steps. Fifth time (2026-10-26, GDD-ART-06): the desert backdrop textured the whole screen, the headless frame rate fell from about 29 to 10, and 13 playtests failed on real-time waits and tick polls. The backdrop now textures little (flat bands and a flat mountain foot, small images for the sun, clouds and dither), and the failing tests step the game in the page with `stepUntil` (`e2e/helpers.ts`). New art should be measured for its headless frame rate before the full suite runs.

## L-043 A PR was merged before its deep review reported

- **Date:** 2026-10-25
- **What went wrong:** The user said "Merge" on PR #51 while the `pr-reviewer` agent was still running. CI was green, so I merged. The review came in afterwards with three blocking findings (a flaky gamepad playtest, the Decided 12 x 20 body box not built, stale GDD sentences), which then needed a follow-up PR.
- **Root cause:** CLAUDE.md says to fix the reviewer's blocking findings before telling the user the PR is ready, but I treated green CI as ready and did not tell the user the review was still pending when they asked to merge.
- **Rule:** Before merging, check that the `pr-reviewer` has posted its review on the current head. If it is still running when the user says merge, say so and ask whether to wait; merge without it only when the user says so knowing that.
- **Recurrence:** 1
- **Promoted:** no

## L-044 A bigger body box broke a level route and no test noticed

- **Date:** 2026-10-26
- **What went wrong:** PR #52 grew the body box to 32 px. The Alacrán's platform and the piñata beside it then made one ceiling 48 px above the floor, and on foot Poncho could no longer climb the 2-tile wall from the left. No test or check failed; the dead end was found by looking at the level and was fixed a PR later (PR #53).
- **Root cause:** The level validator (GDD-TEC-04) checks spacing (enemies near respawns), not reachability, and the sandbox tests only covered single spots (a jump at a piñata, the pit hilo), not the route from the spawn through the level.
- **Rule:** A change to the body box, the jump or other movement numbers re-checks every level's main route on foot. The sandbox's route from the spawn past the door and up the 2-tile wall is a test in `src/levels/sandbox.test.ts`; extend it as the route goes further, and add a route test for each new level.
- **Recurrence:** 1
- **Promoted:** no

## L-045 Screenshots reached their state by shortcuts no player takes, and the pictures misled

- **Date:** 2026-10-26
- **What went wrong:** For level 0-1 (then 1-1) the clear-screen shot teleported Poncho straight to the exit, so it read "Hilos 0/50", and the user asked whether hilos were still collected. Collection worked, but nothing tested it in the new level. Then the phone tip shots started the level with Enter, which made the keyboard the device used last: the phone pictures showed keyboard words ("X to claw it") beside outlined touch buttons, and that same slip hid a design hole: the touch outline did not depend on the device in use. Two occurrences in one task, so it is promoted at once.
- **Root cause:** The shot scenarios were written for speed (teleport, `boot()` with Enter on every viewport), and the harness asked them only to assert the state they are named for (L-016), not to get there the way a player on that device would. A shortcut that skips play shows numbers and words that no player sees.
- **Rule:** In a screenshot scenario, start the level the device's way (`start(page, isMobile)` in `e2e/helpers.ts`: a tap on a phone, Enter on a desktop), and reach a screen that shows a count (hilos, lives) after collecting some in play, so the picture shows a count a player could see. A new level gets a test that its pickups are collected in play.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-playtest (Screenshots for visual review)
