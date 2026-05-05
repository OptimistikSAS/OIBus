import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, flushPromises } from '../tests/utils/test-utils';

import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import NorthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/north-connector-metrics-service.mock';
import SouthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/south-connector-metrics-service.mock';
import HistoryQueryMetricsServiceMock from '../tests/__mocks__/service/metrics/history-query-metrics-service.mock';
import HistoryQueryMock from '../tests/__mocks__/history-query.mock';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/north-metrics-repository.mock';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/south-metrics-repository.mock';
import HistoryQueryMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/history-query-metrics-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';

import type DataStreamEngineType from './data-stream-engine';
import type { NorthConnectorEntityLight } from '../model/north-connector.model';
import type { SouthConnectorEntityLight } from '../model/south-connector.model';
import type { HistoryQueryEntityLight } from '../model/histor-query.model';
import type { NorthConnectorEntity } from '../model/north-connector.model';
import type { SouthConnectorEntity } from '../model/south-connector.model';
import type { HistoryQueryEntity } from '../model/histor-query.model';
import type { SouthSettings, SouthItemSettings } from '../../shared/model/south-settings.model';
import type { NorthSettings } from '../../shared/model/north-settings.model';
import type { CacheContentUpdateCommand, CacheSearchParam, CacheSearchResult, OIBusContent } from '../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

// --- Module-level mutable exports objects (mutated per test rather than replaced) ---
const northFactoryExports: Record<string, unknown> = {
  buildNorth: mock.fn(),
  createNorthOrchestrator: mock.fn(),
  deleteNorthCache: mock.fn(),
  initNorthCache: mock.fn()
};

const southFactoryExports: Record<string, unknown> = {
  buildSouth: mock.fn(),
  deleteSouthCache: mock.fn(),
  initSouthCache: mock.fn()
};

const historyFactoryExports: Record<string, unknown> = {
  buildHistoryQuery: mock.fn(),
  createHistoryQueryOrchestrator: mock.fn(),
  deleteHistoryQueryCache: mock.fn(),
  initHistoryQueryCache: mock.fn()
};

// --- Metrics service constructor closures (reassigned in beforeEach) ---
let northConnectorMetricsService: NorthConnectorMetricsServiceMock;
let southConnectorMetricsService: SouthConnectorMetricsServiceMock;
let historyQueryMetricsService: HistoryQueryMetricsServiceMock;

const northMetricsExports = {
  __esModule: true,
  default: function () {
    return northConnectorMetricsService;
  }
};
const southMetricsExports = {
  __esModule: true,
  default: function () {
    return southConnectorMetricsService;
  }
};
const historyMetricsExports = {
  __esModule: true,
  default: function () {
    return historyQueryMetricsService;
  }
};

// --- HistoryQuery constructor closure (reassigned in beforeEach) ---
let mockedHistoryQuery1: HistoryQueryMock;
let mockedHistoryQuery2: HistoryQueryMock;

const historyQueryClassExports = {
  __esModule: true,
  default: function (configuration: unknown) {
    const id = (configuration as { id: string }).id;
    if (id === testData.historyQueries.list[0].id) return mockedHistoryQuery1;
    if (id === testData.historyQueries.list[1].id) return mockedHistoryQuery2;
    return null;
  }
};

// --- Fixed repositories (created once) ---
const northConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository = new SouthConnectorRepositoryMock();
const historyQueryRepository = new HistoryQueryRepositoryMock();
const northConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const southConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const historyQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
// SouthCacheRepository uses SouthConnectorRepositoryMock as a structural stand-in
const southCacheRepository = new SouthConnectorRepositoryMock();
const certificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const oianalyticsMessageService = new OIAnalyticsMessageServiceMock();

let DataStreamEngine: new (...args: Array<unknown>) => DataStreamEngineType;
let engine: DataStreamEngineType;
const logger = new PinoLogger();

