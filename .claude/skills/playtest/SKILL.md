---
name: playtest
description: "Run PONCHO: Siete Vidas in headless Chromium with Playwright, drive input, take screenshots and assert on game state. Use to verify a visible or interactive change actually works in the real game, including mobile viewport and touch input. Run with npm run test:e2e."
---

# Playtest

Drives the real game in Chromium with Playwright, on a desktop and a landscape phone viewport.

## Run

```
npm run test:e2e
```

- Playwright starts the Vite dev server on port 4173 itself (`playwright.config.ts`) and reuses one if it is already running.
- The cloud environment ships Chromium. The config uses `/opt/pw-browsers/chromium` automatically, or `PLAYWRIGHT_CHROMIUM_PATH` if set. Never run `playwright install` in the cloud environment. On a normal machine or in CI run `npx playwright install chromium` first.
- Not part of `node scripts/check.mjs` (it needs a browser). Run it before marking any visible or interactive backlog row `done`.

## Writing a scenario

1. Add `e2e/<topic>.spec.ts`. Put the GDD ID in each test title, e.g. `GDD-MOV-02 holding jump reaches about 56 px`.
2. Drive real keyboard input with `page.keyboard`. For touch, the `phone` project has `hasTouch: true`; use `page.touchscreen` once touch controls exist (GDD-CTL-03).
3. Assert on game state through `window.__PONCHO__` (see `PonchoDebug` in `src/scenes/PlayScene.ts`). It only exists in the dev server, never in production builds. Extend that interface when a test needs more state.
4. Fail on console errors (see `boot()` in `e2e/boot.spec.ts`).
5. For anything visual, also take a screenshot into the scratchpad and look at it. Pixels are for people; tests assert on state.

## Screenshots for visual review

```
npm run shots
```

- Writes PNGs to `shots/` (git-ignored) for a desktop (1280x720) and a landscape phone (844x390) viewport. File names end in `-desktop` or `-phone`.
- Scenarios live in `e2e/shots/*.spec.ts`. Add or extend one for every visible change, and capture every state that matters (for the HUD: full, partial, empty). Reuse `boot()` from `e2e/helpers.ts` and drive state with the `window.__PONCHO__` hooks.
- Always look at the images yourself first (Read the PNG), then show them to the user with `SendUserFile` and ask for approval. After approval copy the chosen images to `docs/screenshots/<slug>/` and embed them in the PR.
- These are for people to judge; tests still assert on state, not pixels.

## Coverage to build up

- Boots without console errors, canvas fits the screen (done: GDD-TEC-01, GDD-ART-01).
- Jump height and run speed match the GDD (done: GDD-MOV-01, GDD-MOV-02).
- Losing a life updates the HUD and respawns at the checkpoint (GDD-LIFE-02, GDD-UI-01).
- Touch controls move and jump (GDD-CTL-03).
- Frame time stays within budget on a throttled CPU (GDD-TEC-03).
