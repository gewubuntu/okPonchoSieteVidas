# PONCHO: Siete Vidas — Game Design Document

Version: 0.4.33

This document is the anchor for every feature. Rules:

- Each rule is a section `### GDD-XXX-NN` with a `Status:` line.
- **Decided** = the user said so. **Proposed** = a recommendation that is not binding until the user confirms it. **Deprecated** = removed, kept so IDs are never reused.
- Proposals are listed in [Open Questions](#open-questions) so they can be confirmed or changed.
- Numbers use *virtual pixels* at the base resolution defined in GDD-ART-01, unless stated otherwise.
- Process for editing: `.claude/skills/harness-gdd-update/SKILL.md`.

## Changelog

- **0.4.33** (2026-10-22) GDD-LIFE-04: the last-life pulse is built: with one life left its HUD triangle grows to 1.4x and back every 0.8 s; the size and timing are written out as proposals. The music shift and the double hilo score wait for music and hilos.
- **0.4.32** (2026-10-22) GDD-LIFE-02: "any input" that skips the respawn wait now really is any input: claw, Fuego, and left and right held together count too, as jump and a direction already did (a gap the GDD-LIFE-05 review found; user, 2026-10-22: fix it).
- **0.4.31** (2026-10-22) GDD-LIFE-05, GDD-LIFE-02, GDD-CTL-04: the *Siete vidas gastadas* screen is built: it replaces the respawn after the last life and stays until a press of any button, ignoring presses for its first 1.0 s; the world then restarts with the respawn flip at the level start (user decisions, 2026-10-22: press to continue; title and seven empty triangles; "Game over" and "Press any button to Retry" below them). Left and right are now latched like jump and claw, so a quick tap of either counts (L-006). Its look and the exact press rule are written out as proposals.
- **0.4.30** (2026-10-22) GDD-ENM-02, GDD-ENM-01, GDD-CMB-01, GDD-CMB-02, GDD-CMB-03, GDD-PWR-03, GDD-WLD-05: the Tlacuache is built: it walks, spots Poncho in front of it, telegraphs for 0.5 s and charges; its first stomp makes it play dead for 2.0 s, out of play, and a stomp after it wakes defeats it, as does the claw or a fireball while it is awake (user decisions, 2026-10-22: stomp twice, sight then dash); the claw defeats it even while it plays dead (user decision, 2026-10-22); its size, speeds, sight and timings are written out as proposals. The sandbox gets a ledge in the top right corner for it, reached from the moving platform.
- **0.4.29** (2026-10-22) GDD-ENM-02, GDD-ENM-01, GDD-CMB-01, GDD-CMB-02, GDD-CMB-03, GDD-PWR-03: the cactus buddy is built: static, cannot be stomped, harmless only when Poncho rises into it from beneath, and nothing defeats it (user decisions, 2026-10-22: rising into it is the harmless case; the claw passes through it and a fireball is used up by it); its size and the exact from-below rule are written out as proposals.
- **0.4.28** (2026-10-22) GDD-ENM-02, GDD-ENM-01, GDD-CMB-01, GDD-CMB-02, GDD-CMB-03, GDD-PWR-03: the Zopilote is built, with its cruise, 0.5 s telegraph and dive; it cannot be stomped (the not-stompable marking is built), and the claw and fireballs defeat it (user decisions, 2026-10-22: landing on it is a hit, a fireball defeats it); its size, speed, path, trigger and dive are written out as proposals.
- **0.4.27** (2026-10-22) GDD-ENM-02, GDD-ENM-01, GDD-CMB-01, GDD-CMB-03, GDD-CMB-02, GDD-PWR-03: the first enemy, the Alacrán, is built, with the stomp, enemy hits, and defeat by claw and fireball; its size and speed, what counts as a stomp, how an enemy hit pushes Poncho and how enemies reset are written out as proposals.
- **0.4.26** (2026-10-21) GDD-PWR-03, GDD-PWR-01, GDD-PWR-05, GDD-CTL-03: the chile, the Fuego state and its fireball are built (a piñata releases a chile when Poncho is not in Base); what a chile does in Base, the fireball's fall and bounce, and the Fuego touch button are written out as proposals.
- **0.4.25** (2026-10-21) GDD-CMB-02, GDD-WLD-05, GDD-PWR-05, GDD-CTL-03: the claw swipe is built as a standard mechanic (the user's call), with fragile walls and claw-opened piñatas; the swing timing, hit box, what interrupts it and the reset on respawn are written out as proposals, and a Claw touch button is added. GDD-CTL-04: a jump or claw press that is over before the next frame still counts for one step.
- **0.4.24** (2026-10-21) GDD-WLD-05, GDD-UI-01: doors and keys are built (and a key icon per key carried joins the HUD); how a key is picked up, what opens a door, and the reset on respawn are written out as proposals.
- **0.4.23** (2026-10-21) GDD-PWR-05, GDD-PWR-02, GDD-PWR-06: piñata blocks are built for the head bump, releasing a walking taco in Base; the open and closed rules, the walking taco and the respawn reset are written out as proposals; one open question added about floor tacos against released ones.
- **0.4.22** (2026-10-21) GDD-PWR-01, GDD-PWR-02, GDD-CMB-03: the Taco state is built (pickup, spike hit spends the taco, knockback now 80 px/s, user-approved number); the edge cases (including the ofrenda and the HUD icon) are written out as proposals.
- **0.4.21** (2026-10-21) GDD-WLD-05: a moving platform never carries Poncho into a solid tile, and platforms stand still during the respawn wait.
- **0.4.20** (2026-10-21) GDD-WLD-05: moving platforms are built as one-way floors on a back-and-forth path; the speed, the one-way rule and the reset on respawn are written out as proposals.
- **0.4.19** (2026-10-21) GDD-WLD-05: a spring gives a higher launch for a jump pressed just before landing (the user's rule: a timed press only); the sandbox gets a ledge only that launch reaches.
- **0.4.18** (2026-10-21) GDD-WLD-05: springs are built; how they trigger and what a held or released jump does are written out as proposals.
- **0.4.17** (2026-10-21) GDD-WLD-05: crumbling platforms are built; how they trigger, how long they last and when they come back are written out as proposals.
- **0.4.16** (2026-10-21) GDD-WLD-05: two spike edge cases are written out (invulnerability ending on a spike, a spike hit and an ofrenda in the same step). No behaviour changed.
- **0.4.15** (2026-10-21) GDD-WLD-05, GDD-MOV-06, GDD-LIFE-02, GDD-CMB-03: spikes are built; where the hurtbox sits in the body and which part of a spike tile hurts are written out as proposals.
- **0.4.14** (2026-10-21) GDD-CTL-03: the slide stick is built, with a mode switch to choose it over the buttons; its dead zone, zone and saved choice are written out as proposals.
- **0.4.13** (2026-10-21) No rule changed: the harness skills are renamed with a `harness-` prefix, so the process and playtest references point at the new names.
- **0.4.12** (2026-10-21) GDD-MOV-03: corner correction is built and its rule is written out (which side, how far, only while rising).
- **0.4.11** (2026-10-20) GDD-LIFE-02 and GDD-MOV-05: the respawn flip is built. Poncho is hidden for the first 0.45 s of the wait, then drops in and turns once and lands feet-first as control returns (this changes "hidden while waiting" in GDD-LIFE-02).
- **0.4.10** (2026-10-20) GDD-LIFE-02 and GDD-UI-01: the HUD crack animation for a lost life is built (the flip and feet-first landing are still to come).
- **0.4.9** (2026-10-20) GDD-LIFE-03 and GDD-LIFE-02: only the latest ofrenda counts, so walking back never moves the respawn point backwards (user's decision, 2026-10-20; Open Question 12 answered and removed).
- **0.4.8** (2026-10-20) GDD-CTL-03: first touch controls built (left, right and jump buttons, shown on touch devices only), with their sizes and what is still missing.
- **0.4.7** (2026-10-20) GDD-AUD-02 and GDD-AUD-01: the ofrenda sound is a marimba (user's choice, 2026-10-20), generated from code as a placeholder; first sound effect wired in, audio unlocks on the first gesture.
- **0.4.6** (2026-10-20) GDD-WLD-03 and GDD-WLD-05: the sandbox level gets three ofrendas, drawn as placeholders (outline when unused, filled with a flame when used). GDD-WLD-03 notes the sandbox deviation. Open Question 12 added for GDD-LIFE-03 (can the respawn point move back).
- **0.4.5** (2026-10-20) GDD-LIFE-02, GDD-LIFE-03 and GDD-WLD-05: ofrenda checkpoints as rules (size, touch, respawn point, what a restart resets). Logic only; drawing them and placing them in a level come next.
- **0.4.4** (2026-10-20) GDD-LIFE-02, GDD-LIFE-05 and GDD-WLD-05: when a fall into a pit counts, what is built so far (wait, skip, invulnerability timer, restart at zero lives), and what is left (crack animation, feet-first flip, checkpoints, the "Siete vidas gastadas" screen). Sandbox level gets a 3-tile pit.
- **0.4.3** (2026-10-20) GDD-MOV-06 and GDD-WLD-03: level edges and pit behaviour written down, and how gap width is measured (reconciles the 4.1 to 4.3 tile jump distance with the 5-tile gap). Level-limit tests extended.
- **0.4.2** (2026-10-19) GDD-WLD-03 and GDD-MOV-06: measured level limits from the tile-collision tests (a full jump mantles a wall 3 tiles high but not 4, and crosses a gap of 5 tiles but not 6). Collision built.
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
- Respawn is instant to restart: any input skips the 0.8 s delay after 0.3 s. Any input is any button held, jump, claw, Fuego, left or right (both directions at once too), or a push of the slide stick past its dead zone (GDD-CTL-03).
- A fall into a pit counts once the whole body is below the bottom row of the level (GDD-MOV-06). It costs one life even while invulnerable (GDD-CMB-03). For the first 0.45 s of the wait Poncho is hidden. A button held through the respawn does not make him jump. Because "any input" includes a held direction, a player who keeps running into a pit respawns after 0.3 s instead of 0.8 s.
- Respawn point: the latest ofrenda Poncho has reached (GDD-LIFE-03), or the level start if he touched none.
- **Respawn flip, built (placeholder body):** in the last 0.35 s of the wait (21 steps) Poncho appears 48 px above the respawn point, drops with gravity-like acceleration while turning once, and is on the ground, upright and feet down, on the last step, so control returns without a jump in position (`FLIP` in `src/config/tuning.ts`). He lands at the respawn point, the latest ofrenda reached. After the last life there is no flip during the wait; the *Siete vidas gastadas* screen comes up instead, and the flip plays after it, at the level start (GDD-LIFE-05). A skip (any input after 0.3 s) before the flip starts shows no flip, and a skip during it makes him appear at the respawn point at once. The placeholder body has a pale strip along the feet so the turn can be seen.
- **HUD crack, built:** the lost triangle keeps its outline, its red fill fades from full to nothing over 0.4 s (24 steps, `LIFE_LOSS` in `src/config/tuning.ts`) while a crack line appears across it quickly and fades with the fill. If several lives are lost at once, each of their triangles cracks. A triangle that is filled again (an ofrenda) stops cracking. The animation counts simulation steps, so it pauses with the game. 

### GDD-LIFE-03 Regaining lives

Status: Proposed (that only the latest ofrenda counts as the checkpoint is Decided, user, 2026-10-20)

- **Ofrenda checkpoint:** first activation of an ofrenda restores 1 life if fewer than 7. Each ofrenda restores only once.
- **Only the latest ofrenda counts (Decided, user, 2026-10-20):** an ofrenda becomes the respawn point only if it comes later in the level than the current one. Touching an earlier ofrenda never moves the respawn point back. One touched for the first time after a later one still restores its life, but is not the checkpoint. Ofrendas count in the order the level lists them, which is the order the player meets them.
- A restart after the last life (GDD-LIFE-05) puts every ofrenda back to unused and the respawn point at the level start.
- **Veladora pickup:** a candle hidden in a level restores 1 life. At most 1 per level.
- No other source. Lives stay scarce.

### GDD-LIFE-04 La Última Vida (last life)

Status: Proposed

When exactly 1 life remains: the music shifts to a tense variation, the last triangle pulses, and a *Última Vida* bonus applies: hilos give double score (GDD-PRG-03). Risk and reward, never an added penalty.

- **Pulse, built (details Proposed):** while exactly one life is left, its triangle on the HUD (the leftmost) grows to 1.4 times its size and back, about its centre, smoothly (a cosine), every 0.8 s (48 steps), and keeps pulsing as long as one life is left, through the respawn wait too. It counts simulation steps, so it pauses with the game, like the crack (GDD-LIFE-02). With no lives (the Siete vidas gastadas screen, GDD-LIFE-05) or two or more it does not pulse. `LAST_LIFE` in `src/config/tuning.ts`, `src/ui/lastLife.ts`. Not built yet: the tense music (GDD-AUD-01) and the double hilo score (GDD-PRG-03), which wait for music and hilos.

### GDD-LIFE-05 Out of lives

Status: Decided (lives are carried across a world, user, 2026-10-19). Details are Proposed.

- Lives are tracked per world: 7 at world start, carried through its 3 levels and boss.
- At 0 lives: *Siete vidas gastadas* screen, then restart from the first level of the world with 7 lives. Hilos collected stay (GDD-PRG-02).
- **Screen, built (details Proposed):** when the usual 0.8 s wait after the last life ends (or is skipped, GDD-LIFE-02), the screen comes up instead of a respawn, and Poncho stays hidden: there is no respawn flip in that wait. The level stays in view, dimmed, behind the title *Siete vidas gastadas* and seven empty triangles (the HUD's look for lost lives, larger, centred). Below the triangles: "Game over", and under it the prompt line "Press any button to Retry" (user, 2026-10-22). The screen stays up until a new press of any button: jump, claw, Fuego, left or right, on the keyboard or the touch buttons (which stay on top of it, usable); in slide-stick mode a push of the stick past its dead zone is a press of left or right (GDD-CTL-03). Presses in its first 1.0 s (60 steps) are ignored, and a button held since before it, or pressed in that second and still held, does not count: only a button that was up on the step before counts, so pressing a second button while holding one does. The prompt line appears when presses start to count (user decision, 2026-10-22: press to continue). A tap shorter than one frame counts for every one of those buttons, left and right included (they are latched like jump and claw, L-006). At the press the world restarts: all seven lives, every ofrenda unused, the respawn point at the level start (GDD-LIFE-03). Then the respawn flip plays (0.35 s, GDD-LIFE-02) and Poncho lands at the level start, invulnerable for 2.0 s, with everything else reset as after any lost life. This flip cannot be skipped, since the button that ended the screen is usually still held, and a held jump does not make him jump when control returns. Placeholder art: a dark veil over the level, the title and "Game over" in pale text, the prompt in grey, outline triangles with 2 px lines. `GAME_OVER` in `src/config/tuning.ts`, `src/sim/run.ts`. Only one level exists, so "the first level of the world" is the sandbox's start. Not built yet: a sound, a transition, a gamepad button (GDD-CTL-02).
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
- Corner correction (built, `FORGIVENESS.cornerPx` in `src/config/tuning.ts`): while rising, if his head clips a block corner with only one side of his body inside the block, and by 4 px or less, he is moved sideways by exactly that overlap, past the corner, and keeps his upward speed. A clip of more than 4 px, or a block over both sides of his body (a real ceiling), is a head bump as before. It never applies while falling.
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
- Respawn animation always ends with a feet-first landing (GDD-LIFE-02). Built as the flip described in GDD-LIFE-02.
- Air control is generous (GDD-MOV-01); on a turn mid-air the sprite flips instantly.

### GDD-MOV-06 Size, hitbox and tile

Status: Proposed. Based on the reference image (GDD-ART-02); validate against the real sprite sheet.

- Tile size: 16 px.
- Sprite frame: 32 x 32 px. Poncho is a chibi cat about 2.5 heads tall with a very wide sombrero (the brim is about 1.5 times the width of the body).
- Body hitbox (ground and walls): 12 px wide, 14 px tall, centred at the feet. Fits through a 1-tile-high gap (checked by a test).
- Hurtbox (enemies and hazards): 10 x 12 px, inside the body hitbox, so near-misses feel fair. It is centred in the body box: 1 px in from each side, 1 px above the feet and 1 px below the top (Proposed).
- Level edges: the left and right edges of a level are solid walls, so Poncho cannot walk out. The sky above is open, so he can jump above the top row. Below the bottom row is open space, a pit (GDD-WLD-05).
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

- **Built (details Proposed):** a landing counts as a stomp when Poncho is falling, his hurtbox (GDD-MOV-06) overlaps the enemy's box, and on the step before his feet were at most 4 px below the enemy's top. That makes a landing on top a stomp and walking into the side or from below a hit (GDD-CMB-03). A stomp is checked before the hit, so a stomp never hurts, and it works while Poncho is invulnerable. The bounce is 410 px/s if jump is held or was pressed within the buffer window (0.1 s, GDD-MOV-03), otherwise 260 px/s, and releasing jump cuts the rise short like any jump. Several enemies stomped in one step give one bounce. The Tlacuache's first stomp only makes it play dead (it bounces Poncho all the same); a stomp after it wakes defeats it (user decision, 2026-10-22; GDD-ENM-02). The Zopilote and the cactus buddy are not stompable (user decision, 2026-10-22): landing on one is a hit like touching it anywhere else, and no bounce. An enemy that cannot be stomped is marked by three pale thorns along its back (placeholder art; the cactus buddy has three pale thorns on top, the same mark). `STOMP` in `src/config/tuning.ts`, `src/sim/enemy.ts`.

### GDD-CMB-02 Claw swipe

Status: Proposed

A short-range melee on the action button, a standard mechanic that Poncho always has (decided by the user, 2026-10-21; it is not a power-up): 0.25 s cooldown, hits a 20 x 14 px area in front of Poncho for 3 frames after a 2-frame wind-up. Defeats light enemies, stuns heavy ones for 1 s, breaks fragile blocks (papel picado walls). Cannot be used while taking a hit.

- **Built (details Proposed):** a press of the claw button (X or J, or the touch Claw button, GDD-CTL-01, GDD-CTL-03) starts a swing; holding it swings once, and a press during a swing or its cooldown is ignored. The timeline is a 2-step wind-up (the press step is the first), then 3 steps of swing in which the hit box is live, then idle. The 0.25 s cooldown (15 steps) runs from the press that started the swing, so the swings of a player who taps as fast as possible are 15 steps apart. The box is 20 px long and 14 px tall, level with the body, from the body's front edge outwards, facing the way Poncho faced at the press. Boxes that only share an edge with a tile do not touch it (GDD-PWR-06). A hit that leaves Poncho alive (a spike or an enemy in Taco or Fuego, GDD-CMB-03) ends the swing in progress but not its cooldown; there is no stun yet, so that is all "cannot be used while taking a hit" means for now. Losing a life ends any swing. The wind-up shows a small pale mark in front of Poncho and the swing three slanted pale slashes across the box (placeholder art). It opens piñatas (GDD-PWR-05) and breaks fragile walls (GDD-WLD-05). It defeats the Alacrán, the Zopilote or the Tlacuache its box overlaps (also a Tlacuache playing dead), and passes through a cactus buddy, which nothing defeats (GDD-ENM-02). Not built yet: stunning heavy enemies, the claw sound, the swing pose. `CLAW` in `src/config/tuning.ts`, `src/sim/claw.ts`.

### GDD-CMB-03 Damage and invulnerability

Status: Proposed

- A hit is resolved by the power-up state (GDD-PWR-01): in Base it costs exactly 1 life (GDD-LIFE-02); in Taco or Fuego it only downgrades the state and costs no life. There is no separate health bar.
- After a hit Poncho is invulnerable for 2.0 s and knocked back 80 px/s away from the source (user, 2026-10-21; built for spike hits and the hits of the Alacrán, Zopilote, cactus buddy and Tlacuache, `HIT` in `src/config/tuning.ts`). The push is a starting speed: the run controls take over at once, so it is a nudge off the hazard, not a launch. When Poncho is dead centre on the source, the push goes against the way he faces.
- Invulnerability does not protect from pits or crushing.
- **Enemy hits (built, details Proposed):** touching a live enemy is a hit like a spike: the push goes away from the enemy's middle, and the hit also ends a claw swing in progress. A hit is never taken while Poncho is invulnerable (a stomp, a claw swipe and a fireball still defeat the enemy). The one contact that is no hit is rising into a cactus buddy from beneath (GDD-ENM-02). If a spike and an enemy touch him in the same step it is one hit, from the spike.

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
- **Built (details Proposed):** Base, Taco and Fuego (GDD-PWR-03). A taco pickup is a 12 x 12 px square in the middle of its tile (`TACO` in `src/config/tuning.ts`), picked up when the body box overlaps it. While in Taco, a taco pickup is left where it is. A pickup and a spike hit in the same step: the pickup is resolved first, so the taco is spent on that hit. Losing a life puts Poncho back in Base and every taco pickup comes back, so a level is never left without its taco. A spike hit in Taco gives 2.0 s of invulnerability like a respawn. Unlike a lethal hit, a Taco hit does not stop an ofrenda touched in the same step from activating, since Poncho is still alive. Poncho is in Base from the moment a life is lost, so the HUD icon goes during the wait. Poncho holds a small taco on the side he faces and the HUD shows a taco icon right of the triangles; in Fuego both also show a glowing chile beside the taco. All of it is placeholder art. A hit in Fuego goes back to Taco, with the same 2.0 s of invulnerability and push, no life lost. A taco released from a piñata or lying in the level does not improve Fuego: it is left (a floor taco) or used up (a released one, see Open Question 12). `src/sim/taco.ts`, `src/sim/run.ts`.
- Lives are never granted by taco or chile. Only veladoras and ofrendas restore lives (GDD-LIFE-03).

### GDD-PWR-02 Taco (the mushroom)

Status: Proposed

Base to Taco. A taco walks away from a broken piñata at 40 px/s, turns at walls and falls off ledges, like a Mario mushroom. Collecting it plays a chomp, a 0.3 s freeze-frame and a sparkle. Poncho keeps the taco in hand until hit.

- **Built (details Proposed):** a taco released from a piñata (GDD-PWR-05) stands on top of it and walks right at 40 px/s (`TACO.walkSpeed`), turns round at walls, falls off ledges and is gone once it falls below the level. It is a 12 x 12 px square, collected by touch (GDD-PWR-06). Collecting one in Base gives Taco. In Taco it would not improve the state, which gives hilos (GDD-PWR-01); those are not built, so it is just used up. This differs from the floor taco, which waits where it is: a released one walks away and cannot wait (Open Question 12). `src/sim/item.ts`.

### GDD-PWR-03 Chile and Fuego (the fire flower)

Status: Proposed

- Taco to Fuego by eating a chile (a stationary glowing pepper released from a piñata when Poncho is already in Taco or Fuego).
- In Fuego the Fuego button spits a salsa fireball: 180 px/s horizontal, bounces along the ground with a 20 px arc, vanishes on walls or after 3 s, maximum 2 on screen.
- Fireballs defeat most light enemies, melt ice and light unlit candles. Bosses take 1 damage per fireball unless a boss rule says otherwise (GDD-BOS-01).
- The Fuego button is separate from Claw (GDD-CMB-02). On touch it appears only while in Fuego (GDD-CTL-03).

- **Built (details Proposed):** the chile is a stationary pepper that stands on top of its piñata (GDD-PWR-05) and is eaten by touch (GDD-PWR-06): Taco becomes Fuego, Fuego stays Fuego and the pepper is used up (it would give hilos, GDD-PWR-01, not built yet), and Base becomes Taco (one step better, like a Mario flower picked up when small; the GDD did not say). A press of the Fuego button (C or K on the keyboard, the touch Fuego button, GDD-CTL-01, GDD-CTL-03) in Fuego spits one fireball on that press step; holding the button spits once. In Base or Taco it does nothing. At most 2 fireballs exist at once: a press while two are in flight is ignored. With a wall right against Poncho's front there is no room for it (GDD-PWR-06): the press does nothing.
- The fireball is a 6 x 6 px square. It starts at Poncho's front edge, level with the middle of his body, heading the way he faces at 180 px/s, and is not falling yet. It falls at 1500 px/s squared and bounces off the ground at the speed that climbs 20 px (about 245 px/s), so it bounces along the ground in a 20 px arc. It vanishes on a wall, under a ceiling, below the bottom of the level and after 3 s (180 steps). It is not stopped by spikes, ofrendas, keys or pickups. A fireball in flight keeps going when Poncho is hit or leaves Fuego; a lost life clears them. Of the things a fireball can hurt, only the Alacrán, the Zopilote and the Tlacuache exist so far (below). `FIREBALL` in `src/config/tuning.ts`, `src/sim/fireball.ts`.
- A fireball defeats the Alacrán, the Zopilote or the awake Tlacuache it overlaps (GDD-ENM-02) and is used up by it; it passes over a Tlacuache that is playing dead without being used up; a cactus buddy it overlaps is not defeated, but the fireball is used up all the same (GDD-ENM-02). Not built yet: the other things fireballs hit (ice, candles, bosses; GDD-BOS-01), the Fuego sound, the spit pose, a gamepad binding (east button, GDD-CTL-02).

### GDD-PWR-04 Chile Fantasma (the star)

Status: Proposed. Post-MVP (GDD-MVP-02).

A rare ghost pepper hidden in special piñatas. For 8 s: Poncho is invulnerable (golden glow, as in the reference illustration), runs at 180 px/s and defeats anything on contact. Does not protect from pits or crushing. Music switches to a spicy variation. The last 2 s flash as a warning.

### GDD-PWR-05 Piñata blocks (the question blocks)

Status: Proposed

Hanging piñatas that open when Poncho hits them from below (head bump) or with a claw swipe, releasing an item or hilos. A piñata releases a Taco if Poncho is Base, otherwise a Chile; a multi-piñata gives up to 10 hilos over 4 s. An opened piñata becomes a broken shell. Piñatas are drawn so players recognise them at a glance and never hide a lethal surprise.

- **Built (details Proposed):** the head bump, in Base and Taco. A piñata is a solid tile, closed or open. A bump is a step that ends with the body's head flush against its underside after Poncho was rising, so standing or walking under it, and a corner clip that slides him past the edge (GDD-MOV-03), do not open it. The body box must overlap the tile's column; with two neighbouring piñatas, the one whose middle is nearer his own wins. A piñata opens once.
- In Base it releases a taco standing on top of it (GDD-PWR-02). If there is no room above it (a wall or block in the way) it stays closed and releases nothing, so an item never spawns inside a wall (GDD-PWR-06). In Taco or Fuego it releases a chile instead (GDD-PWR-03), by the same room rule. The kind is decided by Poncho's state at the moment of the hit.
- Losing a life closes every piñata again and clears every released item, along with Poncho returning to Base (GDD-PWR-01).
- A claw swipe opens a piñata that its box overlaps, by the same rules as a head bump (GDD-CMB-02), for instance from the top of a wall next to it. The sandbox piñata can be reached that way from the 2-tile wall at columns 10 and 11.
- Not built yet: the multi-piñata with hilos, the empty piñata art that is not a shell, and sounds. The sandbox has two piñatas: one 32 px above the floor at column 9, and one at column 23, row 8, 32 px above the top of the 3-tile wall, which Poncho reaches by standing on the wall (a chile comes out when he is in Taco). `src/sim/pinata.ts`, `src/sim/run.ts`.

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
- **Built so far:** left and right buttons bottom-left and a larger jump button bottom-right, drawn as a framed triangle (the poncho motif) semi-transparent, brighter and orange while pressed (the exact opacity becomes a setting with GDD-UI-03). Buttons are 40 px (jump 56 px) with 6 px from the screen edge and a 4 px gap between left and right, and they grow on a small screen so none is under 48 CSS px (`TOUCH` in `src/config/tuning.ts`). They show only on devices that report touch and work together with the keyboard. Left and right pressed together cancel out. Moving and jumping at once works with two fingers.
- **Slide stick (built, details Proposed):** a small switch above the left thumb zone swaps the left and right buttons for one track as wide as both, and back. The choice is remembered on the device (browser storage, where allowed). A finger anywhere in the lower left quarter of the screen steers, by how far it is left or right of the track's centre: nothing inside a dead zone of 0.2 of the half-track, then speed grows evenly to full at the track's edge and stays full beyond it (analog speed, GDD-MOV-01). Jump stays on the right and works together with the stick. The switch is as large as the other buttons (48 CSS px minimum).
- **Claw button (built):** a button the size of the left and right buttons sits left of Jump on the same floor line, a gap of 4 px from it, drawn with three slanted claw marks; it works together with moving and jumping (GDD-CMB-02).
- **Fuego button (built):** the same size as the claw button, directly above it with a gap of 4 px, drawn as an orange flame. It exists only while Poncho is in Fuego: it appears when he becomes Fuego and goes when he is hit or loses a life (GDD-PWR-03). A press spits a fireball, and, like jump and the claw, a tap shorter than a frame still counts (GDD-CTL-04).
- **Still missing:** mirrored layout and opacity setting, safe-area insets (the canvas is letterboxed, which keeps the buttons clear of notches on wide phones), vibration, pause.

### GDD-CTL-04 Input latency budget

Status: Proposed

Input is sampled once per fixed step (GDD-TEC-02). A press of jump, claw, Fuego, left or right, on the keyboard or on a touch button, that starts and ends inside one frame is latched from the raw event and counts for the next step (`src/ui/inputLatch.ts`, L-006), so a quick tap or a hitch never loses it; a tap that short makes the shortest jump, moves Poncho for one step, or skips the respawn wait. Left and right also reach the simulation raw, before they cancel out into one move, so the *Siete vidas gastadas* screen sees a press of either (GDD-LIFE-05). Jump press to first upward movement happens on the same step. Total input to screen budget: under 100 ms on a mid-range phone (GDD-TEC-03).

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
- 3 ofrenda checkpoints at roughly 25%, 55% and 85% of the level, and an exit. (The sandbox test level puts the middle one at about 65% because 55% is in its pit; see GDD-WLD-05.)
- 1 hidden secret per level (a room or a veladora).
- Teaching order: new mechanic is introduced in a safe spot, then combined with a threat, then used in a test.
- Gaps never exceed 3 tiles in World 1 (jump distance is about 4.1 to 4.3 tiles at full run, GDD-MOV-01 to GDD-MOV-04).
- Measured with the real body box against tiles (`src/sim/collision.test.ts`): a full jump can climb onto a wall 3 tiles high but not 4, and a running jump can cross a gap of 5 tiles but not 6. Gaps are measured edge to edge. The body only has to overlap the far edge, so a 5-tile gap (80 px) costs about 4.25 tiles (68 px) of travel from centre to centre, which is why it fits the 4.1 to 4.3 tile jump distance above. Walls taller than 3 tiles block the path; gaps wider than 5 tiles are impassable without a power. Design to the World 1 limit of 3 so there is room for mistakes.

### GDD-WLD-04 Collectibles

Status: Proposed

- **Hilos (threads):** colourful threads scattered through levels; 50 per level. They unlock cosmetics for the poncho (GDD-PRG-01) and feed the score (GDD-PRG-03).
- **Veladora:** one per level at most, restores a life (GDD-LIFE-03).
- Collectibles guide the player's eye along the intended path and reward risk.

### GDD-WLD-05 Hazards and interactables

Status: Proposed

Core set: spikes (cactus, obsidian), pits, crumbling platforms (0.5 s warning), springs (bounce 480 px/s), moving platforms, fragile walls (claw-breakable), ofrendas (checkpoints), doors and keys. Each world adds one signature hazard (GDD-WLD-02).

- **Spikes (built, details Proposed):** a spike stands in one tile and hurts through the lower half of it (16 px wide, 8 px tall), so a jump that clears the points by a hair is safe. Touching it with the hurtbox (GDD-MOV-06) from any side costs one life, like a pit: the wait, the flip and 2.0 s of invulnerability follow (GDD-LIFE-02). Unlike a pit, a spike does not hurt while Poncho is invulnerable (GDD-CMB-03). Invulnerability only skips the hit, it does not move Poncho: if he is still on a spike when the 2.0 s end, he loses a life on the next step. If a spike hit and an ofrenda touch happen in the same step, the hit wins and the ofrenda is not activated. In Taco a spike hit spends the taco instead (GDD-PWR-01, GDD-CMB-03). The sandbox level has two spikes between the second ofrenda and the 3-tile wall. Cactus and obsidian art, and the "not stompable" marking for spike enemies (GDD-CMB-01), come later. `SPIKE` in `src/config/tuning.ts`, `src/sim/hazards.ts`.
- **Crumbling tiles (built, details Proposed):** one-tile ledges that are solid like a floor. A tile starts to crumble when Poncho lands on it: his body box over its column and his feet on its top. A jump up from below, or walking into its side, does nothing. The warning lasts 0.5 s (30 steps) from the step he lands, shown by the tile shaking sideways and flashing pale in turn (movement and colour, GDD-UI-03). Then it is gone: Poncho falls, with the usual 0.1 s of coyote time to still jump (GDD-MOV-03). The countdown cannot be stopped: if he walks off, the tile still goes. Each tile has its own timer, so standing on the join of two starts both. A gone tile stays gone until Poncho loses a life, and then every tile is whole again when he respawns (GDD-LIFE-02). The sandbox level has three at tile columns 24 to 26, a jump up from the 3-tile wall. Sand-coloured placeholder art with a crack. `CRUMBLE` in `src/config/tuning.ts`, `src/sim/crumble.ts`.
- **Springs (built, details Proposed):** a one-tile block, solid like a floor and set flush into it. Standing on its top, by landing on it or by walking onto it, throws Poncho up the same step. The plain launch is 480 px/s, about 77 px up, clearly above a jump (410 px/s, 56 px). A **timed press** gives a higher one: if Poncho pressed jump in the 0.1 s (6 steps) before he lands, counting the landing step itself, the launch is 600 px/s, about 120 px (the user's rule, 2026-10-21: a timed press only, holding jump does not count; the 600 is a proposal). Walking onto the spring, or holding jump from earlier, gives the plain launch. Either launch is fixed once it starts: releasing jump does not cut it short, and a jump pressed in the next steps does not replace it with the weaker 410 px/s jump. Touching the spring from the side or below does nothing. Red-and-cream placeholder art with a coil. The sandbox level has one in the floor between the 2-tile wall and the pit, clear of the touch buttons, and a ledge 96 px above the floor that only the timed launch reaches. `SPRING` in `src/config/tuning.ts`, `src/sim/spring.ts`.
- **Moving platforms (built, details Proposed):** a slab 8 px thick and any whole number of tiles wide that travels in a straight line between two ends and back, at 40 px/s, turning round at each end without stopping. Where it is depends only on how many steps have passed, so it is identical on every run. It is a **one-way floor**: Poncho lands on its top when he comes down onto it, and while he stands on it he is carried with it (sideways and up and down). He passes through it from below, so he can jump up through it and land on top, and its sides and underside never block him, so it cannot crush him (crushing, GDD-LIFE-02, comes with moving solid blocks). If it would carry him into a wall or a ceiling he stays against that tile and the platform slides on under his feet: it never pushes him through a tile. Jumping from it works at once; walking off an end drops him. Platforms stand still during the 0.8 s respawn wait and start from their first end again when Poncho respawns (GDD-LIFE-02). The sandbox level has one, 3 tiles wide at the height of the spring ledge, starting against the ledge's right edge and travelling 96 px right, towards the crumbling tiles; from its right end a jump reaches the Tlacuache's ledge in the top right corner, 32 px higher (GDD-ENM-02). Teal placeholder art. `PLATFORM` in `src/config/tuning.ts`, `src/sim/platform.ts`.
- **Doors and keys (built, details Proposed):** a door is one tile wide and any whole number of tiles tall, solid like a wall, and is opened as one piece by a single key. A key is a 12 x 12 px pickup in the middle of its tile, picked up by touch with the body box (GDD-PWR-06) and carried; all keys are alike. A shut door that Poncho touches at its side while he carries a key opens for good that step and uses up one key: he touches it when his body box, widened by 1 px on each side, overlaps its column and overlaps it in height, so walking into it counts and standing on top of it or bumping it from below does not. One key opens one door, even if he touches two at once. A key picked up the same step a door is touched opens that door. An open door is gone and does not close again. Losing a life drops every carried key, puts every key back on the floor and shuts every door, like taco pickups and piñatas (GDD-PWR-01, GDD-PWR-05). The HUD shows one small key per key carried, right of the power-up icon. The sandbox has one door three tiles tall at column 8, closed off above by the platform, and one key at column 5 on the way to it. Walking tacos treat a shut door as a wall (GDD-PWR-02). Colours or pairs of keys, doors that need a switch, and sounds come later. `KEY` in `src/config/tuning.ts`, `src/sim/door.ts`.
- **Fragile walls (built, details Proposed):** papel picado tiles, solid like a wall until a claw swipe (GDD-CMB-02) overlaps them, which breaks every tile its box overlaps, for good. A wall taller than the 14 px claw box is broken a tile at a time from the height Poncho swings at, so one swipe from the floor opens a gap one tile high, which he can walk through. Losing a life puts every broken tile back (GDD-LIFE-02). Walking tacos treat an unbroken tile as a wall. Drawn as a pink paper tile with a cut-out diamond and a pale scalloped top edge (placeholder art). The sandbox has a wall four tiles tall, so a jump cannot clear it, at column 27 in the pocket at the right end. Not built yet: other ways to break them (fireballs, GDD-PWR-03), a break animation and sound. `src/sim/fragile.ts`.
- **Ofrenda:** one tile wide and two tiles tall (16 x 32 px), standing on the floor. It is activated when Poncho's body box (GDD-MOV-06) overlaps it; boxes that only share an edge do not touch. It does not need a button press and works in the air, so a jump through it counts.
- Placeholder look until real art (GDD-ART-01): an outlined frame when unused, filled with a flame on top once used, so the two differ by shape and not only by colour (GDD-UI-03). The sandbox level has three, at about 25%, 65% and 85% of its width; the 55% spot of GDD-WLD-03 is in its pit.

---

## 9. Enemies and bosses

### GDD-ENM-01 Enemy design rules

Status: Proposed

- One idea per enemy, readable at a glance, with a 0.5 s telegraph before any attack. (Built for the Zopilote's dive and the Tlacuache's charge.)
- Every enemy can be beaten at least one way: stomp, claw or avoidance.
- Enemies never spawn on screen within 3 tiles of Poncho's respawn. (Checked for every enemy in the sandbox by `src/levels/sandbox.test.ts`; the level validator, GDD-TEC-04, will check authored levels.)
- Enemy contact is resolved by GDD-CMB-03 and never costs more than 1 life. (Built for the Alacrán: it is a hit like a spike, one life in Base.) Avoidance is a built way to beat an enemy: the cactus buddy cannot be defeated at all (GDD-ENM-02).

### GDD-ENM-02 World 1 bestiary

Status: Proposed

| Enemy | Behaviour | Defeated by |
| --- | --- | --- |
| Alacrán (scorpion) | Patrols a platform, turns at edges | Stomp or claw (also a fireball, GDD-PWR-03) |
| Zopilote (vulture) | Flies a sine path, swoops after a 0.5 s telegraph | Claw (also a fireball, GDD-PWR-03; not stompable) |
| Cactus buddy | Static, spiky, harmless from below | Avoid only (not stompable; the claw passes through it and a fireball is used up by it) |
| Tlacuache (opossum) | Fast charger, plays dead after hit | Claw (even while it plays dead), stomp after wake (also a fireball while awake, GDD-PWR-03) |

- **Alacrán (built, details Proposed):** a 14 x 10 px scorpion standing on the ground that walks at 30 px/s (`ENEMY` in `src/config/tuning.ts`). It starts at the place the level gives it, heading right. It turns round when its box meets a wall, flush against it, and when the ground under its leading edge ends, so it never walks off a ledge and never falls. A stomp (GDD-CMB-01), a claw swipe whose box overlaps it (GDD-CMB-02) or a fireball that overlaps it (GDD-PWR-03) defeats it; it is then gone. Every fireball that overlaps a live enemy in a step is used up, whatever defeats the enemy that step. Touching it any other way is a hit (GDD-CMB-03). It uses Poncho's hurtbox against its own box, like spikes: boxes that only share an edge do not touch. A defeated one stays defeated until a life is lost, when every enemy is alive again and back at its start, heading right (GDD-LIFE-02). It is a placeholder drawing of a dark red scorpion with pale claws and tail. The sandbox has one, on the platform at row 10, columns 4 to 8, which Poncho reaches from the top of the 2-tile wall; the platform is 64 px above the first ofrenda, clear of its respawn (GDD-ENM-01). Not built yet: sounds, a defeat animation. `src/sim/enemy.ts`.
- **Zopilote (built, details Proposed):** a 16 x 10 px vulture that flies (`ZOPILOTE` in `src/config/tuning.ts`). The level gives the middle of its start and its cruise line, and it ignores tiles. Cruising, it flies at 40 px/s up to 48 px either side of its start, turning round there (it starts heading right), while bobbing up and down 12 px on a sine with a period of 2.5 s (150 steps). When Poncho's hurtbox is within 96 px to either side of it and between 0 and 80 px below it, it spots him: it freezes and flashes for exactly 0.5 s (30 steps, the telegraph of GDD-ENM-01; the body flashes red and the wings are raised). It then dives in a straight line at 150 px/s to the spot Poncho's hurtbox centre was at when the telegraph ended (it aims once and does not follow him on), and from there climbs straight back up to its cruise line at 60 px/s, then cruises again from where it is, and may spot him again at once. It cannot be stomped (GDD-CMB-01): landing on it is a hit (GDD-CMB-03), and so is touching it any other way. A claw swipe (GDD-CMB-02) or a fireball (GDD-PWR-03, which is used up) defeats it. It is defeated for good until a life is lost, when it is alive again on its cruise line at its start, heading right (GDD-LIFE-02). It is a placeholder drawing of a dark brown vulture with a pink head, flapping wings and three pale thorns on its back. The sandbox has one, cruising at y = 64 from x = 216 (168 to 264), above the middle of the level: from the floor Poncho's hurtbox centre is 153 px below its cruise line and it never spots him; on the Alacrán's platform he is 89 px below it, so it spots him there only while it is at the low end of its bob (a Poncho who lingers there is dived on); and the spring ledge and the moving platform, 57 px below it, are well within reach. The Tlacuache's ledge, from x = 400, is out of its sideways reach, so it never spots Poncho there. It is far from every respawn (GDD-ENM-01). Not built yet: sounds, a defeat animation, a swoop that leaves the screen. `src/sim/enemy.ts`.
- **Cactus buddy (built, details Proposed):** a static 12 x 16 px cactus standing on the ground at the place the level gives it (`CACTUS` in `src/config/tuning.ts`). It never moves, and it is "avoid only" (user decision, 2026-10-22): a stomp does not defeat it (it cannot be stomped, GDD-CMB-01, and landing on it is a hit), a claw swipe passes through it, and a fireball that overlaps it is used up without harming it, so it can cover Poncho from fireballs. Touching it is a hit (GDD-CMB-03), except that it is harmless from below: a contact is no hit while Poncho is moving up and his hurtbox top was at or below its underside on the step before, once his head is above that line he is inside it and the usual hit applies. That can only happen for a cactus with no solid tile directly beneath it: a cactus standing on the ground or a ledge has the top of that tile as its underside, which Poncho's head cannot get below while he overlaps it (tile collision, GDD-MOV-06). So no cactus buddy that stands on something can be passed from below, and no level has one with nothing beneath it yet; the rule is only covered by unit tests on a cactus in mid-air. It uses Poncho's hurtbox against its own box, like the other enemies. It is a placeholder drawing of a green cactus with two arms and three pale thorns on top. It is alive again, simply where it was, after a lost life (GDD-LIFE-02). The sandbox has one on the right half of the top of the 2-tile wall (columns 10 and 11, top y = 192), at x = 184, leaving the left 18 px of the wall top free to stand on and to jump from to the Alacrán's platform; it is more than 3 tiles from every respawn (GDD-ENM-01; checked by `src/levels/sandbox.test.ts`). No spot in the sandbox shows the from-below case (see above), so that is covered by unit tests. Not built yet: sounds. `src/sim/enemy.ts`.
- **Tlacuache (built, details Proposed):** a 16 x 10 px opossum standing on the ground (`TLACUACHE` in `src/config/tuning.ts`). It starts at the place the level gives it, heading right, and walks at 24 px/s, turning at walls (flush against them) and at ledge ends like the Alacrán. It spots Poncho when his feet are within 16 px of its own, up or down, and his hurtbox centre is in front of it (the way it faces) by more than 0 and up to 80 px (user decision, 2026-10-22: sight, then dash). It then freezes and flashes red for exactly 0.5 s (30 steps, the telegraph of GDD-ENM-01) and charges at 150 px/s the way it faces, without turning to follow him, until a wall or the end of its ground stops it (as in its walk, it never runs off a ledge); there it turns round and walks again, and may spot him again at once. Touching it is a hit (GDD-CMB-03), while it walks, telegraphs or charges. Its first stomp (GDD-CMB-01) does not defeat it: Poncho bounces as from any stomp and it plays dead for 2.0 s (120 steps), lying still on its back (user decision, 2026-10-22: stomp twice). Playing dead it is out of play except for the claw: touching it is no hit, landing on it is no stomp and a fireball passes over it without being used up, but a claw swipe that overlaps it defeats it (user decision, 2026-10-22). Then it wakes facing the way it faced, walking, and touching it is a hit again (so a Poncho standing in it when it wakes is hit; its feet twitch in its last 0.5 s as a warning). After it has played dead once, a stomp defeats it. The claw (GDD-CMB-02) defeats it at any time, and a fireball (GDD-PWR-03) at any time it is awake, whether or not it has been stomped; either wins over a first stomp in the same step. It is a placeholder drawing of a grey opossum with a pale face, pink nose and ears and a long bare pink tail. A lost life brings it back at its start, walking, not yet stomped (GDD-LIFE-02). The sandbox has one in the middle of a ledge 5 tiles long in the top right corner (row 6, columns 25 to 29, x 400 to 480, top y = 96), which it walks end to end; Poncho reaches the ledge with a jump from the moving platform at its right end, 32 px lower. The ledge is out of the Zopilote's sideways reach and 128 px above the third ofrenda, far from every respawn (GDD-ENM-01; checked by `src/levels/sandbox.test.ts`). Not built yet: sounds, a defeat animation, a charge pose. `src/sim/enemy.ts`.

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

- Top-left: seven triangles (GDD-LIFE-01), filled = life, outline = lost. Lives fill from the left, so a lost life empties the rightmost filled triangle. Filled and outline differ by shape, not colour alone (GDD-UI-03). Next to them, a small icon of the current power-up state (GDD-PWR-01). After it, one small key per key carried (GDD-WLD-05).
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

Status: Proposed (the ofrenda sound being a marimba is Decided, user, 2026-10-20)

Short, punchy and readable: jump, land, claw, stomp, hilo pickup (rising pitch combo), life lost (unravelling thread sound), ofrenda activate (marimba), Poncho meows as personality. Each SFX is under 1 s and compressed for the web.

- **Ofrenda activate:** two rosewood marimba bars struck in quick succession, E5 then B5, 0.95 s. Generated from code (`scripts/audio/ofrenda.mjs`, encoded by `scripts/audio/make-sfx.mjs`) as a placeholder until real audio exists (Open Question 9). Shipped as Ogg and MP3. It plays when an ofrenda is used for the first time, not on a repeat touch and not when a restart resets the ofrendas.
- Sounds start playing only after the first key press or touch, because browsers keep audio locked until then (GDD-AUD-01).

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
- Playwright playtests per the `harness-playtest` skill: boot, jump, life loss, touch input, console free of errors.
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

Done means: the `harness-playtest` skill passes on desktop and a phone viewport, and the user has played it.

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
7. **Combat (GDD-CMB-02):** keep both claw swipe and stomp, with fireballs on top? Partly answered (user, 2026-10-21): the claw swipe is a standard mechanic that Poncho always has, not a power-up. Stomp and fireballs alongside it are still open.
8. **Difficulty (GDD-VIS-02):** is assist mode and a kid-friendly tone right, or do you want a harder game?
9. **Audio (GDD-AUD-01):** will you provide music, or should placeholders be generated and licensed assets chosen?
10. **Score and medals (GDD-PRG-03):** keep or cut?
11. **Distribution:** where will it be hosted (itch.io, own site, stores)? This drives PWA versus native packaging.
12. **Taco pickups in Taco (GDD-PWR-02, GDD-PWR-06):** a taco lying on the floor is left where it is when Poncho is already Taco, but a walking taco released from a piñata is used up when he touches it. Should both behave the same?
