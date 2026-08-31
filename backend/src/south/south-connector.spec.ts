import { afterEach, before, beforeEach, describe, it, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
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
import type { OIBusContent, OIBusRecord, OIBusTimeValue } from '../../shared/model/engine.model';
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

  const logger = new PinoLogger();
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
    generateIntervals: mock.fn(
      (_startTime: unknown, _endTime: unknown, _maxReadInterval?: unknown, _strategy?: unknown) =>
        [] as Array<{ start: string; end: string }>
    ),
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
    getErrorMessage: mock.fn((error: unknown) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message;
      }
      return String(error);
    }),
    logQuery: mock.fn(),
    persistResults: mock.fn(async () => undefined),
    // Mirrors the real implementation in service/utils.ts — kept in sync manually since it's a
    // handful of lines and some tests assert the exact { itemId/itemName } / { groupId/groupName } shape.
    workUnitLogCtx: mock.fn((items: Array<{ id: string; name: string; group?: { id: string; name: string } | null }>) => {
      if (items.length === 0) return {};
      if (items.length === 1) return { itemId: items[0].id, itemName: items[0].name };
      const lead = items[0];
      return lead.group ? { groupId: lead.group.id, groupName: lead.group.name } : {};
    })
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
    mockModule(nodeRequire, 'mssql', mssqlExports);
    mockModule(nodeRequire, 'node-opcua', {
      __esModule: true,
      ...nodeOpcuaMock
    });
    mockModule(nodeRequire, '../service/utils-opcua', utilsOpcuaExports);
    mockModule(nodeRequire, '../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

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
      addContentCallback.mock.resetCalls();
      // southCacheRepository is a single shared instance across every test in this file (unlike the
      // old per-test southCacheService mock), so its call history must be reset explicitly here.
      for (const fn of [
        southCacheRepository.getItemLastValue,
        southCacheRepository.getGroupLastValue,
        southCacheRepository.saveItemLastValue,
        southCacheRepository.saveGroupLastValue,
        southCacheRepository.deleteItemValue,
        southCacheRepository.deleteItemsBySouth
      ]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      cronMockInstance.stop.mock.resetCalls();
      cronExports.CronJob = mock.fn(function (_cron: unknown, _callback: () => void) {
        return cronMockInstance;
      });
      utilsExports.groupItemsByGroup = mock.fn((_type: unknown, items: Array<unknown>) => [items]);
      utilsExports.validateCronExpression = mock.fn(() => ({ expression: '' }));
      utilsExports.generateIntervals = mock.fn(() => []);

      mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

      const config = JSON.parse(JSON.stringify(testData.south.list[0])) as SouthConnectorEntity<
        SouthFolderScannerSettings,
        SouthFolderScannerItemSettings
      >;
      south = new SouthFolderScanner(config, addContentCallback, southCacheRepository, 'cacheFolder');
      await south.start();
    });

    afterEach(() => {
      mock.timers.reset();
      mock.restoreAll();
    });

    it('should properly add to queue a new task and dispatch it immediately', () => {
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      south.trigger(testData.scanMode.list[0]);
      assert.strictEqual(runTaskMock.mock.calls.length, 1);
      assert.deepStrictEqual(runTaskMock.mock.calls[0].arguments, [
        {
          kind: 'items',
          scanModeId: testData.scanMode.list[0].id,
          items: testData.south.list[0].items.filter(element => element.scanMode?.id === testData.scanMode.list[0].id)
        }
      ]);

      // Same scan mode again while the first task is still in flight (runTask hasn't resolved yet): backpressure
      south.trigger(testData.scanMode.list[0]);
      assert.strictEqual((logger.warn as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
      assert.strictEqual(
        (logger.warn as Mock<(...args: Array<unknown>) => unknown>).mock.calls[0].arguments[0],
        `Task job not added in South connector queue for cron "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron}). The previous cron was still running. The next occurrences will be logged as trace for the next hour`
      );

      // A different scan mode's items are queued, but the single (default) concurrency slot is
      // still held by the first task, so it isn't dispatched yet.
      south.trigger(testData.scanMode.list[1]);
      assert.strictEqual(runTaskMock.mock.calls.length, 1);
      assert.deepStrictEqual(south.connectorConfiguration, testData.south.list[0]);
    });

    it('should queue and run a Configuration Workflow run, resolving with what run() returns', async () => {
      const run = mock.fn(async () => 'run result');
      const result = await south.enqueueWorkflowRun('workflowId1', run);
      assert.strictEqual(result, 'run result');
      assert.strictEqual(run.mock.calls.length, 1);
    });

    it('should reject the returned promise when run() rejects', async () => {
      const runError = new Error('discovery failed');
      await assert.rejects(
        south.enqueueWorkflowRun('workflowId1', () => Promise.reject(runError)),
        runError
      );
    });

    it('should interleave with items on the same connection: a queued workflow run waits for the concurrency slot an in-flight item task holds', async () => {
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      // Occupy the (default) single concurrency slot with an unresolved items task
      south.trigger(testData.scanMode.list[0]);
      assert.strictEqual(runTaskMock.mock.calls.length, 1);

      const run = mock.fn(async () => undefined);
      const queued = south.enqueueWorkflowRun('workflowId1', run);
      assert.ok(queued !== null);
      assert.strictEqual(run.mock.calls.length, 0, 'the workflow run must not start while the items task holds the only slot');
      assert.strictEqual(south['taskQueue'].length, 1);
    });

    it('should return null and not queue when the same workflow is already queued or running', () => {
      const first = south.enqueueWorkflowRun('workflowId1', () => new Promise<void>(() => undefined));
      assert.ok(first !== null);

      const second = south.enqueueWorkflowRun(
        'workflowId1',
        mock.fn(async () => undefined)
      );
      assert.strictEqual(second, null);
      assert.ok(
        (logger.warn as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('Workflow "workflowId1" is already queued or running')
        )
      );
    });

    it('should allow a different workflow id to queue independently of one that is already running', async () => {
      const runOne = south.enqueueWorkflowRun('workflowId1', () => new Promise<void>(() => undefined));
      assert.ok(runOne !== null);

      const runTwo = mock.fn(async () => undefined);
      const result = south.enqueueWorkflowRun('workflowId2', runTwo);
      assert.ok(result !== null);
      // Both compete for the single default concurrency slot - workflowId1 holds it, so
      // workflowId2's run() hasn't been called yet, but it is legitimately queued (not rejected).
      assert.strictEqual(runTwo.mock.calls.length, 0);
      assert.strictEqual(south['taskQueue'].length, 1);
    });

    it('should return null and not queue when the connector is disabled', () => {
      south.isEnabled = mock.fn((): boolean => false);
      const result = south.enqueueWorkflowRun(
        'workflowId1',
        mock.fn(async () => undefined)
      );
      assert.strictEqual(result, null);
    });

    it('should return null and not queue when the connector is stopping', async () => {
      const promise = new Promise<void>(resolve => setTimeout(resolve, 1000));
      south.disconnect = mock.fn(() => promise);
      south.stop();
      const result = south.enqueueWorkflowRun(
        'workflowId1',
        mock.fn(async () => undefined)
      );
      assert.strictEqual(result, null);
      await flushPromises();
    });

    it('should reject a workflow run still sitting in the queue (never dispatched) when the connector disconnects', async () => {
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      // Occupy the only slot so the workflow run below stays queued, not dispatched.
      south.trigger(testData.scanMode.list[0]);

      const queued = south.enqueueWorkflowRun(
        'workflowId1',
        mock.fn(async () => undefined)
      );
      assert.ok(queued !== null);

      await south.disconnect();
      await assert.rejects(queued, /disconnected before workflow "workflowId1" could run/);
    });

    it('should warn once per hour and log trace in between when the previous cron is still running', () => {
      south['runTask'] = mock.fn(async () => undefined);
      const scanMode = testData.scanMode.list[0];

      // First tick enqueues the job and starts running it
      south.trigger(scanMode);
      // Subsequent ticks while it is still queued: first warns, the rest are traced
      south.trigger(scanMode);
      south.trigger(scanMode);
      south.trigger(scanMode);

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
      south.trigger(scanMode);
      assert.strictEqual(warnMock.mock.calls.filter(call => (call.arguments[0] as string).startsWith(message)).length, 2);
    });

    it('should properly add to queue a new task and not trigger next run if no item', () => {
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache trigger() reads from is rebuilt to reflect the empty item list.
      south.connectorConfiguration = { ...south.connectorConfiguration, items: [] };
      south.trigger(testData.scanMode.list[0]);
      assert.strictEqual(runTaskMock.mock.calls.length, 0);
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
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;

      south.stop();
      south.trigger(testData.scanMode.list[0]);
      assert.strictEqual(runTaskMock.mock.calls.length, 0);
      await flushPromises();
    });

    it('should not dispatch a new task while the concurrency limit is already reached', () => {
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      // Occupy the (default) single concurrency slot with an unresolved task
      south.trigger(testData.scanMode.list[0]);
      assert.strictEqual(runTaskMock.mock.calls.length, 1);

      // A different scan mode's items get queued but can't dispatch: the slot is still held
      south.trigger(testData.scanMode.list[1]);
      assert.strictEqual(runTaskMock.mock.calls.length, 1);
      assert.strictEqual(south['taskQueue'].length, 1);
    });

    it('should log an error and not crash when runTask() rejects', async () => {
      const runError = new Error('unexpected run failure');
      south['runTask'] = mock.fn(() => Promise.reject(runError));
      south.trigger(testData.scanMode.list[0]);
      await flushPromises();
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            (c.arguments[0] as string).includes('Unhandled error in South task runner') &&
            (c.arguments[0] as string).includes(runError.message)
        )
      );
      // The task is still cleaned up (removed from in-flight, item status reset) despite the rejection
      assert.strictEqual(south['runningTasks'].size, 0);
    });

    it('should not dispatch any task when the connector is disabled', () => {
      // The engine calls trigger unconditionally for every south connector on every scan-mode
      // tick (it no longer tracks per-connector interest) — a disabled connector must ignore it.
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      south.isEnabled = mock.fn((): boolean => false);

      south.trigger(testData.scanMode.list[0]);

      assert.strictEqual(runTaskMock.mock.calls.length, 0);
      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] ===
            `Connector is disabled. Cron "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron}) not added`
        )
      );
    });

    it('should refresh logger on refreshLogger()', async () => {
      (logger.info as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      south.refreshLogger();
      await south.stop();
      assert.strictEqual((logger.info as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
    });

    it('should reset cache', async () => {
      await south.resetCache();
      assert.strictEqual((southCacheRepository.deleteItemsBySouth as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
    });

    it('should build a history query snapshot from persisted cache entries', () => {
      const items = testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>;
      const groupedItem = {
        ...items[1],
        syncWithGroup: true,
        group: { id: 'groupId1', name: 'group 1' }
      } as unknown as SouthConnectorItemEntity<SouthFolderScannerItemSettings>;

      (southCacheRepository.getItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.mockImplementationOnce(() => ({
        itemId: items[0].id,
        groupId: null,
        trackedInstant: '2020-02-02T02:02:02.222Z',
        queryTime: '2020-02-02T03:02:02.222Z',
        value: { foo: 'bar' }
      }));
      (southCacheRepository.getGroupLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.mockImplementationOnce(() => null);

      const snapshot = south.getHistoryQuerySnapshot([items[0], groupedItem]);

      assert.deepStrictEqual(snapshot, {
        items: [
          {
            itemId: items[0].id,
            itemName: items[0].name,
            trackedInstant: '2020-02-02T02:02:02.222Z',
            queryTime: '2020-02-02T03:02:02.222Z',
            value: { foo: 'bar' }
          },
          {
            itemId: groupedItem.id,
            itemName: groupedItem.name,
            trackedInstant: null,
            queryTime: null,
            value: null
          }
        ]
      });

      const getItemCalls = (southCacheRepository.getItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(getItemCalls[getItemCalls.length - 1].arguments[1], items[0].id);
      const getGroupCalls = (southCacheRepository.getGroupLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(getGroupCalls[getGroupCalls.length - 1].arguments[1], 'groupId1');
    });

    it('should properly connect and disconnect without touching any cron state', async () => {
      await south.connect();
      await south.disconnect();
      await south.stop();
    });

    it('should query files', async () => {
      let directQueryCallCount = 0;
      const directQueryMock = mock.fn(async () => {
        directQueryCallCount++;
        if (directQueryCallCount === 2) throw new Error('file query error');
        return [];
      });
      south.directQuery = directQueryMock;

      const items = testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>;
      await south['runTask']({ scanModeId: testData.scanMode.list[0].id, items });
      assert.strictEqual(directQueryMock.mock.calls.length, 1);
      assert.deepStrictEqual(directQueryMock.mock.calls[0].arguments, [testData.south.list[0].items]);
      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Direct querying 2 items`
        )
      );

      await south['runTask']({ scanModeId: testData.scanMode.list[0].id, items });

      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[1] === `Error when querying items with direct access: file query error`
        )
      );
    });
  });

  describe('SouthConnector disabled', () => {
    let south: SouthMSSQLClass;

    beforeEach(async () => {
      addContentCallback.mock.resetCalls();
      // southCacheRepository is a single shared instance across every test in this file (unlike the
      // old per-test southCacheService mock), so its call history must be reset explicitly here.
      for (const fn of [
        southCacheRepository.getItemLastValue,
        southCacheRepository.getGroupLastValue,
        southCacheRepository.saveItemLastValue,
        southCacheRepository.saveGroupLastValue,
        southCacheRepository.deleteItemValue,
        southCacheRepository.deleteItemsBySouth
      ]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      cronExports.CronJob = mock.fn(function (_cron: unknown, _callback: () => void) {
        return cronMockInstance;
      });
      utilsExports.groupItemsByGroup = mock.fn((_type: unknown, items: Array<unknown>) => [items]);

      mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

      south = new SouthMSSQL(
        testData.south.list[1] as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
        addContentCallback,
        southCacheRepository,

        'cacheFolder'
      );
      await south.start();
    });

    afterEach(() => {
      mock.timers.reset();
      mock.restoreAll();
    });

    it('should key two unrelated singleton work-units by item id, not by a shared group id', () => {
      // SouthMSSQL is a SOUTH_SINGLE_ITEMS connector: groupItemsByGroup() always hands it singleton
      // arrays, even for two items that both declare the same group with syncWithGroup: true. The
      // unit key must distinguish them (by item id) rather than colliding on the group id, since
      // they are functionally independent work-units here.
      const group = {
        id: 'sharedGroupId',
        name: 'shared group',
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const itemA = { ...testData.south.list[1].items[0], group, syncWithGroup: true };
      const itemB = { ...testData.south.list[1].items[1], group, syncWithGroup: true };

      const keyA = south['getUnitKey']([itemA] as unknown as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>);
      const keyB = south['getUnitKey']([itemB] as unknown as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>);

      assert.notStrictEqual(keyA, keyB);
      assert.strictEqual(keyA, `item:${itemA.id}`);
      assert.strictEqual(keyB, `item:${itemB.id}`);
    });

    it('should key a real multi-item group by its group id', () => {
      const group = {
        id: 'sharedGroupId',
        name: 'shared group',
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const itemB = { ...testData.south.list[1].items[0], group, syncWithGroup: true };
      const itemC = { ...testData.south.list[1].items[1], group, syncWithGroup: true };

      const key = south['getUnitKey']([itemB, itemC] as unknown as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>);

      assert.strictEqual(key, `group:${group.id}`);
    });

    it('should be properly initialized', () => {
      assert.ok((logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length >= 0);
      assert.strictEqual(south.isEnabled(), false);
      assert.ok((logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length >= 0);
      south.historyQueryHandler = mock.fn(async (_items: unknown, _startTime: unknown, _endTime: unknown) => undefined);
    });

    it('should ignore history query when not history items', async () => {
      await south.historyQueryHandler([], '2020-02-02T02:02:02.222Z', '2020-02-02T02:02:02.222Z');
      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'No history items to read. Ignoring historyQuery'
        )
      );
    });

    it('should skip the history query when the effective window does not extend past the tracked instant', async () => {
      const historyQueryMock = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));
      south.historyQuery = historyQueryMock;

      // startTimeOffset/endTimeOffset are both 0 on this item, so passing startTime === endTime
      // makes the effective window collapse to a single instant, which is not "past" it.
      const items = [testData.south.list[1].items[0]] as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2020-02-02T02:02:02.222Z');

      assert.strictEqual(historyQueryMock.mock.calls.length, 0);
      assert.strictEqual(utilsExports.generateIntervals.mock.calls.length, 0);
      assert.ok(
        (logger.warn as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          String(c.arguments[0]).startsWith('Skipping history query: effective window')
        )
      );
    });

    it('should log a trace message for more than 2 sub-intervals', async () => {
      const interval1 = { start: '2020-02-02T02:02:02.222Z', end: '2020-04-02T02:02:02.222Z' };
      const interval2 = { start: '2020-04-02T02:02:02.222Z', end: '2020-06-02T02:02:02.222Z' };
      const interval3 = { start: '2020-06-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval1, interval2, interval3]);
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      const items = [testData.south.list[1].items[0]] as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          String(c.arguments[0]).startsWith('Interval split in 3 sub-intervals')
        )
      );
    });

    it('should call historyQuery once per item for single-item connectors', async () => {
      const interval = { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval]);

      const historyQueryMock = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));
      south.historyQuery = historyQueryMock;

      const itemStartListener = mock.fn();
      const intervalListener = mock.fn();
      south.metricsEvent.on('history-query-item-start', itemStartListener);
      south.metricsEvent.on('history-query-interval', intervalListener);

      const items = testData.south.list[1].items as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      // Each item must produce its own generateIntervals call
      assert.strictEqual(utilsExports.generateIntervals.mock.calls.length, 2);
      // historyQuery called once per item, each with a singleton array
      assert.strictEqual(historyQueryMock.mock.calls.length, 2);
      assert.deepStrictEqual(historyQueryMock.mock.calls[0].arguments[0], [items[0]]);
      assert.deepStrictEqual(historyQueryMock.mock.calls[1].arguments[0], [items[1]]);

      // history-query-item-start is emitted once per item, before it is queried
      assert.strictEqual(itemStartListener.mock.calls.length, 2);
      assert.deepStrictEqual(itemStartListener.mock.calls[0].arguments[0], {
        itemName: items[0].name,
        currentItemNumber: 1,
        numberOfItems: 2
      });
      assert.deepStrictEqual(itemStartListener.mock.calls[1].arguments[0], {
        itemName: items[1].name,
        currentItemNumber: 2,
        numberOfItems: 2
      });

      // history-query-interval carries the item context and interval position/count
      assert.strictEqual(intervalListener.mock.calls.length, 2);
      assert.deepStrictEqual(intervalListener.mock.calls[0].arguments[0], {
        currentIntervalStart: interval.start,
        currentIntervalEnd: interval.end,
        currentIntervalNumber: 1,
        numberOfIntervals: 1,
        itemName: items[0].name,
        currentItemNumber: 1,
        numberOfItems: 2
      });
      assert.deepStrictEqual(intervalListener.mock.calls[1].arguments[0], {
        currentIntervalStart: interval.start,
        currentIntervalEnd: interval.end,
        currentIntervalNumber: 1,
        numberOfIntervals: 1,
        itemName: items[1].name,
        currentItemNumber: 2,
        numberOfItems: 2
      });
    });

    it('should use independent cache entries per item for single-item connectors', async () => {
      const interval = { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval]);
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      const items = testData.south.list[1].items as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      // getItemLastValue must be called with each item's own id
      const getCalls = (southCacheRepository.getItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(getCalls.length, 2);
      assert.strictEqual(getCalls[0].arguments[1], items[0].id);
      assert.strictEqual(getCalls[1].arguments[1], items[1].id);

      // saveItemLastValue must be called with each item's own id
      const saveCalls = (southCacheRepository.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(saveCalls.length, 2);
      assert.strictEqual(saveCalls[0].arguments[1].itemId, items[0].id);
      assert.strictEqual(saveCalls[1].arguments[1].itemId, items[1].id);
    });

    it('should defer cache update to end of run with newest recovery strategy', async () => {
      const interval1 = { start: '2020-02-02T02:02:02.222Z', end: '2020-06-02T02:02:02.222Z' };
      const interval2 = { start: '2020-06-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      const endTime = '2021-02-02T02:02:02.222Z';
      utilsExports.generateIntervals = mock.fn(() => [interval1, interval2]);
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      const items = [{ ...testData.south.list[1].items[0], recoveryStrategy: 'newest' }] as Array<
        SouthConnectorItemEntity<SouthMSSQLItemSettings>
      >;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', endTime);

      const saveCalls = (southCacheRepository.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      // Must be called exactly once (at end, not per interval)
      assert.strictEqual(saveCalls.length, 1);
      assert.strictEqual(saveCalls[0].arguments[1].trackedInstant, endTime);
    });

    it('should not save trackedInstant when stopped mid newest run', async () => {
      const interval1 = { start: '2020-02-02T02:02:02.222Z', end: '2020-06-02T02:02:02.222Z' };
      const interval2 = { start: '2020-06-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval1, interval2]);
      south.historyQuery = mock.fn(async () => {
        // Simulate a stop being requested mid-run
        (south as unknown as { stopping: boolean }).stopping = true;
        return { trackedInstant: '2021-02-02T02:02:02.222Z', value: null };
      });

      const items = [{ ...testData.south.list[1].items[0], recoveryStrategy: 'newest' }] as Array<
        SouthConnectorItemEntity<SouthMSSQLItemSettings>
      >;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      const saveCalls = (southCacheRepository.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(saveCalls.length, 0);
      // Reset stopping flag for subsequent tests
      (south as unknown as { stopping: boolean }).stopping = false;
    });
  });

  describe('SouthConnector with history and subscription', () => {
    let south: SouthOPCUAClass;

    beforeEach(async () => {
      addContentCallback.mock.resetCalls();
      // southCacheRepository is a single shared instance across every test in this file (unlike the
      // old per-test southCacheService mock), so its call history must be reset explicitly here.
      for (const fn of [
        southCacheRepository.getItemLastValue,
        southCacheRepository.getGroupLastValue,
        southCacheRepository.saveItemLastValue,
        southCacheRepository.saveGroupLastValue,
        southCacheRepository.deleteItemValue,
        southCacheRepository.deleteItemsBySouth
      ]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
        (fn as Mock<(...args: Array<unknown>) => unknown>).mock.resetCalls();
      }
      cronExports.CronJob = mock.fn(function (_cron: unknown, _callback: () => void) {
        return cronMockInstance;
      });
      utilsExports.groupItemsByGroup = mock.fn((_type: unknown, items: Array<unknown>) => [items]);
      utilsExports.generateIntervals = mock.fn(() => []);

      mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

      south = new SouthOPCUA(
        testData.south.list[2] as SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
        addContentCallback,
        southCacheRepository,

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

    it('should properly run a task', async () => {
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

      const items = testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>;
      await south['runTask']({ scanModeId: testData.scanMode.list[0].id, items });

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
            c.arguments[1] === `Error when querying items with history capabilities: history query error`
        )
      );
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[1] === `Error when querying items with direct access: last point query error`
        )
      );

      await south['runTask']({ scanModeId: testData.scanMode.list[0].id, items });

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
    });

    it('should log the group id/name in the error context when running a task for multiple items in a group', async () => {
      const historyQueryHandlerMock = mock.fn(async () => {
        throw new Error('history query error');
      });
      south.historyQueryHandler = historyQueryHandlerMock;
      const directQueryMock = mock.fn(async (): Promise<null> => {
        throw new Error('last point query error');
      });
      south.directQuery = directQueryMock;

      const group = { id: 'groupId1', name: 'group 1', scanMode: testData.scanMode.list[0], maxReadInterval: 3600 };
      const baseItem = testData.south.list[2].items[0] as SouthConnectorItemEntity<SouthOPCUAItemSettings>;
      const items = [
        { ...baseItem, id: 'groupedItem1', group, syncWithGroup: true, settings: { ...baseItem.settings, mode: 'da' as const } },
        { ...baseItem, id: 'groupedItem2', group, syncWithGroup: true, settings: { ...baseItem.settings, mode: 'da' as const } }
      ];

      await south['runTask']({ scanModeId: testData.scanMode.list[0].id, items });

      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[1] === 'Error when querying items with history capabilities: history query error' &&
            (c.arguments[0] as { groupId?: string; groupName?: string }).groupId === 'groupId1' &&
            (c.arguments[0] as { groupId?: string; groupName?: string }).groupName === 'group 1'
        )
      );
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[1] === 'Error when querying items with direct access: last point query error' &&
            (c.arguments[0] as { groupId?: string; groupName?: string }).groupId === 'groupId1' &&
            (c.arguments[0] as { groupId?: string; groupName?: string }).groupName === 'group 1'
        )
      );
    });

    it('should run up to getMaxParallelRun() tasks concurrently and dispatch queued work as slots free up', async () => {
      south['getMaxParallelRun'] = () => 2;
      const resolvers: Array<() => void> = [];
      const runTaskMock = mock.fn(
        () =>
          new Promise<void>(resolve => {
            resolvers.push(resolve);
          })
      );
      south['runTask'] = runTaskMock;

      south.trigger(testData.scanMode.list[0]);
      south.trigger(testData.scanMode.list[1]);
      assert.strictEqual(runTaskMock.mock.calls.length, 2);
      assert.strictEqual(south['runningTasks'].size, 2);

      // A third scan mode's items queue up behind the two already in-flight tasks (both slots
      // taken). Routed through the connectorConfiguration setter (rather than mutating `.items`
      // directly) so the scan-mode-grouped cache trigger() reads from is rebuilt to include the
      // new item; restored the same way afterward since `testData.south.list[2]` is shared across
      // every test in this describe block.
      const originalConfig = south.connectorConfiguration;
      const thirdScanMode = { ...testData.scanMode.list[0], id: 'thirdScanModeId' };
      south.connectorConfiguration = {
        ...originalConfig,
        items: [...originalConfig.items, { ...testData.south.list[2].items[0], id: 'thirdItem', scanMode: thirdScanMode }] as Array<
          SouthConnectorItemEntity<SouthOPCUAItemSettings>
        >
      };
      south.trigger(thirdScanMode);
      assert.strictEqual(runTaskMock.mock.calls.length, 2);
      assert.strictEqual(south['taskQueue'].length, 1);

      // Resolving one in-flight task frees its slot and the queued task starts immediately
      resolvers[0]();
      await flushPromises();
      assert.strictEqual(runTaskMock.mock.calls.length, 3);
      assert.strictEqual(south['taskQueue'].length, 0);

      resolvers[1]();
      resolvers[2]();
      await flushPromises();
      south.connectorConfiguration = originalConfig;
    });

    it('should not dispatch queued tasks while stopping', () => {
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      south['stopping'] = true;

      south['taskQueue'].push({ scanModeId: 'scanModeId', items: [] });
      south['dispatch']();

      assert.strictEqual(runTaskMock.mock.calls.length, 0);
      south['stopping'] = false;
      south['taskQueue'] = [];
    });

    it('should clean up the queue and in-flight tasks when runTask() throws unexpectedly', async () => {
      const runError = new Error('unexpected metrics failure');
      mock.method(south.metricsEvent, 'emit', (event: string) => {
        if (event === 'run-start') throw runError;
      });

      south.trigger(testData.scanMode.list[0]);
      await flushPromises();

      assert.strictEqual(south['taskQueue'].length, 0);
      assert.strictEqual(south['runningTasks'].size, 0);
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

      south.trigger(testData.scanMode.list[0]);

      south.stop();
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            c.arguments[0] === `Stopping South "${testData.south.list[2].name}" (${testData.south.list[2].id})...`
        )
      );
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Waiting for 1 South task(s) to finish'
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
      assert.strictEqual((southCacheRepository.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);

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
        testData.south.list[2].items,
        null,
        null
      ]);
    });

    it('should forward the current history query interval bounds when adding values', async () => {
      const interval = { start: '2020-01-01T00:00:00.000Z', end: '2020-01-02T00:00:00.000Z' };
      south['currentHistoryQueryInterval'] = interval;

      const values = [{}] as Array<OIBusTimeValue>;
      await south.addContent({ type: 'time-values', content: values }, testData.constants.dates.DATE_1, testData.south.list[2].items);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
        testData.south.list[2].id,
        { type: 'time-values', content: values },
        testData.constants.dates.DATE_1,
        testData.south.list[2].items,
        interval.start,
        interval.end
      ]);

      south['currentHistoryQueryInterval'] = null;
    });

    it('should forward the current history query interval bounds when adding records', async () => {
      const interval = { start: '2020-01-01T00:00:00.000Z', end: '2020-01-02T00:00:00.000Z' };
      south['currentHistoryQueryInterval'] = interval;

      const records = [{ col: 1 }] as Array<OIBusRecord>;
      await south.addContent({ type: 'record-list', content: records }, testData.constants.dates.DATE_1, testData.south.list[2].items);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
        testData.south.list[2].id,
        { type: 'record-list', content: records },
        testData.constants.dates.DATE_1,
        testData.south.list[2].items,
        interval.start,
        interval.end
      ]);

      south['currentHistoryQueryInterval'] = null;
    });

    it('should add records', async () => {
      await south.addContent({ type: 'record-list', content: [] }, testData.constants.dates.DATE_1, []);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);

      const records = [{ col: 1 }, { col: 2 }] as Array<OIBusRecord>;
      await south.addContent({ type: 'record-list', content: records }, testData.constants.dates.DATE_1, testData.south.list[2].items);
      assert.ok(
        (logger.debug as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === `Add 2 records to cache from South "${testData.south.list[2].name}"`
        )
      );
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
        testData.south.list[2].id,
        { type: 'record-list', content: records },
        testData.constants.dates.DATE_1,
        testData.south.list[2].items,
        null,
        null
      ]);
    });

    it('should resolve without calling the engine callback for an unknown content type', async () => {
      await south.addContent(
        { type: 'unknown-type' } as unknown as OIBusContent,
        testData.constants.dates.DATE_1,
        testData.south.list[2].items
      );
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
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
        testData.south.list[2].items,
        null,
        null
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
        [],
        null,
        null
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
      utilsExports.generateIntervals = mock.fn(() => intervals);

      const historyQueryMock = mock.fn(
        () =>
          new Promise<{ trackedInstant: Instant | null; value: unknown | null }>(resolve => {
            setTimeout(() => {
              resolve({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null });
            }, 1000);
          })
      );
      south.historyQuery = historyQueryMock;
      south.disconnect = mock.fn(
        () =>
          new Promise<void>(resolve => {
            setTimeout(() => {
              resolve();
            }, 1000);
          })
      );

      const intervalListener = mock.fn();
      south.metricsEvent.on('history-query-interval', intervalListener);

      south.historyQueryHandler(
        testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
        '2020-02-02T02:02:02.222Z',
        '2023-02-02T02:02:02.222Z'
      );
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

      // This is a batched (non-single-items) connector, so no item context is attached
      assert.strictEqual(intervalListener.mock.calls.length, 1);
      assert.deepStrictEqual(intervalListener.mock.calls[0].arguments[0], {
        currentIntervalStart: intervals[0].start,
        currentIntervalEnd: intervals[0].end,
        currentIntervalNumber: 1,
        numberOfIntervals: intervals.length
      });
    });

    it('should tag content added during historyQuery with the queried interval bounds', async () => {
      const intervals = [{ start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' }];
      utilsExports.generateIntervals = mock.fn(() => intervals);

      south.historyQuery = mock.fn(
        async (
          items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
        ): Promise<{ trackedInstant: Instant | null; value: null }> => {
          await south.addContent({ type: 'any-content', content: 'x' }, '2020-02-02T02:02:02.222Z', items);
          return { trackedInstant: null, value: null };
        }
      );

      await south.historyQueryHandler(
        testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
        '2020-02-02T02:02:02.222Z',
        '2023-02-02T02:02:02.222Z'
      );

      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments.slice(-2), [
        '2020-02-02T02:02:02.222Z',
        '2021-02-02T02:02:02.222Z'
      ]);
    });

    it('should not tag content added outside of a historyQuery window (direct call) with any interval', async () => {
      await south.addContent({ type: 'any-content', content: 'x' }, '2020-02-02T02:02:02.222Z', []);

      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments.slice(-2), [null, null]);
    });

    it('should use group historian settings when syncWithGroup is true', async () => {
      const group = {
        id: 'group1',
        name: 'Group 1',
        scanMode: testData.scanMode.list[0],
        maxReadInterval: 1800,
        readDelay: 100,
        startTimeOffset: 50,
        endTimeOffset: null,
        recoveryStrategy: null,
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

      utilsExports.generateIntervals = mock.fn(() => []);

      await south.historyQueryHandler(itemsWithGroup, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z');

      assert.strictEqual(utilsExports.generateIntervals.mock.calls.length, 1);
      // startTime (2020-02-02T02:02:02.222Z) + group.startTimeOffset (50ms)
      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[0], '2020-02-02T02:02:02.272Z');
      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[1], '2023-02-02T02:02:02.222Z');
      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[2], 1800);
      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[3], 'oldest');
    });

    it("should size the initial lookback window from the item's own maxReadInterval, not the group's, when the item is not synced with its group", async () => {
      const historyQueryHandlerMock = mock.fn(async () => undefined);
      south.historyQueryHandler = historyQueryHandlerMock;
      south.directQuery = mock.fn(async (): Promise<null> => null);

      const group = {
        id: 'group1',
        name: 'Group 1',
        scanMode: testData.scanMode.list[0],
        maxReadInterval: 999999,
        readDelay: 0,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const items = [
        {
          ...(testData.south.list[2].items[0] as SouthConnectorItemEntity<SouthOPCUAItemSettings>),
          group,
          syncWithGroup: false,
          maxReadInterval: 3600
        }
      ];

      await south['runTask']({ scanModeId: testData.scanMode.list[0].id, items });

      assert.strictEqual(historyQueryHandlerMock.mock.calls.length, 1);
      const [, startTime, endTime] = historyQueryHandlerMock.mock.calls[0].arguments as [unknown, string, string];
      // Lookback must come from the item's own maxReadInterval (3600s), not the group's (999999s),
      // since the item isn't synced with it.
      assert.strictEqual(DateTime.fromISO(endTime).diff(DateTime.fromISO(startTime)).as('seconds'), 3600);
    });

    it('should look up and save the shared group cache row (not a per-item row) for a synced group on a batching connector', async () => {
      const group = {
        id: 'group1',
        name: 'Group 1',
        scanMode: testData.scanMode.list[0],
        maxReadInterval: 1800,
        readDelay: 0,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const itemA = {
        ...(testData.south.list[2].items[0] as SouthConnectorItemEntity<SouthOPCUAItemSettings>),
        group,
        syncWithGroup: true
      };
      const itemB = {
        ...(testData.south.list[2].items[1] as SouthConnectorItemEntity<SouthOPCUAItemSettings>),
        group,
        syncWithGroup: true
      };
      const interval = { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval]);
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      await south.historyQueryHandler([itemA, itemB], '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z');

      assert.strictEqual((southCacheRepository.getItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
      assert.deepStrictEqual(
        (southCacheRepository.getGroupLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls[0].arguments,
        [south.connectorConfiguration.id, group.id]
      );
      assert.strictEqual((southCacheRepository.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
      const saveCalls = (southCacheRepository.saveGroupLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(saveCalls.length, 1);
      assert.strictEqual(saveCalls[0].arguments[0], south.connectorConfiguration.id);
      assert.strictEqual(saveCalls[0].arguments[1], group.id);
      assert.strictEqual((saveCalls[0].arguments[2] as { trackedInstant: string }).trackedInstant, '2021-02-02T02:02:02.222Z');
    });

    it('should save a shared group cache row for a synced group on a batching connector via directQueryHandler', async () => {
      const group = {
        id: 'group2',
        name: 'Group 2',
        scanMode: testData.scanMode.list[0],
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const itemA = {
        ...(testData.south.list[2].items[0] as SouthConnectorItemEntity<SouthOPCUAItemSettings>),
        group,
        syncWithGroup: true
      };
      const itemB = {
        ...(testData.south.list[2].items[1] as SouthConnectorItemEntity<SouthOPCUAItemSettings>),
        group,
        syncWithGroup: true
      };
      south.directQuery = mock.fn(async () => ({ pointId: 'p', timestamp: '2024-01-01T00:00:00.000Z', data: { value: '1' } }));

      await south.directQueryHandler([itemA, itemB]);

      const saveGroupCalls = (southCacheRepository.saveGroupLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls;
      assert.strictEqual(saveGroupCalls.length, 1);
      assert.strictEqual(saveGroupCalls[0].arguments[0], south.connectorConfiguration.id);
      assert.strictEqual(saveGroupCalls[0].arguments[1], group.id);
      assert.strictEqual((southCacheRepository.saveItemLastValue as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
    });

    it('should update subscriptions', async () => {
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      south.connectorConfiguration = {
        ...south.connectorConfiguration,
        items: south.connectorConfiguration.items.map(item => ({
          ...item,
          scanMode: { ...item.scanMode!, id: 'subscription' }
        }))
      };
      south['subscribedItems'] = [south.connectorConfiguration.items[0]];
      south.unsubscribe = mock.fn(async (): Promise<void> => undefined);
      south.subscribe = mock.fn(async (): Promise<void> => undefined);
      await south.updateSubscriptions();
      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Subscribing to 3 new items'
        )
      );

      south.connectorConfiguration = { ...south.connectorConfiguration, items: [] };

      await south.updateSubscriptions();

      assert.ok(
        (logger.trace as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Unsubscribing from 4 items'
        )
      );
      assert.strictEqual((logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
    });

    it('should update subscriptions and log error', async () => {
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      south.connectorConfiguration = {
        ...south.connectorConfiguration,
        items: [
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
            startTimeOffset: null,
            endTimeOffset: null,
            recoveryStrategy: null,
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
            startTimeOffset: null,
            endTimeOffset: null,
            recoveryStrategy: null,
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
        ]
      };
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
      south.connectorConfiguration = { ...south.connectorConfiguration, items: [] };

      await south.updateSubscriptions();
      assert.ok(
        (logger.error as Mock<(...args: Array<unknown>) => unknown>).mock.calls.some(
          (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Error when unsubscribing from items: unsubscribe error'
        )
      );
    });

    it('should subscribe an item whose group scan mode is subscription', async () => {
      south['subscribedItems'] = [];
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      south.connectorConfiguration = {
        ...south.connectorConfiguration,
        items: [
          {
            id: 'southItemGroupSub',
            name: 'grouped item with subscription group',
            enabled: true,
            settings: { mode: 'da' } as SouthOPCUAItemSettings,
            // The item's own scan mode is NOT subscription: the group must be what decides.
            scanMode: testData.scanMode.list[0],
            group: {
              id: 'group1',
              name: 'Group 1',
              scanMode: testData.scanMode.list[2], // 'subscription'
              overlap: null,
              maxReadInterval: null,
              readDelay: null,
              createdBy: '',
              updatedBy: '',
              createdAt: '',
              updatedAt: ''
            },
            syncWithGroup: true,
            maxReadInterval: null,
            readDelay: null,
            overlap: null,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          }
        ]
      };
      south.subscribe = mock.fn(async (): Promise<void> => undefined);
      south.unsubscribe = mock.fn(async (): Promise<void> => undefined);

      await south.updateSubscriptions();

      assert.strictEqual((south.subscribe as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
      assert.deepStrictEqual(
        (south.subscribe as Mock<(...args: Array<unknown>) => unknown>).mock.calls[0].arguments[0].map((item: { id: string }) => item.id),
        ['southItemGroupSub']
      );
    });

    it('should not subscribe an item whose group scan mode is not subscription, even if its own scan mode is', async () => {
      south['subscribedItems'] = [];
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      south.connectorConfiguration = {
        ...south.connectorConfiguration,
        items: [
          {
            id: 'southItemGroupNotSub',
            name: 'grouped item with non-subscription group',
            enabled: true,
            settings: { mode: 'da' } as SouthOPCUAItemSettings,
            // The item's own scan mode IS subscription, but the group must win.
            scanMode: testData.scanMode.list[2],
            group: {
              id: 'group1',
              name: 'Group 1',
              scanMode: testData.scanMode.list[0], // not 'subscription'
              overlap: null,
              maxReadInterval: null,
              readDelay: null,
              createdBy: '',
              updatedBy: '',
              createdAt: '',
              updatedAt: ''
            },
            syncWithGroup: true,
            maxReadInterval: null,
            readDelay: null,
            overlap: null,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          }
        ]
      };
      south.subscribe = mock.fn(async (): Promise<void> => undefined);
      south.unsubscribe = mock.fn(async (): Promise<void> => undefined);

      await south.updateSubscriptions();

      assert.strictEqual((south.subscribe as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
    });

    it('should not subscribe a disabled item even if its group scan mode is subscription', async () => {
      south['subscribedItems'] = [];
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      south.connectorConfiguration = {
        ...south.connectorConfiguration,
        items: [
          {
            id: 'southItemGroupDisabled',
            name: 'disabled grouped item with subscription group',
            enabled: false,
            settings: { mode: 'da' } as SouthOPCUAItemSettings,
            scanMode: testData.scanMode.list[0],
            group: {
              id: 'group1',
              name: 'Group 1',
              scanMode: testData.scanMode.list[2], // 'subscription'
              overlap: null,
              maxReadInterval: null,
              readDelay: null,
              createdBy: '',
              updatedBy: '',
              createdAt: '',
              updatedAt: ''
            },
            syncWithGroup: true,
            maxReadInterval: null,
            readDelay: null,
            overlap: null,
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          }
        ]
      };
      south.subscribe = mock.fn(async (): Promise<void> => undefined);
      south.unsubscribe = mock.fn(async (): Promise<void> => undefined);

      await south.updateSubscriptions();

      assert.strictEqual((south.subscribe as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
    });

    it('should unsubscribe an item whose group scan mode moved away from subscription', async () => {
      const alreadySubscribedItem = {
        id: 'southItemGroupSub',
        name: 'grouped item no longer subscription',
        enabled: true,
        settings: { mode: 'da' } as SouthOPCUAItemSettings,
        scanMode: testData.scanMode.list[0],
        group: {
          id: 'group1',
          name: 'Group 1',
          scanMode: testData.scanMode.list[0], // group scan mode changed away from subscription
          overlap: null,
          maxReadInterval: null,
          readDelay: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        syncWithGroup: true,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      south['subscribedItems'] = [alreadySubscribedItem];
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      south.connectorConfiguration = { ...south.connectorConfiguration, items: [alreadySubscribedItem] };
      south.subscribe = mock.fn(async (): Promise<void> => undefined);
      south.unsubscribe = mock.fn(async (): Promise<void> => undefined);

      await south.updateSubscriptions();

      assert.strictEqual((south.unsubscribe as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 1);
      assert.strictEqual((south.subscribe as Mock<(...args: Array<unknown>) => unknown>).mock.calls.length, 0);
    });
  });
});
