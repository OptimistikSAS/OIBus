import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { PinoLog } from '../../model/logs.model';
import { reloadModule } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import type { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import type { CryptoSettings } from '../../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

type OIAnalyticsOptions = {
  registrationSettings: OIAnalyticsRegistration;
  interval: number;
  batchLimit?: number;
  cryptoSettings: CryptoSettings;
  certsFolder: string;
};
type CreateTransport = (opts: OIAnalyticsOptions) => Promise<unknown>;

let createTransport: CreateTransport;

// Per-test mock functions — reassigned in beforeEach; stable wrappers in cache always delegate to the current one
let mockHTTPRequest: ReturnType<typeof mock.fn>;
let mockBuildHttpOptions: ReturnType<typeof mock.fn>;
let mockGetUrl: ReturnType<typeof mock.fn>;
let mockEncryptionInit: ReturnType<typeof mock.fn>;

let capturedSourceFn: ((source: AsyncIterable<PinoLog>) => Promise<void>) | null = null;
let capturedCloseFn: (() => Promise<void>) | null = null;

const baseRegistration: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
const baseCrypto: CryptoSettings = testData.engine.crypto;

const defaultOpts: OIAnalyticsOptions = {
  registrationSettings: baseRegistration,
  interval: 30,
  cryptoSettings: baseCrypto,
  certsFolder: '/certs'
};

// Drain microtasks without using setImmediate (which mock.timers also intercepts)
const drainMicrotasks = async (levels = 8) => {
  for (let i = 0; i < levels; i++) {
    await Promise.resolve();
  }
};

before(() => {
  // pino-abstract-transport: capture source and close handlers
  const buildMock = (
    sourceFn: (source: AsyncIterable<PinoLog>) => Promise<void>,
    opts: { close: () => Promise<void> }
  ) => {
    capturedSourceFn = sourceFn;
    capturedCloseFn = opts.close;
    return {};
  };
  nodeRequire('pino-abstract-transport');
  const pinoAbstractPath = nodeRequire.resolve('pino-abstract-transport');
  nodeRequire.cache[pinoAbstractPath]!.exports = { __esModule: true, default: buildMock };

  // encryption.service: stable stub whose init delegates to the per-test mock
  const encryptionStub = { init: (...args: unknown[]) => mockEncryptionInit(...args) };
  nodeRequire('../encryption.service');
  const encPath = nodeRequire.resolve('../encryption.service');
  nodeRequire.cache[encPath]!.exports = { __esModule: true, encryptionService: encryptionStub };

  // http-request.utils: wrapper that always calls the current per-test mock
  nodeRequire('../http-request.utils');
  const httpReqPath = nodeRequire.resolve('../http-request.utils');
  nodeRequire.cache[httpReqPath]!.exports = {
    __esModule: true,
    HTTPRequest: (...args: unknown[]) => mockHTTPRequest(...args)
  };

  // utils-oianalytics: wrappers for buildHttpOptions and getUrl
  nodeRequire('../utils-oianalytics');
  const utilsOiaPath = nodeRequire.resolve('../utils-oianalytics');
  nodeRequire.cache[utilsOiaPath]!.exports = {
    __esModule: true,
    buildHttpOptions: (...args: unknown[]) => mockBuildHttpOptions(...args),
    getUrl: (...args: unknown[]) => mockGetUrl(...args)
  };

  createTransport = reloadModule<{ default: CreateTransport }>(nodeRequire, './oianalytics-transport').default;
});

beforeEach(() => {
  mockHTTPRequest = mock.fn(async () => ({ statusCode: 200, body: { text: async () => '' } }));
  mockBuildHttpOptions = mock.fn(async () => ({ headers: {} as Record<string, string>, body: null }));
  mockGetUrl = mock.fn(() => 'http://example.com/api/oianalytics/oibus/logs');
  mockEncryptionInit = mock.fn(async () => undefined);
  capturedSourceFn = null;
  capturedCloseFn = null;
  mock.timers.enable({ apis: ['setInterval'] });
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

const makeLog = (
  msg: string,
  level = '30',
  scopeId: string | null = 'scope-1',
  scopeName: string | null = 'MyScope'
): PinoLog => ({
  msg,
  level,
  scopeType: 'internal',
  scopeId,
  scopeName,
  time: '2020-01-01T00:00:00.000Z'
});

async function* makeSource(logs: PinoLog[]): AsyncIterable<PinoLog> {
  for (const log of logs) yield log;
}

describe('OianalyticsTransport (createTransport)', () => {
  it('should initialise the transport, call encryptionService.init, and capture build handlers', async () => {
    await createTransport(defaultOpts);

    assert.ok(capturedSourceFn !== null, 'source handler should be captured');
    assert.ok(capturedCloseFn !== null, 'close handler should be captured');
    assert.strictEqual(mockEncryptionInit.mock.calls.length, 1);
  });

  it('should trim a trailing slash from the host on construction', async () => {
    const opts: OIAnalyticsOptions = {
      ...defaultOpts,
      registrationSettings: { ...baseRegistration, host: 'https://example.com/' }
    };
    await createTransport(opts);
    assert.ok(capturedSourceFn !== null);
  });

  it('should cap the interval at MAX_BATCH_INTERVAL_S (60s) when interval > 60', async () => {
    const opts: OIAnalyticsOptions = { ...defaultOpts, interval: 120 };
    await createTransport(opts);

    // Tick 60 000 ms — the interval fires and calls sendOIALogs
    // Note: mock.timers also intercepts setImmediate, so we use drainMicrotasks instead
    mock.timers.tick(60000);
    await drainMicrotasks();

    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1);
  });

  it('should use MAX_BATCH_INTERVAL_S when interval is 0 (falsy batchInterval fallback)', async () => {
    const opts: OIAnalyticsOptions = { ...defaultOpts, interval: 0 };
    await createTransport(opts);

    mock.timers.tick(60000);
    await drainMicrotasks();

    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1);
  });

  it('sendOIALogs should POST logs and succeed on 200 response', async () => {
    await createTransport(defaultOpts);
    await capturedSourceFn!(makeSource([makeLog('hello')]));

    await capturedCloseFn!();

    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1);
  });

  it('sendOIALogs should log console.error on 401 response', async () => {
    mockHTTPRequest = mock.fn(async () => ({
      statusCode: 401,
      body: { text: async () => 'Unauthorized' }
    }));
    const consoleSpy = mock.method(console, 'error', () => undefined);

    await createTransport(defaultOpts);
    await capturedSourceFn!(makeSource([makeLog('auth fail')]));
    await capturedCloseFn!();

    assert.ok(consoleSpy.mock.calls.some(c => String(c.arguments[0]).includes('authentication error')));
    mock.restoreAll();
  });

  it('sendOIALogs should log console.error on non-200/non-401 response', async () => {
    mockHTTPRequest = mock.fn(async () => ({
      statusCode: 500,
      body: { text: async () => 'Server Error' }
    }));
    const consoleSpy = mock.method(console, 'error', () => undefined);

    await createTransport(defaultOpts);
    await capturedSourceFn!(makeSource([makeLog('server error')]));
    await capturedCloseFn!();

    assert.ok(consoleSpy.mock.calls.some(c => String(c.arguments[0]).includes('fetch error')));
    mock.restoreAll();
  });

  it('sendOIALogs should log console.error when HTTPRequest throws a network error', async () => {
    mockHTTPRequest = mock.fn(async () => {
      throw new Error('network error');
    });
    const consoleSpy = mock.method(console, 'error', () => undefined);

    await createTransport(defaultOpts);
    await capturedSourceFn!(makeSource([makeLog('net err')]));
    await capturedCloseFn!();

    assert.ok(consoleSpy.mock.calls.some(c => String(c.arguments[0]).includes('Error when sending logs')));
    mock.restoreAll();
  });

  it('addLogs should return early when the transport is stopping', async () => {
    await createTransport(defaultOpts);
    await capturedCloseFn!(); // sets stopping=true
    const callsAfterClose = mockHTTPRequest.mock.calls.length;

    // Further source logs should be ignored because stopping=true
    await capturedSourceFn!(makeSource([makeLog('ignored')]));
    mock.timers.tick(30000);
    await drainMicrotasks();

    assert.strictEqual(mockHTTPRequest.mock.calls.length, callsAfterClose);
  });

  it('addLogs should use null when scopeId or scopeName is falsy', async () => {
    await createTransport(defaultOpts);
    await capturedSourceFn!(makeSource([makeLog('no scope', '30', null, null)]));
    await capturedCloseFn!();

    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1);
    const payload = JSON.parse((mockHTTPRequest.mock.calls[0].arguments[1] as { body: string }).body) as Array<{
      scopeId: string | null;
      scopeName: string | null;
    }>;
    assert.strictEqual(payload[0].scopeId, null);
    assert.strictEqual(payload[0].scopeName, null);
  });

  it('addLogs should trigger an immediate send and reschedule the interval when batch reaches batchLimit', async () => {
    const opts: OIAnalyticsOptions = { ...defaultOpts, batchLimit: 2 };
    await createTransport(opts);

    await capturedSourceFn!(makeSource([makeLog('log1'), makeLog('log2')]));

    // Immediate send happens synchronously within the source iteration (awaited)
    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1);

    // A new interval is rescheduled — ticking should trigger another send
    mock.timers.tick(30000);
    await drainMicrotasks();
    assert.strictEqual(mockHTTPRequest.mock.calls.length, 2);
  });

  it('addLogs should use default MAX_BATCH_LOG (500) when batchLimit is not provided', async () => {
    await createTransport(defaultOpts);

    const logs499 = Array.from({ length: 499 }, (_, i) => makeLog(`log ${i}`));
    await capturedSourceFn!(makeSource(logs499));
    assert.strictEqual(mockHTTPRequest.mock.calls.length, 0); // not yet at 500

    await capturedSourceFn!(makeSource([makeLog('log 500')]));
    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1); // 500th triggers flush
  });

  it('close handler should call sendOIALogs once and prevent further interval sends', async () => {
    await createTransport(defaultOpts);
    await capturedSourceFn!(makeSource([makeLog('final')]));

    await capturedCloseFn!();

    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1);

    // Interval tick after stop should not trigger more sends
    mock.timers.tick(30000);
    await drainMicrotasks();
    assert.strictEqual(mockHTTPRequest.mock.calls.length, 1);
  });
});
