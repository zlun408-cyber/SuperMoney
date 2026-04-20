import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL: 'http://localhost:3100',
    browserName: 'chromium',
    channel: 'chrome',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'PORT=3100 npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
