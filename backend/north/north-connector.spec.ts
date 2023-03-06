import NorthConnector from './north-connector';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';

import { NorthConnectorDTO, NorthConnectorManifest } from '../../shared/model/north-connector.model';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import ProxyService from '../service/proxy.service';
import RepositoryService from '../service/repository.service';

// Mock fs
jest.mock('node:fs/promises');
const getValuesToSendMock = jest.fn();
const getFileToSend = jest.fn();
const valueCacheIsEmpty = jest.fn();
const fileCacheIsEmpty = jest.fn();

// Mock services
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('../service/proxy.service');
jest.mock('../service/status.service');
jest.mock('../service/utils');
jest.mock(
  '../service/cache/value-cache.service',
  () =>
    function () {
      return {
        start: jest.fn(),
        stop: jest.fn(),
        cacheValues: jest.fn(),
        getValuesToSend: getValuesToSendMock,
        removeSentValues: jest.fn(),
        manageErroredValues: jest.fn(),
        isEmpty: valueCacheIsEmpty
      };
    }
);

jest.mock(
  '../service/cache/file-cache.service',
  () =>
    function () {
      return {
        start: jest.fn(),
        stop: jest.fn(),
        getErrorFiles: jest.fn(() => [
          { filename: 'file1.name', modificationDate: '', size: 1 },
          { filename: 'file2.name', modificationDate: '', size: 2 },
          { filename: 'file3.name', modificationDate: '', size: 3 }
        ]),
        cacheFile: jest.fn(),
        removeErrorFiles: jest.fn(),
        retryErrorFiles: jest.fn(),
        removeAllErrorFiles: jest.fn(),
        retryAllErrorFiles: jest.fn(),
        getFileToSend: getFileToSend,
        removeFileFromQueue: jest.fn(),
        manageErroredFiles: jest.fn(),
        isEmpty: fileCacheIsEmpty
      };
    }
);
jest.mock('../service/cache/archive.service');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const nowDateString = '2020-02-02T02:02:02.222Z';
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

let configuration: NorthConnectorDTO;
let north: NorthConnector;
const manifest: NorthConnectorManifest = {
  name: 'north',
  description: 'My North Connector test',
  category: 'test',
  modes: {
    files: true,
    points: true
  },
  settings: [],
  schema: {} as unknown
} as NorthConnectorManifest;

