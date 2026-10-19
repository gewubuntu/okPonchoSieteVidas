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
| GDD-LIFE-02 | doing | rules as pure logic in src/sim/lives.ts; HUD, respawn and music pending |
| GDD-LIFE-03 | doing | rules as pure logic in src/sim/lives.ts; HUD, respawn and music pending |
| GDD-LIFE-04 | doing | rules as pure logic in src/sim/lives.ts; HUD, respawn and music pending |
| GDD-LIFE-05 | doing | rules as pure logic in src/sim/lives.ts; HUD, respawn and music pending |
| GDD-MOV-01 | doing | sim done and tested; no tile collision or touch yet |
| GDD-MOV-02 | doing | sim done and tested; no tile collision or touch yet |
| GDD-MOV-03 | doing | coyote and buffer done; corner correction and stomp buffer pending |
| GDD-MOV-04 | doing | sim done and tested |
| GDD-MOV-05 | todo |  |
| GDD-MOV-06 | todo |  |
| GDD-MOV-07 | todo |  |
| GDD-MOV-08 | todo |  |
| GDD-CMB-01 | todo |  |
| GDD-CMB-02 | todo |  |
| GDD-CMB-03 | todo |  |
| GDD-CTL-01 | doing | arrows, WASD, Space, Z, Up, W wired; remap and claw pending |
| GDD-CTL-02 | todo |  |
| GDD-CTL-03 | todo |  |
| GDD-CTL-04 | todo | note: quick taps can fit inside one frame; latch presses from raw key events, see L-006 |
| GDD-WLD-01 | todo |  |
| GDD-WLD-02 | todo |  |
| GDD-WLD-03 | todo |  |
| GDD-WLD-04 | todo |  |
| GDD-WLD-05 | todo |  |
| GDD-ENM-01 | todo |  |
| GDD-ENM-02 | todo |  |
| GDD-BOS-01 | todo |  |
| GDD-BOS-02 | todo |  |
| GDD-PRG-01 | todo |  |
| GDD-PRG-02 | todo |  |
| GDD-PRG-03 | todo |  |
| GDD-UI-01 | doing | lives triangles drawn and tested (src/ui/livesLayout.ts); power-up icon, hilo counter and crack animation pending |
| GDD-UI-02 | todo |  |
| GDD-UI-03 | todo |  |
| GDD-AUD-01 | todo |  |
| GDD-AUD-02 | todo |  |
| GDD-ART-01 | doing | 480x270 canvas scaled to fit; art not started |
| GDD-ART-02 | todo |  |
| GDD-ART-03 | todo |  |
| GDD-ART-04 | todo |  |
| GDD-TEC-01 | done | scaffold on latest stable: Phaser 4, TS 7, Vite 8, Vitest 5, Playwright, Oxlint |
| GDD-TEC-02 | done | src/sim/fixedStep.ts, sim has no Phaser imports |
| GDD-TEC-03 | doing | fit-to-screen test only; fps and size budgets pending |
| GDD-TEC-04 | todo |  |
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
