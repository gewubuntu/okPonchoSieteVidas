---
name: playtest
description: "Run PONCHO: Siete Vidas in headless Chromium with Playwright, drive input, take screenshots and assert on game state. Use to verify a visible or interactive change actually works in the real game, including mobile viewport and touch input. Stub until the game scaffold exists."
---

# Playtest

**Status: stub.** The game scaffold does not exist yet. Until it does, say so and fall back to unit tests. When the scaffold lands (see `GDD-TEC-01`), replace this section with the real commands and delete this notice.

## Procedure (target)

1. Build and serve: `npm run build && npx vite preview --port 4173` (background).
2. Playwright is preinstalled with Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Never run `playwright install`. If the project's Playwright version differs, launch with `executablePath: '/opt/pw-browsers/chromium'`.
3. Write the scenario in `e2e/<GDD-ID>.spec.ts`. Name the GDD ID in the test title.
4. Drive input with real keyboard events; for touch use a context with `hasTouch: true` and a phone viewport (landscape, e.g. 844x390).
5. Assert on game state through a debug hook (`window.__PONCHO__`, exposed only in dev builds), not on pixels.
6. Take a screenshot at the key moment into the scratchpad and look at it.
7. Console errors fail the test.

## Coverage to build up

- Boots and reaches the first level without console errors (`GDD-TEC-01`).
- Jump height and distance match `GDD-MOV-02` within tolerance.
- Losing a life updates the HUD and respawns at the checkpoint (`GDD-LIFE-02`, `GDD-UI-01`).
- Touch controls move and jump (`GDD-CTL-03`).
- Frame time stays within budget on a throttled CPU (`GDD-TEC-03`).
