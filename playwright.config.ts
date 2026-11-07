import { defineConfig, devices } from '@playwright/test';

// One smoke test against `vite preview` of a production build, so the real service worker runs.
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    // 127.0.0.1, not localhost: Spotify takes only the loopback IP as a redirect (package 7's music spec signs in here)
    baseURL: 'http://127.0.0.1:4173',
    ...devices['iPhone 15'],
    browserName: 'chromium',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
