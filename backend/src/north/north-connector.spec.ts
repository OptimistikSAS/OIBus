import NorthConnector from './north-connector';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';

import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import RepositoryService from '../service/repository.service';
import ValueCacheServiceMock from '../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../tests/__mocks__/file-cache-service.mock';
import ArchiveServiceMock from '../tests/__mocks__/archive-service.mock';
import { EventEmitter } from 'node:events';
import { HandlesFile, HandlesValues } from './north-interface';
import fs from 'node:fs/promises';
import { dirSize } from '../service/utils';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { OIBusDataValue } from '../../../shared/model/engine.model';

// Mock fs
jest.mock('node:fs/promises');

const getValuesToSendMock = jest.fn();
const getFileToSend = jest.fn();
const valueCacheIsEmpty = jest.fn();
const fileCacheIsEmpty = jest.fn();
const removeAllErrorFiles = jest.fn();
const removeAllCacheFiles = jest.fn();
const valueTrigger = new EventEmitter();
const fileTrigger = new EventEmitter();
const archiveTrigger = new EventEmitter();

// Mock services
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('../service/utils');
jest.mock(
  '../service/cache/value-cache.service',
  () =>
    function () {
      const valueCacheServiceMock = new ValueCacheServiceMock();
      valueCacheServiceMock.getValuesToSend = getValuesToSendMock;
      valueCacheServiceMock.isEmpty = valueCacheIsEmpty;
      valueCacheServiceMock.triggerRun = valueTrigger;
      return valueCacheServiceMock;
    }
);

jest.mock(
  '../service/cache/file-cache.service',
  () =>
    function () {
      const fileCacheServiceMock = new FileCacheServiceMock();
      fileCacheServiceMock.removeAllErrorFiles = removeAllErrorFiles;
      fileCacheServiceMock.removeAllCacheFiles = removeAllCacheFiles;
      fileCacheServiceMock.getFileToSend = getFileToSend;
      fileCacheServiceMock.isEmpty = fileCacheIsEmpty;
      fileCacheServiceMock.triggerRun = fileTrigger;
      return fileCacheServiceMock;
    }
);
jest.mock(
  '../service/cache/archive.service',
  () =>
    function () {
      const archiveServiceMock = new ArchiveServiceMock();
      archiveServiceMock.triggerRun = archiveTrigger;
      return archiveServiceMock;
    }
);

