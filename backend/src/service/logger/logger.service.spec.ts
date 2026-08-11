import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import type { EngineSettings } from '../../model/engine.model';
import type { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import type { ILogger } from '../../model/logger.model';
import type LoggerServiceType from './logger.service';
import type FileCleanupServiceType from './file-cleanup.service';

const nodeRequire = createRequire(import.meta.url);

let LoggerService: typeof LoggerServiceType;
let encryptionMock: EncryptionServiceMock;
let pinoMock: ReturnType<typeof mock.fn>;
let pinoTransportMock: ReturnType<typeof mock.fn>;
let mockTransportFlush: ReturnType<typeof mock.fn>;
let mockTransportEnd: ReturnType<typeof mock.fn>;
let isoTimeFn: () => string;
let service: LoggerServiceType;

before(async () => {
  isoTimeFn = () => '';
  // Self-referential `child` so subsequent .child() calls (e.g. for node-opcua scope) work too.
  // Plain function (not mock.fn) so it survives `mock.restoreAll()` between tests.
  const mockPinoInstance: { child: (...args: Array<unknown>) => unknown } = { child: () => mockPinoInstance };
  pinoMock = mock.fn(() => mockPinoInstance);
  (pinoMock as unknown as { stdTimeFunctions: { isoTime: () => string } }).stdTimeFunctions = { isoTime: isoTimeFn };

  // Mock pino.transport so logger.service can hold a transport reference for proper shutdown.
  mockTransportFlush = mock.fn((cb?: (err?: Error) => void) => {
    if (cb) cb();
  });
  mockTransportEnd = mock.fn();
  pinoTransportMock = mock.fn(() => ({ flush: mockTransportFlush, end: mockTransportEnd }));
  (pinoMock as unknown as { transport: typeof pinoTransportMock }).transport = pinoTransportMock;

  // Replace pino in require cache with the mock
  nodeRequire('pino');
  const pinoPath = nodeRequire.resolve('pino');
  nodeRequire.cache[pinoPath]!.exports = pinoMock;

  // Replace encryption service in require cache with a mock instance
  encryptionMock = new EncryptionServiceMock('', '');
  nodeRequire('../encryption.service');
  const encPath = nodeRequire.resolve('../encryption.service');
  nodeRequire.cache[encPath]!.exports = { __esModule: true, encryptionService: encryptionMock };

  // Replace FileCleanupService in require cache with a mock constructor
  // mock.fn() cannot be used with `new`, so use a plain constructor function
  function fileCleanupCtorMock(this: { start: ReturnType<typeof mock.fn>; stop: ReturnType<typeof mock.fn> }) {
    this.start = mock.fn(async () => undefined);
    this.stop = mock.fn();
  }
  nodeRequire('./file-cleanup.service');
  const fcPath = nodeRequire.resolve('./file-cleanup.service');
  nodeRequire.cache[fcPath]!.exports = { __esModule: true, default: fileCleanupCtorMock };

  // Force logger.service to reload with mocked dependencies
  const lsPath = nodeRequire.resolve('./logger.service');
  delete nodeRequire.cache[lsPath];
  LoggerService = nodeRequire('./logger.service').default;
});

beforeEach(() => {
  pinoMock.mock.resetCalls();
  pinoTransportMock.mock.resetCalls();
  mockTransportFlush.mock.resetCalls();
  mockTransportEnd.mock.resetCalls();
  encryptionMock.decryptText.mock.resetCalls();
  service = new LoggerService();
  service.init('folder');
});

afterEach(() => {
  mock.restoreAll();
});

describe('Logger', () => {
  const engineSettings = testData.engine.settings;
  const registration = testData.oIAnalytics.registration.completed;

  it('should be properly initialized', async () => {
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: engineSettings.logger.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: engineSettings.logger.file.maxFileSize
        },
        level: engineSettings.logger.file.level
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: path.resolve('folder', 'logs.db'),
          maxNumberOfLogs: engineSettings.logger.database.maxNumberOfLogs
        },
        level: engineSettings.logger.database.level
      },
      {
        target: path.join(__dirname, 'oianalytics-transport.js'),
        options: {
          interval: engineSettings.logger.oia.interval,
          registrationSettings: registration,
          certsFolder: '',
          cryptoSettings: {}
        },
        level: engineSettings.logger.oia.level
      },
      {
        target: path.join(__dirname, 'syslog-transport.js'),
        options: {
          host: engineSettings.logger.syslog.host,
          port: engineSettings.logger.syslog.port,
          protocol: engineSettings.logger.syslog.protocol,
          appName: engineSettings.general.name
        },
        level: engineSettings.logger.syslog.level
      },
      {
        target: 'pino-loki',
        options: {
          batching: { interval: engineSettings.logger.loki.interval, maxBufferSize: 50000 },
          host: engineSettings.logger.loki.address,
          basicAuth: { username: engineSettings.logger.loki.username, password: engineSettings.logger.loki.password },
          labels: { name: engineSettings.general.name }
        },
        level: engineSettings.logger.loki.level
      }
    ];

    await service.start(engineSettings, registration);

    assert.strictEqual(pinoTransportMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoTransportMock.mock.calls[0].arguments[0], { targets: expectedTargets });
    assert.strictEqual(pinoMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoMock.mock.calls[0].arguments[0], {
      base: undefined,
      level: 'info',
      timestamp: isoTimeFn
    });
  });

  it('should be properly initialized with loki error and standard file names', async () => {
    const consoleErrorMock = mock.method(console, 'error', mock.fn());

    encryptionMock.decryptText.mock.mockImplementationOnce(() => {
      throw new Error('decrypt-error');
    });

    await service.start(engineSettings, registration);

    assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleErrorMock.mock.calls[0].arguments, [new Error('decrypt-error')]);
  });

  it('should be properly initialized without loki password, without oia token and without sqliteLog', async () => {
    mock.method(console, 'error', mock.fn());

    const specificRegistration: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed));
    specificRegistration.proxyPassword = 'proxyPassword';
    specificRegistration.token = '';
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logger.loki.password = '';
    specificSettings.logger.database.maxNumberOfLogs = 0;

    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: specificSettings.logger.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: engineSettings.logger.file.maxFileSize
        },
        level: specificSettings.logger.file.level
      },
      {
        target: path.join(__dirname, 'oianalytics-transport.js'),
        options: {
          interval: specificSettings.logger.oia.interval,
          registrationSettings: specificRegistration,
          certsFolder: '',
          cryptoSettings: {}
        },
        level: specificSettings.logger.oia.level
      },
      {
        target: path.join(__dirname, 'syslog-transport.js'),
        options: {
          host: specificSettings.logger.syslog.host,
          port: specificSettings.logger.syslog.port,
          protocol: specificSettings.logger.syslog.protocol,
          appName: specificSettings.general.name
        },
        level: specificSettings.logger.syslog.level
      },
      {
        target: 'pino-loki',
        options: {
          batching: {
            interval: specificSettings.logger.loki.interval,
            maxBufferSize: 50000
          },
          host: specificSettings.logger.loki.address,
          basicAuth: {
            username: specificSettings.logger.loki.username,
            password: specificSettings.logger.loki.password
          },
          labels: { name: specificSettings.general.name }
        },
        level: specificSettings.logger.loki.level
      }
    ];

    await service.start(specificSettings, specificRegistration);

    assert.strictEqual(pinoTransportMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoTransportMock.mock.calls[0].arguments[0], { targets: expectedTargets });
    assert.strictEqual(pinoMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoMock.mock.calls[0].arguments[0], {
      base: undefined,
      level: 'info',
      timestamp: isoTimeFn
    });
  });

  it('should be properly initialized without lokiLog, nor oianalytics nor sqliteLog', async () => {
    mock.method(console, 'error', mock.fn());

    const specificRegistration: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.engine.settings));
    specificRegistration.status = 'NOT_REGISTERED';
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logger.database.maxNumberOfLogs = 0;
    specificSettings.logger.loki.address = '';
    specificSettings.logger.syslog.host = '';

    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: specificSettings.logger.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: engineSettings.logger.file.maxFileSize
        },
        level: specificSettings.logger.file.level
      }
    ];

    await service.start(specificSettings, specificRegistration);

    assert.strictEqual(pinoTransportMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoTransportMock.mock.calls[0].arguments[0], { targets: expectedTargets });
    assert.strictEqual(pinoMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoMock.mock.calls[0].arguments[0], {
      base: undefined,
      level: 'info',
      timestamp: isoTimeFn
    });
  });

  it('should create proxy loggers that route log calls through the root logger', () => {
    const childMock = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    const rootLoggerMock: ILogger = { ...new PinoLogger(), child: childMock };
    (service as unknown as { _rawLogger: ILogger })._rawLogger = rootLoggerMock;

    const proxy = service.createChildLogger('south', 'id1', 'name1');
    proxy.info('test'); // triggers current getter → root.child(bindings)

    assert.strictEqual(childMock.mock.calls.length, 1);
    assert.deepStrictEqual(childMock.mock.calls[0].arguments[0], { scopeType: 'south', scopeId: 'id1', scopeName: 'name1' });
  });

  it('should self-heal proxy loggers after a logger restart', () => {
    const child1 = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    const root1: ILogger = { ...new PinoLogger(), child: child1 };
    (service as unknown as { _rawLogger: ILogger })._rawLogger = root1;

    const proxy = service.createChildLogger('south');
    proxy.info('first log'); // binds to root1

    assert.strictEqual(child1.mock.calls.length, 1);

    // Simulate restart: swap root logger
    const child2 = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    const root2: ILogger = { ...new PinoLogger(), child: child2 };
    (service as unknown as { _rawLogger: ILogger })._rawLogger = root2;

    proxy.info('second log'); // should re-bind to root2

    assert.strictEqual(child2.mock.calls.length, 1);
    assert.deepStrictEqual(child2.mock.calls[0].arguments[0], { scopeType: 'south', scopeId: undefined, scopeName: undefined });
  });

  it('should drop log calls silently when the logger is stopped', () => {
    const root: ILogger = { ...new PinoLogger() };
    (service as unknown as { _rawLogger: ILogger })._rawLogger = root;
    const proxy = service.createChildLogger('internal');

    (service as unknown as { _rawLogger: null })._rawLogger = null;

    assert.doesNotThrow(() => proxy.info('dropped'));
    assert.strictEqual(proxy.isLevelEnabled('info'), false);
  });

  it('should drop log calls silently after a restart sets the root logger back to null', () => {
    const childMock = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    const root: ILogger = { ...new PinoLogger(), child: childMock };
    (service as unknown as { _rawLogger: ILogger })._rawLogger = root;
    const proxy = service.createChildLogger('internal');

    // First call binds the proxy to the non-null root.
    proxy.info('first log');
    assert.strictEqual(childMock.mock.calls.length, 1);

    // Root is cleared (e.g. logger stopped) - the proxy must re-resolve to null and stop calling child().
    (service as unknown as { _rawLogger: null })._rawLogger = null;

    assert.doesNotThrow(() => proxy.info('dropped after restart'));
    assert.strictEqual(childMock.mock.calls.length, 1);
  });

  it('should route trace, debug, warn, error and fatal calls through the root logger', () => {
    const childLogger = new PinoLogger();
    const childMock = mock.fn((_bindings: Record<string, unknown>): ILogger => childLogger);
    const root: ILogger = { ...new PinoLogger(), child: childMock };
    (service as unknown as { _rawLogger: ILogger })._rawLogger = root;
    const proxy = service.createChildLogger('internal');

    proxy.trace('trace message');
    proxy.debug('debug message');
    proxy.warn('warn message');
    proxy.error('error message');
    proxy.fatal('fatal message');

    assert.deepStrictEqual(childLogger.trace.mock.calls[0].arguments, ['trace message', undefined]);
    assert.deepStrictEqual(childLogger.debug.mock.calls[0].arguments, ['debug message', undefined]);
    assert.deepStrictEqual(childLogger.warn.mock.calls[0].arguments, ['warn message', undefined]);
    assert.deepStrictEqual(childLogger.error.mock.calls[0].arguments, ['error message', undefined]);
    assert.deepStrictEqual(childLogger.fatal.mock.calls[0].arguments, ['fatal message', undefined]);
  });

  it('should return the real isLevelEnabled result when a root logger is set', () => {
    const childLogger = new PinoLogger();
    childLogger.isLevelEnabled.mock.mockImplementation(() => true);
    const root: ILogger = { ...new PinoLogger(), child: () => childLogger };
    (service as unknown as { _rawLogger: ILogger })._rawLogger = root;
    const proxy = service.createChildLogger('internal');

    assert.strictEqual(proxy.isLevelEnabled('info'), true);
  });

  it('should properly stop logger and flush the transport', async () => {
    // No-op when transport is null
    await service.stop();

    // With fileCleanUpService and a mock transport
    const stopMock = mock.fn();
    service.fileCleanUpService = { stop: stopMock } as unknown as FileCleanupServiceType;
    const flushMock = mock.fn((cb?: (err?: Error) => void) => {
      if (cb) cb();
    });
    const endMock = mock.fn();
    (service as unknown as { _transport: unknown })._transport = { flush: flushMock, end: endMock };

    await service.stop();

    assert.strictEqual(stopMock.mock.calls.length, 1);
    assert.strictEqual(flushMock.mock.calls.length, 1);
    assert.strictEqual(endMock.mock.calls.length, 1);
    assert.strictEqual(service.rootLogger, null);
  });

  it('should skip silent targets when computing the most-verbose parent level', async () => {
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logger.console.level = 'silent';
    specificSettings.logger.database.maxNumberOfLogs = 0;
    specificSettings.logger.loki.address = '';
    specificSettings.logger.syslog.host = '';

    await service.start(specificSettings, null);

    // console (silent) is skipped, so the parent level falls back to the file level.
    assert.deepStrictEqual(pinoMock.mock.calls[0]!.arguments[0], {
      base: undefined,
      level: specificSettings.logger.file.level,
      timestamp: isoTimeFn
    });
  });

  it('should return the same in-flight promise when stop is called concurrently', async () => {
    const stopMock = mock.fn();
    service.fileCleanUpService = { stop: stopMock } as unknown as FileCleanupServiceType;
    const flushMock = mock.fn((cb?: (err?: Error) => void) => {
      if (cb) cb();
    });
    const endMock = mock.fn();
    (service as unknown as { _transport: unknown })._transport = { flush: flushMock, end: endMock };

    const firstStop = service.stop();
    const secondStop = service.stop();
    assert.strictEqual(firstStop, secondStop);

    await firstStop;
    assert.strictEqual(stopMock.mock.calls.length, 1);
    assert.strictEqual(flushMock.mock.calls.length, 1);
  });

  it('should add syslog transport when host is set and level is not silent', async () => {
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logger.database.maxNumberOfLogs = 0;
    specificSettings.logger.loki.address = '';
    specificSettings.logger.syslog.host = 'syslog.example.com';
    specificSettings.logger.syslog.level = 'info';

    await service.start(specificSettings, null);

    const targets: Array<{ target: string }> = pinoTransportMock.mock.calls[0].arguments[0].targets;
    const syslogTarget = targets.find(t => t.target === path.join(__dirname, 'syslog-transport.js'));
    assert.ok(syslogTarget !== undefined, 'syslog-transport.js target should be present');
  });

  it('should not add syslog transport when host is empty', async () => {
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logger.database.maxNumberOfLogs = 0;
    specificSettings.logger.loki.address = '';
    specificSettings.logger.syslog.host = '';

    await service.start(specificSettings, null);

    const targets: Array<{ target: string }> = pinoTransportMock.mock.calls[0].arguments[0].targets;
    const syslogTarget = targets.find(t => t.target === path.join(__dirname, 'syslog-transport.js'));
    assert.strictEqual(syslogTarget, undefined, 'syslog-transport.js target should not be present');
  });

  it('should not add syslog transport when level is silent', async () => {
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logger.database.maxNumberOfLogs = 0;
    specificSettings.logger.loki.address = '';
    specificSettings.logger.syslog.host = 'syslog.example.com';
    specificSettings.logger.syslog.level = 'silent';

    await service.start(specificSettings, null);

    const targets: Array<{ target: string }> = pinoTransportMock.mock.calls[0].arguments[0].targets;
    const syslogTarget = targets.find(t => t.target === path.join(__dirname, 'syslog-transport.js'));
    assert.strictEqual(syslogTarget, undefined, 'syslog-transport.js target should not be present');
  });
});
