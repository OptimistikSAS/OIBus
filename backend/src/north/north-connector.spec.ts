import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, flushPromises } from '../tests/utils/test-utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../tests/__mocks__/service/cache/cache-service.mock';
import OIBusTransformerMock from '../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthFileWriterSettings, NorthSettings } from '../../shared/model/north-settings.model';
import type { NorthConnectorEntity } from '../model/north-connector.model';
import type {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheMetadataSource,
  CacheMetadataSourceOriginSouth,
  OIBusContent,
  OIBusFileContent
} from '../../shared/model/engine.model';
import type { NorthTransformerWithOptions, SourceOriginSouth } from '../model/transformer.model';
import type {
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthConnectorItemEntityLight,
  SouthItemGroupEntity
} from '../model/south-connector.model';
import type { SouthItemSettings } from '../../shared/model/south-settings.model';
import type { HistoryQueryItemEntity } from '../model/histor-query.model';
import type NorthConnectorClass from './north-connector';
import type NorthFileWriterClass from './north-file-writer/north-file-writer';
import { OIBusError } from '../model/engine.model';
import path from 'node:path';
import { DateTime } from 'luxon';
import type { ReadStream } from 'node:fs';
import type { Readable } from 'node:stream';

const nodeRequire = createRequire(import.meta.url);

// Grab the real node:fs and node:stream exports objects and mutate them in-place.
// tsx compiles `import { createReadStream } from 'node:fs'` as namespace access,
// so the SUT holds a reference to the same exports object.
const realFs = nodeRequire('node:fs') as Record<string, unknown>;
const realStream = nodeRequire('node:stream') as Record<string, unknown>;
const realReadable = realStream['Readable'] as Record<string, unknown>;

