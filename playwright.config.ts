import { defineConfig, devices } from '@playwright/test';

// One smoke test against `vite preview` of a production build, so the real service worker runs.
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['iPhone 15'],
    browserName: 'chromium',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
