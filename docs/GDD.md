# PONCHO: Siete Vidas — Game Design Document

Version: 0.4.1

This document is the anchor for every feature. Rules:

- Each rule is a section `### GDD-XXX-NN` with a `Status:` line.
- **Decided** = the user said so. **Proposed** = a recommendation that is not binding until the user confirms it. **Deprecated** = removed, kept so IDs are never reused.
- Proposals are listed in [Open Questions](#open-questions) so they can be confirmed or changed.
- Numbers use *virtual pixels* at the base resolution defined in GDD-ART-01, unless stated otherwise.
- Process for editing: `.claude/skills/gdd-update/SKILL.md`.

## Changelog

- **0.4.1** (2026-10-19) GDD-UI-01: lives fill from the left and empty from the right; triangles are told apart by fill versus outline, not colour. HUD built.
- **0.4.0** (2026-10-19) Decided: state-of-the-art stack on the latest stable releases (Phaser 4, TypeScript 7, Vite 8, Vitest 5, Playwright, Oxlint): GDD-TEC-01 rewritten, new GDD-TEC-07 dependency policy, ADR 0002.
- **0.3.0** (2026-10-19) Decided: pixel art (GDD-ART-01) and lives carried across a world (GDD-LIFE-05). New GDD-VIS-05: "PB" is the Poncho on Base brand mark, Poncho is the origin character of a meme coin on the Base blockchain; the game itself has no on-chain features. Jump numbers re-measured in the 60 Hz simulation: GDD-MOV-02 (minimum hop about 15 px), GDD-MOV-04 (exact integration), GDD-TEC-05 (test tolerances), GDD-WLD-03. Open Questions renumbered. Project scaffolded (GDD-TEC-01, GDD-TEC-02, GDD-TEC-05).
- **0.2.0** (2026-10-19) Reference image received: GDD-ART-02, GDD-ART-03, GDD-ART-04, GDD-MOV-06 rewritten from it. Lives are shown as seven triangles, not stripes (the poncho has triangle patterns): GDD-LIFE-01, GDD-LIFE-02, GDD-LIFE-04, GDD-WLD-01, GDD-UI-01, GDD-UI-03. Decided: lives carried across a world (GDD-LIFE-05), Mario-style power-ups in the poncho setting (new section 6, GDD-PWR-01 to GDD-PWR-06), Poncho loves tacos and spicy food (GDD-VIS-01). GDD-CMB-03, GDD-LIFE-02, GDD-PRG-01, GDD-UI-01, GDD-MVP-01, GDD-MVP-02 and Open Questions updated.
- **0.1.0** (2026-10-19) First draft. Decided: title, premise, Phaser 3 + TypeScript + Vite stack, web and mobile targets. Everything else is Proposed. IDs: all.

---

## 1. Vision

### GDD-VIS-01 Logline and premise

Status: Decided (title and premise, user, 2026-10-19). Wording is Proposed.

**PONCHO: Siete Vidas** is a 2D platformer starring **Poncho**, a cat in a Mexican poncho. A cat has nine lives in English folklore, but in the Spanish-speaking tradition a cat has **siete vidas**. The title is the central mechanic: seven lives, and how you spend them is the game (see GDD-LIFE-01).

Character trait (Decided, user, 2026-10-19): Poncho loves tacos and spicy food. This drives the power-ups (section 6) and Poncho's personality.

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

### GDD-VIS-05 Origin and brand

Status: Decided (user, 2026-10-19). The scope limits are Proposed.

Poncho is the origin character of **Poncho on Base** ("PB"), a meme coin on the Base blockchain, where Poncho is billed as the cutest cat on Base. This game is a platformer starring that character. The "PB" marks in the reference image are that brand (GDD-ART-02).

Proposed scope: the game has no wallet, token, NFT or on-chain feature, and it never asks for an account. It plays fully offline. Any such integration needs its own GDD ID and a decision from the user first (Open Question 6).

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

### GDD-LIFE-01 Seven lives, seven triangles

Status: Proposed (the number seven is Decided by the title)

- Poncho has **7 lives** at the start of every world.
- Lives are shown as **seven triangles**, the signature motif of Poncho's poncho (GDD-ART-02). Each triangle is one life. They are drawn on the HUD (GDD-UI-01); a lost life leaves an empty outline.
- The poncho in the reference has triangle and chevron patterns, not stripes, so the earlier "seven stripes" idea was dropped.
- The count never exceeds 7.

### GDD-LIFE-02 Losing a life

Status: Proposed

- A life is lost on: being hit while in the Base power-up state (GDD-PWR-01), touching an enemy or hazard without invulnerability, falling into a pit, or being crushed.
- On loss: the lost triangle on the HUD cracks and fades to an outline (0.4 s), Poncho flips and lands feet-first at the last checkpoint after 0.8 s (GDD-MOV-05), then has 2.0 s of invulnerability (blinking).
- Enemies and moving hazards reset to their initial state, collected *hilos* since the checkpoint are kept (no loss of progress that is not a life).
- Respawn is instant to restart: any input skips the 0.8 s delay after 0.3 s.

### GDD-LIFE-03 Regaining lives

Status: Proposed

- **Ofrenda checkpoint:** first activation of an ofrenda restores 1 life if fewer than 7. Each ofrenda restores only once.
- **Veladora pickup:** a candle hidden in a level restores 1 life. At most 1 per level.
- No other source. Lives stay scarce.

### GDD-LIFE-04 La Última Vida (last life)

Status: Proposed

When exactly 1 life remains: the music shifts to a tense variation, the last triangle pulses, and a *Última Vida* bonus applies: hilos give double score (GDD-PRG-03). Risk and reward, never an added penalty.

### GDD-LIFE-05 Out of lives

Status: Decided (lives are carried across a world, user, 2026-10-19). Details are Proposed.

- Lives are tracked per world: 7 at world start, carried through its 3 levels and boss.
- At 0 lives: *Siete vidas gastadas* screen, then restart from the first level of the world with 7 lives. Hilos collected stay (GDD-PRG-02).
- Assist mode (GDD-UI-03) can grant infinite lives, marked as such in the save.

---

## 4. Movement

All numbers are initial tuning targets, to be adjusted by playtest. Code mirrors them in `src/config/tuning.ts` (GDD-TEC-05). Values are chosen so that a full jump peaks at about 56 px (3.5 tiles) and covers about 66 to 68 px (4.1 to 4.3 tiles) horizontally at full run speed, level ground to level ground. The range is the landing resolution: one 60 Hz step at full speed is 2 px. The figures include the apex hang and the terminal velocity cap (GDD-MOV-04). They are measured by the simulation tests (GDD-TEC-05), not just calculated.

### GDD-MOV-01 Run

Status: Proposed

- Max run speed: 120 px/s (7.5 tiles/s).
- Acceleration on ground: 800 px/s². Deceleration (no input): 1000 px/s². Turn-around (opposite input): 1600 px/s².
- Air acceleration: 600 px/s². Air deceleration: 300 px/s².
- Speed is analog on gamepad and touch stick if supported (GDD-CTL-02, GDD-CTL-03), digital on keyboard.

### GDD-MOV-02 Jump

Status: Proposed

- Takeoff velocity: 410 px/s upwards. Max height holding jump: 56 px (3.5 tiles).
- Variable jump: releasing jump while rising multiplies upward velocity by 0.4 (minimum hop about 15 px, 0.9 tile: the takeoff step already rises about 6.6 px before a release can register, and cutting the remaining speed adds about 8 px).
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
- Apex hang: whenever the vertical speed magnitude is below 40 px/s, whichever gravity applies (rising or falling) is multiplied by 0.5, for a floatier peak. Order per step: apply gravity, clamp to terminal velocity, then move using the average of the old and new vertical velocity (and likewise horizontally). That is exact for constant acceleration, so the figures in this section do not depend on the step rate.
- Fixed timestep 60 Hz (GDD-TEC-02), so all values are deterministic.

### GDD-MOV-05 Cat reflexes

Status: Proposed

- No fall damage from height. Falling only hurts through pits or hazards.
- Landing squash animation 80 ms, does not block input.
- Respawn animation always ends with a feet-first landing (GDD-LIFE-02).
- Air control is generous (GDD-MOV-01); on a turn mid-air the sprite flips instantly.

### GDD-MOV-06 Size, hitbox and tile

Status: Proposed. Based on the reference image (GDD-ART-02); validate against the real sprite sheet.

- Tile size: 16 px.
- Sprite frame: 32 x 32 px. Poncho is a chibi cat about 2.5 heads tall with a very wide sombrero (the brim is about 1.5 times the width of the body).
- Body hitbox (ground and walls): 12 px wide, 14 px tall, centred at the feet. Fits through a 1-tile-high gap.
- Hurtbox (enemies and hazards): 10 x 12 px, inside the body hitbox, so near-misses feel fair.
- The sombrero brim is visual only. The crown top is the head-bump point for piñatas (GDD-PWR-05).

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

- A hit is resolved by the power-up state (GDD-PWR-01): in Base it costs exactly 1 life (GDD-LIFE-02); in Taco or Fuego it only downgrades the state and costs no life. There is no separate health bar.
- After a hit Poncho is invulnerable for 2.0 s and knocked back 40 px/s away from the source.
- Invulnerability does not protect from pits or crushing.

---

## 6. Power-ups

Decided (user, 2026-10-19): the game has Mario-style power-ups, themed to Poncho's world. The specific items below are Proposed. Power-ups are temporary and are lost when hit; permanent abilities (glide, wall cling) are separate (GDD-PRG-01).

### GDD-PWR-01 Power-up states

Status: Proposed

Poncho is always in exactly one state. The hitbox does not change between states (simpler levels, same on touch).

| State | Look | What a hit does |
| --- | --- | --- |
| **Base** | Empty hands | Costs 1 life (GDD-LIFE-02) |
| **Taco** | Holds a taco, as in the reference image | The taco is gone, no life lost, back to Base |
| **Fuego** | Taco plus glowing chile, can spit fire (GDD-PWR-03) | Back to Taco, no life lost |

- A hit that downgrades the state still gives 2.0 s invulnerability and knockback (GDD-CMB-03).
- Losing a life respawns Poncho in Base.
- Picking up an item that would not improve the state gives hilos instead (GDD-WLD-04).
- Lives are never granted by taco or chile. Only veladoras and ofrendas restore lives (GDD-LIFE-03).

### GDD-PWR-02 Taco (the mushroom)

Status: Proposed

Base to Taco. A taco walks away from a broken piñata at 40 px/s, turns at walls and falls off ledges, like a Mario mushroom. Collecting it plays a chomp, a 0.3 s freeze-frame and a sparkle. Poncho keeps the taco in hand until hit.

### GDD-PWR-03 Chile and Fuego (the fire flower)

Status: Proposed

- Taco to Fuego by eating a chile (a stationary glowing pepper released from a piñata when Poncho is already in Taco or Fuego).
- In Fuego the Fuego button spits a salsa fireball: 180 px/s horizontal, bounces along the ground with a 20 px arc, vanishes on walls or after 3 s, maximum 2 on screen.
- Fireballs defeat most light enemies, melt ice and light unlit candles. Bosses take 1 damage per fireball unless a boss rule says otherwise (GDD-BOS-01).
- The Fuego button is separate from Claw (GDD-CMB-02). On touch it appears only while in Fuego (GDD-CTL-03).

### GDD-PWR-04 Chile Fantasma (the star)

Status: Proposed. Post-MVP (GDD-MVP-02).

A rare ghost pepper hidden in special piñatas. For 8 s: Poncho is invulnerable (golden glow, as in the reference illustration), runs at 180 px/s and defeats anything on contact. Does not protect from pits or crushing. Music switches to a spicy variation. The last 2 s flash as a warning.

### GDD-PWR-05 Piñata blocks (the question blocks)

Status: Proposed

Hanging piñatas that open when Poncho hits them from below (head bump) or with a claw swipe, releasing an item or hilos. A piñata releases a Taco if Poncho is Base, otherwise a Chile; a multi-piñata gives up to 10 hilos over 4 s. An opened piñata becomes a broken shell. Piñatas are drawn so players recognise them at a glance and never hide a lethal surprise.

### GDD-PWR-06 Item rules

Status: Proposed

- At most one active item per piñata. Items never spawn inside a wall.
- Items are collected by touch with the body hitbox (GDD-MOV-06).
- There is no reserve slot in the MVP. Whether to add one (as in some Mario games) is an Open Question.
- The veladora (a life, GDD-LIFE-03) is the only extra-life item.

---

## 7. Controls

### GDD-CTL-01 Keyboard

Status: Proposed

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Jump | Space, Z or W / Up |
| Claw | X or J |
| Fuego (fireball) | C or K |
| Pause | Escape or P |

Keys are remappable (GDD-UI-03).

### GDD-CTL-02 Gamepad

Status: Proposed

Standard gamepad mapping: left stick or D-pad to move (analog speed), south button to jump, west button to claw, east button for Fuego, start to pause. Dead zone 0.2.

### GDD-CTL-03 Touch

Status: Proposed. Required for the MVP (GDD-MVP-01).

- Landscape layout with two thumb zones. Left: horizontal slide stick or left/right buttons (player choice). Right: Jump (large) and Claw buttons, plus a Fuego button that appears only in the Fuego state (GDD-PWR-03).
- Minimum touch target 48 CSS px, buttons offset from the screen edge by the safe-area inset.
- Layout can be mirrored and controls opacity adjustable (GDD-UI-03).
- Multi-touch: moving and jumping at the same time must work. Prevent page scroll, zoom, long-press menus and text selection while playing.
- Short vibration (50 ms) on life loss where the platform supports it. Audio unlocks on first touch (GDD-AUD-01).

### GDD-CTL-04 Input latency budget

Status: Proposed

Input is sampled once per fixed step (GDD-TEC-02). Jump press to first upward movement happens on the same step. Total input to screen budget: under 100 ms on a mid-range phone (GDD-TEC-03).

---

## 8. World and levels

### GDD-WLD-01 Structure

Status: Proposed

Seven worlds, matching the seven lives and the seven triangles. Each world has 3 levels and 1 boss. A world map screen links them. 7 x 4 = 28 stages in the full game.

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
- Gaps never exceed 3 tiles in World 1 (jump distance is about 4.1 to 4.3 tiles at full run, GDD-MOV-01 to GDD-MOV-04).

### GDD-WLD-04 Collectibles

Status: Proposed

- **Hilos (threads):** colourful threads scattered through levels; 50 per level. They unlock cosmetics for the poncho (GDD-PRG-01) and feed the score (GDD-PRG-03).
- **Veladora:** one per level at most, restores a life (GDD-LIFE-03).
- Collectibles guide the player's eye along the intended path and reward risk.

### GDD-WLD-05 Hazards and interactables

Status: Proposed

Core set: spikes (cactus, obsidian), pits, crumbling platforms (0.5 s warning), springs (bounce 480 px/s), moving platforms, fragile walls (claw-breakable), ofrendas (checkpoints), doors and keys. Each world adds one signature hazard (GDD-WLD-02).

---

## 9. Enemies and bosses

### GDD-ENM-01 Enemy design rules

Status: Proposed

- One idea per enemy, readable at a glance, with a 0.5 s telegraph before any attack.
- Every enemy can be beaten at least one way: stomp, claw or avoidance.
- Enemies never spawn on screen within 3 tiles of Poncho's respawn.
- Enemy contact is resolved by GDD-CMB-03 and never costs more than 1 life.

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

## 10. Progression and meta

### GDD-PRG-01 Unlocks

Status: Proposed

- Clearing worlds unlocks permanent **abilities** in order (these are not the temporary power-ups of section 6): Glide (GDD-MOV-07, after World 2), Wall cling (GDD-MOV-08, after World 3). Further powers are open (GDD-MVP-02).
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

## 11. UI and accessibility

### GDD-UI-01 HUD

Status: Proposed

- Top-left: seven triangles (GDD-LIFE-01), filled = life, outline = lost. Lives fill from the left, so a lost life empties the rightmost filled triangle. Filled and outline differ by shape, not colour alone (GDD-UI-03). Next to them, a small icon of the current power-up state (GDD-PWR-01).
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

## 12. Audio

### GDD-AUD-01 Music

Status: Proposed

Upbeat chiptune-and-acoustic mix: marimba, guitarrón, guitar, trumpets, played in the spirit of regional styles of each world. Each world has its own theme and a tense variation for Última Vida. All music is original or properly licensed. Audio is unlocked on first user gesture (browser requirement). Master, music and effects volumes are adjustable.

### GDD-AUD-02 Sound effects

Status: Proposed

Short, punchy and readable: jump, land, claw, stomp, hilo pickup (rising pitch combo), life lost (unravelling thread sound), ofrenda activate (bell), Poncho meows as personality. Each SFX is under 1 s and compressed for the web.

---

## 13. Art

### GDD-ART-01 Style and resolution

Status: Decided (pixel art, user, 2026-10-19). Resolution, tile size and palette rules are Proposed.

- Pixel art with a hand-made feel. Base resolution 480 x 270 (16:9) scaled by integer factors where possible, letterboxed on other aspect ratios.
- The reference image is a smooth illustration. Sprites are redrawn by hand as pixel art that keeps its shapes, proportions and colours (GDD-ART-02, GDD-ART-03).
- 16 px tile grid. Poncho sprite frame 32 x 32 px (GDD-MOV-06, GDD-ART-02).
- Limited palette per world drawn from real Mexican craft colours.

### GDD-ART-02 Poncho (character)

Status: Decided (appearance from the user's reference image, 2026-10-19). Sprite-level details are Proposed.

Reference: `assets/characters/poncho/reference.jpg` (512 x 512 illustration, orange background). Every sprite is derived from it.

- **Build:** chubby chibi cat standing upright on two legs, large head, big pointed ears with pink insides.
- **Fur:** warm tan and ginger, cream muzzle, chest and paws, darker ginger tabby marks on the forehead.
- **Face:** large dark brown eyes with white highlights, slightly furrowed brows (confident, cheeky), pink cheek blush, small pink nose, small smirk.
- **Sombrero:** wide-brim, blue, with a red crown and red band, and a red and cream zigzag trim around the brim.
- **Poncho:** blue with red and cream triangle patterns, a V-neck, a red border with cream triangles at the hem, and cream fringe along the bottom edge. A darker navy layer with fringe shows behind it (cape or back panel).
- **Held item:** a taco with lettuce, tomato and meat in one hand. This becomes the Taco state (GDD-PWR-01).
- **Glow:** the illustration has a golden rim light. It is reserved as the invulnerability effect (GDD-CMB-03, GDD-PWR-04).
- **PB mark (Decided, user, 2026-10-19):** the small gold "PB" badge on the chest and the "PB" mark in the bottom-right corner of the reference stand for **Poncho on Base** (GDD-VIS-05). Keep the badge on the chest as a few gold pixels where the frame allows. The corner mark is a brand watermark and is not part of the character. Tail and back are not shown and will be designed to match.
- **Personality (Decided):** loves tacos and spicy food.
- **Pronouns:** not stated. Text uses Poncho's name or "they" (Open Question 5).

### GDD-ART-03 Palette

Status: Proposed. Approximate colours sampled from the reference JPEG; the final palette is extracted when the pixel art is made.

| Use | Approx. colour |
| --- | --- |
| Sombrero and poncho blue | #44588A |
| Poncho and sombrero red | #B94842 |
| Fur (light tan) | #ECD4A6 |
| Taco shell | #CF9251 |
| Dark cape layer | #382E47 |
| Illustration background (marketing only) | #D2690D |

World palettes (GDD-WLD-02) start from these and add talavera, serape and marigold tones. Poncho must stay readable against every world background: blue and red against warm desert tones needs a dark outline.

### GDD-ART-04 Poncho animation set

Status: Proposed

Idle (blink, glances at the taco in Taco state), run, skid, jump up, apex, fall, land, claw swipe, fireball spit (Fuego), hurt (sombrero tips off, taco bitten), respawn flip, eating a taco or chile, victory (taco in the air), wall cling (post-MVP), glide (post-MVP). Exact frame counts decided with the final sprite sheet.

---

## 14. Technical

### GDD-TEC-01 Stack

Status: Decided (user, 2026-10-19: state of the art, latest releases). See `docs/decisions/0002-state-of-the-art-stack.md`.

Phaser 4, TypeScript 7 (native compiler, strict), Vite 8, Vitest 5 for unit tests, Playwright for end-to-end playtests, Oxlint with type-aware rules for linting, Node 24 LTS in CI. Exact versions are in the ADR and `package-lock.json`. The first decision (Phaser 3) is superseded.

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

All gameplay numbers in this document live in a single typed file, `src/config/tuning.ts`, each constant commented with its GDD ID. A unit test simulates a full jump and asserts the derived values stated in section 4: peak 56 px within 1.5 px, and horizontal distance 66 px at full run within one step of travel (2 px).

### GDD-TEC-07 Dependency policy

Status: Decided (use the latest stable releases, user, 2026-10-19). The review cadence and the holdback rule are Proposed.

- Track the latest stable release of every dependency. No pre-release versions in `main`.
- At every GDD minor version bump, run `npm outdated`, upgrade, run the full gate and the playtests, and record the result in the changelog or an ADR.
- Anything that must stay behind (a blocker like a peer-dependency conflict) is written down in an ADR with the condition for upgrading.
- Phaser APIs marked deprecated (the Canvas renderer, custom pipelines) are not used.

### GDD-TEC-06 Testing strategy

Status: Proposed

- Unit tests (Vitest) for simulation: movement numbers, forgiveness windows, lives rules, save migration.
- Level validation tests (GDD-TEC-04).
- Playwright playtests per the `playtest` skill: boot, jump, life loss, touch input, console free of errors.
- `scripts/check.mjs` runs all of these through npm scripts once they exist.

---

## 15. Scope

### GDD-MVP-01 Vertical slice

Status: Proposed

The first playable milestone:

- Poncho with run, jump (GDD-MOV-01 to GDD-MOV-06), stomp and claw (GDD-CMB-01 to GDD-CMB-03).
- Seven-lives system complete (GDD-LIFE-01 to GDD-LIFE-05) and HUD (GDD-UI-01).
- Power-ups: Taco, Chile and Fuego, piñatas (GDD-PWR-01, GDD-PWR-02, GDD-PWR-03, GDD-PWR-05, GDD-PWR-06).
- World 1 with 3 levels and the boss, bestiary of GDD-ENM-02.
- Keyboard and touch controls (GDD-CTL-01, GDD-CTL-03), including the Fuego button, gamepad nice to have.
- Autosave (GDD-PRG-02), pause, settings with volume and language.
- Placeholder music and SFX are acceptable.

Done means: the `playtest` skill passes on desktop and a phone viewport, and the user has played it.

### GDD-MVP-02 Later scope

Status: Proposed

Worlds 2 to 7, Chile Fantasma (GDD-PWR-04), glide, wall cling, further powers, medals and score, cosmetics shop, full soundtrack, localisation beyond English and Spanish, native packaging (new ADR).

---

## Open Questions

Answer these to move items from Proposed to Decided. Until then the Proposed text stands as the working assumption.

1. **Taco as shield (GDD-PWR-01, GDD-CMB-03):** Taco and Fuego absorb hits like Mario's mushroom and flower. This makes lives less scarce. Right balance, or should power-ups be rarer or not absorb hits?
2. **Power-up set (section 6):** Taco, Chile (Fuego fireballs), Chile Fantasma (star), piñata blocks. Anything you want added, such as a different fireball style, a reserve slot, or other foods?
3. **Seven worlds (GDD-WLD-02):** are the world themes and names right? Anything you want, or want avoided?
4. **Story (GDD-VIS-01):** is the curse-and-seven-lives story seed what you want, or a different premise?
5. **Pronouns (GDD-ART-02):** is Poncho a he, she or they, for story and UI text? The draft avoids choosing.
6. **Brand and chain scope (GDD-VIS-05):** the draft keeps the game free of wallets, tokens and on-chain features. Is that right? Should the game mention the Poncho on Base token or community anywhere (credits, links), and who owns the final brand rules? Note that app stores restrict crypto features, which affects distribution (question 11).
7. **Combat (GDD-CMB-02):** keep both claw swipe and stomp, with fireballs on top?
8. **Difficulty (GDD-VIS-02):** is assist mode and a kid-friendly tone right, or do you want a harder game?
9. **Audio (GDD-AUD-01):** will you provide music, or should placeholders be generated and licensed assets chosen?
10. **Score and medals (GDD-PRG-03):** keep or cut?
11. **Distribution:** where will it be hosted (itch.io, own site, stores)? This drives PWA versus native packaging.
