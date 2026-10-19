# PONCHO: Siete Vidas

A pixel-art platformer starring **Poncho**, a cat in a Mexican poncho. Seven lives, carried across each world.

- Game design: [`docs/GDD.md`](docs/GDD.md) (the anchor for every feature)
- Work plan: [`docs/BACKLOG.md`](docs/BACKLOG.md)
- How we work: [`CLAUDE.md`](CLAUDE.md) and [`docs/HARNESS.md`](docs/HARNESS.md)

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run test:e2e   # browser playtests (needs Chromium)
node scripts/check.mjs   # the gate: run before every commit
```

Stack: Phaser 3, TypeScript, Vite, Vitest, Playwright. Targets desktop and mobile browsers (landscape).
