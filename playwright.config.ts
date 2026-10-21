import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// The cloud environment ships Chromium; do not download browsers there (see the harness-playtest skill).
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] || (existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    // exactOptionalPropertyTypes: only set the key when there is a value
    launchOptions: executablePath ? { executablePath } : {},
  },
  // The dev server exposes window.__PONCHO__ for the tests (GDD-TEC-06).
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', testIgnore: /shots\//, use: { viewport: { width: 1280, height: 720 } } },
    // GDD-VIS-02: landscape phone
    {
      name: 'phone',
      testIgnore: /shots\//,
      use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
    },
    // Screenshots for visual review, run with `npm run shots` (see the harness-playtest skill). Same viewports as above.
    { name: 'shots-desktop', testMatch: /shots\/.*\.spec\.ts/, use: { viewport: { width: 1280, height: 720 } } },
    {
      name: 'shots-phone',
      testMatch: /shots\/.*\.spec\.ts/,
      use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
    },
  ],
});
