import NorthConnector from './north-connector';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

import pino from 'pino';
import CacheServiceMock from '../tests/__mocks__/service/cache/cache-service.mock';
import { createBaseFolders, delay, dirSize, generateRandomId, validateCronExpression } from '../service/utils';
import { CacheMetadata, OIBusRawContent, OIBusTimeValueContent } from '../../shared/model/engine.model';
import testData from '../tests/utils/test-data';
import { NorthFileWriterSettings, NorthSettings } from '../../shared/model/north-settings.model';
import NorthFileWriter from './north-file-writer/north-file-writer';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { flushPromises } from '../tests/utils/test-utils';
import CacheService from '../service/cache/cache.service';
import { OIBusError } from '../model/engine.model';
import fsAsync from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { createTransformer } from '../service/transformer.service';
import OIBusTransformerMock from '../tests/__mocks__/service/transformers/oibus-transformer.mock';
import OIBusTransformer from '../service/transformers/oibus-transformer';
import IgnoreTransformer from '../service/transformers/ignore-transformer';
import IsoTransformer from '../service/transformers/iso-transformer';

// Mock fs
jest.mock('node:stream');
jest.mock('node:fs');
jest.mock('node:fs/promises');

// Mock services
jest.mock('../service/utils');
jest.mock('../service/transformer.service');

const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const contentToHandle: { metadataFilename: string; metadata: CacheMetadata } = {
  metadataFilename: 'file1.json',
  metadata: {
    contentFile: 'file1-123456.json',
    contentSize: 100,
    numberOfElement: 3,
    createdAt: testData.constants.dates.DATE_1,
    contentType: 'time-values',
    source: 'south',
    options: {}
  }
};

