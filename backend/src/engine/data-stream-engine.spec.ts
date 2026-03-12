import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import DataStreamEngine from './data-stream-engine';
import testData from '../tests/utils/test-data';
import NorthConnector from '../north/north-connector';
import { NorthSettings } from '../../shared/model/north-settings.model';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/south-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/north-metrics-repository.mock';
import NorthConnectorMetricsService from '../service/metrics/north-connector-metrics.service';
import NorthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/north-connector-metrics-service.mock';
import SouthConnectorMetricsService from '../service/metrics/south-connector-metrics.service';
import SouthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/south-connector-metrics-service.mock';
import { SouthConnectorEntityLight } from '../model/south-connector.model';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import HistoryQueryMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/history-query-metrics-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsMessageService from '../service/oia/oianalytics-message.service';
import HistoryQuery from './history-query';
import HistoryQueryMock from '../tests/__mocks__/history-query.mock';
import { HistoryQueryEntityLight } from '../model/histor-query.model';
import { CacheContentUpdateCommand, CacheSearchParam, OIBusContent } from '../../shared/model/engine.model';
import HistoryQueryMetricsService from '../service/metrics/history-query-metrics.service';
import HistoryQueryMetricsServiceMock from '../tests/__mocks__/service/metrics/history-query-metrics-service.mock';
import CacheService from '../service/cache/cache.service';

// Import Factory Functions to mock them
import { buildNorth, createNorthOrchestrator, deleteNorthCache, initNorthCache } from '../north/north-connector-factory';
import { buildSouth, deleteSouthCache, initSouthCache } from '../south/south-connector-factory';
import { buildHistoryQuery, createHistoryQueryOrchestrator, deleteHistoryQueryCache, initHistoryQueryCache } from './history-query-factory';

jest.mock('../south/south-mqtt/south-mqtt');
jest.mock('../service/utils');
jest.mock('node:fs/promises');

// Mock Factories
jest.mock('../north/north-connector-factory');
jest.mock('../south/south-connector-factory');
jest.mock('./history-query-factory');

let mockedHistoryQuery1: HistoryQuery;
let mockedHistoryQuery2: HistoryQuery;

// Mock HistoryQuery Class (default export)
jest.mock('./history-query', () =>
  jest.fn((configuration, _north, _south, _logger) => {
    if (configuration.id === testData.historyQueries.list[0].id) {
      return mockedHistoryQuery1;
    } else if (configuration.id === testData.historyQueries.list[1].id) {
      return mockedHistoryQuery2;
    }
    return null;
  })
);

const northConnectorMetricsService: NorthConnectorMetricsService = new NorthConnectorMetricsServiceMock();
jest.mock(
  '../service/metrics/north-connector-metrics.service',
  () =>
    function () {
      return northConnectorMetricsService;
    }
);

const southConnectorMetricsService: SouthConnectorMetricsService = new SouthConnectorMetricsServiceMock();
jest.mock(
  '../service/metrics/south-connector-metrics.service',
  () =>
    function () {
      return southConnectorMetricsService;
    }
);

const historyQueryMetricsService: HistoryQueryMetricsService = new HistoryQueryMetricsServiceMock();
jest.mock(
  '../service/metrics/history-query-metrics.service',
  () =>
    function () {
      return historyQueryMetricsService;
    }
);

const northConnectorMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const southConnectorMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const historyQueryMetricsRepository: HistoryQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthConnectorRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const oianalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();

const logger: pino.Logger = new PinoLogger();

