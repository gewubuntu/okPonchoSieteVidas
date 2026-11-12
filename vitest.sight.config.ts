import { defineConfig } from 'vitest/config';

// GDD-WLD-03 (L-014): the sight sweep of World 3's levels (`src/levels/sight.test.ts`), a run of its own: one level's sweep takes a minute
// or more, so `npm test` leaves it out (`vite.config.ts`). The rest matches `vite.config.ts`.
export default defineConfig({
  test: { include: ['src/levels/sight.test.ts'], environment: 'node', testTimeout: 600000 },
});
