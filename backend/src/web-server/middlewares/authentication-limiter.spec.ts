import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import AuthenticationLimiter from './authentication-limiter';

const MINUTE = 60 * 1000;

describe('AuthenticationLimiter', () => {
  let limiter: AuthenticationLimiter;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: 0 });
    limiter = new AuthenticationLimiter();
  });

  afterEach(() => {
    mock.timers.reset();
  });

  const fail = (times: number, ip: (index: number) => string, login: (index: number) => string) => {
    for (let i = 0; i < times; i++) {
      limiter.recordFailure(ip(i), login(i));
    }
  };

  it('should let an address and a login authenticate without failures', () => {
    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'admin'), 0);
  });

  it('should block an address after 10 failures until 15 minutes after the first one', () => {
    fail(
      9,
      () => '1.2.3.4',
      i => `login${i}`
    );
    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'admin'), 0);

    mock.timers.tick(5 * MINUTE);
    limiter.recordFailure('1.2.3.4', 'admin');

    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'admin'), 10 * 60);
    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'other'), 10 * 60);
    assert.strictEqual(limiter.retryAfter('5.6.7.8', 'other'), 0);

    mock.timers.tick(10 * MINUTE);
    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'admin'), 0);
  });

  it('should only limit the local addresses by login', () => {
    fail(
      10,
      () => '127.0.0.1',
      i => `login${i}`
    );

    assert.strictEqual(limiter.retryAfter('127.0.0.1', 'admin'), 0);
  });

  it('should block a login after 100 failures from any address', () => {
    fail(
      99,
      i => `10.0.0.${i}`,
      () => 'admin'
    );
    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'admin'), 0);

    limiter.recordFailure('1.2.3.4', 'admin');

    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'admin'), 15 * 60);
    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'other'), 0);
  });

  it('should count the failures again once the window ended', () => {
    fail(
      9,
      () => '1.2.3.4',
      () => 'admin'
    );
    mock.timers.tick(15 * MINUTE);

    limiter.recordFailure('1.2.3.4', 'admin');

    assert.strictEqual(limiter.retryAfter('1.2.3.4', 'admin'), 0);
  });

  it('should forget the ended windows', () => {
    limiter.recordFailure('1.2.3.4', 'admin');
    mock.timers.tick(15 * MINUTE);
    limiter.recordFailure('5.6.7.8', 'other');

    assert.deepStrictEqual([...limiter['failuresByIp'].keys()], ['5.6.7.8']);
    assert.deepStrictEqual([...limiter['failuresByLogin'].keys()], ['other']);
  });
});