const resetMetrics = jest.fn();
jest.mock(
  '../service/north-connector-metrics.service',
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

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

let configuration: NorthConnectorDTO;

class TestNorth extends NorthConnector implements HandlesFile, HandlesValues {
  async handleValues(): Promise<void> {}
  async handleFile(): Promise<void> {}
}
let north: TestNorth;

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
        sendFileImmediately: true,
        maxSize: 1000
      },
      archive: {
        enabled: true,
        retentionDuration: 720
      }
    };
    north = new TestNorth(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    (dirSize as jest.Mock).mockReturnValue(123);
    await north.start();
  });

  afterEach(() => {
    jest.clearAllTimers();
    valueTrigger.removeAllListeners();
    fileTrigger.removeAllListeners();
    archiveTrigger.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    expect(north.isEnabled()).toBeTruthy();
    expect(logger.debug).toHaveBeenCalledWith(`North connector "${configuration.name}" enabled. Starting services...`);
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
    expect(logger.debug).toHaveBeenCalledWith(`Creating North cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);

    await north.connect();
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing North cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`
    );

    jest.advanceTimersByTime(1000);
    expect(north.addToQueue).toHaveBeenCalledTimes(1);
    expect(north.addToQueue).toHaveBeenCalledWith(scanMode);

    await north.updateScanMode({ id: 'scanModeId', name: 'name', cron: '* * * * *' } as ScanModeDTO);
    await north.updateScanMode({ id: 'id1', name: 'name', cron: '* * * * *' } as ScanModeDTO);
    expect(logger.debug).toHaveBeenCalledWith(`Creating North cron job for scan mode "name" (* * * * *)`);
    expect(logger.debug).toHaveBeenCalledWith(`Removing existing North cron job associated to scan mode "name" (* * * * *)`);

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

    expect(north.run).toHaveBeenCalledWith('scan');
    expect(north.run).toHaveBeenCalledTimes(1);
    north.addToQueue(scanMode);

    expect(logger.warn).toHaveBeenCalledWith(`Task job not added in North connector queue for cron "${scanMode.name}" (${scanMode.cron})`);
    expect(north.run).toHaveBeenCalledTimes(1);
  });

  it('should properly run task a task', async () => {
    north.handleValuesWrapper = jest.fn();
    north.handleFilesWrapper = jest.fn();
    await north.run('scan');

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
    expect(logger.debug).toHaveBeenCalledWith(`Stopping North "${configuration.name}" (${configuration.id})...`);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info(`North connector "${configuration.name}" stopped`));
  });

  it('should properly stop with running task ', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    north.handleValuesWrapper = jest.fn(async () => promise);
    north.handleFilesWrapper = jest.fn();

    north.disconnect = jest.fn();

    north.run('scan');

    north.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping North "${configuration.name}" (${configuration.id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for North task to finish');
    expect(north.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`North connector "${configuration.name}" stopped`);
  });

  it('should trigger values first', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    north.handleValuesWrapper = jest.fn(async () => promise);
    north.handleFilesWrapper = jest.fn();
    valueTrigger.emit('next');
    expect(north.handleValuesWrapper).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Value cache trigger immediately: true`);
    expect(north.handleFilesWrapper).not.toHaveBeenCalled();
    valueTrigger.emit('cache-size', 123);

    fileTrigger.emit('next');
    fileTrigger.emit('cache-size', 123);
    archiveTrigger.emit('cache-size', 123);
    expect(north.handleFilesWrapper).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    fileTrigger.emit('next');
    expect(north.handleFilesWrapper).toHaveBeenCalled();
  });

  it('should trigger files first', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    north.handleFilesWrapper = jest.fn(async () => promise);
    north.handleValuesWrapper = jest.fn();

    fileTrigger.emit('next');
    expect(north.handleValuesWrapper).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`File cache trigger immediately: true`);
    expect(north.handleFilesWrapper).toHaveBeenCalled();

    valueTrigger.emit('next');
    expect(north.handleValuesWrapper).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    fileTrigger.emit('next');
    expect(north.handleValuesWrapper).toHaveBeenCalled();
  });

  it('should properly cache values', async () => {
    await north.cacheValues([{}, {}] as Array<OIBusDataValue>);
    expect(logger.debug).toHaveBeenCalledWith(`Caching 2 values (cache size: 0 MB)`);
  });

  it('should properly cache file', async () => {
    await north.cacheFile('myFilePath');
    expect(logger.debug).toHaveBeenCalledWith(`Caching file "myFilePath" in North connector "${configuration.name}"...`);
  });

  it('should check if North caches are empty', async () => {
    expect(await north.isCacheEmpty()).toBeTruthy();
  });

  it('should check if North is subscribed to all South', async () => {
    (repositoryService.subscriptionRepository.getNorthSubscriptions as jest.Mock).mockReturnValue([]);
    await north.start();
    expect(north.isSubscribed('southId')).toBeTruthy();
  });

  it('should check if North is subscribed to all external sources', async () => {
    (repositoryService.subscriptionRepository.getExternalNorthSubscriptions as jest.Mock).mockReturnValue([]);
    await north.start();
    expect(north.isSubscribedToExternalSource('externalSourceId')).toBeTruthy();
  });

  it('should check if North is subscribed to South', async () => {
    (repositoryService.subscriptionRepository.getNorthSubscriptions as jest.Mock).mockReturnValue(['southId']);
    await north.start();
    expect(north.isSubscribed('southId')).toBeTruthy();
  });

  it('should check if North is subscribed to external source', async () => {
    (repositoryService.subscriptionRepository.getExternalNorthSubscriptions as jest.Mock).mockReturnValue(['externalSourceId']);
    await north.start();
    expect(north.isSubscribedToExternalSource('externalSourceId')).toBeTruthy();
  });

  it('should check if North is not subscribed to South', async () => {
    (repositoryService.subscriptionRepository.getNorthSubscriptions as jest.Mock).mockReturnValue(['southId1']);
    await north.start();
    expect(north.isSubscribed('southId2')).toBeFalsy();
  });

  it('should check if North is not subscribed to external source', async () => {
    (repositoryService.subscriptionRepository.getExternalNorthSubscriptions as jest.Mock).mockReturnValue(['externalSourceId1']);
    await north.start();
    expect(north.isSubscribedToExternalSource('externalSourceId2')).toBeFalsy();
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

  it('should get archive files', async () => {
    const result = await north.getArchiveFiles('2022-11-11T11:11:11.111Z', '2022-11-12T11:11:11.111Z', 'file');
    expect(result).toEqual([
      { filename: 'file1.name', modificationDate: '', size: 1 },
      { filename: 'file2.name', modificationDate: '', size: 2 },
      { filename: 'file3.name', modificationDate: '', size: 3 }
    ]);
  });

  it('should remove archive files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.removeArchiveFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Removing 3 archive files from North connector "${configuration.name}"...`);
  });

  it('should retry archive files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.retryArchiveFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Retrying 3 archive files in North connector "${configuration.name}"...`);
  });

  it('should remove all archive files', async () => {
    await north.removeAllArchiveFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Removing all archive files from North connector "${configuration.name}"...`);
  });

  it('should retry all archive files', async () => {
    await north.retryAllArchiveFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Retrying all archive files in North connector "${configuration.name}"...`);
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

    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });

    await north.handleFilesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file.csv" (1). handle value error`);
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file.csv" (2). oibus error`);
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file.csv" (3). oibus error 2`);
  });
});

