import assert from 'node:assert/strict';
import fs, { type ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { DateTime } from 'luxon';

import type { OIBusAnyContent, OIBusContent, OIBusFileContent } from '../../shared/model/common/content.model';
import type { NorthFileWriterSettings, NorthSettings } from '../../shared/model/connector/north-settings.model';
import type { CacheContentUpdateCommand, CacheMetadata } from '../../shared/model/domain/engine.model';

import { CacheMetadataSource, CacheMetadataSourceOriginSouth, OIBusError } from '../model/engine.model';
import type { NorthConnectorEntity } from '../model/north-connector.model';
import type { SouthConnectorEntityLight, SouthConnectorItemEntityLight, SouthItemGroupEntity } from '../model/south-connector.model';
import type { NorthTransformerWithOptions, SourceOriginSouth } from '../model/transformer.model';
import type CacheService from '../service/cache/cache.service';
import type * as Utils from '../service/utils';
import { createCacheServiceMock } from '../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../tests/__mocks__/service/transformers/oibus-transformer.mock';
import testData from '../tests/utils/test-data';
import { createMock, flushPromises, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type NorthConnectorClass from './north-connector';
import type NorthFileWriterClass from './north-file-writer/north-file-writer';

const nodeRequire = createRequire(import.meta.url);

type Transformers = NorthConnectorEntity<NorthSettings>['transformers'];

/** A transformer of time values routed from a south (south, group or items level) */
const timeValuesTransformer = (id: string, transformerId: string, source: Record<string, unknown>) => ({
  id,
  options: {},
  transformer: { id: transformerId, type: 'standard', functionName: 'noop', outputType: 'record-list' },
  source: { type: 'south', group: undefined, items: [], ...source }
});

/** Content cached by a south, without items */
const southSource: CacheMetadataSourceOriginSouth = {
  source: 'south',
  queryTime: testData.constants.dates.FAKE_NOW,
  southId: testData.south.list[1].id,
  southName: testData.south.list[1].name,
  items: []
};

const timeValue = (pointId: string, value: number) => ({ pointId, timestamp: '2020-01-01T00:00:00.000Z', value });

/** Time values cached by the south "southX" for the given items */
const southXSource = (items: Array<{ id: string; name: string }>) =>
  ({ source: 'south', southId: 'southX', items }) as unknown as CacheMetadataSourceOriginSouth;

const logged = (fn: PinoLogger['debug'], message: string) => fn.mock.calls.some(call => call.arguments[0] === message);

describe('NorthConnector', () => {
  let NorthFileWriter: typeof NorthFileWriterClass;

  let logger: PinoLogger;
  let cacheService: Mocked<CacheService>;
  let oiBusTransformer: OIBusTransformerMock;
  let createReadStream: Mock<typeof fs.createReadStream>;

  const realUtils: typeof Utils = nodeRequire('../service/utils');
  const createUtilsMocks = () => ({
    delay: mock.fn(async (_timeout: number) => undefined),
    generateRandomId: mock.fn((_size?: number) => '1234567890')
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };
  // The real transformer.service (runTransformerOnContent...): only the transformer creation is controlled
  const transformerServiceExports: Record<string, unknown> = {};
  const loggerService = { createChildLogger: (..._args: Array<unknown>): PinoLogger => logger };
  let createTransformer: Mock<() => OIBusTransformerMock>;

  before(() => {
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../service/logger/logger.service', { loggerService, default: class {} });
    // Loaded after the utils mock, so that it uses the mocked generateRandomId
    Object.assign(transformerServiceExports, reloadModule(nodeRequire, '../service/transformer.service'));
    mockModule(nodeRequire, '../service/transformer.service', transformerServiceExports);

    NorthFileWriter = reloadModule<{ default: typeof NorthFileWriterClass }>(nodeRequire, './north-file-writer/north-file-writer').default;
  });

  const contentToHandle: { filename: string; metadata: CacheMetadata } = {
    filename: 'file1.json',
    metadata: {
      contentFile: 'file1-123456.json',
      contentSize: 100,
      numberOfElement: 3,
      createdAt: testData.constants.dates.DATE_1,
      contentType: 'record-list'
    }
  };

  let north: NorthConnectorClass<NorthSettings>;

  beforeEach(() => {
    logger = new PinoLogger();
    cacheService = createCacheServiceMock();
    oiBusTransformer = new OIBusTransformerMock();
    createTransformer = mock.fn(() => oiBusTransformer);
    transformerServiceExports.createTransformer = createTransformer;
    Object.assign(utilsExports, createUtilsMocks());
    createReadStream = mock.method(fs, 'createReadStream', () => createMock<ReadStream>());
    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

    north = new NorthFileWriter(structuredClone(testData.north.list[0]) as NorthConnectorEntity<NorthFileWriterSettings>, cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  // Assign transformers through the setter, which also invalidates the transformer lookup so it is rebuilt on the next
  // cacheContent call. maxNumberOfElements=0 so that time-values aren't chunked.
  const setConnectorTransformers = (transformers: Array<unknown>) => {
    north.connectorConfiguration = {
      ...north['connector'],
      caching: { ...north['connector'].caching, throttling: { ...north['connector'].caching.throttling, maxNumberOfElements: 0 } },
      transformers: transformers as Transformers
    };
  };

  it('should be properly initialized', async () => {
    await north.start();
    assert.strictEqual(north.isEnabled(), true);
    assert.ok(logged(logger.debug, `North connector "${testData.north.list[0].name}" enabled`));
    assert.strictEqual(logger.error.mock.calls.length, 0);
    assert.ok(logged(logger.info, `North connector "${testData.north.list[0].name}" of type ${testData.north.list[0].type} started`));
    assert.deepStrictEqual(north.connectorConfiguration, testData.north.list[0]);
  });

  it('should set and get connector configuration', async () => {
    const newConfig = JSON.parse(JSON.stringify(testData.north.list[0]));
    newConfig.name = 'Updated Name';
    newConfig.enabled = false;
    const connectMock = mock.fn(async () => undefined);
    north.connect = connectMock;
    north.connectorConfiguration = newConfig;
    await north.start();
    assert.strictEqual(cacheService.start.mock.calls.length, 1);
    assert.strictEqual(connectMock.mock.calls.length, 0);
    assert.deepStrictEqual(north.connectorConfiguration, newConfig);
  });

  it('should properly update cache size', async () => {
    const mockListener = mock.fn();
    await north.start();
    north.metricsEvent.on('cache-size', mockListener);

    cacheService.cacheSizeEventEmitter.emit('cache-size', { cache: 1, error: 2, archive: 3 });
    assert.strictEqual(mockListener.mock.calls.length, 1);
    assert.deepStrictEqual(mockListener.mock.calls[0].arguments[0], { cache: 1, error: 2, archive: 3 });
  });

  it('should relay cache content size', async () => {
    const mockListener = mock.fn();
    await north.start();
    north.metricsEvent.on('cache-content-size', mockListener);

    cacheService.cacheSizeEventEmitter.emit('cache-content-size', 512);
    assert.strictEqual(mockListener.mock.calls.length, 1);
    assert.strictEqual(mockListener.mock.calls[0].arguments[0], 512);
  });

  it('should add to queue when the triggered scan mode matches the configured trigger scan mode', async () => {
    const addTaskToQueueMock = mock.fn((_taskDescription: { id: string; name: string }) => undefined);
    north.addTaskToQueue = addTaskToQueueMock;
    north.isEnabled = mock.fn((): boolean => true);

    north.trigger(testData.scanMode.list[0]);

    assert.strictEqual(addTaskToQueueMock.mock.calls.length, 1);
    assert.deepStrictEqual(addTaskToQueueMock.mock.calls[0].arguments[0], {
      id: testData.scanMode.list[0].id,
      name: testData.scanMode.list[0].name
    });
  });

  it('should not add to queue when the triggered scan mode does not match the configured trigger scan mode', async () => {
    const addTaskToQueueMock = mock.fn((_taskDescription: { id: string; name: string }) => undefined);
    north.addTaskToQueue = addTaskToQueueMock;
    north.isEnabled = mock.fn((): boolean => true);

    north.trigger(testData.scanMode.list[1]);

    assert.strictEqual(addTaskToQueueMock.mock.calls.length, 0);
  });

  it('should not add to queue when disabled, even if the scan mode matches', async () => {
    const addTaskToQueueMock = mock.fn((_taskDescription: { id: string; name: string }) => undefined);
    north.addTaskToQueue = addTaskToQueueMock;
    north.isEnabled = mock.fn((): boolean => false);

    north.trigger(testData.scanMode.list[0]);

    assert.strictEqual(addTaskToQueueMock.mock.calls.length, 0);
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    await north.start();
    const runMock = mock.fn(async (_taskDescription: { id: string; name: string }) => undefined);
    north.run = runMock;
    north.addTaskToQueue({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });

    assert.ok(!logged(logger.debug, `Task "${testData.scanMode.list[0].name}" is already in queue`));
    assert.strictEqual(runMock.mock.calls.length, 1);
    assert.deepStrictEqual(runMock.mock.calls[0].arguments[0], {
      id: testData.scanMode.list[0].id,
      name: testData.scanMode.list[0].name
    });

    north.addTaskToQueue({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });
    assert.ok(logged(logger.debug, `Task "${testData.scanMode.list[0].name}" is already in queue`));
    assert.strictEqual(runMock.mock.calls.length, 1);

    north.addTaskToQueue({ id: 'other id', name: testData.scanMode.list[0].name });
    assert.strictEqual(runMock.mock.calls.length, 1);
  });

  it('should properly run a task', async () => {
    const handleContentWrapperMock = mock.fn(async () => undefined);
    north.handleContentWrapper = handleContentWrapperMock;
    const triggerRunIfNecessaryMock = mock.fn(async (_timeToWait: number) => undefined);
    north['triggerRunIfNecessary'] = triggerRunIfNecessaryMock;
    await north.run({ id: 'scanModeId1', name: 'scan' });

    assert.strictEqual(handleContentWrapperMock.mock.calls.length, 1);
    assert.strictEqual(triggerRunIfNecessaryMock.mock.calls.length, 1);
    assert.deepStrictEqual(triggerRunIfNecessaryMock.mock.calls[0].arguments[0], north['connector'].caching.throttling.runMinDelay);
  });

  it('should properly run a task and trigger next after error', async () => {
    north['errorCount'] = 1;
    north.handleContentWrapper = mock.fn(async () => undefined);
    const triggerRunIfNecessaryMock = mock.fn(async (_timeToWait: number) => undefined);
    north['triggerRunIfNecessary'] = triggerRunIfNecessaryMock;
    await north.run({ id: 'scanModeId1', name: 'scan' });
    assert.deepStrictEqual(triggerRunIfNecessaryMock.mock.calls[0].arguments[0], north['connector'].caching.error.retryInterval);
  });

  it('should clean up queue and deferred promise when run() throws unexpectedly', async () => {
    north['taskJobQueue'] = [{ id: 'scanModeId1', name: 'scan' }];
    const runError = new Error('unexpected cache read failure');
    north.handleContentWrapper = mock.fn(async () => {
      throw runError;
    });

    await north.run({ id: 'scanModeId1', name: 'scan' });

    assert.strictEqual(north['taskJobQueue'].length, 0);
    assert.strictEqual(north['runProgress$'], null);
    assert.ok(
      logger.error.mock.calls.some(
        c =>
          (c.arguments[0] as string).includes('Unhandled error in North task runner') &&
          (c.arguments[0] as string).includes(runError.message)
      )
    );
  });

  it('should properly run two times if a task is already in queue', async () => {
    await north.start();
    north['taskJobQueue'] = [
      { id: 'scanModeId1', name: 'scan' },
      { id: 'previous-task', name: 'previous task' }
    ];
    const handleContentWrapperMock = mock.fn(async () => undefined);
    north.handleContentWrapper = handleContentWrapperMock;
    const triggerRunIfNecessaryMock = mock.fn(async (_timeToWait: number) => undefined);
    north['triggerRunIfNecessary'] = triggerRunIfNecessaryMock;
    await north.run({ id: 'scanModeId1', name: 'scan' });
    assert.ok(logged(logger.trace, `North run triggered by task "scan" (scanModeId1)`));
    assert.ok(logged(logger.trace, `North run triggered by task "previous task" (previous-task)`));
    assert.strictEqual(handleContentWrapperMock.mock.calls.length, 2);
    assert.strictEqual(triggerRunIfNecessaryMock.mock.calls.length, 1);
  });

  it('should properly disconnect', async () => {
    await north.disconnect();
    assert.ok(logged(logger.info, `"${testData.north.list[0].name}" (${testData.north.list[0].id}) disconnected`));
  });

  it('should properly stop', async () => {
    const disconnectMock = mock.fn(async () => undefined);
    north.disconnect = disconnectMock;
    await north.stop();
    assert.ok(logged(logger.debug, `Stopping "${testData.north.list[0].name}" (${testData.north.list[0].id})...`));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(logged(logger.info, `"${testData.north.list[0].name}" stopped`));
  });

  it('should properly stop with running task', async () => {
    let resolvePromise!: () => void;
    const promise = new Promise<void>(resolve => {
      resolvePromise = resolve;
    });
    north.handleContentWrapper = mock.fn(async () => promise);
    const disconnectMock = mock.fn(async () => undefined);
    north.disconnect = disconnectMock;

    north.run({ id: 'scanModeId1', name: 'scan' });

    north.stop();
    assert.ok(logged(logger.debug, `Stopping "${testData.north.list[0].name}" (${testData.north.list[0].id})...`));
    assert.ok(logged(logger.debug, 'Waiting for task to finish'));
    assert.strictEqual(disconnectMock.mock.calls.length, 0);

    north.run({ id: 'trigger1', name: 'Another trigger' });
    assert.ok(logged(logger.debug, 'Task "Another trigger" not run because the connector is stopping or a run is already in progress'));

    resolvePromise();
    await flushPromises();
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(logged(logger.info, `"${testData.north.list[0].name}" stopped`));
  });

  it('should check if North caches are empty', async () => {
    cacheService.cacheIsEmpty.mock.mockImplementation(() => true);
    assert.strictEqual(north.isCacheEmpty(), true);
  });

  it('should search cache content', async () => {
    const searchParams = {
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    };
    await north.searchCacheContent(searchParams);
    assert.strictEqual(cacheService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.searchCacheContent.mock.calls[0].arguments[0], searchParams);
  });

  it('should reset cache', async () => {
    await north.resetCache();
    assert.strictEqual(cacheService.removeAllCacheContent.mock.calls.length, 1);
  });

  it('should get file from cache', async () => {
    await north.getFileFromCache('cache', 'file1.queue.tmp');
    assert.strictEqual(cacheService.getFileFromCache.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.getFileFromCache.mock.calls[0].arguments, ['cache', 'file1.queue.tmp']);
  });

  it('should update cache content', async () => {
    const updateCommand: CacheContentUpdateCommand = {
      cache: { remove: [], move: [] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    };
    await north.updateCacheContent(updateCommand);
    assert.strictEqual(cacheService.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.updateCacheContent.mock.calls[0].arguments[0], updateCommand);
  });

  it('should refresh logger on refreshLogger()', async () => {
    const refreshedLogger = new PinoLogger();
    const createChildLogger = mock.method(loggerService, 'createChildLogger', () => refreshedLogger);

    north.refreshLogger();

    assert.strictEqual(createChildLogger.mock.calls.length, 1);
    assert.deepStrictEqual(createChildLogger.mock.calls[0].arguments, ['north', testData.north.list[0].id, testData.north.list[0].name]);
    assert.strictEqual(cacheService.refreshLogger.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.refreshLogger.mock.calls[0].arguments, [
      'north',
      testData.north.list[0].id,
      testData.north.list[0].name
    ]);
    // The connector now logs with the new child logger
    await north.stop();
    assert.strictEqual(refreshedLogger.debug.mock.calls.length, 1);
    assert.strictEqual(logger.debug.mock.calls.length, 0);
  });

  it('should trigger run if necessary because of retry', async () => {
    const addTaskToQueueMock = mock.fn((_taskDescription: { id: string; name: string }) => undefined);
    north.addTaskToQueue = addTaskToQueueMock;
    const runMock = mock.fn(async (_taskDescription: { id: string; name: string }) => undefined);
    north.run = runMock;
    north['errorCount'] = 1;
    await north['triggerRunIfNecessary'](0);
    assert.strictEqual(utilsExports.delay.mock.calls.length, 0);
    assert.strictEqual(addTaskToQueueMock.mock.calls.length, 1);
    assert.deepStrictEqual(addTaskToQueueMock.mock.calls[0].arguments[0], {
      id: 'retry',
      name: `Retry content after 1 errors`
    });
    assert.strictEqual(runMock.mock.calls.length, 0);
  });

  it('should trigger run if necessary because of group count', async () => {
    let callCount = 0;
    cacheService.getNumberOfElementsInQueue.mock.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return north.connectorConfiguration.caching.trigger.numberOfElements;
      return 0;
    });
    const addTaskToQueueMock = mock.fn((_taskDescription: { id: string; name: string }) => undefined);
    north.addTaskToQueue = addTaskToQueueMock;
    const runMock = mock.fn(async (_taskDescription: { id: string; name: string }) => undefined);
    north.run = runMock;
    await north['triggerRunIfNecessary'](0);
    assert.strictEqual(utilsExports.delay.mock.calls.length, 0);
    assert.strictEqual(addTaskToQueueMock.mock.calls.length, 1);
    assert.deepStrictEqual(addTaskToQueueMock.mock.calls[0].arguments[0], {
      id: 'limit-reach',
      name: `Limit reach: ${north.connectorConfiguration.caching.trigger.numberOfElements} elements in queue >= ${north.connectorConfiguration.caching.trigger.numberOfElements}`
    });
    assert.strictEqual(runMock.mock.calls.length, 0);
  });

  it('should handle content and remove it when handled', async () => {
    cacheService.getCacheContentToSend.mock.mockImplementation(async () => contentToHandle);
    const handleContentMock = mock.fn(async () => undefined);
    north.handleContent = handleContentMock;
    await north.handleContentWrapper();
    assert.strictEqual(cacheService.getCacheContentToSend.mock.calls.length, 1);
    assert.deepStrictEqual(
      cacheService.getCacheContentToSend.mock.calls[0].arguments[0],
      north.connectorConfiguration.caching.throttling.maxNumberOfElements
    );
    assert.strictEqual(handleContentMock.mock.calls.length, 1);
    assert.strictEqual(cacheService.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.updateCacheContent.mock.calls[0].arguments[0], {
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
    const handleContentMock = mock.fn(async () => undefined);
    north.handleContent = handleContentMock;
    await north.handleContentWrapper();
    assert.strictEqual(cacheService.getCacheContentToSend.mock.calls.length, 0);
    assert.strictEqual(handleContentMock.mock.calls.length, 0);
    assert.ok(logged(logger.error, `Unsupported data type: opcua (file file1.json)`));
    assert.deepStrictEqual(cacheService.updateCacheContent.mock.calls[0].arguments[0], {
      cache: { remove: [], move: [{ to: 'error', filename: contentToHandle.filename }] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    });
  });

  it('should handle content and archive it when handled', async () => {
    north.connectorConfiguration.caching.archive.enabled = true;
    cacheService.getCacheContentToSend.mock.mockImplementation(async () => contentToHandle);
    const handleContentMock = mock.fn(async () => undefined);
    north.handleContent = handleContentMock;
    await north.handleContentWrapper();
    assert.deepStrictEqual(
      cacheService.getCacheContentToSend.mock.calls[0].arguments[0],
      north.connectorConfiguration.caching.throttling.maxNumberOfElements
    );
    assert.strictEqual(handleContentMock.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.updateCacheContent.mock.calls[0].arguments[0], {
      cache: { remove: [], move: [{ to: 'archive', filename: contentToHandle.filename }] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    });
  });

  it('should not handle content if no content to handle', async () => {
    cacheService.getCacheContentToSend.mock.mockImplementation(async () => null);
    const handleContentMock = mock.fn(async () => undefined);
    north.handleContent = handleContentMock;
    await north.handleContentWrapper();
    assert.deepStrictEqual(
      cacheService.getCacheContentToSend.mock.calls[0].arguments[0],
      north.connectorConfiguration.caching.throttling.maxNumberOfElements
    );
    assert.strictEqual(handleContentMock.mock.calls.length, 0);
  });

  it('should handle content and manage errors', async () => {
    north.connectorConfiguration.caching.error.retryCount = 0;
    cacheService.getCacheContentToSend.mock.mockImplementation(async () => contentToHandle);
    const handleContentMock = mock.fn(async () => {
      throw new OIBusError('handle error', false);
    });
    north.handleContent = handleContentMock;
    await north.handleContentWrapper();
    assert.strictEqual(cacheService.getCacheContentToSend.mock.calls.length, 1);
    assert.strictEqual(handleContentMock.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.updateCacheContent.mock.calls[0].arguments[0], {
      cache: { remove: [], move: [{ to: 'error', filename: contentToHandle.filename }] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    });
  });

  it('should handle content and do not move into error folder', async () => {
    north.connectorConfiguration.caching.error.retryCount = 0;
    cacheService.getCacheContentToSend.mock.mockImplementation(async () => contentToHandle);
    const handleContentMock = mock.fn(async () => {
      throw new OIBusError('handle error', true);
    });
    north.handleContent = handleContentMock;
    await north.handleContentWrapper();
    assert.strictEqual(cacheService.getCacheContentToSend.mock.calls.length, 1);
    assert.strictEqual(handleContentMock.mock.calls.length, 1);
    assert.strictEqual(cacheService.updateCacheContent.mock.calls.length, 0);
  });

  it('should cache json content without maxSendCount', async () => {
    north['connector'].caching.throttling.maxNumberOfElements = 0;
    let elemCallCount = 0;
    cacheService.getNumberOfElementsInQueue.mock.mockImplementation(() => {
      elemCallCount += 1;
      if (elemCallCount === 1) return (testData.oibusContent[0].content as Array<object>).length;
      return 0;
    });
    let rawFilesCallCount = 0;
    cacheService.getNumberOfRawFilesInQueue.mock.mockImplementation(() => {
      rawFilesCallCount += 1;
      if (rawFilesCallCount === 1) return 1;
      return 0;
    });

    const metadata: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 100,
      numberOfElement: (testData.oibusContent[0].content as Array<object>).length,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'record-list'
    };
    const outputStream = Buffer.from('outputStream');
    oiBusTransformer.transformInMemory.mock.mockImplementation(async () => ({ metadata, output: outputStream }));

    await north.cacheContent(testData.oibusContent[0], southSource);

    assert.strictEqual(oiBusTransformer.transformInMemory.mock.calls.length, 1);
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[0].arguments[0], testData.oibusContent[0].content);
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[0].arguments[1], southSource);
    assert.strictEqual(oiBusTransformer.transformInMemory.mock.calls[0].arguments[2], null);

    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], outputStream);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], {
      contentType: metadata.contentType,
      contentFilename: metadata.contentFile,
      numberOfElement: metadata.numberOfElement
    });
  });

  it('should cache json content with maxSendCount', async () => {
    north['connector'].caching.throttling.maxNumberOfElements = testData.oibusContent[0].content!.length - 1;

    const metadata: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '',
      contentType: 'record-list'
    };
    const outputStream1 = Buffer.from('outputStream1');
    const outputStream2 = Buffer.from('outputStream2');

    let transformCallCount = 0;
    oiBusTransformer.transformInMemory.mock.mockImplementation(async () => {
      transformCallCount += 1;
      return { metadata, output: transformCallCount === 1 ? outputStream1 : outputStream2 };
    });

    await north.cacheContent(testData.oibusContent[0], southSource);

    assert.strictEqual(createTransformer.mock.calls.length, 1);

    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 2);
    assert.strictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], outputStream1);
    assert.strictEqual(cacheService.addCacheContent.mock.calls[1].arguments[0], outputStream2);
  });

  it('should split a multi-item time-values batch across per-item transformers', async () => {
    setConnectorTransformers([
      timeValuesTransformer('t1', 'tr1', { south: { id: 'southX' }, items: [{ id: 'i1', name: 'point-1' }] }),
      timeValuesTransformer('t2', 'tr2', { south: { id: 'southX' }, items: [{ id: 'i2', name: 'point-2' }] })
    ]);

    const v1 = timeValue('point-1', 1);
    const v2 = timeValue('point-2', 2);
    const v3 = timeValue('point-1', 3);

    await north.cacheContent(
      { type: 'record-list', content: [v1, v2, v3] },
      southXSource([
        { id: 'i1', name: 'point-1' },
        { id: 'i2', name: 'point-2' }
      ])
    );

    // Two transformers run, each on its own item's values (point-1's two values together, point-2 alone).
    assert.strictEqual(oiBusTransformer.transformInMemory.mock.calls.length, 2);
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[0].arguments[0], [v1, v3]);
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[0].arguments[1], {
      source: 'south',
      southId: 'southX',
      items: [{ id: 'i1', name: 'point-1' }]
    });
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[1].arguments[0], [v2]);
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[1].arguments[1], {
      source: 'south',
      southId: 'southX',
      items: [{ id: 'i2', name: 'point-2' }]
    });
  });

  it('should not split a multi-item batch when all items resolve to the same transformer', async () => {
    setConnectorTransformers([
      timeValuesTransformer('t1', 'tr1', {
        south: { id: 'southX' },
        items: [
          { id: 'i1', name: 'point-1' },
          { id: 'i2', name: 'point-2' }
        ]
      })
    ]);

    const content = [timeValue('point-1', 1), timeValue('point-2', 2)];
    await north.cacheContent(
      { type: 'record-list', content },
      southXSource([
        { id: 'i1', name: 'point-1' },
        { id: 'i2', name: 'point-2' }
      ])
    );

    // Single transformer covers both items → one call over the whole batch (no split).
    assert.strictEqual(oiBusTransformer.transformInMemory.mock.calls.length, 1);
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[0].arguments[0], content);
  });

  it('should not cache json content if cache is full', async () => {
    cacheService.cacheIsFull.mock.mockImplementation(() => true);
    const findTransformerMock = mock.fn((_metadataSource: CacheMetadataSource) => undefined as NorthTransformerWithOptions | undefined);
    north['findTransformer'] = findTransformerMock;
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    assert.strictEqual(findTransformerMock.mock.calls.length, 0);
  });

  it('should drop the content no transformer is configured for', async () => {
    const findTransformerMock = mock.fn((_metadataSource: CacheMetadataSource) => undefined as NorthTransformerWithOptions | undefined);
    north['findTransformer'] = findTransformerMock;
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    assert.strictEqual(findTransformerMock.mock.calls.length, 1);
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 0);
    assert.ok(logged(logger.trace, `No transformer configured for data of type ${testData.oibusContent[0].type}. Data will be ignored.`));
  });

  it('should trigger a run check after caching content', async () => {
    north['findTransformer'] = mock.fn((_metadataSource: CacheMetadataSource) => undefined as NorthTransformerWithOptions | undefined);
    const triggerRunIfNecessaryMock = mock.fn(async (_timeToWait: number) => undefined);
    north['triggerRunIfNecessary'] = triggerRunIfNecessaryMock;
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    assert.strictEqual(triggerRunIfNecessaryMock.mock.calls.length, 1);
    assert.strictEqual(triggerRunIfNecessaryMock.mock.calls[0].arguments[0], 0);
  });

  it('should not trigger an immediate retry after caching content while a send is failing', async () => {
    north['errorCount'] = 1;
    const triggerRunIfNecessaryMock = mock.fn(async (_timeToWait: number) => undefined);
    north['triggerRunIfNecessary'] = triggerRunIfNecessaryMock;
    await north.cacheContent(testData.oibusContent[0], southSource);

    // Content is still cached, but the retry stays paced by run() and caching.error.retryInterval
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.strictEqual(triggerRunIfNecessaryMock.mock.calls.length, 0);
  });

  it('should cache files and payloads as is through the file transformer', async () => {
    north['findTransformer'] = mock.fn(
      (_metadataSource: CacheMetadataSource) => ({ transformer: { type: 'standard', functionName: 'file' } }) as NorthTransformerWithOptions
    );
    const cacheWithoutTransformMock = mock.fn(async (_data: OIBusFileContent | OIBusAnyContent) => undefined);
    north['cacheWithoutTransform'] = cacheWithoutTransformMock;
    const executeTransformationMock = mock.fn(async () => undefined);
    north['executeTransformation'] = executeTransformationMock;

    await north.cacheContent({ type: 'any-content', content: '{}' }, { source: 'test' });
    await north.cacheContent({ type: 'any', filePath: 'file.csv' }, { source: 'test' });
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    // Records are written as a JSON file by the transformer itself
    assert.strictEqual(cacheWithoutTransformMock.mock.calls.length, 2);
    assert.strictEqual(executeTransformationMock.mock.calls.length, 1);
  });

  it('should cache file content', async () => {
    const metadata: CacheMetadata = {
      contentFile: `${path.parse((testData.oibusContent[1] as OIBusFileContent).filePath).name}-1234567890.csv`,
      contentSize: 100,
      numberOfElement: 0,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'any'
    };
    const outputStream = Buffer.from('outputStream');
    oiBusTransformer.transform.mock.mockImplementation(async () => ({ metadata, output: outputStream }));

    await north.cacheContent(testData.oibusContent[1], southSource);

    assert.strictEqual(createReadStream.mock.calls.length, 1);
    assert.deepStrictEqual(createReadStream.mock.calls[0].arguments[0], (testData.oibusContent[1] as OIBusFileContent).filePath);

    assert.strictEqual(oiBusTransformer.transform.mock.calls.length, 1);
    assert.deepStrictEqual(oiBusTransformer.transform.mock.calls[0].arguments[1], southSource);
    // Third arg (cacheFilename) should contain '1234567890'
    assert.ok(
      typeof oiBusTransformer.transform.mock.calls[0].arguments[2] === 'string' &&
        (oiBusTransformer.transform.mock.calls[0].arguments[2] as string).includes('1234567890')
    );

    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], outputStream);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], {
      contentType: metadata.contentType,
      contentFilename: metadata.contentFile,
      numberOfElement: metadata.numberOfElement
    });
  });

  it('should cache any data without transform', async () => {
    const readStream = createMock<ReadStream>();
    createReadStream.mock.mockImplementation(() => readStream);

    await north['cacheWithoutTransform']({
      type: 'any',
      filePath: 'path/file.csv'
    });

    assert.strictEqual(createReadStream.mock.calls.length, 1);
    assert.deepStrictEqual(createReadStream.mock.calls[0].arguments[0], 'path/file.csv');
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.strictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], readStream);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], {
      contentType: 'any',
      contentFilename: 'file.csv' // basename — full path is never leaked into cache metadata
    });
  });

  it('should find transformer from south metadata', () => {
    const expectedTransformer = north['connector'].transformers[0];

    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'south',
        southId: testData.south.list[0].id,
        items: [testData.south.list[0].items[0]]
      } as CacheMetadataSource),
      expectedTransformer
    );

    (expectedTransformer.source as SourceOriginSouth).items = [];
    north['rebuildTransformerCache']();
    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'south',
        southId: testData.south.list[0].id,
        items: [testData.south.list[0].items[0]]
      } as CacheMetadataSource),
      expectedTransformer
    );

    expectedTransformer.source = { type: 'oibus-api', dataSourceId: 'id' };
    north['rebuildTransformerCache']();
    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'oibus-api',
        dataSourceId: 'id'
      } as CacheMetadataSource),
      expectedTransformer
    );
  });

  it('should find the transformer of an OIBus API data source, then the one of every data source', () => {
    setConnectorTransformers([
      {
        id: 'allSources1',
        options: {},
        transformer: { id: 'file', type: 'standard', functionName: 'file', inputType: 'any', outputType: 'any' },
        source: { type: 'oibus-api' }
      },
      {
        id: 'dataSource1',
        options: {},
        transformer: { id: 'custom', type: 'standard', functionName: 'json-to-csv', inputType: 'any', outputType: 'any' },
        source: { type: 'oibus-api', dataSourceId: 'ds1' }
      },
      {
        id: 'allSources2',
        options: {},
        transformer: { id: 'file', type: 'standard', functionName: 'file', inputType: 'any', outputType: 'any' },
        source: { type: 'oibus-api' }
      }
    ]);

    assert.strictEqual(north['findTransformer']({ source: 'oibus-api', dataSourceId: 'ds1' })?.id, 'dataSource1');
    assert.strictEqual(north['findTransformer']({ source: 'oibus-api', dataSourceId: 'ds2' })?.id, 'allSources1');
  });

  it('should find transformer from south metadata at group level', () => {
    const expectedTransformer = north['connector'].transformers[0];
    (expectedTransformer.source as SourceOriginSouth) = {
      type: 'south',
      south: { id: testData.south.list[0].id } as SouthConnectorEntityLight,
      group: {
        id: 'groupId1',
        name: 'Group 1',
        southId: testData.south.list[0].id,
        items: [{ id: testData.south.list[0].items[0].id }] as Array<SouthConnectorItemEntityLight>
      } as SouthItemGroupEntity,
      items: []
    };
    north['rebuildTransformerCache']();

    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'south',
        southId: testData.south.list[0].id,
        items: [{ id: testData.south.list[0].items[0].id }]
      } as CacheMetadataSource),
      expectedTransformer
    );

    assert.notDeepStrictEqual(
      north['findTransformer']({ source: 'south', southId: 'southId1', items: [{ id: 'anotherId' }] } as CacheMetadataSource),
      expectedTransformer
    );
  });

  it('should invalidate the transformer-lookup cache when connectorConfiguration is reassigned', () => {
    // Prime the cache with a first lookup.
    north['findTransformer']({
      source: 'south',
      southId: testData.south.list[0].id,
      items: [testData.south.list[0].items[0]]
    } as CacheMetadataSource);
    const cachedBefore = north['transformerLookup'];
    assert.notStrictEqual(cachedBefore, null);

    // Production path: connector config is replaced entirely → setter fires.
    north.connectorConfiguration = { ...north['connector'], transformers: [] };
    // Setter must drop the cache so the next lookup rebuilds it.
    assert.strictEqual(north['transformerLookup'], null);

    // Next call sees the new (empty) transformer list.
    const result = north['findTransformer']({
      source: 'south',
      southId: testData.south.list[0].id,
      items: [testData.south.list[0].items[0]]
    } as CacheMetadataSource);
    assert.strictEqual(result, undefined);
  });

  it('should transform any-content payload', async () => {
    const options: NorthTransformerWithOptions = {
      id: 'northId'
    } as NorthTransformerWithOptions;
    const outputBuffer = Buffer.from('output');
    const { transformInMemory } = oiBusTransformer;
    transformInMemory.mock.mockImplementation(async () => ({
      output: outputBuffer,
      metadata: { contentFile: '', contentType: 'opcua', numberOfElement: 1, contentSize: 0, createdAt: '' }
    }));
    await north['executeTransformation']({ type: 'any-content', content: '' } as OIBusContent, options, {
      source: 'oianalytics-setpoints'
    } as CacheMetadataSource);
    assert.strictEqual(transformInMemory.mock.calls.length, 1);
    assert.deepStrictEqual(transformInMemory.mock.calls[0].arguments[1], { source: 'oianalytics-setpoints' });
    assert.strictEqual(transformInMemory.mock.calls[0].arguments[2], null);
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], outputBuffer);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], {
      contentType: 'opcua',
      contentFilename: '',
      numberOfElement: 1
    });
  });

  it('should transform setpoint payload', async () => {
    const options: NorthTransformerWithOptions = {
      id: 'northId'
    } as NorthTransformerWithOptions;
    const outputBuffer = Buffer.from('output');
    const { transformInMemory } = oiBusTransformer;
    transformInMemory.mock.mockImplementation(async () => ({
      output: outputBuffer,
      metadata: { contentFile: '', contentType: 'opcua', numberOfElement: 1, contentSize: 0, createdAt: '' }
    }));
    await north['executeTransformation']({ type: 'setpoint', content: [] } as OIBusContent, options, {
      source: 'oianalytics-setpoints'
    } as CacheMetadataSource);
    assert.strictEqual(transformInMemory.mock.calls.length, 1);
    assert.deepStrictEqual(transformInMemory.mock.calls[0].arguments[1], { source: 'oianalytics-setpoints' });
    assert.strictEqual(transformInMemory.mock.calls[0].arguments[2], null);
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], outputBuffer);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], {
      contentType: 'opcua',
      contentFilename: '',
      numberOfElement: 1
    });
  });

  it('should cache without transform with any-content as a file', async () => {
    await north['cacheWithoutTransform']({ type: 'any-content', content: '' });
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], { contentType: 'any' });
  });

  it('should get cache folder', () => {
    assert.strictEqual(north['getCacheFolder'](), 'cache');
  });

  it('should get cache sizes from the cache service', () => {
    cacheService.getCacheContentSizes.mock.mockImplementation(() => ({ cache: 10, error: 20, archive: 30 }));
    assert.deepStrictEqual(north.getCacheSizes(), { cache: 10, error: 20, archive: 30 });
    assert.strictEqual(cacheService.getCacheContentSizes.mock.calls.length, 1);
  });

  it('should resolve an oianalytics-setpoint transformer and only keep the first one found', () => {
    setConnectorTransformers([
      {
        id: 'setpoint1',
        options: {},
        transformer: { id: 'tr-setpoint-1', type: 'standard', functionName: 'noop', outputType: 'setpoint' },
        source: { type: 'oianalytics-setpoint' }
      },
      {
        id: 'setpoint2',
        options: {},
        transformer: { id: 'tr-setpoint-2', type: 'standard', functionName: 'noop', outputType: 'setpoint' },
        source: { type: 'oianalytics-setpoint' }
      }
    ]);

    const found = north['findTransformer']({ source: 'oianalytics-setpoints' } as CacheMetadataSource);
    // First-wins: the second oianalytics-setpoint transformer must NOT overwrite the first.
    assert.strictEqual(found?.id, 'setpoint1');
  });

  it('should return undefined from findTransformer for an unhandled metadata source', () => {
    setConnectorTransformers([]);
    const found = north['findTransformer']({ source: 'unknown-source' } as unknown as CacheMetadataSource);
    assert.strictEqual(found, undefined);
  });

  it('should fall back to a single group when a value cannot be attributed to a known item', async () => {
    setConnectorTransformers([
      timeValuesTransformer('t1', 'tr1', { south: { id: 'southX' }, items: [{ id: 'i1', name: 'point-1' }] }),
      timeValuesTransformer('t2', 'tr2', { south: { id: 'southX' }, items: [{ id: 'i2', name: 'point-2' }] })
    ]);

    const v1 = timeValue('point-1', 1);
    const v2 = timeValue('point-2', 2);
    const unmatched = timeValue('point-unknown', 3);

    await north.cacheContent(
      { type: 'record-list', content: [v1, v2, unmatched] },
      southXSource([
        { id: 'i1', name: 'point-1' },
        { id: 'i2', name: 'point-2' }
      ])
    );

    // Falls back to a single group over the whole batch instead of dropping the unmatched value.
    assert.strictEqual(oiBusTransformer.transformInMemory.mock.calls.length, 1);
    assert.deepStrictEqual(oiBusTransformer.transformInMemory.mock.calls[0].arguments[0], [v1, v2, unmatched]);
    assert.ok(logger.warn.mock.calls.some(c => (c.arguments[0] as string).includes('Cannot route point "point-unknown" to a transformer')));
  });

  it('should resolve item/group/south-level transformers independently when splitting a batch', async () => {
    setConnectorTransformers([
      timeValuesTransformer('itemLevel', 'tr-item', { south: { id: 'southX' }, items: [{ id: 'i1', name: 'point-1' }] }),
      timeValuesTransformer('groupLevel', 'tr-group', {
        south: { id: 'southX' },
        group: { id: 'g1', items: [{ id: 'i2', name: 'point-2' }] }
      }),
      timeValuesTransformer('southLevel', 'tr-south', { south: { id: 'southX' }, items: [] })
    ]);

    const v1 = timeValue('point-1', 1);
    const v2 = timeValue('point-2', 2);
    const v3 = timeValue('point-3', 3);

    await north.cacheContent(
      { type: 'record-list', content: [v1, v2, v3] },
      southXSource([
        { id: 'i1', name: 'point-1' },
        { id: 'i2', name: 'point-2' },
        { id: 'i3', name: 'point-3' }
      ])
    );

    // Item-level, group-level and south-level fallback each resolve a distinct transformer
    // for its item, so the batch is split into three groups.
    assert.strictEqual(oiBusTransformer.transformInMemory.mock.calls.length, 3);
  });

  it('should replace the current best candidate when a later item resolves to an earlier-listed transformer', () => {
    setConnectorTransformers([
      timeValuesTransformer('later', 'tr-later', { south: { id: 'southY' }, items: [{ id: 'iB', name: 'point-b' }] }),
      timeValuesTransformer('earlier', 'tr-earlier', { south: { id: 'southY' }, items: [{ id: 'iA', name: 'point-a' }] })
    ]);

    // 'iA' (transformer "earlier", listIndex 1) is visited first and becomes `best`; then 'iB'
    // (transformer "later", listIndex 0) is visited and, since 0 < 1, replaces `best` — exercising
    // the `candidate.listIndex < best.listIndex` branch (not just the initial `!best` branch).
    const found = north['findTransformer']({
      source: 'south',
      southId: 'southY',
      items: [{ id: 'iA' }, { id: 'iB' }]
    } as unknown as CacheMetadataSource);

    assert.strictEqual(found?.id, 'later');
  });

  it('should leave the excluded items out of the group and south level transformers', async () => {
    setConnectorTransformers([
      timeValuesTransformer('group', 'tr-group', {
        south: { id: 'southX' },
        group: { id: 'g1', items: [{ id: 'i1' }, { id: 'i2' }] },
        excludedItems: [{ id: 'i1', name: 'point-1' }]
      }),
      timeValuesTransformer('southWithout2', 'tr-south-1', { south: { id: 'southX' }, excludedItems: [{ id: 'i2', name: 'point-2' }] }),
      timeValuesTransformer('southWithout3', 'tr-south-2', { south: { id: 'southX' }, excludedItems: [{ id: 'i3', name: 'point-3' }] }),
      timeValuesTransformer('southWithout1', 'tr-south-3', { south: { id: 'southY' }, excludedItems: [{ id: 'i1', name: 'point-1' }] })
    ]);
    const find = (southId: string, itemIds: Array<string>) =>
      north['findTransformer']({ source: 'south', southId, items: itemIds.map(id => ({ id })) } as unknown as CacheMetadataSource)?.id;

    // i1 is left out of its group: it falls back to the first south level transformer not leaving it out
    assert.strictEqual(find('southX', ['i1']), 'southWithout2');
    assert.strictEqual(find('southX', ['i2']), 'group');
    assert.strictEqual(find('southX', ['i3']), 'southWithout2');
    assert.strictEqual(find('southY', ['i1']), undefined);
    assert.strictEqual(find('southY', []), 'southWithout1');

    await north.cacheContent(
      { type: 'record-list', content: [timeValue('point-1', 1), timeValue('point-2', 2)] },
      southXSource([
        { id: 'i1', name: 'point-1' },
        { id: 'i2', name: 'point-2' }
      ])
    );
    // Split between the south level transformer (point-1) and the group one (point-2)
    assert.strictEqual(oiBusTransformer.transformInMemory.mock.calls.length, 2);
  });
});
