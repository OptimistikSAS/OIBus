import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    restoreMocks: true,
    browser: {
      screenshotFailures: false,
      api: {
        host: '127.0.0.1'
      },
      server: {
        host: '127.0.0.1'
      }
    },
    expect: {
      poll: {
        interval: 5
      }
    },
    testTimeout: 5000,
    hookTimeout: 5000
  }
});
