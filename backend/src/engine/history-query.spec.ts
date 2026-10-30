import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { CacheContentUpdateCommand, HistoryQueryItemStatus } from '../../shared/model/domain/engine.model';

import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import testData from '../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../tests/utils/test-utils';
import type HistoryQueryClass from './history-query';

const nodeRequire = createRequire(import.meta.url);

const configuration = testData.historyQueries.list[0];

// Items handed to the south historyQueryHandler: the history query items completed with the south item defaults
const expectedSouthItems = configuration.items.map(item => ({
  ...item,
  scanMode: {
    type: 'cron',
    cron: '',
    interval: null,
    activationWindow: null,
    description: '',
    id: 'history',
    name: 'history',
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  },
  group: null,
  syncWithGroup: false,
  maxReadInterval: 3600,
  readDelay: 200,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  emptyIntervalStrategy: null,
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null
}));

// Four fixed hour-long slots spanning the whole configured history range, independent of
// whatever sub-intervals the south connector queries in a given run.
const fixedIntervals = [
  { start: '2020-03-15T00:00:00.000Z', end: '2020-03-15T01:00:00.000Z' },
  { start: '2020-03-15T01:00:00.000Z', end: '2020-03-15T02:00:00.000Z' },
  { start: '2020-03-15T02:00:00.000Z', end: '2020-03-15T03:00:00.000Z' },
  { start: '2020-03-15T03:00:00.000Z', end: '2020-03-15T04:00:00.000Z' }
];

// Private state of the history query, read by the progress / items status tests
const internals = (historyQuery: HistoryQueryClass) =>
  historyQuery as unknown as { maxIntervalEndReached: string; itemsStatus: Map<string, HistoryQueryItemStatus> };

