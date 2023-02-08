import path from 'node:path';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import { LogSettings } from '../../../shared/model/engine.model';

import pino from 'pino';

import LoggerService from './logger.service';
import EncryptionService from '../encryption.service';
import FileCleanupService from './file-cleanup.service';

jest.mock('pino');
jest.mock('./file-cleanup.service');
jest.mock('../encryption.service');

jest.mock('../utils');

// mock EncryptionService
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

let service: LoggerService;
let logSettings: LogSettings;
const oibusId = 'MyOIBus';

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
        tokenAddress: 'token-url',
        address: 'loki-url',
        proxyId: null,
        interval: 60
      }
    };
    service = new LoggerService(encryptionService);
  });

  it('should be properly initialized', async () => {
    service.createChildLogger = jest.fn();
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logSettings.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('logs', 'journal.log'),
          size: 10
        },
        level: logSettings.file.level
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: path.resolve('logs', 'journal.db'),
          maxNumberOfLogs: logSettings.database.maxNumberOfLogs
        },
        level: logSettings.database.level
      },
      {
        target: path.join(__dirname, 'loki-transport.js'),
        options: {
          username: logSettings.loki.username,
          password: logSettings.loki.password,
          tokenAddress: logSettings.loki.tokenAddress,
          address: logSettings.loki.address,
          id: oibusId,
          interval: logSettings.loki.interval
        },
        level: logSettings.loki.level
      }
    ];

    await service.start(oibusId, logSettings);

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
    expect(service.createChildLogger).toHaveBeenCalledWith('logger-service');
  });

  it('should be properly initialized with loki error and standard file names', async () => {
    service.createChildLogger = jest.fn();

    jest.spyOn(console, 'error').mockImplementationOnce(() => {});

    (encryptionService.decryptText as jest.Mock).mockImplementation(() => {
      throw new Error('decrypt-error');
    });

    logSettings.database.maxNumberOfLogs = 0;
    await service.start(oibusId, logSettings);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(new Error('decrypt-error'));
  });

  it('should be properly initialized without loki password and without sqliteLog', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    service.createChildLogger = jest.fn();

    logSettings.database.maxNumberOfLogs = 0;
    logSettings.loki.password = '';
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logSettings.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('logs', 'journal.log'),
          size: 10
        },
        level: logSettings.file.level
      },
      {
        target: path.join(__dirname, 'loki-transport.js'),
        options: {
          username: logSettings.loki.username,
          password: logSettings.loki.password,
          tokenAddress: logSettings.loki.tokenAddress,
          address: logSettings.loki.address,
          id: oibusId,
          interval: logSettings.loki.interval
        },
        level: logSettings.loki.level
      }
    ];

    await service.start(oibusId, logSettings);

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
    expect(service.createChildLogger).toHaveBeenCalledWith('logger-service');
  });

  it('should be properly initialized without lokiLog nor sqliteLog', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    service.createChildLogger = jest.fn();

    logSettings.database.maxNumberOfLogs = 0;
    logSettings.loki.address = '';
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logSettings.console.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('logs', 'journal.log'),
          size: 10
        },
        level: logSettings.file.level
      }
    ];

    await service.start(oibusId, logSettings);

    expect(pino).toHaveBeenCalledTimes(1);
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets }
    });
    expect(service.createChildLogger).toHaveBeenCalledWith('logger-service');
  });

  it('should properly create child logger', async () => {
    const childFunction = jest.fn();
    service.logger = { child: childFunction } as unknown as pino.Logger;
    service.createChildLogger('myScope');
    expect(service.logger.child).toHaveBeenCalledWith({ scope: 'myScope' });
  });

  it('should properly stop logger', async () => {
    const stopMock = jest.fn();
    service.stop();

    service.fileCleanUpService = { stop: stopMock } as unknown as FileCleanupService;
    service.stop();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});
