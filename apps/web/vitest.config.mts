import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    globalSetup: ['./lib/test-support/global-setup.ts'],
    fileParallelism: false,
  },
});
