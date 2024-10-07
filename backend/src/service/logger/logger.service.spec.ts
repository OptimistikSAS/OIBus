import path from 'node:path';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';

import pino from 'pino';

import LoggerService from './logger.service';
import EncryptionService from '../encryption.service';
import FileCleanupService from './file-cleanup.service';
import testData from '../../tests/utils/test-data';
import { EngineSettings } from '../../model/engine.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';

jest.mock(
  'pino',
  jest.fn(() => jest.fn(() => ({ child: jest.fn() })))
);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
pino.stdTimeFunctions = {
  epochTime(): string {
    return '';
  },
  nullTime(): string {
    return '';
  },
  unixTime(): string {
    return '';
  },
  isoTime(): string {
    return '';
  }
};
jest.mock('./file-cleanup.service');
jest.mock('../encryption.service');

jest.mock('../utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

let service: LoggerService;
describe('Logger', () => {
  const engineSettings = testData.engine.settings;
  const registration = testData.oIAnalytics.registration.completed;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    service = new LoggerService(encryptionService, 'folder');
  });

  it('should be properly initialized', async () => {
    service.createChildLogger = jest.fn();
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
          batching: true,
          interval: engineSettings.logParameters.loki.interval,
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
          host: registration.host,
          token: registration.token,
          useProxy: registration.useProxy,
          proxyUrl: registration.proxyUrl,
          proxyUsername: registration.proxyUsername,
          proxyPassword: registration.proxyPassword,
          acceptUnauthorized: registration.acceptUnauthorized
        },
        level: engineSettings.logParameters.oia.level
      }
    ];

    await service.start(engineSettings, registration);

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
  });

  it('should be properly initialized with loki error and standard file names', async () => {
    service.createChildLogger = jest.fn();

    jest.spyOn(console, 'error').mockImplementation(() => Promise.resolve());

    (encryptionService.decryptText as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('decrypt-error');
      })
      .mockImplementationOnce(() => {
        throw new Error('decrypt-error');
      });

    await service.start(engineSettings, registration);

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(new Error('decrypt-error'));
  });

  it('should be properly initialized without loki password, without oia token and without sqliteLog', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => Promise.resolve());
    service.createChildLogger = jest.fn();

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
          batching: true,
          interval: specificSettings.logParameters.loki.interval,
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
          host: specificRegistration.host,
          token: specificRegistration.token,
          useProxy: specificRegistration.useProxy,
          proxyUrl: specificRegistration.proxyUrl,
          proxyUsername: specificRegistration.proxyUsername,
          proxyPassword: specificRegistration.proxyPassword,
          acceptUnauthorized: specificRegistration.acceptUnauthorized
        },
        level: specificSettings.logParameters.oia.level
      }
    ];

    await service.start(specificSettings, specificRegistration);

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
  });

  it('should be properly initialized without lokiLog, nor oianalytics nor sqliteLog', async () => {
    const specificRegistration: OIAnalyticsRegistration = JSON.parse(JSON.stringify(testData.engine.settings));
    specificRegistration.status = 'NOT_REGISTERED';
    const specificSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    specificSettings.logParameters.database.maxNumberOfLogs = 0;
    specificSettings.logParameters.loki.address = '';
    jest.spyOn(console, 'error').mockImplementationOnce(() => Promise.resolve());
    service.createChildLogger = jest.fn();

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

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
  });

  it('should properly create child logger', async () => {
    const childFunction = jest.fn();
    service.logger = { child: childFunction } as unknown as pino.Logger;
    service.createChildLogger('myScope');
    expect(service.logger.child).toHaveBeenCalledWith({ scopeType: 'myScope' });
  });

  it('should properly stop logger', async () => {
    const stopMock = jest.fn();
    service.stop();

    service.fileCleanUpService = { stop: stopMock } as unknown as FileCleanupService;
    service.stop();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});
