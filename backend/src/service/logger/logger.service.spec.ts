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
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: engineSettings.logParameters.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: engineSettings.logParameters.file.maxFileSize
        },
        level: engineSettings.logParameters.file.level
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: path.resolve('folder', 'logs.db'),
          maxNumberOfLogs: engineSettings.logParameters.database.maxNumberOfLogs
        },
        level: engineSettings.logParameters.database.level
      },
      {
        target: path.join(__dirname, 'oianalytics-transport.js'),
        options: {
          interval: engineSettings.logParameters.oia.interval,
          registrationSettings: registration,
          certsFolder: '',
          cryptoSettings: {}
        },
        level: engineSettings.logParameters.oia.level
      },
      {
        target: path.join(__dirname, 'syslog-transport.js'),
        options: {
          host: engineSettings.logParameters.syslog.host,
          port: engineSettings.logParameters.syslog.port,
          protocol: engineSettings.logParameters.syslog.protocol,
          appName: engineSettings.name
        },
        level: engineSettings.logParameters.syslog.level
      },
      {
        target: 'pino-loki',
        options: {
          batching: { interval: engineSettings.logParameters.loki.interval, maxBufferSize: 50000 },
          host: engineSettings.logParameters.loki.address,
          basicAuth: { username: engineSettings.logParameters.loki.username, password: engineSettings.logParameters.loki.password },
          labels: { name: engineSettings.name }
        },
        level: engineSettings.logParameters.loki.level
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
    specificSettings.logParameters.loki.password = '';
    specificSettings.logParameters.database.maxNumberOfLogs = 0;

    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: specificSettings.logParameters.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: engineSettings.logParameters.file.maxFileSize
        },
        level: specificSettings.logParameters.file.level
      },
      {
        target: path.join(__dirname, 'oianalytics-transport.js'),
        options: {
          interval: specificSettings.logParameters.oia.interval,
          registrationSettings: specificRegistration,
          certsFolder: '',
          cryptoSettings: {}
        },
        level: specificSettings.logParameters.oia.level
      },
      {
        target: path.join(__dirname, 'syslog-transport.js'),
        options: {
          host: specificSettings.logParameters.syslog.host,
          port: specificSettings.logParameters.syslog.port,
          protocol: specificSettings.logParameters.syslog.protocol,
          appName: specificSettings.name
        },
        level: specificSettings.logParameters.syslog.level
      },
      {
        target: 'pino-loki',
        options: {
          batching: {
            interval: specificSettings.logParameters.loki.interval,
            maxBufferSize: 50000
          },
          host: specificSettings.logParameters.loki.address,
          basicAuth: {
            username: specificSettings.logParameters.loki.username,
            password: specificSettings.logParameters.loki.password
          },
          labels: { name: specificSettings.name }
        },
        level: specificSettings.logParameters.loki.level
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
    specificSettings.logParameters.database.maxNumberOfLogs = 0;
    specificSettings.logParameters.loki.address = '';
    specificSettings.logParameters.syslog.host = '';

    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: specificSettings.logParameters.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: engineSettings.logParameters.file.maxFileSize
        },
        level: specificSettings.logParameters.file.level
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

  it('should add syslog transport when host is set and level is not silent', async () => {
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logParameters.database.maxNumberOfLogs = 0;
    specificSettings.logParameters.loki.address = '';
    specificSettings.logParameters.syslog.host = 'syslog.example.com';
    specificSettings.logParameters.syslog.level = 'info';

    await service.start(specificSettings, null);

    const targets: Array<{ target: string }> = pinoMock.mock.calls[0].arguments[0].transport.targets;
    const syslogTarget = targets.find(t => t.target === path.join(__dirname, 'syslog-transport.js'));
    assert.ok(syslogTarget !== undefined, 'syslog-transport.js target should be present');
  });

  it('should not add syslog transport when host is empty', async () => {
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logParameters.database.maxNumberOfLogs = 0;
    specificSettings.logParameters.loki.address = '';
    specificSettings.logParameters.syslog.host = '';

    await service.start(specificSettings, null);

    const targets: Array<{ target: string }> = pinoMock.mock.calls[0].arguments[0].transport.targets;
    const syslogTarget = targets.find(t => t.target === path.join(__dirname, 'syslog-transport.js'));
    assert.strictEqual(syslogTarget, undefined, 'syslog-transport.js target should not be present');
  });

  it('should not add syslog transport when level is silent', async () => {
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logParameters.database.maxNumberOfLogs = 0;
    specificSettings.logParameters.loki.address = '';
    specificSettings.logParameters.syslog.host = 'syslog.example.com';
    specificSettings.logParameters.syslog.level = 'silent';

    await service.start(specificSettings, null);

    const targets: Array<{ target: string }> = pinoMock.mock.calls[0].arguments[0].transport.targets;
    const syslogTarget = targets.find(t => t.target === path.join(__dirname, 'syslog-transport.js'));
    assert.strictEqual(syslogTarget, undefined, 'syslog-transport.js target should not be present');
  });
});
