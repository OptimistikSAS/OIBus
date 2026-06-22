import { describe, it, before, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, flushPromises } from '../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import nodeOpcuaMock from '../tests/__mocks__/node-opcua.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../model/south-connector.model';
import type {
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthItemSettings,
  SouthMSSQLItemSettings,
  SouthMSSQLSettings,
  SouthOPCUAItemSettings,
  SouthOPCUASettings
} from '../../shared/model/south-settings.model';
import type { OIBusContent, OIBusTimeValue } from '../../shared/model/engine.model';
import type { Instant } from '../../shared/model/types';
import type SouthFolderScannerClass from './south-folder-scanner/south-folder-scanner';
import type SouthMSSQLClass from './south-mssql/south-mssql';
import type SouthOPCUAClass from './south-opcua/south-opcua';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

describe('SouthConnector', () => {
  let SouthFolderScanner: typeof SouthFolderScannerClass;
  let SouthMSSQL: typeof SouthMSSQLClass;
  let SouthOPCUA: typeof SouthOPCUAClass;
  let southCacheService: SouthCacheServiceMock;

  const logger = new PinoLogger();
  const anotherLogger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (_southId: string, _data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

  const cronMockInstance = { stop: mock.fn() };
  const cronExports = {
    CronJob: mock.fn(function (_cron: unknown, _callback: () => void) {
      return cronMockInstance;
    })
  };

  const utilsExports = {
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn((_startTime: unknown, _startTimeFromCache: unknown, _endTime: unknown, _maxReadInterval?: unknown) => ({
      intervals: [] as Array<{ start: string; end: string }>,
      numberOfIntervalsDone: 0
    })),
    groupItemsByGroup: mock.fn((_type: unknown, items: Array<unknown>) => [items]),
    validateCronExpression: mock.fn(() => ({ expression: '' })),
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    convertDateTimeToInstant: mock.fn((v: unknown) => v),
    convertDelimiter: mock.fn((v: unknown) => v),
    formatInstant: mock.fn((v: unknown) => v),
    generateCsvContent: mock.fn(() => ''),
    generateFilenameForSerialization: mock.fn(() => 'filename.csv'),
    generateReplacementParameters: mock.fn(() => []),
    logQuery: mock.fn(),
    persistResults: mock.fn(async () => undefined)
  };

  const utilsOpcuaExports = {
    createSessionConfigs: mock.fn(() => []),
    getHistoryReadRequest: mock.fn(() => ({})),
    getTimestamp: mock.fn(() => ''),
    logMessages: mock.fn(),
    parseOPCUAValue: mock.fn(() => null)
  };

  const mssqlExports: Record<string, unknown> = {
    __esModule: true,
    ConnectionPool: mock.fn(function () {
      return { connect: mock.fn(async () => ({ request: mock.fn(), close: mock.fn() })) };
    })
  };
  mssqlExports.default = mssqlExports;

  before(() => {
    mockModule(nodeRequire, 'cron', cronExports);
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    mockModule(nodeRequire, 'mssql', mssqlExports);
    mockModule(nodeRequire, 'node-opcua', {
      __esModule: true,
      ...nodeOpcuaMock
    });
    mockModule(nodeRequire, '../service/utils-opcua', utilsOpcuaExports);
    SouthFolderScanner = reloadModule<{ default: typeof SouthFolderScannerClass }>(
      nodeRequire,
      './south-folder-scanner/south-folder-scanner'
    ).default;
    SouthMSSQL = reloadModule<{ default: typeof SouthMSSQLClass }>(nodeRequire, './south-mssql/south-mssql').default;
    SouthOPCUA = reloadModule<{ default: typeof SouthOPCUAClass }>(nodeRequire, './south-opcua/south-opcua').default;
  });

  describe('SouthConnector with file query', () => {
    let south: SouthFolderScannerClass;

    beforeEach(async () => {
      southCacheService = new SouthCacheServiceMock();
      addContentCallback.mock.resetCalls();
      for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      cronMockInstance.stop.mock.resetCalls();
      cronExports.CronJob = mock.fn(function (_cron: unknown, _callback: () => void) {
        return cronMockInstance;
      });
      utilsExports.groupItemsByGroup = mock.fn((_type: unknown, items: Array<unknown>) => [items]);
      utilsExports.validateCronExpression = mock.fn(() => ({ expression: '' }));
      utilsExports.generateIntervals = mock.fn(() => ({ intervals: [], numberOfIntervalsDone: 0 }));

      southCacheService.getSouthCache = mock.fn(() => ({
        southId: testData.south.list[0].id,
        scanModeId: testData.scanMode.list[0].id,
        maxInstant: testData.constants.dates.FAKE_NOW
      }));

      mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

      const config = JSON.parse(JSON.stringify(testData.south.list[0])) as SouthConnectorEntity<
        SouthFolderScannerSettings,
        SouthFolderScannerItemSettings
      >;
      south = new SouthFolderScanner(config, addContentCallback, southCacheRepository, logger, 'cacheFolder');
      await south.start();
    });

    afterEach(() => {
      mock.timers.reset();
      mock.restoreAll();
    });

    it('should properly add to queue a new task and trigger next run', () => {
      const runMock = mock.fn(async () => undefined);
      south.run = runMock;
      south.addToQueue(testData.scanMode.list[0]);
      assert.strictEqual(runMock.mock.calls.length, 1);
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, [
        testData.scanMode.list[0].id,
        testData.south.list[0].items.filter(element => element.scanMode?.id === testData.scanMode.list[0].id)
      ]);

      south.addToQueue(testData.scanMode.list[0]);
      assert.strictEqual((logger.warn as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
      assert.strictEqual(
        (logger.warn as Mock<(...args: Array<unknown>) => unknown>).mock.calls[0].arguments[0],
        `Task job not added in South connector queue for cron "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron}). The previous cron was still running. The next occurrences will be logged as trace for the next hour`
      );

      south.addToQueue(testData.scanMode.list[1]);
      assert.strictEqual(runMock.mock.calls.length, 1);
      assert.deepStrictEqual(south.connectorConfiguration, testData.south.list[0]);
    });

    it('should warn once per hour and log trace in between when the previous cron is still running', () => {
      const runMock = mock.fn(async () => undefined);
      south.run = runMock;
      const scanMode = testData.scanMode.list[0];

      // First tick enqueues the job and starts running it
      south.addToQueue(scanMode);
      // Subsequent ticks while it is still queued: first warns, the rest are traced
      south.addToQueue(scanMode);
      south.addToQueue(scanMode);
      south.addToQueue(scanMode);

      const warnMock = logger.warn as Mock<(...args: Array<unknown>) => unknown>;
      const traceMock = logger.trace as Mock<(...args: Array<unknown>) => unknown>;
      const message = `Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron}). The previous cron was still running`;
      const backpressureWarns = warnMock.mock.calls.filter(call => (call.arguments[0] as string).startsWith(message));
      const backpressureTraces = traceMock.mock.calls.filter(call => call.arguments[0] === message);

      assert.strictEqual(backpressureWarns.length, 1);
      assert.strictEqual(backpressureWarns[0].arguments[0], `${message}. The next occurrences will be logged as trace for the next hour`);
      assert.strictEqual(backpressureTraces.length, 2);

      // After an hour, the warning is emitted again
      mock.timers.tick(60 * 60 * 1000);
      south.addToQueue(scanMode);
      assert.strictEqual(warnMock.mock.calls.filter(call => (call.arguments[0] as string).startsWith(message)).length, 2);
    });

    it('should properly add to queue a new task and not trigger next run if no item', () => {
      const runMock = mock.fn(async () => undefined);
      south.run = runMock;
      south['connector'].items = [];
      south.addToQueue(testData.scanMode.list[0]);
      assert.strictEqual(runMock.mock.calls.length, 0);
    });

    it('should not update subscriptions if not compatible', async () => {
      await south.updateSubscriptions();
      assert.strictEqual((logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
      assert.strictEqual(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls[0].arguments[0],
        'This connector does not support subscriptions'
      );

      south.connectorConfiguration = testData.south.list[0] as SouthConnectorEntity<
        SouthFolderScannerSettings,
        SouthFolderScannerItemSettings
      >;
    });

    it('should not add to queue if connector is stopping', async () => {
      const promise = new Promise<void>(resolve => {
        setTimeout(resolve, 1000);
      });
      south.disconnect = mock.fn(() => promise);
      const runMock = mock.fn(async () => undefined);
      south.run = runMock;

      south.stop();
      south.addToQueue(testData.scanMode.list[0]);
      assert.strictEqual(runMock.mock.calls.length, 0);
      await flushPromises();
    });

    it('should add to queue a new task and not trigger next run if run in progress', () => {
      const runMock = mock.fn(async () => undefined);
      south.run = runMock;
      south.createDeferredPromise();
      south.addToQueue(testData.scanMode.list[0]);
      assert.strictEqual(runMock.mock.calls.length, 0);
      assert.ok(
        (logger.warn as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'A South task is already running'
        )
      );
    });

    it('should log an error and not crash when run() rejects', async () => {
      const runError = new Error('unexpected run failure');
      south.run = mock.fn(() => Promise.reject(runError));
      south.addToQueue(testData.scanMode.list[0]);
      await flushPromises();
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            (c.arguments[0] as string).includes('Unhandled error in South task runner') &&
            (c.arguments[0] as string).includes(runError.message)
        )
      );
    });

    it('should update cron jobs', () => {
      south.updateCronJobs();
      south.updateCronJobs();
      assert.strictEqual(south['cronByScanModeIds'].size, 2);

      south.createOrUpdateCronJob = mock.fn((_scanMode: unknown) => undefined);
      south.updateScanModeIfUsed({
        id: 'bad id',
        cron: '',
        description: '',
        name: '',
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      });

      south['connector'].items = [];
      south.updateCronJobs();
      assert.strictEqual(south['cronByScanModeIds'].size, 0);
    });

    it('should not create a cron for the item scan mode when the item is synced to a group', () => {
      const groupScanMode = testData.scanMode.list[0];
      const itemScanMode = testData.scanMode.list[1]; // different from the group's scan mode
      const group = {
        id: 'groupId1',
        name: 'group1',
        scanMode: groupScanMode,
        overlap: null,
        maxReadInterval: null,
        readDelay: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      south['connector'].groups = [group];
      south['connector'].items = [
        {
          ...testData.south.list[0].items[0],
          scanMode: itemScanMode,
          group,
          syncWithGroup: true
        } as unknown as SouthConnectorItemEntity<SouthFolderScannerItemSettings>
      ];

      south.updateCronJobs();

      // Only the group's scan mode should have a cron — not the item's own scan mode
      assert.strictEqual(south['cronByScanModeIds'].size, 1);
      assert.ok(south['cronByScanModeIds'].has(groupScanMode.id!));
      assert.ok(!south['cronByScanModeIds'].has(itemScanMode.id!));
    });

    it('should use another logger', async () => {
      (logger.info as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      south.setLogger(anotherLogger);
      await south.stop();
      assert.strictEqual((anotherLogger.info as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
      assert.strictEqual((logger.info as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
      south.hasSubscription();
    });

    it('should reset cache', async () => {
      await south.resetCache();
      assert.strictEqual((southCacheService.deleteItemsBySouth as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
    });

    it('should create a cron job', () => {
      cronExports.CronJob = mock.fn(function (_cron: unknown, callback: () => void) {
        setTimeout(() => callback(), 1000);
        return cronMockInstance;
      });
      const addToQueueMock = mock.fn((_scanMode: unknown) => undefined);
      south.addToQueue = addToQueueMock;
      south.createOrUpdateCronJob(testData.scanMode.list[0]);
      mock.timers.tick(1000);
      assert.strictEqual(addToQueueMock.mock.calls.length, 1);

      south.createOrUpdateCronJob(testData.scanMode.list[0]);
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] ===
            `Removing existing South cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
        )
      );
    });

    it('should properly update cron', async () => {
      south.createOrUpdateCronJob(testData.scanMode.list[0]);
      await south.updateScanModeIfUsed(testData.scanMode.list[0]);
      await south.connect();
      await south.disconnect();
      south.createOrUpdateCronJob(testData.scanMode.list[0]);
      await south.stop();

      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] ===
            `Creating South cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
        )
      );
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] ===
            `Removing existing South cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
        )
      );
    });

    it('should not create a cron job when the cron expression is invalid', () => {
      const error = new Error('Invalid cron expression');
      let validateCallCount = 0;
      utilsExports.validateCronExpression = mock.fn(() => {
        validateCallCount++;
        if (validateCallCount === 1) throw error;
        return { expression: '' };
      });

      south.createOrUpdateCronJob({ ...testData.scanMode.list[0], cron: '* * * * * *L' });

      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] ===
            `Error when creating South cron job for scan mode "${testData.scanMode.list[0].name}" (* * * * * *L): ${error.message}`
        )
      );
    });

    it('should query files', async () => {
      let directQueryCallCount = 0;
      const directQueryMock = mock.fn(async () => {
        directQueryCallCount++;
        if (directQueryCallCount === 2) throw new Error('file query error');
        return [];
      });
      south.directQuery = directQueryMock;

      await south.run(
        testData.scanMode.list[0].id,
        testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>
      );
      assert.strictEqual(directQueryMock.mock.calls.length, 1);
      assert.deepStrictEqual(directQueryMock.mock.calls[0].arguments, [testData.south.list[0].items]);
      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Direct querying 2 items`
        )
      );

      await south.run(
        testData.scanMode.list[0].id,
        testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>
      );

      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Error when querying items with direct access: file query error`
        )
      );
    });
  });

  describe('SouthConnector disabled', () => {
    let south: SouthMSSQLClass;

    beforeEach(async () => {
      southCacheService = new SouthCacheServiceMock();
      addContentCallback.mock.resetCalls();
      for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      cronExports.CronJob = mock.fn(function (_cron: unknown, _callback: () => void) {
        return cronMockInstance;
      });
      utilsExports.groupItemsByGroup = mock.fn((_type: unknown, items: Array<unknown>) => [items]);
      southCacheService.getSouthCache = mock.fn(() => ({
        southId: testData.south.list[1].id,
        scanModeId: testData.scanMode.list[0].id,
        maxInstant: testData.constants.dates.FAKE_NOW
      }));

      mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

      south = new SouthMSSQL(
        testData.south.list[1] as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );
      await south.start();
    });

    afterEach(() => {
      mock.timers.reset();
      mock.restoreAll();
    });

    it('should be properly initialized', () => {
      assert.ok((logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length >= 0);
      assert.strictEqual(south.isEnabled(), false);
      assert.ok((logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length >= 0);
      south.historyQueryHandler = mock.fn(async (_items: unknown, _startTime: unknown, _endTime: unknown) => undefined);
    });

    it('should ignore history query when not history items', async () => {
      await south.historyQueryHandler([], '2020-02-02T02:02:02.222Z', '2020-02-02T02:02:02.222Z');
      south.resolveDeferredPromise();
      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'No history items to read. Ignoring historyQuery'
        )
      );
    });

    it('should call historyQuery once per item for single-item connectors', async () => {
      const interval = { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => ({ intervals: [interval], numberOfIntervalsDone: 0 }));

      const historyQueryMock = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));
      south.historyQuery = historyQueryMock;

      const items = testData.south.list[1].items as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      // Each item must produce its own generateIntervals call
      assert.strictEqual(utilsExports.generateIntervals.mock.calls.length, 2);
      // historyQuery called once per item, each with a singleton array
      assert.strictEqual(historyQueryMock.mock.calls.length, 2);
      assert.deepStrictEqual(historyQueryMock.mock.calls[0].arguments[0], [items[0]]);
      assert.deepStrictEqual(historyQueryMock.mock.calls[1].arguments[0], [items[1]]);
    });

    it('should use independent cache entries per item for single-item connectors', async () => {
      const interval = { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => ({ intervals: [interval], numberOfIntervalsDone: 0 }));
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      const items = testData.south.list[1].items as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      // getItemLastValue must be called with each item's own id
      const getCalls = (southCacheService.getItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(getCalls.length, 2);
      assert.strictEqual(getCalls[0].arguments[1], items[0].id);
      assert.strictEqual(getCalls[1].arguments[1], items[1].id);

      // saveItemLastValue must be called with each item's own id
      const saveCalls = (southCacheService.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(saveCalls.length, 2);
      assert.strictEqual(saveCalls[0].arguments[1].itemId, items[0].id);
      assert.strictEqual(saveCalls[1].arguments[1].itemId, items[1].id);
    });
  });

  describe('SouthConnector with history and subscription', () => {
    let south: SouthOPCUAClass;

    beforeEach(async () => {
      southCacheService = new SouthCacheServiceMock();
      addContentCallback.mock.resetCalls();
      for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      cronExports.CronJob = mock.fn(function (_cron: unknown, _callback: () => void) {
        return cronMockInstance;
      });
      utilsExports.groupItemsByGroup = mock.fn((_type: unknown, items: Array<unknown>) => [items]);
      utilsExports.generateIntervals = mock.fn(() => ({ intervals: [], numberOfIntervalsDone: 0 }));
      southCacheService.getSouthCache = mock.fn(() => ({
        scanModeId: testData.scanMode.list[0].id,
        maxInstant: testData.constants.dates.FAKE_NOW,
        southId: testData.south.list[2].id
      }));

      mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

      south = new SouthOPCUA(
        testData.south.list[2] as SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
        addContentCallback,
        southCacheRepository,
        logger,
        'cacheFolder'
      );

      south.connect = mock.fn(async (): Promise<void> => undefined);
      south.disconnect = mock.fn(async (): Promise<void> => undefined);
      await south.start();
    });

    afterEach(() => {
      mock.timers.reset();
      mock.restoreAll();
    });

    it('should properly run task a task', async () => {
      let historyCallCount = 0;
      const historyQueryHandlerMock = mock.fn(async () => {
        historyCallCount++;
        if (historyCallCount === 1) throw new Error('history query error');
      });
      south.historyQueryHandler = historyQueryHandlerMock;
      let directCallCount = 0;
      const directQueryMock = mock.fn(async (): Promise<null> => {
        directCallCount++;
        if (directCallCount === 1) throw new Error('last point query error');
        return null;
      });
      south.directQuery = directQueryMock;

      await south.run(
        testData.scanMode.list[0].id,
        testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
      );

      assert.strictEqual(historyQueryHandlerMock.mock.calls.length, 1);
      assert.deepStrictEqual(historyQueryHandlerMock.mock.calls[0].arguments, [
        testData.south.list[2].items,
        DateTime.fromISO(testData.constants.dates.FAKE_NOW)
          .minus(3600 * 1000)
          .toUTC()
          .toISO()!,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.strictEqual(directQueryMock.mock.calls.length, 1);
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] === `Error when querying items with history capabilities: history query error`
        )
      );
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Error when querying items with direct access: last point query error`
        )
      );

      await south.run(
        testData.scanMode.list[0].id,
        testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
      );

      assert.deepStrictEqual(historyQueryHandlerMock.mock.calls[1].arguments, [
        testData.south.list[2].items,
        DateTime.fromISO(testData.constants.dates.FAKE_NOW)
          .minus(3600 * 1000)
          .toUTC()
          .toISO()!,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.strictEqual(historyQueryHandlerMock.mock.calls.length, 2);
      assert.strictEqual(directQueryMock.mock.calls.length, 2);

      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'No more task to run'
        )
      );

      south['stopping'] = true;
      const emitSpy = mock.method(south['taskRunner'], 'emit');

      await south.run('scanModeId', []);
      assert.strictEqual(emitSpy.mock.calls.length, 0);
    });

    it('should clean up queue and deferred promise when run() throws unexpectedly', async () => {
      const runError = new Error('unexpected metrics failure');
      mock.method(south.metricsEvent, 'emit', (event: string) => {
        if (event === 'run-start') throw runError;
      });

      south.addToQueue(testData.scanMode.list[0]);
      await flushPromises();

      assert.strictEqual(south['taskJobQueue'].length, 0);
      assert.strictEqual(south['runProgress$'], null);
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            (c.arguments[0] as string).includes('Unhandled error in South task runner') &&
            (c.arguments[0] as string).includes(runError.message)
        )
      );
    });

    it('should properly stop', async () => {
      await south.stop();
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] === `Stopping South "${testData.south.list[2].name}" (${testData.south.list[2].id})...`
        )
      );
      assert.ok(
        (logger.info as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `South connector "${testData.south.list[2].name}" stopped`
        )
      );
    });

    it('should properly stop with running task', async () => {
      const promise = new Promise<void>(resolve => {
        setTimeout(resolve, 1000);
      });
      south.historyQueryHandler = mock.fn(async () => promise);
      south.directQuery = mock.fn(async (): Promise<null> => null);
      const disconnectMock = mock.fn(async (): Promise<void> => undefined);
      south.disconnect = disconnectMock;

      south.run(testData.scanMode.list[0].id, testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>);

      south.stop();
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] === `Stopping South "${testData.south.list[2].name}" (${testData.south.list[2].id})...`
        )
      );
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Waiting for South task to finish'
        )
      );
      assert.strictEqual(disconnectMock.mock.calls.length, 0);
      mock.timers.tick(1000);
      await flushPromises();
      assert.strictEqual(disconnectMock.mock.calls.length, 1);
    });

    it('should add values', async () => {
      await south.addContent({ type: 'time-values', content: [] }, testData.constants.dates.DATE_1, []);
      assert.strictEqual((logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.strictEqual((southCacheService.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);

      const values = [{}, {}] as Array<OIBusTimeValue>;
      await south.addContent({ type: 'time-values', content: values }, testData.constants.dates.DATE_1, testData.south.list[2].items);
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Add 2 values to cache from South "${testData.south.list[2].name}"`
        )
      );
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
        testData.south.list[2].id,
        { type: 'time-values', content: values },
        testData.constants.dates.DATE_1,
        testData.south.list[2].items
      ]);
    });

    it('should add file', async () => {
      await south.addContent({ type: 'any', filePath: 'file.csv' }, testData.constants.dates.DATE_1, testData.south.list[2].items);
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] === `Add file "file.csv" to cache from South "${testData.south.list[2].name}"`
        )
      );
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
        testData.south.list[2].id,
        { type: 'any', filePath: 'file.csv' },
        testData.constants.dates.DATE_1,
        testData.south.list[2].items
      ]);
    });

    it('should add any content', async () => {
      const addValuesListener = mock.fn();
      south.metricsEvent.on('add-values', addValuesListener);

      await south.addContent({ type: 'any-content', content: 'file.csv' }, testData.constants.dates.DATE_1, []);
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] === `Add 8 bytes of content to cache from South "${testData.south.list[2].name}"`
        )
      );
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
        testData.south.list[2].id,
        { type: 'any-content', content: 'file.csv' },
        testData.constants.dates.DATE_1,
        []
      ]);
      // any-content is one opaque payload: counts as 1 value (not its byte length), no time value
      assert.strictEqual(addValuesListener.mock.calls.length, 1);
      assert.deepStrictEqual(addValuesListener.mock.calls[0].arguments[0], { numberOfValuesRetrieved: 1, lastValueRetrieved: null });
    });

    it('should manage history query with several intervals when stopping', async () => {
      const intervals = [
        { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
        { start: '2021-02-02T02:02:02.222Z', end: '2022-02-02T02:02:02.222Z' },
        { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
      ];
      let generateIntervalsCallCount = 0;
      utilsExports.generateIntervals = mock.fn(
        (_startTime: unknown, _startTimeFromCache: unknown, _endTime: unknown, _maxReadInterval?: unknown) => {
          generateIntervalsCallCount++;
          if (generateIntervalsCallCount === 1) return { intervals, numberOfIntervalsDone: 0 };
          return { intervals: [], numberOfIntervalsDone: 0 };
        }
      );

      const historyQueryMock = mock.fn(
        () =>
          new Promise<{ trackedInstant: Instant | null; value: unknown | null }>(resolve => {
            setTimeout(() => {
              resolve({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null });
            }, 1000);
          })
      );
      south.historyQuery = historyQueryMock;

      south.createDeferredPromise();
      south
        .historyQueryHandler(
          testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
          '2020-02-02T02:02:02.222Z',
          '2023-02-02T02:02:02.222Z'
        )
        .then(() => {
          south.resolveDeferredPromise();
        });
      south.stop();

      mock.timers.tick(10000);

      await flushPromises();

      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] ===
            `Connector is stopping. Exiting history query at interval 0: [2020-02-02T02:02:02.222Z, 2021-02-02T02:02:02.222Z]`
        )
      );
      assert.strictEqual(historyQueryMock.mock.calls.length, 1);
    });

    it('should use group historian settings when syncWithGroup is true', async () => {
      const group = {
        id: 'group1',
        name: 'Group 1',
        scanMode: testData.scanMode.list[0],
        maxReadInterval: 1800,
        readDelay: 100,
        overlap: 50,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const itemsWithGroup = [
        {
          ...(testData.south.list[2].items[0] as SouthConnectorItemEntity<SouthOPCUAItemSettings>),
          group,
          syncWithGroup: true
        }
      ];

      utilsExports.generateIntervals = mock.fn(() => ({ intervals: [], numberOfIntervalsDone: 0 }));

      await south.historyQueryHandler(itemsWithGroup, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z');

      assert.strictEqual(utilsExports.generateIntervals.mock.calls.length, 1);
      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[0], '2020-02-02T02:02:02.222Z');
      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[2], '2023-02-02T02:02:02.222Z');
      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[3], 1800);
    });

    it('should update subscriptions', async () => {
      south['connector'].items = south['connector'].items.map(item => ({
        ...item,
        scanMode: { ...item.scanMode!, id: 'subscription' }
      }));
      south['subscribedItems'] = [south['connector'].items[0]];
      south.unsubscribe = mock.fn(async (): Promise<void> => undefined);
      south.subscribe = mock.fn(async (): Promise<void> => undefined);
      await south.updateSubscriptions();
      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Subscribing to 3 new items'
        )
      );

      south['connector'].items = [];

      await south.updateSubscriptions();

      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Unsubscribing from 4 items'
        )
      );
      assert.strictEqual((logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
    });

    it('should update subscriptions and log error', async () => {
      south['connector'].items = [
        {
          id: 'southItemId5',
          name: 'opcua sub',
          enabled: true,
          settings: {
            mode: 'da'
          } as SouthOPCUAItemSettings,
          group: null,
          syncWithGroup: false,
          maxReadInterval: null,
          readDelay: null,
          overlap: null,
          scanMode: {
            id: 'subscription',
            name: 'subscription',
            description: '',
            cron: '',
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'southItemId5',
          name: 'opcua sub',
          enabled: true,
          settings: {
            mode: 'da'
          } as SouthOPCUAItemSettings,
          group: null,
          syncWithGroup: false,
          maxReadInterval: null,
          readDelay: null,
          overlap: null,
          scanMode: {
            id: 'subscription',
            name: 'subscription',
            description: '',
            cron: '',
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        }
      ];
      let unsubscribeCallCount = 0;
      south.unsubscribe = mock.fn(async (): Promise<void> => {
        unsubscribeCallCount++;
        if (unsubscribeCallCount === 1) throw new Error('unsubscribe error');
      });
      let subscribeCallCount = 0;
      south.subscribe = mock.fn(async (): Promise<void> => {
        subscribeCallCount++;
        if (subscribeCallCount === 1) throw new Error('subscribe error');
      });
      await south.updateSubscriptions();
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Error when subscribing to new items: subscribe error'
        )
      );
      await south.updateSubscriptions();
      south['connector'].items = [];

      await south.updateSubscriptions();
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Error when unsubscribing from items: unsubscribe error'
        )
      );
    });
  });
});
