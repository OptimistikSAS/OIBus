import HistoryQuery from './history-query';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import { createFolder } from '../service/utils';

import pino from 'pino';
import path from 'node:path';
import HistoryServiceMock from '../tests/__mocks__/service/history-query-service.mock';
import HistoryQueryService from '../service/history-query.service';
import Stream from 'node:stream';
import { EventEmitter } from 'node:events';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import RepositoryService from '../service/repository.service';
import RepositoryServiceMock from '../tests/__mocks__/service/repository-service.mock';
import testData from '../tests/utils/test-data';

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
const historyService: HistoryQueryService = new HistoryServiceMock();
const repositoryService: RepositoryService = new RepositoryServiceMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

let historyQuery: HistoryQuery;

const southStream = new Stream();
const connectedEvent = new EventEmitter();
const createdSouth = {
  start: jest.fn(),
  stop: jest.fn(),
  connect: jest.fn(),
  historyQueryHandler: jest.fn(),
  addItem: jest.fn(),
  deleteItem: jest.fn(),
  deleteAllItems: jest.fn(),
  resetCache: jest.fn(),
  getMetricsDataStream: jest.fn(() => southStream),
  historyIsRunning: false,
  createDeferredPromise: jest.fn(),
  resolveDeferredPromise: jest.fn(),
  connectedEvent
};

const northStream = new Stream();
const createdNorth = {
  start: jest.fn(),
  stop: jest.fn(),
  connect: jest.fn(),
  cacheValues: jest.fn(),
  cacheFile: jest.fn(),
  resetCache: jest.fn(),
  isCacheEmpty: jest.fn(),
  getMetricsDataStream: jest.fn(() => northStream)
};

describe('HistoryQuery enabled', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    connectedEvent.removeAllListeners();

    (southService.runSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.runNorth as jest.Mock).mockReturnValue(createdNorth);
    (repositoryService.historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);

    historyQuery = new HistoryQuery(
      testData.historyQueries.list[0],
      southService,
      northService,
      historyService,
      repositoryService,
      logger,
      path.resolve('baseFolder', testData.historyQueries.list[0].id)
    );
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', testData.historyQueries.list[0].id, 'south'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', testData.historyQueries.list[0].id, 'north'));
    expect(createdNorth.start).toHaveBeenCalledTimes(1);

    northStream.emit('data', `data: ${JSON.stringify({})}`);
    southStream.emit('data', `data: ${JSON.stringify({})}`);
    expect(updateMetrics).toHaveBeenCalledTimes(2);
    expect(updateMetrics).toHaveBeenCalledWith({ status: 'my status', south: {} });
    expect(updateMetrics).toHaveBeenCalledWith({ status: 'my status', north: {} });
  });

  it('should start south connector', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    createdSouth.historyQueryHandler.mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    await historyQuery.start();
    connectedEvent.emit('connected');
    expect(createdSouth.start).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(
      testData.historyQueries.list[0].items.map(item => ({ ...item, scanModeId: 'history' })),
      testData.historyQueries.list[0].startTime,
      testData.historyQueries.list[0].endTime,
      'history'
    );
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    connectedEvent.emit('connected');
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should start south connector with error', async () => {
    createdSouth.historyQueryHandler
      .mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          reject('error');
        });
      })
      .mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          reject('error');
        });
      })
      .mockImplementation(() => {
        return new Promise(resolve => {
          resolve('');
        });
      });
    await historyQuery.start();
    expect(createdSouth.start).toHaveBeenCalledTimes(1);
    expect(createdNorth.start).toHaveBeenCalledTimes(1);

    connectedEvent.emit('connected');

    await flushPromises();
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(
      testData.historyQueries.list[0].items.map(item => ({ ...item, scanModeId: 'history' })),
      testData.historyQueries.list[0].startTime,
      testData.historyQueries.list[0].endTime,
      'history'
    );

    expect(createdSouth.start).toHaveBeenCalledTimes(2);
    expect(createdSouth.stop).toHaveBeenCalledTimes(1);

    (repositoryService.historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce({
      ...testData.historyQueries.list[0],
      status: 'PENDING'
    });

    connectedEvent.emit('connected');
    await flushPromises();

    expect(createdSouth.start).toHaveBeenCalledTimes(2);
    expect(createdSouth.stop).toHaveBeenCalledTimes(1);
  });

  it('should cache values', async () => {
    await historyQuery.start();

    await historyQuery.addContent('southId', { type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    expect(logger.info).toHaveBeenCalledWith(
      `Add 2 values from History Query "${testData.historyQueries.list[0].name}" to north connector`
    );
    expect(createdNorth.cacheValues).toHaveBeenCalledWith([{}, {}]);
  });

  it('should cache file', async () => {
    await historyQuery.start();

    await historyQuery.addContent('southId', { type: 'raw', filePath: 'myFile' });
    expect(logger.info).toHaveBeenCalledWith(
      `Add file "myFile" from History Query "${testData.historyQueries.list[0].name}" to north connector`
    );
    expect(createdNorth.cacheFile).toHaveBeenCalledWith('myFile');
  });

  it('should properly stop', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await historyQuery.start();
    connectedEvent.emit('connected');
    await historyQuery.stop();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(createdSouth.stop).toHaveBeenCalledTimes(1);
    expect(createdNorth.stop).toHaveBeenCalledTimes(1);
    expect(createdNorth.resetCache).not.toHaveBeenCalled();
    expect(createdSouth.resetCache).not.toHaveBeenCalled();
    expect(resetMetrics).not.toHaveBeenCalled();

    await historyQuery.stop();
    expect(logger.debug).not.toHaveBeenCalled();

    await historyQuery.resetCache();
    expect(resetMetrics).toHaveBeenCalled();
    expect(createdNorth.resetCache).toHaveBeenCalledTimes(1);
    expect(createdSouth.resetCache).toHaveBeenCalledTimes(1);
  });

  it('should properly finish and not stop', async () => {
    historyQuery.stop = jest.fn();
    createdSouth.historyIsRunning = true;
    createdNorth.isCacheEmpty.mockReturnValueOnce(false).mockReturnValue(true);

    await historyQuery.start();
    await historyQuery.finish();

    expect(logger.debug).toHaveBeenCalledWith(`History query "${testData.historyQueries.list[0].name}" is still running`);
    await historyQuery.finish();
    expect(logger.debug).toHaveBeenCalledTimes(2);

    createdSouth.historyIsRunning = false;
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    connectedEvent.removeAllListeners();

    (southService.runSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.runNorth as jest.Mock).mockReturnValue(createdNorth);

    (repositoryService.historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[1]);

    historyQuery = new HistoryQuery(
      testData.historyQueries.list[1],
      southService,
      northService,
      historyService,
      repositoryService,
      logger,
      'baseFolder'
    );
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();
    expect(logger.trace).toHaveBeenCalledWith(`History Query "${testData.historyQueries.list[1].name}" not enabled`);
    expect(createdNorth.start).not.toHaveBeenCalled();
    expect(createdNorth.connect).not.toHaveBeenCalled();
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
    expect(createdSouth.stop).not.toHaveBeenCalled();
    expect(createdSouth.resetCache).not.toHaveBeenCalled();
    expect(createdNorth.stop).not.toHaveBeenCalled();
    expect(createdNorth.resetCache).not.toHaveBeenCalled();
  });

  it('should get stream', () => {
    expect(historyQuery.getMetricsDataStream()).toEqual({ stream: 'myStream' });
  });
});
