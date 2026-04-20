import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      screenshotFailures: false,
      server: {
        host: '127.0.0.1'
      }
    },
    expect: {
      poll: {
        interval: 5
      }
    },
    testTimeout: 2000,
    hookTimeout: 2000
  }
});
