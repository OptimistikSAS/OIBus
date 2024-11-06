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
  const mockedSouth1: SouthConnector<SouthSettings, SouthItemSettings> = new SouthConnectorMock(testData.south.list[0]);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

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
    mockedNorth1.metricsEvent.emit('send-values', {});
    expect(emitSpy).toHaveBeenCalledWith('north-send-values', {});
    mockedNorth1.metricsEvent.emit('send-file', {});
    expect(emitSpy).toHaveBeenCalledWith('north-send-file', {});
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
});

describe('HistoryQuery disabled', () => {
  let historyQuery: HistoryQuery;
  const mockedNorth1 = new NorthConnectorMock(testData.north.list[0]) as unknown as NorthConnector<NorthSettings>;
  const mockedSouth1: SouthConnector<SouthSettings, SouthItemSettings> = new SouthConnectorMock(testData.south.list[0]);

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
});
