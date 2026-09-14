import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    restoreMocks: true,
    // `browser.api` was deprecated in Vitest 5 in favor of the top-level `api` option.
    api: {
      host: '127.0.0.1'
    },
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
    testTimeout: 5000,
    hookTimeout: 5000,
    isolate: true
  }
});
