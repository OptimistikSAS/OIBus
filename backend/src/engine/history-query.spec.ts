import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, asLogger, flushPromises } from '../tests/utils/test-utils';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import type NorthConnector from '../north/north-connector';
import type { NorthSettings } from '../../shared/model/north-settings.model';
import type SouthConnector from '../south/south-connector';
import type { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import type { CacheContentUpdateCommand } from '../../shared/model/engine.model';
import type HistoryQueryClass from './history-query';

const nodeRequire = createRequire(import.meta.url);

describe('HistoryQuery enabled', () => {
  let HistoryQuery: typeof HistoryQueryClass;
  let historyQuery: HistoryQueryClass;

  // Separate mock-typed references so we can access .mock properties without casts
  let mockedNorth1Mock: NorthConnectorMock;
  let mockedSouth1Mock: SouthConnectorMock;

  // Real-typed references for passing to constructors and HistoryQuery internals
  let mockedNorth1: NorthConnector<NorthSettings>;
  let mockedSouth1: SouthConnector<SouthSettings, SouthItemSettings>;

  const logger = new PinoLogger();
  const anotherLogger = new PinoLogger();

  before(() => {
    // Mock service/utils to prevent real delays and folder creation
    mockModule(nodeRequire, '../service/utils', {
      delay: mock.fn(async () => undefined),
      createFolder: mock.fn(async () => undefined)
    });
    HistoryQuery = reloadModule<{ default: typeof HistoryQueryClass }>(nodeRequire, './history-query').default;
  });

  beforeEach(async () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    mockedNorth1Mock = new NorthConnectorMock(testData.north.list[0]);
    mockedSouth1Mock = new SouthConnectorMock(testData.south.list[0]);
    // structural mocks — satisfy connector interfaces at injection boundaries
    mockedNorth1 = mockedNorth1Mock as unknown as NorthConnector<NorthSettings>;
    mockedSouth1 = mockedSouth1Mock as unknown as SouthConnector<SouthSettings, SouthItemSettings>;

    historyQuery = new HistoryQuery(testData.historyQueries.list[0], mockedNorth1, mockedSouth1, asLogger(logger));
  });

  afterEach(async () => {
    await historyQuery.stop();
    mock.timers.reset();
    mock.restoreAll();
    mockedSouth1Mock.connectedEvent.removeAllListeners();
    mockedSouth1Mock.metricsEvent.removeAllListeners();
    mockedNorth1Mock.metricsEvent.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();

    assert.strictEqual(mockedNorth1Mock.start.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1Mock.start.mock.calls.length, 1);
    assert.deepStrictEqual(historyQuery.historyQueryConfiguration, testData.historyQueries.list[0]);
  });

  it('should start south connector', async () => {
    const clearIntervalMock = mock.method(globalThis, 'clearInterval');
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => '');

    await historyQuery.start();
    mockedSouth1Mock.connectedEvent.emit('connected');

    assert.strictEqual(mockedSouth1Mock.start.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1Mock.historyQueryHandler.mock.calls.length, 1);
    assert.deepStrictEqual(
      mockedSouth1Mock.historyQueryHandler.mock.calls[0].arguments[0],
      testData.historyQueries.list[0].items.map(item => ({
        ...item,
        scanMode: { cron: '', description: '', id: 'history', name: 'history', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' },
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: null
      }))
    );
    assert.deepStrictEqual(
      mockedSouth1Mock.historyQueryHandler.mock.calls[0].arguments[1],
      testData.historyQueries.list[0].queryTimeRange.startTime
    );
    assert.deepStrictEqual(
      mockedSouth1Mock.historyQueryHandler.mock.calls[0].arguments[2],
      testData.historyQueries.list[0].queryTimeRange.endTime
    );
    assert.strictEqual(clearIntervalMock.mock.calls.length, 0);

    mockedSouth1Mock.connectedEvent.emit('connected');
    assert.strictEqual(clearIntervalMock.mock.calls.length, 1);
  });

  it('should start south connector with error', async () => {
    let handlerCallCount = 0;
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => {
      handlerCallCount++;
      if (handlerCallCount <= 2) throw 'error';
      return '';
    });

    await historyQuery.start();
    assert.strictEqual(mockedSouth1Mock.start.mock.calls.length, 1);
    assert.strictEqual(mockedNorth1Mock.start.mock.calls.length, 1);

    mockedSouth1Mock.connectedEvent.emit('connected');

    await flushPromises();
    assert.strictEqual(mockedSouth1Mock.historyQueryHandler.mock.calls.length, 1);
    assert.deepStrictEqual(
      mockedSouth1Mock.historyQueryHandler.mock.calls[0].arguments[0],
      testData.historyQueries.list[0].items.map(item => ({
        ...item,
        scanMode: { cron: '', description: '', id: 'history', name: 'history', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' },
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 200,
        overlap: null
      }))
    );

    assert.strictEqual(mockedSouth1Mock.start.mock.calls.length, 2);
    assert.strictEqual(mockedSouth1Mock.stop.mock.calls.length, 1);

    historyQuery.historyQueryConfiguration = { ...testData.historyQueries.list[0], status: 'PENDING' };
    mockedSouth1Mock.connectedEvent.emit('connected');
    await flushPromises();

    assert.strictEqual(mockedSouth1Mock.start.mock.calls.length, 2);
    assert.strictEqual(mockedSouth1Mock.stop.mock.calls.length, 1);
  });

  it('should properly stop', async () => {
    const clearIntervalMock = mock.method(globalThis, 'clearInterval');
    // historyQueryHandler must return a promise so the connected event handler can set up setInterval
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => '');

    let southConnectedEventRemoved!: number;
    let southStopCalled!: number;
    let southMetricsEventRemoved!: number;
    let northStopCalled!: number;
    let northMetricsEventRemoved!: number;

    // @ts-expect-error overriding EventEmitter method to capture timestamp
    mockedSouth1Mock.connectedEvent.removeAllListeners = () => {
      southConnectedEventRemoved = performance.now();
    };
    mockedSouth1Mock.stop = mock.fn(async () => {
      southStopCalled = performance.now();
    });
    // @ts-expect-error overriding EventEmitter method to capture timestamp
    mockedSouth1Mock.metricsEvent.removeAllListeners = () => {
      southMetricsEventRemoved = performance.now();
    };

    mockedNorth1Mock.stop = mock.fn(async () => {
      northStopCalled = performance.now();
    });
    // @ts-expect-error overriding EventEmitter method to capture timestamp
    mockedNorth1Mock.metricsEvent.removeAllListeners = () => {
      northMetricsEventRemoved = performance.now();
    };

    await historyQuery.start();
    mockedSouth1Mock.connectedEvent.emit('connected');
    await historyQuery.stop();

    // Verify call ordering via performance.now() timestamps
    const expectedOrder = [
      southConnectedEventRemoved,
      southStopCalled,
      southMetricsEventRemoved,
      northStopCalled,
      northMetricsEventRemoved
    ];
    assert.deepStrictEqual(
      expectedOrder,
      expectedOrder.slice().sort((a, b) => a - b)
    );

    // Safety check: if performance.now() were accidentally mocked to return 0, all values would be 0
    assert.notStrictEqual(
      expectedOrder.reduce((sum, val) => sum + val, 0),
      0
    );

    assert.strictEqual(clearIntervalMock.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1Mock.stop.mock.calls.length, 1);
    assert.strictEqual(mockedNorth1Mock.stop.mock.calls.length, 1);
    assert.strictEqual(mockedNorth1Mock.resetCache.mock.calls.length, 0);
    assert.strictEqual(mockedSouth1Mock.resetCache.mock.calls.length, 0);

    // Reset to verify idempotent second stop()
    mockedSouth1Mock.stop.mock.resetCalls();
    mockedNorth1Mock.stop.mock.resetCalls();
    await historyQuery.stop();
    assert.strictEqual(logger.debug.mock.calls.length, 0);

    await historyQuery.resetCache();
    assert.strictEqual(mockedNorth1Mock.resetCache.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1Mock.resetCache.mock.calls.length, 1);
  });

  it('should properly finish and not stop', async () => {
    const stopMock = mock.method(
      historyQuery,
      'stop',
      mock.fn(async () => undefined)
    );
    // @ts-expect-error historyIsRunning exists at runtime on SouthConnector but not declared on type
    mockedSouth1.historyIsRunning = true;
    mockedNorth1Mock.isCacheEmpty = mock.fn(() => {
      // first call returns false, subsequent calls return true
      const callCount = mockedNorth1Mock.isCacheEmpty.mock.calls.length;
      return callCount > 1;
    });

    await historyQuery.start();
    await historyQuery.finish();

    assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('is still running')));
    assert.strictEqual(stopMock.mock.calls.length, 0);

    await historyQuery.finish();
    assert.strictEqual(logger.trace.mock.calls.length, 2);

    // @ts-expect-error historyIsRunning exists at runtime on SouthConnector but not declared on type
    mockedSouth1.historyIsRunning = false;
    await historyQuery.finish();
    assert.ok(
      logger.info.mock.calls.some(c =>
        (c.arguments[0] as string).includes(`Finish History query "${testData.historyQueries.list[0].name}"`)
      )
    );
  });

  it('should properly set another logger', async () => {
    mock.method(
      historyQuery,
      'stop',
      mock.fn(async () => undefined)
    );
    // isCacheEmpty must return true so finish() takes the info branch
    mockedNorth1Mock.isCacheEmpty = mock.fn(() => true);
    historyQuery.setLogger(asLogger(anotherLogger));
    await historyQuery.finish();
    assert.strictEqual(anotherLogger.info.mock.calls.length, 1);
  });

  it('should listen on metrics', async () => {
    const emitMock = mock.method(historyQuery.metricsEvent, 'emit');

    await historyQuery.start();

    mockedNorth1Mock.metricsEvent.emit('connect', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'north-connect'));

    mockedNorth1Mock.metricsEvent.emit('run-start', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'north-run-start'));

    mockedNorth1Mock.metricsEvent.emit('run-end', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'north-run-end'));

    mockedNorth1Mock.metricsEvent.emit('cache-size', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'north-cache-size'));

    mockedNorth1Mock.metricsEvent.emit('cache-content-size', 123);
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'north-cache-content-size' && c.arguments[1] === 123));

    mockedSouth1Mock.metricsEvent.emit('connect', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-connect'));

    mockedSouth1Mock.metricsEvent.emit('run-start', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-run-start'));

    mockedSouth1Mock.metricsEvent.emit('run-end', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-run-end'));

    mockedSouth1Mock.metricsEvent.emit('history-query-start', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-history-query-start'));

    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-history-query-interval'));

    mockedSouth1Mock.metricsEvent.emit('history-query-stop', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-history-query-stop'));

    mockedSouth1Mock.metricsEvent.emit('add-values', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-add-values'));

    mockedSouth1Mock.metricsEvent.emit('add-file', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-add-file'));
  });

  it('should search cache', async () => {
    const searchParams = {
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    };
    await historyQuery.searchCacheContent(searchParams);
    assert.strictEqual(mockedNorth1Mock.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(mockedNorth1Mock.searchCacheContent.mock.calls[0].arguments[0], searchParams);
  });

  it('should get file from cache', async () => {
    await historyQuery.getFileFromCache('cache', 'file');
    assert.strictEqual(mockedNorth1Mock.getFileFromCache.mock.calls.length, 1);
    assert.deepStrictEqual(mockedNorth1Mock.getFileFromCache.mock.calls[0].arguments, ['cache', 'file']);
  });

  it('should update cache', async () => {
    const updateCommand: CacheContentUpdateCommand = {
      cache: { remove: [], move: [] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    };
    await historyQuery.updateCacheContent(updateCommand);
    assert.strictEqual(mockedNorth1Mock.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(mockedNorth1Mock.updateCacheContent.mock.calls[0].arguments[0], updateCommand);
  });
});