describe('NorthConnector', () => {
  let NorthFileWriter: typeof NorthFileWriterClass;

  const logger = new PinoLogger();
  const anotherLogger = new PinoLogger();

  // Shared mutable mock instances
  let cacheService: CacheServiceMock;
  const oiBusTransformer = new OIBusTransformerMock();

  const cronMockInstance = { stop: mock.fn() };
  const cronExports = {
    CronJob: mock.fn(function (_cron: unknown, _callback: () => void) {
      return cronMockInstance;
    })
  };

  // Mock stream object returned by createReadStream and Readable.from
  const mockStream = { close: mock.fn() };

  // Original references to restore after tests
  const origCreateReadStream = realFs['createReadStream'];
  const origReadableFrom = realReadable['from'];

  const utilsExports = {
    createOIBusError: mock.fn((error: unknown) => error),
    delay: mock.fn(async () => undefined),
    dirSize: mock.fn(() => 123),
    generateRandomId: mock.fn(() => '1234567890'),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const transformerServiceExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  before(() => {
    // Patch built-ins in-place before loading the SUT
    realFs['createReadStream'] = mock.fn(() => mockStream);
    realReadable['from'] = mock.fn(() => mockStream);

    mockModule(nodeRequire, 'cron', cronExports);
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../service/transformer.service', transformerServiceExports);

    // Mock CacheService constructor to return our instance
    mockModule(nodeRequire, '../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });

    NorthFileWriter = reloadModule<{ default: typeof NorthFileWriterClass }>(nodeRequire, './north-file-writer/north-file-writer').default;
  });

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

  let north: NorthConnectorClass<NorthSettings>;

  beforeEach(() => {
    cacheService = new CacheServiceMock();

    // Reset logger mock calls
    for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
      fn.mock.resetCalls();
    }
    for (const fn of [anotherLogger.trace, anotherLogger.debug, anotherLogger.info, anotherLogger.warn, anotherLogger.error]) {
      fn.mock.resetCalls();
    }

    cronMockInstance.stop.mock.resetCalls();
    cronExports.CronJob = mock.fn(function (_cron: unknown, _callback: () => void) {
      return cronMockInstance;
    });

    // Reset util mocks
    utilsExports.createOIBusError = mock.fn((error: unknown) => error);
    utilsExports.delay = mock.fn(async () => undefined);
    utilsExports.dirSize = mock.fn(() => 123);
    utilsExports.generateRandomId = mock.fn(() => '1234567890');
    utilsExports.validateCronExpression = mock.fn(() => ({ expression: '' }));

    // Reset transformer service
    transformerServiceExports.createTransformer = mock.fn(() => oiBusTransformer);
    oiBusTransformer.transform.mock.resetCalls();

    // Reset in-place fs/stream mocks
    realFs['createReadStream'] = mock.fn(() => mockStream);
    realReadable['from'] = mock.fn(() => mockStream);
    mockStream.close.mock.resetCalls();

    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

    north = new NorthFileWriter(testData.north.list[0] as NorthConnectorEntity<NorthFileWriterSettings>, logger, cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
    // Restore real fs/stream exports after each test (mock.restoreAll won't touch these)
    realFs['createReadStream'] = origCreateReadStream;
    realReadable['from'] = origReadableFrom;
  });

  it('should be properly initialized', async () => {
    await north.start();
    assert.strictEqual(north.isEnabled(), true);
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `North connector "${testData.north.list[0].name}" enabled`
      )
    );
    assert.strictEqual(logger.error.mock.calls.length, 0);
    assert.ok(
      logger.info.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `North connector "${testData.north.list[0].name}" of type ${testData.north.list[0].type} started`
      )
    );
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

  it('should properly create cron job and add to queue', async () => {
    const addTaskToQueueMock = mock.fn((_taskDescription: { id: string; name: string }) => undefined);
    north.addTaskToQueue = addTaskToQueueMock;
    await north.connect();
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `Creating cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
      )
    );

    await north.connect();
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] ===
          `Removing existing cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
      )
    );

    // Retrieve the CronJob callback and trigger it
    const cronJobCalls = cronExports.CronJob.mock.calls;
    assert.ok(cronJobCalls.length > 0);
    const lastCallArgs = cronJobCalls[cronJobCalls.length - 1].arguments;
    const cronCallback = lastCallArgs[1] as () => void;
    cronCallback();

    assert.strictEqual(addTaskToQueueMock.mock.calls.length, 1);
    assert.deepStrictEqual(addTaskToQueueMock.mock.calls[0].arguments[0], {
      id: testData.scanMode.list[0].id,
      name: testData.scanMode.list[0].name
    });

    await north.updateScanMode(testData.scanMode.list[0]);
    await north.updateScanMode(testData.scanMode.list[1]);
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `Creating cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
      )
    );
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] ===
          `Removing existing cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
      )
    );

    await north.stop();
  });

  it('should not create a cron job when the cron expression is invalid', () => {
    const error = new Error('Invalid cron expression');
    utilsExports.validateCronExpression = mock.fn(() => {
      throw error;
    });

    north.createCronJob({ ...testData.scanMode.list[0], cron: '* * * * * *L' });

    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] ===
          `Error when creating cron job for scan mode "${testData.scanMode.list[0].name}" (* * * * * *L): ${error.message}`
      )
    );
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    await north.start();
    const runMock = mock.fn(async (_taskDescription: { id: string; name: string }) => undefined);
    north.run = runMock;
    north.addTaskToQueue({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });

    assert.ok(
      !logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `Task "${testData.scanMode.list[0].name}" is already in queue`
      )
    );
    assert.strictEqual(runMock.mock.calls.length, 1);
    assert.deepStrictEqual(runMock.mock.calls[0].arguments[0], {
      id: testData.scanMode.list[0].id,
      name: testData.scanMode.list[0].name
    });

    north.addTaskToQueue({ id: testData.scanMode.list[0].id, name: testData.scanMode.list[0].name });
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `Task "${testData.scanMode.list[0].name}" is already in queue`
      )
    );
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
    assert.ok(
      logger.trace.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `North run triggered by task "scan" (scanModeId1)`
      )
    );
    assert.ok(
      logger.trace.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `North run triggered by task "previous task" (previous-task)`
      )
    );
    assert.strictEqual(handleContentWrapperMock.mock.calls.length, 2);
    assert.strictEqual(triggerRunIfNecessaryMock.mock.calls.length, 1);
  });

  it('should properly disconnect', async () => {
    await north.disconnect();
    assert.ok(
      logger.info.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `"${testData.north.list[0].name}" (${testData.north.list[0].id}) disconnected`
      )
    );
  });

  it('should properly stop', async () => {
    const disconnectMock = mock.fn(async () => undefined);
    north.disconnect = disconnectMock;
    await north.stop();
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `Stopping "${testData.north.list[0].name}" (${testData.north.list[0].id})...`
      )
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(
      logger.info.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === `"${testData.north.list[0].name}" stopped`)
    );
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
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `Stopping "${testData.north.list[0].name}" (${testData.north.list[0].id})...`
      )
    );
    assert.ok(logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'Waiting for task to finish'));
    assert.strictEqual(disconnectMock.mock.calls.length, 0);

    north.run({ id: 'trigger1', name: 'Another trigger' });
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === 'Task "Another trigger" not run because the connector is stopping or a run is already in progress'
      )
    );

    resolvePromise();
    await flushPromises();
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(
      logger.info.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === `"${testData.north.list[0].name}" stopped`)
    );
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

  it('should use another logger', async () => {
    north.setLogger(anotherLogger);
    logger.debug.mock.resetCalls();
    await north.stop();
    assert.strictEqual(anotherLogger.debug.mock.calls.length, 1);
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
    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `Unsupported data type: opcua (file file1.json)`
      )
    );
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

    utilsExports.generateRandomId = mock.fn(() => '1234567890');
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
      contentType: 'time-values'
    };
    const outputStream = Buffer.from('outputStream');
    oiBusTransformer.transform.mock.mockImplementation(async () => ({ metadata, output: outputStream }));

    await north.cacheContent(testData.oibusContent[0], {
      source: 'south',
      southId: testData.south.list[1].id,
      items: [] as Array<SouthConnectorItemEntity<SouthItemSettings>> | Array<HistoryQueryItemEntity<SouthItemSettings>>
    } as CacheMetadataSourceOriginSouth);

    const readableFromMock = realReadable['from'] as ReturnType<typeof mock.fn>;
    assert.strictEqual(readableFromMock.mock.calls.length, 1);
    assert.deepStrictEqual(readableFromMock.mock.calls[0].arguments[0], JSON.stringify(testData.oibusContent[0].content));

    assert.strictEqual(oiBusTransformer.transform.mock.calls.length, 1);
    assert.deepStrictEqual(oiBusTransformer.transform.mock.calls[0].arguments[1], {
      source: 'south',
      southId: testData.south.list[1].id,
      items: []
    });
    assert.strictEqual(oiBusTransformer.transform.mock.calls[0].arguments[2], null);

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

    let genIdCount = 0;
    utilsExports.generateRandomId = mock.fn(() => {
      genIdCount += 1;
      return genIdCount === 1 ? '1234567890' : '0987654321';
    });

    const metadata: CacheMetadata = {
      contentFile: '1234567890.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '',
      contentType: 'time-values'
    };
    const outputStream1 = Buffer.from('outputStream1');
    const outputStream2 = Buffer.from('outputStream2');

    let transformCallCount = 0;
    oiBusTransformer.transform.mock.mockImplementation(async () => {
      transformCallCount += 1;
      return { metadata, output: transformCallCount === 1 ? outputStream1 : outputStream2 };
    });

    await north.cacheContent(testData.oibusContent[0], {
      source: 'south',
      southId: testData.south.list[1].id,
      items: [] as Array<SouthConnectorItemEntity<SouthItemSettings>> | Array<HistoryQueryItemEntity<SouthItemSettings>>
    } as CacheMetadataSourceOriginSouth);

    const readableFromMock = realReadable['from'] as ReturnType<typeof mock.fn>;
    assert.strictEqual(readableFromMock.mock.calls.length, 2);
    assert.strictEqual(transformerServiceExports.createTransformer.mock.calls.length, 1);

    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 2);
    assert.strictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], outputStream1);
    assert.strictEqual(cacheService.addCacheContent.mock.calls[1].arguments[0], outputStream2);
  });

  it('should not cache json content if cache is full', async () => {
    cacheService.cacheIsFull.mock.mockImplementation(() => true);
    const findTransformerMock = mock.fn((_metadataSource: CacheMetadataSource) => undefined as NorthTransformerWithOptions | undefined);
    north['findTransformer'] = findTransformerMock;
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    assert.strictEqual(findTransformerMock.mock.calls.length, 0);
  });

  it('should cache json content and handle no transform', async () => {
    const findTransformerMock = mock.fn((_metadataSource: CacheMetadataSource) => undefined as NorthTransformerWithOptions | undefined);
    north['findTransformer'] = findTransformerMock;
    const handleNoTransformerMock = mock.fn(async (_data: OIBusContent) => undefined);
    north['handleNoTransformer'] = handleNoTransformerMock;
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    assert.strictEqual(findTransformerMock.mock.calls.length, 1);
    assert.strictEqual(handleNoTransformerMock.mock.calls.length, 1);
  });

  it('should cache json content and handle ignore transform', async () => {
    const findTransformerMock = mock.fn(
      (_metadataSource: CacheMetadataSource) =>
        ({ transformer: { type: 'standard', functionName: 'ignore' } }) as NorthTransformerWithOptions
    );
    north['findTransformer'] = findTransformerMock;
    const handleNoTransformerMock = mock.fn(async (_data: OIBusContent) => undefined);
    north['handleNoTransformer'] = handleNoTransformerMock;
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    assert.strictEqual(findTransformerMock.mock.calls.length, 1);
    assert.strictEqual(handleNoTransformerMock.mock.calls.length, 0);
    assert.ok(
      logger.trace.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `Ignoring data of type ${testData.oibusContent[0].type}`
      )
    );
  });

  it('should cache json content and handle iso transform', async () => {
    const findTransformerMock = mock.fn(
      (_metadataSource: CacheMetadataSource) => ({ transformer: { type: 'standard', functionName: 'iso' } }) as NorthTransformerWithOptions
    );
    north['findTransformer'] = findTransformerMock;
    const handleNoTransformerMock = mock.fn(async (_data: OIBusContent) => undefined);
    north['handleNoTransformer'] = handleNoTransformerMock;
    const cacheWithoutTransformAndTriggerMock = mock.fn(async (_data: OIBusContent) => undefined);
    north['cacheWithoutTransformAndTrigger'] = cacheWithoutTransformAndTriggerMock;
    await north.cacheContent(testData.oibusContent[0], { source: 'test' });

    assert.strictEqual(findTransformerMock.mock.calls.length, 1);
    assert.strictEqual(handleNoTransformerMock.mock.calls.length, 0);
    assert.strictEqual(cacheWithoutTransformAndTriggerMock.mock.calls.length, 1);
  });

  it('should cache file content', async () => {
    utilsExports.generateRandomId = mock.fn(() => '1234567890');

    const metadata: CacheMetadata = {
      contentFile: `${path.parse((testData.oibusContent[1] as OIBusFileContent).filePath).name}-1234567890.csv`,
      contentSize: 100,
      numberOfElement: 0,
      createdAt: DateTime.fromMillis(123).toUTC().toISO()!,
      contentType: 'any'
    };
    const outputStream = Buffer.from('outputStream');
    oiBusTransformer.transform.mock.mockImplementation(async () => ({ metadata, output: outputStream }));

    await north.cacheContent(testData.oibusContent[1], {
      source: 'south',
      southId: testData.south.list[1].id,
      items: [] as Array<SouthConnectorItemEntity<SouthItemSettings>> | Array<HistoryQueryItemEntity<SouthItemSettings>>
    } as CacheMetadataSourceOriginSouth);

    const createReadStreamMock = realFs['createReadStream'] as ReturnType<typeof mock.fn>;
    assert.strictEqual(createReadStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createReadStreamMock.mock.calls[0].arguments[0], (testData.oibusContent[1] as OIBusFileContent).filePath);

    assert.strictEqual(oiBusTransformer.transform.mock.calls.length, 1);
    assert.deepStrictEqual(oiBusTransformer.transform.mock.calls[0].arguments[1], {
      source: 'south',
      southId: testData.south.list[1].id,
      items: []
    });
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
    const readStream = 'readStream';
    const createReadStreamMock = mock.fn((_path: unknown) => readStream);
    realFs['createReadStream'] = createReadStreamMock;

    await north['cacheWithoutTransform']({
      type: 'any',
      filePath: 'path/file.csv'
    } as OIBusContent);

    assert.strictEqual(createReadStreamMock.mock.calls.length, 1);
    assert.deepStrictEqual(createReadStreamMock.mock.calls[0].arguments[0], 'path/file.csv');
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], readStream);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], {
      contentType: 'any',
      contentFilename: 'path/file.csv'
    });
  });

  it('should find transformer from south metadata', () => {
    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'south',
        southId: testData.south.list[0].id,
        items: [testData.south.list[0].items[0]]
      } as CacheMetadataSource),
      north['connector'].transformers[0]
    );

    (north['connector'].transformers[0].source as SourceOriginSouth).items = [];
    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'south',
        southId: testData.south.list[0].id,
        items: [testData.south.list[0].items[0]]
      } as CacheMetadataSource),
      north['connector'].transformers[0]
    );

    north['connector'].transformers[0].source = { type: 'oibus-api', dataSourceId: 'id' };
    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'oibus-api',
        dataSourceId: 'id'
      } as CacheMetadataSource),
      north['connector'].transformers[0]
    );
  });

  it('should find transformer from south metadata at group level', () => {
    const itemWithMatchingGroup = {
      ...testData.south.list[0].items[0],
      group: {
        id: 'groupId1',
        name: 'Group 1',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: null
      }
    };
    (north['connector'].transformers[0].source as SourceOriginSouth) = {
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

    // Suppress unused variable warning
    void itemWithMatchingGroup;

    assert.deepStrictEqual(
      north['findTransformer']({
        source: 'south',
        southId: testData.south.list[0].id,
        items: [{ id: testData.south.list[0].items[0].id }]
      } as CacheMetadataSource),
      north['connector'].transformers[0]
    );

    assert.notDeepStrictEqual(
      north['findTransformer']({ source: 'south', southId: 'southId1', items: [{ id: 'anotherId' }] } as CacheMetadataSource),
      north['connector'].transformers[0]
    );
  });

  it('should handle no transformer when not supporting type', async () => {
    const cacheWithoutTransformAndTriggerMock = mock.fn(async (_data: OIBusContent) => undefined);
    north['cacheWithoutTransformAndTrigger'] = cacheWithoutTransformAndTriggerMock;
    await north['handleNoTransformer']({ type: 'bad' } as unknown as OIBusContent);
    assert.ok(
      logger.trace.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `Data type "bad" not supported by the connector. Data will be ignored.`
      )
    );
    assert.strictEqual(cacheWithoutTransformAndTriggerMock.mock.calls.length, 0);
  });

  it('should handle no transformer when supporting type', async () => {
    const cacheWithoutTransformMock = mock.fn(async (_data: OIBusContent) => undefined);
    north['cacheWithoutTransform'] = cacheWithoutTransformMock;
    const triggerRunIfNecessaryMock = mock.fn(async (_timeToWait: number) => undefined);
    north['triggerRunIfNecessary'] = triggerRunIfNecessaryMock;
    await north['handleNoTransformer']({ type: 'time-values' } as OIBusContent);
    assert.strictEqual(cacheWithoutTransformMock.mock.calls.length, 1);
    assert.strictEqual(triggerRunIfNecessaryMock.mock.calls.length, 1);
  });

  it('should transform any-content payload', async () => {
    const options: NorthTransformerWithOptions = {
      id: 'northId'
    } as NorthTransformerWithOptions;
    const outputBuffer = Buffer.from('output');
    const transform = mock.fn(async (_data: ReadStream | Readable, _source: CacheMetadataSource, _filename: string | null) => ({
      output: outputBuffer,
      metadata: {
        contentFile: '',
        contentType: 'opcua',
        numberOfElement: 1,
        contentSize: 0,
        createdAt: ''
      } satisfies CacheMetadata
    }));
    transformerServiceExports.createTransformer.mock.mockImplementation(() => ({ transform }) as OIBusTransformerMock);
    await north['executeTransformation']({ type: 'any-content', content: '' } as OIBusContent, options, {
      source: 'oianalytics-setpoints'
    } as CacheMetadataSource);
    assert.strictEqual(transform.mock.calls.length, 1);
    assert.deepStrictEqual(transform.mock.calls[0].arguments[1], { source: 'oianalytics-setpoints' });
    assert.strictEqual(transform.mock.calls[0].arguments[2], null);
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
    const transform = mock.fn(async (_data: ReadStream | Readable, _source: CacheMetadataSource, _filename: string | null) => ({
      output: outputBuffer,
      metadata: {
        contentFile: '',
        contentType: 'opcua',
        numberOfElement: 1,
        contentSize: 0,
        createdAt: ''
      } satisfies CacheMetadata
    }));
    transformerServiceExports.createTransformer.mock.mockImplementation(() => ({ transform }) as OIBusTransformerMock);
    await north['executeTransformation']({ type: 'setpoint', content: [] } as OIBusContent, options, {
      source: 'oianalytics-setpoints'
    } as CacheMetadataSource);
    assert.strictEqual(transform.mock.calls.length, 1);
    assert.deepStrictEqual(transform.mock.calls[0].arguments[1], { source: 'oianalytics-setpoints' });
    assert.strictEqual(transform.mock.calls[0].arguments[2], null);
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[0], outputBuffer);
    assert.deepStrictEqual(cacheService.addCacheContent.mock.calls[0].arguments[1], {
      contentType: 'opcua',
      contentFilename: '',
      numberOfElement: 1
    });
  });

  it('should cache without transform with max number of elements', async () => {
    north.connectorConfiguration.caching.throttling.maxNumberOfElements = 1;
    await north['cacheWithoutTransform']({ type: 'time-values', content: [{}, {}] } as OIBusContent);
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 2);
  });

  it('should cache without transform with any-content', async () => {
    north.connectorConfiguration.caching.throttling.maxNumberOfElements = 1;
    await north['cacheWithoutTransform']({ type: 'any-content', content: '' } as OIBusContent);
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
  });

  it('should cache without transform', async () => {
    north.connectorConfiguration.caching.throttling.maxNumberOfElements = 0;
    await north['cacheWithoutTransform']({ type: 'time-values', content: [{}, {}] } as OIBusContent);
    assert.strictEqual(cacheService.addCacheContent.mock.calls.length, 1);
  });

  it('should get cache folder', () => {
    assert.strictEqual(north['getCacheFolder'](), 'cache');
  });
});
