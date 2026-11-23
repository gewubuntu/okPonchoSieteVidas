# Sprites and stand-ins

Rules for step 5 of the `harness-feature` skill, one to a line, each with the lesson it came from. Read when the change draws or redraws a sprite, or replaces a stand-in (a stub level, a placeholder drawing or sound).

## Sprite frames (L-059)

- For a sprite with several frames, list for each frame every place the game shows it (in the air, resting on the floor, rising from it, against a wall, on a sand slope, whose sand counts as ground), and plan two tests: an art test that pins how far each frame reaches past its box (and that no frame is cut off by its frame's edge, an edge counting as empty in the outline test), and a test over the real level or fight that, at every step, the frame shown fits the room it has there, with the player placed so that every frame the game shows is posed (a test that only idles at the spawn never sees a reaction; assert the looks it posed) (`scripts/art/boss.test.mjs`, `src/levels/level1-4.test.ts`).

## Stand-ins (L-062)

- A change that replaces a stand-in (a stub level, a placeholder drawing, a placeholder sound) greps `e2e/` and `src/` for what pins the stand-in's details (its colours, sizes, positions, frame pixels) and lists in the plan each spec that will break and how it is rewritten to check the same rule on the real thing; never "must stay green unchanged" for a spec that pins the stand-in.

## Approved art (L-072)

- Every property the plan pins of a drawing the user approved, or of the frames a level's tiles take (a colour set, a count, where it is see-through, which rows differ), is measured on the drawing or the level first, a few lines over its draw function, and the plan writes each claim with its measured figure; a claim written from how the drawing was meant to work is left out or measured. A sentence about the drawing that goes into the GDD after the build (what lies behind the HUD, behind a body's rows) is measured the same way, against the tuning number it leans on.
