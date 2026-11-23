# Buttons and tap targets

Rules for step 5 of the `harness-feature` skill, one to a line, each with the lesson it came from. Read when the change reads a button (a press, a release, a hold) or adds a tap target.

## Input rules (L-019)

- When a rule reads buttons (presses, releases, holds), list every source that produces each one (keyboard keys, touch buttons, the slide stick, each gamepad button and stick on every connected pad, raw-event latches; look in `src/ui/` for a source added since) and the pairs that combine (left and right into `move`), and plan a test for each source and each pair.
- Read single buttons raw, never from a combined value.

## Shared buttons (L-024)

- List every existing rule that already reads the same button (jump buffer, coyote time, variable jump, stomp boost, the spring launch that no press replaces, GDD-WLD-05, and the "already held" marks left by the respawn and by the pause resume, GDD-UI-02; search the whole GDD for the button's name, not only section 4) and plan a test for each one with the new rule on.
- For a press made on a menu or screen, look up what that screen does with the button (the `*Event` and `*Frame` functions in `src/sim/`): a button that picks a row (Space, Z, south) picks there too, so a hold-back test holds the press that picked (L-041).
- A new rule on a held button counts the hold from a press the simulation saw, never from any held input.
- A rule that makes a button "do nothing until released" is applied where the input is read (the key or finger), not as a flag some readers check, and is tested through every reader of the button, `move` included (L-035).
- Such a rule tracks each press by its source and its down time (`Key.timeDown`, `Pointer.downTime`), never by the key or pointer slot alone, and is tested with a key re-pressed while paused and a release and press inside one frame (L-036).

## Touch areas (L-032)

- A new tap target on screen (a menu row, a button) is checked against the area each touch control reads, not only the box it draws: the slide stick reads the whole lower left quarter, not its track.
- List which controls read a finger there and plan a held-touch playtest (CDP, several frames) on the overlap.
