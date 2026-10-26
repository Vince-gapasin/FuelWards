import { defineConfig, devices } from '@playwright/test';

// Web end-to-end tests. They run against the static web build (npm run build:web) served from
// dist/. In CI the build points at the local Supabase started by `supabase start`, so tests never
// touch the hosted project.
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e/web',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Makati, so "near me" searches have nearby stations.
    geolocation: { latitude: 14.5547, longitude: 121.0244 },
    permissions: ['geolocation'],
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx serve -s dist -l ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
