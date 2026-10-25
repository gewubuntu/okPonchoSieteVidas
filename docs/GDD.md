# PONCHO: Siete Vidas — Game Design Document

Version: 0.4.46

This document is the anchor for every feature. Rules:

- Each rule is a section `### GDD-XXX-NN` with a `Status:` line.
- **Decided** = the user said so. **Proposed** = a recommendation that is not binding until the user confirms it. **Deprecated** = removed, kept so IDs are never reused.
- Proposals are listed in [Open Questions](#open-questions) so they can be confirmed or changed.
- Numbers use *virtual pixels* at the base resolution defined in GDD-ART-01, unless stated otherwise.
- Process for editing: `.claude/skills/harness-gdd-update/SKILL.md`.

## Changelog

- **0.4.46** (2026-10-25) GDD-UI-02, GDD-CTL-01, GDD-CTL-03, GDD-AUD-01, GDD-PRG-02, GDD-UI-03, GDD-MVP-02: a settings screen with Master and Effects volume (0 to 10, default 10), reached from a new "Settings" item in the pause menu (now Resume, Settings, Quit to title) and from a two-row title menu ("Start", "Settings") that replaces the title prompt; Space or Z picks there and Up or W chooses, so the jump keys no longer start the level by themselves, while claw, Fuego, Left, Right and a tap off the rows still do; the hidden touch buttons press nothing on the title screen. Sound effects play at Master times Effects. The settings are saved in the browser, the first slice of the save system. A language switch with English, Spanish and German comes next (user, 2026-10-25).
- **0.4.45** (2026-10-25) GDD-UI-02, GDD-CTL-03: a Left or Right key or touch button pressed while paused and held through the resume no longer runs until it is released and pressed again, as the rule already said, and a quick tap of either while paused moves nothing; the same holds for the one that starts the level from the title screen. A finger that went down while paused presses no touch button, not only no slide stick (a gap found in the review of 0.4.44).
- **0.4.44** (2026-10-23) GDD-UI-02, GDD-CTL-01, GDD-CTL-03, GDD-WLD-04: the pause screen becomes a two-item menu, "Resume" and "Quit to title": Up or W and Down or S choose, Enter, Space or Z picks, and a tap or click on an item picks it; Escape, P, the pause button and a tap anywhere else still resume. In slide-stick mode a finger that went down while paused, or was down when the level starts from the title screen, does not steer until lifted (found in review). Quitting brings back the title screen over a fresh run: seven lives, every hilo back, everything at its start (user decisions, 2026-10-23: a two-item menu; no confirmation; a fresh run). The menu's size, look and keys are written out as proposals.
- **0.4.43** (2026-10-23) GDD-UI-02, GDD-CTL-01, GDD-CTL-03: on the title screen a finger on the hidden mode switch no longer changes the touch mode, and a tap and a turn upright in the same frame no longer start the level upright; the Start row of the key table names the keys exactly (found in review).
- **0.4.42** (2026-10-23) GDD-UI-02, GDD-CTL-01, GDD-CTL-03: the title screen is built: the game opens on it, with the level standing still under a dark veil, "PONCHO" and "Siete Vidas", the placeholder Poncho at twice his size and a prompt; Enter, a tap or click anywhere, or a new press of any game button starts the level, and the button that started it counts as already held. An upright phone is asked to turn sideways first, so the level never starts upright (user decisions, 2026-10-23: the level behind a veil plus the placeholder Poncho; any button or a tap starts; "Press any button to start" or "Tap to start"; the pause screen stays resume-only for now).
- **0.4.41** (2026-10-23) GDD-AUD-02, GDD-LIFE-02, GDD-CMB-02, GDD-WLD-04: when the jump, land, claw, stomp, hilo, life lost and meow sounds play, as generated placeholders like the marimba. The hilo pluck climbs a major scale while hilos come within 0.75 s of each other. Poncho meows when he appears again after a lost life (user decisions, 2026-10-23: meow on respawn; all seven sounds in one change).
- **0.4.40** (2026-10-23) GDD-TEC-04, GDD-WLD-03, GDD-ENM-01, GDD-ENM-02, GDD-TEC-06: the level validator is built, ahead of the Tiled loader. A test runs it over every level in the game and checks 3 ofrendas, an exit, a length of 3 to 6 screens, no gap wider than the world's limit and no enemy starting within 3 tiles of a respawn. A gap is a run of columns whose bottom row is empty. The sandbox is a test level, which skips the exit and length checks (user decisions, 2026-10-23: validator only, Tiled later; the sandbox marked as a test level; a gap is a run of pit columns).
- **0.4.39** (2026-10-23) GDD-WLD-04, GDD-UI-01, GDD-LIFE-02, GDD-LIFE-04, GDD-LIFE-05, GDD-PWR-02, GDD-PWR-03: hilo pickups and the HUD hilo counter are built. A hilo is an 8 x 8 px skein in the middle of its tile, collected by touch with the body box, and once collected it stays collected through lost lives and the restart after the last life. The counter in the top right shows a skein and "collected/total" for the level. The sandbox has 20 (user decisions, 2026-10-23: pickups and counter first; about 20 in the sandbox, 50 stays the number for real levels; the counter reads collected/total; placeholder skeins in serape colours). Items that give hilos instead, the multi-piñata, the score and saving come later.
- **0.4.38** (2026-10-23) GDD-WLD-05: a moving block carrying Poncho down past a tile he hangs over leaves him standing on the tile, as a platform does (found in review).
- **0.4.37** (2026-10-23) GDD-WLD-05, GDD-LIFE-02, GDD-CMB-03: moving blocks and crushing are built. A moving block is solid on every side and travels like a moving platform at 40 px/s; a push or a carry into a solid tile crushes Poncho, which costs one life like a pit, in any power-up state and even while invulnerable. The sandbox has one in the pocket past the fragile wall (user decisions, 2026-10-23: a moving solid block is what crushes, a crush costs a life like a pit).
- **0.4.36** (2026-10-23) GDD-MOV-08, GDD-WLD-05, GDD-PRG-01, GDD-MVP-02: the wall cling and kick is built ahead of the MVP, behind the same ability flag as the glide (on in the sandbox, where the level's left and right edges are full-height walls): pressing toward a wall while falling slides at 60 px/s; jump beside a wall in the air kicks away at 130 px/s across and 380 px/s up, then sideways control is locked for 120 ms (user decisions, 2026-10-23: a kick whenever he touches a wall in the air, the cling wins over the glide, a 0.1 s grace after leaving the wall, claw marks as the placeholder look; and a spring launch wins over a wall kick, GDD-WLD-05).
- **0.4.35** (2026-10-22) GDD-MOV-07, GDD-PRG-01, GDD-MVP-02: the glide is built ahead of the MVP, behind an ability flag a level turns on (the sandbox does, until World 2 can unlock it): holding jump while falling caps the fall at 70 px/s, sideways movement unchanged, as long as jump is held; not within 150 ms of a stomp bounce; a placeholder spread poncho is drawn (user decisions, 2026-10-22: unlock flag on in the sandbox, jump held as he falls, a wide poncho bar). New proposal: a glide starts only once jump has been held longer than the 0.1 s jump buffer (GDD-MOV-03), so a press just before landing stays a buffered jump. The hold counts from a press the game saw, so a jump pressed while paused or held through a respawn does not glide (GDD-UI-02). GDD-UI-02, GDD-CTL-01: Escape and P now pause on every keyboard layout and every quick press counts once (they are read from the browser's own key events by the key's label).
- **0.4.34** (2026-10-22) GDD-UI-02, GDD-UI-01, GDD-CTL-01, GDD-CTL-03: the pause in a level is built: Escape or P, or a touch pause button in the top-right corner, pauses under a dimmed screen; the same key or button, or a tap anywhere, resumes; losing focus or a hidden tab pauses, and so does a phone turned upright, which first asks to be turned sideways; a press made while paused does nothing until pressed again (user decisions, 2026-10-22: resume only, button top-right, auto-pause on focus and portrait, resume with the pause key or a tap). The rest of the menus wait for a title screen.
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
- Enemies and moving hazards reset to their initial state, collected *hilos* since the checkpoint are kept (no loss of progress that is not a life). Built for hilos: a collected one stays collected and the count stays (GDD-WLD-04).
- Respawn is instant to restart: any input skips the 0.8 s delay after 0.3 s. Any input is any button held, jump, claw, Fuego, left or right (both directions at once too), or a push of the slide stick past its dead zone (GDD-CTL-03).
- A fall into a pit counts once the whole body is below the bottom row of the level (GDD-MOV-06). It costs one life even while invulnerable (GDD-CMB-03). For the first 0.45 s of the wait Poncho is hidden. A button held through the respawn does not make him jump. Because "any input" includes a held direction, a player who keeps running into a pit respawns after 0.3 s instead of 0.8 s.
- Respawn point: the latest ofrenda Poncho has reached (GDD-LIFE-03), or the level start if he touched none.
- **Respawn flip, built (placeholder body):** in the last 0.35 s of the wait (21 steps) Poncho appears 48 px above the respawn point, drops with gravity-like acceleration while turning once, and is on the ground, upright and feet down, on the last step, so control returns without a jump in position (`FLIP` in `src/config/tuning.ts`). He lands at the respawn point, the latest ofrenda reached. After the last life there is no flip during the wait; the *Siete vidas gastadas* screen comes up instead, and the flip plays after it, at the level start (GDD-LIFE-05). A skip (any input after 0.3 s) before the flip starts shows no flip, and a skip during it makes him appear at the respawn point at once. The placeholder body has a pale strip along the feet so the turn can be seen. He meows as he appears (GDD-AUD-02).
- **HUD crack, built:** the lost triangle keeps its outline, its red fill fades from full to nothing over 0.4 s (24 steps, `LIFE_LOSS` in `src/config/tuning.ts`) while a crack line appears across it quickly and fades with the fill. If several lives are lost at once, each of their triangles cracks. A triangle that is filled again (an ofrenda) stops cracking. The animation counts simulation steps, so it pauses with the game. 
- **Crushing (built, details Proposed; user, 2026-10-23: a crush costs a life like a pit):** Poncho is crushed when a moving block (GDD-WLD-05) pushes him, or carries him up, into a solid tile, so his body box would have to overlap it. A shut door, an unbroken fragile wall, a piñata, a spring and a crumbling tile that has not fallen count as solid. A crush costs exactly one life like a fall into a pit: in every power-up state (Taco and Fuego do not absorb it, and he comes back in Base, GDD-PWR-01) and even while invulnerable (GDD-CMB-03). The respawn wait, the flip and the respawn point are those of any lost life. Moving platforms never crush him.

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

- **Pulse, built (details Proposed):** while exactly one life is left, its triangle on the HUD (the leftmost) grows to 1.4 times its size and back, about its centre, smoothly (a cosine), every 0.8 s (48 steps), counted from the step the lives drop to one, so it always starts at its normal size; it keeps pulsing as long as one life is left, through the respawn wait too. It counts simulation steps, so it pauses with the game, like the crack (GDD-LIFE-02). With no lives (the Siete vidas gastadas screen, GDD-LIFE-05) or two or more it does not pulse. `LAST_LIFE` in `src/config/tuning.ts`, `src/ui/lastLife.ts`. Not built yet: the tense music (GDD-AUD-01) and the double hilo score (GDD-PRG-03), which wait for music and the score.

### GDD-LIFE-05 Out of lives

Status: Decided (lives are carried across a world, user, 2026-10-19). Details are Proposed.

- Lives are tracked per world: 7 at world start, carried through its 3 levels and boss.
- At 0 lives: *Siete vidas gastadas* screen, then restart from the first level of the world with 7 lives. Hilos collected stay (GDD-PRG-02); built for the one level there is, where collected hilos stay collected through the restart (GDD-WLD-04).
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

- **Built (unlock flag, start and look decided by the user 2026-10-22, details Proposed):** an ability flag on the level turns the glide on (`abilities` in `src/sim/run.ts`); the sandbox level has it on so it can be played until clearing World 2 unlocks it (GDD-PRG-01). Holding jump (any jump key or the touch Jump button) while falling glides: a jump held from takeoff glides as soon as he starts to fall, and a press while already falling (off a ledge, or after letting go) glides too. While gliding the fall speed is capped at 70 px/s (a slower fall speeds up to it as usual), and running and steering in the air are as in any fall. Letting go ends it and he falls as usual; pressing again glides again. Landing, on tiles or a moving platform, ends it.
- **Start after the jump buffer (Proposed):** a glide starts only once jump has been held for more than 0.1 s (6 steps, the jump buffer of GDD-MOV-03), so a press just before landing is still a buffered jump and does not glide him past the window. A jump held from takeoff is long past that at the top. The hold counts from a press the game saw: a jump still held after a respawn, or pressed while paused and held through the resume (GDD-UI-02), does not glide until it is pressed again; a glide held through a pause carries on.
- **Stomp lock:** a stomp bounce (GDD-CMB-01) starts a 150 ms lock (9 steps) in which a glide cannot start; a spring launch has none (it rises far longer than that). `GLIDE` in `src/config/tuning.ts`, `src/sim/movement.ts`.
- **Look (placeholder):** a bar 28 x 4 px in red and cream serape stripes 4 px wide, just above the body, drawn while gliding. Not built yet: the glide sprite and sound.

### GDD-MOV-08 Wall cling and kick

Status: Proposed. Post-MVP (GDD-MVP-02), unlocked by GDD-PRG-01.

Cat claws: pressing toward a wall while falling slows the slide to 60 px/s. Jump from the wall kicks away at 130 px/s horizontal and 380 px/s upward. 120 ms of locked horizontal control after the kick.

- **Built (kick timing, glide priority, grace and look decided by the user 2026-10-23, details Proposed):** the same ability flag as the glide turns it on (`abilities.wallCling`); the sandbox has it on, and the level's left and right edges are full-height walls to try it on, until clearing World 3 unlocks it (GDD-PRG-01). A wall counts when it is flush beside his body box (running into one snaps him flush, GDD-MOV-06).
- **Cling:** in the air, falling, pressing toward a wall he touches (the left or right button, key or stick that way), the fall is capped at 60 px/s (a slower fall speeds up to it). Not while rising, not pressing away or nothing, not on the ground. Landing, on tiles or a moving platform, or a stomp bounce ends it. With the glide on too, the cling wins: against the wall pressing toward it he slides even with jump held, and glides once off it.
- **Kick:** a jump press (one the game saw: a jump held through a respawn or a pause does not count, GDD-UI-02) while he touches a wall in the air, rising or falling, pressing toward it or not, kicks him away from it at 130 px/s across and 380 px/s up, facing away. It also works within 0.1 s (the coyote time, GDD-MOV-03) of leaving the wall, once per touch. A press that is a normal jump (on the ground, or in coyote time after walking off a ledge) stays a normal jump. While he rises from a spring launch there is no kick: that launch is fixed once it starts (GDD-WLD-05; user decision, 2026-10-23); falling again, he can kick. The sandbox spring is right against the 2-tile wall, where this matters. For 120 ms (7 steps) after the kick, sideways input does nothing and he keeps the kick's speed. Releasing jump while rising cuts the kick like a jump (GDD-MOV-02). `WALL` in `src/config/tuning.ts`, `src/sim/movement.ts`.
- **Look (placeholder):** three short pale claw marks, 2 px wide, slanting down the half of the body next to the wall, while sliding. The level's edges are not drawn as walls, so in the sandbox he seems to cling to the edge of the picture. Not built yet: the cling sprite and sound.

---

## 5. Combat and interaction

### GDD-CMB-01 Stomp

Status: Proposed

Landing on top of a stompable enemy defeats it and bounces Poncho: 260 px/s up, or 410 px/s up if jump is held or buffered. Some enemies are not stompable (spikes) and are marked visually.

- **Built (details Proposed):** a landing counts as a stomp when Poncho is falling, his hurtbox (GDD-MOV-06) overlaps the enemy's box, and on the step before his feet were at most 4 px below the enemy's top. That makes a landing on top a stomp and walking into the side or from below a hit (GDD-CMB-03). A stomp is checked before the hit, so a stomp never hurts, and it works while Poncho is invulnerable. The bounce is 410 px/s if jump is held or was pressed within the buffer window (0.1 s, GDD-MOV-03), otherwise 260 px/s, and releasing jump cuts the rise short like any jump. Several enemies stomped in one step give one bounce. The Tlacuache's first stomp only makes it play dead (it bounces Poncho all the same); a stomp after it wakes defeats it (user decision, 2026-10-22; GDD-ENM-02). The Zopilote and the cactus buddy are not stompable (user decision, 2026-10-22): landing on one is a hit like touching it anywhere else, and no bounce. An enemy that cannot be stomped is marked by three pale thorns along its back (placeholder art; the cactus buddy has three pale thorns on top, the same mark). `STOMP` in `src/config/tuning.ts`, `src/sim/enemy.ts`.

### GDD-CMB-02 Claw swipe

Status: Proposed

A short-range melee on the action button, a standard mechanic that Poncho always has (decided by the user, 2026-10-21; it is not a power-up): 0.25 s cooldown, hits a 20 x 14 px area in front of Poncho for 3 frames after a 2-frame wind-up. Defeats light enemies, stuns heavy ones for 1 s, breaks fragile blocks (papel picado walls). Cannot be used while taking a hit.

- **Built (details Proposed):** a press of the claw button (X or J, or the touch Claw button, GDD-CTL-01, GDD-CTL-03) starts a swing; holding it swings once, and a press during a swing or its cooldown is ignored. The timeline is a 2-step wind-up (the press step is the first), then 3 steps of swing in which the hit box is live, then idle. The 0.25 s cooldown (15 steps) runs from the press that started the swing, so the swings of a player who taps as fast as possible are 15 steps apart. The box is 20 px long and 14 px tall, level with the body, from the body's front edge outwards, facing the way Poncho faced at the press. Boxes that only share an edge with a tile do not touch it (GDD-PWR-06). A hit that leaves Poncho alive (a spike or an enemy in Taco or Fuego, GDD-CMB-03) ends the swing in progress but not its cooldown; there is no stun yet, so that is all "cannot be used while taking a hit" means for now. Losing a life ends any swing. The wind-up shows a small pale mark in front of Poncho and the swing three slanted pale slashes across the box (placeholder art). It opens piñatas (GDD-PWR-05) and breaks fragile walls (GDD-WLD-05). It defeats the Alacrán, the Zopilote or the Tlacuache its box overlaps (also a Tlacuache playing dead), and passes through a cactus buddy, which nothing defeats (GDD-ENM-02). Not built yet: stunning heavy enemies, the swing pose. The claw sound plays when a swing starts (GDD-AUD-02). `CLAW` in `src/config/tuning.ts`, `src/sim/claw.ts`.

### GDD-CMB-03 Damage and invulnerability

Status: Proposed

- A hit is resolved by the power-up state (GDD-PWR-01): in Base it costs exactly 1 life (GDD-LIFE-02); in Taco or Fuego it only downgrades the state and costs no life. There is no separate health bar.
- After a hit Poncho is invulnerable for 2.0 s and knocked back 80 px/s away from the source (user, 2026-10-21; built for spike hits and the hits of the Alacrán, Zopilote, cactus buddy and Tlacuache, `HIT` in `src/config/tuning.ts`). The push is a starting speed: the run controls take over at once, so it is a nudge off the hazard, not a launch. When Poncho is dead centre on the source, the push goes against the way he faces.
- Invulnerability does not protect from pits or crushing, and neither do Taco and Fuego: a pit or a crush costs one life in any power-up state (GDD-LIFE-02). A crush is not a hit, so there is no knockback.
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

- **Built (details Proposed):** a taco released from a piñata (GDD-PWR-05) stands on top of it and walks right at 40 px/s (`TACO.walkSpeed`), turns round at walls, falls off ledges and is gone once it falls below the level. It is a 12 x 12 px square, collected by touch (GDD-PWR-06). Collecting one in Base gives Taco. In Taco it would not improve the state, which gives hilos (GDD-PWR-01); that rule is not built yet, so it is just used up. This differs from the floor taco, which waits where it is: a released one walks away and cannot wait (Open Question 12). `src/sim/item.ts`.

### GDD-PWR-03 Chile and Fuego (the fire flower)

Status: Proposed

- Taco to Fuego by eating a chile (a stationary glowing pepper released from a piñata when Poncho is already in Taco or Fuego).
- In Fuego the Fuego button spits a salsa fireball: 180 px/s horizontal, bounces along the ground with a 20 px arc, vanishes on walls or after 3 s, maximum 2 on screen.
- Fireballs defeat most light enemies, melt ice and light unlit candles. Bosses take 1 damage per fireball unless a boss rule says otherwise (GDD-BOS-01).
- The Fuego button is separate from Claw (GDD-CMB-02). On touch it appears only while in Fuego (GDD-CTL-03).

- **Built (details Proposed):** the chile is a stationary pepper that stands on top of its piñata (GDD-PWR-05) and is eaten by touch (GDD-PWR-06): Taco becomes Fuego, Fuego stays Fuego and the pepper is used up (it would give hilos, GDD-PWR-01, a rule not built yet), and Base becomes Taco (one step better, like a Mario flower picked up when small; the GDD did not say). A press of the Fuego button (C or K on the keyboard, the touch Fuego button, GDD-CTL-01, GDD-CTL-03) in Fuego spits one fireball on that press step; holding the button spits once. In Base or Taco it does nothing. At most 2 fireballs exist at once: a press while two are in flight is ignored. With a wall right against Poncho's front there is no room for it (GDD-PWR-06): the press does nothing.
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
| Start (title screen) | Enter, Space or Z on "Start", or any claw, Fuego, left or right key |
| Menus: title, pause, settings (choose, pick) | Up or W, Down or S; Enter, Space or Z |
| Settings (change a value) | Left or A, Right or D |

Keys are remappable (GDD-UI-03). Pause, the title screen and the settings screen are built (GDD-UI-02); the pause keys, Enter and the menu keys go by their label, so they work on any layout.

### GDD-CTL-02 Gamepad

Status: Proposed

Standard gamepad mapping: left stick or D-pad to move (analog speed), south button to jump, west button to claw, east button for Fuego, start to pause. Dead zone 0.2.

### GDD-CTL-03 Touch

Status: Proposed. Required for the MVP (GDD-MVP-01).

- Landscape layout with two thumb zones. Left: horizontal slide stick or left/right buttons (player choice). Right: Jump (large) and Claw buttons, plus a Fuego button that appears only in the Fuego state (GDD-PWR-03).
- Minimum touch target 48 CSS px, buttons offset from the screen edge by the safe-area inset.
- Layout can be mirrored and controls opacity adjustable (GDD-UI-03).
- Multi-touch: moving and jumping at the same time must work. Prevent page scroll, zoom, long-press menus and text selection while playing.
- Short vibration (50 ms) on life loss where the platform supports it. Audio unlocks on first touch (GDD-AUD-01), which is usually the tap that starts the game on the title screen (GDD-UI-02).
- **Built so far:** left and right buttons bottom-left and a larger jump button bottom-right, drawn as a framed triangle (the poncho motif) semi-transparent, brighter and orange while pressed (the exact opacity becomes a setting with GDD-UI-03). Buttons are 40 px (jump 56 px) with 6 px from the screen edge and a 4 px gap between left and right, and they grow on a small screen so none is under 48 CSS px (`TOUCH` in `src/config/tuning.ts`). They show only on devices that report touch, are hidden on the title screen, where a finger on the mode switch changes nothing (GDD-UI-02), and work together with the keyboard. Left and right pressed together cancel out. Moving and jumping at once works with two fingers.
- **Slide stick (built, details Proposed):** a small switch above the left thumb zone swaps the left and right buttons for one track as wide as both, and back. The choice is remembered on the device (browser storage, where allowed). A finger anywhere in the lower left quarter of the screen steers, by how far it is left or right of the track's centre: nothing inside a dead zone of 0.2 of the half-track, then speed grows evenly to full at the track's edge and stays full beyond it (analog speed, GDD-MOV-01). Jump stays on the right and works together with the stick. The switch is as large as the other buttons (48 CSS px minimum). A finger that went down while the game was paused, or that is down when the level starts from the title screen, presses no button and does not steer until it is lifted (GDD-UI-02).
- **Claw button (built):** a button the size of the left and right buttons sits left of Jump on the same floor line, a gap of 4 px from it, drawn with three slanted claw marks; it works together with moving and jumping (GDD-CMB-02).
- **Fuego button (built):** the same size as the claw button, directly above it with a gap of 4 px, drawn as an orange flame. It exists only while Poncho is in Fuego: it appears when he becomes Fuego and goes when he is hit or loses a life (GDD-PWR-03). A press spits a fireball, and, like jump and the claw, a tap shorter than a frame still counts (GDD-CTL-04).
- **Pause button (built):** top-right, see GDD-UI-02.
- **Still missing:** mirrored layout and opacity setting, safe-area insets (the canvas is letterboxed, which keeps the buttons clear of notches on wide phones), vibration.

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

- Length: 3 to 6 screens wide at 480 px (GDD-ART-01). Mostly horizontal; vertical sections allowed. (The sandbox, a test level, is one screen wide and has no exit; the level validator, GDD-TEC-04, checks the length and the exit of every other level.)
- 3 ofrenda checkpoints at roughly 25%, 55% and 85% of the level, and an exit. (The sandbox test level puts the middle one at about 65% because 55% is in its pit; see GDD-WLD-05.)
- 1 hidden secret per level (a room or a veladora).
- Teaching order: new mechanic is introduced in a safe spot, then combined with a threat, then used in a test.
- Gaps never exceed 3 tiles in World 1 (jump distance is about 4.1 to 4.3 tiles at full run, GDD-MOV-01 to GDD-MOV-04). The level validator checks it for every level (GDD-TEC-04).
- Measured with the real body box against tiles (`src/sim/collision.test.ts`): a full jump can climb onto a wall 3 tiles high but not 4, and a running jump can cross a gap of 5 tiles but not 6. Gaps are measured edge to edge. The body only has to overlap the far edge, so a 5-tile gap (80 px) costs about 4.25 tiles (68 px) of travel from centre to centre, which is why it fits the 4.1 to 4.3 tile jump distance above. Walls taller than 3 tiles block the path; gaps wider than 5 tiles are impassable without a power. Design to the World 1 limit of 3 so there is room for mistakes.

### GDD-WLD-04 Collectibles

Status: Proposed

- **Hilos (threads):** colourful threads scattered through levels; 50 per level. They unlock cosmetics for the poncho (GDD-PRG-01) and feed the score (GDD-PRG-03).
- **Hilo pickups (built, details Proposed; user, 2026-10-23: pickups and the HUD counter first, placeholder skeins in serape colours):** a hilo is an 8 x 8 px pickup in the middle of its tile, collected when Poncho's body box overlaps it (GDD-PWR-06); boxes that only share an edge do not touch. It is collected on any step he is in play, also the step he is hit or crushed, and not while he waits to respawn or during the respawn flip. A collected hilo is gone for good: losing a life does not bring it back or take it away (GDD-LIFE-02), and neither does the restart after the last life (GDD-LIFE-05). Quitting to the title screen starts a fresh run, with every hilo back (GDD-UI-02), until the total is saved. Several touched in one step are all collected. Placeholder look: a round skein of thread with two dark wraps and a short loose end; the hilos take the serape's colours in turn, in the order the level lists them (red, yellow, green, blue, pink), so a trail reads like a poncho stripe. The sandbox has 20 (user, 2026-10-23: about 20 on the one-screen test level; real levels keep 50), in short trails along the path: on the floor before the door, over the Alacrán's platform, on the 2-tile wall, above the spring and on the spring ledge, one over the middle of the pit, a reward for a precise crossing: a jump over the cactus buddy from the top of the 2-tile wall, holding right, that comes down on the spring is thrown over the pit through it (other crossings, such as a running jump from the spring ledge, pass under it), over the spikes, on the 3-tile wall, over the crumbling tiles, along the moving platform's route and on the Tlacuache's ledge. `HILO` in `src/config/tuning.ts`, `src/sim/hilo.ts`. Each step that collects hilos plays the hilo sound, climbing a major scale (GDD-AUD-02). Not built yet: hilos from items that would not improve the state (GDD-PWR-01) and from the multi-piñata (GDD-PWR-05), the score (GDD-PRG-03) and saving the total (GDD-PRG-02).
- **Veladora:** one per level at most, restores a life (GDD-LIFE-03).
- Collectibles guide the player's eye along the intended path and reward risk.

### GDD-WLD-05 Hazards and interactables

Status: Proposed

Core set: spikes (cactus, obsidian), pits, crumbling platforms (0.5 s warning), springs (bounce 480 px/s), moving platforms, moving blocks, fragile walls (claw-breakable), ofrendas (checkpoints), doors and keys. Each world adds one signature hazard (GDD-WLD-02).

- **Spikes (built, details Proposed):** a spike stands in one tile and hurts through the lower half of it (16 px wide, 8 px tall), so a jump that clears the points by a hair is safe. Touching it with the hurtbox (GDD-MOV-06) from any side costs one life, like a pit: the wait, the flip and 2.0 s of invulnerability follow (GDD-LIFE-02). Unlike a pit, a spike does not hurt while Poncho is invulnerable (GDD-CMB-03). Invulnerability only skips the hit, it does not move Poncho: if he is still on a spike when the 2.0 s end, he loses a life on the next step. If a spike hit and an ofrenda touch happen in the same step, the hit wins and the ofrenda is not activated. In Taco a spike hit spends the taco instead (GDD-PWR-01, GDD-CMB-03). The sandbox level has two spikes between the second ofrenda and the 3-tile wall. Cactus and obsidian art, and the "not stompable" marking for spike enemies (GDD-CMB-01), come later. `SPIKE` in `src/config/tuning.ts`, `src/sim/hazards.ts`.
- **Crumbling tiles (built, details Proposed):** one-tile ledges that are solid like a floor. A tile starts to crumble when Poncho lands on it: his body box over its column and his feet on its top. A jump up from below, or walking into its side, does nothing. The warning lasts 0.5 s (30 steps) from the step he lands, shown by the tile shaking sideways and flashing pale in turn (movement and colour, GDD-UI-03). Then it is gone: Poncho falls, with the usual 0.1 s of coyote time to still jump (GDD-MOV-03). The countdown cannot be stopped: if he walks off, the tile still goes. Each tile has its own timer, so standing on the join of two starts both. A gone tile stays gone until Poncho loses a life, and then every tile is whole again when he respawns (GDD-LIFE-02). The sandbox level has three at tile columns 24 to 26, a jump up from the 3-tile wall. Sand-coloured placeholder art with a crack. `CRUMBLE` in `src/config/tuning.ts`, `src/sim/crumble.ts`.
- **Springs (built, details Proposed):** a one-tile block, solid like a floor and set flush into it. Standing on its top, by landing on it or by walking onto it, throws Poncho up the same step. The plain launch is 480 px/s, about 77 px up, clearly above a jump (410 px/s, 56 px). A **timed press** gives a higher one: if Poncho pressed jump in the 0.1 s (6 steps) before he lands, counting the landing step itself, the launch is 600 px/s, about 120 px (the user's rule, 2026-10-21: a timed press only, holding jump does not count; the 600 is a proposal). Walking onto the spring, or holding jump from earlier, gives the plain launch. Either launch is fixed once it starts: releasing jump does not cut it short, and a jump pressed in the next steps does not replace it with the weaker 410 px/s jump, nor, beside a wall, with a wall kick (GDD-MOV-08). Touching the spring from the side or below does nothing. Red-and-cream placeholder art with a coil. The sandbox level has one in the floor between the 2-tile wall and the pit, clear of the touch buttons, and a ledge 96 px above the floor that only the timed launch reaches. `SPRING` in `src/config/tuning.ts`, `src/sim/spring.ts`.
- **Moving platforms (built, details Proposed):** a slab 8 px thick and any whole number of tiles wide that travels in a straight line between two ends and back, at 40 px/s, turning round at each end without stopping. Where it is depends only on how many steps have passed, so it is identical on every run. It is a **one-way floor**: Poncho lands on its top when he comes down onto it, and while he stands on it he is carried with it (sideways and up and down). He passes through it from below, so he can jump up through it and land on top, and its sides and underside never block him, so it cannot crush him (only a moving block can, below). If it would carry him into a wall or a ceiling he stays against that tile and the platform slides on under his feet: it never pushes him through a tile. Jumping from it works at once; walking off an end drops him. Platforms stand still during the 0.8 s respawn wait and start from their first end again when Poncho respawns (GDD-LIFE-02). The sandbox level has one, 3 tiles wide at the height of the spring ledge, starting against the ledge's right edge and travelling 96 px right, towards the crumbling tiles; from its right end a jump reaches the Tlacuache's ledge in the top right corner, 32 px higher (GDD-ENM-02). Teal placeholder art. `PLATFORM` in `src/config/tuning.ts`, `src/sim/platform.ts`.
- **Moving blocks (built, details Proposed; user, 2026-10-23: a solid block that moves like the platforms and crushes):** a solid block any whole number of tiles wide and tall that travels in a straight line between two ends and back at 40 px/s, turning round at each end without stopping, like a moving platform, and identical on every run. Unlike a platform it is solid on every side: Poncho lands on its top and is carried with it while he stands there (sideways and up and down), bumps his head on its underside, and is stopped by its sides. When it moves into him it pushes him along in the direction it moves. If that push, or carrying him up, would force his body box into a solid tile, he is **crushed** (GDD-LIFE-02). If it would carry him sideways into a wall he stays against the wall and the block slides on under his feet, as a platform does; carried down while part of him hangs over a tile beside it, he stays on that tile and the block goes on down without him (it never pushes him through a tile). Its sides are not walls to cling to (GDD-MOV-08). Only Poncho collides with it for now: enemies, walking tacos and fireballs pass through it. Blocks stand still during the 0.8 s respawn wait and start from their first end again when Poncho respawns. The sandbox has one, one tile square, in column 28 of the pocket past the fragile wall: it travels from just under the Tlacuache's ledge (top y = 112) down to the floor (top y = 208) and back, starting at the top. So Poncho is crushed if he is under it when it reaches the floor, or if he rides it up into the ledge; column 29 beside it, against the level's right edge, is a safe spot. Grey stone placeholder art with dark corner studs. `BLOCK` in `src/config/tuning.ts`, `src/sim/block.ts`.
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
- Enemies never spawn on screen within 3 tiles of Poncho's respawn. (Checked for every enemy in every level, the sandbox included, by the level validator, GDD-TEC-04.)
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
- **Cactus buddy (built, details Proposed):** a static 12 x 16 px cactus standing on the ground at the place the level gives it (`CACTUS` in `src/config/tuning.ts`). It never moves, and it is "avoid only" (user decision, 2026-10-22): a stomp does not defeat it (it cannot be stomped, GDD-CMB-01, and landing on it is a hit), a claw swipe passes through it, and a fireball that overlaps it is used up without harming it, so it can cover Poncho from fireballs. Touching it is a hit (GDD-CMB-03), except that it is harmless from below: a contact is no hit while Poncho is moving up and his hurtbox top was at or below its underside on the step before, once his head is above that line he is inside it and the usual hit applies. That can only happen for a cactus with no solid tile directly beneath it: a cactus standing on the ground or a ledge has the top of that tile as its underside, which Poncho's head cannot get below while he overlaps it (tile collision, GDD-MOV-06). So no cactus buddy that stands on something can be passed from below, and no level has one with nothing beneath it yet; the rule is only covered by unit tests on a cactus in mid-air. It uses Poncho's hurtbox against its own box, like the other enemies. It is a placeholder drawing of a green cactus with two arms and three pale thorns on top. It is alive again, simply where it was, after a lost life (GDD-LIFE-02). The sandbox has one on the right half of the top of the 2-tile wall (columns 10 and 11, top y = 192), at x = 184, leaving the left 18 px of the wall top free to stand on and to jump from to the Alacrán's platform; it is more than 3 tiles from every respawn (GDD-ENM-01; checked by the level validator, GDD-TEC-04). No spot in the sandbox shows the from-below case (see above), so that is covered by unit tests. Not built yet: sounds. `src/sim/enemy.ts`.
- **Tlacuache (built, details Proposed):** a 16 x 10 px opossum standing on the ground (`TLACUACHE` in `src/config/tuning.ts`). It starts at the place the level gives it, heading right, and walks at 24 px/s, turning at walls (flush against them) and at ledge ends like the Alacrán. It spots Poncho when his feet are within 16 px of its own, up or down, and his hurtbox centre is in front of it (the way it faces) by more than 0 and up to 80 px (user decision, 2026-10-22: sight, then dash). It then freezes and flashes red for exactly 0.5 s (30 steps, the telegraph of GDD-ENM-01) and charges at 150 px/s the way it faces, without turning to follow him, until a wall or the end of its ground stops it (as in its walk, it never runs off a ledge); there it turns round and walks again, and may spot him again at once. Touching it is a hit (GDD-CMB-03), while it walks, telegraphs or charges. Its first stomp (GDD-CMB-01) does not defeat it: Poncho bounces as from any stomp and it plays dead for 2.0 s (120 steps), lying still on its back (user decision, 2026-10-22: stomp twice). Playing dead it is out of play except for the claw: touching it is no hit, landing on it is no stomp and a fireball passes over it without being used up, but a claw swipe that overlaps it defeats it (user decision, 2026-10-22). Then it wakes facing the way it faced, walking, and touching it is a hit again (so a Poncho standing in it when it wakes is hit; its feet twitch in its last 0.5 s as a warning). After it has played dead once, a stomp defeats it. The claw (GDD-CMB-02) defeats it at any time, and a fireball (GDD-PWR-03) at any time it is awake, whether or not it has been stomped; either wins over a first stomp in the same step. It is a placeholder drawing of a grey opossum with a pale face, pink nose and ears and a long bare pink tail. A lost life brings it back at its start, walking, not yet stomped (GDD-LIFE-02). The sandbox has one in the middle of a ledge 5 tiles long in the top right corner (row 6, columns 25 to 29, x 400 to 480, top y = 96), which it walks end to end; Poncho reaches the ledge with a jump from the moving platform at its right end, 32 px lower. The ledge is out of the Zopilote's sideways reach and 128 px above the third ofrenda, far from every respawn (GDD-ENM-01; checked by the level validator, GDD-TEC-04). Not built yet: sounds, a defeat animation, a charge pose. `src/sim/enemy.ts`.

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

- Clearing worlds unlocks permanent **abilities** in order (these are not the temporary power-ups of section 6): Glide (GDD-MOV-07, after World 2), Wall cling (GDD-MOV-08, after World 3). Further powers are open (GDD-MVP-02). Until there are worlds, a level turns an ability on itself: the sandbox has the glide and the wall cling on.
- Hilos buy cosmetics for the poncho (patterns and colours). Cosmetics never change gameplay.

### GDD-PRG-02 Save system

Status: Proposed

- Autosave to browser `localStorage` after each level and each checkpoint. Versioned schema with migration.
- Saves: world progress, hilos total, unlocked powers, cosmetics, settings, assist flags.
- Save never blocks the main thread and survives storage being unavailable (play without saving).
- **Built (details Proposed):** the settings alone, as `{ "version": 1, "settings": { "master": 0-10, "effects": 0-10 } }` under the key `poncho-siete-vidas` in local storage, written at each change and read when the game opens (GDD-UI-02). `src/sim/save.ts`.

### GDD-PRG-03 Score and medals

Status: Proposed. Optional, can be cut.

Score from hilos, enemies and time. Level medals: Bronze (clear), Silver (all hilos), Gold (all hilos and 4 or more lives left at the exit). Última Vida doubles hilo score (GDD-LIFE-04).

---

## 11. UI and accessibility

### GDD-UI-01 HUD

Status: Proposed

- Top-left: seven triangles (GDD-LIFE-01), filled = life, outline = lost. Lives fill from the left, so a lost life empties the rightmost filled triangle. Filled and outline differ by shape, not colour alone (GDD-UI-03). Next to them, a small icon of the current power-up state (GDD-PWR-01). After it, one small key per key carried (GDD-WLD-05).
- Top-right: hilo counter. On touch the pause button takes the corner (GDD-UI-02), so the counter goes left of it.
- **Hilo counter (built, details Proposed; user, 2026-10-23: collected/total):** a small skein (the hilo pickup's look, in yellow) and then the hilos collected and the level's total, as "12/20", in 8 px pale monospace text. Its right edge is 8 px from the screen's right edge, as the lives are 8 px from the left, and its top is level with the lives. On a touch device it ends 6 px left of the pause button instead, wherever that button has grown to. `src/ui/hiloCounter.ts`.
- Minimal, semi-transparent, hidden during cutscenes. On touch, controls are drawn under the safe-area insets (GDD-CTL-03).

### GDD-UI-02 Menus and flow

Status: Proposed

Boot, title, world map, level, pause, results, settings. Fully operable by touch, keyboard and gamepad. Pause happens automatically if the tab loses focus or the device rotates to portrait.

- **Pause in a level (built; the button top-right, auto-pause on focus and portrait and resume with the pause key or a tap decided by the user 2026-10-22, at first resume-only, a menu since 2026-10-23, details Proposed):** Escape or P (GDD-CTL-01), or the touch pause button, pauses. The pause button sits in the top-right corner, 6 px from both edges, 24 px, growing like the other buttons so it is never under 48 CSS px (`TOUCH.pauseSize` in `src/config/tuning.ts`); it shows only on touch devices, drawn as two upright bars. The level stands still under a dim layer with "Paused" and the pause menu below it. The HUD and the touch buttons stay on top.
- **Resume:** Escape or P again (each press counts once, on any keyboard layout), the pause button, a tap or click anywhere but on a menu row, or picking "Resume" from the pause menu. The game keys (jump, claw, Fuego, moving) do not resume by themselves, though Space and Z pick the chosen menu item and Up, W, Down and S choose one; on touch any tap off the menu rows does, on a game button too, but that tap is no game press. A button pressed while paused (the Jump button under the tap that resumed, a key pressed while the game stood still, a Left or Right key or button held through the resume, a finger on the slide stick, GDD-CTL-03) does nothing until it is released and pressed again, also on the *Siete vidas gastadas* screen (GDD-LIFE-05), wherever the finger is (the Resume row reaches into the stick's lower left quarter); a key held at the pause and pressed again while paused is such a press too, and a quick tap of Left or Right while paused counts for nothing after the resume; a button held since before the pause stays held, so a run or a jump carries on.
- **Pause menu (built; a two-item menu decided by the user 2026-10-23, a third item, "Settings", 2026-10-25, details Proposed):** under "Paused", three items, "Resume", "Settings" and "Quit to title", in 12 px text, centred, one under the other. Each item is a row 160 px wide and 28 px tall, the first one's top 136 px from the screen's top, each next one directly below; on a small screen the rows grow so none is under 48 CSS px tall (`PAUSE_MENU` in `src/config/tuning.ts`). The chosen item is pale with a ">" in front of it, the others grey. The menu opens with "Resume" chosen, every time the game pauses. On a keyboard Up or W chooses the item above and Down or S the item below (no wrap-around); Enter, Space or Z picks the chosen item. Each press counts once, on any keyboard layout, and the presses of one frame count in order, so Down, Down and then Enter in one frame quits (they are read from the browser's own key events, like Escape and P). A tap or click on an item's row picks that item at once, whichever is chosen. Picking "Settings" opens the settings screen; leaving it comes back to the pause menu with "Settings" chosen. There is no confirmation for quitting (user, 2026-10-23). While the phone is upright the menu is hidden and nothing on it can be chosen or picked; turned sideways again, the item chosen before is still chosen (the menu did not open again).
- **Quit to title:** picking "Quit to title" brings back the title screen, waiting for a press as when the game opens. The level behind it is a fresh run, as when the game opens (user, 2026-10-23): seven lives, every ofrenda unused and the respawn point at the level start, every hilo back (until saving exists, GDD-PRG-02), Poncho in Base with no keys, and every piñata, door, fragile wall, taco, enemy, crumbling tile, moving platform and moving block back at its start. Poncho stands at the level start with no respawn flip and no invulnerability, and no sound plays. The press that quit does not start the level: the button that picked counts as already held on the title screen, and an Enter press, tap or click in the same frame does not count there.
- **Automatic pause:** the tab or window losing focus or being hidden pauses; it never resumes by itself. A touch device whose screen is upright pauses (the screen's orientation decides, or the window's shape where the browser has none), and the pause menu gives way to "Turn your device sideways", in 12 px grey text, larger than the 8 px prompts since the whole level is drawn small; no key, button or tap resumes until it is sideways again, and then it stays paused until the player resumes. A desktop window made taller than wide does not pause, nor does a touchscreen laptop's, whose screen stays landscape. `src/sim/pause.ts`.
- **Title screen (built; the level behind a veil with the placeholder Poncho, any button or a tap to start, and the prompt wording decided by the user 2026-10-23, details Proposed):** the game opens on it. The sandbox level is drawn standing still (no simulation step runs) under a dark veil like the *Siete vidas gastadas* screen's (GDD-LIFE-05), which covers the HUD too; the touch buttons are hidden. Over the veil, centred: "PONCHO" in large pale text (32 px), "Siete Vidas" under it (16 px), the placeholder Poncho body (the red box with the pale strip along his feet, GDD-MOV-06) at twice his size standing below them, and under him the title menu (user, 2026-10-25): two rows, "Start" and then "Settings", drawn like the pause menu (12 px, 160 x 28 px rows growing to 48 CSS px, the first one's top 176 px from the screen's top; `TITLE_MENU` in `src/config/tuning.ts`), with "Start" chosen whenever the title screen appears.
- **Starting (the title menu, with the other buttons still starting, decided by the user 2026-10-25):** Up or W chooses "Start" and Down or S chooses "Settings" (no wrap-around); Enter, Space or Z picks the chosen item, and a tap or click on a row picks that row. Picking "Start" starts the level, and so do a tap or click anywhere off the rows (on the hidden buttons' places and the pause button's too) and a new press of claw, Fuego, Left or Right (GDD-CTL-01). Picking "Settings" opens the settings screen; leaving it comes back to the title with "Settings" chosen. The jump keys start the level only by picking: Space and Z pick, Up and W choose. The touch buttons are hidden and press nothing on the title screen, nor on the settings screen opened from it: a finger on their places, the slide stick's lower left quarter included, is only a tap (a finger on the hidden mode switch does not change the mode, GDD-CTL-03). Only a game button that was up on the frame before counts, so pressing a second button while holding one does; a tap shorter than one frame counts (the game buttons are latched, L-006; Enter, Space, Z and the menu keys are read from the browser's own key events like Escape and P). Escape and P do nothing on the title screen, and losing focus there does not pause the level behind it. The button that started the level counts as already held, as after a resume: a jump held from the title screen does not make Poncho jump until it is released and pressed again, and a Left or Right key, button or slide-stick finger down when the level starts does not move him until it is released. `src/sim/title.ts`.
- **Upright on the title screen:** a touch device whose screen is upright (the same test as the automatic pause) hides the title menu and shows "Turn your device sideways" in its place, in grey 12 px text, also when the game opens that way; nothing on the menu can be chosen or picked until it is sideways again (the presses of a frame count in order, like the pause menu's, so a pick of "Settings" just before a turn upright opens the settings screen, hidden until the phone is sideways), and the level starts only in a frame that ends sideways (so a tap and a turn upright together do not start it); sideways again, the title menu is back with the item chosen before still chosen. So the level never starts upright.
- **Settings screen (built; volume rows, Left and Right to change, "<" and ">" on touch, saved in the browser, decided by the user 2026-10-25, details Proposed):** opened from the pause menu or the title menu, it replaces that menu: the same dark layer, "Settings" in 16 px pale text, centred, its middle 76 px from the screen's top, and under it three rows, "Master volume", "Effects volume" and "Back", each 260 px wide and 28 px tall, centred, the first one's top 96 px from the screen's top, each next one directly below, growing like the pause menu's rows so none is under 48 CSS px tall (`SETTINGS_MENU` in `src/config/tuning.ts`). A volume row shows its name in 12 px text from 20 px inside the row's left edge, a "<" 8 px inside its left edge, a ">" 8 px inside its right edge, and its value as 10 small upright bars, 5 px wide with 2 px between them, the last one ending 20 px inside the row's right edge: as many filled as the value, the rest outlined. The chosen row is pale and the others grey; "Back", when chosen, has a ">" in front of it like the pause menu. The screen opens with "Master volume" chosen, every time. On a keyboard Up or W chooses the row above and Down or S the row below (no wrap-around); Left or A lowers the chosen volume by 1 and Right or D raises it by 1, from 0 to 10 (no wrap-around; the default is 10, `VOLUME` in `src/config/tuning.ts`); Enter, Space or Z on "Back", Escape, P or the touch pause button leave the screen, back to the menu it was opened from; Enter, Space or Z on a volume row does nothing. Each press counts once, read like the pause menu's keys, in order within a frame. On touch, a tap or click on a volume row chooses it and, on the row's left half, lowers it by 1, on its right half raises it by 1; a tap on "Back" leaves; a tap anywhere else does nothing (it does not resume). A change that moves a volume plays the jump sound at the new volume, so the player hears it; at 0, or at 10 when raised, nothing changes and nothing plays. Every sound effect plays at Master times Effects, each as a share of 10 (GDD-AUD-01, GDD-AUD-02). Opened from the pause menu, it lies under the HUD and the touch buttons like the pause menu, and a button or finger pressed on it is held back after the resume like any press made while paused; opened from the title, it covers everything like the title screen. A phone turned upright hides it like the pause menu, showing "Turn your device sideways"; turned sideways again, the same row is still chosen. Losing focus changes nothing on it. A Language row (English, Español, Deutsch; user, 2026-10-25) comes next, between "Effects volume" and "Back". `src/sim/settings.ts`, `src/ui/settingsMenu.ts`.
- **Saving the settings (built, details Proposed):** every change is saved in the browser's local storage at once, and the game opens with the saved settings (GDD-PRG-02). Nothing saved, or something unreadable, opens with the defaults, and a saved value that is not a whole number from 0 to 10 falls back to its default alone. Where the browser refuses storage the game plays with the settings of this visit and saves nothing, without an error.
- **Not built yet:** boot, world map and results screens; the language row; the gamepad start button and menu buttons (GDD-CTL-02).

### GDD-UI-03 Accessibility

Status: Proposed

- Remappable keys and adjustable touch layout (size, mirror, opacity).
- Assist mode: infinite lives, slower game speed (0.75x), hold-to-jump toggle.
- Reduced motion and screen-shake off. High-contrast outlines for hazards.
- Never rely on colour alone to signal danger. Subtitles for any spoken line.
- English, Spanish and German text, with a language switch (German added by the user, 2026-10-25; the switch is not built yet, GDD-UI-02).

---

## 12. Audio

### GDD-AUD-01 Music

Status: Proposed

Upbeat chiptune-and-acoustic mix: marimba, guitarrón, guitar, trumpets, played in the spirit of regional styles of each world. Each world has its own theme and a tense variation for Última Vida. All music is original or properly licensed. Audio is unlocked on first user gesture (browser requirement). Master, music and effects volumes are adjustable. Built: Master and Effects volume on the settings screen (GDD-UI-02); a Music volume row comes with the music.

### GDD-AUD-02 Sound effects

Status: Proposed (the ofrenda sound being a marimba is Decided, user, 2026-10-20)

Short, punchy and readable: jump, land, claw, stomp, hilo pickup (rising pitch combo), life lost (unravelling thread sound), ofrenda activate (marimba), Poncho meows as personality. Each SFX is under 1 s and compressed for the web.

- **Ofrenda activate:** two rosewood marimba bars struck in quick succession, E5 then B5, 0.95 s. Generated from code (`scripts/audio/ofrenda.mjs`, encoded by `scripts/audio/make-sfx.mjs`) as a placeholder until real audio exists (Open Question 9). Shipped as Ogg and MP3. It plays when an ofrenda is used for the first time, not on a repeat touch and not when a restart resets the ofrendas.
- **When the other sounds play (user, 2026-10-23: the meow plays on respawn; the rest Proposed).** Each is generated from code (`scripts/audio/effects.mjs`, encoded by `scripts/audio/make-sfx.mjs`) as a placeholder until real audio exists (Open Question 9), shipped as Ogg and MP3, and plays on the step it happens. All but the meow play only while Poncho is in play; the meow plays as he appears, below. Numbers are in `SFX` in `src/config/tuning.ts`.
  - **Jump:** a short rising chirp, 0.15 s, on every jump takeoff (from the ground, in coyote time or from the jump buffer, GDD-MOV-03) and every wall kick (GDD-MOV-08). Not on a spring launch (GDD-WLD-05) or a stomp bounce (GDD-CMB-01), which are not jumps.
  - **Land:** a soft thump, 0.12 s, when Poncho touches down from the air while falling at 60 px/s or faster, so stepping onto a platform or a tiny drop stays quiet. Not when the landing is a stomp or a spring launch, which have their own sound or none.
  - **Claw:** a swish, 0.18 s, when a claw swing starts (GDD-CMB-02). A press the claw ignores (during a swing or its cooldown) is silent.
  - **Stomp:** a springy thud, 0.2 s, on every stomp (GDD-CMB-01), a Tlacuache's first stomp that makes it play dead included (GDD-ENM-02). One sound for a step, even if two enemies are stomped at once.
  - **Hilo pickup:** a plucked thread, 0.3 s, for each step in which hilos are collected (GDD-WLD-04). Its note climbs a major scale: the first hilo plays the root (G5), and each hilo collected within 0.75 s of the previous one plays the next note up, to the octave (G6, the eighth note), where it stays. A hilo after a longer pause starts again at the root. Two hilos in one step move the scale on by two and play the higher note once.
  - **Life lost:** an unravelling thread, a fast run of plucks falling in pitch, 0.85 s, when a life is lost (GDD-LIFE-02): a pit, a crush, or a hit in Base. A hit that Taco or Fuego absorbs (GDD-CMB-03) is not a lost life and does not play it.
  - **Meow (Decided, user, 2026-10-23):** a short meow, 0.5 s, when Poncho appears again after a lost life: on the first step of the respawn flip, or at the respawn itself when a skip cut the flip short, and after the restart from the *Siete vidas gastadas* screen (GDD-LIFE-05). The sound itself is Proposed.
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

- The validator is built (`src/levels/validate.ts`) and a test runs it over every level in `src/levels/index.ts`. The Tiled JSON loader is not built yet: levels are still written in code, and the loader will feed the same validator (user decision, 2026-10-23). One spawn is guaranteed by the level data, which has exactly one; the loader will count spawn objects.
- It checks 3 ofrendas, an exit, a length of 3 to 6 screens (GDD-WLD-03), no gap wider than the world's limit, and no enemy starting within 3 tiles of the spawn or an ofrenda (GDD-ENM-01). A world with no gap limit in GDD-WLD-03 is itself a problem; only World 1 has one so far.
- A gap is a run of adjacent pit columns, and a pit column is one whose bottom row is empty, where Poncho falls out of the level. A floating tile higher up does not fill a pit (user decision, 2026-10-23), and a column whose bottom row alone is empty counts, on the safe side.
- A level marked as a test level (the sandbox) skips the exit and length checks and gets the others (user decision, 2026-10-23). The sandbox's pit, columns 14 to 16, is a gap of 3 tiles.

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
- Level validation tests (GDD-TEC-04): every level in `src/levels/index.ts` passes the validator.
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

Worlds 2 to 7, Chile Fantasma (GDD-PWR-04), glide, wall cling, further powers, medals and score, cosmetics shop, full soundtrack, localisation beyond English, Spanish and German, native packaging (new ADR).

The glide and the wall cling are built early but stay off in real levels; only the sandbox turns them on (GDD-MOV-07, GDD-MOV-08).

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
13. **Gap limits after World 1 (GDD-WLD-03, GDD-TEC-04):** only World 1 has one (3 tiles). The level validator fails a level in any other world until that world has a limit. Should the limit grow by world, up to the 5 tiles a running jump can cross?
