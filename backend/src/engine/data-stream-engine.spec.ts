import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { DateTime } from 'luxon';

import type { OIBusContent } from '../../shared/model/common/content.model';
import type { NorthSettings } from '../../shared/model/connector/north-settings.model';
import type { SouthItemSettings, SouthSettings } from '../../shared/model/connector/south-settings.model';
import type { CacheContentUpdateCommand, CacheSearchParam, HistoryQueryMetrics } from '../../shared/model/domain/engine.model';

import type { ConfigurationWorkflowEntity } from '../model/configuration-workflow.model';
import type { HistoryQueryEntity, HistoryQueryEntityLight } from '../model/histor-query.model';
import type { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
import type { ScanMode } from '../model/scan-mode.model';
import type { SouthConnectorEntity, SouthConnectorEntityLight } from '../model/south-connector.model';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import type CertificateRepository from '../repository/config/certificate.repository';
import type ConfigurationWorkflowRepository from '../repository/config/configuration-workflow.repository';
import type HistoryQueryRepository from '../repository/config/history-query.repository';
import type NorthConnectorRepository from '../repository/config/north-connector.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type ScanModeRepository from '../repository/config/scan-mode.repository';
import type SouthConnectorRepository from '../repository/config/south-connector.repository';
import type HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import type NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import type SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import type HistoryQueryMetricsService from '../service/metrics/history-query-metrics.service';
import type NorthConnectorMetricsService from '../service/metrics/north-connector-metrics.service';
import type SouthConnectorMetricsService from '../service/metrics/south-connector-metrics.service';
import type OIAnalyticsMessageService from '../service/oia/oianalytics-message.service';
import HistoryQueryMock from '../tests/__mocks__/history-query.mock';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import testData from '../tests/utils/test-data';
import { createMock, flushPromises, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type DataStreamEngineType from './data-stream-engine';

const nodeRequire = createRequire(import.meta.url);

// Fresh per test: the module mocks below return them through closures
let logger: PinoLogger;
let cronJob: { stop: ReturnType<typeof mock.fn> };
let northConnectorMetricsService: Mocked<NorthConnectorMetricsService>;
let southConnectorMetricsService: Mocked<SouthConnectorMetricsService>;
let historyQueryMetricsService: Mocked<HistoryQueryMetricsService>;
let mockedNorth1: NorthConnectorMock;
let mockedNorth2: NorthConnectorMock;
let mockedSouth1: SouthConnectorMock;
let mockedSouth2: SouthConnectorMock;
let mockedHistoryQuery1: HistoryQueryMock;
let mockedHistoryQuery2: HistoryQueryMock;

/** The mock built for the entity of the given id, or null when the id is unknown */
const byId = <T>(id: string, entities: Array<{ id: string }>, mocks: Array<T>): T | null =>
  mocks[entities.findIndex(entity => entity.id === id)] ?? null;

// The SUT keeps references to these exports objects: their functions are replaced in place in beforeEach
const createModuleMocks = () => ({
  north: {
    buildNorth: mock.fn((conf: { id: string }) => byId(conf.id, testData.north.list, [mockedNorth1, mockedNorth2])),
    createNorthOrchestrator: mock.fn(() => ({})),
    deleteNorthCache: mock.fn(),
    initNorthCache: mock.fn()
  },
  south: {
    buildSouth: mock.fn((conf: { id: string }) => byId(conf.id, testData.south.list, [mockedSouth1, mockedSouth2])),
    deleteSouthCache: mock.fn(),
    initSouthCache: mock.fn()
  },
  history: {
    buildHistoryQuery: mock.fn((conf: { id: string }) =>
      byId(conf.id, testData.historyQueries.list, [mockedHistoryQuery1, mockedHistoryQuery2])
    ),
    createHistoryQueryOrchestrator: mock.fn(() => ({})),
    deleteHistoryQueryCache: mock.fn(),
    initHistoryQueryCache: mock.fn()
  },
  // Scan-mode crons never start a real timer
  cron: {
    CronJob: mock.fn(function (_cron: string, _onTick: () => void) {
      return cronJob;
    })
  }
});
const mocks = createModuleMocks();

let northConnectorRepository: Mocked<NorthConnectorRepository>;
let southConnectorRepository: Mocked<SouthConnectorRepository>;
let historyQueryRepository: Mocked<HistoryQueryRepository>;
let oianalyticsMessageService: Mocked<OIAnalyticsMessageService>;
let scanModeRepository: Mocked<ScanModeRepository>;
let configurationWorkflowRepository: Mocked<ConfigurationWorkflowRepository>;

let DataStreamEngine: typeof DataStreamEngineType;
let engine: DataStreamEngineType;

const northList: Array<NorthConnectorEntityLight> = testData.north.list;
const southList: Array<SouthConnectorEntityLight> = testData.south.list.slice(0, 2);
const historyList: Array<HistoryQueryEntityLight> = testData.historyQueries.listLight;

const loggedError = (text: string) => logger.error.mock.calls.some(c => String(c.arguments[0]).includes(text));
const givenScanModes = (...scanModes: Array<ScanMode>) => scanModeRepository.findAll.mock.mockImplementation(() => scanModes);
const fireCron = () => mocks.cron.CronJob.mock.calls[0].arguments[1]();

before(() => {
  mockModule(nodeRequire, 'cron', mocks.cron);
  mockModule(nodeRequire, '../service/http-request.utils', { clearProxyAgentCache: mock.fn() });
  mockModule(nodeRequire, '../service/metrics/north-connector-metrics.service', {
    __esModule: true,
    default: function () {
      return northConnectorMetricsService;
    }
  });
  mockModule(nodeRequire, '../service/metrics/south-connector-metrics.service', {
    __esModule: true,
    default: function () {
      return southConnectorMetricsService;
    }
  });
  mockModule(nodeRequire, '../service/metrics/history-query-metrics.service', {
    __esModule: true,
    default: function () {
      return historyQueryMetricsService;
    }
  });
  mockModule(nodeRequire, '../north/north-connector-factory', mocks.north);
  mockModule(nodeRequire, '../south/south-connector-factory', mocks.south);
  mockModule(nodeRequire, './history-query-factory', mocks.history);
  mockModule(nodeRequire, '../service/logger/logger.service', {
    loggerService: { createChildLogger: () => logger },
    default: class {}
  });

  DataStreamEngine = reloadModule<{ default: typeof DataStreamEngineType }>(nodeRequire, './data-stream-engine').default;
});

describe('DataStreamEngine', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

    logger = new PinoLogger();
    cronJob = { stop: mock.fn() };
    const fresh = createModuleMocks();
    Object.assign(mocks.north, fresh.north);
    Object.assign(mocks.south, fresh.south);
    Object.assign(mocks.history, fresh.history);
    Object.assign(mocks.cron, fresh.cron);

    northConnectorMetricsService = createMock<NorthConnectorMetricsService>();
    southConnectorMetricsService = createMock<SouthConnectorMetricsService>();
    historyQueryMetricsService = createMock<HistoryQueryMetricsService>({ metrics: { north: {} } as HistoryQueryMetrics });

    mockedNorth1 = new NorthConnectorMock(testData.north.list[0]);
    mockedNorth2 = new NorthConnectorMock(testData.north.list[1]);
    mockedSouth1 = new SouthConnectorMock(testData.south.list[0]);
    mockedSouth2 = new SouthConnectorMock(testData.south.list[1]);
    mockedHistoryQuery1 = new HistoryQueryMock(testData.historyQueries.list[0]);
    mockedHistoryQuery2 = new HistoryQueryMock(testData.historyQueries.list[1]);

    northConnectorRepository = createMock<NorthConnectorRepository>({
      findNorthById: id => testData.north.list.find(el => el.id === id) ?? null
    });
    southConnectorRepository = createMock<SouthConnectorRepository>({
      findSouthById: id => testData.south.list.find(el => el.id === id) ?? null
    });
    historyQueryRepository = createMock<HistoryQueryRepository>({
      findHistoryById: id => testData.historyQueries.list.find(el => el.id === id) ?? null
    });
    oianalyticsMessageService = createMock<OIAnalyticsMessageService>();
    scanModeRepository = createMock<ScanModeRepository>({ findAll: () => [] });
    configurationWorkflowRepository = createMock<ConfigurationWorkflowRepository>({ findBySouthId: () => [] });

    engine = new DataStreamEngine(
      northConnectorRepository,
      createMock<NorthConnectorMetricsRepository>(),
      southConnectorRepository,
      createMock<SouthConnectorMetricsRepository>(),
      historyQueryRepository,
      createMock<HistoryQueryMetricsRepository>(),
      createMock<SouthCacheRepository>(),
      createMock<CertificateRepository>(),
      createMock<OIAnalyticsRegistrationRepository>(),
      oianalyticsMessageService,
      scanModeRepository,
      configurationWorkflowRepository
    );
  });

  afterEach(() => {
    mock.timers.reset();
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
        loggedError(
          `Error while creating North connector "${northList[0].name}" of type "${northList[0].type}" (${northList[0].id}): north creation error`
        )
      );
      assert.ok(
        loggedError(
          `Error while creating South connector "${southList[0].name}" of type "${southList[0].type}" (${southList[0].id}): south creation error`
        )
      );
      assert.ok(
        loggedError(
          `Error while creating History query "${historyList[0].name}" of South type "${historyList[0].southType}" and North type "${historyList[0].northType}" (${historyList[0].id}): history creation error`
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

      assert.ok(loggedError(`Error while stopping North "${northList[0].id}": north stop error`));
      assert.ok(loggedError(`Error while stopping South "${southList[0].id}": south stop error`));
      assert.ok(loggedError(`Error while stopping History query "${historyList[0].id}": history stop error`));
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

      assert.ok(logger.info.mock.calls.some(c => c.arguments[0] === 'OIBus engine started'));
      assert.strictEqual(logger.error.mock.calls.length, 3); // 3 start failures

      assert.strictEqual(mocks.north.initNorthCache.mock.calls.length, 2);
      assert.strictEqual(mocks.south.initSouthCache.mock.calls.length, 2);
      assert.strictEqual(mocks.history.initHistoryQueryCache.mock.calls.length, 2);

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
      const historyConfig: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = {
        ...testData.historyQueries.list[0],
        southType: 'opcua',
        northType: 'opcua'
      };
      northConnectorRepository.findNorthById.mock.mockImplementation(() => northConfig);
      southConnectorRepository.findSouthById.mock.mockImplementation(() => southConfig);
      historyQueryRepository.findHistoryById.mock.mockImplementation(() => historyConfig);

      await engine.createNorth(northConfig.id);
      await engine.createSouth(southConfig.id);
      await engine.createHistoryQuery(historyConfig.id);

      assert.strictEqual(mocks.north.initNorthCache.mock.calls.length, 1);
      assert.strictEqual(mocks.north.initNorthCache.mock.calls[0].arguments[0], northConfig.id);
      assert.strictEqual(mocks.north.initNorthCache.mock.calls[0].arguments[1], 'opcua');

      assert.strictEqual(mocks.south.initSouthCache.mock.calls.length, 1);
      assert.strictEqual(mocks.south.initSouthCache.mock.calls[0].arguments[0], southConfig.id);
      assert.strictEqual(mocks.south.initSouthCache.mock.calls[0].arguments[1], 'opcua');

      assert.strictEqual(mocks.history.initHistoryQueryCache.mock.calls.length, 1);
      assert.strictEqual(mocks.history.initHistoryQueryCache.mock.calls[0].arguments[0], historyConfig.id);
      assert.strictEqual(mocks.history.initHistoryQueryCache.mock.calls[0].arguments[1], 'opcua');
      assert.strictEqual(mocks.history.initHistoryQueryCache.mock.calls[0].arguments[2], 'opcua');
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

    it('should reload north connector', async () => {
      const northEntity = testData.north.list[0];
      const spyStop = mock.method(engine, 'stopNorth');
      const spyStart = mock.method(engine, 'startNorth');

      await engine.reloadNorth(northEntity);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.deepStrictEqual(spyStop.mock.calls[0].arguments, [northEntity.id]);
      assert.strictEqual(spyStart.mock.calls.length, 1);
      assert.deepStrictEqual(spyStart.mock.calls[0].arguments, [northEntity.id]);
      assert.strictEqual(mockedNorth1.refreshLogger.mock.calls.length, 1);
    });

    it('should delete north connector', async () => {
      const spyStop = mock.method(engine, 'stopNorth');
      await engine.deleteNorth(testData.north.list[0]);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(mocks.north.deleteNorthCache.mock.calls.length, 1);
      assert.strictEqual(northConnectorMetricsService.destroy.mock.calls.length, 1);
      assert.throws(() => engine.getNorth(testData.north.list[0].id));
    });

    it('should reset north metrics', () => {
      engine.resetNorthMetrics(testData.north.list[0].id);
      assert.strictEqual(northConnectorMetricsService.resetMetrics.mock.calls.length, 1);
    });

    it('should add external content (API)', async () => {
      mockedNorth1.isEnabled.mock.mockImplementation(() => true);
      const mockContent: OIBusContent = { type: 'any', filePath: 'file' };
      await engine.addExternalContent(testData.north.list[0].id, 'dataSourceId', mockContent);

      assert.strictEqual(mockedNorth1.cacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.cacheContent.mock.calls[0].arguments, [
        mockContent,
        { source: 'oibus-api', dataSourceId: 'dataSourceId' }
      ]);
    });

    it('should not add external content (API) when disabled', async () => {
      mockedNorth1.isEnabled.mock.mockImplementation(() => false);
      const mockContent: OIBusContent = { type: 'any', filePath: 'file' };
      await engine.addExternalContent(testData.north.list[0].id, 'dataSourceId', mockContent);

      assert.strictEqual(mockedNorth1.cacheContent.mock.calls.length, 0);
    });

    it('should update north configuration', () => {
      const updatedConfiguration = { ...testData.north.list[0], name: 'updated north' };
      northConnectorRepository.findNorthById.mock.mockImplementation(() => updatedConfiguration);
      // start() in beforeEach already looked both norths up: only count the calls made from here
      const callsBefore = northConnectorRepository.findNorthById.mock.callCount();

      engine.updateNorthConfiguration(testData.north.list[0].id);

      const calls = northConnectorRepository.findNorthById.mock.calls.slice(callsBefore);
      assert.strictEqual(calls.length, 1);
      assert.deepStrictEqual(calls[0].arguments, [testData.north.list[0].id]);
      assert.strictEqual(mockedNorth1.connectorConfiguration, updatedConfiguration);
    });

    it('should update north transformer by south id', () => {
      const northConfig = {
        ...testData.north.list[0],
        transformers: [{ source: { type: 'south', south: { id: 'south-1' } } }]
      } as NorthConnectorEntity<NorthSettings>;
      northConnectorRepository.findNorthById.mock.mockImplementation(() => northConfig);
      mockedNorth1.connectorConfiguration = northConfig;
      // start() in beforeEach already looked both norths up: only count the calls made from here
      const callsBefore = northConnectorRepository.findNorthById.mock.callCount();

      engine.updateNorthTransformerBySouth('south-1');

      const calls = northConnectorRepository.findNorthById.mock.calls.slice(callsBefore);
      assert.strictEqual(calls.length, 1);
      assert.deepStrictEqual(calls[0].arguments, [northConfig.id]);
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

    it('should get south metrics', () => {
      Object.assign(southConnectorMetricsService, { metrics: testData.south.metrics });

      assert.strictEqual(engine.getSouthMetrics(testData.south.list[0].id), testData.south.metrics);
      assert.throws(() => engine.getSouthMetrics('not-registered'), new Error('Could not find South "not-registered" in engine'));
    });

    it('should report whether a south connector is present in the engine', () => {
      assert.strictEqual(engine.hasSouth(testData.south.list[0].id), true);
      assert.strictEqual(engine.hasSouth('not-registered'), false);
    });

    it('should reload south connector and update cache/cron/subs', async () => {
      Object.assign(mockedSouth1, {
        hasHistoryQuery: mock.fn(() => true),
        hasDirectQuery: mock.fn(() => true),
        hasSubscription: mock.fn(() => true)
      });
      mockedSouth1.isEnabled.mock.mockImplementation(() => true);
      const spyStop = mock.method(engine, 'stopSouth');
      const spyStart = mock.method(engine, 'startSouth');

      await engine.reloadSouth(testData.south.list[0]);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(spyStart.mock.calls.length, 1);
      assert.strictEqual(mockedSouth1.refreshLogger.mock.calls.length, 1);
    });

    it('should reload south connector and not update cache history', async () => {
      Object.assign(mockedSouth1, { hasHistoryQuery: mock.fn(() => false) });
      const spyStop = mock.method(engine, 'stopSouth');
      const spyStart = mock.method(engine, 'startSouth');

      await engine.reloadSouth(testData.south.list[0]);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(spyStart.mock.calls.length, 1);
    });

    it('should manage south connect event', async () => {
      let hasSubscriptionCall = 0;
      const hasSubscriptionMock = mock.fn(() => {
        hasSubscriptionCall++;
        return hasSubscriptionCall % 2 === 0; // false on 1st call, true on 2nd
      });
      Object.assign(mockedSouth1, { hasSubscription: hasSubscriptionMock });

      await engine.startSouth(testData.south.list[0].id);

      mockedSouth1.connectedEvent.emit('connected');
      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 0);

      mockedSouth1.connectedEvent.emit('connected');
      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 1);

      assert.strictEqual(hasSubscriptionMock.mock.calls.length, 2);
    });

    it('should reload south items', async () => {
      Object.assign(mockedSouth1, { hasSubscription: mock.fn(() => true) });
      mockedSouth1.isEnabled.mock.mockImplementation(() => true);

      await engine.reloadSouthItems(testData.south.list[0]);

      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 1);
    });

    it('should reload south items and manage connector type', async () => {
      Object.assign(mockedSouth1, { hasSubscription: mock.fn(() => false) });
      mockedSouth1.isEnabled.mock.mockImplementation(() => true);

      await engine.reloadSouthItems(testData.south.list[0]);

      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 0);
    });

    it('should reload south items when not enabled', async () => {
      mockedSouth1.isEnabled.mock.mockImplementation(() => false);

      await engine.reloadSouthItems(testData.south.list[0]);

      assert.strictEqual(mockedSouth1.updateSubscriptions.mock.calls.length, 0);
    });

    it('should delete south connector', async () => {
      const spyStop = mock.method(engine, 'stopSouth');
      await engine.deleteSouth(testData.south.list[0]);

      assert.strictEqual(spyStop.mock.calls.length, 1);
      assert.strictEqual(mocks.south.deleteSouthCache.mock.calls.length, 1);
      assert.strictEqual(southConnectorMetricsService.destroy.mock.calls.length, 1);
      assert.throws(() => engine.getSouth(testData.south.list[0].id));
    });

    it('should reset south metrics', () => {
      engine.resetSouthMetrics(testData.south.list[0].id);
      assert.strictEqual(southConnectorMetricsService.resetMetrics.mock.calls.length, 1);
    });

    it('should handle addContent callback from South', async () => {
      mockedNorth1.isEnabled.mock.mockImplementation(() => true);

      // Start norths so they can receive content
      await engine.start(northList, [], []);

      const mockData: OIBusContent = { type: 'record-list', content: [] };
      await engine.addContent('south-1', mockData, '2023-01-01', []);

      assert.strictEqual(mockedNorth1.cacheContent.mock.calls.length, 1);
    });

    it('should fan out addContent in parallel and let a failing North not block the others', async () => {
      await engine.start(northList, [], []);
      mockedNorth1.isEnabled.mock.mockImplementation(() => true);
      mockedNorth2.isEnabled.mock.mockImplementation(() => true);

      // North1 fails; North2 must still be called and addContent must not reject
      mockedNorth1.cacheContent.mock.mockImplementationOnce(() => Promise.reject(new Error('North1 boom')));
      mockedNorth2.cacheContent.mock.mockImplementationOnce(async () => undefined);

      const mockData: OIBusContent = { type: 'record-list', content: [] };
      await engine.addContent('south-1', mockData, '2023-01-01', []);

      assert.ok(mockedNorth1.cacheContent.mock.calls.length > 0);
      assert.ok(mockedNorth2.cacheContent.mock.calls.length > 0);
      assert.ok(loggedError('North1 boom'));
    });

    it('should run North caches concurrently (not sequentially)', async () => {
      await engine.start(northList, [], []);
      mockedNorth1.isEnabled.mock.mockImplementation(() => true);
      mockedNorth2.isEnabled.mock.mockImplementation(() => true);

      // Resolve North1 only AFTER North2 has been invoked. If the loop were
      // sequential (await per iteration), this would deadlock — Promise.all
      // resolves it.
      let releaseNorth1: () => void = () => undefined;
      const north1Gate = new Promise<void>(resolve => {
        releaseNorth1 = resolve;
      });
      mockedNorth1.cacheContent.mock.mockImplementationOnce(() => north1Gate);
      mockedNorth2.cacheContent.mock.mockImplementationOnce(async () => {
        releaseNorth1(); // North2 unblocks North1
      });

      const mockData: OIBusContent = { type: 'record-list', content: [] };
      await engine.addContent('south-1', mockData, '2023-01-01', []);

      assert.ok(mockedNorth1.cacheContent.mock.calls.length > 0);
      assert.ok(mockedNorth2.cacheContent.mock.calls.length > 0);
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
      assert.strictEqual(mockedHistoryQuery1.refreshLogger.mock.calls.length, 1);
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
      assert.strictEqual(mocks.history.deleteHistoryQueryCache.mock.calls.length, 1);
      assert.strictEqual(historyQueryMetricsService.destroy.mock.calls.length, 1);
      assert.throws(() => engine.getHistoryQuery(config.id));
    });

    it('should get metrics', () => {
      Object.assign(historyQueryMetricsService, { metrics: testData.historyQueries.metrics });

      assert.strictEqual(engine.getHistoryMetrics(testData.historyQueries.list[0].id), testData.historyQueries.metrics);
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

        await engine.reloadTransformer(transformerId);

        assert.ok(logger.debug.mock.calls.some(c => String(c.arguments[0]).includes(testData.north.list[0].name)));
        assert.strictEqual(northConnectorRepository.findNorthById.mock.calls.length, 1);
        assert.deepStrictEqual(northConnectorRepository.findNorthById.mock.calls[0].arguments, [testData.north.list[0].id]);
      });

      it('should reload history query when transformer is in use', async () => {
        const spyReloadHistoryQuery = mock.method(engine, 'reloadHistoryQuery', async () => undefined);

        await engine.reloadTransformer(transformerId);

        assert.ok(logger.debug.mock.calls.some(c => String(c.arguments[0]).includes(testData.historyQueries.list[0].name)));
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

        await engine.removeAndReloadTransformer(transformerId, 'user1');

        assert.ok(logger.debug.mock.calls.some(c => String(c.arguments[0]).includes(transformerId)));
        assert.strictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [
          transformerId,
          'user1'
        ]);
        assert.strictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [transformerId, 'user1']);
        assert.strictEqual(spyUpdateNorthConfig.mock.calls.length, 1);
        assert.deepStrictEqual(spyUpdateNorthConfig.mock.calls[0].arguments, [testData.north.list[0].id]);
        assert.strictEqual(spyReloadHistoryQuery.mock.calls.length, 1);
        assert.deepStrictEqual(spyReloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
      });

      it('should not warn or reload when transformer is not used', async () => {
        const spyReloadHistoryQuery = mock.method(engine, 'reloadHistoryQuery', async () => undefined);
        const spyUpdateNorthConfig = mock.method(engine, 'updateNorthConfiguration');

        await engine.removeAndReloadTransformer('non-existent-transformer-id', 'user1');

        assert.strictEqual(logger.debug.mock.calls.length, 0);
        assert.strictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(northConnectorRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [
          'non-existent-transformer-id',
          'user1'
        ]);
        assert.strictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls.length, 1);
        assert.deepStrictEqual(historyQueryRepository.removeTransformersByTransformerId.mock.calls[0].arguments, [
          'non-existent-transformer-id',
          'user1'
        ]);
        assert.strictEqual(spyUpdateNorthConfig.mock.calls.length, 0);
        assert.strictEqual(spyReloadHistoryQuery.mock.calls.length, 0);
      });
    });
  });

  describe('Engine Wide Operations', () => {
    const cmd: CacheContentUpdateCommand = {
      cache: { remove: [], move: [] },
      error: { remove: [], move: [] },
      archive: { remove: [], move: [] }
    };

    beforeEach(async () => {
      await engine.start(northList, southList, historyList);
    });

    it('should replace only the affected scan-mode cron on update', async () => {
      const scanMode = testData.scanMode.list[0];
      // No scan modes existed at startup (scanModeRepository.findAll() defaults to []), so this is
      // a fresh cron, not a replace of a pre-existing one.
      await engine.updateScanMode(scanMode);

      assert.strictEqual(mocks.cron.CronJob.mock.calls.length, 1);
      assert.strictEqual(mocks.cron.CronJob.mock.calls[0].arguments[0], scanMode.cron);
      assert.strictEqual(engine['cronByScanModeId'].size, 1);
      assert.ok(engine['cronByScanModeId'].has(scanMode.id));

      // Updating again replaces the same entry — the old job is stopped, exactly one job remains
      await engine.updateScanMode(scanMode);
      assert.strictEqual(cronJob.stop.mock.calls.length, 1);
      assert.strictEqual(engine['cronByScanModeId'].size, 1);
    });

    it('should search cache content (North)', async () => {
      const params = { start: 'now' } as CacheSearchParam;
      const searchResult = { searchDate: testData.constants.dates.FAKE_NOW, cache: [], error: [], archive: [] };
      mockedNorth1.searchCacheContent.mock.mockImplementation(async () => searchResult);
      Object.assign(northConnectorMetricsService, { metrics: testData.north.metrics });

      const result = await engine.searchCacheContent('north', testData.north.list[0].id, params);

      assert.strictEqual(mockedNorth1.searchCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.searchCacheContent.mock.calls[0].arguments, [params]);
      assert.deepStrictEqual(result, { metrics: testData.north.metrics, ...searchResult });
    });

    it('should search cache content (History)', async () => {
      const params = { start: 'now' } as CacheSearchParam;

      const result = await engine.searchCacheContent('history', testData.historyQueries.list[0].id, params);

      assert.strictEqual(mockedHistoryQuery1.searchCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedHistoryQuery1.searchCacheContent.mock.calls[0].arguments, [params]);
      assert.deepStrictEqual(result.metrics, {});
    });

    it('should get file from cache (North)', async () => {
      await engine.getFileFromCache('north', testData.north.list[0].id, 'cache', 'file.json');
      assert.strictEqual(mockedNorth1.getFileFromCache.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.getFileFromCache.mock.calls[0].arguments, ['cache', 'file.json']);
    });

    it('should get file from cache (History)', async () => {
      await engine.getFileFromCache('history', testData.historyQueries.list[0].id, 'cache', 'file.json');
      assert.strictEqual(mockedHistoryQuery1.getFileFromCache.mock.calls.length, 1);
      assert.deepStrictEqual(mockedHistoryQuery1.getFileFromCache.mock.calls[0].arguments, ['cache', 'file.json']);
    });

    it('should update cache content (North)', async () => {
      await engine.updateCacheContent('north', testData.north.list[0].id, cmd);
      assert.strictEqual(mockedNorth1.updateCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.updateCacheContent.mock.calls[0].arguments, [cmd]);
    });

    it('should update cache content (History)', async () => {
      await engine.updateCacheContent('history', testData.historyQueries.list[0].id, cmd);
      assert.strictEqual(mockedHistoryQuery1.updateCacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockedHistoryQuery1.updateCacheContent.mock.calls[0].arguments, [cmd]);
    });
  });

  describe('Scan mode intervals', () => {
    const intervalScanMode = (): ScanMode => ({
      ...testData.scanMode.list[0],
      id: 'intervalScanModeId',
      type: 'interval',
      cron: '',
      interval: { value: 30, unit: 's' }
    });

    it('should schedule an interval scan mode without creating a cron', async () => {
      const scanMode = intervalScanMode();
      givenScanModes(scanMode);

      await engine.start(northList, southList, historyList);

      assert.strictEqual(mocks.cron.CronJob.mock.calls.length, 0);
      assert.strictEqual(engine['cronByScanModeId'].size, 0);
      assert.strictEqual(engine['intervalByScanModeId'].size, 1);
      assert.ok(engine['intervalByScanModeId'].has(scanMode.id));
    });

    it('should fan out on each interval tick', async () => {
      givenScanModes(intervalScanMode());
      await engine.start(northList, southList, historyList);

      mock.timers.tick(30_000);
      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 1);
      assert.strictEqual(mockedNorth1.trigger.mock.calls.length, 1);
      assert.strictEqual(mockedHistoryQuery1.triggerNorth.mock.calls.length, 1);

      mock.timers.tick(60_000);
      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 3);
    });

    it('should switch a scan mode between cron and interval without leaking a timer', async () => {
      const scanMode = intervalScanMode();
      givenScanModes(scanMode);
      await engine.start(northList, southList, historyList);
      assert.strictEqual(engine['intervalByScanModeId'].size, 1);

      // interval -> cron
      await engine.updateScanMode({ ...scanMode, type: 'cron', cron: '0 * * * * *', interval: null });
      assert.strictEqual(engine['intervalByScanModeId'].size, 0);
      assert.strictEqual(engine['cronByScanModeId'].size, 1);

      // cron -> interval again
      await engine.updateScanMode(scanMode);
      assert.strictEqual(cronJob.stop.mock.calls.length, 1);
      assert.strictEqual(engine['cronByScanModeId'].size, 0);
      assert.strictEqual(engine['intervalByScanModeId'].size, 1);
    });

    it('should stop ticking once the scan mode is deleted', async () => {
      const scanMode = intervalScanMode();
      givenScanModes(scanMode);
      await engine.start(northList, southList, historyList);

      engine.deleteScanMode(scanMode.id);
      mock.timers.tick(120_000);

      assert.strictEqual(engine['intervalByScanModeId'].size, 0);
      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 0);
    });

    it('should refuse an interval outside the accepted bounds', async () => {
      givenScanModes(
        { ...intervalScanMode(), id: 'tooShort', interval: { value: 5, unit: 'ms' } },
        // Past 2^31-1 ms Node would wrap the delay back to 1 ms, turning this into a hot loop.
        { ...intervalScanMode(), id: 'tooLong', interval: { value: 1000, unit: 'hour' } }
      );

      await engine.start(northList, southList, historyList);

      assert.strictEqual(engine['intervalByScanModeId'].size, 0);
    });

    it('should refuse an interval scan mode with no interval configured', async () => {
      givenScanModes({ ...intervalScanMode(), interval: null });

      await engine.start(northList, southList, historyList);

      // No interval set means periodMs falls back to 0, which is below MIN_INTERVAL_MS.
      assert.strictEqual(engine['intervalByScanModeId'].size, 0);
    });

    it('should clear both cron and interval maps on stop', async () => {
      givenScanModes(testData.scanMode.list[0], intervalScanMode());
      await engine.start(northList, southList, historyList);
      assert.strictEqual(engine['cronByScanModeId'].size, 1);
      assert.strictEqual(engine['intervalByScanModeId'].size, 1);

      await engine.stop();

      assert.strictEqual(engine['cronByScanModeId'].size, 0);
      assert.strictEqual(engine['intervalByScanModeId'].size, 0);
    });
  });

  describe('Scan mode activation window', () => {
    // FAKE_NOW drives DateTime.utc() through mock.timers, so the gate is deterministic.
    const fakeNow = DateTime.fromISO(testData.constants.dates.FAKE_NOW, { zone: 'utc' });

    const withWindow = (activationWindow: ScanMode['activationWindow']): ScanMode => ({
      ...testData.scanMode.list[0],
      activationWindow
    });

    it('should fan out when the tick falls inside the window', async () => {
      givenScanModes(withWindow({ dateRange: { start: fakeNow.minus({ days: 1 }).toISO(), end: fakeNow.plus({ days: 1 }).toISO() } }));
      await engine.start(northList, southList, historyList);

      fireCron();

      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 1);
    });

    it('should silently skip a tick outside the window, recording no run anywhere', async () => {
      givenScanModes(withWindow({ dateRange: { end: fakeNow.minus({ days: 1 }).toISO() } }));
      await engine.start(northList, southList, historyList);

      fireCron();

      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 0);
      assert.strictEqual(mockedSouth2.trigger.mock.calls.length, 0);
      assert.strictEqual(mockedNorth1.trigger.mock.calls.length, 0);
      assert.strictEqual(mockedHistoryQuery1.triggerNorth.mock.calls.length, 0);
    });

    it('should gate interval scan modes the same way', async () => {
      givenScanModes({
        ...withWindow({ dateRange: { end: fakeNow.minus({ days: 1 }).toISO() } }),
        type: 'interval',
        cron: '',
        interval: { value: 1, unit: 's' }
      });
      await engine.start(northList, southList, historyList);

      mock.timers.tick(5_000);

      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 0);
    });

    it('should still install a schedule for a window that can never fire again', async () => {
      givenScanModes(withWindow({ recurring: { timezone: 'Europe/Paris', timeOfDay: { start: '08:00', end: '08:00' } } }));

      await engine.start(northList, southList, historyList);

      assert.strictEqual(engine['cronByScanModeId'].size, 1);
      fireCron();
      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 0);
    });
  });

  describe('Scan mode crons', () => {
    const buildWorkflow = (overrides: Partial<ConfigurationWorkflowEntity> = {}): ConfigurationWorkflowEntity => ({
      id: 'workflowId1',
      name: 'Reactor discovery',
      southId: testData.south.list[0].id,
      discoveryScope: {},
      identityKeyFields: [],
      eligibilityFilter: [],
      itemFieldMapping: { name: '{{name}}' },
      pushToOIAnalytics: false,
      scanMode: testData.scanMode.list[0],
      enabled: true,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      ...overrides
    });
    /** The first south connector has these workflows, the others none */
    const givenSouth1Workflows = (...workflows: Array<ConfigurationWorkflowEntity>) =>
      configurationWorkflowRepository.findBySouthId.mock.mockImplementation(southId =>
        southId === testData.south.list[0].id ? workflows : []
      );

    it('should create one shared cron per scan mode at startup, excluding the subscription sentinel', async () => {
      givenScanModes(testData.scanMode.list[0], testData.scanMode.list[1], {
        ...testData.scanMode.list[0],
        id: 'subscription',
        name: 'Subscription',
        cron: ''
      });

      await engine.start(northList, southList, historyList);

      assert.strictEqual(mocks.cron.CronJob.mock.calls.length, 2);
      assert.strictEqual(engine['cronByScanModeId'].size, 2);
      assert.ok(engine['cronByScanModeId'].has(testData.scanMode.list[0].id));
      assert.ok(engine['cronByScanModeId'].has(testData.scanMode.list[1].id));
      assert.ok(!engine['cronByScanModeId'].has('subscription'));
    });

    it('should fan out a scan-mode tick to every south and north connector', async () => {
      givenScanModes(testData.scanMode.list[0]);
      await engine.start(northList, southList, historyList);

      fireCron();

      assert.strictEqual(mockedSouth1.trigger.mock.calls.length, 1);
      assert.deepStrictEqual(mockedSouth1.trigger.mock.calls[0].arguments, [testData.scanMode.list[0]]);
      assert.strictEqual(mockedSouth2.trigger.mock.calls.length, 1);
      assert.strictEqual(mockedNorth1.trigger.mock.calls.length, 1);
      assert.deepStrictEqual(mockedNorth1.trigger.mock.calls[0].arguments, [testData.scanMode.list[0]]);
      assert.strictEqual(mockedNorth2.trigger.mock.calls.length, 1);
      // History query norths take part in the same fan-out: their caching trigger scan mode used to
      // be configurable but was never actually fired.
      assert.strictEqual(mockedHistoryQuery1.triggerNorth.mock.calls.length, 1);
      assert.deepStrictEqual(mockedHistoryQuery1.triggerNorth.mock.calls[0].arguments, [testData.scanMode.list[0]]);
    });

    it('should fan out a scan-mode tick to a scheduled configuration workflow via the wired run callback', async () => {
      givenSouth1Workflows(buildWorkflow({ identityKeyFields: ['nodeId'] }));
      givenScanModes(testData.scanMode.list[0]);
      await engine.start(northList, southList, historyList);

      const callback = mock.fn(async () => undefined);
      engine.setWorkflowRunCallback(callback);

      fireCron();

      assert.strictEqual(callback.mock.calls.length, 1);
      assert.deepStrictEqual(callback.mock.calls[0].arguments, [testData.south.list[0].id, 'workflowId1']);
    });

    it('should not fan out to a workflow with no scan mode (manual-only) or a disabled workflow', async () => {
      givenSouth1Workflows(
        buildWorkflow({ name: 'Manual only', scanMode: null }),
        buildWorkflow({ id: 'workflowId2', name: 'Manual only', enabled: false })
      );
      givenScanModes(testData.scanMode.list[0]);
      await engine.start(northList, southList, historyList);

      const callback = mock.fn(async () => undefined);
      engine.setWorkflowRunCallback(callback);

      fireCron();

      assert.strictEqual(callback.mock.calls.length, 0);
    });

    it('should log rather than throw when the wired run callback rejects', async () => {
      givenSouth1Workflows(buildWorkflow());
      givenScanModes(testData.scanMode.list[0]);
      await engine.start(northList, southList, historyList);
      engine.setWorkflowRunCallback(
        mock.fn(async () => {
          throw new Error('south not running');
        })
      );

      assert.doesNotThrow(() => fireCron());
      await flushPromises();

      assert.ok(loggedError('Error running scheduled configuration workflow "Reactor discovery"'));
    });

    it('should be a silent no-op when no run callback has been wired yet', async () => {
      givenSouth1Workflows(buildWorkflow());
      givenScanModes(testData.scanMode.list[0]);
      await engine.start(northList, southList, historyList);

      assert.doesNotThrow(() => fireCron());
    });

    it("reloadWorkflows should replace only the calling south connector's contribution to the schedule", async () => {
      await engine.start(northList, southList, historyList);
      assert.strictEqual(engine['workflowsByScanModeId'].size, 0);

      const workflowForSouth1 = buildWorkflow({ name: 'South 1 workflow' });
      givenSouth1Workflows(workflowForSouth1);

      engine.reloadWorkflows(testData.south.list[0].id);
      assert.deepStrictEqual(engine['workflowsByScanModeId'].get(testData.scanMode.list[0].id), [workflowForSouth1]);

      // Reloading again with an empty list for that south removes its contribution entirely,
      // without needing to touch any other south's entries in the same scan-mode bucket.
      givenSouth1Workflows();
      engine.reloadWorkflows(testData.south.list[0].id);
      assert.strictEqual(engine['workflowsByScanModeId'].has(testData.scanMode.list[0].id), false);
    });

    it('createScanMode should add a new cron', async () => {
      await engine.start(northList, southList, historyList);
      const scanMode = testData.scanMode.list[0];

      await engine.createScanMode(scanMode);

      assert.strictEqual(mocks.cron.CronJob.mock.calls.length, 1);
      assert.ok(engine['cronByScanModeId'].has(scanMode.id));
    });

    it('deleteScanMode should stop and remove the cron', async () => {
      const scanMode = testData.scanMode.list[0];
      givenScanModes(scanMode);
      await engine.start(northList, southList, historyList);
      assert.ok(engine['cronByScanModeId'].has(scanMode.id));

      engine.deleteScanMode(scanMode.id);

      assert.strictEqual(cronJob.stop.mock.calls.length, 1);
      assert.ok(!engine['cronByScanModeId'].has(scanMode.id));
    });

    it('deleteScanMode should no-op for a scan mode with no cron', () => {
      assert.doesNotThrow(() => engine.deleteScanMode('never-had-a-cron'));
      assert.strictEqual(cronJob.stop.mock.calls.length, 0);
    });

    it('should tear down every scan-mode cron on stop()', async () => {
      givenScanModes(testData.scanMode.list[0], testData.scanMode.list[1]);
      await engine.start(northList, southList, historyList);
      assert.strictEqual(engine['cronByScanModeId'].size, 2);

      await engine.stop();

      assert.strictEqual(engine['cronByScanModeId'].size, 0);
      assert.strictEqual(cronJob.stop.mock.calls.length, 2);
    });
  });
});