before(() => {
  // south-mqtt: no-op default export class
  mockModule(nodeRequire, '../south/south-mqtt/south-mqtt', { default: class {} });
  // service/utils: stub createFolder
  mockModule(nodeRequire, '../service/utils', { createFolder: mock.fn() });
  // node:fs/promises: stub rm
  mockModule(nodeRequire, 'node:fs/promises', { rm: mock.fn(), ...nodeRequire('node:fs/promises') });
  // http-request utils: stub clearProxyAgentCache
  mockModule(nodeRequire, '../service/http-request.utils', { clearProxyAgentCache: mock.fn() });

  // Metrics service constructors
  mockModule(nodeRequire, '../service/metrics/north-connector-metrics.service', northMetricsExports);
  mockModule(nodeRequire, '../service/metrics/south-connector-metrics.service', southMetricsExports);
  mockModule(nodeRequire, '../service/metrics/history-query-metrics.service', historyMetricsExports);

  // Factory modules
  mockModule(nodeRequire, '../north/north-connector-factory', northFactoryExports);
  mockModule(nodeRequire, '../south/south-connector-factory', southFactoryExports);
  mockModule(nodeRequire, './history-query-factory', historyFactoryExports);

  // HistoryQuery class
  mockModule(nodeRequire, './history-query', historyQueryClassExports);

  // Load the SUT
  const mod = reloadModule<{ default: new (...args: Array<unknown>) => DataStreamEngineType }>(nodeRequire, './data-stream-engine');
  DataStreamEngine = mod.default;
});

