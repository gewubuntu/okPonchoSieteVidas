# Levels

Rules for step 5 of the `harness-feature` skill, one to a line, each with the lesson it came from. Read when the change places things in a level by a rule, claims where things are or what a path costs, or drives a level in a test.

## Placement rules (L-014)

- A rule that places things in a level by a formula (a hash, a modulus, a spacing) or a claim about where things are is run over every real level before it goes into the GDD or the plan: count what it places and the variants it gives, write those counts into the GDD, and plan a test that pins them.
- No coefficient may share a factor with its modulus.
- A claim about what a path costs or keeps ("a miss costs nothing", "lands safely", "never a side hit") is driven on the real level with every enemy in it, over the start times and each walker's walk, never on a copy with the enemies taken out; a copy without enemies measures a reach only.
- Every such drive asserts the lives and where he ends, not only the thing it was written for (a stomp, a pickup), and sweeps the take-offs a player can use (the whole stretch before a lip, 0.2 tile apart, from a standstill and at a run), not one or three; the plan words the sweep, never a list of columns.
- A claim about something he stands on or rides (a lift, a cart's floor, a platform) sweeps where he can stand on it, its ends and middle, and 1 px apart across each seam it shares with other ground, never one place on it (L-075).
- Against an enemy the stretch runs past where it meets him, not a fixed number of tiles from where it wakes, and each answer the plan's family names is swept, not only the first (L-014).

## Run time (L-090, L-079)

- A plan with level drives gives each test file a budget (at most 300 s run alone) and each long test its own limit, at least 4 times its time alone, since CI runs the heavy files side by side on a slower runner; the report gives each file's time and `npm test`'s total.
- A sweep over start clocks takes a step that shares no factor with any period it samples (each enemy's, each lift's round), named in the test; one that shares a factor says which phases it misses (L-092).
