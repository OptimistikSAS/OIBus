import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import testData from '../../tests/utils/test-data';
import type { EngineSettings } from '../../model/engine.model';
import type { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import type LoggerServiceType from './logger.service';
import type FileCleanupServiceType from './file-cleanup.service';

const nodeRequire = createRequire(import.meta.url);

let LoggerService: typeof LoggerServiceType;
let encryptionMock: EncryptionServiceMock;
let pinoMock: ReturnType<typeof mock.fn>;
let isoTimeFn: () => string;
let service: LoggerServiceType;

before(async () => {
  isoTimeFn = () => '';
  const mockChild = mock.fn(() => null);
  const mockPinoInstance = { child: mockChild };
  pinoMock = mock.fn(() => mockPinoInstance);
  (pinoMock as unknown as { stdTimeFunctions: { isoTime: () => string } }).stdTimeFunctions = { isoTime: isoTimeFn };

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
  encryptionMock.decryptText.mock.resetCalls();
  service = new LoggerService('folder');
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
        target: 'pino-loki',
        options: {
          batching: {
            interval: engineSettings.logParameters.loki.interval,
            maxBufferSize: 50000
          },
          host: engineSettings.logParameters.loki.address,
          basicAuth: {
            username: engineSettings.logParameters.loki.username,
            password: engineSettings.logParameters.loki.password
          },
          labels: { name: engineSettings.name }
        },
        level: engineSettings.logParameters.loki.level
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
      }
    ];

    await service.start(engineSettings, registration);

    assert.strictEqual(pinoMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoMock.mock.calls[0].arguments, [
      {
        base: undefined,
        level: 'trace',
        timestamp: isoTimeFn,
        transport: { targets: expectedTargets }
      }
    ]);
  });

  it('should be properly initialized with loki error and standard file names', async () => {
    mock.method(console, 'error', mock.fn());

    encryptionMock.decryptText.mock.mockImplementationOnce(() => {
      throw new Error('decrypt-error');
    });

    await service.start(engineSettings, registration);

    assert.strictEqual((console.error as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.deepStrictEqual((console.error as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [new Error('decrypt-error')]);
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
      }
    ];

    await service.start(specificSettings, specificRegistration);

    assert.strictEqual(pinoMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoMock.mock.calls[0].arguments, [
      {
        base: undefined,
        level: 'trace',
        timestamp: isoTimeFn,
        transport: { targets: expectedTargets }
      }
    ]);
  });

  it('should be properly initialized without lokiLog, nor oianalytics nor sqliteLog', async () => {
    mock.method(console, 'error', mock.fn());

    const specificRegistration: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.engine.settings));
    specificRegistration.status = 'NOT_REGISTERED';
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logParameters.database.maxNumberOfLogs = 0;
    specificSettings.logParameters.loki.address = '';

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

    assert.strictEqual(pinoMock.mock.calls.length, 1);
    assert.deepStrictEqual(pinoMock.mock.calls[0].arguments, [
      {
        base: undefined,
        level: 'trace',
        timestamp: isoTimeFn,
        transport: { targets: expectedTargets }
      }
    ]);
  });

  it('should properly create child logger', () => {
    const childFunction = mock.fn();
    service.logger = { child: childFunction } as unknown as ReturnType<typeof childFunction>;
    service.createChildLogger('south');
    assert.deepStrictEqual(childFunction.mock.calls[0].arguments, [{ scopeType: 'south', scopeId: undefined, scopeName: undefined }]);
  });

  it('should properly stop logger', () => {
    service.stop(); // fileCleanUpService is null — no-op

    const stopMock = mock.fn();
    service.fileCleanUpService = { stop: stopMock } as unknown as FileCleanupServiceType;
    service.stop();
    assert.strictEqual(stopMock.mock.calls.length, 1);
  });
});
