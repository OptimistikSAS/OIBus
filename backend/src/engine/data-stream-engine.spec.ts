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
import { NorthConnectorEntityLight } from '../model/north-connector.model';
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
import { OIBusContent } from '../../shared/model/engine.model';
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
    mockedSouth1.connectedEvent.removeAllListeners();
    mockedSouth2.connectedEvent.removeAllListeners();
  });

  it('it should start and stop', async () => {
    (mockedNorth2.start as jest.Mock).mockImplementationOnce(() => {
      throw new Error('North error');
    });
    (mockedSouth2.start as jest.Mock).mockImplementationOnce(() => {
      throw new Error('South error');
    });
    (mockedHistoryQuery2.start as jest.Mock).mockImplementationOnce(() => {
      throw new Error('History error');
    });

    mockedNorth2.connectorConfiguration = { ...mockedNorth2.connectorConfiguration, enabled: true };
    mockedSouth2.connectorConfiguration = { ...mockedSouth2.connectorConfiguration, enabled: true };
    mockedHistoryQuery2.historyQueryConfiguration = { ...mockedHistoryQuery2.historyQueryConfiguration, status: 'RUNNING' };
    await engine.start(northList, southList, historyList);

    expect(engine.logger).toBeDefined();
    expect(logger.info).toHaveBeenCalledWith(`OIBus engine started`);
    expect(logger.error).toHaveBeenCalledTimes(3);

    // Check Factory Init Calls
    expect(initNorthCache).toHaveBeenCalledWith(testData.north.list[0].id, testData.north.list[0].type, expect.any(String));
    expect(initSouthCache).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].type, expect.any(String));
    expect(initHistoryQueryCache).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      expect.anything(),
      expect.anything(),
      expect.any(String)
    );

    await engine.stop();

    expect(mockedNorth1.stop).toHaveBeenCalledTimes(1);
  });

  it('should create OPCUA north connector and init cache', async () => {
    const config = { ...testData.north.list[0], type: 'opcua' };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(config);

    await engine.createNorth(config.id);

    expect(createNorthOrchestrator).toHaveBeenCalledWith(expect.any(String), config.id, expect.anything());
    expect(initNorthCache).toHaveBeenCalledWith(config.id, 'opcua', expect.any(String));
    expect(buildNorth).toHaveBeenCalled();
  });

  it('should create OPCUA south connector and init cache', async () => {
    const config = { ...testData.south.list[0], type: 'opcua' };
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(config);

    await engine.createSouth(config.id);

    expect(initSouthCache).toHaveBeenCalledWith(config.id, 'opcua', expect.any(String));
    expect(buildSouth).toHaveBeenCalled();
  });

  it('should create OPCUA history query and init cache', async () => {
    const config = {
      ...testData.historyQueries.list[0],
      southType: 'opcua',
      northType: 'opcua'
    };
    (historyQueryRepository.findHistoryById as jest.Mock).mockReturnValueOnce(config);

    await engine.createHistoryQuery(config.id);

    expect(createHistoryQueryOrchestrator).toHaveBeenCalledWith(expect.any(String), config.id, expect.anything());
    expect(initHistoryQueryCache).toHaveBeenCalledWith(config.id, 'opcua', 'opcua', expect.any(String));
    expect(buildHistoryQuery).toHaveBeenCalled();
  });

  it('should destroy existing metrics service when recreating north connector', async () => {
    await engine.createNorth(testData.north.list[0].id);
    expect(northConnectorMetricsService.destroy).not.toHaveBeenCalled();

    await engine.createNorth(testData.north.list[0].id);
    expect(northConnectorMetricsService.destroy).toHaveBeenCalledTimes(1);
  });

  it('should destroy existing metrics service when recreating south connector', async () => {
    await engine.createSouth(testData.south.list[0].id);
    expect(southConnectorMetricsService.destroy).not.toHaveBeenCalled();

    await engine.createSouth(testData.south.list[0].id);
    expect(southConnectorMetricsService.destroy).toHaveBeenCalledTimes(1);
  });

  it('should destroy existing metrics service when recreating history query', async () => {
    await engine.createHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryMetricsService.destroy).not.toHaveBeenCalled();

    await engine.createHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryMetricsService.destroy).toHaveBeenCalledTimes(1);
  });

  it('should manage north content files', async () => {
    await engine.start(northList, southList, historyList);

    await engine.searchCacheContent('north', testData.north.list[0].id, {
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    });
    expect(mockedNorth1.searchCacheContent).toHaveBeenCalled();

    await engine.getFileFromCache('north', testData.north.list[0].id, 'cache', 'file');
    expect(mockedNorth1.getFileFromCache).toHaveBeenCalledWith('cache', 'file');
  });

  it('should delete south connector and cache', async () => {
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');
    await engine.start([], southList, []);

    await engine.deleteSouth(testData.south.list[0]);

    expect(stopSouthSpy).toHaveBeenCalled();
    expect(deleteSouthCache).toHaveBeenCalledWith(testData.south.list[0].id, expect.any(String));
  });

  it('should delete north connector and cache', async () => {
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');
    await engine.start(northList, [], []);

    await engine.deleteNorth(testData.north.list[0]);

    expect(stopNorthSpy).toHaveBeenCalled();
    expect(deleteNorthCache).toHaveBeenCalledWith(testData.north.list[0].id, expect.any(String));
  });

  it('should delete history query and cache', async () => {
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');
    await engine.start([], [], historyList);

    await engine.deleteHistoryQuery(testData.historyQueries.list[0]);

    expect(stopHistoryQuerySpy).toHaveBeenCalled();
    expect(deleteHistoryQueryCache).toHaveBeenCalledWith(testData.historyQueries.list[0].id, expect.any(String));
  });

  it('should reset cache', async () => {
    engine['historyQueries'].set(testData.historyQueries.list[0].id, {
      historyQuery: mockedHistoryQuery1,
      metrics: historyQueryMetricsService
    });
    await engine.resetHistoryQueryCache(testData.historyQueries.list[0].id);

    expect(mockedHistoryQuery1.resetCache).toHaveBeenCalled();
    expect(historyQueryMetricsService.resetMetrics).toHaveBeenCalled();
  });

  it('should not start history if not set', async () => {
    await expect(engine.startHistoryQuery('bad id')).rejects.toThrow(`Could not find History "bad id" in engine`);
  });

  it('should get North metrics', async () => {
    await engine.start(northList, southList, historyList);
    expect(engine.getNorthMetrics(mockedNorth1.connectorConfiguration.id)).toEqual({});
  });
});
