import { defineConfig } from '@playwright/test';

/** Captures report screenshots into docs/screenshots (not part of CI). Needs seeded demo data. */
export default defineConfig({
  testDir: './screenshots',
  timeout: 90_000,
  workers: 1,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:5173' },
});
