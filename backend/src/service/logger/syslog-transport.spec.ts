import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { reloadModule } from '../../tests/utils/test-utils';
import type { SyslogTransportOptions } from './syslog-transport';

const nodeRequire = createRequire(import.meta.url);

type CreateTransport = (opts: SyslogTransportOptions) => Promise<unknown>;

let createTransport: CreateTransport;

// Per-test mocks initialised in beforeEach
let mockBuildOptions: ReturnType<typeof mock.fn>;
let mockMessageBuilderFactory: ReturnType<typeof mock.fn>;
let mockFormatMessage: ReturnType<typeof mock.fn>;
let mockSocketWrite: ReturnType<typeof mock.fn>;
let mockSocketDestroy: ReturnType<typeof mock.fn>;
let mockSocketTransport: ReturnType<typeof mock.fn>;

// Captured build() handlers
let capturedSourceFn: ((source: AsyncIterable<unknown>) => Promise<void>) | null = null;
let capturedCloseFn: (() => Promise<void>) | null = null;

before(() => {
  // Mock pino-syslog/lib/utils
  nodeRequire('pino-syslog/lib/utils');
  const utilsPath = nodeRequire.resolve('pino-syslog/lib/utils');
  nodeRequire.cache[utilsPath]!.exports = {
    buildOptions: (...args: Array<unknown>) => mockBuildOptions(...args)
  };

  // Mock pino-syslog/lib/rfc5424
  nodeRequire('pino-syslog/lib/rfc5424');
  const rfc5424Path = nodeRequire.resolve('pino-syslog/lib/rfc5424');
  nodeRequire.cache[rfc5424Path]!.exports = {
    messageBuilderFactory: (...args: Array<unknown>) => mockMessageBuilderFactory(...args)
  };

  // Mock pino-socket
  nodeRequire('pino-socket');
  const pinoSocketPath = nodeRequire.resolve('pino-socket');
  nodeRequire.cache[pinoSocketPath]!.exports = (...args: Array<unknown>) => mockSocketTransport(...args);

  // Mock pino-abstract-transport — captures sourceFn and closeFn
  const buildMock = (sourceFn: (source: AsyncIterable<unknown>) => Promise<void>, opts: { close: () => Promise<void> }) => {
    capturedSourceFn = sourceFn;
    capturedCloseFn = opts.close;
    return {};
  };
  nodeRequire('pino-abstract-transport');
  const pinoAbstractPath = nodeRequire.resolve('pino-abstract-transport');
  nodeRequire.cache[pinoAbstractPath]!.exports = { __esModule: true, default: buildMock };

  createTransport = reloadModule<{ default: CreateTransport }>(nodeRequire, './syslog-transport').default;
});

beforeEach(() => {
  mockSocketWrite = mock.fn();
  mockSocketDestroy = mock.fn();
  const mockSocket = { write: mockSocketWrite, destroy: mockSocketDestroy };
  mockSocketTransport = mock.fn(async () => mockSocket);
  mockFormatMessage = mock.fn((log: unknown) => `formatted:${JSON.stringify(log)}`);
  mockMessageBuilderFactory = mock.fn(() => mockFormatMessage);
  mockBuildOptions = mock.fn((opts: unknown) => opts);
  capturedSourceFn = null;
  capturedCloseFn = null;
});

afterEach(() => {
  mock.restoreAll();
});

describe('SyslogTransport (createTransport)', () => {
  const defaultOpts: SyslogTransportOptions = {
    host: 'syslog.example.com',
    port: 514,
    protocol: 'udp4',
    appName: 'OIBus'
  };

  it('should initialise the formatter and connect the socket on creation', async () => {
    await createTransport(defaultOpts);

    assert.strictEqual(mockBuildOptions.mock.calls.length, 1);
    assert.deepStrictEqual(mockBuildOptions.mock.calls[0].arguments[0], {
      appname: defaultOpts.appName,
      newline: true,
      enablePipelining: false
    });
    assert.strictEqual(mockMessageBuilderFactory.mock.calls.length, 1);
    assert.strictEqual(mockSocketTransport.mock.calls.length, 1);
    assert.deepStrictEqual(mockSocketTransport.mock.calls[0].arguments[0], {
      address: defaultOpts.host,
      port: defaultOpts.port,
      mode: defaultOpts.protocol,
      reconnect: true,
      sourceStream: false
    });
    assert.ok(capturedSourceFn !== null);
    assert.ok(capturedCloseFn !== null);
  });

  it('should log an error and continue when socket connection fails', async () => {
    mockSocketTransport = mock.fn(async () => {
      throw new Error('connection refused');
    });
    const consoleSpy = mock.method(console, 'error', () => undefined);

    await createTransport(defaultOpts);

    assert.strictEqual(consoleSpy.mock.calls.length, 1);
    assert.match(consoleSpy.mock.calls[0].arguments[0] as string, /^Failed to connect to syslog server at syslog\.example\.com:514/);
    mock.restoreAll();
  });

  it('source handler should format and write each log to the socket', async () => {
    await createTransport(defaultOpts);

    const log = { level: 30, msg: 'hello', time: 1000 };
    async function* makeSource() {
      yield log;
    }
    await capturedSourceFn!(makeSource());

    assert.strictEqual(mockFormatMessage.mock.calls.length, 1);
    assert.deepStrictEqual(mockFormatMessage.mock.calls[0].arguments[0], log);
    assert.strictEqual(mockSocketWrite.mock.calls.length, 1);
    assert.strictEqual(mockSocketWrite.mock.calls[0].arguments[0], `formatted:${JSON.stringify(log)}`);
  });

  it('source handler should silently skip writes when socket is null (connect failed)', async () => {
    mockSocketTransport = mock.fn(async () => {
      throw new Error('no connection');
    });
    mock.method(console, 'error', () => undefined);

    await createTransport(defaultOpts);

    const log = { level: 30, msg: 'lost' };
    async function* makeSource() {
      yield log;
    }
    await capturedSourceFn!(makeSource());

    assert.strictEqual(mockSocketWrite.mock.calls.length, 0);
    mock.restoreAll();
  });

  it('close handler should destroy the socket and clear the reference', async () => {
    await createTransport(defaultOpts);

    await capturedCloseFn!();

    assert.strictEqual(mockSocketDestroy.mock.calls.length, 1);
  });

  it('close handler should be a no-op when socket is null (connect failed)', async () => {
    mockSocketTransport = mock.fn(async () => {
      throw new Error('no connection');
    });
    mock.method(console, 'error', () => undefined);

    await createTransport(defaultOpts);
    await capturedCloseFn!();

    assert.strictEqual(mockSocketDestroy.mock.calls.length, 0);
    mock.restoreAll();
  });

  it('second call to end() should be a no-op (socket already nulled)', async () => {
    await createTransport(defaultOpts);

    await capturedCloseFn!(); // destroys socket, sets socket = null
    await capturedCloseFn!(); // second call — socket is null, should not throw

    assert.strictEqual(mockSocketDestroy.mock.calls.length, 1);
  });
});
