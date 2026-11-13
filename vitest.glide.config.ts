import { defineConfig } from 'vitest/config';

// GDD-PRG-01 (user, 2026-11-11: "the existing level tests are updated to play with the glide off and on"): the tests of the real levels of
// Worlds 0 to 2 again with the glide on (`src/levels/glide-unlocked.setup.ts`), as a player who has cleared 2-4 plays them. The rest matches
// `vite.config.ts`.
export default defineConfig({
  test: {
    include: ['src/levels/level0-1.test.ts', 'src/levels/level1-*.test.ts', 'src/levels/level2-*.test.ts', 'src/levels/glide-unlocked.test.ts'],
    environment: 'node',
    testTimeout: 30000, // L-079
    env: { PONCHO_GLIDE_UNLOCKED: '1' },
    setupFiles: ['src/levels/glide-unlocked.setup.ts'],
  },
});
