import fs from 'node:fs/promises';

import NorthConsole from './north-console';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import { NorthConsoleSettings } from '../../../../shared/model/north-settings.model';
import ArchiveServiceMock from '../../tests/__mocks__/archive-service.mock';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

jest.mock('node:fs/promises');
// Spy on console table and info
jest.spyOn(global.console, 'table').mockImplementation(() => {});
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return new ArchiveServiceMock();
    }
);
jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return new ValueCacheServiceMock();
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return new FileCacheServiceMock();
    }
);
const resetMetrics = jest.fn();
jest.mock(
  '../../service/north-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        resetMetrics,
        metrics: {
          numberOfValuesSent: 1,
          numberOfFilesSent: 1
        }
      };
    }
);

const nowDateString = '2020-02-02T02:02:02.222Z';
const configuration: NorthConnectorDTO<NorthConsoleSettings> = {
  id: 'id',
  name: 'north',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    verbose: true
  },
  caching: {
    scanModeId: 'id1',
    retryInterval: 5000,
    groupCount: 10000,
    maxSendCount: 10000,
    retryCount: 2,
    sendFileImmediately: true,
    maxSize: 1000
  },
  archive: {
    enabled: true,
    retentionDuration: 720
  }
};
let north: NorthConsole;

describe('NorthConsole with verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    north = new NorthConsole(configuration, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly handle values in verbose mode', async () => {
    const values: Array<OIBusDataValue> = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: '666', quality: 'good' }
      }
    ];
    await north.handleValues(values);

    expect(console.table).toHaveBeenCalledWith(values, ['pointId', 'timestamp', 'data']);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should properly handle values in verbose mode', async () => {
    const filePath = '/path/to/file/example.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    await north.handleFile(filePath);
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(console.table).toHaveBeenCalledWith([{ filePath, fileSize: 666 }]);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });
});

describe('NorthConsole without verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    configuration.settings.verbose = false;
    north = new NorthConsole(configuration, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly handle values in non verbose mode', async () => {
    const values: Array<OIBusDataValue> = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: '666', quality: 'good' }
      }
    ];
    await north.handleValues(values);

    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 values.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should properly handle file in non verbose mode', async () => {
    const filePath = '/path/to/file/example.file';

    await north.handleFile(filePath);

    expect(fs.stat).not.toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 file.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });
});

describe('NorthConsole test connection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    north = new NorthConsole(configuration, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should be able to write test data to output', async () => {
    await expect(north.testConnection()).resolves.not.toThrow();

    expect(logger.info).toBeCalledWith('Testing North Console output');
    expect(process.stdout.write).toBeCalledWith('North Console output test.\r\n');
    expect(console.table).toBeCalledWith([{ data: 'foo' }, { data: 'bar' }]);
  });

  it('should not be able to write to output when stdout is not writable', async () => {
    // Override the process.stdout.writable property
    Object.defineProperty(process.stdout, 'writable', { value: false, configurable: true });

    const error = new Error('The process.stdout stream has been destroyed, errored or ended');
    await expect(north.testConnection()).rejects.toThrow(new Error('Node process is unable to write to STDOUT'));

    expect(logger.info).toBeCalledWith('Testing North Console output');
    expect(process.stdout.write).not.toBeCalled();
    expect(console.table).not.toBeCalled();
    expect(logger.error).toBeCalledWith(`Error testing North Console output: ${error}`);

    Object.defineProperty(process.stdout, 'writable', { value: true, configurable: true });
  });

  it('should not be able to write to output when stdout.write throws error', async () => {
    const error = new Error('Cannot write to stdout');
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error('Node process is unable to write to STDOUT'));

    expect(logger.info).toBeCalledWith('Testing North Console output');
    expect(process.stdout.write).toBeCalled();
    expect(console.table).not.toBeCalled();
    expect(logger.error).toBeCalledWith(`Error testing North Console output: ${error}`);
  });
});
