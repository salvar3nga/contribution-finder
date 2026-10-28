import { defineConfig } from '@playwright/test';

const port = 3100;
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://cf:cf@localhost:5432/contribution_finder_test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `pnpm exec tsx e2e/seed.mts && pnpm exec next build && pnpm exec next start --port ${port}`,
    url: `http://localhost:${port}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      FAKE_PROFILE_SOURCE: '1',
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
