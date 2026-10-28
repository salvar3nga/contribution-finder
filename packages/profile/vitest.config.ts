import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/test-support/global-setup.ts'],
    fileParallelism: false,
  },
});