describe('NorthConnector disabled', () => {
  const cacheSize = 1_000_000_000;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (dirSize as jest.Mock).mockReturnValue(cacheSize);
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
        sendFileImmediately: true,
        maxSize: 10
      },
      archive: {
        enabled: true,
        retentionDuration: 720
      }
    };

    north = new TestNorth(configuration, encryptionService, repositoryService, logger, 'baseFolder');
  });

  afterEach(() => {
    jest.clearAllTimers();
    valueTrigger.removeAllListeners();
    fileTrigger.removeAllListeners();
    archiveTrigger.removeAllListeners();
  });

  it('should not call handle values and handle file', async () => {
    const basicNorth = new NorthConnector(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    basicNorth.handleValuesWrapper = jest.fn();
    basicNorth.handleFilesWrapper = jest.fn();
    await basicNorth.run('scan');
    expect(basicNorth.handleValuesWrapper).not.toHaveBeenCalled();
    expect(basicNorth.handleFilesWrapper).not.toHaveBeenCalled();
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

  it('should use another logger', async () => {
    jest.resetAllMocks();

    north.setLogger(anotherLogger);
    await north.retryAllErrorFiles();
    expect(anotherLogger.trace).toHaveBeenCalledTimes(1);
    expect(logger.trace).not.toHaveBeenCalled();
  });

  it('should reset cache', async () => {
    await north.resetCache();
    expect(removeAllErrorFiles).toHaveBeenCalledTimes(1);
    expect(removeAllCacheFiles).toHaveBeenCalledTimes(1);
  });

  it('should get metrics stream', () => {
    const stream = north.getMetricsDataStream();
    expect(stream).toEqual({ stream: 'myStream' });
  });

  it('should reset metrics', () => {
    north.resetMetrics();
    expect(resetMetrics).toHaveBeenCalledTimes(1);
  });

  it('should manage caching file when cache size is more than max size', async () => {
    await north.start();
    await north.cacheFile('filePath');
    expect(logger.debug).toHaveBeenCalledWith(
      `North cache is exceeding the maximum allowed size ` +
        `(${Math.floor((cacheSize / 1024 / 1024) * 100) / 100} MB >= ${configuration.caching.maxSize} MB). ` +
        'Files will be discarded until the cache is emptied (by sending files/values or manual removal)'
    );
  });

  it('should manage caching value when cache size is more than max size', async () => {
    await north.start();
    await north.cacheValues([]);
    expect(logger.debug).toHaveBeenCalledWith(
      `North cache is exceeding the maximum allowed size ` +
        `(${Math.floor((cacheSize / 1024 / 1024) * 100) / 100} MB >= ${configuration.caching.maxSize} MB). ` +
        'Values will be discarded until the cache is emptied (by sending files/values or manual removal)'
    );
  });
});

describe('NorthConnector test', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    configuration = {
      id: 'test',
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
        sendFileImmediately: true,
        maxSize: 10
      },
      archive: {
        enabled: true,
        retentionDuration: 720
      }
    };

    north = new TestNorth(configuration, encryptionService, repositoryService, logger, 'baseFolder');
  });

  afterEach(() => {
    jest.clearAllTimers();
    valueTrigger.removeAllListeners();
    fileTrigger.removeAllListeners();
    archiveTrigger.removeAllListeners();
  });

  it('should check if North caches are empty', async () => {
    expect(await north.isCacheEmpty()).toBeFalsy();
  });

  it('should test connection', async () => {
    await north.start();
    await north.testConnection();
    expect(logger.warn).toHaveBeenCalledWith('testConnection must be override');
  });
});
