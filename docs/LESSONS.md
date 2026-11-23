# Lessons

Append-only. Never rewrite history; add a new entry or update `Recurrence`, `Promoted` and `Area` of an existing one. A `Rule` that a later user decision outdates is updated too, with the decision dated and the old rule kept in brackets (L-053).
`node scripts/check.mjs --lessons` prints every lesson's title and rule; `--lessons input,playtest` only those areas'.

## How to write an entry

Copy this template to the end of the file. IDs count up: `L-001`, `L-002`, ...

```
## L-000 Short title

- **Date:** YYYY-MM-DD
- **Area:** input | tests | playtest | gdd | level | ui | art | process | harness (one or more, comma separated)
- **What went wrong:** what actually happened, factually
- **Root cause:** why it happened (process or knowledge gap, not "careless")
- **Rule:** the concrete behaviour that prevents it
- **Recurrence:** 1
- **Promoted:** no
```

## Promotion rule

When `Recurrence` reaches 2 or more, the lesson must be promoted and `Promoted:` must say where
(`scripts/check.mjs`, a test, a hook, a script, a skill name, or `CLAUDE.md`). `scripts/check.mjs` fails otherwise.
Prefer an automated check over a prose rule.

A lesson that comes back after a promotion to prose moves up to an automated guard. From `Recurrence` 3, `Promoted:`
contains ``Guard: `<path>` `` (its check, test, hook or script, which must exist) or `Guard: none (<why no automated
check can tell the bad case from the good one>)`. `scripts/check.mjs` fails otherwise.

Record each new occurrence just above the `Recurrence` field as
`- **Recurrence N (YYYY-MM-DD, PR #x or GDD ID):** what happened, and why the rule already in place did not stop it.`

