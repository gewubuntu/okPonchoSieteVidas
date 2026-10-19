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

<!-- No lessons yet. The first real mistake goes here. -->