describe('DataStreamEngine', () => {
  let engine: DataStreamEngine;
  let mockedNorth1: NorthConnector<NorthSettings>;
  let mockedNorth2: NorthConnector<NorthSettings>;
  let mockedSouth1: SouthConnector<SouthSettings, SouthItemSettings>;
  let mockedSouth2: SouthConnector<SouthSettings, SouthItemSettings>;

  const northList = [
    { id: testData.north.list[0].id, type: testData.north.list[0].type, name: testData.north.list[0].name },
    { id: testData.north.list[1].id, type: testData.north.list[1].type, name: testData.north.list[1].name }
  ] as Array<NorthConnectorEntityLight>;
  const southList = [
    { id: testData.south.list[0].id, type: testData.south.list[0].type, name: testData.south.list[0].name },
    { id: testData.south.list[1].id, type: testData.south.list[1].type, name: testData.south.list[1].name }
  ] as Array<SouthConnectorEntityLight>;
  const historyList = [
    {
      id: testData.historyQueries.list[0].id,
      northType: testData.historyQueries.list[0].northType,
      southType: testData.historyQueries.list[0].southType,
      name: testData.historyQueries.list[0].name
    },
    {
      id: testData.historyQueries.list[1].id,
      northType: testData.historyQueries.list[1].northType,
      southType: testData.historyQueries.list[1].southType,
      name: testData.historyQueries.list[1].name
    }
  ] as Array<HistoryQueryEntityLight>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (logger.child as jest.Mock).mockReturnValue(logger);

    mockedNorth1 = new NorthConnectorMock(testData.north.list[0]) as unknown as NorthConnector<NorthSettings>;
    mockedNorth2 = new NorthConnectorMock(testData.north.list[1]) as unknown as NorthConnector<NorthSettings>;
    mockedSouth1 = new SouthConnectorMock(testData.south.list[0]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;
    mockedSouth2 = new SouthConnectorMock(testData.south.list[1]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;
    mockedHistoryQuery1 = new HistoryQueryMock(testData.historyQueries.list[0]) as unknown as HistoryQuery;
    mockedHistoryQuery2 = new HistoryQueryMock(testData.historyQueries.list[1]) as unknown as HistoryQuery;

    // Repo Mocks
    (northConnectorRepository.findNorthById as jest.Mock).mockImplementation(id => testData.north.list.find(element => element.id === id));
    (southConnectorRepository.findSouthById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (historyQueryRepository.findHistoryById as jest.Mock).mockImplementation(id =>
      testData.historyQueries.list.find(element => element.id === id)
    );

    // Factory Mocks
    (buildNorth as jest.Mock).mockImplementation(conf => {
      if (conf.id === testData.north.list[0].id) return mockedNorth1;
      if (conf.id === testData.north.list[1].id) return mockedNorth2;
      return null;
    });
    (buildSouth as jest.Mock).mockImplementation(conf => {
      if (conf.id === testData.south.list[0].id) return mockedSouth1;
      if (conf.id === testData.south.list[1].id) return mockedSouth2;
      return null;
    });
    (buildHistoryQuery as jest.Mock).mockImplementation(conf => {
      if (conf.id === testData.historyQueries.list[0].id) return mockedHistoryQuery1;
      if (conf.id === testData.historyQueries.list[1].id) return mockedHistoryQuery2;
      return null;
    });

    // Orchestrator Mocks
    (createNorthOrchestrator as jest.Mock).mockReturnValue({} as CacheService);
    (createHistoryQueryOrchestrator as jest.Mock).mockReturnValue({} as CacheService);

    engine = new DataStreamEngine(
      northConnectorRepository,
      northConnectorMetricsRepository,
      southConnectorRepository,
      southConnectorMetricsRepository,
      historyQueryRepository,
      historyQueryMetricsRepository,
      southCacheRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      oianalyticsMessageService,
      logger
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    mockedSouth1.connectedEvent.removeAllListeners();
    mockedSouth2.connectedEvent.removeAllListeners();
  });

  describe('Lifecycle (Start/Stop)', () => {
    it('should start and stop successfully', async () => {
      // Setup scenarios where second connectors fail to verify error handling
      (mockedNorth2.start as jest.Mock).mockRejectedValue(new Error('North error'));
      (mockedSouth2.start as jest.Mock).mockRejectedValue(new Error('South error'));
      (mockedHistoryQuery2.start as jest.Mock).mockRejectedValue(new Error('History error'));

      engine.createNorth = jest.fn().mockRejectedValueOnce(new Error('north creation error'));
      engine.createSouth = jest.fn().mockRejectedValueOnce(new Error('south creation error'));
      engine.createHistoryQuery = jest.fn().mockRejectedValueOnce(new Error('history creation error'));

      await engine.start([northList[0]], [southList[0]], [historyList[0]]);

      expect(logger.error).toHaveBeenCalledWith(
        `Error while creating North connector "${northList[0].name}" of type "${northList[0].type}" (${northList[0].id}): north creation error`
      );
      expect(logger.error).toHaveBeenCalledWith(
        `Error while creating South connector "${southList[0].name}" of type "${southList[0].type}" (${southList[0].id}): south creation error`
      );
      expect(logger.error).toHaveBeenCalledWith(
        `Error while creating History query "${historyList[0].name}" of South type "${historyList[0].southType}" and North type "${historyList[0].northType}" (${historyList[0].id}): history creation error`
      );

      engine['northConnectors'].set(northList[0].id, { north: mockedNorth1, metrics: northConnectorMetricsService });
      engine['southConnectors'].set(southList[0].id, { south: mockedSouth1, metrics: southConnectorMetricsService });
      engine['historyQueries'].set(historyList[0].id, { historyQuery: mockedHistoryQuery1, metrics: historyQueryMetricsService });
      engine.stopSouth = jest.fn().mockRejectedValueOnce(new Error('south stop error'));
      engine.stopNorth = jest.fn().mockRejectedValueOnce(new Error('north stop error'));
      engine.stopHistoryQuery = jest.fn().mockRejectedValueOnce(new Error('history stop error'));

      await engine.stop();

      expect(logger.error).toHaveBeenCalledWith(`Error while stopping North "${northList[0].id}": north stop error`);
      expect(logger.error).toHaveBeenCalledWith(`Error while stopping South "${southList[0].id}": south stop error`);
      expect(logger.error).toHaveBeenCalledWith(`Error while stopping History query "${historyList[0].id}": history stop error`);
    });

    it('should properly manage entity creation errors', async () => {
      // Setup scenarios where second connectors fail to verify error handling
      (mockedNorth2.start as jest.Mock).mockRejectedValue(new Error('North error'));
      (mockedSouth2.start as jest.Mock).mockRejectedValue(new Error('South error'));
      (mockedHistoryQuery2.start as jest.Mock).mockRejectedValue(new Error('History error'));

      await engine.start(northList, southList, historyList);

      expect(logger.info).toHaveBeenCalledWith(`OIBus engine started`);
      expect(logger.error).toHaveBeenCalledTimes(3); // 3 start failures

      // Verify initialization
      expect(initNorthCache).toHaveBeenCalledTimes(2);
      expect(initSouthCache).toHaveBeenCalledTimes(2);
      expect(initHistoryQueryCache).toHaveBeenCalledTimes(2);

      await engine.stop();

      expect(mockedNorth1.stop).toHaveBeenCalled();
      expect(mockedSouth1.stop).toHaveBeenCalled();
      expect(mockedHistoryQuery1.stop).toHaveBeenCalled();
    });
  });

  describe('Connectors Creation', () => {
    it('should create OPCUA connectors and history queries', async () => {
      const northConfig = { ...testData.north.list[0], type: 'opcua' };
      const southConfig = { ...testData.south.list[0], type: 'opcua' };
      const historyConfig = { ...testData.historyQueries.list[0], southType: 'opcua', northType: 'opcua' };

      (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(northConfig);
      (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(southConfig);
      (historyQueryRepository.findHistoryById as jest.Mock).mockReturnValue(historyConfig);

      await engine.createNorth(northConfig.id);
      await engine.createSouth(southConfig.id);
      await engine.createHistoryQuery(historyConfig.id);

      expect(initNorthCache).toHaveBeenCalledWith(northConfig.id, 'opcua', expect.any(String));
      expect(initSouthCache).toHaveBeenCalledWith(southConfig.id, 'opcua', expect.any(String));
      expect(initHistoryQueryCache).toHaveBeenCalledWith(historyConfig.id, 'opcua', 'opcua', expect.any(String));
    });

    it('should clean up old metrics when recreating connectors', async () => {
      // Create first time
      await engine.createNorth(testData.north.list[0].id);
      await engine.createSouth(testData.south.list[0].id);
      await engine.createHistoryQuery(testData.historyQueries.list[0].id);

      expect(northConnectorMetricsService.destroy).not.toHaveBeenCalled();

      // Create second time (should destroy old metrics)
      await engine.createNorth(testData.north.list[0].id);
      await engine.createSouth(testData.south.list[0].id);
      await engine.createHistoryQuery(testData.historyQueries.list[0].id);

      expect(northConnectorMetricsService.destroy).toHaveBeenCalledTimes(1);
      expect(southConnectorMetricsService.destroy).toHaveBeenCalledTimes(1);
      expect(historyQueryMetricsService.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('North Connector Management', () => {
    beforeEach(async () => {
      await engine.start(northList, [], []);
    });

    it('should get all north metrics', () => {
      const metrics = engine.getAllNorthMetrics();
      expect(metrics).toHaveProperty(testData.north.list[0].id);
      expect(metrics).toHaveProperty(testData.north.list[1].id);
    });

    it('should get north SSE stream', () => {
      const sse = engine.getNorthSSE(testData.north.list[0].id);
      expect(sse).toBeDefined(); // Mocked returns a stream
    });

    it('should reload north connector', async () => {
      const northEntity = testData.north.list[0];
      const spyStop = jest.spyOn(engine, 'stopNorth');
      const spyStart = jest.spyOn(engine, 'startNorth');

      await engine.reloadNorth(northEntity);

      expect(spyStop).toHaveBeenCalledWith(northEntity.id);
      expect(spyStart).toHaveBeenCalledWith(northEntity.id);
      expect(mockedNorth1.setLogger).toHaveBeenCalled();
    });

    it('should delete north connector', async () => {
      const spyStop = jest.spyOn(engine, 'stopNorth');
      await engine.deleteNorth(testData.north.list[0]);

      expect(spyStop).toHaveBeenCalled();
      expect(deleteNorthCache).toHaveBeenCalled();
      expect(northConnectorMetricsService.destroy).toHaveBeenCalled();
      expect(() => engine.getNorth(testData.north.list[0].id)).toThrow();
    });

    it('should reset north metrics', () => {
      engine.resetNorthMetrics(testData.north.list[0].id);
      expect(northConnectorMetricsService.resetMetrics).toHaveBeenCalled();
    });

    it('should add external content (API)', async () => {
      (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(true);
      const mockContent: OIBusContent = { type: 'any', filePath: 'file' };
      await engine.addExternalContent(testData.north.list[0].id, mockContent);

      expect(mockedNorth1.cacheContent).toHaveBeenCalledWith(mockContent, { source: 'api' });
    });

    it('should not add external content (API) when disabled', async () => {
      (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false);
      const mockContent: OIBusContent = { type: 'any', filePath: 'file' };
      await engine.addExternalContent(testData.north.list[0].id, mockContent);

      expect(mockedNorth1.cacheContent).not.toHaveBeenCalled();
    });

    it('should update north configuration', () => {
      engine.updateNorthConfiguration(testData.north.list[0].id);
      expect(mockedNorth1.connectorConfiguration).toBeDefined();
    });

    it('should update north transformer by south id', () => {
      // Setup mock to simulate a north having a transformer linked to this south
      const northConfig = {
        ...testData.north.list[0],
        transformers: [{ south: { id: 'south-1' } }]
      } as NorthConnectorEntity<NorthSettings>;
      (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(northConfig);

      // We need to inject this config into the running instance map
      // (Mocked north returns undefined config by default in this test setup unless we set it)
      mockedNorth1.connectorConfiguration = northConfig;

      engine.updateNorthTransformerBySouth('south-1');

      expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(northConfig.id);
    });
  });

  describe('South Connector Management', () => {
    beforeEach(async () => {
      await engine.start([], southList, []);
    });

    it('should get all south metrics', () => {
      const metrics = engine.getAllSouthMetrics();
      expect(metrics).toHaveProperty(testData.south.list[0].id);
    });

    it('should get south SSE stream', () => {
      expect(engine.getSouthSSE(testData.south.list[0].id)).toBeDefined();
    });

    it('should reload south connector and update cache/cron/subs', async () => {
      const southEntity = testData.south.list[0];

      // Mock capabilities
      (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValue(true);
      (mockedSouth1.queriesLastPoint as unknown as jest.Mock).mockReturnValue(true);
      (mockedSouth1.queriesSubscription as unknown as jest.Mock).mockReturnValue(true);
      (mockedSouth1.isEnabled as jest.Mock).mockReturnValue(true);

      const spyStop = jest.spyOn(engine, 'stopSouth');
      const spyStart = jest.spyOn(engine, 'startSouth');

      await engine.reloadSouth(southEntity);

      expect(spyStop).toHaveBeenCalled();
      expect(spyStart).toHaveBeenCalled();
      expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).toHaveBeenCalled();
      expect(mockedSouth1.setLogger).toHaveBeenCalled();
    });

    it('should reload south connector and not update cache history', async () => {
      const southEntity = testData.south.list[0];

      (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValue(false);

      const spyStop = jest.spyOn(engine, 'stopSouth');
      const spyStart = jest.spyOn(engine, 'startSouth');

      await engine.reloadSouth(southEntity);

      expect(spyStop).toHaveBeenCalled();
      expect(spyStart).toHaveBeenCalled();
      expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).not.toHaveBeenCalled();
    });

    it('should manage south connect event', async () => {
      engine.getSouth = jest.fn().mockReturnValueOnce({ south: mockedSouth1 });

      const queriesHistorySpy = jest.spyOn(mockedSouth1, 'queriesHistory').mockReturnValueOnce(false).mockReturnValueOnce(true);
      const queriesSubscriptionSpy = jest.spyOn(mockedSouth1, 'queriesSubscription').mockReturnValueOnce(false).mockReturnValueOnce(true);

      await engine.startSouth(testData.south.list[0].id);
      mockedSouth1.connectedEvent.emit('connected');
      expect(mockedSouth1.updateCronJobs).not.toHaveBeenCalled();
      expect(mockedSouth1.updateSubscriptions).not.toHaveBeenCalled();
      mockedSouth1.connectedEvent.emit('connected');
      expect(mockedSouth1.updateCronJobs).toHaveBeenCalledTimes(1);
      expect(mockedSouth1.updateSubscriptions).toHaveBeenCalledTimes(1);
      expect(queriesHistorySpy).toHaveBeenCalledTimes(2);
      expect(queriesSubscriptionSpy).toHaveBeenCalledTimes(2);
    });

    it('should reload south items', async () => {
      const southEntity = testData.south.list[0];

      // Mock capabilities
      (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValue(true);
      (mockedSouth1.queriesLastPoint as unknown as jest.Mock).mockReturnValue(true);
      (mockedSouth1.queriesSubscription as unknown as jest.Mock).mockReturnValue(true);
      (mockedSouth1.isEnabled as jest.Mock).mockReturnValue(true);

      await engine.reloadSouthItems(southEntity);

      expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).toHaveBeenCalled();
      expect(mockedSouth1.updateCronJobs).toHaveBeenCalled();
      expect(mockedSouth1.updateSubscriptions).toHaveBeenCalled();
    });

    it('should reload south items and manage connector type', async () => {
      const southEntity = testData.south.list[0];

      // Mock capabilities
      (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValue(false);
      (mockedSouth1.queriesLastPoint as unknown as jest.Mock).mockReturnValue(false);
      (mockedSouth1.queriesSubscription as unknown as jest.Mock).mockReturnValue(false);
      (mockedSouth1.isEnabled as jest.Mock).mockReturnValue(true);

      await engine.reloadSouthItems(southEntity);

      expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).not.toHaveBeenCalled();
      expect(mockedSouth1.updateCronJobs).not.toHaveBeenCalled();
      expect(mockedSouth1.updateSubscriptions).not.toHaveBeenCalled();
    });

    it('should reload south items when not enabled', async () => {
      const southEntity = testData.south.list[0];

      (mockedSouth1.isEnabled as jest.Mock).mockReturnValue(false);

      await engine.reloadSouthItems(southEntity);

      expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).not.toHaveBeenCalled();
      expect(mockedSouth1.updateCronJobs).not.toHaveBeenCalled();
      expect(mockedSouth1.updateSubscriptions).not.toHaveBeenCalled();
    });

    it('should delete south connector', async () => {
      const spyStop = jest.spyOn(engine, 'stopSouth');
      await engine.deleteSouth(testData.south.list[0]);

      expect(spyStop).toHaveBeenCalled();
      expect(deleteSouthCache).toHaveBeenCalled();
      expect(southConnectorMetricsService.destroy).toHaveBeenCalled();
      expect(() => engine.getSouth(testData.south.list[0].id)).toThrow();
    });

    it('should reset south metrics', () => {
      engine.resetSouthMetrics(testData.south.list[0].id);
      expect(southConnectorMetricsService.resetMetrics).toHaveBeenCalled();
    });

    it('should handle addContent callback from South', async () => {
      (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(true);

      // Need to create a history query to trigger the buildSouth with the callback logic
      // But we can test the `addContent` method directly on the engine
      await engine.start(northList, [], []); // Start norths to have them enabled

      const mockData: OIBusContent = { type: 'time-values', content: [] };
      await engine.addContent('south-1', mockData, '2023-01-01', []);

      expect(mockedNorth1.cacheContent).toHaveBeenCalled();
    });
  });

  describe('History Query Management', () => {
    beforeEach(async () => {
      await engine.start([], [], historyList);
    });

    it('should handle history finish event', async () => {
      // Trigger the 'finished' event on the mocked history query
      mockedHistoryQuery1.finishEvent.emit('finished');

      // It's async inside the handler, wait a tick
      await jest.requireActual('timers').setImmediate;

      expect(historyQueryRepository.updateHistoryStatus).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'FINISHED');
      expect(oianalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
    });

    it('should reload history query', async () => {
      const config = testData.historyQueries.list[0];
      const spyStop = jest.spyOn(engine, 'stopHistoryQuery');
      const spyStart = jest.spyOn(engine, 'startHistoryQuery');
      const spyReset = jest.spyOn(engine, 'resetHistoryQueryCache');

      await engine.reloadHistoryQuery(config, true);

      expect(spyStop).toHaveBeenCalled();
      expect(spyReset).toHaveBeenCalled();
      expect(spyStart).toHaveBeenCalled();
      expect(mockedHistoryQuery1.setLogger).toHaveBeenCalled();
    });

    it('should reload history query without reset cache', async () => {
      const config = testData.historyQueries.list[0];
      const spyStop = jest.spyOn(engine, 'stopHistoryQuery');
      const spyStart = jest.spyOn(engine, 'startHistoryQuery');
      const spyReset = jest.spyOn(engine, 'resetHistoryQueryCache');

      await engine.reloadHistoryQuery(config, false);

      expect(spyStop).toHaveBeenCalled();
      expect(spyReset).not.toHaveBeenCalled();
      expect(spyStart).toHaveBeenCalled();
    });

    it('should delete history query', async () => {
      const config = testData.historyQueries.list[0];
      const spyStop = jest.spyOn(engine, 'stopHistoryQuery');

      await engine.deleteHistoryQuery(config);

      expect(spyStop).toHaveBeenCalled();
      expect(deleteHistoryQueryCache).toHaveBeenCalled();
      expect(historyQueryMetricsService.destroy).toHaveBeenCalled();
      expect(() => engine.getHistoryQuery(config.id)).toThrow();
    });

    it('should get metrics and SSE', () => {
      const id = testData.historyQueries.list[0].id;
      expect(engine.getHistoryMetrics(id)).toBeDefined();
      expect(engine.getHistoryQuerySSE(id)).toBeDefined();
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
        jest.spyOn(engine, 'reloadHistoryQuery').mockResolvedValue(undefined);
        (northConnectorRepository.findNorthById as jest.Mock).mockClear();

        await engine.reloadTransformer(transformerId);

        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(testData.north.list[0].name));
        expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
      });

      it('should reload history query when transformer is in use', async () => {
        const spyReloadHistoryQuery = jest.spyOn(engine, 'reloadHistoryQuery').mockResolvedValue(undefined);

        await engine.reloadTransformer(transformerId);

        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(testData.historyQueries.list[0].name));
        expect(spyReloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
      });

      it('should do nothing when transformer is not used', async () => {
        const spyReloadHistoryQuery = jest.spyOn(engine, 'reloadHistoryQuery').mockResolvedValue(undefined);

        await engine.reloadTransformer('non-existent-transformer-id');

        expect(logger.warn).not.toHaveBeenCalled();
        expect(spyReloadHistoryQuery).not.toHaveBeenCalled();
      });
    });

    describe('removeAndReloadTransformer', () => {
      it('should log warning and reload affected north connectors and history queries', async () => {
        const spyReloadHistoryQuery = jest.spyOn(engine, 'reloadHistoryQuery').mockResolvedValue(undefined);
        const spyUpdateNorthConfig = jest.spyOn(engine, 'updateNorthConfiguration');

        await engine.removeAndReloadTransformer(transformerId);

        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(transformerId));
        expect(northConnectorRepository.removeTransformersByTransformerId).toHaveBeenCalledWith(transformerId);
        expect(historyQueryRepository.removeTransformersByTransformerId).toHaveBeenCalledWith(transformerId);
        expect(spyUpdateNorthConfig).toHaveBeenCalledWith(testData.north.list[0].id);
        expect(spyReloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
      });

      it('should not warn or reload when transformer is not used', async () => {
        const spyReloadHistoryQuery = jest.spyOn(engine, 'reloadHistoryQuery').mockResolvedValue(undefined);
        const spyUpdateNorthConfig = jest.spyOn(engine, 'updateNorthConfiguration');

        await engine.removeAndReloadTransformer('non-existent-transformer-id');

        expect(logger.debug).not.toHaveBeenCalled();
        expect(northConnectorRepository.removeTransformersByTransformerId).toHaveBeenCalledWith('non-existent-transformer-id');
        expect(historyQueryRepository.removeTransformersByTransformerId).toHaveBeenCalledWith('non-existent-transformer-id');
        expect(spyUpdateNorthConfig).not.toHaveBeenCalled();
        expect(spyReloadHistoryQuery).not.toHaveBeenCalled();
      });
    });
  });

  describe('Engine Wide Operations', () => {
    beforeEach(async () => {
      await engine.start(northList, southList, historyList);
    });

    it('should set logger for all components', () => {
      const newLogger = new PinoLogger();
      (newLogger.child as jest.Mock).mockReturnValue(newLogger);

      engine.setLogger(newLogger);

      expect(mockedNorth1.setLogger).toHaveBeenCalled();
      expect(mockedSouth1.setLogger).toHaveBeenCalled();
      expect(mockedHistoryQuery1.setLogger).toHaveBeenCalled();
    });

    it('should update scan mode for all connectors', async () => {
      const scanMode = testData.scanMode.list[0];
      await engine.updateScanMode(scanMode);

      expect(mockedNorth1.updateScanMode).toHaveBeenCalledWith(scanMode);
      expect(mockedSouth1.updateScanModeIfUsed).toHaveBeenCalledWith(scanMode);
    });

    it('should search cache content (North)', async () => {
      const params = { start: 'now' } as CacheSearchParam;

      const result = await engine.searchCacheContent('north', testData.north.list[0].id, params);

      expect(mockedNorth1.searchCacheContent).toHaveBeenCalledWith(params);
      expect(result.metrics).toBeDefined();
    });

    it('should search cache content (History)', async () => {
      const params = { start: 'now' } as CacheSearchParam;

      (mockedHistoryQuery1.searchCacheContent as jest.Mock).mockResolvedValue({});
      engine.getHistoryQuery = jest.fn().mockReturnValue({ historyQuery: mockedHistoryQuery1, metrics: { metrics: { north: {} } } });
      const result = await engine.searchCacheContent('history', testData.historyQueries.list[0].id, params);

      expect(mockedHistoryQuery1.searchCacheContent).toHaveBeenCalledWith(params);
      expect(result.metrics).toEqual({});
    });

    it('should get file from cache (North)', async () => {
      engine.getNorth = jest.fn().mockReturnValue({ north: mockedNorth1, metrics: { metrics: {} } });
      await engine.getFileFromCache('north', testData.north.list[0].id, 'cache', 'file.json');
      expect(mockedNorth1.getFileFromCache).toHaveBeenCalledWith('cache', 'file.json');
    });

    it('should get file from cache (History)', async () => {
      engine.getHistoryQuery = jest.fn().mockReturnValue({ historyQuery: mockedHistoryQuery1, metrics: { metrics: { north: {} } } });
      await engine.getFileFromCache('history', testData.historyQueries.list[0].id, 'cache', 'file.json');
      expect(mockedHistoryQuery1.getFileFromCache).toHaveBeenCalledWith('cache', 'file.json');
    });

    it('should update cache content (North)', async () => {
      const cmd: CacheContentUpdateCommand = {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      };
      await engine.updateCacheContent('north', testData.north.list[0].id, cmd);
      expect(mockedNorth1.updateCacheContent).toHaveBeenCalledWith(cmd);
    });

    it('should update cache content (History)', async () => {
      const cmd: CacheContentUpdateCommand = {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      };
      await engine.updateCacheContent('history', testData.historyQueries.list[0].id, cmd);
      expect(mockedHistoryQuery1.updateCacheContent).toHaveBeenCalledWith(cmd);
    });
  });
});
