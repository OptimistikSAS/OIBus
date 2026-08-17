import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, flushPromises } from '../tests/utils/test-utils';
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

  const utilsExports = {
    delay: mock.fn(async () => undefined),
    createFolder: mock.fn(async () => undefined),
    generateIntervals: mock.fn(
      (_startTime: unknown, _endTime: unknown, _maxReadInterval?: unknown) =>
        [] as Array<{
          start: string;
          end: string;
        }>
    )
  };

  before(() => {
    // Mock service/utils to prevent real delays and folder creation
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    HistoryQuery = reloadModule<{ default: typeof HistoryQueryClass }>(nodeRequire, './history-query').default;
  });

  beforeEach(async () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    utilsExports.generateIntervals = mock.fn(() => []);

    mockedNorth1Mock = new NorthConnectorMock(testData.north.list[0]);
    mockedSouth1Mock = new SouthConnectorMock(testData.south.list[0]);
    // structural mocks — satisfy connector interfaces at injection boundaries
    mockedNorth1 = mockedNorth1Mock as unknown as NorthConnector<NorthSettings>;
    mockedSouth1 = mockedSouth1Mock as unknown as SouthConnector<SouthSettings, SouthItemSettings>;

    historyQuery = new HistoryQuery(testData.historyQueries.list[0], mockedNorth1, mockedSouth1);
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
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

    await historyQuery.start();
    mockedSouth1Mock.connectedEvent.emit('connected');

    assert.strictEqual(mockedSouth1Mock.start.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1Mock.historyQueryHandler.mock.calls.length, 1);
    assert.deepStrictEqual(
      mockedSouth1Mock.historyQueryHandler.mock.calls[0].arguments[0],
      testData.historyQueries.list[0].items.map(item => ({
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
        recoveryStrategy: null
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
        recoveryStrategy: null
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
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

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

    mockedSouth1.historyIsRunning = false;
    await historyQuery.finish();
    assert.ok(
      logger.info.mock.calls.some(c =>
        (c.arguments[0] as string).includes(`Finish History query "${testData.historyQueries.list[0].name}"`)
      )
    );
  });

  it('should properly refresh logger', async () => {
    mock.method(
      historyQuery,
      'stop',
      mock.fn(async () => undefined)
    );
    // isCacheEmpty must return true so finish() takes the info branch
    mockedNorth1Mock.isCacheEmpty = mock.fn(() => true);
    const callsBefore = logger.info.mock.calls.length;
    historyQuery.refreshLogger();
    await historyQuery.finish();
    assert.strictEqual(logger.info.mock.calls.length, callsBefore + 1);
  });

  it('should listen on metrics', async () => {
    const emitMock = mock.method(historyQuery.metricsEvent, 'emit');
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

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

    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: testData.constants.dates.DATE_1,
      currentIntervalEnd: testData.constants.dates.DATE_2
    });
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-history-query-interval'));

    mockedSouth1Mock.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 2 });
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-history-query-item'));

    // 'south-history-query-start'/'south-history-query-stop' are emitted directly by HistoryQuery
    // itself (not forwarded from a south metricsEvent) around the historyQueryHandler run.
    mockedSouth1Mock.connectedEvent.emit('connected');
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-history-query-start'));
    await flushPromises();
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-history-query-stop'));

    mockedSouth1Mock.metricsEvent.emit('add-values', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-add-values'));

    mockedSouth1Mock.metricsEvent.emit('add-file', {});
    assert.ok(emitMock.mock.calls.some(c => c.arguments[0] === 'south-add-file'));
  });

  it('should compute interval progress against the full, fixed interval list', async () => {
    // Four fixed hour-long slots spanning the whole configured history range, independent of
    // whatever sub-intervals the south connector queries in a given run.
    const fixedIntervals = [
      { start: '2020-03-15T00:00:00.000Z', end: '2020-03-15T01:00:00.000Z' },
      { start: '2020-03-15T01:00:00.000Z', end: '2020-03-15T02:00:00.000Z' },
      { start: '2020-03-15T02:00:00.000Z', end: '2020-03-15T03:00:00.000Z' },
      { start: '2020-03-15T03:00:00.000Z', end: '2020-03-15T04:00:00.000Z' }
    ];
    utilsExports.generateIntervals = mock.fn(() => fixedIntervals);
    const progressHistoryQuery = new HistoryQuery(testData.historyQueries.list[0], mockedNorth1, mockedSouth1);
    const emitMock = mock.method(progressHistoryQuery.metricsEvent, 'emit');
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

    await progressHistoryQuery.start();

    // Reports mid-way through the first slot: not yet fully covered, so 0 of 4 slots done.
    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T00:30:00.000Z'
    });
    let call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-interval')!;
    assert.deepStrictEqual(call.arguments[1], {
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
    emitMock.mock.resetCalls();
    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T02:00:00.000Z'
    });
    call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-interval')!;
    assert.deepStrictEqual(call.arguments[1], {
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
    emitMock.mock.resetCalls();
    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T03:00:00.000Z',
      currentIntervalEnd: '2020-03-15T04:00:00.000Z'
    });
    call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-interval')!;
    assert.deepStrictEqual(call.arguments[1], {
      running: true,
      intervalProgress: 1,
      currentIntervalStart: '2020-03-15T03:00:00.000Z',
      currentIntervalEnd: '2020-03-15T04:00:00.000Z',
      currentIntervalNumber: 4,
      numberOfIntervals: 4,
      itemIntervalNumber: undefined,
      itemNumberOfIntervals: undefined
    });

    await progressHistoryQuery.stop();
  });

  it('should never let intervalProgress regress when a later item reports an earlier currentIntervalEnd (sawtooth regression)', async () => {
    // Same fixed, whole-range interval breakdown as the previous test.
    const fixedIntervals = [
      { start: '2020-03-15T00:00:00.000Z', end: '2020-03-15T01:00:00.000Z' },
      { start: '2020-03-15T01:00:00.000Z', end: '2020-03-15T02:00:00.000Z' },
      { start: '2020-03-15T02:00:00.000Z', end: '2020-03-15T03:00:00.000Z' },
      { start: '2020-03-15T03:00:00.000Z', end: '2020-03-15T04:00:00.000Z' }
    ];
    utilsExports.generateIntervals = mock.fn(() => fixedIntervals);
    const progressHistoryQuery = new HistoryQuery(testData.historyQueries.list[0], mockedNorth1, mockedSouth1);
    const emitMock = mock.method(progressHistoryQuery.metricsEvent, 'emit');
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

    await progressHistoryQuery.start();

    // First item's own window reaches the end of the third fixed slot: 3 of 4 done, 75% progress.
    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T02:00:00.000Z',
      currentIntervalEnd: '2020-03-15T03:00:00.000Z',
      itemName: 'item1',
      currentItemNumber: 1,
      numberOfItems: 2
    });
    let call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-interval')!;
    assert.deepStrictEqual(call.arguments[1], {
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
    const firstIntervalProgress = (call.arguments[1] as { intervalProgress: number }).intervalProgress;
    const firstCurrentIntervalNumber = (call.arguments[1] as { currentIntervalNumber: number }).currentIntervalNumber;

    // The run moves on to a second item, whose own window starts (and ends) well before where the
    // first item left off — without the ratchet this would make the overall progress drop back down.
    emitMock.mock.resetCalls();
    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: '2020-03-15T00:00:00.000Z',
      currentIntervalEnd: '2020-03-15T00:30:00.000Z',
      itemName: 'item2',
      currentItemNumber: 2,
      numberOfItems: 2
    });
    call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-interval')!;
    const secondPayload = call.arguments[1] as { intervalProgress: number; currentIntervalNumber: number };

    // The overall (ratcheted) progress must not decrease...
    assert.ok(secondPayload.intervalProgress >= firstIntervalProgress);
    assert.ok(secondPayload.currentIntervalNumber >= firstCurrentIntervalNumber);
    assert.strictEqual(secondPayload.intervalProgress, firstIntervalProgress);
    assert.strictEqual(secondPayload.currentIntervalNumber, firstCurrentIntervalNumber);
    // ...even though this event's own currentIntervalEnd genuinely regressed.
    assert.deepStrictEqual(call.arguments[1], {
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

    await progressHistoryQuery.stop();
  });

  it('should seed maxIntervalEndReached and itemsStatus from the south connector cache snapshot on start (restart resume)', async () => {
    mockedSouth1Mock.getHistoryQuerySnapshot = mock.fn(() => ({
      items: [
        { itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: '2020-03-17T00:00:00.000Z', queryTime: null, value: null },
        {
          itemId: 'historyQueryItem2',
          itemName: 'item2',
          trackedInstant: testData.historyQueries.list[0].queryTimeRange.endTime,
          queryTime: null,
          value: null
        }
      ]
    }));
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

    await historyQuery.start();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = historyQuery as any;
    // The higher of the two seeded trackedInstants (item2's, which equals the configured end time).
    assert.strictEqual(internal.maxIntervalEndReached, testData.historyQueries.list[0].queryTimeRange.endTime);
    assert.deepStrictEqual(Array.from(internal.itemsStatus.values()), [
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
        lastValueTimestamp: testData.historyQueries.list[0].queryTimeRange.endTime,
        recordsCount: 0
      }
    ]);
  });

  it('should relay history-query-item-start to south-history-query-item, marking items running/done and updating recordsCount', async () => {
    mockedSouth1Mock.getHistoryQuerySnapshot = mock.fn(() => ({
      items: [
        { itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: null, queryTime: null, value: null },
        { itemId: 'historyQueryItem2', itemName: 'item2', trackedInstant: null, queryTime: null, value: null }
      ]
    }));
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);
    const emitMock = mock.method(historyQuery.metricsEvent, 'emit');

    await historyQuery.start();

    mockedSouth1Mock.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 2 });
    let call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-item')!;
    assert.deepStrictEqual(call.arguments[1], {
      itemName: 'item1',
      currentItemNumber: 1,
      numberOfItems: 2,
      itemsStatus: [
        { itemId: 'historyQueryItem1', itemName: 'item1', status: 'running', lastValueTimestamp: null, recordsCount: 0 },
        { itemId: 'historyQueryItem2', itemName: 'item2', status: 'pending', lastValueTimestamp: null, recordsCount: 0 }
      ]
    });

    // Values retrieved while item1 is running are attributed to item1.
    mockedSouth1Mock.metricsEvent.emit('add-values', {
      numberOfValuesRetrieved: 3,
      lastValueRetrieved: { pointId: 'point1', timestamp: '2020-03-16T00:00:00.000Z', data: {} }
    });

    // The run moves on to item2: item1 is marked done, item2 becomes running.
    emitMock.mock.resetCalls();
    mockedSouth1Mock.metricsEvent.emit('history-query-item-start', { itemName: 'item2', currentItemNumber: 2, numberOfItems: 2 });
    call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-item')!;
    assert.deepStrictEqual(call.arguments[1], {
      itemName: 'item2',
      currentItemNumber: 2,
      numberOfItems: 2,
      itemsStatus: [
        { itemId: 'historyQueryItem1', itemName: 'item1', status: 'done', lastValueTimestamp: '2020-03-16T00:00:00.000Z', recordsCount: 3 },
        { itemId: 'historyQueryItem2', itemName: 'item2', status: 'running', lastValueTimestamp: null, recordsCount: 0 }
      ]
    });

    // A retrieved file while item2 is running increments its recordsCount without touching item1.
    mockedSouth1Mock.metricsEvent.emit('add-file', { lastFileRetrieved: 'file1.csv' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = historyQuery as any;
    assert.deepStrictEqual(Array.from(internal.itemsStatus.values()), [
      { itemId: 'historyQueryItem1', itemName: 'item1', status: 'done', lastValueTimestamp: '2020-03-16T00:00:00.000Z', recordsCount: 3 },
      { itemId: 'historyQueryItem2', itemName: 'item2', status: 'running', lastValueTimestamp: null, recordsCount: 1 }
    ]);
  });

  it('should relay a scan-mode tick to the north connector only', () => {
    const scanMode = testData.scanMode.list[0];
    historyQuery.triggerNorth(scanMode);
    assert.strictEqual(mockedNorth1Mock.trigger.mock.calls.length, 1);
    assert.strictEqual(mockedNorth1Mock.trigger.mock.calls[0].arguments[0], scanMode);
  });

  it('should mark running items as done when the history run completes normally (not stopping)', async () => {
    mockedSouth1Mock.getHistoryQuerySnapshot = mock.fn(() => ({
      items: [{ itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: null, queryTime: null, value: null }]
    }));
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

    await historyQuery.start();

    // Mark item1 as running before the run resolves.
    mockedSouth1Mock.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 1 });
    mockedSouth1Mock.connectedEvent.emit('connected');
    await flushPromises();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = historyQuery as any;
    assert.strictEqual(internal.itemsStatus.get('historyQueryItem1').status, 'done');
  });

  it('should leave a running item status untouched when the history run completes while stopping', async () => {
    mockedSouth1Mock.getHistoryQuerySnapshot = mock.fn(() => ({
      items: [{ itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: null, queryTime: null, value: null }]
    }));
    let resolveHandler!: () => void;
    mockedSouth1Mock.historyQueryHandler = mock.fn(
      () =>
        new Promise<void>(resolve => {
          resolveHandler = resolve;
        })
    );

    await historyQuery.start();
    mockedSouth1Mock.metricsEvent.emit('history-query-item-start', { itemName: 'item1', currentItemNumber: 1, numberOfItems: 1 });
    mockedSouth1Mock.connectedEvent.emit('connected');

    // Begin stopping (sets `stopping = true` synchronously) before the run's promise resolves.
    const stopPromise = historyQuery.stop();
    resolveHandler();
    await flushPromises();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = historyQuery as any;
    assert.strictEqual(internal.itemsStatus.get('historyQueryItem1').status, 'running');

    await stopPromise;
  });

  it('should keep the earlier seeded max interval end when a later item is not further ahead', async () => {
    mockedSouth1Mock.getHistoryQuerySnapshot = mock.fn(() => ({
      items: [
        { itemId: 'historyQueryItem1', itemName: 'item1', trackedInstant: '2020-03-18T00:00:00.000Z', queryTime: null, value: null },
        { itemId: 'historyQueryItem2', itemName: 'item2', trackedInstant: '2020-03-16T00:00:00.000Z', queryTime: null, value: null }
      ]
    }));
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);

    await historyQuery.start();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = historyQuery as any;
    // item2's trackedInstant is earlier than item1's, so the ratcheted max stays at item1's value.
    assert.strictEqual(internal.maxIntervalEndReached, '2020-03-18T00:00:00.000Z');
  });

  it('should surface itemIntervalProgress when the south connector reports its own interval count', async () => {
    mockedSouth1Mock.historyQueryHandler = mock.fn(async () => undefined);
    const emitMock = mock.method(historyQuery.metricsEvent, 'emit');

    await historyQuery.start();

    mockedSouth1Mock.metricsEvent.emit('history-query-interval', {
      currentIntervalStart: testData.constants.dates.DATE_1,
      currentIntervalEnd: testData.constants.dates.DATE_2,
      currentIntervalNumber: 3,
      numberOfIntervals: 10
    });
    const call = emitMock.mock.calls.find(c => c.arguments[0] === 'south-history-query-interval')!;
    assert.strictEqual((call.arguments[1] as { itemIntervalProgress: number }).itemIntervalProgress, 0.3);
  });

  it('should get north cache sizes', async () => {
    const cacheSizes = historyQuery.getNorthCacheSizes();
    assert.strictEqual(mockedNorth1Mock.getCacheSizes.mock.calls.length, 1);
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
