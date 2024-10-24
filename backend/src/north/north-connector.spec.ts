import NorthConnector from './north-connector';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import ValueCacheServiceMock from '../tests/__mocks__/service/cache/value-cache-service.mock';
import FileCacheServiceMock from '../tests/__mocks__/service/cache/file-cache-service.mock';
import ArchiveServiceMock from '../tests/__mocks__/service/cache/archive-service.mock';
import fs from 'node:fs/promises';
import { dirSize, validateCronExpression } from '../service/utils';
import { OIBusContent, OIBusTimeValue } from '../../shared/model/engine.model';
import path from 'node:path';
import testData from '../tests/utils/test-data';
import { NorthFileWriterSettings, NorthOIAnalyticsSettings, NorthSettings } from '../../shared/model/north-settings.model';
import NorthFileWriter from './north-file-writer/north-file-writer';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { flushPromises } from '../tests/utils/test-utils';
import NorthOIAnalytics from './north-oianalytics/north-oianalytics';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OianalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import { OIBusError } from '../model/engine.model';

// Mock fs
jest.mock('node:fs/promises');
jest.mock('node:path');

// Mock services
jest.mock('../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const valueCacheService = new ValueCacheServiceMock();
const fileCacheService = new FileCacheServiceMock();
const archiveService = new ArchiveServiceMock();

jest.mock(
  '../service/cache/value-cache.service',
  () =>
    function () {
      return valueCacheService;
    }
);
jest.mock(
  '../service/cache/file-cache.service',
  () =>
    function () {
      return fileCacheService;
    }
);
jest.mock(
  '../service/cache/archive.service',
  () =>
    function () {
      return archiveService;
    }
);

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

let north: NorthConnector<NorthSettings>;
describe('NorthConnector', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(testData.north.list[0]);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (dirSize as jest.Mock).mockReturnValue(123);

    north = new NorthFileWriter(
      testData.north.list[0] as NorthConnectorEntity<NorthFileWriterSettings>,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
    await north.start();
  });

  afterEach(() => {
    valueCacheService.triggerRun.removeAllListeners();
    fileCacheService.triggerRun.removeAllListeners();
    archiveService.triggerRun.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    expect(north.isEnabled()).toEqual(true);
    expect(logger.debug).toHaveBeenCalledWith(`North connector "${testData.north.list[0].name}" enabled. Starting services...`);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      `North connector "${testData.north.list[0].name}" of type ${testData.north.list[0].type} started`
    );
    expect(north.settings).toEqual(testData.north.list[0]);
  });

  it('should properly create cron job and add to queue', async () => {
    (scanModeRepository.findById as jest.Mock).mockReturnValue(testData.scanMode.list[0]);

    north.addToQueue = jest.fn();
    await north.connect();
    expect(logger.debug).toHaveBeenCalledWith(
      `Creating North cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );

    await north.connect();
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing North cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );

    jest.advanceTimersByTime(1000);
    expect(north.addToQueue).toHaveBeenCalledTimes(1);
    expect(north.addToQueue).toHaveBeenCalledWith(testData.scanMode.list[0]);

    await north.updateScanMode(testData.scanMode.list[0]);
    await north.updateScanMode(testData.scanMode.list[1]);
    expect(logger.debug).toHaveBeenCalledWith(
      `Creating North cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing North cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );

    await north.stop();
  });

  it('should not create a cron job when the cron expression is invalid', () => {
    const error = new Error('Invalid cron expression');
    (validateCronExpression as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    north.createCronJob({ ...testData.scanMode.list[0], cron: '* * * * * *L' });

    expect(logger.error).toHaveBeenCalledWith(
      `Error when creating North cron job for scan mode "${testData.scanMode.list[0].name}" (* * * * * *L): ${error.message}`
    );
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    north.run = jest.fn();
    north.addToQueue(testData.scanMode.list[0]);
    expect(logger.warn).not.toHaveBeenCalled();

    expect(north.run).toHaveBeenCalledWith('scan');
    expect(north.run).toHaveBeenCalledTimes(1);
    north.addToQueue(testData.scanMode.list[0]);

    expect(logger.warn).toHaveBeenCalledWith(
      `Task job not added in North connector queue for cron "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
    expect(north.run).toHaveBeenCalledTimes(1);
  });

  it('should properly add to queue a new task and not trigger next run', async () => {
    north.run = jest.fn();
    north.createDeferredPromise();
    north.addToQueue(testData.scanMode.list[0]);
    expect(north.run).not.toHaveBeenCalled();
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
    expect(logger.info).toHaveBeenCalledWith(
      `North connector "${testData.north.list[0].name}" (${testData.north.list[0].id}) disconnected`
    );
  });

  it('should properly stop', async () => {
    north.disconnect = jest.fn();
    await north.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping North "${testData.north.list[0].name}" (${testData.north.list[0].id})...`);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info(`North connector "${testData.north.list[0].name}" stopped`));
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
    expect(logger.debug).toHaveBeenCalledWith(`Stopping North "${testData.north.list[0].name}" (${testData.north.list[0].id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for North task to finish');
    expect(north.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`North connector "${testData.north.list[0].name}" stopped`);
  });

  it('should trigger values first', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    north.handleValuesWrapper = jest.fn(async () => promise);
    north.handleFilesWrapper = jest.fn();

    valueCacheService.triggerRun.emit('next');
    expect(north.handleValuesWrapper).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Value cache trigger immediately: true`);
    expect(north.handleFilesWrapper).not.toHaveBeenCalled();
    valueCacheService.triggerRun.emit('cache-size', 123);
    valueCacheService.triggerRun.emit('next');
    valueCacheService.triggerRun.emit('cache-size', 123);
    archiveService.triggerRun.emit('cache-size', 123);

    expect(north.handleFilesWrapper).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);

    await flushPromises();
    fileCacheService.triggerRun.emit('next');
    expect(north.handleFilesWrapper).toHaveBeenCalled();
  });

  it('should trigger files first', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    north.handleFilesWrapper = jest.fn(async () => promise);
    north.handleValuesWrapper = jest.fn();

    fileCacheService.triggerRun.emit('next');
    expect(north.handleValuesWrapper).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`File cache trigger immediately: true`);
    expect(north.handleFilesWrapper).toHaveBeenCalled();

    valueCacheService.triggerRun.emit('next');
    fileCacheService.triggerRun.emit('cache-size', 123);
    expect(north.handleValuesWrapper).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    fileCacheService.triggerRun.emit('next');
    expect(north.handleValuesWrapper).toHaveBeenCalled();
  });

  it('should properly cache values', async () => {
    await north.cacheValues([{}, {}] as Array<OIBusTimeValue>);
    expect(logger.debug).toHaveBeenCalledWith(`Caching 2 values (cache size: 0 MB)`);
  });

  it('should properly cache file', async () => {
    await north.cacheFile('myFilePath');
    expect(logger.debug).toHaveBeenCalledWith(`Caching file "myFilePath" in North connector "${testData.north.list[0].name}"...`);
  });

  it('should check if North caches are empty', async () => {
    fileCacheService.isEmpty.mockReturnValueOnce(true);
    valueCacheService.isEmpty.mockReturnValueOnce(true);
    expect(await north.isCacheEmpty()).toBeTruthy();
  });

  it('should check if North is subscribed to all South', async () => {
    (northConnectorRepository.listNorthSubscriptions as jest.Mock).mockReturnValue([]);
    await north.start();
    expect(north.isSubscribed('newId')).toBeTruthy();
  });

  it('should check if North is subscribed to South', async () => {
    (northConnectorRepository.listNorthSubscriptions as jest.Mock).mockReturnValue(testData.north.list[0].subscriptions);
    await north.start();
    expect(north.isSubscribed(testData.north.list[0].subscriptions[0].id)).toBeTruthy();
  });

  it('should check if North is not subscribed to South', async () => {
    (northConnectorRepository.listNorthSubscriptions as jest.Mock).mockReturnValue(testData.north.list[0].subscriptions);
    await north.start();
    expect(north.isSubscribed('badId')).toBeFalsy();
  });

  it('should get error files', async () => {
    const expectedResult = [
      { filename: 'file1.name', modificationDate: '', size: 1 },
      { filename: 'file2.name', modificationDate: '', size: 2 },
      { filename: 'file3.name', modificationDate: '', size: 3 }
    ];
    fileCacheService.getErrorFiles.mockReturnValueOnce(expectedResult);
    const result = await north.getErrorFiles('2022-11-11T11:11:11.111Z', '2022-11-12T11:11:11.111Z', 'file');
    expect(result).toEqual(expectedResult);
  });

  it('should remove error files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.removeErrorFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Removing 3 error files from North connector "${testData.north.list[0].name}"...`);
  });

  it('should retry error files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.retryErrorFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Retrying 3 error files in North connector "${testData.north.list[0].name}"...`);
  });

  it('should remove all error files', async () => {
    await north.removeAllErrorFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Removing all error files from North connector "${testData.north.list[0].name}"...`);
  });

  it('should retry all error files', async () => {
    await north.retryAllErrorFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Retrying all error files in North connector "${testData.north.list[0].name}"...`);
  });

  it('should get cache files', async () => {
    const expectedResult = [
      { filename: 'file4.name', modificationDate: '', size: 1 },
      { filename: 'file5.name', modificationDate: '', size: 2 },
      { filename: 'file6.name', modificationDate: '', size: 3 }
    ];
    fileCacheService.getCacheFiles.mockReturnValueOnce(expectedResult);
    const result = await north.getCacheFiles('2022-11-11T11:11:11.111Z', '2022-11-12T11:11:11.111Z', 'file');
    expect(result).toEqual(expectedResult);
  });

  it('should remove cache files', async () => {
    const files = ['file4.name', 'file5.name', 'file6.name'];
    await north.removeCacheFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Removing 3 cache files from North connector "${testData.north.list[0].name}"...`);
  });

  it('should archive cache files', async () => {
    const files = ['file4.name', 'file5.name', 'file6.name'];
    await north.archiveCacheFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Moving 3 cache files into archive from North connector "${testData.north.list[0].name}"...`);
  });

  it('should get archive files', async () => {
    const expectedResult = [
      { filename: 'file1.name', modificationDate: '', size: 1 },
      { filename: 'file2.name', modificationDate: '', size: 2 },
      { filename: 'file3.name', modificationDate: '', size: 3 }
    ];
    archiveService.getArchiveFiles.mockReturnValueOnce(expectedResult);
    const result = await north.getArchiveFiles('2022-11-11T11:11:11.111Z', '2022-11-12T11:11:11.111Z', 'file');
    expect(result).toEqual(expectedResult);
  });

  it('should remove archive files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.removeArchiveFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Removing 3 archive files from North connector "${testData.north.list[0].name}"...`);
  });

  it('should retry archive files', async () => {
    const files = ['file1.name', 'file2.name', 'file3.name'];
    await north.retryArchiveFiles(files);
    expect(logger.trace).toHaveBeenCalledWith(`Retrying 3 archive files in North connector "${testData.north.list[0].name}"...`);
  });

  it('should remove all archive files', async () => {
    await north.removeAllArchiveFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Removing all archive files from North connector "${testData.north.list[0].name}"...`);
  });

  it('should retry all archive files', async () => {
    await north.retryAllArchiveFiles();
    expect(logger.trace).toHaveBeenCalledWith(`Retrying all archive files in North connector "${testData.north.list[0].name}"...`);
  });

  it('should handle values properly', async () => {
    const valuesToSend = new Map<string, Array<OIBusContent>>();
    valuesToSend.set('queue-file.json', testData.oibusContent);
    valueCacheService.getValuesToSend.mockReturnValue(valuesToSend);
    north.handleContent = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('handle value error');
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('oibus error', true);
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('oibus error 2', false);
      });

    await north.handleValuesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    await north.handleValuesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while sending 3 values (1). handle value error`);
    await north.handleValuesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while sending 3 values (2). oibus error`);
    await north.handleValuesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while sending 3 values (3). oibus error 2`);
  });

  it('should handle files properly', async () => {
    fileCacheService.getFileToSend.mockReturnValue('file-to-send.csv');
    north.handleContent = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('handle value error');
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('oibus error', true);
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('oibus error 2', false);
      });

    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });
    (path.parse as jest.Mock).mockImplementation(filePath => ({ base: filePath }));

    await north.handleFilesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file-to-send.csv" (1). handle value error`);
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file-to-send.csv" (2). oibus error`);
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledWith(`Error while handling file "file-to-send.csv" (3). oibus error 2`);
  });

  it('should get cache values', async () => {
    north.getCacheValues('');
    expect(valueCacheService.getQueuedFilesMetadata).toHaveBeenCalledWith('');

    north.getCacheValues('file');
    expect(valueCacheService.getQueuedFilesMetadata).toHaveBeenCalledWith('file');
  });

  it('should remove all cache values', async () => {
    await north.removeAllCacheValues();
    expect(valueCacheService.removeAllValues).toHaveBeenCalled();
  });

  it('should remove cache values by filename', async () => {
    const filenames = ['file1.queue.tmp', 'file2.queue.tmp'];
    path.join = jest.fn().mockImplementation((...args) => args.join('/'));

    await north.removeCacheValues(filenames);

    expect(valueCacheService.removeSentValues).toHaveBeenCalledWith(
      new Map([
        ['valueFolder/file1.queue.tmp', []],
        ['valueFolder/file2.queue.tmp', []]
      ])
    );
  });

  it('should get cache values errors', async () => {
    north.getValueErrors('', '', '');
    expect(valueCacheService.getErrorValueFiles).toHaveBeenCalledWith('', '', '');

    north.getValueErrors('', '', 'file');
    expect(valueCacheService.getErrorValueFiles).toHaveBeenCalledWith('', '', 'file');
  });

  it('should remove cache value errors', async () => {
    await north.removeValueErrors(['file1.queue.tmp', 'file2.queue.tmp']);
    expect(valueCacheService.removeErrorValues).toHaveBeenCalledWith(['file1.queue.tmp', 'file2.queue.tmp']);
    expect(logger.trace).toHaveBeenCalledWith(`Removing 2 value error files from North connector "${testData.north.list[0].name}"...`);
  });

  it('should remove all cache value errors', async () => {
    await north.removeAllValueErrors();
    expect(valueCacheService.removeAllErrorValues).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Removing all value error files from North connector "${testData.north.list[0].name}"...`);
  });

  it('should retry cache value errors', async () => {
    await north.retryValueErrors(['file1.queue.tmp', 'file2.queue.tmp']);
    expect(valueCacheService.retryErrorValues).toHaveBeenCalledWith(['file1.queue.tmp', 'file2.queue.tmp']);
    expect(logger.trace).toHaveBeenCalledWith(`Retrying 2 value error files in North connector "${testData.north.list[0].name}"...`);
  });

  it('should retry all cache value errors', async () => {
    await north.retryAllValueErrors();
    expect(valueCacheService.retryAllErrorValues).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Retrying all value error files in North connector "${testData.north.list[0].name}"...`);
  });

  it('should get error file content', async () => {
    await north.getErrorFileContent('file1.queue.tmp');
    expect(fileCacheService.getErrorFileContent).toHaveBeenCalledWith('file1.queue.tmp');
  });

  it('should get cache file content', async () => {
    await north.getCacheFileContent('file1.queue.tmp');
    expect(fileCacheService.getCacheFileContent).toHaveBeenCalledWith('file1.queue.tmp');
  });

  it('should get archive file content', async () => {
    await north.getArchiveFileContent('file1.queue.tmp');
    expect(archiveService.getArchiveFileContent).toHaveBeenCalledWith('file1.queue.tmp');
  });
});

