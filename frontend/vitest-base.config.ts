import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    restoreMocks: true,
    browser: {
      screenshotFailures: false,
      // Pin both the API/orchestrator server (the URL Playwright navigates to) and the underlying
      // vite server to 127.0.0.1. On hosts where "localhost" resolves to IPv6 (::1) first while the
      // server binds IPv4, headless Chromium fails with net::ERR_SOCKET_NOT_CONNECTED.
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
    testTimeout: 2000,
    hookTimeout: 2000
  }
});
