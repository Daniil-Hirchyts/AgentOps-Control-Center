import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests expect a running stack:
 *   - backend on :8080 with LLM_MODE=mock
 *   - web app (Vite dev or preview with /api + /ws proxy) on BASE_URL (default http://localhost:5173)
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