A recurrence is counted when the mistake is found after the push (by the `pr-reviewer` on a pushed head, by CI or by the
user), or before it by anything other than the step meant to catch it (by luck, or by the user in the session). One that the
step meant to catch it caught before the commit (the gate, a planned mutant, the `implementer`'s report, the local GDD audit)
is that guard working and is not counted (user, 2026-11-22: "Only after the push"). Counts up to that date hold both kinds. A
mistake that no lesson covers gets its entry either way. `node scripts/check.mjs --lesson L-NNN` prints an entry with its
last three occurrences only.

Entries are never deleted or renumbered and an ID is never reused. A new entry that turns out to repeat an older
lesson stays: bump the older one and set the new one's `Promoted:` to `merged into L-NNN`. `scripts/check.mjs` fails on
a missing ID unless it is listed below (L-046 was folded into L-014 on 2026-10-27, before this rule).

Retired IDs: L-046

## Entries

## L-001 Skill frontmatter validated by regex, not by YAML rules

- **Date:** 2026-10-19
- **Area:** harness
- **What went wrong:** All four skill descriptions contained an unquoted ": " (as in "PONCHO: Siete Vidas"), which is invalid YAML. The harness check passed anyway because it matched the frontmatter with a regex.
- **Root cause:** The check approximated the format instead of applying the rules of the real consumer (the skill loader's YAML parser). A passing self-test only proved the check agreed with itself.
- **Rule:** When a check guards a file format, encode the consumer's actual rules, and prove the check fails on a known-bad sample. Quote any frontmatter value that contains ": " or " #".
- **Recurrence:** 1
- **Promoted:** scripts/check.mjs (checkSkills quoting rule)

## L-002 Section edit sliced through neighbouring GDD sections

- **Date:** 2026-10-19
- **Area:** gdd
- **What went wrong:** Replacing GDD-MOV-06 by slicing from its heading to the next horizontal rule also deleted GDD-MOV-07 and GDD-MOV-08, which sit between them.
- **Root cause:** The end marker I chose was the end of the whole chapter, not the end of the section. Nothing about the edit made me check which IDs the slice contained.
- **Rule:** When editing a GDD section by script, end the slice at the next heading (`^#{1,6} `), and compare the set of GDD IDs before and after the edit. The gate's unknown-reference and backlog checks catch deletions, so always run `node scripts/check.mjs` before committing.
- **Recurrence:** 1
- **Promoted:** no

## L-003 GDD numbers were derived outside the code they describe

- **Date:** 2026-10-19
- **Area:** gdd
- **What went wrong:** The GDD's jump peak, jump distance and minimum hop were calculated with a separate scratch simulation. The real 60 Hz simulation gave a peak about 3 px lower and a minimum hop of 15 px, not 9 px. The first unit tests failed.
- **Root cause:** The numbers came from a different integrator and a different release timing than the shipped code, and nothing tied the GDD to the code until tests existed.
- **Rule:** Derive any GDD number that depends on simulation from the real simulation code through a test, then write the measured value into the GDD. The tuning tests in `src/sim/movement.test.ts` are the source for those figures.
- **Recurrence 2 (2026-11-02, PR #69, GDD-CTL-03, found by the review):** the known limit "a side inset of more than 4 px puts the claw button over the settings rows" was worked out by hand from the layout numbers; it named one button of three and missed the other side's 21 px. The `harness-gdd-update` rule asked for measuring only claims that follow from the simulation or a level, not from a layout. The thresholds are now measured over the real layouts in `src/ui/settingsMenu.test.ts`.
- **Recurrence 3 (2026-11-04, GDD-BOS-02 his defeat, found by the implementer):** my plan picked the crown's speed, gravity and bounce by hand and claimed it would rest before the clear screen 60 steps after the hit; measured over the real fight, a hit high in the air left it resting on step 61 to 76, frozen mid-bounce on the clear screen. The skill rule asks to measure a claim before it goes into the GDD, and it did not reach the plan, where I wrote it as a fact rather than a target. The constants are now tuned against a test that sweeps every height he can be defeated at (worst step 49).
- **Recurrence 4 (2026-11-04, PR #77, found by the review):** my plan put the crown's start "17 px to the side he faces", worked out from the upright drawing; the frame he shows on the floor lies on his back, head on the other side, so the crown popped off his tail. The head's place is now measured from the art frames by a test (`BOSS_ART.headTumble`, `headLying`).
- **Recurrence 5 (2026-11-09, GDD-BOS-01 screen shake, found by the implementer before it wrote code):** the GDD's shake rhythm gave the formula `round(4 * (1 - age / 20))` and, beside it, the sequence "4, 4, 4, 4, 3" and the claim that the tear's shake outlasts the thud 8 steps later, both worked out by hand; the formula gives 4, 4, 4, 3 and 2 px at the thud, which the overlap rule would replace. Fixed by rounding up (`Math.ceil`), with the sequence and the gap now measured in `src/sim/shake.test.ts`. The skill's rule covered it; it was skipped because the numbers came from a formula written in the same sentence, which felt checked.
- **Recurrence 6 (2026-11-09, PR #89, GDD-BOS-01, found by the review):** the GDD listed "3 px for 16 steps when he lands on the floor at his defeat" as a built shake, but in the usual fight he is defeated while stuck in the sand, already on the floor, so it never played; nothing had run the claim over the real 1-4 fight. Fixed by the user's "Shake as he slumps", now tested over the bot's real fight in `src/levels/level1-4.test.ts`.
- **Recurrence 7 (2026-11-09, PR #90, GDD-BOS-03, found by the review):** the GDD's "Her look" frame choices were written from the implementer's report, not read off the code: it called the trolley's 3.6 px wheel radius "3.6 px across" and said she shows her rest look as she rises, where `lookOf` shows her separate rise look. The tests pinned the code; only the prose was wrong.
- **Recurrence 8 (2026-11-10, GDD-PWR-04, found by the implementer before it wrote the level data):** my plan put the sandbox's special piñata at row 3, "48 px above the ledge", but row 3's underside is 32 px above it, his body's height, so his head is flush and no jump can bump it; the intent was row 2. The plan told the implementer to measure the spot first, which caught it; the row was still picked by hand.
- **Recurrence 9 (2026-11-10, PR #93, GDD-WLD-16, GDD-WLD-03, found by the review):** World 3's detailed design took "measured" figures from design agents' scratch tests outside the repository. One was wrong (a jump with no glide "falls in" at 3-1's secret pillar; on the real `step` it crosses, as the PR's own gap table said), and a sight rule of "5 tiles up" contradicted the measured 3-tile jump. The rule asks for a test, and a scratch test nobody else can run passed for one. The skill now says such a figure is written as a target until a test in the repository pins it.
- **Recurrence 10 (2026-11-11, PR #95, GDD-UI-04, found by the review):** the GDD said a 2-tile step from the band's middle ends "8 px outside the band" and offered a 48 px band as the fix; it is 12 px outside, and only 64 px or more stops the move. The camera did pan the measured 12 px in the test; the "8" was a figure from the implementer's report that I copied into the GDD and the open question without checking it against the test's own numbers. The rule covered it; a figure that explains a measured one was not itself held by an assertion.
- **Recurrence 11 (2026-11-11, PR #97, GDD-WLD-16, found by the advisor and by the level's screenshots):** I told the user the drop through 3-1's crumbling floor "lands 3 tiles clear" of the pen's Alacrán before anything had measured it (the pen was then moved and the distance pinned, 53 px box to box), and the GDD said the solid ground past the pit's ledges is on screen from the gallery's edge, which the screenshot scenario showed it is not. The rule covers the GDD; the first claim was made in a message, not the GDD, and the second was a sentence about the camera written while the level's numbers were being measured by tests that do not know the camera.
- **Recurrence 12 (2026-11-12, the sight sweep's commit, GDD-WLD-16, found by the advisor before the commit):** writing the sweep's results into the GDD I added three figures the builder's report did not hold: "1 of its 24 flights" (worked out from the sweep's take-offs), "2 s or more" for a range that starts at 117 steps (1.95 s), and a list of unreached tops that left out the exit's column. They were corrected from the report before the commit. The rule covered it; the slip is writing a sentence around a report from memory of it instead of with it open.
- **Recurrence 13 (2026-11-13, PR #98, found by the re-review):** GDD-WLD-17's sight sentence said every family is "saved by every reaction the sweep tries"; the pinned `SAVES` table shows letting go of jump saves none of the four walking families (they hold no jump). I wrote the summary from the builder's report ("every reaction saves every flight") and not from the table in the test.
- **Recurrence 14 (2026-11-15, PR #100):** I wrote the implementer's measured numbers into the GDD (a 15-step and a 37-step jump window, 12 perch landings) while its tests asserted only "at least 1"; the pr-reviewer caught it. The rule says a measured figure needs a test that pins it, but the plan asked only for a lower bound and a report of the count, and I copied the count into the GDD without checking the assertion.
- **Recurrence 15 (2026-11-18, PR #107, GDD-WLD-18, found by the review):** I wrote the careful bot's longest read wait (816 steps, from the implementer's report at another clock step) and "the longest waits are the Armadillo's read and MP2's round" into the GDD with no assertion behind either; and I tied the rider's 77 Armadillo losses to B1's start clocks 390 to 768, which the review's probe contradicts (the rider reaches L1 at another clock). The wait is now pinned at 817 in `level3-3.bots.test.ts`, and the other two sentences are gone.
- **Recurrence 16 (2026-11-18, PR #108, GDD-WLD-18, found by the review):** I wrote that the secret bot goes "into the hollow, then the tunnel and MP0 up". Its route drops off the hollow onto the shelf right of the pier and never enters the tunnel; only the walker and the shelf test do. I wrote its route from the plan's intent and the new tunnel, not from the bot's run or its pinned marks.
- **Recurrence 17 (2026-11-19, PR #111, GDD-WLD-18, found by the review):** I wrote that the chile is reached from the wall's top "as in 0-1", from a sentence I read in 1-1's section that names 0-1 in passing; I took the level from the sentence, not from the heading above it. The rule already says a claim is checked against its source; a cross-reference to another level is a claim too.
- **Recurrence 18 (2026-11-22, GDD-BOS-04 phase D1, found by the implementer's report before the commit):** my plan put La Catorce's plume half a px ahead of her box's middle, a figure I worked out by eye from the stud's place in the drawing; the stud's middle is 0.75 px ahead, so the plume was built a quarter px off it. The rule covers figures from the simulation and levels' data, and I did not read a place in a drawing as one; now `scripts/art/catorce.test.mjs` works `CATORCE_ART.plume.ahead` out from the drawing's `STUDS`.
- **Recurrence 19 (2026-11-22, PR #120, GDD-BOS-04, found by the review):** I drew phase 3's slam without its 1 px forward and wrote in the GDD that she slams at the screen's edge, so the squash would leave the screen. She turns round on the step she arrives, so forward points into the room; I reasoned from the direction she was running and never ran the fight to see which way she faces on the squash's frames. The approved design's 1 px forward is restored, and the art and sprite tests now check it for every slam look.
- **Recurrence:** 19
- **Promoted:** .claude/skills/harness-gdd-update (Rules: a number or claim that follows from the simulation, a level's data or a layout is measured by the real code in a test). Guard: none (no script can tell a measured claim from one worked out by hand; the implementer measures every planned number in a test before the GDD takes it, which caught recurrence 8; a figure from a scratch test outside the repository stays a target, recurrence 9; since 2026-11-22 the implementer's report says for each figure which test asserts it and whether exactly, and only an exact one goes into the GDD, after recurrences 7, 12, 14 and 15)

## L-004 Debug hook returned the wrong value after landing

- **Date:** 2026-10-19
- **Area:** tests
- **What went wrong:** `peakRise()` reset to 0 on landing, so the e2e jump test, which reads it after landing, always saw 0.
- **Root cause:** The hook's meaning ("current jump so far") was not the one the test needed ("last completed jump"), and its doc comment did not pin it down.
- **Rule:** Write the semantics of a debug hook in its doc comment before the first test uses it, and test the hook after the action it measures has finished.
- **Recurrence:** 1
- **Promoted:** no

## L-005 Stack versions chosen from memory, not from the registry

- **Date:** 2026-10-19
- **Area:** process
- **What went wrong:** The stack was set up on Phaser 3 and a TypeScript 5 toolchain while Phaser 4 and TypeScript 7 were already the latest releases. The user had asked for the state of the art and had to ask for it explicitly.
- **Root cause:** Versions were picked from training knowledge instead of checking the registry, and the intent behind "stack" was not made explicit (recommended versus latest).
- **Rule:** Before choosing or pinning any dependency, run `npm view <pkg> version` (and check peer ranges and release notes for majors). Default to the latest stable unless a written blocker says otherwise (GDD-TEC-07).
- **Recurrence:** 1
- **Promoted:** no

## L-006 Phaser key events and polling both misbehave on sub-frame input

- **Date:** 2026-10-19
- **Area:** input
- **What went wrong:** The HUD's dev key used `keydown-L` event handlers. When three presses landed in one frame (as Playwright's instant `press()` does), Phaser 4.2.1 ran the handler up to seven times, so lives dropped by 6 or 7 instead of 3. Switching to `JustDown` polling then missed taps that started and ended inside one frame, because `Key.onUp` clears the just-pressed flag.
- **Root cause:** Keyboard input was handled through the engine's convenience layer without checking how it treats several events in one frame. The e2e test only pressed one key once, so it passed; a screenshot taken after three quick presses exposed it.
- **Rule:** For game input, test taps that are quick and repeated, and test with a realistic key hold time. Do not rely on `keydown-X` event handlers for game logic. Poll key state per fixed step. For the jump button (GDD-CTL-04, GDD-MOV-03) a press shorter than one frame must still count, so latch presses from raw key events before relying on polling.
- **Recurrence 3 (2026-10-22, PR #37):** the pause keys (GDD-UI-02) used Phaser `Key` `down` events. A probe of 40 real presses showed one press firing `down` twice in most runs, toggling the pause straight back; it surfaced as a CI flake in `e2e/pause.spec.ts`. Pause now reads raw `keydown` events by `keyCode` (the key's label, so the P key pauses on Dvorak too), auto-repeat ignored. A playtest of 40 real presses fails with the old wiring only in some runs (about one in four), so the deterministic guard is a gate check: `scripts/check.mjs` (`key-down-handlers`) allows a Phaser key-down event (`'down'`, `Events.DOWN`, `'keydown-X'`) in `src/` only in the one-line form that presses a latch, so a multi-line, named or `once` handler fails by default. Gate-check mutants run through `scripts/mutate.mjs` are judged correctly: the runner sets `PONCHO_MUTATING` so `no-mutation` does not fail on the run's own marker.
- **Recurrence:** 3
- **Promoted:** `scripts/check.mjs` (`key-down-handlers`, Recurrence 3); before that (second time, PR #27: the claw press, which needs an edge, was polled the same way and a tap inside one frame was lost; the reviewer measured 0 swings of 8) `src/ui/inputLatch.ts` (jump and claw, keyboard and touch, are latched from raw events and cleared by the step that uses them), `e2e/subframe.spec.ts` (taps dispatched inside one task for X, J, Space and both touch buttons), and a rule in CLAUDE.md. Guard: `scripts/check.mjs` (`key-down-handlers`).

## L-007 A visible change was built and merged without the user seeing it

- **Date:** 2026-10-19
- **Area:** process
- **What went wrong:** The lives HUD (PR #3) was built, reviewed and merged with the HUD checked only by screenshots that Claude looked at. The user never saw the images and had to ask for them.
- **Root cause:** The harness had no step for visual approval. The playtest skill said to look at screenshots, but not to show them to the person who decides whether the result is good.
- **Rule:** Anything the player can see is shown to the user, in the session, as desktop and phone screenshots, and approved before the PR is marked ready for review, a draft until then (user, 2026-11-01; before that, approved before the PR opened) (CLAUDE.md "Visible changes need the user's approval before the PR is marked ready"). Approved images are committed under `docs/screenshots/` and embedded in the PR.
- **Recurrence 2 (2026-11-09, PR #89, GDD-BOS-01, found by the review):** the screen shake was planned and opened with "no screenshots: a shake cannot be seen in a still frame"; a still frame shows the world 4 px off, and the user's first look at the frames changed the design ("Shake everything").
- **Recurrence:** 2
- **Promoted:** scripts/pr-screenshots.mjs (CI warning), pr-reviewer subagent (blocking finding), CLAUDE.md, and since recurrence 2 .claude/skills/harness-feature (step 5: motion counts as visible; plan screenshots of a motion's extreme frames)

## L-008 The no-model-names check missed a bare model alias

- **Date:** 2026-10-19
- **Area:** harness
- **What went wrong:** The new review subagent was first written with its `model` field set to a model alias. The rule says repository files do not name models, but the check only looked for names followed by a version number, so the gate passed. It was found by rereading the file, not by the harness.
- **Root cause:** The check encoded one spelling of the rule (names with a version) instead of the rule itself, and no check covered agent files at all.
- **Rule:** When a check guards a rule, test it against every spelling the rule is meant to forbid, including config fields. Agent files must use `model: inherit` (enforced in `scripts/check.mjs`).
- **Recurrence 2 (2026-10-31, harness audit):** `scripts/hooks/gate-pipe.mjs` (L-012) looked for the text `scripts/check.mjs` and then `git commit`, so `npm run check | tail -1; git commit` and `git -C <dir> commit` went through, while `echo scripts/check.mjs; echo git commit`, a here-document quoting both, `&> log &&` and `set -o pipefail`, which L-012's rule allows, were denied. The hook now matches a run of the gate and a commit with options, and its tests hold each spelling and each harmless mention.
- **Recurrence 3 (2026-11-01, harness audit U3, U5, U9):** the new `stale-main.mjs` and `before-merge.mjs` hooks first took `git push` and `gh pr merge` inside a commit message's here-document or a quoted string for real commands, the same flaw just fixed in `gate-pipe.mjs`; their tests held an `echo` mention but no here-document. Found by the verification before the PR. The rule in `docs/HARNESS.md` asked for "a mention it must let through" without saying which.
- **Recurrence 4 (2026-11-01, PR #64, found by the review):** the hooks still encoded single spellings: `gate-pipe.mjs` let a here-document piped into a shell (`cat <<'EOF' | bash`) and `npm --silent run check` through, `before-merge.mjs` missed the REST merge `gh api -X PUT .../pulls/<n>/merge`, and the new here-document rule in `scripts/check.mjs` skipped a hook wired under `^Bash$` or `Bash|Write`. The guard from recurrence 3 checks that a test holds a here-document, not which spellings the code reads.
- **Recurrence 5 (2026-11-01, PR #64, found by the re-review):** two more spellings got past the fixes of recurrence 4: a quoted merge path (`gh api -X PUT 'repos/o/r/pulls/3/merge'`), emptied with the quoted text, and a node option before the gate (`node --no-warnings scripts/check.mjs`), which `main`'s hook had caught. Each hook test now holds them; the reviewer's probes of each hook's spellings are the backstop.
- **Recurrence 6 (2026-11-01, PR #64, found by the next re-review):** the fix for the quoted path unquoted single words in a pass of its own before quoted text was emptied, so a stray quote left by `tr -d '"'` or `"it's"` paired with a later quote and hid a real `gh pr merge`. The hook now handles every quoted string in one pass, and its test holds both commands and a double-quoted path.
- **Recurrence 7 (2026-11-01, PR #64, found by the next re-review):** keeping a quoted single word let an operator inside it (`--jq '.merged|tostring'`, `-f commit_title='R&D'`) cut the REST merge pattern short, so three real merges asked no question; quotes in a `#` comment or after a backslash could still pair and hide one. Each fix to how quotes were read opened another gap, so `before-merge.mjs` no longer empties quoted text: it reads the command as written and asks when unsure, and `docs/HARNESS.md` (Adding a check) makes that the rule for every hook that answers `ask`.
- **Recurrence 8 (2026-11-01, PR #64, found by the next re-review):** once quoted text was read as written, a git option whose quoted value holds a space (`-c core.sshCommand="ssh -i k"`, `--git-dir="/a b"`) hid the push, and a `.sh` file name on a here-document's line counted as a shell reading it. `scripts/hooks/command-text.mjs` now reads an option as one shell word with its quoted parts and a shell only as a command word, and `gate-pipe.mjs` reads commands through it too.
- **Recurrence 9 (2026-11-01, PR #64, found by the next re-review):** the shell-word fix required a value after an env assignment, so `GIT_TRACE= git push` was missed, and the command-word shell pattern did not allow a redirect right after the shell (`cat <<EOF | bash>log`), so all three hooks lost that body; two parts of the new patterns had no test. Both are fixed and each part of the patterns has a test its mutant fails.
- **Recurrence 10 (2026-11-16, PR #102, found by its review):** the new `before-implementer.mjs` hook read the plan path with a pattern that missed `./.plans/x.md`, a bold or bracketed path and a plan in a subfolder, and it let a launch through when a relative path could not be read from the hook's working directory. Its tests named three spellings, not every one a prompt can use. The hook now takes any path with a `.plans` folder, reads a relative one under the input's `cwd`, and denies a plan it cannot read, with a test for each spelling the review found.
- **Recurrence 11 (2026-11-22, PR #119, GDD-TEC-09, found by the pr-reviewer):** the new `sim-determinism` check matched one spelling per forbidden call (`Math.sin(`), so a destructured, aliased, bracketed or optional-chained `Math`, a call on a continuation line starting with `*`, code after a leading block comment, and `crypto` all passed, and an ordinary GDD citation acted as its exemption. The plan listed one test per forbidden name and none per spelling, and the main session checked the plan's tests, not the rule against its family of spellings.
- **Recurrence 12 (2026-11-22, PR #119, GDD-TEC-09, found by the re-review):** the scanner written to fix the last occurrence read a division after a non-null `!` (`ys[i]! / 2 + Math.sin(a) / 3`) as a regular expression and blanked the call between the two slashes, and three of its clauses had no test. The fix was tested against the spellings the review had listed, not against the code the three folders hold, where `xs[i]!` stands 230 times.
- **Recurrence 13 (2026-11-22, PR #119, GDD-TEC-09, found by the third review):** the patched scanner still read a division after a property named like a keyword (`FADE.in / 2 + Math.sin(a) / 3`) as a regular expression. Three rounds patched a hand-written scanner for a question (division or regular expression) that only a parser answers; the check now walks the syntax tree of the parser Vite already ships (`parseSync`), and has no scanner. A check over source code reads it with a real parser when one is installed, never with patterns over lines.
- **Recurrence:** 13
- **Promoted:** scripts/check.mjs (no-model-ids now catches a model alias in a `model` field, checkAgents requires `inherit`); the `scripts/hooks/gate-pipe.mjs` tests (each spelling of the gate and of a commit, and mentions that must pass); `docs/HARNESS.md` (Adding a check: a hook is tested with every spelling it must catch and a mention it must let through). Guard: `scripts/check.mjs` (`claude-settings`, since recurrence 3: the test of a hook that reads shell commands must hold a here-document it lets through).

## L-009 The GitHub tool mangled image URLs in the PR description

- **Date:** 2026-10-20
- **Area:** process
- **What went wrong:** The six approved screenshots were written into the PR description as markdown images, but the stored description had each URL wrapped in a growing number of backticks, so none rendered. The `pr-reviewer` agent caught it as a blocking finding; I had not read the description back.
- **Root cause:** The create and update tools rewrite URLs in the body in an inconsistent way (the first one or two links survive, later ones get wrapped; the `?raw=true` form, reference-style links and HTML image tags were also affected). I trusted what I sent instead of checking what was stored.
- **Rule:** After creating or editing a PR description, read it back with the GitHub tool and check every link. Embed a single overview image per PR, as a markdown image with a `/raw/<commit sha>/` path and no query string, and list the other files as plain links. The reviewer treats unrendered images as missing screenshots.
- **Recurrence:** 1
- **Promoted:** CLAUDE.md, PR template and the pr-reviewer agent

## L-010 A test that could not fail

- **Date:** 2026-10-20
- **Area:** tests
- **What went wrong:** The held-jump test for the respawn rule (PR #7) passed with the rule removed, because the input it fed never exercised the rule. The skip window was also one step late. The `pr-reviewer` agent found both by mutating the code; my own run did not. It happened again in PR #9 (the rule "touching a used ofrenda again moves the checkpoint" had no test that could fail, because my own mutations covered other rules) and in PR #11 (the pitch test read its notes from the code under test), and in PR #24 (the item wall-turn snap and the item's solid-world argument had no test that could fail).
- **Root cause:** I wrote the test, saw it green and stopped. A green test only proves the code and the test agree, not that the test can detect the rule being broken.
- **Rule:** After writing a test for a rule, break the code (remove the rule, move a threshold by one) and confirm the test fails, then restore. Do it for every new rule or bullet in the GDD diff, not a sample, and write the expected values from the GDD into the test instead of reading them from the code under test. The `feature` skill has this step and the `pr-reviewer` agent does it on every PR.
- **Recurrence 9 (2026-10-26, PR #55, GDD-ART-06, found by the review):** the sun and mountain positions the scene hands to Phaser had no test, though the mutation step already named such numbers; the scene now reports them and a playtest pins them.
- **Recurrence 10 (2026-11-01, GDD-CTL-03 Button opacity):** the plan scaled nine alphas in `TouchControls` but gave one mutant (the outline), and the implementer added no others; three of the nine (the slide stick and the Fuego icon, drawn only in stick mode and in Fuego) then survived until a new playtest drew them. The step says each code change gets its own mutant, but I counted the wrapper as one change, not one per call site.
- **Recurrence 11 (2026-11-01, PR #67, GDD-CTL-03, found by the review):** the clause "a tutorial tip's dashed outline round a button is not changed" had no test that could fail; `touch()` did not report the outline's alpha. It now does, and a phone playtest at Low checks it stays 1.
- **Recurrence 12 (2026-11-01, PR #67, re-review):** the fix for recurrence 11 logged the alpha it meant to draw in a variable beside the `lineStyle` call, so a mutant on the call itself still survived; the hook now reads the alpha back from the Graphics command buffer, what Phaser actually holds. (This entry was meant for PR #67, but the command that wrote it was blocked by the L-012 hook and the rerun left it out.)
- **Recurrence 13 (2026-11-01, GDD-CTL-03 mirrored layout):** the implementer added a guard the plan did not list (`setLayout` relays out only with touch) and gave it no mutant; it survived until the main session's check found it and a desktop assertion was added. The rule covers the plan's changes, and the step 7 diff read is where an unplanned change gets its mutant.
- **Recurrence 14 (2026-11-02, PR #69, GDD-CTL-03 safe-area insets, found by the review):** the "insets unchanged" check compared four sides with `&&`, and the plan gave it one mutant (compare only `left`); dropping the `right` comparison survived every test, since no test changed the right side alone. The step names clauses of the GDD text and call sites of a helper, not the clauses of one condition. The check is now a pure `sameInsets` with a unit case per side, and the feature skill's mutation step names conditions over several fields.
- **Recurrence 15 (2026-11-02, PR #71, GDD-MOV-09 sand slopes, found by the review):** the taco's "a step up into a ceiling is not taken" guard reverts two fields (`x = fromX; y = fromY;`); the plan mutated the guard into the flush beside it, but not each revert, and the test accepted a range of turn positions, so deleting the revert, or only its `y`, survived. The step named conditions over several fields, not reverts of several; it now names both, and a test over a 45-degree ramp under a low ceiling pins the `y` revert.
- **Recurrence 16 (2026-11-03, PR #72, GDD-WLD-08 Start follows the run, found by the review):** `worldAtAfter`'s `event === 'clear' && entry.next !== undefined` had one mutant (the game-over branch writing nothing), and its only game-over test used 1-2, which names no next level, so dropping the `event` clause survived. The skill step already names conditions over several fields; my own addendum plan did not apply it to this `&&`. A game over in 1-1 is now tested in a unit test and in the playtest's saved `worldAt`.
- **Recurrence 17 (2026-11-03, PR #73, the `gdd-one-version` gate check of L-057, found by the review):** the check was proved to fail on one bad GDD, but I ran no mutants on its own logic; its fake git answered every `merge-base` call, so asking for `merge-base HEAD HEAD` (which turns the check off) survived the unit tests. The mutation step lives in `harness-feature`, and a retro's new guard does not go through that skill; `harness-retro` step 3 and `docs/HARNESS.md` (Adding a check) now ask for one mutant per condition and per argument inside a new guard's module, and the fake git answers only `merge-base origin/main HEAD` (13 mutants, all caught).
- **Recurrence 18 (2026-11-04, PR #75, Don Zopilote's art, found by the review):** the crown rule ("a point for each hit he has left") is drawn in 11 looks at three crowns, but its art test counted the crown's gold in the flap frame only, so a mutant giving every hurt frame three points survived. The skill step already says a helper used at several sites needs a test that reaches every site; the plan applied it to the pose code, not to the drawing's looks. The test now covers every look that shows his colours, and its mutant is caught.
- **Recurrence 19 (2026-11-04, PR #77, found by the review):** the crown's floor check `y < def.floor` had no mutant for its boundary (`<=`), and two reachable hit heights put the crown exactly on the floor, where the mutant moved the bounce a step later. A test now pins a landing exactly on the floor.
- **Recurrence 20 (2026-11-04, PR #78, World 2's awnings, found by the review):** the `onAwning &&` guard that keeps a torn awning whole on a step a stomp wins had no test that could fail; the stream's mutants covered the stomp's bounce and the chain, not this one clause of the run's tear, and the main session's diff read missed it in a large merge. A test in `src/sim/awning.test.ts` now pins it, and the reviewer's mutant is killed.
- **Recurrence 21 (2026-11-09, PR #90, GDD-BOS-03, found by the review):** the scene placed the trolley and the rope as images, and no test read back where: drawing the trolley 8 px off the cable or the rope 8 px beside her tip stayed green, because `estrellaDrawn()` reported the trolley's x and frame and the rope's length but not the trolley's y or the rope's x and top. Fixed by reading them back and asserting them in the per-mode e2e test (3 mutants killed).
- **Recurrence 22 (2026-11-09, PR #90, GDD-BOS-03, found by the re-review):** the fix for the trolley's and rope's places read back each image's `x`/`y`, its origin, as its drawn top edge, so changing an image's `setOrigin` moved the picture and the test stayed green; it now reads `getTopCenter()`, and the two origin mutants are killed. A read-back of where something is drawn reads the drawn edge (`getTopCenter`, `getBounds`), never the anchor. The next re-review found the same object's `trolleyX` still read the anchor (an origin of `(0, 0)` drew the trolley off the rope's line, all green): the fix had been applied to the fields the review named, not to every field of the read-back; `trolleyX` now reads `getTopCenter().x` too. The re-review after that found the tejocotes' read-back in the same function still at the anchor; that fix swept every place field of the read-back at once (her sprite and the tejocotes now from `getCenter()`), with an origin mutant for each image. The review after that swept every drawn property, not only places: the read-back gave no drawn size and skipped the cable, so doubling an image's `setScale` or moving the cable stayed green. `estrellaDrawn()` now reports each image's `displayWidth`/`displayHeight` and the cable's `getTopLeft()`/`getBottomRight()`, the tejocotes their `getBounds()`, with a mutant for each. A read-back covers every image the function draws, and for each its place and its size. The next review found the rope's drawn length reported but never asserted (only a shots scenario, which CI does not run, checked it): a field the read-back reports needs an assertion in `test:e2e`, and the hang check now compares it. The review after that found visibility unread: the rope's length came from a local variable, not `visible`, and hidden tejocotes were still reported, so hiding either stayed green. A read-back reports what is shown (`visible`) as well as its place and size. The next review found the rope's "snapped" null still taken from the pose, so a rope left drawn after her defeat stayed green; it now comes from the image too, and the defeat test waits for no rope drawn.
- **Recurrence 23 (2026-11-10, PR #91, GDD-PWR-04, found by the review):** the run step reads the Chile Fantasma's local `fantasma` (which counts the step he eats it) in two places, the hit guards and the touch defeat; the plan gave the guards' read a mutant ("protection reads run.fantasma") but not the touch defeat's, so changing that read to `run.fantasma` survived. It mattered because the enemy-hit guard had been deleted under L-025 on the strength of the touch defeat: a Poncho eating the pepper on an Alacrán would lose a life. The skill's one-mutant-per-call-site rule names helpers wrapped round sites, not a shared local read at several sites.
- **Recurrence 24 (2026-11-12, PR #98, found by the review):** two "as built" clauses of the Armadillo (a rise of more than 4 px is a wall; it keeps its facing with Poncho exactly at its middle) and the validator's "a roll either way" had no test that failed without them: the first two were written into the GDD from the builder's report after its mutant run, and every validator fixture had its cart to the right. Each got a test and a mutant; a clause added to the GDD from a report needs its mutant like a planned one.
- **Recurrence 25 (2026-11-15, PR #100):** a GDD sentence I added from the implementer's report (a defeat on the telegraph's last step leaves the cart rolling on empty) had no test and no mutant; the pr-reviewer caught it. A behaviour found in a report and written into the GDD is a new rule too, and it needs its own test before the commit.
- **Recurrence 26 (2026-11-15, PR #100, found by the re-review):** the debug hook `enemySheetsLoaded` filtered the sheets by `sheetsFor(this.level)`, the very list the preload loads from, so three "not loaded here" assertions could never fail, and loading every sheet in every level stayed green. It now filters every sheet the scene knows (`ENEMY_PNGS`), and that mutant is caught by both tests. The plan's mutant for `sheetsFor` hit its unit test only, not the scene's use of it; a debug read-back must not share the code path it checks.
- **Recurrence 27 (2026-11-15, PR #101, found by its review):** I widened `scripts/art-lineup.mjs` with mutants for its two pure helpers, but its new argument parsing in `main()` had no test. Two mutants stayed green. Leaving the output out of the skill's own Poncho example overwrote `assets/sprites/poncho.png` with no error. The parsing is now a pure `parseArgs` with tests. It refuses an output that is an input, inside an input folder or under `assets/`, with a mutant for each condition. Code left in `main()` is code no test reaches.
- **Recurrence 28 (2026-11-15, PR #101, found by its re-review):** the new path guard had a mutant for each condition, but no case tested the edges of the conditions. A name that only starts with dots (`..l.png`) inside an input folder passed as outside. An upper-case `.PNG` had no test. A `startsWith('/')` clause could never be true on POSIX. The guard is now a pure `isWithin` (`..` or `..` plus the separator), with cases for the folder itself, a dot name, a parent, a sibling and a look-alike name. The clauses that can never be true are removed (L-025). The output is also kept out of the whole repository, not only `assets/`. A path or string rule needs edge cases as well as one mutant per condition.
- **Recurrence 29 (2026-11-16, PR #103, found by its review):** validator rule (h) had no test on its band's 64 px edge nor on the camera's top clamp, so `>` to `>=` and dropping the clamp stayed green. The plan's mutant list named neither, because it listed the rule's ideas, not each comparison and clamp in the code that was written.
- **Recurrence 30 (2026-11-17, PR #103, found by its re-review):** after "every button", no fixture overlapped only the claw or only the pause button, and the lower clamp of a moving platform's path fraction had no case where it mattered, so skipping either button or the clamp stayed green. The one-fixture-per-member rule (L-080) was promoted in the same commit but not applied to the members the fix itself added. Each now has its fixture and mutant.
- **Recurrence 31 (2026-11-19, PR #110, GDD-BOS-04, found by the review):** two clauses the plan wrote as prose had no mutant: "a hit on her is settled before her touch" (her touch read from her state before the hit passed every test) and a cart broken on her keeping its return count (dropping `empty` passed every test, so it came back after 203 steps, not 180). The skill step asks for one mutant per clause; the plan's mutant list was built from its test list, not from the sentences of the plan's own rules.
- **Recurrence 32 (2026-11-20, PR #116, the sight sweep's jump reaction, GDD-WLD-03, found by the pr-reviewer):** the reaction's first part, "the way he flew held" until the press, had no mutant: the plan's mutant 4 took the jump's `move` only, and the press's let-go had one, but the held direction before the press did not, and nothing pinned where he landed. A mutant holding nothing there survived every test; "presses jump anew" now pins his speed and x at the landing. The skill step already says to split each clause; the plan split the press, not the steps before it.
- **Recurrence 33 (2026-11-21, GDD-WLD-18 register, found by the implementer):** the plan gave the new reaction-name test three clauses and no assertion for the fourth rule it stated, "ride losses name none"; a ride family given a reaction would pass and be ignored. The step names each clause, but the plan's test list was written from the code it extends, not from its own rule text; the main session added the assertion and its mutant.
- **Recurrence 34 (2026-11-22, PR #119, GDD-TEC-09, found by the pr-reviewer):** six thresholds of `src/sim/detmath.ts` (the pi/4 and 3 pi/4 bounds, two bounds of the cosine kernel, a shift and a comparison of the range reduction) could move by one with the tests green. The plan's mutants changed constants and dropped branches, and none moved a comparison's bound or flipped `<` and `<=`, though this skill already asks for "move a threshold by one" per clause.
- **Recurrence 35 (2026-11-22, PR #119, GDD-TEC-09, found by the fourth review):** five clauses of the rewritten check had no test: which line the marker exempts when an expression runs over two lines, where a `new Date` is placed, the line above a marker, and two clauses that only shape the error's wording. The implementer's mutants took each condition away and never changed which position a line is counted from; a clause that picks one of two positions needs a fixture where the two are on different lines.
- **Recurrence 36 (2026-11-22, PR #121, GDD-TEC-10, found by the pr-reviewer):** the server's ledger, season rule, config and store each had a bound nothing tested: the last bought life (`bought > 0` to `> 1`), the clamp of the free lives left, the year carry of a season, the store's `commit`, the config's minimums. The plan's mutants, which a planning agent had run, removed rules and never moved a bound, three days after the same finding on PR #119; the main session launched the plan without adding boundary cases to it.
- **Recurrence 37 (2026-11-22, PR #121, GDD-TEC-10, found by the re-review):** the season rule's minutes, seconds and milliseconds had no test that could fail: every fixture started a season at midnight, so dropping a part of the time of day changed nothing. A rule that carries several fields over is tested with a fixture where each field is not zero.
- **Recurrence 38 (2026-11-23, PR #125, found by the pr-reviewer):** five rules of the mutant suggestions and of the two fixes beside them had no test that could fail: where the operator is searched from, which line an operand of several lines is taken by, the name's white space, a question number of two digits, a second written comma. None is a bound or a clause, so the new command could not list them; each was a rule with a simpler neighbour (L-028) and no fixture where the two differ.
- **Recurrence:** 38
- **Promoted:** .claude/skills/harness-feature (mutation step, now one mutation per new GDD rule; a condition over several fields, or a revert of several, is one change per field), .claude/skills/harness-retro (step 3: a new guard's own mutants), pr-reviewer subagent. (Fifth time, the Tlacuache: two play-dead tests read the 2.0 s from `TLACUACHE.playDeadSteps`, so moving it did not fail them; the mutation step caught it before the commit, and the tests now say 119 and 120 steps.) (Sixth time, the same PR: the reviewer found two Tlacuache rules with no test that could fail, the claw half of "the claw or a fireball wins over a first stomp" and the wake-up twitch. My mutations went bullet by bullet and missed clauses; the feature skill now asks for one mutation per clause.) (Seventh time, PR #35: the clause "so it always starts at its normal size" was tested only for the first drop to one; resetting the start when the lives leave one had no test. The start tracking moved into a pure helper with unit tests for each path.) (Eighth time, PR #44: the hilo playback rate was computed in `PlayScene`, and the plan left the scene out of the mutants, so the reviewer could set the rate to 1 with every test green. The rate moved into a pure helper (`noteRate`) and the scene logs the rate it passes, checked in e2e; the feature skill now names numbers computed in a scene.) Since 2026-11-23 `node scripts/mutate.mjs --suggest` lists a mutant for every bound and every `&&` or `||` operand on the changed lines, the kind most often forgotten (recurrences 14 to 16, 19, 28 to 30, 34 and 36); it cannot tell which GDD clause has no code or no test at all, which stays with the plan and the `pr-reviewer`. Guard: `scripts/mutant-suggest.mjs`

## L-011 Generated audio was never listened to or measured

- **Date:** 2026-10-20
- **Area:** art
- **What went wrong:** The first two ofrenda sound files were almost silent: an attack ramp made the envelope exactly 0 at the first sample, which ended the tone loop at once, so only a 12 ms click was written. I checked the length and peak level, sent the files, and the user had to tell me they sounded wrong.
- **Root cause:** I verified that the generator ran and the file had the right size, not what was inside it. A peak level can come from one click, and I cannot hear.
- **Rule:** For any generated asset (audio, images), measure the output itself before showing it: non-silent samples over time, the expected frequencies, decay. Pin the expected values from the GDD in a test (`scripts/audio/ofrenda.test.mjs`), not values read back from the code under test.
- **Recurrence:** 1
- **Promoted:** scripts/audio/ofrenda.test.mjs (decoded-energy and pitch tests)

## L-012 A failing gate was committed and pushed

- **Date:** 2026-10-20
- **Area:** process
- **What went wrong:** For the touch controls I ran `node scripts/check.mjs | tail -1; git commit ...`. The gate had failed (a TypeScript error: `toSorted` is not in the ES2022 lib), but the pipe kept only `tail`'s exit status and `;` ignores failures, so the commit and push went ahead. I saw "1 problem(s) found" in the output and fixed it in a second commit before opening the PR, so nothing broke, but CLAUDE.md says the gate must pass before every commit.
- **Root cause:** I chained the commit after a pipeline that hides the gate's exit code, and read the result only after the commit had happened.
- **Rule:** Run the gate on its own and check its exit code, then commit: `node scripts/check.mjs && git commit ...` with no pipe to `tail` (or `set -o pipefail`). If the output is needed, read it from a separate run.
- **Recurrence:** 3
- **Promoted:** .claude/skills/harness-feature (Gate step), then, after the second time, `scripts/hooks/gate-pipe.mjs`: a PreToolUse hook that denies a shell command committing after the gate with anything but `&&` between them. Second time (2026-10-25, GDD-ART-02): `node scripts/check.mjs 2>&1 | tail -1 && git commit` committed a lessons-format failure; the next commit fixed it. The rule stands: never pipe the gate. Third time (2026-11-04, World 2): `node scripts/check.mjs 2>&1 | tail -2 && GIT_EDITOR=true git cherry-pick --continue` committed a merge whose gate failed (two tests that listed every level missed the World 2 labs); the commit was amended before the push. The hook let it through because it knew only `git commit`; it now treats `cherry-pick`, `merge`, `revert`, `am` and `rebase` as commits too. Guard: `scripts/hooks/gate-pipe.mjs`.

## L-013 Sentences the new feature made false were left in the GDD

- **Date:** 2026-10-22
- **Area:** gdd
- **What went wrong:** In PR #29 (the Alacrán) the GDD still said "nothing is hurt by a fireball yet" and "not built yet: enemies" after the feature made both false, and the reviewer called it blocking. In PR #30 (the Zopilote) GDD-CMB-03 still said the knockback was built "for spike hits and the Alacrán". The changelog named those sections as touched, but I had edited only the section I was working in. Again in PR #43, GDD-TEC-04: the PR deleted the sandbox's GDD-ENM-01 test, and GDD-ENM-02 still said "checked by `src/levels/sandbox.test.ts`" for the cactus buddy and the Tlacuache. The hunt searched for the rule's words, not for the path of the test it removed.
- **Root cause:** I wrote the new text and never searched for the old text it contradicts. Phrases like "not built yet", "so far", "only", "yet" and the names of the neighbouring features sit in other sections and go stale silently.
- **Rule:** After editing the GDD for a feature, search `docs/GDD.md` for the feature's neighbours (the IDs and names it touches) and for "yet", "so far", "only", "not built" and "built for", and fix every sentence the feature falsifies. Every section named in the changelog line must actually be in the diff.
- **Recurrence 4 (2026-10-25, PR #51, found by the review):** sentences the Poncho sprite made false stayed in GDD-LIFE-02, GDD-ART-02 and GDD-ART-04 (fixed in GDD 0.5.5). Logged late, from the commits: the retro of that fix bumped only L-012.
- **Recurrence 5 (2026-10-26, PR #54, found by the review):** GDD-LOOP-02 still said every level takes 2 to 4 minutes, against the short tutorial. Logged late, as recurrence 4.
- **Recurrence 6 (2026-10-27, PR #57, found by the review):** after 1-1 was added, GDD-LIFE-05 still said there was no second level yet, GDD-TEC-04 listed only 0-1 and the sandbox, and the changelog line named GDD-WLD-03 instead of GDD-TEC-04. Logged late, as recurrence 4.
- **Recurrence 7 (2026-10-29, PR #58, found by the review):** after the Tutorial row, GDD-UI-02, the section the PR edited, still described the title screen and "Quit to title" as before. Logged late, as recurrence 4.
- **Recurrence 8 (2026-10-31, PR #62, found by the review):** GDD-CTL-02 listed the menus without the new results menu. Two of these five were lists of a family the new member never joined (PRs #57 and #62) and one sat inside the section the PR edited (PR #58); none was counted when it happened, since the retro ran before the review.
- **Recurrence 9 (2026-11-01, PR #68, found by the review):** after the mirrored layout, GDD-CTL-03's slide stick and claw bullets still said Jump stays on the right, the switch sits above the left thumb zone and the claw sits left of Jump. The hunt searched for the stick's quarter but not for the words a mirror makes false: the sides ("left", "right") in the section the change edits.
- **Recurrence 10 (2026-11-03, PR #74, GDD-BOS-02, found by the review):** after the boss arena 1-4 joined World 1, GDD-UI-05 still said "1-1, 1-2 and 1-3 have neither" (tips nor placeholder lines) and GDD-LIFE-03's veladora list named no boss arena; the backlog rows of PWR-03, TEC-04, CMB-01, CMB-03 and UI-01 still described the game without him. The skill's family-list search was run, but by a regex that demanded 90 characters before each match, so a list near the start of a line never showed; and `harness-gdd-update` step 1 already asked for the touched IDs' backlog rows to be searched, but I did not do it. Both skills' family-list search now names `docs/BACKLOG.md` and a plain pattern with no context length.
- **Recurrence 11 (2026-11-04, PR #77, found by the review):** the GDD still said "Only his lowered wings reach below his box's bottom" after the tumbling frames that also reach below it were added; the hunt for "only" was skipped because the sentence sat in a paragraph the PR edited elsewhere. Fixed in 02fae7d; the art test already pinned the frames' depths, so the code was right and only the prose went stale.
- **Recurrence 12 (2026-11-08, PR #80, GDD-ART-04, found by the review):** after Poncho's animations were built, GDD-CMB-02 still said "Not built yet: the swing pose" a sentence after describing it, GDD-MOV-05 still gave an 80 ms landing squash on every landing, GDD-ART-04's Built bullet still said five frames of 160 x 160, and the backlog rows of CMB-02 and MOV-05 still said "pending". The hunt searched for "placeholder" and the frame sizes but not for "Not built yet" and "pending" across the sections whose features the PR draws.
- **Recurrence 13 (2026-11-08, PR #82, GDD-BOS-03, found by the review):** the new "The tear" bullet made phase 3's first drop fall at x = 240, but the bullet just above it still opened "her drop spot is where Poncho is" for every drop. The hunt fixed a later clause of that bullet ("her glide always heads for the spot above Poncho") and its "they stay whole", but not its opening sentence, so the re-read of the edited section was not done in full.
- **Recurrence 14 (2026-11-08, PR #85, GDD-BOS-03, found by the review):** after the tear moved the 2-4 bot to the left cordel, the GDD said 1035 steps but the backlog row of GDD-BOS-03 still said "in 1009 steps". The hunt searched the GDD for the old number and edited the row's tear note, but did not search `docs/BACKLOG.md` for the number the change replaced.
- **Recurrence 15 (2026-11-10, PR #91, GDD-PWR-04, found by the review):** the new Decided bullets limited the Chile Fantasma's touch to non-bosses and made El Cuate defeatable by it, but the section's own opening paragraph still said "defeats anything on contact" and "flash", and GDD-ENM-01 and GDD-ENM-02 still called the cactus buddy undefeatable and "avoid only". The hunt searched for the feature's own name and "yet", not for what the new rule makes possible in its neighbours: the names of the things it now defeats. The re-review then found GDD-CMB-02's "which nothing defeats" for the same cactus buddy: the second hunt searched for "cannot be defeated" but not for other wordings of the same claim.
- **Recurrence 16 (2026-11-10, PR #91, GDD-PWR-04, found by the review, optional):** after the feature was built, GDD-PWR-04's Status line still listed only the first decisions, GDD-CMB-03's "the one contact that is no hit" and GDD-MVP-02's later-scope list did not mention it, and GDD-ART-03 gave the pale gold one use of two. The hunt searched for the feature's name and "not built yet", not for the sentences that make a general claim the feature now bends ("the one", later scope).
- **Recurrence 17 (2026-11-10, PR #93, GDD-BOS-04, found by the review):** the arena's name "La Casa de Máquinas" was written as Decided in GDD-BOS-04's status while Open Question 45 still listed it as open, and GDD-WLD-18's status called the level's ending at the shed Decided from the same answer. The text was merged by an editor agent from several designers' documents, and the hunt for sentences a decision makes false was run on the sections, not on the Open Questions that named the same thing.
- **Recurrence 18 (2026-11-11, PR #94, GDD-TEC-04 and GDD-BOS-04, found by three reviews):** the cart's commits left GDD-TEC-04 saying World 3 has no gap limit in the validator after the first commit put one in, and GDD-BOS-04 quoting a fall the roll-off rule had changed, with seven smaller sentences. The hunt searched for the feature's own names (cart, rail, lab-3c) and not for the sentences that state the things it changed by another name ("no limit for Worlds 3 to 7", the boss's "about 16 steps").
- **Recurrence 19 (2026-11-12, PR #98, found by the review):** adding the test level `lab-3m`, I fixed four sentences that list World 3's labs and left six (GDD-LIFE-05, GDD-WLD-03, GDD-UI-02 twice, GDD-TEC-04 twice), and the changelog line left out two sections the diff edits. I searched for the text of the list as one sentence wrote it ("`lab-3c` and `lab-3t`"); the others word it differently ("cart lab `lab-3c` and tall lab `lab-3t`", a comma list). The skill's step says to search for the siblings' names; searching for the last sibling's name alone (`lab-3t`) and reading every hit finds all ten.
- **Recurrence 20 (2026-11-13, PR #98, found by the re-review):** fixing "3-2 is not built" across the GDD, I changed the Results menu's sentence and the level list and left "The next level", the very sentence the finding was anchored on, which says the same thing in other words ("3-1, the last level built ... name none"). I searched for the phrases I remembered, not for the anchored line itself; the fix of a review finding starts at the line it names.
- **Recurrence 21 (2026-11-15, PR #100):** I recorded a Decided but unbuilt camera addition in GDD-UI-04 and left its backlog row `done`; the pr-reviewer caught it. Step 1 of `harness-gdd-update` names the touched IDs' backlog rows, but I hunted their sentences and not their status column.
- **Recurrence 22 (2026-11-15, PR #100, found by the last re-review):** fixing an Open Question about World 3's approved looks, I wrote into GDD-ENM-04's backlog row that the bat's look was still Proposed, and I kept its colours open in Open Question 44 (e). That same Open Question already recorded the bat as approved on 2026-11-11, and its Look bullet still said "not drawn". I wrote the bat's status from memory instead of searching for its name across the GDD. Fixed in the follow-up commit.
- **Recurrence 23 (2026-11-15, PR #101, found by its review):** the fix itself left a stale sentence. I made the Murciélago's Look bullet say its sprite is approved, but the Built bullet two lines below still said "to be approved from screenshots". Open Question 36 (g) was fully answered and still listed under "To confirm". GDD-ART-06 still said the mine's set was "not drawn". I searched for the bat's status words but did not reread the whole section I edited, which step 1 of `harness-gdd-update` asks for.
- **Recurrence 24 (2026-11-15, PR #101, found by its third review):** fixing GDD-ART-01's Built bullet, I replaced its catch-all ("everything else, La Estrella included, is placeholder") with a short list of what is not drawn. That list read as complete while the HUD, menus, marks, ofrendas, hilos and some tiles are still placeholders. When a sentence that covers everything is narrowed, keep the catch-all and change only its named exceptions. The rule in place did not stop it: step 1 of `harness-gdd-update` hunts sentences that a change makes false, and a deleted catch-all makes no sentence false, it only empties one. The same miss then went on into the backlog row. I restored its catch-all but left its drawn list shorter than the GDD's, so it called drawn art placeholder. The row now names every drawn item the GDD bullet does.
- **Recurrence 25 (2026-11-16, PR #102, found by its review):** writing the look-ahead, I wrote that the band keeps a Cacomixtle's cart 52 px over the Jump button, but the same bullet's look-up holds his feet at 162, so the gap is 46 px. I also left Open Question 38 (d) and (f), 3-3's camera line and the Deterministic bullet saying what the look-ahead had changed. I hunted the words I edited, not the numbers and claims the new rule moves elsewhere in the same section.
- **Recurrence 26 (2026-11-16, PR #102, found by a re-review):** my fix for the swing-back moved the look-up's fall trigger to y = 194, which let his feet stand lower for a moment. The 46 px figure and the "inside the band" landing sentence, written a commit earlier, went stale.
- **Recurrence 27 (2026-11-16, PR #102, found by the next re-review):** restating those sentences, I wrote y = 194 as the lowest his feet stand. But a fall can pass the trigger by one step, 6 px, before the look-down reacts, and the review measured 195. I wrote a bound from the rule's line, not from a sweep of the code. The bound is now y = 200, pinned by a sweep test with two mutants.
- **Recurrence 28 (2026-11-17, PR #103, found by its review):** to keep K2's cart clear of the phone's buttons I put bridge B's raised bottom 6 rows under its lips, and wrote it into GDD-WLD-18, without searching for the rule the number belongs to: GDD-WLD-03 holds a raised bottom to 4 rows. The step's search covers the sections a change edits and its siblings' names, not the other sections that set a limit on the same number. Now 5 rows, the exception written into GDD-WLD-03 and asked in Open Question 38 (e).
- **Recurrence 29 (2026-11-18, PR #107, GDD-WLD-18, found by the review):** I put 3-3's measured times into Open Question 43 but left its "so the designs come out shorter" in front of them, which the new figures (up to 46.2 and 64.8 s against about 45) make false. I edited the figures inside the sentence and did not reread the claim they support.
- **Recurrence 30 (2026-11-18, PR #109, GDD-BOS-04, found by the third review):** the commit that corrected phase 2's rule of thumb and the cave-in row left the 0.12.4 changelog line saying only phase 1's and phase 3's were corrected. `harness-gdd-update` step 2 says a later edit in the same PR amends that line, but I read that step as being about the version, not the line's summary.
- **Recurrence 31 (2026-11-19, PR #110, GDD-BOS-04, found by the review):** GDD-WLD-15's "no boss level has a rail yet", GDD-BOS-04's `CATORCE` (to be) line, the validator sentences of GDD-TEC-04 and GDD-ENM-01 and the backlog's "not built" were left as they were. The hunt searched for the numbers the build changed, not for the sentences that list the bosses and their checks.
- **Recurrence 32 (2026-11-19, PR #112, GDD-BOS-04, found by the review):** the status paragraph, which this PR edited for "Accept it", kept "no bot has played the fight" and an old list of tests after the bot test was added. The hunt read the sections the measurements changed, not the status line's claims about what is built.
- **Recurrence 33 (2026-11-21, GDD-WLD-18 register, found by the implementer):** registering 3-3 left GDD-WLD-18's "not yet in the game's list of levels" and five 3-3 test headers saying "The level is unregistered". The hunt searched for "yet" in the sections the plan named, but not for the change's own opposite word ("unregistered", "not yet in") across `src/`, where test headers say it too.
- **Recurrence 34 (2026-11-21, PR #117, GDD-WLD-18, found by the pr-reviewer):** after the hunt above, GDD-WLD-03 still said "one tall level is built, 3-1", GDD-UI-04 listed the taller levels as 3-1 and `lab-3t`, GDD-UI-02's lives carry and its Start cases stopped at 3-2, and GDD-WLD-02's table said "the other two designed". The hunt searched for the new member's neighbours as a list ("3-1 and 3-2") but not for the family's other wordings: a count ("one tall level"), a single member standing for the family ("3-1" as the tall level) and a status in a table.
- **Recurrence 35 (2026-11-21, PR #117, GDD-WLD-18, found by the pr-reviewer):** phase B added 3-3's playtests and screenshot scenarios, and the backlog row still said "its art, playtests and screenshots are to come". The hunt was run for phase A's commit and not again for phase B, whose plan touched no `docs/` file; a phase that only adds tests still changes what the backlog row claims.
- **Recurrence 36 (2026-11-20, PR #114, GDD-BOS-04, found by the review):** registering 3-4 and drawing her left four sentences false: GDD-WLD-15's "the post's exemption is not built ... 3-4 is not drawn yet", GDD-ENM-01's "3-4 not yet registered", GDD-UI-01's "3-4 not yet playable" and GDD-TEC-04's "as 3-4 is not yet registered". I searched for "not registered" and "registered" next to her name, not for the other ways the GDD says the same thing ("not yet playable", "not drawn yet") or for "phase C", which the WLD-15 sentence named. The skill step already asks for the state words of the change; I took one wording for the state.
- **Recurrence 37 (2026-11-22, PR #118, GDD-CHAIN-01, found by the pr-reviewer):** the commit that named the first wave to build left Open Question 51 ("each need a decision before the part they touch is built"), GDD-VIS-05 with Open Question 6 ("the scope above stands") and GDD-ART-08 ("before anything is drawn") saying those parts wait. The hunt searched for the words the decisions retired ("working reading", "not resolved") and not for the sentences that say the proposal is not built, which the new "first wave" sentence contradicts.
- **Recurrence 38 (2026-11-22, PR #118, GDD-CHAIN-01, found by the re-review):** the new "Placeholders" sentence listed five undecided conflicts the first wave meets and left out three its own sections cite (C5, C8, C12), and C12 still said "before Phase 1 is built". The list was written from memory of the plans, not from a search of the wave's sections for "Conflict C".
- **Recurrence 39 (2026-11-22, PR #121, GDD-TEC-10, found by the pr-reviewer):** the first server code left "not built", "none is in code yet" and "nothing is built yet" in GDD-LIFE-06, GDD-CHAIN-01, GDD-CHAIN-04 and section 16's opening, and two backlog rows `todo`. The hunt read GDD-TEC-10, whose build it was, and not the sections whose rules the server's ledger and season rule carry out.
- **Recurrence 40 (2026-11-22, PR #121, GDD-TEC-10, found by the re-review):** after the fix for the last occurrence, Conflict C13 still said "none of them is in code" and GDD-CHAIN-03 "not built" with its row `todo`, while `server/ledger.ts` cites GDD-CHAIN-03 for `creditBought`. The hunt fixed the sentences the review listed and did not search again: every GDD ID a new file cites in its comments (`grep -oh "GDD-[A-Z]*-[0-9]*" server/`) names a section whose status and backlog row must say what is built.
- **Recurrence:** 40
- **Promoted:** .claude/skills/harness-feature (Update docs step, which held the hunt until 2026-11-22 and now points to step 1 of `harness-gdd-update`; it came to search for the path of every test file or block the feature deletes or moves, and since recurrence 8 for the lists a new member of a family must join and a full re-read of each edited section, since recurrence 10 in `docs/BACKLOG.md` too, with a plain pattern; its Push and pull request step runs the retro on the review's findings) and .claude/skills/harness-gdd-update (step 1, the same hunt for GDD edits made outside a feature, with the same plain list pattern since recurrence 10). Two kinds of it have a check since 2026-11-22: a changelog line that names other sections than the diff changes (`gdd-changelog-sections`, `scripts/gdd-version.mjs`; recurrences 6, 19 and 30) and a path in the GDD or the backlog that no longer exists (`harness-paths`, `scripts/harness-paths.mjs`). Since the same day the hunt's search is a command, `node scripts/check.mjs --gdd-hunt` (`scripts/gdd-hunt.mjs`), in place of search words chosen each time, and `harness-gdd-update` step 6 has the `pr-reviewer` audit the GDD diff before the commit ("local GDD audit"). Guard: none (which sentences a change makes false takes reading the GDD; the pr-reviewer's consistency audit is the backstop).

## L-014 A claim about where things are in the sandbox level had no test

- **Date:** 2026-10-22
- **Area:** level
- **What went wrong:** The GDD, a code comment, an e2e comment and the PR description said only the spring ledge and the moving platform put Poncho in the Zopilote's reach. It also reached the Alacrán's platform (89 px below its line, inside the 80 px trigger at the low end of its bob). The reviewer found it by running the sandbox level.
- **Root cause:** I reasoned about the geometry from the floor and two obvious places and never ran the real level through the sim. A statement about the level is a claim the sim can check.
- **Rule:** When the GDD or a comment says where something can or cannot happen in the sandbox level (reach, spotting, clearance from a respawn), put a test over the real level data (`src/levels/sandbox.test.ts`) that runs the sim and states it, and mutate the level numbers to see it fail.
- **Recurrence 3 (2026-11-12, PR #97, GDD-WLD-16, found by the review):** 3-1's test of the held glide from the stone drove it on a copy of the level with the enemies taken out, so "a miss costs nothing" was true of an empty level only: on the real one the flight flew into a bat at 12 to 17 of 24 start times, and with the bat gone into an Alacrán. The rule asks for a test over the real level data; the test file's own helper for measuring a reach without enemies made the wrong level the convenient one, and the plan did not say which claims are about what a path costs. Both enemies were taken out and every such claim in the file is now driven on the real level.
- **Recurrence 4 (2026-11-12, PR #97, GDD-WLD-16, found by the re-review):** the same fault one bat earlier: the held stomp on 3-1's first bat, a move the level rewards with two hilos, bounced him over the second chasm into its bat (29 of 32 stomps from one take-off), with that bat off screen at the take-off. The test did drive it on the real level, as the rule now asks, but asserted only the stomps and the hilos, never the lives or where he lands, and from one take-off. The bat was moved under every crossing flight, which a sweep of take-offs now pins. The skill's sentence now also asks for the lives and the landing over a range of take-offs.
- **Recurrence 5 (2026-11-12, PR #97, GDD-WLD-16, found by the next re-review):** the fix's own test asserted the held stomp's lives at three take-offs a tile apart with one run-up; from a standstill on the first tile of the stretch every stomp fell short into the chasm. The skill's sentence of the same day asked for a sweep of take-offs and the plan to the builder named three columns. The bat moved two columns, chosen from a table over every candidate column, and the test sweeps the stretch standing and running.
- **Recurrence 6 (2026-11-17, GDD-WLD-18, 3-3's enemy drives, found by the main session before commit):** the plan worded K1's take-off sweep as "from where he wakes it to 3 tiles further", which ends 24 walking steps in, before the cart has left its 30-step telegraph: "a plain jump at a walk is lost at every take-off" was the sweep's range, not the layout. Two more findings (K3 answered by one move of four, the Armadillo met by placing him on P3 at each clock) came the same way. The skill's sentence names a lip's stretch; for an enemy the stretch runs to where it meets him. Re-driven to past the meeting point, with every answer, before anything was pinned. Unregistered levels are outside the sight sweep's guard until they are registered.
- **Recurrence 7 (2026-11-18, PR #105, GDD-WLD-18, found by the review):** the answers to K3 under the raised vulture were each driven to 20 steps after K3's cart parked, while the vulture a jump had set off was still in its telegraph or dive: "the plain jump over keeps the life at every clock" was the drive's end, not the stretch's (followed on, 25 of 75 clocks standing, 62 walking). The rule asks for the lives and where he ends; the plan's follow-on covered the first held jump only. The sight sweep did not run: 3-3 is not registered yet; it joins the guard when it is (GDD-WLD-18's registration).
- **Recurrence 8 (2026-11-18, PR for GDD-WLD-18 B2b, found by the walker bot):** GDD-WLD-18 said "No cart is needed: C1 has the shelf and MP0", but pier V's wall ran from its cap to the level's bottom and cut the shelf in two, so a Poncho on its left part (a walker, or a rider who hopped out over it) could never reach MP0. PR #103 measured the secret's flights and the falls onto the shelf, never a walk along it. Fixed by the user's "Tunnel under the pier" and pinned by `level3-3.walker.test.ts` (the walk from the shelf's left part, and a hop out of C1 at every 4th step of the ride). The sight sweep, this lesson's guard, flies from every place but does not check that every place leads on.
- **Recurrence:** 8
- **Promoted:** src/levels/sandbox.test.ts (the Zopilote's reach); .claude/skills/harness-feature (step 5: a placement rule is run over every real level before it goes into the GDD or a plan). Second time (2026-10-27, GDD-ART-06): I wrote the plants' kind rule as (7 x column + row) mod 7 into the GDD and the plan without running it; a coefficient equal to the modulus cancels, so it was just row mod 7 and every plant on a row was the same kind, and 0-1 got 5 plants and the sandbox none. The rule was rerun over both levels and the counts (12 and 4) went into the GDD and a test. Third time: .claude/skills/harness-feature (step 5, Placement rules: a claim about what a path costs is driven on the level with every enemy in it). Fourth and fifth time (2026-11-12): the same step, a sweep of take-offs that asserts the lives and the landing, worded as a sweep in the plan. Sixth time (2026-11-17): .claude/skills/harness-feature (step 5, Placement rules: for an enemy the take-off stretch runs to where it meets him, and every answer in the plan's family is swept, not one). Guard: `src/levels/sight.test.ts` (2026-11-12, after Recurrence 5; `npm run test:sight` in the gate, with `src/levels/sightSweep.ts`), the reviewer's probe as a test: it flies every flight a World 3 level invites from every place he can stand, on the real level, and fails on a life lost to something off screen at the take-off; put back, each of PR #97's three faults turns it red

## L-015 An e2e test picked an enemy out by where it is, and a new enemy matched

- **Date:** 2026-10-22
- **Area:** playtest
- **What went wrong:** The Zopilote playtest found its painted enemy with `e.y < 120`. Adding the Tlacuache on a ledge at y = 96 made that filter match it too, so "the defeated Zopilote is gone from the picture" failed on both viewports.
- **Root cause:** The debug hook's `enemiesDrawn()` gives only positions, so each enemy test identifies its enemy by a place in the sandbox, which holds only until something new is put there.
- **Rule:** When adding anything to the sandbox level, run the whole e2e suite, not only the new spec. Identify an enemy in a test by its index or kind, not by a region of the screen; if the hook cannot say which is which, extend the hook.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-playtest (Run: the whole suite; Writing a scenario: pick out an enemy by its index or kind)

## L-016 A screenshot scenario took the wrong picture and still passed

- **Date:** 2026-10-22
- **Area:** playtest
- **What went wrong:** The Tlacuache's "playing dead" shot showed it walking: the scenario stomped too early (while it charged away) and then moved Poncho away before he landed. The "telegraph" shot put Poncho 0.4 px into the level's right wall, which pushed him out of the picture. Both were caught only by looking at the images.
- **Root cause:** Shot scenarios had no assertions, so a scenario that misses the state it is named for runs green.
- **Rule:** In every `e2e/shots/` scenario, assert the state the shot is named for (phase, position in view) right before taking it.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-playtest (Screenshots for visual review: assert the state a shot is named for right before it)

## L-017 A 1 px drawing could not be checked by pixels on the phone viewport

- **Date:** 2026-10-22
- **Area:** playtest
- **What went wrong:** The Tlacuache's twitching feet were 1 px columns. The pixel test passed on desktop, but on the phone viewport (1.44x scale) the columns merged or vanished, and it found 1 of 4 feet.
- **Root cause:** At a non-integer scale a 1 px detail is not reliably drawn where its virtual pixel is, so a pixel sample has no margin.
- **Rule:** Anything an e2e test reads by pixels must be at least 2 px in each direction, and sample it in its middle, 1 px or more from any edge. Run pixel tests on both viewports before pushing.
- **Recurrence 2 (2026-11-18, the flaky-test census):** `e2e/cart.spec.ts` ("Poncho stands in the cart behind its front wall") read his shins as 1 px spots 2 px over his feet, where the cart's front wall turns from rust to steel; on the phone a game px is 1.44 CSS px and the start state varies with frame timing, so a spot on that edge read either colour: 12 CI failures in a week, phone only, 6 of 30 locally. The shins now keep only spots whose colour is the same half a game px to each side (120 of 120 after). The rule was in the playtest skill; nothing checked it.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-playtest (Writing a scenario, step 8); `scripts/check.mjs` (`small-spots`: a `spotsIn` call with `size` under 2 in `e2e/` fails unless its line says why in an `// L-017:` comment; the eight lines written before the check are marked as predating it). Guard: `scripts/check.mjs` (`small-spots`)

## L-018 A pixel sample on the phone landed under a touch button

- **Date:** 2026-10-22
- **Area:** playtest
- **What went wrong:** The game-over test checked that the level is dimmed by reading a floor tile at the bottom left. On the phone viewport that spot is under the touch Left button, which is drawn above the screen, so the test failed there. The same thing happened before: a fragile-tile pixel test is skipped on the phone because the Jump button covers its tile.
- **Root cause:** Pixel sample points were chosen on the desktop picture. On the phone the touch buttons cover the bottom corners and sit on top of everything.
- **Rule:** Choose pixel sample points clear of the touch buttons (their boxes come from `touch().buttons`), and run pixel tests on both viewports before pushing.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-playtest ("Writing a scenario", the step on reading pixels)

## L-019 A press was read from a value that had already combined two buttons

- **Date:** 2026-10-22
- **Area:** input
- **What went wrong:** The Siete vidas gastadas screen counts a new press of any button. Left and right reached the simulation only as `move`, their sum, so with right held a press of left made `move` 0: the press was lost, and its release then looked like a new press of right. The reviewer found it with a probe. My test held right and pressed jump, never the opposite direction.
- **Root cause:** I tested the rule with buttons that are independent in the input and missed the two that are not. The input had already merged them before the new rule needed them apart.
- **Rule:** When a rule counts presses or releases of single buttons, read each button raw, never a value that combines several (`move`), and test the pairs that combine: both directions at once.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-feature (step 5: list every input source that produces each button the rule reads, and test each). (Second time, the same PR: the fix passed raw left/right from the keys and touch buttons, but set them to false in slide-stick mode, so a stick push stopped counting. The reviewer found it.)

## L-020 A hand-run mutation was left in the code

- **Date:** 2026-10-22
- **Area:** tests
- **What went wrong:** For the respawn-skip fix I ran a mutation with `sed` straight in the shell, chained to a test run but not to a restore. The next test output came from the mutated file, and the `git diff` showed the mutation still in place. I caught it before committing and put the fix back.
- **Root cause:** The earlier mutations ran through a script that restored each file in a `finally`. This one-off went around it, so nothing undid it.
- **Rule:** Run every mutation through a small script that, for each mutant, replaces the exact text in the file, runs the tests, and puts the original back in a `finally` block; then check that `git diff` of the source files shows only the intended change before the gate and the commit. Do not mutate files while `npm run test:e2e` is running: the Vite dev server reloads the pages and unrelated playtests fail with `__PONCHO__` undefined.
- **Recurrence 2 (2026-10-22, GDD-UI-02):** the pause mutations ran in the background through an ad hoc script. The background time limit killed it in the middle of a mutant, so its `finally` never ran, and the scene was left with one prompt line instead of two. A grep before the gate caught it.
- **Recurrence:** 2
- **Promoted:** scripts/check.mjs (no-mutation) and scripts/mutate.mjs: the runner mutants from a JSON list and keeps the original in `.mutating.json` while a mutant is in place; `scripts/check.mjs` (`no-mutation`) fails while that marker exists, and `node scripts/mutate.mjs --restore` puts the file back. Step 7 of the `harness-feature` skill and step 4 of `.claude/agents/implementer.md` name the runner.

## L-021 A paused playtest skipped the code that animates the HUD in real play

- **Date:** 2026-10-22
- **Area:** playtest
- **What went wrong:** The last-life pulse needs the HUD redrawn on every step, which the scene's `update()` does only under a condition. The playtest drove the game with the debug `step()` hook, which calls `drawHud()` itself, so removing that condition left every test green while in real play the triangle froze after the crack. The reviewer found it with an unpaused probe.
- **Root cause:** The debug `step()` hook redraws everything on each call, so a paused test cannot see what `update()` draws, or fails to draw, on its own.
- **Rule:** For anything that animates or redraws over time, add at least one playtest that runs the game unpaused through its own frames and checks the picture (or the drawn state) keeps changing.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-playtest (Writing a scenario: one unpaused playtest for anything that animates)

## L-022 A playtest released a held key and pressed it again inside one frame

- **Date:** 2026-10-22
- **Area:** playtest, input
- **What went wrong:** The pause playtest held Space through the resume, then called `keyboard.up('Space')` and at once `keyboard.press('Space')`. Two runs in three failed: no jump. No step ran between the release and the new press, so the simulation saw jump held throughout and found no new press.
- **Root cause:** Presses are latched (L-006), releases are not: the step reads the key as held when the release and the next press land in the same frame. That is how the game behaves for a player too, so the test, not the game, was wrong.
- **Rule:** In a playtest, after releasing a held button and before pressing it again, wait until a step has seen the release (for jump, `state().jumpWasHeld` is false). Run a new real-time playtest with `--repeat-each=3` before trusting it.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-playtest (Run: `--repeat-each=3`; Writing a scenario: wait until a step has seen the release)

## L-023 A layer's "stays on top" and a check made once at start had no test

- **Date:** 2026-10-22
- **Area:** tests
- **What went wrong:** The review of GDD-UI-02 found two scene rules no playtest could fail. Raising the pause screen above the HUD and touch buttons stayed green, because the only pixel check was on a level tile. Removing the orientation check at start stayed green, because the portrait test always booted in landscape and rotated later.
- **Root cause:** The pixel test only checked what the overlay covers, not what must show through it. And the tests only reached the state by changing into it, never by starting in it.
- **Rule:** For an overlay, sample one pixel it must dim and one it must leave alone (HUD, buttons). For anything checked on an event and also once at start (orientation, focus, storage), add a test that starts in that state.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-playtest (Writing a scenario: an overlay samples a pixel it dims and one it leaves alone); the start-in-that-state half is not promoted

## L-024 A new rule on a held button took a short press away from an older rule

- **Date:** 2026-10-22
- **Area:** input
- **What went wrong:** The glide read "jump held while falling". A one-step jump press just before landing, which the jump buffer (GDD-MOV-03) turns into a jump on landing, now also glided for that step, slowed the fall, and landed after the buffer had run out: no jump. The new unit tests were green; the old spring playtest that times a buffered press caught it.
- **Root cause:** The new rule and the jump buffer both read the jump button while falling, and nothing checked them together.
- **Rule:** When a new rule reads a button that an existing rule already reads (jump buffer, coyote time, variable jump, stomp boost), list those rules, write a unit test that plays each one with the new rule switched on, and run the whole playtest suite before showing screenshots.
- **Recurrence 2 (2026-10-22, same PR, found by the review):** the list missed GDD-UI-02. A jump pressed while paused and held through the resume (marked as held by `resumeHeld`) still glided, because the glide counted any held input instead of a press the simulation saw.
- **Recurrence 3 (2026-10-23, GDD-MOV-08, found by the review):** the wall kick reads a jump press in the air, and the list did not have the spring launch, which GDD-WLD-05 says no jump press replaces. At the sandbox spring, against a wall, a late press kicked and cut the launch from 77 to 56 px. The skill's list now names the spring launch and stomp bounce, and says to look for the button in every GDD section, not only in movement.
- **Recurrence:** 3
- **Promoted:** step 5 of the `harness-feature` skill (input rules): list every rule that already reads the button, including the "already held" marks of the respawn and of the pause resume, and test each with the new rule on. Guard: `vitest.abilities.config.ts` (`npm run test:abilities`, in the gate: the simulation tests rerun with every progression ability on, so a new ability meets every older rule's tests; which older rules read a button on a menu or screen still takes a search of the whole GDD, with the full playtest suite as the backstop).

## L-025 A guard that another rule already covers survived its mutant

- **Date:** 2026-10-23
- **Area:** tests
- **What went wrong:** In the glide (GDD-MOV-07) a "not on the ground" condition survived its mutant, because landing ended the glide anyway. In the wall cling (GDD-MOV-08) the same happened twice: "not touching on the ground" and the kick's "not grounded" check, both already covered by the normal jump taking the press first and by landing ending the slide.
- **Root cause:** Each guard was written for a case another rule already handles, so it had no behaviour of its own for a test to pin down.
- **Rule:** When a mutant of a guard survives, first ask whether another rule already covers that case. If it does, delete the guard and say in a comment which rule covers it, instead of adding a test that cannot fail for the guard alone.
- **Recurrence 3 (2026-10-23, GDD-WLD-05 moving blocks):** a `clinging: false` on the block's side stop survived, since movement only clings to tiles; deleted with a comment naming the covering rule. The skill step worked as written.
- **Recurrence 4 (2026-10-23, GDD-UI-02 pause menu):** the plan itself designed the redundancy: a `tapResume` event for a tap on the Resume row, which did exactly what a plain `tap` already did (resume, whichever item is chosen). Its mutant could not die. Deleted in the check step, the Resume row now sends `tap`. The rule caught it, but only after a plan, an implementation and tests had been built for it.
- **Recurrence 5 (2026-11-03, GDD-BOS-02 boss art):** the plan's first mutant took `'sweep'` out of the flapping modes, but the new tucked-wings rule for the sweep already won over the flap, so the mutant changed nothing; the implementer replaced it with a killable one. The plan rule names new events, states and branches, not a mutant of a rule that a newer rule in the same plan shadows. The guard (`scripts/mutate.mjs`, run in the plan's check) caught it as designed.
- **Recurrence:** 5
- **Promoted:** step 7 of the `harness-feature` skill (step 4 of `.claude/agents/implementer.md` too), and since recurrence 4 also step 5 (plan): a new event, state or branch must do something no existing one does. Guard: `scripts/mutate.mjs` (a guard another rule already covers survives its mutant, and the run fails).

## L-026 A test measured over a window wide enough to include a second, unrelated event

- **Date:** 2026-10-23
- **Area:** tests
- **What went wrong:** The sandbox spring test (GDD-MOV-08, GDD-WLD-05) took Poncho's highest point over 60 steps. With the spring guard removed, a press kicked him only 56 px up, but holding left walked him back onto the spring and a second launch reached the same 77 px, so the test stayed green. I claimed the mutant failed it after checking only the whole file, where another test caught it.
- **Root cause:** The measuring window was longer than the event under test, and the mutant was checked against the file, not against the new test alone.
- **Rule:** Stop a measurement at the end of the event it is about (the first apex, the first landing), and assert the sign of the effect directly on every step. When a description says a mutant fails a particular test, run that mutant against that test alone (`-t`).
- **Recurrence:** 1
- **Promoted:** no

## L-027 A new HUD element pushed older on-screen text into the title

- **Date:** 2026-10-23
- **Area:** ui
- **What went wrong:** The hilo counter (GDD-UI-01) took the top-right corner, where the dev-only key hint was. The implementer moved the hint down to y = 20, straight over the centred game title. No test reads either text, so the gate and the playtests were green; it showed only in the screenshots.
- **Root cause:** The plan named the counter's place but not what else already draws near it, so the clash was solved by moving the old text without checking where it landed. Text overlap has no automated check.
- **Rule:** When a plan puts something on the HUD or moves on-screen text, list every text and graphic already drawn in that area (title, controls line, dev hint, pause button, keys and icons) and say where each one goes, then look at both viewports' screenshots for overlap before showing them.
- **Recurrence:** 1
- **Promoted:** no

## L-028 An exemption flag was tested only for what it skips, not for what it keeps

- **Date:** 2026-10-23
- **Area:** tests
- **What went wrong:** In PR #43 (GDD-TEC-04) the sandbox is a test level that skips the exit and length checks. The tests proved those two are skipped, but nothing proved the ofrenda, gap and enemy checks still run for a test level, so `if (entry.test) return [];` passed every test while the PR deleted the sandbox's own enemy-distance test. The reviewer also found the "bottom row" gap rule and the straight-line distance unpinned: every fixture cleared all floor rows and put enemies level with the respawn.
- **Root cause:** The plan's mutants came from the rules as written ("skips X"), not from the rule's other half ("and keeps Y"), and the fixtures were built so that neighbouring definitions (bottom row against all floor rows, straight-line against axis distance) gave the same answer.
- **Rule:** For a flag that exempts something from some rules, plan a test with the flag on that breaks every rule it does not exempt, and a mutant that makes the flag exempt everything. For each definition, pick a fixture where the likely wrong definition gives a different answer.
- **Recurrence 2 (2026-11-11, PR #94, GDD-WLD-15, found by the review):** the validator's rail checks skipped a boss level altogether, where the GDD exempts it from the two length limits only, and the test asserted the wider exemption: the plan said "for every level but a boss level" and listed a mutant for the exemption dropped, none for it exempting too much.
- **Recurrence 3 (2026-11-11, PR #94, GDD-WLD-15, found by the review):** the cart's box that runs enemies down was tested on level rails only, where the rail's start height and the ground under the cart's middle give the same answer, so the box read at the rail's start stayed green; the plan listed every enemy kind and state and no fixture off level rail. Fixed with tests on a plateau, over a floor the cart must not touch and on a slope.
- **Recurrence 4 (2026-11-11, PR #95, GDD-WLD-03, found by the review):** the validator's "solid or empty all the way down" check under a raised bottom started one row too low, and every fixture had its pit columns empty and its ground columns solid on that row too, so the wrong range and the right one agreed; one fixture even pinned the hole as valid. The skill's sentence speaks of things that move or bend and did not reach a range's first and last row. Fixed with fixtures that differ only in the first and only in the last row of the range.
- **Recurrence 5 (2026-11-19, PR #111, GDD-WLD-18, found by the review):** the walker's new `pier` field, meant as "stops on the pier", counted any grounded step over the pier, so a run across passed too, and the only mutant (no pier stop at all) was caught by the walker never clearing. The plan named the check and no fixture where "on the pier" and "stopped on the pier" differ. Fixed with `vx === 0` and a test of a run across.
- **Recurrence:** 5
- **Promoted:** .claude/skills/harness-feature (step 5, Mutants: an exemption gets a test with it on that breaks every rule it keeps, and a mutant that makes it exempt everything). Guard: none (no script can tell a fixture in which two definitions agree from one in which they differ; the reviewer's mutants found each case)

## L-029 Planned mutants with no test to kill them

- **Date:** 2026-10-23
- **Area:** tests
- **What went wrong:** The GDD-AUD-02 plan listed mutants for the land-only-in-play guard, the stomp mark on the life-lost returns and the stomp mark being cleared on the respawn paths, but named no test for them ("pick the test; or report if none"). The implementer had to design three extra tests on its own, and a `-t` filter with "(45 steps)" in the test name matched nothing, because `-t` is a regular expression.
- **Root cause:** The plan was written from the rules down to mutants, not from each mutant back to a planned test, so a clause with no test only showed up when its mutant survived.
- **Rule:** Every planned mutant names a test that is in the same plan. When a mutant has none, add the test to the plan (setup and expected value) before launching the implementer. Keep test names free of regex characters such as parentheses, or filter on a plain prefix.
- **Recurrence 2 (2026-10-25, GDD-CTL-02):** the other direction. The plan listed `this.pad.holdBack()` in `quitToTitle` as a code change but gave it no mutant and no test; the implementer's own mutant survived every test and it added a playtest.
- **Recurrence:** 2
- **Promoted:** step 5 of the `harness-feature` skill (mutants): every code line the plan lists gets a mutant, and every mutant a test in the plan.

## L-030 The session started on a branch left behind by an earlier merged PR

- **Date:** 2026-10-23
- **Area:** process
- **What went wrong:** The designated branch still held the commits of an old, already merged PR and was 57 commits behind `main`. The first backlog read came from that stale copy and showed rows as `todo` that `main` had already built, so the next-feature choice offered to the user was nearly built on old state. A fetch caught it before any code was written.
- **Root cause:** The work loop says to restart the branch from `main` after a merge, but nothing says to check that at the start of a session, when the merge happened in another session.
- **Rule:** At the start of every task, `git fetch origin main` and compare; if the branch carries only merged history, restart it from `origin/main` before reading the backlog or the GDD.
- **Recurrence 2 (2026-10-31, harness audit):** the audit of the skills, subagents and hooks read the branch as it was, the merged PR #62, while `main` already held PR #63; the planned edits had to be checked again on `main` and one gate-check list rebased before they could be applied. The rule was not yet promoted, so no step said to fetch before a task that is not a feature.
- **Recurrence:** 2
- **Promoted:** CLAUDE.md (Work loop step 1, for every task, harness work included); `scripts/hooks/stale-main.mjs` (before a push or a new PR it fetches `main` and asks when the branch lacks some of it)

## L-031 The PR overview sheet has no tool, so each session builds one by hand

- **Date:** 2026-10-23
- **Area:** process
- **What went wrong:** `CLAUDE.md` asks for an `overview.png` sheet of the approved screenshots in every visible PR, but the repository has no script for it. This session wrote a throwaway Playwright page in the scratchpad to compose the sheet, as earlier sessions must have done, each with its own layout.
- **Root cause:** A required step of the PR rule was written as prose with no tool behind it.
- **Rule:** Until there is a script, compose the sheet from the committed screenshots only (never from `shots/`), with each file name under its image, and look at it before committing.
- **Recurrence 2 (2026-10-25, GDD-UI-02 settings):** the sheet was about to be built by hand again; `scripts/overview.mjs` now composes it from a `docs/screenshots/<slug>/` folder.
- **Recurrence:** 2
- **Promoted:** `scripts/overview.mjs`, named in the `CLAUDE.md` commands table and its Pull requests rule.

## L-032 Hiding the touch buttons hid only their drawing

- **Date:** 2026-10-23
- **Area:** input
- **What went wrong:** On the title screen (GDD-UI-02) the touch buttons were hidden with `setVisible(false)`, but `read()` still acted on them: a finger held on the invisible mode switch flipped the slide stick and saved the choice. A tap and a turn upright in the same frame also started the level upright. The review found both with probes; the playtests used `page.touchscreen.tap`, which is shorter than a frame, and never put two events in one frame.
- **Root cause:** The plan treated "hidden" as a drawing change and listed every input source for starting the level, but not the side effects those sources have on their own (the mode switch). Events were applied in order, but the rule was really about the state at the end of the frame.
- **Rule:** When a screen hides controls, list what each hidden control does besides the press the screen reads, and test a held touch (CDP, several frames), not only a tap. When a rule reads several events from one frame, decide on the state at the end of the frame and test a pair of conflicting events in one frame.
- **Recurrence 2 (2026-10-25, GDD-UI-02 pause menu, found by the review):** the Resume row was placed half inside the lower left quarter of the screen, which the slide stick reads, so in stick mode the tap that resumed also steered Poncho. The plan's unit test checked the rows against the stick's drawn track only, not the area it reads, and passed. Fixed by holding back from the stick any finger that went down while paused or on the title screen, until it lifts.
- **Recurrence 3 (2026-10-27, GDD-UI-02 the next level, found by my own mutation):** the test that the press ending 0-1's clear screen does not jump in 1-1 used `page.touchscreen.tap`, which lifts before 1-1's first frame, so it passed with the hold-back removed; a key test read Poncho's height once, after the jump had already landed. Fixed with a finger held through the change by CDP, and the highest point over 60 frames.
- **Recurrence:** 3
- **Promoted:** step 5 of the `harness-feature` skill: a new on-screen tap target is checked against the area each touch control reads, not only its drawn box; and the `harness-playtest` skill: a rule about a held button is tested with the button held across frames (CDP `touchStart`, a repeated `keyboard.down`), measured over the whole window. Guard: none (what a hidden control or a touch area also reads is found by listing it in the plan; each case found is pinned by a held-touch playtest).

## L-033 A visibility was set from state before that frame changed the state

- **Date:** 2026-10-23
- **Area:** ui
- **What went wrong:** The title screen hid the touch buttons with `setHidden(this.title.shown)` at the top of `update()`, but the title closes later in the same `update()`. For one frame after the title went the buttons stayed hidden. CI's phone run read `touch().visible` in that frame right after `boot()` and failed; 15 local runs passed.
- **Root cause:** Drawing and visibility were set in two places, one before and one after the state change, and the playtests read the result a few frames later, so the lag never showed locally.
- **Rule:** Set every visibility that follows a state in the same draw step that runs after the state can change (the `draw*` calls at the end of `update()`). When a test checks that two things change together, read both in one `waitForFunction` callback.
- **Recurrence 2 (2026-11-02, PR #69, GDD-CTL-03 safe-area insets, found by the review):** the per-frame safe-area update ran at the end of `update()`, after `drawHiloCounter()`, which places the counter by the pause button; on the frame the insets moved the pause button the counter was drawn at the old place. The plan put the call next to `setLayout` by habit and listed no reader of the moved boxes in the same frame; the rule was not promoted to the plan step. The call now runs at the top of `update()` and a playtest reads the counter and the pause button on the first frame the change shows.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-playtest (time in simulation steps: read things that change together in one `waitForFunction`); .claude/skills/harness-feature (step 5, per-frame updates: run before the first code in `update()` that reads what they change, and a playtest on the first frame the change shows)

## L-034 The mutation runner took one test command per file, but each mutant needs its own test

- **Date:** 2026-10-23
- **Area:** tests
- **What went wrong:** L-026 says to run each mutant against the one test that must kill it, alone. `scripts/mutate.mjs` took a single `test` command for the whole file, so for GDD-UI-02 the implementer and then the main session each wrote an ad hoc wrapper that made one mutants file per mutant (57 mutants, unit and playtest).
- **Root cause:** The runner was built before the rule; the rule was added as prose and the tool never caught up.
- **Rule:** Give each mutant its own `test` command in the mutants file (it replaces the file's `test`), so `node scripts/mutate.mjs <file>` runs every mutant against its named test with no wrapper.
- **Recurrence:** 2
- **Promoted:** `scripts/mutate.mjs` (a mutant's own `test` field), and step 7 of the `harness-feature` skill.

## L-035 An "already held" mark that only some readers honoured

- **Date:** 2026-10-25
- **Area:** input
- **What went wrong:** GDD-UI-02 says a button pressed while paused does nothing until it is released and pressed again. `resumeHeld` marked such buttons as held, but only the rules that read the mark obeyed it (jump, claw, Fuego, the Siete vidas gastadas screen). `move` read the keys and fingers directly, so a Left or Right key or button pressed while paused, or the slide-stick finger that resumed, made Poncho run.
- **Root cause:** The rule was built as a flag on some readers of a button instead of at the input source, and no test played the rule through each reader of the button.
- **Rule:** Apply a "does nothing until released" rule where the input is read (the key or finger itself), so every reader of that button sees it up, and test it for every source of the button (each key, each touch control) and every reader (move, jump, the screens that count presses).
- **Recurrence 2 (2026-10-25, GDD-UI-02):** first in the review of PR #46, for the slide stick; then for the Left and Right keys and touch buttons.
- **Recurrence:** 2
- **Promoted:** step 5 of the `harness-feature` skill (shared buttons).

## L-036 A held-back press was tracked by its key or pointer slot, not by the press

- **Date:** 2026-10-25
- **Area:** input
- **What went wrong:** The rule "a button pressed while paused does nothing until released" stored the Phaser `Key` object (and first, in PR #46, the pointer id). A key held at the pause and pressed again while paused counted as held since before the pause and ran; a key released and pressed again inside one frame stayed held back. Both were found in review.
- **Root cause:** A press was identified by where it comes from, not by when it went down, so two presses of the same key or pointer slot looked like one.
- **Rule:** Track a press by its source and its down time (`Key.timeDown`, `Pointer.downTime`), and test both a new press of a key held at the pause and a release and press inside one frame.
- **Recurrence 2 (2026-10-25, GDD-UI-02):** the pointer id in PR #46 (caught before merge by keying fingers with `downTime`), then the `Key` object in PR #47.
- **Recurrence:** 2
- **Promoted:** step 5 of the `harness-feature` skill (shared buttons).

## L-037 A latched press stayed pending on a screen where no step runs

- **Date:** 2026-10-25
- **Area:** input
- **What went wrong:** On the settings screen opened from the title (GDD-UI-02), a quick Left or Right tap stayed latched, because latches are spent only by a simulation step and none runs on the title. When the screen closed, the still-pending latch made the held key look like a new press and started the level. The plan did not cover it; the implementer found it in a playtest.
- **Root cause:** The latch rule (L-006) says "cleared by the step that uses it", and the plan added a screen that reads presses without stepping, so nothing was using and spending them.
- **Rule:** Any screen that reads presses while no step runs (title, pause, settings, menus) spends the latches each frame it reads them (`consumeLatches()` in `PlayScene`), and its plan has a test of a quick tap there followed by leaving the screen.
- **Recurrence:** 1
- **Promoted:** no

## L-038 "Held through a screen" was planned on frame boundaries, not on presses within a frame

- **Date:** 2026-10-25
- **Area:** input
- **What went wrong:** GDD-UI-02 says a game button held through the title's settings screen is no new press after it. The plan compared the buttons down with the ones down on the frame before, so a Left going down in the same frame that the settings screen was left (or opened and left) still counted as new and started the level. It was found in review of the implementer's report, which named the case as "timing-sensitive by design".
- **Root cause:** The plan stated the rule per frame, and the events within one frame are applied in order, so a screen can open and close between two frame boundaries.
- **Rule:** When a rule depends on a screen being open, decide it on "open at any time in the frame", and plan a unit test where the screen opens or closes in the same frame as the press.
- **Recurrence:** 1
- **Promoted:** no

## L-039 A style mock-up was drawn before asking for the user's own art references

- **Date:** 2026-10-25
- **Area:** art
- **What went wrong:** For the style guide (GDD-ART-01 to GDD-ART-07) I drew a full mock-up board from the one illustration in the repository: a front-facing Poncho, an orange sky. The user then shared side-view sprite sheets and a desert scene of their own, which changed the view, the proportions, the colours and the resolution (480 x 270 to 1920 x 1080). The first board was thrown away.
- **Root cause:** The feature skill only asks whether the character reference blocks the work. It does not ask whether the user has further references (sprite sheets, scenes, moods) for the specific art about to be drawn.
- **Rule:** Before drawing any new art (a sprite, a tileset, a scene, a UI look), ask the user whether they have reference images for it, and save any they share under `assets/` with a README before drawing.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-feature (Check blockers step)

## L-040 Source files edited while the playtests ran

- **Date:** 2026-10-25
- **Area:** playtest
- **What went wrong:** During the 0.5.0 dependency review (GDD-TEC-07) I edited comments in `src/` while `npm run test:e2e` was running. The Vite dev server reloaded the page, and two playtests failed with "Execution context was destroyed". Both passed alone and in a full re-run, but it cost a second 8-minute run.
- **Root cause:** The playtests run against the live dev server, which reloads on any change under `src/`, and nothing warns that the run is still going.
- **Rule:** Finish every edit under `src/`, `index.html` and `e2e/` before starting `npm run test:e2e`, and make no edits there until it ends. A failure with "Execution context was destroyed" during a run with edits is a reload, so re-run the whole suite rather than counting it as a pass.
- **Recurrence 2 (2026-10-27, GDD-WLD-07):** I wrote the 1-1 screenshot scenario under `e2e/shots/` while `npm run test:e2e` was running. The shots project is not part of that run, so nothing broke, but the rule was broken again because nothing stopped it.
- **Recurrence:** 2
- **Promoted:** `playwright.config.ts` global teardown (`e2e/edit-guard.ts`): a playtest or shots run fails when a file under `src/`, `e2e/` or `index.html` changed while it ran

## L-041 A "pressed while paused" test used a button the pause menu also reads

- **Date:** 2026-10-25
- **Area:** input
- **What went wrong:** The GDD-CTL-02 plan had a playtest press the gamepad's south button while paused and hold it through a resume by start. South is also "pick" on the pause menu, so the press itself picked Resume, and the start press after it paused again. The implementer rewrote the test to hold south through the resume that its own press causes.
- **Root cause:** The plan treated south only as the jump button and did not look up what the paused screen does with it (Space and Z have the same double role).
- **Rule:** Before planning a press made on a menu or pause screen, look up what that screen does with the button (`pauseEvent`, `titleFrame`, `settingsEvent`); for a button that picks (Space, Z, south), the hold-back test holds the press that picked.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-feature (step 5, shared buttons)

## L-042 A bigger canvas slowed the playtests' frames and exposed timing by polls

- **Date:** 2026-10-25
- **Area:** playtest
- **What went wrong:** With the 1920 x 1080 canvas (GDD-ART-01) the headless browser, which has no GPU, drew about 20 to 30 frames a second instead of 60. Phaser's delta smoothing fed the fixed-step loop 1/60 s per frame, so the game ran in slow motion and ten playtests failed. With smoothing off, two still failed: one timed the respawn skip by polling `ticks()`, which lags a few steps per slow frame, and one did slow setup (a CDP session) after putting Poncho in the air, so he landed first.
- **Root cause:** The playtests assumed a fast frame rate: they measured steps from polls and spent real time inside a timed window. Nothing had ever made the frames slow before.
- **Rule:** A playtest times things in simulation steps recorded where they happen (`phaseSince()`, the step counters), never by polling `ticks()` around an event, and does all its slow setup (layout reads, CDP sessions) before it starts anything timed. The game keeps Phaser's delta smoothing off, so the fixed-step loop holds real time on slow frames.
- **Recurrence 10 (2026-11-08, CI of PR #82):** `e2e/wallcling.spec.ts`'s real-keys kick test began waiting for the kick's rise (`vx > 0 && vy < 0`, which holds about 9 steps with that 60 ms press, measured by the review's sim probe) only after `keyboard.press('Space', { delay: 60 })` returned; on a slow runner the hold and the round trip outlasted the rise (1 in 5 locally). The wait is now started before the press and awaited after it, so its poll is running when the rise happens (20 of 20 locally); the review found two more kick waits that started after their press (the touch kick in the same file, about 16 steps, and the one-task Space tap in `e2e/subframe.spec.ts`, about 7), fixed the same way. The test predates the rule, and `realtime-waits` sees no `waitForTimeout` here: the press's own `delay` is the real-time span.
- **Recurrence 11 (2026-11-17, after PR #88):** `e2e/camera.spec.ts` ("the camera follows a drop and shows the landing", PR #102) read the camera on the first frame that saw Poncho grounded and asked for his feet in the band (116 to 156). After that drop the look-down on the ground pans 3 px a step from 125 to 108, and a frame runs up to 5 steps, so that frame shows 125 to 113 by where the landing falls in it: CI failed on 113 in one of each pair of runs on two heads, and on other branches before. Reproduced by shifting the walk's start 0 to 4 steps (113 at a shift of 4); more parallel load did not shift it, since the frames here always run 5 steps. Fixed: the landing frame asserts the range the rule allows at any alignment, and the exact lines (108, then 116 after `settleSteps`) are asserted paused and stepped. `realtime-waits` looks for real-time waits; a short-lived value read on the frame an event is first seen is one a pattern check cannot tell from a lasting one.
- **Recurrence 12 (2026-11-20, PR #114, GDD-BOS-04, found by CI's e2e job):** `e2e/catorce.spec.ts`'s "she telegraphs red" booted 3-4 and began reading her 30-step telegraph frame by frame only after the boot, which had started her telegraph already. On CI's slow runner most of it was over before the read, and 2 or 3 frames were left (the test wants more than 3). The timed thing was started by the boot, before the slow setup ended. The test now pauses, starts her phase afresh (`setCatorce(0)`) and resumes in the one evaluate that reads.
- **Recurrence 13 (2026-11-21, PR #114, GDD-BOS-04, found by the re-review):** the first test of the same spec, "3-4 opens by its address", waited on real frames for `ticks() > 5` and then read her x in a second call; under load she had left x 400 (read 396). Fixing recurrence 12 I changed the one test CI named and did not look for the same wait-then-read in the other tests of that file. It now restarts her phase, steps once and reads in one evaluate.
- **Recurrence 14 (2026-11-22, PR #120, GDD-BOS-04, CI's e2e):** the rewritten hit playtest checked the hurt flash on every frame with one hit, read over 12 animation frames after the hit; on CI's slow frames those ran past her 60-step hurt time into phase 2's telegraph, drawn red. The implementer's three local repeats never ran that slowly, and the plan did not say what the frames after the hit may hold; the read now ends when she leaves her hurt time and the check takes only frames whose mode is hurt, a white and a plain one required.
- **Recurrence:** 14
- **Promoted:** `scripts/check.mjs` (`realtime-waits`, after the eighth time: a new `waitForTimeout` or `setTimeout` in `e2e/` fails unless an `// L-042:` comment on its line says why real time is fine; the waits written before are counted per file) and .claude/skills/harness-playtest (Writing a scenario: time in simulation steps). Sixth time (2026-10-30, PR #60): the two sub-frame Claw tap tests in `e2e/subframe.spec.ts` waited a fixed 400 ms between taps to clear the 0.25 s cooldown; on a loaded runner (CI, and the reviewer's playtests running alongside) a tap landed in the cooldown and was rightly ignored. They now wait for each swing and then 21 steps. These tests predate the skill's rule: when a playtest file is touched, look for `waitForTimeout` or `setTimeout` used to clear a game timer. Third and fourth times (2026-10-25, GDD-MOV-06): the gamepad "held through the pause" test let real-time waits around the pause run Poncho into a door (found by the review of PR #51), and the Tlacuache screenshot scenario assumed where the Tlacuache had walked before the pause; both now step the game to a known state. No cheap rule tells a harmless real-time wait from a timed one, so the check added after the eighth time asks every new wait to say why instead. Second time, the same PR, in the full run after merging main: the touch stick speed test waited 300 ms of real time before reading the speed; under the parallel run the game lagged behind and he had not reached top speed. It now waits 18 steps. Fifth time (2026-10-26, GDD-ART-06): the desert backdrop textured the whole screen, the headless frame rate fell from about 29 to 10, and 13 playtests failed on real-time waits and tick polls. The backdrop now textures little (flat bands and a flat mountain foot, small images for the sun, clouds and dither), and the failing tests step the game in the page with `stepUntil` (`e2e/helpers.ts`). New art should be measured for its headless frame rate before the full suite runs. Seventh time (2026-10-31, PR #62): the new Retry playtest read the HUD hilo count before letting the game step 130 times, and Poncho slid over another hilo in those steps; it now reads the count after the steps it waits. Eighth time (2026-10-31, CI of PR #62): `e2e/touch.spec.ts` waited for the claw's phase to leave idle, a state of about 20 steps that a loaded runner's polls missed; it now waits for the swing counter. Rule kept: wait for a counter or a lasting state, never for a short-lived one. Guard: `scripts/check.mjs` (`realtime-waits`). Time 9 (2026-11-01, review of PR #65): the resumed-run screenshot paused on the step real time reached, while Poncho still blinked after the respawn, so the picture changed from run to run; it now steps in the page until the blink ends.

## L-043 A PR was merged before its deep review reported

- **Date:** 2026-10-25
- **Area:** process
- **What went wrong:** The user said "Merge" on PR #51 while the `pr-reviewer` agent was still running. CI was green, so I merged. The review came in afterwards with three blocking findings (a flaky gamepad playtest, the Decided 12 x 20 body box not built, stale GDD sentences), which then needed a follow-up PR.
- **Root cause:** CLAUDE.md says to fix the reviewer's blocking findings before telling the user the PR is ready, but I treated green CI as ready and did not tell the user the review was still pending when they asked to merge.
- **Rule:** Before merging, check that the `pr-reviewer` has posted its review on the current head. If it is still running when the user says merge, say so and ask whether to wait; merge without it only when the user says so knowing that.
- **Recurrence:** 1
- **Promoted:** `scripts/hooks/after-pr.mjs` (the reminder after a PR is created says the PR is not merged before the review is posted); `scripts/hooks/after-push.mjs` (after a push, the new commits get a re-review); `scripts/hooks/before-merge.mjs` (every merge asks the user first)

## L-044 A bigger body box broke a level route and no test noticed

- **Date:** 2026-10-26
- **Area:** level
- **What went wrong:** PR #52 grew the body box to 32 px. The Alacrán's platform and the piñata beside it then made one ceiling 48 px above the floor, and on foot Poncho could no longer climb the 2-tile wall from the left. No test or check failed; the dead end was found by looking at the level and was fixed a PR later (PR #53).
- **Root cause:** The level validator (GDD-TEC-04) checks spacing (enemies near respawns), not reachability, and the sandbox tests only covered single spots (a jump at a piñata, the pit hilo), not the route from the spawn through the level.
- **Rule:** A change to the body box, the jump or other movement numbers re-checks every level's main route on foot. The sandbox's route from the spawn past the door and up the 2-tile wall is a test in `src/levels/sandbox.test.ts`; extend it as the route goes further, and add a route test for each new level.
- **Recurrence:** 1
- **Promoted:** no

## L-045 Screenshots reached their state by shortcuts no player takes, and the pictures misled

- **Date:** 2026-10-26
- **Area:** playtest
- **What went wrong:** For level 0-1 (then 1-1) the clear-screen shot teleported Poncho straight to the exit, so it read "Hilos 0/50", and the user asked whether hilos were still collected. Collection worked, but nothing tested it in the new level. Then the phone tip shots started the level with Enter, which made the keyboard the device used last: the phone pictures showed keyboard words ("X to claw it") beside outlined touch buttons, and that same slip hid a design hole: the touch outline did not depend on the device in use. Two occurrences in one task, so it is promoted at once.
- **Root cause:** The shot scenarios were written for speed (teleport, `boot()` with Enter on every viewport), and the harness asked them only to assert the state they are named for (L-016), not to get there the way a player on that device would. A shortcut that skips play shows numbers and words that no player sees.
- **Rule:** In a screenshot scenario, start the level the device's way (`start(page, isMobile)` in `e2e/helpers.ts`: a tap on a phone, Enter on a desktop), and reach a screen that shows a count (hilos, lives) after collecting some in play, so the picture shows a count a player could see. A new level gets a test that its pickups are collected in play.
- **Recurrence 3 (2026-11-01, PR #67, GDD-CTL-03, found by the review):** the phone-only Button opacity shot started the level by a tap but reached the pause menu, the settings rows and the resume by keyboard, so the shots showed the keyboard's tip and no outline round the touch buttons; the rule named only how to start the level, not how to go on.
- **Recurrence:** 3
- **Promoted:** .claude/skills/harness-playtest (Screenshots for visual review) Guard: `scripts/check.mjs` (`phone-shots-by-touch`: a phone-only shot scenario presses no keys).

## L-047 A piñata was placed where its chile could not be reached

- **Date:** 2026-10-27
- **Area:** level
- **What went wrong:** The first 1-1 layout put the chile piñata 48 px above open floor, as the taco piñatas are. A chile does not walk (GDD-PWR-03), it rests on the piñata's top, 64 px above the floor, out of a jump's reach, so Fuego could not be had. A try with the piñata one tile lower failed too: under a 2-tile gap Poncho cannot rise, so he cannot bump it. The simulation found both before any test was written.
- **Root cause:** The piñata was placed by the bump rule alone, as for a taco, without following where the item it releases ends up.
- **Rule:** For every piñata in a level, say where each item it can release ends up and how Poncho reaches it from a standable spot, and test that route in the simulation (`src/levels/level1-1.test.ts` has one for the chile).
- **Recurrence:** 1
- **Promoted:** no

## L-048 A test bot held jump through two jumps and stood still

- **Date:** 2026-10-27
- **Area:** tests, input
- **What went wrong:** The 1-1 bot armed a new jump on the step its old one ran out, so jump was never released, no new press reached the simulation, and the bot stood against a block until the test timed out. The 0-1 bot has the same pattern and passes only because its layout never asks for a jump on that step.
- **Root cause:** A press is an edge (GDD-MOV-02), and the bot modelled a press as "the button is down".
- **Rule:** A test bot lets go of a button for at least one step before it presses it again.
- **Recurrence:** 1
- **Promoted:** no

## L-049 A scene made to replace another forgot what the old one held

- **Date:** 2026-10-29
- **Area:** ui
- **What went wrong:** For the Tutorial row (PR #58) Quit to title and a pick over another level began to replace the scene with a fresh one. Where the browser refuses storage, the fresh scene opened with the default volumes: a Master lowered to 8 came back as 10 (found by the review). The tutorial flag had a visit-level copy, the settings had none. The 0-1 to 1-1 change of PR #57 had the same hole, unnoticed.
- **Root cause:** The plan listed the state the new feature added (the tutorial flag) and gave it a fallback, but not the state the old scene already carried in memory and read from storage only once (the settings). Replacing a scene drops every field.
- **Rule:** When a change makes a new scene take an old one's place, list every field of the old scene that outlives a level (settings, flags, device in use) and say where the new scene gets each, then test each with storage refused.
- **Recurrence:** 1
- **Promoted:** no

## L-050 A plan's list of on-screen texts was taken from the scene alone

- **Date:** 2026-10-29
- **Area:** ui
- **What went wrong:** The language plan listed every translatable text by searching `src/scenes/PlayScene.ts` and the tips. The title's "Turn your device sideways" came from `titlePrompt` in `src/sim/title.ts`, a pure helper, and was missed; the implementer found it and changed the helper's signature.
- **Root cause:** On-screen text was assumed to live in the scene, but pure helpers in `src/sim/` and `src/ui/` return text the scene draws.
- **Rule:** To list the texts a change touches, search all of `src/` for quoted strings the scene draws (`grep -rn "'[A-Z][a-z]" src --include=*.ts`, tests excluded), not only the scene. A new on-screen text goes into `src/ui/text.ts` in every language and into the GDD's language table, never into a helper.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-feature (step 5, on-screen texts). Second time (2026-10-30, GDD-UI-02 results): the plan, written before the Language row merged, put "Time" in `clearTime` and the medal names in a `medalLabel` helper in `src/sim/results.ts`, in English only; found when main was checked before the PR, and moved into `TEXT`.

## L-051 Screen text lived in code apart from the GDD table it came from

- **Date:** 2026-10-29
- **Area:** gdd
- **What went wrong:** Nothing broke, but the GDD now holds 15 screen texts and 36 tip texts in three languages that the code repeats; a wording change in one place would leave the other stale with no test noticing.
- **Root cause:** The anchor rule ties tuning numbers to the GDD by hand; texts had no such tie.
- **Rule:** Texts quoted in the GDD are pinned by a test that reads `docs/GDD.md` (as `src/ui/text.test.ts` and the GDD-UI-05 tips test do), so the gate fails when they drift.
- **Recurrence:** 1
- **Promoted:** yes, to the tests `the GDD's table matches TEXT` and `every tip text is quoted in GDD-UI-05`

## L-052 Main changed a convention while the feature branch waited for approval

- **Date:** 2026-10-30
- **Area:** process
- **What went wrong:** The results-screen branch was planned and built on one `main`; while its screenshots waited for approval, two PRs merged (the Language row, then the Mexican Spanish wording). The branch's new texts did not follow the new text table, and only the user's "check main again" caught it, twice.
- **Root cause:** The work loop checks `main` at the start of a task (L-030) but not before the push, and a branch can wait a long time for the user's screenshot approval.
- **Rule:** Right before pushing a PR, `git fetch origin main`; if it moved, merge it (user, 2026-11-01: a draft PR opens after every push, so the branch is always pushed and is never rebased; `harness-feature`, Push and pull request) [before that: if it moved, rebase], read the new commits' GDD changelog lines for conventions the branch's new code must follow, rerun the gate and the touched playtests, and retake screenshots that the merged change affects.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-feature (Push and pull request step; it merges `origin/main` rather than rebasing a pushed branch); `scripts/hooks/stale-main.mjs` (before a push or a new PR it fetches `main` and asks when the branch lacks some of it)

## L-053 A changed process rule left other harness files stating the old one

- **Date:** 2026-11-01
- **Area:** harness
- **What went wrong:** When the user chose a draft PR after every push, `CLAUDE.md` and the feature skill were updated, but the `pr-reviewer` still made missing screenshot approval blocking on every PR (so each visible-change draft would get a false blocking finding), L-007's rule still said screenshots are approved before the PR opens, L-052's rule still said to rebase a pushed branch, and `docs/HARNESS.md` repeated the reviewer's rule. The verification before the PR found them.
- **Root cause:** The stale-sentence hunt (L-013) covers the GDD only. Nothing says that a rule changed in `CLAUDE.md` or a skill is also searched for in the other harness files, and `--lessons` now puts every lesson's Rule line in front of each session.
- **Rule:** When a harness rule changes, search `CLAUDE.md`, `docs/HARNESS.md`, `.claude/`, the PR template, the hook messages and the lesson rules (`node scripts/check.mjs --lessons`) for the old rule's words and its consequences, and fix every sentence it now falsifies, in the same commit.
- **Recurrence 2 (2026-11-01, PR #64, found by the review):** the same PR began updating lesson `Rule` lines (L-007, L-052) while the `docs/LESSONS.md` header still allowed only `Recurrence`, `Promoted` and `Area` to change; once the header allowed it, L-052's update still lacked the dated form it asks for (found by the re-review).
- **Recurrence 3 (2026-11-01, PR #64, found by the re-review):** the commit that made `docs/HARNESS.md` say a hook answering `ask` reads quoted text as written changed only `before-merge.mjs`; `stale-main.mjs` still emptied quoted text and missed `echo don\'t; git push origin HEAD; echo 'x y'`. Both now read commands through `scripts/hooks/command-text.mjs`.
- **Recurrence 4 (2026-11-18, PR #106, found by the review):** the new lesson L-091 gave the rule "after a PR merges, nothing more is pushed to its branch", which contradicts `CLAUDE.md` (restart the working branch from `main` under the same name). The step covers a changed rule, and a new lesson's rule was not read against the rules already in place.
- **Recurrence 5 (2026-11-22, GDD-VIS-05, found by an audit of the skills the user asked for):** the `pr-reviewer` still said "No wallet, token or on-chain feature (GDD-VIS-05)" and "no new network calls" after the user decided the first wave of section 16 and the game server (GDD-CHAIN-01, GDD-TEC-10; GDD 0.13.1), so each first-wave PR would have drawn a false blocking finding; its determinism line also named only `src/sim/` and two calls, behind GDD-TEC-09's first phase (GDD 0.13.2). This rule's search starts from a changed harness rule and L-013's hunt reads the GDD and the backlog, so a GDD decision that falsifies a harness file was searched for by neither.
- **Recurrence:** 5
- **Promoted:** .claude/skills/harness-retro (step 3: after a promotion or any rule change, search the other harness files and the lesson rules for the old rule and fix what it falsifies; step 2: a new lesson's rule is read against `CLAUDE.md` and the skills), and since recurrence 5 .claude/skills/harness-gdd-update (step 1: the hunt also reads `CLAUDE.md`, `docs/HARNESS.md` and `.claude/` for the touched IDs and the terms given, with `node scripts/check.mjs --gdd-hunt`, `scripts/gdd-hunt.mjs`). Guard: none (whether a changed rule falsifies a sentence elsewhere takes reading it; the instance of recurrence 3 is pinned by `scripts/check.mjs`, claude-settings: a hook that answers ask on shell commands must read them through command-text.mjs)

## L-054 A playtest compared the whole saved text, and every new part of the save broke it

- **Date:** 2026-11-01
- **Area:** playtest, tests
- **What went wrong:** `e2e/settings.spec.ts` ("the settings are kept after a reload") and a title test compared `localStorage` with the exact saved JSON. Adding `levels` (PR #63) and then `run` (PR #65) to the save each failed them in the full playtest run, though neither change touched the settings.
- **Root cause:** The tests pinned the whole serialised save, not the fields their rule is about, so any growth of the schema read as a regression.
- **Rule:** A test of the save parses the JSON and checks the fields its rule is about with `toMatchObject`; only a test of the save format itself pins the whole text.
- **Recurrence 3 (2026-11-01, PR #67, GDD-CTL-03, found by the review):** the new `buttonOpacity` field broke four `e2e/title.spec.ts` playtests that still compared the whole saved settings with `toEqual`; the implementer added the field to each instead of reading only the volume they are about, since the skill step covers new tests, not old ones met on the way.
- **Recurrence:** 3
- **Promoted:** .claude/skills/harness-playtest (Writing a scenario, step 7); `e2e/settings.spec.ts` now reads the parsed fields. Guard: `scripts/check.mjs` (`whole-save-pins`: no `toEqual` on the saved game or settings in `e2e/`).

## L-055 A lesson named a cause that was never checked

- **Date:** 2026-11-01
- **Area:** process, playtest
- **What went wrong:** For GDD-CTL-03, the first run of the "no vibration" playtest in `e2e/vibration.spec.ts` failed its own check that `navigator.vibrate` is gone. I switched the stub to `Object.defineProperty(..., { value: undefined })`, which passed, and wrote into this lesson that `delete Navigator.prototype.vibrate` does not work in Chromium. The `pr-reviewer` on PR #66 tried it, and a check in a clean page confirmed: the `delete` does remove it. The real cause: the check was `'vibrate' in navigator`, and Phaser's boot runs `navigator.vibrate = navigator.vibrate || ...` (`node_modules/phaser/src/device/Features.js`), which leaves an own property holding `undefined`, so `in` stayed true while `typeof` was `'undefined'`.
- **Root cause:** A cause was written into a lesson from one failed run, without a check that isolates it.
- **Rule:** Before a lesson names a cause (a browser or library behaving some way), reproduce that behaviour alone, in a few lines outside the test that failed; if it does not reproduce, the lesson says the cause is unknown. A playtest that stubs a browser API checks it in the page with `typeof`, never with `in`: Phaser assigns some `navigator` properties at boot.
- **Recurrence:** 1
- **Promoted:** no

## L-056 A mirrored layout reversed a pair of buttons whose order means something

- **Date:** 2026-11-01
- **Area:** ui, input
- **What went wrong:** The plan for the mirrored touch layout (GDD-CTL-03) placed every button at its geometric mirror image. That also reversed the left and right buttons, so the right button sat on the left and the left on the right. The tests checked the mirror formula, so they passed; looking at the screenshot showed it.
- **Root cause:** The plan treated "mirror" as a pure reflection of boxes, without asking which groups of controls carry meaning in their order.
- **Rule:** When a layout is mirrored, flipped or reordered, list every group whose order means something (a left and right pair, arrows, a menu's order) and keep that order; plan a test that the group reads in the right order, not only that each box moved by the formula. Look at the screenshot before the user does.
- **Recurrence:** 1
- **Promoted:** no

## L-057 Two commits of one PR each bumped the GDD version

- **Date:** 2026-11-03
- **Area:** gdd, process
- **What went wrong:** The lift fix (GDD-WLD-05) and level 1-3 (GDD-WLD-09) were built as two commits on a staging branch while the 1-2 PR waited to merge. Each commit went through `harness-gdd-update` and bumped the version, so PR #73 carried both 0.9.3 and 0.9.4. The `pr-reviewer` found it; the gate did not.
- **Root cause:** Step 2's "once per PR" was applied per commit: the commits were made before their PR existed, so there was no PR to count against, and nothing compared the GDD with `origin/main`'s.
- **Rule:** A branch adds one changelog version since `origin/main`; the second GDD commit on it amends that version's line. The gate compares the working tree's GDD with the one at the merge base (`gdd-one-version`, `scripts/gdd-version.mjs`). CI's gate job fetches the full history so the base exists there, and under CI a missing base fails the check rather than skipping it.
- **Recurrence:** 1
- **Promoted:** `scripts/check.mjs` (`gdd-one-version`, Guard: `scripts/gdd-version.mjs`)

## L-058 A staged feature was replayed onto the PR branch before its GDD text was ready

- **Date:** 2026-11-03
- **Area:** process, gdd
- **What went wrong:** After #73 merged, I replayed Don Zopilote's build from its local staging branch into the main checkout, then started agents to check its GDD draft against the merged code. Waiting on them meant ending a turn, and the session's stop hook (it checks the main checkout only) asked for the uncommitted changes to be committed and pushed. So 0b80c39 pushed `BOSS`, `FRUIT`, `ROCK` and `BOSS_BAR` in `src/config/tuning.ts` with no GDD numbers for them, against the rule that a tuning number and its GDD text change in the same commit (CLAUDE.md), and the PR opened as a work in progress.
- **Root cause:** The replay was done as the first step instead of the last: the GDD check needed the merged code, but it could have read it in the staging worktree, where uncommitted work does not trip the stop hook.
- **Rule:** Keep a staged feature on its staging branch or worktree until its GDD text is ready; check the GDD draft against the code there, and replay code, GDD and backlog onto the PR branch together, in one commit, right before the gate and the push.
- **Recurrence:** 1
- **Promoted:** no

## L-059 A sprite frame drawn without checking where the game shows it hung below the floor

- **Date:** 2026-11-04
- **Area:** art
- **What went wrong:** Don Zopilote's hurt and defeated frames (PR #75) were drawn with his wings lowered, as in the design canvas, where he hovered in the sky. In the game he is hurt on the floor after a claw hit and lies there defeated, with his box's bottom on the floor's top, so the wings hung 12 to 16 px below it, in front of the ground tiles. The art tests checked the palette, the outline and the crown, not where each frame is shown; the reviewer found it in the screenshots.
- **Root cause:** The frames were designed one by one as poses, not against the places the game draws them: the plan listed which mode picks each frame, but not where his box is in that mode.
- **Rule:** When planning a sprite's frames, list for each frame every place the game shows it (in the air, resting on the floor, rising from it, against a wall, on a sand slope), pin in an art test how far each frame reaches past its box and that none is cut off by its frame's edge, and test over the real level or fight that at every step the frame shown fits the room it has there, slope sand counting as ground and the player placed so that every frame is posed (`scripts/art/boss.test.mjs`, `src/levels/level1-4.test.ts`, `scripts/art/enemies1.levels.test.mjs`).
- **Recurrence 2 (2026-11-04, PR #75 re-review):** my fix for the first finding checked only the frames shown resting on the floor; the reviewer measured the fight and found the flap's lowered wings 2 to 14 px into the floor for the last 5 steps of every phase 2 drop and the climb's for 4 steps off the floor. The same check also showed the lowered wings had been cut off by the frame's bottom edge, which the outline test missed because it treated the edge as filled. Now: the lowered wings are shorter and fit their frame, an edge counts as empty in the outline test, the art test pins that only the lowered wings reach below his box (14 px, `BOSS_ART.wingsBelow`), `bossPose` keeps them raised within 14 px of the floor, and a test runs the bot through the whole 1-4 fight checking every frame shown against the floor.
- **Recurrence:** 5
- **Promoted:** .claude/skills/harness-feature step 5 (Sprite frames; the fifth time, 2026-11-08, PR #80 review: the walking taco's and the piñata chile's bob frames reached below their feet, unpinned, and the guard passed because it matched names as substrings, so `sprites/poncho.png` counted for the `sprites/poncho/` folder; the guard now names folders with their trailing slash; since the fourth time it names slopes and asks that every frame be posed: 2026-11-05, PR #79 re-review, the first level test counted only level tiles as ground and kept Poncho at his spawn, so slope sand and every reaction frame went unchecked; the guard below ensures a fit test exists, not that it covers the frames). Guard for Don Zopilote: `scripts/art/boss.test.mjs` ("only his lowered wings reach below his box") and `src/levels/level1-4.test.ts` ("through the whole fight no frame of his reaches into the floor"); a new sprite got its own only from the skill step, until the third time (2026-11-05, PR #79 review: World 1's enemy sprites shipped with neither test; the plan, written from the art brief, never applied the skill step, and the Tlacuache's tail was drawn 5 px over pen walls unpinned). Guard: `scripts/check.mjs` (`sprite-fit`, `scripts/sprite-fit.mjs`): every character sprite sheet must be named by a test that cites L-059.

## L-060 Parallel worktrees on one machine would run their playtests against each other's dev server

- **Date:** 2026-11-04
- **Area:** harness, playtest
- **What went wrong:** For World 2, several agents built streams in parallel git worktrees on one machine. `playwright.config.ts` fixed the dev server on port 4173 with `reuseExistingServer`, so a second worktree's `npm run test:e2e` would have reused the first one's server and tested the other tree's code, passing or failing for the wrong reasons. Only one stream could be allowed to run playtests at a time, and the others shipped specs marked "not run".
- **Root cause:** The port was a constant in the config, written when only one checkout ever ran the playtests.
- **Rule:** Each worktree that runs playtests next to another sets its own `PONCHO_E2E_PORT` (the config reads it for the server, its URL and `baseURL`; 4173 stays the default for CI and a single checkout).
- **Recurrence:** 1
- **Promoted:** no

## L-061 The swarm's worktrees were cut from main, not from the branch they were to build on

- **Date:** 2026-11-04
- **Area:** process
- **What went wrong:** The agents launched with `isolation: worktree` for World 2 got worktrees at `origin/main` (b43756c), not at the session branch's head, which held the World 2 GDD sections and the Mercado art. The gate's GDD-ID check failed for them until each agent noticed and moved its tree onto the branch, and the plumbing stream wrote 27 files on the old base before the main session told it to fast-forward.
- **Root cause:** A worktree is made from the repository's default base, not from the checkout's current branch, and the launch prompts did not say which commit to build on.
- **Rule:** A prompt that launches an agent in a worktree starts with the exact command to put the tree on the branch head it builds on (`git fetch origin <branch> && git reset --hard origin/<branch>`, the branch pushed first), before the agent writes anything.
- **Recurrence:** 1
- **Promoted:** no

## L-062 Playtests pinned the stub levels' numbers, and the real levels broke them

- **Date:** 2026-11-04
- **Area:** playtest, level
- **What went wrong:** `e2e/world2.spec.ts`, one test of `e2e/world1.spec.ts` and three scenarios of `e2e/shots/mercado.spec.ts` were written while 2-1 to 2-3 were stubs and hard-coded their numbers: the 4-tile gap at columns 40 to 43, the exit at x 1400, the spawn at x 40 and the stub's decor list. When the real levels landed, seven playtests failed on both viewports and three screenshot scenarios failed, in the full run only; each was re-anchored on the level module (`pits()` over `LEVEL_2_1.world`, `LEVEL_2_1.exit`, `LEVEL_2_1.spawn`, `plantSpots(LEVEL_2_1, MERCADO.decor)`).
- **Root cause:** The specs copied positions out of the level by hand instead of reading them from the level data they play, and the commit that replaced the stubs ran the specs of the new features, not every spec and shot scenario that opens those levels.
- **Rule:** A playtest reads where things are in a real level (pits, exit, spawn, decor, enemies) from the level module it plays (`import { LEVEL_x_y } from '../src/levels/...'`), and comments any number it must hard-code; a commit that changes a level's data runs every spec and shot scenario that opens it (`grep -rln "level=<id>" e2e`). More generally, a change that replaces a stand-in (a stub level, a placeholder drawing) plans the rewrite of every spec that pins the stand-in's details.
- **Recurrence 3 (2026-11-10, PR #91, GDD-PWR-04, found by the review, optional):** the new playtest and sandbox test found the special piñata by its index (`k === 2`, `pinatasOpen[2]`) instead of reading it from `SANDBOX_PINATAS`; the plan put the new piñata last so old indexes would stay, which made the hard-coded index look safe.
- **Recurrence:** 3
- **Promoted:** `.claude/skills/harness-feature/SKILL.md` step 5, "Stand-ins (L-062)": the plan greps the specs for the stand-in's details and lists how each is rewritten (second time, 2026-11-04: world 1's enemy sprites replaced the placeholder drawings, and ten playtests in `enemy`, `cactus`, `tlacuache` and `zopilote.spec.ts` failed on both viewports: they asserted the placeholders' colours (`#9a3a2a`, `#4f9a4a`, `#ff5030`) and fixed feet pixels. The plan said those specs "must stay green unchanged", so they surfaced only in the implementer's full run and cost a second round; the rule above covered level numbers, not placeholder looks). Guard: none (a number in a test cannot be told apart, by a script, from one that is meant; the plan names the level module to read from, and the pr-reviewer checks it).

## L-063 Playtests in one checkout reloaded mid-test while other worktrees ran their own

- **Date:** 2026-11-04
- **Area:** harness, playtest
- **What went wrong:** During World 2's build, playtests in the main checkout failed four times with "Execution context was destroyed, most likely because of a navigation" (block, cactus, the 1-2 and settings shots), each early in a run and each passing alone. Agent worktrees were running their own dev servers at the time, every worktree with `node_modules` symlinked to the main checkout's.
- **Root cause:** Vite keeps its optimized dependencies in `node_modules/.vite`; with `node_modules` shared, every dev server used the same cache, and one server re-optimizing it made the others reload their pages (the most likely cause: the failures stopped once only one server ran).
- **Rule:** A dev server for playtests on its own port (`PONCHO_E2E_PORT`, L-060) also has its own Vite cache (`vite.config.ts` derives `cacheDir` from the port), so parallel worktrees never share it.
- **Recurrence:** 1
- **Promoted:** no

## L-064 A mutant that loops forever hung the whole mutation run

- **Date:** 2026-11-04
- **Area:** tests, harness
- **What went wrong:** For World 2's enemies, the mutant "awning wins over tile" turned a test's open-ended `while` loop (step until the Chapulín lands) into an endless one. `scripts/mutate.mjs` waited on it with no limit, so the run hung until the worker was killed by hand, and the remaining mutants never ran in that pass.
- **Root cause:** The runner gives a mutant's test command no time limit, and the tests had loops bounded only by the behaviour under test, which a mutant may remove.
- **Rule:** Bound every loop in a test by a step count (`for (let i = 0; i < N && !done; i++)`), never by the behaviour alone; a mutant that hangs counts as killed only once it is stopped, and is re-run after the loop is bounded.
- **Recurrence 2 (2026-11-23, the mutant suggestions, L-010):** a suggested mutant of the new `scripts/mutant-suggest.mjs` made its widening loop endless, and the runner sat on it for ten minutes until the shell's own limit moved it to the background; I had taken a bound out of that loop as one no test could reach. The rule bounds loops in tests, and nothing bounded a loop in the code a mutant changes, nor the runner's wait.
- **Recurrence 3 (2026-11-23, PR #125, found by the pr-reviewer):** the time limit added for the last occurrence ended the runner's wait and not the test: the limit signalled only the shell the runner had started, and the Vitest process under it ran on at full CPU after the runner reported it stopped. I had checked the limit with a `sleep`, which ends by itself, so nothing showed what was left running. The limit now kills the test's whole process group, and a test starts a child that would outlive its shell and checks that it is gone.
- **Recurrence:** 3
- **Promoted:** `scripts/mutate.mjs` (a mutant's test is stopped after 300 seconds, or the file's `timeout`, with everything it started, and reported as stopped and not caught). Guard: `scripts/run-limited.test.mjs`

## L-065 Parallel agents overwrote each other's helper scripts in the shared scratchpad

- **Date:** 2026-11-04
- **Area:** harness, process
- **What went wrong:** Four artist agents drew World 1's enemies in parallel and each wrote its zoom helper to the scratchpad's top level as `zoom.mjs`; they overwrote one another's, and three of them lost a review round finding out and moving their files into subfolders.
- **Root cause:** The brief gave every agent the same scratchpad path and no folder of its own, so the same obvious file names collided.
- **Rule:** A brief for parallel agents gives each one its own scratch folder (`<scratchpad>/<agent's task>/`) for every file it writes there, and names any shared output path (a preview image) per agent.
- **Recurrence:** 1
- **Promoted:** no

## L-066 The user rejected art the main session had passed on without its own side-by-side review

- **Date:** 2026-11-08
- **Area:** art, process
- **What went wrong:** For Poncho's front-view victory pose, the main session sent the artist's previews to the user after checking only the numbers it had asked for (rows, widths). The user answered "now your slacking ... do consistent work": next to the side drawing the front view was flat, its poncho a plain box, its ears cut-outs. Three more rounds followed, two of them failing the main session's own later side-by-side review (a noisy poncho, a pompom crown, round "innocent" eyes against the references' determined ones).
- **Root cause:** The main session reviewed the artist's measurements, not the picture: it did not set the new art beside the approved sprite and the user's references at the same scale before showing it, so craft gaps a glance would catch reached the user.
- **Rule:** Before showing art to the user, the main session builds one sheet with the new art, the approved art it must match and the user's references, at the same height and at game size, and reviews it against a written list (silhouette, shading depth, pattern, face, proportions); it sends the art only when every item passes, and says in the message what it checked.
- **Recurrence 2 (2026-11-15, PR #100, the Cacomixtle, found by the user and the re-review):** the main session sent the ringtail's first drawing to the user after reading only the builder's numbers and the in-game shots, where it is small. The user then asked whether its style was coherent with the bestiario. Set beside the other enemies, it faced the viewer while every other enemy is in profile, and it had a hamster's round body and flat shading. It was redrawn. Nothing made the comparison a step: the rule above was prose in a lesson, which no skill named.
- **Recurrence:** 2
- **Promoted:** scripts/art-lineup.mjs (puts sheets at one scale and the user's references at one height on one image, from folders or files, with unit tests), and .claude/skills/harness-feature step 8 (run it with the new art, the approved art and the references, and review it against this rule's list before showing new art)

## L-067 A plan too big for one implementer run stopped at the turn limit

- **Date:** 2026-11-08
- **Area:** process, harness
- **What went wrong:** The plan for Poncho's animations in the game (the sheet, the pose module, the scene, the items, the stand-in specs, the level fit test, 80 mutants, the shots) ran the implementer into its 150-turn limit with no report; it had to be resumed to finish.
- **Root cause:** One plan held several features' worth of work, and nothing sized a plan against the implementer's turn budget.
- **Rule:** A plan with more than about four independent parts (art build, pure logic, scene wiring, playtests, rewritten specs, mutants) is split into phases, each its own implementer run with its own report; the main session checks each before starting the next.
- **Recurrence 2 (2026-11-11, PR #97, GDD-ART-06):** the run that drew the Sierra's canyon set hit the 150-turn limit with no report and was resumed. The PR was split into five runs by subject, but that one still held six parts (the art build and its tests, the scene's art set, the rock ledge's look, the lives' outline, a test level's ledges, the screenshots): the rule was in this file only, and the plan step of the skill did not ask for a count.
- **Recurrence 3 (2026-11-12, GDD-ART-06, the mine's look):** the run that drew the mine set, a level's place, the mine lab and the back wall stopped at the turn limit with no report (200 tool calls) and was resumed. Its plan had four headed parts, so the count passed, but the parts held six sheets, the place's plumbing, a test level, the back wall with 3-1's rectangles, two hooks, a playtest and a shot spec. Three other runs of the same day with plans as long (98 to 119 lines) finished: the length did not tell them apart, the number of things to deliver did.
- **Recurrence 4 (2026-11-17, GDD-WLD-18, 3-3's enemy drives):** the B1 run stopped at the turn limit with no report and was resumed with an ordered list, which finished it. Its plan had five headed parts holding seven deliverables (the drive module, the periods, three Cacomixtle drives, the fall onto K3's cart, the bats, the Armadillo, the checkpoints), and the main session did not count them before launching it.
- **Recurrence:** 4
- **Promoted:** .claude/skills/harness-feature (step 5, Plan size: a headed part that holds several deliverables counts as several). Guard: none (plans are not committed, and their length in lines did not tell the run that stopped from the three that finished; what counts is the number of deliverables, which the main session counts when it writes the plan; a run that stops is resumed with SendMessage and an ordered list, which finished this one in one more leg)

## L-068 A one-row sprite sheet grew past the texture size a phone can load

- **Date:** 2026-11-08
- **Area:** art
- **What went wrong:** The plan asked for Poncho's 31 frames in one row; the sheet came out 5952 px wide, past the 4096 px texture limit of some phones' WebGL, and had to be wrapped into rows of 8.
- **Root cause:** The plan copied the one-row layout of smaller sheets without checking the width the frame count gives.
- **Rule:** A sprite sheet stays at most 4096 px on each side; a plan names the sheet's columns when its frames would pass that in one row, and the art test pins the width (`scripts/art/poncho.test.mjs` does).
- **Recurrence:** 1
- **Promoted:** no

## L-069 A new state changed some of what the scene draws an object with, not all of it

- **Date:** 2026-11-08
- **Area:** ui, art
- **What went wrong:** For the victory pose (PR #81) the plan gave Poncho's body a new depth and new frames on the clear screen, but `renderBody` also sets its alpha from the hit's invulnerability every frame; the clear screen freezes that counter, so a player who reached the exit mid-blink saw the whole victory at 30% (found by the review).
- **Root cause:** The plan listed what the new state should change and not what the draw code already applies to the same object each frame, so a setting meant for play carried into the new state.
- **Rule:** When a plan puts an object into a new state (a screen, a phase, a mode), list every property the scene sets on that object each frame (`setAlpha`, `setVisible`, `setDepth`, `setFlipX`, tints, positions; grep its draw function) and say for each what it is in the new state, with a test for each one that a counter frozen by the state could leave wrong.
- **Recurrence:** 1
- **Promoted:** no

## L-070 The PR description still described the first commit after the work had moved on

- **Date:** 2026-11-08
- **Area:** process
- **What went wrong:** PR #81 opened as "design in progress, not in the game yet"; two commits later the game played the victory, but the description still listed that work as next and its checkboxes unchecked (a blocking finding of the review).
- **Root cause:** The description was edited when the design changed, not when the scope changed; nothing ties a push to a reread of the description.
- **Rule:** After every push that changes what the PR does (a phase landed, a GDD version, new playtests), rewrite the description's Scope, checks and Notes to match the head before launching the review.
- **Recurrence 2 (2026-11-09, PR #89, found by the review):** after the fix commit for the first review the description still said the backdrop stays still and there were no screenshots, and listed 49 mutants; the replies on the threads were updated, the description was not.
- **Recurrence 3 (2026-11-17, PR #88, found by the review):** after the merge of main was pushed, the description still described the rsync deploy, GDD 0.11.0 and lessons L-075 to L-077. The reminder never showed: the session ran on the user's server, where no `node` was on the PATH that hooks run with, and every hook fails open (L-089).
- **Recurrence:** 3
- **Promoted:** scripts/hooks/after-push.mjs (the reminder after every push now says to rewrite the description's Scope, checks, Screenshots and Notes to match the head before the re-review; tested in scripts/hooks/after-push.test.mjs). Guard: `scripts/hooks/after-push.mjs`

## L-071 The implementer unstaged a deleted file with `git reset`

- **Date:** 2026-11-08
- **Area:** harness, process
- **What went wrong:** the GDD-ENM-03 plan said to delete the placeholder module `src/ui/mercadoEnemies.ts` and its test. The implementer removed them with `git rm --cached`, then ran `git reset` to unstage them, a command its own rules forbid. The index was clean before and after, so nothing was lost.
- **Root cause:** the plan named a deletion of tracked files but not how to make it. The implementer reached for git's own delete, which stages the deletion, and then needed a forbidden command to take the staging back.
- **Rule:** a plan that deletes or moves a tracked file says to do it in the working tree only (`rm`, `mv`, or the Write and Edit tools), never with `git rm` or `git mv`. The main session stages everything when it commits.
- **Recurrence:** 1
- **Promoted:** no

## L-072 A plan asserted things about approved art without measuring the art first

- **Date:** 2026-11-08
- **Area:** art, tests
- **What went wrong:** the GDD-ENM-03 plan's art tests said the Chapulín's leaf green is the most-painted colour in its crouch frame, and that the Paloma's flight frames leave the bottom row empty. On the approved drawings, iron outnumbers the leaf (its shadow), and the glide frame's dangling feet reach the bottom row. Neither test could pass without changing art the user had approved, so the implementer had to stop and choose its own reading.
- **Root cause:** the main session wrote the expected values from what the art was meant to be, not from the drawing the user approved, which was already in the tree.
- **Rule:** before a plan pins a property of an approved drawing (a dominant colour, a size, an edge, a reach), measure it on the drawing (a few lines over `drawFrames()`) and write the measured value, or a rule the drawing meets, into the plan.
- **Recurrence:** 1
- **Promoted:** no

## L-073 A playtest loop of many page round trips ran close to the 30 s limit

- **Date:** 2026-11-08
- **Area:** playtest
- **What went wrong:** the GDD-ENM-03 flip check in `e2e/enemies2.spec.ts` stepped the game, waited two frames and read the enemies back in about 60 separate rounds, each with several `page.evaluate` calls. Alone it took 24 to 26 s of the default 30, and under load it timed out on desktop and phone (found in the review of PR #83).
- **Root cause:** the loop was written one page call at a time, as a single check is, and the run was never timed on a busy machine.
- **Rule:** a playtest that steps and reads back in a loop runs the whole loop inside one `page.evaluate` (stepping, waiting for frames and collecting what it reads), and asserts on what it returns, as the Chapulín test in `e2e/enemies2.spec.ts` does.
- **Recurrence:** 1
- **Promoted:** no

## L-074 A per-frame value was worked out from the upright screen's layout while the rows were hidden

- **Date:** 2026-11-09
- **Area:** ui
- **What went wrong:** the settings list's scroll (GDD-UI-02, PR #87) was worked out on every frame from the rows' height, upright frames included, where the rows are taller and fewer fit. Turned upright and back, the list had scrolled (`first` 0, then 3, then 1), against the GDD's "the list keeps its scroll". The upright playtest passed only because it picked Back, where the clamp happens to give the same scroll (found by the review).
- **Root cause:** the plan said where the scroll is used but not on which frames it may change; the hidden (upright) state was not listed as a state the value must survive, and the test chose the one row for which the bug cancels out.
- **Rule:** a value the scene keeps across frames and works out from a layout (a scroll, a chosen place) is only changed on frames where that layout is shown; a plan names each state that hides it (upright, paused, a screen over it) and plans a test through each with a case where the value would change (not one where a clamp lands on the same value).
- **Recurrence:** 1
- **Promoted:** no

## L-075 A moving floor was tested only with the rider at its middle

- **Date:** 2026-11-11
- **Area:** tests, level
- **What went wrong:** The cart's first build (GDD-WLD-15, PR #94) gave it a floor flat under its middle, and every test and bot stood within 4 px of the middle. The review swept riders across the cart and found that one standing behind the middle was left on the plateau where the rail turns down (175 of 503 hops into the lab's descending cart); a second sweep found that hopping in with forward held walked him out of the front. Both were rule faults, fixed by a floor that follows the rail and walls that hold a rider.
- **Root cause:** The plan's tests each placed Poncho at one convenient spot on the thing he stands on, so the rule was only ever exercised there; nothing swept where he can stand, how he can arrive, or what he can be holding.
- **Rule:** A rule about something Poncho stands on or rides (a cart, a platform, a block, an awning) is tested over the range of where he can stand on it (its ends and its middle), at every join or turn of its path, and with each direction held and nothing held; and over the real level by a sweep of the ways he can arrive (takeoff positions and jump lengths), which asserts what every arrival that boards ends in.
- **Recurrence 2 (2026-11-18, PR #105, GDD-WLD-18, found by the builder):** the main session's probe for the vulture over 3-3's P5 stood him on the lift MP2 at one x (3200), so "MP2 is never seen" held there only: its left part, x 3179 to 3192, rode up into the vulture's sight and lost the life at up to 104 of 300 clocks. The rule was in this file only, not in a skill the plan is written from.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-feature (step 5, placement rules: a claim about what he stands on or rides sweeps where he stands on it, across each seam 1 px apart)

## L-076 CI's playtests never ran because the runner could not reach its package mirror

- **Date:** 2026-11-11
- **Area:** harness, playtest
- **What went wrong:** On PR #95 CI's `e2e` job failed on five commits in a row, and on a re-run of each job, at `npx playwright install --with-deps chromium`: apt could not resolve the runner's Ubuntu mirrors, so ten font packages were not fetched, the step failed after about ten minutes and the Playtests step was skipped. No playtest ran in CI on the PR's later commits, and it was merged on a local run of the whole suite (886 passed), with the user's say-so.
- **Root cause:** One step both downloaded the browser, from Playwright's own host, which was reachable, and installed system packages from a mirror outside the project's control, and a failure of the second skipped the tests, though the runner image already has the libraries the browser needs and only extra fonts were missing.
- **Rule:** In CI a step that fetches something the tests can run without (extra system packages from a distribution mirror) is separate from the steps the tests need, is retried within a time limit, and ends in a warning, never in skipped tests. When CI's playtests cannot run for a cause outside the PR, the whole suite is run locally on the PR's head and the description says so, before anyone is asked to merge.
- **Recurrence:** 1
- **Promoted:** `.github/workflows/check.yml` (the `e2e` job's two install steps) and docs/HARNESS.md (Playtesting)

## L-077 A plan's rule failed the plan's own test cases and an existing fixture

- **Date:** 2026-11-11
- **Area:** process, tests, level
- **What went wrong:** The plan for World 3's gap rule (GDD-WLD-03, PR #97) defined a gap's headroom as counted over the right bank's column too, so every gap that rises read its own far bank as a roof and the plan's rise cases could not pass. One of its tests could not kill the mutant it named, the problem text for a level gap was left open, and an existing validator fixture (a World 3 pit with a 7-tile rise) broke the new rule. The implementer stopped on the three contradictions and the part was replanned as its own run.
- **Root cause:** The rule was written as a sentence and its tests as a table, and neither was worked through the other: no test case was evaluated by hand against the definition before the plan went out, and the existing fixtures of the file the rule lands in were not read for ones the rule would newly fail.
- **Rule:** Before a plan with a new validator or simulation rule goes to the implementer, work two of its own test cases through the rule's definition as written (one that must pass, one that must fail, with the numbers), and grep the test file the rule lands in for fixtures of the same kind (the same world, the same flag) that the rule would newly reject; the plan says what happens to each.
- **Recurrence 2 (2026-11-15, PR #100, GDD-ENM-04):** the Cacomixtle's plan put the sight-edge tests' Poncho on the ground at 0 and 1 px ahead, where his box already overlaps the ringtail's and he is hit on step 1, and it named a `lookOf` case that cannot compile, because `lookOf` takes a sheet, not a kind; the implementer had to rework both. The rule was in no skill step, so the plan was never checked against it.
- **Recurrence 3 (2026-11-16, the camera's look-ahead, GDD-UI-04, found by the implementer):** the plan expected the descending cart to hold him at the 40% line. But the plan's own pan, 3 px a step, gains only 0.88 px a step on a cart going down at 2.12, so the line is never reached on the ride. It also expected his feet to end on the band's edge at the lift's top, where the camera is clamped at the level's top. The skill step was in place and named the rule. I wrote the cases as expected outcomes, not worked numbers, and nothing checked that the step was done. The review then found a third case from the same plan: in the look-up a one-tile walk-off started the fall's look-down at once and swung the camera back, because the plan never worked a short drop from the 60% line.
- **Recurrence 4 (2026-11-16, 3-3's prerequisites, GDD-ENM-04, found by the implementer):** the plan's new validator clause (h), a Cacomixtle's cart clear of the phone's Jump button, failed all 13 existing Cacomixtle fixtures in `validate.test.ts`: they stand on a 17-row level's floor at y 224, where the camera cannot move and every cart shows 16 px over the button's top. The plan worked the new rule's own cases (the hook made it), but the rule's other half, grepping the file's existing fixtures, was prose in the skill step that nothing checked, and the implementer stopped with the gate red.
- **Recurrence 5 (2026-11-17, PR #103, 3-3's layout, found by the implementer):** two worked cases in the plan were worked from a formula I wrote from memory instead of the code: the camera's bottom limit as `row · 16 − 272` where `cameraLimitsAt` uses the row's bottom line, `(row + 1) · 16`, 16 px off; and C1's dip let R1's climb run through G0's solid tile at column 7, which the plan never checked against the tiles. Both were caught by the measurement, not by the hook, which proves cases were written, not that they were worked against the code.
- **Recurrence 6 (2026-11-19, GDD-BOS-04 phase A, found by the implementer):** test 25 expected a ridden-off cart to break on La Catorce and Poncho to lose his life to her roof in the same run. He falls faster than the cart (he leaves its floor at once and falls under his own gravity from the rail), so he loses the life about 18 steps after leaving, before the cart reaches her, and the run ends there. The plan's worked cases covered the hit, the miss, the ridden mark and the return, but not this test's order of events. The hook only checks that worked cases exist.
- **Recurrence 7 (2026-11-19, 3-3's camera along the bots, GDD-WLD-18, found by the implementer):** the plan worked its camera cases from where I guessed he stood, not from a bot's run: it put the chasm landing at x 1590 to 1620 (it is 1665 to 1677) and expected K2's rail and K3's cart not to be whole on screen (both are). Its limits check also counted the respawn wait, where the camera holds by GDD-UI-04 while his x is still the column he fell in, which tripped the plan's own "camera bug" stop. The worked-cases section existed, as the guard asks, but a position the code had not produced was written as a number; where a case needs a place a bot reaches, the plan should say "measure" rather than guess one.
- **Recurrence 8 (2026-11-19, GDD-BOS-04 phase B, found by the implementer):** three worked cases were wrong against my own scratch probe or the rules: "let go at x 220 lands on home from every perch tile" (the probe's own row from x 56 landed on the floor); the timed spring launch "pressed on the step he reaches the spring" (GDD-WLD-05's timed launch is a press on landing from a hop); and the bot's "home at once" from the perch (he lands sliding at the cart's speed, and a jump in the slide goes the wrong way). The worked-cases section copied the probe's summary instead of its rows, and the bot's steps were not run through the probe.
- **Recurrence 9 (2026-11-20, the sight sweep's jump reaction, GDD-WLD-03, found by the implementer):** the plan worked the fixture's margin from "a Cacomixtle's cart rolls at 120 px/s (GDD-ENM-04)", a number the GDD does not give: `CART.speedLevel` is 150 px/s, and the first rail the implementer built left only 59 steps from the landing to the hit, short of the plan's 72. The figure was quoted from memory with a GDD ID on it, which made it look sourced, and the hook only checks that worked cases exist.
- **Recurrence:** 9
- **Promoted:** `harness-feature` step 5, "Work the cases through (L-077)", which since Recurrence 3 asks for a `## Worked cases` section in the plan and for expected values to be worked against speeds and limits, and since Recurrence 4 for an `## Existing fixtures` section. Guard: `scripts/hooks/before-implementer.mjs` denies launching the implementer when the plan has no worked-cases section with at least two lines carrying numbers, or no existing-fixtures section with a line in it (tested in `scripts/hooks/before-implementer.test.mjs`). It proves the steps were written down, not that they are right.

## L-078 A failed gate stopped the chained commit, and the push that followed pushed nothing

- **Date:** 2026-11-11
- **Area:** process
- **What went wrong:** On PR #97 I changed a validator message ("1 tiles" to "1 tile") after the last gate run and then ran the gate chained to the commit with its output sent to a file. A test that pinned the old text failed, so the commit did not happen (L-012's rule held), but the next command pushed the unchanged branch and I went on as if the fix were on the PR until `git status` showed the files still modified.
- **Root cause:** The gate's result was not read before the next step: with the output in a file, a failure prints nothing, and nothing compared the branch's head before and after.
- **Rule:** The command that runs the gate and commits ends by showing what happened (`node scripts/check.mjs > gate.log 2>&1 && git commit ... ; echo "exit $?"; git log -1 --oneline; git status --short`), and the push is its own command, made only after reading that the head moved. An edit after a green gate, however small, means the gate runs again before the commit.
- **Recurrence 2 (2026-11-15, PR #100):** I chained the gate, the commit and the push in one command with the gate's output sent to `/dev/null`; the implementer's half-written code failed the gate, and all I saw was `exit 1`, so I had to rerun the gate to learn why. The rule was prose only, and nothing denied the chained push.
- **Recurrence:** 2
- **Promoted:** `scripts/hooks/gate-pipe.mjs` denies a push chained after a gated commit (tested in `scripts/hooks/gate-pipe.test.mjs`); `harness-feature` step 12

## L-079 Builders' gates in parallel worktrees failed on 5 s test timeouts

- **Date:** 2026-11-12
- **Area:** harness
- **What went wrong:** With four builders running at once (the main checkout and three worktrees), the gate failed five times across two of them on test timeouts only: at a load of 11 to 24 on 4 cores a level test that takes 4 s alone took 8 or 9 s, a different set of 3 to 8 tests each run, in files the builder had not touched, and `test:glide` failed too. Each failure cost a full gate rerun and a check that the change was not the cause.
- **Root cause:** Vitest's default limit of 5 s per test was left as it was while the level tests grew to seconds each; the limit guarded nothing (a hung test is caught at any limit) and measured the machine's load.
- **Rule:** The unit test runs set `testTimeout` to 30 s (`vite.config.ts`, `vitest.abilities.config.ts`, `vitest.glide.config.ts`); a test that needs more gives its own, at least 4 times its time run alone. A timeout under load is re-run alone before it is called a failure.
- **Recurrence 2 (2026-11-18, PR #105, GDD-WLD-18, found by the review in CI):** 3-3's vulture tests gave their own limits at 2 times their local time alone, and CI ran the heavy 3-3 files in parallel on a slower runner: the ground test took 235.6 s against 215, the blind pin 159.9 against 130, and four more timed out. The rule said only that a test gives its own limit, not how much over its time.
- **Recurrence:** 2
- **Promoted:** vite.config.ts, vitest.abilities.config.ts, vitest.glide.config.ts (`testTimeout: 30000`); .claude/skills/harness-feature (step 5, plan size: a test's own limit is at least 4 times its time alone)

## L-080 A plan narrowed the GDD's "every ground" to tile tops, and the lab's perch broke the rule unseen

- **Date:** 2026-11-15
- **Area:** process, level
- **What went wrong:** GDD-ENM-04's sight stretch rule covers "every ground in that stretch". The Cacomixtle's plan (PR #100) defined that ground as solid and crumbling tile tops only. The validator was built to the plan, so lab-3k's perch, a one-way platform 32 px over Ka's cart floor and inside its stretch, passed with nothing reported. The pr-reviewer found it.
- **Root cause:** When the plan turned the GDD's word into a definition, it listed the ground kinds from memory instead of from the code's list of everything Poncho stands on (tiles, crumbling tiles, platforms, carts, blocks, awnings, cordeles).
- **Rule:** When a plan defines a GDD word that names a family ("ground", "every enemy", "a floor"), list its members from the code that builds the family (for ground, everything `stepRun` lands him on) and name each member it leaves out, with the reason. The validator test then has one fixture per member.
- **Recurrence 2 (2026-11-17, PR #103, GDD-ENM-04 rule (h), found by the review):** the plan for the cart clear of the phone's buttons narrowed the GDD's "the phone's buttons" to the Jump button and "ground" to tile tops again, and the GDD text was edited to match with no decision of the user's. In the mirrored layout the mode switch covered lab-3k's cart and 3-3's K1, and K1's perch was not read at all. The lesson's rule was in no skill step, so the plan was never checked against it.
- **Recurrence 3 (2026-11-17, PR #103, found by its re-review):** the fix for "every button" added the claw and pause buttons to the rule but no fixture for either, so skipping one stayed green. The skill step promoted in the commit before asked for one fixture per member, and nothing checked that the plan listed the members at all.
- **Recurrence 4 (2026-11-19, PR #113, 3-3's camera along the bots, found by the review):** the plan's `## Families` named "on screen" as the 480 x 270 view only, leaving out the phone's buttons, which GDD-WLD-03's sight rule counts as covering the screen; so I put the chasm's landing to the user as "the bank is in view" when on a phone that strip is under the Jump button, and the user had to be asked again. The families section existed as the guard asks; nothing checks that a screen word lists the touch buttons, and a sentence in a plan cannot be checked for what it leaves out.
- **Recurrence:** 4
- **Promoted:** `harness-feature` step 5, "Name every family (L-080)": the plan lists the members of each family word its rule uses, from the code, and the GDD's word is never narrowed without the user. Guard: `scripts/hooks/before-implementer.mjs` denies launching the implementer when the plan has no `## Families` section with a line in it (tested in `scripts/hooks/before-implementer.test.mjs`). It proves the members were written down, not that the list is whole.

## L-081 Two planned mutants could not be caught as the plan wrote them

- **Date:** 2026-11-15
- **Area:** process, tests
- **What went wrong:** The Cacomixtle's phase B plan (PR #100) listed a mutant that set the ringtail's depth to 3, but 3 is the image pool's default and already lies between the cart's layers (2.5 and 3.2). It also listed a mutant that placed the ringtail at the sim's x/y, but at the end of a step that point equals the cart's drawn pose, so a test that reads only there cannot see it. The implementer found both, changed the value to 3.5 and sampled between steps.
- **Root cause:** The plan named each mutant's value and the test that catches it without checking the value against the code's defaults and the state the test reads.
- **Rule:** For each planned mutant, the plan says the value the code has without the mutation (its default, the pool's, the pose's at the sampled moment) and the different value the mutant leaves for the named test to read. A mutant whose value equals that state at the sampled moment is changed before the plan goes out.
- **Recurrence 2 (2026-11-18, GDD-WLD-18 B2b):** my plan's veladora mutant (a row higher) said the bot would take it on another step; his 32 px box overlaps rows 29 and 30, so it is taken on the same step and only the layout test catches it. My shelf mutant named the clock-0 test, which cannot see the shelf's left edge. Neither said the value the test reads with the mutant, as the rule asks.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-feature (step 5, Mutants: each planned mutant names the value its test reads without and with it)

## L-082 A plan ran only the feature's own playtest, and another spec that pinned the changed rule broke

- **Date:** 2026-11-16
- **Area:** process, playtest
- **What went wrong:** The camera look-ahead's phase A plan (PR #102) changed where a fall's look-down catches up, from y 116 to 108. It ran only `e2e/camera.spec.ts`. But `e2e/level3-1.spec.ts` pins the old line after 3-1's long glide, and it failed on desktop and phone. The review found it.
- **Root cause:** The plan chose the playtests to run by the feature's own spec. It did not search for which specs read the rule's constants or its behaviour.
- **Rule:** A plan that changes a shared rule (the camera, movement, a tuning constant) greps `e2e/` for the rule's constants and functions (`CAMERA.`, the function names) and runs every spec that names one, or runs the full `npm run test:e2e` before the commit. It lists those specs in its Visible section.
- **Recurrence:** 1
- **Promoted:** no

## L-083 A local dry run of the deploy did not reproduce what differs in CI

- **Date:** 2026-11-09
- **Area:** harness, process
- **What went wrong:** the GDD-TEC-08 deploy workflow was dry-run locally seven times against one `dist/`, and the PR said files were hard-linked across releases. In CI every build has new mtimes, so `rsync -a` would have copied every file each time. The dry run also ran deploys one after another, so it missed that `workflow_run` deploys in the order the check runs finish, which can put an older commit live (both found in the review of PR #88).
- **Root cause:** the dry run reused what was at hand (one build, sequential runs) instead of listing what differs on the runner: a fresh checkout and build each time, runs that overlap and can be re-run.
- **Rule:** before a dry run of a CI or deploy step, list what differs on the runner (a fresh build with new mtimes, overlapping runs, re-runs, missing secrets) and make the dry run reproduce each of them, or say in the PR which ones it does not cover.
- **Recurrence 2 (2026-11-09, PR #88):** the fix deployed only `main`'s tip and skipped any other commit, saying the tip's own run would deploy it; but a later deploy run can replace that waiting run in the concurrency queue and then skip, so the newest commit stayed off the site (found in the re-review). The rule was written in the same PR, as a lesson, and the fix was reasoned about one run at a time instead of listing how runs overlap.
- **Recurrence 3 (2026-11-09, PR #88):** with every run deploying `main`'s newest commit, several check runs could wake deploys of the same commit, and the repeat build pushed out the hashed files kept for tabs opened before it and took a rollback slot (found in the third review). The CLAUDE.md rule landed in the same push as the design it should have guided, and its list named overlapping runs but not several runs for one commit.
- **Recurrence 4 (2026-11-09, PR #88):** the skip for a commit already live also skipped the smoke test, so re-running a deploy whose smoke test had failed went green without checking the site (found in the fourth review). The convention named re-runs, but it was applied to the check runs that wake a deploy and not to a re-run of the deploy itself.
- **Recurrence:** 4
- **Promoted:** CLAUDE.md (Conventions: a dry run of a CI or deploy step reproduces what differs on the runner, naming several runs for one commit and a re-run of the workflow itself). Guard: none (which runner conditions a workflow's design must survive is a judgement about that workflow; no check over the files can tell a covered case from a missed one, and the deploy's steps that need GitHub's runner cannot run in the gate)

## L-084 A changelog said the playtests passed while they were still running

- **Date:** 2026-11-09
- **Area:** gdd, process
- **What went wrong:** the GDD 0.11.0 changelog line said the full playtest suite passed for the GDD-TEC-07 dependency review, while the local run was still going (it was then stopped at 30 minutes) and the PR left the e2e box unticked (found in the review of PR #88).
- **Root cause:** the changelog line was written while the run was planned and committed before its result came back; nothing ties a "passing" claim to a finished run.
- **Rule:** write that a check passed only after its run has finished, naming where (local or CI); until then write that it is pending.
- **Recurrence 2 (2026-11-09, PR #88):** the review fix moved vite to 8.3.7 and kept the changelog's "the full playtest suite passing in CI", which held for the earlier head while CI's playtests on the new head were still running (found in the re-review). The lesson was a day old and in no step that a changelog edit goes through.
- **Recurrence 3 (2026-11-23, PR #123, found by the re-review):** the description and a commit message said the new `gdd-changelog-sections` check, replayed over the last 27 GDD commits on main, "fails one and none wrongly". I had run that replay before the check learned to leave Open Question numbers out, and before main gained 0.13.4, and did not run it again: on the head it failed three, one of them wrongly (0.11.7 named four sections whose only change was a renumbered question). The rule speaks of a changelog; a measured claim in a PR description or a commit message goes stale the same way when the code it measured changes.
- **Recurrence:** 3
- **Promoted:** .claude/skills/harness-gdd-update (step 3: a changelog claim that a check passed names a finished run on the head it describes); since recurrence 3 the same holds for a measured claim in a PR description or a commit message, written into step 13 of `harness-feature`. Guard: none (whether a figure was measured on the code it describes can only be told by running it again; the `pr-reviewer` re-runs the claims a description makes)

## L-085 A command blocked by a hook was re-run only in part, and its edits were lost

- **Date:** 2026-11-09
- **Area:** harness, process
- **What went wrong:** in PR #88 one command held a lessons and CLAUDE.md edit, the gate and the commit. The L-012 hook blocked it as a whole; the next command re-ran only the gate and the commit, so c9fd671 shipped without the edit while its message and the PR description said it was in. The fourth review's fix then showed the lesson text missing.
- **Root cause:** a blocked command runs none of its parts, but the retry was written from the hook's message, which named only the commit part.
- **Rule:** after a hook blocks a command, re-run every part of it, or read `git status --short` (it must list each file the command was meant to change) before committing.
- **Recurrence 2 (2026-11-09, PR #88):** the same slip had happened in PR #67, noted only inside L-010's recurrence 12 ("blocked by the L-012 hook and the rerun left it out"), not as a lesson of its own, so nothing changed after it.
- **Recurrence:** 2
- **Promoted:** scripts/hooks/gate-pipe.mjs (its denial now says that none of the command ran and to re-run every part of it; tested in scripts/hooks/gate-pipe.test.mjs)

## L-086 A branch's unmerged lessons took IDs that main gave to other lessons meanwhile

- **Date:** 2026-11-10
- **Area:** harness, process
- **What went wrong:** PR #88 stayed open for a day and added L-074 to L-076; main meanwhile merged its own L-074 (PR #87). Merging main gave a conflict in `docs/LESSONS.md`, and the branch's three lessons and their references (CLAUDE.md, the `harness-gdd-update` skill, the gate-pipe hook and its test) had to move to L-075 to L-077.
- **Root cause:** a lesson takes the next free ID on its own branch; nothing says which side yields when two open branches take the same one, or that the references must move with it.
- **Rule:** when merging main gives two lessons the same ID, main's keeps it; the branch's unmerged lessons take the next free IDs, and `git grep` for each old ID outside `docs/LESSONS.md` finds every reference to move in the merge commit (an ID on main is never renumbered).
- **Recurrence 2 (2026-11-17, PR #88):** PR #88 stayed open another week; main took L-075 to L-082, so the branch's L-075 to L-079 moved again, to L-083 to L-087. The rule was in no step a merge goes through, and the first try at the move ran one regex over the branch's lessons, which also rewrote this lesson's own history ("added L-074 to L-076"); it was put back from the branch's text before the commit. The same merge also lost main's L-082 its last two fields: git had moved the lines both sides ended with out of the conflict, and the splice joined them to the branch's last lesson (the gate's `lessons` check found it).
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-feature (step 13: after merging main, the branch's unmerged lessons take the next free IDs, moving only their headings and the references the branch added) and .claude/skills/harness-retro (step 2: the one exception to never renumbering)

## L-087 A deploy plan changed another project on the shared server

- **Date:** 2026-11-10
- **Area:** process
- **What went wrong:** the server's ports 80 and 443 were held by another project's Caddy container, and the Docker deploy plan routed the game through it by adding an import folder to that project's Caddyfile and compose file. The user rejected the plan: the two projects must stay independent.
- **Root cause:** the plan treated what was already running on the host as shared infrastructure to build on, and the question to the user offered only ways of changing the other project, not whether to change it at all.
- **Rule:** a plan for a shared server never edits another project's files or containers on it; when that project holds something the game needs (a port, a domain), ask the user how to resolve it, with leaving that project untouched among the options.
- **Recurrence:** 1
- **Promoted:** no

## L-088 The gate could not pass on an uncommitted merge of main

- **Date:** 2026-11-17
- **Area:** harness
- **What went wrong:** merging main into PR #88 (`git merge --no-commit origin/main`), the gate failed `gdd-one-version` with twelve added versions: main's eleven counted as the branch's. The gate must pass before the merge commit, so it could not be committed by the rules.
- **Root cause:** the check compared with `git merge-base origin/main HEAD`; until the merge is committed HEAD is the branch's old tip, whose merge base predates everything main added.
- **Rule:** a gate check that compares with a merge base takes the one the commit being made will have: during a merge, `git merge-base origin/main HEAD MERGE_HEAD`.
- **Recurrence 2 and 3 (2026-11-09 and 2026-11-10, PR #88):** the same check failed before the merge commits b2af575 and e7923e8; the PR description noted it ("before each merge commit it was the only failing check") and both merges were committed anyway, so nothing changed until this third time (found in the review of PR #88).
- **Recurrence:** 3
- **Promoted:** scripts/gdd-version.mjs (reads MERGE_HEAD). Guard: `scripts/gdd-version.test.mjs`

## L-089 Every project hook did nothing on a machine without node on the PATH

- **Date:** 2026-11-17
- **Area:** harness
- **What went wrong:** a session on the user's server had no `node` on the PATH Claude Code was started with; node was installed under `~/.local/node` and put on the PATH of each shell command only. Every hook in `.claude/settings.json` runs `node`, so none ran, and since each fails open nothing said so: the after-push reminder to rewrite the PR description never showed, and the description stayed stale (L-070, recurrence 3).
- **Root cause:** the hooks' fail-open design treats a missing interpreter like any other hook error, silently; nothing checks at session start that the hooks can run.
- **Rule:** before working in a new environment, check that `node` is on the PATH Claude Code itself runs with (not only in the shell), or restart the session after putting it there.
- **Recurrence:** 1
- **Promoted:** no

## L-090 A plan for level drives had no run-time budget, and the gate would have taken an hour

- **Date:** 2026-11-18
- **Area:** harness, tests, level
- **What went wrong:** the plan for the vulture's re-measure asked for every sweep at clock step 6 in one test file; built, the file ran about an hour as one process (the jump test alone 23 minutes), and `npm test`, which the gate runs, would have gone from minutes to an hour. The builder ran the tests split across processes, so nobody saw the whole.
- **Root cause:** the plan budgeted clocks and take-offs, not time; vitest runs the tests of one file in series, so a file's time is the sum of its tests.
- **Rule:** a plan with level drives states a time budget per test file (at most 300 s run alone) and asks for each file's time and `npm test`'s total in the report; long sweeps go in their own files at the coarsest clock step that fits, named in the test, and exact pins stay fine.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-feature (step 5, run time)

## L-091 Two flaky playtests failed 21 CI runs in a week, and the fix for one sat on another branch

- **Date:** 2026-11-18
- **Area:** playtest, process
- **What went wrong:** `e2e/camera.spec.ts` (the lab-3t drop) and `e2e/cart.spec.ts` (Poncho behind the cart's front wall, phone) failed 11 and 12 of the last 200 CI runs (about one in 17 each); 21 runs failed on them alone, main included. Each time the session re-ran the job or called it unrelated and moved on. A fix for the camera test (d0b9491, L-042 recurrence 11) was pushed to the deploy branch after its PR had merged, without restarting the branch from `main` and without opening a draft PR for the push, so it never reached main.
- **Root cause:** a flake on a file the PR did not touch was treated as noise to re-run, not as a defect with a history; nothing looked across runs. The stranded fix broke two rules already in `CLAUDE.md` (restart the working branch from `main` after its PR merges; open a draft PR after every push when the branch has no open one), which the `after-push` hook only reminds of.
- **Rule:** a CI failure in a test the PR did not touch is looked up in the failure history of the workflow (the runs of the last week, by test name) before any re-run; a test that has failed before gets its own fix PR, measured with `--repeat-each` before and after. A commit pushed after a branch's PR merged goes on the branch restarted from `main`, with a new draft PR (`CLAUDE.md`).
- **Recurrence:** 1
- **Promoted:** no

## L-092 A clock sweep in steps of 24 met only a tenth of the bats' phases

- **Date:** 2026-11-18
- **Area:** tests, level
- **What went wrong:** the plan for 3-3's whole-level bots offered a clock step of 24, 48 or 96, and the bots were swept at 24 over [0, 7200). 24 divides the bats' period (240) and both lifts' rounds (192 and 384 steps), and a bot reaches each place at the same step at every start clock, so the 300 clocks met 10 of the bats' 240 phases and 8 of MP1's 192, while the test said the careful bot keeps every life "at every clock". Re-run at step 29 (249 clocks, shorter), it still did, and the rider's tally changed.
- **Root cause:** L-090's run-time rule asks for the coarsest step that fits the budget and says nothing about which steps sample the clocks fairly; a round step shares factors with the round periods the level's tuning uses.
- **Rule:** a sweep over start clocks uses a step that shares no factor with any period it samples (each enemy's walk or flight, each lift's round), so its clocks meet as many phases of each as they can, and names that in the test; a step that shares a factor says which phases it misses.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-feature (step 5, run time)

## L-093 A cause the plan said to report was pinned, named after a GDD family on an unpinned probe

- **Date:** 2026-11-18
- **Area:** tests, gdd, process
- **What went wrong:** the plan for 3-3's bots said a rider loss whose cause the GDD does not name is reported and the run stops. The implementer met one ("bat 1 at 111"), pinned it, and wrote in the test that it was GDD-WLD-18's "26 have no answer" family, from a probe over 8 of its 32 clocks that was not in the repository. Checked, every such loss came 1 to 4 steps into the bot's own held jump over the ball, a choice of the bot's, not shown to be the GDD's family.
- **Root cause:** the report flagged it as a decision, but the stop condition was written as prose in the plan and the pin was already made; a probe's reading went into a test comment as a fact.
- **Rule:** an outcome the plan's stop condition covers is reported, not pinned, until the main session has checked it against the run (what the bot was doing on the losing step); a test comment never names a GDD family from a probe outside the repository (L-003).
- **Recurrence 2 (2026-11-19, PR #112, GDD-BOS-04, found by the review):** writing the phase 3 floor sweep into the GDD, I put every short window around home down to the gantry and placed the springs at x 210 and 270. At x 190, 200, 280 and 290 too Poncho stood on a spring, which threw him from step 1; the counts there came from the bounce, not the gantry. The user accepted the strip on that account, and had to be asked again on the corrected figures. I read the cause off the shape of the numbers, not off what he was doing on the steps that made them.
- **Recurrence:** 2
- **Promoted:** `harness-gdd-update` step 1, "Check a measured figure's cause against the run (L-093)"

## L-094 A design sentence about when to act was not worked against the section's own windows

- **Date:** 2026-11-18
- **Area:** gdd, process
- **What went wrong:** In PR #109 (GDD-BOS-04) I wrote that la purga, the steam of La Catorce's telegraph, is the cue for the cart's window in phases 2 and 3. The section's own numbers put a jump made during it about 80 steps before the landing window opens. The `pr-reviewer` found this with arithmetic on the section's own table.
- **Root cause:** A sentence about timing (a cue, "as she charges", "any time she is parked") was written from the feel of the fight. It was never turned into a step count and checked against the window table beside it. The GDD-update skill asked for measured numbers (L-003) and limits (L-013), not for prose timing claims to be checked against the section's own numbers.
- **Rule:** A GDD sentence that tells the player when to act (a cue, a rule of thumb, "before", "as", "while") is turned into steps from the section's own numbers before it goes in: the step the cue happens, plus the action's time (a jump's steps, a ride), against the window it claims. Write the worked step counts into the sentence or beside it, and fix a neighbouring cue that fails the same check.
- **Recurrence 2 (2026-11-18, PR #109, GDD-BOS-04, found by the same review):** phase 3's rule of thumb, "as she charges that way, before she passes under home", was written by the World 3 design swarm on 2026-11-10. Most presses in it land too early (the window allows presses from 109 to 9 steps before the slam, and she passes under home 84 before it). Phase 1's "any time she is parked" fails in the last 14 steps of her rest. Nothing asked for the check then either.
- **Recurrence 3 (2026-11-18, PR #109, GDD-BOS-04, found by the re-review):** the fixes checked the cues the first review named, but not the attack table's "the slam is the latest good moment". A jump at the slam lands 26 steps later, after phase 3's window closes at 17. Phase 2's "as she charges that way" was not checked either. The step was in the skill, but I applied it to the sentences under review, not to every timing sentence in the section.
- **Recurrence 4 (2026-11-18, PR #109, GDD-BOS-04, found by the third review):** with the step widened to every timing sentence, I still missed one that was already there, phase 2's "the cart is sent while she is still coming" (38 of the 135 jump steps fall in her rest). I also wrote a new rest cue that dropped phase 1's 14-step exception. I had searched for the cue words of the earlier findings, not read each sentence of the section in order. The step now says to read the section top to bottom.
- **Recurrence 5 (2026-11-19, PR #112, GDD-BOS-04, found by the review):** moving every press window from the 26-step jump to the measured 27, I changed the table, the rest cue, the derrumbe row and the windows' reading, but not the phase 2 paragraph's "93 before to 21 after" further down. I searched for the old numbers I remembered changing instead of reading the section top to bottom, as the skill step says since Recurrence 4. Guard: none, as before.
- **Recurrence:** 5
- **Promoted:** `harness-gdd-update` step 1, "Work timing claims through (L-094)", which since Recurrence 3 says to check every timing sentence in the section, not only those edited. Guard: none (a timing claim is prose about when the player acts; telling a true one from a false one needs the arithmetic of each fight, which no pattern match can do; the `pr-reviewer` audits it)

## L-095 A level registered off the world's order reached "Start" through a rule the plan never read

- **Date:** 2026-11-20
- **Area:** process, level
- **What went wrong:** The plan for GDD-BOS-04 phase C registered 3-4 with no level leading to it ("Address only for now"). It listed the readers of the registry that use a saved run (`worldAt`), but not `startLevel`'s older rule for a save without one. That rule picked "the first level not cleared", which became 3-4, and `levels.test.ts` went red. The plan also missed `scripts/art/poncho.levels.test.mjs`, a list of registered levels outside `src/`. The implementer stopped on the first one, as it should.
- **Root cause:** I listed the readers of `LEVELS` from memory of the code paths I had changed before, and searched only `src/` and `e2e/` for pinned lists of level ids.
- **Rule:** A plan that registers a level, or changes `LEVELS` or a level's `next`, lists every reader of `LEVELS`, `worldLevels` and `next` from a search (`grep -rn "worldLevels\|LEVELS\b\|\.next\b" src scripts e2e`), reads each branch of each one, and searches `src`, `e2e` and `scripts` for the ids of the level's neighbours (`'3-2'`) to find the pinned lists.
- **Recurrence:** 1
- **Promoted:** no. Guard: the gate's tests, which caught both before the commit.

## L-096 A general rule in one new section decided a question the user said to leave open

- **Date:** 2026-11-20
- **Area:** gdd, process
- **What went wrong:** In PR #115 (the Poncho on Base proposal, GDD 0.13.0) the user asked that whether league attempts cost lives stay an "OPEN QUESTION, do not decide". GDD-CHAIN-05 and Open Question 57 left it open, but GDD-TEC-10's start-token bullet said the server takes a ledger life for every token and listed the league week among what a token is for, which decided it. The same sentence contradicted GDD-LIFE-06 and Conflict C2 (a run that clears its world goes on at no cost) and let a guest's token carry a server save. The review called it blocking.
- **Root cause:** The token rule was written in the proposal's general words ("each attempt") before the league section existed, and the hunt after the edit (L-013) searches for sentences the change makes false in the old text, not for sentences in the new text that presuppose an answer to something left open. Nothing listed which kinds of attempt the general rule covers.
- **Rule:** When the user leaves a question open, or a conflict is listed as unresolved, search every new and edited GDD section for that thing's words before the gate (here "league", "token", "ledger life") and read each hit for a presupposed answer. A rule stated for a whole family ("each attempt", "every token") names its members and says which ones it does not settle.
- **Recurrence 2 (2026-11-22, PR #123, GDD-VIS-05, found by the pr-reviewer):** rewording the `pr-reviewer`'s product rule after the first wave's decisions, I wrote that a wallet, token or on-chain feature "needs a GDD ID of the GDD's section 16", which let the leagues, the cosmetics, hero select and a real wallet adapter through, none of them decided, and a network line that covered Phase 2's calls. The rule above speaks of GDD sections, and I did not read a harness file that restates a GDD rule as one; a read of the next commits before they were made had found the same, after this one was pushed.
- **Recurrence:** 2
- **Promoted:** .claude/skills/harness-gdd-update (Rules: a rule worded for a whole family names its members and which the user has not decided, in the GDD and in a harness file that restates it)

## L-097 A paragraph marked Decided kept clauses of the recommendation it replaced

- **Date:** 2026-11-22
- **Area:** gdd, process
- **What went wrong:** In PR #118 two conflicts' "Recommended:" paragraphs were turned into "Decided (user, date: ...)" by replacing the label alone. Conflict C14's list then ended with "the static game still able to open without it", and C7's kept "before Phase 1 ships" and "The team may still choose fixed point", none of which the user's answers carried. The review called it blocking: a guess presented as a decision.
- **Root cause:** The label was swapped by an exact-text replacement of the paragraph's first words, and the rest of the paragraph was never read against the words the user chose. The status lines, written fresh, listed only what was answered, so the two disagreed.
- **Rule:** When a recommendation becomes Decided, rewrite the paragraph from the user's words (the option's label, and its description where the GDD says "the option chosen read"), clause by clause; every clause the answer does not carry moves after the decided list as "Recommended and not decided". The section's status line and the paragraph must name the same decided parts.
- **Recurrence 2 (2026-11-22, PR #118, found by the re-review):** the fix itself repeated it twice. The three decisions of that day were written into GDD-CHAIN-01's body while no status line named them, against the bullet that says a section is Proposed "but for what its status line names"; and the ADR's Status said "the stack below as proposed" for a Decision section holding far more than the four points the user was asked about. The rule was a day old and unpromoted, and the ADR was copied from a draft written before the answer.
- **Recurrence 3 (2026-11-22, PR #119, GDD-TEC-09, found by the pr-reviewer):** GDD-CHAIN-01 said GDD-TEC-09's recording is "in every build", which no answer of the user carries and which Open Question 56 (d) holds open. The sentence was written to take a review note about the maths and widened to the recording by the main session's own guess; the promoted rule covers a recommendation turning Decided, not a new sentence that settles an open question in passing.
- **Recurrence 4 (2026-11-22, PR #121, GDD-TEC-10, found by the pr-reviewer):** the changelog and the PR description said a credit is "counted once per chain event" and that each placeholder is named in its code and in a test, and neither was in the diff: both sentences were copied from the plan. A claim that something is built is checked against the diff (a search for the function, the test name), never taken from the plan.
- **Recurrence:** 4
- **Promoted:** `harness-gdd-update` Rules ("Record each decision where it applies"), which now says that a decision is named in its section's status line and that a Decided paragraph or an ADR's Status holds only the clauses the user's words carry (L-097). Guard: none (whether a sentence states more than the user said can only be told by reading it against their words; the `pr-reviewer` reads every added GDD sentence against the open questions, and L-096's search for an open thing's words is the step that would have found this one).

## L-098 A skill grew by one promotion at a time until its rules were missed

- **Date:** 2026-11-22
- **Area:** harness
- **What went wrong:** `harness-feature` had grown to 3,339 words: step 5 held 13 blocks of rules as paragraphs of up to 2.4 KB, each a little longer after every recurrence, all read for a one-line fix too. Rules it already held were then missed (L-010 recurrence 34, "move a threshold by one"; L-013 recurrence 30). At that size it was also about as long as the 5,000 tokens of a skill that a context compaction keeps, and its last two steps hold the commit chained on the gate and the fetch of main before a push. Found by an audit of the skills the user asked for.
- **Root cause:** The retro's second promotion path, "add a step to the relevant skill", had no limit, nothing measured a skill's size, and nothing said where a rule that applies only to some changes should live.
- **Rule:** A skill's `SKILL.md` holds its steps. Rules that apply by kind of change live in files beside it, one rule to a line with its lesson, named in a table in the step that uses them (`.claude/skills/harness-feature/rules/`). A promotion to a skill tightens or replaces the sentence it sharpens where there is one, and otherwise adds a line to the file its kind of change reads, not to the steps.
- **Recurrence:** 1
- **Promoted:** .claude/skills/harness-feature (step 5 and its rules files), .claude/skills/harness-retro (step 3: where a promotion to a skill is written) and `scripts/check.mjs` (`skill-size`: no file of a skill has more than 2,000 words)

## L-099 The gate ran half an hour of tests after its first check had already failed

- **Date:** 2026-11-22
- **Area:** harness, process
- **What went wrong:** The unit tests of a new gate check named two GDD IDs that do not exist as fixtures. `gdd-references` failed in the gate's first second, the gate went on through lint, the typecheck and four test runs with its output in a log, and the commit chained on it failed half an hour later. In the scratch worktree where the check was built I had run its own tests and the new checks, not the gate's other checks.
- **Root cause:** The harness checks and the toolchain ran as one pass with no early end, so a failure that costs a second to find cost a whole run to learn of, and nothing ran the fast checks alone.
- **Rule:** The gate does not run lint, the typecheck and the tests while a harness check has failed. A test fixture that needs a GDD ID takes one that exists (`gdd-references` reads test files too).
- **Recurrence:** 1
- **Promoted:** `scripts/check.mjs` (the toolchain is skipped, with a line saying so, when a check before it failed)
