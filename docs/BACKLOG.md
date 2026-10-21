# Backlog

One row per GDD ID. Status: `todo`, `doing`, `done` or `cut`. Deprecated GDD IDs must be `cut`.
`node scripts/check.mjs` fails if a GDD ID has no row or a row has no GDD ID.
Add new rows with `node scripts/check.mjs --backlog-stub`.

Suggested first order (the character image has arrived): GDD-TEC-01, GDD-TEC-05, GDD-TEC-02, GDD-MOV-01 to GDD-MOV-06, GDD-CTL-01, GDD-CTL-03, GDD-LIFE-01 to GDD-LIFE-03, GDD-UI-01.

| GDD ID | Status | Notes |
| --- | --- | --- |
| GDD-VIS-01 | todo |  |
| GDD-VIS-02 | todo |  |
| GDD-VIS-03 | todo |  |
| GDD-VIS-04 | todo |  |
| GDD-LOOP-01 | todo |  |
| GDD-LOOP-02 | todo |  |
| GDD-LOOP-03 | todo |  |
| GDD-LIFE-01 | doing | rules as pure logic in src/sim/lives.ts; HUD, respawn and music pending |
| GDD-LIFE-02 | doing | pit loss, 0.8 s wait with skip, hidden while waiting, invulnerability timer and blink, respawn at the latest ofrenda in src/sim/run.ts, HUD crack animation (src/ui/lifeCrack.ts), respawn flip (src/sim/respawnFlip.ts); enemy or hazard losses pending |
| GDD-LIFE-03 | doing | rules as pure logic in src/sim/lives.ts; touching an ofrenda restores a life and, if it is later in the level, sets the checkpoint (only forward) in src/sim/run.ts; ofrendas drawn as placeholders and placed in the sandbox level; the marimba sound plays on first use (GDD-AUD-02) |
| GDD-LIFE-04 | doing | rules as pure logic in src/sim/lives.ts; HUD, respawn and music pending |
| GDD-LIFE-05 | doing | restart with 7 lives at zero is built; the Siete vidas gastadas screen and per-world scope pending |
| GDD-MOV-01 | doing | sim done and tested; no tile collision or touch yet |
| GDD-MOV-02 | doing | sim done and tested; no tile collision or touch yet |
| GDD-MOV-03 | doing | coyote, buffer and corner correction done; stomp bounce buffer pending (needs combat) |
| GDD-MOV-04 | doing | sim done and tested |
| GDD-MOV-05 | doing | respawn flip lands feet-first (src/sim/respawnFlip.ts); landing squash and mid-air sprite flip pending (need the real sprite) |
| GDD-MOV-06 | doing | body box collides with tiles (floors, walls, ceilings, 1-tile gap) in src/sim; hurtbox and final sprite size pending |
| GDD-MOV-07 | todo |  |
| GDD-MOV-08 | todo |  |
| GDD-CMB-01 | todo |  |
| GDD-CMB-02 | todo |  |
| GDD-CMB-03 | todo |  |
| GDD-CTL-01 | doing | arrows, WASD, Space, Z, Up, W wired; remap and claw pending |
| GDD-CTL-02 | todo |  |
| GDD-CTL-03 | doing | left, right and jump buttons with multi-touch, and the slide stick with a mode switch, in src/ui/touchLayout.ts and TouchControls.ts; claw and Fuego buttons, mirroring, opacity, vibration pending |
| GDD-CTL-04 | todo | note: quick taps can fit inside one frame; latch presses from raw key events, see L-006 |
| GDD-WLD-01 | todo |  |
| GDD-WLD-02 | todo |  |
| GDD-WLD-03 | todo |  |
| GDD-WLD-04 | todo |  |
| GDD-WLD-05 | doing | pits and the ofrenda touch rule in src/sim/run.ts (3-tile pit and 3 placeholder ofrendas in the sandbox level); spikes in src/sim/hazards.ts (two in the sandbox); crumbling tiles in src/sim/crumble.ts (three in the sandbox); springs in src/sim/spring.ts (one in the sandbox); moving platforms and the rest pending |
| GDD-ENM-01 | todo |  |
| GDD-ENM-02 | todo |  |
| GDD-BOS-01 | todo |  |
| GDD-BOS-02 | todo |  |
| GDD-PRG-01 | todo |  |
| GDD-PRG-02 | todo |  |
| GDD-PRG-03 | todo |  |
| GDD-UI-01 | doing | lives triangles drawn and tested (src/ui/livesLayout.ts); power-up icon and hilo counter pending |
| GDD-UI-02 | todo |  |
| GDD-UI-03 | todo |  |
| GDD-AUD-01 | todo | audio unlock on first gesture is handled by the engine; music and volume settings pending |
| GDD-AUD-02 | doing | ofrenda sound only (generated marimba placeholder); jump, land, claw, stomp, hilo, life lost, meow pending |
| GDD-ART-01 | doing | 480x270 canvas scaled to fit; art not started |
| GDD-ART-02 | todo |  |
| GDD-ART-03 | todo |  |
| GDD-ART-04 | todo |  |
| GDD-TEC-01 | done | scaffold on latest stable: Phaser 4, TS 7, Vite 8, Vitest 5, Playwright, Oxlint |
| GDD-TEC-02 | done | src/sim/fixedStep.ts, sim has no Phaser imports |
| GDD-TEC-03 | doing | fit-to-screen test only; fps and size budgets pending |
| GDD-TEC-04 | todo | stand-in: ASCII tile level in src/levels/sandbox.ts; Tiled JSON and the level validator pending |
| GDD-TEC-05 | done | src/config/tuning.ts, derived-number tests |
| GDD-TEC-06 | doing | Vitest and Playwright set up; level validation pending |
| GDD-MVP-01 | todo |  |
| GDD-MVP-02 | todo |  |
| GDD-PWR-01 | todo |  |
| GDD-PWR-02 | todo |  |
| GDD-PWR-03 | todo |  |
| GDD-PWR-04 | todo |  |
| GDD-PWR-05 | todo |  |
| GDD-PWR-06 | todo |  |
| GDD-VIS-05 | todo |  |
| GDD-TEC-07 | todo |  |
