import HistoryQuery from './history-query';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import { OIBusTimeValue } from '../../shared/model/engine.model';
import testData from '../tests/utils/test-data';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import NorthConnector from '../north/north-connector';
import { NorthSettings } from '../../shared/model/north-settings.model';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import { flushPromises, mockBaseFolders } from '../tests/utils/test-utils';
import HistoryQueryMetricsServiceMock from '../tests/__mocks__/service/metrics/history-query-metrics-service.mock';
import { createBaseFolders } from '../service/utils';
import path from 'node:path';

jest.mock('../service/south.service');
jest.mock('../service/north.service');

const historyQueryMetricsServiceMock = new HistoryQueryMetricsServiceMock();
jest.mock(
  '../service/metrics/history-query-metrics.service',
  () =>
    function () {
      return historyQueryMetricsServiceMock;
    }
);
jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();

describe('HistoryQuery enabled', () => {
  let historyQuery: HistoryQuery;
  const mockedNorth1 = new NorthConnectorMock(testData.north.list[0]) as unknown as NorthConnector<NorthSettings>;
  const mockedSouth1 = new SouthConnectorMock(testData.south.list[0]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['performance'] }).setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (southService.runSouth as jest.Mock).mockReturnValue(mockedSouth1);
    (northService.runNorth as jest.Mock).mockReturnValue(mockedNorth1);

    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);

    historyQuery = new HistoryQuery(
      testData.historyQueries.list[0],
      southService,
      northService,
      historyQueryRepository,
      mockBaseFolders(testData.historyQueries.list[0].id),
      logger
    );
  });

  afterEach(() => {
    mockedSouth1.connectedEvent.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();

    expect(historyQuery.settings).toBeDefined();
    expect(createBaseFolders).toHaveBeenCalledWith(mockBaseFolders(path.join(testData.historyQueries.list[0].id, 'south')));
    expect(createBaseFolders).toHaveBeenCalledWith(mockBaseFolders(path.join(testData.historyQueries.list[0].id, 'north')));
    expect(mockedNorth1.start).toHaveBeenCalledTimes(1);
  });

  it('should start south connector', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    (mockedSouth1.historyQueryHandler as jest.Mock).mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    await historyQuery.start();
    mockedSouth1.connectedEvent.emit('connected');
    expect(mockedSouth1.start).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.historyQueryHandler).toHaveBeenCalledWith(
      testData.historyQueries.list[0].items.map(item => ({ ...item, scanModeId: 'history' })),
      testData.historyQueries.list[0].startTime,
      testData.historyQueries.list[0].endTime,
      'history',
      { maxReadInterval: 3600, overlap: 0 },
      false,
      0
    );
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    mockedSouth1.connectedEvent.emit('connected');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should start south connector with error', async () => {
    (mockedSouth1.historyQueryHandler as jest.Mock)
      .mockImplementationOnce(() => {
        return new Promise((_resolve, reject) => {
          reject('error');
        });
      })
      .mockImplementationOnce(() => {
        return new Promise((_resolve, reject) => {
          reject('error');
        });
      })
      .mockImplementation(() => {
        return new Promise(resolve => {
          resolve('');
        });
      });
    await historyQuery.start();
    expect(mockedSouth1.start).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.start).toHaveBeenCalledTimes(1);

    mockedSouth1.connectedEvent.emit('connected');

    await flushPromises();
    expect(mockedSouth1.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.historyQueryHandler).toHaveBeenCalledWith(
      testData.historyQueries.list[0].items.map(item => ({ ...item, scanModeId: 'history' })),
      testData.historyQueries.list[0].startTime,
      testData.historyQueries.list[0].endTime,
      'history',
      { maxReadInterval: 3600, overlap: 0 },
      false,
      0
    );

    expect(mockedSouth1.start).toHaveBeenCalledTimes(2);
    expect(mockedSouth1.stop).toHaveBeenCalledTimes(1);

    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce({
      ...testData.historyQueries.list[0],
      status: 'PENDING'
    });

    mockedSouth1.connectedEvent.emit('connected');
    await flushPromises();

    expect(mockedSouth1.start).toHaveBeenCalledTimes(2);
    expect(mockedSouth1.stop).toHaveBeenCalledTimes(1);
  });

  it('should cache values', async () => {
    await historyQuery.start();

    await historyQuery.addContent('southId', { type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    expect(mockedNorth1.cacheContent).toHaveBeenCalledWith({ type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> }, 'southId');
  });

  it('should cache file', async () => {
    await historyQuery.start();

    await historyQuery.addContent('southId', { type: 'any', filePath: 'myFile' });
    expect(mockedNorth1.cacheContent).toHaveBeenCalledWith({ type: 'any', filePath: 'myFile' }, 'southId');
  });

  it('should properly stop', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    let southConnectedEventRemoved!: number;
    let southStopCalled!: number;
    let southMetricsEventRemoved!: number;

    let northStopCalled!: number;
    let northMetricsEventRemoved!: number;

    // hook into south calls
    // @ts-expect-error overriding method
    mockedSouth1.connectedEvent.removeAllListeners = () => {
      southConnectedEventRemoved = performance.now();
    };
    (mockedSouth1.stop as jest.Mock).mockImplementationOnce(async () => {
      southStopCalled = performance.now();
    });
    // @ts-expect-error overriding method
    mockedSouth1.metricsEvent.removeAllListeners = () => {
      southMetricsEventRemoved = performance.now();
    };

    // hook into north calls
    (mockedNorth1.stop as jest.Mock).mockImplementationOnce(async () => {
      northStopCalled = performance.now();
    });
    // @ts-expect-error overriding method
    mockedNorth1.metricsEvent.removeAllListeners = () => {
      northMetricsEventRemoved = performance.now();
    };

    await historyQuery.start();
    mockedSouth1.connectedEvent.emit('connected');
    await historyQuery.stop();

    // make sure function are called in a specific order
    const expectedOrder = [
      southConnectedEventRemoved,
      southStopCalled,
      southMetricsEventRemoved,

      northStopCalled,
      northMetricsEventRemoved
    ];
    // if the order above is correct, it will equal to the sorted array
    expect(expectedOrder).toEqual(expectedOrder.slice().sort((a, b) => a - b));

    // safety check for mocking time
    // if sometimes in the future we mess with how we mock time, and accidentally mock `performance.now`
    // all calls to `now` will result in '0', and this will throw an error
    expect(expectedOrder.reduce((val, sum) => val + sum, 0)).not.toEqual(0);

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.stop).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.stop).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.resetCache).not.toHaveBeenCalled();
    expect(mockedSouth1.resetCache).not.toHaveBeenCalled();

    await historyQuery.stop();
    expect(logger.debug).not.toHaveBeenCalled();

    await historyQuery.resetCache();
    expect(mockedNorth1.resetCache).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.resetCache).toHaveBeenCalledTimes(1);
  });

  it('should properly finish and not stop', async () => {
    historyQuery.stop = jest.fn();
    mockedSouth1.historyIsRunning = true;
    (mockedNorth1.isCacheEmpty as jest.Mock).mockReturnValueOnce(false).mockReturnValue(true);

    await historyQuery.start();
    await historyQuery.finish();

    expect(logger.debug).toHaveBeenCalledWith(`History query "${testData.historyQueries.list[0].name}" is still running`);
    await historyQuery.finish();
    expect(logger.debug).toHaveBeenCalledTimes(2);

    mockedSouth1.historyIsRunning = false;
    await historyQuery.finish();
    expect(logger.info).toHaveBeenCalledWith(`Finish "${testData.historyQueries.list[0].name}" (${testData.historyQueries.list[0].id})`);
  });

  it('should properly set another logger', async () => {
    historyQuery.stop = jest.fn();
    historyQuery.setLogger(anotherLogger);
    await historyQuery.finish();
    expect(anotherLogger.info).toHaveBeenCalledTimes(1);
  });

  it('should listen on metrics', async () => {
    const emitSpy = jest.spyOn(historyQuery.metricsEvent, 'emit');

    await historyQuery.start();
    mockedNorth1.metricsEvent.emit('connect', {});
    expect(emitSpy).toHaveBeenCalledWith('north-connect', {});
    mockedNorth1.metricsEvent.emit('run-start', {});
    expect(emitSpy).toHaveBeenCalledWith('north-run-start', {});
    mockedNorth1.metricsEvent.emit('run-end', {});
    expect(emitSpy).toHaveBeenCalledWith('north-run-end', {});
    mockedNorth1.metricsEvent.emit('cache-size', {});
    expect(emitSpy).toHaveBeenCalledWith('north-cache-size', {});
    mockedNorth1.metricsEvent.emit('cache-content-size', 123);
    expect(emitSpy).toHaveBeenCalledWith('north-cache-content-size', 123);
    mockedSouth1.metricsEvent.emit('connect', {});
    expect(emitSpy).toHaveBeenCalledWith('south-connect', {});
    mockedSouth1.metricsEvent.emit('run-start', {});
    expect(emitSpy).toHaveBeenCalledWith('south-run-start', {});
    mockedSouth1.metricsEvent.emit('run-end', {});
    expect(emitSpy).toHaveBeenCalledWith('south-run-end', {});
    mockedSouth1.metricsEvent.emit('history-query-start', {});
    expect(emitSpy).toHaveBeenCalledWith('south-history-query-start', {});
    mockedSouth1.metricsEvent.emit('history-query-interval', {});
    expect(emitSpy).toHaveBeenCalledWith('south-history-query-interval', {});
    mockedSouth1.metricsEvent.emit('history-query-stop', {});
    expect(emitSpy).toHaveBeenCalledWith('south-history-query-stop', {});
    mockedSouth1.metricsEvent.emit('add-values', {});
    expect(emitSpy).toHaveBeenCalledWith('south-add-values', {});
    mockedSouth1.metricsEvent.emit('add-file', {});
    expect(emitSpy).toHaveBeenCalledWith('south-add-file', {});
  });

  it('should manage cache', async () => {
    await historyQuery.searchCacheContent(
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedNorth1.searchCacheContent).not.toHaveBeenCalled();
    await historyQuery.getCacheContentFileStream('cache', 'file');
    expect(mockedNorth1.searchCacheContent).not.toHaveBeenCalled();
    await historyQuery.removeCacheContent('cache', ['file']);
    expect(mockedNorth1.removeCacheContent).not.toHaveBeenCalled();
    expect(mockedNorth1.metadataFileListToCacheContentList).not.toHaveBeenCalled();
    await historyQuery.removeAllCacheContent('cache');
    expect(mockedNorth1.removeAllCacheContent).not.toHaveBeenCalled();
    await historyQuery.moveCacheContent('cache', 'error', ['file']);
    expect(mockedNorth1.moveCacheContent).not.toHaveBeenCalled();
    await historyQuery.moveAllCacheContent('cache', 'error');
    expect(mockedNorth1.moveAllCacheContent).not.toHaveBeenCalled();

    await historyQuery.start();
    await historyQuery.searchCacheContent(
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedNorth1.searchCacheContent).toHaveBeenCalledWith(
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    await historyQuery.getCacheContentFileStream('cache', 'file');
    expect(mockedNorth1.getCacheContentFileStream).toHaveBeenCalledWith('cache', 'file');
    (mockedNorth1.metadataFileListToCacheContentList as jest.Mock).mockReturnValue([]);
    await historyQuery.removeCacheContent('cache', ['file']);
    expect(mockedNorth1.metadataFileListToCacheContentList).toHaveBeenCalledWith('cache', ['file']);
    expect(mockedNorth1.removeCacheContent).toHaveBeenCalledWith('cache', []);
    await historyQuery.removeAllCacheContent('cache');
    expect(mockedNorth1.removeAllCacheContent).toHaveBeenCalled();
    await historyQuery.moveCacheContent('cache', 'error', ['file']);
    expect(mockedNorth1.moveCacheContent).toHaveBeenCalledWith('cache', 'error', []);
    await historyQuery.moveAllCacheContent('cache', 'error');
    expect(mockedNorth1.moveAllCacheContent).toHaveBeenCalledWith('cache', 'error');
  });
});

