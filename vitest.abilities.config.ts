import { defineConfig } from 'vitest/config';

// L-024: the simulation tests again with every progression ability on (`src/sim/all-abilities.setup.ts`). Levels are left
// out: each level sets its own abilities, and its route bots are tested with those. The rest matches `vite.config.ts`.
export default defineConfig({
  test: { include: ['src/sim/**/*.test.ts'], environment: 'node', env: { PONCHO_ALL_ABILITIES: '1' }, setupFiles: ['src/sim/all-abilities.setup.ts'] },
});