describe('NorthConnector enabled', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    const valuesInQueue = new Map();
    valuesInQueue.set('value-file1.queue', [{}, {}]);
    getValuesToSendMock.mockImplementation(() => valuesInQueue);
    getFileToSend.mockImplementation(() => 'file.csv');
    valueCacheIsEmpty.mockImplementation(() => true);
    fileCacheIsEmpty.mockImplementation(() => true);
    configuration = {
      id: 'id',
      name: 'north',
      type: 'test',
      description: 'my test connector',
      enabled: true,
      settings: {},
      caching: {
        scanModeId: 'id1',
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        retryCount: 2,
        timeout: 1000
      },
      archive: {
        enabled: true,
        retentionDuration: 720
      }
    };
    north = new NorthConnector(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder', manifest);
    await north.start();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should be properly initialized', async () => {
    expect(north.enabled()).toBeTruthy();
    expect(logger.trace).toHaveBeenCalledWith(`North connector "${configuration.name}" enabled. Starting services...`);
    expect(logger.error).toHaveBeenCalledWith(`Scan mode ${configuration.caching.scanModeId} not found`);
    expect(logger.info).toHaveBeenCalledWith(`North connector "${configuration.name}" of type ${configuration.type} started`);
  });

  it('should properly create cron job and add to queue', async () => {
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue(scanMode);

    north.addToQueue = jest.fn();
    await north.connect();
    expect(logger.debug).toHaveBeenCalledWith(`Creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);

    await north.connect();
    expect(logger.debug).toHaveBeenCalledWith(`Removing existing cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);

    jest.advanceTimersByTime(1000);
    expect(north.addToQueue).toHaveBeenCalledTimes(1);
    expect(north.addToQueue).toHaveBeenCalledWith(scanMode);

    await north.stop();
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    north.run = jest.fn();
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    north.addToQueue(scanMode);
    expect(logger.warn).not.toHaveBeenCalled();

    expect(north.run).toHaveBeenCalledWith(scanMode);
    expect(north.run).toHaveBeenCalledTimes(1);
    north.addToQueue(scanMode);

    expect(logger.warn).toHaveBeenCalledWith(`Task job not added in queue for cron "${scanMode.name}" (${scanMode.cron})`);
    expect(north.run).toHaveBeenCalledTimes(1);
  });

  it('should properly run task a task', async () => {
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    north.handleValuesWrapper = jest.fn();
    north.handleFilesWrapper = jest.fn();
    await north.run(scanMode);

    expect(north.handleValuesWrapper).toHaveBeenCalledTimes(1);
    expect(north.handleFilesWrapper).toHaveBeenCalledTimes(1);

    expect(logger.trace).toHaveBeenCalledWith('No more task to run');
  });

  it('should properly disconnect', async () => {
    await north.disconnect();
    expect(logger.info).toHaveBeenCalledWith(`North connector "${configuration.name}" (${configuration.id}) disconnected`);
  });

  it('should properly stop', async () => {
    north.disconnect = jest.fn();
    await north.stop();
    expect(logger.info).toHaveBeenCalledWith(`Stopping North "${configuration.name}" (${configuration.id})...`);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.debug(`North connector ${configuration.id} stopped`));
  });

  it('should properly stop with running task ', async () => {
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    north.handleValuesWrapper = jest.fn(async () => promise);
    north.handleFilesWrapper = jest.fn();

    north.disconnect = jest.fn();

    north.run(scanMode);

    await north.run(scanMode);
    expect(logger.warn).toHaveBeenCalledWith(`A task is already running with scan mode ${scanMode.name}`);

    north.stop();
    expect(logger.info).toHaveBeenCalledWith(`Stopping North "${configuration.name}" (${configuration.id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for task to finish');
    expect(north.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.debug(`North connector ${configuration.id} stopped`));
  });

  it('should properly cache values', async () => {
    await north.cacheValues([{}, {}]);
    expect(logger.trace).toHaveBeenCalledWith(`Caching 2 values in North connector "${configuration.name}"...`);
  });

  it('should properly cache file', async () => {
    await north.cacheFile('myFilePath');
    expect(logger.trace).toHaveBeenCalledWith(`Caching file "myFilePath" in North connector "${configuration.name}"...`);
  });

  it('should check if North caches are empty', async () => {
    expect(await north.isCacheEmpty()).toBeTruthy();
  });

  it('should check if North caches are empty', () => {
    expect(north.isSubscribed('southId')).toBeTruthy();
  });

  it('should get error files', async () => {
    const result = await north.getErrorFiles('2022-11-11T11:11:11.111Z', '2022-11-12T11:11:11.111Z', 'file');
    expect(result).toEqual([
      { filename: 'file1.name', modificationDate: '', size: 1 },
      { filename: 'file2.name', modificationDate: '', size: 2 },
      { filename: 'file3.name', modificationDate: '', size: 3 }
    ]);
  });

  it('should remove error files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.removeErrorFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Removing 3 error files from North connector "${configuration.name}"...`);
  });

  it('should retry error files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.retryErrorFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Retrying 3 error files in North connector "${configuration.name}"...`);
  });

  it('should remove all error files', async () => {
    await north.removeAllErrorFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Removing all error files from North connector "${configuration.name}"...`);
  });

  it('should retry all error files', async () => {
    await north.retryAllErrorFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Retrying all error files in North connector "${configuration.name}"...`);
  });

  it('should handle values properly', async () => {
    jest.clearAllMocks();
    north.handleValues = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('handle value error');
      })
      .mockImplementationOnce(() => {
        throw {
          retry: true,
          message: 'oibus error'
        };
      })
      .mockImplementationOnce(() => {
        throw {
          retry: false,
          message: 'oibus error 2'
        };
      });

    await north.handleValuesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    await north.handleValuesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while sending 2 values (1). handle value error`);
    await north.handleValuesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while sending 2 values (2). oibus error`);
    await north.handleValuesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while sending 2 values (3). oibus error 2`);
  });

  it('should call default handle values', async () => {
    await north.handleValues([]);
    expect(logger.warn).toHaveBeenCalledWith('handleValues method must be override');
  });

  it('should handle files properly', async () => {
    jest.clearAllMocks();
    north.handleFile = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('handle value error');
      })
      .mockImplementationOnce(() => {
        throw {
          retry: true,
          message: 'oibus error'
        };
      })
      .mockImplementationOnce(() => {
        throw {
          retry: false,
          message: 'oibus error 2'
        };
      });

    await north.handleFilesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file.csv" (1). handle value error`);
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file.csv" (2). oibus error`);
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file.csv" (3). oibus error 2`);
  });

  it('should call default handle file', async () => {
    await north.handleFile('file path');
    expect(logger.warn).toHaveBeenCalledWith('handleFile method must be override');
  });
});

