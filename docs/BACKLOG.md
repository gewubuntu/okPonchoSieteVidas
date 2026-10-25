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
| GDD-LIFE-02 | doing | pit loss, 0.8 s wait with skip, hidden while waiting, invulnerability timer and blink, respawn at the latest ofrenda in src/sim/run.ts, HUD crack animation (src/ui/lifeCrack.ts), respawn flip (src/sim/respawnFlip.ts); the Alacrán, Zopilote, cactus buddy and Tlacuache hits are built; crushing by a moving block is built (src/sim/block.ts) |
| GDD-LIFE-03 | doing | rules as pure logic in src/sim/lives.ts; touching an ofrenda restores a life and, if it is later in the level, sets the checkpoint (only forward) in src/sim/run.ts; ofrendas drawn as placeholders and placed in the sandbox level; the marimba sound plays on first use (GDD-AUD-02) |
| GDD-LIFE-04 | doing | rules as pure logic in src/sim/lives.ts; the HUD pulse of the last triangle in src/ui/lastLife.ts; the tense music and the double hilo score pending (no music or hilos yet) |
| GDD-LIFE-05 | doing | the Siete vidas gastadas screen (any button after 1.0 s) and the restart with 7 lives at the level start are built in src/sim/run.ts and PlayScene; per-world scope (several levels, hilos kept) pending until there are worlds and hilos |
| GDD-MOV-01 | doing | sim done and tested; no tile collision or touch yet |
| GDD-MOV-02 | doing | sim done and tested; no tile collision or touch yet |
| GDD-MOV-03 | doing | coyote, buffer and corner correction done; stomp bounce buffer pending (needs combat) |
| GDD-MOV-04 | doing | sim done and tested |
| GDD-MOV-05 | doing | respawn flip lands feet-first (src/sim/respawnFlip.ts); landing squash and mid-air sprite flip pending (need the real sprite) |
| GDD-MOV-06 | doing | body box collides with tiles (floors, walls, ceilings, 1-tile gap) in src/sim; hurtbox and final sprite size pending |
| GDD-MOV-07 | doing | glide in src/sim/movement.ts behind a level ability flag (on in the sandbox until GDD-PRG-01 unlocks it), placeholder spread poncho; sprite and sound pending |
| GDD-MOV-08 | doing | wall cling and kick in src/sim/movement.ts behind the level ability flag (on in the sandbox until GDD-PRG-01 unlocks it), placeholder claw marks; sprite and sound pending |
| GDD-CMB-01 | doing | stomp with 260 and 410 px/s bounces in src/sim/enemy.ts and run.ts; the not-stompable marking (three pale thorns) is built for the Zopilote and the cactus buddy; the Tlacuache's first stomp makes it play dead |
| GDD-CMB-02 | doing | claw swing, hit box, cooldown, input and touch button in src/sim/claw.ts; it opens piñatas, breaks fragile walls and defeats the Alacrán, Zopilote and Tlacuache (also while it plays dead); the swing sound plays (GDD-AUD-02); stun pending |
| GDD-CMB-03 | doing | spike and enemy hits: 2.0 s invulnerability and 80 px/s knockback in Taco and Fuego; crushing by a moving block costs a life in any state, even while invulnerable (src/sim/block.ts, src/sim/run.ts) |
| GDD-CTL-01 | doing | arrows, WASD, Space, Z, Up, W, claw (X, J), Fuego (C, K) and pause (Escape, P) wired; remap pending |
| GDD-CTL-02 | todo |  |
| GDD-CTL-03 | doing | left, right and jump buttons with multi-touch, and the slide stick with a mode switch, in src/ui/touchLayout.ts and TouchControls.ts; the claw, Fuego and pause buttons are built; mirroring, opacity, vibration pending |
| GDD-CTL-04 | todo | note: quick taps can fit inside one frame; latch presses from raw key events, see L-006 |
| GDD-WLD-01 | todo |  |
| GDD-WLD-02 | todo |  |
| GDD-WLD-03 | todo |  |
| GDD-WLD-04 | doing | hilo pickups (src/sim/hilo.ts, 20 in the sandbox in serape colours) and the HUD counter (src/ui/hiloCounter.ts); kept through lost lives and the restart; the pickup sound climbs a scale (GDD-AUD-02); items giving hilos instead, the multi-piñata, score and saving pending |
| GDD-WLD-05 | doing | pits and the ofrenda touch rule in src/sim/run.ts (3-tile pit and 3 placeholder ofrendas in the sandbox level); spikes in src/sim/hazards.ts (two in the sandbox); crumbling tiles in src/sim/crumble.ts (three in the sandbox); springs in src/sim/spring.ts (one in the sandbox); moving platforms in src/sim/platform.ts (one in the sandbox, which also reaches the Tlacuache's ledge); doors and keys in src/sim/door.ts (one of each in the sandbox); fragile walls in src/sim/fragile.ts (one in the sandbox); moving blocks, solid and crushing, in src/sim/block.ts (one in the sandbox pocket past the fragile wall) |
| GDD-ENM-01 | doing | enemy contact is one hit, never more than a life; the 3-tile spawn rule is checked for every level by the level validator (GDD-TEC-04) |
| GDD-ENM-02 | doing | the Alacrán, the Zopilote, the cactus buddy and the Tlacuache in src/sim/enemy.ts (one of each in the sandbox; the Tlacuache on a ledge in the top right corner); sounds and defeat animations pending; the cactus buddy's harmless-from-below rule has no level that exercises it (it needs a cactus with nothing beneath it), unit tests only |
| GDD-BOS-01 | todo |  |
| GDD-BOS-02 | todo |  |
| GDD-PRG-01 | todo |  |
| GDD-PRG-02 | doing | the settings are saved in local storage (src/sim/save.ts, version 1); world progress, hilos and the rest pending |
| GDD-PRG-03 | todo |  |
| GDD-UI-01 | doing | lives triangles (src/ui/livesLayout.ts), power-up icon, key icons and the hilo counter (src/ui/hiloCounter.ts) built; the semi-transparent look, controls under the safe-area insets (GDD-CTL-03) and hiding during cutscenes pending |
| GDD-UI-02 | doing | the pause in a level (keys, touch button, tap to resume, focus and portrait auto-pause) in src/sim/pause.ts and PlayScene; the title screen (veil over the level, placeholder Poncho, Enter, any game button or a tap starts, upright phones asked to turn sideways) in src/sim/title.ts and PlayScene; the pause menu (Resume, Quit to title; src/sim/pause.ts, src/ui/pauseMenu.ts) and quitting to the title over a fresh run; the title menu (Start, Settings) and the settings screen with Master and Effects volume, saved in the browser (src/sim/settings.ts, src/ui/settingsMenu.ts); a Left or Right key, touch button or slide-stick finger pressed while paused, or down when the level starts, is ignored until released (PlayScene, src/ui/TouchControls.ts); boot, world map, results and the language row pending |
| GDD-UI-03 | todo |  |
| GDD-AUD-01 | doing | audio unlock on first gesture is handled by the engine; Master and Effects volume on the settings screen (src/sim/settings.ts); music and its volume pending |
| GDD-AUD-02 | doing | generated placeholders for the ofrenda marimba, jump, land, claw, stomp, hilo (climbing major scale), life lost and meow, triggered from the step diff in src/sim/sfx.ts (scripts/audio/effects.mjs); real audio pending (Open Question 9) |
| GDD-ART-01 | doing | 480x270 canvas scaled to fit; art not started; the 1920x1080 art resolution (4x4 art pixels per game pixel) is decided, the switch comes with Poncho's sprite |
| GDD-ART-02 | todo |  |
| GDD-ART-03 | todo |  |
| GDD-ART-04 | todo |  |
| GDD-ART-05 | todo |  |
| GDD-ART-06 | todo |  |
| GDD-ART-07 | todo |  |
| GDD-TEC-01 | done | scaffold on latest stable: Phaser 4, TS 7, Vite 8, Vitest 5, Playwright, Oxlint |
| GDD-TEC-02 | done | src/sim/fixedStep.ts, sim has no Phaser imports |
| GDD-TEC-03 | doing | fit-to-screen test only; fps and size budgets pending |
| GDD-TEC-04 | doing | level validator built (src/levels/validate.ts) and run over every level in src/levels/index.ts; the sandbox is a test level (no exit or length check); the Tiled JSON loader and gap limits after World 1 pending |
| GDD-TEC-05 | done | src/config/tuning.ts, derived-number tests |
| GDD-TEC-06 | doing | Vitest and Playwright set up; level validation runs over every level (src/levels/levels.test.ts); fps and size checks pending with GDD-TEC-03 |
| GDD-MVP-01 | todo |  |
| GDD-MVP-02 | todo |  |
| GDD-PWR-01 | doing | Base, Taco and Fuego states, spike hit absorbed (Fuego goes back to Taco), respawn in Base (src/sim/run.ts, src/sim/taco.ts) |
| GDD-PWR-02 | doing | static taco pickup and the walking taco from a piñata (src/sim/item.ts); the chomp and freeze-frame pending |
| GDD-PWR-03 | doing | chile from piñatas, Fuego state, fireball and Fuego touch button (src/sim/fireball.ts, src/sim/run.ts); fireballs defeat the Alacrán, the Zopilote and the awake Tlacuache; ice, candles, bosses, sound and gamepad pending |
| GDD-PWR-04 | todo |  |
| GDD-PWR-05 | doing | head-bump piñata releasing a walking taco in Base (src/sim/pinata.ts, two in the sandbox); multi-piñata hilos pending; a chile comes out in Taco or Fuego |
| GDD-PWR-06 | doing | collect by touch and no spawn inside a wall (src/sim/item.ts); the reserve-slot question stays open |
| GDD-VIS-05 | todo |  |
| GDD-TEC-07 | todo |  |
