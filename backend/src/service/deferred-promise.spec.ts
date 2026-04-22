import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import DeferredPromise from './deferred-promise';

describe('DeferredPromise', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('it should resolve', async () => {
    const callback = mock.fn();
    const deferredPromise$ = new DeferredPromise();

    setTimeout(() => {
      deferredPromise$.resolve();
    }, 1000);

    deferredPromise$.promise.then(() => {
      callback();
    });

    mock.timers.tick(500);
    assert.strictEqual(callback.mock.calls.length, 0);

    mock.timers.tick(500);

    await deferredPromise$.promise;
    assert.strictEqual(callback.mock.calls.length, 1);
  });

  it('it should reject', async () => {
    const callback = mock.fn();
    const deferredPromise$ = new DeferredPromise();

    setTimeout(() => {
      deferredPromise$.reject(new Error('promise error'));
    }, 1000);

    let caughtError: Error | null = null;
    deferredPromise$.promise
      .then(() => {
        callback();
      })
      .catch(err => {
        caughtError = err;
      });

    mock.timers.tick(500);
    assert.strictEqual(callback.mock.calls.length, 0);

    mock.timers.tick(500);
    assert.strictEqual(callback.mock.calls.length, 0);

    // Wait for promise rejection to be handled
    await new Promise(resolve => setImmediate(resolve));
    assert.deepStrictEqual(caughtError, new Error('promise error'));
  });
});