describe('NorthConnector disabled', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    const valuesInQueue = new Map();
    getValuesToSendMock.mockImplementation(() => valuesInQueue);
    getFileToSend.mockImplementation(() => null);
    valueCacheIsEmpty.mockImplementation(() => false);
    fileCacheIsEmpty.mockImplementation(() => false);

    configuration = {
      id: 'id',
      name: 'north',
      type: 'test',
      description: 'my test connector',
      enabled: false,
      settings: {},
      caching: {
        scanModeId: 'id1',
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        retryCount: 2,
        timeout: 1000
      },
      archive: {
        enabled: true,
        retentionDuration: 720
      }
    };

    manifest.modes.files = false;
    manifest.modes.points = false;
    north = new NorthConnector(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder', manifest);
    await north.start();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should be properly initialized', async () => {
    expect(north.enabled()).toBeFalsy();
    expect(logger.trace).toHaveBeenCalledWith(`North connector "${configuration.name}" not enabled`);
  });

  it('should not call handle values and handle file', async () => {
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };

    north.handleValuesWrapper = jest.fn();
    north.handleFilesWrapper = jest.fn();
    await north.run(scanMode);
    expect(north.handleValuesWrapper).not.toHaveBeenCalled();
    expect(north.handleFilesWrapper).not.toHaveBeenCalled();
  });

  it('should not call handle values if no values in queue', async () => {
    north.handleValues = jest.fn();
    await north.handleValuesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    expect(north.handleValues).not.toHaveBeenCalled();
  });

  it('should not call handle file if no file in queue', async () => {
    north.handleFile = jest.fn();
    await north.handleFilesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    expect(north.handleFile).not.toHaveBeenCalled();
  });

  it('should properly create an OIBus error', () => {
    expect(north.createOIBusError(new Error('node error'))).toEqual({ retry: true, message: 'node error' });
    expect(north.createOIBusError('string error')).toEqual({ retry: true, message: 'string error' });
    expect(north.createOIBusError({ retry: false, message: 'oibus error' })).toEqual({ retry: false, message: 'oibus error' });
    expect(north.createOIBusError({ field: 'another error' })).toEqual({
      retry: true,
      message: JSON.stringify({ field: 'another error' })
    });
    expect(north.createOIBusError(undefined)).toEqual({
      retry: true,
      message: undefined
    });
    expect(north.createOIBusError(null)).toEqual({
      retry: true,
      message: 'null'
    });
    expect(north.createOIBusError(20)).toEqual({
      retry: true,
      message: '20'
    });
  });

  it('should check if North caches are empty', async () => {
    expect(await north.isCacheEmpty()).toBeFalsy();
  });
});
