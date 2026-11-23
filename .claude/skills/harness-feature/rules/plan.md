# Every plan

Rules for step 5 of the `harness-feature` skill, one to a line, each with the lesson it came from. Read for every plan.

## Mutants (L-010)

- Every code change the plan lists (each call added to a scene path too) gets its own mutant, and every mutant a test in the same plan (L-029).
- A number the scene computes and hands to Phaser (a playback rate, a position, a colour) gets a mutant too: move the computation into a pure helper with a unit test, and have the scene log what it passed so a playtest can check it.
- Go sentence by sentence through the GDD text, not bullet by bullet: split each new bullet into its clauses ("A or B wins over C" is two rules; a warning or a pose drawn on screen is a rule too) and give each clause its own mutant (remove the rule, move a threshold by one).
- A helper wrapped round several call sites (a scale on each alpha, a clamp on each value), or one new value read at several places (a timer read by the hit guards and by a defeat rule), is one change per site: give each site its own mutant, and plan a test that reaches every site, including those only drawn or run in one mode or state (L-010).
- A condition over several fields (`a.left === b.left && a.right === b.right ...`), or a revert of several (`x = fromX; y = fromY;`), is one change per field: give each field its own mutant (dropping that field alone) and a test where only that field matters (L-010).
- An exemption (a flag, a level kind or a state that skips some rules: a test level, a boss level) gets a test with it on that breaks every rule it does NOT skip, and a mutant that makes it skip everything (L-028).
- A rule that rests on a definition with a simpler or shifted neighbour (which row or column a range starts and ends on, which distance, where a moving thing is: a cart on its rail, a platform on its path) is tested where the two give different answers (a fixture that differs only in the range's first element and one only in its last; off level ground; off the start), with a mutant that takes the neighbour (L-028).
- Before planning a new event, state field or branch, check that it does something no existing one does; one that behaves exactly like another only adds a mutant nothing can kill (L-025).
- For each planned mutant, write the value its named test reads without it and the different value it reads with it, worked from the code and the body sizes (a 32 px box overlaps two rows); a mutant whose test would read the same value is retargeted or dropped before the plan goes out (L-081).

## Work the cases through (L-077)

- Before the plan goes out, work two of each new rule's own test cases through its definition and its fixture as written (one that must pass, one that must fail, with the numbers), including what else the fixture's bodies touch at the edge (a Poncho standing where the enemy's box is), and check that each type, case or call the plan names compiles against the code it extends (open the function's signature).
- Write them into the plan under a `## Worked cases` heading, one line per case with its numbers.
- Work the expected values too: a speed against a speed, a line the camera or a body must reach against the limits that clamp it.
- Take every formula from the function that computes it, opened, never from memory (L-077: a camera limit 16 px off), and check a rail's line against the tiles it crosses.
- Then grep the test files each new rule lands in for fixtures it would newly fail (the same world, kind or flag; a level a new validator clause now reads) and write under an `## Existing fixtures` heading what happens to each, or that none fail and why.
- A hook denies the implementer's launch without either section (`scripts/hooks/before-implementer.mjs`).

## Name every family (L-080)

- Where the GDD's rule uses a word that names a family (ground, buttons, enemies, a floor), list its members from the code that builds it (for ground, everything `stepRun` stands him on; for buttons, everything `layoutTouchButtons` returns in every layout and mode) and say which the rule includes.
- Leaving one out narrows the GDD's word: that is the user's decision, asked for, never written into the GDD by the main session.
- Write the list under a `## Families` heading ("none" when the rule names no family); the same hook denies the launch without it.

## Plan size (L-067)

- Count the plan's independent parts (an art build, pure logic, scene wiring, playtests, rewritten specs, a second drawn thing, screenshots each count as one; count what is delivered, not the plan's headings: a headed part that holds a sheet set, a level and a scene rule counts as three).
- More than four: split it into phases, each its own plan file and implementer run with its own report, and check each before the next starts.
- A run that ends at its turn limit with no report is resumed with SendMessage and a list of what to finish first.
