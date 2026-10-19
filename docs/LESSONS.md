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
