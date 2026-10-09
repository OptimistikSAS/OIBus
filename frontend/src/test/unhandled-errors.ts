import { config } from 'rxjs';
import { onTestFinished, vi } from 'vitest';

/**
 * Components let the errors of their one-shot HTTP calls (save, delete...) propagate: the HTTP error interceptor already
 * notified the user, and RxJS reports them as unhandled errors (thrown asynchronously). Call this in a test that
 * simulates such a failure, so that the error is captured (and can be asserted) instead of failing the test run.
 * The RxJS configuration is restored when the test finishes.
 */
export function catchUnhandledErrors() {
  const onUnhandledError = vi.fn<(error: unknown) => void>();
  const previous = config.onUnhandledError;
  config.onUnhandledError = onUnhandledError;
  onTestFinished(() => {
    config.onUnhandledError = previous;
  });
  return onUnhandledError;
}
