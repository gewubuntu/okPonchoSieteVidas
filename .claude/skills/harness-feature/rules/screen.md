# Frames and texts

Rules for step 5 of the `harness-feature` skill, one to a line, each with the lesson it came from. Read when the change sets each frame something other code reads, or shows the player a new text.

## Per-frame updates (L-033)

- A call made every frame that changes what other code reads in the same frame (a button's place, a visibility, a setting) runs before the first reader in `update()`.
- List the readers (search `src/scenes/PlayScene.ts` for the field or what is built from it, such as the hilo counter placed by the pause button) and plan a playtest that reads the changed thing and one reader in one `waitForFunction` on the first frame the change shows, with a mutant that moves the call after that reader.

## On-screen texts (L-050)

- Every new text the player sees goes into `src/ui/text.ts` in every language and into the GDD-UI-02 language table (the gate's test compares them), never into a helper or the scene; a tutorial tip goes into its level's tip list in `src/levels/` and into GDD-UI-05 (`src/ui/tips.test.ts` compares them).
- List them in the plan with their translations, found by searching all of `src/`, not only the scene.
