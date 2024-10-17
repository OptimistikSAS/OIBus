import HistoryQuery from './history-query';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import { createFolder } from '../service/utils';

import pino from 'pino';
import path from 'node:path';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import testData from '../tests/utils/test-data';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/log/south-metrics-repository.mock';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnector from '../north/north-connector';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import Stream from 'node:stream';
import { flushPromises } from '../tests/utils/test-utils';

jest.mock('../service/south.service');
jest.mock('../service/north.service');
const updateMetrics = jest.fn();
const resetMetrics = jest.fn();
jest.mock(
  '../service/history-metrics.service',
  () =>
    function () {
      return {
        updateMetrics,
        resetMetrics,
        metrics: { status: 'my status' },
        get stream() {
          return { stream: 'myStream' };
        }
      };
    }
);
jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const northMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();

describe('HistoryQuery enabled', () => {
  let historyQuery: HistoryQuery;
  const southStream = new Stream();
  const northStream = new Stream();
  const mockedNorth1: NorthConnector<NorthSettings> = new NorthConnectorMock(testData.north.list[0]);
  const mockedSouth1: SouthConnector<SouthSettings, SouthItemSettings> = new SouthConnectorMock(testData.south.list[0]);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (southService.runSouth as jest.Mock).mockReturnValue(mockedSouth1);
    (northService.runNorth as jest.Mock).mockReturnValue(mockedNorth1);

    (mockedSouth1.getMetricsDataStream as jest.Mock).mockImplementation(() => southStream);
    (mockedNorth1.getMetricsDataStream as jest.Mock).mockImplementation(() => northStream);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);

    historyQuery = new HistoryQuery(
      testData.historyQueries.list[0],
      southService,
      northService,
      southMetricsRepository,
      northMetricsRepository,
      historyQueryRepository,
      path.resolve('baseFolder', testData.historyQueries.list[0].id),
      logger
    );
  });

  afterEach(() => {
    mockedSouth1.connectedEvent.removeAllListeners();
    southStream.removeAllListeners();
    northStream.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();

    expect(historyQuery.settings).toBeDefined();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', testData.historyQueries.list[0].id, 'south'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', testData.historyQueries.list[0].id, 'north'));
    expect(mockedNorth1.start).toHaveBeenCalledTimes(1);

    northStream.emit('data', `data: ${JSON.stringify({})}`);
    southStream.emit('data', `data: ${JSON.stringify({})}`);
    expect(updateMetrics).toHaveBeenCalledTimes(2);
    expect(updateMetrics).toHaveBeenCalledWith({ status: 'my status', south: {} });
    expect(updateMetrics).toHaveBeenCalledWith({ status: 'my status', north: {} });
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
      'history'
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
      'history'
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
    expect(logger.info).toHaveBeenCalledWith(
      `Add 2 values from History Query "${testData.historyQueries.list[0].name}" to north connector`
    );
    expect(mockedNorth1.cacheValues).toHaveBeenCalledWith([{}, {}]);
  });

  it('should cache file', async () => {
    await historyQuery.start();

    await historyQuery.addContent('southId', { type: 'raw', filePath: 'myFile' });
    expect(logger.info).toHaveBeenCalledWith(
      `Add file "myFile" from History Query "${testData.historyQueries.list[0].name}" to north connector`
    );
    expect(mockedNorth1.cacheFile).toHaveBeenCalledWith('myFile');
  });

  it('should properly stop', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await historyQuery.start();
    mockedSouth1.connectedEvent.emit('connected');
    await historyQuery.stop();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.stop).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.stop).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.resetCache).not.toHaveBeenCalled();
    expect(mockedSouth1.resetCache).not.toHaveBeenCalled();
    expect(resetMetrics).not.toHaveBeenCalled();

    await historyQuery.stop();
    expect(logger.debug).not.toHaveBeenCalled();

    await historyQuery.resetCache();
    expect(resetMetrics).toHaveBeenCalled();
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
});

describe('HistoryQuery disabled', () => {
  let historyQuery: HistoryQuery;
  const southStream = new Stream();
  const northStream = new Stream();
  const mockedNorth1: NorthConnector<NorthSettings> = new NorthConnectorMock(testData.north.list[0]);
  const mockedSouth1: SouthConnector<SouthSettings, SouthItemSettings> = new SouthConnectorMock(testData.south.list[0]);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    mockedSouth1.connectedEvent.removeAllListeners();

    (southService.runSouth as jest.Mock).mockReturnValue(mockedSouth1);
    (northService.runNorth as jest.Mock).mockReturnValue(mockedNorth1);
    (mockedSouth1.getMetricsDataStream as jest.Mock).mockImplementation(() => southStream);
    (mockedNorth1.getMetricsDataStream as jest.Mock).mockImplementation(() => northStream);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[1]);

    historyQuery = new HistoryQuery(
      testData.historyQueries.list[0],
      southService,
      northService,
      southMetricsRepository,
      northMetricsRepository,
      historyQueryRepository,
      'baseFolder',
      logger
    );
  });

  afterEach(() => {
    mockedSouth1.connectedEvent.removeAllListeners();
    southStream.removeAllListeners();
    northStream.removeAllListeners();
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
    await historyQuery.addContent('southId', { type: 'raw', filePath: 'filePath' });
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

  it('should get stream', () => {
    expect(historyQuery.getMetricsDataStream()).toEqual({ stream: 'myStream' });
  });
});
