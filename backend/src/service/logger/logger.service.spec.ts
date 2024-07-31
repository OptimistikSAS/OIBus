import path from 'node:path';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { LogSettings, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';

import pino from 'pino';

import LoggerService from './logger.service';
import EncryptionService from '../encryption.service';
import FileCleanupService from './file-cleanup.service';

jest.mock(
  'pino',
  jest.fn(() => jest.fn(() => ({ child: jest.fn() })))
);
// @ts-ignore
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

// mock EncryptionService
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

let service: LoggerService;
let logSettings: LogSettings;
const oibusId = 'MyOIBusId';
const oibusName = 'MyOIBusName';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    logSettings = {
      console: { level: 'error' },
      file: {
        level: 'warn',
        numberOfFiles: 5,
        maxFileSize: 10
      },
      database: {
        level: 'info',
        maxNumberOfLogs: 1234
      },
      loki: {
        level: 'debug',
        username: 'user',
        password: 'loki-pass',
        address: 'loki-url',
        interval: 60
      },
      oia: {
        level: 'error',
        interval: 60
      }
    };
    service = new LoggerService(encryptionService, 'folder');
  });

  it('should be properly initialized', async () => {
    service.createChildLogger = jest.fn();
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      proxyUrl: 'http://localhost:9000',
      proxyUsername: 'username',
      proxyPassword: 'password',
      token: 'token',
      status: 'REGISTERED'
    } as RegistrationSettingsDTO;
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logSettings.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: 10
        },
        level: logSettings.file.level
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: path.resolve('folder', 'logs.db'),
          maxNumberOfLogs: logSettings.database.maxNumberOfLogs
        },
        level: logSettings.database.level
      },
      {
        target: 'pino-loki',
        options: {
          batching: true,
          interval: logSettings.loki.interval,
          host: logSettings.loki.address,
          basicAuth: {
            username: logSettings.loki.username,
            password: logSettings.loki.password
          },
          labels: { name: oibusName }
        },
        level: logSettings.loki.level
      },
      {
        target: path.join(__dirname, 'oianalytics-transport.js'),
        options: {
          interval: logSettings.oia.interval,
          host: registration.host,
          token: registration.token,
          useProxy: registration.useProxy,
          proxyUrl: registration.proxyUrl,
          proxyUsername: registration.proxyUsername,
          proxyPassword: registration.proxyPassword,
          acceptUnauthorized: registration.acceptUnauthorized
        },
        level: logSettings.oia.level
      }
    ];

    await service.start(oibusId, oibusName, logSettings, registration);

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
  });

  it('should be properly initialized with loki error and standard file names', async () => {
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      status: 'REGISTERED',
      token: 'token'
    } as RegistrationSettingsDTO;
    service.createChildLogger = jest.fn();

    jest.spyOn(console, 'error').mockImplementation(() => {});

    (encryptionService.decryptText as jest.Mock).mockImplementation(() => {
      throw new Error('decrypt-error');
    });

    logSettings.database.maxNumberOfLogs = 0;
    await service.start(oibusId, oibusName, logSettings, registration);

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(new Error('decrypt-error'));
  });

  it('should be properly initialized without loki password, without oia token and without sqliteLog', async () => {
    const registration: RegistrationSettingsDTO = {
      id: 'id',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost:9000',
      proxyUsername: 'username',
      proxyPassword: '',
      token: '',
      status: 'REGISTERED'
    } as RegistrationSettingsDTO;

    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    service.createChildLogger = jest.fn();

    logSettings.database.maxNumberOfLogs = 0;
    logSettings.loki.password = '';
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logSettings.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: 10
        },
        level: logSettings.file.level
      },
      {
        target: 'pino-loki',
        options: {
          batching: true,
          interval: logSettings.loki.interval,
          host: logSettings.loki.address,
          basicAuth: {
            username: logSettings.loki.username,
            password: logSettings.loki.password
          },
          labels: { name: oibusName }
        },
        level: logSettings.loki.level
      },
      {
        target: path.join(__dirname, 'oianalytics-transport.js'),
        options: {
          interval: logSettings.oia.interval,
          host: registration.host,
          token: registration.token,
          useProxy: registration.useProxy,
          proxyUrl: registration.proxyUrl,
          proxyUsername: registration.proxyUsername,
          proxyPassword: registration.proxyPassword,
          acceptUnauthorized: registration.acceptUnauthorized
        },
        level: logSettings.oia.level
      }
    ];

    await service.start(oibusId, oibusName, logSettings, registration);

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
  });

  it('should be properly initialized without lokiLog, nor oianalytics nor sqliteLog', async () => {
    const registration: RegistrationSettingsDTO = {
      status: 'NOT_REGISTERED'
    } as RegistrationSettingsDTO;

    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    service.createChildLogger = jest.fn();

    logSettings.database.maxNumberOfLogs = 0;
    logSettings.loki.address = '';
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logSettings.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('folder', 'journal.log'),
          size: 10
        },
        level: logSettings.file.level
      }
    ];

    await service.start(oibusId, oibusName, logSettings, registration);

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
