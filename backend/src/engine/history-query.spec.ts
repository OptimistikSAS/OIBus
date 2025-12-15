import HistoryQuery from './history-query';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

import pino from 'pino';
import testData from '../tests/utils/test-data';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import NorthConnector from '../north/north-connector';
import { NorthSettings } from '../../shared/model/north-settings.model';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import { flushPromises } from '../tests/utils/test-utils';
import OIAnalyticsMessageService from '../service/oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';

jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const oianalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

describe('HistoryQuery enabled', () => {
  let historyQuery: HistoryQuery;
  const mockedNorth1 = new NorthConnectorMock(testData.north.list[0]) as unknown as NorthConnector<NorthSettings>;
  const mockedSouth1 = new SouthConnectorMock(testData.south.list[0]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['performance'] }).setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (historyQueryRepository.findHistoryById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);

    historyQuery = new HistoryQuery(testData.historyQueries.list[0], mockedNorth1, mockedSouth1, logger);
  });

  afterEach(() => {
    mockedSouth1.connectedEvent.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();

    expect(mockedNorth1.start).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.start).toHaveBeenCalledTimes(1);
    expect(historyQuery.historyQueryConfiguration).toEqual(testData.historyQueries.list[0]);
  });

  it('should not start if not running', async () => {
    historyQuery['historyConfiguration'].status = 'FINISHED';
    await historyQuery.start();
    expect(logger.trace).toHaveBeenCalledWith(`History Query "${testData.historyQueries.list[0].name}" not enabled`);
    historyQuery['historyConfiguration'].status = 'RUNNING';
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
      testData.historyQueries.list[0].items.map(item => ({
        ...item,
        scanMode: {
          cron: '',
          description: '',
          id: 'history',
          name: 'history'
        }
      })),
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
      testData.historyQueries.list[0].items.map(item => ({
        ...item,
        scanMode: {
          cron: '',
          description: '',
          id: 'history',
          name: 'history'
        }
      })),
      testData.historyQueries.list[0].startTime,
      testData.historyQueries.list[0].endTime,
      'history',
      { maxReadInterval: 3600, overlap: 0 },
      false,
      0
    );

    expect(mockedSouth1.start).toHaveBeenCalledTimes(2);
    expect(mockedSouth1.stop).toHaveBeenCalledTimes(1);

    historyQuery.historyQueryConfiguration = { ...testData.historyQueries.list[0], status: 'PENDING' };
    mockedSouth1.connectedEvent.emit('connected');
    await flushPromises();

    expect(mockedSouth1.start).toHaveBeenCalledTimes(2);
    expect(mockedSouth1.stop).toHaveBeenCalledTimes(1);
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

    expect(logger.trace).toHaveBeenCalledWith(`History query "${testData.historyQueries.list[0].name}" is still running`);
    expect(oianalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).not.toHaveBeenCalled();
    await historyQuery.finish();
    expect(logger.trace).toHaveBeenCalledTimes(2);

    mockedSouth1.historyIsRunning = false;
    await historyQuery.finish();
    expect(logger.info).toHaveBeenCalledWith(
      `Finish History query "${testData.historyQueries.list[0].name}" (${testData.historyQueries.list[0].id})`
    );
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