describe('HistoryQuery disabled', () => {
  let historyQuery: HistoryQuery;
  const mockedNorth1 = new NorthConnectorMock(testData.north.list[0]) as unknown as NorthConnector<NorthSettings>;
  const mockedSouth1 = new SouthConnectorMock(testData.south.list[0]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    mockedSouth1.connectedEvent.removeAllListeners();

    (southService.runSouth as jest.Mock).mockReturnValue(mockedSouth1);
    (northService.runNorth as jest.Mock).mockReturnValue(mockedNorth1);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[1]);

    historyQuery = new HistoryQuery(
      testData.historyQueries.list[0],
      southService,
      northService,
      historyQueryRepository,
      mockBaseFolders(testData.historyQueries.list[1].id),
      logger
    );
  });

  afterEach(() => {
    mockedSouth1.connectedEvent.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();
    expect(logger.trace).toHaveBeenCalledWith(`History Query "${testData.historyQueries.list[1].name}" not enabled`);
    expect(mockedNorth1.start).not.toHaveBeenCalled();
    expect(mockedNorth1.connect).not.toHaveBeenCalled();
  });

  it('should not cache values if north is not defined', async () => {
    await historyQuery.addContent('southId', { type: 'time-values', content: [] });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should not cache file if north is not defined', async () => {
    await historyQuery.addContent('southId', { type: 'any', filePath: 'filePath' });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should properly stop', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await historyQuery.stop();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    expect(mockedSouth1.stop).not.toHaveBeenCalled();
    expect(mockedSouth1.resetCache).not.toHaveBeenCalled();
    expect(mockedNorth1.stop).not.toHaveBeenCalled();
    expect(mockedNorth1.resetCache).not.toHaveBeenCalled();
  });
});
