import { defineConfig } from '@playwright/test';

// End-to-end tests against the real app. Start MongoDB, `npm run seed` and `npm run dev` in giftshop-server,
// and `npm run dev` here, then run `npm run e2e`.
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    // On Windows, use the Edge that ships with the OS, so no browser download is needed
    channel: process.env.E2E_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
