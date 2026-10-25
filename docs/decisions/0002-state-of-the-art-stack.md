# 0002 State-of-the-art stack: latest stable releases

- **Status:** Accepted (decided by the user, 2026-10-19). Supersedes the engine version and tooling in 0001.
- **GDD:** GDD-TEC-01, GDD-TEC-07

## Context

0001 picked Phaser 3 and a conventional toolchain, from the assumption that Phaser 3 was current. A registry check
showed it is not: Phaser 4 has been stable since April 2026, and TypeScript 7 (the native compiler) is GA. The user asked
for the state of the art and the latest releases across the whole stack.

## Decision

| Layer | Choice | Version at decision time |
| --- | --- | --- |
| Engine | Phaser 4 | 4.2.1 |
| Language and typecheck | TypeScript 7 (native compiler), strict | 7.0.2 |
| Bundler and dev server | Vite 8 | 8.3.4 |
| Unit tests | Vitest 5 | 5.0.5 |
| End-to-end playtests | Playwright | 1.64.1 |
| Lint | Oxlint with type-aware rules (oxlint-tsgolint), warnings denied | 1.89.0 and 7.0.2004 |
| Runtime types | @types/node 24 | 24.19.2 |
| Node | 24 LTS in CI, 22.12 or newer supported | |

Versions are locked by `package-lock.json`.

## Consequences

- **ESLint with typescript-eslint is not used.** It refuses to install next to TypeScript 7 (peer range below 6.1.0) and
  needs the TypeScript 7.1 programmatic API. Oxlint with tsgolint is the type-aware linter that works on TypeScript 7.
  Revisit when typescript-eslint supports TypeScript 7.
- **Phaser 4 changes:** custom WebGL pipelines, Mesh and Plane objects, BitmapMask and a few effects changed or were
  removed. The Canvas renderer is deprecated. Standard sprites, text, input, tweens, scenes and audio are unchanged, which
  is all this game uses. Do not write custom pipelines; use render nodes and filters if ever needed.
- **Dependency policy** (GDD-TEC-07): stay on the latest stable releases and review them at every GDD minor version.
- The cloud container runs Node 22. CI runs Node 24. Both must pass.
- **@types/node stays on the major of the Node that CI runs** (24 today), not on the latest types (26 at the 0.5.0 review), since newer types describe APIs that Node 24 does not have. Upgrade it when CI moves to a newer Node.
