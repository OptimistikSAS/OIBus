import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { EngineSettings } from '../../model/engine.model';
import type { ILogger } from '../../model/logger.model';
import type { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type FileCleanupServiceType from './file-cleanup.service';
import type LoggerServiceType from './logger.service';

const nodeRequire = createRequire(import.meta.url);

class FileCleanupServiceMock {
  start = mock.fn(async () => undefined);
  stop = mock.fn();
}

const isoTime = () => '';
// Self-referential `child` so subsequent .child() calls (e.g. for node-opcua scope) work too.
const pinoInstance: { child: () => unknown } = { child: () => pinoInstance };

// Mocked module exports: the same objects for the whole file, their values are replaced before each test
const pinoExports: { __esModule: true; default: unknown } = { __esModule: true, default: undefined };
const encryptionExports = { __esModule: true, encryptionService: new EncryptionServiceMock('', '') };

let LoggerService: typeof LoggerServiceType;

before(() => {
  mockModule(nodeRequire, 'pino', pinoExports);
  mockModule(nodeRequire, '../encryption.service', encryptionExports);
  mockModule(nodeRequire, './file-cleanup.service', { __esModule: true, default: FileCleanupServiceMock });
  LoggerService = reloadModule<{ default: typeof LoggerServiceType }>(nodeRequire, './logger.service').default;
});

describe('Logger', () => {
  const engineSettings = testData.engine.settings;
  const registration = testData.oIAnalytics.registration.completed;
  const syslogTarget = path.join(__dirname, 'syslog-transport.js');

  let service: LoggerServiceType;
  let encryptionService: EncryptionServiceMock;
  let transport: {
    flush: Mock<(cb?: (err?: Error) => void) => void>;
    end: Mock<() => void>;
    on: Mock<(event: string, handler: (error: Error) => void) => void>;
  };
  let pinoTransport: Mock<(options: { targets: Array<{ target: string }> }) => typeof transport>;
  let pino: Mock<(options: unknown) => typeof pinoInstance>;

  // Private state of the service, set directly by the proxy and stop tests
  const internals = () => service as unknown as { _rawLogger: ILogger | null; _transport: typeof transport };

  // Settings with only the console and file transports (no database, loki nor syslog)
  const consoleAndFileSettings = (): EngineSettings => {
    const settings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    settings.logger.database.maxNumberOfLogs = 0;
    settings.logger.loki.address = '';
    settings.logger.syslog.host = '';
    return settings;
  };

  const assertPinoCreatedWithLevel = (level: string) => {
    assert.strictEqual(pino.mock.calls.length, 1);
    assert.deepStrictEqual(pino.mock.calls[0].arguments[0], { base: undefined, level, timestamp: isoTime });
  };

  const transportTargets = () => pinoTransport.mock.calls[0].arguments[0].targets;

  beforeEach(() => {
    transport = {
      flush: mock.fn((cb?: (err?: Error) => void) => cb?.()),
      end: mock.fn(),
      on: mock.fn((_event: string, _handler: (error: Error) => void) => undefined)
    };
    pinoTransport = mock.fn((_options: { targets: Array<{ target: string }> }) => transport);
    pino = mock.fn((_options: unknown) => pinoInstance);
    pinoExports.default = Object.assign(pino, { transport: pinoTransport, stdTimeFunctions: { isoTime } });
    encryptionService = new EncryptionServiceMock('', '');
    encryptionExports.encryptionService = encryptionService;

    service = new LoggerService();
    service.init('folder');
  });

  afterEach(() => {
    mock.restoreAll();
  });

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
        target: syslogTarget,
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

    assert.strictEqual(pinoTransport.mock.calls.length, 1);
    assert.deepStrictEqual(pinoTransport.mock.calls[0].arguments[0], { targets: expectedTargets });
    assertPinoCreatedWithLevel('info');
  });

  it('should be properly initialized with loki error and standard file names', async () => {
    const consoleErrorMock = mock.method(console, 'error', mock.fn());

    encryptionService.decryptText.mock.mockImplementationOnce(() => {
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
        target: syslogTarget,
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

    assert.strictEqual(pinoTransport.mock.calls.length, 1);
    assert.deepStrictEqual(pinoTransport.mock.calls[0].arguments[0], { targets: expectedTargets });
    assertPinoCreatedWithLevel('info');
  });

  it('should be properly initialized without lokiLog, nor oianalytics nor sqliteLog', async () => {
    mock.method(console, 'error', mock.fn());

    const specificRegistration: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.engine.settings));
    specificRegistration.status = 'NOT_REGISTERED';
    const specificSettings = consoleAndFileSettings();

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

    assert.strictEqual(pinoTransport.mock.calls.length, 1);
    assert.deepStrictEqual(pinoTransport.mock.calls[0].arguments[0], { targets: expectedTargets });
    assertPinoCreatedWithLevel('info');
  });

  it('should create proxy loggers that route log calls through the root logger', () => {
    const childMock = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    internals()._rawLogger = { ...new PinoLogger(), child: childMock };

    const proxy = service.createChildLogger('south', 'id1', 'name1');
    proxy.info('test'); // triggers current getter → root.child(bindings)

    assert.strictEqual(childMock.mock.calls.length, 1);
    assert.deepStrictEqual(childMock.mock.calls[0].arguments[0], { scopeType: 'south', scopeId: 'id1', scopeName: 'name1' });
  });

  it('should self-heal proxy loggers after a logger restart', () => {
    const child1 = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    internals()._rawLogger = { ...new PinoLogger(), child: child1 };

    const proxy = service.createChildLogger('south');
    proxy.info('first log'); // binds to root1

    assert.strictEqual(child1.mock.calls.length, 1);

    // Simulate restart: swap root logger
    const child2 = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    internals()._rawLogger = { ...new PinoLogger(), child: child2 };

    proxy.info('second log'); // should re-bind to root2

    assert.strictEqual(child2.mock.calls.length, 1);
    assert.deepStrictEqual(child2.mock.calls[0].arguments[0], { scopeType: 'south', scopeId: undefined, scopeName: undefined });
  });

  it('should drop log calls silently when the logger is stopped', () => {
    internals()._rawLogger = { ...new PinoLogger() };
    const proxy = service.createChildLogger('internal');

    internals()._rawLogger = null;

    assert.doesNotThrow(() => proxy.info('dropped'));
    assert.strictEqual(proxy.isLevelEnabled('info'), false);
  });

  it('should drop log calls silently after a restart sets the root logger back to null', () => {
    const childMock = mock.fn((_bindings: Record<string, unknown>): ILogger => new PinoLogger());
    internals()._rawLogger = { ...new PinoLogger(), child: childMock };
    const proxy = service.createChildLogger('internal');

    // First call binds the proxy to the non-null root.
    proxy.info('first log');
    assert.strictEqual(childMock.mock.calls.length, 1);

    // Root is cleared (e.g. logger stopped) - the proxy must re-resolve to null and stop calling child().
    internals()._rawLogger = null;

    assert.doesNotThrow(() => proxy.info('dropped after restart'));
    assert.strictEqual(childMock.mock.calls.length, 1);
  });

  it('should route trace, debug, warn, error and fatal calls through the root logger', () => {
    const childLogger = new PinoLogger();
    internals()._rawLogger = { ...new PinoLogger(), child: () => childLogger };
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
    internals()._rawLogger = { ...new PinoLogger(), child: () => childLogger };
    const proxy = service.createChildLogger('internal');

    assert.strictEqual(proxy.isLevelEnabled('info'), true);
  });

  it('should properly stop logger and flush the transport', async () => {
    // No-op when transport is null
    await service.stop();

    // With fileCleanUpService and a mock transport
    const fileCleanUpService = createMock<FileCleanupServiceType>();
    service.fileCleanUpService = fileCleanUpService;
    internals()._transport = transport;

    await service.stop();

    assert.strictEqual(fileCleanUpService.stop.mock.calls.length, 1);
    assert.strictEqual(transport.flush.mock.calls.length, 1);
    assert.strictEqual(transport.end.mock.calls.length, 1);
    assert.strictEqual(service.rootLogger, null);
  });

  it('should handle transport errors instead of letting them crash the process', async () => {
    const consoleErrorMock = mock.method(console, 'error', () => undefined);
    await service.start(engineSettings, null);

    assert.strictEqual(transport.on.mock.calls.length, 1);
    const [event, handler] = transport.on.mock.calls[0]!.arguments;
    assert.strictEqual(event, 'error');
    handler(new Error('end() took too long (10s)'));
    assert.deepStrictEqual(consoleErrorMock.mock.calls[0]!.arguments, ['Logger transport error: end() took too long (10s)']);
  });

  it('should skip silent targets when computing the most-verbose parent level', async () => {
    const specificSettings = consoleAndFileSettings();
    specificSettings.logger.console.level = 'silent';

    await service.start(specificSettings, null);

    // console (silent) is skipped, so the parent level falls back to the file level.
    assertPinoCreatedWithLevel(specificSettings.logger.file.level);
  });

  it('should return the same in-flight promise when stop is called concurrently', async () => {
    const fileCleanUpService = createMock<FileCleanupServiceType>();
    service.fileCleanUpService = fileCleanUpService;
    internals()._transport = transport;

    const firstStop = service.stop();
    const secondStop = service.stop();
    assert.strictEqual(firstStop, secondStop);

    await firstStop;
    assert.strictEqual(fileCleanUpService.stop.mock.calls.length, 1);
    assert.strictEqual(transport.flush.mock.calls.length, 1);
  });

  it('should add syslog transport when host is set and level is not silent', async () => {
    const specificSettings = consoleAndFileSettings();
    specificSettings.logger.syslog.host = 'syslog.example.com';
    specificSettings.logger.syslog.level = 'info';

    await service.start(specificSettings, null);

    assert.ok(
      transportTargets().find(t => t.target === syslogTarget),
      'syslog-transport.js target should be present'
    );
  });

  it('should not add syslog transport when host is empty', async () => {
    await service.start(consoleAndFileSettings(), null);

    assert.strictEqual(
      transportTargets().find(t => t.target === syslogTarget),
      undefined,
      'syslog-transport.js target should not be present'
    );
  });

  it('should not add syslog transport when level is silent', async () => {
    const specificSettings = consoleAndFileSettings();
    specificSettings.logger.syslog.host = 'syslog.example.com';
    specificSettings.logger.syslog.level = 'silent';

    await service.start(specificSettings, null);

    assert.strictEqual(
      transportTargets().find(t => t.target === syslogTarget),
      undefined,
      'syslog-transport.js target should not be present'
    );
  });
});