describe('HistoryQuery enabled', () => {
  let HistoryQuery: typeof HistoryQueryClass;
  let historyQuery: HistoryQueryClass;
  let north: NorthConnectorMock;
  let south: SouthConnectorMock;
  let logger: PinoLogger;

  // The SUT keeps a reference to this exports object: its functions are replaced in place in beforeEach
  const createUtilsMocks = () => ({
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn((_startTime: unknown, _endTime: unknown, _maxReadInterval?: unknown): typeof fixedIntervals => [])
  });
  const utilsExports = createUtilsMocks();

  before(() => {
    // Mock service/utils to prevent real delays
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    HistoryQuery = reloadModule<{ default: typeof HistoryQueryClass }>(nodeRequire, './history-query').default;
  });

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    Object.assign(utilsExports, createUtilsMocks());
    logger = new PinoLogger();
    north = new NorthConnectorMock(testData.north.list[0]);
    south = new SouthConnectorMock(testData.south.list[0]);
    historyQuery = new HistoryQuery(configuration, north, south);
  });

  afterEach(async () => {
    await historyQuery.stop();
    mock.timers.reset();
    mock.restoreAll();
  });

  /** Spies the history query metrics events and returns a getter of the last payload emitted for an event */
  const spyMetrics = () => {
    const emitMock = mock.method(historyQuery.metricsEvent, 'emit');
    return (event: string) => emitMock.mock.calls.filter(c => c.arguments[0] === event).at(-1)?.arguments[1];
  };

  it('should be properly initialized', async () => {
    await historyQuery.start();

    assert.strictEqual(north.start.mock.calls.length, 1);
    assert.strictEqual(south.start.mock.calls.length, 1);
    assert.deepStrictEqual(historyQuery.historyQueryConfiguration, configuration);
  });

  it('should start south connector', async () => {
    const clearIntervalMock = mock.method(globalThis, 'clearInterval');

    await historyQuery.start();
    south.connectedEvent.emit('connected');

    assert.strictEqual(south.start.mock.calls.length, 1);
    assert.strictEqual(south.historyQueryHandler.mock.calls.length, 1);
    assert.deepStrictEqual(south.historyQueryHandler.mock.calls[0].arguments, [
      expectedSouthItems,
      configuration.queryTimeRange.startTime,
      configuration.queryTimeRange.endTime
    ]);
    assert.strictEqual(clearIntervalMock.mock.calls.length, 0);

    south.connectedEvent.emit('connected');
    assert.strictEqual(clearIntervalMock.mock.calls.length, 1);
  });

  it('should start south connector with error', async () => {
    let handlerCallCount = 0;
    south.historyQueryHandler.mock.mockImplementation(async () => {
      handlerCallCount++;
      if (handlerCallCount <= 2) throw 'error';
    });

    await historyQuery.start();
    assert.strictEqual(south.start.mock.calls.length, 1);
    assert.strictEqual(north.start.mock.calls.length, 1);

    south.connectedEvent.emit('connected');

    await flushPromises();
    assert.strictEqual(south.historyQueryHandler.mock.calls.length, 1);
    assert.deepStrictEqual(south.historyQueryHandler.mock.calls[0].arguments[0], expectedSouthItems);

    assert.strictEqual(south.start.mock.calls.length, 2);
    assert.strictEqual(south.stop.mock.calls.length, 1);

    historyQuery.historyQueryConfiguration = { ...configuration, status: 'PENDING' };
    south.connectedEvent.emit('connected');
    await flushPromises();

    assert.strictEqual(south.start.mock.calls.length, 2);
    assert.strictEqual(south.stop.mock.calls.length, 1);
  });

  it('should properly stop', async () => {
    const clearIntervalMock = mock.method(globalThis, 'clearInterval');

    let southConnectedEventRemoved!: number;
    let southStopCalled!: number;
    let southMetricsEventRemoved!: number;
    let northStopCalled!: number;
    let northMetricsEventRemoved!: number;

    mock.method(south.connectedEvent, 'removeAllListeners', () => {
      southConnectedEventRemoved = performance.now();
    });
    south.stop.mock.mockImplementation(async () => {
      southStopCalled = performance.now();
    });
    mock.method(south.metricsEvent, 'removeAllListeners', () => {
      southMetricsEventRemoved = performance.now();
    });
    north.stop.mock.mockImplementation(async () => {
      northStopCalled = performance.now();
    });
    mock.method(north.metricsEvent, 'removeAllListeners', () => {
      northMetricsEventRemoved = performance.now();
    });

    await historyQuery.start();
    south.connectedEvent.emit('connected');
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
    assert.strictEqual(south.stop.mock.calls.length, 1);
    assert.strictEqual(north.stop.mock.calls.length, 1);
    assert.strictEqual(north.resetCache.mock.calls.length, 0);
    assert.strictEqual(south.resetCache.mock.calls.length, 0);

    // Second stop()
    await historyQuery.stop();
    assert.strictEqual(logger.debug.mock.calls.length, 0);

    await historyQuery.resetCache();
    assert.strictEqual(north.resetCache.mock.calls.length, 1);
    assert.strictEqual(south.resetCache.mock.calls.length, 1);
  });

  it('should properly finish and not stop', async () => {
    const stopMock = mock.method(historyQuery, 'stop', async () => undefined);
    south.historyIsRunning = true;
    // first call returns false, subsequent calls return true
    north.isCacheEmpty.mock.mockImplementation(() => north.isCacheEmpty.mock.calls.length > 1);

    await historyQuery.start();
    await historyQuery.finish();

    assert.ok(logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('is still running')));
    assert.strictEqual(stopMock.mock.calls.length, 0);

    await historyQuery.finish();
    assert.strictEqual(logger.trace.mock.calls.length, 2);

    south.historyIsRunning = false;
    await historyQuery.finish();
    assert.ok(logger.info.mock.calls.some(c => (c.arguments[0] as string).includes(`Finish History query "${configuration.name}"`)));
  });

  it('should properly refresh logger', async () => {
    mock.method(historyQuery, 'stop', async () => undefined);
    const initialLogger = logger;
    logger = new PinoLogger();
    historyQuery.refreshLogger();
    // isCacheEmpty returns true so finish() takes the info branch, on the refreshed logger
    await historyQuery.finish();
    assert.strictEqual(logger.info.mock.calls.length, 1);
    assert.strictEqual(initialLogger.info.mock.calls.length, 0);
  });

  it('should listen on metrics', async () => {
    const lastEmitted = spyMetrics();

    await historyQuery.start();

    north.metricsEvent.emit('connect', {});
    assert.ok(lastEmitted('north-connect'));

    north.metricsEvent.emit('run-start', {});
    assert.ok(lastEmitted('north-run-start'));

    north.metricsEvent.emit('run-end', {});
    assert.ok(lastEmitted('north-run-end'));

    north.metricsEvent.emit('cache-size', {});
    assert.ok(lastEmitted('north-cache-size'));

    north.metricsEvent.emit('cache-content-size', 123);
    assert.strictEqual(lastEmitted('north-cache-content-size'), 123);

    south.metricsEvent.emit('connect', {});
    assert.ok(lastEmitted('south-connect'));

    south.metricsEvent.emit('run-start', {});
    assert.ok(lastEmitted('south-run-start'));

    south.metricsEvent.emit('run-end', {});
    assert.ok(lastEmitted('south-run-end'));

    south.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: testData.constants.dates.DATE_1,
      currentIntervalEnd: testData.constants.dates.DATE_2
    });
    assert.ok(lastEmitted('south-history-query-interval'));

    south.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 2 });
    assert.ok(lastEmitted('south-history-query-item'));

    // 'south-history-query-start'/'south-history-query-stop' are emitted directly by HistoryQuery
    // itself (not forwarded from a south metricsEvent) around the historyQueryHandler run.
    south.connectedEvent.emit('connected');
    assert.ok(lastEmitted('south-history-query-start'));
    await flushPromises();
    assert.ok(lastEmitted('south-history-query-stop'));

    south.metricsEvent.emit('add-values', {});
    assert.ok(lastEmitted('south-add-values'));

    south.metricsEvent.emit('add-file', {});
    assert.ok(lastEmitted('south-add-file'));
  });

  it('should compute interval progress against the full, fixed interval list', async () => {
    utilsExports.generateIntervals.mock.mockImplementation(() => fixedIntervals);
    historyQuery = new HistoryQuery(configuration, north, south);
    const lastEmitted = spyMetrics();

    await historyQuery.start();

    // Reports mid-way through the first slot: not yet fully covered, so 0 of 4 slots done.
    south.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T00:30:00.000Z'
    });
    assert.deepStrictEqual(lastEmitted('south-history-query-interval'), {
      running: true,
      intervalProgress: 0,
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T00:30:00.000Z',
      currentIntervalNumber: 0,
      numberOfIntervals: 4,
      itemIntervalNumber: undefined,
      itemNumberOfIntervals: undefined
    });

    // Exactly covers the first two slots: 2 of 4 done, 50% progress.
    south.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T02:00:00.000Z'
    });
    assert.deepStrictEqual(lastEmitted('south-history-query-interval'), {
      running: true,
      intervalProgress: 0.5,
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T02:00:00.000Z',
      currentIntervalNumber: 2,
      numberOfIntervals: 4,
      itemIntervalNumber: undefined,
      itemNumberOfIntervals: undefined
    });

    // Covers the whole range: 4 of 4 done, 100% progress.
    south.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T03:00:00.000Z',
      currentIntervalEnd: '2020-03-15T04:00:00.000Z'
    });
    assert.deepStrictEqual(lastEmitted('south-history-query-interval'), {
      running: true,
      intervalProgress: 1,
      currentIntervalStart: '2020-03-15T03:00:00.000Z',
      currentIntervalEnd: '2020-03-15T04:00:00.000Z',
      currentIntervalNumber: 4,
      numberOfIntervals: 4,
      itemIntervalNumber: undefined,
      itemNumberOfIntervals: undefined
    });
  });

  it('should never let intervalProgress regress when a later item reports an earlier currentIntervalEnd (sawtooth regression)', async () => {
    utilsExports.generateIntervals.mock.mockImplementation(() => fixedIntervals);
    historyQuery = new HistoryQuery(configuration, north, south);
    const lastEmitted = spyMetrics();

    await historyQuery.start();

    // First item's own window reaches the end of the third fixed slot: 3 of 4 done, 75% progress.
    south.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T02:00:00.000Z',
      currentIntervalEnd: '2020-03-15T03:00:00.000Z',
      itemName: 'item1',
      currentItemNumber: 1,
      numberOfItems: 2
    });
    const firstPayload = lastEmitted('south-history-query-interval') as { intervalProgress: number; currentIntervalNumber: number };
    assert.deepStrictEqual(firstPayload, {
      running: true,
      intervalProgress: 0.75,
      currentIntervalStart: '2020-03-15T02:00:00.000Z',
      currentIntervalEnd: '2020-03-15T03:00:00.000Z',
      currentIntervalNumber: 3,
      numberOfIntervals: 4,
      itemName: 'item1',
      currentItemNumber: 1,
      numberOfItems: 2,
      itemIntervalNumber: undefined,
      itemNumberOfIntervals: undefined
    });

    // The run moves on to a second item, whose own window starts (and ends) well before where the
    // first item left off — without the ratchet this would make the overall progress drop back down.
    south.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T00:30:00.000Z',
      itemName: 'item2',
      currentItemNumber: 2,
      numberOfItems: 2
    });
    const secondPayload = lastEmitted('south-history-query-interval') as { intervalProgress: number; currentIntervalNumber: number };

    // The overall (ratcheted) progress must not decrease...
    assert.strictEqual(secondPayload.intervalProgress, firstPayload.intervalProgress);
    assert.strictEqual(secondPayload.currentIntervalNumber, firstPayload.currentIntervalNumber);
    // ...even though this event's own currentIntervalEnd genuinely regressed.
    assert.deepStrictEqual(secondPayload, {
      running: true,
      intervalProgress: 0.75,
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T00:30:00.000Z',
      currentIntervalNumber: 3,
      numberOfIntervals: 4,
      itemName: 'item2',
      currentItemNumber: 2,
      numberOfItems: 2,
      itemIntervalNumber: undefined,
      itemNumberOfIntervals: undefined
    });
  });

  it('should seed maxIntervalEndReached and itemsStatus from the south connector cache snapshot on start (restart resume)', async () => {
    south.getHistoryQuerySnapshot.mock.mockImplementation(() => ({
      items: [
        { itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: '2020-03-17T00:00:00.000Z', queryTime: null, value: null },
        {
          itemId: 'historyQueryItem2',
          itemName: 'item2',
          trackedInstant: configuration.queryTimeRange.endTime,
          queryTime: null,
          value: null
        }
      ]
    }));

    await historyQuery.start();

    // The higher of the two seeded trackedInstants (item2's, which equals the configured end time).
    assert.strictEqual(internals(historyQuery).maxIntervalEndReached, configuration.queryTimeRange.endTime);
    assert.deepStrictEqual(Array.from(internals(historyQuery).itemsStatus.values()), [
      {
        itemId: 'historyQueryItem1',
        itemName: 'item1',
        status: 'pending',
        lastValueTimestamp: '2020-03-17T00:00:00.000Z',
        recordsCount: 0
      },
      {
        itemId: 'historyQueryItem2',
        itemName: 'item2',
        status: 'done',
        lastValueTimestamp: configuration.queryTimeRange.endTime,
        recordsCount: 0
      }
    ]);
  });

  it('should relay history-query-item-start to south-history-query-item, marking items running/done and updating recordsCount', async () => {
    south.getHistoryQuerySnapshot.mock.mockImplementation(() => ({
      items: [
        { itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: null, queryTime: null, value: null },
        { itemId: 'historyQueryItem2', itemName: 'item2', trackedInstant: null, queryTime: null, value: null }
      ]
    }));
    const lastEmitted = spyMetrics();

    await historyQuery.start();

    south.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 2 });
    assert.deepStrictEqual(lastEmitted('south-history-query-item'), {
      itemName: 'item1',
      currentItemNumber: 1,
      numberOfItems: 2,
      itemsStatus: [
        { itemId: 'historyQueryItem1', itemName: 'item1', status: 'running', lastValueTimestamp: null, recordsCount: 0 },
        { itemId: 'historyQueryItem2', itemName: 'item2', status: 'pending', lastValueTimestamp: null, recordsCount: 0 }
      ]
    });

    // Values retrieved while item1 is running are attributed to item1.
    south.metricsEvent.emit('add-values', {
      numberOfValuesRetrieved: 3,
      lastValueRetrieved: { pointId: 'point1', timestamp: '2020-03-16T00:00:00.000Z', data: {} }
    });

    // The run moves on to item2: item1 is marked done, item2 becomes running.
    south.metricsEvent.emit('history-query-item-start', { itemName: 'item2', currentItemNumber: 2, numberOfItems: 2 });
    assert.deepStrictEqual(lastEmitted('south-history-query-item'), {
      itemName: 'item2',
      currentItemNumber: 2,
      numberOfItems: 2,
      itemsStatus: [
        { itemId: 'historyQueryItem1', itemName: 'item1', status: 'done', lastValueTimestamp: '2020-03-16T00:00:00.000Z', recordsCount: 3 },
        { itemId: 'historyQueryItem2', itemName: 'item2', status: 'running', lastValueTimestamp: null, recordsCount: 0 }
      ]
    });

    // A retrieved file while item2 is running increments its recordsCount without touching item1.
    south.metricsEvent.emit('add-file', { lastFileRetrieved: 'file1.csv' });
    assert.deepStrictEqual(Array.from(internals(historyQuery).itemsStatus.values()), [
      { itemId: 'historyQueryItem1', itemName: 'item1', status: 'done', lastValueTimestamp: '2020-03-16T00:00:00.000Z', recordsCount: 3 },
      { itemId: 'historyQueryItem2', itemName: 'item2', status: 'running', lastValueTimestamp: null, recordsCount: 1 }
    ]);
  });

  it('should relay a scan-mode tick to the north connector only', () => {
    const scanMode = testData.scanMode.list[0];
    historyQuery.triggerNorth(scanMode);
    assert.strictEqual(north.trigger.mock.calls.length, 1);
    assert.strictEqual(north.trigger.mock.calls[0].arguments[0], scanMode);
  });

  it('should mark running items as done when the history run completes normally (not stopping)', async () => {
    south.getHistoryQuerySnapshot.mock.mockImplementation(() => ({
      items: [{ itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: null, queryTime: null, value: null }]
    }));

    await historyQuery.start();

    // Mark item1 as running before the run resolves.
    south.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 1 });
    south.connectedEvent.emit('connected');
    await flushPromises();

    assert.strictEqual(internals(historyQuery).itemsStatus.get('historyQueryItem1')!.status, 'done');
  });

  it('should leave a running item status untouched when the history run completes while stopping', async () => {
    south.getHistoryQuerySnapshot.mock.mockImplementation(() => ({
      items: [{ itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: null, queryTime: null, value: null }]
    }));
    let resolveHandler!: () => void;
    south.historyQueryHandler.mock.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveHandler = resolve;
        })
    );

    await historyQuery.start();
    south.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 1 });
    south.connectedEvent.emit('connected');

    // Begin stopping (sets `stopping = true` synchronously) before the run's promise resolves.
    const stopPromise = historyQuery.stop();
    resolveHandler();
    await flushPromises();

    assert.strictEqual(internals(historyQuery).itemsStatus.get('historyQueryItem1')!.status, 'running');

    await stopPromise;
  });

  it('should keep the earlier seeded max interval end when a later item is not further ahead', async () => {
    south.getHistoryQuerySnapshot.mock.mockImplementation(() => ({
      items: [
        { itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: '2020-03-18T00:00:00.000Z', queryTime: null, value: null },
        { itemId: 'historyQueryItem2', itemName: 'item2', trackedInstant: '2020-03-16T00:00:00.000Z', queryTime: null, value: null }
      ]
    }));

    await historyQuery.start();

    // item2's trackedInstant is earlier than item1's, so the ratcheted max stays at item1's value.
    assert.strictEqual(internals(historyQuery).maxIntervalEndReached, '2020-03-18T00:00:00.000Z');
  });

  it('should surface itemIntervalProgress when the south connector reports its own interval count', async () => {
    const lastEmitted = spyMetrics();

    await historyQuery.start();

    south.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: testData.constants.dates.DATE_1,
      currentIntervalEnd: testData.constants.dates.DATE_2,
      currentIntervalNumber: 3,
      numberOfIntervals: 10
    });
    assert.strictEqual((lastEmitted('south-history-query-interval') as { itemIntervalProgress: number }).itemIntervalProgress, 0.3);
  });

  it('should get north cache sizes', async () => {
    const cacheSizes = historyQuery.getNorthCacheSizes();
    assert.strictEqual(north.getCacheSizes.mock.calls.length, 1);
    assert.deepStrictEqual(cacheSizes, { cache: 10, error: 20, archive: 30 });
  });

  it('should search cache', async () => {
    const searchParams = {
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    };
    await historyQuery.searchCacheContent(searchParams);
    assert.strictEqual(north.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(north.searchCacheContent.mock.calls[0].arguments[0], searchParams);
  });

  it('should get file from cache', async () => {
    await historyQuery.getFileFromCache('cache', 'file');
    assert.strictEqual(north.getFileFromCache.mock.calls.length, 1);
    assert.deepStrictEqual(north.getFileFromCache.mock.calls[0].arguments, ['cache', 'file']);
  });

  it('should update cache', async () => {
    const updateCommand: CacheContentUpdateCommand = {
      cache: { remove: [], move: [] },
      archive: { remove: [], move: [] },
      error: { remove: [], move: [] }
    };
    await historyQuery.updateCacheContent(updateCommand);
    assert.strictEqual(north.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(north.updateCacheContent.mock.calls[0].arguments[0], updateCommand);
  });
});
