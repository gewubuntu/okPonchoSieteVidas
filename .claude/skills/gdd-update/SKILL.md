---
name: gdd-update
description: Edit docs/GDD.md for PONCHO: Siete Vidas, the anchor design document. Use when adding, changing, splitting, promoting or deprecating a game design rule, mechanic, tuning number or scope item. Keeps IDs stable, statuses honest, the changelog current and the backlog in sync.
---

# GDD update

The GDD is the anchor. Edit it carefully.

## Rules

- IDs are permanent. Never renumber or reuse an ID. To remove a rule, set `Status: Deprecated` and say why.
- New rule: pick the area prefix (`VIS LOOP LIFE MOV CMB CTL WLD ENM BOS PRG UI AUD ART TEC MVP`), use the next free number, write `### GDD-XXX-NN Title`, then a `Status:` line.
- `Status: Decided` only when the user said so in the conversation. Everything else is `Proposed`. Record who decided and when in the section.
- Changing a `Decided` section needs the user's say-so for that change.
- Tuning numbers change in `docs/GDD.md` and `src/config/tuning.ts` in the same commit (once that file exists).

## Steps

1. Make the edit.
2. Bump `Version:` at the top: patch for wording or numbers, minor for new or removed IDs, major for pillar-level change.
3. Add a changelog line: `- **x.y.z** (YYYY-MM-DD) summary, listing the IDs touched`.
4. Update Open Questions: add new unknowns, remove answered ones.
5. Sync the backlog: `node scripts/check.mjs --backlog-stub` prints rows for new IDs; paste them into `docs/BACKLOG.md`. Mark deprecated IDs `cut`.
6. Run `node scripts/check.mjs`. It must pass.
7. Commit as `docs(GDD-XXX-NN): <summary>`.