let north: NorthConnector<NorthSettings>;
describe('NorthConnector', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (dirSize as jest.Mock).mockReturnValue(123);
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    north = new NorthFileWriter(
      testData.north.list[0] as NorthConnectorEntity<NorthFileWriterSettings>,
      logger,
      'cacheFolder',
      cacheService
    );
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    await north.start();
    expect(north.isEnabled()).toEqual(true);
    expect(logger.debug).toHaveBeenCalledWith(`North connector "${testData.north.list[0].name}" enabled`);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      `North connector "${testData.north.list[0].name}" of type ${testData.north.list[0].type} started`
    );
    expect(north.connectorConfiguration).toEqual(testData.north.list[0]);
  });

  it('should properly update cache size', () => {
    const mockListener = jest.fn();
    north.metricsEvent.on('cache-size', mockListener);

    cacheService.cacheSizeEventEmitter.emit('init-cache-size', { cacheSizeToAdd: 1, errorSizeToAdd: 2, archiveSizeToAdd: 3 });
    expect(mockListener).toHaveBeenCalledWith({
      cacheSize: 1,
      errorSize: 2,
      archiveSize: 3
    });

    cacheService.cacheSizeEventEmitter.emit('cache-size', { cacheSizeToAdd: 1, errorSizeToAdd: 2, archiveSizeToAdd: 3 });
    expect(mockListener).toHaveBeenCalledWith({
      cacheSize: 2,
      errorSize: 4,
      archiveSize: 6
    });
  });

  it('should properly create cron job and add to queue', async () => {
    north.addTaskToQueue = jest.fn();
    await north.connect();
    expect(logger.debug).toHaveBeenCalledWith(
      `Creating cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );

    await north.connect();
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );

    jest.advanceTimersByTime(1000);
    expect(north.addTaskToQueue).toHaveBeenCalledTimes(1);
    expect(north.addTaskToQueue).toHaveBeenCalledWith({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });

    await north.updateScanMode(testData.scanMode.list[0]);
    await north.updateScanMode(testData.scanMode.list[1]);
    expect(logger.debug).toHaveBeenCalledWith(
      `Creating cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
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
      `Error when creating cron job for scan mode "${testData.scanMode.list[0].name}" (* * * * * *L): ${error.message}`
    );
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    await north.start();
    north.run = jest.fn();
    north.addTaskToQueue({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });
    expect(logger.debug).not.toHaveBeenCalledWith(`Task "${testData.scanMode.list[0].name}" is already in queue`);

    expect(north.run).toHaveBeenCalledWith({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });
    expect(north.run).toHaveBeenCalledTimes(1);
    north.addTaskToQueue({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });

    expect(logger.debug).toHaveBeenCalledWith(`Task "${testData.scanMode.list[0].name}" is already in queue`);
    expect(north.run).toHaveBeenCalledTimes(1);

    north.addTaskToQueue({ id: 'other id', name: testData.scanMode.list[0].name });
    expect(north.run).toHaveBeenCalledTimes(1);
  });

  it('should properly run a task', async () => {
    north.handleContentWrapper = jest.fn();
    north['triggerRunIfNecessary'] = jest.fn();
    await north.run({ id: 'scanModeId1', name: 'scan' });

    expect(north.handleContentWrapper).toHaveBeenCalledTimes(1);
    expect(north['triggerRunIfNecessary']).toHaveBeenCalledTimes(1);
    expect(north['triggerRunIfNecessary']).toHaveBeenCalledWith(north['connector'].caching.throttling.runMinDelay);
  });

  it('should properly run a task and trigger next after error', async () => {
    north['errorCount'] = 1;
    north.handleContentWrapper = jest.fn();
    north['triggerRunIfNecessary'] = jest.fn();
    await north.run({ id: 'scanModeId1', name: 'scan' });
    expect(north['triggerRunIfNecessary']).toHaveBeenCalledWith(north['connector'].caching.error.retryInterval);
  });

  it('should properly run two times if a task is already in queue', async () => {
    await north.start();
    north['taskJobQueue'] = [
      { id: 'scanModeId1', name: 'scan' },
      { id: 'previous-task', name: 'previous task' }
    ];
    north.handleContentWrapper = jest.fn();
    north['triggerRunIfNecessary'] = jest.fn();
    await north.run({ id: 'scanModeId1', name: 'scan' });
    expect(logger.trace).toHaveBeenCalledWith(`North run triggered by task "scan" (scanModeId1)`);
    expect(logger.trace).toHaveBeenCalledWith(`North run triggered by task "previous task" (previous-task)`);
    expect(north.handleContentWrapper).toHaveBeenCalledTimes(2);
    expect(north['triggerRunIfNecessary']).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect', async () => {
    await north.disconnect();
    expect(logger.info).toHaveBeenCalledWith(`"${testData.north.list[0].name}" (${testData.north.list[0].id}) disconnected`);
  });

  it('should properly stop', async () => {
    north.disconnect = jest.fn();
    await north.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping "${testData.north.list[0].name}" (${testData.north.list[0].id})...`);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info(`North connector "${testData.north.list[0].name}" stopped`));
  });

  it('should properly stop when not data stream', async () => {
    north.disconnect = jest.fn();
    await north.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping "${testData.north.list[0].name}" (${testData.north.list[0].id})...`);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info(`North connector "${testData.north.list[0].name}" stopped`));
  });

  it('should properly stop with running task ', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    north.handleContentWrapper = jest.fn(async () => promise);

    north.disconnect = jest.fn();

    north.run({ id: 'scanModeId1', name: 'scan' });

    north.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping "${testData.north.list[0].name}" (${testData.north.list[0].id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for task to finish');
    expect(north.disconnect).not.toHaveBeenCalled();
    north.run({ id: 'trigger1', name: 'Another trigger' });
    expect(logger.debug).toHaveBeenCalledWith(
      'Task "Another trigger" not run because the connector is stopping or a run is already in progress'
    );
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`"${testData.north.list[0].name}" stopped`);
  });

  it('should check if North caches are empty', async () => {
    (cacheService.cacheIsEmpty as jest.Mock).mockReturnValueOnce(true);
    expect(north.isCacheEmpty()).toBeTruthy();
  });

  it('should check if North is subscribed to all South', async () => {
    expect(north.isSubscribed('southId1')).toBeTruthy();
    expect(north.isSubscribed('badId')).toBeFalsy();
  });

  it('should search cache content', async () => {
    const expectedResult = [
      { filename: 'file1.name', modificationDate: '', size: 1 },
      { filename: 'file2.name', modificationDate: '', size: 2 },
      { filename: 'file3.name', modificationDate: '', size: 3 }
    ];
    (cacheService.searchCacheContent as jest.Mock).mockReturnValueOnce(expectedResult);
    const result = await north.searchCacheContent(
      { start: '2022-11-11T11:11:11.111Z', end: '2022-11-12T11:11:11.111Z', nameContains: 'file' },
      'cache'
    );
    expect(result).toEqual(expectedResult);
  });

  it('should reset cache', async () => {
    await north.resetCache();
    expect(cacheService.removeAllCacheContent).toHaveBeenCalledWith('cache');
    expect(cacheService.removeAllCacheContent).toHaveBeenCalledWith('error');
    expect(cacheService.removeAllCacheContent).toHaveBeenCalledWith('archive');
  });

  it('should get cache content list from file list', async () => {
    await north.metadataFileListToCacheContentList('cache', ['file1.queue.tmp']);
    expect(cacheService.metadataFileListToCacheContentList).toHaveBeenCalledWith('cache', ['file1.queue.tmp']);
  });

  it('should get cache content file stream', async () => {
    await north.getCacheContentFileStream('cache', 'file1.queue.tmp');
    expect(cacheService.getCacheContentFileStream).toHaveBeenCalledWith('cache', 'file1.queue.tmp');
  });

  it('should remove cache content', async () => {
    const files: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [
      { metadataFilename: 'file1.name', metadata: {} as CacheMetadata },
      { metadataFilename: 'file2.name', metadata: {} as CacheMetadata },
      { metadataFilename: 'file3.name', metadata: {} as CacheMetadata }
    ];
    await north.removeCacheContent('cache', files);
    expect(cacheService.removeCacheContent).toHaveBeenCalledWith('cache', files[0]);
    expect(cacheService.removeCacheContent).toHaveBeenCalledWith('cache', files[1]);
    expect(cacheService.removeCacheContent).toHaveBeenCalledWith('cache', files[2]);
  });

  it('should remove all cache content', async () => {
    await north.removeAllCacheContent('cache');
    expect(cacheService.removeAllCacheContent).toHaveBeenCalledWith('cache');
  });

  it('should move cache content', async () => {
    const files: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [
      { metadataFilename: 'file1.name', metadata: {} as CacheMetadata },
      { metadataFilename: 'file2.name', metadata: {} as CacheMetadata },
      { metadataFilename: 'file3.name', metadata: {} as CacheMetadata }
    ];
    await north.moveCacheContent('cache', 'error', files);
    expect(cacheService.moveCacheContent).toHaveBeenCalledWith('cache', 'error', files[0]);
    expect(cacheService.moveCacheContent).toHaveBeenCalledWith('cache', 'error', files[1]);
    expect(cacheService.moveCacheContent).toHaveBeenCalledWith('cache', 'error', files[2]);
  });

  it('should retry all cache content', async () => {
    await north.moveAllCacheContent('cache', 'error');
    expect(cacheService.moveAllCacheContent).toHaveBeenCalledWith('cache', 'error');
  });

  it('should use another logger', async () => {
    north.setLogger(anotherLogger);
    (logger.debug as jest.Mock).mockClear();
    await north.stop();
    expect(anotherLogger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('should trigger run if necessary because of retry', async () => {
    north.addTaskToQueue = jest.fn();
    north.run = jest.fn();
    north['errorCount'] = 1;
    await north['triggerRunIfNecessary'](0);
    expect(delay).not.toHaveBeenCalled();
    expect(north.addTaskToQueue).toHaveBeenCalledTimes(1);
    expect(north.addTaskToQueue).toHaveBeenCalledWith({
      id: 'retry',
      name: `Retry content after 1 errors`
    });
    expect(north.run).not.toHaveBeenCalled();
  });

  it('should trigger run if necessary because of group count', async () => {
    (cacheService.getNumberOfElementsInQueue as jest.Mock).mockReturnValueOnce(
      north.connectorConfiguration.caching.trigger.numberOfElements
    );
    north.addTaskToQueue = jest.fn();
    north.run = jest.fn();
    await north['triggerRunIfNecessary'](0);
    expect(delay).not.toHaveBeenCalled(); // Once at startup with default delay
    expect(north.addTaskToQueue).toHaveBeenCalledTimes(1);
    expect(north.addTaskToQueue).toHaveBeenCalledWith({
      id: 'limit-reach',
      name: `Limit reach: ${north.connectorConfiguration.caching.trigger.numberOfElements} elements in queue >= ${north.connectorConfiguration.caching.trigger.numberOfElements}`
    });
    expect(north.run).not.toHaveBeenCalled();
  });

  it('should trigger run if necessary because of file trigger', async () => {
    (cacheService.getNumberOfRawFilesInQueue as jest.Mock).mockReturnValueOnce(1);
    north.addTaskToQueue = jest.fn();
    await north['triggerRunIfNecessary'](10);
    expect(delay).toHaveBeenCalledWith(10);
    expect(north.addTaskToQueue).toHaveBeenCalledTimes(1);
    expect(north.addTaskToQueue).toHaveBeenCalledWith({
      id: 'limit-reach',
      name: `1 files in queue, sending it immediately`
    });
  });

  it('should handle content and remove it when handled', async () => {
    (cacheService.getCacheContentToSend as jest.Mock).mockReturnValueOnce(contentToHandle);
    north.handleContent = jest.fn();
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).toHaveBeenCalledWith(north.connectorConfiguration.caching.throttling.maxNumberOfElements);
    expect(north.handleContent).toHaveBeenCalledWith({
      ...contentToHandle.metadata,
      contentFile: path.join('cache', 'content', 'file1-123456.json')
    });
    expect(cacheService.removeCacheContent).toHaveBeenCalledWith('cache', contentToHandle);
    expect(cacheService.moveCacheContent).not.toHaveBeenCalled();
  });

  it('handleContentWrapper should not retrieve content if content already being sent', async () => {
    north['contentBeingSent'] = contentToHandle;
    north.handleContent = jest.fn().mockImplementationOnce(() => {
      throw new Error('error');
    });
    north.createOIBusError = jest.fn().mockReturnValueOnce(new OIBusError('error', true));
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).not.toHaveBeenCalled();
    expect(north.handleContent).toHaveBeenCalledWith({
      ...contentToHandle.metadata,
      contentFile: path.join('cache', 'content', 'file1-123456.json')
    });
    expect(cacheService.removeCacheContent).not.toHaveBeenCalled();
    expect(cacheService.moveCacheContent).not.toHaveBeenCalled();
  });

  it('should handle content and archive it when handled', async () => {
    north.connectorConfiguration.caching.archive.enabled = true;
    (cacheService.getCacheContentToSend as jest.Mock).mockReturnValueOnce(contentToHandle);
    north.handleContent = jest.fn();
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).toHaveBeenCalledWith(north.connectorConfiguration.caching.throttling.maxNumberOfElements);
    expect(north.handleContent).toHaveBeenCalledWith({
      ...contentToHandle.metadata,
      contentFile: path.join('cache', 'content', 'file1-123456.json')
    });
    expect(cacheService.moveCacheContent).toHaveBeenCalledWith('cache', 'archive', contentToHandle);
    expect(cacheService.removeCacheContent).not.toHaveBeenCalled();
  });

  it('should not handle content if no content to handle', async () => {
    (cacheService.getCacheContentToSend as jest.Mock).mockReturnValueOnce(null);
    north.handleContent = jest.fn();
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).toHaveBeenCalledWith(north.connectorConfiguration.caching.throttling.maxNumberOfElements);
    expect(north.handleContent).not.toHaveBeenCalled();
  });

  it('should handle content and manage errors', async () => {
    north.connectorConfiguration.caching.error.retryCount = 0;
    (cacheService.getCacheContentToSend as jest.Mock).mockReturnValueOnce(contentToHandle);
    north.handleContent = jest.fn().mockImplementationOnce(() => {
      throw new OIBusError('handle error', false);
    });
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).toHaveBeenCalledWith(north.connectorConfiguration.caching.throttling.maxNumberOfElements);
    expect(north.handleContent).toHaveBeenCalledWith({
      ...contentToHandle.metadata,
      contentFile: path.join('cache', 'content', 'file1-123456.json')
    });
    expect(cacheService.removeCacheContent).not.toHaveBeenCalled();
    expect(cacheService.moveCacheContent).toHaveBeenCalledWith('cache', 'error', contentToHandle);
  });

  it('should cache json content without maxSendCount', async () => {
    north['connector'].caching.throttling.maxNumberOfElements = 0;
    (fsAsync.stat as jest.Mock).mockReturnValueOnce({ size: 100, ctimeMs: 123 });
    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890');
    (Readable.from as jest.Mock).mockReturnValueOnce('readStream');
    const metadata: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 100,
      numberOfElement: (testData.oibusContent[0].content as Array<object>).length,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'time-values',
      source: 'south',
      options: {}
    };
    (oiBusTransformer.transform as jest.Mock).mockReturnValueOnce({ metadata, output: 'output' });
    await north.cacheContent(testData.oibusContent[0], 'south');

    expect(oiBusTransformer.transform).toHaveBeenCalledWith('readStream', 'south', null);
    expect(Readable.from).toHaveBeenCalledWith(JSON.stringify(testData.oibusContent[0].content));
    expect(createTransformer).toHaveBeenCalledWith(
      { transformer: testData.transformers.list[0], options: {}, inputType: 'time-values' },
      testData.north.list[0],
      logger
    );

    expect(fsAsync.stat).toHaveBeenCalledWith(path.join(cacheService.cacheFolder, cacheService.CONTENT_FOLDER, '1234567890.json'));
    expect(fsAsync.writeFile).toHaveBeenCalledWith(
      path.join(cacheService.cacheFolder, cacheService.METADATA_FOLDER, '1234567890.json'),
      JSON.stringify(metadata),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(cacheService.addCacheContentToQueue).toHaveBeenCalledWith({ metadataFilename: '1234567890.json', metadata });
  });

  it('should cache json content with maxSendCount', async () => {
    north['connector'].caching.throttling.maxNumberOfElements = testData.oibusContent[0].content!.length - 1;

    (fsAsync.stat as jest.Mock).mockReturnValueOnce({ size: 100, ctimeMs: 123 }).mockReturnValueOnce({ size: 100, ctimeMs: 123 });
    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890').mockReturnValueOnce('0987654321');
    (Readable.from as jest.Mock).mockReturnValueOnce('readStream').mockReturnValueOnce('readStream');
    const metadata1: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 100,
      numberOfElement: (testData.oibusContent[0].content as Array<object>).length - 1,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'time-values',
      source: 'south',
      options: {}
    };
    const metadata2: CacheMetadata = {
      contentFile: '0987654321.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'time-values',
      source: 'south',
      options: {}
    };
    (oiBusTransformer.transform as jest.Mock)
      .mockReturnValueOnce({ metadata: metadata1, output: 'output1' })
      .mockReturnValueOnce({ metadata: metadata2, output: 'output2' });

    await north.cacheContent(testData.oibusContent[0], 'south');

    expect(fsAsync.writeFile).toHaveBeenCalledWith(
      path.join(cacheService.cacheFolder, cacheService.CONTENT_FOLDER, '1234567890.json'),
      'output1',
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(fsAsync.writeFile).toHaveBeenCalledWith(
      path.join(cacheService.cacheFolder, cacheService.CONTENT_FOLDER, '0987654321.json'),
      'output2',
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(Readable.from).toHaveBeenCalledWith(
      JSON.stringify(testData.oibusContent[0].content!.slice(0, testData.oibusContent[0].content!.length - 1))
    );
    expect(Readable.from).toHaveBeenCalledWith(
      JSON.stringify([testData.oibusContent[0].content![testData.oibusContent[0].content!.length - 1]])
    );
    expect(createTransformer).toHaveBeenCalledTimes(1);

    expect(fsAsync.stat).toHaveBeenCalledWith(path.join(cacheService.cacheFolder, cacheService.CONTENT_FOLDER, '1234567890.json'));
    expect(fsAsync.stat).toHaveBeenCalledWith(path.join(cacheService.cacheFolder, cacheService.CONTENT_FOLDER, '0987654321.json'));
    expect(fsAsync.writeFile).toHaveBeenCalledWith(
      path.join(cacheService.cacheFolder, cacheService.METADATA_FOLDER, '1234567890.json'),
      JSON.stringify(metadata1),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(fsAsync.writeFile).toHaveBeenCalledWith(
      path.join(cacheService.cacheFolder, cacheService.METADATA_FOLDER, '0987654321.json'),
      JSON.stringify(metadata2),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(cacheService.addCacheContentToQueue).toHaveBeenCalledWith({ metadataFilename: '1234567890.json', metadata: metadata1 });
    expect(cacheService.addCacheContentToQueue).toHaveBeenCalledWith({ metadataFilename: '0987654321.json', metadata: metadata2 });
  });

  it('should cache setpoint content', async () => {
    (fsAsync.stat as jest.Mock).mockReturnValueOnce({ size: 100, ctimeMs: 123 });
    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890');
    (createReadStream as jest.Mock).mockReturnValueOnce('readStream');
    const metadata: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 0,
      numberOfElement: 1,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'setpoint',
      source: 'south',
      options: {}
    };
    (oiBusTransformer.transform as jest.Mock).mockReturnValueOnce({ metadata, output: 'output' });
    north.persistDataInCache = jest.fn();
    await north.cacheContent(testData.oibusContent[3], 'south');

    expect(north.persistDataInCache).toHaveBeenCalledWith(metadata, 'output');
  });

  it('should cache file content', async () => {
    (fsAsync.stat as jest.Mock).mockReturnValueOnce({ size: 100, ctimeMs: 123 });
    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890');
    (createReadStream as jest.Mock).mockReturnValueOnce('readStream');
    const metadata: CacheMetadata = {
      contentFile: `${path.parse((testData.oibusContent[1] as OIBusRawContent).filePath).name}-1234567890.csv`,
      contentSize: 100,
      numberOfElement: 0,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'any',
      source: 'south',
      options: {}
    };
    (oiBusTransformer.transform as jest.Mock).mockReturnValueOnce({ metadata, output: 'output' });
    await north.cacheContent(testData.oibusContent[1], 'south');

    expect(fsAsync.writeFile).toHaveBeenCalledWith(
      path.join(
        cacheService.cacheFolder,
        cacheService.CONTENT_FOLDER,
        `${path.parse((testData.oibusContent[1] as OIBusRawContent).filePath).name}-1234567890.csv`
      ),
      'output',
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(createReadStream).toHaveBeenCalledWith((testData.oibusContent[1] as OIBusRawContent).filePath);
    expect(createTransformer).toHaveBeenCalledWith(
      { transformer: testData.transformers.list[1], options: {}, inputType: 'any' },
      testData.north.list[0],
      logger
    );

    expect(fsAsync.stat).toHaveBeenCalledWith(
      path.join(
        cacheService.cacheFolder,
        cacheService.CONTENT_FOLDER,
        `${path.parse((testData.oibusContent[1] as OIBusRawContent).filePath).name}-1234567890.csv`
      )
    );
    expect(fsAsync.writeFile).toHaveBeenCalledWith(
      path.join(cacheService.cacheFolder, cacheService.METADATA_FOLDER, '1234567890.json'),
      JSON.stringify(metadata),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    expect(cacheService.addCacheContentToQueue).toHaveBeenCalledWith({ metadataFilename: '1234567890.json', metadata });
  });

  it('should not cache content if max size reach', async () => {
    north['connector'].caching.throttling.maxSize = 1;
    north['cacheSize'].cacheSize = (north['connector'].caching.throttling.maxSize + 1) * 1024 * 1024;
    await north.cacheContent(testData.oibusContent[0], 'south');

    expect(logger.warn).toHaveBeenCalledWith(
      `North cache is exceeding the maximum allowed size (2 MB >= ${north['connector'].caching.throttling.maxSize} MB). Values will be discarded until the cache is emptied (by sending files/values or manual removal)`
    );
    await north.cacheContent(testData.oibusContent[0], 'south');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(createTransformer).not.toHaveBeenCalled();
  });

  it('should not cache content if transformer not found', async () => {
    north['connector'].transformers = [];
    north['supportedTypes'] = () => [];
    await north.cacheContent(
      {
        type: 'any',
        filePath: 'path/file.csv'
      },
      'south'
    );

    expect(logger.trace).toHaveBeenCalledWith(`Data type "any" not supported by the connector. Data will be ignored.`);
    expect(createTransformer).not.toHaveBeenCalled();
  });

  it('should cache content without transform', async () => {
    north['connector'].transformers = [];
    north['cacheWithoutTransform'] = jest.fn();
    await north.cacheContent(
      {
        type: 'any',
        filePath: 'path/file.csv'
      },
      'south'
    );

    expect(north['cacheWithoutTransform']).toHaveBeenCalledTimes(1);
  });

  it('should ignore content if ignore transformer is selected', async () => {
    north['connector'].transformers = [
      {
        transformer: {
          id: 'transformerId3',
          type: 'standard',
          functionName: IgnoreTransformer.transformerName,
          inputType: 'any',
          outputType: 'any'
        },
        options: {},
        inputType: 'any'
      }
    ];
    await north.cacheContent(
      {
        type: 'any',
        filePath: 'path/file.csv'
      },
      'south'
    );

    expect(logger.trace).toHaveBeenCalledWith(`Ignoring data of type any`);
  });

  it('should not transformer content if iso transformer is selected', async () => {
    north['connector'].transformers = [
      {
        transformer: {
          id: 'transformerId4',
          type: 'standard',
          functionName: IsoTransformer.transformerName,
          inputType: 'any',
          outputType: 'any'
        },
        options: {},
        inputType: 'any'
      }
    ];
    north['cacheWithoutTransform'] = jest.fn();
    await north.cacheContent(
      {
        type: 'any',
        filePath: 'path/file.csv'
      },
      'south'
    );

    expect(north['cacheWithoutTransform']).toHaveBeenCalledTimes(1);
  });

  it('should cache any data without transform', async () => {
    (createReadStream as jest.Mock).mockReturnValueOnce('readStream');
    (generateRandomId as jest.Mock).mockReturnValueOnce('123456');
    north.persistDataInCache = jest.fn();
    await north['cacheWithoutTransform'](
      {
        type: 'any',
        filePath: 'path/file.csv'
      },
      'south'
    );

    expect(north.persistDataInCache).toHaveBeenCalledWith(
      {
        contentFile: 'file-123456.csv',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'any',
        source: 'south',
        options: {}
      },
      'readStream'
    );
  });

  it('should cache time values data without transform and without chunks', async () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890');
    north.persistDataInCache = jest.fn();
    north['connector'].caching.throttling.maxNumberOfElements = 0;
    await north['cacheWithoutTransform'](testData.oibusContent[0], 'south');

    expect(north.persistDataInCache).toHaveBeenCalledWith(
      {
        contentFile: '1234567890',
        contentSize: 0,
        createdAt: '',
        numberOfElement: (testData.oibusContent[0] as OIBusTimeValueContent).content.length,
        contentType: 'time-values',
        source: 'south',
        options: {}
      },
      Readable.from(JSON.stringify((testData.oibusContent[0] as OIBusTimeValueContent).content))
    );
  });

  it('should cache time values data without transform and with chunks', async () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890').mockReturnValueOnce('1234567890').mockReturnValueOnce('1234567890');
    north.persistDataInCache = jest.fn();
    north['connector'].caching.throttling.maxNumberOfElements = 1;
    await north['cacheWithoutTransform'](testData.oibusContent[0], 'south');

    expect(north.persistDataInCache).toHaveBeenCalledWith(
      {
        contentFile: '1234567890',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 1,
        contentType: 'time-values',
        source: 'south',
        options: {}
      },
      Readable.from(JSON.stringify([(testData.oibusContent[0] as OIBusTimeValueContent).content[0]]))
    );
    expect(north.persistDataInCache).toHaveBeenCalledTimes(3);
    expect(generateRandomId).toHaveBeenCalledTimes(3);
  });

  it('should create OIBus error', () => {
    expect(north.createOIBusError('error')).toEqual(new OIBusError('error', false));
    expect(north.createOIBusError(new Error('error'))).toEqual(new OIBusError('error', false));
    expect(north.createOIBusError(400)).toEqual(new OIBusError('400', false));
    expect(north.createOIBusError(new OIBusError('error', false))).toEqual(new OIBusError('error', false));
  });
});

describe('NorthConnector test id', () => {
  const northTest: NorthConnectorEntity<NorthFileWriterSettings> = JSON.parse(JSON.stringify(testData.north.list[0]));

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    northTest.id = 'test';

    north = new NorthFileWriter(northTest, logger, 'cacheFolder', cacheService);
  });

  it('should properly start with test id', async () => {
    north.connect = jest.fn();
    await north.start();
    expect(createBaseFolders).not.toHaveBeenCalled();
    expect(cacheService.start).toHaveBeenCalledTimes(1);
    expect(north.connect).toHaveBeenCalledTimes(1);
  });

  it('should properly connect with test it', async () => {
    await north.connect();
    expect(logger.info).toHaveBeenCalledWith(`North connector "${northTest.name}" of type ${northTest.type} started`);
  });
});
