import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { DateTime } from 'luxon';

import type { OIBusContent, OIBusRecord, OIBusTimeValue } from '../../shared/model/common/content.model';
import type { Instant } from '../../shared/model/common/types';
import type {
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthItemSettings,
  SouthMSSQLItemSettings,
  SouthMSSQLSettings,
  SouthOPCUAItemSettings,
  SouthOPCUASettings
} from '../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity, SouthItemGroupEntityLight } from '../model/south-connector.model';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import type * as Utils from '../service/utils';
import nodeOpcuaMock from '../tests/__mocks__/node-opcua.mock';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { createMock, flushPromises, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type SouthFolderScannerClass from './south-folder-scanner/south-folder-scanner';
import type SouthMSSQLClass from './south-mssql/south-mssql';
import type SouthOPCUAClass from './south-opcua/south-opcua';

const nodeRequire = createRequire(import.meta.url);

const buildGroup = (overrides: Partial<SouthItemGroupEntityLight> = {}): SouthItemGroupEntityLight => ({
  id: 'groupId1',
  name: 'group 1',
  scanMode: testData.scanMode.list[0],
  startTimeOffset: null,
  endTimeOffset: null,
  maxReadInterval: null,
  readDelay: null,
  recoveryStrategy: null,
  cachingStrategy: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

const buildOpcuaItem = (
  overrides: Partial<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
): SouthConnectorItemEntity<SouthOPCUAItemSettings> => ({
  id: 'southItemId5',
  name: 'opcua sub',
  enabled: true,
  settings: { mode: 'da' } as SouthOPCUAItemSettings,
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

describe('SouthConnector', () => {
  let SouthFolderScanner: typeof SouthFolderScannerClass;
  let SouthMSSQL: typeof SouthMSSQLClass;
  let SouthOPCUA: typeof SouthOPCUAClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: Instant, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let southCacheRepository: Mocked<SouthCacheRepository>;

  const realUtils: typeof Utils = nodeRequire('../service/utils');
  const createUtilsMocks = () => ({
    delay: mock.fn(async (_timeout: number) => undefined),
    generateIntervals: mock.fn(
      (_startTime: unknown, _endTime: unknown, _maxReadInterval?: unknown, _strategy?: unknown): Array<{ start: string; end: string }> => []
    ),
    // Every enabled item of a scan mode in one work unit, whatever the connector type
    groupItemsByGroup: mock.fn((_type: unknown, items: Array<unknown>) => [items])
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  const mssqlExports: Record<string, unknown> = {
    __esModule: true,
    ConnectionPool: mock.fn(function () {
      return { connect: mock.fn(async () => ({ request: mock.fn(), close: mock.fn() })) };
    })
  };
  mssqlExports.default = mssqlExports;

  before(() => {
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
    mockModule(nodeRequire, '../service/utils-opcua', {
      createSessionConfigs: mock.fn(() => []),
      getHistoryReadRequest: mock.fn(() => ({})),
      getTimestamp: mock.fn(() => ''),
      logMessages: mock.fn(),
      parseOPCUAValue: mock.fn(() => null)
    });
    mockModule(nodeRequire, '../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthFolderScanner = reloadModule<{ default: typeof SouthFolderScannerClass }>(
      nodeRequire,
      './south-folder-scanner/south-folder-scanner'
    ).default;
    SouthMSSQL = reloadModule<{ default: typeof SouthMSSQLClass }>(nodeRequire, './south-mssql/south-mssql').default;
    SouthOPCUA = reloadModule<{ default: typeof SouthOPCUAClass }>(nodeRequire, './south-opcua/south-opcua').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    southCacheRepository = createMock<SouthCacheRepository>();
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthConnector with file query', () => {
    let south: SouthFolderScannerClass;

    beforeEach(async () => {
      const config = JSON.parse(JSON.stringify(testData.south.list[0])) as SouthConnectorEntity<
        SouthFolderScannerSettings,
        SouthFolderScannerItemSettings
      >;
      south = new SouthFolderScanner(config, addContentCallback, southCacheRepository, 'cacheFolder');
      await south.start();
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
      assert.strictEqual(logger.warn.mock.calls.length, 1);
      assert.strictEqual(
        logger.warn.mock.calls[0].arguments[0],
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
        south.enqueueWorkflowRun('workflowId1', () => Promise.reject(runError))!,
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
      assert.ok(logger.warn.mock.calls.some(c => c.arguments[0].includes('Workflow "workflowId1" is already queued or running')));
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

    it('should still queue and run when the connector is disabled - unlike trigger(), gating on isEnabled() is left to the caller', async () => {
      south.isEnabled = mock.fn((): boolean => false);
      const run = mock.fn(async () => 'run result');
      const result = await south.enqueueWorkflowRun('workflowId1', run);
      assert.strictEqual(result, 'run result');
      assert.strictEqual(run.mock.calls.length, 1);
    });

    it('should return null and not queue when the connector is stopping', async () => {
      // disconnect() never resolves: the connector stays in its stopping state
      south.disconnect = mock.fn(() => new Promise<void>(() => undefined));
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

      const message = `Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron}). The previous cron was still running`;
      const backpressureWarns = logger.warn.mock.calls.filter(call => call.arguments[0].startsWith(message));
      const backpressureTraces = logger.trace.mock.calls.filter(call => call.arguments[0] === message);

      assert.strictEqual(backpressureWarns.length, 1);
      assert.strictEqual(backpressureWarns[0].arguments[0], `${message}. The next occurrences will be logged as trace for the next hour`);
      assert.strictEqual(backpressureTraces.length, 2);

      // After an hour, the warning is emitted again
      mock.timers.tick(60 * 60 * 1000);
      south.trigger(scanMode);
      assert.strictEqual(logger.warn.mock.calls.filter(call => call.arguments[0].startsWith(message)).length, 2);
    });

    it('should prune stale backpressure-warning entries when items/groups are reconfigured', () => {
      south['runTask'] = mock.fn(async () => undefined);
      const scanMode = testData.scanMode.list[0];

      // First tick enqueues the job; second tick while it's still running records a backpressure warning
      south.trigger(scanMode);
      south.trigger(scanMode);
      assert.strictEqual(south['lastBackpressureWarnByUnitId'].size, 1);

      // Reconfiguring with no items rebuilds itemGroupsByScanModeId as empty, so the recorded
      // work-unit no longer exists and its stale timestamp should be pruned rather than kept forever.
      south.connectorConfiguration = { ...south.connectorConfiguration, items: [] };
      assert.strictEqual(south['lastBackpressureWarnByUnitId'].size, 0);
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

    it('should skip an enabled item with no scan mode and no group instead of crashing', () => {
      const runTaskMock = mock.fn(async (_task: unknown) => undefined);
      south['runTask'] = runTaskMock;
      const badItem = { ...south.connectorConfiguration.items[0], id: 'badItem', name: 'Bad Item', scanMode: null, group: null };
      // Routed through the setter so rebuildItemGroupsByScanMode() runs against this item list.
      south.connectorConfiguration = { ...south.connectorConfiguration, items: [badItem, ...south.connectorConfiguration.items] };

      south.trigger(testData.scanMode.list[0]);

      assert.strictEqual(runTaskMock.mock.calls.length, 1);
      assert.deepStrictEqual(
        (runTaskMock.mock.calls[0].arguments[0] as { items: Array<{ id: string }> }).items.find(item => item.id === 'badItem'),
        undefined
      );
      assert.strictEqual(
        logger.error.mock.calls.some(
          call => call.arguments[0] === 'Item "Bad Item" (id: badItem) has no scan mode and no group: skipping it'
        ),
        true
      );
    });

    it('should not update subscriptions if not compatible', async () => {
      await south.updateSubscriptions();
      assert.strictEqual(logger.trace.mock.calls.length, 1);
      assert.strictEqual(logger.trace.mock.calls[0].arguments[0], 'This connector does not support subscriptions');
    });

    it('should not add to queue if connector is stopping', async () => {
      // disconnect() never resolves: the connector stays in its stopping state
      south.disconnect = mock.fn(() => new Promise<void>(() => undefined));
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
        logger.error.mock.calls.some(
          c => c.arguments[0].includes('Unhandled error in South task runner') && c.arguments[0].includes(runError.message)
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
        logger.trace.mock.calls.some(
          c =>
            c.arguments[0] ===
            `Connector is disabled. Cron "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron}) not added`
        )
      );
    });

    it('should refresh logger on refreshLogger()', async () => {
      logger.info.mock.resetCalls();
      south.refreshLogger();
      await south.stop();
      assert.strictEqual(logger.info.mock.calls.length, 1);
    });

    it('should reset cache', async () => {
      await south.resetCache();
      assert.strictEqual(southCacheRepository.deleteItemsBySouth.mock.calls.length, 1);
    });

    it('should build a history query snapshot from persisted cache entries', () => {
      const items = testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>;
      const groupedItem = { ...items[1], syncWithGroup: true, group: buildGroup() };

      southCacheRepository.getItemLastValue.mock.mockImplementationOnce(() => ({
        itemId: items[0].id,
        groupId: null,
        trackedInstant: '2020-02-02T02:02:02.222Z',
        queryTime: '2020-02-02T03:02:02.222Z',
        value: { foo: 'bar' }
      }));
      southCacheRepository.getGroupLastValue.mock.mockImplementationOnce(() => null);

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

      const getItemCalls = southCacheRepository.getItemLastValue.mock.calls;
      assert.strictEqual(getItemCalls[getItemCalls.length - 1].arguments[1], items[0].id);
      const getGroupCalls = southCacheRepository.getGroupLastValue.mock.calls;
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
      await south['runTask']({ kind: 'items', scanModeId: testData.scanMode.list[0].id, items });
      assert.strictEqual(directQueryMock.mock.calls.length, 1);
      assert.deepStrictEqual(directQueryMock.mock.calls[0].arguments, [testData.south.list[0].items]);
      assert.ok(logger.trace.mock.calls.some(c => c.arguments[0] === `Direct querying 2 items`));

      await south['runTask']({ kind: 'items', scanModeId: testData.scanMode.list[0].id, items });

      assert.ok(logger.error.mock.calls.some(c => c.arguments[1] === `Error when querying items with direct access: file query error`));
    });

    it('should still save the legacy per-item "last value" cache row via directQueryHandler for a non-IoT-family connector', async () => {
      // Unlike the six IoT-family types (see the companion test in south-connector.spec.ts's
      // "SouthConnector with history and subscription" describe block), folder-scanner never writes
      // its own caching-strategy state, so directQueryHandler's legacy write must still run for it.
      south.directQuery = mock.fn(async () => [{ filename: 'a.txt', modifiedTime: 1 }]);

      const items = testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>;
      await south.directQueryHandler(items);

      const saveCalls = southCacheRepository.saveItemLastValue.mock.calls;
      assert.strictEqual(saveCalls.length, 1);
      assert.strictEqual(saveCalls[0].arguments[0], south.connectorConfiguration.id);
      assert.strictEqual((saveCalls[0].arguments[1] as { itemId: string }).itemId, items[0].id);
    });
  });

  describe('SouthConnector disabled', () => {
    let south: SouthMSSQLClass;
    const mssqlItems = testData.south.list[1].items as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;

    beforeEach(async () => {
      south = new SouthMSSQL(
        testData.south.list[1] as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
        addContentCallback,
        southCacheRepository,
        'cacheFolder'
      );
      await south.start();
    });

    it('should key two unrelated singleton work-units by item id, not by a shared group id', () => {
      // SouthMSSQL is a SOUTH_SINGLE_ITEMS connector: groupItemsByGroup() always hands it singleton
      // arrays, even for two items that both declare the same group with syncWithGroup: true. The
      // unit key must distinguish them (by item id) rather than colliding on the group id, since
      // they are functionally independent work-units here.
      const group = buildGroup({ id: 'sharedGroupId', name: 'shared group' });
      const itemA = { ...mssqlItems[0], group, syncWithGroup: true };
      const itemB = { ...mssqlItems[1], group, syncWithGroup: true };

      const keyA = south['getUnitKey']([itemA]);
      const keyB = south['getUnitKey']([itemB]);

      assert.notStrictEqual(keyA, keyB);
      assert.strictEqual(keyA, `item:${itemA.id}`);
      assert.strictEqual(keyB, `item:${itemB.id}`);
    });

    it('should key a real multi-item group by its group id', () => {
      const group = buildGroup({ id: 'sharedGroupId', name: 'shared group' });
      const itemB = { ...mssqlItems[0], group, syncWithGroup: true };
      const itemC = { ...mssqlItems[1], group, syncWithGroup: true };

      const key = south['getUnitKey']([itemB, itemC]);

      assert.strictEqual(key, `group:${group.id}`);
    });

    it('should be properly initialized', () => {
      assert.ok(logger.trace.mock.calls.length >= 0);
      assert.strictEqual(south.isEnabled(), false);
      assert.ok(logger.trace.mock.calls.length >= 0);
    });

    it('should report hasExplore() as true now that SouthMSSQL implements explore()', () => {
      assert.strictEqual(south.hasExplore(), true);
    });

    it('should not throw when reassigned a connector entity without items', () => {
      assert.doesNotThrow(() => {
        south.connectorConfiguration = { ...testData.south.list[1], items: undefined } as unknown as SouthConnectorEntity<
          SouthMSSQLSettings,
          SouthMSSQLItemSettings
        >;
      });
    });

    it('should ignore history query when not history items', async () => {
      await south.historyQueryHandler([], '2020-02-02T02:02:02.222Z', '2020-02-02T02:02:02.222Z');
      assert.ok(logger.trace.mock.calls.some(c => c.arguments[0] === 'No history items to read. Ignoring historyQuery'));
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
      assert.ok(logger.warn.mock.calls.some(c => String(c.arguments[0]).startsWith('Skipping history query: effective window')));
    });

    it('falls back to a maxReadInterval/readDelay of 0 when the item does not configure them', async () => {
      utilsExports.generateIntervals = mock.fn(() => []);
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      const items = [{ ...testData.south.list[1].items[0], maxReadInterval: null, readDelay: null }] as Array<
        SouthConnectorItemEntity<SouthMSSQLItemSettings>
      >;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      assert.strictEqual(utilsExports.generateIntervals.mock.calls[0].arguments[2], 0);
    });

    it('should log a trace message for more than 2 sub-intervals', async () => {
      const interval1 = { start: '2020-02-02T02:02:02.222Z', end: '2020-04-02T02:02:02.222Z' };
      const interval2 = { start: '2020-04-02T02:02:02.222Z', end: '2020-06-02T02:02:02.222Z' };
      const interval3 = { start: '2020-06-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval1, interval2, interval3]);
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      const items = [testData.south.list[1].items[0]] as Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      assert.ok(logger.trace.mock.calls.some(c => String(c.arguments[0]).startsWith('Interval split in 3 sub-intervals')));
    });

    it('should call historyQuery once per item for single-item connectors', async () => {
      const interval = { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval]);

      const historyQueryMock = mock.fn(
        async (
          _items: Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>,
          _startTime?: Instant,
          _endTime?: Instant,
          _startTimeFromCache?: Instant
        ) => ({
          trackedInstant: '2021-02-02T02:02:02.222Z',
          value: null
        })
      );
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
      const getCalls = southCacheRepository.getItemLastValue.mock.calls;
      assert.strictEqual(getCalls.length, 2);
      assert.strictEqual(getCalls[0].arguments[1], items[0].id);
      assert.strictEqual(getCalls[1].arguments[1], items[1].id);

      // saveItemLastValue must be called with each item's own id
      const saveCalls = southCacheRepository.saveItemLastValue.mock.calls;
      assert.strictEqual(saveCalls.length, 2);
      assert.strictEqual((saveCalls[0].arguments[1] as { itemId: string }).itemId, items[0].id);
      assert.strictEqual((saveCalls[1].arguments[1] as { itemId: string }).itemId, items[1].id);
    });

    it('should not regress trackedInstant when a later interval finds an older max than an earlier one (oldest strategy)', async () => {
      const interval1 = { start: '2020-02-02T02:02:02.222Z', end: '2020-06-02T02:02:02.222Z' };
      const interval2 = { start: '2020-06-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval1, interval2]);

      // interval1 (queried first) finds a higher max than interval2 (queried second) — e.g. a source
      // that returns a static snapshot, or late-arriving/out-of-order data. The saved trackedInstant
      // must not regress from interval1's value down to interval2's lower one.
      let callCount = 0;
      south.historyQuery = mock.fn(async () => {
        callCount += 1;
        return callCount === 1
          ? { trackedInstant: '2020-08-01T00:00:00.000Z', value: null }
          : { trackedInstant: '2020-05-01T00:00:00.000Z', value: null };
      });

      const items = [{ ...testData.south.list[1].items[0], recoveryStrategy: 'oldest' }] as Array<
        SouthConnectorItemEntity<SouthMSSQLItemSettings>
      >;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      const saveCalls = southCacheRepository.saveItemLastValue.mock.calls;
      // Only interval1's save should happen: interval2's lower max must be rejected, not overwrite it
      assert.strictEqual(saveCalls.length, 1);
      assert.strictEqual((saveCalls[0].arguments[1] as { trackedInstant: string | null }).trackedInstant, '2020-08-01T00:00:00.000Z');
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

      const saveCalls = southCacheRepository.saveItemLastValue.mock.calls;
      // Must be called exactly once (at end, not per interval)
      assert.strictEqual(saveCalls.length, 1);
      assert.strictEqual((saveCalls[0].arguments[1] as { trackedInstant: string }).trackedInstant, endTime);
    });

    it('should not save trackedInstant when stopped mid newest run', async () => {
      const interval1 = { start: '2020-02-02T02:02:02.222Z', end: '2020-06-02T02:02:02.222Z' };
      const interval2 = { start: '2020-06-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval1, interval2]);
      south.historyQuery = mock.fn(async () => {
        // Simulate a stop being requested mid-run
        south['stopping'] = true;
        return { trackedInstant: '2021-02-02T02:02:02.222Z', value: null };
      });

      const items = [{ ...testData.south.list[1].items[0], recoveryStrategy: 'newest' }] as Array<
        SouthConnectorItemEntity<SouthMSSQLItemSettings>
      >;
      await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2021-02-02T02:02:02.222Z');

      const saveCalls = southCacheRepository.saveItemLastValue.mock.calls;
      assert.strictEqual(saveCalls.length, 0);
    });
  });

  describe('SouthConnector with history and subscription', () => {
    let south: SouthOPCUAClass;
    const opcuaItems = testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>;

    beforeEach(async () => {
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

      const items = opcuaItems;
      await south['runTask']({ kind: 'items', scanModeId: testData.scanMode.list[0].id, items });

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
        logger.error.mock.calls.some(c => c.arguments[1] === `Error when querying items with history capabilities: history query error`)
      );
      assert.ok(
        logger.error.mock.calls.some(c => c.arguments[1] === `Error when querying items with direct access: last point query error`)
      );

      await south['runTask']({ kind: 'items', scanModeId: testData.scanMode.list[0].id, items });

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

    it('should fall back to a 1-hour lookback window when the item has no maxReadInterval configured', async () => {
      const historyQueryHandlerMock = mock.fn(async () => undefined);
      south.historyQueryHandler = historyQueryHandlerMock;
      south.directQuery = mock.fn(async (): Promise<null> => null);

      const baseItem = opcuaItems[0];
      const items = [{ ...baseItem, group: null, syncWithGroup: false, maxReadInterval: null }];

      await south['runTask']({ kind: 'items', scanModeId: testData.scanMode.list[0].id, items });

      assert.deepStrictEqual(historyQueryHandlerMock.mock.calls[0].arguments, [
        items,
        DateTime.fromISO(testData.constants.dates.FAKE_NOW)
          .minus(3600 * 1000)
          .toUTC()
          .toISO()!,
        testData.constants.dates.FAKE_NOW
      ]);
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

      const group = buildGroup({ maxReadInterval: 3600 });
      const baseItem = opcuaItems[0];
      const items = [
        { ...baseItem, id: 'groupedItem1', group, syncWithGroup: true, settings: { ...baseItem.settings, mode: 'da' as const } },
        { ...baseItem, id: 'groupedItem2', group, syncWithGroup: true, settings: { ...baseItem.settings, mode: 'da' as const } }
      ];

      await south['runTask']({ kind: 'items', scanModeId: testData.scanMode.list[0].id, items });

      assert.ok(
        logger.error.mock.calls.some(
          c =>
            c.arguments[1] === 'Error when querying items with history capabilities: history query error' &&
            c.arguments[0].groupId === 'groupId1' &&
            c.arguments[0].groupName === 'group 1'
        )
      );
      assert.ok(
        logger.error.mock.calls.some(
          c =>
            c.arguments[1] === 'Error when querying items with direct access: last point query error' &&
            c.arguments[0].groupId === 'groupId1' &&
            c.arguments[0].groupName === 'group 1'
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
      // new item.
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
    });

    it('should not dispatch queued tasks while stopping', () => {
      const runTaskMock = mock.fn(async () => undefined);
      south['runTask'] = runTaskMock;
      south['stopping'] = true;

      south['taskQueue'].push({ kind: 'items', scanModeId: 'scanModeId', items: [] });
      south['dispatch']();

      assert.strictEqual(runTaskMock.mock.calls.length, 0);
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
        logger.error.mock.calls.some(
          c => c.arguments[0].includes('Unhandled error in South task runner') && c.arguments[0].includes(runError.message)
        )
      );
    });

    it('should properly stop', async () => {
      await south.stop();
      assert.ok(
        logger.debug.mock.calls.some(
          c => c.arguments[0] === `Stopping South "${testData.south.list[2].name}" (${testData.south.list[2].id})...`
        )
      );
      assert.ok(logger.info.mock.calls.some(c => c.arguments[0] === `South connector "${testData.south.list[2].name}" stopped`));
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
        logger.debug.mock.calls.some(
          c => c.arguments[0] === `Stopping South "${testData.south.list[2].name}" (${testData.south.list[2].id})...`
        )
      );
      assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'Waiting for 1 South task(s) to finish'));
      assert.strictEqual(disconnectMock.mock.calls.length, 0);
      mock.timers.tick(1000);
      await flushPromises();
      assert.strictEqual(disconnectMock.mock.calls.length, 1);
    });

    it('should add values', async () => {
      await south.addContent({ type: 'time-values', content: [] }, testData.constants.dates.DATE_1, []);
      assert.strictEqual(logger.debug.mock.calls.length, 1);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 0);

      const values = [{}, {}] as Array<OIBusTimeValue>;
      await south.addContent({ type: 'time-values', content: values }, testData.constants.dates.DATE_1, testData.south.list[2].items);
      assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === `Add 2 values to cache from South "${testData.south.list[2].name}"`));
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
    });

    it('should add records', async () => {
      await south.addContent({ type: 'record-list', content: [] }, testData.constants.dates.DATE_1, []);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);

      const records = [{ col: 1 }, { col: 2 }] as Array<OIBusRecord>;
      await south.addContent({ type: 'record-list', content: records }, testData.constants.dates.DATE_1, testData.south.list[2].items);
      assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === `Add 2 records to cache from South "${testData.south.list[2].name}"`));
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
        logger.debug.mock.calls.some(c => c.arguments[0] === `Add file "file.csv" to cache from South "${testData.south.list[2].name}"`)
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

    it('should forward the current history query interval bounds when adding a file', async () => {
      const interval = { start: '2020-01-01T00:00:00.000Z', end: '2020-01-02T00:00:00.000Z' };
      south['currentHistoryQueryInterval'] = interval;

      await south.addContent({ type: 'any', filePath: 'file.csv' }, testData.constants.dates.DATE_1, testData.south.list[2].items);

      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
        testData.south.list[2].id,
        { type: 'any', filePath: 'file.csv' },
        testData.constants.dates.DATE_1,
        testData.south.list[2].items,
        interval.start,
        interval.end
      ]);
    });

    it('should add any content', async () => {
      const addValuesListener = mock.fn();
      south.metricsEvent.on('add-values', addValuesListener);

      await south.addContent({ type: 'any-content', content: 'file.csv' }, testData.constants.dates.DATE_1, []);
      assert.ok(
        logger.debug.mock.calls.some(c => c.arguments[0] === `Add 8 bytes of content to cache from South "${testData.south.list[2].name}"`)
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

      south.historyQueryHandler(opcuaItems, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z');
      south.stop();

      mock.timers.tick(10000);

      await flushPromises();

      assert.ok(
        logger.debug.mock.calls.some(
          c =>
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

      await south.historyQueryHandler(opcuaItems, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z');

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
      const group = buildGroup({ id: 'group1', name: 'Group 1', maxReadInterval: 1800, readDelay: 100, startTimeOffset: 50 });
      const itemsWithGroup = [
        {
          ...opcuaItems[0],
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
      const historyQueryHandlerMock = mock.fn(async (_items: unknown, _startTime?: Instant, _endTime?: Instant) => undefined);
      south.historyQueryHandler = historyQueryHandlerMock;
      south.directQuery = mock.fn(async (): Promise<null> => null);

      const group = buildGroup({ id: 'group1', name: 'Group 1', maxReadInterval: 999999, readDelay: 0 });
      const items = [
        {
          ...opcuaItems[0],
          group,
          syncWithGroup: false,
          maxReadInterval: 3600
        }
      ];

      await south['runTask']({ kind: 'items', scanModeId: testData.scanMode.list[0].id, items });

      assert.strictEqual(historyQueryHandlerMock.mock.calls.length, 1);
      const [, startTime, endTime] = historyQueryHandlerMock.mock.calls[0].arguments as [unknown, string, string];
      // Lookback must come from the item's own maxReadInterval (3600s), not the group's (999999s),
      // since the item isn't synced with it.
      assert.strictEqual(DateTime.fromISO(endTime).diff(DateTime.fromISO(startTime)).as('seconds'), 3600);
    });

    it('should look up and save the shared group cache row (not a per-item row) for a synced group on a batching connector', async () => {
      const group = buildGroup({ id: 'group1', name: 'Group 1', maxReadInterval: 1800, readDelay: 0 });
      const itemA = {
        ...opcuaItems[0],
        group,
        syncWithGroup: true
      };
      const itemB = {
        ...opcuaItems[1],
        group,
        syncWithGroup: true
      };
      const interval = { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' };
      utilsExports.generateIntervals = mock.fn(() => [interval]);
      south.historyQuery = mock.fn(async () => ({ trackedInstant: '2021-02-02T02:02:02.222Z', value: null }));

      await south.historyQueryHandler([itemA, itemB], '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z');

      assert.strictEqual(southCacheRepository.getItemLastValue.mock.calls.length, 0);
      assert.deepStrictEqual(southCacheRepository.getGroupLastValue.mock.calls[0].arguments, [south.connectorConfiguration.id, group.id]);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 0);
      const saveCalls = southCacheRepository.saveGroupLastValue.mock.calls;
      assert.strictEqual(saveCalls.length, 1);
      assert.strictEqual(saveCalls[0].arguments[0], south.connectorConfiguration.id);
      assert.strictEqual(saveCalls[0].arguments[1], group.id);
      assert.strictEqual((saveCalls[0].arguments[2] as { trackedInstant: string }).trackedInstant, '2021-02-02T02:02:02.222Z');
    });

    it('should skip the legacy group/item cache write entirely for an IoT-family connector via directQueryHandler', async () => {
      // south.connector.type here is 'opcua' (IoT-family, see testData.south.list[2]) — these
      // connectors persist their own per-item caching-strategy state directly inside directQuery()
      // via southCacheRepository.saveItemsLastValues(), gated by each item's cachingStrategy. The
      // legacy write below (saveGroupLastValue/saveItemLastValue, used by non-IoT direct-query
      // connectors to show a raw "last value" in the UI) would just clobber that dedicated state
      // with an unrelated single value, so directQueryHandler must skip it for these types.
      const group = buildGroup({ id: 'group2', name: 'Group 2' });
      const itemA = {
        ...opcuaItems[0],
        group,
        syncWithGroup: true
      };
      const itemB = {
        ...opcuaItems[1],
        group,
        syncWithGroup: true
      };
      south.directQuery = mock.fn(async () => ({ pointId: 'p', timestamp: '2024-01-01T00:00:00.000Z', data: { value: '1' } }));

      await south.directQueryHandler([itemA, itemB]);

      assert.strictEqual(southCacheRepository.saveGroupLastValue.mock.calls.length, 0);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 0);
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
      assert.ok(logger.trace.mock.calls.some(c => c.arguments[0] === 'Subscribing to 3 new items'));

      south.connectorConfiguration = { ...south.connectorConfiguration, items: [] };

      await south.updateSubscriptions();

      assert.ok(logger.trace.mock.calls.some(c => c.arguments[0] === 'Unsubscribing from 4 items'));
      assert.strictEqual(logger.error.mock.calls.length, 0);
    });

    it('should update subscriptions and log error', async () => {
      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      const subscriptionItem = buildOpcuaItem({ scanMode: testData.scanMode.list[2] });
      south.connectorConfiguration = { ...south.connectorConfiguration, items: [subscriptionItem, subscriptionItem] };
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
      assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error when subscribing to new items: subscribe error'));
      await south.updateSubscriptions();
      south.connectorConfiguration = { ...south.connectorConfiguration, items: [] };

      await south.updateSubscriptions();
      assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error when unsubscribing from items: unsubscribe error'));
    });

    describe('with a group deciding the subscription', () => {
      let subscribe: Mock<SouthOPCUAClass['subscribe']>;
      let unsubscribe: Mock<SouthOPCUAClass['unsubscribe']>;

      // Routed through the setter (rather than mutating `.items` directly) so the scan-mode-grouped
      // cache updateSubscriptions() reads from is rebuilt to reflect the new item list.
      const setItems = (items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>) => {
        south.connectorConfiguration = { ...south.connectorConfiguration, items };
      };

      beforeEach(() => {
        south['subscribedItems'] = [];
        subscribe = mock.fn(async (): Promise<void> => undefined);
        unsubscribe = mock.fn(async (): Promise<void> => undefined);
        south.subscribe = subscribe;
        south.unsubscribe = unsubscribe;
      });

      it('should subscribe an item whose group scan mode is subscription', async () => {
        setItems([
          buildOpcuaItem({
            id: 'southItemGroupSub',
            name: 'grouped item with subscription group',
            // The item's own scan mode is NOT subscription: the group must be what decides.
            scanMode: testData.scanMode.list[0],
            group: buildGroup({ id: 'group1', name: 'Group 1', scanMode: testData.scanMode.list[2] }), // 'subscription'
            syncWithGroup: true
          })
        ]);

        await south.updateSubscriptions();

        assert.strictEqual(subscribe.mock.calls.length, 1);
        assert.deepStrictEqual(
          subscribe.mock.calls[0].arguments[0].map(item => item.id),
          ['southItemGroupSub']
        );
      });

      it('should not subscribe an item whose group scan mode is not subscription, even if its own scan mode is', async () => {
        setItems([
          buildOpcuaItem({
            id: 'southItemGroupNotSub',
            name: 'grouped item with non-subscription group',
            // The item's own scan mode IS subscription, but the group must win.
            scanMode: testData.scanMode.list[2],
            group: buildGroup({ id: 'group1', name: 'Group 1', scanMode: testData.scanMode.list[0] }), // not 'subscription'
            syncWithGroup: true
          })
        ]);

        await south.updateSubscriptions();

        assert.strictEqual(subscribe.mock.calls.length, 0);
      });

      it('should not subscribe a disabled item even if its group scan mode is subscription', async () => {
        setItems([
          buildOpcuaItem({
            id: 'southItemGroupDisabled',
            name: 'disabled grouped item with subscription group',
            enabled: false,
            scanMode: testData.scanMode.list[0],
            group: buildGroup({ id: 'group1', name: 'Group 1', scanMode: testData.scanMode.list[2] }), // 'subscription'
            syncWithGroup: true
          })
        ]);

        await south.updateSubscriptions();

        assert.strictEqual(subscribe.mock.calls.length, 0);
      });

      it('should unsubscribe an item whose group scan mode moved away from subscription', async () => {
        const alreadySubscribedItem = buildOpcuaItem({
          id: 'southItemGroupSub',
          name: 'grouped item no longer subscription',
          scanMode: testData.scanMode.list[0],
          // group scan mode changed away from subscription
          group: buildGroup({ id: 'group1', name: 'Group 1', scanMode: testData.scanMode.list[0] }),
          syncWithGroup: true
        });
        south['subscribedItems'] = [alreadySubscribedItem];
        setItems([alreadySubscribedItem]);

        await south.updateSubscriptions();

        assert.strictEqual(unsubscribe.mock.calls.length, 1);
        assert.strictEqual(subscribe.mock.calls.length, 0);
      });
    });
  });
});