describe('DataStreamEngine', () => {
  let mockedNorth1: NorthConnectorMock;
  let mockedNorth2: NorthConnectorMock;
  let mockedSouth1: SouthConnectorMock;
  let mockedSouth2: SouthConnectorMock;

  const northList: Array<NorthConnectorEntityLight> = [
    { id: testData.north.list[0].id, type: testData.north.list[0].type, name: testData.north.list[0].name } as NorthConnectorEntityLight,
    { id: testData.north.list[1].id, type: testData.north.list[1].type, name: testData.north.list[1].name } as NorthConnectorEntityLight
  ];
  const southList: Array<SouthConnectorEntityLight> = [
    { id: testData.south.list[0].id, type: testData.south.list[0].type, name: testData.south.list[0].name } as SouthConnectorEntityLight,
    { id: testData.south.list[1].id, type: testData.south.list[1].type, name: testData.south.list[1].name } as SouthConnectorEntityLight
  ];
  const historyList: Array<HistoryQueryEntityLight> = [
    {
      id: testData.historyQueries.list[0].id,
      northType: testData.historyQueries.list[0].northType,
      southType: testData.historyQueries.list[0].southType,
      name: testData.historyQueries.list[0].name
    } as HistoryQueryEntityLight,
    {
      id: testData.historyQueries.list[1].id,
      northType: testData.historyQueries.list[1].northType,
      southType: testData.historyQueries.list[1].southType,
      name: testData.historyQueries.list[1].name
    } as HistoryQueryEntityLight
  ];

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    // Reset all mock call history on repositories
    northConnectorRepository.findNorthById.mock.resetCalls();
    southConnectorRepository.findSouthById.mock.resetCalls();
    historyQueryRepository.findHistoryById.mock.resetCalls();
    historyQueryRepository.updateHistoryStatus.mock.resetCalls();
    northConnectorRepository.removeTransformersByTransformerId.mock.resetCalls();
    historyQueryRepository.removeTransformersByTransformerId.mock.resetCalls();
    oianalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.resetCalls();

    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    logger.child = mock.fn(() => logger);

    // Fresh metrics service instances
    northConnectorMetricsService = new NorthConnectorMetricsServiceMock();
    southConnectorMetricsService = new SouthConnectorMetricsServiceMock();
    historyQueryMetricsService = new HistoryQueryMetricsServiceMock();

    // Fresh history query instances
    mockedHistoryQuery1 = new HistoryQueryMock(testData.historyQueries.list[0]);
    mockedHistoryQuery2 = new HistoryQueryMock(testData.historyQueries.list[1]);

    // Fresh connector instances
    mockedNorth1 = new NorthConnectorMock(testData.north.list[0]);
    mockedNorth2 = new NorthConnectorMock(testData.north.list[1]);
    mockedSouth1 = new SouthConnectorMock(testData.south.list[0]);
    mockedSouth2 = new SouthConnectorMock(testData.south.list[1]);

    // Repository mock implementations
    northConnectorRepository.findNorthById = mock.fn((id: string) => testData.north.list.find(el => el.id === id) ?? null);
    southConnectorRepository.findSouthById = mock.fn((id: string) => testData.south.list.find(el => el.id === id) ?? null);
    historyQueryRepository.findHistoryById = mock.fn((id: string) => testData.historyQueries.list.find(el => el.id === id) ?? null);

    // Factory mock implementations (mutate in-place so the SUT's reference stays valid)
    northFactoryExports.buildNorth = mock.fn((conf: { id: string }) => {
      if (conf.id === testData.north.list[0].id) return mockedNorth1;
      if (conf.id === testData.north.list[1].id) return mockedNorth2;
      return null;
    });
    northFactoryExports.createNorthOrchestrator = mock.fn(() => ({}));
    northFactoryExports.deleteNorthCache = mock.fn();
    northFactoryExports.initNorthCache = mock.fn();

    southFactoryExports.buildSouth = mock.fn((conf: { id: string }) => {
      if (conf.id === testData.south.list[0].id) return mockedSouth1;
      if (conf.id === testData.south.list[1].id) return mockedSouth2;
      return null;
    });
    southFactoryExports.deleteSouthCache = mock.fn();
    southFactoryExports.initSouthCache = mock.fn();

    historyFactoryExports.buildHistoryQuery = mock.fn((conf: { id: string }) => {
      if (conf.id === testData.historyQueries.list[0].id) return mockedHistoryQuery1;
      if (conf.id === testData.historyQueries.list[1].id) return mockedHistoryQuery2;
      return null;
    });
    historyFactoryExports.createHistoryQueryOrchestrator = mock.fn(() => ({}));
    historyFactoryExports.deleteHistoryQueryCache = mock.fn();
    historyFactoryExports.initHistoryQueryCache = mock.fn();

    // Create a fresh engine instance
    engine = new DataStreamEngine(
      northConnectorRepository, // structural mock — satisfies NorthConnectorRepository interface
      northConnectorMetricsRepository,
      southConnectorRepository, // structural mock — satisfies SouthConnectorRepository interface
      southConnectorMetricsRepository,
      historyQueryRepository,
      historyQueryMetricsRepository,
      southCacheRepository, // structural mock — satisfies SouthCacheRepository interface
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      oianalyticsMessageService,
      logger
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    // Remove south connector event listeners to prevent inter-test leakage
    mockedSouth1.connectedEvent.removeAllListeners();
    mockedSouth2.connectedEvent.removeAllListeners();
    mockedHistoryQuery1.finishEvent.removeAllListeners();
    mockedHistoryQuery2.finishEvent.removeAllListeners();
  });

  describe('Lifecycle (Start/Stop)', () => {
    it('should start and stop successfully', async () => {
      // Replace engine methods to inject errors the first time
      engine.createNorth = mock.fn(async () => {
        throw new Error('north creation error');
      });
      engine.createSouth = mock.fn(async () => {
        throw new Error('south creation error');
      });
      engine.createHistoryQuery = mock.fn(async () => {
        throw new Error('history creation error');
      });

      await engine.start([northList[0]], [southList[0]], [historyList[0]]);

      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[0] as string).includes(
            `Error while creating North connector "${northList[0].name}" of type "${northList[0].type}" (${northList[0].id}): north creation error`
          )
        )
      );
      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[0] as string).includes(
            `Error while creating South connector "${southList[0].name}" of type "${southList[0].type}" (${southList[0].id}): south creation error`
          )
        )
      );
      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[0] as string).includes(
            `Error while creating History query "${historyList[0].name}" of South type "${historyList[0].southType}" and North type "${historyList[0].northType}" (${historyList[0].id}): history creation error`
          )
        )
      );

      // Manually inject connectors so stop() has something to stop
      engine['northConnectors'].set(northList[0].id, { north: mockedNorth1, metrics: northConnectorMetricsService });
      engine['southConnectors'].set(southList[0].id, { south: mockedSouth1, metrics: southConnectorMetricsService });
      engine['historyQueries'].set(historyList[0].id, { historyQuery: mockedHistoryQuery1, metrics: historyQueryMetricsService });

      engine.stopSouth = mock.fn(async () => {
        throw new Error('south stop error');
      });
      engine.stopNorth = mock.fn(async () => {
        throw new Error('north stop error');
      });
      engine.stopHistoryQuery = mock.fn(async () => {
        throw new Error('history stop error');
      });

      await engine.stop();

      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[0] as string).includes(`Error while stopping North "${northList[0].id}": north stop error`)
        )
      );
      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[0] as string).includes(`Error while stopping South "${southList[0].id}": south stop error`)
        )
      );
      assert.ok(
        logger.error.mock.calls.some(c =>
          (c.arguments[0] as string).includes(`Error while stopping History query "${historyList[0].id}": history stop error`)
        )
      );
    });

    it('should properly manage entity creation errors', async () => {
      // Connectors 2 fail to start
      mockedNorth2.start = mock.fn(async () => {
        throw new Error('North error');
      });
      mockedSouth2.start = mock.fn(async () => {
        throw new Error('South error');
      });
      mockedHistoryQuery2.start = mock.fn(async () => {
        throw new Error('History error');
      });

      await engine.start(northList, southList, historyList);

      assert.ok(logger.info.mock.calls.some(c => (c.arguments[0] as string) === 'OIBus engine started'));
      assert.strictEqual(logger.error.mock.calls.length, 3); // 3 start failures

      assert.strictEqual((northFactoryExports.initNorthCache as ReturnType<typeof mock.fn>).mock.calls.length, 2);
      assert.strictEqual((southFactoryExports.initSouthCache as ReturnType<typeof mock.fn>).mock.calls.length, 2);
      assert.strictEqual((historyFactoryExports.initHistoryQueryCache as ReturnType<typeof mock.fn>).mock.calls.length, 2);

      await engine.stop();

      assert.strictEqual(mockedNorth1.stop.mock.calls.length, 1);
      assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
      assert.strictEqual(mockedHistoryQuery1.stop.mock.calls.length, 1);
    });
  });

  describe('Connectors Creation', () => {
    it('should create OPCUA connectors and history queries', async () => {
      const northConfig: NorthConnectorEntity<NorthSettings> = { ...testData.north.list[0], type: 'opcua' };
      const southConfig: SouthConnectorEntity<SouthSettings, SouthItemSettings> = { ...testData.south.list[0], type: 'opcua' };
      const historyConfig: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = { ...testData.historyQueries.list[0], southType: 'opcua', northType: 'opcua' };

      northConnectorRepository.findNorthById = mock.fn((_id: string): NorthConnectorEntity<NorthSettings> | null => northConfig);
      southConnectorRepository.findSouthById = mock.fn((_id: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null => southConfig);
      historyQueryRepository.findHistoryById = mock.fn((_id: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null => historyConfig);

      await engine.createNorth(northConfig.id);
      await engine.createSouth(southConfig.id);
      await engine.createHistoryQuery(historyConfig.id);

      const initNorthCacheFn = northFactoryExports.initNorthCache as ReturnType<typeof mock.fn>;
      const initSouthCacheFn = southFactoryExports.initSouthCache as ReturnType<typeof mock.fn>;
      const initHistoryQueryCacheFn = historyFactoryExports.initHistoryQueryCache as ReturnType<typeof mock.fn>;

      assert.strictEqual(initNorthCacheFn.mock.calls.length, 1);
      assert.strictEqual(initNorthCacheFn.mock.calls[0].arguments[0], northConfig.id);
      assert.strictEqual(initNorthCacheFn.mock.calls[0].arguments[1], 'opcua');

      assert.strictEqual(initSouthCacheFn.mock.calls.length, 1);
      assert.strictEqual(initSouthCacheFn.mock.calls[0].arguments[0], southConfig.id);
      assert.strictEqual(initSouthCacheFn.mock.calls[0].arguments[1], 'opcua');

      assert.strictEqual(initHistoryQueryCacheFn.mock.calls.length, 1);
      assert.strictEqual(initHistoryQueryCacheFn.mock.calls[0].arguments[0], historyConfig.id);
      assert.strictEqual(initHistoryQueryCacheFn.mock.calls[0].arguments[1], 'opcua');
      assert.strictEqual(initHistoryQueryCacheFn.mock.calls[0].arguments[2], 'opcua');
    });

    it('should clean up old metrics when recreating connectors', async () => {
      // Create first time
      await engine.createNorth(testData.north.list[0].id);
      await engine.createSouth(testData.south.list[0].id);
      await engine.createHistoryQuery(testData.historyQueries.list[0].id);

      assert.strictEqual(northConnectorMetricsService.destroy.mock.calls.length, 0);

      // Create second time (should destroy old metrics)
      await engine.createNorth(testData.north.list[0].id);
      await engine.createSouth(testData.south.list[0].id);
      await engine.createHistoryQuery(testData.historyQueries.list[0].id);

      assert.strictEqual(northConnectorMetricsService.destroy.mock.calls.length, 1);
      assert.strictEqual(southConnectorMetricsService.destroy.mock.calls.length, 1);
      assert.strictEqual(historyQueryMetricsService.destroy.mock.calls.length, 1);
    });
  });

  describe('North Connector Management', () => {
    beforeEach(async () => {
      await engine.start(northList, [], []);
    });

    it('should get all north metrics', () => {
      const metrics = engine.getAllNorthMetrics();
      assert.ok(testData.north.list[0].id in metrics);
      assert.ok(testData.north.list[1].id in metrics);
    });

    it('should get north SSE stream', () => {
      const sse = engine.getNorthSSE(testData.north.list[0].id);
      assert.ok(sse !== undefined && sse !== null);
    });

    it('should reload north connector', async () => {
      const northEntity = testData.north.list[0];
      const spyStop = mock.method(engine, 'stopNorth');
      const spyStart = mock.method(engine, 'startNorth');

      await engine.reloadNorth(northEntity);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.deepStrictEqual(spyStop.mock.calls[0].arguments, [northEntity.id]);
      assert.strictEqual(spyStart.mock.calls.length, 1);
      assert.deepStrictEqual(spyStart.mock.calls[0].arguments, [northEntity.id]);
      assert.strictEqual(mockedNorth1.setLogger.mock.calls.length, 1);
    });

    it('should delete north connector', async () => {
      const spyStop = mock.method(engine, 'stopNorth');
      await engine.deleteNorth(testData.north.list[0]);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual((northFactoryExports.deleteNorthCache as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.strictEqual(northConnectorMetricsService.destroy.mock.calls.length, 1);
      assert.throws(() => engine.getNorth(testData.north.list[0].id));
    });

    it('should reset north metrics', () => {
      engine.resetNorthMetrics(testData.north.list[0].id);
      assert.strictEqual(northConnectorMetricsService.resetMetrics.mock.calls.length, 1);
    });

    it('should add external content (API)', async () => {
      mockedNorth1.isEnabled = mock.fn(() => true);
      const mockContent: OIBusContent = { type: 'any', filePath: 'file' };
      await engine.addExternalContent(testData.north.list[0].id, 'dataSourceId', mockContent);

      assert.strictEqual(mockedNorth1.cacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.cacheContent.mock.calls[0].arguments, [
        mockContent,
        { source: 'oibus-api', dataSourceId: 'dataSourceId' }
      ]);
    });

    it('should not add external content (API) when disabled', async () => {
      mockedNorth1.isEnabled = mock.fn(() => false);
      const mockContent: OIBusContent = { type: 'any', filePath: 'file' };
      await engine.addExternalContent(testData.north.list[0].id, 'dataSourceId', mockContent);

      assert.strictEqual(mockedNorth1.cacheContent.mock.calls.length, 0);
    });

    it('should update north configuration', () => {
      engine.updateNorthConfiguration(testData.north.list[0].id);
      assert.ok(mockedNorth1.connectorConfiguration !== undefined && mockedNorth1.connectorConfiguration !== null);
    });

    it('should update north transformer by south id', () => {
      const northConfig = {
        ...testData.north.list[0],
        transformers: [{ source: { type: 'south', south: { id: 'south-1' } } }]
      } as NorthConnectorEntity<NorthSettings>;
      northConnectorRepository.findNorthById = mock.fn(() => northConfig);

      mockedNorth1.connectorConfiguration = northConfig;

      engine.updateNorthTransformerBySouth('south-1');

      assert.strictEqual(northConnectorRepository.findNorthById.mock.calls.length, 1);
      assert.deepStrictEqual(northConnectorRepository.findNorthById.mock.calls[0].arguments, [northConfig.id]);
    });
  });

  describe('South Connector Management', () => {
    beforeEach(async () => {
      await engine.start([], southList, []);
    });

    it('should get all south metrics', () => {
      const metrics = engine.getAllSouthMetrics();
      assert.ok(testData.south.list[0].id in metrics);
    });

    it('should get south SSE stream', () => {
      const sse = engine.getSouthSSE(testData.south.list[0].id);
      assert.ok(sse !== undefined && sse !== null);
    });

    it('should reload south connector and update cache/cron/subs', async () => {
      const southEntity = testData.south.list[0];

      mockedSouth1.hasHistoryQuery = mock.fn(() => true);
      mockedSouth1.hasDirectQuery = mock.fn(() => true);
      mockedSouth1.hasSubscription = mock.fn(() => true);
      mockedSouth1.isEnabled = mock.fn(() => true);

      const spyStop = mock.method(engine, 'stopSouth');
      const spyStart = mock.method(engine, 'startSouth');

      await engine.reloadSouth(southEntity);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(spyStart.mock.calls.length, 1);
      assert.strictEqual(mockedSouth1.setLogger.mock.calls.length, 1);
    });

    it('should reload south connector and not update cache history', async () => {
      const southEntity = testData.south.list[0];

      mockedSouth1.hasHistoryQuery = mock.fn(() => false);

      const spyStop = mock.method(engine, 'stopSouth');
      const spyStart = mock.method(engine, 'startSouth');

      await engine.reloadSouth(southEntity);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(spyStart.mock.calls.length, 1);
    });

    it('should manage south connect event', async () => {
      engine.getSouth = mock.fn((_southId: string) => ({ south: mockedSouth1, metrics: southConnectorMetricsService }));

      let hasHistoryQueryCall = 0;
      mockedSouth1.hasHistoryQuery = mock.fn(() => {
        hasHistoryQueryCall++;
        return hasHistoryQueryCall % 2 === 0; // false on 1st call, true on 2nd
      });

      let hasSubscriptionCall = 0;
      mockedSouth1.hasSubscription = mock.fn(() => {
        hasSubscriptionCall++;
        return hasSubscriptionCall % 2 === 0; // false on 1st call, true on 2nd
      });

      await engine.startSouth(testData.south.list[0].id);

      mockedSouth1.connectedEvent.emit('connected');
      assert.strictEqual(mockedSouth1.updateCronJobs.mock.calls.length, 0);
      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 0);

      mockedSouth1.connectedEvent.emit('connected');
      assert.strictEqual(mockedSouth1.updateCronJobs.mock.calls.length, 1);
      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 1);

      assert.strictEqual(mockedSouth1.hasHistoryQuery.mock.calls.length, 2);
      assert.strictEqual(mockedSouth1.hasSubscription.mock.calls.length, 2);
    });

    it('should reload south items', async () => {
      const southEntity = testData.south.list[0];

      mockedSouth1.hasHistoryQuery = mock.fn(() => true);
      mockedSouth1.hasDirectQuery = mock.fn(() => true);
      mockedSouth1.hasSubscription = mock.fn(() => true);
      mockedSouth1.isEnabled = mock.fn(() => true);

      await engine.reloadSouthItems(southEntity);

      assert.strictEqual(mockedSouth1.updateCronJobs.mock.calls.length, 1);
      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 1);
    });

    it('should reload south items and manage connector type', async () => {
      const southEntity = testData.south.list[0];

      mockedSouth1.hasHistoryQuery = mock.fn(() => false);
      mockedSouth1.hasDirectQuery = mock.fn(() => false);
      mockedSouth1.hasSubscription = mock.fn(() => false);
      mockedSouth1.isEnabled = mock.fn(() => true);

      await engine.reloadSouthItems(southEntity);

      assert.strictEqual(mockedSouth1.updateCronJobs.mock.calls.length, 0);
      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 0);
    });

    it('should reload south items when not enabled', async () => {
      const southEntity = testData.south.list[0];

      mockedSouth1.isEnabled = mock.fn(() => false);

      await engine.reloadSouthItems(southEntity);

      assert.strictEqual(mockedSouth1.updateCronJobs.mock.calls.length, 0);
      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 0);
    });

    it('should delete south connector', async () => {
      const spyStop = mock.method(engine, 'stopSouth');
      await engine.deleteSouth(testData.south.list[0]);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual((southFactoryExports.deleteSouthCache as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.strictEqual(southConnectorMetricsService.destroy.mock.calls.length, 1);
      assert.throws(() => engine.getSouth(testData.south.list[0].id));
    });

    it('should reset south metrics', () => {
      engine.resetSouthMetrics(testData.south.list[0].id);
      assert.strictEqual(southConnectorMetricsService.resetMetrics.mock.calls.length, 1);
    });

    it('should handle addContent callback from South', async () => {
      mockedNorth1.isEnabled = mock.fn(() => true);

      // Start norths so they can receive content
      await engine.start(northList, [], []);

      const mockData: OIBusContent = { type: 'time-values', content: [] };
      await engine.addContent('south-1', mockData, '2023-01-01', []);

      assert.strictEqual(mockedNorth1.cacheContent.mock.calls.length, 1);
    });
  });

  describe('History Query Management', () => {
    beforeEach(async () => {
      await engine.start([], [], historyList);
    });

    it('should handle history finish event', async () => {
      mockedHistoryQuery1.finishEvent.emit('finished');

      // Async inside the handler — drain the microtask queue
      await flushPromises();

      assert.strictEqual(historyQueryRepository.updateHistoryStatus.mock.calls.length, 1);
      assert.deepStrictEqual(historyQueryRepository.updateHistoryStatus.mock.calls[0].arguments, [
        testData.historyQueries.list[0].id,
        'FINISHED'
      ]);
      assert.strictEqual(oianalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    });

    it('should reload history query', async () => {
      const config = testData.historyQueries.list[0];
      const spyStop = mock.method(engine, 'stopHistoryQuery');
      const spyStart = mock.method(engine, 'startHistoryQuery');
      const spyReset = mock.method(engine, 'resetHistoryQueryCache');

      await engine.reloadHistoryQuery(config, true);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(spyReset.mock.calls.length, 1);
      assert.strictEqual(spyStart.mock.calls.length, 1);
      assert.strictEqual(mockedHistoryQuery1.setLogger.mock.calls.length, 1);
    });

    it('should reload history query without reset cache', async () => {
      const config = testData.historyQueries.list[0];
      const spyStop = mock.method(engine, 'stopHistoryQuery');
      const spyStart = mock.method(engine, 'startHistoryQuery');
      const spyReset = mock.method(engine, 'resetHistoryQueryCache');

      await engine.reloadHistoryQuery(config, false);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(spyReset.mock.calls.length, 0);
      assert.strictEqual(spyStart.mock.calls.length, 1);
    });

    it('should delete history query', async () => {
      const config = testData.historyQueries.list[0];
      const spyStop = mock.method(engine, 'stopHistoryQuery');

      await engine.deleteHistoryQuery(config);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual((historyFactoryExports.deleteHistoryQueryCache as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.strictEqual(historyQueryMetricsService.destroy.mock.calls.length, 1);
      assert.throws(() => engine.getHistoryQuery(config.id));
    });

    it('should get metrics and SSE', () => {
      const id = testData.historyQueries.list[0].id;
      const metrics = engine.getHistoryMetrics(id);
      assert.ok(metrics !== undefined && metrics !== null);
      const sse = engine.getHistoryQuerySSE(id);
      assert.ok(sse !== undefined && sse !== null);
    });
  });

  describe('Transformer Reload Management', () => {
    const transformerId = testData.north.list[0].transformers[0].transformer.id;

    beforeEach(() => {
      engine['northConnectors'].set(northList[0].id, { north: mockedNorth1, metrics: northConnectorMetricsService });
      engine['historyQueries'].set(historyList[0].id, { historyQuery: mockedHistoryQuery1, metrics: historyQueryMetricsService });
    });

    describe('reloadTransformer', () => {
      it('should reload north connector configuration when transformer is in use', async () => {
        mock.method(engine, 'reloadHistoryQuery', async () => undefined);
        northConnectorRepository.findNorthById = mock.fn((id: string) => testData.north.list.find(el => el.id === id) ?? null);

        await engine.reloadTransformer(transformerId);

        assert.ok(logger.debug.mock.calls.some(c => (c.arguments[0] as string).includes(testData.north.list[0].name)));
        assert.strictEqual(northConnectorRepository.findNorthById.mock.calls.length, 1);
        assert.deepStrictEqual(northConnectorRepository.findNorthById.mock.calls[0].arguments, [testData.north.list[0].id]);
      });

      it('should reload history query when transformer is in use', async () => {
        const spyReloadHistoryQuery = mock.method(engine, 'reloadHistoryQuery', async () => undefined);

        await engine.reloadTransformer(transformerId);

        assert.ok(logger.debug.mock.calls.some(c => (c.arguments[0] as string).includes(testData.historyQueries.list[0].name)));
        assert.strictEqual(spyReloadHistoryQuery.mock.calls.length, 1);
        assert.deepStrictEqual(spyReloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
      });

      it('should do nothing when transformer is not used', async () => {
        const spyReloadHistoryQuery = mock.method(engine, 'reloadHistoryQuery', async () => undefined);

        await engine.reloadTransformer('non-existent-transformer-id');

        assert.strictEqual(logger.warn.mock.calls.length, 0);
        assert.strictEqual(spyReloadHistoryQuery.mock.calls.length, 0);
      });
    });

    describe('removeAndReloadTransformer', () => {
      it('should log warning and reload affected north connectors and history queries', async () => {
        const spyReloadHistoryQuery = mock.method(engine, 'reloadHistoryQuery', async () => undefined);
        const spyUpdateNorthConfig = mock.method(engine, 'updateNorthConfiguration');

        await engine.removeAndReloadTransformer(transformerId);

        assert.ok(logger.debug.mock.calls.some(c => (c.arguments[0] as string).includes(transformerId)));
        assert.strictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [transformerId]);
        assert.strictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [transformerId]);
        assert.strictEqual(spyUpdateNorthConfig.mock.calls.length, 1);
        assert.deepStrictEqual(spyUpdateNorthConfig.mock.calls[0].arguments, [testData.north.list[0].id]);
        assert.strictEqual(spyReloadHistoryQuery.mock.calls.length, 1);
        assert.deepStrictEqual(spyReloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
      });

      it('should not warn or reload when transformer is not used', async () => {
        const spyReloadHistoryQuery = mock.method(engine, 'reloadHistoryQuery', async () => undefined);
        const spyUpdateNorthConfig = mock.method(engine, 'updateNorthConfiguration');

        await engine.removeAndReloadTransformer('non-existent-transformer-id');

        assert.strictEqual(logger.debug.mock.calls.length, 0);
        assert.strictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [
          'non-existent-transformer-id'
        ]);
        assert.strictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [
          'non-existent-transformer-id'
        ]);
        assert.strictEqual(spyUpdateNorthConfig.mock.calls.length, 0);
        assert.strictEqual(spyReloadHistoryQuery.mock.calls.length, 0);
      });
    });
  });

  describe('Engine Wide Operations', () => {
    beforeEach(async () => {
      await engine.start(northList, southList, historyList);
    });

    it('should set logger for all components', () => {
      const newLogger = new PinoLogger();
      newLogger.child = mock.fn(() => newLogger);

      engine.setLogger(newLogger);

      assert.strictEqual(mockedNorth1.setLogger.mock.calls.length, 1);
      assert.strictEqual(mockedSouth1.setLogger.mock.calls.length, 1);
      assert.strictEqual(mockedHistoryQuery1.setLogger.mock.calls.length, 1);
    });

    it('should update scan mode for all connectors', async () => {
      const scanMode = testData.scanMode.list[0];
      await engine.updateScanMode(scanMode);

      assert.strictEqual(mockedNorth1.updateScanMode.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.updateScanMode.mock.calls[0].arguments, [scanMode]);
      assert.strictEqual(mockedSouth1.updateScanModeIfUsed.mock.calls.length, 1);
      assert.deepStrictEqual(mockedSouth1.updateScanModeIfUsed.mock.calls[0].arguments, [scanMode]);
    });

    it('should search cache content (North)', async () => {
      const params = { start: 'now' } as CacheSearchParam;

      const result = await engine.searchCacheContent('north', testData.north.list[0].id, params);

      assert.strictEqual(mockedNorth1.searchCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.searchCacheContent.mock.calls[0].arguments, [params]);
      assert.ok(result.metrics !== undefined && result.metrics !== null);
    });

    it('should search cache content (History)', async () => {
      const params = { start: 'now' } as CacheSearchParam;

      mockedHistoryQuery1.searchCacheContent = mock.fn(async (_params: CacheSearchParam) => ({}) as Omit<CacheSearchResult, 'metrics'>);
      engine.getHistoryQuery = mock.fn((_historyId: string) => ({ historyQuery: mockedHistoryQuery1, metrics: historyQueryMetricsService }));
      const result = await engine.searchCacheContent('history', testData.historyQueries.list[0].id, params);

      assert.strictEqual(mockedHistoryQuery1.searchCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedHistoryQuery1.searchCacheContent.mock.calls[0].arguments, [params]);
      assert.deepStrictEqual(result.metrics, {});
    });

    it('should get file from cache (North)', async () => {
      engine.getNorth = mock.fn((_northId: string) => ({ north: mockedNorth1, metrics: northConnectorMetricsService }));
      await engine.getFileFromCache('north', testData.north.list[0].id, 'cache', 'file.json');
      assert.strictEqual(mockedNorth1.getFileFromCache.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.getFileFromCache.mock.calls[0].arguments, ['cache', 'file.json']);
    });

    it('should get file from cache (History)', async () => {
      engine.getHistoryQuery = mock.fn((_historyId: string) => ({ historyQuery: mockedHistoryQuery1, metrics: historyQueryMetricsService }));
      await engine.getFileFromCache('history', testData.historyQueries.list[0].id, 'cache', 'file.json');
      assert.strictEqual(mockedHistoryQuery1.getFileFromCache.mock.calls.length, 1);
      assert.deepStrictEqual(mockedHistoryQuery1.getFileFromCache.mock.calls[0].arguments, ['cache', 'file.json']);
    });

    it('should update cache content (North)', async () => {
      const cmd: CacheContentUpdateCommand = {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      };
      await engine.updateCacheContent('north', testData.north.list[0].id, cmd);
      assert.strictEqual(mockedNorth1.updateCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.updateCacheContent.mock.calls[0].arguments, [cmd]);
    });

    it('should update cache content (History)', async () => {
      const cmd: CacheContentUpdateCommand = {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      };
      await engine.updateCacheContent('history', testData.historyQueries.list[0].id, cmd);
      assert.strictEqual(mockedHistoryQuery1.updateCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedHistoryQuery1.updateCacheContent.mock.calls[0].arguments, [cmd]);
    });
  });
});