describe('NorthConnector disabled', () => {
  const cacheSize = 1_000_000_000;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (dirSize as jest.Mock).mockReturnValue(cacheSize);
    const valuesInQueue = new Map();
    valueCacheService.getValuesToSend.mockImplementation(() => valuesInQueue);
    valueCacheService.isEmpty.mockImplementation(() => false);
    fileCacheService.getFileToSend.mockImplementation(() => null);
    fileCacheService.isEmpty.mockImplementation(() => false);

    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(testData.north.list[1]);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    north = new NorthOIAnalytics(
      testData.north.list[1] as NorthConnectorEntity<NorthOIAnalyticsSettings>,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
  });

  afterEach(() => {
    valueCacheService.triggerRun.removeAllListeners();
    fileCacheService.triggerRun.removeAllListeners();
    archiveService.triggerRun.removeAllListeners();
  });

  it('should not call handle values if no values in queue', async () => {
    north.handleContent = jest.fn();
    await north.handleValuesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    expect(north.handleContent).not.toHaveBeenCalled();
  });

  it('should not call handle file if no file in queue', async () => {
    north.handleContent = jest.fn();
    await north.handleFilesWrapper();
    expect(logger.error).not.toHaveBeenCalled();
    expect(north.handleContent).not.toHaveBeenCalled();
  });

  it('should properly create an OIBus error', () => {
    expect(north.createOIBusError(new Error('node error'))).toEqual(new OIBusError('node error', false));
    expect(north.createOIBusError('string error')).toEqual(new OIBusError('string error', false));
    expect(north.createOIBusError(new OIBusError('oibus error', true))).toEqual(new OIBusError('oibus error', true));
    expect(north.createOIBusError({ field: 'another error' })).toEqual(new OIBusError(JSON.stringify({ field: 'another error' }), false));
  });

  it('should retry values and manage error', async () => {
    const valuesToSend = new Map<string, Array<OIBusContent>>();
    valuesToSend.set('queue-file.json', testData.oibusContent);
    valueCacheService.getValuesToSend.mockReturnValue(valuesToSend);

    north.handleContent = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new OIBusError('error 1', true);
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('error 2', true);
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('error 3', false);
      });
    await north.handleValuesWrapper();
    await north.handleValuesWrapper();
    await north.handleValuesWrapper();
    expect(logger.error).toHaveBeenCalledTimes(3);
    expect(valueCacheService.getValuesToSend).toHaveBeenCalledTimes(1);
    expect(valueCacheService.manageErroredValues).toHaveBeenCalledTimes(1);
  });

  it('should retry file and manage error', async () => {
    fileCacheService.getFileToSend.mockReturnValue('file-to-send.csv');
    north.handleContent = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new OIBusError('error 1', true);
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('error 2', true);
      })
      .mockImplementationOnce(() => {
        throw new OIBusError('error 3', false);
      });

    await north.handleFilesWrapper();
    await north.handleFilesWrapper();
    await north.handleFilesWrapper();
    expect(logger.error).toHaveBeenCalledTimes(3);
    expect(fileCacheService.getFileToSend).toHaveBeenCalledTimes(1);
    expect(fileCacheService.manageErroredFiles).toHaveBeenCalledTimes(1);
  });

  it('should use another logger', async () => {
    north.setLogger(anotherLogger);
    await north.retryAllErrorFiles();
    expect(anotherLogger.trace).toHaveBeenCalledTimes(1);
    expect(logger.trace).not.toHaveBeenCalled();
  });

  it('should reset cache', async () => {
    await north.resetCache();
    expect(fileCacheService.removeAllErrorFiles).toHaveBeenCalledTimes(1);
    expect(fileCacheService.removeAllCacheFiles).toHaveBeenCalledTimes(1);

    fileCacheService.removeAllErrorFiles.mockImplementationOnce(() => {
      throw new Error('removeAllErrorFiles error');
    });
    fileCacheService.removeAllCacheFiles.mockImplementationOnce(() => {
      throw new Error('removeAllCacheFiles error');
    });
    await north.resetCache();
    expect(logger.error).toHaveBeenCalledWith(`Error while removing error files. ${new Error('removeAllErrorFiles error')}`);
    expect(logger.error).toHaveBeenCalledWith(`Error while removing cache files. ${new Error('removeAllCacheFiles error')}`);
  });

  it('should manage caching file when cache size is more than max size', async () => {
    await north.start();
    await north.cacheFile('filePath');
    expect(logger.debug).toHaveBeenCalledWith(
      `North cache is exceeding the maximum allowed size ` +
        `(${Math.floor((cacheSize / 1024 / 1024) * 100) / 100} MB >= ${testData.north.list[1].caching.maxSize} MB). ` +
        'Files will be discarded until the cache is emptied (by sending files/values or manual removal)'
    );
  });

  it('should manage caching value when cache size is more than max size', async () => {
    await north.start();
    await north.cacheValues([]);
    expect(logger.debug).toHaveBeenCalledWith(
      `North cache is exceeding the maximum allowed size ` +
        `(${Math.floor((cacheSize / 1024 / 1024) * 100) / 100} MB >= ${testData.north.list[1].caching.maxSize} MB). ` +
        'Values will be discarded until the cache is emptied (by sending files/values or manual removal)'
    );
  });
});

describe('NorthConnector test', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(testData.north.list[1]);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    const testSettings = JSON.parse(JSON.stringify(testData.north.list[1]));
    testSettings.id = 'test';

    north = new NorthOIAnalytics(
      testSettings as NorthConnectorEntity<NorthOIAnalyticsSettings>,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
  });

  afterEach(() => {
    valueCacheService.triggerRun.removeAllListeners();
    fileCacheService.triggerRun.removeAllListeners();
    archiveService.triggerRun.removeAllListeners();
  });

  it('should check if North caches are empty', async () => {
    expect(await north.isCacheEmpty()).toBeFalsy();
  });
});
