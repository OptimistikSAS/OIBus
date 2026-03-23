import NorthConnector from './north-connector';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

import pino from 'pino';
import CacheServiceMock from '../tests/__mocks__/service/cache/cache-service.mock';
import { createOIBusError, delay, dirSize, generateRandomId, validateCronExpression } from '../service/utils';
import {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheMetadataSource,
  OIBusContent,
  OIBusFileContent
} from '../../shared/model/engine.model';
import testData from '../tests/utils/test-data';
import { NorthFileWriterSettings, NorthSettings } from '../../shared/model/north-settings.model';
import NorthFileWriter from './north-file-writer/north-file-writer';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { flushPromises } from '../tests/utils/test-utils';
import CacheService from '../service/cache/cache.service';
import { OIBusError } from '../model/engine.model';
import path from 'node:path';
import { DateTime } from 'luxon';
import { createReadStream, ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { createTransformer } from '../service/transformer.service';
import OIBusTransformerMock from '../tests/__mocks__/service/transformers/oibus-transformer.mock';
import OIBusTransformer from '../transformers/oibus-transformer';
import { NorthTransformerWithOptions } from '../model/transformer.model';

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

const contentToHandle: { filename: string; metadata: CacheMetadata } = {
  filename: 'file1.json',
  metadata: {
    contentFile: 'file1-123456.json',
    contentSize: 100,
    numberOfElement: 3,
    createdAt: testData.constants.dates.DATE_1,
    contentType: 'time-values'
  }
};

let north: NorthConnector<NorthSettings>;
let mockStream: ReadStream;
describe('NorthConnector', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (dirSize as jest.Mock).mockReturnValue(123);
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (createOIBusError as jest.Mock).mockImplementation(error => error);
    (cacheService.getNumberOfElementsInQueue as jest.Mock).mockReturnValue(0);
    (cacheService.getNumberOfRawFilesInQueue as jest.Mock).mockReturnValue(0);

    // Mock readable stream creation
    mockStream = { close: jest.fn() } as unknown as ReadStream;
    (Readable.from as jest.Mock).mockReturnValue(mockStream);
    (createReadStream as jest.Mock).mockReturnValue(mockStream);

    north = new NorthFileWriter(testData.north.list[0] as NorthConnectorEntity<NorthFileWriterSettings>, logger, cacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('should set and get connector configuration', async () => {
    const newConfig = JSON.parse(JSON.stringify(testData.north.list[0]));
    newConfig.name = 'Updated Name';
    newConfig.enabled = false;
    north.connect = jest.fn();
    north.connectorConfiguration = newConfig;
    await north.start();
    expect(cacheService.start).toHaveBeenCalled();
    expect(north.connect).not.toHaveBeenCalled();
    expect(north.connectorConfiguration).toEqual(newConfig);
  });

  it('should properly update cache size', async () => {
    const mockListener = jest.fn();
    await north.start();
    north.metricsEvent.on('cache-size', mockListener);

    cacheService.cacheSizeEventEmitter.emit('cache-size', { cache: 1, error: 2, archive: 3 });
    expect(mockListener).toHaveBeenCalledWith({
      cache: 1,
      error: 2,
      archive: 3
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
    expect(logger.info).toHaveBeenCalledWith(`"${testData.north.list[0].name}" stopped`);
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

  it('should search cache content', async () => {
    const searchParams = {
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    };
    await north.searchCacheContent(searchParams);
    expect(cacheService.searchCacheContent).toHaveBeenCalledWith(searchParams);
  });

  it('should reset cache', async () => {
    await north.resetCache();
    expect(cacheService.removeAllCacheContent).toHaveBeenCalledTimes(1);
  });

  it('should get file from cache', async () => {
    await north.getFileFromCache('cache', 'file1.queue.tmp');
    expect(cacheService.getFileFromCache).toHaveBeenCalledWith('cache', 'file1.queue.tmp');
  });

  it('should update cache content', async () => {
    const updateCommand: CacheContentUpdateCommand = {
      cache: { remove: [], move: [] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    };
    await north.updateCacheContent(updateCommand);
    expect(cacheService.updateCacheContent).toHaveBeenCalledWith(updateCommand);
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
    expect(delay).not.toHaveBeenCalled();
    expect(north.addTaskToQueue).toHaveBeenCalledTimes(1);
    expect(north.addTaskToQueue).toHaveBeenCalledWith({
      id: 'limit-reach',
      name: `Limit reach: ${north.connectorConfiguration.caching.trigger.numberOfElements} elements in queue >= ${north.connectorConfiguration.caching.trigger.numberOfElements}`
    });
    expect(north.run).not.toHaveBeenCalled();
  });

  it('should handle content and remove it when handled', async () => {
    (cacheService.getCacheContentToSend as jest.Mock).mockReturnValueOnce(contentToHandle);
    north.handleContent = jest.fn();
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).toHaveBeenCalledWith(north.connectorConfiguration.caching.throttling.maxNumberOfElements);
    expect(north.handleContent).toHaveBeenCalledWith(expect.anything(), contentToHandle.metadata);
    expect(cacheService.updateCacheContent).toHaveBeenCalledWith({
      cache: { remove: [contentToHandle.filename], move: [] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    });
  });

  it('should not handle content if not compatible', async () => {
    north['contentBeingSent'] = {
      filename: 'file1.json',
      metadata: {
        contentFile: 'file1-123456.json',
        contentSize: 100,
        numberOfElement: 3,
        createdAt: testData.constants.dates.DATE_1,
        contentType: 'opcua'
      }
    };
    north.handleContent = jest.fn();
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).not.toHaveBeenCalled();
    expect(north.handleContent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(`Unsupported data type: opcua (file file1.json)`);
    expect(cacheService.updateCacheContent).toHaveBeenCalledWith({
      cache: { remove: [], move: [{ to: 'error', filename: contentToHandle.filename }] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    });
  });

  it('should handle content and archive it when handled', async () => {
    north.connectorConfiguration.caching.archive.enabled = true;
    (cacheService.getCacheContentToSend as jest.Mock).mockReturnValueOnce(contentToHandle);
    north.handleContent = jest.fn();
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).toHaveBeenCalledWith(north.connectorConfiguration.caching.throttling.maxNumberOfElements);
    expect(north.handleContent).toHaveBeenCalledWith(expect.anything(), contentToHandle.metadata);
    expect(cacheService.updateCacheContent).toHaveBeenCalledWith({
      cache: { remove: [], move: [{ to: 'archive', filename: contentToHandle.filename }] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    });
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
    expect(north.handleContent).toHaveBeenCalledWith(expect.anything(), contentToHandle.metadata);
    // Should move to error folder since retry count exceeded
    expect(cacheService.updateCacheContent).toHaveBeenCalledWith({
      cache: { remove: [], move: [{ to: 'error', filename: contentToHandle.filename }] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    });
  });

  it('should handle content and do not move into error folder', async () => {
    north.connectorConfiguration.caching.error.retryCount = 0;
    (cacheService.getCacheContentToSend as jest.Mock).mockReturnValueOnce(contentToHandle);
    north.handleContent = jest.fn().mockImplementationOnce(() => {
      throw new OIBusError('handle error', true);
    });
    await north.handleContentWrapper();
    expect(cacheService.getCacheContentToSend).toHaveBeenCalledWith(north.connectorConfiguration.caching.throttling.maxNumberOfElements);
    expect(north.handleContent).toHaveBeenCalledWith(expect.anything(), contentToHandle.metadata);
    expect(cacheService.updateCacheContent).not.toHaveBeenCalled();
  });

  it('should cache json content without maxSendCount', async () => {
    north['connector'].caching.throttling.maxNumberOfElements = 0;
    north['connector'].transformers[1].inputType = 'time-values';

    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890');
    (cacheService.getNumberOfElementsInQueue as jest.Mock).mockReturnValueOnce((testData.oibusContent[0].content as Array<object>).length);
    (cacheService.getNumberOfRawFilesInQueue as jest.Mock).mockReturnValueOnce(1);

    const metadata: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 100,
      numberOfElement: (testData.oibusContent[0].content as Array<object>).length,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'time-values'
    };
    const outputStream = 'outputStream';
    (oiBusTransformer.transform as jest.Mock).mockReturnValueOnce({ metadata, output: outputStream });

    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    // Verify stream creation from content
    expect(Readable.from).toHaveBeenCalledWith(JSON.stringify(testData.oibusContent[0].content));

    // Verify transformer call with stream
    expect(oiBusTransformer.transform).toHaveBeenCalledWith(expect.anything(), { source: 'test' }, null);

    // Verify CacheService call with output stream
    expect(cacheService.addCacheContent).toHaveBeenCalledWith(outputStream, {
      contentType: metadata.contentType,
      contentFilename: metadata.contentFile,
      numberOfElement: metadata.numberOfElement
    });
  });

  it('should cache json content with maxSendCount', async () => {
    north['connector'].caching.throttling.maxNumberOfElements = testData.oibusContent[0].content!.length - 1;

    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890').mockReturnValueOnce('0987654321');

    const metadata: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '',
      contentType: 'time-values'
    };
    const outputStream1 = 'outputStream1';
    const outputStream2 = 'outputStream2';

    (oiBusTransformer.transform as jest.Mock)
      .mockReturnValueOnce({ metadata, output: outputStream1 })
      .mockReturnValueOnce({ metadata, output: outputStream2 });

    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    // Verify chunking logic
    expect(Readable.from).toHaveBeenCalledTimes(2);
    expect(createTransformer).toHaveBeenCalledTimes(1);

    expect(cacheService.addCacheContent).toHaveBeenCalledTimes(2);
    expect(cacheService.addCacheContent).toHaveBeenCalledWith(outputStream1, expect.anything());
    expect(cacheService.addCacheContent).toHaveBeenCalledWith(outputStream2, expect.anything());
  });

  it('should not cache json content if cache is full', async () => {
    (cacheService.cacheIsFull as jest.Mock).mockReturnValueOnce(true);
    north['findTransformer'] = jest.fn();
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    expect(north['findTransformer']).not.toHaveBeenCalled();
  });

  it('should cache json content and handle no transform', async () => {
    north['findTransformer'] = jest.fn().mockReturnValueOnce(null);
    north['handleNoTransformer'] = jest.fn();
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    expect(north['findTransformer']).toHaveBeenCalledTimes(1);
    expect(north['handleNoTransformer']).toHaveBeenCalledTimes(1);
  });

  it('should cache json content and handle ignore transform', async () => {
    north['findTransformer'] = jest.fn().mockReturnValueOnce({ transformer: { type: 'standard', functionName: 'ignore' } });
    north['handleNoTransformer'] = jest.fn();
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    expect(north['findTransformer']).toHaveBeenCalledTimes(1);
    expect(north['handleNoTransformer']).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Ignoring data of type ${testData.oibusContent[0].type}`);
  });

  it('should cache json content and handle iso transform', async () => {
    north['findTransformer'] = jest.fn().mockReturnValueOnce({ transformer: { type: 'standard', functionName: 'iso' } });
    north['handleNoTransformer'] = jest.fn();
    north['cacheWithoutTransformAndTrigger'] = jest.fn();
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    expect(north['findTransformer']).toHaveBeenCalledTimes(1);
    expect(north['handleNoTransformer']).not.toHaveBeenCalled();
    expect(north['cacheWithoutTransformAndTrigger']).toHaveBeenCalled();
  });

  it('should cache file content', async () => {
    north['connector'].transformers[1].inputType = 'any';
    (generateRandomId as jest.Mock).mockReturnValueOnce('1234567890');

    const metadata: CacheMetadata = {
      contentFile: `${path.parse((testData.oibusContent[1] as OIBusFileContent).filePath).name}-1234567890.csv`,
      contentSize: 100,
      numberOfElement: 0,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'any'
    };
    const outputStream = 'outputStream';
    (oiBusTransformer.transform as jest.Mock).mockReturnValueOnce({ metadata, output: outputStream });

    await north.cacheContent(testData.oibusContent[1], { source: 'test' });

    expect(createReadStream).toHaveBeenCalledWith((testData.oibusContent[1] as OIBusFileContent).filePath);

    expect(oiBusTransformer.transform).toHaveBeenCalledWith(
      expect.anything(),
      { source: 'test' },
      expect.stringContaining('1234567890') // cacheFilename generated inside
    );

    expect(cacheService.addCacheContent).toHaveBeenCalledWith(outputStream, {
      contentType: metadata.contentType,
      contentFilename: metadata.contentFile,
      numberOfElement: metadata.numberOfElement
    });
  });

  it('should cache any data without transform', async () => {
    (createReadStream as jest.Mock).mockReturnValueOnce('readStream');

    await north['cacheWithoutTransform']({
      type: 'any',
      filePath: 'path/file.csv'
    });

    expect(createReadStream).toHaveBeenCalledWith('path/file.csv');
    expect(cacheService.addCacheContent).toHaveBeenCalledWith('readStream', {
      contentType: 'any',
      contentFilename: 'path/file.csv'
    });
  });

  it('should find transformer from south metadata', () => {
    expect(
      north['findTransformer'](
        {
          type: 'time-values'
        } as OIBusContent,
        { source: 'south', southId: 'southId1', items: [testData.south.list[0].items[0]] } as CacheMetadataSource
      )
    ).toEqual(north['connector'].transformers[0]);

    north['connector'].transformers[0].items = [];
    expect(
      north['findTransformer'](
        {
          type: 'time-values'
        } as OIBusContent,
        { source: 'south', southId: 'southId1', items: [testData.south.list[0].items[0]] } as CacheMetadataSource
      )
    ).toEqual(north['connector'].transformers[0]);

    north['connector'].transformers[0].south = undefined;
    expect(
      north['findTransformer'](
        {
          type: 'time-values'
        } as OIBusContent,
        { source: 'south', southId: 'southId1', items: [testData.south.list[0].items[0]] } as CacheMetadataSource
      )
    ).toEqual(north['connector'].transformers[0]);
  });

  it('should find transformer from south metadata at group level', () => {
    north['connector'].transformers[0].items = [];
    north['connector'].transformers[0].group = { id: 'groupId1', name: 'Group 1' };
    north['connector'].transformers[0].south = {
      id: testData.south.list[0].id,
      name: testData.south.list[0].name,
      type: testData.south.list[0].type,
      description: testData.south.list[0].description,
      enabled: testData.south.list[0].enabled
    };

    const itemWithMatchingGroup = {
      ...testData.south.list[0].items[0],
      group: {
        id: 'groupId1',
        name: 'Group 1',
        southId: 'southId1',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: null
      }
    };

    expect(
      north['findTransformer'](
        { type: 'time-values' } as OIBusContent,
        { source: 'south', southId: 'southId1', items: [itemWithMatchingGroup] } as CacheMetadataSource
      )
    ).toEqual(north['connector'].transformers[0]);

    // Item with non-matching group should not select the group-level transformer
    const itemWithDifferentGroup = {
      ...testData.south.list[0].items[0],
      group: {
        id: 'groupId2',
        name: 'Group 2',
        southId: 'southId1',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: null
      }
    };
    expect(
      north['findTransformer'](
        { type: 'time-values' } as OIBusContent,
        { source: 'south', southId: 'southId1', items: [itemWithDifferentGroup] } as CacheMetadataSource
      )
    ).not.toEqual(north['connector'].transformers[0]);
  });

  it('should handle no transformer when not supporting type', async () => {
    north['cacheWithoutTransformAndTrigger'] = jest.fn();
    await north['handleNoTransformer']({ type: 'bad' } as unknown as OIBusContent);
    expect(logger.trace).toHaveBeenCalledWith(`Data type "bad" not supported by the connector. Data will be ignored.`);
    expect(north['cacheWithoutTransformAndTrigger']).not.toHaveBeenCalled();
  });

  it('should handle no transformer when supporting type', async () => {
    north['cacheWithoutTransform'] = jest.fn();
    north['triggerRunIfNecessary'] = jest.fn();
    await north['handleNoTransformer']({ type: 'time-values' } as OIBusContent);
    expect(north['cacheWithoutTransform']).toHaveBeenCalledTimes(1);
    expect(north['triggerRunIfNecessary']).toHaveBeenCalledTimes(1);
  });

  it('should transformer any-content payload', async () => {
    const options: NorthTransformerWithOptions = {
      id: 'northId'
    } as NorthTransformerWithOptions;
    const transform = jest.fn().mockReturnValueOnce({
      output: 'output',
      metadata: {
        contentType: 'opcua',
        numberOfElement: 1
      }
    });
    (createTransformer as jest.Mock).mockReturnValueOnce({ transform });
    await north['executeTransformation']({ type: 'any-content', content: '' }, options, { source: 'oianalytics' });
    expect(transform).toHaveBeenCalledWith(expect.anything(), { source: 'oianalytics' }, null);
    expect(cacheService.addCacheContent).toHaveBeenCalledWith('output', {
      contentType: 'opcua',
      numberOfElement: 1
    });
  });

  it('should transformer setpoint payload', async () => {
    const options: NorthTransformerWithOptions = {
      id: 'northId'
    } as NorthTransformerWithOptions;
    const transform = jest.fn().mockReturnValueOnce({
      output: 'output',
      metadata: {
        contentType: 'opcua',
        numberOfElement: 1
      }
    });
    (createTransformer as jest.Mock).mockReturnValueOnce({ transform });
    await north['executeTransformation']({ type: 'setpoint', content: [] }, options, { source: 'oianalytics' });
    expect(transform).toHaveBeenCalledWith(expect.anything(), { source: 'oianalytics' }, null);
    expect(cacheService.addCacheContent).toHaveBeenCalledWith('output', {
      contentType: 'opcua',
      numberOfElement: 1
    });
  });

  it('should cache without transform with max number of elements', async () => {
    north.connectorConfiguration.caching.throttling.maxNumberOfElements = 1;
    await north['cacheWithoutTransform']({ type: 'time-values', content: [{}, {}] } as OIBusContent);
    expect(cacheService.addCacheContent).toHaveBeenCalledTimes(2);
  });

  it('should cache without transform with any-content', async () => {
    north.connectorConfiguration.caching.throttling.maxNumberOfElements = 1;
    await north['cacheWithoutTransform']({ type: 'any-content', content: '' } as OIBusContent);
    expect(cacheService.addCacheContent).toHaveBeenCalledTimes(1);
  });

  it('should cache without transform', async () => {
    north.connectorConfiguration.caching.throttling.maxNumberOfElements = 0;
    await north['cacheWithoutTransform']({ type: 'time-values', content: [{}, {}] } as OIBusContent);
    expect(cacheService.addCacheContent).toHaveBeenCalledTimes(1);
  });

  it('should get cache folder', () => {
    expect(north['getCacheFolder']()).toEqual('cache');
  });
});
