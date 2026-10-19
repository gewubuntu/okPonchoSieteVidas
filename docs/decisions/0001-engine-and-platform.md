# 0001 Engine and platform

- **Status:** Accepted (decided by the user, 2026-10-19)
- **GDD:** GDD-TEC-01, GDD-VIS-02

## Context

The game is a 2D platformer for web and mobile. Development happens in a cloud container
that has Node 22, Python 3.13 and Chromium with Playwright, but no game engine.

## Decision

- Engine: **Phaser 3** with **TypeScript** (strict), bundled by **Vite**.
- Unit tests: **Vitest**. End-to-end and playtests: **Playwright** with the preinstalled Chromium.
- Platforms: desktop browsers and **mobile browsers** (touch controls required), installable as a PWA later.

## Consequences

- Everything can be built, run and screenshot-tested inside the cloud environment.
- Simulation logic must stay free of Phaser imports so it can be unit tested (GDD-TEC-02).
- Native app store packaging is out of scope until the user asks (wrapper such as Capacitor would be a new ADR).
- Godot and Unity were rejected because they cannot be run or verified in this environment.
