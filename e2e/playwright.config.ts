import { defineConfig, devices } from '@playwright/test';

// `pnpm test:e2e` brings up the Dockerized full stack, then drives a real browser
// against it. reuseExistingServer lets local runs reuse an already-running stack.
export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5100',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'docker compose -f ../docker-compose.e2e.yml up --build',
    url: 'http://localhost:5100',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
