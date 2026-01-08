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
import { SouthConnectorEntity, SouthConnectorEntityLight } from '../model/south-connector.model';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import { createBaseFolders, createFolder, filesExists } from '../service/utils';
import path from 'node:path';
import fs from 'node:fs/promises';
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
import { buildSouth } from '../south/south-connector-factory';
import { buildNorth } from '../north/north-connector-factory';
import { OIBusContent } from '../../shared/model/engine.model';
import { flushPromises } from '../tests/utils/test-utils';
import { EventEmitter } from 'node:events';
import HistoryQueryMetricsService from '../service/metrics/history-query-metrics.service';
import HistoryQueryMetricsServiceMock from '../tests/__mocks__/service/metrics/history-query-metrics-service.mock';

jest.mock('../south/south-mqtt/south-mqtt');
jest.mock('../service/utils');
jest.mock('node:fs/promises');
jest.mock('../north/north-connector-factory');
jest.mock('../south/south-connector-factory');
let mockedHistoryQuery1: HistoryQuery;
let mockedHistoryQuery2: HistoryQuery;
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
const anotherLogger: pino.Logger = new PinoLogger();

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

    (northConnectorRepository.findNorthById as jest.Mock).mockImplementation(id => testData.north.list.find(element => element.id === id));
    (southConnectorRepository.findSouthById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (historyQueryRepository.findHistoryById as jest.Mock).mockImplementation(id =>
      testData.historyQueries.list.find(element => element.id === id)
    );
    (buildNorth as jest.Mock).mockImplementation(conf => {
      if (conf.id === testData.north.list[0].id) {
        return mockedNorth1;
      }
      if (conf.id === testData.north.list[1].id) {
        return mockedNorth2;
      }
      return null;
    });
    (buildSouth as jest.Mock).mockImplementation(conf => {
      if (conf.id === testData.south.list[0].id) {
        return mockedSouth1;
      }
      if (conf.id === testData.south.list[1].id) {
        return mockedSouth2;
      }
      return null;
    });

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
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating North connector "${testData.north.list[1].name}" of type "${testData.north.list[1].type}" (${
        testData.north.list[1].id
      }): North error`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating South connector "${testData.south.list[1].name}" of type "${testData.south.list[1].type}" (${
        testData.south.list[1].id
      }): South error`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating History query "${testData.historyQueries.list[1].name}" of South type "${testData.historyQueries.list[1].southType}" and North type "${testData.historyQueries.list[1].northType}" (${
        testData.historyQueries.list[1].id
      }): History error`
    );

    (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);
    (mockedSouth1.queriesSubscription as unknown as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);
    mockedSouth1.connectedEvent.emit('connected');
    mockedSouth1.connectedEvent.emit('connected');
    expect(mockedSouth1.updateCronJobs as jest.Mock).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.updateSubscriptions as jest.Mock).toHaveBeenCalledTimes(1);

    await engine.stop();

    expect(mockedNorth1.stop).toHaveBeenCalledTimes(1);
  });

  it('should create OPCUA north connector', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce({ ...testData.north.list[0], type: 'opcua' });
    await engine.createNorth(testData.north.list[0].id);
    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createBaseFolders).toHaveBeenCalledTimes(1);
  });

  it('should create OPCUA south connector', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce({ ...testData.south.list[0], type: 'opcua' });
    await engine.createSouth(testData.south.list[0].id);
    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createBaseFolders).toHaveBeenCalledTimes(1);
  });

  it('should create OPCUA history query', async () => {
    (historyQueryRepository.findHistoryById as jest.Mock).mockReturnValueOnce({
      ...testData.historyQueries.list[0],
      southType: 'opcua',
      northType: 'opcua'
    });
    await engine.createHistoryQuery(testData.historyQueries.list[0].id);
    expect(createFolder).toHaveBeenCalledTimes(3);
    expect(createBaseFolders).toHaveBeenCalledTimes(1);
  });

  it('should destroy existing metrics service when recreating north connector', async () => {
    // Create north connector first time
    await engine.createNorth(testData.north.list[0].id);
    expect(northConnectorMetricsService.destroy).not.toHaveBeenCalled();

    // Recreate the same north connector - should call destroy on existing metrics
    await engine.createNorth(testData.north.list[0].id);
    expect(northConnectorMetricsService.destroy).toHaveBeenCalledTimes(1);
  });

  it('should destroy existing metrics service when recreating south connector', async () => {
    // Create south connector first time
    await engine.createSouth(testData.south.list[0].id);
    expect(southConnectorMetricsService.destroy).not.toHaveBeenCalled();

    // Recreate the same south connector - should call destroy on existing metrics
    await engine.createSouth(testData.south.list[0].id);
    expect(southConnectorMetricsService.destroy).toHaveBeenCalledTimes(1);
  });

  it('should destroy existing metrics service when recreating history query', async () => {
    (buildNorth as jest.Mock).mockReturnValue(mockedNorth1);
    (buildSouth as jest.Mock).mockReturnValue(mockedSouth1);

    // Create history query first time
    await engine.createHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryMetricsService.destroy).not.toHaveBeenCalled();

    // Recreate the same history query - should call destroy on existing metrics
    await engine.createHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryMetricsService.destroy).toHaveBeenCalledTimes(1);
  });

  it('should pass a callback to buildSouth that calls north.cacheContent', async () => {
    (buildNorth as jest.Mock).mockReturnValueOnce(mockedNorth1);
    (buildSouth as jest.Mock).mockReturnValueOnce(mockedSouth1);
    // Mock data
    const mockData: OIBusContent = testData.oibusContent[0];

    // Call createHistoryQuery
    await engine.createHistoryQuery(testData.historyQueries.list[0].id);

    // Get the callback passed to buildSouth
    const callback = (buildSouth as jest.Mock).mock.calls[0][1];
    await callback(testData.historyQueries.list[0].id, mockData, testData.constants.dates.DATE_1, []);

    // Verify north.cacheContent is called with the correct arguments
    expect(mockedNorth1.cacheContent).toHaveBeenCalledWith(mockData, {
      source: 'south',
      southId: testData.historyQueries.list[0].id,
      queryTime: testData.constants.dates.DATE_1,
      itemIds: []
    });
  });

  it('it should start and stop without south 2 and north 2', async () => {
    mockedNorth2.connectorConfiguration = { ...mockedNorth2.connectorConfiguration, enabled: false };
    mockedSouth2.connectorConfiguration = { ...mockedSouth2.connectorConfiguration, enabled: false };
    mockedHistoryQuery2.historyQueryConfiguration = { ...mockedHistoryQuery2.historyQueryConfiguration, status: 'FINISHED' };
    engine.startNorth = jest.fn();
    engine.startSouth = jest.fn();
    await engine.start(northList, southList, historyList);

    expect(engine.startNorth).toHaveBeenCalledTimes(1);
    expect(engine.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(engine.startSouth).toHaveBeenCalledTimes(1);
    expect(engine.startSouth).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should not start history if not set', async () => {
    await engine.startHistoryQuery('bad id');
    expect(logger.trace(`History query "bad id" not set`));
  });

  it('should not stop history if not set', async () => {
    await engine.stopHistoryQuery('bad id');
    expect(historyQueryRepository.findHistoryById).not.toHaveBeenCalled();
  });

  it('should register the finished event listener and update status', async () => {
    // Add the mocked historyQuery to the engine's map
    engine['historyQueries'].set(testData.historyQueries.list[0].id, mockedHistoryQuery1);

    mockedHistoryQuery1.finishEvent = {
      removeAllListeners: jest.fn(),
      on: jest.fn()
    } as unknown as EventEmitter;
    await engine.startHistoryQuery(testData.historyQueries.list[0].id);

    // Verify removeAllListeners is called
    expect(mockedHistoryQuery1.finishEvent.removeAllListeners).toHaveBeenCalled();

    // Verify on is called with 'finished' event
    expect(mockedHistoryQuery1.finishEvent.on).toHaveBeenCalledWith('finished', expect.any(Function));

    // Get the event listener callback
    const finishedCallback = (mockedHistoryQuery1.finishEvent.on as jest.Mock).mock.calls[0][1];

    // Simulate the 'finished' event
    await finishedCallback();

    // Verify updateHistoryQueryStatus is called
    expect(historyQueryRepository.updateHistoryStatus).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'FINISHED');

    // Verify createFullHistoryQueriesMessageIfNotPending is called
    expect(oianalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
  });

  it('should catch and log errors when starting the history query', async () => {
    engine['historyQueries'].set(testData.historyQueries.list[0].id, mockedHistoryQuery1);

    // Mock start to reject with an error
    (mockedHistoryQuery1.start as jest.Mock).mockRejectedValue(new Error('start error'));

    await engine.startHistoryQuery(testData.historyQueries.list[0].id);

    // Verify start is called
    expect(mockedHistoryQuery1.start).toHaveBeenCalled();
    await flushPromises();

    // Verify error is logged
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting History query "${testData.historyQueries.list[0].name}" of South type "${testData.historyQueries.list[0].southType}" and North type ${testData.historyQueries.list[0].northType} (${testData.historyQueries.list[0].id}): start error`
    );
  });

  it('should stop, set logger, and restart the history query without resetting cache', async () => {
    // Mock the resetHistoryQueryCache method
    engine.resetHistoryQueryCache = jest.fn();
    engine.startHistoryQuery = jest.fn();
    engine.stopHistoryQuery = jest.fn();

    engine['historyQueries'].set(testData.historyQueries.list[0].id, mockedHistoryQuery1);
    await engine.reloadHistoryQuery(testData.historyQueries.list[0], false);

    // Verify stopHistoryQuery was called
    expect(engine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);

    // Verify setLogger was called with the correct child logger
    expect(mockedHistoryQuery1.setLogger).toHaveBeenCalled();

    // Verify resetHistoryQueryCache was NOT called
    expect(engine.resetHistoryQueryCache).not.toHaveBeenCalled();

    // Verify startHistoryQuery was called
    expect(engine.startHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should stop, set logger, reset cache, and restart the history query when resetCache is true', async () => {
    engine['historyQueries'].set(testData.historyQueries.list[0].id, mockedHistoryQuery1);
    // Mock the resetHistoryQueryCache method
    engine.resetHistoryQueryCache = jest.fn();
    engine.startHistoryQuery = jest.fn();
    engine.stopHistoryQuery = jest.fn();

    await engine.reloadHistoryQuery(testData.historyQueries.list[0], true);

    // Verify stopHistoryQuery was called
    expect(engine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);

    // Verify setLogger was called with the correct child logger
    expect(mockedHistoryQuery1.setLogger).toHaveBeenCalled();

    // Verify resetHistoryQueryCache was called
    expect(engine.resetHistoryQueryCache).toHaveBeenCalledWith(testData.historyQueries.list[0].id);

    // Verify startHistoryQuery was called
    expect(engine.startHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should not set logger if history query is not found', async () => {
    engine['historyQueries'].set(testData.historyQueries.list[0].id, mockedHistoryQuery1);
    // Mock the resetHistoryQueryCache method
    engine.resetHistoryQueryCache = jest.fn();
    engine.startHistoryQuery = jest.fn();
    engine.stopHistoryQuery = jest.fn();

    await engine.reloadHistoryQuery(testData.historyQueries.list[0], false);

    // Verify stopHistoryQuery was still called
    expect(engine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);

    expect(engine.resetHistoryQueryCache).not.toHaveBeenCalled();

    // Verify startHistoryQuery was still called
    expect(engine.startHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should reset cache and metrics for the specified history query', async () => {
    // Add mocks to engine's maps
    engine['historyQueries'].set(testData.historyQueries.list[0].id, mockedHistoryQuery1);
    engine['historyQueryMetrics'].set(testData.historyQueries.list[0].id, historyQueryMetricsService);
    await engine.resetHistoryQueryCache(testData.historyQueries.list[0].id);

    // Verify resetCache was called on the history query
    expect(mockedHistoryQuery1.resetCache).toHaveBeenCalled();

    // Verify resetMetrics was called on the metrics service
    expect(historyQueryMetricsService.resetMetrics).toHaveBeenCalled();
  });

  it('should add content', async () => {
    await engine.start(northList, southList, historyList);

    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add time values
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[0], testData.constants.dates.DATE_1, []);
    expect(mockedNorth1.cacheContent).not.toHaveBeenCalled();
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[0], testData.constants.dates.DATE_1, []);
    expect(mockedNorth1.cacheContent).toHaveBeenCalledWith(testData.oibusContent[0], {
      itemIds: [],
      queryTime: testData.constants.dates.DATE_1,
      source: 'south',
      southId: testData.south.list[0].id
    });
  });

  it('should add external content', async () => {
    await engine.start(northList, southList, historyList);

    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add time values
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheContent).not.toHaveBeenCalled();
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheContent).toHaveBeenCalledWith(testData.oibusContent[0], { source: 'api' });
  });

  it('should do nothing if connector not set', async () => {
    await engine.startSouth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('South connector "bad id" not set');

    await engine.startNorth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('North connector "bad id" not set');
  });

  it('should log error on start failure', async () => {
    await engine.start(northList, southList, historyList);

    (mockedSouth1.start as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('start fail')));
    (mockedNorth1.start as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('start fail')));

    await engine.startSouth(testData.south.list[0].id);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting South connector "${mockedSouth1.connectorConfiguration.name}" of type "${mockedSouth1.connectorConfiguration.type}" (${mockedSouth1.connectorConfiguration.id}): start fail`
    );
    await engine.startNorth(testData.north.list[0].id);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting North connector "${mockedNorth1.connectorConfiguration.name}" of type "${mockedNorth1.connectorConfiguration.type}" (${mockedNorth1.connectorConfiguration.id}): start fail`
    );
  });

  it('should set new logger', async () => {
    await engine.start(northList, southList, historyList);

    engine.setLogger(anotherLogger);

    expect(mockedSouth1.setLogger).toHaveBeenCalled();
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'south',
      scopeId: testData.south.list[0].id,
      scopeName: testData.south.list[0].name
    });
    expect(mockedNorth1.setLogger).toHaveBeenCalled();
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'north',
      scopeId: testData.north.list[0].id,
      scopeName: testData.north.list[0].name
    });
    expect(mockedHistoryQuery1.setLogger).toHaveBeenCalled();
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'history-query',
      scopeId: testData.historyQueries.list[0].id,
      scopeName: testData.historyQueries.list[0].name
    });
  });

  it('should delete south connector', async () => {
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');

    await engine.start([], southList, []);
    await engine.deleteSouth(testData.south.list[0]);

    expect(stopSouthSpy).toHaveBeenCalled();
  });

  it('should delete north connector', async () => {
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.start(northList, [], []);
    await engine.deleteNorth(testData.north.list[0]);

    expect(stopNorthSpy).toHaveBeenCalled();
  });

  it('should delete history query', async () => {
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start([], [], historyList);
    await engine.deleteHistoryQuery(testData.historyQueries.list[0]);

    expect(stopHistoryQuerySpy).toHaveBeenCalled();
  });

  it('should manage north content files', async () => {
    await engine.start(northList, southList, historyList);

    await engine.searchCacheContent(
      'north',
      'bad id',
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedNorth1.searchCacheContent).not.toHaveBeenCalled();
    await engine.searchCacheContent(
      'north',
      testData.north.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedNorth1.searchCacheContent).toHaveBeenCalledWith(
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );

    await engine.getCacheContentFileStream('north', 'bad id', 'cache', 'file');
    expect(mockedNorth1.getCacheContentFileStream).not.toHaveBeenCalled();
    await engine.getCacheContentFileStream('north', testData.north.list[0].id, 'cache', 'file');
    expect(mockedNorth1.getCacheContentFileStream).toHaveBeenCalledWith('cache', 'file');

    (mockedNorth1.metadataFileListToCacheContentList as jest.Mock).mockReturnValue([]);
    await engine.removeCacheContent('north', 'bad id', 'cache', ['file']);
    expect(mockedNorth1.removeCacheContent).not.toHaveBeenCalled();
    expect(mockedNorth1.metadataFileListToCacheContentList).not.toHaveBeenCalled();
    await engine.removeCacheContent('north', testData.north.list[0].id, 'cache', ['file']);
    expect(mockedNorth1.metadataFileListToCacheContentList).toHaveBeenCalledWith('cache', ['file']);
    expect(mockedNorth1.removeCacheContent).toHaveBeenCalledWith('cache', []);

    await engine.removeAllCacheContent('north', 'bad id', 'cache');
    expect(mockedNorth1.removeAllCacheContent).not.toHaveBeenCalled();
    await engine.removeAllCacheContent('north', testData.north.list[0].id, 'cache');
    expect(mockedNorth1.removeAllCacheContent).toHaveBeenCalled();

    await engine.moveCacheContent('north', 'bad id', 'cache', 'error', ['file']);
    expect(mockedNorth1.moveCacheContent).not.toHaveBeenCalled();
    await engine.moveCacheContent('north', testData.north.list[0].id, 'cache', 'error', ['file']);
    expect(mockedNorth1.moveCacheContent).toHaveBeenCalledWith('cache', 'error', []);

    await engine.moveAllCacheContent('north', 'bad id', 'cache', 'error');
    expect(mockedNorth1.moveAllCacheContent).not.toHaveBeenCalled();
    await engine.moveAllCacheContent('north', testData.north.list[0].id, 'cache', 'error');
    expect(mockedNorth1.moveAllCacheContent).toHaveBeenCalledWith('cache', 'error');
  });

  it('should manage history content files', async () => {
    await engine.start([], [], historyList);

    await engine.searchCacheContent(
      'history',
      'bad id',
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedHistoryQuery1.searchCacheContent).not.toHaveBeenCalled();
    await engine.searchCacheContent(
      'history',
      testData.historyQueries.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedHistoryQuery1.searchCacheContent).toHaveBeenCalledWith(
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );

    await engine.getCacheContentFileStream('history', 'bad id', 'cache', 'file');
    expect(mockedHistoryQuery1.getCacheContentFileStream).not.toHaveBeenCalled();
    await engine.getCacheContentFileStream('history', testData.historyQueries.list[0].id, 'cache', 'file');
    expect(mockedHistoryQuery1.getCacheContentFileStream).toHaveBeenCalledWith('cache', 'file');

    await engine.removeCacheContent('history', 'bad id', 'cache', ['file']);
    expect(mockedHistoryQuery1.removeCacheContent).not.toHaveBeenCalled();
    await engine.removeCacheContent('history', testData.historyQueries.list[0].id, 'cache', ['file']);
    expect(mockedHistoryQuery1.removeCacheContent).toHaveBeenCalledWith('cache', ['file']);

    await engine.removeAllCacheContent('history', 'bad id', 'cache');
    expect(mockedHistoryQuery1.removeAllCacheContent).not.toHaveBeenCalled();
    await engine.removeAllCacheContent('history', testData.historyQueries.list[0].id, 'cache');
    expect(mockedHistoryQuery1.removeAllCacheContent).toHaveBeenCalled();

    await engine.moveCacheContent('history', 'bad id', 'cache', 'error', ['file']);
    expect(mockedHistoryQuery1.moveCacheContent).not.toHaveBeenCalled();
    await engine.moveCacheContent('history', testData.historyQueries.list[0].id, 'cache', 'error', ['file']);
    expect(mockedHistoryQuery1.moveCacheContent).toHaveBeenCalledWith('cache', 'error', ['file']);

    await engine.moveAllCacheContent('history', 'bad id', 'cache', 'error');
    expect(mockedHistoryQuery1.moveAllCacheContent).not.toHaveBeenCalled();
    await engine.moveAllCacheContent('history', testData.historyQueries.list[0].id, 'cache', 'error');
    expect(mockedHistoryQuery1.moveAllCacheContent).toHaveBeenCalledWith('cache', 'error');
  });

  it('should update north transformers associated with south', async () => {
    await engine.start(northList, [southList[0]], []);

    engine.updateNorthTransformerBySouth('badId');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(3); // 3 from startup

    engine.updateNorthTransformerBySouth('southId1');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(4); // 3 when creating North and 1 because of the update
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(mockedNorth1.connectorConfiguration.id);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(mockedNorth2.connectorConfiguration.id);
  });

  it('should update north configuration', async () => {
    await engine.start(northList, southList, historyList);

    (northConnectorRepository.findNorthById as jest.Mock).mockClear();
    engine.updateNorthConfiguration(mockedNorth1.connectorConfiguration.id);
    engine.updateNorthConfiguration('bad id');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(1);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(mockedNorth1.connectorConfiguration.id);
  });

  it('should get North', async () => {
    await engine.start(northList, southList, historyList);

    expect(engine.getNorth(testData.north.list[0].id)).toEqual(mockedNorth1);
    expect(engine.getNorth('bad id')).toBeUndefined();
  });

  it('should update scan mode', async () => {
    await engine.start(northList, southList, historyList);

    await engine.updateScanMode(testData.scanMode.list[0]);
    expect(mockedSouth1.updateScanModeIfUsed).toHaveBeenCalled();
    expect(mockedNorth1.updateScanMode).toHaveBeenCalled();
  });

  it('should properly reload', async () => {
    await engine.start([northList[0]], [southList[0]], []);

    const startSouthSpy = jest.spyOn(engine, 'startSouth');
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');
    const startNorthSpy = jest.spyOn(engine, 'startNorth');
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.reloadNorth(testData.north.list[0]);
    expect(stopNorthSpy).toHaveBeenCalled();
    expect(startNorthSpy).toHaveBeenCalled();
    expect(logger.child).toHaveBeenCalledWith({
      scopeType: 'north',
      scopeId: testData.north.list[0].id,
      scopeName: testData.north.list[0].name
    });
    (logger.child as jest.Mock).mockClear();

    await engine.reloadNorth({ ...testData.north.list[0], id: 'bad id' });
    expect(logger.child).not.toHaveBeenCalled();

    await engine.reloadSouth(testData.south.list[0]);
    expect(stopSouthSpy).toHaveBeenCalled();
    expect(startSouthSpy).toHaveBeenCalled();
    expect(logger.child).toHaveBeenCalledWith({
      scopeType: 'south',
      scopeId: testData.south.list[0].id,
      scopeName: testData.south.list[0].name
    });
    (logger.child as jest.Mock).mockClear();

    await engine.reloadSouth({ ...testData.south.list[0], id: 'bad id' });
    expect(logger.child).not.toHaveBeenCalled();

    (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValueOnce(true);
    await engine.reloadSouth(testData.south.list[0]);
    expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).toHaveBeenCalledTimes(1);
  });

  it('should properly reload south if disabled', async () => {
    await engine.start(northList, southList, historyList);
    const south = JSON.parse(JSON.stringify(testData.south.list[0])) as SouthConnectorEntity<SouthSettings, SouthItemSettings>;
    south.enabled = false;
    engine.startSouth = jest.fn();
    await engine.reloadSouth(south);
    expect(engine.startSouth).not.toHaveBeenCalled();
  });

  it('should properly reload north if disabled', async () => {
    await engine.start(northList, southList, historyList);
    const north = JSON.parse(JSON.stringify(testData.north.list[0])) as NorthConnectorEntity<NorthSettings>;
    north.enabled = false;
    engine.startNorth = jest.fn();
    await engine.reloadNorth(north);
    expect(engine.startNorth).not.toHaveBeenCalled();
  });

  it('should properly get stream', async () => {
    await engine.start(northList, southList, historyList);

    expect(engine.getNorthDataStream(mockedNorth1.connectorConfiguration.id)).not.toBeNull();
    expect(engine.getNorthDataStream('bad id')).toBeNull();

    expect(engine.getSouthDataStream(mockedSouth1.connectorConfiguration.id)).not.toBeNull();
    expect(engine.getSouthDataStream('bad id')).toBeNull();

    expect(engine.getHistoryQueryDataStream(mockedHistoryQuery1.historyQueryConfiguration.id)).not.toBeNull();
    expect(engine.getHistoryQueryDataStream('bad id')).toBeNull();
  });

  it('should properly get metrics', async () => {
    await engine.start([northList[0]], [southList[0]], []);

    expect(engine.getNorthMetrics()).toEqual({ [mockedNorth1.connectorConfiguration.id]: {} });
    expect(engine.getSouthMetrics()).toEqual({ [mockedSouth1.connectorConfiguration.id]: {} });
  });

  it('should properly reset metrics', async () => {
    await engine.start([northList[0]], [southList[0]], []);

    engine.resetNorthMetrics(mockedNorth1.connectorConfiguration.id);
    engine.resetNorthMetrics('bad id');
    expect(northConnectorMetricsService.resetMetrics).toHaveBeenCalledTimes(1);

    engine.resetSouthMetrics(mockedSouth1.connectorConfiguration.id);
    engine.resetSouthMetrics('bad id');
    expect(southConnectorMetricsService.resetMetrics).toHaveBeenCalledTimes(1);
  });

  it('should properly reload items', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (mockedSouth1.isEnabled as jest.Mock).mockReturnValueOnce(true);
    (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValueOnce(true);
    (mockedSouth1.queriesFile as unknown as jest.Mock).mockReturnValueOnce(true);
    (mockedSouth1.queriesSubscription as unknown as jest.Mock).mockReturnValueOnce(true);
    await engine.start([], southList, []);
    await engine.reloadSouthItems(testData.south.list[0]);
    expect(mockedSouth1.queriesHistory).toHaveBeenCalledTimes(2);
    expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.queriesLastPoint).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.queriesFile).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.updateCronJobs).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.queriesSubscription).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.updateSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('should properly reload items but do not update cron jobs, subscriptions or max instant', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (mockedSouth1.isEnabled as jest.Mock).mockReturnValueOnce(true);
    (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValueOnce(false);
    (mockedSouth1.queriesFile as unknown as jest.Mock).mockReturnValueOnce(false);
    (mockedSouth1.queriesSubscription as unknown as jest.Mock).mockReturnValueOnce(false);
    await engine.start([], southList, []);
    await engine.reloadSouthItems(testData.south.list[0]);
    expect(mockedSouth1.updateSouthCacheOnScanModeAndMaxInstantChanges).not.toHaveBeenCalled();
    expect(mockedSouth1.updateCronJobs).not.toHaveBeenCalled();
    expect(mockedSouth1.updateSubscriptions).not.toHaveBeenCalled();
  });

  it('should not reload items if disabled', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (mockedSouth1.isEnabled as jest.Mock).mockReturnValueOnce(false);
    (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValueOnce(false);
    (mockedSouth1.queriesFile as unknown as jest.Mock).mockReturnValueOnce(false);
    (mockedSouth1.queriesSubscription as unknown as jest.Mock).mockReturnValueOnce(false);
    await engine.start([], southList, []);
    await engine.reloadSouthItems(testData.south.list[0]);
    expect(mockedSouth1.queriesHistory).not.toHaveBeenCalled();
    expect(mockedSouth1.queriesFile).not.toHaveBeenCalled();
    expect(mockedSouth1.queriesSubscription).not.toHaveBeenCalled();
  });

  it('should properly do nothing when reloading items if south nor found', async () => {
    await engine.reloadSouthItems(testData.south.list[0]);
    expect(southConnectorRepository.findSouthById).not.toHaveBeenCalled();
  });

  it('should properly delete cache folder', async () => {
    (filesExists as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
    (fs.rm as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('fs rm error');
      });
    await engine['deleteCacheFolder']('south', 'connectorId', 'connectorName');
    expect(filesExists).toHaveBeenCalledTimes(3);
    expect(logger.trace).toHaveBeenCalledTimes(3);
    expect(logger.trace).toHaveBeenCalledWith(
      `Deleting folder "${path.resolve('cache', 'south-connectorId')}" for connector "connectorName" (south - connectorId)`
    );
    expect(filesExists).toHaveBeenCalledWith(path.resolve('cache', 'south-connectorId'));
    expect(filesExists).toHaveBeenCalledWith(path.resolve('archive', 'south-connectorId'));
    expect(filesExists).toHaveBeenCalledWith(path.resolve('error', 'south-connectorId'));
    expect(fs.rm).toHaveBeenCalledTimes(2);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('cache', 'south-connectorId'), { recursive: true });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Unable to delete cache folder "${path.resolve('archive', 'south-connectorId')}" for connector "connectorName" (south - connectorId): fs rm error`
    );
  });
});
