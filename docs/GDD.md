# PONCHO: Siete Vidas — Game Design Document

Version: 0.1.0

This document is the anchor for every feature. Rules:

- Each rule is a section `### GDD-XXX-NN` with a `Status:` line.
- **Decided** = the user said so. **Proposed** = a recommendation that is not binding until the user confirms it. **Deprecated** = removed, kept so IDs are never reused.
- Proposals are listed in [Open Questions](#open-questions) so they can be confirmed or changed.
- Numbers use *virtual pixels* at the base resolution defined in GDD-ART-01, unless stated otherwise.
- Process for editing: `.claude/skills/gdd-update/SKILL.md`.

## Changelog

- **0.1.0** (2026-10-19) First draft. Decided: title, premise, Phaser 3 + TypeScript + Vite stack, web and mobile targets. Everything else is Proposed. IDs: all.

---

## 1. Vision

### GDD-VIS-01 Logline and premise

Status: Decided (title and premise, user, 2026-10-19). Wording is Proposed.

**PONCHO: Siete Vidas** is a 2D platformer starring **Poncho**, a cat in a Mexican poncho. A cat has nine lives in English folklore, but in the Spanish-speaking tradition a cat has **siete vidas**. The title is the central mechanic: seven lives, and how you spend them is the game (see GDD-LIFE-01).

Story seed (Proposed): Poncho has lost lives one by one to a curse and must travel the seven worlds to get them back.

### GDD-VIS-02 Platforms and audience

Status: Decided (web and mobile, user, 2026-10-19). Audience is Proposed.

- Runs in desktop and mobile browsers. Touch controls are a first-class input (GDD-CTL-03).
- Audience (Proposed): players aged 8+ who like precise, forgiving, charming platformers. Difficulty is fair and readable, not punishing.
- Orientation (Proposed): landscape only on mobile.

### GDD-VIS-03 Design pillars

Status: Proposed

1. **Every life counts.** Seven lives is a visible, tangible resource that creates tension without cruelty.
2. **Cat agility.** Movement feels quick, light and forgiving. A cat always lands on its feet.
3. **Fair and readable.** Hazards are telegraphed. Deaths feel like the player's mistake and a retry is instant.
4. **Mexico with care.** Specific, respectful, affectionate references to real places, crafts and traditions. No stereotype shortcuts (GDD-VIS-04).

### GDD-VIS-04 Tone and cultural approach

Status: Proposed

- Tone: warm, playful, a little spooky. Día de Muertos imagery fits the seven-lives theme, and is treated as celebration of memory, not horror.
- Use specific references: serape weaving patterns, talavera tile, papel picado, alebrijes, ofrendas, regional landscapes (desert, sierra, jungle, cenotes, volcano).
- Avoid: sombrero-and-siesta caricature, cartel imagery, mocking accents, a single flattened "Mexico".
- Spanish is used for names and flavour; all gameplay text is also available in English (GDD-UI-03).
- If unsure about a reference, ask the user or leave it out.

---

## 2. Core loop

### GDD-LOOP-01 Moment-to-moment loop

Status: Proposed

Run, jump, dodge or defeat enemies, reach the next checkpoint. Each mistake costs a life but is recoverable. Mastery means finishing a world with lives to spare.

### GDD-LOOP-02 Level loop

Status: Proposed

Enter level, reach 3 checkpoints (ofrendas), reach the exit. Optional: collect all *hilos* (GDD-WLD-04) and find one secret. A level takes 2 to 4 minutes on first clear.

### GDD-LOOP-03 World loop

Status: Proposed

A world is 3 levels and 1 boss. Lives are a resource across the whole world (GDD-LIFE-05). Clearing a world unlocks the next one and a Poncho power (GDD-PRG-01).

---

## 3. Siete Vidas (the lives system)

### GDD-LIFE-01 Seven lives, seven stripes

Status: Proposed (the number seven is Decided by the title)

- Poncho has **7 lives** at the start of every world.
- Lives are shown as the **seven stripes of the poncho**. Each stripe is one life. Visible both on the HUD and on Poncho's sprite where feasible (to be confirmed against the reference image, GDD-ART-02).
- The count never exceeds 7.

### GDD-LIFE-02 Losing a life

Status: Proposed

- A life is lost on: touching an enemy or hazard without invulnerability, falling into a pit, or being crushed.
- On loss: the lost stripe unravels (0.4 s), Poncho flips and lands feet-first at the last checkpoint after 0.8 s (GDD-MOV-05), then has 2.0 s of invulnerability (blinking).
- Enemies and moving hazards reset to their initial state, collected *hilos* since the checkpoint are kept (no loss of progress that is not a life).
- Respawn is instant to restart: any input skips the 0.8 s delay after 0.3 s.

### GDD-LIFE-03 Regaining lives

Status: Proposed

- **Ofrenda checkpoint:** first activation of an ofrenda restores 1 life if fewer than 7. Each ofrenda restores only once.
- **Veladora pickup:** a candle hidden in a level restores 1 life. At most 1 per level.
- No other source. Lives stay scarce.

### GDD-LIFE-04 La Última Vida (last life)

Status: Proposed

When exactly 1 life remains: the music shifts to a tense variation, the last stripe pulses, and a *Última Vida* bonus applies: hilos give double score (GDD-PRG-03). Risk and reward, never an added penalty.

### GDD-LIFE-05 Out of lives

Status: Proposed

- Lives are tracked per world: 7 at world start, carried through its 3 levels and boss.
- At 0 lives: *Siete vidas gastadas* screen, then restart from the first level of the world with 7 lives. Hilos collected stay (GDD-PRG-02).
- Assist mode (GDD-UI-03) can grant infinite lives, marked as such in the save.

---

## 4. Movement

All numbers are initial tuning targets, to be adjusted by playtest. Code mirrors them in `src/config/tuning.ts` (GDD-TEC-05). Values are chosen so that a full jump peaks at about 56 px (3.5 tiles) and covers about 66 px (4.1 tiles) horizontally at full run speed, level ground to level ground. These figures include the apex hang and the terminal velocity cap (GDD-MOV-04) and were computed by simulation; GDD-TEC-05 requires a test that re-derives them.

### GDD-MOV-01 Run

Status: Proposed

- Max run speed: 120 px/s (7.5 tiles/s).
- Acceleration on ground: 800 px/s². Deceleration (no input): 1000 px/s². Turn-around (opposite input): 1600 px/s².
- Air acceleration: 600 px/s². Air deceleration: 300 px/s².
- Speed is analog on gamepad and touch stick if supported (GDD-CTL-02, GDD-CTL-03), digital on keyboard.

### GDD-MOV-02 Jump

Status: Proposed

- Takeoff velocity: 410 px/s upwards. Max height holding jump: 56 px (3.5 tiles).
- Variable jump: releasing jump while rising multiplies upward velocity by 0.4 (minimum hop about 9 px, 0.6 tile).
- Jump is on button press (not release). Holding after landing does not rejump.

### GDD-MOV-03 Input forgiveness

Status: Proposed

- Coyote time: 100 ms after leaving a ledge, jump is still allowed.
- Jump buffer: 100 ms. A jump pressed up to 100 ms before landing executes on landing.
- Corner correction: if the head clips a block corner by 4 px or less, Poncho is nudged around it.
- Stomp bounce buffer: jump pressed within 100 ms of a stomp gives the high bounce (GDD-CMB-01).

### GDD-MOV-04 Gravity and falling

Status: Proposed

- Gravity rising: 1500 px/s². Gravity falling: 2250 px/s² (1.5 times rising). Terminal velocity: 360 px/s.
- Apex hang: whenever the vertical speed magnitude is below 40 px/s, whichever gravity applies (rising or falling) is multiplied by 0.5, for a floatier peak. Order per step: apply gravity, clamp to terminal velocity, then move.
- Fixed timestep 60 Hz (GDD-TEC-02), so all values are deterministic.

### GDD-MOV-05 Cat reflexes

Status: Proposed

- No fall damage from height. Falling only hurts through pits or hazards.
- Landing squash animation 80 ms, does not block input.
- Respawn animation always ends with a feet-first landing (GDD-LIFE-02).
- Air control is generous (GDD-MOV-01); on a turn mid-air the sprite flips instantly.

### GDD-MOV-06 Size, hitbox and tile

Status: Proposed. Final hitbox TBD until the character image is available (GDD-ART-02).

- Tile size: 16 px.
- Placeholder hitbox: 12 px wide, 12 px tall, centred at the feet. The sprite is drawn larger than the hitbox.
- The hitbox is slightly forgiving: smaller than the visual for hazards (hurtbox) and standard for ground (collision).

### GDD-MOV-07 Poncho glide

Status: Proposed. Post-MVP (GDD-MVP-02), unlocked by GDD-PRG-01.

Hold jump while falling: the poncho spreads like a parachute. Fall speed capped at 70 px/s, horizontal speed unchanged. Lasts as long as the button is held. Cannot be started within 150 ms of a stomp bounce.

### GDD-MOV-08 Wall cling and kick

Status: Proposed. Post-MVP (GDD-MVP-02), unlocked by GDD-PRG-01.

Cat claws: pressing toward a wall while falling slows the slide to 60 px/s. Jump from the wall kicks away at 130 px/s horizontal and 380 px/s upward. 120 ms of locked horizontal control after the kick.

---

## 5. Combat and interaction

### GDD-CMB-01 Stomp

Status: Proposed

Landing on top of a stompable enemy defeats it and bounces Poncho: 260 px/s up, or 410 px/s up if jump is held or buffered. Some enemies are not stompable (spikes) and are marked visually.

### GDD-CMB-02 Claw swipe

Status: Proposed

A short-range melee on the action button: 0.25 s cooldown, hits a 20 x 14 px area in front of Poncho for 3 frames after a 2-frame wind-up. Defeats light enemies, stuns heavy ones for 1 s, breaks fragile blocks (papel picado walls). Cannot be used while taking a hit.

### GDD-CMB-03 Damage and invulnerability

Status: Proposed

- Every hit costs exactly 1 life (GDD-LIFE-02). There is no separate health bar.
- After a hit Poncho is invulnerable for 2.0 s and knocked back 40 px/s away from the source.
- Invulnerability does not protect from pits or crushing.

---

## 6. Controls

### GDD-CTL-01 Keyboard

Status: Proposed

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Jump | Space, Z or W / Up |
| Claw | X or J |
| Pause | Escape or P |

Keys are remappable (GDD-UI-03).

### GDD-CTL-02 Gamepad

Status: Proposed

Standard gamepad mapping: left stick or D-pad to move (analog speed), south button to jump, west button to claw, start to pause. Dead zone 0.2.

### GDD-CTL-03 Touch

Status: Proposed. Required for the MVP (GDD-MVP-01).

- Landscape layout with two thumb zones. Left: horizontal slide stick or left/right buttons (player choice). Right: Jump (large) and Claw buttons.
- Minimum touch target 48 CSS px, buttons offset from the screen edge by the safe-area inset.
- Layout can be mirrored and controls opacity adjustable (GDD-UI-03).
- Multi-touch: moving and jumping at the same time must work. Prevent page scroll, zoom, long-press menus and text selection while playing.
- Short vibration (50 ms) on life loss where the platform supports it. Audio unlocks on first touch (GDD-AUD-01).

### GDD-CTL-04 Input latency budget

Status: Proposed

Input is sampled once per fixed step (GDD-TEC-02). Jump press to first upward movement happens on the same step. Total input to screen budget: under 100 ms on a mid-range phone (GDD-TEC-03).

---

## 7. World and levels

### GDD-WLD-01 Structure

Status: Proposed

Seven worlds, matching the seven lives and the seven stripes. Each world has 3 levels and 1 boss. A world map screen links them. 7 x 4 = 28 stages in the full game.

### GDD-WLD-02 The seven worlds

Status: Proposed. Names and themes are a starting point for the user to react to.

| # | World | Setting | Signature element |
| --- | --- | --- | --- |
| 1 | Desierto | Chihuahuan desert village, adobe, cacti, agave fields | Tutorial world; basic enemies; sand slopes |
| 2 | Mercado | Rooftops, awnings and stalls of a busy market | Bouncy awnings, hanging papel picado |
| 3 | Sierra | Sierra Madre cliffs and old mines | Moving carts, crumbling ledges |
| 4 | Selva | Rain forest and ruins | Vines, water, glide-friendly updrafts |
| 5 | Cenote | Underground flooded caverns of the Yucatán | Water physics, darkness with light spots |
| 6 | Volcán | Volcano and lava fields | Rising lava, timed platforms |
| 7 | Mictlán | Día de Muertos finale, ofrendas and marigold paths | All mechanics combined; the final boss |

### GDD-WLD-03 Level anatomy

Status: Proposed

- Length: 3 to 6 screens wide at 480 px (GDD-ART-01). Mostly horizontal; vertical sections allowed.
- 3 ofrenda checkpoints at roughly 25%, 55% and 85% of the level, and an exit.
- 1 hidden secret per level (a room or a veladora).
- Teaching order: new mechanic is introduced in a safe spot, then combined with a threat, then used in a test.
- Gaps never exceed 3 tiles in World 1 (jump distance is about 4.1 tiles at full run, GDD-MOV-01 to GDD-MOV-04).

### GDD-WLD-04 Collectibles

Status: Proposed

- **Hilos (threads):** colourful threads scattered through levels; 50 per level. They unlock cosmetics for the poncho (GDD-PRG-01) and feed the score (GDD-PRG-03).
- **Veladora:** one per level at most, restores a life (GDD-LIFE-03).
- Collectibles guide the player's eye along the intended path and reward risk.

### GDD-WLD-05 Hazards and interactables

Status: Proposed

Core set: spikes (cactus, obsidian), pits, crumbling platforms (0.5 s warning), springs (bounce 480 px/s), moving platforms, fragile walls (claw-breakable), ofrendas (checkpoints), doors and keys. Each world adds one signature hazard (GDD-WLD-02).

---

## 8. Enemies and bosses

### GDD-ENM-01 Enemy design rules

Status: Proposed

- One idea per enemy, readable at a glance, with a 0.5 s telegraph before any attack.
- Every enemy can be beaten at least one way: stomp, claw or avoidance.
- Enemies never spawn on screen within 3 tiles of Poncho's respawn.
- Enemy contact always costs exactly 1 life (GDD-CMB-03).

### GDD-ENM-02 World 1 bestiary

Status: Proposed

| Enemy | Behaviour | Defeated by |
| --- | --- | --- |
| Alacrán (scorpion) | Patrols a platform, turns at edges | Stomp or claw |
| Zopilote (vulture) | Flies a sine path, swoops after a 0.5 s telegraph | Claw |
| Cactus buddy | Static, spiky, harmless from below | Avoid only |
| Tlacuache (opossum) | Fast charger, plays dead after hit | Claw, stomp after wake |

### GDD-BOS-01 Boss structure

Status: Proposed

Each world ends with a boss in a single-screen arena. Three phases, each teaching or testing the world's signature element. Bosses do not drop extra lives; the fight must be doable with the lives the player has left. Checkpoint at the arena start.

### GDD-BOS-02 World 1 boss

Status: Proposed. Placeholder concept.

A giant vulture, Don Zopilote, circles the arena and drops cactus fruit. Phase 1: dodge dives. Phase 2: knock rocks onto it with claw swipes. Phase 3: faster dives plus ground hazards. Defeat in 3 hits.

---

## 9. Progression and meta

### GDD-PRG-01 Unlocks

Status: Proposed

- Clearing worlds unlocks poncho powers in order: Glide (GDD-MOV-07, after World 2), Wall cling (GDD-MOV-08, after World 3). Further powers are open (GDD-MVP-02).
- Hilos buy cosmetics for the poncho (patterns and colours). Cosmetics never change gameplay.

### GDD-PRG-02 Save system

Status: Proposed

- Autosave to browser `localStorage` after each level and each checkpoint. Versioned schema with migration.
- Saves: world progress, hilos total, unlocked powers, cosmetics, settings, assist flags.
- Save never blocks the main thread and survives storage being unavailable (play without saving).

### GDD-PRG-03 Score and medals

Status: Proposed. Optional, can be cut.

Score from hilos, enemies and time. Level medals: Bronze (clear), Silver (all hilos), Gold (all hilos and 4 or more lives left at the exit). Última Vida doubles hilo score (GDD-LIFE-04).

---

## 10. UI and accessibility

### GDD-UI-01 HUD

Status: Proposed

- Top-left: seven stripes (GDD-LIFE-01), filled = life, dim = lost.
- Top-right: hilo counter.
- Minimal, semi-transparent, hidden during cutscenes. On touch, controls are drawn under the safe-area insets (GDD-CTL-03).

### GDD-UI-02 Menus and flow

Status: Proposed

Boot, title, world map, level, pause, results, settings. Fully operable by touch, keyboard and gamepad. Pause happens automatically if the tab loses focus or the device rotates to portrait.

### GDD-UI-03 Accessibility

Status: Proposed

- Remappable keys and adjustable touch layout (size, mirror, opacity).
- Assist mode: infinite lives, slower game speed (0.75x), hold-to-jump toggle.
- Reduced motion and screen-shake off. High-contrast outlines for hazards.
- Never rely on colour alone to signal danger. Subtitles for any spoken line.
- English and Spanish text, with a language switch.

---

## 11. Audio

### GDD-AUD-01 Music

Status: Proposed

Upbeat chiptune-and-acoustic mix: marimba, guitarrón, guitar, trumpets, played in the spirit of regional styles of each world. Each world has its own theme and a tense variation for Última Vida. All music is original or properly licensed. Audio is unlocked on first user gesture (browser requirement). Master, music and effects volumes are adjustable.

### GDD-AUD-02 Sound effects

Status: Proposed

Short, punchy and readable: jump, land, claw, stomp, hilo pickup (rising pitch combo), life lost (unravelling thread sound), ofrenda activate (bell), Poncho meows as personality. Each SFX is under 1 s and compressed for the web.

---

## 12. Art

### GDD-ART-01 Style and resolution

Status: Proposed

- Pixel art with a hand-made feel. Base resolution 480 x 270 (16:9) scaled by integer factors where possible, letterboxed on other aspect ratios.
- 16 px tile grid. Poncho sprite around 24 x 24 px (final size set by the reference, GDD-ART-02).
- Limited palette per world drawn from real Mexican craft colours.

### GDD-ART-02 Poncho (character)

Status: Proposed. **TBD: waiting for the user's reference image.** Nothing about Poncho's look is final.

When the image arrives, this section records: coat colour and markings, poncho pattern and colours (and how seven stripes map to it), face and proportions, any accessories. Every sprite is derived from the image. Save the original in `assets/characters/poncho/reference.png`.

### GDD-ART-03 Palette

Status: Proposed. **TBD: derived from the reference image.**

The master palette starts from the colours in Poncho's poncho, then adds world palettes (GDD-WLD-02) from talavera, serape and marigold tones. The seven stripe colours should be distinguishable for colour-blind players (GDD-UI-03).

### GDD-ART-04 Poncho animation set

Status: Proposed

Idle (blink), run, skid, jump up, apex, fall, land, claw swipe, hurt, respawn flip, wall cling (post-MVP), glide (post-MVP), victory. Exact frame counts decided with the final sprite sheet.

---

## 13. Technical

### GDD-TEC-01 Stack

Status: Decided (user, 2026-10-19). See `docs/decisions/0001-engine-and-platform.md`.

Phaser 3, TypeScript (strict), Vite, Vitest for unit tests, Playwright for end-to-end playtests.

### GDD-TEC-02 Deterministic simulation

Status: Proposed

- Fixed timestep of 60 Hz for gameplay logic; rendering interpolates.
- Simulation code (movement, lives, damage, collision) has no Phaser imports and no `Math.random()` without a seeded source, so it is unit-testable and replayable.
- Scene code only wires input, rendering and audio to the simulation.

### GDD-TEC-03 Performance and mobile targets

Status: Proposed

- 60 fps on a mid-range phone from the last 4 years, 30 fps floor on low end with automatic quality fallback.
- Initial download under 5 MB for the first level; later assets lazy-loaded.
- Works offline once loaded (service worker, PWA installable).
- Handles device pixel ratio, safe areas, orientation change and tab suspension.

### GDD-TEC-04 Level authoring

Status: Proposed

Levels are authored in Tiled and exported as JSON (tilemap and object layers: spawn, ofrendas, hilos, enemies, hazards, exit). A validator test loads every level and checks: exactly one spawn, 3 ofrendas, an exit, no gap wider than the world's limit (GDD-WLD-03).

### GDD-TEC-05 Tuning in one place

Status: Proposed

All gameplay numbers in this document live in a single typed file, `src/config/tuning.ts`, each constant commented with its GDD ID. A unit test simulates a full jump and asserts the derived values stated in section 4 (peak 56 px and horizontal distance 66 px at full run, each within 1.5 px).

### GDD-TEC-06 Testing strategy

Status: Proposed

- Unit tests (Vitest) for simulation: movement numbers, forgiveness windows, lives rules, save migration.
- Level validation tests (GDD-TEC-04).
- Playwright playtests per the `playtest` skill: boot, jump, life loss, touch input, console free of errors.
- `scripts/check.mjs` runs all of these through npm scripts once they exist.

---

## 14. Scope

### GDD-MVP-01 Vertical slice

Status: Proposed

The first playable milestone:

- Poncho with run, jump (GDD-MOV-01 to GDD-MOV-06), stomp and claw (GDD-CMB-01 to GDD-CMB-03).
- Seven-lives system complete (GDD-LIFE-01 to GDD-LIFE-05) and HUD (GDD-UI-01).
- World 1 with 3 levels and the boss, bestiary of GDD-ENM-02.
- Keyboard and touch controls (GDD-CTL-01, GDD-CTL-03), gamepad nice to have.
- Autosave (GDD-PRG-02), pause, settings with volume and language.
- Placeholder music and SFX are acceptable.

Done means: the `playtest` skill passes on desktop and a phone viewport, and the user has played it.

### GDD-MVP-02 Later scope

Status: Proposed

Worlds 2 to 7, glide, wall cling, further powers, medals and score, cosmetics shop, full soundtrack, localisation beyond English and Spanish, native packaging (new ADR).

---

## Open Questions

Answer these to move items from Proposed to Decided. Until then the Proposed text stands as the working assumption.

1. **Lives scope (GDD-LIFE-05):** lives carried across a whole world (recommended, so seven is a real budget) or reset every level?
2. **One-hit rule (GDD-CMB-03):** every hit costs one life with no health bar (recommended) or add hearts per life?
3. **Lives meaning (GDD-LIFE-01):** should a life ever be *spent on purpose* (for example a power that costs a stripe)? Not in the draft; interesting but changes the balance.
4. **Seven worlds (GDD-WLD-02):** are the world themes and names right? Anything you want, or want avoided?
5. **Story (GDD-VIS-01):** is the curse-and-seven-lives story seed what you want, or a different premise?
6. **Poncho's look and identity (GDD-ART-02):** pending your image. Does the poncho have seven stripes, or should another visual carry the lives? Is Poncho a he, she or they, for story and UI text? The draft avoids choosing.
7. **Pixel art vs another style (GDD-ART-01):** confirm pixel art at 480 x 270.
8. **Combat (GDD-CMB-02):** is a claw attack wanted in addition to stomping?
9. **Difficulty (GDD-VIS-02):** is assist mode and a kid-friendly tone right, or do you want a harder game?
10. **Audio (GDD-AUD-01):** will you provide music, or should placeholders be generated and licensed assets chosen?
11. **Score and medals (GDD-PRG-03):** keep or cut?
12. **Distribution:** where will it be hosted (itch.io, own site, stores)? This drives PWA versus native packaging.
