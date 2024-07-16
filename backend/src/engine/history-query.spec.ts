import HistoryQuery from './history-query';
import PinoLogger from '../tests/__mocks__/logger.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';

import { SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import { createFolder } from '../service/utils';

import pino from 'pino';
import path from 'node:path';
import HistoryServiceMock from '../tests/__mocks__/history-query-service.mock';
import HistoryQueryService from '../service/history-query.service';
import Stream from 'node:stream';
import { EventEmitter } from 'node:events';
import { OIBusTimeValue } from '../../../shared/model/engine.model';

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

const nowDateString = '2020-02-02T02:02:02.222Z';
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

let historyQuery: HistoryQuery;
let configuration: HistoryQueryDTO;

const items: Array<SouthConnectorItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId2'
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: false,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId2'
  }
];

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

    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);
    configuration = {
      id: 'historyId',
      name: 'history',
      southType: 'FolderScanner',
      northType: 'Console',
      description: 'my test history query',
      status: 'RUNNING',
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      northSettings: {},
      southSettings: {},
      southSharedConnection: false,
      startTime: '2021-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z',
      caching: {
        scanModeId: 'scanModeId',
        retryInterval: 5000,
        retryCount: 3,
        maxSize: 1,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: false,
          archive: {
            enabled: false,
            retentionDuration: 0
          }
        }
      }
    };
    (historyService.repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValue(configuration);
    (historyService.listItems as jest.Mock).mockReturnValue(items);

    historyQuery = new HistoryQuery(
      configuration,
      southService,
      northService,
      historyService,
      logger,
      path.resolve('baseFolder', configuration.id)
    );
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', configuration.id, 'south'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', configuration.id, 'north'));
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
    (historyService.listItems as jest.Mock).mockReturnValue(items);
    await historyQuery.start();
    connectedEvent.emit('connected');
    expect(createdSouth.start).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(items, configuration.startTime, configuration.endTime, 'history');
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
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(items, configuration.startTime, configuration.endTime, 'history');

    expect(createdSouth.start).toHaveBeenCalledTimes(2);
    expect(createdSouth.stop).toHaveBeenCalledTimes(1);

    (historyService.repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({
      ...configuration,
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
    expect(logger.info).toHaveBeenCalledWith(`Add 2 values from History Query "${configuration.name}" to north connector`);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith([{}, {}]);
  });

  it('should cache file', async () => {
    await historyQuery.start();

    await historyQuery.addContent('southId', { type: 'raw', filePath: 'myFile' });
    expect(logger.info).toHaveBeenCalledWith(`Add file "myFile" from History Query "${configuration.name}" to north connector`);
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

    expect(logger.debug).toHaveBeenCalledWith(`History query "${configuration.name}" is still running`);
    await historyQuery.finish();
    expect(logger.debug).toHaveBeenCalledTimes(2);

    createdSouth.historyIsRunning = false;
    await historyQuery.finish();
    expect(logger.info).toHaveBeenCalledWith(`Finish "${configuration.name}" (${configuration.id})`);
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

    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    configuration = {
      id: 'historyId',
      name: 'history',
      southType: 'FolderScanner',
      northType: 'Console',
      description: 'my test history query',
      status: 'PENDING',
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      northSettings: {},
      southSettings: {},
      southSharedConnection: false,
      startTime: '2021-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z',
      caching: {
        scanModeId: 'scanModeId',
        retryInterval: 5000,
        retryCount: 3,
        maxSize: 1,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: false,
          archive: {
            enabled: false,
            retentionDuration: 0
          }
        }
      }
    };
    (historyService.repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValue(configuration);

    historyQuery = new HistoryQuery(configuration, southService, northService, historyService, logger, 'baseFolder');
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();
    expect(logger.trace).toHaveBeenCalledWith(`History Query "${configuration.name}" not enabled`);
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
