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

jest.mock('../service/south.service');
jest.mock('../service/north.service');
const updateMetrics = jest.fn();
jest.mock(
  '../service/history-metrics.service',
  () =>
    function () {
      return {
        updateMetrics,
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

let historyQuery: HistoryQuery;
let configuration: HistoryQueryDTO;

const items: Array<SouthConnectorItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId2'
  }
];

const southStream = new Stream();
const connectedEvent = new EventEmitter();
const createdSouth = {
  start: jest.fn(),
  init: jest.fn(),
  stop: jest.fn(),
  connect: jest.fn(),
  historyQueryHandler: jest.fn(),
  addItem: jest.fn(),
  deleteItem: jest.fn(),
  deleteAllItems: jest.fn(),
  resetCache: jest.fn(),
  getMetricsDataStream: jest.fn(() => southStream),
  historyIsRunning: false,
  connectedEvent
};

const northStream = new Stream();
const createdNorth = {
  start: jest.fn(),
  init: jest.fn(),
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
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0
      },
      northSettings: {},
      southSettings: {},
      startTime: '2021-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z',
      caching: {
        scanModeId: 'scanModeId',
        maxSize: 1,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        sendFileImmediately: false,
        retryInterval: 5000
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };
    historyQuery = new HistoryQuery(
      configuration,
      southService,
      northService,
      historyService,
      items,
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
    createdSouth.historyQueryHandler.mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    await historyQuery.start();
    connectedEvent.emit('connected');
    expect(createdSouth.start).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(items, configuration.startTime, configuration.endTime, 'history');
  });

  it('should start south connector with error', async () => {
    createdSouth.historyQueryHandler
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
    connectedEvent.emit('connected');

    expect(createdSouth.start).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(items, configuration.startTime, configuration.endTime, 'history');
  });

  it('should cache values', async () => {
    await historyQuery.start();

    await historyQuery.addValues('southId', ['', '']);
    expect(logger.info).toHaveBeenCalledWith(`Add 2 values from History Query "${configuration.name}" to north connector`);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith(['', '']);
  });

  it('should cache file', async () => {
    await historyQuery.start();

    await historyQuery.addFile('southId', 'myFile');
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
    await historyQuery.stop(true);
    expect(createdNorth.resetCache).toHaveBeenCalledTimes(1);
    expect(createdSouth.resetCache).toHaveBeenCalledTimes(1);
    expect(logger.debug).not.toHaveBeenCalled();
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

  it('should properly add item', async () => {
    await historyQuery.start();
    historyQuery.stop = jest.fn();
    historyQuery.start = jest.fn();
    await historyQuery.addItem(items[0]);
    expect(historyQuery.stop).toHaveBeenCalledTimes(1);
    expect(historyQuery.start).toHaveBeenCalledTimes(1);
    expect(createdSouth.addItem).toHaveBeenCalledTimes(1);
    expect(createdSouth.addItem).toHaveBeenCalledWith(items[0]);
  });

  it('should properly update item', async () => {
    await historyQuery.start();
    historyQuery.deleteItem = jest.fn();
    historyQuery.addItem = jest.fn();
    await historyQuery.updateItem(items[0]);
    expect(historyQuery.deleteItem).toHaveBeenCalledTimes(1);
    expect(historyQuery.addItem).toHaveBeenCalledTimes(1);
  });

  it('should properly delete item', async () => {
    await historyQuery.start();
    await historyQuery.deleteItem(items[0]);
    expect(createdSouth.deleteItem).toHaveBeenCalledTimes(1);
    expect(createdSouth.deleteItem).toHaveBeenCalledWith(items[0]);
  });

  it('should properly delete items', async () => {
    await historyQuery.deleteItems();
    await historyQuery.start();
    await historyQuery.deleteItems();
    expect(createdSouth.deleteAllItems).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when adding item without any south', async () => {
    historyQuery.stop = jest.fn();
    historyQuery.start = jest.fn();
    await historyQuery.addItem(items[0]);
    expect(historyQuery.stop).not.toHaveBeenCalled();
    expect(historyQuery.start).not.toHaveBeenCalled();
    expect(createdSouth.addItem).not.toHaveBeenCalled();
  });

  it('should do nothing when updating item without any south', async () => {
    historyQuery.deleteItem = jest.fn();
    historyQuery.addItem = jest.fn();
    await historyQuery.updateItem(items[0]);
    expect(historyQuery.deleteItem).not.toHaveBeenCalled();
    expect(historyQuery.addItem).not.toHaveBeenCalled();
  });

  it('should do nothing when deleting item without any south', async () => {
    await historyQuery.deleteItem(items[0]);
    expect(createdSouth.deleteItem).not.toHaveBeenCalled();
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
      enabled: false,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0
      },
      northSettings: {},
      southSettings: {},
      startTime: '2021-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z',
      caching: {
        scanModeId: 'scanModeId',
        maxSize: 1,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        sendFileImmediately: false,
        retryInterval: 5000
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };
    historyQuery = new HistoryQuery(configuration, southService, northService, historyService, items, logger, 'baseFolder');
  });

  it('should be properly initialized', async () => {
    await historyQuery.start();
    expect(logger.trace).toHaveBeenCalledWith(`History Query "${configuration.name}" not enabled`);
    expect(createdNorth.start).not.toHaveBeenCalled();
    expect(createdNorth.connect).not.toHaveBeenCalled();
  });

  it('should not cache values if north is not defined', async () => {
    await historyQuery.addValues('southId', []);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should not cache file if north is not defined', async () => {
    await historyQuery.addFile('southId', 'filePath');
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
