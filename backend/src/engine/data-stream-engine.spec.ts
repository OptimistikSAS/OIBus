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
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/log/south-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsService from '../service/metrics/north-connector-metrics.service';
import NorthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/north-connector-metrics-service.mock';
import SouthConnectorMetricsService from '../service/metrics/south-connector-metrics.service';
import SouthConnectorMetricsServiceMock from '../tests/__mocks__/service/metrics/south-connector-metrics-service.mock';

jest.mock('../south/south-mqtt/south-mqtt');
jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('../service/utils');
jest.mock('node:fs/promises');

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

const southConnectorMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const northConnectorMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

describe('DataStreamEngine', () => {
  let engine: DataStreamEngine;
  const mockedNorth1 = new NorthConnectorMock(testData.north.list[0]) as unknown as NorthConnector<NorthSettings>;
  const mockedNorth2 = new NorthConnectorMock(testData.north.list[1]) as unknown as NorthConnector<NorthSettings>;
  const mockedSouth1 = new SouthConnectorMock(testData.south.list[0]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;
  const mockedSouth2 = new SouthConnectorMock(testData.south.list[1]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (logger.child as jest.Mock).mockReturnValue(logger);

    engine = new DataStreamEngine(northConnectorMetricsRepository, southConnectorMetricsRepository, logger);
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

    mockedNorth2['settings']['enabled'] = true;
    mockedSouth2['settings']['enabled'] = true;
    await engine.start([mockedNorth1, mockedNorth2], [mockedSouth1, mockedSouth2]);

    expect(engine.baseFolders).toBeDefined();
    expect(Object.keys(engine.baseFolders).sort()).toEqual(['archive', 'cache', 'error'].sort());
    expect(engine.logger).toBeDefined();
    expect(engine.baseFolders).toBeDefined();
    expect(logger.info).toHaveBeenCalledWith(`OIBus engine started`);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating North connector "${testData.north.list[1].name}" of type "${testData.north.list[1].type}" (${
        testData.north.list[1].id
      }): ${new Error('North error')}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating South connector "${testData.south.list[1].name}" of type "${testData.south.list[1].type}" (${
        testData.south.list[1].id
      }): ${new Error('South error')}`
    );

    mockedSouth1.connectedEvent.emit('connected');
    expect(mockedSouth1.onItemChange).toHaveBeenCalled();

    await engine.stop();

    expect(mockedNorth1.stop).toHaveBeenCalledTimes(1);
  });

  it('should add content', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    (mockedNorth1.isSubscribed as jest.Mock).mockReturnValue(true);
    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add time values
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheContent).not.toHaveBeenCalled();
    await engine.addContent(testData.south.list[0].id, testData.oibusContent[0]);
    expect(mockedNorth1.cacheContent).toHaveBeenCalledWith(testData.oibusContent[0], testData.south.list[0].id);
  });

  it('should add external content', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    (mockedNorth1.isEnabled as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    // Add time values
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0], 'api');
    expect(mockedNorth1.cacheContent).not.toHaveBeenCalled();
    await engine.addExternalContent(testData.north.list[0].id, testData.oibusContent[0], 'api');
    expect(mockedNorth1.cacheContent).toHaveBeenCalledWith(testData.oibusContent[0], 'api');
  });

  it('should do nothing if connector not set', async () => {
    await engine.startSouth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('South connector bad id not set');

    await engine.startNorth('bad id');
    expect(logger.trace).toHaveBeenCalledWith('North connector bad id not set');
  });

  it('should log error on start failure', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    (mockedSouth1.start as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('start fail')));
    (mockedNorth1.start as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('start fail')));

    await engine.startSouth(testData.south.list[0].id);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting South connector "${mockedSouth1.settings.name}" of type "${mockedSouth1.settings.type}" (${mockedSouth1.settings.id}): start fail`
    );
    await engine.startNorth(testData.north.list[0].id);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting North connector "${mockedNorth1.settings.name}" of type "${mockedNorth1.settings.type}" (${mockedNorth1.settings.id}): start fail`
    );
  });

  it('should set new logger', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

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
  });

  it('should delete south connector', async () => {
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');

    await engine.start([], [mockedSouth1, mockedSouth2]);
    await engine.deleteSouth(testData.south.list[0]);

    expect(stopSouthSpy).toHaveBeenCalled();
  });

  it('should delete north connector', async () => {
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.start([mockedNorth1, mockedNorth2], []);
    await engine.deleteNorth(testData.north.list[0]);

    expect(stopNorthSpy).toHaveBeenCalled();
  });

  it('should manage content files', async () => {
    await engine.start([mockedNorth1], []);

    await engine.searchCacheContent(
      'bad id',
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedNorth1.searchCacheContent).not.toHaveBeenCalled();
    await engine.searchCacheContent(
      testData.north.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedNorth1.searchCacheContent).toHaveBeenCalledWith(
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );

    await engine.getCacheContentFileStream('bad id', 'cache', 'file');
    expect(mockedNorth1.getCacheContentFileStream).not.toHaveBeenCalled();
    await engine.getCacheContentFileStream(testData.north.list[0].id, 'cache', 'file');
    expect(mockedNorth1.getCacheContentFileStream).toHaveBeenCalledWith('cache', 'file');

    (mockedNorth1.metadataFileListToCacheContentList as jest.Mock).mockReturnValue([]);
    await engine.removeCacheContent('bad id', 'cache', ['file']);
    expect(mockedNorth1.removeCacheContent).not.toHaveBeenCalled();
    expect(mockedNorth1.metadataFileListToCacheContentList).not.toHaveBeenCalled();
    await engine.removeCacheContent(testData.north.list[0].id, 'cache', ['file']);
    expect(mockedNorth1.metadataFileListToCacheContentList).toHaveBeenCalledWith('cache', ['file']);
    expect(mockedNorth1.removeCacheContent).toHaveBeenCalledWith('cache', []);

    await engine.removeAllCacheContent('bad id', 'cache');
    expect(mockedNorth1.removeAllCacheContent).not.toHaveBeenCalled();
    await engine.removeAllCacheContent(testData.north.list[0].id, 'cache');
    expect(mockedNorth1.removeAllCacheContent).toHaveBeenCalled();

    await engine.moveCacheContent('bad id', 'cache', 'error', ['file']);
    expect(mockedNorth1.moveCacheContent).not.toHaveBeenCalled();
    await engine.moveCacheContent(testData.north.list[0].id, 'cache', 'error', ['file']);
    expect(mockedNorth1.moveCacheContent).toHaveBeenCalledWith('cache', 'error', []);

    await engine.moveAllCacheContent('bad id', 'cache', 'error');
    expect(mockedNorth1.moveAllCacheContent).not.toHaveBeenCalled();
    await engine.moveAllCacheContent(testData.north.list[0].id, 'cache', 'error');
    expect(mockedNorth1.moveAllCacheContent).toHaveBeenCalledWith('cache', 'error');
  });

  it('should manage item change', async () => {
    await engine.start([], [mockedSouth1]);

    await engine.reloadItems('bad id');
    expect(mockedSouth1.onItemChange).not.toHaveBeenCalled();
    await engine.reloadItems(testData.south.list[0].id);
    expect(mockedSouth1.onItemChange).toHaveBeenCalled();
  });

  it('should update north subscriptions', async () => {
    await engine.start([mockedNorth1, mockedNorth2], [mockedSouth1]);

    engine.updateSubscriptions();
    expect(mockedNorth1.updateConnectorSubscription).toHaveBeenCalledTimes(1);
    expect(mockedNorth2.updateConnectorSubscription).toHaveBeenCalledTimes(1);
  });

  it('should update north subscription', async () => {
    await engine.start([mockedNorth1, mockedNorth2], [mockedSouth1]);

    engine.updateSubscription(testData.north.list[0].id);
    expect(mockedNorth1.updateConnectorSubscription).toHaveBeenCalledTimes(1);
    expect(mockedNorth2.updateConnectorSubscription).toHaveBeenCalledTimes(0);
    engine.updateSubscription('bad id');
    expect(mockedNorth1.updateConnectorSubscription).toHaveBeenCalledTimes(1);
    expect(mockedNorth2.updateConnectorSubscription).toHaveBeenCalledTimes(0);
  });

  it('should get North', async () => {
    await engine.start([mockedNorth1], []);

    expect(engine.getNorth(testData.north.list[0].id)).toEqual(mockedNorth1);
    expect(engine.getNorth('bad id')).toBeUndefined();
  });

  it('should update scan mode', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    await engine.updateScanMode(testData.scanMode.list[0]);
    expect(mockedSouth1.updateScanMode).toHaveBeenCalled();
    expect(mockedNorth1.updateScanMode).toHaveBeenCalled();
  });

  it('should properly reload', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    const startSouthSpy = jest.spyOn(engine, 'startSouth');
    const stopSouthSpy = jest.spyOn(engine, 'stopSouth');
    const startNorthSpy = jest.spyOn(engine, 'startNorth');
    const stopNorthSpy = jest.spyOn(engine, 'stopNorth');

    await engine.reloadNorth(testData.north.list[0]);
    expect(stopNorthSpy).toHaveBeenCalled();
    expect(startNorthSpy).toHaveBeenCalled();
    expect(logger.child).toHaveBeenCalledTimes(1);
    await engine.reloadNorth({ ...testData.north.list[0], id: 'bad id' });
    expect(logger.child).toHaveBeenCalledTimes(1);

    await engine.reloadSouth(testData.south.list[0]);
    expect(stopSouthSpy).toHaveBeenCalled();
    expect(startSouthSpy).toHaveBeenCalled();
    expect(logger.child).toHaveBeenCalledTimes(2);
    await engine.reloadSouth({ ...testData.south.list[0], id: 'bad id' });
    expect(logger.child).toHaveBeenCalledTimes(2);
    expect(mockedSouth1.manageSouthCacheOnChange).not.toHaveBeenCalled();

    (mockedSouth1.queriesHistory as unknown as jest.Mock).mockReturnValueOnce(true);
    await engine.reloadSouth(testData.south.list[0]);
    expect(mockedSouth1.manageSouthCacheOnChange).toHaveBeenCalledTimes(1);
  });

  it('should properly get stream', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    expect(engine.getNorthDataStream(mockedNorth1.settings.id)).not.toBeNull();
    expect(engine.getNorthDataStream('bad id')).toBeNull();

    expect(engine.getSouthDataStream(mockedSouth1.settings.id)).not.toBeNull();
    expect(engine.getSouthDataStream('bad id')).toBeNull();
  });

  it('should properly get metrics', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    expect(engine.getNorthConnectorMetrics()).toEqual({ [mockedNorth1.settings.id]: {} });
    expect(engine.getSouthConnectorMetrics()).toEqual({ [mockedSouth1.settings.id]: {} });
  });

  it('should properly reset metrics', async () => {
    await engine.start([mockedNorth1], [mockedSouth1]);

    engine.resetNorthConnectorMetrics(mockedNorth1.settings.id);
    engine.resetNorthConnectorMetrics('bad id');
    expect(northConnectorMetricsService.resetMetrics).toHaveBeenCalledTimes(1);

    engine.resetSouthConnectorMetrics(mockedSouth1.settings.id);
    engine.resetSouthConnectorMetrics('bad id');
    expect(southConnectorMetricsService.resetMetrics).toHaveBeenCalledTimes(1);
  });
});
