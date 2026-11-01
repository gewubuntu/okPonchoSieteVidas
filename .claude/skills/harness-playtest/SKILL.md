---
name: harness-playtest
description: "Run PONCHO: Siete Vidas in headless Chromium with Playwright (desktop and phone; keyboard, touch and gamepad), assert on game state and take screenshots. Use before writing, changing or fixing a playtest or screenshot scenario under e2e/, when a playtest fails or flakes locally or in CI, to verify a visible or interactive change in the real game, and to take screenshots for the user's approval. Runs npm run test:e2e and npm run shots."
---

# Playtest

Drives the real game in Chromium with Playwright, on a desktop and a landscape phone viewport.

## Run

```
npm run test:e2e
```

- Playwright starts the Vite dev server on port 4173 itself (`playwright.config.ts`). Outside CI it reuses whatever already answers there, even another checkout's server, and tests that code. In a worktree, or while another run may be up, run `CI=1 npm run test:e2e` (or `CI=1 npm run shots`) so a taken port fails instead; then wait and retry, never kill a server you did not start.
- The cloud environment ships Chromium. The config uses `/opt/pw-browsers/chromium` automatically, or `PLAYWRIGHT_CHROMIUM_PATH` if set. Never run `playwright install` in the cloud environment. On a normal machine or in CI run `npx playwright install chromium` first.
- Make no edits under `src/`, `e2e/` or to `index.html` while it runs: the global teardown (`e2e/edit-guard.ts`) fails the run if any of them changed (L-040).
- Not part of `node scripts/check.mjs` (it needs a browser); CI runs it. Run a new or changed spec alone first (`npm run test:e2e -- e2e/<topic>.spec.ts --repeat-each=3`, L-022), then the whole suite before a visible or interactive backlog row goes `done` or screenshots go to the user (L-015, L-024).

## Writing a scenario

1. Add `e2e/<topic>.spec.ts`. Put the GDD ID in each test title, e.g. `GDD-MOV-02 holding jump reaches about 56 px`.
2. Drive real input, reusing `e2e/helpers.ts`: `page.keyboard`; on the `phone` project (`hasTouch: true`), `page.touchscreen.tap` or `tapAt` for a tap and CDP `Input.dispatchTouchEvent` for a held finger or several (`e2e/touch.spec.ts`); the fake gamepad of `e2e/gamepad.spec.ts`, held several frames because it is polled once a frame.
3. Assert on game state through `window.__PONCHO__` (see `PonchoDebug` in `src/scenes/PlayScene.ts`). It only exists in the dev server, never in production builds. Extend that interface when a test needs more state. Pick out an enemy or item by its index or kind, never by where it is on screen (L-015).
4. Fail on console errors: `boot()` and `openGame()` in `e2e/helpers.ts` return the errors seen; a new spec asserts them empty at least once (`expect(errors).toEqual([])`, as in `e2e/boot.spec.ts`).
5. For anything visual, also add a screenshot scenario (below) and look at the images. Pixels are for people; tests assert on state. Anything that animates or redraws over time also gets one unpaused playtest through the game's own frames, since the debug `step()` redraws everything itself (L-021).
6. A rule about a button that is held (a press that must count as already held, a finger kept down through a screen change) is tested with the button held across frames: a finger by CDP `Input.dispatchTouchEvent` `touchStart`, a key with `keyboard.down` (a second `down` sends an auto-repeat), never only `page.touchscreen.tap`, which lifts within a frame. Measure the effect over the whole window (the highest point over 60 frames), not once at its end (L-032). After releasing a held button, wait until a step has seen the release before pressing it again (for jump, `state().jumpWasHeld` is false; L-022).
7. A test of the save reads the fields its rule is about from the parsed JSON (`toMatchObject`), never the whole saved text, which every new part of the save changes (L-054).
8. When a test does read pixels (`pixelsAt` in `e2e/helpers.ts`), pick points the phone's touch buttons do not cover: they sit on top of everything in the bottom corners, and `window.__PONCHO__.touch().buttons` says where (L-018). Read features at least 2 px across, from their middle (L-017). For an overlay, sample one pixel it must dim and one it must leave alone (the HUD, a button; L-023).

- **Time in simulation steps, not real time (L-042).** The headless browser has no GPU and draws the 1920 x 1080 canvas at 20 to 30 frames a second, slower still under the parallel run, and the loop catches up at most 5 steps a frame, so real time and game time drift apart. Wait for a number of steps (`waitForFunction` on `ticks()` against a count read before), measure a phase with `phaseSince()`, or pause and step in the page with `stepUntil` (`e2e/helpers.ts`); never `waitForTimeout` before reading a speed or position, and never poll `ticks()` around an event. Wait for a counter or a lasting state, never a short-lived one; read a baseline you assert against (a count, a position) after the steps that could change it, not before; read things that change together in one `waitForFunction` (L-033). Do all slow setup (layout reads, a CDP session) before anything timed starts. The gate (`realtime-waits`) fails a new `waitForTimeout` or `setTimeout` in `e2e/` without an `// L-042:` comment on its line saying why real time is fine; when you touch a spec, turn its old waits on a game timer into steps.

## Screenshots for visual review

```
npm run shots
```

- Writes PNGs to `shots/` (git-ignored) for a desktop (1280x720) and a landscape phone (844x390) viewport. File names end in `-desktop` or `-phone`.
- Scenarios live in `e2e/shots/*.spec.ts`. Add or extend one for every visible change, and capture every state that matters (for the HUD: full, partial, empty). Drive state with the `window.__PONCHO__` hooks. Start the level the device's way with `start(page, isMobile, path)` from `e2e/helpers.ts` (a tap on a phone, Enter on a desktop; `boot()` presses Enter on both), so the tips and touch outlines are the ones a player on that device sees, and before a screen that shows a count (hilos, lives) collect some in play rather than teleporting past them (L-045). Right before each shot, assert the state it is named for (phase, what is in view; L-016).
- Look at every image yourself first (Read the PNG), then follow the visible-change rule in `CLAUDE.md` (Pull requests) for the user's approval, `docs/screenshots/<slug>/` and the `overview.png` sheet.
